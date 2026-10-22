// All sound is synthesized WebAudio — filtered noise, no audio files.
let ctx

function ac() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(c, dur) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function playNoise({ dur, type, from, to, vol, attack = 0 }) {
  try {
    const c = ac()
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur)
    const filt = c.createBiquadFilter()
    filt.type = type
    filt.Q.value = 1
    filt.frequency.setValueAtTime(from, c.currentTime)
    filt.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur)
    const g = c.createGain()
    if (attack > 0) {
      g.gain.setValueAtTime(0.001, c.currentTime)
      g.gain.exponentialRampToValueAtTime(vol, c.currentTime + attack)
    } else {
      g.gain.setValueAtTime(vol, c.currentTime)
    }
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
    src.connect(filt)
    filt.connect(g)
    g.connect(c.destination)
    src.start()
  } catch {
    /* no audio available — stay silent */
  }
}

// soft breathy puff — lowpass noise swelling in, like an actual breath
export const whooshSound = () =>
  playNoise({ dur: 0.9, type: 'lowpass', from: 700, to: 250, vol: 0.35, attack: 0.08 })

export const strikeSound = () =>
  playNoise({ dur: 0.3, type: 'highpass', from: 1200, to: 2600, vol: 0.35 })

// long low rumble, slow attack — distant thunder
export const thunderSound = () =>
  playNoise({ dur: 3.2, type: 'lowpass', from: 220, to: 55, vol: 0.5, attack: 0.25 })

// old hinge complaining
export const creakSound = () =>
  playNoise({ dur: 0.35, type: 'bandpass', from: 400, to: 150, vol: 0.12 })

function playTone(freq, dur, delay = 0, vol = 0.15) {
  try {
    const c = ac()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const g = c.createGain()
    const t0 = c.currentTime + delay
    g.gain.setValueAtTime(0.001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  } catch {
    /* silent */
  }
}

// classic two-tone "ding-dong"
export const doorbellSound = () => {
  playTone(659, 0.9, 0, 0.18)
  playTone(523, 1.3, 0.35, 0.18)
}

// two knuckle thumps on oak
export const knockSound = () => {
  playNoise({ dur: 0.08, type: 'lowpass', from: 150, to: 90, vol: 0.5 })
  setTimeout(() => playNoise({ dur: 0.08, type: 'lowpass', from: 150, to: 90, vol: 0.45 }), 220)
}

// ---- nature ambience ------------------------------------------------------

// cricket: a fast train of tiny high pulses
function cricketChirp() {
  try {
    const c = ac()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 4100 + Math.random() * 400
    const g = c.createGain()
    g.gain.value = 0
    const pan = c.createStereoPanner()
    pan.pan.value = Math.random() * 1.4 - 0.7
    o.connect(g).connect(pan).connect(c.destination)
    const t0 = c.currentTime
    const pulses = 6 + Math.floor(Math.random() * 5)
    for (let i = 0; i < pulses; i++) {
      const t = t0 + i * 0.042
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.038)
    }
    o.start(t0)
    o.stop(t0 + pulses * 0.042 + 0.1)
  } catch {
    /* silent */
  }
}

// owl: two soft downward-gliding hoots, low-passed to sound far away
function owlHoot() {
  try {
    const c = ac()
    const note = (t, f1, f2, d, v) => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(f1, t)
      o.frequency.exponentialRampToValueAtTime(f2, t + d)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(v, t + 0.06)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600
      o.connect(g).connect(lp).connect(c.destination)
      o.start(t)
      o.stop(t + d + 0.05)
    }
    const t0 = c.currentTime
    note(t0, 340, 300, 0.35, 0.08)
    note(t0 + 0.55, 330, 280, 0.6, 0.09)
  } catch {
    /* silent */
  }
}

// distant songbird: a few quick up-down sweeps, randomly pitched and panned
function birdChirp() {
  try {
    const c = ac()
    const t0 = c.currentTime
    const n = 2 + Math.floor(Math.random() * 3)
    const base = 2300 + Math.random() * 1200
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.12 + Math.random() * 0.06)
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(base, t)
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.2), t + 0.05)
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.11)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      const pan = c.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8
      o.connect(g).connect(pan).connect(c.destination)
      o.start(t)
      o.stop(t + 0.15)
    }
  } catch {
    /* silent */
  }
}

// a real page turn: paper sliding, the flick as it passes vertical,
// then the soft settle onto the stack
export const pageSound = () => {
  try {
    const c = ac()
    const part = (t0, dur, type, from, to, vol) => {
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, dur)
      const f = c.createBiquadFilter()
      f.type = type
      f.Q.value = 1
      f.frequency.setValueAtTime(from, t0)
      f.frequency.exponentialRampToValueAtTime(to, t0 + dur)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.25)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      src.connect(f)
      f.connect(g)
      g.connect(c.destination)
      src.start(t0)
    }
    const t = c.currentTime
    part(t, 0.22, 'bandpass', 900, 1600, 0.07) // sliding across the stack
    part(t + 0.16, 0.07, 'highpass', 2200, 3800, 0.16) // the flick
    part(t + 0.3, 0.09, 'lowpass', 500, 220, 0.09) // settling down
  } catch {
    /* silent */
  }
}

// quiet swish of a tossed ball
export const tossSound = () =>
  playNoise({ dur: 0.25, type: 'highpass', from: 600, to: 1800, vol: 0.08 })

// a single fire pop — schedule these at random for a crackling hearth
export const crackleSound = () =>
  playNoise({ dur: 0.05, type: 'bandpass', from: 500 + Math.random() * 900, to: 250, vol: 0.05 })

// puppy "arf": pitch swoops up then down through a mouth-formant bandpass,
// with a tiny breathy transient at the front — much rounder than a raw synth
export const barkSound = () => {
  try {
    const c = ac()
    const yip = (t0) => {
      const vary = 0.85 + Math.random() * 0.3
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(380 * vary, t0)
      o.frequency.exponentialRampToValueAtTime(720 * vary, t0 + 0.035)
      o.frequency.exponentialRampToValueAtTime(240 * vary, t0 + 0.13)
      const formant = c.createBiquadFilter()
      formant.type = 'bandpass'
      formant.frequency.value = 1100 * vary
      formant.Q.value = 1.6
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)
      o.connect(formant).connect(g).connect(c.destination)
      o.start(t0)
      o.stop(t0 + 0.16)
      // breath transient
      const n = c.createBufferSource()
      n.buffer = noiseBuffer(c, 0.04)
      const nf = c.createBiquadFilter()
      nf.type = 'highpass'
      nf.frequency.value = 1800
      const ng = c.createGain()
      ng.gain.setValueAtTime(0.05, t0)
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04)
      n.connect(nf).connect(ng).connect(c.destination)
      n.start(t0)
    }
    yip(c.currentTime)
    if (Math.random() > 0.4) yip(c.currentTime + 0.16 + Math.random() * 0.08)
  } catch {
    /* silent */
  }
}

// soft questioning whimper — for when the puppy gets petted
export const whimperSound = () => {
  try {
    const c = ac()
    const t0 = c.currentTime
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(520, t0)
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.22)
    o.frequency.exponentialRampToValueAtTime(660, t0 + 0.42)
    // gentle vibrato
    const vib = c.createOscillator()
    vib.frequency.value = 7
    const vibGain = c.createGain()
    vibGain.gain.value = 18
    vib.connect(vibGain).connect(o.frequency)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2200
    o.connect(lp).connect(g).connect(c.destination)
    o.start(t0)
    o.stop(t0 + 0.5)
    vib.start(t0)
    vib.stop(t0 + 0.5)
  } catch {
    /* silent */
  }
}

let nature
export function startNature(mode) {
  stopNature()
  const timers = []
  const schedule = (fn, min, max) => {
    const loop = () => {
      fn()
      timers.push(setTimeout(loop, min + Math.random() * (max - min)))
    }
    timers.push(setTimeout(loop, 500 + Math.random() * 1500))
  }
  if (mode === 'night') {
    schedule(cricketChirp, 700, 2200)
    schedule(cricketChirp, 900, 2600) // a second cricket on its own cadence
    schedule(owlHoot, 20000, 45000)
  } else {
    schedule(birdChirp, 1500, 5000)
    schedule(birdChirp, 2500, 7000)
  }
  nature = { stop: () => timers.forEach(clearTimeout) }
}

export function stopNature() {
  nature?.stop()
  nature = null
}

// Realistic rain = layered, not one hiss:
//   1. a deep rumble floor (storm pressure)
//   2. a low "wash" (rain on the roof), swelling with slow gusts
//   3. a quiet high "sheen" (the patter texture)
//   4. individual droplets — random resonant ticks, panned across stereo
// Everything routes through a master lowpass — the closed window. Opening it
// lifts the filter and the level, like actually cracking a window in a storm.
let rain
let rainWindowOpen = false

export function setRainWindowOpen(open) {
  rainWindowOpen = open
  if (!rain) return
  const c = ac()
  rain.master.frequency.setTargetAtTime(open ? 9000 : 750, c.currentTime, 0.25)
  rain.level.gain.setTargetAtTime(open ? 1.3 : 0.75, c.currentTime, 0.25)
}

export function startRain() {
  try {
    const c = ac() // always touch the context first — this is what resumes
    if (rain) return // audio after the user's first gesture
    const out = c.createGain()
    out.gain.value = 0
    out.gain.setTargetAtTime(1, c.currentTime, 2) // fade the whole storm in
    out.connect(c.destination)

    // the closed-window muffle
    const master = c.createBiquadFilter()
    master.type = 'lowpass'
    master.frequency.value = rainWindowOpen ? 9000 : 750
    const level = c.createGain()
    level.gain.value = rainWindowOpen ? 1.3 : 0.75
    master.connect(level)
    level.connect(out)

    const rumble = c.createBufferSource()
    rumble.buffer = noiseBuffer(c, 4)
    rumble.loop = true
    const rumbleLp = c.createBiquadFilter()
    rumbleLp.type = 'lowpass'
    rumbleLp.frequency.value = 240
    const rumbleGain = c.createGain()
    rumbleGain.gain.value = 0.035
    rumble.connect(rumbleLp).connect(rumbleGain).connect(master)
    rumble.start()

    const bed = c.createBufferSource()
    bed.buffer = noiseBuffer(c, 4)
    bed.loop = true
    const bedLp = c.createBiquadFilter()
    bedLp.type = 'lowpass'
    bedLp.frequency.value = 600
    const bedGain = c.createGain()
    bedGain.gain.value = 0.05
    bed.connect(bedLp).connect(bedGain).connect(out)
    bed.start()

    const sheen = c.createBufferSource()
    sheen.buffer = noiseBuffer(c, 4)
    sheen.loop = true
    const sheenBp = c.createBiquadFilter()
    sheenBp.type = 'bandpass'
    sheenBp.frequency.value = 2800
    sheenBp.Q.value = 0.6
    const sheenGain = c.createGain()
    sheenGain.gain.value = 0.018
    sheen.connect(sheenBp).connect(sheenGain).connect(out)
    sheen.start()

    // slow gusts — LFO breathing the wash up and down
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.018
    lfo.connect(lfoGain).connect(bedGain.gain)
    lfo.start()

    let dropTimer
    function drop() {
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, 0.03)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 2000 + Math.random() * 5000
      bp.Q.value = 6
      const g = c.createGain()
      g.gain.setValueAtTime(0.015 + Math.random() * 0.04, c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.03)
      const pan = c.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8
      src.connect(bp).connect(g).connect(pan).connect(out)
      src.start()
      dropTimer = setTimeout(drop, 30 + Math.random() * 120)
    }
    drop()

    rain = {
      master,
      level,
      stop() {
        clearTimeout(dropTimer)
        out.gain.setTargetAtTime(0, c.currentTime, 0.4)
        setTimeout(() => {
          bed.stop()
          sheen.stop()
          rumble.stop()
          lfo.stop()
        }, 1500)
      },
    }
  } catch {
    /* silent */
  }
}

export function stopRain() {
  try {
    rain?.stop()
  } catch {
    /* silent */
  } finally {
    rain = null
  }
}
