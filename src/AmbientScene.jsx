import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { AdditiveBlending, CanvasTexture } from 'three'

// Eases the camera toward the cursor. Listens on window because the
// canvas itself is pointer-events: none (clicks must reach the book).
function ParallaxRig() {
  const target = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function onMove(e) {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1
      target.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(({ camera }) => {
    camera.position.x += (target.current.x * 0.6 - camera.position.x) * 0.04
    camera.position.y += (target.current.y * 0.3 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })

  return null
}

import { whooshSound, strikeSound } from './audio.js'

const BRASS = { color: '#9a7b3f', metalness: 0.85, roughness: 0.3 }

export function Candle({ position, interactive = false }) {
  const flame = useRef()
  const glow = useRef()
  const light = useRef()
  const smoke = useRef()
  const match = useRef()
  const matchFlame = useRef()
  const mode = useRef('lit') // lit | blowing | out | striking
  const phase = useRef(0)
  const smokeT = useRef(0)
  const flameScale = useRef(1)

  // soft radial halo around the flame, drawn once
  const glowTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,190,90,0.9)')
    grad.addColorStop(0.35, 'rgba(255,150,50,0.28)')
    grad.addColorStop(1, 'rgba(255,120,30,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new CanvasTexture(c)
  }, [])

  const smokeTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(180,175,168,0.55)')
    grad.addColorStop(1, 'rgba(180,175,168,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new CanvasTexture(c)
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    // two out-of-phase sines ≈ candle flicker without looking periodic
    const f = 1 + Math.sin(t * 8.3) * 0.12 + Math.sin(t * 13.7) * 0.08

    if (mode.current === 'blowing') {
      phase.current += delta * 2.2
      flameScale.current = Math.max(0, 1 - phase.current)
      if (flame.current) flame.current.rotation.z = phase.current * 0.9 // flame bends away from the breath
      if (phase.current >= 1) {
        mode.current = 'out'
        phase.current = 0
        if (flame.current) flame.current.rotation.z = 0
      }
    } else if (mode.current === 'striking') {
      phase.current += delta / 1.4
      const p = phase.current
      const m = match.current
      if (m) {
        m.visible = true
        if (p < 0.45) {
          const k = p / 0.45
          m.position.set(0.7 - k * 0.62, 1.25 - k * 0.12, 0.3 - k * 0.28)
        } else if (p < 0.75) {
          m.position.set(0.08, 1.13, 0.02)
        } else {
          const k = (p - 0.75) / 0.25
          m.position.set(0.08 + k * 0.62, 1.13 + k * 0.15, 0.02 + k * 0.3)
        }
      }
      if (matchFlame.current) {
        matchFlame.current.visible = p > 0.12 && p < 0.8
        const s = 0.8 + Math.sin(t * 30) * 0.25
        matchFlame.current.scale.set(s, s, s)
      }
      if (p > 0.45) flameScale.current = Math.min(1, (p - 0.45) / 0.25)
      if (p >= 1) {
        mode.current = 'lit'
        phase.current = 0
        if (m) m.visible = false
      }
    }

    const fs = flameScale.current
    if (light.current) {
      light.current.intensity = 12 * f * fs
      // brief flare as the match catches the wick
      if (mode.current === 'striking' && phase.current > 0.42 && phase.current < 0.55) {
        light.current.intensity = 22
      }
      light.current.position.x = Math.sin(t * 6.1) * 0.02
    }
    if (flame.current) {
      flame.current.visible = fs > 0.02
      flame.current.scale.set((0.9 + f * 0.12) * fs, (0.85 + f * 0.25) * fs, (0.9 + f * 0.12) * fs)
      flame.current.rotation.y = t * 0.6
    }
    if (glow.current) glow.current.material.opacity = (0.55 + (f - 1) * 1.4) * fs

    // smoke wisps rise for a couple of seconds after blow-out
    if (smoke.current) {
      const st = smokeT.current
      smoke.current.children.forEach((s, i) => {
        if (st > 0 && mode.current === 'out') {
          s.visible = true
          const rise = 1 - st
          s.position.y = 1.15 + rise * (0.55 + i * 0.22)
          s.position.x = Math.sin(rise * 5 + i * 2.1) * 0.06
          s.material.opacity = 0.3 * st
          const sc = 0.18 + rise * 0.35
          s.scale.set(sc, sc, 1)
        } else {
          s.visible = false
        }
      })
      if (st > 0) smokeT.current -= delta * 0.4
    }
  })

  function handleClick(e) {
    if (!interactive) return
    e.stopPropagation()
    if (mode.current === 'lit') {
      mode.current = 'blowing'
      phase.current = 0
      smokeT.current = 1
      whooshSound()
    } else if (mode.current === 'out') {
      mode.current = 'striking'
      phase.current = 0
      strikeSound()
    }
  }

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (!interactive) return
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (interactive) document.body.style.cursor = 'default'
      }}
    >
      {/* brass candlestick: base dish, stem, drip pan, carry ring */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.05, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.14, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.19, 0.08, 0.05, 20]} />
        <meshStandardMaterial {...BRASS} roughness={0.35} />
      </mesh>
      <mesh position={[0.3, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.02, 10, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* tapered wax, faint inner warmth like real candlelight through wax */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 0.85, 20]} />
        <meshStandardMaterial color="#efe3c4" roughness={0.5} emissive="#c98d3e" emissiveIntensity={0.06} />
      </mesh>
      {/* wax drips down the side */}
      <mesh position={[0.12, 0.85, 0.04]} scale={[0.5, 1.6, 0.5]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#f2e7cb" roughness={0.45} />
      </mesh>
      <mesh position={[-0.1, 0.78, -0.06]} scale={[0.5, 2.2, 0.5]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#eaddbd" roughness={0.45} />
      </mesh>
      {/* wick */}
      <mesh position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 6]} />
        <meshStandardMaterial color="#241708" />
      </mesh>
      {/* flame: bright core inside a warm translucent outer cone */}
      <group ref={flame} position={[0, 1.18, 0]}>
        <mesh>
          <coneGeometry args={[0.055, 0.24, 10]} />
          <meshBasicMaterial color="#ffae42" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, -0.04, 0]} scale={[0.5, 0.55, 0.5]}>
          <coneGeometry args={[0.055, 0.24, 10]} />
          <meshBasicMaterial color="#fff4cf" />
        </mesh>
      </group>
      <sprite ref={glow} position={[0, 1.2, 0]} scale={[1.5, 1.5, 1]}>
        <spriteMaterial map={glowTex} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      {/* smoke wisps, shown only after blow-out */}
      <group ref={smoke}>
        {[0, 1, 2, 3].map((i) => (
          <sprite key={i} visible={false} position={[0, 1.15, 0]} scale={[0.2, 0.2, 1]}>
            <spriteMaterial map={smokeTex} transparent opacity={0} depthWrite={false} />
          </sprite>
        ))}
      </group>
      {/* matchstick, animated in during relight */}
      <group ref={match} visible={false} rotation={[0, 0, -0.55]}>
        <mesh>
          <boxGeometry args={[0.5, 0.025, 0.025]} />
          <meshStandardMaterial color="#d9c9a3" roughness={0.8} />
        </mesh>
        <mesh position={[-0.25, 0, 0]}>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial color="#8a2e1f" roughness={0.6} />
        </mesh>
        <mesh ref={matchFlame} visible={false} position={[-0.27, 0.05, 0]}>
          <coneGeometry args={[0.035, 0.12, 8]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
      </group>
      <pointLight
        ref={light}
        castShadow
        position={[0, 1.28, 0.15]}
        color="#e8a54b"
        distance={8}
        decay={2}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.004}
      />
    </group>
  )
}

export function BookStack({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} rotation={[0, 0.18, 0]}>
        <boxGeometry args={[1.1, 0.13, 0.75]} />
        <meshStandardMaterial color="#1f3527" roughness={0.85} />
      </mesh>
      <mesh position={[0.06, 0.2, 0.02]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[1.0, 0.11, 0.7]} />
        <meshStandardMaterial color="#4f1c24" roughness={0.85} />
      </mesh>
    </group>
  )
}

// Remounts a short-lived dust burst each time the book flips a page.
function FlipBurst() {
  const [burstId, setBurstId] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    function onFlip() {
      setBurstId((id) => id + 1)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setBurstId(0), 1000)
    }
    window.addEventListener('bookflip', onFlip)
    return () => {
      window.removeEventListener('bookflip', onFlip)
      clearTimeout(timer.current)
    }
  }, [])

  if (!burstId) return null
  return (
    <Sparkles
      key={burstId}
      count={30}
      scale={[5, 2.5, 2]}
      size={4}
      speed={1.3}
      opacity={0.5}
      color="#f5e3a8"
      position={[0, -0.8, 0.6]}
    />
  )
}

export default function AmbientScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ alpha: true, antialias: false }}
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      {/* fine dust drifting through the whole scene */}
      <Sparkles
        count={130}
        scale={[9, 5.5, 3]}
        size={2.2}
        speed={0.25}
        opacity={0.45}
        color="#e8a54b"
        position={[0, 0.4, 0]}
      />
      {/* fewer, larger motes concentrated in the "lamplight" above the book */}
      <Sparkles
        count={35}
        scale={[4, 3, 2]}
        size={5}
        speed={0.14}
        opacity={0.3}
        color="#f5e3a8"
        position={[0, 1.4, 0.5]}
      />
      <ambientLight intensity={0.25} />
      <Candle position={[-3.4, -1.7, 0]} />
      <BookStack position={[3.3, -2.1, 0]} />
      <FlipBurst />
      <ParallaxRig />
    </Canvas>
  )
}
