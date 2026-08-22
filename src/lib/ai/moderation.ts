import { myaiCompleteJSON, MYAI_FIELDS } from './myaiClient'
import { recallMemories, storeMemory, formatMemoriesForPrompt } from './memory'

interface ModerationResult {
  flagged: boolean
  categories: {
    hate: number
    harassment: number
    violence: number
    selfHarm: number
    sexual: number
    sara: number // Suku, Agama, Ras, Antargolongan (Indonesian hate speech categories)
    defamation: number
  }
  recommendation: 'approve' | 'review' | 'reject'
  reason: string
}

export async function moderateContent(content: string): Promise<ModerationResult> {
  try {
    const pastDecisions = await recallMemories({
      agentKey: 'AUDY',
      category: 'moderation-precedent',
      query: content,
    }).catch(() => [])

    // Use LLM for moderation analysis
    const result = await myaiCompleteJSON(MYAI_FIELDS.AUDY, [
      {
        role: 'system',
        content: `You are a content moderation AI for an Indonesian news platform. Analyze the following content for:

1. Hate speech (ucapan kebencian)
2. Harassment (pelecehan)
3. Violence (kekerasan)
4. SARA issues (Suku, Agama, Ras, Antargolongan - ethnic/religious/racial tensions)
5. Defamation/libel risk (pencemaran nama baik)
6. Self-harm content
7. Sexual content

Respond with a JSON object containing:
- flagged: boolean
- categories: object with scores 0-1 for each category
- recommendation: "approve", "review", or "reject"
- reason: brief explanation in Indonesian

Score thresholds:
- 0.0-0.3: Safe
- 0.3-0.7: Needs review
- 0.7-1.0: Should reject

Use the past precedents below (if any) to stay consistent with how similar content was judged before.${formatMemoriesForPrompt(pastDecisions)}`
      },
      {
        role: 'user',
        content: `Analyze this content:\n\n${content}`
      }
    ])

    const moderationResult: ModerationResult = {
      flagged: result.flagged || false,
      categories: {
        hate: result.categories?.hate || 0,
        harassment: result.categories?.harassment || 0,
        violence: result.categories?.violence || 0,
        selfHarm: result.categories?.selfHarm || 0,
        sexual: result.categories?.sexual || 0,
        sara: result.categories?.sara || 0,
        defamation: result.categories?.defamation || 0,
      },
      recommendation: result.recommendation || 'review',
      reason: result.reason || 'Content analyzed',
    }

    // Only store review/reject cases as precedent - approved content is
    // the routine case and would just bloat the table without adding
    // useful signal for future judgment calls.
    if (moderationResult.recommendation !== 'approve') {
      await storeMemory({
        agentKey: 'AUDY',
        category: 'moderation-precedent',
        content: `Content: "${content.slice(0, 200)}" -> ${moderationResult.recommendation} (${moderationResult.reason})`,
        metadata: { recommendation: moderationResult.recommendation },
      }).catch(err => console.error('Failed to store moderation memory:', err))
    }

    return moderationResult
  } catch (error) {
    console.error('Moderation error:', error)
    // Default to review on error
    return {
      flagged: false,
      categories: {
        hate: 0,
        harassment: 0,
        violence: 0,
        selfHarm: 0,
        sexual: 0,
        sara: 0,
        defamation: 0,
      },
      recommendation: 'review',
      reason: 'Moderation service unavailable - manual review required',
    }
  }
}

export function getCommentStatusFromModeration(result: ModerationResult): 'PENDING' | 'APPROVED' | 'FLAGGED' {
  switch (result.recommendation) {
    case 'approve':
      return 'APPROVED'
    case 'reject':
      return 'FLAGGED'
    default:
      return 'PENDING'
  }
}
