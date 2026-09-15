/** Captura posiciones antes de reordenar (técnica FLIP). */
export function capturePlanFlipRects(container: HTMLElement | null | undefined): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  if (!container) return map;
  container.querySelectorAll('[data-plan-event-id]').forEach((node) => {
    const id = node.getAttribute('data-plan-event-id');
    if (id) map.set(id, node.getBoundingClientRect());
  });
  return map;
}

/** Anima cada tarjeta desde su posición anterior a la nueva. */
export function playPlanFlip(
  container: HTMLElement | null | undefined,
  before: Map<string, DOMRect>,
  durationMs = 640,
): void {
  if (!container || before.size === 0) return;
  const nodes = container.querySelectorAll<HTMLElement>('[data-plan-event-id]');
  nodes.forEach((node) => {
    const id = node.getAttribute('data-plan-event-id');
    if (!id) return;
    const first = before.get(id);
    if (!first) return;
    const last = node.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    node.style.transform = `translate(${dx}px, ${dy}px)`;
    node.style.transition = 'transform 0s';
  });
  void container.offsetHeight;
  nodes.forEach((node) => {
    node.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    node.style.transform = '';
  });
  window.setTimeout(() => {
    nodes.forEach((node) => {
      node.style.transition = '';
      node.style.transform = '';
    });
  }, durationMs + 80);
}
