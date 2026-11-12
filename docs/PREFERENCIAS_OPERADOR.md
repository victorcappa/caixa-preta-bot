# Preferências persistentes do operador

Os valores atuais dos controles são configurações locais do projeto, independentes do snapshot de recuperação da apresentação. Cada alteração de configuração é gravada automaticamente em `.runtime/show/operator-preferences.json`; se `CAIXA_PRETA_SHOW_RUNTIME_DIR` estiver definido, o arquivo fica nesse diretório. O arquivo é privado (permissão 0600), tem versão/checksum e é substituído atomicamente após a gravação. Não entra no Git. Opções que antes existiam só no formulário ficam em `.runtime/show/controller-settings.json`, também privado e substituído atomicamente, no mesmo diretório configurável. A carga funciona também num navegador novo; não depende de recuperar a apresentação anterior.

O salvamento usa os valores reais de `showState`, sem substituir pelos padrões do código. Eventos que só mudam história, contagem ou execução não regravam preferências. `/operator` e o cabeçalho do controle TARÔ mostram a confirmação e a data do último salvamento. Uma falha de gravação é reportada em vez de receber confirmação de sucesso.

## O que permanece

| Grupo | Configurações preservadas |
| --- | --- |
| Operador / bot global | Onze parâmetros de personalidade espelhados em Operator, Tarô e treino ao vivo; modelo, som, velocidade/pausa/intervalo de digitação, fonte, cliques e volume global. |
| Composição pública | Posição/tamanho de cada módulo e cor dos textos públicos do Operator. |
| Tarô | Configuração de leitura/autonomia, visual/Matrix, instrução privada, referências e temas, contexto contemporâneo, câmera escolhida e modo automático. |
| Alucinação | Chaves gerais, limite de cartas, filtros, política de retirada, efeitos, intensidades, mistura facial, eventos da timeline, presets e memórias/entrevistas vinculadas. |
| Pós-demo | Digitação, pausas, intervalo entre cartas, modelo, fonte e onze parâmetros próprios; preset da nuvem, tempos/distâncias de entrada, passeio/giro, retomada após gesto manual e todos os ajustes de shader/pontos. São ajustados somente no controle pós-demo, sem espelhamento com o bot/Tarô. Histórico, carta atual, referência à nuvem e execução do passeio pertencem apenas à sessão. |
| Outros controles de estado | Parâmetros/preset/áudio do glitch e transição, intensidade dos shaders, volume do sampler, texto/subdivisão/ritmo/fade/modos da Queda Avião, orientação de personalidade e som do BIOS, opções de aquecimento, duração de cada minigame, filtro de participantes e configuração de pesquisa. |
| Opções dos formulários | Estado recolhido/aberto do painel pós-demo; qualidade e remoção de fundo do modelo 3D; arquivo/loop do vídeo de glitch; arquivo/loop/transição no controller da Cena Zero; carta e modo da busca de referências. |
| Cadastros existentes | Catálogo, fotos, fusões/aprovações, cues, notas e configurações individuais do sampler continuam em seus arquivos existentes. Botões, atalhos, texto, cor, arquivo, duração, volume e loop dos samplers editáveis agora são salvos automaticamente, sem depender de SALVAR AGORA. Pedais e volume/loop por item do Força G também persistem. Não são substituídos por esta camada. |

O mesmo conjunto é mantido em **REINICIAR TREINAMENTO**, **INICIAR NOVA APRESENTAÇÃO**, `/reset` e ao abrir outro processo do servidor. Recuperar uma apresentação antiga usa seu histórico/progresso, mas preserva os ajustes mais recentes do operador.

Nos canais compartilhados, os valores existentes não são migrados para padrões: os quatro controles principais continuam em `operatorPublic.personality` e os sete de expressão em `tarot.profile`, consumidos pelos canais principais, Operator, Tarô e treino ao vivo. O pós-demo usa `postDemo.config`, independente desse conjunto. As três telas reutilizam o mesmo painel e endpoint de parâmetros. A leitura privada não inclui notas, instruções nem histórico; o perfil não foi acrescentado à projeção pública. **RESTAURAR PERFIL** coloca os sete ajustes de expressão em 50 nas três telas compartilhadas. No pós-demo, esse botão restaura apenas seu perfil próprio.

O painel privado da nuvem salva os valores em `postDemo.config.pointCloud`, dentro do mesmo arquivo de preferências. Isso inclui a escolha entre sete presets, movimento automático, tempos no escuro/revelação/passeio, distâncias inicial/final, amplitudes, giro, espera após navegação manual, respiração, luz, realces, oscilação, defasagem, tamanho dos pontos e brilho. O padrão é **Revelar e passear**: 2 segundos de zoom-in no escuro, 18 segundos de revelação com afastamento e depois passeio contínuo de 48 segundos por ciclo. Valores já escolhidos prevalecem nas sessões seguintes.

Os controles da nuvem só aparecem em `/pos-demo/controle`; a projeção recebe a referência `{id, url}` e, em `cloudPresentation`, apenas os ajustes de renderização e o token/data do passeio. Alterar sliders aplica-se ao vivo sem recriar canvas/geometria. Período do pulso e velocidade da oscilação conservam a fase durante a mudança. **Reiniciar passeio** (`cloud-replay`) e selecionar outro preset reiniciam somente a câmera, mantendo cartas, foto convertida e parâmetros. **RESET** reinicia cartas e passeio, preservando esses ajustes. São ações de execução, distintas das preferências salvas. Escopo e operação: [POST_DEMO_POINT_CLOUD.md](POST_DEMO_POINT_CLOUD.md).

Reset da BIOS e retorno ao teste de som preservam os ajustes do aquecimento e o som da BIOS. A emergência pausa as rotinas e limpa a mídia ativa sem substituir os valores escolhidos por padrões. Texto de orientação persistente e instrução privada do Tarô salvam enquanto são editados; a instrução já salva volta ao campo quando o controle é aberto. Filas serializam alterações rápidas e enviam o último ajuste ao sair da aba. Uma falha de gravação aparece no controle, sem confirmação falsa de sucesso.

Salvar parâmetros durante o modo manual não avança fala/etapa, não substitui o avanço pendente nem reinicia o timer. A escolha de modo manual permanece salva; avanço e retorno continuam pelos mesmos controles e atalhos. `test:audience-warmup:transition` intercala ajustes de digitação, personalidade, pós-demo, intervalo e gravação em disco com esperas manuais e confirma que somente o comando de avanço libera a próxima etapa.

Não são preferências: conversa/rascunho, participantes, etapa/carta atual, malas abertas, contagens, progresso do BIOS, posição de timers/timeline, reprodução de áudio/vídeo, referência à nuvem da sessão, token/data e ponto atual do passeio, enquadramento escolhido por gesto do mouse, conexões de telas/câmera ou ações externas. Uma nova apresentação e um novo processo começam com execução limpa. Habilitar uma opção de autonomia não inicia sozinho uma apresentação; as autorizações e os controles de início existentes continuam valendo. Aprovações de fusões permanecem no cadastro local, sem aprovação automática de combinações pendentes.

## Captura dos valores e ativação

`POST /api/operator-preferences` com `action: "save-current"` e a sessão atual grava os valores ativos, sem alterar história, execução ou o ponto de recuperação anterior. O endpoint só aceita a sessão correta e mesma origem; não recebe valores arbitrários para substituir o estado. `GET` retorna apenas confirmação/data/erro e se o processo já está usando o novo salvamento automático.

A captura inicial desta mudança foi feita diretamente da sessão ativa em 16/10/2026. Foi encontrada uma diferença entre a sessão ao vivo e o snapshot antigo em disco; os parâmetros atuais foram capturados das APIs locais e depois novamente do `privateSnapshot` do processo ativo, nunca do snapshot antigo. O arquivo de preferências já foi gravado com esses valores.

Um processo aberto antes de existir a integração precisa de uma reinicialização para instalar o salvamento automático e a preservação no reset. A interface distingue **valores já salvos** de **processo pronto**. O hot reload compatível troca somente o adaptador de persistência; não recria a sessão nem seus listeners.

## Verificação

```bash
npm run test:controller-settings
npm run test:operator-preferences
npm run test:operator-preferences:browser
npm run test:post-demo:point-cloud:motion
npm run test:post-demo:point-cloud:controls
```

O primeiro verifica gravação exata, exclusão de execução/história, arquivos privados/atômicos, erros de gravação/corrupção, reset do Tarô, nova apresentação, recuperação de snapshot antigo e leitura por outro processo Node. O teste de navegador usa build/servidor isolados na porta 3319, altera valores pelas APIs reais, confere o aviso na interface e para/reabre esse servidor para confirmar a carga automática. Agora também verifica edição automática de nome/duração/volume dos cues sem clicar em salvar, envio pendente ao navegar, opções em navegador novo e persistência depois de reiniciar o processo isolado. A geração 3D é interceptada e não é executada. Não faz chamadas ao modelo nem opera a porta 3000.

Os testes de movimento e controles da nuvem cobrem os caminhos dos presets, a entrada escura, os ajustes privados ao vivo e sua sincronização/persistência, incluindo o reinício do passeio sem alterar as cartas. Em 12/11/2026 passaram os testes dos sete presets e dos controles no Chromium isolado, com sincronização sem recriar o canvas, replay preservando cartas/modo manual e shader contínuo. A persistência dos ajustes da nuvem também passou na nova sessão e em processo Node separado. Evidência atual: [POST_DEMO_POINT_CLOUD.md](POST_DEMO_POINT_CLOUD.md). Os resultados históricos abaixo pertencem às versões anteriores.

Para os parâmetros compartilhados, `npm run test:live-training:browser` abre Operator, Tarô e treino ao vivo simultaneamente. Verifica edições nas três origens, campos distintos alterados concorrentemente, reload, separação pública/privada e valores efetivamente enviados ao provedor simulado. Em 12/11/2026 passou com lint, unitários de Operator/Tarô/treino, persistência e brain check. A auditoria ampla `test:operator-public:browser` encontrou recorte do envio público em 1280×720; a mesma falha foi reproduzida num build anterior, cujos controles/painel/CSS públicos correspondem ao código anterior a esta alteração. Isso não bloqueia o espelhamento, mas essa auditoria ampla não está integralmente aprovada. Sem validação de modelo real ou projetor físico nesta mudança.

Na implementação de 16/10/2026 passaram os sete grupos do teste de preferências, hot refresh de som, regressões Tarô/alucinação e confiabilidade, lint focado e build isolado. A execução HTTP/Playwright passou em `/private/tmp/operator-preferences-evidence-wAE4eh/report.json`, com capturas do operador e do Tarô após reinício. Isso valida persistência local; não é ensaio de hardware ou validação de geração de IA.

A verificação final na porta 3000 confirmou `runtimeReady: true` e igualdade entre os valores ativos e o arquivo de preferências. As alterações feitas durante o trabalho foram preservadas; a sessão ativa não foi resetada pelos testes de persistência.

A ampliação de 12/11/2026 inclui regressões para reset da BIOS, emergência, filtro de participantes e duração dos minigames, além dos valores próprios do pós-demo. `test:controller-settings` verifica as opções por tela em processo novo, arquivo privado, campos aceitos, fila serializada, repetição após falha e volume/loop por item do sampler. Confirmações de envio/compra/geração e arquivos selecionados para upload continuam sendo ações de cada uso, sem autorização automática na sessão seguinte.
