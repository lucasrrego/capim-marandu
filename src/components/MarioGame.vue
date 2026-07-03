<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  drawSprite, spriteSize,
  GUGU, ALIEN_WALKER, SATELLITE, PLAYER_STAR,
} from '../data/pixelSprites.js'
import { resume, playBlip, playSparkle, playExplosion, playDodge } from '../audio/sfx.js'

const props = defineProps({
  segment: { type: Number, default: 1 },
  color: { type: String, default: '#ff4d4d' },
  loadout: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['earn', 'back'])

// ============================================================================
//  CALIBRAÇÃO — mexa só aqui pra ajustar a jogabilidade. Tudo em px/s e s.
//  Tela congelada (uma tela só, sem rolagem) pra testar o feeling do pulo.
// ============================================================================
const TUNING = {
  player: {
    accel: 2000,        // aceleração no chão
    airAccel: 1400,     // aceleração no ar (controle menor, estilo Mario)
    decel: 2600,        // atrito ao soltar a direção
    maxRun: 240,        // velocidade máxima horizontal
    jumpV: 760,         // impulso do pulo (segurar = pulo cheio)
    jumpCut: 280,       // soltar o botão cedo corta a subida pra até isso
    gravity: 2300,      // gravidade
    maxFall: 900,       // velocidade terminal de queda
    coyoteS: 0.09,      // tolerância pra pular logo após sair da borda
    bufferS: 0.12,      // tolerância pra apertar pulo pouco antes de aterrissar
    stompBounce: 430,   // quique ao pisar num inimigo
    invulnS: 1.6,       // invulnerabilidade após levar dano
  },
  enemies: {
    alienSpeed: 55,     // patrulha dos aliens rastejantes
    satSpeed: 1.6,      // rad/s da oscilação do satélite
    satRange: 150,      // amplitude horizontal do voo do satélite
  },
  coinValue: 1,         // moedas ganhas por moeda coletada
  lives: 3,
}
// ============================================================================

const W = 480
const H = 640
const GROUND_TOP = H - 64          // topo do chão

const PLAYER_SCALE = 2
const GUGU_SIZE = spriteSize(GUGU.idle, PLAYER_SCALE)      // 32x34
const ALIEN_SCALE = 3
const ALIEN_SIZE = spriteSize(ALIEN_WALKER, ALIEN_SCALE)   // 36x30
const SAT_SCALE = 2
const SAT_SIZE = spriteSize(SATELLITE, SAT_SCALE)          // 30x16
const NEY_SIZE = spriteSize(PLAYER_STAR, 2)                // 16x30 (deitado: 30x16)

const SPAWN = { x: 36, y: GROUND_TOP - GUGU_SIZE.h }

// ---- Fase congelada (uma tela) -------------------------------------------
// Sólidos: chão + plataformas de tijolo. Tudo estático de propósito.
const SOLIDS = [
  { x: 0, y: GROUND_TOP, w: W, h: 64, ground: true },
  { x: 56, y: 472, w: 128, h: 20 },
  { x: 296, y: 392, w: 128, h: 20 },
  { x: 128, y: 296, w: 160, h: 20 },
]

// Neymar caído no gramado (mesmo craque do minigame da Vó Baiana)
const NEY = { x: 396, y: GROUND_TOP - 16, w: 30, h: 16 }

function makeCoins() {
  const spots = [
    [120, 436], [152, 436],                      // sobre a plataforma 1
    [340, 356], [372, 356],                      // sobre a plataforma 2
    [176, 260], [208, 260], [240, 260],          // sobre a plataforma 3
    [250, GROUND_TOP - 40], [290, GROUND_TOP - 40],  // no chão
  ]
  return spots.map(([x, y]) => ({ x, y, r: 7, taken: false }))
}

function makeEnemies() {
  return [
    // aliens rastejantes (patrulham entre minX e maxX, como goombas)
    { kind: 'alien', x: 200, y: GROUND_TOP - ALIEN_SIZE.h, w: ALIEN_SIZE.w, h: ALIEN_SIZE.h, dir: 1, minX: 90, maxX: W - 60 - ALIEN_SIZE.w, alive: true },
    { kind: 'alien', x: 160, y: 296 - ALIEN_SIZE.h, w: ALIEN_SIZE.w, h: ALIEN_SIZE.h, dir: -1, minX: 132, maxX: 284 - ALIEN_SIZE.w, alive: true },
    // satélite malvado voando em vai-e-vem senoidal
    { kind: 'sat', cx: 240, y: 180, w: SAT_SIZE.w, h: SAT_SIZE.h, x: 240, phase: 0, alive: true },
  ]
}

// ---- Estado reativo (HUD) -------------------------------------------------
const sub = ref('playing')        // 'playing' | 'over'
const coins = ref(0)
const lives = ref(TUNING.lives)

const canvas = ref(null)
let ctx = null
let raf = 0
let last = 0
let game = null

const keys = { left: false, right: false, jump: false }

function newGame() {
  return {
    player: {
      x: SPAWN.x, y: SPAWN.y, w: GUGU_SIZE.w - 6, h: GUGU_SIZE.h,
      vx: 0, vy: 0, face: 1,
      onGround: false, coyote: 0, buffer: 0, jumping: false,
      invuln: 0,
    },
    enemies: makeEnemies(),
    coins: makeCoins(),
    time: 0,
    neyBubble: 0,   // ms restantes do balão do craque caído
  }
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// ---- Física do Gugu (dinâmica de Mario) -----------------------------------
function movePlayer(dt, s) {
  const T = TUNING.player
  const p = s.player

  // horizontal: acelera na direção segurada, atrito quando solta
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
  const accel = p.onGround ? T.accel : T.airAccel
  if (dir !== 0) {
    p.vx += dir * accel * dt
    p.face = dir
  } else if (p.onGround) {
    const dec = T.decel * dt
    if (Math.abs(p.vx) <= dec) p.vx = 0
    else p.vx -= Math.sign(p.vx) * dec
  }
  p.vx = Math.max(-T.maxRun, Math.min(T.maxRun, p.vx))

  // pulo: coyote time + buffer, altura variável segurando o botão
  p.coyote = p.onGround ? T.coyoteS : Math.max(0, p.coyote - dt)
  p.buffer = Math.max(0, p.buffer - dt)
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -T.jumpV
    p.jumping = true
    p.coyote = 0
    p.buffer = 0
    resume()
    playBlip({ notes: [300, 480, 640], type: 'square', gain: 0.22, step: 0.035 })
  }
  if (p.jumping && !keys.jump && p.vy < -T.jumpCut) p.vy = -T.jumpCut

  // gravidade
  p.vy = Math.min(T.maxFall, p.vy + T.gravity * dt)

  // move e resolve colisão eixo a eixo (sólidos são retângulos estáticos)
  p.x += p.vx * dt
  for (const b of SOLIDS) {
    if (!hit(p, b)) continue
    if (p.vx > 0) p.x = b.x - p.w
    else if (p.vx < 0) p.x = b.x + b.w
    p.vx = 0
  }
  p.x = Math.max(0, Math.min(W - p.w, p.x))

  p.onGround = false
  p.y += p.vy * dt
  for (const b of SOLIDS) {
    if (!hit(p, b)) continue
    if (p.vy > 0) {
      p.y = b.y - p.h
      p.vy = 0
      p.onGround = true
      p.jumping = false
    } else if (p.vy < 0) {
      p.y = b.y + b.h
      p.vy = 0
    }
  }
}

function damagePlayer(s) {
  const p = s.player
  if (p.invuln > 0) return
  playExplosion(0.8)
  lives.value--
  if (lives.value <= 0) {
    sub.value = 'over'
    return
  }
  // renasce no início da tela com invulnerabilidade (pisca)
  p.x = SPAWN.x
  p.y = SPAWN.y
  p.vx = 0
  p.vy = 0
  p.invuln = TUNING.player.invulnS
}

function update(dt, s) {
  s.time += dt
  if (s.neyBubble > 0) s.neyBubble -= dt * 1000
  const p = s.player
  if (p.invuln > 0) p.invuln -= dt

  movePlayer(dt, s)

  // inimigos
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (e.kind === 'alien') {
      e.x += e.dir * TUNING.enemies.alienSpeed * dt
      if (e.x < e.minX) { e.x = e.minX; e.dir = 1 }
      if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1 }
    } else {
      e.phase += TUNING.enemies.satSpeed * dt
      e.x = e.cx + Math.sin(e.phase) * TUNING.enemies.satRange - e.w / 2
    }
  }

  // Gugu × inimigos: pisar em cima mata (estilo Mario), encostar do lado dói
  for (const e of s.enemies) {
    if (!e.alive || !hit(p, e)) continue
    const stomp = p.vy > 0 && p.y + p.h - e.y < e.h * 0.6
    if (stomp) {
      e.alive = false
      p.vy = -TUNING.player.stompBounce
      resume()
      playDodge()
    } else {
      damagePlayer(s)
      if (sub.value !== 'playing') return
    }
  }

  // moedas
  for (const c of s.coins) {
    if (c.taken) continue
    const box = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }
    if (hit(p, box)) {
      c.taken = true
      coins.value += TUNING.coinValue
      resume()
      playSparkle()
    }
  }

  // passou perto do craque caído → balãozinho
  if (Math.abs(p.x + p.w / 2 - (NEY.x + NEY.w / 2)) < 70 && s.neyBubble <= 0) {
    s.neyBubble = 2000
  }
}

// ---- Render ----------------------------------------------------------------
function drawBackground(s) {
  // céu espacial (mesma paleta noturna do resto do jogo)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0a0716')
  g.addColorStop(0.6, '#141a2e')
  g.addColorStop(1, '#0d1f14')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // estrelas fixas piscando
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + 31) % W
    const y = (i * 53 + 17) % (GROUND_TOP - 80)
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(s.time * 1.4 + i))
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.globalAlpha = 1
}

function drawBrickBlock(b) {
  if (b.ground) {
    // chão: grama espacial em cima, terra embaixo
    ctx.fillStyle = '#2b8f47'
    ctx.fillRect(b.x, b.y, b.w, 10)
    ctx.fillStyle = '#6b4636'
    ctx.fillRect(b.x, b.y + 10, b.w, b.h - 10)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let x = b.x; x < b.x + b.w; x += 32) {
      for (let y = b.y + 10; y < b.y + b.h; y += 16) {
        const off = ((y - b.y - 10) / 16) % 2 === 1 ? 16 : 0
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.strokeRect(x + off + 0.5, y + 0.5, 32, 16)
      }
    }
    return
  }
  // plataforma: bloco de tijolos roxos
  ctx.fillStyle = '#8e44ad'
  ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  for (let x = b.x; x < b.x + b.w; x += 32) ctx.strokeRect(x + 0.5, b.y + 0.5, 32, b.h)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(b.x, b.y, b.w, 3)
}

function drawCoin(s, c) {
  // moeda girando (escala horizontal senoidal)
  const squash = Math.abs(Math.sin(s.time * 4 + c.x))
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.scale(0.35 + 0.65 * squash, 1)
  ctx.fillStyle = '#ffd24d'
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#b8860b'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function drawNeymar(s) {
  // craque deitado de costas no chão (sprite em pé, rotacionado 90°)
  ctx.save()
  ctx.translate(NEY.x + NEY.w, NEY.y)
  ctx.rotate(Math.PI / 2)
  drawSprite(ctx, 0, 0, PLAYER_STAR, 2)
  ctx.restore()

  if (s.neyBubble > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, s.neyBubble / 300)
    const text = 'AI AI AI...'
    ctx.font = '9px "Press Start 2P", monospace'
    const tw = ctx.measureText(text).width
    const bx = Math.min(NEY.x - 20, W - tw - 24)
    const by = NEY.y - 44
    ctx.fillStyle = '#f4f4f4'
    ctx.fillRect(bx, by, tw + 16, 24)
    ctx.fillStyle = '#12131a'
    ctx.fillRect(bx, by, tw + 16, 2)
    ctx.fillRect(bx, by + 22, tw + 16, 2)
    ctx.fillRect(bx, by, 2, 24)
    ctx.fillRect(bx + tw + 14, by, 2, 24)
    ctx.fillText(text, bx + 8, by + 16)
    ctx.restore()
  }
}

function drawPlayer(s) {
  const p = s.player
  if (p.invuln > 0 && Math.floor(s.time * 10) % 2 === 0) return   // pisca
  const sprite = p.onGround ? GUGU.idle : GUGU.thumbsUp
  ctx.save()
  if (p.face < 0) {
    ctx.translate(p.x + p.w / 2, 0)
    ctx.scale(-1, 1)
    ctx.translate(-(p.x + p.w / 2), 0)
  }
  drawSprite(ctx, p.x + (p.w - GUGU_SIZE.w) / 2, p.y, sprite, PLAYER_SCALE)
  ctx.restore()
}

function drawEnemies(s) {
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (e.kind === 'alien') {
      ctx.save()
      if (e.dir > 0) {
        ctx.translate(e.x + e.w / 2, 0)
        ctx.scale(-1, 1)
        ctx.translate(-(e.x + e.w / 2), 0)
      }
      drawSprite(ctx, e.x, e.y, ALIEN_WALKER, ALIEN_SCALE)
      ctx.restore()
    } else {
      drawSprite(ctx, e.x, e.y, SATELLITE, SAT_SCALE)
      // olhinho vermelho de mau (pisca)
      if (Math.floor(s.time * 3) % 2 === 0) {
        ctx.fillStyle = '#ff4d4d'
        ctx.fillRect(e.x + e.w / 2 - 2, e.y + e.h / 2 - 2, 4, 4)
      }
    }
  }
}

function draw(s) {
  drawBackground(s)
  for (const b of SOLIDS) drawBrickBlock(b)
  for (const c of s.coins) if (!c.taken) drawCoin(s, c)
  drawNeymar(s)
  drawEnemies(s)
  drawPlayer(s)
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05
  if (sub.value === 'playing' && game) {
    update(dt, game)
    draw(game)
  }
  raf = requestAnimationFrame(frame)
}

// ---- Fluxo -----------------------------------------------------------------
function restart() {
  game = newGame()
  coins.value = 0
  lives.value = TUNING.lives
  sub.value = 'playing'
  last = 0
}

function finish() {
  emit('earn', coins.value)
  emit('back')
}

// ---- Input -------------------------------------------------------------
function jumpDown() {
  keys.jump = true
  if (game) game.player.buffer = TUNING.player.bufferS
}

function onKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault()
  if (k === 'arrowleft' || k === 'a') keys.left = down
  if (k === 'arrowright' || k === 'd') keys.right = down
  if (k === ' ' || k === 'arrowup' || k === 'w') {
    if (down && !keys.jump) jumpDown()
    if (!down) keys.jump = false
  }
}
const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

function press(dir, v) {
  if (dir === 'jump') {
    if (v) jumpDown()
    else keys.jump = false
    return
  }
  keys[dir] = v
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  restart()
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
  <div class="mb" :style="{ '--accent': color }">
    <canvas ref="canvas" :width="W" :height="H"></canvas>

    <!-- HUD -->
    <div class="mb-hud">
      <span class="mb-lives"><span v-for="n in lives" :key="n">❤️</span></span>
      <span class="mb-test">TELA DE TESTE</span>
      <span class="mb-coins">🪙 {{ coins }}</span>
    </div>
    <p class="mb-help">← → andar · espaço/↑ pular (segure p/ pulo maior) · pise nos aliens!</p>

    <button class="mb-exit" @click="finish">← Sair</button>

    <!-- Game over -->
    <div v-if="sub === 'over'" class="mb-over">
      <h2>Ih, Gugu... 💀</h2>
      <p>Os aliens venceram dessa vez.</p>
      <button class="mb-btn" @click="restart">↻ Tentar de novo</button>
      <button class="mb-btn mb-btn-alt" @click="finish">← Voltar ao jogo</button>
    </div>

    <!-- Controles touch -->
    <div v-if="sub === 'playing'" class="mb-touch">
      <button @pointerdown.prevent="press('left', true)" @pointerup="press('left', false)"
              @pointerleave="press('left', false)">◀</button>
      <button @pointerdown.prevent="press('right', true)" @pointerup="press('right', false)"
              @pointerleave="press('right', false)">▶</button>
      <button class="jump" @pointerdown.prevent="press('jump', true)" @pointerup="press('jump', false)"
              @pointerleave="press('jump', false)">⬆</button>
    </div>
  </div>
</template>

<style scoped>
.mb {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  user-select: none;
}
.mb canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}

.mb-hud {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #fff;
  text-shadow: 0 2px 0 #000;
  pointer-events: none;
}
.mb-test {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  color: var(--accent, #ff4d4d);
  border: 1px solid var(--accent, #ff4d4d);
  border-radius: 4px;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.35);
}
.mb-coins { color: #ffd24d; }

.mb-help {
  position: absolute;
  top: 36px;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  font-family: 'VT323', monospace;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 2px 0 #000;
  pointer-events: none;
}

.mb-exit {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 8px 14px;
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  color: #fff;
  background: rgba(20, 15, 32, 0.7);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
}
.mb-exit:hover { background: rgba(155, 123, 255, 0.3); }

.mb-over {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  background: rgba(6, 10, 20, 0.78);
  color: #fff;
  padding: 24px;
}
.mb-over h2 {
  margin: 0;
  font-size: 1.2rem;
  text-shadow: 0 0 12px rgba(255, 77, 77, 0.65), 0 3px 0 #7a1f18;
}
.mb-over p { margin: 0; font-family: 'VT323', monospace; font-size: 1.4rem; }

.mb-btn {
  padding: 12px 18px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.8rem;
  color: #fff;
  background: var(--accent, #ff4d4d);
  border: 3px solid rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.mb-btn:hover { filter: brightness(1.12); }
.mb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35); }
.mb-btn-alt { background: rgba(42, 44, 54, 0.9); }

.mb-touch {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  display: flex;
  justify-content: center;
  gap: 10px;
}
.mb-touch button {
  width: 52px;
  height: 52px;
  font-size: 1.3rem;
  border: none;
  border-radius: 8px;
  background: rgba(42, 44, 54, 0.7);
  color: #fff;
  touch-action: none;
  cursor: pointer;
}
.mb-touch button.jump { background: rgba(255, 77, 77, 0.75); margin-left: 12px; }
.mb-touch button:active { filter: brightness(1.4); }
@media (hover: hover) and (pointer: fine) {
  .mb-touch { display: none; }
}
</style>
