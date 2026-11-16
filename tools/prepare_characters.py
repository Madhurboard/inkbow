"""
Turn generated character paintings into game-ready sprites.

Input:  a folder of PNGs named NN-<key>.png (painted characters on a plain background).
Output: src/assets/characters/<key>.webp plus manifest.json with each sprite's size and anchor.

Steps: cut the background out with rembg (isnet-general-use), crop to the figure, downscale,
and split the hero into an upper body (rotates to aim) and a lower body (stays planted).

Usage:  pip install "rembg[cpu]" pillow numpy
        python tools/prepare_characters.py <input-folder> [--cut-only <already-cut-folder>]
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "assets" / "characters"
HEIGHTS = {"hero": 640, "boss": 520, "walker-giant": 520, "arrow": 32}
DEFAULT_HEIGHT = 420
# Hero split, as fractions of the cropped hero image.
HERO_WAIST = 0.45
HERO_PIVOT = (0.52, 0.45)
HERO_ARROW_TIP = (0.99, 0.265)
# The hero stands in a wide lunge, so anchor on the torso rather than the feet.
HERO_ANCHOR_X = 0.47
# The bow's lower limb hangs below the waist; it belongs to the upper (rotating) half.
HERO_BOW_LIMB = [(0.76, 0.40), (0.99, 0.40), (0.88, 0.71), (0.77, 0.71)]


def cut(src: pathlib.Path) -> Image.Image:
    from rembg import new_session, remove

    session = cut.session = getattr(cut, "session", None) or new_session("isnet-general-use")
    out = remove(
        Image.open(src).convert("RGB"),
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=20,
        alpha_matting_erode_size=8,
    )
    return crop(out)


def crop(im: Image.Image) -> Image.Image:
    box = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop(box)


def target_height(key: str) -> int:
    for prefix, h in HEIGHTS.items():
        if key.startswith(prefix):
            return h
    return DEFAULT_HEIGHT


def resize(im: Image.Image, height: int) -> Image.Image:
    width = round(im.width * height / im.height)
    return im.resize((width, height), Image.LANCZOS)


def body_anchor(im: Image.Image) -> float:
    """Horizontal centre of mass of the figure, as a fraction of width. Hitboxes centre here."""
    a = np.array(im.getchannel("A"), dtype=np.float32)
    cols = a.sum(axis=0)
    return round(float((cols * np.arange(len(cols))).sum() / cols.sum()) / im.width, 3)


def split_hero(im: Image.Image) -> tuple[Image.Image, Image.Image]:
    w, h = im.size
    torso = Image.new("L", (w, h), 0)
    ImageDraw.Draw(torso).rectangle([0, 0, w, int(h * HERO_WAIST)], fill=255)
    limb = Image.new("L", (w, h), 0)
    ImageDraw.Draw(limb).polygon([(x * w, y * h) for x, y in HERO_BOW_LIMB], fill=255)
    # Inside the bow region keep only wood and gold (red >= blue), not the navy trousers.
    rgb = np.array(im.convert("RGB"), dtype=np.int16)
    bow_coloured = (rgb[:, :, 0] >= rgb[:, :, 2]).astype(np.float32)
    limb_mask = np.array(limb, dtype=np.float32) / 255 * bow_coloured
    limb_mask = np.array(Image.fromarray((limb_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)))
    torso_mask = np.array(torso.filter(ImageFilter.GaussianBlur(h * 0.012)), dtype=np.float32) / 255
    m = np.maximum(torso_mask, limb_mask.astype(np.float32) / 255)
    alpha = np.array(im.getchannel("A"), dtype=np.float32)

    def with_alpha(factor: np.ndarray) -> Image.Image:
        part = im.copy()
        part.putalpha(Image.fromarray((alpha * factor).astype(np.uint8)))
        return part

    # Overlap the halves slightly so no gap opens at the seam when the upper half turns.
    lower_factor = np.clip((1 - m) * 1.6, 0, 1)
    return with_alpha(m), with_alpha(lower_factor)


def main() -> None:
    args = sys.argv[1:]
    cut_only = "--cut-only" in args
    folder = pathlib.Path(args[args.index("--cut-only") + 1] if cut_only else args[0])
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for src in sorted(folder.glob("*.png")):
        key = src.stem.split("-", 1)[1]
        im = crop(Image.open(src).convert("RGBA")) if cut_only else cut(src)
        im = resize(im, target_height(key))
        if key == "hero":
            upper, lower = split_hero(im)
            for name, part in (("hero-upper", upper), ("hero-lower", lower)):
                part.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
            manifest["hero"] = {
                "width": im.width,
                "height": im.height,
                "anchorX": HERO_ANCHOR_X,
                "pivot": HERO_PIVOT,
                "arrowTip": HERO_ARROW_TIP,
            }
        else:
            im.save(OUT / f"{key}.webp", "WEBP", quality=88, method=6)
            manifest[key] = {"width": im.width, "height": im.height, "anchorX": body_anchor(im)}
        print(key, im.size)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
