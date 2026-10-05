"""POST /api/outlines — the real outlines of a master, flattened to polygons."""
import os
import sys

# Vercel imports this file to find `handler`, with only the project root on
# sys.path — so the sibling module has to be made importable first.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _shared import CATALOG, JsonHandler, Refused, master_path  # noqa: F401


def run(body):
    # server/python/ arrives with the function at runtime, not while Vercel is
    # analysing this module to find `handler`: import it only when called.
    import outline_font

    family = str(body.get("family") or "")
    if family not in CATALOG:
        raise Refused(f"Unknown family “{family[:40]}”")
    italic = bool(body.get("italic")) and CATALOG[family]["italic"]
    master = master_path(family, "italic.ttf" if italic else "roman.ttf")
    if not master:
        raise Refused("That master is not installed")

    axes = {}
    for tag, (low, default, high) in CATALOG[family]["axes"].items():
        value = (body.get("axes") or {}).get(tag)
        axes[tag] = min(high, max(low, float(value))) if isinstance(value, (int, float)) else default

    chars = str(body.get("chars") or "")[:400]
    tolerance = min(4.0, max(0.3, float(body.get("tolerance") or 1.2)))
    return outline_font.extract(master, axes, chars, tolerance)


class handler(JsonHandler):
    run = staticmethod(run)
