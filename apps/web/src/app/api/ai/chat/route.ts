import { NextRequest, NextResponse } from 'next/server';
import { answerWorldCupFromDatabase } from '@/lib/persistence/worldCupAiRepository';
import { answerFootballFromDatabase } from '@/lib/persistence/footballAiRepository';

export const maxDuration = 60;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function context(messages: ChatMessage[]): string {
  return messages
    .slice(0, -1)
    .slice(-10)
    .map((message) => `${message.role === 'user' ? 'Usuário' : 'IA'}: ${message.content}`)
    .join('\n');
}

function isShortFollowUp(question: string) {
  const q = normalize(question);
  return [
    'e os cartoes',
    'e cartoes',
    'e cartões',
    'e escanteios',
    'e corners',
    'e finalizacoes',
    'e finalizações',
    'e posse',
    'e faltas',
    'e passes',
    'e xg',
    'quem foi melhor',
    'quem dominou',
    'foi justo',
    'foi aberto',
    'foi truncado',
    'tendencia de over',
    'tendência de over',
  ].some((item) => q.includes(normalize(item))) || q.split(' ').length <= 5;
}

function isClubCompetitionQuestion(question: string) {
  const q = normalize(question);
  return [
    'brasileirao',
    'brasileiro',
    'serie a',
    'serie b',
    'libertadores',
    'sul americana',
    'sulamericana',
    'copa do brasil',
    'champions',
    'premier league',
    'la liga',
    'bundesliga',
    'ligue 1',
    'mundial de clubes',
    'flamengo',
    'palmeiras',
    'fluminense',
    'corinthians',
    'sao paulo',
    'vasco',
    'botafogo',
    'real madrid',
    'barcelona',
    'liverpool',
    'river plate',
    'boca juniors',
  ].some((term) => q.includes(term));
}

function buildScopedQuestion(question: string, ctx: string) {
  if (!ctx) return question;
  if (isShortFollowUp(question)) return `${ctx}\nPergunta atual: ${question}`;
  return question;
}

async function localReply(question: string, ctx: string): Promise<string | null> {
  const scopedQuestion = buildScopedQuestion(question, ctx);

  if (isClubCompetitionQuestion(scopedQuestion)) {
    const football = await answerFootballFromDatabase(scopedQuestion);
    if (football) return humanize(football);

    const worldCup = await answerWorldCupFromDatabase(scopedQuestion);
    if (worldCup) return humanize(worldCup);

    return null;
  }

  const worldCup = await answerWorldCupFromDatabase(scopedQuestion);
  if (worldCup) return humanize(worldCup);

  const football = await answerFootballFromDatabase(scopedQuestion);
  if (football) return humanize(football);

  return null;
}

function humanize(reply: string): string {
  return reply
    .replace(/Estatísticas disponíveis:/g, 'Resumo das principais estatísticas:')
    .replace(/Fonte: base local\./g, 'Fonte: base local da Cantos.')
    .trim();
}

function geminiPrompt(question: string, ctx: string): string {
  return `Voce e a IA da Cantos Estatisticas. Responda em portugues brasileiro, de forma direta e natural.

Regras obrigatorias:
- Use dados locais quando existirem.
- Nao invente estatisticas.
- Quando a pergunta pedir uma metrica especifica, responda somente a metrica pedida.
- Considere competicao, times, temporada, data e periodo quando forem citados.
- Se faltarem dados, diga exatamente o que falta.
- Se a pergunta for continuidade da conversa, use o historico para identificar o jogo ou a competicao.
- Nunca responda com um jogo diferente do perguntado.

Pergunta atual:
${question}

Historico relevante:
${ctx || 'sem historico'}`;
}

async function geminiReply(question: string, ctx: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: geminiPrompt(question, ctx) }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.2 },
      }),
    }
  );

  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
    const messages = body?.messages ?? [];
    const lastUser = messages.slice().reverse().find((message) => message.role === 'user');

    if (!lastUser) {
      return NextResponse.json({ reply: 'Nenhuma mensagem de usuário encontrada.', provider: 'local-error' });
    }

    const ctx = context(messages);
    const local = await localReply(lastUser.content, ctx);
    if (local) return NextResponse.json({ reply: local, provider: 'local-first' });

    const gemini = await geminiReply(lastUser.content, ctx);
    if (gemini) return NextResponse.json({ reply: gemini, provider: 'gemini' });

    return NextResponse.json({
      reply: `Não encontrei uma resposta direta na base local para essa pergunta.\n\nPara eu acertar melhor, cite competição, times e período quando fizer sentido. Exemplos:\n- "Quantas finalizações teve Espanha x Áustria na Copa do Mundo?"\n- "Quantos escanteios teve Flamengo x Palmeiras no Brasileirão?"\n- "Qual foi a posse de bola de França x Suécia?"`,
      provider: 'local-fallback',
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ reply: 'Erro interno na IA. A rota respondeu em JSON, mas houve falha no processamento.', provider: 'local-error' });
  }
}
