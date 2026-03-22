import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch (err) {
    // Directory already exists
  }
}

// Get path to entries JSON file
function getEntriesPath(): string {
  return path.join(process.cwd(), 'data', 'entries.json')
}

// Read entries from JSON file
async function readEntries(): Promise<any[]> {
  try {
    await ensureDataDir()
    const filePath = getEntriesPath()
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (err: any) {
    // File doesn't exist or is invalid JSON, return empty array
    if (err.code === 'ENOENT') {
      return []
    }
    console.error('Error reading entries:', err)
    return []
  }
}

// Write entries to JSON file
async function writeEntries(entries: any[]): Promise<void> {
  try {
    await ensureDataDir()
    const filePath = getEntriesPath()
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error writing entries:', err)
    throw err
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    const entries = await readEntries()

    // Filter by userId if provided
    if (userId) {
      const filtered = entries.filter((e) => e.userId === userId)
      return NextResponse.json(filtered)
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

    // Validate entry data
    if (!entry.name || !entry.email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email' },
        { status: 400 }
      )
    }

    const entries = await readEntries()

    // Add entry with unique ID
    const newEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...entry,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    entries.push(newEntry)
    await writeEntries(entries)

    return NextResponse.json(newEntry, { status: 201 })
  } catch (err) {
    console.error('POST /api/entries error:', err)
    return NextResponse.json(
      { error: 'Failed to save entry' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const entry = await request.json()

    // Validate entry data
    if (!entry.id) {
      return NextResponse.json(
        { error: 'Missing entry id' },
        { status: 400 }
      )
    }

    const entries = await readEntries()
    const index = entries.findIndex((e) => e.id === entry.id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    // Update entry, preserving submittedAt but updating updatedAt
    const updatedEntry = {
      ...entries[index],
      ...entry,
      updatedAt: new Date().toISOString(),
    }

    entries[index] = updatedEntry
    await writeEntries(entries)

    return NextResponse.json(updatedEntry, { status: 200 })
  } catch (err) {
    console.error('PUT /api/entries error:', err)
    return NextResponse.json(
      { error: 'Failed to update entry' },
      { status: 500 }
    )
  }
}
