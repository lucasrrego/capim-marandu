<script setup>
import { ref, computed } from 'vue'
import { ACHIEVEMENTS, loadUnlocked, isUnlocked } from '../data/achievements.js'

const emit = defineEmits(['back'])

// lê o estado uma vez ao abrir a tela (só muda durante o jogo, não aqui)
const unlocked = ref(loadUnlocked())

const items = computed(() =>
  ACHIEVEMENTS.map((a) => ({ ...a, done: isUnlocked(a.id, unlocked.value) }))
)
const doneCount = computed(() => items.value.filter((a) => a.done).length)
</script>

<template>
  <div class="ach">
    <div class="ach-sky"></div>

    <header class="ach-header">
      <h2 class="ach-title">🏆 Conquistas</h2>
      <p class="ach-count">{{ doneCount }} / {{ items.length }}</p>
    </header>

    <ul class="ach-list">
      <li v-for="a in items" :key="a.id" class="ach-card" :class="{ locked: !a.done }">
        <span class="ach-icon">{{ a.done ? a.icon : '🔒' }}</span>
        <span class="ach-info">
          <span class="ach-name">{{ a.name }}</span>
          <span class="ach-desc">{{ a.desc }}</span>
        </span>
        <span class="ach-badge">{{ a.done ? 'FEITO' : '—' }}</span>
      </li>
    </ul>

    <button class="ach-back" @click="emit('back')">← Voltar</button>
  </div>
</template>

<style scoped>
.ach {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 18px;
  box-sizing: border-box;
  overflow-y: auto;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  color: #e8edf5;
  user-select: none;
}

.ach-sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}

.ach-header {
  position: relative;
  text-align: center;
  z-index: 1;
}

.ach-title {
  margin: 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 1.1rem;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 0 10px var(--px-purple, #9b7bff), 0 3px 0 #4a2f8f;
}

.ach-count {
  margin: 8px 0 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.7rem;
  color: var(--px-gold, #ffd24d);
  text-shadow: 0 0 8px rgba(255, 207, 58, 0.5);
}

.ach-list {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ach-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid rgba(155, 123, 255, 0.4);
  border-radius: 6px;
  background: rgba(52, 40, 84, 0.45);
  box-shadow: inset 0 0 22px rgba(120, 90, 220, 0.1);
}

.ach-card.locked {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  opacity: 0.7;
}

.ach-icon {
  font-size: 1.8rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(255, 207, 58, 0.5));
}
.ach-card.locked .ach-icon {
  filter: none;
}

.ach-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.ach-name {
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.72rem;
  color: #fff;
}

.ach-desc {
  font-size: 0.78rem;
  line-height: 1.3;
  opacity: 0.7;
}

.ach-badge {
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.6rem;
  color: var(--px-gold, #ffd24d);
}
.ach-card.locked .ach-badge {
  color: var(--px-dim, #8f83b3);
}

.ach-back {
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
.ach-back:hover {
  filter: brightness(1.2);
}
</style>
