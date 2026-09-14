import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

LOGO_PATH = sys.argv[1]
OUT_DIR = sys.argv[2]

FD = "C:/Windows/Fonts/"

# New palette: violet -> magenta -> near-black, distinct from the previous navy/indigo cover.
DARK = (12, 8, 20)
VIOLET = (91, 33, 182)
MAGENTA = (219, 39, 119)
NEAR_BLACK = (8, 6, 14)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_background(w, h):
    bg = Image.new("RGB", (w, h))
    px = bg.load()
    for y in range(h):
        ty = y / h
        for x in range(0, w, 2):
            tx = x / w
            t = max(0.0, min(1.0, tx * 0.7 + ty * 0.5))
            col = lerp(NEAR_BLACK, VIOLET, min(1.0, t / 0.55)) if t < 0.55 else lerp(
                VIOLET, MAGENTA, (t - 0.55) / 0.45
            )
            px[x, y] = col
            if x + 1 < w:
                px[x + 1, y] = col

    # Soft top-left dark vignette + bottom-right warm glow for depth.
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-w * 0.3, -h * 0.5, w * 0.55, h * 0.75], fill=DARK)
    gd.ellipse([w * 0.55, h * 0.25, w * 1.35, h * 1.5], fill=(255, 111, 97))
    glow = glow.filter(ImageFilter.GaussianBlur(int(min(w, h) * 0.18)))
    bg = Image.blend(bg, glow, 0.35)

    # Diagonal light streaks.
    streaks = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(streaks)
    band_w = int(w * 0.09)
    for i in range(-2, 8):
        x0 = int(i * band_w * 1.8)
        sd.polygon(
            [(x0, h), (x0 + band_w, h), (x0 + band_w + h, 0), (x0 + h, 0)],
            fill=(255, 255, 255, 8),
        )
    bg = bg.convert("RGBA")
    bg.alpha_composite(streaks)

    # Fine dot grid.
    dots = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    step = max(28, int(min(w, h) * 0.032))
    for gy in range(0, h, step):
        for gx in range(0, w, step):
            dd.ellipse([gx, gy, gx + 2, gy + 2], fill=(255, 255, 255, 18))
    bg.alpha_composite(dots)

    return bg


def rounded_pill(draw_target, text, font, fg, fill_rgba, border_rgba, height=40):
    tmp = Image.new("RGBA", (1, 1))
    td = ImageDraw.Draw(tmp)
    tw = td.textlength(text, font=font)
    pad_x = 22
    bw = int(tw + pad_x * 2)
    pill = Image.new("RGBA", (bw, height), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([0, 0, bw - 1, height - 1], radius=height // 2, outline=border_rgba, width=2, fill=fill_rgba)
    pd.text((pad_x, (height - font.size) // 2 - 2), text, font=font, fill=fg)
    return pill, bw


def draw_rich_line(draw, parts, x, y):
    cx = x
    for text, font, color in parts:
        draw.text((cx, y), text, font=font, fill=color)
        cx += draw.textlength(text, font=font)
    return cx


BADGES = [
    ("Not an ORM", (255, 200, 213), (219, 39, 119, 40), (255, 111, 155, 160)),
    ("Signals-native", (223, 210, 255), (139, 92, 246, 45), (196, 165, 255, 160)),
    ("Open Source", (255, 255, 255), (255, 255, 255, 18), (255, 255, 255, 90)),
]


def add_cta_chip(bg, x, y, font):
    label = "npm install ng-ql"
    pad_x, pad_y = 22, 12
    tmp = Image.new("RGBA", (1, 1))
    td = ImageDraw.Draw(tmp)
    tw = td.textlength(label, font=font)
    bw, bh = int(tw + pad_x * 2), int(font.size + pad_y * 2)
    chip = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chip)
    cd.rounded_rectangle([0, 0, bw - 1, bh - 1], radius=10, fill=(255, 255, 255, 235))
    cd.ellipse([pad_x - 16, bh // 2 - 4, pad_x - 8, bh // 2 + 4], fill=(219, 39, 119, 255))
    cd.text((pad_x, pad_y - 1), label, font=font, fill=(30, 12, 40))
    bg.alpha_composite(chip, (x, y))
    return bw, bh


def load_logo(size):
    logo = Image.open(LOGO_PATH).convert("RGBA")
    return logo.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------------
# 1) Instagram square post — 1080x1080, centered poster layout
# ---------------------------------------------------------------------
def make_square():
    W = H = 1080
    bg = make_background(W, H)
    draw = ImageDraw.Draw(bg)

    title_font = ImageFont.truetype(FD + "segoeuib.ttf", 96)
    tag_font = ImageFont.truetype(FD + "segoeui.ttf", 30)
    tag_font_b = ImageFont.truetype(FD + "seguisb.ttf", 30)
    badge_font = ImageFont.truetype(FD + "segoeuib.ttf", 18)
    mono_font = ImageFont.truetype(FD + "consola.ttf", 19)

    logo_size = 300
    logo = load_logo(logo_size)
    logo_x = (W - logo_size) // 2
    logo_y = 120
    bg.alpha_composite(logo, (logo_x, logo_y))

    title = "ng-ql"
    tw = draw.textlength(title, font=title_font)
    title_y = logo_y + logo_size + 28
    draw.text(((W - tw) / 2, title_y), title, font=title_font, fill=(255, 255, 255))

    line1 = [("An ", tag_font, (232, 224, 250)), ("Eloquent-inspired", tag_font_b, (255, 255, 255)),
             (" query builder", tag_font, (232, 224, 250))]
    line2 = [("for ", tag_font, (232, 224, 250)), ("Angular", tag_font_b, (255, 255, 255))]
    l1w = sum(draw.textlength(t, font=f) for t, f, _ in line1)
    l2w = sum(draw.textlength(t, font=f) for t, f, _ in line2)
    tag_y = title_y + 118
    draw_rich_line(draw, line1, (W - l1w) / 2, tag_y)
    draw_rich_line(draw, line2, (W - l2w) / 2, tag_y + 42)

    badge_y = tag_y + 108
    pills = [rounded_pill(draw, label, badge_font, fg, fill, border) for label, fg, fill, border in BADGES]
    total_w = sum(p[1] for p in pills) + 16 * (len(pills) - 1)
    bx = (W - total_w) / 2
    for pill, bw in pills:
        bg.alpha_composite(pill, (int(bx), badge_y))
        bx += bw + 16

    cta_text = "npm install ng-ql"
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    ctw = tmp.textlength(cta_text, font=mono_font)
    chip_w = int(ctw + 44 + 8)
    chip_h = int(mono_font.size + 24)
    add_cta_chip(bg, int((W - chip_w) / 2), badge_y + 76, mono_font)

    footer_font = ImageFont.truetype(FD + "segoeui.ttf", 20)
    footer = "github.com/Hkarimi561/ng-ql"
    fw = draw.textlength(footer, font=footer_font)
    draw.text(((W - fw) / 2, H - 70), footer, font=footer_font, fill=(255, 255, 255, 150))

    bg.convert("RGB").save(f"{OUT_DIR}/ng-ql-instagram-square.png", "PNG")


# ---------------------------------------------------------------------
# 2) LinkedIn feed post — 1200x627, horizontal layout
# ---------------------------------------------------------------------
def make_linkedin_post():
    W, H = 1200, 627
    bg = make_background(W, H)
    draw = ImageDraw.Draw(bg)

    title_font = ImageFont.truetype(FD + "segoeuib.ttf", 68)
    tag_font = ImageFont.truetype(FD + "segoeui.ttf", 26)
    tag_font_b = ImageFont.truetype(FD + "seguisb.ttf", 26)
    badge_font = ImageFont.truetype(FD + "segoeuib.ttf", 17)
    mono_font = ImageFont.truetype(FD + "consola.ttf", 18)

    logo_size = 220
    logo = load_logo(logo_size)
    logo_x, logo_y = 90, (H - logo_size) // 2 - 20
    bg.alpha_composite(logo, (logo_x, logo_y))

    text_x = logo_x + logo_size + 64
    title_y = 150
    draw.text((text_x, title_y), "ng-ql", font=title_font, fill=(255, 255, 255))

    line1 = [("An ", tag_font, (232, 224, 250)), ("Eloquent-inspired", tag_font_b, (255, 255, 255)),
             (" HTTP query builder for Angular —", tag_font, (232, 224, 250))]
    line2 = [("built on ", tag_font, (232, 224, 250)), ("HttpClient", tag_font_b, (255, 255, 255)),
             (", ", tag_font, (232, 224, 250)), ("Signals", tag_font_b, (255, 255, 255)),
             (" & ", tag_font, (232, 224, 250)), ("RxJS", tag_font_b, (255, 255, 255)), (".", tag_font, (232, 224, 250))]
    tag_y = title_y + 96
    draw_rich_line(draw, line1, text_x, tag_y)
    draw_rich_line(draw, line2, text_x, tag_y + 38)

    badge_y = tag_y + 92
    bx = text_x
    for label, fg, fill, border in BADGES:
        pill, bw = rounded_pill(draw, label, badge_font, fg, fill, border)
        bg.alpha_composite(pill, (bx, badge_y))
        bx += bw + 14

    add_cta_chip(bg, W - 300, H - 90, mono_font)

    bg.convert("RGB").save(f"{OUT_DIR}/ng-ql-linkedin-post.png", "PNG")


# ---------------------------------------------------------------------
# 3) Banner / cover — 1584x396
# ---------------------------------------------------------------------
def make_banner():
    W, H = 1584, 396
    bg = make_background(W, H)
    draw = ImageDraw.Draw(bg)

    title_font = ImageFont.truetype(FD + "segoeuib.ttf", 74)
    tag_font = ImageFont.truetype(FD + "segoeui.ttf", 26)
    tag_font_b = ImageFont.truetype(FD + "seguisb.ttf", 26)
    badge_font = ImageFont.truetype(FD + "segoeuib.ttf", 17)
    mono_font = ImageFont.truetype(FD + "consola.ttf", 17)

    logo_size = 190
    logo = load_logo(logo_size)
    logo_x, logo_y = 100, 55
    bg.alpha_composite(logo, (logo_x, logo_y))

    text_x = logo_x + logo_size + 56
    title_y = 58
    draw.text((text_x, title_y), "ng-ql", font=title_font, fill=(255, 255, 255))

    line1 = [("An ", tag_font, (232, 224, 250)), ("Eloquent-inspired", tag_font_b, (255, 255, 255)),
             (" HTTP query builder for Angular —", tag_font, (232, 224, 250))]
    line2 = [("built on ", tag_font, (232, 224, 250)), ("HttpClient", tag_font_b, (255, 255, 255)),
             (", ", tag_font, (232, 224, 250)), ("Signals", tag_font_b, (255, 255, 255)),
             (" & ", tag_font, (232, 224, 250)), ("RxJS", tag_font_b, (255, 255, 255)), (".", tag_font, (232, 224, 250))]
    tag_y = title_y + 92
    draw_rich_line(draw, line1, text_x, tag_y)
    draw_rich_line(draw, line2, text_x, tag_y + 38)

    badge_y = tag_y + 92
    bx = text_x
    for label, fg, fill, border in BADGES:
        pill, bw = rounded_pill(draw, label, badge_font, fg, fill, border)
        bg.alpha_composite(pill, (bx, badge_y))
        bx += bw + 14

    snippet_lines = [
        ".query()",
        "  .where('status', 'published')",
        "  .orderBy('createdAt', 'desc')",
        "  .paginateSignal(1, 10)",
    ]
    line_h = 26
    snippet_y = H - 30 - line_h * len(snippet_lines)
    for i, line in enumerate(snippet_lines):
        tw = draw.textlength(line, font=mono_font)
        draw.text((W - 64 - tw, snippet_y + i * line_h), line, font=mono_font, fill=(255, 255, 255, 55))

    bg.convert("RGB").save(f"{OUT_DIR}/ng-ql-linkedin-banner.png", "PNG")


make_square()
make_linkedin_post()
make_banner()
print("done")
