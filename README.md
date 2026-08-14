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

Depois abra:

- `http://localhost:3000`
- `http://localhost:3000/operator`

O operator tambem pode ser aberto dentro da tela principal pelo botao `OP`,
abaixo do botao `?`. Ele alterna entre chat em tela cheia e chat com terminal
operador ao lado; em telas menores, aparece como gaveta animada.

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

Abrir o Instagram real em Chromium visivel e seguir o perfil autorizado:

```text
/instagram follow cappavictor
```

Na primeira execucao, o Chromium abre `instagram.com` por tras da interface e o
chat mostra um painel lateral com o espelho embutido do Instagram real, mantendo
a fala da Caixa Preta visivel ao lado. Se o Instagram pedir login, clique no
espelho, digite ali e faca login manualmente como `@caixapretabot`. O botao `X`
fecha apenas o painel embutido; a sessao Playwright continua viva. A sessao fica
salva em `.runtime/instagram-profile/` para as proximas execucoes.
O comando so aceita perfis listados em `INSTAGRAM_ALLOWED_PROFILES`; por padrao,
apenas `cappavictor`. O painel operator mostra `INSTAGRAM >` com progresso, URL,
estado do botao e necessidade de intervencao manual quando houver checkpoint,
captcha, 2FA ou tela desconhecida.

Variaveis relacionadas:

```bash
INSTAGRAM_ENABLED=true
INSTAGRAM_EMBEDDED=true
INSTAGRAM_DEBUG=false
INSTAGRAM_THEATRICAL_DELAY=700
INSTAGRAM_VIEWPORT_WIDTH=430
INSTAGRAM_VIEWPORT_HEIGHT=760
INSTAGRAM_ALLOWED_PROFILES=cappavictor
```

Com `INSTAGRAM_EMBEDDED=false`, o Playwright volta a abrir uma janela Chromium
separada. O padrao cenico agora e embutido no chat.

Com `INSTAGRAM_DEBUG=true`, erros salvam screenshot e metadados seguros em
`.runtime/instagram-debug/`. O projeto nunca salva usuario, senha, cookies,
tokens ou headers em logs.

Forcar ou controlar um jogo do HOST:

```text
/game
/game cards
/game maria
/game secret Anitta
/game mestre
/game stop
/game replace forca
```

Se ja houver jogo ativo, `/game` nao empilha outro. Use `/game stop` para
encerrar ou `/game replace tipo` para substituir explicitamente. Em Maria
Antonieta no modo em que a Caixa adivinha, `/game secret texto` define o segredo
no servidor/operator sem enviar esse segredo para o modelo.

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
npm run build
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
