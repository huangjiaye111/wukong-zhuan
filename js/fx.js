/* ============================================================
 * fx.js —— 特效与打击感
 * 顿帧 / 震屏 / 粒子 / 刀光 / 光束 / 冲击波 / 伤害数字
 * ============================================================ */
'use strict';

Z.FX = (() => {
  const list = [];
  let shakeT = 0, shakeDur = 0, shakeMag = 0;
  let shakeScale = 1, shakeSaveWarned = false;
  try { shakeScale = localStorage.getItem('zmxy_shake') === '0' ? 0 : 1; } catch (_) { /* 受限存储仍可游玩。 */ }
  let stopT = 0;          // 顿帧
  let impactOn = false, impactT = 0; // 主循环启动时启用完整世界的短命中停顿。
  let flashT = 0, flashColor = '#fff';

  function add(type, x, y, o = {}) {
    const e = Object.assign({ type, x, y, t: 0 }, o);
    e.life = o.life || 0.5;
    list.push(e);
    if (list.length > 400) list.splice(0, list.length - 400);
    return e;
  }

  function text(x, y, str, o = {}) {
    add('text', x, y, Object.assign({ str, life: 0.8, vy: -46 }, o));
  }

  function shake(mag, dur) {
    if (mag >= shakeMag * (shakeT / (shakeDur || 1))) { shakeMag = mag; shakeDur = dur; shakeT = dur; }
  }
  function hitstop(t) { stopT = Math.max(stopT, t); }
  function setImpactFeedback(on) { impactOn = !!on; impactT = 0; }
  function impact(kind) {
    if (!impactOn) return;
    const duration = kind === 'heavy' ? 3 / 60 : kind === 'medium' ? 2 / 60 : 1 / 60;
    impactT = Math.max(impactT, duration); // 同批多目标只取最强一次，不按数量叠加。
  }
  function consumeImpact(dt) {
    if (!impactOn || impactT <= 1e-9) return false;
    impactT = Math.max(0, impactT - dt);
    if (impactT < 1e-9) impactT = 0;
    return true;
  }
  function clearImpact() { impactT = 0; }
  function flash(color, t = 0.12) { flashColor = color; flashT = t; }

  function update(dt, impactFrozen = false) {
    if (stopT > 0) { stopT -= dt; return; } // 顿帧期间特效也冻结
    if (impactFrozen) return;
    if (flashT > 0) flashT -= dt;
    if (shakeT > 0) shakeT -= dt;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      if (e.vx != null) { e.x += e.vx * dt; e.y += (e.vy != null ? e.vy : 0) * dt; }
      if (e.grav) e.vy += e.grav * dt;
      if (e.t >= e.life) list.splice(i, 1);
    }
  }

  // 小幅柔光先画进离屏图；技能绘制只缩放缓存，不在每一帧创建渐变。
  const skillGlows = {};
  function glow(g, x, y, rx, ry, blue = false) {
    const key = blue ? 'cloud' : 'gold';
    let cv = skillGlows[key];
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const c = cv.getContext('2d');
      const grad = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      grad.addColorStop(0, blue ? 'rgba(238,255,253,0.65)' : 'rgba(255,242,186,0.76)');
      grad.addColorStop(0.25, blue ? 'rgba(163,225,226,0.30)' : 'rgba(255,200,65,0.32)');
      grad.addColorStop(1, blue ? 'rgba(107,211,221,0)' : 'rgba(255,115,37,0)');
      c.fillStyle = grad; c.fillRect(0, 0, 128, 128); skillGlows[key] = cv;
    }
    g.drawImage(cv, x - rx, y - ry, rx * 2, ry * 2);
  }

  function cloud(g, x, y, s, a = 1) {
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= a;
    g.beginPath(); g.moveTo(-35, 3);
    g.bezierCurveTo(-48, 0, -42, -13, -29, -10);
    g.bezierCurveTo(-30, -25, -7, -26, -5, -12);
    g.bezierCurveTo(4, -23, 24, -20, 22, -7);
    g.bezierCurveTo(41, -17, 49, 1, 32, 5);
    g.bezierCurveTo(12, 11, -16, 9, -35, 3); g.closePath();
    g.fillStyle = '#9cced0'; g.fill();
    g.strokeStyle = '#4c969f'; g.lineWidth = 1.3; g.stroke();
    g.beginPath(); g.moveTo(-33, -2);
    g.bezierCurveTo(-46, -8, -30, -15, -24, -7);
    g.bezierCurveTo(-25, -22, -9, -22, -6, -9);
    g.bezierCurveTo(4, -17, 17, -17, 18, -5);
    g.bezierCurveTo(31, -13, 40, -4, 29, 0);
    g.bezierCurveTo(8, 5, -16, 5, -33, -2); g.closePath();
    g.fillStyle = '#fff7d9'; g.fill();
    g.strokeStyle = '#edce83'; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.moveTo(-21, -5); g.bezierCurveTo(-15, -14, -3, -10, -9, -5);
    g.moveTo(8, -6); g.bezierCurveTo(13, -11, 21, -6, 16, -3);
    g.strokeStyle = '#76aeb1'; g.lineWidth = 1.1; g.stroke(); g.restore();
  }

  // 填充棍弧有内外轮廓和尖端；比完整光圈更容易看出挥击方向。
  function staffArc(g, r, sq, a0, a1, width, color) {
    const n = 18;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u;
      const rr = r + Math.sin(u * Math.PI) * width * 0.45;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * sq;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n, a = a0 + (a1 - a0) * u;
      const rr = r - Math.sin(u * Math.PI) * width;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * sq);
    }
    g.closePath(); g.fillStyle = color; g.fill();
  }

  function drawSkill(g, e, k) {
    if (k >= 1) return;
    g.save(); g.translate(e.x, e.y); g.scale(e.f || 1, 1);
    const fade = Math.max(0, 1 - k);
    switch (e.type) {
      case 'eyecharge': {
        const p = Math.min(1, k * 1.4), r = 6 + p * 10;
        g.globalAlpha = 0.3 + p * 0.65;
        glow(g, 0, 0, r * 2.2, r * 1.3);
        g.strokeStyle = '#ffb74c'; g.lineWidth = 1.3;
        for (let i = 0; i < 5; i++) {
          const a = i * Z.U.TAU / 5 + e.t * 5;
          const outer = 24 - p * 12;
          g.beginPath(); g.moveTo(Math.cos(a) * outer, Math.sin(a) * outer * .65);
          g.lineTo(Math.cos(a) * (outer + 6), Math.sin(a) * (outer + 6) * .65); g.stroke();
        }
        g.fillStyle = '#fffad0'; g.beginPath(); g.ellipse(0, 0, 3 + p * 3, 2 + p, 0, 0, Z.U.TAU); g.fill();
        break;
      }
      case 'firestream': {
        // 命中是瞬发：第一帧就覆盖全射程，随后只有焰边向前流动。
        const w = e.w || 400, h = e.h || 46;
        const envelope = k < .15 ? .76 + k * 1.6 : 1 - (k - .15) * .65;
        g.globalAlpha = fade * .68; glow(g, w * .5, 0, w * .57, h * 1.2);
        g.globalAlpha = fade * .9;
        for (let layer = 0; layer < 3; layer++) {
          const size = [1, .67, .3][layer] * h * .5 * envelope;
          g.beginPath(); g.moveTo(-5, 0);
          for (let i = 0; i <= 15; i++) {
            const u = i / 15, x = u * w;
            const edge = Math.sin(i * 2.2 - e.t * 62) * (layer ? .08 : .18);
            const taper = Math.sin((u * .85 + .1) * Math.PI);
            g.lineTo(x, -size * taper * (1 + edge));
          }
          g.lineTo(w + 9, 0);
          for (let i = 15; i >= 0; i--) {
            const u = i / 15, x = u * w;
            const edge = Math.sin(i * 2.4 - e.t * 65 + 2) * (layer ? .08 : .18);
            const taper = Math.sin((u * .85 + .1) * Math.PI);
            g.lineTo(x, size * taper * (1 + edge));
          }
          g.closePath(); g.fillStyle = ['#ef6a28', '#ffc746', '#fffbc7'][layer]; g.fill();
        }
        g.strokeStyle = '#ffe29a'; g.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const u = ((i / 8 + e.t * 2.8) % 1), x = 16 + u * (w - 26);
          const y = Math.sin(i * 2.1) * h * .38;
          g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x + 11, y * .88); g.stroke();
        }
        // 焰边卷出短火舌，沿主焰向前流动；过边界时自行淡出，避免闪现。
        for (let i = 0; i < 5; i++) {
          const u = (i / 5 + e.t * 2.1) % 1, side = i % 2 ? 1 : -1;
          const x = 28 + u * (w - 68);
          const taper = Math.sin((u * .85 + .1) * Math.PI);
          const y = side * h * .46 * envelope * taper;
          g.globalAlpha = fade * .8 * Math.sin(u * Math.PI);
          g.beginPath(); g.moveTo(x - 16, y);
          g.bezierCurveTo(x - 4, y + side * 9, x + 7, y + side * 13, x + 15, y + side * 5);
          g.bezierCurveTo(x + 8, y + side * 9, x - 1, y + side * 7, x + 3, y + side * 2);
          g.bezierCurveTo(x + 10, y - side * 3, x + 17, y - side * 4, x + 22, y - side * 2);
          g.bezierCurveTo(x + 5, y - side * 4, x - 5, y - side * 6, x - 16, y);
          g.closePath(); g.fillStyle = '#ee762d'; g.fill();
          g.strokeStyle = '#ffd261'; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(x - 9, y + side * 2);
          g.quadraticCurveTo(x - 1, y + side * 9, x + 8, y + side * 6); g.stroke();
        }
        for (let i = 0; i < 6; i++) {
          const u = (i * .173 + e.t * 3.2) % 1, x = 36 + u * (w - 60);
          const side = i % 2 ? 1 : -1, y = side * (h * .48 + Math.sin(i * 2.3 + e.t * 21) * 4);
          g.globalAlpha = fade * .75 * Math.sin(u * Math.PI);
          g.strokeStyle = '#ffbb4d'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x - 5, y + side); g.lineTo(x, y); g.stroke();
          g.fillStyle = '#fff0b3'; g.beginPath(); g.ellipse(x, y, 1.4, .8, 0, 0, Z.U.TAU); g.fill();
        }
        g.globalAlpha = fade; glow(g, 0, 0, 24, 17);
        break;
      }
      case 'cloudride': {
        const lift = Math.min(1, k * 5), a = Math.min(1, fade * 5);
        g.globalAlpha = a;
        glow(g, -5, -3, 60, 22, true);
        cloud(g, -6, 0, .8 + lift * .22);
        g.strokeStyle = '#f5ecbc'; g.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const x = -40 - ((e.t * 370 + i * 22) % 45), y = -18 - i * 9;
          g.beginPath(); g.moveTo(x - 20, y); g.quadraticCurveTo(x + 2, y - 4, x + 24, y - 1); g.stroke();
        }
        break;
      }
      case 'cloudwake': {
        g.globalAlpha = fade * .55;
        cloud(g, -k * 13, -k * 8, (e.s || .62) * (.85 + k * .38));
        g.strokeStyle = '#d4f0e8'; g.lineWidth = 1.5 * fade + .3;
        g.beginPath(); g.moveTo(-52 - k * 16, -8); g.quadraticCurveTo(-24, -14, 3, -8); g.stroke();
        break;
      }
      case 'staffarc': {
        g.globalAlpha = fade * .74;
        g.rotate((e.rot || 0) + k * .3);
        const r = (e.r || 49) * (1 + k * .08), sq = e.sq || .85;
        staffArc(g, r, sq, -1.6, 1.5, e.heavy ? 13 : 9, '#b66d30');
        staffArc(g, r - 1, sq, -1.48, 1.43, e.heavy ? 9 : 6, '#f4c868');
        staffArc(g, r - 2, sq, -1.35, 1.34, 2.6, '#fff0c7');
        staffArc(g, r * .72, sq, -1.1, .8, 2.2, 'rgba(255,236,169,.28)');
        if (e.heavy) {
          const a = 1.1 - k * .5;
          g.rotate(a); g.globalAlpha *= .8;
          g.strokeStyle = '#8b4023'; g.lineWidth = 7; g.beginPath(); g.moveTo(-r*.63, 0); g.lineTo(r*.7, 0); g.stroke();
          g.strokeStyle = '#f1c65b'; g.lineWidth = 4; g.stroke();
          g.fillStyle = '#fff0a3'; g.fillRect(-r*.63, -3, 10, 6); g.fillRect(r*.7-10, -3, 10, 6);
        }
        break;
      }
      case 'cloudspiral': {
        const a = Math.min(1, k * 8, fade * 7), phase = e.t * 17;
        for (let i = 0; i < 3; i++) {
          // 云旋落在腰腿间，上层减淡；猴脸与出棍方向交给人物和金色棍弧表达。
          g.globalAlpha = a * (.42 - i * .09);
          g.save(); g.translate(0, -10 - i * 12); g.rotate(Math.sin(phase + i) * .1);
          const r = 43 + i * 3;
          const angle = phase + i * 2.1;
          staffArc(g, r, .25, angle, angle + 2.1, 5, i === 1 ? '#f5e9b5' : '#c7e7e0');
          g.restore();
        }
        g.globalAlpha = a * .32; cloud(g, -7, -2, .65);
        break;
      }
      case 'wuburst': {
        g.globalAlpha = fade * .4; glow(g, 0, -37, 76, 78);
        g.strokeStyle = '#e7b957'; g.lineWidth = 2 * fade + .4;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, r0 = 34 + k * 23, r1 = r0 + 16 * fade;
          g.beginPath(); g.moveTo(Math.cos(a)*r0, -38+Math.sin(a)*r0);
          g.lineTo(Math.cos(a)*r1, -38+Math.sin(a)*r1); g.stroke();
        }
        cloud(g, -28 - k * 20, -3, .58 + k * .2, fade * .55);
        cloud(g, 29 + k * 20, -3, .66 + k * .2, fade * .55);
        break;
      }
      case 'wufinish': {
        g.globalAlpha = fade * .8;
        // 落棍与终击同帧出现；棍后方只留柔光，敌人轮廓仍可辨认。
        const height = 112 + fade * 18;
        glow(g, 36, -height*.5, 22, height*.7);
        g.strokeStyle = '#8c4324'; g.lineWidth = 14; g.lineCap = 'round';
        g.beginPath(); g.moveTo(36, -height); g.lineTo(36, -8); g.stroke();
        g.strokeStyle = '#eebf59'; g.lineWidth = 9; g.stroke();
        g.strokeStyle = '#be8736'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(39, -height + 13); g.lineTo(39, -22); g.stroke();
        g.strokeStyle = '#fff0ac'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(34, -height+13); g.lineTo(34, -20); g.stroke();
        for (const top of [-height - 1, -21]) {
          g.fillStyle = '#a9722d'; g.fillRect(29, top, 14, 14);
          g.fillStyle = '#e9b74c'; g.fillRect(30, top + 1, 11, 12);
          g.fillStyle = '#ffe894'; g.fillRect(30, top + 1, 3, 12);
          g.fillStyle = '#fff0af'; g.fillRect(29, top + 1, 14, 1.3); g.fillRect(29, top + 11.7, 14, 1.3);
          g.strokeStyle = '#bf8531'; g.lineWidth = .8;
          g.beginPath(); g.moveTo(34, top + 4); g.lineTo(38, top + 4); g.lineTo(38, top + 7);
          g.lineTo(35, top + 7); g.lineTo(35, top + 10); g.lineTo(39, top + 10); g.stroke();
        }
        g.strokeStyle = 'rgba(146,91,37,.45)'; g.lineWidth = .8;
        for (let i = 0; i < 4; i++) {
          const y = -height + 27 + i * ((height - 53) / 3);
          g.beginPath(); g.moveTo(35, y); g.quadraticCurveTo(37, y - 3, 38, y);
          g.quadraticCurveTo(37, y + 3, 35, y + 2); g.stroke();
        }
        g.globalAlpha = fade * .7;
        const r = 18 + Math.sqrt(k) * 119;
        g.strokeStyle = '#ffe0a0'; g.lineWidth = 3 * fade + .4;
        g.beginPath(); g.ellipse(0, -6, r, r * .24, 0, 0, Z.U.TAU); g.stroke();
        g.strokeStyle = '#a8deda'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(0, -5, r * .75, r * .18, 0, 0, Z.U.TAU); g.stroke();
        for (let i = 0; i < 4; i++) {
          const x = (i < 2 ? -1 : 1) * (21 + k * 100 + (i % 2) * 24);
          cloud(g, x, -k * 14 - (i % 2) * 6, (.6 + k * .2) * (i % 2 ? .7 : 1), fade * .45);
        }
        g.strokeStyle = '#fff0ba'; g.lineWidth = 1.4;
        for (let i = 0; i < 8; i++) {
          const a = -.15 - i * Math.PI / 7.4, d = 20 + k * 82;
          g.beginPath(); g.moveTo(Math.cos(a)*d, -8+Math.sin(a)*d*.65);
          g.lineTo(Math.cos(a)*(d+10), -8+Math.sin(a)*(d+10)*.65); g.stroke();
        }
        break;
      }
    }
    g.restore();
  }

  /* ---- 各种特效绘制 ---- */
  function draw(g, screenX = 0, screenY = 0) {
    for (const e of list) {
      const k = e.t / e.life; // 0→1
      switch (e.type) {
        case 'eyecharge': case 'firestream': case 'cloudride': case 'cloudwake':
        case 'staffarc': case 'cloudspiral': case 'wuburst': case 'wufinish':
          drawSkill(g, e, k); break;
        case 'dust': {
          g.save(); g.globalAlpha = (1 - k) * 0.5;
          Z.Spr.ell(g, e.x, e.y, 4 + k * 10, 3 + k * 4, '#cfd8e2');
          g.restore();
          break;
        }
        case 'spark': {
          g.save(); g.globalAlpha = 1 - k;
          g.strokeStyle = e.color || '#ffe28a';
          g.lineWidth = 2 * (1 - k) + 0.5;
          const a = e.a != null ? e.a : Math.atan2(e.vy || 0, e.vx || 1);
          const len = 6 + 10 * (1 - k);
          g.beginPath();
          g.moveTo(e.x - Math.cos(a) * len, e.y - Math.sin(a) * len);
          g.lineTo(e.x + Math.cos(a) * len * 0.3, e.y + Math.sin(a) * len * 0.3);
          g.stroke();
          // v81 亮芯：火花头部一颗白热点，读作迸出的光点而非裸线段
          g.fillStyle = '#fffbe8';
          g.beginPath(); g.arc(e.x, e.y, 1.6 * (1 - k) + 0.4, 0, Z.U.TAU); g.fill();
          g.restore();
          break;
        }
        case 'star': {
          g.save(); g.globalAlpha = 1 - k;
          g.fillStyle = e.color || '#ffd24a';
          g.translate(e.x, e.y); g.rotate(e.t * 8);
          const r = (e.r || 6) * (1 - k * 0.4);
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, rad = i % 2 === 0 ? r : r * 0.4;
            const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.closePath(); g.fill();
          g.restore();
          break;
        }
        case 'slash': {
          // 月牙刀光
          g.save(); g.globalAlpha = (1 - k) * 0.82;
          g.translate(e.x, e.y);
          g.rotate(e.rot || 0);
          g.scale(e.flip || 1, 1);
          g.strokeStyle = e.color && e.color !== '#fff' ? e.color : '#f4cd7a';
          g.lineWidth = 5 * (1 - k) + 1;
          g.beginPath();
          g.arc(0, 0, e.r || 30, -1.1, 1.1);
          g.stroke();
          g.strokeStyle = 'rgba(255,242,204,0.92)';
          g.lineWidth = 2 * (1 - k);
          g.beginPath();
          g.arc(0, 0, (e.r || 30) - 4, -0.9, 0.9);
          g.stroke();
          g.restore();
          break;
        }
        case 'beam': {
          // 金色光束：x,y 为起点，w 长 h 粗，f 为方向
          const grow = Math.min(1, k * 5);
          g.save();
          g.globalAlpha = (1 - k) * 0.95;
          g.translate(e.x, e.y);
          g.scale(e.f || 1, 1);
          const w = (e.w || 300) * (0.3 + 0.7 * grow);
          const h = (e.h || 40) * (k < 0.3 ? k / 0.3 : (1 - (k - 0.3) / 0.7 * 0.6));
          const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
          grad.addColorStop(0, 'rgba(255,200,60,0)');
          grad.addColorStop(0.5, e.color || '#ffd24a');
          grad.addColorStop(1, 'rgba(255,200,60,0)');
          g.fillStyle = grad;
          g.fillRect(0, -h / 2, w, h);
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fillRect(0, -h * 0.14, w, h * 0.28);
          g.restore();
          break;
        }
        case 'ring': {
          g.save(); g.globalAlpha = (1 - k) * 0.8;
          g.strokeStyle = e.color || '#ffd24a';
          g.lineWidth = 4 * (1 - k) + 1;
          g.beginPath();
          g.ellipse(e.x, e.y, (e.r || 60) * k + 6, ((e.r || 60) * k + 6) * (e.sq || 0.35), 0, 0, Z.U.TAU);
          g.stroke();
          g.restore();
          break;
        }
        case 'after': {
          // 冲刺残影
          g.save(); g.globalAlpha = (1 - k) * 0.35;
          Z.Spr.ell(g, e.x, e.y - e.h / 2, e.w / 2, e.h / 2, '#8fd0ff');
          g.restore();
          break;
        }
        case 'aura': {
          g.save(); g.globalAlpha = (1 - k) * 0.6;
          const r = (e.r || 40) * (0.6 + k * 0.6);
          const grad = g.createRadialGradient(e.x, e.y - 20, 4, e.x, e.y - 20, r);
          grad.addColorStop(0, e.color || 'rgba(255,210,74,0.8)');
          grad.addColorStop(1, 'rgba(255,210,74,0)');
          g.fillStyle = grad;
          g.beginPath(); g.arc(e.x, e.y - 20, r, 0, Z.U.TAU); g.fill();
          g.restore();
          break;
        }
        case 'heal': {
          g.save(); g.globalAlpha = (1 - k) * 0.9;
          g.fillStyle = '#7dffa8';
          const yy = e.y - k * 36;
          g.beginPath(); g.arc(e.x + Math.sin(e.t * 9) * 8, yy, 3 * (1 - k) + 1, 0, Z.U.TAU); g.fill();
          g.restore();
          break;
        }
        case 'text': {
          g.save();
          g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
          // v80：暴击数字（尺寸≥20 为既定暴击标记）加微倾与更强存在感
          const yOff = (e.vy || -46) * e.t;
          if ((e.size || 15) >= 20) {
            g.translate(e.x, e.y + yOff);
            g.rotate(-0.1);
            Z.Spr.text(g, e.str, 0, 0, {
              size: e.size || 15, color: e.color || '#fff',
              stroke: e.stroke || 'rgba(20,20,30,0.9)', strokeW: 4.5, bold: true,
            });
          } else {
            Z.Spr.text(g, e.str, e.x, e.y + yOff, {
              size: e.size || 15, color: e.color || '#fff',
              stroke: e.stroke || 'rgba(20,20,30,0.9)', strokeW: 3.5, bold: true,
            });
          }
          g.restore();
          break;
        }
        case 'portal': {
          g.save();
          g.translate(e.x, e.y);
          g.globalAlpha = 0.85;
          for (let i = 0; i < 3; i++) {
            const rr2 = (18 + i * 10) * (0.8 + 0.2 * Math.sin(e.t * 3 + i));
            g.strokeStyle = i === 1 ? '#7dffa8' : '#b8ffd0';
            g.lineWidth = 3 - i * 0.7;
            g.beginPath();
            g.ellipse(0, -40, rr2 * 0.7, rr2, Math.sin(e.t * 2 + i) * 0.3, 0, Z.U.TAU);
            g.stroke();
          }
          const grad = g.createRadialGradient(0, -40, 2, 0, -40, 26);
          grad.addColorStop(0, 'rgba(180,255,210,0.9)');
          grad.addColorStop(1, 'rgba(120,255,170,0)');
          g.fillStyle = grad;
          g.beginPath(); g.arc(0, -40, 26, 0, Z.U.TAU); g.fill();
          g.restore();
          break;
        }
        case 'mark': {
          // 危险范围保留原几何；朱红边界统一危险语义，法术颜色只用于淡填充。
          const w = e.w || 40, col = e.color || '#e5684c', danger = '#e86d50';
          g.save();
          const pulse = 0.5 + 0.5 * Math.sin(e.t * 12);
          g.globalAlpha = 0.12 + 0.05 * pulse;
          g.fillStyle = col;
          g.fillRect(e.x - w / 2, e.y - 46, w, 46);
          g.globalAlpha = 0.80 + 0.15 * pulse;
          g.lineWidth = 2;
          g.strokeStyle = danger;
          g.strokeRect(e.x - w / 2, e.y - 46, w, 46);
          // v82 斜纹滚动：区内读作「禁止进入」的警示纹理
          g.save();
          g.beginPath(); g.rect(e.x - w / 2, e.y - 46, w, 46); g.clip();
          g.globalAlpha = 0.10 + 0.05 * pulse;
          g.strokeStyle = danger; g.lineWidth = 5;
          const off = (e.t * 40) % 18;
          for (let sx = e.x - w / 2 - 48; sx < e.x + w / 2 + 4; sx += 18) {
            g.beginPath(); g.moveTo(sx + off, e.y); g.lineTo(sx + off + 46, e.y - 46); g.stroke();
          }
          g.restore();
          g.globalAlpha = 0.85;
          g.fillStyle = danger;
          g.fillRect(e.x - w / 2, e.y - 4, w, 5);
          if (Math.abs(e.dir) === 1 && w >= 90) {
            g.globalAlpha = .78;
            g.strokeStyle = '#ffe0bc'; g.lineWidth = 1.5;
            for (const side of [-1, 1]) {
              const x = e.x + side * Math.min(w * .28, 80);
              g.beginPath(); g.moveTo(x - e.dir * 4, e.y - 16);
              g.lineTo(x + e.dir * 3, e.y - 12); g.lineTo(x - e.dir * 4, e.y - 8); g.stroke();
            }
          }
          // 中央警示三角
          g.globalAlpha = 0.72 + 0.2 * pulse;
          g.beginPath();
          g.moveTo(e.x, e.y - 34); g.lineTo(e.x - 9, e.y - 16); g.lineTo(e.x + 9, e.y - 16);
          g.closePath(); g.fill();
          g.globalAlpha = 0.9;
          g.fillStyle = '#fff2e0';
          g.fillRect(e.x - 1.2, e.y - 30, 2.4, 8);
          g.fillRect(e.x - 1.2, e.y - 20, 2.4, 2.6);
          g.restore();
          break;
        }
        case 'laser': {
          const warn = e.warn || 0.5;
          // 裂空已经完成地面预警，命中当帧直接亮起固定判定宽度。
          // 旧调用未传这两个选项，继续沿用原预警比例与收缩。
          const onset = e.immediate === true ? 0 : warn / (warn + 0.25);
          if (k < onset) {
            g.save(); g.globalAlpha = 0.5;
            g.fillStyle = e.color || '#ff5545';
            g.fillRect(e.x - 3, 0, 6, e.y);
            g.restore();
          } else {
            g.save();
            const kk = (k - onset) / (1 - onset);
            g.globalAlpha = 1 - kk;
            const fixedWidth = e.beamWidth > 0;
            const w = fixedWidth ? e.beamWidth / 2 : 26 * (1 - kk * 0.6);
            const lc = e.color || '#ffd0a0';
            const grad = g.createLinearGradient(e.x - w, 0, e.x + w, 0);
            const edge = fixedWidth ? 'rgba(120,190,255,0.4)' : 'rgba(120,190,255,0)';
            grad.addColorStop(0, edge);
            grad.addColorStop(0.5, lc);
            grad.addColorStop(1, edge);
            g.fillStyle = grad;
            g.fillRect(e.x - w, 0, w * 2, e.y);
            g.restore();
          }
          break;
        }
      }
    }
    // 全屏闪白
    if (flashT > 0) {
      g.save();
      g.globalAlpha = Math.min(0.28, flashT * 2.8);
      g.fillStyle = flashColor;
      g.fillRect(screenX, screenY, 960, 540);
      g.restore();
    }
  }

  function shakeOffset() {
    if (shakeT <= 0 || !shakeScale) return { x: 0, y: 0 };
    const k = shakeT / (shakeDur || 1);
    return { x: (Math.random() - 0.5) * 2 * shakeMag * k, y: (Math.random() - 0.5) * 2 * shakeMag * k };
  }

  function setShake(on) {
    shakeScale = on ? 1 : 0;
    try { localStorage.setItem('zmxy_shake', shakeScale ? '1' : '0'); }
    catch (_) {
      if (!shakeSaveWarned && Z.UI && Z.UI.toast) {
        shakeSaveWarned = true;
        Z.UI.toast('震屏设置已应用，本次未能保存', '#ffd28b');
      }
    }
  }

  function clear() { list.length = 0; stopT = 0; shakeT = 0; flashT = 0; clearImpact(); }

  /* ---------------- v80 场景氛围：章节色纱 + 径向暗角 + Boss 战边缘红脉动 ----------------
   * 纯屏幕空间绘制，渐变按主题缓存；只依赖传入 time（60/120Hz 行为一致）。
   * 峰值透明度刻意压低（纱≤0.10/0.12、暗角≤0.16、红脉动≤0.06），不遮战斗可读性。 */
  const atmoCache = new Map();
  const atmoTones = {
    gate: ['#8fd4e8', '#2f6f8f'], palace: ['#8fd4e8', '#2f6f8f'], throne: ['#ffd9a0', '#7a5236'],
    peach: ['#e8b4e0', '#4a3f82'], sea: ['#7ac8e8', '#14486f'], crystal: ['#9ad8ff', '#22549f'],
    fire: ['#ffb070', '#8f361f'],
  };
  function atmosphere(g, theme, time, opts = {}) {
    const tone = atmoTones[theme];
    if (!g || !tone) return;
    let at = atmoCache.get(theme);
    if (!at) {
      const veil = g.createLinearGradient(0, 0, 0, 540);
      veil.addColorStop(0, tone[0] + '1a');      // ≈0.10
      veil.addColorStop(0.24, tone[0] + '00');
      veil.addColorStop(0.76, tone[1] + '00');
      veil.addColorStop(1, tone[1] + '1f');      // ≈0.12
      const vig = g.createRadialGradient(480, 258, 250, 480, 258, 575);
      vig.addColorStop(0, 'rgba(18,13,10,0)');
      vig.addColorStop(1, 'rgba(18,13,10,0.16)');
      const pulse = g.createRadialGradient(480, 270, 300, 480, 270, 600);
      pulse.addColorStop(0, 'rgba(150,22,22,0)');
      pulse.addColorStop(1, 'rgba(150,22,22,0.06)');
      at = { veil, vig, pulse };
      atmoCache.set(theme, at);
    }
    g.save();
    g.fillStyle = at.veil; g.fillRect(0, 0, 960, 540);
    g.fillStyle = at.vig; g.fillRect(0, 0, 960, 540);
    if (opts.boss) {
      g.globalAlpha = 0.55 + 0.45 * Math.sin((time || 0) * 2.2);
      g.fillStyle = at.pulse; g.fillRect(0, 0, 960, 540);
    }
    g.restore();
  }

  /* ---------------- v81 环境粒子：按主题给战场“活着”的空气感 ----------------
   * 天宫系浮尘 / 桃园落瓣 / 东海气泡 / 火焰余烬。屏幕空间、无状态，
   * 位置全部由 index+time 决定（60/120Hz 一致，镜头移动也不抖）。 */
  function ambient(g, theme, time) {
    if (!g) return;
    const t = time || 0;
    g.save();
    if (theme === 'peach') {
      // 落瓣：粉瓣旋转下落，横向摆动
      for (let i = 0; i < 14; i++) {
        const sy = ((i * 67 + t * (24 + (i % 4) * 8)) % 590) - 25;
        const sway = Math.sin(t * 1.3 + i * 1.9) * 16;
        const sx = ((i * 149 + 40) % 960) + sway;
        g.save();
        g.globalAlpha = 0.34 + 0.14 * Math.sin(i * 2.7);
        g.translate(sx, sy);
        g.rotate(t * 2 + i);
        g.fillStyle = i % 3 ? '#f2b3cd' : '#f8d3e2';
        g.beginPath(); g.ellipse(0, 0, 4.2, 2.1, 0, 0, Z.U.TAU); g.fill();
        g.restore();
      }
    } else if (theme === 'sea' || theme === 'crystal') {
      // 气泡：上升、微摆、空心带高光
      for (let i = 0; i < 12; i++) {
        const sy = 565 - ((i * 83 + t * (26 + (i % 4) * 10)) % 610);
        const sx = ((i * 173 + 90) % 960) + Math.sin(t * 1.1 + i * 1.4) * 11;
        const r = 1.6 + (i % 3) * 0.9;
        g.globalAlpha = 0.34 + 0.14 * Math.sin(i * 1.7);
        g.strokeStyle = '#bfe9ff'; g.lineWidth = 1;
        g.beginPath(); g.arc(sx, sy, r, 0, Z.U.TAU); g.stroke();
        g.fillStyle = 'rgba(240,252,255,0.8)';
        g.beginPath(); g.arc(sx - r * 0.35, sy - r * 0.35, r * 0.22, 0, Z.U.TAU); g.fill();
      }
    } else if (theme === 'fire') {
      // 余烬：上升、闪烁、偶发短尾
      for (let i = 0; i < 14; i++) {
        const sy = 565 - ((i * 71 + t * (30 + (i % 5) * 12)) % 620);
        const sx = ((i * 211 + 60) % 960) + Math.sin(t * 0.9 + i * 1.7) * 19;
        const flick = 0.30 + 0.30 * Math.sin(t * 6 + i * 2.3);
        g.globalAlpha = flick;
        g.fillStyle = i % 3 ? '#ffb060' : '#ffd08a';
        g.beginPath(); g.arc(sx, sy, 1.5 + (i % 3) * 0.5, 0, Z.U.TAU); g.fill();
        if (i % 4 === 0) {
          g.strokeStyle = '#ff9a4d'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(sx, sy + 5); g.lineTo(sx, sy + 11); g.stroke();
        }
      }
    } else {
      // 天宫系（gate/palace/throne）：缓漂金尘，与标题页同一语言
      for (let i = 0; i < 12; i++) {
        const mx = ((i * 173 + t * (8 + (i % 3) * 4)) % 1040) - 40;
        const my = ((i * 97 + 70) % 500) + Math.sin(t * 1.2 + i * 2.1) * 12;
        g.globalAlpha = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2 + i * 2.1));
        Z.Spr.ell(g, mx, my, 2, 2, '#ffe8a0');
      }
    }
    g.restore();
  }

  return { add, text, shake, hitstop, flash, update, draw, shakeOffset, clear, isFrozen: () => stopT > 0, setShake, shakeOn: () => !!shakeScale,
    atmosphere, ambient,
    setImpactFeedback, impactFeedback: () => impactOn, impact, consumeImpact, clearImpact, impactRemaining: () => impactT };
})();

/* ================= 场景转场（圆形 iris 收放） ================= */
Z.Trans = (() => {
  const U = Z.U;
  let phase = 'idle';          // idle | out | hold | in
  let t = 0, cb = null, cx = 480, cy = 270;
  const OUT = 0.30, HOLD = 0.08, IN = 0.45;
  const MAXR = 640;            // > 屏幕对角线(551)，全开时无黑边

  // fn 在全黑瞬间执行（切场景）；x/y 为 iris 中心（鼠标/玩家位置）
  function go(fn, x, y) {
    if (phase !== 'idle') return false;
    phase = 'out'; t = 0; cb = fn;
    cx = U.clamp(x == null ? 480 : x, 90, 870);
    cy = U.clamp(y == null ? 270 : y, 80, 460);
    return true;
  }

  function update(dt) {
    if (phase === 'idle') return;
    t += dt;
    if (phase === 'out' && t >= OUT) {
      phase = 'hold'; t = 0;
      if (cb) { try { cb(); } catch (e) { console.error(e); } cb = null; }
    } else if (phase === 'hold' && t >= HOLD) { phase = 'in'; t = 0; }
    else if (phase === 'in' && t >= IN) { phase = 'idle'; }
  }

  function draw(g) {
    if (phase === 'idle') return;
    let k = phase === 'out' ? t / OUT : phase === 'hold' ? 1 : 1 - t / IN;
    k = U.clamp(k, 0, 1);
    const e = k * k * (3 - 2 * k);      // smoothstep
    const r = MAXR * (1 - e);
    g.save();
    g.fillStyle = '#0a0e16';
    g.beginPath();
    g.rect(0, 0, 960, 540);
    if (r > 0.5) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, U.TAU, true); }
    g.fill('evenodd');
    if (r > 0.5 && r < MAXR * 0.985) {  // 金圈描边
      g.globalAlpha = 0.35 + 0.55 * e;
      g.strokeStyle = '#f5c542';
      g.lineWidth = 2.5 + 3.5 * e;
      g.beginPath(); g.arc(cx, cy, r, 0, U.TAU); g.stroke();
      g.globalAlpha *= 0.35;
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(cx, cy, Math.max(1, r - 7), 0, U.TAU); g.stroke();
    }
    g.restore();
  }

  return { go, update, draw, get busy() { return phase !== 'idle'; } };
})();
