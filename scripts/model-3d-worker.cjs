// Detached local worker. Provider credentials remain in this process only.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createReadStream } = require('node:fs');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const store = require('../lib/model-3d/store.cjs');
const { loadBridge, diagnose } = require('../lib/model-3d/bridge.cjs');
const { startupFailure } = require('../lib/model-3d/workerHealth.cjs');
const { installSubmissionGuard } = require('../lib/model-3d/submissionGuard.cjs');
const { recordTurntable } = require('../lib/model-3d/browserRender.cjs');
const exec = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = file => fs.access(file).then(() => true, () => false);
function phaseId(id, phase) {
  const hex = createHash('sha256').update(`${id}:${phase}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function runProcess(bin, args, { cancelled, progress, timeout = 90 * 60000 } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout });
    let buffer = '', stopping = false;
    const timer = setInterval(async () => {
      if (stopping || !cancelled || !(await cancelled())) return;
      stopping = true;
      child.kill('SIGTERM');
    }, 1000);
    child.stdout.on('data', data => {
      buffer = (buffer + data).slice(-10000);
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        const match = line.match(/^CP3D_FRAME:(\d+)$/);
        if (match) progress?.(Number(match[1]));
      }
    });
    child.on('error', () => { clearInterval(timer); reject(Error('LOCAL_TOOL_UNAVAILABLE')); });
    child.on('exit', code => {
      clearInterval(timer);
      if (stopping) reject(Error('CANCELLED'));
      else if (code === 0) resolve();
      else reject(Error('LOCAL_PROCESS_FAILED'));
    });
  });
}
async function renderVideo(task, blender) {
  const settings = {
    input: store.file(task.id, 'model.glb'), output: store.file(task.id, 'frames'), renderer: 'eevee',
    frames: 600, fps: 30, width: 1920, height: 1080,
  };
  await fs.mkdir(settings.output, { recursive: true });
  await fs.writeFile(store.file(task.id, 'render.json'), JSON.stringify(settings), { mode: 0o600 });
  task.status = 'rendering'; task.error = null; task.detail = 'Renderizando a rotação em Y · 1920×1080 · 20 segundos';
  await store.save(task);
  const ffmpeg = process.env.CAIXA_PRETA_FFMPEG_BIN || 'ffmpeg';
  const ffprobe = process.env.CAIXA_PRETA_FFPROBE_BIN || 'ffprobe';
  const capture = store.file(task.id, 'turntable.capture');
  let recording, recordingStream;
  if (process.env.CAIXA_PRETA_MODEL_3D_RENDERER !== 'blender') {
    try {
      recording = await recordTurntable({ ...settings, output: capture }, {
        cancelled: () => exists(store.file(task.id, 'cancel')),
        progress: async frame => { task.frame = frame; await store.save(task); },
      });
      const probe = await exec(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', capture], { timeout: 30000 });
      const report = JSON.parse(probe.stdout); recordingStream = report.streams.find(s => s.codec_type === 'video');
      if (Number(recordingStream?.nb_read_frames) !== 600) throw Error('INCOMPLETE_VIDEO_CAPTURE');
      recording.duration = Number(report.format.duration);
      task.localRenderer = 'webgl'; await store.save(task);
    } catch (error) {
      if (error.message === 'CANCELLED') throw error;
      recording = null; task.localRenderer = 'blender'; task.detail = 'Usando renderização local alternativa'; task.frame = 0; await store.save(task);
    }
  }
  if (!recording) {
    let updates = Promise.resolve();
    await runProcess(blender, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
      '--python', path.join(__dirname, 'model-3d-render.py'), '--', store.file(task.id, 'render.json')], {
      cancelled: () => exists(store.file(task.id, 'cancel')),
      progress: frame => { updates = updates.then(async () => { task.frame = frame; await store.save(task); }); },
    }).finally(() => updates);
  }
  if (await exists(store.file(task.id, 'cancel'))) throw Error('CANCELLED');
  task.status = 'encoding'; task.detail = 'Montando o MP4 em loop'; await store.save(task);
  const copyRecording = recording && recordingStream.codec_name === 'h264' && recordingStream.pix_fmt === 'yuv420p' && recordingStream.has_b_frames === 0;
  const inputArgs = recording ? ['-i', capture] : ['-framerate', '30', '-i', path.join(settings.output, '%04d.png')];
  // The frame angles are deterministic. Normalize capture timestamps without
  // re-encoding only when there are no reordered frames (B-frames).
  const codecArgs = copyRecording
    ? ['-c:v', 'copy', '-bsf:v', 'setts=pts=N:dts=N:duration=1:time_base=1/30', '-video_track_timescale', '30000', '-r', '30']
    : [...(recording ? ['-vf', 'setpts=N/(30*TB)', '-r', '30'] : []), '-frames:v', '600', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p'];
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputArgs, ...codecArgs, '-an',
    '-movflags', '+faststart', store.file(task.id, 'loop.partial.mp4')], { cancelled: () => exists(store.file(task.id, 'cancel')) });
  const { stdout } = await exec(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', store.file(task.id, 'loop.partial.mp4')], { timeout: 30000 });
  const report = JSON.parse(stdout), video = report.streams.find(s => s.codec_type === 'video');
  if (video?.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' || video.width !== 1920 || video.height !== 1080 ||
      Number(video.nb_frames) !== 600 || Math.abs(Number(report.format.duration) - 20) > .05 || report.streams.some(s => s.codec_type === 'audio')) throw Error('VIDEO_VALIDATION_FAILED');
  await fs.rename(store.file(task.id, 'loop.partial.mp4'), store.file(task.id, 'loop.mp4'));
  await fs.writeFile(store.file(task.id, 'video-info.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  if (recording) await fs.writeFile(store.file(task.id, 'render-info.json'), JSON.stringify(recording, null, 2), { mode: 0o600 });
  if (await exists(store.file(task.id, 'cancel'))) throw Error('CANCELLED');
  task.videoReady = true; task.status = 'done'; task.detail = 'Modelo e vídeo prontos'; task.frame = 600;
  await store.save(task);
  // Only disposable rendered frames are removed; input, GLB and final video remain.
  await fs.rm(settings.output, { recursive: true, force: true });
  await fs.rm(capture, { force: true });
}
async function main(id) {
  const release = await store.claim(id);
  if (!release) return;
  const task = await store.read(id);
  let jobs, studioStore, currentJob, bridge, restoreSubmissionGuard, lastWorkerCheck = 0;
  const cancelled = () => exists(store.file(id, 'cancel'));
  async function cancelJob(jobId) {
    try {
      const job = await studioStore.get('jobs', jobId);
      if (jobs.terminal.has(job.status) && job.providerId && !['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(job.providerTerminalStatus))
        await bridge.requireSource('./runpod-service').cancel(job.providerId, job.provider);
      else {
        const result = await jobs.cancel(jobId);
        if (result.status === 'CANCELLING' || (job.submissionStarted && !job.providerId)) {
          // Keep the source submitter alive until its non-idempotent HTTP call settles.
          // Exiting immediately here could lose a provider ID that is still arriving.
          const deadline = Date.now() + 35000;
          let confirmed = false;
          while (Date.now() < deadline) {
            const latest = await studioStore.get('jobs', jobId);
            if (latest.providerId) {
              await bridge.requireSource('./runpod-service').cancel(latest.providerId, latest.provider);
              confirmed = true; break;
            }
            if (latest.error === 'SUBMISSION_UNCERTAIN_DO_NOT_RETRY') break;
            await sleep(250);
          }
          if (!confirmed) throw Error('GENERATION_CANCEL_PENDING');
        }
      }
      task.cancelPending = false;
    } catch { task.cancelPending = true; throw Error('GENERATION_CANCEL_PENDING'); }
  }
  async function waitJob(jobId) {
    currentJob = jobId;
    const deadline = Date.now() + 35 * 60000;
    while (Date.now() < deadline) {
      const job = await studioStore.get('jobs', jobId);
      if (await cancelled()) { await cancelJob(jobId); throw Error('CANCELLED'); }
      task.detail = job.status;
      if (job.providerId) task.providerId = job.providerId;
      await store.save(task);
      if (job.status === 'DONE') return job;
      if (['FAILED', 'CANCELLED'].includes(job.status)) { task.failedStage = job.failedStage || null; throw Error(job.error || job.status); }
      if (job.providerId && job.status === 'STARTING GPU' && Date.now() - lastWorkerCheck > 15000) {
        lastWorkerCheck = Date.now();
        const failure = await startupFailure(job, bridge.config()).catch(() => null);
        if (failure) {
          task.startupFailure = failure;
          await cancelJob(jobId);
          if (failure.code === 'GHCR_IMAGE_PULL_DENIED') {
            const cfg = bridge.config();
            const endpoint = await bridge.requireSource('./runpod-management').get(`https://api.runpod.io/v2/serverless/${cfg.endpoint}`, cfg.runpodKey).catch(() => null);
            if (endpoint) await fs.writeFile(path.join(store.root(), 'provider-block.json'), JSON.stringify({ endpointId: cfg.endpoint, image: endpoint.image, registry: endpoint.registry, reason: failure.code, checkedAt: failure.checkedAt }), { mode: 0o600 }).catch(() => {});
          }
          throw Error(failure.code);
        }
      }
      await sleep(1500);
    }
    await cancelJob(jobId);
    throw Error('GENERATION_TIMEOUT');
  }
  try {
    bridge = loadBridge(store.directory(id));
    jobs = bridge.requireSource('./jobs'); studioStore = bridge.requireSource('./store');
    const assets = bridge.requireSource('./assets');
    restoreSubmissionGuard = installSubmissionGuard(bridge, async rejection => {
      task.submissionRejection = rejection;
      task.submissionRejections = [...(task.submissionRejections || []), rejection];
      await store.save(task);
    });
    if (await cancelled()) {
      // Reconcile/cancel the original provider job after process interruption.
      for (const job of await studioStore.list('jobs')) if (!jobs.terminal.has(job.status) || (task.cancelPending && job.providerId)) await cancelJob(job.id);
      task.cancelPending = false;
      throw Error('CANCELLED');
    }
    if (task.modelReady && await exists(store.file(id, 'model.glb'))) {
      await renderVideo(task, process.env.CAIXA_PRETA_BLENDER_BIN || bridge.config().blender);
      return;
    }
    task.status = 'preparing'; task.error = null; task.detail = 'Validando e preparando a imagem'; await store.save(task);
    // Recover only this task's isolated queue. Studio refuses uncertain submissions.
    await jobs.recover();
    if (!task.assetId) {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[task.mime];
      const asset = await assets.receive(createReadStream(store.file(id, 'input')), task.mime, `imagem.${extension}`);
      task.assetId = asset.id; await store.save(task);
    }
    if (!task.preparedId) {
      if (task.removeBackground) {
        // Model cache is isolated too: never write through a link into ImaginAR.
        const sourceRoot = path.resolve(bridge.repo, process.env.CAIXA_PRETA_SEGMENTATION_MODELS || '.local/model-studio/models/segmentation');
        const destination = path.join(process.env.STUDIO_DATA_DIR, 'models/segmentation');
        await fs.mkdir(destination, { recursive: true });
        await fs.copyFile(path.join(sourceRoot, 'birefnet-general-lite.onnx'), path.join(destination, 'birefnet-general-lite.onnx'));
      }
      const [prepared] = await jobs.create({ operation: 'prepare-image', imageId: task.assetId, requestId: phaseId(id, 'prepare'),
        preparation: { removeBackground: task.removeBackground, enhance: false, padding: .125, resolution: 1536 } });
      task.preparationJobId = prepared.id; await store.save(task);
      const result = await waitJob(prepared.id);
      task.preparedId = result.preparation.id; await store.save(task);
    }
    task.status = 'generating'; task.detail = 'Iniciando a geração 3D no RunPod'; await store.save(task);
    const [generation] = await jobs.create({ operation: 'image-to-3d', qualityEngine: 'trellis', imageId: task.preparedId,
      requestId: phaseId(id, 'generation'), preset: task.preset, seed: 42, variations: 1 });
    task.generationJobId = generation.id; await store.save(task);
    const generated = await waitJob(generation.id);
    await fs.copyFile(studioStore.file('jobs', generated.id, 'final.glb'), store.file(id, 'model.glb'));
    task.modelReady = true; await store.save(task);
    await renderVideo(task, process.env.CAIXA_PRETA_BLENDER_BIN || bridge.config().blender);
  } catch (error) {
    if (currentJob && !task.modelReady && task.cancelPending !== false && await cancelled()) await cancelJob(currentJob).catch(() => { error = Error('GENERATION_CANCEL_PENDING'); });
    const safe = /^[A-Z][A-Z0-9_ ]{1,90}$/.test(error.message || '') ? error.message : 'PIPELINE_FAILED';
    task.status = safe === 'CANCELLED' ? 'cancelled' : 'failed'; task.error = safe;
    task.detail = task.modelReady ? 'O modelo foi salvo. Você pode retomar somente o vídeo.' : 'A tarefa parou. Nenhuma nova geração será enviada automaticamente.';
    await store.save(task);
  } finally { restoreSubmissionGuard?.(); await release(); }
}
async function diagnostic() {
  const report = await diagnose(path.join(store.root(), '_diagnostic'));
  for (const [label, bin] of [['FFmpeg', process.env.CAIXA_PRETA_FFMPEG_BIN || 'ffmpeg'], ['FFprobe', process.env.CAIXA_PRETA_FFPROBE_BIN || 'ffprobe']]) {
    const ok = await exec(bin, ['-version'], { timeout: 5000 }).then(() => true, () => false);
    report.checks.push({ label, ok, message: ok ? '' : `Instale ${label} no computador do Operator.` });
  }
  report.ready = report.checks.every(c => c.ok);
  process.stdout.write(JSON.stringify(report));
}
if (require.main === module) {
  (process.argv[2] === '--diagnose' ? diagnostic() : main(store.validId(process.argv[2])))
    .then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { phaseId, runProcess, renderVideo, main };
