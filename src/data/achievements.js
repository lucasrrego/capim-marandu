// Conquistas do jogo. Por enquanto só uma: concluir o jogo (pousar na Lua)
// pela primeira vez. Novas conquistas: basta adicionar uma entrada aqui e
// chamar unlock(id) no evento correspondente.
const ACH_KEY = 'capim-marandu:achievements'

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
]

// ids desbloqueados persistidos no localStorage
export function loadUnlocked() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACH_KEY) || '[]')
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
  localStorage.setItem(ACH_KEY, JSON.stringify(cur))
  return true
}
