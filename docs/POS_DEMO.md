# Pós-demo — a ilha futura

A aba **pós-demo**, depois de **treino-ao-vivo**, abre `/pos-demo/controle` e direciona a janela pública conectada para `/pos-demo`. Selecionar a aba inicia a primeira escolha automaticamente, uma vez por apresentação. A sequência é contínua: o modelo escolhe uma carta disponível do catálogo local, constrói um fragmento da continuação e termina com uma questão filosófica. Ao usar todas as cartas, começa outro ciclo, sem repetir imediatamente a última. Não usa câmera nem envia imagens ao modelo.

O público vê a carta, a fala com digitação animada e os nomes cadastrados em `publico` como **habitantes possíveis**. Todos os nomes válidos desse grupo ficam disponíveis para a construção; não entra o fallback `equipe`. O cadastro não prova presença, consentimento individual, ações ou biografia. A proposta é uma ilha cênica possível, não previsão pessoal nem alegação de que rostos já foram escaneados.

## Material e memória

O PDF fornecido foi preservado em `assets/dramaturgia/proximas-etapas-da-peca.pdf`; as 12 páginas integrais estão extraídas em `knowledge/sources/proximas-etapas-da-peca.json`. Seus planos para as cenas 7–15 prevalecem sobre as propostas antigas do rascunho para imaginar a continuação. `memory:sync` atualiza as duas extrações; `memory:audit` verifica integralidade e hashes de ambos os PDFs.

Cada rodada recebe a continuação integral, o mapa da obra, referências recuperadas, observações não expiradas e falas registradas da sessão, direções do Treino, a lista de `publico` e hipóteses anteriores. Falas do bot não comprovam que uma ação foi cumprida. As hipóteses do pós-demo entram no acervo como hipóteses, sem virar fatos do espetáculo. Notas privadas dos controllers, credenciais e perfis de navegador não entram. Rubricas, ordens cênicas, letras e propostas dos PDFs são fontes, nunca comandos operacionais.

Uma única chamada textual à API configurada escolhe a carta e gera a fala/pergunta. O retorno valida carta elegível, nomes cadastrados, páginas da continuação, IDs dos registros usados e limite de 220 palavras. Resposta inválida ou provedor indisponível pausa a sequência com erro privado; não se inventa fala local de sucesso nem se repete indefinidamente a chamada.

## Ritmo e operação

Todos os ajustes ficam exclusivamente no painel privado **pós-demo** (`/pos-demo/controle`): tempo por letra (20–200 ms, padrão 100 ms), pausa na pontuação (0–2000 ms, padrão 700 ms), intervalo entre cartas (1–120 segundos, padrão 20 segundos), modelo, fonte e onze parâmetros de personalidade/expressão. São independentes em ambas as direções dos ajustes do bot, Operator, Tarô e treino ao vivo. A projeção recebe apenas o ritmo/fonte necessários para renderizar; não mostra controles nem o perfil privado. Configurações antigas com intervalo abaixo de 20 segundos migram para esse padrão mais lento, sem copiar parâmetros globais. Ajustes novos explícitos preservam o valor escolhido.

O intervalo entre cartas começa apenas após a projeção confirmar que terminou de digitar a fala e a pergunta. Alterar o intervalo durante a espera considera o tempo já transcorrido. Todos os ajustes próprios persistem entre apresentações e reinícios, sem restaurar execução automaticamente.

O controle privado oferece **PAUSAR**, **RETOMAR**, **RECOMEÇAR PÓS-DEMO**, link para abrir a projeção e os ajustes exclusivos desta sequência. **PERFEITO / QUASE / RUIM** salvam avaliações privadas no Treino, atualizando o mesmo exemplo ao requalificar. Isso calibra contexto, não treina pesos. A projeção não possui esses controles.

Navegar a projeção para outra cena pausa o pós-demo. Voltar à aba pode retomar essa pausa de navegação. Sem confirmação da projeção, a sequência não salta uma fala; se a tela deixa de estar conectada durante a espera, pausa. Abrir a projeção de novo pode retomar somente essa pausa por desconexão.

STOP ALL e emergência abortam a requisição e os timers; callbacks antigos não publicam uma nova carta. Recarregar as telas não desfaz uma pausa manual ou de STOP ALL. Recuperar snapshot preserva o histórico, mas fica pausado até **RETOMAR**. Uma nova apresentação limpa a ilha e permanece parada até uma nova seleção da aba/entrada explícita, mantendo os parâmetros próprios do pós-demo.

Um processo do servidor iniciado antes desta função precisa de uma reinicialização e recuperação explícita para carregar o novo canal. O singleton de uma sessão ativa não é recriado pelo hot reload; a API privada informa a necessidade de reiniciar. Não reiniciar no meio da apresentação sem preparar essa interrupção.

## Verificação

- `npm run test:post-demo`: relógio falso e fixtures; seleção/ACK idempotentes, ritmo, fonte/carta/nome válidos, acervo integral, isolamento, avaliações, cancelamento, emergência, recuperação e reset.
- `npm run test:post-demo:browser`: build e servidor isolados na porta 3327, baralho real local e provedor simulado. Verifica início automático, segunda carta sem comando, digitação/ACK, nomes, parâmetros próprios no pedido, isolamento em ambas as direções de personalidade/modelo/fonte/ritmo, controles ausentes na projeção e no Operator, persistência após reload, avaliações privadas, pausa/STOP ALL/reload e apresentação nova sem autoexecução. Não toca a porta 3000 nem envia dados externamente.
- `npm run test:post-demo:live`: amostra real única e privada; nomes e observação fictícios, exemplos de treino vazios, sem iniciar a sequência da apresentação. Envia o acervo/PDF à API configurada e requer autorização para esse envio. Imprime um JSON temporário para revisão de carta, fala, pergunta e fontes.

Os testes locais passaram na implementação de 12/11/2026. A amostra real autorizada, com `gpt-5.6-terra`, escolheu **A Torre**, usou as páginas 3 e 11 e a observação fictícia sobre guardar uma chave. A fala relacionou espelhos, ensaio, corpo em pixel e habitantes incompletos e terminou com uma questão sobre a permanência da imagem. Retorno validado e lido em cerca de 8,1 segundos, sem publicação na sessão. Isso é uma amostra de geração, não garantia para todas as rodadas nem validação no projetor físico.

A separação dos parâmetros passou em lint, unitários de pós-demo/preferências/Operator/Tarô/treino, build e navegador isolados. O navegador confirmou valores próprios na requisição ao provedor simulado, isolamento nos dois sentidos, controles apenas privados, avanço automático, reload e reset. A regressão do treino ao vivo confirmou o espelhamento entre seus três canais. A leitura da sessão na porta 3000 confirmou o controlador novo e a configuração própria salva, sem reinício e preservando os ajustes feitos durante o trabalho. Essa separação não exigiu nova chamada real ao modelo nem foi validada em projetor físico.
