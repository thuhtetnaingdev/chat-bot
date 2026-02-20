import {
  generateImage,
  editImage,
  verifyImageWithVision,
  analyzeImageForEditing,
  getImageDimensions,
  planEditPrompt
} from '@/lib/api'
import { type AgenticIteration, type VisionVerification, type ImageAnalysis } from '@/types'

export interface AgenticImageResult {
  finalImage: string
  iterations: AgenticIteration[]
  success: boolean
  totalIterations: number
}

export interface AgenticImageCallbacks {
  onAnalysisStart?: () => void
  onAnalysisComplete?: (analysis: ImageAnalysis) => void
  onIterationStart?: (iterationNumber: number, prompt: string, isEditing: boolean) => void
  onImageGenerated?: (iterationNumber: number, image: string) => void
  onVisionCheck?: (iterationNumber: number, feedback: VisionVerification) => void
  onPlanningStart?: (iterationNumber: number) => void
  onPlanningComplete?: (iterationNumber: number, plannedPrompt: string) => void
  onEditPromptGenerated?: (iterationNumber: number, editPrompt: string) => void
}

export const agenticImageGeneration = async (
  originalPrompt: string,
  apiKey: string,
  imageModel: string,
  visionModel: string,
  maxIterations: number = 3,
  initialImages?: string[],
  selectedModel?: string,
  callbacks?: AgenticImageCallbacks
): Promise<AgenticImageResult> => {
  const iterations: AgenticIteration[] = []
  // Keep original images separate - always use these for editing to prevent face drift
  const originalInputImages = initialImages ? [...initialImages] : []
  // Track only the edited results
  const editedResults: string[] = []
  let currentPrompt = originalPrompt
  let isEdit = initialImages && initialImages.length > 0

  // Store analysis for all iterations
  let imageAnalysis: ImageAnalysis | undefined

  // Get original image dimensions to maintain aspect ratio
  let originalDimensions: { width: number; height: number } | undefined
  if (isEdit && originalInputImages.length > 0) {
    try {
      originalDimensions = await getImageDimensions(originalInputImages[0])
    } catch (error) {
      console.warn('Could not get original image dimensions:', error)
      // Continue without dimensions - API will use defaults
    }
  }

  // STEP 1: Pre-analysis for edit mode (Vision First approach)
  if (isEdit && originalInputImages.length > 0) {
    callbacks?.onAnalysisStart?.()

    try {
      imageAnalysis = await analyzeImageForEditing(
        originalInputImages,
        originalPrompt,
        apiKey,
        visionModel
      )

      callbacks?.onAnalysisComplete?.(imageAnalysis)

      // STEP 2: Planning Agent - Create optimized edit prompt
      if (selectedModel) {
        callbacks?.onPlanningStart?.(0)

        try {
          const plannedPrompt = await planEditPrompt(
            originalPrompt,
            { satisfied: false, issues: [], suggestedEdit: '' },
            imageAnalysis,
            apiKey,
            selectedModel
          )

          callbacks?.onPlanningComplete?.(0, plannedPrompt)
          currentPrompt = plannedPrompt
          console.log(
            `Planning agent generated initial prompt: "${plannedPrompt.slice(0, 100)}..."`
          )
        } catch (error) {
          console.warn('Planning agent failed, using analysis preservation prompt:', error)
          currentPrompt = imageAnalysis.preservationInstructions
        }
      } else {
        // No planning model - use preservation instructions from analysis
        currentPrompt = imageAnalysis.preservationInstructions
      }
    } catch (error) {
      // Analysis failed - throw error to stop the edit
      throw new Error(
        `Image analysis failed: ${error instanceof Error ? error.message : 'Unable to analyze images for precise editing'}`
      )
    }
  }

  for (let i = 1; i <= maxIterations; i++) {
    callbacks?.onIterationStart?.(i, currentPrompt, isEdit || false)

    // Generate or edit image
    let currentImage: string
    if (!isEdit) {
      currentImage = await generateImage(currentPrompt, apiKey, imageModel)
    } else {
      // CRITICAL: Always use ONLY original input images for editing
      // Never pass previously edited images to prevent face/identity drift
      // Pass original dimensions to maintain aspect ratio
      currentImage = await editImage(
        currentPrompt,
        originalInputImages,
        apiKey,
        originalDimensions?.width,
        originalDimensions?.height
      )
    }

    // Track this edited result
    editedResults.push(currentImage)

    callbacks?.onImageGenerated?.(i, currentImage)

    // Verify with vision model - send original inputs + current result for comparison
    const imagesForVerification = [...originalInputImages, currentImage]
    const visionFeedback = await verifyImageWithVision(
      imagesForVerification,
      originalPrompt,
      apiKey,
      visionModel
    )

    callbacks?.onVisionCheck?.(i, visionFeedback)

    // Store iteration
    iterations.push({
      iterationNumber: i,
      image: currentImage,
      editPrompt: currentPrompt,
      visionFeedback,
      imageAnalysis: i === 1 ? imageAnalysis : undefined // Include analysis in first iteration
    })

    // Check if satisfied
    if (visionFeedback.satisfied) {
      return {
        finalImage: currentImage,
        iterations,
        success: true,
        totalIterations: i
      }
    }

    // If not satisfied and not last iteration, prepare edit prompt and determine strategy
    if (i < maxIterations) {
      // Use Planning Agent if selectedModel is provided
      if (selectedModel) {
        callbacks?.onPlanningStart?.(i)

        try {
          const plannedPrompt = await planEditPrompt(
            originalPrompt,
            visionFeedback,
            imageAnalysis,
            apiKey,
            selectedModel
          )

          callbacks?.onPlanningComplete?.(i, plannedPrompt)
          currentPrompt = plannedPrompt
          console.log(
            `Iteration ${i}: Planning agent generated: "${plannedPrompt.slice(0, 100)}..."`
          )
        } catch (error) {
          console.warn('Planning agent failed, using fallback:', error)
          // Fallback to vision suggestion or simple prompt
          const issues =
            visionFeedback.issues.length > 0
              ? visionFeedback.issues.join(', ')
              : 'improve image quality'
          currentPrompt =
            visionFeedback.suggestedEdit ||
            `Fix the following issues: ${issues}. Maintain the original concept: ${originalPrompt}`
        }
      } else {
        // No planning model selected - use simple fallback
        const issues =
          visionFeedback.issues.length > 0
            ? visionFeedback.issues.join(', ')
            : 'improve image quality'
        currentPrompt =
          visionFeedback.suggestedEdit ||
          `Fix the following issues: ${issues}. Maintain the original concept: ${originalPrompt}`
      }

      // Determine which images to use for next iteration based on strategy
      const strategy = visionFeedback.recommendedStrategy || 'fresh'

      if (strategy === 'progressive' && editedResults.length > 0) {
        console.log(`Iteration ${i}: Using progressive strategy`)
      } else if (strategy === 'targeted') {
        console.log(`Iteration ${i}: Using targeted strategy`)
      } else {
        console.log(`Iteration ${i}: Using fresh strategy`)
      }

      isEdit = true
      callbacks?.onEditPromptGenerated?.(i + 1, currentPrompt)
    }
  }

  // Max iterations reached - return last edited image
  return {
    finalImage: editedResults[editedResults.length - 1],
    iterations,
    success: false,
    totalIterations: maxIterations
  }
}
