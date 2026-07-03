	# Minigames — Foguete pra Lua 🚀

> Cada minigame usa uma **mecânica diferente** → variedade = jogo mais atrativo.
> River Raid = hub. Entra no evento → minigame → bônus → melhora a nave → Lua.
> Escopo: game jam 1 dia · web · Kaplay (cada minigame = 1 `scene`).

---

## Tabela geral

| # | Minigame | Mecânica | Inspiração | Bônus |
|---|----------|----------|------------|-------|
| 1 | Ignição da turbina | Button mash | MP Pedal Power | + combustível / boost inicial |
| 2 | Coleta de sucata | Coletar em área | MP Grab Bag / Mushroom Mix-up | + peças (asa/corpo/bico/motor) |
| 3 | Abdução alien | Mira / shoot | MP Piranha's Pursuit | + moeda |
| 4 | Cinturão de asteroides | Dodge / survival | MP Bombs Away | + escudo |
| 5 | Sequência de lançamento | Timing / memória | MP Bowser's Big Blast | + moeda (alto risco) |
| 6 | Painel de controle | Memória / sequência | MP Memory Match | + reparo / vida |
| 7 | Sincronia do motor | Rhythm | MP Rhythm 'n' Bruise | + eficiência combustível |
| 8 | Estação espacial | Plataforma 2D | MP Platform Peril | + chave / bônus |
| 9 | Hangar | Montagem / drag & drop | inventory craft | stats + aparência |
| 10 | Loja pirata | Trade / economia | shop | equipamento |
| 11 | Buraco de minhoca | Reflexo / QTE | quick-time event | atalho de fase |

---

## Detalhe por minigame

### 1. Ignição da turbina — *button mash*
Mash rápido pra encher a barra de empuxo antes do lançamento. Mais aperta, mais boost.
- **Input:** 1 botão (spam)
- **Duração:** ~10s
- **Bônus:** combustível / boost inicial
- **Complexidade:** trivial · bom pra abrir o jogo e ensinar input

### 2. Coleta de sucata — *coletar em área*
Peças flutuam no espaço. Pega o máximo em tempo limitado movendo a nave.
- **Input:** setas / mouse
- **Duração:** ~20s
- **Bônus:** peças (asa, corpo, bico, motor) → alimenta o Hangar
- **Complexidade:** baixa · liga direto na progressão

### 3. Abdução alien — *mira / shoot*
ET suga NPCs pra cima. Você mira e atira pra salvar / derrubar o disco.
- **Input:** mouse (mira) + clique
- **Duração:** ~30s
- **Bônus:** moeda
- **Complexidade:** média · é o "gênero de ação"

### 4. Cinturão de asteroides — *dodge / survival*
Sobrevive X segundos desviando de rochas que vêm de todo lado.
- **Input:** setas
- **Duração:** ~20s (sobreviver)
- **Bônus:** escudo
- **Complexidade:** baixa

### 5. Sequência de lançamento — *timing / memória*
Aperta botões na ordem certa dentro do tempo. Erra = explode.
- **Input:** teclas em sequência
- **Duração:** ~15s
- **Bônus:** moeda (alto risco / alta recompensa)
- **Complexidade:** baixa

### 6. Painel de controle — *memória / sequência*
Luzes piscam em sequência (Simon). Repete a ordem.
- **Input:** clique nos botões
- **Duração:** escalável
- **Bônus:** reparo / vida
- **Complexidade:** baixa

### 7. Sincronia do motor — *rhythm*
Aperta no ritmo certo pra não superaquecer o motor.
- **Input:** 1 botão no tempo
- **Duração:** ~20s
- **Bônus:** eficiência de combustível
- **Complexidade:** média

### 8. Estação espacial — *plataforma 2D*
Pula plataformas até pegar o item no topo.
- **Input:** setas + pulo
- **Duração:** ~30s
- **Bônus:** chave / bônus
- **Complexidade:** média

### 9. Hangar — *montagem / drag & drop*
Arrasta peças pra montar a nave: asa, corpo, bico, turbina/motor.
- **Input:** mouse (drag)
- **Duração:** livre
- **Bônus:** stats da nave + aparência
- **Complexidade:** média · coração da progressão
- **Efeito das peças:**
  - asa → manobrabilidade / hitbox lateral
  - corpo → vida / resistência
  - bico → passar em espaços apertados
  - turbina/motor → velocidade / empuxo

### 10. Loja pirata — *trade / economia*
Negocia moeda por equipamento / upgrades.
- **Input:** clique
- **Duração:** livre
- **Bônus:** equipamento
- **Complexidade:** baixa

### 11. Buraco de minhoca — *reflexo / QTE*
Aperta a tecla certa no instante certo pra atravessar.
- **Input:** tecla no timing
- **Duração:** ~5s
- **Bônus:** atalho de fase
- **Complexidade:** trivial

---

## Mecânicas cobertas (variedade)

`button mash` · `coletar em área` · `mira/shoot` · `dodge/survival` · `timing/memória` · `memória/sequência` · `rhythm` · `plataforma` · `drag & drop` · `trade` · `QTE`

---

## Recomendação MVP (1 dia)

Pega 3 mecânicas distintas que alimentam a economia:

1. **Ignição da turbina** (mash) — abre o jogo, ensina input, trivial de codar
2. **Coleta de sucata** (grab) — vira o Hangar prático, liga na progressão
3. **Abdução alien** (mira) — o gênero de ação

3 mecânicas distintas · todas trivial/baixa · todas → economia → nave → Lua.
Resto = roadmap no pitch.
