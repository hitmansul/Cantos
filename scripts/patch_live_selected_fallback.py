from pathlib import Path

component = Path('apps/web/src/components/LiveCornerStats.tsx')
text = component.read_text()

old = """      const sofaEventId = match.sourceIds?.sofascore;
      if (match.corners || !sofaEventId) return;

      setLoadingMatchId(match.id);
      try {
        const response = await fetch(`/api/live/corners-fast?eventId=${sofaEventId}`, {
          cache: 'no-store',
        });"""
new = """      if (match.corners) return;

      const sofaEventId = match.sourceIds?.sofascore;
      setLoadingMatchId(match.id);
      try {
        const params = new URLSearchParams({
          home: match.homeTeam.name,
          away: match.awayTeam.name,
        });
        if (sofaEventId) params.set('eventId', String(sofaEventId));

        const response = await fetch(`/api/live/corners-fast?${params.toString()}`, {
          cache: 'no-store',
        });"""
if old not in text:
    raise SystemExit('client selection block not found')
text = text.replace(old, new)
component.write_text(text)

route = Path('apps/web/src/app/api/live/corners-fast/route.ts')
route_text = route.read_text()
old_get = """export async function GET(request: NextRequest) {
  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);"""
new_get = """export async function GET(request: NextRequest) {
  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);"""
if old_get not in route_text:
    raise SystemExit('route GET block not found')
route_text = route_text.replace(old_get, new_get)
route.write_text(route_text)
