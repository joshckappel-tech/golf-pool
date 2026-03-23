import { Redis } from '@upstash/redis'
import type { PoolSettings } from './db'

// Re-export types
export type { PoolSettings }
export type { User, Session } from './db'

import type { User, Session } from './db'
import type {
  Tournament,
  Golfer,
  TournamentGolfer,
  Entry,
} from '@/types'

// Create Redis client using Upstash env vars (with fallback to KV_ names)
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
})

// ============================================
// DEFAULT DATA (for seeding)
// ============================================
const DEFAULT_SETTINGS: PoolSettings = {
  submissionDeadline: '2026-03-19T07:00:00Z',
  entryFee: 30,
  tournamentName: '2026 Valspar Championship',
  cheddarUpUrl: 'https://golf-pool-test.cheddarup.com',
  poolPassword: 'golf2026',
  adminUsername: 'admin',
  adminPassword: 'golfpool2026',
  payoutPcts: [30, 15, 10, 8, 7, 6, 5, 4, 3, 0],
  projectedPayouts: undefined,
}

// ============================================
// HELPER: read/write with fallback
// ============================================
async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const data = await kv.get<T>(key)
    return data ?? fallback
  } catch (e) {
    console.error(`KV get error for ${key}:`, e)
    return fallback
  }
}

async function kvSet<T>(key: string, data: T): Promise<void> {
  try {
    await kv.set(key, data)
  } catch (e) {
    console.error(`KV set error for ${key}:`, e)
    throw e
  }
}

// ============================================
// INIT — seed defaults if keys don't exist
// ============================================
export async function initDB(): Promise<void> {
  const settings = await kv.get('settings')
  if (!settings) {
    await kv.set('settings', DEFAULT_SETTINGS)
  }
  // Ensure arrays exist
  for (const key of ['users', 'sessions', 'entries', 'tournaments', 'golfers', 'tournament-golfers']) {
    const val = await kv.get(key)
    if (val === null || val === undefined) {
      await kv.set(key, [])
    }
  }
}

// ============================================
// USER OPERATIONS
// ============================================
export async function getUsers(): Promise<User[]> {
  return kvGet<User[]>('users', [])
}

export async function getUser(id: string): Promise<User | null> {
  const users = await getUsers()
  return users.find((u) => u.id === id) || null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers()
  return users.find((u) => u.email === email) || null
}

export async function saveUser(user: User): Promise<void> {
  const users = await getUsers()
  const index = users.findIndex((u) => u.id === user.id)
  if (index >= 0) {
    users[index] = user
  } else {
    users.push(user)
  }
  await kvSet('users', users)
}

// ============================================
// SESSION OPERATIONS
// ============================================
export async function getSessions(): Promise<Session[]> {
  return kvGet<Session[]>('sessions', [])
}

export async function getSession(token: string): Promise<Session | null> {
  const sessions = await getSessions()
  return sessions.find((s) => s.token === token) || null
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions()
  const index = sessions.findIndex((s) => s.token === session.token)
  if (index >= 0) {
    sessions[index] = session
  } else {
    sessions.push(session)
  }
  await kvSet('sessions', sessions)
}

export async function deleteSession(token: string): Promise<void> {
  const sessions = await getSessions()
  const filtered = sessions.filter((s) => s.token !== token)
  await kvSet('sessions', filtered)
}

// ============================================
// SETTINGS OPERATIONS
// ============================================
export async function getSettings(): Promise<PoolSettings> {
  return kvGet<PoolSettings>('settings', DEFAULT_SETTINGS)
}

export async function saveSettings(settings: PoolSettings): Promise<void> {
  await kvSet('settings', settings)
}

// ============================================
// ENTRY OPERATIONS
// ============================================
export async function getAllEntries(): Promise<Entry[]> {
  return kvGet<Entry[]>('entries', [])
}

export async function getEntries(tournamentId: string): Promise<Entry[]> {
  const all = await getAllEntries()
  return all.filter((e) => e.tournamentId === tournamentId)
}

export async function getEntry(id: string): Promise<Entry | null> {
  const all = await getAllEntries()
  return all.find((e) => e.id === id) || null
}

export async function saveEntry(entry: Entry): Promise<void> {
  const all = await getAllEntries()
  const index = all.findIndex((e) => e.id === entry.id)
  if (index >= 0) {
    all[index] = entry
  } else {
    all.push(entry)
  }
  await kvSet('entries', all)
}

// ============================================
// TOURNAMENT OPERATIONS
// ============================================
export async function getTournaments(): Promise<Tournament[]> {
  return kvGet<Tournament[]>('tournaments', [])
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const all = await getTournaments()
  return all.find((t) => t.id === id) || null
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  const all = await getTournaments()
  const index = all.findIndex((t) => t.id === tournament.id)
  if (index >= 0) {
    all[index] = tournament
  } else {
    all.push(tournament)
  }
  await kvSet('tournaments', all)
}

// ============================================
// GOLFER OPERATIONS
// ============================================
export async function getGolfers(): Promise<Golfer[]> {
  return kvGet<Golfer[]>('golfers', [])
}

export async function getGolfer(id: string): Promise<Golfer | null> {
  const all = await getGolfers()
  return all.find((g) => g.id === id) || null
}

export async function saveGolfer(golfer: Golfer): Promise<void> {
  const all = await getGolfers()
  const index = all.findIndex((g) => g.id === golfer.id)
  if (index >= 0) {
    all[index] = golfer
  } else {
    all.push(golfer)
  }
  await kvSet('golfers', all)
}

export async function saveGolfers(golfers: Golfer[]): Promise<void> {
  const existing = await getGolfers()
  for (const golfer of golfers) {
    const index = existing.findIndex((g) => g.id === golfer.id)
    if (index >= 0) {
      existing[index] = golfer
    } else {
      existing.push(golfer)
    }
  }
  await kvSet('golfers', existing)
}

// ============================================
// TOURNAMENT GOLFER OPERATIONS
// ============================================
export async function getTournamentGolfers(tournamentId: string): Promise<TournamentGolfer[]> {
  const all = await kvGet<TournamentGolfer[]>('tournament-golfers', [])
  return all.filter((tg) => tg.tournamentId === tournamentId)
}

export async function getTournamentGolfer(id: string): Promise<TournamentGolfer | null> {
  const all = await kvGet<TournamentGolfer[]>('tournament-golfers', [])
  return all.find((tg) => tg.id === id) || null
}

export async function saveTournamentGolfer(tg: TournamentGolfer): Promise<void> {
  const all = await kvGet<TournamentGolfer[]>('tournament-golfers', [])
  const index = all.findIndex((t) => t.id === tg.id)
  if (index >= 0) {
    all[index] = tg
  } else {
    all.push(tg)
  }
  await kvSet('tournament-golfers', all)
}

export async function saveTournamentGolfers(tgs: TournamentGolfer[]): Promise<void> {
  const all = await kvGet<TournamentGolfer[]>('tournament-golfers', [])
  for (const tg of tgs) {
    const index = all.findIndex((t) => t.id === tg.id)
    if (index >= 0) {
      all[index] = tg
    } else {
      all.push(tg)
    }
  }
  await kvSet('tournament-golfers', all)
}
