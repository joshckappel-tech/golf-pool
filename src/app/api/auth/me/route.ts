import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    let db: any
    try {
      if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
        db = await import('@/lib/db-kv')
      } else {
        db = await import('@/lib/db')
      }
    } catch (importErr) {
      return NextResponse.json({ error: 'Database initialization failed' }, { status: 503 })
    }

    const session = await db.getSession(token)
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const user = await db.getUser(session.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
