"""Vercel serverless function: the whole TYPE-O export API.

On Vercel there is no long-running Node process to spawn Python from, so this
function does what server/index.js does locally — validate the project, pick
the master, instantiate it — and calls the same server/python/instance_font.py.
Python cannot import shared/catalog.js, so the few fields it needs live in the
generated api/_catalog.json — test/vercel.test.mjs fails if it drifts from the
JavaScript, and asserts both sides name and refuse projects identically.

    GET  /api/export-font   → health
    POST /api/export-font   → {project, format} → the font binary
"""

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, "server", "masters")
sys.path.insert(0, os.path.join(ROOT, "server", "python"))

import instance_font  # noqa: E402  (after sys.path)

FORMATS = ("ttf", "otf", "woff", "woff2")
CONTENT_TYPES = {"ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2"}
MAX_BODY = 1 << 20

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_catalog.json"), encoding="utf-8") as _fh:
    CATALOG = json.load(_fh)

# Mirrors styleOf() in shared/project.js — test/vercel.test.mjs keeps them equal.
WEIGHT_NAMES = ((150, "Thin"), (250, "ExtraLight"), (350, "Light"), (450, "Regular"), (550, "Medium"),
                (650, "SemiBold"), (750, "Bold"), (850, "ExtraBold"), (float("inf"), "Black"))
WIDTH_CLASSES = ((56, 1), (69, 2), (81, 3), (94, 4), (106, 5), (119, 6), (137, 7), (175, 8), (float("inf"), 9))
WIDTH_NAMES = {1: "UltraCondensed", 2: "ExtraCondensed", 3: "Condensed", 4: "SemiCondensed",
               6: "SemiExpanded", 7: "Expanded", 8: "ExtraExpanded", 9: "UltraExpanded"}


class Refused(Exception):
    """A bad request: reported as 400, never as a crash."""


def master_path(family, name):
    if family not in CATALOG:
        return None
    path = os.path.join(MASTERS, family, name)
    return path if os.path.isfile(path) else None


def families():
    return sorted(f for f in CATALOG if master_path(f, "roman.ttf"))


# Mirrors nameProblem() in shared/catalog.js.
NAME_OK = re.compile(r"(?:[^\W_]|[ -]){1,40}\Z", re.UNICODE)  # == /^[\p{L}\p{N} \-]{1,40}$/u


def name_problem(family, name):
    clean = " ".join(str(name or "").split())
    if not clean:
        return "Give your font a name."
    if not NAME_OK.fullmatch(clean):
        return "Use letters, numbers, spaces or hyphens (max 40)."
    for bad in [CATALOG[family]["name"]] + CATALOG[family]["rfn"]:
        if bad.lower() in clean.lower():
            return "The license reserves \u201c%s\u201d: pick a different name." % bad
    return None


def clamp(value, low, high, default):
    try:
        return min(high, max(low, float(value)))
    except (TypeError, ValueError):
        return default


def style_of(axes, italic):
    wght = clamp(axes.get("wght", 400), 1, 1000, 400)
    weight_name = next(name for limit, name in WEIGHT_NAMES if wght < limit)
    weight_class = min(900, max(100, int(round(wght / 100.0)) * 100))
    width_class = 5
    if axes.get("wdth") is not None:
        width_class = next(cls for limit, cls in WIDTH_CLASSES if clamp(axes["wdth"], 1, 1000, 100) < limit)
    parts = [p for p in (WIDTH_NAMES.get(width_class), weight_name) if p]
    style = " ".join(p for p in parts if p != "Regular" or len(parts) == 1)
    if italic:
        style = "Italic" if style == "Regular" else style + " Italic"
    return style, weight_class, width_class


def build(body):
    fmt = str(body.get("format") or "ttf").lower()
    if fmt not in FORMATS:
        raise Refused("Format must be one of " + ", ".join(FORMATS))

    project = body.get("project") or {}
    family = str(project.get("family") or "")
    if family not in families():
        raise Refused("Unknown family “%s”" % family[:40])

    name = " ".join(str(project.get("name") or "").split())[:40] or "Untitled"  # parseProject() coerces the same way
    problem = name_problem(family, name)
    if problem:
        raise Refused(problem)

    # Mirrors normalizeAxes(): every axis of the family, clamped, defaults filled.
    sent = project.get("axes") or {}
    axes = {}
    for tag, (low, default, high) in CATALOG[family]["axes"].items():
        axes[tag] = clamp(sent.get(tag), low, high, default)

    italic = bool(project.get("italic")) and CATALOG[family]["italic"] and master_path(family, "italic.ttf") is not None
    oblique = 0.0 if italic else clamp(project.get("oblique"), 0, 14, 0)
    tracking = round(clamp(project.get("tracking"), -80, 200, 0))
    version = str(project.get("version") or "1.000")
    if not re.fullmatch(r"\d+\.\d{1,3}", version):
        version = "1.000"

    style, weight_class, width_class = style_of(axes, italic or oblique > 0)
    origin = CATALOG[family]
    payload = {
        "master": master_path(family, "italic.ttf" if italic else "roman.ttf"),
        "format": fmt,
        "familyName": name,
        "styleName": style,
        "weightClass": weight_class,
        "widthClass": width_class,
        "italic": italic or oblique > 0,
        "version": version,
        "axes": axes,
        "oblique": oblique,
        "tracking": tracking,
        "note": "%s is a Modified Version of %s (\u00a9 %s), generated with TYPE-O. "
                "Licensed under the SIL Open Font License 1.1." % (name, origin["name"], origin["credit"]),
    }
    filename = "%s-%s.%s" % (name.replace(" ", ""), style.replace(" ", ""), fmt)
    return payload, filename, fmt


class handler(BaseHTTPRequestHandler):
    def _send(self, code, content_type, body, headers=()):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, data):
        self._send(code, "application/json", json.dumps(data).encode("utf-8"))

    def do_GET(self):
        import fontTools

        installed = set(families())
        self._json(200, {
            "ok": True,
            "python": {"ok": True, "bin": sys.executable, "fontTools": fontTools.version},
            "formats": list(FORMATS),
            "missingMasters": [f for f in CATALOG if f not in installed],
        })

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self._json(413, {"error": "That project is too large"})
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
            payload, filename, fmt = build(body if isinstance(body, dict) else {})
        except Refused as e:
            return self._json(400, {"error": str(e)})
        except Exception:
            return self._json(400, {"error": "That project could not be read"})
        try:
            data = instance_font.build(payload)
        except instance_font.Unbuildable as e:
            return self._json(400, {"error": str(e)})
        except Exception as e:  # report it, but never leak a traceback
            return self._json(500, {"error": str(e)[:300] or "The font could not be compiled"})
        self._send(200, CONTENT_TYPES[fmt], data, [("Content-Disposition", 'attachment; filename="%s"' % filename)])
