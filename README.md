# Família da Costa

App familiar: **Casa** (tarefas + post-its), **Privado** (notas), **Arquivos** (pasta comum com ficheiros) e **Definições**.

## Endereço

https://familia.atelierdacostafinanceiro.workers.dev

## Entrar

1. Abrir o endereço no navegador.
2. Carregar em **Entrar com Google**.
3. Usar uma das contas autorizadas (a lista de membros está na base de dados; o administrador pode adicionar mais em Definições).

## Instalar no telemóvel (PWA)

- **iPhone (Safari):** botão Partilhar → “Adicionar ao ecrã principal”.
- **Android (Chrome):** menu ⋮ → “Instalar aplicação”.

## Notificações

Ativar em **Definições → Notificações neste dispositivo**. Lembretes de tarefas com data e hora são enviados por cron a cada minuto.

## Desenvolvimento

```bash
npm install
npm run dev          # servidor local com Workers
npm run check        # TypeScript
npm run db:local     # migrações D1 locais
npm run build        # build de produção
npm run db:remote    # migrações D1 remotas
npm run deploy       # publicar no Cloudflare Workers
```

## Configuração (produção)

- Worker `familia` com bindings `DB` (D1), `FILES` (R2, opcional até ativar) e `ASSETS`.
- Segredos: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`.
- Vars: `APP_URL`, `ADMIN_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- OAuth Google: redirecionamento `https://familia.atelierdacostafinanceiro.workers.dev/api/auth/callback/google` registado no cliente OAuth do projeto Google Cloud “Central da Costa”.
