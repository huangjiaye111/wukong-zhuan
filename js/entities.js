/* ============================================================
 * entities.js —— 实体基类 / 小怪AI / Boss AI / 宠物 / 投射物 / 掉落物
 * ============================================================ */
'use strict';

const GRAV = 2000;
// 守军节奏的校准起点；只用于正式品质分支，不改变单招伤害与命中时刻。
const ENEMY_PRESSURE = { meleeSlots: 2, meleeGap: .22, rangedGap: .65 };

/* ================= 基类 ================= */
class Entity {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.facing = 1; this.dead = false;
    this.level = null;
    this.animClock = Math.random() * 10;
    this.state = 'idle'; this.stateT = 0; this.stateDur = 0;
  }
  setState(s, dur = 0) { this.state = s; this.stateT = 0; this.stateDur = dur; }
  update(dt) {
    this.animClock += dt;
    this.stateT += dt;
  }
}

class Fighter extends Entity {
  constructor(x, y, cfg) {
    super(x, y);
    Object.assign(this, {
      w: 36, h: 60, hp: 100, maxHp: 100, atk: 10, def: 0, crit: 5,
      team: 'enemy', spd: 100, onGround: true, fly: false,
      invulnT: 0, flashT: 0, hitstunT: 0, atkCd: 0, seed: Math.random(),
    }, cfg);
    this.hp = this.maxHp;
    this.prevY = y;
  }
  hurtbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }

  physics(dt, lv) {
    this.prevY = this.y;
    if (!this.fly) this.vy += GRAV * dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    const m = 30;
    this.x = Z.U.clamp(this.x, m, lv.def.w - m);

    this.onGround = false;
    if (!this.fly) {
      if (this.y >= lv.gy) {
        if (this.vy > 500 && this === lv.player) Z.FX.add('dust', this.x, this.y, {});
        if (this.vy > 430) this.squashT = 0.14; // 落地挤压
        this.y = lv.gy; this.vy = 0; this.onGround = true;
      } else {
        // 单向平台
        for (const p of lv.def.platforms) {
          if (this.prevY <= p[1] + 2 && this.y >= p[1] && this.vy >= 0 &&
            this.x > p[0] - 6 && this.x < p[0] + p[2] + 6) {
            this.y = p[1]; this.vy = 0; this.onGround = true;
            break;
          }
        }
      }
    }
    const fr = this.onGround ? (this.friction != null ? this.friction : 0.0008) : 0.02;
    this.vx *= Math.pow(fr, dt);
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.hitstunT > 0) this.hitstunT -= dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.squashT > 0) this.squashT -= dt;
  }

  knockdown() {
    if (this.dead || this.fly || this.isBoss || this.superArmor) return;
    this.setState('down', 0.7);
    this.hitstunT = 0;
  }

  takeDamage(dmg, o = {}) {
    if (this.dead || this.invulnT > 0) return false;
    this.hp -= dmg;
    this.flashT = 0.16;
    const trialArmor = this.team === 'enemy' && this.level &&
      this.level.combatQualityTrial === true && (this.isBoss || this.superArmor);
    const kb = trialArmor ? (this.isBoss ? 0 : Z.U.clamp((o.kb || 0) * .25, -60, 60)) : o.kb;
    if (kb) this.vx += kb;
    if (o.launch && !trialArmor) { this.vy = o.launch; this.onGround = false; }
    if (o.down && this.team === 'enemy') this.knockdown();
    const tx = this.x + Z.U.rand(-8, 8), ty = this.y - this.h - 10;
    if (dmg !== 0 || !(o.shieldAbsorbed > 0)) Z.FX.add('text', tx, ty, {
      str: Math.round(dmg), life: 0.75, vy: -55,
      color: o.crit ? '#ffb02e' : '#fff',
      size: o.crit ? 22 : 15,
    });
    for (let i = 0; i < (o.crit ? 8 : 4); i++) {
      Z.FX.add('spark', tx, ty + 8, {
        vx: Z.U.rand(-160, 160), vy: Z.U.rand(-180, -20),
        life: 0.3, a: Z.U.rand(0, Z.U.TAU), color: o.crit ? '#ffb02e' : '#ffe28a',
      });
    }
    if (this.team === 'player') {
      this.invulnT = 0.7;
      this.hitstunT = Math.max(this.hitstunT, 0.18);
      Z.Audio.sfx('hurt');
      Z.FX.shake(5, 0.18);
    } else {
      if (!this.superArmor) this.hitstunT = Math.max(this.hitstunT, this.isBoss ? 0.06 : 0.24);
      Z.Audio.sfx(o.crit ? 'hitHeavy' : 'hit');
      if (Z.FX.impactFeedback()) Z.FX.impact(o.crit ? 'medium' : 'light');
      else Z.FX.hitstop(o.crit ? 0.05 : 0.03);
    }
    if (this.hp <= 0) { this.hp = 0; this.die(o); }
    return true;
  }
  die() { this.dead = true; }
}

/* ================= 投射物 ================= */
class Projectile extends Entity {
  constructor(x, y, cfg) {
    super(x, y);
    Object.assign(this, {
      vx: 0, vy: 0, r: 6, dmg: 10, team: 'enemy', kind: 'arrow',
      life: 3, crit: false, src: null, ang: 0, heavy: false, kbOv: 0, grav: 0,
    }, cfg);
    this.ang = Math.atan2(this.vy, this.vx);
  }
  update(dt) {
    super.update(dt);
    if (this.grav) this.vy += this.grav * dt;
    if (this.kind === 'shock' && !this.noDust) {
      this.dustT = (this.dustT || 0) + dt;
      while (this.dustT + 1e-9 >= 1 / 60) {
        this.dustT -= 1 / 60;
        for (let i = 0; i < 2; i++) Z.FX.add('dust', this.x + Z.U.rand(-8, 8), this.y, {});
      }
    }
    if (this.kind === 'fire' && Math.random() < dt * 30) {
      Z.FX.add('spark', this.x, this.y, { vx: Z.U.rand(-40, 40), vy: Z.U.rand(-60, 0), life: 0.25, color: '#ff9a40' });
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -40 || this.x > (this.level ? this.level.def.w + 40 : 5000)) { this.dead = true; return; }

    // v83 首领火球落地 → 燃斑（落点是预警，燃斑短暂封锁走位）
    if (this.kind === 'fire' && this.team === 'enemy' && this.level && this.vy > 0 && this.y >= this.level.gy - 6) {
      this.dead = true;
      const flv = this.level;
      if (this.src && this.src.isBoss && flv.hazards) {
        flv.hazards.push({ x: Z.U.clamp(this.x, 60, flv.def.w - 60), w: 78, t: 0, dur: 2.1, tick: 0, src: this.src });
      }
      Z.FX.add('ring', this.x, flv.gy, { r: 30, life: 0.3, color: '#ff9a40', sq: .4 });
      for (let i = 0; i < 4; i++) Z.FX.add('dust', this.x + Z.U.rand(-16, 16), flv.gy, {});
      return;
    }

    // 追踪水龙卷：缓慢转向玩家
    if (this.homing && this.team === 'enemy' && this.level && this.level.player && !this.level.player.dead) {
      const p = this.level.player;
      const want = Math.atan2((p.y - 30) - this.y, p.x - this.x);
      const cur = Math.atan2(this.vy, this.vx);
      let da = want - cur;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const na = cur + Z.U.clamp(da, -2.0 * dt, 2.0 * dt);
      const sp = Math.min(200, Math.hypot(this.vx, this.vy) + 260 * dt);
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }

    const lv = this.level;
    const targets = this.team === 'enemy' ? [lv.player] : lv.enemies.concat(lv.boss ? [lv.boss] : []);
    const box = { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    for (const t of targets) {
      if (!t || t.dead) continue;
      if (t.invulnT > 0) continue;
      if (Z.U.aabb(box, t.hurtbox())) {
        Z.Combat.applyHit(this.src, t, this.dmg, { crit: this.crit, kb: this.kbOv || Z.U.sign(this.vx) * 90, flat: true, heavy: this.heavy });
        this.dead = true;
        if (this.kind === 'fire') Z.FX.add('ring', this.x, this.y, { r: 30, life: 0.3, color: '#ff9a40', sq: 1 });
        Z.FX.add('spark', this.x, this.y, { vx: -this.vx * 0.2, vy: -60, life: 0.25, color: '#cfe0ff' });
        break;
      }
    }
  }
  draw(g) {
    g.save();
    g.translate(this.x, this.y);
    if (this.kind === 'arrow') {
      g.rotate(this.ang);
      g.strokeStyle = '#c9b090'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(8, 0); g.stroke();
      g.fillStyle = '#e8f0f8';
      g.beginPath(); g.moveTo(12, 0); g.lineTo(4, -3.4); g.lineTo(4, 3.4); g.closePath(); g.fill();
      g.strokeStyle = '#e05555'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(-18, -3); g.moveTo(-14, 0); g.lineTo(-18, 3); g.stroke();
    } else if (this.kind === 'water') {
      // 小龙水弹：短水尾、青色水核；绘制不产生新的粒子或判定。
      g.rotate(this.ang);
      g.fillStyle = 'rgba(118,218,228,.35)';
      g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(-9, -8, 1, -5);
      g.lineTo(1, 5); g.quadraticCurveTo(-9, 8, -22, 0); g.fill();
      g.fillStyle = '#62c9de'; g.strokeStyle = '#2a788f'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, 0, this.r, this.r * .82, 0, 0, Z.U.TAU); g.fill(); g.stroke();
      g.fillStyle = '#d7ffff'; g.beginPath(); g.ellipse(2, -2, 3, 2, -.4, 0, Z.U.TAU); g.fill();
    } else if (this.kind === 'wave') {
      g.rotate(this.ang);
      // v82 剑气拖尾：行进反方向留一道渐隐弧，读作高速掠过
      const wdir = Math.sign(this.vx) || 1;
      g.strokeStyle = 'rgba(140,200,255,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.arc(-wdir * 11, 0, 12, -1.0, 1.0); g.stroke();
      g.strokeStyle = 'rgba(140,200,255,0.95)'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 13, -1.1, 1.1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 8, -0.9, 0.9); g.stroke();
    } else if (this.kind === 'sound') {
      g.strokeStyle = 'rgba(215,160,255,0.95)'; g.lineWidth = 3.4;
      g.beginPath(); g.ellipse(0, 0, 12, 16, 0, 0, Z.U.TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(0, 0, 6, 9, 0, 0, Z.U.TAU); g.stroke();
    } else if (this.kind === 'feather') {
      g.rotate(this.ang);
      Z.Spr; // feather glyph
      g.fillStyle = '#eef4fb';
      g.beginPath(); g.ellipse(0, 0, 12, 3, 0, 0, Z.U.TAU); g.fill();
      g.strokeStyle = '#c8d6e8'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
    } else if (this.kind === 'whirl') {
      // 水龙卷：旋转双弧
      g.rotate(this.animClock * 7);
      g.strokeStyle = 'rgba(140,214,255,0.95)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 1.3); g.stroke();
      g.strokeStyle = 'rgba(220,245,255,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 9, Math.PI, Math.PI * 2.2); g.stroke();
      Z.Spr.ell(g, 0, 0, 3, 3, '#dff4ff');
    } else if (this.kind === 'fire') {
      // 三昧真火球
      g.rotate(this.animClock * 9);
      g.fillStyle = 'rgba(255,110,30,0.9)';
      g.beginPath(); g.arc(0, 0, this.r + 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd75e';
      g.beginPath(); g.arc(1.5, 1.5, this.r * 0.55, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,180,80,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, this.r + 5, 0.4, 2.6); g.stroke();
    } else if (this.kind === 'wind') {
      // 罡风刃
      g.rotate(this.ang);
      g.strokeStyle = 'rgba(200,240,220,0.85)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 13, Math.PI * 0.2, Math.PI * 1.1); g.stroke();
      g.strokeStyle = 'rgba(160,220,190,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(-4, 0, 9, Math.PI * 0.1, Math.PI * 1.2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-14, -2); g.lineTo(12, -2); g.stroke();
    } else if (this.kind === 'sword') {
      // v83 剑雨：剑尖朝下坠落，尾迹淡蓝
      g.rotate(Math.PI / 2);
      g.strokeStyle = 'rgba(140,180,255,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-28, 0); g.lineTo(-14, 0); g.stroke();
      g.strokeStyle = '#dfe9f8'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-16, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = '#bcd8ff';
      g.beginPath(); g.moveTo(15, 0); g.lineTo(4, -4.5); g.lineTo(4, 4.5); g.closePath(); g.fill();
    } else if (this.kind === 'shock') {
      // 地面冲击波
      const k = 1 - this.life / (this.maxLife || 2);
      // v82 余波拖尾：主弧之后一道渐隐残弧，读作地波推进
      const sdir = Math.sign(this.vx) || 1;
      const mainC = this.tint || 'rgba(255,180,80,0.9)';
      const fillC = this.tint ? this.tint + '80' : 'rgba(255,140,60,0.5)';
      const trailC = this.tint ? this.tint + '52' : 'rgba(255,160,70,0.32)';
      g.strokeStyle = trailC; g.lineWidth = 3;
      g.beginPath(); g.ellipse(-sdir * 15, -5, 13, 18, 0, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
      g.strokeStyle = mainC; g.lineWidth = 4;
      g.beginPath(); g.ellipse(0, -6, 16, 22, 0, -Math.PI * 0.9, -Math.PI * 0.1); g.stroke();
      g.fillStyle = fillC;
      g.beginPath(); g.ellipse(0, -2, 12, 16, 0, Math.PI, 0); g.fill();
    }
    g.restore();
  }
}

/* ================= 掉落物 ================= */
class Pickup extends Entity {
  constructor(x, y, cfg) {
    super(x, y);
    Object.assign(this, {
      kind: 'gold', val: 1, item: null, petId: null,
      vx: Z.U.rand(-90, 90), vy: Z.U.rand(-320, -180),
      age: 0, grounded: false, bob: Math.random() * 6,
    }, cfg);
  }
  update(dt) {
    super.update(dt);
    this.age += dt;
    const lv = this.level, gy = lv.gy;
    if (!this.grounded) {
      this.vy += GRAV * 0.8 * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      this.x = Z.U.clamp(this.x, 20, lv.def.w - 20);
      if (this.y >= gy) { this.y = gy; this.vy = 0; this.vx = 0; this.grounded = true; }
    }
    const p = lv.player;
    if (p && !p.dead) {
      const d = Z.U.dist(this.x, this.y, p.x, p.y - 20);
      if (this.age > 0.35 && d >= 30 && d < 110) {
        // 接触范围交给拾取；满包留场也不能在重合点除以零或来回抖动。
        const sp = 420;
        this.x += (p.x - this.x) / d * sp * dt;
        this.y += (p.y - 20 - this.y) / d * sp * dt;
        this.grounded = true;
      }
      if (d < 30) {
        // 具名装备满包时留在原地：不自动出售，腾出行囊后可回来拾取
        if (this.kind === 'item' && this.item && this.item.gearId && Z.Save.d.bag.length >= 24) {
          if (!this._bagFullHinted) {
            this._bagFullHinted = true;
            Z.UI.toast('行囊已满 · ' + Z.BAL.itemName(this.item) + ' 留在原地，腾出格子后可拾取', '#ffd75e');
          }
        } else this.collect(lv);
      }
    }
  }
  collect(lv) {
    if (this.dead) return;
    this.dead = true;
    const S = Z.Save.d;
    const UI = Z.UI;
    if (this.kind === 'gold') {
      const g2 = Math.round(this.val * (1 + ((lv.player && lv.player.goldPct) || 0)));
      S.gold += g2;
      if (lv.stats) lv.stats.gold += g2;
      Z.Audio.sfx('coin');
      Z.FX.add('text', this.x, this.y - 20, { str: '+' + g2, life: 0.6, color: '#ffd75e', size: 13 });
      for (let i = 0; i < 3; i++) Z.FX.add('star', this.x + Z.U.rand(-10, 10), this.y - Z.U.rand(2, 28), { life: 0.35, r: 4, color: '#ffd75e' });
    } else if (this.kind === 'stone') {
      S.stones++;
      if (lv.stats) lv.stats.items = lv.stats.items || [];
      Z.Audio.sfx('stone');
      UI.toast('获得 强化石', '#54e0d8');
    } else if (this.kind === 'potion') {
      if (lv.stats) lv.stats.items = lv.stats.items || [];
      if (Z.U.chance(0.5)) { S.pots.hp++; UI.toast('获得 金创药', '#ff8a7e'); }
      else { S.pots.mp++; UI.toast('获得 还神丹', '#7eb8ff'); }
      Z.Audio.sfx('potion');
    } else if (this.kind === 'item') {
      const it = this.item;
      if (S.bag.length >= 24) {
        // 具名装备绝不自动出售：离场结算等强制入账时按手动分解同规则转为材料
        if (it.gearId) {
          const y = Z.BAL.dismantleYield(it);
          S.gold += y.gold; S.stones += y.stones;
          S.materials = { ...S.materials, iron: S.materials.iron + y.materials.iron, wood: S.materials.wood + y.materials.wood };
          if (lv.stats) { lv.stats.gold += y.gold; lv.stats.items = lv.stats.items || []; }
          UI.toast('离场时行囊已满 · ' + Z.BAL.itemName(it) + ' 已按分解转为材料', '#54e0d8');
          Z.Audio.sfx('stone');
          return;
        }
        const g2 = Z.BAL.itemValue(it);
        S.gold += g2;
        if (lv.stats) lv.stats.gold += g2;
        UI.toast('背包已满，自动出售 +' + g2 + '金', '#ffd75e');
      } else {
        S.bag.push(it);
        if (lv.stats) { lv.stats.items = lv.stats.items || []; lv.stats.items.push(it); }
        UI.toast('获得 ' + Z.BAL.itemName(it), Z.BAL.qualities[it.q].c);
      }
      Z.Audio.sfx('stone');
    } else if (this.kind === 'petball') {
      const pid = this.petId;
      if (!S.pets.owned.includes(pid)) {
        S.pets.owned.push(pid);
        UI.toast('捕捉宠物：' + Z.BAL.pets[pid].name + '！', '#ff9ab0');
        Z.Audio.sfx('pet');
        Z.FX.flash('#ffd0e0', 0.2);
      } else {
        S.stones += 2;
        UI.toast('重复宠物转化为 2 个强化石', '#54e0d8');
        Z.Audio.sfx('stone');
      }
    }
    if (Z.G.checkAch) Z.G.checkAch();
  }
  draw(g) {
    const bobY = this.grounded ? Math.sin(this.animClock * 3 + this.bob) * 3 : 0;
    const x = this.x, y = this.y - 12 + bobY;
    g.save();
    if (this.kind === 'gold') {
      Z.Spr.drawCoin(g, x, y, 8);
    } else if (this.kind === 'stone') {
      Z.Spr.drawStone(g, x, y, 9);
      g.globalAlpha = 0.4 + 0.2 * Math.sin(this.animClock * 5);
      Z.Spr.ell(g, x, y, 14, 10, 'rgba(84,224,216,0.35)');
    } else if (this.kind === 'potion') {
      Z.Spr.drawPotion(g, x, y, 9, Z.U.chance(0.5) ? 'hp' : 'mp');
    } else if (this.kind === 'item') {
      const q = Z.BAL.qualities[this.item.q].c;
      g.globalAlpha = 0.5 + 0.3 * Math.sin(this.animClock * 5);
      Z.Spr.ell(g, x, y, 16, 12, q.replace(')', ',0.3)').replace('#', 'rgba(200,200,200,'));
      g.globalAlpha = 1;
      Z.Spr.drawItemIcon(g, this.item, x - 11, y - 11, 22);
    } else if (this.kind === 'petball') {
      g.globalAlpha = 0.6 + 0.3 * Math.sin(this.animClock * 5);
      Z.Spr.ell(g, x, y, 16, 12, 'rgba(255,150,170,0.4)');
      g.globalAlpha = 1;
      Z.Spr.drawPetBall(g, x, y, 10);
    }
    g.restore();
  }
}

/* ================= 宝箱 ================= */
class Chest {
  constructor(x, y) {
    this.x = x; this.y = y; this.opened = false;
    this.t = Math.random() * 9; this.dead = false;
    this.level = null;
  }
  update(dt) {
    this.t += dt;
    const lv = this.level, p = lv.player;
    if (!this.opened && p && !p.dead && Math.abs(p.x - this.x) < 34 && Math.abs(p.y - this.y) < 46) this.open(lv);
  }
  open(lv) {
    this.opened = true;
    Z.Audio.sfx('buy');
    Z.FX.flash('#ffe8b0', 0.1);
    Z.FX.text(this.x, this.y - 52, '宝箱！', { color: '#ffd75e', size: 18 });
    const n = Z.U.randi(4, 7);
    for (let i = 0; i < n; i++) {
      const pk = new Pickup(this.x, this.y - 24, { kind: 'gold', val: Z.U.randi(4, 9), vy: Z.U.rand(-380, -260) });
      pk.level = lv; lv.pickups.push(pk);
    }
    if (Z.U.chance(0.55)) {
      const it = Z.BAL.makeDropItem(Z.U.choice(['weapon', 'head', 'armor', 'acc']), lv.idx, Z.BAL.rollQuality(false));
      const pk = new Pickup(this.x, this.y - 34, { kind: 'item', item: it, vy: -330 });
      pk.level = lv; lv.pickups.push(pk);
    }
    if (Z.U.chance(0.45)) {
      const pk = new Pickup(this.x, this.y - 28, { kind: 'stone', vy: -310 });
      pk.level = lv; lv.pickups.push(pk);
    }
    lv.stats.chests = (lv.stats.chests || 0) + 1;
    if (Z.G.checkAch) Z.G.checkAch();
  }
  draw(g) { Z.Spr.drawChest(g, this); }
}

/* ================= 小怪 ================= */
class Enemy extends Fighter {
  constructor(x, y, type, stage) {
    const b = Z.BAL.enemies[type];
    const hpM = Z.BAL.stageHp[stage] || 1, atkM = Z.BAL.stageAtk[stage] || 1;
    super(x, y, {
      w: b.w, h: b.h, team: 'enemy',
      maxHp: Math.round(b.hp * hpM), atk: Math.round(b.atk * atkM),
      def: type === 'tianjiang' ? 25 : 4, spd: b.spd,
      fly: !!b.fly, type, xp: b.xp, goldMin: b.gold[0], goldMax: b.gold[1],
      stage, isBoss: false, superArmor: !!b.guard,
    });
    this.setState('idle');
  }
  pressureRole() {
    const b = Z.BAL.enemies[this.type];
    return b.ranged || b.caster ? 'ranged' : 'melee';
  }
  pressureActive() {
    return !this.dead && this.hitstunT <= 0 && ['tele','atk','shoot','cast','dash'].includes(this.state);
  }
  pressureReady(role) {
    const p = this.level.player, dx = Math.abs(p.x - this.x);
    if (this.dead || p.dead || this.hitstunT > 0 || this.atkCd > 0 || this.pressureRole() !== role ||
        ['tele','atk','shoot','cast','dash','recover','down','getup'].includes(this.state)) return false;
    if (role === 'ranged') return dx >= (this.type === 'huoyao' ? 190 : 200) && dx <= 400;
    return dx < 460 && Math.abs(p.y - this.y) < 120;
  }
  pressureTurn(begin = false) {
    const lv = this.level;
    if (lv.combatQualityTrial !== true) return true;
    const role = this.pressureRole(), p = lv.player, peers = lv.enemies || [this];
    const boss = lv.boss;
    // 增长天王出剑时守军观阵；收势前段才允许接敌，留下完整起手/出手时间。
    if (boss && !boss.dead && boss.bid === 'zengzhang' &&
        (boss.pat || boss.summonT > 0 || (boss.recoveryT > 0 ? boss.recoveryT < .76 : boss.patCd <= .35))) return false;
    const active = peers.filter(e => e.pressureRole && e.pressureRole() === role && e.pressureActive()).length;
    const slots = role === 'melee' ? ENEMY_PRESSURE.meleeSlots : 1;
    if (active >= slots) return false;
    // 最近出手者排后；倒地/离场/冷却中的成员不占席，也不阻塞等待者。
    const waiting = peers.filter(e => e.pressureReady && e.pressureReady(role)).sort((a,b) =>
      (a.lastPressureAt ?? -1e9) - (b.lastPressureAt ?? -1e9) || Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
    const rank = waiting.indexOf(this);
    if (rank < 0 || rank >= slots - active) return false;
    if (!begin) return true;
    const gate = role === 'melee' ? 'enemyMeleeAt' : 'enemyRangedAt', time = lv.time || 0;
    if ((lv[gate] || 0) > time + 1e-9) return false;
    lv[gate] = time + (role === 'melee' ? ENEMY_PRESSURE.meleeGap : ENEMY_PRESSURE.rangedGap);
    this.lastPressureAt = time;
    return true;
  }
  waitInFormation(p, dt) {
    const side = Z.U.sign(this.x - p.x) || -this.facing;
    const waiting = (this.level.enemies || [this]).filter(e => !e.dead && e !== this.level.boss &&
      e.pressureRole && e.pressureRole() === 'melee' && !e.pressureActive() &&
      (Z.U.sign(e.x - p.x) || -e.facing) === side);
    const rank = Math.max(0, waiting.indexOf(this));
    const target = p.x + side * (94 + rank * 38), dx = target - this.x;
    this.vx = Z.U.approach(this.vx, Math.abs(dx) > 9 ? Z.U.sign(dx) * this.spd * .65 : 0, 650 * dt);
    this.setState(Math.abs(this.vx) > 10 ? 'walk' : 'idle');
  }
  update(dt) {
    if (this.dead && this.level && this.level.combatQualityTrial === true) return;
    super.update(dt);
    const lv = this.level, p = lv.player;
    const dx = p.x - this.x, adx = Math.abs(dx);
    // 被打倒在地 / 起身
    if (this.state === 'down' || this.state === 'getup') {
      if (this.state === 'down' && this.stateT >= 0.7) { this.setState('getup', 0.4); this.invulnT = Math.max(this.invulnT, 0.35); }
      else if (this.state === 'getup' && this.stateT >= 0.4) this.setState('idle');
      this.physics(dt, lv);
      return;
    }
    if (this.hitstunT > 0) {
      if (lv.combatQualityTrial === true && ['tele','atk','shoot','cast','dash'].includes(this.state)) {
        this.setState('idle'); this.attackDir = null; this._hitDone = this._shot = this._threw = false;
        this.atkCd = Math.max(this.atkCd, .3);
      }
      this.physics(dt, lv); return;
    }

    if (this.type === 'feiyao') { this.aiFly(dt, p, dx, adx); }
    else if (this.type === 'shuimu') { this.aiJelly(dt, p, dx, adx); }
    else if (this.type === 'huoyao') { this.aiCaster(dt, p, dx, adx); }
    else if (Z.BAL.enemies[this.type].ranged) { this.aiArcher(dt, p, dx, adx); }
    else { this.aiMelee(dt, p, dx, adx); }
    this.physics(dt, lv);
  }

  // 火妖：拉开距离，抛掷三昧火球（抛物线）
  aiCaster(dt, p, dx, adx) {
    this.facing = Z.U.sign(dx) || 1;
    if (this.state === 'cast') {
      if (this.stateT >= 0.32 && !this._threw) {
        this._threw = true;
        const sy = this.y - this.h * 0.7;
        const T = 0.85;
        const vx = Z.U.clamp(dx / T, -320, 320);
        const vy = ((p.y - 30) - sy - 0.5 * 760 * T * T) / T;
        this.level.spawnProj(new Projectile(this.x + this.facing * 12, sy, {
          vx, vy: Math.min(vy, -180), dmg: this.atk, team: 'enemy', kind: 'fire', src: this, r: 9, life: 2.4, grav: 760,
        }));
        Z.Audio.sfx('shoot');
      }
      if (this.stateT >= 0.55) { this.setState('idle'); this.atkCd = Z.U.rand(2.0, 3.2); this._threw = false; }
      return;
    }
    if (p.dead) { this.setState('idle'); this.vx = 0; return; }
    if (adx < 190) { this.setState('walk'); this.vx = -this.facing * this.spd; }
    else if (adx > 400) { this.setState('walk'); this.vx = this.facing * this.spd; }
    else {
      this.vx = 0;
      if (this.atkCd <= 0 && this.pressureTurn(true)) { this.setState('cast', 0.55); this._threw = false; }
      else this.setState('idle');
    }
  }

  // 水母：缓慢漂浮接近，蓄电后原地放电
  aiJelly(dt, p, dx, adx) {
    const lv = this.level, gy = lv.gy;
    if (this.state === 'atk') {
      // 放电圈
      this.vx = 0; this.vy = 0;
      if (!this._zapped && this.stateT >= 0.15) {
        this._zapped = true;
        Z.FX.add('ring', this.x, this.y - 20, { r: 78, life: 0.35, color: '#bfe9ff', sq: 1 });
        Z.Audio.sfx('beam');
        if (!p.dead && Z.U.dist(p.x, p.y - 30, this.x, this.y - 20) < 84) {
          Z.Combat.applyHit(this, p, this.atk, { kb: Z.U.sign(p.x - this.x) * 200, flat: true });
        }
      }
      if (this.stateT >= 0.45) { this.setState('idle'); this.atkCd = Z.U.rand(3.0, 4.6); this._zapped = false; }
      this.fly = true;
      return;
    }
    if (this.state === 'tele') {
      this.vx = 0; this.vy = Math.sin(this.animClock * 26) * 20;
      if (this.stateT >= 0.5) { this.setState('atk', 0.45); this._zapped = false; }
      this.fly = true;
      return;
    }
    const hoverY = gy - (Z.BAL.enemies.shuimu.hoverH || 60) + Math.sin(this.animClock * 1.8 + this.seed * 8) * 12;
    const wantX = p.x - Z.U.sign(p.x - this.x || 1) * 90; // 保持约90距离
    this.vx = Z.U.approach(this.vx, Z.U.clamp((wantX - this.x) * 1.2, -this.spd, this.spd), 300 * dt);
    this.vy = Z.U.approach(this.vy, (hoverY - this.y) * 2.5, 300 * dt);
    if (!p.dead) this.facing = Z.U.sign(p.x - this.x) || 1;
    if (this.atkCd <= 0 && !p.dead && adx < 100 && Math.abs((p.y - 30) - this.y) < 70 && this.pressureTurn(true)) {
      this.setState('tele', 0.5);
      Z.Audio.sfx('telegraph');
    }
    this.fly = true;
    void lv;
  }

  aiMelee(dt, p, dx, adx) {
    const lv = this.level;
    const quality = lv.combatQualityTrial === true, committed = this.state === 'tele' || this.state === 'atk';
    if (p.dead || adx > 560 && !(quality && committed)) {
      if (this.state === 'walk') this.vx = Z.U.sign(this.vx) * this.spd * 0.4;
      if (Z.U.chance(0.005)) this.facing *= -1;
      return;
    }
    if (!quality || !committed) this.facing = Z.U.sign(dx) || 1;
    else this.facing = this.attackDir || this.facing;
    const reach = this.type === 'tianjiang' ? 62 : 48;
    if (this.state === 'tele') {
      if (quality) this.vx = 0;
      if (this.stateT >= 0.42) { this.setState('atk', 0.3); Z.Audio.sfx('swing'); }
      return;
    }
    if (this.state === 'atk') {
      this.vx = this.facing * 60;
      if (this.stateT >= 0.06 && this.stateT < 0.2 && !this._hitDone) {
        const box = { x: this.facing > 0 ? this.x + 8 : this.x - 8 - 52, y: this.y - this.h - 4, w: 52, h: this.h + 4 };
        if (Z.Combat.melee(this, box, 1.0, {})) this._hitDone = true;
      }
      if (this.stateT >= 0.3) { this.setState('idle'); this.atkCd = Z.U.rand(1.1, 1.9); this._hitDone = false; }
      return;
    }
    if (this.atkCd <= 0 && adx < reach) {
      if (this.pressureTurn(true)) {
        this.attackDir = this.facing; this._hitDone = false;
        if (quality) this.vx = 0;
        this.setState('tele', 0.42);
        Z.Audio.sfx('telegraph');
        return;
      }
    }
    if (quality && adx < 460 && !this.pressureTurn()) { this.waitInFormation(p, dt); return; }
    // 走位
    if (adx > reach * 0.8) {
      this.setState('walk');
      this.vx = this.facing * this.spd;
    } else {
      this.setState('idle'); this.vx = 0;
    }
    void lv;
  }

  aiArcher(dt, p, dx, adx) {
    const quality = this.level.combatQualityTrial === true;
    if (!quality || this.state !== 'shoot') this.facing = Z.U.sign(dx) || 1;
    else this.facing = this.attackDir || this.facing;
    if (this.state === 'shoot') {
      if (this.stateT >= 0.2 && !this._shot) {
        this._shot = true;
        const sy = this.y - this.h * 0.62;
        this.level.spawnProj(new Projectile(this.x + this.facing * 14, sy, {
          vx: this.facing * 430, vy: 0, dmg: this.atk, team: 'enemy', kind: 'arrow', src: this, r: 7, life: 2.2,
        }));
        Z.Audio.sfx('shoot');
      }
      if (this.stateT >= 0.42) { this.setState('idle'); this.atkCd = Z.U.rand(1.6, 2.6); this._shot = false; }
      return;
    }
    if (p.dead) { this.setState('idle'); this.vx = 0; return; }
    if (adx < 200) { this.setState('walk'); this.vx = -this.facing * this.spd; }
    else if (adx > 400) { this.setState('walk'); this.vx = this.facing * this.spd; }
    else {
      this.vx = 0;
      if (this.atkCd <= 0 && this.pressureTurn(true)) {
        this.attackDir = this.facing;
        this.setState('shoot', 0.42); this._shot = false;
      }
      else this.setState('idle');
    }
  }

  aiFly(dt, p, dx, adx) {
    const lv = this.level;
    const gy = lv.gy;
    const B = Z.BAL.enemies.feiyao;
    if (this.state === 'dash') {
      if (this.stateT > 0.25 && Z.U.aabb({ x: this.x - 18, y: this.y - 24, w: 36, h: 34 }, p.hurtbox())) {
        Z.Combat.applyHit(this, p, this.atk, { kb: this.facing * 160, flat: true });
        this.setState('recover', 1.0);
        this.vx = 0; this.vy = 0;
      }
      if (this.y >= gy - 8) { this.y = gy - 8; this.vx = 0; this.vy = 0; this.setState('recover', 1.0); Z.FX.add('dust', this.x, gy, {}); Z.FX.shake(3, 0.12); }
      if (this.stateT >= 0.6) this.setState('idle'); // 扑空且未落地（边缘）兜底
      this.fly = true;
      return;
    }
    if (this.state === 'recover') {
      // 扑空后趴在地上，任人宰割的惩罚窗口
      this.vx = 0; this.vy = 0;
      this.y = Math.min(this.y + 400 * dt, gy - 8);
      if (this.stateT >= 1.0) this.setState('idle');
      this.fly = true;
      return;
    }
    if (this.state === 'tele') {
      // 俯冲预警：原地颤抖，可被打断
      this.vx = 0; this.vy = Math.sin(this.animClock * 30) * 26;
      if (this.stateT >= 0.38) {
        this.setState('dash', 0.6);
        this.vx = this.facing * 140; this.vy = 430;
        Z.Audio.sfx('dash');
      }
      this.fly = true;
      return;
    }
    // 低空悬停（地面普攻可及），跟随玩家
    const hoverY = gy - (B.hoverH || 52) + Math.sin(this.animClock * 2 + this.seed * 9) * 10;
    this.vx = Z.U.approach(this.vx, Z.U.clamp((p.x - this.x) * 2.2, -this.spd, this.spd), 600 * dt);
    this.vy = Z.U.approach(this.vy, (hoverY - this.y) * 3, 500 * dt);
    if (!p.dead) this.facing = Z.U.sign(p.x - this.x) || 1;
    if (this.atkCd <= 0 && !p.dead && adx < 56 && p.y > this.y + 10 && this.pressureTurn(true)) {
      this.setState('tele', 0.38);
      Z.Audio.sfx('telegraph');
      Z.FX.add('star', this.x, this.y - 26, { r: 9, life: 0.38, color: '#ff8866' });
      this.atkCd = Z.U.rand(2.8, 4.2);
    }
    this.fly = true;
    void dx; void adx; void lv;
  }

  die(o) {
    super.die();
    const lv = this.level;
    // 尸体表现：被击飞、旋转、淡出
    if (lv) {
      lv.corpses.push({
        x: this.x, y: this.y, facing: this.facing, w: this.w, h: this.h,
        type: this.type, vx: (o && o.kb ? Z.U.sign(o.kb) : -this.facing) * Z.U.rand(90, 170),
        vy: -Z.U.rand(160, 260), spin: Z.U.rand(3, 7) * (o && o.kb ? Z.U.sign(o.kb) : 1),
        t: 0, life: 0.65, fly: this.fly,
      });
      if (lv.corpses.length > 8) lv.corpses.shift();
    }
    Z.FX.add('star', this.x, this.y - this.h / 2, { r: 16, life: 0.4 });
    for (let i = 0; i < 6; i++) Z.FX.add('dust', this.x + Z.U.rand(-14, 14), this.y - Z.U.rand(0, 30), {});
    // 经验
    if (o && o.silent !== true) {
      lv.onKill(this);
    }
  }

  draw(g) { Z.Spr.drawMob(g, this); }
}

/* ================= Boss ================= */
class Boss extends Fighter {
  constructor(x, y, bid, stage) {
    const b = Z.BAL.bosses[bid];
    super(x, y, {
      w: b.w, h: b.h, team: 'enemy',
      maxHp: Math.round(b.hp * (Z.BAL.stageHp[stage] || 1)),
      atk: Math.round(b.atk * (Z.BAL.stageAtk[stage] || 1)),
      def: 30, spd: b.spd, bid, isBoss: true, superArmor: true,
      xp: b.xp, goldMin: b.gold[0], goldMax: b.gold[1],
    });
    this.petball = b.petball;
    this.name = b.name; this.title = b.title;
    if (bid === 'guiguo') this.def = 55; // 龟丞相天生高防
    // 弹幕属性随Boss（火焰/罡风/音波/剑气）
    this.pkKind = { zengzhang: 'wave', chiguo: 'sound', guiguo: 'sound', aoguang: 'sound', honghaier: 'fire', tieshan: 'wind' }[bid] || 'wave';
    this.pkKb = bid === 'tieshan' ? 460 : 0; // 铁扇罡风强击退
    this.patCd = 1.2;
    this.phase = 1;
    this.spawnedAdd = false;
    this.patternIndex = 0;
    this.recoveryT = 0; this.recoveryDur = 0; this.recoverPat = null;
    this.shellT = 0; // v83 龟丞相玄甲壳剩余时间
    this.setState('intro', 1.8);
    this.invulnT = 1.8;
  }

  takeDamage(dmg, o = {}) {
    // v83 龟丞相玄甲壳：壳内减伤 85%，读作「等他破壳再打」
    if (this.shellT > 0) dmg = Math.max(1, Math.round(dmg * 0.15));
    return super.takeDamage(dmg, o);
  }

  update(dt) {
    super.update(dt);
    const lv = this.level, p = lv.player;
    this.shellT = Math.max(0, this.shellT - dt);
    const hpr = this.hp / this.maxHp;
    // 阶段
    if (this.bid === 'juling') {
      if (hpr < 0.3 && this.phase < 2) {
        this.phase = 2; this.enterPhase(lv, p);
        if (lv.combatQualityTrial === true) this.trialAttackIndex = 0;
        Z.FX.text(this.x, this.y - this.h - 30, '巨灵神狂暴了！', { color: '#ff7a5e', size: 20 });
      }
    }
    if (this.bid === 'aoguang') {
      if (hpr < 0.6 && this.phase < 2) { this.phase = 2; this.enterPhase(lv, p); }
      if (hpr < 0.3 && this.phase < 3) { this.phase = 3; this.enterPhase(lv, p); }
    }
    if (this.bid === 'honghaier' && hpr < 0.5 && this.phase < 2) {
      this.phase = 2; this.enterPhase(lv, p);
      Z.FX.text(this.x, this.y - this.h - 30, '三昧真火！', { color: '#ff8830', size: 20 });
    }
    if (this.bid === 'chiguo' && hpr < 0.5 && this.phase < 2) {
      this.phase = 2; this.enterPhase(lv, p);
      Z.FX.text(this.x, this.y - this.h - 30, '弦音破阵！', { color: '#c9b7ff', size: 20 });
    }
    if (this.bid === 'niuwang' && hpr < 0.35 && this.phase < 2) {
      this.phase = 2; this.enterPhase(lv, p);
      Z.FX.text(this.x, this.y - this.h - 30, '牛魔王暴怒！', { color: '#ff5545', size: 20 });
    }
    if (this.bid === 'erlang') {
      if (hpr < 0.35 && this.phase < 3) { this.phase = 3; this.enterPhase(lv, p); }
      else if (hpr < 0.65 && this.phase < 2) { this.phase = 2; this.enterPhase(lv, p); }
    }
    if (this.bid === 'zengzhang' && hpr < 0.55 && !this.spawnedAdd) {
      if (lv.combatQualityTrial === true) this.summonPending = true;
      else {
        this.spawnedAdd = true;
        lv.spawnMinion('tianbing', this.x - 200); lv.spawnMinion('tianbing', this.x + 200);
        Z.FX.text(this.x, this.y - this.h - 30, '天兵何在！', { color: '#8fd0ff', size: 18 });
      }
    }
    if (this.bid === 'erlang' && this.phase >= 3 && !this.spawnedAdd) {
      this.spawnedAdd = true;
      lv.spawnMinion('xiaotian', this.x - 160); lv.spawnMinion('xiaotian', this.x + 160);
      Z.FX.text(this.x, this.y - this.h - 30, '哮天犬，上！', { color: '#ff9a7e', size: 18 });
    }

    if (this.hitstunT > 0) { this.physics(dt, lv); return; }
    if (this.state === 'intro') {
      if (this.stateT >= 1.8) this.setState('idle');
      this.physics(dt, lv);
      return;
    }
    if (p.dead) {
      this.setState('idle'); this.vx = 0;
      this.physics(dt, lv);
      return;
    }

    // 后续守将有明确、固定的反击段；挪用原来的游走等待，不增加血量拖长战斗。
    if (this.recoveryT > 0) {
      this.recoveryT = Math.max(0, this.recoveryT - dt); this.vx = 0;
      if (this.state !== 'recover') this.setState('recover', this.recoveryDur);
      this.physics(dt, lv);
      if (this.recoveryT <= 0) { this.recoverPat = null; this.setState('idle'); }
      return;
    }

    // 半血召兵等本招和收势结束；召唤自带可见准备，不夹进剑招命中帧。
    if (this.bid === 'zengzhang' && lv.combatQualityTrial === true && !this.pat && this.summonPending) {
      if (!(this.summonT > 0)) {
        this.summonT = .7; this.setState('cast', .7); this.vx = 0;
        Z.FX.text(this.x, this.y - this.h - 30, '天兵何在！', { color: '#8fd0ff', size: 18 });
        Z.FX.add('ring', this.x, this.y - 24, { r: 64, life: .7, color: '#a4d7ed' });
        Z.Audio.sfx('telegraph');
      }
      this.summonT = Math.max(0, this.summonT - dt); this.vx = 0;
      if (this.summonT <= 0) {
        this.spawnedAdd = true; this.summonPending = false;
        for (const side of [-1, 1]) {
          const e = lv.spawnMinion('tianbing', this.x + side * 200);
          if (e) e.atkCd = Math.max(e.atkCd, .7);
        }
        this.recoverPat = 'summon'; this.recoveryT = this.recoveryDur = 1.5; this.patCd = .45;
        this.setState('recover', this.recoveryDur);
      }
      this.physics(dt, lv); return;
    }

    // 执行当前招式
    if (this.pat) {
      if (this.bid === 'juling' && lv.combatQualityTrial === true) {
        this.runJulingTrial(dt, lv, p); return;
      }
      this.runPat(dt, lv, p);
      this.physics(dt, lv); return;
    }

    // 追击
    const dx = p.x - this.x, adx = Math.abs(dx);
    this.facing = Z.U.sign(dx) || 1;
    if (adx > 80) {
      this.setState('walk');
      const spdM = this.phase >= 3 ? 1.35 : 1;
      this.vx = this.facing * this.spd * spdM;
    } else { this.setState('idle'); this.vx = 0; }

    this.patCd -= dt;
    if (this.patCd <= 0 && adx < 460) {
      if (this.bid === 'zengzhang' && lv.combatQualityTrial === true &&
          lv.enemies.some(e => e.pressureActive && e.pressureActive())) {
        this.vx = 0; this.setState('idle'); this.physics(dt, lv); return;
      }
      this.patCd = (this.phase >= 3 ? 1.1 : 1.7) + Z.U.rand(0, 0.7);
      this.pickPat(lv, p, adx);
    }
    this.physics(dt, lv);
  }

  enterPhase(lv, p) {
    Z.FX.flash('#ffd24a', 0.15);
    Z.FX.shake(8, 0.3);
    Z.FX.add('ring', this.x, this.y - 20, { r: 120, life: 0.5 });
    Z.Audio.sfx('bossroar');
    this.patCd = 0.8;
    this.patternIndex = 0;
    void lv; void p;
  }

  pickPat(lv, p, adx) {
    if (this.bid === 'zengzhang' && lv.combatQualityTrial === true) {
      const moves = ['wave', 'dash', 'combo', 'rend'];
      this.pat = { n: moves[this.patternIndex++ % moves.length], t: 0, step: 0 };
      return;
    }
    if (this.bid === 'juling' && lv.combatQualityTrial === true && this.phase >= 2) {
      const moves = ['charge', 'combo', 'slam'];
      this.pat = { n: moves[(this.trialAttackIndex || 0) % moves.length], t: 0, step: 0 };
      this.trialAttackIndex = (this.trialAttackIndex || 0) + 1;
      return;
    }
    // 具名守将按打法轮换，连续观感能预判下一轮；不同阶段开放原有招式。
    // v83：每个 Boss 一个改写应对规则的招牌技（rain 剑雨 / strings 五弦 / laser3 天眼三连 /
    // dash3 三段突 / shell 龟壳 / tidal 潮汐 / ember 真火抛射 / gale 飓风），预警三段不变。
    const rotations = {
      chiguo: this.phase >= 2 ? ['strings', 'blink', 'pulse'] : ['waves3', 'blink', 'strings'],
      erlang: this.phase >= 3 ? ['laser3', 'thrust', 'spin', 'combo'] : this.phase >= 2 ? ['thrust', 'laser3', 'combo'] : ['thrust', 'combo'],
      yecha: ['dash3', 'combo', 'wave'], guiguo: ['waves3', 'shell', 'charge', 'radial'],
      aoguang: this.phase >= 3 ? ['tidal', 'breath', 'whirl', 'combo'] : this.phase >= 2 ? ['breath', 'whirl', 'combo', 'tidal'] : ['combo', 'radial'],
      honghaier: this.phase >= 2 ? ['ember', 'waves3', 'laser', 'dash'] : ['dash', 'ember', 'combo'],
      tieshan: ['wave', 'gale', 'radial', 'dash'], niuwang: this.phase >= 2 ? ['charge', 'slam', 'combo'] : ['combo', 'slam', 'charge'],
    };
    const rotation = rotations[this.bid];
    if (rotation) {
      this.pat = { n: rotation[this.patternIndex % rotation.length], t: 0, step: 0 };
      this.patternIndex++; return;
    }
    void lv;
    const r = Math.random();
    switch (this.bid) {
      case 'juling':
        if (r < 0.4) this.pat = { n: 'combo', t: 0, step: 0 };
        else if (r < 0.7) this.pat = { n: 'slam', t: 0, step: 0 };
        else this.pat = { n: 'charge', t: 0, step: 0 };
        break;
      case 'zengzhang':
        if (r < 0.2) this.pat = { n: 'wave', t: 0, step: 0 };
        else if (r < 0.38) this.pat = { n: 'dash', t: 0, step: 0 };
        else if (r < 0.56) this.pat = { n: 'combo', t: 0, step: 0 };
        else if (r < 0.76) this.pat = { n: 'rend', t: 0, step: 0 };
        else this.pat = { n: 'rain', t: 0, step: 0 };
        break;

    }
  }

  // 巨灵神品质规则；主线与塔沿用同一动作，显式旧版对照可关闭。
  runJulingTrial(dt, lv, p) {
    const pat = this.pat;
    const stage = (name, dur, carry = 0) => {
      pat.stage = name; pat.stageT = carry;
      this.setState(name, dur); this.stateT = carry;
    };
    const warn = () => {
      let a, b;
      if (pat.n === 'slam') {
        a = pat.waveX - pat.dir * 20; b = pat.waveX + pat.dir * 340 * 1.6 + pat.dir * 20;
      } else if (pat.n === 'charge') {
        a = Math.min(pat.sx, pat.endX) - this.w / 2;
        b = Math.max(pat.sx, pat.endX) + this.w / 2;
      } else {
        a = this.x + pat.dir * 10; b = this.x + pat.dir * 88;
      }
      Z.FX.add('mark', (a + b) / 2, lv.gy, {
        w: Math.abs(b - a), life: pat.windup + (pat.n === 'charge' ? 0 : pat.hitTime), dir: pat.dir,
      });
      Z.FX.add('star', this.x + pat.dir * 30, this.y - this.h * .7, { r: 12, life: pat.windup, color: '#ffd899' });
      Z.Audio.sfx('telegraph');
    };
    if (!pat.trial) {
      Object.assign(pat, {
        trial: true, stageT: 0, dir: Z.U.sign(p.x - this.x) || this.facing,
        sx: this.x, enraged: this.phase >= 2, hitTime: .08, hit: false,
        windup: pat.n === 'combo' ? .48 : pat.n === 'slam' ? .65 : .60,
        activeDur: pat.n === 'combo' ? .22 : pat.n === 'slam' ? .30 : .70,
        recoverDur: pat.n === 'combo' ? 1.25 : pat.n === 'slam' ? 1.55 : 1.35,
      });
      pat.waveX = pat.sx + pat.dir * 30;
      pat.speed = pat.enraged ? 440 : 360;
      pat.endX = Z.U.clamp(pat.sx + pat.dir * pat.speed * pat.activeDur,
        lv.def.w - 920 + this.w / 2, lv.def.w - 40 - this.w / 2);
      this.recoverPat = null;
      stage('tele', pat.windup); warn();
    }
    pat.t += dt; pat.stageT += dt;
    this.stateT = pat.stageT; this.facing = pat.dir; this.vx = 0;
    if (pat.stage === 'tele') {
      if (pat.stageT + 1e-9 >= pat.windup) {
        stage('atk', pat.activeDur, Math.max(0, pat.stageT - pat.windup));
        Z.Audio.sfx(pat.n === 'charge' ? 'dash' : 'swing');
      }
      this.physics(dt, lv);
      return;
    }
    if (pat.stage === 'recover') {
      if (pat.stageT + 1e-9 >= pat.recoverDur) {
        this.pat = null; this.recoverPat = null;
        this.setState('idle'); this.patCd = this.phase >= 2 ? .18 : .28;
      }
      this.physics(dt, lv);
      return;
    }
    if (pat.n === 'charge') {
      this.vx = pat.dir * Math.min(pat.speed, Math.max(0, (pat.endX - this.x) * pat.dir) / dt);
      this.physics(dt, lv);
      if (!pat.hit && p.invulnT <= 0 && Z.U.aabb(this.hurtbox(), p.hurtbox())) {
        pat.hit = true;
        Z.Combat.applyHit(this, p, this.atk, { kb: pat.dir * 300, flat: true, heavy: true });
        Z.FX.shake(6, .2);
      }
    } else {
      this.physics(dt, lv);
      if (!pat.hit && pat.stageT + 1e-9 >= pat.hitTime) {
        pat.hit = true;
        Z.Audio.sfx('hitHeavy');
        if (pat.n === 'combo') {
          const box = { x: pat.dir > 0 ? this.x + 10 : this.x - 88, y: this.y - this.h - 10, w: 78, h: this.h + 10 };
          Z.Combat.melee(this, box, 1, { kb: pat.dir * 240, shake: 6 });
          Z.FX.add('slash', this.x + pat.dir * 44, this.y - this.h * .6, { r: 34, rot: .3, flip: pat.dir, life: .22 });
        } else {
          Z.FX.shake(10, .3);
          for (let i = 0; i < 6; i++) Z.FX.add('dust', pat.waveX + pat.dir * i * 24, lv.gy, {});
          lv.spawnProj(new Projectile(pat.waveX, lv.gy - 4, {
            vx: pat.dir * 340, vy: 0, dmg: this.atk * 1.2, team: 'enemy', kind: 'shock', src: this,
            r: 20, life: 1.6, maxLife: 1.6, heavy: true,
          }));
        }
      }
    }
    if (pat.stageT + 1e-9 >= pat.activeDur) {
      const carry = Math.max(0, pat.stageT - pat.activeDur);
      this.vx = 0;
      if (pat.n === 'combo' && pat.step < 2) {
        pat.step++; pat.hit = false; pat.windup = pat.enraged ? .30 : .42;
        stage('tele', pat.windup, carry); warn();
      } else {
        this.recoverPat = pat.n;
        stage('recover', pat.recoverDur, carry);
      }
    }
  }

  // 每个招式是一个小状态机
  runPat(dt, lv, p) {
    const pat = this.pat;
    if (!pat.readable) {
      pat.readable = true; pat.dir = this.facing; pat.originX = this.x;
      pat.enraged = this.phase >= 2;
    }
    this.facing = pat.dir;
    pat.t += dt;
    const T = pat.t;
    // 姿势计时只在换动作/连段时归零，命中仍沿用 pat.t。
    const pose = (state, dur = 0) => {
      if (this.state !== state || pat.poseStep !== pat.step) {
        this.setState(state, dur); pat.poseStep = pat.step;
      }
    };
    const done = () => {
      this.pat = null; this.vx = 0;
      if (this.bid === 'zengzhang' && lv.combatQualityTrial === true) {
        this.recoverPat = pat.n; this.recoverAt = T;
        this.recoveryT = this.recoveryDur = ({ combo: 1.4, rend: 1.35, dash: 1.2, wave: 1.1 })[pat.n] || 1.2;
        this.patCd = .45; pose('recover', this.recoveryDur);
      } else if (this.bid !== 'juling' && this.bid !== 'zengzhang') {
        this.recoverPat = pat.n; this.recoverAt = T;
        this.recoveryDur = ({ combo: 1.05, slam: 1.10, charge: 1.05, dash: .85, thrust: .9, spin: 1.1,
          wave: .8, waves3: .8, radial: .9, laser: .95, breath: 1.0, whirl: .95,
          rain: .9, strings: .85, pulse: .9, laser3: 1.0, dash3: .9, shell: .9, tidal: 1.0, ember: .9, gale: .9 })[pat.n] || .8;
        this.recoveryT = this.recoveryDur;
        this.patCd = this.phase >= 2 ? .18 : .30;
        pose('recover', this.recoveryDur);
      } else pose('idle');
    };
    const bounds = () => {
      const zone = lv.zones && lv.zones.boss && lv.zones.boss.bounds;
      return zone ? [zone[0] + this.w / 2 + 8, zone[1] - this.w / 2 - 8]
        : lv.phase === 'boss' ? [lv.def.w - 920 + this.w / 2, lv.def.w - 40 - this.w / 2] : [30, lv.def.w - 30];
    };
    const pathWarn = (speed, duration, back, front, life) => {
      const [lo, hi] = bounds();
      pat.endX = Z.U.clamp(pat.originX + pat.dir * speed * duration, lo, hi);
      const a = pat.originX - pat.dir * back, b = pat.endX + pat.dir * front;
      Z.FX.add('mark', (a + b) / 2, lv.gy, { w: Math.abs(b - a), life, dir: pat.dir });
      Z.Audio.sfx('telegraph');
    };
    if (this.state !== 'tele' && this.state !== 'atk' && this.state !== 'cast') pose('walk');

    switch (pat.n) {
      /* ---- 巨灵神 ---- */
      case 'combo': {
        // 三连锤击
        const seq = [0, 0.55, 1.1];
        if (pat.step < 3) {
          const local = T - seq[pat.step];
          if (local < 0.32) {
            pose('tele', 0.32);
            if (this.bid !== 'juling' && (this.bid !== 'zengzhang' || lv.combatQualityTrial === true)) this.vx = 0;
            if (pat._tg == null || pat._tg < pat.step) { Z.Audio.sfx('telegraph'); pat._tg = pat.step; }
          } else if (local < 0.5) {
            pose('atk', 0.3);
            this.vx = this.facing * 120;
            if (local > 0.36 && local < 0.46 && !pat['h' + pat.step]) {
              pat['h' + pat.step] = true;
              const box = { x: this.facing > 0 ? this.x + 10 : this.x - 88, y: this.y - this.h - 10, w: 78, h: this.h + 10 };
              Z.Combat.melee(this, box, 1.0, { kb: this.facing * 240, shake: 6 });
              Z.FX.add('slash', this.x + this.facing * 44, this.y - this.h * 0.6, { r: 34, rot: Z.U.rand(-0.4, 0.4), flip: this.facing, life: 0.22 });
              Z.Audio.sfx('hitHeavy');
            }
          } else { pat.step++; if (this.bid !== 'juling' && (this.bid !== 'zengzhang' || lv.combatQualityTrial === true)) this.vx = 0; }
        } else done();
        break;
      }
      case 'slam': {
        if (pat.step === 0) {
          pose('tele', 0.5);
          this.vx = 0;
          if (T > 0.1 && !pat.mk) {
            pat.mk = true;
            pat.dir = this.facing;
            const start = this.x + pat.dir * 30, end = start + pat.dir * 340 * 1.6;
            Z.FX.add('mark', (start + end) / 2, lv.gy, { w: Math.abs(end - start) + 40, life: .5 - T + dt, dir: pat.dir });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.5) pat.step = 1;
        } else if (pat.step === 1) {
          pose('atk', 0.4);
          if (!pat.hit) {
            pat.hit = true;
            this.facing = pat.dir;
            Z.FX.shake(10, 0.3);
            Z.FX.flash('rgba(255,200,120,1)', 0.08);
            Z.Audio.sfx('hitHeavy');
            for (let i = 0; i < 6; i++) Z.FX.add('dust', this.x + this.facing * (30 + i * 24), lv.gy, {});
            lv.spawnProj(new Projectile(this.x + this.facing * 30, lv.gy - 4, {
              vx: this.facing * 340, vy: 0, dmg: this.atk * 1.2, team: 'enemy', kind: 'shock', src: this, r: 20, life: 1.6, maxLife: 1.6, heavy: true,
            }));
            // v83 牛魔王狂暴：落斧震出双向地波，并一次性召来两头牛妖
            if (this.bid === 'niuwang' && this.phase >= 2) {
              lv.spawnProj(new Projectile(this.x - this.facing * 30, lv.gy - 4, {
                vx: -this.facing * 340, vy: 0, dmg: this.atk * 1.2, team: 'enemy', kind: 'shock', src: this, r: 20, life: 1.6, maxLife: 1.6, heavy: true,
              }));
              if (!this.spawnedAdd && lv.enemies.filter(e => !e.dead).length < 2) {
                this.spawnedAdd = true;
                for (const s of [-1, 1]) {
                  const add = new Enemy(this.x + s * 80, lv.gy, 'niuyao', lv.idx);
                  add.level = lv;
                  lv.enemies.push(add);
                  Z.FX.add('star', add.x, add.y - 46, { r: 18, life: 0.45, color: '#ff9a7e' });
                }
                Z.Audio.sfx('bossroar');
              }
            }
          }
          if (T >= 0.95) done();
        }
        break;
      }
      case 'charge': {
        if (pat.step === 0) {
          pose('tele', 0.4); this.vx = 0;
          if (!pat.mk) {
            pat.mk = true; pat.speed = this.bid === 'niuwang' && pat.enraged ? 500 : 430;
            pathWarn(pat.speed, .8, this.w / 2, this.w / 2, .4);
          }
          if (T >= 0.4) pat.step = 1;
        } else {
          pose('walk');
          this.vx = this.facing * (Number.isFinite(pat.endX) ? Math.min(pat.speed || 430, Math.max(0, (pat.endX - this.x) * this.facing) / dt) : 430);
          if (!pat.h3 || T > pat.h3 + 0.3) {
            if (Z.U.aabb({ x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }, p.hurtbox())) {
              Z.Combat.applyHit(this, p, this.atk, { kb: this.facing * 300, flat: true, heavy: true });
              pat.h3 = T;
              Z.FX.shake(6, 0.2);
            }
          }
          if (T > 1.2) { done(); this.vx = 0; }
        }
        break;
      }
      /* ---- 增长天王 ---- */
      case 'wave': {
        // 起势：剑尖蓄光，预警后连发两道剑气
        if (pat.step === 0) {
          pose('tele', 0.38); this.vx = 0;
          if (T > 0.05 && !pat.mk) {
            pat.mk = true;
            Z.FX.add('mark', this.x + this.facing * 120, lv.gy, { w: 210, life: 0.38, color: '#7db4ff' });
            Z.FX.add('star', this.x + this.facing * 24, this.y - this.h * 0.62, { r: 16, life: 0.35, color: '#bcd8ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.38) pat.step = 1;
        } else {
          pose('atk', 0.3);
          const times = [0.45, 0.72];
          for (let i = 0; i < 2; i++) {
            if (T >= times[i] && !pat['f' + i]) {
              pat['f' + i] = true;
              const sy = this.y - this.h * 0.6;
              lv.spawnProj(new Projectile(this.x + this.facing * 26, sy, {
                vx: this.facing * (this.pkKind === 'wind' ? 520 : 400), vy: 0, dmg: this.atk * 0.8, team: 'enemy',
                kind: this.pkKind, src: this, r: this.pkKind === 'wind' ? 15 : 13, life: 2, kbOv: this.pkKb,
              }));
              Z.Audio.sfx('swing');
            }
          }
          if (T > 1.0) done();
        }
        break;
      }
      case 'dash': {
        if (pat.step === 0) {
          pose('tele', 0.4); this.vx = 0;
          if (!pat.mk) this.facing = Z.U.sign(p.x - this.x) || 1;
          if (T > 0.05 && !pat.mk) {
            pat.mk = true;
            pat.dir = this.facing; pat.sx = this.x;
            const len = 300;
            // 从起点后 20px 开始覆盖碰撞箱；预警后不再转向玩家。
            if (this.bid === 'zengzhang') {
              Z.FX.add('mark', pat.sx + pat.dir * (len / 2 - 20), lv.gy, { w: len, life: 0.4 });
              Z.Audio.sfx('telegraph');
            } else pathWarn(520, .45, 20, 20, .4);
          }
          if (T >= 0.4) { pat.step = 1; Z.Audio.sfx('dash'); }
        } else {
          pose('walk');
          this.facing = pat.dir;
          this.vx = this.facing * (Number.isFinite(pat.endX) ? Math.min(520, Math.max(0, (pat.endX - this.x) * this.facing) / dt) : 520);
          if (Z.U.aabb({ x: this.x - 20, y: this.y - this.h - 8, w: 40, h: this.h + 8 }, p.hurtbox()) && (!pat.h3 || T > pat.h3 + 0.4)) {
            Z.Combat.applyHit(this, p, this.atk * 1.1, { kb: this.facing * 260, flat: true });
            pat.h3 = T;
          }
          Z.FX.add('after', this.x, this.y, { w: this.w, h: this.h, life: 0.25 });
          if (T > 0.85) { done(); this.vx = 0; }
        }
        break;
      }
      case 'rend': {
        // 招牌·裂空剑斩：锁定玩家落点预警，剑气光柱劈落
        if (pat.step === 0) {
          pose('cast', 0.6); this.vx = 0;
          if (T > 0.05 && !pat.mk) {
            pat.mk = true;
            pat.lx = p.x;
            Z.FX.add('mark', pat.lx, lv.gy, { w: 96, life: 0.6 });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6) { pat.step = 1; }
        } else {
          pose('atk', 0.35);
          if (!pat.hit) {
            pat.hit = true;
            Z.Audio.sfx('beam');
            Z.FX.shake(8, 0.25);
            Z.FX.add('laser', pat.lx, lv.gy, { immediate: true, beamWidth: 68, life: 0.4, color: '#bcd8ff' });
            Z.FX.add('slash', pat.lx, lv.gy - 30, { r: 40, rot: 1.5, flip: 1, life: 0.25 });
            const box = { x: pat.lx - 34, y: 0, w: 68, h: lv.gy };
            if (Z.U.aabb(box, p.hurtbox())) Z.Combat.applyHit(this, p, this.atk * 1.35, { kb: 0, flat: true, heavy: true });
          }
          if (T > 1.05) done();
        }
        break;
      }
      /* ---- 持国天王 ---- */
      case 'waves3': {
        if (pat.step === 0) {
          pose('tele', 0.5); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            Z.FX.add('star', this.x + this.facing * 24, this.y - this.h * .55, { r: 15, life: .5, color: '#ffe0a1' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.5) {
            pat.step = 1;
            Z.Audio.sfx('shoot');
            const sy = this.y - this.h * 0.55;
            for (const dy of [-90, 0, 90]) {
              const vy = dy === 0 ? 0 : dy * 1.1;
              lv.spawnProj(new Projectile(this.x + this.facing * 24, sy, {
                vx: this.facing * 310, vy, dmg: this.atk * 0.9, team: 'enemy', kind: this.pkKind, src: this, r: 12, life: 2.4, kbOv: this.pkKb,
              }));
            }
            Z.FX.add('ring', this.x + this.facing * 20, sy, { r: 44, life: 0.4 });
          }
        } else { pose('cast', 0.4); if (T > 0.9) done(); }
        break;
      }
      case 'blink': {
        if (pat.step === 0) {
          pose('tele', 0.4); this.vx = 0;
          if (!pat.mk) {
            pat.mk = true;
            const [lo, hi] = bounds();
            pat.blinkX = Z.U.clamp(p.x - p.facing * 130, lo, hi);
            Z.FX.add('mark', pat.blinkX, lv.gy, { w: 84, life: .35, color: '#c8a0ef' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.35 && !pat.tp) {
            pat.tp = true;
            Z.FX.add('star', this.x, this.y - this.h / 2, { r: 20, life: 0.35 });
            this.x = pat.blinkX;
            this.y = lv.gy;
            Z.FX.add('star', this.x, this.y - this.h / 2, { r: 20, life: 0.35 });
            Z.Audio.sfx('dash');
          }
          if (T >= 0.4) pat.step = 1;
        } else {
          this.facing = Z.U.sign(p.x - this.x) || 1;
          pat.n = 'waves3'; pat.t = 0; pat.step = 0;
          pat.readable = false; pat.poseStep = null;
        }
        break;
      }
      case 'radial': {
        if (pat.step === 0) {
          pose('cast', 0.6); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            Z.FX.add('ring', this.x, this.y - this.h * .55, { r: 54, sq: 1, life: .6, color: '#e1b2ef' });
            Z.FX.add('star', this.x, this.y - this.h * .55, { r: 17, life: .6, color: '#ffe0a1' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6) {
            pat.step = 1;
            Z.Audio.sfx('wushuang');
            const cx = this.x, cy = this.y - this.h * 0.55;
            for (let i = 0; i < 8; i++) {
              const a = i / 8 * Z.U.TAU + 0.3;
              lv.spawnProj(new Projectile(cx, cy, {
                vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, dmg: this.atk * 0.8, team: 'enemy', kind: this.pkKind, src: this, r: 11, life: 2.6, kbOv: this.pkKb,
              }));
            }
            Z.FX.add('ring', cx, cy, { r: 60, life: 0.5, sq: 1 });
          }
        } else { if (T > 1.1) done(); }
        break;
      }
      /* ---- 二郎神 ---- */
      case 'laser': {
        if (pat.step === 0) {
          pose('cast', 0.75); this.vx = 0;
          if (T > 0.05 && !pat.mk) {
            pat.mk = true;
            pat.lx = p.x;
            Z.FX.add('mark', pat.lx, lv.gy, { w: 64, life: Math.max(dt, .6 - T), color: '#ffcd83' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6 && !pat.hit) {
            pat.hit = true;
            Z.FX.add('laser', pat.lx, lv.gy, { immediate: true, beamWidth: 44, life: .3 });
            Z.Audio.sfx('beam');
            Z.FX.shake(8, 0.25);
            const box = { x: pat.lx - 22, y: 0, w: 44, h: lv.gy };
            if (Z.U.aabb(box, p.hurtbox())) Z.Combat.applyHit(this, p, this.atk * 1.6, { kb: 0, flat: true, heavy: true });
          }
          if (T > 0.9) done();
        }
        break;
      }
      case 'thrust': {
        if (pat.step === 0) {
          pose('tele', 0.35); this.vx = 0;
          if (!pat.mk) { pat.mk = true; pathWarn(480, .45, 16, 40, .35); }
          if (T >= 0.35) { pat.step = 1; Z.Audio.sfx('swing'); }
        } else {
          pose('atk', 0.35);
          this.vx = this.facing * (Number.isFinite(pat.endX) ? Math.min(480, Math.max(0, (pat.endX - this.x) * this.facing) / dt) : 480);
          Z.FX.add('after', this.x, this.y, { w: this.w, h: this.h, life: 0.22 });
          if (Z.U.aabb({ x: this.facing > 0 ? this.x - 16 : this.x - 40, y: this.y - this.h - 10, w: 56, h: this.h + 10 }, p.hurtbox()) && (!pat.h3 || T > pat.h3 + 0.5)) {
            Z.Combat.applyHit(this, p, this.atk * 1.2, { kb: this.facing * 280, flat: true });
            pat.h3 = T;
          }
          if (T > 0.8) { done(); this.vx = 0; }
        }
        break;
      }
      case 'spin': {
        if (!pat.mk) { pat.mk = true; pathWarn(260, 1, 52, 52, .45); }
        if (T < .45) { pose('tele', .45); this.vx = 0; break; }
        if (T >= 1.45) { done(); break; }
        pose('walk');
        this.vx = this.facing * Math.min(260, Math.max(0, (pat.endX - this.x) * this.facing) / dt);
        if (!pat.hitIv || T > pat.hitIv + 0.25) {
          pat.hitIv = T;
          const box = { x: this.x - 52, y: this.y - this.h - 14, w: 104, h: this.h + 14 };
          Z.Combat.melee(this, box, 0.7, { kb: this.facing * 180, hitId: 'bspin', hitIv: 0.45 });
          Z.FX.add('slash', this.x, this.y - this.h * 0.55, { r: 40, rot: T * 9, flip: this.facing, life: 0.2 });
        }
        break;
      }
      /* ---- 敖广：龙息水柱 / 水龙卷 ---- */
      case 'breath': {
        pose('cast', 0.8); this.vx = 0;
        if (!pat.mk) {
          pat.mk = true;
          pat.xs = [p.x, Z.U.clamp(p.x - 140, 60, lv.def.w - 60), Z.U.clamp(p.x + 140, 60, lv.def.w - 60)];
          for (const x of pat.xs) Z.FX.add('mark', x, lv.gy, { w: 60, life: Math.max(dt, .55 - T), color: '#8ad4ff' });
          Z.Audio.sfx('telegraph');
        }
        if (T >= 0.55 && !pat.hit) {
          pat.hit = true;
          Z.Audio.sfx('beam');
          Z.FX.shake(9, 0.3);
          for (const lx of pat.xs) {
            Z.FX.add('laser', lx, lv.gy, { immediate: true, beamWidth: 40, life: .5, color: '#8ad4ff' });
            const box = { x: lx - 20, y: 0, w: 40, h: lv.gy };
            if (Z.U.aabb(box, p.hurtbox())) Z.Combat.applyHit(this, p, this.atk * 1.2, { kb: 0, flat: true, heavy: true });
          }
        }
        if (T > 1.1) done();
        break;
      }
      case 'whirl': {
        if (pat.step === 0) {
          pose('cast', 0.6); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            for (const side of [-1, 1]) Z.FX.add('star', this.x + side * 24, this.y - this.h * .5, { r: 14, life: .6, color: '#8ad4ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6) {
            pat.step = 1;
            Z.Audio.sfx('portal');
            for (const off of [-1, 1]) {
              lv.spawnProj(new Projectile(this.x, this.y - this.h * 0.5, {
                vx: off * 130, vy: -50, dmg: this.atk * 0.9, team: 'enemy', kind: 'whirl', src: this, r: 16, life: 3.5, homing: true,
              }));
            }
            Z.FX.add('ring', this.x, this.y - this.h * 0.5, { r: 50, life: 0.4, color: '#8ad4ff', sq: 1 });
          }
        } else if (T > 1.2) done();
        break;
      }
      /* ---- v83 招牌技 ---- */
      case 'rain': {
        // 增长天王·剑雨落阵：锁定四处落点，剑自天而降——横向走位躲进间隙
        if (pat.step === 0) {
          pose('cast', 0.6); this.vx = 0;
          if (T > 0.05 && !pat.mk) {
            pat.mk = true;
            const [lo, hi] = bounds();
            const span = hi - lo;
            pat.xs = [0, 1, 2, 3].map(i => lo + span * (0.14 + i * 0.24) + Z.U.rand(-26, 26));
            for (const x of pat.xs) Z.FX.add('mark', x, lv.gy, { w: 92, life: Math.max(dt, .6 - T), color: '#bcd8ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6) {
            pat.step = 1;
            Z.Audio.sfx('beam');
            for (const x of pat.xs) {
              lv.spawnProj(new Projectile(x, lv.gy - 560, { vx: 0, vy: 470, dmg: this.atk * 0.9, team: 'enemy', kind: 'sword', src: this, r: 12, life: 2 }));
            }
          }
        } else { pose('atk', 0.3); if (T > 1.25) done(); }
        break;
      }
      case 'strings': {
        // 持国天王·五弦连震：高/中/低五道音刃成巷，读巷道决定走、跳、停
        if (pat.step === 0) {
          pose('cast', 0.5); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            Z.FX.add('star', this.x + this.facing * 26, this.y - this.h * .55, { r: 15, life: .5, color: '#e2c2ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.5) pat.step = 1;
        } else {
          pose('cast', 0.35);
          const times = [0.55, 0.76, 0.97, 1.18, 1.39];
          const lanes = [lv.gy - 14, lv.gy - 134, lv.gy - 74, lv.gy - 14, lv.gy - 134];
          for (let i = 0; i < 5; i++) {
            if (T >= times[i] && !pat['f' + i]) {
              pat['f' + i] = true;
              Z.Audio.sfx('shoot');
              lv.spawnProj(new Projectile(this.x + this.facing * 26, lanes[i], {
                vx: this.facing * 330, vy: 0, dmg: this.atk * 0.75, team: 'enemy', kind: 'sound', src: this, r: 11, life: 2.4, kbOv: this.pkKb,
              }));
            }
          }
          if (T > 1.8) done();
        }
        break;
      }
      case 'pulse': {
        // 持国天王·摄魂音环：贴地音环向两侧扩散——必须跳过
        if (pat.step === 0) {
          pose('cast', 0.55); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            Z.FX.add('ring', this.x, this.y - this.h * .5, { r: 46, sq: .4, life: .55, color: '#e2c2ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.55) {
            pat.step = 1; Z.Audio.sfx('shoot');
            for (const dir of [-1, 1]) {
              lv.spawnProj(new Projectile(this.x + dir * 22, lv.gy - 8, {
                vx: dir * 300, vy: 0, dmg: this.atk * 0.85, team: 'enemy', kind: 'shock', src: this, r: 15, life: 2.4, tint: '#c9a2ff', kbOv: this.pkKb,
              }));
            }
            Z.FX.add('ring', this.x, this.y - this.h * .5, { r: 54, life: .4, sq: .4, color: '#e2c2ff' });
          }
        } else { pose('cast', 0.35); if (T > 1.0) done(); }
        break;
      }
      case 'laser3': {
        // 二郎神·天眼三连：三道天眼激光依次锁玩家当前位置——保持移动
        pose('cast', 0.75); this.vx = 0;
        pat.lxs = pat.lxs || [];
        const locks = [0.06, 0.62, 1.18], fires = [0.66, 1.22, 1.78];
        for (let i = 0; i < 3; i++) {
          if (T >= locks[i] && pat.lxs.length === i) {
            pat.lxs.push(p.x);
            Z.FX.add('mark', p.x, lv.gy, { w: 64, life: 0.6, color: '#ffcd83' });
            Z.Audio.sfx('telegraph');
          }
        }
        for (let i = 0; i < 3; i++) {
          if (T >= fires[i] && !pat['h' + i] && pat.lxs.length > i) {
            pat['h' + i] = true;
            Z.FX.add('laser', pat.lxs[i], lv.gy, { immediate: true, beamWidth: 44, life: .3 });
            Z.Audio.sfx('beam'); Z.FX.shake(7, 0.2);
            const box = { x: pat.lxs[i] - 22, y: 0, w: 44, h: lv.gy };
            if (Z.U.aabb(box, p.hurtbox())) Z.Combat.applyHit(this, p, this.atk * 1.35, { kb: 0, flat: true, heavy: true });
          }
        }
        if (T > 2.15) done();
        break;
      }
      case 'dash3': {
        // 巡海夜叉·三段突：三段连续突进，每段重新锁向——连续躲避不贪刀
        const seg = Math.min(2, Math.floor(T / 0.82));
        const local = T - seg * 0.82;
        if (T > 2.6) { done(); this.vx = 0; break; }
        if (local < 0.3) {
          pose('tele', 0.3); this.vx = 0;
          if (!pat['m' + seg]) {
            pat['m' + seg] = true;
            this.facing = Z.U.sign(p.x - this.x) || this.facing;
            pat.dir = this.facing;
            const len = seg === 2 ? 340 : 260;
            pat.endX = Z.U.clamp(this.x + pat.dir * len, lv.def.w - 920 + this.w / 2, lv.def.w - 40 - this.w / 2);
            Z.FX.add('mark', (this.x + pat.endX) / 2, lv.gy, { w: Math.abs(pat.endX - this.x) + this.w, life: 0.28, dir: pat.dir });
            Z.Audio.sfx('telegraph');
          }
        } else {
          pose('walk');
          this.facing = pat.dir;
          this.vx = this.facing * Math.min(520, Math.max(0, (pat.endX - this.x) * this.facing) / dt);
          Z.FX.add('after', this.x, this.y, { w: this.w, h: this.h, life: 0.22 });
          if (Z.U.aabb({ x: this.x - 20, y: this.y - this.h - 8, w: 40, h: this.h + 8 }, p.hurtbox()) && (!pat['h' + seg] || T > pat['h' + seg] + 0.4)) {
            Z.Combat.applyHit(this, p, this.atk * 1.05, { kb: this.facing * 260, flat: true });
            pat['h' + seg] = T;
          }
        }
        break;
      }
      case 'shell': {
        // 龟丞相·玄甲龟壳：缩壳减伤85%并缓步逼近，破壳即反扑——忍住输出留爆发
        if (pat.step === 0) {
          pose('cast', 2.0);
          if (!pat.mk) {
            pat.mk = true; this.shellT = 2.0;
            Z.Audio.sfx('stone');
            Z.FX.add('ring', this.x, this.y - this.h * .5, { r: 50, life: .5, color: '#8fd0a8', sq: 1 });
          }
          this.vx = Math.abs(p.x - this.x) > 60 ? Z.U.sign(p.x - this.x) * 26 : 0;
          if (T >= 2.0) {
            pat.step = 1; this.shellT = 0; this.patCd = 0.15;
            Z.Audio.sfx('hitHeavy');
            Z.FX.add('ring', this.x, this.y - this.h * .5, { r: 62, life: .4, color: '#8fd0a8', sq: 1 });
          }
        } else { pose('idle'); if (T > 2.1) done(); }
        break;
      }
      case 'tidal': {
        // 敖广·翻江倒海：整面潮汐自场边横扫全场——读时机跳浪
        if (pat.step === 0) {
          pose('cast', 0.8); this.vx = 0;
          if (!pat.mk) {
            pat.mk = true;
            pat.edgeX = p.x < lv.def.w - 480 ? lv.def.w - 30 : lv.def.w - 930;
            pat.vx = pat.edgeX > lv.def.w - 480 ? -460 : 460;
            Z.FX.add('mark', pat.edgeX, lv.gy, { w: 150, life: .8, color: '#8ad4ff' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.8) {
            pat.step = 1; Z.Audio.sfx('portal'); Z.FX.shake(8, 0.3);
            lv.spawnProj(new Projectile(pat.edgeX, lv.gy - 12, {
              vx: pat.vx, vy: 0, dmg: this.atk * 0.95, team: 'enemy', kind: 'shock', src: this, r: 26, life: 7, tint: '#5fb8e8', heavy: true, noDust: true,
            }));
          }
        } else { pose('cast', 0.4); if (T > 1.3) done(); }
        break;
      }
      case 'ember': {
        // 红孩儿·三昧真火：抛射火球落地留燃斑——落点是预警，火斑封锁走位
        if (pat.step === 0) {
          pose('cast', 0.6); this.vx = 0;
          if (!pat.warned) {
            pat.warned = true;
            Z.FX.add('star', this.x + this.facing * 20, this.y - this.h * .7, { r: 16, life: .6, color: '#ffb066' });
            Z.Audio.sfx('telegraph');
          }
          if (T >= 0.6) {
            pat.step = 1; Z.Audio.sfx('shoot');
            for (let i = 0; i < 3; i++) {
              const tx = Z.U.clamp(p.x + (i - 1) * 135 + Z.U.rand(-26, 26), lv.def.w - 900, lv.def.w - 60);
              const tt = 1.05, y0 = this.y - this.h * 0.7;
              lv.spawnProj(new Projectile(this.x, y0, {
                vx: (tx - this.x) / tt, vy: (lv.gy - y0) / tt - 0.5 * 560 * tt, grav: 560,
                dmg: this.atk * 0.7, team: 'enemy', kind: 'fire', src: this, r: 12, life: 3,
              }));
            }
          }
        } else { pose('cast', 0.3); if (T > 1.5) done(); }
        break;
      }
      case 'gale': {
        // 铁扇公主·芭蕉飓风：持续狂风把人推向最近的场边——顶着风走位
        if (pat.step === 0) {
          pose('cast', 1.6); this.vx = 0;
          if (!pat.mk) {
            pat.mk = true;
            pat.push = Z.U.sign(p.x - (lv.def.w - 480)) || 1;
            Z.Audio.sfx('portal');
          }
          if (!p.dead && p.invulnT <= 0 && p.onGround) {
            p.x = Z.U.clamp(p.x + pat.push * 135 * dt, lv.def.w - 920 + 20, lv.def.w - 20);
            if (Math.random() < dt * 8) Z.FX.add('dust', p.x, p.y, {});
          }
          if (Math.random() < dt * 22) {
            const baseX = pat.push > 0 ? lv.camX - 30 : lv.camX + 990;
            Z.FX.add('spark', baseX, lv.gy - Z.U.rand(8, 96), { vx: pat.push * 640, vy: Z.U.rand(-24, 24), life: 0.5, color: '#cfeee0' });
          }
          if (T >= 1.6) pat.step = 1;
        } else { pose('cast', 0.3); if (T > 1.9) done(); }
        break;
      }
      default:
        done();
    }
  }

  die(o) {
    if (this.dead) return;
    super.die(o);
    this.level.onKill(this);
    Z.FX.hitstop(0.4);
    Z.FX.flash('#ffe8b0', 0.3);
    Z.FX.shake(14, 0.6);
    for (let i = 0; i < 16; i++) {
      Z.FX.add('star', this.x + Z.U.rand(-40, 40), this.y - Z.U.rand(10, this.h), { r: Z.U.rand(8, 18), life: Z.U.rand(0.5, 0.9) });
    }
    Z.Audio.sfx('bossroar');
    this.level.onBossDead(this);
  }

  // v82 Boss 压迫感配色：气场/蓄能按 Boss 取色，低阶通用暖金
  static auraColor(bid) {
    return { juling: '#e8b04d', zengzhang: '#7fb8ff', chiguo: '#c9a2ff', guiguo: '#8fd0a8',
      aoguang: '#5fc8e8', honghaier: '#ff8a5e', tieshan: '#c98fe8', erlang: '#c8d8ff',
      niuwang: '#ff7a5e' }[bid] || '#e8b04d';
  }
  draw(g) {
    // v82 Boss 压迫感：脚下气场 + 施法蓄能（纯绘制，不产生判定与数值）
    const aura = Boss.auraColor(this.bid);
    const t = this.animClock || 0;
    const casting = ['tele', 'cast', 'shoot'].includes(this.state);
    const rage = this.phase >= 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * (rage ? 5.2 : 2.6));
    g.save();
    g.globalAlpha = (casting ? 0.34 : 0.15) + pulse * (casting ? 0.14 : 0.07);
    Z.Spr.ell(g, this.x, this.y - 2, this.w * (0.95 + pulse * 0.12), 12 + pulse * 2.5, rage ? '#e05a48' : aura);
    g.globalAlpha = 0.4;
    Z.Spr.ell(g, this.x, this.y - 2, this.w * 0.55, 7, 'rgba(255,244,214,0.55)');
    g.restore();
    if (casting) {
      // 蓄能：能量点从四周向胸口汇聚（相位确定，无逐帧状态），中心聚气光晕
      const cy = this.y - this.h * 0.55;
      g.save();
      for (let i = 0; i < 5; i++) {
        const u = (t * 1.6 + i / 5) % 1;
        const a = i * Z.U.TAU / 5 + t * 2.4;
        const r0 = 56 * (1 - u) + 8;
        g.globalAlpha = 0.75 * Math.sin(u * Math.PI);
        g.fillStyle = rage ? '#ffb59e' : '#ffe9b0';
        g.beginPath(); g.arc(this.x + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6, 2.4, 0, Z.U.TAU); g.fill();
      }
      g.globalAlpha = 0.2 + 0.1 * Math.sin(t * 9);
      Z.Spr.ell(g, this.x, cy, 30, 20, rage ? '#ff9a80' : aura);
      g.restore();
    }
    // v83 龟丞相玄甲壳：半透明玉色龟甲罩
    if (this.shellT > 0) {
      g.save();
      g.globalAlpha = 0.30 + 0.10 * Math.sin(t * 8);
      g.beginPath(); g.ellipse(this.x, this.y - 2, this.w * 0.86, this.h * 0.68, 0, Math.PI, 0);
      g.fillStyle = 'rgba(143,208,168,0.45)'; g.fill();
      g.strokeStyle = 'rgba(206,240,218,0.85)'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(this.x, this.y - 2, this.w * 0.58, this.h * 0.46, 0, Math.PI, 0);
      g.strokeStyle = 'rgba(120,180,140,0.6)'; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    Z.Spr.drawBoss(g, this);
  }
}

/* ================= 宠物 ================= */
class Pet extends Entity {
  constructor(ptype, lv) {
    super(0, 0);
    this.ptype = ptype;
    this.def = Z.BAL.pets[ptype];
    this.lv = lv;
    this.w = 24; this.h = 24;
    this.fly = ptype === 'he' || ptype === 'long';
    this.cd = 1;
    this.team = 'player';
    this.visualAction = ''; this.visualActionT = 0; this.visualActionDur = 0;
    this.visualVx = 0; this._visualX = null;
  }
  get dmg() {
    // 每只宠物按自己的等级成长
    return Math.round(this.def.dmg * (1 + Z.BAL.petDmgPerLv * ((this.lv || 1) - 1)));
  }
  update(dt) {
    super.update(dt);
    // 只读动作记录；速度采样上一帧真实位移，不参与跟随与助战判定。
    this.visualVx = dt > 0 && this._visualX != null ? (this.x - this._visualX) / dt : 0;
    this._visualX = this.x;
    if (this.visualAction) {
      this.visualActionT += dt;
      if (this.visualActionT >= this.visualActionDur) this.visualAction = '';
    }
    const lvl = this.level, p = lvl.player;
    if (!p || p.dead) { this.follow(dt, p ? p.x - 60 : lvl.def.w / 2); return; }
    this.cd -= dt;
    const gy = lvl.gy;

    if (this.ptype === 'tu') {
      // 玉兔：跟随 + 周期治疗；Lv5 灵丹加量，Lv10 月华回蓝
      this.follow(dt, p.x - p.facing * 40);
      if (this.cd <= 0 && p.hp < p.maxHp * 0.95) {
        this.cd = this.def.cd;
        const pct = this.lv >= 5 ? 0.13 : this.def.heal;
        const heal = Math.round(p.maxHp * pct);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        if (this.lv >= 10) {
          const mp = Math.round(p.maxMp * 0.05);
          p.mp = Math.min(p.maxMp, p.mp + mp);
          Z.FX.text(p.x, p.y - p.h - 40, '+' + mp + ' 蓝', { color: '#8fd0ff', size: 12 });
        }
        this.showAction('heal', 0.50);
        Z.FX.text(p.x, p.y - p.h - 24, '+' + heal, { color: '#7dffa8', size: 14 });
        for (let i = 0; i < 5; i++) Z.FX.add('heal', p.x + Z.U.rand(-14, 14), p.y - Z.U.rand(10, 50), { life: 0.7 });
        Z.Audio.sfx('potion');
      }
      return;
    }

    // 找最近敌人
    let tgt = null, best = 1e9;
    const cands = lvl.enemies.concat(lvl.boss && !lvl.boss.dead ? [lvl.boss] : []);
    for (const e of cands) {
      const d = Z.U.dist(this.x, this.y, e.x, e.y - 20);
      if (d < best) { best = d; tgt = e; }
    }

    if (this.ptype === 'hou') {
      if (tgt && best < 250) {
        this.facing = Z.U.sign(tgt.x - this.x) || 1;
        const tx = tgt.x - this.facing * 30;
        this.x += Z.U.clamp(tx - this.x, -220 * dt, 220 * dt);
        this.y = Z.U.approach(this.y, gy, 400 * dt);
        if (best < 56 && this.cd <= 0) {
          this.cd = this.def.cd;
          Z.Combat.applyHit(this, tgt, this.dmg, { kb: this.facing * 120, flat: true });
          this.showAction('melee', 0.24);
          Z.FX.add('slash', tgt.x, tgt.y - tgt.h * 0.6, { r: 16, rot: 0.5, flip: this.facing, life: 0.18 });
          // Lv5 连环扑：追加 60% 撕扯
          if (this.lv >= 5 && !tgt.dead) {
            Z.Combat.applyHit(this, tgt, Math.round(this.dmg * 0.6), { kb: this.facing * 60, flat: true });
            Z.FX.add('slash', tgt.x, tgt.y - tgt.h * 0.4, { r: 12, rot: -0.4, flip: -this.facing, life: 0.15 });
          }
          // Lv10 旋风扑：周围 70 范围 70% 溅射
          if (this.lv >= 10) {
            for (const e of cands) {
              if (e === tgt || e.dead) continue;
              if (Z.U.dist(tgt.x, tgt.y, e.x, e.y) < 70) Z.Combat.applyHit(this, e, Math.round(this.dmg * 0.7), { kb: Z.U.sign(e.x - tgt.x) * 80, flat: true });
            }
          }
        }
      } else this.follow(dt, p.x - p.facing * 42);
    } else if (this.ptype === 'he' || this.ptype === 'long') {
      const hx = p.x - p.facing * 36, hy = p.y - 74 + Math.sin(this.animClock * 3) * 5;
      this.x = Z.U.approach(this.x, hx, 260 * dt);
      this.y = Z.U.approach(this.y, hy, 200 * dt);
      this.facing = p.facing;
      if (tgt && best < 360 && this.cd <= 0) {
        this.cd = this.def.cd;
        const kind = this.ptype === 'long' ? 'water' : 'feather';
        const a = Math.atan2((tgt.y - tgt.h * 0.6) - this.y, tgt.x - this.x);
        // Lv10：仙鹤双羽满威力；小龙主弹 150% 并变大
        const heavy = this.lv >= 10;
        const mainDmg = this.ptype === 'long' && heavy ? Math.round(this.dmg * 1.5) : this.dmg;
        const mainR = this.ptype === 'long' && heavy ? 11 : 8;
        const spd = this.ptype === 'he' && heavy ? 520 : 430;
        lvl.spawnProj(new Projectile(this.x, this.y, {
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: mainDmg, team: 'player', kind, src: this, r: mainR, life: 1.6,
        }));
        // Lv5 起追加 60% 第二发；仙鹤 Lv10 第二发也满威力
        if (this.lv >= 5) {
          const secondFull = this.ptype === 'he' && heavy;
          const a2 = a + 0.09;
          lvl.spawnProj(new Projectile(this.x, this.y, {
            vx: Math.cos(a2) * spd, vy: Math.sin(a2) * spd, dmg: secondFull ? this.dmg : Math.round(this.dmg * 0.6), team: 'player', kind, src: this, r: 8, life: 1.6,
          }));
        }
        this.showAction('shoot', 0.28);
        Z.Audio.sfx('shoot');
      }
    }
  }
  showAction(kind, dur) {
    this.visualAction = kind; this.visualActionT = 0; this.visualActionDur = dur;
  }
  follow(dt, tx) {
    this.x = Z.U.approach(this.x, tx, 300 * dt);
    const gy = this.level.gy;
    this.y = this.fly ? Z.U.approach(this.y, gy - 70 + Math.sin(this.animClock * 3) * 5, 200 * dt)
      : Z.U.approach(this.y, gy, 500 * dt);
    this.facing = this.level.player ? this.level.player.facing : this.facing;
  }
  draw(g) { Z.Spr.drawPetUnit(g, this, this.animClock); }
}

function updateCorpse(c, dt, lv) {
  c.t += dt;
  if (c.t >= c.life) return false;
  if (!c.landed) {
    c.vy += 1500 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.y >= lv.gy) {
      c.y = lv.gy; c.vy *= -0.42; c.vx *= 0.6; c.spin *= 0.55;
      if (Math.abs(c.vy) < 60) { c.landed = true; c.spin = 0; }
    }
  }
  return true;
}

Z.Pet = Pet;
Z.Enemy = Enemy;
Z.Boss = Boss;
Z.Projectile = Projectile;
Z.Pickup = Pickup;
Z.Chest = Chest;
