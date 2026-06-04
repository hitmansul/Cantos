export type FifaSquadPlayer = {
  number: number;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  playerName: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  dateOfBirth: string;
  club: string;
  heightCm: number | null;
};

export type FifaSquadCoach = {
  name: string;
  firstName: string;
  lastName: string;
  nationality: string;
};

export type FifaSquad = {
  team: string;
  code: string;
  page: number;
  coach?: FifaSquadCoach;
  players: FifaSquadPlayer[];
};

export type FifaSquadsData = {
  source: {
    name: string;
    url: string;
    articleUrl: string;
    lastModified: string | null;
    footerUpdatedAt: string | null;
    version: string | null;
    updateCadence: string;
  };
  generatedAt: string;
  totalTeams: number;
  totalPlayers: number;
  teams: FifaSquad[];
};

type PdfTextItem = {
  str: string;
  transform: number[];
};

type ParsedRow = {
  y: number;
  cells: Array<{ x: number; text: string }>;
};

type ColumnLayout = {
  bounds: Array<[number, number]>;
};

const FIFA_SQUAD_LIST_URL = 'https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf';
const FIFA_SQUAD_ARTICLE_URL = 'https://www.fifa.com/en/articles/fifa-world-cup-2026-squads-confirmed';
const DAY_MS = 24 * 60 * 60 * 1000;

let squadsCache: { expiresAt: number; data: FifaSquadsData } | null = null;

const TEAM_ALIASES: Record<string, string[]> = {
  Algeria: ['argelia'],
  Argentina: ['argentina'],
  Australia: ['australia'],
  Austria: ['austria'],
  Belgium: ['belgica'],
  'Bosnia And Herzegovina': ['bosnia', 'bosnia e herzegovina'],
  Brazil: ['brasil'],
  'Cabo Verde': ['cabo verde'],
  Canada: ['canada'],
  Colombia: ['colombia'],
  'Congo DR': ['congo', 'republica democratica do congo'],
  "Côte D'Ivoire": ['costa do marfim'],
  Croatia: ['croacia'],
  Curaçao: ['curacao'],
  Czechia: ['republica tcheca', 'tchequia'],
  Ecuador: ['equador'],
  Egypt: ['egito'],
  England: ['inglaterra'],
  France: ['franca'],
  Germany: ['alemanha'],
  Ghana: ['gana'],
  Haiti: ['haiti'],
  'IR Iran': ['ira', 'iran'],
  Iraq: ['iraque'],
  Japan: ['japao'],
  Jordan: ['jordania'],
  'Korea Republic': ['coreia do sul', 'coreia'],
  Mexico: ['mexico'],
  Morocco: ['marrocos'],
  Netherlands: ['holanda', 'paises baixos'],
  'New Zealand': ['nova zelandia'],
  Norway: ['noruega'],
  Panama: ['panama'],
  Paraguay: ['paraguai'],
  Portugal: ['portugal'],
  Qatar: ['catar', 'qatar'],
  'Saudi Arabia': ['arabia saudita'],
  Scotland: ['escocia'],
  Senegal: ['senegal'],
  'South Africa': ['africa do sul'],
  Spain: ['espanha'],
  Sweden: ['suecia'],
  Switzerland: ['suica'],
  Tunisia: ['tunisia'],
  Türkiye: ['turquia'],
  Uruguay: ['uruguai'],
  USA: ['eua', 'estados unidos'],
  Uzbekistan: ['uzbequistao'],
};

export function normalizeFifaText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell(row: ParsedRow, minX: number, maxX: number): string {
  return row.cells
    .filter((cell) => cell.x >= minX && cell.x < maxX)
    .map((cell) => cell.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColumn(row: ParsedRow, layout: ColumnLayout, index: number): string {
  const [minX, maxX] = layout.bounds[index] ?? [-Infinity, Infinity];
  return getCell(row, minX, maxX);
}

function findColumnLayout(rows: ParsedRow[]): ColumnLayout | null {
  const headerRow = rows.find((row) => {
    const line = row.cells.map((cell) => cell.text).join(' ');
    return line.includes('PLAYER NAME') && line.includes('DOB') && line.includes('HEIGHT');
  });
  if (!headerRow) return null;

  const headerCells = headerRow.cells;
  const posX = headerCells.find((cell) => cell.text === 'POS')?.x;
  const playerX = headerCells.find((cell) => cell.text === 'PLAYER NAME')?.x;
  const firstX = headerCells.find((cell) => cell.text === 'FIRST NAME(S)')?.x;
  const lastX = headerCells.find((cell) => cell.text === 'LAST NAME(S)')?.x;
  const shirtX = headerCells.find((cell) => cell.text === 'NAME ON SHIRT')?.x;
  const dobX = headerCells.find((cell) => cell.text === 'DOB')?.x;
  const heightX = headerCells.find((cell) => cell.text === 'HEIGHT (CM)')?.x;
  if (
    posX === undefined ||
    playerX === undefined ||
    firstX === undefined ||
    lastX === undefined ||
    shirtX === undefined ||
    dobX === undefined ||
    heightX === undefined
  ) {
    return null;
  }

  const playerFirst = (playerX + firstX) / 2;
  const firstLast = (firstX + lastX) / 2;
  const lastShirt = (lastX + shirtX) / 2;
  const shirtDob = (shirtX + dobX) / 2;
  const dobClub = dobX + 15;
  const heightStart = heightX + 2;

  return {
    bounds: [
      [0, posX - 1],
      [posX - 1, 27],
      [27, playerFirst],
      [playerFirst, firstLast],
      [firstLast, lastShirt],
      [lastShirt, shirtDob],
      [shirtDob, dobClub],
      [dobClub, heightStart],
      [heightStart, 430],
    ],
  };
}

function toRows(items: PdfTextItem[]): ParsedRow[] {
  const rows = new Map<string, ParsedRow>();

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const key = y.toFixed(1);
    const row = rows.get(key) ?? { y: Number(key), cells: [] };
    row.cells.push({ x, text });
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      cells: row.cells.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => b.y - a.y);
}

function parsePlayer(row: ParsedRow, fallbackNumber: number, layout: ColumnLayout): FifaSquadPlayer | null {
  const rawNumber = Number(getColumn(row, layout, 0));
  const position = getColumn(row, layout, 1) as FifaSquadPlayer['position'];
  const dateOfBirth = getColumn(row, layout, 6);
  const heightValue = Number(getColumn(row, layout, 8));

  if (!['GK', 'DF', 'MF', 'FW'].includes(position)) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOfBirth)) return null;

  return {
    number: Number.isFinite(rawNumber) && rawNumber > 0 ? rawNumber : fallbackNumber,
    position,
    playerName: getColumn(row, layout, 2),
    firstName: getColumn(row, layout, 3),
    lastName: getColumn(row, layout, 4),
    shirtName: getColumn(row, layout, 5),
    dateOfBirth,
    club: getColumn(row, layout, 7),
    heightCm: Number.isFinite(heightValue) ? heightValue : null,
  };
}

function parseCoach(row: ParsedRow): FifaSquadCoach | undefined {
  const values = row.cells.map((cell) => cell.text.trim()).filter(Boolean);
  const role = values[0] ?? '';
  if (!normalizeFifaText(role).includes('head coach')) return undefined;
  return {
    name: values[1] ?? '',
    firstName: values[2] ?? '',
    lastName: values[3] ?? '',
    nationality: values.slice(4).join(' '),
  };
}

function parseFooter(row: ParsedRow): { footerUpdatedAt: string | null; version: string | null } | null {
  const line = row.cells.map((cell) => cell.text).join(' ').replace(/\s+/g, ' ').trim();
  if (!line.includes('Version') || !line.includes('Page')) return null;

  const parts = line.split('|').map((part) => part.trim());
  return {
    footerUpdatedAt: parts.slice(0, 2).join(' | ') || null,
    version: parts.find((part) => /^Version\s+/i.test(part))?.replace(/^Version\s+/i, '') ?? null,
  };
}

function parseSquadPage(page: number, items: PdfTextItem[]): {
  squad: FifaSquad | null;
  footerUpdatedAt: string | null;
  version: string | null;
} {
  const rows = toRows(items);
  const layout = findColumnLayout(rows);
  const title = rows
    .map((row) => row.cells.map((cell) => cell.text).join(' ').trim())
    .find((line) => /^.+\s+\([A-Z]{3}\)$/.test(line)) ?? '';
  const titleMatch = title.match(/^(.+?)\s+\(([A-Z]{3})\)$/);
  if (!titleMatch) return { squad: null, footerUpdatedAt: null, version: null };

  let coach: FifaSquadCoach | undefined;
  let footerUpdatedAt: string | null = null;
  let version: string | null = null;
  const players: FifaSquadPlayer[] = [];

  for (const row of rows) {
    const player = layout ? parsePlayer(row, players.length + 1, layout) : null;
    if (player) {
      players.push(player);
      continue;
    }

    coach ??= parseCoach(row);
    const footer = parseFooter(row);
    if (footer) {
      footerUpdatedAt = footer.footerUpdatedAt;
      version = footer.version;
    }
  }

  return {
    squad: {
      team: titleMatch[1],
      code: titleMatch[2],
      page,
      coach,
      players: players.sort((a, b) => a.number - b.number),
    },
    footerUpdatedAt,
    version,
  };
}

async function parsePdf(buffer: ArrayBuffer, lastModified: string | null): Promise<FifaSquadsData> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdfjs-dist exposes the worker file but does not publish TypeScript declarations for it.
  // @ts-expect-error See comment above.
  const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as typeof globalThis & {
    pdfjsWorker?: typeof pdfjsWorker;
  }).pdfjsWorker = pdfjsWorker;

  const bytes = new Uint8Array(buffer);
  const document = await pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker: boolean }).promise;

  const teams: FifaSquad[] = [];
  let footerUpdatedAt: string | null = null;
  let version: string | null = null;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const { squad, footerUpdatedAt: pageUpdatedAt, version: pageVersion } = parseSquadPage(
      pageNumber,
      content.items as PdfTextItem[]
    );

    if (squad && squad.players.length > 0) teams.push(squad);
    footerUpdatedAt ??= pageUpdatedAt;
    version ??= pageVersion;
  }

  return {
    source: {
      name: 'FIFA Football Data Platform - Squad Lists',
      url: FIFA_SQUAD_LIST_URL,
      articleUrl: FIFA_SQUAD_ARTICLE_URL,
      lastModified,
      footerUpdatedAt,
      version,
      updateCadence: '24h cache; refresh diario pela rota da aplicacao',
    },
    generatedAt: new Date().toISOString(),
    totalTeams: teams.length,
    totalPlayers: teams.reduce((sum, team) => sum + team.players.length, 0),
    teams,
  };
}

export async function getFifaWorldCupSquads(forceRefresh = false): Promise<FifaSquadsData> {
  if (!forceRefresh && squadsCache && squadsCache.expiresAt > Date.now()) {
    return squadsCache.data;
  }

  const response = await fetch(FIFA_SQUAD_LIST_URL, {
    headers: { Accept: 'application/pdf' },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`FIFA squad list returned ${response.status}`);
  }

  const data = await parsePdf(await response.arrayBuffer(), response.headers.get('last-modified'));
  squadsCache = { data, expiresAt: Date.now() + DAY_MS };
  return data;
}

export function findFifaSquad(data: FifaSquadsData, query: string): FifaSquad | null {
  const normalized = normalizeFifaText(query);
  if (!normalized) return null;
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));

  return (
    data.teams.find((team) => {
      const teamName = normalizeFifaText(team.team);
      const code = normalizeFifaText(team.code);
      const aliases = (TEAM_ALIASES[team.team] ?? []).map(normalizeFifaText);
      return normalized.includes(teamName) || tokens.has(code) || aliases.some((alias) => normalized.includes(alias));
    }) ?? null
  );
}
