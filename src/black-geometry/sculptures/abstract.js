import * as THREE from 'three';

const vector = point => new THREE.Vector3(...point);
const gray = tone => new THREE.Color().setRGB(tone, tone, tone);
function material(tone, vertexColors = false) {
  return new THREE.MeshStandardMaterial({ color: gray(tone), vertexColors, side: THREE.DoubleSide, roughness: .48 });
}
function ball(root, point, radius, tone) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), material(tone));
  mesh.position.copy(vector(point)); root.add(mesh);
}
function rod(root, a, b, radius, tone, sides = 8) {
  const start = vector(a), end = vector(b), direction = end.clone().sub(start);
  if (direction.lengthSq() < 1e-12) return;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), sides, 1, true), material(tone));
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  root.add(mesh);
}
function arrow(root, a, b, radius, tone) {
  const start = vector(a), end = vector(b), direction = end.clone().sub(start).normalize();
  if (start.distanceTo(end) < .38) { rod(root, a, b, radius, tone); return; }
  const tip = end.clone().addScaledVector(direction, -.11);
  const height = .14;
  const base = tip.clone().addScaledVector(direction, -height);
  rod(root, start.addScaledVector(direction, .1).toArray(), base.toArray(), radius, tone);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, height, 10), material(tone));
  head.position.copy(tip.addScaledVector(direction, -height / 2));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  root.add(head);
}
const edgeKey = (a, b) => [a, b].sort((x, y) => x - y).join(',');

export function permutationGraph() {
  const permutations = [];
  function visit(prefix, remaining) {
    if (!remaining.length) { permutations.push(prefix); return; }
    remaining.forEach((value, i) => visit([...prefix, value], remaining.filter((_, j) => j !== i)));
  }
  visit([], [0, 1, 2, 3]);
  const lookup = new Map(permutations.map((p, i) => [p.join(','), i]));
  // Orthonormal coordinates for the sum-zero hyperplane in R^4.
  const points = permutations.map(p => {
    const q = p.map(value => value - 1.5);
    return [(q[0] - q[1]) / Math.sqrt(2), (q[0] + q[1] - 2 * q[2]) / Math.sqrt(6),
      (q[0] + q[1] + q[2] - 3 * q[3]) / Math.sqrt(12)];
  });
  const edges = [], neighbors = permutations.map(() => []);
  permutations.forEach((p, i) => {
    for (let value = 0; value < 3; value++) {
      const q = [...p], a = q.indexOf(value), b = q.indexOf(value + 1);
      [q[a], q[b]] = [q[b], q[a]];
      const j = lookup.get(q.join(','));
      neighbors[i].push(j);
      if (i < j) edges.push([i, j]);
    }
  });
  // Breadth-first search finds a shortest sequence of adjacent-value swaps.
  const parent = new Map([[0, null]]), queue = [0], goal = permutations.length - 1;
  for (const i of queue) {
    for (const j of neighbors[i]) if (!parent.has(j)) { parent.set(j, i); queue.push(j); }
    if (parent.has(goal)) break;
  }
  const path = [];
  for (let i = goal; i !== null; i = parent.get(i)) path.unshift(i);
  return { permutations, points, edges, path };
}

export function createEducation() {
  const root = new THREE.Group(), graph = permutationGraph();
  root.name = 'permutation-polytope-shortest-path';
  const route = new Set(graph.path.slice(1).map((v, i) => edgeKey(graph.path[i], v)));
  for (const [a, b] of graph.edges) {
    const selected = route.has(edgeKey(a, b));
    rod(root, graph.points[a], graph.points[b], selected ? .047 : .019, selected ? .045 : .54);
  }
  graph.points.forEach((point, i) => ball(root, point, graph.path.includes(i) ? .105 : .075, graph.path.includes(i) ? .08 : .64));
  root.rotation.set(.32, -.48, .1);
  root.userData = { theme: 'Algorithms and combinatorial optimization', ...graph };
  return root;
}

// An authored multi-basin objective, not a measured model-training loss.
export const lossValue = (x, z) => .16 * (x * x + z * z) + .6 * Math.sin(1.7 * x) * Math.cos(1.4 * z);
export const lossGradient = (x, z) => [
  .32 * x + 1.02 * Math.cos(1.7 * x) * Math.cos(1.4 * z),
  .32 * z - .84 * Math.sin(1.7 * x) * Math.sin(1.4 * z),
];
export function descentPath(start) {
  const points = [[...start]];
  for (let step = 0; step < 140; step++) {
    const [x, z] = points.at(-1), gradient = lossGradient(x, z), norm = Math.hypot(...gradient);
    if (norm < .001) break;
    let rate = .18, next;
    // Backtracking keeps the displayed descent monotone, even on a steep ridge.
    do {
      next = [x - rate * gradient[0], z - rate * gradient[1]];
      if (Math.max(...next.map(Math.abs)) <= 2.2 && lossValue(...next) <= lossValue(x, z) - .1 * rate * norm * norm) break;
      rate *= .5;
    } while (rate > 1e-8);
    if (rate <= 1e-8) break;
    points.push(next);
  }
  return points;
}

export function createExperience() {
  const root = new THREE.Group(), steps = 64, positions = [], heights = [], indices = [], colors = [];
  root.name = 'loss-landscape-gradient-descent';
  for (let row = 0; row <= steps; row++) for (let column = 0; column <= steps; column++) {
    const x = -2.2 + 4.4 * column / steps, z = -2.2 + 4.4 * row / steps, value = lossValue(x, z);
    positions.push(x, .95 * value, z); heights.push(value);
    const tone = .34 + .17 * (value + .5) / 2.4;
    colors.push(tone, tone, tone);
  }
  for (let row = 0; row < steps; row++) for (let column = 0; column < steps; column++) {
    const a = row * (steps + 1) + column, b = a + 1, c = a + steps + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  root.add(new THREE.Mesh(geometry, material(1, true)));
  // Intersect the actual display triangles, keeping contours on the surface.
  const levels = [-.25, .05, .35, .65, .95, 1.25];
  for (let i = 0; i < indices.length; i += 3) for (const level of levels) {
    const ids = indices.slice(i, i + 3), intersections = [];
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3], fa = heights[a], fb = heights[b];
      if ((fa < level) === (fb < level)) continue;
      const t = (level - fa) / (fb - fa);
      intersections.push([positions[a * 3] + t * (positions[b * 3] - positions[a * 3]),
        .95 * level + .014, positions[a * 3 + 2] + t * (positions[b * 3 + 2] - positions[a * 3 + 2])]);
    }
    if (intersections.length === 2) rod(root, ...intersections, .008, .1, 5);
  }
  const trajectories = [[-1.9, 1.8], [1.7, 1.8], [1.8, -1.8]].map(descentPath);
  for (const trajectory of trajectories) {
    const points = trajectory.map(([x, z]) => [x, .95 * lossValue(x, z) + .065, z]);
    for (let i = 1; i < points.length; i++) rod(root, points[i - 1], points[i], .025, .025);
    ball(root, points[0], .07, .08); ball(root, points.at(-1), .095, .85);
    const i = Math.max(1, Math.floor(points.length * .35));
    arrow(root, points[Math.max(0, i - 3)], points[Math.min(points.length - 1, i + 3)], .025, .025);
  }
  root.rotation.set(.5, -.42, -.12);
  root.userData = { theme: 'Machine learning and optimization', trajectories, levels };
  return root;
}

export function policyGraph(depth = 6) {
  const gamma = .92, states = [], rows = [], edges = [];
  for (let row = 0; row <= depth; row++) {
    rows.push([]);
    for (let column = 0; column <= row; column++) {
      const id = states.length;
      rows[row].push(id);
      states.push({ row, column, value: 0, actions: [], policy: null });
    }
  }
  for (let row = depth; row >= 0; row--) for (const id of rows[row]) {
    const state = states[id], { column } = state;
    if (row === depth) {
      state.value = Math.exp(-.5 * ((column - 4) / .85) ** 2) + .3 * Math.exp(-.5 * ((column - 1) / .6) ** 2);
      continue;
    }
    state.actions = [0, 1].map(action => {
      const next = rows[row + 1][column + action];
      const reward = -.02 - .012 * Math.sin(row * 1.4 + column + action) ** 2;
      edges.push([id, next]);
      return { next, reward, q: reward + gamma * states[next].value };
    });
    state.policy = state.actions[1].q > state.actions[0].q ? 1 : 0;
    state.value = state.actions[state.policy].q;
  }
  const points = states.map(({ row, column, value }) => [
    (column - row / 2) * .8, 1.9 - row * .64, 1.8 * (value - .4),
  ]);
  const path = [0];
  while (states[path.at(-1)].policy !== null) {
    const state = states[path.at(-1)]; path.push(state.actions[state.policy].next);
  }
  return { states, points, edges, path, gamma, depth };
}

export function createProjects() {
  const root = new THREE.Group(), graph = policyGraph();
  root.name = 'bellman-decision-policy';
  const route = new Set(graph.path.slice(1).map((v, i) => edgeKey(graph.path[i], v)));
  for (const [a, b] of graph.edges) {
    const selected = route.has(edgeKey(a, b));
    arrow(root, graph.points[a], graph.points[b], selected ? .035 : .013, selected ? .04 : .5);
  }
  graph.points.forEach((point, i) => {
    const selected = graph.path.includes(i);
    ball(root, point, selected ? .105 : .07, selected ? .06 : .35 + .35 * graph.states[i].value);
  });
  root.rotation.set(.12, -.3, -.1);
  root.userData = { theme: 'Reinforcement learning and dynamic programming', ...graph };
  return root;
}
