"""Vercel serverless endpoint for personalized account-statement PDFs."""
from __future__ import annotations

import importlib.util
import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
GENERATOR_PATH = ROOT / "scripts" / "generate-statement.py"

spec = importlib.util.spec_from_file_location("statement_generator", GENERATOR_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("No se pudo cargar el generador de estados de cuenta")

generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            pdf = generator.generate_pdf(payload)

            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="EstadoCuenta.pdf"')
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(pdf)))
            self.end_headers()
            self.wfile.write(pdf)
        except Exception as exc:
            message = str(exc).encode("utf-8", errors="replace")
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)

