// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import Page from '@/app/live-results/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('does not turn inconclusive observations into zero percent accuracy',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>new Response(JSON.stringify(input.endsWith('performance')?{rows:[{dimension:'all',band:'all',samples:1,hits_5m:0,measurable_5m:0,hits_10m:0,measurable_10m:0,inconclusive_10m:1,pending_10m:0}]}:{rows:[{evaluation_key:'one',fixture:'Equipe A × Equipe B',competition:'Liga',recorded_at:new Date().toISOString(),match_minute:65,score:76,probability:65,confidence:'Média',corners_before:4,outcome_5m:'inconclusive',outcome_10m:'inconclusive',reason_5m:'missing-boundary-observation',reason_10m:'increase-straddles-deadline'}]}))));
 render(<Page/>);
 expect(await screen.findByText('Equipe A × Equipe B')).toBeTruthy();
 expect(screen.getAllByText('Sem amostra válida')).toHaveLength(2);
 expect(screen.getByText('Aumento observado após o limite; horário do escanteio incerto')).toBeTruthy();
 expect(screen.queryByText('0%')).toBeNull();
});
it('shows request failure instead of a misleading empty or zero results screen',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503})));
 render(<Page/>);expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('Oportunidades na amostra')).toBeNull();
});
