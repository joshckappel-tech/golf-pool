import { NextRequest, NextResponse } from 'next/server'

// Archive current entries and clear the active entries list
// POST /api/entries/archive  { tournamentKey: "valspar", tournamentName: "Valspar Championship" }
// GET  /api/entries/archive  → list all archived tournaments
// GET  /api/entries/archive?tournament=valspar  → get archived entries for a specific tournament

async function getKv() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
  })
}

async function getDb() {
  if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
    return await import('@/lib/db-kv')
  }
  return await import('@/lib/db')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tournamentKey = body.tournamentKey || 'unknown'
    const tournamentName = body.tournamentName || 'Unknown Tournament'
    const standings = body.standings || null // Pre-calculated final standings with earnings/payouts

    const db = await getDb()
    let entries: any[] = []

    if ('getAllEntries' in db) {
      entries = await db.getAllEntries()
    }

    if (entries.length === 0) {
      return NextResponse.json({
        message: 'No entries to archive.',
        archived: 0,
      })
    }

    // Build archive record
    const archiveRecord: any = {
      tournamentKey,
      tournamentName,
      archivedAt: new Date().toISOString(),
      entryCount: entries.length,
      entries,
    }

    // Include final standings if provided (entries with calculated earnings and payouts)
    if (standings && Array.isArray(standings) && standings.length > 0) {
      archiveRecord.standings = standings
    }

    // Save archive
    if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
      const kv = await getKv()

      // Store this tournament's archive
      await kv.set(`archive:${tournamentKey}`, archiveRecord)

      // Update archive index (list of archived tournaments)
      const indexRaw = await kv.get('archive:index')
      const index: any[] = Array.isArray(indexRaw) ? indexRaw : []
      // Remove any existing entry for this tournament key
      const filtered = index.filter((i: any) => i.tournamentKey !== tournamentKey)
      filtered.push({
        tournamentKey,
        tournamentName,
        archivedAt: archiveRecord.archivedAt,
        entryCount: entries.length,
      })
      await kv.set('archive:index', filtered)

      // Clear active entries
      await kv.set('entries', [])
    } else {
      // File-based fallback for local dev
      const { promises: fs } = await import('fs')
      const path = (await import('path')).default
      const IS_VERCEL = !!process.env.VERCEL
      const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : path.join(process.cwd(), 'data')
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(
        path.join(DATA_DIR, `archive-${tournamentKey}.json`),
        JSON.stringify(archiveRecord, null, 2),
        'utf-8'
      )
      // Clear active entries
      await fs.writeFile(path.join(DATA_DIR, 'entries.json'), '[]', 'utf-8')
    }

    return NextResponse.json({
      message: `Archived ${entries.length} entries for "${tournamentName}".`,
      archived: entries.length,
      tournamentKey,
    })
  } catch (err) {
    console.error('POST /api/entries/archive error:', err)
    return NextResponse.json({ error: 'Failed to archive entries' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const tournament = request.nextUrl.searchParams.get('tournament')

    if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
      const kv = await getKv()

      if (tournament) {
        // Get specific tournament archive
        const archive = await kv.get(`archive:${tournament}`)
        if (!archive) {
          return NextResponse.json({ error: 'No archive found for ' + tournament }, { status: 404 })
        }
        return NextResponse.json(archive)
      }

      // Return archive index
      const indexRaw = await kv.get('archive:index')
      const index = Array.isArray(indexRaw) ? indexRaw : []
      return NextResponse.json({ archives: index })
    } else {
      // File-based fallback
      const { promises: fs } = await import('fs')
      const path = (await import('path')).default
      const DATA_DIR = path.join(process.cwd(), 'data')

      if (tournament) {
        try {
          const data = await fs.readFile(path.join(DATA_DIR, `archive-${tournament}.json`), 'utf-8')
          return NextResponse.json(JSON.parse(data))
        } catch {
          return NextResponse.json({ error: 'No archive found' }, { status: 404 })
        }
      }

      // List archive files
      try {
        const files = await fs.readdir(DATA_DIR)
        const archives = files
          .filter(f => f.startsWith('archive-') && f.endsWith('.json'))
          .map(f => ({ tournamentKey: f.replace('archive-', '').replace('.json', '') }))
        return NextResponse.json({ archives })
      } catch {
        return NextResponse.json({ archives: [] })
      }
    }
  } catch (err) {
    console.error('GET /api/entries/archive error:', err)
    return NextResponse.json({ archives: [] }, { status: 500 })
  }
}
