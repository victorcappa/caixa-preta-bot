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
OPENAI_MODEL=gpt-5-nano
```

O arquivo `.env.local` esta no `.gitignore` e nao deve ser commitado.

`OPENAI_MODEL` e opcional. O padrao do projeto e `gpt-5-nano`, escolhido para testes e uso local com menor custo. Para uma resposta mais forte em apresentacao, voce pode trocar para `gpt-5-mini`.

## Rodar localmente

```bash
npm run dev
```

Depois abra:

- `http://localhost:3000`
- `http://localhost:3000/operator`

## Comandos do operator

Registrar uma memoria da apresentacao:

```text
/memory chegou uma pessoa atrasada de blusa listrada
```

Pedir que a Caixa Preta diga algo na projecao:

```text
/say faça um comentario indicando que agora podemos comecar
```

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

## Arquitetura de contexto

A Caixa Preta responde a partir de uma montagem central de contexto:

1. personalidade
2. regras dramatúrgicas
3. exemplos de comportamento
4. conhecimento local
5. memória da apresentação
6. histórico recente da conversa
7. orientação do operador, quando enviada por `/say`

A chamada para a OpenAI fica isolada em `lib/openai.js`.
A montagem do system prompt fica em `prompts/buildSystemPrompt.js`.
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
Essa memoria entra nas proximas chamadas como `MEMORIA DA APRESENTACAO`.
Ela nao e uma ordem para a Caixa Preta falar imediatamente.

`/say orientacao` entra como `ORIENTACAO DO OPERADOR`.
A instrucao nao aparece para o publico e nao deve ser repetida literalmente.
A IA transforma a orientacao em uma fala final da Caixa Preta.
