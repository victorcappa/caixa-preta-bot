# Verificação do acervo — 12/11/2026

Registro da amostra anterior à inclusão do PDF de continuação. Os planos mais recentes para as cenas 7–15 estão em [POS_DEMO.md](POS_DEMO.md); o roteiro de teste atual acompanha essa atualização, em especial as cenas 8 e 9.

Fonte: `Texto caixa preta.pdf`, SHA-256 `8dd9654f1bebf55469a1a04d054391afd49d6df909596d18f399023122db066e`, mais os textos atuais catalogados em `lib/showMemory.js`. Operação e manutenção: [TREINO_AO_VIVO.md](TREINO_AO_VIVO.md).

## Evidência local

`npm run memory:audit` passou: texto completo das 34 páginas preservado no índice, cenas 0–9, 59 seções CP e 63 entradas bibliográficas, 3.838 trechos. A auditoria também verifica assuntos, memória de processo, múltiplas cenas, listas comentadas, orçamento, privacidade e invalidação de cache/hash. Faz as mutações de teste em cópia temporária.

`test:live-training`, lint e brain sync/check passaram. O build/browser isolado com provedor simulado confirmou trecho da página 32 no pedido de geração, precedência das malas atuais, conversa/digitação, alternativas públicas, avaliações privadas, recuperação, reenvio e STOP ALL. Isso não é evidência de resposta de um modelo real nem de projeção física.

## Amostra real autorizada

Foram feitas cinco consultas e uma repetição direcionada, sem alterar a sessão da apresentação, pelo mesmo `streamLiveTrainingReply`, com `gpt-5.6-terra`, sem ferramentas e sem pesquisa externa.

| Caso | Resultado observado |
| --- | --- |
| Regras atuais versus PDF | Respondeu 2 → 1 → 3, bexigas, forca/disco e toca-discos; reconheceu a mala falsa como versão antiga. |
| Cenas 8 e 9 | Identificou fones gamer/máscaras, manipulação gamer-vodu, bicicleta de Elisa e desenvolvimento ainda não consolidado. |
| Cenas 3 e 6 | Identificou fonógrafo, Edison e Jonathan; relacionou corpo, registro e percepção. |
| Cenas 1, 2, 4, 5 e 7 | A primeira resposta confundiu a mão do piloto com a experiência de Elisa. A recuperação passou a reconhecer listas como “cada cena: 1 aeroporto; 2 queda...”, dividir o orçamento entre as cenas e fornecer o trecho da mão de borracha. A orientação de resposta passou a exigir atribuição factual por cena. Na repetição, que pediu explicitamente o nome da observadora e o dispositivo de Elisa, respondeu Geógrafa/Gamer e braço destacável/mão de borracha. |
| Morel e Janaina Leite | Associou Morel a ilha, duplo, registro e repetição; Leite a documento, corpo, intimidade e teatro do real. Não inventou citação literal nem afirmou participação formal sem prova. |

Os checks automáticos procuram fatos mínimos; as respostas também foram lidas. O caso corrigido usa uma pergunta mais explícita, portanto não é uma repetição de texto idêntico. A recuperação da pergunta original permanece coberta pela auditoria local, que exige fontes das cinco cenas e o dispositivo da Cena 5.

Para repetir só um caso: `npm run memory:live -- --case=cenas-1-2-4-5-7`. O comando imprime o caminho de um JSON temporário com pergunta, resposta, modelo, duração e lacunas; não publica a resposta na projeção.

## Limites

Esta amostra confirma acesso real e uso de fatos do acervo, não uma garantia de infalibilidade para toda pergunta. O modelo pode omitir ou confundir informações. As bases permanentes e a recuperação dão contexto; não modificam seus pesos. Referências datadas não foram novamente checadas na internet. Áudios, vídeos, imagens e ensaios não transcritos não se tornam conteúdo conhecido pela simples presença dos arquivos. Cenas 8/9 e ato 2 continuam identificados como propostas do rascunho.
