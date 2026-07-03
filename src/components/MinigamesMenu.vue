<script setup>
import { onMounted, onUnmounted } from 'vue'
import { playConfirm, playSelect, startTheme, stopMusic } from '../audio/sfx.js'

const emit = defineEmits(['select', 'back'])

const GAMES = [
  { id: 'abduction', icon: '🛸', name: 'Sonho da Vó Baiana', desc: 'Abduza os jogadores' },
  { id: 'moon', icon: '🌙', name: 'Pouso na Lua', desc: 'Pouse na plataforma' },
  { id: 'boss', icon: '👾', name: 'Luta com o Chefe', desc: 'Encare a nave inimiga' },
]

function pick(id) {
  playConfirm()
  emit('select', id)
}

function back() {
  playSelect()
  emit('back')
}

onMounted(() => { startTheme() })
onUnmounted(() => { stopMusic() })
</script>

<template>
  <div class="mm">
    <div class="mm-sky"></div>
    <div class="mm-content">
      <h1 class="mm-title">Mini-games</h1>
      <ul class="mm-list">
        <li v-for="g in GAMES" :key="g.id">
          <button class="mm-btn" @click="pick(g.id)" @pointerenter="playSelect">
            <span class="mm-icon">{{ g.icon }}</span>
            <span class="mm-text">
              <span class="mm-name">{{ g.name }}</span>
              <span class="mm-desc">{{ g.desc }}</span>
            </span>
          </button>
        </li>
      </ul>
      <button class="mm-back" @click="back" @pointerenter="playSelect">← Voltar</button>
    </div>
  </div>
</template>

<style scoped>
.mm {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  user-select: none;
}
.mm-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}
.mm-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 26px;
  box-sizing: border-box;
  text-align: center;
}
.mm-title {
  margin: 0 0 6px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 1.6rem;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 0 10px var(--px-purple, #9b7bff), 0 3px 0 #4a2f8f;
}
.mm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 320px;
}
.mm-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  color: #fff;
  text-align: left;
  background: var(--px-purple, #9b7bff);
  border: 3px solid #4a2f8f;
  border-radius: 4px;
  box-shadow: 0 4px 0 #35216a, 0 0 18px rgba(155, 123, 255, 0.4);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.mm-btn:hover { filter: brightness(1.12); }
.mm-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #35216a; }
.mm-icon { font-size: 1.6rem; line-height: 1; }
.mm-text { display: flex; flex-direction: column; gap: 4px; }
.mm-name { font-size: 0.7rem; }
.mm-desc {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.66rem;
  opacity: 0.75;
}
.mm-back {
  margin-top: 8px;
  padding: 10px 20px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.7rem;
  color: #ccc;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  cursor: pointer;
}
.mm-back:hover { filter: brightness(1.2); }
</style>
