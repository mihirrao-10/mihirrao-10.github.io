const aliases = {
  'education-uchicago': 'education', 'education-drexel': 'education',
  'experience-mathworks': 'experience', 'experience-resolution': 'experience',
  'project-surface': 'personal-projects', 'project-congestion': 'personal-projects',
  'industry-experience': 'experience', 'personal-notes': 'notes',
  projects: 'personal-projects', contact: 'notes', main: 'top',
};

export function resolveScene(hash, ids) {
  let id;
  try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return 'top'; }
  id = aliases[id] || id || 'top';
  return ids.includes(id) ? id : 'top';
}

export function createNavigation({ scenes, onChange, signal }) {
  const ids = scenes.map(scene => scene.id);
  let current;
  const hint = document.querySelector('.navigation-hint');
  if (hint) hint.hidden = false;
  const on = (target, name, handler) => target.addEventListener(name, handler, { signal });
  function select() {
    const id = resolveScene(location.hash, ids);
    const selected = scenes.find(scene => scene.id === id);
    const page = id === 'top' ? 'about' : id === 'personal-projects' ? 'projects' : id;
    const previous = current;
    current = selected;
    for (const scene of scenes) {
      const active = scene === selected;
      scene.toggleAttribute('data-current-scene', active);
      scene.hidden = !active;
      scene.inert = !active;
    }
    document.body.dataset.page = page;
    for (const link of document.querySelectorAll('.site-index a')) {
      if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (previous !== selected) {
      selected.scrollTop = 0;
      document.title = page === 'about' ? 'Mihir Rao' : `${selected.querySelector('h2')?.textContent || page} · Mihir Rao`;
      if (previous?.contains(document.activeElement)) {
        selected.tabIndex = -1;
        selected.focus({ preventScroll: true });
      }
      onChange?.(selected);
    }
  }
  on(document, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    if (link.classList.contains('skip-link')) {
      current.tabIndex = -1;
      current.focus({ preventScroll: true });
      return;
    }
    const id = resolveScene(link.hash, ids);
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    select();
  });
  function step(direction) {
    const index = ids.indexOf(current.id);
    const id = ids[index + direction];
    if (!id) return false;
    history.pushState(null, '', `#${id}`);
    select();
    return true;
  }

  on(document, 'keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.target.closest?.('.world, input, textarea, select, [contenteditable]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (step(event.key === 'ArrowRight' ? 1 : -1) && hint) hint.hidden = true;
  });
  on(window, 'hashchange', select);
  on(window, 'popstate', select);
  select();
  return { current: () => current };
}
