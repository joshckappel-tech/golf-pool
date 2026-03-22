import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

interface LoginRequest {
  email: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()

    // Validate input
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      )
    }

    // Dynamic import to handle Vercel file system initialization
    let db: any
    try {
      db = await import('@/lib/db')
    } catch (importErr) {
      console.error('Failed to import db module:', importErr)
      return NextResponse.json(
        { error: 'Database initialization failed. Please try again.' },
        { status: 503 }
      )
    }

    // Look up user by email
    const user = db.getUserByEmail(body.email.toLowerCase())
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordHash = crypto
      .pbkdf2Sync(body.password, user.salt, 10000, 64, 'sha256')
      .toString('hex')

    if (passwordHash !== user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const session = {
      token: sessionToken,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    db.saveSession(session)

    return NextResponse.json(
      {
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
