import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { checkPublishRequirements } from '@/lib/legal'
import { getSession } from '@/lib/auth/session'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check publish requirements
    const check = await checkPublishRequirements(id)

    if (!check.canPublish) {
      return NextResponse.json({
        error: 'Cannot publish article',
        missingRequirements: check.missingRequirements,
        published: false,
      }, { status: 400 })
    }

    const article = await db.article.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    return NextResponse.json({
      article,
      published: true,
      warnings: check.warnings,
    })
  } catch (error) {
    console.error('Publish article error:', error)
    return NextResponse.json({ error: 'Failed to publish article' }, { status: 500 })
  }
}
