import { runWorldCupPipeline } from './worldCupPipeline';
import { SOURCE_AUDIT } from './sourceAudit';

export type PostGamePipelineResult = {
  success: boolean;
  ranAt: string;
  steps: Array<{
    name: string;
    status: 'completed' | 'skipped';
    detail: string;
  }>;
  audit: typeof SOURCE_AUDIT;
};

export async function runPostGamePipeline(): Promise<PostGamePipelineResult> {
  const ranAt = new Date().toISOString();
  const steps: PostGamePipelineResult['steps'] = [];

  const worldCup = await runWorldCupPipeline(true);
  steps.push({
    name: 'Importar dados FIFA',
    status: worldCup.skipped ? 'skipped' : 'completed',
    detail: worldCup.skipped
      ? worldCup.reason ?? 'Banco indisponivel.'
      : `${worldCup.fifa.totalTeams} selecoes e ${worldCup.fifa.totalPlayers} jogadores processados.`,
  });

  steps.push({
    name: 'Complementar com 365Scores',
    status: 'skipped',
    detail:
      'Estrutura de banco pronta. A complementacao por partida sera ativada quando houver jogo finalizado com dados recebidos da fonte.',
  });

  steps.push({
    name: 'Complementar com API-Football',
    status: 'skipped',
    detail:
      'Estrutura de banco pronta. Odds, arbitros e estatisticas serao persistidos nas proximas etapas sem usar dados ficticios.',
  });

  steps.push({
    name: 'Atualizar IA',
    status: worldCup.knowledgeUpdated ? 'completed' : 'skipped',
    detail: worldCup.knowledgeUpdated
      ? 'Documento consultavel da Copa foi atualizado no banco.'
      : 'IA permanece usando base local enquanto DATABASE_URL nao estiver disponivel.',
  });

  return {
    success: true,
    ranAt,
    steps,
    audit: SOURCE_AUDIT,
  };
}
