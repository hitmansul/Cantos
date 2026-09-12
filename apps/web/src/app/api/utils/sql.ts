import { neon, NeonQueryFunction } from '@neondatabase/serverless';

const NullishQueryFunction = (() => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
}) as any as NeonQueryFunction<false, false>;

NullishQueryFunction.transaction = (() => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
}) as any as NeonQueryFunction<false, false>['transaction'];

type NeonGuardState = { blockedUntil: number; reason: string | null };
const globalStore = globalThis as typeof globalThis & { __cantosNeonGuard?: NeonGuardState };
const guard = globalStore.__cantosNeonGuard ?? { blockedUntil: 0, reason: null };
globalStore.__cantosNeonGuard = guard;

const QUOTA_COOLDOWN_MS = 10 * 60_000;
const rawSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : NullishQueryFunction;

export function isQuotaError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? '');
  return /HTTP status 402/i.test(text)
    || /exceeded the data transfer quota/i.test(text)
    || /data transfer quota/i.test(text);
}

function guardedQuery(timeoutMs?: number) {
const sql = (async (strings: TemplateStringsArray, ...params: unknown[]) => {
  if (Date.now() < guard.blockedUntil) {
    throw new Error(`Neon data transfer quota cooldown until ${new Date(guard.blockedUntil).toISOString()}`);
  }
  try {
    if(timeoutMs){
      const query=strings.reduce((text,part,index)=>text+(index?'$'+index:'')+part,'');
      return await rawSql(query,params,{fetchOptions:{signal:AbortSignal.timeout(timeoutMs)}});
    }
    return await (rawSql as any)(strings, ...params);
  } catch (error) {
    if (isQuotaError(error)) {
      guard.blockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
      guard.reason = error instanceof Error ? error.message : String(error);
      console.warn('[neon] Data transfer quota reached; pausing database queries for 10 minutes.');
    }
    throw error;
  }
}) as any as NeonQueryFunction<false, false>;

sql.transaction = (async (...args: Parameters<typeof rawSql.transaction>) => {
  if (Date.now() < guard.blockedUntil) throw new Error('Neon data transfer quota cooldown');
  try {
    const [queries,options]=args;
    return await (rawSql.transaction as any)(queries, timeoutMs?{...options,fetchOptions:{...options?.fetchOptions,signal:AbortSignal.timeout(timeoutMs)}}:options);
  }
  catch (error) {
    if (isQuotaError(error)) { guard.blockedUntil = Date.now() + QUOTA_COOLDOWN_MS; guard.reason = String(error); }
    throw error;
  }
}) as typeof rawSql.transaction;

return sql;
}
// Only the live path has a short deadline; existing import/backfill queries retain their behavior.
export const liveSql=guardedQuery(8_000);
export default guardedQuery();
