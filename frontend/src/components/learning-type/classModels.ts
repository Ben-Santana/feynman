import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

export type ClassModel = {
  object: THREE.Group
  rotation: [number, number, number]
  gesture: [number, number, number]
}

const clay = (color: string, roughness = .48) => new THREE.MeshPhysicalMaterial({
  color, roughness, metalness: 0, clearcoat: .22, clearcoatRoughness: .5,
})

// A rounded outline with a rounded depth, rather than softened normals on a box.
function cushion(width: number, height: number, depth: number, radius: number) {
  const shape = new THREE.Shape()
  const x = -width / 2, y = -height / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  const bevel = Math.min(depth * .35, .085)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 5, curveSegments: 12, steps: 1,
  })
  geometry.translate(0, 0, -depth / 2 + bevel)
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const smooth = mergeVertices(geometry, 1e-5)
  smooth.computeVertexNormals()
  geometry.dispose()
  return smooth
}

function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function turned(points: number[][]) {
  const curve = new THREE.SplineCurve(points.map(([radius, height]) => new THREE.Vector2(radius, height)))
  // Clamp tiny spline overshoots at the poles of the closed surface.
  return new THREE.LatheGeometry(curve.getPoints(72).map(point => new THREE.Vector2(Math.max(0, point.x), point.y)), 64)
}

function bookCover() {
  // One continuous binding, wrapped from the front cover around the spine to the back.
  const shape = new THREE.Shape()
  shape.moveTo(.975, .34)
  shape.lineTo(-.78, .34)
  shape.absarc(-.78, 0, .34, Math.PI / 2, Math.PI * 1.5, false)
  shape.lineTo(.975, -.34)
  shape.lineTo(.975, -.22)
  shape.lineTo(-.78, -.22)
  shape.absarc(-.78, 0, .22, -Math.PI / 2, -Math.PI * 1.5, true)
  shape.lineTo(.975, .22)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.45, bevelEnabled: true, bevelThickness: .04, bevelSize: .035,
    bevelSegments: 5, curveSegments: 24, steps: 1,
  })
  geometry.translate(0, 0, -1.225)
  geometry.rotateX(Math.PI / 2)
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const smooth = mergeVertices(geometry, 1e-5)
  smooth.computeVertexNormals()
  geometry.dispose()
  return smooth
}

function book(): ClassModel {
  const object = new THREE.Group()
  const red = clay('#e74b43'), paper = clay('#e7e5e2', .75)
  const pageEdge = clay('#cccac7', .8)
  add(object, cushion(1.78, 2.35, .44, .19), paper, .06)
  add(object, bookCover(), red)
  for (const z of [-.12, 0, .12]) {
    add(object, cushion(.015, 2.03, .009, .006), pageEdge, .94, 0, z)
    add(object, cushion(1.49, .012, .009, .005), pageEdge, .08, 1.18, z)
  }
  return { object, rotation: [.06, -.55, -.13], gesture: [.07, .2, -.06] }
}

function calculator(): ClassModel {
  const object = new THREE.Group()
  const red = clay('#e74b43'), white = clay('#eeece9'), grey = clay('#b8b7b4'), dark = clay('#555552')
  add(object, cushion(1.9, 2.6, .46, .34), red)
  add(object, cushion(1.5, .64, .075, .15), grey, 0, .76, .265)
  // A single quiet equals sign keeps the display clean.
  for (const y of [.7, .82]) add(object, cushion(.35, .027, .014, .013), dark, .4, y, .315)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    add(object, cushion(.34, .32, .115, .12), row === 2 && col === 2 ? dark : white, (col - 1) * .51, .12 - row * .48, .29)
  }
  return { object, rotation: [.12, -.28, -.12], gesture: [.14, -.08, .035] }
}

function flask(): ClassModel {
  const object = new THREE.Group()
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#d6d5d3', roughness: .13, metalness: 0, clearcoat: 1,
    transparent: true, opacity: .24, depthWrite: false, side: THREE.FrontSide,
  })
  const red = clay('#e74b43', .3), rim = clay('#dddcd9', .3)
  object.scale.setScalar(1.08)
  const shell = add(object, turned([
    [0, -1.18], [.47, -1.13], [.82, -.89], [.98, -.5], [.94, -.08],
    [.68, .36], [.35, .7], [.31, 1.12], [.33, 1.24],
  ]), glass)
  shell.renderOrder = 3
  add(object, turned([[0, -1.1], [.43, -1.04], [.76, -.81], [.89, -.49], [.88, -.28]]), red)
  add(object, new THREE.CylinderGeometry(.876, .876, .035, 64), red, 0, -.28)
  const lip = add(object, new THREE.TorusGeometry(.325, .06, 16, 64), rim, 0, 1.22)
  lip.rotation.x = Math.PI / 2
  for (const [i, x] of [-.34, .18, .4].entries()) {
    add(object, new THREE.SphereGeometry(.04 + i * .008, 20, 12), rim, x, -.13 + i * .14, .15)
  }
  return { object, rotation: [.03, .2, -.1], gesture: [.04, .08, .1] }
}

function pencil(): ClassModel {
  const object = new THREE.Group()
  const red = clay('#e74b43'), grey = clay('#d6d4d1'), tip = clay('#535350')
  add(object, turned([[0, -.91], [.26, -.91], [.29, -.8], [.29, .9], [.26, 1.02], [0, 1.02]]), red)
  add(object, turned([[0, -1.49], [.075, -1.4], [.22, -1.05], [.265, -.9], [0, -.9]]), grey)
  add(object, turned([[0, -1.56], [.045, -1.53], [.078, -1.4], [0, -1.4]]), tip)
  add(object, turned([[0, .98], [.275, .98], [.29, 1.05], [.29, 1.22], [.24, 1.37], [0, 1.42]]), grey)
  return { object, rotation: [0, -.15, -.48], gesture: [.04, .25, -.18] }
}

export function createClassModels(): ClassModel[] {
  return [book(), calculator(), flask(), pencil()]
}

export function createSoftShadow() {
  // A procedural feathered shadow. No texture, image asset, or hard contact edge.
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity: { value: .11 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv; uniform float opacity; void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.25,.24,.23,(1.-smoothstep(0.,1.,d))*opacity);}',
  })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1), material)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.8
  return shadow
}
