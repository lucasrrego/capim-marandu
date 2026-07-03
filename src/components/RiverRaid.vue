<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// ---- Dimensões internas do canvas (o CSS escala mantendo proporção) ----
const W = 480
const H = 640
const ROW_H = 16                     // altura de cada faixa do terreno
const N_ROWS = Math.ceil(H / ROW_H) + 3

// ---- HUD reativo ----
const phase = ref('start')           // 'start' | 'playing' | 'paused' | 'over'
const score = ref(0)
const lives = ref(3)
const fuelPct = ref(100)
const speedLabel = ref('1x')
const coins = ref(0)

const canvas = ref(null)
let ctx = null
let raf = 0
let last = 0
let state = null

// ---- Constantes de jogo ----
const BASE_SPEED = 120               // px/s de rolagem
const MIN_SPEED = 80
const MAX_SPEED = 280
const FUEL_MAX = 100
const MIN_CHANNEL = 96               // largura mínima navegável do rio
const MARGIN = 34                    // margem das margens em relação à borda
const FIRE_CD = 200                  // ms entre tiros
const RESPAWN_INVULN = 1800          // ms de invulnerabilidade após reviver

// ---- Economia (moedas persistidas entre partidas) ----
const COINS_KEY = 'capim-marandu:coins'   // contrato com a branch do Hangar
const COIN_PER_KILL = 1                    // moedas por vilão destruído

const keys = {}

function rand(a, b) { return a + Math.random() * (b - a) }

function loadCoins() {
  coins.value = Number(localStorage.getItem(COINS_KEY)) || 0
}
function addCoins(n) {
  coins.value += n
  localStorage.setItem(COINS_KEY, String(coins.value))
}

// ---- Gerador procedural das margens do rio ----
function makeGen() {
  return { left: W * 0.28, right: W * 0.72, tL: W * 0.28, tR: W * 0.72, steps: 0 }
}
function stepGen(g) {
  if (g.steps <= 0) {
    const width = rand(MIN_CHANNEL, W - 2 * MARGIN)
    const center = rand(MARGIN + width / 2, W - MARGIN - width / 2)
    g.tL = center - width / 2
    g.tR = center + width / 2
    g.steps = Math.floor(rand(8, 26))
  }
  g.left += (g.tL - g.left) * 0.18
  g.right += (g.tR - g.right) * 0.18
  g.steps--
  return { left: g.left, right: g.right }
}

function newState() {
  const gen = makeGen()
  const rows = []
  for (let i = 0; i < N_ROWS; i++) {
    const b = stepGen(gen)
    rows.push({ y: H - i * ROW_H, left: b.left, right: b.right })
  }
  return {
    gen, rows,
    player: { x: W / 2 - 13, y: H - 74, w: 26, h: 32 },
    bullets: [],
    enemies: [],
    speed: BASE_SPEED,
    fuel: FUEL_MAX,
    lives: 3,
    score: 0,
    distance: 0,
    spawnTimer: 1.2,
    lastFire: 0,
    invuln: 0,
    over: false,
    time: 0,
  }
}

// margens interpoladas na altura y
function bankAt(s, y) {
  let best = s.rows[0]
  let bd = Infinity
  for (const r of s.rows) {
    const d = Math.abs(r.y + ROW_H / 2 - y)
    if (d < bd) { bd = d; best = r }
  }
  return best
}

function spawnEnemy(s) {
  const top = s.rows.reduce((a, r) => (r.y < a.y ? r : a), s.rows[0])
  const roll = Math.random()
  let type
  if (roll < 0.25) type = 'fuel'
  else if (roll < 0.68) type = 'ship'
  else type = 'heli'
  const w = type === 'fuel' ? 26 : type === 'ship' ? 44 : 34
  const h = type === 'fuel' ? 30 : type === 'ship' ? 20 : 18
  const lo = top.left + 6
  const hi = top.right - w - 6
  const x = hi > lo ? rand(lo, hi) : (top.left + top.right) / 2 - w / 2
  const vx = type === 'fuel' ? 0 : rand(40, 90) * (Math.random() < 0.5 ? -1 : 1)
  s.enemies.push({ type, x, y: -h - 4, w, h, vx, alive: true })
}

function fire(s) {
  if (s.time - s.lastFire < FIRE_CD) return
  s.lastFire = s.time
  s.bullets.push({ x: s.player.x + s.player.w / 2 - 2, y: s.player.y - 4, w: 4, h: 12 })
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function loseLife(s) {
  s.lives--
  lives.value = s.lives
  if (s.lives <= 0) {
    s.over = true
    phase.value = 'over'
    return
  }
  // reviver
  s.player.x = W / 2 - s.player.w / 2
  s.fuel = FUEL_MAX
  s.invuln = RESPAWN_INVULN
  s.speed = BASE_SPEED
  // limpa inimigos próximos do jogador
  s.enemies = s.enemies.filter((e) => e.y < s.player.y - 160)
}

function update(dt, s) {
  s.time += dt * 1000

  // aceleração / desaceleração
  if (keys.up) s.speed = Math.min(MAX_SPEED, s.speed + 260 * dt)
  else if (keys.down) s.speed = Math.max(MIN_SPEED, s.speed - 260 * dt)
  else s.speed += (BASE_SPEED - s.speed) * Math.min(1, dt * 2)

  const move = s.speed * dt
  s.distance += move

  // rolagem do terreno + reciclagem
  let minY = Infinity
  for (const r of s.rows) { r.y += move; if (r.y < minY) minY = r.y }
  for (const r of s.rows) {
    if (r.y >= H) {
      minY -= ROW_H
      const b = stepGen(s.gen)
      r.y = minY
      r.left = b.left
      r.right = b.right
    }
  }

  // jogador
  const p = s.player
  const pv = 240
  if (keys.left) p.x -= pv * dt
  if (keys.right) p.x += pv * dt
  p.x = Math.max(2, Math.min(W - p.w - 2, p.x))

  // combustível
  s.fuel -= (5 * (s.speed / BASE_SPEED)) * dt
  if (s.invuln > 0) s.invuln -= dt * 1000

  // tiros
  for (const b of s.bullets) b.y -= 520 * dt
  s.bullets = s.bullets.filter((b) => b.y + b.h > 0)

  // inimigos
  for (const e of s.enemies) {
    e.y += move
    if (e.vx) {
      e.x += e.vx * dt
      const band = bankAt(s, e.y + e.h / 2)
      if (e.x < band.left + 4) { e.x = band.left + 4; e.vx *= -1 }
      if (e.x + e.w > band.right - 4) { e.x = band.right - 4 - e.w; e.vx *= -1 }
    }
  }
  s.enemies = s.enemies.filter((e) => e.alive && e.y < H + 40)

  // tiros x inimigos
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.alive && hit(b, e)) {
        e.alive = false
        b.y = -999
        s.score += e.type === 'ship' ? 60 : e.type === 'heli' ? 90 : 40
        if (e.type === 'ship' || e.type === 'heli') addCoins(COIN_PER_KILL)
      }
    }
  }

  // spawn
  s.spawnTimer -= dt
  if (s.spawnTimer <= 0) {
    spawnEnemy(s)
    s.spawnTimer = Math.max(0.55, 1.5 - s.distance / 9000)
  }

  // colisão com margens
  const band = bankAt(s, p.y + p.h / 2)
  const bandT = bankAt(s, p.y + 4)
  if (s.invuln <= 0) {
    if (p.x < band.left || p.x + p.w > band.right ||
        p.x < bandT.left || p.x + p.w > bandT.right) {
      loseLife(s)
    }
  }

  // colisão com inimigos / reabastecimento
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (hit(p, e)) {
      if (e.type === 'fuel') {
        s.fuel = Math.min(FUEL_MAX, s.fuel + 55 * dt)
      } else if (s.invuln <= 0) {
        e.alive = false
        loseLife(s)
      }
    }
  }

  // acabou o combustível
  if (s.fuel <= 0) { s.fuel = 0; loseLife(s) }

  // pontuação por distância
  s.score += move * 0.02

  // sincroniza HUD
  score.value = Math.floor(s.score)
  fuelPct.value = Math.max(0, Math.round((s.fuel / FUEL_MAX) * 100))
  speedLabel.value = (s.speed / BASE_SPEED).toFixed(1) + 'x'
}

// ---- Render ----
function draw(s) {
  // terra
  ctx.fillStyle = '#2f7d3a'
  ctx.fillRect(0, 0, W, H)

  // rio (trapézios entre faixas)
  const rows = [...s.rows].sort((a, b) => a.y - b.y)
  ctx.fillStyle = '#1a6fb0'
  ctx.beginPath()
  ctx.moveTo(rows[0].left, rows[0].y)
  for (let i = 0; i < rows.length; i++) ctx.lineTo(rows[i].left, rows[i].y + ROW_H)
  for (let i = rows.length - 1; i >= 0; i--) ctx.lineTo(rows[i].right, rows[i].y + ROW_H)
  ctx.lineTo(rows[0].right, rows[0].y)
  ctx.closePath()
  ctx.fill()

  // linha de margem
  ctx.strokeStyle = '#8fd694'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < rows.length; i++) {
    const m = i === 0 ? 'moveTo' : 'lineTo'
    ctx[m](rows[i].left, rows[i].y + ROW_H)
  }
  ctx.stroke()
  ctx.beginPath()
  for (let i = 0; i < rows.length; i++) {
    const m = i === 0 ? 'moveTo' : 'lineTo'
    ctx[m](rows[i].right, rows[i].y + ROW_H)
  }
  ctx.stroke()

  // inimigos
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (e.type === 'fuel') {
      ctx.fillStyle = '#12c2c2'
      ctx.fillRect(e.x, e.y, e.w, e.h)
      ctx.fillStyle = '#04343a'
      ctx.font = 'bold 18px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('F', e.x + e.w / 2, e.y + e.h / 2 + 6)
    } else if (e.type === 'ship') {
      ctx.fillStyle = '#c9403a'
      ctx.beginPath()
      ctx.moveTo(e.x, e.y + e.h)
      ctx.lineTo(e.x + e.w, e.y + e.h)
      ctx.lineTo(e.x + e.w - 8, e.y)
      ctx.lineTo(e.x + 8, e.y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#f2d34a'
      ctx.fillRect(e.x + e.w / 2 - 4, e.y - 6, 8, 8)
    } else {
      ctx.fillStyle = '#e88a1a'
      ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h)
      ctx.fillRect(e.x + e.w / 2 - 2, e.y - 5, 4, 5)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(e.x - 2, e.y - 6)
      ctx.lineTo(e.x + e.w + 2, e.y - 6)
      ctx.stroke()
    }
  }

  // tiros
  ctx.fillStyle = '#ffe14d'
  for (const b of s.bullets) ctx.fillRect(b.x, b.y, b.w, b.h)

  // jogador (avião)
  const p = s.player
  const blink = s.invuln > 0 && Math.floor(s.time / 120) % 2 === 0
  if (!blink) {
    ctx.fillStyle = '#f4f4f4'
    // fuselagem
    ctx.beginPath()
    ctx.moveTo(p.x + p.w / 2, p.y)
    ctx.lineTo(p.x + p.w / 2 + 5, p.y + p.h)
    ctx.lineTo(p.x + p.w / 2 - 5, p.y + p.h)
    ctx.closePath()
    ctx.fill()
    // asas
    ctx.fillStyle = '#d8d8d8'
    ctx.fillRect(p.x, p.y + p.h * 0.55, p.w, 7)
    ctx.fillRect(p.x + p.w / 2 - 10, p.y + p.h - 6, 20, 6)
    // chama
    ctx.fillStyle = '#ff8a1a'
    ctx.fillRect(p.x + p.w / 2 - 3, p.y + p.h, 6, 6)
  }
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05

  if (phase.value === 'playing') {
    update(dt, state)
    draw(state)
  }
  raf = requestAnimationFrame(frame)
}

// ---- Controles ----
function startGame() {
  state = newState()
  score.value = 0
  lives.value = 3
  fuelPct.value = 100
  phase.value = 'playing'
  last = 0
}

function togglePause() {
  if (phase.value === 'playing') phase.value = 'paused'
  else if (phase.value === 'paused') { phase.value = 'playing'; last = 0 }
}

function onKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault()
  if (k === 'arrowleft' || k === 'a') keys.left = down
  if (k === 'arrowright' || k === 'd') keys.right = down
  if (k === 'arrowup' || k === 'w') keys.up = down
  if (k === 'arrowdown' || k === 's') keys.down = down
  if (k === ' ' && down && phase.value === 'playing') fire(state)
  if (k === 'p' && down) togglePause()
  if (k === 'enter' && down && (phase.value === 'start' || phase.value === 'over')) startGame()
}

const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

// botões touch
function press(dir, v) {
  if (dir === 'fire') { if (v && phase.value === 'playing') fire(state); return }
  keys[dir] = v
}

let fireHold = null
function holdFire(v) {
  if (v) {
    if (phase.value === 'playing') fire(state)
    fireHold = setInterval(() => { if (phase.value === 'playing') fire(state) }, FIRE_CD)
  } else if (fireHold) { clearInterval(fireHold); fireHold = null }
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  loadCoins()
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  raf = requestAnimationFrame(frame)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', kd)
  window.removeEventListener('keyup', ku)
  if (fireHold) clearInterval(fireHold)
})
</script>

<template>
  <div class="rr">
    <h1 class="rr-title">🚀 River Raid</h1>

    <div class="rr-hud">
      <span>PONTOS <b>{{ score }}</b></span>
      <span>VIDAS <b>{{ '❤️'.repeat(lives) || '—' }}</b></span>
      <span>VEL <b>{{ speedLabel }}</b></span>
      <span>MOEDAS <b>🪙 {{ coins }}</b></span>
    </div>

    <div class="rr-fuel">
      <div class="rr-fuel-bar" :style="{ width: fuelPct + '%' }"
           :class="{ low: fuelPct < 25 }"></div>
      <span class="rr-fuel-label">FUEL</span>
    </div>

    <div class="rr-stage">
      <canvas ref="canvas" :width="W" :height="H"></canvas>

      <div v-if="phase === 'start'" class="rr-overlay">
        <h2>River Raid</h2>
        <p>Pilote o avião, desvie das margens,<br>destrua inimigos e reabasteça no <b>F</b>.</p>
        <p class="rr-keys">← → mover · ↑ ↓ acelerar · Espaço atirar · P pausar</p>
        <button @click="startGame">▶ Jogar</button>
      </div>

      <div v-else-if="phase === 'paused'" class="rr-overlay">
        <h2>Pausado</h2>
        <button @click="togglePause">▶ Continuar</button>
      </div>

      <div v-else-if="phase === 'over'" class="rr-overlay">
        <h2>Fim de jogo</h2>
        <p>Pontuação: <b>{{ score }}</b></p>
        <button @click="startGame">↻ Jogar de novo</button>
      </div>
    </div>

    <div class="rr-touch">
      <button @pointerdown.prevent="press('left', true)" @pointerup="press('left', false)"
              @pointerleave="press('left', false)">◀</button>
      <button @pointerdown.prevent="press('up', true)" @pointerup="press('up', false)"
              @pointerleave="press('up', false)">▲</button>
      <button @pointerdown.prevent="press('down', true)" @pointerup="press('down', false)"
              @pointerleave="press('down', false)">▼</button>
      <button @pointerdown.prevent="press('right', true)" @pointerup="press('right', false)"
              @pointerleave="press('right', false)">▶</button>
      <button class="fire" @pointerdown.prevent="holdFire(true)" @pointerup="holdFire(false)"
              @pointerleave="holdFire(false)">🔥</button>
    </div>
  </div>
</template>

<style scoped>
.rr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  font-family: ui-monospace, Consolas, monospace;
}
.rr-title { margin: 0; font-size: 1.6rem; color: var(--text-h, #111); }
.rr-hud {
  display: flex;
  gap: 22px;
  font-size: 0.95rem;
  letter-spacing: 0.5px;
}
.rr-hud b { color: var(--accent, #aa3bff); }
.rr-fuel {
  position: relative;
  width: min(92vw, 480px);
  height: 18px;
  background: #222;
  border-radius: 4px;
  overflow: hidden;
}
.rr-fuel-bar {
  height: 100%;
  background: linear-gradient(90deg, #12c2c2, #37e0a0);
  transition: width 0.15s linear;
}
.rr-fuel-bar.low { background: linear-gradient(90deg, #ff5252, #ff8a1a); }
.rr-fuel-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}
.rr-stage {
  position: relative;
  width: min(92vw, 480px);
  aspect-ratio: 480 / 640;
}
.rr-stage canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  background: #2f7d3a;
}
.rr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  background: rgba(6, 10, 20, 0.72);
  color: #fff;
  border-radius: 8px;
  padding: 20px;
}
.rr-overlay h2 { margin: 0; font-size: 1.8rem; }
.rr-overlay p { margin: 0; line-height: 1.5; }
.rr-keys { font-size: 0.8rem; opacity: 0.8; }
.rr-overlay button, .rr-touch button {
  cursor: pointer;
  border: none;
  border-radius: 8px;
  font-family: inherit;
}
.rr-overlay button {
  padding: 12px 26px;
  font-size: 1.1rem;
  font-weight: bold;
  background: var(--accent, #aa3bff);
  color: #fff;
}
.rr-touch {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.rr-touch button {
  width: 56px;
  height: 56px;
  font-size: 1.4rem;
  background: #2a2c36;
  color: #fff;
  touch-action: none;
  user-select: none;
}
.rr-touch button.fire { background: #c9403a; margin-left: 14px; }
.rr-touch button:active { filter: brightness(1.4); }
@media (hover: hover) and (pointer: fine) {
  .rr-touch { display: none; }
}
</style>
