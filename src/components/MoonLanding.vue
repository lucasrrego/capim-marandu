<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { DEFAULT_LOADOUT, drawShip } from '../data/shipParts.js'

// Clímax do jogo: pousar na Lua.
//  - VERTICAL: SEGURA ↑/Espaço pra frear (gasta combustível; no ritmo = freio extra),
//    ↓ pra descer mais rápido. Barra verde (direita) = faixa de velocidade segura.
//  - LATERAL: ← / → movem a nave. Precisa pousar sobre a PLATAFORMA.
//  - No chão, pouso OK exige: velocidade na faixa + nave sobre a plataforma + sem
//    impacto lateral. Fora de qualquer um → explode.
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

// ---- Controle lateral / plataforma (tunáveis) ----
const SHIP_W = 32            // largura desenhada da nave
const SHIP_H = 40
const MOVE_ACCEL = 320       // aceleração lateral ao segurar ← / → (px/s²)
const VX_DAMP = 1.9          // atrito lateral (por segundo)
const MAX_VX = 150           // velocidade lateral máxima
const VX_SAFE = 28           // |vx| máximo no toque (senão tomba de lado)
const PAD_W = 84             // largura da plataforma de pouso
const GROUND_Y = H - 70      // topo do solo

// ---- Times Square da Lua (Elon comprou e encheu de outdoor) ----
// Paleta neon do design system (--px-*).
const NEON = ['#9b7bff', '#6cc6ff', '#d0392e', '#ffd24d', '#6fcf5b', '#ff8a1a', '#ff6ea8']
// Propagandas: história do Gugu/ET Bilu + aleatoriedades cafonas.
const ADS = [
  ['ET BILU', 'ESTEVE', 'AQUI'],
  ['FOGUETES', 'DO GUGU'],
  ['TERNO', 'BRILHANTE'],
  ['GANHE', 'PREMIOS!'],
  ['TERRA', 'TOUR 2X'],
  ['LUA by', 'ELON'],
  ['X BURGER', '1 CRED'],
  ['COMPRE', 'DOGE'],
  ['MARTE', '-50%'],
  ['WIFI', 'GRATIS'],
  ['OUTLET', 'ESPACIAL'],
  ['CACHORRO', 'QUENTE'],
  ['SEU AD', 'AQUI'],
]

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
const held = { up: false, down: false, left: false, right: false }

function rand(a, b) { return a + Math.random() * (b - a) }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function newState() {
  const craters = []
  for (let i = 0; i < 7; i++) craters.push({ x: rand(30, W - 60), r: rand(10, 26) })
  const stars = []
  for (let i = 0; i < 80; i++) stars.push({ x: rand(0, W), y: rand(0, H * 0.75), r: rand(0.4, 1.6), a: rand(0.2, 0.8) })
  // plataforma longe do centro pra obrigar deslocamento lateral
  const margin = PAD_W / 2 + 24
  let padCx = rand(margin, W - margin)
  if (Math.abs(padCx - W / 2) < 90) padCx = padCx < W / 2 ? margin : W - margin
  // skyline de outdoors (Times Square): prédios com telão neon
  const buildings = []
  const nb = 6
  const bw = W / nb
  const adPool = [...ADS]
  for (let i = 0; i < nb; i++) {
    const ads = []
    for (let j = 0; j < 3 && adPool.length; j++) {
      ads.push(adPool.splice(Math.floor(rand(0, adPool.length)), 1)[0])
    }
    buildings.push({
      i,
      x: i * bw + 3,
      w: bw - 6,
      h: rand(90, 210),
      color: NEON[i % NEON.length],
      ads: ads.length ? ads : [ADS[i % ADS.length]],
    })
  }
  return {
    alt: START_ALT,
    vy: START_VY,
    x: W / 2,          // posição horizontal (centro da nave)
    vx: 0,             // velocidade lateral
    fuel: FUEL_MAX,
    clock: 0,          // relógio interno (ms) pro ritmo
    flamePulse: 0,     // ms de chama forte (empuxo ativo)
    beatFlash: 0,      // ms do flash de acerto
    boom: 0,           // raio da explosão (crash)
    pad: { cx: padCx, w: PAD_W },
    buildings,
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
  const { lo, hi } = safeBand(1)
  const shipL = s.x - SHIP_W / 2
  const shipR = s.x + SHIP_W / 2
  const padL = s.pad.cx - s.pad.w / 2
  const padR = s.pad.cx + s.pad.w / 2
  const onPad = shipL >= padL && shipR <= padR
  const vyOk = s.vy >= lo && s.vy <= hi
  const vxOk = Math.abs(s.vx) <= VX_SAFE

  if (onPad && vyOk && vxOk) {
    const coins = 15
    result.value = { coins }
    stage.value = 'landed'
    emit('reward', coins)
  } else {
    result.value = {
      reason: !onPad ? 'Pousou fora da plataforma.'
        : !vyOk ? 'Velocidade de descida alta demais.'
        : 'Impacto lateral — freie o deslize antes de tocar.',
    }
    s.boom = 1
    stage.value = 'crashed'
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
    if (held.up && s.fuel > 0) {
      s.vy -= (BRAKE + (onBeat ? BRAKE_BONUS : 0)) * dt
      s.fuel = Math.max(0, s.fuel - FUEL_RATE * dt)
      s.flamePulse = 120
      if (onBeat) s.beatFlash = 120
    }
    // mergulho ao segurar ↓
    if (held.down) s.vy += DIVE_RATE * dt

    s.vy = Math.max(VY_MIN, Math.min(VY_METER, s.vy))
    s.alt -= s.vy * dt

    // lateral: ← / → com inércia e atrito
    let ax = 0
    if (held.left) ax -= MOVE_ACCEL
    if (held.right) ax += MOVE_ACCEL
    s.vx += ax * dt
    s.vx -= s.vx * VX_DAMP * dt
    s.vx = clamp(s.vx, -MAX_VX, MAX_VX)
    s.x = clamp(s.x + s.vx * dt, SHIP_W / 2, W - SHIP_W / 2)

    emit('fuel', Math.round(s.fuel))
    emit('speed', String(Math.round(s.vy)))
    if (s.alt <= 0) { s.alt = 0; touchdown(s) }
  } else if (stage.value === 'crashed' && s.boom < 60) {
    s.boom += dt * 140
  }
}

// ---- Times Square: prédios com outdoors neon piscando ----
function drawCity(s) {
  const gy = GROUND_Y
  // garland de lâmpadas piscando cruzando o céu
  ctx.save()
  for (let i = 0; i <= 24; i++) {
    const gx = (i / 24) * W
    const gyy = 26 + Math.sin(i * 0.9) * 10
    const on = (Math.floor(s.clock / 180) + i) % 2 === 0
    ctx.fillStyle = on ? NEON[i % NEON.length] : '#2a2142'
    ctx.fillRect(gx - 1, gyy - 1, 3, 3)
  }
  ctx.restore()

  ctx.textAlign = 'center'
  for (const b of s.buildings) {
    const top = gy - b.h
    // prédio
    ctx.fillStyle = '#150f28'
    ctx.fillRect(b.x, top, b.w, b.h)
    ctx.strokeStyle = '#2a2142'
    ctx.lineWidth = 1
    ctx.strokeRect(b.x + 0.5, top + 0.5, b.w - 1, b.h - 1)

    // janelinhas acesas (fileiras)
    for (let wy = top + 44; wy < gy - 6; wy += 12) {
      for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 10) {
        const lit = (Math.floor(s.clock / 400) + wx + wy) % 3 === 0
        ctx.fillStyle = lit ? '#ffe27a' : '#241b3a'
        ctx.fillRect(wx, wy, 4, 5)
      }
    }

    // telão / outdoor
    const scrX = b.x + 5, scrY = top + 6
    const scrW = b.w - 10, scrH = Math.min(58, b.h * 0.42)
    ctx.fillStyle = '#04040a'
    ctx.fillRect(scrX, scrY, scrW, scrH)
    // moldura neon
    ctx.strokeStyle = b.color
    ctx.lineWidth = 2
    ctx.strokeRect(scrX + 1, scrY + 1, scrW - 2, scrH - 2)
    // lâmpadas correndo na moldura (marquee)
    for (let m = 0; m < scrW; m += 8) {
      const on = (Math.floor(s.clock / 120) + m) % 2 === 0
      ctx.fillStyle = on ? '#ffe27a' : '#3a2a6a'
      ctx.fillRect(scrX + m, scrY - 2, 3, 3)
      ctx.fillRect(scrX + m, scrY + scrH - 1, 3, 3)
    }
    // texto da propaganda (troca sozinho = cafona)
    const ad = b.ads[Math.floor(s.clock / 1500 + b.i) % b.ads.length]
    ctx.fillStyle = b.color
    ctx.font = 'bold 8px "Press Start 2P", monospace'
    const lh = 11
    const ty = scrY + scrH / 2 - ((ad.length - 1) * lh) / 2 + 3
    for (let li = 0; li < ad.length; li++) {
      ctx.fillText(ad[li], scrX + scrW / 2, ty + li * lh)
    }
  }
  ctx.textAlign = 'start'
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

  const groundY = GROUND_Y
  ctx.fillStyle = '#c9c6d6'
  ctx.fillRect(0, groundY, W, H - groundY)
  ctx.fillStyle = '#b3b0c4'
  for (const c of s.craters) {
    ctx.beginPath(); ctx.arc(c.x, groundY + 18, c.r, Math.PI, 0); ctx.fill()
  }

  // Times Square: skyline de outdoors neon (atrás da nave/plataforma)
  drawCity(s)

  // plataforma de pouso
  const pad = s.pad
  const padL = pad.cx - pad.w / 2
  ctx.fillStyle = '#37e0a0'
  ctx.fillRect(padL, groundY - 6, pad.w, 7)
  // faixas de sinalização
  ctx.fillStyle = '#0a0713'
  for (let i = 0; i < 5; i++) ctx.fillRect(padL + 6 + i * (pad.w - 12) / 5, groundY - 5, 4, 5)
  // beacons piscando nas pontas
  const blink = Math.sin(s.clock / 200) > 0
  ctx.fillStyle = blink ? '#ffe14d' : '#5a4d80'
  for (const bx of [padL, padL + pad.w]) {
    ctx.beginPath(); ctx.arc(bx, groundY - 8, 3, 0, Math.PI * 2); ctx.fill()
  }

  const t = 1 - Math.min(1, s.alt / START_ALT)
  // no toque (t=1) a base da nave encosta no topo da plataforma (groundY - 6)
  const shipY = 60 + t * (groundY - 6 - SHIP_H - 60)

  // guia vertical de alinhamento (fica verde quando a nave está sobre a plataforma)
  if (stage.value === 'descent') {
    const aligned = (s.x - SHIP_W / 2) >= padL && (s.x + SHIP_W / 2) <= padL + pad.w
    ctx.save()
    ctx.setLineDash([4, 6])
    ctx.strokeStyle = aligned ? 'rgba(55,224,160,0.7)' : 'rgba(155,123,255,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(pad.cx, shipY + SHIP_H); ctx.lineTo(pad.cx, groundY - 6); ctx.stroke()
    ctx.restore()
  }

  if (stage.value === 'crashed') {
    const cx = s.x, cy = groundY - 20
    ctx.fillStyle = '#ff8a1a'
    ctx.beginPath(); ctx.arc(cx, cy, s.boom, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe14d'
    ctx.beginPath(); ctx.arc(cx, cy, s.boom * 0.6, 0, Math.PI * 2); ctx.fill()
  } else {
    drawShip(ctx, s.x - SHIP_W / 2, shipY, SHIP_W, SHIP_H, props.loadout, s.flamePulse > 0 ? 300 : 0)
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
  if (k === 'arrowleft' || k === 'a') { e.preventDefault(); held.left = true }
  if (k === 'arrowright' || k === 'd') { e.preventDefault(); held.right = true }
  if (k === 'escape') emit('exit')
}
function onUp(e) {
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'arrowup' || k === 'w') held.up = false
  if (k === 'arrowdown' || k === 's') held.down = false
  if (k === 'arrowleft' || k === 'a') held.left = false
  if (k === 'arrowright' || k === 'd') held.right = false
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  state = newState()
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  raf = requestAnimationFrame(frame)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onDown)
  window.removeEventListener('keyup', onUp)
})
</script>

<template>
  <canvas ref="canvas" :width="W" :height="H" class="ml-canvas"></canvas>

  <div v-if="stage === 'intro'" class="ml-overlay">
    <h2>🌙 Pouso na Lua</h2>
    <p><b>Segure ↑ / Espaço</b> pra frear a descida e <b>← / →</b> pra alinhar.<br>
       Pouse sobre a <b>plataforma</b> com o marcador na <b>faixa verde</b>.</p>
    <p class="ml-keys">↑/Espaço = frear · ↓ = acelerar · ← → = mover · Esc = sair</p>
    <button @click="begin">▶ Iniciar descida</button>
  </div>

  <div v-else-if="stage === 'landed'" class="ml-overlay">
    <h2>🚀 Pouso na Lua!</h2>
    <p>Bônus: <b>🪙 {{ result.coins }}</b></p>
    <button @click="emit('exit')">✔ Concluir</button>
  </div>

  <div v-else-if="stage === 'crashed'" class="ml-overlay">
    <h2>💥 Explodiu!</h2>
    <p>{{ result?.reason }}</p>
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
