"""Prepare the NASA Cassini PIA07782 map: python3 prepare-jupiter.py input.jpg.
Requires Pillow; not a website build dependency. Credits accompany the output.
"""
import gzip
import hashlib
import json
from pathlib import Path
import struct
import sys
from PIL import Image, ImageFilter, ImageOps

root = Path(__file__).resolve().parents[2]
image = Image.open(sys.argv[1]).convert('L').resize((3600, 1800), Image.Resampling.LANCZOS)
image = ImageOps.autocontrast(image, cutoff=1).filter(ImageFilter.UnsharpMask(1.2, 85, 2))
data = struct.pack('<HH', *image.size) + image.tobytes()
filename = f'jupiter-{hashlib.sha256(data).hexdigest()[:12]}.bin'
output = root / 'assets/black-geometry/textures'
(output / filename).write_bytes(data)
(output / (filename + '.gz')).write_bytes(gzip.compress(data, mtime=0))
path = root / 'src/black-geometry/astronomy-maps.js'
source = path.read_text()
start, end = source.index('export const MAP_FILES'), source.index('};', source.index('export const MAP_FILES')) + 2
files = {'earth': 'earth-28448cc004a0.bin', 'moon': 'moon-d4139e619240.bin',
         'sun': 'sun-84afb4c32ecd.bin', 'jupiter': filename, 'cluster': 'cluster-001b58dbcf10.bin'}
source = source[:start] + 'export const MAP_FILES = ' + json.dumps(files, indent=2) + ';' + source[end:]
path.write_text(source)
print(filename, 'compressed bytes:', len(gzip.compress(data, mtime=0)))
