/* ============================================================
 * balance.js —— 数值与内容数据
 * 技能 / 敌人 / Boss / 装备 / 宠物 / 关卡 / 商店
 * ============================================================ */
'use strict';

Z.BAL = {
  /* ---------------- 玩家基础成长 ---------------- */
  player: {
    baseHp: 100, hpPerLv: 22,
    baseMp: 60, mpPerLv: 8,
    baseAtk: 12, atkPerLv: 3,
    baseDef: 2, defPerLv: 2,
    baseCrit: 5,           // %
    critMult: 1.6,
    wuGainHit: 6,          // 每次命中获得无双
    wuGainHurt: 12,        // 每次受伤获得无双
  },
  expNeed: (lv) => Math.round(50 * Math.pow(lv, 1.45)),

  /* ---------------- 悟空技能 ---------------- */
  skills: {
    hy: {
      name: '重斩', key: 'U', mp: 12, cd: 2.4, dmg: 2.4, dur: .65, hitTime: .28,
      desc: '双手重斩；七十二斩末击命中后预约可接棒，残影同步落棍',
    },
    jd: {
      name: '烈焰闪', key: 'I', mp: 10, cd: 4, dmg: .65, dur: .34, invulnEnd: .26,
      desc: '按住A/D选择闪行方向，短暂无敌，可切入或撤离',
    },
    qs: {
      name: '七十二斩', key: 'O', mp: 18, cd: 5, dmg: 1.05, dur: .42, hitStart: .10, hitEnd: .32,
      desc: '三棍短连打，前两击留影；第一棍命中后按U预约重斩',
    },
  },
  wushuang: { name: '大闹天宫', key: 'L', hits: 5, dmg: 2.2, finalDmg: 3.0 },
  skillGrowth: { dmgPerLv: 0.12, cdCut: 0.04, maxLv: 10 }, // 每级+12%伤害 -4%冷却
  // 技能存档继续使用hy/jd/qs，既有等级和技能点按原槽继承。
  skillCombo: {
    slashBeats: [{ time: .10, weight: 2/7 }, { time: .20, weight: 2/7 }, { time: .30, weight: 3/7 }],
    linkedHeavy: { hitTime: .09, dur: .46 },
    shadowLife: 3, shadowLimit: 2, shadowMultiplier: .55,
  },

  /* ---------------- 装备 ---------------- */
  qualities: [
    { n: '普通', c: '#c2cdd6', m: 1.00 },
    { n: '精良', c: '#6fe26f', m: 1.16 },
    { n: '稀有', c: '#54a9ff', m: 1.34 },
    { n: '史诗', c: '#c07dff', m: 1.55 },
    { n: '传说', c: '#ffb02e', m: 1.8 },
  ],
  itemBases: {
    weapon: { slot: 'weapon', name: '金箍棒', stats: { atk: 7 } },
    head:   { slot: 'head',   name: '紫金冠', stats: { def: 3, hp: 14 } },
    armor:  { slot: 'armor',  name: '锁子甲', stats: { def: 5, hp: 24 } },
    acc:    { slot: 'acc',    name: '风火轮', stats: { atk: 2, crit: 2 } },
  },
  // rules:2 才使用型号属性；无 rules 的旧装备继续使用原部位/阶次/品质公式。
  gearDefs: {
    juling_weapon: { base: 'weapon', name: '镇岳铁棒', style: 'juling', stage: 0, q: 1,
      stats: { atk: 10.5, def: 1 }, affixes: ['atk', 'hp'] },
    juling_head:   { base: 'head', name: '镇岳战冠', style: 'juling', stage: 0, q: 1,
      stats: { hp: 24, def: 4 }, affixes: ['hp', 'spd'] },
    juling_armor:  { base: 'armor', name: '镇岳玄甲', style: 'juling', stage: 0, q: 1,
      stats: { hp: 40, def: 6 }, affixes: ['hp'] },
    juling_acc:    { base: 'acc', name: '镇岳护符', style: 'juling', stage: 0, q: 1,
      stats: { hp: 18, def: 2, hpRegen: .35 }, affixes: ['hp', 'ls'] },
    zengzhang_weapon: { base: 'weapon', name: '青霄云棍', style: 'zengzhang', stage: 1, q: 2,
      stats: { atk: 13, crit: 2 }, affixes: ['atk', 'crit'] },
    zengzhang_head:   { base: 'head', name: '青霄玉冠', style: 'zengzhang', stage: 1, q: 2,
      stats: { hp: 16, def: 2, mp: 18 }, affixes: ['hp', 'cdr'] },
    zengzhang_armor:  { base: 'armor', name: '青霄战甲', style: 'zengzhang', stage: 1, q: 2,
      stats: { hp: 28, def: 4, mp: 20 }, affixes: ['hp', 'cdr'] },
    zengzhang_acc:    { base: 'acc', name: '青霄佩环', style: 'zengzhang', stage: 1, q: 2,
      stats: { mp: 26, crit: 2, mpRegen: .5 }, affixes: ['crit', 'cdr'] },
  },
  bossGearPools: {
    0: ['juling_weapon', 'juling_head', 'juling_armor', 'juling_acc'],
    1: ['zengzhang_weapon', 'zengzhang_head', 'zengzhang_armor', 'zengzhang_acc'],
  },
  slotNames: { weapon: '武器', head: '头盔', armor: '铠甲', acc: '饰品' },
  statNames: { atk: '攻击', hp: '生命', mp: '法力', def: '防御', crit: '暴击%', hpRegen: '回血/秒', mpRegen: '回魔/秒' },
  materialNames: { iron: '精铁', wood: '灵木', cloudSilk: '云绫', peachDew: '桃露', seaPearl: '蜃珠' },
  relicDefs: {
    cloud_umbrella: { name: '玄云伞', type: 'shield', recipe: { gold: 80, materials: { cloudSilk: 2 } } },
    jade_leaf: { name: '青枝灵叶', type: 'heal', recipe: { gold: 100, materials: { peachDew: 2 } } },
    sea_tide_pearl: { name: '碧海潮珠', type: 'tide', recipe: { gold: 120, materials: { seaPearl: 2 } } },
  },
  relicElements: ['金', '木', '水', '火', '土'],
  relicMaxLv: 5,
  secrets: {
    peach_hollow: { stage: 1, x: 1140, name: '桃根灵藏', reward: { gold: 30, stones: 1, materials: { wood: 2 } } },
  },
  maxPlus: 15,
  plusRatio: 0.08,   // 每+1 加成 8%
  tierRatio: 0.35,   // 每阶加成 35%
  sellBase: 18,
  // 强化消耗：强化石1个 + 金币
  plusCost: (lv) => 15 + lv * 12,

  /* ---------------- 敌人 ---------------- */
  enemies: {
    tianbing: { name: '天兵',   hp: 44,  atk: 9,  spd: 95,  w: 36, h: 60, xp: 14, gold: [3, 7] },
    gongshou: { name: '弓手',   hp: 34,  atk: 8,  spd: 80,  w: 34, h: 58, xp: 14, gold: [3, 7], ranged: true },
    feiyao:   { name: '飞天妖', hp: 38,  atk: 10, spd: 130, w: 40, h: 34, xp: 16, gold: [4, 8], fly: true, hoverH: 52, diveCd: [2.8, 4.2] },
    tianjiang:{ name: '天将',   hp: 140, atk: 15, spd: 60,  w: 46, h: 72, xp: 30, gold: [8, 14], guard: true },
    xiaotian: { name: '哮天犬', hp: 60,  atk: 12, spd: 220, w: 46, h: 34, xp: 18, gold: [0, 0] },
    xiabing:  { name: '虾兵',   hp: 72,  atk: 16, spd: 125, w: 36, h: 60, xp: 38, gold: [8, 14] },
    xiejiang: { name: '蟹将',   hp: 210, atk: 20, spd: 72,  w: 54, h: 50, xp: 58, gold: [12, 20], guard: true },
    shuimu:   { name: '水母',   hp: 82,  atk: 14, spd: 62,  w: 44, h: 46, xp: 40, gold: [8, 14], fly: true, jelly: true, hoverH: 60 },
    huoyao:   { name: '火妖',   hp: 95,  atk: 18, spd: 88,  w: 36, h: 58, xp: 80, gold: [16, 24], caster: true },
    niuyao:   { name: '牛妖',   hp: 260, atk: 24, spd: 76,  w: 50, h: 68, xp: 95, gold: [20, 30], guard: true },
  },
  // 敌人随关卡成长
  stageHp: [1, 1.4, 1.8, 2.3, 2.7, 3.1, 3.5, 4.0, 3.2, 3.5, 3.9],
  stageAtk: [1, 1.25, 1.5, 1.8, 2.0, 2.2, 2.4, 2.7, 2.6, 2.8, 3.1],

  /* ---------------- Boss ---------------- */
  bosses: {
    juling: {
      name: '巨灵神', title: '天宫第一猛将', hp: 700, atk: 14, spd: 70, w: 74, h: 104,
      xp: 120, gold: [60, 90], petball: 'hou',
    },
    zengzhang: {
      name: '增长天王', title: '四大天王 · 南方宝剑', hp: 1050, atk: 17, spd: 95, w: 60, h: 96,
      xp: 180, gold: [90, 130], petball: 'he',
    },
    chiguo: {
      name: '持国天王', title: '四大天王 · 东方琵琶', hp: 1400, atk: 19, spd: 80, w: 62, h: 98,
      xp: 260, gold: [130, 180], petball: 'tu',
    },
    erlang: {
      name: '二郎显圣真君', title: '灌江口 · 三尖两刃', hp: 2000, atk: 22, spd: 110, w: 60, h: 100,
      xp: 400, gold: [200, 280], petball: null,
    },
    yecha: {
      name: '巡海夜叉', title: '东海 · 前锋大将', hp: 1500, atk: 24, spd: 125, w: 60, h: 96,
      xp: 520, gold: [260, 340], petball: null,
    },
    guiguo: {
      name: '龟丞相', title: '东海 · 老谋深算', hp: 1900, atk: 26, spd: 55, w: 72, h: 88,
      xp: 640, gold: [300, 380], petball: null,
    },
    aoguang: {
      name: '东海龙王敖广', title: '四海龙王之首', hp: 2600, atk: 30, spd: 100, w: 66, h: 104,
      xp: 900, gold: [400, 520], petball: 'long',
    },
    honghaier: {
      name: '红孩儿', title: '号山 · 圣婴大王', hp: 2400, atk: 34, spd: 135, w: 52, h: 82,
      xp: 1100, gold: [500, 650], petball: null,
    },
    tieshan: {
      name: '铁扇公主', title: '翠云山 · 罗刹女', hp: 2800, atk: 36, spd: 118, w: 58, h: 96,
      xp: 1300, gold: [560, 700], petball: null,
    },
    niuwang: {
      name: '牛魔王', title: '平天大圣 · 摩云洞主', hp: 3600, atk: 45, spd: 106, w: 74, h: 112,
      xp: 1800, gold: [650, 800], petball: null,
    },
  },

  /* ---------------- 宠物 ---------------- */
  pets: {
    hou: { name: '灵猴', type: 'melee', dmg: 9, cd: 1.2, desc: '扑击撕咬近身之敌',
      skills: [
        { lv: 1, n: '扑击撕咬', d: '近身扑咬单个敌人' },
        { lv: 5, n: '连环扑', d: '扑咬后追加一次 60% 威力的撕扯' },
        { lv: 10, n: '旋风扑', d: '扑咬对周围敌人造成 70% 溅射' },
      ] },
    he: { name: '仙鹤', type: 'ranged', dmg: 8, cd: 1.6, desc: '衔羽远射，灵气化箭',
      skills: [
        { lv: 1, n: '羽箭', d: '射出一支灵羽箭' },
        { lv: 5, n: '双羽齐发', d: '追加一支 60% 威力的羽箭' },
        { lv: 10, n: '疾风双羽', d: '两支羽箭均提升至 100% 威力' },
      ] },
    tu: { name: '玉兔', type: 'heal', heal: .09, cd: 6, desc: '捣药灵兔，定期为你疗伤',
      skills: [
        { lv: 1, n: '捣药', d: '生命低于 95% 时恢复 9% 生命' },
        { lv: 5, n: '灵丹', d: '治疗量提升至 13%' },
        { lv: 10, n: '月华', d: '治疗时同时恢复 5% 法力' },
      ] },
    long: { name: '小龙', type: 'ranged', dmg: 11, cd: 1.7, desc: '龙裔雏儿，吐息水弹',
      skills: [
        { lv: 1, n: '水弹', d: '吐出一颗水灵弹' },
        { lv: 5, n: '连珠水弹', d: '追加一颗 60% 威力的水弹' },
        { lv: 10, n: '怒涛水弹', d: '主水弹提升至 150% 威力并变大' },
      ] },
  },
  petDmgPerLv: 0.15,

  /* ---------------- 关卡 ---------------- */
  levels: [
    {
      id: 0, name: '南天门', lootTier: 0, theme: 'gate', w: 3200, gy: 462,
      story: '一根金箍棒，叩开九重天', restX: 2200,
      advice: '跳过地波，等巨斧落定再接残影重斩',
      platforms: [[290, 372, 130], [470, 306, 150], [940, 372, 175], [1150, 302, 150], [1550, 370, 180], [1765, 300, 150]],
      zones: {
        entrance: [0, 700], courtyard: [700, 1900],
        waves: [
          { triggerX: 780, resumeX: 740, forwardBoundary: 1380, spawns: [960, 1050, 1140, 1260], goal: '前往驻守庭院', banner: '天兵驻守' },
          { triggerX: 1440, resumeX: 1400, forwardBoundary: 2100, spawns: [1600, 1700, 1790, 1690, 1880], goal: '穿过庭院', banner: '庭院守军' },
        ],
        boss: { bounds: [2240, 3200], triggerX: 2360, resumeX: 2320, goal: '前往南天门' },
      },
      waves: [
        [{ t: 'tianbing', n: 3 }, { t: 'gongshou', n: 1 }],
        [{ t: 'tianbing', n: 3 }, { t: 'feiyao', n: 2 }],
      ],
      boss: 'juling',
    },
    {
      id: 1, name: '蟠桃园', lootTier: 1, theme: 'peach', w: 2900, gy: 462, secret: 'peach_hollow',
      story: '桃花深处，宝剑守住仙家禁地', restX: 2280,
      advice: '看准剑势方向，剑招连段结束后再追击',
      platforms: [[380, 320, 180], [800, 250, 190], [1250, 330, 180], [1700, 260, 200], [2200, 320, 200]],
      zones: {
        entrance: [0, 420], courtyard: [420, 2240], barrierTop: 0,
        waves: [
          { triggerX: 420, resumeX: 380, forwardBoundary: 1030, enemyForwardBoundary: 990, spawns: [600, 680, 760, 870, 940], goal: '进入桃林', banner: '桃林守军' },
          { triggerX: 1090, resumeX: 1050, forwardBoundary: 1740, enemyForwardBoundary: 1700, spawns: [1260, 1340, 1420, 1520, 1610], goal: '前往桃林深处', banner: '桃林深处' },
          { triggerX: 1810, resumeX: 1770, forwardBoundary: 2240, enemyForwardBoundary: 2200, spawns: [1980, 2080, 2160], goal: '前往亭前', banner: '亭前护卫' },
        ],
        boss: { bounds: [1980, 2860], triggerX: 2320, resumeX: 2280, goal: '前往天王场地' },
      },
      waves: [
        [{ t: 'tianbing', n: 3 }, { t: 'gongshou', n: 2 }],
        [{ t: 'feiyao', n: 3 }, { t: 'tianbing', n: 2 }],
        [{ t: 'tianjiang', n: 1 }, { t: 'gongshou', n: 2 }],
      ],
      boss: 'zengzhang',
    },
    {
      id: 2, name: '凌霄殿外', lootTier: 2, theme: 'palace', w: 3000, gy: 462,
      story: '琵琶声起，云阶之上再闯一阵', restX: 2270,
      advice: '音波有间隙，跳跃换位后贴近反击',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 360, resumeX: 320, forwardBoundary: 1010, enemyForwardBoundary: 970, spawns: [550, 630, 710, 810, 910], goal: '登上朝天云阶', banner: '朝天云阶' },
          { triggerX: 1080, resumeX: 1040, forwardBoundary: 1710, enemyForwardBoundary: 1670, spawns: [1260, 1380, 1470, 1580], goal: '穿过金鼓长廊', banner: '金鼓长廊' },
          { triggerX: 1770, resumeX: 1730, forwardBoundary: 2200, enemyForwardBoundary: 2160, spawns: [1940, 1990, 2040, 2090, 2140], goal: '前往殿外玉阶', banner: '殿外玉阶' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2420, resumeX: 2380, goal: '前往琵琶台' },
      },
      platforms: [[350, 300, 200], [850, 230, 210], [1400, 310, 190], [1950, 240, 210], [2260, 320, 200]],
      waves: [
        [{ t: 'tianbing', n: 3 }, { t: 'feiyao', n: 2 }],
        [{ t: 'tianjiang', n: 1 }, { t: 'tianbing', n: 3 }],
        [{ t: 'tianjiang', n: 1 }, { t: 'gongshou', n: 2 }, { t: 'feiyao', n: 2 }],
      ],
      boss: 'chiguo',
    },
    {
      id: 3, name: '凌霄宝殿', lootTier: 3, theme: 'throne', w: 3000, gy: 462,
      story: '凌霄殿前，与显圣真君一决高下', restX: 2330,
      advice: '天眼锁线后及时换位，三尖枪收势时反击',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 280, resumeX: 240, forwardBoundary: 800, enemyForwardBoundary: 760, spawns: [470, 550, 630, 710], goal: '进入凌霄前殿', banner: '凌霄前殿' },
          { triggerX: 850, resumeX: 810, forwardBoundary: 1350, enemyForwardBoundary: 1310, spawns: [1030, 1090, 1150, 1210, 1270], goal: '穿过御风长桥', banner: '御风长桥' },
          { triggerX: 1400, resumeX: 1360, forwardBoundary: 1860, enemyForwardBoundary: 1820, spawns: [1580, 1650, 1720, 1790], goal: '突破金甲御卫', banner: '金甲御卫' },
          { triggerX: 1910, resumeX: 1870, forwardBoundary: 2260, enemyForwardBoundary: 2220, spawns: [2070, 2115, 2160, 2205], goal: '前往显圣殿门', banner: '显圣殿门' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2480, resumeX: 2440, goal: '登上凌霄战台' },
      },
      platforms: [[400, 320, 190], [900, 250, 200], [1450, 320, 200], [2000, 250, 200], [2270, 320, 190]],
      waves: [
        [{ t: 'tianjiang', n: 1 }, { t: 'tianbing', n: 3 }],
        [{ t: 'feiyao', n: 3 }, { t: 'gongshou', n: 2 }],
        [{ t: 'tianjiang', n: 2 }, { t: 'tianbing', n: 2 }],
        [{ t: 'xiaotian', n: 2 }, { t: 'tianbing', n: 2 }],
      ],
      boss: 'erlang',
    },
    {
      id: 4, name: '镇妖塔', lootTier: 3, theme: 'throne', w: 1800, gy: 462, tower: true,
      platforms: [[560, 320, 180], [1000, 260, 180]],
      waves: [], boss: null,
    },
    {
      id: 5, name: '东海海滩', lootTier: 4, theme: 'sea', w: 2900, gy: 462,
      story: '挥别天宫，踏浪东行寻龙宫', restX: 2190,
      advice: '夜叉长刺锁定方向后，闪到身侧再出棒',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 340, resumeX: 300, forwardBoundary: 940, enemyForwardBoundary: 900, spawns: [520, 630, 740, 850], goal: '沿潮声前行', banner: '听潮浅滩' },
          { triggerX: 1000, resumeX: 960, forwardBoundary: 1620, enemyForwardBoundary: 1580, spawns: [1190, 1260, 1330, 1400, 1470, 1540], goal: '穿过礁石哨口', banner: '礁石哨口' },
          { triggerX: 1680, resumeX: 1640, forwardBoundary: 2120, enemyForwardBoundary: 2080, spawns: [1850, 1920, 1990, 2060], goal: '寻找龙宫入口', banner: '龙门水关' },
        ],
        boss: { bounds: [1980, 2860], triggerX: 2340, resumeX: 2300, goal: '挑战巡海夜叉' },
      },
      platforms: [[420, 330, 180], [950, 270, 190], [1550, 330, 180], [2150, 270, 200]],
      chests: [700, 2400],
      waves: [
        [{ t: 'xiabing', n: 3 }, { t: 'shuimu', n: 1 }],
        [{ t: 'xiabing', n: 2 }, { t: 'shuimu', n: 2 }, { t: 'tianbing', n: 2 }],
        [{ t: 'xiejiang', n: 1 }, { t: 'xiabing', n: 3 }],
      ],
      boss: 'yecha',
    },
    {
      id: 6, name: '海底回廊', lootTier: 5, theme: 'sea', w: 3000, gy: 462,
      story: '珊瑚映照古道，深海暗藏玄机', restX: 2270,
      advice: '避开龟甲冲撞与散射，等施法收势再贴近',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 360, resumeX: 320, forwardBoundary: 1010, enemyForwardBoundary: 970, spawns: [550, 660, 770, 880], goal: '进入珊瑚回廊', banner: '珊瑚回廊' },
          { triggerX: 1080, resumeX: 1040, forwardBoundary: 1710, enemyForwardBoundary: 1670, spawns: [1260, 1340, 1420, 1500, 1590], goal: '穿过幽蓝水庭', banner: '幽蓝水庭' },
          { triggerX: 1770, resumeX: 1730, forwardBoundary: 2200, enemyForwardBoundary: 2160, spawns: [1940, 2010, 2080, 2150], goal: '前往玄甲石阵', banner: '玄甲石阵' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2420, resumeX: 2380, goal: '挑战龟丞相' },
      },
      platforms: [[380, 320, 190], [900, 250, 200], [1450, 320, 190], [2000, 250, 200], [2270, 320, 190]],
      chests: [500, 1750, 2800],
      waves: [
        [{ t: 'xiabing', n: 3 }, { t: 'xiejiang', n: 1 }],
        [{ t: 'shuimu', n: 3 }, { t: 'xiabing', n: 2 }],
        [{ t: 'xiejiang', n: 2 }, { t: 'shuimu', n: 2 }],
      ],
      boss: 'guiguo',
    },
    {
      id: 7, name: '水晶宫', lootTier: 6, theme: 'crystal', w: 3000, gy: 462,
      story: '万顷碧波之下，龙王静候来客', restX: 2330,
      advice: '水柱标记出现就换位，三道水柱之后有空隙',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 280, resumeX: 240, forwardBoundary: 800, enemyForwardBoundary: 760, spawns: [470, 550, 630, 710], goal: '进入流光宫门', banner: '流光宫门' },
          { triggerX: 850, resumeX: 810, forwardBoundary: 1350, enemyForwardBoundary: 1310, spawns: [1040, 1120, 1200, 1280], goal: '穿过明珠水庭', banner: '明珠水庭' },
          { triggerX: 1400, resumeX: 1360, forwardBoundary: 1860, enemyForwardBoundary: 1820, spawns: [1580, 1625, 1670, 1715, 1760, 1805], goal: '突破龙鳞护卫', banner: '龙鳞护卫' },
          { triggerX: 1910, resumeX: 1870, forwardBoundary: 2260, enemyForwardBoundary: 2220, spawns: [2070, 2105, 2140, 2175, 2210], goal: '前往龙王御阶', banner: '龙王御阶' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2480, resumeX: 2440, goal: '面见东海龙王' },
      },
      platforms: [[400, 320, 190], [950, 250, 200], [1500, 320, 200], [2050, 250, 200], [2200, 320, 190]],
      chests: [650, 1500, 2350],
      waves: [
        [{ t: 'xiejiang', n: 1 }, { t: 'xiabing', n: 3 }],
        [{ t: 'shuimu', n: 3 }, { t: 'xiejiang', n: 1 }],
        [{ t: 'xiabing', n: 4 }, { t: 'shuimu', n: 2 }],
        [{ t: 'xiejiang', n: 2 }, { t: 'xiabing', n: 3 }],
      ],
      boss: 'aoguang',
    },
    {
      id: 8, name: '火焰山道', lootTier: 7, theme: 'fire', w: 2900, gy: 462,
      story: '赤焰横山，迎风再走一程', restX: 2190,
      advice: '留出退路避开火线，趁红孩儿停手时接近',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 340, resumeX: 300, forwardBoundary: 940, enemyForwardBoundary: 900, spawns: [520, 630, 740, 850], goal: '穿过灼风山口', banner: '灼风山口' },
          { triggerX: 1000, resumeX: 960, forwardBoundary: 1620, enemyForwardBoundary: 1580, spawns: [1200, 1370, 1530], goal: '沿赤石栈道前行', banner: '赤石栈道' },
          { triggerX: 1680, resumeX: 1640, forwardBoundary: 2120, enemyForwardBoundary: 2080, spawns: [1850, 1900, 1950, 2000, 2050], goal: '突破火云前哨', banner: '火云前哨' },
        ],
        boss: { bounds: [1980, 2860], triggerX: 2340, resumeX: 2300, goal: '挑战红孩儿' },
      },
      platforms: [[430, 330, 180], [980, 270, 190], [1580, 330, 180], [2160, 270, 200]],
      chests: [760, 2500],
      waves: [
        [{ t: 'huoyao', n: 2 }, { t: 'tianbing', n: 2 }],
        [{ t: 'niuyao', n: 1 }, { t: 'huoyao', n: 2 }],
        [{ t: 'huoyao', n: 3 }, { t: 'feiyao', n: 2 }],
      ],
      boss: 'honghaier',
    },
    {
      id: 9, name: '芭蕉洞', lootTier: 8, theme: 'fire', w: 3000, gy: 462,
      story: '洞中清风起，一扇可熄万重火', restX: 2270,
      advice: '扇风锁向时绕行，风刃离身后再贴近',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 360, resumeX: 320, forwardBoundary: 1010, enemyForwardBoundary: 970, spawns: [550, 660, 770, 880], goal: '进入翠屏洞口', banner: '翠屏洞口' },
          { triggerX: 1080, resumeX: 1040, forwardBoundary: 1710, enemyForwardBoundary: 1670, spawns: [1280, 1430, 1580], goal: '穿过回风长廊', banner: '回风长廊' },
          { triggerX: 1770, resumeX: 1730, forwardBoundary: 2200, enemyForwardBoundary: 2160, spawns: [1940, 2010, 2080, 2150], goal: '前往芭蕉内府', banner: '芭蕉内府' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2420, resumeX: 2380, goal: '求见铁扇公主' },
      },
      platforms: [[400, 320, 190], [930, 250, 200], [1470, 320, 190], [2020, 250, 200], [2270, 320, 190]],
      chests: [600, 1700, 2750],
      waves: [
        [{ t: 'niuyao', n: 1 }, { t: 'huoyao', n: 3 }],
        [{ t: 'huoyao', n: 2 }, { t: 'tianjiang', n: 1 }],
        [{ t: 'niuyao', n: 2 }, { t: 'huoyao', n: 2 }],
      ],
      boss: 'tieshan',
    },
    {
      id: 10, name: '摩云洞', lootTier: 9, theme: 'fire', w: 3000, gy: 462,
      story: '三界路尽，与平天大圣决胜', restX: 2330,
      advice: '暴怒冲锋先闪避，等重斧连招结束再反击',
      zones: {
        barrierTop: 0,
        waves: [
          { triggerX: 280, resumeX: 240, forwardBoundary: 800, enemyForwardBoundary: 760, spawns: [470, 550, 630, 710], goal: '踏上积雷山径', banner: '积雷山径' },
          { triggerX: 850, resumeX: 810, forwardBoundary: 1350, enemyForwardBoundary: 1310, spawns: [1030, 1080, 1130, 1180, 1230, 1280], goal: '突破妖王外寨', banner: '妖王外寨' },
          { triggerX: 1400, resumeX: 1360, forwardBoundary: 1860, enemyForwardBoundary: 1820, spawns: [1580, 1635, 1690, 1745, 1800], goal: '穿过玄铁长桥', banner: '玄铁长桥' },
          { triggerX: 1910, resumeX: 1870, forwardBoundary: 2260, enemyForwardBoundary: 2220, spawns: [2065, 2095, 2125, 2155, 2185, 2215], goal: '直抵摩云洞门', banner: '摩云洞门' },
        ],
        boss: { bounds: [2080, 2960], triggerX: 2480, resumeX: 2440, goal: '决战平天大圣' },
      },
      platforms: [[420, 320, 190], [960, 250, 200], [1500, 320, 200], [2040, 250, 200], [2270, 320, 190]],
      chests: [700, 1600, 2400],
      waves: [
        [{ t: 'niuyao', n: 2 }, { t: 'huoyao', n: 2 }],
        [{ t: 'huoyao', n: 3 }, { t: 'niuyao', n: 1 }, { t: 'feiyao', n: 2 }],
        [{ t: 'niuyao', n: 2 }, { t: 'tianjiang', n: 1 }, { t: 'huoyao', n: 2 }],
        [{ t: 'niuyao', n: 3 }, { t: 'huoyao', n: 3 }],
      ],
      boss: 'niuwang',
    },
  ],

  /* ---------------- 商店 ---------------- */
  shop: [
    { id: 'potion_hp', name: '金创药', desc: '恢复35%生命', price: 30 },
    { id: 'potion_mp', name: '还神丹', desc: '恢复50%法力', price: 25 },
    { id: 'stone',     name: '强化石', desc: '强化装备必需', price: 55 },
    { id: 'bighp',     name: '大还丹', desc: '立即回满生命与法力', price: 110 },
  ],

  /* ---------------- 装备词条 ---------------- */
  affixes: [
    { id: 'atk',  n: '蛮力', stat: 'atkPct',  base: 0.06, pct: true },
    { id: 'hp',   n: '生机', stat: 'hpPct',   base: 0.08, pct: true },
    { id: 'crit', n: '锐目', stat: 'crit',    base: 3 },
    { id: 'cdr',  n: '灵动', stat: 'cdr',     base: 0.05, pct: true },
    { id: 'ls',   n: '嗜血', stat: 'ls',      base: 0.04, pct: true },
    { id: 'gold', n: '招财', stat: 'goldPct', base: 0.12, pct: true },
    { id: 'spd',  n: '疾风', stat: 'spd',     base: 12 },
  ],
  affixCount: [0, 1, 2, 3, 4], // 按品质：白0 绿1 蓝2 紫3 橙4

  /* ---------------- 成就 ---------------- */
  achievements: [
    { id: 'firstblood', n: '初显身手', d: '击杀第一只妖怪', cond: (S) => S.stats.kills >= 1 },
    { id: 'combo20',    n: '行云流水', d: '达成 20 连击',   cond: (S) => S.stats.maxCombo >= 20 },
    { id: 'boss_juling',n: '天门洞开', d: '击败巨灵神',     cond: (S) => S.cleared[0] },
    { id: 'ch2',        n: '旨下龙宫', d: '击败二郎神，前往东海', cond: (S) => S.cleared[3] },
    { id: 'lv10',       n: '小有名气', d: '等级达到 10',    cond: (S) => S.lv >= 10 },
    { id: 'rich',       n: '家财万贯', d: '持有 1000 金币', cond: (S) => S.gold >= 1000 },
    { id: 'plus9',      n: '神兵利器', d: '任意装备强化至 +9', cond: (S) => Object.keys(S.equip).some(k => S.equip[k] && S.equip[k].lv >= 9) },
    { id: 'pets3',      n: '驯养大师', d: '集齐 3 只宠物',  cond: (S) => S.pets.owned.length >= 3 },
    { id: 'tower5',     n: '登塔五层', d: '通关镇妖塔第5层', cond: (S) => (S.towerBest || 0) >= 5 },
    { id: 'sea_clear',  n: '东海称臣', d: '击败东海龙王敖广', cond: (S) => S.cleared[7] },
    { id: 'honghaier',  n: '火云洞主', d: '击败红孩儿', cond: (S) => S.cleared[8] },
    { id: 'tieshan',    n: '芭蕉宝扇', d: '击败铁扇公主', cond: (S) => S.cleared[9] },
    { id: 'niuwang',    n: '大战平天', d: '击败牛魔王', cond: (S) => S.cleared[10] },
    { id: 'relic_first',n: '法宝初成', d: '合成第一件法宝', cond: (S) => S.relics.owned.length >= 1 },
    { id: 'relic_max',  n: '法宝通灵', d: '任意法宝培养至满级', cond: (S) => S.relics.owned.some(r => r.lv >= Z.BAL.relicMaxLv) },
  ],

  /* ---------------- 掉落 ---------------- */
  drops: {
    stone: 0.07,
    potion: 0.05,
    item: 0.07,       // 普通小怪掉装备概率
    bossItems: 2,     // Boss 必掉装备件数
    bossStones: 2,
    qualityRoll: [0.50, 0.28, 0.15, 0.055, 0.015], // 白绿蓝紫橙
    bossQualityRoll: [0.30, 0.30, 0.24, 0.12, 0.04],
  },
};

/* ---- 装备数值计算 ---- */
Z.BAL.itemStat = function (item) {
  if (item.rules !== undefined && item.rules !== 1 && item.rules !== 2 && item.rules !== 3) throw new Error('未知装备规则');
  if (item.rules === 2) {
    const gear = Z.BAL.gearDefs[item.gearId];
    if (!gear || gear.base !== item.base || gear.q !== item.q ||
        !Number.isFinite(item.roll) || item.roll < .96 || item.roll > 1.04) throw new Error('装备属性记录无效');
    const out = {}, scale = item.roll * (1 + Z.BAL.plusRatio * item.lv);
    for (const k in gear.stats) {
      const v = gear.stats[k] * scale;
      out[k] = k === 'hpRegen' || k === 'mpRegen' ? +v.toFixed(2) : k === 'crit' ? +v.toFixed(1) : Math.round(v);
    }
    for (const ax of (item.ax || [])) {
      const def = Z.BAL.affixes.find(a => a.id === ax.id);
      if (!def) continue;
      const v = def.pct ? +(def.base * ax.m).toFixed(3) : Math.round(def.base * ax.m);
      out[def.stat] = (out[def.stat] || 0) + v;
    }
    return out;
  }
  const base = Z.BAL.itemBases[item.base];
  const q = Z.BAL.qualities[item.q].m;
  const out = {};
  for (const k in base.stats) {
    out[k] = Math.round(base.stats[k] * q * (1 + Z.BAL.plusRatio * item.lv) * (1 + Z.BAL.tierRatio * item.t));
  }
  for (const ax of (item.ax || [])) {
    const def = Z.BAL.affixes.find((a) => a.id === ax.id);
    if (!def) continue;
    const v = def.pct ? +(def.base * ax.m).toFixed(3) : Math.round(def.base * ax.m);
    out[def.stat] = (out[def.stat] || 0) + v;
  }
  return out;
};
Z.BAL.statLine = function (k, v) {
  const names = { atk: '攻击', hp: '生命', mp: '法力', def: '防御', crit: '暴击%', hpRegen: '回血/秒', mpRegen: '回魔/秒', atkPct: '攻击%', hpPct: '生命%', cdr: '冷却-', ls: '吸血%', goldPct: '金币%', spd: '移速+' };
  const pctKeys = ['atkPct', 'hpPct', 'cdr', 'ls', 'goldPct'];
  return (names[k] || k) + ' +' + (pctKeys.includes(k) ? Math.round(v * 100) + '%' : v);
};
Z.BAL.rollAffixes = function (q, t) {
  const n = Z.BAL.affixCount[q] || 0;
  if (n <= 0) return [];
  const pool = Z.BAL.affixes.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const def = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({ id: def.id, m: +((1 + 0.3 * t) * (0.85 + Math.random() * 0.35)).toFixed(2) });
  }
  return out;
};
Z.BAL.itemName = function (item) {
  const base = Z.BAL.itemBases[item.base];
  const q = Z.BAL.qualities[item.q];
  const gear = Z.BAL.gearDefs[item.gearId];
  const plus = item.lv > 0 ? '+' + item.lv : '';
  return `${q.n}${gear && gear.base === item.base ? gear.name : base.name}${plus}`;
};
Z.BAL.itemValue = function (item) {
  return Math.round(Z.BAL.sellBase * Z.BAL.qualities[item.q].m * (1 + item.t * .5) + item.lv * 12 + (item.ax ? item.ax.length * 14 : 0));
};
// 现有确定强化费用的累计值；旧装备按同一费用表回收，不推测旧档操作历史。
Z.BAL.enhancementSpent = function (item) {
  const lv = Math.max(0, Math.min(Z.BAL.maxPlus, Math.floor(Number(item.lv) || 0)));
  return { gold: 6 * lv * lv + 9 * lv, stones: lv };
};
Z.BAL.dismantleYield = function (item) {
  const spent = Z.BAL.enhancementSpent(item), q = Math.max(0, Math.min(4, Math.floor(Number(item.q) || 0)));
  const materials = item.base === 'acc' ? { iron: 0, wood: 2 + q }
    : { iron: (item.base === 'head' ? 1 : 2) + q, wood: item.base === 'head' ? 0 : 1 };
  return { materials, gold: Math.floor(spent.gold * .25), stones: Math.floor(spent.stones / 4) };
};
Z.BAL.rollQuality = function (boss) {
  const roll = boss ? Z.BAL.drops.bossQualityRoll : Z.BAL.drops.qualityRoll;
  let r = Math.random(), acc = 0;
  for (let i = 0; i < roll.length; i++) { acc += roll[i]; if (r <= acc) return i; }
  return 0;
};
Z.BAL.makeItem = function (base, t, q, gearId) {
  const gear = Z.BAL.gearDefs[gearId];
  if (gear && gear.base === base) {
    return { uid: Z.Save.newUid(), base, t, q: gear.q, lv: 0, rules: 2,
      roll: +(0.96 + Math.random() * .08).toFixed(3), gearId,
      ax: [{ id: gear.affixes[Math.floor(Math.random() * gear.affixes.length)], m: +(0.25 + Math.random() * .15).toFixed(3) }] };
  }
  q = q != null ? q : Z.BAL.rollQuality(false);
  const item = { uid: Z.Save.newUid(), base, t, q, lv: 0, ax: Z.BAL.rollAffixes(q, t) };
  if (Z.BAL.gearDefs[gearId] && Z.BAL.gearDefs[gearId].base === base) item.gearId = gearId;
  return item;
};

// 仅未来真实掉落使用；旧工厂/旧物品不迁移。关卡阶次独立于含镇妖塔的数组下标。
Z.BAL.makeDropItem = function (base, stageIdx, q, gearId) {
  const stage = Z.BAL.levels[stageIdx], t = stage && stage.lootTier;
  if (!Number.isInteger(stageIdx) || !Number.isInteger(t) || t < 0 || t > 9 ||
      !Object.prototype.hasOwnProperty.call(Z.BAL.itemBases, base) ||
      q != null && (!Number.isInteger(q) || q < 0 || q >= Z.BAL.qualities.length)) throw new Error('掉落参数无效');
  const gear = Z.BAL.gearDefs[gearId];
  if (gear && gear.base === base) return Z.BAL.makeItem(base, t, q, gearId);
  // t=0沿原词条池、数量和每条两次随机抽样，只冻结幅度为0.85–1.20。
  const item = Z.BAL.makeItem(base, 0, q);
  item.t = t; item.rules = 3;
  return item;
};

/* ---- 法宝：主动量与被动属性使用同一份实际数值，供战斗和界面共同读取 ---- */
Z.BAL.relicStats = function (relic) {
  const def = relic && typeof relic.id === 'string' && Object.prototype.hasOwnProperty.call(Z.BAL.relicDefs, relic.id) && Z.BAL.relicDefs[relic.id];
  if (!def || !Number.isInteger(relic.lv) || relic.lv < 1 || relic.lv > Z.BAL.relicMaxLv ||
      !Number.isFinite(relic.growth) || relic.growth < .96 || relic.growth > 1.04 ||
      !Z.BAL.relicElements.includes(relic.element)) throw new Error('法宝记录无效');
  const lv = relic.lv, shield = def.type === 'shield', tide = def.type === 'tide';
  const amount = Math.round((shield ? 55 + 18 * (lv - 1) : 30 + 10 * (lv - 1)) * relic.growth * (relic.element === '木' ? 1.1 : 1));
  const dmgMul = +(((tide ? 0.9 + 0.2 * (lv - 1) : 0) * relic.growth * (relic.element === '木' ? 1.1 : 1)).toFixed(3));
  return { type: def.type, shield: shield ? amount : 0, heal: !shield && !tide ? amount : 0, dmgMul,
    duration: shield ? 8 : tide ? 0 : 5, cost: shield ? 26 : tide ? 28 : 30, cd: shield ? 24 : tide ? 22 : 30,
    atk: relic.element === '金' ? 1 + lv : 0,
    mp: relic.element === '水' ? 10 + 5 * (lv - 1) : 0,
    hp: relic.element === '火' ? 14 + 6 * (lv - 1) : 0,
    def: relic.element === '土' ? 1 + Math.floor((lv - 1) / 2) : 0 };
};
/* 培养消耗专属材料：伞骨取精铁、灵枝取灵木，数量等于目标等级（升满共10个），
 * 与分解产出（单件约2-4）形成"打具名装备→分解→养法宝"的资源闭环。 */
Z.BAL.relicUpgradeCost = function (lv, relicId) {
  if (!(Number.isInteger(lv) && lv >= 1 && lv < Z.BAL.relicMaxLv)) return null;
  const def = Z.BAL.relicDefs[relicId];
  // 伞骨/珠核用精铁，灵枝用灵木
  const mat = def && (def.type === 'shield' || def.type === 'tide') ? 'iron' : 'wood';
  return { gold: 80 + 60 * lv, stones: 1 + Math.floor((lv - 1) / 2), material: { id: mat, count: lv } };
};
// stage → 该关产出的法宝（云绫→玄云伞，桃露→青枝灵叶，蜃珠→碧海潮珠）
Z.BAL.relicOfStage = { 0: 'cloud_umbrella', 1: 'jade_leaf', 5: 'sea_tide_pearl' };
Z.BAL.relicMaterialReward = function (stage, alreadyCleared, relicOwned) {
  // 对应法宝已合成后，重复通关不再产出无用途材料（金币/经验/装备掉落不变）。
  if (relicOwned) return {};
  const amount = alreadyCleared ? 1 : 2;
  return stage === 0 ? { cloudSilk: amount } : stage === 1 ? { peachDew: amount }
    : stage === 5 ? { seaPearl: amount } : {};
};
