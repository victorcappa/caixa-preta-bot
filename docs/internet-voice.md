# Internet Voice

A camada `lib/internetVoice.js` aplica o guia
`data/caixa_preta_internet_ptbr_voice.json` à forma linguística das falas da
Caixa Preta. Ela complementa personalidade, regras, memória, estado da cena,
GameDirector, histórico e orientação do operador; não substitui nenhum desses
contextos.

A gramática estável, as regras positivas, os contrastes anti-assistente e a
arquitetura de variação entram diretamente no `system prompt`. Dados variáveis
do público continuam em contexto separado e não são promovidos a instruções de
sistema.

## Seleção por geração

Em cada chamada pública, `buildInternetVoiceContext()` observa o acontecimento
atual, a orientação do operador, o jogo ativo, até dez falas recentes da Caixa
e memórias disponíveis. O resultado escolhe no máximo três repertórios de
registro, três mecanismos de humor e dois contextos situacionais. Para cada
registro ativo, envia uma amostra rotativa de tokens e exemplos concretos do
JSON. Também seleciona marcadores, verbos produtivos e termos contemporâneos.
Os registros são combinados numa voz única; nunca viram modos públicos como
"TikTok" ou "Reddit".

O bloco enviado ao modelo também informa comprimentos e arquiteturas recentes,
mecanismos de humor detectados, quantidade de perguntas, risadas e palavrões,
além de uma arquitetura preferida ainda não usada recentemente. Os exemplos do
JSON entram como demonstrações de construção e few-shot relevante. O código
nunca escolhe um deles como fala final: a saída continua sendo gerada pelo
modelo a partir do acontecimento atual.

## Cooldown e callbacks

Expressões marcadas são procuradas nas dez falas recentes da Caixa. Depois do
uso, ficam em cooldown por seis turnos de fala do robô e entram no contexto como
expressões a evitar. Elas também são removidas dos tokens, exemplos, marcadores
e termos oferecidos naquele turno. Isso inclui `aura`, `rizz`, `delulu`, `gag`, `jurou`,
`skill issue`, `lore`, `de base`, `de arrasta`, `main character`, `mano`, `mds`
e `literalmente`. Risada e palavrão têm contagem recente separada.

Callbacks candidatos vêm de memórias recentes e de falas anteriores do público.
O prompt permite no máximo um quando houver encaixe, exige recuperação sem
explicar a ligação e proíbe inventar callback quando nenhum dado existe. O bloco
completo de memória continua sendo montado por `lib/openai.js` e mantém sua
classificação `RECENT`, `RELEVANT` e `AVAILABLE`.

## Fallback e debug

O JSON é lido uma vez do caminho `data/caixa_preta_internet_ptbr_voice.json` e
mantido em cache. `CAIXA_PRETA_VOICE_GUIDE_PATH` pode apontar para outro arquivo
em teste. Se leitura ou parse falhar, a camada retorna contexto vazio, mantém o
prompt anterior e registra um único aviso no console. Para desativar
intencionalmente, use `CAIXA_PRETA_INTERNET_VOICE=false`.

No ambiente de desenvolvimento, cada geração registra um bloco `STYLE` no
console do servidor. No operator, `/style` mostra a seleção baseada no estado
atual; `/style texto de um cenário` permite inspecionar como um acontecimento
seria classificado. Esse diagnóstico nunca entra na projeção pública.

## Testes

Validação determinística das 12 situações, variação, contagens, cooldown e
fallback:

```bash
npm run test:internet-voice
```

Avaliação real com o modelo configurado em `.env.local`, incluindo quatro pares
antes/depois, as 12 situações, três respostas consecutivas e duas chamadas com
cooldown ativo:

```bash
npm run test:internet-voice:live
```

O segundo comando usa a API real e gera texto novo; ele não faz parte do teste
determinístico nem deve ser interpretado como prova permanente do comportamento
ao vivo.
