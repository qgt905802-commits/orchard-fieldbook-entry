// The paper, photograph, specimen and sight line share a vanishing point.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const scenes = [...document.querySelectorAll('.specimen')];
  const visible = new Set();
  const pending = new Map();
  let frame = 0;

  function position(scene, x, y) {
    pending.set(scene, [x,y]);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const [element, [dx, dy]] of pending) {
        element.style.setProperty('--tilt-x', (-dy * 10).toFixed(2) + 'deg');
        element.style.setProperty('--tilt-y', (dx * 15).toFixed(2) + 'deg');
        element.style.setProperty('--drift-x', (dx * 7).toFixed(1) + 'px');
        element.style.setProperty('--drift-y', (dy * 4).toFixed(1) + 'px');
      }
      pending.clear();
    });
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else { visible.delete(entry.target); position(entry.target, 0, 0); }
    }
  });
  for (const scene of scenes) {
    observer.observe(scene);
    // The surrounding plate is the hit area. It never handles canvas gestures.
    const plate = scene.parentElement;
    plate.addEventListener('pointermove', event => {
      if (!motion.matches || !fine.matches || !visible.has(scene) || event.pointerType === 'touch') return;
      const box = plate.getBoundingClientRect();
      position(scene, (event.clientX-box.left)/box.width*2-1, (event.clientY-box.top)/box.height*2-1);
    }, { passive: true });
    plate.addEventListener('pointerleave', () => position(scene, 0, 0));
  }
  window.addEventListener('scroll', () => {
    if (!motion.matches || fine.matches) return;
    for (const scene of visible) {
      const box = scene.getBoundingClientRect();
      const offset = Math.max(-1, Math.min(1, (.4 * innerHeight - box.top - box.height/2) / innerHeight));
      position(scene, offset * .65, offset);
    }
  }, { passive: true });
  // Only the plate travels across routes. Forms and the annotation canvas stay interactive.
  const handoffKey = 'orchard-plate-handoff';
  let plateFlight;
  function movePlate(from, scene) {
    if (!scene || !from || !motion.matches || !scene.animate) return;
    const to = scene.getBoundingClientRect();
    if (!to.width || !from.width || from.bottom < 0 || from.top > innerHeight || to.top > innerHeight) return;
    const dx = from.left + from.width/2 - to.left - to.width/2;
    const dy = from.top + from.height/2 - to.top - to.height/2;
    const ratio = Math.max(.6, Math.min(1.65, from.width/to.width));
    plateFlight?.cancel();
    plateFlight = scene.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + ratio + ')', opacity: .7 },
      { transform: 'none', opacity: 1 }
    ], { duration: 410, easing: 'cubic-bezier(.18,.75,.23,1)' });
  }
  document.addEventListener('orchard-screen', event => {
    if (event.detail.from) movePlate(event.detail.from, event.detail.scene);
    else receivePlate();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a.model-progress-entry, a.progress-link');
    if (!link || !motion.matches || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const scene = scenes.find(item => item.getBoundingClientRect().width);
    if (!scene) return;
    try {
      sessionStorage.setItem(handoffKey, JSON.stringify({ to: link.pathname, at: Date.now(),
        rect: scene.getBoundingClientRect().toJSON() }));
    } catch { /* Storage can be unavailable in private browsing. */ }
  });
  function receivePlate() {
    try {
      const record = JSON.parse(sessionStorage.getItem(handoffKey));
      if (!record || record.to !== location.pathname) return;
      if (Date.now() - record.at > 10000) { sessionStorage.removeItem(handoffKey); return; }
      const scene = scenes.find(item => item.getBoundingClientRect().width);
      if (!scene) return;
      sessionStorage.removeItem(handoffKey);
      movePlate(record.rect, scene);
    } catch { /* Ordinary navigation works without a handoff. */ }
  }
  document.addEventListener('orchard-report-ready', receivePlate);
  window.addEventListener('pageshow', receivePlate);
  motion.addEventListener('change', () => { plateFlight?.cancel(); scenes.forEach(scene => position(scene, 0, 0)); });
})();
