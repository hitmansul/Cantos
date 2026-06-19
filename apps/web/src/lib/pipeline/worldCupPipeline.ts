import type { FifaSquadsData } from '@/lib/fifaWorldCup';
import { getFifaWorldCupSquads } from '@/lib/fifaWorldCup';
import { isPersistentDatabaseConfigured, touchDataSource } from '@/lib/persistence/database';
import { upsertAiKnowledgeDocument } from '@/lib/persistence/aiRepository';
import { upsertFifaWorldCupSquads, type WorldCupImportResult } from '@/lib/persistence/worldCupRepository';
import { SOURCE_AUDIT } from './sourceAudit';

export type WorldCupPipelineResult = {
  skipped: boolean;
  reason?: string;
  fifa: {
    totalTeams: number;
    totalPlayers: number;
    sourceUpdatedAt: string | null;
    fallback: boolean;
  };
  database?: WorldCupImportResult;
  knowledgeUpdated?: boolean;
};

function sourceUpdatedAt(data: FifaSquadsData): string | null {
  return data.source.footerUpdatedAt ?? data.source.lastModified ?? data.generatedAt ?? null;
}

function buildWorldCupKnowledge(data: FifaSquadsData): string {
  const teams = data.teams
    .map((team) => {
      const positions = team.players.reduce<Record<string, number>>((acc, player) => {
        acc[player.position] = (acc[player.position] ?? 0) + 1;
        return acc;
      }, {});

      return `${team.team} (${team.code}): ${team.players.length} jogadores, ` +
        `${positions.GK ?? 0} goleiros, ${positions.DF ?? 0} defensores, ` +
        `${positions.MF ?? 0} meias, ${positions.FW ?? 0} atacantes.`;
    })
    .join('\n');

  return [
    `Copa do Mundo 2026 - base FIFA oficial.`,
    `Selecoes carregadas: ${data.totalTeams}.`,
    `Jogadores carregados: ${data.totalPlayers}.`,
    `Fonte: ${data.source.url}.`,
    `Atualizacao da fonte: ${sourceUpdatedAt(data) ?? 'nao informada'}.`,
    '',
    teams,
  ].join('\n');
}

export async function runWorldCupPipeline(forceRefresh = true): Promise<WorldCupPipelineResult> {
  const data = await getFifaWorldCupSquads(forceRefresh);
  const updatedAt = sourceUpdatedAt(data);

  const baseResult: WorldCupPipelineResult = {
    skipped: false,
    fifa: {
      totalTeams: data.totalTeams,
      totalPlayers: data.totalPlayers,
      sourceUpdatedAt: updatedAt,
      fallback: Boolean(data.source.fallback),
    },
  };

  if (!isPersistentDatabaseConfigured()) {
    return {
      ...baseResult,
      skipped: true,
      reason: 'DATABASE_URL nao configurado; FIFA foi lida, mas nada foi gravado no banco.',
    };
  }

  try {
    const database = await upsertFifaWorldCupSquads(data.teams, updatedAt);
    await upsertAiKnowledgeDocument({
      namespace: 'world-cup',
      key: 'fifa-squads-2026',
      title: 'Elencos oficiais da Copa do Mundo 2026',
      content: buildWorldCupKnowledge(data),
      metadata: {
        totalTeams: data.totalTeams,
        totalPlayers: data.totalPlayers,
        sourceAudit: SOURCE_AUDIT.find((entry) => entry.source === 'FIFA'),
      },
      sourceKey: 'fifa',
      sourceUpdatedAt: updatedAt,
    });
    await touchDataSource('fifa');

    return {
      ...baseResult,
      database,
      knowledgeUpdated: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar pipeline da Copa.';
    await touchDataSource('fifa', message).catch(() => undefined);
    throw error;
  }
}
