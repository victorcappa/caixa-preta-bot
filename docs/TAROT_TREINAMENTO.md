# Tarô / Treinamento

Rostos, fusões, mistura FOTO ↔ CARTA, efeitos independentes, presets e timeline: [TAROT_ALUCINACAO.md](TAROT_ALUCINACAO.md).

## Uso atual

O controle privado fica em `/treinamento/controle`, acessível por **TARÔ** na navegação e pelo link em `/operator`. A projeção pública é `/treinamento`. As duas usam a mesma sessão, conversa, personalidade, áudio procedural e SSE do espetáculo. Abrir o controle não muda a projeção. O antigo `/treino` continua sendo a calibração de personalidade.

As falas, perguntas, contingências e instruções do tarô aparecem somente em `/treinamento`. Elas permanecem no histórico compartilhado para dar contexto ao bot, mas não substituem `publicMessage` da tela principal nem entram na sua fila de digitação/sons. Antes do boot, a principal mantém apenas o cursor piscando; boot, BIOS, jogo das malas e falas próprias continuam no fluxo existente. Reabrir a principal também filtra mensagens antigas do tarô, sem reapresentá-las.

1. Abra a projeção no computador da câmera e clique **INICIAR PRÓLOGO** no controle. Reconhecimento e análise automáticos vêm ligados. Mostre uma ou duas cartas; o sistema espera três correspondências e pelo menos 450 ms de estabilidade.
2. As 22 fotografias possuem inventários e **182 âncoras editoriais**. O cache de descritores é preparado automaticamente e localmente; **PREPARAR BARALHO** só antecipa essa operação. Não é preciso cadastrar os elementos para começar.
3. Uma leitura tem **três parágrafos**: observação, interpretação e associação. O teto padrão é 60 palavras no total, ajustável de 30 a 60 em **Câmera e carta → Palavras por reflexão**. A personalidade muda o tom sem reduzir esse teto. O corte local respeita frases completas. Duas cartas recebem uma única leitura conjunta, com relações entre ambas.
4. Os elementos surgem progressivamente na imagem e na lateral, conforme a fala. Uma nova resposta começa em zero; nunca herda o cursor completo da anterior. Cada item lateral usa o recorte da sua própria carta.
5. Perder uma carta interrompe a geração/apresentação da leitura física. A digitação e seus sons param; o texto já apresentado é preservado. O retorno estável da leitura completa retoma do cursor confirmado sem outra chamada ao modelo. Numa dupla interrompida, deixar apenas uma das cartas visível não transforma imediatamente a leitura em uma nova fala individual; retire/reapresente a nova leitura ou use a correção manual.
6. Movimento não repete chamadas. Por padrão, voltar a uma leitura anterior reapresenta seus segmentos da conversa, progressivamente, sem gerar outra interpretação. **Repetir análise quando uma carta retorna** permite gerar uma nova. **Análise automática** e **Reconhecimento automático** são opções independentes.
7. Na projeção, **INTERPRETAR** abre o campo **QUAL É A SUA PERGUNTA?** e interrompe a leitura atual. Durante a digitação, as detecções não selecionam cartas nem geram respostas. **ENVIAR PERGUNTA** fecha o campo, mostra a pergunta e aguarda uma nova detecção estável (inclusive da mesma carta). A próxima leitura relaciona a carta à pergunta, sem reutilizar uma interpretação anterior. Ao terminar a apresentação, o modo se encerra; as próximas cartas seguem a leitura livre habitual. A pergunta não fica armada para outras cartas. **CANCELAR** sai do modo; falha de geração oferece **TENTAR NOVAMENTE**. A pergunta acompanha pausas por perda da carta, mas é descartada se outra carta substituir a leitura em andamento, ao encerrar ou ao recuperar o servidor. O botão fica disponível com o prólogo ativo, fora das etapas do chão e de uma pausa manual. As opções de reconhecimento continuam respeitadas; a pergunta enviada permite a análise explícita mesmo com **Análise automática** desligada.
8. O texto do bot passou a 38 px no desktop, ajustável de 24 a 64 px em **Visual**. Os rótulos “CÂMERA AO VIVO”, a linha das quatro etapas e o bloco de status foram retirados da projeção.

Uma pausa manual permanece ativa mesmo se a carta continuar visível: o reconhecimento não reinicia sozinho a fala cancelada. Retome pelo controle ou inicie explicitamente outra análise.

Se um processo anterior ainda estiver aberto, a API pode informar `TAROT_RUNTIME_RESTART_REQUIRED`: esta evolução exige controller **v9**, com pergunta para a próxima carta. O singleton ativo não é apagado pelo hot reload. Reinicie o servidor em um momento adequado e use a recuperação existente se necessário. Antes de reiniciar, compare sessão/revisão ao vivo e em disco: uma recuperação antiga protegida não é backup da execução atual.

## Seis leituras e os versos visíveis no chão

Em **Cartas no chão**, o padrão é **6 cartas distintas interpretadas até o fim**, ajustável entre 1 e 22. Uma dupla conta duas cartas. Perguntas adicionais sobre a mesma carta, movimento e respostas interrompidas não aumentam essa contagem. A etapa pode ser desligada ou iniciada manualmente. **REINICIAR CONTAGEM DAS CARTAS** limpa essa contagem e a escolha do chão, preservando a conversa.

Após atingir o limite, o bot pede para espalhar os arcanos maiores virados de costas. O Worker compara os quadriláteros encontrados à fotografia real **`assets/tarot/carta-fundo.jpeg`**. Não usa uma frente como substituta do verso. A busca combina bordas, limiar global e limiar local para tolerar sombras e perspectiva. Contornos sem confirmação pelo padrão do verso não autorizam a escolha. Pode usar **qualquer subconjunto de 1 a 22 versos reconhecidos**, sem esperar o baralho inteiro; partes cobertas ou fora do quadro não entram na escolha.

O fluxo é:

- Esperar **ao menos um verso confirmado e uma disposição estável** por 1.200 ms, ajustável no controle.
- Escolher uma posição e destacar seu quadrilátero na imagem. A escolha é espacial: as costas iguais não revelam qual arcano está embaixo.
- Ordenar fileiras **de cima para baixo**, e cartas **da direita para a esquerda** na imagem da câmera. Quando houver fileiras, a fala informa a fileira e a posição dentro dela, por exemplo: “Na segunda fileira, de cima para baixo, retire a terceira carta da direita para a esquerda.”
- Confirmar que **a posição escolhida desapareceu enquanto as demais cartas reconhecidas continuam nas posições esperadas**, por três observações e pelo menos 700 ms. Com várias cartas reconhecidas, perder a cena inteira ou esconder várias não confirma uma retirada. Com uma única carta, a ausência sustentada libera a apresentação da frente, pois não há outras posições para confirmar a permanência da cena.
- Esperar a frente da carta retirada, reconhecê-la e fazer uma nova interpretação em três parágrafos.
- Só depois da apresentação terminar, publicar o encerramento: “Aprendi a reconhecer os signos e a relacionar seus significados. Estou pronto para o próximo treinamento. Vamos embaralhar realidades e ver o que elas nos contam.”

Mantenha a câmera voltada para todo o conjunto durante a escolha/retirada; depois apresente somente a frente escolhida. Movimentos que mudem toda a disposição exigem estabilizar o conjunto ou reiniciar a etapa. Na recuperação de sessão, a seleção espacial antiga é descartada: não se retoma uma escolha sobre posições potencialmente diferentes.

## Visual e Matrix

A homografia de **cada carta** transforma suas âncoras e a superfície física delimitada dentro da foto. O palco considera `object-fit: contain` e as margens do vídeo. Um único MediaStream alimenta o vídeo filtrado e até dois canvases nítidos, recortados pelos polígonos das cartas. Não há segunda câmera nem substituição da carta física por uma imagem estática.

O fundo recebe desfoque, escurecimento, verde e um campo procedural de símbolos, abaixo das cartas nítidas. Em **Visual**, há:

- Intensidade Matrix; formato **chuva**, **constelação**, **órbitas** ou **runas**.
- Alfabeto livre de símbolos, cor, quantidade, tamanho e brilho.
- Velocidade, persistência dos rastros, linhas de varredura, pulsação e rotação.
- Desfoque, escurecimento, verde, contorno, animações e velocidade de revelação do texto.

O campo é transparente; os rastros apagam sua própria camada. As animações respeitam `prefers-reduced-motion`. Reinícios/trocas de fonte rearmam callbacks de vídeo no tracker e na camada nítida. Perda confirmada pelo Worker limpa a geometria imediatamente; silêncio durante revalidação usa uma tolerância limitada de 750–2500 ms baseada no pico medido, evitando flashes. No sumiço, o isolamento faz um fade curto e a fala física é interrompida.

A composição evita `CanvasRenderingContext2D.filter` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter)); usa filtro CSS e recortes poligonais. Isso não substitui um ensaio de câmera/áudio/projeção no equipamento final.

## Reconhecimento e reflexos

A arquitetura permanece local: **OpenCV.js/WASM em Worker, ORB, BFMatcher/Hamming, homografia/RANSAC, fluxo óptico e IndexedDB**. O perfil atual extrai até 1.400 pontos, normaliza contraste com CLAHE quando disponível, descarta pontos saturados e exige correspondências distribuídas pelo interior da ilustração. Duas correspondências em regiões distintas são duas cartas; candidatas concorrentes sobre a mesma região passam pela verificação de ambiguidade. Cada carta mantém seu próprio conjunto de pontos de fluxo óptico. Há revalidação completa periódica para descobrir trocas e a segunda carta.

A proteção contra reflexos ajuda a usar detalhes que continuam visíveis; não recupera desenho apagado por brilho intenso. Se o reflexo cobre grande parte da arte, altere luz ou inclinação. O cache tem nova versão para não misturar os descritores anteriores com o perfil atualizado.

No chão, a detecção combina bordas Canny e segmentação por limiar de Otsu, evitando que texturas do piso unam os contornos das cartas. Os quadriláteros são comparados ao verso por perspectiva e correlação do padrão interior, usando a fotografia completa, sua superfície delimitada e modelos de contorno em duas escalas, também a 180°. A luminância original é preservada nessa comparação: equalizar a cena por blocos alterava o padrão conforme a posição da carta. A leitura do chão pode usar até 1280 px de largura; a leitura das frentes continua reduzida a até 800 px. Duplicatas de contornos aninhados são eliminadas.

Pesquisa técnica: [OpenCV ORB](https://docs.opencv.org/4.13.0/db/d95/classcv_1_1ORB.html), [CLAHE/equalização](https://docs.opencv.org/4.12.0/d2/d74/tutorial_js_histogram_equalization.html), [contornos em JavaScript](https://docs.opencv.org/4.5.4/d5/daa/tutorial_js_contours_begin.html), [homografia](https://docs.opencv.org/4.x/d7/dff/tutorial_feature_homography.html) e [fluxo óptico](https://docs.opencv.org/4.x/db/d7f/tutorial_js_lucas_kanade.html).

A pesquisa inicial considerou [tarot-card-recognition](https://github.com/mpszkudlarek/tarot-card-recognition), classificador PyTorch, e [MindAR](https://github.com/hiukim/mind-ar-js). Não se importou código/dataset do primeiro nem se adicionou um segundo motor. A build local OpenCV 4.13.0 inclui WASM e licença Apache 2.0 em `public/vendor/opencv/`. Não há CDN, servidor visual ou download de modelo durante a apresentação.

A composição pública coloca a interpretação no topo, com o nome da carta (ou das duas cartas) acima do texto. O tamanho padrão é 48px, ajustável de 24 a 96px; escolhas anteriores salvas continuam valendo. Cabeçalho, câmera, elementos e interpretação têm posição/tamanho independentes em **VISUAL → COMPOSIÇÃO DA TELA PÚBLICA**, também acessível em `/operator`. As escolhas são persistentes e afetam somente a projeção; consulte `OPERATOR_PUBLICO.md`.

## Catálogo, sincronização e custos

As 22 referências foram inspecionadas individualmente e revisadas com sobreposições numeradas, com correção de regiões. [TAROT_CATALOGO_VISUAL.md](TAROT_CATALOGO_VISUAL.md) lista elementos, relações e ambiguidades de cada carta. `assets/tarot/catalog.json` guarda IDs, coordenadas normalizadas, relações, conceitos, associações e hash de revisão. **Âncora revisada** significa conferida na fotografia; não significa teste físico nem certeza sobre a identidade de um detalhe ambíguo.

O modelo retorna `observation`, `interpretation` e `association`, cada um com frases e IDs. O normalizador reserva uma frase completa de cada trecho e distribui o orçamento restante entre frases inteiras, globalmente; não divide a meta rigidamente em três partes nem acrescenta um ponto a um fragmento cortado. O teto configurado de 30–60 palavras é independente de VERBOSIDADE: zero não reduz silenciosamente uma leitura de 60 para 30 palavras. Perfil, personalidade, alucinação e instruções privadas não podem ampliar o teto. JSON inválido, frase incompleta, núcleo acima do limite ou leitura conjunta incompleta permitem **uma única chamada adicional de correção**, dentro da mesma geração cancelável; nenhuma tentativa inválida entra no histórico ou na projeção. Erro de rede/provedor não dispara essa correção. Se a segunda resposta também falhar, a projeção informa a falha e oferece **TENTAR NOVAMENTE**, inclusive na leitura livre da mesma carta ainda visível. A câmera não sobrescreve a causa original da geração com `TAROT_ANALYSIS_FAILED`; o diagnóstico fica no controle privado. Não há repetição infinita, fala inventada ou contingência automática. O cliente permite até 70 segundos para a geração com correção; cada chamada ao modelo continua limitada a 30 segundos.

As posições dos trechos são calculadas depois da seleção das frases. Eventos de revelação usam essas posições/IDs, com distribuição gradual se uma frase trouxer vários elementos novos. IDs técnicos, o nome da marca e rótulos como “Cena teatral:” e “Pergunta curta para a plateia:” são removidos da prosa. Não se usa procura de palavras como única sincronização. Leituras anteriores à revisão 3 do formato continuam no histórico, mas não são reapresentadas automaticamente: podem conter cortes antigos ou exceder o novo limite. A recuperação descarta também a resposta ativa de formato antigo; respostas no formato atual mantêm texto e progresso, sem fala automática. Ao concluir a apresentação, o cursor de digitação desaparece; na pausa por perda da carta, aparece **AGUARDANDO A CARTA** e o cursor é preservado para a retomada.

**Baralho → EDITAR CARTA** continua disponível para refinamentos. Uma âncora não revisada não é desenhada, mas não impede os outros elementos ou a interpretação textual. Upload em lote usa `0-nome.jpeg` a `21-nome.jpeg`; substituições preservam o arquivo original e invalidam o inventário/âncoras antigos. A gravação é atômica; cache e revisão são vinculados aos bytes da referência.

Reconhecimento, rastreamento, preparo, chão, desenhos e Matrix não chamam API. Apenas a geração textual usa o cliente/modelo/personagem existente, com inventários das cartas e a conversa compartilhada. **Nenhuma imagem/frame, `input_image` ou ferramenta visual é enviada**. O verso é servido por `/api/tarot/back`, localmente. Falas do chão/encerramento são texto cênico local; contingência é explicitamente identificada como conteúdo cadastrado. O áudio continua sendo `robotSoundEngine`, procedural, sem TTS novo.

Uma concessão exclusiva impede duas projeções de abrirem câmeras simultâneas. O operador remoto vê referência/estado, sem streaming de webcam. STOP ALL, emergência, cancelamento, resposta atrasada, reset e recuperação usam a arquitetura existente. Contextos contemporâneos continuam editoriais, com fonte e data, e podem ser desativados.

## Validação

- `npm run test:tarot`: geometria, privacidade, concessão, concorrência, cancelamento, autonomia, recuperação e catálogo/upload.
- `npm run test:tarot:experience`: três parágrafos concisos, frases/perguntas completas na meta de palavras, rejeição de trechos incompletos e cache antigo, offsets/revelação, dupla, pausa/retomada exata, seis leituras, subconjuntos de 1, 4, 21 e 22 versos, seleção/retirada espacial, frente escolhida e encerramento.
- `npm run test:tarot:catalog`: 22 inventários e 182 âncoras; revisão visual em `/private/tmp/tarot-catalog-review/index.html`.
- `npm run test:tarot:vision`: OpenCV real e fotos fornecidas no Chromium. Todas as 22 frentes, perspectiva/rotação/escala/luz/oclusão, reflexo saturado sintético, duas cartas, fluxo, perda/retorno; 1, 4, 21 e 22 cópias do verso real, sobreposição/perspectiva/sombra sintéticas, piso texturizado, rejeição de frentes como costas e frente revelada sobre os outros 21 versos.
- `npm run test:tarot:browser`: produção, sessão e catálogo isolados, câmera sintética, transporte textual simulado. Inclui pausa na perda, retorno sem nova chamada, ausência de flash na lateral, leitura dupla, texto maior, rótulos removidos, Matrix editável, seis leituras e ciclo completo do chão. Inclui o botão **INTERPRETAR**, bloqueio durante input, pergunta aguardando carta, bypass de cache, envio exato da pergunta ao transporte, retorno à leitura livre e cancelamento. Confere o cursor da principal antes do boot, reabertura com histórico do tarô e ausência de publicação na principal durante leituras, chão e retorno.
- `npm run test:tarot:recovery:browser`: produção/sessão isoladas, OpenCV real sobre vídeo sintético e modelo simulado. Verifica Sacerdotisa, verbosidade zero, correção única de texto longo, falha persistente sem loop, diagnóstico privado preservado, botão de nova tentativa na mesma carta e recuperação após erro do provedor. Não usa câmera física nem OpenAI real.
- `node --no-warnings scripts/scene-zero-suitcase-regression-browser-test.js`: APIs interceptadas; snapshot antigo do tarô não vaza antes do boot, instrução da mala permanece com histórico do tarô, inclusive ao reabrir. Pode apontar para o servidor isolado por `CAIXA_PRETA_URL`.
- Regressão: `test:show-reliability`, `test:robot-sound`, `test:audience-warmup`, `test:games`, lint focado, build de produção isolada e `brain:sync`/`brain:check`.

Os testes acima passaram nesta evolução, incluindo o ciclo completo do chão no navegador. Os resultados finais e capturas do ensaio integrado ficam em `/private/tmp/tarot-browser-evidence`. O ensaio visual anterior no Safari 26.5.2 verificou composição e leitura sintética da versão anterior; não valida automaticamente a nova leitura dupla ou os 22 versos. O Safari em segundo plano suspendeu quadros sintéticos em parte do ensaio; a recuperação física após suspensão continua pendente. Não se alterou a configuração de automação WebDriver do Safari.

**Pendentes físicos:** reflexos reais, cartas pequenas/ocultas no conjunto de 22, perspectiva do chão, remoção pela mão, Safari com câmera real, saída de áudio e leitura no projetor. Os testes sintéticos não provam essas condições. O teste real de API solicitado anteriormente foi bloqueado pela revisão automática e não foi executado; nesta evolução o transporte do modelo continua simulado nos testes.
