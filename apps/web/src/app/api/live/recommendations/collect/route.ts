import { NextRequest, NextResponse } from 'next/server';
import { authorized } from '@/lib/live/cronAuth';
import { resolveRecommendations } from '@/lib/live/recommendations';
export const dynamic='force-dynamic';
export const maxDuration=30;
/** Evaluations are recorded by the central engine from the exact snapshots sent to the UI. */
export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false,error:'Não autorizado'},{status:401});
  try{return NextResponse.json({ok:true,...await resolveRecommendations()},{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Avaliação indisponível'},{status:503});}
}
