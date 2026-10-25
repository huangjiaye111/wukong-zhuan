/* ============================================================
 * audio.js —— WebAudio 音效、旧曲 fallback 与全章节原创音乐
 * 原创离线合成 BGM 由原生 Audio 播放，支持直接打开 file://。
 * ============================================================ */
'use strict';

Z.Audio = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  const readSetting = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  let settingWarning = false;
  function writeSetting(key, value) {
    try { localStorage.setItem(key, value); }
    catch (e) {
      if (!settingWarning && Z.UI) Z.UI.toast('声音设置已在本页生效，浏览器未能保存', '#ffb28b');
      settingWarning = true;
    }
  }
  let muted = readSetting('zmxy_muted') === '1';
  const num = (v, dft) => { const n = parseFloat(v); return isFinite(n) ? n : dft; };
  let musicV = Z.U.clamp(num(readSetting('zmxy_vmus'), 0.85), 0, 1);
  let sfxV = Z.U.clamp(num(readSetting('zmxy_vsfx'), 0.9), 0, 1);
  let noiseBuf = null;
  // 主循环启动时启用；独立对照页可以切回原声。
  let impactFeedback = false, pendingImpact = 0;

  // ---- BGM 状态 ----
  let curTrack = null, synthTrack = null, nextNoteTime = 0, stepIdx = 0;
  let unlocked = false, media = null, retiring = null;
  let synthMix = 1, synthFrom = 1, synthTarget = 1, synthFadeT = 0;
  const FADE_MS = 650;
  const scriptUrl = document.currentScript && document.currentScript.src;
  const ASSET_TRACKS = {
    menu: { file: 'journey_menu.ogg', fallback: 'menu', level: .42 },
    battle: { file: 'heaven_battle.ogg', fallback: 'battle', level: .40 },
    boss: { file: 'nantian_boss.ogg', fallback: 'boss', level: .38 },
    nantian: { file: 'nantian_adventure.ogg', fallback: 'battle', level: .34 },
    nantian_boss: { file: 'nantian_boss.ogg', fallback: 'boss', level: .38 },
    sea: { file: 'sea_adventure.ogg', fallback: 'sea', level: .42 },
    sea_boss: { file: 'sea_boss.ogg', fallback: 'boss', level: .46 },
    fire: { file: 'fire_adventure.ogg', fallback: 'fire', level: .42 },
    fire_boss: { file: 'fire_boss.ogg', fallback: 'boss', level: .46 },
  };
  const failedAssets = new Set();
  const clock = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

  function assetUrl(file) {
    try {
      const base = scriptUrl || (window.location && window.location.href);
      const url = new URL((scriptUrl ? '../' : '') + 'assets/audio/' + file, base);
      const version = new URL(base).searchParams.get('v');
      if (version) url.searchParams.set('v', version);
      return url.href;
    } catch (e) { return 'assets/audio/' + file; }
  }

  function disposeVoice(v) {
    if (!v || v.disposed) return;
    v.disposed = true;
    v.el.onerror = null;
    try { v.el.pause(); } catch (e) { }
    if (v.el.removeAttribute) v.el.removeAttribute('src');
    if (v.el.load) { try { v.el.load(); } catch (e) { } }
  }

  function fadeVoice(v, target) {
    if (!v || v.disposed) return;
    v.from = v.gain; v.target = target; v.fadeT = clock();
  }

  function setSynth(name, target) {
    if (synthTrack !== name) {
      synthTrack = name; stepIdx = 0;
      if (ctx) nextNoteTime = ctx.currentTime + .05;
    }
    synthFrom = synthMix; synthTarget = target; synthFadeT = clock();
  }

  function mediaFailed(v) {
    if (v.disposed) return;
    disposeVoice(v);
    if (v === media) {
      media = null;
      fadeVoice(retiring, 0);
      failedAssets.add(v.name);
      setSynth(ASSET_TRACKS[v.name].fallback, 1);
    } else if (v === retiring) retiring = null;
  }

  function playVoice(v) {
    if (!v || v.disposed || v.attempting || v.started || !unlocked || v.waitUnlock) return;
    v.attempting = true;
    const success = () => {
      v.attempting = false;
      if (v.disposed || v !== media) { try { v.el.pause(); } catch (e) { } return; }
      v.started = true; fadeVoice(v, 1); fadeVoice(retiring, 0); setSynth(null, 0);
    };
    const failure = (err) => {
      v.attempting = false;
      if (v.disposed || v !== media) return;
      if (err && err.name === 'NotAllowedError') {
        v.waitUnlock = true;
        fadeVoice(retiring, 0);
        setSynth(ASSET_TRACKS[v.name].fallback, 1);
      } else mediaFailed(v);
    };
    try {
      const result = v.el.play();
      if (result && typeof result.then === 'function') result.then(success, failure);
      else success();
    } catch (err) { failure(err); }
  }

  function retireMedia(hold = false) {
    if (media && media.started) { disposeVoice(retiring); retiring = media; }
    else disposeVoice(media);
    media = null;
    if (retiring) fadeVoice(retiring, hold ? retiring.gain : 0);
  }

  function startAsset(name) {
    if (retiring && retiring.name === name && !retiring.disposed) {
      const reuse = retiring; retiring = null;
      retireMedia(); media = reuse; fadeVoice(media, 1); setSynth(null, 0);
      return true;
    }
    retireMedia(true);
    if (typeof window.Audio !== 'function' || failedAssets.has(name)) return false;
    try {
      const el = new window.Audio(assetUrl(ASSET_TRACKS[name].file));
      el.loop = true; el.preload = 'auto'; el.volume = 0; el.muted = muted;
      media = { name, el, gain: 0, from: 0, target: 1, fadeT: clock(), started: false, attempting: false, waitUnlock: false, disposed: false };
      const voice = media;
      el.onerror = () => mediaFailed(voice);
      playVoice(voice);
      return true;
    } catch (e) { media = null; failedAssets.add(name); return false; }
  }

  function updateMix() {
    const now = clock();
    for (const v of [media, retiring]) {
      if (!v || v.disposed) continue;
      if (v.started) {
        const k = Z.U.clamp((now - v.fadeT) / FADE_MS, 0, 1);
        v.gain = Z.U.lerp(v.from, v.target, k);
      }
      v.el.muted = muted;
      v.el.volume = muted ? 0 : Z.U.clamp(musicV * ASSET_TRACKS[v.name].level * v.gain, 0, 1);
    }
    if (retiring && retiring.gain <= .0001 && retiring.target === 0) {
      disposeVoice(retiring); retiring = null;
    }
    synthMix = Z.U.lerp(synthFrom, synthTarget, Z.U.clamp((now - synthFadeT) / FADE_MS, 0, 1));
    if (musicGain) musicGain.gain.value = musicV * synthMix;
  }

  const NOTE = (semi) => 261.63 * Math.pow(2, semi / 12); // 以C4为基准

  // 音阶：宫商角徵羽（五声音阶）
  const SCALE_GONG = [0, 2, 4, 7, 9, 12, 14, 16];        // C 宫
  const SCALE_YU = [-3, 0, 2, 5, 7, 9, 12, 14];          // A 羽（偏暗，boss用）

  // 曲谱：melody/bass 为步进数组（null=休止，数字=音阶索引，负八度用 -8 偏移写作 idx-8）
  const TRACKS = {
    menu: {
      bpm: 84, scale: SCALE_GONG, root: 0,
      melody: [4,null,3,4, 2,null,3,null, 1,2,3,null, 2,null,null,null,
               4,null,5,4, 3,null,2,null, 1,null,2,1, 0,null,null,null],
      bass:   [0,null,null,null, -3,null,null,null, -5,null,null,null, -3,null,null,null,
               0,null,null,null, -3,null,null,null, -5,null,null,null, 0,null,null,null],
      wave: 'triangle', mVol: .05, bVol: .07,
    },
    battle: {
      bpm: 128, scale: SCALE_GONG, root: 2,
      melody: [4,null,4,5, 4,null,2,null, 3,4,3,2, 1,null,3,null,
               4,4,null,5, 6,null,5,4, 3,null,2,3, 2,null,1,null],
      bass:   [0,0,null,0, 0,null,0,null, -3,-3,null,-3, -3,null,-3,null,
               -5,-5,null,-5, -5,null,-5,null, 0,0,null,0, 0,null,0,null],
      wave: 'square', mVol: .035, bVol: .055, kick: true,
    },
    boss: {
      bpm: 148, scale: SCALE_YU, root: -3,
      melody: [5,null,5,6, 5,null,4,null, 3,null,4,5, 4,null,3,null,
               6,null,7,6, 5,null,4,null, 3,4,3,2, 3,null,null,null],
      bass:   [0,0,0,null, 0,0,null,0, -4,-4,-4,null, -4,-4,null,-4,
               -2,-2,-2,null, -2,-2,null,-2, 0,0,null,0, -4,null,-4,null],
      wave: 'sawtooth', mVol: .028, bVol: .05, kick: true,
    },
    fire: {
      bpm: 140, scale: SCALE_GONG, root: 4,
      melody: [5,5,null,4, 5,null,6,null, 5,4,3,null, 4,null,null,null,
               6,6,null,5, 6,null,7,null, 6,5,4,3, 4,null,null,null],
      bass:   [0,0,null,0, 0,null,0,null, -3,-3,null,-3, -3,null,-3,null,
               -5,-5,null,-5, -5,null,-5,null, 0,0,null,0, -3,null,0,null],
      wave: 'square', mVol: .032, bVol: .05, kick: true,
    },
    sea: {
      bpm: 88, scale: SCALE_YU, root: -5,
      melody: [4,null,null,3, 2,null,1,null, 3,null,4,null, 2,null,null,null,
               4,null,5,null, 3,null,2,null, 1,null,2,3, 2,null,null,null],
      bass:   [0,null,null,null, -3,null,null,null, -4,null,null,null, -3,null,null,null,
               0,null,null,null, -3,null,null,null, -4,null,null,null, 0,null,null,null],
      wave: 'triangle', mVol: .045, bVol: .06,
    },
  };

  function unlock() {
    unlocked = true;
    if (ctx) {
      if (ctx.state === 'suspended') { const result = ctx.resume(); if (result && result.catch) result.catch(() => {}); }
    } else try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = musicV; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = sfxV; sfxGain.connect(master);
      // 白噪声缓冲
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    if (media) { media.waitUnlock = false; playVoice(media); }
    updateMix();
  }

  function env(gain, t0, a, peak, d, end = 0.0001) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(end, t0 + a + d);
  }

  function tone(t0, { f0 = 440, f1 = null, type = 'square', a = .005, d = .12, v = .1, dest = null }) {
    f0 *= 1 + (Math.random() - 0.5) * 0.06; // 微变调，让重复音效不呆板
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
    env(g, t0, a, v, d);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + a + d + .05);
  }

  function noise(t0, { d = .1, v = .08, type = 'bandpass', f = 1200, q = 1, f1 = null, dest = null }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (f1 !== null) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + d);
    const g = ctx.createGain(); env(g, t0, .004, v, d);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxGain);
    s.start(t0); s.stop(t0 + d + .05);
  }

  /* ---------------- 音效 ---------------- */
  const SFX = {
    swing: (t) => noise(t, { d: .1, v: .06, f: 2400, f1: 500, q: 2 }),
    hit: (t) => { tone(t, { f0: 220, f1: 70, type: 'square', d: .08, v: .09 }); noise(t, { d: .06, v: .07, f: 900, f1: 300 }); },
    hitHeavy: (t) => { tone(t, { f0: 130, f1: 45, type: 'square', d: .16, v: .13 }); noise(t, { d: .12, v: .1, f: 600, f1: 150 }); },
    shoot: (t) => noise(t, { d: .09, v: .05, f: 3000, f1: 900, q: 3 }),
    jump: (t) => tone(t, { f0: 300, f1: 620, type: 'sine', d: .12, v: .07 }),
    land: (t) => noise(t, { d: .07, v: .05, f: 400, f1: 120 }),
    coin: (t) => { tone(t, { f0: 1318, type: 'square', d: .06, v: .05 }); tone(t + .06, { f0: 1760, type: 'square', d: .1, v: .05 }); },
    hurt: (t) => { tone(t, { f0: 220, f1: 90, type: 'sawtooth', d: .16, v: .1 }); },
    beam: (t) => { tone(t, { f0: 120, f1: 900, type: 'sawtooth', d: .3, v: .08 }); noise(t, { d: .3, v: .05, f: 2000, f1: 4000, q: 1 }); },
    dash: (t) => { noise(t, { d: .18, v: .07, f: 500, f1: 3000, q: 1.5 }); },
    spin: (t) => { noise(t, { d: .3, v: .05, f: 1800, f1: 800, q: 2 }); },
    wushuang: (t) => { tone(t, { f0: 90, f1: 700, type: 'sawtooth', d: .5, v: .12 }); noise(t + .05, { d: .5, v: .07, f: 2500, f1: 500 }); },
    levelup: (t) => { [0, 4, 7, 12].forEach((s, i) => tone(t + i * .09, { f0: NOTE(s) * 2, type: 'triangle', d: .18, v: .09 })); },
    bossroar: (t) => { tone(t, { f0: 70, f1: 45, type: 'sawtooth', d: .8, v: .16 }); noise(t, { d: .6, v: .08, f: 250, f1: 80 }); },
    click: (t) => tone(t, { f0: 900, type: 'square', d: .04, v: .04 }),
    buy: (t) => { tone(t, { f0: NOTE(7), type: 'triangle', d: .08, v: .07 }); tone(t + .08, { f0: NOTE(12), type: 'triangle', d: .14, v: .07 }); },
    potion: (t) => { tone(t, { f0: 320, f1: 150, type: 'sine', d: .1, v: .08 }); tone(t + .1, { f0: 320, f1: 150, type: 'sine', d: .1, v: .08 }); },
    stone: (t) => { tone(t, { f0: 1250, type: 'triangle', d: .05, v: .07 }); tone(t + .05, { f0: 1650, type: 'triangle', d: .08, v: .06 }); },
    pet: (t) => { tone(t, { f0: NOTE(9), type: 'sine', d: .1, v: .08 }); tone(t + .1, { f0: NOTE(14), type: 'sine', d: .16, v: .08 }); },
    clear: (t) => { [0, 4, 7, 9, 12].forEach((s, i) => tone(t + i * .11, { f0: NOTE(s) * 2, type: 'triangle', d: .25, v: .09 })); },
    fail: (t) => { [7, 3, 0].forEach((s, i) => tone(t + i * .18, { f0: NOTE(s), type: 'sawtooth', d: .3, v: .07 })); },
    portal: (t) => { tone(t, { f0: 200, f1: 1200, type: 'sine', d: .5, v: .07 }); },
    telegraph: (t) => { tone(t, { f0: 700, type: 'square', d: .06, v: .05 }); tone(t + .09, { f0: 700, type: 'square', d: .06, v: .05 }); },
    heartbeat: (t) => { tone(t, { f0: 65, f1: 40, type: 'sine', d: .12, v: .22 }); tone(t + .16, { f0: 58, f1: 36, type: 'sine', d: .14, v: .16 }); },
  };

  // 金箍棒的风切、短木击与低鼓落棍：无外部采样，避免长高频尾音遮住下一棍。
  const IMPACT_SFX = {
    swing: (t) => noise(t, { d: .075, v: .043, f: 2200, f1: 700, q: .65 }),
    staffHeavy: (t) => {
      noise(t, { d: .16, v: .065, f: 600, f1: 2100, q: .5 });
      tone(t, { f0: 80, f1: 135, type: 'sine', d: .12, v: .015 });
    },
    hit: (t) => {
      tone(t, { f0: 160, f1: 75, type: 'triangle', d: .065, v: .055 });
      tone(t, { f0: 560, f1: 380, type: 'sine', d: .04, v: .018 });
      noise(t, { d: .045, v: .055, f: 900, f1: 400, q: .7 });
    },
    hitHeavy: (t) => {
      tone(t, { f0: 145, f1: 46, type: 'sine', d: .12, v: .12 });
      tone(t, { f0: 200, f1: 85, type: 'triangle', d: .045, v: .038 });
      noise(t, { d: .075, v: .075, f: 950, f1: 280, q: .7 });
      tone(t, { f0: 1040, type: 'sine', d: .07, v: .018 });
      tone(t, { f0: 1560, type: 'sine', d: .05, v: .011 });
    },
    flameDash: (t) => {
      noise(t, { d: .1, v: .052, f: 550, f1: 2400, q: .8 });
      tone(t, { f0: 420, f1: 760, type: 'sine', d: .035, v: .022 });
      noise(t + .05, { d: .075, v: .023, f: 2000, f1: 600, q: .7 });
    },
  };

  function setImpactFeedback(on) {
    impactFeedback = !!on;
    clearImpact();
  }

  function clearImpact() { pendingImpact = 0; }

  // 每个逻辑 tick 收尾调用。群怪、暴击与残影只出一记最强命中声。
  function flushImpact() {
    const strength = pendingImpact;
    pendingImpact = 0;
    if (!strength || !ctx || muted) return false;
    IMPACT_SFX[strength === 2 ? 'hitHeavy' : 'hit'](ctx.currentTime);
    return true;
  }

  function sfx(name) {
    if (!ctx || muted) return;
    if (impactFeedback) {
      if (name === 'hit' || name === 'hitHeavy') {
        pendingImpact = Math.max(pendingImpact, name === 'hitHeavy' ? 2 : 1);
        return;
      }
      const refined = IMPACT_SFX[name];
      if (refined) { refined(ctx.currentTime); return; }
    }
    // 新触发名在未开启试玩时仍回退到正式原声。
    if (name === 'staffHeavy') name = 'swing';
    else if (name === 'flameDash') name = 'dash';
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime);
  }

  /* ---------------- BGM 调度 ---------------- */
  function scheduleStep(track, step, t) {
    const sc = track.scale, root = track.root;
    const deg = (v, oct = 0) => NOTE(sc[((v % 8) + 8) % 8] + root + oct * 12 + Math.floor(v / 8) * 12);
    const m = track.melody[step % track.melody.length];
    if (m !== null && m !== undefined) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = track.wave; o.frequency.value = deg(m, 1);
      env(g, t, .01, track.mVol, .22);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + .3);
    }
    const b = track.bass[step % track.bass.length];
    if (b !== null && b !== undefined) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = deg(b, 0);
      env(g, t, .01, track.bVol, .26);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + .34);
    }
    if (track.kick && step % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(45, t + .1);
      env(g, t, .004, .1, .1);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + .16);
    }
  }

  function music(name) {
    if (curTrack === name) return;
    updateMix();
    curTrack = name;
    if (ASSET_TRACKS[name]) {
      if (!startAsset(name)) { fadeVoice(retiring, 0); setSynth(ASSET_TRACKS[name].fallback, 1); }
    } else {
      retireMedia(); setSynth(name, name ? 1 : 0);
    }
  }
  function stopMusic() {
    curTrack = null; setSynth(null, 0);
    disposeVoice(media); disposeVoice(retiring); media = null; retiring = null;
    updateMix();
  }

  function update() {
    updateMix();
    if (!ctx || muted || !synthTrack) return;
    const tr = TRACKS[synthTrack];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2; // 八分音符
    if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + .05;
    while (nextNoteTime < ctx.currentTime + .25) {
      scheduleStep(tr, stepIdx, nextNoteTime);
      stepIdx++;
      nextNoteTime += stepDur;
    }
  }

  function toggleMute() {
    muted = !muted;
    pendingImpact = 0;
    writeSetting('zmxy_muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 1;
    updateMix();
    return muted;
  }

  function setMusicVol(v) {
    musicV = Z.U.clamp(v, 0, 1);
    writeSetting('zmxy_vmus', String(musicV));
    updateMix();
  }
  function setSfxVol(v) {
    sfxV = Z.U.clamp(v, 0, 1);
    writeSetting('zmxy_vsfx', String(sfxV));
    if (sfxGain) sfxGain.gain.value = sfxV;
  }

  return {
    unlock, sfx, music, stopMusic, update, toggleMute, isMuted: () => muted,
    setImpactFeedback, flushImpact, clearImpact,
    musicVol: () => musicV, sfxVol: () => sfxV, setMusicVol, setSfxVol,
    musicStatus: () => ({ track: curTrack, source: media ? 'asset' : synthTrack ? 'synth' : 'off', playing: !!(media && media.started), waitingForGesture: !!(media && media.waitUnlock) }),
  };
})();
