<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { drawSprite, GUGU } from '../data/pixelSprites.js'
import { DEFAULT_LOADOUT, buildShipStats } from '../data/shipParts.js'
import { resume, playShot, playExplosion, playBlip } from '../audio/sfx.js'

const props = defineProps({
  segment: { type: Number, default: 1 },
  color: { type: String, default: '#6cc6ff' },
  loadout: { type: Object, default: () => ({ ...DEFAULT_LOADOUT }) },
})
const emit = defineEmits(['earn', 'back'])

// ============================================================================
//  CALIBRAÇÃO — mexa só aqui pra ajustar o jogo. Tudo em px/s e segundos.
// ============================================================================
const TUNING = {
  pedal: {
    speed: 5.5,          // velocidade da transição cover ↔ exposto (1/s; 5.5 ≈ 180ms)
    fireBelow: 0.35,     // só atira com cover abaixo disso (quase todo exposto)
    safeAbove: 0.5,      // cover acima disso = abrigado (impacto não machuca)
  },
  gun: { clip: 6, reloadS: 0.4 },   // recarga rápida: abaixou o muro, encheu o pente
  lives: 3,
  coins: { perScore: 50, lossKeep: 0.5 },   // score→moedas; derrota guarda metade
  wave1: {
    count: 10,
    spawnEvery: [1.5, 0.85],   // intervalo entre asteroides: início → fim da wave
    approachS: [6.5, 4.2],     // tempo até o impacto: início → fim da wave
    radius: [20, 30],          // raio base sorteado
    points: 100,
    pointsSmall: 150,          // fragmentos valem mais (são pequenos e rápidos)
    splitR: 24,                // raio base acima disso → parte em 2 fragmentos
  },
}
// ============================================================================

const W = 480
const H = 640
const SKY_MIN_Y = 70            // faixa vertical onde os inimigos aparecem
const SKY_MAX_Y = 270           // (sempre visível mesmo com o painel erguido)
const PANEL_EXPOSED_H = 96      // altura do painel com o Gugu exposto
const PANEL_COVER_H = 330       // altura do painel abrigado
const SCALE_MIN = 0.22          // escala do asteroide ao surgir (longe)
const SCALE_MAX = 1.75          // escala no impacto (colado na tela)

const sub = ref('cutscene')     // 'cutscene' | 'playing' | 'result'
const step = ref(0)
const lives = ref(TUNING.lives)
const ammo = ref(TUNING.gun.clip)
const clipSize = ref(TUNING.gun.clip)
const score = ref(0)
const reloading = ref(false)
const covered = ref(true)
const won = ref(false)
const coinsRound = ref(0)

const speech = [
  'Olha o tanto de pedra vindo na nossa direção! Um cinturão inteiro, minha nossa!',
  'Segura o ESPAÇO pra eu sair de trás do painel — aí é só mirar com o mouse e atirar!',
  'Solta o espaço pra eu me esconder: lá atrás eu recarrego e nada me acerta. Bora defender a nave!',
]

const canvas = ref(null)
const guguCanvas = ref(null)
let ctx = null
let raf = 0
let last = 0
let game = null
let pedal = false               // espaço segurado = quer ficar exposto

function rand(a, b) { return a + Math.random() * (b - a) }
function lerp(a, b, t) { return a + (b - a) * t }

const stats = buildShipStats(props.loadout)
// bônus leve conforme a arma instalada no hangar
const CLIP = stats.weaponId === 'rapid' ? 9 : TUNING.gun.clip
const PIERCE = stats.weaponId === 'plasma' ? 2 : 1   // plasma atravessa 2 alvos
clipSize.value = CLIP

// ---- Setup do jogo ------------------------------------------------------
function makeAsteroid(cfg, waveT, small = null) {
  const r = small ? small.r : rand(cfg.radius[0], cfg.radius[1])
  const approach = small
    ? small.approach
    : lerp(cfg.approachS[0], cfg.approachS[1], waveT)
  // silhueta irregular fixa por asteroide (8 vértices com variação de raio)
  const verts = []
  for (let i = 0; i < 8; i++) verts.push(rand(0.72, 1.05))
  return {
    x: small ? small.x : rand(60, W - 60),
    y: small ? small.y : rand(SKY_MIN_Y, SKY_MAX_Y),
    r,
    verts,
    rot: rand(0, Math.PI * 2),
    rotSpd: rand(-1.2, 1.2),
    wobbleSeed: rand(0, Math.PI * 2),
    t: small ? small.t : 0,
    approach,
    small: !!small,
    points: small ? TUNING.wave1.pointsSmall : TUNING.wave1.points,
    hp: 1,
    flash: 0,        // hit flash (não usado com hp 1, pronto pras waves 2/3)
  }
}

function newGame() {
  return {
    cover: 1,                    // 1 = abrigado · 0 = exposto
    aim: { x: W / 2, y: H / 2 },
    reloadT: 0,
    enemies: [],
    spawned: 0,
    spawnTimer: 0.8,
    particles: [],
    floaters: [],                // números de pontos flutuando
    tracer: 0,                   // ms restantes do risco do tiro
    tracerAim: { x: 0, y: 0 },
    shake: 0,
    dmgFlash: 0,
    shots: 0,
    hits: 0,
    time: 0,
  }
}

// ---- Ações --------------------------------------------------------------
function setPedal(v) {
  pedal = v
  if (v) resume()
}

function aimTo(e) {
  if (!canvas.value || !game) return
  const rect = canvas.value.getBoundingClientRect()
  game.aim.x = (e.clientX - rect.left) * (W / rect.width)
  game.aim.y = (e.clientY - rect.top) * (H / rect.height)
}

function shoot(e) {
  if (sub.value !== 'playing' || !game) return
  aimTo(e)
  resume()
  const s = game
  if (s.cover > TUNING.pedal.fireBelow) return          // abrigado: não atira
  if (reloading.value || ammo.value <= 0) {
    playBlip({ notes: [38], type: 'square', gain: 0.18, dur: 0.05 })   // clique seco
    return
  }
  ammo.value -= 1
  s.shots += 1
  playShot(stats.weaponId === 'rapid' ? 'rapid' : 'cannon')
  s.tracer = 70
  s.tracerAim = { x: s.aim.x, y: s.aim.y }

  // alvos sob a mira, do mais perto (maior) pro mais longe; plasma pega 2
  const targets = s.enemies
    .filter((en) => {
      const scale = lerp(SCALE_MIN, SCALE_MAX, en.t / en.approach)
      const dx = en.x + wobbleX(en, s.time) - s.aim.x
      const dy = en.y - s.aim.y
      return Math.hypot(dx, dy) <= en.r * scale + 8
    })
    .sort((a, b) => b.t / b.approach - a.t / a.approach)
    .slice(0, PIERCE)

  for (const en of targets) killEnemy(s, en)
  if (!targets.length) return
  s.hits += 1
}

function killEnemy(s, en) {
  s.enemies = s.enemies.filter((q) => q !== en)
  score.value += en.points
  const scale = lerp(SCALE_MIN, SCALE_MAX, en.t / en.approach)
  const x = en.x + wobbleX(en, s.time)
  spawnExplosion(s, x, en.y, en.r * scale)
  s.floaters.push({ x, y: en.y - en.r * scale, text: String(en.points), life: 0.8 })
  s.shake = Math.max(s.shake, 3)
  playExplosion(0.5)
  // asteroide graúdo parte em 2 fragmentos rápidos
  if (!en.small && en.r > TUNING.wave1.splitR) {
    for (let i = 0; i < 2; i++) {
      const frag = makeAsteroid(TUNING.wave1, 0, {
        x: x + rand(-30, 30),
        y: en.y + rand(-24, 24),
        r: en.r * 0.5,
        t: en.t,
        approach: en.approach * 0.82,   // fragmento chega mais rápido
      })
      s.enemies.push(frag)
    }
  }
}

function spawnExplosion(s, x, y, size) {
  const n = Math.round(8 + size * 0.4)
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2)
    const sp = rand(30, 160)
    s.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(0.25, 0.6),
      color: Math.random() < 0.5 ? '#ffd24d' : '#ff8a1a',
    })
  }
}

function takeDamage(s) {
  lives.value -= 1
  s.dmgFlash = 0.65
  s.shake = 12
  playBlip({ notes: [52, 45, 38], type: 'sawtooth', gain: 0.3, step: 0.07, dur: 0.14 })
  if (lives.value <= 0) endRound(false)
}

function coverThunk(s) {
  s.shake = Math.max(s.shake, 5)
  const px = rand(80, W - 80)
  for (let i = 0; i < 7; i++) {
    s.particles.push({
      x: px, y: panelTop(s) + 4,
      vx: rand(-90, 90), vy: rand(-160, -40),
      life: rand(0.2, 0.45),
      color: '#b8bcc8',
    })
  }
  playBlip({ notes: [43, 36], type: 'triangle', gain: 0.3, step: 0.05, dur: 0.1 })
}

function endRound(win) {
  won.value = win
  const keep = win ? 1 : TUNING.coins.lossKeep
  coinsRound.value = Math.max(1, Math.round((score.value / TUNING.coins.perScore) * keep))
  sub.value = 'result'
  if (win) playBlip({ notes: [72, 76, 79, 84, 88, 91], type: 'square', gain: 0.32, step: 0.09, dur: 0.16 })
}

// ---- Update -------------------------------------------------------------
function wobbleX(en, time) {
  return Math.sin(time * 1.4 + en.wobbleSeed) * 9
}

function panelTop(s) {
  return H - lerp(PANEL_EXPOSED_H, PANEL_COVER_H, s.cover)
}

function update(dt, s) {
  s.time += dt

  // pedal: cover desliza pro alvo (0 = exposto, 1 = abrigado)
  const target = pedal ? 0 : 1
  const d = TUNING.pedal.speed * dt
  s.cover += Math.max(-d, Math.min(d, target - s.cover))
  covered.value = s.cover > TUNING.pedal.safeAbove

  // recarga: começa assim que abaixa o muro; expor no meio cancela
  if (s.cover > 0.55 && ammo.value < clipSize.value && !reloading.value) {
    reloading.value = true
    s.reloadT = TUNING.gun.reloadS
    playBlip({ notes: [55], type: 'triangle', gain: 0.2, dur: 0.07 })
  }
  if (reloading.value) {
    if (s.cover < 0.45) {
      reloading.value = false          // saiu do abrigo: recarga interrompida
    } else {
      s.reloadT -= dt
      if (s.reloadT <= 0) {
        reloading.value = false
        ammo.value = clipSize.value
        playBlip({ notes: [60, 67, 72], type: 'square', gain: 0.28, step: 0.06, dur: 0.1 })
      }
    }
  }

  // spawner da wave 1
  const cfg = TUNING.wave1
  if (s.spawned < cfg.count) {
    s.spawnTimer -= dt
    if (s.spawnTimer <= 0) {
      const waveT = s.spawned / Math.max(1, cfg.count - 1)
      s.enemies.push(makeAsteroid(cfg, waveT))
      s.spawned += 1
      s.spawnTimer = lerp(cfg.spawnEvery[0], cfg.spawnEvery[1], waveT)
    }
  }

  // asteroides se aproximando (crescem até o impacto)
  for (const en of [...s.enemies]) {
    en.t += dt
    en.rot += en.rotSpd * dt
    if (en.t >= en.approach) {
      s.enemies = s.enemies.filter((q) => q !== en)
      if (s.cover > TUNING.pedal.safeAbove) coverThunk(s)
      else takeDamage(s)
      if (sub.value !== 'playing') return
    }
  }

  // partículas / popups / efeitos
  for (const p of s.particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 260 * dt
    p.life -= dt
  }
  s.particles = s.particles.filter((p) => p.life > 0)
  for (const f of s.floaters) { f.y -= 34 * dt; f.life -= dt }
  s.floaters = s.floaters.filter((f) => f.life > 0)
  if (s.tracer > 0) s.tracer -= dt * 1000
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 30)
  if (s.dmgFlash > 0) s.dmgFlash = Math.max(0, s.dmgFlash - dt * 1.6)

  // limpou todos os asteroides = vitória (wave única, sobrevivível)
  if (s.spawned >= cfg.count && s.enemies.length === 0) endRound(true)
}

// ---- Render -------------------------------------------------------------
function drawBackground(s) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#04040a')
  g.addColorStop(0.65, '#0d0a1e')
  g.addColorStop(1, '#150f28')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // estrelas fixas com cintilada
  ctx.fillStyle = '#f4f4f4'
  for (let i = 0; i < 40; i++) {
    const x = (i * 137 + 31) % W
    const y = (i * 89 + 17) % (H - 120)
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(s.time * 1.3 + i))
    ctx.globalAlpha = tw
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.globalAlpha = 1

  // Terra de pertinho — o sonho do Gugu, lá no topo
  const ex = W - 96
  const ey = 84
  const er = 44
  ctx.fillStyle = 'rgba(108, 198, 255, 0.18)'
  ctx.beginPath(); ctx.arc(ex, ey, er * 1.18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2a6fd6'
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = '#3fa03a'
  ctx.beginPath(); ctx.ellipse(ex - 16, ey - 10, 18, 12, 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(ex + 18, ey + 16, 14, 9, -0.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(244,244,244,0.5)'
  ctx.beginPath(); ctx.ellipse(ex + 6, ey - 20, 16, 5, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(20, 15, 35, 0.25)'
  ctx.beginPath(); ctx.arc(ex + er * 0.4, ey + er * 0.35, er, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawAsteroid(s, en) {
  const scale = lerp(SCALE_MIN, SCALE_MAX, en.t / en.approach)
  const r = en.r * scale
  const x = en.x + wobbleX(en, s.time)
  const y = en.y
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(en.rot)
  // corpo irregular
  ctx.fillStyle = '#7a6f63'
  ctx.beginPath()
  for (let i = 0; i < en.verts.length; i++) {
    const a = (i / en.verts.length) * Math.PI * 2
    const vr = r * en.verts[i]
    if (i === 0) ctx.moveTo(Math.cos(a) * vr, Math.sin(a) * vr)
    else ctx.lineTo(Math.cos(a) * vr, Math.sin(a) * vr)
  }
  ctx.closePath()
  ctx.fill()
  // sombra e crateras
  ctx.fillStyle = '#5c5348'
  ctx.beginPath(); ctx.arc(r * 0.25, r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8d8577'
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.28, r * 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#4a4238'
  ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.15, r * 0.14, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // aviso de impacto iminente: contorno vermelho piscando no último trecho
  const prog = en.t / en.approach
  if (prog > 0.78) {
    const blink = Math.sin(s.time * 16) > 0
    if (blink) {
      ctx.strokeStyle = 'rgba(208, 57, 46, 0.9)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.stroke()
    }
  }
}

function drawPanel(s) {
  const top = panelTop(s)

  // Gugu aparece atrás do painel quando exposto
  if (s.cover < 0.85) {
    const scale = 4
    const gw = 16 * scale
    const gx = W / 2 - gw / 2
    const gy = top - (1 - s.cover) * 66
    drawSprite(ctx, gx, gy, GUGU.idle, scale)
  }

  // corpo do painel
  ctx.fillStyle = '#1b2233'
  ctx.fillRect(0, top, W, H - top)
  // borda superior com faixa de perigo
  ctx.fillStyle = '#3b4a6a'
  ctx.fillRect(0, top, W, 5)
  for (let x = 0; x < W; x += 28) {
    ctx.fillStyle = (x / 28) % 2 === 0 ? '#ffd24d' : '#12131a'
    ctx.fillRect(x, top + 5, 28, 6)
  }
  // rebites
  ctx.fillStyle = '#6a7a9a'
  for (let x = 16; x < W; x += 56) {
    ctx.fillRect(x, top + 18, 4, 4)
    ctx.fillRect(x, top + 40, 4, 4)
  }
  // telinhas do console
  const scrY = top + 24
  if (scrY + 30 < H) {
    ctx.fillStyle = '#0c1120'
    ctx.fillRect(28, scrY, 84, 30)
    ctx.fillRect(W - 112, scrY, 84, 30)
    ctx.strokeStyle = '#37e0a0'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= 8; i++) {
      const px = 32 + i * 9.5
      const py = scrY + 15 + Math.sin(s.time * 5 + i * 1.2) * 8
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.fillStyle = Math.sin(s.time * 6) > 0 ? '#d0392e' : '#5a1510'
    ctx.beginPath(); ctx.arc(W - 70, scrY + 15, 6, 0, Math.PI * 2); ctx.fill()
  }
}

function drawCrosshair(s) {
  const { x, y } = s.aim
  const canFire = s.cover <= TUNING.pedal.fireBelow && !reloading.value && ammo.value > 0
  const col = canFire ? '#6fcf5b' : 'rgba(184, 188, 200, 0.55)'
  const r = 20 + (s.tracer > 0 ? 4 : 0)
  ctx.strokeStyle = col
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  // marcadores nos 4 cantos (estilo Virtua Cop)
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + Math.PI / 4
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2))
    ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9))
    ctx.stroke()
  }
  ctx.fillStyle = col
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
}

function draw(s) {
  ctx.save()
  if (s.shake > 0) {
    ctx.translate(rand(-s.shake, s.shake) * 0.5, rand(-s.shake, s.shake) * 0.5)
  }

  drawBackground(s)

  // inimigos: mais longe primeiro (mais perto desenhado por cima)
  for (const en of [...s.enemies].sort((a, b) => a.t / a.approach - b.t / b.approach)) {
    drawAsteroid(s, en)
  }

  // risco do tiro (hit scan instantâneo)
  if (s.tracer > 0) {
    ctx.strokeStyle = `rgba(255, 226, 122, ${s.tracer / 70})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W / 2, H - 30)
    ctx.lineTo(s.tracerAim.x, s.tracerAim.y)
    ctx.stroke()
  }

  for (const p of s.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 3)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
  }
  ctx.globalAlpha = 1

  ctx.font = '13px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5)
    ctx.fillStyle = '#ffd24d'
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'start'

  drawPanel(s)

  // flash vermelho de dano
  if (s.dmgFlash > 0) {
    ctx.fillStyle = `rgba(208, 57, 46, ${s.dmgFlash * 0.55})`
    ctx.fillRect(0, 0, W, H)
  }

  drawCrosshair(s)
  ctx.restore()
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05
  if (sub.value === 'playing' && game) {
    update(dt, game)
    if (sub.value === 'playing' || sub.value === 'result') draw(game)
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
  lives.value = TUNING.lives
  ammo.value = CLIP
  score.value = 0
  reloading.value = false
  pedal = false
  sub.value = 'playing'
  last = 0
}

function finish() {
  emit('earn', coinsRound.value)
  emit('back')
}

// ---- Input --------------------------------------------------------------
function onKey(e, down) {
  if (e.key === ' ') {
    e.preventDefault()
    if (sub.value === 'playing') setPedal(down)
  }
}
const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  if (guguCanvas.value) {
    const gctx = guguCanvas.value.getContext('2d')
    drawSprite(gctx, 4, 4, GUGU.dazzled, 8)
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
  <div class="od" :style="{ '--accent': color }">
    <canvas
      ref="canvas"
      :width="W"
      :height="H"
      :class="{ playing: sub === 'playing' }"
      @pointermove="aimTo"
      @pointerdown.prevent="shoot"
    ></canvas>

    <!-- HUD -->
    <div v-if="sub === 'playing'" class="od-hud">
      <div class="od-hud-top">
        <span class="od-lives">
          <span v-for="n in TUNING.lives" :key="n" class="od-heart" :class="{ off: n > lives }">🛡</span>
        </span>
        <span class="od-wave">DEFESA ORBITAL</span>
        <span class="od-score">{{ score }}</span>
      </div>
      <div class="od-hud-bottom">
        <span class="od-ammo">
          <span v-for="n in clipSize" :key="n" class="od-bullet" :class="{ spent: n > ammo }"></span>
        </span>
        <span v-if="reloading" class="od-reload">RECARREGANDO…</span>
        <span v-else-if="ammo === 0" class="od-reload alert">SEM MUNIÇÃO! SOLTA O ESPAÇO!</span>
        <span v-else-if="covered" class="od-status">ABRIGADO — segure ESPAÇO</span>
      </div>
    </div>

    <!-- Cutscene: Gugu explica o pedal -->
    <div v-if="sub === 'cutscene'" class="od-cut" @pointerdown="resume">
      <div class="od-cut-sky"></div>
      <canvas ref="guguCanvas" width="136" height="144" class="od-gugu"></canvas>
      <div class="od-bubble">
        <p>{{ speech[step] }}</p>
        <button class="od-btn" @click="nextStep">
          {{ step < speech.length - 1 ? '▶ Continuar' : '🛰 Bora!' }}
        </button>
      </div>
      <button class="od-skip" @click="startGame">Pular ⏭</button>
    </div>

    <!-- Resultado -->
    <div v-if="sub === 'result'" class="od-result">
      <h2>{{ won ? 'Nave defendida! 🛰' : 'A nave apanhou… 💥' }}</h2>
      <p v-if="won">Que pontaria! Fez <b>{{ score }}</b> pontos.</p>
      <p v-else>Foi mal, pai… as pedras venceram. Fez <b>{{ score }}</b> pontos.</p>
      <p>Ganhou <b>🪙 {{ coinsRound }}</b> em moedas.</p>
      <button class="od-btn" @click="finish">← Voltar ao jogo</button>
    </div>

    <!-- Controles touch: pedal virtual -->
    <div v-if="sub === 'playing'" class="od-touch">
      <button
        class="od-pedal"
        @pointerdown.prevent="setPedal(true)"
        @pointerup="setPedal(false)"
        @pointerleave="setPedal(false)"
      >PEDAL</button>
    </div>
  </div>
</template>

<style scoped>
.od {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  user-select: none;
}
.od canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  touch-action: none;
}
.od canvas.playing { cursor: none; }

.od-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #fff;
  text-shadow: 0 2px 0 #000;
}
.od-hud-top {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}
.od-heart { filter: none; }
.od-heart.off { filter: grayscale(1) brightness(0.5); }
.od-wave { color: var(--accent, #6cc6ff); font-size: 0.7rem; }
.od-score { color: #ffd24d; }

.od-hud-bottom {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.od-ammo { display: flex; gap: 5px; }
.od-bullet {
  width: 9px;
  height: 20px;
  border-radius: 3px 3px 1px 1px;
  background: linear-gradient(180deg, #ffe27a 0%, #ffd24d 45%, #b8862c 100%);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
}
.od-bullet.spent { background: #2a2c36; box-shadow: none; }
.od-reload {
  font-size: 0.62rem;
  color: #6cc6ff;
  animation: od-blink 0.5s steps(2) infinite;
}
.od-reload.alert { color: #ff5252; }
.od-status { font-size: 0.62rem; color: #b8bcc8; }
@keyframes od-blink { 50% { opacity: 0.25; } }

/* Cutscene */
.od-cut {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 24px;
  box-sizing: border-box;
}
.od-cut-sky {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(108, 198, 255, 0.22), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(120, 90, 220, 0.25), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}
.od-gugu {
  width: 136px;
  height: 144px;
  margin-top: auto;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 12px rgba(111, 207, 91, 0.35));
}
.od-bubble {
  position: relative;
  max-width: 340px;
  background: #fff;
  color: #1a1330;
  border: 3px solid var(--accent, #6cc6ff);
  border-radius: 14px;
  padding: 14px 16px;
  font-family: var(--retro, 'VT323', monospace);
}
.od-bubble::after {
  content: '';
  position: absolute;
  top: -14px;
  left: 46%;
  border: 8px solid transparent;
  border-bottom-color: var(--accent, #6cc6ff);
}
.od-bubble p {
  margin: 0 0 12px;
  font-size: 1.35rem;
  line-height: 1.25;
}

.od-result {
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
.od-result h2 {
  margin: 0;
  font-size: 1.1rem;
  text-shadow: 0 0 12px rgba(108, 198, 255, 0.65), 0 3px 0 #1f4fd0;
}
.od-result p { margin: 0; font-family: var(--retro, 'VT323', monospace); font-size: 1.5rem; }
.od-result b { color: #ffd24d; }

.od-btn {
  padding: 12px 18px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.8rem;
  color: #fff;
  background: var(--accent, #6cc6ff);
  border: 3px solid rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.od-btn:hover { filter: brightness(1.12); }
.od-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35); }

.od-skip {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 8px 14px;
  font-family: var(--retro, 'VT323', monospace);
  font-size: 1.1rem;
  color: #fff;
  background: rgba(20, 15, 32, 0.7);
  border: 1px solid rgba(108, 198, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
}
.od-skip:hover { background: rgba(108, 198, 255, 0.3); }

.od-touch {
  position: absolute;
  right: 12px;
  bottom: 52px;
  display: flex;
}
.od-pedal {
  width: 84px;
  height: 84px;
  border: none;
  border-radius: 50%;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.62rem;
  color: #fff;
  background: rgba(208, 57, 46, 0.8);
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45);
  touch-action: none;
  cursor: pointer;
}
.od-pedal:active { transform: translateY(4px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45); }
@media (hover: hover) and (pointer: fine) {
  .od-touch { display: none; }
}
</style>
