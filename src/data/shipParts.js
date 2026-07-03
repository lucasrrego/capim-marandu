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
    { id: 'rapid', name: 'Metralhadora', desc: 'Rajadas rápidas', bulletW: 3, bulletH: 8, bulletColor: '#fff59d', fireCd: 110, damage: 0.6 },
    { id: 'plasma', name: 'Plasma', desc: 'Projéteis largos e lentos', bulletW: 7, bulletH: 16, bulletColor: '#c084fc', fireCd: 380, damage: 2.2 },
  ],
}

// Corpo = trilhas de upgrade incrementais compradas com moedas.
// cost(lvl) = custo em moedas para subir de `lvl` para `lvl+1`.
export const BODY_COLOR = '#b8bcc8'
export const BODY_TRACKS = [
  {
    key: 'fuel',
    label: 'Tanque',
    desc: '+combustível máximo por nível',
    max: 5,
    fuelPerLevel: 20,
    cost: (lvl) => 3 + lvl * 2,
  },
  {
    key: 'shield',
    label: 'Escudo',
    desc: 'Anula 1 impacto por nível',
    max: 3,
    cost: (lvl) => 6 + lvl * 4,
  },
  {
    key: 'save',
    label: 'Cofre',
    desc: '-5% de perda de moedas ao morrer',
    max: 10,
    cost: (lvl) => 4 + lvl * 2,
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
    cost: (lvl) => 4 + lvl * 3,
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

export function drawShip(ctx, x, y, w, h, loadout, time = 0, opts = {}) {
  const parts = resolveLoadout(loadout)
  const cx = x + w / 2
  const top = y
  const bw = w * (parts.nose.shape === 'blunt' ? 0.31 : 0.27)
  const gold = opts.goldTint ?? 0

  const bodyColor = gold > 0 ? '#ffd34d' : parts.body.color
  const trimColor = gold > 0 ? '#e0a020' : parts.nose.tipColor
  const finColor = gold > 0 ? '#e0a020' : parts.wing.wingColor

  // chama (animada, atrás do foguete)
  const fl = (8 + (Math.floor(time / 70) % 3) * 4) * (h / 32) * parts.engine.power
  const flameW = w * 0.38 * Math.min(1.4, parts.engine.power)
  ctx.fillStyle = parts.engine.flameColor
  ctx.beginPath()
  ctx.moveTo(cx - flameW / 2, top + h - h * 0.06)
  ctx.lineTo(cx + flameW / 2, top + h - h * 0.06)
  ctx.lineTo(cx, top + h + fl)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffe14d'
  ctx.beginPath()
  ctx.moveTo(cx - flameW * 0.33, top + h - h * 0.06)
  ctx.lineTo(cx + flameW * 0.33, top + h - h * 0.06)
  ctx.lineTo(cx, top + h + fl * 0.55)
  ctx.closePath()
  ctx.fill()
  if (parts.engine.id === 'after') {
    ctx.fillStyle = '#fff59d'
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.08, top + h + fl * 0.35)
    ctx.lineTo(cx + w * 0.08, top + h + fl * 0.35)
    ctx.lineTo(cx, top + h + fl * 1.15)
    ctx.closePath()
    ctx.fill()
  }

  // aletas
  const finBase = parts.wing.id === 'delta' ? 0.15 : 0.23
  const finExt = w * finBase * (parts.wing.wingW ?? 1)
  const finDrop = h * (parts.wing.id === 'wide' ? 0.42 : 0.375)
  ctx.fillStyle = finColor
  ctx.beginPath()
  ctx.moveTo(cx - bw, top + h - finDrop)
  ctx.lineTo(cx - bw - finExt, top + h - h * 0.03)
  ctx.lineTo(cx - bw, top + h - h * 0.09)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + bw, top + h - finDrop)
  ctx.lineTo(cx + bw + finExt, top + h - h * 0.03)
  ctx.lineTo(cx + bw, top + h - h * 0.09)
  ctx.closePath()
  ctx.fill()

  // corpo
  const bodyTop = top + h * 0.28 + (parts.nose.length ?? 0) * (h / 32)
  ctx.fillStyle = bodyColor
  ctx.fillRect(cx - bw, bodyTop, bw * 2, h - bodyTop + top - h * 0.125)

  // bico
  ctx.fillStyle = trimColor
  if (parts.nose.shape === 'needle') {
    ctx.beginPath()
    ctx.moveTo(cx, top - h * 0.12)
    ctx.lineTo(cx - bw * 0.55, bodyTop)
    ctx.lineTo(cx + bw * 0.55, bodyTop)
    ctx.closePath()
    ctx.fill()
  } else if (parts.nose.shape === 'blunt') {
    ctx.fillRect(cx - bw, bodyTop - h * 0.06, bw * 2, h * 0.08)
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.lineTo(cx - bw, bodyTop)
    ctx.lineTo(cx + bw, bodyTop)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.lineTo(cx - bw, bodyTop)
    ctx.lineTo(cx + bw, bodyTop)
    ctx.closePath()
    ctx.fill()
  }

  // escotilha
  ctx.fillStyle = '#1a6fb0'
  ctx.beginPath()
  ctx.arc(cx, top + h * 0.53, w * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8fd0f5'
  ctx.beginPath()
  ctx.arc(cx - w * 0.04, top + h * 0.5, w * 0.05, 0, Math.PI * 2)
  ctx.fill()

  // bocal
  ctx.fillStyle = '#555'
  ctx.fillRect(cx - w * 0.15, top + h - h * 0.125, w * 0.3, h * 0.094)

  // arma
  ctx.fillStyle = parts.weapon.bulletColor
  if (parts.weapon.id === 'cannon') {
    ctx.fillRect(cx - w * 0.08, bodyTop - h * 0.06, w * 0.15, h * 0.25)
  } else if (parts.weapon.id === 'rapid') {
    ctx.fillRect(cx - bw - w * 0.04, bodyTop + h * 0.08, w * 0.12, h * 0.19)
    ctx.fillRect(cx + bw - w * 0.08, bodyTop + h * 0.08, w * 0.12, h * 0.19)
  } else {
    ctx.beginPath()
    ctx.arc(cx, bodyTop + h * 0.12, w * 0.19, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(cx - w * 0.04, bodyTop + h * 0.03, w * 0.08, h * 0.19)
  }
}
