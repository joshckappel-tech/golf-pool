export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId') || '401811939';
  const CORE = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga`;

  const result: any = { eventId };

  // 1. Fetch the competitors list (first page only)
  try {
    const listRes = await fetch(`${CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=3&page=1`, {
      headers: { 'Accept': 'application/json' }, cache: 'no-store',
    });
    result.listStatus = listRes.status;
    if (listRes.ok) {
      const listData = await listRes.json();
      result.listTopKeys = Object.keys(listData);
      result.listCount = listData.count;
      result.listPageCount = listData.pageCount;
      result.listItemCount = listData.items?.length;

      // Check if items are refs or full objects
      if (listData.items?.[0]) {
        const item = listData.items[0];
        result.firstItemKeys = Object.keys(item);
        result.firstItemIsRef = !!item.$ref && Object.keys(item).length <= 3;

        // If it's a ref, follow it
        if (item.$ref) {
          result.firstItemRef = item.$ref;
          try {
            const compRes = await fetch(item.$ref, {
              headers: { 'Accept': 'application/json' }, cache: 'no-store',
            });
            if (compRes.ok) {
              const comp = await compRes.json();
              result.resolvedCompetitorKeys = Object.keys(comp);

              // Dump key fields (not the full object to keep response manageable)
              result.competitor = {
                id: comp.id,
                uid: comp.uid,
                score: comp.score,
                earnings: comp.earnings,
                amateur: comp.amateur,
                movement: comp.movement,
                order: comp.order,
                statusKeys: comp.status ? Object.keys(comp.status) : null,
                statusType: comp.status?.type,
                statusPeriod: comp.status?.period,
                athleteType: typeof comp.athlete,
                athleteKeys: comp.athlete ? Object.keys(comp.athlete) : null,
                athleteRef: comp.athlete?.$ref,
                athleteDisplayName: comp.athlete?.displayName,
                linescoresCount: Array.isArray(comp.linescores) ? comp.linescores.length : null,
                linescoresType: Array.isArray(comp.linescores) && comp.linescores[0] ? typeof comp.linescores[0] : null,
                linescoreFirstKeys: Array.isArray(comp.linescores) && comp.linescores[0] ? Object.keys(comp.linescores[0]) : null,
                linescoreFirstValue: Array.isArray(comp.linescores) && comp.linescores[0] ? comp.linescores[0].value : null,
                linescoreFirstRef: Array.isArray(comp.linescores) && comp.linescores[0] ? comp.linescores[0].$ref : null,
                statisticsCount: Array.isArray(comp.statistics) ? comp.statistics.length : null,
                statisticsType: Array.isArray(comp.statistics) && comp.statistics[0] ? typeof comp.statistics[0] : null,
                statisticsFirstKeys: Array.isArray(comp.statistics) && comp.statistics[0] ? Object.keys(comp.statistics[0]) : null,
              };

              // If linescores are refs, follow the first one
              if (comp.linescores?.[0]?.$ref) {
                try {
                  const lsRes = await fetch(comp.linescores[0].$ref, {
                    headers: { 'Accept': 'application/json' }, cache: 'no-store',
                  });
                  if (lsRes.ok) {
                    const ls = await lsRes.json();
                    result.resolvedLinescore = ls;
                  }
                } catch (e: any) {
                  result.linescoreResolveError = e.message;
                }
              }

              // If athlete is a ref, follow it
              if (comp.athlete?.$ref) {
                try {
                  const athRes = await fetch(comp.athlete.$ref, {
                    headers: { 'Accept': 'application/json' }, cache: 'no-store',
                  });
                  if (athRes.ok) {
                    const ath = await athRes.json();
                    result.resolvedAthleteKeys = Object.keys(ath);
                    result.resolvedAthlete = {
                      displayName: ath.displayName,
                      fullName: ath.fullName,
                      shortName: ath.shortName,
                      flagAlt: ath.flag?.alt,
                    };
                  }
                } catch (e: any) {
                  result.athleteResolveError = e.message;
                }
              }

              // If statistics are refs, follow the first one
              if (comp.statistics?.[0]?.$ref) {
                try {
                  const stRes = await fetch(comp.statistics[0].$ref, {
                    headers: { 'Accept': 'application/json' }, cache: 'no-store',
                  });
                  if (stRes.ok) {
                    result.resolvedStatistic = await stRes.json();
                  }
                } catch (e: any) {
                  result.statisticResolveError = e.message;
                }
              }

              // If score is a ref, follow it
              if (comp.score?.$ref) {
                try {
                  const scRes = await fetch(comp.score.$ref, {
                    headers: { 'Accept': 'application/json' }, cache: 'no-store',
                  });
                  if (scRes.ok) {
                    result.resolvedScore = await scRes.json();
                  }
                } catch (e: any) {
                  result.scoreResolveError = e.message;
                }
              }
            }
          } catch (e: any) {
            result.resolveError = e.message;
          }
        } else {
          // Item IS the full competitor — dump it
          result.competitor = {
            id: item.id,
            score: item.score,
            earnings: item.earnings,
            athleteKeys: item.athlete ? Object.keys(item.athlete) : null,
            athleteDisplayName: item.athlete?.displayName,
            linescoresCount: item.linescores?.length,
            linescoreFirstKeys: item.linescores?.[0] ? Object.keys(item.linescores[0]) : null,
          };
        }
      }
    }
  } catch (e: any) {
    result.error = e.message;
  }

  // 2. Also fetch competition status
  try {
    const compRes = await fetch(`${CORE}/events/${eventId}/competitions/${eventId}`, {
      headers: { 'Accept': 'application/json' }, cache: 'no-store',
    });
    if (compRes.ok) {
      const comp = await compRes.json();
      result.competitionKeys = Object.keys(comp);
      result.competitionStatus = comp.status;
      // Check if status is a ref
      if (comp.status?.$ref) {
        try {
          const stRes = await fetch(comp.status.$ref, {
            headers: { 'Accept': 'application/json' }, cache: 'no-store',
          });
          if (stRes.ok) {
            result.resolvedCompetitionStatus = await stRes.json();
          }
        } catch (e: any) {}
      }
    }
  } catch (e: any) {}

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
