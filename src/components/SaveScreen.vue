<script setup>
import { ref, onMounted } from 'vue'
import { ACHIEVEMENTS } from '../data/achievements.js'
import { SLOT_COUNT, SECRET_SLOT, getSlot, readSlotSummary, rawKey } from '../data/saves.js'
import { drawSprite, spriteSize, GUGU } from '../data/pixelSprites.js'

const emit = defineEmits(['select', 'back'])

const total = ACHIEVEMENTS.length
const active = getSlot()

// resumo de cada slot (lido uma vez ao abrir a tela)
const slots = ref(
  Array.from({ length: SLOT_COUNT }, (_, i) => readSlotSummary(i + 1))
)

// mini Gugu escondido: 3 cliques → save secreto (tudo desbloqueado + 5000 moedas)
const guguCanvas = ref(null)
const guguWiggle = ref(false)
let guguClicks = 0

function tapGugu() {
  guguClicks++
  guguWiggle.value = false
  requestAnimationFrame(() => (guguWiggle.value = true))
  if (guguClicks >= 3) {
    localStorage.setItem(rawKey(SECRET_SLOT, 'coins'), '5000')
    localStorage.setItem(rawKey(SECRET_SLOT, 'achievements'), JSON.stringify(ACHIEVEMENTS.map((a) => a.id)))
    emit('select', SECRET_SLOT)
  }
}

onMounted(() => {
  const ctx = guguCanvas.value.getContext('2d')
  const scale = 5
  const size = spriteSize(GUGU.idle, scale)
  drawSprite(ctx, (guguCanvas.value.width - size.w) / 2, 0, GUGU.idle, scale)
})
</script>

<template>
  <div class="save">
    <div class="save-sky"></div>

    <header class="save-header">
      <h2 class="save-title">💾 Escolha o Save</h2>
      <p class="save-sub">Cada slot guarda banco e conquistas separados.</p>
    </header>

    <ul class="save-list">
      <li v-for="s in slots" :key="s.slot">
        <button
          class="save-card"
          :class="{ current: s.slot === active }"
          @click="emit('select', s.slot)"
        >
          <span class="save-slot">Slot {{ s.slot }}</span>
          <span class="save-info" v-if="s.used">
            <span class="save-coins">🪙 {{ s.coins }}</span>
            <span class="save-ach">🏆 {{ s.achievements }}/{{ total }}</span>
          </span>
          <span class="save-info save-empty" v-else>Novo jogo</span>
        </button>
      </li>
    </ul>

    <canvas
      ref="guguCanvas"
      width="90"
      height="90"
      class="save-gugu"
      :class="{ wiggle: guguWiggle }"
      title="Gugu?"
      @click="tapGugu"
    ></canvas>

    <button class="save-back" @click="emit('back')">← Voltar</button>
  </div>
</template>

<style scoped>
.save {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px;
  box-sizing: border-box;
  overflow-y: auto;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  color: #e8edf5;
  user-select: none;
}

.save-sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}

.save-header {
  position: relative;
  z-index: 1;
  text-align: center;
}

.save-title {
  margin: 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 1.1rem;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 0 10px var(--px-purple, #9b7bff), 0 3px 0 #4a2f8f;
}

.save-sub {
  margin: 8px 0 0;
  font-size: 0.78rem;
  opacity: 0.7;
}

.save-list {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.save-card {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px;
  border: 2px solid rgba(155, 123, 255, 0.4);
  border-radius: 6px;
  background: rgba(52, 40, 84, 0.45);
  color: #e8edf5;
  cursor: pointer;
  font-family: inherit;
  box-shadow: inset 0 0 22px rgba(120, 90, 220, 0.1);
  transition: filter 0.12s, transform 0.08s, border-color 0.12s;
}
.save-card:hover {
  filter: brightness(1.15);
}
.save-card:active {
  transform: translateY(2px);
}
.save-card.current {
  border-color: var(--px-gold, #ffd24d);
  box-shadow: 0 0 16px rgba(255, 207, 58, 0.35), inset 0 0 22px rgba(120, 90, 220, 0.12);
}

.save-slot {
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.8rem;
  color: #fff;
}

.save-info {
  display: flex;
  gap: 14px;
  font-size: 0.9rem;
  font-weight: bold;
}
.save-coins {
  color: var(--px-gold, #ffd24d);
}
.save-ach {
  color: var(--px-purple, #9b7bff);
}
.save-empty {
  opacity: 0.55;
  font-weight: normal;
  font-style: italic;
}

.save-gugu {
  position: relative;
  z-index: 1;
  align-self: center;
  margin-top: 4px;
  image-rendering: pixelated;
  cursor: pointer;
  filter: drop-shadow(0 0 8px rgba(111, 207, 91, 0.35));
}
.save-gugu.wiggle {
  animation: save-gugu-wiggle 0.35s ease;
}
@keyframes save-gugu-wiggle {
  0%, 100% { transform: rotate(0) scale(1); }
  30% { transform: rotate(-8deg) scale(1.12); }
  70% { transform: rotate(8deg) scale(1.12); }
}

.save-back {
  position: relative;
  z-index: 1;
  margin-top: auto;
  align-self: center;
  padding: 12px 22px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.75rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  cursor: pointer;
  transition: filter 0.12s;
}
.save-back:hover {
  filter: brightness(1.2);
}
</style>
