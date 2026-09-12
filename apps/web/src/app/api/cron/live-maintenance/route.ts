import { NextRequest, NextResponse } from 'next/server';
import { authorized } from '@/lib/live/cronAuth';
import { cleanupLiveData } from '@/lib/live/maintenance';
import { resolveRecommendations } from '@/lib/live/recommendations';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false,error:'Não autorizado'},{status:401});
  try{return NextResponse.json({ok:true,resolution:await resolveRecommendations(),cleanup:await cleanupLiveData()});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Manutenção indisponível'},{status:503});}
}
