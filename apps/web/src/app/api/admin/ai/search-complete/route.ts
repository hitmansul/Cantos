import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { homeTeam, awayTeam, date } = await request.json();

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: 'homeTeam and awayTeam are required' }, { status: 400 });
  }

  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!FIRECRAWL_API_KEY || !GEMINI_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'API keys not configured',
      corners: null,
      referee: null,
      cards: null,
      shots: null,
    });
  }

  try {
    const matchDate = date ? new Date(date).toLocaleDateString('pt-BR') : '';
    const searchQuery = `${homeTeam} x ${awayTeam} ${matchDate} estatísticas escanteios corners cartões árbitro finalizações`;

    // Call Firecrawl search
    const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
      }),
    });

    if (!firecrawlRes.ok) {
      return NextResponse.json({
        success: false,
        error: 'Firecrawl search failed',
        corners: null,
        referee: null,
        cards: null,
        shots: null,
      });
    }

    const firecrawlData = (await firecrawlRes.json()) as {
      data?: Array<{ title?: string; description?: string; markdown?: string }>;
    };
    const webResults = firecrawlData.data || [];
    const combinedText = webResults
      .map((r) => `${r.title || ''}\n${r.description || ''}\n${r.markdown || ''}`)
      .join('\n\n---\n\n');

    if (!combinedText.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum resultado encontrado',
        corners: null,
        referee: null,
        cards: null,
        shots: null,
      });
    }

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Partida: ${homeTeam} vs ${awayTeam}\nData: ${matchDate || 'não especificada'}\n\nTexto:\n${combinedText}`,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: `Extraia estatísticas da partida ${homeTeam} vs ${awayTeam}. Retorne JSON: {"found":bool,"corners":{"homeCorners":num,"awayCorners":num,"found":bool},"referee":{"name":"string","found":bool},"cards":{"homeYellow":num,"awayYellow":num,"homeRed":num,"awayRed":num,"found":bool},"shots":{"homeShots":num,"awayShots":num,"homeShotsOnTarget":num,"awayShotsOnTarget":num,"found":bool},"confidence":"high/medium/low"}`,
              },
            ],
          },
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({
        success: false,
        error: 'Gemini API failed',
        corners: null,
        referee: null,
        cards: null,
        shots: null,
      });
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(text);

    return NextResponse.json({
      success: result.found === true,
      corners: result.corners?.found
        ? { homeCorners: result.corners.homeCorners, awayCorners: result.corners.awayCorners }
        : null,
      referee: result.referee?.found ? result.referee.name : null,
      cards: result.cards?.found
        ? {
            homeYellow: result.cards.homeYellow,
            awayYellow: result.cards.awayYellow,
            homeRed: result.cards.homeRed,
            awayRed: result.cards.awayRed,
          }
        : null,
      shots: result.shots?.found
        ? {
            homeShots: result.shots.homeShots,
            awayShots: result.shots.awayShots,
            homeShotsOnTarget: result.shots.homeShotsOnTarget,
            awayShotsOnTarget: result.shots.awayShotsOnTarget,
          }
        : null,
      confidence: result.confidence,
      error: result.error,
    });
  } catch (error) {
    console.error('Search complete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar dados',
        corners: null,
        referee: null,
        cards: null,
        shots: null,
      },
      { status: 500 }
    );
  }
}
