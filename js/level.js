/* ============================================================
 * level.js —— 关卡流程：波次刷怪 / Boss战 / 摄像机 / 传送门 / 掉落
 * ============================================================ */
'use strict';

/* ================= 战斗结算 ================= */
Z.Combat = {
  melee(src, box, dmgMul, o = {}) {
    const lv = src.level;
    if (!lv) return 0;
    if (src === lv.player && lv.hitEnvironment) lv.hitEnvironment(src, box);
    const targets = src.team === 'player'
      ? lv.enemies.concat(lv.boss && !lv.boss.dead ? [lv.boss] : [])
      : [lv.player];
    let hits = 0;
    for (const t of targets) {
      if (!t || t.dead || t.invulnT > 0) continue;
      if (!Z.U.aabb(box, t.hurtbox())) continue;
      if (o.hitId) {
        t._hm = t._hm || {};
        if (lv.time - (t._hm[o.hitId] || -99) < (o.hitIv || 0.3)) continue;
        t._hm[o.hitId] = lv.time;
      }
      const effective = Z.Combat.applyHit(src, t, dmgMul, o);
      if (!lv.combatQualityTrial || effective > 0) hits++;
    }
    return hits;
  },

  applyHit(src, t, dmgMul, o = {}) {
    const trial = !!(src.level && src.level.combatQualityTrial);
    if (trial && (!t || t.dead || t.invulnT > 0)) return 0;
    const crit = Z.U.chance((src.crit || 0) / 100);
    let dmg = o.flat ? dmgMul : src.atk * dmgMul;
    if (crit) dmg *= Z.BAL.player.critMult;
    dmg *= 1 - (t.def || 0) / ((t.def || 0) + 260);
    dmg = Math.max(1, Math.round(dmg));
    const hpBefore = t.hp;
    const accepted = t.takeDamage(dmg, { crit, kb: o.kb, launch: o.launch, down: o.down, heavy: o.heavy });
    const effective = Math.max(0, Math.min(dmg, hpBefore - Math.max(0, t.hp)));
    if (trial && (!accepted || !effective)) return 0;
    if (src.team === 'player' && src.onHitDealt) src.onHitDealt();
    // 嗜血词条
    if (src.team === 'player' && src.ls && src.hp < src.maxHp && !src.dead) {
      const heal = trial ? Math.min(effective, Math.max(1, Math.round(effective * src.ls)))
        : Math.max(1, Math.round(dmg * src.ls));
      src.hp = Math.min(src.maxHp, src.hp + heal);
      if (Z.U.chance(0.3)) Z.FX.add('heal', src.x + Z.U.rand(-10, 10), src.y - Z.U.rand(10, 50), { life: 0.5 });
    }
    if (o.shake) Z.FX.shake(o.shake, 0.2);
    if (trial) return effective;
  },
};

/* ================= 关卡 ================= */
class Level {
  constructor(idx, player) {
    this.def = Z.BAL.levels[idx];
    this.idx = idx;
    // 同一套控制与有效命中规则贯穿全程；历史对照页可显式关闭。
    this.combatQualityTrial = !Z.G || Z.G.combatQualityTrial !== false;
    this.gy = this.def.gy;
    this.time = 0;
    this.enemies = [];
    this.projs = [];
    this.pickups = [];
    this.hazards = []; // v83 首领燃斑（红孩儿真火落点）
    this.player = player;
    player.level = this;
    player.x = 120; player.y = this.gy;
    player.vx = 0; player.vy = 0;
    player.dead = false;
    this.pet = null;
    const S = Z.Save.d;
    if (S.pets.active && S.pets.owned.includes(S.pets.active)) {
      this.pet = new Pet(S.pets.active, Z.Save.petGrow(S.pets.active).lv);
      this.pet.level = this;
      this.pet.x = player.x - 40; this.pet.y = this.gy;
    }
    this.camX = 0;
    this.leadX = 0;
    this.waveIdx = -1;
    this.phase = 'waves';
    this.waveDelay = 1.4;
    this.zones = this.def.zones || null;
    this.tower = this.def.tower ? { floor: 1, ready: false, resting: false, plan: null, recovery: null } : null;
    this.boss = null;
    this.portal = null;
    this.bossDone = false;
    this.restUsed = false;
    const secretId = this.def.secret, secretConfig = Z.BAL.secrets && Z.BAL.secrets[secretId];
    this.secret = secretConfig ? { id: secretId, config: secretConfig, y: this.gy,
      open: !!S.discoveries[secretId], flashT: 0, retryT: 0 } : null;
    this.chests = (this.def.chests || []).map((x) => {
      const c = new Chest(x, this.gy);
      c.level = this;
      return c;
    });
    this.corpses = [];
    this.deadT = 0;
    this.banner = { str: this.def.name, sub: this.def.story || '', t: 0, dur: 2.2 };
    this.stats = { kills: 0, gold: 0, t: 0, maxCombo: 0 };
    this.bossBarT = 0;
  }

  get w() { return this.def.w; }

  hitEnvironment(src, box) {
    const s = this.secret;
    if (src !== this.player || src.dead || !s || s.open || s.retryT > 0 ||
        !Z.U.aabb(box, { x: s.config.x - 34, y: s.y - 64, w: 68, h: 64 })) return false;
    const result = Z.Save.claimDiscovery(s.id);
    if (!result.ok && !result.already) {
      s.retryT = 1;
      Z.UI.toast(result.reason || '未能保存发现，请稍后重试', '#efbc8b');
      return false;
    }
    s.open = true;
    if (!result.ok) return false;
    s.flashT = 1.2;
    this.stats.gold += result.reward.gold || 0;
    Z.Audio.sfx('buy');
    Z.FX.text(s.config.x, s.y - 82, '桃根灵藏 · 发现', { color: '#ffe4a0', size: 19 });
    Z.UI.toast('桃根灵藏：金币 +30 · 强化石 +1 · 灵木 +2', '#f5d997');
    for (let i = 0; i < 10; i++) Z.FX.add('spark', s.config.x + Z.U.rand(-25, 25), s.y - Z.U.rand(18, 60), { color: '#ffe7aa', life: .7 });
    return true;
  }

  isSafeRest() {
    if (this.tower) return !this.player.dead && this.tower.ready && this.tower.resting
      && this.enemies.every(e => e.dead) && (!this.boss || this.boss.dead)
      && !this.projs.some(pr => !pr.dead && pr.team === 'enemy');
    return !this.player.dead && this.phase === 'waves' && this.def.restX != null
      && this.waveIdx === this.def.waves.length - 1 && this.enemies.every(e => e.dead)
      && !this.projs.some(pr => !pr.dead && pr.team === 'enemy')
      && Math.abs(this.player.x - this.def.restX) <= 74 && Math.abs(this.player.y - this.gy) <= 24;
  }

  canRest() {
    return this.def.restX != null && !this.restUsed && !this.player.dead && this.phase === 'waves'
      && this.waveIdx === this.def.waves.length - 1 && this.enemies.length === 0
      && !this.projs.some(pr => !pr.dead && pr.team === 'enemy');
  }

  rest() {
    const p = this.player;
    if (!this.canRest() || Math.abs(p.x - this.def.restX) > 74 || Math.abs(p.y - this.gy) > 24) return false;
    if (p.hp >= p.maxHp && p.mp >= p.maxMp) {
      Z.UI.toast('状态充盈，灵泉可留待需要时使用', '#a7e0d1');
      return false;
    }
    const hp = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * .25));
    const mp = Math.min(p.maxMp - p.mp, Math.round(p.maxMp * .35));
    p.hp += hp; p.mp += mp;
    this.restUsed = true;
    Z.Audio.sfx('potion');
    Z.FX.text(p.x, p.y - p.h - 30, '灵泉  +' + Math.ceil(hp) + ' 生命  +' + Math.ceil(mp) + ' 法力', { color: '#a2f0cf', size: 15 });
    for (let i = 0; i < 9; i++) Z.FX.add('heal', p.x + Z.U.rand(-24, 24), p.y - Z.U.rand(12, 60), { life: .7 });
    return true;
  }

  banner2(str, sub, dur = 2) { this.banner = { str, sub, t: 0, dur }; }

  spawnEnemy(type, x, opts = {}) {
    const e = new Enemy(x, this.gy, type, this.idx);
    if (this.tower) {
      const f = this.tower.floor;
      e.maxHp = Math.round(e.maxHp * (1 + 0.13 * f)); e.hp = e.maxHp;
      e.atk = Math.round(e.atk * (1 + 0.05 * f));
      e.xp = Math.round(e.xp * (1 + 0.1 * f));
    }
    e.level = this;
    Object.assign(e, opts);
    this.enemies.push(e);
    for (let i = 0; i < 4; i++) Z.FX.add('dust', x + Z.U.rand(-14, 14), this.gy, {});
    return e;
  }
  spawnMinion(type, x) {
    const e = this.spawnEnemy(type, Z.U.clamp(x, 60, this.def.w - 60));
    e.xp = Math.round(e.xp * 0.5);
    return e;
  }
  spawnProj(p) { p.level = this; this.projs.push(p); }

  dropLoot(e) {
    const add = (pk) => { pk.level = this; this.pickups.push(pk); };
    const isBoss = !!e.isBoss;
    const rollItem = (boss) => {
      const t = this.idx;
      const pool = boss && !this.tower && Z.BAL.bossGearPools[this.idx];
      const gearId = pool ? Z.U.choice(pool) : undefined;
      const base = gearId ? Z.BAL.gearDefs[gearId].base : Z.U.choice(['weapon', 'head', 'armor', 'acc']);
      return Z.BAL.makeDropItem(base, t, Z.BAL.rollQuality(boss), gearId);
    };
    if (isBoss) {
      // 金币雨
      const total = Z.U.randi(e.goldMin, e.goldMax);
      let left = total, n = 0;
      while (left > 0 && n < 14) {
        const rolled = Z.U.randi(6, 16);
        const v = n === 13 ? left : Math.min(left, rolled);
        left -= v; n++;
        add(new Pickup(e.x + Z.U.rand(-50, 50), e.y - 60, { kind: 'gold', val: v, vy: Z.U.rand(-420, -260) }));
      }
      for (let i = 0; i < Z.BAL.drops.bossItems; i++) {
        add(new Pickup(e.x + Z.U.rand(-70, 70), e.y - 80, { kind: 'item', item: rollItem(true), vy: Z.U.rand(-380, -240) }));
      }
      for (let i = 0; i < Z.BAL.drops.bossStones; i++) {
        add(new Pickup(e.x + Z.U.rand(-60, 60), e.y - 70, { kind: 'stone', vy: Z.U.rand(-360, -240) }));
      }
      if (e.petball) {
        const firstClear = !this.tower && !Z.Save.d.cleared[this.idx];
        if (firstClear || Z.U.chance(0.25)) {
          add(new Pickup(e.x, e.y - 90, { kind: 'petball', petId: e.petball, vy: -400 }));
        }
      }
    } else {
      const total = Z.U.randi(e.goldMin, e.goldMax);
      if (total > 0) {
        const coins = Z.U.randi(1, 3);
        for (let i = 0; i < coins; i++) {
          add(new Pickup(e.x + Z.U.rand(-16, 16), e.y - 40, {
            kind: 'gold', val: Math.max(1, Math.round(total / coins)), vy: Z.U.rand(-300, -180),
          }));
        }
      }
      const D = Z.BAL.drops;
      if (Z.U.chance(D.stone)) add(new Pickup(e.x, e.y - 40, { kind: 'stone' }));
      if (Z.U.chance(D.potion)) add(new Pickup(e.x, e.y - 40, { kind: 'potion' }));
      if (Z.U.chance(D.item)) add(new Pickup(e.x, e.y - 46, { kind: 'item', item: rollItem(false) }));
    }
  }

  onKill(e) {
    this.stats.kills++;
    if (Z.Save.d.stats) Z.Save.d.stats.kills++;
    this.player.gainExp(e.xp);
    this.dropLoot(e);
    if (Z.G.checkAch) Z.G.checkAch();
  }

  // 镇妖塔：上一层。heal 为 Boss 层通关后的恢复奖励。
  towerAdvanceFloor(heal) {
    if (!this.tower || this.tower.ready || this.player.dead || this.enemies.some(e => !e.dead)
      || this.boss && !this.boss.dead) return false;
    const S = Z.Save.d;
    this.tower.floor++;
    S.towerBest = Math.max(S.towerBest || 0, this.tower.floor - 1);
    Z.Save.save();
    this.boss = null;
    this.bossDone = false;
    this.phase = 'waves';
    this.waveIdx = -1;
    this.waveDelay = 0.8;
    this.tower.recovery = null;
    if (heal) {
      const p = this.player;
      const hp = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * 0.3));
      const mp = Math.min(p.maxMp - p.mp, Math.round(p.maxMp * 0.4));
      p.hp += hp; p.mp += mp;
      this.tower.recovery = { hp, mp };
      Z.Audio.sfx('clear');
    }
    this.prepareTowerFloor(heal);
    if (Z.G.checkAch) Z.G.checkAch();
    return true;
  }

  onBossDead(boss) {
    // 标记旧迭代器中的弹体也已失效，覆盖伙伴弹同帧击杀与镇妖塔上楼。
    for (const pr of this.projs) if (pr.team === 'enemy') pr.dead = true;
    this.enemies = [];
    this.projs = this.projs.filter((pr) => pr.team !== 'enemy');
    // 镇妖塔：不结算，直接上楼
    if (this.def.tower) {
      Z.Audio.music('battle');
      this.towerAdvanceFloor(true);
      return;
    }
    this.phase = 'clear';
    this.bossDone = true;
    // 胜利后撤去敌方危险，保留已掉落奖励，不额外计杀敌或发经验。
    Z.G.slowT = Math.max(Z.G.slowT || 0, 0.45);   // 击杀Boss：短暂慢动作
    this.banner2('胜  利', boss.name + ' 已被击败', 2.4);
    Z.Audio.sfx('clear');
    this.portalDelay = 1.6;
    if (Z.G.checkAch) Z.G.checkAch();
  }

  onPlayerDead() {
    this.deadT = 1.5;
    Z.G.slowT = 1.0;   // 死亡慢动作演出
  }

  startWave(i) {
    this.waveIdx = i;
    if (this.def.tower) { this.startTowerWave(); return; }
    const wave = this.def.waves[i];
    if (!wave) return;
    const zone = this.zones && this.zones.waves[i];
    this.banner2(zone ? zone.banner : '第 ' + (i + 1) + ' 波', '', 1.2);
    this.spawnWaveGroup(wave, zone && zone.spawns);
  }

  // i=波次索引；i=波次数时，从 Boss 入口继续。
  resumeWave(i) {
    i = Z.U.clamp(i | 0, 0, this.def.waves.length);
    this.waveIdx = i - 1;
    this.waveDelay = 1.0;
    if (!this.zones) return;
    const zone = this.zones.waves[i] || this.zones.boss, p = this.player;
    p.x = zone.resumeX; p.y = this.gy; p.vx = 0; p.vy = 0;
    p.onGround = true; p.jumps = 0; p.setState('idle');
    this.camX = Z.U.clamp(p.x - 460, 0, this.def.w - 960);
    this.leadX = 0;
    if (this.pet) { this.pet.x = p.x - 40; this.pet.y = this.gy; }
  }

  spawnWaveGroup(wave, positions) {
    let n = 0;
    for (const g of wave) {
      for (let k = 0; k < g.n; k++) {
        if (positions) {
          this.spawnEnemy(g.t, positions[n++], { facing: -1 });
          continue;
        }
        const side = n % 2 === 0 ? 1 : -1;
        let x = this.player.x + side * Z.U.rand(340, 620);
        x = Z.U.clamp(x, 80, this.def.w - 80);
        // 避免正好刷在玩家脚下
        if (Math.abs(x - this.player.x) < 200) x += side * 240;
        this.spawnEnemy(g.t, Z.U.clamp(x, 80, this.def.w - 80));
        n++;
      }
    }
  }

  /* ---- 镇妖塔：无尽波次 ---- */
  towerFloorPlan(f) {
    if (f % 4 === 0) {
      const pool = f < 8 ? ['juling', 'zengzhang']
        : f < 12 ? ['juling', 'zengzhang', 'chiguo'] : ['zengzhang', 'chiguo', 'erlang'];
      const bossId = Z.U.choice(pool);
      const hints = { juling: '避开斧光与落砸，收势时再近身。', zengzhang: '横移避开剑气，留意守军与剑阵预警。',
        chiguo: '观察音波间隙，用跳跃与平台换位。', erlang: '天眼亮起先移开，连击收势后再反击。' };
      return { floor: f, formationId: 'guardian', name: Z.BAL.bosses[bossId].name,
        hint: hints[bossId], bossId, wave: [] };
    }
    // 四种主线编队按普通层序号轮换；数量与成长沿用既有曲线。
    const i = (f - Math.floor(f / 4) - 1) % 4;
    const formations = [
      { id: 'bows', name: '双弦阵', hint: '天兵护住弓手；先换位切入远程，别站在两侧箭线之间。',
        order: ['tianbing', 'gongshou', 'tianbing', 'gongshou', 'tianbing', 'gongshou', 'tianbing', 'tianbing', 'gongshou'] },
      { id: 'wings', name: '掠翼阵', hint: '看到红星先横移；飞天妖俯冲扑空后，有一段落地空档。',
        order: ['feiyao', 'tianbing', 'feiyao', 'tianbing', 'gongshou', 'tianbing', 'feiyao', 'tianbing', 'gongshou'] },
      { id: 'guard', name: '铁卫阵', hint: '天将不易被打断；先清远程，再抓挥枪后的收势。',
        order: ['tianjiang', 'tianbing', 'gongshou', 'tianbing', 'feiyao', 'gongshou', 'tianbing', 'feiyao', 'tianbing'] },
      { id: 'hunt', name: '追风阵', hint: '哮天犬追击很快；保持退路，借两块平台换边。',
        order: ['xiaotian', 'feiyao', 'xiaotian', 'gongshou', 'tianbing', 'feiyao', 'tianbing', 'xiaotian', 'gongshou'] },
    ];
    const formation = formations[i], n = Math.min(3 + Math.round(f * 0.8), 9), wave = [];
    for (const t of formation.order.slice(0, n)) {
      const group = wave.find(w => w.t === t);
      if (group) group.n++; else wave.push({ t, n: 1 });
    }
    return { floor: f, formationId: formation.id, name: formation.name, hint: formation.hint,
      bossId: null, wave };
  }

  prepareTowerFloor(resting = false) {
    if (!this.tower || this.player.dead || this.enemies.some(e => !e.dead)
      || this.boss && !this.boss.dead) return false;
    if (this.tower.ready && this.tower.plan && this.tower.plan.floor === this.tower.floor) return true;
    // 已生成奖励只入账一次；不另发过层奖励，也不清掉尚未拾取的战利品。
    const collected = this.pickups.some(pk => !pk.dead);
    for (const pk of this.pickups) pk.collect(this);
    this.pickups = [];
    if (collected) Z.Save.save();
    for (const pr of this.projs) pr.dead = true;
    this.projs = [];
    if (!this.tower.plan || this.tower.plan.floor !== this.tower.floor) this.tower.plan = this.towerFloorPlan(this.tower.floor);
    this.tower.ready = true;
    this.tower.resting = !!resting;
    this.phase = 'waves'; this.waveIdx = -1;
    const p = this.player;
    p.clearActionBuffer(); p.clearSkillShadows(); p.comboIdx = 0; p.setState('idle');
    p.vx = 0; p.vy = 0;
    // 回到场内再布阵，边缘清层也不会把下一阵刷在脚下。
    p.x = this.tower.plan.bossId ? this.w - 840 : Z.U.clamp(p.x, 460, this.w - 460);
    p.y = this.gy; p.onGround = true; p.jumps = 0;
    if (this.pet) { this.pet.x = p.x - 40; this.pet.y = this.gy; }
    this.camX = this.tower.plan.bossId ? this.w - 960 : Z.U.clamp(p.x - 460, 0, this.w - 960); this.leadX = 0;
    Z.Input.clear(); Z.FX.clearImpact(); Z.Audio.clearImpact();
    return true;
  }

  confirmTowerFloor() {
    const G = Z.G;
    if (!this.tower || !this.tower.ready || this.player.dead || !this.tower.plan
      || this.tower.plan.floor !== this.tower.floor || G && (G.paused || G.dead || G.clearInfo
        || G.lootReview || G.help || G.pendingImport || G.prologue) || Z.Trans.busy) return false;
    this.player.clearActionBuffer();
    Z.Input.clear(); Z.FX.clearImpact(); Z.Audio.clearImpact();
    this.startTowerWave();
    return true;
  }

  startTowerWave() {
    const f = this.tower.floor;
    if (!this.tower.plan || this.tower.plan.floor !== f) this.tower.plan = this.towerFloorPlan(f);
    const plan = this.tower.plan;
    this.tower.ready = false; this.tower.resting = false; this.tower.recovery = null;
    this.phase = 'waves'; this.waveIdx = 0; this.waveDelay = 0.8;
    this.banner2('第 ' + f + ' 层 · ' + plan.name, plan.bossId ? '镇守者来袭' : '守军已布阵', 1.5);
    if (plan.bossId) { this.startTowerBoss(f, plan.bossId); return; }
    let melee = 0, ranged = 0;
    for (const group of plan.wave) for (let k = 0; k < group.n; k++) {
      const far = !!Z.BAL.enemies[group.t].ranged, rank = far ? ranged++ : melee++;
      const side = rank % 2 ? 1 : -1, distance = (far ? 360 : 220) + Math.floor(rank / 2) * 30;
      const x = Z.U.clamp(this.player.x + side * distance, 60, this.w - 60);
      this.spawnEnemy(group.t, x, { facing: -side });
    }
  }

  startTowerBoss(f, chosen) {
    this.tower.ready = false; this.tower.resting = false;
    this.tower.recovery = null; this.waveIdx = 0;
    this.phase = 'boss';
    const pool = f < 8 ? ['juling', 'zengzhang']
      : f < 12 ? ['juling', 'zengzhang', 'chiguo']
        : ['zengzhang', 'chiguo', 'erlang'];
    const bid = chosen || Z.U.choice(pool);
    const b = new Boss(this.def.w - 480, this.gy, bid, this.idx);
    b.level = this;
    const hpM = 1 + 0.16 * f, atkM = 1 + 0.05 * f;
    b.maxHp = Math.round(b.maxHp * hpM); b.hp = b.maxHp;
    b.atk = Math.round(b.atk * atkM);
    this.boss = b;
    this.bossBarT = 0;
    this.banner2(b.name, '镇妖塔 · 第 ' + f + ' 层', 2);
    Z.Audio.sfx('bossroar');
    Z.Audio.music('boss');
  }

  startBoss() {
    this.phase = 'boss';
    const bid = this.def.boss;
    const b = new Boss(this.def.w - 480, this.gy, bid, this.idx);
    b.level = this;
    // 首关试玩加重失误代价，不靠增加生命延长战斗；技能与药水仍沿用原值。
    if (this.combatQualityTrial && this.idx === 0) b.atk = 20;
    this.boss = b;
    this.bossBarT = 0;
    this.banner2(b.name, b.title, 2.2);
    // v82 出场压迫感：震屏 + 落点冲击环 + 脚下扬尘（纯演出，不改判定）
    Z.FX.shake(6, .5);
    Z.FX.add('ring', b.x, b.y - 10, { r: 70, life: .55, sq: .3 });
    for (let i = 0; i < 8; i++) Z.FX.add('dust', b.x + Z.U.rand(-52, 52), b.y, {});
    Z.Audio.sfx('bossroar');
    Z.Audio.music(this.idx === 0 ? 'nantian_boss' : this.idx >= 8 ? 'fire_boss' : this.idx >= 5 ? 'sea_boss' : 'boss');
  }

  update(dt) {
    if (this.tower && !this.tower.plan) this.prepareTowerFloor(this.tower.floor === 1);
    if (this.tower && this.tower.ready) return;
    this.time += dt;
    this.stats.t += dt;
    this.banner.t += dt;
    if (this.secret) {
      this.secret.flashT = Math.max(0, this.secret.flashT - dt);
      this.secret.retryT = Math.max(0, this.secret.retryT - dt);
    }
    const p = this.player;

    p.update(dt);
    if (this.tower && this.tower.ready) {
      // 击杀可能发生在本体动作内部；清掉返回旧动作后追加的连棍、残影和位移。
      p.clearActionBuffer(); p.clearSkillShadows(); p.comboIdx = 0; p.setState('idle');
      p.vx = 0; p.vy = 0; p.y = this.gy; p.onGround = true; p.jumps = 0;
      return;
    }
    if (this.pet) this.pet.update(dt);
    if (this.tower && this.tower.ready) return;
    const enemyZone = this.zones && this.phase === 'waves' && this.zones.waves[this.waveIdx];
    for (const e of this.enemies) {
      e.update(dt);
      // 所有驻守战场均保留可追击空间，包含原南天门未写专用边界的阵型。
      // 左侧仍可自由追退；远程敌人不会躲到玩家结界外。
      if (enemyZone) {
        const boundary = enemyZone.enemyForwardBoundary ?? enemyZone.forwardBoundary - 40;
        e.x = Math.min(e.x, boundary);
        if (e.x >= boundary && e.vx > 0) e.vx = 0;
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.boss && !this.boss.dead) this.boss.update(dt);
    for (const pr of this.projs) {
      // 伙伴弹在此循环内击杀Boss时，旧数组迭代器仍可能持有敌弹。
      if (pr.dead || this.bossDone && pr.team === 'enemy') continue;
      pr.update(dt);
    }
    if (this.tower && this.tower.ready) return;
    this.projs = this.projs.filter((pr) => !pr.dead);
    // v83 首领燃斑：落点区域封锁，短暂燃烧后熄灭
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.t += dt; hz.tick -= dt;
      if (hz.t >= hz.dur || !hz.src || hz.src.dead || this.bossDone) { this.hazards.splice(i, 1); continue; }
      const pl = this.player;
      if (!pl.dead && pl.invulnT <= 0 && hz.tick <= 0 && Math.abs(pl.y - this.gy) < 40 &&
          pl.x + 14 > hz.x - hz.w / 2 && pl.x - 14 < hz.x + hz.w / 2) {
        hz.tick = 0.5;
        Z.Combat.applyHit(hz.src, pl, hz.src.atk * 0.3, { flat: true, kb: Z.U.sign(pl.x - hz.x) * 60 });
      }
    }
    for (const pk of this.pickups) pk.update(dt);
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    for (const c of this.chests) c.update(dt);
    this.corpses = this.corpses.filter((c) => updateCorpse(c, dt, this));
    if (Z.Input.consume && Z.Input.consume('interact')) this.rest();

    // 波次推进
    if (this.phase === 'waves' && this.enemies.length === 0) {
      this.waveDelay -= dt;
      // 地理关卡在到达触发线时就布阵，避免延时让玩家跑进刷怪点。
      if (this.waveDelay <= 0 || this.zones) {
        if (this.zones) {
          const next = this.waveIdx + 1, zone = this.zones.waves[next] || this.zones.boss;
          if (!p.dead && p.x >= zone.triggerX) {
            if (next < this.def.waves.length) { this.startWave(next); this.waveDelay = 0.8; }
            else this.startBoss();
          }
        } else if (this.def.tower) {
          // 清层只进入准备，绝不与上一层结束同帧刷下一阵。
          if (this.waveIdx >= 0) this.towerAdvanceFloor(false);
          else this.prepareTowerFloor(false);
          if (this.tower.ready) return;
        }
        else {
          const next = this.waveIdx + 1;
          if (next < this.def.waves.length) { this.startWave(next); this.waveDelay = 0.8; }
          else this.startBoss();
        }
      }
    }

    // 守军未清时只挡住前进方向，仍可向左退回云桥。
    const guardZone = this.zones && this.phase === 'waves' && this.enemies.length > 0
      && this.zones.waves[this.waveIdx];
    if (guardZone) p.x = Math.min(p.x, guardZone.forwardBoundary);

    // Boss 死亡 → 传送门
    if (this.bossDone && !this.portal) {
      this.portalDelay -= dt;
      if (this.portalDelay <= 0) {
        const px = Z.U.clamp(p.x + 240, 120, this.def.w - 120);
        this.portal = { x: px };
        Z.FX.add('portal', px, this.gy, { life: 9999 });
        Z.Audio.sfx('portal');
      }
    }

    // 玩家死亡流程
    if (p.dead && this.deadT > 0) {
      this.deadT -= dt;
      if (this.deadT <= 0) Z.G.gameOver();
    }

    // 传送门进入
    if (this.portal && !p.dead) {
      if (Math.abs(p.x - this.portal.x) < 34 && Math.abs(p.y - this.gy) < 40) {
        Z.Audio.sfx('portal');
        Z.G.levelClear(this.stats);
        return;
      }
    }

    // Boss 战锁屏
    if (this.phase === 'boss' && this.boss && !this.boss.dead) {
      const lockL = this.def.w - 960 + 40, lockR = this.def.w - 40;
      p.x = Z.U.clamp(p.x, lockL, lockR);
      for (const e of this.enemies) e.x = Z.U.clamp(e.x, lockL, lockR);
      this.boss.x = Z.U.clamp(this.boss.x, lockL + this.boss.w / 2, lockR - this.boss.w / 2);
    }

    // 摄像机（朝向预判平滑跟随，转向不甩镜头）
    this.leadX = Z.U.lerp(this.leadX || 0, p.facing * 60, Math.min(1, 3 * dt));
    const target = Z.U.clamp(p.x - 460 + this.leadX, 0, this.def.w - 960);
    if (this.phase === 'boss' && this.boss && !this.boss.dead) {
      this.camX = Z.U.approach(this.camX, this.def.w - 960, 8 * dt * Math.max(120, Math.abs(this.camX - (this.def.w - 960))));
    } else {
      this.camX = Z.U.approach(this.camX, target, 6 * dt * Math.max(120, Math.abs(this.camX - target)));
    }
  }

  draw(g) {
    Z.BG.draw(g, this.def.theme, this.camX, this.def.w, this.gy, this.time, this.def.platforms, this.idx);
    const so = Z.FX.shakeOffset();
    g.save();
    g.translate(-this.camX + so.x, so.y);

    if (this.secret && Z.Spr.drawSecret) Z.Spr.drawSecret(g, this.secret, this.time);

    // v83 首领燃斑：火焰斑块随时间熄灭
    for (const hz of this.hazards) {
      const fade = Math.min(1, 2.5 * (1 - hz.t / hz.dur));
      const flick = 0.72 + 0.28 * Math.sin(this.time * 13 + hz.x);
      g.save();
      g.globalAlpha = fade * 0.85;
      Z.Spr.ell(g, hz.x, this.gy - 3, hz.w * 0.55, 7, '#b23c1a');
      g.globalAlpha = fade * 0.8 * flick;
      for (let fi = -1; fi <= 1; fi++) {
        const fh = 12 - Math.abs(fi) * 4 + Math.sin(this.time * 9 + fi * 2.2) * 3.5;
        Z.Spr.ell(g, hz.x + fi * 19, this.gy - fh, 5.5, fh, fi === 0 ? '#ffc257' : '#ff8a3d');
      }
      g.restore();
    }

    if (this.def.restX != null) {
      const x = this.def.restX, y = this.gy, ready = this.canRest();
      g.save();
      // 仙泉立于主路后沿：小玉盏与灵珠，不伪装成可站平台。
      Z.Spr.ell(g, x, y - 2, 31, 7, 'rgba(12,36,43,.24)');
      g.fillStyle = '#547c79'; g.fillRect(x - 16, y - 20, 32, 17);
      g.fillStyle = '#a2c2af'; g.fillRect(x - 20, y - 24, 40, 6);
      g.fillStyle = '#d6c08a'; g.fillRect(x - 22, y - 27, 44, 3);
      g.beginPath(); g.ellipse(x, y - 30, 23, 9, 0, 0, Z.U.TAU);
      g.fillStyle = '#e4debb'; g.fill(); g.strokeStyle = '#536f6b'; g.lineWidth = 2; g.stroke();
      Z.Spr.ell(g, x, y - 31, 17, 5, this.restUsed ? '#829b92' : '#75cfc0');
      if (!this.restUsed) {
        const lift = Math.sin(this.time * 2) * 3;
        Z.Spr.ell(g, x, y - 51 + lift, 17, 17, ready ? 'rgba(135,234,207,.16)' : 'rgba(135,234,207,.06)');
        Z.Spr.ell(g, x, y - 51 + lift, 6, 8, ready ? '#c3f6dc' : '#8caea0');
        g.strokeStyle = '#decd8f'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y - 50 + lift, 12, 4, -.35, 0, Z.U.TAU); g.stroke();
      }
      const near = Math.abs(this.player.x - x) < 165;
      if (near && this.phase === 'waves' && this.enemies.length === 0) {
        Z.Spr.text(g, this.restUsed ? '灵泉已用 · 迎战前方守将' : ready ? 'E / 空格  饮灵泉' : '平息此地守军，灵泉方能显现', x, y - 112,
          { size: 13, color: '#e6efce', bold: true, stroke: '#1c3c42', strokeW: 4 });
        if (ready) Z.Spr.text(g, '生命 +25% · 法力 +35% · 本关一次', x, y - 94,
          { size: 11, color: '#b9d9c6', stroke: '#1c3c42', strokeW: 3 });
      }
      g.restore();
    }

    const guardZone = this.zones && this.phase === 'waves' && this.enemies.length > 0
      && this.zones.waves[this.waveIdx];
    if (guardZone) {
      // 结界高过二段跳路线，视觉范围与空中阻挡一致。
      const x = guardZone.forwardBoundary, top = this.zones.barrierTop != null ? this.zones.barrierTop : this.gy - 330;
      g.save();
      g.strokeStyle = 'rgba(116,206,213,0.76)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, this.gy);
      g.bezierCurveTo(x - 5, this.gy - 35, x + 5, top + 35, x, top); g.stroke();
      g.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) {
        const y = top + 20 + i * 48;
        g.beginPath(); g.moveTo(x - 15, y + 5);
        g.bezierCurveTo(x - 22, y - 8, x - 2, y - 12, x, y - 3);
        g.bezierCurveTo(x + 5, y - 16, x + 23, y - 4, x + 14, y + 5); g.stroke();
        g.strokeStyle = 'rgba(242,211,136,0.68)';
        g.beginPath(); g.moveTo(x - 9, y + 8);
        g.quadraticCurveTo(x, y + 14, x + 9, y + 8); g.stroke();
        g.strokeStyle = 'rgba(116,206,213,0.76)';
      }
      g.fillStyle = '#efd495';
      g.beginPath(); g.arc(x, top, 3, 0, Z.U.TAU); g.fill();
      const labelX = Z.U.clamp(x, this.camX + 88, this.camX + 872);
      if (x >= this.camX - 20 && x <= this.camX + 980) Z.Spr.text(g, '清除守军后通行', labelX, Math.max(this.gy - 342, top - 12), {
        size: 12, color: '#f0dcaa', stroke: 'rgba(24,51,61,0.85)', strokeW: 3,
      });
      g.restore();
    }

    if (this.pet) this.pet.draw(g);
    for (const c of this.chests) c.draw(g);
    for (const pk of this.pickups) pk.draw(g);
    for (const e of this.enemies) e.draw(g);
    if (this.boss && !this.boss.dead) this.boss.draw(g);
    this.player.draw(g);
    for (const pr of this.projs) pr.draw(g);

    // 尸体层
    for (const c of this.corpses) {
      g.save();
      g.globalAlpha = Math.max(0, 1 - c.t / c.life);
      g.translate(c.x, c.y);
      g.rotate((c.facing || 1) * c.t * (c.spin || 3));
      g.translate(-c.x, -c.y);
      const fake = {
        x: c.x, y: c.y, facing: c.facing, w: c.w, h: c.h,
        type: c.type, bid: c.bid,
        state: 'hurt', stateT: 0, animClock: 0, flashT: 0,
        groundY: this.gy, invulnT: 0, vy: c.vy, onGround: false,
      };
      if (c.isBoss) Z.Spr.drawBoss(g, fake, 0);
      else Z.Spr.drawMob(g, fake);
      g.restore();
    }

    Z.FX.draw(g, this.camX - so.x, -so.y);
    g.restore();

    // v80 章节氛围纱+暗角（屏幕空间；接口缺失时静默跳过）
    if (Z.FX.atmosphere) Z.FX.atmosphere(g, this.def.theme, this.time,
      { boss: this.phase === 'boss' && this.boss && !this.boss.dead });
    // v81 主题环境粒子（浮尘/落瓣/气泡/余烬）
    if (Z.FX.ambient) Z.FX.ambient(g, this.def.theme, this.time);

    // 驻守战斗与清波后的前进目标。
    if (this.zones && this.phase === 'waves' && !this.player.dead) {
      const zone = this.zones.waves[this.waveIdx + 1] || this.zones.boss;
      const goal = this.enemies.length > 0 ? '清除守军 · 剩余 ' + this.enemies.length : zone.goal + '  →';
      g.save();
      const face = g.createLinearGradient(0, 40, 0, 72);
      face.addColorStop(0, 'rgba(40,77,64,.94)'); face.addColorStop(1, 'rgba(20,53,43,.94)');
      g.fillStyle = face;
      g.beginPath(); g.moveTo(371, 40); g.lineTo(589, 40); g.lineTo(596, 47);
      g.lineTo(596, 65); g.lineTo(589, 72); g.lineTo(371, 72); g.lineTo(364, 65); g.lineTo(364, 47); g.closePath(); g.fill();
      g.strokeStyle = '#a79765'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#cab77f'; g.fillRect(378, 44, 24, 1); g.fillRect(558, 68, 24, 1);
      Z.Spr.text(g, goal, 480, 57, { size: 13, color: '#eddfb6', bold: true });
      g.restore();
    }

    // Boss 出场电影黑边
    if (this.boss && this.boss.state === 'intro') {
      const k = Math.min(1, this.boss.stateT / 0.35);
      g.save();
      g.fillStyle = 'rgba(5,7,12,0.92)';
      g.fillRect(0, 0, 960, 54 * k);
      g.fillRect(0, 540 - 54 * k, 960, 54 * k);
      g.fillStyle = 'rgba(245,197,66,0.85)';
      g.fillRect(0, 54 * k - 2, 960, 2);
      g.fillRect(0, 540 - 54 * k, 960, 2);
      g.restore();
    }

    // 屏幕空间：波次/Boss 横幅
    if (this.banner.t < this.banner.dur + 0.5) {
      const b = this.banner;
      const k = b.t < 0.3 ? b.t / 0.3 : (b.t > b.dur ? Math.max(0, 1 - (b.t - b.dur) / 0.5) : 1);
      if (k > 0) {
        g.save();
        g.globalAlpha = k;
        if (b.sub) {
          g.fillStyle = 'rgba(10,14,26,0.45)';
          g.fillRect(0, 196, 960, 92);
          Z.Spr.text(g, b.str, 480, 228, { size: 40, color: '#ffd75e', bold: true, stroke: 'rgba(40,20,0,0.8)', strokeW: 6 });
          Z.Spr.text(g, b.sub, 480, 264, { size: 17, color: '#f0e6d2' });
        } else {
          Z.Spr.text(g, b.str, 480, 232, { size: 38, color: '#ffd75e', bold: true, stroke: 'rgba(40,20,0,0.8)', strokeW: 6 });
        }
        g.restore();
      }
    }
  }
}

Z.Level = Level;
