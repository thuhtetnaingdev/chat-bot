import { generateVideo, verifyVideoWithVision } from '@/lib/api'
import { type AgenticVideoIteration, type VisionVerification } from '@/types'

export interface AgenticVideoResult {
  finalVideo: string
  iterations: AgenticVideoIteration[]
  success: boolean
  totalIterations: number
}

export interface AgenticVideoCallbacks {
  onIterationStart?: (iterationNumber: number, prompt: string) => void
  onVideoGenerated?: (iterationNumber: number, video: string) => void
  onVisionCheck?: (iterationNumber: number, feedback: VisionVerification) => void
  onEditPromptGenerated?: (iterationNumber: number, editPrompt: string) => void
}

export const agenticVideoGeneration = async (
  originalPrompt: string,
  apiKey: string,
  videoResolution: string,
  visionModel: string,
  maxIterations: number = 3,
  initialImage: string,
  callbacks?: AgenticVideoCallbacks
): Promise<AgenticVideoResult> => {
  if (!initialImage) {
    throw new Error('Initial image is required for agentic video generation')
  }

  const iterations: AgenticVideoIteration[] = []
  let currentVideo: string | undefined
  let currentPrompt = originalPrompt

  for (let i = 1; i <= maxIterations; i++) {
    callbacks?.onIterationStart?.(i, currentPrompt)

    // Generate video - always use initial image for all iterations (video model doesn't support video-to-video)
    currentVideo = await generateVideo(currentPrompt, apiKey, initialImage, videoResolution)

    callbacks?.onVideoGenerated?.(i, currentVideo)

    // Verify with vision model
    const visionFeedback = await verifyVideoWithVision(
      currentVideo,
      originalPrompt,
      apiKey,
      visionModel
    )

    callbacks?.onVisionCheck?.(i, visionFeedback)

    // Store iteration
    iterations.push({
      iterationNumber: i,
      video: currentVideo,
      editPrompt: currentPrompt,
      visionFeedback
    })

    // Check if satisfied
    if (visionFeedback.satisfied) {
      return {
        finalVideo: currentVideo,
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
        : 'improve video quality'
      
      currentPrompt = visionFeedback.suggestedEdit || 
        `Fix the following issues: ${issues}. Maintain the original concept: ${originalPrompt}`
      
      callbacks?.onEditPromptGenerated?.(i + 1, currentPrompt)
    }
  }

  // Max iterations reached - return last video
  return {
    finalVideo: currentVideo!,
    iterations,
    success: false,
    totalIterations: maxIterations
  }
}
