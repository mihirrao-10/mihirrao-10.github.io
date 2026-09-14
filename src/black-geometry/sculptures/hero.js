import * as THREE from "three";

const HEIGHT_SCALE = 3.15;
const TAU = Math.PI * 2;

// A Gaussian envelope turns the classical cubic monkey saddle into three
// finite crests. This is an authored height field, not a Calabi–Yau surface.
export function heroHeight(u, v) {
  return HEIGHT_SCALE * (u * u * u - 3 * u * v * v) * Math.exp(-(u * u + v * v));
}
export function heroDerivatives(u, v) {
  const cubic = u * u * u - 3 * u * v * v;
  const envelope = HEIGHT_SCALE * Math.exp(-(u * u + v * v));
  return [
    envelope * (3 * u * u - 3 * v * v - 2 * u * cubic),
    envelope * (-6 * u * v - 2 * v * cubic),
  ];
}

// Intrinsic gradient ascent of the height on its graph: the induced metric is
// I + grad(h) grad(h)^T, hence du/dt = grad(h)/(1 + |grad(h)|²).
function ascentVelocity([u, v]) {
  const [du, dv] = heroDerivatives(u, v);
  const metric = 1 + du * du + dv * dv;
  return [du / metric, dv / metric];
}
function rk4(point, dt) {
  const add = (a, b, scale) => a.map((value, i) => value + b[i] * scale);
  const a = ascentVelocity(point);
  const b = ascentVelocity(add(point, a, dt / 2));
  const c = ascentVelocity(add(point, b, dt / 2));
  const d = ascentVelocity(add(point, c, dt));
  return point.map((value, i) => value + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
}
export function computeHeroAscent() {
  let point = [0.52, 0.87];
  const samples = [{ uv: [...point], height: heroHeight(...point) }];
  for (let i = 0; i < 1200; i++) {
    const next = rk4(point, 0.025);
    const height = heroHeight(...next);
    if (height + 1e-12 < samples.at(-1).height) throw new Error("Hero ascent must increase height");
    point = next;
    samples.push({ uv: [...point], height });
    if (Math.hypot(...heroDerivatives(...point)) < 0.0001) break;
  }
  return samples;
}

/** A continuous three-crest graph, with a prepared red intrinsic ascent trace. */
export function createHero(neutral = false) {
  const positions = [0, 0, 0], colors = [], indices = [];
  const rings = 34, sectors = 112;
  const white = new THREE.Color("#f3f6f1"), green = new THREE.Color("#58b382");
  const color = new THREE.Color();
  const heightScale = neutral ? 0.82 : 1;
  const pushColor = (height, radius) => {
    const shade = Math.max(0, Math.min(1, (height + 1.3) / 2.6));
    color.copy(white).lerp(green, (0.06 + 0.46 * shade ** 2) * (neutral ? 0.7 : 1));
    color.multiplyScalar(0.91 + 0.09 * Math.min(1, radius));
    colors.push(color.r, color.g, color.b);
  };
  pushColor(0, 0);
  for (let j = 1; j <= rings; j++) {
    for (let i = 0; i < sectors; i++) {
      const angle = i / sectors * TAU;
      const rim = 1.61 + 0.13 * Math.cos(3 * angle);
      const radius = rim * j / rings;
      const u = radius * Math.cos(angle), v = radius * Math.sin(angle);
      const height = heroHeight(u, v);
      positions.push(u, height * heightScale, -v);
      pushColor(height, radius);
      const here = 1 + (j - 1) * sectors + i;
      const next = 1 + (j - 1) * sectors + (i + 1) % sectors;
      if (j === 1) indices.push(0, here, next);
      else {
        const lower = here - sectors, lowerNext = next - sectors;
        indices.push(lower, next, lowerNext, lower, here, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const root = new THREE.Group();
  root.name = neutral ? "quiet-three-crest-surface" : "three-crest-gradient-surface";
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.57, metalness: 0.08,
  })));
  if (!neutral) {
    const samples = computeHeroAscent();
    const points = samples.map(({ uv: [u, v], height }) => {
      const [du, dv] = heroDerivatives(u, v);
      const normal = new THREE.Vector3(-du, 1, dv).normalize();
      return new THREE.Vector3(u, height, -v).addScaledVector(normal, 0.012);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xf04444, depthTest: true }),
    );
    line.name = "prepared-intrinsic-gradient-ascent";
    line.userData = { path: true, kind: "ascent", normalOffset: 0.012 };
    root.add(line);
    root.userData.ascent = {
      method: "RK4 of intrinsic height-gradient flow; dt=0.025",
      points: samples.length,
      initialHeight: samples[0].height,
      finalHeight: samples.at(-1).height,
      endpoint: samples.at(-1).uv,
      endpointGradientNorm: Math.hypot(...heroDerivatives(...samples.at(-1).uv)),
      strictlyIncreasing: samples.every((sample, i) => i === 0 || sample.height > samples[i - 1].height),
    };
  }
  root.rotation.set(0.66, -0.12, -0.11);
  root.userData.identity = neutral ? "neutral" : "hero";
  root.userData.equation = "h(u,v)=3.15(u³−3uv²)exp(−u²−v²)";
  root.userData.displayHeightScale = heightScale;
  return root;
}
