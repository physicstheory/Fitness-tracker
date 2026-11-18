"""Builds the watch app's bitmap fonts (BMFont .fnt + .png) from the phone app's typefaces.

Unbounded (display) and Manrope (body) come from the @fontsource-variable packages.
Fonts are rendered for each screen size the app supports, scaled from a 360 px design.
Run from the repo root after `npm install`:  python3 garmin/tools/make_fonts.py
"""
import io
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
NM = os.path.join(ROOT, "..", "node_modules", "@fontsource-variable")
ASCII = "".join(chr(c) for c in range(32, 127)) + "·"
DIGITS = "0123456789:/-+x "

# id: (family, weight, size at 360 px, characters)
FONTS = {
    "Huge": ("unbounded", 700, 66, DIGITS),
    "Big": ("unbounded", 700, 46, DIGITS),
    "Title": ("unbounded", 650, 25, ASCII),
    "Caps": ("unbounded", 600, 13, ASCII),
    "Body": ("manrope", 650, 21, ASCII),
    "Small": ("manrope", 600, 16, ASCII),
}

# Folder suffix -> screen width. "" is the default set (360 px, e.g. Forerunner 265S).
SCREENS = {"": 360, "-round-240x240": 240, "-round-260x260": 260, "-round-280x280": 280,
           "-round-390x390": 390, "-round-416x416": 416, "-round-454x454": 454}

_cache = {}


def static_font(family, weight):
    key = (family, weight)
    if key not in _cache:
        tt = TTFont(os.path.join(NM, family, "files", f"{family}-latin-wght-normal.woff2"))
        tt.flavor = None
        inst = instancer.instantiateVariableFont(tt, {"wght": weight})
        buf = io.BytesIO()
        inst.save(buf)
        _cache[key] = buf.getvalue()
    return _cache[key]


def build(name, family, weight, size, chars, out_dir):
    font = ImageFont.truetype(io.BytesIO(static_font(family, weight)), size)
    ascent, descent = font.getmetrics()
    glyphs = []
    for ch in chars:
        l, t, r, b = font.getbbox(ch)
        w, h = max(r - l, 1), max(b - t, 1)
        img = Image.new("RGBA", (w + 2, h + 2), (255, 255, 255, 0))
        ImageDraw.Draw(img).text((1 - l, 1 - t), ch, font=font, fill=(255, 255, 255, 255))
        glyphs.append((ch, img, l - 1, t - 1, round(font.getlength(ch))))
    # Pack into rows.
    width = 512
    x = y = row = 0
    places = []
    for g in glyphs:
        gw, gh = g[1].size
        if x + gw > width:
            x, y, row = 0, y + row + 1, 0
        places.append((x, y))
        x += gw + 1
        row = max(row, gh)
    height = y + row + 1
    atlas = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    lines = [f'info face="{family}" size={size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1',
             f"common lineHeight={ascent + descent} base={ascent} scaleW={width} scaleH={height} pages=1 packed=0",
             f'page id=0 file="{name}.png"', f"chars count={len(glyphs)}"]
    for (ch, img, xo, yo, adv), (px, py) in zip(glyphs, places):
        atlas.paste(img, (px, py))
        lines.append(f"char id={ord(ch)} x={px} y={py} width={img.size[0]} height={img.size[1]} xoffset={xo} yoffset={yo} xadvance={adv} page=0 chnl=15")
    atlas.save(os.path.join(out_dir, f"{name}.png"))
    with open(os.path.join(out_dir, f"{name}.fnt"), "w") as f:
        f.write("\n".join(lines) + "\n")


for suffix, px in SCREENS.items():
    out = os.path.join(ROOT, f"resources{suffix}", "fonts")
    os.makedirs(out, exist_ok=True)
    xml = ["<fonts>"]
    for name, (family, weight, size, chars) in FONTS.items():
        fname = name.lower()
        build(fname, family, weight, max(8, round(size * px / 360)), chars, out)
        xml.append(f'    <font id="{name}" filename="{fname}.fnt" antialias="true" />')
    xml.append("</fonts>")
    with open(os.path.join(out, "fonts.xml"), "w") as f:
        f.write("\n".join(xml) + "\n")
    print("built", out)
