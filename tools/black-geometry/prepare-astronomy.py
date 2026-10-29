"""Prepare grayscale astronomy fields from the credited reference images.

Usage: python3 tools/black-geometry/prepare-astronomy.py /path/to/reference-images
Requires Pillow and NumPy; this is an authoring tool, not a build dependency.
Inputs: sun.jpg, saturn.jpg, galaxy.jpg, cluster.jpg. See textures/CREDITS.txt.
"""
import gzip
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
inputs = Path(sys.argv[1])
output = root / 'assets/black-geometry/textures'
files = {}


def save(name, field):
    image = Image.fromarray(np.uint8(np.clip(field, 0, 1) * 255))
    data = struct.pack('<HH', *image.size) + image.tobytes()
    filename = f'{name}-{hashlib.sha256(data).hexdigest()[:12]}.bin'
    (output / filename).write_bytes(data)
    (output / (filename + '.gz')).write_bytes(gzip.compress(data, mtime=0))
    files[name] = filename


# Unproject the observed solar hemisphere, reflecting the unobserved reverse.
sun = np.asarray(Image.open(inputs / 'sun.jpg').convert('L'), dtype=float) / 255
u, v = np.meshgrid(np.linspace(0, 1, 2048), np.linspace(0, 1, 1024))
lon, lat = (u - .25) * np.pi * 2, (.5 - v) * np.pi
x = np.clip((1024 + 846 * np.cos(lat) * np.sin(lon)).astype(int), 0, 2047)
y = np.clip((1024 - 846 * np.sin(lat)).astype(int), 0, 2047)
field = sun[y, x]
save('sun', np.clip((field - .06) / .80, 0, 1) ** .8)

# Cassini's illuminated right-hand hemisphere supplies the latitude profile.
saturn = np.asarray(Image.open(inputs / 'saturn.jpg').convert('L'), dtype=float) / 255
latitudes = np.linspace(1, -1, 1024)
profile = []
for latitude in latitudes:
    yy = int(np.clip(1315 - latitude * 650, 0, saturn.shape[0] - 1))
    xx = int(1800 + 450 * np.sqrt(max(0, 1 - latitude * latitude)))
    profile.append(np.median(saturn[yy, xx - 12:xx + 13]))
profile = np.array(profile)
profile = (profile - profile.min()) / max(.01, np.ptp(profile))
save('saturn', np.tile(profile[:, None], (1, 512)))

# Aperiodic optical-depth bands: C, B, Cassini division, A, Encke gap, F ring.
rng = np.random.default_rng(81927)
t = np.linspace(0, 1, 4096)
profile = np.interp(t, [0, .08, .23, .27, .54, .61, .65, .69, .91, .95, .98, 1],
                    [.05, .22, .28, .65, .85, .68, .02, .50, .62, .12, .26, 0])
for count, amplitude in [(37, .10), (153, .055), (613, .025)]:
    profile += amplitude * np.interp(t, np.linspace(0, 1, count), rng.uniform(-1, 1, count))
profile *= 1 - .95 * np.exp(-((t - .645) / .014) ** 4)
profile *= 1 - .85 * np.exp(-((t - .894) / .004) ** 2)
save('rings', profile[None, :])

for name in ['galaxy', 'cluster']:
    image = Image.open(inputs / (name + '.jpg')).convert('L')
    image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    field = np.asarray(image, dtype=float) / 255
    # Keep the observed structure; remove background and softly feather edges.
    yy, xx = np.mgrid[0:field.shape[0], 0:field.shape[1]]
    edge = np.minimum.reduce([xx / (field.shape[1] * .18), yy / (field.shape[0] * .18),
                              (field.shape[1] - 1 - xx) / (field.shape[1] * .18),
                              (field.shape[0] - 1 - yy) / (field.shape[0] * .18)])
    field = np.clip((field - (.055 if name == 'galaxy' else .028)) / .90, 0, 1)
    edge = np.clip(edge, 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    radius = np.hypot((xx / field.shape[1] - .5) * 2, (yy / field.shape[0] - .5) * 2)
    radial = np.clip((1.18 - radius) / .42, 0, 1)
    radial = radial * radial * (3 - 2 * radial)
    save(name, field * edge * radial)

path = root / 'src/black-geometry/astronomy-maps.js'
source = path.read_text()
start, end = source.index('export const MAP_FILES'), source.index('\n\nexport function decodeMap')
existing = {'earth': 'earth-28448cc004a0.bin', 'moon': 'moon-d4139e619240.bin'}
source = source[:start] + 'export const MAP_FILES = ' + json.dumps(existing | files, indent=2) + ';' + source[end:]
path.write_text(source)
print(json.dumps(files, indent=2))
