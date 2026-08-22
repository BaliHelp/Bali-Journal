import { myaiCompleteJSON, MYAI_FIELDS } from './myaiClient'
import { moderateContent } from './moderation'

interface LegalRiskResult {
  riskScore: number // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  containsAccusation: boolean
  categories: {
    defamation: number
    privacyViolation: number
    falseInformation: number
    criminalAllegation: number
    corporateRisk: number
  }
  recommendations: string[]
  requiresLegalReview: boolean
}

export async function analyzeLegalRisk(content: string, title: string): Promise<LegalRiskResult> {
  try {
    const result = await myaiCompleteJSON(MYAI_FIELDS.AUDY, [
      {
        role: 'system',
        content: `You are a legal risk assessment AI for Indonesian journalism. Analyze articles for potential legal risks under Indonesian law including:

1.UU ITE (Information and Electronic Transactions Law) - Article 27(3) on defamation
2. UU Pers (Press Law) - journalistic compliance
3. UU Perlindungan Data Pribadi (Personal Data Protection Law)
4. Civil and Criminal Code regarding defamation (pencemaran nama baik)

Analyze the content and provide scores for:
- defamation: Risk of defamation claims (0-100)
- privacyViolation: Risk of privacy violations (0-100)
- falseInformation: Risk of spreading false information (0-100)
- criminalAllegation: Risk from criminal allegations (0-100)
- corporateRisk: Risk from corporate/enterprise mentions (0-100)

Calculate an overall riskScore (0-100) and determine:
- riskLevel: LOW (0-30), MEDIUM (31-60), HIGH (61-80), CRITICAL (81-100)
- containsAccusation: Whether content contains direct accusations
- requiresLegalReview: Whether legal counsel should review before publication
- recommendations: Array of actionable recommendations in Indonesian

Respond ONLY with a JSON object.`
      },
      {
        role: 'user',
        content: `Analyze this article:\n\nTitle: ${title}\n\nContent:\n${content}`
      }
    ])

    const riskScore = Math.min(100, Math.max(0, result.riskScore || 0))

    return {
      riskScore,
      riskLevel: getRiskLevelFromScore(riskScore),
      containsAccusation: result.containsAccusation || false,
      categories: {
        defamation: Math.min(100, Math.max(0, result.categories?.defamation || 0)),
        privacyViolation: Math.min(100, Math.max(0, result.categories?.privacyViolation || 0)),
        falseInformation: Math.min(100, Math.max(0, result.categories?.falseInformation || 0)),
        criminalAllegation: Math.min(100, Math.max(0, result.categories?.criminalAllegation || 0)),
        corporateRisk: Math.min(100, Math.max(0, result.categories?.corporateRisk || 0)),
      },
      recommendations: result.recommendations || [],
      requiresLegalReview: riskScore > 70,
    }
  } catch (error) {
    console.error('Legal risk analysis error:', error)
    return {
      riskScore: 50,
      riskLevel: 'MEDIUM',
      containsAccusation: false,
      categories: {
        defamation: 0,
        privacyViolation: 0,
        falseInformation: 0,
        criminalAllegation: 0,
        corporateRisk: 0,
      },
      recommendations: ['Manual legal review required - AI analysis unavailable'],
      requiresLegalReview: true,
    }
  }
}

function getRiskLevelFromScore(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score <= 30) return 'LOW'
  if (score <= 60) return 'MEDIUM'
  if (score <= 80) return 'HIGH'
  return 'CRITICAL'
}

export function calculateToxicityScore(content: string): Promise<number> {
  // Return a normalized toxicity score for comments
  return moderateContent(content).then(result => {
    const maxCategory = Math.max(
      result.categories.hate,
      result.categories.harassment,
      result.categories.violence,
      result.categories.sara,
      result.categories.defamation
    )
    return maxCategory
  })
}

