# Família da Costa — guião de implementação para GLM 5.3 Flash no Zcode

## 1. Missão, prioridades e regras de execução

### Lê isto antes de alterar o projeto

Vais construir uma aplicação familiar chamada **Família da Costa**. O utilizador quer uma app simples e funcional, destinada sobretudo aos pais.

Uma tentativa anterior falhou porque, depois da autenticação Google, a aplicação ficava indefinidamente a carregar. A interface também tinha demasiadas opções e ocupava mal o espaço.

**A tua prioridade é entregar percursos completos que funcionam.** Não avances para funcionalidades adicionais enquanto entrar, criar, guardar, recarregar e voltar a encontrar os dados não estiver verificado.

Este documento é autónomo. Não assumes acesso à conversa anterior nem ao código da Central da Costa. A referência à Central significa usar a mesma família de tecnologias e um padrão simples de cartões de tarefas.

Este guião substitui as escolhas técnicas incompatíveis de `PLANO-FAMILIA.md`. Não combines as duas arquiteturas.

### A primeira entrega que deves terminar

| Obrigatório nesta entrega | Fica para depois da revisão desta entrega |
|---|---|
| Entrada Google e membros autorizados | Espelho automático Google Drive |
| Casa, Privado e Arquivos | Colaboração simultânea com Yjs |
| Criar, editar, concluir e reabrir tarefas | Repetição de tarefas e períodos vagos |
| Responsáveis, data e hora opcionais | Partilha seletiva entre pessoas |
| Notas privadas e listas com gravação automática | Histórico completo com comparação visual |
| Arquivo comum com pastas e anexos R2 | OCR e pesquisa dentro dos PDFs |
| Post-its de arquivos comuns na Casa | Download automático de todo o arquivo |
| Gravação local, sincronização e conflitos explícitos | Integrações Gmail, calendário ou IA |
| Notificações de tarefas com hora | Publicação em lojas de aplicações |
| Caixote recuperável | Edição bidirecional da Drive |
| PWA e interface móvel cuidada | |

As funcionalidades adiadas continuam a fazer parte da direção do produto. **Não mostres botões, separadores ou formulários para funcionalidades que ainda não existem.**

A primeira entrega termina com uma app que o utilizador pode experimentar e trazer de volta para revisão.

### Como trabalhar

1. Inspeciona primeiro o repositório. Se houver código, identifica o que funciona e o que está partido antes de o substituir. Preserva dados e ficheiros existentes.
2. Executa os marcos da secção 4 por ordem.
3. Em cada marco: implementa, testa, abre no navegador, corrige e regista o resultado.
4. Trabalha em alterações pequenas e coerentes. Não escrevas a app inteira numa única resposta ou alteração.
5. Mantém um registo em `docs/ESTADO.md`, atualizado após cada marco.
6. Antes de uma entrega, executa instalação reproduzível, verificações TypeScript, testes e build.
7. Não apagues testes ou enfraqueças validações para tornar os resultados verdes.
8. Não declares uma funcionalidade concluída com base apenas na compilação.
9. Não confundas testes com OAuth simulado com uma entrada real no Google.
10. Quando houver bloqueio externo, regista a causa exata e avança apenas no trabalho independente.
11. Não alteres a stack para resolver uma dificuldade antes de diagnosticar a causa.
12. Não uses dados pessoais reais em exemplos, seeds ou testes.
13. Não copies segredos para código, documentação, logs ou respostas.
14. Não publiques demonstrações com autenticação desligada.

Não imponhas um limite artificial de linhas que leve a fragmentar código sem sentido. Separa por responsabilidade: autenticação, dados, sincronização, tarefas, notas, arquivos e notificações. O componente principal apenas compõe a aplicação.

---

## 2. Produto e interface: especificação fechada

### Aspeto geral

- Nome: **Família da Costa**.
- Língua: português de Portugal.
- Fuso de apresentação e regras de calendário: `Europe/Lisbon`.
- Fundo branco `#FFFFFF`, texto e traços pretos `#000000`.
- Amarelo `#FFEB3B` exclusivamente nos post-its.
- Sem cinzentos, sombras, gradientes, transparências decorativas ou animações.
- Caixas retas e espaço confortável.
- Coluna única, centrada, com largura máxima de 800 px.
- Texto normal de 18 px e botões com área de toque mínima de 48 × 48 px.
- Sem deslocação horizontal a partir de 320 px.
- Fontes locais, com licenças incluídas: **IBM Plex Sans** na interface, **Literata** nas notas e **Azeret Mono** em números e referências.
- Pesos 400 e 700.
- Os anexos mantêm as cores originais.

A interface deve parecer uma pequena ferramenta doméstica, com poucos controlos visíveis. Não criar um dashboard administrativo com estatísticas, gráficos ou cartões de funcionalidades.

### Navegação

Três entradas fixas em baixo, sempre com ícone e texto:

**Casa · Privado · Arquivos**

A barra mantém-se dentro da largura da aplicação no computador. Respeita `safe-area-inset-bottom` no iPhone e reserva espaço no conteúdo para não tapar o último elemento.

Pesquisa e acesso à conta ficam no topo. Definições não são um quarto separador principal.

Ao abrir o teclado, o campo ativo e as ações do editor devem continuar visíveis. Testar isto; não assumir que `position: fixed` resolve todos os casos.

### Casa

Ordem:

1. Cabeçalho simples.
2. Post-its ativos.
3. Criação rápida de tarefa.
4. Tarefas abertas.
5. Resolvidas, recolhidas por defeito.

Estado vazio: **“O que é preciso fazer em casa?”**, acompanhado do campo de criação. Não preencher com tarefas fictícias em produção.

#### Criar uma tarefa

Campo com placeholder **“O que é preciso fazer?”** e botão **Adicionar**.

Enter ou clique cria a tarefa. O único campo obrigatório é o título.

Depois de criada, aparece imediatamente na lista e o campo limpa-se apenas quando a gravação local for confirmada. Se a gravação local falhar, conservar o texto no campo.

Não abrir um formulário antes de permitir criar uma tarefa.

#### Cartão de tarefa

- Checkbox grande à esquerda.
- Título destacado.
- Prazo e responsáveis abaixo, quando existem.
- Urgência visível apenas se diferente de normal.
- Descrição longa e checklist no detalhe, sem ocupar a lista inteira.
- Tocar no cartão abre o detalhe.
- Tocar no checkbox conclui sem abrir o detalhe.

Concluir risca o título e move a tarefa para Resolvidas. Mostrar **Desfazer** durante alguns segundos. Reabrir também está disponível nas Resolvidas.

Concluir é um estado comum: resolve para toda a família.

#### Editar uma tarefa

No detalhe:

- Título.
- **Quando?**
- **Quem?**
- **Mais opções**.

Em Mais opções:

- Descrição.
- Checklist.
- Urgência.
- Lembrete ligado/desligado.

Permitir zero, um ou vários responsáveis. Não exigir responsável para guardar.

Nesta entrega, prazo tem apenas:

- Sem data.
- Data sem hora.
- Data com hora.

Agrupar na seguinte ordem e esconder grupos vazios:

**Em atraso → Hoje → Amanhã → Esta semana → Este mês → Este ano → Mais tarde → Sem data**

Cada tarefa aparece num único grupo. Os grupos são calculados em Lisboa. A semana começa à segunda-feira.

Uma tarefa com apenas data fica atrasada no dia seguinte. Uma tarefa com hora fica atrasada depois dessa hora. Ordenar cronologicamente; no mesmo dia, primeiro tarefas com hora.

### Privado

Todas as notas desta primeira entrega são privadas do autor. Nem o administrador pode abri-las através da aplicação.

A página apresenta notas e listas, botão **Nova nota** e pesquisa.

O editor tem:

- Título.
- Corpo com formatação visível.
- Negrito, itálico, títulos, links, listas e checkboxes.
- Gravação automática.
- Importar e exportar `.md`.

Não mostrar Markdown cru por defeito. Usar Tiptap e guardar o documento estruturado, não HTML arbitrário.

Criar uma nota abre diretamente o editor. Não exigir escolher tipo, pasta, formato ou visibilidade.

Importar Markdown cria uma nota privada nova. Exportar gera um ficheiro legível.

### Arquivos

Nesta primeira entrega, **Arquivos é um espaço comum da família**. Mostrar isto discretamente na página: **“Partilhado com a família”**.

Criar duas pastas iniciais:

- Casa.
- Documentos da família.

Não chamar “Documentos pessoais” a uma pasta comum, porque sugeriria uma privacidade que não existe.

Permitir:

- Criar e renomear pastas e subpastas.
- Criar notas de arquivo.
- Carregar fotografias, PDFs e outros ficheiros.
- Abrir/descarregar ficheiros.
- Mover entradas.
- Enviar para o caixote e restaurar.

Tamanho máximo inicial: **15 MB por ficheiro**. Recusar antes do upload quando possível e confirmar o limite no servidor.

Mostrar caminho navegável por pastas. Não construir uma árvore lateral.

Fotografias e PDFs podem ter pré-visualização; outros formatos oferecem download. HTML e SVG enviados pelo utilizador não são executados dentro da origem da app.

### Post-its

Qualquer entrada do arquivo comum pode ser afixada na Casa com **Afixar na Casa**.

Nesta primeira entrega, o post-it aparece a toda a família, porque o original também é comum.

- Fundo amarelo.
- Pequeno pin desenhado a preto, sem emoji.
- Título e resumo.
- Tocar abre o original.
- **Mostrar na pasta** disponível no detalhe.
- O autor pode retirar o post-it.
- Retirar não apaga o original.
- Apagar o original retira o post-it da Casa; restaurar não volta a afixá-lo sozinho.

Post-its aparecem em coluna, sem carrossel horizontal.

### Definições

Mostrar apenas:

- Conta atual.
- Notificações neste dispositivo.
- Enviar notificação de teste.
- Texto maior.
- Instalar a app, quando aplicável.
- Estado de sincronização e problemas pendentes.
- Terminar sessão.

Só o administrador vê a gestão de membros.

Não mostrar configurações da Drive nesta entrega.

---

## 3. Contratos técnicos que não deves improvisar

### Stack

Usar:

- React + TypeScript + Vite.
- `@cloudflare/vite-plugin`.
- Cloudflare Workers com Static Assets.
- D1 para dados e sessões.
- R2 privado para ficheiros.
- Better Auth com Google.
- Zod para validação partilhada.
- Dexie para armazenamento local.
- Tiptap para notas.
- `date-fns` e `@date-fns/tz` para calendário e Lisboa.
- Vitest, testes D1/R2 locais e Playwright.
- Uma biblioteca Web Push compatível com Workers; não implementar criptografia de push à mão.

Fixar versões no lockfile. Manter todos os pacotes Tiptap na mesma versão compatível.

Não acrescentar Supabase, GitHub Pages, Firebase, Next.js, um segundo backend ou um ORM adicional.

Usar SQL preparado no D1 e migrações versionadas. Better Auth pode receber diretamente o binding D1. [Documentação Better Auth](https://better-auth.com/docs/concepts/database)

### Estrutura

Organizar em:

```text
src/
  app/          navegação, arranque e sessão
  components/   componentes partilhados
  features/
    tasks/
    notes/
    archive/
    settings/
  lib/          cliente API, Dexie e sincronização

shared/         schemas, tipos e regras puras
worker/         rotas, autorização, dados, ficheiros e jobs
migrations/     SQL versionado
tests/          testes de regras e integração
e2e/            percursos no navegador
docs/           configuração, estado e verificações
public/         fontes, ícones e manifesto
```

Não criar antecipadamente módulos vazios para funcionalidades futuras.

### Configuração e publicação

Worker próprio, base D1 própria e bucket R2 próprio.

Bindings:

```text
DB
FILES
ASSETS
```

Variáveis públicas de configuração do Worker:

```text
APP_URL
ADMIN_EMAIL
VAPID_PUBLIC_KEY
VAPID_SUBJECT
```

Segredos:

```text
BETTER_AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
VAPID_PRIVATE_KEY
```

`ADMIN_EMAIL` inicial:

```text
atelierdacostafinanceiro@gmail.com
```

Não colocar segredos Google em variáveis `VITE_*`.

Servir `/api/*` pelo Worker antes da resolução de assets. Uma rota API desconhecida devolve JSON com 404; nunca devolve `index.html`.

Usar `/` como base da app, sem `/familia/` do antigo plano GitHub Pages.

Separar configuração local e produção. Um modo de demonstração só pode funcionar quando **a configuração o permite e o hostname é localhost/127.0.0.1**. A configuração de produção desativa-o explicitamente.

A falta de credenciais não pode impedir a compilação. Em execução, a falta de configuração produz mensagem clara e não um login falso.

### Autenticação: implementação prioritária

Usar redirecionamento Google na mesma janela, através do cliente Better Auth. Não criar um fluxo OAuth manual paralelo.

Configurar:

- `baseURL` com o `APP_URL` exato.
- Origens autorizadas explícitas.
- Provider Google com client ID e secret.
- Cookies seguros em produção.
- Sessão lida pelo servidor.
- Schema de autenticação correspondente à versão instalada.

Registar no Google o callback:

```text
https://ENDERECO-DA-APP/api/auth/callback/google
```

O callback de OAuth e o destino final dentro da app são coisas distintas. O utilizador regressa à Casa depois do callback. [Provider Google do Better Auth](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/google.mdx)

Gerar ou verificar o SQL exigido pela versão instalada; não adivinhar nomes de tabelas e colunas. Aplicar migrações localmente e na base remota antes do teste Google real.

#### Membros autorizados

A identidade é a conta autenticada, com email verificado pelo provider. Nunca aceitar um email enviado pelo frontend como prova de identidade.

Manter lista de emails autorizados. O administrador pode adicionar ou desativar membros.

O administrador inicial pode entrar sem aprovação prévia. A criação do seu registo é idempotente.

Para os restantes:

- Email autorizado: pode entrar.
- Email não autorizado: mostrar **“Esta conta não tem acesso à Família da Costa.”**
- Membro desativado: pedidos futuros são recusados mesmo que ainda exista cookie de sessão.

Usar identificador estável de membro, ligado à identidade autenticada. Não presumir que o ID de um convite criado antecipadamente é igual ao ID criado pelo Better Auth.

#### Máquina de estados do arranque

```ts
type AuthState =
  | { status: "checking" }
  | { status: "signedOut" }
  | { status: "ready"; member: Member }
  | { status: "offline"; member: Member }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };
```

Não usar um único booleano de loading para autenticação, carregamento de dados, uploads e Drive.

Sequência:

1. Mostrar a shell e estado de verificação.
2. Pedir `/api/session` com timeout de 15 segundos.
3. Em 200, validar resposta e abrir imediatamente a aplicação.
4. Carregar os dados separadamente, conservando a shell utilizável.
5. Em 401, mostrar entrada Google.
6. Em 403, mostrar conta recusada e opção de trocar de conta.
7. Em falha de rede, abrir dados locais da conta previamente conhecida, se existirem.
8. Em erro do servidor, resposta inválida ou timeout, mostrar erro e **Tentar novamente**.

Um `finally` não resolve um pedido que nunca termina: o timeout tem de cancelar ou limitar efetivamente a espera.

Uma resposta 401/403 não pode ser tratada como simples offline para contornar autorização.

Falha de IndexedDB mostra um erro próprio; não pode deixar a autenticação a carregar. Se não for possível conservar escritas, não mostrar “guardado”.

### API

As rotas Better Auth usam o formato da biblioteca. As restantes usam JSON consistente.

```ts
type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};
```

Estados:

| HTTP | Significado |
|---|---|
| 400 | Dados inválidos |
| 401 | Sem sessão válida |
| 403 | Conta sem acesso |
| 404 | Recurso inexistente ou não visível |
| 409 | Revisão em conflito |
| 413 | Ficheiro demasiado grande |
| 503 | Serviço indisponível ou configuração incompleta |

O cliente deve lidar também com respostas não JSON e falhas de rede.

Rotas de negócio:

```text
GET    /api/session
GET    /api/bootstrap
POST   /api/operations

POST   /api/uploads
PUT    /api/uploads/:id/content
POST   /api/uploads/:id/complete
GET    /api/files/:id/content

GET    /api/members
POST   /api/members
PATCH  /api/members/:id

POST   /api/push/subscribe
POST   /api/push/unsubscribe
POST   /api/push/test
```

`/api/bootstrap` devolve apenas conteúdos autorizados, incluindo o caixote visível.

Para esta escala familiar, usar **snapshot completo dos metadados autorizados**, sem anexos binários. Não construir já um protocolo incremental de eventos e cursores.

Produzir o snapshot com leitura consistente no D1. No cliente, aplicar o snapshot numa transação local, preservando rascunhos e operações pendentes.

Pedidos em simultâneo não devem permitir que uma resposta antiga substitua uma mais recente. Serializar as sincronizações no cliente.

### Modelo de dados mínimo

Todos os itens têm:

```ts
type ItemBase = {
  id: string;
  ownerId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
```

Tarefas:

```ts
type Task = ItemBase & {
  title: string;
  description: string;
  checklist: {
    id: string;
    text: string;
    done: boolean;
  }[];
  responsibleIds: string[];
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm; exige dueDate
  urgency: "normal" | "high";
  reminderEnabled: boolean;
  completedAt: string | null;
  completedBy: string | null;
};
```

Datas sem hora permanecem datas de calendário. Não converter `YYYY-MM-DD` em meia-noite UTC para depois apresentar localmente.

Notas guardam título e JSON Tiptap. Listas são notas com checkboxes, sem criar uma segunda implementação de editor.

Pastas têm pai opcional; validar ciclos ao mover. Ficheiros têm pasta, nome original, MIME, tamanho, versão e referência interna R2.

Post-its têm autor, entrada de arquivo, resumo e estado ativo.

Tabelas auxiliares:

- Membros e emails autorizados.
- Operações processadas.
- Registo de alterações.
- Uploads pendentes e versões de ficheiros.
- Subscrições push.
- Trabalhos e entregas de notificações.

O registo de alterações conserva versões anteriores, mesmo que a interface completa de histórico fique para depois.

### Regras de acesso

| Conteúdo | Leitura | Escrita |
|---|---|---|
| Tarefas da casa | Todos os membros ativos | Todos os membros ativos |
| Nota privada | Autor | Autor |
| Arquivo comum | Todos os membros ativos | Todos os membros ativos |
| Post-it | Todos os membros ativos | Autor; desativação automática se o original for apagado |
| Gestão de membros | Administrador | Administrador |

Aplicar no Worker em todas as rotas. Esconder botões não é autorização.

Pesquisa e downloads também passam por estas regras. Não permitir que IDs adivinhados abram notas privadas.

### Escritas, rascunhos e conflitos

```ts
type Operation = {
  operationId: string;
  entityId: string;
  expectedRevision: number; // 0 ao criar
  action: string;           // enum validado no servidor
  payload: unknown;        // schema por ação
};
```

Usar ações explícitas como criar tarefa, editar tarefa, concluir, guardar nota, mover arquivo, apagar e restaurar. Não aceitar uma ação arbitrária nem SQL enviado pelo cliente.

O servidor:

1. Verifica membro e acesso.
2. Valida conteúdo.
3. Confirma revisão.
4. Grava alteração, histórico, recibo da operação e jobs associados atomicamente.
5. Devolve o estado confirmado.

Duas operações com o mesmo ID e conteúdo têm o mesmo resultado. O mesmo ID com conteúdo diferente é recusado.

A verificação de revisão deve fazer parte da transação efetiva. Um `SELECT` seguido de um `UPDATE` desprotegido não evita concorrência. Um `UPDATE` que afeta zero linhas não pode ser seguido de auditoria e recibo de sucesso.

#### Fila local

Guardar no IndexedDB:

- Estado confirmado pelo servidor.
- Versão local desejada.
- Contador local de alterações.
- Pedido em curso, com ID e payload imutáveis.
- Estado de conflito, quando existe.

Por item, enviar um pedido de cada vez.

Se o utilizador continuar a escrever enquanto há um pedido em curso:

- Manter as novas alterações locais.
- Repetir o pedido em curso sem mudar o seu conteúdo.
- Ao receber confirmação, usar a nova revisão como base do pedido seguinte.
- Nunca marcar alterações posteriores como sincronizadas por engano.

Gravar localmente primeiro. Para notas, usar atraso curto de gravação local e um atraso maior para envio; descarregar imediatamente a fila local ao sair do editor. Não depender apenas de `beforeunload`.

Sincronizar ao abrir a app, recuperar rede, regressar à janela e a cada 30 segundos enquanto visível.

#### Conflitos

Em 409, conservar:

- Versão atual do servidor.
- Proposta local mais recente.

Mostrar **“Este conteúdo também foi alterado noutro dispositivo.”**

Ações:

- Usar versão atual.
- Aplicar a minha versão.
- Guardar como cópia.

Aplicar a minha versão envia uma nova operação contra a revisão agora apresentada. Não criar um endpoint que force escritas sem verificar revisão.

Outros itens continuam a sincronizar.

Apagar prevalece sobre uma edição atrasada: conservar o rascunho e permitir criar uma cópia, sem restaurar automaticamente o original.

### R2 e uploads

Bucket privado, sem URL pública permanente.

Fluxo:

1. Criar registo de upload pendente com ID estável, nome, tamanho e hash.
2. Enviar bytes para uma chave R2 própria desse upload.
3. Confirmar presença e metadados.
4. Finalizar a entrada de arquivo no D1.
5. Só então mostrar upload concluído.

Uma falha entre R2 e D1 deixa upload pendente retomável. Não tratar os dois serviços como uma transação única.

Repetir o mesmo upload não duplica a entrada. O servidor valida tamanho e integridade, e rejeita reutilização do ID com conteúdo diferente.

Objetos finalizados são imutáveis. Substituir um ficheiro cria nova versão.

Conservar o ficheiro local enquanto o envio estiver pendente, desde que o dispositivo tenha espaço. Falta de espaço deixa erro explícito e não uma falsa confirmação.

### Notificações

Uma tarefa com dia e hora ativa o lembrete por defeito. Se não tiver responsáveis, lembrar o autor. Se tiver responsáveis, lembrar esses membros.

Permissão do dispositivo só é pedida após clique em **Ativar notificações**.

Sem hora, sem alarme. Desativar o lembrete não apaga prazo nem tarefa.

Cron a cada minuto:

- Busca trabalhos vencidos.
- Confirma que tarefa continua aberta.
- Confirma horário, destinatários e acesso atuais.
- Envia por dispositivo.
- Regista resultado e tentativas.
- Invalida subscrições expiradas.
- Repete falhas transitórias com espera progressiva.

Editar apenas o título não cria outro lembrete. Reagendar ou concluir cancela os trabalhos antigos.

Usar identificador estável por entrega e tag de notificação. Não prometer entrega exatamente uma vez nem hora exata garantida pelo sistema operativo.

Conteúdo: **“Tem uma tarefa para consultar.”** Abre diretamente a tarefa após validar sessão.

### PWA

Usar service worker próprio nesta entrega, evitando outra camada de configuração de geração:

- Cache apenas da shell, fontes e assets.
- Nunca guardar respostas API no cache público.
- Handler de push e de clique.
- Cache com versão.
- Manifesto, ícones e instalação.
- Atualização apenas após ação do utilizador.

Não ativar atualização imediata automática. Ao atualizar, confirmar primeiro a gravação local do editor.

Se houver dados pendentes ao terminar sessão, apresentar opções de sincronizar, exportar antes de sair ou cancelar. Não apagar silenciosamente.

---

## 4. Marcos de execução e testes obrigatórios

### M0 — Fundação reproduzível

**Implementar**

Projeto, scripts, Worker, D1 local, configuração de produção, schemas, tratamento JSON de erros e shell mínima.

Scripts obrigatórios:

```text
pnpm dev
pnpm check
pnpm test
pnpm test:e2e
pnpm build
pnpm db:local
pnpm db:remote
pnpm deploy
```

`deploy` deve executar preflight de configuração e impedir publicação com IDs provisórios ou `APP_URL` local.

**Aceitação**

- Uma instalação limpa compila.
- `/api/rota-inexistente` devolve JSON 404.
- API privada sem sessão devolve 401.
- Assets e API funcionam no mesmo endereço.
- Nenhum segredo entra no bundle.

**Não fazer ainda:** editor, Drive, notificações ou decoração.

### M1 — Google realmente funcional

**Implementar**

Better Auth, migrações, lista autorizada, arranque com timeout, saída e troca de conta.

**Teste real obrigatório**

1. Abrir o endereço publicado numa janela sem sessão.
2. Entrar com a conta administradora.
3. Confirmar que a Casa aparece.
4. Recarregar.
5. Fechar e voltar a abrir.
6. Terminar sessão e voltar a entrar.
7. Testar conta não autorizada.
8. Confirmar ausência de redirecionamentos repetidos e erros JavaScript.

**Testes simulados adicionais**

- `/api/session` nunca responde.
- Responde 500.
- Responde HTML.
- Responde JSON inválido.
- Responde 401 ou 403.
- IndexedDB falha.
- Carregamento dos dados falha depois de a sessão ser validada.

Em todos estes cenários, o ecrã sai do carregamento e oferece uma ação compreensível.

**Diagnóstico se falhar**

Inspecionar por esta ordem:

1. URL e parâmetros do callback.
2. Estado da resposta do callback.
3. Cookie definido e enviado no pedido seguinte.
4. Resposta de `/api/session`.
5. Migrações da base remota correta.
6. Relação entre identidade Google e membro autorizado.
7. Exceção de parsing ou armazenamento local.
8. Estado React que não foi atualizado.

Não responder ao problema com novas tentativas infinitas, timeouts maiores ou autenticação desligada.

Se depender de um clique/credencial do utilizador, registar o passo exato. Trabalho local pode continuar, mas M1 permanece pendente e a aplicação não pode ser declarada entregue.

### M2 — Interface e tarefas de ponta a ponta

**Implementar**

Navegação inferior, fontes, criação rápida, cartões, detalhe, responsáveis, datas, conclusão e caixote.

**Aceitação**

- Criar só com título.
- Recarregar e encontrar a tarefa.
- Editar título.
- Definir e remover prazo.
- Atribuir dois responsáveis.
- Concluir, desfazer e reabrir.
- Apagar e restaurar.
- Ver a alteração noutra sessão autorizada.

Testar agrupamento com relógio controlado nas mudanças de dia, mês, ano e hora legal.

Capturar interface a 320, 390, 768 e 1920 px. Corrigir sobreposições e scroll horizontal antes de avançar.

### M3 — Gravação local e sincronização resistente

**Implementar**

Dexie, fila persistente, estados de gravação, recuperação offline e revisão de conflitos.

**Aceitação**

1. Criar offline, fechar, reabrir e recuperar rede.
2. Editar durante um pedido lento.
3. Deixar o servidor gravar e perder a resposta; repetir sem duplicar.
4. Editar a mesma tarefa em duas sessões.
5. Resolver conflito sem perder qualquer versão.
6. Apagar num dispositivo e editar offline no outro.
7. Expirar sessão com trabalho pendente.
8. Simular armazenamento local cheio.

Uma indicação **Sincronizado** com alterações ainda pendentes reprova o marco.

### M4 — Notas e listas privadas

**Implementar**

Tiptap, gravação automática, checkboxes, importação/exportação Markdown e pesquisa privada.

**Aceitação**

- Escrever, navegar para Casa, regressar e encontrar o texto.
- Fechar e reabrir offline.
- Escrever durante sincronização lenta.
- Importar e exportar Markdown legível.
- Outra conta recebe 404 ao pedir a nota pelo ID.
- O administrador também não a lê.
- Pesquisa de outra conta não revela título nem excertos.
- Conteúdo importado não executa HTML ou JavaScript.

### M5 — Arquivos, R2 e post-its

**Implementar**

Pastas, notas comuns, uploads, downloads, caixote e post-its.

**Aceitação**

- Carregar um PDF e uma fotografia.
- Repetir um envio interrompido sem duplicar.
- Recusar ficheiro acima do limite.
- Renomear e mover sem perder o anexo.
- Recusar mover pasta para dentro de um descendente.
- Descarregar os mesmos bytes enviados.
- Recusar download sem sessão.
- Afixar arquivo na Casa e retirar sem o apagar.
- Apagar original e confirmar retirada do post-it.
- Restaurar pasta e os seus conteúdos preservando a organização.

### M6 — Notificações e instalação

**Implementar**

Subscrições por dispositivo, Cron, retentativas, clique, PWA e atualização segura.

**Aceitação**

- Ativar notificações por clique.
- Receber aviso de teste.
- Agendar tarefa próxima.
- Concluir antes da hora e não enviar.
- Reagendar e cancelar o horário anterior.
- Editar título sem duplicar o aviso.
- Desativar membro antes do envio.
- Abrir tarefa a partir do aviso.
- Publicar nova versão com nota aberta e atualizar sem perder texto.

Entrega real em computador e testes iPhone/Android devem ser identificados separadamente. No iPhone, explicar a instalação no ecrã principal. Não declarar aparelhos testados se apenas usaste emulação de viewport.

### M7 — Revisão final para o utilizador trazer de volta

Percurso completo:

> Entrar → criar tarefa → atribuir → concluir → criar nota privada → anexar PDF → afixar post-it → perder rede → escrever → recuperar rede → recarregar → confirmar dados.

Executar com duas contas e dois contextos de navegador isolados.

Entregar:

- Endereço publicado.
- Commit e versão publicados.
- Capturas móvel e computador.
- Resultado dos comandos de verificação.
- Testes reais Google e push realizados.
- Problemas conhecidos.
- Funcionalidades adiadas, sem as apresentar como prontas.
- Guia curto para entrar, instalar e usar.

Parar nesta entrega para revisão do utilizador. Não começar o espelho Drive automaticamente.

---

## 5. Prompts de controlo e material de passagem

### Prompt inicial para colar no Zcode

> Lê integralmente este guião antes de alterar código. Inspeciona o repositório e identifica se existe uma implementação anterior. Usa este documento como especificação da primeira entrega da Família da Costa. Trabalha pelos marcos M0 a M7, com implementação, testes e verificação no navegador em cada marco. Começa por M0 e M1: a entrada Google no endereço publicado e a eliminação de carregamentos infinitos são a prioridade. Não implementes Drive, Yjs, recorrência ou partilha seletiva nesta entrega. Mantém `docs/ESTADO.md` com evidência verificável. Não declares um marco concluído por compilar ou por ter testes simulados; executa os percursos de aceitação indicados. Se houver um bloqueio externo, explica o passo concreto e continua apenas no trabalho independente.

### Prompt para continuar após mudança de contexto

> Lê o guião e `docs/ESTADO.md`. Inspeciona o código atual e o último resultado das verificações. Retoma o primeiro marco incompleto sem reconstruir funcionalidades já aprovadas. Corrige as falhas existentes antes de acrescentar funcionalidades. Mantém os contratos de autenticação, autorização, revisão e persistência. No fim, atualiza o estado com o que executaste e o que continua por verificar.

### Prompt se o modelo voltar a ficar preso no login

> Suspende o desenvolvimento das outras funcionalidades. Reproduz o percurso Google no endereço publicado e identifica o primeiro pedido ou transição que falha. Verifica callback, cookie, `/api/session`, schema D1 e associação ao membro autorizado. Mostra a causa sustentada por evidência, sem expor tokens. Corrige a causa e acrescenta um teste de regressão. Não contornes o erro com login falso, mais tempo de espera, retries infinitos ou remoção de validações. Confirma que sucesso, recusa e falha saem do estado de carregamento.

### Formato de `docs/ESTADO.md`

```text
Marco atual:
Último commit:
Endereço publicado:
Versão publicada:

Concluído e verificado:
- Funcionalidade:
- Como foi verificada:
- Resultado:

Testes executados:
- Comando:
- Resultado:

Por verificar:
- Percurso:
- Motivo:

Problemas conhecidos:
- Como reproduzir:
- Impacto:
- Próxima correção:

Bloqueios externos:
- Ação exata necessária:
- Trabalho que pode continuar:

Próximo marco:
```

### Decisões reservadas para depois da revisão

Quando a primeira entrega estiver estável, a evolução já escolhida é:

- Uma Drive escolhida por pessoa, podendo ser diferente da conta de entrada.
- Espelho automático com a app fechada.
- Originais em R2.
- Pasta `familia` com ficheiros normais e notas Markdown.
- OAuth Drive separado, `drive.file`, tokens protegidos no servidor.
- Partilha seletiva e post-its destinados a pessoas específicas.
- Repetição e períodos vagos.
- Eventual colaboração simultânea.

Não implementar antecipadamente tabelas, interfaces ou configurações destes módulos por “preparação”. Preservar IDs estáveis, versões e separação entre autorização, conteúdo e armazenamento é a preparação suficiente.

**Critério final:** uma pessoa autorizada consegue entrar e usar as funções básicas sem conhecer a arquitetura, sem configurar cada operação e sem recear que o que escreveu desapareça.
