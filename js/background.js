/* ============================================================
 * background.js —— 天宫场景：视差云海、南天门、蟠桃园、凌霄殿
 * ============================================================ */
'use strict';

Z.BG = (() => {
  const U = Z.U;

  // 普通 Image 路径可直接在 file:// 下加载；无头测试及缺失素材沿用程序化背景。
  const art = {};
  const surfaceArt = {};
  let peachArt = null;
  const chapterArt = {};
  const chapterFiles = {
    court: 'heaven-courtyard-v1.png', hall: 'heaven-throne-v1.png', coast: 'east-sea-coast-v1.png',
    ocean: 'east-sea-palace-v1.png', mountain: 'flaming-mountain-v1.png', cave: 'demon-caverns-v1.png',
  };
  if (typeof Image !== 'undefined') {
    const base = document.currentScript && document.currentScript.src;
    for (const [key, file] of Object.entries({sky: 'cloud-city', gate: 'gate', veranda: 'veranda'})) {
      const img = new Image();
      img.onload = () => { art[key] = img; };
      img.src = base ? new URL('../assets/art/nantian-' + file + '.png', base).href : 'assets/art/nantian-' + file + '.png';
    }
    const peach = new Image();
    peach.onload = () => { peachArt = peach; };
    peach.src = base ? new URL('../assets/art/scenes/pantao-garden-v1.png', base).href : 'assets/art/scenes/pantao-garden-v1.png';
    for (const [key, file] of Object.entries(chapterFiles)) {
      const img = new Image();
      img.onload = () => { chapterArt[key] = img; };
      img.src = base ? new URL('../assets/art/scenes/' + file, base).href : 'assets/art/scenes/' + file;
    }
    for (const key of ['platform', 'rail']) {
      const img = new Image(), file = 'visual-jade-' + key + '-v1.png';
      img.onload = () => { surfaceArt[key] = img; };
      img.src = base ? new URL('../assets/art/scenes/' + file, base).href : 'assets/art/scenes/' + file;
    }
  }
  const artReady = () => !!(art.sky && art.gate && art.veranda);
  const peachArtReady = () => !!peachArt;

  // 图只负责远景；路面和每块平台由原始碰撞坐标独立绘制。
  const chapterScenes = {
    2: { art: 'court', view: [0, 1], surface: 'jade', colors: ['#e8e8d2', '#a4bdb2', '#527b80', '#fff0c3'], mote: '#fff2bd' },
    3: { art: 'hall', view: [.14, 1], surface: 'jade', colors: ['#e3d8b7', '#9d9f8d', '#4c6264', '#f8dfa0'], mote: '#f9dda0' },
    4: { art: 'hall', view: [0, .23], surface: 'seal', colors: ['#c1c4d0', '#85899f', '#3e435e', '#e1d4ff'], tint: 'rgba(26,25,65,0.32)', mote: '#c5b9ef' },
    5: { art: 'coast', view: [0, 1], surface: 'sand', colors: ['#ecdcb2', '#c6b58c', '#8a8c78', '#fff0c7'], mote: '#f5ffff' },
    6: { art: 'ocean', view: [0, .42], surface: 'reef', colors: ['#b0c9bf', '#6e9b9e', '#315965', '#d0e6d4'], tint: 'rgba(9,46,57,0.10)', mote: '#bce9e5' },
    7: { art: 'ocean', view: [.36, 1], surface: 'crystal', colors: ['#d2e6e5', '#88b8c7', '#3c6685', '#f3faf0'], mote: '#cff9ff' },
    8: { art: 'mountain', view: [0, 1], surface: 'basalt', colors: ['#b6a28b', '#756660', '#3e3941', '#e0c7a0'], mote: '#f4ba72' },
    9: { art: 'cave', view: [0, .37], surface: 'cave', colors: ['#a9bcb1', '#687f7b', '#364e55', '#cde1c2'], mote: '#aed6bb' },
    10: { art: 'cave', view: [.44, 1], surface: 'basalt', colors: ['#beb0b6', '#817481', '#463e52', '#e1c7b1'], mote: '#dbb0a1' },
  };
  const defaultStage = { palace: 2, throne: 3, sea: 6, crystal: 7, fire: 8 };
  const sceneArtReady = stageIdx => !!(chapterScenes[stageIdx] && chapterArt[chapterScenes[stageIdx].art]);

  function chapterSurface(g, scene, camX, gy, platforms) {
    if (scene.surface === 'jade' && surfaceArt.platform && surfaceArt.rail) {
      drawPaintedJade(g, camX, gy, platforms);
      return;
    }
    const [top, face, base, edge] = scene.colors;
    g.fillStyle = vGrad(g, gy, 540, [[0, top], [.30, face], [.34, base], [1, shade(base, .80)]]);
    g.fillRect(0, gy, 960, 540 - gy);
    g.fillStyle = edge; g.fillRect(0, gy, 960, 3);
    g.fillStyle = base; g.fillRect(0, gy + 3, 960, 2);
    g.fillStyle = top; g.fillRect(0, gy + 26, 960, 2);
    g.lineWidth = 1;
    for (let x = -(camX % 112); x < 1072; x += 112) {
      g.strokeStyle = shade(face, .75);
      g.beginPath(); g.moveTo(x, gy + 5); g.lineTo(x - 16, gy + 25); g.stroke();
      if (scene.surface === 'sand') {
        g.fillStyle = 'rgba(255,239,203,.24)';
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + 12 + i * 18, gy + 38 + (i % 3) * 9, 2 + i % 2, 1, 0, 0, U.TAU); g.fill(); }
      } else {
        g.strokeStyle = shade(face, 1.15);
        g.beginPath(); g.moveTo(x + 12, gy + 44);
        if (scene.surface === 'basalt' || scene.surface === 'cave') { g.lineTo(x + 41, gy + 48); g.lineTo(x + 50, gy + 62); }
        else { g.bezierCurveTo(x + 20, gy + 65, x + 50, gy + 57, x + 44, gy + 45); g.quadraticCurveTo(x + 35, gy + 36, x + 29, gy + 48); }
        g.stroke();
      }
    }
    for (const [x, y, width] of platforms || []) {
      const px = x - camX;
      if (px + width < -30 || px > 990) continue;
      g.fillStyle = 'rgba(12,29,40,.18)';
      g.beginPath(); g.ellipse(px + width / 2, y + 21, width * .49, 7, 0, 0, U.TAU); g.fill();
      g.fillStyle = vGrad(g, y, y + 18, [[0, top], [.35, face], [1, base]]);
      g.beginPath(); g.moveTo(px, y); g.lineTo(px + width, y); g.lineTo(px + width - 8, y + 15);
      g.lineTo(px + width * .67, y + 22); g.lineTo(px + width * .35, y + 19); g.lineTo(px + 7, y + 14); g.closePath(); g.fill();
      g.strokeStyle = base; g.lineWidth = 1.3; g.stroke();
      // 这条完整顶边就是碰撞面；装饰只向下延展。
      g.fillStyle = edge; g.fillRect(px, y, width, 2);
      g.fillStyle = top; g.fillRect(px + 3, y + 3, width - 6, 3);
      g.strokeStyle = shade(face, .8); g.lineWidth = 1;
      for (let xx = px + 24; xx < px + width - 15; xx += 46) { g.beginPath(); g.moveTo(xx, y + 3); g.lineTo(xx - 5, y + 12); g.stroke(); }
      if (scene.surface === 'crystal') {
        g.fillStyle = '#87afbd';
        for (const f of [.24, .75]) { g.beginPath(); g.moveTo(px + width * f - 9, y + 17); g.lineTo(px + width * f, y + 37); g.lineTo(px + width * f + 8, y + 18); g.closePath(); g.fill(); }
        g.strokeStyle = '#d9eeee'; g.beginPath(); g.moveTo(px + width * .24 - 2, y + 20); g.lineTo(px + width * .24, y + 30); g.stroke();
      } else if (scene.surface === 'reef') {
        g.strokeStyle = '#8fa7a3'; g.lineWidth = 2;
        for (const f of [.18, .8]) { const xx = px + width * f; g.beginPath(); g.moveTo(xx, y + 17); g.quadraticCurveTo(xx + 7, y + 24, xx + 2, y + 30); g.stroke(); }
      } else if (scene.surface === 'jade' || scene.surface === 'seal') {
        g.strokeStyle = edge; g.lineWidth = 1.2;
        const cx = px + width / 2; g.beginPath(); g.moveTo(cx - 7, y + 12); g.lineTo(cx, y + 16); g.lineTo(cx + 7, y + 12); g.stroke();
      }
    }
  }

  function drawChapter(g, scene, stageIdx, camX, w, gy, t, platforms) {
    g.save();
    const travel = U.clamp(camX / Math.max(1, w - 960), 0, 1);
    const position = scene.view[0] + travel * (scene.view[1] - scene.view[0]);
    // 连续横移同一张宽景；九个场景的取景范围区分外庭、深廊与殿前。
    g.drawImage(chapterArt[scene.art], -24 - position * 732, -40, 1740, 580);
    if (scene.tint) { g.fillStyle = scene.tint; g.fillRect(0, 0, 960, gy); }
    if (scene.surface === 'jade') {
      g.fillStyle = vGrad(g, gy - 190, gy, [[0, 'rgba(217,230,216,0)'], [.55, 'rgba(217,230,216,.13)'], [1, 'rgba(217,230,216,.27)']]);
      g.fillRect(0, gy - 190, 960, 190);
    }
    // 微动只在远景内，所有角色和预警之后再绘制，不被背景粒子盖住。
    if (stageIdx === 6 || stageIdx === 7) {
      g.strokeStyle = 'rgba(205,245,244,.28)'; g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const bx = ((i * 149 - camX * .18 + Math.sin(t * .8 + i) * 8) % 1080 + 1080) % 1080 - 60;
        const by = 430 - ((t * (9 + i % 4 * 3) + i * 49) % 425);
        g.beginPath(); g.arc(bx, by, 1.8 + i % 3, 0, U.TAU); g.stroke();
      }
    } else {
      g.fillStyle = scene.mote;
      for (let i = 0; i < 8; i++) {
        const bx = ((i * 157 - camX * .12 + t * (3 + i % 3)) % 1080 + 1080) % 1080 - 60;
        const by = 110 + ((i * 53 + t * (stageIdx === 8 ? -6 : 2)) % 260 + 260) % 260;
        g.globalAlpha = .12 + .12 * (.5 + .5 * Math.sin(t * .9 + i));
        g.beginPath(); g.ellipse(bx, by, 1.4, stageIdx === 8 ? 2.2 : 1.4, 0, 0, U.TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (stageIdx === 4) {
      // 镇妖塔的悬印位于背景墙，避免把封印误读为可站平台。
      g.save(); g.translate(480 - camX * .08, 214); g.globalAlpha = .20;
      g.strokeStyle = '#cabef5'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 100, 0, U.TAU); g.stroke();
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.beginPath(); g.moveTo(-7, -82); g.lineTo(7, -82); g.moveTo(-5, -74); g.lineTo(5, -74); g.stroke(); g.restore(); }
      g.restore();
    }
    chapterSurface(g, scene, camX, gy, platforms);
    g.restore();
  }

  function drawPeachGarden(g, camX, w, gy, t, platforms) {
    g.save();
    // 单幅宽景缓慢展开：园门在前段、亭阁在后段；下部云海为战斗留空。
    const travel = Math.max(0, w - 960);
    const progress = travel ? U.clamp(camX / travel, 0, 1) : 0;
    g.drawImage(peachArt, -24 - progress * 700, -35, 1740, 580);
    g.fillStyle = vGrad(g, gy - 190, gy, [[0, 'rgba(230,232,210,0)'], [.55, 'rgba(230,232,210,.10)'], [1, 'rgba(230,232,210,.23)']]);
    g.fillRect(0, gy - 190, 960, 190);
    // 淡云只在画中云海上漂动，不盖住行走面和角色轮廓。
    g.globalAlpha = 0.10;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 283 - camX * 0.16 + t * 5) % 1415 + 1415) % 1415 - 150;
      cloud(g, cx, gy - 68 + Math.sin(t * 0.2 + i) * 5, 0.7, '#f8efdb');
    }
    g.globalAlpha = 1;

    if (surfaceArt.platform && surfaceArt.rail) {
      drawPaintedJade(g, camX, gy, platforms);
    } else {
    // 玉石主路径：顶线就是碰撞面，窄顶面与下方切面分开。
    g.fillStyle = vGrad(g, gy, 540, [[0, '#e6e8cd'], [0.32, '#bbcdb2'], [0.35, '#81a39a'], [1, '#4b7d7a']]);
    g.fillRect(0, gy, 960, 540 - gy);
    g.fillStyle = '#fff2ce'; g.fillRect(0, gy, 960, 3);
    g.fillStyle = '#c8aa70'; g.fillRect(0, gy + 3, 960, 2);
    g.fillStyle = '#92b2a7'; g.fillRect(0, gy + 27, 960, 4);
    g.fillStyle = '#e3e6c9'; g.fillRect(0, gy + 31, 960, 2);
    g.strokeStyle = 'rgba(102,134,122,0.45)'; g.lineWidth = 1;
    for (let x = -(camX % 132); x < 1092; x += 132) {
      g.beginPath(); g.moveTo(x, gy + 5); g.lineTo(x - 19, gy + 27); g.stroke();
      g.strokeStyle = 'rgba(213,222,195,0.38)';
      g.beginPath(); g.moveTo(x + 20, gy + 58);
      g.bezierCurveTo(x + 5, gy + 40, x + 53, gy + 38, x + 54, gy + 51);
      g.bezierCurveTo(x + 55, gy + 61, x + 35, gy + 64, x + 35, gy + 51); g.stroke();
      g.beginPath(); g.moveTo(x + 59, gy + 55);
      g.quadraticCurveTo(x + 78, gy + 35, x + 96, gy + 55);
      g.quadraticCurveTo(x + 101, gy + 62, x + 121, gy + 61); g.stroke();
      g.strokeStyle = 'rgba(102,134,122,0.45)';
      // 落花都在切面内，保留地面上沿的清楚轮廓。
      g.fillStyle = '#d9aca4';
      g.beginPath(); g.ellipse(x + 83, gy + 14, 4, 1.5, -0.2, 0, U.TAU); g.fill();
      g.fillStyle = '#f6d8be';
      g.beginPath(); g.ellipse(x + 97, gy + 22, 2.5, 1.1, 0.4, 0, U.TAU); g.fill();
    }

    // 现有云平台原坐标不变；玉台窄顶对齐判定，下方云托不另成可站区域。
    for (const [x, y, width] of platforms || []) {
      const px = x - camX;
      if (px + width < -30 || px > 990) continue;
      g.fillStyle = 'rgba(91,122,117,0.17)';
      g.beginPath(); g.ellipse(px + width / 2, y + 22, width * 0.55, 8, 0, 0, U.TAU); g.fill();
      g.fillStyle = '#b8d0c9';
      g.beginPath();
      g.moveTo(px + 6, y + 8);
      g.quadraticCurveTo(px + width * 0.20, y + 34, px + width * 0.38, y + 17);
      g.quadraticCurveTo(px + width * 0.55, y + 33, px + width * 0.73, y + 18);
      g.quadraticCurveTo(px + width * 0.91, y + 29, px + width - 6, y + 8);
      g.closePath(); g.fill();
      g.fillStyle = vGrad(g, y, y + 11, [[0, '#e7ecd8'], [1, '#9bbfb4']]);
      g.fillRect(px, y, width, 11);
      g.strokeStyle = '#6f9790'; g.lineWidth = 1.2;
      g.strokeRect(px, y + 1, width, 10);
      g.fillStyle = '#fff4d5'; g.fillRect(px, y, width, 2);
      g.fillStyle = '#c6ad78'; g.fillRect(px + 4, y + 2, width - 8, 1);
      g.fillStyle = '#e6eee0';
      for (let xx = px + 15; xx < px + width - 12; xx += 31) {
        g.beginPath(); g.ellipse(xx, y + 14, 10, 3.5, -0.25, 0, U.TAU); g.fill();
      }
    }
    }
    // 少量小花瓣在背景内飘落；不穿过玩家脚下或成为预警遮罩。
    g.globalAlpha = 0.46;
    g.fillStyle = '#e9b4ad';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 179 - camX * 0.3 + t * (8 + i % 3)) % 1100 + 1100) % 1100 - 70;
      const y = 100 + ((t * (7 + i % 4) + i * 61) % Math.max(1, gy - 196));
      g.beginPath(); g.ellipse(x + Math.sin(t + i) * 7, y, 2.1, 0.9, t * 0.6 + i, 0, U.TAU); g.fill();
    }
    g.restore();
  }

  function jadeRail(g, x, width, gy) {
    g.fillStyle = '#91b7b7'; g.fillRect(x, gy - 38, width, 5);
    g.fillStyle = '#e9ecda'; g.fillRect(x, gy - 39, width, 3);
    for (let xx = x; xx <= x + width; xx += 70) {
      g.fillStyle = '#87a8a8'; g.fillRect(xx - 5, gy - 40, 10, 37);
      g.fillStyle = '#eff0db'; g.fillRect(xx - 5, gy - 40, 5, 35);
      g.fillStyle = '#cdb478'; g.fillRect(xx - 7, gy - 40, 14, 3);
      g.fillStyle = '#eae8d1'; g.beginPath(); g.arc(xx, gy - 45, 6, 0, U.TAU); g.fill();
    }
    g.strokeStyle = '#abc6bf'; g.lineWidth = 4;
    for (let xx = x + 12; xx < x + width - 10; xx += 70) {
      g.beginPath(); g.moveTo(xx, gy - 15); g.lineTo(xx + 45, gy - 15); g.stroke();
    }
  }

  function drawNantian(g, camX, w, gy, t, platforms) {
    if (surfaceArt.platform && surfaceArt.rail) {
      drawPaintedNantian(g, camX, w, gy, t, platforms);
      return;
    }
    g.save();
    // 天宫远景只慢速平移，不会随镜头重复整幅建筑。
    g.drawImage(art.sky, -22 - Math.min(camX, 2240) * 0.105, -105, 1280, 720);
    g.save();
    g.translate(-camX, 0);
    if (w > 1500) {
      // 长廊退到战斗线后方；门阙与Boss庭院使用同一世界坐标。
      g.globalAlpha = 0.88;
      g.drawImage(art.veranda, 675, 64, 1250, 417);
      g.globalAlpha = 1;
      g.drawImage(art.gate, w - 805, gy - 426, 650, 433);
      jadeRail(g, 0, 630, gy - 5);
      jadeRail(g, 1990, 210, gy - 5);
    } else {
      g.drawImage(art.gate, 395, gy - 426, 650, 433);
      jadeRail(g, -20, 250, gy - 5);
    }
    g.restore();

    // 云桥为实际行走面：顶面、切面和玉石拼缝清楚分开。
    g.fillStyle = vGrad(g, gy, 540, [[0, '#eee9d2'], [0.4, '#d3d7c5'], [0.44, '#94b2ad'], [1, '#507d84']]);
    g.fillRect(0, gy, 960, 540 - gy);
    g.fillStyle = '#fbf0c8'; g.fillRect(0, gy, 960, 4);
    g.fillStyle = '#b9a876'; g.fillRect(0, gy + 4, 960, 2);
    g.fillStyle = '#749895'; g.fillRect(0, gy + 31, 960, 3);
    g.fillStyle = '#e1e4cc'; g.fillRect(0, gy + 34, 960, 2);
    g.strokeStyle = 'rgba(113,132,122,0.42)'; g.lineWidth = 1;
    for (let x = -(camX % 112); x < 1072; x += 112) {
      g.beginPath(); g.moveTo(x, gy + 6); g.lineTo(x - 18, gy + 29); g.stroke();
      g.strokeStyle = 'rgba(218,225,203,0.45)';
      g.beginPath(); g.moveTo(x + 12, gy + 43); g.bezierCurveTo(x + 16, gy + 63, x + 46, gy + 61, x + 45, gy + 49);
      g.bezierCurveTo(x + 43, gy + 39, x + 26, gy + 40, x + 30, gy + 51); g.stroke();
      g.strokeStyle = 'rgba(113,132,122,0.42)';
    }
    // 云台的上缘精确对应碰撞面，不把阴影或飘云当作可站区域。
    for (const [x, y, width] of platforms || []) {
      const px = x - camX;
      if (px + width < -30 || px > 990) continue;
      g.fillStyle = 'rgba(72,107,129,0.22)';
      g.beginPath(); g.ellipse(px + width / 2, y + 16, width * 0.52, 10, 0, 0, U.TAU); g.fill();
      g.fillStyle = '#b0cfd0';
      g.beginPath(); g.ellipse(px + width / 2, y + 8, width / 2, 14, 0, 0, U.TAU); g.fill();
      g.fillStyle = '#f5f3db';
      g.beginPath(); g.ellipse(px + width / 2, y + 3, width / 2, 8, 0, 0, U.TAU); g.fill();
      g.fillStyle = '#ffefb6'; g.fillRect(px + 8, y - 1, width - 16, 3);
      g.strokeStyle = '#7fa9ae'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(px + 10, y + 11); g.quadraticCurveTo(px + width / 2, y + 25, px + width - 10, y + 11); g.stroke();
    }
    // 近处薄云只掠过桥的底缘，保留脚下和血条的辨识度。
    g.globalAlpha = 0.12;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 271 - camX * 0.3 + t * 7) % 1355 + 1355) % 1355 - 180;
      cloud(g, x, 550 + Math.sin(t * 0.4 + i) * 4, 0.6, '#ecf3df');
    }
    g.restore();
  }

  // 两张绘画饰面均可用才启用新版；缺图或延迟时完整保留上面的旧场景。
  function drawPaintedNantian(g, camX, w, gy, t, platforms) {
    g.save();
    g.drawImage(art.sky, -22 - Math.min(camX, 2240) * 0.105, -105, 1280, 720);
    // 远景冷色空气层与近处暖玉形成距离；角色和预警均在此层之后绘制。
    g.fillStyle = vGrad(g, 0, gy, [[0, 'rgba(92,143,155,.07)'], [.54, 'rgba(204,224,218,.10)'], [1, 'rgba(214,229,219,.24)']]);
    g.fillRect(0, 0, 960, gy);
    g.save(); g.translate(-camX, 0);
    g.globalAlpha = .74;
    if (w > 1500) {
      g.drawImage(art.veranda, 675, 88, 1250, 417);
      g.globalAlpha = .86;
      g.drawImage(art.gate, w - 805, gy - 400, 650, 433);
    } else {
      g.globalAlpha = .86;
      g.drawImage(art.gate, 395, gy - 400, 650, 433);
    }
    g.restore();
    g.fillStyle = vGrad(g, gy - 165, gy, [[0, 'rgba(221,233,220,0)'], [.55, 'rgba(221,233,220,.18)'], [1, 'rgba(221,233,220,.36)']]);
    g.fillRect(0, gy - 165, 960, 165);

    // 栏杆始终在人物背后，切到整块柱脚，不截出漂浮的半幅画。
    g.save(); g.translate(-camX, 0);
    const rails = w > 1500 ? [[0, 630], [1990, 210]] : [[-20, 250]];
    for (const [rx, rw] of rails) {
      const count = Math.max(1, Math.round(rw / 315)), tileWidth = (rw + (count - 1) * 17) / count;
      for (let i = 0; i < count; i++) {
        g.drawImage(surfaceArt.rail, 29, 110, 2115, 468, rx + i * (tileWidth - 17), gy - 70, tileWidth, 70);
      }
    }
    g.restore();

    drawPaintedJade(g, camX, gy, platforms);
    // 薄云贴近桥的下沿，台面及角色所在区域保持清楚。
    g.globalAlpha = .10;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 271 - camX * .3 + t * 7) % 1355 + 1355) % 1355 - 180;
      cloud(g, x, 551 + Math.sin(t * .4 + i) * 4, .6, '#dceee7');
    }
    g.restore();
  }

  // 天宫四处相邻场景共享饰面；世界坐标、顶线和图像失败路径由各调用方保留。
  function drawPaintedJade(g, camX, gy, platforms) {
    // 正面云纹来自原画；上方16px窄台面由世界坐标拼缝，准确托住角色脚底。
    g.fillStyle = vGrad(g, gy, 540, [[0, '#dfe7d2'], [.24, '#b4c6b3'], [.26, '#355f60'], [1, '#244a50']]);
    g.fillRect(0, gy, 960, 540 - gy);
    g.save(); g.beginPath(); g.rect(0, gy + 16, 960, 540 - gy - 16); g.clip();
    for (let x = -(camX % 420); x < 960; x += 420) {
      g.drawImage(surfaceArt.platform, 210, 276, 1750, 170, x, gy + 16, 420, 58);
    }
    g.fillStyle = vGrad(g, gy + 18, 540, [[0, 'rgba(26,63,65,.46)'], [1, 'rgba(18,48,53,.68)']]);
    g.fillRect(0, gy + 16, 960, 540 - gy - 16);
    g.restore();
    g.fillStyle = '#fbf0ce'; g.fillRect(0, gy, 960, 3);
    g.fillStyle = '#afc2b1'; g.fillRect(0, gy + 3, 960, 1);
    g.fillStyle = '#4f776f'; g.fillRect(0, gy + 14, 960, 3);
    g.fillStyle = '#bfa674'; g.fillRect(0, gy + 17, 960, 1);
    for (let x = -(camX % 112); x < 1072; x += 112) {
      g.strokeStyle = 'rgba(72,105,96,.42)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, gy + 3); g.lineTo(x - 12, gy + 13); g.stroke();
      g.strokeStyle = 'rgba(255,249,216,.55)';
      g.beginPath(); g.moveTo(x + 2, gy + 3); g.lineTo(x - 10, gy + 13); g.stroke();
      g.strokeStyle = 'rgba(124,149,130,.26)';
      g.beginPath(); g.moveTo(x + 21, gy + 7); g.quadraticCurveTo(x + 41, gy + 5, x + 71, gy + 10); g.stroke();
    }

    for (const [x, y, width] of platforms || []) {
      const px = x - camX;
      if (px + width < -30 || px > 990) continue;
      const height = U.clamp(width * .22, 32, 44);
      // PNG只作为下方石体，整条可站上缘由原始碰撞坐标直接描出。
      g.drawImage(surfaceArt.platform, 24, 248, 2125, 310, px, y, width, height);
      g.fillStyle = '#f6ecd0'; g.fillRect(px, y, width, 2);
      g.fillStyle = '#bdad7c'; g.fillRect(px + 2, y + 2, Math.max(0, width - 4), 1);
      g.strokeStyle = 'rgba(255,250,220,.45)'; g.lineWidth = .7;
      g.beginPath(); g.moveTo(px + 8, y + 5); g.lineTo(px + width - 9, y + 5); g.stroke();
    }
  }

  /* ---- 赛璐璐着色工具 ---- */
  // f<1 变暗，f>1 变亮；输入 #rrggbb
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  // 垂直渐变（0..1 顶部→底部）
  function vGrad(g, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    for (const [p, c] of stops) gr.addColorStop(p, c);
    return gr;
  }
  // 描边：统一深色轮廓
  function outline(g, color, w) {
    g.strokeStyle = shade(color, 0.5);
    g.lineWidth = w || 2;
    g.lineJoin = 'round';
    g.stroke();
  }
  // 带描边矩形 / 圆
  function rectO(g, x, y, w, h, color, lw) {
    g.fillStyle = color;
    g.beginPath(); g.rect(x, y, w, h); g.fill();
    outline(g, color, lw || 2);
  }
  function circleO(g, x, y, r, color, lw) {
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.fill();
    outline(g, color, lw || 2);
  }

  // 每个主题预生成云与远山（seed 决定形状）
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function makeClouds(theme, w) {
    const rnd = seeded(theme.length * 77 + 13);
    const arr = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        x: rnd() * (w + 800) - 400,
        y: 40 + rnd() * 260,
        s: 0.5 + rnd() * 1.1,
        layer: rnd() < 0.5 ? 0.25 : 0.5,
        drift: 4 + rnd() * 8,
      });
    }
    return arr;
  }
  function makeHills(theme, w) {
    const rnd = seeded(theme.length * 31 + 7);
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push({ x: rnd() * (w + 600) - 300, y: 300 + rnd() * 90, w: 260 + rnd() * 300, h: 90 + rnd() * 110 });
    }
    return arr;
  }

  const cache = {};

  const THEMES = {
    gate: {
      sky: ['#2c3e6b', '#6a5a9a', '#e8896a'],
      hill: 'rgba(70,60,110,0.55)', cloud: 'rgba(255,235,225,0.85)',
      ground: '#7a5a9a', groundTop: '#a88ac2', groundLine: '#c9b0e0',
      plat: 'cloud',
    },
    peach: {
      sky: ['#ff9a76', '#ffc4a0', '#ffe8c9'],
      hill: 'rgba(180,110,140,0.4)', cloud: 'rgba(255,250,240,0.92)',
      ground: '#7aa05a', groundTop: '#98c473', groundLine: '#b8dfa0',
      plat: 'cloud',
    },
    palace: {
      sky: ['#1e2a52', '#3d4a8a', '#8a6aa8'],
      hill: 'rgba(40,50,100,0.5)', cloud: 'rgba(220,225,255,0.8)',
      ground: '#5a6a9a', groundTop: '#8898c2', groundLine: '#b0c0e0',
      plat: 'marble',
    },
    throne: {
      sky: ['#2a1e46', '#5a3a6e', '#a86a5a'],
      hill: 'rgba(50,30,70,0.55)', cloud: 'rgba(255,225,200,0.75)',
      ground: '#6a5a8a', groundTop: '#9a88b8', groundLine: '#c2b0d8',
      plat: 'marble',
    },
    sea: {
      sky: ['#07294e', '#0a4a6e', '#0e7d80'],
      hill: 'rgba(8,40,66,0.6)', cloud: 'rgba(150,220,255,0.16)',
      ground: '#8a7a52', groundTop: '#a89a68', groundLine: '#c2b485',
      plat: 'coral', bubbles: true, rays: true,
    },
    crystal: {
      sky: ['#0a1e3e', '#123a6e', '#1a5a8a'],
      hill: 'rgba(14,40,80,0.6)', cloud: 'rgba(180,230,255,0.18)',
      ground: '#4a5a8a', groundTop: '#6878aa', groundLine: '#8a9acc',
      plat: 'crystal', bubbles: true, rays: true,
    },
    fire: {
      sky: ['#2a0a0a', '#6e2410', '#c85a1a'],
      hill: 'rgba(50,16,8,0.65)', cloud: 'rgba(255,170,90,0.2)',
      ground: '#3a221a', groundTop: '#5c3422', groundLine: '#8a5030',
      plat: 'basalt', embers: true,
    },
  };

  /* ---- 云朵 ---- */
  function cloud(g, x, y, s, color) {
    g.save();
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, 34 * s, 13 * s, 0, 0, U.TAU);
    g.ellipse(x - 22 * s, y + 4 * s, 20 * s, 10 * s, 0, 0, U.TAU);
    g.ellipse(x + 24 * s, y + 3 * s, 22 * s, 11 * s, 0, 0, U.TAU);
    g.ellipse(x + 4 * s, y - 9 * s, 20 * s, 12 * s, 0, 0, U.TAU);
    g.fill();
    // 底部阴影（体积感）
    g.fillStyle = 'rgba(50,60,100,0.16)';
    g.beginPath();
    g.ellipse(x + 2 * s, y + 9 * s, 27 * s, 6.5 * s, 0, 0, U.TAU);
    g.fill();
    // 顶部高光
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(x - 8 * s, y - 10 * s, 17 * s, 7 * s, -0.12, 0, U.TAU);
    g.fill();
    g.restore();
  }

  /* ---- 建筑与地标（世界坐标，视差=1） ---- */
  function gateBuilding(g, x, gy) {
    // 南天门：赛璐璐上色（明暗渐变 + 描边 + 瓦片 + 投影）
    g.save();
    g.translate(x, gy);
    // 地面投影
    g.fillStyle = 'rgba(18,14,28,0.32)';
    g.beginPath(); g.ellipse(0, 2, 152, 18, 0, 0, U.TAU); g.fill();

    // ===== 城台（红墙渐变） =====
    g.fillStyle = vGrad(g, -150, 0, [[0, '#b0564c'], [0.14, '#9a463c'], [1, '#6e302a']]);
    g.beginPath(); g.rect(-110, -150, 220, 150); g.fill();
    outline(g, '#8a3a32', 2.6);
    // 顶部横梁 + 高光
    rectO(g, -110, -150, 220, 14, '#ba5a50', 2);
    g.fillStyle = 'rgba(255,255,255,0.26)';
    g.fillRect(-110, -150, 220, 4);
    // 侧收分线
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(-104, -138, 6, 124);
    g.fillRect(98, -138, 6, 124);

    // ===== 门洞 =====
    g.fillStyle = '#1c1220';
    g.beginPath();
    g.moveTo(-34, 0); g.lineTo(-34, -64); g.arc(0, -64, 34, Math.PI, 0); g.lineTo(34, 0);
    g.closePath(); g.fill();
    outline(g, '#2a1a2e', 2.4);
    // 门洞内微光
    const dg = g.createRadialGradient(0, -30, 3, 0, -30, 40);
    dg.addColorStop(0, 'rgba(126,96,148,0.32)');
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dg;
    g.beginPath(); g.moveTo(-29, 0); g.lineTo(-29, -61); g.arc(0, -61, 29, Math.PI, 0); g.lineTo(29, 0); g.closePath(); g.fill();
    // 门槛
    rectO(g, -40, -6, 80, 6, '#8a5a2e', 1.4);

    // ===== 金钉（带高光点） =====
    for (const ry of [-126, -18]) {
      for (let i = 0; i < 5; i++) {
        const px = -90 + i * 18;
        circleO(g, px, ry, 2.6, '#d9a926', 1);
        g.fillStyle = '#f5c542'; g.beginPath(); g.arc(px, ry, 1.7, 0, U.TAU); g.fill();
        g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(px - 0.7, ry - 0.7, 0.7, 0, U.TAU); g.fill();
      }
    }

    // ===== 城楼 =====
    g.fillStyle = vGrad(g, -210, -148, [[0, '#b0564c'], [1, '#7c362e']]);
    g.beginPath(); g.rect(-88, -210, 176, 62); g.fill();
    outline(g, '#8a3a32', 2.6);
    g.fillStyle = 'rgba(255,255,255,0.20)';
    g.fillRect(-88, -210, 176, 5);
    // 柱子（圆柱渐变 + 柱头柱础）
    for (let i = 0; i < 5; i++) {
      const cx = -80 + i * 38;
      const cg = g.createLinearGradient(cx - 4.5, 0, cx + 4.5, 0);
      cg.addColorStop(0, '#8a3028'); cg.addColorStop(0.35, '#c05a4e');
      cg.addColorStop(0.7, '#a04840'); cg.addColorStop(1, '#6a2822');
      g.fillStyle = cg;
      g.fillRect(cx - 4.5, -206, 9, 56);
      outline(g, '#6a2822', 1.2);
      rectO(g, cx - 7, -209, 14, 5, '#e0b060', 1);
      rectO(g, cx - 7, -151, 14, 5, '#e0b060', 1);
    }
    // 栏杆
    rectO(g, -88, -150, 176, 4, '#8a3028', 1.5);
    for (let i = 0; i < 6; i++) rectO(g, -86 + i * 34, -156, 3.5, 8, '#8a3028', 1);

    // ===== 匾额 =====
    rectO(g, -34, -196, 68, 22, '#1c1220', 1.6);
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.4;
    g.strokeRect(-32, -194, 64, 18);
    Z.Spr.text(g, '南天门', 0, -185, { size: 15, color: '#ffd75e', bold: true });

    // ===== 屋顶（金色琉璃瓦） =====
    g.fillStyle = vGrad(g, -240, -206, [[0, '#f8d268'], [0.5, '#e8b23c'], [1, '#b87f1e']]);
    g.beginPath();
    g.moveTo(-116, -208);
    g.quadraticCurveTo(-104, -236, -84, -240);
    g.lineTo(84, -240);
    g.quadraticCurveTo(104, -236, 116, -208);
    g.lineTo(98, -208);
    g.quadraticCurveTo(88, -222, -88, -222);
    g.quadraticCurveTo(-98, -208, -116, -208);
    g.closePath(); g.fill();
    outline(g, '#b87f1e', 2.6);
    // 瓦楞（横向弧）
    g.strokeStyle = 'rgba(150,90,20,0.45)'; g.lineWidth = 1.4;
    for (const wy of [-226, -216]) {
      g.beginPath(); g.moveTo(-92, wy); g.quadraticCurveTo(0, wy - 8, 92, wy); g.stroke();
    }
    // 筒瓦（纵向短弧）
    g.strokeStyle = 'rgba(150,90,20,0.5)';
    for (let i = -7; i <= 7; i++) {
      const vx = i * 13;
      g.beginPath(); g.moveTo(vx, -224); g.quadraticCurveTo(vx + 2, -231, vx, -238); g.stroke();
    }
    // 屋脊高光带
    g.fillStyle = '#ffdf80';
    g.beginPath();
    g.moveTo(-88, -238); g.quadraticCurveTo(0, -247, 88, -238);
    g.lineTo(88, -234); g.quadraticCurveTo(0, -242, -88, -234);
    g.closePath(); g.fill();
    outline(g, '#d9a926', 1.4);
    // 正脊宝珠
    circleO(g, 0, -246, 5, '#f5c542', 1.5);
    g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(-1.5, -248, 1.8, 0, U.TAU); g.fill();
    // 飞檐（翘角 + 檐角球）
    for (const s of [-1, 1]) {
      g.fillStyle = '#e8b23c';
      g.beginPath();
      g.moveTo(s * 112, -209);
      g.quadraticCurveTo(s * 128, -214, s * 134, -228);
      g.quadraticCurveTo(s * 126, -228, s * 120, -220);
      g.closePath(); g.fill();
      outline(g, '#b87f1e', 2);
      circleO(g, s * 133, -230, 3, '#f5c542', 1);
    }
    g.restore();
  }

  function peachTree(g, x, gy, s) {
    g.save();
    g.translate(x, gy);
    g.scale(s, s);
    // 投影
    g.fillStyle = 'rgba(30,40,20,0.25)';
    g.beginPath(); g.ellipse(0, 2, 30, 7, 0, 0, U.TAU); g.fill();
    // 树干（渐变 + 描边）
    g.fillStyle = vGrad(g, -48, 0, [[0, '#8a6040'], [1, '#5a3a22']]);
    g.beginPath();
    g.moveTo(-5, 0); g.quadraticCurveTo(-3, -30, -10, -46);
    g.lineTo(-2, -48); g.quadraticCurveTo(4, -30, 5, 0);
    g.closePath(); g.fill();
    outline(g, '#46301a', 1.6);
    // 树冠（底层暗影 + 描边 blobs）
    const blobs = [[0, -58, 26], [-20, -46, 18], [20, -48, 19], [0, -44, 20]];
    g.fillStyle = 'rgba(130,55,85,0.45)';
    for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx + 2.5, by + 3.5, br, 0, U.TAU); g.fill(); }
    for (const [bx, by, br] of blobs) {
      g.fillStyle = '#f2a0b8'; g.beginPath(); g.arc(bx, by, br, 0, U.TAU); g.fill();
      outline(g, '#d47898', 1.5);
      g.fillStyle = '#f8bcd0'; g.beginPath(); g.arc(bx - br * 0.25, by - br * 0.3, br * 0.7, 0, U.TAU); g.fill();
    }
    // 蟠桃（带高光）
    for (const [px, py] of [[-12, -40], [10, -44], [2, -34]]) {
      g.fillStyle = '#ffb0a0'; g.beginPath(); g.arc(px, py, 4.5, 0, U.TAU); g.fill();
      outline(g, '#d47a70', 1);
      g.fillStyle = '#ffd0c0'; g.beginPath(); g.arc(px - 1.4, py - 1.4, 2, 0, U.TAU); g.fill();
      g.fillStyle = '#fff0e8'; g.beginPath(); g.arc(px - 2, py - 2, 0.9, 0, U.TAU); g.fill();
    }
    // 花瓣飘落点缀
    g.fillStyle = 'rgba(255,190,210,0.9)';
    for (let i = 0; i < 3; i++) {
      const fy = ((Date.now() / 1000 * 18 + i * 37) % 60);
      g.beginPath(); g.ellipse(-14 + i * 13, -46 + fy, 2, 1.2, 0.6, 0, U.TAU); g.fill();
    }
    g.restore();
  }

  function palaceFacade(g, x, gy) {
    g.save();
    g.translate(x, gy);
    // 地面投影
    g.fillStyle = 'rgba(18,14,28,0.32)';
    g.beginPath(); g.ellipse(0, 2, 210, 20, 0, 0, U.TAU); g.fill();

    // 殿身（红墙渐变）
    g.fillStyle = vGrad(g, -180, 0, [[0, '#b0564c'], [0.12, '#9a463c'], [1, '#6e302a']]);
    g.beginPath(); g.rect(-150, -180, 300, 180); g.fill();
    outline(g, '#8a3a32', 2.6);
    rectO(g, -150, -180, 300, 12, '#ba5a50', 2);
    g.fillStyle = 'rgba(255,255,255,0.24)';
    g.fillRect(-150, -180, 300, 4);
    // 侧收分
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(-144, -168, 7, 154);
    g.fillRect(137, -168, 7, 154);

    // 金柱（圆柱渐变）
    for (let i = 0; i < 6; i++) {
      const cx = -140 + i * 52;
      const cg = g.createLinearGradient(cx - 6.5, 0, cx + 6.5, 0);
      cg.addColorStop(0, '#9a6218'); cg.addColorStop(0.35, '#e0a850');
      cg.addColorStop(0.7, '#c88f38'); cg.addColorStop(1, '#7a5218');
      g.fillStyle = cg;
      g.fillRect(cx - 6.5, -176, 13, 158);
      outline(g, '#7a5218', 1.2);
      rectO(g, cx - 10, -180, 20, 6, '#f0c878', 1);
      rectO(g, cx - 10, -18, 20, 6, '#f0c878', 1);
    }
    // 台阶（渐变 + 描边）
    for (let i = 0; i < 3; i++) {
      const sw = 320 - i * 20, sx = -sw / 2, sy = -12 - i * 12;
      g.fillStyle = vGrad(g, sy, sy + 12, [[0, '#d8c4ec'], [1, '#9a80b8']]);
      g.beginPath(); g.rect(sx, sy, sw, 12); g.fill();
      outline(g, '#8a70a8', 1.6);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(sx + 4, sy + 1, sw - 8, 2.5);
    }
    // 匾额
    rectO(g, -52, -160, 104, 26, '#1c1220', 1.8);
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.5;
    g.strokeRect(-49.5, -157.5, 99, 21);
    Z.Spr.text(g, '凌霄宝殿', 0, -147, { size: 16, color: '#ffd75e', bold: true });

    // 大屋顶（金色琉璃瓦 + 檐下阴影）
    g.fillStyle = 'rgba(40,16,10,0.25)';
    g.fillRect(-150, -180, 300, 10);
    g.fillStyle = vGrad(g, -212, -178, [[0, '#f8d268'], [0.5, '#e8b23c'], [1, '#b87f1e']]);
    g.beginPath();
    g.moveTo(-170, -178);
    g.quadraticCurveTo(-158, -210, -136, -214);
    g.lineTo(136, -214);
    g.quadraticCurveTo(158, -210, 170, -178);
    g.lineTo(148, -178);
    g.quadraticCurveTo(138, -194, -138, -194);
    g.quadraticCurveTo(-148, -178, -170, -178);
    g.closePath(); g.fill();
    outline(g, '#b87f1e', 2.6);
    // 瓦楞
    g.strokeStyle = 'rgba(150,90,20,0.45)'; g.lineWidth = 1.4;
    for (const wy of [-200, -190]) {
      g.beginPath(); g.moveTo(-128, wy); g.quadraticCurveTo(0, wy - 9, 128, wy); g.stroke();
    }
    // 筒瓦
    g.strokeStyle = 'rgba(150,90,20,0.5)';
    for (let i = -9; i <= 9; i++) {
      const vx = i * 14.5;
      g.beginPath(); g.moveTo(vx, -196); g.quadraticCurveTo(vx + 2.4, -204, vx, -212); g.stroke();
    }
    // 屋脊
    g.fillStyle = '#ffdf80';
    g.beginPath();
    g.moveTo(-138, -212); g.quadraticCurveTo(0, -222, 138, -212);
    g.lineTo(138, -207); g.quadraticCurveTo(0, -216, -138, -207);
    g.closePath(); g.fill();
    outline(g, '#d9a926', 1.4);
    // 正脊宝珠 + 两侧吻兽
    circleO(g, 0, -221, 5.5, '#f5c542', 1.5);
    g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(-1.6, -223, 2, 0, U.TAU); g.fill();
    for (const s of [-1, 1]) {
      circleO(g, s * 136, -215, 4, '#f5c542', 1.2);
    }
    // 飞檐
    for (const s of [-1, 1]) {
      g.fillStyle = '#e8b23c';
      g.beginPath();
      g.moveTo(s * 166, -179);
      g.quadraticCurveTo(s * 184, -185, s * 192, -200);
      g.quadraticCurveTo(s * 182, -200, s * 175, -191);
      g.closePath(); g.fill();
      outline(g, '#b87f1e', 2);
      circleO(g, s * 191, -202, 3.2, '#f5c542', 1);
    }
    g.restore();
  }

  function pillarRow(g, x0, n, gy, gap) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      // 投影
      g.fillStyle = 'rgba(18,14,28,0.22)';
      g.beginPath(); g.ellipse(x, 0, 16, 5, 0, 0, U.TAU); g.fill();
      // 柱身（圆柱渐变）
      const cg = g.createLinearGradient(x - 7, 0, x + 7, 0);
      cg.addColorStop(0, 'rgba(140,120,180,0.75)');
      cg.addColorStop(0.35, 'rgba(215,198,244,0.85)');
      cg.addColorStop(0.7, 'rgba(180,160,220,0.75)');
      cg.addColorStop(1, 'rgba(110,95,150,0.7)');
      g.fillStyle = cg;
      g.fillRect(x - 7, gy - 130, 14, 130);
      g.strokeStyle = 'rgba(90,75,125,0.6)'; g.lineWidth = 1.4;
      g.strokeRect(x - 7, gy - 130, 14, 130);
      // 柱头 / 柱础
      g.fillStyle = 'rgba(225,208,250,0.85)';
      g.fillRect(x - 10, gy - 136, 20, 8);
      g.strokeRect(x - 10, gy - 136, 20, 8);
      g.fillStyle = 'rgba(200,182,236,0.8)';
      g.fillRect(x - 10, gy - 8, 20, 8);
      g.strokeRect(x - 10, gy - 8, 20, 8);
      // 缠柱光带
      g.strokeStyle = 'rgba(255,244,214,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - 3, gy - 124); g.lineTo(x - 3, gy - 12); g.stroke();
    }
  }

  /* ---- 东海：珊瑚 / 海草 / 气泡 / 光柱 / 水晶宫 ---- */
  function coralCluster(g, x, gy, s) {
    g.save();
    g.translate(x, gy);
    g.scale(s, s);
    const fan = (cx, h, w, c1, c2) => {
      g.strokeStyle = c1; g.lineWidth = w; g.lineCap = 'round';
      for (const a of [-0.5, -0.15, 0.2, 0.5]) {
        g.beginPath(); g.moveTo(cx, 0);
        g.quadraticCurveTo(cx + Math.sin(a) * h * 0.5, -h * 0.6, cx + Math.sin(a) * h, -h);
        g.stroke();
      }
      g.fillStyle = c2;
      for (const a of [-0.5, -0.15, 0.2, 0.5]) {
        g.beginPath(); g.arc(cx + Math.sin(a) * h, -h, w * 0.55, 0, U.TAU); g.fill();
      }
    };
    fan(-16, 34, 5, '#e07a8a', '#f2a0ae');
    fan(2, 46, 6, '#e8955a', '#f2b98a');
    fan(18, 28, 5, '#9a6ad8', '#b88ae8');
    g.restore();
  }

  function seaweed(g, x, gy, s, t) {
    g.save();
    g.translate(x, gy);
    g.scale(s, s);
    g.strokeStyle = 'rgba(40,120,90,0.85)';
    g.lineWidth = 5; g.lineCap = 'round';
    for (const [ox, h, ph] of [[-6, 52, 0], [4, 70, 2], [12, 44, 4]]) {
      const sway = Math.sin(t * 1.4 + ph) * 8;
      g.beginPath();
      g.moveTo(ox, 0);
      g.quadraticCurveTo(ox + sway, -h * 0.55, ox + sway * 1.6, -h);
      g.stroke();
    }
    g.restore();
  }

  function crystalPalace(g, x, gy) {
    g.save();
    g.translate(x, gy);
    // 投影
    g.fillStyle = 'rgba(4,10,24,0.4)';
    g.beginPath(); g.ellipse(0, 2, 220, 20, 0, 0, U.TAU); g.fill();

    // 主体（深海蓝渐变）
    g.fillStyle = vGrad(g, -170, 0, [[0, '#2a649e'], [0.14, '#21527f'], [1, '#123354']]);
    g.beginPath(); g.rect(-160, -170, 320, 170); g.fill();
    outline(g, '#0e2a48', 2.6);
    rectO(g, -160, -170, 320, 12, '#3a7ab8', 2);
    g.fillStyle = 'rgba(220,245,255,0.3)';
    g.fillRect(-160, -170, 320, 4);

    // 水晶尖塔（渐变 + 高光棱面）
    for (const [sx, sw, sh] of [[-120, 44, 130], [-30, 56, 170], [70, 44, 120], [140, 30, 90]]) {
      const top = -168 - sh;
      g.fillStyle = vGrad(g, top, -168, [[0, 'rgba(235,250,255,0.95)'], [0.5, 'rgba(150,215,255,0.9)'], [1, 'rgba(90,160,230,0.9)']]);
      g.beginPath();
      g.moveTo(sx - sw / 2, -168);
      g.lineTo(sx, top);
      g.lineTo(sx + sw / 2, -168);
      g.closePath(); g.fill();
      outline(g, '#2a5a92', 2);
      // 左侧高光棱面
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.moveTo(sx - sw * 0.3, -168);
      g.lineTo(sx - sw * 0.06, top + sh * 0.14);
      g.lineTo(sx + 2, -168);
      g.closePath(); g.fill();
      // 塔尖宝珠
      g.fillStyle = '#dff4ff';
      g.beginPath(); g.arc(sx, top - 4, 3, 0, U.TAU); g.fill();
    }
    // 匾额
    rectO(g, -52, -130, 104, 28, 'rgba(8,20,44,0.92)', 1.8);
    g.strokeStyle = 'rgba(170,225,255,0.8)'; g.lineWidth = 1.4;
    g.strokeRect(-49.5, -127.5, 99, 23);
    Z.Spr.text(g, '水 晶 宫', 0, -116, { size: 17, color: '#aee6ff', bold: true });
    // 大门 + 微光
    g.fillStyle = 'rgba(10,26,52,0.95)';
    g.beginPath();
    g.moveTo(-36, 0); g.lineTo(-36, -66); g.arc(0, -66, 36, Math.PI, 0); g.lineTo(36, 0);
    g.closePath(); g.fill();
    outline(g, '#0e2a48', 2);
    const dg = g.createRadialGradient(0, -30, 3, 0, -30, 42);
    dg.addColorStop(0, 'rgba(150,220,255,0.4)');
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dg;
    g.beginPath(); g.moveTo(-31, 0); g.lineTo(-31, -63); g.arc(0, -63, 31, Math.PI, 0); g.lineTo(31, 0); g.closePath(); g.fill();
    // 台阶
    for (let i = 0; i < 3; i++) {
      const sw = 340 - i * 20, sx = -sw / 2, sy = -10 - i * 10;
      g.fillStyle = vGrad(g, sy, sy + 10, [[0, 'rgba(190,235,255,0.75)'], [1, 'rgba(100,170,230,0.6)']]);
      g.beginPath(); g.rect(sx, sy, sw, 10); g.fill();
      outline(g, '#2a5a92', 1.4);
    }
    g.restore();
  }

  function drawBubbles(g, camX, t) {
    g.save();
    g.fillStyle = 'rgba(190,235,255,0.28)';
    for (let i = 0; i < 12; i++) {
      const sp = 26 + (i % 4) * 14;
      const bx = ((i * 173 + 40 - camX * 0.6) % 1000 + 1000) % 1000 - 20 + Math.sin(t * 1.8 + i) * 14;
      const by = 560 - ((t * sp + i * 137) % 600);
      const r = 3 + (i % 3) * 2.4;
      g.beginPath(); g.arc(bx, by, r, 0, U.TAU); g.fill();
    }
    g.restore();
  }

  // 火山余烬（上升的火星）
  function drawEmbers(g, camX, t) {
    g.save();
    for (let i = 0; i < 16; i++) {
      const sp = 40 + (i % 5) * 18;
      const bx = ((i * 211 + 60 - camX * 0.7) % 1100 + 1100) % 1100 - 40 + Math.sin(t * 2.2 + i * 1.3) * 18;
      const by = 560 - ((t * sp + i * 173) % 620);
      const r = 1.6 + (i % 3) * 1.2;
      g.globalAlpha = 0.35 + 0.4 * Math.sin(t * 5 + i * 2.1);
      g.fillStyle = i % 3 === 0 ? '#ffd75e' : '#ff8830';
      g.beginPath(); g.arc(bx, by, r, 0, U.TAU); g.fill();
    }
    g.restore();
  }

  // 焦树 + 岩浆池
  function charredTree(g, x, gy, s, t) {
    g.save();
    g.translate(x, gy);
    g.scale(s, s);
    g.fillStyle = '#1a1210';
    g.beginPath();
    g.moveTo(-6, 0); g.quadraticCurveTo(-3, -34, -9, -52);
    g.lineTo(-2, -54); g.quadraticCurveTo(3, -32, 6, 0);
    g.closePath(); g.fill();
    g.strokeStyle = '#1a1210'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, -38); g.quadraticCurveTo(-14, -46, -18, -56); g.stroke();
    g.beginPath(); g.moveTo(2, -44); g.quadraticCurveTo(10, -54, 12, -64); g.stroke();
    // 枝头残火
    for (const [fx, fy] of [[-18, -60], [12, -68], [-2, -58]]) {
      const fl = Math.sin(t * 9 + fx) * 1.5;
      g.fillStyle = 'rgba(255,140,50,0.9)';
      g.beginPath();
      g.moveTo(fx - 3, fy);
      g.quadraticCurveTo(fx + fl, fy - 9, fx + fl * 0.5, fy - 12);
      g.quadraticCurveTo(fx + 3 + fl, fy - 8, fx + 3, fy);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,220,120,0.9)';
      g.beginPath();
      g.moveTo(fx - 1.4, fy);
      g.quadraticCurveTo(fx + fl * 0.6, fy - 5, fx + 1.4, fy);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  function lavaPool(g, x, gy, w, t) {
    g.save();
    g.translate(x, gy);
    const glow = 0.55 + 0.25 * Math.sin(t * 3);
    g.globalAlpha = glow;
    g.fillStyle = '#ff6a1a';
    g.beginPath(); g.ellipse(0, 0, w / 2, 7, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffc84a';
    g.beginPath(); g.ellipse(-w * 0.12, -1, w * 0.22, 3, 0, Math.PI, 0); g.closePath(); g.fill();
    g.globalAlpha = glow * 0.35;
    g.fillStyle = '#ff8830';
    g.beginPath(); g.ellipse(0, -2, w * 0.62, 12, 0, Math.PI, 0); g.closePath(); g.fill();
    g.restore();
  }

  function drawRays(g) {
    g.save();
    g.globalAlpha = 0.07;
    g.fillStyle = '#dff4ff';
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 260;
      g.beginPath();
      g.moveTo(x, -10); g.lineTo(x + 90, -10);
      g.lineTo(x + 220, 550); g.lineTo(x + 60, 550);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  /* ---- 主入口 ---- */
  function draw(g, theme, camX, w, gy, t, platforms, stageIdx) {
    if (theme === 'gate' && artReady()) { drawNantian(g, camX, w, gy, t, platforms); return; }
    if (theme === 'peach' && peachArtReady()) { drawPeachGarden(g, camX, w, gy, t, platforms); return; }
    const idx = chapterScenes[stageIdx] ? stageIdx : defaultStage[theme];
    if (sceneArtReady(idx)) { drawChapter(g, chapterScenes[idx], idx, camX, w, gy, t, platforms); return; }
    const th = THEMES[theme] || THEMES.gate;
    if (!cache[theme]) { cache[theme] = { clouds: makeClouds(theme, w), hills: makeHills(theme, w) }; }
    const { clouds, hills } = cache[theme];

    // 天空（顶部渐深 + 多层大气）
    g.fillStyle = vGrad(g, 0, 540, [
      [0, shade(th.sky[0], 0.72)],
      [0.32, th.sky[0]],
      [0.62, th.sky[1]],
      [1, th.sky[2]],
    ]);
    g.fillRect(0, 0, 960, 540);

    // 星点（天宫/深海/水晶主题：高空淡星）
    if (theme === 'gate' || theme === 'palace' || theme === 'throne' || theme === 'sea' || theme === 'crystal') {
      const rnd = seeded(theme.length * 91 + 5);
      g.save();
      for (let i = 0; i < 22; i++) {
        const sx = rnd() * 960, sy = rnd() * 260;
        const tw = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
        g.globalAlpha = tw;
        g.fillStyle = '#e8f0ff';
        g.fillRect(sx, sy, 1.6, 1.6);
      }
      g.restore();
    }

    // 太阳/月亮（径向光晕）
    g.save();
    const sunC = theme === 'peach' ? ['#fff8d8', '#ffe9a0'] : ['#fff2c0', '#ffdf8a'];
    const sg = g.createRadialGradient(760, 110, 6, 760, 110, 92);
    sg.addColorStop(0, sunC[0]);
    sg.addColorStop(0.4, sunC[1]);
    sg.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = sg;
    g.beginPath(); g.arc(760, 110, 92, 0, U.TAU); g.fill();
    g.fillStyle = '#fffdf4';
    g.beginPath(); g.arc(760, 110, 21, 0, U.TAU); g.fill();
    g.restore();

    // 远山两层（后浅前深，视差分层）
    g.save();
    for (const [par, colMul, yy] of [[0.2, 1, 0], [0.42, 0.8, 16]]) {
      g.fillStyle = th.hill;
      g.globalAlpha = colMul;
      for (const h of hills) {
        const hx = h.x - camX * par - 60 * par;
        if (hx < -h.w || hx > 960 + h.w) continue;
        const by = h.y + 160 + yy;
        g.beginPath();
        g.moveTo(hx - h.w / 2, by);
        g.quadraticCurveTo(hx, h.y - h.h + yy, hx + h.w / 2, by);
        g.closePath(); g.fill();
      }
    }
    g.restore();
    g.globalAlpha = 1;

    // 中景云（视差）
    for (const c of clouds) {
      if (c.layer > 0.3) continue;
      const cx = (c.x + t * c.drift - camX * c.layer) % (w + 800) - 200;
      cloud(g, cx, c.y, c.s * 0.8, th.cloud);
    }

    // ---- 地标（世界坐标） ----
    g.save();
    g.translate(-camX, 0);
    if (theme === 'gate') {
      pillarRow(g, 500, 4, gy, 420);
      gateBuilding(g, w - 350, gy);
    } else if (theme === 'peach') {
      peachTree(g, 260, gy, 1.25);
      peachTree(g, 820, gy, 1.0);
      peachTree(g, 1450, gy, 1.3);
      peachTree(g, 2100, gy, 1.05);
      peachTree(g, w - 240, gy, 1.25);
    } else if (theme === 'palace') {
      pillarRow(g, 400, 6, gy, 380);
      palaceFacade(g, w - 380, gy);
    } else if (theme === 'throne') {
      pillarRow(g, 350, 7, gy, 360);
      palaceFacade(g, w - 380, gy);
    } else if (theme === 'sea') {
      for (const cx of [300, 900, 1600, 2300]) { coralCluster(g, cx, gy, 1.2); seaweed(g, cx + 60, gy, 1.3, t); seaweed(g, cx - 80, gy, 1.0, t + 3); }
      // 龙宫石门
      g.save();
      g.translate(w - 400, gy);
      g.fillStyle = 'rgba(4,10,24,0.4)';
      g.beginPath(); g.ellipse(0, 2, 160, 18, 0, 0, U.TAU); g.fill();
      g.fillStyle = vGrad(g, -180, 0, [[0, '#3a7aa2'], [0.14, '#2f6a90'], [1, '#1c4666']]);
      g.beginPath(); g.rect(-120, -180, 240, 180); g.fill();
      outline(g, '#143852', 2.6);
      rectO(g, -120, -180, 240, 14, '#3f86b0', 2);
      g.fillStyle = 'rgba(220,245,255,0.3)';
      g.fillRect(-120, -180, 240, 4);
      // 门洞 + 微光
      g.fillStyle = 'rgba(8,30,50,0.95)';
      g.beginPath();
      g.moveTo(-40, 0); g.lineTo(-40, -70); g.arc(0, -70, 40, Math.PI, 0); g.lineTo(40, 0);
      g.closePath(); g.fill();
      outline(g, '#0e2438', 2);
      const dg1 = g.createRadialGradient(0, -34, 3, 0, -34, 46);
      dg1.addColorStop(0, 'rgba(140,220,255,0.42)');
      dg1.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dg1;
      g.beginPath(); g.moveTo(-35, 0); g.lineTo(-35, -67); g.arc(0, -67, 35, Math.PI, 0); g.lineTo(35, 0); g.closePath(); g.fill();
      // 珍珠灯（带高光）
      for (let i = 0; i < 4; i++) {
        const px = -95 + i * 24;
        circleO(g, px, -150, 5, 'rgba(140,220,255,0.85)', 1.2);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 1.6, -152, 1.8, 0, U.TAU); g.fill();
      }
      Z.Spr.text(g, '龙 宫', 0, -146, { size: 20, color: '#aee6ff', bold: true });
      g.restore();
      coralCluster(g, w - 620, gy, 1.4);
    } else if (theme === 'crystal') {
      for (const cx of [500, 1200, 1900]) { seaweed(g, cx, gy, 1.4, t); coralCluster(g, cx + 90, gy, 1.1); }
      crystalPalace(g, w - 420, gy);
    } else if (theme === 'fire') {
      for (const cx of [350, 1000, 1700, 2350]) { charredTree(g, cx, gy, 1.3, t); charredTree(g, cx + 90, gy, 0.9, t + 2); }
      lavaPool(g, 700, gy, 200, t);
      lavaPool(g, 1900, gy, 260, t);
      lavaPool(g, w - 560, gy, 220, t);
      // 火焰山石门
      g.save();
      g.translate(w - 400, gy);
      g.fillStyle = 'rgba(10,4,2,0.45)';
      g.beginPath(); g.ellipse(0, 2, 160, 18, 0, 0, U.TAU); g.fill();
      g.fillStyle = vGrad(g, -180, 0, [[0, '#54291c'], [0.14, '#46221a'], [1, '#2a130e']]);
      g.beginPath(); g.rect(-120, -180, 240, 180); g.fill();
      outline(g, '#1c0c08', 2.6);
      rectO(g, -120, -180, 240, 14, '#5c2f20', 2);
      g.fillStyle = 'rgba(255,150,80,0.18)';
      g.fillRect(-120, -180, 240, 4);
      // 岩石裂纹
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.4;
      for (const [cx2, cy2, ex2, ey2] of [[-80, -160, -66, -110], [70, -150, 84, -96], [-30, -40, -18, -8], [44, -60, 58, -20]]) {
        g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(ex2, ey2); g.stroke();
      }
      // 门洞 + 内部火光
      g.fillStyle = 'rgba(12,6,4,0.95)';
      g.beginPath();
      g.moveTo(-40, 0); g.lineTo(-40, -70); g.arc(0, -70, 40, Math.PI, 0); g.lineTo(40, 0);
      g.closePath(); g.fill();
      outline(g, '#1c0c08', 2);
      const dg2 = g.createRadialGradient(0, -30, 3, 0, -30, 46);
      dg2.addColorStop(0, 'rgba(255,130,50,0.4)');
      dg2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dg2;
      g.beginPath(); g.moveTo(-35, 0); g.lineTo(-35, -67); g.arc(0, -67, 35, Math.PI, 0); g.lineTo(35, 0); g.closePath(); g.fill();
      // 火焰灯（分列两侧，避开匾额文字；跳动 + 内焰高光）
      for (let i = 0; i < 4; i++) {
        const fx = i < 2 ? -96 + i * 24 : 52 + (i - 2) * 24;
        const fl = Math.sin(t * 8 + i * 1.7) * 2;
        g.fillStyle = '#ff8830';
        g.beginPath();
        g.moveTo(fx - 4, -142);
        g.quadraticCurveTo(fx + fl, -156, fx + fl, -162);
        g.quadraticCurveTo(fx + 4 + fl, -154, fx + 4, -142);
        g.closePath(); g.fill();
        g.fillStyle = '#ffd75e';
        g.beginPath();
        g.moveTo(fx - 1.8, -142);
        g.quadraticCurveTo(fx + fl * 0.6, -150, fx + fl * 0.5, -154);
        g.quadraticCurveTo(fx + 1.8 + fl * 0.6, -149, fx + 1.8, -142);
        g.closePath(); g.fill();
      }
      Z.Spr.text(g, '火 焰 山', 0, -146, { size: 20, color: '#ffb066', bold: true });
      g.restore();
    }
    g.restore();

    if (th.bubbles) drawBubbles(g, camX, t);
    if (th.embers) drawEmbers(g, camX, t);
    if (th.rays) drawRays(g);

    // 近景云（视差大，盖在建筑前面一点）
    for (const c of clouds) {
      if (c.layer <= 0.3) continue;
      const cx = (c.x + t * c.drift - camX * c.layer) % (w + 800) - 200;
      cloud(g, cx, c.y, c.s, th.cloud);
    }

    // ---- 地面（渐变 + 顶边过渡 + 纹理） ----
    g.fillStyle = vGrad(g, gy, 540, [[0, th.groundTop], [0.14, th.ground], [1, shade(th.ground, 0.76)]]);
    g.fillRect(0, gy, 960, 540 - gy);
    g.fillStyle = th.groundTop;
    g.fillRect(0, gy, 960, 9);
    g.fillStyle = th.groundLine;
    g.fillRect(0, gy + 9, 960, 3);
    // 地表纹理（草簇 / 碎石 / 斜纹）
    g.save();
    g.globalAlpha = 0.30;
    const off = -(camX % 96);
    for (let x = off; x < 960; x += 96) {
      g.fillStyle = th.groundLine;
      g.fillRect(x, gy + 32, 30, 3);
      g.fillRect(x + 12, gy + 26, 16, 2.5);
      g.fillRect(x + 44, gy + 58, 38, 3);
      g.fillStyle = shade(th.ground, 0.68);
      g.fillRect(x + 60, gy + 42, 14, 3);
      g.fillRect(x + 6, gy + 70, 20, 3);
      g.fillRect(x + 30, gy + 86, 26, 3);
    }
    g.restore();

    // ---- 云台/石台平台 ----
    if (platforms) {
      for (const p of platforms) {
        const px = p[0] - camX, py = p[1], pw = p[2];
        if (px < -pw - 60 || px > 960 + 60) continue;
        if (th.plat === 'cloud') {
          // 底部投影
          g.fillStyle = 'rgba(60,80,120,0.25)';
          g.beginPath(); g.ellipse(px + pw / 2, py + 10, pw * 0.46, 10, 0, 0, U.TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.96)';
          g.beginPath();
          g.ellipse(px + pw / 2, py, pw / 2, 13, 0, 0, U.TAU);
          g.ellipse(px + pw * 0.25, py - 5, pw * 0.28, 11, 0, 0, U.TAU);
          g.ellipse(px + pw * 0.72, py - 4, pw * 0.3, 12, 0, 0, U.TAU);
          g.fill();
          g.fillStyle = 'rgba(170,190,225,0.55)';
          g.beginPath(); g.ellipse(px + pw / 2, py + 8, pw * 0.4, 6, 0, 0, U.TAU); g.fill();
          // 顶部高光
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.beginPath(); g.ellipse(px + pw * 0.3, py - 7, pw * 0.22, 5, -0.1, 0, U.TAU); g.fill();
        } else if (th.plat === 'coral') {
          g.fillStyle = 'rgba(150,60,85,0.9)';
          g.beginPath();
          g.ellipse(px + pw / 2, py + 5, pw / 2, 13, 0, Math.PI, 0);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(226,120,140,0.92)';
          g.beginPath();
          g.ellipse(px + pw / 2, py + 4, pw / 2, 12, 0, Math.PI, 0);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(245,170,185,0.95)';
          g.beginPath(); g.ellipse(px + pw / 2, py + 2, pw / 2, 9, 0, Math.PI, 0); g.fill();
          g.strokeStyle = 'rgba(140,50,75,0.8)'; g.lineWidth = 1.6;
          g.beginPath(); g.ellipse(px + pw / 2, py + 4, pw / 2, 12, 0, Math.PI, 0); g.stroke();
          g.fillStyle = 'rgba(180,70,95,0.9)';
          for (let i = 0; i < 3; i++) {
            g.beginPath(); g.arc(px + 14 + i * (pw - 28) / 2, py + 6, 5, 0, U.TAU); g.fill();
            g.fillStyle = 'rgba(255,220,230,0.7)'; g.beginPath(); g.arc(px + 12.5 + i * (pw - 28) / 2, py + 4.5, 1.6, 0, U.TAU); g.fill();
            g.fillStyle = 'rgba(180,70,95,0.9)';
          }
        } else if (th.plat === 'basalt') {
          g.fillStyle = '#1c0f0c';
          rr2(g, px, py, pw, 16, 5);
          g.strokeStyle = '#0e0604'; g.lineWidth = 1.8; g.stroke();
          g.fillStyle = '#3a221a';
          rr2(g, px, py, pw, 9, 4);
          g.fillStyle = 'rgba(255,150,80,0.25)';
          g.fillRect(px + 6, py + 1, pw - 12, 2);
          g.strokeStyle = 'rgba(255,110,40,0.55)';
          g.lineWidth = 1.4;
          g.beginPath();
          for (let x2 = px + 8; x2 < px + pw - 8; x2 += 26) {
            g.moveTo(x2, py + 14);
            g.lineTo(x2 + 6, py + 20 + Math.sin(x2 * 0.7 + t * 2) * 2);
          }
          g.stroke();
        } else if (th.plat === 'crystal') {
          g.fillStyle = 'rgba(120,200,255,0.55)';
          rr2(g, px, py, pw, 14, 7);
          g.strokeStyle = 'rgba(60,120,190,0.8)'; g.lineWidth = 1.6; g.stroke();
          g.fillStyle = 'rgba(220,245,255,0.8)';
          g.fillRect(px + 6, py + 2, pw - 12, 4);
          g.fillStyle = 'rgba(60,130,200,0.5)';
          g.beginPath();
          g.moveTo(px + pw * 0.2, py + 14); g.lineTo(px + pw * 0.3, py + 34); g.lineTo(px + pw * 0.4, py + 14);
          g.closePath(); g.fill();
        } else {
          // 大理石（渐变 + 描边 + 高光）
          g.fillStyle = 'rgba(40,30,60,0.35)';
          g.beginPath(); g.ellipse(px + pw / 2, py + 12, pw * 0.5, 8, 0, 0, U.TAU); g.fill();
          g.fillStyle = vGrad(g, py, py + 16, [[0, '#d8c4ec'], [1, '#a084c0']]);
          rr2(g, px, py, pw, 16, 8);
          g.strokeStyle = '#78609a'; g.lineWidth = 1.8; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(px + 6, py + 2, pw - 12, 3);
        }
      }
    }
  }

  function rr2(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath(); g.fill();
  }

  return { draw, cloud, artReady, peachArtReady, sceneArtReady };
})();
