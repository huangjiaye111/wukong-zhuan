/* ============================================================
 * main.js —— 场景状态机 + 主循环 + 启动
 * ============================================================ */
'use strict';

Z.G = {
  practice: typeof location !== 'undefined' && /(?:^|[?&])practice=1(?:&|$)/.test(location.search),
  scene: 'title',       // title | map | game
  time: 0,
  level: null,
  player: null,
  paused: false,
  tab: 'pause',
  selItem: null,
  gearInspect: false,
  dismantleConfirm: null,
  lootReview: null,
  confirmNew: false,
  confirmReset: false,
  help: false,
  clearInfo: null,
  dead: false,
  slowT: 0,       // 慢动作剩余时间（真实秒）
  sceneT0: 0,     // 当前场景开始时刻（入场动效用）
  deadT0: 0,      // 死亡面板出现时刻
  prologue: false,   // 新档序幕（只在 startNew 后出现一次）
  prologueT0: 0,

  openPanel(tab) {
    if (!['pause', 'bag', 'pet', 'skill', 'shop', 'ach', 'set'].includes(tab) ||
        !['game', 'map'].includes(this.scene) || Z.Trans.busy || this.clearInfo || this.dead || this.prologue || this.lootReview) return false;
    if (!this.player) this.player = new Player(0, 0);
    this.player.clearActionBuffer();
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    Z.Input.endUpdate();
    Z.Input.mouse.clicked = false;
    this.paused = true;
    this.tab = tab;
    this.dismantleConfirm = null;
    this.confirmReset = false;
    this.help = false;
    this.pendingImport = null;
    this.uiPetDemoAt = null;
    this.uiSkillDemoAt = this.time;
    if (tab !== 'bag') this.gearInspect = false;
    this.achOpen = false;
    this._pauseT = 0;
    this._pLt = this.time;
    return true;
  },

  closePanel() {
    if (!this.paused) return false;
    if (this.player) this.player.clearActionBuffer();
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    Z.Input.endUpdate();
    Z.Input.mouse.clicked = false;
    this.paused = false;
    this.dismantleConfirm = null;
    this.achOpen = false;
    this.gearInspect = false;
    this.confirmReset = false;
    this.help = false;
    this.pendingImport = null;
    this.uiPetDemoAt = null;
    this.uiSkillDemoAt = null;
    return true;
  },

  togglePanel(tab) {
    if (Z.Trans.busy || this.clearInfo || this.dead || !['game', 'map'].includes(this.scene)) return false;
    return this.paused && this.tab === tab ? this.closePanel() : this.openPanel(tab);
  },

  hasSave() {
    const S = Z.Save.d;
    return Z.Save.status.writesBlocked || S.lv > 1 || S.exp > 0 || S.gold > 0 ||
      S.cleared.some(Boolean) || S.bag.length > 0 || S.pets.owned.length > 0 || S.stats.kills > 0;
  },

  startNew(confirmed) {
    if (!confirmed && this.hasSave()) { this.confirmNew = !this.confirmNew; return; }
    this.confirmNew = false;
    Z.Save.reset();
    this.beginGame();
    // 重开新档同样先看序幕。
    this.prologue = true;
    this.prologueT0 = 0;
  },

  startContinue() {
    this.beginGame();
  },

  beginGame() {
    this.player = new Player(0, 0);
    this.player.level = null;
    this.toMap();
  },

  toTitle() {
    if (this.scene === 'game' && this.level && this.level.bossDone && !this.clearInfo && this.player === this.level.player) {
      this.levelClear(this.level.stats);
      return;
    }
    this.lootReview = null;
    this.dismantleConfirm = null;
    this.prologue = false;
    this.prologueT0 = 0;
    this._openBagOnMap = false;
    if (this.player) this.player.relicEffect = null;
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    if (this.player) this.player.clearActionBuffer();
    if (this.player) this.player.clearSkillShadows();
    const m = Z.Input.mouse;
    Z.Trans.go(() => {
      Z.Save.save();
      this.scene = 'title';
      if (this.player) this.player.clearSkillShadows();
      this.level = null;
      this.clearInfo = null;
      this.dead = false;
      this.paused = false;
      this.achOpen = false;
      this.gearInspect = false;
      this.confirmNew = false;
      this.confirmReset = false;
      this.help = false;
      this.pendingImport = null;
      this.uiPetDemoAt = null;
      this.uiSkillDemoAt = null;
      this.slowT = 0;
      this.sceneT0 = this.time;
      Z.FX.clear();
      Z.Audio.music('menu');
    }, m.x, m.y);
  },

  toMap() {
    // 战胜后从暂停页离场也先结算，不能绕过光门把留场奖励丢掉。
    if (this.scene === 'game' && this.level && this.level.bossDone && !this.clearInfo && this.player === this.level.player) {
      this.levelClear(this.level.stats);
      return;
    }
    this.lootReview = null;
    this.dismantleConfirm = null;
    if (this.player) this.player.relicEffect = null;
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    if (this.player) this.player.clearActionBuffer();
    if (this.player) this.player.clearSkillShadows();
    const m = Z.Input.mouse;
    Z.Trans.go(() => {
      Z.Save.save();
      this.scene = 'map';
      if (this.player) this.player.clearSkillShadows();
      this.level = null;
      this.clearInfo = null;
      this.dead = false;
      this.paused = false;
      this.achOpen = false;
      this.gearInspect = false;
      this.confirmReset = false;
      this.help = false;
      this.pendingImport = null;
      this.uiPetDemoAt = null;
      this.uiSkillDemoAt = null;
      this.slowT = 0;
      this.sceneT0 = this.time;
      Z.FX.clear();
      Z.Audio.music('menu');
    }, m.x, m.y);
  },

  startLevel(idx, resume) {
    if (this.prologue || this.lootReview) return false;
    const lv = this.level;
    if (resume == null && this.dead && lv && lv.idx === idx) {
      resume = lv.tower ? { floor: lv.tower.floor }
        : lv.phase === 'boss' ? lv.def.waves.length : Math.max(0, lv.waveIdx);
    }
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    if (this.player) this.player.clearActionBuffer();
    if (this.player) this.player.clearSkillShadows();
    const m = Z.Input.mouse;
    Z.Trans.go(() => this._startLevel(idx, resume), m.x, m.y);
  },

  _startLevel(idx, resume) {
    this.lootReview = null;
    this.dismantleConfirm = null;
    this.prologue = false;
    this.prologueT0 = 0;
    this._openBagOnMap = false;
    if (this.player) this.player.relicEffect = null;
    Z.Audio.clearImpact();
    const resumeBoss = resume != null && this.level && this.level.idx === idx && this.level.phase === 'boss';
    const linkedComboLearned = !!(this.level && this.level.idx === idx && this.level.linkedComboLearned);
    if (!this.player) this.player = new Player(0, 0);
    this.player.clearActionBuffer();
    this.player.clearSkillShadows();
    this.player.comboIdx = 0;
    this.player.setState('idle');
    // 每次进关回满状态（友好设定）
    this.player.recomputeStats();
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.player.dead = false;
    this.player.wu = 0;
    this.player.ghostHp = null;
    // 清残留战斗状态（无敌/硬直/白闪等不带入新关）
    this.player.invulnT = 0;
    this.player.hitstunT = 0;
    this.player.flashT = 0;
    this.player.comboPop = 0;
    this.player.coyote = 0;
    this.player.jumps = 0;
    this.player.onGround = true;
    this.level = new Level(idx, this.player);
    this.level.linkedComboLearned = linkedComboLearned;
    // 续战：从指定波次/塔层继续（奖励保留）
    if (resume != null) {
      if (this.level.def.tower && typeof resume === 'object') {
        this.level.tower.floor = Math.max(1, resume.floor | 0);
        this.level.waveDelay = 1.2;
      } else if (typeof resume === 'number') {
        this.level.resumeWave(resumeBoss && this.level.zones ? this.level.def.waves.length : resume);
      }
    }
    this.scene = 'game';
    this.paused = false;
    this.achOpen = false;
    this.gearInspect = false;
    this.confirmReset = false;
    this.help = false;
    this.pendingImport = null;
    this.uiPetDemoAt = null;
    this.uiSkillDemoAt = null;
    this.clearInfo = null;
    this.dead = false;
    this.selItem = null;
    this.slowT = 0;
    this.sceneT0 = this.time;
    Z.FX.clear();
    Z.Audio.music(idx === 0 ? 'nantian' : idx >= 8 ? 'fire' : idx >= 5 ? 'sea' : 'battle');
    if (this.level.tower) this.level.prepareTowerFloor(resume == null);
  },

  setPet(pid) {
    if (!this.level) return;
    const pet = new Pet(pid, Z.Save.petGrow(pid).lv);
    pet.level = this.level;
    pet.x = this.level.player.x - 40;
    pet.y = this.level.gy;
    this.level.pet = pet;
  },

  overflowingNamedLoot() {
    if (!this.level) return [];
    return this.level.pickups.filter(pk => !pk.dead && pk.kind === 'item' && pk.item && pk.item.gearId)
      .slice(Math.max(0, 24 - Z.Save.d.bag.length)).map(pk => pk.item);
  },

  resolveLootReview(choice) {
    const review = this.lootReview;
    if (!review || review.level !== this.level || !['bag', 'recycle', 'cancel'].includes(choice)) return false;
    if (choice === 'recycle') {
      const items = this.overflowingNamedLoot();
      if (items.length && (items.length !== review.items.length || items.some((it, i) => it.uid !== review.items[i].uid))) {
        review.items = items;
        Z.UI.toast('行囊状态已变化，请重新确认待分解装备', '#ffd7a0');
        return false;
      }
      this.lootReview = null;
      return this.levelClear(review.stats, true);
    }
    this.lootReview = null;
    const lv = this.level;
    if (lv.portal) this.player.x = Z.U.clamp(lv.portal.x - 80, 40, lv.w - 40);
    this.player.vx = 0;
    Z.Input.clear();
    if (choice === 'bag') { this.bagPage = 'gear'; this.openPanel('bag'); }
    return true;
  },

  levelClear(stats, recycleConfirmed = false) {
    if (Z.Trans.busy || this.clearInfo) return;
    const overflow = this.overflowingNamedLoot();
    if (overflow.length && !recycleConfirmed) {
      this.lootReview = { items: overflow, stats, level: this.level };
      this.paused = false;
      this.player.clearActionBuffer();
      Z.Input.clear();
      Z.FX.clearImpact(); Z.Audio.clearImpact();
      return false;
    }
    this.dismantleConfirm = null;
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    const lv = this.level, p = this.player;
    // 已掉落的奖励在离场前完整入账；collect 自带去重与满包处理。
    // 腾出的格子优先留给具名掉落；其余满包处理仍沿用既有规则。
    const named = pk => pk.kind === 'item' && pk.item && pk.item.gearId;
    for (const pk of lv.pickups.filter(named).concat(lv.pickups.filter(pk => !named(pk)))) pk.collect(lv);
    lv.pickups = [];
    if (p) p.clearActionBuffer();
    if (p) p.clearSkillShadows();
    const sx = p ? p.x - lv.camX : 480, sy = p ? p.y - 40 : 270;
    Z.Trans.go(() => {
      const idx = lv.idx;
      const relicOwned = !!Z.BAL.relicOfStage[idx] && Z.Save.d.relics.owned.some(r => r.id === Z.BAL.relicOfStage[idx]);
      const materials = Z.BAL.relicMaterialReward(idx, !!Z.Save.d.cleared[idx], relicOwned);
      for (const key of Object.keys(materials)) {
        Z.Save.d.materials[key] = Math.min(999999, Z.Save.d.materials[key] + materials[key]);
      }
      stats.materials = materials;
      Z.Save.d.cleared[idx] = true;
      Z.Save.save();
      stats._t0 = this.time;
      this.clearInfo = stats;
      this.paused = false;
      this.achOpen = false;
      this.gearInspect = false;
      this.confirmReset = false;
      this.uiPetDemoAt = null;
      this.uiSkillDemoAt = null;
      if (p) p.clearSkillShadows();
      this.checkAch();
      Z.Audio.music('menu');
    }, sx, sy);
    return true;
  },

  gameOver() {
    this.lootReview = null;
    this.dismantleConfirm = null;
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    this.player.clearActionBuffer();
    this.player.clearSkillShadows();
    this.dead = true;
    this.paused = false;
    this.achOpen = false;
    this.gearInspect = false;
    this.confirmReset = false;
    this.uiPetDemoAt = null;
    this.uiSkillDemoAt = null;
    this.slowT = 0;
    this.deadT0 = this.time;
    Z.Save.save();
  },

  exportSave() {
    const blob = new Blob([Z.Save.exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = '悟空传存档-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Z.UI.toast('存档备份已导出，请妥善保留', '#74d4b5');
  },

  chooseSaveFile() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error('文件过大，请选择本游戏导出的 JSON 存档');
        const data = Z.Save.parseImport(await file.text());
        if (!this.paused || this.tab !== 'set') return;
        this.pendingImport = { data, summary: 'Lv.' + data.lv + ' · 金币 ' + data.gold + ' · 已通关 ' + data.cleared.filter(Boolean).length + ' 关' };
      } catch (e) { Z.UI.toast(e.message || '存档格式无法识别，当前进度未改变', '#ffb28b'); }
    };
    input.click();
  },

  restoreSave() {
    if (!this.pendingImport || !Z.Save.importData(this.pendingImport.data)) return false;
    this.pendingImport = null;
    this.closePanel();
    this.player = null;
    this.beginGame();
    Z.UI.toast('存档已恢复，继续你的西游之路', '#74d4b5');
    return true;
  },

  checkAch() {
    const S = Z.Save.d;
    for (const a of Z.BAL.achievements) {
      if (S.ach[a.id]) continue;
      let ok = false;
      try { ok = a.cond(S); } catch (e) { }
      if (ok) {
        S.ach[a.id] = true;
        S.stones += 2;
        Z.UI.toast('成就解锁：' + a.n + '（+2强化石）', '#ffd75e');
        Z.Audio.sfx('levelup');
        Z.Save.save();
      }
    }
  },
};

/* ================= 启动与主循环 ================= */
(() => {
  const cv = document.getElementById('cv');
  const g = cv.getContext('2d');
  Z.Input.attachMouse(cv);

  let scale = 1;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);
    const cw = Math.floor(960 * scale), ch = Math.floor(540 * scale);
    cv.style.width = cw + 'px';
    cv.style.height = ch + 'px';
    cv.width = Math.floor(960 * scale * dpr);
    cv.height = Math.floor(540 * scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // 正式冒险默认使用已认可的命中反馈；独立对照页可在加载后选择旧版。
  Z.FX.setImpactFeedback(true);
  Z.Audio.setImpactFeedback(true);
  Z.Save.load();
  if (!Z.Save.d.stats) Z.Save.d.stats = { kills: 0, maxCombo: 0 };
  if (!Z.Save.d.ach) Z.Save.d.ach = {};
  Z.Audio.music('menu');
  function pauseAway() {
    Z.Input.clear();
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    const G = Z.G;
    if (G.scene === 'game') Z.Save.save();
    if (G.scene === 'game' && !G.paused && !G.dead && !G.clearInfo) {
      if (!G.openPanel('pause')) G._pauseOnReturn = true;
    }
  }
  window.addEventListener('blur', pauseAway);
  window.addEventListener('pagehide', () => { if (Z.G.scene !== 'title') Z.Save.save(); });
  if (document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAway(); });

  const panelKeys = [
    ['menuBag', 'bag'], ['menuPet', 'pet'], ['menuSkill', 'skill'],
    ['menuShop', 'shop'], ['menuAch', 'ach'], ['menuSet', 'set'],
  ];
  let saveT = 0;

  function update(dt) {
    Z.G.time += dt;
    Z.Trans.update(dt);
    Z.Audio.update();
    const G = Z.G;
    if (G._pauseOnReturn && !Z.Trans.busy) {
      G._pauseOnReturn = false;
      if (G.scene === 'game') G.openPanel('pause');
    }
    // 结算面板「整理行囊」的一键直达：回地图落定后自动打开行囊（装备整理页）
    if (G._openBagOnMap && G.scene === 'map' && !Z.Trans.busy && !G.paused) {
      G._openBagOnMap = false;
      G.bagPage = 'gear';
      G.openPanel('bag');
    }
    if (G.help || G.prologue || G.pendingImport) {
      if (Z.Input.consume('pause')) { G.help = false; G.prologue = false; G.prologueT0 = 0; G.pendingImport = null; }
      Z.Input.endUpdate();
      return;
    }
    if (G.lootReview) {
      if (Z.Input.consume('pause')) G.resolveLootReview('cancel');
      Z.Input.endUpdate();
      return;
    }
    if (G.dismantleConfirm && Z.Input.consume('pause')) {
      G.dismantleConfirm = null;
      Z.Input.endUpdate();
      Z.Input.mouse.clicked = false;
      return;
    }
    // 窗口切换消费该帧输入，关闭时也不把同时按下的攻击带入战斗。
    if (Z.Input.consume('pause') && !Z.Trans.busy && !G.clearInfo && !G.dead &&
        ['game', 'map'].includes(G.scene)) {
      if (G.paused) G.closePanel(); else G.openPanel('pause');
      Z.Audio.sfx('click');
      return;
    }
    for (const [action, tab] of panelKeys) {
      if (Z.Input.consume(action) && G.togglePanel(tab)) { Z.Audio.sfx('click'); return; }
    }
    if (G.scene === 'game' && G.level && G.level.tower && G.level.tower.ready &&
        !G.paused && !G.dead && !G.clearInfo && !Z.Trans.busy) {
      if (Z.Input.consume('confirm')) G.level.confirmTowerFloor();
      Z.FX.update(dt); // 阵前冻结战斗，已发生的击杀闪光和奖励粒子正常收尾。
      Z.Input.endUpdate();
      return;
    }
    if (G.scene === 'game') {
      // 慢动作（死亡/Boss击杀演出）：世界与特效一起放慢
      let ts = 1;
      if (!G.paused && G.slowT > 0) { G.slowT -= dt; ts = 0.3; }
      if (!G.paused && !G.clearInfo && !G.dead && !Z.Trans.busy) {
        Z.Save.d.playTime += dt;
        saveT += dt;
        if (saveT >= 30) { saveT = 0; Z.Save.save(); }
        const frozen = Z.FX.consumeImpact(dt);
        if (frozen) G.player.captureImpactInput();
        else { G.level.update(dt * ts); Z.Audio.flushImpact(); }
        Z.FX.update(dt * ts, frozen || Z.FX.impactRemaining() > 0);
      } else if (G.dead || G.clearInfo) {
        Z.FX.clearImpact(); Z.Audio.clearImpact();
        Z.FX.update(dt * ts);
      } else {
        Z.FX.clearImpact(); Z.Audio.clearImpact();
      }
    }
  }

  function render() {
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    g.clearRect(0, 0, 960, 540);
    const G = Z.G;
    if (G.scene === 'game' && G.level) {
      G.level.draw(g);
    } else {
      // 空底色（标题/地图界面自带背景）
      g.fillStyle = '#1a2233';
      g.fillRect(0, 0, 960, 540);
    }
    Z.UI.drawFrame(g, G);
    Z.Trans.draw(g);   // 转场永远盖在最顶层
    cv.style.cursor = Z.UI.hovering ? 'pointer' : 'default';
  }

  let last = performance.now();
  const bootStart = last;
  let bootReady = false;
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 4) {
      try { update(STEP); } catch (err) {
        // 单帧异常不应杀死整个游戏循环
        console.error(err);
        if (window.__errs && window.__errs.length < 20) window.__errs.push(String(err && err.stack || err));
      }
      acc -= STEP; n++;
    }
    if (n === 4) acc = 0;
    if (n > 0) Z.Input.endUpdate(); // 逻辑帧消费完本帧按键
    render();
    const boot = document.getElementById('boot');
    if (!bootReady && (typeof Image === 'undefined' ||
        Z.Spr.heroArtReady() && Z.Spr.equipmentArtReady() && Z.BG.artReady() || now - bootStart >= 3500)) {
      bootReady = true;
      if (Z.G.scene === 'title') { Z.G.sceneT0 = Z.G.time; Z.Input.clear(); }
    }
    if (bootReady && boot && boot.id === 'boot' && boot.dataset.failed !== 'true') boot.hidden = true;
    Z.Input.endFrame();             // 每个渲染帧清理鼠标点击
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 调试/测试用手动步进：无视 rAF 节流，稳定驱动逻辑帧
  Z.G.__step = function (n) {
    for (let i = 0; i < (n || 1); i++) {
      try { update(STEP); } catch (err) { console.error(err); }
      Z.Input.endUpdate();
    }
    render();
    Z.Input.endFrame();
  };
})();
