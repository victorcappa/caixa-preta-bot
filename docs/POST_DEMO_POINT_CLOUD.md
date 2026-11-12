# Nuvem de pontos do pós-demo

## Antes do espetáculo

O conversor usa **Depth Anything V2 Small F16 via Core ML**, adaptado do protótipo local `plateia-point-cloud`. Requer macOS, Xcode Command Line Tools (`xcrun swiftc`) e o modelo já compilado. Prepare com o servidor fora de uma conversão:

```bash
npm run point-cloud:prepare
```

O comando copia o modelo do protótipo informado por Victor, compila `scripts/post-demo-point-cloud.swift` e aquece o plano de execução do Core ML usando um PNG sintético de um pixel. Salva modelo, executável e manifesto de versão em `.runtime/point-cloud/toolchain/`, fora do Git. Não baixa nada. Para outro computador, forneça o diretório `.mlmodelc` existente por `CAIXA_PRETA_POINT_CLOUD_MODEL_SOURCE`; `CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN` muda o destino. Depois de alterar o código Swift, prepare novamente. Uma instalação sem preparo gera erro privado; o clique nunca instala dependências nem busca modelos na internet.

Coloque as fotos reais em `assets/publico/`. A pasta aceita arquivos regulares `.jpg`, `.jpeg` e `.png`, sem diferenciar maiúsculas. Em **cada clique**, o servidor escolhe a maior data de modificação (`mtime`), com desempate pelo nome. Não usa nome/ordem alfabética como data. Não percorre subpastas nem segue links simbólicos. As fotos são ignoradas pelo Git; apenas `.gitkeep` é versionado. Os testes nunca depositam fotos nessa pasta do checkout real.

## Operação e imagem

Em `/pos-demo/controle`, use a alça na borda direita para abrir/recolher os parâmetros e clique em **Gerar point cloud**. O botão fica desabilitado enquanto o processo calcula profundidade e pontos; andamento, nome do arquivo e erros são privados. Cartas, digitação e intervalos continuam em paralelo. Outra geração bem-sucedida substitui a nuvem; pasta vazia, foto ilegível ou falha do conversor mantêm a nuvem anterior da mesma apresentação. **Reiniciar passeio** volta ao início do movimento selecionado, mantendo cartas, foto convertida e ajustes. **RESET** reinicia as cartas e o passeio, também reutilizando os dados 3D e preservando os ajustes. STOP ALL, emergência e troca/recuperação de sessão cancelam trabalhos pendentes.

As duas rotas compartilham `PostDemo`. Na composição automática, a nuvem ocupa **28% à direita** e **86% da altura da área cênica útil**, ao lado da fala. Com o painel aberto, suas alças permitem mover e redimensionar esse container; o ajuste é salvo e compartilhado com a projeção, como os de carta e texto. **Restaurar composição** recupera a distribuição automática; ver [POS_DEMO.md](POS_DEMO.md). O padrão **Revelar e passear** faz zoom-in durante **2 segundos no escuro**, revela os pontos com afastamento gradual durante **18 segundos** e então inicia um passeio contínuo de **48 segundos por ciclo**. A entrada escura começa depois que os dados estão prontos; o tempo até o primeiro quadro visível inclui essa escolha cênica. A distância final padrão é **0,8×** o enquadramento de referência, conservando a nuvem próxima e grande. Os pontos mantêm sua aparência fina quando a câmera se aproxima.

### Presets e controles privados

O painel **NUVEM 3D** tem seletor de preset, chaves de movimento automático e respiração do shader e dois grupos recolhíveis: **Câmera e passeio** e **Shader e pontos**. Os controles ficam somente em `/pos-demo/controle`; a projeção recebe os valores necessários para renderizar. Os ajustes salvam automaticamente em `postDemo.config.pointCloud`, por meio das preferências do operador, e voltam na próxima sessão. Eles são independentes do bot e do Tarô.

| Preset | Movimento |
| --- | --- |
| **Revelar e passear** — padrão | Zoom-in no escuro, revelação com zoom-out gradual e passeio panorâmico. |
| Passeio panorâmico | Desloca câmera e foco pelo espaço, com variações pequenas de ângulo e profundidade. |
| Entre as fileiras | Percorre a plateia verticalmente, aproximando e afastando a câmera. |
| Travessia lateral | Passeia de um lado ao outro da plateia. |
| Só rotacionar | Mantém a câmera no centro e gira a nuvem lateralmente, sem passeio ou zoom automático. |
| Aproximar e afastar | Varia apenas a distância da câmera. |
| Câmera parada | Mantém o enquadramento; a respiração continua se estiver habilitada. |

Selecionar outro preset reinicia somente o passeio selecionado. **Reiniciar passeio** publica a ação `cloud-replay`, sem zerar cartas nem reconverter a foto. Ambos compartilham o início do movimento entre as janelas. As outras alterações aplicam-se ao vivo, sem recriar o canvas ou os atributos da geometria.

| Controle de câmera | Padrão |
| --- | ---: |
| Tempo no escuro | 2 s |
| Tempo de revelação | 18 s |
| Distância inicial | 0,05× |
| Distância final / zoom-out | 0,8× |
| Duração do passeio | 48 s |
| Amplitude do passeio | 14% do maior lado da nuvem |
| Duração do giro | 22 s |
| Amplitude do giro | Até 8° para cada lado; menor nos passeios |
| Espera após navegação manual | 2 s |

Distâncias menores aproximam a câmera; tempos maiores tornam o movimento mais lento. O período do giro é independente da duração do caminho nos passeios panorâmico, lateral e pelas fileiras. Os campos continuam editáveis quando o movimento ou o shader estão desligados, permitindo preparar o próximo estado.

A malha usa até **1024 amostras no maior lado**, preservando a proporção da foto e sem ampliar imagens menores. Em fotos grandes, isso produz cerca de **4× mais pontos** que a malha anterior de 512, até **1.048.576 pontos** em imagens quadradas. O diâmetro base dos pontos passou a **60% do anterior**, com limite físico de **1–6 pixels** no canvas, para uma nuvem mais densa e pontos menores.

XYZ e RGB são embaralhados juntos em buffers contíguos; `drawRange` aumenta gradualmente o número de pontos desenhados durante a revelação, evitando processar a nuvem inteira para depois descartar pontos. O renderer não usa `preserveDrawingBuffer`; o teste lê os pixels dentro do quadro desenhado.

### Respiração e calibração no projetor

O vertex shader faz brilho e tamanho crescerem e recuarem em ciclos de **5 segundos**. A fase combina posição vertical (80%) e profundidade relativa (20%), criando atraso entre as fileiras em vez de pulsar a nuvem inteira em bloco. Uma minoria estável de pontos recebe um realce adicional suave no pico.

Cada ponto oscila em torno da posição original, com fases espaciais coerentes e uma pequena variação estável entre vizinhos. O deslocamento vetorial é limitado a **0,25% do maior lado da geometria**, com amplitude menor nas áreas claras para proteger detalhes dos rostos. A esfera usada no culling inclui essa margem. A posição original permanece num atributo estático na GPU: o deslocamento é calculado no shader, sem atualizar vértices na CPU a cada quadro.

O RGB original da foto é usado diretamente, **sem a LUT de clareamento anterior**. O ganho é escalar, preservando as proporções entre os canais; a margem até o branco (`1 - max(RGB)`) limita pulso e realces para evitar saturar os rostos iluminados. Brilho, tamanho e oscilação continuam enquanto o operador gira, aproxima ou desloca a nuvem: `uTime` avança fora dos ramos de navegação manual.

O grupo **Shader e pontos** permite calibrar diretamente a nuvem existente, sem reconverter a foto. Valores e limites aceitos estão em `lib/post-demo/pointCloudSettings.js`; os shaders e seus padrões de base estão em `lib/post-demo/pointCloudAnimation.js`. A alteração do período do pulso ou da velocidade da oscilação conserva a fase atual, para evitar um salto na animação.

| Parâmetro | Padrão | Unidade / efeito |
| --- | ---: | --- |
| `pulsePeriodSeconds` | 5 | Segundos por ciclo de luz e tamanho |
| `pulseIntensity` | 0,18 | Intensidade do ganho de luz, limitada pela margem até o branco |
| `pulseSize` | 0,14 | Variação de diâmetro de ±14%, mantendo o limite de 1–6 pixels |
| `highlightIntensity` | 0,20 | Realce adicional de uma minoria estável no pico |
| `localAmplitude` | 0,0025 | Fração máxima do maior lado da geometria (0,25%) |
| `motionSpeed` | 0,85 | Radianos por segundo, com harmônicos mais lentos nos três eixos |
| `rowPhaseSpread` | 1,65π | Radianos de defasagem ao longo das fileiras |
| `pointSize` | 1 | Multiplicador do tamanho dos pontos |
| `brightness` | 1 | Multiplicador de brilho com proteção dos realces |

Zerar `pulseIntensity`, `pulseSize`, `highlightIntensity` ou `localAmplitude` desativa o respectivo efeito. A chave **Respiração do shader** desliga pulso, realces e oscilação juntos, preservando os valores escolhidos. O shader limita as intensidades de luz e realce e a variação de tamanho; a amplitude local exige calibração visual na escala do projetor.

Nuvens já existentes mantêm sua quantidade de pontos: clique novamente em **Gerar point cloud** para aplicar uma mudança de densidade do conversor. Trocar preset, calibrar o shader, **Reiniciar passeio** e **RESET** reutilizam os dados 3D existentes.

- Arrastar: giro 3D.
- Roda do mouse: zoom.
- Shift + arrastar ou botão direito: deslocamento.
- Depois da espera configurada (padrão 2 segundos), o movimento automático volta gradualmente a partir do enquadramento manual. Desligar **Movimento automático da nuvem** conserva a vista escolhida. O relógio e a respiração do shader continuam durante giro, zoom e deslocamento manuais.

Não há textura fotográfica nem plano 2D: são pontos XYZ com RGB, renderizados por Three.js/WebGL. A profundidade é uma estimativa monocular relativa; não é um escaneamento volumétrico calibrado nem reconstrói o verso das pessoas. A oscilação pequena conserva a legibilidade da foto de origem. A navegação manual é local a cada janela; a referência à nuvem é compartilhada por estado/SSE.

## Dados e sessão

A foto original fica no servidor. `/api/game-assets` bloqueia `publico/`, inclusive caminhos codificados, aliases por symlink e pedidos Range. O servidor cria uma cópia privada apenas durante a conversão, apaga-a ao terminar e mantém somente os dados 3D necessários em `<runtime>/point-clouds/<hash-da-sessão>/<id>/points.bin`. Não gera vídeo, HTML, PLY ou imagem auxiliar. Nenhuma foto, profundidade ou nuvem vai à API de texto.

O formato binário `CPPC` tem cabeçalho de 16 bytes (assinatura, versão 1, quantidade, stride 15) e pontos float32 little-endian XYZ + RGB8. O decodificador valida formato, tamanho, coordenadas e limite de **1.048.576 pontos**, mantendo compatibilidade com as nuvens anteriores. A referência pública à nuvem continua sendo **apenas `{id, url}`**, sem caminho, foto original, nome do arquivo, progresso ou erro. Separadamente, `cloudPresentation` leva somente configurações de renderização e o token/data de início do passeio; personalidade, modelo e demais ajustes privados do bot ficam fora desse objeto. O endpoint binário exige a sessão e o ID atualmente publicados, revalidando-os depois da leitura do arquivo.

Cada trabalho captura o ID da apresentação e um token exclusivo. Antes de publicar progresso ou resultado, valida ambos. Uma conversão atrasada não aparece em outra apresentação, mesmo se o processo ignorar o cancelamento. Apresentação nova não recebe referência anterior; URL antiga retorna 404. A recuperação pausada da mesma sessão pode reutilizar uma nuvem já concluída presente no disco; nunca retoma uma conversão interrompida.

## Verificação

```bash
npm run test:post-demo:point-cloud
npm run test:post-demo:point-cloud:browser
npm run test:post-demo:point-cloud:animation
npm run test:post-demo:point-cloud:controls
npm run test:post-demo:point-cloud:motion
```

O teste de navegador usa **Chromium completo em headless novo** (`channel: "chromium"`), com `chromiumSandbox: true` e remoção do argumento padrão `--enable-unsafe-swiftshader`. O relatório registra o renderer WebGL e médias de quadros por segundo nas duas janelas; escolher o canal completo, por si só, não comprova aceleração de hardware.

O unitário cobre mtime a cada clique, pasta vazia, exclusão mútua, independência das cartas, falha preservando nuvem, estado público mínimo e resultado atrasado após troca de sessão (inclusive sem cancelamento cooperativo).

O navegador usa build/servidor isolados na porta 3331, provedor textual simulado e **conversão Core ML real local**. Usa duas fotos do protótipo com datas diferentes, muda as datas e confirma a seleção a cada clique. Verifica primeiro quadro sem reload, pontos coloridos à direita, revelação/rotação, giro/zoom/pan e retorno automático, cartas avançando, botão só privado, painel recolhido com nuvem, foto/alias/Range bloqueados, foto ilegível, pasta vazia e troca de sessão. Um wrapper exclusivo da fixture provoca saída com erro no processo conversor, confirmando que a nuvem anterior continua visível. Escreve relatório, screenshots e tempos em um diretório temporário; não altera a apresentação da porta 3000.

O comando `test:post-demo:point-cloud:animation` acrescenta pelo menos **dois ciclos completos em vista frontal e dois durante o giro**, observando o `uTime` real enviado ao WebGL. Exercita giro, zoom e deslocamento manuais com o relógio ativo; verifica defasagem entre faixas, pixels no pico/vale, canvas persistente e **zero uploads `ARRAY_BUFFER`/`bufferSubData` durante os ciclos**. Salva `animation-report.json` e PNGs de pico/vale para inspeção de rostos, fileiras e contornos. As métricas não substituem a leitura visual na projeção física.

`test:post-demo:point-cloud:controls` combina a auditoria de animação com os controles privados: presets, sincronização com a projeção, ajustes ao vivo, reinício independente do passeio e persistência. `test:post-demo:point-cloud:motion` verifica matematicamente os caminhos e sua continuidade nas transições e limites de ciclo, sem navegador ou modelo.

Em 12/11/2026, a implementação com controles passou na auditoria completa: **sete presets**, ajustes privados ao vivo, persistência, replay independente das cartas e navegação manual. O teste usou Core ML local e provedor textual simulado; 588.800/589.824 pontos, **120/121 fps** nas duas janelas com Metal Apple M4 Pro. Clique até o primeiro quadro visível: **4.060/3.682 ms**, incluindo o escuro e o início da revelação; conversão: 726/382 ms. A animação foi observada por **10,26 segundos de frente e 10,25 segundos no giro**, dois ciclos de 5 segundos por vista, com zero reenvios dos atributos. A inspeção dos PNGs conservou rostos e fileiras legíveis. Evidências temporárias: [relatório completo](/var/folders/zh/ffx555rn6wb0374j4z23s3jr0000gn/T/caixa-point-cloud-browser-3K2gPo/report.json), [controles](/var/folders/zh/ffx555rn6wb0374j4z23s3jr0000gn/T/caixa-point-cloud-browser-3K2gPo/point-cloud-controls-report.json) e [animação](/var/folders/zh/ffx555rn6wb0374j4z23s3jr0000gn/T/caixa-point-cloud-browser-3K2gPo/animation-report.json). Unitários de movimento, pós-demo e preferências (incluindo processo novo), lint e brain check também passaram. **Projetor físico não testado.**

Em 12/11/2026, a **malha de 1024 anterior à respiração no shader** passou no teste de navegador com o renderer `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`. Evidência histórica: diretório temporário `caixa-point-cloud-browser-EZaCFT/report.json`.

| Foto | Pontos | Clique até primeiro quadro | Conversão |
| --- | ---: | ---: | ---: |
| JPEG | 588.800 | 1.169 ms | 747 ms |
| PNG | 589.824 | 536 ms | 375 ms |

As médias de uma amostra de **2 segundos** foram **120 fps na projeção e 121 fps no controle**. São medições locais anteriores ao novo shader, não um SLA nem validação de projetor físico. Um ensaio intermediário de 8/9 fps usava `headless_shell` com **SwiftShader/Vulkan por software**; esse resultado não media aceleração pela GPU Apple M4 Pro.

O teste registra o tempo entre o clique e o primeiro quadro efetivamente desenhado no canvas da projeção. Em 12/11/2026, após preparo, a **versão anterior de 512 amostras no maior lado** mediu **405 ms (JPEG)** e **640 ms (PNG)** para 147.456 pontos por foto. A conversão levou 280/263 ms; o restante inclui evento, carregamento e renderização. O primeiro aquecimento nativo observado levou cerca de 9,5 segundos e foi feito antes da medição. Evidência histórica: diretório temporário `caixa-point-cloud-browser-vikouz`, com `report.json`, `initial-points.png` e `revealed.png`; imagens inspecionadas. Esses tempos não medem a malha de 1024. Chromium local não comprova desempenho em projetor físico ou outro computador.

A rodada ampliada da **versão anterior de 512**, com wrapper de falha e painel recolhido, também passou (`caixa-point-cloud-browser-BNBsgX`): **969 ms (JPEG)** e **814 ms (PNG)** até o primeiro quadro, conversão 833/317 ms. A variação inclui carga local e o wrapper de teste; não é um SLA da configuração atual. `combined-collapsed.png` confirma a composição da tela única sem parâmetros, preservando carta, fala e nuvem à direita. Naquela versão, os ciclos existentes, com projeção separada e com tela única, concluíram 22/22; não houve nova chamada real ao modelo textual.

As imagens de teste vêm do protótipo: fotografia **Audience in attendance-1**, de **Ap florida**, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Audience_in_attendance-1.jpg), licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), e a prévia derivada. As imagens não são distribuídas pelo repositório.
