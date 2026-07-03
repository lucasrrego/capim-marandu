// Engine de sprites pixel art — fundação reutilizável.
// Um sprite é um array de strings; cada caractere = 1 pixel, mapeado por PALETTE.
// '.' (ou espaço) = transparente. Desenho snapado em inteiros, sem antialias.
//
// A PALETTE aqui é a fonte única de verdade das cores dos sprites — os mesmos
// valores estão espelhados como CSS vars (--px-*) em src/style.css.

export const PALETTE = {
  '.': null,          // transparente
  ' ': null,          // transparente (conveniência)
  // Gugu (verdes)
  g: '#6fcf5b',       // verde claro (corpo)
  G: '#3fa03a',       // verde médio (sombra)
  d: '#2b7a28',       // verde escuro (contorno / pés)
  // rosto
  k: '#12131a',       // olhos / boca aberta
  w: '#f4f4f4',       // brilho do olho / highlight
  r: '#d0392e',       // boca / lábios
  h: '#ff6ea8',       // coração (deslumbre)
  // acentos
  y: '#ffd24d',       // ponta da antena / faísca / camisa do Brasil
  o: '#ff8a1a',       // laranja
  b: '#6cc6ff',       // azul (vidro / lágrima)
  W: '#d5f0ff',       // azul claro
  // metal / neutros
  a: '#b8bcc8',       // cinza metálico (= --px-gray)
  // pessoas (minigame da abdução)
  s: '#e8b48c',       // pele
  n: '#3a2418',       // cabelo / contorno escuro / chuteira
  j: '#3a7bff',       // azul do Japão
  J: '#1f4fd0',       // azul do Japão (sombra)
  p: '#8e44ad',       // vestido roxo da Vó Baiana
  L: '#e6c15f',       // cabelo loiro
}

/** Desenha um sprite (array de strings) no contexto 2D. */
export function drawSprite(ctx, x, y, rows, scale = 1, palette = PALETTE) {
  ctx.imageSmoothingEnabled = false
  const ox = Math.round(x)
  const oy = Math.round(y)
  const s = Math.max(1, Math.round(scale))
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const color = palette[row[c]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + c * s, oy + r * s, s, s)
    }
  }
}

/** Dimensões em pixels de tela de um sprite dado um scale. */
export function spriteSize(rows, scale = 1) {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const s = Math.max(1, Math.round(scale))
  return { w: cols * s, h: rows.length * s }
}

// ---- Gugu ---------------------------------------------------------------
// ET verdinho: antena, cabeça grande, olhos enormes, corpinho e perninhas.
// Grade 16 de largura. Três frames reaproveitáveis (start, intro, Rodada 2).

export const GUGU = {
  // parado, olhando pra frente com um sorrisinho
  idle: [
    '.......yy.......',
    '.......dd.......',
    '....dddddddd....',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dgkkggkkgd...',
    '...dgwkggwkgd...',
    '...dgkkggkkgd...',
    '...dgggrrgggd...',
    '...dggggggggd...',
    '......dggd......',
    '...dggggggggd...',
    '..gdggggggggdg..',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dgg....ggd...',
    '...ddd....ddd...',
  ],
  // deslumbrado: olhos viram corações e a boca cai aberta
  dazzled: [
    '.......yy.......',
    '.......dd.......',
    '....dddddddd....',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dghhgghhgd...',
    '...dghhgghhgd...',
    '...dghhgghhgd...',
    '...dggrkkrggd...',
    '...dggggggggd...',
    '......dggd......',
    '...dggggggggd...',
    '..gdggggggggdg..',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dgg....ggd...',
    '...ddd....ddd...',
  ],
  // comemorando: braços pra cima e sorrisão
  thumbsUp: [
    '.......yy.......',
    '.......dd.......',
    '.g..dddddddd..g.',
    '.d.dggggggggd.d.',
    '.d.dggggggggd.d.',
    '...dgkkggkkgd...',
    '...dgwkggwkgd...',
    '...dgkkggkkgd...',
    '...dgrrrrrrgd...',
    '...dggggggggd...',
    '......dggd......',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dggggggggd...',
    '...dgg....ggd...',
    '...ddd....ddd...',
  ],
}

// ---- ET Bilu (pai do Gugu — memória distante na cut scene final) --------
// O lendário pensador: mesmo molde do Gugu, mas com sobrancelha marcada e
// barba branca de sábio. Desenhado bem transparente, como uma lembrança.

export const ET_BILU = [
  '.......yy.......',
  '.......dd.......',
  '....dddddddd....',
  '...dggggggggd...',
  '...dgGGGGGGgd...',
  '...dgkkggkkgd...',
  '...dggwggwggd...',
  '...dggggggggd...',
  '...dgwwwwwwgd...',
  '...dgwwwwwwgd...',
  '......dwwd......',
  '...dggggggggd...',
  '..gdggggggggdg..',
  '...dggggggggd...',
  '...dggggggggd...',
  '...dgg....ggd...',
  '...ddd....ddd...',
]

// ---- Guardinha da Lua (cut scene final) ---------------------------------
// Fiscal do estacionamento lunar: quepe azul com pala, óculos escuros,
// distintivo dourado, luvas brancas e coturno. Grade 16 (igual ao Gugu),
// pra ficar lado a lado nas cenas de diálogo.

export const GUARD = {
  // parado, cara de poucos amigos (boca reta/emburrada)
  idle: [
    '....jjjjjjjj....',
    '...jjjjjjjjjj...',
    '...JJJJJJJJJJ...',
    '....ssssssss....',
    '...skkkkkkkks...',
    '...ssssssssss...',
    '...sssrrrrsss...',
    '....ssssssss....',
    '...jjjjjjjjjj...',
    '..wjjjjyyjjjjw..',
    '..wjjjjjjjjjjw..',
    '...jjjjjjjjjj...',
    '...jjjjjjjjjj...',
    '...nnnnnnnnnn...',
    '...jjjj..jjjj...',
    '...jjjj..jjjj...',
    '...nnnn..nnnn...',
  ],
}

// ---- Objetos voadores (inimigos) ----------------------------------------
// Mesmo padrão dos sprites do Gugu: string-map, 1 char = 1 pixel.

// Sonda/satélite da NASA: corpo central + painéis solares + antena. 15x8.
export const SATELLITE = [
  '.......y.......',
  '.......a.......',
  'kkkk.aaaaa.kkkk',
  'kbWk.awwwa.kWbk',
  'kbbkawrrrwakbbk',
  'kWbk.awbwa.kbWk',
  'kkkk.aaaaa.kkkk',
  '......aya......',
]

// Tralha espacial: sucata metálica com faixa de perigo e rebites. 10x9.
export const SPACE_JUNK = [
  '..kkkkk...',
  '.kaaaaak..',
  'kaawwaaak.',
  'kayyyyyak.',
  'kakkkkkak.',
  'kaaaaaaakk',
  '.kaoaaoak.',
  '.kkaaaakk.',
  '...kkkk...',
]

// ---- Logos de marcas (pixel art) para os outdoors da Lua ----------------
// Cada logo tem sua própria paleta e um bg opcional (fundo do painel).

// Starbucks: emblema verde com estrela branca
const _STARBUCKS = [
  '....GGGGG....',
  '..GGGGGGGGG..',
  '.GGGGGGGGGGG.',
  'GGGGGGwGGGGGG',
  'GGGGGwwwGGGGG',
  'GGGwwwwwwwGGG',
  'GGGGwwwwwGGGG',
  'GGGGwwGwwGGGG',
  'GGGwwGGGwwGGG',
  'GGGGGGGGGGGGG',
  '.GGGGGGGGGGG.',
  '..GGGGGGGGG..',
  '....GGGGG....',
]

// D&G: monograma preto em painel branco
const _D = ['kkkk.', 'k..k.', 'k..k.', 'k..k.', 'k..k.', 'k..k.', 'kkkk.']
const _AMP = ['.kk..', 'k..k.', 'k.k..', '.k...', 'k.k.k', 'k..k.', '.kk.k']
const _G2 = ['.kkkk', 'k....', 'k....', 'k.kkk', 'k...k', 'k...k', '.kkkk']
const _DG = _D.map((d, i) => `${d}.${_AMP[i]}.${_G2[i]}`)

// Capim: "C" verde-limão em fundo roxo
const _CAPIM = [
  '...ccccc...',
  '..ccccccc..',
  '.ccc...ccc.',
  '.ccc.......',
  'ccc........',
  'ccc........',
  'ccc........',
  'ccc........',
  'ccc........',
  '.ccc.......',
  '.ccc...ccc.',
  '..ccccccc..',
  '...ccccc...',
]

export const LOGOS = {
  starbucks: {
    bg: null,
    palette: { '.': null, G: '#1e6b3f', w: '#f4f4f4' },
    rows: _STARBUCKS,
  },
  dg: {
    bg: '#f4f4f4',
    palette: { '.': null, k: '#0a0713' },
    rows: _DG,
  },
  capim: {
    bg: '#2b1a63',
    palette: { '.': null, c: '#b6e04a' },
    rows: _CAPIM,
  },
}

/** Desenha um logo centralizado e escalado dentro de uma caixa. */
export function drawLogo(ctx, name, x, y, boxW, boxH) {
  const lg = LOGOS[name]
  if (!lg) return
  const cols = lg.rows.reduce((m, r) => Math.max(m, r.length), 0)
  const rowsN = lg.rows.length
  const scale = Math.max(1, Math.floor(Math.min((boxW - 4) / cols, (boxH - 4) / rowsN)))
  const w = cols * scale
  const h = rowsN * scale
  drawSprite(ctx, x + (boxW - w) / 2, y + (boxH - h) / 2, lg.rows, scale, lg.palette)
}

// ---- Minigame "Abdução da Vó Baiana" (Brasil × Japão) -------------------
// Jogadores de futebol: mesmo molde, muda camisa/calção. Grade 10 de largura.

// Jogador do Brasil — camisa amarela (y), calção azul (j). Grade 8 (fininho).
export const PLAYER_BR = [
  '..nnnn..',
  '.nssssn.',
  '.ssssss.',
  '.skssks.',
  '.ssssss.',
  '.yyyyyy.',
  'yyyyyyyy',
  'yyyyyyyy',
  '.yyyyyy.',
  '.jjjjjj.',
  '.jj..jj.',
  '.ss..ss.',
  '.ss..ss.',
  '.nn..nn.',
]

// Jogador do Japão — camisa azul (j), calção branco (w). Grade 8 (fininho).
export const PLAYER_JP = [
  '..nnnn..',
  '.nssssn.',
  '.ssssss.',
  '.skssks.',
  '.ssssss.',
  '.jjjjjj.',
  'jjjjjjjj',
  'jjjjjjjj',
  '.jjjjjj.',
  '.wwwwww.',
  '.ww..ww.',
  '.ss..ss.',
  '.ss..ss.',
  '.nn..nn.',
]

// O craque do Brasil (jogador especial, vale mais) — estrela dourada na
// cabeça, faixa e chuteiras douradas pra destacar dos demais. Grade 8.
export const PLAYER_STAR = [
  '...yy...',
  '..nnnn..',
  '.nyyyyn.',
  '.ssssss.',
  '.skssks.',
  '.ssssss.',
  '.yyyyyy.',
  'yyyyyyyy',
  'yyyyyyyy',
  '.yyyyyy.',
  '.jjjjjj.',
  '.jj..jj.',
  '.ss..ss.',
  '.ss..ss.',
  '.yy..yy.',
]

// Vó Baiana chorando — turbante rosa (h), pele (s), lágrimas (b),
// boca aberta chorando (r/k), vestido roxo (p). Grade 16 de largura.
export const VO_BAIANA = [
  '....hhhhhhhh....',
  '..hhhhhhhhhhhh..',
  '..hhwwhhhhwwhh..',
  '..hsssssssssh...',
  '..hssssssssssh..',
  '..ssksssssksss..',
  '..sbssssssssbs..',
  '..sssrrrrsssss..',
  '..sssrkkrsssss..',
  '...ssssssssss...',
  '...pppppppppp...',
  '..pppppppppppp..',
  '.pppppppppppppp.',
  '.pppwwwwwwwwppp.',
  '.pppppppppppppp.',
  '.pp.pppppppp.pp.',
]

// ---- Minigame "Gugu Bros" (plataforma) -----------------------------------

// Alien malvado rastejante (o "goomba" do Gugu Bros): corpo roxo, olhos
// vermelhos furiosos e presas. Grade 12x10, anda no chão e nas plataformas.
export const ALIEN_WALKER = [
  '..p......p..',
  '...p....p...',
  '..pppppppp..',
  '.pppppppppp.',
  '.pkkppppkkp.',
  '.prkpppprkp.',
  '.pppppppppp.',
  '.ppwpwwpwpp.',
  '..pppppppp..',
  '..pp.pp.pp..',
]

// Repórter loira gritando (busto): cabelo loiro (L), pele (s), olhos (k),
// boca aberta (r/k), camisa do Brasil (y) com gola azul (j). Grade 13.
export const BLONDE_WOMAN = [
  '....LLLLL....',
  '..LLLLLLLLL..',
  '.LLLLLLLLLLL.',
  '.LLsssssssLL.',
  '.LLsssssssLL.',
  '.LLsksssksLL.',
  '.LLsssssssLL.',
  '.LLssrrrssLL.',
  '.LLssrkrssLL.',
  '.LLsssssssLL.',
  '.LLLsssssLLL.',
  '.yyyyyyyyyyy.',
  '.yyjjjjjjjyy.',
  '.yyyyyyyyyyy.',
]

// O magnata (busto): topete loiro (L), cara alaranjada (o), terno azul-marinho
// (J), camisa branca (w) e gravata vermelha comprida (r). Grade 15.
export const MAGNATA = [
  '...LLLLLLLLL...',
  '..LLLLLLLLLLL..',
  '.LLLLLLLLLLLLL.',
  '.LLLLLLLLLLLLL.',
  '.LLoooooooooLL.',
  '.LLookoookooLL.',
  '.LLoooooooooLL.',
  '.LLooorrroooLL.',
  '.LLoooooooooLL.',
  '....ooooooo....',
  'JJJJJwwwwwJJJJJ',
  'JJJJJJwrwJJJJJJ',
  'JJJJJJwrwJJJJJJ',
  'JJJJJJwrwJJJJJJ',
  'JJJJJJJrJJJJJJJ',
  '.JJJJJJJJJJJJJ.',
]
