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

const baseSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : NullishQueryFunction;

function isLiveEngineQuery(strings: TemplateStringsArray | readonly string[]) {
  return strings.join(' ').includes('live_engine_');
}

function isNeonTransferQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return normalized.includes('http status 402') || normalized.includes('exceeded the data transfer quota');
}

const sql = (async (strings: TemplateStringsArray, ...params: unknown[]) => {
  try {
    return await baseSql(strings, ...params as never[]);
  } catch (error) {
    if (isLiveEngineQuery(strings) && isNeonTransferQuotaError(error)) {
      console.warn('[live-engine] Neon data transfer quota exceeded; using memory fallback.');
      return [];
    }
    throw error;
  }
}) as unknown as NeonQueryFunction<false, false>;

sql.transaction = baseSql.transaction.bind(baseSql) as NeonQueryFunction<false, false>['transaction'];

export default sql;
