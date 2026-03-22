import { promises as fs } from 'fs';
import path from 'path';

// Get path to scores JSON file
function getScoresPath(): string {
  return path.join(process.cwd(), 'data', 'scores.json');
}

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
}

// Read cached scores from JSON file
async function readCachedScores(): Promise<any[]> {
  try {
    const filePath = getScoresPath();
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading cached scores:', err);
    return [];
  }
}

// Write scores to JSON file
async function writeScores(scores: any[]): Promise<void> {
  try {
    await ensureDataDir();
    const filePath = getScoresPath();
    await fs.writeFile(filePath, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing scores:', err);
    throw err;
  }
}

// Parse ESPN leaderboard HTML to extract scores
function parseEspnLeaderboard(html: string): any[] {
  const scores: any[] = [];

  // Simple regex-based parsing for golfer scores from ESPN leaderboard
  // This looks for patterns like: golfer name, position, score, etc.
  // ESPN leaderboard typically has structure: <tr> elements with golfer data

  try {
    // Match table rows containing golfer data
    // Pattern: extract name, position, score to par
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
      // Extract position
      const posMatch = row.match(/<td[^>]*>\s*(?:<[^>]*>)*(T?\d+|CUT|WD)(?:<[^>]*>)*\s*<\/td>/);
      // Extract golfer name (usually in a link)
      const nameMatch = row.match(/<a[^>]*href="\/golf\/player[^"]*"[^>]*>([^<]+)<\/a>/);
      // Extract score (look for negative numbers like -12, -5, or +5)
      const scoreMatch = row.match(/>(-?\d+)<\/td>/);

      if (nameMatch && scoreMatch) {
        const name = nameMatch[1].trim();
        const scoreStr = scoreMatch[1];
        const score = parseInt(scoreStr, 10);

        scores.push({
          name,
          score,
          pos: posMatch ? posMatch[1].trim() : 'T' + scores.length,
          status: 'active',
        });
      }
    }
  } catch (err) {
    console.error('Error parsing ESPN leaderboard:', err);
  }

  return scores;
}

export async function GET() {
  try {
    // Attempt to fetch ESPN leaderboard
    const response = await fetch('https://www.espn.com/golf/leaderboard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log('ESPN fetch failed, returning cached scores');
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores);
    }

    const html = await response.text();

    // Parse the HTML to extract scores
    const scores = parseEspnLeaderboard(html);

    // If parsing yielded no results, use cached scores
    if (scores.length === 0) {
      console.log('No scores parsed from ESPN, returning cached scores');
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores);
    }

    // Save updated scores to cache
    await writeScores(scores);

    return Response.json(scores, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('GET /api/scores/update error:', err);

    // On any error, return cached scores
    try {
      const cachedScores = await readCachedScores();
      return Response.json(cachedScores, {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch (cacheErr) {
      return Response.json([], { status: 500 });
    }
  }
}
