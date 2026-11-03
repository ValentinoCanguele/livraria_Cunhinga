#!/usr/bin/env python3
"""Gera os ficheiros do logotipo a partir do original em docs/marca/.

O original é um JPEG achatado (azul #013766 sobre branco). Aqui é recortado,
o branco passa a transparente e o contorno é vectorizado com o potrace, para
que o logotipo escale sem se desfazer. Produz:

  logo.svg / logo-light.svg            lockup oficial (escuro / branco)
  logo-compact.svg / -light.svg        lockup para barras de 40px de altura
  logo-icon.svg / logo-icon-light.svg  só o emblema
  logo.png / logo-light.png            o mesmo em raster, com transparência
  logo-icon.png                        emblema em raster
  icons/icon-{192,512}.{svg,png}       ícones da PWA, com zona segura maskable
  og-image.png                         1200x630 para partilha em redes sociais

Correr com:  pip install potracer pillow numpy && python3 scripts/gerar-logotipo.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import numpy as np, potrace
from PIL import Image

SRC = os.path.join(ROOT, "docs/marca/livraria-adventista-original.jpeg")
INK = (1, 55, 102)              # #013766
L_INK = 0.299*INK[0] + 0.587*INK[1] + 0.114*INK[2]

im = Image.open(SRC).convert("RGB").crop((3, 3, 1597, 664))
a = np.asarray(im).astype(np.float64)
lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]

# cobertura de tinta: 0 no branco do papel, 1 no azul cheio
alpha = (255.0 - lum) / (255.0 - L_INK)
alpha = np.clip(alpha, 0.0, 1.0)
alpha[alpha < 0.06] = 0.0        # tira o ruído de JPEG no fundo
alpha[alpha > 0.96] = 1.0

FULL   = (89, 34, 1529, 630)     # x0, y0, x1, y1 (exclusivos)
EMBLEM = (89, 34, 620, 630)

def rgba(box, colour):
    x0, y0, x1, y1 = box
    sub = alpha[y0:y1, x0:x1]
    h, w = sub.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = colour
    out[..., 3] = np.round(sub * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def trace(box):
    x0, y0, x1, y1 = box
    bmp = potrace.Bitmap(alpha[y0:y1, x0:x1] <= 0.5)
    path = bmp.trace(turdsize=2, alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for curve in path:
        p = curve.start_point; sx, sy = p.x, p.y
        d.append(f"M{sx:.1f} {sy:.1f}")
        for seg in curve:
            if seg.is_corner:
                cx, cy = seg.c.x, seg.c.y; ex, ey = seg.end_point.x, seg.end_point.y
                d.append(f"L{cx:.1f} {cy:.1f}L{ex:.1f} {ey:.1f}")
            else:
                c1x, c1y = seg.c1.x, seg.c1.y; c2x, c2y = seg.c2.x, seg.c2.y; ex, ey = seg.end_point.x, seg.end_point.y
                d.append(f"C{c1x:.1f} {c1y:.1f} {c2x:.1f} {c2y:.1f} {ex:.1f} {ey:.1f}")
        d.append("Z")
    return "".join(d), x1 - x0, y1 - y0

def svg(d, w, h, colour, title, pad=0, bg=None, radius=0):
    vb = f"{-pad} {-pad} {w + 2*pad} {h + 2*pad}"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w + 2*pad}" height="{h + 2*pad}" role="img" aria-label="{title}">',
        f'<title>{title}</title>',
    ]
    if bg:
        parts.append(f'<rect x="{-pad}" y="{-pad}" width="{w + 2*pad}" height="{h + 2*pad}" rx="{radius}" fill="{bg}"/>')
    parts.append(f'<path fill="{colour}" d="{d}"/></svg>')
    return "\n".join(parts) + "\n"

NAVY = "#013766"
TITLE = "Livraria &amp; Editora Adventista S.A"
OUT = os.path.join(ROOT, "app/web/public")

d_full, wf, hf = trace(FULL)
d_emb,  we, he = trace(EMBLEM)
print("paths: full", len(d_full), "emblem", len(d_emb))

# ---- SVG vectorial ----
open(f"{OUT}/logo.svg", "w").write(svg(d_full, wf, hf, NAVY, TITLE))
open(f"{OUT}/logo-light.svg", "w").write(svg(d_full, wf, hf, "#ffffff", TITLE))
open(f"{OUT}/logo-icon.svg", "w").write(svg(d_emb, we, he, NAVY, TITLE))
open(f"{OUT}/logo-icon-light.svg", "w").write(svg(d_emb, we, he, "#ffffff", TITLE))

# ícones PWA maskable: emblema sobre branco com zona segura
pad = int(round(max(we, he) * 0.22))
side = max(we, he) + 2*pad
ox, oy = (side - we)//2 - pad, (side - he)//2 - pad
icon_svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" width="{side}" height="{side}" '
    f'role="img" aria-label="Livraria Adventista">\n<title>Livraria Adventista</title>\n'
    f'<rect width="{side}" height="{side}" fill="#ffffff"/>\n'
    f'<g transform="translate({ox + pad} {oy + pad})"><path fill="{NAVY}" d="{d_emb}"/></g></svg>\n'
)
for n in (192, 512):
    open(f"{OUT}/icons/icon-{n}.svg", "w").write(icon_svg)

# ---- PNG ----
full_navy = rgba(FULL, INK)
emb_navy  = rgba(EMBLEM, INK)
full_navy.save(f"{OUT}/logo.png")
rgba(FULL, (255, 255, 255)).save(f"{OUT}/logo-light.png")
rgba(EMBLEM, INK).save(f"{OUT}/logo-icon.png")

def icon_png(size):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    inner = int(size * 0.62)
    scaled = emb_navy.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width)//2, (size - scaled.height)//2))
    return canvas

for n in (192, 512):
    icon_png(n).save(f"{OUT}/icons/icon-{n}.png")

# ---- imagem de partilha (og) 1200x630, fundo branco ----
og = Image.new("RGBA", (1200, 630), (255, 255, 255, 255))
lock = full_navy.copy()
lock.thumbnail((940, 420), Image.LANCZOS)
og.alpha_composite(lock, ((1200 - lock.width)//2, (630 - lock.height)//2))
og.convert("RGB").save(f"{OUT}/og-image.png", quality=95)

print("full", full_navy.size, "emblema", emb_navy.size)

# ---- Lockup compacto: o oficial fica ilegível a 40px de altura no cabeçalho,
#      porque o texto ocupa só 28% da altura. Aqui o emblema mantém-se e a
#      assinatura é redesenhada maior ao lado, centrada no mesmo eixo.
TEXT = (705, 248, 1529, 415)
d_text, wt, ht = trace(TEXT)
SCALE = 417.0 / ht            # assinatura a 70% da altura do emblema
GAP = 130
tx = we + GAP
ty = (he - ht * SCALE) / 2.0
W = tx + wt * SCALE

def compact(colour, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {he}" width="{W:.0f}" height="{he}" '
        f'role="img" aria-label="{title}">\n<title>{title}</title>\n'
        f'<g fill="{colour}">'
        f'<path d="{d_emb}"/>'
        f'<g transform="translate({tx:.1f} {ty:.1f}) scale({SCALE:.4f})"><path d="{d_text}"/></g>'
        f'</g></svg>\n'
    )

open(f"{OUT}/logo-compact.svg", "w").write(compact(NAVY, TITLE))
open(f"{OUT}/logo-compact-light.svg", "w").write(compact("#ffffff", TITLE))
print("compacto", f"{W:.0f}x{he}", "ratio", round(W/he, 2))
