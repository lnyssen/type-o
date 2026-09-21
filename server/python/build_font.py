#!/usr/bin/env python3
"""Compile a GenType export payload (JSON on stdin) into a font binary (stdout).

The JS engine already produced spaced, fitted Bézier outlines. Here we:
  * remove overlaps between stroke pieces (skia-pathops),
  * convert to quadratic curves for TrueType (cu2qu) or keep cubics for CFF,
  * write every table a desktop/web font needs, plus kern + liga features,
  * re-open the result as a sanity check before emitting it.

Errors are reported as a single JSON line on stderr with exit code 1.
"""
import io
import json
import re
import sys
import time

import pathops
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.roundingPen import RoundingPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

RIBBI = {"Regular", "Bold"}


def fail(message, code=1):
    sys.stderr.write(json.dumps({"error": message}) + "\n")
    sys.exit(code)


def to_path(contours):
    path = pathops.Path()
    pen = path.getPen()
    for c in contours:
        pen.moveTo(tuple(c["start"]))
        for s in c["segs"]:
            if s[0] == "L":
                pen.lineTo((s[1], s[2]))
            else:
                pen.curveTo((s[1], s[2]), (s[3], s[4]), (s[5], s[6]))
        pen.closePath()
    return path


def clean_path(contours, clockwise):
    path = to_path(contours)
    try:
        return pathops.simplify(path, fix_winding=True, keep_starting_points=False, clockwise=clockwise)
    except pathops.PathOpsError:
        # Extremely rare numerical failure: keep the overlapping outline,
        # which still renders correctly with nonzero winding.
        return path


def notdef_contours(width, height):
    m = 50
    t = 40
    outer = [(m, 0), (width - m, 0), (width - m, height), (m, height)]
    inner = [(m + t, t), (m + t, height - t), (width - m - t, height - t), (width - m - t, t)]
    return [
        {"start": list(outer[0]), "segs": [["L", *p] for p in outer[1:]]},
        {"start": list(inner[0]), "segs": [["L", *p] for p in inner[1:]]},
    ]


def ps_name(family, style):
    base = re.sub(r"[^A-Za-z0-9-]", "", family) or "Untitled"
    return f"{base}-{re.sub(r'[^A-Za-z0-9]', '', style)}"[:63]


def feature_code(payload, glyph_names):
    lines = ["languagesystem DFLT dflt;", "languagesystem latn dflt;", ""]
    kerning = payload.get("kerning") or {}
    classes = kerning.get("classes") or {}
    pairs = kerning.get("pairs") or []
    safe = {}
    for i, (rep, members) in enumerate(sorted(classes.items())):
        members = [m for m in members if m in glyph_names]
        if not members:
            continue
        safe[rep] = f"@k{i}"
        lines.append(f"{safe[rep]} = [{' '.join(members)}];")
    kern_lines = [
        f"    pos {safe[a]} {safe[b]} {int(v)};" for a, b, v in pairs if a in safe and b in safe and int(v) != 0
    ]
    if kern_lines:
        lines += ["", "feature kern {"] + kern_lines + ["} kern;"]
    ligs = [(lig, parts) for lig, parts in payload.get("ligatures") or [] if lig in glyph_names and all(p in glyph_names for p in parts)]
    if ligs:
        lines += ["", "feature liga {"]
        for lig, parts in sorted(ligs, key=lambda x: -len(x[1])):
            lines.append(f"    sub {' '.join(parts)} by {lig};")
        lines.append("} liga;")
    return "\n".join(lines) + "\n"


def build(payload):
    fmt = payload["format"]
    is_ttf = fmt in ("ttf", "woff", "woff2")
    upm = int(payload.get("upm", 1000))
    family = payload["familyName"]
    style = payload["styleName"]
    asc, desc = int(payload["ascender"]), int(payload["descender"])

    glyphs = payload["glyphs"]
    if not glyphs:
        fail("No glyphs to compile")
    order = [".notdef"] + [g["name"] for g in glyphs]
    if len(set(order)) != len(order):
        fail("Duplicate glyph names in payload")

    cmap = {}
    for g in glyphs:
        for u in g.get("unicodes") or []:
            cmap[int(u)] = g["name"]

    outlines = {".notdef": (500, notdef_contours(500, asc))}
    for g in glyphs:
        outlines[g["name"]] = (int(g["advance"]), g["contours"])

    fb = FontBuilder(upm, isTTF=is_ttf)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)

    metrics = {}
    y_min, y_max = 0, 0
    if is_ttf:
        ttglyphs = {}
        for name in order:
            adv, contours = outlines[name]
            pen = TTGlyphPen(None)
            if contours:
                clean_path(contours, clockwise=True).draw(Cu2QuPen(RoundingPen(pen), max_err=1.0, reverse_direction=False))
            ttglyphs[name] = pen.glyph()
        fb.setupGlyf(ttglyphs)
        glyf = fb.font["glyf"]
        for name in order:
            gl = glyf[name]
            gl.recalcBounds(glyf)
            has = gl.numberOfContours != 0
            metrics[name] = (outlines[name][0], gl.xMin if has else 0)
            if has:
                y_min, y_max = min(y_min, gl.yMin), max(y_max, gl.yMax)
    else:
        charstrings = {}
        for name in order:
            adv, contours = outlines[name]
            pen = T2CharStringPen(adv, None)
            bp = BoundsPen(None)
            if contours:
                p = clean_path(contours, clockwise=False)
                p.draw(RoundingPen(pen))
                p.draw(RoundingPen(bp))
            charstrings[name] = pen.getCharString()
            if bp.bounds:
                x0, y0, _, y1 = bp.bounds
                metrics[name] = (adv, int(round(x0)))
                y_min, y_max = min(y_min, int(round(y0))), max(y_max, int(round(y1)))
            else:
                metrics[name] = (adv, 0)
        fb.setupCFF(ps_name(family, style), {"FullName": f"{family} {style}", "FamilyName": family, "Weight": style}, charstrings, {})
        # Alignment zones and stem hints, set on the Private dict itself:
        # fontBuilder's privateDict argument mis-encodes these arrays.
        os_ = int(payload.get("overshoot", 10))
        xh, ch = int(payload["xHeight"]), int(payload["capHeight"])
        pd = fb.font["CFF "].cff[0].Private
        pd.BlueValues = sorted({-os_, 0, xh, xh + os_, ch, ch + os_})
        if desc < -os_:
            pd.OtherBlues = [desc - os_, desc]
        pd.StdVW = int(payload.get("stem", 80))
        pd.StdHW = max(10, int(int(payload.get("stem", 80)) * 0.8))

    fb.setupHorizontalMetrics(metrics)

    win_asc = max(y_max, asc)
    win_desc = max(-y_min, -desc)
    line_gap = max(0, (win_asc + win_desc) - (asc - desc))
    fb.setupHorizontalHeader(ascent=win_asc, descent=-win_desc, lineGap=0)

    ribbi = style in RIBBI
    name_family = family if ribbi else f"{family} {style}"
    name_style = style if ribbi else "Regular"
    version = str(payload.get("version") or "1.0")
    if not re.match(r"^\d+(\.\d+)?$", version):
        version = "1.0"
    names = {
        "familyName": name_family,
        "styleName": name_style,
        "uniqueFontIdentifier": f"{version};GENT;{ps_name(family, style)}",
        "fullName": f"{family} {style}",
        "psName": ps_name(family, style),
        "version": f"Version {float(version):.3f}",
        "manufacturer": "Generated with GenType",
        "description": "Generated with GenType, an open-source parametric type generator.",
        "licenseDescription": "Generated font. You own the output of GenType; the tool itself is MIT licensed.",
    }
    if not ribbi:
        names["typographicFamily"] = family
        names["typographicSubfamily"] = style
    fb.setupNameTable(names)

    fs_selection = (1 << 7) | ((1 << 5) if style == "Bold" else (1 << 6) if style == "Regular" else 0)
    fb.setupOS2(
        version=4,
        usWeightClass=int(payload.get("weightClass", 400)),
        usWidthClass=int(payload.get("widthClass", 5)),
        fsType=0,
        achVendID="GENT",
        fsSelection=fs_selection,
        sTypoAscender=asc,
        sTypoDescender=desc,
        sTypoLineGap=line_gap,
        usWinAscent=win_asc,
        usWinDescent=win_desc,
        sxHeight=int(payload["xHeight"]),
        sCapHeight=int(payload["capHeight"]),
        usDefaultChar=0,
        usBreakChar=32,
        usMaxContext=3,
    )
    fb.setupPost(underlinePosition=-int(upm * 0.1), underlineThickness=max(20, int(payload.get("stem", 80) * 0.5)))
    fb.font["head"].fontRevision = float(version)
    if style == "Bold":
        fb.font["head"].macStyle = 1
    fb.font["OS/2"].recalcUnicodeRanges(fb.font)
    fb.font["OS/2"].recalcCodePageRanges(fb.font)

    fea = feature_code(payload, set(order))
    addOpenTypeFeaturesFromString(fb.font, fea)

    if fmt in ("woff", "woff2"):
        fb.font.flavor = fmt
    buf = io.BytesIO()
    fb.font.save(buf)
    data = buf.getvalue()

    # Sanity check: the binary must load and every glyph must be reachable.
    check = TTFont(io.BytesIO(data))
    gs = check.getGlyphSet()
    missing = [n for n in order if n not in gs]
    if missing:
        fail(f"Compiled font is missing glyphs: {missing[:5]}")
    return data


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as e:  # noqa: BLE001
        fail(f"Invalid JSON payload: {e}")
    if payload.get("format") not in ("ttf", "otf", "woff", "woff2"):
        fail("Unsupported format")
    started = time.time()
    try:
        data = build(payload)
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        fail(f"{type(e).__name__}: {e}")
    sys.stderr.write(json.dumps({"ok": True, "bytes": len(data), "seconds": round(time.time() - started, 2)}) + "\n")
    sys.stdout.buffer.write(data)


if __name__ == "__main__":
    main()
