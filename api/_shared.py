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


def json_handler(run, content_type=None, filename=None):
    """Build a Vercel handler from `run(body) -> bytes | dict`."""

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, ctype, payload, headers=()):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(payload)))
            for k, v in headers:
                self.send_header(k, v)
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
            try:
                result = run(body if isinstance(body, dict) else {})
            except Refused as e:
                return self._error(400, str(e))
            except Exception as e:  # noqa: BLE001
                return self._error(500, f"{type(e).__name__}: {e}"[:300])
            if isinstance(result, (bytes, bytearray)):
                extra = [("Content-Disposition", f'attachment; filename="{filename(body)}"')] if filename else []
                return self._send(200, content_type(body) if callable(content_type) else content_type, bytes(result), extra)
            self._send(200, "application/json", json.dumps(result).encode("utf-8"))

        def log_message(self, *args):  # keep the function logs for real errors
            pass

    return Handler
