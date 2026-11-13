// Geometry authored for the interface. Imported scenic GLBs stay untouched.
export function createReferenceThing(THREE, type, { size = 1, accent = '#b5823c' } = {}) {
  const group = new THREE.Group(); group.name = `thing-${type}`;
  const material = (color, metalness = .1) => new THREE.MeshStandardMaterial({ color, roughness: .58, metalness });
  const brass = material(accent, .45), steel = material('#b8c6c8', .65), wood = material('#6f3b24'), black = material('#171a20'), red = material('#c15d43'), cream = material('#e2d4af');
  function mesh(geometry, mat, xyz = [0,0,0], rotation = [0,0,0]) { const node = new THREE.Mesh(geometry, mat); node.position.set(...xyz); node.rotation.set(...rotation); group.add(node); return node; }
  const box = (w,h,d,mat,xyz,rot) => mesh(new THREE.BoxGeometry(w,h,d),mat,xyz,rot);
  const cylinder = (a,b,h,mat,xyz,rot) => mesh(new THREE.CylinderGeometry(a,b,h,24),mat,xyz,rot);
  const ring = (r,t,mat,xyz,rot) => mesh(new THREE.TorusGeometry(r,t,8,28),mat,xyz,rot);
  function tube(points, radius, mat) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),28,radius,8,false),mat); }
  switch(type) {
    case 'gramophone': {
      box(.9,.25,.75,wood,[0,.15,0]); cylinder(.31,.31,.025,black,[0,.3,.03]); cylinder(.055,.055,.05,brass,[0,.33,.03]);
      tube([[.3,.3,-.2],[.34,.65,-.32],[.18,.9,-.3]],.07,brass);
      const horn=mesh(new THREE.CylinderGeometry(.48,.075,.7,32,1,true),new THREE.MeshStandardMaterial({color:'#c49442',side:THREE.DoubleSide,metalness:.5,roughness:.45}),[-.04,1.12,-.2],[.1,0,-.65]);
      const bell=ring(.48,.026,brass,[-.25,1.4,-.18],[Math.PI/2,0,-.65]); bell.quaternion.copy(horn.quaternion); bell.rotateX(Math.PI/2);
      tube([[.47,.17,.12],[.65,.17,.12],[.65,.17,.33]],.025,steel); cylinder(.04,.04,.16,wood,[.65,.17,.33],[Math.PI/2,0,0]); break;
    }
    case 'umbrella': {
      cylinder(.025,.025,1.2,steel,[0,.6,0]);
      mesh(new THREE.SphereGeometry(.68,12,4,0,Math.PI*2,0,Math.PI*.39),new THREE.MeshStandardMaterial({color:'#ad5345',side:THREE.DoubleSide,roughness:.85}),[0,1,0]);
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;tube([[0,1.68,0],[Math.cos(a)*.4,1.55,Math.sin(a)*.4],[Math.cos(a)*.64,1.22,Math.sin(a)*.64]],.008,steel);}
      tube([[0,.18,0],[0,.02,0],[.16,-.03,0],[.22,.13,0]],.035,wood); break;
    }
    case 'scissors': {
      for(const sign of [-1,1]) { ring(.16,.045,red,[sign*.17,.18,0]); box(.065,.72,.035,steel,[sign*.13,.72,0],[0,0,-sign*.28]); }
      cylinder(.055,.055,.075,brass,[0,.45,.025],[Math.PI/2,0,0]); break;
    }
    case 'hammer': box(.12,.95,.13,wood,[0,.48,0],[0,0,-.16]); box(.62,.22,.23,steel,[-.08,1.01,0]); box(.1,.25,.12,black,[.2,1.07,0],[0,0,.35]); break;
    case 'wrench': {
      box(.13,.85,.06,steel,[0,.48,0],[0,0,-.17]);
      const head=mesh(new THREE.TorusGeometry(.2,.065,6,20,Math.PI*1.55),steel,[-.09,.97,0],[0,0,.2]); ring(.09,.035,steel,[.06,.08,0]); break;
    }
    case 'mirror': {
      box(.38,.08,.28,wood,[0,.04,0]); cylinder(.035,.035,.35,brass,[0,.22,0]);
      const frame=ring(.38,.045,brass,[0,.76,0]); frame.scale.y=1.3;
      const face=mesh(new THREE.CircleGeometry(.36,40),new THREE.MeshStandardMaterial({color:'#729ea4',metalness:.9,roughness:.18,side:THREE.DoubleSide}),[0,.76,-.01]);face.scale.y=1.3; break;
    }
    case 'triptychMirror': {
      box(1.6,.1,.42,wood,[0,.05,0]);
      const glass = new THREE.MeshStandardMaterial({color:'#557a6c',metalness:.85,roughness:.18,emissive:'#10251b',side:THREE.DoubleSide});
      for(const side of [-1,0,1]) {
        const panel = new THREE.Group(); panel.userData.mirrorPanel = true; panel.position.set(side*.53,.7,0); panel.rotation.y = -side*.42;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(.52,1.16,.09),brass); panel.add(frame);
        const face = new THREE.Mesh(new THREE.BoxGeometry(.44,1.06,.025),glass); face.position.z=.055; panel.add(face);
        const presence = new THREE.MeshBasicMaterial({color:'#99d9bd',transparent:true,opacity:.55});
        const head = new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),presence); head.position.set(0,.16,.08); panel.add(head);
        const body = new THREE.Mesh(new THREE.ConeGeometry(.11,.36,12),presence); body.position.set(0,-.09,.08); panel.add(body);
        group.add(panel);
      }
      break;
    }
    case 'key': ring(.2,.065,brass,[0,.93,0]); box(.095,.7,.08,brass,[0,.42,0]);box(.26,.09,.09,brass,[.08,.1,0]);box(.13,.08,.09,brass,[.04,.25,0]); break;
    case 'suitcase': {
      box(.86,.56,.32,wood,[0,.32,0]); box(.76,.47,.335,material('#815338'),[0,.32,0]);
      for(const x of [-.25,.25]) { box(.045,.5,.35,black,[x,.32,0]); box(.09,.09,.03,brass,[x,.48,.19]); }
      tube([[-.16,.62,0],[-.16,.77,0],[.16,.77,0],[.16,.62,0]],.035,black); break;
    }
    case 'camera': {
      box(.8,.45,.3,black,[0,.35,0]); cylinder(.16,.18,.28,steel,[0,.34,.28],[Math.PI/2,0,0]); cylinder(.13,.13,.02,black,[0,.34,.43],[Math.PI/2,0,0]);
      for(const x of [-.24,.24]) cylinder(.21,.21,.075,brass,[x,.75,0],[Math.PI/2,0,0]);box(.4,.12,.28,wood,[0,.07,0]);break;
    }
    case 'telephone': {
      box(.8,.22,.48,black,[0,.16,0]); cylinder(.18,.18,.03,brass,[0,.29,.02]);
      tube([[-.37,.38,0],[-.25,.51,0],[.25,.51,0],[.37,.38,0]],.075,black);
      cylinder(.12,.12,.15,black,[-.38,.38,0],[0,0,-.5]);cylinder(.12,.12,.15,black,[.38,.38,0],[0,0,.5]);
      tube([[.4,.4,0],[.6,.2,0],[.47,.06,.25],[.38,.1,.2]],.015,black);break;
    }
    case 'controller': {
      const shape=new THREE.Shape();shape.moveTo(-.48,-.1);shape.quadraticCurveTo(-.4,.35,0,.2);shape.quadraticCurveTo(.4,.35,.48,-.1);shape.quadraticCurveTo(.5,-.4,.25,-.25);shape.lineTo(-.25,-.25);shape.quadraticCurveTo(-.5,-.4,-.48,-.1);
      const body=mesh(new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.04,bevelThickness:.03}),black,[0,.35,0]);
      box(.2,.055,.03,cream,[-.23,.39,.2]);box(.055,.2,.03,cream,[-.23,.39,.2]);
      for(const [x,y,color] of [[.23,.47,'#d45547'],[.31,.38,'#5c9c80'],[.15,.38,'#d1b24b']])mesh(new THREE.SphereGeometry(.038,10,8),material(color),[x,y,.21]); break;
    }
    case 'magnifier': ring(.29,.055,steel,[0,.83,0]);box(.1,.58,.1,wood,[0,.29,0]);mesh(new THREE.CircleGeometry(.26,28),new THREE.MeshStandardMaterial({color:'#a3c5ce',transparent:true,opacity:.35,side:THREE.DoubleSide,metalness:.3,roughness:.15}),[0,.83,0]);break;
    case 'lamp': cylinder(.12,.13,.56,black,[0,.3,0]);cylinder(.23,.12,.22,brass,[0,.69,0]);cylinder(.2,.2,.02,cream,[0,.81,0]);box(.07,.1,.04,red,[0,.42,.14]);group.rotation.z=-.25;break;
    case 'funnel': mesh(new THREE.CylinderGeometry(.43,.07,.55,28,1,true),new THREE.MeshStandardMaterial({color:'#a7885a',side:THREE.DoubleSide,metalness:.45,roughness:.6}),[0,.62,0]);cylinder(.065,.065,.4,brass,[0,.18,0]);break;
    case 'cassette': box(.85,.5,.13,black,[0,.3,0]);box(.72,.27,.02,cream,[0,.33,.08]);for(const x of [-.2,.2]){cylinder(.085,.085,.03,steel,[x,.32,.1],[Math.PI/2,0,0]);cylinder(.045,.045,.04,black,[x,.32,.12],[Math.PI/2,0,0]);}break;
    default: box(.62,.83,.13,cream,[0,.45,0]);box(.67,.87,.025,red,[0,.45,.09]);box(.67,.87,.025,red,[0,.45,-.09]);box(.07,.87,.2,wood,[-.32,.45,0]);for(let i=0;i<3;i++)box(.42,.016,.008,brass,[.01,.58-i*.09,.107]);
  }
  group.updateMatrixWorld(true); const bounds=new THREE.Box3().setFromObject(group), extent=bounds.getSize(new THREE.Vector3()), center=bounds.getCenter(new THREE.Vector3());
  const wrapper=new THREE.Group();wrapper.name=`thing-${type}`;group.position.sub(center);group.position.y+=extent.y/2;wrapper.add(group);wrapper.scale.setScalar(size/Math.max(extent.x,extent.y,extent.z));wrapper.userData.height=extent.y*size/Math.max(extent.x,extent.y,extent.z);
  return wrapper;
}
