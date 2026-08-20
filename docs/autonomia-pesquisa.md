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

| Modo | Buscas externas/turno | Ações Instagram/turno | Timeout web | Contexto de busca |
| --- | ---: | ---: | ---: | --- |
| `LOW` | 1 | 0 | 10 s | low |
| `NORMAL` | 3 | 1 | 15 s | low |
| `HIGH` | 5 | 2 | 25 s | medium |

Falha, timeout ou esgotamento de orçamento volta para a conversa normal e não aparece como erro técnico para a plateia. A atividade completa fica disponível no operator.

## Instagram

Não há uma segunda integração. As tools `instagram_search`, `instagram_open_profile`, `instagram_get_recent_posts`, `instagram_open_post` e `instagram_analyze_post` reutilizam `lib/instagram/InstagramController.js`, o perfil Playwright persistente, a whitelist, login, 2FA/checkpoint, frame embutido e análise visual já existentes.

As tools autônomas são somente de leitura: não seguem, curtem, comentam nem enviam direct. Como o navegador aparece no layout público do chatbot, a navegação é considerada performática.

Fora de uma etapa roteirizada de Instagram, duas permissões precisam estar simultaneamente ligadas:

- `Instagram Autônomo`;
- `Pesquisa Performática`.

Durante o Instagram obrigatório das malas/sceneZero, os directors continuam donos de pessoa, ordem, tempo, glitch, preview, envio e projeção. A autonomia só observa/escolhe material dentro desse estado. Desligar `Instagram Autônomo` desliga as tools do modelo, mas não remove os controles manuais nem as rotinas roteirizadas existentes.

## Discoveries, open loops e callbacks

`save_discovery` grava somente uma descoberta com utilidade futura suficiente. Ela entra em `showState.memories` com `type: discovery`, origem, confiança, fatos, participantes, interest score e expiração. Fato atual expira em 6 horas; fato marcado como estável não recebe expiração automática.

`create_open_loop` guarda um fato específico em `showState.memories` e no índice `showState.research.openLoops`. O contexto recupera memórias por recência, sobreposição lexical, participante e potencial de callback/dramaturgia. Isso não usa um banco paralelo nem despeja toda a memória no prompt.

O interest score é produzido pelo modelo com seis dimensões entre `0` e `1`: `novelty`, `personal_relevance`, `comedic_potential`, `research_value`, `callback_potential` e `dramaturgical_relevance`. O código só aplica o limiar mínimo de persistência para evitar guardar material indiscriminadamente.

## Operator

O card `AUTONOMIA` no `/operator` controla:

- `Research` on/off;
- `Instagram Autônomo` on/off;
- `Pesquisa Performática` on/off;
- `Research Budget` low/normal/high;
- atividade recente com horário, canal, query/alvo e estado.

Os mesmos controles estão disponíveis por terminal:

```text
/autonomy research on|off
/autonomy instagram on|off
/autonomy performative on|off
/autonomy budget low|normal|high
```

As preferências sobrevivem a `/reset`; cache, atividade, discoveries da sessão e open loops não são tratados como configuração permanente do espetáculo.

## Ambiente e validação

Valores iniciais opcionais:

```bash
CAIXA_PRETA_RESEARCH_ENABLED=true
CAIXA_PRETA_RESEARCH_BUDGET=normal
CAIXA_PRETA_AUTONOMOUS_INSTAGRAM=false
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
