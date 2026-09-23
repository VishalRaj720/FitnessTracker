export interface CoverMap {
  scale: number
  dx: number
  dy: number
}

/**
 * Reproduce CSS `object-fit: cover` in canvas coordinates.
 *
 * The video is scaled to fill its box and the overflow is cropped evenly. Any overlay that
 * wants to sit on top of the video has to apply exactly this transform to normalized
 * landmarks, or it drifts off the body as soon as the box aspect stops matching the camera.
 */
export function coverMap(cssW: number, cssH: number, videoW: number, videoH: number): CoverMap {
  const scale = Math.max(cssW / videoW, cssH / videoH)
  return { scale, dx: (cssW - videoW * scale) / 2, dy: (cssH - videoH * scale) / 2 }
}
