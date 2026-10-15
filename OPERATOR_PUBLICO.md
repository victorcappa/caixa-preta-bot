# Operator Público

Interface dramatúrgica integrada ao Caixa Preta Bot. Implementada no checkout atual, sem deploy. A sessão normal da porta 3000 não foi resetada pelos testes.

## Operação

1. Abra `/cena-0-controller` ou `/videomapping-controller`. **REVELAR OPERATOR** fica no topo do menu da direita. O botão revela o painel na projeção e abre os controles privados ampliados. **VOLTAR AOS CONTROLES** fecha somente o painel privado; **ABRIR CONVERSA** permite voltar a ele. A aba `/operator` contém somente os parâmetros do bot; conversa e monitor permanecem neste launcher.
2. A projeção atual ocupa 65% da largura; a conversa ocupa os outros 35%. O quadro original é reduzido proporcionalmente e centralizado na altura, com faixas pretas, para preservar todo o conteúdo e sua composição. Fechar/reabrir altera apenas transformações CSS.
3. Escreva no campo **OPERADOR >**, tanto na lateral pública quanto no painel privado. O rascunho aparece publicamente quando o painel está revelado. **Enter** envia; **Shift+Enter** quebra linha. O histórico tem rolagem própria, com acompanhamento automático enquanto estiver no final. É possível conversar mesmo com a visualização pública oculta.
4. Arraste os controles de **SARCASMO**, **REBELDIA**, **CURIOSIDADE** e **VERBOSIDADE**, ou use `−`/`+` em passos de 5. Os valores vão de 0 a 100; o arraste permite passos de 1. Os sliders públicos também são operáveis: arraste ou use `−`/`+` diretamente na lateral da projeção. Valores e rascunhos sincronizam nos dois sentidos com os controles privados.
5. **INTERROMPER GERAÇÃO** cancela apenas a resposta lateral. **INTERROMPER DESVIO / RETOMAR PEÇA** encerra a atividade externa/Instagram, invalida gerações antigas e pede uma justificativa pública na conversa lateral. A cena, seus timers e suas falas fixas não são avançados ou reiniciados por esse botão. A continuação cênica permanece nos controles existentes.
6. Para monitorar a imagem pública, use **CONECTAR PROJEÇÃO AO VIVO** e escolha a aba pública no seletor do navegador. O vídeo é local, ao vivo e mudo. Não há upload da captura nem segunda instância da cena. **DESCONECTAR MONITOR** libera os tracks. Requer captura de tela/aba disponível e permissão do navegador/sistema; o resumo de estado continua disponível sem captura.

## Arquitetura e arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/showState.js` | Autoridade única: `operatorPublic`, operações de geração, cancelamento, parâmetros, snapshots e recuperação. |
| `lib/operatorPublic.js` | Definição dos quatro parâmetros, normalização, projeção pública por allowlist, contexto factual e consolidação de ajustes. |
| `app/api/operator-public/route.js` | `patch`, `send` e `cancel` compartilhados pelas interfaces pública e privada; `return` nos controles privados; streaming pelo SSE existente. |
| `lib/openai.js` | `streamOperatorReply`, usando o cliente, modelo, identidade, conhecimento local e deadline existentes. |
| `prompts/buildSystemPrompt.js` | Intensidades da sessão no prompt compartilhado; regras fixas e identidade preservadas. |
| `lib/externalRequestControl.js` | Cancelamento individual por sinal, somado ao timeout e bloqueio de emergência existentes. |
| `lib/instagram/InstagramController.js` | Retirada explícita de um controller encerrado, invalidação de rotinas Google/Reels e supressão de callbacks tardios. |
| `components/ProjectionOperatorSurface.js`, `app/layout.js` | Aplicam a composição apenas às rotas públicas registradas, incluindo Principal, Videomapping e cenas específicas. |
| `components/PublicOperatorLayout.js`, `components/PublicOperator.module.css` | Quadro original estável e entrada animada da lateral; nenhuma troca de chave ou remontagem ao revelar. |
| `components/PublicOperatorPanel.js`, `components/OperatorTypedReply.js` | Histórico, digitação gradual, porcentagens, sliders nativos e rascunho. |
| `components/PublicOperatorControls.js` | Compositor, ajustes e modo ampliado; `parametersOnly` reaproveita apenas os sliders em `/operator`. |
| `components/OperatorBotSettings.js` | Aba de parâmetros: digitação, pausas, fonte, personalidade e modelo, sem conversa ou controles técnicos. |
| `components/OperatorPublicLauncher.js`, `components/SceneZeroController.js` | Botão no topo do menu lateral direito e acesso à conversa. |
| `components/OperatorLivePreview.js` | Monitor de vídeo local com `getDisplayMedia`, sem áudio duplicado. |
| `components/Chat.js`, `components/OperatorConsole.js`, `components/ControllerGlobalVolume.js` | Integração e consumo compartilhado de realtime, sem reconstruir a cena a cada token. |

`/api/events` publica o evento `operator-public` usando o snapshot central existente. `lib/publicRealtime.js` mantém uma conexão compartilhada por aba para os novos componentes, Operator, Cena Zero e volume global, com reconciliação por revisão em `/api/state`. Isso evita esgotar as conexões HTTP quando projeção e controles coexistem em várias abas. Os tokens laterais não disparam atualização dos consumidores de cena, som ou volume.

Rascunhos e sliders são agrupados por 60 ms e enviados sequencialmente. O valor local responde imediatamente ao arraste. Deltas reais da Responses API são agrupados em janelas de 50 ms. O texto começa a aparecer durante o streaming, caractere a caractere, na velocidade e com a pausa na pontuação configuradas na aba privada `/operator`. O buffer continua sendo digitado após o modelo concluir; alterações de velocidade passam a valer durante a fala. Histórico concluído não é redigitado ao recarregar e cancelamento interrompe a digitação. O POST de geração permanece ativo até concluir, mas cancelamento e demais comandos usam requisições independentes. IDs de envio impedem duplicação; o token da geração impede que respostas canceladas alterem uma geração posterior.

## Contexto e personalidade

A personalidade anterior era um corpus textual em `prompts/personality.js`, sem intensidades numéricas. O corpus continua sendo a identidade. Os quatro controles acrescentam dimensões distintas de tom, resistência teatral, investigação e extensão. Humor/ironia não foram duplicados em controles sobrepostos ao sarcasmo.

O canal lateral possui histórico próprio e nunca chama `/api/operator`, ferramentas de pesquisa, comandos Instagram ou eventos de performance a partir da fala. Recebe modo, etapa da Cena Zero, cue ativo, jogo, mala, timers, atividade Instagram e seis falas públicas recentes. Posts só são incluídos quando o pipeline existente tem observações de página/visão no post atual de uma sessão ativa; comentários gerados não contam como evidência. A ingestão real do Instagram continua tendo os limites de `BOT_TEST_REPORT.md`.

As próximas gerações principais recebem a mesma personalidade pela construção compartilhada do prompt. Falas autorais e regras determinísticas não passam por reescrita. Ajustar sliders durante uma resposta altera a próxima geração, sem recomeçar a atual. Alterações de pelo menos 20 pontos são consolidadas por parâmetro; podem ser comentadas na próxima conversa, com janela de relevância de dois minutos e intervalo mínimo de 20 segundos. Não há geração automática por movimento. Ajustes feitos durante uma geração permanecem disponíveis para a seguinte.

## Interrupção, erros e persistência

A retomada privada incrementa a barreira existente de parada, aborta requisições externas em curso, cancela a resposta lateral anterior, retira o controller Instagram antes de aguardar seu fechamento e marca a sessão Instagram como parada. Um controller retirado não é reutilizado; atualizações com sua identidade são descartadas. Callbacks de preview/comentário/erro de sessão parada também são recusados. A resposta do GPT não autoriza nem condiciona a interrupção.

Se o modelo falhar antes de escrever, uma fala local segura ocupa a resposta lateral. Se houver texto parcial na conversa comum, ele é preservado e a geração é encerrada. Na justificativa de retomada, uma falha mesmo parcial é substituída pela fala local completa. Diagnósticos de geração aparecem somente nos controles privados. O timeout e o bloqueio de emergência continuam centralizados; `STOP ALL`, emergência, reset e retomada de snapshot cancelam a geração lateral. O canal não toca áudio nem altera a saída sonora principal.

O snapshot da sessão inclui visibilidade, histórico, rascunho e parâmetros. A recuperação explícita após restart preserva esses dados e encerra qualquer estado de streaming; não tenta retomar uma requisição ao provedor. Um novo espetáculo limpa o canal. Fechar/reabrir a lateral ou recarregar a projeção mantém o histórico no servidor.

A lateral pública oferece campo editável, envio, cancelamento da resposta e controles de personalidade, usando o mesmo fluxo do painel privado. Os comandos de retomada do espetáculo e o monitor permanecem privados. A mensagem inicial “CANAL ABERTO. A CENA CONTINUA.” foi removida. Não recebe os campos privados do novo canal, prompts, credenciais ou diagnóstico da geração. Isso preserva a separação de interface do aplicativo local; não acrescenta autenticação de contas às APIs existentes. O endpoint recusa escritas de outra origem no navegador comparando com o host HTTP recebido.

## Validação e evidências

- `npm run test:operator-public`: normalização, limites, allowlist pública/contexto, consolidação/cooldown, cancelamento individual e retirada do controller Instagram.
- `npm run test:operator-public:browser`: cria e compila uma cópia temporária sem `.env`, `.runtime` ou `.git`, compartilha dependências/assets locais, e ensaia na porta 3311 com transporte OpenAI e Instagram sintéticos. Não encerra processos já existentes. `CAIXA_PRETA_OPERATOR_AUDIT_ROOT` pode apontar para uma cópia já compilada.
- `npm run test:operator-public:live`: **duas gerações reais, com custo e envio de contexto à OpenAI**; requer a chave já configurada e usa a porta isolada 3312. Executado com autorização específica do usuário. Não acessa nem escreve no Instagram.
- Evidências: `artifacts/operator-public-2026-10-15/`; resultados, screenshots e resposta real em `openai-live.json`. As duas respostas de `gpt-5-mini` chegaram em aproximadamente 3,4 s e 2,0 s, com 7 e 5 atualizações visíveis no navegador e texto parcial antes do término.
- Playwright passou em 1280×720 e 1920×1080: quadro original e timers preservados, vídeo local sem restart, rascunho/arraste/+− sincronizados, história/reload, cancelamento, idempotência, STOP ALL, emergência, callbacks Instagram tardios, fallback, reconciliação sem SSE, botão no menu direito e recuperação após restart real. O preview foi exercitado com stream de vídeo sintético em movimento, incluindo liberação dos tracks. A correção de interação pública foi revalidada em `artifacts/operator-public-interaction-2026-10-15/`: digitação tecla a tecla, envio com Enter e arraste diretamente na projeção, sincronizando com o controle privado.
- As suítes existentes `public-realtime-browser-test.js`, `videomapping-browser-test.js` e `sound-control-browser-test.js` passaram na cópia temporária, com apenas a URL de loopback adaptada para 3311.
- Regressões lógicas executadas: Cena Zero, aquecimento, jogos, malas, performance, Instagram com mocks, confiabilidade, pesquisa, voz de internet, som robótico, Baralho Mórbido e sampler Força G. Lint e build de produção executados.

As respostas reais provaram transporte e progressividade, não aprovação artística da intensidade dos parâmetros. Em uma delas o modelo citou percentuais diferentes dos controles; as instruções foram reforçadas para usar valores exatos ao mencioná-los. A UI e os prompts enviados usam o estado central, independentemente do que o personagem diga. A prova ao vivo foi anterior a esse reforço; não foram feitas gerações adicionais.

Permanecem para ensaio: conta/atividade real Instagram junto da nova lateral, captura manual da aba no sistema operacional, touch em dispositivo físico, áudio físico, projetor e legibilidade na sala. O preview exige seleção explícita da fonte. Nenhuma publicação Instagram, alteração de perfil, push ou deploy foi realizada.

Referência oficial utilizada para o protocolo: [Streaming API responses — OpenAI](https://developers.openai.com/api/docs/guides/streaming-responses), eventos `response.output_text.delta` e `response.completed`.

### Aba de parâmetros do bot

`/operator` reúne velocidade de digitação, pausa na pontuação, intervalo mínimo entre falas, fonte, frequência dos cliques, personalidade e modelo. A conversa continua no launcher lateral e no painel público. Os ajustes usam os estados e endpoints existentes. Pausa e intervalo começam em zero; tempos autorais de cena podem ser maiores.

Validação local em `artifacts/operator-settings-2026-10-15/`: valores persistidos/recarregados e screenshot `operator-settings.png`. A digitação projetada mediu cerca de 351 ms após a vírgula (50 ms por caractere + pausa de 300 ms) e 701 ms entre falas para um intervalo de 700 ms. Ensaio com transporte de IA simulado, sem requisições reais à OpenAI.

### Ritmo do OPERATOR // LIVE

O controle privado **VELOCIDADE DA DIGITAÇÃO** em `/operator` também governa as respostas novas do LIVE, junto da **PAUSA NA PONTUAÇÃO**. O recebimento dos tokens continua independente da apresentação. O histórico concluído reaparece pronto no reload.

Ensaio em `artifacts/operator-typing-2026-10-15/operator-typing.json`: com 10 caracteres/s, somente `ABCDEFG` estava visível quando o streaming simulado concluiu uma resposta de 39 caracteres. Alterar o controle privado para 60 caracteres/s concluiu a exibição restante em aproximadamente 637 ms. Nenhuma chamada real à OpenAI foi usada nesse ensaio.

### Aplicação no servidor local e evidências

O processo local foi reiniciado com autorização e a mesma sessão foi retomada: cena, histórico principal, conversa do Operator, personalidade e memórias foram conferidos. Na porta 3000, velocidade, pausa na pontuação e intervalo persistiram após reload; os valores originais foram restaurados depois do ensaio. Não houve novas chamadas à OpenAI.

A suíte final passou nos 22 cenários de navegador, incluindo arraste contínuo com respostas atrasadas, servidor antigo que descarta campos, retenção do rascunho e nova tentativa de salvamento. `scripts/robot-sound-hot-refresh-test.js` confirmou a atualização de esquema sem substituir o singleton, a cena, o histórico ou os listeners.

Os diretórios de evidências citados neste documento são resultados locais regeneráveis e ficam fora do Git via `.gitignore`; o código e os comandos de reprodução são versionados. As duas gerações reais documentadas acima pertencem à autorização anterior e não foram repetidas para fechar os commits.
