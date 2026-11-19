// The city of Solmar: its streets, blocks, buildings, districts and named places.
// Generation is deterministic for a seed: the same seed always builds the same city.
// Roads are a grid; blocks between them hold buildings, a park, or the beach and sea.

import { CITY, PALETTE, PLACES } from './config.js';
import { int, makeRng, pick, range } from './random.js';

const ROAD_HALF = CITY.roadWidth / 2;

/** Is the point on a road (within the road's width of a street centre line)? */
export function isOnRoad(x, y) {
  for (const sx of CITY.streetsX) if (Math.abs(x - sx) <= ROAD_HALF) return true;
  for (const sy of CITY.streetsY) if (Math.abs(y - sy) <= ROAD_HALF) return true;
  return false;
}

/** Is the point on a sidewalk (the ring around a block, just off the road)? */
export function isSidewalk(x, y) {
  if (isOnRoad(x, y)) return false;
  for (const sx of CITY.streetsX) if (Math.abs(x - sx) <= ROAD_HALF + 26) return true;
  for (const sy of CITY.streetsY) if (Math.abs(y - sy) <= ROAD_HALF + 26) return true;
  return false;
}

/** The nearest street centre line to a point, and whether it runs vertically. */
export function nearestStreet(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const sx of CITY.streetsX) {
    const d = Math.abs(x - sx);
    if (d < bestD) { bestD = d; best = { pos: sx, vertical: true, d }; }
  }
  for (const sy of CITY.streetsY) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { pos: sy, vertical: false, d }; }
  }
  return best;
}

/** Build the city's buildings and props from a seed. Returns the city object. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const props = [];
  // Blocks: between consecutive streets (and the edges). The park block stays a park.
  const xs = [0, ...CITY.streetsX, CITY.width];
  const ys = [0, ...CITY.streetsY, CITY.height];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_HALF + 14;
      const x1 = xs[bx + 1] - ROAD_HALF - 14;
      const y0 = ys[by] + ROAD_HALF + 14;
      const y1 = ys[by + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The beach strip and the sea are not built on.
      if (y0 >= CITY.beachY) continue;
      // The park block is green, with trees and a pond.
      const isPark = x0 >= 1400 && x0 < 1800 && y0 >= 1000 && y0 < 1400;
      if (isPark) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 10, 18) });
        }
        props.push({ kind: 'pond', x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: 52 });
        continue;
      }
      // The port block (west edge, low) holds containers, not buildings.
      const isPort = x1 <= CITY.portX + 60 && y0 >= 1600;
      if (isPort) {
        for (let c = 0; c < 6; c += 1) {
          props.push({ kind: 'container', x: range(rng, x0 + 30, x1 - 30), y: range(rng, y0 + 30, y1 - 30), w: 70, h: 26, color: pick(rng, ['#c0392b', '#2980b9', '#27ae60', '#f39c12']) });
        }
        continue;
      }
      // A block holds 2-5 buildings, each with a colour and a roof height (for its shadow).
      const count = int(rng, 2, 5);
      for (let b = 0; b < count; b += 1) {
        const w = range(rng, 110, Math.min(240, (x1 - x0) / count - 10));
        const h = range(rng, 100, Math.min(220, y1 - y0 - 10));
        const x = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = range(rng, y0, Math.max(y0 + 1, y1 - h));
        const colorIndex = Math.floor(rng() * PALETTE.building.length);
        buildings.push({
          x, y, w, h,
          color: PALETTE.building[colorIndex],
          roof: PALETTE.buildingRoof[colorIndex],
          tall: rng() < 0.22,
          windows: int(rng, 2, 5),
        });
      }
      // A few palm trees along the block's edge.
      if (rng() < 0.6) {
        trees.push({ x: range(rng, x0, x1), y: y0 + 8, r: range(rng, 8, 12) });
        trees.push({ x: range(rng, x0, x1), y: y1 - 8, r: range(rng, 8, 12) });
      }
    }
  }
  return { buildings, trees, props, seed };
}

/** Circle-vs-buildings collision: push the circle out of any building it overlaps. */
export function collideBuildings(city, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) { py = b.y - radius; continue; }
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      py = cy + (dy / d) * radius;
    }
  }
  return { x: px, y: py };
}

/** True when the point is inside a building. */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** A point on a road near a named place (for spawning cars and peds). */
export function roadPointNear(place, dx, dy) {
  return { x: place.x + dx, y: place.y + dy };
}

/** The named places, as a list for the HUD and the minimap. */
export function placeList() {
  return Object.entries(PLACES).map(([key, value]) => ({ key, ...value }));
}
