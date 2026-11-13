# Referências e inconsciente coletivo

A aba **Referências** abre `/referencias`, uma superfície de consulta do acervo. Não registra janela pública, não navega a projeção e não dispara falas ou ações de cena. A ilha holográfica permite orbitar, aproximar, selecionar objetos e explorar os materiais; a lista, a busca e os filtros dão acesso ao mesmo catálogo, inclusive sem WebGL. O movimento respeita a preferência de movimento reduzido e pode ser pausado.

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

## Ilha holográfica e objetos da peça

O terreno, o mar em grade e pequenos fragmentos cênicos são uma composição original da interface. **Treze GLBs** foram copiados byte a byte de `../modelos-3d/AR/`, na pasta Caixa Preta indicada pelo usuário: avião quebrado, piloto, caixa-preta, cadeira, quati, borboleta, Zippo, cigarro, óculos, medalha, braço, perna e rã. O piloto e a cadeira usam as versões otimizadas já existentes nessa pasta, sem nova simplificação. A apresentação permite alternar entre holograma e materiais originais. Os arquivos originais permanecem intactos.

A **Pietà** é o décimo quarto objeto, exportada especificamente de `../pieta1.blend`, objeto `3DModel`; não usa um modelo de catálogo. Sua superfície mantém 950.347 polígonos, triangulados em 950.437 triângulos na exportação, com materiais/texturas. O GLB tem aproximadamente 101 MiB descomprimido, transferidos em gzip sem perda (~48 MiB), e é carregado somente ao selecioná-lo. A rota `app/api/reference-island/pieta/route.js` serve apenas esse arquivo estático permitido. Os seis primeiros objetos entram sequencialmente; os demais carregam sob demanda. Falhas ficam visíveis com possibilidade de nova seleção. Os decodificadores Draco estão servidos localmente, sem CDN.

`public/references/island/manifest.json` registra origem relativa, SHA-256, tamanho, geometria, posição, tema curatorial e política de carregamento. As fichas dos objetos dizem explicitamente que geometria visual não é texto consultado pelo bot. A autoria dos modelos não é inferida de sua posição junto a uma pessoa ou referência.

Para recopiá-los: `node scripts/prepare-reference-island-assets.cjs`. Para atualizar também a escultura, exporte com Blender em modo seguro:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/export-reference-island-pieta.py -- /private/tmp/pieta-ilha.glb
node scripts/prepare-reference-island-assets.cjs --pieta-glb /private/tmp/pieta-ilha.glb
```

O exportador lê a origem e grava somente o GLB/JSON de saída. A preparação exige que a contagem triangulada do GLB corresponda à origem e conserva seus hashes. O script sem `--pieta-glb` mantém a escultura preparada e verifica seu gzip. O funcionamento da ilha não depende das pastas externas depois da preparação.

## Relações, percursos, lacunas e cruzamentos

`lib/referenceIsland.js` define sete afinidades: memória, corpo, falha, duplo, trabalho, jogo e travessia. São leituras curatoriais calculadas a partir de títulos, resumos, motivos e tags, não diagnóstico das pessoas nem prova de influência entre artistas. Selecionar um tema reorganiza seus pontos na ilha. Ligações já registradas pelo catálogo aparecem contínuas; aproximações curatoriais são identificadas como tais e aparecem tracejadas. As fichas permitem percorrer ambas. Três trajetos editoriais — **Depois da queda**, **Mãos da máquina**, **Habitantes e duplos** — conduzem o olhar entre objetos e temas. **Lacunas** filtra pesquisas parciais ou limites de verificação; não encontrar uma publicação não prova ausência de produção.

O laboratório abaixo da ilha recebe dois materiais escolhidos nas fichas. **Ver contexto das fontes** recupera trechos sem consultar um modelo. **Gerar improvisação privada** faz uma chamada ao modelo configurado, somente após o clique; não publica na conversa, não altera `showState`, cenas, projeções, notas ou treinos. Sem provedor configurado ou após falha, aparece um erro explícito. Não há resposta simulada apresentada como geração real, busca externa, ferramentas ou reenvio automático.

`lib/referenceExperiment.js` limita a consulta aos IDs do catálogo e preserva os trechos, páginas e hashes efetivamente fornecidos, além da procedência das sete bases permanentes e dos três arquivos da influência coletiva. O resultado revela esse **contexto enviado**, não o raciocínio interno do modelo nem uma medição causal de influência. O registro diz respeito aos experimentos desta aba; não é um histórico de todas as gerações da apresentação. Fontes só citadas fornecem seus registros bibliográficos; um objeto 3D fornece apenas descrição/metadados, sem alegar visão computacional. **Guardar no caderno desta aba** conserva até oito experimentos no `sessionStorage` local; não altera o acervo compartilhado. O caderno pode ser esvaziado pela própria interface.

## Verificação

- `npm run test:collective-memory`: cobertura das 35 pessoas, integridade das fontes, motivos no prompt dos modos, separação de biografias e dados privados, atualização de cache em fixture descartável.
- `npm run test:references`: catálogo completo, proveniência e contagens coerentes com o índice real; fontes citadas não são apresentadas como textos integrais.
- `npm run memory:dissertation`: todas as páginas, hashes, recuperação por assunto, atribuição interna, filtro do Tarô e rejeição de original alterado.
- `npm run test:references:island`: cópias/hashes dos 14 modelos, triangulação da Pietà, afinidades e relações, percursos, contexto do experimento, modelo simulado e limites das ações privadas.
- `npm run test:references:browser`: build em cópia isolada e porta 3339, navegação/busca/seleção/filtros, modelos reais e Pietà sob demanda, materiais originais/holograma, afinidades, percursos, lacunas, laboratório com provedor simulado e caderno, desktop/mobile, movimento reduzido, ausência de WebGL e ausência de comandos de projeção ou geração pública. Não toca o servidor da apresentação.

Essas verificações não provam a qualidade de uma resposta de modelo real, a apresentação física ou uma implantação em produção. A regra de influência silenciosa foi implementada no contexto; comportamento efetivo exige ensaio e revisão das falas geradas.
