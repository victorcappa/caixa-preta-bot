# Tarô / Treinamento

Rostos, fusões, mistura FOTO ↔ CARTA, efeitos independentes, presets e timeline: [TAROT_ALUCINACAO.md](TAROT_ALUCINACAO.md).

## Uso atual

O controle privado fica em `/treinamento/controle`, acessível por **TARÔ** na navegação e pelo link em `/operator`. A projeção pública é `/treinamento`. As duas usam a mesma sessão, conversa, personalidade, áudio procedural e SSE do espetáculo. Abrir o controle não muda a projeção. O antigo `/treino` continua sendo a calibração de personalidade.

As falas, perguntas, contingências e instruções do tarô aparecem somente em `/treinamento`. Elas permanecem no histórico compartilhado para dar contexto ao bot, mas não substituem `publicMessage` da tela principal nem entram na sua fila de digitação/sons. Antes do boot, a principal mantém apenas o cursor piscando; boot, BIOS, jogo das malas e falas próprias continuam no fluxo existente. Reabrir a principal também filtra mensagens antigas do tarô, sem reapresentá-las.

1. Abra a projeção no computador da câmera e clique **INICIAR PRÓLOGO** no controle. Reconhecimento e análise automáticos vêm ligados. Mostre uma ou duas cartas; o sistema espera três correspondências e pelo menos 450 ms de estabilidade.
2. As 22 fotografias possuem inventários e **182 âncoras editoriais**. O cache de descritores é preparado automaticamente e localmente; **PREPARAR BARALHO** só antecipa essa operação. Não é preciso cadastrar os elementos para começar.
3. Uma leitura tem **três parágrafos**: observação, interpretação e associação. A meta padrão é 90 palavras no total, ajustável em **Câmera e carta → Palavras por reflexão**. O corte local respeita frases completas, com prioridade para concluir uma ideia em vez de cortar na contagem exata. Duas cartas recebem uma única leitura conjunta, com relações entre ambas.
4. Os elementos surgem progressivamente na imagem e na lateral, conforme a fala. Uma nova resposta começa em zero; nunca herda o cursor completo da anterior. Cada item lateral usa o recorte da sua própria carta.
5. Perder uma carta interrompe a geração/apresentação da leitura física. A digitação e seus sons param; o texto já apresentado é preservado. O retorno estável da leitura completa retoma do cursor confirmado sem outra chamada ao modelo. Numa dupla interrompida, deixar apenas uma das cartas visível não transforma imediatamente a leitura em uma nova fala individual; retire/reapresente a nova leitura ou use a correção manual.
6. Movimento não repete chamadas. Por padrão, voltar a uma leitura anterior reapresenta seus segmentos da conversa, progressivamente, sem gerar outra interpretação. **Repetir análise quando uma carta retorna** permite gerar uma nova. **Análise automática** e **Reconhecimento automático** são opções independentes.
7. O texto do bot passou a 38 px no desktop, ajustável de 24 a 64 px em **Visual**. Os rótulos “CÂMERA AO VIVO”, a linha das quatro etapas e o bloco de status foram retirados da projeção.

Uma pausa manual permanece ativa mesmo se a carta continuar visível: o reconhecimento não reinicia sozinho a fala cancelada. Retome pelo controle ou inicie explicitamente outra análise.

Se um processo anterior ainda estiver aberto, a API pode informar `TAROT_RUNTIME_RESTART_REQUIRED`: esta evolução exige controller **v5**, que preserva a fala da tela principal. O singleton ativo não é apagado pelo hot reload. Reinicie o servidor em um momento adequado e use a recuperação existente se necessário. Não se reiniciou a sessão real durante os testes.

## Seis leituras e os 22 versos no chão

Em **Cartas no chão**, o padrão é **6 cartas distintas interpretadas até o fim**, ajustável entre 1 e 22. Uma dupla conta duas cartas. Perguntas adicionais sobre a mesma carta, movimento e respostas interrompidas não aumentam essa contagem. A etapa pode ser desligada ou iniciada manualmente. **REINICIAR CONTAGEM DAS CARTAS** limpa essa contagem e a escolha do chão, preservando a conversa.

Após atingir o limite, o bot pede para espalhar os **22 arcanos maiores**, separados e virados de costas. O Worker compara os quadriláteros encontrados à fotografia real **`assets/tarot/carta-fundo.jpeg`**. Não usa uma frente como substituta do verso. Contornos isolados ou somente 21 versos não autorizam a escolha.

O fluxo é:

- Esperar **22 versos confirmados e uma disposição estável** por 1.200 ms, ajustável no controle.
- Escolher uma posição e destacar seu quadrilátero na imagem. A escolha é espacial: as costas iguais não revelam qual arcano está embaixo.
- Ordenar fileiras **de cima para baixo**, e cartas **da direita para a esquerda** na imagem da câmera. Quando houver fileiras, a fala informa a fileira e a posição dentro dela, por exemplo: “Na segunda fileira, de cima para baixo, retire a terceira carta da direita para a esquerda.”
- Confirmar que **a posição escolhida desapareceu enquanto as outras 21 continuam nas posições esperadas**, por três observações e pelo menos 700 ms. Perder a cena inteira ou esconder várias cartas não confirma uma retirada.
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

## Catálogo, sincronização e custos

As 22 referências foram inspecionadas individualmente e revisadas com sobreposições numeradas, com correção de regiões. [TAROT_CATALOGO_VISUAL.md](TAROT_CATALOGO_VISUAL.md) lista elementos, relações e ambiguidades de cada carta. `assets/tarot/catalog.json` guarda IDs, coordenadas normalizadas, relações, conceitos, associações e hash de revisão. **Âncora revisada** significa conferida na fotografia; não significa teste físico nem certeza sobre a identidade de um detalhe ambíguo.

O modelo retorna `observation`, `interpretation` e `association`, cada um com frases e IDs. O normalizador reserva uma frase completa de cada trecho e distribui o orçamento restante entre frases inteiras, globalmente; não divide a meta rigidamente em três partes nem acrescenta um ponto a um fragmento cortado. Trechos estruturados sem pontuação final são rejeitados como `TAROT_NARRATIVE_INCOMPLETE`, sem publicar a resposta ou fazer uma nova chamada paga automaticamente. A primeira frase de cada trecho é preservada mesmo se isso ultrapassar a meta; a concisão também é exigida no prompt.

As posições dos trechos são calculadas depois da seleção das frases. Eventos de revelação usam essas posições/IDs, com distribuição gradual se uma frase trouxer vários elementos novos. IDs técnicos, o nome da marca e rótulos como “Cena teatral:” e “Pergunta curta para a plateia:” são removidos da prosa. Não se usa procura de palavras como única sincronização. Leituras anteriores à revisão 2 do formato continuam no histórico, mas não são reapresentadas automaticamente: podem conter cortes antigos. A recuperação descarta também a resposta ativa de formato antigo; respostas no formato atual mantêm texto e progresso, sem fala automática. Ao concluir a apresentação, o cursor de digitação desaparece; na pausa por perda da carta, aparece **AGUARDANDO A CARTA** e o cursor é preservado para a retomada.

**Baralho → EDITAR CARTA** continua disponível para refinamentos. Uma âncora não revisada não é desenhada, mas não impede os outros elementos ou a interpretação textual. Upload em lote usa `0-nome.jpeg` a `21-nome.jpeg`; substituições preservam o arquivo original e invalidam o inventário/âncoras antigos. A gravação é atômica; cache e revisão são vinculados aos bytes da referência.

Reconhecimento, rastreamento, preparo, chão, desenhos e Matrix não chamam API. Apenas a geração textual usa o cliente/modelo/personagem existente, com inventários das cartas e a conversa compartilhada. **Nenhuma imagem/frame, `input_image` ou ferramenta visual é enviada**. O verso é servido por `/api/tarot/back`, localmente. Falas do chão/encerramento são texto cênico local; contingência é explicitamente identificada como conteúdo cadastrado. O áudio continua sendo `robotSoundEngine`, procedural, sem TTS novo.

Uma concessão exclusiva impede duas projeções de abrirem câmeras simultâneas. O operador remoto vê referência/estado, sem streaming de webcam. STOP ALL, emergência, cancelamento, resposta atrasada, reset e recuperação usam a arquitetura existente. Contextos contemporâneos continuam editoriais, com fonte e data, e podem ser desativados.

## Validação

- `npm run test:tarot`: geometria, privacidade, concessão, concorrência, cancelamento, autonomia, recuperação e catálogo/upload.
- `npm run test:tarot:experience`: três parágrafos concisos, frases/perguntas completas na meta de palavras, rejeição de trechos incompletos e cache antigo, offsets/revelação, dupla, pausa/retomada exata, seis leituras, exigência de 22 versos, seleção/retirada espacial, frente escolhida e encerramento.
- `npm run test:tarot:catalog`: 22 inventários e 182 âncoras; revisão visual em `/private/tmp/tarot-catalog-review/index.html`.
- `npm run test:tarot:vision`: OpenCV real e fotos fornecidas no Chromium. Todas as 22 frentes, perspectiva/rotação/escala/luz/oclusão, reflexo saturado sintético, duas cartas, fluxo, perda/retorno; 22 e 21 cópias do verso real, piso texturizado, rejeição de frentes como costas e frente revelada sobre os outros 21 versos.
- `npm run test:tarot:browser`: produção, sessão e catálogo isolados, câmera sintética, transporte textual simulado. Inclui pausa na perda, retorno sem nova chamada, ausência de flash na lateral, leitura dupla, texto maior, rótulos removidos, Matrix editável, seis leituras e ciclo completo do chão. Confere o cursor da principal antes do boot, reabertura com histórico do tarô e ausência de publicação na principal durante leituras, chão e retorno.
- `node --no-warnings scripts/scene-zero-suitcase-regression-browser-test.js`: APIs interceptadas; snapshot antigo do tarô não vaza antes do boot, instrução da mala permanece com histórico do tarô, inclusive ao reabrir. Pode apontar para o servidor isolado por `CAIXA_PRETA_URL`.
- Regressão: `test:show-reliability`, `test:robot-sound`, `test:audience-warmup`, `test:games`, lint focado, build de produção isolada e `brain:sync`/`brain:check`.

Os testes acima passaram nesta evolução, incluindo o ciclo completo do chão no navegador. Os resultados finais e capturas do ensaio integrado ficam em `/private/tmp/tarot-browser-evidence`. O ensaio visual anterior no Safari 26.5.2 verificou composição e leitura sintética da versão anterior; não valida automaticamente a nova leitura dupla ou os 22 versos. O Safari em segundo plano suspendeu quadros sintéticos em parte do ensaio; a recuperação física após suspensão continua pendente. Não se alterou a configuração de automação WebDriver do Safari.

**Pendentes físicos:** reflexos reais, cartas pequenas/ocultas no conjunto de 22, perspectiva do chão, remoção pela mão, Safari com câmera real, saída de áudio e leitura no projetor. Os testes sintéticos não provam essas condições. O teste real de API solicitado anteriormente foi bloqueado pela revisão automática e não foi executado; nesta evolução o transporte do modelo continua simulado nos testes.
