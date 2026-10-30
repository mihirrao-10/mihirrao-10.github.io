"""Prepare a Hubble dust-detail field and an authored pillar silhouette.

Usage: python prepare-nebula.py /path/to/pillars-hubble.jpg
Authoring dependencies: Pillow, NumPy, SciPy. See textures/CREDITS.txt.
This prepares image fields, not a scientific reconstruction of the cloud's depth.
"""
from pathlib import Path
import gzip
import hashlib
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

root = Path(__file__).resolve().parents[2]
output = root / 'assets/black-geometry/textures'
image = Image.open(sys.argv[1]).convert('RGB').resize((1024, 1068), Image.Resampling.LANCZOS)
rgb = np.asarray(image, dtype=float) / 255
# The warm dust stands against cool ionized gas in Hubble's visible-light view.
mask = (rgb[:, :, 0] - rgb[:, :, 2] > .035)
mask = ndimage.binary_closing(mask, iterations=3)
outline = [(.39,.11),(.46,.14),(.46,.18),(.42,.22),(.40,.29),(.37,.35),(.38,.38),(.42,.37),(.43,.40),(.39,.47),(.47,.50),(.51,.53),(.54,.42),(.56,.36),(.58,.30),(.58,.28),(.60,.27),(.62,.28),(.63,.30),(.62,.33),(.64,.36),(.61,.40),(.61,.44),(.66,.47),(.68,.45),(.68,.42),(.70,.41),(.72,.42),(.73,.44),(.72,.47),(.70,.50),(.73,.58),(.75,.66),(.74,.75),(.76,.81),(.75,.90),(.78,.99),(.24,.99),(.25,.91),(.25,.86),(.26,.79),(.23,.75),(.28,.66),(.26,.60),(.22,.64),(.22,.52),(.23,.49),(.23,.43),(.28,.40),(.27,.36),(.28,.30),(.27,.28),(.29,.23),(.30,.21),(.285,.195),(.28,.18),(.30,.16),(.35,.15),(.37,.14)]
roi = Image.new('L', image.size)
ImageDraw.Draw(roi).polygon([(x*1024,y*1068) for x,y in outline], fill=255)
roi = np.asarray(roi) > 0
# The authored outline also retains the cool, translucent neck of the left
# pillar, which color segmentation alone would separate from its cap.
mask = ndimage.binary_erosion(roi, iterations=4) | (ndimage.binary_dilation(roi, iterations=7) & mask)
mask = ndimage.binary_fill_holes(ndimage.binary_closing(mask, iterations=2))
# Feather the cropped base into space; retain every branch and cap above it.
luma = rgb @ np.array([.2126, .7152, .0722])
distance = ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)
# Signed distance in model units, encoded around 0.5 with a range of 1.6.
fields = {'nebula': luma, 'nebula-mask': np.clip(.5 + distance / 1024 * 5.6 / 1.6, 0, 1)}
for name, field in fields.items():
    data = struct.pack('<HH', 1024, 1068) + np.uint8(np.clip(field, 0, 1) * 255).tobytes()
    filename = f'{name}-{hashlib.sha256(data).hexdigest()[:12]}.bin'
    (output / filename).write_bytes(data)
    (output / (filename + '.gz')).write_bytes(gzip.compress(data, mtime=0))
    print(name, filename)
