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
const RESPAWN_DELAY = 1000           // ms de explosão antes de renascer
const GOLD_DUR = 450                 // ms de brilho dourado ao pegar combustível

// ---- Economia (moedas persistidas entre partidas) ----
const COINS_KEY = 'capim-marandu:coins'   // contrato com a branch do Hangar
// Recompensa de moedas por tipo destruído. Para novos vilões, basta
// adicionar a entrada aqui; tipos não mapeados usam DEFAULT_COIN_REWARD.
const COIN_REWARDS = { asteroid: 1, meteor: 1, fuel: 1 }
const DEFAULT_COIN_REWARD = 1

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
  if (s.time - s.lastFire < FIRE_CD) return
  s.lastFire = s.time
  s.bullets.push({ x: s.player.x + s.player.w / 2 - 2, y: s.player.y - 4, w: 4, h: 12 })
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
  s.fuel = FUEL_MAX
  fuelPct.value = 100
  s.invuln = RESPAWN_INVULN
  s.speed = BASE_SPEED
  s.enemies = s.enemies.filter((e) => e.y < p.y - 160)
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
      if (s.lives <= 0) { s.over = true; phase.value = 'over' }
      else respawnPlayer(s)
    }
    return
  }

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
  const pv = 240
  if (keys.left) p.x -= pv * dt
  if (keys.right) p.x += pv * dt
  p.x = Math.max(2, Math.min(W - p.w - 2, p.x))

  // combustível
  s.fuel -= (5 * (s.speed / BASE_SPEED)) * dt
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

  // tiros x inimigos
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.alive && hit(b, e)) {
        e.alive = false
        b.y = -999
        s.score += e.type === 'asteroid' ? 60 : e.type === 'meteor' ? 90 : 40
        addCoins(COIN_REWARDS[e.type] ?? DEFAULT_COIN_REWARD)
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
      killPlayer(s)
    }
  }

  // colisão com inimigos / reabastecimento
  for (const e of s.enemies) {
    if (!e.alive) continue
    if (hit(p, e)) {
      if (e.type === 'fuel') {
        e.alive = false
        s.fuel = Math.min(FUEL_MAX, s.fuel + 60)
        s.goldFlash = GOLD_DUR
      } else if (s.invuln <= 0) {
        e.alive = false
        killPlayer(s)
      }
    }
  }

  // acabou o combustível
  if (s.fuel <= 0) { s.fuel = 0; killPlayer(s) }

  // pontuação por distância
  s.score += move * 0.02

  // sincroniza HUD
  score.value = Math.floor(s.score)
  fuelPct.value = Math.max(0, Math.round((s.fuel / FUEL_MAX) * 100))
  speedLabel.value = (s.speed / BASE_SPEED).toFixed(1) + 'x'
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
  ctx.fillStyle = '#ffe14d'
  for (const b of s.bullets) ctx.fillRect(b.x, b.y, b.w, b.h)

  // jogador (foguete) — some durante a explosão
  const p = s.player
  const blink = s.invuln > 0 && Math.floor(s.time / 120) % 2 === 0
  if (!blink && s.respawn <= 0) {
    const cx = p.x + p.w / 2
    const top = p.y
    const bw = 7 // meia-largura do corpo

    // brilho dourado ao pegar combustível
    const gi = s.goldFlash > 0 ? s.goldFlash / GOLD_DUR : 0
    if (gi > 0) {
      ctx.save()
      ctx.shadowColor = '#ffcf3a'
      ctx.shadowBlur = 6 + 20 * gi
    }
    const bodyColor = gi > 0 ? '#ffd34d' : '#f4f4f4'
    const trimColor = gi > 0 ? '#e0a020' : '#c9403a'

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
    ctx.fillStyle = trimColor
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
    ctx.fillStyle = bodyColor
    ctx.fillRect(cx - bw, top + 9, bw * 2, p.h - 12)
    // bico
    ctx.fillStyle = trimColor
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
    <div class="rr-main">
      <div class="rr-stage">
        <canvas ref="canvas" :width="W" :height="H"></canvas>

        <div v-if="phase === 'start'" class="rr-overlay">
          <h2>River Raid</h2>
          <p>Pilote o foguete, desvie da nebulosa,<br>destrua asteroides e meteoros, pegue o combustível.</p>
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

      <aside class="rr-panel">
        <h1 class="rr-title">River Raid</h1>

        <div class="rr-stat">
          <span class="rr-stat-label">Pontos</span>
          <span class="rr-stat-value">{{ score }}</span>
        </div>

        <div class="rr-stat">
          <span class="rr-stat-label">Moedas</span>
          <span class="rr-stat-value rr-coins">🪙 {{ coins }}</span>
        </div>

        <div class="rr-stat">
          <span class="rr-stat-label">Vidas</span>
          <span class="rr-lives">
            <span v-for="n in lives" :key="n" class="rr-life">🚀</span>
            <span v-if="lives <= 0" class="rr-dash">—</span>
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
  font-size: 2rem;
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 0 12px var(--hud-glow), 0 0 2px #fff;
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
    font-size: 1.4rem;
    line-height: 1;
    margin: 0;
  }
  .rr-stat-value { font-size: 1.5rem; }
  .rr-lives { font-size: 1.2rem; }
  .rr-stat-fuel { margin-top: 0; flex: 1 1 100%; }
}
</style>
