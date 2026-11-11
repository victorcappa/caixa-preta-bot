"""Preserve GLB materials; turn around source Y (Blender Z after glTF import)."""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

settings = json.load(open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8'))
view = json.load(open(os.path.join(os.path.dirname(__file__), '../lib/model-3d/turntable-view.json'), encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=settings['input'])
scene = bpy.context.scene
objects = list(scene.objects)
meshes = [obj for obj in objects if obj.type == 'MESH']
if not meshes:
    raise RuntimeError('EMPTY_MODEL')
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (low + high) / 2
radius = max(math.hypot(p.x - center.x, p.y - center.y) for p in points)
height = max(high.z - low.z, 0.01)
pivot = bpy.data.objects.new('Source Y turntable', None)
scene.collection.objects.link(pivot)
pivot.location = center
bpy.context.view_layer.update()
for obj in objects:
    if obj.parent is None:
        matrix = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = matrix

renderer = settings.get('renderer', 'eevee')
if renderer == 'cycles':
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
elif renderer == 'eevee':
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    if hasattr(scene.eevee, 'taa_render_samples'):
        scene.eevee.taa_render_samples = 32
else:
    raise ValueError('INVALID_RENDERER')
scene.render.resolution_x = settings['width']
scene.render.resolution_y = settings['height']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.film_transparent = False
scene.render.fps = settings['fps']
scene.world = bpy.data.worlds.new('Black background')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
scene.view_settings.view_transform = 'AgX'
distance = max(radius * 5, height * 3, 1)
elevation = math.radians(view['elevationDegrees'])
azimuth = math.radians(view['azimuthDegrees'])
aspect = settings['width'] / settings['height']
projected_height = height * math.cos(elevation) + 2 * radius * math.sin(elevation)
camera_data = bpy.data.cameras.new('Turntable camera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = max(2 * radius, projected_height * aspect) * view['padding']
camera_data.clip_end = distance * 20
camera = bpy.data.objects.new('Turntable camera', camera_data)
scene.collection.objects.link(camera)
camera.location = center + Vector((distance * math.cos(elevation) * math.sin(azimuth),
                                   -distance * math.cos(elevation) * math.cos(azimuth),
                                   distance * math.sin(elevation)))
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
for name, offset, energy in [('Key', (-2, -3, 4), 1000), ('Fill', (3, -2, 1), 700), ('Rim', (0, 3, 3), 1200)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy * max(radius, height / 2, 0.1) ** 2
    data.shape = 'DISK'
    data.size = max(radius * 4, height * 2)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = center + Vector(offset) * max(radius, height / 2, 0.1)
    obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()

os.makedirs(settings['output'], exist_ok=True)
for frame in range(settings['frames']):
    target = os.path.join(settings['output'], f'{frame:04d}.png')
    if not os.path.exists(target):
        # Excluding the duplicate 360-degree endpoint keeps the loop speed constant.
        pivot.rotation_euler.z = 2 * math.pi * frame / settings['frames']
        scene.render.filepath = target + '.partial.png'
        bpy.ops.render.render(write_still=True)
        os.replace(scene.render.filepath, target)
    print(f'CP3D_FRAME:{frame + 1}', flush=True)
