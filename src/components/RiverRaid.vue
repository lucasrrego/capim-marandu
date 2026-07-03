<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import HangarScreen from './HangarScreen.vue'
import MoonLanding from './MoonLanding.vue'
import MinigameScreen from './MinigameScreen.vue'
import IntroScreen from './IntroScreen.vue'
import StartScreen from './StartScreen.vue'
import { DEFAULT_LOADOUT, buildShipStats, drawShip, drawMoon } from '../data/shipParts.js'
const W = 480
const H = 640
const ROW_H = 16                     // altura de cada faixa do terreno
const N_ROWS = Math.ceil(H / ROW_H) + 3

// ---- HUD reativo ----
const phase = ref('start')           // 'start' | 'intro' | 'hangar' | 'playing' | 'paused' | 'minigame' | 'moon' | 'over' | 'won'
const activeMinigame = ref({ segment: 1, color: '#ff4d4d' })
const score = ref(0)
const lives = ref(3)
const shield = ref(0)
const fuelPct = ref(100)
const speedLabel = ref('1x')
const progressPct = ref(0)             // % da distância total percorrida
const hangarLoadout = ref({ ...DEFAULT_LOADOUT })
const bank = ref(0)         // total de moedas guardadas (persiste, gasto no hangar)
const runCoins = ref(0)     // moedas ganhas na corrida atual (ainda não guardadas)
const runKept = ref(0)      // quanto da corrida foi para o banco no fim (feedback)
const deathLossPct = ref(75) // % perdido ao morrer nesta corrida (Cofre reduz)

const displayCoins = computed(() =>
  ['playing', 'paused', 'minigame'].includes(phase.value) ? runCoins.value : bank.value
)

const displayLives = computed(() => {
  if (phase.value === 'start' || phase.value === 'hangar') {
    return buildShipStats(hangarLoadout.value).startLives
  }
  return lives.value
})

const displayShield = computed(() => {
  if (phase.value === 'start' || phase.value === 'hangar') {
    return buildShipStats(hangarLoadout.value).shield
  }
  return shield.value
})

const canvas = ref(null)
let ctx = null
let raf = 0
let last = 0
let state = null
let shipLoadout = { ...DEFAULT_LOADOUT }
let shipStats = buildShipStats(shipLoadout)

// ---- Constantes de jogo ----
const BASE_SPEED = 120               // px/s de rolagem
const MIN_SPEED = 80
const MAX_SPEED = 280
const FUEL_MAX = 100
const FUEL_REFILL = 60            // combustível por tanque F
// Meta depois que o 5º warp (spawna em RUN_LENGTH=1500) rola a tela inteira e
// passa pelo player (~+724 px), + folga pra andar mais um pouco antes da Lua.
// Assim testa o fluxo completo: distância → pouso na Lua.
const GOAL_DISTANCE = 2600            // px de rolagem até o fim do percurso
const MIN_CHANNEL = 96               // largura mínima navegável do rio
const MARGIN = 34                    // margem das margens em relação à borda
const RESPAWN_INVULN = 1800          // ms de invulnerabilidade após reviver
const RESPAWN_DELAY = 1000           // ms de explosão antes de renascer
const SHIELD_INVULN = 900            // ms de invuln ao absorver 1 impacto no escudo
const GOLD_DUR = 450                 // ms de brilho dourado ao pegar combustível

// ---- Economia (moedas persistidas entre partidas) ----
const COINS_KEY = 'capim-marandu:coins'   // contrato com a branch do Hangar
const BODY_KEY = 'capim-marandu:body'     // níveis de upgrade do corpo (persistem)
const ENGINE_KEY = 'capim-marandu:engine' // níveis de upgrade do motor (persistem)
// Recompensa de moedas por tipo destruído. Para novos vilões, basta
// adicionar a entrada aqui; tipos não mapeados usam DEFAULT_COIN_REWARD.
const COIN_REWARDS = { asteroid: 1, meteor: 1, fuel: 1 }
const DEFAULT_COIN_REWARD = 1

// ---- Warps de mini game (1 a cada 1/5 do percurso) ----
const RUN_LENGTH = 1500              // reduzido para teste (warp a cada ~300 px)
const WARP_INTERVAL = RUN_LENGTH / 5
const WARP_COLORS = ['#ff4d4d', '#ffd24d', '#37e0a0', '#9b7bff', '#ff8a1a']
const WARP_W = 32
const WARP_H = 40
// Lua-destino no topo do percurso (6º "warp" = portal de pouso)
const MOON_R = 128                   // raio do disco da Lua
const MOON_WARP_W = 64               // hitbox do portal centralizado na Lua
const MOON_WARP_H = 64
// px que a Lua desce (do topo até o player) após GOAL_DISTANCE.
// A barra de progresso só chega a 100% quando o portal alcança o player.
const MOON_APPROACH = (H - 74) + MOON_R
const PROGRESS_GOAL = GOAL_DISTANCE + MOON_APPROACH

const keys = {}

function rand(a, b) { return a + Math.random() * (b - a) }

function loadBank() {
  bank.value = Number(localStorage.getItem(COINS_KEY)) || 0
}

// fecha a corrida: guarda `fraction` do que ganhou (1 = vitória, 0.25 = morte)
function settleRun(fraction) {
  runKept.value = Math.floor(runCoins.value * fraction)
  bank.value += runKept.value
  localStorage.setItem(COINS_KEY, String(bank.value))
}

// bônus avulso direto no banco (ex.: recompensa do pouso na Lua)
function addCoins(n) {
  bank.value += n
  localStorage.setItem(COINS_KEY, String(bank.value))
}

// carrega níveis salvos de uma trilha de upgrade em loadout[field]
function loadUpgrade(key, field) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved && typeof saved === 'object') {
      hangarLoadout.value = {
        ...hangarLoadout.value,
        [field]: { ...hangarLoadout.value[field], ...saved },
      }
    }
  } catch { /* JSON inválido: ignora */ }
}

function loadUpgrades() {
  loadUpgrade(BODY_KEY, 'body')
  loadUpgrade(ENGINE_KEY, 'engineUp')
}

// persiste banco (gasto no hangar) e níveis de upgrade comprados
watch(bank, (v) => localStorage.setItem(COINS_KEY, String(v)))
watch(() => hangarLoadout.value.body, (b) => localStorage.setItem(BODY_KEY, JSON.stringify(b)), { deep: true })
watch(() => hangarLoadout.value.engineUp, (e) => localStorage.setItem(ENGINE_KEY, JSON.stringify(e)), { deep: true })

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
  // poeira estelar das laterais (só fica visível fora do canal)
  const dust = []
  const dustColors = ['#e6e6ff', '#ffd9f0', '#cfe4ff', '#f3e8ff']
  for (let i = 0; i < 170; i++) {
    dust.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.4, 1.8),
      a: rand(0.25, 0.9),
      p: rand(0.5, 1),
      c: dustColors[Math.floor(rand(0, dustColors.length))],
    })
  }
  // nuvens de nebulosa
  const nebula = []
  const nebColors = ['rgba(150,70,200,0.16)', 'rgba(60,140,210,0.14)',
                     'rgba(210,80,160,0.14)', 'rgba(90,110,230,0.14)']
  for (let i = 0; i < 5; i++) {
    nebula.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(70, 170),
      p: rand(0.4, 0.8),
      c: nebColors[Math.floor(rand(0, nebColors.length))],
    })
  }
  return {
    gen, rows, stars, dust, nebula,
    player: { x: W / 2 - 13, y: H - 74, w: 26, h: 32 },
    bullets: [],
    enemies: [],
    speed: BASE_SPEED,
    fuel: FUEL_MAX,
    fuelMax: FUEL_MAX,
    shield: 0,
    lives: 3,
    score: 0,
    distance: 0,
    spawnTimer: 1.2,
    lastFire: 0,
    invuln: 0,
    goldFlash: 0,
    respawn: 0,
    particles: [],
    over: false,
    time: 0,
    warps: [],
    nextWarpAt: WARP_INTERVAL,
    warpSegment: 0,
    coinAcc: 0,
    runCoins: 0,
    moonActive: false,   // percurso concluído → Lua desce no topo
    moon: null,          // { x, y, r, warp:{x,y,w,h,alive} }
  }
}

function spawnWarp(s) {
  if (s.warpSegment >= 5) return
  const top = s.rows.reduce((a, r) => (r.y < a.y ? r : a), s.rows[0])
  const segment = s.warpSegment + 1
  const color = WARP_COLORS[s.warpSegment]
  const side = s.warpSegment % 2 === 0 ? 'left' : 'right'
  const x = side === 'left'
    ? top.left - WARP_W * 0.55
    : top.right - WARP_W * 0.45
  s.warps.push({
    side, color, segment,
    x, y: -WARP_H - 4,
    w: WARP_W, h: WARP_H,
    alive: true,
  })
  s.warpSegment++
  s.nextWarpAt += WARP_INTERVAL
}

// Lua desce do topo carregando o portal de pouso (6º warp) no centro.
function spawnMoon(s) {
  s.moon = {
    x: W / 2,
    y: -MOON_R,
    r: MOON_R,
    warp: { x: W / 2 - MOON_WARP_W / 2, y: -MOON_R, w: MOON_WARP_W, h: MOON_WARP_H, alive: true },
  }
}

function updateMoon(s, move) {
  if (!s.moonActive) return
  if (!s.moon) spawnMoon(s)
  const mn = s.moon
  mn.y += move
  // portal acompanha o centro da Lua
  mn.warp.x = mn.x - mn.warp.w / 2
  mn.warp.y = mn.y - mn.warp.h / 2
  // se a Lua passar sem ser acertada, volta pro topo (retry, sem soft-lock)
  if (mn.y - mn.r > H) mn.y = -mn.r
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
  if (roll < 0.35) type = 'fuel'
  else if (roll < 0.675) type = 'asteroid'
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
  const cd = shipStats.fireCd
  if (s.time - s.lastFire < cd) return
  s.lastFire = s.time
  const p = s.player
  s.bullets.push({
    x: p.x + p.w / 2 - shipStats.bulletW / 2,
    y: p.y - 4,
    w: shipStats.bulletW,
    h: shipStats.bulletH,
    damage: shipStats.damage,
  })
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function spawnExplosion(s, x, y) {
  const colors = ['#fff3b0', '#ffcf3a', '#ff8a1a', '#ff5230', '#c9403a']
  for (let i = 0; i < 30; i++) {
    const ang = rand(0, Math.PI * 2)
    const spd = rand(40, 230)
    const dur = rand(0.5, 1.1)
    s.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      t: dur, dur,
      size: rand(1.5, 4),
      c: colors[Math.floor(rand(0, colors.length))],
    })
  }
}

function updateParticles(s, dt) {
  for (const q of s.particles) {
    q.x += q.vx * dt
    q.y += q.vy * dt
    const drag = Math.min(1, 2.4 * dt)
    q.vx -= q.vx * drag
    q.vy -= q.vy * drag
    q.t -= dt
  }
  s.particles = s.particles.filter((q) => q.t > 0)
}

function respawnPlayer(s) {
  const p = s.player
  const band = bankAt(s, p.y + p.h / 2)
  p.x = (band.left + band.right) / 2 - p.w / 2   // nasce no meio do caminho permitido
  s.fuel = s.fuelMax
  fuelPct.value = 100
  s.shield = shipStats.shield                    // escudo recarrega a cada vida
  shield.value = s.shield
  s.invuln = RESPAWN_INVULN * shipStats.armor
  s.speed = BASE_SPEED
  s.enemies = s.enemies.filter((e) => e.y < p.y - 160)
}

// Dano por impacto: o escudo absorve 1 acerto por nível antes de custar uma vida.
function damagePlayer(s) {
  if (s.respawn > 0 || s.invuln > 0) return
  if (s.shield > 0) {
    s.shield--
    shield.value = s.shield
    s.invuln = SHIELD_INVULN
    s.goldFlash = GOLD_DUR         // flash rápido de feedback ao absorver
    return
  }
  killPlayer(s)
}

function killPlayer(s) {
  if (s.respawn > 0) return           // já está explodindo
  const p = s.player
  spawnExplosion(s, p.x + p.w / 2, p.y + p.h / 2)
  s.lives--
  lives.value = s.lives
  s.respawn = RESPAWN_DELAY
}

function update(dt, s) {
  s.time += dt * 1000
  updateParticles(s, dt)

  // sequência de morte: explode, congela o mundo por ~2s, depois renasce
  if (s.respawn > 0) {
    s.respawn -= dt * 1000
    if (s.respawn <= 0) {
      s.respawn = 0
      if (s.lives <= 0) { s.over = true; settleRun(shipStats.deathKeep); phase.value = 'over' }
      else respawnPlayer(s)
    }
    return
  }

  // aceleração / desaceleração
  const maxSpd = MAX_SPEED * shipStats.maxSpeedMul
  const accel = 260 * shipStats.accelMul
  const cruise = BASE_SPEED * shipStats.cruiseMul
  if (keys.up) s.speed = Math.min(maxSpd, s.speed + accel * dt)
  else if (keys.down) s.speed = Math.max(MIN_SPEED, s.speed - accel * dt)
  else s.speed += (cruise - s.speed) * Math.min(1, dt * 2)

  const move = s.speed * dt
  s.distance += move

  while (s.distance >= s.nextWarpAt && s.warpSegment < 5) spawnWarp(s)

  // fim do percurso → a Lua surge no topo; jogador precisa mirar no portal dela.
  // distância continua contando (em sincronia com a Lua descendo) até o portal
  // alcançar o player, quando a barra chega a 100%.
  if (s.distance >= GOAL_DISTANCE) s.moonActive = true

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
  // poeira estelar e nebulosa das laterais
  for (const d of s.dust) {
    d.y += move * d.p
    if (d.y > H + 2) { d.y -= H + 4; d.x = rand(0, W) }
  }
  for (const n of s.nebula) {
    n.y += move * n.p
    if (n.y - n.r > H) { n.y -= H + 2 * n.r; n.x = rand(0, W) }
  }

  // jogador
  const p = s.player
  const pv = 240 * shipStats.agility
  if (keys.left) p.x -= pv * dt
  if (keys.right) p.x += pv * dt
  p.x = Math.max(2, Math.min(W - p.w - 2, p.x))

  // combustível
  s.fuel -= (5 * (s.speed / BASE_SPEED) * shipStats.fuelUse) * dt
  if (s.invuln > 0) s.invuln -= dt * 1000
  if (s.goldFlash > 0) s.goldFlash -= dt * 1000

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

  // warps laterais
  for (const w of s.warps) w.y += move
  s.warps = s.warps.filter((w) => w.alive && w.y < H + 40)

  // Lua-destino no topo (após concluir o percurso)
  updateMoon(s, move)

  // tiros x inimigos
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.alive && hit(b, e)) {
        e.alive = false
        b.y = -999
        s.score += Math.floor((e.type === 'asteroid' ? 60 : e.type === 'meteor' ? 90 : 40) * (b.damage ?? 1))
        s.coinAcc += (COIN_REWARDS[e.type] ?? DEFAULT_COIN_REWARD) * shipStats.coinMul
        const coinPayout = Math.floor(s.coinAcc)
        s.coinAcc -= coinPayout
        if (coinPayout > 0) {
          s.runCoins += coinPayout
          runCoins.value = s.runCoins
        }
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
      damagePlayer(s)
    }
  }

  // colisão com inimigos / reabastecimento
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (hit(p, e)) {
      if (e.type === 'fuel') {
        e.alive = false
        s.fuel = Math.min(s.fuelMax, s.fuel + Math.round(FUEL_REFILL * shipStats.fuelPickupMul))
        s.goldFlash = GOLD_DUR
      } else if (s.invuln <= 0) {
        e.alive = false
        damagePlayer(s)
      }
    }
  }

  // colisão com warp lateral → mini game
  for (const w of s.warps) {
    if (!w.alive) continue
    if (hit(p, w)) {
      w.alive = false
      enterMinigame(w)
      return
    }
  }

  // colisão com o portal da Lua → clímax: pouso na Lua
  if (s.moonActive && s.moon && s.moon.warp.alive && hit(p, s.moon.warp)) {
    s.moon.warp.alive = false
    s.over = true
    settleRun(1)          // percurso concluído → guarda as moedas da corrida
    enterMoon()
    return
  }

  // acabou o combustível
  if (s.fuel <= 0) { s.fuel = 0; killPlayer(s) }

  // pontuação por distância
  s.score += move * 0.02

  // sincroniza HUD
  score.value = Math.floor(s.score)
  fuelPct.value = Math.max(0, Math.round((s.fuel / s.fuelMax) * 100))
  speedLabel.value = (s.speed / BASE_SPEED).toFixed(1) + 'x'
  progressPct.value = Math.min(100, (s.distance / PROGRESS_GOAL) * 100)
}

// ---- Render ----
function draw(s) {
  const rows = [...s.rows].sort((a, b) => a.y - b.y)

  // 1. laterais = poeira estelar: base de nebulosa
  const wg = ctx.createLinearGradient(0, 0, 0, H)
  wg.addColorStop(0, '#2a2142')
  wg.addColorStop(1, '#191228')
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, W, H)

  // 2. nuvens de nebulosa
  for (const n of s.nebula) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
    g.addColorStop(0, n.c)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
  }

  // 3. poeira estelar (partículas por toda a largura; o canal cobre o centro)
  for (const d of s.dust) {
    ctx.globalAlpha = d.a
    ctx.fillStyle = d.c
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // 4. canal = espaço vazio (cobre o meio, deixando a poeira só nas laterais)
  ctx.fillStyle = '#04040a'
  ctx.beginPath()
  ctx.moveTo(rows[0].left, rows[0].y)
  for (let i = 0; i < rows.length; i++) ctx.lineTo(rows[i].left, rows[i].y + ROW_H)
  for (let i = rows.length - 1; i >= 0; i--) ctx.lineTo(rows[i].right, rows[i].y + ROW_H)
  ctx.lineTo(rows[0].right, rows[0].y)
  ctx.closePath()
  ctx.fill()

  // 5. borda brilhante do canal (limite navegável)
  ctx.save()
  ctx.shadowColor = '#9b7bff'
  ctx.shadowBlur = 8
  ctx.strokeStyle = 'rgba(184,156,255,0.75)'
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
  ctx.restore()

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

  // Lua-destino descendo no topo (mesma imagem da tela de pouso) + portal alvo
  if (s.moonActive && s.moon) {
    const mn = s.moon
    drawMoon(ctx, mn.x, mn.y, mn.r)
    if (mn.warp.alive) {
      const pulse = 0.7 + 0.3 * Math.sin(s.time / 200)
      ctx.save()
      ctx.strokeStyle = '#9b7bff'
      ctx.shadowColor = '#9b7bff'
      ctx.shadowBlur = 12 + 10 * pulse
      ctx.globalAlpha = 0.6 + 0.4 * pulse
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(mn.x, mn.y, mn.warp.w / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // warps laterais (setas coloridas)
  for (const w of s.warps) {
    if (!w.alive) continue
    const pulse = 0.7 + 0.3 * Math.sin(s.time / 200 + w.segment)
    ctx.save()
    ctx.shadowColor = w.color
    ctx.shadowBlur = 10 + 8 * pulse
    ctx.fillStyle = w.color
    ctx.globalAlpha = 0.85 + 0.15 * pulse
    ctx.beginPath()
    if (w.side === 'left') {
      ctx.moveTo(w.x, w.y + w.h / 2)
      ctx.lineTo(w.x + w.w, w.y + 4)
      ctx.lineTo(w.x + w.w, w.y + w.h - 4)
    } else {
      ctx.moveTo(w.x + w.w, w.y + w.h / 2)
      ctx.lineTo(w.x, w.y + 4)
      ctx.lineTo(w.x, w.y + w.h - 4)
    }
    ctx.closePath()
    ctx.fill()
    // anel do portal na lateral
    ctx.globalAlpha = 0.5 + 0.3 * pulse
    ctx.strokeStyle = w.color
    ctx.lineWidth = 2
    const cx = w.side === 'left' ? w.x + w.w * 0.35 : w.x + w.w * 0.65
    ctx.beginPath()
    ctx.arc(cx, w.y + w.h / 2, w.h * 0.38, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // inimigos
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (e.type === 'fuel') {
      const x = e.x, y = e.y, w = e.w, h = e.h
      // corpo do galão
      ctx.fillStyle = '#d0392e'
      ctx.beginPath()
      ctx.roundRect(x + 2, y + 8, w - 4, h - 9, 3)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#7a1f18'
      ctx.stroke()
      // alça no topo (com furo vazado)
      ctx.fillStyle = '#c23528'
      ctx.beginPath()
      ctx.roundRect(x + 4, y + 1, w - 8, 8, 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#04040a'
      ctx.beginPath()
      ctx.roundRect(x + 8, y + 3, w - 16, 3, 1.5)
      ctx.fill()
      // bico / tampa
      ctx.fillStyle = '#2f2f35'
      ctx.fillRect(x + w - 11, y - 1, 5, 4)
      // detalhe X embossado
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + 5, y + 12)
      ctx.lineTo(x + w - 5, y + h - 3)
      ctx.moveTo(x + w - 5, y + 12)
      ctx.lineTo(x + 5, y + h - 3)
      ctx.stroke()
      // gota de combustível (amarela)
      ctx.fillStyle = '#ffd24d'
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h * 0.62, 2.4, 0, Math.PI * 2)
      ctx.fill()
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
  for (const b of s.bullets) {
    ctx.fillStyle = shipStats.bulletColor
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }

  // jogador (foguete montado) — some durante a explosão
  const p = s.player
  const blink = s.invuln > 0 && Math.floor(s.time / 120) % 2 === 0
  if (!blink && s.respawn <= 0) {
    const gi = s.goldFlash > 0 ? s.goldFlash / GOLD_DUR : 0
    if (gi > 0) {
      ctx.save()
      ctx.shadowColor = '#ffcf3a'
      ctx.shadowBlur = 6 + 20 * gi
    }
    drawShip(ctx, p.x, p.y, p.w, p.h, shipLoadout, s.time, { goldTint: gi })
    if (gi > 0) ctx.restore()
  }

  // partículas de explosão
  for (const q of s.particles) {
    ctx.globalAlpha = Math.max(0, q.t / q.dur)
    ctx.fillStyle = q.c
    ctx.beginPath()
    ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function frame(ts) {
  if (!last) last = ts
  let dt = (ts - last) / 1000
  last = ts
  if (dt > 0.05) dt = 0.05

  if (phase.value === 'playing') {
    // canvas remonta ao voltar de fases que trocam a view (ex.: moon) → reobtém o ctx
    if (canvas.value && ctx?.canvas !== canvas.value) ctx = canvas.value.getContext('2d')
    update(dt, state)
    draw(state)
  }
  raf = requestAnimationFrame(frame)
}

// ---- Controles ----
function enterHangar() {
  phase.value = 'hangar'
}

function enterMoon() {
  fuelPct.value = 100
  speedLabel.value = '0'
  phase.value = 'moon'
}

function playIntro() {
  phase.value = 'intro'
}

function startGame(loadout) {
  const config = { ...DEFAULT_LOADOUT, ...(loadout ?? hangarLoadout.value) }
  shipLoadout = config
  shipStats = buildShipStats(shipLoadout)
  state = newState()
  state.player.w = shipStats.hitboxW
  state.player.h = shipStats.hitboxH
  state.player.x = W / 2 - state.player.w / 2
  state.lives = shipStats.startLives
  state.fuelMax = shipStats.fuelMax
  state.fuel = shipStats.fuelMax
  state.shield = shipStats.shield
  score.value = 0
  lives.value = shipStats.startLives
  shield.value = shipStats.shield
  runCoins.value = 0
  runKept.value = 0
  deathLossPct.value = Math.round((1 - shipStats.deathKeep) * 100)
  fuelPct.value = 100
  progressPct.value = 0
  phase.value = 'playing'
  last = 0
}

function togglePause() {
  if (phase.value === 'playing') phase.value = 'paused'
  else if (phase.value === 'paused') { phase.value = 'playing'; last = 0 }
}

function enterMinigame(warp) {
  activeMinigame.value = { segment: warp.segment, color: warp.color }
  phase.value = 'minigame'
}

function exitMinigame() {
  phase.value = 'playing'
  last = 0
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
  if (k === 'enter' && down) {
    if (phase.value === 'start') playIntro()
    else if (phase.value === 'over') enterHangar()
    else if (phase.value === 'hangar') startGame()
  }
  if (k === 'escape' && down && phase.value === 'hangar') phase.value = 'start'
  // TODO: disparar 'moon' pela condição de vitória do River Raid (altitude/distância).
  // Por ora acessível pra teste isolado via botão no start ou tecla M.
  if (k === 'm' && down && (phase.value === 'start' || phase.value === 'over')) enterMoon()
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
    fireHold = setInterval(() => { if (phase.value === 'playing') fire(state) }, shipStats.fireCd)
  } else if (fireHold) { clearInterval(fireHold); fireHold = null }
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  loadBank()
  loadUpgrades()
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
    <div class="rr-main">
      <div class="rr-stage">
        <MoonLanding
          v-if="phase === 'moon'"
          :loadout="hangarLoadout"
          :width="W"
          :height="H"
          @reward="addCoins"
          @fuel="fuelPct = $event"
          @speed="speedLabel = $event"
          @exit="phase = 'start'"
        />

        <template v-else>
        <canvas ref="canvas" :width="W" :height="H"></canvas>

        <IntroScreen v-if="phase === 'intro'" @done="enterHangar" />

        <StartScreen v-else-if="phase === 'start'" class="rr-hangar" @play="playIntro" />
        <button v-if="phase === 'start'" class="rr-moon-btn" @click="enterMoon">🌙 Testar pouso na Lua</button>

        <HangarScreen
          v-else-if="phase === 'hangar'"
          v-model:loadout="hangarLoadout"
          v-model:coins="bank"
          class="rr-hangar"
          @launch="startGame"
          @back="phase = 'start'"
        />

        <MinigameScreen
          v-else-if="phase === 'minigame'"
          class="rr-hangar"
          :segment="activeMinigame.segment"
          :color="activeMinigame.color"
          @back="exitMinigame"
        />

        <div v-else-if="phase === 'paused'" class="rr-overlay">
          <h2>Pausado</h2>
          <p>Respira, Gugu.</p>
          <button @click="togglePause">▶ Continuar</button>
        </div>

        <div v-else-if="phase === 'over'" class="rr-overlay">
          <h2>Fim de jogo</h2>
          <p>Foi mal, pai... quase lá.</p>
          <p>Pontuação: <b>{{ score }}</b></p>
          <p class="rr-loot">🪙 {{ runCoins }} na corrida · guardou <b>{{ runKept }}</b> (perdeu {{ deathLossPct }}%)</p>
          <button @click="enterHangar">↻ Jogar de novo</button>
        </div>

        <div v-else-if="phase === 'won'" class="rr-overlay">
          <h2>A LUA! 🌙</h2>
          <p>Gugu conseguiu! Que vista, hein?</p>
          <p>Pontuação: <b>{{ score }}</b></p>
          <p class="rr-loot">🪙 guardou <b>{{ runKept }}</b> no banco</p>
          <button @click="enterHangar">↻ Jogar de novo</button>
        </div>

        <div
          v-if="phase === 'playing' || phase === 'paused'"
          class="rr-progress"
          :title="Math.round(progressPct) + '%'"
        >
          <div class="rr-progress-fill" :style="{ height: progressPct + '%' }"></div>
          <span class="rr-progress-flag">🏁</span>
        </div>
        </template>
      </div>

      <aside class="rr-panel">
        <h1 class="rr-title">GUGU</h1>

        <div class="rr-stat">
          <span class="rr-stat-label">Pontos</span>
          <span class="rr-stat-value">{{ score }}</span>
        </div>

        <div class="rr-stat">
          <span class="rr-stat-label">{{ ['playing', 'paused', 'minigame'].includes(phase) ? 'Corrida' : 'Banco' }}</span>
          <span class="rr-stat-value rr-coins">🪙 {{ displayCoins }}</span>
        </div>

        <div class="rr-stat">
          <span class="rr-stat-label">Vidas</span>
          <span class="rr-lives">
            <span v-for="n in displayLives" :key="n" class="rr-life">🚀</span>
            <span v-if="displayLives <= 0" class="rr-dash">—</span>
          </span>
        </div>

        <div v-if="displayShield > 0 || phase === 'playing'" class="rr-stat">
          <span class="rr-stat-label">Escudo</span>
          <span class="rr-lives">
            <span v-for="n in displayShield" :key="n" class="rr-life rr-shield">🛡️</span>
            <span v-if="displayShield <= 0" class="rr-dash">—</span>
          </span>
        </div>

        <div class="rr-stat">
          <span class="rr-stat-label">Velocidade</span>
          <span class="rr-stat-value">{{ speedLabel }}</span>
        </div>

        <div class="rr-stat rr-stat-fuel">
          <span class="rr-stat-label">Combustível</span>
          <div class="rr-fuel">
            <div class="rr-fuel-bar" :style="{ width: fuelPct + '%' }"
                 :class="{ low: fuelPct < 25 }"></div>
            <span class="rr-fuel-label">{{ fuelPct }}%</span>
          </div>
        </div>
      </aside>
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
  --hud-dim: #8f83b3;
  --hud-glow: rgba(155, 123, 255, 0.65);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px;
  font-family: 'Orbitron', ui-monospace, Consolas, monospace;
}

.rr-main {
  display: flex;
  align-items: stretch;
  gap: 16px;
}

.rr-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  width: 200px;
  padding: 18px 16px;
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(52, 40, 84, 0.6), rgba(18, 13, 32, 0.72));
  border: 1px solid rgba(155, 123, 255, 0.35);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.4), inset 0 0 34px rgba(120, 90, 220, 0.09);
}

.rr-title {
  margin: 0 0 2px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 1.4rem;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 0 12px var(--hud-glow), 0 3px 0 #4a2f8f;
}

.rr-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.rr-stat-fuel { margin-top: auto; align-self: stretch; }

.rr-stat-label {
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--hud-dim);
}

.rr-stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 10px var(--hud-glow);
  font-variant-numeric: tabular-nums;
}
.rr-coins {
  color: #ffd24d;
  text-shadow: 0 0 10px rgba(255, 207, 58, 0.6);
}

.rr-lives {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  font-size: 1.5rem;
  line-height: 1;
  min-height: 1.5rem;
}
.rr-life { filter: drop-shadow(0 0 5px rgba(255, 207, 58, 0.6)); }
.rr-shield { filter: drop-shadow(0 0 5px rgba(120, 180, 255, 0.7)); }
.rr-dash { color: var(--hud-dim); }

.rr-fuel {
  position: relative;
  width: 100%;
  height: 22px;
  margin-top: 4px;
  background: #17121f;
  border: 1px solid rgba(155, 123, 255, 0.3);
  border-radius: 6px;
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
  font-size: 12px;
  font-weight: 700;
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
  background: #191228;
}
.rr-hangar {
  position: absolute;
  inset: 0;
}
.rr-progress {
  position: absolute;
  top: 10px;
  bottom: 10px;
  right: 8px;
  width: 10px;
  border-radius: 6px;
  background: rgba(23, 18, 31, 0.7);
  border: 1px solid rgba(155, 123, 255, 0.35);
  overflow: hidden;
  z-index: 2;
  pointer-events: none;
}
.rr-progress-fill {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(0deg, #37e0a0, #12c2c2, #9b7bff);
  box-shadow: 0 0 8px rgba(155, 123, 255, 0.6);
  transition: height 0.15s linear;
}
.rr-progress-flag {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  line-height: 1;
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
.rr-overlay h2 {
  margin: 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 1.2rem;
  line-height: 1.4;
  text-shadow: 0 0 12px var(--hud-glow), 0 3px 0 #4a2f8f;
}
.rr-overlay p { margin: 0; line-height: 1.5; }
.rr-keys { font-size: 0.8rem; opacity: 0.8; }
.rr-loot { font-size: 0.85rem; color: #ffd24d; }
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
.rr-moon-btn {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 5;
  padding: 8px 18px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(18, 13, 32, 0.72);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 8px;
  color: #c9c1e6;
  cursor: pointer;
}
.rr-moon-btn:hover { filter: brightness(1.2); }
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

/* Telas estreitas: painel desce e vira uma faixa de status */
@media (max-width: 720px) {
  .rr-main { flex-direction: column; align-items: center; }
  .rr-panel {
    width: var(--gw);
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px 20px;
    padding: 12px 14px;
  }
  .rr-title {
    width: 100%;
    text-align: center;
    font-size: 1.1rem;
    line-height: 1.1;
    margin: 0;
  }
  .rr-stat-value { font-size: 1.5rem; }
  .rr-lives { font-size: 1.2rem; }
  .rr-stat-fuel { margin-top: 0; flex: 1 1 100%; }
}
</style>
