# Imagem → modelo 3D → vídeo

Abra a aba **modelo-3D** no cabeçalho dos controles (ao lado de Operator), em `/modelo-3d`.

1. Envie uma imagem PNG, JPEG ou WebP de até 20 MB. Prefira o objeto inteiro e bem iluminado. A remoção de fundo é opcional; o fundo do vídeo é sempre preto.
2. Use **Rápida (512)**, selecionada por padrão, ou escolha Padrão (1024)/Alta (1536) para maior resolução e tempo de processamento.
3. Autorize a cobrança dessa geração na conta RunPod configurada e clique em **Gerar modelo + vídeo**.
4. Acompanhe preparação, geração, renderização e montagem do vídeo. Ao concluir, baixe o GLB e o MP4. O vídeo pode ser visualizado em loop na própria aba.

O MP4 usa H.264/yuv420p, 1920×1080, 30 fps, 600 quadros/20 segundos, sem áudio e com giro uniforme de 360 graus no Y do GLB. O último quadro não repete o primeiro. O enquadramento considera a extensão total da rotação; materiais e geometria importados são preservados. As partes ocultas do objeto são estimativas do gerador a partir de uma única imagem.

## Execução e recuperação

O servidor precisa estar neste computador, com Node 22.15+/24, Chromium do Playwright (`npx playwright install chromium`), Blender, FFmpeg e FFprobe instalados. A geração usa o pipeline **TRELLIS** já existente no checkout local do ImaginAR; não usa o SPAR3D nem troca de motor automaticamente. Não é necessário abrir o Studio ou pedir a um agente que rode comandos para cada imagem.

O vídeo usa Three.js/WebGL e a GPU local, com captura dos 600 ângulos e normalização para 30 fps. A captura H.264 sem quadros reordenados é aproveitada sem nova compressão; outros codecs são convertidos pelo FFmpeg. O servidor temporário fica somente em `127.0.0.1`, com rotas limitadas ao modelo e bibliotecas locais; requisições externas do navegador são bloqueadas. O Chromium recebe apenas variáveis do sistema, sem credenciais do provedor. Se a captura falhar ou perder quadros, o mesmo GLB passa ao Blender Eevee, sem nova inferência. Nesse caminho, Y glTF corresponde a Z no Blender.

Um processo Node separado continua trabalhando ao fechar a aba ou reiniciar apenas o servidor Next. Se o computador ou worker parar, volte à aba e use **Retomar tarefa**. Se o modelo já estiver salvo, **Retomar vídeo** executa apenas o trabalho local, sem nova geração paga. Falhas de geração não são reenviadas automaticamente. Uma submissão sem confirmação é exibida como `SUBMISSION_UNCERTAIN_DO_NOT_RETRY`: confira o job original no RunPod antes de iniciar outra geração.

**Cancelar tarefa** cancela o job original quando há um identificador confirmado e interrompe o render local. O cancelamento depende de acesso ao provedor; uma falha de conexão não comprova interrupção da cobrança. Há uma tarefa ativa por vez. Os resultados prontos ficam disponíveis após recarregar ou reiniciar o servidor.

Arquivos privados ficam em `.runtime/model-3d/<id>/`: original, `task.json`, fila isolada `studio/`, `model.glb`, `loop.mp4` e relatório de vídeo. Não entram no `showState`, SSE, reset de apresentação ou projeção. Quadros intermediários são removidos após um MP4 validado; em falhas ficam para retomada. Esses dados locais não têm retenção automática: acompanhe o espaço em disco e faça backup dos resultados necessários.

## Configuração do servidor

O worker reutiliza `.env` do Studio e `api/local.settings.json` do ImaginAR somente no processo privado; valores de ambiente já definidos têm precedência. Nenhuma chave, URL assinada ou resposta bruta do provedor é enviada à interface. A fila e os arquivos do Studio original não são alterados.

Durante a inicialização, o worker local consulta os estados dos workers RunPod a cada 15 segundos. Quando identifica falha no worker associado ao job, ou uma inicialização sem workers anteriores em que todos os workers atuais falharam, cancela o job original. Logs são classificados em memória; não são salvos nem enviados à interface. Uma falha de permissão do registro é exibida como `GHCR_IMAGE_PULL_DENIED`. Se o cancelamento ficar sem confirmação, a aba mantém **Cancelar tarefa** e bloqueia novas gerações até reconciliar o job.

Antes do envio, o adaptador privado confirma duas leituras consecutivas de `workersMax>0` no controle v1, depois da ativação pelo controle v2. Não envia inferência durante essa espera. Uma rejeição HTTP 409 explicitamente identificada como `ENDPOINT_PAUSED` ou `ENDPOINT_NOT_READY`, sem ID de job, permite até três envios administrativos com nova confirmação de ativação entre eles. O primeiro sucesso encerra os envios. Erro desconhecido, ID retornado, falha de rede, resposta 5xx ou erro após iniciar a inferência nunca provoca repetição automática. Só status/código conhecidos entram no registro público; corpo bruto, URLs e credenciais são descartados.

O limite local de `GENERATING 3D` é 15 minutos somente no processo privado do Caixa Preta, alinhado à janela de execução já configurada no provedor. O limite anterior de cinco minutos cancelou o teste real de 1024 antes de existir um GLB. O checkout e os limites do Studio original não são alterados. Aumentar o limite evita o cancelamento prematuro; a redução de trabalho vem do perfil Rápida (512).

Após um acesso negado confirmado, `.runtime/model-3d/provider-block.json` impede novos envios com a mesma imagem e credencial de registro. O diagnóstico volta a avaliar a configuração depois de a credencial vinculada ao endpoint mudar; consultar o diagnóstico não inicia workers. A substituição de credenciais precisa de autorização operacional própria.

| Variável opcional | Padrão / finalidade |
| --- | --- |
| `CAIXA_PRETA_IMAGINAR_ROOT` | `../../ImaginAR/8th wall/buildable/imaginar`, relativo à raiz do Caixa Preta |
| `CAIXA_PRETA_MODEL_3D_DIR` | `.runtime/model-3d` |
| `CAIXA_PRETA_BLENDER_BIN` | Blender configurado pelo Studio ou `/Applications/Blender.app/Contents/MacOS/Blender` |
| `CAIXA_PRETA_FFMPEG_BIN` | `ffmpeg` no PATH |
| `CAIXA_PRETA_FFPROBE_BIN` | `ffprobe` no PATH |
| `CAIXA_PRETA_MODEL_3D_RENDERER` | WebGL por padrão; `blender` força a alternativa Eevee |
| `CAIXA_PRETA_SEGMENTATION_MODELS` | Cache `models/segmentation` do Studio original; somente o modelo de remoção de fundo necessário é copiado para a tarefa |

O ImaginAR deve ter dependências instaladas, Python de preparação em `STUDIO_SEGMENTATION_PYTHON` (ou `tools/segmentation/bin/python`), configuração de armazenamento, `RUNPOD_TRELLIS_ENDPOINT_ID`, `RUNPOD_TRELLIS_API_KEY` e `ENABLE_RUNPOD=1`. A remoção de fundo também precisa de `birefnet-general-lite.onnx` no cache original. Falhas locais de preparação não enviam inferência.

O diagnóstico é somente leitura. Confere dependências, configuração e saúde do endpoint, mas nenhum worker é iniciado por abrir a página, consultar status ou verificar novamente. A submissão explícita reutiliza a ativação sob demanda do ImaginAR (`min=0`, `max` de 0 para 1 quando necessário, idle timeout 10 s), sem alterar imagem, credencial, pool ou mínimo de workers. `0/0 Running` indica o limite máximo zero; o adaptador o abre antes do envio. Zero workers em repouso é esperado, mas não comprova inferência funcional nem custo final zero. O início a frio da GPU pode acrescentar minutos ao processamento; confira o faturamento RunPod.

A tentativa única autorizada em 11/11/2026 foi enviada pela nova aba com `objeto-01.png`, qualidade padrão, sem remoção de fundo. A preparação local concluiu, mas o worker confirmou novamente `denied` ao baixar a imagem privada GHCR, antes da inferência. Job local `5d2285fe-159f-41a3-9470-25eb6838c3d0`; job RunPod `d57dc17c-2ce2-4ebe-b694-92de9cd5b613-u1`. O monitor de teste cancelou o job e restaurou `min=0,max=0`; a leitura final mostrou fila vazia e nenhum worker. Não houve GLB nem MP4, nem repetição da inferência. A consulta imediata de faturamento não mostrou lançamentos, o que não comprova custo final zero. Evidências privadas: `.runtime/model-3d/_validation/2026-11-11/receipt.json`.

A correção operacional de 11/11/2026 foi explicitamente autorizada: a nova credencial `caixa-preta-trellis-ghcr-2026-11-11` foi vinculada somente ao endpoint `3yn597xooctr2k`. O token atual do GitHub CLI foi armazenado no RunPod com autorização específica para seus escopos existentes (`gist`, `read:org`, `repo`, `workflow`, `write:packages`); não é um token exclusivo de leitura. O valor não foi exposto nem salvo no projeto. A credencial anterior foi preservada. Leituras antes/depois confirmaram que imagem, GPU, escala, ambiente e demais parâmetros não mudaram. A continuidade desse acesso depende da validade/revogação do token cadastrado; o fluxo por imagem não depende de um agente ou do GitHub CLI.

O primeiro envio após essa correção recebeu HTTP 409 sem ID de job. A causa específica desse 409 não foi preservada pelo transporte original; propagação da ativação permanece hipótese. Depois de autorização para reconciliar rejeições administrativas, mantendo teto total de US$1 e no máximo uma inferência aceita, a mesma tarefa local foi retomada. O RunPod aceitou o job `5441efb8-26ce-4ce0-996c-77b303c203b1-u2`: cerca de 292 segundos de fila/inicialização, seguidos de 307 segundos de execução. O limite local anterior de cinco minutos em `GENERATING 3D` provocou cancelamento confirmado (`CANCELLED`), sem GLB recuperável. Não houve segunda inferência aceita. O endpoint voltou a `min=0,max=0`, sem fila nem workers; o faturamento consultado ainda não tinha lançamento consolidado. Evidências privadas: `.runtime/model-3d/_registry/repair-2026-11-11/receipt.json` e `.runtime/model-3d/_validation/2026-11-11-after-registry-fix/receipt.json`. A aceitação real de imagem → GLB → MP4 com os ajustes continua pendente.

O render integrado completo foi medido separadamente, sem GPU RunPod, em 11/11/2026 num Apple M4 Pro. Um GLB já existente do Studio produziu MP4 Full HD, 600 quadros, 30 fps e exatamente 20 segundos em **23,507 segundos**, incluindo captura, montagem e validação. Isso mede somente GLB → MP4, não o tempo de geração de uma imagem nova. Um GLB sintético também passou na conferência de fundo preto, enquadramento, rotação e continuidade da emenda. Evidências: `.runtime/model-3d/_validation/render-benchmark-2026-11-11/integrated-report.json`.

## Verificação

- `npm run test:modelo-3d`: orquestração com provedor local simulado, idempotência, falha do vídeo, retomada, cancelamento, submissão incerta, admissão concorrente, falha de startup/GHCR, cancelamento pendente, ativação com leitura antiga e reconciliação limitada de rejeições explícitas, sem repetir envios incertos ou já aceitos.
- `npm run test:modelo-3d:local`: preparação real do ImaginAR sem acesso ao provedor, alternativa Blender em 320×180/12 quadros e exportação WebGL/FFmpeg completa de um GLB sintético em 1920×1080/600 quadros/30 fps/20 segundos. Confere fundo, enquadramento, rotação, codificação e emenda do loop. Não envia jobs RunPod.
- `npm run build`: compilação da aplicação. `npm run test:modelo-3d:browser` cria seu próprio build em `.runtime/model-3d/_validation/` usando `CAIXA_PRETA_NEXT_DIST_DIR`, sem disputar `.next` com a apresentação ou outras sessões. Usa navegador na porta isolada 3321, provedor/vídeo simulados, upload, autorização, perfil rápido padrão, recuperação da lista, downloads, byte ranges, separação pública/privada e bloqueio de outra origem. Não usa nem reseta a porta 3000.

Build, testes simulados e render local não validam inferência paga nem qualidade de um novo modelo inferido. Para validar o fluxo real, envie uma imagem pela aba e autorize uma geração com o custo correspondente. A conta RunPod e a máquina local devem continuar disponíveis durante o processamento.
