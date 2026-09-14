> Current revision preserves official UChicago maroon `#800000`, supported by the university's gray `#767676`, light gray `#D6D6CE` and white. The [university's published style guide](https://www.law.uchicago.edu/style-guide) confirms those primary colors. The darker neutral `#4D4D4D` and tiny eye shadow `#241B1B` are authored shading accents, not additional official brand colors. The anatomical refinement now contains **63,232 source triangles in 173 meshes**. It adds five raised tail shafts and two small beak nostrils, and gives the existing feather vertices shallow oblique vane relief. Wing tips, tail tips, head proportions and the color palette remain unchanged; the overall bounds change by less than 0.001 model units.

> Historical revision: the fire palette and higher tessellation described in [opaque-quality.md](opaque-quality.md) preceded the current maroon restoration.

# UChicago phoenix sculpture

The University of Chicago's official athletics nickname is the Maroons. Its mascot is a phoenix, named **Phil the Phoenix**, rather than an eagle. The [official athletics mascot history](https://athletics.uchicago.edu/sports/2023/6/12/maroons-phoenix.aspx) establishes both names.

## Primary visual and color references

The [University color system](https://creative.uchicago.edu/color-system/) identifies maroon as the dominant color and gray as an accent. Its [primary palette swatch](https://creative.uchicago.edu/files/2023/09/Color-System-01.jpg) was visually inspected: maroon **#800000**, light greystone **#D9D9D9**, greystone **#A6A6A6**, and dark greystone **#737373**. White supplies the small pale throat, feather shafts and eye highlights. A tiny near-black maroon is confined to the eye sockets.

The [official identity elements](https://creative.uchicago.edu/logos-and-identity-elements/) and [outlined phoenix reference](https://creative.uchicago.edu/files/2023/09/UChicago_Phoenix_Outlined_1Color_Maroon_RGB.png) informed the spread-wing, hooked-beak and central flame-tail silhouette. The [Phil mascot photograph hosted by UChicago Athletics](https://dbukjj6eu5tsf.cloudfront.net/sidearm.sites/chgo.sidearmsports.com/images/2017/4/1/Phoenix_Mascot1.jpg) informed the maroon plumage and pale neck ruff. These publicly available references were inspected directly; no downloaded logo or costume asset is shipped as model geometry or texture.

## Original three-dimensional work

`createPhoenix()` produces an original faceted bird sculpture with a deep oval torso, a compact turned head, curved hooked beak, tucked bird feet, and five central flowing tail plumes. Each wing contains nine long flight feathers, overlapping front and rear coverts, smaller shoulder feathers, a thick curved leading edge, and raised feather shafts. Feathers are closed curved lenticular solids, not flat polygons or extruded logo paths. The rear has its own feathers and anatomy so grab rotation reveals modeled volume.

The head turns approximately 24 degrees toward the sculpture's left, with another 6 degrees in the complete composition. This exposes the hook and eye in the intended front view (+Z, +Y up). The beak uses light greystone to preserve the requested maroon/gray/white palette. The two feet are small and tucked; the five broad tapering tail plumes are confined below the body and remain distinct from legs. There are no dragon horns, muzzle, membrane wings, or long reptilian tail.

The initial lower-resolution version returned 166 `BufferGeometry` meshes with **17,808 triangles**; that historical count has been superseded by the current refinement above. Current world-space authoring bounds are approximately **6.483 × 4.731 × 1.612**. Uniform fitting to the 5.9 × 4.65 × 5.6 presentation envelope retains the approved wide, full-height composition. Focused tests enforce maroon over 55% of modeled surface area, gray between 20% and 40%, and white over 1%. These area proportions describe geometry, not guaranteed screen-pixel coverage under lighting.

Front, quarter, side, and rear authoring projections were visually inspected. The dedicated tests check finite noncollapsed triangles, budget, proportions and depth; surface-area color distribution; beak/throat placement; and enclosed feather volume on both sides. The site renderer's lighting and final browser framing require the shared integration checks. This is an independent interpretation, not official University of Chicago artwork or a claim of endorsement.

The latest anatomical refinement also checks that physical tail shafts stay inside their parent plumes, small nostrils stay inside the beak envelope, and the approved whole-bird dimensions remain stable. It adds no texture, downloaded asset, palette substitution or global rendering change. Final integrated browser inspection remains a separate check for this refinement.
