'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Model3DController.module.css';

const errors = {
  INVALID_IMAGE: 'Envie uma imagem PNG, JPEG ou WebP válida.', IMAGE_TOO_LARGE: 'A imagem deve ter no máximo 20 MB.',
  TASK_ACTIVE: 'Já existe uma tarefa em andamento. Aguarde ou cancele a tarefa anterior.',
  ADMISSION_BUSY: 'Outra solicitação está sendo salva. Tente novamente.',
  REQUEST_CONFLICT: 'Esta solicitação já está vinculada a outra imagem. Atualize a página.',
  TRELLIS_PAUSED: 'A geração está pausada na configuração do servidor ImaginAR.',
  TRELLIS_ENDPOINT_NOT_CONFIGURED: 'O endpoint ou a chave TRELLIS não está configurado.',
  SUBMISSION_UNCERTAIN_DO_NOT_RETRY: 'O envio ao RunPod ficou sem confirmação. Não envie outra geração antes de conferir a tarefa original no RunPod.',
  GENERATION_TIMEOUT: 'O RunPod excedeu o tempo de espera. O cancelamento foi solicitado.',
  PREPARATION_SERVICE_UNAVAILABLE: 'O serviço local de preparação não iniciou. Confira o ambiente Python do ImaginAR.',
  LOCAL_PROCESS_FAILED: 'A renderização ou montagem do vídeo falhou. O modelo permanece salvo; use Retomar vídeo.',
  LOCAL_TOOL_UNAVAILABLE: 'Blender, FFmpeg ou FFprobe não está disponível no servidor.',
  LOCAL_STORAGE_FAILED: 'Não foi possível acessar as tarefas locais. Confira o processo e o diretório de armazenamento.',
  GHCR_IMAGE_PULL_DENIED: 'O RunPod não conseguiu baixar a imagem privada do gerador no GHCR. Corrija a credencial de registro do endpoint antes de gerar novamente. A tentativa foi cancelada.',
  RUNPOD_WORKER_UNHEALTHY: 'O worker falhou durante a inicialização. A tentativa foi cancelada. Confira o diagnóstico e os logs no RunPod.',
  GENERATION_CANCEL_PENDING: 'O cancelamento no RunPod ficou sem confirmação. Use Cancelar tarefa novamente e confira o job original no RunPod antes de outra geração.',
  GENERATION_UNAVAILABLE: 'A geração está bloqueada pelo diagnóstico. Corrija o acesso à imagem privada do worker e verifique novamente antes de enviar outra imagem.',
  RUNPOD_409: 'O RunPod rejeitou o envio por conflito de configuração. A geração não foi reenviada. Confira o diagnóstico do endpoint.',
  RUNPOD_ADMISSION_PAUSED: 'O serviço de execução ainda vê o endpoint pausado após a ativação. A geração não foi enviada.',
  RUNPOD_ADMISSION_UNVERIFIED: 'Não foi possível confirmar a ativação no serviço de execução. A geração não foi enviada.',
  TRELLIS_STAGE_TIMEOUT: 'A fase de geração excedeu o limite local de tempo e o job foi cancelado. Não houve nova inferência.',
};
const labels = { queued: 'Na fila', preparing: 'Preparando imagem', generating: 'Gerando modelo 3D', rendering: 'Renderizando vídeo', encoding: 'Montando MP4', done: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado', interrupted: 'Processo interrompido' };
const stages = { QUEUED: 'Aguardando processamento', PREPROCESSING: 'Preparando a imagem', 'STARTING GPU': 'Iniciando a GPU sob demanda. Essa etapa pode levar alguns minutos.', 'LOADING MODEL': 'Carregando o gerador', 'GENERATING 3D': 'Construindo a geometria 3D', TEXTURING: 'Aplicando as texturas', EXPORTING: 'Exportando o modelo', POSTPROCESSING: 'Finalizando o modelo', OPTIMIZING: 'Otimizando o arquivo', 'ANALYZING GEOMETRY': 'Conferindo a geometria', UPLOADING: 'Recebendo os arquivos gerados', VALIDATING: 'Validando o modelo', DONE: 'Modelo 3D gerado' };
const message = code => errors[code] || `A tarefa parou (${code}). Consulte o diagnóstico abaixo. Nenhum novo envio é feito automaticamente.`;
const pendingKey = 'caixa-preta:model-3d-request';

export default function Model3DController() {
  const [image, setImage] = useState(null), [preview, setPreview] = useState('');
  const [tasks, setTasks] = useState([]), [diagnostic, setDiagnostic] = useState(null);
  const [preset, setPreset] = useState('draft'), [removeBackground, setRemoveBackground] = useState(false);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false);
  const [error, setError] = useState(''), [connectionError, setConnectionError] = useState('');
  const requestRef = useRef(null), uploadInput = useRef(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/modelo-3d', { cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      setTasks(data.tasks); setConnectionError('');
    } catch { setConnectionError('Sem conexão com as tarefas. Tentando novamente; não reenvie a geração.'); }
  }, []);
  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/modelo-3d?diagnostico', { cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      setDiagnostic(data);
    } catch { setDiagnostic({ ready: false, checks: [{ label: 'Servidor', ok: false, message: 'Não foi possível obter o diagnóstico.' }] }); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => { refresh(); check(); const timer = setInterval(refresh, 2500); return () => clearInterval(timer); }, [refresh, check]);
  useEffect(() => {
    if (!image) { setPreview(''); return; }
    const url = URL.createObjectURL(image); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [image]);
  async function submit(event) {
    event.preventDefault(); if (!image || busy) return;
    setBusy(true); setError('');
    try {
      // Persist before HTTP: retrying a lost response reuses the same request.
      const fingerprint = `${image.name}:${image.size}:${image.lastModified}:${preset}:${removeBackground}`;
      let saved;
      try { saved = JSON.parse(localStorage.getItem(pendingKey)); } catch { saved = null; }
      const id = requestRef.current || (saved?.fingerprint === fingerprint ? saved.id : crypto.randomUUID());
      requestRef.current = id;
      localStorage.setItem(pendingKey, JSON.stringify({ id, fingerprint }));
      const form = new FormData(); form.set('image', image); form.set('requestId', id); form.set('preset', preset);
      form.set('removeBackground', removeBackground ? 'yes' : 'no'); form.set('confirmCost', confirmed ? 'yes' : 'no');
      const response = await fetch('/api/modelo-3d', { method: 'POST', body: form });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      requestRef.current = null; localStorage.removeItem(pendingKey); setImage(null); setConfirmed(false);
      if (uploadInput.current) uploadInput.current.value = '';
      await refresh();
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'O envio ficou sem resposta. Tente novamente com a mesma imagem; a solicitação será reaproveitada.' : message(err.message)); }
    finally { setBusy(false); }
  }
  async function act(id, action) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/modelo-3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      await refresh();
    } catch (err) { setError(message(err.message)); } finally { setBusy(false); }
  }
  const active = tasks.some(t => t.canCancel || !['done', 'failed', 'cancelled'].includes(t.status));
  return <main className={styles.main}>
    <header><span className={styles.eyebrow}>PRODUÇÃO · CAIXA PRETA</span><h1>modelo-3D</h1><p>Uma imagem vira um modelo 3D e um vídeo com fundo preto, girando em loop no eixo Y.</p></header>
    <div className={styles.columns}>
      <form className={styles.card} onSubmit={submit}>
        <h2>Nova geração</h2>
        <label className={styles.upload}>Imagem de referência<input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { setImage(e.target.files?.[0] || null); requestRef.current = null; setError(''); }} required /><small>PNG, JPEG ou WebP · até 20 MB. Prefira um objeto inteiro e bem iluminado.</small></label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img className={styles.preview} src={preview} alt="Imagem de referência selecionada" />}
        <label>Qualidade<select value={preset} onChange={e => { setPreset(e.target.value); requestRef.current = null; }}><option value="draft">Rápida · 512 · recomendada</option><option value="standard">Padrão · 1024 · mais demorada</option><option value="high">Alta · 1536 · mais demorada</option></select></label>
        <label className={styles.check}><input type="checkbox" checked={removeBackground} onChange={e => { setRemoveBackground(e.target.checked); requestRef.current = null; }} />Remover o fundo da imagem antes de gerar</label>
        <p className={styles.note}>MP4: 1920×1080 · 30 fps · 20 segundos · sem áudio. O fundo do vídeo será sempre preto. Você pode fechar esta aba e voltar depois.</p>
        <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Autorizar esta geração no RunPod, com cobrança de GPU na conta configurada.</label>
        <button type="submit" disabled={!image || !confirmed || busy || active || !diagnostic?.ready}>{busy ? 'Enviando…' : 'Gerar modelo + vídeo'}</button>
        {active && <p className={styles.note}>Uma tarefa por vez. Acompanhe o andamento ao lado.</p>}
        {!diagnostic?.ready && <p className={styles.note}>A geração será liberada quando o diagnóstico estiver pronto.</p>}
      </form>
      <section className={styles.card} aria-label="Tarefas de geração"><h2>Suas gerações</h2>
        {connectionError && <p role="alert" className={styles.error}>{connectionError}</p>}
        {!tasks.length && <p className={styles.note}>Os modelos e vídeos gerados aparecerão aqui.</p>}
        {tasks.map(task => <article className={styles.task} key={task.id}>
          <div className={styles.taskHeading}><strong>{task.name}</strong><span>{labels[task.status] || task.status}</span></div>
          <p role="status">{stages[task.detail] || task.detail}</p>
          {task.status === 'rendering' && <><progress value={task.frame} max={task.frames} aria-label="Renderização do vídeo" /><small>{task.frame} / {task.frames} quadros</small></>}
          {task.error && <p className={styles.error}>{message(task.error)}</p>}
          {task.failedStage && <p className={styles.error}>Fase interrompida: {stages[task.failedStage] || task.failedStage}</p>}
          {task.submissionRejection && <p className={styles.error}>Resposta do serviço: {task.submissionRejection.reason} · HTTP {task.submissionRejection.httpStatus}</p>}
          {task.videoUrl && <video className={styles.video} src={task.videoUrl} controls loop muted playsInline preload="metadata" />}
          <div className={styles.actions}>
            {task.modelUrl && <a href={`${task.modelUrl}?download`}>Baixar modelo GLB</a>}
            {task.videoUrl && <a href={`${task.videoUrl}?download`}>Baixar vídeo MP4</a>}
            {task.canResume && <button type="button" disabled={busy} onClick={() => act(task.id, 'resume')}>{task.modelReady ? 'Retomar vídeo' : 'Retomar tarefa'}</button>}
            {task.canCancel && <button type="button" disabled={busy} onClick={() => act(task.id, 'cancel')}>Cancelar tarefa</button>}
          </div>
        </article>)}
      </section>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.card} aria-label="Diagnóstico da geração"><div className={styles.taskHeading}><h2>Diagnóstico</h2><button type="button" onClick={check} disabled={checking}>{checking ? 'Verificando…' : 'Verificar novamente'}</button></div>
      <p className={styles.note}>Esta verificação não envia uma geração nem ativa uma GPU. Acesso à imagem privada do worker só é confirmado na inicialização dele.</p>
      {diagnostic?.checks.map(item => <p className={styles.diagnostic} key={item.label} data-ok={item.ok}><strong>{item.ok ? '✓' : '!'} {item.label}</strong>{item.message && <span>{item.message}</span>}</p>)}
    </section>
  </main>;
}
