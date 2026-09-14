# Project sculpture exports

Both project sculptures use local, prepared results from Mihir Rao's existing projects. The sibling repositories were inspected read-only. No sibling generator was run, no sibling file was changed, and no numerical solver runs in the homepage browser.

## The Shortest Path Through a Curved World

Source checkout: `../shortest-path-through-a-curved-world`, inspected at commit `8c81669648c663b33343f3346f2a410180e74d6f`.

Authoritative files:

- `web/public/data/worlds/genus-2/world.bin`
- `web/public/data/worlds/genus-2/world.meta.json`
- The binary schema in `web/src/world-data.ts`

The local `assets/black-geometry/project-data/genus-2.bin` contains byte-exact subsets of that export: all 14,790 positions and normals, all **29,584 triangles**, the computed distance field, and all **242 native positions** of the `outer-ridge` route. No simplification or substitute geometry is used. Its companion metadata preserves the original topology, solver, route, and source descriptions.

The compact binary begins with ASCII `PORTGEO1`, then three little-endian uint32 counts (vertices, faces, route points), followed by Float32 positions, Float32 normals, Float32 distances, Uint32 face indices, and Float32 route coordinates. The source binary's SHA-256 is `df82e2c0f602522b4dd928555f94e8ebd381f314b0fbf9cc74f06da2c93d234e`.

The source labels this as a prepared heat-method route that reached the source without fallback. Its reported length is 3.86152056647 in source coordinates; summing the copied Float32 path positions gives 3.86152058719, consistent with export precision. This is a numerical route, not a claim of an exact analytic geodesic or a live homepage solve.

`createSurface()` applies one rigid viewing transform and uniform scale to the mesh and line together. The presentation retains the actual double-handle topology. Surface color is derived from the copied distance field. `SURFACE_PATH` exports the untransformed source route as XYZ tuples; the Group contains its transformed counterpart as a Line with `userData.kind = "route"`.

## When Every Agent Finds the Shortcut

Source checkout: `../multi-agent-reinforcement-learning-in-congestion-games`, inspected at commit `11cefcec1d168cf98aecdd8e23ffac7771dbfea1`.

Authoritative files:

- `web/public/data/population-100-v3.json`
- `web/src/scene/potential-landscape.ts`
- `web/src/scene/congestion-scene.ts`

The local `congestion-100.json` copies the source's potential landscape, exact analysis, scenario states, population, model identifier, and provenance. It omits unrelated repeated learning-study results. Its source SHA-256 is `78ddb2dc83ebf3b04e0673f2ad7aa26738012d80bfd5d12a7b7fa773d5e0f529`.

`createCongestion()` retains the exported **5,151 integer count states** and **10,000 triangles** for population 100. Its height and color represent the original Rosenthal potential, using the same affine height conversion as the source visualization: `(potential − 6060) / 3000`, followed by its presentation scale. This field is not social cost. The source export's raw values remain in the local data.

The optional highlights have distinct, accurate meanings:

- `kind = "open"`: all 65 exported checkpoints of the exact one-agent strict-best-response sequence. This is the source's complete audited path, ending at the equilibrium `[1, 1, 98]`.
- `kind = "closed"`: all 101 feasible count states `[upper, lower, 0]` along the two-route boundary. This curve represents feasibility with the shortcut closed; it is **not** a learning trajectory.

The four exact open-network equilibria are `[0, 0, 100]`, `[0, 1, 99]`, `[1, 0, 99]`, and `[1, 1, 98]`. The source's canonical displayed open equilibrium is `[0, 0, 100]`, with average latency 120; it must not be called unique. The closed equilibrium is `[50, 50]`, with average latency 90. `CONGESTION_INFO` retains the full exact equilibrium records and source scenario states. Transformed marker positions are available in the returned Group's metadata.

`createNetwork(true/false)` is also exported as an optional separate prepared network illustration. Its edge loads and latencies come directly from the source's canonical open/closed equilibrium states. It does not introduce fabricated learning metrics. The network is not silently mixed into the potential surface mesh.

## Licensing and checks

Both source projects use the MIT License, Copyright (c) 2026 Mihir Rao. The complete notice is retained in `assets/black-geometry/project-data/PROJECT-DATA-LICENSE.txt`. Original project data remains local; there are no hotlinked runtime assets.

`src/black-geometry/sculptures/projects.js` is build-only and reads these local exports with Node. It must be baked by the existing experience build; it is not a browser module.

Checks completed: Node imports and construction; exact original vertex/face counts; exact Float32 route extraction; copied path-length agreement; finite geometry; open and closed path counts; and the complete four-equilibrium metadata. Geometry and path receive the same affine transform. Final surface bounds are approximately 5.8 × 3.59 × 1.85 and potential bounds 4.15 × 4.8 × 1.89 before any final shared-scene normalization. Integrated lighting, interaction captions, line visibility, and mobile composition remain the main scene's browser-review responsibility.
