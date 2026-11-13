const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(root, '../modelos-3d/AR');
const target = path.join(root, 'public/references/island');
const entries = [
  ['aviao-quebrado', 'Avião quebrado', 'aviao-quebrado.glb', 'falha', 7.3, [-3.1, 0, 1.4], -.5, true],
  ['piloto', 'Piloto', 'piloto-optimized.glb', 'corpo', 2.7, [1.5, 0, 1.8], -.6, true],
  ['caixa-preta', 'Caixa-preta', 'caixa-preta.glb', 'memoria', 1.25, [-.2, 0, -1.4], .4, true],
  ['cadeira', 'Cadeira', 'cadeira-optimized.glb', 'trabalho', 1.7, [3.5, 0, -.5], -1, true],
  ['quati', 'Quati', 'quati.glb', 'travessia', 1.5, [-4.5, 0, -2.1], .7, true],
  ['borboleta', 'Borboleta', 'borboleta.glb', 'duplo', 1.1, [2.4, 1.2, -3.6], .4, true],
  ['zippo', 'Zippo', 'zippo.glb', 'memoria', .85, [-1.7, 0, 4.4], .3, false],
  ['cigarro', 'Cigarro', 'cigarro.glb', 'corpo', .8, [2.8, 0, 4.6], .9, false],
  ['oculos', 'Óculos', 'oculos.glb', 'duplo', 1.1, [4.6, 0, -2.6], .4, false],
  ['medalha', 'Medalha', 'medalha.glb', 'memoria', .85, [-4.5, 0, 3.5], .2, false],
  ['braco', 'Braço', 'braco.glb', 'corpo', 1.35, [4.5, 0, 2.9], -.5, false],
  ['perna', 'Perna', 'perna.glb', 'corpo', 1.5, [5.2, 0, 1.2], .9, false],
  ['ra', 'Rã', 'ra.glb', 'jogo', .8, [-2, 0, -4.8], .5, false]
];
fs.mkdirSync(path.join(target, 'models'), { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const models = entries.map(([id, label, filename, topic, size, position, rotation, initial]) => {
  const bytes = fs.readFileSync(path.join(sourceRoot, filename));
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw Error('Invalid GLB: ' + filename);
  const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  const triangles = (json.meshes || []).flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + (primitive.indices === undefined ? 0 : json.accessors[primitive.indices].count / 3), 0);
  const destination = path.join(target, 'models', id + '.glb');
  fs.writeFileSync(destination, bytes);
  if (sha(fs.readFileSync(destination)) !== sha(bytes)) throw Error('Copy differs: ' + filename);
  return { id, label, topic, size, position, rotation, initial, url: '/references/island/models/' + id + '.glb',
    source: '../modelos-3d/AR/' + filename, bytes: bytes.length, sha256: sha(bytes), triangles, extensions: json.extensionsRequired || [],
    provenance: 'Modelo local da peça, copiado byte a byte. A apresentação holográfica altera somente a luz e a exibição, sem editar o arquivo original.' };
});
const dracoRoot = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
fs.mkdirSync(path.join(target, 'draco'), { recursive: true });
for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) fs.copyFileSync(path.join(dracoRoot, file), path.join(target, 'draco', file));
fs.copyFileSync(path.join(root, 'node_modules/three/LICENSE'), path.join(target, 'draco/THREE-LICENSE.txt'));
const pietaArg = process.argv.indexOf('--pieta-glb');
const pietaMetadata = path.join(target, 'pieta-source.json');
if (pietaArg >= 0) {
  const bytes = fs.readFileSync(process.argv[pietaArg + 1]);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const triangles = json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
  const original = JSON.parse(fs.readFileSync(process.argv[pietaArg + 1].replace(/\.glb$/, '.source.json'), 'utf8'));
  if (triangles !== original.sourceTriangles) throw Error('Pietà export must preserve all source triangles.');
  const zipped = require('node:zlib').gzipSync(bytes, { level: 6, mtime: 0 });
  fs.writeFileSync(path.join(target, 'models/pieta.glb.gz'), zipped);
  fs.writeFileSync(pietaMetadata, JSON.stringify({ id: 'pieta', label: 'Pietà', topic: 'corpo', size: 3.2, position: [0, 0, -5], rotation: -.3, initial: false,
    url: '/api/reference-island/pieta', storagePath: 'public/references/island/models/pieta.glb.gz',
    source: '../pieta1.blend', ...original,
    bytes: bytes.length, transferBytes: zipped.length, sha256: sha(bytes), fileSha256: sha(zipped), triangles, extensions: json.extensionsRequired || [],
    provenance: 'Exportada do objeto 3DModel de pieta1.blend, sem decimar a malha, com materiais e texturas. Arquivo GLB em gzip sem perda; carregamento somente sob demanda.' }, null, 2) + '\n');
}
if (fs.existsSync(pietaMetadata)) {
  const pieta = JSON.parse(fs.readFileSync(pietaMetadata, 'utf8'));
  if (sha(fs.readFileSync(path.join(root, pieta.storagePath))) !== pieta.fileSha256) throw Error('Pietà compressed source differs.');
  models.push(pieta);
}
const manifest = { version: 1, source: 'Modelos locais da pasta Caixa Preta', models, limits: ['A geometria visual não é conhecimento textual lido pelo bot.', 'Pontes entre objetos e referências são propostas curatoriais; não atribuem a autoria dos modelos a uma pessoa.'] };
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ models: models.length, bytes: models.reduce((sum, model) => sum + model.bytes, 0), exactCopies: entries.length, faithfulExports: models.length - entries.length }));
