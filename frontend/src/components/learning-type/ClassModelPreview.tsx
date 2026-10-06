import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createClassModels, createSoftShadow } from './classModels'

function disposeModel(model: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  materials.forEach(material => material.dispose())
}

export default function ClassModelPreview({ position }: { position: number }) {
  const host = useRef<HTMLDivElement>(null)
  const target = useRef(position)
  const modelFactory = useRef(createClassModels)
  const requestRender = useRef<() => void>(() => {})
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [rendererVersion, setRendererVersion] = useState(0)
  useEffect(() => { target.current = position; requestRender.current() }, [position])
  useEffect(() => {
    let disposed = false
    import.meta.hot?.accept('./classModels', module => {
      if (disposed || !module) return
      modelFactory.current = module.createClassModels
      setRendererVersion(version => version + 1)
    })
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    let frame = 0
    let contextLost = false
    let hasRendered = false
    queueMicrotask(() => { if (!disposed) setStatus('loading') })
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' }) }
    catch (initialError) {
      // Allow the browser to create a simpler context if multisampling is unavailable.
      try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'default' }) }
      catch (error) {
        console.error('Unable to initialize class model WebGL renderer', { initialError, error })
        queueMicrotask(() => { if (!disposed) setStatus('failed') })
        return () => { disposed = true }
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-3, 3, 2.6, -2.6, .1, 40)
    camera.position.set(0, 2.2, 8)
    camera.lookAt(0, 0, 0)
    const environment = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environmentMap = environment.fromScene(room, .04)
    scene.environment = environmentMap.texture
    scene.environmentIntensity = .55
    room.dispose()
    environment.dispose()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9b9b9b, 1.4))
    const key = new THREE.DirectionalLight(0xffffff, 1.9)
    key.position.set(-3, 5, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 1.3)
    rim.position.set(4, 2, -3)
    scene.add(rim)


    const slots = modelFactory.current().map((model, index) => {
      const group = new THREE.Group()
      const shadow = createSoftShadow()
      group.add(model.object, shadow)
      scene.add(group)
      return { group, model, index }
    })
    const initialPosition = target.current
    let selectedIndex = THREE.MathUtils.euclideanModulo(initialPosition, slots.length)
    let transitionTime = 0
    let tiltX = 0
    let tiltY = 0
    let pointerX = 0
    let pointerY = 0
    let pageVisible = !document.hidden
    let inView = true
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motion.matches
    const stage = element.parentElement!
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const bounds = stage.getBoundingClientRect()
      pointerX = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width - .5, -.5, .5)
      pointerY = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height - .5, -.5, .5)
    }
    const onLeave = () => { pointerX = 0; pointerY = 0 }
    const onMotionChange = () => { reducedMotion = motion.matches; resume() }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      const aspect = width / height
      // Frame the selected model and its shadow without clipping on narrow screens.
      const halfHeight = Math.max(2.3, 1.85 / aspect)
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      requestRender.current()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    resize()

    let lastTime = 0
    let elapsed = 0
    const draw = (time: number) => {
      frame = 0
      if (disposed || contextLost || !pageVisible || !inView) return
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : .016
      lastTime = time
      elapsed += delta
      const nextIndex = THREE.MathUtils.euclideanModulo(target.current, slots.length)
      if (nextIndex !== selectedIndex) {
        selectedIndex = nextIndex
        transitionTime = 0
      }
      transitionTime += delta
      tiltX = THREE.MathUtils.damp(tiltX, reducedMotion ? 0 : pointerY * .22, 6, delta)
      tiltY = THREE.MathUtils.damp(tiltY, reducedMotion ? 0 : pointerX * .5, 6, delta)
      for (const slot of slots) {
        slot.group.visible = slot.index === selectedIndex
        if (!slot.group.visible) continue
        const enter = reducedMotion ? 0 : Math.sin(Math.min(transitionTime / .7, 1) * Math.PI)
        slot.group.position.set(0, -.02 + (reducedMotion ? 0 : Math.sin(elapsed * 1.3) * .045 + enter * .08), 0)
        slot.group.scale.setScalar(reducedMotion ? 1.12 : THREE.MathUtils.lerp(1.02, 1.12, THREE.MathUtils.smoothstep(transitionTime, 0, .4)))
        const [x, y, z] = slot.model.rotation
        const [gestureX, gestureY, gestureZ] = slot.model.gesture
        // Animate only the root: covers, keys, glass, and liquid keep their fixed alignment.
        slot.model.object.rotation.set(
          x + tiltX + gestureX * enter,
          y + tiltY + (reducedMotion ? 0 : Math.sin(elapsed * .6) * .06) + gestureY * enter,
          z + gestureZ * enter,
        )
      }
      renderer.render(scene, camera)
      if (!hasRendered) { hasRendered = true; setStatus('ready') }
      if (!reducedMotion) frame = requestAnimationFrame(render)
    }
    const render = (time: number) => {
      try { draw(time) }
      catch (error) {
        console.error('Unable to render class models', error)
        frame = 0
        setStatus('failed')
      }
    }
    const resume = () => {
      if (!disposed && !contextLost && pageVisible && inView && !frame) { lastTime = 0; frame = requestAnimationFrame(render) }
    }
    requestRender.current = resume
    const onVisibility = () => { pageVisible = !document.hidden; resume() }
    const intersectionObserver = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; resume() })
    intersectionObserver.observe(element)
    const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; setStatus('failed') }
    const onContextRestored = () => { if (!disposed) setRendererVersion(version => version + 1) }
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)
    document.addEventListener('visibilitychange', onVisibility)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerleave', onLeave)
    stage.addEventListener('pointerup', onLeave)
    motion.addEventListener('change', onMotionChange)

    resume()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      requestRender.current = () => {}
      document.removeEventListener('visibilitychange', onVisibility)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      stage.removeEventListener('pointerup', onLeave)
      motion.removeEventListener('change', onMotionChange)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      slots.forEach(slot => disposeModel(slot.group))
      environmentMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  // Rebuild when model definitions change during development or WebGL recovers.
  }, [rendererVersion])

  return <div className="class-models" ref={host} data-position={position} data-render-status={status} aria-hidden="true">
    {status === 'loading' && <div className="class-model-loading"><span /></div>}
    {status === 'failed' && <div className="class-model-fallback">{['∴', '∑', '⚗', '◇'][THREE.MathUtils.euclideanModulo(position, 4)]}</div>}
  </div>
}
