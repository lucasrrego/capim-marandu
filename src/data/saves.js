// Sistema de save-slots. Todo o progresso persistido (banco, upgrades,
// conquistas, contadores) é namespaced no slot ativo:
//   capim-marandu:s2:coins , capim-marandu:s2:achievements , ...
// Trocar de slot só muda o prefixo — nenhum outro código precisa saber o número.
const PREFIX = 'capim-marandu'
const SLOT_KEY = `${PREFIX}:slot`   // qual slot está ativo (1..3)
export const SLOT_COUNT = 3

let activeSlot = Number(localStorage.getItem(SLOT_KEY)) || 1

export function getSlot() {
  return activeSlot
}

export function setSlot(n) {
  activeSlot = n
  localStorage.setItem(SLOT_KEY, String(n))
}

// chave do slot ativo (ex.: slotKey('coins') → 'capim-marandu:s2:coins')
export function slotKey(name) {
  return `${PREFIX}:s${activeSlot}:${name}`
}

// resumo de um slot sem trocar o ativo — usado na tela de seleção
export function readSlotSummary(n) {
  const coins = Number(localStorage.getItem(`${PREFIX}:s${n}:coins`)) || 0
  let achievements = 0
  const rawAch = localStorage.getItem(`${PREFIX}:s${n}:achievements`)
  try {
    const arr = JSON.parse(rawAch || '[]')
    achievements = Array.isArray(arr) ? arr.length : 0
  } catch {
    achievements = 0
  }
  // slot é "usado" se já gravou moedas ou conquistas alguma vez
  const used =
    localStorage.getItem(`${PREFIX}:s${n}:coins`) !== null || rawAch !== null
  return { slot: n, coins, achievements, used }
}
