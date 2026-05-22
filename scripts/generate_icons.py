from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "web" / "assets" / "logo.png"
OUT = ROOT / "src" / "web" / "assets" / "icons"


def centered_png(source: Image.Image, size: tuple[int, int], background: tuple[int, int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, background)
    thumb = source.copy()
    max_size = (min(size) - 32, min(size) - 32) if size == (1200, 630) else size
    thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(thumb, ((size[0] - thumb.width) // 2, (size[1] - thumb.height) // 2))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    logo = Image.open(SRC).convert("RGBA")

    sizes = {
        "favicon-16.png": (16, 16),
        "favicon-32.png": (32, 32),
        "favicon-48.png": (48, 48),
        "apple-touch-icon.png": (180, 180),
        "social-preview.png": (1200, 630),
    }

    for name, size in sizes.items():
        background = (8, 17, 31, 255) if name == "social-preview.png" else (0, 0, 0, 0)
        centered_png(logo, size, background).save(OUT / name)

    logo.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])


if __name__ == "__main__":
    main()
