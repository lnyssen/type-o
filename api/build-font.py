"""POST /api/build-font — pack the polygons the browser produced into a font."""
import os
import sys

# Vercel imports this file to find `handler`, with only the project root on
# sys.path — so the sibling module has to be made importable first.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _shared import CATALOG, JsonHandler, Refused, licence_of  # noqa: F401

FORMATS = ("ttf", "otf", "woff", "woff2")
CONTENT_TYPES = {"ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2"}


def name_problem(family, name):
    import re
    clean = " ".join(str(name or "").split())
    if not clean:
        return "Give your font a name."
    if not re.fullmatch(r"(?:[^\W_]|[ -]){1,40}", clean, re.UNICODE):
        return "Use letters, numbers, spaces or hyphens (max 40)."
    for bad in [CATALOG[family]["name"]] + CATALOG[family]["rfn"]:
        if bad.lower() in clean.lower():
            return f"The license reserves “{bad}”: pick a different name."
    return None


def prepare(body):
    family = str(body.get("family") or "")
    if family not in CATALOG:
        raise Refused("Unknown family")
    fmt = str(body.get("format") or "ttf").lower()
    if fmt not in FORMATS:
        raise Refused("Format must be one of " + ", ".join(FORMATS))
    problem = name_problem(family, body.get("familyName"))
    if problem:
        raise Refused(problem)
    if not (body.get("glyphs") or {}):
        raise Refused("There are no glyphs to build")
    origin = CATALOG[family]
    return {
        **body,
        "format": fmt,
        **licence_of(family),
        "note": f"{body.get('familyName')} is a Modified Version of {origin['name']} "
                f"(© {origin['credit']}), reshaped with TYPE-O. "
                "Licensed under the SIL Open Font License 1.1.",
    }


def run(body):
    # Imported here, not at module level: see the note in outlines.py.
    import build_font

    data, _info = build_font.build(prepare(body))
    return data


def file_name(body):
    clean = "".join(str(body.get("familyName") or "Untitled").split())
    style = "".join(str(body.get("styleName") or "Regular").split())
    return f"{clean}-{style}.{str(body.get('format') or 'ttf').lower()}"


class handler(JsonHandler):
    run = staticmethod(run)
    content_type = staticmethod(lambda body: CONTENT_TYPES.get(str(body.get("format") or "ttf").lower(), "font/ttf"))
    filename = staticmethod(file_name)
