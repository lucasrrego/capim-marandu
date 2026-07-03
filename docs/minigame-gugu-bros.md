# Minigame "Gugu Bros" — plataforma estilo Mario 🍄🧻

> Documento de referência para trabalhar neste minigame **sem precisar ler o código
> inteiro**. Cobre história, arquitetura, cada parte configurável e receitas de
> alteração. Arquivo principal: [`src/components/MarioGame.vue`](../src/components/MarioGame.vue).

---

## Premissa & tom

A caminho da Lua, o Gugu sente **aquele aperto** e precisa ir ao banheiro. Pouso de
emergência num planetinha! A turbulência espalhou os rolos de papel higiênico pela
fase. Missão ("número 2"): **coletar todos os rolos → usar o banheiro → subir de
volta pra nave pela escada**.

- Dinâmica de **Super Mario Bros** (pulo variável, pisar em inimigo mata), mas com
  o elenco do jogo: Gugu, aliens rastejantes, satélite malvado e o **Neymar caído**
  (mesmo craque do minigame da Vó Baiana).
- Todo texto segue a voz do Gugu — ver [character-gugu.md](character-gugu.md).
  Atenção: **Gugu é um ET** — nunca escrever "os aliens venceram" e afins; usar
  "vilões" para os inimigos em texto visível ao jogador.
- **Tela congelada**: uma tela só (480×640), sem rolagem de câmera. Decisão de
  escopo da game jam; virar fase com scroll é evolução futura.

---

## Fluxo de sub-fases (`sub` ref)

```
cutscene ──▶ playing ──▶ won   (usou o banheiro e embarcou na nave)
   │            └──────▶ over  (perdeu as 3 vidas)
   └ "Pular ⏭" vai direto pro playing
```

| Sub-fase | O que acontece |
|---|---|
| `cutscene` | Gugu apertado (sprite `GUGU.dazzled` se contorcendo) + 4 balões de fala (array `speech`). Enter/botão avança; Pular inicia direto. |
| `playing` | O jogo em si. Dois "modos especiais" dentro dele: `using` (ocupado no banheiro, mundo congela, jogador some) e `boarding` (subida automática pela escada, sem controle e sem dano). |
| `won` | Overlay "UFA! Agora sim! 🚀" + conversão rolos→moedas. Botão chama `finish()`. |
| `over` | Overlay "Foi mal, pai... 💫" (bordão canônico) com Tentar de novo / Voltar. |

`finish()` emite `earn(papel)` (1 rolo = 1 moeda) e depois `back`.

---

## Contrato com o RiverRaid (hub)

Mesmo padrão do minigame da Vó Baiana ([minigame-abducao-vo-baiana.md](minigame-abducao-vo-baiana.md)):

- **Props recebidas:** `segment` (nº do warp), `color` (cor do warp, vira `--accent`
  dos botões), `loadout` (nave montada no hangar — usada pra desenhar a nave
  pairando, via `drawShip` de `shipParts.js`).
- **Eventos emitidos:** `@earn(n)` moedas ganhas · `@back` volta ao hub.
- **Roteamento** (em [`RiverRaid.vue`](../src/components/RiverRaid.vue)):
  - `newState()` sorteia `marioSegment` (1–5) **sempre diferente** do
    `abductionSegment` (sorteia 1–4 e soma +1 se ≥ abdução).
  - `enterMinigame(warp)` roteia: `abduction` → AbductionGame, `mario` → MarioGame,
    resto → placeholder. Mapa `MINIGAMES` (nome → componente) no script — **novo
    minigame = entrada no mapa + caso em `launchMinigame` + item no MinigamesMenu**.
  - **Acesso avulso**: entrada 🍄 "Gugu Bros" no
    [`MinigamesMenu.vue`](../src/components/MinigamesMenu.vue) (`id: 'mario'` →
    `launchMinigame` → `openMario()`). Nesse modo `minigameFromStart = true` →
    ao sair volta pro **menu de mini-games** e moedas vão direto pro banco.
    Veio de warp → volta pra corrida (com `WARP_INVULN` de 2s pra não explodir
    na parede) e moedas entram em `runCoins`.

---

## Calibração — bloco `TUNING` (topo do MarioGame.vue)

Toda a jogabilidade se ajusta **só aqui**:

| Chave | Default | Efeito |
|---|---|---|
| `player.accel` | 2000 | aceleração no chão (px/s²) |
| `player.airAccel` | 1400 | aceleração no ar (menor = menos controle aéreo, mais "Mario") |
| `player.decel` | 2600 | atrito ao soltar a direção |
| `player.maxRun` | 240 | velocidade máxima horizontal (px/s) |
| `player.jumpV` | 760 | impulso do pulo. Altura máx ≈ `jumpV²/(2·gravity)` ≈ 125px |
| `player.jumpCut` | 280 | soltar o botão cedo corta a subida pra até isso (pulo variável) |
| `player.gravity` | 2300 | gravidade (px/s²) |
| `player.maxFall` | 900 | velocidade terminal de queda |
| `player.coyoteS` | 0.09 | segundos pra ainda pular depois de sair da borda |
| `player.bufferS` | 0.12 | segundos que o pulo apertado "cedo demais" fica guardado |
| `player.stompBounce` | 430 | quique ao pisar num inimigo |
| `player.invulnS` | 1.6 | invulnerabilidade (piscando) após levar dano |
| `enemies.alienSpeed` | 55 | velocidade de patrulha dos aliens |
| `enemies.satSpeed` | 1.6 | rad/s da oscilação do satélite |
| `enemies.satRange` | 150 | amplitude horizontal do voo do satélite |
| `bathroomS` | 2.2 | segundos "ocupado" dentro do banheiro |
| `climbSpeed` | 150 | velocidade da subida automática pela escada |
| `lives` | 3 | vidas por tentativa |

> ⚠️ Ao mudar `jumpV`/`gravity`, confira se as plataformas continuam alcançáveis:
> os degraus atuais têm 80–104px de subida, contra ~125px de alcance do pulo.

---

## Layout da fase (constantes logo abaixo do TUNING)

Tudo em coordenadas do canvas 480×640 (origem no topo-esquerdo):

- **`SOLIDS`** — retângulos sólidos (colisão nos 4 lados). O primeiro é o chão
  (`ground: true`, desenhado como grama+terra); os demais são plataformas de tijolo
  roxo. **Adicionar plataforma = adicionar `{x, y, w, h}` aqui** — colisão e desenho
  são automáticos.
- **`makePapers()`** — lista `spots` de `[x, y]` dos rolos de papel. `PAPER_TOTAL`
  deriva do tamanho da lista; HUD e condição do banheiro se ajustam sozinhos.
- **`BATH`** — cabine do banheiro `{x: 236, y: 248, w: 42, h: 48}`, apoiada na
  plataforma do topo (y+h = 296 = topo da plataforma). Sem colisão física; é um
  gatilho por sobreposição.
- **`SHIP`** — nave pairando `{cx, cy, w, h}`, sempre visível, balança com seno.
  Desenhada com o `drawShip` do hangar (respeita o loadout do jogador).
- **`LADDER`** — `{x: SHIP.cx, top, bottom: 296}`. Escada de corda desenhada só
  depois de `used`; a zona de embarque é uma coluna de 24px em volta de `x`.
- **`NEY`** — retângulo do Neymar caído (sprite `PLAYER_STAR` rotacionado 90°).
  Chegar a menos de 70px do centro dele dispara o balão "AI AI AI..." por 2s.
- **`SPAWN`** — onde o Gugu nasce e renasce após dano.
- **`makeEnemies()`** — lista inicial:
  - `kind: 'alien'`: patrulha entre `minX`/`maxX` (o da plataforma do topo tem
    `maxX` limitado pra não atravessar o banheiro).
  - `kind: 'sat'`: voa em seno ao redor de `cx` na altura `y`.
  - **Adicionar inimigo terrestre = novo objeto `alien`** com posição e limites.

---

## Regras de jogo (função `update`)

1. **Ordem dos modos especiais:** `boarding` e `using` retornam cedo — congelam
   inimigos e ignoram input/dano. Qualquer mecânica nova deve entrar **depois**
   desses guards se precisar do mundo rodando.
2. **Stomp:** conta como pisão se `vy > 0` e a sobreposição vertical for menor que
   60% da altura do inimigo. Senão, dano.
3. **Dano:** com invulnerabilidade ativa, ignora. Senão perde vida e **renasce no
   `SPAWN`** piscando; 0 vidas → `over`.
4. **Banheiro:** tocar a cabine com `papel < PAPER_TOTAL` mostra "FALTA PAPEL! x/y"
   (1.6s, com throttle). Com todos os rolos → `using = bathroomS`, jogador some,
   porta "ocupada" com `...` animado. Ao terminar: `used = true` + `playSuccess()`.
5. **Escada:** com `used`, tocar a coluna da escada inicia `boarding` — o Gugu é
   puxado pro eixo da escada e sobe a `climbSpeed` até a nave → `won`.

---

## Sprites & desenho

| Coisa | Fonte | Onde mexer |
|---|---|---|
| Gugu | `GUGU.idle` (chão) / `GUGU.thumbsUp` (ar/escada), scale 2, flip horizontal por `face` | [`pixelSprites.js`](../src/data/pixelSprites.js) |
| Alien rastejante | `ALIEN_WALKER` (roxo, olhos vermelhos), scale 3 | idem |
| Satélite | `SATELLITE` (mesmo do percurso) + olhinho vermelho piscando desenhado por cima | idem |
| Neymar | `PLAYER_STAR` rotacionado 90° (`ctx.rotate`) | `drawNeymar()` |
| Nave | `drawShip` de [`shipParts.js`](../src/data/shipParts.js) com `props.loadout` | `drawShipAndLadder()` |
| Rolo de papel | primitivas canvas (círculo branco + furo + pontinha) | `drawPaper()` |
| Banheiro | primitivas (cabine de madeira, telhado, porta com lua crescente; brilha dourado quando pronto) | `drawBathroom()` |
| Cenário | gradiente + estrelas procedurais (posições determinísticas por índice) | `drawBackground()` |

Ordem de desenho (z-order) está em `draw()`: fundo → sólidos → banheiro → rolos →
Neymar → inimigos → nave/escada → jogador.

---

## Áudio (tudo procedural, `src/audio/sfx.js`)

| Evento | Som |
|---|---|
| Pulo | `playBlip({notes: [300, 480, 640]})` (arpejo subindo) |
| Rolo coletado | `playSparkle()` |
| Stomp | `playDodge()` |
| Dano | `playExplosion(0.8)` |
| Entrar no banheiro | `playBlip` com notas descendo (triangle) |
| Banheiro concluído / vitória | `playSuccess()` |

Lembrete: áudio só toca após gesto do usuário — todo trigger chama `resume()` antes.

---

## Textos (pra revisar/traduzir sem caçar no código)

- **Cutscene:** array `speech` no script (4 falas).
- **HUD:** contador `🧻 x/y` + linha de ajuda `mb-help`.
- **Balões in-game:** `'AI AI AI...'` (Neymar, em `drawNeymar`) e
  `'FALTA PAPEL! x/y'` (em `drawBathroom`).
- **Vitória:** overlay `won` no template ("UFA! Agora sim! 🚀").
- **Game over:** overlay `over` — usa os bordões canônicos ("Foi mal, pai...",
  "Respira, Gugu"). Título no estilo dourado do "Rumo à Lua" (classe `.mb-over h2`).

---

## Controles

- **Teclado:** ← →/A D anda · Espaço/↑/W pula (segurar = pulo maior) · Enter avança
  a cutscene.
- **Touch:** botões ◀ ▶ ⬆ (aparecem só em telas sem mouse, media query no CSS).
- Handlers próprios do componente (`window.addEventListener` em `onMounted`,
  removidos em `onUnmounted`) — não dependem dos controles do RiverRaid.

---

## Receitas rápidas

- **Dificuldade geral:** `TUNING.enemies.*` (velocidades) e `TUNING.lives`.
- **Pulo mais "pesado":** ↑ `gravity` e ↑ `jumpV` juntos (manter razão ≈ alcance).
- **Mais/menos rolos:** editar `spots` em `makePapers()` — resto se ajusta.
- **Mover o banheiro:** mudar `BATH` (manter `y+h` = topo de um sólido) e, se for
  pra plataforma do alien, ajustar o `maxX` dele.
- **Recompensa:** hoje 1 rolo = 1 moeda (`finish()` emite `papel.value`); pra bônus
  fixo, mudar ali.
- **Trocar qual warp abre o jogo:** sorteio em `newState()` no RiverRaid
  (`marioSegment`).
- **Virar fase com rolagem:** hoje `SOLIDS`/spawns são fixos numa tela; precisaria
  de câmera (offset de desenho) + level mais largo — nada no update assume `W`
  além dos clamps de borda.

---

## Histórico de desenvolvimento (como este minigame nasceu)

Registro das decisões, na ordem — útil pra entender *por que* o código é assim:

1. **v1 — tela congelada de teste.** Pedido original: "plágio de Super Mario com o
   Gugu", primeiro numa tela estática só pra validar a jogabilidade. Nasceram a
   física (pulo variável + coyote + buffer), o stomp, o sprite `ALIEN_WALKER`, o
   satélite reaproveitado e o Neymar caído (sprite `PLAYER_STAR` rotacionado 90°).
   Coletáveis eram **moedas** genéricas.
2. **Ajustes de história/UI.** "Os aliens venceram" contradizia a ficção (Gugu É um
   ET) → game over reescrito com os bordões canônicos de
   [character-gugu.md](character-gugu.md) ("Foi mal, pai...", "Respira, Gugu"),
   título no estilo dourado do "Rumo à Lua".
3. **Plug no percurso.** Warp sorteado (`marioSegment`) no mesmo esquema do
   `abductionSegment`, garantindo warps distintos; ternário de roteamento virou o
   mapa `MINIGAMES`.
4. **v2 — contexto narrativo (estado atual).** Missão do banheiro: cutscene
   introdutória no padrão do AbductionGame, moedas viraram **rolos de papel**,
   banheiro na plataforma do topo, nave sempre visível e escada de embarque como
   condição de vitória. Modos `using`/`boarding` entraram como early-returns no
   `update` pra congelar o mundo com segurança.
5. **Merge com o menu de mini-games.** A main ganhou `MinigamesMenu` + boss battle;
   o botão dev da tela inicial foi substituído pela entrada 🍄 no menu, e o retorno
   avulso passou a ser pro menu (comportamento herdado de `leaveMinigame`).

Decisões de design que valem lembrar:

- **Tela única sem câmera** foi escolha consciente (escopo de game jam), não
  limitação — o `update` não assume nada além dos clamps de borda em `W`.
- **Inimigos congelam** durante `using`/`boarding` (early return) — simples e lê-se
  como "momento de respiro", igual Mario tocando a bandeira.
- **`PAPER_TOTAL` deriva da lista** de spots — impossível dessincronizar HUD,
  aviso do banheiro e condição de entrada.
- **Recompensa 1 rolo = 1 moeda** mantém o contrato `earn` idêntico ao dos outros
  minigames; o RiverRaid decide o destino (banco vs corrida).

---

## Verificação manual

1. `yarn dev` → tela inicial → **🎮 Mini-games** → **🍄 Gugu Bros**: cutscene com
   4 falas, Pular funciona, Enter avança.
2. Pulo variável (toque curto vs segurado), coyote/buffer perceptíveis.
3. Pisar mata alien e satélite; encostar do lado perde vida e renasce piscando;
   3 danos → "Foi mal, pai...".
4. Banheiro sem rolos → aviso; com 9/9 → brilha, entra, `...`, escada desce.
5. Tocar a escada → sobe sozinho → "UFA!" → voltar credita moedas e retorna pro
   lugar certo (menu de mini-games → banco; warp → corrida + moedas da corrida).
6. Numa corrida, um warp abre o Gugu Bros e outro a Vó Baiana (nunca o mesmo).
7. `npx vite build` sem erros.
