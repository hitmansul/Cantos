import { MAX_GAP_MS, total, type Sample } from './intelligence';
export type Outcome='pending'|'hit'|'miss'|'inconclusive';
export type Observation={at:string;corners:number|null;source:string;quality:string};
export function observation(s:Sample):Observation{return{at:s.capturedAt,corners:total(s.corners),source:s.statsSource??'',quality:s.quality??'unknown'};}
/** Cumulative counters bracket an event; an increase first seen AFTER a deadline is NOT a hit. */
export function resolveWindow(start:string,before:number,source:string,samples:Observation[],minutes:5|10,now:number):{outcome:Outcome;reason:string;observedAt?:string}{
  const begin=Date.parse(start),end=begin+minutes*60000;
  if(!Number.isFinite(begin)||!Number.isInteger(before)||before<0)return{outcome:'inconclusive',reason:'invalid-baseline'};
  if(now<end)return{outcome:'pending',reason:'window-open'};
  let previousAt=begin,previousCorners=before;
  for(const s of [...samples].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
    const at=Date.parse(s.at);
    if(!Number.isFinite(at)||at<=begin||at>now)continue;
    if(s.source!==source||s.quality!=='verified'||s.corners===null||!Number.isInteger(s.corners)||s.corners<previousCorners||at-previousAt>MAX_GAP_MS)return{outcome:'inconclusive',reason:'coverage-gap-or-source-correction'};
    if(s.corners>before){
      return at<=end?{outcome:'hit',reason:'increase-observed-inside-window',observedAt:s.at}:{outcome:'inconclusive',reason:'increase-straddles-deadline',observedAt:s.at};
    }
    if(at>=end)return{outcome:'miss',reason:'unchanged-counter-covers-deadline',observedAt:s.at};
    previousAt=at;previousCorners=s.corners;
  }
  return now<end+MAX_GAP_MS?{outcome:'pending',reason:'awaiting-boundary-observation'}:{outcome:'inconclusive',reason:'missing-boundary-observation'};
}
