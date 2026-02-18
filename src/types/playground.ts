export type SessionType = 'text' | 'image' | 'edit'
export type OutputType = 'text' | 'image'

export interface PromptVariable {
  name: string
  defaultValue: string
  currentValue: string
}

export interface PromptVariant {
  id: string
  name: string
  prompt: string
  imageModel?: string
  createdAt: number
}

export interface TestCase {
  id: string
  name: string
  input: string
  createdAt: number
}

export interface RunMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  responseTimeMs: number
}

export interface TestRun {
  id: string
  variantId: string
  testCaseId: string | null
  model: string
  output: string
  outputType: OutputType
  inputImage?: string
  metrics: RunMetrics
  rating: number
  notes: string
  timestamp: number
}

export interface PlaygroundSession {
  id: string
  name: string
  type: SessionType
  editImage?: string
  variants: PromptVariant[]
  testCases: TestCase[]
  variables: PromptVariable[]
  runs: TestRun[]
  testInput: string
  createdAt: number
  updatedAt: number
}

export const MAX_VARIANTS = 5

export const VARIABLE_REGEX = /\{\{(\w+)(?::([^}]+))?\}\}/g

export function detectVariables(prompt: string): PromptVariable[] {
  const variables: PromptVariable[] = []
  const seen = new Set<string>()
  
  VARIABLE_REGEX.lastIndex = 0
  
  let match
  while ((match = VARIABLE_REGEX.exec(prompt)) !== null) {
    const name = match[1]
    const defaultValue = match[2] || ''
    
    if (!seen.has(name)) {
      seen.add(name)
      variables.push({
        name,
        defaultValue,
        currentValue: defaultValue
      })
    }
  }
  
  return variables
}

export function mergeVariables(
  existing: PromptVariable[],
  detected: PromptVariable[]
): PromptVariable[] {
  const merged: PromptVariable[] = []
  const existingMap = new Map(existing.map(v => [v.name, v]))
  
  for (const detectedVar of detected) {
    const existingVar = existingMap.get(detectedVar.name)
    if (existingVar) {
      merged.push({
        ...detectedVar,
        currentValue: existingVar.currentValue
      })
    } else {
      merged.push(detectedVar)
    }
  }
  
  return merged
}

export function interpolatePrompt(
  prompt: string,
  variables: PromptVariable[]
): string {
  let result = prompt
  
  for (const variable of variables) {
    const regex = new RegExp(
      `\\{\\{${variable.name}(?::[^}]+)?\\}\\}`,
      'g'
    )
    result = result.replace(regex, variable.currentValue || variable.defaultValue)
  }
  
  return result
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function generateSessionName(existingSessions: PlaygroundSession[]): string {
  const numbers = existingSessions
    .map(s => {
      const match = s.name.match(/Session (\d+)/)
      return match ? parseInt(match[1]) : 0
    })
    .filter(n => !isNaN(n) && n > 0)
  
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  return `Session ${nextNumber}`
}

export function generateVariantName(variants: PromptVariant[]): string {
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const usedLabels = new Set(variants.map(v => v.name))
  
  for (const label of labels) {
    if (!usedLabels.has(label)) {
      return label
    }
  }
  
  return `Variant ${variants.length + 1}`
}

export function getBestRun(runs: TestRun[]): TestRun | null {
  const ratedRuns = runs.filter(r => r.rating > 0)
  if (ratedRuns.length === 0) return null
  
  return ratedRuns.reduce((best, current) => 
    current.rating > best.rating ? current : best
  )
}
