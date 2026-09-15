import { suggestStopOrder } from './route-planner.util';

describe('route-planner.util', () => {
  it('suggestStopOrder prioriza URGENT y ETA', () => {
    const events = [
      { id: '1', position: 2, priority: 'NORMAL', eta: '2026-09-16T12:00:00Z', stop: { id: 'a' } },
      { id: '2', position: 1, priority: 'URGENT', eta: null, stop: { id: 'b' } },
      { id: '3', position: 3, priority: 'NORMAL', eta: '2026-09-16T10:00:00Z', stop: { id: 'c' } },
    ] as never[];
    const order = suggestStopOrder(events).map((e) => e.id);
    expect(order[0]).toBe('2');
    expect(order[1]).toBe('3');
    expect(order[2]).toBe('1');
  });
});
