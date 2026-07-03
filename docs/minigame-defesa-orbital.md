# Minigame — Defesa Orbital 🛰️

> Rail shooter / light gun estilo **Time Crisis / Virtua Cop**, adaptado pra mouse.
> Gugu se abriga atrás do painel da nave e defende o foguete de um cinturão de asteroides.
> Componente: `src/components/OrbitalDefense.vue` · id: `orbital`

---

## Conceito

Referência direta aos arcades de pistola dos anos 90:

- **Virtua Cop** → crosshair verde com marcadores, hit instantâneo (hit scan), números de pontos flutuando no acerto.
- **Time Crisis** → o **pedal**: um único botão alterna entre *cover* (abrigado, invulnerável, recarrega) e *exposto* (atira, vulnerável). O jogo inteiro é o ritmo atira–esconde–recarrega.

Na fantasia do GUGU: a caminho da Lua a nave cruza um cinturão de asteroides. O painel de controle sobe e desce como o cover do Time Crisis; o Gugu aparece atrás dele quando exposto.

## Controles

| Input | Ação |
|-------|------|
| Mouse | Mira (crosshair; cursor nativo escondido durante o jogo) |
| Clique | Tiro — só funciona exposto |
| **Segurar ESPAÇO** | Sai do cover: pode atirar, fica vulnerável |
| **Soltar ESPAÇO** | Volta pro cover: invulnerável, recarrega |
| Touch (mobile) | Mira/tiro no dedo + botão **PEDAL** virtual (segurar/soltar) |

A transição cover ↔ exposto leva ~180ms e é animada (painel desliza).

## Mecânica

### Pedal e cover
- `cover` interno vai de 0 (exposto) a 1 (abrigado); pedal define o alvo e o valor desliza.
- Atira só com `cover ≤ 0.35` (quase todo exposto).
- Impacto de asteroide com `cover > 0.5` = **quica no painel** (partículas + shake leve, sem dano); abaixo disso = **−1 vida** (flash vermelho + shake forte).

### Munição e recarga
- Pente de **6 balas** (ícones no HUD). Sem munição = clique seco.
- Recarga **automática no cover**: começa assim que o muro passa da metade da descida (`cover > 0.55`) e leva **0.4s**. Expor no meio **cancela** (recomeça na próxima descida).
- Crosshair fica cinza quando não pode atirar (abrigado, recarregando ou sem bala).

### Asteroides (wave única)
- **5 asteroides base**, spawn a cada 1.5s → 0.85s (acelera ao longo da wave).
- Cada um "se aproxima da tela": escala cresce de 0.22 → 1.75 durante 6.5s → 4.2s até o impacto.
- **Telegraph de impacto**: nos últimos ~22% da aproximação, contorno vermelho piscando — janela pra entrar no cover.
- Asteroide com raio base > 24 **parte em 2 fragmentos** ao ser destruído (menores, chegam 18% mais rápido, valem mais). Total efetivo: **~11 alvos**.
- Impactado (não destruído) **não** parte — só some causando dano/thunk.

### Vidas, pontos e moedas
- **3 vidas** (ícones 🛡 no HUD). Zerou = derrota.
- Asteroide inteiro = **100 pts** · fragmento = **150 pts**.
- Fim de rodada: `moedas = score / 50` — vitória guarda tudo, derrota guarda **metade** (`lossKeep: 0.5`).
- Vitória = destruir/sobreviver aos 5 asteroides + fragmentos. Derrota **não** encerra a corrida do hub — só reduz a recompensa.

### Perks do loadout (arma instalada no hangar)
| Arma | Efeito |
|------|--------|
| Canhão (padrão) | Pente de 6 |
| Metralhadora (`rapid`) | Pente de **9** |
| Plasma | Tiro **atravessa 2 alvos** |

Via `buildShipStats(props.loadout)` — mesmo mecanismo dos outros minigames.

## Calibração

Tudo num bloco `TUNING` no topo do componente (padrão do AbductionGame):

```js
const TUNING = {
  pedal: { speed: 5.5, fireBelow: 0.35, safeAbove: 0.5 },
  gun: { clip: 6, reloadS: 0.4 },
  lives: 3,
  coins: { perScore: 50, lossKeep: 0.5 },
  wave1: {
    count: 5,
    spawnEvery: [1.5, 0.85],   // intervalo: início → fim da wave
    approachS: [6.5, 4.2],     // tempo até o impacto: início → fim
    radius: [20, 30],
    points: 100, pointsSmall: 150,
    splitR: 24,
  },
}
```

Dificuldade: mexa primeiro em `approachS` (tempo de reação) e `spawnEvery` (pressão simultânea).

## Integração no jogo

### Fluxo interno
`sub: 'cutscene' → 'playing' → 'result'` — cutscene de 3 falas do Gugu ensinando o pedal (com Pular), gameplay, tela de resultado com pontos → moedas.

### Contrato de minigame (padrão do repo)
- **Props:** `segment` (Number), `color` (String, cor do warp), `loadout` (Object).
- **Emits:** `earn` (moedas ao finalizar) e `back` (sair). Recompensa sempre em **moedas** — peças vêm do hangar.

### Pontos de acoplamento no `RiverRaid.vue`
- `MINIGAME_VIEWS = { abduction, orbital, mario }` + computed `minigameView` — mapa que substitui o antigo ternário do `<component :is>`.
- `pickMinigameSegments()` embaralha 1..5 e sorteia **3 warps distintos** por corrida (abdução, orbital, Gugu Bros); os 2 restantes ficam placeholder. Devolve as mesmas chaves que já existiam (`abductionSegment`, `marioSegment`) + `orbitalSegment`, então nada externo muda.
- `enterMinigame(warp)` mapeia `orbitalSegment → 'orbital'`.
- `launchMinigame('orbital')` → entrada **🛰️ Defesa Orbital** no `MinigamesMenu` (modo avulso: moedas direto no banco, volta pro menu).
- Na corrida: moedas via `earn` entram em `runCoins` (sujeitas ao settle no fim); `back` retoma a corrida com 2s de invulnerabilidade (comportamento herdado do hub).

## Arquitetura interna

Mesmo esqueleto dos outros minigames:

- Canvas lógico **480×640**, `image-rendering: pixelated`, preenchendo `.rr-stage`.
- Loop `requestAnimationFrame` com `dt` clampado em 0.05s; estado do jogo em objeto mutável fora da reatividade (`game`); HUD com `ref`.
- Mira mapeada de coordenadas de tela pra lógicas via `getBoundingClientRect` (funciona com o canvas esticado pelo CSS).
- Hit test: distância mira→asteroide ≤ raio×escala + 8px; entre sobrepostos, acerta o **mais próximo do impacto** (maior ameaça).
- SFX 100% procedurais de `sfx.js`: `playShot`/`playExplosion` reaproveitados; recarga, clique seco, dano e thunk criados com `playBlip`.
- Visual: Terra no fundo (o sonho do Gugu), estrelas cintilando, painel com faixa de perigo/rebites/telinhas de osciloscópio, Gugu (sprite `GUGU.idle`) aparecendo atrás do painel quando exposto.
- Cleanup completo em `onUnmounted` (RAF + listeners de teclado).

## Histórico de decisões (desenvolvimento)

1. **Pedal = segurar** (não toggle) — fiel ao Time Crisis; soltar em pânico é o reflexo natural de defesa.
2. **Telegraph visual antes do dano** — núcleo do gênero: o jogador sempre vê o perigo com tempo de reagir.
3. **Escopo reduzido na revisão**: plano original tinha 3 waves (asteroides → satélites atiradores → chefe satélite-mãe); cortado pra **wave única sobrevivível** priorizando o plug no hub.
4. **Recarga 0.8s → 0.4s** e início antecipado — feedback de playtest: o ciclo ficava lento.
5. **10 → 5 asteroides base** (~22 → ~11 alvos) — pra rodada ser finalizável dentro da duração padrão dos minigames (~15–20s).
6. **Merges preventivos**: branch absorveu `feat/minigame-gugu-bros` (#20) e depois a main (menu de mini-games público, boss, cutscenes) — conflitos concentrados nos pontos de integração previstos (mapa de componentes, sorteio de warps, StartScreen/menu).

## Roadmap (se sobrar tempo)

- Wave 2: satélites malvados que **atiram projéteis telegrafados** (o cover vira defesa ativa, não só contra impacto).
- Chefe satélite-mãe com barra de vida e pontos fracos.
- Conquistas: completar a Defesa Orbital / rodada com 100% de precisão (contadores `shots`/`hits` já existem no estado).
- Combo/multiplicador por acertos sem errar.
