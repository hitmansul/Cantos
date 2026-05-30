import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { text } = await request.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'Gemini API key not configured',
      matches: [],
      teamStats: [],
    });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          systemInstruction: {
            parts: [
              {
                text: 'Extraia dados de escanteios do texto. Retorne JSON: {"matches":[{"homeTeam":"string","awayTeam":"string","homeCorners":num,"awayCorners":num,"date":"YYYY-MM-DD","league":"string"}],"teamStats":[{"team":"string","avgCorners":num,"avgCornersFor":num,"avgCornersAgainst":num,"gamesPlayed":num}]}. Se não encontrar dados, retorne {"matches":[],"teamStats":[],"error":"mensagem"}',
              },
            ],
          },
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json(
        { error: 'Gemini API failed', matches: [], teamStats: [] },
        { status: 500 }
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(responseText);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Parse corners AI error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar com IA', matches: [], teamStats: [] },
      { status: 500 }
    );
  }
}
