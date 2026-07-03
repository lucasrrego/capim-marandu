<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits(['done'])

const crawl = ref(null)
const inner = ref(null)

// ---- Animação do crawl (rAF, para permitir acelerar) ----
const BASE_DUR = 42          // segundos para percorrer tudo em velocidade normal
const FAST_MUL = 5           // multiplicador ao segurar qualquer tecla
const pressed = new Set()    // teclas atualmente pressionadas
let raf = 0
let last = 0
let posY = 0                 // deslocamento vertical atual (px)
let endY = 0                 // ponto em que o texto saiu por cima
let speedPxS = 0             // px/s em velocidade normal
let done = false

function finish() {
  if (done) return
  done = true
  stopMusic()
  emit('done')
}

function loop(ts) {
  if (!last) {
    last = ts
    const h = crawl.value.clientHeight
    const ih = inner.value.offsetHeight
    posY = h                 // começa logo abaixo da área visível
    endY = -ih               // termina quando sai inteiro por cima
    speedPxS = (h + ih) / BASE_DUR
  }
  const dt = Math.min(0.05, (ts - last) / 1000)
  last = ts
  const mul = pressed.size > 0 ? FAST_MUL : 1
  posY -= speedPxS * mul * dt
  inner.value.style.transform = `translateY(${posY}px)`
  if (posY <= endY) { finish(); return }
  raf = requestAnimationFrame(loop)
}

const onDown = (e) => { pressed.add(e.key) }
const onUp = (e) => { pressed.delete(e.key) }

// ---- Música chiptune (Web Audio, sem arquivos) ----
let audioCtx = null
let musicTimer = 0

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12) }

const LEAD = [
  69, 72, 76, 72, 81, 76, 72, 76,
  67, 71, 74, 71, 79, 74, 71, 74,
  65, 69, 72, 69, 77, 72, 69, 72,
  64, 68, 71, 76, 71, 68, 71, 68,
]
const BASS = [
  45, null, null, null, 45, null, null, null,
  43, null, null, null, 43, null, null, null,
  41, null, null, null, 41, null, null, null,
  40, null, null, null, 40, null, null, null,
]
const STEP = 0.15

function startMusic() {
  if (audioCtx) return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  audioCtx = new AC()

  const master = audioCtx.createGain()
  master.gain.value = 0.16
  master.connect(audioCtx.destination)

  const playNote = (freq, time, dur, type, gain) => {
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = type
    o.frequency.value = freq
    o.connect(g)
    g.connect(master)
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    o.start(time)
    o.stop(time + dur + 0.03)
  }

  const startTime = audioCtx.currentTime + 0.1
  let nextStep = 0
  const scheduler = () => {
    if (!audioCtx) return
    while (startTime + nextStep * STEP < audioCtx.currentTime + 0.2) {
      const t = startTime + nextStep * STEP
      const lead = LEAD[nextStep % LEAD.length]
      if (lead) playNote(midiToFreq(lead), t, STEP * 1.6, 'square', 0.45)
      const bass = BASS[nextStep % BASS.length]
      if (bass) playNote(midiToFreq(bass), t, STEP * 3.2, 'triangle', 0.55)
      nextStep++
    }
  }
  scheduler()
  musicTimer = setInterval(scheduler, 60)
}

function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = 0 }
  if (audioCtx) { audioCtx.close(); audioCtx = null }
}

onMounted(() => {
  startMusic()               // vem de um clique no botão Jogar, então já é permitido
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  raf = requestAnimationFrame(loop)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onDown)
  window.removeEventListener('keyup', onUp)
  stopMusic()
})
</script>

<template>
  <div class="intro" @pointerdown="startMusic">
    <div class="intro-sky"></div>
    <div class="intro-stars"></div>
    <div class="intro-moon">
      <svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        <!-- disco iluminado -->
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
        <!-- sombra (crescente inferior-direita) -->
        <g fill="#c3bfa9">
          <rect x="9" y="4" width="1" height="1" />
          <rect x="9" y="5" width="2" height="1" />
          <rect x="8" y="6" width="3" height="1" />
          <rect x="8" y="7" width="3" height="1" />
          <rect x="7" y="8" width="3" height="1" />
          <rect x="6" y="9" width="3" height="1" />
        </g>
        <!-- crateras -->
        <g fill="#b7b39d">
          <rect x="3" y="3" width="1" height="1" />
          <rect x="2" y="6" width="1" height="1" />
          <rect x="5" y="5" width="1" height="1" />
          <rect x="4" y="8" width="1" height="1" />
        </g>
      </svg>
    </div>

    <!-- ET consertando o foguete (pixel art animado) -->
    <div class="intro-scene">
      <svg viewBox="0 0 40 40" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        <!-- foguete -->
        <g>
          <!-- bico -->
          <rect x="26" y="6" width="2" height="2" fill="#d0392e" />
          <rect x="25" y="8" width="4" height="2" fill="#d0392e" />
          <rect x="24" y="10" width="6" height="2" fill="#d0392e" />
          <!-- corpo -->
          <rect x="24" y="12" width="6" height="18" fill="#e8e8f0" />
          <rect x="28" y="12" width="2" height="18" fill="#b8b8c8" />
          <!-- janela -->
          <rect x="25" y="15" width="3" height="3" fill="#6cc6ff" />
          <rect x="25" y="15" width="1" height="1" fill="#d5f0ff" />
          <!-- faixa -->
          <rect x="24" y="22" width="6" height="2" fill="#d0392e" />
          <!-- aletas -->
          <rect x="21" y="27" width="3" height="5" fill="#a12b22" />
          <rect x="30" y="27" width="3" height="5" fill="#a12b22" />
          <!-- base -->
          <rect x="24" y="30" width="6" height="3" fill="#7a1f18" />
        </g>

        <!-- ET -->
        <g>
          <!-- cabeça -->
          <rect x="6" y="15" width="9" height="9" fill="#6fcf5b" />
          <rect x="12" y="15" width="3" height="9" fill="#3fa03a" />
          <!-- olhos -->
          <rect x="7" y="18" width="3" height="2" fill="#12131a" />
          <rect x="11" y="18" width="3" height="2" fill="#12131a" />
          <rect x="8" y="18" width="1" height="1" fill="#ffffff" />
          <rect x="12" y="18" width="1" height="1" fill="#ffffff" />
          <!-- corpo -->
          <rect x="8" y="24" width="6" height="6" fill="#6fcf5b" />
          <rect x="12" y="24" width="2" height="6" fill="#3fa03a" />
          <!-- pernas -->
          <rect x="8" y="30" width="2" height="3" fill="#3fa03a" />
          <rect x="12" y="30" width="2" height="3" fill="#3fa03a" />
          <rect x="8" y="33" width="3" height="1" fill="#2b7a28" />
          <rect x="11" y="33" width="3" height="1" fill="#2b7a28" />
        </g>

        <!-- braço + maçarico (vibra ao soldar) -->
        <g>
          <rect x="13" y="24" width="6" height="2" fill="#6fcf5b" />
          <rect x="18" y="24" width="2" height="2" fill="#444851" />
          <rect x="20" y="24" width="3" height="1" fill="#8b8f99" />
          <animateTransform attributeName="transform" type="translate"
            values="0 0; 0 -0.7; 0 0.3; 0 0" dur="0.22s" repeatCount="indefinite" />
        </g>

        <!-- solda (faísca piscando) -->
        <g>
          <rect x="21" y="21" width="1" height="5" fill="#ffe27a" />
          <rect x="19" y="23" width="5" height="1" fill="#ffe27a" />
          <rect x="21" y="22" width="3" height="3" fill="#ffffff" />
          <animate attributeName="opacity" values="1;0.15;1;0.4;1" dur="0.24s" repeatCount="indefinite" />
        </g>

        <!-- fagulhas subindo -->
        <rect x="22" y="22" width="1" height="1" fill="#ffd24d">
          <animate attributeName="y" values="22;16" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="0.6s" repeatCount="indefinite" />
        </rect>
        <rect x="24" y="23" width="1" height="1" fill="#ff8a1a">
          <animate attributeName="y" values="23;18" dur="0.5s" begin="0.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="0.5s" begin="0.2s" repeatCount="indefinite" />
        </rect>
      </svg>
    </div>

    <div ref="crawl" class="intro-crawl">
      <div ref="inner" class="intro-crawl-inner">
        <p>Num planeta pequeno e desconhecido, perdido no fim do universo, vivia um ET sonhador.</p>
        <p>Ele tinha ouvido falar de um planeta distante chamado Terra — o mais bonito de toda a galáxia.</p>
        <p>Desde então, seu maior sonho era um só: chegar à Lua da Terra e, lá do alto, contemplar a melhor vista que existe.</p>
        <p>Mas o caminho até as estrelas é traiçoeiro. Asteroides, meteoros e o combustível escasso separam o herói do seu destino.</p>
        <p>Ligue os motores. A jornada começa agora.</p>
      </div>
    </div>

    <p class="intro-hint">segure qualquer tecla para acelerar</p>
    <button class="intro-skip" @click="finish">Pular ⏭</button>
  </div>
</template>

<style scoped>
.intro {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #04040a;
  perspective: 420px;
  perspective-origin: 50% 50%;
  user-select: none;
}

.intro-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 20% 110%, rgba(120, 90, 220, 0.28), transparent 60%),
    radial-gradient(90% 60% at 90% 0%, rgba(60, 140, 210, 0.22), transparent 55%),
    linear-gradient(180deg, #05040c 0%, #150f28 55%, #0a0716 100%);
}

.intro-stars {
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
  animation: intro-twinkle 3.5s ease-in-out infinite;
}
@keyframes intro-twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.intro-moon {
  position: absolute;
  top: 26px;
  right: 34px;
  width: 58px;
  height: 58px;
  filter: drop-shadow(0 0 14px rgba(246, 243, 232, 0.45));
}
.intro-moon svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* ET consertando o foguete */
.intro-scene {
  position: absolute;
  left: 14px;
  bottom: 10px;
  width: 150px;
  height: 150px;
  filter: drop-shadow(0 0 10px rgba(255, 210, 90, 0.25));
}
.intro-scene svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* crawl em perspectiva */
.intro-crawl {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  transform-origin: 50% 50%;
  transform: rotateX(42deg);
  -webkit-mask-image: linear-gradient(180deg, transparent 4%, #000 32%, #000 68%, transparent 96%);
  mask-image: linear-gradient(180deg, transparent 4%, #000 32%, #000 68%, transparent 96%);
}
.intro-crawl-inner {
  width: 68%;
  text-align: center;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(160, 190, 255, 0.5);
  will-change: transform;
}
.intro-crawl-inner p {
  margin: 0 0 22px;
  font-family: 'VT323', monospace;
  font-size: 1.35rem;
  line-height: 1.3;
}

.intro-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  margin: 0;
  text-align: center;
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.55);
  pointer-events: none;
}

.intro-skip {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 8px 14px;
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  color: #fff;
  background: rgba(20, 15, 32, 0.7);
  border: 1px solid rgba(155, 123, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  z-index: 2;
}
.intro-skip:hover { background: rgba(155, 123, 255, 0.3); }
</style>
