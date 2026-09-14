import * as THREE from "three";
import {
  surfaceData,
  surfacePoint,
  pathPoint,
  NETWORK,
  SURFACE_ROTATION,
  TAU,
} from "./geometry.js";
import { QUALITY } from "./preferences.js";

const color = 0x78b7e8;
function geometryFrom(positions, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (indices) {
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}
function line(points, opacity = 0.4) {
  return new THREE.Line(
    geometryFrom(points.flat()),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}
function points(positions, size = 0.035, opacity = 0.8) {
  return new THREE.Points(
    geometryFrom(positions.flat()),
    new THREE.PointsMaterial({
      color: 0xb0d5ef,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
    }),
  );
}
function retainOpacity(group) {
  group.traverse((object) => {
    if (object.material) {
      object.material.userData.baseOpacity = object.material.opacity;
      object.material.transparent = true;
    }
  });
  return group;
}
function weight(group, value) {
  group.visible = value > 0.003;
  if (group.visible)
    group.traverse((object) => {
      if (object.material)
        object.material.opacity = object.material.userData.baseOpacity * value;
    });
}
function disposeGroup(group) {
  const geometries = new Set(),
    materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  group.removeFromParent();
}
function makeSurface(profile, path = false) {
  const root = new THREE.Group();
  const data = surfaceData(profile.around, profile.across);
  const geometry = geometryFrom(data.positions, data.indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x141c23,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  root.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.23 }),
  );
  root.add(edges);
  const samples = [];
  for (let i = 0; i < 20; i++)
    samples.push(
      surfacePoint((i / 20) * TAU, 1.2 + 0.6 * Math.sin(i * 1.8), 0.015),
    );
  root.add(points(samples, 0.025, 0.5));
  if (!path)
    root.add(
      line(
        Array.from({ length: 64 }, (_, i) => pathPoint(i / 63)),
        0.36,
      ),
    );
  let route;
  if (path) {
    class SurfacePath extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        return target.fromArray(pathPoint(t));
      }
    }
    route = new THREE.Mesh(
      new THREE.TubeGeometry(new SurfacePath(), 160, 0.012, 5, false),
      new THREE.MeshBasicMaterial({ color: 0xb8e2ff }),
    );
    root.add(route);
    const dotGeometry = new THREE.SphereGeometry(0.042, 10, 8),
      dotMaterial = new THREE.MeshBasicMaterial({ color: 0xf0f8ff });
    for (const t of [0, 1]) {
      const endpoint = new THREE.Mesh(dotGeometry, dotMaterial);
      endpoint.position.fromArray(pathPoint(t));
      root.add(endpoint);
    }
  }
  retainOpacity(root);
  return { root, route, edges };
}
function makeChapter(chapter) {
  const root = new THREE.Group();
  const nodes = Array.from({ length: 18 }, (_, i) =>
    surfacePoint((i / 18) * TAU, 1.0 + 0.4 * Math.cos(i * 0.9)),
  );
  if (chapter === "education") {
    root.add(line(nodes.concat([nodes[0]]), 0.15), points(nodes, 0.028, 0.4));
    root.add(
      line([nodes[4], nodes[8], nodes[12]], 0.8),
      points([nodes[4], nodes[12]], 0.09, 1),
    );
    for (const index of [4, 12]) {
      const p = nodes[index];
      root.add(
        line(
          [
            [p[0] - 0.24, p[1], p[2]],
            [p[0] + 0.24, p[1], p[2]],
          ],
          0.45,
        ),
      );
      root.add(
        line(
          [
            [p[0], p[1] - 0.24, p[2]],
            [p[0], p[1] + 0.24, p[2]],
          ],
          0.45,
        ),
      );
    }
  } else if (chapter === "experience") {
    root.add(line(nodes.concat([nodes[0]]), 0.14));
    for (let i = 0; i < 6; i++) {
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.63, 0.63, 0.55)),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.27,
        }),
      );
      box.position.fromArray(nodes[i * 3]);
      root.add(box);
      const p = nodes[i * 3],
        samples = [];
      for (let j = 0; j < 5; j++)
        samples.push([
          p[0] + Math.sin(j * 2 + i) * 0.2,
          p[1] + Math.cos(j * 3 + i) * 0.2,
          p[2] + Math.sin(j + i) * 0.2,
        ]);
      root.add(points(samples, 0.035, 0.68));
    }
  } else if (chapter === "research" || chapter === "teaching") {
    root.add(points(nodes, 0.045, 0.65), line(nodes.concat([nodes[0]]), 0.22));
    for (let i = 0; i < 18; i += 2)
      root.add(line([nodes[i], nodes[(i + 5) % 18]], 0.15));
    if (chapter === "research") {
      for (const i of [2, 3, 5, 8, 11])
        root.add(line([nodes[5], nodes[i]], 0.72));
      root.add(points([nodes[5]], 0.105, 1));
    } else {
      const traversal = line(nodes.slice(3, 12), 0.95);
      root.add(traversal);
      root.userData.traversal = traversal;
      root.add(points([nodes[3], nodes[11]], 0.075, 0.95));
    }
  } else {
    const grid = [];
    for (let i = -3; i <= 3; i++) {
      grid.push(
        [-2, i * 0.36, -0.2],
        [2, i * 0.36, -0.2],
        [i * 0.65, -1.1, -0.2],
        [i * 0.65, 1.1, -0.2],
      );
    }
    root.add(
      new THREE.LineSegments(
        geometryFrom(grid.flat()),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: chapter === "contact" ? 0.055 : 0.1,
        }),
      ),
    );
    root.add(
      points(
        nodes.filter((_, i) => i % 3 === 0),
        0.025,
        0.3,
      ),
    );
  }
  return retainOpacity(root);
}
function makeNetwork() {
  const root = new THREE.Group(),
    edges = [],
    arrows = [];
  for (const [a, b] of NETWORK.edges) {
    const start = new THREE.Vector3(...NETWORK.nodes[a]),
      end = new THREE.Vector3(...NETWORK.nodes[b]);
    const direction = end.clone().sub(start).normalize();
    const edge = line(
      [
        start.clone().addScaledVector(direction, 0.13).toArray(),
        end.clone().addScaledVector(direction, -0.17).toArray(),
      ],
      0.7,
    );
    root.add(edge);
    edges.push(edge);
    const tip = end.clone().addScaledVector(direction, -0.23),
      side = new THREE.Vector3(-direction.y, direction.x, 0);
    const arrow = line(
      [
        tip
          .clone()
          .addScaledVector(direction, -0.1)
          .addScaledVector(side, 0.06)
          .toArray(),
        tip.toArray(),
        tip
          .clone()
          .addScaledVector(direction, -0.1)
          .addScaledVector(side, -0.06)
          .toArray(),
      ],
      0.9,
    );
    root.add(arrow);
    arrows.push(arrow);
  }
  const dotGeo = new THREE.SphereGeometry(0.065, 12, 8),
    dotMat = new THREE.MeshBasicMaterial({ color: 0xb7d9f0 });
  for (const p of NETWORK.nodes) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.fromArray(p);
    root.add(dot);
  }
  const markerGeo = new THREE.SphereGeometry(0.025, 8, 6),
    markerMat = new THREE.MeshBasicMaterial({ color: 0xc5e6ff });
  const markers = Array.from({ length: 12 }, () => {
    const marker = new THREE.Mesh(markerGeo, markerMat);
    root.add(marker);
    return marker;
  });
  return { root, edges, arrows, markers };
}

/** One WebGL context, one background pass, at most one visible project pass. */
export function createWorld({ container, quality, onFailure }) {
  let renderer,
    disposed = false,
    shaderFailed = false,
    currentQuality = quality;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x080808, 0);
    renderer.autoClear = false;
    renderer.debug.onShaderError = () => {
      shaderFailed = true;
    };
  } catch (error) {
    renderer?.dispose();
    throw error;
  }
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);
  const contextLost = (event) => {
    event.preventDefault();
    onFailure(new Error("WebGL context lost"));
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  const background = new THREE.Scene(),
    stageScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 35),
    stageCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 35);
  function light(scene) {
    scene.add(new THREE.HemisphereLight(0xc3def0, 0x080b0e, 1.3));
    const key = new THREE.DirectionalLight(0xaccde7, 3.8);
    key.position.set(-3, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6599c4, 2.5);
    rim.position.set(4, -1, -2);
    scene.add(rim);
  }
  light(background);
  light(stageScene);
  const pivot = new THREE.Group();
  background.add(pivot);
  let surface = makeSurface(QUALITY[quality]),
    projectSurface = makeSurface(QUALITY[quality], true);
  pivot.add(surface.root);
  stageScene.add(projectSurface.root);
  const chapters = Object.fromEntries(
    ["education", "experience", "research", "teaching", "notes", "contact"].map(
      (chapter) => [chapter, makeChapter(chapter)],
    ),
  );
  Object.values(chapters).forEach((group) => pivot.add(group));
  const network = makeNetwork();
  stageScene.add(network.root);
  let width = 1,
    height = 1,
    frames = 0,
    drawCalls = 0,
    triangles = 0;
  function resize(w, h, dpr = 1) {
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(dpr, QUALITY[currentQuality].dpr));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  return {
    resize,
    setQuality(next) {
      if (next === currentQuality) return;
      currentQuality = next;
      disposeGroup(surface.root);
      disposeGroup(projectSurface.root);
      surface = makeSurface(QUALITY[next]);
      projectSurface = makeSurface(QUALITY[next], true);
      pivot.add(surface.root);
      stageScene.add(projectSurface.root);
    },
    render({ state, pose, time, project, stage, scrollY, mobile, focused }) {
      if (disposed) return;
      renderer.info.reset();
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.clear();
      const [x, y, z, rx, ry, rz, scale] = pose;
      camera.position.set(0, 0, z);
      camera.lookAt(0, 0, 0);
      const viewHeight = 2 * z * Math.tan(THREE.MathUtils.degToRad(18));
      pivot.position.set(
        ((x - 0.5) * viewHeight * width) / height,
        (0.5 - y) * viewHeight,
        0,
      );
      pivot.rotation.set(rx, ry, rz);
      pivot.scale.setScalar(scale);
      weight(surface.root, 0);
      Object.values(chapters).forEach((group) => weight(group, 0));
      const names = [
        "hero",
        "education",
        "experience",
        "research",
        "teaching",
        "project-surface",
        "project-congestion",
        "notes",
        "contact",
      ];
      for (const [index, amount] of [
        [state.index, 1 - state.blend],
        [state.next, state.blend],
      ]) {
        const name = names[index];
        if (name === "hero") weight(surface.root, amount);
        else if (chapters[name])
          weight(chapters[name], amount * (mobile ? 0.16 : 1));
      }
      const traversal = chapters.teaching.userData.traversal;
      traversal.geometry.setDrawRange(
        0,
        Math.max(2, Math.floor(2 + state.progress * 7)),
      );
      renderer.render(background, camera);
      drawCalls = renderer.info.render.calls;
      triangles = renderer.info.render.triangles;
      if (stage) {
        const top = stage.top - scrollY;
        const sx = Math.max(0, stage.left),
          sy = Math.max(0, height - top - stage.height);
        const sw = Math.min(width, stage.left + stage.width) - sx,
          sh = Math.min(height, top + stage.height) - Math.max(0, top);
        if (sw > 0 && sh > 0) {
          renderer.setScissorTest(true);
          renderer.setScissor(sx, sy, sw, sh);
          renderer.setViewport(
            stage.left,
            height - top - stage.height,
            stage.width,
            stage.height,
          );
          renderer.clearDepth();
          stageCamera.aspect = stage.width / stage.height;
          stageCamera.position.set(0, 0, stage.kind === "surface" ? 7.3 : 7.6);
          stageCamera.lookAt(0, 0, 0);
          stageCamera.updateProjectionMatrix();
          projectSurface.root.visible = stage.kind === "surface";
          network.root.visible = stage.kind === "congestion";
          if (projectSurface.root.visible) {
            projectSurface.root.rotation.set(...SURFACE_ROTATION);
            projectSurface.root.rotation.y += Math.sin(time / 13) * 0.025;
            const fit = Math.min(1, stage.width / stage.height / 1.25);
            projectSurface.root.scale.setScalar(fit);
            projectSurface.route.geometry.setDrawRange(
              0,
              Math.floor(project.path * 160) * 5 * 6,
            );
            projectSurface.edges.material.opacity = focused ? 0.42 : 0.27;
          } else {
            const open = project.shortcut === "open";
            network.root.scale.setScalar(
              Math.min(1, stage.width / stage.height / 1.25),
            );
            network.edges[4].visible = network.arrows[4].visible = open;
            network.edges.forEach((edge, i) => {
              edge.material.opacity = open && (i === 1 || i === 2) ? 0.23 : 0.8;
            });
            const routes = open ? NETWORK.open : NETWORK.closed;
            network.markers.forEach((marker, i) => {
              const route = routes[i % routes.length];
              const travel = (time * 0.13 + i / 6) % (route.length - 1),
                segment = Math.floor(travel),
                t = travel - segment;
              const a = NETWORK.nodes[route[segment]],
                b = NETWORK.nodes[route[segment + 1]];
              marker.position.set(
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
                0,
              );
            });
          }
          renderer.render(stageScene, stageCamera);
          drawCalls += renderer.info.render.calls;
          triangles += renderer.info.render.triangles;
          renderer.setScissorTest(false);
        }
      }
      if (shaderFailed) throw new Error("Shader initialization failed");
      frames++;
    },
    snapshot: () => ({
      frames,
      drawCalls,
      triangles,
      quality: currentQuality,
      dpr: renderer.getPixelRatio(),
      geometries: renderer.info.memory.geometries,
      contextLost: renderer.getContext().isContextLost(),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", contextLost);
      disposeGroup(background);
      disposeGroup(stageScene);
      renderer.dispose();
      canvas.remove();
    },
  };
}
