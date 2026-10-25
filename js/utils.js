/* ============================================================
 * 造梦西游 · 悟空传（网页复刻版）
 * utils.js —— 全局命名空间、数学工具、输入系统
 * ============================================================ */
'use strict';
window.Z = window.Z || {};

Z.U = {
  TAU: Math.PI * 2,
  clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  sign: (v) => v < 0 ? -1 : 1,
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  approach: (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t),
  ease: (t) => 1 - Math.pow(1 - t, 3),
  // 矩形相交（矩形均为 {x,y,w,h}，y 为顶边）
  aabb: (r1, r2) => r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y,
  fmt: (n) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.floor(n) + '',
};

/* ---------------- 输入系统 ----------------
 * 键盘动作映射（造梦3 风格：J攻击 K跳跃 U/I/O技能 L无双）
 * 鼠标用于菜单。 */
Z.Input = (() => {
  const keys = {};        // 原始按键 -> true
  const jpSet = new Set(); // 本帧刚按下的动作
  const BINDS = {
    left: ['a', 'arrowleft'],
    right: ['d', 'arrowright'],
    up: ['w', 'arrowup'],
    down: ['s', 'arrowdown'],
    jump: ['k', 'w', 'arrowup'],
    attack: ['j'],
    skill1: ['u'],
    skill2: ['i'],
    skill3: ['o'],
    wushuang: ['l'],
    relic: ['r'],
    interact: ['e', ' '],
    confirm: ['enter'],
    pause: ['escape'],
    menuBag: ['b'],
    menuPet: ['p'],
    menuSkill: ['c'],
    menuShop: ['m'],
    menuAch: ['n'],
    menuSet: ['v'],
    potion1: ['1'],
    potion2: ['2'],
  };
  const PREVENT = new Set([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', '1', '2']);

  const mouse = { x: 480, y: 270, down: false, clicked: false };

  function keyName(e) {
    // 中文输入法下仍按键盘的物理位置控制。
    if (/^Key[A-Z]$/.test(e.code || '')) return e.code.slice(3).toLowerCase();
    if (/^Digit[12]$/.test(e.code || '')) return e.code.slice(5);
    return (e.key || '').toLowerCase();
  }
  function keyActions(e) {
    const k = keyName(e);
    const acts = [];
    for (const a in BINDS) if (BINDS[a].includes(k)) acts.push(a);
    return acts;
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (PREVENT.has((e.key || '').toLowerCase())) e.preventDefault();
    if (e.repeat) return;
    keys[keyName(e)] = true;
    for (const a of keyActions(e)) jpSet.add(a);
    Z.Audio.unlock();
  });
  window.addEventListener('keyup', (e) => {
    keys[keyName(e)] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    jpSet.clear();
    mouse.down = false; mouse.clicked = false;
    if (Z.G && Z.G.player && Z.G.player.clearActionBuffer) Z.G.player.clearActionBuffer();
  });

  const canvasReady = { cv: null, scale: 1 };
  function attachMouse(cv) {
    canvasReady.cv = cv;
    cv.addEventListener('mousemove', (e) => {
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        const r = cv.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / (r.width / 960);
        mouse.y = (e.clientY - r.top) / (r.height / 540);
      }
    });
    cv.addEventListener('mousedown', (e) => {
      if (e.button != null && e.button !== 0) return;
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        const r = cv.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / (r.width / 960);
        mouse.y = (e.clientY - r.top) / (r.height / 540);
      }
      mouse.down = true; mouse.clicked = true;
      Z.Audio.unlock();
      e.preventDefault();
    });
    cv.addEventListener('mouseup', () => { mouse.down = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', () => { mouse.down = false; });
  }

  return {
    mouse,
    attachMouse,
    isDown: (a) => BINDS[a] && BINDS[a].some((k) => keys[k]),
    jp: (a) => jpSet.has(a),
    consume: (a) => { const pressed = jpSet.has(a); jpSet.delete(a); return pressed; },
    anyJp: () => jpSet.size > 0,
    clear() { for (const k in keys) keys[k] = false; jpSet.clear(); mouse.down = false; mouse.clicked = false; },
    // 高刷屏下 rAF 帧率可能高于逻辑帧率：键盘只在 endUpdate（真正跑过 update）后清，
    // endFrame 每个渲染帧只清鼠标，否则按下事件会在"无 update 帧"被误吞
    endUpdate() { jpSet.clear(); },
    endFrame() { mouse.clicked = false; },
  };
})();
