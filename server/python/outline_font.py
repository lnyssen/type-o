#!/usr/bin/env python3
"""Hand the browser the real outlines of a master, instantiated at the chosen
axes and flattened to polygons.

The operator chain runs in the client, on these polygons, so what you see on
screen is exactly the geometry that build_font.py later packs into a font. This
script is the only place the variable master is read.

stdin:  {"master": path, "axes": {...}, "chars": "ABC…", "tolerance": 1.0}
stdout: {"upm":…, "metrics":{…}, "glyphs": {"A": {"advance":…, "contours":[[x,y,…]]}}, "kerning": {"AV": -80}}
"""
import json
import math
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib import instancer


class FlattenPen(BasePen):
    """Curves become polylines fine enough that the facets are invisible."""

    def __init__(self, glyphSet, tolerance):
        super().__init__(glyphSet)
        self.tolerance = max(0.05, float(tolerance))
        self.contours = []
        self._current = None

    def _moveTo(self, pt):
        self._current = [pt]

    def _lineTo(self, pt):
        if self._current is not None:
            self._current.append(pt)

    def _steps(self, pts):
        # Chord length is a generous upper bound on arc length: good enough to
        # pick a subdivision count, and never under-subdivides.
        span = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        return max(2, min(96, int(math.sqrt(span / self.tolerance) * 1.6) + 2))

    def _curveToOne(self, p1, p2, p3):
        p0 = self._current[-1]
        n = self._steps((p0, p1, p2, p3))
        for i in range(1, n + 1):
            t, u = i / n, 1 - i / n
            self._current.append((
                u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
            ))

    def _qCurveToOne(self, p1, p2):
        p0 = self._current[-1]
        n = self._steps((p0, p1, p2))
        for i in range(1, n + 1):
            t, u = i / n, 1 - i / n
            self._current.append((
                u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
            ))

    def _closePath(self):
        pts = self._current or []
        if len(pts) > 2 and math.dist(pts[0], pts[-1]) < 1e-6:
            pts = pts[:-1]
        if len(pts) > 2:
            self.contours.append(pts)
        self._current = None

    _endPath = _closePath


def coverage_list(coverage):
    return list(coverage.glyphs) if coverage else []


def class_map(class_def, glyphs):
    out = {g: 0 for g in glyphs}
    if class_def:
        for glyph, cls in class_def.classDefs.items():
            if glyph in out:
                out[glyph] = cls
    return out


def kerning(font, glyph_names):
    """Horizontal kerning for `glyph_names`, read from GPOS PairPos lookups."""
    if "GPOS" not in font:
        return {}
    wanted = set(glyph_names)
    pairs = {}

    def read(sub):
        if sub.LookupType == 9:  # extension
            return read(sub.ExtSubTable)
        if sub.LookupType != 2:
            return
        first = coverage_list(sub.Coverage)
        if sub.Format == 1:
            for name, pair_set in zip(first, sub.PairSet):
                if name not in wanted:
                    continue
                for record in pair_set.PairValueRecord:
                    if record.SecondGlyph in wanted and getattr(record.Value1, "XAdvance", 0):
                        pairs[(name, record.SecondGlyph)] = record.Value1.XAdvance
        elif sub.Format == 2:
            firsts = class_map(sub.ClassDef1, first)
            seconds = class_map(sub.ClassDef2, wanted)
            by_class2 = {}
            for name, cls in seconds.items():
                by_class2.setdefault(cls, []).append(name)
            for name in first:
                if name not in wanted:
                    continue
                row = sub.Class1Record[firsts[name]]
                for cls2, record in enumerate(row.Class2Record):
                    value = getattr(record.Value1, "XAdvance", 0)
                    if not value:
                        continue
                    for second in by_class2.get(cls2, ()):
                        pairs[(name, second)] = value

    for lookup in font["GPOS"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            try:
                read(sub)
            except AttributeError:
                continue
    return pairs


def extract(master, axes, chars, tolerance=1.2):
    """Outlines, metrics and kerning for `chars`, at `axes`."""
    font = TTFont(master)
    axes = {k: float(v) for k, v in (axes or {}).items()}
    if "fvar" in font and axes:
        font = instancer.instantiateVariableFont(font, axes, inplace=True, updateFontNames=False, optimize=False)
    try:
        removeOverlaps(font)  # masters stack contours; the operators need clean shapes
    except Exception:  # noqa: BLE001 — a font we cannot clean is still usable
        pass

    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    flatness = max(0.05, float(tolerance)) * upm / 1000.0

    wanted = []
    for ch in dict.fromkeys(chars or ""):
        name = cmap.get(ord(ch))
        if name:
            wanted.append((ch, name))

    glyphs = {}
    for ch, name in wanted:
        pen = FlattenPen(glyph_set, flatness)
        glyph_set[name].draw(pen)
        glyphs[ch] = {
            "advance": hmtx[name][0],
            "contours": [[round(v, 1) for pt in contour for v in pt] for contour in pen.contours],
        }

    names = {name: ch for ch, name in wanted}
    kern = {}
    for (a, b), value in kerning(font, names).items():
        kern[names[a] + names[b]] = value

    os2 = font["OS/2"]
    return {
        "upm": upm,
        "metrics": {
            "ascender": font["hhea"].ascender,
            "descender": font["hhea"].descender,
            "capHeight": getattr(os2, "sCapHeight", None) or round(upm * 0.7),
            "xHeight": getattr(os2, "sxHeight", None) or round(upm * 0.5),
        },
        "glyphs": glyphs,
        "kerning": kern,
    }


def main():
    job = json.load(sys.stdin)
    json.dump(extract(job["master"], job.get("axes"), job.get("chars") or "", job.get("tolerance") or 1.2), sys.stdout)


if __name__ == "__main__":
    main()
