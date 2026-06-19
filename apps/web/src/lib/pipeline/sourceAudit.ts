export type SourceAuditEntry = {
  source: 'FIFA' | '365Scores' | 'API-Football';
  endpoints: string[];
  dataArriving: string[];
  dataNotYetUsed: string[];
  opportunities: string[];
};

export const SOURCE_AUDIT: SourceAuditEntry[] = [
  {
    source: 'FIFA',
    endpoints: [
      'https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf',
      'https://www.fifa.com/en/articles/fifa-world-cup-2026-squads-confirmed',
    ],
    dataArriving: [
      'Lista oficial de selecoes convocadas',
      'Jogadores por selecao',
      'Posicao, numero, clube e altura quando a FIFA informa',
      'Tecnico da selecao quando identificado no PDF',
      'Data/versao da fonte quando presente no documento',
    ],
    dataNotYetUsed: [
      'Estatisticas oficiais por partida quando forem publicadas',
      'Eventos oficiais de jogo',
      'Relatorios oficiais pos-jogo',
      'Dados oficiais de arbitragem quando disponiveis',
    ],
    opportunities: [
      'Usar a FIFA como fonte definitiva de elencos, agenda oficial e estatisticas pos-jogo da Copa',
      'Criar importador incremental por partida finalizada',
      'Vincular jogadores FIFA as estatisticas de partida e aos rankings da IA',
    ],
  },
  {
    source: '365Scores',
    endpoints: [
      '/web/games/',
      '/web/games/results/',
      '/web/standings/',
      '/web/game/',
      '/web/game/stats/',
      '/web/game/playbyplay/',
    ],
    dataArriving: [
      'Agenda de jogos por competicao',
      'Placar e minuto ao vivo',
      'Resultados recentes',
      'Classificacao e grupos quando a competicao possui tabela',
      'Algumas estatisticas ao vivo e tempo de bola rolando quando a fonte envia',
    ],
    dataNotYetUsed: [
      'Historico completo de eventos de algumas partidas',
      'Campos brutos de competicao/pais que ainda precisam normalizacao',
      'Detalhes de jogador quando o endpoint nao e consultado pela tela atual',
    ],
    opportunities: [
      'Persistir snapshots de tempo real para auditoria e comparacao',
      'Completar agenda e classificacao quando a FIFA ainda nao publicou a informacao final',
      'Armazenar paradas e retomadas quando aparecem no play-by-play',
    ],
  },
  {
    source: 'API-Football',
    endpoints: [
      '/fixtures',
      '/fixtures/statistics',
      '/fixtures/events',
      '/fixtures/lineups',
      '/odds',
    ],
    dataArriving: [
      'Fixtures e status por liga/temporada',
      'Arbitro quando informado pela fonte',
      'Estatisticas de partidas quando disponiveis',
      'Odds reais por casa, mercado e linha',
      'Eventos como cartoes, gols e substituicoes quando a cobertura envia',
    ],
    dataNotYetUsed: [
      'Lineups e estatisticas individuais ainda nao consolidadas no banco',
      'Eventos de cartao por situacao do placar',
      'Odds historicas com snapshots por horario',
    ],
    opportunities: [
      'Complementar arbitros, cartoes e odds nas previsoes',
      'Persistir historico de odds para alertas reais por casa',
      'Apoiar a IA com consultas estruturadas de fixtures, odds e estatisticas',
    ],
  },
];
