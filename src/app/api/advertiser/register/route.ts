import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { advertiserRegisterSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = advertiserRegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password, name, companyName, phone } = result.data

    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    // role is always hardcoded server-side, never taken from the request body
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADVERTISER',
        advertiser: {
          create: {
            companyName,
            phone,
          },
        },
      },
      include: { advertiser: true },
    })

    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      advertiser: user.advertiser,
    })
  } catch (error) {
    console.error('Advertiser register error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    )
  }
}
