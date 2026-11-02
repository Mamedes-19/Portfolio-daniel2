#!/usr/bin/env python3
"""Gera os picos de amplitude (forma de onda) de um áudio para o player do site.

Uso:
    python3 scripts/gerar-ondas.py public/audio/audiobook-01.mp3 --barras 200 > src/data/ondas-audiobook-01.json

Requer: ffmpeg e numpy. O resultado é um JSON com {duracao, barras, picos}, onde cada pico
vai de 0 a 1 (volume relativo daquele trecho). Esses valores desenham a onda do player.
"""
import argparse
import json
import subprocess
import sys

import numpy as np


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arquivo", help="caminho do áudio (mp3, wav, m4a...)")
    ap.add_argument("--barras", type=int, default=200, help="quantidade de barras (padrão: 200)")
    a = ap.parse_args()

    taxa = 8000
    bruto = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", a.arquivo, "-ac", "1", "-ar", str(taxa), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    x = np.frombuffer(bruto, dtype="<f4")
    n = a.barras
    limites = np.linspace(0, len(x), n + 1, dtype=int)
    rms = np.array([
        np.sqrt(np.mean(x[limites[i]:limites[i + 1]] ** 2)) if limites[i + 1] > limites[i] else 0.0
        for i in range(n)
    ])
    ref = float(np.percentile(rms, 98)) or 1.0
    picos = np.clip(rms / ref, 0, 1) ** 0.6  # compressão leve: equilibra trechos baixos e altos

    saida = {
        "duracao": round(len(x) / taxa, 2),
        "barras": n,
        "picos": [round(float(v), 3) for v in picos],
    }
    json.dump(saida, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    print(f"min={picos.min():.3f} media={picos.mean():.3f} max={picos.max():.3f} duracao={saida['duracao']}s", file=sys.stderr)


if __name__ == "__main__":
    main()
