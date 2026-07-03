<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  PART_CATEGORIES,
  SHIP_PARTS,
  BODY_TRACKS,
  ENGINE_TRACKS,
  buildShipStats,
  drawShip,
} from '../data/shipParts.js'
import { playSelect, playConfirm, playSparkle } from '../audio/sfx.js'
import { loadUnlocked, isUnlocked, ACHIEVEMENTS } from '../data/achievements.js'

const loadout = defineModel('loadout', { type: Object, required: true })
const coins = defineModel('coins', { type: Number, default: 0 })
const emit = defineEmits(['launch', 'back', 'install', 'achievements'])

const activeCategory = ref('wing')
const previewCanvas = ref(null)

let raf = 0
let previewTime = 0

// Trilhas de upgrade incremental por categoria (peça salva em loadout[storeKey]).
const UPGRADE_TRACKS = { body: BODY_TRACKS, engine: ENGINE_TRACKS }
const UPGRADE_STORE = { body: 'body', engine: 'engineUp' }
const UPGRADE_DEFAULTS = { fuel: 0, shield: 0, save: 0, speed: 0 }

// conquistas desbloqueadas ao abrir o hangar (só mudam durante o jogo)
const unlocked = ref(loadUnlocked())
const achName = (id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? 'conquista'
const partLocked = (part) => !!part.lockedBy && !isUnlocked(part.lockedBy, unlocked.value)

const activeParts = computed(() => SHIP_PARTS[activeCategory.value] ?? [])
const stats = computed(() => buildShipStats(loadout.value))

const upgradeTracks = computed(() => UPGRADE_TRACKS[activeCategory.value] ?? [])
const upgradeStore = computed(() => UPGRADE_STORE[activeCategory.value])
const levels = computed(() => ({
  ...UPGRADE_DEFAULTS,
  ...(loadout.value[upgradeStore.value] ?? {}),
}))

const statRows = computed(() => [
  { label: 'Vidas', value: String(stats.value.startLives) },
  { label: 'Escudo', value: String(stats.value.shield) },
  { label: 'Tanque', value: String(stats.value.fuelMax) },
  { label: 'Moedas perdida', value: Math.round((1 - stats.value.deathKeep) * 100) + '%' },
  { label: 'Agilidade', value: stats.value.agility.toFixed(2) + 'x' },
  { label: 'Vel. máx', value: stats.value.maxSpeedMul.toFixed(2) + 'x' },
  { label: 'Dano', value: stats.value.damage.toFixed(2) + 'x' },
])

function pickCategory(key) {
  if (key === activeCategory.value) return
  activeCategory.value = key
  playSelect()
}

const STATIC_COST = 30   // instalar uma peça (asa/bico/motor/arma) custa 30 moedas

function selectPart(part) {
  if (partLocked(part)) return
  if (loadout.value[activeCategory.value] === part.id) return   // já instalada: sem custo
  if (coins.value < STATIC_COST) return                         // sem saldo
  coins.value -= STATIC_COST
  loadout.value = { ...loadout.value, [activeCategory.value]: part.id }
  emit('install', STATIC_COST)
  playSelect()
}

function buyUpgrade(track) {
  if (partLocked(track)) return
  const store = upgradeStore.value
  const cur = { ...UPGRADE_DEFAULTS, ...(loadout.value[store] ?? {}) }
  const lvl = cur[track.key] ?? 0
  if (lvl >= track.max) return
  const cost = track.cost(lvl)
  if (coins.value < cost) return
  coins.value -= cost
  loadout.value = { ...loadout.value, [store]: { ...cur, [track.key]: lvl + 1 } }
  emit('install', cost)
  playSparkle()   // upgrade comprado
}

function drawPreview(ts) {
  if (!previewTime) previewTime = ts
  previewTime = ts

  const canvas = previewCanvas.value
  if (!canvas) {
    raf = requestAnimationFrame(drawPreview)
    return
  }

  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  ctx.clearRect(0, 0, W, H)

  // piso do hangar
  ctx.fillStyle = '#1e2838'
  ctx.fillRect(0, H - 36, W, 36)
  ctx.strokeStyle = '#3d4f6a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, H - 36)
  ctx.lineTo(W, H - 36)
  ctx.stroke()

  const bob = Math.sin(ts / 600) * 4
  drawShip(ctx, W / 2 - 26, H / 2 - 20 + bob, 52, 64, loadout.value, ts)

  raf = requestAnimationFrame(drawPreview)
}

function launch(short = false) {
  playConfirm()
  emit('launch', { loadout: { ...loadout.value }, short })
}

function goBack() {
  playSelect()
  emit('back')
}

onMounted(() => {
  raf = requestAnimationFrame(drawPreview)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="hangar">
    <div class="hangar-grid"></div>

    <header class="hangar-header">
      <button class="hangar-ach-btn" @click="emit('achievements')" @pointerenter="playSelect">🏆 Conquistas</button>
      <span class="hangar-badge">CONSTRUTOR</span>
      <span class="hangar-coins">🪙 {{ coins }}</span>
      <h2>Monte sua nave</h2>
    </header>

    <div class="hangar-layout">
      <div class="hangar-bay">
        <div class="hangar-lights">
          <span v-for="n in 5" :key="n" class="hangar-light"></span>
        </div>
        <canvas ref="previewCanvas" class="hangar-preview" width="220" height="180"></canvas>
        <p class="hangar-preview-label">Prévia da montagem</p>
      </div>

      <div class="hangar-builder">
        <nav class="hangar-tabs">
          <button
            v-for="cat in PART_CATEGORIES"
            :key="cat.key"
            :class="{ active: activeCategory === cat.key }"
            @click="pickCategory(cat.key)"
          >
            {{ cat.label }}
          </button>
        </nav>

        <ul v-if="activeCategory !== 'body'" class="hangar-parts">
          <li v-for="part in activeParts" :key="part.id">
            <button
              class="part-card"
              :class="{ selected: loadout[activeCategory] === part.id, locked: partLocked(part) }"
              :disabled="partLocked(part) || (loadout[activeCategory] !== part.id && coins < STATIC_COST)"
              @click="selectPart(part)"
            >
              <span class="part-name">
                {{ part.name }}
                <span v-if="partLocked(part)" class="part-lock">🔒</span>
                <span v-else-if="loadout[activeCategory] === part.id" class="part-tag">INSTALADA</span>
                <span v-else class="part-cost">🪙 {{ STATIC_COST }}</span>
              </span>
              <span class="part-desc">
                {{ part.desc }}
                <template v-if="partLocked(part)"> · Requer: {{ achName(part.lockedBy) }}</template>
              </span>
            </button>
          </li>
        </ul>

        <div v-if="upgradeTracks.length" class="hangar-upgrades">
          <div
            v-for="track in upgradeTracks"
            :key="track.key"
            class="upgrade-card"
            :class="{ locked: partLocked(track) }"
          >
            <div class="upgrade-head">
              <span class="part-name">
                {{ track.label }}
                <span v-if="partLocked(track)" class="part-lock">🔒</span>
              </span>
              <span class="upgrade-pips">
                <span
                  v-for="n in track.max"
                  :key="n"
                  class="pip"
                  :class="{ on: levels[track.key] >= n }"
                ></span>
              </span>
            </div>
            <span class="part-desc">
              {{ track.desc }}
              <template v-if="partLocked(track)"> · Requer: {{ achName(track.lockedBy) }}</template>
            </span>
            <button
              class="upgrade-buy"
              :disabled="partLocked(track) || levels[track.key] >= track.max || coins < track.cost(levels[track.key])"
              @click="buyUpgrade(track)"
            >
              <template v-if="partLocked(track)">🔒 Bloqueado</template>
              <template v-else-if="levels[track.key] >= track.max">MÁX</template>
              <template v-else>Melhorar · 🪙 {{ track.cost(levels[track.key]) }}</template>
            </button>
          </div>
        </div>
      </div>
    </div>

    <dl class="hangar-stats">
      <div v-for="row in statRows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <div class="hangar-actions">
      <button class="hangar-btn secondary" @click="goBack">← Voltar</button>
      <button class="hangar-btn primary" @click="launch(false)">🚀 Lançar</button>
    </div>
    <button class="hangar-devrun" @click="launch(true)">⚡ Corrida curta (teste)</button>
  </div>
</template>

<style scoped>
.hangar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 14px 12px;
  box-sizing: border-box;
  overflow-y: auto;
  background: linear-gradient(180deg, #0a0e18 0%, #121a2a 55%, #1a2438 100%);
  border-radius: 8px;
  color: #e8edf5;
  font-family: ui-monospace, Consolas, monospace;
}

.hangar-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(170, 59, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(170, 59, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.hangar-header {
  position: relative;
  text-align: center;
  z-index: 1;
}

.hangar-badge {
  display: inline-block;
  padding: 3px 8px;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--accent, #aa3bff);
  border: 1px solid rgba(170, 59, 255, 0.4);
  border-radius: 4px;
  background: rgba(170, 59, 255, 0.1);
}

.hangar-header h2 {
  margin: 6px 0 0;
  font-size: 1.3rem;
  color: #fff;
}

.hangar-ach-btn {
  position: absolute;
  top: 0;
  left: 0;
  padding: 3px 8px;
  font-family: inherit;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--accent, #aa3bff);
  border: 1px solid rgba(170, 59, 255, 0.4);
  border-radius: 4px;
  background: rgba(170, 59, 255, 0.1);
  cursor: pointer;
  transition: filter 0.12s, transform 0.08s;
}
.hangar-ach-btn:hover { filter: brightness(1.2); }
.hangar-ach-btn:active { transform: translateY(1px); }

.hangar-coins {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 0.8rem;
  font-weight: bold;
  color: #ffd24d;
  text-shadow: 0 0 8px rgba(255, 207, 58, 0.5);
}

.hangar-upgrades {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.upgrade-card {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.upgrade-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.upgrade-pips {
  display: flex;
  gap: 4px;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.pip.on {
  background: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 6px rgba(170, 59, 255, 0.6);
}

.upgrade-buy {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid rgba(170, 59, 255, 0.5);
  border-radius: 6px;
  background: rgba(170, 59, 255, 0.15);
  color: #fff;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: bold;
  cursor: pointer;
  transition: filter 0.15s;
}

.upgrade-buy:hover:not(:disabled) { filter: brightness(1.2); }
.upgrade-buy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hangar-layout {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1;
}

.hangar-bay {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 4px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.hangar-lights {
  display: flex;
  gap: 20px;
  margin-bottom: 4px;
}

.hangar-light {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffe14d;
  box-shadow: 0 0 6px #ffe14d;
  animation: blink 2s ease-in-out infinite;
}

.hangar-light:nth-child(2) { animation-delay: 0.4s; }
.hangar-light:nth-child(3) { animation-delay: 0.8s; }
.hangar-light:nth-child(4) { animation-delay: 1.2s; }
.hangar-light:nth-child(5) { animation-delay: 1.6s; }

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.hangar-preview {
  display: block;
  width: 100%;
  max-width: 220px;
  height: auto;
}

.hangar-preview-label {
  margin: 2px 0 0;
  font-size: 0.65rem;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hangar-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.hangar-tabs button {
  flex: 1;
  min-width: 0;
  padding: 8px 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #aaa;
  font-family: inherit;
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;
}

.hangar-tabs button.active {
  background: rgba(170, 59, 255, 0.2);
  border-color: rgba(170, 59, 255, 0.5);
  color: #fff;
}

.hangar-parts {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.part-card {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #e8edf5;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.part-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.part-card.selected {
  border-color: var(--accent, #aa3bff);
  background: rgba(170, 59, 255, 0.12);
}

.part-card.locked {
  opacity: 0.55;
  cursor: not-allowed;
  border-style: dashed;
}
.part-card.locked:hover {
  background: rgba(255, 255, 255, 0.03);
}
.part-lock {
  font-size: 0.75rem;
}
.part-cost {
  float: right;
  font-size: 0.7rem;
  font-weight: bold;
  color: var(--px-gold, #ffd24d);
}
.part-tag {
  float: right;
  font-size: 0.6rem;
  font-weight: bold;
  color: var(--accent, #aa3bff);
  letter-spacing: 0.05em;
}
.part-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upgrade-card.locked {
  opacity: 0.6;
  border-style: dashed;
}

.part-name {
  display: block;
  font-size: 0.85rem;
  font-weight: bold;
  color: #fff;
}

.part-desc {
  display: block;
  margin-top: 2px;
  font-size: 0.7rem;
  opacity: 0.65;
  line-height: 1.3;
}

.hangar-stats {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 0;
  z-index: 1;
}

.hangar-stats > div {
  padding: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  text-align: left;
}

.hangar-stats > div:nth-child(4),
.hangar-stats > div:nth-child(5) {
  grid-column: span 1;
}

.hangar-stats dt {
  margin: 0;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.hangar-stats dd {
  margin: 3px 0 0;
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--accent, #aa3bff);
}

.hangar-actions {
  position: relative;
  display: flex;
  gap: 10px;
  z-index: 1;
  margin-top: auto;
}

.hangar-btn {
  flex: 1;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: bold;
  transition: filter 0.15s, transform 0.1s;
}

.hangar-btn:active { transform: scale(0.97); }
.hangar-btn.primary { flex: 2; background: var(--accent, #aa3bff); color: #fff; }
.hangar-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #ccc;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.hangar-btn:hover { filter: brightness(1.15); }

.hangar-devrun {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  width: 100%;
  padding: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #9aa;
  font-family: inherit;
  font-size: 0.72rem;
  cursor: pointer;
  transition: filter 0.15s;
}
.hangar-devrun:hover { filter: brightness(1.3); }
</style>
