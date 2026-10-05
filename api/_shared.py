"""Common ground for the Vercel functions: paths, the catalogue, and a tiny
JSON handler so each endpoint is just a function of its request body.

Files whose name starts with an underscore are not routed by Vercel, so this
module is shared code rather than an endpoint.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, "server", "masters")
sys.path.insert(0, os.path.join(ROOT, "server", "python"))

MAX_BODY = 16 << 20

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_catalog.json"), encoding="utf-8") as _fh:
    CATALOG = json.load(_fh)


class Refused(Exception):
    """A bad request: 400, never a traceback."""


def master_path(family, name):
    if family not in CATALOG:
        return None
    path = os.path.join(MASTERS, family, name)
    return path if os.path.isfile(path) else None


def licence_of(family):
    """A master's OFL.txt opens with its copyright statement."""
    path = master_path(family, "OFL.txt")
    copyright_line = ""
    if path:
        with open(path, encoding="utf-8", errors="replace") as fh:
            copyright_line = (fh.readline() or "").strip()
    return {
        "copyright": copyright_line,
        "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
                   "This license is available with a FAQ at https://openfontlicense.org",
    }


class JsonHandler(BaseHTTPRequestHandler):
    """Base for the JSON endpoints. A subclass sets `run`, and optionally
    `content_type` and `filename` when it answers with a file.

    Each endpoint declares `class handler(JsonHandler)` itself rather than
    being handed one by a factory: Vercel looks for that class statement when
    it decides whether a file is a function, and an assignment is not enough.
    """

    run = None            # staticmethod(body) -> bytes | dict
    content_type = None   # str, or a callable taking the body
    filename = None       # callable taking the body, when sending a file

    def _send(self, code, ctype, payload, headers=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(payload)

    def _error(self, code, message):
        self._send(code, "application/json", json.dumps({"error": message}).encode("utf-8"))

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self._error(413, "That project is too large")
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:  # noqa: BLE001
            return self._error(400, "That request could not be read")
        if not isinstance(body, dict):
            body = {}
        cls = type(self)
        try:
            result = cls.run(body)
        except Refused as e:
            return self._error(400, str(e))
        except Exception as e:  # noqa: BLE001 — report it, never a traceback
            return self._error(500, f"{type(e).__name__}: {e}"[:300])
        if isinstance(result, (bytes, bytearray)):
            ctype = cls.content_type(body) if callable(cls.content_type) else (cls.content_type or "application/octet-stream")
            extra = [("Content-Disposition", f'attachment; filename="{cls.filename(body)}"')] if cls.filename else []
            return self._send(200, ctype, bytes(result), extra)
        self._send(200, "application/json", json.dumps(result).encode("utf-8"))

    def log_message(self, *args):  # the platform logs the real failures
        pass
