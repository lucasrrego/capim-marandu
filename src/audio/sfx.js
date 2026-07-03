// Áudio do jogo — 100% procedural via Web Audio, sem arquivos.
// Módulo compartilhado: trilha (derivada da intro) + blips de menu + um
// playBlip() genérico pronto pra cobrir os SFX de gameplay na Rodada 2.

let ctx = null

/** AudioContext singleton (criado sob demanda, após gesto do usuário). */
export function getCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

/** Retoma o contexto se o navegador o tiver suspendido. */
export function resume() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume()
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12) }

// Envelope simples de uma nota (ataque rápido, decaimento exponencial).
function tone(freq, when, dur, type, gain, dest) {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  g.connect(dest || c.destination)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  o.start(when)
  o.stop(when + dur + 0.03)
}

// ---- Blips genéricos ----------------------------------------------------

/**
 * Toca uma sequência curta de notas MIDI.
 * @param {object} opts
 * @param {number[]} opts.notes  notas MIDI em ordem
 * @param {string}  [opts.type]  tipo do oscilador ('square' | 'triangle' | ...)
 * @param {number}  [opts.gain]  volume de pico
 * @param {number}  [opts.step]  intervalo entre notas (s)
 * @param {number}  [opts.dur]   duração de cada nota (s)
 */
export function playBlip({ notes, type = 'square', gain = 0.35, step = 0.06, dur = 0.12 }) {
  const c = getCtx()
  if (!c) return
  resume()
  const start = c.currentTime + 0.001
  notes.forEach((n, i) => tone(midiToFreq(n), start + i * step, dur, type, gain))
}

/** Navegação de menu (uma nota curta). */
export function playSelect() {
  playBlip({ notes: [81], type: 'square', gain: 0.28, dur: 0.08 })
}

/** Confirmação (arpejo de duas notas subindo). */
export function playConfirm() {
  playBlip({ notes: [76, 83], type: 'square', gain: 0.34, step: 0.08, dur: 0.14 })
}

/** Jingle de "deslumbre" do Gugu (subida rápida e brilhante). */
export function playSparkle() {
  playBlip({ notes: [72, 76, 79, 84, 88], type: 'triangle', gain: 0.3, step: 0.05, dur: 0.16 })
}

/** Fanfarra de sucesso (ex.: pouso bem-sucedido). */
export function playSuccess() {
  playBlip({ notes: [72, 76, 79, 84, 88, 91], type: 'square', gain: 0.32, step: 0.09, dur: 0.16 })
}

/** Parafusadeira: whine agudo de partida → rattle mecânico → clunk de encaixe. */
export function playWrench() {
  const c = getCtx()
  if (!c) return
  resume()
  const now = c.currentTime

  // 1) whine agudo de partida (o motor engatando)
  const whine = c.createOscillator()
  whine.type = 'triangle'
  whine.frequency.setValueAtTime(700, now)
  whine.frequency.exponentialRampToValueAtTime(1500, now + 0.1)
  const wg = c.createGain()
  wg.gain.setValueAtTime(0.0001, now)
  wg.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
  wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  whine.connect(wg)
  wg.connect(c.destination)
  whine.start(now)
  whine.stop(now + 0.16)

  // 2) rattle da parafusadeira (ruído picotado), logo após o whine
  const rStart = now + 0.08
  const rDur = 0.34
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * rDur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400
  bp.Q.value = 1.2
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, rStart)
  out.gain.exponentialRampToValueAtTime(0.3, rStart + 0.02)
  out.gain.setValueAtTime(0.3, rStart + rDur - 0.08)
  out.gain.exponentialRampToValueAtTime(0.0001, rStart + rDur)
  const chop = c.createGain()
  chop.gain.value = 0.5
  const lfo = c.createOscillator()
  lfo.type = 'square'
  lfo.frequency.setValueAtTime(36, rStart)
  lfo.frequency.linearRampToValueAtTime(54, rStart + rDur)
  const lfoDepth = c.createGain()
  lfoDepth.gain.value = 0.5
  lfo.connect(lfoDepth)
  lfoDepth.connect(chop.gain)
  lfo.start(rStart)
  lfo.stop(rStart + rDur)
  src.connect(bp)
  bp.connect(chop)
  chop.connect(out)
  out.connect(c.destination)
  src.start(rStart)
  src.stop(rStart + rDur + 0.02)

  // 3) clunk final: o parafuso assentou
  const t2 = rStart + rDur - 0.02
  const clunk = c.createOscillator()
  clunk.type = 'triangle'
  clunk.frequency.setValueAtTime(170, t2)
  clunk.frequency.exponentialRampToValueAtTime(60, t2 + 0.1)
  const cg = c.createGain()
  cg.gain.setValueAtTime(0.2, t2)
  cg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.12)
  clunk.connect(cg)
  cg.connect(c.destination)
  clunk.start(t2)
  clunk.stop(t2 + 0.14)
}

/** Coleta de combustível (blip arcade tipo "moeda", subindo). */
export function playFuel() {
  playBlip({ notes: [84, 91], type: 'square', gain: 0.3, step: 0.07, dur: 0.13 })
}

// curva de distorção (grit/rugido) pro corpo da explosão
function distortionCurve(amount = 60) {
  const n = 256
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = ((3 + amount) * x * 0.35) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

/**
 * Explosão pesada e ALTA: ruído marrom com distorção forte + punch duplo
 * (triângulo + serra grave) + sub, tudo por um compressor + makeup pra
 * ficar grosso e alto. `gain` = makeup final (volume geral).
 */
export function playExplosion(gain = 1.45) {
  const c = getCtx()
  if (!c) return
  resume()
  const now = c.currentTime
  const dur = 0.85

  // master: compressor "cola" os picos e o makeup levanta o volume percebido
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -22
  comp.knee.value = 10
  comp.ratio.value = 8
  comp.attack.value = 0.002
  comp.release.value = 0.25
  const master = c.createGain()
  master.gain.value = gain
  comp.connect(master)
  master.connect(c.destination)

  const out = c.createGain()
  out.gain.value = 1.0
  out.connect(comp)

  // 1) corpo: ruído MARROM (grave) por lowpass caindo + distorção forte
  const len = Math.floor(c.sampleRate * dur)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  let brown = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    brown = (brown + 0.02 * white) / 1.02
    const env = Math.pow(1 - i / len, 1.3)
    data[i] = brown * 4 * env
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1000, now)
  lp.frequency.exponentialRampToValueAtTime(70, now + dur)
  const shaper = c.createWaveShaper()
  shaper.curve = distortionCurve(80)
  const ng = c.createGain()
  ng.gain.setValueAtTime(1.0, now)
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  noise.connect(lp)
  lp.connect(shaper)
  shaper.connect(ng)
  ng.connect(out)
  noise.start(now)
  noise.stop(now + dur)

  // 2) punch DUPLO (triângulo + serra grave) por lowpass — engrossa o baque
  const p1 = c.createOscillator()
  p1.type = 'triangle'
  p1.frequency.setValueAtTime(150, now)
  p1.frequency.exponentialRampToValueAtTime(46, now + 0.28)
  const p2 = c.createOscillator()
  p2.type = 'sawtooth'
  p2.frequency.setValueAtTime(90, now)
  p2.frequency.exponentialRampToValueAtTime(34, now + 0.28)
  const plp = c.createBiquadFilter()
  plp.type = 'lowpass'
  plp.frequency.value = 520
  const pg = c.createGain()
  pg.gain.setValueAtTime(1.0, now)
  pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  p1.connect(plp)
  p2.connect(plp)
  plp.connect(pg)
  pg.connect(out)
  p1.start(now)
  p2.start(now)
  p1.stop(now + 0.47)
  p2.stop(now + 0.47)

  // 3) sub pra fones (bem grave)
  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(75, now)
  sub.frequency.exponentialRampToValueAtTime(26, now + 0.55)
  const sg = c.createGain()
  sg.gain.setValueAtTime(0.9, now)
  sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.62)
  sub.connect(sg)
  sg.connect(out)
  sub.start(now)
  sub.stop(now + 0.64)

  // 4) impacto: estouro curto em médio-grave (não fino)
  const crackBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.06), c.sampleRate)
  const cd = crackBuf.getChannelData(0)
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
  const crack = c.createBufferSource()
  crack.buffer = crackBuf
  const bpf = c.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = 450
  bpf.Q.value = 0.7
  const cg = c.createGain()
  cg.gain.setValueAtTime(0.6, now)
  cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
  crack.connect(bpf)
  bpf.connect(cg)
  cg.connect(out)
  crack.start(now)
  crack.stop(now + 0.07)
}

// ---- Tiros / plasma -----------------------------------------------------

// tom com pitch varrido (base dos "pews" de tiro)
function sweep({ f0, f1, dur, type = 'square', gain = 0.3 }) {
  const c = getCtx()
  if (!c) return
  resume()
  const now = c.currentTime
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, now)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(now)
  o.stop(now + dur + 0.02)
}

/** Disparo — som distinto por arma (canhão grave x metralhadora curta/aguda). */
export function playShot(weapon = 'cannon') {
  if (weapon === 'rapid') {
    sweep({ f0: 1040, f1: 620, dur: 0.05, type: 'square', gain: 0.13 })
  } else {
    sweep({ f0: 820, f1: 210, dur: 0.12, type: 'square', gain: 0.24 })
  }
}

let plasmaChargeNodes = null

/** Zumbido de carga do plasma que sobe de tom (idempotente). */
export function startPlasmaCharge(rampMs = 1600) {
  const c = getCtx()
  if (!c || plasmaChargeNodes) return
  resume()
  const now = c.currentTime
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(150, now)
  o.frequency.exponentialRampToValueAtTime(1300, now + rampMs / 1000)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2200
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.05)
  o.connect(lp)
  lp.connect(g)
  g.connect(c.destination)
  o.start(now)
  plasmaChargeNodes = { o, g }
}

/** Para o zumbido de carga (ao soltar, morrer, pausar). */
export function stopPlasmaCharge() {
  if (!plasmaChargeNodes) return
  const { o, g } = plasmaChargeNodes
  plasmaChargeNodes = null
  const c = getCtx()
  try {
    const now = c.currentTime
    g.gain.setTargetAtTime(0.0001, now, 0.03)
    o.stop(now + 0.12)
  } catch { /* noop */ }
}

/** Plasma recarregado / pronto de novo (ping curto subindo). */
export function playPlasmaReady() {
  playBlip({ notes: [83, 90], type: 'triangle', gain: 0.22, step: 0.06, dur: 0.11 })
}

/** Disparo do feixe de plasma (zap descendente + peso; escala com a carga). */
export function playPlasmaFire(power = 1) {
  const p = Math.max(0, Math.min(1, power))
  sweep({ f0: 1300, f1: 130, dur: 0.22 + 0.16 * p, type: 'sawtooth', gain: 0.22 + 0.08 * p })
  sweep({ f0: 320, f1: 60, dur: 0.3, type: 'sine', gain: 0.2 + 0.1 * p })
}

// ---- Propulsão contínua (segurar acelerar) ------------------------------

let thrustNodes = null

/**
 * Liga/desliga o som de propulsão. Idempotente: chamar com o mesmo estado
 * repetidamente (ex.: todo frame) não empilha nem corta o som.
 */
export function setThrust(on) {
  const c = getCtx()
  if (!c) return

  if (on) {
    if (thrustNodes) return
    resume()
    const now = c.currentTime

    const master = c.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.09)
    master.connect(c.destination)

    // rumble: dente-de-serra grave por lowpass
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 72
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    osc.connect(lp)
    lp.connect(master)
    osc.start(now)

    // chiado: ruído em loop por bandpass
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const noise = c.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 0.7
    const ng = c.createGain()
    ng.gain.value = 0.5
    noise.connect(bp)
    bp.connect(ng)
    ng.connect(master)
    noise.start(now)

    thrustNodes = { master, osc, noise }
  } else {
    if (!thrustNodes) return
    const { master, osc, noise } = thrustNodes
    thrustNodes = null
    try {
      const now = c.currentTime
      master.gain.setTargetAtTime(0.0001, now, 0.05)
      osc.stop(now + 0.2)
      noise.stop(now + 0.2)
      setTimeout(() => { try { master.disconnect() } catch { /* noop */ } }, 400)
    } catch { /* contexto pode já estar indisponível */ }
  }
}

// ---- SFX do minigame da abdução -----------------------------------------

/** Garra descendo (nota grave curta). */
export function playClaw() {
  playBlip({ notes: [45], type: 'square', gain: 0.16, dur: 0.1 })
}

/** Abduziu um jogador (arpejo dourado subindo). */
export function playAbduct() {
  playBlip({ notes: [72, 76, 79, 84], type: 'square', gain: 0.3, step: 0.05, dur: 0.14 })
}

// uma "sílaba" de voz alienígena: sawtooth + quinta metálica por um formante,
// com glide de tom (bend em semitons) e envelope curto.
function alienSyllable(c, t, midi, dur, bend = 0, gain = 0.24) {
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(midiToFreq(midi), t)
  o.frequency.exponentialRampToValueAtTime(midiToFreq(midi + bend), t + dur)
  const o2 = c.createOscillator()   // quinta acima = timbre metálico/robótico
  o2.type = 'square'
  o2.frequency.setValueAtTime(midiToFreq(midi) * 1.5, t)
  o2.frequency.exponentialRampToValueAtTime(midiToFreq(midi + bend) * 1.5, t + dur)
  const bp = c.createBiquadFilter()  // formante (dá cara de "vogal")
  bp.type = 'bandpass'
  bp.frequency.value = 1650
  bp.Q.value = 4
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(bp)
  o2.connect(bp)
  bp.connect(g)
  g.connect(c.destination)
  o.start(t); o.stop(t + dur + 0.03)
  o2.start(t); o2.stop(t + dur + 0.03)
}

/**
 * Abduziu o craque (Neymar) — voz alienígena imitando "levanta menino ney",
 * com a última sílaba esticada e subindo (o sotaque). 100% sintetizado.
 */
export function playAbductStar() {
  const c = getCtx()
  if (!c) return
  resume()
  const t = c.currentTime + 0.001
  // [midi, início(s), duração(s), bend(semitons)] — cadência da frase
  const syllables = [
    [76, 0.00, 0.12,  2],   // le
    [79, 0.15, 0.12, -2],   // van (tônica)
    [74, 0.30, 0.14,  0],   // ta
    [78, 0.52, 0.12,  2],   // me
    [81, 0.67, 0.12, -1],   // ni (tônica)
    [76, 0.82, 0.14,  0],   // no
    [72, 1.02, 0.40,  8],   // ney — esticado e subindo (sotaque)
  ]
  const rate = 0.78   // < 1 = mais rápido
  for (const [m, at, d, b] of syllables) alienSyllable(c, t + at * rate, m + 12, d * rate, b)   // +12 = mais fino
}

/** Craque se jogou no chão pra escapar (whoosh descendo). */
export function playDodge() {
  playBlip({ notes: [72, 60], type: 'triangle', gain: 0.26, step: 0.05, dur: 0.12 })
}

// ---- Música (loops procedurais; uma faixa por vez) ----------------------
// track = { lead:[midi|null], bass:[midi|null], step, leadType, bassType,
//           leadGain, bassGain, leadDur, bassDur }. null = silêncio no passo.

// Tema da intro / tela inicial (melodia original).
const THEME_TRACK = {
  lead: [
    69, 72, 76, 72, 81, 76, 72, 76,
    67, 71, 74, 71, 79, 74, 71, 74,
    65, 69, 72, 69, 77, 72, 69, 72,
    64, 68, 71, 76, 71, 68, 71, 68,
  ],
  bass: [
    45, null, null, null, 45, null, null, null,
    43, null, null, null, 43, null, null, null,
    41, null, null, null, 41, null, null, null,
    40, null, null, null, 40, null, null, null,
  ],
  step: 0.15,
}

// Jogo da Vó Baiana — cômica, saltitante (oom-pah de desenho animado).
const ABDUCTION_TRACK = {
  lead: [
    72, 74, 76, 74, 79, 76, 74, 72,
    77, 76, 74, 72, 74, 76, 72, 71,
  ],
  bass: [
    48, null, 55, null, 48, null, 55, null,
    53, null, 60, null, 53, null, 55, null,
  ],
  step: 0.13,
  leadType: 'square', leadGain: 0.4, leadDur: 1.1,
  bassType: 'triangle', bassGain: 0.5, bassDur: 1.3,
}

// Pouso na Lua — épica, "final de jogo" (lenta e triunfante).
const LANDING_TRACK = {
  lead: [
    72, 76, 79, 84, 83, 79, 81, 76,
    74, 77, 81, 86, 84, 81, 79, 76,
  ],
  bass: [
    48, null, null, null, 43, null, null, null,
    45, null, null, null, 41, null, null, null,
  ],
  step: 0.24,
  leadType: 'triangle', leadGain: 0.42, leadDur: 1.9,
  bassType: 'triangle', bassGain: 0.5, bassDur: 3.6,
}

let musicGain = null
let musicTimer = 0
let musicStart = 0
let musicStep = 0
let musicTrack = null

/** Toca um track em loop (uma faixa por vez; troca se já houver outra). */
export function startMusic(track, volume = 0.13) {
  const c = getCtx()
  if (!c) return
  if (musicTrack === track && musicTimer) return   // já tocando esta faixa
  stopMusic()
  resume()
  musicTrack = track
  musicGain = c.createGain()
  musicGain.gain.value = volume
  musicGain.connect(c.destination)
  musicStart = c.currentTime + 0.1
  musicStep = 0
  const step = track.step
  const scheduler = () => {
    if (!musicGain || musicTrack !== track) return
    while (musicStart + musicStep * step < c.currentTime + 0.2) {
      const t = musicStart + musicStep * step
      const lead = track.lead[musicStep % track.lead.length]
      if (lead) tone(midiToFreq(lead), t, step * (track.leadDur ?? 1.6), track.leadType ?? 'square', track.leadGain ?? 0.45, musicGain)
      const bass = track.bass && track.bass[musicStep % track.bass.length]
      if (bass) tone(midiToFreq(bass), t, step * (track.bassDur ?? 3.2), track.bassType ?? 'triangle', track.bassGain ?? 0.55, musicGain)
      musicStep++
    }
  }
  scheduler()
  musicTimer = setInterval(scheduler, 60)
}

/** Para a música atual (sem fechar o contexto; SFX continuam). */
export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer)
    musicTimer = 0
  }
  musicTrack = null
  if (musicGain) {
    const c = getCtx()
    try {
      musicGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.05)
    } catch { /* contexto pode já estar indisponível */ }
    const g = musicGain
    musicGain = null
    setTimeout(() => { try { g.disconnect() } catch { /* noop */ } }, 300)
  }
}

/** Tema da intro / tela inicial. */
export function startTheme(volume = 0.13) { startMusic(THEME_TRACK, volume) }
export function stopTheme() { stopMusic() }

/** Trilha cômica do jogo da Vó Baiana. */
export function startAbductionMusic(volume = 0.12) { startMusic(ABDUCTION_TRACK, volume) }

/** Trilha épica (final de jogo) do pouso na Lua. */
export function startLandingMusic(volume = 0.2) { startMusic(LANDING_TRACK, volume) }

// Hangar — trilha de menu (calma, "seleção", meio espacial).
const HANGAR_TRACK = {
  lead: [
    69, null, 72, null, 74, null, 72, null,
    71, null, 74, null, 76, null, 74, null,
    69, null, 72, null, 76, null, 74, 72,
    67, null, 71, null, 74, null, 69, null,
  ],
  bass: [
    45, null, null, null, 45, null, null, null,
    41, null, null, null, 41, null, null, null,
    40, null, null, null, 40, null, null, null,
    38, null, null, null, 43, null, null, null,
  ],
  step: 0.18,
  leadType: 'triangle', leadGain: 0.4, leadDur: 1.7,
  bassType: 'triangle', bassGain: 0.5, bassDur: 3.4,
}

// Jogo principal — trilha de aventura (rápida, baixo pulsante, avançando).
const GAME_TRACK = {
  lead: [
    76, 79, 81, 79, 84, 81, 79, 76,
    77, 81, 84, 81, 88, 84, 81, 77,
    76, 79, 83, 79, 84, 83, 79, 76,
    74, 77, 81, 84, 81, 77, 74, 71,
  ],
  bass: [
    40, 40, 47, 40, 40, 40, 47, 40,
    41, 41, 48, 41, 41, 41, 48, 41,
    36, 36, 43, 36, 36, 36, 43, 36,
    38, 38, 45, 38, 38, 38, 45, 38,
  ],
  step: 0.12,
  leadType: 'square', leadGain: 0.32, leadDur: 0.95,
  bassType: 'triangle', bassGain: 0.5, bassDur: 0.9,
}

/** Trilha de menu do hangar. */
export function startHangarMusic(volume = 0.12) { startMusic(HANGAR_TRACK, volume) }

/** Trilha de aventura do jogo principal. */
export function startGameMusic(volume = 0.1) { startMusic(GAME_TRACK, volume) }

// Boss — tensa, "chefão final": menor, baixo pulsante, cromatismo e tritono.
const BOSS_TRACK = {
  lead: [
    62, 65, 68, 65, 62, null, 61, null,
    63, 66, 69, 66, 63, null, 62, null,
    62, 65, 68, 65, 62, 61, 60, 59,
    58, 62, 65, 69, 68, 65, 62, 58,
  ],
  bass: [
    38, 38, 38, 38, 38, 38, 38, 38,
    39, 39, 39, 39, 39, 39, 39, 39,
    38, 38, 38, 38, 38, 38, 38, 38,
    40, 40, 40, 40, 44, 44, 44, 44,
  ],
  step: 0.12,
  leadType: 'square', leadGain: 0.34, leadDur: 0.95,
  bassType: 'triangle', bassGain: 0.55, bassDur: 0.9,
}

/** Trilha tensa da batalha de chefe. */
export function startBossMusic(volume = 0.16) { startMusic(BOSS_TRACK, volume) }
