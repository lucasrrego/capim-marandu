# Plano — Estética pixel art + personagem Gugu (Fatia Vertical / Rodada 1)
## Context
O jogo (`capim-marandu`, um "River Raid" espacial em Vue 3 + Vite + Canvas 2D) tem
uma **intro cinemática** já em pixel art de verdade (SVG `crispEdges`, fonte VT323,
chiptune via Web Audio) — mas o **resto do jogo não segue esse estilo**: o canvas de
gameplay, o hangar e o minigame usam render vetorial suave (arcs, gradientes,
`roundRect`, `shadowBlur`) e fontes genéricas. Os textos são neutros e o título ainda
é "River Raid" (marca da Atari).
O usuário quer: (1) unificar tudo na estética **pixel art** da intro; (2) criar
**artes e efeitos sonoros** (podendo derivar da musiquinha da intro); (3) dar um
**tom cômico** ao jogo em torno de um **ET engenheiro-genial mas sonhador e
atrapalhado**; (4) **revisar os textos**, principalmente o da tela inicial.
**Decisões do usuário:**
- **Protagonista: Gugu** — filho do lendário pensador e intelectual alienígena **ET Bilu**.
  ET Bilu **visitou a Terra** há muito tempo, virou fã do apresentador *Gugu* (o de
  terno brilhante) e **voltou pro seu planeta** com histórias maravilhadas da Terra —
  e batizou o filho de Gugu em homenagem. O pequeno Gugu cresceu ouvindo essas
  histórias, e daí vem seu fascínio pela Terra. Genial de engenharia (monta foguetes
  desde filhote), mas se vislumbra (fica de queixo caído) com qualquer novidade.
- **Título: "GUGU — Rumo à Lua"** (título com o nome do ET; frase ajustável).
- **Escopo: fatia vertical primeiro.** Rodada 1 estabelece personagem + fundação de
  render pixel art + tela inicial + intro + fonte/HUD pixelados + SFX base.
  Gameplay / hangar / minigame ficam para a Rodada 2.
**Resultado pretendido da Rodada 1:** ao abrir o jogo, o jogador vê uma tela inicial
em pixel art com o Gugu, título e textos cômicos, com trilha e blips de menu; ao
clicar Jogar, entra na intro (mesmo estilo, texto reescrito com o backstory). Tudo
sobre uma **engine de sprite pixel reutilizável** que a Rodada 2 usará no gameplay.
---
## Character & Tone Bible (novo: `docs/character-gugu.md`)
Documento curto que ancora todos os textos futuros. Conteúdo:
- **Quem é Gugu:** filho do ET Bilu; engenheiro genial (monta foguetes desde
  filhote) com alma de sonhador/pensador herdada do pai; se deslumbra fácil.
- **Quem é ET Bilu (pai):** lendário pensador e intelectual do planeta; o único que
  já **viajou à Terra e voltou**. As histórias que trouxe viraram lenda em casa.
- **Origem do fascínio:** na visita à Terra, ET Bilu ficou fã de um apresentador de
  terno brilhante que ria e dava prêmios — e batizou o filho em homenagem. Gugu
  cresceu ouvindo essas histórias e sonhando com a Terra. Referência afetuosa ao
  "Gugu" **sem nomear pessoa real** (usar "o apresentador de terno brilhante"),
  evitando questões de imagem. Ponto de decisão registrado no doc caso o usuário
  prefira nomear.
- **Voz/tom:** frases curtas, exclamações de deslumbre ("Que máquina!", "Olha
  aquilo!"), contraste entre jargão de engenheiro e ingenuidade infantil. Humor
  pelo contraste (gênio + atrapalhado), nunca sarcasmo.
- **Glossário de bordões** reutilizáveis nas telas (ex.: "Bora, Gugu!", "Foi mal,
  pai" no game over).
---
## Fundação de render pixel art
### 1. Fonte pixel (`index.html`)
Adicionar **"Press Start 2P"** (Google Fonts) para títulos/HUD, mantendo **VT323**
para corpo de texto corrido (crawl/parágrafos). Já existe o padrão de `<link>` de
fontes no `index.html:7-16`.
### 2. Paleta + vars (`src/style.css`)
Definir no `:root` uma **paleta limitada coesa (~16 cores)** como CSS vars
(espaço: roxos/azuis; Gugu: verdes; foguete: vermelhos; combustível/faíscas:
amarelos; UI) e uma var `--pixel: 'Press Start 2P', monospace`. Espelhar as mesmas
cores como constantes JS na engine de sprites (fonte única de verdade da paleta).
### 3. Engine de sprites (novo: `src/data/pixelSprites.js`)
O coração reutilizável — usado já na tela inicial/intro e depois no gameplay:
- `PALETTE` — mapa `char → cor` (ex.: `g`=verde Gugu, `.`=transparente).
- `drawSprite(ctx, x, y, rows, scale, palette=PALETTE)` — desenha um sprite a partir
  de um array de strings (cada char = 1 pixel), snapando em inteiros e com
  `ctx.imageSmoothingEnabled = false`. Sem dependências.
- **Sprites do Gugu** como dados (string-maps), frames: `idle`, `dazzled`
  (olhos-coração/boca aberta), `thumbsUp`. Reaproveitáveis em start, intro e Rodada 2.
Isso é a "fundação de render pixel art" pedida: um caminho único e testado para
sprites chunky, que a Rodada 2 aplica em nave/inimigos (`drawShip` e os desenhos de
inimigos em `RiverRaid.vue`).
---
## Áudio / SFX base (novo: `src/audio/sfx.js`)
Extrair a lógica de Web Audio que hoje vive dentro de `IntroScreen.vue:48-112`
(`audioCtx`, `midiToFreq`, `LEAD`/`BASS`, `startMusic`/`stopMusic`) para um módulo
compartilhado, procedural e **sem arquivos de áudio** (mantém o padrão atual):
- `getCtx()` — singleton de `AudioContext`.
- `playSelect()` / `playConfirm()` — blips de menu (square, curto; confirm = arpejo
  de 2 notas subindo).
- `playSparkle()` — jingle de "deslumbre" do Gugu (usado ao abrir a tela inicial).
- `startTheme()` / `stopTheme()` — reaproveita `LEAD`/`BASS` da intro como **trilha
  da tela inicial** (volume menor, em loop).
- `IntroScreen.vue` passa a **consumir esse módulo** (remove a duplicação de música).
Sons de gameplay (tiro, explosão, combustível, warp, dano) ficam **prontos para
plugar na Rodada 2**; o módulo já expõe um `playBlip(opts)` genérico que os cobre.
---
## Telas da Rodada 1
### Tela inicial (novo: `src/components/StartScreen.vue`)
Hoje é um overlay inline em `RiverRaid.vue:768-773`. Extrair para componente próprio
(espelha o padrão de `IntroScreen`/`HangarScreen`), emitindo `@play`:
- Fundo estrelado/nebulosa no mesmo estilo da intro (`intro-sky`/`intro-stars`).
- **Gugu em pixel art** (via `drawSprite` num `<canvas>` pequeno) em pose `dazzled`,
  olhando pra uma Lua/TV.
- Título **"GUGU"** grande + subtítulo **"Rumo à Lua"** em Press Start 2P com glow.
- **Texto cômico reescrito** (rascunho, ajustável):
  > *Gugu é o engenheiro mais brilhante do seu planetinha — e o mais distraído. Seu
  > pai, o lendário **ET Bilu**, foi à Terra uma vez e voltou com histórias que Gugu
  > nunca esqueceu. Agora ele quer chegar à **Lua** só pra ver aquele planeta lindo
  > de pertinho.*
  Linha de controles mantida (`← → mover · ↑ ↓ acelerar · Espaço atirar · P pausar`).
- Botão pixel **"▶ Bora, Gugu!"** → toca `playConfirm()` e emite `@play`.
- Ao montar: `playSparkle()` + `startTheme()`.
### Intro (`src/components/IntroScreen.vue`)
- **Reescrever o crawl** (`IntroScreen.vue:242-246`) com o backstory (5 parágrafos):
  o pai ET Bilu que viajou à Terra e voltou; as histórias do apresentador de terno
  brilhante que viraram o nome e o sonho do filho; o deslumbre de Gugu; o sonho da
  Lua; e o fecho "Ligue os motores". Rascunho pronto (ver bíblia).
- **Trocar o ET SVG inline** (`IntroScreen.vue:191-209`) pelo **sprite Gugu
  compartilhado** (consistência com a tela inicial) — mantendo foguete, solda e
  faíscas que já estão ótimos.
- Música passa a vir de `src/audio/sfx.js`.
### HUD + overlays (`src/components/RiverRaid.vue`)
Toque leve (sem mexer no render do canvas de gameplay, que é Rodada 2):
- Título do painel lateral `River Raid` (`RiverRaid.vue:816`) → **"GUGU"** com fonte
  pixel; ajustar `.rr-title`.
- Aplicar `--pixel` nos títulos de overlay e revisar textos de **paused / over / won**
  para a voz do Gugu (ex.: over → *"Foi mal, pai... quase lá."*; won → *"A LUA!
  Gugu conseguiu!"*).
- Substituir o overlay de start inline pelo `<StartScreen @play="playIntro" />`.
---
## Arquivos
**Novos**
- `docs/character-gugu.md` — bíblia de personagem/tom.
- `src/data/pixelSprites.js` — engine de sprite + paleta + sprites do Gugu.
- `src/audio/sfx.js` — módulo Web Audio compartilhado (menu + trilha + genérico).
- `src/components/StartScreen.vue` — nova tela inicial pixel art.
**Modificados**
- `index.html` — `<link>` da fonte Press Start 2P.
- `src/style.css` — paleta em CSS vars + `--pixel`.
- `src/components/IntroScreen.vue` — texto reescrito, sprite Gugu, música via módulo.
- `src/components/RiverRaid.vue` — usar `<StartScreen>`, título HUD "GUGU", textos
  paused/over/won na voz do Gugu, fonte pixel nos overlays.
---
## Fora de escopo (Rodada 2, listado p/ contexto)
- Reescrever `drawShip` (`shipParts.js`) e os desenhos de inimigos
  (`RiverRaid.vue` `draw`) como sprites pixel via a engine nova.
- Pixelar fundo do canvas (estrelas/poeira/nebulosa/canal), warps e explosões.
- Repaginar `HangarScreen.vue` e `MinigameScreen.vue` em pixel art + textos do Gugu.
- Wire dos SFX de gameplay (tiro/explosão/combustível/warp/dano/vitória).
---
## Verificação
- `npm run dev` e abrir no navegador.
- **Tela inicial:** Gugu em pixel art nítido (bordas chunky, sem blur), título/fonte
  pixel, texto cômico, trilha tocando, blip ao focar/clicar o botão.
- **Jogar:** botão toca `playConfirm()` e entra na intro; crawl reescrito rola no
  estilo Star Wars com o sprite do Gugu; música contínua; "Pular" e acelerar (segurar
  tecla) funcionando como antes.
- **HUD/overlays:** painel mostra "GUGU" em fonte pixel; forçar game over e vitória
  (pode reduzir `GOAL_DISTANCE` temporariamente p/ testar) e conferir os textos novos.
- **Regressão:** hangar, minigame e gameplay seguem funcionando (inalterados neste
  round); nenhum erro no console (checar que a extração do áudio não quebrou a intro).
- Rodar `npm run build` para garantir que os novos módulos importam sem erro.