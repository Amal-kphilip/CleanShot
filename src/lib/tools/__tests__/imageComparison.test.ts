import { describe, expect, it } from 'vitest';
import { getComparisonCanvasSize, getContainedRect } from '../imageComparison';

describe('image comparison sizing', () => {
  it('keeps the shared canvas aspect ratio when dimensions are capped', () => {
    const size = getComparisonCanvasSize(
      { width: 1619, height: 972 },
      { width: 3000, height: 1687 },
    );

    expect(size).toEqual({ width: 1200, height: 675 });
    expect(size.width / size.height).toBeCloseTo(3000 / 1687, 2);
  });

  it('handles portrait images without independently clamping canvas dimensions', () => {
    expect(getComparisonCanvasSize(
      { width: 1200, height: 2400 },
      { width: 800, height: 1000 },
    )).toEqual({ width: 600, height: 1200 });
  });

  it('centers a landscape image in a portrait canvas without stretching or cropping', () => {
    const rect = getContainedRect(1600, 900, 600, 1200);

    expect(rect.width).toBeCloseTo(600);
    expect(rect.height).toBeCloseTo(337.5);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo((1200 - 337.5) / 2);
    expect(rect.width / rect.height).toBeCloseTo(1600 / 900);
  });

  it('centers a portrait image in a landscape canvas without stretching or cropping', () => {
    const rect = getContainedRect(900, 1600, 1200, 675);

    expect(rect.width).toBeCloseTo(379.6875);
    expect(rect.height).toBeCloseTo(675);
    expect(rect.x).toBeCloseTo((1200 - 379.6875) / 2);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.width / rect.height).toBeCloseTo(900 / 1600);
  });
});
