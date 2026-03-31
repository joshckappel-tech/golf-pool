import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

const IS_VERCEL = !!process.env.VERCEL;
const SOURCE_DATA_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : SOURCE_DATA_DIR;
const ESPN_API_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const CORE_API_BASE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

function getScoresPath(): string { return path.join(DATA_DIR, 'scores.json'); }

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch (e) {}
  if (IS_VERCEL) {
    const tmpPath = path.join(DATA_DIR, 'scores.json');
    if (!fsSync.existsSync(tmpPath)) {
      const src = path.join(SOURCE_DATA_DIR, 'scores.json');
      if (fsSync.existsSync(src)) await fs.copyFile(src, tmpPath);
      else await fs.writeFile(tmpPath, '[]', 'utf-8');
    }
  }
}

async function readCachedScores(): Promise<any> {
  try {
    await ensureDataDir();
    return JSON.parse(await fs.readFile(getScoresPath(), 'utf-8'));
  } catch { return { players: [], tournament: null, lastUpdated: null }; }
}

async function writeScores(scores: any): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(getScoresPath(), JSON.stringify(scores, null, 2), 'utf-8');
}

function parseScoreToPar(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (str === 'E' || str === 'Even' || str === 'even') return 0;
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

// Helper to follow a $ref if the object is just a reference
async function resolveRef(obj: any): Promise<any> {
  if (obj && obj.$ref && Object.keys(obj).filter(k => k !== '$ref').length <= 2) {
    try {
      const r = await fetch(obj.$ref, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch {}
  }
  return obj;
}

// Batch-resolve an array of potentially-ref objects in parallel batches
async function batchResolve(items: any[], batchSize = 25): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const resolved = await Promise.all(batch.map(item => resolveRef(item)));
    results.push(...resolved);
  }
  return results;
}

// Helper: fetch a URL and return JSON, or null on failure
async function fetchJson(url: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

/**
 * Fetch tournament data from ESPN Core API — works for specific completed tournaments.
 * The scoreboard endpoint ignores event IDs for golf, so this is the only way
 * to fetch data for a specific past tournament.
 *
 * Core API returns $ref links for most sub-resources (score, athlete, status,
 * linescores, statistics). We batch-resolve these in parallel.
 */
async function fetchFromCoreApi(eventId: string): Promise<any> {
  const result: any = { players: [], tournament: null, lastUpdated: new Date().toISOString() };
  const COMP_BASE = `${CORE_API_BASE}/events/${eventId}/competitions/${eventId}`;

  // 1. Fetch event metadata + competition status in parallel
  console.log(`[ESPN Core] Fetching event ${eventId}...`);
  const [eventData, compStatusData] = await Promise.all([
    fetchJson(`${CORE_API_BASE}/events/${eventId}`),
    fetchJson(`${COMP_BASE}/status`),
  ]);
  if (!eventData) {
    console.log(`[ESPN Core] Event fetch failed`);
    return null;
  }
  console.log(`[ESPN Core] Event: ${eventData.name}`);

  // 2. Fetch ALL competitor items (paginated list — items have IDs + $ref links)
  const allItems: any[] = [];
  let page = 1;
  const PAGE_SIZE = 50;
  while (true) {
    const data = await fetchJson(`${COMP_BASE}/competitors?limit=${PAGE_SIZE}&page=${page}`);
    if (!data) break;
    const items = data.items || [];
    console.log(`[ESPN Core] Competitors page ${page}: ${items.length} items (total: ${data.count || '?'})`);
    if (items.length === 0) break;
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    page++;
    if (page > 10) break;
  }
  console.log(`[ESPN Core] Total competitor items: ${allItems.length}`);
  if (allItems.length === 0) return null;

  // 3. For each competitor, batch-resolve score, athlete, status, and linescores in parallel
  //    Each competitor item has: id, order, movement, amateur, and $ref links for:
  //    score, athlete, status, linescores, statistics
  console.log(`[ESPN Core] Resolving sub-resources for ${allItems.length} competitors...`);
  const allCompetitors: any[] = [];
  const BATCH = 15; // 15 competitors × 4 fetches = 60 parallel requests per batch

  for (let i = 0; i < allItems.length; i += BATCH) {
    const batch = allItems.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(async (item) => {
      const cid = item.id;
      const compUrl = `${COMP_BASE}/competitors/${cid}`;

      // Resolve score, athlete, status, and linescores list in parallel
      const [scoreData, athleteData, statusData, linescoresListData] = await Promise.all([
        item.score?.$ref ? fetchJson(item.score.$ref) : (typeof item.score === 'object' && item.score?.value !== undefined ? item.score : fetchJson(`${compUrl}/score`)),
        item.athlete?.$ref ? fetchJson(item.athlete.$ref) : item.athlete,
        item.status?.$ref ? fetchJson(item.status.$ref) : item.status,
        fetchJson(`${compUrl}/linescores?limit=10`),
      ]);

      // Linescores list returns {items: [{$ref}, ...]} — resolve each round
      let linescores: any[] = [];
      if (linescoresListData?.items && linescoresListData.items.length > 0) {
        // Check if items have inline data or are refs
        const firstLs = linescoresListData.items[0];
        if (firstLs.value !== undefined) {
          // Inline data
          linescores = linescoresListData.items;
        } else if (firstLs.$ref) {
          // Need to resolve each round
          linescores = await Promise.all(
            linescoresListData.items.map((ls: any) => ls.$ref ? fetchJson(ls.$ref) : ls)
          );
        }
      }

      return {
        id: cid,
        order: item.order,
        movement: item.movement,
        amateur: item.amateur,
        score: scoreData,
        athlete: athleteData,
        status: statusData,
        linescores: linescores.filter(Boolean),
        earnings: item.earnings, // might exist on some endpoints
      };
    }));
    allCompetitors.push(...batchResults);
    console.log(`[ESPN Core] Resolved batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(allItems.length / BATCH)}`);
  }

  // Log sample resolved data
  const s = allCompetitors[0];
  console.log(`[ESPN Core] Sample resolved — name: ${s.athlete?.displayName}, score: ${JSON.stringify(s.score)?.substring(0, 80)}, linescores: ${s.linescores?.length}, status: ${JSON.stringify(s.status)?.substring(0, 80)}`);

  // 4. Parse tournament status
  const statusType = compStatusData?.type || {};
  const tournamentState = (statusType.state || '').toLowerCase();
  const roundNumber = compStatusData?.period || 4;
  const tournamentComplete = tournamentState === 'post' || statusType.completed === true;

  let roundDisplay = statusType.description || statusType.detail || 'Final';
  let roundState = 'unknown';
  if (tournamentComplete) {
    roundState = 'complete';
    roundDisplay = 'Final';
  } else if (tournamentState === 'in') {
    roundState = 'in_progress';
    roundDisplay = `Round ${roundNumber} - In Progress`;
  } else if (tournamentState === 'pre') {
    roundState = 'not_started';
    roundDisplay = 'Not Started';
  }

  // 5. Parse tournament metadata (courses, venues — may be refs)
  let courseName: string | null = null;
  let yardage: number | null = null;
  let par: number | null = null;

  const rawCourses = eventData.courses || [];
  if (rawCourses.length > 0) {
    const courseData = await resolveRef(rawCourses[0]);
    courseName = courseData.name || courseData.shortName || null;
    yardage = courseData.yardage || courseData.yards || null;
    par = courseData.par || null;
  }

  const rawVenues = eventData.venues || [];
  if (rawVenues.length > 0) {
    const venueData = await resolveRef(rawVenues[0]);
    const city = venueData.address?.city;
    const state = venueData.address?.state;
    const loc = [city, state].filter(Boolean).join(', ');
    if (courseName && loc) {
      courseName = `${courseName} — ${loc}`;
    } else if (!courseName) {
      const vName = venueData.fullName || venueData.shortName;
      courseName = vName ? (loc ? `${vName} — ${loc}` : vName) : null;
    }
  }

  // Dates
  let dates: string | null = null;
  const startDate = eventData.date || eventData.startDate;
  const endDate = eventData.endDate;
  if (startDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    dates = end
      ? `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', yearOpts)}`
      : start.toLocaleDateString('en-US', yearOpts);
  }

  // Broadcasts — may be refs
  let network: string | null = null;
  const rawBroadcasts = eventData.broadcasts || [];
  if (rawBroadcasts.length > 0) {
    const broadcastNames: string[] = [];
    for (const b of rawBroadcasts.slice(0, 3)) {
      const bd = await resolveRef(b);
      const names = bd.names || (bd.media?.shortName ? [bd.media.shortName] : []);
      broadcastNames.push(...names);
    }
    if (broadcastNames.length > 0) network = broadcastNames.join(', ');
  }

  // Defending champion
  let defendingChampion: string | null = null;
  if (eventData.defendingChampion) {
    const dc = await resolveRef(eventData.defendingChampion);
    if (dc.athlete) {
      const ath = await resolveRef(dc.athlete);
      defendingChampion = ath.displayName || ath.fullName || null;
    } else {
      defendingChampion = dc.displayName || dc.name || null;
    }
  }

  const purse = eventData.purse || eventData.displayPurse || null;

  result.tournament = {
    name: eventData.name || eventData.shortName || 'Unknown',
    status: statusType.description || '',
    roundDisplay,
    roundNumber,
    roundState,
    purse,
    courseName,
    eventId,
    dates,
    yardage,
    par,
    network,
    defendingChampion,
  };

  // 6. Parse each competitor into our standard player format
  const parsed: any[] = [];
  for (const c of allCompetitors) {
    try {
      const athlete = c.athlete || {};
      const name = athlete.displayName || athlete.fullName || athlete.shortName || `Player ${c.id || '?'}`;

      // Score — resolved score object has {value (total strokes), displayValue (to par)}
      let scoreToPar: number | null = null;
      let scoreDisplay = 'E';
      let totalStrokesFromScore: number | null = null;
      if (c.score) {
        if (c.score.displayValue !== undefined) {
          scoreToPar = parseScoreToPar(c.score.displayValue);
          scoreDisplay = String(c.score.displayValue);
        } else if (c.score.value !== undefined) {
          scoreToPar = parseScoreToPar(c.score.value);
          scoreDisplay = String(c.score.value);
        }
        if (c.score.value !== undefined && typeof c.score.value === 'number') {
          totalStrokesFromScore = c.score.value; // e.g. 259
        }
      }

      // Player status from resolved status object
      let playerStatus = 'active';
      const statusTypeName = (c.status?.type?.name || c.status?.type?.description || '').toLowerCase();
      if (statusTypeName.includes('cut')) playerStatus = 'cut';
      else if (statusTypeName.includes('wd') || statusTypeName.includes('withdraw')) playerStatus = 'withdrawn';
      else if (statusTypeName.includes('dq') || statusTypeName.includes('disqualif')) playerStatus = 'disqualified';

      // Also check displayValue for CUT/WD/DQ
      const scoreStr = String(scoreDisplay).toLowerCase();
      if (scoreStr === 'cut') playerStatus = 'cut';
      else if (scoreStr === 'wd') playerStatus = 'withdrawn';
      else if (scoreStr === 'dq') playerStatus = 'disqualified';

      // Cut detection: if tournament is complete and player has < 4 linescores
      if (playerStatus === 'active' && tournamentComplete && c.linescores.length > 0 && c.linescores.length < 4) {
        playerStatus = 'cut';
      }

      // Round scores from resolved linescores
      // Each linescore: {value: 65, displayValue: "-5", period: 1, ...}
      const ls = c.linescores || [];
      const r1 = ls[0]?.value !== undefined ? Number(ls[0].value) : null;
      const r2 = ls[1]?.value !== undefined ? Number(ls[1].value) : null;
      const r3 = ls[2]?.value !== undefined ? Number(ls[2].value) : null;
      const r4 = ls[3]?.value !== undefined ? Number(ls[3].value) : null;

      // Total strokes — from linescores sum or from score.value
      const completedRounds = [r1, r2, r3, r4].filter(r => r !== null) as number[];
      const totalStrokes = completedRounds.length > 0
        ? completedRounds.reduce((a, b) => a + b, 0)
        : totalStrokesFromScore;

      // Thru
      let thru = '--';
      if (playerStatus !== 'active') {
        thru = '--';
      } else if (tournamentComplete) {
        thru = 'F';
      }

      // Today (last round score to par)
      let today: number | null = null;
      if (playerStatus === 'active' && ls.length > 0) {
        const lastRound = ls[ls.length - 1];
        today = parseScoreToPar(lastRound?.displayValue);
      }

      // Earnings — check competitor directly, then check score object
      let earnings: number | null = null;
      if (c.earnings !== undefined && c.earnings !== null) {
        earnings = typeof c.earnings === 'number' ? c.earnings : parseFloat(String(c.earnings).replace(/[$,]/g, ''));
        if (isNaN(earnings as number)) earnings = null;
      }

      parsed.push({
        name,
        score: scoreToPar,
        scoreDisplay,
        today,
        thru,
        r1, r2, r3, r4,
        totalStrokes,
        status: playerStatus,
        country: athlete.flag?.alt || null,
        earnings,
        _sortScore: scoreToPar !== null ? scoreToPar : 999,
      });
    } catch (err) {
      console.error('[ESPN Core] Error parsing competitor:', err);
    }
  }

  // Sort by score ascending (best first)
  parsed.sort((a, b) => {
    if (a._sortScore !== b._sortScore) return a._sortScore - b._sortScore;
    return (a.totalStrokes || 999) - (b.totalStrokes || 999);
  });

  // Assign positions with tie handling
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (p.status !== 'active') {
      p.pos = p.status === 'cut' ? 'CUT' : p.status === 'withdrawn' ? 'WD' : 'DQ';
      continue;
    }
    if (i > 0 && parsed[i - 1].status === 'active' && parsed[i - 1].score === p.score) {
      p.pos = parsed[i - 1].pos;
    } else {
      let activeCount = 0;
      for (let j = 0; j < i; j++) {
        if (parsed[j].status === 'active') activeCount++;
      }
      const posNum = activeCount + 1;
      let isTied = false;
      for (let j = i + 1; j < parsed.length; j++) {
        if (parsed[j].status === 'active' && parsed[j].score === p.score) {
          isTied = true;
          break;
        }
      }
      p.pos = isTied ? `T${posNum}` : `${posNum}`;
    }
  }

  result.players = parsed.map(({ _sortScore, ...rest }) => rest);

  const withEarnings = result.players.filter((p: any) => p.earnings > 0).length;
  const withRounds = result.players.filter((p: any) => p.r1 !== null).length;
  console.log(`[ESPN Core] Parsed ${result.players.length} players. ${withRounds} with round scores, ${withEarnings} with earnings.`);
  console.log(`[ESPN Core] Top: ${result.players[0]?.name} pos=${result.players[0]?.pos} score=${result.players[0]?.score} R1=${result.players[0]?.r1} R2=${result.players[0]?.r2} R3=${result.players[0]?.r3} R4=${result.players[0]?.r4} total=${result.players[0]?.totalStrokes}`);

  return result;
}

function parseEspnApiResponse(data: any): any {
  const result: any = { players: [], tournament: null, lastUpdated: new Date().toISOString() };

  try {
    const events = data?.events || [];
    if (events.length === 0) return result;

    const event = events[0];
    const competition = event.competitions?.[0];
    if (!competition) return result;

    // ---- Tournament status ----
    const cs = competition.status || {};
    const ct = cs.type || {};
    const roundNumber: number = cs.period || 0;
    const tournamentState = (ct.state || '').toLowerCase(); // "pre", "in", "post"
    const tournamentComplete = tournamentState === 'post';

    let roundDisplay = ct.description || 'Unknown';
    let roundState = 'unknown';
    if (tournamentState === 'in') {
      roundState = 'in_progress';
      roundDisplay = `Round ${roundNumber} - In Progress`;
    } else if (tournamentState === 'post') {
      roundState = 'complete';
      roundDisplay = roundNumber >= 4 ? 'Final' : `Round ${roundNumber} - Complete`;
    } else if (tournamentState === 'pre') {
      roundState = 'not_started';
      roundDisplay = 'Not Started';
    }

    // ---- Venue / course info ----
    let courseName: string | null = null;
    // ESPN structures venue data differently across endpoints:
    // competition.venue, event.venue, competition.courses[], event.courses[]
    const venue = competition.venue || event.venue;
    if (venue) {
      const course = venue.course?.name || venue.courses?.[0]?.name || venue.fullName || venue.shortName || null;
      const city = venue.address?.city || null;
      const state = venue.address?.state || null;
      const location = [city, state].filter(Boolean).join(', ');
      courseName = course ? (location ? `${course} — ${location}` : course) : null;
    }
    // Fallback: check top-level courses array
    if (!courseName) {
      const courses = competition.courses || event.courses;
      if (courses && courses.length > 0) {
        const c = courses[0];
        const cName = c.name || c.courseName || null;
        const city = c.address?.city || venue?.address?.city || null;
        const state = c.address?.state || venue?.address?.state || null;
        const location = [city, state].filter(Boolean).join(', ');
        courseName = cName ? (location ? `${cName} — ${location}` : cName) : null;
      }
    }
    // Final fallback: try event.shortName which sometimes includes venue
    if (!courseName && event.shortName && event.shortName !== event.name) {
      courseName = event.shortName;
    }

    // Debug logging for venue resolution
    console.log('[ESPN] Venue debug:', JSON.stringify({
      competitionVenue: competition.venue ? Object.keys(competition.venue) : null,
      eventVenue: event.venue ? Object.keys(event.venue) : null,
      competitionCourses: competition.courses?.length || 0,
      eventCourses: event.courses?.length || 0,
      resolvedCourseName: courseName,
    }));

    result.tournament = {
      name: event.name || event.shortName || 'Unknown',
      status: ct.description || '',
      roundDisplay,
      roundNumber,
      roundState,
      purse: competition.purse || null,
      courseName,
    };

    // ---- Parse each competitor ----
    const competitors = competition.competitors || [];

    const parsed: any[] = [];

    for (const c of competitors) {
      try {
        const athlete = c.athlete || {};
        const name = athlete.displayName || athlete.shortName || 'Unknown';
        const linescores = c.linescores || []; // Array of round objects

        // === SCORE (overall to par) ===
        // c.score is a string like "-11", "+2", "E"
        const scoreToPar = parseScoreToPar(c.score);
        const scoreDisplay = c.score !== undefined && c.score !== null ? String(c.score) : 'E';

        // === PLAYER STATUS ===
        // Detect cut/wd/dq from the score display or lack of later rounds
        let playerStatus = 'active';
        const scoreStr = String(c.score || '').toLowerCase();
        if (scoreStr === 'cut' || scoreStr.includes('cut')) playerStatus = 'cut';
        else if (scoreStr === 'wd' || scoreStr.includes('wd')) playerStatus = 'withdrawn';
        else if (scoreStr === 'dq' || scoreStr.includes('dq')) playerStatus = 'disqualified';

        // Also check if player has fewer rounds than expected (cut after R2)
        if (playerStatus === 'active' && roundNumber >= 3 && linescores.length === 2) {
          playerStatus = 'cut';
        }

        // === ROUND SCORES (R1-R4) ===
        // Each linescore: { value: 68, displayValue: "-3", period: 1, linescores: [...holes...] }
        const r1 = linescores[0]?.value !== undefined ? Number(linescores[0].value) : null;
        const r2 = linescores[1]?.value !== undefined ? Number(linescores[1].value) : null;
        const r3 = linescores[2]?.value !== undefined ? Number(linescores[2].value) : null;
        const r4Raw = linescores[3]?.value !== undefined ? Number(linescores[3].value) : null;

        // === THRU (holes completed in current round) ===
        let thru = '--';
        let playerFinishedCurrentRound = false;

        if (playerStatus !== 'active') {
          thru = '--';
        } else if (tournamentComplete) {
          // Tournament is final — all active players finished
          thru = 'F';
          playerFinishedCurrentRound = true;
        } else if (tournamentState === 'in') {
          // Round in progress — check how many holes the player has completed
          const currentRoundIdx = roundNumber - 1;
          if (currentRoundIdx >= 0 && currentRoundIdx < linescores.length) {
            const currentRoundLS = linescores[currentRoundIdx];
            const holeScores = currentRoundLS?.linescores || [];
            const holesPlayed = holeScores.length;
            if (holesPlayed >= 18) {
              thru = 'F';
              playerFinishedCurrentRound = true;
            } else if (holesPlayed > 0) {
              thru = holesPlayed.toString();
            } else {
              thru = '--'; // hasn't started the round
            }
          } else {
            thru = '--'; // no data for current round
          }
        }

        // === R4 display: only show final score, not partial ===
        let r4: number | null = null;
        if (tournamentComplete || playerFinishedCurrentRound || roundNumber < 4) {
          r4 = r4Raw; // Show R4 since it's complete
        } else if (roundNumber === 4 && !playerFinishedCurrentRound) {
          r4 = null; // Mid-round, don't show partial strokes
        }

        // Similarly for other rounds if somehow mid-round
        // (In practice, only the current round can be in progress)
        let r3Final = r3;
        if (roundNumber === 3 && !playerFinishedCurrentRound && playerStatus === 'active') {
          r3Final = null;
        } else {
          r3Final = r3;
        }

        // === TOTAL STROKES ===
        // Sum only completed round scores
        const completedRounds = [r1, r2, r3Final, r4].filter(r => r !== null) as number[];
        const totalStrokes = completedRounds.length > 0 ? completedRounds.reduce((a, b) => a + b, 0) : null;

        // === TODAY (current round score to par) ===
        let today: number | null = null;
        if (playerStatus === 'active' && roundNumber > 0) {
          const currentRoundIdx = roundNumber - 1;
          if (currentRoundIdx < linescores.length) {
            // displayValue is the round's score to par (e.g., "-3", "+1", "E")
            today = parseScoreToPar(linescores[currentRoundIdx]?.displayValue);
          }
        }

        // === EARNINGS (available after tournament is complete) ===
        let earnings: number | null = null;

        // Method 1: direct c.earnings
        if (c.earnings !== undefined && c.earnings !== null) {
          earnings = typeof c.earnings === 'number' ? c.earnings : parseFloat(String(c.earnings).replace(/[$,]/g, ''));
          if (isNaN(earnings as number)) earnings = null;
        }

        // Method 2: c.prize or c.purse or c.money
        if (earnings === null) {
          const prizeVal = c.prize ?? c.purse ?? c.money ?? c.prizeMoney;
          if (prizeVal !== undefined && prizeVal !== null) {
            earnings = typeof prizeVal === 'number' ? prizeVal : parseFloat(String(prizeVal).replace(/[$,]/g, ''));
            if (isNaN(earnings as number)) earnings = null;
          }
        }

        // Method 3: statistics array
        if (earnings === null && Array.isArray(c.statistics)) {
          for (const stat of c.statistics) {
            if (stat.name === 'earnings' || stat.name === 'prize' || stat.name === 'money'
                || stat.abbreviation === 'EARN' || stat.abbreviation === 'MONEY') {
              earnings = parseFloat(String(stat.displayValue || stat.value || '0').replace(/[$,]/g, ''));
              if (isNaN(earnings as number)) earnings = null;
              break;
            }
          }
        }

        // Method 4: status.prize
        if (earnings === null && c.status?.prize) {
          earnings = typeof c.status.prize === 'number' ? c.status.prize : parseFloat(String(c.status.prize).replace(/[$,]/g, ''));
          if (isNaN(earnings as number)) earnings = null;
        }

        // Log first 3 competitors' earnings-related fields for debugging
        if (parsed.length < 3) {
          console.log('[ESPN] Competitor earnings debug:', name, JSON.stringify({
            earnings: c.earnings,
            prize: c.prize,
            purse: c.purse,
            money: c.money,
            prizeMoney: c.prizeMoney,
            statusPrize: c.status?.prize,
            statisticsCount: c.statistics?.length || 0,
            statisticsNames: (c.statistics || []).map((s: any) => s.name).join(','),
            resolvedEarnings: earnings,
            allTopKeys: Object.keys(c).filter((k: string) => !['athlete','linescores','statistics','uid','id','$ref','status','score'].includes(k)),
          }));
        }

        parsed.push({
          name,
          score: scoreToPar,
          scoreDisplay,
          today,
          thru,
          r1,
          r2,
          r3: roundNumber === 3 && !playerFinishedCurrentRound && playerStatus === 'active' ? null : r3,
          r4,
          totalStrokes,
          status: playerStatus,
          country: athlete.flag?.alt || null,
          earnings,
          _sortScore: scoreToPar !== null ? scoreToPar : 999, // for sorting
        });
      } catch (err) {
        console.error('Error parsing competitor:', err);
      }
    }

    // === DERIVE POSITIONS ===
    // Sort by score (ascending = best first), then by totalStrokes
    parsed.sort((a, b) => {
      if (a._sortScore !== b._sortScore) return a._sortScore - b._sortScore;
      return (a.totalStrokes || 999) - (b.totalStrokes || 999);
    });

    // Assign positions with tie handling
    // Active players get positions, cut/wd/dq get their status as position
    let currentPos = 1;
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      if (p.status !== 'active') {
        p.pos = p.status === 'cut' ? 'CUT' : p.status === 'withdrawn' ? 'WD' : 'DQ';
        continue;
      }

      // Check for ties: look at players with the same score
      if (i > 0 && parsed[i - 1].status === 'active' && parsed[i - 1].score === p.score) {
        // Same score as previous = tied, use same position
        p.pos = parsed[i - 1].pos;
      } else {
        // Count how many active players before this one
        let activeCount = 0;
        for (let j = 0; j < i; j++) {
          if (parsed[j].status === 'active') activeCount++;
        }
        const posNum = activeCount + 1;

        // Check if next player has the same score (tie)
        let isTied = false;
        for (let j = i + 1; j < parsed.length; j++) {
          if (parsed[j].status === 'active' && parsed[j].score === p.score) {
            isTied = true;
            break;
          }
        }
        p.pos = isTied ? `T${posNum}` : `${posNum}`;
      }
    }

    // Remove internal sort field and add to result
    result.players = parsed.map(({ _sortScore, ...rest }) => rest);

    console.log(`Parsed ${result.players.length} players. Round ${roundNumber} (${roundState}). Top: ${result.players[0]?.name} ${result.players[0]?.pos} ${result.players[0]?.score}`);

  } catch (err) {
    console.error('Error parsing ESPN API response:', err);
  }

  return result;
}

export async function GET(request: Request) {
  try {
    // Check for eventId from query parameter or settings
    const url = new URL(request.url);
    let eventId = url.searchParams.get('eventId') || null;

    // If no eventId in query, try loading from settings
    if (!eventId) {
      // Try file-based settings first
      try {
        const settingsPath = IS_VERCEL ? '/tmp/golf-pool-data/settings.json' : path.join(process.cwd(), 'data', 'settings.json');
        if (fsSync.existsSync(settingsPath)) {
          const settings = JSON.parse(fsSync.readFileSync(settingsPath, 'utf-8'));
          eventId = settings.espnEventId || null;
        }
      } catch (e) {}
      // If still no eventId, try KV
      if (!eventId) {
        try {
          if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
            const db = await import('@/lib/db-kv');
            const settings = await db.getSettings();
            eventId = (settings as any).espnEventId || null;
          }
        } catch (e2) {}
      }
      if (eventId) console.log(`[ESPN] Loaded event ID from settings: ${eventId}`);
    }

    let scores: any = null;

    // STRATEGY:
    // When an ESPN Event ID is configured, use the Core API endpoint which
    // is the ONLY endpoint that works for specific completed tournaments.
    // The regular scoreboard endpoint ignores the event parameter for golf.
    if (eventId) {
      console.log(`[ESPN] Event ID configured: ${eventId}. Using Core API...`);
      try {
        scores = await fetchFromCoreApi(eventId);
        if (scores && scores.players.length > 0) {
          console.log(`[ESPN] Core API success: ${scores.players.length} players, tournament: ${scores.tournament?.name}`);
        } else {
          console.log(`[ESPN] Core API returned no players, falling back to scoreboard`);
          scores = null;
        }
      } catch (e) {
        console.log(`[ESPN] Core API failed:`, e);
        scores = null;
      }
    }

    // Fallback: use default scoreboard (for current/live tournaments or if no event ID)
    if (!scores) {
      console.log(`[ESPN] Fetching default scoreboard`);
      const response = await fetch(ESPN_API_URL, {
        headers: { 'Accept': 'application/json' }, cache: 'no-store',
      });
      if (!response.ok) {
        console.log(`ESPN API returned ${response.status}`);
        return Response.json(await readCachedScores());
      }
      const apiData = await response.json();
      scores = parseEspnApiResponse(apiData);
      const detectedEventId = apiData?.events?.[0]?.id;
      if (detectedEventId && scores.tournament) {
        scores.tournament.eventId = detectedEventId;
      }
    }

    if (scores.players.length > 0) {
      await writeScores(scores);
      return Response.json(scores, { headers: { 'Cache-Control': 'public, max-age=300' } });
    } else {
      return Response.json(await readCachedScores());
    }
  } catch (err) {
    console.error('GET /api/scores/update error:', err);
    try { return Response.json(await readCachedScores()); }
    catch { return Response.json({ players: [], tournament: null, lastUpdated: null }, { status: 500 }); }
  }
}
