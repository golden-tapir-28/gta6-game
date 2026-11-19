// Rendering: the camera, the city, every entity and every effect, painted on one
// canvas. The view is a 1280x720 logical area scaled to the window. Nothing here
// reads the network or the clock: it paints exactly the state it is given.

import { CITY, PALETTE, VIEW } from './config.js';
import { PED_DOWN } from './pedestrians.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_BUSTED = 3;
export const SCREEN_WASTED = 4;
export const SCREEN_MISSION = 5;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / VIEW.width, h / VIEW.height) * dpr;
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Convert a canvas CSS-pixel point to world coordinates. */
  function screenToWorld(sx, sy, camera) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lx = (sx * dpr - offsetX) / scale;
    const ly = (sy * dpr - offsetY) / scale;
    return {
      x: camera.x + (lx - VIEW.width / 2) / camera.zoom,
      y: camera.y + (ly - VIEW.height / 2) / camera.zoom,
    };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-28, -14, 56, 28);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-27, -13, 54, 26, 7);
    ctx.fill();
    // Roof and windows.
    ctx.fillStyle = 'rgba(20, 24, 34, 0.85)';
    roundRect(-8, -11, 18, 22, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.7)';
    roundRect(-6, -9, 6, 18, 2);
    ctx.fill();
    // Headlights and tail lights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(24, -11, 3, 5);
    ctx.fillRect(24, 6, 3, 5);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-27, -11, 3, 5);
    ctx.fillRect(-27, 6, 3, 5);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(-28, -12, 4, 24);
    }
    if (car.siren) {
      const phase = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a5aff';
      ctx.beginPath();
      ctx.arc(-2, -8, 4, 0, Math.PI * 2);
      ctx.arc(-2, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? '#2a5aff' : '#ff2a2a';
      ctx.beginPath();
      ctx.arc(-2, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      roundRect(-30, -16, 60, 32, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === PED_DOWN) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = ped.state === 1 ? Math.sin(ped.x * 0.2 + ped.y * 0.2) * 2 : 0;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(player, combat) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = player.moving ? Math.sin(player.walkPhase) * 2 : 0;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(0, bob, 13, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 5, Math.sin(player.angle) * 5 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    if (player.hasPistol) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(player.angle) * 10, Math.sin(player.angle) * 10 + bob);
      ctx.lineTo(Math.cos(player.angle) * 24, Math.sin(player.angle) * 24 + bob);
      ctx.stroke();
    }
    if (combat && combat.punchTimer > 0.27) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 26, player.angle - 0.9, player.angle + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCity(state, cam) {
    const city = state.city;
    const x0 = cam.x - VIEW.width / 2 / cam.zoom - 60;
    const x1 = cam.x + VIEW.width / 2 / cam.zoom + 60;
    const y0 = cam.y - VIEW.height / 2 / cam.zoom - 60;
    const y1 = cam.y + VIEW.height / 2 / cam.zoom + 60;
    // Ground: warm concrete lots between the streets; the park is the green.
    ctx.fillStyle = '#a89a7c';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Sea and sand (south edge).
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, 0), CITY.beachY, Math.min(x1, CITY.width) - Math.max(x0, 0), CITY.seaY - CITY.beachY);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(Math.max(x0, 0), CITY.seaY, Math.min(x1, CITY.width) - Math.max(x0, 0), CITY.height - CITY.seaY);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = CITY.seaY + 24 + i * 34;
      if (wy < y0 || wy > y1) continue;
      ctx.fillRect(Math.max(x0, 0), wy, Math.min(x1, CITY.width) - Math.max(x0, 0), 3);
    }
    // Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(1445, 1045, 310, 310);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const sx of CITY.streetsX) ctx.fillRect(sx - CITY.roadWidth / 2 - 22, Math.max(y0, 0), CITY.roadWidth + 44, Math.min(y1, CITY.height) - Math.max(y0, 0));
    for (const sy of CITY.streetsY) ctx.fillRect(Math.max(x0, 0), sy - CITY.roadWidth / 2 - 22, Math.min(x1, CITY.width) - Math.max(x0, 0), CITY.roadWidth + 44);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const sx of CITY.streetsX) ctx.fillRect(sx - CITY.roadWidth / 2, Math.max(y0, 0), CITY.roadWidth, Math.min(y1, CITY.height) - Math.max(y0, 0));
    for (const sy of CITY.streetsY) ctx.fillRect(Math.max(x0, 0), sy - CITY.roadWidth / 2, Math.min(x1, CITY.width) - Math.max(x0, 0), CITY.roadWidth);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const sx of CITY.streetsX) {
      for (let y = Math.max(0, Math.floor(y0 / 44) * 44); y < Math.min(CITY.height, y1); y += 44) {
        ctx.fillRect(sx - 2, y, 4, 22);
      }
    }
    for (const sy of CITY.streetsY) {
      for (let x = Math.max(0, Math.floor(x0 / 44) * 44); x < Math.min(CITY.width, x1); x += 44) {
        ctx.fillRect(x, sy - 2, 22, 4);
      }
    }
    // Buildings.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 12, 9);
        }
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3e7d3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da24e';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Containers (port) and pond (park).
    for (const p of city.props) {
      if (p.kind === 'container') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      } else if (p.kind === 'pond') {
        ctx.fillStyle = '#4db2d8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMarkers(state) {
    // Mission target beacon.
    const place = state.missionPlace;
    if (place) {
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.12;
      ctx.strokeStyle = PALETTE.markerRing;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(place.x, place.y, 46 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(place.x, place.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◆', place.x, place.y + 5);
      ctx.fillStyle = 'rgba(255, 90, 216, 0.10)';
      ctx.fillRect(place.x - 8, place.y - 260, 16, 260);
    }
    // Hidden packages.
    for (const pkg of state.packages) {
      if (pkg.found) continue;
      const pulse = 1 + Math.sin(state.elapsed * 5 + pkg.x) * 0.15;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(pkg.x, pkg.y, 9 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pkg.x, pkg.y + 4);
    }
    // Taxi pickup / dropoff.
    const taxi = state.taxi;
    if (taxi.active && taxi.pickup && !taxi.passenger) {
      ctx.fillStyle = '#ff5ad8';
      ctx.beginPath();
      ctx.arc(taxi.pickup.x, taxi.pickup.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('T', taxi.pickup.x, taxi.pickup.y + 4);
    }
    if (taxi.active && taxi.passenger && taxi.dropoff) {
      ctx.fillStyle = '#ff5ad8';
      ctx.beginPath();
      ctx.arc(taxi.dropoff.x, taxi.dropoff.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('T', taxi.dropoff.x, taxi.dropoff.y + 4);
    }
    // Respray zone.
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(2200, 1400, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(79, 195, 247, 0.9)';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPRAY', 2200, 1404);
  }

  function drawEffects(state) {
    for (const e of state.effects) {
      ctx.globalAlpha = Math.max(0, e.life * 2);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
    }
    ctx.globalAlpha = 1;
    for (const b of state.combat.bullets) {
      if (!b.active) continue;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const f of state.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Paint the world for a screen. The HUD is drawn by hud.js; this paints the scene. */
  function drawWorld(state, screen = SCREEN_PLAY) {
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;
    const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.translate(VIEW.width / 2, VIEW.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawCity(state, cam);
    // The gameplay markers (mission beacon, packages, taxi, respray) are only
    // for play: the title screen shows the city bare, without labels over it.
    if (screen !== SCREEN_TITLE) drawMarkers(state);
    const cars = state.cars.slice().sort((a, b) => (a === state.player.inCar ? 1 : 0) - (b === state.player.inCar ? 1 : 0));
    for (const car of cars) drawCar(car, car === state.player.inCar);
    for (const car of state.cops.cars) drawCar(car, false);
    for (const cop of state.cops.foot) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.fillStyle = '#2a5ad8';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(Math.cos(cop.angle) * 4, Math.sin(cop.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const ped of state.peds) drawPed(ped);
    if (!state.player.inCar) drawPlayer(state.player, state.combat);
    drawEffects(state);
    // Time-of-day tint.
    const hour = (state.clock / 3600) % 24;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (hour >= 18.5 || hour < 6) {
      ctx.fillStyle = 'rgba(10, 12, 40, 0.30)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    } else if (hour >= 17) {
      ctx.fillStyle = 'rgba(255, 120, 60, 0.10)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    // Wanted flash at the screen edge.
    if (state.wanted.stars > 0) {
      const a = 0.10 + 0.05 * Math.sin(state.elapsed * 6);
      ctx.strokeStyle = `rgba(229, 83, 75, ${Math.max(0, a)})`;
      ctx.lineWidth = 26;
      ctx.strokeRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  return { drawWorld, screenToWorld, resize };
}
