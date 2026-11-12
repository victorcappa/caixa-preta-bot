# Treino ao vivo

A aba **treino-ao-vivo**, ao lado de **Treino**, abre `/treino-ao-vivo/controle`. A projeção fica em `/treino-ao-vivo`: uma conversa pública, com digitação animada e três alternativas quando solicitadas. Ao selecionar a aba, a janela pública conectada recebe esse destino pelo sistema de projeção existente.

No controle, escreva e pressione Enter ou **ENVIAR**. Shift+Enter quebra a linha. Cada resposta e alternativa tem apenas quatro ações de qualificação: **PERFEITO**, **QUASE**, **RUIM** e **GERAR ALTERNATIVAS**. As avaliações são privadas; a conversa e as alternativas aparecem para o público. A página pública não possui campo de envio nem controles de avaliação.

As três avaliações salvam imediatamente em `data/training-examples.json`, sem exigir correção escrita. Requalificar uma resposta atualiza o mesmo exemplo. Esses exemplos também aparecem no Treino existente. PERFEITO fornece uma direção aprovada; QUASE e RUIM orientam ajustes sem recomendar como preferida uma resposta negativa que não recebeu correção. Isso calibra o contexto das próximas gerações; não altera os pesos do modelo.

## Repertório

As seis bases de `knowledge/` são enviadas integralmente: universo, dramaturgia, chatbot, personagens, conceitos e glossário. A recuperação local também consulta todo o arquivo `assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md`, os textos de `data/controller-cues.json` e o repertório autoral de BIOS, aquecimento e malas. Conversas públicas da apresentação, histórico deste canal, observações da sessão e memórias textuais habilitadas do Tarô entram como fontes dinâmicas. Exemplos e notas de estilo do Treino calibram a voz.

A busca usa o índice textual local existente, com até 16 trechos e 22 mil caracteres adicionais por geração, além das bases e das últimas 40 mensagens do diálogo. Todo esse acervo está disponível à recuperação; cada resposta recebe os trechos relacionados ao assunto. Não consulta a internet. Referências datadas permanecem datadas. Notas privadas dos controllers, credenciais, logs e perfis de navegador não integram esse acervo.

## Operação e recuperação

Se um processo de desenvolvimento anterior ainda não tiver carregado este canal, o controle solicita reiniciar o servidor e recarregar a página. A atualização não recria o singleton de uma apresentação ativa para acrescentar a função.

O canal pertence ao `showState` e usa o SSE e a reconciliação de revisão existentes. A conversa não executa ferramentas, comandos operacionais ou transições de cena. STOP ALL, modo emergência, nova apresentação e recuperação interrompem gerações pendentes; callbacks atrasados não acrescentam texto. O snapshot guarda a conversa e as avaliações. Recuperar uma sessão preserva o histórico e deixa gerações interrompidas, sem refazê-las automaticamente. Exemplos de treino já salvos continuam disponíveis após nova apresentação.

Uma falha mantém o texto no campo de envio. Repetir o envio reutiliza o identificador e evita duplicar a mensagem. Não há resposta simulada de sucesso se o provedor falhar. Envio e alternativas utilizam o modelo selecionado e o cliente existente; avaliações não fazem chamadas ao modelo.

## Verificação

- `npm run test:live-training`: fixtures temporárias; feedback/upsert, contexto, alternativas, separação pública/privada, cancelamento e recuperação.
- `npm run test:live-training:browser`: build em cópia isolada, dados de treino descartáveis e porta 3325; provedor interceptado sem chamadas reais. Verifica navegação, digitação, dois clientes, avaliações, alternativas públicas, reload, reconciliação sem SSE, falha/reenvio e STOP ALL. Recusa porta ocupada e encerra somente o servidor criado pelo teste.

Essas verificações não comprovam qualidade de resposta do modelo real nem legibilidade no projetor físico.
