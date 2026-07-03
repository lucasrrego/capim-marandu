// Conquistas do jogo. Novas conquistas: basta adicionar uma entrada aqui e
// chamar unlock(id) no evento correspondente.
// Persistidas por slot de save (ver saves.js → slotKey).
import { slotKey } from './saves.js'

const achKey = () => slotKey('achievements')

export const ACHIEVEMENTS = [
  {
    id: 'first-landing',
    icon: '🌙',
    name: 'Rumo à Lua',
    desc: 'Conclua o jogo pela primeira vez.',
  },
  {
    id: 'rich-landing',
    icon: '💰',
    name: 'Ricaço Lunar',
    desc: 'Conclua o jogo com mais de 300 moedas. Libera a Metralhadora.',
  },
  {
    id: 'high-score',
    icon: '⭐',
    name: 'Astro Pontuador',
    desc: 'Conclua o jogo com mais de 2000 pontos. Libera o Plasma.',
  },
  {
    id: 'coin-loser',
    icon: '🕳️',
    name: 'Buraco Negro',
    desc: 'Perca 1000 moedas somadas em várias corridas. Libera o Cofre.',
  },
  {
    id: 'ten-deaths',
    icon: '💥',
    name: 'Teimoso',
    desc: 'Perca a corrida 10 vezes. Libera o Escudo.',
  },
  {
    id: 'fuel-destroyer',
    icon: '⛽',
    name: 'Desperdício',
    desc: 'Destrua 10 tanques de combustível numa só corrida. Libera o Tanque.',
  },
  {
    id: 'abductor',
    icon: '🛸',
    name: 'Vó Abduz',
    desc: 'Abduza 10 jogadores no Sonho da Vó Baiana.',
  },
  {
    id: 'abduct-neysea',
    icon: '🌟',
    name: 'Pegou o NeySea',
    desc: 'Abduza o NeySea, o craque, no Sonho da Vó Baiana.',
  },
  {
    id: 'ten-landings',
    icon: '🚀',
    name: 'Veterano da Lua',
    desc: 'Pouse na Lua 10 vezes.',
  },
  {
    id: 'first-mod',
    icon: '🔧',
    name: 'Primeira Modificação',
    desc: 'Instale a primeira modificação na nave.',
  },
  {
    id: 'five-upgrades',
    icon: '🔩',
    name: 'Engenheiro',
    desc: 'Instale 5 melhorias na nave.',
  },
  {
    id: 'ten-upgrades',
    icon: '🛠️',
    name: 'Mecânico Master',
    desc: 'Instale 10 melhorias na nave.',
  },
  {
    id: 'big-spender',
    icon: '💸',
    name: 'Gastão',
    desc: 'Gaste 5937 moedas no total.',
  },
]

// ids desbloqueados persistidos no localStorage (slot ativo)
export function loadUnlocked() {
  try {
    const raw = JSON.parse(localStorage.getItem(achKey()) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function isUnlocked(id, unlocked = loadUnlocked()) {
  return unlocked.includes(id)
}

// desbloqueia um id; retorna true se era inédito (desbloqueou agora)
export function unlock(id) {
  const cur = loadUnlocked()
  if (cur.includes(id)) return false
  cur.push(id)
  localStorage.setItem(achKey(), JSON.stringify(cur))
  return true
}
