import { NextRequest, NextResponse } from 'next/server'

async function getDb() {
  if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
    return await import('@/lib/db-kv')
  }
  // Fallback: file-based for local dev
  const { promises: fs } = await import('fs')
  const fsSync = (await import('fs')).default
  const path = (await import('path')).default

  const IS_VERCEL = !!process.env.VERCEL
  const SOURCE_DATA_DIR = path.join(process.cwd(), 'data')
  const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : SOURCE_DATA_DIR

  return {
    async getAllEntries() {
      try {
        await fs.mkdir(DATA_DIR, { recursive: true })
        const tmpPath = path.join(DATA_DIR, 'entries.json')
        if (IS_VERCEL && !fsSync.existsSync(tmpPath)) {
          const src = path.join(SOURCE_DATA_DIR, 'entries.json')
          if (fsSync.existsSync(src)) await fs.copyFile(src, tmpPath)
          else await fs.writeFile(tmpPath, '[]', 'utf-8')
        }
        const data = await fs.readFile(tmpPath, 'utf-8')
        return JSON.parse(data)
      } catch (e: any) {
        if (e.code === 'ENOENT') return []
        return []
      }
    },
    async saveAllEntries(entries: any[]) {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(path.join(DATA_DIR, 'entries.json'), JSON.stringify(entries, null, 2), 'utf-8')
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const db = await getDb()

    let entries: any[]
    if ('getAllEntries' in db) {
      entries = await db.getAllEntries()
    } else {
      entries = await (db as any).getAllEntries()
    }

    if (userId) {
      return NextResponse.json(entries.filter((e: any) => e.userId === userId))
    }
    return NextResponse.json(entries)
  } catch (err) {
    console.error('GET /api/entries error:', err)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry = await request.json()
    if (!entry.name || !entry.email) {
      return NextResponse.json({ error: 'Missing required fields: name, email' }, { status: 400 })
    }

    const db = await getDb()
    let entries: any[]

    if ('getAllEntries' in db) {
      entries = await db.getAllEntries()
    } else {
      entries = await (db as any).getAllEntries()
    }

    const newEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...entry,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    entries.push(newEntry)

    if ('saveAllEntries' in db) {
      await (db as any).saveAllEntries(entries)
    } else {
      // KV path: use kv.set directly
      const { kv } = await import('@vercel/kv')
      await kv.set('entries', entries)
    }

    return NextResponse.json(newEntry, { status: 201 })
  } catch (err) {
    console.error('POST /api/entries error:', err)
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const entry = await request.json()
    if (!entry.id) {
      return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })
    }

    const db = await getDb()
    let entries: any[]

    if ('getAllEntries' in db) {
      entries = await db.getAllEntries()
    } else {
      entries = await (db as any).getAllEntries()
    }

    const index = entries.findIndex((e: any) => e.id === entry.id)
    if (index === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    entries[index] = { ...entries[index], ...entry, updatedAt: new Date().toISOString() }

    if ('saveAllEntries' in db) {
      await (db as any).saveAllEntries(entries)
    } else {
      const { kv } = await import('@vercel/kv')
      await kv.set('entries', entries)
    }

    return NextResponse.json(entries[index], { status: 200 })
  } catch (err) {
    console.error('PUT /api/entries error:', err)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}
