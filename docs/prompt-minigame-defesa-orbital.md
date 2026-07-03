# Prompt: minigame "Defesa Orbital" (rail shooter estilo Time Crisis / Virtua Cop)

> Cole tudo abaixo da linha num chat novo do Claude Code, aberto na raiz deste repo.

---

Crie um novo minigame para o jogo **GUGU — Rumo à Lua** neste repo (Vue 3 + Vite + Canvas 2D puro, sem engine).

## Antes de escrever qualquer código

Leia estes arquivos para absorver os padrões do projeto:

- `src/components/AbductionGame.vue` — **melhor referência**: minigame de ação completo (cutscene → playing → result, canvas, loop, HUD, touch, SFX)
- `src/components/RiverRaid.vue` — orquestrador de todas as telas via `ref` `phase`; é onde o minigame será registrado
- `src/components/MoonLanding.vue` — referência de física/estados
- `src/data/shipParts.js`, `src/data/achievements.js`, `src/data/pixelSprites.js`, `src/data/saves.js`
- `src/audio/sfx.js` — SFX procedurais (Web Audio)
- `src/style.css` — paleta `--px-*`, fontes `--pixel` (Press Start 2P) e `--retro` (VT323)
- `docs/character-gugu.md`, `docs/game-planning.md` — tom e voz do Gugu

## O minigame

**Nome de trabalho:** Defesa Orbital (pode sugerir nome melhor na voz do jogo).
**Gênero:** rail shooter / light gun estilo **Time Crisis / Virtua Cop**, adaptado para mouse.
**Fantasia:** Gugu se abriga atrás do painel da nave e combate **asteroides** e **satélites malvados** que atacam em ondas.

### Mecânica central (o coração do jogo — acerte isso primeiro)

1. **Mira no mouse.** Crosshair estilo Virtua Cop (círculo verde com marcadores) segue o cursor sobre o canvas. Cursor nativo escondido (`cursor: none`) enquanto joga.
2. **Clique = tiro.** Só atira quando está **exposto** (fora do cover).
3. **Espaço = pedal do Time Crisis:**
   - **Segurando espaço** → Gugu sai do cover: pode atirar, mas fica **vulnerável**.
   - **Soltando espaço** → Gugu se abriga: **invulnerável**, não atira, e a arma **recarrega**.
   - A transição cover ↔ exposto deve ser animada e rápida (~150–250ms) — o painel/console da nave sobe/desce na parte de baixo da tela cobrindo a visão parcialmente, como o cover do Time Crisis.
4. **Munição limitada:** pente de 6 tiros (homenagem ao revólver do Virtua Cop). Zerou = precisa voltar ao cover pra recarregar (recarga automática e rápida no cover, com SFX). Mostrar balas no HUD como ícones.
5. **Dano por projétil com telegraph:** inimigos "carregam" o ataque com aviso visual claro (flash/piscada vermelha crescente por ~1s, no estilo do flash branco do Time Crisis) e então disparam um projétil lento em direção à tela. O jogador tem janela para entrar no cover. Projétil acerta enquanto exposto = perde 1 vida. No cover = projétil quica no painel (feedback visual).
6. **Vidas:** 3 (ícones no HUD, como os escudos do Time Crisis). Zerou = game over do minigame.

### Estrutura: waves progressivas

- **Wave 1** — asteroides: não atiram, só avançam lentamente em direção à tela crescendo de tamanho; se chegam "perto demais" causam 1 de dano e somem. 1 tiro destrói (asteroides grandes podem se partir em 2 pequenos).
- **Wave 2** — satélites malvados: entram pelas laterais, param em posições, fazem telegraph e atiram projéteis. 2 tiros destroem. Misturar alguns asteroides.
- **Wave 3** — mini-chefe: **satélite-mãe** grande com barra de vida, que alterna padrões (rajada de projéteis telegrafados + lança asteroides). Pontos fracos que piscam.
- Dificuldade crescente: mais inimigos simultâneos, telegraphs mais curtos.
- Duração total alvo: **60–90s** (minigames do jogo são curtos).
- Placar de pontos por acerto (bônus por headshot/ponto fraco e por precisão), convertido em **moedas** no resultado.

### Sensação de arcade (importante pro estilo)

- Hit feedback exagerado: hit flash branco no inimigo, partículas na explosão, leve screen shake.
- Números de pontos flutuando no ponto do acerto (estilo Virtua Cop).
- Inimigo prestes a atirar ganha destaque (o telegraph É o jogo).
- Fundo: espaço com estrelas em parallax leve; Terra ou Lua no horizonte (há `drawMoon` em `shipParts.js`).

## Integração no jogo (siga os padrões existentes, não invente novos)

1. **Componente:** `src/components/OrbitalDefense.vue` (ou nome equivalente). Canvas lógico **480×640**, `image-rendering: pixelated`, preenchendo o container (o pai aplica a classe `.rr-hangar`). Loop com `requestAnimationFrame`, `dt` clampado em `0.05`, estado do jogo em objeto mutável fora da reatividade, HUD com `ref`. Cleanup completo em `onUnmounted` (RAF + listeners).
2. **Props:** `segment` (Number), `color` (String), `loadout` (Object). Use o `loadout` para algum bônus leve (ex.: arma `rapid` instalada = pente de 8; `plasma` = tiro atravessa 2 inimigos) via `buildShipStats(loadout)` de `shipParts.js`.
3. **Emits:** `earn` (número de moedas, ao fim), `back` (sair). Recompensa é **sempre em moedas** — minigames não concedem peças diretamente.
4. **Registro no `RiverRaid.vue`:** importar o componente e trocar o ternário do `<component :is>` (bloco `phase === 'minigame'`) por um mapa `{ abduction: AbductionGame, orbital: OrbitalDefense, placeholder: MinigameScreen }[activeMinigame.game]`. Em `enterMinigame(warp)`, sortear um segundo segmento (diferente de `state.abductionSegment`) para este minigame, seguindo o padrão do `abductionSegment` em `newState`.
5. **Acesso dev:** botão na `StartScreen.vue` visível só com `:dev` (análogo ao "🛸 Sonho da Vó Baiana"), com emit próprio e handler no pai análogo a `openAbduction` (setar `minigameFromStart = true`).
6. **SFX:** use `src/audio/sfx.js` — `resume()` no primeiro gesto, `playShot()`, `playExplosion()`, `playSelect/playConfirm` nos menus, e crie SFX novos com `playBlip({ notes, type, gain, dur })` para: recarga, telegraph do inimigo, projétil quicando no cover, dano no Gugu. Siga o estilo procedural existente.
7. **Sprites:** pixel art no formato de `pixelSprites.js` (array de strings + `PALETTE`, desenhado com `drawSprite`). Já existem `SATELLITE` e `SPACE_JUNK` — reaproveite/derive. Crie variação "malvada" do satélite (olho vermelho, antenas agressivas). Asteroides podem ser desenhados proceduralmente no canvas.
8. **Fluxo interno:** `sub = ref('cutscene' | 'playing' | 'result')` como no AbductionGame — cutscene curta (2–3 falas do Gugu explicando pedal e mira), gameplay, tela de resultado com pontos → moedas e botão voltar.
9. **Touch/mobile:** mira segue o dedo (`pointermove`), toque no canvas atira, e um botão grande "PEDAL" (`@pointerdown`/`@pointerup`, padrão `.ab-touch`) faz o papel do espaço. Esconder em desktop com `@media (hover: hover) and (pointer: fine)`.
10. **Conquistas (adicione 2):** em `src/data/achievements.js` + `unlock` chamado via handler no pai (padrão do `onAbduct`), ex.:
    - `orbital-defender` — completou a Defesa Orbital.
    - `sharpshooter` — terminou uma wave com 100% de precisão (ou derrubou o chefe sem levar dano — escolha a mais viável).
11. **Estilo:** `<style scoped>` com prefixo próprio (ex.: `.od-*`), paleta `--px-*`, fontes `--pixel`/`--retro`, botões no padrão "3D" (borda escura + box-shadow que afunda no `:active`).
12. **Textos:** PT-BR coloquial na voz do Gugu — deslumbrado, simpático, sem sarcasmo, frases curtas ("Segura o espaço pra encarar eles, solta pra se esconder!").

## Ordem de trabalho sugerida

1. Ler os arquivos de referência.
2. Componente isolado com mecânica core (mira + pedal + cover + recarga + 1 inimigo) acessível pelo botão dev.
3. Waves + telegraph + chefe.
4. Tuning num bloco `const TUNING = {...}` no topo (padrão do AbductionGame).
5. Integração (warp, moedas, conquistas), SFX, polish (partículas, shake, cutscene).
6. Rodar `yarn dev` e testar o fluxo completo: dev button → jogar → resultado → moedas creditadas → conquista no hangar.

Trabalhe numa branch nova (ex.: `feat/minigame-defesa-orbital`). Commits pequenos por etapa.
