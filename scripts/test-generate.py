import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
payload = {
    "name": "ANTONIO",
    "subtitle": "MEXICO",
    "balance": "0.00",
    "account": "140000",
    "phone": "5555555500",
    "movements": [
        {"title": "REBEL WINGS", "date": "2026-06-14", "amount": "456.00", "type": "negative", "reference": "9267919", "location": "CIUDAD DE MEX"},
        {"title": "Transferencia", "date": "2026-06-14", "amount": "500.00", "type": "positive", "reference": "", "location": ""},
        {"title": "METROBUSL1PA", "date": "2026-06-15", "amount": "6.00", "type": "negative", "reference": "8673274", "location": "CIUDAD DE MEX"},
        {"title": "SUPERVASCO D", "date": "2026-06-15", "amount": "38.00", "type": "negative", "reference": "4651485", "location": "MEXICO DF"},
    ],
}

proc = subprocess.run(
    [sys.executable, str(ROOT / "scripts" / "generate-statement.py")],
    input=json.dumps(payload).encode("utf-8"),
    capture_output=True,
    cwd=str(ROOT),
)

out = ROOT / "test-output.pdf"
out.write_bytes(proc.stdout)
print("exit", proc.returncode, "bytes", len(proc.stdout))
if proc.stderr:
    print(proc.stderr.decode())