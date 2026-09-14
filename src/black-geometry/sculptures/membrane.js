import * as THREE from "three";

// Original numerical reconstruction; see revision-membrane-provenance.md.
// A nine-term boundary-collocation solve was performed at author time. Only the
// first two terms are used for the displayed, deliberately relaxed outer edge.
// No MATLAB code, downloaded mesh, or numerical eigensolver runs in the browser.
const EIGENVALUE = 9.639723843543223;
const SECOND_COEFFICIENT = 0.25615690714466466;
const ORDER_GAMMA = [0.9027452929509336, 9.26052826812555];
const GRID = 96;

// The rapidly convergent defining series suffices for 0 <= z <= sqrt(2 lambda).
// This only evaluates the already-authored shape when build tooling imports it.
function bessel(order, gamma, z) {
  if (z === 0) return 0;
  let term = (z / 2) ** order / gamma;
  let value = term;
  for (let k = 1; k < 26; k++) {
    term *= -(z * z / 4) / (k * (k + order));
    value += term;
  }
  return value;
}

function heightAt(x, y) {
  // The zero extension makes the small flat apron seen in the display reference.
  // It is excluded from the mathematical eigenfunction's L-shaped domain.
  if (x <= 0 && y <= 0) return 0;
  const theta = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  const radius = Math.hypot(x, y) * Math.sqrt(EIGENVALUE);
  return (
    bessel(2 / 3, ORDER_GAMMA[0], radius) * Math.sin((2 / 3) * theta) +
    SECOND_COEFFICIENT *
      bessel(10 / 3, ORDER_GAMMA[1], radius) *
      Math.sin((10 / 3) * theta)
  );
}

function smoothstep(a, b, t) {
  const u = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

/**
 * Build-time source for the portfolio's MathWorks-inspired membrane sculpture.
 * +Y is up; the primary camera is on +Z. The planar blue apron, tall copper
 * crest, and rolled lower edge follow the actual reference's presentation.
 * Colors are original art-direction choices, not an official brand palette.
 */
export function createMembrane() {
  const root = new THREE.Group();
  root.name = "mathworks-membrane";

  const raw = [], source = [], indices = [];
  let peak = 0;
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      // Slightly denser facets near the reentrant fold retain its sharpness.
      const coordinate = (v) => Math.sign(v) * Math.abs(v) ** 1.18;
      const x = coordinate((2 * i) / GRID - 1);
      const y = coordinate((2 * j) / GRID - 1);
      const height = heightAt(x, y);
      source.push([x, y, height]);
      peak = Math.max(peak, height);
    }
  }

  // The illustrated MathWorks camera looks from the southwest with Z up.
  // Rotate the source domain clockwise so the excluded quadrant becomes the
  // left apron, then bake that three-quarter view into +Y-up presentation.
  const towardCamera = new THREE.Vector3(-222.9, -289.9, 219.7).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), towardCamera).normalize();
  const up = new THREE.Vector3().crossVectors(towardCamera, right);
  const point = new THREE.Vector3();
  for (const [x, y, height] of source) {
    point.set(y, -x, (height / peak) * 1.6);
    raw.push(point.dot(right), point.dot(up), point.dot(towardCamera));
  }

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * (GRID + 1) + i;
      const b = a + 1;
      const d = a + GRID + 1;
      const c = d + 1;
      // These are local surface neighbors, never unrelated transition indices.
      if ((i + j) % 2) indices.push(a, b, d, b, c, d);
      else indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(raw, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // A uniform normalization protects the authored membrane's proportions.
  const scale = Math.min(5.8 / size.x, 4.8 / size.y);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.computeVertexNormals();

  const colors = [];
  const blue = new THREE.Color("#087ad8");
  const blueRim = new THREE.Color("#4cdcf2");
  const copper = new THREE.Color("#ce3516");
  const orange = new THREE.Color("#ff7724");
  const gold = new THREE.Color("#ffad3d");
  const color = new THREE.Color();
  const cool = new THREE.Color();
  const warm = new THREE.Color();
  for (const [x, y, height] of source) {
    const crest = Math.max(0, height / peak);
    // The cool region occupies a real continuous flank and its zero apron.
    // The warmer face varies from a deep copper ridge to the turned gold hem.
    cool.copy(blue).lerp(blueRim, 0.32 * crest + 0.12);
    warm.copy(gold).lerp(orange, smoothstep(-0.85, 0.2, y));
    warm.lerp(copper, smoothstep(0.3, 1.0, y) * 0.75);
    warm.multiplyScalar(0.88 + 0.12 * smoothstep(0.03, 0.5, x));
    color.copy(cool).lerp(warm, smoothstep(-0.06, 0.22, x));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.16,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = "two-term-membrane";
  root.add(mesh);
  root.userData = {
    identity: "mathworks",
    triangles: indices.length / 3,
    eigenvalue: EIGENVALUE,
    numericalMethod: "author-time sector-Bessel boundary collocation; two-term display truncation",
    authoredView: "MathWorks southwest three-quarter camera; +Y up, camera on +Z",
    palette: { body: "#ff7724", secondary: "#087ad8", highlight: "#ffad3d" },
  };
  return root;
}
