import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { posterPNG } from '../../tools/black-geometry/cosmos-posters.js';

function decodePNG(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let width, height, channels;
  const data = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8);
    const payload = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      assert.equal(payload[8], 8);
      assert.ok([4, 6].includes(payload[9]));
      channels = payload[9] === 4 ? 2 : 4;
    }
    if (type === 'IDAT') data.push(payload);
    at += length + 12;
  }
  const rows = inflateSync(Buffer.concat(data)), pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    assert.equal(rows[y * (width * channels + 1)], 0);
    for (let x = 0; x < width; x++) {
      const from = y * (width * channels + 1) + 1 + x * channels, to = (y * width + x) * 4;
      if (channels === 2) {
        pixels[to] = pixels[to + 1] = pixels[to + 2] = rows[from];
        pixels[to + 3] = rows[from + 1];
      } else rows.copy(pixels, to, from, from + 4);
    }
  }
  return { width, height, channels, pixels };
}

for (const colored of [false, true]) test(`poster PNG round-trips every ${colored ? 'color' : 'grayscale'} pixel and alpha value`, () => {
  const width = 16, height = 16, pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = i;
    pixels[i * 4 + 1] = colored ? 255 - i : i;
    pixels[i * 4 + 2] = colored ? i ^ 127 : i;
    pixels[i * 4 + 3] = 255 - i;
  }
  // Nonzero RGB with zero alpha must also survive the encoding unchanged.
  pixels[3] = 0;
  const decoded = decodePNG(posterPNG(width, height, pixels));
  assert.deepEqual([decoded.width, decoded.height], [width, height]);
  assert.equal(decoded.channels, colored ? 4 : 2);
  assert.deepEqual(decoded.pixels, pixels);
});
