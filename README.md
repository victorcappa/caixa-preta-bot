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
- `http://localhost:3000/forca-g-samples`, tela publica de samples audiovisuais da Forca G
- `http://localhost:3000/forca-g-samples-controller`, controller de samples audiovisuais
- `http://localhost:3000/forca-g-shaders`, tela publica de videos e shaders da Forca G
- `http://localhost:3000/forca-g-shaders-controller`, controller editavel de videos e shaders
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

Telas publicas controlaveis:

- `Chatbot`: `/`
- `Baralho Morbido`: `/baralho-morbido`
- `Queda Aviao`: `/queda-aviao`
- `Forca G Samples`: `/forca-g-samples`
- `Forca G Shaders`: `/forca-g-shaders`
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

As telas privadas de operacao tem um menu comum no topo, configurado em
`lib/controllerSurfaces.js`. O `/operator` funciona como hub e organiza os
controllers em colunas por cena: uma cena com apenas um controller aparece uma
vez; as quatro partes da Cena 2 ficam empilhadas na mesma coluna. Cada rota
carrega apenas o controller ativo, sem misturar todos os controles em uma tela
unica. As abas mostram `CENA 2A`, `CENA 2B` e assim por diante antes do nome.

Grupos atuais:

- `CENA 0`: `Bot / Malas`, rota `/cena-0-controller`
- `CENA 1`: `Queda / Emergencia`, rota `/queda-aviao-controller`
- `CENA 2`: `Forca G — Samples`, `Forca G — Shaders`, `Baralho Morbido`,
  `Transicao Psicodelica`
- `CENA 3`: `Tea For Two`
- `CENA 4`: `Piloto / Videogame`
- `CAMADAS`: `Tecnologia x Floresta`
- `OUTROS`: `Operator` (console técnico neutro), `Glitch Geral` e `Treino`

Cada aba cenica troca a projecao para sua rota publica correspondente. `Bot /
Malas` abre `/`, `Baralho Morbido` abre `/baralho-morbido`, `Queda /
Emergencia` abre `/queda-aviao` e as demais cenas abrem uma tela preta propria
enquanto sua logica publica ainda nao existe. `Forca G — Samples` e `Forca G —
Shaders` mostram videos e imagens disparados no controller em tempo real.
`Glitch Geral` nao troca a cena projetada: ele abre o controller e o glitch
continua sendo aplicado sobre a tela publica que ja estiver ativa.

## Cena 0 — Bot / Malas

`/cena-0-controller` é a superfície privada dedicada à Cena 0. `/operator`
continua disponível como console técnico e hub neutro; entrar nele não troca a
projeção. O controller da Cena 0 organiza, sem timeline automática, os blocos
`COLETA`, `PARTICIPANTE`, `MALAS`, `É BOLO`, `CANTAR 15s`, `GLITCH`,
`INSTAGRAM`, `GOOGLE` e `AEROPORTO / TEA FOR TWO`.

Os dez botões grandes apenas definem em que etapa a apresentação está. Cada
mudança registra etapa anterior, etapa atual, ação do operador, participante e
acontecimentos recentes em `showState.sceneZero`; esse contexto é enviado ao
mesmo modelo e à mesma persona do chat. O texto público não vem de uma tabela
de falas. O modelo decide como formular a condução e se vale a pena reconhecer
metalinguisticamente a operação humana. A etapa só muda em outro clique do
operador.

Na coleta, `NOVA PERGUNTA`, `REFORMULAR` e `COMENTAR RESULTADO` geram uma
intervenção dentro da performance, não um questionário fixo. O modelo recebe
repertórios de assuntos e ações, a personalidade e a memória já existentes,
além do dataset da sala: tópico, ação, tipo de resposta, intensidade,
sensibilidade, escala, condições cruzadas, resultado aproximado e observações
reais. Ele é orientado a começar normal, variar assunto e ação, construir
subgrupos, cruzar respostas anteriores e aumentar a estranheza gradualmente.

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

O bloco `MALAS` chama o `SuitcaseDirector` existente. `É BOLO?` inicia e
controla o jogo `verdade_ou_bolo` já registrado no `GameDirector`; comentários
e provocações continuam sendo falas geradas, enquanto rodada, resposta e
revelação permanecem estados determinísticos do jogo.

Ao entrar em `JOGO DAS MALAS`, o navegador Playwright embedded já usado pelo
Instagram pesquisa automaticamente o nome do participante escolhido. A
sequência abre o Google, percorre os resultados, visita uma página pública que
pareça relevante, faz scroll e tenta localizar e abrir um perfil público do
Instagram. A pesquisa é somente leitura: não segue, curte, comenta, envia
mensagem nem executa login novo. URLs locais, telas de login e agregadores de
dados pessoais conhecidos são bloqueados. O mesmo frame continua interativo
para exploração manual; `PESQUISAR PARTICIPANTE` reinicia a sequência e
`FECHAR PESQUISA` encerra a exibição. Sair da etapa das malas também fecha a
pesquisa, preservando o perfil persistente para o uso normal do Instagram.

O timer cênico usa duração fixa de 15 segundos e um `endsAt` mantido no estado
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

`INICIAR INSTAGRAM` abre o mesmo `InstagramController`, perfil persistente,
painel embutido e guardrails já usados por `/instagram`; não existe uma segunda
automação. Login, 2FA/checkpoints, whitelist e conectividade continuam sendo
dependências da integração real. `INTERROMPER INSTAGRAM` corta as rotinas do
controller sem obrigar mudança de etapa.

O bloco `GOOGLE` recebe uma orientação completa, não apenas termos de busca.
Por exemplo: `buscar sobre o candidato do PL para eleições de 2026 e escolher
alguma notícia para ler por 15 segundos`. Ao executar, o mesmo navegador
Playwright embedded abre a busca real, deriva dela os termos pesquisados,
escolhe e abre resultados públicos quando isso fizer parte da orientação e
mantém a leitura/scroll pelo tempo solicitado. Pesquisas de notícias percorrem
duas fontes por padrão: o browser lê a primeira, volta aos resultados e abre a
segunda. Título, URL e trechos visíveis das páginas lidas viram evidência para
uma nova fala da Caixa no chat; sarcasmo pedido pelo operador é gerado a partir
dessa evidência, sem uma segunda busca invisível. Quando o assunto parece ser
uma pessoa, uma segunda aba procura o Instagram público em paralelo e o painel
oferece as abas `NOTÍCIAS` e `INSTAGRAM`.

No chat, o painel Google usa metade da largura da tela por padrão e viewport
desktop; o operador ainda pode redimensioná-lo. O frame permanece interativo
para o operador. `FECHAR GOOGLE` interrompe a rotina e retira o painel; URLs
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
principal. Ele controla `SOUND ON/OFF`, volume geral, volume da digitação, som de
encerramento e os presets `NORMAL`, `SECO`, `MECÂNICO` e `INSTÁVEL`. Os botões de
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
`TOCAR` para autoplay ou `PRÓXIMA` para avancar segmento por segmento. O botao
`SALVAR TEXTO / DIAGRAMAÇÃO COMO PADRÃO` grava texto, subdivisao, fade, ritmo,
tempo das rubricas e loop em `data/queda-aviao-default.json`; a proxima abertura
do controller e da projecao usa esse padrao salvo. O fade padrao inicial e
`0ms`, para troca seca de texto.

## Controllers editaveis de cues

`Forca G — Samples`, `Forca G — Shaders`, `Transicao Psicodelica`, `Tea For
Two`, `Piloto / Videogame` e `Tecnologia x Floresta` usam o editor persistente
de cues. Neles e possivel criar, duplicar e remover botoes, editar nome,
atalho, cor, tipo, material e duracao em milissegundos. `SALVAR PADRÃO` grava a
configuracao em `data/controller-cues.json`, para abrir igual na proxima sessao.

Atalhos de teclado disparam os botoes, mas sao ignorados enquanto o foco estiver
em `input`, `textarea`, `select` ou campo editavel. Os arquivos existentes em
`assets/` aparecem na lista de material. O campo `Adicionar arquivo` salva novos
arquivos em `assets/controller-cues/<controller>/` e atualiza a lista.
Cada cue tem seu proprio botao `STOP`: ele corta a previa/arquivo local e o cue
ativo na tela publica. No caso de `Forca G — Samples`, video e imagem sao
reproduzidos na projecao publica correspondente; cues de audio mantem a tela
preta e tentam tocar o arquivo no navegador da projecao.

Na `CENA 2D`, o cue `Texto Subindo` tem tipo `TEXTO`: edite seu conteudo no
campo `Texto projetado`, defina cor e duracao, salve o padrao e dispare o cue.
A tela publica da Transicao Psicodelica sobe o texto pela projecao; os demais
tipos continuam disponiveis para sons, videos e imagens.

Na `CENA 2B`, os botoes `TÚNEL`, `REDOUT` e `DEFORMAR` aparecem sobre a previa
do video. Eles aplicam a mesma camada sobre o video da projecao publica; use
`LIMPAR` para remover os tres efeitos e o controle de intensidade para dosar a
camada.

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
por `/api/game-assets`. A tela publica nao depende de SSE global: ela consulta
`/api/baralho-morbido` em intervalo curto, evitando que o Baralho trave as
outras telas abertas.

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
arquivo e lido apenas por `InstagramController` no servidor; usuario e senha nao
sao enviados em respostas, status ou logs e nao entram no bundle client. O
arquivo versionado `config/instagram-credentials.example.json` serve apenas como
modelo e nao contem uma senha real. Tambem e possivel apontar outro caminho
server-only com `INSTAGRAM_CREDENTIALS_FILE`.

O chat mostra um painel lateral com o espelho embutido do Instagram real,
mantendo a fala da Caixa Preta visivel ao lado. Se o Instagram pedir captcha,
checkpoint ou 2FA, o painel solicita intervencao manual; esses desafios nao sao
contornados automaticamente. O botao `X` fecha apenas o painel embutido; a sessao
Playwright continua viva. A sessao fica salva em
`.runtime/instagram-profile/` para as proximas execucoes.
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

Em `Verdade ou Bolo?`, o operator usa `REVELAR RESPOSTA` para tocar o video da
rodada. Quando o video termina, a projecao abre 10 segundos de voto no canto da
tela; se ninguem votar, a rodada conta como erro e avanca automaticamente.

Entrar no modo MALAS e gerar uma transicao contextual na projecao:

```text
/mala
```

`/malas` tambem funciona como alias. Esse comando tambem inicia o controlador
das tres malas e deixa o estado aguardando a escolha publica.

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

`/mala 1` forca Jogo do Nome / Maria Antonieta. `/mala 2` forca Instagram /
Um Minuto de Vida. `/mala 3` escolhe um minigame aleatorio. Tambem e possivel
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
  "instagramHandle": "@janainaleite",
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
