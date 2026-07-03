<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  drawSprite, spriteSize,
  PLAYER_BR, PLAYER_JP, PLAYER_STAR, VO_BAIANA,
} from '../data/pixelSprites.js'
import { DEFAULT_LOADOUT, drawShip as drawHangarShip } from '../data/shipParts.js'
import { resume, playClaw, playAbduct, playDodge } from '../audio/sfx.js'

const props = defineProps({
  segment: { type: Number, default: 1 },
  color: { type: String, default: '#37e0a0' },
  loadout: { type: Object, default: () => ({ ...DEFAULT_LOADOUT }) },
})
const emit = defineEmits(['earn', 'back'])

// ============================================================================
//  CALIBRAÇÃO — mexa só aqui pra ajustar o jogo. Tudo em px/s e segundos.
// ============================================================================
const TUNING = {
  claw: {
    descendSpeed: 300,   // quão devagar a garra desce (dificuldade principal)
    ascendSpeed: 240,    // velocidade de recolhimento
    moveSpeed: 160,      // deslocamento horizontal da nave
    width: 20,           // largura da hitbox da garra
  },
  ball: {
    speed: 240,          // velocidade do passe
    holdTimeS: 0.5,      // tempo com a bola antes de passar de novo
    radius: 6,           // raio da bola
  },
  round: { durationS: 30 },              // duração da rodada
  // A recompensa de cada jogador comum é proporcional à sua velocidade sorteada:
  //   coins = max(1, round(speed * coinsPerSpeed))  → mais rápido = mais moedas.
  players: {
    brazil: { color: '#ffd24d', speedRange: [45, 130], coinsPerSpeed: 0.05, count: 4 },
    japan:  { color: '#3a7bff', speedRange: [45, 130], coinsPerSpeed: 0.05, count: 4 },
    special: {                           // o craque do Brasil
      speed: 95,
      coins: 10,
      dodgeChance: 0.6,      // prob. de esquivar quando a garra chega perto
      dodgeDurationS: 0.9,   // tempo deitado no chão
      dodgeCooldownS: 2.2,   // intervalo mínimo entre esquivas
      nearDist: 46,          // distância horizontal que dispara a esquiva
    },
  },
}
// ============================================================================

const W = 480
const H = 640
const GROUND_Y = H - 62           // linha onde os pés dos jogadores ficam
const GRASS_TOP = H - 120         // topo do gramado
const PAD = 30                    // margem lateral do campo
const PLAYER_SCALE = 2
const SHIP_Y = 180                // centro vertical da nave (foguete do hangar)
const SHIP_W = 46                 // largura do foguete desenhado
const SHIP_H = 58                 // altura do foguete desenhado
const CLAW_REST_Y = SHIP_Y + 34   // garra recolhida (logo abaixo do bocal)
const MAX_DROP_Y = GROUND_Y - 4   // até onde a garra desce

// dimensões dos sprites de jogador (todos ~mesmo molde)
const BR = spriteSize(PLAYER_BR, PLAYER_SCALE)

const sub = ref('cutscene')       // 'cutscene' | 'playing' | 'result'
const step = ref(0)
const timeLeft = ref(TUNING.round.durationS)
const coinsRound = ref(0)

const speech = [
  'Ai, minha gente... eu sonhei! E sonhei mais de uma vez, viu?',
  'No jogo do Brasil com o Japão uma nave desceu no campo... e os ET levaram os jogador tudo!',
  'Foram mais de 700 pessoa pra dentro da nave mãe! E ninguém, NINGUÉM tá me levando a sério!',
  'Alguma coisa muito ruim vai acontecer nesse campo de futebol... corre, meu filho!',
]

const canvas = ref(null)
const voCanvas = ref(null)
let ctx = null
let raf = 0
let last = 0

const keys = { left: false, right: false }
let game = null

function rand(a, b) { return a + Math.random() * (b - a) }

// ---- Setup do jogo ------------------------------------------------------
function makePlayer(team) {
  const cfg = TUNING.players
  if (team === 'star') {
    return {
      team, sprite: PLAYER_STAR,
      x: rand(PAD + 20, W - PAD - 20),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: cfg.special.speed,
      coins: cfg.special.coins,
      ducked: false, dodgeTimer: 0, dodgeCd: 0,
    }
  }
  const c = team === 'br' ? cfg.brazil : cfg.japan
  const speed = rand(c.speedRange[0], c.speedRange[1])
  return {
    team,
    sprite: team === 'br' ? PLAYER_BR : PLAYER_JP,
    x: rand(PAD + 20, W - PAD - 20),
    dir: Math.random() < 0.5 ? -1 : 1,
    speed,
    coins: Math.max(1, Math.round(speed * c.coinsPerSpeed)),
    ducked: false, dodgeTimer: 0, dodgeCd: 0,
  }
}

function newGame() {
  const players = []
  for (let i = 0; i < TUNING.players.brazil.count; i++) players.push(makePlayer('br'))
  for (let i = 0; i < TUNING.players.japan.count; i++) players.push(makePlayer('jp'))
  players.push(makePlayer('star'))
  const s = {
    players,
    shipX: W / 2,
    claw: { x: W / 2, tipY: CLAW_REST_Y, state: 'ready', grabbed: null },
    ball: { x: W / 2, target: null, hold: 0 },
    time: 0,
  }
  pickBallTarget(s)
  return s
}

// Escolhe um jogador aleatório (diferente do atual) pra receber o passe.
function pickBallTarget(s) {
  const opts = s.players.filter((p) => p !== s.ball.target)
  const pool = opts.length ? opts : s.players
  s.ball.target = pool[Math.floor(rand(0, pool.length))] || null
}

function tryDrop() {
  if (sub.value !== 'playing' || !game) return
  if (game.claw.state === 'ready') {
    game.claw.state = 'drop'
    resume()
    playClaw()
  }
}

// ---- Update -------------------------------------------------------------
function playerHeight() { return BR.h }   // molde igual pra todos

function update(dt, s) {
  s.time += dt

  timeLeft.value -= dt
  if (timeLeft.value <= 0) {
    timeLeft.value = 0
    sub.value = 'result'
    return
  }

  // nave (jogador move na horizontal)
  const mv = TUNING.claw.moveSpeed * dt
  if (keys.left) s.shipX -= mv
  if (keys.right) s.shipX += mv
  s.shipX = Math.max(PAD, Math.min(W - PAD, s.shipX))
  s.claw.x = s.shipX

  // jogadores andando (parados enquanto deitados)
  for (const pl of s.players) {
    if (pl.dodgeCd > 0) pl.dodgeCd -= dt
    if (pl.ducked) {
      pl.dodgeTimer -= dt
      if (pl.dodgeTimer <= 0) pl.ducked = false
      continue
    }
    pl.x += pl.dir * pl.speed * dt
    if (pl.x < PAD + BR.w / 2) { pl.x = PAD + BR.w / 2; pl.dir = 1 }
    if (pl.x > W - PAD - BR.w / 2) { pl.x = W - PAD - BR.w / 2; pl.dir = -1 }
  }

  // habilidade do craque: se joga no chão quando a garra chega perto
  const sp = TUNING.players.special
  for (const pl of s.players) {
    if (pl.team !== 'star' || pl.ducked || pl.dodgeCd > 0) continue
    const clawDescending = s.claw.state === 'drop' && s.claw.tipY > CLAW_REST_Y + 8
    if (clawDescending && Math.abs(pl.x - s.claw.x) <= sp.nearDist) {
      if (Math.random() < sp.dodgeChance) {
        pl.ducked = true
        pl.dodgeTimer = sp.dodgeDurationS
        pl.dodgeCd = sp.dodgeCooldownS
        resume()
        playDodge()
      } else {
        pl.dodgeCd = 0.4   // erra a rolagem mas tenta de novo em breve
      }
    }
  }

  // bola sendo passada aleatoriamente entre os jogadores
  const b = s.ball
  if (!b.target || !s.players.includes(b.target)) { b.hold = 0; pickBallTarget(s) }
  if (b.target) {
    if (b.hold > 0) {
      b.hold -= dt
      b.x += (b.target.x - b.x) * Math.min(1, dt * 12)   // fica junto de quem tem a bola
      if (b.hold <= 0) pickBallTarget(s)                 // passa pra outro
    } else {
      const dx = b.target.x - b.x
      const stepB = TUNING.ball.speed * dt
      if (Math.abs(dx) <= stepB + 1) { b.x = b.target.x; b.hold = TUNING.ball.holdTimeS }
      else b.x += Math.sign(dx) * stepB
    }
  }

  // garra
  const claw = s.claw
  if (claw.state === 'drop') {
    claw.tipY += TUNING.claw.descendSpeed * dt
    // tenta agarrar o primeiro jogador em pé sob a garra
    const ph = playerHeight()
    for (const pl of s.players) {
      if (pl.ducked) continue                       // deitado = a garra passa por cima
      const top = GROUND_Y - ph
      const overlap = Math.abs(pl.x - claw.x) <= TUNING.claw.width / 2 + BR.w / 2
      if (overlap && claw.tipY >= top) {
        claw.grabbed = pl
        s.players = s.players.filter((q) => q !== pl)
        claw.state = 'up'
        break
      }
    }
    if (claw.state === 'drop' && claw.tipY >= MAX_DROP_Y) claw.state = 'up'
  } else if (claw.state === 'up') {
    claw.tipY -= TUNING.claw.ascendSpeed * dt
    if (claw.tipY <= CLAW_REST_Y) {
      claw.tipY = CLAW_REST_Y
      if (claw.grabbed) {
        coinsRound.value += claw.grabbed.coins
        resume()
        playAbduct()
        s.players.push(makePlayer(claw.grabbed.team))   // repõe o campo
        claw.grabbed = null
      }
      claw.state = 'ready'
    }
  }
}

// ---- Render -------------------------------------------------------------
function drawPlayer(pl) {
  const ph = BR.h
  if (pl.ducked) {
    // deitado no gramado: corpo achatado + cabecinha
    const y = GROUND_Y - 6
    ctx.fillStyle = pl.team === 'jp' ? '#3a7bff' : '#ffd24d'
    ctx.beginPath()
    ctx.ellipse(pl.x, y, 14, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e8b48c'
    ctx.beginPath()
    ctx.arc(pl.x - 12, y - 2, 4, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  drawSprite(ctx, pl.x - BR.w / 2, GROUND_Y - ph, pl.sprite, PLAYER_SCALE)
}

function drawBall(s) {
  const x = s.ball.x
  const y = GROUND_Y + 2
  const r = TUNING.ball.radius
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1330'
  ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#b7b7c4'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}

function drawShip(s) {
  // foguete montado no hangar (mesmo desenho do jogo principal)
  drawHangarShip(ctx, s.shipX - SHIP_W / 2, SHIP_Y - SHIP_H / 2, SHIP_W, SHIP_H, props.loadout, s.time * 1000)
}

function drawClaw(s) {
  const claw = s.claw
  const x = claw.x
  // cabo
  ctx.strokeStyle = '#b7b7c4'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, SHIP_Y + SHIP_H * 0.42)
  ctx.lineTo(x, claw.tipY)
  ctx.stroke()
  // garra (duas presas)
  ctx.strokeStyle = '#d8d8e2'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x - 7, claw.tipY + 8)
  ctx.lineTo(x, claw.tipY)
  ctx.lineTo(x + 7, claw.tipY + 8)
  ctx.stroke()
  // jogador agarrado, pendurado na garra
  if (claw.grabbed) {
    drawSprite(ctx, x - BR.w / 2, claw.tipY + 6, claw.grabbed.sprite, PLAYER_SCALE)
  }
}

function draw(s) {
  // céu noturno
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0a0716')
  g.addColorStop(0.6, '#141a2e')
  g.addColorStop(1, '#0d1f14')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // gramado
  ctx.fillStyle = '#1f7a3a'
  ctx.fillRect(0, GRASS_TOP, W, H - GRASS_TOP)
  ctx.fillStyle = '#2b8f47'
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) ctx.fillRect((W / 6) * i, GRASS_TOP, W / 6, H - GRASS_TOP)
  }
  // linha do gramado (marca do campo)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, GROUND_Y + 6)
  ctx.lineTo(W - PAD, GROUND_Y + 6)
  ctx.stroke()

  drawBall(s)

  // jogadores ordenados por x (sensação de profundidade leve)
  for (const pl of [...s.players].sort((a, b) => a.x - b.x)) drawPlayer(pl)

  drawClaw(s)
  drawShip(s)
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05
  if (sub.value === 'playing' && game) {
    update(dt, game)
    if (sub.value === 'playing') draw(game)
  }
  raf = requestAnimationFrame(frame)
}

// ---- Fluxo de telas -----------------------------------------------------
function nextStep() {
  resume()
  if (step.value < speech.length - 1) step.value++
  else startGame()
}

function startGame() {
  game = newGame()
  timeLeft.value = TUNING.round.durationS
  coinsRound.value = 0
  sub.value = 'playing'
  last = 0
}

function finish() {
  emit('earn', coinsRound.value)
  emit('back')
}

// ---- Input --------------------------------------------------------------
function onKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault()
  if (k === 'arrowleft' || k === 'a') keys.left = down
  if (k === 'arrowright' || k === 'd') keys.right = down
  if (down && (k === ' ' || k === 'arrowdown' || k === 'arrowup' || k === 'w' || k === 's')) tryDrop()
}
const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

function press(dir, v) { keys[dir] = v }

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  // desenha a Vó Baiana chorando na cutscene
  if (voCanvas.value) {
    const vctx = voCanvas.value.getContext('2d')
    const scale = 9
    const size = spriteSize(VO_BAIANA, scale)
    drawSprite(vctx, (voCanvas.value.width - size.w) / 2, 12, VO_BAIANA, scale)
  }
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
  <div class="ab" :style="{ '--accent': color }">
    <canvas ref="canvas" :width="W" :height="H"></canvas>

    <!-- HUD do jogo -->
    <div v-if="sub === 'playing'" class="ab-hud">
      <span class="ab-time" :class="{ low: timeLeft <= 5 }">⏱ {{ Math.ceil(timeLeft) }}s</span>
      <span class="ab-coins">🪙 {{ coinsRound }}</span>
    </div>

    <!-- Cutscene: Vó Baiana chorando + balãozinho -->
    <div v-if="sub === 'cutscene'" class="ab-cut" @pointerdown="resume">
      <div class="ab-cut-sky"></div>
      <div class="ab-vo">
        <canvas ref="voCanvas" width="160" height="180"></canvas>
        <span class="ab-tear t1"></span>
        <span class="ab-tear t2"></span>
      </div>
      <div class="ab-bubble">
        <p>{{ speech[step] }}</p>
        <button class="ab-btn" @click="nextStep">
          {{ step < speech.length - 1 ? '▶ Continuar' : '🛸 Bora!' }}
        </button>
      </div>
      <button class="ab-skip" @click="startGame">Pular ⏭</button>
    </div>

    <!-- Resultado -->
    <div v-if="sub === 'result'" class="ab-result">
      <h2>Fim do sonho! 🛸</h2>
      <p>Você abduziu <b>🪙 {{ coinsRound }}</b> em moedas.</p>
      <button class="ab-btn" @click="finish">← Voltar ao jogo</button>
    </div>

    <!-- Controles touch -->
    <div v-if="sub === 'playing'" class="ab-touch">
      <button @pointerdown.prevent="press('left', true)" @pointerup="press('left', false)"
              @pointerleave="press('left', false)">◀</button>
      <button @pointerdown.prevent="press('right', true)" @pointerup="press('right', false)"
              @pointerleave="press('right', false)">▶</button>
      <button class="grab" @pointerdown.prevent="tryDrop">🪝</button>
    </div>
  </div>
</template>

<style scoped>
.ab {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  user-select: none;
}
.ab canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}

.ab-hud {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #fff;
  text-shadow: 0 2px 0 #000;
  pointer-events: none;
}
.ab-time.low { color: #ff5252; }
.ab-coins { color: #ffd24d; }

/* Cutscene */
.ab-cut {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  padding: 24px;
  box-sizing: border-box;
}
.ab-cut-sky {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}
.ab-vo {
  position: relative;
  margin-top: auto;
}
.ab-vo canvas {
  width: 160px;
  height: 180px;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 10px rgba(142, 68, 173, 0.4));
}
.ab-tear {
  position: absolute;
  width: 5px;
  height: 8px;
  border-radius: 50% 50% 50% 50% / 70% 70% 40% 40%;
  background: #6cc6ff;
  box-shadow: 0 0 4px rgba(108, 198, 255, 0.8);
  animation: ab-fall 1.4s ease-in infinite;
}
.ab-tear.t1 { left: 58px; top: 78px; }
.ab-tear.t2 { left: 96px; top: 78px; animation-delay: 0.6s; }
@keyframes ab-fall {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(46px); opacity: 0; }
}
.ab-bubble {
  position: relative;
  max-width: 340px;
  background: #fff;
  color: #1a1330;
  border: 3px solid #9b7bff;
  border-radius: 14px;
  padding: 14px 16px;
  font-family: 'VT323', monospace;
}
.ab-bubble::after {
  content: '';
  position: absolute;
  bottom: -14px;
  left: 40px;
  border: 8px solid transparent;
  border-top-color: #9b7bff;
}
.ab-bubble p {
  margin: 0 0 12px;
  font-size: 1.35rem;
  line-height: 1.25;
}

.ab-result {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  background: rgba(6, 10, 20, 0.78);
  color: #fff;
  padding: 24px;
}
.ab-result h2 {
  margin: 0;
  font-size: 1.2rem;
  text-shadow: 0 0 12px rgba(155, 123, 255, 0.65), 0 3px 0 #4a2f8f;
}
.ab-result p { margin: 0; font-family: 'VT323', monospace; font-size: 1.5rem; }
.ab-result b { color: #ffd24d; }

.ab-btn {
  padding: 12px 18px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.8rem;
  color: #fff;
  background: var(--accent, #37e0a0);
  border: 3px solid rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.ab-btn:hover { filter: brightness(1.12); }
.ab-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35); }

.ab-skip {
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
.ab-skip:hover { background: rgba(155, 123, 255, 0.3); }

.ab-touch {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  display: flex;
  justify-content: center;
  gap: 10px;
}
.ab-touch button {
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
.ab-touch button.grab { background: rgba(55, 224, 160, 0.75); margin-left: 12px; }
.ab-touch button:active { filter: brightness(1.4); }
@media (hover: hover) and (pointer: fine) {
  .ab-touch { display: none; }
}
</style>
