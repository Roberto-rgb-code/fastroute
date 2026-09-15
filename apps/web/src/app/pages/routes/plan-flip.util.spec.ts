import { capturePlanFlipRects, playPlanFlip } from './plan-flip.util';

describe('plan-flip.util', () => {
  it('capturePlanFlipRects indexa por data-plan-event-id', () => {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.setAttribute('data-plan-event-id', 'ev-1');
    ul.appendChild(li);
    const map = capturePlanFlipRects(ul);
    expect(map.has('ev-1')).toBe(true);
  });

  it('playPlanFlip no lanza sin nodos', () => {
    expect(() => playPlanFlip(null, new Map())).not.toThrow();
  });
});
