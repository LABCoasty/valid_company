"""Generate placeholder PNG icons for the Chrome extension without external deps."""
from __future__ import annotations
import struct
import zlib
from pathlib import Path


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    chunk = struct.pack(">I", len(data)) + chunk_type + data
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return chunk + struct.pack(">I", crc)


def _solid_icon(size: int, rgba: tuple[int, int, int, int]) -> bytes:
    width = height = size
    bit_depth = 8
    color_type = 6  # RGBA
    header = struct.pack(
        ">IIBBBBB",
        width,
        height,
        bit_depth,
        color_type,
        0,  # compression
        0,  # filter
        0,  # interlace
    )

    row = bytes(rgba) * width
    raw = b"".join(b"\x00" + row for _ in range(height))
    compressed = zlib.compress(raw, level=9)

    png = b"\x89PNG\r\n\x1a\n"
    png += _png_chunk(b"IHDR", header)
    png += _png_chunk(b"IDAT", compressed)
    png += _png_chunk(b"IEND", b"")
    return png


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    output_dir = root / "icons"
    output_dir.mkdir(parents=True, exist_ok=True)

    palette = {
        16: (0x21, 0x6B, 0xFF, 0xFF),
        48: (0x17, 0x3C, 0xB2, 0xFF),
        128: (0x0C, 0x23, 0x73, 0xFF),
    }

    for size, color in palette.items():
        icon_bytes = _solid_icon(size, color)
        target = output_dir / f"icon{size}.png"
        target.write_bytes(icon_bytes)
        print(f"Generated {target} ({len(icon_bytes)} bytes)")


if __name__ == "__main__":
    main()
