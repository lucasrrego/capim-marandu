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
  ctx.restore()
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
