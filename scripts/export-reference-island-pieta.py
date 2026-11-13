import bpy, sys, json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1: raise RuntimeError('Indique um caminho GLB de saída depois de --')
output=Path(args[0]).resolve()
source=(root/'../pieta1.blend').resolve()
if output==source: raise RuntimeError('A saída não pode sobrescrever a origem')
bpy.ops.wm.open_mainfile(filepath=str(source))
sculpture=bpy.data.objects['3DModel'];bpy.context.view_layer.objects.active=sculpture
if sculpture.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
for obj in bpy.context.view_layer.objects: obj.select_set(False)
sculpture.select_set(True)
sculpture.data.calc_loop_triangles()
metadata={'source':'../pieta1.blend','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceVertices':len(sculpture.data.vertices),'sourcePolygons':len(sculpture.data.polygons),'sourceTriangles':len(sculpture.data.loop_triangles)}
output.with_suffix('.source.json').write_text(json.dumps(metadata,indent=2)+'\n')
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
print('PIETA_EXPORT_BYTES',output.stat().st_size)
