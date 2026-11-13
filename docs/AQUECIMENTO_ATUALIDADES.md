# Atualidades no aquecimento

A categoria `atualidades` ocupa a terceira pergunta seguindo **finjam de mortos → pergunta sorteada → atualidades**. Sessões recuperadas que já passaram dessa posição recebem a categoria no próximo sorteio enquanto nenhuma atualidade tiver sido publicada. Depois dela, os sorteios voltam ao repertório fixo e à intensidade escolhida. Contamos comandos distintos efetivamente publicados. Prévias, pulos e repetições não consomem posições. A contagem e a fala selecionada sobrevivem à recuperação da sessão.

Quatorze ações temáticas permanentes em `lib/audienceWarmupCurrentAffairs.js` integram esse sorteio e a biblioteca **AÇÕES CONFIGURADAS**. Elas abordam pandemia cibernética, GPS, Pix, alertas da Defesa Civil, temporais, falta de luz, calor e memória digital, com perguntas e gestos observáveis. Elas continuam disponíveis quando a edição semanal vence. A pesquisa semanal também investiga ataques cibernéticos, dependência digital e alertas de emergência.

Os botões **MUITOS/POUCOS** e os atalhos **↑/↓** usam o identificador e o gesto da sequência publicada. Isso mantém o registro de respostas disponível para perguntas de atualidades e para falas preservadas de uma edição anterior. Após registrar a resposta, **→** ou **SORTEAR** publica a reação e libera a próxima pergunta.

A formulação cibernética usa uma hipótese de interrupção ampla das redes, tema discutido no [cenário de risco do Fórum Econômico Mundial](https://www.weforum.org/stories/all/what-if-there-was-a-global-cyber-pandemic). A outra fala remete à experiência com o [Defesa Civil Alerta](https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil/defesa-civil-alerta).

O repertório semanal contém 3–6 ações, com ao menos um acontecimento de São Paulo (cidade/estado), um do Brasil e um do mundo. Cada entrada registra fato, data do acontecimento, publicação, fonte, relevância pública e vínculo com a peça. A pesquisa prioriza eventos de grande impacto dos últimos sete dias, sem preencher a lista com agenda institucional ou curiosidades. A fala pública é uma pergunta ou desafio de até 180 caracteres, inspirado no acontecimento e ligado à experiência da plateia. Datas, contexto factual, fontes e justificativa ficam no painel do operador. Edições antigas têm sua introdução jornalística removida ao preparar os comandos públicos.

Os eixos incluem memória/arquivo, IA/duplicação, corpo/percepção, acidente/protocolo, clima/sobrevivência, poder/desigualdade, trabalho/tecnologia e morte/permanência. São critérios editoriais aplicados pelo modelo durante a busca; a validação estrutural não comprova, sozinha, a veracidade ou a importância de um fato. O operador pode revisar fontes e relações dramatúrgicas antes de disparar.

A edição vira na segunda-feira, à meia-noite em `America/Sao_Paulo`. Com o controlador aberto, uma consulta a `/api/audience-warmup` a cada minuto verifica a validade: a busca externa só roda quando a semana muda. Sem controlador aberto, a atualização acontece no próximo uso ou pelo comando abaixo. Não há agendador externo nem atualização com o computador desligado.

Para carregar esta alteração de código, um servidor já aberto precisa de reinício: o hot reload preserva o `showState` e seus controles existentes. Siga a captura/retomada descrita em `docs/brain/OPERATIONS.md`; não encerre uma apresentação em andamento. Após carregar o código novo, as edições semanais dispensam reinício e build.

```bash
npm run warmup:current-affairs
npm run warmup:current-affairs -- --force
npm run test:audience-warmup:current-affairs
```

O botão **ATUALIZAR ATUALIDADES AGORA** força a mesma operação. A pesquisa usa a chave `OPENAI_API_KEY` do servidor, o modelo configurado e web search. Se o primeiro resultado falhar na validação, uma única revisão estruturada pode corrigir o formato usando apenas as fontes já encontradas; as URLs são resolvidas por índice, evitando erros de transcrição. Cada chamada tem limite de 60 segundos, sem retry automático de transporte. Respeita `CAIXA_PRETA_WEB_SEARCH=false`, `CAIXA_PRETA_RESEARCH_ENABLED=false` e o bloqueio do modo emergência. Requisições simultâneas compartilham a mesma pesquisa; após falha, a tentativa automática aguarda seis horas. Cada atualização consome a API de modelo/pesquisa.

A primeira edição revisada está em `data/audience-warmup-current-affairs.json`. As seguintes são gravadas atomicamente em `warmup-current-affairs.json` dentro de `CAIXA_PRETA_SHOW_RUNTIME_DIR` (padrão `.runtime/show/`), sem alterar o snapshot da apresentação e sem exigir novo build. Uma edição só substitui a anterior após passar nas validações de datas, cobertura, metadados e URLs presentes nos resultados da pesquisa. O texto já selecionado é preservado na sessão; atualizar a edição não troca a fala em projeção.

Sem edição válida, a terceira posição usa as quatorze ações temáticas e uma ação sobre compartilhar notícias. O painel avisa que a edição está vencida/indisponível e mostra o motivo da falha. Fontes antigas continuam disponíveis para consulta privada. Notícias vencidas saem do sorteio. Uma falha ao forçar atualização preserva a edição atual se ela ainda for válida.

Os testes usam relógio simulado e diretórios temporários para cobrir a ordem manual/automática, prévias, repetição, recuperação, virada semanal, cache, concorrência, bloqueio externo e falhas. Eles não demonstram atualização futura, recepção da plateia ou projeção física.
