// Default skeleton set: Basic Latin, Latin-1 Supplement and Latin Extended-A.
//
// Coordinates are design units on a fixed grid: lowercase x-height 500,
// ascender 750, descender -220; capitals and figures 700. The engine remaps
// these zones to the project's vertical metrics, so skeletons never need to be
// redrawn when the x-height changes. See shared/engine/skeleton.js for the
// notation.
//
// case: upper | lower | figure | symbol (capital zones) | punct (lowercase zones)

const comma = (x, y) => `${x},${y}; [attach,w=0.8] ${x},${y} .. ${x - 10},${y - 95} .. ${x - 45},${y - 160}`;

export const BASE = {
  // ---- Capitals ----
  A: ['A', 'upper', '0,0 -- 260,700; 260,700 -- 520,0; [noserif] 85,230 -- 435,230'],
  B: ['B', 'upper', '0,0 -- 0,700; 0,700 -- 250,700 .. 405,530 .. 250,370{180} -- 0,370; 0,370 -- 280,370 .. 445,185 .. 280,0{180} -- 0,0'],
  C: ['C', 'upper', '[ap] 480,580 .. 275,700{180} .. 40,350{-90} .. 275,0{0} .. 480,120'],
  D: ['D', 'upper', '0,0 -- 0,700; 0,700 -- 210,700 .. 470,350{-90} .. 210,0{180} -- 0,0'],
  E: ['E', 'upper', '0,0 -- 0,700; 0,700 -- 400,700; 0,360 -- 370,360; 0,0 -- 410,0'],
  F: ['F', 'upper', '0,0 -- 0,700; 0,700 -- 390,700; 0,350 -- 355,350'],
  G: ['G', 'upper', '[ap] 485,585 .. 280,700{180} .. 40,350{-90} .. 280,0{0} .. 480,110{90} -- 480,320; [noserif] 300,320 -- 480,320'],
  H: ['H', 'upper', '0,0 -- 0,700; 480,0 -- 480,700; [noserif] 0,360 -- 480,360'],
  I: ['I', 'upper', '0,0 -- 0,700'],
  J: ['J', 'upper', '340,700 -- 340,215 .. 180,0{180} .. 15,175'],
  K: ['K', 'upper', '0,0 -- 0,700; 450,700 -- 0,250; 152,405 -- 470,0'],
  L: ['L', 'upper', '0,0 -- 0,700; 0,0 -- 390,0'],
  M: ['M', 'upper', '0,0 -- 0,700; 0,700 -- 300,0; 300,0 -- 600,700; 600,700 -- 600,0'],
  N: ['N', 'upper', '0,0 -- 0,700; 0,700 -- 480,0; 480,0 -- 480,700'],
  O: ['O', 'upper', '285,0 .. 570,350 .. 285,700 .. 0,350 .. cycle'],
  P: ['P', 'upper', '0,0 -- 0,700; 0,700 -- 260,700 .. 440,515 .. 260,330{180} -- 0,330'],
  Q: ['Q', 'upper', '285,0 .. 570,350 .. 285,700 .. 0,350 .. cycle; [noserif] 320,170 -- 560,-70'],
  R: ['R', 'upper', '0,0 -- 0,700; 0,700 -- 260,700 .. 440,520 .. 260,340{180} -- 0,340; 230,340 -- 460,0'],
  S: ['S', 'upper', '[ap] 450,595 .. 255,700{180} .. 60,530 .. 250,360 .. 450,175 .. 250,0{180} .. 30,105'],
  T: ['T', 'upper', '0,700 -- 480,700; 240,700 -- 240,0'],
  U: ['U', 'upper', '0,700 -- 0,235 .. 240,0{0} .. 480,235{90} -- 480,700'],
  V: ['V', 'upper', '0,700 -- 255,0; 255,0 -- 510,700'],
  W: ['W', 'upper', '0,700 -- 190,0; 190,0 -- 370,700; 370,700 -- 550,0; 550,0 -- 740,700'],
  X: ['X', 'upper', '0,700 -- 480,0; 480,700 -- 0,0'],
  Y: ['Y', 'upper', '0,700 -- 245,340; 490,700 -- 245,340; 245,340 -- 245,0'],
  Z: ['Z', 'upper', '25,700 -- 455,700 -- 10,0 -- 470,0'],

  // ---- Lowercase ----
  a: ['a', 'lower', '[ap] 440,0 -- 440,330 .. 245,500{180} .. 70,410; 440,280 -- 215,280 .. 40,140{-90} .. 200,0{0} .. 440,110'],
  b: ['b', 'lower', '0,0 -- 0,750; 0,375 .. 250,500{0} .. 475,250{-90} .. 250,0{180} .. 0,125'],
  c: ['c', 'lower', '[ap] 440,395 .. 255,500{180} .. 40,250{-90} .. 255,0{0} .. 440,105'],
  d: ['d', 'lower', '475,0 -- 475,750; 475,375 .. 225,500{180} .. 0,250{-90} .. 225,0{0} .. 475,125'],
  e: ['e', 'lower', '[ap] 45,255 -- 455,255{90} .. 250,500{180} .. 40,250{-90} .. 255,0{0} .. 445,95'],
  f: ['f', 'lower', '[ap] 140,0 -- 140,570 .. 290,750{0} .. 400,720; [noserif] 0,500 -- 330,500'],
  g: ['g', 'lower', '[ap] 445,500 -- 445,-30 .. 240,-220{180} .. 55,-140; 445,375 .. 230,500{180} .. 25,265{-90} .. 230,25{0} .. 445,150'],
  h: ['h', 'lower', '0,0 -- 0,750; 0,355 .. 230,500{0} .. 440,330{-90} -- 440,0'],
  i: ['i', 'lower', '0,0 -- 0,500; 0,665'],
  j: ['j', 'lower', '[ap] 110,500 -- 110,-40 .. -10,-220{180} .. -120,-195; 110,665'],
  k: ['k', 'lower', '0,0 -- 0,750; 410,500 -- 0,165; 132,274 -- 430,0'],
  l: ['l', 'lower', '0,0 -- 0,750'],
  m: ['m', 'lower', '0,0 -- 0,500; 0,365 .. 180,500{0} .. 330,340{-90} -- 330,0; 330,365 .. 505,500{0} .. 655,340{-90} -- 655,0'],
  n: ['n', 'lower', '0,0 -- 0,500; 0,355 .. 230,500{0} .. 440,330{-90} -- 440,0'],
  o: ['o', 'lower', '245,0 .. 490,250 .. 245,500 .. 0,250 .. cycle'],
  p: ['p', 'lower', '0,-220 -- 0,500; 0,375 .. 250,500{0} .. 475,250{-90} .. 250,0{180} .. 0,125'],
  q: ['q', 'lower', '475,-220 -- 475,500; 475,375 .. 225,500{180} .. 0,250{-90} .. 225,0{0} .. 475,125'],
  r: ['r', 'lower', '0,0 -- 0,500; 0,335 .. 190,500{0} .. 315,470'],
  s: ['s', 'lower', '[ap] 400,415 .. 220,500{180} .. 50,370 .. 220,255 .. 410,130 .. 220,0{180} .. 30,85'],
  t: ['t', 'lower', '[ap] 120,680 -- 120,125 .. 225,0{0} .. 330,20; [noserif] 0,500 -- 300,500'],
  u: ['u', 'lower', '0,500 -- 0,170 .. 210,0{0} .. 440,145; 440,500 -- 440,0'],
  v: ['v', 'lower', '0,500 -- 220,0; 220,0 -- 440,500'],
  w: ['w', 'lower', '0,500 -- 160,0; 160,0 -- 320,500; 320,500 -- 480,0; 480,0 -- 640,500'],
  x: ['x', 'lower', '0,500 -- 420,0; 420,500 -- 0,0'],
  y: ['y', 'lower', '0,500 -- 225,0; [ap] 450,500 -- 158,-150 .. 95,-220{180} .. 20,-212'],
  z: ['z', 'lower', '25,500 -- 410,500 -- 5,0 -- 420,0'],

  // ---- Figures (lining) ----
  zero: ['0', 'figure', '250,0 .. 480,350 .. 250,700 .. 20,350 .. cycle'],
  one: ['1', 'figure', '40,560 -- 250,700; 250,700 -- 250,0'],
  two: ['2', 'figure', '[ap] 45,555 .. 240,700{0} .. 430,525 .. 305,330 -- 20,0 -- 455,0'],
  three: ['3', 'figure', '[ap] 40,590 .. 235,700{0} .. 410,545 .. 190,385{180}; [ap] 190,385{0} .. 440,195 .. 235,0{180} .. 25,110'],
  four: ['4', 'figure', '360,0 -- 360,700; 360,700 -- 0,210 -- 475,210'],
  five: ['5', 'figure', '[ap] 420,700 -- 95,700 -- 65,385{25} .. 255,440{0} .. 445,225 .. 245,0{180} .. 30,100'],
  six: ['6', 'figure', '250,0 .. 460,215 .. 250,430 .. 40,215 .. cycle; [ap] 40,225{90} .. 165,575 .. 390,695'],
  seven: ['7', 'figure', '20,700 -- 460,700 -- 170,0'],
  eight: ['8', 'figure', '245,700 .. 425,545 .. 245,390 .. 65,545 .. cycle; 245,390 .. 455,195 .. 245,0 .. 35,195 .. cycle'],
  nine: ['9', 'figure', '230,270 .. 440,485 .. 230,700 .. 20,485 .. cycle; [ap] 440,475{-90} .. 315,125 .. 90,5'],

  // ---- Punctuation & symbols ----
  space: [' ', 'space', ''],
  period: ['.', 'punct', '0,0'],
  comma: [',', 'punct', comma(0, 0)],
  colon: [':', 'punct', '0,0; 0,440'],
  semicolon: [';', 'punct', `0,440; ${comma(0, 0)}`],
  exclam: ['!', 'symbol', '0,700 -- 0,210; 0,0'],
  question: ['?', 'symbol', '25,560 .. 215,700{0} .. 400,540 .. 215,370{-90} -- 215,210; 215,0'],
  quotesingle: ["'", 'symbol', '0,700 -- 0,470'],
  quotedbl: ['"', 'symbol', '0,700 -- 0,470; 160,700 -- 160,470'],
  quoteright: ['’', 'symbol', comma(0, 640)],
  quoteleft: ['‘', 'symbol', null, { rotate: 'quoteright' }],
  quotedblright: ['”', 'symbol', `${comma(0, 640)}; ${comma(150, 640)}`],
  quotedblleft: ['“', 'symbol', null, { rotate: 'quotedblright' }],
  quotesinglbase: ['‚', 'punct', comma(0, 0)],
  quotedblbase: ['„', 'punct', `${comma(0, 0)}; ${comma(150, 0)}`],
  hyphen: ['-', 'punct', '0,250 -- 250,250'],
  endash: ['–', 'punct', '0,250 -- 500,250'],
  emdash: ['—', 'punct', '0,250 -- 900,250'],
  underscore: ['_', 'symbol', '0,-120 -- 500,-120'],
  parenleft: ['(', 'symbol', '200,790 .. 45,300 .. 200,-190'],
  parenright: [')', 'symbol', '0,790 .. 155,300 .. 0,-190'],
  bracketleft: ['[', 'symbol', '180,790 -- 0,790 -- 0,-190 -- 180,-190'],
  bracketright: [']', 'symbol', '0,790 -- 180,790 -- 180,-190 -- 0,-190'],
  braceleft: ['{', 'symbol', '230,790 .. 120,700{-90} -- 120,400 .. 20,300{180}; 20,300{0} .. 120,200{-90} -- 120,-100 .. 230,-190'],
  braceright: ['}', 'symbol', '0,790 .. 110,700{-90} -- 110,400 .. 210,300{0}; 210,300{180} .. 110,200{-90} -- 110,-100 .. 0,-190'],
  slash: ['/', 'symbol', '0,-60 -- 330,760'],
  backslash: ['\\', 'symbol', '330,-60 -- 0,760'],
  bar: ['|', 'symbol', '0,790 -- 0,-190'],
  brokenbar: ['¦', 'symbol', '0,790 -- 0,390; 0,210 -- 0,-190'],
  at: ['@', 'symbol', '[w=0.8] 440,480 -- 440,235 .. 505,165{0} .. 615,390{90} .. 345,665{180} .. 50,330{-90} .. 345,0{0} .. 540,60; [w=0.8] 320,170 .. 430,330 .. 320,485 .. 205,330 .. cycle'],
  ampersand: ['&', 'symbol', '540,0 -- 205,420 .. 120,585{90} .. 260,700{0} .. 395,590{-90} .. 240,435 .. 50,215{-90} .. 235,0{0} .. 435,130 .. 500,330'],
  numbersign: ['#', 'symbol', '120,0 -- 190,700; 330,0 -- 400,700; [noserif] 20,230 -- 480,230; [noserif] 40,470 -- 500,470'],
  percent: ['%', 'symbol', '120,410 .. 225,555 .. 120,700 .. 15,555 .. cycle; 470,0 .. 575,145 .. 470,290 .. 365,145 .. cycle; 60,0 -- 530,700'],
  asterisk: ['*', 'symbol', '[w=0.8] 200,700 -- 200,470; [w=0.8] 100,643 -- 300,527; [w=0.8] 300,643 -- 100,527'],
  plus: ['+', 'symbol', '0,330 -- 460,330; 230,100 -- 230,560'],
  minus: ['−', 'symbol', '0,330 -- 460,330'],
  equal: ['=', 'symbol', '0,230 -- 460,230; 0,430 -- 460,430'],
  less: ['<', 'symbol', '440,560 -- 20,330 -- 440,100'],
  greater: ['>', 'symbol', '20,560 -- 440,330 -- 20,100'],
  multiply: ['×', 'symbol', '40,150 -- 400,510; 400,150 -- 40,510'],
  divide: ['÷', 'symbol', '0,330 -- 460,330; 230,550; 230,110'],
  plusminus: ['±', 'symbol', '0,380 -- 460,380; 230,160 -- 230,600; 0,0 -- 460,0'],
  logicalnot: ['¬', 'symbol', '0,400 -- 440,400 -- 440,220'],
  asciicircum: ['^', 'symbol', '0,420 -- 200,700 -- 400,420'],
  asciitilde: ['~', 'symbol', '0,300 .. 115,385{0} .. 245,320 .. 375,255{0} .. 490,340'],
  dollar: ['$', 'symbol', '[ap] 440,590 .. 250,690{180} .. 70,530 .. 250,365 .. 445,180 .. 250,10{180} .. 40,110; [noserif] 250,810 -- 250,-110'],
  euro: ['€', 'symbol', '[ap] 540,610 .. 345,700{180} .. 110,350{-90} .. 345,0{0} .. 540,90; [noserif] 0,420 -- 390,420; [noserif] 0,280 -- 370,280'],
  sterling: ['£', 'symbol', '440,600 .. 315,700{180} .. 175,550{-90} -- 175,170 .. 45,0; 30,0 -- 470,0; [noserif] 25,360 -- 355,360'],
  yen: ['¥', 'symbol', '0,700 -- 245,340; 490,700 -- 245,340; 245,340 -- 245,0; [noserif] 70,300 -- 420,300; [noserif] 70,160 -- 420,160'],
  cent: ['¢', 'punct', '[ap] 440,395 .. 255,500{180} .. 40,250{-90} .. 255,0{0} .. 440,105; [noserif] 255,600 -- 255,-100'],
  currency: ['¤', 'symbol', '[w=0.8] 250,130 .. 440,320 .. 250,510 .. 60,320 .. cycle; [w=0.8] 70,140 -- 140,210; [w=0.8] 430,140 -- 360,210; [w=0.8] 70,500 -- 140,430; [w=0.8] 430,500 -- 360,430'],
  section: ['§', 'symbol', '[w=0.85] 380,650 .. 230,720{180} .. 90,610 .. 230,480 .. 380,340 .. 230,200{180} .. 80,260; [w=0.85] 80,40 .. 230,-30{0} .. 370,80 .. 230,210 .. 80,350 .. 230,490{0} .. 380,430'],
  paragraph: ['¶', 'symbol', '300,-150 -- 300,700; 450,-150 -- 450,700 -- 230,700 .. 30,520{-90} .. 230,340{0} -- 300,340'],
  copyright: ['©', 'symbol', '[w=0.6] 370,0 .. 740,350 .. 370,700 .. 0,350 .. cycle; [w=0.6] 500,440 .. 380,520{180} .. 235,350{-90} .. 380,180{0} .. 500,260'],
  registered: ['®', 'symbol', '[w=0.6] 370,0 .. 740,350 .. 370,700 .. 0,350 .. cycle; [w=0.6,noserif] 270,170 -- 270,530 -- 390,530 .. 470,445 .. 390,360{180} -- 270,360; [w=0.6,noserif] 380,360 -- 480,170'],
  degree: ['°', 'symbol', '[w=0.6] 110,450 .. 215,575 .. 110,700 .. 5,575 .. cycle'],
  bullet: ['•', 'punct', '[w=1.9] 0,250'],
  periodcentered: ['·', 'punct', '0,250'],
  ellipsis: ['…', 'punct', '0,0; 260,0; 520,0'],
  exclamdown: ['¡', 'punct', null, { rotate: 'exclam', dy: -200 }],
  questiondown: ['¿', 'punct', null, { rotate: 'question', dy: -200 }],
  guillemotleft: ['«', 'punct', '[noserif] 200,420 -- 20,250 -- 200,80; [noserif] 420,420 -- 240,250 -- 420,80'],
  guillemotright: ['»', 'punct', '[noserif] 20,420 -- 200,250 -- 20,80; [noserif] 240,420 -- 420,250 -- 240,80'],
  guilsinglleft: ['‹', 'punct', '[noserif] 200,420 -- 20,250 -- 200,80'],
  guilsinglright: ['›', 'punct', '[noserif] 20,420 -- 200,250 -- 20,80'],
  ordfeminine: ['ª', 'symbol', '[w=0.7] 250,410 -- 250,600 .. 145,700{180} .. 40,640; [w=0.7] 250,580 -- 130,580 .. 30,500{-90} .. 130,410{0} .. 250,470'],
  ordmasculine: ['º', 'symbol', '[w=0.7] 140,410 .. 270,555 .. 140,700 .. 10,555 .. cycle'],
  onesuperior: ['¹', 'symbol', '[w=0.7] 20,640 -- 130,720 -- 130,380'],
  twosuperior: ['²', 'symbol', '[w=0.7] 25,650 .. 125,720{0} .. 225,630 .. 160,535 -- 15,380 -- 240,380'],
  threesuperior: ['³', 'symbol', '[w=0.7] 25,670 .. 125,720{0} .. 215,640 .. 100,560{180}; [w=0.7] 100,560{0} .. 230,465 .. 125,380{180} .. 15,435'],
  dagger: ['†', 'symbol', '200,760 -- 200,-150; [noserif] 20,560 -- 380,560'],
  daggerdbl: ['‡', 'symbol', '200,760 -- 200,-150; [noserif] 20,560 -- 380,560; [noserif] 20,140 -- 380,140'],
  perthousand: ['‰', 'symbol', '[w=0.8] 120,410 .. 225,555 .. 120,700 .. 15,555 .. cycle; [w=0.8] 470,0 .. 575,145 .. 470,290 .. 365,145 .. cycle; [w=0.8] 780,0 .. 885,145 .. 780,290 .. 675,145 .. cycle; [w=0.8] 60,0 -- 530,700'],
  trademark: ['™', 'symbol', '[w=0.6] 0,700 -- 260,700; [w=0.6] 130,700 -- 130,400; [w=0.6] 340,400 -- 340,700 -- 450,480 -- 560,700 -- 560,400'],
  mu: ['µ', 'lower', '0,500 -- 0,-220; 0,170 .. 210,0{0} .. 440,145; 440,500 -- 440,0'],

  // ---- Letters that are not simple base + accent ----
  AE: ['Æ', 'upper', '0,0 -- 330,700 -- 660,700; 330,700 -- 330,0 -- 670,0; [noserif] 330,360 -- 630,360; [noserif] 115,230 -- 330,230'],
  ae: ['æ', 'lower', '440,0 -- 440,330 .. 245,500{180} .. 70,410; 440,280 -- 215,280 .. 40,140{-90} .. 200,0{0} .. 440,110; 445,255 -- 855,255{90} .. 650,500{180} .. 440,250{-90} .. 655,0{0} .. 845,95'],
  OE: ['Œ', 'upper', '530,700 -- 310,700 .. 25,350{-90} .. 310,0{0} -- 530,0; 530,0 -- 530,700; 530,700 -- 880,700; [noserif] 530,360 -- 840,360; 530,0 -- 890,0'],
  oe: ['œ', 'lower', '245,0 .. 490,250 .. 245,500 .. 0,250 .. cycle; 490,255 -- 900,255{90} .. 695,500{180} .. 485,250{-90} .. 700,0{0} .. 890,95'],
  Oslash: ['Ø', 'upper', '285,0 .. 570,350 .. 285,700 .. 0,350 .. cycle; [noserif] 20,-30 -- 550,730'],
  oslash: ['ø', 'lower', '245,0 .. 490,250 .. 245,500 .. 0,250 .. cycle; [noserif] 10,-30 -- 480,530'],
  germandbls: ['ß', 'lower', '0,0 -- 0,560 .. 195,750{0} .. 365,610 .. 205,450^ .. 440,230 .. 235,0{180} .. 100,30'],
  Eth: ['Ð', 'upper', '0,0 -- 0,700; 0,700 -- 210,700 .. 470,350{-90} .. 210,0{180} -- 0,0; [noserif] -80,350 -- 180,350'],
  eth: ['ð', 'lower', '245,0 .. 480,230 .. 245,460 .. 10,230 .. cycle; 470,230{90} .. 360,600 .. 140,750; [noserif] 190,690 -- 400,590'],
  Thorn: ['Þ', 'upper', '0,0 -- 0,700; 0,560 -- 250,560 .. 430,375 .. 250,190{180} -- 0,190'],
  thorn: ['þ', 'lower', '0,-220 -- 0,750; 0,375 .. 250,500{0} .. 475,250{-90} .. 250,0{180} .. 0,125'],
  Dcroat: ['Đ', 'upper', '0,0 -- 0,700; 0,700 -- 210,700 .. 470,350{-90} .. 210,0{180} -- 0,0; [noserif] -80,350 -- 180,350'],
  dcroat: ['đ', 'lower', '475,0 -- 475,750; 475,375 .. 225,500{180} .. 0,250{-90} .. 225,0{0} .. 475,125; [noserif] 320,640 -- 580,640'],
  Hbar: ['Ħ', 'upper', '0,0 -- 0,700; 480,0 -- 480,700; [noserif] 0,360 -- 480,360; [noserif] -70,560 -- 550,560'],
  hbar: ['ħ', 'lower', '0,0 -- 0,750; 0,355 .. 230,500{0} .. 440,330{-90} -- 440,0; [noserif] -80,640 -- 240,640'],
  Lslash: ['Ł', 'upper', '0,0 -- 0,700; 0,0 -- 390,0; [noserif] -90,260 -- 160,430'],
  lslash: ['ł', 'lower', '0,0 -- 0,750; [noserif] -120,310 -- 120,470'],
  Tbar: ['Ŧ', 'upper', '0,700 -- 480,700; 240,700 -- 240,0; [noserif] 100,350 -- 380,350'],
  tbar: ['ŧ', 'lower', '120,680 -- 120,125 .. 225,0{0} .. 330,20; [noserif] 0,500 -- 300,500; [noserif] 20,310 -- 250,310'],
  dotlessi: ['ı', 'lower', '0,0 -- 0,500'],
  dotlessj: ['ȷ', 'lower', '110,500 -- 110,-40 .. -10,-220{180} .. -120,-195'],
  kgreenlandic: ['ĸ', 'lower', '0,0 -- 0,500; 410,500 -- 0,165; 132,274 -- 430,0'],
  Eng: ['Ŋ', 'upper', '0,0 -- 0,700; 0,540 .. 250,700{0} .. 480,480{-90} -- 480,-40 .. 360,-190{180} .. 250,-170'],
  eng: ['ŋ', 'lower', '0,0 -- 0,500; 0,355 .. 230,500{0} .. 440,330{-90} -- 440,-60 .. 330,-220{180} .. 230,-200'],
  IJ: ['Ĳ', 'upper', '0,0 -- 0,700; 490,700 -- 490,215 .. 330,0{180} .. 165,175'],
  ij: ['ĳ', 'lower', '0,0 -- 0,500; 0,665; 250,500 -- 250,-40 .. 130,-220{180} .. 20,-195; 250,665'],
  Ldot: ['Ŀ', 'upper', '0,0 -- 0,700; 0,0 -- 390,0; 250,350'],
  ldotaccent: ['ŀ', 'lower', '0,0 -- 0,750; 170,350'],
  longs: ['ſ', 'lower', '140,0 -- 140,570 .. 290,750{0} .. 400,720'],
  napostrophe: ['ŉ', 'lower', `0,0 -- 0,500; 0,355 .. 230,500{0} .. 440,330{-90} -- 440,0; ${comma(-110, 720)}`],

  // ---- Ligatures (unencoded, reached through the liga feature) ----
  f_i: [null, 'lower', '140,0 -- 140,570 .. 290,750{0} .. 400,720; [noserif] 0,500 -- 330,500; 370,0 -- 370,500'],
  f_l: [null, 'lower', '140,0 -- 140,570 .. 290,750{0} .. 420,750{0} -- 420,0; [noserif] 0,500 -- 330,500'],
  f_f: [null, 'lower', '140,0 -- 140,570 .. 290,750{0} .. 400,720; 420,0 -- 420,570 .. 570,750{0} .. 680,720; [noserif] 0,500 -- 610,500'],
  f_f_i: [null, 'lower', '140,0 -- 140,570 .. 290,750{0} .. 400,720; 420,0 -- 420,570 .. 570,750{0} .. 680,720; [noserif] 0,500 -- 610,500; 650,0 -- 650,500'],
  f_f_l: [null, 'lower', '140,0 -- 140,570 .. 290,750{0} .. 400,720; 420,0 -- 420,570 .. 570,750{0} .. 700,750{0} -- 700,0; [noserif] 0,500 -- 610,500'],
};

// Structural alternates picked by the Construction parameter. Anything not
// listed here uses the BASE skeleton above for every construction.
export const VARIANTS = {
  a: {
    // single-storey, the geometric signature (Futura, Avenir)
    geometric: '440,0 -- 440,500; 440,375 .. 220,500{180} .. 0,250{-90} .. 220,0{0} .. 440,125',
  },
  g: {
    // double-storey "binocular" g of humanist and old-style faces
    humanist: '[w=0.9] 215,245 .. 370,375 .. 215,500 .. 60,375 .. cycle; [noserif,w=0.8] 330,470 -- 450,495; ' +
      '[w=0.9] 150,265 .. 95,185{-90} .. 185,120{0} -- 320,120 .. 450,-50{-90} .. 245,-220{180} .. 40,-95{90} .. 175,95',
  },
  y: {
    // straight tail
    geometric: '0,500 -- 221,0; 450,500 -- 120,-220',
  },
  t: {
    // plain cross, no hook
    geometric: '150,700 -- 150,0; [noserif] 20,500 -- 280,500',
  },
  G: {
    // no spur, bar only
    geometric: '[ap] 490,560 .. 285,700{180} .. 30,350{-90} .. 285,0{0} .. 500,210{90} -- 500,330; [noserif] 300,330 -- 500,330',
  },
  R: {
    // humanist leg leaves the bowl from the stem side and kicks out
    humanist: '0,0 -- 0,700; 0,700 -- 260,700 .. 440,520 .. 260,340{180} -- 0,340; 200,340 .. 360,210 -- 470,0',
  },
  M: {
    // splayed M with a high vertex
    humanist: '30,0 -- 80,700; 80,700 -- 300,180; 300,180 -- 520,700; 520,700 -- 570,0',
  },
};

// Per-construction proportions of round letters (horizontal scale).
export const ROUND_GLYPHS = new Set(['o', 'c', 'e', 'd', 'b', 'p', 'q', 'g', 'a', 'O', 'C', 'G', 'Q', 'D', 'zero', 'six', 'nine', 'eight', 'oe', 'oslash', 'Oslash', 'eth']);

// Accent skeletons, centred on x = 0. Placement is computed per base glyph.
export const MARKS = {
  acute: ['[w=0.8] -45,0 -- 60,150', 'top'],
  grave: ['[w=0.8] 45,0 -- -60,150', 'top'],
  circumflex: ['[w=0.8] -115,0 -- 0,140 -- 115,0', 'top'],
  caron: ['[w=0.8] -115,140 -- 0,0 -- 115,140', 'top'],
  dieresis: ['-95,50; 95,50', 'top'],
  dotaccent: ['0,50', 'top'],
  tilde: ['[w=0.8] -130,20 .. -65,110{0} .. 65,30{0} .. 130,120', 'top'],
  ring: ['[w=0.6] 0,0 .. 80,85 .. 0,170 .. -80,85 .. cycle', 'top'],
  macron: ['[w=0.8] -120,50 -- 120,50', 'top'],
  breve: ['[w=0.8] -115,140 .. 0,15{0} .. 115,140', 'top'],
  hungarumlaut: ['[w=0.8] -115,0 -- -45,150; [w=0.8] 45,0 -- 115,150', 'top'],
  cedilla: ['[w=0.75] 0,40 -- 10,-60 .. 85,-140{-90} .. 0,-215{180} .. -70,-200', 'bottom'],
  ogonek: ['[w=0.75] 40,40 .. -45,-100{-90} .. 30,-210{0} .. 95,-190', 'ogonek'],
  commaaccent: [comma(0, 0), 'bottom'],
  commaturned: [null, 'top', { rotate: 'commaaccent' }],
  caronvert: [comma(0, 0), 'right'],
};

// Base + mark composites. Each entry: "char base mark".
const COMPOSITE_TABLE = `
À A grave|Á A acute|Â A circumflex|Ã A tilde|Ä A dieresis|Å A ring|Ç C cedilla
È E grave|É E acute|Ê E circumflex|Ë E dieresis|Ì I grave|Í I acute|Î I circumflex|Ï I dieresis
Ñ N tilde|Ò O grave|Ó O acute|Ô O circumflex|Õ O tilde|Ö O dieresis
Ù U grave|Ú U acute|Û U circumflex|Ü U dieresis|Ý Y acute
à a grave|á a acute|â a circumflex|ã a tilde|ä a dieresis|å a ring|ç c cedilla
è e grave|é e acute|ê e circumflex|ë e dieresis|ì dotlessi grave|í dotlessi acute|î dotlessi circumflex|ï dotlessi dieresis
ñ n tilde|ò o grave|ó o acute|ô o circumflex|õ o tilde|ö o dieresis
ù u grave|ú u acute|û u circumflex|ü u dieresis|ý y acute|ÿ y dieresis
Ā A macron|ā a macron|Ă A breve|ă a breve|Ą A ogonek|ą a ogonek
Ć C acute|ć c acute|Ĉ C circumflex|ĉ c circumflex|Ċ C dotaccent|ċ c dotaccent|Č C caron|č c caron
Ď D caron|ď d caronvert|Ē E macron|ē e macron|Ĕ E breve|ĕ e breve|Ė E dotaccent|ė e dotaccent
Ę E ogonek|ę e ogonek|Ě E caron|ě e caron
Ĝ G circumflex|ĝ g circumflex|Ğ G breve|ğ g breve|Ġ G dotaccent|ġ g dotaccent|Ģ G commaaccent|ģ g commaturned
Ĥ H circumflex|ĥ h circumflex|Ĩ I tilde|ĩ dotlessi tilde|Ī I macron|ī dotlessi macron|Ĭ I breve|ĭ dotlessi breve
Į I ogonek|į i ogonek|İ I dotaccent|Ĵ J circumflex|ĵ dotlessj circumflex
Ķ K commaaccent|ķ k commaaccent|Ĺ L acute|ĺ l acute|Ļ L commaaccent|ļ l commaaccent|Ľ L caronvert|ľ l caronvert
Ń N acute|ń n acute|Ņ N commaaccent|ņ n commaaccent|Ň N caron|ň n caron
Ō O macron|ō o macron|Ŏ O breve|ŏ o breve|Ő O hungarumlaut|ő o hungarumlaut
Ŕ R acute|ŕ r acute|Ŗ R commaaccent|ŗ r commaaccent|Ř R caron|ř r caron
Ś S acute|ś s acute|Ŝ S circumflex|ŝ s circumflex|Ş S cedilla|ş s cedilla|Š S caron|š s caron
Ţ T cedilla|ţ t cedilla|Ť T caron|ť t caronvert
Ũ U tilde|ũ u tilde|Ū U macron|ū u macron|Ŭ U breve|ŭ u breve|Ů U ring|ů u ring|Ű U hungarumlaut|ű u hungarumlaut
Ų U ogonek|ų u ogonek|Ŵ W circumflex|ŵ w circumflex|Ŷ Y circumflex|ŷ y circumflex|Ÿ Y dieresis
Ź Z acute|ź z acute|Ż Z dotaccent|ż z dotaccent|Ž Z caron|ž z caron
\` space grave|¨ space dieresis|´ space acute|¯ space macron|¸ space cedilla
`;

export const COMPOSITES = COMPOSITE_TABLE.split(/[|\n]/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((line) => {
    const [char, base, mark] = line.split(' ');
    return { char, base, mark };
  });

// Production glyph name for a composite character (AGL style).
export function compositeName(base, mark) {
  if (base === 'space') return mark;
  const b = base === 'dotlessi' ? 'i' : base === 'dotlessj' ? 'j' : base;
  const m = { caronvert: 'caron', commaturned: 'commaaccent' }[mark] || mark;
  return b + m;
}

// Extra code points mapped onto an existing glyph.
export const ALIASES = { space: [0xa0], hyphen: [0xad] };
