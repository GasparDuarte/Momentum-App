"""Generate Momentum PWA icons from the logo source PNG (Pillow).

Source: assets/icons/logo-source.png  (a square neon logo on a dark background).
Run:    python tools/make_icons.py
"""
import os
from PIL import Image

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "assets", "icons")
SRC = os.path.join(OUT, "logo-source.png")


def source():
    return Image.open(SRC).convert("RGB")


def bg(img):
    return img.getpixel((3, 3))   # sample the dark corner so padding is seamless


def full(size):
    """Full-bleed icon (purpose 'any')."""
    return source().resize((size, size), Image.LANCZOS)


def maskable(size, scale=0.82):
    """Logo shrunk into the central safe zone on a solid dark square."""
    src = source()
    inner = int(size * scale)
    logo = src.resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), bg(src))
    off = (size - inner) // 2
    canvas.paste(logo, (off, off))
    return canvas


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    print("wrote", os.path.relpath(path))


save(full(512), "icon-512.png")
save(full(192), "icon-192.png")
save(maskable(512), "icon-maskable-512.png")
save(maskable(192), "icon-maskable-192.png")
save(full(180), "apple-touch-icon.png")   # iOS applies its own rounded mask
save(full(32), "favicon-32.png")
print("done")
