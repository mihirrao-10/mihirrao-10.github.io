import * as THREE from "three";

function meshFrom(positions, colors, indices, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.5, metalness: 0.14,
  }));
  mesh.name = name;
  return mesh;
}

/** An original faceted ribbon around a genuine (2,3) torus-knot centerline. */
export function createResolution() {
  const root = new THREE.Group();
  root.name = "trefoil-ribbon";
  const positions = [], colors = [], indices = [];
  const steps = 512, sides = 24;
  const blue = new THREE.Color("#187fe8"), red = new THREE.Color("#f12f57");
  const color = new THREE.Color(), rim = new THREE.Color("#f6ece5");
  for (let i = 0; i < steps; i++) {
    const t = i / steps * Math.PI * 2;
    const c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);
    const c3 = Math.cos(3 * t), s3 = Math.sin(3 * t);
    const radius = 1.48 + 0.52 * c3;
    const center = new THREE.Vector3(radius * c2, radius * s2, 0.52 * s3);
    const tangent = new THREE.Vector3(-1.56 * s3 * c2 - 2 * radius * s2,
      -1.56 * s3 * s2 + 2 * radius * c2, 1.56 * c3).normalize();
    const normal = new THREE.Vector3(c3 * c2, c3 * s2, s3);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const warm = THREE.MathUtils.smoothstep(s3, -0.28, 0.28);
    for (let j = 0; j < sides; j++) {
      const theta = j / sides * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(normal, 0.265 * Math.cos(theta))
        .addScaledVector(binormal, 0.063 * Math.sin(theta));
      positions.push(point.x, point.y, point.z);
      color.copy(blue).lerp(red, warm);
      color.lerp(rim, 0.12 * Math.abs(Math.sin(theta)) ** 8);
      colors.push(color.r, color.g, color.b);
      const a = i * sides + j, b = ((i + 1) % steps) * sides + j;
      const c = ((i + 1) % steps) * sides + (j + 1) % sides;
      const d = i * sides + (j + 1) % sides;
      indices.push(a, c, b, a, d, c);
    }
  }
  root.add(meshFrom(positions, colors, indices, "red-blue-trefoil-band"));
  root.rotation.set(0.27, -0.34, 0.19);
  root.userData = {
    identity: "resolution", equation: "C(t)=((1.48+0.52cos3t)cos2t,(1.48+0.52cos3t)sin2t,0.52sin3t)",
    meaning: "Abstract mathematical interlude; not a company symbol or financial visualization",
  };
  return root;
}

/** A genuine (3,5) torus-knot centerline, not the former square-root surface. */
export function notesCurve(t) {
  const radius = 1.35 + 0.58 * Math.cos(5 * t);
  return [radius * Math.cos(3 * t), radius * Math.sin(3 * t), 0.58 * Math.sin(5 * t)];
}

/** A rounded, high-resolution tube around the colorful (3,5) torus knot. */
export function createNotes() {
  const root = new THREE.Group();
  root.name = "five-fold-torus-knot";
  const positions = [], colors = [], indices = [];
  const steps = 768, sides = 20;
  const palette = ["#13d9ed", "#6530ec", "#e64db1", "#ffd143", "#13d9ed"].map(hex => new THREE.Color(hex));
  const color = new THREE.Color();
  for (let i = 0; i < steps; i++) {
    const t = i / steps * Math.PI * 2;
    const c3 = Math.cos(3*t), s3 = Math.sin(3*t), c5 = Math.cos(5*t), s5 = Math.sin(5*t);
    const radius = 1.35 + 0.58*c5, center = new THREE.Vector3(...notesCurve(t));
    const tangent = new THREE.Vector3(-2.9*s5*c3-3*radius*s3, -2.9*s5*s3+3*radius*c3, 2.9*c5).normalize();
    const normal = new THREE.Vector3(c5*c3,c5*s3,s5);
    const binormal = new THREE.Vector3().crossVectors(tangent,normal).normalize();
    const at = i / steps * 4, band = Math.floor(at);
    color.copy(palette[band]).lerp(palette[band+1], at-band);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2;
      positions.push(...center.clone().addScaledVector(normal,.145*Math.cos(angle)).addScaledVector(binormal,.145*Math.sin(angle)).toArray());
      colors.push(color.r,color.g,color.b);
      const a=i*sides+j,b=((i+1)%steps)*sides+j,c=((i+1)%steps)*sides+(j+1)%sides,d=i*sides+(j+1)%sides;
      indices.push(a,c,b,a,d,c);
    }
  }
  root.add(meshFrom(positions,colors,indices,"cyan-violet-gold-knot"));
  root.rotation.set(.63,-.39,.24);
  root.userData = {
    identity: "notes", equation: "C(t)=((1.35+0.58cos5t)cos3t,(1.35+0.58cos5t)sin3t,0.58sin5t)",
    meaning: "Original display tube around the (3,5) torus knot; cyan/violet/gold are artistic colors",
  };
  return root;
}
