import { NextRequest, NextResponse } from 'next/server';
import { getHeadToHead, teamStats } from '@/data/teamCornerStats';
import { currentUpcomingMatches, type CurrentFixture } from '@/data/currentFixtures';
import { findReferee, getRefereeStatsSummary } from '@/data/brazilianReferees';
import { findTeamCardStats } from '@/data/teamCardStats';
import {
  championsLeagueTeamStats,
  conferenceLeagueTeamStats,
  europaLeagueTeamStats,
  libertadoresTeamStats,
  sulAmericanaTeamStats,
} from '@/data/cornerStats';
import { SCORES365_COMPETITIONS } from '@/app/api/utils/scores365';

export const maxDuration = 60;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type LocalTeamStats = {
  team: string;
  league?: string;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  avgCornersFirstHalf?: number;
  avgCornersSecondHalf?: number;
  avgCornersHome?: number;
  avgCornersAway?: number;
  avgLast5?: number;
  last5Games?: number[];
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  gamesPlayed: number;
};

const STATS_SETS = [
  { label: 'Brasileirao Serie A', stats: teamStats as LocalTeamStats[] },
  { label: 'Copa Libertadores', stats: libertadoresTeamStats as LocalTeamStats[] },
  { label: 'Copa Sul-Americana', stats: sulAmericanaTeamStats as LocalTeamStats[] },
  { label: 'Champions League', stats: championsLeagueTeamStats as LocalTeamStats[] },
  { label: 'Europa League', stats: europaLeagueTeamStats as LocalTeamStats[] },
  { label: 'Conference League', stats: conferenceLeagueTeamStats as LocalTeamStats[] },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00ba\u00b0]/g, 'o')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function context(messages: ChatMessage[]): string {
  return messages
    .slice(-8)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function firstHalf(stats: LocalTeamStats): number {
  return stats.avgCornersFirstHalf ?? oneDecimal(stats.avgCornersFor * 0.46);
}

function secondHalf(stats: LocalTeamStats): number {
  return stats.avgCornersSecondHalf ?? oneDecimal(stats.avgCornersFor * 0.54);
}

function leagueAliases(label: string): string[] {
  const key = normalize(label);
  const aliases: Record<string, string[]> = {
    'brasileirao serie a': ['brasileirao', 'brasileiro', 'serie a'],
    'brasileirao serie b': ['serie b'],
    'copa libertadores': ['libertadores'],
    'copa sul-americana': ['sul americana', 'sudamericana'],
    'champions league': ['champions'],
    'europa league': ['europa league'],
    'conference league': ['conference'],
  };
  return unique([key, ...(aliases[key] ?? [])]);
}

function mentionsLeague(text: string, league: string): boolean {
  const normalized = normalize(text);
  return leagueAliases(league).some((alias) => normalized.includes(alias));
}

function latestMention(text: string, term: string): number {
  return normalize(text).lastIndexOf(normalize(term));
}

function allTeams(): string[] {
  return unique([
    ...STATS_SETS.flatMap((set) => set.stats.map((stats) => stats.team)),
    ...currentUpcomingMatches.flatMap((match) => [match.homeTeam, match.awayTeam]),
  ]);
}

function mentionedTeams(text: string): string[] {
  const normalized = normalize(text);
  return allTeams().filter((team) => normalized.includes(normalize(team)));
}

function latestTeams(text: string, limit = 2): string[] {
  return mentionedTeams(text)
    .map((name) => ({ name, pos: latestMention(text, name) }))
    .filter((team) => team.pos >= 0)
    .sort((a, b) => b.pos - a.pos)
    .slice(0, limit)
    .map((team) => team.name);
}

function askedCoverage(text: string): boolean {
  const normalized = normalize(text);
  return ['quais ligas', 'ligas disponiveis', 'dados locais', 'base local', 'dados temos local'].some((term) =>
    normalized.includes(term)
  );
}

function askedUpcoming(text: string): boolean {
  const normalized = normalize(text);
  return ['proximo jogo', 'proximos jogos', 'agenda', 'jogos futuros', 'oitavas', 'chaveamento'].some((term) =>
    normalized.includes(term)
  );
}

function askedStats(text: string): boolean {
  const normalized = normalize(text);
  if (askedAddedTime(text)) return false;
  if (normalized.includes('escanteio') || normalized.includes('corner')) return true;
  return normalized.includes('media') || normalized.includes('medias');
}

function askedCards(text: string): boolean {
  const normalized = normalize(text);
  return ['cartao', 'cartoes', 'juiz', 'arbitro'].some((term) => normalized.includes(term));
}

function askedAddedTime(text: string): boolean {
  const normalized = normalize(text);
  const compact = normalized.replace(/\s+/g, '');
  return [
    'acrescimo',
    'acrescimos',
    'acrecimo',
    'acrecimos',
    'acrecismo',
    'acrecismos',
    'tempo adicional',
    'tempo de acrescimo',
    'stoppage',
    'injury time',
  ].some((term) => normalized.includes(term)) || /acr[a-z]*scim/.test(compact);
}

function askedMatchPrediction(text: string): boolean {
  const normalized = normalize(text);
  if (askedAddedTime(text) || askedCards(text)) return false;
  return [
    'previsao do jogo',
    'previsao para o jogo',
    'previsao para o confronto',
    'previsao do confronto',
    'confronto entre os dois',
    'analise do jogo',
    'analise do confronto',
  ].some((term) => normalized.includes(term));
}

function requestedHalf(text: string): 'first' | 'second' | null {
  const normalized = normalize(text);
  if (['primeiro tempo', '1o tempo', '1 tempo', '1t', 'so no primeiro'].some((term) => normalized.includes(term))) {
    return 'first';
  }
  if (['segundo tempo', '2o tempo', '2 tempo', '2t', 'so no segundo'].some((term) => normalized.includes(term))) {
    return 'second';
  }
  return null;
}

function formatCatalog(): string {
  const grouped = Object.values(SCORES365_COMPETITIONS).reduce<Record<string, string[]>>((acc, competition) => {
    (acc[competition.country] ??= []).push(competition.name);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([country, leagues]) => `- ${country}: ${unique(leagues).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ')}.`)
    .join('\n');
}

function coverageReply(): string {
  const statsLines = STATS_SETS.map((set) => {
    const teams = unique(set.stats.map((stats) => stats.team));
    return `- ${set.label}: ${teams.length} times com media geral e por tempo.`;
  }).join('\n');

  return `Ligas integradas no app:\n\n${formatCatalog()}\n\nBases estatisticas carregadas:\n${statsLines}\n\nA IA tenta responder primeiro por esses dados locais. O Gemini so entra quando a pergunta pede interpretacao aberta ou quando o dado nao existe na base.`;
}

function formatStats(stats: LocalTeamStats, league: string, half: 'first' | 'second' | null): string {
  if (half === 'first') {
    return `${stats.team} na ${league}, somente no 1o tempo:\n\n- Media a favor no 1o tempo: ${firstHalf(stats)} escanteios.\n- Media total do jogo: ${stats.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${stats.avgCornersFor}.\n- Media contra no jogo: ${stats.avgCornersAgainst}.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
  }
  if (half === 'second') {
    return `${stats.team} na ${league}, somente no 2o tempo:\n\n- Media a favor no 2o tempo: ${secondHalf(stats)} escanteios.\n- Media total do jogo: ${stats.avgTotalCorners} escanteios.\n- Media a favor no jogo: ${stats.avgCornersFor}.\n- Media contra no jogo: ${stats.avgCornersAgainst}.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
  }

  const homeAway =
    stats.avgCornersHome !== undefined && stats.avgCornersAway !== undefined
      ? `\n- Casa/fora: ${stats.avgCornersHome} em casa e ${stats.avgCornersAway} fora.`
      : '';
  const last5 =
    stats.avgLast5 !== undefined && stats.last5Games
      ? `\n- Ultimos 5 jogos: media ${stats.avgLast5} (${stats.last5Games.join(', ')}).`
      : '';

  return `${stats.team} na ${league}:\n\n- Media a favor: ${stats.avgCornersFor} escanteios por jogo.\n- Media contra: ${stats.avgCornersAgainst} escanteios cedidos por jogo.\n- Total medio nos jogos: ${stats.avgTotalCorners} escanteios.\n- Por tempo: ${firstHalf(stats)} no 1o tempo e ${secondHalf(stats)} no 2o tempo.${homeAway}${last5}\n- Over 8.5: ${stats.over85Pct}% | Over 9.5: ${stats.over95Pct}% | Over 10.5: ${stats.over105Pct}%.\n- Amostra: ${stats.gamesPlayed} jogos analisados.`;
}

function bestStatsForTeam(
  team: string,
  question: string,
  combined: string
): { stats: LocalTeamStats; league: string; setLabel: string } | null {
  const candidates = STATS_SETS.flatMap((set) =>
    set.stats
      .filter((stats) => normalize(stats.team) === normalize(team))
      .map((stats) => ({ stats, setLabel: set.label, league: stats.league ?? set.label }))
  );
  if (candidates.length === 0) return null;

  return candidates
    .map((candidate) => {
      const direct = mentionsLeague(question, candidate.league) || mentionsLeague(question, candidate.setLabel);
      const leaguePos = Math.max(latestMention(combined, candidate.league), latestMention(combined, candidate.setLabel));
      return { ...candidate, score: (direct ? 1000 : 0) + Math.max(leaguePos, 0) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function overProbability(mean: number, threshold: number): number {
  const variance = 2.4;
  const zScore = (threshold - mean) / variance;
  const probability = 100 * (1 - 0.5 * (1 + Math.tanh(zScore * 0.8)));
  return Math.min(95, Math.max(5, Math.round(probability)));
}

function matchPredictionReply(question: string, ctx: string): string | null {
  if (!askedMatchPrediction(`${ctx} ${question}`)) return null;
  const combined = `${ctx} ${question}`;
  const teams = latestTeams(combined, 2).reverse();
  if (teams.length < 2) return 'Para montar a previsao do confronto, me diga os dois times do jogo.';

  const home = bestStatsForTeam(teams[0], question, combined);
  const away = bestStatsForTeam(teams[1], question, combined);
  if (!home || !away) {
    const missing = [!home ? teams[0] : null, !away ? teams[1] : null].filter(Boolean).join(' e ');
    return `Nao encontrei dados locais suficientes para montar a previsao do confronto. Faltou base estatistica para: ${missing}.`;
  }

  let homeExpected =
    ((home.stats.avgCornersHome ?? home.stats.avgCornersFor * 1.08) * 0.35) +
    ((home.stats.avgLast5 ?? home.stats.avgCornersFor) * 0.25) +
    (((home.stats.avgCornersFor * 1.08 + away.stats.avgCornersAgainst) / 2) * 0.4);
  let awayExpected =
    ((away.stats.avgCornersAway ?? away.stats.avgCornersFor * 0.92) * 0.35) +
    ((away.stats.avgLast5 ?? away.stats.avgCornersFor) * 0.25) +
    (((away.stats.avgCornersFor * 0.94 + home.stats.avgCornersAgainst) / 2) * 0.4);

  const h2h = getHeadToHead(home.stats.team, away.stats.team);
  if (h2h) {
    const adjustment = (h2h.avgTotalCorners - (homeExpected + awayExpected)) * 0.18;
    homeExpected += adjustment / 2;
    awayExpected += adjustment / 2;
  }

  const total = homeExpected + awayExpected;
  const homeFirstShare = home.stats.avgCornersFor > 0 ? firstHalf(home.stats) / home.stats.avgCornersFor : 0.46;
  const awayFirstShare = away.stats.avgCornersFor > 0 ? firstHalf(away.stats) / away.stats.avgCornersFor : 0.46;
  const first = homeExpected * homeFirstShare + awayExpected * awayFirstShare;
  const second = Math.max(0, total - first);
  const confidence = home.stats.gamesPlayed > 0 && away.stats.gamesPlayed > 0 ? 'alta' : 'media';
  const h2hLine = h2h ? `\n- H2H local: ${oneDecimal(h2h.avgTotalCorners)} escanteios de media.` : '';

  return `Previsao local para ${home.stats.team} x ${away.stats.team}:\n\n- Total previsto: ${oneDecimal(total)} escanteios.\n- 1o tempo: ${oneDecimal(first)} escanteios.\n- 2o tempo: ${oneDecimal(second)} escanteios.\n- Times: ${home.stats.team} ${oneDecimal(homeExpected)} x ${oneDecimal(awayExpected)} ${away.stats.team}.\n- Linhas: Over 8.5 ${overProbability(total, 8.5)}% | Over 9.5 ${overProbability(total, 9.5)}% | Over 10.5 ${overProbability(total, 10.5)}%.\n- Base: ${home.league} e ${away.league}; confianca ${confidence}.${h2hLine}`;
}

function addedTimeReply(question: string, ctx: string): string | null {
  if (!askedAddedTime(`${ctx} ${question}`)) return null;
  const teams = latestTeams(`${ctx} ${question}`, 2).reverse();
  const matchText = teams.length >= 2 ? ` para ${teams[0]} x ${teams[1]}` : '';

  return `Nao tenho previsao confiavel de acrescimos${matchText} na base local.\n\nO Radar Futebol informa esse tipo de dado pelos endpoints oficiais /api/eventos-live e /api/eventos-live-basico, mas exige token deles e a formula nao e publica. Como nao temos esse token configurado, removi a estimativa local de acrescimos para nao mostrar numero inventado.\n\nPosso responder escanteios, cartoes, juiz, proximos jogos e chaveamento quando esses dados existem na nossa base.`;
}

function statsReply(question: string, ctx: string): string | null {
  if (!askedStats(`${ctx} ${question}`)) return null;
  const combined = `${ctx} ${question}`;
  const team = mentionedTeams(combined)
    .map((name) => ({ name, pos: latestMention(combined, name) }))
    .sort((a, b) => b.pos - a.pos)[0]?.name;
  if (!team) return null;

  const best = bestStatsForTeam(team, question, combined);
  if (!best) return null;

  return formatStats(best.stats, best.league, requestedHalf(question));
}

function fixtureTime(match: CurrentFixture): number {
  const iso = match.date.includes(' ') ? `${match.date.replace(' ', 'T')}:00-03:00` : `${match.date}T12:00:00-03:00`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function matchLine(match: CurrentFixture): string {
  const date = match.dateLabel ?? match.date;
  const corners = match.predictedCorners ? ` | previsao: ${match.predictedCorners} escanteios` : '';
  const referee = match.referee ? ` | arbitro: ${match.referee}` : '';
  const returnLeg = match.returnLeg
    ? `\n  Volta: ${match.returnLeg.homeTeam} x ${match.returnLeg.awayTeam} (${match.returnLeg.dateLabel})`
    : '';
  const note = match.bracketNote ? `\n  ${match.bracketNote}` : '';
  return `- ${match.homeTeam} x ${match.awayTeam} (${date})${corners}${referee}${returnLeg}${note}`;
}

function upcomingMatches(question: string, ctx: string): CurrentFixture[] {
  const combined = `${ctx} ${question}`;
  const team = mentionedTeams(combined)
    .map((name) => ({ name, pos: latestMention(combined, name) }))
    .sort((a, b) => b.pos - a.pos)[0]?.name;

  return currentUpcomingMatches
    .filter((match) => fixtureTime(match) >= Date.now() - 12 * 60 * 60 * 1000)
    .filter((match) => {
      if (team && normalize(match.homeTeam) !== normalize(team) && normalize(match.awayTeam) !== normalize(team)) {
        return false;
      }
      if (mentionsLeague(combined, 'Copa Libertadores')) return normalize(match.competition).includes('libertadores');
      if (mentionsLeague(combined, 'Brasileirao Serie A')) return match.leagueKey === 'brasileirao_a';
      if (mentionsLeague(combined, 'Brasileirao Serie B')) return match.leagueKey === 'brasileirao_b';
      if (mentionsLeague(combined, 'Champions League')) return normalize(match.competition).includes('champions');
      return true;
    })
    .sort((a, b) => fixtureTime(a) - fixtureTime(b));
}

function libertadoresBracketReply(): string {
  const matches = currentUpcomingMatches.filter(
    (match) => normalize(match.competition).includes('libertadores') && normalize(match.round ?? '').includes('oitavas')
  );
  if (matches.length === 0) return 'Ainda nao tenho o chaveamento das oitavas da Libertadores na base local.';
  return `Oitavas de final da Copa Libertadores na base local:\n\n${matches.map(matchLine).join('\n')}`;
}

function upcomingReply(question: string, ctx: string): string | null {
  if (!askedUpcoming(`${ctx} ${question}`)) return null;
  const normalized = normalize(`${ctx} ${question}`);
  if (normalized.includes('oitavas') || normalized.includes('chaveamento')) return libertadoresBracketReply();

  const matches = upcomingMatches(question, ctx);
  if (matches.length === 0) return 'Nao encontrei proximos jogos para esse filtro na base local.';

  const limit = mentionedTeams(`${ctx} ${question}`).length > 0 ? 3 : 12;
  return `Proximos jogos encontrados na base local:\n\n${matches.slice(0, limit).map(matchLine).join('\n')}`;
}

function cardsReply(question: string, ctx: string): string | null {
  if (!askedCards(`${ctx} ${question}`)) return null;
  const match = upcomingMatches(question, ctx)[0];

  if (match?.referee) {
    const referee = findReferee(match.referee);
    const summary = referee ? getRefereeStatsSummary(referee) : null;
    const refereeLine = summary
      ? `${referee?.name}: ${summary.avgCardsPerMatch.toFixed(1)} cartoes/jogo; ${summary.secondHalfPct}% dos cartoes no 2o tempo; media ${summary.avgCardsWinning} vencendo, ${summary.avgCardsDrawing} empatando e ${summary.avgCardsLosing} perdendo.`
      : `${match.referee}: sem historico detalhado local.`;

    return `Previsao de cartoes para ${match.homeTeam} x ${match.awayTeam}:\n\n- Arbitro: ${refereeLine}\n- Jogo: ${match.dateLabel ?? match.date}.\n- Usei o juiz informado na agenda local e as medias locais dos times quando disponiveis.`;
  }

  const teams = mentionedTeams(`${ctx} ${question}`);
  if (teams.length === 0) return null;
  const lines = teams.slice(-2).map((team) => {
    const cards = findTeamCardStats(team);
    return cards ? `- ${team}: ${cards.avgCardsPerMatch} cartoes por jogo.` : `- ${team}: sem media local de cartoes.`;
  });
  return `Dados locais de cartoes:\n\n${lines.join('\n')}`;
}

function localReply(question: string, ctx: string): string | null {
  if (askedCoverage(question)) return coverageReply();
  return (
    addedTimeReply(question, ctx) ??
    upcomingReply(question, ctx) ??
    cardsReply(question, ctx) ??
    matchPredictionReply(question, ctx) ??
    statsReply(question, ctx)
  );
}

function fallbackReply(question: string, ctx: string): string {
  return (
    localReply(question, ctx) ??
    `${coverageReply()}\n\nNao encontrei uma resposta direta na base local. Tente citar time e competicao, por exemplo: "media do Fluminense na Libertadores no 1o tempo" ou "proximo jogo do Fluminense na Libertadores".`
  );
}

function geminiPrompt(): string {
  return `Voce e a IA da Cantos Estatisticas. Responda em portugues brasileiro.
Use primeiro os dados locais abaixo. Se o dado nao existir na base local, diga claramente.

${coverageReply()}

Agenda local:
${currentUpcomingMatches.map(matchLine).join('\n')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };
    const lastUser = messages?.slice().reverse().find((message) => message.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'Nenhuma mensagem de usuario encontrada' }, { status: 400 });
    }

    const ctx = context(messages);
    const local = localReply(lastUser.content, ctx);
    if (local) return NextResponse.json({ reply: local, provider: 'local-first' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: fallbackReply(lastUser.content, ctx), provider: 'local-fallback' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: geminiPrompt() }] },
          contents: messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: 2048, temperature: 0.35 },
        }),
      }
    );

    if (!response.ok) {
      const prefix =
        response.status === 429
          ? 'O Gemini gratuito atingiu o limite agora. Respondi com os dados locais do app.'
          : `O Gemini retornou erro ${response.status}. Respondi com os dados locais do app.`;
      return NextResponse.json({
        reply: `${prefix}\n\n${fallbackReply(lastUser.content, ctx)}`,
        provider: 'local-fallback',
      });
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return NextResponse.json({
      reply: data.candidates?.[0]?.content?.parts?.[0]?.text ?? fallbackReply(lastUser.content, ctx),
      provider: 'gemini',
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
