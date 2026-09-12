# Estado — Família da Costa

Marco atual: primeira entrega publicada; falta ativar R2 (uploads de ficheiros).
Último commit: (ver git log) — "Correções de sincronização: encadeamento de revisões, verificação otimista no servidor, locale pt"
Endereço publicado: https://familia.atelierdacostafinanceiro.workers.dev
Versão publicada: 2cea6ac4-5480-42c2-ad95-7135efc2d1c3

## Concluído e verificado (navegador, endereço publicado)
- Login Google real (conta atelierdacostafinanceiro@gmail.com): entra, recarrega, sai e volta a entrar. Verificado no browser.
- Casa: criar tarefa só com título; recarregar e encontrar; editar prazo e responsáveis (2 responsáveis guardados); concluir → Resolvidas; reabrir; grupos com data (Amanhã); locale pt-PT.
- Sincronização: fila local Dexie; revisões encadeadas; conflito detetado no servidor (verificação otimista); bootstrap substitui estado preservando pendências locais.
- Privado: criar nota, escrever com Tiptap, fechar, reabrir e encontrar texto; nota marcada private/owner no D1.
- Definições: conta, gestão de membros (4 membros, convidar, ativar/desativar), estado de sincronização.
- API: /api/bootstrap sem sessão → 401; rota inexistente → 404 JSON.
- D1: migrações aplicadas (app + better-auth); R2 pendente.
- PWA: manifest, service worker (shell + push), ícones.
- Notificações: cron * * * * * a processar lembretes; VAPID configurado (reutilizado da Central da Costa).

## Por verificar
- Uploads de ficheiros (R2 desativado na conta — devolve 503 com mensagem clara até ativar).
- Post-its na Casa (depende de entradas de arquivo; a lógica está implementada).
- Notificações push reais num telemóvel (requer ativar em Definições num dispositivo).
- Entrada real das contas Pedro/Lucinda/Hugo (já autorizadas; cada uma entra com a sua conta Google).

## Bloqueios externos
- Ativação do R2: o checkout do dashboard exige método de pagamento (total $0,00). Ação: https://dash.cloudflare.com/11754f1540c8723eadaf5ae39eda4679/r2 → "Add R2 subscription to my account". Depois: criar bucket `familia-files`, re-adicionar binding FILES no wrangler.jsonc e `wrangler deploy`.

## Problemas conhecidos
- Ao mover pastas/ficheiros o destino pede o ID da pasta (UI simplificada; melhorar na revisão).
- Testes automatizados (Vitest/Playwright) ainda não escritos; verificação foi manual no navegador.
