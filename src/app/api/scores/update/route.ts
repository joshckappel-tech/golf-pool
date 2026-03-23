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

    result.tournament = {
      name: event.name || event.shortName || 'Unknown',
      status: ct.description || '',
      roundDisplay,
      roundNumber,
      roundState,
      purse: competition.purse || null,
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
        if (c.earnings !== undefined && c.earnings !== null) {
          earnings = typeof c.earnings === 'number' ? c.earnings : parseFloat(String(c.earnings));
          if (isNaN(earnings as number)) earnings = null;
        }
        // Also check statistics array for earnings
        if (earnings === null && Array.isArray(c.statistics)) {
          for (const stat of c.statistics) {
            if (stat.name === 'earnings' || stat.abbreviation === 'EARN') {
              earnings = parseFloat(String(stat.displayValue || stat.value || '0').replace(/[$,]/g, ''));
              if (isNaN(earnings as number)) earnings = null;
              break;
            }
          }
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

export async function GET() {
  try {
    const response = await fetch(ESPN_API_URL, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`ESPN API returned ${response.status}`);
      return Response.json(await readCachedScores());
    }

    const apiData = await response.json();
    const scores = parseEspnApiResponse(apiData);

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
