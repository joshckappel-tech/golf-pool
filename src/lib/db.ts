import fs from 'fs'
import path from 'path'
import {
  Tournament,
  Golfer,
  TournamentGolfer,
  Entry,
} from '@/types'

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  salt: string
  createdAt: string
}

export interface Session {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface PoolSettings {
  submissionDeadline: string
  entryFee: number
  tournamentName: string
  teamStakeUrl: string
  adminPassword: string
}

const DATA_DIR = path.join(process.cwd(), 'data')

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

// Initialize database with empty JSON files if they don't exist
export function initDB() {
  ensureDataDir()

  const files: { [key: string]: any } = {
    'tournaments.json': [] as Tournament[],
    'golfers.json': [] as Golfer[],
    'tournament-golfers.json': [] as TournamentGolfer[],
    'entries.json': [] as Entry[],
    'users.json': [] as User[],
    'sessions.json': [] as Session[],
    'settings.json': {
      submissionDeadline: '2026-03-19T07:00:00Z',
      entryFee: 30,
      tournamentName: '2026 Valspar Championship',
      teamStakeUrl: '',
      adminPassword: 'golfpool2026',
    } as PoolSettings,
  }

  for (const [filename, defaultData] of Object.entries(files)) {
    const filepath = path.join(DATA_DIR, filename)
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2))
    }
  }
}

// Helper to read JSON file with locking pattern
function readJSONFile<T>(filename: string): T {
  ensureDataDir()
  const filepath = path.join(DATA_DIR, filename)

  try {
    if (!fs.existsSync(filepath)) {
      return [] as any
    }
    const data = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(data) as T
  } catch (error) {
    console.error(`Error reading ${filename}:`, error)
    return [] as any
  }
}

// Helper to write JSON file with locking pattern
function writeJSONFile<T>(filename: string, data: T) {
  ensureDataDir()
  const filepath = path.join(DATA_DIR, filename)

  try {
    // Simple file locking: write to temp file, then rename
    const tempPath = `${filepath}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
    fs.renameSync(tempPath, filepath)
  } catch (error) {
    console.error(`Error writing ${filename}:`, error)
    throw error
  }
}

// ============================================
// TOURNAMENT OPERATIONS
// ============================================

export function getTournaments(): Tournament[] {
  return readJSONFile<Tournament[]>('tournaments.json')
}

export function getTournament(id: string): Tournament | null {
  const tournaments = getTournaments()
  return tournaments.find((t) => t.id === id) || null
}

export function saveTournament(tournament: Tournament): void {
  const tournaments = getTournaments()
  const index = tournaments.findIndex((t) => t.id === tournament.id)

  if (index >= 0) {
    tournaments[index] = tournament
  } else {
    tournaments.push(tournament)
  }

  writeJSONFile('tournaments.json', tournaments)
}

// ============================================
// GOLFER OPERATIONS
// ============================================

export function getGolfers(): Golfer[] {
  return readJSONFile<Golfer[]>('golfers.json')
}

export function getGolfer(id: string): Golfer | null {
  const golfers = getGolfers()
  return golfers.find((g) => g.id === id) || null
}

export function saveGolfer(golfer: Golfer): void {
  const golfers = getGolfers()
  const index = golfers.findIndex((g) => g.id === golfer.id)

  if (index >= 0) {
    golfers[index] = golfer
  } else {
    golfers.push(golfer)
  }

  writeJSONFile('golfers.json', golfers)
}

export function saveGolfers(golfers: Golfer[]): void {
  const existing = getGolfers()

  for (const golfer of golfers) {
    const index = existing.findIndex((g) => g.id === golfer.id)
    if (index >= 0) {
      existing[index] = golfer
    } else {
      existing.push(golfer)
    }
  }

  writeJSONFile('golfers.json', existing)
}

// ============================================
// TOURNAMENT GOLFER OPERATIONS
// ============================================

export function getTournamentGolfers(tournamentId: string): TournamentGolfer[] {
  const allTournamentGolfers = readJSONFile<TournamentGolfer[]>(
    'tournament-golfers.json'
  )
  return allTournamentGolfers.filter((tg) => tg.tournamentId === tournamentId)
}

export function getTournamentGolfer(id: string): TournamentGolfer | null {
  const allTournamentGolfers = readJSONFile<TournamentGolfer[]>(
    'tournament-golfers.json'
  )
  return allTournamentGolfers.find((tg) => tg.id === id) || null
}

export function saveTournamentGolfer(tournamentGolfer: TournamentGolfer): void {
  const allTournamentGolfers = readJSONFile<TournamentGolfer[]>(
    'tournament-golfers.json'
  )
  const index = allTournamentGolfers.findIndex((tg) => tg.id === tournamentGolfer.id)

  if (index >= 0) {
    allTournamentGolfers[index] = tournamentGolfer
  } else {
    allTournamentGolfers.push(tournamentGolfer)
  }

  writeJSONFile('tournament-golfers.json', allTournamentGolfers)
}

export function saveTournamentGolfers(tournamentGolfers: TournamentGolfer[]): void {
  const allTournamentGolfers = readJSONFile<TournamentGolfer[]>(
    'tournament-golfers.json'
  )

  for (const tg of tournamentGolfers) {
    const index = allTournamentGolfers.findIndex((atg) => atg.id === tg.id)
    if (index >= 0) {
      allTournamentGolfers[index] = tg
    } else {
      allTournamentGolfers.push(tg)
    }
  }

  writeJSONFile('tournament-golfers.json', allTournamentGolfers)
}

// ============================================
// ENTRY OPERATIONS
// ============================================

export function getEntries(tournamentId: string): Entry[] {
  const allEntries = readJSONFile<Entry[]>('entries.json')
  return allEntries.filter((e) => e.tournamentId === tournamentId)
}

export function getEntry(id: string): Entry | null {
  const allEntries = readJSONFile<Entry[]>('entries.json')
  return allEntries.find((e) => e.id === id) || null
}

export function saveEntry(entry: Entry): void {
  const allEntries = readJSONFile<Entry[]>('entries.json')
  const index = allEntries.findIndex((e) => e.id === entry.id)

  if (index >= 0) {
    allEntries[index] = entry
  } else {
    allEntries.push(entry)
  }

  writeJSONFile('entries.json', allEntries)
}

export function getAllEntries(): Entry[] {
  return readJSONFile<Entry[]>('entries.json')
}

// ============================================
// USER OPERATIONS
// ============================================

export function getUsers(): User[] {
  return readJSONFile<User[]>('users.json')
}

export function getUser(id: string): User | null {
  const users = getUsers()
  return users.find((u) => u.id === id) || null
}

export function getUserByEmail(email: string): User | null {
  const users = getUsers()
  return users.find((u) => u.email === email) || null
}

export function saveUser(user: User): void {
  const users = getUsers()
  const index = users.findIndex((u) => u.id === user.id)

  if (index >= 0) {
    users[index] = user
  } else {
    users.push(user)
  }

  writeJSONFile('users.json', users)
}

// ============================================
// SESSION OPERATIONS
// ============================================

export function getSessions(): Session[] {
  return readJSONFile<Session[]>('sessions.json')
}

export function getSession(token: string): Session | null {
  const sessions = getSessions()
  return sessions.find((s) => s.token === token) || null
}

export function saveSession(session: Session): void {
  const sessions = getSessions()
  const index = sessions.findIndex((s) => s.token === session.token)

  if (index >= 0) {
    sessions[index] = session
  } else {
    sessions.push(session)
  }

  writeJSONFile('sessions.json', sessions)
}

export function deleteSession(token: string): void {
  const sessions = getSessions()
  const filtered = sessions.filter((s) => s.token !== token)
  writeJSONFile('sessions.json', filtered)
}

// ============================================
// SETTINGS OPERATIONS
// ============================================

export function getSettings(): PoolSettings {
  const settings = readJSONFile<PoolSettings>('settings.json')
  return settings
}

export function saveSettings(settings: PoolSettings): void {
  writeJSONFile('settings.json', settings)
}
