import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    let db: any
    try {
      if (process.env.KV_REST_API_URL) {
        db = await import('@/lib/db-kv')
      } else {
        db = await import('@/lib/db')
      }
    } catch (importErr) {
      return NextResponse.json({ error: 'Database initialization failed' }, { status: 503 })
    }

    const session = await db.getSession(token)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    await db.deleteSession(token)

    return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
