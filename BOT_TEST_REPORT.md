# Caixa Preta Bot — auditoria e testes

Data: 14/10/2026, America/Sao_Paulo. Checkout: `ajustes-28-09`.

## 1. Resumo executivo

**Classificação: NÃO VALIDADO COMPLETAMENTE para apresentação real.**

A auditoria executou builds de produção, servidor real, Chromium/Playwright, testes lógicos, falhas simuladas na Responses API e consultas reais à OpenAI e ao Instagram. Encontrou e corrigiu duas falhas de continuidade/contenção: participante offline exigia JSON gerado pela IA; JSON inválido da IA podia chegar literalmente à projeção.

O percurso contínuo BOOT → aquecimento → participante → todas as malas → BIOS/glitch/blackout passou em 266 segundos, com operador e projeção em contextos de navegador separados e IA desligada. **Baralho e vídeos foram excluídos por instrução posterior do usuário**; resultados anteriores desses recursos não entram nesta aceitação.

A aceitação física permanece pendente: microfone, caixas/interface de áudio, projetor, fullscreen no monitor efetivo, suspensão do computador e perda da rede do teatro. Não houve publicação, mensagem, comentário, curtida, follow, exclusão, alteração de credenciais ou mudança de infraestrutura.

As alterações de confiabilidade que já estavam no checkout foram preservadas. Este relatório avalia esse estado, sem tratar `SHOW_RELIABILITY.md` como prova de funcionamento. Seus riscos históricos não equivalem automaticamente ao comportamento atual.

## 2. Ambiente, arquitetura e escopo

- Node 24.6.0; dependências instaladas consistentes em `npm ls --depth=0`: Next 15.5.23, React/React DOM 19.2.8, OpenAI SDK 5.23.2, Playwright 1.62.1 e ESLint 9.39.5. Não foi necessário reinstalar nem atualizar dependências. Uma instalação nova com `npm ci` não foi executada.
- Next App Router: frontend React e backend Node em `app/api/`, porta obrigatória 3000. Build seguido de launcher de produção; sem servidor preexistente na porta no início da auditoria.
- Autoridade local: `lib/showState.js`; SSE em `/api/events`, reconciliação por revisão em `/api/state`. Não foi identificado WebSocket como transporte ativo.
- Recuperação: snapshot atômico/checksum/versionado, escolha explícita de retomada ou nova sessão, timers pausados e mídia/serviços externos parados na retomada. O teste usou diretórios temporários, preservando a sessão persistida normal.
- OpenAI: Responses API, modelo padrão `gpt-5-mini`, opção `gpt-5-nano`; `OPENAI_API_KEY` presente. Timeout configurável `OPENAI_SHOW_TIMEOUT_MS`; emergência bloqueia chamadas. As credenciais não aparecem nas evidências.
- Instagram: automação Chromium/Playwright e sessão de navegador; conta pretendida `caixapretabot`. Não usa Graph API, OAuth/escopos Graph ou token de acesso Meta. O arquivo local de credenciais não estava presente; havia um perfil de navegador persistido.
- Outros serviços: pesquisa OpenAI e navegação Google/Bing. Pesquisa performativa e navegação autônoma Instagram possuem gates/desativação documentados; não foram habilitadas para esta auditoria.
- Fluxo efetivo das malas: **Mala 2 → forca antes do segundo sorteio → Mala 3 → Mala 1**. Nenhum fluxo alternativo foi implementado para corresponder à numeração do pedido.
- Cenas posteriores são superfícies controladas pelo operador; não existe um único sequenciador que execute toda a peça. Cues vazios e camadas incompletas permanecem dependentes de autoria.

## 3. Matriz de testes

PASS significa que as asserções descritas passaram no método indicado. Não transfere aprovação de mocks para serviços reais nem de Chromium para hardware.

| Funcionalidade | Resultado | Método/evidência | Limite ou problema |
| --- | --- | --- | --- |
| Dependências | PASS | `npm ls --depth=0` | Verificação da instalação existente |
| Lint | PASS | `artifacts/bot-audit-2026-10-14/lint-final.log` | Não prova interação |
| Build de produção | PASS | `build-final.log` | Warnings CSS/Autoprefixer não bloqueantes |
| Inicialização com storage novo | PASS | `server-corrected.log`, cenários de confiabilidade | Diretório temporário, dependências existentes |
| Host/personality corpus | PASS | `host-mode-simulation.log` | Verifica marcadores, não qualidade do modelo |
| Internet voice/research | PASS | `internet-voice-test.log`, `research-director-test.log` | Lógica/mocks; pesquisa real não avaliada |
| Jogos gerais | PASS | `game-director-test.log` | Lógica; não todos os jogos renderizados |
| Instagram writes/falhas | PASS | `instagram-controller-test.log` | Mocks; nenhuma escrita real |
| Malas legadas | PASS | `suitcase-director-test.log` | Não substitui Cena Zero |
| Performance/eventos/sanitização | PASS | `performance-system-test.log` | Lógica |
| Recuperação/checksum/emergência | PASS | `show-reliability-after.log` | Lógica e corrupção simulada |
| Reinício/retomar/nova sessão/fallback/boundary | PASS | `show-reliability-scenario.log` | Servidor de produção e navegador reais, serviço IA ausente |
| Cena Zero lógica | PASS | `scene-zero-after.log` | Parte das asserções lê código-fonte |
| Aquecimento lógico | PASS | `audience-warmup-test.log` | Não prova o microfone físico |
| Microfone: nível, confirmação e retorno à escuta | PASS | `audience-sound-check-browser-test.log` | Stream sintético Web Audio |
| Microfone físico: silêncio, palmas, gritos e desconexão | NOT TESTED | Nenhum ensaio físico | Aceitação crítica pendente |
| Permissão de microfone negada | PASS | `manual-sound-check.json`, `manual-sound-check-browser-test.log` | Negação simulada; seta e skip exercitados, sem aprovação de hardware |
| Aquecimento completo: Tapão, Piscada, Serinho | PASS | `audience-warmup-browser-test.log` | Três jogos; reação, pausa/retomada, edição de duração e modo manual |
| Acordos e gates manuais | PASS | `audience-warmup-agreements-browser-test.log` | Áudio no sink do controller; GAME OVER, pergunta e timer obrigatórios |
| Suíte legada de abertura/manual | FAIL | `play-unlock-browser-test.log` | Timeout na transição manual da prova sonora após reset; teste isolado passou; causa não concluída |
| Fluxo contínuo da Cena Zero, sem preparar estado intermediário | PASS | `full-show.json`, `full-show-audit.log` | BOOT/escuta/acordos/perguntas/jogo/participante/malas/final; comandos reais e áudio sintético |
| Malas em Chromium até blackout final | PASS | `scene-zero-suitcases-browser-test.log`, screenshots | Fixture prepara etapas e simula `play()` de Uba Uba Hey |
| Força G: áudio, texto, shader e stop | PASS | `forca-g-sampler-browser-test.log` | Chromium; saída física não ouvida; vídeos excluídos |
| Sampler da Cena 1 | PASS | `scene-one-sampler-browser-test.log` | Configuração curada, navegação textual; parte do playback usa FakeAudio |
| Efeitos de áudio da Cena 1 | PASS | `scene-one-audio-effects-browser-test.log` | Persistência e vozes verificadas após corrigir polling |
| Áudio da transição psicodélica | PASS | `scene-two-d-audio-effects-browser-test.log` | Ordem, persistência e polifonia |
| Sound Control | PASS | `sound-control-browser-test.log` | Navegador |
| Videomapping/troca de layout | PASS | `videomapping-browser-test.log` | DOM/geometria/troca sem remontagem; monitor físico pendente |
| Resoluções 1920, 1280 e 390 px | PARTIAL | Capturas `route-*-1920/1280/390.png` das telas dentro do escopo | Capturas renderizadas; revisão visual por amostragem, sem aprovação de todas as cenas/resoluções |
| Queda Avião: sequenciamento textual | PASS | Subconjunto de `show-surfaces.json`: 39 segmentos percorridos | Não aprova saída física de áudio nem todas as ações cênicas |
| Voz robótica, eleição de sink e autoplay | PASS | `robot-sound-browser-test.log` | Web Audio, expiração de sink, digitação após reset, reconnect/stop; bloqueio de autoplay esperado |
| SSE normal, bloqueado e reconexão offline | PASS | `public-realtime-browser-test.log` | Dois clientes, interrupção explícita de SSE, snapshot e reload; teste não desconecta roteador |
| OpenAI autenticação/modelo/geração | PASS | `openai-live.json` | Serviço real; geração mínima `OK`, 31 tokens, 3.512 s |
| OpenAI pelo chatbot, sarcasmo e memória do operador | PASS | `openai-app-live.json` | Serviço real `gpt-5-mini`, HTTP 200, 3.491 s, fonte `openai`, sem fallback e palavra de contexto recuperada |
| OpenAI HTTP 401/429/500, timeout, conexão | PASS | `openai-failures.json` | Mock no transporte do SDK, servidor real; deadline de teste 1 s |
| OpenAI vazio/JSON inválido/tipo inválido/recuperação | PASS | `openai-failures.json` | Fallback verificado no endpoint `/api/chat` |
| Instagram página inicial/sessão/perfil/frames | PASS | `instagram-live.json` | Serviço real, cópia temporária do perfil, escrita bloqueada |
| Instagram posts/captions/Reels/análise no chatbot | PARTIAL | Links de mídia na home; zero links de posts no perfil testado | Sem aprovação da ingestão/análise ponta a ponta |
| Instagram Stories | NOT TESTED | Sem fluxo específico comprovado | Não inferido como requisito implementado |
| Instagram Directs | NOT TESTED | Leitura de mensagens pessoais não exercitada | Escritas testadas somente com mocks |
| Áudios configurados: existência e transporte | PASS | `assets.json`, subconjunto de `full-show.json` | 11 áudios de cues responderam Range 206; não equivale à reprodução física |
| Cues sem arquivo | PARTIAL | `assets.json` | Há cues intencionalmente vazios; autoria pendente não equivale a download quebrado |
| Rotas públicas e controllers dentro do escopo | PASS | Subconjunto de `full-show.json` | HTTP 200, sem campos privados de texto na projeção; rota carregada não prova a cena inteira |
| Fullscreen/projetor/Safari/outro computador | NOT TESTED | Sem sessão física correspondente | Chromium headless não equivale à sala |
| Queda real de roteador/internet/microfone | NOT TESTED | Falhas controladas substituem apenas parte do teste | Hardware/rede real pendentes |
| Uso prolongado durante a duração integral da peça | NOT TESTED | Suítes e ensaios curtos | Sem soak, suspensão/retorno ou medição prolongada de memória |

Falhas iniciais de fixtures foram preservadas em `results.jsonl`; elas não foram automaticamente classificadas como defeitos do produto. As evidências anteriores à redução do escopo também permanecem no diretório, mas não aprovam Baralho/vídeos.

## 4. Integrações externas reais

### OpenAI

A chave autenticou consulta de modelo e uma geração real. A chamada direta usou `maxRetries: 0`, `store: false` e saída mínima para evitar gastos desnecessários. Não foi provocada limitação real de quota/rate limit. HTTPs de falha, queda de conexão, timeout e respostas inválidas foram simulados na fronteira do SDK e exercitaram o endpoint real da aplicação.

Personalidade e contexto: além do corpus, uma geração pelo `/api/chat` produziu uma fala sarcástica e recuperou `azul-cobalto-731`, registrada previamente via comando do operador e ausente da pergunta. A chamada respondeu em 3.491 s sem fallback. Isso prova uma intervenção contextual; consistência artística de várias intervenções e ensaio longo permanecem pendentes.

A documentação de [erros da OpenAI](https://developers.openai.com/api/docs/guides/error-codes) foi consultada para orientar os cenários. Os resultados deste relatório vêm da execução local e do serviço, não da documentação.

### Instagram — resposta objetiva

**Sim, o controller consegue acessar o Instagram realmente neste ambiente.** Foram comprovados HTTP 200, sessão reconhecida como autenticada sem campos de login, imagens/links de mídia na home, abertura do perfil `caixapretabot` com `main` presente e captura de frames pelo controller. A identidade da conta autenticada não foi verificada separadamente do nome configurado.

O teste usou uma cópia descartável do perfil existente, sem reescrever a sessão original, sem login automático e sem carregar senhas. Requisições de escrita foram bloqueadas; apenas GET/HEAD/OPTIONS e GraphQLs nomeadas `Query` foram permitidas. Inicialmente, o guard do próprio teste bloqueava consultas de leitura em `/api/graphql` e causava uma página de erro no perfil; após permitir esse caminho de leitura, o perfil carregou. Isso não foi apresentado como defeito do produto.

O perfil retornou **zero links de posts** na inspeção. Portanto não há evidência suficiente para aprovar posts/captions, análise via OpenAI, Reels com conteúdo específico ou uso integrado durante a peça. Comentários, mensagens, curtidas e follow existem no código e têm testes com mocks; **nenhuma dessas operações foi comprovada na conta real**. `INICIAR REELS + COMENTÁRIOS` publica automaticamente e não foi acionado nesta auditoria.

### Pesquisa e navegação

Google/Bing e ferramentas de pesquisa da OpenAI existem. Os testes lógicos passaram; análise de notícias e navegação externa guiada completas não foram aprovadas com serviços reais. Não foram habilitadas automações que pudessem escrever no Instagram.

## 5. Problemas encontrados e correções

| ID | Severidade | Reprodução/cause | Ação |
| --- | --- | --- | --- |
| B01 | P1 | Sem OpenAI, `set-stage participant` retornava `SCENE ZERO PARTICIPANT COPY INVALID` depois do aquecimento; fallback era prosa e parser exigia JSON | Correção pequena em `app/api/scene-zero/route.js` e `lib/scene-zero/participantFallback.js`: sequência local usa convite existente, falas de espera existentes e vencedor já sorteado |
| B02 | P2 | Resposta `{"text":"teste",` era projetada literalmente pelo parser | `lib/openai.js` rejeita JSON/tipo inválido e aciona o fallback existente |
| B03 | P2, testes | `waitForFunction(async () => false)` terminava como sucesso; espera recebia Promise truthy | Helper `scripts/browser-test-utils.js`; polling assíncrono corrigido em cinco suítes, com regressão falso/verdadeiro |
| B04 | P3, testes | Fixtures esperavam ordem antiga BOOT→warmup, som na projeção apesar do relay e texto antigo do Tapão | Fixtures alinhadas ao código e falas atuais; nenhum texto dramatúrgico foi alterado |
| B05 | P3, testes | Teste do sampler assumia todos os arquivos da pasta como pads escolhidos e não restaurava configuração | Verifica recursos configurados e restaura o JSON original após o teste |
| B06 | P2, investigação pendente | Suíte longa `play-unlock-browser-test` dá timeout ao esperar a escuta manual após reset; seta com permissão negada passa no teste isolado | Não foi atribuída uma causa ao produto sem reprodução isolada; aprovação integral desta suíte permanece pendente |

Arquivos adicionais de teste: `scripts/openai-failure-audit.js`, `scripts/openai-live-audit.js`, `scripts/instagram-readonly-audit.js`, `scripts/full-show-audit.js`, `scripts/manual-sound-check-browser-test.js`, `scripts/participant-fallback-test.js` e o helper de polling. Comandos reprodutíveis adicionados em `package.json`. Brain atualizado apenas nas áreas afetadas.

Os mecanismos de persistência, emergência, boundary e launcher já estavam presentes no início; não são atribuídos a estas correções.

## 6. Regressão e evidências

- `results.jsonl` registra nome, exit code e duração de cada execução das suítes existentes; linhas posteriores são reexecuções. Os logs de cada suíte contêm sua execução mais recente.
- `openai-invalid-before.json` preserva a reprodução anterior à correção. `openai-failures.json` mostra fallback e retorno ao sucesso sem chamadas reais.
- `full-show-before.json` preserva a falha de participante offline encontrada no ensaio contínuo.
- `full-show.json`: regressão contínua aprovada após a correção de participante, todas as malas abertas na ordem implementada, final completo, nenhum erro JavaScript/HTTP 5xx monitorado.
- `openai-failures.json`: 11 casos aprovados, incluindo recuperação de JSON inválido no participante com sequência local iniciada.
- Regressão lógica, aquecimento nos três jogos, acordos manuais, áudio/relay, sampler e reconexão SSE passaram. A suíte legada de abertura/manual tem o resultado FAIL explicitado na matriz.
- `polling-regression.json`: condição assíncrona sempre falsa rejeitada, sucesso somente após três polls.
- Screenshots públicas: `suitcase-key-quadrants.png`, `suitcase-final-bios.png`, `videomapping-bios.png`, `full-show-scene-zero-end.png`. Geometria em screenshot não comprova legibilidade do projetor real.
- Os arquivos de cues/configurações são comparados antes/depois. O perfil Instagram original e a persistência normal da apresentação não são usados como storage de teste.
- Build, lint, `brain:sync`, `brain:check` e `git diff --check` passaram no fechamento. Configurações de cues/sampler mantiveram os mesmos hashes; alterações automáticas apenas em timestamps de notas foram restauradas.

Reprodução segura: preparar o build e iniciar o launcher com `OPENAI_API_KEY='' CAIXA_PRETA_SHOW_RUNTIME_DIR=/tmp/caixa-audit-repro node scripts/show-launcher.js`; em outro terminal, executar `npm run test:scene-zero:e2e` ou `npm run test:public-realtime:browser`. Eles resetam a sessão. Encerrar esse servidor antes de `npm run test:openai:failures` e `npm run test:show-reliability:scenario`, que precisam possuir a porta 3000. A chamada `test:openai:live` requer outro servidor dedicado com a chave real carregada; `test:instagram:readonly` usa a cópia temporária da sessão local.

## 7. Riscos restantes

1. Microfone e saída física de áudio ainda não aprovados; Web Audio sintético não mede dB SPL calibrado, palmas/gritos reais ou desconexão de cabo.
2. Instagram é automação de interface, com login/checkpoints, DOM e políticas externos. Acesso de leitura agora não garante disponibilidade no dia da peça nem publicação. Rotina Reels mistura navegação com comentários reais.
3. Cues vazios e cenas dependentes de conteúdo impedem considerar toda a dramaturgia finalizada por um teste de rota HTTP 200.
4. Retomada exige decisão do operador; não há supervisor automático/rotação de snapshots aprovados. A projeção remota exige rede local ativa.
5. Falhas foram controladas por mocks/bloqueio de requests. Não foi desconectado o roteador do teatro, suspenso o Mac nem retirado microfone físico.
6. Não houve ensaio com plateia nem soak pela duração integral da peça. Personalidade/contexto e timing artístico exigem ensaio acompanhado.
7. A suíte legada manual ainda falha; o operador deve ensaiar a sequência de reset → BOOT → seta → escuta no computador efetivo antes de aceitar esse percurso.

## 8. Checklist pré-espetáculo

1. Preparar build antes da abertura da sala; iniciar `npm run show` e conferir `/api/health?skipOptional=1`. Resolver retomada/nova sessão conscientemente.
2. Confirmar servidor correto, porta 3000, storage, computador sem suspensão e rede local do operador/projeção.
3. Fazer uma intervenção curta real na OpenAI; se indisponível, ensaiar fallback/MODO EMERGÊNCIA e continuidade manual.
4. Abrir Instagram por ação explícita, conferir conta/sessão/perfil e frame. Evitar Reels/comentários quando escritas não forem autorizadas; manter alternativa local.
5. No navegador e microfone da apresentação, conferir permissão, silêncio, ruído ambiente, palmas, gritos, barra e conclusão; testar o botão de skip.
6. Abrir projeção pelo Operator, conferir heartbeat, resolução, monitor/fullscreen e ausência de controles privados. Fazer mudança de tela e reconexão.
7. Ouvir os recursos essenciais na saída física selecionada. Conferir volume, autoplay após gesto, samples, Uba Uba Hey, stop e reinício.
8. Ensaiar `→`, bloqueios manuais, timeout/retry das malas, STOP ALL, blackout e desligar emergência sem reativar automações involuntariamente.
9. Conferir os cues vazios e a lista de arquivos efetivamente previstos para a peça. Não executar testes que resetam a sessão com plateia presente.

## 9. Conclusão e fechamento

| Pergunta | Resposta comprovada |
| --- | --- |
| O bot funciona de ponta a ponta? | Sim para o percurso contínuo da Cena Zero; não foi validada a peça inteira com hardware/plateia. |
| Instagram está realmente acessível? | Sim: sessão, home, perfil e frames; ingestão/análise de posts pelo chatbot ainda parcial. |
| OpenAI está funcionando? | Sim: autenticação, geração direta e intervenção contextual pelo bot sem fallback. |
| Malas funcionam completamente? | Fluxo digital completo até blackout passou; áudio físico e ações cênicas não aprovados. |
| Aquecimento funciona? | Fluxo, três jogos e prova sonora sintética passaram; microfone físico pendente. |
| Controles manuais funcionam? | Acordos/gates, seta isolada, timers e STOP ALL passaram; suíte legada longa ainda falha. |
| Projeção está sincronizada? | Sim nos testes Chromium de SSE, fallback, reload e reconexão; projetor/rede da sala pendentes. |
| Sistema suporta falhas? | Sim nos cenários testados: IA, restart/retomada, SSE e boundary; não em todas as falhas físicas possíveis. |
| Podemos usar em apresentação real? | Ainda não considerar aprovado sem ensaio físico, investigação da suíte manual e aceitação do conteúdo e do uso de Instagram previsto. |

Fechamento posterior: por pedido do usuário, as alterações da auditoria foram separadas em commits locais. A camada de confiabilidade preexistente permanece fora desses commits; os resultados acima foram obtidos no checkout completo, incluindo essa camada. Os logs, JSONs e screenshots em `artifacts/` permanecem como evidências locais não versionadas. O helper de participante foi isolado em módulo próprio, mantendo exatamente a mesma sequência e fala local; seu teste e a auditoria de falhas da IA passaram novamente, assim como lint/build e brain. Nenhum push ou deploy foi realizado. Servidores de auditoria usam snapshots temporários; a sessão normal, o perfil original do Instagram e os conteúdos autorais foram preservados.
