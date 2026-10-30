"""Encode the active raw surface maps as lossless, content-hashed WebP images.

Usage: python3 tools/black-geometry/prepare-map-images.py
Requires Pillow; this authoring step is independent of the JavaScript build.
Run after updating the Moon or Sun .bin fields. The raw fields remain the
source of truth for software posters and unsupported image-decoder fallbacks.
"""
import hashlib
import io
from pathlib import Path
import re
import struct

from PIL import Image

root = Path(__file__).resolve().parents[2]
manifest = root / 'src/black-geometry/astronomy-maps.js'
source = manifest.read_text()
fields = re.search(r'export const MAP_FILES = \{(.*?)\};', source, re.S).group(1)
output = root / 'assets/black-geometry/textures'
images = {}
for name, filename in re.findall(r"(\w+):\s*'([^']+)'", fields):
    data = (output / filename).read_bytes()
    width, height = struct.unpack('<HH', data[:4])
    image = Image.frombytes('L', (width, height), data[4:])
    encoded = io.BytesIO()
    image.save(encoded, format='WEBP', lossless=True, quality=100, method=6)
    payload = encoded.getvalue()
    assert Image.open(io.BytesIO(payload)).convert('L').tobytes() == data[4:]
    filename = f'{name}-{hashlib.sha256(payload).hexdigest()[:12]}.webp'
    (output / filename).write_bytes(payload)
    images[name] = filename
block = 'export const MAP_IMAGE_FILES = {\n' + ''.join(
    f"  {name}: '{filename}',\n" for name, filename in images.items()) + '};'
source, replaced = re.subn(r'export const MAP_IMAGE_FILES = \{.*?\};', block, source, count=1, flags=re.S)
if replaced != 1:
    raise ValueError('Expected exactly one MAP_IMAGE_FILES manifest')
manifest.write_text(source)
for name, filename in images.items():
    print(f'{name}: {filename} ({(output / filename).stat().st_size:,} bytes)')
