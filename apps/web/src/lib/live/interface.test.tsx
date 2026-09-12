import { render,screen,cleanup } from '@testing-library/react';
import { it,expect,vi,afterEach } from 'vitest';
import Page from '@/app/live-history/LiveHistoryPageBase';
import { collecting } from './intelligence';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('displays the server decision and score even when summary history is absent',async()=>{
 const assessment={...collecting(),ready:true,decision:'OPORTUNIDADE',score:77,probability:67,nextCornerProbability:67,confidence:'Média',evaluatedAt:new Date().toISOString()};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({matches:[{id:42,eventKey:'42',minute:65,homeTeam:{name:'Time A',score:0},awayTeam:{name:'Time B',score:0},assessment,engineHistory:[]}]}))));
 render(<Page/>);
 expect(await screen.findByText('Força 77')).toBeInTheDocument();
 expect(screen.getByText('OPORTUNIDADE')).toBeInTheDocument();
});
it('does not show an old server assessment as an opportunity',async()=>{
 const assessment={...collecting(),ready:true,decision:'OPORTUNIDADE',score:77,evaluatedAt:new Date(Date.now()-240000).toISOString()};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({matches:[{id:42,eventKey:'42',minute:65,homeTeam:{name:'Time A',score:0},awayTeam:{name:'Time B',score:0},assessment}]}))));
 render(<Page/>);
 expect(await screen.findByText('Time A x Time B')).toBeInTheDocument();
 expect(screen.queryByText('OPORTUNIDADE')).not.toBeInTheDocument();
});
