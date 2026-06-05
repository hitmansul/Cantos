const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

type ApiFootballRequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>;
  cache?: RequestCache;
  revalidate?: number;
  timeoutMs?: number;
};

export type ApiFootballEnvelope<T> = {
  get?: string;
  parameters?: unknown;
  errors?: unknown;
  results?: number;
  paging?: {
    current?: number;
    total?: number;
  };
  response?: T;
};

export function getApiFootballKey() {
  return process.env.API_FOOTBALL_KEY ?? process.env.APISPORTS_KEY ?? process.env.RAPIDAPI_KEY;
}

export function isApiFootballConfigured() {
  return Boolean(getApiFootballKey());
}

function hasApiFootballErrors(errors: unknown) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
}

function buildApiFootballUrl(path: string, params?: ApiFootballRequestOptions['params']) {
  const url = new URL(path.startsWith('http') ? path : `${API_FOOTBALL_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

export async function apiFootballGet<T>(
  path: string,
  options: ApiFootballRequestOptions = {}
): Promise<ApiFootballEnvelope<T> | null> {
  const apiKey = getApiFootballKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  try {
    const response = await fetch(buildApiFootballUrl(path, options.params), {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      cache: options.cache,
      next: options.revalidate !== undefined ? { revalidate: options.revalidate } : undefined,
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as ApiFootballEnvelope<T>;
    if (hasApiFootballErrors(payload.errors)) return null;
    return payload;
  } catch (error) {
    console.warn('[api-football] request failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
