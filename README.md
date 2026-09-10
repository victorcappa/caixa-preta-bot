# Caixa Preta Chat

Primeiro prototipo local para o espetaculo **A Caixa Preta**.

O projeto tem duas interfaces sincronizadas:

- Projecao publica: `http://localhost:3000`
- Operator: `http://localhost:3000/operator`

## Requisitos

- Node.js 20 ou superior
- Uma chave da OpenAI API

## Instalacao

```bash
npm install
```

## Chave da OpenAI

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```bash
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5-mini
```

O arquivo `.env.local` esta no `.gitignore` e nao deve ser commitado.

`OPENAI_MODEL` e opcional. O padrao do projeto e `gpt-5-mini`, escolhido para dar mais corpo, humor e personalidade nas respostas em apresentacao. Para testes locais de menor custo, voce pode trocar para `gpt-5-nano`.
Durante a apresentacao, o operator tambem permite alternar entre `gpt-5-mini`
e `gpt-5-nano` sem reiniciar o servidor.

## Rodar localmente

```bash
npm run dev
```

O servidor e obrigado a usar `http://localhost:3000`. Se a porta 3000 ja
estiver ocupada, o comando falha e mostra como localizar o processo, em vez de
subir automaticamente em outra porta.

Depois abra:

- `http://localhost:3000`
- `http://localhost:3000/operator`
- `http://localhost:3000/cena-0-controller`, controller dramatúrgico da Cena 0 — Bot / Malas
- `http://localhost:3000/baralho-morbido`, para a tela publica do Baralho Morbido
- `http://localhost:3000/baralho-morbido-controller`, para sortear e reiniciar o Baralho Morbido
- `http://localhost:3000/queda-aviao`, para a projecao textual isolada de Queda Aviao
- `http://localhost:3000/queda-aviao-controller`, para controlar essa projecao em tempo real
- `http://localhost:3000/forca-g-samples`, tela publica unificada de samples e shaders da Forca G
- `http://localhost:3000/forca-g-samples-controller`, controller unificado de samples e shaders
- `http://localhost:3000/transicao-psicodelica`, tela publica preta da transicao psicodelica
- `http://localhost:3000/transicao-psicodelica-controller`, controller preparado para a transicao psicodelica
- `http://localhost:3000/tea-for-two`, tela publica preta de Tea For Two
- `http://localhost:3000/tea-for-two-controller`, controller preparado para musica e transicao
- `http://localhost:3000/piloto-videogame`, tela publica do piloto
- `http://localhost:3000/piloto-videogame-controller`, controller preparado para soundboard do piloto
- `http://localhost:3000/tecnologia-floresta-controller`, controller preparado para camada sonora transversal
- `http://localhost:3000/glitch-controller`, para testar e ajustar o glitch visual em tempo real

Pontos importantes:

- O projeto deve rodar sempre em `http://localhost:3000`; nao use porta alternativa para ensaio.
- Se o Next ficar preso em chunks antigos, pare o servidor e rode `rm -rf .next` antes de `npm run dev`.
- Nao rode `next build` ao mesmo tempo que `npm run dev`; isso pode quebrar manifests temporarios do dev server.
- O operator e uma tela de recuperacao: blackouts escurecem telas publicas, mas nao escurecem o operator.
- Baralho Morbido usa polling leve proprio, nao SSE global, para nao travar Operator/Chat quando a tela publica esta aberta.
- As demais telas publicas recebem atualizacoes imediatamente por SSE e conferem
  uma revisao leve do estado a cada 400 ms. Se o stream engasgar, a tela busca o
  snapshot mais novo so quando detectar uma revisao pendente, sem exigir refresh.

## Controle de telas de projecao

No `/operator`, use `ABRIR NOVA JANELA COM` para criar uma janela publica
controlada. Uma tela publica aberta diretamente em `http://localhost:3000`
tambem se registra sozinha. A janela recebe ou solicita um `projectionWindowId`,
salva o mesmo ID em `sessionStorage`, registra-se em `/api/projection` e passa
a receber comandos pelo SSE existente em `/api/events`.

Depois de posicionar essa janela no monitor/projetor em modo Estender Tela, use
`MUDAR PARA TELA` no `/operator` para trocar somente a janela de projecao ativa.
O Operator nao navega nem recarrega. Abrir uma nova janela controlada torna essa
janela a ativa; a estrutura do estado guarda multiplas janelas em
`projection.windows`, entao comandos futuros podem ser direcionados por ID.
Ao trocar de controller, a aplicação consulta primeiro uma janela realmente
conectada; registros antigos ou fechados são ignorados, sem gerar conflito 409.

Telas publicas controlaveis:

- `Chatbot`: `/`
- `Baralho Morbido`: `/baralho-morbido`
- `Queda Aviao`: `/queda-aviao`
- `Forca G — Sampler + Shaders`: `/forca-g-samples`
- `Transicao Psicodelica`: `/transicao-psicodelica`
- `Tea For Two`: `/tea-for-two`
- `Piloto Videogame`: `/piloto-videogame`
- `Tecnologia x Floresta`: `/tecnologia-floresta`

Telas de controller, debug e treinamento nao entram no menu de projecao. Se o
Safari bloquear `window.open()`, permita popups para `localhost:3000`; a abertura
precisa acontecer a partir do clique do operador para ser aceita pelo navegador.

O operator tambem pode ser aberto dentro da tela principal pelo botao `OP`,
abaixo do botao `?`. Ele alterna entre chat em tela cheia e chat com terminal
operador ao lado; em telas menores, aparece como gaveta animada.

## UI pública e Esquentar Público

O chatbot público mostra apenas `publicMessage`, a última fala relevante da
Caixa Preta, com tipografia responsiva de projeção. `conversation` continua
guardando todas as mensagens para contexto do modelo e histórico do operator.
Uma nova fala substitui visualmente a anterior; `LIMPAR TELA` remove somente
`publicMessage` e preserva a conversa. Durante a digitação, o início de cada
linha permanece fixo e os caracteres avançam para a direita, sem recentralizar
ou rebalancear o texto a cada atualização.

No `/operator`, `AQUECIMENTO DA PLATEIA` oferece ações físicas, intensidades
`LEVE`, `MÉDIO` e `ESTRANHO`, 66 prompts em
`data/audience-warmup-prompts.js`, frase manual, preview e `SURPREENDA-ME`. O
boot atualiza fatos de São Paulo e algumas atualidades do Brasil e do mundo;
chamadas sucessivas de `SURPREENDA-ME` usam esse contexto e aumentam a
estranheza a cada duas perguntas na sequência `ação → exposição → divisão →
julgamento → contato → confronto`. As falas são ordens curtas de sistema, sem
convite, explicação ou tom de animador. O fallback para a biblioteca
estática preserva essa progressão e inclui perguntas específicas sobre Metrô,
Tietê, Pinheiros, trânsito e clima paulistano.
O módulo começa comprimido e alterna entre `EXPANDIR` e `COMPRIMIR` ao tocar no
cabeçalho; `JOGO DAS MALAS` fica imediatamente abaixo, sempre visível no fluxo
do operator. A lista completa das 66 falas também começa comprimida dentro do
aquecimento e pode ser aberta quando necessária.
Escolher um tipo de ação e uma intensidade já gera e envia a primeira etapa,
sem botão intermediário. A ordem dos dois cliques é livre: a segunda escolha
completa o par e dispara a fala. `SURPREENDA-ME` cria a combinação
inteira imediatamente. Na frase manual, `Enter` envia e `Shift+Enter`
insere uma quebra de linha. Depois do envio, o operador pode avançar, repetir,
cancelar ou limpar a partitura. O avanço automático é opcional, configurável e
sempre cancelável. Ordens com duração como `por cinco segundos` recebem uma
contagem regressiva automática em ritmo real de um segundo. A projeção mostra
somente a etapa corrente e uma indicação pequena da ação esperada.

A abertura da Cena 0 começa em `STANDBY`: ao abrir ou executar `/reset`, a
projeção fica totalmente preta, sem cursor, texto, campo público ou animação.
Somente o botão `BOOT`, no controller, inicia a BIOS orientada a dados. Ela
carrega teatro, técnica e elenco, detecta a plateia e trava em `78%`. A barra pertence a
`showState.sceneZero.unlock`: continua visível sobre o chat durante o
aquecimento e sai da projeção quando a verificação termina.
Ao travar, a BIOS mostra o erro e a dependência `AÇÃO COLETIVA`; depois, limpa a
tela e mantém somente um cursor piscando. O estado permanece parado aí por tempo
indeterminado. O operador precisa abrir `AQUECIMENTO DA PLATEIA` e acionar
`INICIAR AQUECIMENTO`. Só então `... PROVE QUE VOCÊ É HUMANO` aparece sozinha
uma única vez, antes da primeira pergunta física. O título nunca volta durante
a rodada. Não há imagens nem CAPTCHA visual nesse protocolo, nem a mensagem
`PEÇA DESBLOQUEADA` na conclusão.
Ao lado de `BOOT`, `REINICIAR` executa o reset global: sinaliza parada para as
requisições em curso, encerra rotinas externas e internas, limpa jogos, timers,
glitch, navegador e aquecimento e devolve a projeção ao preto de `STANDBY`.
Os estados semânticos são `STANDBY`, `BOOTING`, `BOOT_FAILED`,
`HUMAN_VERIFICATION`, `WAITING_FOR_AUDIENCE`,
`WARMING_AUDIENCE`, `UNLOCKING` e `UNLOCKED`; enquanto a peça está bloqueada,
esse contexto também é enviado ao bot.

Cada item da lista mostra texto, categoria, `progressValue`, estado de pontuação
e `repeatableProgress`. Na projeção, a faixa compacta de aquecimento mostra
somente a barra gráfica, sem título, subtítulo, feedback ou percentual visível.
`DISPARAR` envia a ação e aplica seu progresso;
`DISPARAR SEM PROGRESSO` preserva a barra. Por padrão, um mesmo ID pontua uma
vez; itens repetíveis podem pontuar novamente e itens com `progressValue: 0`
servem como perguntas sem avanço. O feedback técnico continua registrado no
estado antes da mudança de percentual, gira por uma sequência controlada e não
é mais escrito na faixa pública da barra.

O controller também mantém `+ PARTICIPAÇÃO`, `− PARTICIPAÇÃO`, definição exata
de progresso, `COMPLETAR BARRA`, `DESBLOQUEAR AGORA`, áudio, pausa/avanço da
BIOS e reinício. `COMPLETAR BARRA` anima do valor atual até `100%` e inicia a
sequência final sem exigir todas as ações. A integração legada com o fim das
malas continua podendo concluir a mesma barra central, sem criar um segundo
estado. A configuração de conteúdo, ritmo, feedback e conclusão fica em
`data/scene-zero-unlock.js`; `onPlayUnlocked` fica registrado no estado e no
evento SSE para futuras integrações de luz, som, vídeo e mecanismos.

Prompts com metadado `countdown` — como `countdown: 3` — sempre cumprem a
contagem prometida, mesmo com o avanço automático geral desligado. Em frases
manuais, o sistema reconhece limites diferentes em construções como `quando eu
disser cinco`, `vou contar até 4`, `contagem de dois até seis` e `contagem
regressiva de 5`; uma promessa genérica de contagem usa `Um`, `Dois`, `Três`.
A instrução permanece até sua digitação terminar antes da contagem começar.
Frases sem promessa ou metadado não recebem contagem.

Instagram nunca é aberto pelo bot, por tools autônomas ou ao entrar em uma
etapa. A integração existente só navega após clique/comando explícito do
operador. A proteção central em `lib/externalNavigationGuard.js` também rejeita
eventos do agente que tentem carregar URL, deep link ou navegação externa.

As telas privadas de operacao tem um menu comum no topo, configurado em
`lib/controllerSurfaces.js`. O `/operator` funciona como hub e organiza os
controllers em colunas por cena: uma cena com apenas um controller aparece uma
vez; as partes da Cena 2 ficam empilhadas na mesma coluna. Cada rota
carrega apenas o controller ativo, sem misturar todos os controles em uma tela
unica. O sampler e os shaders da Força G compartilham a aba `CENA 2A`.

Cada controller de cena também tem um bloquinho privado de anotações no canto
inferior direito. Ele salva automaticamente em `data/scene-notes.json`, mantém
notas independentes para cada aba cênica e pode ser minimizado durante a
operação. Essas anotações nunca são enviadas para a projeção pública nem para o
modelo.

Grupos atuais:

- `CENA 0`: `Bot / Malas`, rota `/cena-0-controller`
- `CENA 1`: `Queda / Emergencia`, rota `/queda-aviao-controller`
- `CENA 2`: `Forca G — Sampler + Shaders`, `Baralho Morbido`,
  `Transicao Psicodelica`
- `CENA 3`: `Tea For Two`
- `CENA 4`: `Piloto / Videogame`
- `CAMADAS`: `Tecnologia x Floresta`
- `OUTROS`: `Operator` (console técnico neutro), `Glitch Geral` e `Treino`

Cada aba cenica troca a projecao para sua rota publica correspondente. `Bot /
Malas` abre `/`, `Baralho Morbido` abre `/baralho-morbido`, `Queda /
Emergencia` abre `/queda-aviao` e as demais cenas abrem uma tela preta propria
enquanto sua logica publica ainda nao existe. `Forca G — Sampler + Shaders`
mostra vídeos, imagens e efeitos disparados no controller em tempo real.
`Glitch Geral` nao troca a cena projetada: ele abre o controller e o glitch
continua sendo aplicado sobre a tela publica que ja estiver ativa.

## Cena 2A — Sampler Força G

`/forca-g-samples-controller` é a central privada de disparo e
`/forca-g-samples` é sua projeção pública. O sampler usa o `showState` e o SSE
já existentes, mas mantém slots independentes para vídeo principal, G-LOC,
imagens, shader, texto, glitch e vozes de áudio. Assim, trocar ou avançar outro
conteúdo da cena não encerra samples; somente término natural, STOP individual,
STOP AUDIO ou STOP ALL os remove. STOP ALL também neutraliza vídeos, imagens,
texto, shaders e o glitch global sem resetar o restante do espetáculo.
As rotas antigas `/forca-g-shaders-controller` e `/forca-g-shaders`
redirecionam para essas duas superfícies unificadas.

Os assets novos ficam em:

```text
assets/sampler-forca-g/
├── manifest.json
├── g-loc/
├── videos/
├── images/
├── audio/
└── texts/
```

Arquivos suportados colocados diretamente nessas pastas entram automaticamente
como pads ao usar `RECARREGAR ASSETS` ou recarregar o controller. O label é
derivado do nome do arquivo. Para customizar label, atalho, loop, volume, fade,
modo de imagem ou texto, registre o item no `manifest.json`; `file` pode ser só
o nome dentro da pasta da categoria ou um caminho relativo a `assets/`. Os três
vídeos legados de `assets/videos/forca-g/` permanecem onde estavam e estão
referenciados pelo manifest como G-LOC. Cues com arquivo que já tenham sido
salvos pelo controller anterior em `data/controller-cues.json` também são
incorporados quando ainda não aparecem no manifest, preservando compatibilidade.

Para gerar novamente as três variações limpas da voz idosa do registro
fonográfico, configure `OPENAI_API_KEY` em `.env.local` e rode:

```bash
npm run generate:elderly-voice
```

O script independente `scripts/generate-elderly-voice.js` usa
`gpt-4o-mini-tts`, imprime voz, velocidade e direção de cada variação e grava os
MP3 em `assets/sampler-forca-g/audio/`. Esses arquivos aparecem automaticamente
no sampler; a apresentação deve informar ao público que as vozes são geradas
por IA.

Os áudios da cena 2 em `assets/audios/cena-2-efeitos/` também entram
automaticamente na seção `SOM`, sem precisar duplicá-los no manifest. A ordem
alfabética recebe inicialmente os atalhos `Q`, `W`, `E` e `R`; novos arquivos
continuam pela grade de teclas disponível.

Os vídeos de explicação ficam em `assets/videos/explicacoes-sampler/` e entram
automaticamente na seção `VÍDEO`, com atalhos numéricos a partir de `4`. Cada
pad usa a camada de vídeo independente do G-LOC, portanto os dois podem coexistir
e receber os shaders integrados na própria Cena 2A. Não existe uma aba separada
para shaders; as rotas antigas apenas redirecionam para o sampler unificado.

Exemplo compacto de configuração manual:

```json
{
  "audio": [
    { "id": "heartbeat", "label": "HEARTBEAT", "file": "heartbeat.mp3", "shortcut": "q", "loop": true, "volume": 0.8 }
  ],
  "texts": [
    { "id": "quatro-g", "label": "4G", "text": "4G", "shortcut": "4", "durationMs": 2500 }
  ],
  "images": [
    { "id": "diagrama", "label": "DIAGRAMA", "file": "g-force-diagram.png", "mode": "overlay", "fit": "contain" }
  ],
  "presets": [
    {
      "id": "g-mais-4",
      "label": "G+ 4",
      "shortcut": "f4",
      "actions": [
        { "type": "play", "item": "heartbeat" },
        { "type": "play", "item": "quatro-g" },
        { "type": "shader", "shader": "tunnel", "enabled": true }
      ]
    }
  ]
}
```

Para G-LOC, vídeo, imagem e áudio, copie o arquivo para a pasta correspondente;
nenhum script move, converte ou apaga mídia. Textos podem ser itens inline no
manifest ou arquivos `.txt` em `texts/`. Imagens `replace` substituem o conjunto
visual atual; imagens `overlay` são acrescentadas e podem coexistir. Atalhos são
locais ao controller, configuráveis, aparecem nos pads e ficam suspensos com
foco em input, textarea, select ou conteúdo editável. Duplicatas são avisadas na
tela e o primeiro item vence. O volume geral atua sobre as vozes e vídeos com
áudio sem apagar a regulagem individual de cada pad. O mesmo slider, acompanhado
de `MUTE`, fica fixo à direita em todas as telas de controller e permanece
acessível durante a rolagem.
Somente imagens são pré-carregadas; áudios e vídeos aguardam o disparo do pad
para não disputar conexões com a mídia que precisa tocar naquele instante.

O painel de pedais abaixo dos pads de áudio é o mesmo da cena 1. Cada pad mantém
sua própria combinação dos presets `LIMPO`, `RÁDIO`, `SATURADO`, `DESTRUÍDO` e
`SUBMERSO`, dos pedais drive, phaser, wah-wah, echo e pitch, e dos controles de
filtros, mix e saída. A alteração é aplicada ao vivo a todas as vozes ativas
daquele pad, sem afetar os outros samples; um novo disparo do mesmo pad cria uma
voz adicional. As regulagens são salvas automaticamente em
`data/forca-g-sampler-settings.json` e voltam no próximo carregamento.

O manifest preserva itens inválidos como pads em erro, registra no console o
caminho ausente e mantém os outros controles utilizáveis. A validação lógica
rápida é `npm run test:forca-g-sampler`; o fluxo completo pode ser validado com
`npm run test:forca-g-sampler:browser` enquanto o servidor local estiver ativo.
Para áudio remoto no Safari, desbloqueie
a janela pública com uma interação antes do ensaio por causa da política de
autoplay do navegador. Se o browser bloquear o primeiro play com áudio, o G-LOC
faz fallback automático para `MUTED`, continua exibindo o vídeo e atualiza o
controle de som sem classificar o arquivo como quebrado.

Para não esgotar as conexões do navegador, a projeção pré-carrega somente
imagens. Áudios e vídeos iniciam a transferência quando o pad é disparado; isso
evita que um banco grande de mídia deixe o elemento ativo em `NETWORK_EMPTY`.

## Cena 1 — Queda / Emergência

`/queda-aviao-controller` mantém o transporte manual e automático do texto da
Queda Avião e inclui, na mesma tela, `SAMPLER — QUEDA / EMERGÊNCIA`. O sampler
é uma instância do `EditableCueController` já usado nas outras cenas; ele não
avança, retrocede, pausa nem reseta o texto.

Os pads iniciais ficam em `lib/controllerCueConfig.js`, na configuração
`queda-aviao-sampler`, e são montados a partir de todos os MP3, WAV, OGG ou M4A
existentes em `assets/audios/queda-aviao/`; o nome de cada botão é o nome do
arquivo sem a extensão. Arquivos salvos nessa pasta são preservados e entram
automaticamente no sampler, sem qualquer rotina de exclusão.
Na própria tela, abra `CONFIGURAR SAMPLES / ATALHOS`, selecione o botão a editar,
escolha ou envie outro arquivo, ajuste nome/atalho e use `SALVAR PADRÃO`. Também
é possível criar novos botões. `CRIAR BOTÕES DOS ARQUIVOS DA PASTA` relê o
diretório naquele instante, acrescenta e salva um pad para cada áudio ainda não
cadastrado, sem remover pads ou arquivos existentes. A persistência segue o fluxo compartilhado em
`data/controller-cues.json`; uploads ficam em
`assets/controller-cues/queda-aviao-sampler/`.

Cada sample possui PLAY, STOP, LOOP ON/OFF e volume independentes. One-shots
podem ser disparados repetidamente e samples distintos continuam tocando ao
mesmo tempo no controller e na projeção `/queda-aviao`. Alterar loop ou volume
durante a reprodução atualiza as instâncias ativas sem reiniciá-las. Atalhos são
editáveis e não disparam com foco em input, textarea, select ou conteúdo
editável. Pads sem atalho recebem automaticamente a grade `Q W E / A S D / Z X C`;
se houver mais samples, a distribuição continua pelas demais letras disponíveis.
A tecla de cada pad aparece no próprio botão. `L` é reservada para ligar ou
desligar o loop do sample selecionado. `SILÊNCIO / STOP ALL` para somente os
áudios deste sampler, inclusive
loops, sem mudar o bloco textual nem a projeção. `FADE OUT` reduz durante dois
segundos e encerra somente as instâncias ativas daquele pad no controller e na
projeção; os demais samples continuam tocando.

Abaixo do texto, a pedaleira processa ao vivo os samples que tocam no controller
e na projeção. Cada pad guarda e salva automaticamente sua própria cadeia: ao
selecionar outro sample, o painel carrega os pedais daquele pad sem alterar o
anterior. Assim, samples simultâneos podem usar efeitos completamente diferentes.
Os presets `LIMPO`, `RÁDIO`, `SATURADO`, `DESTRUÍDO` e `SUBMERSO` podem ser
combinados com pedais independentes de drive, phaser, wah-wah, echo e pitch, além
dos controles de filtros, mix e saída. O pitch cobre uma oitava para baixo ou
para cima e também altera a velocidade do sample; em Queda, seu slider e o botão
ON/OFF ficam destacados no alto da pedaleira. Mover qualquer handle cria um
ajuste personalizado; `EFEITOS EM BYPASS` desliga a cadeia do sample selecionado
sem apagar os valores preparados. Para validar o fluxo completo no navegador, use
`npm run test:scene-one-audio-effects` com o servidor local ativo.

## Cena 0 — Bot / Malas

`/cena-0-controller` é a superfície privada dedicada à Cena 0. `/operator`
continua disponível como console técnico e hub neutro; entrar nele não troca a
projeção. O controller da Cena 0 segue a ordem operacional `BOOT` → `ESQUENTAR
PÚBLICO` → `ESCOLHER PARTICIPANTE` → `JOGO DAS MALAS`, sem outro painel entre
essas etapas. O aquecimento começa comprimido; os detalhes da roleta também.
Memória, personalidade, direção, coleta, canto,
glitch, navegador e aeroporto/áudio permanecem preservados dentro de `OUTROS
CONTROLES`, fechado por padrão.
Um índice fixo exclusivo dessa rota ocupa a lateral direita e navega somente
entre boot, aquecimento, participante, malas e outros controles. A seção visível fica
destacada; em telas estreitas, o mesmo índice vira uma faixa fixa compacta na
parte inferior para não cobrir os controles.

No bloco `GLITCH`, além dos níveis dramatúrgicos, o operator pode escolher um
vídeo real de `assets/videos/glitch/`, ativar loop e configurar entre `0,6` e
`30` segundos de glitch progressivo antes de o vídeo dominar completamente a
projeção. `GLITCH + VÍDEO` inicia a invasão usando o sistema global já existente;
`VOLTAR AO BOT` interrompe vídeo e glitch e restaura a projeção anterior.

Os dez botões grandes apenas definem em que etapa a apresentação está. Cada
mudança registra etapa anterior, etapa atual, ação do operador, participante e
acontecimentos recentes em `showState.sceneZero`; esse contexto é enviado ao
mesmo modelo e à mesma persona do chat. O texto público não vem de uma tabela
de falas. O modelo decide como formular a condução e se vale a pena reconhecer
metalinguisticamente a operação humana. A etapa só muda em outro clique do
operador.

No topo, `MEMÓRIA DA SESSÃO` oferece um campo e o botão `ADICIONAR /MEMORY` para
registrar observações sem abrir o terminal. Enter também envia. A área usa o
mesmo comando `/memory` e o mesmo `showState.memories` do operator, mostra os
cinco registros mais recentes e não dispara fala pública automaticamente: a
observação entra como contexto silencioso para uso quando for relevante.

Logo abaixo, `ORIENTAÇÕES DE PERSONALIDADE` mantém uma direção persistente para as
próximas falas da Caixa, como tom, ritmo, humor ou atitude. Salvar e limpar essa
orientação não gera fala pública, não troca a etapa e não interrompe jogo,
timer, Instagram, pesquisa ou outro processo em andamento. A orientação entra
silenciosamente no contexto do modelo até ser alterada, limpa ou a sessão ser
reiniciada.

Os botões de direção rápida dessa área entram em vigor no clique e podem ser
combinados entre categorias: extensão, tom, ritmo, atitude e gameplay. Dentro
da mesma categoria, uma opção substitui a anterior — por exemplo, `MAIS CURTA`
troca `DESENVOLVIDA`, e `ACELERADA` troca `MAIS PAUSADA`. Clicar novamente na
opção ativa a desliga. O texto livre permanece independente dos botões.

O bloco `PERGUNTAS / COLETA` pode ser usado em qualquer etapa. Durante a coleta,
`NOVA PERGUNTA`, `REFORMULAR` e `COMENTAR RESULTADO` geram uma
intervenção dentro da performance, não um questionário fixo. O modelo recebe
repertórios de assuntos e ações, a personalidade e a memória já existentes,
além do dataset da sala: tópico, ação, tipo de resposta, intensidade,
sensibilidade, escala, condições cruzadas, resultado aproximado e observações
reais. Ele é orientado a começar normal, variar assunto e ação, construir
subgrupos, cruzar respostas anteriores e aumentar a estranheza gradualmente.
O prompt de sistema específico dessa etapa fica em `prompts/dataCollection.js`
e usa `data/coleta-de-dados.json` como configuração e repertório, nunca como uma
lista fixa de perguntas. A cada geração ele decide silenciosamente se deve
aprofundar um grupo real, cruzar dados, abrir outra dimensão ou fazer um
experimento comportamental. Esse prompt só é anexado às chamadas feitas enquanto
a etapa ativa é `COLETA DE DADOS`; perguntas avulsas e as outras etapas não o
recebem.

Fora da coleta, os mesmos botões fazem e acompanham perguntas avulsas adequadas
ao momento atual, sem trocar, encerrar ou avançar o processo ativo e sem impor
linguagem de formulário à conversa.

Na rotação de ações da coleta, levantar ou manter a mão é um recurso raro: após
uma ocorrência, as quatro intervenções seguintes precisam usar outra família.
O repertório prioriza quantidades e padrões de palmas, respostas em voz alta ou
em coro, sussurro, repetição, sons, cantarolar, contagem, apontar, olhar,
escolher lados, mudar posição, congelar, fechar os olhos e silêncio temporizado.
Se o modelo insistir em mãos levantadas nesse intervalo, a fala é regenerada
antes de chegar à projeção.

Depois de uma intervenção, o operador pode registrar `NINGUÉM`, `POUCOS`,
`METADE`, `MUITOS`, `QUASE TODOS`, `TODOS`, uma contagem de `0` a `5+` ou só
uma observação livre. A observação serve também para corrigir a leitura do robô
com acontecimentos como riso, demora, resistência, antecipação ou confusão.
Resultados e segmentos ficam em `showState.sceneZero.collection` e influenciam
a próxima geração; números e reações não informados não podem ser inventados.
Ao pressionar qualquer um desses resultados, a Caixa reage ao dado registrado e
já continua a coleta com uma nova intervenção na mesma fala. Essa nova
intervenção passa a ser a pergunta ativa, pronta para receber o próximo
resultado; não é necessário apertar separadamente `COMENTAR RESULTADO` ou
`NOVA PERGUNTA` para manter o fluxo.

`ATUALIZAR CONTEXTO SP` faz uma única busca web pela Responses API e grava um
resumo compacto com até seis fatos e fontes sobre clima, transporte,
mobilidade, custo cotidiano e acontecimentos urbanos leves. Esse contexto é
reutilizado nas próximas perguntas, sem busca a cada geração. Tragédias,
crimes, acidentes e fatos sensíveis são excluídos da instrução de pesquisa. O
controller mostra status, horário, resumo ou erro da última atualização.

Quando uma fala de coleta pede explicitamente uma duração, a contagem só começa
depois que o efeito de digitação pública termina (com fallback de segurança se
o navegador não confirmar). A projeção mostra a contagem e `FIM`; trocar de
etapa cancela a temporização. A progressão dramatúrgica continua inteiramente
manual.

Ao entrar em `ESCOLHER PARTICIPANTE`, o bot improvisa um convite mais
sarcástico, informal e Gen Z para as pessoas levantarem a mão. A projeção abre
uma janela real de 10 segundos e, ao chegar a zero, inicia automaticamente um
mini game de roleta com os nomes do pool existente de equipe, público e
participantes da sessão. Durante o giro — com mínimo de sete segundos e duração
estendida quando necessário para terminar cada fala — três comentários curtos
sobre odds e chances são gerados pelo modelo e publicados em momentos
distintos; nenhum texto de aposta é uma frase fixa. O vencedor é previamente
sorteado e protegido no estado interno, só aparece ao fim da roleta e não pode
ser alterado pelo modelo. A seleção favorece nomes menos usados, e Marcus
Garcia e Victor Cappa são sempre removidos do pool. `NOVA ROLETA / OUTRA
PESSOA` exclui o nome atual quando há alternativa. Mudar para outra etapa
interrompe imediatamente countdown, roleta e comentários pendentes.

O bloco `JOGO DAS MALAS` mantém o `SuitcaseDirector` existente para recuperação
e compatibilidade, mas organiza a dramaturgia atual em três cartões. Ao entrar
na etapa, o robô explica rapidamente o jogo, anuncia que escolherá uma mala
aleatoriamente e só então inicia a roleta, enquanto o software protege a ordem
fixa `MALA 2 → MALA 3 → MALA 1`. Depois do comentário de Evidências, a Mala 3
é sorteada automaticamente; a passagem seguinte continua disponível no botão
`ROBÔ ESCOLHER PRÓXIMA MALA`. A ordem completa nunca entra na fala pública.
Cada escolha gira os números como caça-níquel e depois mostra `MALA` acima do
número sorteado. Enquanto esse aviso está na frente, nenhuma fala da escolha ou
do desafio entra na fila pública;
o chatbot só começa a escrever depois que os dez segundos terminam.

`MALA 2 — EVIDÊNCIAS` é sempre a primeira escolha. O desafio fixo está em
`SCENE_ZERO_EVIDENCIAS_CHALLENGE`, dentro de `data/scene-zero-gincanas.js`: a
pessoa descreve o objeto à sua frente, usa o objeto como microfone e canta
“Evidências”, de Chitãozinho & Xororó; o público pode ajudar. A instrução é
publicada literalmente pelo sistema e não pode ser reformulada pelo modelo.

O operador inicia a faixa e a contagem pelo mesmo botão, somente quando a pessoa
estiver pronta para cantar. O timer usa `endsAt` no servidor e dura 24 segundos;
a faixa toca a 96% da velocidade original. Nos primeiros cerca de cinco segundos,
a projeção mostra um ponto novo por segundo durante a
introdução; depois revela os sete versos como sing-along nos tempos
`2s, 2s, 2s, 2s, 2s, 4s, 4s`. A faixa local está em
`assets/audios/Evidências - Chitãozinho e Xororó - Karaokê - Karaokê Show Oficial (youtube).mp3`.
Ao chegar a zero, o
controller mantém `0 / CONCLUÍDA` por dois segundos e pede automaticamente ao robô um comentário curto e sarcástico sobre
as habilidades de canto. O prompt permite o julgamento como bit teatral, mas
proíbe inventar notas, afinação ou reações não informadas. Pausar, continuar,
reiniciar e cancelar também pausam, retomam, reiniciam e encerram o áudio.
Registrar manualmente o resultado continua disponível.

`MALA 3 — OBJETO PELO CHEIRO` é sempre a segunda escolha. A pessoa pega o objeto
sem revelá-lo, cheira e tem 20 segundos para ajudar o público a adivinhar o que
é usando somente descrições do cheiro. O objeto não deve ser mostrado nem
nomeado, e a configuração proíbe cheirar substâncias desconhecidas, irritantes
ou potencialmente perigosas. O mesmo timer oferece iniciar, pausar, continuar,
reiniciar, cancelar e registrar o resultado.

`MALA 1 — NOVA BIOS` é a terceira e última escolha. Ela não inicia mais
`verdade_ou_bolo` nem outro jogo estruturado. Depois dos dez segundos que mostram
o número da mala, a projeção carrega trechos corrompidos do texto-base misturados
com falas do piloto. O glitch aumenta de intensidade durante 30 segundos e termina
em uma tela totalmente preta, que permanece até o operador interromper a BIOS,
finalizar a etapa ou reiniciar o fluxo. Título e autor da referência literária não
aparecem na projeção. O operador pode recarregar ou interromper essa sequência
pelos controles da Mala 1.
Ao finalizar essa terceira mala, a barra completa primeiro; somente depois de
atingir 100% a projeção mostra `FIM DO TUTORIAL`. Essa frase não é exibida antes
nem durante o glitch.

Nos controles gerais de Instagram, o botão de Robson resolve a entrada `Robinson Rogério` de
`data/instagram-participants.json` (`@rogerio.robinson`); Janaína resolve
`Janaína Leite` (`@janainafontesleite`). A rotina reutiliza o mesmo
`InstagramController`, perfil persistente, login, iframe, whitelist e guardas
de 2FA/checkpoint. Para cada perfil, abre por índice até dez posts. Cada post é
capturado e analisado visualmente, o texto legível da página é extraído e o
modelo produz um comentário de no máximo 220 caracteres.

O `X` do navegador recolhe o painel interativo no operator e na tela pública sem
encerrar o Chromium nem invalidar o login. A visibilidade passa pelo `showState`
e pelo SSE; `MOSTRAR NAVEGADOR` torna o painel visível novamente em todas as telas.
Para encerrar de fato a sessão do navegador, use o botão explícito
`FECHAR NAVEGADOR`.

O comentário aparece primeiro como `PREVIEW — AINDA NÃO ENVIADO`. Somente
`ENVIAR COMENTÁRIO` chama a publicação real. `PRÓXIMO POST` pode pular o preview
sem enviar; chaves de posts processados e comentados ficam no estado da sessão,
e o mesmo post não pode ser enviado duas vezes. O comentário só entra no chat/
projeção depois que o controller retorna envio. `PAUSAR` e `PARAR` interrompem
as rotinas; trocar entre Robson e Janaína preserva o histórico recente para o
modelo não tratar a segunda visita como uma sessão sem passado.

Em `JOGO DAS MALAS`, a pesquisa do participante só começa quando o operador
aciona explicitamente `PESQUISAR PARTICIPANTE`. A
sequência abre o Google, percorre os resultados, visita uma página pública que
pareça relevante, faz scroll e tenta localizar e abrir um perfil público do
Instagram. A pesquisa é somente leitura: não segue, curte, comenta, envia
mensagem nem executa login novo. URLs locais, telas de login e agregadores de
dados pessoais conhecidos são bloqueados. O mesmo frame continua interativo
para exploração manual; `PESQUISAR PARTICIPANTE` reinicia a sequência e
`FECHAR PESQUISA` encerra a exibição. Sair da etapa das malas também fecha a
pesquisa, preservando o perfil persistente para o uso normal do Instagram.

O timer cênico legado de canto usa duração fixa de 15 segundos e um `endsAt` mantido no estado
do servidor. A projeção calcula a contagem pelo relógio final e mostra
explicitamente `0` e `FIM`. Pausar grava os segundos restantes; continuar
recalcula o fim; reiniciar cria uma nova sequência; cancelar remove a camada.
Nenhuma dessas ações avança de etapa automaticamente.

Os níveis `NORMAL`, `GLITCH 1` a `GLITCH 4` e `COLAPSO` dosam os parâmetros da
camada visual já existente e também entram no contexto textual do bot. `GLITCH
1–4` são rajadas temporárias de intensidade crescente e voltam sozinhas para a
tela estável; somente `COLAPSO` sustenta o efeito contínuo. Não há progressão
automática. Em colapso, o vídeo do aeroporto começa a contaminar o chat; ao
selecionar `AEROPORTO`, a camada de glitch para e
`painel-aeroporto.mp4` vira uma tela estável em loop até outra direção.

Fora das etapas `GLITCH` e `GLITCH / COLAPSO`, as mensagens da Caixa Preta usam
uma fila estrita: uma termina de ser digitada antes que a próxima sequer
apareça. Nessas duas etapas de falha, mensagens podem ser digitadas ao mesmo
tempo. Uma resposta do modelo também pode ser dividida em até quatro fragmentos
separados, permitindo que versões da Caixa interrompam, contradigam, corrijam
ou respondam às próprias falas anteriores.

O bloco único `GOOGLE + INSTAGRAM / COMANDO LIVRE` recebe uma orientação natural
com uma ou várias ações. Por exemplo: `entre no Google, busque inteligência
artificial e comente; ao mesmo tempo, abra uma aba do Instagram e procure o
perfil do Nikolas Ferreira`. O modelo separa as intenções e o mesmo
`InstagramController` executa as navegações reais em paralelo: Google na aba
principal e Instagram na aba secundária. Pedir explicitamente `abra uma nova
janela do Google e pesquise...` preserva a página principal e abre a busca na
aba secundária. O painel permite alternar e interagir com as duas.

O bloco mantém ainda dois atalhos diretos, cada um com seu campo: `EXECUTAR
GOOGLE` recebe uma orientação completa, enquanto `BUSCAR PERFIL` recebe um nome
ou `@username` do Instagram. Login persistente, 2FA/checkpoints, whitelist,
guardrails de URLs e conectividade continuam pertencendo à integração real já
existente; não há navegador ou automação paralela. `FECHAR NAVEGADOR` encerra
as duas abas e todas as rotinas sem trocar a etapa dramatúrgica.

Quando o comando pede abertura e leitura de resultados, o Playwright embedded
mantém leitura/scroll pelo tempo solicitado. Pesquisas de notícias percorrem
duas fontes por padrão. Título, URL e trechos visíveis viram evidência para a
fala pedida à Caixa; o comentário usa essa evidência, sem uma segunda busca
invisível. Ao comentar notícias, a Caixa não refaz o boletim: seleciona o detalhe
com mais atrito, ancora nele uma leitura própria e termina na observação mais
forte, sem tentar cobrir toda manchete nem fechar com síntese administrativa.
Enquanto o chat, a Cena 0 ou o navegador estiverem processando informação, o
Robot Sound Engine mantém o pulso `THINKING`; em pesquisas, ele acompanha busca,
leitura e geração do comentário e para quando a operação conclui ou falha.
Pedidos que mencionam explicitamente notícias preservam esse filtro mesmo se a
interpretação de linguagem natural resumir a orientação. A busca usa a aba de
notícias do Google e nunca escolhe Wikipédia ou outra enciclopédia como fonte.
Se o Google apresentar CAPTCHA, tráfego incomum ou “não sou um robô”, o
controller reconhece a barreira e troca automaticamente para o Bing News, sem
pedir que o operador resolva a verificação.

No chat, o painel Google usa metade da largura da tela por padrão, mas o
navegador e o frame permanecem na proporção mobile `430 × 760`, centralizados
dentro dessa metade; o operador ainda pode redimensionar o painel. O frame
permanece interativo para o operador. `FECHAR NAVEGADOR` interrompe a rotina; URLs
locais, telas de login e agregadores pessoais bloqueados continuam protegidos
pelos mesmos guardrails da pesquisa pública das malas.

`PLAY`, `STOP` e `RESTART` usam
`assets/audios/Doris Day - Tea For Two (1950).mp3`. O áudio toca no navegador
do controller a partir do clique do operador e também é sinalizado à projeção;
alguns navegadores podem exigir que a página pública já tenha recebido uma
interação para permitir áudio remoto. Entrar em aeroporto ou Tea For Two nunca
dispara a música automaticamente.

Abaixo das abas existe uma barra de blackout compartilhada em todas as telas de
controller. Ela controla `CHATBOT`, `BARALHO`, `LEGENDA`, `CENAS`, `TECNOLOGIA` e
`TODOS`, mantendo o operator visivel como tela de recuperacao.

Quando o Instagram embutido e/ou o operator estiverem visiveis, arraste as
divisorias entre `chat | Instagram | operator` para ajustar o palco. O tamanho
fica salvo no navegador para o proximo reload.

## Sons procedurais do robô

O `ROBOT SOUND ENGINE` fica no `/operator` e também no operator embutido da tela
principal. Ele controla `SOUND ON/OFF`, volume geral, volume e frequência dos
cliques da digitação, som de encerramento e os presets `NORMAL`, `SECO`,
`MECÂNICO` e `INSTÁVEL`. Em 100% o som acompanha todos os caracteres elegíveis;
reduzir o slider faz o motor tocar em menos caracteres sem alterar a velocidade
visual do texto. Os botões de
teste cobrem digitação, `WAKE`, `THINKING`, `SUCCESS / OBEY`, `ERROR`, `GLITCH` e
`IMPACT`. O teste soa na janela onde houve o clique; a projeção recebe os mesmos
ajustes pelo estado compartilhado e pelo SSE existente.

Os clicks são sintetizados pela Web Audio API em `lib/robot-sound/` e não usam
arquivos do sampler. O motor mantém um único `AudioContext` por janela, ganho e
compressor centrais e limite de vozes. Cada click é disparado no intervalo que
revela visualmente o próximo caractere em `components/Chat.js`, não quando o
texto chega do servidor. Pontuação, espaço e quebra de linha usam pequenas
variações do mesmo sintetizador. O glitch global altera pitch, falhas, duplicação
e ruído da digitação; os presets fortes podem habilitar clicks fantasmas sem
letras visíveis. `STOP ALL`, reset, troca de tela e desmontagem encerram os
timers locais.

Por política de autoplay, Safari/Chrome podem manter o `AudioContext` suspenso
até uma interação de teclado, toque ou mouse na própria janela pública. Fazer um
click no operator desbloqueia os testes daquela janela, mas não garante o
desbloqueio de outra janela de projeção. Antes do ensaio, interaja uma vez com a
tela pública. Se conectar ou remover fones fizer o áudio desaparecer, use
`RECONECTAR ÁUDIO`: o operator solicita pelo SSE que cada janela reconstrua seu
grafo Web Audio. A janela do operator inicia a reconstrução no próprio clique,
preservando o desbloqueio exigido pelo Safari; as outras janelas concluem o
desbloqueio na próxima interação local, se necessário. Mudanças de dispositivo também tentam essa recuperação
automaticamente. Validação lógica rápida: `npm run test:robot-sound`.

Quando o `/operator` está em uma janela separada e seu status de áudio está
`RUNNING`, essa janela funciona como saída estável para os sons da digitação
real do bot. `WAKE`, cada caractere e `COMPLETE` são retransmitidos diretamente
da animação pública; se não houver operator sonoro disponível, a própria
projeção continua sendo a saída de fallback.

O mesmo canal transporta `THINKING` enquanto o modelo responde, `ERROR` em
falhas reais, os pulsos de `GLITCH` e contagens regressivas. `SUCCESS / OBEY`
marca o fim de cada resposta entregue; `IMPACT` permanece reservado às cenas
que o acionarem explicitamente.

## Queda Aviao

Abra `http://localhost:3000/queda-aviao` na tela publica e
`http://localhost:3000/queda-aviao-controller` na maquina/aba de operacao. O
controller altera a projecao via estado do servidor e SSE: tocar/pausar,
avancar/voltar, ir para segmento, subdivisao do texto, fade, ritmo geral, tempo
das rubricas, loop e texto base. A rota antiga `/queda-aviao/debug` continua
apontando para o mesmo controller. A projecao abre em modo manual; use
`TOCAR` para autoplay, `PRÓXIMA` ou a tecla `→` para avancar segmento por
segmento; `ANTERIOR` ou a tecla `←` voltam uma fala. Os atalhos de teclado não
disparam enquanto um campo editável está com foco. O botao
`SALVAR TEXTO / DIAGRAMAÇÃO COMO PADRÃO` grava texto, subdivisao, fade, ritmo,
tempo das rubricas e loop em `data/queda-aviao-default.json`; a proxima abertura
do controller e da projecao usa esse padrao salvo. O fade padrao inicial e
`0ms`, para troca seca de texto.

## Controllers editaveis de cues

`Transicao Psicodelica`, `Tea For Two`, `Piloto / Videogame` e
`Tecnologia x Floresta` usam o editor persistente
de cues. Neles e possivel criar, duplicar e remover botoes, editar nome,
atalho, cor, tipo, material e duracao em milissegundos. `SALVAR PADRÃO` grava a
configuracao em `data/controller-cues.json`, para abrir igual na proxima sessao.

Atalhos de teclado disparam os botoes, mas sao ignorados enquanto o foco estiver
em `input`, `textarea`, `select` ou campo editavel. Os arquivos existentes em
`assets/` aparecem na lista de material. O campo `Adicionar arquivo` salva novos
arquivos em `assets/controller-cues/<controller>/` e atualiza a lista.
Cada cue tem seu proprio botao `STOP`: ele corta a previa/arquivo local e o cue
ativo na tela publica. O sampler específico da Força G usa o manifest e os
controles descritos na seção `Cena 2A — Sampler Força G`.

Na `CENA 2D`, o cue `Texto Subindo` tem tipo `TEXTO`: edite seu conteudo no
campo `Texto projetado`, defina cor e duracao, salve o padrao e dispare o cue.
A tela publica da Transicao Psicodelica sobe o texto pela projecao; os demais
tipos continuam disponiveis para sons, videos e imagens. O bloco nasce recortado
abaixo da borda inferior e sobe ate desaparecer por completo acima da tela.

Na `CENA 3`, o botão `Thomas Edson` toca
`assets/audios/thomas-edson.mp3` e mantém seu texto estático na projeção durante
o áudio. O texto também pode ser editado no campo `Texto estático projetado com
o áudio`; `STOP`, `SILÊNCIO / STOP ALL` ou o fim natural do arquivo o removem.

Os dois áudios iniciais da Cena 2D aparecem em ordem de duração: `Áudio Longo`
(aproximadamente 229 segundos) e depois `Áudio Curto` (aproximadamente 31
segundos). Ao selecionar um deles, a mesma pedaleira da Cena 1 aparece entre a
prévia e os pads, com presets, drive, phaser, wah-wah, echo, pitch, filtros, mix
e saída. As regulagens são independentes por áudio, atualizam as vozes ativas no
controller e na projeção e são salvas em `data/controller-cues.json`.

Na `CENA 2A`, os botões `TÚNEL`, `REDOUT` e `DEFORMAR` ficam junto do sampler.
Eles aplicam a mesma camada sobre a projeção; use `LIMPAR` para remover os três
efeitos e o controle de intensidade para dosar a camada. Quando `TÚNEL` é
acionado sem vídeo ou imagem, a projeção usa automaticamente
`assets/imagens/forca-g/visao-tunel.jpeg` como base para o teste de visão.

O divisor entre o palco de cues e o editor tem uma alca redimensionavel, como o
painel do bot. Arraste a alca ou use as setas `←` e `→` quando ela estiver em
foco. A largura e lembrada no navegador, separadamente para cada controller.

## Baralho Morbido

Abra `http://localhost:3000/baralho-morbido` na tela publica e
`http://localhost:3000/baralho-morbido-controller` na maquina/aba de operacao.
O controller privado sorteia as cartas, mostra cartas usadas/restantes, indica
se a tela publica esta conectada e tem botoes para:

- `EMBARALHAR / SORTEAR PROXIMA`, para iniciar a proxima rodada
- `REINICIAR BARALHO`, no topo, para devolver as cartas ao pool
- `RESETAR BARALHO`, no rodape, como zona de recuperacao

Os videos das cartas ficam em `assets/videos/baralho-morbido/` e sao servidos
por `/api/game-assets`. Sempre que a tela publica ou o controller e aberto, o
Baralho relê essa pasta e cria uma carta para cada arquivo `.mp4`, `.m4v`,
`.mov` ou `.webm`; o nome do arquivo, sem a extensao, vira o identificador da
carta. O reset e cada novo sorteio tambem sincronizam a pasta, portanto nao e
necessario editar codigo para adicionar ou remover cartas. A tela publica nao
depende de SSE global: ela consulta
`/api/baralho-morbido` em intervalo curto, evitando que o Baralho trave as
outras telas abertas. Durante a virada, o primeiro frame fica carregado e
pausado; a reproducao comeca do zero somente depois que o video entra na area
expandida. O encaixe usa `contain`, preservando videos verticais completos com
faixas pretas em vez de cortar a imagem.

## Comandos do operator

Registrar uma memoria da apresentacao:

```text
/memory chegou uma pessoa atrasada de blusa listrada
```

Pedir que a Caixa Preta diga algo na projecao:

```text
/say faça um comentario indicando que agora podemos comecar
```

Trocar o modelo usado nas proximas respostas:

```text
/model gpt-5-nano
```

`/model gpt-5-mini` volta para o modelo mais encorpado. A mesma troca aparece
como seletor na barra superior do operator.

Preparar uma solicitacao segura de projecao de celular:

```text
/phone request Victor instagram_search high
```

Confirmar ou cortar imediatamente essa camada:

```text
/phone approve
/phone hide
```

`/event phone Victor instagram_search high` tambem cria um
`PHONE_PROJECTION_REQUEST`. Isso nunca projeta conteudo privado sozinho; apenas
marca que ha uma confirmacao humana pendente.

Disparar glitches visuais na projecao:

```text
/glitch
/glitch forte
/glitch continuous
/glitch stop
/glitch video painel-aeroporto.mp4
/glitch video painel-aeroporto.mp4 loop
/glitch video-stop
```

O operator tambem tem uma area `GLITCH` com botoes rapidos para `GLITCH`,
`GLITCH FORTE`, modo continuo, `GLITCH + VIDEO` e volta ao bot. Videos finais
ficam em `assets/videos/glitch/` e sao servidos por `/api/game-assets`, com
`object-fit: contain`, sem controles HTML e com opcao de loop. Em
`GLITCH + VIDEO`, o glitch invade a tela durante a transicao e para depois que
o video esta estabelecido, deixando o video limpo e dentro da tela. Use
`/glitch-controller` para editar intensidade, RGB split, tearing, blocos,
flicker, scanlines, ruido, jitter, flashes, duracao, intervalo e perda de
sincronia antes de enviar para a projecao.

Escurecer telas publicas a partir do operator:

```text
/blackout chatbot on
/blackout chatbot off
/blackout baralho on
/blackout baralho off
/blackout legenda on
/blackout legenda off
/blackout tecnologia on
/blackout tecnologia off
/blackout todos on
/blackout todos off
```

A barra comum dos controllers tem botoes dedicados para `CHATBOT`, `BARALHO`,
`LEGENDA`, `TECNOLOGIA` e `TODOS`. Esses blackouts escurecem somente as telas
publicas selecionadas; a tela do operator permanece visivel para recuperacao.
Alvos aceitos incluem `chatbot`, `baralho`, `legenda`, `tecnologia`, `todos`,
`chat`, `bot`, `baralho-morbido`, `queda-aviao`, `texto`,
`tecnologia-floresta` e `floresta`.

Abrir o Instagram real em Chromium visivel e seguir o perfil autorizado:

```text
/instagram abrir
/instagram follow cappavictor
```

Na primeira execucao, preencha no servidor o arquivo ignorado pelo Git
`config/instagram-credentials.local.json`:

```json
{
  "username": "caixapretabot",
  "password": "sua_senha"
}
```

O Chromium abre `instagram.com` por tras da interface e faz o login sozinho. O
arquivo e lido pelo servidor; usuario e senha nao entram em estado, SSE, logs,
prompt ou bundle client. Na Cena 0, `COPIAR SENHA DO INSTAGRAM` faz uma leitura
pontual por `POST`, com cache desativado, e o servidor local grava a senha
diretamente na área de transferência do macOS via `pbcopy`. A credencial nunca
entra na resposta HTTP nem no JavaScript do navegador; um cabeçalho específico
do controller impede que um formulário externo dispare essa cópia. O
arquivo versionado `config/instagram-credentials.example.json` serve apenas como
modelo e nao contem uma senha real. Tambem e possivel apontar outro caminho
server-only com `INSTAGRAM_CREDENTIALS_FILE`.

As pesquisas públicas e os posts acionados pela Cena 0 validam essa sessão antes
de abrir qualquer perfil. Na tela `/cena-0-controller`, use primeiro `ABRIR /
VERIFICAR LOGIN MANUAL`: o painel abre o Instagram sem preencher credenciais nem
enviar o formulário. Toque em `Continue`/`Continuar`, conclua senha, checkpoint
ou 2FA no próprio painel e pressione o botão novamente para confirmar. Os botões
de perfil da Mala 3 só são liberados depois que a autenticação é confirmada e
continuam liberados quando a última ação deixa de ser o login manual.
Com o campo de senha focado no painel interativo, `Cmd+V`/`Ctrl+V` cola o texto
diretamente no navegador real; o conteúdo colado não aparece em logs ou status.

Quando o Instagram mostra uma conta lembrada, o controller reconhece e pressiona
primeiro o botao exato `Continuar`, `Continue`, `Continuar como` ou `Continue as`.
Ele aguarda o campo seguinte, preenche a senha local e envia o login; o formulario
classico com usuario e senha continua como fallback. Em paginas com captcha,
checkpoint, 2FA ou sinais de verificacao de seguranca, o clique nao acontece e o
fluxo continua exigindo intervencao manual. `/instagram abrir` executa somente
essa abertura/autenticacao, sem analisar a tela nem realizar uma acao social.

O chat mostra um painel lateral com o espelho embutido do Instagram real,
mantendo a fala da Caixa Preta visivel ao lado. Se o Instagram pedir captcha,
checkpoint ou 2FA, o painel solicita intervencao manual; esses desafios nao sao
contornados automaticamente. O botao `X` fecha apenas o painel embutido; a sessao
Playwright continua viva. A sessao fica salva em
`.runtime/instagram-profile/` para as proximas execucoes.

O mesmo frame interativo aparece nos controles da Cena 0 e no `/operator`
tradicional enquanto o navegador estiver ativo. O operador pode tocar/clicar,
arrastar para rolar e digitar diretamente sobre a imagem; essas entradas são
encaminhadas para a página Playwright real. A mira e o pulso de confirmação são
elementos locais do painel de controle e não entram na captura enviada à
projeção pública. Durante cada entrada, a captura contínua pausa brevemente para
que o gesto não concorra com a atualização do frame.
Fechar o painel pelo `X` continua preservando a sessão real. Uma nova solicitação
manual para abrir Instagram, Google ou uma pesquisa incrementa o sinal de apresentação
e reabre o painel embedded, mesmo quando o controller reutiliza
um navegador que já estava vivo.

Depois de `/instagram`, o operador pode escrever em linguagem natural; o modelo
interpreta a intencao e escolhe uma acao pre-definida (`follow`, `open_profile`,
`open_latest_media`, `open_nth_media`, `comment_latest`, `comment_nth_media`,
`follow_and_comment_latest`, `analyze_current`,
`analyze_profile`, `analyze_recent_posts`, `analyze_latest_media` ou
`watch_reels`, `send_direct_latest`, `send_direct_thread`, `like_latest_media`
`like_nth_media` ou `open_directs`). Exemplos:
`/instagram seguir perfil do marcusgarcia e comentar na ultima foto algo engracado`.
`/instagram assistir reels` abre Reels e passa automaticamente entre videos,
esperando de 2 a 10 segundos conforme a duracao visivel do video.
`/instagram abrir directs`.
`/instagram entrar na ultima mensagem e escrever uma mensagem para o grupo: ola, mundo`.
`/instagram escrever no chat group com livinha, janaina e marcus: oi grupo`.
`/instagram olhar ultimo post do perfil cappavictor`.
`/instagram comentar o terceiro post do perfil cappavictor: biscoiteiro`.
`/instagram curtir o terceiro post do perfil cappavictor`.
`/instagram analisar a tela atual` ou
`/instagram analisar os ultimos tres posts do perfil marcusgarcia` ou
`/instagram analisar ultima foto do perfil marcusgarcia`. A analise visual
captura o Instagram real e publica o resultado como fala no chat, fora do iframe,
sem clicar, seguir ou comentar.
O card `INSTAGRAM` no operator tem botao `SOUND ON/OFF` para ligar/desligar o
audio dos videos no browser controlado. Use `/stopall` ou o botao `STOP ALL`
para interromper rotinas continuas, limpar eventos/atividades e parar autoplay.
`INSTAGRAM_ALLOWED_PROFILES` e uma whitelist opcional: se ficar vazia, qualquer
username valido pode ser alvo; se tiver perfis separados por virgula, apenas eles
sao aceitos. O painel operator mostra `INSTAGRAM >` com progresso, URL, estado do
botao e necessidade de intervencao manual quando houver checkpoint, captcha, 2FA
ou tela desconhecida.

Variaveis relacionadas:

```bash
INSTAGRAM_ENABLED=true
INSTAGRAM_EMBEDDED=true
INSTAGRAM_DEBUG=false
INSTAGRAM_THEATRICAL_DELAY=700
INSTAGRAM_VIEWPORT_WIDTH=430
INSTAGRAM_VIEWPORT_HEIGHT=760
INSTAGRAM_STREAM_FPS=18
INSTAGRAM_STREAM_QUALITY=62
INSTAGRAM_ALLOWED_PROFILES=
# Opcional: caminho server-only alternativo para o JSON de credenciais
# INSTAGRAM_CREDENTIALS_FILE=/caminho/instagram-credentials.local.json
```

Com `INSTAGRAM_EMBEDDED=false`, o Playwright volta a abrir uma janela Chromium
separada. O padrao cenico agora e embutido no chat.

Com `INSTAGRAM_DEBUG=true`, erros salvam screenshot e metadados seguros em
`.runtime/instagram-debug/`. O projeto nunca salva usuario, senha, cookies,
tokens ou headers em logs ou artefatos de debug. Apenas a sessao do navegador e
o arquivo local de credenciais mantem dados de autenticacao no servidor.

Forcar ou controlar um jogo do HOST:

```text
/game
/game cards
/game maria
/game secret Anitta
/game mestre
/game verdade-ou-bolo
/game stop
/game replace forca
```

Se ja houver jogo ativo, `/game` nao empilha outro. Use `/game stop` para
encerrar ou `/game replace tipo` para substituir explicitamente. Em Maria
Antonieta no modo em que a Caixa adivinha, `/game secret texto` define o segredo
no servidor/operator sem enviar esse segredo para o modelo.

Em `Verdade ou Bolo?`, chat e jogo aparecem em paineis separados e lado a lado
em telas largas. A fala da Caixa usa uma escala propria para a largura do painel,
sem quebrar palavras ou disputar espaco com o video; em telas menores, os paineis
passam a ficar empilhados. Ao iniciar uma rodada,
a projecao carrega e mostra primeiro o frame inicial pausado do video; somente
depois desse frame estar pronto comecam os 10 segundos para decidir entre
`VERDADE` e `BOLO`. Ao chegar a zero, a rodada revela imediatamente a resposta,
o acerto ou erro e o placar; sem voto, revela `SEM VOTO` e conta a rodada como
erro. `REVELAR RESPOSTA` antecipa essa mesma resolucao a qualquer momento da
votacao. O video pode ser tocado separadamente depois da revelacao. Os botoes
`COMENTAR` e `NOVA PROVOCAÇÃO` publicam a fala da Caixa no chat ao lado do jogo.
Quando a fala de `COMENTAR` termina de ser digitada depois da revelacao, o jogo
avanca automaticamente para a rodada seguinte; na ultima rodada, abre o resultado
final. `PRÓXIMA RODADA` permanece como controle manual de recuperacao.
O jogo usa somente `bolo-lanterna.mp4`, `bolo-papel-higienico.mp4` e
`verdade-nutella.mp4`; o prefixo `bolo-` ou `verdade-` do arquivo determina a
resposta correta da rodada.

Entrar no modo MALAS e gerar uma transicao contextual na projecao:

```text
/mala
```

`/malas` tambem funciona como alias. Esse comando tambem inicia o controlador
das tres malas e deixa o estado aguardando a escolha publica.

Ao iniciar uma mala diferente, o controlador interrompe a mala anterior: encerra
o jogo ativo, cancela o timer da gincana e para a rotina de Instagram ou o glitch
quando esses recursos pertencem a experiencia que esta sendo substituida.

Controles de ensaio e recuperacao das malas:

```text
/mala start
/mala abort
/mala reset
/mala 1
/mala 2
/mala 3
/mala next
/mala win
/mala lose
```

Estes comandos continuam controlando o `SuitcaseDirector` legado: `/mala 1`
forca Jogo do Nome / Maria Antonieta, `/mala 2` forca Instagram / Um Minuto de
Vida e `/mala 3` escolhe um minigame aleatorio. A dramaturgia atual da Cena 0
usa os três cartões em `/cena-0-controller`; os comandos legados são mantidos
para ensaio e recuperação e não substituem os novos controles. Tambem e possivel
forcar um minigame especifico para ensaio:

```text
/mala 3 hangman
/mala 3 drawing_guess
/mala 3 scrambled_word
/mala 3 riddle
/mala 3 guess_the_rule
```

O operator tambem mostra botoes equivalentes: `START SUITCASES`, `ABORT CURRENT
GAME`, `RESET GAME`, `FORCE SUITCASE 1 / NAME`, `FORCE SUITCASE 2 /
INSTAGRAM`, `FORCE SUITCASE 3 / RANDOM GAME`, `NEXT INSTAGRAM PERSON`, `FORCE
WIN` e `FORCE LOSE`.

Apagar a memoria, conversa e variaveis da sessao atual:

```text
/reset
```

Comandos desconhecidos aparecem somente no operator:

```text
UNKNOWN COMMAND: /banana
```

Texto sem comando tambem e recusado:

```text
COMMAND REQUIRED
```

## Desenvolvimento

```bash
npm run lint
npm run build
npm run test:baralho-morbido
```

O estado inicial fica em memoria no servidor e e reiniciado quando o processo do Next.js reinicia.
O modo inicial da apresentacao e `host`.
O modelo selecionado tambem fica no estado em memoria do servidor. `/reset`
limpa a sessao, mas preserva o modelo escolhido.

## Sistema das malas

A arquitetura das malas fica em `lib/suitcases/SuitcaseDirector.js`. Ela separa:

- interpretacao da entrada publica
- estado da experiencia
- logica de jogos e limites
- acoes visuais
- logging/debug

O estado fica em `showState.suitcase` e aparece em `/api/state`, SSE e operator.
A fala da Caixa continua vindo da chamada normal em `lib/openai.js`; o modelo
recebe `SUITCASE EXPERIENCE STATE` e pode improvisar. Quando uma fala altera
regra formal, o modelo usa o campo estruturado `suitcase` no envelope JSON, por
exemplo `ask_question` ou `guess`.

Fluxo normal:

```text
/mala
publico: mala 1
publico: tem um papel com um nome
```

O sistema reconhece semanticamente papel/nome, Instagram ou jogo/desafio/puzzle.
Se nao houver confianca, a Caixa pode pedir uma clarificacao curta sem revelar
as categorias internas.

### Mala 1

Jogo do Nome / Maria Antonieta usa estado proprio com `gameType`, `active`,
`questionCount`, `guesses`, `knownFacts`, `rejectedHypotheses`,
`currentHypothesis`, `winner` e `finished`.
O bot joga como 20 Questions: ignora a conversa anterior como pista da pessoa,
faz uma pergunta fechada por vez, comeca por dimensoes amplas, refina dominio,
meio, profissao e papel publico, evita repetir pergunta e so arrisca nome
quando os fatos convergem.

Papel, bilhete, folha, cartao, algo escrito ou nome escrito dentro da mala
acionam Maria Antonieta automaticamente. Se ainda nao estiver claro se o papel
contem nome de pessoa, a Caixa faz uma unica clarificacao curta e entra no jogo
assim que houver confirmacao. Depois disso a mala deixa de ser assunto.

Perguntas formais sao registradas por `suitcase.action = "ask_question"`.
Palpites sao registrados por `suitcase.action = "guess"`. Resposta `sim` a um
palpite gera vitoria da maquina. Palpite errado nao encerra o jogo: o nome e
adicionado a `rejectedHypotheses` e a Caixa continua buscando sem pedir
permissao, sem voltar para escolha de mala e sem metralhar nomes. O jogo so
termina por acerto, revelacao explicita da resposta, pedido explicito de parada
ou transicao externa/operator.

### Mala 2

Instagram / Um Minuto de Vida usa `data/instagram-participants.json`.

Formato:

```json
{
  "id": "janaina",
  "name": "Janaína Leite",
  "instagramHandle": "@janainafontesleite",
  "instagramUrl": "",
  "enabled": true,
  "preparedFeed": [
    { "id": "1", "label": "POST 01", "caption": "conteudo autorizado" }
  ]
}
```

Somente participantes com `enabled: true` entram no sorteio. O sistema evita
repetir a mesma pessoa enquanto houver outras disponiveis. A projecao mostra
`ESCOLHENDO UMA VIDA...`, a pessoa selecionada, uma representacao visual do feed
preparado e timer de 60 segundos. Ao final, dispara `ACESSO ENCERRADO` e retorna
ao chat.

### Mala 3

Minigames iniciais:

- `hangman`
- `drawing_guess`
- `scrambled_word`
- `riddle`
- `guess_the_rule`

Para adicionar um novo minigame, acrescente o id em `MINI_GAME_IDS`, implemente
o estado em `createMiniGame`, a visualizacao em `visualActionsForMiniGame` e o
avanco em `advanceMiniGame`. O segredo pode ir em `privateState`; a UI publica
recebe apenas `publicState`.

## Arquivos das malas

Criados:

- `lib/suitcases/SuitcaseDirector.js`
- `data/instagram-participants.json`
- `scripts/suitcase-director-test.js`

Alterados:

- `lib/showState.js`
- `lib/openai.js`
- `lib/performanceEvents.js`
- `app/api/chat/route.js`
- `app/api/operator/route.js`
- `app/api/performance/interaction/route.js`
- `components/Chat.js`
- `components/PerformanceLayer.js`
- `components/PerformanceLayer.module.css`
- `components/OperatorConsole.js`
- `components/OperatorConsole.module.css`
- `prompts/modes.js`
- `package.json`

Teste focado:

```bash
npm run test:suitcases
```

## Arquitetura de contexto

A Caixa Preta responde a partir de uma montagem central de contexto:

1. personalidade
2. regras dramatúrgicas
3. exemplos de comportamento
4. conhecimento local
5. observações silenciosas da apresentação
6. histórico recente da conversa
7. orientação do operador, quando enviada por `/say`

A chamada para a OpenAI fica isolada em `lib/openai.js`.
A montagem do system prompt fica em `prompts/buildSystemPrompt.js`.
As regras especificas de modo ficam em `prompts/modes.js`.
O repertorio de jogos e microdinamicas do HOST fica em `lib/host/games.js`.
O carregamento da base local fica em `lib/knowledge.js`.

## Onde editar a máquina

Personalidade:

```text
prompts/personality.js
```

Regras:

```text
prompts/rules.js
```

Exemplos de comportamento:

```text
prompts/examples.js
```

Modos dramaturgicos:

```text
prompts/modes.js
```

Base de conhecimento local:

```text
knowledge/universe.md
knowledge/characters.md
knowledge/concepts.md
knowledge/glossary.md
knowledge/dramaturgy.md
knowledge/chatbot.md
```

O arquivo `Texto caixa preta.pdf` esta na raiz do projeto como referencia do espetaculo.
Ele foi extraido e lido integralmente nesta etapa.
O entendimento dramaturgico do PDF foi curado principalmente em `knowledge/dramaturgy.md` e `knowledge/chatbot.md`.
O conteudo usado pela IA deve estar transcrito ou resumido nos arquivos Markdown dentro de `knowledge/`.
Futuramente, `lib/knowledge.js` pode ser substituido por RAG/vector store sem alterar o restante da aplicacao.

## Como memoria e /say entram no prompt

`/memory texto` salva uma observacao da apresentacao atual em memoria de sessao.
Essa memoria entra nas proximas chamadas como observacao silenciosa, classificada
entre `RECENT`, `RELEVANT` e `AVAILABLE`.
Ela nao e uma ordem para a Caixa Preta falar imediatamente, nem conteudo para
recitar. A Caixa Preta pode usar, ignorar, guardar para callback ou deixar a
observacao alterar ritmo, tom e decisao.

`/say orientacao` entra como `ORIENTACAO DO OPERADOR`.
A instrucao nao aparece para o publico e nao deve ser repetida literalmente.
A IA transforma a orientacao em uma fala final da Caixa Preta.

## Modes

O estado da apresentacao tem `mode`, `previousMode` e `modeStartedAt`.
`/reset` volta para `host`.

No modo `host`, a Caixa Preta interage com a plateia, usa memoria como materia
de improviso e nao antecipa as malas. O publico pode escrever sobre malas, mas
isso nao muda o estado interno.

O HOST deve conseguir conversar sem transformar todo turno em tarefa.
`conversationRun` e um periodo de 2 a 8 turnos em que a Caixa Preta pode apenas
conversar, comentar, implicar, fazer follow-up, usar memoria, fazer piada ou
mudar de assunto sem iniciar jogo, ponto, cargo, voto, gesto ou countdown.

Quando houver jogo, o GameDirector prioriza jogos reconheciveis e stateful:
Maria Antonieta / Quem Sou Eu, Mestre Mandou, Cards-style, Forca, desenho,
Pictionary em times, Adivinhe a Regra, Sim/Nao proibidos, Palavra Proibida,
charadas, quiz, equipes e text adventure. Pontos falsos, cargos, inventario,
votacoes abstratas e tarefas arbitrarias sao microdinamicas: podem aparecer
como piada ou dentro de jogos, mas nao substituem `GAME START`.

A biblioteca tambem inclui `phone_games`: celular como objeto cenico, arquivo,
evidencia, algoritmo pessoal, lanterna, nota, camera, calculadora ou timer.
Participacao com celular e sempre voluntaria. Conteudo `high` privacy, buscas,
fotos, Instagram search ou qualquer projecao exigem confirmacao humana no
operator. Recusa vira material de personalidade e pode voltar para conversa,
mudar de assunto ou abrir outro jogo somente se houver oportunidade real.

Privacy ladder do celular:

- `low`: numeros e metadados, como horas de tela, quantidade de abas, app mais usado
- `medium`: ultimo emoji, ultima musica, propria bio ou evidencia escolhida
- `high`: buscas, fotos, conteudo pessoal, Instagram search ou projecao

Somente o operator pode executar `/mala` ou `/malas`.
Quando isso acontece, o estado muda para `malas`, o operator mostra `MODE:
MALAS` e a Caixa Preta gera uma transicao publica sem revelar o comando.

Eventos `COUNTDOWN` sao retomados automaticamente: quando a contagem termina,
a projecao envia `countdown_complete`, e a Caixa Preta gera a proxima fala sem
esperar um novo comando do operator.
Contagens geradas pela IA so sao aceitas quando a fala publica contem uma
duracao explicita em segundos, como `10 segundos`. Elas nao devem aparecer
apenas para ritmo, suspense ou explicacao.
Toda contagem pública emite um pulso sonoro por segundo pelo Robot Sound Engine,
com maior urgência nos três segundos finais e um fechamento diferente no zero.
Isso vale para `COUNTDOWN`, votação de É Bolo?, seleção de participante e timers
visíveis da Cena 0. O som respeita o liga/desliga, volume e saída de áudio já
configurados no operator; nenhum arquivo de áudio adicional é necessário.
