// Only loaded in the private worker, never bundled into the client or Next server.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const imaginarRoot = () => path.resolve(process.env.CAIXA_PRETA_IMAGINAR_ROOT || path.join(process.cwd(), '../../ImaginAR/8th wall/buildable/imaginar'));
function loadBridge(taskDirectory) {
  const repo = imaginarRoot();
  const source = path.join(repo, 'api/_shared/model-studio');
  if (!fs.existsSync(path.join(source, 'jobs.js'))) throw Error('IMAGINAR_NOT_FOUND');
  // Same configuration sources as Studio, confined to this child process.
  const inherited = { ...process.env };
  const envFile = path.join(repo, 'apps/3d-model-generator/.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const local = path.join(repo, 'api/local.settings.json');
  const values = fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, 'utf8')).Values || {} : {};
  for (const [key, value] of Object.entries(values)) if (process.env[key] == null) process.env[key] = String(value);
  Object.assign(process.env, inherited);
  const oldRoot = path.resolve(repo, process.env.STUDIO_DATA_DIR || '.local/model-studio');
  process.env.STUDIO_SEGMENTATION_PYTHON = path.resolve(repo, process.env.STUDIO_SEGMENTATION_PYTHON || path.join(oldRoot, 'tools/segmentation/bin/python'));
  process.env.CAIXA_PRETA_SEGMENTATION_MODELS ||= path.join(oldRoot, 'models/segmentation');
  process.env.STUDIO_DATA_DIR = path.join(taskDirectory, 'studio');
  // This integration deliberately uses the existing operational TRELLIS lane.
  process.env.STUDIO_QUALITY_ENGINE = 'trellis';
  process.env.STUDIO_GENERATOR_WARMUP = '0';
  const requireSource = createRequire(path.join(source, 'config.js'));
  return { repo, source, requireSource, config: requireSource('./config').config };
}
async function diagnose(taskDirectory, { remote = true } = {}) {
  const checks = [];
  let bridge;
  try {
    bridge = loadBridge(taskDirectory);
    bridge.requireSource('./assets');
    bridge.requireSource('./jobs');
    checks.push({ label: 'Pipeline ImaginAR', ok: true });
  } catch {
    checks.push({ label: 'Pipeline ImaginAR', ok: false, message: 'Confira CAIXA_PRETA_IMAGINAR_ROOT e as dependências do ImaginAR.' });
    return { ready: false, checks };
  }
  const cfg = bridge.config();
  checks.push({ label: 'Preparação de imagem', ok: fs.existsSync(process.env.STUDIO_SEGMENTATION_PYTHON), message: fs.existsSync(process.env.STUDIO_SEGMENTATION_PYTHON) ? '' : 'Ambiente Python de preparação do ImaginAR ausente.' });
  checks.push({ label: 'Configuração TRELLIS', ok: cfg.flags.runpod, message: cfg.flags.runpod ? '' : `Estado: ${cfg.runpodStatus}. Habilite ENABLE_RUNPOD no servidor.` });
  const storage = bridge.requireSource('../storage');
  checks.push({ label: 'Armazenamento do modelo', ok: Boolean(storage.getConnString()), message: storage.getConnString() ? '' : 'Conexão de armazenamento do ImaginAR ausente.' });
  const blender = process.env.CAIXA_PRETA_BLENDER_BIN || cfg.blender;
  checks.push({ label: 'Blender', ok: fs.existsSync(blender), message: fs.existsSync(blender) ? '' : 'Configure CAIXA_PRETA_BLENDER_BIN.' });
  if (remote && cfg.endpoint && cfg.runpodKey) {
    try {
      const endpoint = await bridge.requireSource('./runpod-management').get(`https://api.runpod.io/v2/serverless/${cfg.endpoint}`, cfg.runpodKey);
      const block = await require('node:fs/promises').readFile(path.join(require('./store.cjs').root(), 'provider-block.json'), 'utf8').then(JSON.parse).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (block?.endpointId === cfg.endpoint && block.image === endpoint.image && block.registry === endpoint.registry) {
        checks.push({ label: 'Acesso à imagem privada', ok: false, message: 'A última tentativa confirmou acesso negado ao GHCR. Corrija a credencial de registro do endpoint antes de gerar novamente.' });
      }
      const safe = endpoint.type === 'QUEUE' && endpoint.gpu?.count === 1 && endpoint.workers?.min === 0 && [0, 1].includes(endpoint.workers?.max) && endpoint.workers?.idleTimeout === 10;
      checks.push({ label: 'Endpoint RunPod', ok: safe, message: safe ? 'Ativação sob demanda; nenhum job enviado nesta verificação.' : 'Configuração incompatível com a ativação sob demanda do Studio.' });
      const health = await bridge.requireSource('./runpod-service').health();
      checks.push({ label: 'Workers RunPod', ok: !health.workers?.unhealthy, message: health.workers?.unhealthy ? 'Worker com falha. Verifique o acesso à imagem privada no GHCR antes de gerar.' : 'Sem worker reportado com falha. Isso não comprova acesso à imagem privada.' });
    } catch {
      checks.push({ label: 'Conexão RunPod', ok: false, message: 'Não foi possível consultar o endpoint. Confira rede e credenciais RunPod.' });
    }
  }
  return { ready: checks.every(c => c.ok), checks };
}
module.exports = { imaginarRoot, loadBridge, diagnose };
