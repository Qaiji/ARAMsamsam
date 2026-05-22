from collections import deque
from pathlib import Path

from PIL import Image


ASSET = Path("src/web/assets/poro.png")


def color_distance(a, b):
    return sum(abs(a[index] - b[index]) for index in range(3))


def main():
    image = Image.open(ASSET).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    background = pixels[0, 0][:3]
    queue = deque(
        [(x, 0) for x in range(width)]
        + [(x, height - 1) for x in range(width)]
        + [(0, y) for y in range(height)]
        + [(width - 1, y) for y in range(height)]
    )
    seen = set()
    transparent_pixels = 0

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))

        red, green, blue, alpha = pixels[x, y]
        if color_distance((red, green, blue), background) > 120:
            continue

        pixels[x, y] = (red, green, blue, 0)
        transparent_pixels += 1
        if x > 0:
            queue.append((x - 1, y))
        if x < width - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < height - 1:
            queue.append((x, y + 1))

    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    image.save(ASSET)
    print(f"Prepared {ASSET} with {transparent_pixels} transparent pixels; size={image.size}")


if __name__ == "__main__":
    main()
