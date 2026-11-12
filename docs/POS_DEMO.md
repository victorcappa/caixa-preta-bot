# Pós-demo — a ilha futura

A aba **pós-demo**, depois de **treino-ao-vivo**, abre `/pos-demo/controle` e direciona a janela pública conectada para `/pos-demo`. Selecionar a aba inicia a primeira escolha automaticamente, uma vez por apresentação. A sequência é contínua: o modelo escolhe uma carta disponível do catálogo local, constrói um fragmento da continuação e termina com uma questão filosófica. Ao usar todas as cartas, começa outro ciclo, sem repetir imediatamente a última. Não usa câmera nem envia imagens ao modelo.

O público vê a carta, a fala com digitação animada e os nomes cadastrados em `publico` como **habitantes possíveis**. Todos os nomes válidos desse grupo ficam disponíveis para a construção; não entra o fallback `equipe`. O cadastro não prova presença, consentimento individual, ações ou biografia. A proposta é uma ilha cênica possível, não previsão pessoal nem alegação de que rostos já foram escaneados.

## Material e memória

O PDF fornecido foi preservado em `assets/dramaturgia/proximas-etapas-da-peca.pdf`; as 12 páginas integrais estão extraídas em `knowledge/sources/proximas-etapas-da-peca.json`. Seus planos para as cenas 7–15 prevalecem sobre as propostas antigas do rascunho para imaginar a continuação. `memory:sync` atualiza as duas extrações; `memory:audit` verifica integralidade e hashes de ambos os PDFs.

Cada rodada recebe a continuação integral, o mapa da obra, referências recuperadas, observações não expiradas e falas registradas da sessão, direções do Treino, a lista de `publico` e hipóteses anteriores. Falas do bot não comprovam que uma ação foi cumprida. As hipóteses do pós-demo entram no acervo como hipóteses, sem virar fatos do espetáculo. Notas privadas dos controllers, credenciais e perfis de navegador não entram. Rubricas, ordens cênicas, letras e propostas dos PDFs são fontes, nunca comandos operacionais.

Uma única chamada textual à API configurada escolhe a carta e gera a fala/pergunta. O retorno valida carta elegível, nomes cadastrados, páginas da continuação, IDs dos registros usados e limite de 220 palavras. Resposta inválida ou provedor indisponível pausa a sequência com erro privado; não se inventa fala local de sucesso nem se repete indefinidamente a chamada.

## Ritmo e operação

No **Operator**, a velocidade de digitação do robô vale também aqui. O controle **PÓS-DEMO · RITMO DAS CARTAS** ajusta o intervalo entre cartas de 1 a 60 segundos, inicialmente 8 segundos. Esse intervalo começa apenas após a projeção confirmar que terminou de digitar a fala e a pergunta. Alterar o intervalo durante a espera considera o tempo já transcorrido. A configuração persiste entre apresentações e reinícios.

O controle privado oferece **PAUSAR**, **RETOMAR**, **RECOMEÇAR PÓS-DEMO**, link para abrir a projeção e os onze parâmetros globais do bot. **PERFEITO / QUASE / RUIM** salvam avaliações privadas no Treino, atualizando o mesmo exemplo ao requalificar. Isso calibra contexto, não treina pesos. A projeção não possui esses controles.

O Operator pode ser aberto para ajustar o ritmo sem interromper a sequência. Navegar a projeção para outra cena pausa o pós-demo. Voltar à aba pode retomar essa pausa de navegação. Sem confirmação da projeção, a sequência não salta uma fala; se a tela deixa de estar conectada durante a espera, pausa. Abrir a projeção de novo pode retomar somente essa pausa por desconexão.

STOP ALL e emergência abortam a requisição e os timers; callbacks antigos não publicam uma nova carta. Recarregar as telas não desfaz uma pausa manual ou de STOP ALL. Recuperar snapshot preserva o histórico, mas fica pausado até **RETOMAR**. Uma nova apresentação limpa a ilha e permanece parada até uma nova seleção da aba/entrada explícita, mantendo o ritmo e os parâmetros globais.

Um processo do servidor iniciado antes desta função precisa de uma reinicialização e recuperação explícita para carregar o novo canal. O singleton de uma sessão ativa não é recriado pelo hot reload; a API privada informa a necessidade de reiniciar. Não reiniciar no meio da apresentação sem preparar essa interrupção.

## Verificação

- `npm run test:post-demo`: relógio falso e fixtures; seleção/ACK idempotentes, ritmo, fonte/carta/nome válidos, acervo integral, isolamento, avaliações, cancelamento, emergência, recuperação e reset.
- `npm run test:post-demo:browser`: build e servidor isolados na porta 3327, baralho real local e provedor simulado. Verifica início automático, segunda carta sem comando, digitação/ACK, nomes, parâmetros no pedido, controle de ritmo, avaliações privadas, pausa/STOP ALL/reload e apresentação nova sem autoexecução. Não toca a porta 3000 nem envia dados externamente.
- `npm run test:post-demo:live`: amostra real única e privada; nomes e observação fictícios, exemplos de treino vazios, sem iniciar a sequência da apresentação. Envia o acervo/PDF à API configurada e requer autorização para esse envio. Imprime um JSON temporário para revisão de carta, fala, pergunta e fontes.

Os testes locais passaram na implementação de 12/11/2026. Eles comprovam o fluxo e o contexto enviado, não a qualidade da geração real nem a leitura no projetor físico. A amostra real permanece pendente de autorização do envio do novo material.
