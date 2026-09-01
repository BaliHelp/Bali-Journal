import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

async function requireEditor() {
  const session = await getSession()
  return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

export async function GET() {
  try {
    if (!(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const members = await db.teamMember.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Get team members error:', error)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    if (!body.name || !body.role) {
      return NextResponse.json({ error: 'Nama dan jabatan wajib diisi' }, { status: 400 })
    }
    const member = await db.teamMember.create({
      data: {
        name: body.name,
        role: body.role,
        bio: body.bio || null,
        photoUrl: body.photoUrl || null,
        order: typeof body.order === 'number' ? body.order : 0,
        isActive: body.isActive ?? true,
      },
    })
    return NextResponse.json({ member })
  } catch (error) {
    console.error('Create team member error:', error)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}
