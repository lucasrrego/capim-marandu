<script setup>
// Máscara de transição estilo batalha de Pokémon: faixas pretas varrem a tela
// até cobrir tudo (emite 'covered' — hora de trocar a cena por baixo), seguram
// um instante e recuam revelando a nova cena (emite 'done').
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['covered', 'done'])

const STRIPES = 9
const COVER_MS = 620     // varre até cobrir
const HOLD_MS = 160      // segura no preto
const UNCOVER_MS = 560   // recua revelando

const on = ref(false)    // true = faixas expandidas (tela preta)
const flash = ref(false)
let timers = []

onMounted(() => {
  // pisca rápido e começa a cobrir
  flash.value = true
  timers.push(setTimeout(() => (flash.value = false), 120))
  requestAnimationFrame(() => { on.value = true })

  timers.push(setTimeout(() => emit('covered'), COVER_MS))
  timers.push(setTimeout(() => { on.value = false }, COVER_MS + HOLD_MS))
  timers.push(setTimeout(() => emit('done'), COVER_MS + HOLD_MS + UNCOVER_MS))
})

onUnmounted(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="bt" :class="{ on }">
    <div v-if="flash" class="bt-flash"></div>
    <div
      v-for="n in STRIPES"
      :key="n"
      class="bt-stripe"
      :class="n % 2 ? 'from-left' : 'from-right'"
      :style="{ top: ((n - 1) * (100 / STRIPES)) + '%', height: (100 / STRIPES + 0.5) + '%', transitionDelay: ((n - 1) * 45) + 'ms' }"
    ></div>
  </div>
</template>

<style scoped>
.bt {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: all;   /* bloqueia input durante a transição */
  overflow: hidden;
  border-radius: 8px;
}

.bt-flash {
  position: absolute;
  inset: 0;
  background: #fff;
  animation: bt-flash 0.12s linear;
}
@keyframes bt-flash {
  from { opacity: 0.9; }
  to { opacity: 0; }
}

.bt-stripe {
  position: absolute;
  left: 0;
  width: 100%;
  background: #04040a;
  transform: scaleX(0);
  transition: transform 0.42s cubic-bezier(0.5, 0, 0.5, 1);
}
.bt-stripe.from-left { transform-origin: left center; }
.bt-stripe.from-right { transform-origin: right center; }

.bt.on .bt-stripe { transform: scaleX(1); }
</style>
