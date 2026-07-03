# Game Planning — Foguete pra Lua 🚀

> Game jam · 1 dia · web · playable-first
> Tese: mostrar velocidade de criar jogo com prompt simples — cada minigame nasce de um prompt e usa uma mecânica diferente.

---

## Conceito

**River Raid = hub.** Foguete voa em side-scroller vertical. Ao longo do trajeto surgem **eventos/portais**. Jogador escolhe:

- **Passar reto** → segue o scroll
- **Entrar no evento** → abre um **minigame** com gênero/mecânica própria

Cada minigame entrega um **bônus** (moeda, peça, boost). Bônus melhoram a nave. Nave melhor → sobrevive mais → chega na **Lua** (objetivo final).

```
[River Raid scroll] --evento--> [Minigame] --bônus--> [volta pro scroll]
                    \--skip------------------------------/

Loop de progressão:
minigame → moeda/peça → hangar (upgrade) → nave melhor → mais longe → Lua
```

Entrar custa tempo/risco, mas dá recompensa → decisão risco/recompensa constante.

---

## Estrutura técnica (o que viabiliza 1 dia)

- **Stack:** Vue 3 + Vite + Canvas 2D puro (`requestAnimationFrame`). Sem engine de jogo, sem lib extra. Web, hot reload, deploy fácil (GitHub Pages / itch.io / Vercel).
- **Scenes = componentes/fases:** cada minigame é uma fase própria (ex.: `RiverRaid.vue`). Troca de cena controlada por estado no Vue (`ref` de fase). Hub = cena principal.
- **Render:** loop de jogo em `<canvas>` (contexto 2D), estado interno num objeto mutável fora da reatividade; só o HUD usa `ref` reativo.
- **Estado global compartilhado:** moeda + peças + upgrades num objeto único (Vue reactive / módulo compartilhado).
- **Paralelizável:** cada pessoa do time pega 1 fase/componente isolado, merge no fim.

```js
// dentro de um componente .vue (script setup)
const phase = ref('start')   // 'start' | 'playing' | 'paused' | 'over'
const canvas = ref(null)
let ctx = null, raf = 0, state = null
// loop: ctx.clear → update(dt) → draw → requestAnimationFrame

const save = {
  moeda: 0,
  pecas: { asa: 1, corpo: 1, bico: 1, turbina: 1 },
  skin: "default",
}
```

---

## Minigames — cada um, uma mecânica diferente

Variedade de gênero = jogo mais atrativo. Cada evento troca o estilo de jogo.

| Evento | Gênero / Mecânica | O que faz | Bônus |
|--------|-------------------|-----------|-------|
| **Hangar** | Montagem / inventory (drag & drop) | Arrasta peças: asa, corpo, bico, turbina/motor | Stats da nave + aparência |
| **Abdução alien** | Shoot'em up / rhythm | ET suga NPCs, você resgata / atira | Moeda |
| **Cinturão de asteroides** | Dodge / bullet-hell | Desvia de rochas | Boost |
| **Estação espacial** | Plataforma 2D | Pula plataformas, pega item | Bônus / chave |
| **Buraco de minhoca** | Reflexo / QTE | Timing perfeito | Atalho de fase |
| **Chuva de meteoro** | Tower defense mini | Mira e destrói | Escudo |
| **Loja pirata** | Trade / economia | Negocia moeda → equip | Equipamento |

### Detalhe das peças (Hangar)

Montagem afeta a nave no river raid:

- **asa** → manobrabilidade / hitbox lateral
- **corpo** → vida / resistência
- **bico** → passar em espaços apertados
- **turbina/motor** → velocidade / empuxo

---

## Economia (amarra tudo)

`aparência + features/elementos/boost + economia/moeda` = **meta-loop**:

1. Minigames → moeda
2. Moeda → hangar (upgrade peças + skin)
3. Upgrade → sobrevive mais no river raid
4. Mais longe → mais eventos → mais moeda → **Lua**

Sem economia, minigames ficam desconexos. Com ela = progressão real.

---

## Ideias fora da curva (backlog / pós-jam)

- **Fase gerada por prompt ao vivo** — jogador digita palavra → fase spawna ("vulcão" → fase lava). Mostra a tese do game gen ao vivo.
- **Nave montada = hitbox real** — peças escolhidas mudam a física do river raid.
- **Abdução invertida** — numa fase VOCÊ é o ET abduzindo. Troca de protagonista.
- **Controle por voz** — grito = empuxo, silêncio = queda; ou comandos falados. Cada minigame usa um tipo de voz.
- **Co-op 2 vozes / 2 jogadores** — um controla empuxo, outro direção.

---

## Escopo p/ 1 dia (MVP)

Não fazer 7 minigames. Fazer:

1. **River Raid hub** — core, tem que funcionar (scroll + eventos + colisão + game over)
2. **Hangar** — montagem/upgrade (coração da progressão)
3. **1 minigame de ação** — abdução OU dodge (escolher 1)
4. **Economia mínima** — 1 moeda, 1 tela de upgrade
5. **Objetivo Lua** — condição de vitória (altitude/distância)

3 gêneros já impressionam. Resto = roadmap no pitch.

---

## Próximos passos

- [ ] Scaffold Vite + Vue + `<canvas>` + esqueleto de fases + estado global
- [ ] River Raid hub jogável (scroll + eventos + colisão)
- [ ] Hangar (drag & drop peças)
- [ ] 1 minigame de ação
- [ ] Economia + tela upgrade
- [ ] Condição de vitória (Lua)
- [ ] Deploy (itch.io / Vercel)
