# Publicar a aplicacao

Recomendacao para este projeto: Vercel, porque a aplicacao e Next.js.

## Configuracao do projeto

- App principal: `apps/web`
- Comando de instalacao: `corepack enable && yarn install --immutable`
- Comando de build: `corepack enable && yarn workspace web build`
- Comando local de producao, se precisar testar: `yarn workspace web start`

Se a plataforma pedir o diretorio do app, use `apps/web`. Se ela pedir comandos a partir da raiz do repositorio, use os comandos acima.

## Variaveis de ambiente

Configure estas variaveis na plataforma de hospedagem. Nao cole esses valores no codigo.

Obrigatorias para producao:

- `AUTH_SECRET`: segredo aleatorio forte.
- `BETTER_AUTH_SECRET`: segredo aleatorio forte, com pelo menos 32 caracteres.
- `AUTH_URL`: URL publica da aplicacao, por exemplo `https://seu-app.vercel.app`.
- `NEXT_PUBLIC_AUTH_URL`: mesma URL publica da aplicacao.
- `BETTER_AUTH_URL`: mesma URL publica da aplicacao.
- `NEXT_PUBLIC_CREATE_APP_URL`: mesma URL publica da aplicacao.
- `GEMINI_API_KEY`: chave do Google AI Studio.
- `CRON_SECRET`: segredo aleatorio forte para rotas administrativas/cron.

Necessarias para recursos administrativos e dados persistentes:

- `DATABASE_URL`: string de conexao Postgres. Neon funciona bem para este tipo de app.

Opcionais, conforme os recursos que voce quiser ativar:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RAPIDAPI_KEY`
- `API_FOOTBALL_KEY`
- `THE_ODDS_API_KEY`
- `ODDSPAPI_KEY`
- `FIRECRAWL_API_KEY`

## Cuidados antes de publicar

- O arquivo `.env.local` tem segredos locais e nao deve ser enviado para GitHub.
- Depois que a hospedagem gerar a URL publica, atualize as variaveis `AUTH_URL`, `NEXT_PUBLIC_AUTH_URL`, `BETTER_AUTH_URL` e `NEXT_PUBLIC_CREATE_APP_URL` com essa URL.
- Se usar login Google, cadastre a URL de callback no Google Cloud:
  `https://sua-url-publica/api/auth/callback/google`

## Validacao ja feita

- `yarn workspace web build` passou com sucesso.
- A aplicacao local respondeu em `http://localhost:4000`.
