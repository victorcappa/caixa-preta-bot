# Referências e inconsciente coletivo

A aba **Referências** abre `/referencias`, uma superfície de consulta do acervo. Não registra janela pública, não navega a projeção e não dispara falas ou ações de cena. O arquivo tridimensional permite girar e selecionar os materiais; a lista, a busca e os filtros dão acesso ao mesmo catálogo, inclusive sem WebGL. O movimento respeita a preferência de movimento reduzido e pode ser pausado.

Cada ficha distingue texto integral extraído, mapa permanente, texto de cena, recorte local e fonte apenas citada. Mostra a procedência, um trecho curto e a ligação original quando disponível. O catálogo é derivado das fontes explícitas de `lib/showMemory.js` e da pesquisa pública em `knowledge/collective/`; não publica notas privadas, exemplos de treino, conversas da apresentação ou dados dos participantes. Nenhum diretório privado é varrido.

## Dissertação de Marcus Garcia

**Labirinto de Labirintos: o trabalho técnico entre o aprisionamento e a possibilidade no teatro**, Marcus Vinícius de Melo Garcia, ECA/USP, versão corrigida de 2025, orientação de Cibele Forjaz Simões. O PDF original tem **182 páginas** e está preservado em `assets/referencias/`; a extração integral por página está em `knowledge/sources/labirinto-de-labirintos.json`. Há verificação do SHA-256 do original e do texto; figuras não foram interpretadas pelo bot. O número da página é a posição no PDF.

Fonte: [Biblioteca de Teses e Dissertações da USP](https://teses.usp.br/teses/disponiveis/27/27162/tde-27032025-140432/publico/MarcusViniciusdeMeloGarciacorrigidaPPGAC5434469.pdf). A autorização de reprodução para estudo e pesquisa com atribuição consta na terceira página. A procedência é mantida no acervo; o bot não transforma isso em citações espontâneas ao público. Os filtros específicos do Tarô continuam separados da recuperação textual geral.

Para substituir o PDF, executar `npm run memory:sync`, `npm run memory:audit` e `npm run memory:dissertation`. O runtime usa JSON e não depende de Python; a extração utiliza o Python/PyMuPDF já documentado em `docs/TREINO_AO_VIVO.md`.

## Pessoas, obras e influência silenciosa

A pesquisa pública parte da [ficha técnica do Instituto Capobianco](https://institutocapobianco.art.br/a-caixa-preta-versao-demo), conferida em **12/11/2026**. São **35 pessoas** do núcleo de criação, elenco/equipe e rede de colaboradores de pesquisa, com vínculos separados por `membership` e papéis por `creditRole`. A entidade creditada como **Molde** é registrada à parte e não contada como pessoa. A lista de participantes usada pelos sorteios não define este acervo.

Os três JSONs em `knowledge/collective/` registram trabalhos acadêmicos, artísticos e práticas de pesquisa, fontes públicas, datas de consulta, cobertura e limites. Grafias alternativas são preservadas como aliases quando verificadas. Não encontrar uma publicação acadêmica significa **não localizada nesta pesquisa**, nunca ausência de produção. Um crédito ou resumo público consultado não equivale a ler uma tese, assistir a uma performance ou incorporar uma obra integral. A dissertação de Marcus tem ingestão integral separada; as demais pesquisas têm a cobertura indicada em cada ficha.

`lib/collectiveMemory.js` converte os motivos editoriais dessas fichas em uma camada permanente de associação no prompt compartilhado da personagem. Esta camada não contém os currículos, títulos, nomes ou URLs das fichas. Os motivos são inferências editoriais sobre práticas públicas, não citações, traços psicológicos ou acesso à vida pessoal. A dramaturgia, a direção cênica e o acontecimento presente mantêm prioridade.

O bot deve transformar essa matéria em sua própria voz: imagem, ritmo, humor, atenção ao corpo, ao objeto, ao arquivo e ao trabalho. Não anuncia a influência nem recita referências espontaneamente. Pode responder com atribuição e limites quando alguém pede explicitamente informações sobre uma pessoa, obra ou fonte. O sistema não altera os pesos do modelo; fornece contexto para suas próximas gerações. Os JSONs invalidam o cache quando mudam; mudanças no código exigem rebuild/restart em produção.

## Verificação

- `npm run test:collective-memory`: cobertura das 35 pessoas, integridade das fontes, motivos no prompt dos modos, separação de biografias e dados privados, atualização de cache em fixture descartável.
- `npm run test:references`: catálogo completo, proveniência e contagens coerentes com o índice real; fontes citadas não são apresentadas como textos integrais.
- `npm run memory:dissertation`: todas as páginas, hashes, recuperação por assunto, atribuição interna, filtro do Tarô e rejeição de original alterado.
- `npm run test:references:browser`: build em cópia isolada e porta 3339, navegação/busca/seleção/filtros, desktop/mobile, movimento reduzido, ausência de WebGL e ausência de comandos de projeção ou geração. Não toca o servidor da apresentação.

Essas verificações não provam a qualidade de uma resposta de modelo real, a apresentação física ou uma implantação em produção. A regra de influência silenciosa foi implementada no contexto; comportamento efetivo exige ensaio e revisão das falas geradas.
