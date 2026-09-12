/** Shared contract: the server evaluates; all consumers display the same versioned result. */
export const MODEL_VERSION = 'live-heuristic-v2';
export const PROTOCOL_VERSION = 'observed-corner-wall-clock-v2';
export const MAX_AGE_MS = 180_000;
export const MAX_GAP_MS = 90_000;
export type Pair = { home: number | null; away: number | null; total: number | null };
export type Sample = {
  capturedAt: string; minute: number | string; minuteNumber: number | null;
  corners: Pair; shots: Pair; dangerousAttacks: Pair; shotsOnTarget?: Pair;
  statsSource?: string; sourceObservedAt?: string; quality?: string;
};
export type Assessment = {
  ready: boolean; decision: 'COLETANDO' | 'ACOMPANHAR' | 'EVITAR' | 'OPORTUNIDADE';
  score: number; probability: number | null; nextCornerProbability: number | null;
  pressure: number | null; speed: number | null;
  confidence: 'Insuficiente' | 'Baixa' | 'Média' | 'Alta'; explanation: string;
  modelVersion: string; protocolVersion: string; probabilityHorizonMinutes: 10;
  evaluatedAt: string; baselineAt: string | null; evaluationKey: string;
};
export function nullable(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function minuteNumber(value: unknown): number | null {
  const m = String(value ?? '').match(/^(\d{1,3})(?::\d{2})?(?:\s*\+\s*(\d{1,2}))?/);
  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
}
export function total(value?: Partial<Pair>): number | null {
  if (!value) return null;
  const t = nullable(value.total), h = nullable(value.home), a = nullable(value.away);
  return t ?? (h !== null && a !== null ? h + a : null);
}
export function collecting(reason = 'Aguardando histórico recente e estatísticas suficientes.'): Assessment {
  return { ready:false, decision:'COLETANDO', score:0, probability:null, nextCornerProbability:null,
    pressure:null, speed:null, confidence:'Insuficiente', explanation:reason, modelVersion:MODEL_VERSION,
    protocolVersion:PROTOCOL_VERSION, probabilityHorizonMinutes:10, evaluatedAt:'', baselineAt:null, evaluationKey:'' };
}
export function recentHistory(history:Sample[],now:number):Sample[] {
  const sorted=history.filter(s=>Number.isFinite(Date.parse(s.capturedAt))&&Date.parse(s.capturedAt)<=now).sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
  const anchor=Date.parse(sorted.at(-1)?.capturedAt??'');
  return sorted.filter(s=>anchor-Date.parse(s.capturedAt)<=600000);
}
export function analyticalHistory(history: Sample[], now: number): Sample[] {
  // Confidence uses distinct game minutes; continuity is checked against ALL observations.
  const byMinute = new Map<number, Sample>();
  for(const s of recentHistory(history,now)) { const minute=minuteNumber(s.minute);if(minute!==null)byMinute.set(minute,s); }
  return [...byMinute.values()].sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
}
export function trend(history: Sample[]) {
  const empty = { pace:'insufficient-data', samples:history.length, windowMinutes:10,
    cornersDelta:0, shotsDelta:0, dangerousAttacksDelta:0, stoppedMinutesDelta:0 };
  if (history.length < 3) return empty;
  const first=history[0], last=history.at(-1)!;
  const duration=(Date.parse(last.capturedAt)-Date.parse(first.capturedAt))/60_000;
  const span=(minuteNumber(last.minute)??0)-(minuteNumber(first.minute)??0);
  if (duration<2.5 || span<0) return empty;
  let available=0, activity=0;
  const deltas={cornersDelta:0,shotsDelta:0,dangerousAttacksDelta:0};
  for (const [metric,key,weight] of [['corners','cornersDelta',3],['shots','shotsDelta',1],['dangerousAttacks','dangerousAttacksDelta',0.25]] as const) {
    const a=total(first[metric]), b=total(last[metric]);
    if(a===null||b===null) continue;
    if(b<a) return empty;
    available+=weight; deltas[key]=b-a; activity+=(b-a)*weight;
  }
  if(!available)return empty;
  activity*=4.25/available;
  return {...empty,...deltas,pace:activity>=8?'accelerating':activity<=1?'cooling':'stable'};
}
export function assess(eventKey: string, history: Sample[], observedAt: string | undefined, now=Date.now()): Assessment {
  const empty=collecting(); const latestAt=Date.parse(observedAt??'');
  if(!Number.isFinite(latestAt)||latestAt>now||now-latestAt>MAX_AGE_MS) return collecting('Leitura desatualizada. Aguardando nova coleta.');
  const h=analyticalHistory(history,now), latest=h.at(-1);
  if(!latest||now-Date.parse(latest.capturedAt)>MAX_AGE_MS) return empty;
  const observations=recentHistory(history,now);
  for(let i=0;i<observations.length;i++) {
    const s=observations[i], prev=observations[i-1];
    if(s.quality!=='verified'||!s.statsSource) return collecting('Cobertura ainda não validada.');
    if(prev && (s.statsSource!==prev.statsSource || Date.parse(s.capturedAt)-Date.parse(prev.capturedAt)>MAX_GAP_MS || (minuteNumber(s.minute)??0)<(minuteNumber(prev.minute)??0))) return collecting('Histórico descontínuo ou mudança de fonte.');
    for(const metric of ['corners','shots','dangerousAttacks'] as const) {
      const a=total(prev?.[metric]),b=total(s[metric]);
      if(a!==null&&b!==null&&b<a)return collecting('Correção de estatísticas detectada. Aguardando nova janela.');
    }
  }
  const t=trend(h); if(t.pace==='insufficient-data')return empty;
  const corners=total(latest.corners);
  if(corners===null||!Number.isInteger(corners))return collecting('Aguardando contagem de escanteios verificável.');
  const coverage=[latest.corners,latest.shots,latest.dangerousAttacks].filter(p=>total(p)!==null).length;
  if(!coverage)return empty;
  const recentCorners=t.cornersDelta,recentShots=t.shotsDelta,recentDangerous=t.dangerousAttacksDelta;
  const boost=t.pace==='accelerating'?24:t.pace==='stable'?11:-8;
  const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
  const pressure=clamp(recentDangerous*7+recentShots*8+recentCorners*20+boost);
  const speed=clamp(recentCorners*24+recentShots*11+recentDangerous*4+boost);
  const minute=minuteNumber(latest.minute)??0;
  const minuteWindow=minute>=55&&minute<=88?12:minute>=25&&minute<55?7:1;
  const activity=Math.min(30,recentCorners*10+recentShots*3+recentDangerous*1.5);
  const context=Math.min(10,corners*0.8)+Math.min(8,h.length*1.2);
  const penalty=t.pace==='cooling'&&recentCorners===0&&recentShots===0?12:0;
  const score=clamp(pressure*0.28+speed*0.24+activity+context+minuteWindow-penalty);
  const probability=clamp(12+pressure*0.34+speed*0.26+recentCorners*5+minuteWindow*0.45-penalty*0.5,8,92);
  const confidence=coverage===3&&h.length>=6?'Alta':coverage>=2&&h.length>=4?'Média':'Baixa';
  const decision=score>=72&&probability>=60&&(confidence==='Média'||confidence==='Alta')?'OPORTUNIDADE':score>=46?'ACOMPANHAR':'EVITAR';
  return {...empty,ready:true,score,probability,nextCornerProbability:probability,pressure,speed,confidence,decision,
    explanation:decision==='OPORTUNIDADE'?'Sinais recentes favoráveis; estimativa heurística para os próximos 10 minutos.':confidence==='Baixa'?'Cobertura limitada. Continue acompanhando.':'Os sinais ainda não atingem os critérios conservadores de oportunidade.',
    evaluatedAt:latest.capturedAt,baselineAt:latest.capturedAt,evaluationKey:`${MODEL_VERSION}:${eventKey}:${latest.capturedAt}`};
}
