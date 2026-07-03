<script setup>
defineProps({
  segment: { type: Number, default: 1 },
  color: { type: String, default: '#aa3bff' },
})
defineEmits(['back'])
</script>

<template>
  <div class="minigame">
    <div class="minigame-grid"></div>

    <header class="minigame-header">
      <span class="minigame-badge" :style="{ borderColor: color, color }">WARP {{ segment }}/5</span>
      <h2>Mini game</h2>
      <p class="minigame-hint">Em breve: desafio especial neste portal.</p>
    </header>

    <div class="minigame-portal" :style="{ '--portal-color': color }">
      <span class="minigame-portal-ring"></span>
      <span class="minigame-portal-core">?</span>
    </div>

    <div class="minigame-actions">
      <button class="minigame-btn" @click="$emit('back')">← Voltar ao jogo</button>
    </div>
  </div>
</template>

<style scoped>
.minigame {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #0a0e18 0%, #121a2a 55%, #1a2438 100%);
  border-radius: 8px;
  color: #e8edf5;
  font-family: ui-monospace, Consolas, monospace;
  text-align: center;
}

.minigame-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(170, 59, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(170, 59, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.minigame-header {
  position: relative;
  z-index: 1;
}

.minigame-badge {
  display: inline-block;
  padding: 3px 10px;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  border: 1px solid;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
}

.minigame-header h2 {
  margin: 10px 0 0;
  font-size: 1.6rem;
  color: #fff;
}

.minigame-hint {
  margin: 8px 0 0;
  font-size: 0.8rem;
  opacity: 0.65;
  line-height: 1.4;
}

.minigame-portal {
  position: relative;
  z-index: 1;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
}

.minigame-portal-ring {
  position: absolute;
  inset: 0;
  border: 3px solid var(--portal-color, #aa3bff);
  border-radius: 50%;
  box-shadow: 0 0 24px color-mix(in srgb, var(--portal-color) 50%, transparent);
  animation: spin 6s linear infinite;
}

.minigame-portal-core {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--portal-color, #aa3bff);
  text-shadow: 0 0 16px color-mix(in srgb, var(--portal-color) 60%, transparent);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.minigame-actions {
  position: relative;
  z-index: 1;
  margin-top: auto;
  width: 100%;
  max-width: 280px;
}

.minigame-btn {
  width: 100%;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  padding: 14px 20px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: bold;
  background: var(--accent, #aa3bff);
  color: #fff;
  transition: filter 0.15s, transform 0.1s;
}

.minigame-btn:hover { filter: brightness(1.15); }
.minigame-btn:active { transform: scale(0.97); }
</style>
