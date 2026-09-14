# Opaque high-resolution sculpture revision

This revision follows the user's request for larger, opaque, brighter sculptures and a new notes form. It supersedes the previous translucent renderer and the square-root notes projection.

## Real geometry refinement

The mathematical surfaces and anatomical curves are resampled at higher resolution, rather than only splitting old flat triangles. Calabi–Yau charts use 36 × 32 cells per patch (57,600 faces); the membrane grid is 96 × 96 (18,432 faces); the trefoil ribbon has 512 longitudinal steps and 24 sides (24,576 faces). Phoenix feathers, lofts and body volumes now contain 61,752 faces; the dragon's lofts and wing surfaces contain 34,290 faces. Shared render packets contain at least 65,536 facets per identity.

The original genus-two project mesh, exact N=100 potential states, and computed project paths are unchanged. Compiler subdivision preserves their planar faces; no new scientific values, routes or surface deformation are introduced. Animated colors are display effects, not time-varying scientific measurements.

## New notes knot

The notes sculpture is a rounded tube around the genuine (3,5) torus knot

\[
C(t)=((1.35+0.58\cos5t)\cos3t,
(1.35+0.58\cos5t)\sin3t,
0.58\sin5t).
\]

The [Wolfram Function Repository's CurveTube description](https://resources.wolframcloud.com/FunctionRepository/resources/CurveTube/) gives the torus-knot parameterization family. This implementation uses an original analytic tangent frame and 768 × 20 tube sampling, producing 30,720 faces. Independent checks recover longitudinal winding three, meridional winding five, and a closed connected tube. Cyan, violet, magenta and gold are authored display colors.

## Opaque rendering and transitions

The renderer draws complete endpoint geometry with opaque materials, depth testing and depth writes. A stable complementary per-pixel threshold switches from one complete sculpture to the other during the short elapsed-time transition. At each pixel the threshold admits exactly one target's fragments; there is no alpha transparency through its rear sheets and no cloud of transported intermediate facets. Settled frames render one sculpture; transition frames render at most two.

Smooth normals are prepared at build time from coincident quantized positions, preserving sharp creases. Triangle winding is aligned locally while averaging, so the former correspondence ordering cannot cancel neighboring normals. Vertex positions are never changed by this shading step. A subtle antialiased mesh texture remains, with most visual weight carried by smooth form, per-identity moving gradients, highlights and colored edge glow.

The packet is version 2, stride 39: the original 18 position bytes and three color bytes remain first, followed by nine signed 16-bit normal components. Positions retain 1/4096-unit quantization and normals use 1/32767. Small enclosing spatial spheres are also prepared in the manifest. The browser decodes arrays directly; it does not reconstruct normals or build spatial maps at target changes.

Fitting evaluates conservative sphere bounds in the actual camera-relative user orientation. The camera remains at a fixed radius of 12 while each endpoint receives its own uniform presentation scale, shared by its routes. This retains perspective clearance during unrestricted quaternion rotations and across viewport shapes, without changing an endpoint's apparent size when its transition partner changes.

Phoenix colors intentionally change to the user's requested orange, amber, yellow and red. The legacy material keys are internal names, not a claim that these are official university colors. Calabi–Yau remains warm/violet; dragon navy/gold; MathWorks blue/orange; Resolution red/blue; genus-two teal/blue. Every sculpture receives a bounded animated gradient within its own palette.

## Checks

Focused tests verify the Calabi–Yau equation and topology, new notes knot winding and closure, trefoil closure, phoenix anatomy and substantial fire-color surface regions, preservation of scientific project coordinates and paths, winding-independent smooth normals with preserved sharp creases, and perspective fitting of all sampled source points through varied quaternion rotations and viewport aspects. Browser material, transition, appearance and performance checks are performed after the coordinated build.
