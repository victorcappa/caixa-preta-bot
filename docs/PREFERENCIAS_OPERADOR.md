# Preferências persistentes do operador

Os valores atuais dos controles são configurações locais do projeto, independentes do snapshot de recuperação da apresentação. Cada alteração de configuração é gravada automaticamente em `.runtime/show/operator-preferences.json`; se `CAIXA_PRETA_SHOW_RUNTIME_DIR` estiver definido, o arquivo fica nesse diretório. O arquivo é privado (permissão 0600), tem versão/checksum e é substituído atomicamente após a gravação. Não entra no Git.

O salvamento usa os valores reais de `showState`, sem substituir pelos padrões do código. Eventos que só mudam história, contagem ou execução não regravam preferências. `/operator` e o cabeçalho do controle TARÔ mostram a confirmação e a data do último salvamento. Uma falha de gravação é reportada em vez de receber confirmação de sucesso.

## O que permanece

| Grupo | Configurações preservadas |
| --- | --- |
| Operador | Personalidade, modelo, parâmetros de som, velocidade/pausa/intervalo de digitação, fonte, frequência dos cliques e volume global. |
| Composição pública | Posição/tamanho de cada módulo e cor dos textos públicos do Operator. |
| Tarô | Configuração de leitura/autonomia, visual/Matrix, perfil complementar, instrução privada, referências e temas, contexto contemporâneo, câmera escolhida e modo automático. |
| Alucinação | Chaves gerais, limite de cartas, filtros, política de retirada, efeitos, intensidades, mistura facial, eventos da timeline, presets e memórias/entrevistas vinculadas. |
| Outros controles de estado | Parâmetros/preset/áudio do glitch e transição, intensidade dos shaders, volume do sampler, texto/subdivisão/ritmo/fade/modos da Queda Avião, orientação de personalidade e som do BIOS, opções de aquecimento e configuração de pesquisa. |
| Cadastros existentes | Catálogo, fotos, fusões/aprovações, cues, notas e configurações individuais do sampler continuam em seus arquivos existentes. Não são substituídos por esta camada. |

O mesmo conjunto é mantido em **REINICIAR TREINAMENTO**, **INICIAR NOVA APRESENTAÇÃO**, `/reset` e ao abrir outro processo do servidor. Recuperar uma apresentação antiga usa seu histórico/progresso, mas preserva os ajustes mais recentes do operador.

Não são preferências: conversa/rascunho, participantes, etapa/carta atual, malas abertas, contagens, progresso do BIOS, posição de timers/timeline, reprodução de áudio/vídeo, conexões de telas/câmera ou ações externas. Uma nova apresentação e um novo processo começam com execução limpa. Habilitar uma opção de autonomia não inicia sozinho uma apresentação; as autorizações e os controles de início existentes continuam valendo. Aprovações de fusões permanecem no cadastro local, sem aprovação automática de combinações pendentes.

## Captura dos valores e ativação

`POST /api/operator-preferences` com `action: "save-current"` e a sessão atual grava os valores ativos, sem alterar história, execução ou o ponto de recuperação anterior. O endpoint só aceita a sessão correta e mesma origem; não recebe valores arbitrários para substituir o estado. `GET` retorna apenas confirmação/data/erro e se o processo já está usando o novo salvamento automático.

A captura inicial desta mudança foi feita diretamente da sessão ativa em 16/10/2026. Foi encontrada uma diferença entre a sessão ao vivo e o snapshot antigo em disco; os parâmetros atuais foram capturados das APIs locais e depois novamente do `privateSnapshot` do processo ativo, nunca do snapshot antigo. O arquivo de preferências já foi gravado com esses valores.

Um processo aberto antes de existir a integração precisa de uma reinicialização para instalar o salvamento automático e a preservação no reset. A interface distingue **valores já salvos** de **processo pronto**. O hot reload compatível troca somente o adaptador de persistência; não recria a sessão nem seus listeners.

## Verificação

```bash
npm run test:operator-preferences
npm run test:operator-preferences:browser
```

O primeiro verifica gravação exata, exclusão de execução/história, arquivos privados/atômicos, erros de gravação/corrupção, reset do Tarô, nova apresentação, recuperação de snapshot antigo e leitura por outro processo Node. O teste de navegador usa build/servidor isolados na porta 3319, altera valores pelas APIs reais, confere o aviso na interface e para/reabre esse servidor para confirmar a carga automática. Não faz chamadas ao modelo nem opera a porta 3000.

Na implementação de 16/10/2026 passaram os sete grupos do teste de preferências, hot refresh de som, regressões Tarô/alucinação e confiabilidade, lint focado e build isolado. A execução HTTP/Playwright passou em `/private/tmp/operator-preferences-evidence-wAE4eh/report.json`, com capturas do operador e do Tarô após reinício. Isso valida persistência local; não é ensaio de hardware ou validação de geração de IA.

A verificação final na porta 3000 confirmou `runtimeReady: true` e igualdade entre os valores ativos e o arquivo de preferências. As alterações feitas durante o trabalho foram preservadas; a sessão ativa não foi resetada pelos testes de persistência.
