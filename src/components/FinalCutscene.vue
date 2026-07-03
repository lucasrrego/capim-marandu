<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { drawSprite, GUGU, GUARD, ET_BILU } from '../data/pixelSprites.js'
import { playCash, playConfirm, playSelect, playSparkle, playWisdom, resume } from '../audio/sfx.js'

const emit = defineEmits(['done'])

// ---- Roteiro: 3 cenas, 9 falas ------------------------------------------
// O plot twist: a Lua dos sonhos virou um outlet cafona (Musk comprou tudo),
// cobra-se pedágio até pra olhar a Terra, e o Gugu — em vez de brigar —
// finge costume, se encanta, e no fim lembra da lição do pai: "busquem conhecimento".
const STEPS = [
  { scene: 1, who: 'gugu', pose: 'dazzled', name: 'Gugu', sfx: 'sparkle',
    text: 'Consegui, pai! A LUA! Igualzinho nas suas histórias!' },
  { scene: 1, who: 'gugu', pose: 'idle', name: 'Gugu',
    text: 'Que movimento, né? Tá tudo ótimo.' },
  { scene: 1, who: 'gugu', pose: 'dazzled', name: 'Gugu', sfx: 'sparkle',
    text: 'Que telões enormes! Quanta luzinha piscando! É, bem moderninho.' },
  { scene: 2, who: 'guard', name: 'Guarda Lunar', sfx: 'cash',
    text: 'Estacionamento de foguete: 500 luas-dólar.' },
  { scene: 2, who: 'gugu', pose: 'idle', name: 'Gugu',
    text: 'Ah, claro! Faz todo sentido. Com certeza.' },
  { scene: 2, who: 'gugu', pose: 'idle', name: 'Gugu',
    text: 'Moço, eu só queria um cantinho pra olhar a Terra de longe.' },
  { scene: 2, who: 'guard', name: 'Guarda Lunar', sfx: 'cash',
    text: 'Mirante da Terra? Setor premium. Mais 200. Débito, crédito ou pix? Aproxima?' },
  { scene: 3, who: 'gugu', pose: 'idle', name: 'Gugu',
    text: 'O papai, o grande ET Bilu, vivia dizendo uma coisa.' },
  { scene: 3, who: 'gugu', pose: 'thumbsUp', name: 'Gugu', sfx: 'wisdom',
    text: '«Busquem conhecimento.» A vista, qualquer um compra. Mas a viagem até aqui, o encanto de chegar, isso não tem pedágio.' },
]

// Outdoros cafona por cena (paródia). Cores neon; a cena 3 fica esmaecida.
const BILLBOARDS = {
  1: [
    { t: 'MUSKLAND™', x: '5%', y: '9%', rot: -6, c: 'pink' },
    { t: '🍔 -70%', x: '66%', y: '7%', rot: 5, c: 'gold' },
    { t: 'COMPRE JÁ', x: '9%', y: '30%', rot: 3, c: 'cyan' },
    { t: '🚀 X', x: '72%', y: '31%', rot: -4, c: 'red' },
    { t: 'WIFI GRÁTIS*', x: '37%', y: '1%', rot: 0, c: 'green' },
  ],
  2: [
    { t: 'PEDÁGIO $$$', x: '6%', y: '7%', rot: -3, c: 'gold' },
    { t: 'ESTACIONE $500', x: '50%', y: '11%', rot: 4, c: 'red' },
    { t: 'MIRANTE VIP', x: '28%', y: '31%', rot: 0, c: 'pink' },
  ],
  3: [
    { t: 'MUSKLAND™', x: '7%', y: '12%', rot: -6, c: 'dim' },
    { t: 'COMPRE JÁ', x: '67%', y: '15%', rot: 4, c: 'dim' },
  ],
}

const index = ref(0)
const shown = ref(0)           // nº de caracteres revelados (máquina de escrever)
const portrait = ref(null)
const memory = ref(null)       // ET Bilu ao fundo (memória distante, cena 3)

const step = computed(() => STEPS[index.value])
const billboards = computed(() => BILLBOARDS[step.value.scene])
const typing = computed(() => shown.value < step.value.text.length)
const visibleText = computed(() => step.value.text.slice(0, shown.value))
const isLast = computed(() => index.value === STEPS.length - 1)

let typer = 0
const TYPE_MS = 24

function stopTyper() { if (typer) { clearInterval(typer); typer = 0 } }

function startTyper() {
  stopTyper()
  shown.value = 0
  typer = setInterval(() => {
    shown.value++
    if (shown.value >= step.value.text.length) stopTyper()
  }, TYPE_MS)
}

function playStepSfx() {
  const s = step.value.sfx
  if (s === 'sparkle') playSparkle()
  else if (s === 'cash') playCash()
  else if (s === 'wisdom') playWisdom()
  else playSelect()
}

function drawPortrait() {
  const ctx = portrait.value.getContext('2d')
  ctx.clearRect(0, 0, portrait.value.width, portrait.value.height)
  const rows = step.value.who === 'guard' ? GUARD.idle : GUGU[step.value.pose || 'idle']
  drawSprite(ctx, 0, 0, rows, 7)
}

// Cooldown entre avanços — evita pular várias falas de uma vez com um toque
// acidental (ex.: cliques em rajada ou eventos duplicados de ponteiro).
let lastAdvance = 0
const ADVANCE_CD = 180

// Avança: se ainda digitando, completa a linha; senão, próxima fala (ou fim).
function advance() {
  resume()
  if (typing.value) {
    stopTyper()
    shown.value = step.value.text.length
    return
  }
  const now = performance.now()
  if (now - lastAdvance < ADVANCE_CD) return
  lastAdvance = now
  if (isLast.value) {
    playConfirm()
    finish()
    return
  }
  index.value++
}

let done = false
function finish() {
  if (done) return
  done = true
  stopTyper()
  emit('done')
}

function onKey(e) {
  // Ignora auto-repeat: se o jogador chega na cut scene com Espaço ainda
  // segurado (do freio do pouso), o navegador dispara keydowns repetidos que
  // varreriam todas as falas de uma vez. Só o pressionar inicial conta.
  if (e.repeat) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
  else if (e.key === 'Escape') finish()
}

// A cada nova fala: redesenha o portrait, toca o SFX e reinicia a digitação.
watch(index, () => {
  drawPortrait()
  playStepSfx()
  startTyper()
})

onMounted(() => {
  drawPortrait()
  drawSprite(memory.value.getContext('2d'), 0, 0, ET_BILU, 9)  // lembrança do pai
  playStepSfx()
  startTyper()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  stopTyper()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="cut" @pointerdown="advance">
    <div class="cut-sky"></div>
    <div class="cut-stars"></div>

    <!-- Decoração da cena (troca com fade a cada cena) -->
    <div class="cut-decor" :key="step.scene">
      <!-- A Terra: minúscula, distante, quase escondida atrás da propaganda (só na cena 3) -->
      <div v-if="step.scene === 3" class="cut-earth">
        <svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
          <g fill="#3a7bff">
            <rect x="4" y="1" width="4" height="1" /><rect x="3" y="2" width="6" height="1" />
            <rect x="2" y="3" width="8" height="1" /><rect x="1" y="4" width="10" height="1" />
            <rect x="1" y="5" width="10" height="1" /><rect x="1" y="6" width="10" height="1" />
            <rect x="1" y="7" width="10" height="1" /><rect x="2" y="8" width="8" height="1" />
            <rect x="3" y="9" width="6" height="1" /><rect x="4" y="10" width="4" height="1" />
          </g>
          <g fill="#6fcf5b">
            <rect x="3" y="3" width="2" height="1" /><rect x="6" y="4" width="3" height="1" />
            <rect x="2" y="6" width="2" height="1" /><rect x="7" y="7" width="2" height="1" />
            <rect x="4" y="8" width="2" height="1" />
          </g>
          <g fill="#d5f0ff">
            <rect x="5" y="2" width="2" height="1" /><rect x="8" y="5" width="1" height="1" />
          </g>
        </svg>
      </div>

      <!-- Outdoros cafona -->
      <div
        v-for="(b, i) in billboards"
        :key="i"
        class="cut-board"
        :class="'c-' + b.c"
        :style="{ left: b.x, top: b.y, transform: 'rotate(' + b.rot + 'deg)' }"
      >{{ b.t }}</div>
    </div>

    <!-- ET Bilu: memória distante do pai, surge quando o Gugu fala dele -->
    <canvas
      ref="memory"
      class="cut-memory"
      :class="{ show: step.scene === 3 }"
      width="144"
      height="153"
    ></canvas>

    <!-- Chão lunar -->
    <div class="cut-ground"></div>

    <!-- Personagem em cena -->
    <canvas ref="portrait" class="cut-portrait" width="112" height="119"></canvas>

    <!-- Caixa de diálogo -->
    <div class="cut-box">
      <span class="cut-name" :class="step.who === 'guard' ? 'n-guard' : 'n-gugu'">{{ step.name }}</span>
      <p class="cut-text">{{ visibleText }}<span v-if="typing" class="cut-caret">▋</span></p>
      <span v-if="!typing" class="cut-next">{{ isLast ? '✔ fim' : '▶' }}</span>
    </div>

    <p class="cut-hint">clique ou espaço para avançar</p>
    <button class="cut-skip" @pointerdown.stop @click.stop="finish">Pular ⏭</button>
  </div>
</template>

<style scoped>
.cut {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--px-space-0, #04040a);
  user-select: none;
  cursor: pointer;
}

.cut-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}

.cut-stars {
  position: absolute;
  top: 0; left: 0;
  width: 2px; height: 2px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    30px 40px #fff, 80px 120px #cfe4ff, 150px 60px #fff, 210px 200px #ffd9f0,
    260px 90px #fff, 320px 260px #fff, 90px 300px #cfe4ff, 400px 140px #fff,
    440px 90px #fff, 40px 220px #fff, 190px 150px #e6e6ff, 300px 60px #fff,
    120px 200px #fff, 360px 180px #cfe4ff, 60px 260px #fff, 240px 40px #fff;
  opacity: 0.8;
  animation: cut-twinkle 3.5s ease-in-out infinite;
}
@keyframes cut-twinkle {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.95; }
}

.cut-decor {
  position: absolute;
  inset: 0;
  animation: cut-fade 0.5s ease;
}
@keyframes cut-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.cut-earth {
  position: absolute;
  top: 25%;
  left: 68%;
  width: 34px;
  height: 34px;
  filter: drop-shadow(0 0 10px rgba(108, 198, 255, 0.6));
  animation: cut-earth-bob 4s ease-in-out infinite;
}
.cut-earth svg { width: 100%; height: 100%; image-rendering: pixelated; }
@keyframes cut-earth-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Outdoros neon cafona */
.cut-board {
  position: absolute;
  padding: 6px 8px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.6rem;
  line-height: 1;
  color: #12131a;
  border: 3px solid rgba(0, 0, 0, 0.35);
  border-radius: 2px;
  white-space: nowrap;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.4);
  animation: cut-blink 1.4s steps(2, jump-none) infinite;
}
@keyframes cut-blink {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}
.c-pink { background: #ff6ea8; color: #3a0a1f; }
.c-gold { background: var(--px-gold, #ffd24d); }
.c-cyan { background: var(--px-blue, #6cc6ff); }
.c-red  { background: var(--px-red, #d0392e); color: #fff; }
.c-green { background: var(--px-green-hi, #6fcf5b); }
.c-dim {
  background: rgba(80, 72, 110, 0.5);
  color: rgba(220, 214, 240, 0.5);
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: none;
  animation: none;
}

/* ET Bilu — memória distante: grande, quase transparente, flutuando atrás */
.cut-memory {
  position: absolute;
  left: 50%;
  top: 20px;
  width: 200px;
  height: auto;
  transform: translateX(-50%);
  image-rendering: pixelated;
  opacity: 0;
  filter: drop-shadow(0 0 18px rgba(111, 207, 91, 0.5));
  transition: opacity 1.6s ease;
  animation: cut-memory-float 5s ease-in-out infinite;
  pointer-events: none;
}
.cut-memory.show { opacity: 0.16; }
@keyframes cut-memory-float {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-8px); }
}

/* Chão lunar cinzento (behind portrait / box) */
.cut-ground {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: 42%;
  background:
    linear-gradient(180deg, rgba(120, 116, 140, 0) 0%, #4a4560 22%, #2e2b42 100%);
}

.cut-portrait {
  position: absolute;
  left: 50%;
  bottom: 190px;
  width: 112px;
  height: auto;
  transform: translateX(-50%);
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 0 rgba(0, 0, 0, 0.35));
  animation: cut-bob 1.8s ease-in-out infinite;
}
@keyframes cut-bob {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-4px); }
}

/* Caixa de diálogo pixel */
.cut-box {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 46px;
  min-height: 108px;
  padding: 14px 16px 16px;
  background: rgba(12, 9, 24, 0.92);
  border: 3px solid var(--px-purple, #9b7bff);
  border-radius: 6px;
  box-shadow: 0 0 0 3px #04040a, 0 0 20px rgba(155, 123, 255, 0.35);
}

.cut-name {
  display: inline-block;
  margin-bottom: 10px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.72rem;
  letter-spacing: 1px;
}
.n-gugu { color: var(--px-green-hi, #6fcf5b); text-shadow: 0 0 8px rgba(111, 207, 91, 0.6); }
.n-guard { color: var(--px-blue, #6cc6ff); text-shadow: 0 0 8px rgba(108, 198, 255, 0.6); }

.cut-text {
  margin: 0;
  font-family: 'VT323', monospace;
  font-size: 1.42rem;
  line-height: 1.28;
  color: #fff;
  text-shadow: 0 0 6px rgba(160, 190, 255, 0.35);
}
.cut-caret {
  color: var(--px-gold, #ffd24d);
  animation: cut-caret 0.5s steps(2) infinite;
}
@keyframes cut-caret {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cut-next {
  position: absolute;
  right: 14px;
  bottom: 10px;
  font-family: var(--pixel, 'Press Start 2P', monospace);
  font-size: 0.6rem;
  color: var(--px-gold, #ffd24d);
  animation: cut-caret 0.7s steps(2) infinite;
}

.cut-hint {
  position: absolute;
  left: 0; right: 0;
  bottom: 16px;
  margin: 0;
  text-align: center;
  font-family: 'VT323', monospace;
  font-size: 1.05rem;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.cut-skip {
  position: absolute;
  right: 12px;
  top: 12px;
  padding: 8px 14px;
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  color: #fff;
  background: rgba(20, 15, 32, 0.7);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  z-index: 3;
}
.cut-skip:hover { background: rgba(155, 123, 255, 0.3); }
</style>
