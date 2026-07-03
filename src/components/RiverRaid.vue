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

const keys = {}

function rand(a, b) { return a + Math.random() * (b - a) }

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
  const stars = []
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.4, 1.5),      // raio
      a: rand(0.15, 0.7),     // opacidade base
      p: rand(0.45, 1),       // fator de parallax (profundidade)
      ph: rand(0, 6.28),      // fase do brilho
    })
  }
  return {
    gen, rows, stars,
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
  else if (roll < 0.62) type = 'asteroid'
  else type = 'meteor'
  const w = type === 'fuel' ? 26 : type === 'asteroid' ? 40 : 30
  const h = type === 'fuel' ? 30 : type === 'asteroid' ? 36 : 28
  const lo = top.left + 6
  const hi = top.right - w - 6
  const x = hi > lo ? rand(lo, hi) : (top.left + top.right) / 2 - w / 2
  const vx = type === 'fuel' ? 0 : rand(40, 95) * (Math.random() < 0.5 ? -1 : 1)
  const spin = type === 'asteroid' ? rand(-2, 2) : 0
  s.enemies.push({ type, x, y: -h - 4, w, h, vx, spin, rot: 0, alive: true })
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

  // estrelas de fundo (parallax + reciclagem)
  for (const st of s.stars) {
    st.y += move * st.p
    if (st.y > H + 2) { st.y -= H + 4; st.x = rand(0, W) }
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
    if (e.spin) e.rot += e.spin * dt
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
        s.score += e.type === 'asteroid' ? 60 : e.type === 'meteor' ? 90 : 40
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
  // terra (superfície lunar)
  ctx.fillStyle = '#e8e8ec'
  ctx.fillRect(0, 0, W, H)

  // rio / vazio do espaço (trapézios entre faixas)
  const rows = [...s.rows].sort((a, b) => a.y - b.y)
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(rows[0].left, rows[0].y)
  for (let i = 0; i < rows.length; i++) ctx.lineTo(rows[i].left, rows[i].y + ROW_H)
  for (let i = rows.length - 1; i >= 0; i--) ctx.lineTo(rows[i].right, rows[i].y + ROW_H)
  ctx.lineTo(rows[0].right, rows[0].y)
  ctx.closePath()
  ctx.fill()

  // linha de margem
  ctx.strokeStyle = '#a8a8b0'
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

  // estrelas de fundo (só dentro do caminho preto)
  ctx.fillStyle = '#ffffff'
  for (const st of s.stars) {
    const band = bankAt(s, st.y)
    if (st.x < band.left + 2 || st.x > band.right - 2) continue
    const tw = 0.55 + 0.45 * Math.sin(s.time / 380 + st.ph)
    ctx.globalAlpha = st.a * tw
    ctx.beginPath()
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

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
    } else if (e.type === 'asteroid') {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2
      const rx = e.w / 2, ry = e.h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(e.rot)
      const pts = [[0, -1], [0.68, -0.72], [1, -0.02], [0.62, 0.7],
                   [0.05, 1], [-0.66, 0.74], [-1, 0.08], [-0.72, -0.66]]
      ctx.fillStyle = '#8b8b93'
      ctx.beginPath()
      pts.forEach(([px, py], i) => {
        const X = px * rx, Y = py * ry
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y)
      })
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#5c5c64'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#5f5f67'
      ctx.beginPath(); ctx.arc(-rx * 0.25, -ry * 0.12, rx * 0.22, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(rx * 0.3, ry * 0.28, rx * 0.16, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(rx * 0.18, -ry * 0.5, rx * 0.12, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    } else {
      // meteoro
      const cx = e.x + e.w / 2, cy = e.y + e.h * 0.55
      const flick = 1 + 0.25 * Math.sin(s.time / 60 + e.x)
      ctx.fillStyle = 'rgba(255,120,30,0.30)'
      ctx.beginPath()
      ctx.moveTo(cx - e.w * 0.34, cy)
      ctx.lineTo(cx + e.w * 0.34, cy)
      ctx.lineTo(cx, e.y - e.h * 0.9 * flick)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(255,215,80,0.5)'
      ctx.beginPath()
      ctx.moveTo(cx - e.w * 0.17, cy)
      ctx.lineTo(cx + e.w * 0.17, cy)
      ctx.lineTo(cx, e.y - e.h * 0.35 * flick)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#ff8a1a'
      ctx.beginPath(); ctx.arc(cx, cy, e.w * 0.44, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#6b4636'
      ctx.beginPath(); ctx.arc(cx, cy, e.w * 0.32, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffd24d'
      ctx.beginPath(); ctx.arc(cx - e.w * 0.1, cy - e.h * 0.1, e.w * 0.1, 0, Math.PI * 2); ctx.fill()
    }
  }

  // tiros
  ctx.fillStyle = '#ffe14d'
  for (const b of s.bullets) ctx.fillRect(b.x, b.y, b.w, b.h)

  // jogador (foguete)
  const p = s.player
  const blink = s.invuln > 0 && Math.floor(s.time / 120) % 2 === 0
  if (!blink) {
    const cx = p.x + p.w / 2
    const top = p.y
    const bw = 7 // meia-largura do corpo

    // chama (animada, atrás do foguete)
    const fl = 8 + (Math.floor(s.time / 70) % 3) * 4
    ctx.fillStyle = '#ff8a1a'
    ctx.beginPath()
    ctx.moveTo(cx - 5, top + p.h - 2)
    ctx.lineTo(cx + 5, top + p.h - 2)
    ctx.lineTo(cx, top + p.h + fl)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffe14d'
    ctx.beginPath()
    ctx.moveTo(cx - 2.5, top + p.h - 2)
    ctx.lineTo(cx + 2.5, top + p.h - 2)
    ctx.lineTo(cx, top + p.h + fl * 0.55)
    ctx.closePath()
    ctx.fill()

    // aletas
    ctx.fillStyle = '#c9403a'
    ctx.beginPath()
    ctx.moveTo(cx - bw, top + p.h - 12)
    ctx.lineTo(cx - bw - 6, top + p.h - 1)
    ctx.lineTo(cx - bw, top + p.h - 3)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx + bw, top + p.h - 12)
    ctx.lineTo(cx + bw + 6, top + p.h - 1)
    ctx.lineTo(cx + bw, top + p.h - 3)
    ctx.closePath()
    ctx.fill()

    // corpo
    ctx.fillStyle = '#f4f4f4'
    ctx.fillRect(cx - bw, top + 9, bw * 2, p.h - 12)
    // bico
    ctx.fillStyle = '#c9403a'
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.lineTo(cx - bw, top + 10)
    ctx.lineTo(cx + bw, top + 10)
    ctx.closePath()
    ctx.fill()
    // escotilha
    ctx.fillStyle = '#1a6fb0'
    ctx.beginPath()
    ctx.arc(cx, top + 17, 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#8fd0f5'
    ctx.beginPath()
    ctx.arc(cx - 1, top + 16, 1.3, 0, Math.PI * 2)
    ctx.fill()
    // bocal
    ctx.fillStyle = '#555'
    ctx.fillRect(cx - 4, top + p.h - 4, 8, 3)
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
        <p>Pilote o foguete, desvie das margens,<br>destrua asteroides e meteoros, reabasteça no <b>F</b>.</p>
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
  /* largura do jogo limitada por largura E altura da tela, mantendo 480x640 */
  --gw: min(92vw, 480px, (100dvh - 190px) * 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
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
  width: var(--gw);
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
  width: var(--gw);
  aspect-ratio: 480 / 640;
}
.rr-stage canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  background: #e8e8ec;
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
