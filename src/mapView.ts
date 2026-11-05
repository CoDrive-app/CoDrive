/**
 * The maths behind the trip map, with no drawing in it. Places are converted to Web Mercator "world"
 * coordinates, the same grid the map tiles use, so the route and pins line up with the streets.
 * At zoom 0 the whole world is one 256 x 256 square; each zoom level doubles that.
 */

export const TILE_SIZE = 256;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 20;
/** The tiles stop at this zoom level. Zooming further would only stretch them. */
const MAX_TILE_ZOOM = 20;
/** How close a whole-route view may get, so a single stop doesn't open at the closest zoom. */
const MAX_FIT_ZOOM = 16;
/** Web Mercator can't show the poles, and the tiles stop at this latitude. */
const MAX_LATITUDE = 85.05112878;

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
/** The world point at the centre of the screen, and how far in the map is. */
export type Camera = { x: number; y: number; zoom: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Keeps the map on the world north to south. East to west it is free to wrap around. */
export function clampCamera(camera: Camera): Camera {
  return { x: camera.x, y: Math.min(TILE_SIZE, Math.max(0, camera.y)), zoom: clampZoom(camera.zoom) };
}

export function project(latitude: number, longitude: number): Point {
  const lat = Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * TILE_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE,
  };
}

export function toScreen(camera: Camera, size: Size, world: Point): Point {
  const scale = 2 ** camera.zoom;
  return { x: size.w / 2 + (world.x - camera.x) * scale, y: size.h / 2 + (world.y - camera.y) * scale };
}

/** The camera that fits every point into the part of the screen left clear by the padding. */
export function fitCamera(points: Point[], size: Size, padding: Padding): Camera {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxW = Math.max(40, size.w - padding.left - padding.right);
  const boxH = Math.max(40, size.h - padding.top - padding.bottom);
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(width > 0 ? boxW / width : Infinity, height > 0 ? boxH / height : Infinity);
  const zoom = Number.isFinite(scale) ? Math.min(MAX_FIT_ZOOM, clampZoom(Math.log2(scale))) : MAX_FIT_ZOOM;
  // The middle of the points goes to the middle of the clear box, which may not be the middle of the screen.
  const shiftX = (padding.left - padding.right) / 2;
  const shiftY = (padding.top - padding.bottom) / 2;
  const finalScale = 2 ** zoom;
  return clampCamera({
    x: (minX + maxX) / 2 - shiftX / finalScale,
    y: (minY + maxY) / 2 - shiftY / finalScale,
    zoom,
  });
}

/** Moves and zooms the camera so the world point under `from` ends up under `to`. */
export function moveCamera(camera: Camera, size: Size, from: Point, to: Point, zoom: number): Camera {
  const oldScale = 2 ** camera.zoom;
  const nextZoom = clampZoom(zoom);
  const newScale = 2 ** nextZoom;
  const worldX = camera.x + (from.x - size.w / 2) / oldScale;
  const worldY = camera.y + (from.y - size.h / 2) / oldScale;
  return clampCamera({
    x: worldX - (to.x - size.w / 2) / newScale,
    y: worldY - (to.y - size.h / 2) / newScale,
    zoom: nextZoom,
  });
}

/** The tile zoom that looks sharpest at this camera zoom. */
export function tileZoomFor(zoom: number) {
  return Math.min(MAX_TILE_ZOOM, Math.max(0, Math.round(zoom)));
}

export type PlacedTile = { key: string; z: number; x: number; y: number; left: number; top: number; width: number; height: number };

/** The tiles at one zoom level that the screen can see, and where each one goes. */
export function visibleTiles(camera: Camera, size: Size, tileZoom: number): PlacedTile[] {
  const count = 2 ** tileZoom;
  const worldPerTile = TILE_SIZE / count;
  const scale = 2 ** camera.zoom;
  const halfW = size.w / 2 / scale;
  const halfH = size.h / 2 / scale;
  const firstColumn = Math.floor((camera.x - halfW) / worldPerTile);
  const lastColumn = Math.floor((camera.x + halfW) / worldPerTile);
  const firstRow = Math.max(0, Math.floor((camera.y - halfH) / worldPerTile));
  const lastRow = Math.min(count - 1, Math.floor((camera.y + halfH) / worldPerTile));

  const tiles: PlacedTile[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const start = toScreen(camera, size, { x: column * worldPerTile, y: row * worldPerTile });
      const end = toScreen(camera, size, { x: (column + 1) * worldPerTile, y: (row + 1) * worldPerTile });
      // Whole pixels, sharing their edges, so no hairline gaps show between tiles.
      const left = Math.round(start.x);
      const top = Math.round(start.y);
      // Past the edge of the world, the map repeats.
      const x = ((column % count) + count) % count;
      tiles.push({
        key: `${tileZoom}/${column}/${row}`,
        z: tileZoom,
        x,
        y: row,
        left,
        top,
        width: Math.round(end.x) - left,
        height: Math.round(end.y) - top,
      });
    }
  }
  return tiles;
}

/**
 * An SVG path through the points, in screen coordinates. Stretches outside the screen are left out,
 * so a long route stays cheap and precise when zoomed in close.
 */
export function screenLine(points: Point[], camera: Camera, size: Size, margin = 32): string | null {
  let d = '';
  let drawing = false;
  let last: Point | null = null;
  points.forEach((world, index) => {
    const point = toScreen(camera, size, world);
    if (!last) {
      last = point;
      return;
    }
    // Points closer than a pixel add nothing you could see.
    if (index < points.length - 1 && Math.abs(point.x - last.x) + Math.abs(point.y - last.y) < 1) return;
    const visible =
      Math.max(point.x, last.x) >= -margin &&
      Math.min(point.x, last.x) <= size.w + margin &&
      Math.max(point.y, last.y) >= -margin &&
      Math.min(point.y, last.y) <= size.h + margin;
    if (visible) {
      if (!drawing) d += `M${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      d += `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }
    drawing = visible;
    last = point;
  });
  return d || null;
}

/** Street names start to appear around here, so the route line fades over these zoom levels. */
const FADE_FROM_ZOOM = 12;
const FADE_TO_ZOOM = 14;

/** How solid the route line and its white edge are. Zoomed in, street names show through them. */
export function routeOpacity(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - FADE_FROM_ZOOM) / (FADE_TO_ZOOM - FADE_FROM_ZOOM)));
  return { line: 1 - t * 0.55, edge: 0.9 - t * 0.75 };
}

export type PinSpot = Point & { id?: string; label: string; labelAbove: boolean };

export const labelWidth = (label: string) => label.length * 6.6 + 18;

/** A fingertip's reach around a pin: the 44 point target, as a radius. */
const PIN_REACH = 22;

/** The pin at a tapped point: the nearest one within reach, or else one whose label was tapped. */
export function pinAt<T extends PinSpot>(pins: T[], tap: Point): T | null {
  let nearest: T | null = null;
  let nearestDistance = PIN_REACH;
  for (const pin of pins) {
    const distance = Math.hypot(pin.x - tap.x, pin.y - tap.y);
    if (distance <= nearestDistance) {
      nearest = pin;
      nearestDistance = distance;
    }
  }
  if (nearest) return nearest;
  return (
    pins.find((pin) => {
      const top = pin.y + (pin.labelAbove ? -40 : 12);
      return Math.abs(tap.x - pin.x) <= labelWidth(pin.label) / 2 + 4 && tap.y >= top && tap.y <= top + 28;
    }) ?? null
  );
}
