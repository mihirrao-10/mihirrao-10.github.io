# Pearl finish and opening sequence

The notes sculpture keeps the classical Klein bottle's verified geometry and
65,536-facet presentation. Its face alpha is now 0.52, with a mostly pearl
palette, faint lavender and ice blue, and a small peach accent. Sparse moving
glints highlight real facets. The shared depth pass still prevents rear faces
from obscuring the visible mesh. The static poster uses the same palette and
face alpha; see [geometry provenance](klein-bottle.md).

Work and project measurements use their section's secondary accent. Teaching
and Awards labels and bullet markers are white; Drexel's award names and course
codes are gold, and Chicago's course codes use a clearer red. Notes links have
a subtle underline before hover. The honors line reads *Magna Cum Laude*.

On an ordinary full-motion entry, an early bootstrap masks the page with a
minimal centered `Loading...` status. Static posters are not displayed while
the live renderer is being prepared. The first successful render releases the
cover and starts a 1.1-second growth animation alongside staggered text fades.
Color and depth meshes share the entrance scale. Interaction is enabled when
the sculpture is fully grown.

Direct section links and history returns receive their complete sculpture
without the hero growth animation. The loader changes opacity only; reading
geometry, scroll snapping and history restoration remain native. Deliberate
keyboard, pointer or scrolling intent immediately reveals the text while the
sculpture continues loading on black. That bypass does not replay the entrance.

Reduced motion and no-JavaScript visits retain the static experience. A failed
entry module, graphics error, or 12-second startup deadline releases the cover
to the static fallback. The deadline also applies after a reading bypass.
Print styles always expose the document and omit the loading status.

## Validation

`npm run check` passed all 95 unit checks, deterministic asset generation and
42-file root/dist parity. Browser coverage passed 71 distinct Chromium/WebKit
cases across the full run and a focused entrance recheck; WebKit's unsupported
native-touch protocol case was skipped. The entrance test compares rendered
frames, excluding the world's hidden, unrendered construction state. Desktop,
phone and landscape previews, static fallbacks, and the loading screen were
also inspected visually.
