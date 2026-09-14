import {
  surfaceData,
  rotatePoint,
  pathPoint,
  NETWORK,
} from "../../src/black-geometry/geometry.js";

const n = (value) => value.toFixed(2);
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none">${body}</svg>\n`;
const project = ([x, y, z]) => [400 + x * 136, 300 - y * 136, z];

export function surfacePoster(withPath = false) {
  const { positions, indices } = surfaceData(48, 18);
  const vertices = [];
  for (let i = 0; i < positions.length; i += 3)
    vertices.push(project(rotatePoint(positions.slice(i, i + 3))));
  const faces = [];
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => vertices[index]);
    const depth = points.reduce((sum, p) => sum + p[2], 0) / 3;
    const brightness = Math.round(12 + (depth + 2) * 5);
    faces.push({
      depth,
      markup: `<path d="M${points.map((p) => `${n(p[0])} ${n(p[1])}`).join("L")}Z" fill="rgb(${brightness - 3},${brightness + 1},${brightness + 5})" stroke="#78b7e8" stroke-opacity="${n(0.1 + (depth + 2) * 0.043)}" stroke-width=".6"/>`,
    });
  }
  let body = faces
    .sort((a, b) => a.depth - b.depth)
    .map((f) => f.markup)
    .join("");
  if (withPath) {
    const points = Array.from({ length: 97 }, (_, i) =>
      project(rotatePoint(pathPoint(i / 96))),
    );
    body += `<path d="M${points.map((p) => `${n(p[0])} ${n(p[1])}`).join("L")}" stroke="#a8d7f4" stroke-width="2.1"/>`;
    for (const p of [points[0], points.at(-1)])
      body += `<circle cx="${n(p[0])}" cy="${n(p[1])}" r="4" fill="#f5f5f5"/>`;
  }
  return svg(body);
}
export function networkPoster(open = true) {
  const nodes = NETWORK.nodes.map(project);
  let body =
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" stroke="#78b7e8" stroke-width="1.5"/></marker></defs>';
  NETWORK.edges.forEach(([a, b], i) => {
    if (i === 4 && !open) return;
    const start = nodes[a],
      end = nodes[b],
      dx = end[0] - start[0],
      dy = end[1] - start[1],
      len = Math.hypot(dx, dy);
    body += `<path d="M${n(start[0] + (dx / len) * 15)} ${n(start[1] + (dy / len) * 15)}L${n(end[0] - (dx / len) * 22)} ${n(end[1] - (dy / len) * 22)}" stroke="#78b7e8" stroke-opacity="${open && (i === 1 || i === 2) ? ".3" : ".9"}" stroke-width="${i === 4 ? 2 : 1.2}" marker-end="url(#arrow)"/>`;
  });
  const routes = open ? NETWORK.open : NETWORK.closed;
  for (const route of routes)
    for (let edge = 0; edge < route.length - 1; edge++) {
      const a = nodes[route[edge]],
        b = nodes[route[edge + 1]];
      for (const t of [0.28, 0.58])
        body += `<circle cx="${n(a[0] + (b[0] - a[0]) * t)}" cy="${n(a[1] + (b[1] - a[1]) * t)}" r="3" fill="#a8d7f4"/>`;
    }
  nodes.forEach(([x, y], i) => {
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="10" fill="#0d1318" stroke="#a8d7f4"/><text x="${n(x)}" y="${n(y + (i === 1 ? -27 : 36))}" fill="#b5b5b5" font-family="Georgia,serif" font-size="18" text-anchor="middle">${["S", "U", "V", "T"][i]}</text>`;
  });
  return svg(body);
}

export function posterOutputs() {
  return new Map([
    ["poster.svg", surfacePoster()],
    ["project-surface.svg", surfacePoster(true)],
    ["project-congestion-open.svg", networkPoster(true)],
    ["project-congestion-closed.svg", networkPoster(false)],
  ]);
}
