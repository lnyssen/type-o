// Skeletons: the abstract armature of a glyph.
//
// A skeleton is { strokes: Stroke[] } where
//   Stroke = { nodes: Node[], joins: ('line'|'curve')[], closed: bool, w?: number, noserif?: bool }
//   Node   = { x, y, dir?: degrees, corner?: bool }
// joins[i] connects nodes[i] to nodes[i+1] (or back to nodes[0] for the last
// join of a closed stroke). A stroke with a single node is a dot.
//
// Glyph data is authored in a compact METAFONT-flavoured notation:
//   "0,0 -- 0,700; 0,380 .. 245,500{0} .. 470,250 .. 245,0{180} .. 0,120"
//   --        straight connection         ..      curved connection
//   {deg}     fixed tangent direction     ^       corner (break smoothness)
//   cycle     closes the stroke           [w=0.6] stroke width multiplier
//   [noserif] never grow serifs on this stroke
// Strokes are separated by ';'. The notation is only an authoring format: the
// editor, the engine and .gentype files all work on the JSON form.

const TOKEN = /\[([^\]]*)\]|(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(\{(-?\d+(?:\.\d+)?)\})?(\^)?|--|\.\.|cycle|\S+/g;

export function parseSkeleton(src) {
  const strokes = [];
  for (const part of src.split(';')) {
    const text = part.trim();
    if (!text) continue;
    const stroke = { nodes: [], joins: [], closed: false };
    let pendingJoin = null;
    for (const m of text.matchAll(TOKEN)) {
      const tok = m[0];
      if (m[1] !== undefined) {
        for (const flag of m[1].split(',').map((s) => s.trim())) {
          if (flag === 'noserif') stroke.noserif = true;
          else if (flag === 'attach') stroke.attach = true;
          else if (flag.startsWith('w=')) stroke.w = parseFloat(flag.slice(2));
          else throw new Error(`Unknown stroke flag "${flag}" in "${text}"`);
        }
      } else if (m[2] !== undefined) {
        const node = { x: +m[2], y: +m[3] };
        if (m[5] !== undefined) node.dir = +m[5];
        if (m[6]) node.corner = true;
        if (stroke.nodes.length) {
          if (!pendingJoin) throw new Error(`Missing connector before ${tok} in "${text}"`);
          stroke.joins.push(pendingJoin);
        }
        stroke.nodes.push(node);
        pendingJoin = null;
      } else if (tok === '--' || tok === '..') {
        pendingJoin = tok === '--' ? 'line' : 'curve';
      } else if (tok === 'cycle') {
        if (!pendingJoin) throw new Error(`Missing connector before cycle in "${text}"`);
        stroke.joins.push(pendingJoin);
        stroke.closed = true;
        pendingJoin = null;
      } else if (tok !== '.') {
        throw new Error(`Unexpected token "${tok}" in "${text}"`);
      }
    }
    if (!stroke.nodes.length) continue;
    strokes.push(stroke);
  }
  return { strokes };
}

function fmt(n) {
  return String(Math.round(n * 10) / 10);
}

export function serializeSkeleton(sk) {
  return sk.strokes
    .map((s) => {
      const flags = [];
      if (s.w != null && s.w !== 1) flags.push(`w=${s.w}`);
      if (s.noserif) flags.push('noserif');
      if (s.attach) flags.push('attach');
      let out = flags.length ? `[${flags.join(',')}] ` : '';
      s.nodes.forEach((n, i) => {
        if (i > 0) out += s.joins[i - 1] === 'line' ? ' -- ' : ' .. ';
        out += `${fmt(n.x)},${fmt(n.y)}`;
        if (n.dir != null) out += `{${fmt(n.dir)}}`;
        if (n.corner) out += '^';
      });
      if (s.closed) out += (s.joins[s.nodes.length - 1] === 'line' ? ' -- ' : ' .. ') + 'cycle';
      return out;
    })
    .join('; ');
}

export function cloneSkeleton(sk) {
  return {
    strokes: sk.strokes.map((s) => ({
      ...s,
      nodes: s.nodes.map((n) => ({ ...n })),
      joins: [...s.joins],
    })),
  };
}

export function mapNodes(sk, fn) {
  const out = cloneSkeleton(sk);
  for (const s of out.strokes) s.nodes = s.nodes.map((n) => ({ ...n, ...fn(n) }));
  return out;
}

export function translateSkeleton(sk, dx, dy) {
  return mapNodes(sk, (n) => ({ x: n.x + dx, y: n.y + dy }));
}

// Point-reflect about (cx, cy): used for ¡ ¿ and turned quotes.
export function rotate180(sk, cx, cy) {
  return mapNodes(sk, (n) => ({
    x: 2 * cx - n.x,
    y: 2 * cy - n.y,
    ...(n.dir != null ? { dir: n.dir + 180 } : {}),
  }));
}

export function mirrorX(sk, cx) {
  return mapNodes(sk, (n) => ({
    x: 2 * cx - n.x,
    ...(n.dir != null ? { dir: 180 - n.dir } : {}),
  }));
}

export function mergeSkeletons(...sks) {
  return { strokes: sks.flatMap((sk) => cloneSkeleton(sk).strokes) };
}

export function skeletonBounds(sk) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const s of sk.strokes)
    for (const n of s.nodes) {
      xMin = Math.min(xMin, n.x); xMax = Math.max(xMax, n.x);
      yMin = Math.min(yMin, n.y); yMax = Math.max(yMax, n.y);
    }
  if (xMin === Infinity) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  return { xMin, yMin, xMax, yMax };
}

// Structural validation used on load and before export. Returns a list of
// human-readable problems; empty means valid.
export function validateSkeleton(sk, label = 'skeleton') {
  const errs = [];
  if (!sk || !Array.isArray(sk.strokes)) return [`${label}: missing strokes array`];
  sk.strokes.forEach((s, i) => {
    const where = `${label} stroke ${i + 1}`;
    if (!Array.isArray(s.nodes) || s.nodes.length === 0) { errs.push(`${where}: no nodes`); return; }
    for (const n of s.nodes)
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) errs.push(`${where}: node with invalid coordinates`);
    const expected = s.closed ? s.nodes.length : s.nodes.length - 1;
    if (!Array.isArray(s.joins) || s.joins.length !== expected) errs.push(`${where}: expected ${expected} connections`);
    else if (s.joins.some((j) => j !== 'line' && j !== 'curve')) errs.push(`${where}: connections must be "line" or "curve"`);
    if (s.closed && s.nodes.length < 2) errs.push(`${where}: a closed stroke needs at least 2 nodes`);
    if (Math.abs(s.w ?? 1) > 4) errs.push(`${where}: width multiplier out of range`);
  });
  return errs;
}
