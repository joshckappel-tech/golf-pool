import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

const IS_VERCEL = !!process.env.VERCEL;
const SOURCE_DATA_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : SOURCE_DATA_DIR;
const ESPN_API_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

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
      try {
        const settingsPath = IS_VERCEL ? '/tmp/golf-pool-data/settings.json' : path.join(process.cwd(), 'data', 'settings.json');
        if (fsSync.existsSync(settingsPath)) {
          const settings = JSON.parse(fsSync.readFileSync(settingsPath, 'utf-8'));
          eventId = settings.espnEventId || null;
        }
      } catch (e) {
        // Also try KV if available
        try {
          if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
            const db = await import('@/lib/db-kv');
            const settings = await db.getSettings();
            eventId = (settings as any).espnEventId || null;
          }
        } catch (e2) {}
      }
    }

    // Build ESPN URL — use event-specific scoreboard if we have an event ID
    const espnUrl = eventId
      ? `${ESPN_API_URL}?event=${eventId}`
      : ESPN_API_URL;

    console.log(`[ESPN] Fetching: ${espnUrl}${eventId ? ' (event ID: ' + eventId + ')' : ' (default/current)'}`);

    const response = await fetch(espnUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`ESPN API returned ${response.status}`);
      return Response.json(await readCachedScores());
    }

    const apiData = await response.json();
    const scores = parseEspnApiResponse(apiData);

    // Save the detected event ID for future use
    const detectedEventId = apiData?.events?.[0]?.id;
    if (detectedEventId && scores.tournament) {
      scores.tournament.eventId = detectedEventId;
    }

    // Always try the ESPN event summary endpoint for rich tournament metadata
    if (scores.tournament) {
      try {
        const summaryEventId = eventId || detectedEventId;
        if (summaryEventId) {
          const summaryRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${summaryEventId}`,
            { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
          );
          if (summaryRes.ok) {
            const summary = await summaryRes.json();

            // Log full structure keys for debugging
            console.log('[ESPN] Summary top-level keys:', Object.keys(summary));
            console.log('[ESPN] Summary event keys:', summary.event ? Object.keys(summary.event) : 'no event');

            const ev = summary.event || {};
            const courses = summary.courses || ev.courses || [];
            const venue = ev.venue || summary.venue;

            // Course name + location
            if (!scores.tournament.courseName) {
              if (courses.length > 0) {
                const c = courses[0];
                const cName = c.name || c.courseName;
                const city = c.address?.city || venue?.address?.city;
                const state = c.address?.state || venue?.address?.state;
                const loc = [city, state].filter(Boolean).join(', ');
                scores.tournament.courseName = cName ? (loc ? `${cName} — ${loc}` : cName) : null;
              } else if (venue) {
                const vName = venue.fullName || venue.shortName;
                const city = venue.address?.city;
                const state = venue.address?.state;
                const loc = [city, state].filter(Boolean).join(', ');
                scores.tournament.courseName = vName ? (loc ? `${vName} — ${loc}` : vName) : null;
              }
            }

            // Yardage + Par from courses
            if (courses.length > 0) {
              scores.tournament.yardage = courses[0].yardage || courses[0].yards || null;
              scores.tournament.par = courses[0].par || null;
            }

            // Tournament dates
            const startDate = ev.date || ev.startDate;
            const endDate = ev.endDate;
            if (startDate) {
              const start = new Date(startDate);
              const end = endDate ? new Date(endDate) : null;
              const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
              const yearOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
              if (end) {
                scores.tournament.dates = `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', yearOpts)}`;
              } else {
                scores.tournament.dates = start.toLocaleDateString('en-US', yearOpts);
              }
            }

            // Broadcast / TV info
            const broadcasts = ev.broadcasts || competition?.broadcasts || [];
            if (broadcasts.length > 0) {
              const networks = broadcasts.flatMap((b: any) => b.names || (b.media?.shortName ? [b.media.shortName] : []));
              if (networks.length > 0) scores.tournament.network = networks.join(', ');
            }

            // Defending champion
            const dChamp = ev.defendingChampion || ev.previousChampion;
            if (dChamp) {
              scores.tournament.defendingChampion = dChamp.athlete?.displayName || dChamp.displayName || dChamp.name || null;
            }

            // Location from venue if courseName still missing
            if (!scores.tournament.courseName && venue?.fullName) {
              scores.tournament.courseName = venue.fullName;
            }

            // Try to extract earnings from summary competitors if not already resolved
            const hasEarnings = scores.players.some((p: any) => p.earnings != null && p.earnings > 0);
            if (!hasEarnings) {
              // Summary endpoint may have leaderboard with earnings
              const summaryComps = summary.competitions?.[0]?.competitors
                || summary.event?.competitions?.[0]?.competitors
                || summary.leaderboard || [];

              if (summaryComps.length > 0) {
                // Log first competitor structure
                const sc = summaryComps[0];
                console.log('[ESPN] Summary competitor keys:', Object.keys(sc));
                if (sc.athlete) console.log('[ESPN] Summary competitor.athlete keys:', Object.keys(sc.athlete));

                const earningsMap: Record<string, number> = {};
                for (const sc of summaryComps) {
                  const scName = sc.athlete?.displayName || sc.displayName || sc.name;
                  const scEarnings = sc.earnings ?? sc.prize ?? sc.purse ?? sc.money ?? sc.prizeMoney ?? sc.status?.prize;
                  if (scName && scEarnings != null) {
                    const val = typeof scEarnings === 'number' ? scEarnings : parseFloat(String(scEarnings).replace(/[$,]/g, ''));
                    if (!isNaN(val) && val > 0) earningsMap[scName] = val;
                  }
                  // Also check statistics
                  if (scName && !earningsMap[scName] && Array.isArray(sc.statistics)) {
                    for (const stat of sc.statistics) {
                      if (stat.name === 'earnings' || stat.name === 'prize' || stat.abbreviation === 'EARN' || stat.abbreviation === 'MONEY') {
                        const val = parseFloat(String(stat.displayValue || stat.value || '0').replace(/[$,]/g, ''));
                        if (!isNaN(val) && val > 0) { earningsMap[scName] = val; break; }
                      }
                    }
                  }
                }

                // Apply earnings to parsed players
                if (Object.keys(earningsMap).length > 0) {
                  console.log('[ESPN] Found earnings from summary for', Object.keys(earningsMap).length, 'players. Sample:', Object.entries(earningsMap).slice(0, 3));
                  scores.players.forEach((p: any) => {
                    if (earningsMap[p.name]) p.earnings = earningsMap[p.name];
                    // Try case-insensitive match
                    else {
                      const match = Object.entries(earningsMap).find(([k]) => k.toLowerCase() === p.name.toLowerCase());
                      if (match) p.earnings = match[1];
                    }
                  });
                }
              }
            }

            console.log('[ESPN] Summary resolved:', JSON.stringify({
              courseName: scores.tournament.courseName,
              dates: scores.tournament.dates,
              yardage: scores.tournament.yardage,
              par: scores.tournament.par,
              network: scores.tournament.network,
              defendingChampion: scores.tournament.defendingChampion,
              playersWithEarnings: scores.players.filter((p: any) => p.earnings > 0).length,
            }));
          }
        }
      } catch (e) {
        console.log('[ESPN] Summary fetch failed:', e);
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
