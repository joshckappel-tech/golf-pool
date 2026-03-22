import { promises as fs } from 'fs';
import path from 'path';

// Get path to scores JSON file
function getScoresPath(): string {
  return path.join(process.cwd(), 'data', 'scores.json');
}

// Read scores from JSON file
async function readScores(): Promise<any[]> {
  try {
    const filePath = getScoresPath();
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    // File doesn't exist or is invalid JSON, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading scores:', err);
    return [];
  }
}

export async function GET() {
  try {
    const scores = await readScores();
    return Response.json(scores, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (err) {
    console.error('GET /api/scores error:', err);
    return Response.json([], { status: 500 });
  }
}
