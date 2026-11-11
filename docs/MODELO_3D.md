# Imagem → modelo 3D → vídeo

Abra a aba **modelo-3D** no cabeçalho dos controles (ao lado de Operator), em `/modelo-3d`.

1. Envie uma imagem PNG, JPEG ou WebP de até 20 MB. Prefira o objeto inteiro e bem iluminado. A remoção de fundo é opcional; o fundo do vídeo é sempre preto.
2. Escolha Rápida (512), Padrão (1024) ou Alta (1536).
3. Autorize a cobrança dessa geração na conta RunPod configurada e clique em **Gerar modelo + vídeo**.
4. Acompanhe preparação, geração, renderização e montagem do vídeo. Ao concluir, baixe o GLB e o MP4. O vídeo pode ser visualizado em loop na própria aba.

O MP4 usa H.264/yuv420p, 1920×1080, 30 fps, 600 quadros/20 segundos, sem áudio e com giro uniforme de 360 graus. O último quadro não repete o primeiro. O eixo Y do GLB corresponde ao Z no Blender depois da importação glTF. O enquadramento considera a extensão total da rotação; materiais e geometria importados são preservados. As partes ocultas do objeto são estimativas do gerador a partir de uma única imagem.

## Execução e recuperação

O servidor precisa estar neste computador, com Node 22.15+/24, Blender, FFmpeg e FFprobe instalados. A geração usa o pipeline **TRELLIS** já existente no checkout local do ImaginAR; não usa o SPAR3D nem troca de motor automaticamente. Não é necessário abrir o Studio ou pedir a um agente que rode comandos para cada imagem.

Um processo Node separado continua trabalhando ao fechar a aba ou reiniciar apenas o servidor Next. Se o computador ou worker parar, volte à aba e use **Retomar tarefa**. Se o modelo já estiver salvo, **Retomar vídeo** executa apenas o trabalho local, sem nova geração paga. Falhas de geração não são reenviadas automaticamente. Uma submissão sem confirmação é exibida como `SUBMISSION_UNCERTAIN_DO_NOT_RETRY`: confira o job original no RunPod antes de iniciar outra geração.

**Cancelar tarefa** cancela o job original quando há um identificador confirmado e interrompe o render local. O cancelamento depende de acesso ao provedor; uma falha de conexão não comprova interrupção da cobrança. Há uma tarefa ativa por vez. Os resultados prontos ficam disponíveis após recarregar ou reiniciar o servidor.

Arquivos privados ficam em `.runtime/model-3d/<id>/`: original, `task.json`, fila isolada `studio/`, `model.glb`, `loop.mp4` e relatório de vídeo. Não entram no `showState`, SSE, reset de apresentação ou projeção. Quadros intermediários são removidos após um MP4 validado; em falhas ficam para retomada. Esses dados locais não têm retenção automática: acompanhe o espaço em disco e faça backup dos resultados necessários.

## Configuração do servidor

O worker reutiliza `.env` do Studio e `api/local.settings.json` do ImaginAR somente no processo privado; valores de ambiente já definidos têm precedência. Nenhuma chave, URL assinada ou resposta bruta do provedor é enviada à interface. A fila e os arquivos do Studio original não são alterados.

| Variável opcional | Padrão / finalidade |
| --- | --- |
| `CAIXA_PRETA_IMAGINAR_ROOT` | `../../ImaginAR/8th wall/buildable/imaginar`, relativo à raiz do Caixa Preta |
| `CAIXA_PRETA_MODEL_3D_DIR` | `.runtime/model-3d` |
| `CAIXA_PRETA_BLENDER_BIN` | Blender configurado pelo Studio ou `/Applications/Blender.app/Contents/MacOS/Blender` |
| `CAIXA_PRETA_FFMPEG_BIN` | `ffmpeg` no PATH |
| `CAIXA_PRETA_FFPROBE_BIN` | `ffprobe` no PATH |
| `CAIXA_PRETA_SEGMENTATION_MODELS` | Cache `models/segmentation` do Studio original; somente o modelo de remoção de fundo necessário é copiado para a tarefa |

O ImaginAR deve ter dependências instaladas, Python de preparação em `STUDIO_SEGMENTATION_PYTHON` (ou `tools/segmentation/bin/python`), configuração de armazenamento, `RUNPOD_TRELLIS_ENDPOINT_ID`, `RUNPOD_TRELLIS_API_KEY` e `ENABLE_RUNPOD=1`. A remoção de fundo também precisa de `birefnet-general-lite.onnx` no cache original. Falhas locais de preparação não enviam inferência.

O diagnóstico é somente leitura. Confere dependências, configuração e saúde do endpoint, mas nenhum worker é iniciado por abrir a página, consultar status ou verificar novamente. A submissão explícita reutiliza a ativação sob demanda do ImaginAR (`min=0`, `max` de 0 para 1 quando necessário, idle timeout 10 s), sem alterar imagem, credencial, pool ou mínimo de workers. Isso não comprova custo zero em repouso; confira o faturamento RunPod.

A falha registrada em 06/11/2026 foi `denied` no download da imagem privada GHCR, antes da inferência. A credencial de registro vinculada ao endpoint precisa permitir esse download. Uma verificação de saúde sem workers não prova acesso ao registro. A integração exibe falhas e não cria endpoints, corrige credenciais ou troca imagens automaticamente.

## Verificação

- `npm run test:modelo-3d`: orquestração com provedor local simulado, idempotência, falha do vídeo, retomada, cancelamento, submissão incerta e admissão concorrente.
- `npm run test:modelo-3d:local`: preparação real do ImaginAR sem rede e render CPU com Blender/FFmpeg/FFprobe de um GLB de teste, em 320×180/12 quadros. Confere fundo, enquadramento, rotação e codificação. Não envia jobs RunPod.
- `npm run build` e `npm run test:modelo-3d:browser`: navegador na porta isolada 3321, com provedor/vídeo simulados, upload, autorização, recuperação da lista, downloads, byte ranges, separação pública/privada e bloqueio de outra origem. Não usa nem reseta a porta 3000.

Build, testes simulados e render CPU não validam inferência paga, acesso do worker ao GHCR, qualidade do modelo inferido nem exportação completa de 600 quadros. Para validar o fluxo real, envie uma imagem pela aba e autorize uma geração com o custo correspondente. A conta RunPod e a máquina local devem continuar disponíveis durante o processamento.
