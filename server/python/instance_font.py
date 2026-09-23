#!/usr/bin/env python3
"""Instantiate a variable master into a named, static font (JSON in, font out).

Steps: pin every axis (fontTools.varLib.instancer) → optional oblique shear
(outlines, components and GPOS anchors) → tracking → rename per the SIL OFL
(original copyright and license kept, reserved names never reused) → optional
TrueType→CFF conversion → ttf / otf / woff / woff2. The result is re-opened
as a sanity check. Errors: one JSON line on stderr, exit code 1.
"""
import io
import json
import math
import re
import sys
import time

from fontTools.pens.qu2cuPen import Qu2CuPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RIBBI = {"Regular", "Italic", "Bold", "Bold Italic"}
NAME_IDS_TO_REPLACE = {1, 2, 3, 4, 6, 16, 17, 18, 21, 22, 25}


def fail(message):
    sys.stderr.write(json.dumps({"error": message}) + "\n")
    sys.exit(1)


def ps_name(family, style):
    base = re.sub(r"[^A-Za-z0-9-]", "", family) or "Untitled"
    return f"{base}-{re.sub(r'[^A-Za-z0-9]', '', style)}"[:63]


def walk_anchors(obj, seen=None):
    """Yield every Anchor table reachable from an otTables object."""
    if seen is None:
        seen = set()
    if obj is None or id(obj) in seen:
        return
    seen.add(id(obj))
    if type(obj).__name__ == "Anchor":
        yield obj
        return
    if isinstance(obj, (list, tuple)):
        for item in obj:
            yield from walk_anchors(item, seen)
        return
    if hasattr(obj, "__dict__"):
        for value in vars(obj).values():
            if isinstance(value, (list, tuple)) or hasattr(value, "__dict__"):
                yield from walk_anchors(value, seen)


def apply_oblique(font, degrees):
    t = math.tan(math.radians(degrees))
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.isComposite():
            for comp in g.components:
                comp.x = int(round(comp.x + comp.y * t))
        elif g.numberOfContours > 0:
            coords = g.coordinates
            for i, (x, y) in enumerate(coords):
                coords[i] = (int(round(x + y * t)), y)
    for name in font.getGlyphOrder():
        glyf[name].recalcBounds(glyf)
        adv, _ = font["hmtx"][name]
        g = glyf[name]
        font["hmtx"][name] = (adv, g.xMin if getattr(g, "numberOfContours", 0) != 0 else 0)
    if "GPOS" in font:
        for anchor in walk_anchors(font["GPOS"].table):
            anchor.XCoordinate = int(round(anchor.XCoordinate + anchor.YCoordinate * t))
    font["post"].italicAngle = -float(degrees)
    upm = font["head"].unitsPerEm
    font["hhea"].caretSlopeRise = upm
    font["hhea"].caretSlopeRun = int(round(upm * t))


def apply_tracking(font, units):
    """Letter-spacing: add `units` after every spacing glyph (like CSS)."""
    if not units:
        return
    hmtx = font["hmtx"]
    for name in font.getGlyphOrder():
        adv, lsb = hmtx[name]
        if adv > 0:
            hmtx[name] = (max(0, adv + units), lsb)


def rename(font, family, style, version, gentype_note):
    ribbi = style in RIBBI
    legacy_family = family if ribbi else f"{family} {style}"
    legacy_style = style if ribbi else "Regular"
    values = {
        1: legacy_family,
        2: legacy_style,
        3: f"{version};GENT;{ps_name(family, style)}",
        4: f"{family} {style}",
        6: ps_name(family, style),
    }
    if not ribbi:
        values[16] = family
        values[17] = style
    name = font["name"]
    name.names = [r for r in name.names if r.nameID not in NAME_IDS_TO_REPLACE]
    for nid, text in values.items():
        name.setName(text, nid, 3, 1, 0x409)
        name.setName(text, nid, 1, 0, 0)
    name.setName(f"Version {version}", 5, 3, 1, 0x409)
    desc = gentype_note
    name.setName(desc, 10, 3, 1, 0x409)
    if "CFF " in font:
        font["CFF "].cff.fontNames = [ps_name(family, style)]


def set_style_bits(font, weight_class, width_class, italic, bold):
    os2 = font["OS/2"]
    os2.usWeightClass = int(weight_class)
    os2.usWidthClass = int(width_class)
    sel = os2.fsSelection & ~(1 | (1 << 5) | (1 << 6) | (1 << 9))  # clear italic/bold/regular/oblique
    if italic:
        sel |= 1
    if bold:
        sel |= 1 << 5
    if not italic and not bold:
        sel |= 1 << 6
    os2.fsSelection = sel | (1 << 7)  # USE_TYPO_METRICS
    font["head"].macStyle = (1 if bold else 0) | (2 if italic else 0)


def to_cff(font, family, style):
    glyph_set = font.getGlyphSet()
    order = font.getGlyphOrder()
    charstrings = {}
    for name in order:
        adv = font["hmtx"][name][0]
        pen = T2CharStringPen(adv, glyph_set)
        glyph_set[name].draw(Qu2CuPen(pen, max_err=1.0, all_cubic=True))
        charstrings[name] = pen.getCharString()
    for tag in ("glyf", "loca", "fpgm", "prep", "cvt ", "gasp", "cvar"):
        if tag in font:
            del font[tag]
    font.sfntVersion = "OTTO"
    fb = FontBuilder(font=font, isTTF=False)
    fb.setupCFF(ps_name(family, style), {"FullName": f"{family} {style}", "FamilyName": family, "Weight": style}, charstrings, {})
    from fontTools.ttLib import newTable
    maxp = newTable("maxp")
    maxp.tableVersion = 0x00005000
    maxp.numGlyphs = len(order)
    font["maxp"] = maxp


def build(p):
    started = time.time()
    font = TTFont(p["master"])
    if "fvar" in font:
        valid = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes}
        pins = {}
        for tag, (lo, hi) in valid.items():
            v = float(p.get("axes", {}).get(tag, font["fvar"].axes[[a.axisTag for a in font["fvar"].axes].index(tag)].defaultValue))
            pins[tag] = min(hi, max(lo, v))
        font = instancer.instantiateVariableFont(font, pins, inplace=True, optimize=True, updateFontNames=False)
    for tag in ("STAT", "MVAR", "HVAR", "VVAR", "avar", "fvar", "gvar", "cvar"):
        if tag in font:
            del font[tag]

    oblique = float(p.get("oblique", 0) or 0)
    if oblique:
        apply_oblique(font, oblique)
    tracking = float(p.get("tracking", 0) or 0)
    apply_tracking(font, int(round(tracking / 1000 * font["head"].unitsPerEm)))

    family, style = p["familyName"], p["styleName"]
    version = str(p.get("version") or "1.000")
    italic = bool(p.get("italic")) or oblique > 0
    set_style_bits(font, p.get("weightClass", 400), p.get("widthClass", 5), italic, style in ("Bold", "Bold Italic"))
    rename(font, family, style, version, p.get("note", "Generated with GenType from an SIL Open Font License master."))

    fmt = p["format"]
    if fmt == "otf":
        to_cff(font, family, style)
    if fmt in ("woff", "woff2"):
        font.flavor = fmt
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    check = TTFont(io.BytesIO(data))
    if check.getGlyphSet() is None or check["maxp"].numGlyphs < 2:
        fail("The compiled font is empty")
    sys.stderr.write(json.dumps({
        "ok": True,
        "bytes": len(data),
        "seconds": round(time.time() - started, 2),
        "variable": "fvar" in check,
        "glyphs": check["maxp"].numGlyphs,
        "familyName": family,
        "styleName": style,
        "italicAngle": check["post"].italicAngle,
    }) + "\n")
    return data


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as e:  # noqa: BLE001
        fail(f"Invalid JSON payload: {e}")
    if payload.get("format") not in ("ttf", "otf", "woff", "woff2"):
        fail("Unsupported format")
    try:
        data = build(payload)
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        fail(f"{type(e).__name__}: {e}")
    sys.stdout.buffer.write(data)


if __name__ == "__main__":
    main()
