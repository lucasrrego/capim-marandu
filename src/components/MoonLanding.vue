<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { DEFAULT_LOADOUT, drawShip } from '../data/shipParts.js'
import { playExplosion, setThrust, playSuccess } from '../audio/sfx.js'

// Clímax do jogo: pousar na Lua — só a DESCIDA.
//  - Barra vertical verde (direita) = faixa de velocidade de descida segura; encolhe perto do chão.
//  - SEGURA ↑/Espaço pra frear (empuxo contínuo, gasta combustível). No ritmo = freio extra.
//  - SEGURA ↓ pra descer mais rápido.
//  - No chão: velocidade dentro da faixa = pouso; fora = explode.
// HUD (vida/pontos/moedas/combustível) fica no componente pai — aqui só emitimos fuel/speed.

const props = defineProps({
  loadout: { type: Object, default: () => ({ ...DEFAULT_LOADOUT }) },
  width: { type: Number, default: 480 },
  height: { type: Number, default: 640 },
})
const emit = defineEmits(['exit', 'reward', 'fuel', 'speed'])

const W = props.width
const H = props.height

// ---- Física / ritmo (tunáveis) ----
const START_ALT = 500        // altitude inicial
const START_VY = 55          // velocidade de descida inicial (alta → precisa frear)
const GRAVITY_BASE = 16      // m/s² no início da descida
const GRAVITY_RAMP = 30      // acréscimo de gravidade acumulado até o chão (peso)
const BRAKE = 55             // desaceleração ao segurar ↑ (por segundo)
const BRAKE_BONUS = 45       // freio extra ao segurar no ritmo
const DIVE_RATE = 60         // aceleração ao segurar ↓ (por segundo)
const FUEL_RATE = 15         // %/s de combustível gasto enquanto freia
const FUEL_MAX = 100
const VY_MIN = -20
const VY_METER = 120         // topo da escala do medidor
const BEAT_MS = 760          // período da batida
const BEAT_WIN = 0.16        // janela de acerto (fração do ciclo)

// Faixa segura de velocidade em função do progresso (0 = topo, 1 = chão).
// Encolhe de [2, 96] no alto até [2, 40] no chão (verde amplo).
function safeBand(prog) {
  const lo = 2
  const hi = 96 + (40 - 96) * prog
  return { lo, hi }
}

// ---- estado ----
const stage = ref('intro')  // 'intro' | 'descent' | 'landed' | 'crashed'
const result = ref(null)     // { coins }

const canvas = ref(null)
let ctx = null
let raf = 0
let last = 0
let state = null
const held = { up: false, down: false }

function rand(a, b) { return a + Math.random() * (b - a) }

function newState() {
  const craters = []
  for (let i = 0; i < 7; i++) craters.push({ x: rand(30, W - 60), r: rand(10, 26) })
  const stars = []
  for (let i = 0; i < 80; i++) stars.push({ x: rand(0, W), y: rand(0, H * 0.75), r: rand(0.4, 1.6), a: rand(0.2, 0.8) })
  return {
    alt: START_ALT,
    vy: START_VY,
    fuel: FUEL_MAX,
    clock: 0,          // relógio interno (ms) pro ritmo
    flamePulse: 0,     // ms de chama forte (empuxo ativo)
    beatFlash: 0,      // ms do flash de acerto
    boom: 0,           // raio da explosão (crash)
    craters, stars,
  }
}

function progress(s) { return 1 - Math.min(1, s.alt / START_ALT) }
function beatDist(s) {
  const ph = (s.clock % BEAT_MS) / BEAT_MS
  return Math.min(ph, 1 - ph)
}

function begin() {
  state = newState()
  result.value = null
  emit('fuel', FUEL_MAX)
  emit('speed', String(START_VY))
  last = 0
  stage.value = 'descent'
}

function touchdown(s) {
  setThrust(false)
  const { lo, hi } = safeBand(1)
  if (s.vy >= lo && s.vy <= hi) {
    const coins = 15
    result.value = { coins }
    stage.value = 'landed'
    emit('reward', coins)
    playSuccess()
  } else {
    s.boom = 1
    stage.value = 'crashed'
    playExplosion(1.7)
  }
}

function update(dt, s) {
  s.clock += dt * 1000
  if (s.flamePulse > 0) s.flamePulse -= dt * 1000
  if (s.beatFlash > 0) s.beatFlash -= dt * 1000

  if (stage.value === 'descent') {
    const onBeat = beatDist(s) <= BEAT_WIN
    // gravidade cresce na descida (peso)
    s.vy += (GRAVITY_BASE + GRAVITY_RAMP * progress(s)) * dt
    // freio contínuo ao segurar ↑
    const braking = held.up && s.fuel > 0
    if (braking) {
      s.vy -= (BRAKE + (onBeat ? BRAKE_BONUS : 0)) * dt
      s.fuel = Math.max(0, s.fuel - FUEL_RATE * dt)
      s.flamePulse = 120
      if (onBeat) s.beatFlash = 120
    }
    setThrust(braking)   // som de propulsão enquanto freia
    // mergulho ao segurar ↓
    if (held.down) s.vy += DIVE_RATE * dt

    s.vy = Math.max(VY_MIN, Math.min(VY_METER, s.vy))
    s.alt -= s.vy * dt
    emit('fuel', Math.round(s.fuel))
    emit('speed', String(Math.round(s.vy)))
    if (s.alt <= 0) { s.alt = 0; touchdown(s) }
  } else if (stage.value === 'crashed' && s.boom < 60) {
    setThrust(false)
    s.boom += dt * 140
  }
}

// ---- Medidor vertical de velocidade (direita) ----
const METER = { x: W - 52, y: 60, w: 26, h: H - 190 }
function vyToY(vy) {
  const f = Math.max(0, Math.min(1, vy / VY_METER))
  return METER.y + METER.h * (1 - f)
}
function drawMeter(s) {
  const m = METER
  ctx.fillStyle = '#2a2440'
  ctx.fillRect(m.x, m.y, m.w, m.h)
  const { lo, hi } = safeBand(progress(s))
  const yHi = vyToY(hi), yLo = vyToY(lo)
  ctx.fillStyle = 'rgba(55, 224, 160, 0.9)'
  ctx.fillRect(m.x, yHi, m.w, yLo - yHi)
  const my = vyToY(s.vy)
  const inSafe = s.vy >= lo && s.vy <= hi
  ctx.fillStyle = inSafe ? '#fff' : '#ff6b6b'
  ctx.fillRect(m.x - 6, my - 2, m.w + 12, 4)
  ctx.strokeStyle = '#5a4d80'
  ctx.lineWidth = 2
  ctx.strokeRect(m.x, m.y, m.w, m.h)
  ctx.fillStyle = '#8f83b3'
  ctx.font = '9px Orbitron, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('VELOCIDADE', m.x + m.w / 2, m.y + m.h + 14)
  ctx.textAlign = 'start'
}

function draw(s) {
  ctx.fillStyle = '#0a0713'
  ctx.fillRect(0, 0, W, H)

  for (const st of s.stars) {
    ctx.globalAlpha = st.a
    ctx.fillStyle = '#fff'
    ctx.fillRect(st.x, st.y, st.r, st.r)
  }
  ctx.globalAlpha = 1

  const groundY = H - 70
  ctx.fillStyle = '#c9c6d6'
  ctx.fillRect(0, groundY, W, H - groundY)
  ctx.fillStyle = '#b3b0c4'
  for (const c of s.craters) {
    ctx.beginPath(); ctx.arc(c.x, groundY + 18, c.r, Math.PI, 0); ctx.fill()
  }

  const t = 1 - Math.min(1, s.alt / START_ALT)
  const shipY = 60 + t * (groundY - 130)
  if (stage.value === 'crashed') {
    const cx = W / 2, cy = groundY - 20
    ctx.fillStyle = '#ff8a1a'
    ctx.beginPath(); ctx.arc(cx, cy, s.boom, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe14d'
    ctx.beginPath(); ctx.arc(cx, cy, s.boom * 0.6, 0, Math.PI * 2); ctx.fill()
  } else {
    drawShip(ctx, W / 2 - 16, shipY, 32, 40, props.loadout, s.flamePulse > 0 ? 300 : 0)
  }

  if (stage.value === 'descent') {
    const cx = W / 2, cy = 40
    const d = beatDist(s)
    const ringR = 8 + d * 44
    ctx.strokeStyle = '#9b7bff'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = s.beatFlash > 0 ? '#ffe14d' : '#5a4d80'
    ctx.lineWidth = s.beatFlash > 0 ? 5 : 2
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke()
  }

  drawMeter(s)
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05
  if (stage.value === 'descent' || stage.value === 'crashed') update(dt, state)
  if (state) draw(state)
  raf = requestAnimationFrame(frame)
}

function onDown(e) {
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); held.up = true }
  if (k === 'arrowdown' || k === 's') { e.preventDefault(); held.down = true }
  if (k === 'escape') emit('exit')
}
function onUp(e) {
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'arrowup' || k === 'w') held.up = false
  if (k === 'arrowdown' || k === 's') held.down = false
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  state = newState()
  setThrust(false)   // limpa propulsão que possa vir ligada do jogo
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  raf = requestAnimationFrame(frame)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onDown)
  window.removeEventListener('keyup', onUp)
  setThrust(false)
})
</script>

<template>
  <canvas ref="canvas" :width="W" :height="H" class="ml-canvas"></canvas>

  <div v-if="stage === 'intro'" class="ml-overlay">
    <h2>🌙 Pouso na Lua</h2>
    <p><b>Segure ↑ / Espaço</b> pra frear a descida.<br>
       Mantenha o marcador na <b>faixa verde</b> — ela encolhe perto do chão.</p>
    <p class="ml-keys">↑ / Espaço = frear · ↓ = descer mais rápido · Esc = sair</p>
    <button @click="begin">▶ Iniciar descida</button>
  </div>

  <div v-else-if="stage === 'landed'" class="ml-overlay">
    <h2>🚀 Pouso na Lua!</h2>
    <p>Bônus: <b>🪙 {{ result.coins }}</b></p>
    <button @click="emit('exit')">✔ Concluir</button>
  </div>

  <div v-else-if="stage === 'crashed'" class="ml-overlay">
    <h2>💥 Explodiu!</h2>
    <p>Velocidade alta demais no toque.<br>Segure ↑ pra frear até a faixa verde.</p>
    <button @click="begin">↻ Tentar de novo</button>
  </div>
</template>

<style scoped>
.ml-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  background: #0a0713;
}
.ml-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  padding: 24px;
  background: rgba(10, 7, 19, 0.82);
  border-radius: 12px;
  color: #fff;
  font-family: 'Orbitron', ui-monospace, Consolas, monospace;
}
.ml-overlay h2 { margin: 0; font-size: 1.6rem; text-shadow: 0 0 12px rgba(155, 123, 255, 0.65); }
.ml-overlay p { margin: 0; color: #c9c1e6; line-height: 1.5; }
.ml-keys { font-size: 0.8rem; color: #8f83b3; }
.ml-overlay button {
  margin-top: 6px;
  padding: 10px 22px;
  font: inherit;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(160deg, #6a4fd0, #3a2a6a);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 10px;
  cursor: pointer;
}
.ml-overlay button:hover { filter: brightness(1.15); }
</style>
