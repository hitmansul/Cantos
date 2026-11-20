# IA Cantos: agente operacional v1

A página inicial e /live exibem o mesmo agente. A navegação principal contém somente agente e resultados. As rotas antigas permanecem para compatibilidade.

## Ciclo

O cron existente chama /api/cron/live-collector, que coleta, persiste, avalia e resolve os resultados de 5/10 minutos. /api/live/central retorna também a decisão do agente. A tela consulta essa mesma fonte e bloqueia sinais após falha ou 90 segundos sem atualização. Nenhuma avaliação depende de um LLM ou de nova assinatura.

Todas as partidas descobertas entram na lista. A busca detalhada de estatísticas 365Scores continua limitada a 12 partidas por coleta para preservar o orçamento. Logo, listar uma partida não significa ter cobertura para recomendar escanteios nela. O modelo existente é heurístico; a interface mostra força do sinal, não probabilidade calibrada.

Expulsões são alertas visuais separados, com identidade estável por partida e contagem, baseados em estatísticas recentes de cartões vermelhos. Não alteram a pontuação de escanteios. Não há push, SMS ou WhatsApp nesta versão.

As previsões de acréscimos e incidentes existentes são mantidos por tempo, com minuto, motivo e duração quando fornecidos. Relógios 45+N/90+N e campos extra ambíguos não são mais tratados como anúncios oficiais. Sem fonte explícita validada, o acréscimo oficial fica sem confirmação.

Bet365 internacional permanece indisponível até validar cobertura e acesso. Nenhuma odd ou país é presumido.

## Operação e validação

- Manter o cron-job.org habilitado para /api/cron/live-collector com Authorization: Bearer seguido do CRON_SECRET do deployment. Não registrar o segredo em logs ou arquivos.
- /api/live/health distingue falha do coletor, banco e falta de cobertura. O estado saudável de uma coleta não garante continuidade do agendador.
- npm run test:live --workspace apps/web
- npm run typecheck --workspace apps/web
- npm run build --workspace apps/web

Em 20/11/2026 a produção respondeu com banco acessível e coletor sem sucesso por cerca de 41 dias. Uma chamada de verificação a /api/live/central voltou a confirmar coleta e persistência de 12 jogos. A retomada contínua do agendador ainda precisa ser comprovada.
