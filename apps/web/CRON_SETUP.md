# Configuração da Atualização Automática

O sistema está configurado para ser compatível com o plano **Vercel Hobby**.

No plano Hobby, cada Cron Job deve executar no máximo **uma vez por dia**. Por isso, o arquivo `vercel.json` usa apenas agendamentos diários.

## Crons ativos na Vercel

### 1. Atualização diária geral

- **Endpoint**: `/api/cron/daily-update`
- **Agenda**: `0 7 * * *`
- **Frequência**: uma vez por dia
- **Objetivo**: atualizar jogos e estatísticas gerais.

### 2. Sincronização incremental da Copa do Mundo

- **Endpoint**: `/api/world-cup/provider-sync`
- **Agenda**: `30 7 * * *`
- **Frequência**: uma vez por dia
- **Objetivo**: executar o pipeline leve de sincronização de provedores, mantendo a FIFA como prioridade e evitando timeouts.

## Regra obrigatória para Vercel Hobby

Não usar expressões como:

```cron
*/30 * * * *
0 * * * *
*/5 * * * *
```

Essas frequências executam mais de uma vez por dia e fazem o deploy falhar no plano Hobby.

Use somente expressões diárias, por exemplo:

```cron
0 7 * * *
30 7 * * *
```

## O que é atualizado automaticamente?

### Importação de jogos futuros

- Busca automaticamente os próximos jogos das ligas configuradas.
- Adiciona apenas jogos novos.
- Evita duplicação.

### Atualização de estatísticas

- Busca dados de partidas já encerradas.
- Prioriza dados oficiais da FIFA quando disponíveis.
- Usa provedores complementares quando necessário.
- O processamento deve ser incremental para evitar timeout.

## Como testar manualmente

### Status do pipeline da Copa

```bash
curl https://cantos-web-final.vercel.app/api/world-cup/provider-sync
```

### Backfill incremental

```bash
curl https://cantos-web-final.vercel.app/api/world-cup/provider-sync?step=backfill
```

### Reparo incremental FIFA

```bash
curl https://cantos-web-final.vercel.app/api/world-cup/provider-sync?step=repair
```

## Observação

Se precisar de execução mais frequente que uma vez por dia, será necessário usar um agendador externo gratuito ou migrar para Vercel Pro. No plano atual, a configuração oficial deve permanecer diária para manter o deploy verde.
