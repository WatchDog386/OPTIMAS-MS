import { describe, expect, it } from 'vitest';
import { describeStep, estimateRoute, parseOsrm } from '../src/lib/routing';

const step = (type: string, modifier: string | undefined, name: string, extra: Record<string, unknown> = {}) => ({
  distance: 120.4,
  duration: 30.2,
  name,
  maneuver: { type, modifier, location: [36.8, -1.29] as [number, number], ...extra },
});

describe('routing', () => {
  it('reads an OSRM route into lat/lng geometry and spoken steps', () => {
    const route = parseOsrm({
      code: 'Ok',
      routes: [
        {
          distance: 4321.6,
          duration: 612.4,
          geometry: { coordinates: [[36.8167, -1.2833], [36.80, -1.287], [36.7834, -1.2905]] },
          legs: [{ steps: [step('depart', undefined, 'Kenyatta Avenue'), step('turn', 'left', 'Valley Road'), step('roundabout', 'right', 'Ngong Road', { exit: 2 }), step('arrive', undefined, '')] }],
        },
      ],
    });
    expect(route).toMatchObject({ distance: 4322, duration: 612, source: 'road' });
    expect(route.geometry[0]).toEqual([-1.2833, 36.8167]);
    expect(route.steps.map((s) => s.instruction)).toEqual([
      'Start along Kenyatta Avenue',
      'Turn left onto Valley Road',
      'At the roundabout, take exit 2 onto Ngong Road',
      'You have arrived at the customer',
    ]);
    expect(route.steps[1]).toMatchObject({ lat: -1.29, lng: 36.8, distance: 120 });
    expect(() => parseOsrm({ code: 'NoRoute' })).toThrow();
  });

  it('describes the less common manoeuvres', () => {
    expect(describeStep(step('turn', 'uturn', 'Mombasa Road'))).toBe('Make a U-turn onto Mombasa Road');
    expect(describeStep(step('new name', 'straight', 'Waiyaki Way'))).toBe('Continue along Waiyaki Way');
    expect(describeStep(step('end of road', 'slight right', ''))).toBe('At the end of the road, turn slight right');
    expect(describeStep(step('fork', 'left', 'Thika Road'))).toBe('Keep left at the fork onto Thika Road');
  });

  it('estimates sensibly when there is no road data', () => {
    const r = estimateRoute([-1.2833, 36.8167], [-1.2905, 36.7834]);
    expect(r.source).toBe('estimate');
    expect(r.distance).toBeGreaterThan(3700 * 1.3);
    expect(r.duration / 60).toBeGreaterThan(8);
    expect(r.duration / 60).toBeLessThan(20);
  });
});
