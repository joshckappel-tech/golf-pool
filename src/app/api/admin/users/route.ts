import { NextResponse } from 'next/server'

export async function GET() {
  try {
    let db: any
    if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
      db = await import('@/lib/db-kv')
    } else {
      db = await import('@/lib/db')
    }

    const users = await db.getUsers()

    // Return users WITHOUT password hashes or salts
    const safeUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
    }))

    return NextResponse.json(safeUsers, { status: 200 })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
