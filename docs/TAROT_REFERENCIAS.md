# Referências e memória do Tarô

O arquivo `assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md` preserva o conteúdo de referência original e recebeu interpretações editoriais dos 22 Arcanos Maiores (CP-26 a CP-47). A edição 2.2 acrescenta 12 núcleos políticos, financeiros e algorítmicos (CP-48 a CP-59), pesquisados em 16/10/2026, e 15 entradas bibliográficas (E49 a E63). Ele amplia o repertório do Tarô; a dramaturgia canônica de `knowledge/` continua sendo a fonte principal sobre os acontecimentos do espetáculo. O sistema usa o mesmo modelo, personalidade, histórico, `showState`, recuperação da sessão e SSE existentes.

## Busca local

`lib/knowledge-retrieval.js` constrói um índice invertido com BM25. `lib/tarot/references.js` integra o documento aos mesmos arquivos enumerados em `lib/knowledge.js`, aos textos/entrevistas de `tarot.hallucination.memories` e às observações da sessão. Não há embeddings, chamadas de IA para indexação ou dependência de internet na busca.

Os trechos preservam parágrafos completos, hierarquia de títulos, núcleo CP, tags, arcanos, conexões, origem, data de corte e entradas bibliográficas citadas no núcleo. A bibliografia permanece indexada e é anexada como procedência dos trechos; instruções RAG e a matriz de cadeias exemplares não são selecionadas como falas prontas.

O índice dos arquivos é armazenado em `.runtime/tarot-reference-index.json`. Tamanho e data dos arquivos invalidam o cache; o texto não é relido nem reindexado em cada interpretação. Documentos dinâmicos usam um cache em memória por conteúdo. `REINDEXAR REFERÊNCIAS` força a reconstrução local. O índice não é uma segunda fonte editorial: é derivado dos arquivos existentes.

As interpretações individuais da Parte IV usam o mesmo formato CP do índice, a numeração real (VIII Justiça / XI Força) e a seleção temática **Referências filosóficas**. Cada leitura traz potencial simbólico, tensão/contraponto e uma pergunta associativa, sem alterar o catálogo visual ou a interpretação nele cadastrada. Os recortes anteriores conservam a data de corte de 15/10/2026. Os novos núcleos CP-48 a CP-59 usam **Verificação: 2026-10-16**; essa data é herdada por todos os seus parágrafos e exibida na prévia e no contexto enviado ao modelo. Ela identifica a consulta editorial, sem declarar atualização automática posterior.

A consulta combina inventário visual real, conceitos do catálogo, pergunta, seis mensagens recentes e pessoas selecionadas na biblioteca de rostos. Grupos de conceitos ampliam a busca; as conexões CP fornecem uma preferência adicional por relações editoriais. BM25 favorece também os conceitos principais e a pergunta. A seleção penaliza trechos e temas recentes e favorece diversidade de núcleos. Em alucinação, reduz a penalidade de repetição e amplia as pontes, sem modificar a memória. A recuperação é lexical e associativa por metadados; não é um modelo semântico de embeddings.

Entrevistas podem ser vinculadas aos IDs de pessoas cadastradas na seção de importação. Uma pessoa selecionada favorece documentos vinculados e seu nome participa da consulta. O peso do vínculo explícito acompanha a escala de pontuação do corpus para que sua ampliação não torne entrevistas vinculadas irrelevantes. Isso não constitui reconhecimento de identidade na carta. Textos desativados não entram na busca. A importação aceita até 30 textos UTF-8 de 120.000 caracteres cada; excedentes são rejeitados explicitamente. Um parágrafo maior que o orçamento não é cortado: outro trecho é selecionado.

## Operação privada

Se o servidor já estava aberto antes da integração, reinicie-o uma vez: o controlador compartilhado preservado pelo hot reload precisa carregar a versão 8. A API bloqueia uma versão antiga com pedido explícito de reinicialização, sem descartar a sessão. Os testes utilizaram um processo novo isolado.

Em `/treinamento/controle`, abra **05 — Memória → REFERÊNCIAS E MEMÓRIA**.

- Consulte os arquivos carregados, estado e data do índice, quantidade de trechos e fontes.
- Ative ou desative a recuperação, documentos e núcleos independentes. O tema principal de cada núcleo CP governa sua seleção. Desativar dramaturgia nesta recuperação não remove a personalidade/conhecimento canônico compartilhado do bot.
- Ajuste intensidade, associação livre, máximo de trechos e limite de caracteres. Isso altera somente recuperação e seleção.
- Selecione carta/pergunta/modo e clique em **TESTAR ASSOCIAÇÕES**. Observe conceitos, termos, pontes, trechos, fontes e estimativa de tokens.
- **GERAR INTERPRETAÇÃO** faz uma chamada real ao modelo configurado. Resultados normal, associativo e alucinatório ficam disponíveis para comparação privada. Os modos mudam o contexto recuperado, a intensidade de associação enviada ao modelo e, no teste alucinatório, os efeitos narrativos reais do avaliador existente. Não há respostas pré-escritas.

Esses testes usam uma cópia de valores da sessão e não executam `begin/finish`, não publicam mensagens, não alteram carta, cronômetro, histórico ou fala ativa. O diagnóstico global de chamadas externas pode registrar a geração. Não há uma segunda sessão de chatbot. Os testes não observam uma imagem nova: usam o inventário preparado da carta selecionada.

Durante a apresentação, o caminho normal em `service.js` recupera o contexto antes de chamar `generateTarotTurn`. Só uma resposta aceita pelo controlador registra os IDs/temas de recuperação na mensagem existente do histórico. Esses metadados são omitidos dos snapshots públicos. A interface informa a quantidade e os temas da última fala; a prévia permite inspecionar o texto recuperado na busca privada.

## Orçamento e interpretação

Por padrão: intensidade 65%, máximo configurado de quatro trechos, seleção efetiva de até três, com **6.500 caracteres incluindo procedência e fontes**. A estimativa conservadora exibida é caracteres/3: até aproximadamente 2.167 tokens de referências por resposta. Os limites configuráveis são 1–8 trechos e 1.500–12.000 caracteres. O prompt canônico existente, histórico, inventário, nomes selecionados e contexto contemporâneo são adicionais; a estimativa não representa o total faturado pela API.

O documento completo nunca é incluído no pedido. Também foi removido desse caminho o envio anterior de documentos inteiros da camada de alucinação: eles agora passam pela recuperação limitada. A geração recebe dados estruturados com trechos e procedência no último pedido textual, junto ao inventário e à pergunta. O prompt exige uma associação própria ancorada na carta, distingue fato/proposta/metáfora, preserva a ironia e evita exposição acadêmica, citações inventadas e previsão divinatória. A observação/interpretação/associação em três parágrafos e a revelação gradual dos elementos existentes são preservadas.

## Atualização contemporânea

Na seção **10 — Personalidade e contexto → CONTEXTO CONTEMPORÂNEO**, cadastre resumo factual, URL, data de publicação, data de consulta/atualização e estado de verificação. Marcar como verificado exige data de consulta; registros antigos sem essa informação são tratados como não verificados. Cada entrada pode ser ativada ou desativada. Para corrigir uma entrada, desative a antiga e adicione a revisão com sua nova consulta e fonte.

A busca funciona offline com os últimos dados locais. O arquivo principal recebe a data de corte do front matter; uma data explícita de **Verificação** no núcleo prevalece somente naquele núcleo. A consulta documentada em 16/10/2026 não revalida os núcleos antigos nem transforma o arquivo em notícias ao vivo. O prompt exige respeitar datas e não inferir resultados eleitorais, candidaturas ou situação jurídica atual. A verificação é editorial e manual, sem coleta automática de notícias: consulte fontes oficiais pertinentes antes da apresentação e registre o que foi conferido. O sistema não comprova automaticamente que a URL sustenta o resumo.

## Validação

```bash
npm run test:tarot:references
npm run test:tarot:references:browser
npm run test:tarot:references:live
```

O primeiro cobre documentos, núcleos, procedência, BM25, conceitos, cartas, entrevistas/pessoas, filtros, orçamento, cache, offline, recorrência, alucinação, recuperação de estado e integridade do original. O segundo prepara um build/servidor isolado na porta 3318, verifica a interface em Playwright, inspeciona pedidos interceptados do modelo e testa uma leitura ativa sem tocar a porta 3000. `CAIXA_PRETA_OPERATOR_AUDIT_ROOT` pode reutilizar um build isolado já atualizado. O terceiro usa a chave local e o modelo real, com três interpretações privadas e uma leitura ativa exclusivamente na sessão temporária; consome API e grava evidência em `/private/tmp/tarot-reference-evidence-*`.

Testes locais/interceptados comprovam a seleção e o envio do contexto, não a qualidade dramatúrgica de um modelo real. A evidência de respostas reais deve ser avaliada separadamente; nem ela comprova webcam, fusão facial física, projeção, áudio ou ensaio completo. As notícias e fontes do documento não são revalidadas pelos testes.

### Evidência desta integração — 15/10/2026

Passaram os 14 grupos de testes locais de referências, as regressões `test:tarot`, `test:tarot:experience`, `test:tarot:hallucination` e `test:tarot:catalog` (22 cartas / 182 âncoras), ESLint dos arquivos alterados, build de produção isolado e `brain:sync` / `brain:check`.

A execução HTTP/Playwright com modelo interceptado passou: `/private/tmp/tarot-reference-evidence-Fz7usl/report.json`. Os pedidos interceptados confirmaram que somente os trechos selecionados chegam ao modelo, com seus metadados, sem imagens ou documento integral.

Após autorização explícita, foram executadas **quatro gerações reais**, todas aprovadas pelo teste, exclusivamente na sessão temporária da porta 3318: `/private/tmp/tarot-reference-evidence-WA2D7h/report.json`. A interface renderizada está em `references.png` no mesmo diretório. A porta 3000 não recebeu comandos do teste.

| Leitura real | Núcleos recuperados | Contexto de referências | Associação observada na resposta |
| --- | --- | --- | --- |
| A Torre / normal | CP-03, CP-14, CP-21 | 4.814 caracteres / ≈ 1.605 tokens | Queda, estrutura que promete segurança, fragmentos e arquivo. |
| A Morte / associativa | CP-05, CP-06, CP-20 | 5.501 caracteres / ≈ 1.834 tokens | Corpo, autoridade despossuída, imagem que permanece e ilha de imagens. |
| A Lua / alucinatória | CP-08, CP-05, CP-03 | 5.115 caracteres / ≈ 1.705 tokens | Sinais ambíguos, percepção, duplicação e desconfiança do olhar. |
| A Torre / fluxo ativo temporário | Temas morte, dramaturgia e Big Techs | 4.281 caracteres / ≈ 1.427 tokens | Evidência congelada, arquivo, pixels e laudos sem restaurar o sentido. |

As respostas reais foram diferentes e mostram uso interpretativo do repertório, além da correspondência lexical da busca. Essa amostra não certifica todos os arcanos, consistência futura, qualidade poética em todas as condições ou comparação causal de modos na mesma carta; a interface permite repetir essa comparação privadamente. A formulação verbal da alucinação ainda pode precisar de ajuste editorial. Webcam, áudio/projeção físicos e ensaio completo permanecem sem nova validação. Os fatos contemporâneos do arquivo não foram rechecados na internet nesta entrega.

### Atualização editorial — 16/10/2026

A Parte IV recebeu 22 interpretações individuais (CP-26 a CP-47), preservando a tabela anterior, a bibliografia e o catálogo. A checagem local confirmou 22 seções únicas indexadas e a recuperação da leitura correspondente para cada carta, dentro do orçamento de contexto. Os 14 grupos de `test:tarot:references`, ESLint de `references.js` e `brain:sync` / `brain:check` passaram. Foi corrigida a regressão de prioridade das entrevistas vinculadas detectada com o corpus ampliado. Não foram feitas novas chamadas ao modelo ou validações físicas nesta revisão editorial.


### Contexto político pesquisado — 16/10/2026

CP-48 a CP-59 cobrem bolsonarismo e responsabilização institucional; extrema direita, fascismo e autocratização; Banco Master, Daniel Vorcaro e BRB; Compliance Zero e disputas de informação; pressão dos EUA em 2025 e o arquivo de 1964; tecnocracia e poder empresarial; experimentos com feeds e mobilização eleitoral; bets, proibição e manipulação esportiva; circuitos entre classificação, incentivos e ação real. Fatos, alegações, estudos e associações aparecem identificados, com datas e fontes. A revisão registra também limites: sanções de 2025 posteriormente retiradas, encaminhamentos de bloqueio que não comprovam execução integral, e pesquisas que não permitem atribuir o resultado de uma eleição inteira a um algoritmo.

Os novos núcleos seguem os filtros existentes **Política e democracia**, **Big Techs e tecnocracia** e **Bets / fé e sorte**. O índice v4 incorpora a data por seção, preservando orçamento, memória e distinção entre interpretação editorial e prova. A comparação com o documento anterior confirmou que os 47 núcleos originais, incluindo as 22 interpretações, permaneceram idênticos. Os testes locais incluem recuperação dos novos temas, datas, fontes, filtros e limite de contexto; a revisão não requer gerações reais de IA nem reinício da sessão.

Passaram os 15 grupos de `test:tarot:references`, lint focado, build isolado e `brain:sync/check`. O ensaio HTTP/Playwright com modelo interceptado confirmou a busca Master/Vorcaro e a data por seção na interface (`/private/tmp/tarot-reference-evidence-pUupgR/report.json`). A reindexação e a busca na porta 3000 confirmaram 345 trechos / 63 fontes, dentro do orçamento e sem modificar sessão, histórico ou parâmetros (`/private/tmp/tarot-political-references-live-index.json`). Esses testes validam recuperação e transporte do contexto; a conferência factual decorre da pesquisa editorial, não do teste automático. Não houve novas gerações reais de IA.
