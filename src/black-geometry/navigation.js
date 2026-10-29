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
    if (!id) return;
    history.pushState(null, '', `#${id}`);
    select();
  }

  // Treat a trackpad gesture and its inertial tail as one page change.
  let wheelDistance = 0, wheelUsed = false, wheelTimer;
  document.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    if (event.target.closest?.('.world')) return;
    if (event.cancelable) event.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelDistance = 0; wheelUsed = false; }, 250);
    if (wheelUsed) return;
    wheelDistance += event.deltaX;
    if (Math.abs(wheelDistance) >= 40) {
      wheelUsed = true;
      step(Math.sign(wheelDistance));
    }
  }, { signal, passive: false });
  signal?.addEventListener('abort', () => clearTimeout(wheelTimer), { once: true });

  let drag;
  on(document, 'pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary ||
        event.target.closest?.('.world, a, button, input, textarea, select, [contenteditable]')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  });
  on(document, 'pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) drag.horizontal = true;
    if (drag.horizontal && event.cancelable) event.preventDefault();
  });
  on(document, 'pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.horizontal && Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    drag = undefined;
  });
  on(document, 'pointercancel', () => { drag = undefined; });
  on(document, 'keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.target.closest?.('.world, input, textarea, select, [contenteditable]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  });
  on(window, 'hashchange', select);
  on(window, 'popstate', select);
  select();
  return { current: () => current };
}
