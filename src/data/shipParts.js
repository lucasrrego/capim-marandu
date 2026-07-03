export const PART_CATEGORIES = [
  { key: 'wing', label: 'Asa' },
  { key: 'body', label: 'Corpo' },
  { key: 'nose', label: 'Bico' },
  { key: 'engine', label: 'Motor' },
  { key: 'weapon', label: 'Arma' },
]

export const SHIP_PARTS = {
  wing: [
    { id: 'std', name: 'Padrão', desc: 'Equilíbrio entre manobra e resistência', wingW: 1, wingColor: '#d8d8d8', agility: 1, lifeBonus: 0 },
    { id: 'wide', name: 'Larga', desc: 'Manobra lenta, +1 vida', wingW: 1.35, wingColor: '#a8bdd4', agility: 0.82, lifeBonus: 1 },
    { id: 'delta', name: 'Delta', desc: 'Manobra rápida, −1 vida', wingW: 0.85, wingColor: '#c8c8c8', agility: 1.25, lifeBonus: -1 },
  ],
  body: [
    { id: 'std', name: 'Leve', desc: 'Fuselagem compacta', color: '#f4f4f4', armor: 1, fuelUse: 1 },
    { id: 'heavy', name: 'Blindado', desc: 'Aguenta mais impacto', color: '#b8bcc8', armor: 1.4, fuelUse: 1.15 },
    { id: 'stream', name: 'Aerodinâmico', desc: 'Menos consumo de combustível', color: '#e8eef8', armor: 0.85, fuelUse: 0.82 },
  ],
  nose: [
    { id: 'std', name: 'Cônico', desc: 'Perfil clássico de ataque', shape: 'cone', length: 0, tipColor: '#f4f4f4', damageMul: 1, hitboxW: 1 },
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

export function drawShip(ctx, x, y, w, h, loadout, time = 0) {
  const parts = resolveLoadout(loadout)
  const cx = x + w / 2

  // asas
  const wingW = w * parts.wing.wingW
  const wingX = x + (w - wingW) / 2
  const wingY = y + h * 0.55
  ctx.fillStyle = parts.wing.wingColor
  ctx.fillRect(wingX, wingY, wingW, 7)
  if (parts.wing.id === 'delta') {
    ctx.beginPath()
    ctx.moveTo(wingX, wingY + 7)
    ctx.lineTo(cx, wingY + 14)
    ctx.lineTo(wingX + wingW, wingY + 7)
    ctx.closePath()
    ctx.fill()
  }

  // corpo
  ctx.fillStyle = parts.body.color
  const bodyTop = y + parts.nose.length
  const half = parts.nose.shape === 'blunt' ? 7 : 5
  ctx.beginPath()
  ctx.moveTo(cx, bodyTop)
  ctx.lineTo(cx + half, y + h)
  ctx.lineTo(cx - half, y + h)
  ctx.closePath()
  ctx.fill()

  // bico
  if (parts.nose.shape === 'needle') {
    ctx.fillStyle = parts.nose.tipColor
    ctx.beginPath()
    ctx.moveTo(cx, bodyTop - 8)
    ctx.lineTo(cx + 3, bodyTop)
    ctx.lineTo(cx - 3, bodyTop)
    ctx.closePath()
    ctx.fill()
  } else if (parts.nose.shape === 'blunt') {
    ctx.fillStyle = parts.nose.tipColor
    ctx.fillRect(cx - 6, bodyTop - 2, 12, 4)
  }

  // cauda
  ctx.fillStyle = parts.wing.wingColor
  ctx.fillRect(cx - 10, y + h - 6, 20, 6)

  // motor
  const flicker = Math.sin(time / 70) * 2
  const flameH = 6 + parts.engine.power * 5 + flicker
  const flameW = 4 + parts.engine.power * 2
  ctx.fillStyle = parts.engine.flameColor
  ctx.fillRect(cx - flameW / 2, y + h, flameW, flameH)
  if (parts.engine.id === 'after') {
    ctx.fillStyle = '#ffe14d'
    ctx.fillRect(cx - 2, y + h + flameH * 0.4, 4, flameH * 0.5)
  }

  // arma
  ctx.fillStyle = parts.weapon.bulletColor
  if (parts.weapon.id === 'cannon') {
    ctx.fillRect(cx - 2, bodyTop - 2, 4, 8)
  } else if (parts.weapon.id === 'rapid') {
    ctx.fillRect(cx - 5, wingY - 2, 3, 6)
    ctx.fillRect(cx + 2, wingY - 2, 3, 6)
  } else {
    ctx.beginPath()
    ctx.arc(cx, bodyTop + 4, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(cx - 1, bodyTop + 1, 2, 6)
  }
}
