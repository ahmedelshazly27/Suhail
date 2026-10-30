// ASCII scenes, ported unchanged from reference/suhail.html. Each scene is drawn in white (density) and pure red
// (accent) into an offscreen buffer, then re-drawn as characters in the scene colours from the CSS tokens.
/* eslint-disable */
const RAMP = " .:-=+*#%@";
function rng(seed){ let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const W = "rgba(255,255,255,", A = "rgba(255,0,0,"; // ds-allow: offscreen density buffer, never shown   // density in white, accent (Suhail) in pure red

function star4(c, x, y, R, col){ const k = R * .16; c.fillStyle = col; c.beginPath();
  c.moveTo(x, y - R); c.lineTo(x + k, y - k); c.lineTo(x + R, y); c.lineTo(x + k, y + k); c.lineTo(x, y + R); c.lineTo(x - k, y + k); c.lineTo(x - R, y); c.lineTo(x - k, y - k); c.closePath(); c.fill(); }
function glow(c, x, y, r, a, red){ const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, (red ? A : W) + a + ")"); g.addColorStop(1, (red ? A : W) + "0)"); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
function stars(c, w, h, t, n, seed, ymax){ const r = rng(seed); for (let i = 0; i < n; i++){ const x = r() * w, y = r() * h * ymax, s = r(), ph = r() * 6.28, sp = .6 + r() * 1.4;
  const a = (.25 + .75 * s) * (.55 + .45 * Math.sin(t * sp + ph)); c.fillStyle = W + a + ")"; const z = s > .92 ? 4 : 2.5; c.fillRect(x, y, z, z); } }
function dunes(c, w, h, base, layers, t){ for (let i = 0; i < layers; i++){ const y0 = base + i * (h - base) / layers * .7, amp = 10 + i * 8, f = .004 - i * .0006, ph = i * 1.7;
  c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 6) c.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * .35); c.lineTo(w, h); c.closePath();
  const g = c.createLinearGradient(0, y0 - amp, 0, h); g.addColorStop(0, W + (.4 - i * .05) + ")"); g.addColorStop(.1, W + (.06 + i * .03) + ")"); g.addColorStop(1, W + (.02 + i * .05) + ")"); c.fillStyle = g; c.fill();
  c.strokeStyle = W + ".6)"; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= w; x += 6){ const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * .35; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } }
function rect(c, x, y, w, h, a){ c.fillStyle = W + a + ")"; c.fillRect(x, y, w, h); }
function palm(c, x, base, s, a){ c.strokeStyle = W + a + ")"; c.lineWidth = Math.max(2, s * .05); c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + s * .12, base - s * .5, x + s * .05, base - s); c.stroke();
  const tx = x + s * .05, ty = base - s; c.lineWidth = Math.max(1.5, s * .03); for (let i = 0; i < 7; i++){ const an = -Math.PI + i * Math.PI / 6 + .1, L = s * .42;
  c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(an) * L * .6, ty + Math.sin(an) * L * .6 - s * .08, tx + Math.cos(an) * L, ty + Math.sin(an) * L * .5 + s * .12); c.stroke(); } }

/* landmarks: x = centre, b = ground line, s = height unit */
const LM = {
  hassan(c, x, b, s){ rect(c, x - s*.05, b - s*.95, s*.1, s*.95, .85); rect(c, x - s*.035, b - s*1.12, s*.07, s*.17, .9); c.fillStyle = W+".9)"; c.beginPath(); c.arc(x, b - s*1.12, s*.03, Math.PI, 0); c.fill(); rect(c, x - s*.004, b - s*1.22, s*.008, s*.08, .9);
    rect(c, x - s*.45, b - s*.18, s*.4, s*.18, .45); c.beginPath(); c.arc(x - s*.25, b - s*.18, s*.08, Math.PI, 0); c.fillStyle = W+".45)"; c.fill(); },
  pyramids(c, x, b, s){ c.fillStyle = W+".55)"; [[0, .55, .62], [-.42, .36, .4], [.48, .26, .3]].forEach(([dx, hh, ww]) => { c.beginPath(); c.moveTo(x + dx*s - ww*s, b); c.lineTo(x + dx*s, b - hh*s); c.lineTo(x + dx*s + ww*s, b); c.fill(); });
    c.fillStyle = W+".85)"; c.beginPath(); c.moveTo(x, b - .55*s); c.lineTo(x + .62*s, b); c.lineTo(x + .1*s, b); c.fill(); },
  cairo(c, x, b, s){ c.fillStyle = W+".8)"; c.beginPath(); c.moveTo(x - s*.05, b); c.lineTo(x - s*.035, b - s*.9); c.lineTo(x + s*.035, b - s*.9); c.lineTo(x + s*.05, b); c.fill();
    c.beginPath(); c.moveTo(x - s*.035, b - s*.9); c.quadraticCurveTo(x - s*.1, b - s*.98, x - s*.07, b - s*1.06); c.lineTo(x + s*.07, b - s*1.06); c.quadraticCurveTo(x + s*.1, b - s*.98, x + s*.035, b - s*.9); c.fill();
    rect(c, x - s*.006, b - s*1.2, s*.012, s*.14, .9); },
  kingdom(c, x, b, s){ c.fillStyle = W+".85)"; c.beginPath(); c.moveTo(x - s*.14, b); c.lineTo(x - s*.12, b - s*1.05); c.quadraticCurveTo(x, b - s*1.1, x + s*.12, b - s*1.05); c.lineTo(x + s*.14, b); c.fill();
    c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.moveTo(x - s*.1, b - s*1.08); c.quadraticCurveTo(x, b - s*.7, x + s*.1, b - s*1.08); c.closePath(); c.fill(); c.restore();
    rect(c, x - s*.075, b - s*.86, s*.15, s*.02, .95); },
  kuwait(c, x, b, s){ c.fillStyle = W+".85)"; const sp = (dx, H, w) => { c.beginPath(); c.moveTo(x + dx - w, b); c.lineTo(x + dx - w*.2, b - H); c.lineTo(x + dx + w*.2, b - H); c.lineTo(x + dx + w, b); c.fill(); };
    sp(0, s*1.15, s*.03); sp(s*.2, s*.85, s*.025); sp(-s*.16, s*.4, s*.015);
    const ball = (dx, y, r, a) => { c.fillStyle = W+a+")"; c.beginPath(); c.arc(x + dx, b - y, r, 0, 7); c.fill(); };
    ball(0, s*.55, s*.12, .95); ball(0, s*.78, s*.07, .95); ball(s*.2, s*.52, s*.09, .9); },
  khalifa(c, x, b, s){ const tiers = [[.16, .25], [.13, .5], [.1, .72], [.075, .9], [.05, 1.08], [.03, 1.24]]; tiers.forEach(([w, h], i) => rect(c, x - w*s + (i%2 ? s*.01 : 0), b - h*s, w*2*s, h*s, .75 + i*.03));
    c.fillStyle = W+".95)"; c.beginPath(); c.moveTo(x - s*.012, b - s*1.24); c.lineTo(x, b - s*1.6); c.lineTo(x + s*.012, b - s*1.24); c.fill(); },
  arab(c, x, b, s){ c.fillStyle = W+".8)"; c.beginPath(); c.moveTo(x - s*.05, b); c.lineTo(x - s*.05, b - s*.9); c.quadraticCurveTo(x + s*.4, b - s*.6, x + s*.22, b); c.closePath(); c.fill();
    rect(c, x - s*.07, b - s*1.0, s*.025, s*1.0, .95); c.save(); c.globalCompositeOperation = "destination-out"; c.lineWidth = 2; c.strokeStyle = "black"; for (let i = 1; i < 6; i++){ c.beginPath(); c.moveTo(x - s*.04, b - s*.15*i); c.lineTo(x + s*.12 + i*s*.01, b - s*.15*i + s*.05); c.stroke(); } c.restore(); },
  mosque(c, x, b, s){ rect(c, x - s*.22, b - s*.28, s*.44, s*.28, .55); c.fillStyle = W+".7)"; c.beginPath(); c.arc(x, b - s*.28, s*.17, Math.PI, 0); c.fill(); rect(c, x - s*.004, b - s*.53, s*.008, s*.1, .8);
    rect(c, x + s*.3, b - s*.7, s*.05, s*.7, .75); c.beginPath(); c.moveTo(x + s*.3, b - s*.7); c.lineTo(x + s*.325, b - s*.82); c.lineTo(x + s*.35, b - s*.7); c.fill(); },
  blocks(c, x, b, s, seed){ const r = rng(seed); let xx = x; for (let i = 0; i < 5; i++){ const w = s*(.08 + r()*.12), h = s*(.15 + r()*.35); rect(c, xx, b - h, w, h, .3 + r()*.2); xx += w + s*.02; } }
};
function skyline(c, w, b, s){
  c.fillStyle = W+".5)"; c.fillRect(0, b, w, 4);
  const items = [["hassan",.06],["blocks",.11],["pyramids",.21],["cairo",.31],["mosque",.38],["blocks",.45],["kingdom",.56],["blocks",.62],["kuwait",.71],["khalifa",.83],["blocks",.88],["arab",.95]];
  items.forEach(([k, p], i) => LM[k](c, w*p, b, s, i*7));
  [.0, .985].forEach(p => { c.strokeStyle = W+".35)"; c.lineWidth = 2; for (let j = 0; j < 4; j++){ c.beginPath(); for (let x = 0; x < w*.05; x += 4) c.lineTo(w*p + x, b + 8 + j*8 + Math.sin(x*.2 + j)*2); c.stroke(); } });
}

const DRAW = {
  home(c, w, h, t){ stars(c, w, h, t, 160, 3, .62); const sx = w*.84, sy = h*.34; glow(c, sx, sy, h*.22, .3 + .05*Math.sin(t*.8), true); star4(c, sx, sy, h*.11, A+"1)"); glow(c, sx, sy, h*.08, .9, true);
    skyline(c, w, h*.72, h*.36); palm(c, w*.16, h*.73, h*.2, .6); palm(c, w*.665, h*.73, h*.16, .55); dunes(c, w, h, h*.8, 2, t); },
  skyline(c, w, h, t){ skyline(c, w, h*.85, h*.62); },
  astrolabe(c, w, h, t){ stars(c, w, h, t, 70, 11, 1); const cx = w*.72, cy = h*.52, R = Math.min(h*.46, w*.3);
    c.strokeStyle = W+".85)"; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R*.86, 0, 7); c.stroke();
    for (let i = 0; i < 72; i++){ const a = i * Math.PI/36, l = i%6 ? .05 : .11; c.beginPath(); c.moveTo(cx + Math.cos(a)*R*.86, cy + Math.sin(a)*R*.86); c.lineTo(cx + Math.cos(a)*R*(.86 - l), cy + Math.sin(a)*R*(.86 - l)); c.stroke(); }
    c.save(); c.translate(cx, cy); c.rotate(t*.05); c.strokeStyle = W+".6)"; c.lineWidth = 2.5; c.beginPath(); c.arc(R*.18, 0, R*.5, 0, 7); c.stroke(); c.beginPath(); c.arc(-R*.1, R*.05, R*.62, -2.2, .9); c.stroke();
    for (let i = 0; i < 9; i++){ const a = i*.7 + .3, r0 = R*(.3 + (i%3)*.15); c.fillStyle = W+".9)"; c.beginPath(); c.moveTo(Math.cos(a)*r0, Math.sin(a)*r0); c.lineTo(Math.cos(a+.08)*(r0-R*.12), Math.sin(a+.08)*(r0-R*.12)); c.lineTo(Math.cos(a-.08)*(r0-R*.12), Math.sin(a-.08)*(r0-R*.12)); c.fill(); }
    const sa = 2.4, sr = R*.66; star4(c, Math.cos(sa)*sr, Math.sin(sa)*sr, R*.07, A+"1)"); glow(c, Math.cos(sa)*sr, Math.sin(sa)*sr, R*.18, .5, true); c.restore();
    c.strokeStyle = W+".7)"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - R*.9, cy); c.lineTo(cx + R*.9, cy); c.stroke(); c.beginPath(); c.arc(cx, cy - R - 14, 14, 0, 7); c.stroke(); },
  tent(c, w, h, t){ stars(c, w, h, t, 150, 21, .55); const sx = w*.2, sy = h*.22; glow(c, sx, sy, h*.2, .3, true); star4(c, sx, sy, h*.06, A+"1)");
    dunes(c, w, h, h*.7, 2, t); const tx = w*.62, b = h*.8, tw = w*.34, th = h*.26;
    c.fillStyle = W+".8)"; c.beginPath(); c.moveTo(tx - tw/2, b); c.lineTo(tx - tw/2 + tw*.06, b - th*.7); for (let i = 0; i <= 4; i++){ const px = tx - tw/2 + tw*.06 + i*(tw*.88/4); c.quadraticCurveTo(px - tw*.055, b - th*.78, px, b - th*(i%2 ? 1 : .92)); } c.lineTo(tx + tw/2, b); c.closePath(); c.fill();
    for (let i = 0; i < 8; i++){ rect(c, tx - tw/2 + tw*.1 + i*tw*.1, b - th*.82, 3, th*.82, .2); }
    c.fillStyle = W+".12)"; c.fillRect(tx - tw*.38, b - th*.55, tw*.76, th*.55); const fx = tx - tw*.62, fl = .7 + .3*Math.sin(t*9) * Math.sin(t*5.3);
    glow(c, fx, b - 10, h*.2*fl, .55, true); c.fillStyle = A+"1)"; c.beginPath(); c.moveTo(fx - 16, b); c.quadraticCurveTo(fx - 6, b - 40*fl, fx, b - 60*fl); c.quadraticCurveTo(fx + 8, b - 36*fl, fx + 16, b); c.fill();
    const ppl = [-.2, -.12, -.03, .06, .15]; ppl.forEach((p, i) => { const x = fx + p*w*.5 + (i > 2 ? w*.02 : -w*.02), y = b; c.fillStyle = W+".85)"; c.beginPath(); c.ellipse(x, y - 18, 16, 22, 0, 0, 7); c.fill(); c.beginPath(); c.arc(x, y - 48, 10, 0, 7); c.fill(); });
    c.strokeStyle = W+".5)"; c.lineWidth = 2; [[-.5, 0], [.5, 0]].forEach(([d]) => { c.beginPath(); c.moveTo(tx + d*tw, b - th*.6); c.lineTo(tx + d*tw*1.35, b); c.stroke(); }); },
  pattern(c, w, h, t){ const S = Math.max(70, h*.32); c.lineWidth = 2.5; for (let y = -S; y < h + S; y += S) for (let x = -S; x < w + S; x += S){ const cx = x + ((y/S)%2 ? S/2 : 0), cy = y;
    const fade = Math.max(0, 1 - Math.abs(cx - w*.5)/(w*.6)); const lit = (Math.sin(cx*.013 + cy*.021 + t*.9) > .86); const a = .15 + .6*fade;
    c.strokeStyle = (lit ? A : W) + (lit ? .95 : a) + ")"; const r = S*.36; c.beginPath(); for (let k = 0; k < 16; k++){ const an = k*Math.PI/8, rr = k%2 ? r*.62 : r; k ? c.lineTo(cx + Math.cos(an)*rr, cy + Math.sin(an)*rr) : c.moveTo(cx + rr, cy); } c.closePath(); c.stroke();
    c.strokeStyle = W + a*.6 + ")"; c.strokeRect(cx - r*.42, cy - r*.42, r*.84, r*.84); } },
  house(c, w, h, t){ stars(c, w, h, t, 60, 5, .35); const b = h*.86, x0 = w*.28, x1 = w*.9, top = h*.42; rect(c, x0, top, x1 - x0, b - top, .7);
    c.save(); c.globalCompositeOperation = "destination-out"; const n = 6, aw = (x1 - x0)/n; for (let i = 0; i < n; i++){ const ax = x0 + i*aw + aw*.18, awi = aw*.64, ay = b, ah = (b - top)*.62;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay - ah*.6); c.quadraticCurveTo(ax, ay - ah, ax + awi/2, ay - ah*1.08); c.quadraticCurveTo(ax + awi, ay - ah, ax + awi, ay - ah*.6); c.lineTo(ax + awi, ay); c.fillStyle = "black"; c.fill(); } c.restore();
    rect(c, x0, top - 10, x1 - x0, 10, .9); for (let i = 0; i < 30; i++) rect(c, x0 + i*(x1 - x0)/30, top - 22, (x1 - x0)/60, 12, .6);
    const bx = w*.74; rect(c, bx, top - h*.3, w*.06, h*.3, .8); c.save(); c.globalCompositeOperation = "destination-out"; for (let i = 0; i < 4; i++) { c.fillStyle = "rgba(0,0,0,.8)"; c.fillRect(bx + w*.008 + i*w*.013, top - h*.28, w*.007, h*.12); } c.restore(); rect(c, bx - 6, top - h*.3 - 8, w*.06 + 12, 8, .95);
    palm(c, w*.16, b, h*.5, .75); palm(c, w*.22, b, h*.34, .55); rect(c, 0, b, w, 3, .4);
    const lx = x0 + aw*2.5; glow(c, lx, b - h*.15, h*.22, .25 + .05*Math.sin(t*2), true); },
  dhow(c, w, h, t){ stars(c, w, h, t, 110, 9, .55); const sx = w*.86, sy = h*.2; star4(c, sx, sy, h*.05, A+"1)"); glow(c, sx, sy, h*.16, .3, true);
    const sea = h*.74; for (let j = 0; j < 9; j++){ c.strokeStyle = W + (.15 + j*.07) + ")"; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= w; x += 5){ const y = sea + j*j*2.2 + Math.sin(x*.02 + t*1.2 + j)*(2 + j); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    const bx = w*.42 + Math.sin(t*.3)*6, by = sea + Math.sin(t*1.1)*3; c.fillStyle = W+".9)"; c.beginPath(); c.moveTo(bx - w*.16, by - 26); c.quadraticCurveTo(bx - w*.1, by + 18, bx, by + 14); c.lineTo(bx + w*.12, by + 6); c.quadraticCurveTo(bx + w*.16, by - 10, bx + w*.19, by - 40); c.lineTo(bx + w*.15, by - 18); c.closePath(); c.fill();
    rect(c, bx - 2, by - h*.52, 5, h*.52, .9); c.fillStyle = W+".55)"; c.beginPath(); c.moveTo(bx - w*.13, by - h*.12); c.lineTo(bx + w*.05, by - h*.56); c.quadraticCurveTo(bx + w*.06, by - h*.3, bx + w*.12, by - h*.08); c.closePath(); c.fill();
    c.strokeStyle = W+".85)"; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - w*.14, by - h*.1); c.lineTo(bx + w*.06, by - h*.58); c.stroke(); },
  dallah(c, w, h, t){ const cx = w*.7, b = h*.88, s = h*.62; c.fillStyle = W+".85)";
    c.beginPath(); c.moveTo(cx - s*.3, b); c.quadraticCurveTo(cx - s*.36, b - s*.3, cx - s*.14, b - s*.42); c.lineTo(cx - s*.1, b - s*.62); c.quadraticCurveTo(cx, b - s*.68, cx + s*.1, b - s*.62); c.lineTo(cx + s*.14, b - s*.42); c.quadraticCurveTo(cx + s*.36, b - s*.3, cx + s*.3, b); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(cx - s*.12, b - s*.62); c.quadraticCurveTo(cx, b - s*.9, cx + s*.12, b - s*.62); c.fill(); c.beginPath(); c.arc(cx, b - s*.9, s*.035, 0, 7); c.fill();
    c.strokeStyle = W+".85)"; c.lineWidth = s*.05; c.beginPath(); c.moveTo(cx - s*.2, b - s*.4); c.quadraticCurveTo(cx - s*.42, b - s*.6, cx - s*.52, b - s*.8); c.stroke();
    c.lineWidth = s*.03; c.beginPath(); c.moveTo(cx + s*.14, b - s*.6); c.bezierCurveTo(cx + s*.45, b - s*.6, cx + s*.45, b - s*.15, cx + s*.24, b - s*.12); c.stroke();
    rect(c, cx - s*.32, b - s*.12, s*.64, s*.025, .5); rect(c, cx - s*.2, b - s*.5, s*.4, s*.02, .5);
    [[-.95, .22], [-.7, .18]].forEach(([dx, z]) => { const fx = cx + dx*s, fy = b; c.fillStyle = W+".8)"; c.beginPath(); c.moveTo(fx - s*z*.5, fy - s*z*.6); c.lineTo(fx + s*z*.5, fy - s*z*.6); c.lineTo(fx + s*z*.32, fy); c.lineTo(fx - s*z*.32, fy); c.fill(); });
    for (let i = 0; i < 3; i++){ c.strokeStyle = W + (.35 - i*.08) + ")"; c.lineWidth = 3; c.beginPath(); const ox = cx - s*.52 + i*14; for (let y = 0; y < s*.5; y += 4){ const x = ox + Math.sin(y*.04 - t*2 + i)*12; y ? c.lineTo(x, b - s*.85 - y) : c.moveTo(x, b - s*.85 - y); } c.stroke(); }
    rect(c, 0, b, w, 3, .35); glow(c, w*.25, h*.4, h*.25, .12 + .04*Math.sin(t), true); },
  rise(c, w, h, t){ stars(c, w, h, t, 120, 31, .9); const hz = h*.86, sx = w*.5, sy = hz - h*.18 - Math.sin(t*.25)*4;
    glow(c, sx, sy, h*.55, .35, true); c.strokeStyle = A+".7)"; c.lineWidth = 2; for (let i = 0; i < 16; i++){ const a = i*Math.PI/8; c.beginPath(); c.moveTo(sx + Math.cos(a)*h*.12, sy + Math.sin(a)*h*.12); c.lineTo(sx + Math.cos(a)*h*(.2 + (i%2)*.14), sy + Math.sin(a)*h*(.2 + (i%2)*.14)); c.stroke(); }
    star4(c, sx, sy, h*.13, A+"1)"); rect(c, 0, hz, w, 3, .7); c.fillStyle = W+".25)"; c.fillRect(0, hz + 3, w, h - hz); }
};

export { RAMP, DRAW };
