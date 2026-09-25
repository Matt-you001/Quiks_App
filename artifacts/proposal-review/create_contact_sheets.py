from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

folder = Path(r"C:\Users\USER\Desktop\Quiks\artifacts\proposal-review\updated-render")
pages = sorted(folder.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))

for sheet_no, start in enumerate(range(0, len(pages), 6), start=1):
    selected = pages[start:start + 6]
    thumb_w = 560
    label_h = 36
    gap = 18
    thumbs = []
    for page in selected:
        image = Image.open(page).convert("RGB")
        thumb_h = round(image.height * thumb_w / image.width)
        thumbs.append(image.resize((thumb_w, thumb_h)))
    cell_h = max(i.height for i in thumbs) + label_h
    canvas = Image.new("RGB", (thumb_w * 2 + gap * 3, cell_h * 3 + gap * 4), "#c9cdd2")
    draw = ImageDraw.Draw(canvas)
    for index, (page, thumb) in enumerate(zip(selected, thumbs)):
        col = index % 2
        row = index // 2
        x = gap + col * (thumb_w + gap)
        y = gap + row * (cell_h + gap)
        draw.rectangle((x, y, x + thumb_w, y + label_h), fill="white")
        draw.text((x + 12, y + 8), f"Page {int(page.stem.split('-')[-1])}", fill="black")
        canvas.paste(thumb, (x, y + label_h))
    canvas.save(folder / f"contact-sheet-{sheet_no}.png")
