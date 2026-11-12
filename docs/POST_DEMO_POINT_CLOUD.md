# Nuvem de pontos do pós-demo

## Antes do espetáculo

O conversor usa **Depth Anything V2 Small F16 via Core ML**, adaptado do protótipo local `plateia-point-cloud`. Requer macOS, Xcode Command Line Tools (`xcrun swiftc`) e o modelo já compilado. Prepare com o servidor fora de uma conversão:

```bash
npm run point-cloud:prepare
```

O comando copia o modelo do protótipo informado por Victor, compila `scripts/post-demo-point-cloud.swift` e aquece o plano de execução do Core ML usando um PNG sintético de um pixel. Salva modelo, executável e manifesto de versão em `.runtime/point-cloud/toolchain/`, fora do Git. Não baixa nada. Para outro computador, forneça o diretório `.mlmodelc` existente por `CAIXA_PRETA_POINT_CLOUD_MODEL_SOURCE`; `CAIXA_PRETA_POINT_CLOUD_TOOLCHAIN` muda o destino. Depois de alterar o código Swift, prepare novamente. Uma instalação sem preparo gera erro privado; o clique nunca instala dependências nem busca modelos na internet.

Coloque as fotos reais em `assets/publico/`. A pasta aceita arquivos regulares `.jpg`, `.jpeg` e `.png`, sem diferenciar maiúsculas. Em **cada clique**, o servidor escolhe a maior data de modificação (`mtime`), com desempate pelo nome. Não usa nome/ordem alfabética como data. Não percorre subpastas nem segue links simbólicos. As fotos são ignoradas pelo Git; apenas `.gitkeep` é versionado. Os testes nunca depositam fotos nessa pasta do checkout real.

## Operação e imagem

Em `/pos-demo/controle`, use a alça na borda direita para abrir/recolher os parâmetros e clique em **Gerar point cloud**. O botão fica desabilitado enquanto o processo calcula profundidade e pontos; andamento, nome do arquivo e erros são privados. Cartas, digitação e intervalos continuam em paralelo. Outra geração bem-sucedida substitui a nuvem; pasta vazia, foto ilegível ou falha do conversor mantêm a nuvem anterior da mesma apresentação. **RESET** reinicia as cartas e a revelação da nuvem desde os pontos próximos, reutilizando os dados 3D existentes e preservando os ajustes. STOP ALL, emergência e troca/recuperação de sessão cancelam trabalhos pendentes.

As duas rotas compartilham `PostDemo`. A nuvem surge sem reload em uma coluna à direita, ao lado da fala e sem deslocar a carta. A câmera começa muito próxima, vendo pontos isolados, e se afasta durante **12 segundos** até revelar a plateia. A densidade cresce gradualmente junto com o afastamento, para o rosto não aparecer antes da revelação. A rotação lateral oscila suavemente até cerca de **8°** para cada lado; uma respiração de distância de 3% mantém movimento após a revelação.

A malha usa até **1024 amostras no maior lado**, preservando a proporção da foto e sem ampliar imagens menores. Em fotos grandes, isso produz cerca de **4× mais pontos** que a malha anterior de 512, até **1.048.576 pontos** em imagens quadradas. O diâmetro base dos pontos passou a **60% do anterior**, com limite físico de **1–6 pixels** no canvas, para uma nuvem mais densa e pontos menores.

A correção de cor usa uma tabela de 256 valores (LUT), calculada uma vez. XYZ e RGB são embaralhados juntos em buffers contíguos; `drawRange` aumenta gradualmente o número de pontos desenhados durante a revelação, evitando processar a nuvem inteira para depois descartar pontos. O renderer não usa `preserveDrawingBuffer`; o teste lê os pixels dentro do quadro desenhado.

Nuvens já existentes mantêm sua quantidade de pontos: clique novamente em **Gerar point cloud** para aplicar a densidade nova. **RESET** apenas reinicia a sequência e a revelação usando a mesma nuvem; não reconverte a foto.

- Arrastar: giro 3D.
- Roda do mouse: zoom.
- Shift + arrastar ou botão direito: deslocamento.
- Depois de 1,8 segundo sem interação, o movimento automático volta gradualmente, preservando o enquadramento manual.

Não há textura fotográfica nem plano 2D: são pontos XYZ com RGB, renderizados por Three.js/WebGL. A profundidade é uma estimativa monocular relativa; não é um escaneamento volumétrico calibrado nem reconstrói o verso das pessoas. A oscilação pequena conserva a legibilidade da foto de origem. A navegação manual é local a cada janela; a referência à nuvem é compartilhada por estado/SSE.

## Dados e sessão

A foto original fica no servidor. `/api/game-assets` bloqueia `publico/`, inclusive caminhos codificados, aliases por symlink e pedidos Range. O servidor cria uma cópia privada apenas durante a conversão, apaga-a ao terminar e mantém somente os dados 3D necessários em `<runtime>/point-clouds/<hash-da-sessão>/<id>/points.bin`. Não gera vídeo, HTML, PLY ou imagem auxiliar. Nenhuma foto, profundidade ou nuvem vai à API de texto.

O formato binário `CPPC` tem cabeçalho de 16 bytes (assinatura, versão 1, quantidade, stride 15) e pontos float32 little-endian XYZ + RGB8. O decodificador valida formato, tamanho, coordenadas e limite de **1.048.576 pontos**, mantendo compatibilidade com as nuvens anteriores. O estado público recebe **apenas `{id, url}`**, sem caminho, foto original, nome do arquivo, progresso ou erro. O endpoint binário exige a sessão e o ID atualmente publicados, revalidando-os depois da leitura do arquivo.

Cada trabalho captura o ID da apresentação e um token exclusivo. Antes de publicar progresso ou resultado, valida ambos. Uma conversão atrasada não aparece em outra apresentação, mesmo se o processo ignorar o cancelamento. Apresentação nova não recebe referência anterior; URL antiga retorna 404. A recuperação pausada da mesma sessão pode reutilizar uma nuvem já concluída presente no disco; nunca retoma uma conversão interrompida.

## Verificação

```bash
npm run test:post-demo:point-cloud
npm run test:post-demo:point-cloud:browser
```

O teste de navegador usa **Chromium completo em headless novo** (`channel: "chromium"`), com `chromiumSandbox: true` e remoção do argumento padrão `--enable-unsafe-swiftshader`. O relatório registra o renderer WebGL e médias de quadros por segundo nas duas janelas; escolher o canal completo, por si só, não comprova aceleração de hardware.

O unitário cobre mtime a cada clique, pasta vazia, exclusão mútua, independência das cartas, falha preservando nuvem, estado público mínimo e resultado atrasado após troca de sessão (inclusive sem cancelamento cooperativo).

O navegador usa build/servidor isolados na porta 3331, provedor textual simulado e **conversão Core ML real local**. Usa duas fotos do protótipo com datas diferentes, muda as datas e confirma a seleção a cada clique. Verifica primeiro quadro sem reload, pontos coloridos à direita, revelação/rotação, giro/zoom/pan e retorno automático, cartas avançando, botão só privado, painel recolhido com nuvem, foto/alias/Range bloqueados, foto ilegível, pasta vazia e troca de sessão. Um wrapper exclusivo da fixture provoca saída com erro no processo conversor, confirmando que a nuvem anterior continua visível. Escreve relatório, screenshots e tempos em um diretório temporário; não altera a apresentação da porta 3000.

Em 12/11/2026, a **malha atual de 1024** passou nesse teste com o renderer `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`. Evidência: diretório temporário `caixa-point-cloud-browser-EZaCFT/report.json`.

| Foto | Pontos | Clique até primeiro quadro | Conversão |
| --- | ---: | ---: | ---: |
| JPEG | 588.800 | 1.169 ms | 747 ms |
| PNG | 589.824 | 536 ms | 375 ms |

As médias de uma amostra de **2 segundos** foram **120 fps na projeção e 121 fps no controle**. São medições locais no navegador com GPU Metal, não um SLA nem validação de projetor físico. Um ensaio intermediário de 8/9 fps usava `headless_shell` com **SwiftShader/Vulkan por software**; esse resultado não media aceleração pela GPU Apple M4 Pro.

O teste registra o tempo entre o clique e o primeiro quadro efetivamente desenhado no canvas da projeção. Em 12/11/2026, após preparo, a **versão anterior de 512 amostras no maior lado** mediu **405 ms (JPEG)** e **640 ms (PNG)** para 147.456 pontos por foto. A conversão levou 280/263 ms; o restante inclui evento, carregamento e renderização. O primeiro aquecimento nativo observado levou cerca de 9,5 segundos e foi feito antes da medição. Evidência histórica: diretório temporário `caixa-point-cloud-browser-vikouz`, com `report.json`, `initial-points.png` e `revealed.png`; imagens inspecionadas. Esses tempos não medem a malha de 1024. Chromium local não comprova desempenho em projetor físico ou outro computador.

A rodada ampliada da **versão anterior de 512**, com wrapper de falha e painel recolhido, também passou (`caixa-point-cloud-browser-BNBsgX`): **969 ms (JPEG)** e **814 ms (PNG)** até o primeiro quadro, conversão 833/317 ms. A variação inclui carga local e o wrapper de teste; não é um SLA da configuração atual. `combined-collapsed.png` confirma a composição da tela única sem parâmetros, preservando carta, fala e nuvem à direita. Naquela versão, os ciclos existentes, com projeção separada e com tela única, concluíram 22/22; não houve nova chamada real ao modelo textual.

As imagens de teste vêm do protótipo: fotografia **Audience in attendance-1**, de **Ap florida**, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Audience_in_attendance-1.jpg), licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), e a prévia derivada. As imagens não são distribuídas pelo repositório.
