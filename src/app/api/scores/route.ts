import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

const IS_VERCEL = !!process.env.VERCEL;
const SOURCE_DATA_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = IS_VERCEL ? '/tmp/golf-pool-data' : SOURCE_DATA_DIR;

// Get path to scores JSON file
function getScoresPath(): string {
  return path.join(DATA_DIR, 'scores.json');
}

// Ensure data dir exists and seed scores on Vercel
async function ensureScoresDir() {
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

// Read scores from JSON file
async function readScores(): Promise<any[]> {
  try {
    await ensureScoresDir();
    const filePath = getScoresPath();
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
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
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('GET /api/scores error:', err);
    return Response.json([], { status: 500 });
  }
}
