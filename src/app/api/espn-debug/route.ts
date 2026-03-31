export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId') || '401811939';
  const CORE = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga`;

  const result: any = { eventId };

  async function fetchJson(u: string) {
    try {
      const r = await fetch(u, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (r.ok) return await r.json();
      return { _error: r.status };
    } catch (e: any) { return { _error: e.message }; }
  }

  // Get first competitor ID
  const list = await fetchJson(`${CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=1&page=1`);
  const firstItem = list?.items?.[0];
  if (!firstItem) {
    return Response.json({ error: 'No competitors found', list });
  }
  const cid = firstItem.id;
  result.competitorId = cid;
  result.competitorItemKeys = Object.keys(firstItem);

  const compBase = `${CORE}/events/${eventId}/competitions/${eventId}/competitors/${cid}`;

  // Fetch all sub-resources in parallel
  const [score, athlete, status, statistics, linescores, fullComp] = await Promise.all([
    fetchJson(`${compBase}/score`),
    firstItem.athlete?.$ref ? fetchJson(firstItem.athlete.$ref) : firstItem.athlete,
    firstItem.status?.$ref ? fetchJson(firstItem.status.$ref) : firstItem.status,
    fetchJson(`${compBase}/statistics`),
    fetchJson(`${compBase}/linescores?limit=10`),
    firstItem.$ref ? fetchJson(firstItem.$ref) : null,
  ]);

  result.score = score;
  result.athleteName = athlete?.displayName || athlete?.fullName;
  result.athleteFlag = athlete?.flag?.alt;
  result.status = status;

  // Deep-inspect statistics for earnings
  result.statisticsTopKeys = statistics ? Object.keys(statistics) : null;
  result.statisticsRaw = statistics;

  // If statistics has items, resolve first one
  if (statistics?.items) {
    result.statisticsItemCount = statistics.items.length;
    if (statistics.items[0]?.$ref) {
      result.firstStatisticResolved = await fetchJson(statistics.items[0].$ref);
    } else {
      result.firstStatistic = statistics.items[0];
    }
  }

  // Linescores
  result.linescoresTopKeys = linescores ? Object.keys(linescores) : null;
  result.linescoresCount = linescores?.count || linescores?.items?.length;
  if (linescores?.items?.[0]) {
    const ls0 = linescores.items[0];
    if (ls0.$ref) {
      result.firstLinescoreResolved = await fetchJson(ls0.$ref);
    } else {
      result.firstLinescore = ls0;
    }
  }

  // Full competitor (following $ref) — check all keys for earnings
  if (fullComp) {
    result.fullCompetitorKeys = Object.keys(fullComp);
    // Check every field for earnings-related data
    for (const key of Object.keys(fullComp)) {
      const val = fullComp[key];
      if (key.toLowerCase().includes('earn') || key.toLowerCase().includes('prize') || key.toLowerCase().includes('money') || key.toLowerCase().includes('purse')) {
        result[`fullComp_${key}`] = val;
      }
    }
  }

  // Also try the web API leaderboard endpoint which ESPN's website uses
  const webLeaderboard = await fetchJson(`https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${eventId}`);
  result.webLeaderboardStatus = webLeaderboard?._error || 'ok';
  if (webLeaderboard && !webLeaderboard._error) {
    result.webLeaderboardTopKeys = Object.keys(webLeaderboard);
    // Check for events/competitors
    const wlEvent = webLeaderboard.events?.[0];
    if (wlEvent) {
      result.webLeaderboardEventName = wlEvent.name || wlEvent.shortName;
      result.webLeaderboardEventId = wlEvent.id;
      const wlComp = wlEvent.competitions?.[0];
      if (wlComp?.competitors?.[0]) {
        const wlc = wlComp.competitors[0];
        result.webLeaderboardFirstCompKeys = Object.keys(wlc);
        result.webLeaderboardFirstCompName = wlc.athlete?.displayName;
        result.webLeaderboardFirstCompEarnings = wlc.earnings;
        result.webLeaderboardFirstCompPrize = wlc.prize;
        result.webLeaderboardFirstCompMoney = wlc.money;
        result.webLeaderboardFirstCompScore = wlc.score;
        // Check linescores
        result.webLeaderboardFirstCompLinescoresCount = wlc.linescores?.length;
        if (wlc.linescores?.[0]) {
          result.webLeaderboardFirstCompLinescore0 = wlc.linescores[0];
        }
        // Check statistics for earnings
        if (wlc.statistics) {
          result.webLeaderboardFirstCompStats = wlc.statistics;
        }
        // Check status
        if (wlc.status) {
          result.webLeaderboardFirstCompStatus = wlc.status;
        }
      }
    }
  }

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
