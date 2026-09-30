// Preferencia visual por operador y navegador. No modifica registros clínicos.
export function equipmentOrdering(container, { getScope, announce }) {
  const orders = new Map();
  let drag = null;
  const cards = () => [...container.querySelectorAll('.equipment-card')];
  const key = () => `termolab-equipment-order:${getScope()}`;
  function order() {
    const scope = key();
    if (!orders.has(scope)) {
      try {
        const saved = JSON.parse(localStorage.getItem(scope) || '[]');
        orders.set(scope, Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
      } catch { orders.set(scope, []); }
    }
    return orders.get(scope);
  }
  function save(card) {
    const ids = cards().map(item => item.dataset.equipmentId);
    orders.set(key(), ids);
    let saved = true;
    try { localStorage.setItem(key(), JSON.stringify(ids)); } catch { saved = false; }
    card.querySelector('.drag-handle').focus({ preventScroll: true });
    announce(saved ? `Orden guardado. ${card.dataset.equipmentCode} en posición ${ids.indexOf(card.dataset.equipmentId) + 1} de ${ids.length}.` : 'Orden actualizado. El navegador no permitió conservarlo para la próxima visita.');
  }
  function cleanup() {
    const previous = drag;
    drag = null;
    if (previous?.handle.hasPointerCapture?.(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    cards().forEach(card => card.classList.remove('is-dragging', 'drop-before', 'drop-after'));
  }
  function decorate(equipment, enabled) {
    cleanup();
    cards().forEach((card, index) => {
      const e = equipment[index];
      card.dataset.equipmentId = e.id;
      card.dataset.equipmentCode = e.code;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'drag-handle';
      handle.disabled = !enabled;
      handle.textContent = '⠿';
      handle.setAttribute('aria-label', `Ordenar ${e.code}. Arrastra o usa las flechas del teclado.`);
      handle.title = 'Arrastra para ordenar · Flechas para mover';
      card.querySelector('.card-top').prepend(handle);
    });
    const saved = order();
    const rank = id => { const index = saved.indexOf(id); return index < 0 ? saved.length : index; };
    cards().sort((a, b) => rank(a.dataset.equipmentId) - rank(b.dataset.equipmentId)).forEach(card => container.append(card));
  }
  container.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.drag-handle');
    if (!handle || handle.disabled || event.button !== 0 || event.isPrimary === false) return;
    cleanup();
    handle.focus({ preventScroll: true });
    drag = { handle, card: handle.closest('.equipment-card'), pointerId: event.pointerId, x: event.clientX, y: event.clientY, target: null, active: false };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  container.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.active = true;
    drag.card.classList.add('is-dragging');
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.equipment-card');
    cards().forEach(card => card.classList.remove('drop-before', 'drop-after'));
    drag.target = target && container.contains(target) && target !== drag.card ? target : null;
    if (drag.target) {
      drag.after = cards().indexOf(target) > cards().indexOf(drag.card);
      target.classList.add(drag.after ? 'drop-after' : 'drop-before');
    }
    event.preventDefault();
  });
  container.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { card, target, after, active } = drag;
    cleanup();
    if (active && target) { target.insertAdjacentElement(after ? 'afterend' : 'beforebegin', card); save(card); }
  });
  container.addEventListener('pointercancel', cleanup);
  container.addEventListener('lostpointercapture', () => { if (drag) cleanup(); });
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { cleanup(); event.preventDefault(); return; }
    const handle = event.target.closest('.drag-handle');
    if (!handle || handle.disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const card = handle.closest('.equipment-card');
    const backward = ['ArrowLeft', 'ArrowUp'].includes(event.key);
    const target = backward ? card.previousElementSibling : card.nextElementSibling;
    if (target?.matches('.equipment-card')) { target.insertAdjacentElement(backward ? 'beforebegin' : 'afterend', card); save(card); }
  });
  return { decorate };
}
