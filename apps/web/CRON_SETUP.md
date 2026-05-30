# Configuração da Atualização Automática

O sistema agora atualiza automaticamente os jogos e estatísticas **todos os dias às 7h da manhã**.

## O que é atualizado automaticamente?

### 1. Importação de Jogos Futuros (7h da manhã)
- Busca automaticamente os próximos jogos das seguintes ligas:
  - Brasileirão Série A
  - Brasileirão Série B
  - Copa Libertadores
  - Copa Sul-Americana
  - Copa do Brasil
- Adiciona apenas jogos novos (não duplica)
- Fonte: API 365Scores

### 2. Atualização de Estatísticas (7h da manhã)
- Busca automaticamente dados de partidas que já aconteceram mas ainda não têm estatísticas
- Atualiza usando IA:
  - ⚽ Escanteios (casa e fora)
  - 👨‍⚖️ Árbitro
  - 🟨 Cartões amarelos e vermelhos
  - 🎯 Finalizações e finalizações no gol
- Processa até 50 partidas pendentes por execução

## Como funciona?

### Se você está usando Vercel (Recomendado)

O arquivo `vercel.json` já está configurado. Quando você fizer deploy na Vercel, o cron será ativado automaticamente.

**Nenhuma configuração adicional necessária!**

### Se você NÃO está usando Vercel

Você precisa configurar um serviço de cron externo para chamar a API:

#### Opção 1: cron-job.org (Grátis)

1. Acesse https://cron-job.org
2. Crie uma conta gratuita
3. Crie um novo cron job:
   - **URL**: `https://seu-dominio.com/api/cron/daily-update`
   - **Schedule**: `0 7 * * *` (todo dia às 7h)
   - **Method**: GET
   - **Headers**: Adicione `Authorization: Bearer SEU_CRON_SECRET`

#### Opção 2: EasyCron (Grátis)

1. Acesse https://www.easycron.com
2. Crie uma conta gratuita
3. Crie um novo cron job:
   - **URL**: `https://seu-dominio.com/api/cron/daily-update`
   - **Cron Expression**: `0 7 * * *`
   - **HTTP Method**: GET
   - **Custom Headers**: `Authorization: Bearer SEU_CRON_SECRET`

#### Opção 3: GitHub Actions (Grátis)

Crie `.github/workflows/daily-update.yml`:

```yaml
name: Daily Update
on:
  schedule:
    - cron: '0 7 * * *'  # 7h UTC (4h BRT)
  workflow_dispatch:  # Permite executar manualmente

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger daily update
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://seu-dominio.com/api/cron/daily-update
```

## Segurança

### Configurar CRON_SECRET (Importante!)

Para proteger o endpoint de cron, configure a variável de ambiente:

1. No Vercel:
   - Vá em Settings → Environment Variables
   - Adicione: `CRON_SECRET` = `um-token-secreto-aleatorio-aqui`

2. Localmente (`.env.local`):
   ```
   CRON_SECRET=um-token-secreto-aleatorio-aqui
   ```

**Importante**: Use um token forte e aleatório. Exemplo:
```bash
# Gerar um token seguro no terminal:
openssl rand -base64 32
```

### Sem CRON_SECRET configurado

Se você não configurar `CRON_SECRET`:
- ✅ Em desenvolvimento: o endpoint funciona normalmente
- ❌ Em produção: o endpoint fica desprotegido (qualquer um pode chamar)

**Recomendação**: Sempre configure `CRON_SECRET` em produção!

## Testar manualmente

### Localmente (desenvolvimento)

```bash
curl http://localhost:3000/api/cron/daily-update
```

### Em produção (com CRON_SECRET)

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://seu-dominio.com/api/cron/daily-update
```

## Resposta da API

Quando executado com sucesso, retorna:

```json
{
  "success": true,
  "duration": "45.23s",
  "import": {
    "totalInserted": 15,
    "leagues": [
      { "league": "brasileirao_a", "inserted": 5, "skipped": 2 },
      { "league": "brasileirao_b", "inserted": 3, "skipped": 1 },
      ...
    ]
  },
  "update": {
    "totalUpdated": 8,
    "matches": [
      {
        "matchId": 123,
        "homeTeam": "Flamengo",
        "awayTeam": "Palmeiras",
        "success": true
      },
      ...
    ]
  },
  "timestamp": "2026-05-18T07:00:00.000Z"
}
```

## Logs

Para ver os logs de execução:

### Vercel
1. Acesse o dashboard da Vercel
2. Vá em Deployments → Logs
3. Filtre por `/api/cron/daily-update`

### Outros serviços
Verifique os logs do seu serviço de cron (cron-job.org, EasyCron, etc.)

## Mudanças na Interface Admin

As seguintes funcionalidades foram **removidas** da interface porque agora são automáticas:

- ❌ Botão "Importar da API" (aba Partidas)
- ❌ Botão "Buscar Tudo" (aba Pendências)
- ❌ Seção de busca automática (aba IA)

Agora você verá **banners informativos** explicando que tudo acontece automaticamente às 7h.

## Ainda é possível atualizar manualmente?

**Sim!** Você ainda pode:

- ✅ Adicionar partidas manualmente (aba Partidas)
- ✅ Preencher escanteios manualmente (aba Pendências)
- ✅ Usar o assistente IA para extrair dados de textos (aba IA)

A automação apenas **complementa** o trabalho manual, não o substitui.

## Horário

O cron está configurado para **7h UTC** (horário universal).

**Atenção ao fuso horário:**
- 7h UTC = 4h BRT (horário de Brasília)
- Se quiser 7h BRT, configure para `10 * * * *` (10h UTC)

Para alterar o horário, edite `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-update",
      "schedule": "0 10 * * *"  // 10h UTC = 7h BRT
    }
  ]
}
```

## Troubleshooting

### O cron não está executando

1. Verifique se `CRON_SECRET` está configurado corretamente
2. Verifique os logs do serviço de cron
3. Teste manualmente com curl
4. Verifique se o domínio está acessível

### Erro 401 Unauthorized

- Verifique se o header `Authorization: Bearer SEU_CRON_SECRET` está correto
- Confirme que `CRON_SECRET` está configurado no ambiente

### Erro 500 Internal Server Error

- Verifique os logs da aplicação
- Confirme que as APIs externas (365Scores, Gemini) estão funcionando
- Verifique se as variáveis de ambiente necessárias estão configuradas

## Suporte

Se tiver problemas, verifique:
1. Logs da aplicação
2. Resposta da API de cron
3. Configuração das variáveis de ambiente
4. Status das APIs externas
