# Sculpture refinements

Harper's original seven-bay hall, two towers, unlike crowns, lancet windows, buttresses, and chosen presentation are retained. Only the hall bay spacing and hall width are increased by 10%; the unchanged tower groups move outward to meet the wider hall. Low two-bay Gothic continuation wings and a shallow rear arcade add a restrained collegiate setting. These are original stylized context, not a claim of survey-accurate surrounding UChicago buildings.

Four separate context polylines mark the shallow courtyard boundary, arcade cornice, and outer roof profiles. They carry `userData.kind = "context"` for separate treatment in the shared renderer. Their extent remains close to the building; the full rotated composition is approximately 16% wider than the prior target. The building remains below 15,000 authored triangles. Transparency, edge emphasis, and scene fades are handled by the shared renderer.

The genus-two project surface now uses a distance-driven blue → teal → cyan-green palette (`#176AA3`, `#16A6A2`, `#70DEC4`). The congestion potential uses a brighter red scale (`#841D28`, `#E54338`, `#FF735C`), informed by the actual sibling visualization's copper/red landscape colors in `web/src/scene/materials.ts`; this is a portfolio display palette, not a changed potential or classification.

Before/after SHA-256 comparisons confirm that the project meshes' positions, normals, indices, all path coordinates, marker positions, and scientific metadata are unchanged. Only their surface color buffers change. The source exports and sibling repositories are untouched.
