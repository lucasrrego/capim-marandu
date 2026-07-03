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
  body: [
    { id: 'std', name: 'Leve', desc: 'Fuselagem compacta', color: '#f4f4f4', armor: 1, fuelUse: 1 },
    { id: 'heavy', name: 'Blindado', desc: 'Aguenta mais impacto', color: '#b8bcc8', armor: 1.4, fuelUse: 1.15 },
    { id: 'stream', name: 'Aerodinâmico', desc: 'Menos consumo de combustível', color: '#e8eef8', armor: 0.85, fuelUse: 0.82 },
  ],
  nose: [
    { id: 'std', name: 'Cônico', desc: 'Perfil clássico de ataque', shape: 'cone', length: 0, tipColor: '#c9403a', damageMul: 1, hitboxW: 1 },
    { id: 'sharp', name: 'Agulha', desc: '+15% dano nos abates', shape: 'needle', length: 6, tipColor: '#ffe14d', damageMul: 1.15, hitboxW: 1 },
    { id: 'blunt', name: 'Rombo', desc: 'Hitbox frontal mais larga', shape: 'blunt', length: -2, tipColor: '#d0d0d0', damageMul: 1, hitboxW: 1.12 },
  ],
  engine: [
    { id: 'std', name: 'Turbo', desc: 'Velocidade e consumo equilibrados', flameColor: '#ff8a1a', power: 1, maxSpeed: 1, fuelUse: 1, accelMul: 1, cruiseMul: 1 },
    { id: 'after', name: 'Pós-combustão', desc: 'Muito rápido, gasta mais combustível', flameColor: '#ff4d4d', power: 1.5, maxSpeed: 1.38, fuelUse: 1.4, accelMul: 1.5, cruiseMul: 1.08 },
    { id: 'eco', name: 'Econômico', desc: 'Lento, autonomia alta', flameColor: '#37e0a0', power: 0.7, maxSpeed: 0.82, fuelUse: 0.62, accelMul: 0.72, cruiseMul: 0.88 },
  ],
  weapon: [
    { id: 'cannon', name: 'Canhão', desc: 'Tiro único, dano padrão', bulletW: 4, bulletH: 12, bulletColor: '#ffe14d', fireCd: 200, damage: 1 },
    { id: 'rapid', name: 'Metralhadora', desc: 'Rajadas rápidas', bulletW: 3, bulletH: 8, bulletColor: '#fff59d', fireCd: 110, damage: 0.6 },
    { id: 'plasma', name: 'Plasma', desc: 'Projéteis largos e lentos', bulletW: 7, bulletH: 16, bulletColor: '#c084fc', fireCd: 380, damage: 2.2 },
  ],
}

export const DEFAULT_LOADOUT = {
  wing: 'std',
  body: 'std',
  nose: 'std',
  engine: 'std',
  weapon: 'cannon',
}

export function getPart(category, id) {
  return SHIP_PARTS[category].find((p) => p.id === id) ?? SHIP_PARTS[category][0]
}

export function resolveLoadout(loadout = DEFAULT_LOADOUT) {
  return {
    wing: getPart('wing', loadout.wing),
    body: getPart('body', loadout.body),
    nose: getPart('nose', loadout.nose),
    engine: getPart('engine', loadout.engine),
    weapon: getPart('weapon', loadout.weapon),
  }
}

const BASE_LIVES = 3
const PLAYER_W = 26
const PLAYER_H = 32

export function buildShipStats(loadout) {
  const p = resolveLoadout(loadout)
  let startLives = BASE_LIVES + (p.wing.lifeBonus ?? 0)
  if (p.body.armor >= 1.3) startLives += 1
  startLives = Math.max(1, startLives)
  return {
    agility: p.wing.agility,
    lifeBonus: p.wing.lifeBonus ?? 0,
    armor: p.body.armor,
    fuelUse: p.body.fuelUse * (p.engine.fuelUse ?? 1),
    maxSpeedMul: p.engine.maxSpeed,
    accelMul: p.engine.accelMul ?? 1,
    cruiseMul: p.engine.cruiseMul ?? 1,
    fireCd: p.weapon.fireCd,
    damage: p.weapon.damage * (p.nose.damageMul ?? 1),
    bulletW: p.weapon.bulletW,
    bulletH: p.weapon.bulletH,
    bulletColor: p.weapon.bulletColor,
    hitboxW: Math.round(PLAYER_W * (p.nose.hitboxW ?? 1)),
    hitboxH: PLAYER_H,
    startLives,
  }
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
