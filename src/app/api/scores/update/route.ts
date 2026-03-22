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

// Parse ESPN JSON API response into our format
function parseEspnApiResponse(data: any): any {
  const result: any = {
    players: [],
    tournament: null,
    lastUpdated: new Date().toISOString(),
  };

  try {
    // Get the current/most recent event
    const events = data?.events || [];
    if (events.length === 0) {
      console.log('No events found in ESPN API response');
      return result;
    }

    const event = events[0];
    result.tournament = {
      name: event.name || event.shortName || 'Unknown Tournament',
      status: event.status?.type?.description || 'Unknown',
      startDate: event.date || null,
      purse: null, // Will extract from competitions if available
    };

    // Get competition data (the actual tournament)
    const competitions = event.competitions || [];
    if (competitions.length === 0) {
      console.log('No competitions found in event');
      return result;
    }

    const competition = competitions[0];

    // Extract purse if available
    if (competition.purse) {
      result.tournament.purse = competition.purse;
    }

    // Extract competitor/player data
    const competitors = competition.competitors || [];

    for (const competitor of competitors) {
      try {
        const athlete = competitor.athlete || {};
        const status = competitor.status || {};

        // Get player name
        const name = athlete.displayName || athlete.shortName || 'Unknown';

        // Get position
        const position = status.position?.displayName ||
                         status.position?.id?.toString() ||
                         competitor.place?.toString() ||
                         '--';

        // Get score to par - look in multiple places
        let scoreToPar: number | null = null;
        let scoreDisplay: string = 'E';

        // Try competitor.score first
        if (competitor.score !== undefined && competitor.score !== null) {
          if (typeof competitor.score === 'object') {
            scoreDisplay = competitor.score.displayValue || 'E';
          } else {
            scoreDisplay = competitor.score.toString();
          }
        }

        // Try statistics array for scoreToPar
        const stats = competitor.statistics || [];
        for (const stat of stats) {
          if (stat.name === 'scoreToPar' || stat.abbreviation === 'TOPAR') {
            scoreDisplay = stat.displayValue || scoreDisplay;
            break;
          }
        }

        // Parse score display to number
        if (scoreDisplay === 'E' || scoreDisplay === 'Even') {
          scoreToPar = 0;
        } else {
          const parsed = parseInt(scoreDisplay, 10);
          if (!isNaN(parsed)) {
            scoreToPar = parsed;
          }
        }

        // Get thru (holes completed)
        const thru = status.thru?.toString() ||
                     status.period?.toString() ||
                     (status.type?.description === 'Final' ? 'F' : '--');

        // Get round scores from linescores
        const linescores = competitor.linescores || [];
        const rounds: (number | null)[] = linescores.map((ls: any) => {
          const val = ls.value !== undefined ? ls.value : ls.displayValue;
          return val !== undefined && val !== null && val !== '--' ? Number(val) : null;
        });

        // Determine status (active, cut, withdrawn)
        let playerStatus = 'active';
        const statusType = status.type?.description?.toLowerCase() || '';
        const displayStatus = status.displayValue?.toLowerCase() || '';

        if (statusType.includes('cut') || displayStatus.includes('cut') || position === 'CUT') {
          playerStatus = 'cut';
        } else if (statusType.includes('wd') || displayStatus.includes('wd') ||
                   statusType.includes('withdraw') || position === 'WD') {
          playerStatus = 'withdrawn';
        } else if (statusType.includes('dq') || displayStatus.includes('dq') || position === 'DQ') {
          playerStatus = 'disqualified';
        }

        // Get total strokes
        let totalStrokes: number | null = null;
        for (const stat of stats) {
          if (stat.name === 'strokes' || stat.abbreviation === 'TOT') {
            totalStrokes = Number(stat.displayValue) || null;
            break;
          }
        }

        result.players.push({
          name,
          pos: position,
          score: scoreToPar,
          scoreDisplay,
          thru,
          rounds,
          totalStrokes,
          status: playerStatus,
          country: athlete.flag?.alt || null,
        });
      } catch (playerErr) {
        console.error('Error parsing player:', playerErr);
        // Skip this player but continue with others
      }
    }

    // Sort by position (numerical positions first, then CUT/WD/DQ)
    result.players.sort((a: any, b: any) => {
      const posA = parseInt(a.pos.replace('T', ''), 10);
      const posB = parseInt(b.pos.replace('T', ''), 10);
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
    // Fetch from ESPN's public JSON API
    const response = await fetch(ESPN_API_URL, {
      headers: {
        'Accept': 'application/json',
      },
      // Don't cache on the server side so we get fresh data
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`ESPN API returned ${response.status}, returning cached scores`);
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores);
    }

    const apiData = await response.json();

    // Parse the JSON response
    const scores = parseEspnApiResponse(apiData);

    // Only save if we actually got player data
    if (scores.players.length > 0) {
      await writeScores(scores);

      return Response.json(scores, {
        headers: {
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
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
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch (cacheErr) {
      return Response.json({ players: [], tournament: null, lastUpdated: null }, { status: 500 });
    }
  }
}
