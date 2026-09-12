export type Identity = { id:number; eventKey?:string; source?:string; sourceIds?:{scores365?:number;sofascore?:number;apiFootball?:number}; competition?:string; kickoffAt?:string; homeTeam:{name:string};awayTeam:{name:string} };
export function aliases(match:Identity):string[]{
  const ids=Object.entries(match.sourceIds??{}).filter(([,id])=>Number.isSafeInteger(id)&&Number(id)>0).map(([provider,id])=>`${provider}:${id}`);
  if(!ids.length&&match.source)ids.push(`${match.source}:${match.id}`);
  return ids;
}
export function initialKey(match:Identity):string {
  if(match.eventKey)return match.eventKey;
  if(match.sourceIds?.scores365)return String(match.sourceIds.scores365);
  const keys=aliases(match); if(!keys.length)throw new Error('Partida sem identidade de provedor');
  return keys[0];
}
const name=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|club|clube|futebol)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
export function sameFixture(a:Identity,b:Identity):boolean {
  if(aliases(a).some(id=>aliases(b).includes(id)))return true;
  // Conflicting IDs from the same provider are never combined by fuzzy names.
  if(Object.keys(a.sourceIds??{}).some(k=>k in (b.sourceIds??{})))return false;
  if(!a.competition||!b.competition||name(a.competition)!==name(b.competition))return false;
  if(a.kickoffAt&&b.kickoffAt&&Math.abs(Date.parse(a.kickoffAt)-Date.parse(b.kickoffAt))>300000)return false;
  return name(a.homeTeam.name)===name(b.homeTeam.name)&&name(a.awayTeam.name)===name(b.awayTeam.name);
}
