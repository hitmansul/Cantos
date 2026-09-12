import { NextRequest, NextResponse } from 'next/server';
import { authorized, internalHeaders } from '@/lib/live/cronAuth';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false,error:'Não autorizado'},{status:401});
  const startedAt=new Date().toISOString();
  try{
    const url=new URL('/api/live/central?history=0',request.nextUrl.origin);
    const response=await fetch(url,{cache:'no-store',headers:internalHeaders(),signal:AbortSignal.timeout(45_000)});
    const data=await response.json();
    const confirmed=response.ok&&data.collectionConfirmed===true&&data.persistenceConfirmed===true;
    // Resolution is independent of acquisition, including on cycles with no live matches.
    let resolution:unknown;
    try{
      const r=await fetch(new URL('/api/live/recommendations/collect',request.nextUrl.origin),{cache:'no-store',headers:internalHeaders(),signal:AbortSignal.timeout(8_000)});
      resolution={ok:r.ok,...await r.json()};
    }catch(error){resolution={ok:false,error:error instanceof Error?error.message:'Avaliação indisponível'};}
    return NextResponse.json({ok:confirmed,collectionConfirmed:confirmed,persistenceConfirmed:data.persistenceConfirmed,
      startedAt,finishedAt:new Date().toISOString(),lastUpdated:data.lastUpdated,matches:data.count,engine:data.engine,
      recommendationAnalytics:{recording:data.recommendationAnalytics,resolution},error:confirmed?null:data.error??'Persistência não confirmada'},
      {status:confirmed?200:503,headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({ok:false,collectionConfirmed:false,error:error instanceof Error?error.message:'Coleta indisponível'},{status:503});}
}
