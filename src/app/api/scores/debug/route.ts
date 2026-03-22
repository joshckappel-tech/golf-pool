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
      return Response.json({ error: 'No events', raw: data });
    }

    const event = events[0];
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];

    // Return a diagnostic view of the first 3 competitors plus tournament status
    const sample = competitors.slice(0, 3).map((c: any) => ({
      // Raw fields
      athleteName: c.athlete?.displayName,
      score: c.score,
      scoreType: typeof c.score,
      place: c.place,
      sortOrder: c.sortOrder,
      // Status object
      status: c.status,
      // Statistics
      statistics: c.statistics,
      // Linescores (round data)
      linescores: c.linescores,
    }));

    return Response.json({
      tournamentName: event.name,
      eventStatus: event.status,
      competitionStatus: competition?.status,
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
