import { ROUTE_BADGE, ROUTE_LABEL } from './status';

describe('status labels', () => {
  it('covers all route statuses used in ops UI', () => {
    for (const key of Object.keys(ROUTE_LABEL)) {
      expect(ROUTE_BADGE[key]).toBeDefined();
      expect(ROUTE_LABEL[key].length).toBeGreaterThan(0);
    }
  });

  it('maps ENROUTE to info badge and Spanish label', () => {
    expect(ROUTE_LABEL.ENROUTE).toBe('En ruta');
    expect(ROUTE_BADGE.ENROUTE).toBe('info');
  });
});
