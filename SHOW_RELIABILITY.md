# Caixa Preta — auditoria de confiabilidade do espetáculo

Auditoria estática do código da branch `main`, realizada em 2026-09-28.

Nota de fechamento em 2026-10-14: a camada de recuperação, emergência, fallback, health e contenção pública descrita ao final foi versionada em `ajustes-28-09`. A matriz inicial preserva os riscos encontrados na auditoria histórica; para resultados end-to-end atuais e limites de aceitação, consulte `BOT_TEST_REPORT.md`.

## 1. Objetivo e critério de segurança

O critério principal é operacional, não apenas técnico:

> Nenhuma falha de internet, IA, navegador, mídia, microfone, dispositivo externo ou módulo secundário pode obrigar a interromper a peça inteira.

O desenho recomendado mantém o princípio já adotado pelo projeto: uma única autoridade local em `lib/showState.js`, comunicação local por SSE e interfaces públicas separadas das interfaces privadas. As melhorias devem ampliar essas estruturas; não devem criar um segundo sistema de estado ou uma segunda dramaturgia.

Hierarquia de dependências desejada:

1. **Core local:** estado da peça, progressão manual, texto fallback, timers, projeção, áudio essencial e assets essenciais.
2. **Enhancement local:** automações, efeitos e módulos que podem ser ignorados ou reiniciados isoladamente.
3. **Enhancement online:** OpenAI, pesquisa web, Instagram e qualquer navegação externa.

## 2. Escopo e limites desta auditoria

Foram inspecionados:

- arquitetura descrita em `AGENTS.md` e `docs/brain/`;
- scripts de execução e dependências em `package.json`;
- `showState`, SSE, snapshot público, projeção e rotas de controle;
- chamadas OpenAI, pesquisa web e Instagram/Playwright;
- timers, transições, controles manuais e cancelamentos da Cena Zero;
- áudio, microfone, assets, fontes e configuração de cues;
- telas públicas, tratamento de erros e mecanismos de parada;
- persistências locais já existentes.

Não foram realizados nesta auditoria:

- ensaio com projetor, interface de áudio, caixas e microfone físicos;
- teste de suspensão/retorno do macOS durante uma sessão;
- queda real de roteador ou troca de rede durante a peça;
- login e publicação reais no Instagram;
- chamada real à OpenAI;
- medição de memória durante uma apresentação completa;
- teste de retomada, pois a retomada ainda não existe.

Esses itens permanecem como aceitação física/operacional, mesmo que os testes estáticos e de navegador passem.

## Atualização de implementação — fase crítica 1 (2026-09-28)

Esta fase foi implementada sem substituir `showState`, SSE, typewriter ou gates manuais:

- snapshot assíncrono, atômico, versionado e com checksum em `.runtime/show/current.json`;
- escolha explícita no Operator entre retomar snapshot válido e iniciar nova apresentação;
- retomada segura com timers pausados, mídia/eventos transitórios parados, projeções desconectadas e navegador externo fechado;
- boundary pública e páginas de erro/404 diegéticas com `SINAL INTERROMPIDO`; detalhe real permanece privado;
- deadline global de 8 segundos para chamadas OpenAI usadas em cena, configurável por `OPENAI_SHOW_TIMEOUT_MS` entre 1 e 15 segundos;
- fallback textual local contextual publicado pelo fluxo normal do chat e typewriter;
- Modo Emergência persistente, reversível e privado, bloqueando requests externos sem bloquear controles locais;
- `/api/health` com core local separado de internet/OpenAI opcionais;
- `npm run show:prepare` e `npm run show` para build e execução de produção com verificação de storage, porta e health local.

O escopo propositalmente não inclui supervisor/restart automático, rotação de snapshots, circuit breaker temporal, pre-flight completo, telemetria física nem biblioteca extensa de falas. Esses pontos continuam nas fases posteriores.

## 3. Arquitetura atual observada

### Núcleo local

- Next.js 15/React 19, com servidor e browser normalmente no mesmo Mac.
- `lib/showState.js` é a autoridade de estado em memória. Ele contém conversa, mensagem pública, Cena Zero, timers, jogos, malas, projeções, glitch, áudio, Instagram e eventos performáticos.
- `app/api/events/route.js` distribui snapshots e eventos por SSE.
- `lib/publicRealtime.js` mantém um único `EventSource`, compara revisões e busca um snapshot completo quando detecta atraso.
- A tela pública preserva o último quadro durante interrupções breves de SSE.
- Janelas públicas registram heartbeat a cada 5 segundos por `components/ProjectionWindowClient.js`; o backend considera a janela desconectada após 60 segundos sem heartbeat.
- Principal e Videomapping reutilizam `components/Chat.js`; a troca entre esses dois layouts não recarrega o componente.

### Dependências online encontradas

- OpenAI Responses API em `lib/openai.js`.
- Pesquisa web hospedada via ferramenta da OpenAI.
- Instagram, Google e Bing via Playwright em `lib/instagram/InstagramController.js`.
- Não foi encontrada dependência ativa de Azure, banco externo, WebSocket, Socket.IO, NDI, OSC, MIDI, Kinect ou Resolume no código atual.
- O SSE usado pela peça é local, por HTTP, e não exige internet quando servidor e navegadores continuam na rede local.

### Assets e persistências já locais

- Fontes Modern DOS estão em `public/fonts/modern-dos/`.
- Áudios, vídeos e imagens da peça são servidos de `assets/` por `/api/game-assets`, com suporte a byte ranges.
- Os 14 cues configurados com arquivo em `data/controller-cues.json` apontam para arquivos existentes.
- Os três vídeos declarados no manifesto da Força G existem.
- Os assets constantes da Cena Zero inspecionados — aeroporto, Tea for Two, Evidências, Uba Uba Hey e referência de visão em túnel — existem localmente.
- Há 12 cues não textuais ainda sem `assetPath`: um em Força G samples, três em Força G shaders, quatro em Piloto Videogame e quatro em Tecnologia × Floresta. Eles são conteúdo incompleto, não falha de download.
- Configurações de cues, notas e ajustes do sampler são persistidas em JSON. O estado vivo da peça não é.

### Proteções já existentes que devem ser preservadas

- Separação entre projeção pública e controles privados.
- Reconciliação de SSE por revisão e retenção do último frame público.
- `STOP ALL`, cancelamento de rotinas e stops específicos por módulo.
- Pausar/retomar timers, pular minigame, forçar resultado e recuperação manual de malas em partes relevantes do fluxo.
- Fallback manual do sound check: `PULAR · MICROFONE FALHOU`.
- Heartbeat e registro de janelas de projeção.
- Assets essenciais majoritariamente locais.
- Login do Instagram deliberadamente manual e navegação externa dependente de ação do operador.

## 4. Resumo executivo de riscos

| ID | Severidade | Risco confirmado | Impacto provável durante a peça |
| --- | --- | --- | --- |
| R01 | **CRÍTICO** | `showState` existe apenas em memória | Reiniciar o servidor perde cena, etapa, participante, placar, timers e mensagens |
| R02 | **CRÍTICO** | Resposta principal da OpenAI não tem deadline curto nem fallback local equivalente | Chat pode ficar pendente ou falhar, expondo erro e bloqueando uma passagem dependente de fala |
| R03 | **CRÍTICO** | Erro do chat é renderizado na tela pública | Plateia vê texto técnico como “A Caixa Preta nao respondeu agora” |
| R04 | **CRÍTICO** | Não há error boundary pública diegética | Exceção React/renderização pode substituir a peça por erro, página vazia ou tela técnica |
| R05 | **CRÍTICO** | Operação documentada ainda começa por `npm run dev`; não há `npm run show`, supervisor ou health check | Terminal fechado, crash ou processo antigo na porta 3000 pode interromper a sessão |
| R06 | **ALTO** | `STOP ALL` não é um Modo Emergência persistente/manual | Para rotinas, mas não converte toda a peça para controle manual nem protege contra novas automações |
| R07 | **ALTO** | Muitas chamadas locais `fetch` não têm timeout | Uma rota travada pode deixar botão e estado `pending` presos |
| R08 | **ALTO** | Heartbeat de projeção detecta ausência, mas registro/heartbeat engolem erros e não há recuperação guiada | Operador pode descobrir tarde que a janela pública fechou ou foi para outra tela |
| R09 | **ALTO** | Não há pre-flight consolidado nem verificação de assets essenciais | Arquivo ausente, permissão ou saída errada só aparecem no meio da peça |
| R10 | **ALTO** | Áudio depende de gesto, contexto do browser e saída física; validação é distribuída | Som lógico pode estar “tocando” e a sala permanecer muda |
| R11 | **ALTO** | Microfone tem skip, mas não detecção robusta de congelamento/troca nem simulador contínuo | Sound check pode ficar zerado ou incoerente até intervenção manual |
| R12 | **ALTO** | Timers vivem como callbacks do processo e não são restauráveis | Restart perde callbacks; aba suspensa pode atrasar ações de apresentação |
| R13 | **ALTO** | Instagram/Playwright e pesquisa podem ocupar recursos e produzir latências longas | Enhancement externo compete com o núcleo local e pode prender ações do operador |
| R14 | **MÉDIO** | Não há detecção de fullscreen, resolução, monitor ou cursor para a maioria das telas | Mudança de monitor/desktop pode expor chrome, cursor ou layout inadequado |
| R15 | **MÉDIO** | Logs existem em fragmentos e em memória, sem arquivo leve/exportação de sessão | Incidente não pode ser reconstruído depois de crash/restart |
| R16 | **MÉDIO** | 12 pads/cues estão vazios e não há classificação essencial/opcional | Operador pode presumir que um botão está pronto quando não está |
| R17 | **MÉDIO** | Vídeos do Baralho chegam a 88 MB e são servidos pelo mesmo processo | Primeiro uso pode causar atraso de disco/decodificação sem preload |
| R18 | **BAIXO** | Ausência atual de integrações MIDI/OSC/NDI/Kinect significa ausência de fallback específico | Não bloqueia o sistema atual; precisa ser reavaliado quando essas integrações entrarem |

## 5. Matriz Plano A / Plano B / Plano C

### 5.1 Internet e Wi-Fi

**O que pode falhar:** link externo, DNS, OpenAI, Instagram, Google/Bing, roteador, rede local entre Mac operador e telas remotas.

**Detecção automática recomendada:**

- `GET /api/health` local a cada 2 s, sem depender de internet;
- probe externo barato, no servidor, a cada 15 s e com timeout de 1,5 s;
- circuito separado para OpenAI e Instagram, baseado em resultado real e latência;
- status de cada projeção pelo heartbeat existente;
- jamais usar apenas `navigator.onLine`, que indica interface de rede e não acesso real.

| Plano | Comportamento |
| --- | --- |
| **A — online** | OpenAI, pesquisa e Instagram disponíveis. O core continua local. Cada chamada externa possui deadline, cancelamento e circuit breaker. |
| **B — internet caiu, LAN funciona** | Abrir circuito dos serviços externos após 2 falhas consecutivas; parar retries automáticos por 30 s; falar por fallback local; Instagram some dos próximos passos automáticos; painel privado mostra `DEGRADED`; SSE e controles locais continuam. |
| **C — Wi-Fi/LAN caiu** | Servidor, operador e projeção principal devem estar no mesmo Mac. Usar `localhost`; fechar a dependência de telas remotas; operar pelo painel local; manter roteiro, fallback textual, mídias e áudio locais. Se a projeção estava em outro computador, mover cabo/saída para o Mac principal ou usar tela neutra física planejada. |

**Recuperação sem reiniciar a peça:** quando internet voltar, fechar o circuito somente depois de um probe explícito bem-sucedido. Não reenviar comentários, posts ou falas antigas. Online volta a ser enhancement a partir da próxima oportunidade.

### 5.2 IA e chatbot

**Falha atual confirmada:** `generateCaixaPretaTurn()` chama `responses.create()` sem deadline global de espetáculo. O único timeout explícito na área OpenAI cobre pesquisa hospedada; a geração central e os retries não têm limite curto próprio. O `fetch('/api/chat')` do browser tem `AbortController`, mas não agenda `abort()` por tempo. Em erro, `Chat.js` renderiza a mensagem na projeção pública.

**Implementação mínima recomendada:**

- adicionar `lib/showFallback.js`, puramente local, indexado por `scene`, `stage`, `intent`, `result` e `tone`;
- guardar de 5 a 12 variações por categoria: silêncio, sucesso, erro, interrupção, glitch, transição, final, jogo e reação do público;
- usar o mesmo `showState.addMessage()` e o mesmo typewriter; a origem pode ser `fallback-local`, mas não muda a apresentação visual;
- timeout total sugerido: 5 s para fala urgente, 8 s para fala normal e 12 s para pesquisa explicitamente opcional;
- após timeout, abortar, registrar `AI_TIMEOUT`, gerar fallback e liberar a interface;
- circuit breaker: após 2 falhas, ignorar OpenAI por 60 s; botão privado `TESTAR IA AGORA` reabre o circuito;
- oferecer no painel privado uma paleta de falas locais filtrada pelo estado atual e um campo manual já integrado ao fluxo normal.

| Plano | Comportamento |
| --- | --- |
| **A** | Gerar fala online dentro do deadline. Validar envelope e publicar pelo fluxo normal. |
| **B** | Timeout/erro/sem internet: selecionar resposta local contextual, publicar pelo mesmo typewriter e marcar apenas no painel `FALLBACK LOCAL`. |
| **C** | Modo Emergência: nunca chamar IA; operador escolhe fala local ou escreve uma linha manual; cenas e jogos continuam sem expectativa de resposta externa. |

**Regra de idempotência:** se a chamada online terminar depois do fallback, descartar o resultado atrasado por `requestId`/geração. Nunca publicar as duas falas.

### 5.3 Servidor local e processo

**Falha atual confirmada:** `package.json` contém `dev`, `build` e `start`, mas não `show`, health check ou supervisor. `require-port-3000.js` recusa a porta ocupada corretamente, porém não identifica nem reinicia o processo. Não há workflow de produção versionado.

**Implementação recomendada para `npm run show`:**

1. Verificar Node, espaço livre, acesso de leitura aos assets e escrita em `.runtime/show/`.
2. Verificar porta 3000 e informar PID/comando, sem matar nada automaticamente.
3. Exigir build já validado ou executar build antes da janela de apresentação, nunca enquanto `dev` está ativo.
4. Iniciar `next start --hostname 0.0.0.0 --port 3000` por um launcher Node pequeno.
5. Gravar PID e logs rotativos leves em `.runtime/show/`.
6. Fazer health check até ficar `ready`.
7. Abrir apenas `/operator` e deixar a projeção ser aberta pelo fluxo existente.
8. Opcionalmente usar `launchd` para reiniciar o processo; o launcher deve continuar sendo a interface simples do operador.

| Plano | Comportamento |
| --- | --- |
| **A** | Build de produção previamente validado, servidor persistente, health verde, sleep desativado e processo supervisionado. |
| **B** | Processo caiu: supervisor reinicia apenas Next; snapshot local é oferecido como `RETOMAR APRESENTAÇÃO`; projeção mantém uma tela neutra até reconectar. |
| **C** | Restart automático falhou: script `npm run show:recover` valida porta, inicia servidor e abre a retomada. A peça permanece em controle manual/local; não se reinstalam dependências nem se recompila durante a sessão. |

**Não fazer durante a apresentação:** `npm install`, `npm run build`, hot reload, limpeza de `.next`, troca de branch ou broad kill de processos Node.

### 5.4 Estado da peça e snapshots

**Falha atual confirmada:** `showState` usa singleton em `globalThis`, o que ajuda durante hot reload compatível, mas todo o estado é perdido quando o processo morre. Timers são referências em memória. O snapshot atual já reúne quase todo o conteúdo necessário, mas não há hidratação nem escrita em disco.

**Implementação recomendada, sem sistema paralelo:**

- manter `showState` como única autoridade;
- adicionar `serializeForRecovery()` e `restoreFromRecovery()` no próprio store;
- salvar atomicamente após cada `emit()`, com debounce máximo de 100 ms, em `.runtime/show/current.json.tmp` e renomear para `.runtime/show/current.json`;
- manter até 20 snapshots rotativos e um `last-known-good.json`;
- incluir `schemaVersion`, `storeVersion`, `sessionId`, `revision`, `savedAt` e checksum;
- excluir do snapshot credenciais, browser handles, streams, `AudioContext`, timers Node e dados privados desnecessários;
- transformar timers ativos em dados (`status`, `endsAt`, `remainingSeconds`, `sequence`), que em grande parte já existem;
- na restauração, **sempre pausar** timers ativos e recalcular `remainingSeconds`; nunca disparar automaticamente um timeout vencido enquanto o sistema estava fora;
- restaurar mídia como parada/pronta; o operador decide retomar som/vídeo;
- invalidar callbacks antigos por `sequence` e reagendar somente após confirmação do operador;
- projeções são transitórias: não restaurar `connected=true`; esperar novo heartbeat.

Campos mínimos de retomada:

- `conversation` e `publicMessage`;
- modo, cena, etapa e pending gate;
- Cena Zero completa, inclusive participante, malas, opened history, gincana, forca, glitch e blackout;
- timers com duração, restante e estado pausado;
- jogo, pontuação e rodada;
- cues/áudio declarativos, sem tentar reproduzir automaticamente;
- preferências do operador: volume, fonte, velocidade de digitação e modo manual;
- log e último fallback usado.

| Plano | Comportamento |
| --- | --- |
| **A** | Autosnapshot silencioso; operador não percebe. |
| **B** | Reload de aba: SSE entrega o estado atual do servidor; a aba reconstrói a visualização sem reset. |
| **C** | Restart de servidor: `/operator` mostra `RETOMAR APRESENTAÇÃO` com horário/cena/etapa; restaura tudo pausado, publica snapshot e só então o operador libera a próxima ação. |

### 5.5 Navegador e projeção

**Falhas atuais confirmadas:** registro e heartbeat existem, mas falhas de registro são ignoradas no cliente. Não há `error.js`, `global-error.js` ou `not-found.js` públicos específicos. Não há monitor de fullscreen/monitor/resolução. A principal projeção pode mostrar erro de chat.

**Implementação recomendada:**

- `app/global-error.js` e error boundary em torno da superfície pública, com tela preta/diegética `SINAL INTERROMPIDO` e tentativa segura de recarregar apenas o snapshot;
- `app/not-found.js` neutro, sem detalhes técnicos;
- remover todo erro técnico da árvore pública; enviar ao operador/log;
- status privado por janela: heartbeat, rota, viewport, `document.fullscreenElement`, visibilidade e último frame/revisão;
- botão `REABRIR PROJEÇÃO`, botão `REENVIAR SNAPSHOT` e instrução explícita de monitor/tela;
- ocultar cursor em todas as superfícies públicas após inatividade, não apenas no Baralho;
- detectar `resize`, `fullscreenchange`, `visibilitychange` e informar somente o operador;
- manter um cartão físico/arquivo de vídeo preto/glitch como contingência do projetor.

| Plano | Comportamento |
| --- | --- |
| **A** | Janela registrada, monitor correto, fullscreen e heartbeat verdes. |
| **B** | Aba recarregou/fechou: último quadro ou tela diegética; operador reabre a rota e o novo cliente recebe o snapshot atual. |
| **C** | Monitor/projetor falhou: a dramaturgia continua por áudio e comando presencial; operador aciona blackout/`SINAL INTERROMPIDO`; troca cabo/projetor sem resetar estado. |

### 5.6 Áudio

**Situação atual:** assets principais são locais; `RobotSoundEngine` reage a `visibilitychange` e `devicechange`; vários players capturam falha de `play()`. Isso não prova saída física. Não há uma única tela de teste esquerda/direita/microfone/assets.

**Implementação recomendada:**

- pre-flight com gesto explícito `ARMAR ÁUDIO` para criar/resumir `AudioContext`;
- teste de canal esquerdo, direito, centro, bot, música da Mala 2 e uma mídia por cena;
- indicador privado de `AudioContext.state`, erro de `play`, volume global e device change;
- arquivos essenciais marcados em um manifesto `data/show-assets.json`;
- preload controlado e teste de decodificação, não apenas HTTP 200;
- dispositivo Bluetooth tratado como opcional/frágil; para core, preferir saída cabeada/interface fixa;
- falha de áudio nunca deve impedir botão de avançar cena.

| Plano | Comportamento |
| --- | --- |
| **A** | Interface cabeada selecionada, canais e níveis conferidos, áudio armado por gesto. |
| **B** | Som específico falha: registrar, seguir sem ele ou usar cue substituto local; operador pode repetir/parar apenas aquele som. |
| **C** | Saída física falha: Modo Emergência silencia mídia, mantém texto/projeção e progressão; equipe troca a saída sem reiniciar a peça. |

### 5.7 Microfone e decibéis

**Situação atual:** o microfone é solicitado somente no controller, nunca na projeção. Estados bloqueado/inseguro/indisponível são reconhecidos. Existe `PULAR · MICROFONE FALHOU`. Falta simular nível continuamente e detectar track encerrada ou leitura congelada.

**Implementação recomendada:**

- escutar `track.onended`, `mute/unmute` e `devicechange`;
- watchdog: se a energia e timestamp não mudarem por 2 s enquanto deveria haver leitura, marcar `DEGRADED`;
- mostrar nome do input selecionado quando permitido pelo browser;
- botão/slider privado `SIMULAR DECIBÉIS`, usando a mesma action `unlock-sound-check-level` e sem trocar de lógica;
- botão `CONCLUIR MANUALMENTE` reaproveitando o skip já existente;
- nunca enviar dados brutos do microfone à projeção ou serviço externo.

| Plano | Comportamento |
| --- | --- |
| **A** | Medição real supera limiar e completa a prova. |
| **B** | Microfone errado/congelado: operador ajusta sensibilidade ou simula nível no mesmo medidor. |
| **C** | Sem microfone: `PULAR · MICROFONE FALHOU`; a plateia vê progressão coerente, não mensagem técnica. |

### 5.8 Jogos, malas, forca, seleção e timers

**Situação atual:** a Cena Zero já possui vários gates manuais e recuperação de malas; minigames permitem pause/resume/skip; gincana permite pause/resume, sucesso e falha; forca permite marcar erro e concluir; participante permite nova roleta. Os controles não são uniformes entre todos os módulos e não existe reset isolado padronizado para cada um.

**Contrato recomendado para todo módulo:**

- `pause`, `resume`, `previousSafeStep`, `nextSafeStep`;
- `manualSuccess`, `manualFailure`, `skip`;
- `resetModule`, sem reset global;
- `cancelPending`, invalidando callbacks por `sequence`;
- estado visível `automatic | manual | degraded`;
- nenhuma action deve depender de OpenAI para concluir mecanicamente.

| Plano | Comportamento |
| --- | --- |
| **A** | Fluxo normal e timers automáticos, com gates já autorados. |
| **B** | Bug no módulo: pausar módulo, escolher sucesso/falha/skip e seguir pelo estado normal seguinte. |
| **C** | Módulo inutilizável: `ISOLAR MÓDULO`, preservar placar/participante/log, publicar fala local de transição e entrar na próxima cena. |

**Ponto de atenção:** “voltar” deve voltar apenas para checkpoint seguro. Não deve tentar desfazer postagem externa, áudio já ouvido ou ação física já realizada.

### 5.9 Dispositivos externos

Dependências efetivas atuais:

- monitor/projetor ou tela secundária;
- microfone;
- saída/interface de áudio;
- opcionalmente outro computador/browser na LAN;
- Instagram/Playwright como navegador externo lógico.

Não há integração ativa de NDI, Resolume, câmera, Kinect, MIDI, OSC ou WebSocket no código inspecionado. Se forem adicionados, devem entrar no mesmo health registry antes de serem considerados core.

| Dispositivo | Plano A | Plano B | Plano C |
| --- | --- | --- | --- |
| Projeção | monitor dedicado em fullscreen | reabrir janela e retomar snapshot | continuar com áudio/ação física e tela neutra |
| Microfone | input fixo e testado | simular nível | pular prova sonora |
| Interface de áudio | cabeada e selecionada | trocar para saída interna/cabo reserva | seguir sem áudio automatizado |
| Browser remoto | SSE por LAN | reconectar ao mesmo servidor | operar/projetar no Mac principal |
| Instagram | login e rede válidos | declarar degraded e pular rotina | remover completamente do fluxo |

### 5.10 Assets e preload

**Situação atual:** os assets inspecionados são locais. O risco não é CDN, mas arquivo ausente, cue vazio, primeiro decode tardio, arquivo grande ou volume/disco insuficiente.

**Implementação recomendada:**

- `data/show-assets.json` com `id`, `path`, `kind`, `essential`, `scene`, `fallbackId`;
- endpoint local de preflight que valida existência, tamanho, leitura e MIME;
- browser faz preload/decode de assets essenciais e relata sucesso por asset;
- vídeos grandes do Baralho devem ter primeiro frame/metadata pré-carregados antes do público entrar;
- botão `INICIAR ESPETÁCULO` só exige itens `essential`; itens opcionais amarelos não bloqueiam;
- cues vazios aparecem claramente como `NÃO CONFIGURADO`, nunca como botão aparentemente pronto.

| Plano | Comportamento |
| --- | --- |
| **A** | Todos os essenciais validados e decodificados no pre-flight. |
| **B** | Asset opcional ausente: desabilitar cue e usar fallback local ou seguir sem ele. |
| **C** | Asset essencial ausente: bloquear início normal, oferecer modo manual sem aquele recurso e registrar aceitação explícita do operador. |

### 5.11 Painel de saúde

Adicionar uma faixa privada e pequena no Operator, alimentada por um registry local único:

| Item | Verde | Amarelo | Vermelho |
| --- | --- | --- | --- |
| Servidor | health < 500 ms | latência/restart recente | health falhou |
| Estado | snapshot gravado < 2 s | snapshot antigo | escrita inválida |
| Internet | probe recente | instável | offline |
| OpenAI | circuito fechado | lento/cooldown | circuito aberto |
| Instagram | pronto | login/manual/degraded | erro/offline |
| Projeção | heartbeat < 10 s | fullscreen/visibilidade incorreta | sem heartbeat > 15 s |
| Áudio | armado e teste OK | suspended/devicechange | indisponível |
| Microfone | leitura viva | baixo/alto/congelado | bloqueado/ausente |
| Assets | essenciais prontos | opcionais ausentes | essencial ausente |

Os probes devem ser baratos, escalonados e sem console ruidoso. O painel nunca entra no snapshot público nem no prompt da IA.

### 5.12 Modo Emergência

`STOP ALL` é uma base útil, mas o Modo Emergência precisa ser um estado operacional durável.

Ao ativar `MODO EMERGÊNCIA`:

1. gravar snapshot imediatamente;
2. abortar requests de IA/pesquisa/Instagram e abrir seus circuitos;
3. executar o stop local já existente para rotinas frágeis;
4. pausar timers, não zerá-los;
5. parar/recuar mídia opcional, mantendo tela pública montada;
6. forçar `manualMode=true` pelas actions normais;
7. habilitar fala local/manual, avançar, voltar a checkpoint, sucesso, falha e skip;
8. manter SSE, assets locais, áudio local escolhido e estado persistente;
9. exibir indicador apenas privado;
10. sair do modo apenas por confirmação do operador e sem reiniciar automações antigas.

| Plano | Comportamento |
| --- | --- |
| **A** | Não ativado; sistema normal. |
| **B** | Um módulo degradou: emergência parcial/isolar módulo. |
| **C** | Modo Emergência global: peça 100% manual, offline e restaurável. |

### 5.13 Pre-flight check

Criar `/operator/preflight` ou um painel no Operator, sem criar estado paralelo. Resultados entram em `showState.systemHealth` privado ou em um registry server-side separado que nunca é projetado.

**Essencial:**

- servidor de produção e `/api/health`;
- snapshot gravável/restaurável;
- assets marcados como essenciais;
- projeção registrada e com viewport esperado;
- áudio armado, L/R e volume;
- ao menos uma via de progressão manual;
- `STOP ALL` e Modo Emergência;
- sleep/prevenção de suspensão conferidos pelo launcher.

**Opcional:**

- internet;
- OpenAI;
- Instagram;
- pesquisa web;
- browser remoto;
- cues incompletos ou não usados naquela sessão.

O botão `INICIAR ESPETÁCULO` fica disponível quando todos os essenciais estão verdes ou quando o operador aceita explicitamente um fallback exibido. O sistema nunca bloqueia o início por item opcional.

### 5.14 Logs e exportação

Usar JSON Lines local, assíncrono e limitado:

```json
{"at":"2026-09-28T21:00:00.000Z","sessionId":"...","scene":"scene-zero","stage":"suitcases","level":"warn","event":"AI_TIMEOUT","fallback":"scene-zero.silence.2"}
```

Registrar somente:

- timestamp, sessionId e revision;
- cena, etapa e módulo;
- ação do operador/sistema;
- erro normalizado, duração e serviço;
- fallback/circuito usado;
- restore, restart e mudanças de health.

Não registrar:

- secrets, tokens ou credenciais;
- áudio do microfone;
- conteúdo privado de browser/profile;
- screenshots automáticos sem necessidade;
- snapshots inteiros a cada evento dentro do log.

Manter limite por arquivo e rotação por sessão. Oferecer `EXPORTAR LOG DA SESSÃO` depois da peça. Falha de logging nunca bloqueia o fluxo.

### 5.15 Fail-safe dramatúrgico

Falas locais devem ser discretas e funcionais. Exemplos de intenção, não texto definitivo:

- atraso breve: comentário de impaciência, sem dizer “API” ou “internet”;
- entrada indisponível: pedir repetição ou passar adiante;
- módulo isolado: glitch curto e frase de transição;
- projeção recuperando: `SINAL INTERROMPIDO` em tela preta, sem stack trace;
- silêncio deliberado: cursor e som local curto, sem spinner técnico.

Regras:

- usar fail-safe diegético apenas quando ele ajuda a continuidade;
- não transformar falhas repetidas em piada constante;
- nunca inventar sucesso de Instagram, sensor ou ação externa;
- toda fala fallback passa pelo mesmo sanitizador, `showState.addMessage()` e typewriter.

## 6. Pontos únicos de falha

1. **Um único processo Next:** hoje é simultaneamente store, API, SSE, media server e integração externa.
2. **Um único `showState` em RAM:** é correto como autoridade, mas não tem journal/snapshot persistente.
3. **Um único Mac principal:** é aceitável para Plano C, desde que energia, sleep, disco, saída de vídeo e áudio tenham contingência física.
4. **Um único browser público:** não há takeover automático; a recuperação é reabrir e sincronizar.
5. **Um único canal de resposta dinâmica online:** sem biblioteca local equivalente.
6. **Um único operador:** a interface precisa apresentar decisão pronta, não exigir terminal ou VS Code.

Não é recomendado introduzir Redis, banco cloud, Kubernetes ou microsserviços na rota crítica. Para este espetáculo, snapshot atômico local, supervisor local, fallbacks autorados e controles manuais oferecem mais confiabilidade com menos partes móveis.

## 7. Mudanças concretas recomendadas

### Fase 0 — antes do próximo ensaio com público

1. Não exibir `error` do chat na projeção; trocar por fallback local ou manter último quadro.
2. Adicionar timeout global e cancelamento à geração OpenAI.
3. Criar biblioteca local mínima para Cena Zero, transições e final.
4. Adicionar `app/global-error.js` e tela pública diegética.
5. Criar `/api/health` local.
6. Criar manifest/checker de assets essenciais.
7. Formalizar um checklist operacional manual enquanto a tela de pre-flight não existe.

**Critério de aceite:** desligar a internet no meio de uma fala não bloqueia controles, não mostra erro técnico e produz uma fala local em até 8 segundos.

### Fase 1 — impedir perda da sessão

1. Implementar snapshot atômico no próprio `showState`.
2. Implementar tela `RETOMAR APRESENTAÇÃO` no Operator.
3. Restaurar timers pausados e invalidar callbacks antigos.
4. Testar kill/restart em cada macroetapa da Cena Zero.
5. Persistir log leve por sessão.

**Critério de aceite:** matar o processo durante timer, mala e seleção; reiniciar; retomar em menos de 30 segundos sem repetir ações físicas nem avançar automaticamente.

### Fase 2 — operação de produção

1. Implementar `npm run show` e `npm run show:recover`.
2. Validar build previamente e iniciar `next start`.
3. Integrar supervisor/launchd e prevenção de sleep.
4. Criar health strip e pre-flight.
5. Adicionar detecção de fullscreen/viewport/visibilidade.

**Critério de aceite:** fechar o terminal não encerra a peça; matar apenas o processo Next causa restart e abre opção de retomada, sem rebuild.

### Fase 3 — uniformizar bypasses

1. Criar contrato comum de pause/resume/success/failure/skip/resetModule/checkpoint.
2. Cobrir todos os jogos e cenas sem remover gates existentes.
3. Adicionar `SIMULAR DECIBÉIS` e watchdog de microfone.
4. Implementar Modo Emergência global e isolamento por módulo.

**Critério de aceite:** cada módulo pode falhar artificialmente e ainda permite chegar à próxima cena por controles privados.

### Fase 4 — ensaio de caos controlado

Executar uma apresentação técnica completa injetando, um por vez:

- internet off/on;
- OpenAI timeout/500/resposta vazia;
- Instagram fechado/checkpoint;
- refresh e fechamento da projeção;
- kill/restart do servidor;
- permissão de microfone negada e input removido;
- `AudioContext` suspended e saída de áudio trocada;
- asset opcional 404 e asset essencial marcado como ausente;
- aba escondida por 30 s;
- duplo clique/dupla seta em cada gate;
- disco sem permissão de escrita para snapshot/log.

Cada teste deve registrar tempo de detecção, reação automática, ação manual, fallback público e tempo de recuperação.

## 8. Procedimento provisório para uma sessão hoje

Com a primeira fase implementada:

1. Reiniciar o Mac com antecedência e desativar sleep, notificações e updates automáticos.
2. Confirmar que a branch/checkout pretendida é a servida.
3. Parar qualquer `next dev`; executar `npm run show:prepare` antes da janela de apresentação e depois `npm run show`.
4. Confirmar que a porta 3000 pertence a este checkout.
5. Abrir Operator e projeção pelo fluxo registrado.
6. Testar `STOP ALL`, blackout, retorno, volume, bot, músicas, vídeos e microfone no hardware real.
7. Ensaiar o botão `PULAR · MICROFONE FALHOU`.
8. Operar Cena Zero em modo manual se a rede ou IA estiver instável.
9. Tratar Instagram e pesquisa como dispensáveis.
10. Manter um roteiro impresso com ordem das cenas, falas de transição, duração e ações manuais.
11. Em crash, reiniciar com `npm run show`, conferir cena/etapa/horário no Operator e escolher conscientemente `RETOMAR APRESENTAÇÃO`; liberar timers e mídia somente pelos controles manuais.

## 9. Decisões arquiteturais recomendadas

- **Manter:** singleton local `showState`, SSE, separação público/privado, typewriter comum, actions existentes e controle manual.
- **Adicionar:** persistência local atômica, deadlines, circuit breakers, fallback local, health/preflight, launcher e boundaries públicas.
- **Evitar:** banco ou serviço cloud no core; duplicar estado no browser; autoplay de recuperação; replay de ação externa; reset global como resposta a falha de módulo.
- **Regra de recuperação:** restaurar sempre em estado seguro e pausado; somente o operador autoriza retomar movimento, timer, som, vídeo ou serviço externo.

## 10. Evidência de validação desta auditoria

Executados com sucesso no worktree auditado:

- `npm run brain:sync`;
- `npm run brain:check`;
- `npm run lint`;
- `npm run build`;
- `npm run test:scene-zero`;
- `npm run test:audience-warmup` — 180 prompts validados;
- `npm run test:suitcases`;
- `npm run test:games`;
- `npm run test:robot-sound`;
- `npm run test:performance`;
- `npm run test:baralho-morbido`;
- `npm run test:forca-g-sampler`;
- `npm run test:internet-voice`;
- `npm run test:research`;
- `npm run test:instagram` — simulado/mocado, não publicação real;
- `npm run test:host-mode` — 70 turnos simulados.
- `npm run test:show-reliability` — snapshot, corrupção, timeout/offline, fallback, requests bloqueados/reabertos e optional health offline;
- `npm run test:show-reliability:scenario` — cenários A–D em produção: restart/retomada, nova sessão, OpenAI offline, boundary pública e Modo Emergência.

O build de produção concluiu com três warnings de Autoprefixer sobre valores `start`/`end` de flexbox em `OperatorConsole.module.css`, `SceneZeroController.module.css` e `SoundControlPanel.module.css`. Eles não bloquearam o build, mas devem ser corrigidos ou aceitos após teste no navegador de produção, especialmente se Safari fizer parte da operação.

O cenário de confiabilidade usou Chromium headless, servidor de produção e storage temporário isolado; não tocou Instagram real nem API OpenAI real. Os demais testes de navegador, ensaios físicos e caos com hardware continuam pendentes. Portanto, o resultado comprova a primeira camada de recuperação, não confiabilidade integral de apresentação.

## 11. Conclusão

O projeto agora cobre a primeira linha crítica contra perda de processo, indisponibilidade da IA e falha de renderização pública. `showState` continua sendo a única autoridade; persistência, fallback e emergência foram ligados aos fluxos existentes.

A sequência de maior retorno restante é:

1. executar ensaio de caos físico completo no teatro;
2. consolidar pre-flight de áudio, microfone, projeção, assets e dispositivos;
3. adicionar supervisor/restart controlado e rotação/last-known-good de snapshots;
4. uniformizar timeouts/bypasses locais fora do caminho OpenAI;
5. corrigir apenas depois os warnings CSS e cues vazios não essenciais.

O objetivo operacional continua sendo o Mac principal concluir a peça offline e sob controle manual. Isso agora está representado no software, mas ainda precisa ser confirmado com projetor, áudio, microfone e operação humana reais.
