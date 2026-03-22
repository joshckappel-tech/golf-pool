const ESPN_API_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

export async function GET() {
  try {
    const response = await fetch(ESPN_API_URL, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json({ error: `ESPN returned ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const events = data?.events || [];
    if (events.length === 0) {
      return Response.json({ error: 'No events', rawKeys: Object.keys(data) });
    }

    const event = events[0];
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];

    // Return full raw data for the first 3 competitors
    const sample = competitors.slice(0, 3).map((c: any, i: number) => {
      // Flatten everything so we can see all fields
      return {
        _index: i,
        _athleteName: c.athlete?.displayName,
        _allTopLevelKeys: Object.keys(c),

        // Score (what type and value?)
        score: c.score,
        score_type: typeof c.score,

        // Place / position
        place: c.place,
        sortOrder: c.sortOrder,
        seed: c.seed,

        // Full status object (this is where pos/thru live)
        status_full: c.status,

        // Full statistics array
        statistics_full: c.statistics,

        // Full linescores array (round data)
        linescores_full: c.linescores,
      };
    });

    return Response.json({
      tournamentName: event.name,
      competitionStatus_full: competition?.status,
      purse: competition?.purse,
      totalCompetitors: competitors.length,
      sampleCompetitors: sample,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
