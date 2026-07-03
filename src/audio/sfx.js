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

// ---- Trilha (mesma melodia da intro) ------------------------------------

const LEAD = [
  69, 72, 76, 72, 81, 76, 72, 76,
  67, 71, 74, 71, 79, 74, 71, 74,
  65, 69, 72, 69, 77, 72, 69, 72,
  64, 68, 71, 76, 71, 68, 71, 68,
]
const BASS = [
  45, null, null, null, 45, null, null, null,
  43, null, null, null, 43, null, null, null,
  41, null, null, null, 41, null, null, null,
  40, null, null, null, 40, null, null, null,
]
const STEP = 0.15

let themeGain = null
let themeTimer = 0
let themeStart = 0
let themeStep = 0

/** Inicia a trilha em loop (idempotente). */
export function startTheme(volume = 0.13) {
  const c = getCtx()
  if (!c || themeTimer) return
  resume()

  themeGain = c.createGain()
  themeGain.gain.value = volume
  themeGain.connect(c.destination)

  themeStart = c.currentTime + 0.1
  themeStep = 0

  const scheduler = () => {
    if (!themeGain) return
    while (themeStart + themeStep * STEP < c.currentTime + 0.2) {
      const t = themeStart + themeStep * STEP
      const lead = LEAD[themeStep % LEAD.length]
      if (lead) tone(midiToFreq(lead), t, STEP * 1.6, 'square', 0.45, themeGain)
      const bass = BASS[themeStep % BASS.length]
      if (bass) tone(midiToFreq(bass), t, STEP * 3.2, 'triangle', 0.55, themeGain)
      themeStep++
    }
  }
  scheduler()
  themeTimer = setInterval(scheduler, 60)
}

/** Para a trilha sem fechar o contexto (SFX continuam disponíveis). */
export function stopTheme() {
  if (themeTimer) {
    clearInterval(themeTimer)
    themeTimer = 0
  }
  if (themeGain) {
    const c = getCtx()
    try {
      themeGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.05)
    } catch { /* contexto pode já estar indisponível */ }
    const g = themeGain
    themeGain = null
    setTimeout(() => { try { g.disconnect() } catch { /* noop */ } }, 300)
  }
}
