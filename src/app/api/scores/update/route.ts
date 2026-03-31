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

/**
 * Fetch tournament data from ESPN Core API — works for specific completed tournaments.
 * The scoreboard endpoint ignores event IDs for golf, so this is the only way
 * to fetch data for a specific past tournament.
 */
async function fetchFromCoreApi(eventId: string): Promise<any> {
  const result: any = { players: [], tournament: null, lastUpdated: new Date().toISOString() };

  // 1. Fetch event metadata
  console.log(`[ESPN Core] Fetching event ${eventId}...`);
  const eventRes = await fetch(`${CORE_API_BASE}/events/${eventId}`, {
    headers: { 'Accept': 'application/json' }, cache: 'no-store',
  });
  if (!eventRes.ok) {
    console.log(`[ESPN Core] Event fetch failed: ${eventRes.status}`);
    return null;
  }
  const eventData = await eventRes.json();
  console.log(`[ESPN Core] Event: ${eventData.name}, keys: ${Object.keys(eventData).join(',')}`);

  // 2. Fetch competition for status info
  let compData: any = null;
  try {
    const compRes = await fetch(`${CORE_API_BASE}/events/${eventId}/competitions/${eventId}`, {
      headers: { 'Accept': 'application/json' }, cache: 'no-store',
    });
    if (compRes.ok) {
      compData = await compRes.json();
      console.log(`[ESPN Core] Competition keys: ${Object.keys(compData).join(',')}`);
    }
  } catch (e) {
    console.log(`[ESPN Core] Competition fetch failed:`, e);
  }

  // 3. Fetch all competitors (paginated, ~25 per page)
  const allCompetitors: any[] = [];
  let page = 1;
  const PAGE_SIZE = 50;
  while (true) {
    const url = `${CORE_API_BASE}/events/${eventId}/competitions/${eventId}/competitors?limit=${PAGE_SIZE}&page=${page}`;
    console.log(`[ESPN Core] Fetching competitors page ${page}...`);
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (!res.ok) {
        console.log(`[ESPN Core] Competitors page ${page} failed: ${res.status}`);
        break;
      }
      const data = await res.json();
      const items = data.items || [];
      console.log(`[ESPN Core] Page ${page}: ${items.length} items, total: ${data.count || '?'}`);
      if (items.length === 0) break;

      // Items might be $ref objects pointing to full competitor data
      const resolved = await batchResolve(items, 25);
      allCompetitors.push(...resolved);

      if (items.length < PAGE_SIZE) break;
      page++;
      if (page > 10) break; // safety limit
    } catch (e) {
      console.log(`[ESPN Core] Competitors page ${page} error:`, e);
      break;
    }
  }

  console.log(`[ESPN Core] Total competitors fetched: ${allCompetitors.length}`);
  if (allCompetitors.length === 0) return null;

  // Log first competitor structure
  const sample = allCompetitors[0];
  console.log(`[ESPN Core] Sample competitor keys: ${Object.keys(sample).join(',')}`);
  console.log(`[ESPN Core] Sample athlete type: ${typeof sample.athlete}, keys: ${sample.athlete ? Object.keys(sample.athlete).join(',') : 'null'}`);
  console.log(`[ESPN Core] Sample score type: ${typeof sample.score}, value: ${JSON.stringify(sample.score)?.substring(0, 100)}`);
  console.log(`[ESPN Core] Sample earnings: ${sample.earnings}`);

  // 4. Resolve athlete names — if athlete is a $ref, follow it
  const needsAthleteResolution = allCompetitors.some(
    c => c.athlete && !c.athlete.displayName && c.athlete.$ref
  );
  if (needsAthleteResolution) {
    console.log(`[ESPN Core] Resolving athlete names for ${allCompetitors.length} competitors...`);
    for (let i = 0; i < allCompetitors.length; i += 25) {
      const batch = allCompetitors.slice(i, i + 25);
      await Promise.all(batch.map(async (comp) => {
        if (comp.athlete && !comp.athlete.displayName && comp.athlete.$ref) {
          try {
            const r = await fetch(comp.athlete.$ref, {
              headers: { 'Accept': 'application/json' }, cache: 'no-store',
            });
            if (r.ok) comp.athlete = await r.json();
          } catch {}
        }
      }));
    }
    console.log(`[ESPN Core] Athlete resolution complete`);
  }

  // 5. Resolve linescores if they are refs
  const needsLinescoreResolution = allCompetitors.some(
    c => Array.isArray(c.linescores) && c.linescores.length > 0 && c.linescores[0].$ref && c.linescores[0].value === undefined
  );
  if (needsLinescoreResolution) {
    console.log(`[ESPN Core] Resolving linescores...`);
    for (let i = 0; i < allCompetitors.length; i += 25) {
      const batch = allCompetitors.slice(i, i + 25);
      await Promise.all(batch.map(async (comp) => {
        if (Array.isArray(comp.linescores)) {
          comp.linescores = await Promise.all(comp.linescores.map(async (ls: any) => {
            if (ls.$ref && ls.value === undefined) {
              try {
                const r = await fetch(ls.$ref, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
                if (r.ok) return await r.json();
              } catch {}
            }
            return ls;
          }));
        }
      }));
    }
    console.log(`[ESPN Core] Linescore resolution complete`);
  }

  // 6. Parse tournament metadata from event
  const compStatus = compData?.status || {};
  const eventStatus = eventData?.status || {};
  // Status might be a ref
  let statusObj = compStatus.type ? compStatus : eventStatus;
  if (statusObj.$ref && !statusObj.type) {
    statusObj = await resolveRef(statusObj);
  }
  const statusType = statusObj.type || statusObj;
  const tournamentState = (statusType.state || statusType.name || '').toLowerCase();
  const roundNumber = statusObj.period || 0;
  const tournamentComplete = tournamentState === 'post' || tournamentState === 'completed';

  let roundDisplay = statusType.description || statusType.detail || 'Unknown';
  let roundState = 'unknown';
  if (tournamentComplete) {
    roundState = 'complete';
    roundDisplay = roundNumber >= 4 ? 'Final' : `Round ${roundNumber} - Complete`;
  } else if (tournamentState === 'in') {
    roundState = 'in_progress';
    roundDisplay = `Round ${roundNumber} - In Progress`;
  } else if (tournamentState === 'pre') {
    roundState = 'not_started';
    roundDisplay = 'Not Started';
  }

  // Course and venue info — may be refs
  let courseName: string | null = null;
  let yardage: number | null = null;
  let par: number | null = null;

  const rawCourses = eventData.courses || compData?.courses || [];
  if (rawCourses.length > 0) {
    let courseData = await resolveRef(rawCourses[0]);
    courseName = courseData.name || courseData.shortName || null;
    yardage = courseData.yardage || courseData.yards || null;
    par = courseData.par || null;
  }

  const rawVenues = eventData.venues || compData?.venues || [];
  if (rawVenues.length > 0) {
    let venueData = await resolveRef(rawVenues[0]);
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
  const startDate = eventData.date || eventData.startDate;
  const endDate = eventData.endDate;
  let dates: string | null = null;
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
  const rawBroadcasts = eventData.broadcasts || compData?.broadcasts || [];
  if (rawBroadcasts.length > 0) {
    const broadcastNames: string[] = [];
    for (const b of rawBroadcasts.slice(0, 3)) {
      const bd = await resolveRef(b);
      const names = bd.names || (bd.media?.shortName ? [bd.media.shortName] : []);
      broadcastNames.push(...names);
    }
    if (broadcastNames.length > 0) network = broadcastNames.join(', ');
  }

  // Defending champion — may be a ref
  let defendingChampion: string | null = null;
  if (eventData.defendingChampion) {
    let dc = await resolveRef(eventData.defendingChampion);
    if (dc.athlete) {
      const ath = await resolveRef(dc.athlete);
      defendingChampion = ath.displayName || ath.fullName || null;
    } else {
      defendingChampion = dc.displayName || dc.name || null;
    }
  }

  // Purse
  const purse = eventData.purse || eventData.displayPurse || compData?.purse || null;

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

  // 7. Parse each competitor into our standard format
  const parsed: any[] = [];
  for (const c of allCompetitors) {
    try {
      const athlete = c.athlete || {};
      const name = athlete.displayName || athlete.fullName || athlete.shortName || `Player ${c.id || '?'}`;

      // Score — could be an object {value, displayValue} or a primitive
      let scoreToPar: number | null = null;
      let scoreDisplay = 'E';
      if (c.score !== null && c.score !== undefined) {
        if (typeof c.score === 'object') {
          scoreToPar = parseScoreToPar(c.score.displayValue ?? c.score.value);
          scoreDisplay = c.score.displayValue || String(c.score.value ?? 'E');
        } else {
          scoreToPar = parseScoreToPar(c.score);
          scoreDisplay = String(c.score);
        }
      }

      // Player status
      let playerStatus = 'active';
      const statusName = (c.status?.type?.name || c.status?.type?.description || c.status?.name || '').toLowerCase();
      if (statusName.includes('cut')) playerStatus = 'cut';
      else if (statusName.includes('wd') || statusName.includes('withdraw')) playerStatus = 'withdrawn';
      else if (statusName.includes('dq') || statusName.includes('disqualif')) playerStatus = 'disqualified';

      // Also check score display
      const scoreStr = String(scoreDisplay).toLowerCase();
      if (scoreStr === 'cut') playerStatus = 'cut';
      else if (scoreStr === 'wd') playerStatus = 'withdrawn';
      else if (scoreStr === 'dq') playerStatus = 'disqualified';

      if (playerStatus === 'active' && roundNumber >= 3) {
        const ls = c.linescores || [];
        if (ls.length === 2) playerStatus = 'cut';
      }

      // Round scores from linescores
      const linescores = c.linescores || [];
      const r1 = linescores[0]?.value !== undefined ? Number(linescores[0].value) : null;
      const r2 = linescores[1]?.value !== undefined ? Number(linescores[1].value) : null;
      const r3 = linescores[2]?.value !== undefined ? Number(linescores[2].value) : null;
      const r4 = linescores[3]?.value !== undefined ? Number(linescores[3].value) : null;

      // Thru
      let thru = '--';
      if (playerStatus !== 'active') {
        thru = '--';
      } else if (tournamentComplete) {
        thru = 'F';
      } else if (tournamentState === 'in') {
        const currentRoundIdx = roundNumber - 1;
        if (currentRoundIdx >= 0 && currentRoundIdx < linescores.length) {
          const holeScores = linescores[currentRoundIdx]?.linescores || [];
          const holesPlayed = holeScores.length;
          thru = holesPlayed >= 18 ? 'F' : holesPlayed > 0 ? holesPlayed.toString() : '--';
        }
      }

      // Today
      let today: number | null = null;
      if (playerStatus === 'active' && roundNumber > 0 && roundNumber <= linescores.length) {
        today = parseScoreToPar(linescores[roundNumber - 1]?.displayValue);
      }

      // Earnings
      let earnings: number | null = null;
      if (c.earnings !== undefined && c.earnings !== null) {
        earnings = typeof c.earnings === 'number' ? c.earnings : parseFloat(String(c.earnings).replace(/[$,]/g, ''));
        if (isNaN(earnings as number)) earnings = null;
      }

      // Total strokes
      const completedRounds = [r1, r2, r3, r4].filter(r => r !== null) as number[];
      const totalStrokes = completedRounds.length > 0 ? completedRounds.reduce((a, b) => a + b, 0) : null;

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

  // Sort by score ascending
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
  console.log(`[ESPN Core] Parsed ${result.players.length} players. Top: ${result.players[0]?.name} (${result.players[0]?.score}), earnings: ${result.players[0]?.earnings}`);

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
