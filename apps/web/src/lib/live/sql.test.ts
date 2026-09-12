// @vitest-environment node
import { it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn(),transaction:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>Object.assign(mock.query,{transaction:mock.transaction})}));
it('parameterizes live queries, bounds them, and applies quota cooldown to transactions',async()=>{
 vi.stubEnv('DATABASE_URL','postgres://unused/test');
 const {liveSql}=await import('@/app/api/utils/sql');
 mock.query.mockResolvedValueOnce([]);
 await liveSql`SELECT ${"'; DROP TABLE never; --"}::text`;
 expect(mock.query.mock.calls[0][0]).toBe('SELECT $1::text');
 expect(mock.query.mock.calls[0][1]).toEqual(["'; DROP TABLE never; --"]);
 expect(mock.query.mock.calls[0][2].fetchOptions.signal).toBeDefined();
 mock.transaction.mockRejectedValueOnce(new Error('HTTP status 402: data transfer quota'));
 await expect(liveSql.transaction([])).rejects.toThrow('402');
 await expect(liveSql.transaction([])).rejects.toThrow('cooldown');
 expect(mock.transaction).toHaveBeenCalledTimes(1);
 vi.unstubAllEnvs();
});
