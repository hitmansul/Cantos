// @vitest-environment jsdom
import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CornerAgent } from '@/components/CornerAgent';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows a red card, filters matches and retains detailed stoppages without inventing official time', async () => {
 const time = new Date().toISOString();
 vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({lastUpdated:time, collectionConfirmed:true,persistenceConfirmed:true,matches:[{id:1,minute:'45+3',homeTeam:{name:'Equipe A',score:0},awayTeam:{name:'Equipe B',score:0},observedAt:time,statsObservedAt:time,liveStats:[{label:'Red cards',home:'0',away:'1'}],periodStoppage:{firstHalf:{actualAddedMinutes:3,predictedAddedMinutes:2,totalStoppedMinutes:3,incidents:[{timeline:'40′',reason:'Atendimento médico',durationMs:60000,endAt:time}]}}}]}))));
 render(<CornerAgent/>);
 expect(await screen.findByText(/Expulsão informada/)).toBeTruthy();
 expect(screen.getByText(/Atendimento médico/)).toBeTruthy();
 expect(screen.getAllByText('Acréscimo oficial: sem confirmação')).toHaveLength(2);
 fireEvent.change(screen.getByLabelText('Buscar jogo ou campeonato'),{target:{value:'inexistente'}});
 expect(screen.getByText('Nenhum jogo disponível para este filtro.')).toBeTruthy();
});
it('does not claim there are no live games when acquisition fails', async () => {
 vi.stubGlobal('fetch', vi.fn(async () => new Response('{}',{status:503})));
 render(<CornerAgent/>);
 expect(await screen.findByRole('alert')).toBeTruthy();
 expect(screen.getByText(/Isso não confirma ausência/)).toBeTruthy();
});
