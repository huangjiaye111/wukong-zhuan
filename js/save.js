/* ============================================================
 * save.js —— localStorage 存档
 * ============================================================ */
'use strict';

Z.Save = (() => {
  const KEY = 'zmxy_wukong_save_v1';

  function defaultSave() {
    return {
      lv: 1, exp: 0, sp: 0,          // 等级/经验/技能点
      gold: 0, stones: 2,            // 金币/强化石
      materials: { iron: 0, wood: 0, cloudSilk: 0, peachDew: 0, seaPearl: 0 }, // 材料独立堆叠；强化石仍只存 stones
      discoveries: {},               // 已领取的可选秘密点
      relics: { owned: [], active: null }, // 法宝独立于四个装备槽，每种最多一件
      pots: { hp: 2, mp: 2 },        // 药水
      skills: { hy: 1, jd: 1, qs: 1 }, // 技能等级
      equip: { weapon: null, head: null, armor: null, acc: null },
      bag: [],                        // 背包物品
      pets: { owned: [], active: null, growth: {} }, // 宠物：各自独立等级/经验
      cleared: [false, false, false, false, false, false, false, false, false, false, false],
      towerBest: 0,
      ach: {},
      stats: { kills: 0, maxCombo: 0 },
      uid: 1,
      playTime: 0,
    };
  }

  function newAdventure() {
    const s = defaultSave();
    // 固定基础棍，不抽词条；仅新档发放，旧档缺槽位不补发。
    s.equip.weapon = { uid: 1, base: 'weapon', t: 0, q: 0, lv: 0, ax: [] };
    s.uid = 2;
    return s;
  }

  function normalize(obj) {
    const record = v => !!v && typeof v === 'object' && !Array.isArray(v);
    const number = (v, min = 0, integer = true) => typeof v === 'number' && Number.isFinite(v) && v >= min && (!integer || Number.isSafeInteger(v));
    const fail = () => { throw new Error('存档内容不完整或已损坏，当前进度未改变'); };
    if (!record(obj)) fail();
    for (const key of ['lv', 'exp', 'sp', 'gold', 'stones', 'towerBest', 'uid', 'playTime']) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && !number(obj[key], key === 'lv' || key === 'uid' ? 1 : 0, key !== 'playTime')) fail();
    }
    for (const key of ['pots', 'skills', 'equip', 'pets', 'ach', 'stats', 'materials', 'discoveries', 'relics']) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && !record(obj[key])) fail();
    }
    for (const key of ['bag', 'cleared']) {
      if (obj[key] != null && !Array.isArray(obj[key])) fail();
    }
    const out = Object.assign(defaultSave(), obj);
    for (const key of ['pots', 'skills', 'equip', 'stats', 'materials']) out[key] = Object.assign(defaultSave()[key], obj[key]);
    if (Object.keys(out.materials).some(key => !['iron', 'wood', 'cloudSilk', 'peachDew', 'seaPearl'].includes(key))) fail();
    for (const v of Object.values(out.materials)) if (!number(v)) fail();
    if (Object.entries(out.discoveries).some(([id, found]) =>
      !Object.prototype.hasOwnProperty.call(Z.BAL.secrets, id) || typeof found !== 'boolean')) fail();
    for (const v of Object.values(out.pots)) if (!number(v)) fail();
    for (const v of Object.values(out.skills)) if (!number(v, 1) || v > 10) fail();
    for (const v of Object.values(out.stats)) if (!number(v)) fail();
    if (out.cleared.some(v => typeof v !== 'boolean')) fail();
    if (Object.values(out.ach).some(v => typeof v !== 'boolean')) fail();
    const slots = ['weapon', 'head', 'armor', 'acc'], ids = new Set();
    if (Object.keys(out.equip).some(slot => !slots.includes(slot))) fail();
    function item(it, slot) {
      if (!record(it) || !slots.includes(it.base) || slot && it.base !== slot ||
          !number(it.uid, 1) || ids.has(it.uid) || !number(it.q) || it.q > 4 ||
          !number(it.t) || !number(it.lv) || it.lv > 15) fail();
      ids.add(it.uid);
      if (it.ax != null && (!Array.isArray(it.ax) || it.ax.some(ax => !record(ax) ||
          !['atk', 'hp', 'crit', 'cdr', 'ls', 'gold', 'spd'].includes(ax.id) || !number(ax.m, 0, false)))) fail();
      if (it.locked != null && typeof it.locked !== 'boolean') fail();
      if (it.rules !== undefined && it.rules !== 1 && it.rules !== 2 && it.rules !== 3) fail();
      if (it.rules === 2) {
        const gear = Z.BAL.gearDefs[it.gearId];
        if (!gear || gear.base !== it.base || gear.q !== it.q ||
            !number(it.roll, .96, false) || it.roll > 1.04 ||
            !Array.isArray(it.ax) || it.ax.length > 1 ||
            it.ax.some(ax => !gear.affixes.includes(ax.id) || ax.m < .25 || ax.m > .4)) fail();
      }
      if (it.rules === 3 && (it.t > 9 || Object.prototype.hasOwnProperty.call(it, 'gearId') ||
          !Array.isArray(it.ax) || it.ax.length !== Z.BAL.affixCount[it.q] ||
          new Set(it.ax.map(ax => ax.id)).size !== it.ax.length ||
          it.ax.some(ax => ax.m < .85 || ax.m > 1.2))) fail();
      return it;
    }
    out.bag.forEach(it => item(it));
    for (const slot of slots) if (out.equip[slot] != null) item(out.equip[slot], slot);
    out.relics = Object.assign({ owned: [], active: null }, obj.relics);
    if (!Array.isArray(out.relics.owned) || out.relics.owned.length > 3) fail();
    const relicIds = new Set();
    for (const relic of out.relics.owned) {
      if (!record(relic) || typeof relic.id !== 'string' || !Object.prototype.hasOwnProperty.call(Z.BAL.relicDefs, relic.id) ||
          relicIds.has(relic.id) || !number(relic.uid, 1) || relic.uid >= Number.MAX_SAFE_INTEGER || ids.has(relic.uid) ||
          !number(relic.lv, 1) || relic.lv > Z.BAL.relicMaxLv || !number(relic.growth, .96, false) || relic.growth > 1.04 ||
          !Z.BAL.relicElements.includes(relic.element)) fail();
      relicIds.add(relic.id); ids.add(relic.uid);
    }
    if (out.relics.active != null && !out.relics.owned.some(relic => relic.uid === out.relics.active)) fail();
    const pets = ['hou', 'he', 'tu', 'long'];
    out.pets = Object.assign({ owned: [], active: null }, obj.pets);
    if (!Array.isArray(out.pets.owned) || out.pets.owned.some(pid => !pets.includes(pid)) ||
        new Set(out.pets.owned).size !== out.pets.owned.length ||
        out.pets.active != null && !out.pets.owned.includes(out.pets.active)) fail();
    if (out.pets.growth != null) {
      if (!record(out.pets.growth)) fail();
      for (const [pid, value] of Object.entries(out.pets.growth)) {
        if (!pets.includes(pid) || !record(value) || !number(value.lv, 1) || !number(value.exp)) fail();
      }
    } else {
      if (out.pets.lv != null && !number(out.pets.lv, 1) || out.pets.exp != null && !number(out.pets.exp)) fail();
      out.pets.growth = {};
      for (const pid of out.pets.owned) out.pets.growth[pid] = { lv: out.pets.lv || 1, exp: out.pets.exp || 0 };
    }
    delete out.pets.lv; delete out.pets.exp;
    out.uid = Math.max(out.uid, ...Array.from(ids, id => id + 1));
    return out;
  }

  let d = defaultSave();
  let status = { state: 'ready', message: '尚未保存' };
  let protectedRaw = null, writesBlocked = false;

  function report(state, message, notify = false) {
    const changed = status.state !== state;
    status = { state, message };
    if (notify && changed && Z.UI) Z.UI.toast(message, '#ffb28b');
  }

  function load() {
    d = defaultSave();
    writesBlocked = false; protectedRaw = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        protectedRaw = raw;
        d = normalize(JSON.parse(raw));
        protectedRaw = null;
        report('loaded', '存档已读取，缺失字段已补齐');
      } else {
        d = newAdventure();
        report('empty', '暂无存档');
      }
    } catch (e) {
      d = defaultSave(); writesBlocked = true;
      report('read_error', protectedRaw ? '存档无法读取，已保护原记录；开始新冒险可重置' : '存档读取失败，暂不覆盖原记录', true);
    }
    return d;
  }

  function save() {
    if (writesBlocked) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
      report('saved', '进度已保存'); return true;
    } catch (e) {
      report('write_error', '保存失败，本次进度尚未写入；请勿关闭页面', true); return false;
    }
  }

  function reset() {
    d = newAdventure();
    writesBlocked = false; protectedRaw = null;
    save();
  }

  function newUid() { return d.uid++; }

  function claimDiscovery(id) {
    if (writesBlocked) return { ok: false, reason: '原存档受保护，暂不能领取' };
    if (!Object.prototype.hasOwnProperty.call(Z.BAL.secrets, id)) return { ok: false, reason: '未找到这处秘密点' };
    if (d.discoveries[id]) return { ok: false, already: true, reason: '这处珍藏已经领取' };
    const reward = Z.BAL.secrets[id].reward;
    const next = { ...d, discoveries: { ...d.discoveries, [id]: true }, gold: d.gold + reward.gold,
      stones: d.stones + reward.stones, materials: { ...d.materials, iron: d.materials.iron + (reward.materials.iron || 0),
        wood: d.materials.wood + (reward.materials.wood || 0) } };
    if (![next.gold, next.stones, ...Object.values(next.materials)].every(Number.isSafeInteger)) {
      return { ok: false, reason: '资源数量已达上限，暂不能领取' };
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      d = next; report('saved', '珍藏奖励已保存');
      return { ok: true, reward: { ...reward, materials: { ...reward.materials } } };
    } catch (e) {
      report('write_error', '保存失败，珍藏仍可再次领取', true);
      return { ok: false, reason: '保存失败，珍藏仍可再次领取' };
    }
  }

  function dismantle(uid) {
    if (writesBlocked) return { ok: false, reason: '原存档受保护，暂不能分解' };
    if (Object.values(d.equip).some(it => it && it.uid === uid)) return { ok: false, reason: '请先卸下装备' };
    const matches = d.bag.filter(it => it.uid === uid);
    if (matches.length !== 1) return { ok: false, reason: '装备已不存在' };
    const item = matches[0];
    if (item.locked) return { ok: false, reason: '请先解除装备锁定' };
    const result = Z.BAL.dismantleYield(item);
    const next = { ...d, bag: d.bag.filter(it => it.uid !== uid), gold: d.gold + result.gold,
      stones: d.stones + result.stones,
      materials: { ...d.materials, iron: d.materials.iron + result.materials.iron, wood: d.materials.wood + result.materials.wood } };
    if (![next.gold, next.stones, ...Object.values(next.materials)].every(Number.isSafeInteger)) {
      return { ok: false, reason: '资源数量已达上限，无法分解' };
    }
    try {
      // 物品移除与返还同一次落盘；失败时内存和旧存档都保持原样。
      localStorage.setItem(KEY, JSON.stringify(next));
      d = next; report('saved', '装备已分解，材料与返还已保存');
      return { ok: true, yield: result };
    } catch (e) {
      report('write_error', '保存失败，装备与资源未改变', true);
      return { ok: false, reason: '保存失败，装备与资源未改变' };
    }
  }

  function canManageRelics() {
    const G = Z.G;
    return !!(G && !G.dead && !G.clearInfo && !(Z.Trans && Z.Trans.busy) &&
      (G.scene === 'map' || G.scene === 'game' && !(G.player && G.player.dead) &&
        G.level && typeof G.level.isSafeRest === 'function' && G.level.isSafeRest()));
  }

  function relicChangeError() {
    if (writesBlocked) return { ok: false, reason: '原存档受保护，暂不能操作法宝' };
    if (!canManageRelics()) return { ok: false, reason: '请在地图或安全休整处操作法宝' };
    return null;
  }

  function commitRelicChange(next, relic) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      d = next; report('saved', '法宝与资源已保存');
      return { ok: true, relic: relic ? { ...relic } : null };
    } catch (e) {
      report('write_error', '保存失败，法宝与资源未改变', true);
      return { ok: false, reason: '保存失败，法宝与资源未改变' };
    }
  }

  function craftRelic(id) {
    const error = relicChangeError(); if (error) return error;
    if (!Object.prototype.hasOwnProperty.call(Z.BAL.relicDefs, id)) return { ok: false, reason: '没有这件法宝的配方' };
    if (d.relics.owned.some(relic => relic.id === id)) return { ok: false, reason: '已持有此法宝，无需重复合成' };
    if (d.relics.owned.length >= 3) return { ok: false, reason: '已达到法宝持有上限' };
    const recipe = Z.BAL.relicDefs[id].recipe;
    if (d.gold < recipe.gold) return { ok: false, reason: '金币不足' };
    if (Object.entries(recipe.materials).some(([key, count]) => !(d.materials[key] >= count))) return { ok: false, reason: '专用材料不足' };
    if (!Number.isSafeInteger(d.uid) || d.uid >= Number.MAX_SAFE_INTEGER) return { ok: false, reason: '物品编号已达上限' };
    const relic = { uid: d.uid, id, lv: 1, growth: +(.96 + Math.random() * .08).toFixed(3),
      element: Z.BAL.relicElements[Math.floor(Math.random() * Z.BAL.relicElements.length)] };
    const materials = { ...d.materials };
    for (const [key, count] of Object.entries(recipe.materials)) materials[key] -= count;
    const next = { ...d, gold: d.gold - recipe.gold, materials, uid: d.uid + 1,
      relics: { ...d.relics, owned: [...d.relics.owned, relic] } };
    return commitRelicChange(next, relic);
  }

  function upgradeRelic(uid) {
    const error = relicChangeError(); if (error) return error;
    const relic = d.relics.owned.find(value => value.uid === uid);
    if (!relic) return { ok: false, reason: '未持有这件法宝' };
    const cost = Z.BAL.relicUpgradeCost(relic.lv, relic.id);
    if (!cost) return { ok: false, reason: '法宝已达最高等级' };
    if (d.gold < cost.gold) return { ok: false, reason: '金币不足' };
    if (d.stones < cost.stones) return { ok: false, reason: '强化石不足' };
    if ((d.materials[cost.material.id] || 0) < cost.material.count)
      return { ok: false, reason: Z.BAL.materialNames[cost.material.id] + '不足，可分解多余装备获得' };
    const upgraded = { ...relic, lv: relic.lv + 1 };
    const next = { ...d, gold: d.gold - cost.gold, stones: d.stones - cost.stones,
      materials: { ...d.materials, [cost.material.id]: d.materials[cost.material.id] - cost.material.count },
      relics: { ...d.relics, owned: d.relics.owned.map(value => value.uid === uid ? upgraded : value) } };
    return commitRelicChange(next, upgraded);
  }

  function equipRelic(uid) {
    const error = relicChangeError(); if (error) return error;
    const relic = uid === null ? null : d.relics.owned.find(value => value.uid === uid);
    if (uid !== null && !relic) return { ok: false, reason: '未持有这件法宝' };
    if (d.relics.active === uid) return { ok: true, unchanged: true, relic: relic ? { ...relic } : null };
    return commitRelicChange({ ...d, relics: { ...d.relics, active: uid } }, relic);
  }

  // 稳妥配装只补空槽，或每项属性均不下降且至少一项提高；不同单位不相加。
  function adviceStats(it) {
    try {
      const st = Z.BAL.itemStat(it);
      return st && Object.values(st).every(Number.isFinite) ? st : null;
    } catch (e) { return null; }
  }
  function adviceDominates(item, current) {
    const next = adviceStats(item);
    if (!next) return false;
    if (!current) return true;
    const before = adviceStats(current);
    if (!before) return false;
    const keys = [...new Set([...Object.keys(next), ...Object.keys(before)])];
    return keys.every(key => (next[key] || 0) >= (before[key] || 0)) &&
      keys.some(key => (next[key] || 0) > (before[key] || 0));
  }
  function adviceSlotOf(it) {
    const base = Z.BAL.itemBases[it && it.base];
    return base ? base.slot : null;
  }
  function adviceBestPerSlot() {
    const best = { weapon: null, head: null, armor: null, acc: null };
    // 互有取舍或完全相等的候选保留较早UID，推荐不受背包排列影响。
    for (const it of [...d.bag].sort((a, b) => a.uid - b.uid)) {
      const slot = adviceSlotOf(it);
      if (!slot) continue;
      if (!adviceDominates(it, d.equip[slot])) continue;
      if (!best[slot] || adviceDominates(it, best[slot])) best[slot] = it;
    }
    return best;
  }
  function equipAdvice() {
    const best = adviceBestPerSlot(), slots = [];
    for (const slot of Object.keys(best)) {
      if (best[slot]) slots.push(slot);
    }
    return { count: slots.length, slots };
  }
  function autoEquipBest() {
    if (writesBlocked) return { ok: false, swaps: [], reason: '原存档受保护，暂不能推荐配装' };
    const best = adviceBestPerSlot(), swaps = [];
    const next = { ...d, equip: { ...d.equip }, bag: [...d.bag] };
    for (const slot of Object.keys(best)) {
      const cur = next.equip[slot], item = best[slot];
      if (!item) continue;
      const index = next.bag.findIndex(it => it.uid === item.uid);
      if (index < 0) continue;
      next.bag.splice(index, 1);
      if (cur) next.bag.push(cur);
      next.equip[slot] = item;
      swaps.push({ slot, name: Z.BAL.itemName(item) });
    }
    if (!swaps.length) return { ok: true, swaps };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      d = next; report('saved', '稳妥配装已保存');
      return { ok: true, swaps };
    } catch (e) {
      report('write_error', '保存失败，装备未改变', true);
      return { ok: false, swaps: [], reason: '保存失败，装备未改变' };
    }
  }

  function exportText() {
    if (protectedRaw) return protectedRaw;
    return JSON.stringify({ game: 'zmxy-wukong', version: 1, savedAt: new Date().toISOString(), data: d }, null, 2);
  }

  function parseImport(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('无法读取 JSON 存档，当前进度未改变'); }
    if (obj && obj.game != null) {
      if (obj.game !== 'zmxy-wukong' || obj.version !== 1) throw new Error('请选择悟空传的存档备份');
      obj = obj.data;
    }
    if (!obj || !Object.prototype.hasOwnProperty.call(obj, 'lv')) throw new Error('请选择悟空传的存档备份');
    return normalize(obj);
  }

  function importData(data) {
    try {
      const next = normalize(JSON.parse(JSON.stringify(data)));
      // 写入成功后才替换内存，浏览器拒绝保存时不丢当前游戏。
      localStorage.setItem(KEY, JSON.stringify(next));
      d = next; protectedRaw = null; writesBlocked = false;
      report('saved', '存档已恢复'); return true;
    } catch (e) {
      if (Z.UI) Z.UI.toast('恢复未完成：' + e.message, '#ffb28b');
      return false;
    }
  }

  // 旧档迁移：共享 pets.lv/exp → 每只宠物独立 growth；不丢既有等级。
  function migratePets() {
    const P = d.pets;
    if (!P) { d.pets = { owned: [], active: null, growth: {} }; return; }
    if (!P.growth) {
      P.growth = {};
      const lv = P.lv || 1, exp = P.exp || 0;
      for (const pid of P.owned) P.growth[pid] = { lv, exp };
    }
    delete P.lv; delete P.exp;
  }

  // 读取（并兜底创建）某只宠物的成长记录。
  function petGrow(pid) {
    migratePets();
    if (!d.pets.growth[pid]) d.pets.growth[pid] = { lv: 1, exp: 0 };
    return d.pets.growth[pid];
  }

  return { get d() { return d; }, get status() { return { ...status, writesBlocked }; },
    get protectedRaw() { return protectedRaw; }, load, save, reset, newUid, defaultSave, petGrow, migratePets,
    exportText, parseImport, importData, dismantle, claimDiscovery, equipAdvice, autoEquipBest,
    canManageRelics, craftRelic, upgradeRelic, equipRelic };
})();
