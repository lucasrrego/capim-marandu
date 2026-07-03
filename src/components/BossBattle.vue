<script setup>
// Boss no meio do percurso — batalha estilo 1942.
// A nave inimiga oscila no topo, atira tiros retos e solta mini-bombas que
// perseguem o jogador. O jogador (a nave montada) atira pra cima até zerar o HP.
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { buildShipStats, drawShip } from '../data/shipParts.js'

const props = defineProps({
  loadout: { type: Object, required: true },
  width: { type: Number, default: 480 },
  height: { type: Number, default: 640 },
  short: { type: Boolean, default: false },   // corrida curta → chefe com 1/3 do HP
})
const emit = defineEmits(['cleared', 'failed', 'hp'])

// ---- Tuning -------------------------------------------------------------
const BOSS_HP = 120
const BOSS_W = 120
const BOSS_H = 74
const BOSS_Y = 96
const BOSS_AMP = 150            // amplitude do vaivém horizontal
const BOSS_SPEED = 1.1         // velocidade angular do vaivém
const SHOOT_CD = 1100          // ms entre rajadas retas
const BOMB_CD = 1500           // ms entre lançamentos de mini-bombas
const ENEMY_BULLET_SPD = 210
const BOMB_SPD = 150
const BOMB_HOMING = 1.4        // quão forte a bomba corrige rumo ao player
const PLAYER_SPD = 250
const HIT_INVULN = 900         // ms de invuln após levar dano
const REWARD = 60              // moedas ao vencer

const W = props.width
const H = props.height
const stats = buildShipStats(props.loadout)
const MAX_HP = props.short ? 12 : BOSS_HP   // teste: chefe morre rápido

const PW = 30
const PH = 36

const bossHpPct = ref(100)
const playerHp = ref(3 + stats.shield)
const result = ref(null)       // null | 'win' | 'lose'

// HP do jogador no chefe é mostrado na barra lateral (VIDAS), não no topo
watch(playerHp, (v) => emit('hp', v))

const canvas = ref(null)
let ctx = null
let raf = 0
let last = 0
const keys = {}
let pointerX = null            // se pressionado, a nave persegue este x

let s = null

function rand(a, b) { return a + Math.random() * (b - a) }

function newState() {
  return {
    time: 0,
    boss: { x: W / 2, hp: MAX_HP, shootCd: SHOOT_CD, bombCd: BOMB_CD, flash: 0 },
    player: { x: W / 2 - PW / 2, y: H - 110, invuln: 0, fireCd: 0 },
    bullets: [],       // tiros do jogador (sobem)
    ebullets: [],      // tiros retos do boss (descem)
    bombs: [],         // mini-bombas perseguidoras
    particles: [],
  }
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function boom(x, y, color, n = 18) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2)
    const spd = rand(40, 200)
    const dur = rand(0.4, 0.9)
    s.particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, t: dur, dur, size: rand(1.5, 3.5), c: color })
  }
}

function firePlayer() {
  const p = s.player
  s.bullets.push({
    x: p.x + PW / 2 - stats.bulletW / 2,
    y: p.y - 6,
    w: stats.bulletW,
    h: stats.bulletH,
    dmg: stats.damage,
  })
}

function bossRect() {
  const b = s.boss
  return { x: b.x - BOSS_W / 2, y: BOSS_Y - BOSS_H / 2, w: BOSS_W, h: BOSS_H }
}

function shootStraight() {
  const b = s.boss
  const cx = b.x
  const cy = BOSS_Y + BOSS_H / 2
  for (const dx of [-0.35, 0, 0.35]) {
    s.ebullets.push({ x: cx - 3, y: cy, w: 6, h: 12, vx: dx * ENEMY_BULLET_SPD, vy: ENEMY_BULLET_SPD })
  }
}

function launchBombs() {
  const b = s.boss
  const n = 1 + Math.floor(rand(0, 2))   // 1 ou 2 bombas
  for (let i = 0; i < n; i++) {
    s.bombs.push({ x: b.x + rand(-30, 30), y: BOSS_Y + BOSS_H / 2, w: 12, h: 12, vx: rand(-40, 40), vy: BOMB_SPD * 0.6 })
  }
}

function update(dt) {
  if (result.value) { updateParticles(dt); return }
  s.time += dt
  const b = s.boss
  const p = s.player

  // boss vaivém
  b.x = W / 2 + Math.sin(s.time * BOSS_SPEED) * BOSS_AMP
  if (b.flash > 0) b.flash -= dt * 1000

  // ataques do boss
  b.shootCd -= dt * 1000
  if (b.shootCd <= 0) { shootStraight(); b.shootCd = SHOOT_CD }
  b.bombCd -= dt * 1000
  if (b.bombCd <= 0) { launchBombs(); b.bombCd = BOMB_CD }

  // jogador: teclado + ponteiro
  if (keys.left) p.x -= PLAYER_SPD * dt
  if (keys.right) p.x += PLAYER_SPD * dt
  if (keys.up) p.y -= PLAYER_SPD * dt
  if (keys.down) p.y += PLAYER_SPD * dt
  if (pointerX != null) {
    const target = pointerX - PW / 2
    p.x += Math.max(-PLAYER_SPD * dt, Math.min(PLAYER_SPD * dt, target - p.x))
  }
  p.x = Math.max(2, Math.min(W - PW - 2, p.x))
  p.y = Math.max(H * 0.45, Math.min(H - PH - 8, p.y))
  if (p.invuln > 0) p.invuln -= dt * 1000

  // auto-fogo
  p.fireCd -= dt * 1000
  if (p.fireCd <= 0) { firePlayer(); p.fireCd = stats.fireCd }

  // move projéteis
  for (const bl of s.bullets) bl.y -= 520 * dt
  s.bullets = s.bullets.filter((bl) => bl.y + bl.h > 0)
  for (const eb of s.ebullets) { eb.x += eb.vx * dt; eb.y += eb.vy * dt }
  s.ebullets = s.ebullets.filter((eb) => eb.y < H + 20 && eb.x > -20 && eb.x < W + 20)
  // bombas perseguem o player
  for (const bo of s.bombs) {
    const cx = p.x + PW / 2
    const cy = p.y + PH / 2
    const dx = cx - (bo.x + bo.w / 2)
    const dy = cy - (bo.y + bo.h / 2)
    const d = Math.hypot(dx, dy) || 1
    bo.vx += (dx / d) * BOMB_SPD * BOMB_HOMING * dt
    bo.vy += (dy / d) * BOMB_SPD * BOMB_HOMING * dt
    const sp = Math.hypot(bo.vx, bo.vy) || 1
    bo.vx = (bo.vx / sp) * BOMB_SPD
    bo.vy = (bo.vy / sp) * BOMB_SPD
    bo.x += bo.vx * dt
    bo.y += bo.vy * dt
  }
  s.bombs = s.bombs.filter((bo) => bo.y < H + 30 && bo.y > -30)

  updateParticles(dt)

  // tiros do jogador x boss
  const br = bossRect()
  for (const bl of s.bullets) {
    if (hit(bl, br)) {
      bl.y = -999
      b.hp -= bl.dmg
      b.flash = 90
      boom(bl.x, br.y + br.h, '#ffd24d', 5)
      if (b.hp <= 0) return win()
    }
  }
  s.bullets = s.bullets.filter((bl) => bl.y > -100)
  bossHpPct.value = Math.max(0, Math.round((b.hp / MAX_HP) * 100))

  // dano no player (tiros retos + bombas)
  const pr = { x: p.x + 4, y: p.y + 4, w: PW - 8, h: PH - 8 }
  if (p.invuln <= 0) {
    const struck =
      s.ebullets.find((eb) => hit(eb, pr)) || s.bombs.find((bo) => hit(bo, pr))
    if (struck) {
      s.ebullets = s.ebullets.filter((eb) => eb !== struck)
      s.bombs = s.bombs.filter((bo) => bo !== struck)
      p.invuln = HIT_INVULN
      playerHp.value -= 1
      boom(p.x + PW / 2, p.y + PH / 2, '#ff5230', 16)
      if (playerHp.value <= 0) return lose()
    }
  }
}

function updateParticles(dt) {
  for (const q of s.particles) {
    q.x += q.vx * dt; q.y += q.vy * dt
    const drag = Math.min(1, 2.4 * dt)
    q.vx -= q.vx * drag; q.vy -= q.vy * drag
    q.t -= dt
  }
  s.particles = s.particles.filter((q) => q.t > 0)
}

function win() {
  result.value = 'win'
  boom(s.boss.x, BOSS_Y, '#ffcf3a', 40)
  boom(s.boss.x, BOSS_Y, '#ff5230', 40)
}
function lose() {
  result.value = 'lose'
}

// ---- Render -------------------------------------------------------------
function drawBoss() {
  const b = s.boss
  const x = b.x
  ctx.save()
  if (b.flash > 0) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(s.time * 40) }
  // casco
  ctx.fillStyle = '#7a2f9c'
  ctx.beginPath()
  ctx.moveTo(x, BOSS_Y - BOSS_H / 2)
  ctx.lineTo(x + BOSS_W / 2, BOSS_Y)
  ctx.lineTo(x + BOSS_W / 2.6, BOSS_Y + BOSS_H / 2)
  ctx.lineTo(x - BOSS_W / 2.6, BOSS_Y + BOSS_H / 2)
  ctx.lineTo(x - BOSS_W / 2, BOSS_Y)
  ctx.closePath()
  ctx.fill()
  // núcleo
  ctx.fillStyle = '#d24dff'
  ctx.beginPath(); ctx.arc(x, BOSS_Y, 16, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffe1ff'
  ctx.beginPath(); ctx.arc(x - 4, BOSS_Y - 4, 6, 0, Math.PI * 2); ctx.fill()
  // canhões
  ctx.fillStyle = '#4a1f66'
  ctx.fillRect(x - BOSS_W / 2.6 - 6, BOSS_Y + 2, 12, 20)
  ctx.fillRect(x + BOSS_W / 2.6 - 6, BOSS_Y + 2, 12, 20)
  ctx.restore()
}

function draw() {
  ctx.clearRect(0, 0, W, H)
  // fundo espacial
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1a0f2e'); g.addColorStop(1, '#0a0716')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % W
    const sy = (i * 149 + (s.time * 40) % H) % H
    ctx.fillRect(sx, sy, 1.5, 1.5)
  }

  drawBoss()

  // tiros do jogador
  ctx.fillStyle = stats.bulletColor
  for (const bl of s.bullets) ctx.fillRect(bl.x, bl.y, bl.w, bl.h)

  // tiros retos do boss
  ctx.fillStyle = '#ff6bd0'
  for (const eb of s.ebullets) ctx.fillRect(eb.x, eb.y, eb.w, eb.h)

  // mini-bombas
  for (const bo of s.bombs) {
    ctx.save()
    ctx.shadowColor = '#ff8a1a'; ctx.shadowBlur = 8
    ctx.fillStyle = '#ff5230'
    ctx.beginPath(); ctx.arc(bo.x + bo.w / 2, bo.y + bo.h / 2, bo.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffd24d'
    ctx.beginPath(); ctx.arc(bo.x + bo.w / 2, bo.y + bo.h / 2, bo.w / 4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // player (pisca durante invuln)
  const p = s.player
  const blink = p.invuln > 0 && Math.floor(s.time * 12) % 2 === 0
  if (!blink) drawShip(ctx, p.x, p.y, PW, PH, props.loadout, s.time * 1000)

  // partículas
  for (const q of s.particles) {
    ctx.globalAlpha = Math.max(0, q.t / q.dur)
    ctx.fillStyle = q.c
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05
  update(dt)
  draw()
  raf = requestAnimationFrame(frame)
}

// ---- Input --------------------------------------------------------------
function onKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault()
  if (k === 'arrowleft' || k === 'a') keys.left = down
  if (k === 'arrowright' || k === 'd') keys.right = down
  if (k === 'arrowup' || k === 'w') keys.up = down
  if (k === 'arrowdown' || k === 's') keys.down = down
}
const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

function onPointer(e, down) {
  if (down === false) { pointerX = null; return }
  const rect = canvas.value.getBoundingClientRect()
  pointerX = ((e.clientX - rect.left) / rect.width) * W
}

function finish() {
  if (result.value === 'win') emit('cleared', REWARD)
  else emit('failed')
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  s = newState()
  emit('hp', playerHp.value)   // valor inicial pra barra lateral
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  raf = requestAnimationFrame(frame)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', kd)
  window.removeEventListener('keyup', ku)
})
</script>

<template>
  <div class="boss">
    <canvas
      ref="canvas"
      :width="W"
      :height="H"
      class="boss-canvas"
      @pointerdown="onPointer($event, true)"
      @pointermove="pointerX != null && onPointer($event, true)"
      @pointerup="onPointer($event, false)"
      @pointerleave="onPointer($event, false)"
    ></canvas>

    <div class="boss-hud">
      <span class="boss-label">CHEFE</span>
      <div class="boss-bar"><div class="boss-bar-fill" :style="{ width: bossHpPct + '%' }"></div></div>
    </div>

    <div v-if="result === 'win'" class="boss-overlay">
      <h2>🔥 Chefe destruído!</h2>
      <p>Caminho livre. +{{ REWARD }} 🪙</p>
      <button @click="finish">▶ Continuar</button>
    </div>
    <div v-else-if="result === 'lose'" class="boss-overlay">
      <h2>💥 Você caiu!</h2>
      <p>O chefe te pegou...</p>
      <button @click="finish">↻ Fim da corrida</button>
    </div>
  </div>
</template>

<style scoped>
.boss {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #0a0716;
  touch-action: none;
  user-select: none;
}
.boss-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.boss-hud {
  position: absolute;
  top: 8px;
  left: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
}
.boss-label {
  font-size: 0.6rem;
  color: #ff6bd0;
  text-shadow: 0 0 8px rgba(255, 107, 208, 0.7);
}
.boss-bar {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 107, 208, 0.5);
  border-radius: 6px;
  overflow: hidden;
}
.boss-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #d24dff, #ff6bd0);
  transition: width 0.1s linear;
}
.boss-hearts {
  font-size: 0.9rem;
  letter-spacing: 1px;
}
.boss-overlay {
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
  padding: 20px;
}
.boss-overlay h2 { margin: 0; font-size: 1.6rem; }
.boss-overlay p { margin: 0; }
.boss-overlay button {
  padding: 12px 26px;
  font-size: 1.05rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  background: var(--accent, #aa3bff);
  color: #fff;
  cursor: pointer;
}
</style>
