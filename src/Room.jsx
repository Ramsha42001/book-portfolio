import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Line, OrbitControls, Sparkles, Stars, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import {
  AdditiveBlending,
  BackSide,
  Box3,
  CatmullRomCurve3,
  Color,
  BufferGeometry,
  BufferAttribute,
  CanvasTexture,
  DoubleSide,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import { Candle, BookStack } from './AmbientScene.jsx'
import { AboutPage, ExperiencePage, SkillsPage, EducationPage, ContactPage } from './pages.jsx'
import {
  barkSound,
  crackleSound,
  creakSound,
  doorbellSound,
  knockSound,
  pageSound,
  setRainWindowOpen,
  startNature,
  startRain,
  stopNature,
  stopRain,
  strikeSound,
  thunderSound,
  tossSound,
  whimperSound,
  whooshSound,
} from './audio.js'

const cursorOn = (e) => {
  e.stopPropagation()
  document.body.style.cursor = 'pointer'
}
const cursorOff = () => {
  document.body.style.cursor = 'default'
}

const SPINE_COLORS = ['#c2704e', '#8a9b84', '#5b6d7c', '#d9c1a3', '#b0a08c', '#4a4a48', '#e0d5c2']

// deterministic pseudo-random — same shelf every visit
const hash = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

// procedural wood grain — vertical streaks + knots on a canvas, no image assets
function makeWood({ base, planks = 0, repeat = [1, 1] }) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 170; i++) {
    const x = hash(i) * 512
    g.strokeStyle = `rgba(18,9,3,${0.05 + hash(i + 9) * 0.11})`
    g.lineWidth = 1 + hash(i + 3) * 3
    g.beginPath()
    g.moveTo(x, 0)
    g.bezierCurveTo(
      x + 24 * hash(i + 1) - 12, 170,
      x - 24 * hash(i + 2) + 12, 340,
      x + 16 * hash(i + 4) - 8, 512
    )
    g.stroke()
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(15,7,2,${0.15 + hash(i + 31) * 0.15})`
    g.beginPath()
    g.ellipse(hash(i + 11) * 512, hash(i + 17) * 512, 4 + hash(i + 23) * 6, 9 + hash(i + 29) * 12, 0.3, 0, Math.PI * 2)
    g.fill()
  }
  if (planks) {
    g.strokeStyle = 'rgba(10,5,2,0.55)'
    g.lineWidth = 2
    for (let i = 1; i < planks; i++) {
      g.beginPath()
      g.moveTo((512 / planks) * i, 0)
      g.lineTo((512 / planks) * i, 512)
      g.stroke()
    }
  }

  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(...repeat)
  tex.anisotropy = 8
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Wood({ position, size, map, color = '#3d2b1f', rotation }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={map} color={map ? '#ffffff' : color} roughness={0.75} />
    </mesh>
  )
}

const SHELF_YS = [0.35, 1.15, 1.95, 2.75]

function Bookshelf({ wood }) {
  const rows = useMemo(
    () =>
      SHELF_YS.map((y, r) => {
        const books = []
        let x = -1.32
        let i = 0
        while (x < 1.3) {
          if (r === 1 && x + 0.2 > 0.38 && x < 0.64) {
            x = 0.64
            continue
          }
          const w = 0.08 + hash(r * 31 + i) * 0.1
          if (x + w > 1.32) break
          const h = 0.52 + hash(r * 31 + i + 50) * 0.2
          books.push({
            x: x + w / 2,
            y: y + 0.03 + h / 2,
            w,
            h,
            color: SPINE_COLORS[Math.floor(hash(r * 31 + i + 99) * SPINE_COLORS.length)],
            rough: 0.75 + hash(r * 31 + i + 200) * 0.2,
          })
          x += w + 0.018
          i++
        }
        return books
      }),
    []
  )

  return (
    <group position={[-1.2, 0, -2.75]}>
      <Wood position={[-1.46, 1.68, 0]} size={[0.08, 3.44, 0.6]} map={wood} />
      <Wood position={[1.46, 1.68, 0]} size={[0.08, 3.44, 0.6]} map={wood} />
      <Wood position={[0, 3.36, 0]} size={[3, 0.08, 0.6]} map={wood} />
      {/* crown molding */}
      <Wood position={[0, 3.45, 0.02]} size={[3.16, 0.1, 0.7]} map={wood} />
      <Wood position={[0, 1.65, -0.27]} size={[2.84, 3.34, 0.04]} color="#efe8db" />
      {SHELF_YS.map((y) => (
        <Wood key={y} position={[0, y, 0]} size={[2.84, 0.06, 0.58]} map={wood} />
      ))}
      {rows.flat().map((b, j) => (
        <DecoBook key={j} {...b} />
      ))}
    </group>
  )
}

// decorative spines slide out a little when you brush over them
function DecoBook({ x, y, w, h, color, rough }) {
  const ref = useRef()
  const [hov, setHov] = useState(false)

  useFrame(() => {
    if (ref.current) ref.current.position.z += ((hov ? 0.09 : 0) - ref.current.position.z) * 0.15
  })

  return (
    <mesh
      ref={ref}
      position={[x, y, 0]}
      castShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        setHov(true)
      }}
      onPointerOut={() => setHov(false)}
    >
      <boxGeometry args={[w, h, 0.5]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  )
}

function Desk({ wood }) {
  return (
    <group position={[1.8, 0, -0.35]}>
      <Wood position={[0, 1.05, 0]} size={[2.2, 0.08, 1.2]} map={wood} />
      {/* aprons under the top */}
      <Wood position={[0, 0.94, 0.5]} size={[2.0, 0.14, 0.06]} color="#a98f6b" />
      <Wood position={[0, 0.94, -0.5]} size={[2.0, 0.14, 0.06]} color="#a98f6b" />
      <Wood position={[0.99, 0.94, 0]} size={[0.06, 0.14, 1.0]} color="#a98f6b" />
      <Wood position={[-0.99, 0.94, 0]} size={[0.06, 0.14, 1.0]} color="#a98f6b" />
      {[-1, 1].map((sx) =>
        [-0.45, 0.45].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx, 0.52, sz]} castShadow>
            <cylinderGeometry args={[0.045, 0.06, 1.02, 10]} />
            <meshStandardMaterial color="#8a7355" roughness={0.7} />
          </mesh>
        ))
      )}
    </group>
  )
}

function Rug() {
  return (
    <group position={[0.5, 0, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0, 0.01]} receiveShadow>
        <circleGeometry args={[1.9, 48]} />
        <meshStandardMaterial color="#e3d9c8" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[1.55, 1.62, 48]} />
        <meshStandardMaterial color="#c2704e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <circleGeometry args={[1.1, 48]} />
        <meshStandardMaterial color="#ede4d3" roughness={1} />
      </mesh>
    </group>
  )
}

// puffy cloud bank: clumps of moonlit-graded circles, drawn thrice around the
// wrap seam so drifting clouds never clip at the texture edge
function makeClouds(seed, scale, alpha) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  for (let n = 0; n < 4; n++) {
    const bx = hash(seed + n * 13) * 256
    const by = 36 + hash(seed + n * 7 + 3) * 130
    const puffs = 11
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1)
      const px = bx + (t - 0.5) * 120 * scale + (hash(seed + n * 31 + p) - 0.5) * 16
      const py = by + (hash(seed + n * 17 + p * 3) - 0.5) * 18 - Math.sin(t * Math.PI) * 8
      const r = (10 + hash(seed + n * 23 + p * 5) * 12) * scale * (0.45 + Math.sin(t * Math.PI) * 0.55)
      for (const ox of [-256, 0, 256]) {
        const grad = g.createRadialGradient(px + ox, py - r * 0.25, r * 0.1, px + ox, py, r)
        grad.addColorStop(0, `rgba(196,206,230,${alpha})`)
        grad.addColorStop(0.65, `rgba(150,162,190,${alpha * 0.55})`)
        grad.addColorStop(1, 'rgba(150,162,190,0)')
        g.fillStyle = grad
        g.beginPath()
        g.arc(px + ox, py, r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.colorSpace = SRGBColorSpace
  return tx
}

const WEATHER = {
  night: {
    bg: '#0a0d16',
    fog: ['#131624', 11, 34],
    dome: ['#0a0f1e', '#1c2440', '#3a4468'],
    ambient: 0.45,
    hemi: 0.4,
    dirColor: '#8ea2c9',
    dirInt: 0.9,
    env: 'night',
    sky: ['#232c48', '#141b30', '#0a0f1c'],
  },
  morning: {
    bg: '#c9a273',
    fog: ['#c9a273', 12, 45],
    dome: ['#6f9cc9', '#d9a86a', '#f5d7a0'],
    ambient: 0.75,
    hemi: 0.7,
    dirColor: '#ffd9a0',
    dirInt: 1.7,
    env: 'dawn',
    sky: ['#7fa8d4', '#d9a86a', '#f0cfa0'],
  },
}

function makeSkyTex(colors) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, colors[0])
  grad.addColorStop(0.6, colors[1])
  grad.addColorStop(1, colors[2])
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.colorSpace = SRGBColorSpace
  return tx
}

// velvet with vertical fold shading and a gold hem
function makeCurtainTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  // rust velvet — pops against the cream walls instead of vanishing into them
  g.fillStyle = '#b56a4a'
  g.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x++) {
    const fold = Math.sin(x * 0.2) * 0.5 + 0.5
    g.fillStyle = `rgba(60,25,12,${0.34 * fold})`
    g.fillRect(x, 0, 1, 256)
    const hi = Math.max(0, Math.sin(x * 0.2 + 1.3)) ** 3 * 0.16
    g.fillStyle = `rgba(255,220,190,${hi})`
    g.fillRect(x, 0, 1, 256)
  }
  g.fillStyle = '#8a4a30'
  g.fillRect(0, 244, 256, 12)
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.colorSpace = SRGBColorSpace
  return tx
}

// one pane of real glass — the actual world shows through it
function Glass({ w, h, rain, raining }) {
  return (
    <>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color="#cfe0ee"
          transparent
          opacity={0.14}
          roughness={0.05}
          metalness={0.1}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {raining && (
        <mesh position={[0, 0, 0.004]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={rain} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}

function Window({ position, rain }) {
  const [open, setOpen] = useState(false)
  const [drawn, setDrawn] = useState(false) // curtains pulled shut?
  const leftSash = useRef()
  const rightSash = useRef()
  const leftCur = useRef()
  const rightCur = useRef()

  const curtainTex = useMemo(() => makeCurtainTex(), [])

  const toggleWindow = (e) => {
    e.stopPropagation()
    const next = !open
    setOpen(next)
    setRainWindowOpen(next)
    creakSound()
  }

  const toggleCurtains = (e) => {
    e.stopPropagation()
    setDrawn((d) => !d)
  }

  // falling rain streaks, scrolled fast
  const rainTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 256
    const g = c.getContext('2d')
    for (let i = 0; i < 42; i++) {
      const x = hash(i + 51) * 128
      const y = hash(i + 77) * 256
      g.strokeStyle = `rgba(200,215,235,${0.12 + hash(i + 91) * 0.25})`
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x - 2, y + 14 + hash(i + 101) * 18)
      g.stroke()
    }
    const tx = new CanvasTexture(c)
    tx.wrapS = tx.wrapT = RepeatWrapping
    return tx
  }, [])

  useFrame((_, delta) => {
    rainTex.offset.y += delta * 0.75

    const k = Math.min(1, delta * 4.5)
    for (const [ref, side] of [[leftSash, -1], [rightSash, 1]]) {
      if (ref.current) {
        const target = open ? -side * 1.45 : 0 // sashes swing outward
        ref.current.rotation.y += (target - ref.current.rotation.y) * k
      }
    }
    for (const [ref, side] of [[leftCur, -1], [rightCur, 1]]) {
      if (ref.current) {
        const sx = drawn ? 1 : 0.28 // full width shut, bunched at the sides open
        ref.current.scale.x += (sx - ref.current.scale.x) * k
        // outer edge stays anchored at the rod's end while the panel gathers
        ref.current.position.x = side * (1.22 - 0.55 * ref.current.scale.x)
        // cloth swings a little while it's moving, settles when it stops
        ref.current.rotation.y = side * (sx - ref.current.scale.x) * 1.2
      }
    }
    // gathered curtains show MORE folds per width — compress the fold texture
    if (leftCur.current) {
      curtainTex.repeat.x = 1 / Math.max(0.3, leftCur.current.scale.x)
    }
  })

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* no painted backdrop anymore — the wall has a real opening and the
          actual sky dome, fog and trees are what you see through the glass */}

      {/* generous invisible click zones — the moving parts themselves become
          tiny or edge-on targets, so these stay put and stay clickable */}
      <mesh
        position={[0, 0, 0.02]}
        onClick={(e) => {
          e.stopPropagation()
          if (drawn) setDrawn(false) // curtains shut? clicking the window opens them first
          else toggleWindow(e)
        }}
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
      >
        <planeGeometry args={[1.86, 2.36]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {[-1.22, 1.22].map((x) => (
        <mesh
          key={x}
          position={[x, 0.06, 0.17]}
          onClick={toggleCurtains}
          onPointerOver={cursorOn}
          onPointerOut={cursorOff}
        >
          <planeGeometry args={[0.48, 2.7]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* casing */}
      <Wood position={[0, 1.24, 0]} size={[2.14, 0.12, 0.18]} color="#2e2e2e" />
      <Wood position={[-1.01, 0, 0]} size={[0.12, 2.6, 0.18]} color="#2e2e2e" />
      <Wood position={[1.01, 0, 0]} size={[0.12, 2.6, 0.18]} color="#2e2e2e" />

      {/* two casement sashes, hinged at the outer edges — click to open */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side === -1 ? leftSash : rightSash} position={[side * 0.93, 0, 0.02]}>
          <group
            position={[-side * 0.465, 0, 0]}
            onClick={toggleWindow}
            onPointerOver={cursorOn}
            onPointerOut={cursorOff}
          >
            {/* open sash frame — stiles, rails, and actual see-through glass */}
            {[
              [[-0.42, 0, 0], [0.06, 2.36, 0.05]],
              [[0.42, 0, 0], [0.06, 2.36, 0.05]],
              [[0, 1.15, 0], [0.9, 0.07, 0.05]],
              [[0, -1.15, 0], [0.9, 0.07, 0.05]],
              [[0, 0, 0], [0.9, 0.09, 0.05]],
            ].map(([p, sz], j) => (
              <mesh key={j} position={p} castShadow>
                <boxGeometry args={sz} />
                <meshStandardMaterial color="#2e2e2e" roughness={0.7} />
              </mesh>
            ))}
            {[0.59, -0.59].map((py) => (
              <group key={py} position={[0, py, 0]}>
                <Glass w={0.78} h={1.06} rain={rainTex} raining={rain} />
              </group>
            ))}
          </group>
        </group>
      ))}

      {/* brass rod, finials, velvet curtains — click to draw them */}
      <mesh position={[0, 1.42, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 2.75, 12]} />
        <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.42, 0.18]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          ref={side === -1 ? leftCur : rightCur}
          position={[side * 1.06, 0.06, 0.16]}
          onClick={toggleCurtains}
          onPointerOver={cursorOn}
          onPointerOut={cursorOff}
          castShadow
        >
          <planeGeometry args={[1.1, 2.68]} />
          <meshStandardMaterial map={curtainTex} side={DoubleSide} roughness={0.9} />
        </mesh>
      ))}

      {/* sill */}
      <Wood position={[0, -1.26, 0.1]} size={[2.14, 0.09, 0.3]} color="#2e2e2e" />
    </group>
  )
}

// shared so the cloud field can catch the lightning's glow
const stormState = { flash: 0 }
const FLASH_WHITE = new Color('#e8edf8')

// real 3D clouds drifting overhead: thin and pale on clear nights, heavy and
// dark in rain, brightening when lightning fires behind them
function makePuffTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62)
  grad.addColorStop(0, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

// oak stairs climbing across the FRONT of the house — fully visible from the
// yard — up to a lantern-lit landing at the roof's edge
function RoofStairs() {
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[8.5 - i * 0.36, 0.32 + i * 0.35, 6.0]} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.09, 1.05]} />
          <meshStandardMaterial color="#b08e64" roughness={0.8} />
        </mesh>
      ))}
      {/* support posts to the ground */}
      {[2, 5, 8, 11].map((i) => (
        <mesh key={i} position={[8.5 - i * 0.36, (0.32 + i * 0.35) / 2, 6.0]}>
          <boxGeometry args={[0.09, 0.32 + i * 0.35, 0.09]} />
          <meshStandardMaterial color="#8a7355" roughness={0.85} />
        </mesh>
      ))}
      {/* sloped handrail + posts on the yard side */}
      <mesh position={[6.52, 3.15, 6.5]} rotation={[0, 0, 0.768]}>
        <boxGeometry args={[5.7, 0.07, 0.06]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>
      {[0, 3, 6, 9, 11].map((i) => (
        <mesh key={i} position={[8.5 - i * 0.36, 0.32 + i * 0.35 + 0.42, 6.5]}>
          <cylinderGeometry args={[0.025, 0.03, 0.85, 8]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
        </mesh>
      ))}
      {/* landing at the eave, right of the windows */}
      <mesh position={[3.95, 4.42, 6.0]} castShadow>
        <boxGeometry args={[1.25, 0.09, 1.25]} />
        <meshStandardMaterial color="#b08e64" roughness={0.8} />
      </mesh>
      <mesh position={[3.95, 2.2, 6.45]}>
        <boxGeometry args={[0.09, 4.4, 0.09]} />
        <meshStandardMaterial color="#8a7355" roughness={0.85} />
      </mesh>
      <mesh position={[3.95, 5.28, 6.55]}>
        <boxGeometry args={[1.25, 0.07, 0.06]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>
      {[3.4, 4.5].map((x) => (
        <mesh key={x} position={[x, 4.87, 6.55]}>
          <cylinderGeometry args={[0.025, 0.03, 0.85, 8]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <LanternModel position={[4.4, 4.48, 5.7]} height={0.5} />
      </Suspense>
      <pointLight position={[4.3, 5.1, 5.9]} intensity={8} color="#e8a54b" distance={6} decay={2} />
    </group>
  )
}

// lazy grey curls from the chimney — someone's home, the fire is lit
function ChimneySmoke({ position }) {
  const group = useRef()

  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32)
    grad.addColorStop(0, 'rgba(190,195,205,0.6)')
    grad.addColorStop(1, 'rgba(190,195,205,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new CanvasTexture(c)
  }, [])

  const seeds = useMemo(() => Array.from({ length: 10 }, (_, i) => hash(i * 9 + 4)), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    group.current?.children.forEach((s, i) => {
      const k = (t * 0.1 + seeds[i]) % 1 // each puff loops on its own phase
      s.position.set(Math.sin(k * 6 + i) * 0.22 + k * 2.2, k * 3.6, Math.cos(k * 5 + i * 2) * 0.2)
      const sc = 0.6 + k * 2.4
      s.scale.set(sc, sc, 1)
      s.material.opacity = Math.sin(k * Math.PI) * 0.55 // born thin, fat, then gone
    })
  })

  return (
    <group ref={group} position={position}>
      {seeds.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex} color="#b9bec8" transparent opacity={0} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  )
}

// the thick bank the visitor falls through at the very start
function ArrivalClouds() {
  const tex = useMemo(() => makePuffTex(), [])
  const puffs = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        p: [-2 + (hash(i * 5 + 2) - 0.5) * 11, 12.5 + hash(i * 5 + 3) * 4, 24 + (hash(i * 5 + 4) - 0.5) * 9],
        s: 10 + hash(i * 5 + 6) * 9,
      })),
    []
  )
  return puffs.map((c, i) => (
    <sprite key={i} position={c.p} scale={[c.s, c.s * 0.55, 1]}>
      <spriteMaterial map={tex} color="#3f4552" transparent opacity={0.85} depthWrite={false} fog={false} />
    </sprite>
  ))
}

function CloudField({ night, rain }) {
  const group = useRef()

  const puffTex = useMemo(() => makePuffTex(), [])

  const clusters = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) =>
        i < 6
          ? {
              // low bank over the west horizon — always in the window's view
              x: -14 - hash(i * 3 + 1) * 14,
              y: 4.5 + hash(i * 3 + 2) * 3.5,
              z: -5 + hash(i * 3 + 3) * 12,
              s: 3.5 + hash(i * 3 + 4) * 3,
              puffs: 3 + Math.floor(hash(i * 3 + 5) * 3),
              speed: 0.12 + hash(i * 3 + 6) * 0.12,
            }
          : {
              x: -35 + hash(i * 3 + 1) * 70,
              y: 8 + hash(i * 3 + 2) * 5,
              z: -22 + hash(i * 3 + 3) * 58,
              s: 4 + hash(i * 3 + 4) * 5,
              puffs: 3 + Math.floor(hash(i * 3 + 5) * 3),
              speed: 0.1 + hash(i * 3 + 6) * 0.15,
            }
      ),
    []
  )

  const color = rain ? '#3c4150' : night ? '#8892aa' : '#f5e8d8'
  const baseOpacity = rain ? 0.75 : night ? 0.3 : 0.45

  useFrame((_, delta) => {
    group.current?.children.forEach((c, i) => {
      c.position.x += clusters[i].speed * delta * (rain ? 2.2 : 1)
      // the low west bank wraps within the window's field of view
      const westBank = i < 6
      if (westBank && c.position.x > -12) c.position.x = -30
      else if (!westBank && c.position.x > 40) c.position.x = -40
      c.children.forEach((sp) => {
        sp.material.opacity = baseOpacity + stormState.flash * 0.5
        // lightning bleaches the cloud bellies white for a beat
        sp.material.color.set(color).lerp(FLASH_WHITE, Math.min(1, stormState.flash * 1.3))
      })
    })
  })

  return (
    <group ref={group}>
      {clusters.map((cl, i) => (
        <group key={i} position={[cl.x, cl.y, cl.z]}>
          {Array.from({ length: cl.puffs }, (_, p) => (
            <sprite
              key={p}
              position={[
                (p - cl.puffs / 2) * cl.s * 0.35,
                (hash(i * 7 + p) - 0.5) * 0.9,
                (hash(i * 11 + p) - 0.5) * 1.6,
              ]}
              scale={[cl.s * (0.7 + hash(p + i) * 0.5), cl.s * 0.5, 1]}
            >
              <spriteMaterial map={puffTex} color={color} transparent opacity={baseOpacity} depthWrite={false} fog={false} />
            </sprite>
          ))}
        </group>
      ))}
    </group>
  )
}

// rain loop + scheduled lightning-then-thunder; audio starts on first click
// (browser autoplay rules), visuals run immediately
function Storm() {
  const flash = useRef(0)
  const lightRef = useRef()

  useEffect(() => {
    let alive = true
    let timer
    let thunderTimer

    function strike() {
      if (!alive) return
      flash.current = 1
      // thunder lags the flash like real distance
      thunderTimer = setTimeout(thunderSound, 400 + Math.random() * 900)
      timer = setTimeout(strike, 6000 + Math.random() * 10000)
    }

    function onFirstClick() {
      startRain()
      window.removeEventListener('pointerdown', onFirstClick)
    }

    startRain() // works immediately if a user gesture already happened
    // browsers refuse audio before ANY gesture — so a keypress unlocks it too
    window.addEventListener('pointerdown', onFirstClick)
    window.addEventListener('keydown', onFirstClick)
    timer = setTimeout(strike, 2500 + Math.random() * 4000)

    return () => {
      alive = false
      clearTimeout(timer)
      clearTimeout(thunderTimer)
      window.removeEventListener('pointerdown', onFirstClick)
      window.removeEventListener('keydown', onFirstClick)
      stopRain()
    }
  }, [])

  useFrame((_, delta) => {
    if (flash.current > 0 && lightRef.current) {
      flash.current = Math.max(0, flash.current - delta * 1.6)
      // stuttering double-flash rather than a smooth fade
      lightRef.current.intensity = flash.current * (0.55 + Math.abs(Math.sin(flash.current * 42)) * 0.45) * 7
    }
    stormState.flash = flash.current // the clouds light up with each strike
  })

  return <directionalLight ref={lightRef} position={[-6, 4, 1]} intensity={0} color="#b8c8ee" />
}

// the real (public domain) Mona Lisa from Wikimedia, memeified with
// deal-with-it shades and an Impact caption; hand-doodled fallback offline
function Painting({ position }) {
  const [memeTex, setMemeTex] = useState(null)

  const fallbackTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 380
    const g = c.getContext('2d')
    g.fillStyle = '#c9b088'
    g.fillRect(0, 0, 256, 380)
    // doodle Mona: hair, face, the smile
    g.fillStyle = '#3a2a1a'
    g.beginPath()
    g.ellipse(128, 150, 62, 85, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#e8cfa3'
    g.beginPath()
    g.ellipse(128, 145, 42, 58, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#3a2a1a'
    g.lineWidth = 3
    g.beginPath()
    g.arc(128, 165, 16, 0.2, Math.PI - 0.2)
    g.stroke()
    addShadesAndCaption(g)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 380
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, 256, 380)
      addShadesAndCaption(g)
      const tx = new CanvasTexture(c)
      tx.colorSpace = SRGBColorSpace
      setMemeTex(tx)
    }
    img.src =
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/500px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg'
  }, [])

  return <WallFrame position={position} tex={memeTex || fallbackTex} />
}

function addShadesAndCaption(g) {
  // round scholarly spectacles over the eyes
  g.strokeStyle = '#1a1410'
  g.lineWidth = 4
  for (const cx of [105, 151]) {
    g.fillStyle = 'rgba(220,230,245,0.22)' // faint glass shine
    g.beginPath()
    g.arc(cx, 117, 20, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  // bridge + temple arms
  g.lineWidth = 3.5
  g.beginPath()
  g.arc(128, 115, 8, Math.PI, 0)
  g.stroke()
  g.beginPath()
  g.moveTo(85, 115)
  g.lineTo(66, 109)
  g.moveTo(171, 115)
  g.lineTo(190, 109)
  g.stroke()
  // caption
  g.textAlign = 'center'
  g.font = 'bold 25px Impact, "Arial Black", sans-serif'
  g.lineWidth = 5
  g.strokeStyle = '#000'
  g.fillStyle = '#fff'
  g.strokeText('ME WAITING FOR', 128, 322)
  g.fillText('ME WAITING FOR', 128, 322)
  g.strokeText('NPM INSTALL', 128, 354)
  g.fillText('NPM INSTALL', 128, 354)
}

// any framed thing on a wall: swings on its nail when clicked
function WallFrame({ position, size = [0.92, 1.16], tex, emissive = '#1c2334', emissiveIntensity = 0.5 }) {
  const ref = useRef()
  const wobble = useRef(0)

  useFrame((_, delta) => {
    if (wobble.current > 0 && ref.current) {
      wobble.current = Math.max(0, wobble.current - delta * 0.6)
      ref.current.rotation.z = Math.sin(wobble.current * 14) * 0.1 * wobble.current
    }
  })

  return (
    <group
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        wobble.current = 1
      }}
      onPointerOver={cursorOn}
      onPointerOut={cursorOff}
    >
      <mesh castShadow>
        <boxGeometry args={[size[0], size[1], 0.06]} />
        <meshStandardMaterial color="#7a5b2b" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[size[0] - 0.16, size[1] - 0.16]} />
        <meshStandardMaterial map={tex} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  )
}

// cross-stitch wisdom for the discerning engineer
function MemeFrame({ position }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 220
    c.height = 170
    const g = c.getContext('2d')
    g.fillStyle = '#efe6d0'
    g.fillRect(0, 0, 220, 170)
    g.strokeStyle = '#8b2e2e'
    g.lineWidth = 4
    g.strokeRect(8, 8, 204, 154)
    g.strokeStyle = '#c9a54e'
    g.lineWidth = 1.5
    g.strokeRect(14, 14, 192, 142)
    g.textAlign = 'center'
    g.fillStyle = '#5a4a3a'
    g.font = 'italic 11px Georgia'
    g.fillText('— ancient developer proverb —', 110, 42)
    g.fillStyle = '#2b2118'
    g.font = 'bold 20px Georgia'
    g.fillText('IT WORKS', 110, 78)
    g.fillText('ON MY MACHINE', 110, 104)
    g.font = '16px Georgia'
    g.fillText('¯\\_(ツ)_/¯', 110, 138)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  return <WallFrame position={position} size={[0.78, 0.64]} tex={tex} emissive="#3a352c" emissiveIntensity={0.4} />
}

function Spectacles({ position }) {
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0.6]}>
      {[-0.105, 0.105].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <torusGeometry args={[0.085, 0.007, 8, 28]} />
          <meshStandardMaterial color="#6b5a42" metalness={0.9} roughness={0.35} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.05, 0.007, 0.007]} />
        <meshStandardMaterial color="#6b5a42" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  )
}

// The one book that matters: pulls out on hover, flies to the desk on click.
function PortfolioBook({ onOpen, controlsRef, reading }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const flying = useRef(false)
  const t = useRef(0)
  const done = useRef(false)

  // when the reader closes, the book quietly reappears on its shelf.
  // NOTE: OrbitControls enablement is owned by its `enabled` prop — setting it
  // imperatively here once yanked the entrance camera into the doorknob.
  useEffect(() => {
    if (!reading && ref.current) {
      ref.current.visible = true
      ref.current.position.set(-0.69, 1.54, -2.68)
      ref.current.rotation.set(0, 0, 0)
      flying.current = false
      done.current = false
      t.current = 0
    }
  }, [reading])

  const START = useMemo(() => new Vector3(-0.69, 1.54, -2.68), [])
  const END = useMemo(() => new Vector3(1.6, 1.22, -0.2), [])
  const CAM_DEST = useMemo(() => new Vector3(1.7, 2.5, 1.7), [])
  const LOOK_DEST = useMemo(() => new Vector3(1.6, 1.2, -0.2), [])

  useFrame(({ camera }, delta) => {
    const m = ref.current
    if (!m) return

    if (reading) {
      if (m.visible) m.visible = false // the OpenBook3D on the desk takes over
      return
    }

    if (!flying.current) {
      const targetZ = START.z + (hovered ? 0.14 : 0)
      m.position.z += (targetZ - m.position.z) * 0.12
      return
    }

    t.current = Math.min(1, t.current + delta / 1.7)
    const e = t.current * t.current * (3 - 2 * t.current) // smoothstep
    m.position.lerpVectors(START, END, e)
    m.position.y += Math.sin(e * Math.PI) * 0.7 // arc over the desk edge
    m.rotation.set(0, e * 0.35, (e * Math.PI) / 2) // lays flat as it lands

    camera.position.lerp(CAM_DEST, delta * (0.6 + e * 1.4))
    if (controlsRef.current) {
      controlsRef.current.target.lerp(LOOK_DEST, delta * 1.5)
      controlsRef.current.update()
    }

    if (t.current >= 1 && !done.current) {
      done.current = true
      onOpen()
    }
  })

  function click(e) {
    e.stopPropagation()
    if (flying.current) return
    flying.current = true
    setHovered(false)
    document.body.style.cursor = 'default'
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  return (
    <group
      ref={ref}
      position={[-0.69, 1.54, -2.68]}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (flying.current) return
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.72, 0.5]} />
        <meshStandardMaterial
          color="#4f1c24"
          roughness={0.7}
          emissive="#4f1c24"
          emissiveIntensity={hovered ? 0.35 : 0}
        />
      </mesh>
      {/* gilt spine bands */}
      {[0.26, 0.13, -0.13, -0.26].map((y) => (
        <mesh key={y} position={[0, y, 0.25]}>
          <boxGeometry args={[0.17, 0.018, 0.02]} />
          <meshStandardMaterial color="#c9a54e" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// scanned PBR lantern (Khronos CC0 sample) — normalized to a target height
// so we never have to guess the source file's scale
function LanternModel({ position, height = 0.55 }) {
  const { scene } = useGLTF('/models/Lantern.glb')
  const obj = useMemo(() => {
    const c = scene.clone()
    const box = new Box3().setFromObject(c)
    const size = new Vector3()
    box.getSize(size)
    c.scale.setScalar(height / size.y)
    const box2 = new Box3().setFromObject(c)
    c.position.y -= box2.min.y // base sits at y=0
    return c
  }, [scene, height])
  return (
    <group position={position}>
      <primitive object={obj} />
    </group>
  )
}
useGLTF.preload('/models/Lantern.glb')

// what height is the ground here? stairs, landing and the front roof slope
// are all walkable surfaces
function floorAt(x, z) {
  if (x > 3.3 && x < 4.6 && z > 5.3 && z < 6.65) return 4.465 // landing
  if (x >= 4.5 && x <= 8.8 && z > 5.42 && z < 6.6) {
    const i = Math.max(0, Math.min(11, (8.68 - x) / 0.36)) // the stairs
    return 0.365 + i * 0.35
  }
  // front roof slope up to the ridge — overlaps the landing zone so the
  // step across the eave is seamless, never a "cliff"
  if (x > -5.1 && x < 5.1 && z >= 1.15 && z <= 5.45) {
    return 4.44 + (5.35 - Math.min(z, 5.35)) * 0.53
  }
  return 0
}

// first-person walking in the front yard: WASD/arrows to move, drag to look
function WalkControls({ enabled }) {
  const keys = useRef({})
  const look = useRef({ yaw: Math.PI, pitch: 0 }) // yaw π = facing the door (-z)
  const drag = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const kd = (e) => (keys.current[e.code] = true)
    const ku = (e) => (keys.current[e.code] = false)
    const pd = (e) => (drag.current = { x: e.clientX, y: e.clientY })
    const pm = (e) => {
      if (!drag.current) return
      look.current.yaw -= (e.clientX - drag.current.x) * 0.004
      look.current.pitch = Math.max(-0.6, Math.min(0.6, look.current.pitch - (e.clientY - drag.current.y) * 0.003))
      drag.current = { x: e.clientX, y: e.clientY }
    }
    const pu = () => (drag.current = null)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [enabled])

  useFrame(({ camera }, delta) => {
    if (!enabled) return
    const { yaw, pitch } = look.current
    const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const right = new Vector3(-fwd.z, 0, fwd.x)
    const sp = 3.2 * delta
    const k = keys.current
    const mv = new Vector3()
    if (k.KeyW || k.ArrowUp) mv.add(fwd)
    if (k.KeyS || k.ArrowDown) mv.sub(fwd)
    if (k.KeyA || k.ArrowLeft) mv.sub(right)
    if (k.KeyD || k.ArrowRight) mv.add(right)
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar(sp)
      const nx = camera.position.x + mv.x
      const nz = camera.position.z + mv.z
      // cliff guard: no walking off the roof or the side of the stairs
      if (Math.abs(floorAt(nx, nz) - floorAt(camera.position.x, camera.position.z)) < 1.0) {
        camera.position.x = nx
        camera.position.z = nz
      }
    }
    const floor = floorAt(camera.position.x, camera.position.z)
    // stay inside the garden fence — unless you're up on the house
    camera.position.x = Math.max(-10.5, Math.min(10.5, camera.position.x))
    const zMin = floor > 0.3 ? 1.1 : 6.1
    camera.position.z = Math.max(zMin, Math.min(19.5, camera.position.z))
    // eyes glide up the steps instead of snapping
    camera.position.y += (floor + 1.6 - camera.position.y) * Math.min(1, delta * 8)
    camera.lookAt(
      camera.position.x + Math.sin(yaw) * Math.cos(pitch),
      camera.position.y + Math.sin(pitch),
      camera.position.z + Math.cos(yaw) * Math.cos(pitch)
    )
  })

  return null
}

// real falling rain over the yard — a wrapping particle field whose
// particles are soft vertical streaks, not square points
function RainFall({ x = [-11, 11], z = [5.6, 20.1], count = 450 }) {
  const COUNT = count

  const streakTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 64
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 4, 0, 60)
    grad.addColorStop(0, 'rgba(200,215,235,0)')
    grad.addColorStop(0.35, 'rgba(200,215,235,0.9)')
    grad.addColorStop(1, 'rgba(200,215,235,0)')
    g.strokeStyle = grad
    g.lineWidth = 3
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(16, 4)
    g.lineTo(16, 60)
    g.stroke()
    return new CanvasTexture(c)
  }, [])

  const geo = useMemo(() => {
    const g = new BufferGeometry()
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = x[0] + hash(i) * (x[1] - x[0])
      arr[i * 3 + 1] = hash(i + 500) * 7
      arr[i * 3 + 2] = z[0] + hash(i + 900) * (z[1] - z[0])
    }
    g.setAttribute('position', new BufferAttribute(arr, 3))
    return g
  }, [COUNT, x, z])

  useFrame((_, delta) => {
    const p = geo.attributes.position
    for (let i = 0; i < COUNT; i++) {
      let y = p.array[i * 3 + 1] - 7.5 * delta
      if (y < 0) y += 7
      p.array[i * 3 + 1] = y
    }
    p.needsUpdate = true
  })

  return (
    // frustumCulled off: we mutate positions every frame, and a stale bounding
    // sphere can silently cull the whole rain field out of existence
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        map={streakTex}
        size={0.14}
        color="#aebbd2"
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// warm lit window on the facade — the library glowing from inside
function FacadeWindow({ position }) {
  const warmTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 36, 4, 32, 32, 44)
    grad.addColorStop(0, '#ffdca6')
    grad.addColorStop(0.55, '#d9973f')
    grad.addColorStop(1, '#7a4a1a')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  const haloTex = useMemo(() => makePuffTex(), [])

  return (
    <group position={position}>
      <Wood position={[0, 0, 0]} size={[1.0, 1.3, 0.08]} color="#171009" />
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[0.82, 1.12]} />
        <meshBasicMaterial map={warmTex} />
      </mesh>
      {/* soft light halo bleeding into the rainy night */}
      <sprite position={[0, 0, 0.2]} scale={[2.2, 2.5, 1]}>
        <spriteMaterial map={haloTex} color="#ffbf6b" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      {/* muntins */}
      <Wood position={[0, 0, 0.05]} size={[0.05, 1.12, 0.02]} color="#171009" />
      <Wood position={[0, 0, 0.05]} size={[0.82, 0.05, 0.02]} color="#171009" />
      {/* sill */}
      <Wood position={[0, -0.7, 0.06]} size={[1.12, 0.08, 0.16]} color="#171009" />
    </group>
  )
}

function Mailbox({ position }) {
  const nameTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 48
    const g = c.getContext('2d')
    g.fillStyle = '#131a14'
    g.fillRect(0, 0, 128, 48)
    g.fillStyle = '#c9a54e'
    g.font = 'bold 20px Georgia'
    g.textAlign = 'center'
    g.fillText('RAMSHA', 64, 32)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 1.0, 8]} />
        <meshStandardMaterial color="#17110b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.26, 0.22, 0.44]} />
        <meshStandardMaterial color="#1f3527" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* little red flag */}
      <mesh position={[0.15, 1.16, -0.12]}>
        <boxGeometry args={[0.02, 0.1, 0.06]} />
        <meshStandardMaterial color="#8b2e2e" roughness={0.6} />
      </mesh>
      {/* name plate facing the path */}
      <mesh position={[0, 1.1, 0.225]}>
        <planeGeometry args={[0.22, 0.09]} />
        <meshBasicMaterial map={nameTex} />
      </mesh>
    </group>
  )
}

function Tree({ position, s = 1, leaf = '#0f1a10' }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.09, 0.15, 1.6, 8]} />
        <meshStandardMaterial color="#17110b" roughness={0.95} />
      </mesh>
      {[[0, 1.9, 0, 0.75], [0.45, 1.55, 0.1, 0.55], [-0.4, 1.6, -0.1, 0.5]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color={leaf} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function LampPost({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 2.5, 10]} />
        <meshStandardMaterial color="#14100a" metalness={0.6} roughness={0.5} />
      </mesh>
      <Suspense fallback={null}>
        <LanternModel position={[0, 2.5, 0]} height={0.55} />
      </Suspense>
      <pointLight position={[0, 2.75, 0]} intensity={11} color="#e8a54b" distance={7} decay={2} />
    </group>
  )
}

function Pine({ position, s = 1, leaf = '#0d1a10' }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 0.9, 8]} />
        <meshStandardMaterial color="#17110b" roughness={0.95} />
      </mesh>
      {[[1.3, 0.58, 1.1], [1.95, 0.42, 0.9], [2.5, 0.27, 0.7]].map(([y, r, h], i) => (
        <mesh key={i} position={[0, y, 0]}>
          <coneGeometry args={[r, h, 9]} />
          <meshStandardMaterial color={leaf} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Bench({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[1.4, 0.06, 0.4]} />
        <meshStandardMaterial color="#241708" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.72, -0.18]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[1.4, 0.42, 0.05]} />
        <meshStandardMaterial color="#241708" roughness={0.85} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]}>
          <boxGeometry args={[0.06, 0.44, 0.36]} />
          <meshStandardMaterial color="#17110b" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// gradient sky dome — the world no longer ends at a flat background color
function SkyDome({ weather }) {
  const tex = useMemo(() => {
    const colors = WEATHER[weather].dome
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, colors[0])
    grad.addColorStop(0.55, colors[1])
    grad.addColorStop(0.78, colors[2])
    grad.addColorStop(1, colors[2])
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 256)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [weather])

  return (
    <mesh scale={[80, 80, 80]}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial map={tex} side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

// moon with mare blotches and a halo; sun with a big warm bloom
function MoonSun({ night }) {
  const moonTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#dfe6f2'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(148,158,178,${0.25 + hash(i + 40) * 0.25})`
      g.beginPath()
      g.arc(20 + hash(i) * 88, 20 + hash(i + 9) * 88, 5 + hash(i + 21) * 14, 0, Math.PI * 2)
      g.fill()
    }
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  const glowTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.25)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new CanvasTexture(c)
  }, [])

  return (
    <group position={night ? [-8, 10, 28] : [8, 7.5, 30]}>
      <mesh>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial map={night ? moonTex : null} color={night ? '#ccd6ea' : '#fff3cf'} fog={false} />
      </mesh>
      <sprite scale={night ? [6, 6, 1] : [12, 12, 1]}>
        <spriteMaterial
          map={glowTex}
          color={night ? '#8fa5d9' : '#ffcf8a'}
          transparent
          opacity={night ? 0.5 : 0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </sprite>
    </group>
  )
}

// warm cream plaster with the faintest linen stripe
function makeWallTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#e8e0d4'
  g.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = 'rgba(120,100,80,0.04)'
    g.fillRect(x, 0, 16, 256)
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(90,80,65,${0.02 + hash(i) * 0.03})`
    g.fillRect(hash(i + 3) * 256, hash(i + 7) * 256, 1.5, 1.5)
  }
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.repeat.set(4, 2)
  tx.colorSpace = SRGBColorSpace
  return tx
}

// stylized typographic album tributes — click to open the record on Spotify
const drawWeeknd = (g) => {
  g.fillStyle = '#0a0a0c'
  g.fillRect(0, 0, 256, 340)
  g.shadowColor = '#e0231f'
  g.shadowBlur = 24
  g.strokeStyle = '#e0231f'
  g.lineWidth = 3
  g.strokeRect(24, 30, 208, 280)
  g.textAlign = 'center'
  g.fillStyle = '#e0231f'
  g.font = 'bold 34px Georgia'
  g.fillText('THE', 128, 120)
  g.fillText('WEEKND', 128, 160)
  g.shadowBlur = 10
  g.fillStyle = '#f4e4c1'
  g.font = 'italic 22px Georgia'
  g.fillText('After Hours', 128, 235)
}

const drawKendrick = (g) => {
  g.fillStyle = '#f5f2ec'
  g.fillRect(0, 0, 256, 340)
  g.textAlign = 'center'
  g.fillStyle = '#111111'
  g.font = 'bold 18px Arial'
  g.fillText('KENDRICK LAMAR', 128, 64)
  g.fillStyle = '#c8102e'
  g.font = '900 62px Arial'
  g.fillText('DAMN.', 128, 190)
  g.fillStyle = '#111111'
  g.font = '13px Arial'
  g.fillText('MMXVII', 128, 296)
}

const drawTravis = (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 340)
  grad.addColorStop(0, '#5a3319')
  grad.addColorStop(0.6, '#8a4a1f')
  grad.addColorStop(1, '#2c1408')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 340)
  // golden ferris wheel
  g.strokeStyle = '#e8b54b'
  g.lineWidth = 3
  g.beginPath()
  g.arc(128, 165, 66, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.beginPath()
    g.moveTo(128, 165)
    g.lineTo(128 + Math.cos(a) * 66, 165 + Math.sin(a) * 66)
    g.stroke()
    g.beginPath()
    g.arc(128 + Math.cos(a) * 66, 165 + Math.sin(a) * 66, 6, 0, Math.PI * 2)
    g.stroke()
  }
  g.textAlign = 'center'
  g.fillStyle = '#f5e3a8'
  g.font = 'bold 22px Georgia'
  g.fillText('TRAVIS SCOTT', 128, 46)
  g.font = 'bold 26px Georgia'
  g.fillText('ASTROWORLD', 128, 290)
  g.font = 'italic 12px Georgia'
  g.fillText('wish you were here', 128, 314)
}

const drawDon = (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 340)
  grad.addColorStop(0, '#2a1040')
  grad.addColorStop(0.55, '#5a1f6e')
  grad.addColorStop(1, '#1a0a28')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 340)
  const flame = g.createRadialGradient(128, 205, 6, 128, 205, 70)
  flame.addColorStop(0, 'rgba(255,140,50,0.9)')
  flame.addColorStop(1, 'rgba(255,110,40,0)')
  g.fillStyle = flame
  g.fillRect(0, 0, 256, 340)
  g.textAlign = 'center'
  g.fillStyle = '#f0e0ff'
  g.font = 'bold 26px Georgia'
  g.fillText('DON TOLIVER', 128, 70)
  g.fillStyle = '#ffb066'
  g.font = 'italic 24px Georgia'
  g.fillText('Heaven or Hell', 128, 300)
}

// one shared <audio> so only one preview ever plays at a time
let previewAudio
function playPreview(url, onEnd) {
  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }
  if (!url) return
  previewAudio = new Audio(url)
  previewAudio.volume = 0.55
  previewAudio.onended = onEnd
  previewAudio.play().catch(() => {})
}

// an album cover pinned to the wall. Real artwork + official 30s preview
// come from the iTunes Search API; falls back to the drawn tribute offline.
function AlbumTile({ position, rotation = 0, size = 0.6, q, fallbackDraw }) {
  const [data, setData] = useState(null)
  const [playing, setPlaying] = useState(false)
  const disc = useRef()

  useEffect(() => {
    let dead = false
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`)
      .then((r) => r.json())
      .then((j) => {
        const r0 = j.results?.[0]
        if (!r0 || dead) return
        const artUrl = (r0.artworkUrl100 || '').replace('100x100', '600x600')
        const loader = new TextureLoader()
        loader.setCrossOrigin('anonymous')
        loader.load(
          artUrl,
          (tex) => {
            if (dead) return
            tex.colorSpace = SRGBColorSpace
            setData({ art: tex, preview: r0.previewUrl })
          },
          undefined,
          () => !dead && setData({ art: null, preview: r0.previewUrl })
        )
      })
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [q])

  // if another tile starts playing, this one stops
  useEffect(() => {
    const onOther = (e) => {
      if (e.detail !== q) setPlaying(false)
    }
    window.addEventListener('album-play', onOther)
    return () => window.removeEventListener('album-play', onOther)
  }, [q])

  const fallbackTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    g.save()
    g.scale(1, 256 / 340)
    fallbackDraw(g)
    g.restore()
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [fallbackDraw])

  useFrame((_, delta) => {
    if (disc.current) {
      const target = playing ? size * 0.55 : 0
      disc.current.position.x += (target - disc.current.position.x) * Math.min(1, delta * 5)
      if (playing) disc.current.rotation.z -= delta * 2.4
    }
  })

  const toggle = (e) => {
    e.stopPropagation()
    if (playing) {
      previewAudio?.pause()
      setPlaying(false)
      window.dispatchEvent(new Event('album-stop'))
      return
    }
    if (!data?.preview) return
    window.dispatchEvent(new CustomEvent('album-play', { detail: q }))
    playPreview(data.preview, () => {
      setPlaying(false)
      window.dispatchEvent(new Event('album-stop'))
    })
    setPlaying(true)
  }

  return (
    <group position={position} rotation={[0, 0, rotation]}>
      {/* vinyl slides out and spins while its song plays */}
      <group ref={disc} position={[0, 0, -0.012]}>
        <mesh>
          <circleGeometry args={[size * 0.46, 28]} />
          <meshStandardMaterial color="#0d0b0a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[size * 0.16, 20]} />
          <meshStandardMaterial color="#8b2e2e" roughness={0.6} />
        </mesh>
      </group>
      <mesh onClick={toggle} onPointerOver={cursorOn} onPointerOut={cursorOff}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          map={data?.art || fallbackTex}
          emissiveMap={data?.art || fallbackTex}
          emissive="#ffffff"
          emissiveIntensity={playing ? 0.45 : 0.25}
        />
      </mesh>
      {/* washi tape corner */}
      <mesh position={[-size / 2 + 0.03, size / 2 - 0.01, 0.004]} rotation={[0, 0, 0.6]}>
        <planeGeometry args={[0.14, 0.05]} />
        <meshStandardMaterial color="#c9a54e" transparent opacity={0.65} />
      </mesh>
    </group>
  )
}

function Polaroid({ position, rotation = 0, kind = 'sunset' }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 150
    const g = c.getContext('2d')
    g.fillStyle = '#f4f0e8'
    g.fillRect(0, 0, 128, 150)
    const grad = g.createLinearGradient(0, 10, 0, 118)
    if (kind === 'sunset') {
      grad.addColorStop(0, '#2a3550')
      grad.addColorStop(0.6, '#d97a4e')
      grad.addColorStop(1, '#e8b54b')
    } else {
      grad.addColorStop(0, '#10182b')
      grad.addColorStop(1, '#2a3550')
    }
    g.fillStyle = grad
    g.fillRect(10, 10, 108, 108)
    if (kind === 'night') {
      g.fillStyle = '#d8e0ee'
      g.beginPath()
      g.arc(92, 34, 9, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(90,74,58,0.6)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(22, 134)
    g.quadraticCurveTo(60, 130, 104, 135)
    g.stroke()
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [kind])

  return (
    <mesh position={position} rotation={[0, 0, rotation]}>
      <planeGeometry args={[0.3, 0.36]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.15} />
    </mesh>
  )
}

function NoteCard({ position, rotation = 0 }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 170
    c.height = 120
    const g = c.getContext('2d')
    g.fillStyle = '#f0e6d0'
    g.fillRect(0, 0, 170, 120)
    g.fillStyle = '#5a4a3a'
    g.font = '30px Caveat, cursive'
    g.textAlign = 'center'
    g.fillText('sounds like', 85, 52)
    g.fillText('home ♡', 85, 88)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  return (
    <mesh position={position} rotation={[0, 0, rotation]}>
      <planeGeometry args={[0.34, 0.24]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.2} />
    </mesh>
  )
}

function FairyLights({ width = 2.5, y = 1.0 }) {
  const pts = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const t = i / 10
        return [-width / 2 + t * width, y - Math.sin(t * Math.PI) * 0.15, 0.02]
      }),
    [width, y]
  )
  return (
    <group>
      <Line points={pts} color="#1a140e" lineWidth={1} />
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshBasicMaterial color={i % 2 ? '#ffd9a0' : '#ffbf6b'} />
        </mesh>
      ))}
    </group>
  )
}

// the Pinterest-style inspiration wall: album covers, polaroids, a note,
// fairy lights — all clustered on one wall
function InspoWall({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <FairyLights width={2.6} y={1.02} />
      <AlbumTile position={[-0.62, 0.32, 0]} rotation={0.035} size={0.64} q="the weeknd blinding lights" fallbackDraw={drawWeeknd} />
      <AlbumTile position={[0.18, 0.48, 0]} rotation={-0.05} size={0.5} q="kendrick lamar luther" fallbackDraw={drawKendrick} />
      <AlbumTile position={[-0.38, -0.42, 0]} rotation={-0.025} size={0.54} q="travis scott my eyes" fallbackDraw={drawTravis} />
      <AlbumTile position={[0.42, -0.28, 0]} rotation={0.055} size={0.58} q="don toliver secondhand lover" fallbackDraw={drawDon} />
      <NoteCard position={[1.0, 0.45, 0]} rotation={-0.08} />
      <Polaroid position={[1.02, -0.35, 0]} rotation={0.1} kind="sunset" />
      <Polaroid position={[-1.12, -0.05, 0]} rotation={-0.12} kind="night" />
    </group>
  )
}

// staggered shingle courses with per-tab weathering
function makeShingleTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#1c150e'
  g.fillRect(0, 0, 256, 256)
  const rh = 20
  const tw = 34
  for (let row = 0; row * rh < 256; row++) {
    const off = row % 2 ? tw / 2 : 0
    for (let col = -1; col * tw < 256; col++) {
      const shade = 0.75 + hash(row * 41 + col * 13) * 0.5
      g.fillStyle = `rgb(${Math.floor(48 * shade)},${Math.floor(38 * shade)},${Math.floor(28 * shade)})`
      g.fillRect(col * tw + off + 1, row * rh + 1, tw - 2, rh - 2)
    }
    g.fillStyle = 'rgba(0,0,0,0.45)'
    g.fillRect(0, row * rh + rh - 2, 256, 2)
  }
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.repeat.set(3, 2)
  tx.colorSpace = SRGBColorSpace
  return tx
}

// old brick, drawn once: offset courses with per-brick shading
function makeBrickTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#c8c0b2' // mortar
  g.fillRect(0, 0, 256, 256)
  const bh = 22
  const bw = 58
  for (let row = 0; row * bh < 256; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let col = -1; col * bw < 256; col++) {
      const shade = 0.9 + hash(row * 31 + col * 7) * 0.15
      g.fillStyle = `rgb(${Math.floor(224 * shade)},${Math.floor(216 * shade)},${Math.floor(204 * shade)})`
      g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4)
    }
  }
  const tx = new CanvasTexture(c)
  tx.wrapS = tx.wrapT = RepeatWrapping
  tx.colorSpace = SRGBColorSpace
  return tx
}

// crackling hearth on the right wall — brick, layered flames, pulsing embers.
// Click it to douse the fire; click again to relight.
function Fireplace({ position }) {
  const flames = useRef()
  const glowFlames = useRef()
  const embers = useRef()
  const light = useRef()
  const [lit, setLit] = useState(true)
  const on = useRef(1) // eased 0..1 so the fire dies and catches gradually

  const brickTex = useMemo(() => makeBrickTex(), [])

  const flameTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 88, 4, 32, 70, 62)
    grad.addColorStop(0, 'rgba(255,224,160,0.95)')
    grad.addColorStop(0.35, 'rgba(255,140,46,0.55)')
    grad.addColorStop(1, 'rgba(255,90,20,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 128)
    return new CanvasTexture(c)
  }, [])

  useEffect(() => {
    if (!lit) return
    let timer
    const pop = () => {
      crackleSound()
      timer = setTimeout(pop, 150 + Math.random() * 800)
    }
    timer = setTimeout(pop, 600)
    return () => clearTimeout(timer)
  }, [lit])

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    on.current += ((lit ? 1 : 0) - on.current) * Math.min(1, delta * 2.5)
    const k = on.current
    const f = 1 + Math.sin(t * 9.1) * 0.15 + Math.sin(t * 15.7) * 0.1
    if (light.current) light.current.intensity = 9 * f * k
    if (flames.current) flames.current.visible = k > 0.03
    flames.current?.children.forEach((fl, i) => {
      const w = Math.sin(t * (7 + i * 2.3) + i * 2) * 0.15
      fl.scale.set((1 + w) * k, f * (1 - i * 0.18) * k, (1 + w) * k)
      fl.rotation.y = t * (1.2 + i * 0.4)
    })
    if (glowFlames.current) glowFlames.current.visible = k > 0.03
    glowFlames.current?.children.forEach((s, i) => {
      s.material.opacity = (0.5 + Math.sin(t * (6 + i * 3.1) + i) * 0.2) * k
      const sc = 1 + Math.sin(t * (8 + i * 2) + i * 1.7) * 0.12
      s.scale.set(0.55 * sc * k, 0.8 * sc * f * k, 1)
    })
    if (embers.current) {
      embers.current.material.opacity = (0.45 + Math.sin(t * 3.7) * 0.15 + (f - 1) * 0.5) * Math.max(k, 0.12)
    }
  })

  const toggleFire = (e) => {
    e.stopPropagation()
    setLit((v) => {
      if (v) whooshSound()
      else strikeSound()
      return !v
    })
  }

  return (
    <group
      position={position}
      rotation={[0, -Math.PI / 2, 0]}
      onClick={toggleFire}
      onPointerOver={cursorOn}
      onPointerOut={cursorOff}
    >
      {/* brick chimney breast + surround */}
      <mesh position={[0, 2.7, -0.12]} castShadow>
        <boxGeometry args={[1.6, 2.6, 0.24]} />
        <meshStandardMaterial map={brickTex} roughness={0.9} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.65, 0]} castShadow>
          <boxGeometry args={[0.35, 1.3, 0.34]} />
          <meshStandardMaterial map={brickTex} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[1.85, 0.3, 0.34]} />
        <meshStandardMaterial map={brickTex} roughness={0.9} />
      </mesh>
      {/* mantel shelf: candlesticks + a little brass clock */}
      <Wood position={[0, 1.53, 0.06]} size={[2.0, 0.09, 0.44]} color="#b08e64" />
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 1.68, 0.05]}>
          <cylinderGeometry args={[0.035, 0.05, 0.2, 10]} />
          <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      <group position={[0, 1.66, 0.05]}>
        <mesh>
          <boxGeometry args={[0.22, 0.18, 0.08]} />
          <meshStandardMaterial color="#2c2018" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.01, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.01, 20]} />
          <meshStandardMaterial color="#e8dcc0" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.115, 0]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
      {/* firebox */}
      <mesh position={[0, 0.6, -0.14]}>
        <boxGeometry args={[1.15, 1.15, 0.08]} />
        <meshStandardMaterial color="#0c0805" roughness={1} />
      </mesh>
      {/* hearth slab */}
      <mesh position={[0, 0.025, 0.3]} receiveShadow>
        <boxGeometry args={[2.0, 0.05, 0.75]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.85} />
      </mesh>
      {/* brass andirons */}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0, 0.28]}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.18, 8]} />
            <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.21, 0]}>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* logs */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
        <meshStandardMaterial color="#2c1a0c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.2, 0.04]} rotation={[0.3, 0.4, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
        <meshStandardMaterial color="#231408" roughness={1} />
      </mesh>
      {/* pulsing ember bed */}
      <mesh ref={embers} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#ff6a1f" transparent opacity={0.55} />
      </mesh>
      {[[-0.15, 0.02], [0.1, 0.12], [0.02, -0.08]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshBasicMaterial color="#ff9a3c" />
        </mesh>
      ))}
      {/* flame cores */}
      <group ref={flames} position={[0, 0.22, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.14, 0.14 + i * 0.02, (i % 2) * 0.05]}>
            <coneGeometry args={[0.09 - i * 0.02, 0.42 - i * 0.08, 8]} />
            <meshBasicMaterial color={['#ff8c2e', '#ffb84e', '#ffe29a'][i]} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      {/* soft additive flame glow around the cores */}
      <group ref={glowFlames} position={[0, 0.42, 0.06]}>
        {[0, 1, 2].map((i) => (
          <sprite key={i} position={[(i - 1) * 0.12, i * 0.04, 0]} scale={[0.55, 0.8, 1]}>
            <spriteMaterial map={flameTex} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
        ))}
      </group>
      {/* log basket beside the hearth */}
      <group position={[1.25, 0, 0.3]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.22, 0.18, 0.24, 12, 1, true]} />
          <meshStandardMaterial color="#6e4423" roughness={0.95} side={DoubleSide} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.07, 0.22, 0]} rotation={[0.25, i, 0.15]}>
            <cylinderGeometry args={[0.045, 0.045, 0.4, 7]} />
            <meshStandardMaterial color="#3a2412" roughness={1} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 0.7, 0.5]} color="#ff9a3c" distance={7} decay={2} />
    </group>
  )
}

function Sofa({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[1.7, 0.34, 0.85]} />
        <meshStandardMaterial color="#e6ddd0" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.72, -0.32]} castShadow>
        <boxGeometry args={[1.7, 0.62, 0.22]} />
        <meshStandardMaterial color="#e6ddd0" roughness={0.95} />
      </mesh>
      {[-0.97, 0.97].map((x) => (
        <mesh key={x} position={[x, 0.48, 0]} castShadow>
          <boxGeometry args={[0.25, 0.6, 0.85]} />
          <meshStandardMaterial color="#ded4c5" roughness={0.95} />
        </mesh>
      ))}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.02]}>
          <boxGeometry args={[0.78, 0.15, 0.72]} />
          <meshStandardMaterial color="#efe7da" roughness={0.98} />
        </mesh>
      ))}
      {/* throw pillows — terracotta and sage */}
      <mesh position={[-0.55, 0.78, -0.18]} rotation={[-0.3, 0.2, 0.1]}>
        <boxGeometry args={[0.38, 0.38, 0.12]} />
        <meshStandardMaterial color="#c2704e" roughness={0.95} />
      </mesh>
      <mesh position={[0.55, 0.78, -0.18]} rotation={[-0.3, -0.15, -0.08]}>
        <boxGeometry args={[0.38, 0.38, 0.12]} />
        <meshStandardMaterial color="#8a9b84" roughness={0.95} />
      </mesh>
      {[[-0.75, 0.35], [0.75, 0.35], [-0.75, -0.35], [0.75, -0.35]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <cylinderGeometry args={[0.03, 0.04, 0.16, 8]} />
          <meshStandardMaterial color="#b08e64" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function FloorLamp({ position, on = true }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 14]} />
        <meshStandardMaterial color="#241708" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 1.6, 8]} />
        <meshStandardMaterial color="#9a7b3f" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.3, 0.34, 14, 1, true]} />
        <meshStandardMaterial color="#e8e0d1" roughness={0.9} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.68, 0]} visible={on}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ffd9a0" />
      </mesh>
      <pointLight position={[0, 1.6, 0]} intensity={on ? 7 : 0} color="#e8a54b" distance={5} decay={2} />
    </group>
  )
}

// warm neon script on the wall — instant Pinterest
function NeonSign({ position, rotation = 0 }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const g = c.getContext('2d')
    g.textAlign = 'center'
    g.shadowColor = '#ff9d7a'
    g.shadowBlur = 26
    g.fillStyle = '#ffd9c4'
    g.font = '64px Caveat, cursive'
    g.fillText('make it happen', 256, 82)
    g.shadowBlur = 8
    g.fillText('make it happen', 256, 82)
    return new CanvasTexture(c)
  }, [])

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <planeGeometry args={[2.0, 0.5]} />
        {/* kept under the bloom threshold — it glows, it doesn't detonate */}
        <meshBasicMaterial map={tex} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, 0.3]} intensity={2} color="#ff9d7a" distance={3} decay={2} />
    </group>
  )
}

// tall arched mirror leaning on the wall
function ArchMirror({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0.06, rotation, 0]}>
      {/* black frame: arch + body, slightly larger than the glass */}
      <mesh position={[0, 1.42, -0.005]}>
        <circleGeometry args={[0.48, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#222222" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, -0.005]}>
        <planeGeometry args={[0.96, 1.42]} />
        <meshStandardMaterial color="#222222" roughness={0.5} />
      </mesh>
      {/* the glass — env reflections do the mirroring */}
      <mesh position={[0, 1.42, 0]}>
        <circleGeometry args={[0.43, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#cfd4d8" metalness={1} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <planeGeometry args={[0.86, 1.4]} />
        <meshStandardMaterial color="#cfd4d8" metalness={1} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
    </group>
  )
}

// pampas grass in a cream vase
function Pampas({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 0.44, 14]} />
        <meshStandardMaterial color="#efe6d8" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        const lean = 0.12 + hash(i + 60) * 0.15
        return (
          <group key={i} rotation={[Math.cos(a) * lean, a, Math.sin(a) * lean]}>
            <mesh position={[0, 0.62, 0]}>
              <cylinderGeometry args={[0.006, 0.009, 0.85, 5]} />
              <meshStandardMaterial color="#c9b088" roughness={1} />
            </mesh>
            <mesh position={[0, 1.14, 0]} scale={[0.5, 1.6, 0.5]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color="#e3cba4" roughness={1} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// —— Ramsha's desk clutter: the small stuff that makes a room look lived-in ——

function Mug({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.042, 0.1, 14]} />
        <meshStandardMaterial color="#c2704e" roughness={0.55} />
      </mesh>
      <mesh position={[0.055, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.007, 8, 16]} />
        <meshStandardMaterial color="#c2704e" roughness={0.55} />
      </mesh>
      {/* cold coffee, half drunk */}
      <mesh position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.038, 14]} />
        <meshStandardMaterial color="#2c1a0c" roughness={0.3} />
      </mesh>
    </group>
  )
}

function OpenNotebook({ position, rotation = 0 }) {
  const pageTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 160
    const g = c.getContext('2d')
    g.fillStyle = '#f6f1e4'
    g.fillRect(0, 0, 128, 160)
    g.strokeStyle = 'rgba(90,80,120,0.25)'
    g.lineWidth = 1
    for (let y = 24; y < 150; y += 14) {
      g.beginPath()
      g.moveTo(10, y)
      g.lineTo(118, y)
      g.stroke()
    }
    // scribbled side-project ideas
    g.strokeStyle = 'rgba(43,33,24,0.7)'
    g.lineWidth = 1.4
    for (let y = 24; y < 96; y += 14) {
      g.beginPath()
      g.moveTo(14, y - 4)
      for (let x = 14; x < 100 - hash(y) * 30; x += 6) {
        g.lineTo(x, y - 4 + Math.sin(x * 0.8 + y) * 1.6)
      }
      g.stroke()
    }
    // a little box diagram, half-finished
    g.strokeRect(24, 108, 32, 22)
    g.strokeRect(72, 112, 28, 18)
    g.beginPath()
    g.moveTo(56, 119)
    g.lineTo(72, 121)
    g.stroke()
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.085, 0.085].map((x) => (
        <mesh key={x} position={[x, 0.006, 0]} rotation={[-Math.PI / 2, 0, x < 0 ? 0.02 : -0.02]}>
          <planeGeometry args={[0.17, 0.24]} />
          <meshStandardMaterial map={pageTex} roughness={0.9} />
        </mesh>
      ))}
      {/* pen resting in the gutter */}
      <mesh position={[0.01, 0.014, 0.04]} rotation={[0, 0.5, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.15, 8]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Headphones({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <mesh>
        <torusGeometry args={[0.1, 0.014, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0, 0.012]}>
          <cylinderGeometry args={[0.038, 0.038, 0.03, 14]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.45} />
        </mesh>
      ))}
    </group>
  )
}

function StickyNote({ position, rotation = 0, color, text }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 96
    const g = c.getContext('2d')
    g.fillStyle = color
    g.fillRect(0, 0, 96, 96)
    g.fillStyle = 'rgba(43,33,24,0.85)'
    g.font = '22px Caveat, cursive'
    g.textAlign = 'center'
    const lines = text.split('\n')
    lines.forEach((l, i) => g.fillText(l, 48, 44 + i * 26 - (lines.length - 1) * 10))
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [color, text])

  return (
    <mesh position={position} rotation={[0, 0, rotation]}>
      <planeGeometry args={[0.16, 0.16]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.12} />
    </mesh>
  )
}

function Plant({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.36, 12]} />
        <meshStandardMaterial color="#7a4a2e" roughness={0.85} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[Math.sin(i * 1.05) * 0.1, 0.55 + (i % 3) * 0.08, Math.cos(i * 1.05) * 0.1]}
          rotation={[Math.sin(i) * 0.5, i, 0]}
          scale={[0.35, 1.4, 0.12]}
        >
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color="#1c3320" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// WASD strolling indoors: moves the camera AND the orbit focus together,
// so drag-to-look keeps working while you walk
function KeyPan({ controlsRef, enabled }) {
  const keys = useRef({})

  useEffect(() => {
    if (!enabled) return
    const kd = (e) => (keys.current[e.code] = true)
    const ku = (e) => (keys.current[e.code] = false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [enabled])

  const vel = useRef(new Vector3())

  useFrame(({ camera }, delta) => {
    if (!enabled) return
    const c = controlsRef.current
    if (!c) return
    const k = keys.current
    const fwd = new Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-6) return
    fwd.normalize()
    const right = new Vector3(-fwd.z, 0, fwd.x)
    const v = new Vector3()
    if (k.KeyW || k.ArrowUp) v.add(fwd)
    if (k.KeyS || k.ArrowDown) v.sub(fwd)
    if (k.KeyA || k.ArrowLeft) v.sub(right)
    if (k.KeyD || k.ArrowRight) v.add(right)
    // ease toward the desired velocity — walking feels weighted, not twitchy
    const desired = v.lengthSq() ? v.normalize().multiplyScalar(3.4) : v
    vel.current.lerp(desired, Math.min(1, delta * 8))
    if (vel.current.lengthSq() < 1e-6) return
    const step = vel.current.clone().multiplyScalar(delta)
    camera.position.add(step)
    c.target.add(step)
    c.target.x = Math.max(-3.8, Math.min(3.8, c.target.x))
    c.target.z = Math.max(-2.7, Math.min(4.7, c.target.z))
    c.target.y = Math.max(0.5, Math.min(3.2, c.target.y))
  })

  return null
}

// floating labeled arrow marking an interactive thing in the room
function Hotspot({ position, label }) {
  const grp = useRef()

  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 80
    const g = c.getContext('2d')
    // soft golden halo behind the pill
    g.shadowColor = 'rgba(232,165,75,0.55)'
    g.shadowBlur = 14
    const bg = g.createLinearGradient(0, 10, 0, 70)
    bg.addColorStop(0, 'rgba(32,23,14,0.94)')
    bg.addColorStop(1, 'rgba(12,8,5,0.94)')
    g.fillStyle = bg
    g.beginPath()
    g.roundRect(10, 10, 300, 60, 30)
    g.fill()
    g.shadowBlur = 0
    const edge = g.createLinearGradient(0, 10, 0, 70)
    edge.addColorStop(0, 'rgba(245,227,168,0.9)')
    edge.addColorStop(1, 'rgba(154,123,63,0.9)')
    g.strokeStyle = edge
    g.lineWidth = 2.5
    g.stroke()
    g.fillStyle = '#f4e4c1'
    g.font = 'italic 28px Georgia'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 160, 41)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [label])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (grp.current) {
      grp.current.position.y = position[1] + Math.sin(t * 2.6 + position[0]) * 0.07
      grp.current.children[0].rotation.y = t * 1.5
    }
  })

  return (
    <group ref={grp} position={position}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.16, 0]}>
        <coneGeometry args={[0.09, 0.22, 4]} />
        <meshStandardMaterial color="#c9a54e" emissive="#e8a54b" emissiveIntensity={0.8} />
      </mesh>
      <sprite position={[0, 0.15, 0]} scale={[1.0, 0.25, 1]}>
        <spriteMaterial map={tex} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

// doorstep narration, game-style: lines drift in one by one, top-right
const STORY_LINES = [
  'a rainy night, somewhere quiet…',
  'you’ve walked too far in the rain.',
  'behind the door at № 41, a candle is burning.',
  'Ramsha’s reading room — left open for visitors.',
  '✦ ring the bell · lift the knocker · or push the door',
  '✦ walk with W A S D · drag to look around',
  '✦ the front stairs go all the way to the rooftop',
]

function StoryLines() {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (n >= STORY_LINES.length) return
    const t = setTimeout(() => setN(n + 1), n === 0 ? 600 : 1700)
    return () => clearTimeout(t)
  }, [n])

  return (
    <div className="story-lines">
      {STORY_LINES.slice(0, n).map((l, i) => (
        <div key={i} className={`story-line${l.startsWith('✦') ? ' story-line--hint' : ''}`}>
          {l}
        </div>
      ))}
    </div>
  )
}

const HOTSPOTS = [
  { p: [-0.69, 2.95, -2.0], l: 'the portfolio ✦' },
  { p: [2.45, 2.5, -0.6], l: 'the candle' },
  { p: [-4.0, 3.9, 0.5], l: 'window & curtains' },
  { p: [4.0, 3.1, 1.5], l: 'the fire' },
  { p: [0.2, 0.85, 1.35], l: 'play fetch' },
  { p: [4.0, 3.5, 3.4], l: 'play music' },
]

// hanging candle chandelier — the room's main warm light
function Chandelier({ position, on = true }) {
  const light = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (light.current) {
      light.current.intensity = on ? 26 * (1 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 11.9) * 0.04) : 0
    }
  })

  return (
    <group position={position}>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
        <meshStandardMaterial color="#14100a" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.028, 10, 28]} />
        <meshStandardMaterial color="#2c2018" metalness={0.75} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.45, -0.75, Math.sin(a) * 0.45]}>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.02, 0.025, 0.12, 8]} />
              <meshStandardMaterial color="#efe3c4" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.17, 0]} visible={on}>
              <coneGeometry args={[0.025, 0.08, 8]} />
              <meshBasicMaterial color="#ffd27a" />
            </mesh>
          </group>
        )
      })}
      <pointLight ref={light} position={[0, -0.6, 0]} color="#e8a54b" distance={10} decay={2} />
    </group>
  )
}

// keeps the orbiting camera inside the room — no flying through walls
function ClampCamera({ enabled }) {
  useFrame(({ camera }) => {
    if (!enabled) return
    camera.position.x = Math.max(-4.0, Math.min(4.0, camera.position.x))
    camera.position.y = Math.max(0.35, Math.min(3.7, camera.position.y))
    camera.position.z = Math.max(-2.85, Math.min(4.95, camera.position.z))
  })
  return null
}

// ————— reading the book right on the desk —————

const READ_POS = new Vector3(1.6, 2.45, 1.25)
const READ_TARGET = new Vector3(1.6, 1.12, -0.2)

// leans the camera over the open book while reading
function ReadCamera({ active, controlsRef }) {
  useFrame(({ camera }, delta) => {
    if (!active) return
    const k = Math.min(1, delta * 3)
    camera.position.lerp(READ_POS, k)
    const c = controlsRef.current
    if (c) {
      c.target.lerp(READ_TARGET, k)
      c.update()
    }
  })
  return null
}

// the physical book lying open on the desk — its cover swings open on arrival
function OpenBook3D() {
  const rightCover = useRef()
  const t = useRef(0)

  useFrame((_, delta) => {
    t.current = Math.min(1, t.current + delta / 0.9)
    const e = t.current * t.current * (3 - 2 * t.current)
    if (rightCover.current) rightCover.current.rotation.z = Math.PI * (1 - e)
  })

  return (
    <group position={[1.6, 1.094, -0.2]} rotation={[0, 0.06, 0]}>
      {/* soft contact shadow so the book sits ON the desk, not above it */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.35, 0.95]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[-0.29, 0.008, 0]} castShadow>
        <boxGeometry args={[0.58, 0.016, 0.8]} />
        <meshStandardMaterial color="#4f1c24" roughness={0.7} />
      </mesh>
      <mesh position={[-0.285, 0.028, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.76]} />
        <meshStandardMaterial color="#f4ecd8" roughness={0.9} />
      </mesh>
      <mesh position={[0.285, 0.028, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.76]} />
        <meshStandardMaterial color="#f4ecd8" roughness={0.9} />
      </mesh>
      <group ref={rightCover} position={[0, 0.05, 0]}>
        <mesh position={[0.29, 0, 0]} castShadow>
          <boxGeometry args={[0.58, 0.012, 0.8]} />
          <meshStandardMaterial color="#4f1c24" roughness={0.7} />
        </mesh>
      </group>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.05, 0.03, 0.8]} />
        <meshStandardMaterial color="#3a1218" roughness={0.7} />
      </mesh>
    </group>
  )
}

function ChapterLite({ num, title, sub }) {
  return (
    <div className="chapter-intro">
      <div className="chapter-num">Chapter {num}</div>
      <h1 className="chapter-title">{title}</h1>
      <div className="ornament">✦</div>
      <p className="chapter-sub">{sub}</p>
    </div>
  )
}

function JourneyPage() {
  return (
    <div className="prose">
      <p className="prose__lead">
        <span className="dropcap">I</span>t began, as these things do, with a single misbehaving{' '}
        <em>&lt;div&gt;</em>. I centered it. It moved. I centered it again — and somewhere in that
        long argument, a frontend developer was born.
      </p>
      <p>
        This book is the honest record: where I studied, what I built, the bugs I caused and the
        ones I heroically fixed at two in the morning. Turn the pages as you like — the rain
        outside isn't going anywhere.
      </p>
      <div className="signature">— Ramsha</div>
    </div>
  )
}

const SPREADS = [
  [
    <ChapterLite key="l" num="I" title="The Making of a Frontend Developer" sub="a mostly true story" />,
    <JourneyPage key="r" />,
  ],
  [<ChapterLite key="l" num="II" title="About the Author" sub="the short version" />, <AboutPage key="r" />],
  [<ChapterLite key="l" num="III" title="Experience" sub="a working life, in chapters" />, <ExperiencePage key="r" />],
  [<ChapterLite key="l" num="IV" title="Skills" sub="tools of the trade" />, <SkillsPage key="r" />],
  [<ChapterLite key="l" num="V" title="Education" sub="where it all began" />, <EducationPage key="r" />],
  [<ChapterLite key="l" num="VI" title="Send Word" sub="the author receives visitors" />, <ContactPage key="r" />],
]

const RIBBONS = [
  { label: 'Story', color: '#8b2e2e' },
  { label: 'About', color: '#3a5a3a' },
  { label: 'Work', color: '#2e4a8b' },
  { label: 'Skills', color: '#8b6b2e' },
  { label: 'School', color: '#5a2e8b' },
  { label: 'Contact', color: '#2e7a8b' },
]

// the readable spread — DOM for crisp text, styled as the open book's pages.
// Turn pages by their corners, or jump chapters by the bookmark ribbons.
function BookOverlay({ onClose }) {
  const [idx, setIdx] = useState(0)
  const [turning, setTurning] = useState(0)
  const timer = useRef()

  const goTo = (next, dir) => {
    if (next < 0 || next >= SPREADS.length || next === idx || turning) return
    pageSound()
    setTurning(dir)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setIdx(next)
      setTurning(0)
    }, 620)
  }
  const go = (dir) => goTo(idx + dir, dir)

  useEffect(() => () => clearTimeout(timer.current), [])

  // arrow keys turn pages too
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const [l, r] = SPREADS[idx]
  return (
    <div className="book-overlay">
      <div className="bo-book">
        {/* bookmark ribbons hanging over the top edge */}
        <div className="bo-ribbons">
          {RIBBONS.map((rb, i) => (
            <button
              key={rb.label}
              className={`bo-ribbon${i === idx ? ' on' : ''}`}
              style={{ '--rc': rb.color }}
              onClick={() => goTo(i, i > idx ? 1 : -1)}
            >
              {rb.label}
            </button>
          ))}
        </div>
        <div className="bo-page bo-page--left">{l}</div>
        <div className="bo-page">{r}</div>
        {turning === 1 && <div className="bo-turnpage" />}
        {turning === -1 && <div className="bo-turnpage bo-turnpage--back" />}
        <button className="bo-close" onClick={onClose} aria-label="Close the book">✕</button>
        {idx < SPREADS.length - 1 && (
          <button className="bo-corner bo-corner--next" onClick={() => go(1)} aria-label="Next page" />
        )}
        {idx > 0 && (
          <button className="bo-corner bo-corner--prev" onClick={() => go(-1)} aria-label="Previous page" />
        )}
        <div className="bo-count">{idx + 1} · {SPREADS.length}</div>
      </div>
    </div>
  )
}

// the resident puppy, chibi-style: oversized head, big glossy eyes, floppy
// ears. Pat it (click) or play fetch (click the red ball).
function Puppy() {
  const pup = useRef()
  const ball = useRef()
  const tail = useRef()
  const head = useRef()
  const state = useRef('idle') // idle | throw | fetch | return | happy
  const t = useRef(0)
  const from = useRef(new Vector3())
  const target = useRef(new Vector3())
  const HOME = useMemo(() => new Vector3(0.9, 0, 1.0), [])
  const BALL_HOME = useMemo(() => new Vector3(0.2, 0.09, 1.35), [])

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    const p = pup.current
    const b = ball.current
    if (!p || !b) return

    const excited = state.current !== 'idle'
    if (tail.current) tail.current.rotation.y = Math.sin(time * (excited ? 16 : 5)) * (excited ? 0.7 : 0.35)
    if (head.current) {
      // curious head tilts while idle, steady while running
      head.current.rotation.z = excited ? 0 : Math.sin(time * 0.7) * 0.14
      head.current.rotation.x = excited ? -0.1 : Math.sin(time * 1.1) * 0.05
    }

    if (state.current === 'throw') {
      t.current = Math.min(1, t.current + delta / 0.7)
      const k = t.current
      b.position.lerpVectors(from.current, target.current, k)
      b.position.y = 0.09 + Math.sin(k * Math.PI) * 1.2
      if (k >= 1) state.current = 'fetch'
    } else if (state.current === 'fetch') {
      const d = new Vector3().subVectors(b.position, p.position)
      d.y = 0
      const dist = d.length()
      if (dist > 0.35) {
        d.normalize()
        p.position.addScaledVector(d, Math.min(dist, 2.2 * delta))
        p.rotation.y = Math.atan2(d.x, d.z)
        p.position.y = Math.abs(Math.sin(time * 10)) * 0.05 // trot bounce
      } else {
        barkSound()
        state.current = 'return'
      }
    } else if (state.current === 'return') {
      const d = new Vector3().subVectors(HOME, p.position)
      d.y = 0
      if (d.length() > 0.15) {
        d.normalize()
        p.position.addScaledVector(d, 1.6 * delta)
        p.rotation.y = Math.atan2(d.x, d.z)
        p.position.y = Math.abs(Math.sin(time * 9)) * 0.045
        // carries the ball at its snout
        b.position.set(
          p.position.x + Math.sin(p.rotation.y) * 0.32,
          0.13,
          p.position.z + Math.cos(p.rotation.y) * 0.32
        )
      } else {
        b.position.copy(BALL_HOME)
        p.position.y = 0
        state.current = 'idle'
      }
    } else if (state.current === 'happy') {
      t.current += delta
      p.position.y = Math.abs(Math.sin(t.current * 9)) * 0.14
      if (t.current > 0.8) {
        p.position.y = 0
        state.current = 'idle'
      }
    } else {
      p.scale.y = 1 + Math.sin(time * 2.2) * 0.015 // idle breathing
    }
  })

  const throwBall = (e) => {
    e.stopPropagation()
    if (state.current !== 'idle') return
    from.current.copy(ball.current.position)
    target.current.set(-3 + Math.random() * 6, 0.09, -1.1 + Math.random() * 2.4)
    t.current = 0
    state.current = 'throw'
    tossSound() // the bark waits until the pup actually catches up with the ball
  }

  const pet = (e) => {
    e.stopPropagation()
    if (state.current !== 'idle') return
    t.current = 0
    state.current = 'happy'
    whimperSound()
  }

  return (
    <>
      <group ref={pup} position={[0.9, 0, 1.0]} onClick={pet} onPointerOver={cursorOn} onPointerOut={cursorOff}>
        {/* little body */}
        <mesh position={[0, 0.14, -0.04]} scale={[1, 0.9, 1.3]} castShadow>
          <sphereGeometry args={[0.13, 14, 12]} />
          <meshStandardMaterial color="#c99a5e" roughness={0.8} />
        </mesh>
        {/* stubby legs */}
        {[[-0.07, 0.05], [0.07, 0.05], [-0.07, -0.15], [0.07, -0.15]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.045, z]}>
            <cylinderGeometry args={[0.032, 0.038, 0.09, 8]} />
            <meshStandardMaterial color="#b8874c" roughness={0.85} />
          </mesh>
        ))}
        {/* big head — the chibi trick */}
        <group ref={head} position={[0, 0.34, 0.1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.145, 16, 14]} />
            <meshStandardMaterial color="#c99a5e" roughness={0.8} />
          </mesh>
          {/* muzzle + nose */}
          <mesh position={[0, -0.05, 0.12]} scale={[1, 0.72, 0.9]}>
            <sphereGeometry args={[0.062, 12, 10]} />
            <meshStandardMaterial color="#e8cfa3" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.028, 0.185]}>
            <sphereGeometry args={[0.021, 8, 8]} />
            <meshStandardMaterial color="#241708" roughness={0.3} />
          </mesh>
          {/* tongue */}
          <mesh position={[0, -0.085, 0.15]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.032, 0.008, 0.05]} />
            <meshStandardMaterial color="#d97a7a" roughness={0.6} />
          </mesh>
          {/* big glossy eyes with catchlights */}
          {[-0.062, 0.062].map((x) => (
            <group key={x} position={[x, 0.035, 0.125]}>
              <mesh>
                <sphereGeometry args={[0.034, 10, 10]} />
                <meshStandardMaterial color="#241708" roughness={0.15} />
              </mesh>
              <mesh position={[0.01, 0.012, 0.026]}>
                <sphereGeometry args={[0.009, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {/* floppy ears */}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0.09, -0.02]} rotation={[0.15, 0, x > 0 ? -0.85 : 0.85]} scale={[0.45, 1, 0.62]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color="#a3743a" roughness={0.9} />
            </mesh>
          ))}
        </group>
        {/* wagging tail */}
        <group ref={tail} position={[0, 0.2, -0.2]}>
          <mesh position={[0, 0.05, -0.05]} rotation={[0.8, 0, 0]}>
            <coneGeometry args={[0.032, 0.15, 8]} />
            <meshStandardMaterial color="#a3743a" roughness={0.9} />
          </mesh>
        </group>
      </group>
      {/* the fetch ball */}
      <mesh
        ref={ball}
        position={[0.2, 0.09, 1.35]}
        onClick={throwBall}
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
        castShadow
      >
        <sphereGeometry args={[0.09, 14, 12]} />
        <meshStandardMaterial color="#8b2e2e" roughness={0.5} />
      </mesh>
    </>
  )
}

// warm drifting fireflies between the trees at night
function Fireflies() {
  return (
    <>
      <Sparkles count={18} scale={[6, 1.5, 4]} size={3.5} speed={0.35} opacity={0.65} color="#ffd27a" position={[-5.5, 1.2, 11]} />
      <Sparkles count={14} scale={[5, 1.2, 4]} size={3} speed={0.3} opacity={0.55} color="#ffca66" position={[5.5, 1, 13.5]} />
    </>
  )
}

// a small black cat on the porch step; its eyes catch the light at night
function Cat({ position, night }) {
  const tail = useRef()
  useFrame(({ clock }) => {
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(clock.getElapsedTime() * 1.3) * 0.25
  })
  return (
    <group position={position} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.16, 0]} scale={[0.8, 1, 1.4]} castShadow>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color="#15100c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.34, 0.14]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#15100c" roughness={0.9} />
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.44, 0.12]}>
          <coneGeometry args={[0.03, 0.06, 4]} />
          <meshStandardMaterial color="#15100c" roughness={0.9} />
        </mesh>
      ))}
      <mesh ref={tail} position={[0, 0.14, -0.2]}>
        <cylinderGeometry args={[0.018, 0.03, 0.32, 6]} />
        <meshStandardMaterial color="#15100c" roughness={0.9} />
      </mesh>
      {night &&
        [-0.035, 0.035].map((x) => (
          <mesh key={x} position={[x, 0.35, 0.22]}>
            <sphereGeometry args={[0.011, 6, 6]} />
            <meshBasicMaterial color="#ffd27a" />
          </mesh>
        ))}
    </group>
  )
}

// distant birds circling in the morning sky
function Birds() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current?.children.forEach((b, i) => {
      const a = t * 0.15 + i * 1.4
      b.position.set(Math.sin(a) * (14 + i * 2), 6.5 + Math.sin(a * 2.1 + i) * 0.6, 18 + Math.cos(a) * (7 + i))
      b.rotation.y = a + Math.PI / 2
      const flap = Math.sin(t * (5 + i)) * 0.5
      b.children[0].rotation.z = flap
      b.children[1].rotation.z = -flap
    })
  })
  return (
    <group ref={ref}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh position={[0.07, 0, 0]}>
            <boxGeometry args={[0.16, 0.01, 0.05]} />
            <meshBasicMaterial color="#1a140e" />
          </mesh>
          <mesh position={[-0.07, 0, 0]}>
            <boxGeometry args={[0.16, 0.01, 0.05]} />
            <meshBasicMaterial color="#1a140e" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// the world beyond the fence: treeline, hills, a far-off cottage, stars
function DistantScenery({ night, rain }) {
  const treeline = useMemo(() => {
    const out = []
    for (let i = 0; i < 30; i++) {
      const x = -30 + hash(i * 23 + 2) * 60
      const z = 7 + hash(i * 23 + 3) * 21
      if (x > -11.5 && x < 11.5 && z < 20.5) continue // inside the fence
      out.push({ x, z, s: 1.8 + hash(i * 23 + 4) * 1.6, pine: hash(i * 23 + 5) > 0.45 })
    }
    return out
  }, [])

  return (
    <group>
      {/* far ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 35]}>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#12100c" roughness={1} />
      </mesh>
      {/* rolling hills */}
      {[[-18, 31, 14, 4], [8, 35, 18, 5], [26, 30, 12, 3.5]].map(([x, z, rx, ry], i) => (
        <mesh key={i} position={[x, -0.6, z]} scale={[rx, ry, rx * 0.6]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#0e120c" roughness={1} />
        </mesh>
      ))}
      {treeline.map((t, i) =>
        t.pine ? (
          <Pine key={i} position={[t.x, 0, t.z]} s={t.s} />
        ) : (
          <Tree key={i} position={[t.x, 0, t.z]} s={t.s} />
        )
      )}
      {/* a neighbor's cottage, one window lit */}
      <group position={[-15, 0, 24]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[3, 2, 2.2]} />
          <meshStandardMaterial color="#0f0c08" roughness={1} />
        </mesh>
        <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.2, 1.4, 4]} />
          <meshStandardMaterial color="#0b0906" roughness={1} />
        </mesh>
        <mesh position={[0.7, 3.2, 0.3]}>
          <boxGeometry args={[0.3, 0.9, 0.3]} />
          <meshStandardMaterial color="#0b0906" roughness={1} />
        </mesh>
        <mesh position={[0.8, 1.1, 1.11]}>
          <planeGeometry args={[0.5, 0.6]} />
          <meshBasicMaterial color="#ffbf6b" />
        </mesh>
      </group>
      {night && !rain && <Stars radius={60} depth={20} count={800} factor={3} saturation={0} fade speed={0.5} />}
    </group>
  )
}

function Mist({ tex }) {
  const group = useRef()
  const seeds = useMemo(() => Array.from({ length: 5 }, (_, i) => hash(i * 17 + 8)), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    group.current?.children.forEach((s, i) => {
      s.position.x = ((seeds[i] * 20 - 10 + t * (0.15 + seeds[i] * 0.1)) % 22) - 11
      s.material.opacity = 0.1 + Math.sin(t * 0.3 + i * 2) * 0.035
    })
  })

  return (
    <group ref={group}>
      {seeds.map((sd, i) => (
        <sprite key={i} position={[0, 0.55, 7 + sd * 9]} scale={[7.5, 1.7, 1]}>
          <spriteMaterial map={tex} color="#7d8798" transparent opacity={0.12} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// the front yard: wet ground, stone path, greenery, fence, lampposts
function FrontYard({ night, rain }) {
  const poolTex = useMemo(() => makePuffTex(), [])
  // deterministic scatter, keeping the path corridor clear
  const flora = useMemo(() => {
    const trees = []
    for (let i = 0; i < 14; i++) {
      const x = -10.5 + hash(i * 7 + 1) * 21
      const z = 6.5 + hash(i * 7 + 2) * 12.5
      if (Math.abs(x - 0.4) < 2.2 && z < 13) continue
      trees.push({ x, z, s: 1 + hash(i * 7 + 3) * 0.9, pine: hash(i * 7 + 4) > 0.5 })
    }
    const bushes = []
    for (let i = 0; i < 14; i++) {
      const x = -10 + hash(i * 13 + 5) * 20
      const z = 6.4 + hash(i * 13 + 6) * 12.5
      if (Math.abs(x - 0.4) < 1.6 && z < 13) continue
      bushes.push({ x, z, r: 0.3 + hash(i * 13 + 7) * 0.35, flower: hash(i * 13 + 8) > 0.65 })
    }
    const grass = []
    for (let i = 0; i < 70; i++) {
      const x = -10.5 + hash(i * 17 + 9) * 21
      const z = 6.2 + hash(i * 17 + 10) * 13
      if (Math.abs(x - 0.4) < 1 && z < 12.5) continue
      grass.push({ x, z, s: 0.7 + hash(i * 17 + 11) * 0.8 })
    }
    return { trees, bushes, grass }
  }, [])

  const fencePosts = useMemo(() => {
    const posts = []
    for (let x = -11; x <= 11.01; x += 1.375) posts.push([x, 20])
    for (let z = 7.4; z < 20; z += 1.4) {
      posts.push([-11, z])
      posts.push([11, z])
    }
    return posts
  }, [])

  return (
    <group>
      {/* wet ground — low roughness sells the rain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 14.8]} receiveShadow>
        <planeGeometry args={[40, 19]} />
        <meshStandardMaterial color="#191713" roughness={0.45} />
      </mesh>
      {/* grassy verge — slightly greener ground off the path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6.5, 0.001, 13]}>
        <circleGeometry args={[5.5, 26]} />
        <meshStandardMaterial color="#141c12" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.8, 0.001, 14]}>
        <circleGeometry args={[5, 26]} />
        <meshStandardMaterial color="#131b11" roughness={0.9} />
      </mesh>
      {/* stepping stones to the door */}
      {[6.6, 7.6, 8.6, 9.6, 10.6, 11.6].map((z, i) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0.4 + (i % 2 ? 0.14 : -0.14), 0.005, z]}>
          <circleGeometry args={[0.42, 20]} />
          <meshStandardMaterial color="#33302a" roughness={0.6} />
        </mesh>
      ))}
      {/* hedges lining the path */}
      <mesh position={[-1.6, 0.42, 8.8]} castShadow>
        <boxGeometry args={[0.8, 0.84, 5.6]} />
        <meshStandardMaterial color="#0e1a10" roughness={1} />
      </mesh>
      <mesh position={[2.4, 0.42, 8.8]} castShadow>
        <boxGeometry args={[0.8, 0.84, 5.6]} />
        <meshStandardMaterial color="#0e1a10" roughness={1} />
      </mesh>
      {/* scattered greenery */}
      {flora.trees.map((t, i) =>
        t.pine ? (
          <Pine key={`t${i}`} position={[t.x, 0, t.z]} s={t.s} />
        ) : (
          <Tree key={`t${i}`} position={[t.x, 0, t.z]} s={t.s} />
        )
      )}
      {flora.bushes.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.r * 0.7, 0]} scale={[1, 0.75, 1]}>
            <sphereGeometry args={[b.r, 10, 8]} />
            <meshStandardMaterial color="#101d11" roughness={1} />
          </mesh>
          {b.flower &&
            [0, 1, 2, 3, 4].map((f) => (
              <mesh
                key={f}
                position={[
                  Math.sin(f * 1.7) * b.r * 0.7,
                  b.r * 0.9 + hash(f + b.x) * 0.1,
                  Math.cos(f * 2.3) * b.r * 0.6,
                ]}
              >
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshStandardMaterial color={f % 2 ? '#8b2e2e' : '#c9a54e'} roughness={0.6} />
              </mesh>
            ))}
        </group>
      ))}
      {flora.grass.map((g, i) => (
        <mesh key={`g${i}`} position={[g.x, 0.06 * g.s, g.z]} scale={g.s}>
          <coneGeometry args={[0.05, 0.14, 5]} />
          <meshStandardMaterial color="#16240f" roughness={1} />
        </mesh>
      ))}
      {/* perimeter fence */}
      {fencePosts.map(([x, z], i) => (
        <mesh key={`f${i}`} position={[x, 0.45, z]}>
          <boxGeometry args={[0.09, 0.9, 0.09]} />
          <meshStandardMaterial color="#d9d2c4" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 20]}>
        <boxGeometry args={[22.2, 0.07, 0.05]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 20]}>
        <boxGeometry args={[22.2, 0.07, 0.05]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.9} />
      </mesh>
      {[-11, 11].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.72, 13.35]}>
            <boxGeometry args={[0.05, 0.07, 13.3]} />
            <meshStandardMaterial color="#d9d2c4" roughness={0.9} />
          </mesh>
          <mesh position={[x, 0.4, 13.35]}>
            <boxGeometry args={[0.05, 0.07, 13.3]} />
            <meshStandardMaterial color="#d9d2c4" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <Bench position={[-3.4, 0, 8.8]} rotation={0.6} />
      <LampPost position={[-1.7, 0, 6.6]} />
      <LampPost position={[2.5, 0, 11.8]} />
      {/* warm pools of lamplight on the wet ground */}
      {[[-1.7, 6.6, 2.4], [2.5, 11.8, 2.4], [0.4, 5.9, 2.0]].map(([x, z, r]) => (
        <mesh key={`${x}${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, z]}>
          <planeGeometry args={[r, r]} />
          <meshBasicMaterial map={poolTex} color="#e8a54b" transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <Mailbox position={[1.5, 0, 7.2]} />
      {/* knee-high mist creeping across the wet garden */}
      <Mist tex={poolTex} />
      {/* rain puddles — glassy discs that catch the lamplight */}
      {[[-1.1, 7.9, 0.5], [1.9, 9.7, 0.7], [-0.5, 12.1, 0.9], [3.6, 7.6, 0.45]].map(([x, z, r]) => (
        <mesh key={`${x}${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, z]}>
          <circleGeometry args={[r, 26]} />
          <meshStandardMaterial color="#232833" roughness={0.08} metalness={0.6} />
        </mesh>
      ))}
      {/* the moon/sun hides behind the overcast when it rains */}
      {!rain && <MoonSun night={night} />}
      {rain && <RainFall />}
      {night && !rain && <Fireflies />}
      {!night && <Birds />}
      <Cat position={[1.5, 0.06, 6.2]} night={night} />
    </group>
  )
}

// the entry wall behind the visitor: plank siding, paneled oak door,
// knocker, doorbell, lantern, number plaque, stone step and mat
function FrontDoorway({ doorRef, onBell, onKnock, onDoor, sidingTex, doorTex }) {
  const matTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#4a3a28'
    g.fillRect(0, 0, 256, 128)
    g.strokeStyle = '#2e2418'
    g.lineWidth = 8
    g.strokeRect(10, 10, 236, 108)
    g.fillStyle = '#2e2418'
    g.font = 'bold 34px Georgia'
    g.textAlign = 'center'
    g.fillText('WELCOME', 128, 76)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  const numTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 96
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#171009'
    g.fillRect(0, 0, 96, 64)
    g.fillStyle = '#c9a54e'
    g.font = 'bold 40px Georgia'
    g.textAlign = 'center'
    g.fillText('41', 48, 48)
    const tx = new CanvasTexture(c)
    tx.colorSpace = SRGBColorSpace
    return tx
  }, [])

  return (
    <group position={[0, 0, 5.4]}>
      {/* plank siding walls — they stop at the eave, the roof takes over */}
      <mesh position={[-6.4, 1.7, 0]}>
        <boxGeometry args={[11.6, 5.4, 0.3]} />
        <meshStandardMaterial map={sidingTex} roughness={0.92} />
      </mesh>
      <mesh position={[6.75, 1.7, 0]}>
        <boxGeometry args={[11.6, 5.4, 0.3]} />
        <meshStandardMaterial map={sidingTex} roughness={0.92} />
      </mesh>
      <mesh position={[0.4, 3.3, 0]}>
        <boxGeometry args={[1.5, 2.2, 0.3]} />
        <meshStandardMaterial map={sidingTex} roughness={0.92} />
      </mesh>
      {/* door frame trim — the hinge-side board is wide enough to actually
          seal the gap between door and wall opening */}
      <Wood position={[-0.5, 1.15, 0]} size={[0.36, 2.5, 0.4]} color="#171009" />
      <Wood position={[1.22, 1.15, 0]} size={[0.14, 2.5, 0.4]} color="#171009" />
      <Wood position={[0.4, 2.32, 0]} size={[1.78, 0.16, 0.4]} color="#171009" />
      {/* house number */}
      <mesh position={[0.4, 2.56, 0.19]}>
        <boxGeometry args={[0.36, 0.24, 0.03]} />
        <meshStandardMaterial color="#0f0a05" />
      </mesh>
      <mesh position={[0.4, 2.56, 0.21]}>
        <planeGeometry args={[0.3, 0.18]} />
        <meshBasicMaterial map={numTex} />
      </mesh>

      {/* paneled oak door, hinged on the left — push (click) it to enter */}
      <group
        ref={doorRef}
        position={[-0.32, 0, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onDoor()
        }}
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
      >
        <mesh position={[0.72, 1.12, 0]} castShadow>
          <boxGeometry args={[1.44, 2.24, 0.09]} />
          <meshStandardMaterial map={doorTex} roughness={0.6} />
        </mesh>
        {/* recessed panels: dark reveal, raised wood center */}
        {[[0.42, 1.62], [1.02, 1.62], [0.42, 0.62], [1.02, 0.62]].map(([px, py]) => (
          <group key={`${px}-${py}`}>
            <mesh position={[px, py, 0.047]}>
              <boxGeometry args={[0.42, 0.78, 0.012]} />
              <meshStandardMaterial color="#241408" roughness={0.7} />
            </mesh>
            <mesh position={[px, py, 0.056]}>
              <boxGeometry args={[0.3, 0.64, 0.012]} />
              <meshStandardMaterial map={doorTex} roughness={0.6} />
            </mesh>
          </group>
        ))}
        {/* knob on a brass backplate — bright enough to spot from the path */}
        <mesh position={[1.3, 1.1, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.025, 16]} />
          <meshStandardMaterial color="#8a6a34" metalness={0.85} roughness={0.35} />
        </mesh>
        <mesh position={[1.3, 1.1, 0.13]}>
          <sphereGeometry args={[0.062, 14, 14]} />
          <meshStandardMaterial
            color="#c9a54e"
            metalness={0.85}
            roughness={0.25}
            emissive="#8a6a2f"
            emissiveIntensity={0.35}
          />
        </mesh>
        {/* brass ring knocker — click to knock */}
        <group
          position={[0.72, 1.6, 0.06]}
          onClick={(e) => {
            e.stopPropagation()
            onKnock()
          }}
          onPointerOver={cursorOn}
          onPointerOut={cursorOff}
        >
          <mesh>
            <boxGeometry args={[0.09, 0.06, 0.04]} />
            <meshStandardMaterial color="#7a5f2e" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.08, 0.02]}>
            <torusGeometry args={[0.08, 0.014, 10, 24]} />
            <meshStandardMaterial color="#9a7b3f" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* doorbell on the right trim — click to ring */}
      <group
        position={[1.42, 1.3, 0.21]}
        onClick={(e) => {
          e.stopPropagation()
          onBell()
        }}
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
      >
        <mesh>
          <boxGeometry args={[0.12, 0.2, 0.03]} />
          <meshStandardMaterial color="#9a7b3f" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial color="#f0e6d0" emissive="#e8a54b" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* hanging porch lantern — the scanned model */}
      <Suspense fallback={null}>
        <LanternModel position={[0.4, 2.62, 0.45]} height={0.62} />
      </Suspense>
      <pointLight position={[0.4, 2.85, 0.55]} intensity={16} color="#e8a54b" distance={7} decay={2} castShadow />

      {/* eave line across the facade */}
      <Wood position={[0, 4.28, 0.25]} size={[14, 0.14, 0.5]} color="#171009" />

      {/* lit windows either side of the door — someone is home */}
      <FacadeWindow position={[-2.3, 1.6, 0.16]} />
      <FacadeWindow position={[3.1, 1.6, 0.16]} />

      {/* porch canopy on two posts */}
      <mesh position={[0.4, 2.78, 0.55]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[2.1, 0.06, 1.2]} />
        <meshStandardMaterial color="#171009" roughness={0.8} />
      </mesh>
      {[-0.45, 1.25].map((x) => (
        <mesh key={x} position={[x, 1.2, 1.0]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 2.4, 10]} />
          <meshStandardMaterial color="#171009" roughness={0.8} />
        </mesh>
      ))}

      {/* stone step + welcome mat */}
      <mesh position={[0.4, 0.03, 0.6]} receiveShadow>
        <boxGeometry args={[2.0, 0.06, 1.1]} />
        <meshStandardMaterial color="#38352f" roughness={0.95} />
      </mesh>
      <mesh position={[0.4, 0.075, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.95, 0.5]} />
        <meshBasicMaterial map={matTex} />
      </mesh>
    </group>
  )
}

// the opening shot: falling out of the storm clouds, drifting down over the
// garden, landing gently on the doorstep
function ArrivalCamera({ active, onLand }) {
  const t = useRef(0)
  // spline: clouds → skim ABOVE the ridge by the chimney → swing out over the
  // yard → touch down at the gate. Never enters the house volume.
  // a clean straight-in approach: out of the clouds, down over the garden,
  // settling in front of the door — the house stays ahead the whole way
  const path = useMemo(
    () =>
      new CatmullRomCurve3(
        [
          new Vector3(-2, 14, 27),
          new Vector3(1.5, 7, 17),
          new Vector3(0.9, 3.4, 12.5),
          new Vector3(0.4, 1.6, 10.5),
        ],
        false,
        'centripetal'
      ),
    []
  )

  useFrame(({ camera }, delta) => {
    if (!active) return
    t.current = Math.min(1, t.current + delta / 6.5)
    const e = t.current * t.current * (3 - 2 * t.current)
    camera.position.copy(path.getPoint(e))
    // gaze settles from the rooftops onto the front door
    camera.lookAt(0.4, 2.2 + (1 - e) * 1.5, 5.4)
    if (t.current >= 1) onLand()
  })

  return null
}

// once you're inside, the front door becomes a door again: click to shut it
// against the storm, click to swing it back open
function DoorAnimator({ doorRef, active, shut }) {
  useFrame((_, delta) => {
    if (!active || !doorRef.current) return
    const target = shut ? 0 : 2.0
    doorRef.current.rotation.y += (target - doorRef.current.rotation.y) * Math.min(1, delta * 3)
  })
  return null
}

// walks the camera from wherever the visitor is standing, through the opening
// door, into the room — a quadratic bezier through the doorway
function EntryCamera({ stage, onArrived, doorRef }) {
  const t = useRef(0)
  const from = useRef(null)
  const DOORWAY = useMemo(() => new Vector3(0.4, 1.65, 6.4), [])
  const INSIDE = useMemo(() => new Vector3(0.5, 1.7, 4.6), [])

  useFrame(({ camera }, delta) => {
    if (stage !== 'entering') {
      from.current = null
      t.current = 0
      return
    }
    if (!from.current) from.current = camera.position.clone()
    if (doorRef.current) {
      doorRef.current.rotation.y = Math.min(2.0, doorRef.current.rotation.y + delta * 1.8)
    }
    t.current = Math.min(1, t.current + delta / 3.2)
    const e = t.current * t.current * (3 - 2 * t.current)
    const a = (1 - e) * (1 - e)
    const b = 2 * (1 - e) * e
    const cc = e * e
    camera.position.set(
      a * from.current.x + b * DOORWAY.x + cc * INSIDE.x,
      a * from.current.y + b * DOORWAY.y + cc * INSIDE.y,
      a * from.current.z + b * DOORWAY.z + cc * INSIDE.z
    )
    camera.lookAt(0.4 - 0.4 * e, 1.5 - 0.2 * e, 5.2 - 6.2 * e)
    if (t.current >= 1) onArrived()
  })

  return null
}

let hasEnteredHouse = false // intro plays once per visit, not on every return from the book
let tourSeen = false

const TOUR = [
  'Welcome in, and out of the rain. Drag to look around — and stroll the room with W A S D.',
  'See the burgundy book with the gold bands on the shelf? That’s the portfolio. Click it whenever you’re ready to read.',
  'The candle on the desk really works — click it to blow it out, click again to strike a match.',
  'Click the window to swing it open and listen to the rain come in. The velvet curtains draw shut too.',
  'The puppy by the rug would love a game — click the red ball to throw it, or pat the pup directly.',
  'Poke the frames, spin up an album from the posters, or click the fireplace to douse and relight it. That’s the house — make yourself at home.',
]

export default function Room({ onOpen }) {
  const controlsRef = useRef()
  const doorRef = useRef()
  const enteringRef = useRef(false)
  const [stage, setStage] = useState(hasEnteredHouse ? 'done' : 'gate')

  function beginJourney() {
    startRain() // this click is the user gesture browsers demand — sound unlocked
    setStage('arrival')
  }
  const [tourStep, setTourStep] = useState(0)
  const [tourOpen, setTourOpen] = useState(!tourSeen)
  const [doorShut, setDoorShut] = useState(false)
  const [weather, setWeather] = useState('night')
  const [rain, setRain] = useState(true)
  const [reading, setReading] = useState(false)
  const [showPages, setShowPages] = useState(false)
  const [lightsOn, setLightsOn] = useState(false) // study mood by default

  // pages fade in once the 3D cover has swung open
  useEffect(() => {
    if (!reading) {
      setShowPages(false)
      return
    }
    const timer = setTimeout(() => setShowPages(true), 750)
    return () => clearTimeout(timer)
  }, [reading])
  const [guides, setGuides] = useState(false)
  const cameraRef = useRef()

  function zoomBy(dir) {
    const cam = cameraRef.current
    const ctr = controlsRef.current
    if (!cam || !ctr) return
    const v = new Vector3().subVectors(ctr.target, cam.position)
    const nd = Math.max(1.3, Math.min(6.4, v.length() - dir * 0.9))
    v.normalize()
    cam.position.copy(ctr.target).addScaledVector(v, -nd)
    ctr.update()
  }
  const W = WEATHER[weather]
  const night = weather === 'night'

  useEffect(() => {
    startNature(weather) // crickets & owl at night, songbirds at dawn
    return stopNature
  }, [weather])

  const [musicPlaying, setMusicPlaying] = useState(false)
  useEffect(() => {
    const onPlay = () => setMusicPlaying(true)
    const onStop = () => setMusicPlaying(false)
    window.addEventListener('album-play', onPlay)
    window.addEventListener('album-stop', onStop)
    return () => {
      window.removeEventListener('album-play', onPlay)
      window.removeEventListener('album-stop', onStop)
    }
  }, [])

  function endTour() {
    tourSeen = true
    setTourOpen(false)
  }

  function beginEntry(via) {
    if (stage !== 'waiting' || enteringRef.current) return
    enteringRef.current = true
    let delay = 150
    if (via === 'bell') {
      doorbellSound()
      delay = 950
    } else if (via === 'knock') {
      knockSound()
      delay = 700
    }
    setTimeout(() => {
      creakSound()
      setStage('entering')
    }, delay)
  }

  const floorTex = useMemo(() => makeWood({ base: '#b08e64', planks: 6, repeat: [4, 4] }), [])
  const shelfTex = useMemo(() => makeWood({ base: '#c9a87e' }), [])
  const deskTex = useMemo(() => makeWood({ base: '#bfa075' }), [])
  const sidingTex = useMemo(() => makeWood({ base: '#d9d2c4', planks: 8, repeat: [3, 1] }), [])
  const doorTex = useMemo(() => makeWood({ base: '#2e3230' }), [])
  const wallTex = useMemo(() => makeWallTex(), [])
  const roofBrickTex = useMemo(() => makeBrickTex(), [])
  const shingleTex = useMemo(() => makeShingleTex(), [])

  return (
    <div className="room">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: hasEnteredHouse ? [0.5, 1.7, 4.6] : [-2, 14, 27], fov: 50 }}
        onCreated={({ camera }) => (cameraRef.current = camera)}
      >
        <color attach="background" args={[W.bg]} />
        <fog attach="fog" args={W.fog} />

        {/* physically-correct falloff: point lights need big intensities */}
        <ambientLight intensity={lightsOn ? W.ambient + 0.15 : 0.12} />
        <hemisphereLight args={['#fff2dd', '#9a9184', lightsOn ? W.hemi : 0.08]} />
        {/* moonlight at night, low sun in the morning */}
        <directionalLight position={[-4, 5, 3]} intensity={W.dirInt} color={W.dirColor} castShadow />
        <Chandelier position={[0, 4.0, 1]} on={lightsOn} />
        {/* subtle HDRI so brass and gold have something to reflect */}
        <Suspense fallback={null}>
          <Environment preset={W.env} />
        </Suspense>

        {/* floor (interior only — the yard has its own wet ground) + walls */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -3.5]} receiveShadow>
          <planeGeometry args={[24, 17.8]} />
          <meshStandardMaterial map={floorTex} roughness={0.85} />
        </mesh>
        <mesh position={[0, 3, -3.4]} receiveShadow>
          <planeGeometry args={[24, 8]} />
          <meshStandardMaterial map={wallTex} roughness={0.95} />
        </mesh>
        {/* left wall — four segments leaving a REAL opening for the window */}
        {[
          [[-4.5, 3, -3.28], [0.12, 8, 5.45]],
          [[-4.5, 3, 5.78], [0.12, 8, 8.45]],
          [[-4.5, 0, 0.5], [0.12, 2.0, 2.1]],
          [[-4.5, 5.3, 0.5], [0.12, 3.4, 2.1]],
        ].map(([p, s], i) => (
          <mesh key={i} position={p} receiveShadow>
            <boxGeometry args={s} />
            <meshStandardMaterial map={wallTex} roughness={0.95} />
          </mesh>
        ))}
        {/* just outside the window: real grass and trees, not a painted board */}
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7, -0.01, 0.5]} receiveShadow>
            <planeGeometry args={[5.5, 8]} />
            <meshStandardMaterial color="#26331f" roughness={0.9} />
          </mesh>
          <Tree position={[-6.2, 0, 0.2]} s={1.4} leaf="#2a3d2c" />
          <Tree position={[-7.6, 0, 2.2]} s={1.1} leaf="#243626" />
          <Pine position={[-6.9, 0, -1.6]} s={1.2} leaf="#22382a" />
          {/* moonlight bathes the garden so the night view isn't a void */}
          {night && (
            <pointLight position={[-6.3, 3.2, 0.5]} intensity={18} color="#8ea2c9" distance={12} decay={2} />
          )}
          {night && !rain && (
            <mesh position={[-19, 7.5, 1.5]}>
              <sphereGeometry args={[0.9, 20, 20]} />
              <meshBasicMaterial color="#cdd8ee" fog={false} />
            </mesh>
          )}
        </group>
        {rain && <RainFall x={[-10, -4.6]} z={[-2.5, 4]} count={260} />}
        <mesh position={[4.5, 3, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[16, 8]} />
          <meshStandardMaterial map={wallTex} roughness={0.95} />
        </mesh>
        <Wood position={[4.46, 0.12, 2]} size={[0.06, 0.24, 16]} color="#ddd5c6" />
        {/* bright ceiling with pale scandi beams */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.12, 1]}>
          <planeGeometry args={[9.1, 9]} />
          <meshStandardMaterial color="#efe9dd" roughness={0.95} />
        </mesh>
        {[-1.6, 1, 3.6].map((z) => (
          <Wood key={z} position={[0, 4.0, z]} size={[9.1, 0.18, 0.24]} color="#cbb694" />
        ))}
        {/* pitched shingle roof + chimney — the descent's hero shot */}
        <mesh position={[0, 5.55, -1.2]} rotation={[-0.42, 0, 0]} castShadow>
          <boxGeometry args={[10.4, 0.14, 5.6]} />
          <meshStandardMaterial map={shingleTex} roughness={0.85} />
        </mesh>
        <mesh position={[0, 5.55, 3.2]} rotation={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[10.4, 0.14, 5.6]} />
          <meshStandardMaterial map={shingleTex} roughness={0.85} />
        </mesh>
        {/* ridge cap + fascia trim */}
        <mesh position={[0, 6.7, 1]}>
          <boxGeometry args={[10.5, 0.16, 0.4]} />
          <meshStandardMaterial color="#14100a" roughness={0.85} />
        </mesh>
        <Wood position={[0, 4.42, 5.42]} size={[10.5, 0.16, 0.1]} color="#ddd5c6" />
        <Wood position={[0, 4.42, -3.82]} size={[10.5, 0.16, 0.1]} color="#ddd5c6" />
        {/* weathervane on the ridge */}
        <group position={[0, 6.78, 1]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.018, 0.024, 0.6, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.56, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.045, 0.2, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[-0.12, 0.56, 0]}>
            <boxGeometry args={[0.16, 0.09, 0.014]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.42, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.3, 0.02, 0.02]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
        {/* a chimney you can actually see */}
        <group position={[3.1, 6.8, 0.6]}>
          <mesh castShadow>
            <boxGeometry args={[0.85, 2.3, 0.85]} />
            <meshStandardMaterial map={roofBrickTex} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[1.05, 0.14, 1.05]} />
            <meshStandardMaterial color="#38352f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.29, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.6]} />
            <meshStandardMaterial color="#0c0805" roughness={1} />
          </mesh>
        </group>
        <ChimneySmoke position={[3.1, 8.05, 0.6]} />
        <RoofStairs />
        {/* fairy lights strung along the front eave */}
        <group position={[0, 4.36, 5.5]}>
          <FairyLights width={9.6} y={0} />
        </group>
        {/* golden motes drifting around the rooftop */}
        <Sparkles count={40} scale={[11, 3.5, 9]} size={2.6} speed={0.22} opacity={0.4} color="#ffd9a0" position={[0.5, 8, 1]} />
        {/* baseboards */}
        <Wood position={[0, 0.12, -3.36]} size={[24, 0.24, 0.06]} color="#ddd5c6" />
        <Wood position={[-4.46, 0.12, 2]} size={[0.06, 0.24, 16]} color="#ddd5c6" />
        {/* picture rail line on the back wall */}
        <Wood position={[0, 4.1, -3.37]} size={[24, 0.07, 0.05]} color="#ddd5c6" />

        {rain && <Storm />}
        <Bookshelf wood={shelfTex} />
        <Desk wood={deskTex} />
        <Rug />
        <Puppy />
        <Fireplace position={[4.35, 0, 1.5]} />
        {/* hearth rug */}
        <group position={[3.2, 0, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[1.6, 1.1]} />
            <meshStandardMaterial color="#c2704e" roughness={1} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[1.48, 0.98]} />
            <meshStandardMaterial color="#efe6d8" roughness={1} />
          </mesh>
        </group>
        <Sofa position={[-0.9, 0, 2.4]} rotation={Math.PI / 2} />
        <FloorLamp position={[-2.6, 0, 3.2]} on={lightsOn} />
        <Plant position={[-3.9, 0, -2.7]} />
        <Pampas position={[3.9, 0, 3.6]} />
        <NeonSign position={[-3.5, 3.1, -3.35]} />
        <ArchMirror position={[-4.1, 0, 1.9]} rotation={Math.PI / 2 - 0.15} />
        <Window position={[-4.45, 2.3, 0.5]} rain={rain} />
        <Painting position={[2.1, 2.55, -3.36]} />
        <Candle position={[2.45, 1.09, -0.6]} interactive />
        {/* these three live where the book lands — they step aside while reading */}
        {!reading && <BookStack position={[1.05, 1.09, -0.55]} />}
        {!reading && <Spectacles position={[2.0, 1.1, 0.05]} />}
        {/* Ramsha's desk: half-drunk coffee, sketched side-projects, music */}
        <Mug position={[1.45, 1.09, -0.72]} />
        {!reading && <OpenNotebook position={[1.75, 1.09, 0.02]} rotation={-0.25} />}
        <Headphones position={[2.62, 1.1, 0.12]} rotation={0.5} />
        {/* sticky notes on the wall by the frames */}
        <StickyNote position={[2.72, 1.72, -3.37]} rotation={-0.06} color="#f5d76e" text={'ship\nit ✦'} />
        <StickyNote position={[2.92, 1.62, -3.37]} rotation={0.08} color="#a8d8b9" text={'v2\nideas'} />
        <StickyNote position={[2.8, 1.44, -3.37]} rotation={-0.1} color="#f0a8a8" text={'water\nplants!'} />
        <BookStack position={[-2.9, 0, -1.4]} />
        <Sparkles count={90} scale={[7, 4, 5]} size={2} speed={0.2} opacity={0.35} color="#e8a54b" position={[0, 2, -0.5]} />

        <ArrivalCamera active={stage === 'arrival'} onLand={() => setStage('waiting')} />
        {(stage === 'gate' || stage === 'arrival') && <ArrivalClouds />}
        <FrontDoorway
          doorRef={doorRef}
          sidingTex={sidingTex}
          doorTex={doorTex}
          onBell={() => beginEntry('bell')}
          onKnock={() => beginEntry('knock')}
          onDoor={() => {
            if (stage === 'waiting') beginEntry('door')
            else if (stage === 'done') {
              creakSound()
              setDoorShut((s) => !s)
            }
          }}
        />
        <DoorAnimator doorRef={doorRef} active={stage === 'done'} shut={doorShut} />
        <EntryCamera
          stage={stage}
          doorRef={doorRef}
          onArrived={() => {
            hasEnteredHouse = true
            setStage('done')
          }}
        />
        <MemeFrame position={[3.35, 2.1, -3.36]} />
        {/* the music inspiration wall — click a cover to play its 30s preview */}
        <InspoWall position={[4.46, 2.15, 3.4]} rotation={-Math.PI / 2} />
        <SkyDome weather={weather} />
        <CloudField night={night} rain={rain} />
        <FrontYard night={night} rain={rain} />
        <DistantScenery night={night} rain={rain} />
        <WalkControls enabled={stage === 'waiting'} />

        <PortfolioBook onOpen={() => setReading(true)} controlsRef={controlsRef} reading={reading} />
        {reading && <OpenBook3D />}
        <ReadCamera active={reading} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enabled={stage === 'done' && !reading}
          enablePan={false}
          minDistance={1.2}
          maxDistance={6.5}
          maxPolarAngle={Math.PI / 2 - 0.06}
          target={[0, 1.4, -1]}
        />
        {/* the pretty switch: real glow on every light source + cinematic edges */}
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.72} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.22} darkness={0.72} />
        </EffectComposer>
        <ClampCamera enabled={stage === 'done' && !reading} />
        <KeyPan controlsRef={controlsRef} enabled={stage === 'done' && !reading} />
        {stage === 'done' &&
          !musicPlaying &&
          !reading &&
          (tourOpen || guides) &&
          HOTSPOTS.map((h) => <Hotspot key={h.l} position={h.p} label={h.l} />)}
      </Canvas>
      <div className="weather-toggle">
        <button className={night ? 'on' : ''} onClick={() => setWeather('night')}>🌙 night</button>
        <button className={!night ? 'on' : ''} onClick={() => setWeather('morning')}>🌅 morning</button>
        <span className="weather-toggle__sep" />
        <button className={rain ? 'on' : ''} onClick={() => setRain(true)}>🌧 rain</button>
        <button className={!rain ? 'on' : ''} onClick={() => setRain(false)}>✦ clear</button>
        <span className="weather-toggle__sep" />
        <button className={lightsOn ? 'on' : ''} onClick={() => setLightsOn(true)}>💡 lights</button>
        <button className={!lightsOn ? 'on' : ''} onClick={() => setLightsOn(false)}>🌘 dim</button>
        <span className="weather-toggle__sep" />
        <button className={guides ? 'on' : ''} onClick={() => setGuides((g) => !g)}>🧭 guides</button>
      </div>
      {stage === 'done' && !reading && (
        <div className="zoom-ctrl">
          <button onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
        </div>
      )}
      {reading && showPages && <BookOverlay onClose={() => setReading(false)} />}
      {(stage === 'gate' || stage === 'arrival') && (
        <div key={stage} className={`cloud-veil${stage === 'gate' ? ' cloud-veil--hold' : ''}`} />
      )}
      {stage === 'gate' && (
        <div className="gate">
          <div className="gate__card">
            <div className="gate__top">a rainy-night portfolio</div>
            <h1>№ 41, Alcove Lane</h1>
            <p>Ramsha Iqbal · frontend developer · keeper of one very cozy reading room</p>
            <button className="gate__btn" onClick={beginJourney}>☂ begin the journey</button>
            <span className="gate__hint">headphones recommended</span>
          </div>
        </div>
      )}
      {stage === 'arrival' && (
        <div className="arrival-caption">
          <span>somewhere above the storm, a warm light shows through the clouds…</span>
        </div>
      )}
      {stage === 'waiting' && <StoryLines />}
      {stage === 'done' && tourOpen && !musicPlaying && !reading && (
        <div className="tour">
          <div className="tour__label">✦ your guide</div>
          <p>{TOUR[tourStep]}</p>
          <div className="tour__row">
            <button className="tour__skip" onClick={endTour}>skip tour</button>
            <span className="tour__count">{tourStep + 1} / {TOUR.length}</span>
            <button
              className="tour__next"
              onClick={() => (tourStep >= TOUR.length - 1 ? endTour() : setTourStep(tourStep + 1))}
            >
              {tourStep >= TOUR.length - 1 ? 'finish' : 'next →'}
            </button>
          </div>
        </div>
      )}
      {stage === 'done' && !tourOpen && !reading && (
        <div className="room-hint">everything with a pointer cursor is clickable — enjoy the rain</div>
      )}
    </div>
  )
}
