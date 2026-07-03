# Como construímos o GUGU — Rumo à Lua

Documentação do nosso processo de desenvolvimento: as decisões, a evolução do jogo
e a forma de trabalho que adotamos. O jogo é um "River Raid" espacial feito em
**Vue 3 + Vite + Canvas 2D**, sem dependências de engine — todo o render e a lógica
foram escritos do zero.

---

## 1. A primeira versão e o plano de evolução

Antes de escrever código, decidimos **qual seria a primeira versão jogável** e como
ela cresceria a partir dali.

- **Ponto de partida:** um clone funcional do *River Raid* — nave que sobe, atira,
  desvia de paredes e inimigos, com scroll vertical contínuo. Simples o suficiente
  para subir rápido e validar a mecânica central.
- **Direção de evolução:** em vez de um jogo único e monolítico, planejamos uma
  base que pudesse ganhar **camadas** — tema visual, economia, história,
  minigames e, no fim, um objetivo narrativo. Cada camada seria um incremento
  independente sobre o núcleo estável.

A ideia-guia: **subir algo jogável cedo e evoluir por incrementos**, nunca segurar
uma entrega grande.

---

## 2. Primeira versão: cópia do River Raid

A primeira entrega foi essencialmente uma **cópia do River Raid** — o mínimo para
ter um jogo de verdade rodando.

- `first commit: Vue app + River Raid game` — o núcleo jogável.
- Logo em seguida, `feat: tema espacial no River Raid` deu a primeira pintura de
  identidade própria por cima do clone.

Nessa fase o foco foi **provar a mecânica**, não polir. Ter algo rodável destravou
todo o resto.

---

## 3. Incrementos: história, mundo e o objetivo de pousar na Lua

Com a base no ar, passamos a **desenhar incrementos** que transformariam o clone em
um jogo com identidade e narrativa própria.

- **Mundo e economia:** hangar (`Start hangar` → `Adds Hangar Scene`), economia de
  moedas (`feat: game-economy`, recompensas por destruir objetos), peças de nave e
  upgrades. O jogo deixou de ser só "voar e atirar" e ganhou progressão.
- **História e personagem:** criamos o **Gugu**, filho do lendário ET Bilu, com um
  tom cômico de engenheiro genial mas sonhador. A bíblia de personagem e tom ficou
  registrada em [character-gugu.md](character-gugu.md), e a estética foi unificada em
  **pixel art** (ver [guias.md](../guias.md)).
- **O objetivo do desafio:** o arco culmina em **pousar na Lua**. Isso deu um norte
  narrativo ao jogo inteiro — a fase final de pouso (`MoonLanding.vue`) já existia
  como destino desde cedo, o que facilitou encaixar tudo depois.

O planejamento dessa fase está em [game-planning.md](game-planning.md).

---

## 4. Minigames: o formato que nos deixou paralelizar

A decisão mais importante de arquitetura de produto foi quebrar o jogo em
**minigames**. Cada minigame é um módulo relativamente isolado (uma tela / um
componente Vue), com sua própria mecânica, arte e áudio.

Isso rendeu duas vantagens grandes:

- **Paralelização do trabalho:** com fronteiras claras entre minigames, várias
  frentes avançavam ao mesmo tempo sem pisar umas nas outras. Cada pessoa (ou
  branch) tocava um minigame.
- **Incremento natural:** adicionar conteúdo virou "adicionar mais um minigame",
  não "mexer no jogo inteiro".

Os minigames e ideias estão catalogados em [mini-games.md](mini-games.md) — por
exemplo a [Abdução da Vó Baiana](minigame-abducao-vo-baiana.md). Os componentes
correspondentes vivem em `src/components/` (`AbductionGame.vue`, `MinigameScreen.vue`,
`MinigamesMenu.vue`, etc.).

---

## 5. Delegação técnica para a IA

Boa parte das **decisões técnicas** e **todo o código** foram feitos pela IA. Nosso
papel foi de **direção de produto e resolução de conflitos**, não de implementação
nem de revisão linha a linha.

- **Não revisamos PRs** no detalhe — confiamos na IA para as escolhas de
  implementação (estrutura de componentes, render em canvas, sistema de áudio,
  economia, save/load).
- A única disciplina que mantivemos no merge foi **garantir que os conflitos
  estivessem resolvidos** antes de integrar cada branch à `main`.
- O histórico reflete esse fluxo: muitos PRs curtos por feature
  (`feat/...`, `boss-01`, `save-slots`, `feat/musicas-e-sfx`, `feat/cut-scenes`)
  mergeados de forma incremental.

> **Nota honesta:** esse modelo priorizou velocidade sobre controle de qualidade
> formal. Funcionou bem no contexto de um jogo experimental; não é o processo que
> recomendaríamos para software crítico.

---

## 6. Incrementos guiados pelos desafios

À medida que **novos desafios surgiam**, o jogo já estava estruturado para
absorvê-los com baixo custo — porque o modo campanha e a fase de pouso já existiam.

- **Boss:** adicionar um chefe foi só encaixar mais uma etapa no modo campanha
  existente (`Adds boss stage` → `Refactor boss` → `balance-boss` →
  `feat: música de boss`). A fase final de pouso já dava o "fim" do arco, então o
  boss entrou como o clímax antes dele.
- **Cutscenes:** o arco narrativo pediu transições — daí `MoonApproach.vue` e
  `FinalCutscene.vue` (`feat: cut scenes de aproximação e chegada na Lua`),
  fechando a história do pouso.
- **Áudio, conquistas e saves:** músicas e SFX (`feat/musicas-e-sfx`), sistema de
  conquistas e de save em slots (`save-slots`, `Adds achievments and save`)
  entraram como camadas sobre a base, sem reescrever o núcleo.

A lição: **por termos investido cedo numa base incrementável (campanha + destino
final), cada novo desafio virou um "adicionar", não um "reconstruir".**

---

## Pontos sugeridos para adicionar (a decidir)

Sugestões de seções que enriqueceriam a documentação, caso você queira:

- **Stack e arquitetura técnica** — por que Vue 3 + Vite + Canvas 2D puro (sem
  engine), como componentes viram "telas" e como o estado flui entre elas.
- **Fluxo de branches e merges** — o padrão de PRs curtos por feature e como a
  resolução de conflitos foi o único gate de qualidade.
- **Estética e identidade** — a virada para pixel art, a fonte VT323, o chiptune via
  Web Audio e a criação do universo do Gugu/ET Bilu (já parcialmente em
  [character-gugu.md](character-gugu.md) e [guias.md](../guias.md)).
- **Balanceamento e tuning** — como ajustamos dificuldade (ver
  [moon-landing-tuning.md](moon-landing-tuning.md) e os commits de rebalance de
  asas/motores e do boss).
- **Aprendizados e o que faríamos diferente** — trade-offs de delegar tudo à IA,
  onde a falta de revisão custou caro (ou não), e o que replicaríamos.
- **Linha do tempo visual** — um diagrama/tabela mapeando commits-marco às fases
  (v1 clone → tema → hangar/economia → minigames → boss → cutscenes/pouso).
- **Créditos e divisão de trabalho** — quem tocou o quê, e como os minigames
  permitiram a divisão.
