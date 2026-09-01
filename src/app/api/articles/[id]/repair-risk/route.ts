import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { checkFatality } from '@/lib/ai/check-fatality'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * "Check Fatality" - admin-triggered legal-risk check + repair for a single
 * article from the Articles panel, without needing to open the full edit
 * dialog. See src/lib/ai/check-fatality.ts for the shared logic (also used
 * by the auto-publish-high-risk cron job).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await checkFatality(id, session.name || session.email)
    if (!result) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Repair risk error:', error)
    return NextResponse.json({ error: 'Failed to check/repair legal risk' }, { status: 500 })
  }
}
