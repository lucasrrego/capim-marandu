<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { drawSprite, GUGU } from '../data/pixelSprites.js'
import { playConfirm, playSelect, playSparkle, resume } from '../audio/sfx.js'

const emit = defineEmits(['done'])

// Cutscene de aproximação (ANTES do pouso): o que o Gugu enxerga ao chegar
// perto da Lua — a mesma Lua pixel art do jogo, agora com um centrão de
// cidade cheio de prédios e luzes. O Gugu finge costume: acha tudo lindo e
// positivo, nota que está diferente do que imaginava mas só vê o lado bom
// (a Lua "progrediu"), sem reclamar nem estranhar. Prepara o plot twist do
// outlet lunar que a FinalCutscene paga depois do pouso.
const STEPS = [
  { pose: 'dazzled', sfx: 'sparkle',
    text: 'A LUA! Cheguei mesmo, pai! Que linda ela de pertinho...' },
  { pose: 'idle',
    text: 'Ah, luzinhas. Que charme! Deixa tudo mais aconchegante.' },
  { pose: 'dazzled', sfx: 'sparkle',
    text: 'Óoo, e quanto prédio! A Lua progrediu bastante ne, bem urbana.' },
  { pose: 'idle',
    text: 'Que lugarzinho animado! Vou descer com jeitinho pra não incomodar. Bora, Gugu!' },
]

const index = ref(0)
const shown = ref(0)           // caracteres revelados (máquina de escrever)
const portrait = ref(null)
const moonCanvas = ref(null)

const step = computed(() => STEPS[index.value])
const typing = computed(() => shown.value < step.value.text.length)
const visibleText = computed(() => step.value.text.slice(0, shown.value))
const isLast = computed(() => index.value === STEPS.length - 1)

let typer = 0
const TYPE_MS = 26

function stopTyper() { if (typer) { clearInterval(typer); typer = 0 } }

function startTyper() {
  stopTyper()
  shown.value = 0
  typer = setInterval(() => {
    shown.value++
    if (shown.value >= step.value.text.length) stopTyper()
  }, TYPE_MS)
}

function playStepSfx() {
  if (step.value.sfx === 'sparkle') playSparkle()
  else playSelect()
}

function drawPortrait() {
  const ctx = portrait.value.getContext('2d')
  ctx.clearRect(0, 0, portrait.value.width, portrait.value.height)
  drawSprite(ctx, 0, 0, GUGU[step.value.pose || 'idle'], 6)
}

// ---- A Lua-cidade: pixel art plotado pixel a pixel + upscale nearest -------
// Buffer pequeno (CW×CH) desenhado célula a célula (sem arcos anti-serrilhados)
// e escalado por CSS com image-rendering: pixelated → pixel art chunky de
// verdade. A Lua é sombreada em bandas; a cidade é um AGRUPAMENTO em disco na
// PARTE DE CIMA da Lua, com perfil triangular (alta no meio, baixa nas pontas)
// e algumas irregularidades.
const CW = 64
const CH = 64

// Paleta pixel da Lua (poucos tons → cara de pixel art).
const MOON = {
  hi: '#e2dfee', base: '#c6c2d8', low: '#a49fbb', deep: '#807b98',
  crater: '#9691ac', rim: '#d6d2e4',
}
// Crateras em coords normalizadas do disco (-1..1) + raio normalizado.
const CRATERS = [
  [-0.34, -0.10, 0.20], [0.30, 0.02, 0.15], [-0.08, 0.34, 0.22],
  [0.40, 0.40, 0.12], [-0.50, 0.28, 0.10], [0.10, -0.34, 0.11],
]

function pixelMoon(ctx, cx, cy, r) {
  const r2 = r * r
  for (let py = -r; py <= r; py++) {
    for (let px = -r; px <= r; px++) {
      const d2 = px * px + py * py
      if (d2 > r2) continue
      const nx = px / r
      const ny = py / r
      // luz vindo do topo-esquerda; borda inferior-direita escurece
      let lum = 0.5 - (nx + ny) * 0.42
      lum -= Math.max(0, Math.sqrt(d2) / r - 0.8) * 1.6
      // crateras
      let inC = false
      let rimC = false
      for (const [ccx, ccy, ccr] of CRATERS) {
        const dx = nx - ccx
        const dy = ny - ccy
        const cd = Math.sqrt(dx * dx + dy * dy)
        if (cd < ccr) {
          inC = true
          if (cd > ccr - 0.07 && dx + dy < 0) rimC = true
        }
      }
      let col
      if (rimC) col = MOON.rim
      else if (inC) col = lum > 0 ? MOON.crater : MOON.deep
      else if (lum > 0.5) col = MOON.hi
      else if (lum > 0.12) col = MOON.base
      else if (lum > -0.25) col = MOON.low
      else col = MOON.deep
      ctx.fillStyle = col
      ctx.fillRect(cx + px, cy + py, 1, 1)
    }
  }
}

// Aglomerado urbano em DISCO na PARTE DE CIMA da Lua: prédios espalhados numa
// elipse-footprint (não uma linha), com perfil triangular (altos no centro,
// baixos nas pontas) + irregularidades, profundidade (fundo escuro → frente
// clara) e MUITAS janelas acesas pra "brilhar" como cidade.
const NEON = ['#6cc6ff', '#ff6ea8', '#ffd24d', '#6fcf5b']
// posições normalizadas (fx, fy) dentro da elipse; fy cresce pra frente
const CITY = [
  [-0.40, -0.72], [0.02, -0.72], [0.42, -0.72],
  [-0.70, -0.38], [-0.34, -0.40], [0.03, -0.42], [0.37, -0.40], [0.70, -0.38],
  [-0.86, -0.02], [-0.52, -0.04], [-0.17, -0.02], [0.20, -0.03], [0.55, -0.02], [0.86, -0.02],
  [-0.66, 0.38], [-0.30, 0.40], [0.06, 0.40], [0.42, 0.38], [0.72, 0.36],
  [-0.42, 0.74], [0.00, 0.76], [0.38, 0.72],
]
const JITTER = [1.0, 0.82, 1.14, 0.9, 1.06, 0.76, 1.16, 0.94, 1.02, 0.86]

function hex(h) {
  h = h.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function mixHex(a, b, t) {
  const A = hex(a); const B = hex(b)
  const c = [0, 1, 2].map(k => Math.round(A[k] + (B[k] - A[k]) * t))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

function drawCity(ctx, cx, cy, r, clock) {
  const pcy = cy - r * 0.20            // centro do disco-cidade (em cima)
  const prx = r * 0.62
  const pry = r * 0.30                 // raios da elipse (footprint)

  // sombra-footprint discreta (metade da frente) só pra "assentar" a cidade
  ctx.fillStyle = '#8f8aa6'
  for (let py = -Math.ceil(pry); py <= Math.ceil(pry); py++) {
    for (let px = -Math.ceil(prx); px <= Math.ceil(prx); px++) {
      const e = (px * px) / (prx * prx) + (py * py) / (pry * pry)
      if (e > 1 || py < pry * 0.2) continue
      ctx.globalAlpha = 0.35
      ctx.fillRect(cx + px, pcy + py, 1, 1)
    }
  }
  ctx.globalAlpha = 1

  // prédios ordenados por profundidade (fundo → frente)
  CITY.map((p, i) => ({ p, i }))
    .sort((a, b) => a.p[1] - b.p[1])
    .forEach(({ p, i }) => {
      const fx = p[0]
      const fy = p[1]
      const front = (fy + 1) / 2
      const radial = Math.min(1, Math.sqrt(fx * fx + fy * fy))
      const w = Math.max(3, Math.round(r * 0.16))
      const tri = 0.35 + 0.75 * (1 - radial)          // triangular acentuado
      const jit = JITTER[i % JITTER.length]
      const h = Math.max(5, Math.round(r * 0.34 * tri * jit * (0.85 + 0.3 * front)))
      const bx = Math.round(cx + fx * prx - w / 2)
      const by = Math.round(pcy + fy * pry) - h
      ctx.fillStyle = mixHex('#211e37', '#3a3660', front)   // corpo
      ctx.fillRect(bx, by, w, h)
      ctx.fillStyle = mixHex('#302c50', '#524d88', front)   // topo iluminado
      ctx.fillRect(bx, by, w, 1)
      ctx.fillStyle = '#0f0d1e'                             // sombra lateral direita
      ctx.fillRect(bx + w - 1, by, 1, h)
      // janelas 1px — a maioria acesa (cidade brilhando)
      const cols = Math.floor((w - 1) / 2)
      const rows = Math.floor((h - 1) / 2)
      const c = NEON[i % NEON.length]
      for (let col = 0; col < cols; col++) {
        for (let row2 = 0; row2 < rows; row2++) {
          if ((i + col + row2) % 4 === 0) continue         // ~75% acesas
          const blink = Math.floor(clock / 380 + i + col * 2 + row2) % 3 === 0
          ctx.fillStyle = c
          ctx.globalAlpha = blink ? 0.5 : 1
          ctx.fillRect(bx + 1 + col * 2, by + 2 + row2 * 2, 1, 1)
          ctx.globalAlpha = 1
        }
      }
    })

  // glow suave das luzes acima do centro da cidade
  ctx.fillStyle = '#ffe6a0'
  for (let py = -8; py <= 6; py++) {
    for (let px = -14; px <= 14; px++) {
      const e = (px * px) / 196 + (py * py) / 64
      if (e > 1) continue
      ctx.globalAlpha = 0.05 * (1 - e)
      ctx.fillRect(cx + px, pcy + py - 2, 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

let raf = 0
let start = 0
function frame(ts) {
  if (!start) start = ts
  const clock = ts - start
  const ctx = moonCanvas.value.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, CW, CH)
  const cx = CW / 2
  const cy = CH / 2
  // aproximação: raio cresce de leve nos primeiros ~7s
  const t = Math.min(1, clock / 7000)
  const r = Math.round(26 + t * 3)
  pixelMoon(ctx, cx, cy, r)
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  drawCity(ctx, cx, cy, r, clock)
  ctx.restore()
  raf = requestAnimationFrame(frame)
}

// Avança: se digitando, completa a linha; senão, próxima fala (ou fim).
function advance() {
  resume()
  if (typing.value) {
    stopTyper()
    shown.value = step.value.text.length
    return
  }
  if (isLast.value) {
    playConfirm()
    finish()
    return
  }
  index.value++
}

let done = false
function finish() {
  if (done) return
  done = true
  stopTyper()
  emit('done')
}

function onKey(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
  else if (e.key === 'Escape') finish()
}

watch(index, () => {
  drawPortrait()
  playStepSfx()
  startTyper()
})

onMounted(() => {
  drawPortrait()
  playStepSfx()
  startTyper()
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  stopTyper()
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="appr" @pointerdown="advance">
    <div class="appr-sky"></div>
    <div class="appr-stars"></div>

    <!-- Visão do Gugu: a mesma Lua pixel art do jogo, virada um centrão urbano -->
    <canvas ref="moonCanvas" class="appr-moon" :width="CW" :height="CH"></canvas>

    <!-- Gugu na frente, com o balãozinho -->
    <div class="appr-hero">
      <div class="appr-bubble">
        <p class="appr-text">{{ visibleText }}<span v-if="typing" class="appr-caret">▋</span></p>
        <span v-if="!typing" class="appr-next">{{ isLast ? '✔' : '▶' }}</span>
      </div>
      <canvas ref="portrait" class="appr-portrait" width="90" height="102"></canvas>
    </div>

    <p class="appr-hint">clique ou espaço para avançar</p>
    <button class="appr-skip" @pointerdown.stop @click.stop="finish">Pular ⏭</button>
  </div>
</template>

<style scoped>
.appr {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  user-select: none;
  cursor: pointer;
}

.appr-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 20%, rgba(120, 90, 220, 0.30), transparent 60%),
    linear-gradient(180deg, #05040c 0%, #120d24 60%, #0a0716 100%);
}

.appr-stars {
  position: absolute;
  top: 0; left: 0;
  width: 2px; height: 2px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    30px 40px #fff, 80px 120px #cfe4ff, 150px 60px #fff, 210px 200px #ffd9f0,
    260px 90px #fff, 320px 260px #fff, 90px 300px #cfe4ff, 400px 140px #fff,
    440px 90px #fff, 40px 220px #fff, 190px 150px #e6e6ff, 300px 60px #fff,
    120px 200px #fff, 360px 180px #cfe4ff, 60px 260px #fff, 240px 40px #fff;
  opacity: 0.8;
  animation: appr-twinkle 3.5s ease-in-out infinite;
}
@keyframes appr-twinkle {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.95; }
}

/* A Lua-cidade, centralizada no alto; balança de leve (aproximação) */
.appr-moon {
  position: absolute;
  left: 50%;
  top: 33%;
  width: 256px;
  height: 256px;
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
  filter: drop-shadow(0 0 30px rgba(180, 190, 255, 0.28));
  animation: appr-float 5s ease-in-out infinite;
}
@keyframes appr-float {
  0%, 100% { transform: translate(-50%, -50%); }
  50% { transform: translate(-50%, -53%); }
}

/* Gugu + balãozinho, em primeiro plano (canto inferior) */
.appr-hero {
  position: absolute;
  left: 20px;
  bottom: 20px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  max-width: calc(100% - 40px);
}

.appr-portrait {
  flex: none;
  width: 90px;
  height: auto;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 0 rgba(0, 0, 0, 0.35));
  animation: appr-bob 1.8s ease-in-out infinite;
}
@keyframes appr-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.appr-bubble {
  position: relative;
  flex: 1;
  min-height: 76px;
  margin-bottom: 22px;
  padding: 12px 16px 14px;
  background: rgba(12, 9, 24, 0.92);
  border: 3px solid var(--px-purple, #9b7bff);
  border-radius: 10px;
  box-shadow: 0 0 0 3px #04040a, 0 0 20px rgba(155, 123, 255, 0.35);
}
/* Rabinho do balão apontando pro Gugu (embaixo à esquerda) */
.appr-bubble::after {
  content: '';
  position: absolute;
  left: 14px;
  bottom: -14px;
  border-width: 14px 14px 0 0;
  border-style: solid;
  border-color: var(--px-purple, #9b7bff) transparent transparent transparent;
}

.appr-text {
  margin: 0;
  font-family: 'VT323', monospace;
  font-size: 1.32rem;
  line-height: 1.24;
  color: #fff;
  text-shadow: 0 0 6px rgba(160, 190, 255, 0.35);
}
.appr-caret {
  color: var(--px-gold, #ffd24d);
  animation: appr-caret 0.5s steps(2) infinite;
}
@keyframes appr-caret {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.appr-next {
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.55rem;
  color: var(--px-gold, #ffd24d);
  animation: appr-caret 0.7s steps(2) infinite;
}

.appr-hint {
  position: absolute;
  left: 0; right: 0;
  bottom: 4px;
  margin: 0;
  text-align: center;
  font-family: 'VT323', monospace;
  font-size: 1.05rem;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.appr-skip {
  position: absolute;
  right: 12px;
  top: 12px;
  padding: 8px 14px;
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  color: #fff;
  background: rgba(20, 15, 32, 0.7);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  z-index: 3;
}
.appr-skip:hover { background: rgba(155, 123, 255, 0.3); }
</style>
