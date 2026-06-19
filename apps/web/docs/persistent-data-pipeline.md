# Camada persistente e pipeline automatico

## Diagnostico atual

O projeto ja possui uma boa cobertura visual, mas a fonte principal de varios dados ainda fica espalhada entre arquivos TS e chamadas diretas a APIs durante o carregamento das telas.

Funcionalidades incompletas ou parciais:

- Copa do Mundo: elencos oficiais ja sao lidos da FIFA, mas agenda, grupos, tabela, estatisticas de jogadores e relatorios pos-jogo ainda nao ficam consolidados em banco.
- Tempo Real: a tela consulta fontes ao vivo e calcula paradas quando recebe dados suficientes, mas os eventos e snapshots ainda nao eram persistidos para auditoria historica.
- Odds: API-Football ja entrega odds reais para algumas ligas/linhas, mas o historico de odds, casas, linhas e alertas ainda nao tinha tabelas dedicadas.
- IA: responde primeiro por regras locais, mas a base consultavel ainda estava acoplada aos arquivos TS e nao a uma camada persistente.
- Admin: ja depende de `DATABASE_URL`, confirmando que Postgres e o caminho natural para a aplicacao.

Dados recebidos mas ainda pouco aproveitados:

- FIFA: PDF/lista oficial de convocados, tecnicos, posicoes, clubes e alturas.
- 365Scores: agenda, resultados, placar, minuto ao vivo, classificacao e parte do play-by-play/tempo de bola rolando.
- API-Football: fixtures, arbitros, eventos, estatisticas e odds reais por casa/mercado.

Dependencia atual entre fontes:

1. FIFA deve ser a fonte principal da Copa do Mundo.
2. 365Scores complementa agenda, placar, tempo real e classificacao quando a FIFA ainda nao disponibilizou dado final.
3. API-Football complementa odds, arbitros, estatisticas e fixtures.
4. Arquivos TS locais permanecem apenas como compatibilidade temporaria.

## Banco escolhido

Banco escolhido: Postgres serverless com Neon como opcao operacional recomendada.

Motivos:

- O projeto ja usa `@neondatabase/serverless`.
- O admin e as rotas existentes ja leem `DATABASE_URL`.
- Funciona bem na Vercel com baixo custo e manutencao simples.
- Mantem compatibilidade com Supabase ou outro Postgres, pois o schema usa SQL padrao.

## Migration criada

Arquivo: `db/migrations/0001_persistent_pipeline.sql`

Tabelas:

- `data_sources`
- `competitions`
- `world_cup_teams`
- `world_cup_players`
- `world_cup_matches`
- `world_cup_standings`
- `world_cup_match_statistics`
- `world_cup_player_statistics`
- `live_events`
- `live_event_statistics`
- `live_stoppage_periods`
- `live_added_time`
- `bookmakers`
- `odds_events`
- `odds_markets`
- `odds_prices`
- `odds_alerts`
- `ai_knowledge_documents`
- `ai_response_cache`
- `ai_rankings`

## Pipeline automatico pos-jogo

Nova rota:

- `GET /api/cron/post-game-pipeline?secret=CRON_SECRET`

Fluxo preparado:

1. Importar FIFA.
2. Gravar selecoes e jogadores no banco.
3. Atualizar documento consultavel pela IA.
4. Deixar pontos de extensao para complementar partida finalizada com 365Scores.
5. Deixar pontos de extensao para odds, arbitros e estatisticas via API-Football.

O pipeline nao inventa dados. Quando uma fonte ainda nao informa estatistica, o passo fica marcado como `skipped`.

## Auditoria das fontes

### FIFA

Endpoints utilizados:

- `https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf`
- `https://www.fifa.com/en/articles/fifa-world-cup-2026-squads-confirmed`

Dados que chegam:

- selecoes
- jogadores
- posicoes
- numero de camisa
- clube
- altura quando informada
- tecnico quando identificado

Ainda nao aproveitado:

- relatorios oficiais pos-jogo
- eventos oficiais de jogo
- estatisticas oficiais por jogador e partida quando publicadas

### 365Scores

Endpoints utilizados no projeto:

- `/web/games/`
- `/web/games/results/`
- `/web/standings/`
- endpoints de evento, estatisticas e play-by-play usados pelo Tempo Real

Dados que chegam:

- agenda
- resultados
- placar ao vivo
- minuto
- classificacao
- grupos
- algumas estatisticas e tempo de bola rolando quando a fonte envia

Ainda nao aproveitado:

- snapshots historicos de cada atualizacao ao vivo
- eventos de parada/retomada em formato auditavel
- estatisticas detalhadas de jogador quando disponiveis

### API-Football

Endpoints utilizados no projeto:

- `/fixtures`
- `/fixtures/statistics`
- `/fixtures/events`
- `/fixtures/lineups`
- `/odds`

Dados que chegam:

- fixtures
- status
- arbitro quando informado
- eventos
- estatisticas de partida
- odds reais por mercado/casa

Ainda nao aproveitado:

- historico de odds por captura
- lineups e estatisticas de jogadores persistidas
- ranking estruturado para IA

## Proximas etapas habilitadas pelo banco

- Resultados com estatisticas oficiais.
- Aba Cartoes consultando fatos persistidos.
- Estatisticas dos jogadores atualizadas a cada jogo.
- Tempo Real com historico de snapshots.
- IA global consultando banco antes do Gemini.
- Atualizacao automatica pos-jogo sem depender de arquivos TS estaticos.
