# Treino ao vivo

A aba **treino-ao-vivo**, ao lado de **Treino**, abre `/treino-ao-vivo/controle`. A projeção fica em `/treino-ao-vivo`: uma conversa pública, com digitação animada e três alternativas quando solicitadas. Ao selecionar a aba, a janela pública conectada recebe esse destino pelo sistema de projeção existente.

No controle, escreva e pressione Enter ou **ENVIAR**. Shift+Enter quebra a linha. Cada resposta e alternativa tem apenas quatro ações de qualificação: **PERFEITO**, **QUASE**, **RUIM** e **GERAR ALTERNATIVAS**. As avaliações são privadas; a conversa e as alternativas aparecem para o público. A página pública não possui campo de envio nem controles de avaliação.

A lateral privada tem os mesmos onze parâmetros de personalidade do **Operator** e da seção **Personalidade e contexto** do **Tarô**: sarcasmo, rebeldia, curiosidade, verbosidade, humor, provocação, densidade filosófica, associação livre, crítica social, linguagem poética e rigor analítico. Alterar em qualquer uma dessas telas espelha os valores nas demais e orienta as próximas gerações, incluindo alternativas. Não reinicia uma fala em andamento. O modelo, a fonte e o ritmo de digitação também usam o estado global já ajustado no Operator. Configurações próprias de cartas, câmera e limites de leitura continuam específicas do Tarô.

A escrita do treino ao vivo conserva a velocidade global das letras e faz uma pausa leve de **180 ms na pontuação** e **600 ms entre parágrafos**, tanto no controle como na projeção. Pausas maiores já escolhidas no Operator são respeitadas. A pausa ocorre antes do próximo caractere visível; pontos, aspas e linhas em branco recebem uma única pausa de parágrafo, mesmo quando chegam em partes pelo streaming. O histórico concluído reaparece imediatamente ao recarregar.

As três avaliações salvam imediatamente em `data/training-examples.json`, sem exigir correção escrita. Requalificar uma resposta atualiza o mesmo exemplo. Esses exemplos também aparecem no Treino existente. PERFEITO fornece uma direção aprovada; QUASE e RUIM orientam ajustes sem recomendar como preferida uma resposta negativa que não recebeu correção. Isso calibra o contexto das próximas gerações; não altera os pesos do modelo.

## Repertório

As sete bases de `knowledge/` são enviadas integralmente: universo, dramaturgia, chatbot, personagens, conceitos, glossário e mapa completo das cenas. O bot consulta as **34 páginas integrais** de `Texto caixa preta.pdf` e as **12 páginas da continuação** em `assets/dramaturgia/proximas-etapas-da-peca.pdf`, com página de origem; as **59 seções e 63 fontes bibliográficas** do arquivo de referências; textos atuais dos cues e da Queda/Emergência; manifesto do sampler; BIOS/Morel, aquecimento, minijogos, malas e coleta de dados. O catálogo é explícito em `lib/showMemory.js`. Conversas públicas, observações não expiradas e memórias textuais habilitadas do Tarô entram como processo vivo. Hipóteses do pós-demo continuam marcadas como hipóteses. Exemplos e notas de estilo do Treino calibram a voz.

A busca usa o índice textual local existente, com até 24 trechos e 24 mil caracteres adicionais por geração, além das bases, do índice das referências e das últimas 40 mensagens. Os trechos grandes são subdivididos, sem descartar conteúdo da indexação. Pedidos por cena ou CP-XX direcionam a recuperação. Todo o texto está disponível; cada resposta recebe os trechos relacionados ao assunto. Essa memória compartilhada também atende o chat principal, o Operator e alternativas do Treino; o Tarô conserva seus próprios filtros de referências.

O acervo também recupera as 182 páginas da dissertação **Labirinto de Labirintos**, de Marcus Garcia. A pesquisa pública de 35 pessoas da criação/equipe e rede de colaboradores alimenta uma camada compartilhada de **inconsciente coletivo**: motivos e associações sem currículos, nomes, títulos ou URLs nessa camada. O bot não cita referências espontaneamente ao público. Fontes, obras, cobertura real e limites podem ser consultados na aba **Referências**; detalhes e verificações: [REFERENCIAS.md](REFERENCIAS.md).

Textos/configuração atuais prevalecem sobre o rascunho: malas **2 → 1 → 3**, bexigas → forca/disco → toca-discos. Cenas 8, 9 e futuro ato 2 são identificados como propostas. Não consulta a internet para montar esse acervo; referências datadas permanecem datadas. Notas privadas dos controllers, credenciais, logs e perfis de navegador não entram. Vídeos, áudios e imagens não transcritos fornecem apenas os metadados cadastrados; não se alega conhecer seu conteúdo.

### Atualização e auditoria do acervo

Ao substituir o PDF, rode `npm run memory:sync` e `npm run memory:audit`. O primeiro usa PyMuPDF no Python indicado por `CAIXA_PRETA_PDF_PYTHON`, ou `.venv-pdf/bin/python` quando disponível, e gera `knowledge/sources/texto-caixa-preta.json`, sem modificar o original. O runtime não depende de Python. Hashes verificam o PDF e a extração; fonte obrigatória ausente ou incompatível gera falha visível no treino ao vivo. Mudanças nas bases e nos JSONs invalidam o cache sem reiniciar. Arquivos JS seguem o carregamento normal da aplicação (rebuild/restart em produção).

`memory:audit` não chama modelos nem altera a apresentação: compara o texto indexado de todas as páginas com a extração, testa cenas 0–9, todas as CP-01–59, temas, bibliografia, processo, limites, privacidade e falhas de cache/hash numa cópia descartável. Imprime o caminho do relatório JSON com o inventário e hashes. Se mudar a estrutura do PDF, revisar o mapa e as expectativas da auditoria junto da extração. A auditoria comprova disponibilidade e recuperação textual, não garante que toda geração do modelo será correta.

## Operação e recuperação

Se um processo de desenvolvimento anterior ainda não tiver carregado este canal, o controle solicita reiniciar o servidor e recarregar a página. A atualização não recria o singleton de uma apresentação ativa para acrescentar a função.

O canal pertence ao `showState` e usa o SSE e a reconciliação de revisão existentes. A conversa não executa ferramentas, comandos operacionais ou transições de cena. STOP ALL, modo emergência, nova apresentação e recuperação interrompem gerações pendentes; callbacks atrasados não acrescentam texto. O snapshot guarda a conversa e as avaliações. Recuperar uma sessão preserva o histórico e deixa gerações interrompidas, sem refazê-las automaticamente. Exemplos de treino já salvos continuam disponíveis após nova apresentação.

Uma falha mantém o texto no campo de envio. Repetir o envio reutiliza o identificador e evita duplicar a mensagem. Não há resposta simulada de sucesso se o provedor falhar. Envio e alternativas utilizam o modelo selecionado e o cliente existente; avaliações não fazem chamadas ao modelo.

## Verificação

- `node --no-warnings scripts/live-training-typing-test.js` e `node --no-warnings scripts/live-training-typing-browser-test.js`: pausas leves, parágrafo único com streaming dividido, velocidade preservada e histórico sem repetição da animação; navegador e provedor isolados.
- `npm run test:live-training`: fixtures temporárias; feedback/upsert, contexto, alternativas, separação pública/privada, cancelamento e recuperação.
- `npm run test:live-training:browser`: build em cópia isolada, dados de treino descartáveis e porta 3325; provedor interceptado sem chamadas reais. Verifica navegação, digitação, dois clientes, avaliações, alternativas públicas, reload, reconciliação sem SSE, falha/reenvio, STOP ALL e trecho da página 32 no pedido que chegaria ao provedor. Recusa porta ocupada e encerra somente o servidor criado pelo teste.
- `npm run memory:live`: cinco gerações reais pelo mesmo adaptador do treino, numa sessão descartável. Envia bases e trechos do acervo ao provedor configurado e usa `OPENAI_API_KEY` de `.env.local`. Rodar com autorização para esse envio; grava perguntas/respostas e lacunas em JSON temporário. É uma amostra com revisão humana, não uma garantia universal de memória.

Os testes locais não comprovam qualidade do modelo real nem legibilidade no projetor físico. A amostra real autorizada, seus resultados e a confusão corrigida entre cenas estão em [VERIFICACAO_MEMORIA_ESPETACULO.md](VERIFICACAO_MEMORIA_ESPETACULO.md); essa amostra não garante infalibilidade.
