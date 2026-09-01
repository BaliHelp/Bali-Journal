import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

interface Params {
  params: Promise<{ id: string }>
}

async function requireEditor() {
  const session = await getSession()
  return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    const member = await db.teamMember.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        bio: body.bio ?? null,
        photoUrl: body.photoUrl ?? null,
        order: typeof body.order === 'number' ? body.order : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      },
    })
    return NextResponse.json({ member })
  } catch (error) {
    console.error('Update team member error:', error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    await db.teamMember.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete team member error:', error)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
}
