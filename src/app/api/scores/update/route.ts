import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

const IS_VERCEL = !!process.env.VERCEL;
const SOURCE_DATA_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : SOURCE_DATA_DIR;

const ESPN_API_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

function getScoresPath(): string {
  return path.join(DATA_DIR, 'scores.json');
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // exists
  }
  if (IS_VERCEL) {
    const tmpPath = path.join(DATA_DIR, 'scores.json');
    if (!fsSync.existsSync(tmpPath)) {
      const sourcePath = path.join(SOURCE_DATA_DIR, 'scores.json');
      if (fsSync.existsSync(sourcePath)) {
        await fs.copyFile(sourcePath, tmpPath);
      } else {
        await fs.writeFile(tmpPath, '[]', 'utf-8');
      }
    }
  }
}

async function readCachedScores(): Promise<any> {
  try {
    await ensureDataDir();
    const filePath = getScoresPath();
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { players: [], tournament: null, lastUpdated: null };
    }
    console.error('Error reading cached scores:', err);
    return { players: [], tournament: null, lastUpdated: null };
  }
}

async function writeScores(scores: any): Promise<void> {
  try {
    await ensureDataDir();
    const filePath = getScoresPath();
    await fs.writeFile(filePath, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing scores:', err);
    throw err;
  }
}

// Parse a score display string to a number
function parseScoreDisplay(s: string): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === 'E' || trimmed === 'Even' || trimmed === 'even') return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

// Parse ESPN JSON API response into our format
function parseEspnApiResponse(data: any): any {
  const result: any = {
    players: [],
    tournament: null,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const events = data?.events || [];
    if (events.length === 0) {
      console.log('No events found in ESPN API response');
      return result;
    }

    const event = events[0];
    const competitions = event.competitions || [];
    const competition = competitions.length > 0 ? competitions[0] : null;

    // ---- Tournament-level info ----
    let roundDisplay = '';
    let roundNumber = 0;
    let roundState = 'unknown';

    if (competition) {
      const cs = competition.status || {};
      const ct = cs.type || {};
      roundNumber = cs.period || 0;
      const state = (ct.state || '').toLowerCase();
      const desc = ct.description || '';

      if (state === 'in' || desc.toLowerCase().includes('in progress')) {
        roundState = 'in_progress';
        roundDisplay = `Round ${roundNumber} - In Progress`;
      } else if (state === 'post' || desc.toLowerCase().includes('final') || desc.toLowerCase().includes('complete')) {
        roundState = 'complete';
        roundDisplay = roundNumber >= 4 ? 'Final' : `Round ${roundNumber} - Complete`;
      } else if (state === 'pre') {
        roundState = 'not_started';
        roundDisplay = roundNumber > 0 ? `Round ${roundNumber} - Not Started` : 'Not Started';
      } else {
        roundDisplay = desc || 'Unknown';
      }
    }

    result.tournament = {
      name: event.name || event.shortName || 'Unknown Tournament',
      status: event.status?.type?.description || 'Unknown',
      roundDisplay,
      roundNumber,
      roundState,
      startDate: event.date || null,
      purse: competition?.purse || null,
    };

    if (!competition) return result;

    const competitors = competition.competitors || [];
    console.log(`ESPN API: Parsing ${competitors.length} competitors for round ${roundNumber} (${roundState})`);

    for (const c of competitors) {
      try {
        const athlete = c.athlete || {};
        const status = c.status || {};
        const stats = c.statistics || [];
        const linescores = c.linescores || [];

        // Name
        const name = athlete.displayName || athlete.shortName || 'Unknown';

        // Position — ESPN uses status.position or competitor.place
        let pos = '--';
        if (status.position?.displayName) {
          pos = status.position.displayName;
        } else if (status.position?.id) {
          pos = status.position.id.toString();
        } else if (c.place !== undefined && c.place !== null) {
          pos = c.place.toString();
        }

        // Overall score to par
        let scoreToPar: number | null = null;
        let scoreDisplay = 'E';

        // Method 1: statistics array (most reliable)
        for (const stat of stats) {
          if (stat.name === 'scoreToPar' || stat.abbreviation === 'TOPAR') {
            scoreDisplay = stat.displayValue || scoreDisplay;
            break;
          }
        }
        // Method 2: competitor.score
        if (scoreDisplay === 'E' && c.score !== undefined && c.score !== null) {
          scoreDisplay = typeof c.score === 'object' ? (c.score.displayValue || 'E') : c.score.toString();
        }
        scoreToPar = parseScoreDisplay(scoreDisplay);

        // Thru — holes completed in current round
        let thru = '--';
        if (status.thru !== undefined && status.thru !== null) {
          thru = Number(status.thru) === 18 ? 'F' : status.thru.toString();
        } else {
          // If round is complete (post state) and player is active, they finished
          const pState = (status.type?.state || '').toLowerCase();
          const pDesc = (status.type?.description || '').toLowerCase();
          if (pState === 'post' || pDesc.includes('complete') || pDesc === 'final') {
            thru = 'F';
          }
        }

        // Round scores from linescores
        const r1 = linescores[0]?.value !== undefined ? Number(linescores[0].value) : null;
        const r2 = linescores[1]?.value !== undefined ? Number(linescores[1].value) : null;
        const r3 = linescores[2]?.value !== undefined ? Number(linescores[2].value) : null;
        const r4 = linescores[3]?.value !== undefined ? Number(linescores[3].value) : null;

        // Total strokes
        let totalStrokes: number | null = null;
        for (const stat of stats) {
          if (stat.name === 'strokes' || stat.abbreviation === 'TOT') {
            totalStrokes = Number(stat.displayValue) || null;
            break;
          }
        }
        // Fallback: sum up all round scores
        if (totalStrokes === null) {
          const rounds = [r1, r2, r3, r4].filter(r => r !== null && !isNaN(r as number));
          if (rounds.length > 0) totalStrokes = rounds.reduce((a, b) => (a as number) + (b as number), 0) as number;
        }

        // Today — current round score to par
        let today: number | null = null;
        const curIdx = roundNumber > 0 ? roundNumber - 1 : linescores.length - 1;
        if (curIdx >= 0 && curIdx < linescores.length) {
          const ls = linescores[curIdx];
          const strokes = ls?.value !== undefined ? Number(ls.value) : null;
          if (strokes !== null && !isNaN(strokes)) {
            // Par from the linescore or default 71 (Copperhead)
            const par = ls?.par || 71;
            today = strokes - par;
          }
        }

        // Player status (active, cut, withdrawn, disqualified)
        let playerStatus = 'active';
        const sType = (status.type?.description || '').toLowerCase();
        const sDisp = (status.displayValue || '').toLowerCase();
        if (sType.includes('cut') || sDisp.includes('cut') || pos === 'CUT') {
          playerStatus = 'cut';
        } else if (sType.includes('wd') || sDisp.includes('wd') || sType.includes('withdraw') || pos === 'WD') {
          playerStatus = 'withdrawn';
        } else if (sType.includes('dq') || sDisp.includes('dq') || pos === 'DQ') {
          playerStatus = 'disqualified';
        }

        result.players.push({
          name,
          pos,
          score: scoreToPar,
          scoreDisplay,
          today,
          thru,
          r1, r2, r3, r4,
          totalStrokes,
          status: playerStatus,
          country: athlete.flag?.alt || null,
        });
      } catch (playerErr) {
        console.error('Error parsing player:', playerErr);
      }
    }

    // Sort: numerical positions first, then CUT/WD/DQ
    result.players.sort((a: any, b: any) => {
      const posA = parseInt(String(a.pos).replace('T', ''), 10);
      const posB = parseInt(String(b.pos).replace('T', ''), 10);
      if (!isNaN(posA) && !isNaN(posB)) return posA - posB;
      if (!isNaN(posA)) return -1;
      if (!isNaN(posB)) return 1;
      return 0;
    });

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
      console.log(`ESPN API returned ${response.status}, returning cached scores`);
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores);
    }

    const apiData = await response.json();
    const scores = parseEspnApiResponse(apiData);

    console.log(`Parsed ${scores.players.length} players, tournament: ${scores.tournament?.roundDisplay}`);

    if (scores.players.length > 0) {
      await writeScores(scores);
      return Response.json(scores, {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    } else {
      console.log('No players parsed from ESPN API, returning cached scores');
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores);
    }
  } catch (err) {
    console.error('GET /api/scores/update error:', err);
    try {
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    } catch (cacheErr) {
      return Response.json({ players: [], tournament: null, lastUpdated: null }, { status: 500 });
    }
  }
}
