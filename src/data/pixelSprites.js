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
  // pessoas (minigame da abdução)
  s: '#e8b48c',       // pele
  n: '#3a2418',       // cabelo / contorno escuro / chuteira
  j: '#3a7bff',       // azul do Japão
  J: '#1f4fd0',       // azul do Japão (sombra)
  p: '#8e44ad',       // vestido roxo da Vó Baiana
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
