/* ============================================================
 * ui.js —— HUD + 全部菜单（Canvas 即时模式 UI）
 * ============================================================ */
'use strict';

Z.UI = (() => {
  const U = Z.U;
  let hoverAny = false;
  const toasts = [];
  const gradCache = new Map();
  const btnAnim = new Map();   // 按钮悬浮动画状态（key -> {h:0..1}）
  let heroStageArt = null;
  let landmarkAtlas = null, productAtlas = null;
  // 原始 RGBA 图集只做 Canvas 裁框；空白第十二格不使用。
  const landmarkRects = [[10,28,347,329],[376,17,340,337],[729,53,346,300],[1089,12,359,358],
    [37,362,293,362],[366,385,351,328],[733,398,344,314],[1090,370,344,354],
    [16,729,343,345],[374,729,338,334],[729,728,350,334]];
  const productRects = { potion_hp:[150,61,412,528],potion_mp:[829,44,285,561],bighp:[70,673,503,511],stone:[717,673,466,535] };
  const mapArt = {};
  if (typeof Image !== 'undefined') {
    const img = new Image(), base = document.currentScript && document.currentScript.src;
    img.onload = () => { heroStageArt = img; };
    img.src = base ? new URL('../assets/art/ui/hero-stage-v1.png', base).href : 'assets/art/ui/hero-stage-v1.png';
    ['heaven','sea','fire'].forEach((theme, chapter) => {
      const terrain = new Image(), file = 'map-' + theme + '-v1.png';
      terrain.onload = () => { mapArt[chapter] = terrain; };
      terrain.src = base ? new URL('../assets/art/ui/' + file, base).href : 'assets/art/ui/' + file;
    });
    const landmarks = new Image(), products = new Image();
    landmarks.onload = () => { landmarkAtlas = landmarks; };
    products.onload = () => { productAtlas = products; };
    landmarks.src = base ? new URL('../assets/art/ui/v79-map-landmarks.png',base).href : 'assets/art/ui/v79-map-landmarks.png';
    products.src = base ? new URL('../assets/art/ui/v79-shop-products.png',base).href : 'assets/art/ui/v79-shop-products.png';
  }
  // 标题立绘使用大圣礼甲，只供绘制，不生成物品、不修改实际配装。
  const titleGear = Object.fromEntries(['weapon', 'head', 'armor', 'acc'].map(base => [base, { base, q: 4, t: 0, lv: 0, ax: [] }]));
  function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function cachedGrad2(g, key, make) {
    let gr = gradCache.get(key);
    if (!gr) { gr = make(); gradCache.set(key, gr); }
    return gr;
  }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function inRect(m, x, y, w, h) { return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h; }

  // 切角玉牌与角部刻线贯穿战斗、地图和系统窗口；纹样不经过正文。
  function jadeShape(g, x, y, w, h, cut = 7) {
    const c = Math.min(cut, w / 4, h / 4);
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y);
    g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h);
    g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  function jadeTrim(g, x, y, w, h, color = '#ad925c') {
    g.save(); g.strokeStyle = color; g.lineWidth = 1;
    for (const dx of [0, 1]) for (const dy of [0, 1]) {
      const cx = x + 5 + dx * (w - 10), cy = y + 5 + dy * (h - 10), sx = dx ? -1 : 1, sy = dy ? -1 : 1;
      g.beginPath(); g.moveTo(cx, cy + sy * 12); g.lineTo(cx, cy + sy * 4);
      g.lineTo(cx + sx * 4, cy); g.lineTo(cx + sx * 12, cy); g.stroke();
    }
    g.restore();
  }

  // 系统小画标：同一套深色描边、暖金与青玉，不依赖字体符号或图片。
  function drawSystemIcon(g, id, x, y, size, disabled = false) {
    g.save();
    g.translate(x, y); g.scale(size / 24, size / 24);
    if (disabled) g.globalAlpha *= 0.42;
    g.lineWidth = 1.35; g.lineJoin = 'round'; g.lineCap = 'round';
    const ink = '#31443e', gold = '#e8bd58', jade = '#72ae91', cream = '#f7e5b9', red = '#bc5b46';
    const shape = (points, fill, outline = ink) => {
      g.beginPath(); g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
      g.closePath(); g.fillStyle = fill; g.fill();
      g.strokeStyle = outline; g.stroke();
    };
    const oval = (cx, cy, rx, ry, fill, outline = ink) => {
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, U.TAU);
      g.fillStyle = fill; g.fill(); g.strokeStyle = outline; g.stroke();
    };
    const box = (bx, by, bw, bh, radius, fill) => {
      rr(g, bx, by, bw, bh, radius); g.fillStyle = fill; g.fill();
      g.strokeStyle = ink; g.stroke();
    };
    const line = (points, color = ink, width = 1.35) => {
      g.beginPath(); g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
      g.strokeStyle = color; g.lineWidth = width; g.stroke(); g.lineWidth = 1.35;
    };
    if (id === 'bag') {
      line([[-4, -5], [-4, -9], [4, -9], [4, -5]], '#684b30', 2.8);
      box(-9, -5, 18, 16, 4, '#a47244');
      box(-9, -6, 18, 9, 3, '#c7985d');
      line([[-6, 6], [-6, 8], [-3, 8]], '#e8c38b', 1.2);
      line([[6, 5], [6, 8], [3, 8]], '#715432', 1.2);
      box(-2.3, -0.5, 4.6, 5.7, 1, gold);
      line([[-0.8, 1.4], [0.8, 1.4]], cream, 1.2);
    } else if (id === 'pet') {
      oval(-7, -5, 2.8, 3.4, jade); oval(-2.3, -8, 2.5, 3.1, '#99cbb0');
      oval(3, -8, 2.5, 3.1, '#99cbb0'); oval(7.5, -4.7, 2.6, 3.3, jade);
      g.beginPath(); g.moveTo(-7, 6); g.bezierCurveTo(-8, 2, -3, -3, 0, -3);
      g.bezierCurveTo(4, -3, 8, 3, 7, 6); g.bezierCurveTo(6, 11, 3, 8, 0, 8);
      g.bezierCurveTo(-3, 8, -6, 11, -7, 6); g.closePath();
      g.fillStyle = '#6caa8d'; g.fill(); g.strokeStyle = ink; g.stroke();
      line([[-3.5, 1], [-1.5, -0.2]], '#c4e1bf', 1.8);
      shape([[0, 2], [2, 4.5], [0, 7], [-2, 4.5]], gold);
    } else if (id === 'skill' || id === 'map') {
      box(-8, -8, 16, 17, 1.5, cream);
      box(-10, -9, 4, 18, 1.8, '#d7b86e'); box(6, -9, 4, 18, 1.8, '#d7b86e');
      line([[-7, -6], [-7, 6]], '#fff5da', 1.1);
      if (id === 'skill') {
        line([[-3.5, -3.8], [3.4, -3.8]], '#a19c70', 1);
        line([[-3.5, -0.8], [1.2, -0.8]], '#a19c70', 1);
        shape([[0, 1], [4, 4], [0, 7], [-4, 4]], red);
        line([[-1.2, 4], [1.2, 4]], gold, 1.4);
      } else {
        line([[-4, 4], [-1, -3], [2, 1], [4, -4]], '#699d80', 1.7);
        oval(-4, 4, 1.2, 1.2, red); oval(4, -4, 1.2, 1.2, gold);
      }
    } else if (id === 'shop' || id === 'title') {
      box(-8, -2, 16, 12, 1, '#83aa88');
      box(-3, 1, 6, 9, 1, '#355d52');
      shape([[-11, -3], [-8, -5], [-6, -9], [6, -9], [8, -5], [11, -3]], red);
      line([[-8, -4], [8, -4]], gold, 1.4);
      line([[-4, -8], [-5, -5]], '#e9aa76', 1);
      line([[0, -8], [0, -5]], '#e9aa76', 1);
      line([[4, -8], [5, -5]], '#e9aa76', 1);
      box(-9, 8.5, 18, 2, 0.7, '#d9b875');
      if (id === 'shop') {
        box(5.5, -0.5, 5, 5, 0.8, cream);
        line([[7, 1.8], [9, 1.8]], red, 1.2);
      } else {
        oval(0, -8.5, 1.7, 1.7, gold);
        line([[-7, -1], [-7, 7]], gold, 1); line([[7, -1], [7, 7]], gold, 1);
      }
    } else if (id === 'ach') {
      shape([[-7, 2], [-2, 3], [-2, 11], [-5, 8], [-8, 10]], red);
      shape([[2, 3], [7, 2], [8, 10], [5, 8], [2, 11]], red);
      oval(0, -2.7, 8.4, 8.4, gold);
      oval(0, -2.7, 5.9, 5.9, '#f5db86', '#b68838');
      shape([[0, -7], [3.6, -2.7], [0, 1.6], [-3.6, -2.7]], jade);
      line([[-5.7, -7], [-3.4, -8.6]], cream, 1.7);
    } else if (id === 'set') {
      const teeth = [];
      for (let i = 0; i < 40; i++) {
        const a = i * U.TAU / 40 - Math.PI / 2, r = i % 4 === 0 || i % 4 === 3 ? 10.4 : 8.1;
        teeth.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      shape(teeth, gold);
      oval(0, 0, 6.3, 6.3, jade); oval(0, 0, 2.6, 2.6, '#f7e7bd');
      line([[-3.5, -4.4], [-1.6, -5.3]], '#d3e4bc', 1.5);
    } else if (id === 'weapon') {
      line([[-7, 8], [7, -8]], '#896449', 4);
      line([[-9, 10], [-5, 6]], gold, 5); line([[5, -6], [9, -10]], gold, 5);
      line([[-5, 6], [5, -6]], cream, 1);
    } else if (id === 'head') {
      shape([[-9, 7], [-8, -5], [-4, -1], [0, -9], [4, -1], [8, -5], [9, 7]], gold);
      box(-9, 5, 18, 4, 1, jade); oval(0, 2, 2, 2.7, red);
    } else if (id === 'armor') {
      shape([[-5, -9], [5, -9], [10, -4], [6, 0], [6, 9], [-6, 9], [-6, 0], [-10, -4]], jade);
      shape([[-4, -7], [0, -3], [4, -7], [3, 2], [0, 4], [-3, 2]], gold);
      line([[-5, 6], [5, 6]], cream, 1);
    } else if (id === 'acc') {
      line([[-6, -9], [-5, -3], [0, 0], [5, -3], [6, -9]], gold, 2);
      shape([[0, -1], [6, 4], [0, 10], [-6, 4]], jade);
      oval(0, 4, 2, 2.6, cream);
    } else if (id === 'lock' || id === 'unlock') {
      line(id === 'lock' ? [[-5, -2], [-5, -7], [0, -10], [5, -7], [5, -2]] : [[-5, -2], [-5, -7], [0, -10], [5, -7]], cream, 2.5);
      box(-8, -2, 16, 12, 2, gold); oval(0, 2, 1.6, 1.6, ink); line([[0, 3], [0, 6]], ink, 2);
    } else if (id === 'inspect') {
      oval(-2, -2, 6.5, 6.5, '#b8d4ba'); line([[3, 3], [10, 10]], gold, 4);
      line([[-5, -2], [1, -2]], ink, 1.3); line([[-2, -5], [-2, 1]], ink, 1.3);
    } else if (id === 'left' || id === 'right') {
      const direction = id === 'left' ? -1 : 1;
      line([[-7 * direction, 0], [7 * direction, 0]], gold, 2.4);
      line([[2 * direction, -5], [7 * direction, 0], [2 * direction, 5]], cream, 2.4);
    } else if (id === 'order') {
      line([[-8, -6], [3, -6]], gold, 2); line([[-8, 0], [0, 0]], gold, 2); line([[-8, 6], [-3, 6]], gold, 2);
      line([[7, -8], [7, 8], [3, 4]], cream, 1.8); line([[7, 8], [11, 4]], cream, 1.8);
    } else if (id === 'pause') {
      box(-7, -9, 5, 18, 1.8, gold); box(2, -9, 5, 18, 1.8, gold);
      line([[-5, -6], [-5, 4]], cream, 1.2); line([[4, -6], [4, 4]], cream, 1.2);
    } else if (id === 'play') {
      oval(0, 0, 10, 10, jade);
      shape([[-2.8, -5], [5.2, 0], [-2.8, 5]], cream);
    }
    g.restore();
  }

  function button(g, x, y, w, h, label, o = {}) {
    const m = Z.Input.mouse;
    const hov = !o.disabled && inRect(m, x, y, w, h);
    if (hov) hoverAny = true;
    // 悬浮缓动放大 / 按压缩小
    const key = x + ',' + y + ',' + w + ',' + label;
    let st = btnAnim.get(key);
    if (!st) { st = { h: 0 }; btnAnim.set(key, st); }
    st.h += ((hov ? 1 : 0) - st.h) * 0.3;
    const press = hov && m.down;
    const sc = 1 + st.h * 0.012 - (press ? 0.025 : 0);
    g.save();
    if (sc !== 1) {
      g.translate(x + w / 2, y + h / 2);
      g.scale(sc, sc);
      g.translate(-(x + w / 2), -(y + h / 2));
    }
    const goldFace = o.jade && !o.quiet && o.iconLayout !== 'stack';
    const face = g.createLinearGradient(0, y, 0, y + h);
    face.addColorStop(0, o.disabled ? '#344b49' : goldFace ? (hov ? '#eed8a0' : '#d6bc7f') : (hov ? '#3f7066' : '#284c46'));
    face.addColorStop(1, o.disabled ? '#263d39' : goldFace ? '#aa8952' : '#132f2c');
    g.fillStyle = 'rgba(4,20,18,.45)'; jadeShape(g, x, y + 2, w, h, 6); g.fill();
    g.fillStyle = face; jadeShape(g, x, y, w, h, 6); g.fill();
    // v80 按钮斜面：裁剪内做受光顶面与按压式底部阴影，读作可按下的实体
    g.save(); jadeShape(g, x, y, w, h, 6); g.clip();
    const bvl = g.createLinearGradient(0, y, 0, y + Math.min(12, h * 0.4));
    bvl.addColorStop(0, press ? 'rgba(10,25,20,0.18)' : 'rgba(240,255,235,0.22)');
    bvl.addColorStop(1, 'rgba(240,255,235,0)');
    g.fillStyle = bvl; g.fillRect(x, y, w, Math.min(12, h * 0.4));
    g.fillStyle = press ? 'rgba(2,12,10,0.22)' : 'rgba(2,12,10,0.12)';
    g.fillRect(x, y + h - Math.min(7, h * 0.22), w, Math.min(7, h * 0.22));
    g.restore();
    g.strokeStyle = o.disabled ? '#52645b' : hov ? '#e1c68b' : goldFace ? '#cdb27a' : '#6f8068';
    g.lineWidth = 1; jadeShape(g, x, y, w, h, 6); g.stroke();
    g.strokeStyle = goldFace ? 'rgba(255,244,198,.5)' : 'rgba(164,194,158,.23)';
    g.beginPath(); g.moveTo(x + 7, y + 3); g.lineTo(x + w - 7, y + 3); g.stroke();
    if (goldFace && w > 160) jadeTrim(g, x + 3, y + 3, w - 6, h - 6, '#8d7146');
    let labelX = x + w / 2, labelY = y + h / 2 + 1;
    if (o.icon) {
      const iconSize = o.iconSize || 22;
      if (o.iconLayout === 'stack') {
        drawSystemIcon(g, o.icon, labelX, y + 16, iconSize, o.disabled);
        labelY = y + h - 8;
      } else {
        g.font = 'bold ' + (o.size || 17) + 'px "Microsoft YaHei"';
        const textW = g.measureText(label).width, startX = x + (w - iconSize - 8 - textW) / 2;
        drawSystemIcon(g, o.icon, startX + iconSize / 2, y + h / 2, iconSize, o.disabled);
        labelX = startX + iconSize + 8 + textW / 2;
      }
    }
    Z.Spr.text(g, label, labelX, labelY, {
      size: o.size || 17, bold: true,
      color: o.disabled ? '#8d9b8c' : goldFace ? '#302d21' : o.color || '#ecdfbd',
    });
    g.restore();
    if (hov && m.clicked) { Z.Audio.sfx('click'); return true; }
    return false;
  }

  function panel(g, x, y, w, h, o = {}) {
    g.save();
    const face = g.createLinearGradient(x, y, x + w, y + h);
    face.addColorStop(0, '#284b45'); face.addColorStop(1, '#102c29');
    g.fillStyle = 'rgba(3,16,15,.4)'; jadeShape(g, x, y + 5, w, h, 12); g.fill();
    g.fillStyle = o.bg || face; jadeShape(g, x, y, w, h, 12); g.fill();
    // v80 材质立体化：顶部受光斜面 + 底部内阴影 + 双线金边（先画在裁剪内，再描外框）
    g.save(); jadeShape(g, x, y, w, h, 12); g.clip();
    const bevel = g.createLinearGradient(0, y, 0, y + Math.min(26, h * 0.3));
    bevel.addColorStop(0, 'rgba(226,255,238,0.10)');
    bevel.addColorStop(1, 'rgba(226,255,238,0)');
    g.fillStyle = bevel; g.fillRect(x, y, w, Math.min(26, h * 0.3));
    const inner = g.createLinearGradient(0, y + h - Math.min(20, h * 0.25), 0, y + h);
    inner.addColorStop(0, 'rgba(2,12,10,0)');
    inner.addColorStop(1, 'rgba(2,12,10,0.28)');
    g.fillStyle = inner; g.fillRect(x, y + h - Math.min(20, h * 0.25), w, Math.min(20, h * 0.25));
    g.strokeStyle = 'rgba(226,244,214,0.16)'; g.lineWidth = 1;
    jadeShape(g, x + 1.5, y + 1.5, w - 3, h - 3, 10); g.stroke();
    g.restore();
    g.strokeStyle = o.border || '#aa9463'; g.lineWidth = 1.2; jadeShape(g, x, y, w, h, 12); g.stroke();
    jadeTrim(g, x + 4, y + 4, w - 8, h - 8, '#6d826b');
    g.restore();
  }

  function bar(g, x, y, w, h, frac, color, o = {}) {
    g.save();
    if (!o.overlay) {
      g.fillStyle = '#102722'; jadeShape(g, x, y, w, h, 3); g.fill();
      g.strokeStyle = '#73826b'; g.lineWidth = .7; g.stroke();
    }
    const f = U.clamp(frac, 0, 1);
    if (f > 0) {
      g.fillStyle = color;
      jadeShape(g, x + 1.5, y + 1.5, Math.max(2, (w - 3) * f), Math.max(1, h - 3), 2); g.fill();
      const sheen = g.createLinearGradient(0, y, 0, y + h);
      sheen.addColorStop(0, 'rgba(255,245,203,.36)'); sheen.addColorStop(.48, 'rgba(255,245,203,.06)'); sheen.addColorStop(1, 'rgba(4,25,25,.24)');
      g.fillStyle = sheen; g.fill();
      // v80 条顶受光亮线：任何条形读作凸起玉槽中的液面
      g.strokeStyle = 'rgba(255,248,214,0.30)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + 3, y + 2.5); g.lineTo(x + 1.5 + (w - 3) * f, y + 2.5); g.stroke();
    }
    if (o.text) Z.Spr.text(g, o.text, x + w / 2, y + h / 2 + 1, { size: o.size || 11, color: '#fff', stroke: 'rgba(0,0,0,0.55)', strokeW: 2.5, bold: true });
    g.restore();
  }

  function toast(str, color) {
    systemUI.notify(str);
    toasts.push({ str, color: color || '#fff', t: 0 });
    if (toasts.length > 5) toasts.shift();
  }

  function drawToasts(g) {
    let y = 96;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      t.t += 1 / 60;
      if (t.t > 3) { toasts.splice(i, 1); continue; }
      const a = t.t < 0.2 ? t.t / 0.2 : (t.t > 2.4 ? (3 - t.t) / 0.6 : 1);
      const sx = (1 - U.ease(Math.min(1, t.t / 0.3))) * 64;   // 右侧滑入
      g.save();
      g.globalAlpha = a;
      g.font = 'bold 14px "Microsoft YaHei"';
      const w = g.measureText(t.str).width + 30;
      g.fillStyle = 'rgba(16,22,36,0.85)';
      rr(g, 950 - w + sx, y, w, 26, 13); g.fill();
      g.strokeStyle = t.color; g.lineWidth = 1.4;
      rr(g, 950 - w + sx, y, w, 26, 13); g.stroke();
      Z.Spr.text(g, t.str, 950 - w / 2 + sx, y + 13, { size: 14, color: t.color, bold: true });
      g.restore();
      y += 32;
    }
  }

  /* ================= HUD ================= */
  function combatKey(g, key, x, y, color = '#f2dfaa') {
    g.save(); g.fillStyle = '#152a34'; g.strokeStyle = '#b39a60'; g.lineWidth = 1;
    rr(g, x - 9, y - 8, 18, 17, 4); g.fill(); g.stroke();
    Z.Spr.text(g, key, x, y + 1, { size: 12, color, bold: true }); g.restore();
  }

  function drawHUD(g, G) {
    const S = Z.Save.d, p = G.player, lv = G.level;
    hoverAny = false;

    // 全部关卡给状态和补给稳定的衬底，亮色场景和素材回退也保持可读。
    if (lv) {
      g.save();
      const jade = g.createLinearGradient(0, 10, 0, 131);
      jade.addColorStop(0, 'rgba(21,53,46,.96)'); jade.addColorStop(1, 'rgba(12,35,32,.9)');
      g.fillStyle = jade; jadeShape(g, 12, 9, 300, 122, 13); g.fill();
      jadeShape(g, 852, 11, 101, 91, 8); g.fill();
      g.strokeStyle = '#7a8868'; g.lineWidth = 1;
      jadeShape(g, 12, 9, 300, 122, 13); g.stroke();
      jadeShape(g, 852, 11, 101, 91, 8); g.stroke();
      jadeTrim(g, 13, 10, 298, 120, '#ad9363');
      g.strokeStyle = 'rgba(194,176,125,.28)'; g.beginPath(); g.moveTo(24, 101); g.lineTo(300, 101); g.stroke();
      // 裁切原生悟空作身份章：外观跟随真实穿戴，绘制副本不参与战斗状态。
      g.fillStyle = '#b8a274'; g.beginPath(); g.arc(43, 40, 26, 0, U.TAU); g.fill();
      g.fillStyle = '#6d8c78'; g.beginPath(); g.arc(43, 40, 23, 0, U.TAU); g.fill();
      g.save(); g.beginPath(); g.arc(43, 40, 22, 0, U.TAU); g.clip();
      g.translate(43, 77); g.scale(.63, .63);
      Z.Spr.drawWukong(g, { x:0, y:0, facing:1, state:'idle', stateT:0, animClock:G.time,
        onGround:true, groundY:0, hp:1, maxHp:1, cds:{}, invulnT:0 }, S.equip);
      g.restore();
      // v80 徽章立体化：顶部受光弧与底部投影弧
      const badgeHi = g.createLinearGradient(0, 17, 0, 42);
      badgeHi.addColorStop(0, 'rgba(240,255,240,0.30)'); badgeHi.addColorStop(1, 'rgba(240,255,240,0)');
      g.fillStyle = badgeHi; g.beginPath(); g.arc(43, 40, 22, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.strokeStyle = 'rgba(240,222,166,0.5)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(43, 40, 24.5, 0, U.TAU); g.stroke();
      g.restore();
    }

    // 左上：状态
    Z.Spr.text(g, '悟空  Lv.' + S.lv, 78, 26, { size: 16, color: '#f1d9a2', bold: true, align: 'left', font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
    Z.Spr.text(g, '齐天大圣', 288, 26, { size: 10, color: '#a9bca7', align: 'right' });
    // 血条余像：白色残影按逻辑时间流失（120Hz 屏不加速），直观显示刚被打掉多少
    if (p.ghostHp == null || p.hp > p.ghostHp) p.ghostHp = p.hp;
    const ghostDt = p._ghostAt == null ? 0 : Math.max(0, G.time - p._ghostAt);
    p._ghostAt = G.time;
    p.ghostHp = Math.max(p.hp, p.ghostHp - p.maxHp * 0.45 * ghostDt);
    bar(g, 78, 40, 212, 17, p.ghostHp / p.maxHp, '#f0b0a0');
    bar(g, 78, 40, 212, 17, p.hp / p.maxHp, '#bd5143', { text: `${Math.ceil(p.hp)} / ${p.maxHp}`, overlay: true });
    bar(g, 78, 62, 212, 11, p.mp / p.maxMp, '#438d9b', { text: `${Math.floor(p.mp)} / ${p.maxMp}`, size: 9 });
    const wuFull = p.wu >= 100;
    bar(g, 24, 81, 164, 7, p.wu / 100, wuFull ? '#e8d08d' : '#b49555');
    Z.Spr.text(g, wuFull ? '无双就绪！按 L' : '无双', 198, 85, { size: 10, color: wuFull ? '#f3d789' : '#b8c1a5', align: 'left' });
    bar(g, 24, 94, 266, 3, S.exp / Z.BAL.expNeed(S.lv), '#77977e');

    // 资源
    Z.Spr.drawCoin(g, 36, 116, 8);
    Z.Spr.text(g, U.fmt(S.gold), 50, 116, { size: 14, color: '#ffd75e', align: 'left', bold: true });
    Z.Spr.drawStone(g, 128, 116, 8);
    Z.Spr.text(g, String(S.stones), 142, 116, { size: 14, color: '#54e0d8', align: 'left', bold: true });

    // 法宝状态：装备中显示图标与调息/效果剩余；持有未装备给出轻提示
    const relic = p.activeRelic ? p.activeRelic() : null;
    if (relic) {
      Z.Spr.drawRelicIcon(g, relic, 200, 111, 21, { bg: false, noElement: true });
      let status = '[R] 法宝', color = '#e6d5ae';
      if (p.relicEffect) {
        status = (p.relicEffect.type === 'shield' ? '护盾 ' + Math.ceil(p.relicEffect.shield) + '·' : '回春 ') + Math.ceil(p.relicEffect.remaining) + '秒';
        color = p.relicEffect.type === 'shield' ? '#b4ddff' : '#a4e8b0';
      } else if (p.relicCd > 0) { status = '法宝调息 ' + Math.ceil(p.relicCd) + '秒'; color = '#9aa4b8'; }
      else if (p.mp < Z.BAL.relicStats(relic).cost) { status = '[R] 缺法力'; color = '#9ac8ff'; }
      else if (Z.BAL.relicDefs[relic.id].type === 'heal' && p.hp >= p.maxHp) { status = '生命已满'; color = '#9aa4b8'; }
      Z.Spr.text(g, status, 214, 116, { size: 10.5, color, align: 'left', bold: true, stroke: 'rgba(16,34,46,0.9)', strokeW: 3 });
    } else if (S.relics && S.relics.owned && S.relics.owned.length) {
      Z.Spr.text(g, '法宝未装备', 200, 116, { size: 10, color: '#8b96a2', align: 'left', stroke: 'rgba(16,34,46,0.9)', strokeW: 3 });
    }

    // 两种药共用一次饮用间隔；同时显示冷却，避免另一瓶看似仍可使用。
    const potFrac = U.clamp(p.potCd / 1.6, 0, 1);
    for (const [kind, key, py, color] of [['hp', '1', 29, '#ff9b90'], ['mp', '2', 53, '#9ac8ff']]) {
      Z.Spr.drawPotion(g, 868, py, 9, kind);
      if (potFrac > 0) {
        g.save(); g.fillStyle = 'rgba(10,14,22,0.7)';
        g.beginPath(); g.moveTo(868, py);
        g.arc(868, py, 12, -Math.PI / 2, -Math.PI / 2 + U.TAU * potFrac);
        g.closePath(); g.fill(); g.restore();
      }
      Z.Spr.text(g, '[' + key + '] ×' + S.pots[kind], 884, py, { size: 12, color: S.pots[kind] ? color : '#8b96a2', align: 'left' });
    }
    if (potFrac > 0) Z.Spr.text(g, '饮用间隔 ' + p.potCd.toFixed(1) + '秒', 903, 69, { size: 9, color: '#e6d5ae' });
    if (button(g, 876, 77, 70, 20, '暂停', {
      size: 10, r: 5, icon: 'pause', iconSize: 13,
      disabled: G.paused || G.clearInfo || G.dead || Z.Trans.busy,
    })) G.openPanel('pause');

    // 关卡进度点（波次进度 / Boss头骨）
    if (lv && !lv.def.tower) {
      const n = lv.def.waves.length;
      const dw = 14, x0 = 480 - (n * dw) / 2 + dw / 2;
      for (let i = 0; i < n; i++) {
        const done = i < lv.waveIdx + (lv.phase === 'boss' ? 1 : 0);
        // 当前波：金色脉冲圈
        if (i === lv.waveIdx && lv.phase === 'waves') {
          g.beginPath();
          g.arc(x0 + i * dw, 14, 6.5 + Math.sin(G.time * 6) * 1.3, 0, U.TAU);
          g.strokeStyle = 'rgba(255,215,94,0.9)'; g.lineWidth = 1.6; g.stroke();
        }
        g.beginPath();
        g.arc(x0 + i * dw, 14, 4, 0, U.TAU);
        g.fillStyle = done ? '#f5c542' : 'rgba(255,255,255,0.25)';
        g.fill();
      }
      if (lv.phase === 'boss') {
        Z.Spr.text(g, '☠', 480, 14, { size: 13, color: '#ff6a5e' });
      }
    }

    // 镇妖塔层数
    if (lv && lv.def.tower) {
      Z.Spr.text(g, '镇妖塔 · 第 ' + lv.tower.floor + ' 层', 480, 58, {
        size: 18, color: '#ffb02e', bold: true, stroke: 'rgba(40,20,0,0.75)', strokeW: 4,
      });
      if (!lv.tower.ready && lv.tower.plan && !lv.tower.plan.bossId) Z.Spr.text(g,
        lv.tower.plan.name + ' · 剩余 ' + lv.enemies.filter(e => !e.dead).length, 480, 80,
        { size: 12, color: '#f0ddb3', stroke: '#283739', strokeW: 3 });
    }

    // 有地理分区的关卡沿用场景中的目标牌；其余关卡补足当前任务。
    if (lv && !lv.def.tower && !lv.zones && lv.phase === 'waves') {
      const remaining = lv.enemies.filter(e => !e.dead).length;
      const goal = remaining ? '清除守军 · 剩余 ' + remaining : lv.waveIdx + 1 < lv.def.waves.length ? '下一波即将来袭' : '镇守者即将现身';
      g.save(); g.fillStyle = 'rgba(16,34,46,0.78)'; rr(g, 356, 29, 248, 45, 8); g.fill(); g.restore();
      Z.Spr.text(g, lv.def.name, 480, 42, { size: 11, color: '#b7c7c7' });
      Z.Spr.text(g, goal, 480, 61, { size: 13, color: '#f4d28b', bold: true });
    }
    if (lv && lv.phase === 'clear' && !G.clearInfo && !G.dead) {
      const direction = lv.portal && p.x > lv.portal.x ? '←' : '→';
      Z.Spr.text(g, lv.portal ? direction + ' 进入光门，结算本关奖励' : '守将已败 · 光门即将开启', 480, 64,
        { size: 14, color: '#ffe5a0', bold: true, stroke: '#23303c', strokeW: 4 });
    }

    // 初到南天门时分两步提示，随真实波次退去，不写入存档。
    if (lv && lv.idx === 0 && !S.cleared[0] && !lv.linkedComboLearned && lv.phase === 'waves' && lv.waveIdx < 2 && !G.dead && !G.clearInfo) {
      const basics = lv.waveIdx < 1;
      g.save(); g.fillStyle = 'rgba(18,47,40,.92)'; jadeShape(g, 18, 472, 326, 60, 9); g.fill();
      g.strokeStyle = '#72826a'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#a44836'; g.fillRect(24, 481, 2, 12); g.restore();
      Z.Spr.text(g, basics ? '初入南天门 · 基础招式' : '再进一步 · 残影连携', 30, 486, { size: 11, color: '#f2d797', bold: true, align: 'left' });
      Z.Spr.text(g, basics ? 'A / D 移动    J 连按三棍    K 二段跳' : 'O 命中后按 U：七十二斩接重斩', 30, 505, { size: 12, color: '#edf0e7', align: 'left' });
      Z.Spr.text(g, basics ? '按住方向再按 I 闪避    Esc 暂停 / 查看操作' : '按住 A / D 再按 I，选择闪行方向', 30, 521, { size: 11, color: '#b7c7c7', align: 'left' });
    }

    // 底部技能栏
    const icons = [
      { id: 'hy', key: 'U' }, { id: 'jd', key: 'I' }, { id: 'qs', key: 'O' },
    ];
    g.save();
    const dock = g.createLinearGradient(0, 468, 0, 538);
    dock.addColorStop(0, 'rgba(25,55,45,.96)'); dock.addColorStop(1, 'rgba(11,31,29,.94)');
    g.fillStyle = dock; jadeShape(g, 358, 468, 222, 70, 11); g.fill();
    g.strokeStyle = '#8c956e'; g.lineWidth = 1; g.stroke();
    jadeTrim(g, 359, 469, 220, 68, '#b29a65');
    g.restore();
    let ix = 480 - 2 * 52 - 8;
    for (const ic of icons) {
      const cd = p.cds[ic.id], cdMax = p.skillCd(ic.id);
      Z.Spr.drawSkillIcon(g, ic.id, ix, 486, 46, cd > 0 ? cd / cdMax : 0);
      const noMana = p.mp < Z.BAL.skills[ic.id].mp;
      if (cd > 0 || noMana) {
        if (noMana && cd <= 0) Z.Spr.ell(g, ix + 23, 509, 22, 22, 'rgba(10,14,22,0.62)');
        Z.Spr.text(g, cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) + 's' : '缺法力', ix + 23, 508,
          { size: cd > 0 ? 16 : 11, color: cd > 0 ? '#fff0ce' : '#9ac8ff', bold: true, stroke: '#162332', strokeW: 3 });
      }
      Z.Spr.text(g, Z.BAL.skills[ic.id].name, ix + 23, 479, { size: 10, color: '#ffe5a0', bold: true, stroke: '#23303c', strokeW: 3 });
      combatKey(g, ic.key, ix + 40, 524);
      if (!G.paused && !G.clearInfo && !G.dead && !Z.Trans.busy && inRect(Z.Input.mouse, ix, 486, 46, 46)) {
        hoverAny = true;
        tooltip(g, 480, 440, Z.BAL.skills[ic.id].name + '（' + ic.key + '）',
          [Z.BAL.skills[ic.id].desc, '法力 ' + Z.BAL.skills[ic.id].mp + ' · 冷却 ' + cdMax.toFixed(2) + 's', '等级 ' + (S.skills[ic.id] || 1)]);
      }
      ix += 52;
    }
    if (p.skillAction === 'slash' && p.slashConnected && p.mp >= Z.BAL.skills.hy.mp && p.cds.hy <= 0) {
      const cue = p.linkReady ? '接棒就绪' : p.heavyQueued ? '重斩已预约' : '命中 · 按U接重斩';
      Z.Spr.text(g, cue, 480, 451, { size: 12, color: '#ffe5a0', bold: true, stroke: '#23303c', strokeW: 3 });
    }
    // 无双
    const wuReady = p.wu >= 100;
    g.save();
    if (wuReady) {
      g.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 8);
      Z.Spr.ell(g, ix + 23, 509, 27, 27, 'rgba(255,210,74,0.4)');
    }
    g.restore();
    Z.Spr.drawSkillIcon(g, 'wu', ix, 486, 46, 0);
    if (!wuReady) {
      Z.Spr.ell(g, ix + 23, 509, 22, 22, 'rgba(10,14,22,0.55)');
      Z.Spr.text(g, p.state === 'wu' ? '释放中' : Math.floor(p.wu) + '%', ix + 23, 508,
        { size: 12, color: '#ead59b', bold: true, stroke: '#162332', strokeW: 3 });
    }
    Z.Spr.text(g, '无双', ix + 23, 479, { size: 10, color: '#ffe5a0', bold: true, stroke: '#23303c', strokeW: 3 });
    combatKey(g, 'L', ix + 40, 524, wuReady ? '#ffd75e' : '#d3d8da');

    // 系统入口避开中间技能栏；打开窗口后底层按钮不响应。
    drawSystemBar(g, G, 710, 484, 36, 48, 4);

    // 连击（数字弹跳 + 等级配色 + 结尾淡出）
    if (p.comboHits > 1) {
      const n = p.comboHits;
      const pop = Math.max(0, p.comboPop || 0);
      const fade = U.clamp((p.comboT || 0) / 0.5, 0, 1);
      const col = n >= 30 ? '#ff5a4a' : n >= 20 ? '#ff8a30' : n >= 10 ? '#ffe066' : '#ffb02e';
      const sz = (22 + Math.min(10, n)) * (1 + pop * 0.38);
      g.save();
      g.globalAlpha = fade;
      Z.Spr.text(g, n + ' 连击', 900, 150, {
        size: sz, color: col, bold: true, align: 'right',
        stroke: 'rgba(40,20,0,0.8)', strokeW: 4 + pop * 3,
      });
      g.restore();
    }

    // Boss 血条（顶部滑入 + 白色余像 + 分段刻度 + v80 描金名牌与低血边缘脉动）
    if (lv && lv.boss && !lv.boss.dead) {
      const b = lv.boss;
      const dtF = Math.min(0.05, G.time - (lv._bbLt || (lv._bbLt = G.time)));
      lv._bbLt = G.time;
      lv.bossBarT = Math.min(1, (lv.bossBarT || 0) + dtF * 2.4);
      const be = U.ease(lv.bossBarT);
      const byy = 30 - (1 - be) * 76;
      const hpFrac = U.clamp(b.hp / b.maxHp, 0, 1);
      // 低血（<30%）边缘红脉动：整框读作「将破」
      const rage = hpFrac < 0.3 && (b.bid === 'juling' || b.bid === 'niuwang') && lv.combatQualityTrial;
      const pulseA = hpFrac < 0.3 ? 0.5 + 0.5 * Math.sin(G.time * 6) : 0;
      g.save();
      g.globalAlpha = be;
      // 外框底座：玉槽加深 + 双线描金
      g.fillStyle = 'rgba(20,30,24,.96)';
      jadeShape(g, 315, byy - 7, 520, 32, 9); g.fill();
      g.strokeStyle = rage ? 'rgba(230,90,70,' + (0.55 + 0.4 * pulseA) + ')' : '#b3935c';
      g.lineWidth = 1.6; jadeShape(g, 315, byy - 7, 520, 32, 9); g.stroke();
      g.strokeStyle = 'rgba(240,222,166,0.4)'; g.lineWidth = 1;
      jadeShape(g, 317.5, byy - 4.5, 515, 27, 7); g.stroke();
      if (b.ghostHp == null || b.hp > b.ghostHp) b.ghostHp = b.hp;
      const bGhostDt = b._ghostAt == null ? 0 : Math.max(0, G.time - b._ghostAt);
      b._ghostAt = G.time;
      b.ghostHp = Math.max(b.hp, b.ghostHp - b.maxHp * 0.25 * bGhostDt);
      bar(g, 330, byy, 490, 16, b.ghostHp / b.maxHp, '#d8a8a0');
      const trialRage = (b.bid === 'juling' || b.bid === 'niuwang') && lv.combatQualityTrial && b.phase >= 2;
      bar(g, 330, byy, 490, 16, b.hp / b.maxHp, trialRage ? '#d6592e' : '#c03a3a', {
        text: b.name + (trialRage ? ' · 狂暴' : ''), size: 12, overlay: true,
      });
      g.strokeStyle = 'rgba(8,12,20,0.85)';
      g.lineWidth = 2;
      for (let s = 1; s <= 3; s++) {
        const sx = 330 + 490 * s / 4;
        g.beginPath(); g.moveTo(sx, byy + 1); g.lineTo(sx, byy + 15); g.stroke();
      }
      // v80 名牌：左侧菱形描金徽记 + 名（大）与称号（楷体小字），右移血条文字改由 bar 内名承担
      const bd = Z.BAL.bosses[b.bid];
      if (bd && bd.title) {
        g.save();
        g.translate(303, byy + 8); g.rotate(Math.PI / 4);
        g.fillStyle = '#3c2f22'; g.fillRect(-9, -9, 18, 18);
        g.strokeStyle = '#d9b96a'; g.lineWidth = 1.4; g.strokeRect(-9, -9, 18, 18);
        g.restore();
        Z.Spr.text(g, '守', 303, byy + 8, { size: 11, color: '#f0d896', bold: true, font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
        Z.Spr.text(g, bd.title, 486, byy + 36, { size: 10, color: '#cdbd92', font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
      }
      g.restore();
      const recovering = b.recoveryT > 0 || b.pat && b.pat.stage === 'recover';
      if (recovering) Z.Spr.text(g, '收势 · 可反击', 575, byy + 35,
        { size: 12, color: '#a8efd0', bold: true, stroke: '#18333d', strokeW: 3 });
    }

    drawToasts(g);

    // 低血量心悸红晕
    const hpr = p.hp / p.maxHp;
    if (hpr < 0.3 && !p.dead) {
      const pulse = 0.55 + 0.3 * Math.sin(G.time * 7);
      const a = ((0.32 - hpr) / 0.32) * pulse;
      const vg = cachedGrad2(g, 'vignette', () => {
        const gr = g.createRadialGradient(480, 270, 240, 480, 270, 560);
        gr.addColorStop(0, 'rgba(160,10,10,0)');
        gr.addColorStop(1, 'rgba(160,10,10,0.85)');
        return gr;
      });
      g.save();
      g.globalAlpha = a;
      g.fillStyle = vg;
      g.fillRect(0, 0, 960, 540);
      g.restore();
      // 心跳音
      if (!G.paused && !G.clearInfo && !G.dead && !Z.Trans.busy && G.time - (p._lastBeat || 0) > 1.05) {
        p._lastBeat = G.time;
        Z.Audio.sfx('heartbeat');
      }
    }
  }

  /* ---- 悬浮提示 ---- */
  function tooltip(g, cx, bottomY, title, lines, color) {
    g.save();
    g.font = '13px "Microsoft YaHei"';
    let w = g.measureText(title).width;
    for (const l of lines) w = Math.max(w, g.measureText(l).width);
    w += 26;
    const h = 34 + lines.length * 18;
    const x = U.clamp(cx - w / 2, 8, 960 - w - 8);
    const y = bottomY - h - 6;
    g.fillStyle = 'rgba(14,18,30,0.95)';
    rr(g, x, y, w, h, 8); g.fill();
    g.strokeStyle = color || '#f5c542'; g.lineWidth = 1.4;
    rr(g, x, y, w, h, 8); g.stroke();
    Z.Spr.text(g, title, x + w / 2, y + 16, { size: 14, color: color || '#ffd75e', bold: true });
    lines.forEach((l, i) => {
      Z.Spr.text(g, l, x + w / 2, y + 36 + i * 18, { size: 12, color: '#c9d2e2' });
    });
    g.restore();
  }

  /* ================= 标题界面 ================= */
  function drawTitle(g, G) {
    const blocked = G.help || Z.Trans.busy;
    hoverAny = false;
    const et = G.time - (G.sceneT0 || 0);
    if (Z.BG.artReady()) Z.BG.draw(g, 'gate', 1260 + Math.sin(G.time * .07) * 100, 3200, 462, G.time, [], 0);
    else drawSky(g, G.time);
    // 借同一座云阙建立开场，深色留白托住标题与操作，英雄留在暖光侧。
    const veil = g.createLinearGradient(0, 0, 960, 0);
    veil.addColorStop(0, 'rgba(12,28,39,.92)');
    veil.addColorStop(.5, 'rgba(18,40,47,.75)');
    veil.addColorStop(1, 'rgba(20,43,51,.10)');
    g.fillStyle = veil; g.fillRect(0, 0, 960, 540);
    g.fillStyle = 'rgba(12,28,39,.22)'; g.fillRect(0, 486, 960, 54);
    // v80 标题暗角：四角轻微收光，把视线压向标题与悟空（与战斗氛围同一语言）
    const tvg = cachedGrad2(g, 'titleVig', () => {
      const gr = g.createRadialGradient(430, 268, 240, 430, 268, 590);
      gr.addColorStop(0, 'rgba(10,14,18,0)');
      gr.addColorStop(1, 'rgba(10,14,18,0.22)');
      return gr;
    });
    g.fillStyle = tvg; g.fillRect(0, 0, 960, 540);
    // 漂浮光尘
    for (let i = 0; i < 10; i++) {
      const mx = ((i * 173 + G.time * (8 + (i % 3) * 4)) % 1040) - 40;
      const my = 130 + (i % 5) * 64 + Math.sin(G.time * 1.2 + i) * 14;
      g.globalAlpha = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(G.time * 2 + i * 2.1));
      Z.Spr.ell(g, mx, my, 2.2, 2.2, '#ffe8a0');
    }
    g.globalAlpha = 1;
    // 大悟空（呼吸浮空）
    g.save();
    g.translate(728, 450 + Math.sin(G.time * 1.5) * 3);
    g.scale(2.7, 2.7);
    Z.Spr.drawWukong(g, { x: 0, y: 0, facing: -1, state: 'idle', stateT: 0, stateDur: 1, animClock: G.time, invulnT: 0, groundY: 0, hp: 1, maxHp: 1, cds: {} }, titleGear);
    g.restore();
    // 云台
    Z.BG.cloud(g, 728, 477, 1.4 + 0.04 * Math.sin(G.time * 1.5), 'rgba(213,230,215,0.65)');

    // Logo（easeOutBack 落定 + 周期扫光）
    const lt = U.clamp(et / 0.55, 0, 1);
    if (lt > 0) {
      const lb = easeOutBack(lt);
      g.save();
      g.globalAlpha = Math.min(1, lt * 1.6);
      g.translate(320, 158 + (1 - lb) * -46);
      g.scale(0.55 + 0.45 * lb, 0.55 + 0.45 * lb);
      g.font = 'bold 88px KaiTi, STKaiti, "Microsoft YaHei"';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const grad = g.createLinearGradient(0, -38, 0, 42);
      grad.addColorStop(0, '#fff4d3');
      grad.addColorStop(0.5, '#ebd69e');
      grad.addColorStop(1, '#b99a5c');
      g.strokeStyle = 'rgba(15,31,36,0.85)'; g.lineWidth = 4; g.lineJoin = 'round';
      g.strokeText('悟空传', 0, 0);
      g.fillStyle = grad;
      g.fillText('悟空传', 0, 0);
      Z.Spr.text(g, '造 梦 西 游', 0, -68, { size: 17, color: '#d4bc83', bold: true });
      // 扫光（每 4.2 秒一次）
      const sp = G.time % 4.2;
      if (sp > 3.0 && sp < 3.9 && lt >= 1) {
        const k = (sp - 3.0) / 0.9;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.85 * Math.sin(k * Math.PI);
        const sx = -200 + k * 400;
        const gr = g.createLinearGradient(sx - 40, 0, sx + 40, 0);
        gr.addColorStop(0, 'rgba(255,244,200,0)');
        gr.addColorStop(0.5, 'rgba(255,248,214,0.5)');
        gr.addColorStop(1, 'rgba(255,244,200,0)');
        g.fillStyle = gr;
        g.rotate(-0.18);
        g.fillRect(sx - 70, -100, 140, 240);
        g.restore();
      }
      g.restore();
      // v80 朱红印章（Logo 右下）：印面内「大圣」白文篆意，随 Logo 同步入场
      const sealA = U.clamp((et - 0.55) / 0.35, 0, 1);
      if (sealA > 0) {
        g.save();
        g.globalAlpha = Math.min(1, lt * 1.6) * sealA;
        g.translate(462, 196);
        g.rotate(-0.06);
        g.fillStyle = '#a8352a';
        rr(g, -17, -17, 34, 34, 4); g.fill();
        g.strokeStyle = 'rgba(60,12,8,0.55)'; g.lineWidth = 1;
        rr(g, -14.5, -14.5, 29, 29, 2.5); g.stroke();
        g.fillStyle = '#f4e6d2';
        Z.Spr.text(g, '大', 0, -7.5, { size: 13, color: '#f4e6d2', bold: true, font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
        Z.Spr.text(g, '圣', 0, 7.5, { size: 13, color: '#f4e6d2', bold: true, font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
        g.restore();
      }
      // 副标题
      g.save();
      g.globalAlpha = U.clamp((et - 0.35) / 0.4, 0, 1);
      Z.Spr.text(g, '一 棒 破 云  ·  万 里 西 游', 320, 218, { size: 16, color: '#d6d9c6' });
      g.restore();
    }

    const hasSave = G.hasSave();
    const bx = 150, bw = 280;
    // 按钮错峰滑入
    const bIn = (i) => U.clamp((et - 0.25 - i * 0.09) / 0.32, 0, 1);
    const slide = (k) => { g.save(); g.globalAlpha = k; g.translate((1 - U.ease(k)) * -34, 0); };
    let bi = 0;
    let by = 268;
    {
      const k = bIn(bi++);
      if (k > 0) {
        slide(k);
        const act = button(g, bx, by, bw, 52, hasSave ? '继续冒险' : '开始冒险', { jade: true, disabled: blocked });
        g.restore();
        // v75：无进度的新玩家首次点「开始冒险」先看序幕；有进度的续档不打扰。
        if (act) { if (!hasSave) { G.prologue = true; G.prologueT0 = 0; } G.startContinue(); return; }
      }
    }
    by += 64;
    if (hasSave) {
      const k = bIn(bi++);
      if (k > 0) {
        slide(k);
        const act = button(g, bx, by, bw, 52, '新的开始', { size: 15, jade: true, quiet: true, disabled: blocked });
        g.restore();
        if (act) G.confirmNew = !G.confirmNew;
      }
      if (G.confirmNew) {
        panel(g, bx + bw + 16, by - 6, 250, 64, { border: '#e05555' });
        Z.Spr.text(g, '覆盖现有存档？', bx + bw + 141, by + 12, { size: 14, color: '#ffb0a0', bold: true });
        if (button(g, bx + bw + 26, by + 26, 106, 28, '确认重开', { size: 13, r: 6, disabled: blocked })) { G.startNew(true); return; }
        if (button(g, bx + bw + 140, by + 26, 106, 28, '取消', { size: 13, r: 6, disabled: blocked })) { G.confirmNew = false; }
      }
      by += 64;
    }
    {
      const k = bIn(bi++);
      if (k > 0) {
        slide(k);
        const act = button(g, bx, by, bw, 44, '操作说明', { size: 15, jade: true, quiet: true, disabled: blocked });
        g.restore();
        if (act) G.help = true;
      }
    }
    by += 56;
    {
      const k = bIn(bi++);
      if (k > 0) {
        slide(k);
        const act = button(g, bx, by, bw, 44, '音乐：' + (Z.Audio.isMuted() ? '关' : '开'), { size: 14, jade: true, quiet: true, disabled: blocked });
        g.restore();
        if (act) Z.Audio.toggleMute();
      }
    }

    Z.Spr.text(g, G.practice ? '体验模式 · 本页进度，刷新后重新开始' : '三章山海 · 十位镇守者 · 一场大圣的冒险', 480, 496, { size: 12, color: '#d8d7bc' });
    Z.Spr.text(g, '西游题材同人作品 · 本项目原创美术与音乐 · 不含原版素材', 480, 522, { size: 10, color: '#a6b9ae' });
    if (G.help) drawHelp(g, G);
  }

  /* ---------------- 新档序幕（v75）：startNew 后在地图之上一次性播放 ---------------- */
  function drawPrologue(g, G) {
    if (!G.prologueT0) G.prologueT0 = G.time;   // 进地图转场结束后才开始计时
    const et = G.time - G.prologueT0;
    g.fillStyle = 'rgba(6,10,18,0.9)';
    g.fillRect(0, 0, 960, 540);
    // 夜幕星尘
    for (let i = 0; i < 26; i++) {
      const sx = (i * 197 + 41) % 960, sy = 40 + (i * 83 + 29) % 470;
      g.globalAlpha = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(G.time * 1.6 + i * 1.7));
      Z.Spr.ell(g, sx, sy, i % 3 ? 1.4 : 2.2, i % 3 ? 1.4 : 2.2, '#ffe8c8');
    }
    g.globalAlpha = 1;
    // 右侧大圣立绘（呼吸浮空，与标题页同一画法）
    g.save();
    g.translate(736, 448 + Math.sin(G.time * 1.5) * 3);
    g.scale(2.5, 2.5);
    Z.Spr.drawWukong(g, { x: 0, y: 0, facing: -1, state: 'idle', stateT: 0, stateDur: 1, animClock: G.time, invulnT: 0, groundY: 0, hp: 1, maxHp: 1, cds: {} }, titleGear);
    g.restore();
    Z.BG.cloud(g, 736, 475, 1.3 + 0.04 * Math.sin(G.time * 1.5), 'rgba(213,230,215,0.5)');
    // 左侧楔子文：逐行浮现
    Z.Spr.text(g, '序 幕', 300, 92, { size: 30, color: '#ffd75e', bold: true });
    const lines = [
      ['三界承平五百年，妖云自西而起。', '#dce4d8'],
      ['天宫失色，东海翻浪，火焰连天——', '#dce4d8'],
      ['诸神束手，只忆起一个名字。', '#dce4d8'],
      ['齐天大圣，孙悟空。', '#ffd88a'],
      ['一棒破云，万里西游。', '#ffd88a'],
    ];
    lines.forEach((ln, i) => {
      const a = U.clamp((et - 0.5 - i * 0.75) / 0.6, 0, 1);
      if (a <= 0) return;
      Z.Spr.text(g, ln[0], 300, 178 + i * 46, { size: 20, color: ln[1], alpha: a, font: 'KaiTi, STKaiti, "Microsoft YaHei"' });
    });
    Z.Spr.text(g, 'Esc 跳过', 890, 512, { size: 10, color: '#7f8ea0', align: 'right' });
    const bk = U.clamp((et - (0.5 + lines.length * 0.75)) / 0.3, 0, 1);
    if (bk > 0) {
      g.save();
      g.globalAlpha = bk;
      if (button(g, 210, 428, 180, 44, '踏 上 西 行', { jade: true })) {
        G.prologue = false; G.prologueT0 = 0; Z.Audio.sfx('click'); Z.Input.mouse.clicked = false;
      }
      g.restore();
    }
  }

  function drawSky(g, t) {
    // 大气天宫：深夜蓝紫天幕、星、明月光晕、云中天宫剪影、底部流动云海
    const grad = g.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, '#0a0f2e');
    grad.addColorStop(0.55, '#1b2c5c');
    grad.addColorStop(1, '#46609a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 960, 540);
    // 繁星
    for (let i = 0; i < 42; i++) {
      const sx = (i * 167 + 31) % 960, sy = (i * 97 + 17) % 300;
      g.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3));
      Z.Spr.ell(g, sx, sy, 1.2, 1.2, '#e8eeff');
    }
    g.globalAlpha = 1;
    // 明月与光晕
    const mx = 772, my = 112;
    const halo = g.createRadialGradient(mx, my, 34, mx, my, 155);
    halo.addColorStop(0, 'rgba(255,240,200,0.45)');
    halo.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(mx, my, 155, 0, U.TAU); g.fill();
    g.fillStyle = '#ffefc4';
    g.beginPath(); g.arc(mx, my, 44, 0, U.TAU); g.fill();
    g.fillStyle = 'rgba(228,198,140,0.5)';
    g.beginPath(); g.arc(mx - 13, my - 9, 9, 0, U.TAU); g.fill();
    g.beginPath(); g.arc(mx + 14, my + 12, 6, 0, U.TAU); g.fill();
    // 天宫剪影（云上层叠楼阁）
    palace(g, 686, 208, 1.15);
    // 两层流云视差
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 300 + t * 10) % 1400) - 200;
      Z.BG.cloud(g, cx, 96 + (i % 3) * 70, 1 + (i % 2) * 0.5, 'rgba(214,224,248,0.26)');
    }
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 420 + t * 18 + 260) % 1500) - 240;
      Z.BG.cloud(g, cx, 260 + (i % 2) * 60, 0.8 + (i % 2) * 0.4, 'rgba(224,232,250,0.18)');
    }
    cloudSea(g, t);
  }

  // 云上宫殿剪影：三层飞檐、主塔、侧殿与暖窗灯
  function palace(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const body = 'rgba(22,30,62,0.94)';
    const roof = (w, h, ry) => {
      g.beginPath();
      g.moveTo(-w / 2 - 10, ry);
      g.quadraticCurveTo(-w / 2, ry - h * 0.35, -w * 0.28, ry - h * 0.7);
      g.lineTo(w * 0.28, ry - h * 0.7);
      g.quadraticCurveTo(w / 2, ry - h * 0.35, w / 2 + 10, ry);
      g.closePath(); g.fill();
    };
    g.fillStyle = body;
    g.fillRect(-46, -14, 92, 14); roof(104, 22, -14);
    g.fillRect(-32, -36, 64, 12); roof(76, 19, -36);
    g.fillRect(-18, -54, 36, 10); roof(50, 16, -54);
    g.fillRect(-8, -86, 16, 32); roof(34, 14, -86);
    g.fillRect(-72, -8, 20, 8); roof(32, 10, -8);
    g.fillRect(52, -8, 20, 8); roof(32, 10, -8);
    g.fillStyle = 'rgba(255,214,120,0.9)';
    for (const [wx, wy] of [[-30, -7], [0, -7], [30, -7], [-12, -29], [12, -29], [0, -48]]) g.fillRect(wx - 1.5, wy - 2, 3, 4);
    Z.BG.cloud(g, 0, 8, 1.5, 'rgba(216,226,248,0.9)');
    g.restore();
  }

  // 底部流动云海：两层起伏云丘缓慢漂移
  function cloudSea(g, t) {
    for (const [base, r, col, sp] of [[498, 46, 'rgba(146,166,210,0.5)', 8], [522, 40, 'rgba(198,212,240,0.85)', 13]]) {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(0, 540); g.lineTo(0, base);
      const off = (t * sp) % (r * 2);
      for (let x = -r * 2 + off; x < 960 + r * 2; x += r * 2) g.arc(x, base, r, Math.PI, 0);
      g.lineTo(960, 540); g.closePath(); g.fill();
    }
  }

  function drawHelp(g, G) {
    g.fillStyle = 'rgba(6,10,18,0.7)';
    g.fillRect(0, 0, 960, 540);
    panel(g, 90, 42, 780, 460);
    Z.Spr.text(g, '操 作 说 明', 480, 80, { size: 24, color: '#ffd75e', bold: true });
    const lines = [
      ['A / D 或 ← →', '移动'],
      ['K / W / ↑', '跳跃（可二段跳）'],
      ['J', '攻击（连按三连击）'],
      ['U / I / O', '技能：重斩 / 烈焰闪 / 七十二斩'],
      ['O命中后按U', '三棍接重斩；按住A/D再按I选择闪行方向'],
      ['L', '无双·大闹天宫（无双槽满时释放）'],
      ['R', '法宝主动技（护身或回春，需先在背包·法宝页装备）'],
      ['1 / 2 · E / 空格', '喝药；靠近灵泉按 E 或空格恢复（本关一次）'],
      ['Esc', '暂停；窗口打开时关闭当前窗口'],
      ['B / P / C', '背包·强化 / 宠物 / 技能'],
      ['M / N / V', '商店 / 成就 / 设置（地图和战斗均可打开）'],
      ['打死小怪', '掉金币、装备、强化石，走近自动拾取'],
      ['结缘灵兽', '部分Boss首通掉宠物球，拾取后在宠物页出战'],
    ];
    let y = 118;
    for (const [k, v] of lines) {
      Z.Spr.text(g, k, 126, y, { size: 14, color: '#8fd0ff', bold: true, align: 'left' });
      Z.Spr.text(g, v, 330, y, { size: 13, color: '#e8e0d0', align: 'left' });
      y += 27;
    }
    Z.Spr.text(g, 'Esc 关闭说明', 818, 470, { size: 11, color: '#9eabb9', align: 'right' });
    if (button(g, 410, 450, 140, 36, '知道了')) { G.help = false; Z.Input.mouse.clicked = false; }
  }

  /* ================= 选关地图 ================= */
  // Original Canvas atlas: quiet paper terrain; landmarks are drawn after the route.
  function mapTerrain(g, chapter) {
    g.save();
    g.beginPath(); g.rect(38, 128, 632, 320); g.clip();
    if (mapArt[chapter]) {
      const img=mapArt[chapter],scale=Math.max(632/img.width,320/img.height),sw=632/scale,sh=320/scale;
      g.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,38,128,632,320);
      g.fillStyle='rgba(240,229,196,.13)';g.fillRect(38,128,632,320);
      g.restore();return;
    }
    const ink = chapter === 1 ? '#9bb5ae' : chapter === 2 ? '#bd9b7c' : '#afb2a3';
    const wash = chapter === 1 ? '#cddcd2' : chapter === 2 ? '#e1c7a8' : '#dce1ce';
    g.lineWidth = 1.1; g.lineCap = 'round'; g.lineJoin = 'round';
    function blob(x, y, w, h) {
      g.fillStyle = wash; g.globalAlpha = .38;
      g.beginPath(); g.ellipse(x, y, w, h, -.18, 0, Z.U.TAU); g.fill(); g.globalAlpha = 1;
    }
    function cloud(x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = '#f4ecd8'; g.strokeStyle = ink;
      g.beginPath(); g.moveTo(-42, 6); g.bezierCurveTo(-55, -1, -36, -12, -27, -5);
      g.bezierCurveTo(-31, -24, 1, -27, 9, -9); g.bezierCurveTo(18, -19, 37, -12, 32, -3);
      g.bezierCurveTo(53, -7, 55, 10, 39, 11); g.bezierCurveTo(13, 17, -25, 18, -42, 6); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-15, 4); g.bezierCurveTo(-1, -7, 20, 2, 6, 8); g.stroke(); g.restore();
    }
    function ridge(x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = ink; g.fillStyle = wash;
      g.beginPath(); g.moveTo(-42, 20); g.lineTo(-22, -14); g.lineTo(-12, -1); g.lineTo(3, -38);
      g.lineTo(19, -13); g.lineTo(27, -22); g.lineTo(47, 20); g.quadraticCurveTo(0, 29, -42, 20); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(3, -38); g.lineTo(0, -8); g.lineTo(9, 0); g.moveTo(-22, -14); g.lineTo(-15, 14);
      g.moveTo(27, -22); g.lineTo(22, 2); g.stroke(); g.restore();
    }
    function wave(x, y, w) {
      g.strokeStyle = ink; g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x + w * .18, y - 9, x + w * .24, y + 6, x + w * .4, y);
      g.bezierCurveTo(x + w * .57, y - 8, x + w * .73, y + 5, x + w, y); g.stroke();
    }
    if (chapter === 0) {
      blob(338, 272, 280, 118); blob(594, 350, 95, 56);
      g.strokeStyle = '#c2cbb8'; g.lineWidth = 13; g.globalAlpha = .4;
      g.beginPath(); g.moveTo(28, 381); g.bezierCurveTo(157, 380, 90, 183, 290, 194);
      g.bezierCurveTo(432, 203, 447, 393, 684, 366); g.stroke(); g.globalAlpha = 1; g.lineWidth = 1.1;
      ridge(94, 203, .68); ridge(512, 410, .54);
      cloud(168, 182, .58); cloud(373, 161, .62); cloud(552, 260, .54);
      cloud(238, 387, .62); cloud(421, 383, .8); cloud(616, 391, .64);
      wave(69, 426, 116); wave(264, 154, 72);
      g.strokeStyle = '#c8b788'; g.beginPath(); g.arc(612, 164, 15, 0, Z.U.TAU); g.stroke();
      for (let i = 0; i < 3; i++) wave(590 + i * 5, 185 + i * 5, 48 - i * 8);
    } else if (chapter === 1) {
      blob(353, 289, 285, 133); blob(184, 376, 96, 40);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) wave(59 + col * 154 + (row % 2) * 20, 167 + row * 48, 83);
      }
      g.fillStyle = '#d7d0b3'; g.strokeStyle = '#b9bda4';
      for (const [x, y, s] of [[87, 244, 1], [445, 170, .9], [601, 411, .8]]) {
        g.save(); g.translate(x, y); g.scale(s, s);
        g.beginPath(); g.ellipse(0, 0, 24, 8, -.18, 0, Z.U.TAU); g.fill(); g.stroke();
        g.fillStyle = '#b9c5a6'; g.beginPath(); g.moveTo(-14, -2); g.quadraticCurveTo(2, -22, 16, -3); g.fill();
        g.restore();
      }
      // A small junk and curled breakers keep the water recognisable at map scale.
      g.strokeStyle = '#a7b4a3'; g.fillStyle = '#ded3b9';
      g.beginPath(); g.moveTo(457, 396); g.quadraticCurveTo(476, 411, 499, 395); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(479, 394); g.lineTo(479, 369); g.lineTo(460, 391); g.closePath(); g.fill(); g.stroke();
      wave(450, 415, 55); wave(332, 412, 57);
    } else if (chapter === 2) {
      blob(340, 288, 278, 116);
      ridge(106, 188, .8); ridge(275, 380, .84); ridge(472, 176, .88); ridge(612, 398, .65);
      g.strokeStyle = '#cfad88'; g.lineWidth = 5; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(58, 405); g.bezierCurveTo(246, 445, 368, 308, 637, 397); g.stroke();
      g.beginPath(); g.moveTo(61, 242); g.bezierCurveTo(255, 186, 447, 226, 657, 177); g.stroke();
      g.globalAlpha = 1; g.lineWidth = 1.1;
      for (const [x, y] of [[210, 176], [449, 411], [583, 237]]) {
        g.strokeStyle = '#b19d7e'; g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x - 8, y - 7);
        g.lineTo(x + 6, y - 5); g.lineTo(x + 19, y + 2); g.stroke();
        g.moveTo(x - 8, y - 7); g.lineTo(x - 4, y + 3); g.stroke();
      }
      cloud(344, 155, .54); cloud(532, 427, .58);
    } else {
      blob(351, 311, 182, 101); ridge(148, 382, 1.1); ridge(551, 381, 1.18);
      cloud(178, 191, .9); cloud(526, 193, .86); cloud(246, 411, .7); cloud(469, 421, .72);
      g.strokeStyle = '#c2b897'; g.globalAlpha = .45;
      for (const r of [92, 111, 134]) { g.beginPath(); g.ellipse(350, 313, r, r * .42, 0, 0, Z.U.TAU); g.stroke(); }
      g.globalAlpha = 1;
    }
    g.restore();
  }

  function mapLandmark(g, x, y, idx, scale = 1) {
    g.save(); g.translate(x, y); g.scale(scale, scale);
    if (landmarkAtlas && landmarkRects[idx]) {
      const r=landmarkRects[idx],s=Math.min(102/r[2],78/r[3]),w=r[2]*s,h=r[3]*s;
      g.drawImage(landmarkAtlas,...r,-w/2,9-h,w,h);
      g.restore();return;
    }
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.5;
    function poly(points, fill, stroke = '#736b55') {
      g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.stroke(); }
    }
    function ell(px, py, rx, ry, fill, stroke) {
      g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Z.U.TAU); g.fillStyle = fill; g.fill();
      if (stroke) { g.strokeStyle = stroke; g.stroke(); }
    }
    function line(points, color, width = 1.5) {
      g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.strokeStyle = color; g.lineWidth = width; g.stroke(); g.lineWidth = 1.5;
    }
    function roof(w, yy, fill = '#829b8d', edge = '#596f62') {
      g.fillStyle = fill; g.strokeStyle = edge; g.beginPath(); g.moveTo(-w, yy + 7);
      g.quadraticCurveTo(-w + 10, yy + 5, -w + 12, yy); g.lineTo(0, yy - 8); g.lineTo(w - 12, yy);
      g.quadraticCurveTo(w - 10, yy + 5, w, yy + 7); g.quadraticCurveTo(0, yy + 13, -w, yy + 7); g.fill(); g.stroke();
      line([[-w + 6, yy + 7], [0, yy + 9], [w - 6, yy + 7]], '#f1d798', 1);
      line([[0, yy - 8], [0, yy - 12]], edge); ell(0, yy - 12, 2, 2, '#e3b969');
    }
    function base(fill = '#d6dbc1', rim = '#8d9e7b') {
      ell(0, 3, 39, 8, 'rgba(75,66,42,.15)');
      poly([[-32, -5], [-24, 5], [-5, 12], [17, 8], [33, -4], [10, -9]], '#c5c9aa', rim);
      ell(0, -4, 35, 9, fill, rim); line([[-20, 0], [-13, 4], [-9, 3]], '#e9ecd4', 1);
    }
    function cloudBase() {
      base('#dce7d6', '#8aa48f');
      for (const [px, py, r] of [[-26, 1, 11], [-9, 6, 12], [11, 7, 11], [29, 1, 10]]) ell(px, py, r, r * .45, '#eff0da', '#a2b59e');
      line([[-29, 2], [-23, -1], [-17, 1]], '#b4c6b1', 1);
    }
    function hall(w, yy, color) {
      poly([[-w + 8, yy + 3], [w - 8, yy + 3], [w - 8, -5], [-w + 8, -5]], color);
      for (const px of [-w + 12, w - 12]) poly([[px - 2, yy + 5], [px + 2, yy + 5], [px + 2, -5], [px - 2, -5]], '#9c594b');
      poly([[-6, yy + 12], [6, yy + 12], [6, -5], [-6, -5]], '#596a62'); roof(w, yy);
      line([[-w + 10, -5], [w - 10, -5]], '#f3e6ba', 2);
    }
    if (idx <= 3) {
      cloudBase();
      if (idx === 1) {
        for (const [px, yy, s] of [[-21, -29, .74], [20, -32, .8], [-2, -44, 1]]) {
          line([[px, -7], [px - 1, yy + 5], [px + 7, yy - 3]], '#8c7555', 4 * s);
          for (const [dx, dy, r] of [[-9, 0, 10], [4, -7, 12], [13, 2, 9], [0, 5, 10]]) ell(px + dx * s, yy + dy * s, r * s, r * .78 * s, '#dca8ab', '#b98287');
          ell(px + 2, yy - 5, 8 * s, 5 * s, '#ecc3bc'); ell(px + 10 * s, yy + 3, 2.5, 3, '#f0d295');
        }
        line([[-24, -3], [-24, -11], [26, -11], [26, -3]], '#8e7760', 1.5);
        for (const px of [-13, 0, 13]) line([[px, -11], [px, -4]], '#8e7760', 1);
      } else if (idx === 0) {
        poly([[-29, -6], [29, -6], [29, -1], [-29, -1]], '#ede6c8');
        for (const px of [-19, 19]) { poly([[px - 4, -39], [px + 4, -39], [px + 4, -7], [px - 4, -7]], '#ad6555'); line([[px - 2, -35], [px - 2, -11]], '#d99e78', 1); }
        poly([[-23, -41], [23, -41], [23, -32], [-23, -32]], '#c9a96c'); roof(34, -44, '#b5a16c', '#7a7757');
        poly([[-9, -34], [9, -34], [9, -26], [-9, -26]], '#5d7970'); line([[-5, -30], [5, -30]], '#edd493', 1);
        line([[-29, -1], [-34, 3], [34, 3], [29, -1]], '#a2aa8a');
      } else if (idx === 2) {
        hall(25, -33, '#e9d7ab');
        for (const px of [-31, 31]) { poly([[px - 3, -33], [px + 3, -33], [px + 3, -5], [px - 3, -5]], '#dae2c7'); ell(px, -34, 5, 3, '#a4b497', '#748e7b'); }
        line([[-27, -3], [-18, -12], [18, -12], [27, -3]], '#efe9cc', 3);
        for (const yy of [-6, -2, 2]) line([[-20 - yy / 2, yy], [20 + yy / 2, yy]], '#97aa8c', 1);
      } else {
        hall(32, -27, '#ead6a2'); hall(21, -45, '#dfca92'); roof(33, -27, '#a39b64', '#7c7954');
        for (const px of [-15, 15]) poly([[px - 3, -17], [px + 3, -17], [px + 3, -8], [px - 3, -8]], '#b88763');
        poly([[-25, -5], [25, -5], [31, 1], [-31, 1]], '#e5ddba'); line([[-28, 1], [28, 1]], '#a9ae89');
      }
    } else if (idx === 4) {
      cloudBase();
      poly([[-23, -5], [-18, -48], [18, -48], [23, -5]], '#ada09b', '#746779');
      for (let i = 0; i < 4; i++) { const yy = -13 - i * 10, w = 29 - i * 4; poly([[-w + 7, yy], [w - 7, yy], [w - 7, yy + 8], [-w + 7, yy + 8]], '#c6bba5', '#84768a'); roof(w, yy, '#817787', '#625e73'); poly([[-3, yy + 6], [3, yy + 6], [3, yy + 10], [-3, yy + 10]], '#665972', null); }
      line([[0, -56], [0, -59]], '#978160', 2); ell(0, -58, 2, 2, '#ebc677');
    } else if (idx <= 7) {
      base('#d9d3aa', '#8aaf9b'); ell(0, 7, 42, 5, '#b7d0c0');
      if (idx === 5) {
        poly([[-29, -5], [-19, -20], [-5, -9]], '#9dafa0', '#6e998b');
        line([[12, -7], [16, -29], [11, -41]], '#aa8a61', 3);
        for (const points of [[[11, -41], [-8, -39], [-11, -27], [4, -33]], [[11, -41], [26, -42], [34, -29], [21, -33]], [[11, -41], [12, -52], [22, -52], [19, -40]]]) poly(points, '#7ba58a', '#5e8977');
        ell(16, -36, 3, 3, '#d5b179'); ell(-11, -6, 7, 4, '#e9e0c0');
        line([[-24, 3], [-13, 5], [-3, 3]], '#88b4a2', 1); line([[20, 3], [30, 0]], '#88b4a2', 1);
      } else if (idx === 6) {
        poly([[-24, -27], [24, -27], [24, -8], [16, -8], [16, -18], [-16, -18], [-16, -8], [-24, -8]], '#bad1bb', '#678e80'); roof(31, -32, '#89b1a2', '#5b897c');
        for (const px of [-19, 19]) line([[px, -25], [px, -10]], '#e3e6c5', 2);
        line([[-33, -2], [-26, -8], [-26, -20], [-32, -24], [-26, -17], [-19, -21]], '#c6958b', 3);
        line([[31, -2], [26, -14], [31, -22], [26, -16], [19, -24]], '#bd9a87', 3);
        line([[-18, -1], [0, -4], [18, -1]], '#b3c7a7', 2);
      } else {
        hall(29, -24, '#b9d8c2'); roof(30, -27, '#75aaa1', '#4e837e');
        poly([[-10, -7], [-12, -43], [0, -55], [12, -43], [10, -7]], '#b9ded5', '#598f88');
        poly([[0, -55], [0, -9], [10, -7], [12, -43]], '#8dc2b8', null); line([[0, -55], [-12, -43], [12, -43]], '#e8f0d5', 1);
        for (const px of [-27, 27]) { poly([[px - 7, -9], [px - 8, -28], [px, -38], [px + 7, -27], [px + 5, -9]], '#a7d1c8', '#598f88'); line([[px, -37], [px, -11]], '#e5efcf', 1); }
        roof(19, -25, '#87b4a6', '#568881'); poly([[-5, -15], [5, -15], [5, -5], [-5, -5]], '#537f78');
      }
    } else {
      base('#d9b38b', '#ac8267');
      if (idx === 8) {
        poly([[-32, -7], [-21, -34], [-9, -20], [2, -54], [17, -26], [25, -35], [34, -7]], '#be8568', '#925c4c');
        poly([[2, -54], [4, -27], [17, -26]], '#ddb18b', null); line([[-21, -34], [-19, -12], [-11, -7]], '#e0b189');
        line([[25, -35], [23, -18], [30, -10]], '#e0b189');
        poly([[-7, -6], [-13, -20], [-8, -15], [-6, -27], [2, -17], [5, -5]], '#df9d53', '#bb7750');
        poly([[-2, -5], [-4, -17], [1, -10], [3, -5]], '#efd099', null);
      } else {
        poly([[-31, -7], [-29, -30], [-15, -43], [5, -49], [25, -34], [33, -8]], idx === 9 ? '#9fa57b' : '#ae896f', idx === 9 ? '#73846b' : '#8b6456');
        poly([[-13, -6], [-13, -23], [-7, -30], [6, -31], [15, -23], [15, -6]], '#685c4e');
        poly([[-8, -6], [-8, -22], [-3, -26], [6, -24], [10, -6]], '#493f37', null);
        line([[-17, -7], [-19, -27], [-10, -37], [8, -39], [21, -28], [21, -7]], idx === 9 ? '#c7c995' : '#d1ad8c', 2);
        if (idx === 9) {
          for (const [px, yy, dx] of [[-20, -26, -11], [-18, -28, 1], [23, -21, 10]]) {
            g.beginPath(); g.moveTo(px, -7); g.quadraticCurveTo(px + dx, yy + 4, px + dx, yy - 17);
            g.quadraticCurveTo(px + 19, yy - 12, px, -7); g.fillStyle = '#7b9d77'; g.fill(); g.strokeStyle = '#527d67'; g.stroke();
            line([[px, -7], [px + dx, yy - 11]], '#b9c294', 1);
          }
        } else {
          poly([[-21, -37], [-29, -53], [-17, -48], [-10, -37]], '#dbbd91', '#8b6456');
          poly([[10, -39], [20, -54], [23, -46], [20, -34]], '#dbbd91', '#8b6456');
          poly([[-11, -32], [11, -32], [11, -26], [-11, -26]], '#ae6350'); line([[-7, -29], [7, -29]], '#e8c390', 1);
        }
      }
    }
    g.restore();
  }

  const mapChapters = [
    { tab: '壹 · 天宫', title: '云阙天宫', desc: '玉阙凌云 · 蟠桃映霞', nodes: [{idx:0,x:135,y:330},{idx:1,x:280,y:240},{idx:2,x:445,y:315},{idx:3,x:585,y:210}] },
    { tab: '贰 · 东海', title: '碧海龙宫', desc: '踏浪寻珠 · 深海问龙', nodes: [{idx:5,x:155,y:320},{idx:6,x:350,y:260},{idx:7,x:555,y:320}] },
    { tab: '叁 · 火焰山', title: '赤岭西行', desc: '烈焰重峦 · 芭蕉借风', nodes: [{idx:8,x:155,y:330},{idx:9,x:355,y:245},{idx:10,x:555,y:325}] },
    { tab: '镇妖塔', title: '镇妖浮屠', desc: '云封古塔 · 无尽试炼', nodes: [{idx:4,x:350,y:300}] },
  ];
  let mapState = { sceneT0: null, save: null, chapter: 0, selected: 0 };
  // Keep the original numeric predecessor rule, including idx 5's tower dependency.
  function mapPrevious(idx) { return idx === 5 ? 3 : idx - 1; }
  function mapUnlocked(idx, S) { return idx === 4 || idx === 0 || !!S.cleared[mapPrevious(idx)]; }
  function mapTarget(S) {
    for (const ch of mapChapters.slice(0, 3)) for (const n of ch.nodes) {
      if (!S.cleared[n.idx] && mapUnlocked(n.idx, S)) return n.idx;
    }
    return 4;
  }
  function mapAction(g, x, y, w, h, label, active, disabled, size = 14) {
    const hov = !disabled && inRect(Z.Input.mouse, x, y, w, h);
    if (hov) hoverAny = true;
    g.save();
    const face=g.createLinearGradient(0,y,0,y+h);
    face.addColorStop(0,disabled?'#344b43':active?(hov?'#e1c995':'#c8b17b'):hov?'#3d6a56':'#294e40');
    face.addColorStop(1,disabled?'#293f37':active?'#a48e5e':'#17392f');
    g.fillStyle=face;jadeShape(g,x,y,w,h,6);g.fill();
    g.strokeStyle=disabled?'#60705a':active?'#dbc68b':hov?'#b8be8f':'#718364';g.lineWidth=1;g.stroke();
    if(h>=38)jadeTrim(g,x+2,y+2,w-4,h-4,active?'#7f7448':'#89956c');
    Z.Spr.text(g, label, x+w/2, y+h/2, {size, bold:true, color:disabled?'#a9b1a8':active?'#263b2b':'#e4d8b1'});
    g.restore();
    if (hov && Z.Input.mouse.clicked) { Z.Audio.sfx('click'); return true; }
    return false;
  }
  function mapFrame(g, x, y, w, h, paper = false) {
    g.save();
    const grad = g.createLinearGradient(x,y,x+w,y+h);
    grad.addColorStop(0, paper ? '#eee5c8' : '#315345');
    grad.addColorStop(1, paper ? '#d4c8a4' : '#173a2f');
    g.fillStyle = 'rgba(0,10,15,.28)'; rr(g,x+3,y+5,w,h,8); g.fill();
    g.fillStyle = grad; rr(g,x,y,w,h,8); g.fill();
    // v80 框体立体化：受光顶缘 + 底部内阴影（纸/玉均读作有厚度的板）
    g.save(); rr(g,x,y,w,h,8); g.clip();
    const top = g.createLinearGradient(0, y, 0, y + Math.min(18, h * 0.3));
    top.addColorStop(0, paper ? 'rgba(255,252,238,0.5)' : 'rgba(214,244,224,0.14)');
    top.addColorStop(1, 'rgba(255,252,238,0)');
    g.fillStyle = top; g.fillRect(x, y, w, Math.min(18, h * 0.3));
    const bot = g.createLinearGradient(0, y + h - Math.min(14, h * 0.22), 0, y + h);
    bot.addColorStop(0, 'rgba(20,14,6,0)');
    bot.addColorStop(1, paper ? 'rgba(60,44,18,0.20)' : 'rgba(2,12,10,0.30)');
    g.fillStyle = bot; g.fillRect(x, y + h - Math.min(14, h * 0.22), w, Math.min(14, h * 0.22));
    g.restore();
    g.strokeStyle = '#bba16d'; g.lineWidth = 1.2; rr(g,x+.5,y+.5,w-1,h-1,8); g.stroke();
    g.strokeStyle = paper ? '#c3b080' : '#496364'; g.lineWidth = 1; rr(g,x+5,y+5,w-10,h-10,5); g.stroke();
    g.strokeStyle = paper ? '#9c8356' : '#bba16d';
    for (const dx of [0,1]) for (const dy of [0,1]) {
      const cx=x+12+dx*(w-24), cy=y+12+dy*(h-24), sx=dx?-1:1, sy=dy?-1:1;
      g.beginPath();g.moveTo(cx,cy+sy*11);g.lineTo(cx,cy);g.lineTo(cx+sx*11,cy);g.stroke();
    }
    g.restore();
  }
  function mapNode(g, n, S, target, interactive) {
    const unlocked = mapUnlocked(n.idx,S), cleared = n.idx!==4 && !!S.cleared[n.idx], selected = n.idx===mapState.selected;
    const hov = interactive && inRect(Z.Input.mouse,n.x-54,n.y-67,108,120);
    if (hov) hoverAny = true;
    g.save();
    g.fillStyle = selected ? 'rgba(184,143,61,.16)' : 'rgba(91,103,79,.08)';
    g.beginPath(); g.ellipse(n.x,n.y+2,selected?48:43,17,0,0,U.TAU); g.fill();
    g.strokeStyle = selected ? '#a66b2d' : hov ? '#b49352' : cleared ? '#668f79' : '#b6aa83';
    g.lineWidth = selected ? 2 : 1;
    g.beginPath(); g.ellipse(n.x,n.y+2,46,16,0,0,U.TAU); g.stroke();
    g.globalAlpha = unlocked ? 1 : .68; mapLandmark(g,n.x,n.y,n.idx); g.globalAlpha=1;
    // State badges use geometry so they do not depend on emoji glyphs or images.
    const bx=n.x+33, by=n.y-25;
    g.fillStyle = unlocked ? cleared?'#4c7a65':'#9a7135' : '#7b8171';
    g.beginPath(); g.arc(bx,by,9,0,U.TAU); g.fill();
    g.strokeStyle='#f5ecd4';g.lineWidth=1.5;g.beginPath();
    if (unlocked && cleared) {g.moveTo(bx-4,by);g.lineTo(bx-1,by+3);g.lineTo(bx+4,by-3);g.stroke();}
    else if (unlocked) {g.moveTo(bx-2,by-4);g.lineTo(bx+3,by);g.lineTo(bx-2,by+4);g.stroke();}
    else {g.arc(bx,by-2,3,Math.PI,0);g.stroke();g.fillStyle='#f5ecd4';g.fillRect(bx-4,by-1,8,5);}
    if(n.idx===target){
      g.fillStyle='#af603b';g.beginPath();g.moveTo(n.x-44,n.y-60);g.lineTo(n.x-23,n.y-60);g.lineTo(n.x-23,n.y-31);g.lineTo(n.x-33.5,n.y-36);g.lineTo(n.x-44,n.y-31);g.closePath();g.fill();
      Z.Spr.text(g,'前',n.x-33.5,n.y-51,{size:10,color:'#fff0c2',bold:true});
      Z.Spr.text(g,'路',n.x-33.5,n.y-40,{size:10,color:'#fff0c2',bold:true});
    }
    g.fillStyle=selected?'#f7ecd1':'rgba(244,235,210,.88)';rr(g,n.x-53,n.y+23,106,23,4);g.fill();
    g.strokeStyle=selected?'#a66b2d':'#c2b38c';g.lineWidth=1;rr(g,n.x-53,n.y+23,106,23,4);g.stroke();
    Z.Spr.text(g,Z.BAL.levels[n.idx].name,n.x,n.y+34.5,{size:13,color:unlocked?'#3c5348':'#596452',bold:true});
    Z.Spr.text(g,n.idx===4?'无尽挑战':cleared?'已通关':unlocked?'可挑战':'尚未解锁',n.x,n.y+57,{size:11,color:unlocked?cleared?'#3d6651':'#76502d':'#626953',stroke:'rgba(245,237,211,.95)',strokeW:3});
    g.restore();
    if(hov && Z.Input.mouse.clicked){mapState.selected=n.idx;Z.Audio.sfx('click');}
  }
  function drawMap(g, G) {
    const S=Z.Save.d, target=mapTarget(S), interactive=!G.paused && !G.achOpen && !G.prologue && !Z.Trans.busy;
    hoverAny=false;
    if(mapState.sceneT0!==G.sceneT0 || mapState.save!==S){
      mapState={sceneT0:G.sceneT0,save:S,chapter:mapChapters.findIndex(ch=>ch.nodes.some(n=>n.idx===target)),selected:target};
    }
    g.save();
    const bg=g.createLinearGradient(0,0,960,540);bg.addColorStop(0,'#122c27');bg.addColorStop(1,'#365440');g.fillStyle=bg;g.fillRect(0,0,960,540);
    g.strokeStyle='rgba(176,195,169,.08)';g.lineWidth=1;
    for(let i=0;i<7;i++){g.beginPath();g.ellipse(480,282,250+i*68,122+i*34,-.13,0,U.TAU);g.stroke();}
    Z.Spr.text(g,'西 游 山 海 行',480,33,{size:30,color:'#edd9a4',bold:true,font:'KaiTi, STKaiti, "Microsoft YaHei"'});
    Z.Spr.text(g,'选一处山海，再启一程西游',480,56,{size:11,color:'#a9c0b4'});
    if(mapAction(g,28,20,80,30,'‹ 标题',false,!interactive,13)){G.toTitle();g.restore();return;}
    Z.Spr.drawCoin(g,752,33,7);Z.Spr.text(g,U.fmt(S.gold),765,33,{size:13,color:'#ead292',align:'left',bold:true});
    Z.Spr.drawStone(g,851,33,7);Z.Spr.text(g,String(S.stones),864,33,{size:13,color:'#9ddbc8',align:'left',bold:true});
    mapChapters.forEach((ch,ci)=>{
      if(mapAction(g,40+ci*159,72,150,30,ch.tab,mapState.chapter===ci,!interactive)){
        if(mapState.chapter!==ci){mapState.chapter=ci;mapState.selected=ch.nodes.some(n=>n.idx===target)?target:(ch.nodes.find(n=>!S.cleared[n.idx]&&mapUnlocked(n.idx,S))||ch.nodes[0]).idx;}
      }
    });
    mapFrame(g,40,113,632,351,true);
    // Wooden scroll rollers frame the illustration without covering the selectable nodes.
    for(const x of [32,670]){
      const wood=g.createLinearGradient(x,0,x+10,0);wood.addColorStop(0,'#816846');wood.addColorStop(.5,'#ccb487');wood.addColorStop(1,'#69553d');g.fillStyle=wood;rr(g,x,109,10,359,4);g.fill();
      g.fillStyle='#dbc393';for(const y of [108,462]){rr(g,x-2,y,14,8,3);g.fill();}
    }
    const ch=mapChapters[mapState.chapter];mapTerrain(g,mapState.chapter);
    Z.Spr.text(g,ch.title,66,137,{size:17,color:'#506851',bold:true,align:'left'});
    Z.Spr.text(g,ch.desc,653,136,{size:11,color:'#8f8b6e',align:'right'});
    for(let i=1;i<ch.nodes.length;i++){
      const a=ch.nodes[i-1],b=ch.nodes[i],open=mapUnlocked(b.idx,S);
      g.strokeStyle=open?'#a68748':'#b4b59e';g.lineWidth=2;g.setLineDash(open?[5,5]:[2,6]);g.beginPath();g.moveTo(a.x,a.y+7);g.bezierCurveTo(a.x+65,a.y+17,b.x-62,b.y+22,b.x,b.y+7);g.stroke();g.setLineDash([]);
    }
    ch.nodes.forEach(n=>mapNode(g,n,S,target,interactive));
    Z.Spr.text(g,'✓ 已通关   › 可挑战   锁 未解锁',66,446,{size:11,color:'#52634e',stroke:'rgba(245,237,211,.95)',strokeW:3,align:'left'});
    const idx=mapState.selected, def=Z.BAL.levels[idx], boss=def.boss?Z.BAL.bosses[def.boss]:null, unlocked=mapUnlocked(idx,S), done=!!S.cleared[idx];
    mapFrame(g,694,113,232,351);
    Z.Spr.text(g,'此 行 所 向',710,137,{size:11,color:'#acbbaa',align:'left'});
    Z.Spr.text(g,idx===4?'无尽':done?'通关':unlocked?'可挑战':'未解锁',909,137,{size:11,color:unlocked?'#d9c384':'#aeb8ae',align:'right'});
    Z.Spr.text(g,def.name,810,164,{size:22,color:'#f1dfb4',bold:true});
    if(idx===4)mapLandmark(g,810,248,idx,.95);
    else {
      g.save();jadeShape(g,710,184,200,78,5);g.clip();
      g.translate(710,164);g.scale(200/960,200/960);
      Z.BG.draw(g,def.theme,Math.max(0,Math.min(def.w-960,def.w*.42)),def.w,def.gy,G.time,[],idx);
      g.restore();g.strokeStyle='#788b6c';g.lineWidth=1;jadeShape(g,710,184,200,78,5);g.stroke();
    }
    g.strokeStyle='#6e8070';g.lineWidth=1;g.beginPath();g.moveTo(709,269);g.lineTo(911,269);g.stroke();
    const gearPool = Z.BAL.bossGearPools && Z.BAL.bossGearPools[idx];
    Z.Spr.text(g,idx===4?'塔内试炼':'镇守此地',710,gearPool?282:290,{size:11,color:'#aebca9',align:'left'});
    Z.Spr.text(g,idx===4?'妖怪波次试炼':boss.name,710,gearPool?301:311,{size:15,color:'#f0dfb9',bold:true,align:'left'});
    if (def.advice) {
      const ty = gearPool ? 301 : 311;
      Z.Spr.ell(g, 900, ty, 9, 9, '#657e6b');
      Z.Spr.text(g, '?', 900, ty, { size: 12, color: '#f1e2b8', bold: true });
      if (interactive && inRect(Z.Input.mouse, 884, ty - 16, 32, 32)) {
        hoverAny = true;
        tooltip(g, 792, 268, '迎战准备 · ' + boss.name, [def.advice, def.waves.length + ' 处驻守战场，守将前可饮一次灵泉'], '#d9c384');
      }
    }
    const relicOf = Z.BAL.relicOfStage; // v74 起与产出规则共用同一映射（balance.js）
    if (gearPool) {
      Z.Spr.text(g,'专属随机 2 件 · 可重复',710,318,{size:10,color:'#aebca9',align:'left'});
      gearPool.forEach((gear, i) => {
        const gd = Z.BAL.gearDefs[gear], ix = 710 + (i % 2) * 103, iy = 328 + Math.floor(i / 2) * 23;
        Z.Spr.drawItemIcon(g, { base: gd.base, gearId: gear, t: idx, q: gd.q, lv: 0, ax: [] }, ix, iy, 22);
        Z.Spr.text(g,gd.name,ix+27,iy+11,{size:10,color:'#ddc58e',align:'left'});
        if (interactive && inRect(Z.Input.mouse, ix, iy, 100, 22)) {
          hoverAny = true;
          tooltip(g, ix + 50, iy, gd.name, ['来自 ' + boss.name, '每次随机抽取 2 件，可能重复', Z.BAL.qualities[gd.q].n + '品质固定 · 属性小幅浮动'], '#ddc58e');
        }
      });
      // 法宝目标：此关材料来源与培养去向（具名装备分解出的精铁/灵木即培养材料）
      const rid = relicOf[idx];
      if (rid) {
        const rdef = Z.BAL.relicDefs[rid], matId = Object.keys(rdef.recipe.materials)[0];
        const owned = S.relics.owned.some(r => r.id === rid);
        Z.Spr.drawRelicIcon(g, { id: rid }, 719, 382, 16, owned ? { noElement: true } : { silhouette: true });
        const stock = S.materials[matId] || 0, need = rdef.recipe.materials[matId];
        Z.Spr.text(g, (owned ? rdef.name + ' 已持有 · 可培养'
          : '通关必得 ' + Z.BAL.materialNames[matId] + (stock ? '（已有 ' + stock + '/' + need + '）' : '') + ' · 合成 ' + rdef.name),
          731, 382, { size: 10, color: '#c9d8a8', align: 'left' });
        if (interactive && inRect(Z.Input.mouse, 708, 372, 200, 20)) {
          hoverAny = true;
          tooltip(g, 800, 372, rdef.name + ' · 法宝', [
            owned ? '已持有 · 背包-法宝修炼页可培养' : '配方：' + Z.BAL.materialNames[matId] + ' ×' + rdef.recipe.materials[matId] + ' + 金币 ' + rdef.recipe.gold,
            '培养材料：' + (rid === 'cloud_umbrella' ? '精铁' : '灵木') + ' · 分解多余装备获得',
            '装备后战斗中按 R 释放',
          ], '#c9d8a8');
        }
      }
    } else {
      Z.Spr.text(g,idx===4?'历练记录':'Boss 掉落',710,340,{size:11,color:'#aebca9',align:'left'});
      Z.Spr.text(g,idx===4?'已通关 '+(S.towerBest||0)+' 层 · 挑战第 '+((S.towerBest||0)+1)+' 层':'随机装备 · 强化石',710,360,{size:idx===4?12:13,color:'#ddc58e',align:'left'});
      // 东海海滩等法宝来源关：无具名装备池，单独画法宝目标行
      if (relicOf[idx] && idx !== 4) {
        const r2 = Z.BAL.relicDefs[relicOf[idx]], m2 = Object.keys(r2.recipe.materials)[0];
        const own2 = S.relics.owned.some(r => r.id === relicOf[idx]);
        Z.Spr.drawRelicIcon(g, { id: relicOf[idx] }, 719, 385, 16, own2 ? { noElement: true } : { silhouette: true });
        const stock2 = S.materials[m2] || 0, need2 = r2.recipe.materials[m2];
        Z.Spr.text(g, own2 ? r2.name + ' 已持有 · 可培养'
          : '通关必得 ' + Z.BAL.materialNames[m2] + (stock2 ? '（已有 ' + stock2 + '/' + need2 + '）' : '') + ' · 合成 ' + r2.name,
          731, 385, { size: 10, color: '#c9d8a8', align: 'left' });
        if (interactive && inRect(Z.Input.mouse, 708, 375, 200, 20)) {
          hoverAny = true;
          tooltip(g, 800, 375, r2.name + ' · 法宝', [
            own2 ? '已持有 · 背包-法宝修炼页可培养' : '配方：' + Z.BAL.materialNames[m2] + ' ×' + r2.recipe.materials[m2] + ' + 金币 ' + r2.recipe.gold,
            '培养材料：精铁 · 分解多余装备获得', '装备后战斗中按 R 释放',
          ], '#c9d8a8');
        }
      }
    }
    const pet=boss&&boss.petball&&Z.BAL.pets[boss.petball];
    Z.Spr.text(g,idx===4?'第 1 层起行 · 每 4 层守将后休整':pet?(done?'再战有机会：':'首胜宠物球：')+pet.name:gearPool?'型号品质固定 · 部位随机':'装备部位与品质随机',710,gearPool||relicOf[idx]?402:382,{size:idx===4?11:gearPool||relicOf[idx]?10:12,color:pet?'#c0d9b3':'#aebdad',align:'left'});
    if(idx===4)Z.Spr.text(g,'开层前可预览阵型 · 装备阶次不随层数提升',710,400,{size:9,color:'#9eafa3',align:'left'});
    if(mapAction(g,708,414,202,40,unlocked?idx===4?'进入镇妖塔':done?'再战此关':'进入关卡':'需通关 '+Z.BAL.levels[mapPrevious(idx)].name,true,!interactive||!unlocked,unlocked?16:13)){G.startLevel(idx);}
    mapFrame(g,28,481,898,45);
    Z.Spr.text(g,'悟空  Lv.'+S.lv,44,503,{size:14,color:'#edd69e',bold:true,align:'left'});
    bar(g,154,498,108,10,S.exp/Z.BAL.expNeed(S.lv),'#9caa87');
    Z.Spr.text(g,'经验 '+S.exp+'/'+Z.BAL.expNeed(S.lv),154,516,{size:9,color:'#aebfad',align:'left'});
    Z.Spr.text(g,'前路：'+Z.BAL.levels[target].name,290,503,{size:13,color:'#e4cca0',align:'left'});
    if(S.pets.active)Z.Spr.text(g,'出战 '+Z.BAL.pets[S.pets.active].name,290,518,{size:10,color:'#c2d8b4',align:'left'});
    drawSystemBar(g, G, 550, 478, 56, 44, 6);
    g.restore();
  }

  /* ================= 独立系统窗口 ================= */
  const PANELS = { bag: '背包', pet: '宠物', skill: '技能', shop: '商店', ach: '成就', set: '设置' };

  function drawSystemBar(g, G, x, y, w, h, gap) {
    const disabled = G.paused || G.achOpen || G.prologue || G.clearInfo || G.dead || Z.Trans.busy;
    Object.keys(PANELS).forEach((tab, i) => {
      if (button(g, x + i * (w + gap), y, w, h, PANELS[tab], {
        size: 10, r: 6, disabled, jade: true, icon: tab, iconSize: 24, iconLayout: 'stack',
      })) G.openPanel(tab);
    });
  }

  function drawPauseMenu(g, G) {
    panel(g, 310, 104, 340, 332);
    drawSystemIcon(g, 'pause', 425, 143, 26);
    Z.Spr.text(g, '暂  停', 480, 143, { size: 26, color: '#ffd75e', bold: true });
    Z.Spr.text(g, '休整片刻，再启西游', 480, 172, { size: 13, color: '#a7b8bf' });
    if (button(g, 360, 198, 240, 40, G.scene === 'map' ? '继续选关' : '继续冒险', { jade: true, size: 17, icon: 'play' })) G.closePanel();
    else if (button(g, 360, 250, 240, 36, '设置', { size: 15, icon: 'set' })) G.openPanel('set');
    else if (button(g, 360, 298, 240, 36, G.scene === 'map' ? '已在选关地图' : '返回选关地图', { size: 15, icon: 'map', disabled: G.scene === 'map' })) { G.closePanel(); G.toMap(); }
    else if (button(g, 360, 346, 240, 36, '返回主菜单', { size: 15, icon: 'title' })) { G.closePanel(); G.toTitle(); }
    else if (button(g, 410, 397, 140, 25, '操作说明', { size: 12, r: 6 })) { G.help = true; Z.Input.mouse.clicked = false; }
  }

  function drawPause(g, G) {
    if (G.help) { drawHelp(g, G); return; }
    if (PANELS[G.tab]) { systemUI.draw(g, G); return; }
    // 紧凑暂停页继续沿用原滑入演出。
    const dtF = Math.min(0.05, G.time - (G._pLt || (G._pLt = G.time)));
    G._pLt = G.time;
    G._pauseT = Math.min(1, (G._pauseT || 0) + dtF * 3.4);
    const pe = U.ease(G._pauseT);
    g.save();
    g.globalAlpha = pe;
    g.fillStyle = 'rgba(6,10,18,0.72)';
    g.fillRect(0, 0, 960, 540);
    g.translate(0, (1 - pe) * -26);
    drawPauseMenu(g, G);
    g.restore();
  }

  // 六个独立系统窗口共享纸色与画标，所有绘制和页脚通知均为本模块私有。
  function createSystemUI() {
    const C = { ink:'#293c2e', muted:'#56634f', paper:'#e9e0c7', light:'#f6efda', jade:'#225b49', red:'#963c2e', line:'#b9b18c', gold:'#86652f', slot:'#d7d2b6' };
    const P = { C, drawers:{}, hovering:false };
    let notice = null;
    function rr(g,x,y,w,h,r=10) {
      r=Math.max(0,Math.min(r,w/2,h/2));
      g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
      g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
    }
    function label(g,text,x,y,size=14,color=C.ink,align='left',bold=false) {
      if (y < 104 || y >= 480) color = color === C.ink ? '#eee0b9' : color === C.muted ? '#a8b9a3' : color === C.jade ? '#bad1a6' : color;
      Z.Spr.text(g,String(text),x,y,{size,color,align,bold,font:bold && size>=18?'KaiTi, STKaiti, "Microsoft YaHei"':undefined});
    }
    function wrap(g,text,x,y,w,o={}) {
      const size=o.size||13, leading=o.lineHeight||19, max=o.maxLines||3;
      g.save();g.font=size+'px "Microsoft YaHei",sans-serif';
      let line='',lines=[];
      for(const ch of String(text)) {
        if(ch==='\n'||(line&&g.measureText(line+ch).width>w)) {lines.push(line);line='';}
        if(ch!=='\n')line+=ch;
      }
      if(line)lines.push(line);
      if(lines.length>max){lines=lines.slice(0,max);while(g.measureText(lines[max-1]+'…').width>w)lines[max-1]=lines[max-1].slice(0,-1);lines[max-1]+='…';}
      g.restore();lines.forEach((str,i)=>label(g,str,x,y+i*leading,size,o.color||C.muted));
      return lines.length*leading;
    }
    function panel(g,x,y,w,h,o={}) {
      g.save();rr(g,x,y,w,h,Math.min(o.r==null?4:o.r,5));g.fillStyle=o.fill||C.light;g.fill();
      if(o.border!==false){g.strokeStyle=o.border||C.line;g.lineWidth=.8;g.stroke();}
      if(h>90){g.strokeStyle='rgba(255,251,223,.58)';g.beginPath();g.moveTo(x+5,y+2);g.lineTo(x+w-5,y+2);g.stroke();}
      g.restore();
    }
    function hit(x,y,w,h) {const m=Z.Input.mouse;return m.x>=x&&m.x<=x+w&&m.y>=y&&m.y<=y+h;}
    function button(g,x,y,w,h,text,o={}) {
      const hov=!o.disabled&&hit(x,y,w,h),down=hov&&Z.Input.mouse.down,kind=o.kind||'secondary';
      if(hov)P.hovering=true;
      const onHeader=y<104, primary=kind==='primary', quiet=kind==='quiet';
      const fill=o.disabled?'#d8d4bd':primary?(hov?'#367c65':C.jade):kind==='danger'?(hov?'#eed4bf':'#eee2c9'):onHeader?(hov?'#466a57':quiet?'#23463c':'#cdb883'):quiet?(hov?'#ddd8bb':'rgba(244,235,207,.5)'):(hov?'#eee0b4':'#e8ddbd');
      g.save();g.translate(0,down?1:0);
      if(primary&&!o.disabled){jadeShape(g,x,y+2,w,h,5);g.fillStyle='#153e32';g.fill();}
      jadeShape(g,x,y,w,h,Math.min(h/4,5));g.fillStyle=fill;g.fill();
      g.strokeStyle=o.disabled?'#c3c4ad':onHeader?'#77906f':primary?'#487b60':kind==='danger'?'#c4a88a':quiet?'#c4bea0':'#a5a681';g.lineWidth=.8;g.stroke();
      if(primary||!quiet){g.strokeStyle=primary?'rgba(215,229,174,.3)':'rgba(255,251,223,.55)';g.beginPath();g.moveTo(x+5,y+2);g.lineTo(x+w-5,y+2);g.stroke();}
      const size=o.size||13;
      g.font='bold '+size+'px "Microsoft YaHei",sans-serif';
      const tw=g.measureText(text).width,ix=x+(w-tw-(o.icon?24:0))/2;
      if(o.icon)icon(g,o.icon,text?ix+8:x+w/2,y+h/2,16);
      const textColor=o.disabled?'#68715e':primary?'#fff0c6':kind==='danger'?C.red:onHeader?(quiet?'#d5d7b4':'#293d2e'):C.ink;
      label(g,text,o.icon?ix+24+tw/2:x+w/2,y+h/2,size,textColor,'center',primary);
      g.restore();
      if(hov&&Z.Input.mouse.clicked){Z.Input.mouse.clicked=false;Z.Audio.sfx('click');return true;}return false;
    }
    function bar(g,x,y,w,h,frac,color=C.jade) {
      frac=U.clamp(frac,0,1);panel(g,x,y,w,h,{fill:'#e4d9c3',border:false,r:h/2});
      if(frac>0)panel(g,x,y,Math.max(h,w*frac),h,{fill:color,border:false,r:h/2});
    }
    function cloud(g,x,y,s,color) {
      g.save();g.translate(x,y);g.scale(s,s);g.beginPath();g.moveTo(-32,6);
      g.bezierCurveTo(-48,3,-38,-12,-22,-10);g.bezierCurveTo(-18,-32,14,-29,18,-10);
      g.bezierCurveTo(40,-17,51,5,29,8);g.bezierCurveTo(8,12,-6,9,-32,6);g.closePath();g.fillStyle=color;g.fill();g.restore();
    }
    function stage(g,x,y,w,h,o={}) {
      panel(g,x,y,w,h,{fill:'#d4ddc6',border:'#8e9d7c',r:4});
      g.save();rr(g,x+1,y+1,w-2,h-2,4);g.clip();
      if (heroStageArt) {
        const sw = heroStageArt.width, sh = heroStageArt.height, scale = Math.max(w/sw,h/sh);
        const cropW=w/scale,cropH=h/scale;
        // 横幅展台按脚底定位玉台上表面，避免伙伴和招式演员落在石台正面。
        const cropY=o.theme==='pet'||o.theme==='skill'?U.clamp(sh*.77-h*.87/scale,0,sh-cropH):sh-cropH;
        g.drawImage(heroStageArt,(sw-cropW)/2,cropY,cropW,cropH,x,y,w,h);
      } else {
        const sky=g.createLinearGradient(0,y,0,y+h);sky.addColorStop(0,'#c5d9c6');sky.addColorStop(.7,'#f0e6bc');sky.addColorStop(1,'#71937d');
        g.fillStyle=sky;g.fillRect(x,y,w,h);
        g.strokeStyle='rgba(161,145,82,.5)';g.lineWidth=2;g.beginPath();g.arc(x+w/2,y+h*.4,w*.4,Math.PI,0);g.stroke();
        cloud(g,x+w*.22,y+h*.5,.8,'rgba(255,248,215,.8)');cloud(g,x+w*.82,y+h*.62,.6,'rgba(255,248,215,.75)');
        g.fillStyle='#527864';g.beginPath();g.ellipse(x+w*.5,y+h*.84,w*.46,h*.09,0,0,U.TAU);g.fill();
        g.fillStyle='#b6c6a6';g.beginPath();g.ellipse(x+w*.5,y+h*.81,w*.46,h*.08,0,0,U.TAU);g.fill();
        g.strokeStyle='#ddc997';g.lineWidth=2;g.stroke();
      }
      const veil=g.createLinearGradient(0,y,0,y+h);
      veil.addColorStop(0,'rgba(249,239,204,.82)');veil.addColorStop(.19,'rgba(249,239,204,0)');
      veil.addColorStop(.76,'rgba(235,233,203,0)');veil.addColorStop(1,'rgba(239,232,202,.91)');
      g.fillStyle=veil;g.fillRect(x,y,w,h);
      g.restore();
    }
    function icon(g,id,x,y,size=24) {
      if(id==='coin'){Z.Spr.drawCoin(g,x,y,size*.38);return;}
      if(id==='stone'){Z.Spr.drawStone(g,x,y,size*.38);return;}
      if(id==='hp'||id==='mp'){Z.Spr.drawPotion(g,x,y,size*.34,id);return;}
      if(['sound','time','sp','save','shake','check','close','attack'].includes(id)){
        g.save();g.translate(x,y);g.scale(size/24,size/24);g.strokeStyle=y<104?'#e0d6a3':C.jade;g.fillStyle='#e9d2a0';g.lineWidth=1.8;g.lineCap='round';g.lineJoin='round';
        if(id==='close'){g.beginPath();g.moveTo(-5,-5);g.lineTo(5,5);g.moveTo(5,-5);g.lineTo(-5,5);g.stroke();}
        else if(id==='check'){g.beginPath();g.moveTo(-7,0);g.lineTo(-2,5);g.lineTo(7,-6);g.stroke();}
        else if(id==='time'){g.beginPath();g.arc(0,0,9,0,U.TAU);g.fill();g.stroke();g.beginPath();g.moveTo(0,-5);g.lineTo(0,0);g.lineTo(4,3);g.stroke();}
        else if(id==='sound'){g.beginPath();g.moveTo(-8,-3);g.lineTo(-4,-3);g.lineTo(2,-8);g.lineTo(2,8);g.lineTo(-4,3);g.lineTo(-8,3);g.closePath();g.fill();g.stroke();g.beginPath();g.arc(1,0,8,-.8,.8);g.stroke();}
        else if(id==='save'){panel(g,-9,-10,18,20,{fill:'#f3dcac',border:C.jade,r:3});g.strokeRect(-5,-7,10,6);g.strokeRect(-5,3,10,5);}
        else if(id==='shake'){panel(g,-6,-8,12,16,{fill:'#e7d4a4',border:C.jade,r:2});g.beginPath();g.moveTo(-10,-6);g.lineTo(-12,0);g.lineTo(-10,6);g.moveTo(10,-6);g.lineTo(12,0);g.lineTo(10,6);g.stroke();}
        else if(id==='attack'){g.beginPath();g.moveTo(-8,8);g.lineTo(8,-8);g.stroke();g.strokeStyle=C.gold;g.lineWidth=5;g.beginPath();g.moveTo(-8,8);g.lineTo(-5,5);g.moveTo(5,-5);g.lineTo(8,-8);g.stroke();}
        else{g.beginPath();g.moveTo(0,-10);g.lineTo(4,-3);g.lineTo(10,0);g.lineTo(4,3);g.lineTo(0,10);g.lineTo(-4,3);g.lineTo(-10,0);g.lineTo(-4,-3);g.closePath();g.fill();g.stroke();}
        g.restore();return;
      }
      drawSystemIcon(g,id,x,y,size);
    }
    Object.assign(P,{rr,label,wrap,panel,button,icon,stage,bar,notify:text=>{notice={text:String(text),time:Z.G.time};}});
    const names={bag:['背包','衣冠兵器 · 换装与整理'],pet:['宠物','结缘灵兽 · 并肩西游'],skill:['技能','大圣神通 · 修炼招式'],shop:['商店','行前备物 · 药水与修炼'],ach:['成就','西游历练 · 留下你的足迹'],set:['设置','声音、战斗表现与存档']};
    function frame(g,G) {
      const name=names[G.tab];
      const modalClick=G.dismantleConfirm&&G.tab==='bag'?Z.Input.mouse.clicked:null;
      if(modalClick!==null)Z.Input.mouse.clicked=false;
      g.save();g.fillStyle='rgba(19,30,29,.76)';g.fillRect(0,0,960,540);
      g.fillStyle='rgba(4,17,14,.42)';jadeShape(g,60,33,840,482,17);g.fill();
      const shell=g.createLinearGradient(60,26,900,508);shell.addColorStop(0,'#315644');shell.addColorStop(.48,'#183b31');shell.addColorStop(1,'#102c26');
      g.fillStyle=shell;jadeShape(g,60,26,840,482,17);g.fill();
      g.strokeStyle='#a99562';g.lineWidth=1.3;g.stroke();jadeTrim(g,64,30,832,474,'#7c8b65');
      // 书页内芯与玉石外框分层，内容之间用留白分组。
      panel(g,77,104,806,371,{fill:C.paper,border:'#bea973',r:3});
      g.fillStyle='rgba(255,248,213,.22)';g.fillRect(79,106,802,2);
      g.strokeStyle='rgba(168,184,142,.15)';g.lineWidth=1;
      for(let i=0;i<3;i++){g.beginPath();g.arc(748,70,49+i*18,-2.8,.05);g.stroke();}
      g.fillStyle='#385a44';jadeShape(g,82,42,48,48,10);g.fill();
      g.strokeStyle='#a08e5a';g.lineWidth=1;g.stroke();icon(g,G.tab,106,66,33);
      label(g,name[0],144,59,28,C.ink,'left',true);label(g,name[1],145,83,12,C.muted);
      g.fillStyle='#b74937';g.fillRect(144,94,29,2);
      if(button(g,835,47,39,34,'',{kind:'quiet',icon:'close'})){G.confirmReset=false;G.closePanel();g.restore();return;}
      P.drawers[G.tab](g,G);
      if(modalClick!==null)Z.Input.mouse.clicked=modalClick;
      if(G.dismantleConfirm&&G.tab==='bag')P.dismantle(g,G);
      const S=Z.Save.d;
      if(G.tab==='bag'||G.tab==='shop'){icon(g,'coin',101,490,23);label(g,U.fmt(S.gold),119,490,15,C.ink,'left',true);}
      if(G.tab==='bag'){
        icon(g,'stone',223,490,23);label(g,S.stones,241,490,15,C.ink,'left',true);
        const mats=S.materials||{};
        if(G.bagPage==='relic')label(g,Z.BAL.materialNames.cloudSilk+' '+U.fmt(mats.cloudSilk||0)+'  '+Z.BAL.materialNames.peachDew+' '+U.fmt(mats.peachDew||0)+'  '+Z.BAL.materialNames.seaPearl+' '+U.fmt(mats.seaPearl||0)+'  '+Z.BAL.materialNames.iron+' '+U.fmt(mats.iron||0)+'  '+Z.BAL.materialNames.wood+' '+U.fmt(mats.wood||0),302,490,11.5,C.muted);
        else label(g,(Z.BAL.materialNames.iron)+' '+U.fmt(mats.iron||0)+'   '+Z.BAL.materialNames.wood+' '+U.fmt(mats.wood||0),302,490,12,C.muted);
      }
      if(G.tab==='skill'){icon(g,'sp',101,490,23);label(g,'可用技能点  '+S.sp,119,490,14,C.jade,'left',true);}
      if(G.tab==='pet')label(g,'各自修行，出战随冒险积累经验',86,490,12,C.muted);
      if(G.tab==='ach')label(g,'每达成一项，自动奖励 2 个强化石',86,490,12,C.muted);
      if(G.tab==='set')label(g,'调整即时生效，冒险进度自动保存',86,490,12,C.muted);
      if(notice&&G.time-notice.time<2.6)label(g,notice.text,866,490,12,C.jade,'right',true);
      g.restore();
    }

    // 装备展示与整理
    {
      const { C, label, wrap, panel, button, icon, stage, rr } = P;
      const slots = ['weapon', 'head', 'armor', 'acc'];
      const itemKeys = ['atk', 'hp', 'mp', 'def', 'crit', 'hpRegen', 'mpRegen', 'atkPct', 'hpPct', 'cdr', 'ls', 'goldPct', 'spd'];
      const names = { atk: '攻击', hp: '生命', mp: '法力', maxHp: '生命', maxMp: '法力', def: '防御', crit: '暴击', hpRegen: '回血/秒', mpRegen: '回魔/秒', atkPct: '攻击加成', hpPct: '生命加成', cdr: '冷却缩减', ls: '吸血', goldPct: '金币加成', spd: '移速' };
      const qualityInk = ['#71665a', '#46794d', '#406f97', '#885897', '#aa7429'];
      const value = (k, n) => ['atkPct', 'hpPct', 'cdr', 'ls', 'goldPct'].includes(k) ? Math.round(n * 1000) / 10 + '%' : +(Number(n).toFixed(2)) + (k === 'crit' ? '%' : '');
      function find(uid) {
        const S = Z.Save.d;
        return Object.values(S.equip).find(it => it && it.uid === uid) || S.bag.find(it => it.uid === uid) || null;
      }
      function hit(x, y, w, h) {
        const m = Z.Input.mouse, hover = m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
        if (hover) P.hovering = true;
        if (hover && m.clicked) { m.clicked = false; Z.Audio.sfx('click'); return true; }
        return false;
      }
      function source(it) {
        const candidate = Z.BAL.gearDefs && Z.BAL.gearDefs[it.gearId];
        const def = candidate && candidate.base === it.base ? candidate : null;
        if (!def && it.rules === 3) return '来源 · 第 ' + (it.t + 1) + ' 阶历练随机掉落';
        const level = Z.BAL.levels[def ? def.stage : it.t];
        return '来源 · ' + (level ? level.name + (def && level.boss ? ' · ' + Z.BAL.bosses[level.boss].name : '随机掉落') : '西游历练');
      }
      function itemIcon(g, it, x, y, size, selected) {
        Z.Spr.drawItemIcon(g, it, x, y, size, { bg: '#e3ddbf', hidePlus: true });
        if (it.lv > 0) {
          g.save(); g.fillStyle = '#6c5840'; rr(g, x + size - 24, y + size - 15, 24, 14, 4); g.fill(); g.restore();
          label(g, '+' + it.lv, x + size - 12, y + size - 8, 10, '#fff6dc', 'center', true);
        }
        if (selected) {
          g.save(); g.strokeStyle = C.jade; g.lineWidth = 2; jadeShape(g, x - 2, y - 2, size + 4, size + 4, 5); g.stroke();
          g.fillStyle='#b74e36';g.beginPath();g.moveTo(x+size-3,y-3);g.lineTo(x+size+3,y+3);g.lineTo(x+size-3,y+9);g.lineTo(x+size-9,y+3);g.closePath();g.fill();g.restore();
        }
        if (it.locked === true) icon(g, 'lock', x + size - 9, y + 9, 13);
      }
      function choose(G, it) { G.selItem = it.uid; G.gearPreview = true; G.gearView = 'compare'; }
      function character(g, G, selected) {
        const S = Z.Save.d, slot = selected && Z.BAL.itemBases[selected.base].slot;
        const equipped = selected && S.equip[slot] && S.equip[slot].uid === selected.uid;
        const trying = selected && !equipped && G.gearPreview !== false;
        const gear = Object.assign({}, S.equip); if (trying) gear[slot] = selected;
        const facing = G.gearFacing === -1 ? -1 : 1;
        stage(g, 86, 114, 230, 352, { theme: 'hero' });
        label(g, '齐天大圣', 201, 134, 19, C.ink, 'center', true);
        label(g, trying ? '试穿所选 · 尚未穿戴' : '当前穿戴 · ' + S.lv + '级', 201, 158, 12, trying ? C.gold : C.jade, 'center');
        const model = Object.assign({}, G.player, { x: 0, y: 0, facing, state: 'idle', stateT: 0, vx: 0, vy: 0,
          animClock: G.time, onGround: true, skillAction: null, skillShadows: [], flashT: 0, invulnT: 0, dead: false, wu: 0,
          visual: { runPhase: 0, carry: 0, cape: 0, tail: 0 } });
        g.save(); rr(g, 92, 176, 218, 225, 7); g.clip();
        g.translate(201, 385); g.scale(2.25, 2.25); Z.Spr.drawWukong(g, model, gear); g.restore();
        const flash = Z.U.clamp(1 - (G.time - (G.gearEquippedAt == null ? -10 : G.gearEquippedAt)) / 1.2, 0, 1);
        if (flash && G.gearHighlightSlot) {
          const regions = { weapon: [201 + facing * 31, 294, 48, 72], head: [201, 240, 34, 30], armor: [201, 327, 36, 38], acc: [201 + facing * 7, 344, 19, 21] };
          const r = regions[G.gearHighlightSlot];
          if (r) { g.save(); g.globalAlpha *= flash; g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.ellipse(...r, 0, 0, Z.U.TAU); g.stroke(); g.restore(); }
        }
        slots.forEach((s, i) => {
          const x = i % 2 ? 258 : 100, y = i < 2 ? 210 : 316, it = S.equip[s];
          if (it) itemIcon(g, it, x, y, 44, selected && selected.uid === it.uid);
          else { panel(g, x, y, 44, 44, { fill: C.slot, r: 7 }); icon(g, s, x + 22, y + 22, 25); }
          panel(g,x-1,y+46,46,17,{fill:'rgba(247,240,210,.94)',border:false,r:2});
          label(g, Z.BAL.slotNames[s], x + 22, y + 55, 11, C.ink, 'center');
          if (it && hit(x, y, 44, 44)) choose(G, it);
          if (flash && G.gearHighlightSlot === s) { g.save(); g.globalAlpha *= flash; g.strokeStyle = C.gold; g.lineWidth = 3; rr(g, x - 3, y - 3, 50, 50, 8); g.stroke(); g.restore(); }
        });
        if (button(g, 145, 408, 54, 27, '朝左', { kind: facing === -1 ? 'secondary' : 'quiet', icon: 'left', size: 12 })) G.gearFacing = -1;
        if (button(g, 205, 408, 54, 27, '朝右', { kind: facing === 1 ? 'secondary' : 'quiet', icon: 'right', size: 12 })) G.gearFacing = 1;
        if (selected && !equipped) {
          if (button(g, 117, 441, 168, 22, trying ? '看当前穿戴' : '试穿这件装备', { kind: 'quiet', size: 12 })) G.gearPreview = !trying;
        } else {
          panel(g,100,440,202,22,{fill:'rgba(247,240,210,.94)',border:false,r:2});
          label(g, '选择两侧装备，可查看详情', 201, 451, 11, C.ink, 'center');
        }
      }
      function inventory(g, G) {
        const S = Z.Save.d;
        panel(g, 328, 114, 248, 352, { fill: C.paper });
        label(g, '行囊', 342, 125, 15, C.ink, 'left', true);
        label(g, S.bag.length + '/24', 385, 125, 12, S.bag.length >= 24 ? C.red : C.muted);
        const sorted = G.bagSort === 'quality';
        if (button(g, 497, 116, 70, 20, sorted ? '按品质' : '按拾取', { kind: 'quiet', icon: 'order', size: 11 })) G.bagSort = sorted ? 'pickup' : 'quality';
        const filters = ['all', ...slots], filter = filters.includes(G.bagFilter) ? G.bagFilter : 'all';
        filters.forEach((s, i) => {
          if (button(g, 329 + i * 46, 138, 44, 24, s === 'all' ? '全部' : Z.BAL.slotNames[s], { kind: filter === s ? 'secondary' : 'quiet', size: 12 })) G.bagFilter = s;
        });
        const list = S.bag.map((it, index) => ({ it, index })).filter(({ it }) => filter === 'all' || Z.BAL.itemBases[it.base].slot === filter);
        if (sorted) list.sort((a, b) => b.it.q - a.it.q || a.index - b.index);
        for (let i = 0; i < 24; i++) {
          const x = 352 + (i % 4) * 49, y = 172 + Math.floor(i / 4) * 49, it = list[i] && list[i].it;
          if (it) { itemIcon(g, it, x, y, 44, G.selItem === it.uid); if (hit(x, y, 44, 44)) choose(G, it); }
          else {
            g.save();g.fillStyle='#ded8bd';jadeShape(g,x,y,44,44,4);g.fill();
            g.strokeStyle='#c6c3a2';g.lineWidth=.7;g.stroke();
            g.strokeStyle='rgba(255,250,219,.55)';g.beginPath();g.moveTo(x+5,y+42);g.lineTo(x+39,y+42);g.stroke();g.restore();
          }
        }
        if (!list.length) {
          panel(g, 342, 259, 220, 65, { fill: C.paper, border: C.paper });
          label(g, S.bag.length ? '暂无该部位的装备' : '行囊空空，去历练吧', 452, 289, 13, C.muted, 'center');
        }
      }
      function comparison(g, G, selected, slot) {
        const S = Z.Save.d, mode = G.gearView === 'plus' ? 'plus' : G.gearView === 'item' ? 'item' : 'compare';
        ['compare', 'item', 'plus'].forEach((id, i) => {
          if (button(g, 602 + i * 89, 212, 84, 26, ['换装对比', '单件属性', '强化预览'][i], { kind: mode === id ? 'secondary' : 'quiet', size: 12 })) G.gearView = id;
        });
        const st = Z.BAL.itemStat(selected), current = S.equip[slot] ? Z.BAL.itemStat(S.equip[slot]) : {};
        const upgraded = Z.BAL.itemStat(Object.assign({}, selected, { lv: Math.min(Z.BAL.maxPlus, selected.lv + 1) }));
        const before = mode === 'compare' ? Z.Player.equipmentStats(S.equip, S.lv) : mode === 'plus' ? st : current;
        const after = mode === 'compare' ? Z.Player.equipmentStats(Object.assign({}, S.equip, { [slot]: selected }), S.lv) : mode === 'plus' ? upgraded : st;
        const allKeys = mode === 'compare' ? ['atk', 'maxHp', 'maxMp', 'def', 'crit', 'hpRegen', 'mpRegen', 'cdr', 'ls', 'goldPct', 'spd'] : itemKeys.filter(k => before[k] || after[k]);
        const overview=mode==='compare'&&!G.gearCompareAll;
        const changed=allKeys.filter(k=>Math.abs((after[k]||0)-(before[k]||0))>.0005);
        // 变化概览先显示代价，再显示收益；完整11项可随时展开，数据使用同一次真实换装计算。
        const keys=overview?changed.filter(k=>after[k]<before[k]).concat(changed.filter(k=>after[k]>before[k])).slice(0,5):allKeys;
        if(mode==='compare') {
          if(button(g,602,240,92,22,G.gearCompareAll?'全部属性 ▴':'全部属性 ▾',{kind:G.gearCompareAll?'secondary':'quiet',size:11}))G.gearCompareAll=!G.gearCompareAll;
        } else label(g,mode==='plus'?'单件属性':'同部位',602,251,11,C.muted);
        label(g, mode === 'plus' ? '当前' : '穿戴', 714, 251, 11, C.muted, 'right');
        label(g, mode === 'compare' ? '换装后' : mode === 'plus' ? '强化后' : '所选', 789, 251, 11, C.muted, 'right');
        label(g, '变化', 857, 251, 11, C.muted, 'right');
        keys.forEach((k, i) => {
          const spacing = overview?21:keys.length > 10 ? 12.3 : 14.5;
          const y = (overview?279:265) + i * spacing, delta = +((after[k] || 0) - (before[k] || 0)).toFixed(3);
          g.save();
          if(delta) {
            g.fillStyle=delta>0?'#dce5c8':'#ecd9c1';g.fillRect(599,y-6,261,spacing);
            g.fillStyle=delta>0?C.jade:C.red;g.fillRect(599,y-6,2,spacing);
          } else if(i%2===0){g.fillStyle='#ece8d1';g.fillRect(599,y-6,261,spacing);}
          g.restore();
          label(g, names[k], 604, y, overview?12.5:11.5, delta?C.ink:C.muted,'left',!!delta);
          label(g, value(k, before[k] || 0), 714, y, overview?13:12, C.muted, 'right');
          label(g, value(k, after[k] || 0), 789, y, overview?14:12, delta?C.ink:C.muted, 'right', !!delta);
          label(g, (delta > 0 ? '+' : '') + value(k, delta), 857, y, overview?13:11.5, delta > 0 ? C.jade : delta < 0 ? C.red : C.muted, 'right',!!delta);
        });
        if(overview) {
          if(!changed.length){label(g,'属性相同',731,309,23,C.ink,'center',true);label(g,'展开全部属性，查看完整穿戴数值',731,341,11,C.muted,'center');}
          else label(g,changed.length>5?'另 '+(changed.length-5)+' 项变化 · 展开全部属性查看':'只列出变化项 · 未列出的属性保持不变',731,386,10.5,C.muted,'center');
        }
        if (selected.locked === true) label(g, '锁定保护 · 不可出售或分解', 602, 397, 9.5, C.jade);
      }
      function transact(g, G, selected, slot, equipped) {
        const S = Z.Save.d, cost = Z.BAL.plusCost(selected.lv);
        const canPlus = selected.lv < Z.BAL.maxPlus && S.stones >= 1 && S.gold >= cost;
        if (button(g, 602, 404, 260, 28, selected.lv >= Z.BAL.maxPlus ? '已达强化上限' : '强化 · ' + cost + '金 / 1强化石', { kind: 'quiet', disabled: !canPlus, size: 13 })) {
          S.stones--; S.gold -= cost; selected.lv++; Z.Audio.sfx('stone'); Z.Save.save();
          if (G.player) G.player.recomputeStats(); Z.UI.toast('强化成功！' + Z.BAL.itemName(selected), Z.BAL.qualities[selected.q].c);
        }
        const full = equipped && S.bag.length >= 24;
        if (button(g, 602, 438, 122, 26, equipped ? full ? '行囊已满' : '卸下装备' : '穿戴装备', { kind: 'primary', disabled: full, size: 13 })) {
          if (equipped) { S.equip[slot] = null; S.bag.push(selected); G.gearPreview = false; G.gearHighlightSlot = null; }
          else {
            const index = S.bag.findIndex(it => it.uid === selected.uid);
            if (index < 0) return;
            S.bag.splice(index, 1); if (S.equip[slot]) S.bag.push(S.equip[slot]); S.equip[slot] = selected;
            G.gearPreview = false; G.gearEquippedAt = G.time; G.gearHighlightSlot = slot;
          }
          G.selItem = selected.uid; if (G.player) G.player.recomputeStats(); Z.Audio.sfx(equipped ? 'click' : 'buy'); Z.Save.save();
        }
        if (button(g, 736, 438, 64, 26, selected.locked === true ? '已锁定' : '售' + Z.BAL.itemValue(selected) + '金', { kind: 'danger', disabled: selected.locked === true, size: 11 })) {
          S.gold += Z.BAL.itemValue(selected);
          if (equipped) S.equip[slot] = null;
          else { const index = S.bag.findIndex(it => it.uid === selected.uid); if (index >= 0) S.bag.splice(index, 1); }
          G.selItem = null; G.gearInspect = false; if (G.player) G.player.recomputeStats(); Z.Audio.sfx('coin'); Z.Save.save();
        }
        if (button(g, 804, 438, 58, 26, '分解', { kind: 'quiet', disabled: equipped || selected.locked === true, size: 12 })) G.dismantleConfirm = { uid: selected.uid };
      }
      function details(g, G, selected) {
        panel(g, 588, 114, 286, 352, { fill: C.light });
        if (!selected) {
          icon(g,'bag',731,181,46);label(g,'看看带回了什么',731,227,21,C.ink,'center',true);
          wrap(g,'选择行囊中的装备，比较属性，也能直接试穿。',631,259,200,{size:13,maxLines:3});
          const stats=Z.Player.equipmentStats(Z.Save.d.equip,Z.Save.d.lv);
          label(g,'当前战力',604,323,12,C.jade,'left',true);
          [['攻击',stats.atk],['生命',stats.maxHp],['法力',stats.maxMp],['防御',stats.def]].forEach(([n,v],i)=>{
            const x=604+(i%2)*134,y=349+Math.floor(i/2)*54;
            label(g,n,x,y,11,C.muted);label(g,String(v),x+106,y+20,21,C.ink,'right',true);
          });
          return;
        }
        const S = Z.Save.d, slot = Z.BAL.itemBases[selected.base].slot;
        const equipped = !!(S.equip[slot] && S.equip[slot].uid === selected.uid);
        itemIcon(g, selected, 602, 126, 58, false);
        const name = Z.BAL.itemName(selected);
        wrap(g, name, 671, 142, 142, { size: name.length > 11 ? 12 : 15, color: qualityInk[selected.q], maxLines: 1 });
        label(g, Z.BAL.qualities[selected.q].n + ' · ' + (selected.t + 1) + '阶 · +' + selected.lv, 671, 164, 12, C.muted);
        const before=Z.Player.equipmentStats(S.equip,S.lv),after=Z.Player.equipmentStats(Object.assign({},S.equip,{[slot]:selected}),S.lv);
        const changes=['atk','maxHp','maxMp','def','crit','hpRegen','mpRegen','cdr','ls','goldPct','spd'].map(k=>after[k]-before[k]);
        const gains=changes.filter(v=>v>.0005).length,losses=changes.filter(v=>v<-.0005).length;
        label(g,equipped?'已穿戴':gains||losses?(gains?gains+' 项提升':'')+(gains&&losses?' · ':'')+(losses?losses+' 项下降':''):'属性相同',671,182,11,losses?C.red:C.jade,'left',true);
        if (button(g, 823, 174, 38, 29, '', { kind: 'quiet', icon: selected.locked ? 'unlock' : 'lock' })) {
          if (selected.locked === true) delete selected.locked; else selected.locked = true; Z.Save.save();
        }
        if (button(g, 823, 124, 38, 29, '', { kind: 'quiet', icon: 'inspect' }) || hit(602, 126, 58, 58)) G.gearInspect = true;
        wrap(g, source(selected), 602, 195, 214, { size: 10.5, lineHeight: 13, maxLines: 1 });
        comparison(g, G, selected, slot); transact(g, G, selected, slot, equipped);
      }
      function inspect(g, G, selected) {
        stage(g, 86, 114, 490, 352, { theme: 'hero' });
        label(g, '衣冠兵器 · 单件检视', 331, 137, 17, C.ink, 'center', true);
        Z.Spr.drawItemIcon(g, selected, 205, 160, 252, { bg: '#e9dec6', hidePlus: true });
        if (selected.locked === true) icon(g, 'lock', 437, 180, 23);
        label(g, '形制放大展示', 331, 441, 12, C.muted, 'center');
        panel(g, 588, 114, 286, 352, { fill: C.light });
        const name = Z.BAL.itemName(selected);
        label(g, name, 608, 140, name.length > 11 ? 14 : 17, qualityInk[selected.q], 'left', true);
        label(g, Z.BAL.slotNames[Z.BAL.itemBases[selected.base].slot] + ' · ' + Z.BAL.qualities[selected.q].n + ' · 强化 +' + selected.lv, 608, 165, 13, C.muted);
        wrap(g, source(selected), 608, 190, 244, { size: 12, lineHeight: 17, maxLines: 2 });
        const st = Z.BAL.itemStat(selected);
        itemKeys.filter(k => st[k]).forEach((k, i) => { label(g, names[k], 608, 239 + i * 16, 13, C.ink); label(g, value(k, st[k]), 851, 239 + i * 16, 14, C.ink, 'right', true); });
        label(g, selected.locked === true ? '锁定保护 · 可以强化与穿戴' : '返回行囊，可继续试穿与整理', 731, 409, 11, C.muted, 'center');
        if (button(g, 644, 426, 176, 28, '返回行囊', { kind: 'primary', icon: 'left', size: 13 })) G.gearInspect = false;
      }
      P.dismantle = (g, G) => {
        const uid=G.dismantleConfirm.uid, S=Z.Save.d;
        const it=S.bag.find(item=>item.uid===uid);
        if(!it||it.locked===true||Object.values(S.equip).some(item=>item&&item.uid===uid)){
          G.dismantleConfirm=null;Z.Input.mouse.clicked=false;P.notify('物品状态已改变，分解已取消');return;
        }
        const result=Z.BAL.dismantleYield(it),spent=Z.BAL.enhancementSpent(it);
        g.save();g.fillStyle='rgba(42,39,30,.58)';g.fillRect(65,31,830,472);g.restore();
        panel(g,242,133,476,312,{fill:C.light,border:C.line,r:14});
        label(g,'分解这件装备？',480,162,22,C.ink,'center',true);
        itemIcon(g,it,270,187,52,false);
        label(g,Z.BAL.itemName(it),340,204,17,qualityInk[it.q],'left',true);
        label(g,'消耗 1 件 · 装备消失，无法撤销',340,229,12,C.red);
        panel(g,266,254,428,82,{fill:'#edf0e1',border:'#c8d2bb',r:8});
        const materials=Object.entries(result.materials).filter(([,n])=>n>0).map(([id,n])=>Z.BAL.materialNames[id]+' ×'+n).join('   ');
        label(g,'获得材料',282,275,12,C.muted);label(g,materials,388,275,15,C.jade,'left',true);
        label(g,'返还强化投入',282,307,12,C.muted);label(g,result.gold+' 金币  /  '+result.stones+' 强化石',388,307,14,C.ink,'left',true);
        label(g,spent.gold||spent.stones?'未返还：'+(spent.gold-result.gold)+' 金币 / '+(spent.stones-result.stones)+' 强化石':'未强化装备 · 没有强化投入损失',282,355,12,C.muted);
        label(g,'材料独立堆叠 · 法宝培养与合成可用',282,377,12,C.muted);
        if(button(g,282,400,160,30,'保留装备',{kind:'primary',size:14}))G.dismantleConfirm=null;
        else if(button(g,478,400,196,30,'确认分解',{kind:'danger',size:14})){
          const done=Z.Save.dismantle(uid);
          if(done.ok){G.dismantleConfirm=null;G.selItem=null;G.gearInspect=false;G.gearPreview=false;Z.Audio.sfx('stone');P.notify('分解完成 · '+materials);}
          else P.notify(done.reason||'分解未保存，请重试');
        }
        // Consume clicks on the veil too, so no later UI receives this gesture.
        Z.Input.mouse.clicked=false;
      };

      /* ---- 法宝修炼：合成、装备与培养；换装类操作限定地图或安全休整处 ---- */
      const relicOrder = Object.keys(Z.BAL.relicDefs);
      const relicTypeNames = { shield: '护身', heal: '回春', tide: '潮涌' };
      const relicFlavors = {
        cloud_umbrella: '撑开玄云，短时吸收伤害；护盾耗尽才溢出，破裂即散。',
        jade_leaf: '青枝灵叶化入周身，数秒之间缓缓回春。',
        sea_tide_pearl: '掷出碧海之力，潮涌环绕自身，伤敌并震退。',
      };
      const relicSource = { cloud_umbrella: '南天门', jade_leaf: '蟠桃园', sea_tide_pearl: '东海海滩' };
      const relicElementInks = { '金': '#b58a2e', '木': '#4d8a4a', '水': '#3f83b8', '火': '#c05a3c', '土': '#96703a' };
      const materialOf = { cloud_umbrella: 'cloudSilk', jade_leaf: 'peachDew', sea_tide_pearl: 'seaPearl' };
      function elementPassive(relic, st) {
        if (relic.element === '金') return '攻击 +' + st.atk;
        if (relic.element === '木') return '法宝数值 +10%';
        if (relic.element === '水') return '法力 +' + st.mp;
        if (relic.element === '火') return '生命 +' + st.hp;
        return '防御 +' + st.def;
      }
      function relicBrief(relic, st) {
        if (st.type === 'shield') return '护盾 ' + st.shield + ' · 持续 ' + st.duration + ' 秒';
        if (st.type === 'tide') return '潮涌 ' + Math.round(st.dmgMul * 100) + '% 攻击 · 范围';
        return '回春 ' + st.heal + ' · 持续 ' + st.duration + ' 秒';
      }
      function relicDrawer(g, G) {
        const S = Z.Save.d, manage = Z.Save.canManageRelics();
        const selId = relicOrder.includes(G.selRelic) ? G.selRelic
          : ((S.relics.owned.find(r => r.uid === S.relics.active) || S.relics.owned[0] || {}).id) || relicOrder[0];
        // 法宝卡（最多三张）：已持有显示实态，未合成显示配方剪影
        const cardH = 106, cardGap = 9;
        relicOrder.forEach((id, i) => {
          const def = Z.BAL.relicDefs[id], x = 86, y = 118 + i * (cardH + cardGap);
          const relic = S.relics.owned.find(r => r.id === id);
          const active = relic && S.relics.active === relic.uid;
          const st = relic ? Z.BAL.relicStats(relic) : null;
          panel(g, x, y, 382, cardH, { fill: relic ? C.light : '#efeadb', border: selId === id ? C.gold : C.line, r: 11 });
          Z.Spr.drawRelicIcon(g, relic || { id }, x + 40, y + 44, 52, relic ? {} : { silhouette: true });
          // 选择热区只覆盖信息区，不吞掉底部操作按钮的点击
          if (hit(x + 14, y + 10, 354, 64)) G.selRelic = id;
          if (relic) {
            label(g, def.name, x + 78, y + 24, 15.5, C.ink, 'left', true);
            label(g, relicTypeNames[def.type] + '法宝' + (active ? ' · 装备中' : ''), x + 78, y + 42, 11, active ? C.gold : C.muted);
            label(g, 'Lv.' + relic.lv + ' · 五行 ' + relic.element + ' · 成长 ' + Math.round(relic.growth * 100) + '%',
              x + 78, y + 58, 10.5, relicElementInks[relic.element] || C.muted);
            label(g, relicBrief(relic, st) + ' · 耗蓝 ' + st.cost, x + 78, y + 74, 11, C.ink, 'left', true);
            const cost = Z.BAL.relicUpgradeCost(relic.lv, relic.id);
            const mat = cost ? Z.BAL.materialNames[cost.material.id] : '';
            if (button(g, x + 14, y + 80, 70, 22, active ? '卸下' : '装备', { kind: active ? 'quiet' : 'primary', disabled: !manage, size: 12 })) {
              const r = Z.Save.equipRelic(active ? null : relic.uid);
              if (r.ok) { if (G.player) G.player.recomputeStats(); Z.Audio.sfx('buy'); P.notify(active ? '已收起 ' + def.name : def.name + ' 已装备 · 战斗中按 R 释放'); }
              else P.notify(r.reason);
            }
            if (button(g, x + 90, y + 80, 278, 22, !cost ? '已达最高等级' :
              '培养Lv.' + (relic.lv + 1) + ' · ' + cost.gold + '金+' + cost.stones + '石+' + mat + '×' + cost.material.count,
              { kind: 'secondary', disabled: !manage || !cost || S.gold < cost.gold || S.stones < cost.stones ||
                (S.materials[cost.material.id] || 0) < cost.material.count, size: 11 })) {
              const r = Z.Save.upgradeRelic(relic.uid);
              if (r.ok) { if (G.player) G.player.recomputeStats(); Z.Audio.sfx('stone'); P.notify(def.name + ' 培养到 Lv.' + r.relic.lv); }
              else P.notify(r.reason);
            }
          } else {
            const mat = materialOf[id], need = def.recipe.materials[mat], lack = (S.materials[mat] || 0) < need || S.gold < def.recipe.gold;
            label(g, def.name, x + 78, y + 24, 15.5, C.muted, 'left', true);
            label(g, relicTypeNames[def.type] + '法宝 · 尚未合成', x + 78, y + 42, 11, C.muted);
            label(g, '配方 · ' + Z.BAL.materialNames[mat] + ' ×' + need + '　金币 ' + def.recipe.gold, x + 78, y + 60, 12, C.ink);
            label(g, '通关' + relicSource[id] + '获得' + Z.BAL.materialNames[mat], x + 78, y + 76, 10.5, C.muted);
            if (button(g, x + 14, y + 80, 354, 22, !manage ? '需在地图或安全休整处合成' : lack ? Z.BAL.materialNames[mat] + '或金币不足' : '合成 · ' + def.name,
              { kind: 'primary', disabled: !manage || lack, size: 12 })) {
              const r = Z.Save.craftRelic(id);
              if (r.ok) { G.selRelic = id; Z.Audio.sfx('stone'); P.notify('合成成功 · ' + def.name + '，装备后按 R 释放'); }
              else P.notify(r.reason);
            }
          }
        });
        // 右侧详情：所选法宝的完整数值、培养预览与释放说明
        panel(g, 486, 114, 388, 352, { fill: C.light, border: C.line, r: 12 });
        const def = Z.BAL.relicDefs[selId];
        const relic = S.relics.owned.find(r => r.id === selId);
        Z.Spr.drawRelicIcon(g, relic || { id: selId }, 680, 190, 116, relic ? {} : { silhouette: true });
        label(g, def.name, 680, 266, 21, C.ink, 'center', true);
        label(g, relicTypeNames[def.type] + '法宝 · ' + (relic ? 'Lv.' + relic.lv + ' · 五行 ' + relic.element : '未合成'), 680, 288, 12.5, C.muted, 'center');
        wrap(g, relicFlavors[selId], 512, 316, 336, { size: 12.5, color: C.ink, lineHeight: 17, maxLines: 2 });
        let rows;
        if (relic) {
          const st = Z.BAL.relicStats(relic), cost = Z.BAL.relicUpgradeCost(relic.lv, relic.id);
          const next = cost ? Z.BAL.relicStats({ ...relic, lv: relic.lv + 1 }) : null;
          const main = st.type === 'shield' ? '护盾值' : st.type === 'tide' ? '潮涌倍率' : '回春总量';
          const mainV = st.type === 'shield' ? st.shield : st.type === 'tide' ? Math.round(st.dmgMul * 100) + '%' : st.heal;
          const mainN = next ? (next.type === 'shield' ? next.shield : next.type === 'tide' ? Math.round(next.dmgMul * 100) + '%' : next.heal) : null;
          rows = [
            [main, mainV + (next ? ' → ' + mainN : '')],
            ['释放 / 消耗', 'R · ' + (st.type === 'tide' ? '即时' : st.duration + '秒') + ' · 法力' + st.cost + ' · 调息' + st.cd + '秒'],
            ['五行 · ' + relic.element, elementPassive(relic, st)],
            ['成长率', Math.round(relic.growth * 100) + '%（合成时定型）'],
            ['培养材料', cost ? Z.BAL.materialNames[cost.material.id] + ' ×' + cost.material.count + '（分解装备获得）' : '已达最高等级'],
          ];
        } else {
          const mat = materialOf[selId];
          rows = [
            ['配方', Z.BAL.materialNames[mat] + ' ×' + def.recipe.materials[mat] + ' + 金币 ' + def.recipe.gold],
            ['材料来源', '通关' + relicSource[selId] + '结算必得'],
            ['培养材料', '精铁（伞/珠）/ 灵木（叶）· 分解装备获得'],
            ['持有上限', '每种一件，一次装备一件'],
          ];
        }
        rows.forEach(([k, v], i) => {
          const y = 350 + i * 19;
          if (i % 2 === 0) { g.save(); g.fillStyle = '#f4eedf'; g.fillRect(498, y - 8, 364, 19); g.restore(); }
          label(g, k, 508, y, 12, C.muted);
          label(g, String(v), 852, y, 12, C.ink, 'right', true);
        });
        if (manage) label(g, '战斗中按 R 释放 · 地图或安全休整处可换装与培养', 680, 456, 11, C.jade, 'center');
        else label(g, '前方未平 · 回到地图或清场后的灵泉处即可修炼', 680, 456, 11, C.red, 'center');
      }
      P.drawers.bag = (g, G) => {
        const page = G.bagPage === 'relic' ? 'relic' : 'gear';
        // 双页签放在标题区右侧，避开 v60 起特意留空的旧关闭位（约 x785..840）
        if (button(g, 630, 55, 72, 30, '装备整理', { kind: page === 'gear' ? 'secondary' : 'quiet', size: 12 })) { G.bagPage = 'gear'; G.gearInspect = false; }
        if (button(g, 706, 55, 72, 30, '法宝修炼', { kind: page === 'relic' ? 'secondary' : 'quiet', size: 12 })) G.bagPage = 'relic';
        // v74 推荐配装：页面级动作按钮，放在页签左侧标题区空白处（约 x320..620 无热区）；hover 旁注说明口径
        if (page === 'gear') {
          const hm = Z.Input.mouse;
          if (hm.x >= 546 && hm.x < 622 && hm.y >= 55 && hm.y < 85)
            label(g, '稳妥配装：补空槽或各项不降，取舍请手动比较', 584, 94, 10, C.muted, 'center');
          if (button(g, 546, 55, 76, 30, '推荐配装', { kind: 'primary', size: 13 })) {
            const r = Z.Save.autoEquipBest();
            if (!r.ok) { Z.UI.toast(r.reason || '配装未保存，请重试', '#ffb28b'); }
            else if (r.swaps.length) {
              if (G.player) G.player.recomputeStats();
              Z.Audio.sfx('buy'); Z.UI.toast('稳妥配装 · 已调整 ' + r.swaps.length + ' 件，各项属性不降', '#ffd75e');
              G.selItem = null; G.gearInspect = false; G.gearPreview = false;
            } else { Z.Audio.sfx('click'); Z.UI.toast('没有无需取舍的升级，可手动比较装备', '#9fd8c0'); }
          }
        }
        if (page === 'relic') { relicDrawer(g, G); return; }
        const selected = find(G.selItem);
        if (G.gearInspect && selected) { inspect(g, G, selected); return; }
        character(g, G, selected); inventory(g, G); details(g, G, selected);
      };
    }

    // 伙伴与神通
    {
      const { C, label, wrap, panel, button, icon, stage, bar } = P;
      const skillIds = ['hy', 'jd', 'qs'];
      const roles = { melee: '近身助战', ranged: '远程助战', heal: '疗伤伙伴' };
      const skillNotes = {
        hy: '双手重斩，集中落棍。接七十二斩时，残影同步落棍。',
        jd: '短暂无敌的闪行。按住方向选择切入或撤离。',
        qs: '三棍短连打，前两击留影。首棍命中后可预约重斩。',
      };

      function separator(g, x, y, w) {
        g.save();
        g.strokeStyle = C.line; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
        g.restore();
      }

      function petPortrait(g, pid, x, y, scale, clock, lv, muted = false, actionAge = null) {
        const duration = pid === 'hou' ? .24 : pid === 'tu' ? .5 : .28;
        const action = pid === 'hou' ? 'melee' : pid === 'tu' ? 'heal' : 'shoot';
        const pet = { x: 0, y: 0, facing: 1, ptype: pid, lv, animClock: clock, groundY: 0,
          visualAction: actionAge == null ? '' : action,
          visualActionT: actionAge == null ? 0 : actionAge, visualActionDur: duration };
        g.save();
        if (muted) g.globalAlpha *= .48;
        g.translate(x, y); g.scale(scale, scale);
        Z.Spr.drawPetUnit(g, pet, clock);
        g.restore();
      }

      P.drawers.pet = (g, G) => {
        const S = Z.Save.d, ids = Object.keys(Z.BAL.pets), owned = S.pets.owned;
        const selected = ids.includes(G.selPet) ? G.selPet : S.pets.active || owned[0] || ids[0];
        const grow = pid => S.pets.growth && S.pets.growth[pid] || { lv: 1, exp: 0 };
        const growth = grow(selected), def = Z.BAL.pets[selected];
        const got = owned.includes(selected), active = S.pets.active === selected;
        const lv = growth.lv, need = Z.BAL.expNeed(lv), clock = G.time || 0;

        label(g, '伙伴名册', 104, 126, 15, C.jade, 'left', true);
        for (let i = 0; i < ids.length; i++) {
          const pid = ids[i], y = 143 + i * 74, petDef = Z.BAL.pets[pid];
          const picked = selected === pid, has = owned.includes(pid), fighting = S.pets.active === pid;
          if (button(g, 96, y, 166, 65, '', { kind: 'secondary' })) {
            G.selPet = pid; G.uiPetDemoAt = null;
          }
          if (picked) {
            panel(g, 96, y, 166, 65, { fill: '#e4eee3', border: C.jade, r: 9 });
            g.fillStyle = C.jade; P.rr(g, 96, y + 9, 4, 47, 2); g.fill();
          }
          g.save(); P.rr(g, 103, y + 5, 49, 55, 7); g.clip();
          petPortrait(g, pid, 127, y + (pid === 'he' || pid === 'long' ? 66 : 53),
            pid === 'he' ? .9 : 1, clock, grow(pid).lv, !has);
          g.restore();
          label(g, petDef.name, 157, y + 23, 17, has ? C.ink : C.muted, 'left', true);
          label(g, has ? (fighting ? '出战中' : '已结缘') + ' · ' + grow(pid).lv + '级' : '未结缘',
            157, y + 46, 12, fighting ? C.jade : C.muted);
        }
        label(g, '已结缘 ' + owned.length + ' / ' + ids.length, 179, 451, 13, C.muted, 'center');

        label(g, def.name, 412, 132, 25, C.ink, 'center', true);
        label(g, roles[def.type], 412, 154, 14, C.jade, 'center');
        stage(g, 278, 166, 268, 234, { theme: 'pet' });
        g.save(); P.rr(g, 283, 171, 258, 222, 10); g.clip();
        const elapsed = G.uiPetDemoAt == null ? -1 : clock - G.uiPetDemoAt;
        const actionAge = elapsed >= 0 && elapsed < 2.4 ? elapsed % .8 : null;
        const scales = { hou: 3.8, tu: 3.4, he: 3.4, long: 3.7 };
        const baselines = { hou: 370, tu: 370, he: 389, long: 378 };
        petPortrait(g, selected, 414, baselines[selected], scales[selected], clock, lv, false, actionAge);
        g.restore();
        if (button(g, 340, 405, 144, 28, '招式展示', { kind: 'quiet', icon: 'skill', size: 13 })) {
          G.uiPetDemoAt = clock;
        }
        const source = Z.BAL.levels.find(l => l.boss && Z.BAL.bosses[l.boss].petball === selected);
        const note = got ? '出战伙伴独立获得冒险经验' : source ? '结缘：首胜' + source.name + '后拾取宠物球' : '在冒险途中与它结缘';
        wrap(g, note, 286, 444, 252, { size: 12, color: C.muted, lineHeight: 16, maxLines: 2 });

        panel(g, 562, 116, 302, 344, { fill: C.light, border: C.line, r: 12 });
        label(g, '修行成长', 578, 140, 16, C.jade, 'left', true);
        label(g, lv + '级', 844, 140, 22, C.ink, 'right', true);
        bar(g, 578, 153, 270, 8, got ? Z.U.clamp(growth.exp / need, 0, 1) : 0, C.jade);
        label(g, got ? '经验 ' + growth.exp + ' / ' + need : '结缘后开启独立修行', 578, 180, 13, C.muted);
        icon(g, def.type === 'heal' ? 'hp' : 'attack', 578, 208, 21);
        const potency = def.type === 'heal' ? '疗伤 ' + Math.round((lv >= 5 ? .13 : def.heal) * 100) + '%生命'
          : '助战伤害 ' + Math.round(def.dmg * (1 + Z.BAL.petDmgPerLv * (lv - 1)));
        label(g, potency, 606, 208, 14, C.ink, 'left', true);
        label(g, '间隔 ' + def.cd + '秒', 844, 208, 13, C.muted, 'right');
        separator(g, 578, 222, 270);
        for (let i = 0; i < def.skills.length; i++) {
          const sk = def.skills[i], unlocked = got && lv >= sk.lv, y = 237 + i * 57;
          icon(g, unlocked ? 'check' : 'lock', 578, y + 14, 22);
          label(g, sk.n, 609, y + 14, 15, unlocked ? C.ink : C.muted, 'left', true);
          label(g, unlocked ? '已领悟' : sk.lv + '级解锁', 844, y + 13, 12, unlocked ? C.jade : C.muted, 'right');
          wrap(g, sk.d, 609, y + 33, 233, { size: 13, color: C.muted, lineHeight: 16, maxLines: 2 });
        }
        if (button(g, 578, 423, 270, 32, active ? '正在随你冒险' : got ? '出战助阵' : '尚未结缘',
          { kind: 'primary', disabled: !got || active, icon: active ? 'check' : 'pet', size: 15 })) {
          S.pets.active = selected;
          Z.Audio.sfx('pet'); Z.Save.save();
          if (G.level) G.setPet(selected);
        }
      };

      function skillActor(G, id, t) {
        const def = Z.BAL.skills[id], action = { hy: 'heavy', jd: 'flash', qs: 'slash' }[id];
        const p = { ...G.player, x: 0, y: 0, groundY: 0, facing: 1, vx: 0, vy: 0,
          onGround: true, dead: false, invulnT: 0, flashT: 0, hitstun: 0,
          state: { hy: 'cast', jd: 'dash', qs: 'spin' }[id], stateT: t, stateDur: def.dur,
          skillAction: action, animClock: G.time || 0, actionBuffer: null,
          heavyLinked: false, heavyHitTime: Z.BAL.skills.hy.hitTime, heavyDur: Z.BAL.skills.hy.dur,
          linkReady: false, skillShadows: [], cds: { hy: 0, jd: 0, qs: 0 },
          visual: { ...G.player?.visual, carry: 0, pose: null, poseFrom: null, flip: null } };
        if (t < 0 || t >= def.dur) { p.skillAction = null; p.state = 'idle'; p.stateT = 0; }
        if (id === 'qs' && p.skillAction) {
          for (let beat = 0; beat < 2; beat++) {
            const hit = Z.BAL.skillCombo.slashBeats[beat].time;
            if (t < hit) continue;
            const frozen = { ...p, stateT: hit, skillShadows: [] };
            p.skillShadows.push({ x: -38 - beat * 30, y: 0, facing: 1, strikeFacing: 1,
              age: t - hit, life: 1, lifeMax: 1, striking: false,
              pose: Z.Spr.sampleWukongPose(frozen, p.animClock), visual: { ...p.visual } });
          }
        }
        return p;
      }

      P.drawers.skill = (g, G) => {
        const S = Z.Save.d, growth = Z.BAL.skillGrowth;
        const id = skillIds.includes(G.selSkill) ? G.selSkill : 'hy';
        const def = Z.BAL.skills[id], lv = S.skills[id] || 1, maxed = lv >= growth.maxLv;
        label(g, '所修神通', 104, 130, 15, C.jade, 'left', true);
        for (let i = 0; i < skillIds.length; i++) {
          const sid = skillIds[i], y = 149 + i * 91, picked = id === sid;
          if (button(g, 96, y, 168, 78, '', { kind: 'secondary' })) {
            G.selSkill = sid; G.uiSkillDemoAt = G.time || 0;
          }
          if (picked) panel(g, 96, y, 168, 78, { fill: '#e4eee3', border: C.jade, r: 9 });
          Z.Spr.drawSkillIcon(g, sid, 109, y + 16, 44, 0);
          label(g, Z.BAL.skills[sid].name, 164, y + 32, 16, C.ink, 'left', true);
          label(g, (S.skills[sid] || 1) + ' / ' + growth.maxLv + '级', 164, y + 56, 13, C.muted);
        }
        label(g, def.name, 278, 136, 25, C.ink, 'left', true);
        wrap(g, skillNotes[id], 278, 163, 268, { size: 14, color: C.muted, lineHeight: 21, maxLines: 3 });
        stage(g, 278, 222, 268, 157, { theme: 'skill' });
        g.save(); P.rr(g, 282, 226, 260, 149, 10); g.clip();
        const clock = G.time || 0, since = clock - (G.uiSkillDemoAt || 0);
        const t = (since % 2.4 - .2) / 1.6;
        const p = skillActor(G, id, t);
        g.translate(id === 'qs' ? 422 : id === 'jd' ? 423 : 396, 359); g.scale(1.35, 1.35);
        Z.Spr.drawWukong(g, p);
        g.restore();
        if (button(g, 334, 389, 156, 28, '重看招式', { kind: 'quiet', icon: 'skill', size: 13 })) {
          G.uiSkillDemoAt = clock;
        }

        panel(g, 562, 116, 302, 301, { fill: C.light, border: C.line, r: 12 });
        label(g, '修炼增益', 578, 142, 17, C.jade, 'left', true);
        label(g, '当前 ' + lv + '级', 688, 175, 14, C.ink, 'center', true);
        label(g, maxed ? '已圆满' : '下级 ' + (lv + 1) + '级', 808, 175, 14, maxed ? C.gold : C.jade, 'center', true);
        const cdr = G.player?.cdr || 0;
        const damage = G.player ? G.player.skillDmg(id) : def.dmg * (1 + growth.dmgPerLv * (lv - 1));
        const cooldown = G.player ? G.player.skillCd(id) : def.cd * Math.pow(1 - growth.cdCut, lv - 1) * (1 - cdr);
        const nextDamage = def.dmg * (1 + growth.dmgPerLv * lv);
        const nextCooldown = def.cd * Math.pow(1 - growth.cdCut, lv) * (1 - cdr);
        const rows = [
          { n: '法力', icon: 'mp', now: String(def.mp), next: String(def.mp), changed: false },
          { n: '伤害', icon: 'attack', now: damage.toFixed(2) + '×', next: nextDamage.toFixed(2) + '×', changed: true },
          { n: '冷却', icon: 'time', now: cooldown.toFixed(2) + '秒', next: nextCooldown.toFixed(2) + '秒', changed: true },
        ];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i], y = 211 + i * 43;
          icon(g, row.icon, 578, y, 21);
          label(g, row.n, 606, y, 14, C.muted);
          label(g, row.now, 688, y, 18, C.ink, 'center', true);
          label(g, '→', 748, y, 17, C.line, 'center');
          label(g, maxed ? '—' : row.next, 808, y, 18, row.changed ? C.jade : C.muted, 'center', true);
        }
        separator(g, 578, 315, 270);
        label(g, '冷却已计入当前装备的缩减', 578, 336, 12, C.muted);
        label(g, maxed ? '此招已修炼至满级' : S.sp > 0 ? '本次消耗 1 技能点' : '技能点不足，角色升级后获得',
          578, 356, 13, maxed ? C.gold : S.sp > 0 ? C.muted : C.red);
        if (button(g, 578, 373, 270, 32, maxed ? '神通已圆满' : '修炼至 ' + (lv + 1) + '级',
          { kind: 'primary', disabled: maxed || S.sp <= 0, icon: 'skill', size: 15 })) {
          S.sp--; S.skills[id] = lv + 1;
          Z.Audio.sfx('levelup'); Z.Save.save();
        }
        separator(g, 278, 427, 586);
        Z.Spr.drawSkillIcon(g, 'qs', 278, 437, 22, 0);
        label(g, '七十二斩', 308, 454, 14, C.ink, 'left', true);
        label(g, '→', 384, 454, 20, C.gold);
        Z.Spr.drawSkillIcon(g, 'hy', 413, 437, 22, 0);
        label(g, '重斩', 443, 454, 14, C.ink, 'left', true);
        wrap(g, '首棍命中可预约，末棍命中后接棒；残影同步落棍。', 514, 441, 344,
          { size: 13, color: C.muted, lineHeight: 17, maxLines: 2 });
      };
    }

    // 仙坊、历练与设置
    {
      const { C, label, wrap, panel, button, icon, rr } = P;
      const inside = (m, x, y, w, h) => m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;

      // 原创药瓶与仙材插画；尺寸按实际陈列卡设计，不改正式道具图标。
      function productArt(g, id, x, y) {
        g.save();
        g.translate(x, y);
        if(productAtlas && productRects[id]) {
          const r=productRects[id],s=Math.min(84/r[2],84/r[3]),w=r[2]*s,h=r[3]*s;
          g.drawImage(productAtlas,...r,-w/2,-h/2,w,h);g.restore();return;
        }
        g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 1.8;
        g.fillStyle = 'rgba(90,65,30,.10)';
        g.beginPath(); g.ellipse(0, 39, 33, 7, 0, 0, Math.PI * 2); g.fill();
        if (id === 'stone') {
          g.fillStyle = '#6aa99b'; g.strokeStyle = '#436e63';
          g.beginPath(); g.moveTo(0, -38); g.lineTo(28, -13); g.lineTo(22, 29);
          g.lineTo(0, 41); g.lineTo(-22, 29); g.lineTo(-28, -13); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = '#b5d6bc';
          g.beginPath(); g.moveTo(0, -35); g.lineTo(13, -9); g.lineTo(0, 6); g.lineTo(-17, -11); g.closePath(); g.fill();
          g.fillStyle = '#4c897c';
          g.beginPath(); g.moveTo(13, -9); g.lineTo(25, -12); g.lineTo(20, 27); g.lineTo(0, 38); g.lineTo(0, 6); g.closePath(); g.fill();
          g.strokeStyle = '#edf2d0'; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(-13, -17); g.lineTo(-3, -27); g.stroke();
          g.strokeStyle = '#b5d6bc'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(-22, 28); g.lineTo(0, 6); g.lineTo(22, 29); g.stroke();
        } else {
          const kind = id === 'potion_mp' ? 'mp' : id === 'bighp' ? 'both' : 'hp';
          const tint = kind === 'mp' ? '#87b5c7' : kind === 'both' ? '#b0bc94' : '#d3a395';
          const shade = kind === 'mp' ? '#548197' : kind === 'both' ? '#728268' : '#a76657';
          const gr = g.createLinearGradient(-27, 0, 25, 0);
          gr.addColorStop(0, shade); gr.addColorStop(.32, tint); gr.addColorStop(.7, '#e3dac1'); gr.addColorStop(1, shade);
          g.fillStyle = gr; g.strokeStyle = '#695f4b';
          g.beginPath(); g.moveTo(-10, -28); g.lineTo(-10, -15);
          g.bezierCurveTo(-13, -8, -28, -9, -28, 10);
          g.bezierCurveTo(-29, 34, -17, 39, 0, 39);
          g.bezierCurveTo(17, 39, 29, 34, 28, 10);
          g.bezierCurveTo(28, -9, 13, -8, 10, -15); g.lineTo(10, -28); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = '#ad7952'; rr(g, -11, -39, 22, 14, 3); g.fill();
          g.strokeStyle = '#775239'; rr(g, -11, -39, 22, 14, 3); g.stroke();
          g.fillStyle = '#dcc397'; rr(g, -15, -29, 30, 7, 2); g.fill();
          g.strokeStyle = '#947e55'; rr(g, -15, -29, 30, 7, 2); g.stroke();
          g.fillStyle = '#fff1cf'; rr(g, -20, 3, 40, 24, 3); g.fill();
          g.strokeStyle = '#a48d66'; g.lineWidth = 1; rr(g, -20, 3, 40, 24, 3); g.stroke();
          label(g, kind === 'mp' ? '还神' : kind === 'both' ? '大还' : '金创', 0, 15, 15, kind === 'mp' ? '#416b81' : kind === 'both' ? '#51664f' : C.red, 'center', true);
          g.strokeStyle = 'rgba(255,255,239,.66)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(-17, -3); g.quadraticCurveTo(-22, 3, -21, 10); g.stroke();
          g.strokeStyle = '#9f6c51'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(-9, -23); g.quadraticCurveTo(1, -18, 12, -22);
          g.moveTo(8, -21); g.quadraticCurveTo(19, -20, 22, -11); g.stroke();
          g.fillStyle = '#be634f'; g.beginPath(); g.moveTo(20, -13); g.lineTo(27, -10); g.lineTo(22, -1); g.lineTo(17, -5); g.closePath(); g.fill();
        }
        g.restore();
      }

      P.drawers.shop = (g, G) => {
        const S = Z.Save.d;
        // 补给与法宝同一套安全判据：地图或清场后的灵泉休整处；战斗途中不售。
        const canShop = Z.Save.canManageRelics();
        label(g, '仙坊补给', 94, 120, 17, C.ink, 'left', true);
        label(g, canShop ? '药水存入行囊 · 大还丹立即使用' : '前方未平 · 请回到地图或安全休整处购买',
          866, 120, 13, canShop ? C.muted : '#c26a52', 'right');
        Z.BAL.shop.forEach((gd, i) => {
          const x = i % 2 ? 492 : 86, y = i < 2 ? 142 : 306;
          panel(g, x, y, 382, 150, { fill: C.light, border: C.line, r: 12 });
          panel(g, x + 16, y + 14, 94, 94, { fill: C.slot, border: 'rgba(201,185,155,.5)', r: 10 });
          productArt(g, gd.id, x + 63, y + 59);
          label(g, gd.name, x + 128, y + 24, 20, C.ink, 'left', true);
          wrap(g, gd.desc, x + 128, y + 51, 232, { size: 14, color: C.ink, lineHeight: 19, maxLines: 2 });
          const stock = gd.id === 'potion_hp' ? S.pots.hp : gd.id === 'potion_mp' ? S.pots.mp : gd.id === 'stone' ? S.stones : null;
          label(g, stock === null ? '购买后立即恢复' : '行囊已有  ' + stock, x + 128, y + 94, 13, stock === null ? C.jade : C.muted);
          Z.Spr.drawCoin(g, x + 26, y + 127, 8);
          label(g, gd.price + ' 金', x + 42, y + 127, 16, C.ink, 'left', true);
          const blocked = !canShop || S.gold < gd.price;
          const label2 = !canShop ? '安全处方可购买' : S.gold < gd.price ? '金币不足' : gd.id === 'bighp' ? '购买并使用' : '购买';
          if (button(g, x + 252, y + 114, 110, 30, label2, { kind: 'primary', disabled: blocked, size: 14 })) {
            if (!canShop) { P.notify('请在地图或安全休整处购买'); return; }
            S.gold -= gd.price;
            if (gd.id === 'potion_hp') S.pots.hp++;
            else if (gd.id === 'potion_mp') S.pots.mp++;
            else if (gd.id === 'stone') S.stones++;
            else if (gd.id === 'bighp') {
              if (G.player) { G.player.hp = G.player.maxHp; G.player.mp = G.player.maxMp; }
              for (let n = 0; n < 8; n++) Z.FX.add('heal', (G.player ? G.player.x : 480) + Z.U.rand(-16, 16), (G.player ? G.player.y : 300) - Z.U.rand(8, 55), { life: .8 });
            }
            Z.Audio.sfx('buy');
            Z.Save.save();
            P.notify(gd.id === 'bighp' ? '生命与法力已恢复' : gd.name + ' +1');
          }
        });
      };

      const combatIds = ['firstblood', 'combo20', 'tower5'];
      const growthIds = ['lv10', 'rich', 'plus9', 'pets3', 'relic_first', 'relic_max'];
      const achGroups = [
        { id: 'journey', name: '西游历程', icon: 'map', contains: a => !combatIds.includes(a.id) && !growthIds.includes(a.id) },
        { id: 'combat', name: '战斗历练', icon: 'weapon', contains: a => combatIds.includes(a.id) },
        { id: 'growth', name: '修炼成长', icon: 'pet', contains: a => growthIds.includes(a.id) },
      ];
      const achIcons = { firstblood: 'weapon', combo20: 'skill', tower5: 'title', boss_juling: 'weapon', ch2: 'map', sea_clear: 'pet', honghaier: 'skill', tieshan: 'acc', niuwang: 'head', lv10: 'head', rich: 'shop', plus9: 'weapon', pets3: 'pet', relic_first: 'acc', relic_max: 'ach' };

      function earnedStamp(g, x, y) {
        g.save(); g.translate(x, y); g.rotate(-.12);
        g.strokeStyle = C.red; g.lineWidth = 1.2;
        rr(g, -25, -11, 50, 22, 3); g.stroke();
        label(g, '已达成', 0, 0, 12, C.red, 'center', true);
        g.restore();
      }

      P.drawers.ach = (g, G) => {
        const S = Z.Save.d, all = Z.BAL.achievements;
        const count = all.filter(a => S.ach[a.id]).length;
        label(g, '一路西游，皆有印记', 94, 120, 17, C.ink, 'left', true);
        label(g, '已达成  ' + count + ' / ' + all.length, 866, 120, 14, C.jade, 'right', true);
        panel(g, 86, 142, 168, 314, { fill: C.slot, border: C.line, r: 10 });
        label(g, '历练目录', 104, 164, 16, C.ink, 'left', true);
        const selected = achGroups.some(a => a.id === G.polishAchCategory) ? G.polishAchCategory : 'journey';
        achGroups.forEach((group, i) => {
          const y = 188 + i * 62, list = all.filter(group.contains);
          if (button(g, 101, y, 138, 50, group.name, { kind: selected === group.id ? 'primary' : 'quiet', icon: group.icon, size: 15 })) G.polishAchCategory = group.id;
          label(g, list.filter(a => S.ach[a.id]).length + ' / ' + list.length, 170, y + 58, 11, C.muted, 'center');
        });
        wrap(g, '达成后自动获得\n2 个强化石', 104, 411, 134, { size: 12, color: C.muted, lineHeight: 18, maxLines: 2 });
        const group = achGroups.find(a => a.id === G.polishAchCategory) || achGroups.find(a => a.id === selected);
        all.filter(group.contains).forEach((a, i) => {
          const got = !!S.ach[a.id], x = i % 2 ? 576 : 272, y = 142 + Math.floor(i / 2) * 106;
          panel(g, x, y, 288, 102, { fill: got ? '#faf0dd' : C.light, border: got ? '#cdb494' : C.line, r: 10 });
          panel(g, x + 13, y + 15, 40, 40, { fill: got ? '#e8d8b4' : C.slot, border: 'rgba(201,185,155,.45)', r: 8 });
          icon(g, achIcons[a.id] || 'ach', x + 33, y + 35, 29);
          label(g, a.n, x + 65, y + 24, 16, C.ink, 'left', true);
          wrap(g, a.d, x + 65, y + 47, 205, { size: 13, color: C.ink, lineHeight: 18, maxLines: 2 });
          label(g, got ? '强化石奖励已自动发放' : '达成后自动奖励 2 石', x + 16, y + 84, 11, C.muted);
          if (got) earnedStamp(g, x + 249, y + 85);
        });
      };

      function volumeSlider(g, x, y, w, name, val, interactive) {
        label(g, name, 110, y, 14, C.ink);
        label(g, Math.round(val * 100) + '%', 530, y, 14, C.jade, 'right', true);
        g.fillStyle = '#dcd1b9'; rr(g, x, y - 4, w, 8, 4); g.fill();
        g.fillStyle = C.jade; rr(g, x, y - 4, Math.max(4, val * w), 8, 4); g.fill();
        g.fillStyle = C.light; g.strokeStyle = C.jade; g.lineWidth = 2;
        g.beginPath(); g.arc(x + val * w, y, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        const m = Z.Input.mouse;
        if (interactive && (m.down || m.clicked) && inside(m, x - 8, y - 15, w + 16, 30)) {
          m.clicked = false;
          return Z.U.clamp((m.x - x) / w, 0, 1);
        }
        return null;
      }

      function settingsBody(g, G, interactive) {
        label(g, '为这段冒险调好声音与表现', 94, 120, 17, C.ink, 'left', true);
        panel(g, 86, 142, 470, 192, { fill: C.light, border: C.line, r: 12 });
        icon(g, 'sound', 118, 166, 26);
        label(g, '声音', 140, 165, 18, C.ink, 'left', true);
        label(g, '音乐与招式声分别调节', 110, 189, 13, C.muted);
        const mv = volumeSlider(g, 220, 226, 274, '音乐音量', Z.Audio.musicVol(), interactive);
        if (mv !== null) Z.Audio.setMusicVol(mv);
        const sv = volumeSlider(g, 220, 286, 274, '音效音量', Z.Audio.sfxVol(), interactive);
        if (sv !== null) Z.Audio.setSfxVol(sv);

        panel(g, 86, 350, 470, 106, { fill: C.light, border: C.line, r: 12 });
        icon(g, 'shake', 118, 379, 25);
        label(g, '战斗表现', 140, 379, 18, C.ink, 'left', true);
        label(g, '重击与受击时产生短暂震动', 110, 414, 13, C.muted);
        if (button(g, 406, 382, 130, 42, '震屏 ' + (Z.FX.shakeOn() ? '开启' : '关闭'), { kind: Z.FX.shakeOn() ? 'primary' : 'secondary', disabled: !interactive, size: 14 })) Z.FX.setShake(!Z.FX.shakeOn());

        panel(g, 578, 142, 296, 314, { fill: C.light, border: C.line, r: 12 });
        icon(g, 'save', 610, 169, 26);
        label(g, '冒险存档', 636, 169, 18, C.ink, 'left', true);
        panel(g, 598, 197, 256, 76, { fill: '#e6ecdc', border: '#c2cfb2', r: 9 });
        const saveState = Z.Save.status, saveFailed = saveState.writesBlocked || saveState.state === 'write_error';
        g.save(); g.strokeStyle = saveFailed ? '#b44434' : C.jade; g.lineWidth = 3; g.lineCap = 'round';
        if (saveFailed) { g.beginPath(); g.moveTo(617, 229); g.lineTo(636, 248); g.moveTo(636, 229); g.lineTo(617, 248); g.stroke(); }
        else { g.beginPath(); g.moveTo(617, 237); g.lineTo(626, 246); g.lineTo(642, 227); g.stroke(); }
        g.restore();
        label(g, saveFailed ? '存档需要处理' : G.practice ? '本页体验进度' : '冒险会自动保存', 654, 225, 15, saveFailed ? '#b44434' : C.jade, 'left', true);
        label(g, saveFailed ? '进度尚未写入浏览器' : G.practice ? '刷新后重新开始' : '随时休整，继续西游', 654, 246, 12, C.muted);
        wrap(g, saveFailed ? saveState.message : G.practice ? '本模式不影响正式存档。若想保留体验成果，请导出备份。' : '成长、装备与通关进度保存在当前浏览器，可导出备份。', 598, 294, 250, { size: 13, color: C.ink, lineHeight: 19, maxLines: 2 });
        if (button(g, 598, 338, 122, 36, '导出备份', { disabled: !interactive || !G.exportSave, size: 14 })) G.exportSave();
        if (button(g, 732, 338, 122, 36, '恢复备份', { disabled: !interactive || !G.chooseSaveFile, size: 14 })) G.chooseSaveFile();
        wrap(g, '清除后，将重新开启西游冒险。', 598, 389, 250, { size: 12, color: C.muted, lineHeight: 18, maxLines: 1 });
        if (button(g, 598, 400, 256, 36, '清除冒险存档', { kind: 'danger', disabled: !interactive, size: 14 })) G.confirmReset = true;
      }

      P.drawers.set = (g, G) => {
        settingsBody(g, G, !G.confirmReset && !G.pendingImport);
        if (G.pendingImport) {
          g.save(); g.fillStyle = 'rgba(50,43,34,.44)'; g.fillRect(86, 114, 788, 352); g.restore();
          panel(g, 252, 194, 456, 218, { fill: C.light, border: C.line, r: 14 });
          label(g, '要恢复这份冒险备份吗？', 480, 232, 22, C.ink, 'center', true);
          label(g, G.pendingImport.summary, 480, 267, 14, C.jade, 'center', true);
          wrap(g, '确认后将替换当前成长、装备与通关进度，并返回选关地图。', 284, 301, 392, { size: 14, color: C.ink, lineHeight: 22, maxLines: 2 });
          if (button(g, 284, 354, 156, 40, '保留当前存档', { kind: 'primary', size: 15 })) G.pendingImport = null;
          else if (button(g, 480, 354, 194, 40, '确认恢复', { size: 15, disabled: !G.restoreSave })) G.restoreSave();
          return;
        }
        if (!G.confirmReset) return;
        g.save(); g.fillStyle = 'rgba(50,43,34,.44)'; g.fillRect(86, 114, 788, 352); g.restore();
        panel(g, 252, 198, 456, 202, { fill: C.light, border: C.line, r: 14 });
        label(g, '要清除冒险存档吗？', 480, 236, 22, C.ink, 'center', true);
        wrap(g, '成长、装备与通关进度将清空，随后返回主菜单。', 284, 276, 392, { size: 14, color: C.ink, lineHeight: 22, maxLines: 2 });
        if (button(g, 284, 340, 156, 40, '保留存档', { kind: 'primary', size: 15 })) G.confirmReset = false;
        else if (button(g, 480, 340, 194, 40, '确认清除', { kind: 'danger', size: 15 })) {
          Z.Save.reset();
          G.confirmReset = false;
          G.closePanel();
          G.toTitle();
        }
      };
    }

    return {
      draw(g, G) { P.hovering = false; frame(g, G); },
      notify: P.notify,
      reset() { notice = null; P.hovering = false; },
      get hovering() { return P.hovering; },
    };
  }
  const systemUI = createSystemUI();

  /* ================= 结算面板 ================= */
  function drawEnding(g, G) {
    const info = G.clearInfo, et = U.clamp((G.time - (info._t0 ?? G.time)) / .8, 0, 1);
    g.save();
    g.fillStyle = 'rgba(7,22,28,.88)'; g.globalAlpha = et; g.fillRect(0, 0, 960, 540);
    panel(g, 80, 65, 800, 410, { bg: '#162e35', border: '#b79c61' });
    Z.Spr.text(g, '大 圣 归 来', 480, 112, { size: 38, color: '#f2db9e', bold: true });
    Z.Spr.text(g, '三界历练 · 完成', 480, 146, { size: 15, color: '#b7cebf' });
    const chapters = [[3, '天宫 · 云门破阵', '凌霄殿前，一棒扬名'], [7, '东海 · 踏浪寻龙', '万顷碧波，尽入行囊'], [10, '火焰山 · 平天决胜', '赤焰散去，山海重明']];
    chapters.forEach(([idx, name, line], i) => {
      const x = 126 + i * 248, y = 172;
      g.save(); rr(g, x, y, 212, 136, 7); g.clip();
      g.save(); g.translate(x - 28, y - 8); g.scale(.28, .28);
      const def = Z.BAL.levels[idx];
      Z.BG.draw(g, def.theme, def.w - 960, def.w, def.gy, G.time, [], idx);
      g.restore();
      const shade = g.createLinearGradient(0, y + 55, 0, y + 136);
      shade.addColorStop(0, 'rgba(10,26,31,0)'); shade.addColorStop(1, 'rgba(10,26,31,.96)');
      g.fillStyle = shade; g.fillRect(x, y, 212, 136);
      Z.Spr.text(g, name, x + 106, y + 100, { size: 15, color: '#f1ddb0', bold: true });
      Z.Spr.text(g, line, x + 106, y + 121, { size: 10, color: '#c1d2c3' });
      g.restore();
      g.strokeStyle = '#ad9561'; g.lineWidth = 1; rr(g, x, y, 212, 136, 7); g.stroke();
    });
    Z.Spr.text(g, '最终一战  ' + Math.round(info.t) + '秒    ·    击退 ' + info.kills + ' 敌    ·    收获 ' + info.gold + ' 金币', 480, 337,
      { size: 13, color: '#c5d4c6' });
    const disabled = et < .8 || Z.Trans.busy;
    const map = button(g, 330, 366, 140, 40, '返回地图', { jade: true, disabled });
    const replay = !map && button(g, 490, 366, 140, 40, '再战一次', { disabled });
    Z.Spr.text(g, '战利品与历练已保留。故地可再游，镇妖塔中仍有新的挑战。', 480, 436, { size: 12, color: '#b4c7b9' });
    g.restore();
    if (map) G.toMap(); else if (replay) G.startLevel(G.level.idx);
  }

  function drawClear(g, G) {
    const info = G.clearInfo;
    const next = G.level.def.tower ? -1
      : Z.BAL.levels.findIndex((def, idx) => idx > G.level.idx && !def.tower);
    const finale = next < 0 && !G.level.def.tower && Z.BAL.levels.every((def, idx) => def.tower || idx === G.level.idx || Z.Save.d.cleared[idx]);
    if (finale) { drawEnding(g, G); return; }
    // 演出：黑幕渐深 + 面板滑入 + 数字滚动
    const et = U.clamp((G.time - (info._t0 ?? G.time)) / 0.5, 0, 1);
    const cu = U.ease(et);
    // v75：行囊有更优装备时面板加高一档，底部放「整理行囊」直达按钮（回地图自动打开背包装备页）
    const advice = Z.Save.equipAdvice().count > 0;
    g.save();
    g.globalAlpha = et * 0.72;
    g.fillStyle = 'rgba(6,10,18,1)';
    g.fillRect(0, 0, 960, 540);
    g.restore();
    g.save();
    g.globalAlpha = et;
    g.translate(0, (1 - easeOutBack(et)) * -42);
    panel(g, 300, 110, 360, advice ? 414 : next >= 0 ? 370 : 320);
    Z.Spr.text(g, '通 关 ！', 480, 156, { size: 34, color: '#ffd75e', bold: true });
    const chapterClear = G.level.idx === 3 ? '天宫篇完成 · 云门已破' : G.level.idx === 7 ? '东海篇完成 · 再向西行' : Z.BAL.levels[G.level.idx].name + ' · 完成';
    Z.Spr.text(g, chapterClear, 480, 192, { size: 15, color: '#f0e6d2' });
    const rows = [
      ['用时', Math.round(info.t * cu) + ' 秒'],
      ['击杀', Math.round(info.kills * cu) + ' 只' + (info.maxCombo ? ' · 最高' + info.maxCombo + ' 连击' : '')],
      ['金币', '+' + Math.round(info.gold * cu)],
    ];
    let y = 230;
    for (const [k, v] of rows) {
      Z.Spr.text(g, k, 380, y, { size: 15, color: '#8a94a8', align: 'left' });
      Z.Spr.text(g, String(v), 580, y, { size: 15, color: '#fff', align: 'right' });
      y += 30;
    }
    const its = info.items || [];
    if (its.length) {
      Z.Spr.text(g, '装备 ×' + its.length, 330, y + 2, { size: 12, color: '#c7d0d8', align: 'left' });
      Z.Spr.text(g, '已放入背包', 330, y + 20, { size: 10, color: '#8a94a8', align: 'left' });
      its.slice(0, 4).forEach((it, i) => {
        const ia = U.clamp((et - 0.25 - i * 0.1) / 0.25, 0, 1);
        if (ia <= 0) return;
        const ix = 430 + i * 45;
        g.save();
        g.globalAlpha = et * ia;
        Z.Spr.drawItemIcon(g, it, ix, y - 9, 36);
        g.restore();
        if (!Z.Trans.busy && inRect(Z.Input.mouse, ix, y - 9, 36, 36)) {
          hoverAny = true;
          tooltip(g, 480, y - 12, Z.BAL.itemName(it), ['已收入背包，可在地图查看、穿戴或强化'], Z.BAL.qualities[it.q].c);
        }
      });
      if (its.length > 4) Z.Spr.text(g, '+' + (its.length - 4), 620, y + 8, { size: 11, color: '#ffd75e' });
    } else {
      Z.Spr.text(g, '本关所得已保留 · 可在地图休整', 480, y + 8, { size: 12, color: '#a7b8bf' });
    }
    // 法宝材料实得展示：只有南天门 / 蟠桃园产出，并指向背包 · 法宝页
    const mats = Object.entries(info.materials || {}).filter(([, n]) => n > 0);
    if (mats.length) {
      const names = mats.map(([id, n]) => Z.BAL.materialNames[id] + ' ×' + n).join('　');
      const relicByMat = { cloudSilk: 'cloud_umbrella', peachDew: 'jade_leaf', seaPearl: 'sea_tide_pearl' };
      const nextCraft = mats.find(([id]) => relicByMat[id] && !Z.Save.d.relics.owned.some(r => r.id === relicByMat[id]));
      let guide = ' · 法宝培养材料';
      if (nextCraft) {
        const def = Z.BAL.relicDefs[relicByMat[nextCraft[0]]], missing = [];
        for (const [id, need] of Object.entries(def.recipe.materials)) {
          const lack = Math.max(0, need - (Z.Save.d.materials[id] || 0));
          if (lack) missing.push(Z.BAL.materialNames[id] + '×' + lack);
        }
        if (Z.Save.d.gold < def.recipe.gold) missing.push((def.recipe.gold - Z.Save.d.gold) + '金币');
        guide = missing.length ? ' · ' + def.name + '尚缺' + missing.join('、') : ' · 背包-法宝页可合成' + def.name;
      }
      Z.Spr.text(g, '法宝材料　' + names + guide, 480, y + 36, { size: 10.5, color: '#ffd7a0' });
    }
    // v75 装备引导：行囊里有更优装备时给出「整理行囊」一键直达——回地图后自动打开背包装备页。
    // 次行（418）已被「再战一次 / 返回地图」占用，故加高面板后放在第三行整宽。
    let a1 = false, a2 = false, a3 = false, ab = false;
    const bk = U.clamp((et - 0.55) / 0.3, 0, 1);
    if (bk > 0) {
      g.save();
      g.globalAlpha = bk;
      const blocked = Z.Trans.busy;
      if (next >= 0) {
        a3 = button(g, 330, 366, 300, 40, '下一关 · ' + Z.BAL.levels[next].name, { jade: true, disabled: blocked });
        a2 = !a3 && button(g, 330, 418, 140, 36, '再战一次', { size: 15, disabled: blocked });
        a1 = !a3 && !a2 && button(g, 490, 418, 140, 36, '返回地图', { size: 15, disabled: blocked });
      } else {
        a1 = button(g, 330, 366, 140, 40, '返回地图', { disabled: blocked });
        a2 = !a1 && button(g, 490, 366, 140, 40, '再战一次', { disabled: blocked });
      }
      if (advice) ab = button(g, 330, 462, 300, 32, '整理行囊 · 换上更优装备', { kind: 'secondary', size: 13, disabled: blocked });
      g.restore();
    }
    g.restore();
    if (a3) { G.startLevel(next); return; }
    if (ab) { G.toMap(); G._openBagOnMap = true; return; }
    if (a1) { G.toMap(); return; }
    if (a2) { G.startLevel(G.level.idx); return; }
  }

  function drawOver(g, G) {
    // 演出：红黑幕渐深 + 面板浮现
    const et = U.clamp((G.time - (G.deadT0 ?? G.time)) / 0.45, 0, 1);
    const oe = U.ease(et);
    g.save();
    g.globalAlpha = et * 0.8;
    g.fillStyle = 'rgba(20,6,10,1)';
    g.fillRect(0, 0, 960, 540);
    g.restore();
    g.save();
    g.globalAlpha = et;
    g.translate(0, (1 - oe) * 26);
    panel(g, 310, 150, 340, 240, { border: '#e05555' });
    Z.Spr.text(g, '战 败 ……', 480, 200, { size: 34, color: '#ff8a7e', bold: true });
    Z.Spr.text(g, '已获得的成长与战利品都会保留', 480, 244, { size: 14, color: '#f0e6d2' });
    const advice = G.level && G.level.phase === 'boss' && G.level.def.advice;
    Z.Spr.text(g, advice || '读准预警再出手，也可回地图整备', 480, 268, { size: advice ? 11 : 13, color: '#a7b8bf' });
    // 续战：从死亡时的波次/层数再来（奖励已保留）
    const lv = G.level;
    const canResume = lv && !lv.def.tower && lv.waveIdx >= 1;
    const canResumeTower = lv && lv.def.tower && lv.tower.floor > 1;
    if (canResumeTower) {
      if (button(g, 350, 298, 130, 38, '从第' + lv.tower.floor + '层继续', { size: 12, disabled: Z.Trans.busy })) { g.restore(); G.startLevel(4, { floor: lv.tower.floor }); return; }
    } else if (canResume) {
      const bossRetry = lv.phase === 'boss';
      if (button(g, 350, 298, 130, 38, bossRetry ? '再战镇守者' : '从第' + (lv.waveIdx + 1) + '波继续', { size: 13, disabled: Z.Trans.busy })) {
        g.restore(); G.startLevel(lv.idx, bossRetry ? lv.def.waves.length : lv.waveIdx); return;
      }
    }
    if (button(g, 496, 298, 130, 38, '返回地图', { disabled: Z.Trans.busy })) { g.restore(); G.toMap(); return; }
    if (button(g, 424, 348, 130, 34, '重整旗鼓', { size: 13, disabled: Z.Trans.busy })) { g.restore(); G.startLevel(lv ? lv.idx : 0); return; }
    g.restore();
  }

  function drawLootReview(g, G) {
    const items = G.lootReview.items, total = { materials: {}, gold: 0, stones: 0 };
    for (const it of items) {
      const reward = Z.BAL.dismantleYield(it);
      total.gold += reward.gold; total.stones += reward.stones;
      for (const [id, count] of Object.entries(reward.materials)) total.materials[id] = (total.materials[id] || 0) + count;
    }
    g.save();g.fillStyle='rgba(6,12,20,.82)';g.fillRect(0,0,960,540);g.restore();
    panel(g,200,68,560,412,{bg:'#162b32',border:'#bea46b'});
    Z.Spr.text(g,'行囊已满 · 战利品待整理',480,105,{size:23,color:'#f2d894',bold:true});
    Z.Spr.text(g,'这些具名装备还在场上，可以先腾出行囊再拾取。',480,135,{size:13,color:'#c1d1cb'});
    items.slice(0,4).forEach((it,i)=>{
      const x=i%2?494:226,y=155+Math.floor(i/2)*60;
      Z.Spr.drawItemIcon(g,it,x,y,44);
      const name=Z.BAL.itemName(it);
      Z.Spr.text(g,name,x+55,y+14,{size:name.length>14?11:12,color:Z.BAL.qualities[it.q].c,align:'left',bold:true});
      Z.Spr.text(g,Z.BAL.slotNames[Z.BAL.itemBases[it.base].slot]+' · 强化 +'+it.lv,x+55,y+34,{size:11,color:'#a6bbb6',align:'left'});
    });
    Z.Spr.text(g,(items.length>4?'另有 '+(items.length-4)+' 件 · ':'')+'共 '+items.length+' 件待整理',480,282,{size:12,color:'#c6c6ae'});
    Z.Spr.text(g,'若选择分解并离场，将获得',480,307,{size:12,color:'#b6c7bf'});
    const materials=Object.entries(total.materials).filter(([,count])=>count>0).map(([id,count])=>Z.BAL.materialNames[id]+' ×'+count).join('　');
    Z.Spr.text(g,materials||'无材料返还',480,330,{size:16,color:'#b9e0bc',bold:true});
    Z.Spr.text(g,'强化投入返还　'+total.gold+' 金币 / '+total.stones+' 强化石',480,351,{size:12,color:'#d7c99e'});
    Z.Spr.text(g,'直接离场会分解这些装备，无法还原。',480,374,{size:13,color:'#ffb8a1'});
    let choice=null;
    if(button(g,224,396,244,38,'先整理行囊',{jade:true,size:15}))choice='bag';
    else if(button(g,492,396,244,38,'分解并离场',{size:15}))choice='recycle';
    else if(button(g,405,444,150,25,'返回战场',{size:12,r:6}))choice='cancel';
    Z.Input.mouse.clicked=false;
    if(choice)G.resolveLootReview(choice);
  }

  function drawTowerReady(g, G) {
    const lv = G.level, tower = lv.tower, plan = tower.plan;
    if (!plan) return;
    const interactive = !G.paused && !G.dead && !G.clearInfo && !Z.Trans.busy;
    g.save();g.fillStyle='rgba(9,20,28,.48)';g.fillRect(0,134,960,332);g.restore();
    panel(g,218,137,524,300,{border:'#bba372'});
    Z.Spr.text(g,tower.resting?'整装休整 · 准备好再出发':'阵前预览 · 确认后开战',480,160,{size:12,color:'#a8cfbd'});
    Z.Spr.text(g,'第 '+tower.floor+' 层 · '+plan.name,480,190,{size:25,color:'#f3ddb0',bold:true});
    const roster = plan.bossId ? '镇守者 · '+Z.BAL.bosses[plan.bossId].title
      : plan.wave.map(w=>Z.BAL.enemies[w.t].name+' ×'+w.n).join('　');
    Z.Spr.text(g,roster,480,220,{size:13,color:'#d3dfd6'});
    g.save();g.strokeStyle='rgba(190,164,107,.35)';g.beginPath();g.moveTo(249,239);g.lineTo(711,239);g.stroke();g.restore();
    Z.Spr.text(g,plan.hint,480,261,{size:13,color:'#eee5c9'});
    const next = plan.bossId ? '击败守将：恢复 30% 生命 / 40% 法力，随后可休整'
      : '下一位守将：第 '+(Math.ceil(tower.floor/4)*4)+' 层 · 普通层不额外恢复';
    Z.Spr.text(g,next,480,284,{size:12,color:'#c3d3c6'});
    if(tower.recovery)Z.Spr.text(g,tower.recovery.hp||tower.recovery.mp
      ?'刚刚恢复 +'+Math.round(tower.recovery.hp)+' 生命 / +'+Math.round(tower.recovery.mp)+' 法力':'状态充盈，无需额外恢复',480,309,{size:12,color:'#bde0ac'});
    else Z.Spr.text(g,'战利品已收齐 · 高层不会提高装备阶次',480,309,{size:11,color:'#a9bdb7'});
    Z.Spr.text(g,tower.resting?'可用下方背包、法宝和仙坊整装；等待不会恢复状态。'
      :'可查看装备与招式；仙坊补给、法宝调整需等待守将后休整。',480,340,{size:11,color:'#a9bdb7'});
    const begin = button(g,349,371,262,40,'迎战第 '+tower.floor+' 层  [Enter]',{jade:true,size:17,disabled:!interactive});
    // 卡片上的点击不交给 HUD 或后来打开的窗口。
    if (interactive && inRect(Z.Input.mouse,218,137,524,300)) Z.Input.mouse.clicked=false;
    if (begin) lv.confirmTowerFloor();
  }

  function drawFrame(g, G) {
    // 每帧顶部调用：根据场景绘制对应 UI
    // 兼容旧预览的地图成就入口，统一为同一个系统窗口。
    if (G.scene === 'map' && G.achOpen) {
      G.achOpen = false;
      if (!G.paused) G.openPanel('ach');
    }
    if (G.scene === 'title') drawTitle(g, G);
    else if (G.scene === 'map') {
      drawMap(g, G);
      if (G.prologue) drawPrologue(g, G);
      if (G.paused) drawPause(g, G);
    }
    else if (G.scene === 'game') {
      if (G.lootReview) {
        const clicked=Z.Input.mouse.clicked;
        Z.Input.mouse.clicked=false;drawHUD(g,G);Z.Input.mouse.clicked=clicked;
        drawLootReview(g,G);return;
      }
      drawHUD(g, G);
      if (G.level && G.level.tower && G.level.tower.ready && !G.clearInfo && !G.dead) drawTowerReady(g,G);
      if (G.paused) drawPause(g, G);
      if (G.clearInfo) drawClear(g, G);
      if (G.dead) drawOver(g, G);
    }
  }

  return {
    drawFrame, toast, tooltip, drawSystemIcon,
    get hovering() { return Z.G && Z.G.paused && PANELS[Z.G.tab] ? systemUI.hovering : hoverAny; },
    reset() { toasts.length = 0; systemUI.reset(); },
  };
})();
