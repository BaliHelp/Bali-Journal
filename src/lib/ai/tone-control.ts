import { myaiComplete, myaiCompleteJSON, MYAI_FIELDS } from './myaiClient'

interface ToneAnalysis {
  isNeutral: boolean
  emotionalWords: string[]
  accusatoryPhrases: string[]
  suggestions: string[]
  rewrittenVersion?: string
}

export async function analyzeTone(content: string): Promise<ToneAnalysis> {
  try {
    const result = await myaiCompleteJSON(MYAI_FIELDS.AUDY, [
      {
        role: 'system',
        content: `You are a journalistic tone analyzer for an investigative news platform. Your job is to ensure articles follow evidence-first, neutral journalism standards.

Analyze the content for:
1. Emotional adjectives that suggest bias
2. Direct accusations without attribution
3. Subjective language
4. Loaded language

Guidelines for neutral journalism:
- Avoid emotional adjectives (e.g., "shocking", "outrageous", "devastating")
- Avoid direct accusations - use "allegedly" or cite sources
- Use neutral phrasing
- Cite documents and sources when making claims
- Never assume motive

Respond with a JSON object containing:
- isNeutral: boolean
- emotionalWords: array of emotional/biased words found
- accusatoryPhrases: array of accusatory phrases found
- suggestions: array of improvement suggestions in Indonesian
- rewrittenVersion: optional neutral rewrite of problematic sections`
      },
      {
        role: 'user',
        content: `Analyze the journalistic tone of this content:\n\n${content}`
      }
    ])

    return {
      isNeutral: result.isNeutral ?? true,
      emotionalWords: result.emotionalWords || [],
      accusatoryPhrases: result.accusatoryPhrases || [],
      suggestions: result.suggestions || [],
      rewrittenVersion: result.rewrittenVersion,
    }
  } catch (error) {
    console.error('Tone analysis error:', error)
    return {
      isNeutral: true,
      emotionalWords: [],
      accusatoryPhrases: [],
      suggestions: ['Tone analysis unavailable - manual review recommended'],
    }
  }
}

export async function suggestNeutralRewrite(content: string): Promise<string> {
  try {
    const result = await myaiComplete(MYAI_FIELDS.AUDY, [
      {
        role: 'system',
        content: `You are an expert editor for investigative journalism. Rewrite the given content to be:
1. Factually neutral
2. Evidence-based
3. Properly attributed
4. Free of emotional language
5. Objective in tone

Maintain all factual information while removing bias. Use Indonesian journalistic standards.`
      },
      {
        role: 'user',
        content: `Rewrite this content in a neutral, journalistic tone:\n\n${content}`
      }
    ])

    return result || content
  } catch (error) {
    console.error('Rewrite error:', error)
    return content
  }
}
