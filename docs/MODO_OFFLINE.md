# Proposta de continuidade sem internet

Status: **PROPOSTA NÃO IMPLEMENTADA**. Auditoria do checkout em 13/11/2026; os fatos abaixo foram confirmados por inspeção de código, sem ensaio físico de desconexão.

## Objetivo e limite

Manter a operação local da peça e oferecer falas úteis quando a internet ou o provedor de IA ficar indisponível. A queda da internet deve poder ser tratada sem parar cenas, áudio e controles que funcionam localmente.

Esta proposta cobre perda da conexão externa com o servidor local ainda acessível. A perda da rede local, o encerramento do servidor e a falta de energia são falhas diferentes. No mesmo computador, as telas acessam `localhost`; em outros dispositivos, a conexão com o computador de apresentação ainda depende da LAN.

## CONFIRMADO por inspeção

| Canal/recurso | Comportamento atual sem serviço externo | Limite observado |
| --- | --- | --- |
| Runtime, controles e mídia local | Next em `localhost:3000`; mídia servida do disco; estado no servidor e distribuição por SSE. | Continuidade física de todas as cenas ainda não foi ensaiada sem WAN. |
| Chat principal | Falhas entram no fluxo normal de fala com repertório local. | São 27 frases em nove contextos; não há conversa aberta baseada no acervo. Cada turno pode voltar a esperar pelo provedor. |
| Conversa lateral do Operator | Uma fala de contingência e outra de retorno à peça. | Um stream interrompido pode deixar texto parcial no histórico e na projeção. |
| Treino ao vivo | Histórico e avaliações são locais. | Geração indisponível termina com erro 503; não existe resposta local. |
| Tarô | Catálogo, reconhecimento e recuperação de referências são locais. | A leitura depende do provedor; a falha é explícita, sem leitura gravada silenciosa. |
| Atualidades do aquecimento | Cache em disco, exclusão de edição vencida e ações temáticas permanentes. | Não produz notícias novas sem pesquisa externa. |
| Pesquisa, Instagram e geração externa | Dependem dos serviços correspondentes. | Não podem ser apresentados como ações realizadas durante indisponibilidade. |

No chat principal, o prazo padrão de uma chamada é 8 segundos, configurável entre 1 e 15 segundos. Não foi identificado um circuito de indisponibilidade que evite novas tentativas em cada turno. O diagnóstico de internet consulta o Google; ele não comprova a disponibilidade do provedor de IA nem aciona failover.

O **MODO EMERGÊNCIA** existente cancela chamadas, pausa automações e emite `stop-all`. Ele permanece um recurso independente: não deve ser ativado automaticamente por uma queda da internet. Sua autoridade e seu comportamento devem ser preservados.

## HIPÓTESE / desenho proposto

1. Criar uma preferência privada `automático / online / offline`, com estado operacional no servidor. Emergência tem precedência. O modo offline deve desviar antes de tentar a rede, preservando a execução local.
2. Centralizar a seleção de resposta por canal: provedor online → provedor local opcional → repertório editorial determinístico. O último recurso continua disponível mesmo se um futuro modelo local falhar.
3. No modo automático, usar o resultado real do serviço, prazo limitado, circuito aberto durante indisponibilidade e uma tentativa controlada de recuperação. Não depender apenas de `navigator.onLine` ou do probe Google.
4. Preservar `showState`, SSE, histórico, identificadores de pedido, cancelamento, sessão, STOP ALL e o fluxo atual de digitação/áudio. Não criar uma autoridade paralela no navegador.
5. Mostrar diagnóstico, motivo da troca e controle do provedor apenas na área privada. Falas públicas continuam cênicas; não expõem configuração, logs ou notas privadas.
6. Na volta da rede, concluir apenas pedidos atuais. Não reenviar perguntas, repetir falas, recuperar comandos cancelados ou retomar ações externas antigas.
7. Definir a conclusão de streams cortados por canal. Não marcar uma frase interrompida como resposta completa; preservar a possibilidade de cancelamento e retomada consciente.

## Etapas recomendadas

### MVP: continuidade editorial e operação local

- Implementar seleção manual e circuito automático, sem modificar o fluxo de emergência.
- Ampliar o repertório por cena/intenção, com variação e controle de repetição. Reutilizar exemplos aprovados somente quando houver adequação editorial; similaridade lexical não basta.
- Disponibilizar um controle privado para escrever e publicar uma fala, reutilizando o mesmo estado e apresentação pública.
- Cobrir chat principal, Operator e treino ao vivo. Para o Tarô, definir uma alternativa editorial específica e explícita ou manter a falha com nova tentativa; nunca substituir silenciosamente a leitura por uma frase genérica.
- Desabilitar ferramentas externas no offline, preservar conteúdo local válido e comunicar a limitação ao operador.

### Etapa posterior: conversa com modelo local

- Medir memória, carga simultânea, tempo de resposta e qualidade em português no computador real de apresentação.
- Integrar um provedor local ao mesmo adaptador, aproveitando acervo e recuperação locais existentes.
- Validar personalidade, fidelidade à dramaturgia, fronteira pública/privada e limites de cada canal. Não escolher modelo ou prometer latência antes dessa avaliação.
- Manter o repertório determinístico e a fala escrita pelo operador como contingência final.

## Pontos de implementação

- Requisições, prazos e interrupção: `lib/externalRequestControl.js`.
- Geração e fallback principal: `lib/openai.js`, `lib/showFallback.js`, `/api/chat`.
- Conversa lateral: `/api/operator-public` e `beginOperatorGeneration` / `finishOperatorGeneration` em `lib/showState.js`.
- Treino: `/api/live-training`, `lib/liveTraining.js`, `lib/liveTrainingContext.js`.
- Tarô: `lib/tarot/service.js`, `lib/tarot/narrative.js`, `lib/tarot/references.js`.
- Estado e diagnóstico: `lib/showState.js`, `/api/reliability`, `/api/health`, `lib/showHealth.js`.
- Transporte entre telas: `lib/publicRealtime.js`; manter o contrato existente.

## Critérios de aceitação

**Validação simulada, isolada:** falha antes da resposta, stream cortado, timeout, 429/5xx, várias mensagens offline, recuperação, múltiplas janelas, cancelamento, STOP ALL, emergência e reinício. Confirmar ausência de duplicação, espera sem limite e chamadas externas no modo offline forçado. Medir e registrar os tempos de resposta por canal.

Os cenários devem bloquear as saídas externas do servidor e preservar `localhost`/LAN. Colocar apenas o navegador em offline testa perda de acesso ao servidor, uma falha diferente. Usar fixture/servidor isolado, sem resetar ou reiniciar uma apresentação em andamento.

Checks existentes úteis: `test:show-reliability`, `test:show-reliability:scenario`, `test:openai:failures` e `test:public-realtime:browser`. Ler os requisitos de cada script: alguns ocupam a porta 3000 e não podem rodar durante o espetáculo.

**DESCONHECIDO / aceitação física:** com o build preparado, desconectar a WAN mantendo a LAN; ensaiar a continuidade das cenas, áudio, recarga das telas, comandos e dispositivo remoto. Depois restaurar a WAN e verificar ausência de repetição ou retomada indevida. Registrar também um teste separado de perda da LAN. Inspeção de código e simulações não substituem esse ensaio.
