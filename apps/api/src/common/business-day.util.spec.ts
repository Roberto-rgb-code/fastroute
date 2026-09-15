import { RouteStatus } from '@prisma/client';
import {
  businessDayOf,
  businessDayRange,
  effectiveStart,
  shiftDay,
} from './business-day.util';
import {
  canTransition,
  isActiveRoute,
  isOpenRoute,
  isTerminalRoute,
  mapRouteStatusToEntityStatus,
} from './route-status.util';

describe('businessDayOf', () => {
  it('maps UTC midnight to previous MX day (UTC-6)', () => {
    expect(businessDayOf(new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-09-14');
  });

  it('maps 06:00 UTC to same calendar day in MX', () => {
    expect(businessDayOf(new Date('2026-09-15T06:00:00.000Z'))).toBe('2026-09-15');
  });
});

describe('businessDayRange', () => {
  it('returns [06:00Z, next 06:00Z) for a business day', () => {
    const { start, end } = businessDayRange('2026-09-15');
    expect(start.toISOString()).toBe('2026-09-15T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-16T06:00:00.000Z');
  });

  it('rejects invalid dates', () => {
    expect(() => businessDayRange('15-09-2026')).toThrow(/inválida/i);
  });
});

describe('shiftDay', () => {
  it('moves forward and backward by calendar days', () => {
    expect(shiftDay('2026-09-15', 1)).toBe('2026-09-16');
    expect(shiftDay('2026-09-15', -1)).toBe('2026-09-14');
  });
});

describe('effectiveStart', () => {
  it('prefers dateStarted when present', () => {
    const dateStart = new Date('2026-09-15T12:00:00Z');
    const dateStarted = new Date('2026-09-15T14:00:00Z');
    expect(effectiveStart({ dateStarted, dateStart })).toBe(dateStarted);
    expect(effectiveStart({ dateStarted: null, dateStart })).toBe(dateStart);
  });
});

describe('route status helpers', () => {
  it('classifies active / open / terminal', () => {
    expect(isActiveRoute(RouteStatus.ENROUTE)).toBe(true);
    expect(isActiveRoute(RouteStatus.PENDING)).toBe(false);
    expect(isOpenRoute(RouteStatus.PENDING)).toBe(true);
    expect(isTerminalRoute(RouteStatus.COMPLETED)).toBe(true);
  });

  it('allows valid transitions only', () => {
    expect(canTransition(RouteStatus.PENDING, RouteStatus.CHECKLIST)).toBe(true);
    expect(canTransition(RouteStatus.PENDING, RouteStatus.ENROUTE)).toBe(false);
    expect(canTransition(RouteStatus.ENROUTE, RouteStatus.PAUSED)).toBe(true);
    expect(canTransition(RouteStatus.COMPLETED, RouteStatus.ENROUTE)).toBe(false);
  });

  it('maps route status to driver/vehicle entity status', () => {
    expect(mapRouteStatusToEntityStatus(RouteStatus.ENROUTE)).toEqual({
      driver: 'ENROUTE',
      vehicle: 'ENROUTE',
    });
    expect(mapRouteStatusToEntityStatus(RouteStatus.FINISHED)).toEqual({
      driver: 'AVAILABLE',
      vehicle: 'AVAILABLE',
    });
  });
});
