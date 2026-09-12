# Correções de integridade do IA Cantos

Base revisada: `main` em `97ccb5059a8289360a69f0e4ce340bf14a2aafd5`.
Alterações preparadas em `fix/live-data-integrity`. Commit na branch e abertura de PR autorizados pelo usuário em 12/09/2026; merge e deploy de produção não fazem parte desta etapa.

## Comportamento corrigido

- `src/lib/live/intelligence.ts` é a implementação única da avaliação do Histórico Ao Vivo. O servidor calcula `assessment`; a interface apenas exibe o resultado e verifica sua validade temporal. O registro usa o mesmo objeto, com chave de avaliação e versão. Não há mais interceptação global de `fetch` nem cálculo alternativo baseado no histórico do navegador.
- Mantidos os limites de OPORTUNIDADE: força >= 72, probabilidade >= 60 e confiança Média/Alta. A probabilidade continua heurística, sem calibração comprovada. Seu horizonte está identificado como 10 minutos.
- Ataques perigosos ausentes não bloqueiam a avaliação com outros indicadores suficientes. Ausência não vira zero. Histórico com dados antigos, lacunas superiores a 90 segundos, mudança de fonte ou regressão dos contadores aguarda nova janela válida. Confiança usa minutos distintos, não o número de navegadores.
- Identidade persistida é propagada por `eventKey`. Identificadores dos provedores são registrados como aliases distintos. O 365Scores tem prioridade para novos eventos; uma chave já persistida permanece estável ao receber outro identificador. Chaves numéricas antigas reservadas a outro evento não são reaproveitadas silenciosamente: usa-se uma chave com nome do provedor. Não há migração destrutiva das chaves históricas.
- Uma trava no PostgreSQL coordena instâncias concorrentes. O dono da trava precisa estar válido no momento da gravação. Partida, aliases, snapshot e confirmação do ciclo são atômicos. Conteúdo idêntico ao último snapshot não é gravado novamente, desconsiderando apenas os horários de captura e de leitura da fonte.
- A hidratação usa uma consulta e uma visão consistente do banco. Todos os modos de resposta usam o mesmo histórico analítico; `summary`, `compact` e `0` alteram somente o conteúdo retornado ao navegador. A consulta busca no máximo 120 snapshots recentes por partida.
- As estatísticas de uma partida são escolhidas como um conjunto de uma fonte, evitando misturar contadores de origens diferentes. Eventos com avaliação pendente continuam prioritários na seleção por até 12 minutos. Uma partida que desaparece da fonte pode terminar inconclusiva; não é presumida como erro da IA.
- O coletor exige confirmação de persistência. A falha de registro ou resolução das recomendações não desfaz uma coleta concluída. Os endpoints de cron exigem `CRON_SECRET` no cabeçalho Bearer; não aceitam ausência de segredo ou segredo na URL.
- O health diferencia ciclo vazio confirmado (`idle`), atraso do coletor, cobertura insuficiente, indisponibilidade do banco e quota. A idade global deixa de ocultar partidas sem snapshots recentes.
- Consultas do fluxo ao vivo têm limite de espera e proteção de quota, inclusive transações. O restante das consultas do projeto mantém seu comportamento. Polling evita sobreposição, pausa em aba oculta e tem timeout. O catálogo usa cache de 25 segundos.

## Protocolo dos resultados

Os novos registros ficam em `live_recommendations_v2`, separados de `live_recommendation_events`. Os registros antigos são preservados e não entram nas novas taxas.

As janelas de 5 e 10 minutos são de relógio, a partir do snapshot que fundamentou a recomendação. Contadores cumulativos demonstram quando o aumento foi **observado**, não o segundo exato em que o escanteio aconteceu na origem.

| Evidência | Resultado |
|---|---|
| Aumento observado dentro da janela, com cobertura válida até ele | `hit` |
| Contador inalterado cobrindo o término, sem lacunas inválidas | `miss` |
| Primeiro aumento observado depois do limite e intervalo atravessando o limite | `inconclusive` |
| Fonte trocada, contador corrigido, lacuna ou partida sem evidência suficiente | `inconclusive` |
| Janela aberta ou aguardando observação no limite | `pending` |

Um escanteio observado em 6 minutos não vira acerto de 5 minutos. Pendências antigas expiram como inconclusivas. Resultados já concluídos não são recalculados como se fossem novos.

`/api/live/recommendations/performance` fornece taxas por probabilidade, força, confiança, minuto e campeonato para o modelo/protocolo atual, nos últimos 30 dias. Casos inconclusivos são excluídos do denominador, mas contados separadamente. O relatório seleciona a primeira oportunidade de cada partida por bloco UTC de 10 minutos; as janelas ainda podem se sobrepor e as amostras não são tratadas como independentes. Não há afirmação de melhoria da taxa de acerto.

Os painéis antigos de odds e de operações do navegador mantêm suas fontes e agora informam essa distinção. Não são usados como prova de desempenho deste novo protocolo.

## Retenção e consumo

- Snapshots: 6 horas, preservando a evidência necessária a recomendações pendentes. Limpeza em lotes de 5.000, até 20 lotes ou o orçamento de tempo; retorna `snapshot_backlog_possible` quando pode haver trabalho restante.
- Avaliações concluídas v2: 180 dias, até 100.000 exclusões por execução. Antes desse prazo, exportar os dados caso seja necessária calibração de períodos mais antigos.
- Aliases sem partidas ou pendências: elegíveis à limpeza após 30 dias.
- Entradas de avaliação guardam somente os indicadores usados pela fórmula, sem repetir todos os campos do snapshot.
- Manutenção diária dedicada às 06:15 UTC; a rotina diária existente também tenta a limpeza antes das integrações FIFA. Contagens retornadas substituem listas de IDs apagados.

A retenção depende de execução bem-sucedida. O limite de idade não significa exclusão imediata a cada linha. A economia líquida de transferência precisa ser medida: a coleta mais frequente também produz mais observações.

## Validação e implantação

Validação local concluída: 21 testes aprovados em 5 arquivos, checagem de tipos sem erros e build de produção aprovado com verificação de tipos habilitada. As fontes foram simuladas; o PostgreSQL utilizado nos testes foi local.

1. Executar `npm run typecheck --workspace apps/web`, `npm run test:live --workspace apps/web` e `npm run build --workspace apps/web`. O build passa a verificar tipos, em vez de ignorar erros. A suíte usa PostgreSQL local via PGlite, fontes simuladas e testes de renderização; não escreve no Neon de produção.
2. Revisar o diff e publicar primeiro em ambiente de revisão, com banco separado. O schema é aditivo e criado de forma idempotente; o papel do banco precisa permitir DDL. O timeout do fluxo ao vivo também se aplica ao preparo do schema.
3. Confirmar `DATABASE_URL` e o mesmo `CRON_SECRET` no ambiente de execução e no GitHub. `LIVE_COLLECTOR_URL` deve apontar ao ambiente pretendido. Não copiar valores de segredos para logs.
4. Confirmar o agendamento real do GitHub Action. O arquivo continua disparando a cada 5 minutos e faz cinco coletas espaçadas por um minuto quando o job inicia. Isso **não garante** pontualidade de início do job nem resolve, por si só, atrasos do agendador. Não usar métricas com cobertura insuficiente como acertos ou erros.
5. Acompanhar uma partida por ao menos 15 minutos: confirmar `eventKey`, versão, avaliação exibida versus registrada, contagem inicial e evidência das duas janelas. Verificar também um ciclo vazio e uma falha das fontes.
6. Confirmar a execução da manutenção, ausência de backlog persistente, tamanho das tabelas e transferência do Neon. Validar latência e contenção no PostgreSQL real; os testes locais não reproduzem a concorrência distribuída nem a latência da Vercel.
7. Só usar as novas taxas depois de verificar esses pontos. Não ajustar limiares nem fazer calibração automática com a primeira amostra.

Rollback de aplicação: retornar à versão anterior, mantendo as novas tabelas para inspeção. A tabela antiga de recomendações não foi alterada. Rever também workflow e agendamento caso o rollback remova a rota de manutenção. Não houve publicação, execução de cron de produção ou alteração do banco durante esta etapa.

## Verificação operacional de 12/09/2026

- A branch remota `main` permanece no commit base `97ccb5059a8289360a69f0e4ce340bf14a2aafd5`; as correções locais ainda não estão publicadas.
- O health respondeu com `generatedAt=2026-09-12T00:08:59.981Z`, `status=idle`, `databaseReachable=true`, `activeMatches=0` e `snapshots10m=0`. Isso confirma a resposta de ciclo sem partidas observada, mas não valida coleta durante partidas.
- Na listagem das últimas 30 execuções do GitHub Actions, os três jobs mais recentes do Live Collector foram iniciados em 11/09 às 19:46:28, 21:58:36 e 23:52:27 UTC. Os intervalos foram 2h12m08s e 1h53m51s; todos aparecem como `success`. Esse sucesso não comprova a cadência de 5 minutos. Não foi determinada a causa dos intervalos.
- Fonte: https://github.com/hitmansul/Cantos/actions/runs/34659664589 e https://github.com/hitmansul/Cantos/actions/runs/34651895674 .
- Próxima etapa proposta: commit das alterações na branch de correção e abertura de PR para revisão. Merge na `main`, publicação e execução em banco de produção são etapas posteriores.
