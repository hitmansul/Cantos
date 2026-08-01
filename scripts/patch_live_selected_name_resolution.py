from pathlib import Path

route = Path('apps/web/src/app/api/live/corners-fast/route.ts')
text = route.read_text()

marker = "async function enrichEvent(eventId: number): Promise<CacheEntry> {"
helper = """type SofaLiveEvent = {
  id: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
};

async function resolveSofaEventId(home: string, away: string): Promise<number | null> {
  if (!home || !away) return null;
  const payload = await fetchJson<{ events?: SofaLiveEvent[] }>(
    `${SOFA_BASE}/sport/football/events/live`
  );
  const homeKey = normalize(home);
  const awayKey = normalize(away);
  const events = payload?.events ?? [];

  const exact = events.find(
    (event) =>
      normalize(event.homeTeam?.name) === homeKey &&
      normalize(event.awayTeam?.name) === awayKey
  );
  if (exact) return exact.id;

  const partial = events.find((event) => {
    const eventHome = normalize(event.homeTeam?.name);
    const eventAway = normalize(event.awayTeam?.name);
    return (
      eventHome.length > 2 &&
      eventAway.length > 2 &&
      (eventHome.includes(homeKey) || homeKey.includes(eventHome)) &&
      (eventAway.includes(awayKey) || awayKey.includes(eventAway))
    );
  });
  return partial?.id ?? null;
}

"""
if helper not in text:
    if marker not in text:
        raise SystemExit('enrich marker not found')
    text = text.replace(marker, helper + marker)

old = """  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);"""
new = """  const requestedEventIdParam = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';
  const requestedEventId =
    requestedEventIdParam > 0
      ? requestedEventIdParam
      : (await resolveSofaEventId(requestedHome, requestedAway)) ?? 0;
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);"""
if old not in text:
    raise SystemExit('requested event block not found')
text = text.replace(old, new)

old_candidates = """  const candidates = matches
    .map((match, index) => ({ match, index, eventId: match.sourceIds?.sofascore }))
    .filter((item): item is { match: LiveMatch; index: number; eventId: number } => Boolean(item.eventId))
    .sort((a, b) => {"""
new_candidates = """  const candidates = matches
    .map((match, index) => {
      const selectedByName =
        requestedEventId > 0 &&
        normalize(match.homeTeam.name) === normalize(requestedHome) &&
        normalize(match.awayTeam.name) === normalize(requestedAway);
      return {
        match,
        index,
        eventId: selectedByName ? requestedEventId : match.sourceIds?.sofascore,
      };
    })
    .filter((item): item is { match: LiveMatch; index: number; eventId: number } => Boolean(item.eventId))
    .sort((a, b) => {"""
if old_candidates not in text:
    raise SystemExit('candidate block not found')
text = text.replace(old_candidates, new_candidates)
route.write_text(text)
