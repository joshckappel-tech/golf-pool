import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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

    // Verify session exists
    const session = db.getSession(token)
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Delete session
    db.deleteSession(token)

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
