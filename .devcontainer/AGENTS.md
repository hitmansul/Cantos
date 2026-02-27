# AGENTS.md — Guia para agentes (Codex)

## Objetivo
Manter o projeto **Cantos** (Vite + TypeScript + Cloudflare Worker) estável e evoluir por mudanças pequenas e testáveis.

## Regras obrigatórias
- Não commitar segredos: `.dev.vars`, chaves, tokens, credenciais.
- Evitar mudanças grandes sem necessidade. Prefira PRs pequenos.
- Toda mudança deve passar:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

## Estrutura do projeto (alto nível)
- `src/react-app/` → UI (React)
- `src/worker/` → API/Worker (Cloudflare)
- `src/shared/` → tipos, helpers e utilitários compartilhados

## Padrões de código
- TypeScript estrito (quando possível).
- Preferir tipos explícitos em bordas (inputs/outputs de funções públicas e rotas).
- Retornos de API sempre em JSON com shape consistente:
  - `{ ok: true, data: ... }`
  - `{ ok: false, error: { message, code? } }`

## Worker/API
- Validar input (query/body/params) antes de usar.
- Usar status codes corretos (400, 401, 404, 500).
- Logs apenas quando necessário (evitar vazamento de dados sensíveis).

## UI (React)
- Componentes pequenos.
- Evitar lógica duplicada: extrair para `src/shared/`.
- Manter estado previsível, preferir hooks simples.

## Commits
- Use mensagens curtas e claras:
  - `chore: ...`
  - `fix: ...`
  - `feat: ...`

## Checklist de PR
- [ ] Mudança pequena e revisável
- [ ] Sem segredos
- [ ] `npm run check` passando
- [ ] Se mexeu em rotas, testou manualmente a resposta JSON