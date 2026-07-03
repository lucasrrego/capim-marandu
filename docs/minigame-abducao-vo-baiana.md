# Plano — Minigame "Abdução da Vó Baiana" (Brasil × Japão)

> Documento de acompanhamento. Nenhum código escrito ainda — este é o plano aprovado
> para implementação posterior.

## Premissa & tom

Minigame cômico saindo do percurso principal do Gugu. Referência a um acontecimento
**real e viral** da Copa 2026: a vidente **"Vó Bahiana"** (Anatércia da Silva
Gonçalves) viralizou aos prantos dizendo ter sonhado — mais de uma vez — que uma
**nave alienígena** desceria num jogo do Brasil e **abduziria os jogadores** e ~700
torcedores do estádio. Aqui remixamos para **Brasil × Japão**, e o sonho vira o
minijogo: **você é o ET** pilotando a nave que baixa a garra pra abduzir os jogadores.
Encaixa na ficção do jogo (Gugu é um ET verdinho). Ver
[docs/character-gugu.md](character-gugu.md) para o tom.

**Fontes da pesquisa** (falas reais que embasam o texto da cutscene):
- [CNN Brasil — Vidente "Vó Bahiana" prevê abdução](https://www.cnnbrasil.com.br/pop/celebridades/vidente-conhecida-como-vo-bahiana-viraliza-ao-prever-abducao-de-neymar/)
- [Metrópoles — Vidente que previu ETs faz nova profecia](https://www.metropoles.com/viralizou/vidente-ets-brasil-sabotado)
- [Metrópoles — Teoria de abdução viraliza](https://www.metropoles.com/brasil/teoria-de-vidente-sobre-abducao-no-jogo-da-selecao-viraliza-na-web)
- [Gazeta Web — Vidente aos prantos](https://www.gazetaweb.com/copa-do-mundo/vidente-surge-aos-prantos-ao-relatar-nova-previsao-sobre-partida-entre-brasil-e-escocia-907564)

Falas reais colhidas (para dar veracidade ao texto): ela aparece **em lágrimas**;
diz ter tido **"o sonho mais de uma vez"**; descreve uma nave que desce no campo,
**"mais de 100 aliens que levaram todos os jogadores"**, **"mais de 700 pessoas do
estádio"**, e depois **"a nave mãe, muito maior"**; reclama que **"estou tentando
alertar e ninguém está levando a sério"** e que **"algo muito ruim está para
acontecer nesse campo de futebol"**.

---

## Decisões (confirmadas com o usuário)

1. **Fim da rodada:** tempo fixo de **30 segundos** abduzindo o máximo possível.
2. **Controle:** manual — jogador move a nave na horizontal e dispara a garra.
3. **Roteamento:** o minigame é atribuído a um **warp aleatório** a cada partida
   (um dos 5 segmentos vira a abdução; os outros seguem no placeholder). **Além
   disso**, um **botão na tela inicial** leva direto pro minigame (acesso rápido /
   teste).
4. **Texto da vó:** baseado nas falas reais pesquisadas (abaixo).

---

## Onde pluga (roteamento)

Estado atual: `activeMinigame` carrega só `{ segment, color }`, e todos os warps caem
em [MinigameScreen.vue](../src/components/MinigameScreen.vue) (placeholder).

Mudanças em [RiverRaid.vue](../src/components/RiverRaid.vue):

- Em `newState()`, sortear **`abductionSegment = 1..5`** e guardar no state — é o warp
  que vira a abdução naquela partida.
- Em `enterMinigame(warp)`, definir `activeMinigame.game = warp.segment === abductionSegment ? 'abduction' : 'placeholder'`.
- No template (`v-else-if="phase === 'minigame'"`), escolher o componente pelo
  `activeMinigame.game`: `AbductionGame` ou `MinigameScreen`.
- Novo handler para o evento `@earn(n)` → chama `addCoins(n)` (mantém o contrato de
  moedas e o `localStorage` centralizados no RiverRaid, como já é hoje).
- **Acesso direto:** um método tipo `openAbduction()` que seta
  `activeMinigame = { game: 'abduction', segment: <o sorteado>, color: '#37e0a0' }` e
  `phase = 'minigame'`, sem precisar colidir com o warp.

Em [StartScreen.vue](../src/components/StartScreen.vue):

- Segundo botão abaixo do "▶ Bora, Gugu!", ex.: **"🛸 Sonho da Vó Baiana"**, que
  arma o áudio, toca `playConfirm()` e emite um novo evento `@minigame`.
- RiverRaid escuta `@minigame` na `<StartScreen>` → `openAbduction()`.

Contratos de eventos do `AbductionGame.vue`:
- `@earn(n)` — moedas ganhas na rodada (RiverRaid soma).
- `@back` — volta ao percurso (`exitMinigame()`; se veio da tela inicial, decidir se
  volta pra `start` ou entra no jogo — ver Pontos em aberto).

---

## Cutscene (sub-fase interna do componente)

`AbductionGame.vue` terá sub-fases: **`cutscene` → `playing` → `result`**.

**Cutscene** (estilo [IntroScreen.vue](../src/components/IntroScreen.vue): overlay,
céu estrelado, fonte VT323/pixel):
- **Só a Vó Baiana**: sprite pixel novo, **chorando** (lágrimas animadas descendo,
  sobrancelhas caídas, boca de choro). Turbante/lenço pra dar a cara baiana.
- **Um balãozinho de fala** (SVG/CSS com bico apontando pra ela). Texto baseado nas
  falas reais, em tom cômico, adaptado pra Brasil × Japão (rascunho, ajustável):

  > *"Eu sonhei, minha gente... sonhei mais de uma vez!*
  > *Os ET desceram no jogo do Brasil com o Japão e levaram os jogador tudo pra nave!*
  > *Foram mais de 700 pessoa pra nave mãe... e ninguém tá me levando a sério!*
  > *Alguma coisa muito ruim vai acontecer nesse campo!"*

  (Pode ser exibido em 2–3 balões sequenciais, já que um balão real comporta pouco
  texto. Botão "▶ Continuar" avança; se for texto longo, quebrar em cliques.)
- Botão **"Pular ⏭"** vai direto pra `playing`.

---

## O minigame (fase `playing`)

**Mecânica (garra tipo "claw machine"):**
- **Nave** no topo, movida pelo jogador na horizontal (← → e botões touch já
  existentes no RiverRaid; o componente registra seus próprios listeners, como faz a
  IntroScreen).
- **Baixar a garra** (Espaço / ↓ / botão 🔥): desce **devagar** (dificuldade central),
  agarra o primeiro jogador tocado e **recolhe subindo**; ao chegar no topo, credita
  as moedas daquele jogador. Se chegar ao chão sem pegar, recolhe vazia.
- **Jogadores no chão** andando de um lado a outro, quicando nas bordas:
  - **Amarelos = Brasil**, **azuis = Japão**.
  - Cada um com **velocidade** e **recompensa** próprias. **Mais rápido = mais
    moedas** (recompensa atrelada à velocidade).
  - **1 craque especial do Brasil** vale **~10 moedas** e tem a habilidade de **se
    jogar no chão de repente** (deita/abaixa por alguns instantes) fazendo a garra
    "passar por cima" e errar. Cooldown, duração e chance calibráveis.
- **Cronômetro de 30s** visível. Ao zerar → `result` com total de moedas → botão
  "Voltar" (`@back`) e emite `@earn(total)`.

---

## Calibração fácil (bloco `TUNING`)

Todas as velocidades/recompensas num **único objeto comentado no topo** do
`AbductionGame.vue`. Recalibrar o jogo = mexer só aqui. Forma proposta (ilustrativa):

```js
const TUNING = {
  claw: {
    descendSpeed: 90,    // px/s — quão devagar a garra desce (dificuldade principal)
    ascendSpeed: 220,    // px/s — velocidade de recolhimento
    moveSpeed: 200,      // px/s — deslocamento horizontal da nave
    width: 22,           // largura da hitbox da garra
  },
  round: { durationS: 30 },              // duração da rodada
  // A recompensa de cada jogador é proporcional à sua velocidade sorteada:
  // coins = round(speed * coinsPerSpeed). Mais rápido = mais moedas.
  players: {
    brazil:  { color: '#ffd24d', speedRange: [40, 120], coinsPerSpeed: 0.05, count: 4 },
    japan:   { color: '#3a7bff', speedRange: [40, 120], coinsPerSpeed: 0.05, count: 4 },
    special: { color: '#ffd24d', speed: 90, coins: 10,  // o craque do Brasil
               dodgeChance: 0.6,        // prob. de esquivar quando a garra se aproxima
               dodgeDurationS: 0.8,     // tempo deitado no chão
               dodgeCooldownS: 2.5 },   // intervalo mínimo entre esquivas
  },
}
```

---

## Sprites & áudio novos

- [pixelSprites.js](../src/data/pixelSprites.js): adicionar `VO_BAIANA` (chorando),
  `PLAYER_BR` / `PLAYER_JP` (bonequinhos camisa amarela/azul), `PLAYER_BR_STAR`
  (o craque), e a **nave + garra** (sprite ou desenho por primitivas — decidir na
  implementação). Reusa a `PALETTE`; adicionar uma cor **azul do Japão** (`#3a7bff`).
- [sfx.js](../src/audio/sfx.js): reusar `playBlip` para "garra descendo", "abduziu!"
  (arpejo subindo) e "esquiva" (whoosh). Procedural, sem arquivos de áudio.

---

## Arquivos

**Novos**
- `src/components/AbductionGame.vue` — cutscene + minigame + result, com o `TUNING`.
- `docs/minigame-abducao-vo-baiana.md` — este plano.

**Modificados**
- `src/components/RiverRaid.vue` — sorteio do warp da abdução, roteamento por
  `game`, `@earn` → `addCoins`, `openAbduction()`, escutar `@minigame` da StartScreen.
- `src/components/StartScreen.vue` — botão "🛸 Sonho da Vó Baiana" + emit `@minigame`.
- `src/data/pixelSprites.js` — sprites da vó/jogadores/craque/nave (+ azul do Japão).
- `src/audio/sfx.js` — (opcional) helpers de SFX do minigame.

---

## Pontos em aberto (não bloqueiam; decidir na implementação)

- **Volta do acesso direto:** ao terminar o minigame aberto pela tela inicial, voltar
  pra `start` (mais previsível) em vez de cair no `playing`.
- **Texto da vó:** rascunho acima; ajustar sotaque/piada e quebra em balões.
- **Nave: sprite vs. primitivas** — definir no código conforme ficar mais nítido.

---

## Verificação (quando implementar)

- `npm run dev`: pela tela inicial, botão "Sonho da Vó Baiana" abre a cutscene.
- Cutscene: vó em pixel art chorando + balão com o texto; "Pular" e "Continuar" ok.
- Minigame: nave move, garra desce devagar, abduz jogador e credita moedas; craque
  do Brasil vale ~10 e às vezes se joga no chão pra escapar; cronômetro de 30s.
- Ao fim: tela de resultado com total; "Voltar" credita moedas no HUD (🪙) e retorna.
- No percurso normal: um warp aleatório abre a abdução; os outros seguem no placeholder.
- Calibração: mudar `TUNING.claw.descendSpeed` / `players.*.speedRange` muda o jogo.
- `npm run build` sem erros; nada quebrado no console.
</content>
</invoke>
