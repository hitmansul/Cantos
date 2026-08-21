'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Clock3,
  CornerUpRight,
  RefreshCw,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

type TrendStatus = 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
type Pair = { home: number | null; away: number | null; total: number | null };
type Decision = 'OPORTUNIDADE' | 'ACOMPANHAR' | 'EVITAR' | 'COLETANDO';
type DecisionFilter = 'TODOS' | Decision;
type MinuteFilter = 'TODOS' | '0-15' | '16-30' | '31-45' | '46-60' | '61-75' | '76+';
type Confidence = 'Alta' | 'Média' | 'Baixa' | 'Insuficiente';

type Snapshot = {
  capturedAt: string | null;
  minute: number | string | null;
  homeScore: number;
  awayScore: number;
  corners: Pair;
  shots: Pair;
  dangerousAttacks: Pair;
};

type Trend = {
  status: TrendStatus;
  cornersDelta: number;
  shotsDelta: number;
  dangerousAttacksDelta: number;
  stoppedMinutesDelta: number;
};

type LiveMatch = {
  id: number;
  minute: number | string;
  competition: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  engineHistory: Snapshot[];
  engineTrend: Trend;
  engineUpdatedAt?: string;
};

type Intelligence = {
  score: number;
  nextCornerProbability: number | null;
  pressure: number | null;
  speed: number | null;
  confidence: Confidence;
  decision: Decision;
  explanation: string;
  ready: boolean;
};

const competitionExactPt: Record<string, string> = {
  'Friendly': 'Amistoso',
  'Friendlies': 'Amistosos',
  'Club Friendly': 'Amistoso de Clubes',
  'Challenge Cup': 'Copa Desafio',
  'UEFA Champions League (World)': 'Liga dos Campeões da UEFA (Mundial)',
  'UEFA Europa League (World)': 'Liga Europa da UEFA (Mundial)',
  'UEFA Europa Conference League (World)': 'Liga Conferência da UEFA (Mundial)',
  'Copa Sudamericana': 'Copa Sul-Americana',
};

const countriesPt: Record<string, string> = {
  'United Arab Emirates':'Emirados Árabes Unidos','Bosnia and Herzegovina':'Bósnia e Herzegovina',
  'Northern Ireland':'Irlanda do Norte','South Korea':'Coreia do Sul','South Africa':'África do Sul',
  'United States':'Estados Unidos','Saudi Arabia':'Arábia Saudita','New Zealand':'Nova Zelândia',
  'Czech Republic':'República Tcheca','Dominican Republic':'República Dominicana','Costa Rica':'Costa Rica',
  'Puerto Rico':'Porto Rico','North Macedonia':'Macedônia do Norte','Hong Kong':'Hong Kong',
  'Argentina':'Argentina','Australia':'Austrália','Austria':'Áustria','Belarus':'Bielorrússia','Belgium':'Bélgica',
  'Bolivia':'Bolívia','Brazil':'Brasil','Bulgaria':'Bulgária','Canada':'Canadá','Chile':'Chile','China':'China',
  'Colombia':'Colômbia','Croatia':'Croácia','Cyprus':'Chipre','Czechia':'República Tcheca','Denmark':'Dinamarca',
  'Ecuador':'Equador','Egypt':'Egito','England':'Inglaterra','Estonia':'Estônia','Finland':'Finlândia','France':'França',
  'Georgia':'Geórgia','Germany':'Alemanha','Greece':'Grécia','Hungary':'Hungria','Iceland':'Islândia','India':'Índia',
  'Indonesia':'Indonésia','Ireland':'Irlanda','Israel':'Israel','Italy':'Itália','Japan':'Japão','Kazakhstan':'Cazaquistão',
  'Latvia':'Letônia','Lithuania':'Lituânia','Mexico':'México','Moldova':'Moldávia','Montenegro':'Montenegro',
  'Netherlands':'Holanda','Norway':'Noruega','Paraguay':'Paraguai','Peru':'Peru','Poland':'Polônia','Portugal':'Portugal',
  'Romania':'Romênia','Russia':'Rússia','Scotland':'Escócia','Serbia':'Sérvia','Slovakia':'Eslováquia','Slovenia':'Eslovênia',
  'Spain':'Espanha','Sweden':'Suécia','Switzerland':'Suíça','Turkey':'Turquia','Türkiye':'Turquia','Ukraine':'Ucrânia',
  'Uruguay':'Uruguai','Venezuela':'Venezuela','Wales':'País de Gales','World':'Mundial','USA':'EUA'
};

function replaceCompetitionTerm(value: string, term: string, replacement: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(escaped, 'gi'), replacement);
}

function translateCompetition(value: string) {
  const original = value.trim();
  if (!original) return 'Competição';
  if (competitionExactPt[original]) return competitionExactPt[original];

  let result = original;
  for (const [country, translated] of Object.entries(countriesPt).sort((a, b) => b[0].length - a[0].length)) {
    result = replaceCompetitionTerm(result, country, translated);
  }

  const terms: Array<[RegExp, string]> = [
    [/UEFA Europa Conference League/gi, 'Liga Conferência da UEFA'],
    [/UEFA Champions League/gi, 'Liga dos Campeões da UEFA'],
    [/UEFA Europa League/gi, 'Liga Europa da UEFA'],
    [/Non League Premier\s*-\s*Southern Central/gi, 'Liga Premier Sul-Central'],
    [/Non League Premier\s*-\s*Southern South/gi, 'Liga Premier Sul'],
    [/Non League Premier\s*-\s*Northern/gi, 'Liga Premier do Norte'],
    [/Non League Premier\s*-\s*Isthmian/gi, 'Liga Premier Isthmian'],
    [/World Cup Qualification/gi, 'Eliminatórias da Copa do Mundo'],
    [/World Cup/gi, 'Copa do Mundo'],
    [/Champions League/gi, 'Liga dos Campeões'],
    [/Europa Conference League/gi, 'Liga Conferência Europa'],
    [/Conference League/gi, 'Liga Conferência'],
    [/Europa League/gi, 'Liga Europa'],
    [/Challenge Cup/gi, 'Copa Desafio'],
    [/Super Cup/gi, 'Supercopa'],
    [/Reserve League/gi, 'Liga de Reservas'],
    [/National League/gi, 'Liga Nacional'],
    [/Premier League/gi, 'Liga Principal'],
    [/League One/gi, 'Liga 1'],
    [/League Two/gi, 'Liga 2'],
    [/Regular Season/gi, 'Temporada Regular'],
    [/Regular Stage/gi, 'Fase Regular'],
    [/Group Stage/gi, 'Fase de Grupos'],
    [/Championship Round/gi, 'Rodada do Campeonato'],
    [/Relegation Round/gi, 'Rodada de Rebaixamento'],
    [/Promotion Round/gi, 'Rodada de Acesso'],
    [/Qualifying Round/gi, 'Rodada de Qualificação'],
    [/Extra Preliminary Round/gi, 'Rodada Pré-preliminar'],
    [/Preliminary Round/gi, 'Rodada Preliminar'],
    [/Round of 32/gi, '16-avos de final'],
    [/Round of 16/gi, 'Oitavas de final'],
    [/Quarter[- ]?finals?/gi, 'Quartas de final'],
    [/Semi[- ]?finals?/gi, 'Semifinais'],
    [/Finals?/gi, 'Final'],
    [/Play[- ]?offs?/gi, 'Mata-mata'],
    [/Qualification/gi, 'Qualificação'],
    [/Qualifiers/gi, 'Eliminatórias'],
    [/Qualifying/gi, 'Qualificatória'],
    [/Preliminary/gi, 'Preliminar'],
    [/First Phase/gi, 'Primeira Fase'],
    [/Second Phase/gi, 'Segunda Fase'],
    [/Third Phase/gi, 'Terceira Fase'],
    [/First Division/gi, '1ª Divisão'],
    [/Second Division/gi, '2ª Divisão'],
    [/Third Division/gi, '3ª Divisão'],
    [/Fourth Division/gi, '4ª Divisão'],
    [/\b1\. Division\b/gi, '1ª Divisão'],
    [/\b2\. Division\b/gi, '2ª Divisão'],
    [/\b3\. Division\b/gi, '3ª Divisão'],
    [/\b4\. Division\b/gi, '4ª Divisão'],
    [/\bDivision 1\b/gi, '1ª Divisão'],
    [/\bDivision 2\b/gi, '2ª Divisão'],
    [/\bDivision 3\b/gi, '3ª Divisão'],
    [/\bDivision 4\b/gi, '4ª Divisão'],
    [/\bU-?23\b/gi, 'Sub-23'],
    [/\bU-?21\b/gi, 'Sub-21'],
    [/\bU-?20\b/gi, 'Sub-20'],
    [/\bU-?19\b/gi, 'Sub-19'],
    [/\bU-?18\b/gi, 'Sub-18'],
    [/\bU-?17\b/gi, 'Sub-17'],
    [/\bWomen'?s?\b/gi, 'Feminina'],
    [/\bMen'?s?\b/gi, 'Masculina'],
    [/\bYouth\b/gi, 'Juvenil'],
    [/\bReserves?\b/gi, 'Reservas'],
    [/\bAmateur\b/gi, 'Amador'],
    [/\bPromotion\b/gi, 'Acesso'],
    [/\bRelegation\b/gi, 'Rebaixamento'],
    [/\bChampionship\b/gi, 'Campeonato'],
    [/\bLeague\b/gi, 'Liga'],
    [/\bCup\b/gi, 'Copa'],
    [/\bRound\b/gi, 'Rodada'],
    [/\bGroup\b/gi, 'Grupo'],
    [/\bStage\b/gi, 'Fase'],
    [/\bFriendly\b/gi, 'Amistoso'],
    [/\bFriendlies\b/gi, 'Amistosos'],
    [/\bNorth\b/gi, 'Norte'],
    [/\bSouth\b/gi, 'Sul'],
    [/\bEast\b/gi, 'Leste'],
    [/\bWest\b/gi, 'Oeste'],
  ];

  for (const [pattern, replacement] of terms) result = result.replace(pattern, replacement);
  return result.replace(/\s{2,}/g, ' ').replace(/\s+-\s+-\s+/g, ' - ').trim();
}

const trendLabels: Record<TrendStatus, string> = {
  accelerating: 'Acelerando',
  stable: 'Estável',
  cooling: 'Esfriando',
  'insufficient-data': 'Coletando histórico',
};

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pair(value: unknown): Pair {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const home = nullable(item.home);
  const away = nullable(item.away);
  const total = nullable(item.total) ?? (home !== null && away !== null ? home + away : null);
  return { home, away, total };
}

function trendStatus(value: unknown): TrendStatus {
  return value === 'accelerating' || value === 'stable' || value === 'cooling'
    ? value
    : 'insufficient-data';
}

function normalizeSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    capturedAt: typeof item.capturedAt === 'string' ? item.capturedAt : null,
    minute: typeof item.minute === 'string' || typeof item.minute === 'number' ? item.minute : null,
    homeScore: number(item.homeScore),
    awayScore: number(item.awayScore),
    corners: pair(item.corners ?? { home: item.homeCorners, away: item.awayCorners, total: item.totalCorners }),
    shots: pair(item.shots ?? { home: item.homeShots, away: item.awayShots }),
    dangerousAttacks: pair(item.dangerousAttacks ?? { home: item.homeDangerousAttacks, away: item.awayDangerousAttacks }),
  };
}

function normalizeMatch(value: unknown): LiveMatch | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const home = item.homeTeam && typeof item.homeTeam === 'object' ? item.homeTeam as Record<string, unknown> : null;
  const away = item.awayTeam && typeof item.awayTeam === 'object' ? item.awayTeam as Record<string, unknown> : null;
  const id = number(item.id, NaN);
  if (!home || !away || !Number.isFinite(id)) return null;

  const rawTrend = item.engineTrend && typeof item.engineTrend === 'object' ? item.engineTrend as Record<string, unknown> : {};
  const history = Array.isArray(item.engineHistory)
    ? item.engineHistory.map(normalizeSnapshot).filter((entry): entry is Snapshot => Boolean(entry))
    : [];
  const cornersRaw = item.corners && typeof item.corners === 'object' ? item.corners as Record<string, unknown> : null;

  return {
    id,
    minute: typeof item.minute === 'string' || typeof item.minute === 'number' ? item.minute : '—',
    competition: translateCompetition(typeof item.competition === 'string' ? item.competition : 'Competição'),
    homeTeam: { name: String(home.name ?? 'Mandante'), score: number(home.score) },
    awayTeam: { name: String(away.name ?? 'Visitante'), score: number(away.score) },
    corners: cornersRaw ? {
      home: number(cornersRaw.home),
      away: number(cornersRaw.away),
      total: number(cornersRaw.total, number(cornersRaw.home) + number(cornersRaw.away)),
    } : undefined,
    engineHistory: history,
    engineTrend: {
      status: trendStatus(rawTrend.pace ?? rawTrend.status),
      cornersDelta: pair(rawTrend.cornersDelta).total ?? number(rawTrend.cornersDelta),
      shotsDelta: pair(rawTrend.shotsDelta).total ?? number(rawTrend.shotsDelta),
      dangerousAttacksDelta: pair(rawTrend.dangerousAttacksDelta).total ?? number(rawTrend.dangerousAttacksDelta),
      stoppedMinutesDelta: number(rawTrend.stoppedMinutesDelta),
    },
    engineUpdatedAt: typeof item.engineUpdatedAt === 'string' ? item.engineUpdatedAt : undefined,
  };
}

function textKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchKey(match: LiveMatch) {
  return `${textKey(match.competition)}|${textKey(match.homeTeam.name)}|${textKey(match.awayTeam.name)}`;
}

function dedupeMatches(matches: LiveMatch[]) {
  const map = new Map<string, LiveMatch>();
  for (const match of matches) {
    const key = matchKey(match);
    const current = map.get(key);
    if (!current) {
      map.set(key, match);
      continue;
    }
    const currentQuality = current.engineHistory.length * 10 + (current.corners ? 5 : 0);
    const nextQuality = match.engineHistory.length * 10 + (match.corners ? 5 : 0);
    if (nextQuality >= currentQuality) map.set(key, match);
  }
  return [...map.values()];
}

function minuteNumber(value: number | string | null) {
  const match = String(value ?? '').match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  return match ? number(match[1]) + number(match[2]) : 0;
}

function minuteLabel(value: number | string) {
  const text = String(value);
  return text.includes("'") ? text : `${text}'`;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date);
}

function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }

function hasUsefulStatistics(match: LiveMatch) {
  const latest = match.engineHistory.at(-1);
  return match.corners?.total !== undefined
    || latest?.corners.total !== null
    || latest?.shots.total !== null
    || latest?.dangerousAttacks.total !== null;
}

function calculateIntelligence(match: LiveMatch): Intelligence {
  const minute = minuteNumber(match.minute);
  const history = match.engineHistory;
  const ready = history.length >= 3 && hasUsefulStatistics(match) && match.engineTrend.status !== 'insufficient-data';
  if (!ready) return {
    score: 0, nextCornerProbability: null, pressure: null, speed: null,
    confidence: 'Insuficiente', decision: 'COLETANDO', ready: false,
    explanation: 'Ainda não há histórico e estatísticas suficientes para classificar este jogo com segurança.',
  };

  const latest = history.at(-1);
  const corners = match.corners?.total ?? latest?.corners.total ?? 0;
  const recentCorners = Math.max(match.engineTrend.cornersDelta, 0);
  const recentShots = Math.max(match.engineTrend.shotsDelta, 0);
  const recentDangerous = Math.max(match.engineTrend.dangerousAttacksDelta, 0);
  const hasCorners = match.corners?.total !== undefined || latest?.corners.total !== null;
  const hasShots = latest?.shots.total !== null;
  const hasDangerousAttacks = latest?.dangerousAttacks.total !== null;
  const statisticalCoverage = Number(hasCorners) + Number(hasShots) + Number(hasDangerousAttacks);
  const pressure = Math.min(100, Math.round(recentDangerous * 8 + recentShots * 7 + recentCorners * 16 + (match.engineTrend.status === 'accelerating' ? 25 : match.engineTrend.status === 'stable' ? 12 : 2)));
  const speed = Math.min(100, Math.round(recentCorners * 22 + recentShots * 10 + recentDangerous * 5 + (match.engineTrend.status === 'accelerating' ? 28 : match.engineTrend.status === 'stable' ? 14 : 3)));
  const minuteWindow = minute >= 50 && minute <= 88 ? 16 : minute >= 20 && minute < 50 ? 9 : 2;
  const score = Math.max(0, Math.min(100, Math.round(Math.min(corners * 2.2, 22) + Math.min(history.length * 2.2, 18) + pressure * 0.22 + speed * 0.18 + minuteWindow)));
  const nextCornerProbability = Math.max(8, Math.min(92, Math.round(18 + pressure * 0.32 + speed * 0.22 + Math.min(corners, 12) * 1.4 + minuteWindow * 0.5)));
  const confidence: Confidence = statisticalCoverage === 3 && history.length >= 6
    ? 'Alta'
    : statisticalCoverage >= 2 && history.length >= 4
      ? 'Média'
      : 'Baixa';
  const decision: Decision = score >= 72 ? 'OPORTUNIDADE' : score >= 46 ? 'ACOMPANHAR' : 'EVITAR';
  const limitedCoverage = statisticalCoverage < 2;
  const explanation = limitedCoverage
    ? 'A leitura usa principalmente escanteios e histórico recente. Faltam estatísticas ofensivas para aumentar a confiança da recomendação.'
    : pressure >= 65
      ? 'O jogo está pressionando e criando ações ofensivas. Há sinais favoráveis para um novo escanteio.'
      : match.engineTrend.status === 'cooling'
        ? 'O ritmo caiu nos últimos registros. Neste momento, a tendência de novo escanteio enfraqueceu.'
        : 'O jogo tem atividade, mas ainda não há força suficiente para indicar entrada. Continue acompanhando.';
  return { score, nextCornerProbability, pressure, speed, confidence, decision, explanation, ready: true };
}

function scoreClass(score: number, ready = true) {
  if (!ready) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  if (score >= 72) return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  if (score >= 46) return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
  return 'border-border bg-background/50 text-muted-foreground';
}

function decisionClass(decision: Decision) {
  if (decision === 'OPORTUNIDADE') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  if (decision === 'ACOMPANHAR') return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
  if (decision === 'COLETANDO') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border bg-background/50 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function TrendIcon({ value }: { value: TrendStatus }) {
  if (value === 'accelerating') return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (value === 'cooling') return <TrendingDown className="h-4 w-4 text-amber-400" />;
  return <Activity className="h-4 w-4 text-cyan-400" />;
}

function MatchDetails({ match, lastUpdated }: { match: LiveMatch; lastUpdated: string | null }) {
  const history = match.engineHistory;
  const first = history[0];
  const latest = history.at(-1);
  const intelligence = calculateIntelligence(match);
  const hasCorners = match.corners?.total !== undefined || latest?.corners.total !== null;
  const hasShots = latest?.shots.total !== null;
  const hasDangerousAttacks = latest?.dangerousAttacks.total !== null;
  return <div className="space-y-4">
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><p className="text-sm text-muted-foreground">{match.competition}</p><h2 className="mt-1 text-2xl font-black">{match.homeTeam.name} x {match.awayTeam.name}</h2><p className="mt-1 text-sm text-muted-foreground">Última leitura: {formatTime(match.engineUpdatedAt || lastUpdated)}</p></div>
        <div className="flex flex-wrap gap-2"><div className={`rounded-xl border px-4 py-3 text-center ${scoreClass(intelligence.score, intelligence.ready)}`}><p className="text-xs">Força da oportunidade</p><p className="text-2xl font-black">{intelligence.ready ? intelligence.score : '—'}</p></div><div className="rounded-xl bg-emerald-500/10 px-5 py-3 text-center"><p className="text-xs text-muted-foreground">Placar · minuto</p><p className="text-2xl font-black">{match.homeTeam.score}–{match.awayTeam.score} · {minuteLabel(match.minute)}</p></div></div>
      </div>
    </section>
    <section className={`rounded-2xl border p-5 ${decisionClass(intelligence.decision)}`}>
      <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" /><h3 className="text-lg font-black">Recomendação da IA · {intelligence.decision}</h3></div>
      <p className="mt-2 text-sm opacity-90">{intelligence.explanation}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Chance de novo escanteio" value={intelligence.nextCornerProbability === null ? '—' : `${intelligence.nextCornerProbability}%`} /><Metric label="Pressão do jogo" value={intelligence.pressure === null ? '—' : `${intelligence.pressure}/100`} /><Metric label="Intensidade recente" value={intelligence.speed === null ? '—' : `${intelligence.speed}/100`} /><Metric label="Confiabilidade da leitura" value={intelligence.confidence} /></div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Leituras registradas" value={history.length} /><Metric label="Escanteios atuais" value={match.corners?.total ?? '—'} /><Metric label="Acompanhamento iniciado" value={formatTime(first?.capturedAt)} /><Metric label="Dados mais recentes" value={formatTime(latest?.capturedAt)} /></section>
    <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-400" /><h3 className="text-lg font-bold">O que mudou nos últimos 10 minutos</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Tendência atual</p><p className="mt-1 flex items-center gap-2 text-lg font-bold"><TrendIcon value={match.engineTrend.status} />{trendLabels[match.engineTrend.status]}</p></div><Metric label="Novos escanteios" value={hasCorners ? signed(match.engineTrend.cornersDelta) : '—'} /><Metric label="Novas finalizações" value={hasShots ? signed(match.engineTrend.shotsDelta) : '—'} /><Metric label="Novos ataques perigosos" value={hasDangerousAttacks ? signed(match.engineTrend.dangerousAttacksDelta) : '—'} /><Metric label="Tempo de jogo parado" value={`${match.engineTrend.stoppedMinutesDelta.toFixed(1)} min`} /></div></section>
    <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-cyan-400" /><h3 className="text-lg font-bold">Evolução do jogo</h3></div><div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{[...history].reverse().map((item, index) => <div key={`${item.capturedAt ?? 'snapshot'}-${index}`} className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-[90px_80px_repeat(4,minmax(0,1fr))] sm:items-center"><span className="text-xs text-muted-foreground">{formatTime(item.capturedAt)}</span><span className="font-bold">{minuteLabel(item.minute ?? '—')}</span><span className="flex items-center gap-1 text-sm"><Target className="h-4 w-4" />{item.homeScore}–{item.awayScore}</span><span className="flex items-center gap-1 text-sm"><CornerUpRight className="h-4 w-4 text-amber-400" />{item.corners.total ?? '—'}</span><span className="text-sm">Finalizações: {item.shots.total ?? '—'}</span><span className="text-sm">Ataques perigosos: {item.dangerousAttacks.total ?? '—'}</span></div>)}{history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum snapshot registrado ainda.</p>}</div></section>
  </div>;
}

function matchesMinuteFilter(match: LiveMatch, filter: MinuteFilter) {
  if (filter === 'TODOS') return true;
  const minute = minuteNumber(match.minute);
  if (filter === '0-15') return minute <= 15;
  if (filter === '16-30') return minute >= 16 && minute <= 30;
  if (filter === '31-45') return minute >= 31 && minute <= 45;
  if (filter === '46-60') return minute >= 46 && minute <= 60;
  if (filter === '61-75') return minute >= 61 && minute <= 75;
  return minute >= 76;
}

export default function LiveHistoryPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<LiveMatch | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortByScore, setSortByScore] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('TODOS');
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('TODAS');
  const [minuteFilter, setMinuteFilter] = useState<MinuteFilter>('TODOS');
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const suffix = manual ? '&refresh=1' : '';
      const response = await fetch(`/api/live/central?history=summary&t=${Date.now()}${suffix}`, { cache: 'no-store', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao atualizar histórico ao vivo');
      const normalized = Array.isArray(data.matches) ? data.matches.map(normalizeMatch).filter((item): item is LiveMatch => Boolean(item)) : [];
      const next = dedupeMatches(normalized);
      let selectedDetail: LiveMatch | null = null;
      if (selectedKey) {
        const selectedMatch = next.find(match => matchKey(match) === selectedKey);
        if (selectedMatch) {
          try {
            const detailResponse = await fetch(`/api/live/central?history=compact&matchId=${selectedMatch.id}&t=${Date.now()}`, { cache: 'no-store', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
            if (detailResponse.ok) {
              const detailData = await detailResponse.json() as Record<string, unknown>;
              const detailRaw = Array.isArray(detailData.matches) ? detailData.matches[0] : null;
              const detail = normalizeMatch(detailRaw);
              if (detail && matchKey(detail) === selectedKey) selectedDetail = detail;
            }
          } catch (detailReason) {
            if (detailReason instanceof DOMException && detailReason.name === 'AbortError') throw detailReason;
          }
        }
      }
      setMatches(next);
      setLastUpdated(typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString());
      setSelectedSnapshot(current => {
        if (!selectedKey) return current;
        return selectedDetail ?? next.find(match => matchKey(match) === selectedKey) ?? current;
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Erro desconhecido');
    } finally {
      if (requestRef.current === controller) { setInitialLoading(false); setRefreshing(false); }
    }
  }, [selectedKey]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 25_000);
    return () => { window.clearInterval(timer); requestRef.current?.abort(); };
  }, [load]);

  const intelligenceByKey = useMemo(() => new Map(matches.map(match => [matchKey(match), calculateIntelligence(match)] as const)), [matches]);
  const decisionCounts = useMemo(() => {
    const counts: Record<DecisionFilter, number> = { TODOS: matches.length, OPORTUNIDADE: 0, ACOMPANHAR: 0, EVITAR: 0, COLETANDO: 0 };
    for (const match of matches) counts[intelligenceByKey.get(matchKey(match))?.decision ?? 'COLETANDO'] += 1;
    return counts;
  }, [matches, intelligenceByKey]);

  const visibleMatches = useMemo(() => {
    const query = textKey(search);
    const filtered = matches.filter(match => {
      const intelligence = intelligenceByKey.get(matchKey(match)) ?? calculateIntelligence(match);
      if (decisionFilter !== 'TODOS' && intelligence.decision !== decisionFilter) return false;
      if (leagueFilter !== 'TODAS' && !textKey(match.competition).includes(textKey(leagueFilter))) return false;
      if (!matchesMinuteFilter(match, minuteFilter)) return false;
      if (query) {
        const haystack = textKey(`${match.homeTeam.name} ${match.awayTeam.name} ${match.competition}`);
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    if (!sortByScore) return filtered;
    return [...filtered].sort((a, b) => (intelligenceByKey.get(matchKey(b))?.score ?? 0) - (intelligenceByKey.get(matchKey(a))?.score ?? 0));
  }, [matches, intelligenceByKey, decisionFilter, leagueFilter, minuteFilter, search, sortByScore]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedSnapshot && matchKey(selectedSnapshot) === selectedKey) return selectedSnapshot;
    return matches.find(match => matchKey(match) === selectedKey) ?? null;
  }, [matches, selectedKey, selectedSnapshot]);

  const selectMatch = useCallback((match: LiveMatch) => {
    const key = matchKey(match);
    setSelectedKey(current => {
      if (current === key) {
        setSelectedSnapshot(null);
        return null;
      }
      setSelectedSnapshot(match);
      return key;
    });
  }, []);

  const resetExtraFilters = () => { setSearch(''); setLeagueFilter('TODAS'); setMinuteFilter('TODOS'); };
  const hasExtraFilters = Boolean(search) || leagueFilter !== 'TODAS' || minuteFilter !== 'TODOS';
  const filterLabel = (filter: DecisionFilter) => filter === 'TODOS' ? 'Todos' : filter.charAt(0) + filter.slice(1).toLowerCase();

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-emerald-400">Motor Central Ao Vivo</p><h1 className="mt-1 text-3xl font-black">Histórico e ritmo das partidas</h1><p className="mt-2 text-sm text-muted-foreground">Evolução registrada automaticamente a cada atualização do motor.</p></div><div className="flex flex-col items-stretch gap-2 md:items-end"><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-muted disabled:cursor-wait disabled:opacity-70"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Atualizando...' : 'Atualizar'}</button><span className="text-xs text-muted-foreground">Última atualização: {formatTime(lastUpdated)}</span></div></section>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="max-h-none space-y-3 overflow-visible rounded-2xl border border-border bg-card p-3 lg:max-h-[76vh] lg:overflow-auto">
        <div className="space-y-3 px-2">
          <div className="flex items-center justify-between gap-2"><div><span className="font-bold">Jogos monitorados</span><span className="ml-2 text-xs text-muted-foreground">{matches.length} ao vivo</span></div><button onClick={() => setSortByScore(value => !value)} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${sortByScore ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-border text-muted-foreground'}`}>{sortByScore ? 'Maior força primeiro' : 'Ordenar por força'}</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">{(['TODOS', 'OPORTUNIDADE', 'ACOMPANHAR', 'EVITAR', 'COLETANDO'] as DecisionFilter[]).map(filter => <button key={filter} type="button" onClick={() => setDecisionFilter(filter)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${decisionFilter === filter ? (filter === 'TODOS' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : decisionClass(filter)) : 'border-border text-muted-foreground'}`}>{filterLabel(filter)} · {decisionCounts[filter]}</button>)}</div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar time ou campeonato..." className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm outline-none focus:border-emerald-500" />{search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={leagueFilter === 'TODAS' ? '' : leagueFilter} onChange={event => setLeagueFilter(event.target.value || 'TODAS')} placeholder="Filtrar liga/campeonato..." className="w-full min-w-0 rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-xs outline-none focus:border-emerald-500" />{leagueFilter !== 'TODAS' && <button type="button" aria-label="Limpar filtro de liga" onClick={() => setLeagueFilter('TODAS')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}</div>
  <select value={minuteFilter} onChange={event => setMinuteFilter(event.target.value as MinuteFilter)} className="w-full rounded-xl border border-border bg-background px-2 py-2.5 text-xs"><option value="TODOS">Qualquer minuto</option><option value="0-15">0–15 min</option><option value="16-30">16–30 min</option><option value="31-45">31–45 min</option><option value="46-60">46–60 min</option><option value="61-75">61–75 min</option><option value="76+">76+ min</option></select>
</div>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{visibleMatches.length} jogo(s) encontrado(s)</span>{hasExtraFilters && <button type="button" onClick={resetExtraFilters} className="font-semibold text-emerald-400">Limpar busca</button>}</div>
        </div>

        {selected && <div className="lg:hidden rounded-2xl border border-emerald-500/30 bg-background/70 p-2"><div className="mb-2 flex justify-end"><button type="button" onClick={() => selectMatch(selected)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"><X className="h-4 w-4" />Fechar jogo</button></div><MatchDetails match={selected} lastUpdated={lastUpdated} /></div>}

        {matches.length === 0 && !initialLoading && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma partida disponível neste momento.</p>}
        {matches.length > 0 && visibleMatches.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum jogo corresponde aos filtros selecionados.</p>}
        {visibleMatches.map(match => {
          const key = matchKey(match);
          const intelligence = intelligenceByKey.get(key) ?? calculateIntelligence(match);
          const isSelected = key === selectedKey;
          return <div key={key} className="space-y-3"><button type="button" onClick={() => selectMatch(match)} className={`w-full rounded-xl border p-3 text-left transition ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:bg-muted/50'}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{match.competition}</span><span className="text-xs font-semibold text-emerald-400">{minuteLabel(match.minute)}</span></div><div className="mt-2 flex items-start justify-between gap-3"><p className="font-bold">{match.homeTeam.name} x {match.awayTeam.name}</p><span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-black ${scoreClass(intelligence.score, intelligence.ready)}`}>Força {intelligence.ready ? intelligence.score : '—'}</span></div><div className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{match.homeTeam.score}–{match.awayTeam.score}</span><span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${decisionClass(intelligence.decision)}`}>{intelligence.decision}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><TrendIcon value={match.engineTrend.status} />{trendLabels[match.engineTrend.status]}</span></div></button></div>;
        })}
      </div>

      <div className="hidden space-y-4 lg:block">{!selected ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Selecione uma partida para acompanhar.</div> : <MatchDetails match={selected} lastUpdated={lastUpdated} />}</div>
    </section>
  </main>;
}
