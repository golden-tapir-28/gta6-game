// The HUD: health and money, the wanted stars, the mission objective, the
// minimap, the prompts and the banners — plus the title, pause, busted and
// wasted screens. It paints over the world the renderer drew, in the same
// 1280x720 logical view.

import { CITY, FONT, FONT_DISPLAY, MONEY, PALETTE, VIEW } from './config.js';
import { currentMission, objectiveText } from './missions.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';

const MAP_SIZE = 168;
const MAP_SCALE = MAP_SIZE / CITY.width;

function hourLabel(clock) {
  const h = Math.floor((clock / 3600) % 24);
  const m = Math.floor((clock / 60) % 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function syncTransform() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height) * dpr;
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
  }

  function begin() {
    syncTransform();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function drawStars(x, y, stars, flash) {
    ctx.font = '26px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i += 1) {
      const lit = i < stars;
      ctx.fillStyle = lit ? PALETTE.star : 'rgba(255,255,255,0.22)';
      const sx = x + i * 30;
      const bob = lit && flash > 0 ? Math.sin(performance.now() / 90 + i) * 2 : 0;
      ctx.fillText('★', sx, y + bob);
    }
  }

  function drawMinimap(state) {
    const mx = VIEW.width - MAP_SIZE - 16;
    const my = 16;
    panel(mx - 8, my - 8, MAP_SIZE + 16, MAP_SIZE + 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, MAP_SIZE, MAP_SIZE);
    ctx.clip();
    // Sea and land.
    ctx.fillStyle = '#2a9db8';
    ctx.fillRect(mx, my, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#3d5a3a';
    ctx.fillRect(mx, my, MAP_SIZE, (CITY.beachY / CITY.height) * MAP_SIZE);
    // Roads.
    ctx.strokeStyle = 'rgba(230, 225, 210, 0.85)';
    ctx.lineWidth = 3;
    for (const sx of CITY.streetsX) {
      const x = mx + (sx / CITY.width) * MAP_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, my);
      ctx.lineTo(x, my + MAP_SIZE);
      ctx.stroke();
    }
    for (const sy of CITY.streetsY) {
      const y = my + (sy / CITY.height) * MAP_SIZE;
      ctx.beginPath();
      ctx.moveTo(mx, y);
      ctx.lineTo(mx + MAP_SIZE, y);
      ctx.stroke();
    }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + (x / CITY.width) * MAP_SIZE, my + (y / CITY.height) * MAP_SIZE, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Mission target.
    const place = state.missionPlace;
    if (place) dot(place.x, place.y, PALETTE.marker, 6);
    // Police.
    for (const car of state.cops.cars) dot(car.x, car.y, '#2a5aff', 3.5);
    for (const cop of state.cops.foot) dot(cop.x, cop.y, '#7aa8ff', 3);
    // Player arrow.
    const px = mx + (state.player.x / CITY.width) * MAP_SIZE;
    const py = my + (state.player.y / CITY.height) * MAP_SIZE;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // North label.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('N', mx + MAP_SIZE / 2, my + MAP_SIZE + 14);
  }

  function drawHud(state) {
    const player = state.player;
    const wanted = state.wanted;
    // Top-left: health, money, wanted.
    panel(16, 16, 300, 96);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('HEALTH', 30, 40);
    ctx.fillStyle = '#222';
    ctx.fillRect(30, 48, 200, 12);
    ctx.fillStyle = player.health > 30 ? PALETTE.green : PALETTE.red;
    ctx.fillRect(30, 48, Math.max(0, 200 * (player.health / 100)), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 30, 84);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(`Packages ${state.packagesFound}/10`, 150, 84);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(hourLabel(state.clock), 244, 40);
    drawStars(30, 104, wanted.stars, wanted.flash);
    // Mission objective (bottom-left).
    const mission = currentMission(state.missions);
    panel(16, VIEW.height - 86, 560, 70);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(mission ? `MISSION ${mission.id} — ${mission.title}` : 'FREE ROAM', 30, VIEW.height - 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    wrapText(objectiveText(state.missions), 30, VIEW.height - 36, 532, 17);
    // Speed and vehicle (bottom-right, when driving).
    if (player.inCar) {
      const kmh = Math.round(Math.abs(player.inCar.speed) * 0.32);
      panel(VIEW.width - 176, VIEW.height - 86, 160, 70);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 30px ' + FONT_DISPLAY;
      ctx.textAlign = 'right';
      ctx.fillText(`${kmh}`, VIEW.width - 66, VIEW.height - 44);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '12px ' + FONT;
      ctx.fillText('km/h', VIEW.width - 30, VIEW.height - 44);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '12px ' + FONT;
      ctx.textAlign = 'left';
      ctx.fillText(player.inCar.type === 4 ? 'POLICE' : 'CAR', VIEW.width - 160, VIEW.height - 30);
    }
    // Gun prompt / interaction prompt (centre-bottom).
    if (state.gunPrompt) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.gunPrompt, VIEW.width / 2, VIEW.height - 104);
    } else if (!player.inCar) {
      ctx.fillStyle = 'rgba(245, 241, 232, 0.75)';
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('WASD move · Shift run · E enter car · Space punch · Click shoot (with pistol) · M mute', VIEW.width / 2, VIEW.height - 104);
    } else {
      ctx.fillStyle = 'rgba(245, 241, 232, 0.75)';
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('WASD drive · E exit car · M mute', VIEW.width / 2, VIEW.height - 104);
    }
    // Toast.
    if (state.toast && state.toastTimer > 0) {
      ctx.fillStyle = PALETTE.panel;
      const w = ctx.measureText(state.toast).width + 36;
      ctx.beginPath();
      ctx.roundRect((VIEW.width - w) / 2, 128, w, 36, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, VIEW.width / 2, 151);
    }
    // Mission banner.
    const banner = state.missions.banner;
    if (banner && banner.timer > 0) {
      const alpha = Math.min(1, banner.timer);
      ctx.globalAlpha = alpha;
      panel((VIEW.width - 640) / 2, 180, 640, 96);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 20px ' + FONT_DISPLAY;
      ctx.textAlign = 'center';
      ctx.fillText(banner.title, VIEW.width / 2, 214);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '15px ' + FONT;
      wrapText(banner.text, (VIEW.width - 600) / 2, 240, 600, 18, 'center');
      ctx.globalAlpha = 1;
    }
    drawMinimap(state);
  }

  function wrapText(text, x, y, maxWidth, lineHeight, align = 'left') {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    ctx.textAlign = align;
    const startX = align === 'center' ? x + maxWidth / 2 : x;
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, startX, y + i * lineHeight));
  }

  function drawTitle(state, best) {
    begin();
    // The title sits over the living city.
    ctx.fillStyle = 'rgba(8, 10, 20, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 22px ' + FONT_DISPLAY;
    ctx.fillText('WELCOME TO', VIEW.width / 2, 168);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 84px ' + FONT_DISPLAY;
    ctx.fillText('SOLMAR', VIEW.width / 2, 252);
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 40px ' + FONT_DISPLAY;
    ctx.fillText('N I G H T S', VIEW.width / 2, 302);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    ctx.fillText('An open-world crime story. Steal cars, outrun the PD, run Rico\'s jobs, own the city.', VIEW.width / 2, 344);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px ' + FONT;
    ctx.fillText('WASD move & drive · E enter car · Space punch · Mouse aim, click shoot · F interact · P pause · M mute', VIEW.width / 2, 384);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 22px ' + FONT_DISPLAY;
    ctx.fillText(state.hasSave ? 'Press Enter — Continue ($' + state.saveMoney + ', Mission ' + state.saveMission + ')' : 'Press Enter — New Game', VIEW.width / 2, 448);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px ' + FONT;
    ctx.fillText('Progress saves automatically. 5 story missions · 10 hidden packages · taxi fares · respray to lose the heat', VIEW.width / 2, 490);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '14px ' + FONT;
      ctx.fillText(`Best: $${best.toLocaleString('en-US')} earned in one run`, VIEW.width / 2, 520);
    }
  }

  function drawPaused() {
    begin();
    ctx.fillStyle = 'rgba(8, 10, 20, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px ' + FONT_DISPLAY;
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px ' + FONT;
    ctx.fillText('Press P or Enter to resume · progress is saved', VIEW.width / 2, 372);
  }

  function drawEnd(title, lines, prompt) {
    begin();
    ctx.fillStyle = 'rgba(8, 10, 20, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'BUSTED' ? PALETTE.blue : PALETTE.red;
    ctx.font = 'bold 64px ' + FONT_DISPLAY;
    ctx.fillText(title, VIEW.width / 2, 320);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 364 + i * 28));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px ' + FONT_DISPLAY;
    ctx.fillText(prompt, VIEW.width / 2, 452);
  }

  /** Paint the HUD and the screens over the world. */
  function draw(state, screen, best) {
    begin();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_BUSTED) drawEnd('BUSTED', ['The PD caught you. The fine came out of your pocket.', 'You wake up at Solmar PD. The city is still out there.'], 'Press Enter to get back out there');
    else if (screen === SCREEN_WASTED) drawEnd('WASTED', ['You went down. The medics patched you up at St. Marina.', 'The fine came out of your pocket.'], 'Press Enter to get back out there');
  }

  return { draw, drawHud };
}
