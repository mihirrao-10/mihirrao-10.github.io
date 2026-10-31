// Shuffle once at launch; navigation keeps the same one-to-one assignment.
export function shuffledTargets(targets, random = Math.random) {
  const result = [...targets];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignSceneTargets(scenes, random = Math.random) {
  const targets = shuffledTargets(scenes.map(scene => scene.dataset.target), random);
  scenes.forEach((scene, index) => { scene.dataset.target = targets[index]; });
}
