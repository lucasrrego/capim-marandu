export const PART_CATEGORIES = [
  { key: 'wing', label: 'Asa' },
  { key: 'body', label: 'Corpo' },
  { key: 'nose', label: 'Bico' },
  { key: 'engine', label: 'Motor' },
  { key: 'weapon', label: 'Arma' },
]

export const SHIP_PARTS = {
  wing: [
    { id: 'std', name: 'Padrão', desc: 'Equilíbrio entre manobra e resistência', wingW: 1, wingColor: '#c9403a', agility: 1, lifeBonus: 0 },
    { id: 'wide', name: 'Larga', desc: 'Manobra lenta, +1 vida', wingW: 1.35, wingColor: '#a8bdd4', agility: 0.82, lifeBonus: 1 },
    { id: 'delta', name: 'Delta', desc: 'Manobra rápida, −1 vida', wingW: 0.85, wingColor: '#c8c8c8', agility: 1.25, lifeBonus: -1 },
  ],
  nose: [
    { id: 'std', name: 'Cônico', desc: 'Perfil clássico de ataque', shape: 'cone', length: 0, tipColor: '#c9403a', coinMul: 1, fuelPickupMul: 1 },
    { id: 'sharp', name: 'Agulha', desc: '+25% moedas nos abates', shape: 'needle', length: 6, tipColor: '#ffe14d', coinMul: 1.25, fuelPickupMul: 1 },
    { id: 'blunt', name: 'Rombo', desc: '+25% combustível nos tanques F', shape: 'blunt', length: -2, tipColor: '#d0d0d0', coinMul: 1, fuelPickupMul: 1.25 },
  ],
  engine: [
    { id: 'std', name: 'Turbo', desc: 'Velocidade e consumo equilibrados', flameColor: '#ff8a1a', power: 1, maxSpeed: 1, fuelUse: 1, accelMul: 1, cruiseMul: 1 },
    { id: 'after', name: 'Pós-combustão', desc: 'Muito rápido, gasta mais combustível', flameColor: '#ff4d4d', power: 1.5, maxSpeed: 1.38, fuelUse: 1.4, accelMul: 1.5, cruiseMul: 1.08 },
    { id: 'eco', name: 'Econômico', desc: 'Lento, autonomia alta', flameColor: '#37e0a0', power: 0.7, maxSpeed: 0.82, fuelUse: 0.62, accelMul: 0.72, cruiseMul: 0.88 },
  ],
  weapon: [
    { id: 'cannon', name: 'Canhão', desc: 'Tiro único, dano padrão', bulletW: 4, bulletH: 12, bulletColor: '#ffe14d', fireCd: 200, damage: 1 },
    { id: 'rapid', name: 'Metralhadora', desc: 'Rajadas rápidas, dois canos', bulletW: 3, bulletH: 8, bulletColor: '#fff59d', fireCd: 110, damage: 0.6, lockedBy: 'rich-landing' },
    { id: 'plasma', name: 'Plasma', desc: 'Segure para carregar: feixe perfurante, recarga = 2x a carga', bulletW: 7, bulletH: 16, bulletColor: '#c084fc', fireCd: 380, damage: 2.2, lockedBy: 'high-score' },
  ],
}

// Corpo = trilhas de upgrade incrementais compradas com moedas.
// cost(lvl) = custo pra subir de `lvl` para `lvl+1`. Fica bem mais caro a cada
// nível: base * 4^lvl (o 1º é barato, os próximos disparam).
const COST_FACTOR = 4
const tierCost = (base) => (lvl) => Math.round(base * Math.pow(COST_FACTOR, lvl))

export const BODY_COLOR = '#b8bcc8'
export const BODY_TRACKS = [
  {
    key: 'fuel',
    label: 'Tanque',
    desc: '+combustível máximo por nível',
    max: 5,
    fuelPerLevel: 20,
    cost: tierCost(3),
    lockedBy: 'fuel-destroyer',
  },
  {
    key: 'shield',
    label: 'Escudo',
    desc: 'Anula 1 impacto por nível',
    max: 3,
    cost: tierCost(50),
    lockedBy: 'ten-deaths',
  },
  {
    key: 'save',
    label: 'Cofre',
    desc: '-5% de perda de moedas ao morrer',
    max: 10,
    cost: tierCost(4),
    lockedBy: 'coin-loser',
  },
]

// Perda de moedas ao morrer: 75% base, -5% por nível de Cofre, mínimo 25%.
const BASE_DEATH_KEEP = 0.25
const DEATH_KEEP_PER_LEVEL = 0.05
const MAX_DEATH_KEEP = 0.75

const DEFAULT_BODY = { fuel: 0, shield: 0, save: 0 }

// Motor = peça discreta + trilha de upgrade incremental comprada com moedas.
export const ENGINE_SPEED_PER_LEVEL = 0.15
export const ENGINE_TRACKS = [
  {
    key: 'speed',
    label: 'Turbina',
    desc: '+velocidade máxima por nível',
    max: 3,
    cost: tierCost(25),
  },
]

const DEFAULT_ENGINE_UP = { speed: 0 }

export const DEFAULT_LOADOUT = {
  wing: 'std',
  body: { ...DEFAULT_BODY },
  nose: 'std',
  engine: 'std',
  engineUp: { ...DEFAULT_ENGINE_UP },
  weapon: 'cannon',
}

export function getPart(category, id) {
  return SHIP_PARTS[category].find((p) => p.id === id) ?? SHIP_PARTS[category][0]
}

export function resolveBody(body) {
  const levels = { ...DEFAULT_BODY, ...(body ?? {}) }
  return { levels, color: BODY_COLOR }
}

export function resolveLoadout(loadout = DEFAULT_LOADOUT) {
  return {
    wing: getPart('wing', loadout.wing),
    body: resolveBody(loadout.body),
    nose: getPart('nose', loadout.nose),
    engine: getPart('engine', loadout.engine),
    weapon: getPart('weapon', loadout.weapon),
  }
}

const BASE_LIVES = 3
const BASE_FUEL = 100
const FUEL_PER_LEVEL = 20
const PLAYER_W = 26
const PLAYER_H = 32

export function buildShipStats(loadout) {
  const p = resolveLoadout(loadout)
  const engineUp = { ...DEFAULT_ENGINE_UP, ...(loadout.engineUp ?? {}) }
  const startLives = Math.max(1, BASE_LIVES + (p.wing.lifeBonus ?? 0))
  return {
    agility: p.wing.agility,
    lifeBonus: p.wing.lifeBonus ?? 0,
    armor: 1,
    fuelMax: BASE_FUEL + (p.body.levels.fuel ?? 0) * FUEL_PER_LEVEL,
    shield: p.body.levels.shield ?? 0,
    deathKeep: Math.min(MAX_DEATH_KEEP, BASE_DEATH_KEEP + (p.body.levels.save ?? 0) * DEATH_KEEP_PER_LEVEL),
    fuelUse: p.engine.fuelUse ?? 1,
    maxSpeedMul: p.engine.maxSpeed + engineUp.speed * ENGINE_SPEED_PER_LEVEL,
    accelMul: p.engine.accelMul ?? 1,
    cruiseMul: p.engine.cruiseMul ?? 1,
    weaponId: p.weapon.id,
    fireCd: p.weapon.fireCd,
    damage: p.weapon.damage,
    coinMul: p.nose.coinMul ?? 1,
    fuelPickupMul: p.nose.fuelPickupMul ?? 1,
    bulletW: p.weapon.bulletW,
    bulletH: p.weapon.bulletH,
    bulletColor: p.weapon.bulletColor,
    hitboxW: PLAYER_W,
    hitboxH: PLAYER_H,
    startLives,
  }
}

// Lua compartilhada: mesma aparência no topo do percurso (River Raid) e na
// tela de pouso. Disco cinza com crateras fixas (determinísticas → estável).
const MOON_SURFACE = '#c9c6d6'
const MOON_CRATER = '#b3b0c4'
// crateras em coordenadas relativas ao raio (dx, dy, raio)
const MOON_CRATERS = [
  [-0.42, -0.28, 0.13], [0.30, -0.40, 0.10], [0.48, 0.10, 0.15],
  [-0.15, 0.20, 0.18], [0.05, -0.10, 0.09], [-0.55, 0.22, 0.08],
  [0.22, 0.45, 0.11], [-0.28, 0.52, 0.07],
]

export function drawMoon(ctx, cx, cy, r) {
  ctx.save()
  // halo suave
  ctx.fillStyle = 'rgba(200, 205, 230, 0.12)'
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); ctx.fill()
  // disco
  ctx.fillStyle = MOON_SURFACE
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  // recorta as crateras dentro do disco
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = MOON_CRATER
  for (const [dx, dy, cr] of MOON_CRATERS) {
    ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2); ctx.fill()
  }
  // sombreado do terminador (borda inferior direita mais escura)
  ctx.fillStyle = 'rgba(20, 15, 35, 0.18)'
  ctx.beginPath(); ctx.arc(cx + r * 0.35, cy + r * 0.35, r, 0, Math.PI * 2); ctx.fill()
  // luzes de Times Square (Elon comprou e encheu de neon)
  const lights = [
    ['#9b7bff', -0.30, 0.05], ['#6cc6ff', 0.10, -0.25], ['#d0392e', 0.35, 0.28],
    ['#ffd24d', -0.10, 0.40], ['#6fcf5b', 0.42, -0.05], ['#ff6ea8', -0.45, -0.15],
    ['#ff8a1a', 0.05, 0.12], ['#ffe27a', -0.20, -0.35],
  ]
  for (const [col, dx, dy] of lights) {
    ctx.fillStyle = col
    ctx.fillRect(cx + dx * r - 1.5, cy + dy * r - 1.5, 3, 3)
  }
  ctx.restore()
}

// --- foguete em pixel art ---
// grade 13 col x 16 linhas; cada célula vira um bloco. Legenda:
//   B corpo · H realce · S sombra · O contorno · N bico/trim · F aleta
//   G vidro da escotilha · L brilho do vidro · E bocal
const SHIP_GRID_W = 13
const SHIP_GRID_H = 16

// topo do foguete (linhas 0-3) varia conforme o formato do bico
const NOSE_TOPS = {
  cone: ['......N......', '......N......', '.....NNN.....', '....NNNNN....'],
  needle: ['......N......', '......N......', '......N......', '.....NNN.....'],
  blunt: ['....NNNNN....', '....NNNNN....', '....NNNNN....', '...NNNNNNN...'],
}

// corpo do foguete (linhas 4-15), independente do bico
const SHIP_BODY = [
  '....BHBSB....',
  '...BHBBBSB...',
  '...BBGGGBB...',
  '...BBGLGBB...',
  '...BBGGGBB...',
  '..BBHBBBSBB..',
  '.FBBBBBBBBBF.',
  'FFBBBBBBBBBFF',
  'FFBHBBBBSBBFF',
  '..OBBBBBBBO..',
  '...OSBBBSO...',
  '....EEEEE....',
]

// clareia (amt>0) ou escurece (amt<0) uma cor hex
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  if (amt >= 0) {
    r += (255 - r) * amt
    g += (255 - g) * amt
    b += (255 - b) * amt
  } else {
    const k = 1 + amt
    r *= k
    g *= k
    b *= k
  }
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`
}

export function drawShip(ctx, x, y, w, h, loadout, time = 0, opts = {}) {
  const parts = resolveLoadout(loadout)
  const gold = opts.goldTint ?? 0

  const bodyColor = gold > 0 ? '#ffd34d' : parts.body.color
  const trimColor = gold > 0 ? '#f0b840' : parts.nose.tipColor
  const finColor = gold > 0 ? '#e0a020' : parts.wing.wingColor

  const colors = {
    B: bodyColor,
    H: shadeHex(bodyColor, 0.28),
    S: shadeHex(bodyColor, -0.26),
    O: shadeHex(bodyColor, -0.55),
    N: trimColor,
    F: finColor,
    G: '#1a6fb0',
    L: '#8fd0f5',
    E: '#4a4a52',
  }

  const pxW = w / SHIP_GRID_W
  const pxH = h / SHIP_GRID_H
  // desenha uma célula da grade como bloco, encaixando nas bordas de pixel
  const px = (c, r, color) => {
    const x0 = Math.round(x + c * pxW)
    const x1 = Math.round(x + (c + 1) * pxW)
    const y0 = Math.round(y + r * pxH)
    const y1 = Math.round(y + (r + 1) * pxH)
    ctx.fillStyle = color
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  }

  // chama (atrás, abaixo do bocal — linhas >= 16), animada e escalada pela potência
  const power = parts.engine.power ?? 1
  const flick = Math.floor(time / 70) % 3
  const flameColor = parts.engine.flameColor
  const flameLen = Math.max(2, Math.round((2 + flick) * power))
  for (let r = 0; r < flameLen; r++) {
    const half = Math.max(0, Math.round((1 - r / flameLen) * 2))
    for (let c = 6 - half; c <= 6 + half; c++) px(c, SHIP_GRID_H + r, flameColor)
  }
  const coreLen = Math.max(1, Math.floor(flameLen * 0.65))
  for (let r = 0; r < coreLen; r++) {
    const half = Math.max(0, Math.round((1 - r / coreLen) * 1))
    for (let c = 6 - half; c <= 6 + half; c++) px(c, SHIP_GRID_H + r, '#ffe14d')
  }
  if (parts.engine.id === 'after') {
    for (let r = 0; r < flameLen + 2; r++) {
      px(6, SHIP_GRID_H + r, r > (flameLen + 2) * 0.5 ? '#fff59d' : '#ffe14d')
    }
  }

  // monta a grade: topo do bico + corpo
  const nose = NOSE_TOPS[parts.nose.shape] ?? NOSE_TOPS.cone
  const grid = nose.concat(SHIP_BODY).map((row) => row.split(''))

  // ajustes de aleta conforme a asa
  if (parts.wing.id === 'wide') {
    grid[9][1] = 'F'
    grid[9][11] = 'F'
    grid[13][1] = 'F'
    grid[13][11] = 'F'
  } else if (parts.wing.id === 'delta') {
    grid[11][0] = '.'
    grid[11][12] = '.'
    grid[12][0] = '.'
    grid[12][12] = '.'
    grid[9][1] = 'F'
    grid[9][11] = 'F'
  }

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      const color = colors[row[c]]
      if (color) px(c, r, color)
    }
  }

  // detalhe da arma na cor do projétil
  const bc = parts.weapon.bulletColor
  if (parts.weapon.id === 'rapid') {
    px(1, 10, bc)
    px(11, 10, bc)
  } else if (parts.weapon.id === 'plasma') {
    px(6, 4, bc)
  } else {
    px(6, 3, bc)
  }
}
