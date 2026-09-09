# Autonomia de pesquisa

A Caixa Preta pode decidir, dentro do mesmo turno da Responses API, entre responder diretamente ou usar ferramentas externas antes de produzir a fala. A decisão pertence ao modelo; orçamento, timeout, cache, memória, permissões e limites dramatúrgicos pertencem ao código.

O fluxo implementado é:

```text
evento -> contexto/persona -> decisão do modelo -> tools opcionais
       -> observações -> nova decisão -> envelope da fala -> directors existentes
```

`lib/research/ResearchDirector.js` centraliza tools, orçamento, deduplicação, cache, log, discoveries e open loops. `lib/openai.js` mantém o loop de function calling e continua sendo o único ponto que produz a fala final com a personalidade e `data/caixa_preta_internet_ptbr_voice.json`.

## Busca web

O modelo recebe três abstrações sobre a mesma busca hospedada da Responses API:

- `web_search`: referências, conceitos, pessoas e lugares;
- `web_search_news`: informação cuja atualidade é essencial;
- `web_search_local`: São Paulo, bairros, transporte, clima, preços, lugares, eventos e cultura local.

A busca ocorre em uma chamada auxiliar curta e retorna observações para o turno principal. O resultado não obriga a Caixa a usá-lo. A fala não deve narrar “vou pesquisar”, “encontrei no Google” ou “segundo minha pesquisa”.

O cache usa `modo + query normalizada`. Em `NORMAL`, fatos gerais/locais duram 30 minutos e notícias 3 minutos. A mesma query não pode ser repetida no mesmo turno.

## Orçamento

O padrão é `NORMAL`:

| Modo | Buscas externas/turno | Ações Instagram autônomas | Timeout web | Contexto de busca |
| --- | ---: | ---: | ---: | --- |
| `LOW` | 1 | 0 | 10 s | low |
| `NORMAL` | 3 | 0 | 15 s | low |
| `HIGH` | 5 | 0 | 25 s | medium |

Falha, timeout ou esgotamento de orçamento volta para a conversa normal e não aparece como erro técnico para a plateia. A atividade completa fica disponível no operator.

## Instagram

O modelo não recebe tools de Instagram. `lib/research/ResearchDirector.js` mantém `autonomousInstagramEnabled=false` mesmo se uma configuração tentar ligá-lo, e `lib/instagram/autonomousTools.js` devolve `BOT_EXTERNAL_NAVIGATION_BLOCKED` sem criar ou navegar um browser. Entrar no estágio das malas também não inicia pesquisa automaticamente.

A integração real existente continua disponível somente por uma ação explícita e inequívoca do operador nos controles da Cena 0 ou pelo comando manual `/instagram`. Login, whitelist, preview e demais guardas permanecem iguais.

## Discoveries, open loops e callbacks

`save_discovery` grava somente uma descoberta com utilidade futura suficiente. Ela entra em `showState.memories` com `type: discovery`, origem, confiança, fatos, participantes, interest score e expiração. Fato atual expira em 6 horas; fato marcado como estável não recebe expiração automática.

`create_open_loop` guarda um fato específico em `showState.memories` e no índice `showState.research.openLoops`. O contexto recupera memórias por recência, sobreposição lexical, participante e potencial de callback/dramaturgia. Isso não usa um banco paralelo nem despeja toda a memória no prompt.

O interest score é produzido pelo modelo com seis dimensões entre `0` e `1`: `novelty`, `personal_relevance`, `comedic_potential`, `research_value`, `callback_potential` e `dramaturgical_relevance`. O código só aplica o limiar mínimo de persistência para evitar guardar material indiscriminadamente.

## Operator

O card `AUTONOMIA` no `/operator` controla:

- `Research` on/off;
- estado `Instagram somente manual`;
- `Pesquisa Performática` on/off;
- `Research Budget` low/normal/high;
- atividade recente com horário, canal, query/alvo e estado.

Os mesmos controles estão disponíveis por terminal:

```text
/autonomy research on|off
/autonomy performative on|off
/autonomy budget low|normal|high
```

As preferências sobrevivem a `/reset`; cache, atividade, discoveries da sessão e open loops não são tratados como configuração permanente do espetáculo.

## Ambiente e validação

Valores iniciais opcionais:

```bash
CAIXA_PRETA_RESEARCH_ENABLED=true
CAIXA_PRETA_RESEARCH_BUDGET=normal
CAIXA_PRETA_PERFORMATIVE_RESEARCH=false
CAIXA_PRETA_WEB_SEARCH=true
```

Validação lógica:

```bash
npm run test:research
npm run test:internet-voice
npm run test:instagram
npm run test:suitcases
npm run test:games
npm run test:host-mode
npm run test:performance
npm run lint
```

Esses testes provam limites, cache, deduplicação, integração estática e regressões locais. Não provam a qualidade dramatúrgica do modelo ao vivo, disponibilidade real da busca OpenAI, login do Instagram, conteúdo de perfis ou comportamento do navegador em ensaio. Um teste real deve usar material público/sintético autorizado e observação do fluxo completo.
