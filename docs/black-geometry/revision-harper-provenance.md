# Harper sculpture references

`src/black-geometry/sculptures/harper.js` is original procedural artwork authored for the portfolio revision. It is an institution-inspired, simplified building sculpture, not an official institutional asset or a survey-accurate architectural reconstruction. No photograph, logo, downloaded mesh, or third-party model is redistributed.

References inspected on September 14, 2026:

- [Official UChicago architectural entry](https://architecture.uchicago.edu/locations/william_rainey_harper_memorial_library/), including its [south-elevation illustration](https://d3qi0qp55mx5f5.cloudfront.net/architecture/i/locations/illustrations/20130513_harperlibrary.jpg?mtime=1370287899). This establishes the broad hall/tower proportions, upper Gothic bays, lower rectangular-window rhythm and parapets.
- [UChicago College, “The library that isn’t”](https://college.uchicago.edu/news/campus-stories/library-isnt-evolution-harper-memorial-library), April 19, 2024. Its exterior aerial photograph and close photographs of the differing tower crowns were visually inspected. The West Tower has ecclesiastical pointed caps; the East Tower has flat military battlements.
- [UChicago Identity Guidelines](https://news.uchicago.edu/sites/default/files/attachments/_uchicago.identity.guidelines.pdf) identifies the digital maroon reference as RGB 128, 0, 0 / `#800000`. The sculpture’s body uses that reference. Molding, roof, recess and tracer colors are authored lighting/display derivatives, not additional claimed official colors.
- Three.js `ExtrudeGeometry`, `Shape`, `ShapeGeometry`, and `BufferGeometry` behavior checked against the installed pinned Three.js 0.186.0 source and [official documentation](https://threejs.org/docs/).

The model emphasizes the seven-bay central reading-room range, two narrow taller towers, the upper paired Gothic windows, projecting buttresses, deep window reveals, modeled mullions/tracery, a pitched hall roof, crenellated parapets, octagonal turret lanterns and dissimilar tower caps. Side and rear walls are modeled; rear elevations are intentionally simplified to keep the triangle budget focused on the chosen modest elevated three-quarter view. Window openings are actual holes in extruded wall shapes, with inset dark panes and raised face ribbons for framing. Fine heraldic carvings are simplified to shield geometry rather than copied coats of arms.

The returned `THREE.Group` contains only meshes with `BufferGeometry` and single-color materials. It includes a presentation rotation; the central rendering pipeline can bake world transforms and material colors before normalization and morph correspondence preparation.

Geometry authoring validation: 11,849 triangles before the shared preparation pipeline; no non-finite position values. An isolated Three.js authoring render was inspected at 1200 × 850 during modeling. It showed the hall/tower proportions, roof depth, paired windows and dissimilar crowns clearly. This authoring render is not substituted for the required production-page visual acceptance, which belongs to the integrated revision evidence.
