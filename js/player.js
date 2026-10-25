/* ============================================================
 * player.js —— 悟空：操作、三连击、技能、无双、成长
 * ============================================================ */
'use strict';

class Player extends Fighter {
  constructor(x, y) {
    super(x, y, {
      w: 34, h: 66, team: 'player', spd: 252, friction: 0.02,
    });
    this.wu = 0;             // 无双槽 0-100
    this.mp = 60; this.maxMp = 60;
    this.jumps = 0;
    this.comboIdx = 0;
    this.comboQueued = false;
    this.actionBuffer = null; // 只记一次收势末段输入，完整出招后执行
    this._impactAction = null; this._impactPotion = null;
    this.comboHits = 0; this.comboT = 0; this.comboPop = 0; // 连击计数（显示用）
    this.cds = { hy: 0, jd: 0, qs: 0 };
    this.skillAction = null;
    this.skillShadows = [];
    this.slashBeat = 0; this.slashConnected = false; this.slashLastHit = false;
    this.heavyLinked = false;
    this.heavyHitTime = Z.BAL.skills.hy.hitTime; this.heavyDur = Z.BAL.skills.hy.dur;
    this._linkBlocked = false; this._linkFinish = false;
    this._slashStopX = null; this._slashShadowBeats = new Set();
    this._skillLevel = null; this._skillHitTargets = new Set();
    this.potCd = 0;
    this.relicCd = 0;
    this.relicEffect = null;
    this._denyT = 0;
    this.mpRegenT = 0;
    this.visual = { runPhase: 0, cape: 0, capeV: 0, tail: 0, tailV: 0 };
    this._visualVx = 0; this._visualFacing = this.facing;
    this.recomputeStats();
    this.hp = this.maxHp; this.mp = this.maxMp;
    this.setState('idle');
  }

  /* ---- 数值成长（等级+装备） ---- */
  // 背包只读预览与正式穿戴共用公式，不改存档、当前生命或法力。
  static equipmentStats(equip = Z.Save.d.equip, lv = Z.Save.d.lv, relic = Z.Save.d.relics && Z.Save.d.relics.owned.find(r => r.uid === Z.Save.d.relics.active)) {
    const B = Z.BAL.player;
    let hp = B.baseHp + B.hpPerLv * (lv - 1);
    let mp = B.baseMp + B.mpPerLv * (lv - 1);
    let atk = B.baseAtk + B.atkPerLv * (lv - 1);
    let def = B.baseDef + B.defPerLv * (lv - 1);
    let crit = B.baseCrit;
    let hpPct = 0, atkPct = 0, defPct = 0, cdr = 0, ls = 0, goldPct = 0, spdAdd = 0;
    let hpRegen = 0, mpRegen = 4.5;
    for (const slot in equip) {
      const it = equip[slot];
      if (!it) continue;
      const st = Z.BAL.itemStat(it);
      hp += st.hp || 0; mp += st.mp || 0; atk += st.atk || 0; def += st.def || 0; crit += st.crit || 0;
      hpRegen += st.hpRegen || 0; mpRegen += st.mpRegen || 0;
      hpPct += st.hpPct || 0; atkPct += st.atkPct || 0; defPct += st.defPct || 0;
      cdr += st.cdr || 0; ls += st.ls || 0; goldPct += st.goldPct || 0; spdAdd += st.spd || 0;
    }
    if (relic && Z.BAL.relicStats) {
      const r = Z.BAL.relicStats(relic);
      hp += r.hp; mp += r.mp; atk += r.atk; def += r.def;
    }
    hp = Math.round(hp * (1 + hpPct));
    atk = Math.round(atk * (1 + atkPct));
    def = Math.round(def * (1 + defPct));
    return { maxHp: hp, maxMp: Math.round(mp), atk, def, crit: Math.min(60, crit), hpRegen, mpRegen,
      cdr: Math.min(0.4, cdr), ls: Math.min(0.25, ls), goldPct, spd: 252 + spdAdd };
  }

  recomputeStats() {
    const st = Player.equipmentStats();
    const hpR = this.maxHp ? this.hp / this.maxHp : 1;
    const mpR = this.maxMp ? this.mp / this.maxMp : 1;
    Object.assign(this, st);
    this.hp = Math.max(0, Math.min(st.maxHp, st.maxHp * hpR));
    // MP本就按帧保留小数；换装不取整，防止反复切换上限凭空积累法力。
    this.mp = Math.max(0, Math.min(st.maxMp, st.maxMp * mpR));
    if (this.relicEffect && this.relicEffect.uid !== Z.Save.d.relics?.active) this.relicEffect = null;
  }

  activeRelic() {
    const r = Z.Save.d.relics;
    return r && r.owned.find(it => it.uid === r.active);
  }

  useRelic() {
    if (!this.level || this.dead || Z.G.paused || Z.G.clearInfo || Z.Trans.busy || this.hitstunT > 0 ||
        !['idle', 'run', 'jump', 'fall'].includes(this.state)) return false;
    const relic = this.activeRelic();
    if (!relic) { this.denySfx('先在背包 · 法宝中合成并装备'); return false; }
    const st = Z.BAL.relicStats(relic);
    if (this.relicCd > 0) { this.denySfx('法宝调息中'); return false; }
    if (this.mp < st.cost) { this.denySfx('法力不足'); return false; }
    if (st.type === 'heal' && this.hp >= this.maxHp) { this.denySfx('生命已满'); return false; }
    this.mp -= st.cost;
    this.relicCd = st.cd;
    Z.FX.text(this.x, this.y - this.h - 26, Z.BAL.relicDefs[relic.id].name, { color: st.type === 'shield' ? '#b4ddff' : st.type === 'tide' ? '#9fd8f0' : '#a4e8b0', size: 16 });
    if (st.type === 'tide') {
      // 碧海潮珠：以自身为中心的即时潮涌，伤害随等级成长，击退按目标方位发散
      let hits = 0;
      for (const target of this.skillTargets()) {
        if (!target || target.dead || target.invulnT > 0) continue;
        const dx = target.x - this.x, dy = (target.y - target.h / 2) - (this.y - this.h / 2);
        if (dx * dx + dy * dy > 170 * 170) continue;
        Z.Combat.applyHit(this, target, st.dmgMul, { kb: Z.U.sign(dx || this.facing) * 230, hitId: 'relicTide' });
        hits++;
      }
      Z.FX.add('ring', this.x, this.y - 34, { r: 96, life: 0.5, color: 'rgba(130,205,240,0.85)' });
      Z.FX.add('ring', this.x, this.y - 34, { r: 150, life: 0.66, color: 'rgba(110,180,235,0.5)', sq: 0.35 });
      for (let i = 0; i < 9; i++) Z.FX.add('star', this.x + Z.U.rand(-70, 70), this.y - Z.U.rand(6, 90), { life: 0.55, r: 4, color: '#9fd8f0' });
      Z.FX.shake(hits ? 6 : 2, 0.24);
      Z.Audio.sfx(hits ? 'hitHeavy' : 'swing');
      return true;
    }
    this.relicEffect = { uid: relic.uid, type: st.type, remaining: st.duration, duration: st.duration,
      shield: st.shield, maxShield: st.shield, rate: st.heal / st.duration, pulse: 0 };
    Z.Audio.sfx(st.type === 'shield' ? 'stone' : 'potion');
    return true;
  }

  tickRelic(dt) {
    if (this.dead) { this.relicEffect = null; return; }
    this.relicCd = Math.max(0, this.relicCd - dt);
    const effect = this.relicEffect;
    if (!effect) return;
    if (effect.uid !== Z.Save.d.relics?.active) { this.relicEffect = null; return; }
    const elapsed = Math.min(dt, effect.remaining);
    if (effect.type === 'heal') {
      this.hp = Math.min(this.maxHp, this.hp + effect.rate * elapsed);
      effect.pulse += elapsed;
      if (effect.pulse >= .3) {
        effect.pulse %= .3;
        Z.FX.add('heal', this.x + Z.U.rand(-18, 18), this.y - Z.U.rand(12, 56), { life: .7 });
      }
    }
    effect.remaining = Math.max(0, effect.remaining - dt);
    if (effect.remaining <= 0) this.relicEffect = null;
  }

  skillDmg(id) {
    const lv = Z.Save.d.skills[id] || 1;
    const g = Z.BAL.skillGrowth;
    return Z.BAL.skills[id].dmg * (1 + g.dmgPerLv * (lv - 1));
  }
  skillCd(id) {
    const lv = Z.Save.d.skills[id] || 1;
    return Z.BAL.skills[id].cd * Math.pow(1 - Z.BAL.skillGrowth.cdCut, lv - 1) * (1 - (this.cdr || 0));
  }

  /* ---- 纯视觉随动：按位移推进步频，披风/尾巴保留惯性 ---- */
  updateVisual(dt) {
    if (dt <= 0) return;
    const v = this.visual;
    const localVx = this.vx * this.facing;
    const accel = (this.vx - this._visualVx) * this.facing / Math.max(dt, 1 / 240);
    v.runPhase = (v.runPhase + Math.abs(this.vx) * dt * (Z.U.TAU / .42) / 252) % Z.U.TAU;
    // 跑动手臂/棒轴按速度平滑过渡，避免起跑、急停时握点瞬跳；先 ease 再平滑，中段不加速。
    const carryTarget = Z.U.ease(Z.U.clamp(Math.abs(this.vx) / (this.spd || 252), 0, 1));
    v.carry = (v.carry == null ? carryTarget : v.carry) + (carryTarget - (v.carry == null ? carryTarget : v.carry)) * Math.min(1, dt * 6);
    // 二段跳翻滚：约 .5 秒一整周；提前落地则快速收成落地滚翻。
    if (v.flip != null) { v.flip += dt / (this.onGround ? .18 : .5); if (v.flip >= 1) v.flip = null; }
    if (this.facing !== this._visualFacing) {
      const turn = this._visualVx * this.facing / 252;
      v.capeV += turn * 6;
      v.tailV -= turn * 5;
    }
    let swing = 0;
    if (this.state === 'atk1' || this.state === 'atk2' || this.state === 'atk3') {
      const n = this.stateT / this.stateDur;
      swing = Math.sin(Math.PI * Z.U.clamp((n - 0.2) / 0.5, 0, 1));
    }
    const capeTarget = Z.U.clamp(localVx / 440 + accel / 12000 - this.vy / 1800 + swing * 0.7, -1.2, 1.2);
    const tailTarget = Z.U.clamp(-localVx / 620 - accel / 16000 + this.vy / 2200 - swing * 0.5, -1.2, 1.2);
    // 隐式弹簧阻尼在不同 dt 下保持稳定；只改变 visual 字段。
    v.capeV = (v.capeV + (capeTarget - v.cape) * 64 * dt) / (1 + 14 * dt + 64 * dt * dt);
    v.cape = Z.U.clamp(v.cape + v.capeV * dt, -1.5, 1.5);
    v.tailV = (v.tailV + (tailTarget - v.tail) * 44 * dt) / (1 + 11 * dt + 44 * dt * dt);
    v.tail = Z.U.clamp(v.tail + v.tailV * dt, -1.5, 1.5);
    this._visualVx = this.vx; this._visualFacing = this.facing;
    // 状态机本帧稍后才切换动作；保留此前的数字姿态，让首帧绘制接住原握棒位置。
    if (Z.Spr.sampleWukongPose) {
      const ground=Number(this.onGround),groundChanged=['idle','run','jump','fall'].includes(this.state) && v.poseGround!=null && v.poseGround!==ground;
      if (v.poseState !== this.state || groundChanged) {
        v.poseFrom = v.pose || null; v.poseState = this.state;
        v.poseStart = groundChanged ? this.animClock : this.animClock - this.stateT;
      }
      v.poseGround=ground;
      v.pose = Z.Spr.sampleWukongPose(this, this.animClock);
    }
  }

  get heavyQueued() { return this.skillAction === 'slash' && this.actionBuffer === 'skill1'; }
  get linkReady() {
    return !this._linkBlocked && this.slashLastHit && this.heavyQueued &&
      this.mp >= Z.BAL.skills.hy.mp && this.cds.hy <= 0;
  }

  clearSkillLink() {
    if (this.skillAction === 'slash') this._linkBlocked = true;
    this.slashConnected = false; this.slashLastHit = false; this._linkFinish = false;
  }
  clearSkillShadows() {
    this.clearSkillLink();
    if (this.skillShadows) this.skillShadows.length = 0;
    if (this._skillHitTargets) this._skillHitTargets.clear();
  }
  setState(state, dur = 0) {
    const action = this.skillAction;
    super.setState(state, dur);
    if (action && state !== ({ heavy: 'cast', flash: 'dash', slash: 'spin' })[action]) {
      this.skillAction = null;
      if (action === 'heavy') this.heavyLinked = false;
    }
    if (state === 'hurt' || state === 'down' || state === 'getup') {
      this.clearSkillShadows();
      if (this.visual) this.visual.flip = null;
    }
  }

  /* ---- 主更新 ---- */
  update(dt) {
    if (this.level !== this._skillLevel) {
      this.clearSkillShadows(); this._skillLevel = this.level;
    }
    if (this.dead || this.hitstunT > 0) this.clearSkillShadows();
    this.tickSkillShadows(dt);
    super.update(dt);
    this.tickRelic(dt);
    this.updateVisual(dt);
    const lv = this.level, I = Z.Input;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboHits = 0; }
    if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - dt * 3.5);
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] -= dt;
    if (this.potCd > 0) this.potCd -= dt;
    if (this._denyT > 0) this._denyT -= dt;
    // 离台宽限随世界时间推进；出招、受击期间也不能保留过期的一段跳资格。
    this.coyote = this.onGround ? 0.09 : Math.max(0, (this.coyote || 0) - dt);
    // 装备恢复按实际世界时间生效；暂停不更新，死亡不能被被动恢复复活。
    if (!this.dead) {
      this.mp = Math.min(this.maxMp, this.mp + this.mpRegen * dt);
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    }

    // 一次按下在同一 rAF 的追帧中只处理一次。
    const pressed = {};
    for (const action of ['wushuang', 'skill1', 'skill2', 'skill3', 'jump', 'attack', 'relic']) {
      pressed[action] = I.consume(action) || this._impactAction === action;
    }
    this._impactAction = null;
    const impactPotion = this._impactPotion; this._impactPotion = null;

    if (this.dead) {
      this.clearActionBuffer();
      this.stateT += 0; // down 姿势
      this.physics(dt, lv);
      return;
    }
    // 击倒与起身（Boss重击/浮空受击触发，起身带无敌防连死）
    if (this.state === 'down') {
      this.clearActionBuffer();
      this.physics(dt, lv);
      if (this.stateT >= 0.55) { this.setState('getup', 0.45); this.invulnT = Math.max(this.invulnT, 1.0); }
      return;
    }
    if (this.state === 'getup') {
      this.clearActionBuffer();
      this.physics(dt, lv);
      if (this.stateT >= 0.45) this.setState('idle');
      return;
    }

    const acting = ['atk1', 'atk2', 'atk3', 'cast', 'dash', 'spin', 'wu'].includes(this.state);
    const hurted = this.state === 'hurt';

    if (this.hitstunT > 0) {
      this.clearActionBuffer();
      if (this.state !== 'hurt') this.setState('hurt', 0.3);
      this.physics(dt, lv);
      return;
    }
    if (hurted && this.stateT < 0.28) { this.clearActionBuffer(); this.physics(dt, lv); return; }
    if (hurted) this.setState('idle');

    if (pressed.relic && !acting) this.useRelic();

    // ---- 无双 ----
    let started = false;
    if (pressed.wushuang && !acting) {
      if (this.wu >= 100) { this.startWu(); started = true; }
      else this.denySfx('无双未满');
    }

    // ---- 技能 ----
    if (!acting && !started) {
      if (pressed.skill1) started = this.castHy();
      else if (pressed.skill2) started = this.castJd();
      else if (pressed.skill3) started = this.castQs();
    }

    // ---- 药水 ----
    if (this.potCd <= 0) {
      if ((I.jp('potion1') || impactPotion === 'potion1') && Z.Save.d.pots.hp > 0 && this.hp < this.maxHp) {
        Z.Save.d.pots.hp--; this.potCd = 1.6;
        const v = Math.min(this.maxHp - this.hp, Math.round(this.maxHp * 0.35));
        this.hp = Math.min(this.maxHp, this.hp + v);
        Z.FX.text(this.x, this.y - this.h - 16, '+' + v, { color: '#7dffa8', size: 16 });
        for (let i = 0; i < 6; i++) Z.FX.add('heal', this.x + Z.U.rand(-14, 14), this.y - Z.U.rand(8, 55), { life: 0.7 });
        Z.Audio.sfx('potion');
      } else if ((I.jp('potion2') || impactPotion === 'potion2') && Z.Save.d.pots.mp > 0 && this.mp < this.maxMp) {
        Z.Save.d.pots.mp--; this.potCd = 1.6;
        const v = Math.min(this.maxMp - this.mp, Math.round(this.maxMp * 0.5));
        this.mp = Math.min(this.maxMp, this.mp + v);
        Z.FX.text(this.x, this.y - this.h - 16, '法力+' + Math.round(v), { color: '#7eb8ff', size: 14 });
        Z.Audio.sfx('potion');
      }
    }

    // ---- 动作状态推进 ----
    if (acting) {
      const state = this.state;
      this.bufferActionInput(pressed);
      this.tickAction(dt, lv, pressed.attack);
      if (this.state !== state) {
        if (this.state === 'idle') this.runActionBuffer();
        else this.actionBuffer = null; // 既有三连击优先，不把预约带到下一棍。
      }
      this.physics(dt, lv);
      this.resolveSkillShadows();
      return;
    }
    // 本帧刚起手的动作：跳过移动与姿态覆盖，避免攻击/技能状态被同帧踩回 idle
    if (started) {
      this.physics(dt, lv);
      this.resolveSkillShadows();
      return;
    }

    // ---- 自由移动（加速/减速曲线，转身有急停顿挫感） ----
    let mx = 0;
    if (I.isDown('left')) mx -= 1;
    if (I.isDown('right')) mx += 1;
    if (mx !== 0) {
      const turning = Math.sign(mx) !== Math.sign(this.vx) && Math.abs(this.vx) > 120;
      const acc = this.onGround ? (turning ? 3400 : 2000) : 1300;
      this.vx = Z.U.approach(this.vx, mx * this.spd, acc * dt);
      if (this.facing !== mx) {
        this.facing = mx;
        if (turning && this.onGround) {
          Z.FX.add('dust', this.x - mx * 6, this.y, {});
          Z.FX.add('dust', this.x - mx * 16, this.y, {});
        }
      }
    } else {
      this.vx = Z.U.approach(this.vx, 0, (this.onGround ? 2600 : 500) * dt);
    }

    // 跳跃（二段跳 + 土狼时间）
    if (pressed.jump) this.startJump();

    // 普攻
    if (pressed.attack) {
      this.startAttack(this.onGround ? this.comboIdx : 0);
      this.physics(dt, lv);
      this.resolveSkillShadows();
      return;
    }

    // 状态动画
    if (!this.onGround) this.setState(this.vy < 0 ? 'jump' : 'fall');
    else if (mx !== 0) {
      this.setState('run');
      if (Math.random() < dt * 6) Z.FX.add('dust', this.x - this.facing * 10, this.y, {});
    } else this.setState('idle');

    this.physics(dt, lv);
    this.resolveSkillShadows();
  }

  clearActionBuffer() {
    this.actionBuffer = null; this.comboQueued = false;
    this._impactAction = null; this._impactPotion = null;
    this.clearSkillLink();
  }

  bufferActionInput(pressed) {
    // 原预约资格同时用于正常推进与命中停顿，不扩大120ms窗口。
    if (this.skillAction === 'slash' && this.slashConnected && !this._linkBlocked && pressed.skill1) {
      this.actionBuffer = 'skill1'; pressed.skill1 = false;
    }
    if (this.stateT >= this.stateDur - .12 - 1e-9) {
      const action = ['wushuang', 'skill1', 'skill2', 'skill3', 'jump', 'attack', 'relic']
        .find(a => pressed[a] && !(a === 'attack' && (this.state === 'atk1' || this.state === 'atk2')));
      if (action) this.actionBuffer = action;
    }
  }

  captureImpactInput() {
    const pressed = {};
    for (const action of ['wushuang', 'skill1', 'skill2', 'skill3', 'jump', 'attack', 'relic']) pressed[action] = Z.Input.consume(action);
    const hp = Z.Input.consume('potion1'), mp = Z.Input.consume('potion2');
    if (this.dead || this.hitstunT > 0 || ['hurt', 'down', 'getup'].includes(this.state)) { this.clearActionBuffer(); return; }
    if (['atk1', 'atk2', 'atk3', 'cast', 'dash', 'spin', 'wu'].includes(this.state)) {
      if ((this.state === 'atk1' || this.state === 'atk2') && pressed.attack && this.stateT > this.atkDef(Number(this.state[3]) - 1).wS) this.comboQueued = true;
      this.bufferActionInput(pressed);
    } else {
      const action = ['wushuang', 'skill1', 'skill2', 'skill3', 'jump', 'attack', 'relic'].find(a => pressed[a]);
      if (action) this._impactAction = action;
    }
    if (this.potCd <= 0) {
      if (hp && Z.Save.d.pots.hp > 0 && this.hp < this.maxHp) this._impactPotion = 'potion1';
      else if (mp && Z.Save.d.pots.mp > 0 && this.mp < this.maxMp) this._impactPotion = 'potion2';
    }
  }

  runActionBuffer() {
    const action = this.actionBuffer;
    this.actionBuffer = null; // 先消费；资源不足也不会在之后自动补放。
    if (action === 'wushuang') { if (this.wu >= 100) this.startWu(); else this.denySfx('无双未满'); }
    else if (action === 'skill1') this.castHy();
    else if (action === 'skill2') this.castJd();
    else if (action === 'skill3') this.castQs();
    else if (action === 'jump') { if (this.startJump()) this.setState('jump'); }
    else if (action === 'attack') this.startAttack(0);
    else if (action === 'relic') this.useRelic();
  }

  startJump() {
    if (this.onGround || this.coyote > 0) {
      this.vy = -640; this.jumps = 1; this.onGround = false; this.coyote = 0;
      Z.Audio.sfx('jump');
      Z.FX.add('dust', this.x, this.y, {});
      return true;
    } else if (this.jumps < 2) {
      this.vy = -600; this.jumps = 2; this.coyote = 0;
      Z.Audio.sfx('jump');
      this.visual.flip = 0;   // 二段跳空中翻滚
      Z.FX.add('ring', this.x, this.y - 6, { r: 20, life: 0.3, color: 'rgba(255,255,255,0.8)', sq: 0.25 });
      return true;
    }
    return false;
  }

  /* ---- 普攻三连 ---- */
  startAttack(idx) {
    this.comboIdx = idx;
    this.setState('atk' + (idx + 1), [0.3, 0.32, 0.44][idx]);
    this._atkHit = false;
    if (this.onGround) this.vx = this.facing * (idx === 2 ? 190 : 120);
    Z.Audio.sfx('swing');
  }
  atkDef(idx) {
    return [
      { wS: 0.08, wE: 0.2, bx: [6, -62, 64, 62], dmg: 1.0, kb: 120 },
      { wS: 0.1, wE: 0.22, bx: [2, -72, 58, 72], dmg: 1.1, kb: 60, launch: -230 },
      { wS: 0.14, wE: 0.28, bx: [4, -68, 78, 68], dmg: 1.55, kb: 280, launch: -140, down: true },
    ][idx];
  }

  tickAction(dt, lv, attackPressed) {
    if (this.skillAction) { this.tickSkillAction(dt); return; }
    const st = this.state, t = this.stateT;
    if (st === 'atk1' || st === 'atk2' || st === 'atk3') {
      const idx = Number(st[3]) - 1;
      const d = this.atkDef(idx);
      if (t >= d.wS && t <= d.wE && !this._atkHit) {
        const box = this.boxFrom(d.bx);
        const hits = Z.Combat.melee(this, box, d.dmg, { kb: this.facing * d.kb, launch: d.launch, ...(lv.combatQualityTrial === true && d.down ? { down: true } : {}) });
        if (hits > 0) {
          this._atkHit = true;
          Z.FX.add('slash', this.x + this.facing * (idx === 2 ? 46 : 34), this.y - 44 + idx * 6, {
            r: idx === 2 ? 40 : 30, rot: idx === 1 ? -1.2 : 0.3, flip: this.facing, life: 0.2,
            color: idx === 2 ? '#ffe28a' : '#fff',
          });
          if (idx === 2) {
            Z.FX.shake(4, 0.14); Z.FX.impact('medium');
            if (Z.FX.impactFeedback()) Z.Audio.sfx('hitHeavy');
          } else Z.FX.impact('light');
        }
      }
      // 连招缓冲
      if (attackPressed && idx < 2 && t > d.wS) this.comboQueued = true;
      if (t >= this.stateDur) {
        if (this.comboQueued && idx < 2) { this.comboQueued = false; this.startAttack(idx + 1); }
        else { this.comboQueued = false; this.comboIdx = 0; this.setState('idle'); }
      }
    } else if (st === 'wu') { // 无双·大闹天宫
      const W = Z.BAL.wushuang;
      for (let i = 0; i < W.hits; i++) {
        const ht = 0.16 + i * 0.17;
        if (t >= ht && !(this._wuHits & (1 << i))) {
          this._wuHits |= (1 << i);
          const box = this.boxFrom([-10, -104, 150, 104]);
          Z.Combat.melee(this, box, W.dmg, { kb: this.facing * 220, hitId: 'wu' + i, hitIv: 0.1 });
          Z.FX.add('staffarc', this.x + this.facing * 58, this.y - 50, {
            r: 54, rot: [-.55, .45, -.3, .6, 0][i % 5], f: this.facing, life: .22, heavy: true,
          });
          Z.FX.shake(7, 0.16);
          Z.Audio.sfx('hitHeavy');
        }
      }
      if (t >= 1.0 && !(this._wuHits & (1 << W.hits))) {
        this._wuHits |= (1 << W.hits);
        Z.Combat.melee(this, this.boxFrom([-120, -116, 240, 116]), W.finalDmg, { kb: Z.U.sign(this.facing) * 380, launch: -260, down: true });
        Z.FX.add('wufinish', this.x, this.y, { f: this.facing, life: .48 });
        Z.FX.flash('#ffe8b0', 0.14);
        Z.FX.shake(13, 0.4);
        Z.Audio.sfx('wushuang');
      }
      if (t >= this.stateDur) { this.setState('idle'); this._wuHits = 0; }
    }
  }

  boxFrom(bx) {
    const [ox, oy, w, h] = bx;
    return {
      x: this.facing > 0 ? this.x + ox : this.x - ox - w,
      y: this.y + oy, w, h,
    };
  }

  /* ---- 技能释放 ---- */
  castHy() { return this.castSkill('hy', 'heavy', 'cast'); }
  castJd() { return this.castSkill('jd', 'flash', 'dash'); }
  castQs() { return this.castSkill('qs', 'slash', 'spin'); }

  castSkill(id, action, state) {
    const def = Z.BAL.skills[id];
    if (this.cds[id] > 0 || this.mp < def.mp) {
      this.clearSkillLink(); this.denySfx(this.cds[id] > 0 ? '技能冷却中' : '法力不足'); return false;
    }
    const linked = action === 'heavy' && this._linkFinish && !this._linkBlocked && this.slashLastHit;
    this.clearSkillLink();
    this.mp -= def.mp; this.cds[id] = this.skillCd(id);
    if (action === 'flash') {
      const direction = Number(Z.Input.isDown('right')) - Number(Z.Input.isDown('left'));
      if (direction) this.facing = direction;
    }
    this.heavyLinked = linked;
    this.heavyHitTime = linked ? Z.BAL.skillCombo.linkedHeavy.hitTime : Z.BAL.skills.hy.hitTime;
    this.heavyDur = linked ? Z.BAL.skillCombo.linkedHeavy.dur : Z.BAL.skills.hy.dur;
    this.setState(state, action === 'heavy' ? this.heavyDur : def.dur);
    this.skillAction = action;
    if (action === 'slash') {
      this.slashBeat = 0; this._linkBlocked = false;
      this._slashStopX = null; this._slashShadowBeats.clear();
    }
    this._atkHit = false; this._skillHitTargets.clear(); this.vx = 0;
    if (action === 'heavy') {
      for (const shadow of this.skillShadows) {
        if (shadow.life <= 0 || shadow.striking) continue;
        shadow.striking = true; shadow.strikeT = 0;
        shadow.strikeHitTime = this.heavyHitTime; shadow.strikeDur = this.heavyDur;
        shadow.linked = linked; shadow.heavyHit = false;
      }
      Z.Audio.sfx(Z.FX.impactFeedback() ? 'staffHeavy' : 'swing');
    } else if (action === 'flash') {
      this.invulnT = Math.max(this.invulnT, def.invulnEnd); Z.Audio.sfx(Z.FX.impactFeedback() ? 'flameDash' : 'dash');
    } else if (!Z.FX.impactFeedback()) Z.Audio.sfx('swing');
    return true;
  }

  skillTargets() {
    const lv = this.level;
    return lv ? lv.enemies.concat(lv.boss && !lv.boss.dead ? [lv.boss] : []) : [];
  }

  hitSkillTargets(box, mul, action, kb = 0) {
    if (this.level && this.level.hitEnvironment) this.level.hitEnvironment(this, box);
    let hits = 0;
    for (const target of this.skillTargets()) {
      if (!target || target.dead || target.invulnT > 0 || this._skillHitTargets.has(target) || !Z.U.aabb(box, target.hurtbox())) continue;
      const before = target.hp;
      Z.Combat.applyHit(this, target, mul, { kb: target.isBoss ? 0 : this.facing * kb });
      if (target.hp >= before) continue;
      this._skillHitTargets.add(target); hits++;
      if (action === 'heavy' && this.heavyLinked && this.level) this.level.linkedComboLearned = true;
      if (action === 'slash') {
        this.slashConnected = true;
        // 普通怪短硬直留在连斩范围；霸体与Boss继续原招式。
        if (!target.superArmor && !target.isBoss) target.vx = 0;
        if (this.slashBeat < 3 && !this._slashShadowBeats.has(this.slashBeat)) {
          this._slashShadowBeats.add(this.slashBeat); this.createSkillShadow(target, this.slashBeat);
        }
      }
    }
    return hits;
  }

  createSkillShadow(target, beat) {
    const cfg = Z.BAL.skillCombo;
    if (this.skillShadows.length >= cfg.shadowLimit) this.skillShadows.shift();
    let pose = null;
    if (Z.Spr.sampleWukongPose) {
      try {
        pose = {};
        const sampled = Z.Spr.sampleWukongPose(this, this.animClock);
        for (const key of Object.keys(sampled)) {
          const value = sampled[key];
          if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || typeof value === 'string') pose[key] = value;
          else if (Array.isArray(value) && value.every(n => typeof n === 'number' && Number.isFinite(n))) pose[key] = value.slice();
        }
      } catch (_) { pose = null; }
    }
    this.skillShadows.push({
      x: target.x - this.facing * (beat === 1 ? 72 : 100), y: this.y, facing: this.facing,
      life: cfg.shadowLife, lifeMax: cfg.shadowLife, age: 0,
      striking: false, strikeT: 0, strikeDur: Z.BAL.skills.hy.dur,
      strikeHitTime: Z.BAL.skills.hy.hitTime, linked: false, pose,
      strikeFacing: this.facing, heavyHit: false,
      visual: { ...this.visual, pose: null, poseFrom: null },
    });
  }

  tickSkillShadows(dt) {
    if (!this.skillShadows.length) return;
    for (const shadow of this.skillShadows) {
      shadow.life = Math.max(0, shadow.life - dt); shadow.age += dt;
      if (shadow.life > 0 && shadow.striking) shadow.strikeT += dt;
    }
    this.skillShadows = this.skillShadows.filter(shadow => shadow.life > 0);
  }

  resolveSkillShadows() {
    // 本人命中先结算，影不抢先触发击杀，也不追加控制与命中收益。
    let struck = false;
    for (const shadow of this.skillShadows) {
      if (!shadow.striking) continue;
      if (!shadow.heavyHit && shadow.strikeT + 1e-9 >= shadow.strikeHitTime) {
        shadow.heavyHit = true;
        const box = { x: shadow.facing > 0 ? shadow.x + 8 : shadow.x - 8 - 104, y: shadow.y - 94, w: 104, h: 94 };
        for (const target of this.skillTargets()) {
          if (!target || target.dead || target.invulnT > 0 || !Z.U.aabb(box, target.hurtbox())) continue;
          let dmg = this.atk * this.skillDmg('hy') * Z.BAL.skillCombo.shadowMultiplier;
          dmg *= 1 - (target.def || 0) / ((target.def || 0) + 260);
          dmg = Math.max(1, Math.round(dmg));
          target.hp = Math.max(0, target.hp - dmg); target.flashT = .16;
          struck = true;
          Z.FX.text(target.x, target.y - target.h - 20, dmg, { color: '#9de8ff', size: 13 });
          if (target.hp <= 0) target.die({});
        }
      }
      if (shadow.strikeT + 1e-9 >= shadow.strikeDur) shadow.striking = false;
    }
    if (struck && Z.FX.impactFeedback()) { Z.FX.impact('heavy'); Z.Audio.sfx('hitHeavy'); }
  }

  tickSkillAction(dt) {
    const action = this.skillAction, t = this.stateT;
    if (action === 'heavy') {
      this.vx = this.onGround && t < (this.heavyLinked ? .08 : .18) ? this.facing * 55 : 0;
      if (t + 1e-9 >= this.heavyHitTime && !this._atkHit) {
        this._atkHit = true;
        const hits = this.hitSkillTargets(this.boxFrom([8, -94, 104, 94]), this.skillDmg('hy'), action, 70);
        if (hits) {
          if (Z.FX.impactFeedback()) Z.FX.impact('heavy'); else Z.FX.hitstop(.055);
          Z.FX.shake(5, .16); Z.Audio.sfx('hitHeavy');
        }
      }
    } else if (action === 'slash') {
      const def = Z.BAL.skills.qs, beats = Z.BAL.skillCombo.slashBeats;
      this.vx = t >= .08 && t < def.hitEnd ? this.facing * 300 : 0;
      const box = this.boxFrom([4, -78, 82, 78]);
      if (this.vx && this._slashStopX == null) {
        for (const target of this.skillTargets()) {
          if (!target || target.dead || (target.x - this.x) * this.facing <= 0 || !Z.U.aabb(box, target.hurtbox())) continue;
          const stopX = target.x - this.facing * 50;
          if (this._slashStopX == null || stopX * this.facing < this._slashStopX * this.facing) this._slashStopX = stopX;
        }
      }
      if (this.vx && this._slashStopX != null) {
        const distance = (this._slashStopX - this.x) * this.facing;
        this.vx = this.facing * Math.min(300, Math.max(0, distance) / Math.max(dt, 1 / 240));
      }
      while (this.slashBeat < beats.length && t + 1e-9 >= beats[this.slashBeat].time) {
        const beat = beats[this.slashBeat++]; this._skillHitTargets.clear();
        if (Z.FX.impactFeedback()) Z.Audio.sfx('swing');
        const hits = this.hitSkillTargets(box, this.skillDmg('qs') * beat.weight, action);
        if (this.slashBeat === beats.length) this.slashLastHit = hits > 0;
      }
    } else if (action === 'flash') {
      const def = Z.BAL.skills.jd;
      if (t < def.invulnEnd) this.invulnT = Math.max(this.invulnT, def.invulnEnd - t + dt);
      this.vx = t >= .02 && t < def.invulnEnd ? this.facing * 680 : 0;
      if (t >= .02 && t < def.invulnEnd) this.hitSkillTargets(this.boxFrom([-12, -62, 48, 62]), this.skillDmg('jd'), action);
    }
    if (t + 1e-9 >= this.stateDur) {
      if (action === 'slash') this._linkFinish = this.linkReady;
      this.vx = 0; this.setState('idle');
    }
  }
  startWu() {
    this.wu = 0;
    this._wuHits = 0;
    this.setState('wu', 1.3);
    Z.Audio.sfx('wushuang');
    Z.FX.flash('#ffd24a', 0.18);
    Z.FX.shake(9, 0.3);
    Z.FX.text(this.x, this.y - this.h - 30, '大闹天宫！', { color: '#ffd75e', size: 26 });
    Z.FX.add('wuburst', this.x, this.y, { f: this.facing, life: .48 });
  }
  denySfx(reason) {
    if (this._denyT > 0) return;
    this._denyT = .65;
    Z.Audio.sfx('click');
    if (reason) Z.FX.text(this.x, this.y - this.h - 18, reason, { color: '#ffe1a8', size: 12, life: .65 });
  }

  /* ---- 受击/增益 ---- */
  knockdown() {
    if (this.dead) return;
    this.clearActionBuffer();
    this.setState('down', 0.55);
    this.hitstunT = 0;
    this.comboQueued = false;
    this._wuHits = 0;
  }
  takeDamage(dmg, o = {}) {
    if (this.dead || this.invulnT > 0) return false;
    const shield = this.relicEffect;
    let absorbed = 0;
    if (shield && shield.type === 'shield' && shield.remaining > 0) {
      absorbed = Math.min(shield.shield, Math.max(0, dmg));
      shield.shield -= absorbed;
      if (absorbed > 0) Z.FX.text(this.x, this.y - this.h - 24, '护盾 −' + Math.round(absorbed), { color: '#a5dbff', size: 13 });
      if (shield.shield <= 0) {
        this.relicEffect = null;
        Z.FX.text(this.x, this.y - this.h - 42, '护盾破裂', { color: '#bfdbed', size: 14 });
      }
    }
    const before = this.hp;
    const ok = super.takeDamage(Math.max(0, dmg - absorbed), { ...o, shieldAbsorbed: absorbed });
    if (ok && (this.hp < before || absorbed > 0)) {
      this.clearActionBuffer();
      this.clearSkillShadows();
      if (this.hp < before) this.wu = Math.min(100, this.wu + Z.BAL.player.wuGainHurt);
      this.comboHits = 0;
      // Boss重击或浮空受击 → 倒地（起身带无敌，防连死）
      if (!this.dead && this.hp > 0 && (o.heavy || (o.launch && !this.onGround))) this.knockdown();
    }
    return ok;
  }
  addWu(v) { this.wu = Math.min(100, this.wu + v); }

  gainExp(v) {
    const S = Z.Save.d;
    S.exp += v;
    Z.FX.text(this.x + Z.U.rand(-6, 6), this.y - this.h - 26, '+' + v + ' 经验', { color: '#c9b0ff', size: 12, life: 0.7 });
    // 出战宠物分享经验（各自独立等级）
    if (S.pets.active && S.pets.owned.includes(S.pets.active)) {
      const g = Z.Save.petGrow(S.pets.active);
      g.exp += Math.round(v * 0.35);
      while (g.exp >= Z.BAL.expNeed(g.lv)) {
        g.exp -= Z.BAL.expNeed(g.lv);
        g.lv++;
        const pname = (Z.BAL.pets[S.pets.active] || {}).name || '宠物';
        Z.FX.text(this.x, this.y - this.h - 44, pname + ' 升级！Lv.' + g.lv, { color: '#ff9ab0', size: 15 });
        if (this.level && this.level.pet) this.level.pet.lv = g.lv;
      }
    }
    while (S.exp >= Z.BAL.expNeed(S.lv)) {
      S.exp -= Z.BAL.expNeed(S.lv);
      S.lv++;
      S.sp++;
      this.recomputeStats();
      this.hp = this.maxHp; this.mp = this.maxMp;
      Z.Audio.sfx('levelup');
      Z.FX.text(this.x, this.y - this.h - 34, '升级！Lv.' + S.lv, { color: '#ffd75e', size: 22 });
      Z.FX.add('ring', this.x, this.y - 30, { r: 90, life: 0.6, color: '#ffd75e' });
      Z.FX.flash('#ffe8b0', 0.1);
      if (Z.G.checkAch) Z.G.checkAch();
    }
  }

  onHitDealt() {
    this.addWu(Z.BAL.player.wuGainHit);
    this.comboHits++;
    this.comboT = 2.4;
    this.comboPop = 1;
    const st = this.level && this.level.stats;
    if (st && this.comboHits > (st.maxCombo || 0)) st.maxCombo = this.comboHits;
    if (Z.Save.d.stats && this.comboHits > Z.Save.d.stats.maxCombo) Z.Save.d.stats.maxCombo = this.comboHits;
  }

  die(o) {
    if (this.dead) return;
    Z.FX.clearImpact(); Z.Audio.clearImpact();
    this.clearActionBuffer();
    this.clearSkillShadows();
    super.die(o);
    this.setState('down');
    Z.FX.shake(10, 0.5);
    Z.Audio.sfx('fail');
    this.level.onPlayerDead();
  }

  draw(g) {
    this.groundY = this.level ? this.level.gy : undefined;
    Z.Spr.drawWukong(g, this);
    if (Z.Spr.drawRelicEffect) Z.Spr.drawRelicEffect(g, this);
  }
}

Z.Player = Player;
