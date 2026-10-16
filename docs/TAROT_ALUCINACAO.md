# Tarô: rostos, fusão e timeline

A navegação **TARÔ** abre `/treinamento/controle`. A projeção continua em `/treinamento`; o operador convencional conserva seu link discreto. As onze seções são recolhíveis. Cartas no chão e Visual continuam disponíveis.

## Preparação local

1. Em **05 — Memória**, clique **PREPARAR ROSTOS DE assets/rostos** para as oito fotografias fornecidas, ou **IMPORTAR FOTOGRAFIAS** para fotos inteiras individuais/em lote. Um Worker usa MediaPipe CPU local e extrai os rostos automaticamente. Uma foto com um rosto já o seleciona; numa foto de grupo, marque os rostos desejados. Falhas individuais não interrompem o lote. Correção manual é fallback explícito.
2. Em **06 — Fusão facial**, clique **PREPARAR FUSÕES AUTOMATICAMENTE**. São escolhidos até três templates por rosto, ordenados por compatibilidade de orientação. Também é possível selecionar carta e rosto para preparar uma combinação individual.
3. Em **11 — Testes**, selecione carta e combinação e clique **VER FUSÃO AGORA**. Confira o resultado e use **APROVAR FUSÃO** ou **REJEITAR FUSÃO**. Somente fusões aprovadas, da versão atual da carta e template, entram na apresentação. Uma aprovação antiga não é reaproveitada após trocar os bytes da referência ou o template.
4. **PRONTO PARA APRESENTAÇÃO**, na seção 06, reconecta os recursos aprovados à sessão atual e informa pendências. Não significa aprovação automática das combinações.

O controle **FOTO / ROSTO RECORDADO ↔ CARTA**, na fusão e na prévia, ajusta a mistura de 0 a 100% sem recalcular imagens. O padrão é **85% fotografia / 15% carta**, com intensidade facial de 100%. Em 0%, prevalece a ilustração; em 100%, prevalece a textura facial alinhada da fotografia. Intensidade, entrada/saída e oscilação continuam modulando a aparição independentemente dessa mistura. A cor é adaptada à paleta da carta. A malha preserva olhos, nariz e boca; não é uma sobreposição retangular.

Há nove regiões humanas iniciais em `assets/tarot/face-templates.json`, associadas aos hashes das referências. Não se inventa rosto em cartas sem personagem compatível. O editor permite ajustar região, orientação, rotação e cinco pontos internos de controle antecipadamente. São templates geométricos iniciais; exigir revisão artística das combinações, sobretudo perfis, rostos invertidos e acessórios. Não há reconstrução generativa nem garantia de semelhança perfeita.

Recortes e fusões ficam em `.runtime/tarot-faces`, fora do Git, e são reutilizados entre sessões. As fotografias originais de `assets/rostos` são preservadas. O runtime, WASM, modelo e licença estão em `public/vendor/mediapipe`; nenhum download é necessário durante o espetáculo. Nenhuma fotografia é enviada a serviços externos.

## Operação e tempo

**07 — Alucinação** concentra a chave geral, início automático após **três cartas distintas**, filtro de cartas elegíveis, opção de aguardar fusão aprovada, comportamento na retirada e presets. Reconhecimentos repetidos e o retorno breve da mesma carta não somam. A contagem da alucinação é independente das seis leituras completas da etapa do chão.

O painel mantém um aviso de **Estado da alucinação** em todas as seções: contagem, timeline, filtro de cartas, chave geral, ausência e falta de fusões aprovadas são informados separadamente. **TODAS AS CARTAS** remove a restrição de arcanos sem reiniciar contagem, timeline ou efeitos. Para restringir, use **ESCOLHER CARTAS ESPECÍFICAS** e marque as cartas pelo nome; selecionar apenas uma limita o disparo automático a ela. Após remover uma restrição com a execução parada, a próxima apresentação válida respeita a contagem já atingida. A aprovação artística das fusões continua obrigatória para mostrar rostos.

**08 — Timeline** oferece PLAY, PAUSE, STOP, RESTART e eventos editáveis por campos numéricos em segundos. Cada evento tem trilha, início, entrada, permanência, saída, intensidade, transição, habilitação, repetições e intervalo. Duplicar cria outro evento com ID próprio; alterar início reorganiza sua posição temporal. Eventos sobrepostos do mesmo efeito usam a maior intensidade, sem somas inesperadas.

O preset inicial faz a primeira fusão começar em 10 s, entrar em 3 s, **permanecer por 45 s** e sair em 3 s (retorno ao original em 61 s). Para mudar os 45 s, abra o primeiro evento e altere **Permanência (s)**. A segunda aparição começa em 68 s; a terceira em 98 s. Ajuste início/intervalos para criar períodos normais entre aparições.

O servidor registra execução, carta/assinatura, posição e âncora monotônica; o cliente interpola a posição a partir do snapshot, sem temporizadores por evento e sem emitir snapshots por frame. A pausa congela a posição. A chave geral só suspende as camadas e mantém o relógio, as configurações e os toggles. Recuperar uma sessão nunca retoma uma execução visual antiga automaticamente.

Cada efeito tem toggle, intensidade, velocidade e duração manual. **EXECUTAR AGORA** cria uma intervenção temporária; **SUSPENDER** impede aquele efeito até **RETORNAR À TIMELINE**. O toggle OFF sempre prevalece. Se o transporte estiver parado, um comando manual inicia somente a camada solicitada, sem disparar os eventos programados. **RETORNAR AO NORMAL** para a execução e limpa intervenções. Trocar um toggle, mistura ou intensidade não reinicia o relógio.

A ausência confirmada pelo tracker limpa imediatamente as camadas locais, inclusive resíduos tipográficos, e invalida os comandos da execução. O padrão é encerrar: reapresentar a mesma carta não ressuscita a timeline antiga. A política explícita de pausa permite retomar no retorno; reinício/próxima carta aguardam nova seleção válida. O reconhecimento e sua tolerância existente continuam sendo a autoridade sobre presença. Falhas de textura não bloqueiam a fala; são relatadas no controle. Emergência/STOP ALL e encerramento preservam a conversa e cancelam os efeitos.

Presets **SUTIL**, **PSICODÉLICO**, **DESINTEGRAÇÃO**, **PAREIDOLIA** e personalizados incluem eventos e configurações individuais. Depois de escolher, todos os parâmetros continuam editáveis. Salvar com outro nome duplica; salvar com o mesmo nome atualiza. Restaurar recarrega o preset selecionado.

## Texto, memória e testes

A projeção mantém seu único campo de fala e seu texto original. As animações tipográficas desenham uma representação separada e descartável. O tempo visual não depende da quantidade de texto ou da latência do modelo. O áudio existente é procedural; não há novo TTS ou alinhamento por palavra.

Em **05 — Memória**, textos e entrevistas podem ser colados ou importados como `.txt`/`.md`. São opcionais. O efeito de recuperação de documentos seleciona memória editorial local por palavras relacionadas à carta/pergunta. Efeitos narrativos entram na próxima resposta textual solicitada, sem chamadas automáticas adicionais; documentos nunca são apresentados como nova percepção visual. A conversa e o perfil principal continuam compartilhados.

A prévia usa os mesmos renderizadores da apresentação e permite carta, rosto, preset, efeito isolado e posição temporal. Não abre câmera, não chama o modelo e não altera contagem ou conversa. O slider de mistura da prévia é local; o da seção 07 configura o espetáculo.

## Validação e limites

- `test:tarot:hallucination:controls`: servidor isolado via `CAIXA_PRETA_TAROT_TEST_URL`; reproduz seis cartas contadas e filtro restrito ao arcano 2, valida avisos e a remoção explícita do filtro sem alterar relógio/efeitos.
- `test:tarot:hallucination`: relógio, 45 s, retornos, repetições, gates independentes, mistura, intervenção manual, retirada, privacidade e recuperação.
- `test:tarot:hallucination:browser`: requer `CAIXA_PRETA_TAROT_TEST_URL` de servidor isolado (recusa porta 3000); percorre preparação real das oito fotos, detecção de duas pessoas, cache, fusões, mistura 0–100%, prévia, aprovação e timeline; confirma fusão acompanhando a carta em vídeo sintético e limpeza na retirada. Evidências em `/private/tmp/tarot-hallucination-evidence`.
- Passaram reconhecimento das 22 cartas (`test:tarot:vision`), catálogo, experiência, `test:tarot`, `test:tarot:browser`, os novos testes de alucinação, confiabilidade do show, áudio procedural, warmup, lint focado, build de produção isolada e `brain:sync/check`. O teste integrado usa vídeo sintético e transporte textual simulado; não comprova câmera física nem modelo real.

No primeiro ensaio Chromium neste Mac, as oito fotos produziram oito rostos em **0,70 s**, incluindo inicialização local. As 22 primeiras combinações geométricas levaram aproximadamente **5–7 ms de cálculo por combinação**, além de leitura/gravação e revisão humana. É uma medição deste lote; não é uma promessa fixa para fotografias maiores, grupos ou outro dispositivo. Na versão de mistura ajustável, as 22 fusões foram preparadas em **0,53 s no total**, com 4,5–19,7 ms de cálculo por combinação. Nenhuma foi aprovada automaticamente.

Permanecem necessários o ensaio de câmera física, reflexos, Safari/iOS, áudio e projetor, e a aprovação artística das combinações. Não se valida qualidade de fusão pela passagem dos testes automatizados. Não há novas chamadas pagas: detecção, landmarks, malha, máscaras, cache, timeline, efeitos e prévia são locais; somente as respostas do chatbot usam o cliente de linguagem existente.
