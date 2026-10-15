export type ImageSize = { width: number; height: number };
export type ContainedRect = { x: number; y: number; width: number; height: number };

/**
 * Returns a shared canvas scaled uniformly from the largest input bounding box.
 * Neither dimension is clamped independently, so the canvas ratio is retained.
 */
export function getComparisonCanvasSize(a: ImageSize, b: ImageSize, maxDimension = 1200): ImageSize {
  if (
    !Number.isFinite(a.width) || !Number.isFinite(a.height) ||
    !Number.isFinite(b.width) || !Number.isFinite(b.height) ||
    a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0 ||
    !Number.isFinite(maxDimension) || maxDimension <= 0
  ) {
    throw new RangeError('Image dimensions and maximum canvas dimension must be positive finite numbers.');
  }

  const boundWidth = Math.max(a.width, b.width);
  const boundHeight = Math.max(a.height, b.height);
  const scale = Math.min(1, maxDimension / boundWidth, maxDimension / boundHeight);

  return {
    width: Math.max(1, Math.round(boundWidth * scale)),
    height: Math.max(1, Math.round(boundHeight * scale)),
  };
}

/** Calculate an aspect-ratio-preserving centered rectangle inside a canvas. */
export function getContainedRect(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): ContainedRect {
  if ([imageWidth, imageHeight, canvasWidth, canvasHeight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Image and canvas dimensions must be positive finite numbers.');
  }

  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}
