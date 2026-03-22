import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix

    // Dynamic import to handle Vercel file system
    let db: any
    try {
      db = await import('@/lib/db')
    } catch (importErr) {
      console.error('Failed to import db module:', importErr)
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 503 }
      )
    }

    // Look up session
    const session = db.getSession(token)
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // Check if session has expired
    const expiresAt = new Date(session.expiresAt)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      )
    }

    // Get user info
    const user = db.getUser(session.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
