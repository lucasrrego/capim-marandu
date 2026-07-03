<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { drawSprite, GUGU } from '../data/pixelSprites.js'
import { playConfirm, playSelect, playSparkle, startTheme, stopTheme } from '../audio/sfx.js'

defineProps({ dev: { type: Boolean, default: false } })
const emit = defineEmits(['play', 'minigame'])

const guguCanvas = ref(null)
const GUGU_SCALE = 8

let armed = false

// Áudio só pode tocar após um gesto do usuário — armamos no primeiro toque/tecla.
function armAudio() {
  if (armed) return
  armed = true
  startTheme()
  playSparkle()
}

function play() {
  armAudio()
  playConfirm()
  emit('play')
}

function openMinigame() {
  armAudio()
  playConfirm()
  emit('minigame')
}

function onKey(e) {
  armAudio()
  if (e.key === 'Enter') play()
}

onMounted(() => {
  const ctx = guguCanvas.value.getContext('2d')
  drawSprite(ctx, 0, 0, GUGU.dazzled, GUGU_SCALE)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  stopTheme()
})
</script>

<template>
  <div class="start" @pointerdown="armAudio">
    <div class="start-sky"></div>
    <div class="start-stars"></div>

    <div class="start-moon">
      <svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        <g fill="#e9e6d8">
          <rect x="4" y="1" width="4" height="1" />
          <rect x="3" y="2" width="6" height="1" />
          <rect x="2" y="3" width="8" height="1" />
          <rect x="1" y="4" width="10" height="1" />
          <rect x="1" y="5" width="10" height="1" />
          <rect x="1" y="6" width="10" height="1" />
          <rect x="1" y="7" width="10" height="1" />
          <rect x="2" y="8" width="8" height="1" />
          <rect x="3" y="9" width="6" height="1" />
          <rect x="4" y="10" width="4" height="1" />
        </g>
        <g fill="#c3bfa9">
          <rect x="9" y="4" width="1" height="1" />
          <rect x="9" y="5" width="2" height="1" />
          <rect x="8" y="6" width="3" height="1" />
          <rect x="8" y="7" width="3" height="1" />
          <rect x="7" y="8" width="3" height="1" />
          <rect x="6" y="9" width="3" height="1" />
        </g>
        <g fill="#b7b39d">
          <rect x="3" y="3" width="1" height="1" />
          <rect x="2" y="6" width="1" height="1" />
          <rect x="5" y="5" width="1" height="1" />
          <rect x="4" y="8" width="1" height="1" />
        </g>
      </svg>
    </div>

    <div class="start-content">
      <canvas ref="guguCanvas" class="start-gugu" width="128" height="136"></canvas>

      <h1 class="start-title">GUGU</h1>
      <p class="start-acronym">
        <b>G</b>enoma <b>U</b>ltra <b>G</b>aláctico <b>Ú</b>nico
      </p>
      <p class="start-subtitle">Rumo à Lua</p>

      <button class="start-btn" @click="play" @pointerenter="playSelect">▶ Bora, Gugu!</button>
      <button v-if="dev" class="start-btn start-btn-mini" @click="openMinigame" @pointerenter="playSelect">🛸 Sonho da Vó Baiana</button>
    </div>
  </div>
</template>

<style scoped>
.start {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  user-select: none;
}

.start-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}

.start-stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    30px 40px #fff, 80px 120px #cfe4ff, 150px 60px #fff, 210px 200px #ffd9f0,
    260px 90px #fff, 320px 260px #fff, 90px 300px #cfe4ff, 400px 140px #fff,
    440px 340px #fff, 40px 220px #fff, 190px 420px #e6e6ff, 300px 480px #fff,
    120px 520px #fff, 360px 560px #cfe4ff, 60px 600px #fff, 240px 350px #fff,
    420px 480px #ffd9f0, 20px 460px #fff, 340px 40px #fff, 140px 180px #fff;
  opacity: 0.9;
  animation: start-twinkle 3.5s ease-in-out infinite;
}
@keyframes start-twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.start-moon {
  position: absolute;
  top: 26px;
  right: 30px;
  width: 52px;
  height: 52px;
  filter: drop-shadow(0 0 14px rgba(246, 243, 232, 0.45));
}
.start-moon svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.start-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 26px;
  box-sizing: border-box;
  text-align: center;
}

.start-gugu {
  width: 116px;
  height: auto;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 12px rgba(111, 207, 91, 0.35));
  animation: start-bob 1.6s ease-in-out infinite;
}
@keyframes start-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.start-title {
  margin: 4px 0 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 2.6rem;
  line-height: 1;
  letter-spacing: 3px;
  color: #fff;
  text-shadow:
    0 0 10px var(--px-purple, #9b7bff),
    0 0 22px rgba(155, 123, 255, 0.6),
    0 3px 0 #4a2f8f;
}

.start-acronym {
  margin: 2px 0 0;
  font-size: 0.72rem;
  letter-spacing: 1px;
  color: #cfc7ee;
  opacity: 0.85;
}
.start-acronym b {
  color: var(--px-purple, #9b7bff);
  text-shadow: 0 0 8px rgba(155, 123, 255, 0.6);
}

.start-subtitle {
  margin: 0;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.85rem;
  letter-spacing: 2px;
  color: var(--px-gold, #ffd24d);
  text-shadow: 0 0 10px rgba(255, 207, 58, 0.6);
}

.start-btn {
  margin-top: 18px;
  padding: 14px 22px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.85rem;
  color: #fff;
  background: var(--px-red, #d0392e);
  border: 3px solid #7a1f18;
  border-radius: 4px;
  box-shadow: 0 4px 0 #5a1510, 0 0 18px rgba(208, 57, 46, 0.5);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.start-btn:hover { filter: brightness(1.12); }
.start-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #5a1510; }

.start-btn-mini {
  margin-top: 10px;
  font-size: 0.62rem;
  background: var(--px-purple, #9b7bff);
  border-color: #4a2f8f;
  box-shadow: 0 4px 0 #35216a, 0 0 18px rgba(155, 123, 255, 0.5);
}
.start-btn-mini:active { box-shadow: 0 1px 0 #35216a; }

@media (max-width: 720px) {
  .start-title { font-size: 2rem; }
}
</style>
