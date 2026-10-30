"""Prepare the NASA Cassini PIA07782 map: python3 prepare-jupiter.py input.jpg.
Requires Pillow; not a website build dependency. Credits accompany the output.
"""
import gzip
import hashlib
from pathlib import Path
import struct
import sys
from PIL import Image, ImageFilter, ImageOps

from map_manifest import update_map_files

root = Path(__file__).resolve().parents[2]
image = Image.open(sys.argv[1]).convert('L').resize((3600, 1800), Image.Resampling.LANCZOS)
image = ImageOps.autocontrast(image, cutoff=1).filter(ImageFilter.UnsharpMask(1.2, 85, 2))
data = struct.pack('<HH', *image.size) + image.tobytes()
filename = f'jupiter-{hashlib.sha256(data).hexdigest()[:12]}.bin'
output = root / 'assets/black-geometry/textures'
(output / filename).write_bytes(data)
compressed = gzip.compress(data, mtime=0)
(output / (filename + '.gz')).write_bytes(compressed)
path = root / 'src/black-geometry/astronomy-maps.js'
source = path.read_text()
source = update_map_files(source, {'jupiter': filename})
path.write_text(source)
print(filename, 'compressed bytes:', len(compressed))
