<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import HangarScreen from './HangarScreen.vue'
import MoonLanding from './MoonLanding.vue'
import MinigameScreen from './MinigameScreen.vue'
import AbductionGame from './AbductionGame.vue'
import MarioGame from './MarioGame.vue'
import BossBattle from './BossBattle.vue'
import BattleTransition from './BattleTransition.vue'
import IntroScreen from './IntroScreen.vue'
import StartScreen from './StartScreen.vue'
import MoonApproach from './MoonApproach.vue'
import FinalCutscene from './FinalCutscene.vue'
import MinigamesMenu from './MinigamesMenu.vue'
import AchievementsScreen from './AchievementsScreen.vue'
import SaveScreen from './SaveScreen.vue'
import { DEFAULT_LOADOUT, buildShipStats, drawShip, drawMoon } from '../data/shipParts.js'
import { playFuel, playExplosion, setThrust, playShot, startPlasmaCharge, stopPlasmaCharge, playPlasmaFire, playPlasmaReady, startGameMusic, stopMusic } from '../audio/sfx.js'
import { drawSprite, SATELLITE, SPACE_JUNK } from '../data/pixelSprites.js'
import { unlock as unlockAchievement } from '../data/achievements.js'
import { slotKey, setSlot } from '../data/saves.js'
// Acessos diretos aos minigames de teste só existem em desenvolvimento.
// No build (GitHub Pages) import.meta.env.DEV é false → botões escondidos.
const isDev = import.meta.env.DEV
const W = 480
const H = 640
const ROW_H = 16                     // altura de cada faixa do terreno
const N_ROWS = Math.ceil(H / ROW_H) + 3

// ---- HUD reativo ----
const phase = ref('start')           // 'start' | 'intro' | 'saves' | 'minigames' | 'hangar' | 'playing' | 'paused' | 'minigame' | 'boss' | 'approach' | 'moon' | 'ending' | 'achievements' | 'over' | 'won'
const activeMinigame = ref({ segment: 1, color: '#ff4d4d', game: 'placeholder' })
let minigameFromStart = false        // true quando o minigame foi aberto pelo menu (teste, sem corrida)
let bossFromMenu = false             // true quando o chefe foi aberto pelo menu de mini-games
const score = ref(0)
const lives = ref(3)
const shield = ref(0)
const bossHp = ref(0)        // HP do jogador durante a luta contra o chefe (barra lateral)
const transition = ref(false)  // máscara de transição ativa (entra/sai da arena do chefe)
const transitionJingle = ref('battle')  // 'battle' toca o sting; 'none' silêncio
let pendingPhase = null        // fase a assumir quando a máscara cobrir a tela
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
  if (phase.value === 'boss') return bossHp.value   // no chefe, VIDAS = HP da batalha
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
// Comprimento do percurso (px de rolagem até a Lua). Dois modos:
const SHORT_GOAL = 2600              // corrida curta (teste/dev) — fecha o fluxo rápido
const LONG_GOAL = 24000             // corrida normal — bem mais longa
const MIN_CHANNEL = 96               // largura mínima navegável do rio
const MARGIN = 34                    // margem das margens em relação à borda
const RESPAWN_INVULN = 1800          // ms de invulnerabilidade após reviver
const RESPAWN_DELAY = 1000           // ms de explosão antes de renascer
const SHIELD_INVULN = 900            // ms de invuln ao absorver 1 impacto no escudo
const GOLD_DUR = 450                 // ms de brilho dourado ao pegar combustível

// ---- Plasma carregável (feixe perfurante) ----
const PLASMA_MIN_CHARGE = 150        // ms mínimos de carga para disparar
const PLASMA_MAX_CHARGE = 1600       // ms de carga máxima
const PLASMA_MIN_W = 10              // largura do feixe na carga mínima
const PLASMA_MAX_W = 64              // largura do feixe na carga máxima
const PLASMA_LEN = 260               // comprimento do feixe (px)

// ---- Economia (persistida por slot de save; ver saves.js → slotKey) ----
// Todo progresso é gravado em capim-marandu:s<N>:<nome>, com N = slot ativo.
// Recompensa de moedas por tipo destruído. Para novos vilões, basta
// adicionar a entrada aqui; tipos não mapeados usam DEFAULT_COIN_REWARD.
const COIN_REWARDS = { asteroid: 1, meteor: 1, fuel: 1, satellite: 2, junk: 1 }
const DEFAULT_COIN_REWARD = 1

// Pontos e tamanho (w, h) por tipo de objeto voador.
const SCORE_BY_TYPE = { asteroid: 60, meteor: 90, fuel: 40, satellite: 80, junk: 55 }
const ENEMY_SIZE = {
  fuel: [26, 30],
  asteroid: [40, 36],
  meteor: [30, 28],
  satellite: [45, 24],   // 15x8 do sprite * escala 3
  junk: [30, 27],        // 10x9 do sprite * escala 3
}

// ---- Warps de mini game: 5 portais espalhados pelo percurso ----
// intervalo = goal / (5 + 1), calculado por corrida (curta ou longa) em startGame.
const WARP_SEGMENTS = 5
const WARP_COLORS = ['#ff4d4d', '#ffd24d', '#37e0a0', '#9b7bff', '#ff8a1a']
const WARP_W = 32
const WARP_H = 40
// Lua-destino no topo do percurso (6º "warp" = portal de pouso)
const MOON_R = 128                   // raio do disco da Lua
const MOON_WARP_W = 64               // hitbox do portal centralizado na Lua
const MOON_WARP_H = 64
// px que a Lua desce (do topo até o player) após o fim do percurso.
// A barra de progresso só chega a 100% quando o portal alcança o player.
const MOON_APPROACH = (H - 74) + MOON_R

const keys = {}

function rand(a, b) { return a + Math.random() * (b - a) }

// contadores acumulados, persistidos no slot ativo
let lostTotal = 0      // moedas perdidas acumuladas
let deathsTotal = 0    // corridas perdidas acumuladas
let abductTotal = 0    // jogadores abduzidos acumulados
let landTotal = 0      // pousos na Lua acumulados
let installsTotal = 0  // modificações/melhorias instaladas no hangar
let spentTotal = 0     // moedas gastas no total

function loadBank() {
  bank.value = Number(localStorage.getItem(slotKey('coins'))) || 0
  lostTotal = Number(localStorage.getItem(slotKey('lost'))) || 0
  deathsTotal = Number(localStorage.getItem(slotKey('deaths'))) || 0
  abductTotal = Number(localStorage.getItem(slotKey('abduct'))) || 0
  landTotal = Number(localStorage.getItem(slotKey('land'))) || 0
  installsTotal = Number(localStorage.getItem(slotKey('installs'))) || 0
  spentTotal = Number(localStorage.getItem(slotKey('spent'))) || 0
}

// instalou peça/melhoria no hangar (custo em moedas) → conquistas
function onInstall(cost) {
  installsTotal += 1
  localStorage.setItem(slotKey('installs'), String(installsTotal))
  if (installsTotal >= 1) unlockAchievement('first-mod')
  if (installsTotal >= 5) unlockAchievement('five-upgrades')
  if (installsTotal >= 10) unlockAchievement('ten-upgrades')
  spentTotal += cost
  localStorage.setItem(slotKey('spent'), String(spentTotal))
  if (spentTotal >= 5937) unlockAchievement('big-spender')
}

// abduziu um jogador no minigame → conquistas (team 'star' = NeySea)
function onAbduct(team) {
  abductTotal += 1
  localStorage.setItem(slotKey('abduct'), String(abductTotal))
  if (abductTotal >= 10) unlockAchievement('abductor')
  if (team === 'star') unlockAchievement('abduct-neysea')
}

// perdeu a corrida (game over) → conta p/ conquista Teimoso
function tallyLoss() {
  deathsTotal += 1
  localStorage.setItem(slotKey('deaths'), String(deathsTotal))
  if (deathsTotal >= 10) unlockAchievement('ten-deaths')
}

// fecha a corrida: guarda `fraction` do que ganhou (1 = vitória, 0.25 = morte)
function settleRun(fraction) {
  runKept.value = Math.floor(runCoins.value * fraction)
  bank.value += runKept.value
  localStorage.setItem(slotKey('coins'), String(bank.value))
  // acumula moedas perdidas entre corridas → conquista Buraco Negro
  const lost = runCoins.value - runKept.value
  if (lost > 0) {
    lostTotal += lost
    localStorage.setItem(slotKey('lost'), String(lostTotal))
    if (lostTotal >= 1000) unlockAchievement('coin-loser')
  }
}

// bônus avulso direto no banco (ex.: recompensa do pouso na Lua)
function addCoins(n) {
  bank.value += n
  localStorage.setItem(slotKey('coins'), String(bank.value))
}

// carrega níveis salvos de uma trilha de upgrade (nome → loadout[field])
function loadUpgrade(name, field) {
  try {
    const saved = JSON.parse(localStorage.getItem(slotKey(name)) || 'null')
    if (saved && typeof saved === 'object') {
      hangarLoadout.value = {
        ...hangarLoadout.value,
        [field]: { ...hangarLoadout.value[field], ...saved },
      }
    }
  } catch { /* JSON inválido: ignora */ }
}

function loadUpgrades() {
  loadUpgrade('body', 'body')
  loadUpgrade('engine', 'engineUp')
}

// persiste banco (gasto no hangar) e níveis de upgrade comprados no slot ativo
watch(bank, (v) => localStorage.setItem(slotKey('coins'), String(v)))
watch(() => hangarLoadout.value.body, (b) => localStorage.setItem(slotKey('body'), JSON.stringify(b)), { deep: true })
watch(() => hangarLoadout.value.engineUp, (e) => localStorage.setItem(slotKey('engine'), JSON.stringify(e)), { deep: true })

// Nos primeiros INTRO_MS o canal fica totalmente aberto (margens só nas bordas
// da tela), dando folga perto do spawn antes das paredes começarem a fechar.
const INTRO_MS = 5000
const OPEN_LEFT = MARGIN
const OPEN_RIGHT = W - MARGIN

// ---- Gerador procedural das margens do rio ----
function makeGen() {
  // começa aberto pra transição suave quando as paredes voltam a fechar
  return { left: OPEN_LEFT, right: OPEN_RIGHT, tL: OPEN_LEFT, tR: OPEN_RIGHT, steps: 0 }
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
  // sorteia qual warp (1..5) vira cada minigame, sempre em warps diferentes
  const abductionSegment = Math.floor(rand(1, 6))
  let marioSegment = Math.floor(rand(1, 5))
  if (marioSegment >= abductionSegment) marioSegment++
  const gen = makeGen()
  const rows = []
  // spawn começa com o canal aberto (paredes só nas bordas)
  for (let i = 0; i < N_ROWS; i++) {
    rows.push({ y: H - i * ROW_H, left: OPEN_LEFT, right: OPEN_RIGHT })
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
    // percurso: valores padrão (curto); startGame ajusta conforme o modo
    goal: SHORT_GOAL,
    warpInterval: SHORT_GOAL / (WARP_SEGMENTS + 1),
    progressGoal: SHORT_GOAL + MOON_APPROACH,
    nextWarpAt: SHORT_GOAL / (WARP_SEGMENTS + 1),
    warpSegment: 0,
    bossDone: false,                            // chefe na metade do percurso (uma vez)
    abductionSegment,
    marioSegment,
    coinAcc: 0,
    runCoins: 0,
    fuelKills: 0,
    charging: false,
    chargeStart: 0,
    plasmaCd: 0,
    moonActive: false,   // percurso concluído → Lua desce no topo
    moon: null,          // { x, y, r, warp:{x,y,w,h,alive} }
  }
}

function spawnWarp(s) {
  if (s.warpSegment >= WARP_SEGMENTS) return
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
  s.nextWarpAt += s.warpInterval
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
  if (roll < 0.30) type = 'fuel'
  else if (roll < 0.50) type = 'asteroid'
  else if (roll < 0.68) type = 'meteor'
  else if (roll < 0.84) type = 'junk'
  else type = 'satellite'
  const [w, h] = ENEMY_SIZE[type]
  const lo = top.left + 6
  const hi = top.right - w - 6
  const x = hi > lo ? rand(lo, hi) : (top.left + top.right) / 2 - w / 2
  const dir = Math.random() < 0.5 ? -1 : 1
  const vx = type === 'fuel' ? 0 : (type === 'satellite' ? rand(25, 55) : rand(40, 95)) * dir
  const spin = type === 'asteroid' ? rand(-2, 2) : 0
  s.enemies.push({ type, x, y: -h - 4, w, h, vx, spin, rot: 0, alive: true })
}

function spawnBullet(s, cx) {
  const p = s.player
  s.bullets.push({
    x: cx - shipStats.bulletW / 2,
    y: p.y - 4,
    w: shipStats.bulletW,
    h: shipStats.bulletH,
    damage: shipStats.damage,
  })
}

function fire(s) {
  const cd = shipStats.fireCd
  if (s.time - s.lastFire < cd) return
  s.lastFire = s.time
  const p = s.player
  const cx = p.x + p.w / 2
  if (shipStats.weaponId === 'rapid') {
    // metralhadora: dois canos separados horizontalmente
    const off = p.w * 0.45
    spawnBullet(s, cx - off)
    spawnBullet(s, cx + off)
  } else {
    spawnBullet(s, cx)
  }
  playShot(shipStats.weaponId)
}

// largura do feixe conforme a carga acumulada
function plasmaWidth(charge) {
  const r = Math.min(charge, PLASMA_MAX_CHARGE) / PLASMA_MAX_CHARGE
  return PLASMA_MIN_W + (PLASMA_MAX_W - PLASMA_MIN_W) * r
}

function startCharge(s) {
  if (shipStats.weaponId !== 'plasma') return
  if (s.plasmaCd > 0 || s.charging) return
  s.charging = true
  s.chargeStart = s.time
  startPlasmaCharge(PLASMA_MAX_CHARGE)
}

// solta o feixe: perfura tudo, e a recarga = 2x o tempo carregado
function releaseFire(s) {
  if (!s.charging) return
  s.charging = false
  stopPlasmaCharge()
  const charge = Math.min(s.time - s.chargeStart, PLASMA_MAX_CHARGE)
  if (charge < PLASMA_MIN_CHARGE) return   // carga curta demais: cancela sem cooldown
  const p = s.player
  const w = plasmaWidth(charge)
  s.bullets.push({
    x: p.x + p.w / 2 - w / 2,
    y: p.y - PLASMA_LEN,
    w, h: PLASMA_LEN,
    damage: shipStats.damage,
    pierce: true,
    beam: true,
  })
  s.plasmaCd = charge * 2
  playPlasmaFire(charge / PLASMA_MAX_CHARGE)
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

const FIRE_COLORS = ['#fff3b0', '#ffcf3a', '#ff8a1a', '#ff5230', '#c9403a']
// paleta/tamanho da explosão por tipo de alvo destruído
const EXPLO_OPTS = {
  asteroid: { count: 20, maxSpd: 190, colors: ['#e0dcd2', '#b8b0a4', '#8c8477', '#ffcf3a', '#ff8a1a'] },
  meteor: { count: 22, maxSpd: 210, colors: FIRE_COLORS },
  fuel: { count: 24, maxSpd: 200, colors: FIRE_COLORS },
  satellite: { count: 24, maxSpd: 200, colors: ['#d5f0ff', '#6cc6ff', '#b8bcc8', '#ffd24d', '#ff8a1a'] },
  junk: { count: 20, maxSpd: 185, colors: ['#f4f4f4', '#b8bcc8', '#5c554c', '#ffd24d', '#ff8a1a'] },
}

function spawnExplosion(s, x, y, opts = {}) {
  const colors = opts.colors ?? FIRE_COLORS
  const count = opts.count ?? 30
  const maxSpd = opts.maxSpd ?? 230
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2)
    const spd = rand(40, maxSpd)
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
  playExplosion()
  s.lives--
  lives.value = s.lives
  s.respawn = RESPAWN_DELAY
}

function update(dt, s) {
  s.time += dt * 1000
  updateParticles(s, dt)

  // sequência de morte: explode, congela o mundo por ~2s, depois renasce
  if (s.respawn > 0) {
    setThrust(false)   // sem propulsão durante a explosão
    stopPlasmaCharge()
    s.charging = false
    s.respawn -= dt * 1000
    if (s.respawn <= 0) {
      s.respawn = 0
      if (s.lives <= 0) { s.over = true; settleRun(shipStats.deathKeep); tallyLoss(); phase.value = 'over' }
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
  setThrust(keys.up)   // som de propulsão enquanto acelera

  const move = s.speed * dt
  s.distance += move

  // metade do percurso → batalha contra o chefe (uma vez)
  if (!s.bossDone && s.distance >= s.goal / 2) {
    s.bossDone = true
    enterBoss()
    return
  }

  while (s.distance >= s.nextWarpAt && s.warpSegment < WARP_SEGMENTS) spawnWarp(s)

  // fim do percurso → a Lua surge no topo; jogador precisa mirar no portal dela.
  // distância continua contando (em sincronia com a Lua descendo) até o portal
  // alcançar o player, quando a barra chega a 100%.
  if (s.distance >= s.goal) s.moonActive = true

  // rolagem do terreno + reciclagem
  let minY = Infinity
  for (const r of s.rows) { r.y += move; if (r.y < minY) minY = r.y }
  for (const r of s.rows) {
    if (r.y >= H) {
      minY -= ROW_H
      // nos primeiros 10s mantém aberto; depois as paredes voltam a fechar
      const b = s.time < INTRO_MS ? { left: OPEN_LEFT, right: OPEN_RIGHT } : stepGen(s.gen)
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
  if (s.plasmaCd > 0) {
    s.plasmaCd -= dt * 1000
    if (s.plasmaCd <= 0) { s.plasmaCd = 0; playPlasmaReady() }   // munição do plasma voltou
  }

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
        if (!b.pierce) b.y = -999       // feixe de plasma atravessa e limpa o caminho
        spawnExplosion(s, e.x + e.w / 2, e.y + e.h / 2, EXPLO_OPTS[e.type])
        playExplosion()
        if (e.type === 'fuel') {
          s.fuelKills++                 // destruir 10 tanques numa corrida → conquista
          if (s.fuelKills >= 10) unlockAchievement('fuel-destroyer')
        }
        s.score += Math.floor((SCORE_BY_TYPE[e.type] ?? 40) * (b.damage ?? 1))
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
        playFuel()
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
  progressPct.value = Math.min(100, (s.distance / s.progressGoal) * 100)
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
    } else if (e.type === 'satellite') {
      drawSprite(ctx, e.x, e.y, SATELLITE, Math.round(e.w / SATELLITE[0].length))
    } else if (e.type === 'junk') {
      drawSprite(ctx, e.x, e.y, SPACE_JUNK, Math.round(e.w / SPACE_JUNK[0].length))
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
    if (b.beam) {
      ctx.save()
      ctx.shadowColor = shipStats.bulletColor
      ctx.shadowBlur = 16
      ctx.fillStyle = shipStats.bulletColor
      ctx.fillRect(b.x, b.y, b.w, b.h)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'   // núcleo branco
      ctx.fillRect(b.x + b.w * 0.32, b.y, b.w * 0.36, b.h)
      ctx.restore()
    } else {
      ctx.fillStyle = shipStats.bulletColor
      ctx.fillRect(b.x, b.y, b.w, b.h)
    }
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

    // orbe de carga do plasma no bico
    if (s.charging) {
      const charge = Math.min(s.time - s.chargeStart, PLASMA_MAX_CHARGE)
      const rad = Math.max(3, plasmaWidth(charge) / 2)
      ctx.save()
      ctx.shadowColor = shipStats.bulletColor
      ctx.shadowBlur = 14
      ctx.globalAlpha = 0.45 + 0.55 * (charge / PLASMA_MAX_CHARGE)
      ctx.fillStyle = shipStats.bulletColor
      ctx.beginPath()
      ctx.arc(p.x + p.w / 2, p.y - 2, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.globalAlpha = 1
    }
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

  if (phase.value === 'playing' && !transition.value) {
    startGameMusic()   // trilha de aventura (idempotente; religa ao entrar no jogo)
    // canvas remonta ao voltar de fases que trocam a view (ex.: moon) → reobtém o ctx
    if (canvas.value && ctx?.canvas !== canvas.value) ctx = canvas.value.getContext('2d')
    update(dt, state)
    draw(state)
  } else {
    if (phase.value !== 'moon') setThrust(false)   // na Lua quem controla a propulsão é o MoonLanding
    stopPlasmaCharge()   // pausado / hangar / moon / fim → sem zumbido de carga
    if (phase.value === 'over' || phase.value === 'won') stopMusic()   // fim de jogo → silêncio
  }
  raf = requestAnimationFrame(frame)
}

// ---- Controles ----
function enterSaves() {
  phase.value = 'saves'
}

// escolheu um slot: ativa, carrega o progresso dele e vai pro hangar
function chooseSave(n) {
  setSlot(n)
  loadBank()
  loadUpgrades()
  enterHangar()
}

function enterHangar() {
  phase.value = 'hangar'
}

let moonFromStart = false   // true = teste pela tela inicial; false = pouso real da corrida

function enterMoon(fromStart = false) {
  moonFromStart = fromStart === true
  fuelPct.value = 100
  speedLabel.value = '0'
  // cutscene de aproximação primeiro; ela emite @done → pouso ('moon')
  phase.value = 'approach'
}

// bateu no pouso = corrida encerrada (mesmo com vidas sobrando)
function onMoonCrash() {
  if (moonFromStart) return          // teste pela tela inicial: sem corrida pra encerrar
  state.over = true
  settleRun(shipStats.deathKeep)
  tallyLoss()
  lives.value = 0
}

// sai da Lua: teste volta pra tela inicial; pouso real volta pro hangar (mesmo slot)
function leaveMoon() {
  phase.value = moonFromStart ? 'minigames' : 'hangar'
}

function playIntro() {
  phase.value = 'intro'
}

// pousou na Lua = concluiu o jogo → cut scene final (plot twist) → conquistas/vitória
// (o @reward do pouso já somou no banco antes deste handler)
function onLanded() {
  unlockAchievement('first-landing')
  if (bank.value > 300) unlockAchievement('rich-landing')
  if (score.value > 2000) unlockAchievement('high-score')
  landTotal += 1
  localStorage.setItem(slotKey('land'), String(landTotal))
  if (landTotal >= 10) unlockAchievement('ten-landings')
  phase.value = 'ending'   // vai direto pra cena de diálogo (pula o overlay do pouso)
}

function startGame(payload) {
  const opts = payload || {}
  const short = opts.short === true
  const config = { ...DEFAULT_LOADOUT, ...(opts.loadout ?? hangarLoadout.value) }
  shipLoadout = config
  shipStats = buildShipStats(shipLoadout)
  state = newState()
  // define o comprimento do percurso conforme o modo
  const goal = short ? SHORT_GOAL : LONG_GOAL
  state.short = short
  state.goal = goal
  state.warpInterval = goal / (WARP_SEGMENTS + 1)
  state.nextWarpAt = goal / (WARP_SEGMENTS + 1)
  state.progressGoal = goal + MOON_APPROACH
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
  const game = warp.segment === state.abductionSegment ? 'abduction'
    : warp.segment === state.marioSegment ? 'mario'
    : 'placeholder'
  minigameFromStart = false
  activeMinigame.value = { segment: warp.segment, color: warp.color, game }
  phase.value = 'minigame'
}

// Acesso direto pelo menu de mini-games (sem precisar colidir com o warp).
function openAbduction() {
  minigameFromStart = true
  activeMinigame.value = { segment: 1, color: '#37e0a0', game: 'abduction' }
  phase.value = 'minigame'
}

function openMario() {
  minigameFromStart = true
  activeMinigame.value = { segment: 1, color: '#ff4d4d', game: 'mario' }
  phase.value = 'minigame'
}

// mapa nome → componente do minigame (tipos não mapeados caem no placeholder)
const MINIGAMES = { abduction: AbductionGame, mario: MarioGame }

// Menu de mini-games (a partir da tela inicial)
function openMinigamesMenu() {
  phase.value = 'minigames'
}

// Lança um mini-game em modo avulso (volta pro menu ao terminar).
function launchMinigame(id) {
  if (id === 'abduction') openAbduction()
  else if (id === 'mario') openMario()
  else if (id === 'moon') enterMoon(true)
  else if (id === 'boss') { bossFromMenu = true; playTransition('boss') }
}

const WARP_INVULN = 2000   // ms de invuln ao voltar do warp (não explode na parede)

function exitMinigame() {
  if (state) state.invuln = Math.max(state.invuln, WARP_INVULN)
  phase.value = 'playing'
  last = 0
}

// ---- Transição estilo Pokémon (entra/sai da arena do chefe) ----
function playTransition(next, jingle = 'battle') {
  pendingPhase = next
  transitionJingle.value = jingle
  transition.value = true
}
// máscara cobriu a tela → troca a cena por baixo dela
function onTransitionCovered() {
  if (pendingPhase == null) return
  phase.value = pendingPhase
  if (pendingPhase === 'playing') last = 0
  pendingPhase = null
}
function onTransitionDone() {
  transition.value = false
}

// ---- Chefe (metade do percurso) ----
function enterBoss() {
  bossFromMenu = false
  playTransition('boss')
}

// venceu o chefe: recompensa entra na corrida e o percurso continua
function onBossCleared(coins) {
  if (bossFromMenu) { bossFromMenu = false; phase.value = 'minigames'; return }
  const n = Math.floor(coins || 0)
  if (n > 0) {
    state.runCoins += n
    runCoins.value = state.runCoins
  }
  state.invuln = Math.max(state.invuln, WARP_INVULN)
  playTransition('playing', 'none')
}

// perdeu pro chefe: encerra a corrida (game over)
function onBossFailed() {
  if (bossFromMenu) { bossFromMenu = false; phase.value = 'minigames'; return }
  state.over = true
  settleRun(shipStats.deathKeep)
  tallyLoss()
  lives.value = 0
  playTransition('over', 'none')
}

// Volta do minigame: pra tela inicial se veio de lá, senão retoma o percurso.
function leaveMinigame() {
  if (minigameFromStart) {
    minigameFromStart = false
    phase.value = 'minigames'
  } else {
    exitMinigame()
  }
}

// Recompensa do minigame: durante a corrida vai pras moedas da corrida
// (settleRun aplica a fração no fim); fora da corrida, direto no banco.
function earnMinigame(n) {
  if (!n) return
  if (minigameFromStart || !state) {
    addCoins(n)
  } else {
    state.runCoins += n
    runCoins.value = state.runCoins
  }
}

function onKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault()
  if (k === 'arrowleft' || k === 'a') keys.left = down
  if (k === 'arrowright' || k === 'd') keys.right = down
  if (k === 'arrowup' || k === 'w') keys.up = down
  if (k === 'arrowdown' || k === 's') keys.down = down
  if (k === ' ' && phase.value === 'playing') {
    if (shipStats.weaponId === 'plasma') {
      if (down) startCharge(state); else releaseFire(state)
    } else if (down) fire(state)
  }
  if (k === 'p' && down) togglePause()
  if (k === 'enter' && down) {
    if (phase.value === 'start') playIntro()
    else if (phase.value === 'over') enterHangar()
    else if (phase.value === 'hangar') startGame()
  }
  if (k === 'escape' && down && (phase.value === 'hangar' || phase.value === 'achievements' || phase.value === 'saves')) phase.value = 'start'
  if (k === 'escape' && down && (phase.value === 'playing' || phase.value === 'paused')) togglePause()
  if (k === 'n' && down) addCoins(1000)   // atalho secreto: +1000 moedas
}

const kd = (e) => onKey(e, true)
const ku = (e) => onKey(e, false)

// botões touch
function press(dir, v) {
  if (dir === 'fire') {
    if (v && phase.value === 'playing' && shipStats.weaponId !== 'plasma') fire(state)
    return
  }
  keys[dir] = v
}

let fireHold = null
function holdFire(v) {
  if (phase.value !== 'playing') {
    if (!v && fireHold) { clearInterval(fireHold); fireHold = null }
    return
  }
  // plasma: segurar carrega, soltar dispara o feixe
  if (shipStats.weaponId === 'plasma') {
    if (v) startCharge(state); else releaseFire(state)
    return
  }
  if (v) {
    fire(state)
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
  setThrust(false)
  stopPlasmaCharge()
  stopMusic()
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
          @landed="onLanded"
          @crashed="onMoonCrash"
          @fuel="fuelPct = $event"
          @speed="speedLabel = $event"
          @exit="leaveMoon"
        />

        <template v-else>
        <canvas ref="canvas" :width="W" :height="H"></canvas>

        <IntroScreen v-if="phase === 'intro'" @done="enterSaves" />

        <MoonApproach v-else-if="phase === 'approach'" @done="phase = 'moon'" />

        <FinalCutscene v-else-if="phase === 'ending'" @done="phase = 'won'" />

        <StartScreen
          v-else-if="phase === 'start'"
          class="rr-hangar"
          @play="playIntro"
          :dev="isDev"
          @minigames="openMinigamesMenu"
        />

        <MinigamesMenu
          v-else-if="phase === 'minigames'"
          class="rr-hangar"
          @select="launchMinigame"
          @back="phase = 'start'"
        />

        <SaveScreen
          v-else-if="phase === 'saves'"
          class="rr-hangar"
          @select="chooseSave"
          @back="phase = 'start'"
        />

        <AchievementsScreen
          v-else-if="phase === 'achievements'"
          class="rr-hangar"
          @back="phase = 'hangar'"
        />

        <HangarScreen
          v-else-if="phase === 'hangar'"
          v-model:loadout="hangarLoadout"
          v-model:coins="bank"
          class="rr-hangar"
          @launch="startGame"
          @install="onInstall"
          @achievements="phase = 'achievements'"
          @back="phase = 'start'"
        />

        <component
          :is="MINIGAMES[activeMinigame.game] ?? MinigameScreen"
          v-else-if="phase === 'minigame'"
          class="rr-hangar"
          :segment="activeMinigame.segment"
          :color="activeMinigame.color"
          :loadout="hangarLoadout"
          @earn="earnMinigame"
          @abduct="onAbduct"
          @back="leaveMinigame"
        />

        <BossBattle
          v-else-if="phase === 'boss'"
          class="rr-hangar"
          :loadout="hangarLoadout"
          :width="W"
          :height="H"
          :short="state?.short"
          @hp="bossHp = $event"
          @cleared="onBossCleared"
          @failed="onBossFailed"
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
          <p>A vista cobrava pedágio... mas a viagem foi de graça.</p>
          <p><i>"Busquem conhecimento." — ET Bilu</i></p>
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

        <BattleTransition
          v-if="transition"
          :jingle="transitionJingle"
          @covered="onTransitionCovered"
          @done="onTransitionDone"
        />
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
