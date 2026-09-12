// @vitest-environment node
import { it,expect,vi,afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/live-collector/route';
import { authorized } from './cronAuth';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('fails closed with absent secret, query secret or wrong bearer',()=>{
 vi.stubEnv('CRON_SECRET','');expect(authorized(new NextRequest('https://test.invalid'))).toBe(false);
 vi.stubEnv('CRON_SECRET','test-secret');
 expect(authorized(new NextRequest('https://test.invalid?secret=test-secret'))).toBe(false);
 expect(authorized(new NextRequest('https://test.invalid',{headers:{Authorization:'Bearer wrong'}}))).toBe(false);
});
it('preserves confirmed collection when analysis times out',async()=>{
 vi.stubEnv('CRON_SECRET','test-secret');
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({collectionConfirmed:true,persistenceConfirmed:true,count:5}))).mockRejectedValueOnce(new Error('Analysis timeout'));
 vi.stubGlobal('fetch',fetcher);
 const response=await GET(new NextRequest('https://test.invalid/api/cron/live-collector',{headers:{Authorization:'Bearer test-secret'}}));
 const result=await response.json();expect(response.status).toBe(200);expect(result.collectionConfirmed).toBe(true);expect(result.recommendationAnalytics.resolution.ok).toBe(false);
});
it('does not report success merely because central returned HTTP 200',async()=>{
 vi.stubEnv('CRON_SECRET','test-secret');vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({collectionConfirmed:false,persistenceConfirmed:false}))));
 const response=await GET(new NextRequest('https://test.invalid/api/cron/live-collector',{headers:{Authorization:'Bearer test-secret'}}));expect(response.status).toBe(503);
});
