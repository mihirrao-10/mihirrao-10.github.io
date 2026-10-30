import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('map preparation preserves active versus archived fields and rejects unknown keys', () => {
  const result = spawnSync('python3', ['-B', '-c', `
from map_manifest import update_map_files
source = """export const MAP_FILES = { sun: 'sun-aaaaaaaaaaaa.bin', moon: 'moon-bbbbbbbbbbbb.bin' };
export const MAP_IMAGE_FILES = { sun: 'sun-cccccccccccc.webp' };
export const ARCHIVE_MAP_FILES = { 'jupiter': 'jupiter-dddddddddddd.bin', 'nebula-mask': 'nebula-mask-eeeeeeeeeeee.bin' };
"""
updated = update_map_files(source, {'sun': 'sun-000000000000.bin', 'jupiter': 'jupiter-111111111111.bin'})
assert updated == source.replace('sun-aaaaaaaaaaaa.bin', 'sun-000000000000.bin').replace('jupiter-dddddddddddd.bin', 'jupiter-111111111111.bin')
for fields in [{'unknown': 'unknown-000000000000.bin'}, {'sun': '../bad.bin'}]:
    try:
        update_map_files(source, fields)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid update must fail without rewriting the source')
`], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'tools/black-geometry' } });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
});
