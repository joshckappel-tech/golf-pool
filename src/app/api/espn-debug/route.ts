export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId') || '401811939';

  const endpoints = [
    { name: 'scoreboard (default)', url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard' },
    { name: 'scoreboard ?event=', url: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${eventId}` },
    { name: 'summary ?event=', url: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${eventId}` },
    { name: 'leaderboard ?event=', url: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${eventId}` },
    { name: 'web scoreboard ?event=', url: `https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${eventId}` },
    { name: 'web leaderboard ?event=', url: `https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${eventId}` },
    { name: 'web summary ?event=', url: `https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${eventId}` },
    { name: 'core events', url: `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${eventId}` },
    { name: 'core competitions', url: `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${eventId}/competitions/${eventId}` },
    { name: 'core competitors', url: `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${eventId}/competitions/${eventId}/competitors` },
  ];

  const results: any[] = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      const status = res.status;
      let info: any = { status };

      if (res.ok) {
        const data = await res.json();
        info.topKeys = Object.keys(data);

        // Check for event name
        if (data.events?.[0]) {
          info.eventName = data.events[0].name;
          info.eventId = data.events[0].id;
          const comp = data.events[0].competitions?.[0];
          info.competitorsCount = comp?.competitors?.length || 0;
          if (comp?.competitors?.[0]) {
            const c = comp.competitors[0];
            info.firstCompetitorKeys = Object.keys(c);
            info.firstCompetitorName = c.athlete?.displayName;
            info.firstCompetitorEarnings = c.earnings;
            info.firstCompetitorPrize = c.prize;
            info.firstCompetitorMoney = c.money;
            info.firstCompetitorStats = c.statistics?.map((s: any) => s.name);
          }
        }
        if (data.event) {
          info.eventName = data.event.name;
          info.eventId = data.event.id;
        }
        if (data.competitions?.[0]?.competitors) {
          info.competitorsCount = data.competitions[0].competitors.length;
          const c = data.competitions[0].competitors[0];
          info.firstCompetitorKeys = Object.keys(c);
          info.firstCompetitorName = c.athlete?.displayName;
          info.firstCompetitorEarnings = c.earnings;
        }
        if (data.header) {
          info.headerKeys = Object.keys(data.header);
        }
        if (data.leaderboard) {
          info.leaderboardLength = data.leaderboard.length;
        }
        if (data.items) {
          info.itemsCount = data.items?.length;
          if (data.items?.[0]) info.firstItemKeys = Object.keys(data.items[0]);
        }
        if (data.name) info.name = data.name;
        if (data.$ref) info.ref = data.$ref;
      }

      results.push({ endpoint: ep.name, url: ep.url, ...info });
    } catch (e: any) {
      results.push({ endpoint: ep.name, url: ep.url, error: e.message });
    }
  }

  return Response.json({ eventId, results }, { headers: { 'Cache-Control': 'no-store' } });
}
