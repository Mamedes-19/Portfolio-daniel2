#!/usr/bin/env python3
"""Gera as fontes WOFF2 do site (Literata e Hanken Grotesk, licença OFL), só com os caracteres do português.

Você só precisa disto se quiser trocar de fonte. As fontes prontas já estão em public/fonts.

Uso:
    pip install fonttools brotli
    FONTES_OFL=/caminho/para/google-fonts/ofl python3 scripts/subset-fontes.py

(FONTES_OFL é a pasta "ofl" do repositório https://github.com/google/fonts)
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFL = os.environ["FONTES_OFL"]
SAIDA = os.path.join(RAIZ, "public", "fonts")
os.makedirs(SAIDA, exist_ok=True)

# Letras, números, pontuação e aspas do português (inclui acentos e cedilha).
UNICODES = (
    set(range(0x20, 0x7F))
    | set(range(0xA0, 0x100))
    | {0x2009, 0x200A, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201A, 0x201C,
       0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x202F, 0x2032, 0x2033, 0x2039, 0x203A, 0x2212}
)
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "pnum", "lnum", "onum", "case", "frac", "ordn"]


def gerar(origem: str, destino: str, limites: dict | None) -> None:
    fonte = TTFont(os.path.join(OFL, origem))
    o = subset.Options()
    o.layout_features = FEATURES
    o.hinting = False
    o.notdef_outline = True
    o.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    o.glyph_names = False
    s = subset.Subsetter(o)
    s.populate(unicodes=UNICODES)
    s.subset(fonte)  # 1º recorta os caracteres...
    if limites:
        fonte = instancer.instantiateVariableFont(fonte, limites)  # ...2º limita os eixos (a ordem inversa quebra o fontTools)
    fonte.flavor = "woff2"
    caminho = os.path.join(SAIDA, destino)
    fonte.save(caminho)
    print("%-28s %7.1f KB" % (destino, os.path.getsize(caminho) / 1024))


gerar("literata/Literata[opsz,wght].ttf", "literata-var.woff2", {"wght": (400, 600)})
gerar("literata/Literata-Italic[opsz,wght].ttf", "literata-italic.woff2", {"wght": 400})
gerar("hankengrotesk/HankenGrotesk[wght].ttf", "hanken-grotesk-var.woff2", {"wght": (400, 600)})
