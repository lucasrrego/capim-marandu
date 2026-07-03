# Pouso na Lua — Guia de Dificuldade e Tuning 🌙

Como configurar a dificuldade do minigame de pouso e o que cada valor faz no comportamento da aeronave.

Todos os parâmetros ficam no topo de **`src/components/MoonLanding.vue`**, no bloco `// ---- Física / ritmo (tunáveis) ----`. São constantes puras — mude o número, salve, o hot reload aplica na hora. Nenhuma outra parte do código precisa mudar.

---

## Como o pouso funciona (modelo mental)

A cada frame, a aeronave tem uma **velocidade de descida** (`vy`, em unidades/segundo, positivo = descendo). O jogo faz três coisas:

1. **Gravidade** empurra `vy` pra cima (acelera a queda). Ela **aumenta conforme a nave desce** — simula o peso puxando mais forte perto do solo.
2. **Freio** (segurar ↑/Espaço) reduz `vy`, gastando combustível.
3. **Mergulho** (segurar ↓) aumenta `vy`, de graça.

A altitude cai proporcional a `vy`. Ao tocar o chão (`alt = 0`), o jogo compara `vy` com a **faixa verde segura**:

- `vy` **dentro** da faixa → pouso bem-sucedido (ganha moedas).
- `vy` **fora** (rápido demais ou subindo demais) → explode.

A faixa verde **encolhe conforme a nave desce**, então perto do chão a margem de erro é menor.

O objetivo do jogador: chegar ao chão com `vy` dentro de uma faixa que fica cada vez mais estreita, gerenciando combustível.

---

## Parâmetros e o que cada um faz

| Constante | Valor atual | O que controla | Aumentar → | Diminuir → |
|-----------|-------------|----------------|------------|------------|
| `START_ALT` | `500` | Altitude inicial (duração da descida) | Descida mais longa, mais tempo pra frear | Descida curta, menos tempo pra reagir |
| `START_VY` | `55` | Velocidade de descida inicial | Começa mais rápido, precisa frear mais cedo | Começa devagar (pode ficar fácil demais) |
| `GRAVITY_BASE` | `16` | Aceleração da queda no **topo** da descida | Cai mais rápido desde o início | Descida mais lenta e controlável |
| `GRAVITY_RAMP` | `30` | Quanto a gravidade **cresce** até o chão (peso) | Fica muito mais difícil segurar a velocidade perto do solo | Dificuldade mais constante do começo ao fim |
| `BRAKE` | `55` | Força do freio ao segurar ↑ (por segundo) | Freia mais fácil/rápido | Freio fraco, exige começar a frear cedo |
| `BRAKE_BONUS` | `45` | Freio **extra** quando segura no ritmo (na batida) | Recompensa maior por acertar o ritmo | Ritmo importa menos |
| `DIVE_RATE` | `60` | Aceleração ao segurar ↓ | Mergulho mais agressivo | Mergulho mais suave |
| `FUEL_RATE` | `15` | Combustível gasto por segundo enquanto freia | Combustível acaba rápido, exige eficiência | Freio quase ilimitado (fácil) |
| `FUEL_MAX` | `100` | Combustível total | Mais margem de freio | Menos margem, gestão apertada |
| `VY_MIN` | `-20` | Velocidade máxima de **subida** (over-freio) | Permite subir mais ao frear demais | Trava a subida |
| `VY_METER` | `120` | Topo da escala do medidor de velocidade | Marcador se move menos (parece mais lento) | Marcador se move mais (parece mais sensível) |
| `BEAT_MS` | `760` | Período da batida do ritmo (ms entre batidas) | Batidas mais espaçadas (ritmo lento) | Batidas mais rápidas (ritmo apertado) |
| `BEAT_WIN` | `0.16` | Janela de acerto do ritmo (fração do ciclo) | Mais fácil acertar a batida | Exige precisão no ritmo |

> `VY_MIN`/`VY_METER` são só limites/escala visual — não mudam a "dificuldade real", mudam a sensação e o alcance do controle.

---

## A faixa verde (`safeBand`)

```js
function safeBand(prog) {
  const lo = 2
  const hi = 96 + (40 - 96) * prog
  return { lo, hi }
}
```

`prog` vai de `0` (topo, `alt = START_ALT`) a `1` (chão, `alt = 0`).

- `lo` (piso da faixa) fixo em `2` → não pode chegar praticamente parado/subindo.
- `hi` (teto da faixa) interpola de `96` no topo até `40` no chão.

Ou seja, no ar quase qualquer velocidade serve; **no toque final a velocidade precisa estar entre `2` e `40`**.

**Para deixar o pouso mais fácil:** aumente o `40` (teto no chão). Ex.: `96 + (55 - 96) * prog` → aceita até 55 no toque.

**Para deixar mais difícil:** diminua o `40`. Ex.: `96 + (25 - 96) * prog` → precisa tocar bem devagar (≤ 25).

**Para exigir precisão nos dois lados** (não pode nem rápido nem parado demais): suba o `lo`, ex. `const lo = 10 + 8 * prog`.

---

## Receitas de dificuldade

Ajuste combinado dos valores. Pontos de partida:

### Fácil (tutorial / primeira fase)
```js
const START_VY = 40
const GRAVITY_BASE = 12
const GRAVITY_RAMP = 18
const BRAKE = 65
const FUEL_RATE = 10
// safeBand hi no chão: 96 + (55 - 96) * prog
```
Cai devagar, freia fácil, sobra combustível, faixa larga no chão.

### Médio (atual)
Valores padrão do arquivo.

### Difícil (clímax final)
```js
const START_VY = 70
const GRAVITY_BASE = 20
const GRAVITY_RAMP = 45
const BRAKE = 50
const FUEL_RATE = 20
// safeBand hi no chão: 96 + (28 - 96) * prog
```
Começa rápido, peso puxa forte perto do solo, freio mais fraco, combustível escasso, faixa estreita. Exige frear no ritmo (`BRAKE_BONUS`) pra economizar.

---

## Dicas de balanceamento

- **Combustível vs. descida:** garanta que `FUEL_MAX / FUEL_RATE` (segundos de freio disponível) seja menor que o tempo total de descida. Senão dá pra segurar ↑ o tempo todo e o combustível vira irrelevante. Com os valores atuais: `100 / 15 ≈ 6,6 s` de freio, contra ~10–12 s de descida — obriga a escolher quando frear.
- **Freio tem que vencer a gravidade no fim:** perto do chão a gravidade é `GRAVITY_BASE + GRAVITY_RAMP` (`≈ 46/s`). O freio (`BRAKE + BRAKE_BONUS ≈ 100/s` no ritmo) precisa superar isso, senão é impossível pousar. Se aumentar `GRAVITY_RAMP`, aumente `BRAKE` junto.
- **Recompensa:** o bônus de moedas está em `touchdown()` (`const coins = 15`). Para premiar dificuldade, dá pra escalar com a velocidade do toque (quanto mais devagar, mais moedas).
- **Sempre teste no `yarn dev`** — o "feel" do ritmo e do freio só se avalia jogando.
