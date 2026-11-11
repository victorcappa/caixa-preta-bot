// Orchestration/failure tests use a local fake provider. Never calls RunPod.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const store = require('../lib/model-3d/store.cjs');
const service = require('../lib/model-3d/service.cjs');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'caixa-preta-model-3d-test-'));
  const source = path.join(root, 'imaginar/api/_shared/model-studio');
  await fs.mkdir(source, { recursive: true });
  await fs.writeFile(path.join(source, 'config.js'), `exports.config=()=>({root:process.env.STUDIO_DATA_DIR,blender:process.env.CAIXA_PRETA_BLENDER_BIN});`);
  await fs.writeFile(path.join(source, 'store.js'), `
    const fs=require('node:fs/promises'),path=require('node:path');
    const file=(kind,id,name='manifest.json')=>path.join(process.env.STUDIO_DATA_DIR,kind,id,name);
    const save=async(kind,t)=>{await fs.mkdir(path.dirname(file(kind,t.id)),{recursive:true});await fs.writeFile(file(kind,t.id),JSON.stringify(t));return t};
    const get=async(kind,id)=>JSON.parse(await fs.readFile(file(kind,id),'utf8'));
    const list=async kind=>Promise.all((await fs.readdir(path.join(process.env.STUDIO_DATA_DIR,kind)).catch(()=>[])).map(id=>get(kind,id)));
    module.exports={file,save,get,list};
  `);
  await fs.writeFile(path.join(source, 'assets.js'), `
    const store=require('./store'),{randomUUID}=require('node:crypto');
    exports.receive=async stream=>{for await(const chunk of stream){void chunk};const a={id:randomUUID()};return store.save('assets',a)};
  `);
  await fs.writeFile(path.join(source, 'jobs.js'), `
    const fs=require('node:fs/promises'),path=require('node:path'),s=require('./store');
    exports.terminal=new Set(['DONE','FAILED','CANCELLED']);exports.recover=async()=>{};
    exports.create=async p=>{
      const old=await s.get('jobs',p.requestId).catch(()=>null);if(old)return [old];
      const t={id:p.requestId,status:'DONE',params:p};
      if(p.operation==='prepare-image')t.preparation={id:p.requestId};
      else {const countFile=path.join(process.env.STUDIO_DATA_DIR,'provider-submissions');
        const count=Number(await fs.readFile(countFile,'utf8').catch(()=>0));await fs.writeFile(countFile,String(count+1));
        if(process.env.MODEL3D_FIXTURE_UNCERTAIN==='1'){t.status='FAILED';t.error='SUBMISSION_UNCERTAIN_DO_NOT_RETRY'}
        else {t.providerId='original-provider-id';await s.save('jobs',t);await fs.writeFile(s.file('jobs',t.id,'final.glb'),'fixture GLB')}
      }
      return [await s.save('jobs',t)];
    };
    exports.cancel=async id=>{const t=await s.get('jobs',id);t.status='CANCELLED';return s.save('jobs',t)};
  `);
  const tool = path.join(root, 'tool.cjs');
  await fs.writeFile(tool, `#!/usr/bin/env node
    const fs=require('node:fs'),path=require('node:path');
    const name=path.basename(process.argv[1]);
    if(name==='blender'){
      if(process.env.MODEL3D_FIXTURE_RENDER_FAIL==='1')process.exit(1);
      const cfg=JSON.parse(fs.readFileSync(process.argv.at(-1),'utf8'));fs.mkdirSync(cfg.output,{recursive:true});
      console.log('CP3D_FRAME:600');
    }else if(name==='ffmpeg')fs.writeFileSync(process.argv.at(-1),'fixture MP4');
    else console.log(JSON.stringify({streams:[{codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p',width:1920,height:1080,nb_frames:'600'}],format:{duration:'20.000000'}}));
  `, { mode: 0o700 });
  for (const name of ['blender', 'ffmpeg', 'ffprobe']) await fs.symlink(tool, path.join(root, name));
  process.env.CAIXA_PRETA_MODEL_3D_DIR = path.join(root, 'tasks');
  process.env.CAIXA_PRETA_IMAGINAR_ROOT = path.join(root, 'imaginar');
  process.env.CAIXA_PRETA_BLENDER_BIN = path.join(root, 'blender');
  process.env.CAIXA_PRETA_FFMPEG_BIN = path.join(root, 'ffmpeg');
  process.env.CAIXA_PRETA_FFPROBE_BIN = path.join(root, 'ffprobe');
  return root;
}
async function waitFor(id, status) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const t = await store.read(id);
    if (t.status === status && !(await store.workerAlive(id))) return t;
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw Error(`Timeout: ${status}, ${JSON.stringify(await store.publicTask(await store.read(id)))}`);
}
async function test() {
  const root = await fixture();
  const payload = { id: randomUUID(), name: 'objeto.png', mime: 'image/png', buffer: Buffer.from('image fixture') };
  await service.create(payload);
  const done = await waitFor(payload.id, 'done');
  assert.equal(done.modelReady, true); assert.equal(done.videoReady, true);
  const count = id => fs.readFile(store.file(id, 'studio/provider-submissions'), 'utf8');
  assert.equal(await count(payload.id), '1');
  const replay = await service.create(payload); assert.equal(replay.id, payload.id);
  assert.equal(await count(payload.id), '1');
  await assert.rejects(service.create({ ...payload, buffer: Buffer.from('other') }), /REQUEST_CONFLICT/);
  process.env.MODEL3D_FIXTURE_RENDER_FAIL = '1';
  const second = { ...payload, id: randomUUID() }; await service.create(second);
  const failed = await waitFor(second.id, 'failed');
  assert.equal(failed.modelReady, true); assert.equal(failed.videoReady, undefined);
  assert.equal((await store.publicTask(failed)).canResume, true);
  delete process.env.MODEL3D_FIXTURE_RENDER_FAIL;
  await service.action(second.id, 'resume'); await waitFor(second.id, 'done');
  assert.equal(await count(second.id), '1', 'video recovery must never resubmit generation');
  process.env.MODEL3D_FIXTURE_UNCERTAIN = '1';
  const third = { ...payload, id: randomUUID() }; await service.create(third);
  const uncertain = await waitFor(third.id, 'failed');
  assert.equal(uncertain.error, 'SUBMISSION_UNCERTAIN_DO_NOT_RETRY');
  await service.create(third); assert.equal(await count(third.id), '1');
  await assert.rejects(service.action(third.id, 'resume'), /NOT_RESUMABLE/);
  delete process.env.MODEL3D_FIXTURE_UNCERTAIN;
  // A lost local process remains recoverable using exactly the same request IDs.
  const interrupted = await store.read(second.id);
  interrupted.status = 'rendering'; await store.save(interrupted);
  await fs.writeFile(store.file(second.id, 'worker.lock'), '2147483647');
  await new Promise(resolve => setTimeout(resolve, 20));
  interrupted.updatedAt = new Date(Date.now() - 20000).toISOString();
  await fs.writeFile(store.file(second.id, 'task.json'), JSON.stringify(interrupted));
  assert.equal((await store.publicTask(interrupted)).status, 'interrupted');
  await service.action(second.id, 'resume'); await waitFor(second.id, 'done');
  assert.equal(await count(second.id), '1');
  // Admission is single-flight even across another tab/process.
  const active = { ...done, id: randomUUID(), status: 'generating' };
  await fs.mkdir(store.directory(active.id)); await store.save(active);
  await assert.rejects(service.create({ ...payload, id: randomUUID() }), /TASK_ACTIVE/);
  await fs.writeFile(store.file(active.id, 'cancel'), '');
  await service.action(active.id, 'cancel'); await waitFor(active.id, 'cancelled');
  await assert.rejects(service.create({ ...payload, id: '../bad' }), /INVALID_ID/);
  console.log(JSON.stringify({ ok: true, checks: ['complete orchestration with a fake provider', 'lost HTTP response reuses the task', 'request payload conflicts rejected', 'video failure/restart keeps a single provider submission', 'uncertain provider submission is never replayed', 'dead-worker recovery', 'single-flight admission', 'cancellation and invalid IDs'], output: root }, null, 2));
}
if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixture, waitFor };
