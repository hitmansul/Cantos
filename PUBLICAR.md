# Publicar a aplicacao

Recomendacao para este projeto: Vercel, porque a aplicacao e Next.js.

## Configuracao do projeto

- App principal: `apps/web`
- Root Directory na Vercel: `apps/web`
- Comando de instalacao: `corepack enable && yarn install`
- Comando de build: `corepack enable && yarn build --webpack`
- Comando local de producao, se precisar testar: `yarn workspace web start`

O repositorio usa Yarn 4. Nao use redeploy de commits antigos com erro; publique sempre um commit novo da branch `main`.

## Variaveis de ambiente

Configure estas variaveis na plataforma de hospedagem. Nao cole esses valores no codigo.

Obrigatorias para producao:

- `AUTH_URL`: URL publica da aplicacao, por exemplo `https://cantos-web-final.vercel.app`.
- `NEXT_PUBLIC_AUTH_URL`: mesma URL publica da aplicacao.
- `BETTER_AUTH_URL`: mesma URL publica da aplicacao.
- `NEXT_PUBLIC_CREATE_APP_URL`: mesma URL publica da aplicacao.
- `GEMINI_API_KEY`: chave do Google AI Studio.
- `CRON_SECRET`: segredo aleatorio forte para rotas administrativas/cron.

Necessarias apenas quando reativar login/banco/admin completo:

- `DATABASE_URL`: string de conexao Postgres. Neon funciona bem para este tipo de app.
- `AUTH_SECRET`: segredo aleatorio forte.
- `BETTER_AUTH_SECRET`: segredo aleatorio forte, com pelo menos 32 caracteres.

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
- A primeira publicacao esta com login/cadastro desativados para evitar dependencia de banco e publicar o app principal primeiro.

## Validacao ja feita

- `yarn workspace web typecheck` passou sem erros.
- `yarn workspace web build --webpack` passou em clone limpo.
- A aplicacao publica respondeu em `https://cantos-web-final.vercel.app`.
