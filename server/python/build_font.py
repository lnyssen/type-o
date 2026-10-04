#!/usr/bin/env python3
"""Pack the polygons the browser produced into a real font.

The operator chain runs in the client, so this script never re-derives the
shapes — it receives exactly what was on screen and builds the binary around
it: outlines, metrics, character map, kerning, names and style bits.

stdin: {"familyName":…, "styleName":…, "format":"ttf", "upm":…, "metrics":{…},
        "glyphs": {"A": {"advance":…, "contours": [[x,y,…]]}}, "kerning": {"AV": -80}}
"""
import io
import json
import re
import sys
import time

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps

# The CFF conversion is already solved next door; share it rather than keep a
# second, subtly different copy.
from instance_font import ps_name, to_cff


class Unbuildable(Exception):
    pass


def glyph_name(ch):
    """A legal glyph name. Anything but a plain ASCII letter becomes uniXXXX:
    a name may not start with a digit, which the FEA kerning rules reject."""
    if ch.isascii() and ch.isalpha():
        return ch
    cp = ord(ch)
    return f"uni{cp:04X}" if cp <= 0xFFFF else f"u{cp:06X}"


def build(job):
    upm = int(job.get("upm") or 1000)
    if not 16 <= upm <= 16384:
        raise Unbuildable("That unit size is not a font")
    incoming = job.get("glyphs") or {}
    if not incoming:
        raise Unbuildable("There are no glyphs to build")

    family = str(job.get("familyName") or "Untitled")[:40]
    style = str(job.get("styleName") or "Regular")[:40]
    version = str(job.get("version") or "1.000")

    names = {".notdef": None}
    pens = {}
    advances = {}
    cmap = {}
    for ch, data in incoming.items():
        if len(ch) != 1:
            continue
        name = glyph_name(ch)
        while name in names and names[name] != ch:
            name += "_"
        names[name] = ch
        cmap[ord(ch)] = name
        pen = TTGlyphPen(None)
        for contour in data.get("contours") or []:
            pts = [(round(contour[i]), round(contour[i + 1])) for i in range(0, len(contour) - 1, 2)]
            if len(pts) < 3:
                continue
            pen.moveTo(pts[0])
            for pt in pts[1:]:
                pen.lineTo(pt)
            pen.closePath()
        pens[name] = pen.glyph()
        advances[name] = (max(0, int(round(data.get("advance") or 0))), 0)

    order = [".notdef"] + [n for n in names if n != ".notdef"]
    blank = TTGlyphPen(None)
    pens[".notdef"] = blank.glyph()
    advances[".notdef"] = (round(upm * 0.5), 0)

    metrics = job.get("metrics") or {}
    ascender = int(metrics.get("ascender") or round(upm * 0.8))
    descender = int(metrics.get("descender") or -round(upm * 0.2))

    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(pens)
    fb.setupHorizontalMetrics(advances)
    fb.setupHorizontalHeader(ascent=ascender, descent=descender, lineGap=0)
    fb.setupNameTable({
        "familyName": family,
        "styleName": style,
        "uniqueFontIdentifier": f"{version};GENT;{ps_name(family, style)}",
        "fullName": f"{family} {style}",
        "psName": ps_name(family, style),
        "version": f"Version {version}",
        "copyright": job.get("copyright") or "",
        "licenseDescription": job.get("license") or "",
        "licenseInfoURL": "https://openfontlicense.org",
        "description": job.get("note") or "",
    })
    fb.setupOS2(
        sTypoAscender=ascender, sTypoDescender=descender, sTypoLineGap=0,
        usWinAscent=max(ascender, 1), usWinDescent=max(-descender, 1),
        sCapHeight=int(metrics.get("capHeight") or round(upm * 0.7)),
        sxHeight=int(metrics.get("xHeight") or round(upm * 0.5)),
        usWeightClass=int(job.get("weightClass") or 400),
        usWidthClass=int(job.get("widthClass") or 5),
        fsType=0,
        achVendID="GENT",
    )
    fb.setupPost(isFixedPitch=0, italicAngle=0)
    font = fb.font

    if job.get("italic"):
        font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0x40) | 0x01
        font["head"].macStyle |= 0x02

    # Clipper winds holes the other way round from TrueType, and some operators
    # leave shapes touching: one pass fixes the direction and the overlaps.
    try:
        removeOverlaps(font)
    except Exception as e:  # noqa: BLE001
        raise Unbuildable(f"The outlines could not be cleaned up: {e}") from e

    kerning = job.get("kerning") or {}
    pairs = []
    for pair, value in kerning.items():
        if len(pair) == 2 and value:
            a, b = glyph_name(pair[0]), glyph_name(pair[1])
            if a in pens and b in pens:
                pairs.append(f"    pos {a} {b} {int(round(value))};")
    kern_error = None
    if pairs:
        try:
            addOpenTypeFeaturesFromString(font, "feature kern {\n" + "\n".join(pairs) + "\n} kern;\n")
        except Exception as e:  # noqa: BLE001 — a font without kerning still works, but say so
            kern_error = f"{type(e).__name__}: {e}"[:160]
            pairs = []

    fmt = job.get("format") or "ttf"
    if fmt == "otf":
        to_cff(font, family, style)  # mutates in place
    if fmt in ("woff", "woff2"):
        font.flavor = fmt

    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    check = TTFont(io.BytesIO(data))
    if check["maxp"].numGlyphs < 2:
        raise Unbuildable("The compiled font is empty")
    return data, {
        "glyphs": check["maxp"].numGlyphs,
        "kernPairs": len(pairs),
        "kerned": "GPOS" in check,
        "kernError": kern_error,
    }


def main():
    started = time.time()
    try:
        job = json.load(sys.stdin)
        data, info = build(job)
    except Unbuildable as e:
        sys.stderr.write(json.dumps({"error": str(e)}) + "\n")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(json.dumps({"error": f"{type(e).__name__}: {e}"}) + "\n")
        sys.exit(1)
    sys.stderr.write(json.dumps({"ok": True, "bytes": len(data), "seconds": round(time.time() - started, 2), **info}) + "\n")
    sys.stdout.buffer.write(data)


if __name__ == "__main__":
    main()
