// Premium procedural UI sound engine
// Layered synthesis for slick, aesthetic interaction feedback

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function gain(audio: AudioContext, vol: number): GainNode {
  const g = audio.createGain()
  g.gain.value = vol
  g.connect(audio.destination)
  return g
}

function filter(audio: AudioContext, type: BiquadFilterType, freq: number): BiquadFilterNode {
  const f = audio.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  return f
}

/** Soft, glassy click — layered sine + noise burst for premium feel */
export function playClick() {
  const a = getCtx()
  const t = a.currentTime

  // Tonal layer — soft glass tap
  const osc = a.createOscillator()
  const g1 = gain(a, 0)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1800, t)
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.04)
  g1.gain.setValueAtTime(0, t)
  g1.gain.linearRampToValueAtTime(0.06, t + 0.002)
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  osc.connect(g1)
  osc.start(t)
  osc.stop(t + 0.06)

  // Harmonic shimmer layer
  const osc2 = a.createOscillator()
  const g2 = gain(a, 0)
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(2400, t)
  osc2.frequency.exponentialRampToValueAtTime(1600, t + 0.03)
  g2.gain.linearRampToValueAtTime(0.025, t + 0.001)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
  osc2.connect(g2)
  osc2.start(t)
  osc2.stop(t + 0.04)

  // Tiny filtered noise transient for "texture"
  const buf = a.createBuffer(1, a.sampleRate * 0.02, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5
  const noise = a.createBufferSource()
  noise.buffer = buf
  const nf = filter(a, 'bandpass', 3000)
  nf.Q.value = 2
  const ng = gain(a, 0)
  ng.gain.linearRampToValueAtTime(0.03, t + 0.001)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02)
  noise.connect(nf)
  nf.connect(ng)
  noise.start(t)
  noise.stop(t + 0.025)
}

/** Toggle on — crisp, satisfying snap with harmonic ring */
export function playTick() {
  const a = getCtx()
  const t = a.currentTime

  // Primary snap
  const osc = a.createOscillator()
  const g = gain(a, 0)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(2200, t)
  osc.frequency.exponentialRampToValueAtTime(1100, t + 0.025)
  g.gain.linearRampToValueAtTime(0.09, t + 0.001)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + 0.07)

  // Subtle resonant ping
  const osc2 = a.createOscillator()
  const g2 = gain(a, 0)
  const f = filter(a, 'bandpass', 4000)
  f.Q.value = 8
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(3200, t)
  g2.gain.linearRampToValueAtTime(0.02, t + 0.002)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  osc2.connect(f)
  f.connect(g2)
  osc2.start(t)
  osc2.stop(t + 0.09)
}

/** Task complete — shimmering ascending chord with sparkle */
export function playCelebrate() {
  const a = getCtx()
  const t = a.currentTime

  // Warm chord: C5, E5, G5 with slight detuning for richness
  const notes = [
    { freq: 523, detune: 3, delay: 0 },
    { freq: 659, detune: -2, delay: 0.06 },
    { freq: 784, detune: 4, delay: 0.12 },
    { freq: 1047, detune: -3, delay: 0.16 },  // octave C6 for sparkle
  ]

  notes.forEach(({ freq, detune, delay }) => {
    const osc = a.createOscillator()
    const g = gain(a, 0)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t + delay)
    osc.detune.value = detune
    g.gain.setValueAtTime(0, t + delay)
    g.gain.linearRampToValueAtTime(0.045, t + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25)
    osc.connect(g)
    osc.start(t + delay)
    osc.stop(t + delay + 0.28)
  })

  // Shimmer noise layer
  const buf = a.createBuffer(1, a.sampleRate * 0.15, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
  const noise = a.createBufferSource()
  noise.buffer = buf
  const nf = filter(a, 'highpass', 6000)
  const ng = gain(a, 0)
  ng.gain.setValueAtTime(0, t + 0.05)
  ng.gain.linearRampToValueAtTime(0.015, t + 0.08)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  noise.connect(nf)
  nf.connect(ng)
  noise.start(t + 0.05)
  noise.stop(t + 0.3)
}

/** Tab switch — smooth, breathy glide with stereo movement */
export function playTabSwitch() {
  const a = getCtx()
  const t = a.currentTime

  // Filtered sweep — airy whoosh
  const osc = a.createOscillator()
  const lp = filter(a, 'lowpass', 200)
  lp.Q.value = 3
  lp.frequency.setValueAtTime(200, t)
  lp.frequency.exponentialRampToValueAtTime(3000, t + 0.04)
  lp.frequency.exponentialRampToValueAtTime(600, t + 0.12)
  const g = gain(a, 0)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, t)
  osc.frequency.exponentialRampToValueAtTime(260, t + 0.08)
  g.gain.linearRampToValueAtTime(0.03, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.connect(lp)
  lp.connect(g)
  osc.start(t)
  osc.stop(t + 0.14)

  // Tonal accent — soft chime
  const chime = a.createOscillator()
  const cg = gain(a, 0)
  chime.type = 'sine'
  chime.frequency.setValueAtTime(1400, t + 0.01)
  chime.frequency.exponentialRampToValueAtTime(1100, t + 0.06)
  cg.gain.linearRampToValueAtTime(0.025, t + 0.015)
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  chime.connect(cg)
  chime.start(t + 0.01)
  chime.stop(t + 0.12)
}

/** Modal open — warm rising bloom with reverb-like tail */
export function playModalOpen() {
  const a = getCtx()
  const t = a.currentTime

  // Primary rising tone
  const osc = a.createOscillator()
  const g = gain(a, 0)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, t)
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.12)
  g.gain.linearRampToValueAtTime(0.05, t + 0.02)
  g.gain.setValueAtTime(0.05, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + 0.28)

  // Harmonic overtone for warmth
  const osc2 = a.createOscillator()
  const g2 = gain(a, 0)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(660, t)
  osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.14)
  g2.gain.linearRampToValueAtTime(0.02, t + 0.03)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  osc2.connect(g2)
  osc2.start(t)
  osc2.stop(t + 0.22)

  // Soft air burst
  const buf = a.createBuffer(1, a.sampleRate * 0.08, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
  const noise = a.createBufferSource()
  noise.buffer = buf
  const nf = filter(a, 'bandpass', 2000)
  nf.Q.value = 1
  const ng = gain(a, 0)
  ng.gain.linearRampToValueAtTime(0.02, t + 0.005)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
  noise.connect(nf)
  nf.connect(ng)
  noise.start(t)
  noise.stop(t + 0.08)
}

/** Modal close — soft descending sigh */
export function playModalClose() {
  const a = getCtx()
  const t = a.currentTime

  const osc = a.createOscillator()
  const g = gain(a, 0)
  const lp = filter(a, 'lowpass', 2000)
  lp.frequency.exponentialRampToValueAtTime(400, t + 0.1)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(700, t)
  osc.frequency.exponentialRampToValueAtTime(350, t + 0.1)
  g.gain.linearRampToValueAtTime(0.04, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.connect(lp)
  lp.connect(g)
  osc.start(t)
  osc.stop(t + 0.14)

  // Subtle sub-bass thud
  const sub = a.createOscillator()
  const sg = gain(a, 0)
  sub.type = 'sine'
  sub.frequency.setValueAtTime(120, t)
  sub.frequency.exponentialRampToValueAtTime(60, t + 0.08)
  sg.gain.linearRampToValueAtTime(0.035, t + 0.003)
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  sub.connect(sg)
  sub.start(t)
  sub.stop(t + 0.1)
}

/** Hover — barely-there crystalline whisper */
export function playHover() {
  const a = getCtx()
  const t = a.currentTime

  const osc = a.createOscillator()
  const g = gain(a, 0)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(3000, t)
  osc.frequency.exponentialRampToValueAtTime(2200, t + 0.02)
  g.gain.linearRampToValueAtTime(0.015, t + 0.001)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + 0.035)
}

/** Delete/error — muted thump with subtle dissonance */
export function playError() {
  const a = getCtx()
  const t = a.currentTime

  // Low thump
  const osc = a.createOscillator()
  const g = gain(a, 0)
  const lp = filter(a, 'lowpass', 400)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(250, t)
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.12)
  g.gain.linearRampToValueAtTime(0.06, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  osc.connect(lp)
  lp.connect(g)
  osc.start(t)
  osc.stop(t + 0.18)

  // Dissonant minor second for "wrongness"
  const osc2 = a.createOscillator()
  const g2 = gain(a, 0)
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(290, t + 0.01)
  osc2.frequency.exponentialRampToValueAtTime(100, t + 0.1)
  g2.gain.linearRampToValueAtTime(0.025, t + 0.015)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc2.connect(g2)
  osc2.start(t + 0.01)
  osc2.stop(t + 0.14)
}
