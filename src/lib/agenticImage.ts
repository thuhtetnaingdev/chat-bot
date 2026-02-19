import { generateImage, editImage, verifyImageWithVision } from '@/lib/api'
import { type AgenticIteration, type VisionVerification } from '@/types'

export interface AgenticImageResult {
  finalImage: string
  iterations: AgenticIteration[]
  success: boolean
  totalIterations: number
}

export interface AgenticImageCallbacks {
  onIterationStart?: (iterationNumber: number, prompt: string) => void
  onImageGenerated?: (iterationNumber: number, image: string) => void
  onVisionCheck?: (iterationNumber: number, feedback: VisionVerification) => void
  onEditPromptGenerated?: (iterationNumber: number, editPrompt: string) => void
}

export const agenticImageGeneration = async (
  originalPrompt: string,
  apiKey: string,
  imageModel: string,
  visionModel: string,
  maxIterations: number = 3,
  initialImage?: string,
  callbacks?: AgenticImageCallbacks
): Promise<AgenticImageResult> => {
  const iterations: AgenticIteration[] = []
  let currentImage: string | undefined = initialImage
  let currentPrompt = originalPrompt
  let isEdit = !!initialImage

  for (let i = 1; i <= maxIterations; i++) {
    callbacks?.onIterationStart?.(i, currentPrompt)

    // Generate or edit image
    if (!isEdit) {
      currentImage = await generateImage(currentPrompt, apiKey, imageModel)
    } else {
      currentImage = await editImage(currentPrompt, [currentImage!], apiKey)
    }

    callbacks?.onImageGenerated?.(i, currentImage)

    // Verify with vision model
    const visionFeedback = await verifyImageWithVision(
      currentImage,
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
      visionFeedback
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

    // If not satisfied and not last iteration, prepare edit prompt
    if (i < maxIterations) {
      // Build edit prompt from vision feedback
      const issues = visionFeedback.issues.length > 0 
        ? visionFeedback.issues.join(', ')
        : 'improve image quality'
      
      currentPrompt = visionFeedback.suggestedEdit || 
        `Fix the following issues: ${issues}. Maintain the original concept: ${originalPrompt}`
      
      isEdit = true
      callbacks?.onEditPromptGenerated?.(i + 1, currentPrompt)
    }
  }

  // Max iterations reached - return last image
  return {
    finalImage: currentImage!,
    iterations,
    success: false,
    totalIterations: maxIterations
  }
}
