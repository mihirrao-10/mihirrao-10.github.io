# Dragon sculpture provenance

`src/black-geometry/sculptures/dragon.js` is original, locally authored procedural geometry. It contains no downloaded mesh, logo, texture, or proprietary asset. It is a stylized institution-inspired sculpture, not an official Drexel identity asset.

The reference study used Drexel's [interview with sculptor Eric Berg](https://drexel.edu/news/archive/2019/September/Drexel-Dragon-Secrets-Straight-from-the-Sculptor), including the article's front three-quarter photograph (`BEST_2015_.jpg`), rear photograph (`_COM3454.jpg`), and clay head study (`dragonclay_with_artist.jpg`). The upright S-curved neck, long open snout, separate lower jaw, raised foreclaw, finger-supported wing membranes, and lifted tail informed the design. Reference photos were inspected locally but are not redistributed or loaded by the site.

The [official Drexel digital colors](https://drexel.edu/identity/drexel/color) were verified as blue `#07294D` and gold `#FFC600`. The major body is navy, with derived blue illuminated facets; wing membranes, horns, ventral armor, and selected dorsal crests are gold or darker gold derivatives. This preserves simultaneous blue and gold regions, with lighter structural ribs that remain visible on black.

The pose faces screen-left, with +Y up and a front camera along +Z. The intentional near-profile pose exposes the jaw gap and long tail while the offset, differently shaped wings provide depth. Keep rotation restrained; approximately -0.08 radians around Y is suitable. Do not rotate through a full turn or hide the snout behind the near wing.

The mesh uses elliptical anatomical lofts, beveled armor plates, and individually curved scalloped membrane panels with actual depth and separate finger bones. All components are Three.js BufferGeometry meshes and can be baked into the common facet morph pipeline. Wing colors are vertex colors in Three.js linear working space; other parts use standard material colors.

The production-browser refinement narrowed and reduced the skull, tapered the snout, tightened the jaw opening, varied and reduced the teeth, elongated the hocks, and separated the toe silhouettes. Blue highlights were darkened after inspection under the shared lighting. These changes address the broad-headed mascot reading of the first geometry draft while retaining the dragon silhouette and wing structure.
