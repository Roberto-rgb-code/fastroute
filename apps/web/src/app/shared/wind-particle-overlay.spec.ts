import { WindParticleOverlay } from './wind-particle-overlay';

describe('WindParticleOverlay', () => {
  it('vectorFromMeteo convierte dirección meteorológica a componentes u/v', () => {
    const calm = WindParticleOverlay.vectorFromMeteo(0, 0);
    expect(calm.u).toBeGreaterThanOrEqual(0);

    const fromWest = WindParticleOverlay.vectorFromMeteo(20, 270);
    expect(Math.abs(fromWest.u)).toBeGreaterThan(Math.abs(fromWest.v) * 0.5);
  });
});
