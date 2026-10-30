"""Update prepared field filenames without changing which maps the browser loads."""
import re


def update_map_files(source, files):
    remaining = dict(files)

    def update_block(block):
        def update_entry(entry):
            name = entry.group('name')
            if name not in remaining:
                return entry.group(0)
            filename = remaining.pop(name)
            if not re.fullmatch(r'[a-z-]+-[a-f0-9]{12}\.bin', filename):
                raise ValueError(f'Invalid prepared map filename: {filename}')
            return f"{entry.group('prefix')}{entry.group('quote')}{filename}{entry.group('quote')}"

        return re.sub(
            r"(?P<prefix>(?:['\"])?(?P<name>[a-z-]+)(?:['\"])?\s*:\s*)(?P<quote>['\"])[^'\"]+(?P=quote)",
            update_entry, block.group(0))

    updated = re.sub(r'export const (?:ARCHIVE_)?MAP_FILES\s*=\s*\{.*?\};',
                     update_block, source, flags=re.S)
    if remaining:
        raise ValueError(f'Map keys must already be active or archived: {", ".join(remaining)}')
    return updated
