import { upsertAiKnowledgeDocument } from '@/lib/persistence/aiRepository';
import { touchDataSource } from '@/lib/persistence/database';
import { getWorldCupDatabaseSummary } from '@/lib/persistence/worldCupRepository';
import { importWorldCupFrom365Scores } from './worldCupScores365Importer';
import { importWorldCupFromFifaStats, type FifaStatsImportOptions } from './worldCupFifaMatchStatsImporter';
import { runWorldCupPipeline } from './worldCupPipeline';
import { SOURCE_AUDIT } from './sourceAudit';

export type PostGamePipelineOptions = {
  fifaStats?: FifaStatsImportOptions;
};

export type PostGamePipelineResult = {
  success: boolean;
  ranAt: string;
  steps: Array<{
    name: string;
    status: 'completed' | 'skipped';
    detail: string;
  }>;
  audit: typeof SOURCE_AUDIT;
  summary?: unknown;
  imports?: {
    fifaStats?: Awaited<ReturnType<typeof importWorldCupFromFifaStats>>;
    scores365?: Awaited<ReturnType<typeof importWorldCupFrom365Scores>>;
  };
};

function buildPersistentKnowledge(
  summary: Record<string, unknown>,
  fifaStats?: Awaited<ReturnType<typeof importWorldCupFromFifaStats>>,
  scores365?: Awaited<ReturnType<typeof importWorldCupFrom365Scores>>
): string {
  return [
    'Copa do Mundo 2026 - base persistente do banco Neon.',
    '',
    `Seleções cadastradas: ${summary.teams ?? 0}.`,
    `Jogadores cadastrados: ${summary.players ?? 0}.`,
    `Goleiros: ${summary.goalkeepers ?? 0}.`,
    `Defensores: ${summary.defenders ?? 0}.`,
    `Meias: ${summary.midfielders ?? 0}.`,
    `Atacantes: ${summary.forwards ?? 0}.`,
    '',
    `Partidas salvas: ${summary.matches ?? 0}.`,
    `Estatísticas de partidas salvas: ${summary.match_statistics ?? 0}.`,
    `Estatísticas de jogadores salvas: ${summary.player_statistics ?? 0}.`,
    `Linhas de classificação salvas: ${summary.standings ?? 0}.`,
    '',
    fifaStats
      ? `Última importação FIFA pós-jogo: ${fifaStats.matchesUpserted} partidas, ${fifaStats.matchStatisticsInserted} estatísticas. ${fifaStats.notes.join(' ')}`.trim()
      : 'Última importação FIFA pós-jogo: não executada.',
    scores365
      ? `Última importação 365Scores: ${scores365.matchesUpserted} partidas, ${scores365.matchStatisticsInserted} estatísticas de partidas, ${scores365.standingsUpserted} linhas de classificação.`
      : 'Última importação 365Scores: não executada.',
    '',
    'Regra: para perguntas sobre Copa do Mundo, consultar primeiro FIFA/persistente. 365Scores e API-Football são fallback quando a FIFA ainda não estiver configurada ou não entregar o dado.',
  ].join('\n');
}

export async function runPostGamePipeline(options: PostGamePipelineOptions = {}): Promise<PostGamePipelineResult> {
  const ranAt = new Date().toISOString();
  const steps: PostGamePipelineResult['steps'] = [];
  const imports: PostGamePipelineResult['imports'] = {};

  const worldCup = await runWorldCupPipeline(true);
  steps.push({
    name: 'Importar dados FIFA',
    status: worldCup.skipped ? 'skipped' : 'completed',
    detail: worldCup.skipped
      ? worldCup.reason ?? 'Banco indisponivel.'
      : `${worldCup.fifa.totalTeams} selecoes e ${worldCup.fifa.totalPlayers} jogadores processados.`,
  });

  if (worldCup.skipped) {
    steps.push({ name: 'Importar estatisticas FIFA pos-jogo', status: 'skipped', detail: 'Banco indisponivel; importação FIFA pós-jogo não foi executada.' });
    steps.push({ name: 'Complementar com 365Scores', status: 'skipped', detail: 'Banco indisponivel; importação de resultados e classificação não foi executada.' });
    return { success: true, ranAt, steps, audit: SOURCE_AUDIT };
  }

  try {
    const fifaStats = await importWorldCupFromFifaStats(options.fifaStats);
    imports.fifaStats = fifaStats;
    await touchDataSource('fifa');
    steps.push({
      name: 'Importar estatisticas FIFA pos-jogo',
      status: fifaStats.configured ? 'completed' : 'skipped',
      detail: fifaStats.configured
        ? `${fifaStats.matchesUpserted} partidas FIFA e ${fifaStats.matchStatisticsInserted} estatísticas persistidas. ${fifaStats.notes.join(' ')}`.trim()
        : fifaStats.notes.join(' '),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao importar estatísticas FIFA.';
    await touchDataSource('fifa', message).catch(() => undefined);
    steps.push({ name: 'Importar estatisticas FIFA pos-jogo', status: 'skipped', detail: `Falha na importação FIFA pós-jogo: ${message}` });
  }

  try {
    const scores365 = await importWorldCupFrom365Scores();
    imports.scores365 = scores365;
    await touchDataSource('365scores');
    steps.push({
      name: 'Complementar com 365Scores',
      status: 'completed',
      detail: `${scores365.matchesUpserted} partidas, ${scores365.matchStatisticsInserted} estatísticas de partidas e ${scores365.standingsUpserted} linhas de classificação persistidas. ${scores365.notes.join(' ')}`.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao importar 365Scores.';
    await touchDataSource('365scores', message).catch(() => undefined);
    steps.push({ name: 'Complementar com 365Scores', status: 'skipped', detail: `Falha na importação 365Scores: ${message}` });
  }

  steps.push({ name: 'Complementar com API-Football', status: 'skipped', detail: 'API-Football permanece como fallback para próxima etapa. Nenhum dado fictício foi criado.' });

  const summary = (await getWorldCupDatabaseSummary()) as Record<string, unknown>;

  await upsertAiKnowledgeDocument({
    namespace: 'world-cup',
    key: 'world-cup-persistent-summary-2026',
    title: 'Resumo persistente da Copa do Mundo 2026',
    content: buildPersistentKnowledge(summary, imports.fifaStats, imports.scores365),
    metadata: { summary, imports, ranAt },
    sourceKey: imports.fifaStats?.configured ? 'fifa' : '365scores',
    sourceUpdatedAt: ranAt,
  });

  steps.push({ name: 'Atualizar IA', status: 'completed', detail: 'Documento consultável da Copa foi atualizado com o resumo persistente do banco.' });

  return { success: true, ranAt, steps, audit: SOURCE_AUDIT, summary, imports };
}
