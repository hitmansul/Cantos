// @vitest-environment node
import { it,expect } from 'vitest';
import { assess,nullable,total,minuteNumber,type Sample } from './intelligence';
import { resolveWindow,type Observation } from './outcomes';
import { initialKey,sameFixture } from './identity';
const start=Date.parse('2026-09-11T12:00:00Z');
const at=(m:number)=>new Date(start+m*60000).toISOString();
const pair=(n:number|null)=>({home:n,away:n===null?null:0,total:n});
const samples:Sample[]=Array.from({length:6},(_,i)=>({capturedAt:at(i),minute:60+i,minuteNumber:60+i,corners:pair(4+i),shots:pair(10+i*2),dangerousAttacks:pair(null),statsSource:'365scores',quality:'verified'}));
const obs=(m:number,n=4,source='365scores'):Observation=>({at:at(m),corners:n,source,quality:'verified'});
it('analyzes without dangerous attacks and keeps conservative thresholds',()=>{const a=assess('42',samples,at(5),start+5*60000);expect(a.decision).toBe('OPORTUNIDADE');expect(a.score).toBeGreaterThanOrEqual(72);expect(a.probability).toBeGreaterThanOrEqual(60);expect(a.confidence).toBe('Média');});
it('is deterministic for the same snapshot while fresh',()=>{expect(assess('42',samples,at(5),start+5*60000)).toEqual(assess('42',samples,at(5),start+5*60000+20000));});
it('rejects stale, incomplete, corrected and mixed source histories',()=>{
 expect(assess('42',samples,at(5),start+9*60000).ready).toBe(false);
 for(const change of [{quality:'unknown'},{statsSource:'api-football'},{corners:pair(0)}]){const h=samples.map(s=>({...s}));h[3]={...h[3],...change};expect(assess('42',h,at(5),start+5*60000).ready).toBe(false);}
 expect(assess('42',[samples[0],...samples.slice(3)],at(5),start+5*60000).ready).toBe(false);
});
it('preserves missing counters and parses stoppage minutes',()=>{expect(nullable(null)).toBeNull();expect(total(pair(null))).toBeNull();expect(minuteNumber('45+2')).toBe(47);});
it('keeps an open window pending',()=>expect(resolveWindow(at(0),4,'365scores',[obs(1,5)],5,start+4*60000).outcome).toBe('pending'));
it('counts an increase inside five minutes',()=>expect(resolveWindow(at(0),4,'365scores',[obs(1),obs(2,5)],5,start+10*60000).outcome).toBe('hit'));
it('distinguishes a six-minute corner across both windows',()=>{const h=Array.from({length:10},(_,i)=>obs(i+1,i>=5?5:4));expect(resolveWindow(at(0),4,'365scores',h,5,start+11*60000).outcome).toBe('miss');expect(resolveWindow(at(0),4,'365scores',h,10,start+11*60000).outcome).toBe('hit');});
it('never counts a boundary-straddling increase as a hit',()=>{const h=[obs(1),obs(2),obs(3),obs(4),obs(5.1,5)];expect(resolveWindow(at(0),4,'365scores',h,5,start+11*60000).outcome).toBe('inconclusive');});
it('missing snapshots, ended matches and provider corrections are not losses',()=>{
 for(const h of [[],[obs(1),obs(2)],[obs(1),obs(3,5)],[obs(1,3)],[obs(1,5,'api-football')]])expect(resolveWindow(at(0),4,'365scores',h,10,start+12*60000).outcome).toBe('inconclusive');
});
it('marks a fully observed unchanged counter as miss',()=>expect(resolveWindow(at(0),4,'365scores',Array.from({length:10},(_,i)=>obs(i+1)),10,start+11*60000).outcome).toBe('miss'));
const fixture={id:99,competition:'Liga',homeTeam:{name:'Time A'},awayTeam:{name:'Time B'}};
it('prioritizes canonical and then 365 keys',()=>{expect(initialKey({...fixture,sourceIds:{scores365:42,apiFootball:99}})).toBe('42');expect(initialKey({...fixture,eventKey:'apiFootball:99',sourceIds:{scores365:42}})).toBe('apiFootball:99');});
it('does not collide equal numeric IDs across providers',()=>{expect(initialKey({...fixture,sourceIds:{apiFootball:42}})).toBe('apiFootball:42');expect(sameFixture({...fixture,sourceIds:{scores365:42}},{...fixture,sourceIds:{scores365:43}})).toBe(false);});
