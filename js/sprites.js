/* ============================================================
 * sprites.js —— Q版程序化渲染
 * 纸片人骨架系统 + 悟空/小怪/Boss/宠物/图标，全部 Canvas 绘制
 * ============================================================ */
'use strict';

Z.Spr = Z.Spr || {};
(() => {
  const U = Z.U, TAU = U.TAU;

  // 原创绘画零件保持单一图集；普通 Image 可直接在 file:// 下加载。
  const heroRects = {
    chest:[67,401,282,308], skirt:[373,472,418,267], boot:[842,476,223,224],
    staff:[1255,380,45,381], upper:[83,739,183,329], fore:[467,776,162,282],
    fist:[805,847,151,145], cape:[1010,772,397,292],
  };
  let heroAtlas=null, heroBack=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript && document.currentScript.src, img=new Image();
    img.onload=()=>{
      heroAtlas=img;
      const cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
      const c=cv.getContext('2d'); c.drawImage(img,0,0);
      c.globalCompositeOperation='source-atop'; c.fillStyle='rgba(28,34,41,.24)'; c.fillRect(0,0,cv.width,cv.height);
      c.globalCompositeOperation='source-over'; heroBack=cv;
    };
    const url=base ? new URL('../assets/art/wukong-parts-v1.png',base) : null;
    if(url)url.search=new URL(base).search;
    img.src=url ? url.href : 'assets/art/wukong-parts-v1.png';
  }
  Z.Spr.heroArtReady=()=>!!heroAtlas;
  function heroPart(g,name,x,y,w,h,back=false) {
    g.drawImage(back ? heroBack : heroAtlas,...heroRects[name],x,y,w,h);
  }
  function heroLimb(g,name,a,b,w,back) {
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]), top=name==='upper'?.562:.401, bottom=name==='upper'?.573:.713;
    g.save();g.translate(...a);g.rotate(-Math.atan2(b[0]-a[0],b[1]-a[1]));
    // 护臂图画略带弯曲，把上、下接点对齐真实关节，避免手腕脱开。
    g.transform(1,0,w*(top-bottom)/(len+2),1,w*(.5-top),0);
    heroPart(g,name,-w/2,-1,w,len+2,back);g.restore();
  }
  function heroFist(g,hand,back=false) {
    g.save();g.translate(...hand);heroPart(g,'fist',-4,-4,8,8,back);g.restore();
  }

  // 真实四槽换装只读取存档；裸脸与冠独立，甲片复用现有关节和动作。
  const equipmentRects={
    heads:[[26,23,330,351],[382,23,330,351],[738,23,330,351],[1094,23,330,351]],
    head:[31,491,334,170],chest:[400,390,298,327],skirt:[704,431,420,324],
    upper:[79,720,217,348],fore:[465,731,169,332],boot:[810,795,261,250],acc:[1190,394,205,342],
  };
  const staffRects=[[54,37,1877,121],[54,173,1877,142],[30,331,1924,116],[47,464,1890,135]];
  const equipmentStyles={
    juling:{file:'juling-equipment-parts-r2.png',rects:{head:[28,84,357,211],chest:[422,14,362,391],skirt:[812,36,391,324],upper:[73,427,258,387],fore:[534,447,170,362],boot:[878,470,296,313],acc:[125,833,187,407],staff:[590,819,43,420]}},
    zengzhang:{file:'zengzhang-equipment-parts-r2.png',rects:{head:[36,126,362,215],chest:[456,11,311,409],skirt:[820,57,390,349],upper:[76,444,223,365],fore:[548,446,141,360],boot:[887,462,292,329],acc:[103,831,224,428],staff:[599,821,45,443]}},
  };
  let equipmentAtlas=null,equipmentBack=null,staffAtlas=null,legendaryStaff=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src;
    const load=(file,onload)=>{
      const img=new Image();img.onload=()=>onload(img);
      const url=base?new URL('../assets/art/equipment/'+file,base):null;
      if(url)url.search=new URL(base).search;
      img.src=url?url.href:'assets/art/equipment/'+file;
    };
    load('wukong-equipment-parts-r1.png',img=>{
      equipmentAtlas=img;
      const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
      const c=cv.getContext('2d');c.drawImage(img,0,0);c.globalCompositeOperation='source-atop';
      c.fillStyle='rgba(28,34,41,.24)';c.fillRect(0,0,cv.width,cv.height);equipmentBack=cv;
    });
    load('staff-quality-parts-r1.png',img=>{staffAtlas=img;});
    load('staff-legendary-r1.png',img=>{legendaryStaff=img;});
    for(const style of Object.values(equipmentStyles))load(style.file,img=>{
      style.atlas=img;
      const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
      const c=cv.getContext('2d');c.drawImage(img,0,0);c.globalCompositeOperation='source-atop';
      c.fillStyle='rgba(28,34,41,.24)';c.fillRect(0,0,cv.width,cv.height);style.back=cv;
    });
  }
  Z.Spr.equipmentArtReady=()=>!!(equipmentAtlas&&staffAtlas&&legendaryStaff);
  Z.Spr.equipmentStyleArtReady=style=>!!(equipmentStyles[style]&&equipmentStyles[style].atlas);
  function equipped(item,base) {
    return !!item&&item.base===base&&Number.isInteger(item.q)&&item.q>=0&&item.q<=4&&Number.isFinite(item.lv);
  }
  function equipmentStyle(item) {
    const def=item&&Z.BAL.gearDefs&&Z.BAL.gearDefs[item.gearId];
    if(!def||def.base!==item.base||!equipped(item,item.base))return null;
    const style=equipmentStyles[def.style];return style&&style.atlas?style:null;
  }
  function equipmentPart(g,name,x,y,w,h,back=false,item) {
    const style=equipmentStyle(item);
    g.drawImage(style?(back?style.back:style.atlas):(back?equipmentBack:equipmentAtlas),...(style?style.rects[name]:equipmentRects[name]),x,y,w,h);
  }
  function equipmentLimb(g,name,a,b,w,back,item) {
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),top=name==='upper'?.56:.49,bottom=name==='upper'?.54:.58;
    g.save();g.translate(...a);g.rotate(-Math.atan2(b[0]-a[0],b[1]-a[1]));
    g.transform(1,0,w*(top-bottom)/(len+2),1,w*(.5-top),0);
    equipmentPart(g,name,-w/2,-1,w,len+2,back,item);g.restore();
  }

  // 素装独立于甲胄，仍使用同一套肩肘腕/髋膝脚关节；失败时保留下方原画法。
  const baseRects={chest:[126,23,425,466],upper:[685,41,236,437],fore:[1137,64,190,431],thigh:[164,502,345,481],shin:[692,507,210,481],boot:[1067,639,394,323]};
  const baseAxes={upper:[.496,.625],fore:[.492,.684],thigh:[.4,.633],shin:[.548,.519]};
  let baseAtlas=null,baseBack=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src,img=new Image();
    img.onload=()=>{
      const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
      const c=cv.getContext('2d');c.drawImage(img,0,0);c.globalCompositeOperation='source-atop';
      c.fillStyle='rgba(28,34,41,.24)';c.fillRect(0,0,cv.width,cv.height);baseBack=cv;baseAtlas=img;
    };
    const url=base?new URL('../assets/art/characters/wukong-base-parts-v1.png',base):null;
    if(url)url.search=new URL(base).search;
    img.src=url?url.href:'assets/art/characters/wukong-base-parts-v1.png';
  }
  function basePart(g,name,x,y,w,h,back=false) {g.drawImage(back?baseBack:baseAtlas,...baseRects[name],x,y,w,h);}
  function baseLimb(g,name,a,b,w,back) {
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),[top,bottom]=baseAxes[name];
    g.save();g.translate(...a);g.rotate(-Math.atan2(b[0]-a[0],b[1]-a[1]));
    g.transform(1,0,w*(top-bottom)/(len+2),1,w*(.5-top),0);
    basePart(g,name,-w/2,-1,w,len+2,back);g.restore();
  }

  // 守军原创头/甲零件与现有 Canvas 四肢共同蒙皮；载入失败直接用下方程序造型。
  const enemyRects={soldierHead:[80,39,469,514],soldierTorso:[716,153,483,438],julingHead:[31,597,551,600],julingTorso:[614,690,622,522]};
  let enemyAtlas=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src,img=new Image();
    img.onload=()=>{enemyAtlas=img;};
    const url=base ? new URL('../assets/art/characters/heaven-enemy-parts-v1.png',base) : null;
    if(url)url.search=new URL(base).search;
    img.src=url ? url.href : 'assets/art/characters/heaven-enemy-parts-v1.png';
  }
  Z.Spr.enemyArtReady=()=>!!enemyAtlas;
  function enemyPart(g,name,x,y,w,h) {g.drawImage(enemyAtlas,...enemyRects[name],x,y,w,h);}

  // 轻甲弓手与牛妖沿既有骨架蒙皮；只替换头/胸，不改拉弦、挥斧或握点。
  const archerBullRects={archerHead:[42,84,575,520],bullHead:[706,104,522,514],archerChest:[119,719,428,433],bullChest:[649,712,542,459]};
  let archerBullAtlas=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src,img=new Image();
    img.onload=()=>{archerBullAtlas=img;};
    const url=base?new URL('../assets/art/characters/archer-bull-parts-v1.png',base):null;
    if(url)url.search=new URL(base).search;
    img.src=url?url.href:'assets/art/characters/archer-bull-parts-v1.png';
  }
  Z.Spr.archerBullArtReady=type=>!!archerBullAtlas&&(type==null||type==='gongshou'||type==='niuyao');
  function archerBullPart(g,name,x,y,w,h) {g.drawImage(archerBullAtlas,...archerBullRects[name],x,y,w,h);}

  // 增长天王原创透明配件；只在绘制层蒙皮，失败时沿用同一专属骨架的程序造型。
  const zengRects={neutral:[67,53,495,538],battle:[692,54,495,538],chest:[31,652,641,529],waist:[658,761,579,416]};
  let zengAtlas=null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src,img=new Image();
    img.onload=()=>{zengAtlas=img;};
    const url=base ? new URL('../assets/art/characters/zengzhang-parts-v1.png',base) : null;
    if(url)url.search=new URL(base).search;
    img.src=url ? url.href : 'assets/art/characters/zengzhang-parts-v1.png';
  }
  Z.Spr.zengzhangArtReady=()=>!!zengAtlas;
  function zengPart(g,name,x,y,w,h) {
    g.save();g.translate(x,y);
    // 下排零件包围盒略交叠；只裁掉邻件，不改写 PNG 的透明像素。
    if(name==='chest') {g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h*.52);g.lineTo(w*.92,h*.76);g.lineTo(w*.88,h);g.lineTo(0,h);g.closePath();g.clip();}
    if(name==='waist') {g.beginPath();g.moveTo(w*.14,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(0,h);g.lineTo(0,h*.48);g.lineTo(w*.14,h*.32);g.closePath();g.clip();}
    g.drawImage(zengAtlas,...zengRects[name],0,0,w,h);g.restore();
  }

  /* ============ 基础绘制小工具 ============ */
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
  function ell(g, x, y, rx, ry, c) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (c) g.fillStyle = c; g.fill();
  }
  // 颜色明暗调整（仅支持 #rrggbb），用于生成描边色/高光色
  function shade(hex, k) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(r)},${f(gg)},${f(b)})`;
  }
  // 胶囊肢体：先描边后填充，呈现卡通轮廓
  function limb(g, pts, color, w) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = shade(color, 0.48); g.lineWidth = w + 2.6; g.stroke();
    g.strokeStyle = color; g.lineWidth = w; g.stroke();
  }
  // 圆角矩形：填充+描边
  function rrF(g, x, y, w, h, r, fill, lw = 1.8, olK = 0.55) {
    rr(g, x, y, w, h, r);
    g.fillStyle = fill; g.fill();
    g.strokeStyle = shade(fill, olK); g.lineWidth = lw; g.stroke();
  }
  // 椭圆：填充+描边
  function ellO(g, x, y, rx, ry, c, lw = 1.6) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = c; g.fill();
    g.strokeStyle = shade(c, 0.55); g.lineWidth = lw; g.stroke();
  }
  // 落地挤压/空中拉伸系数
  function squashOf(e) {
    let k = 0;
    if (e.squashT > 0) k = e.squashT / 0.14;
    else if (e.onGround === false && e.vy < -380) k = -0.4;
    else if (e.onGround === false && e.vy > 420) k = 0.3;
    return Math.max(-0.6, Math.min(1, k));
  }
  function seg(x, y, a, len) { return [x + Math.sin(a) * len, y + Math.cos(a) * len]; }

  /* ---- 大圣 / 天兵 / 牛妖的 Q 版块面绘制，沿用现有动作关节 ---- */
  const Q_INK = '#392920';
  function qPaint(g, color, edge = true) {
    g.fillStyle = color; g.fill();
    if (edge) { g.strokeStyle = Q_INK; g.lineWidth = 1.35; g.lineJoin = 'round'; g.stroke(); }
  }
  function qPoly(g, color, points, edge = true) {
    g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath(); qPaint(g, color, edge);
  }
  function qSegment(g, a, b, w0, w1, color, dark, light) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    g.save(); g.translate(a[0], a[1]); g.rotate(-Math.atan2(b[0] - a[0], b[1] - a[1]));
    g.beginPath(); g.moveTo(-w0 / 2, -1);
    g.quadraticCurveTo(-w0 * 0.7, len * 0.45, -w1 / 2, len);
    g.quadraticCurveTo(0, len + 2, w1 / 2, len);
    g.quadraticCurveTo(w0 * 0.65, len * 0.45, w0 / 2, -1);
    g.closePath();
    if (light) {
      const material=g.createLinearGradient(-w0/2,0,w0/2,len);
      material.addColorStop(0,light);material.addColorStop(.38,color);material.addColorStop(1,dark);
      qPaint(g,material);
    } else qPaint(g, color);
    qPoly(g, dark, [[w0 * 0.15, 0], [w0 / 2, 0], [w1 / 2, len], [0, len + 1]], false);
    g.restore();
  }
  function qBoot(g, foot, angle, bull, back, hero=false, soldier=false,gear) {
    g.save(); g.translate(foot[0], foot[1]); g.rotate(-angle * 0.35);
    if(hero&&(equipmentAtlas||equipmentStyle(gear&&gear.armor))&&equipped(gear&&gear.armor,'armor')){equipmentPart(g,'boot',-6,-12,16,13,back,gear.armor);g.restore();return;}
    if(hero&&baseAtlas&&!equipped(gear&&gear.armor,'armor')){basePart(g,'boot',-6,-12,16,13,back);g.restore();return;}
    if(hero && heroAtlas&&!equipmentAtlas){heroPart(g,'boot',-6,-12,16,13,back);g.restore();return;}
    if (bull) {
      qPoly(g, back ? '#44382f' : '#5b493b', [[-5, -5], [4, -6], [7, 0], [5, 2], [-6, 2], [-7, 0]]);
      g.strokeStyle = Q_INK; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(1, -1); g.lineTo(2, 2); g.stroke();
    } else {
      g.translate(0,-2);
      g.beginPath(); g.moveTo(-4, -9); g.lineTo(3.5, -9); g.lineTo(4, -3);
      g.quadraticCurveTo(10, -2, 9, 2); g.lineTo(-4, 2); g.quadraticCurveTo(-6, 1, -5, -3); g.closePath();
      qPaint(g,soldier ? (back ? '#293b43' : '#3d535b') : back ? '#34332e' : '#4a3e31');
      qPoly(g, back ? '#ac823f' : '#e0b45d', [[-4, -8], [3.5, -8], [3.5, -5], [-4, -5]], false);
      g.strokeStyle = Q_INK; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(-4, 1); g.lineTo(8, 1); g.stroke();
    }
    g.restore();
  }
  function qLeg(g, hip, angles, bull, back, soldier,gear) {
    const len = bull ? 10 : 12, knee = seg(...hip, angles[0], len), foot = seg(...knee, angles[1], len);
    const color = bull ? (back ? '#773e30' : '#a35339') : (back ? '#234750' : soldier ? '#384859' : '#32616a');
    if(!bull&&!soldier&&baseAtlas){
      baseLimb(g,'thigh',hip,knee,11,back);baseLimb(g,'shin',knee,foot,8,back);
    }else{
      qSegment(g, hip, knee, bull ? 12 : 11, bull ? 10 : 8, color, bull ? '#70382c' : '#213e49',soldier ? '#6d8591' : null);
      qSegment(g, knee, foot, bull ? 10 : 8, bull ? 8 : 6, color, bull ? '#70382c' : '#213e49',soldier ? '#98aaa8' : null);
    }
    qBoot(g, foot, angles[1], bull, back, !bull&&!soldier,soldier,gear);
  }
  function qArm(g, shoulder, elbow, hand, bull, back, soldier,gear) {
    if(!bull&&!soldier&&(equipmentAtlas||equipmentStyle(gear&&gear.armor))&&equipped(gear&&gear.armor,'armor')){
      equipmentLimb(g,'upper',shoulder,elbow,10,back,gear.armor);equipmentLimb(g,'fore',elbow,hand,8.5,back,gear.armor);
      if(heroAtlas)heroFist(g,hand,back);
      else {g.save();g.translate(...hand);qPoly(g,back?'#be8d58':'#efbd85',[[-3.5,-3],[2.5,-3.5],[4,-1],[3.5,3],[-2,4],[-4,1]]);g.restore();}
      return;
    }
    if(!bull&&!soldier&&baseAtlas&&!equipped(gear&&gear.armor,'armor')){
      baseLimb(g,'upper',shoulder,elbow,8.5,back);baseLimb(g,'fore',elbow,hand,7.5,back);
      if(heroAtlas)heroFist(g,hand,back);
      else {g.save();g.translate(...hand);qPoly(g,back?'#be8d58':'#efbd85',[[-3.5,-3],[2.5,-3.5],[4,-1],[3.5,3],[-2,4],[-4,1]]);g.restore();}
      return;
    }
    if(!bull&&!soldier&&heroAtlas&&!equipmentAtlas){
      heroLimb(g,'upper',shoulder,elbow,10,back);heroLimb(g,'fore',elbow,hand,8.5,back);
      heroFist(g,hand,back);return;
    }
    const skin = bull ? (back ? '#853f2d' : '#ac553a') : soldier ? '#63778b' : (back ? '#a8632c' : '#c5833a');
    qSegment(g, shoulder, elbow, bull ? 13 : 8.5, bull ? 11 : 7, skin, bull ? '#713829' : soldier ? '#354b60' : '#995321',soldier ? '#a2b8b9' : null);
    qSegment(g, elbow, hand, bull ? 11 : 7.5, bull ? 9 : 6.5,
      bull ? '#4f4740' : soldier ? '#bf9651' : equipmentAtlas ? skin : '#cc9b48', bull ? '#34322e' : soldier ? '#775734' : '#92642c',soldier ? '#efcf7e' : null);
    if (soldier) {
      const dx=hand[0]-elbow[0],dy=hand[1]-elbow[1];
      g.save();g.translate(elbow[0]+dx*.38,elbow[1]+dy*.38);g.rotate(-Math.atan2(dx,dy));
      qPoly(g,'#46656c',[[-3,-1],[3,-1],[3,3],[-3,3]],false);
      g.strokeStyle='#e3cb91';g.lineWidth=.7;g.beginPath();g.moveTo(-2,-.3);g.lineTo(2,-.3);g.stroke();g.restore();
    }
    g.save(); g.translate(hand[0], hand[1]);
    qPoly(g, bull ? skin : '#efbd85', [[-3.5, -3], [2.5, -3.5], [4, -1], [3.5, 3], [-2, 4], [-4, 1]]);
    g.strokeStyle = bull ? '#713829' : '#a3683f'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(2.5, 1); g.stroke();
    g.restore();
  }
  function qMonkeyHead(g, p, time) {
    if(equipmentAtlas){
      const blink=!p.glow&&!p.angry&&time%3.2<.12,head=p.glow?3:p.angry?1:blink?2:0;
      g.drawImage(equipmentAtlas,...equipmentRects.heads[head],-21,-28,39,41.5);
      if(equipped(p.equipment&&p.equipment.head,'head')){
        const item=p.equipment.head;
        equipmentPart(g,'head',-20.7,equipmentStyle(item)?-19:-16.7,38.5,19.6,false,item);
      }
      return;
    }
    if(heroAtlas){
      const blink=!p.glow && !p.angry && time%3.2<.12;
      const head=p.glow ? 3 : p.angry ? 1 : blink ? 2 : 0;
      // 四个表情使用相同画面裁框及颈部锚点，不单独缩放头像。
      g.drawImage(heroAtlas,28+352*head,12,330,364,-21,-28,39,43);return;
    }
    // 顺着后脑向上梳的鬃毛与尖脸颊，不使用圆形鬃圈。
    qPoly(g, '#b9772e', [[14,-10],[11,-19],[3,-24],[-3,-22],[-11,-25],[-9,-20],[-19,-19],[-15,-14],[-21,-11],[-17,-5],[-18,2],[-14,7],[-16,11],[-9,10],[-4,14],[7,13],[14,7],[16,0]]);
    qPoly(g, '#d39540', [[-15,-16],[-9,-15],[-13,-19],[-4,-17],[-7,-21],[3,-20],[10,-15],[7,-11],[-7,-11]], false);
    ellO(g, -12, -1, 4, 4.8, '#edbd87', 1.1);
    g.strokeStyle = '#a76d40'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-13.5, -3); g.quadraticCurveTo(-9, -4, -11, 2); g.stroke();
    g.beginPath(); g.moveTo(-6,-9);
    g.quadraticCurveTo(-2,-11,2,-5); g.quadraticCurveTo(6,-11,11,-8);
    g.quadraticCurveTo(14,-5,13,0); g.lineTo(16,3);
    g.quadraticCurveTo(15,10,7,12); g.lineTo(-1,9); g.lineTo(-5,5);
    g.quadraticCurveTo(-9,0,-6,-9); g.closePath(); qPaint(g, '#f5ce9b');
    qPoly(g, '#d99c69', [[12,0],[16,3],[14,8],[7,12],[0,9],[5,9],[11,6]], false);
    // 金箍与一个卷纹，保留清晰的大轮廓。
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-13,-9); g.quadraticCurveTo(-2,-15,11,-10);
    g.strokeStyle = Q_INK; g.lineWidth = 4.5; g.stroke();
    g.strokeStyle = '#e8b848'; g.lineWidth = 2.7; g.stroke();
    g.beginPath(); g.moveTo(7,-10); g.bezierCurveTo(4,-17,13,-17,12,-11);
    g.bezierCurveTo(12,-8,8,-8,8,-11); g.strokeStyle = Q_INK; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#f7d36b'; g.lineWidth = 1.6; g.stroke();
    const blink = !p.glow && time % 3.2 < 0.12;
    if (!blink) {
      qPoly(g, p.glow ? '#ffeda7' : '#fff2d8', [[-3,-3], [1,-1.5], [0,2], [-3,1]], false);
      qPoly(g, p.glow ? '#ffeda7' : '#fff2d8', [[5,-3.5],[11,-1.5],[10,2],[6,2]], false);
      ell(g, 0, 0, 1, 1.6, p.glow ? '#f89624' : '#62321b');
      ell(g, 9, 0, 1.4, 1.9, p.glow ? '#f89624' : '#62321b');
      ell(g, 8.7, -0.5, 0.4, 0.5, '#fff');
    }
    g.strokeStyle = '#60351d'; g.lineWidth = 1.65;
    g.beginPath(); g.moveTo(-4,-4.5); g.lineTo(1,-2.5); g.stroke();
    g.beginPath(); g.moveTo(5,-4.8 - (p.angry ? 0.4 : 0)); g.lineTo(11.5,-2.5); g.stroke();
    if (blink) {
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-3,0); g.lineTo(1,0.5); g.moveTo(6,0); g.lineTo(11,0.5); g.stroke();
    }
    ell(g, 14, 3.1, 1.2, 0.8, '#ad663d');
    g.strokeStyle = '#874827'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(5,7); g.quadraticCurveTo(9,9,12,6.5); g.stroke();
    if (p.angry) qPoly(g, '#fff0cf', [[6,7],[11,6.8],[9,8]], false);
  }
  function qSoldierHead(g, p, time) {
    if(enemyAtlas){enemyPart(g,'soldierHead',-21,-31,40,44);return;}
    const face=g.createLinearGradient(-8,-10,12,10);face.addColorStop(0,'#ffe0b3');face.addColorStop(.55,'#e9ba8c');face.addColorStop(1,'#bd805b');
    g.beginPath(); g.moveTo(-9,-9); g.quadraticCurveTo(4,-14,11,-6);
    g.lineTo(12,3); g.quadraticCurveTo(12,8,5,11); g.quadraticCurveTo(-7,8,-9,2); g.closePath(); qPaint(g,face);
    qPoly(g, '#c48860', [[9,-5],[12,-5],[12,5],[5,11],[1,8],[8,5]], false);
    g.beginPath(); g.moveTo(-12,2); g.lineTo(-13,-8);
    g.quadraticCurveTo(-12,-16,-6,-18); g.quadraticCurveTo(2,-23,9,-15);
    g.lineTo(13,-7); g.lineTo(9,-4); g.lineTo(2,-7); g.lineTo(-5,-5);
    const steel=g.createLinearGradient(-12,-18,10,8);steel.addColorStop(0,'#bad0ce');steel.addColorStop(.4,'#718d99');steel.addColorStop(1,'#405967');
    g.lineTo(-5,8); g.lineTo(-10,7); g.closePath(); qPaint(g,steel);
    qPoly(g, '#465c73', [[-12,-4],[-5,-5],[-5,8],[-10,7]], false);
    qPoly(g, '#cfa559', [[-6,-16],[-2,-17],[5,-8],[2,-7]], false);
    // 头顶红缨。
    g.beginPath(); g.moveTo(-3,-18); g.quadraticCurveTo(-2,-30,-10,-31);
    g.quadraticCurveTo(-7,-25,-12,-22); g.quadraticCurveTo(-7,-25,-5,-17);
    g.closePath(); qPaint(g, '#aa3e35');
    g.strokeStyle = '#d5ae63'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-5,-5); g.lineTo(2,-7); g.lineTo(10,-4); g.stroke();
    if(time%3.6>.1||p.angry){qPoly(g, '#fff0d6', [[2,-1],[9,0],[8,3],[3,2]], false);ell(g, 7, 1.3, 1, 1.6, '#3c302a');ell(g,6.8,.8,.35,.4,'#fff7dc');}
    else {g.strokeStyle='#5c4030';g.lineWidth=1;g.beginPath();g.moveTo(3,1);g.lineTo(8,1.7);g.stroke();}
    g.strokeStyle = Q_INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(1,-2); g.lineTo(9,0); g.stroke();
    g.lineWidth = 0.9; g.beginPath(); g.moveTo(7,6); g.lineTo(10,5.5); g.stroke();
  }
  function qBullHead(g, p, minion=false) {
    if(minion&&archerBullAtlas){archerBullPart(g,'bullHead',-28,-35,56,55);return;}
    // 牛角先画，牛吻后画，让它拥有独立于人形的剪影。
    for (const side of [-1,1]) {
      g.save(); g.scale(side,1);
      g.beginPath(); g.moveTo(11,-9); g.quadraticCurveTo(28,-11,27,-28);
      g.quadraticCurveTo(18,-25,20,-19); g.quadraticCurveTo(20,-14,9,-15);
      g.closePath(); qPaint(g, '#c1b096');
      qPoly(g, '#8d806e', [[11,-9],[22,-14],[27,-28],[26,-18],[19,-10]], false);
      g.restore();
    }
    qPoly(g,'#853f2f',[[-15,-9],[-23,-12],[-22,-5],[-15,-3]]);
    g.beginPath(); g.moveTo(-16,-8); g.quadraticCurveTo(-12,-16,-3,-15);
    g.lineTo(2,-18); g.lineTo(6,-13); g.quadraticCurveTo(14,-14,17,-6);
    g.lineTo(14,1); g.quadraticCurveTo(19,8,11,13); g.quadraticCurveTo(1,17,-12,9);
    g.lineTo(-14,1); g.lineTo(-17,2); g.quadraticCurveTo(-20,-4,-16,-8);
    g.closePath(); qPaint(g,'#a95136');
    qPoly(g, '#71382c', [[-13,-12],[-9,-18],[-5,-14],[-2,-20],[2,-16],[5,-19],[7,-12]], false);
    qPoly(g, '#70392e', [[-15,-2],[-7,-6],[-6,6],[-1,14],[-12,9]], false);
    qPoly(g, '#efd39b', [[-4,-5],[1,-3],[0,0],[-4,-1]], false);
    qPoly(g, '#efd39b', [[6,-5],[12,-3],[10,0],[6,-1]], false);
    ell(g, 0,-1.7,1,1.3,'#39271c'); ell(g,10,-1.7,1,1.3,'#39271c');
    g.strokeStyle = Q_INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-5,-6); g.lineTo(2,-3); g.moveTo(6,-3); g.lineTo(13,-6); g.stroke();
    g.beginPath(); g.moveTo(-1,2); g.quadraticCurveTo(9,-1,17,4);
    g.quadraticCurveTo(20,12,12,15); g.quadraticCurveTo(2,16,-2,9);
    g.closePath(); qPaint(g, '#693e31');
    ell(g, 7,5,1.5,1.1,'#302722'); ell(g,14,5,1.5,1.1,'#302722');
    g.beginPath(); g.arc(11,10,3.8,-0.4,Math.PI*1.5);
    g.strokeStyle = Q_INK; g.lineWidth = 3.8; g.stroke();
    g.strokeStyle = '#d6a44b'; g.lineWidth = 2.2; g.stroke();
  }
  // 装备棍与背包图标共用材质和端箍；轮廓固定 90×8，强化只增加内侧刻纹。
  const WK_STAFF_MATERIALS = [
    {shaft:'#6b4536',light:'#c3a180',dark:'#3e302c',metal:'#a59d89',shine:'#e6dbc0',trim:'#635f58',cap:[[-3,32],[3,32],[3.5,34],[3.5,44.5],[-3.5,44.5],[-3.5,34]]},
    {shaft:'#22534b',light:'#75a88a',dark:'#102f2e',metal:'#b49b4d',shine:'#eee0a1',trim:'#596846',cap:[[-2.7,32],[2.7,32],[3.5,35],[3.5,41],[2.6,44.5],[-2.6,44.5],[-3.5,41],[-3.5,35]]},
    {shaft:'#274e6b',light:'#9ec4d7',dark:'#183347',metal:'#b8cbd0',shine:'#fbf7d9',trim:'#53758b',cap:[[-2.8,32],[2.8,32],[3.5,34],[3.5,41],[0,44.5],[-3.5,41],[-3.5,34]]},
    {shaft:'#542e6a',light:'#a875a4',dark:'#2e233e',metal:'#cc9b54',shine:'#ffdf9a',trim:'#714468',cap:[[-2.6,32],[2.6,32],[3.5,34],[2.8,39],[3.5,43],[2.8,44.5],[-2.8,44.5],[-3.5,43],[-2.8,39],[-3.5,34]]},
    {shaft:'#85392f',light:'#e09952',dark:'#452b25',metal:'#dfaa3d',shine:'#fff0b1',trim:'#854f27',cap:[[-2.7,32],[2.7,32],[3.5,34],[2.8,36],[3.5,39],[3.5,43],[2.6,44.5],[-2.6,44.5],[-3.5,43],[-3.5,39],[-2.8,36],[-3.5,34]]},
  ];
  function qStaffItem(g, item) {
    if (!item || !Number.isInteger(item.q) || item.q<0 || item.q>4 || !Number.isFinite(item.lv)) return false;
    const m=WK_STAFF_MATERIALS[item.q],lv=U.clamp(item.lv,0,15),alpha=g.globalAlpha;
    const art=item.q===4?legendaryStaff:staffAtlas,style=item.base==='weapon'?equipmentStyle(item):null;
    if(style||art){
      if(style)g.drawImage(style.atlas,...style.rects.staff,-4,-45,8,90);
      else{
        g.save();g.rotate(-Math.PI/2);
        g.drawImage(art,...(item.q===4?[41,311,1900,165]:staffRects[item.q]),-45,-4,90,8);
        g.restore();
      }
      if(lv>0){
        g.save();g.globalAlpha=alpha*(.45+lv/30);g.strokeStyle=m.shine;g.lineWidth=.55;
        g.beginPath();for(const side of [-1,1])for(let i=0;i<Math.ceil(lv/3);i++){
          const y=(18+i*2.6)*side;g.moveTo(-1.8,y);g.lineTo(0,y-1.1*side);g.lineTo(1.8,y);
        }g.stroke();g.restore();
      }
      return true;
    }
    g.save();g.lineJoin='round';g.lineCap='round';
    const shaft=g.createLinearGradient(-2.5,0,2.5,0);
    shaft.addColorStop(0,m.light);shaft.addColorStop(.38,m.shaft);shaft.addColorStop(1,m.dark);
    qPoly(g,shaft,[[-2.5,-43.5],[2.5,-43.5],[2.5,43.5],[-2.5,43.5]],false);
    g.strokeStyle=Q_INK;g.lineWidth=1;g.stroke();
    qPoly(g,m.light,[[-1.8,-31],[-1.1,-31],[-1.1,31],[-1.8,31]],false);
    const metal=g.createLinearGradient(-3.5,0,3.5,0);
    metal.addColorStop(0,m.shine);metal.addColorStop(.36,m.metal);metal.addColorStop(1,m.trim);
    for (const side of [-1,1]) {
      qPoly(g,metal,m.cap.map(([x,y])=>[x,y*side]),false);
      g.strokeStyle=Q_INK;g.lineWidth=1;g.stroke();
      g.strokeStyle=m.shine;g.lineWidth=.65;
      g.beginPath();g.moveTo(-2.4,34.8*side);g.lineTo(2.4,34.8*side);g.stroke();
      g.strokeStyle=m.trim;g.lineWidth=.65;
      g.beginPath();g.moveTo(-2.3,42*side);g.lineTo(2.3,42*side);g.stroke();
      if(item.q>0) {
        g.strokeStyle=m.shine;g.lineWidth=.7;g.beginPath();
        g.moveTo(-1.5,37*side);g.quadraticCurveTo(1.8,36*side,1.5,39*side);
        g.quadraticCurveTo(-1.8,41*side,-1.2,39*side);g.stroke();
      }
      if(item.q>=3) qPoly(g,item.q===4?m.shaft:m.shine,[[0,39*side],[1.1,40.5*side],[0,42*side],[-1.1,40.5*side]],false);
      if(lv>0) {
        g.strokeStyle=m.shine;g.lineWidth=.55;g.globalAlpha=alpha*(.45+lv/30);
        g.beginPath();
        for(let i=0;i<Math.ceil(lv/3);i++) {
          const y=(18+i*2.6)*side;
          g.moveTo(-1.8,y);g.lineTo(0,y-1.1*side);g.lineTo(1.8,y);
        }
        g.stroke();g.globalAlpha=alpha;
      }
    }
    g.restore();return true;
  }
  function qWeapon(g, kind, hand, angle, offset = 0, weaponItem) {
    g.save(); g.translate(hand[0] + Math.sin(angle)*offset, hand[1] + Math.cos(angle)*offset); g.rotate(-angle);
    if (kind === 'staff') {
      if(qStaffItem(g,weaponItem)){g.restore();return;}
      if(heroAtlas){heroPart(g,'staff',-4,-45,8,90);g.restore();return;}
      qPoly(g, '#993e29', [[-2.5,-43],[2.5,-43],[2.5,43],[-2.5,43]]);
      qPoly(g, '#cd7950', [[-1.7,-32],[-0.5,-32],[-0.5,32],[-1.7,32]], false);
      for (const y of [-44,33]) {
        qPoly(g, '#deb14e', [[-3.5,y],[3.5,y],[3.5,y+11],[-3.5,y+11]]);
        qPoly(g, '#faD879', [[-2.2,y+1],[-0.5,y+1],[-0.5,y+10],[-2.2,y+10]], false);
        g.strokeStyle = '#a87832'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-3,y+3); g.lineTo(3,y+3); g.moveTo(-3,y+8); g.lineTo(3,y+8); g.stroke();
      }
    } else if (kind === 'spear') {
      qPoly(g, '#826047', [[-1.5,-34],[1.5,-34],[1.5,32],[-1.5,32]]);
      qPoly(g, '#c49759', [[-.9,-33],[-.2,-33],[-.2,28],[-.9,28]],false);
      qPoly(g, '#a83b32', [[-3,28],[-7,19],[-5,31],[-2,34],[0,35],[6,22],[3,33]]);
      qPoly(g, '#e77852', [[-3,28],[-6,21],[-3,32],[-1,34]],false);
      const steel=g.createLinearGradient(-5,35,5,45);steel.addColorStop(0,'#eff3df');steel.addColorStop(.45,'#b8d1cf');steel.addColorStop(1,'#557380');
      qPoly(g, steel, [[0,51],[-5,35],[0,28],[5,35]]);
      qPoly(g, '#f6edc6', [[0,50],[-3.7,35],[0,30]], false);
      qPoly(g, '#d4aa59', [[-3,29],[3,29],[3,32],[-3,32]]);
    } else {
      qPoly(g, '#74503b', [[-2,-17],[2,-17],[2,28],[-2,28]]);
      g.beginPath(); g.moveTo(0,17); g.lineTo(10,10); g.lineTo(18,9);
      g.quadraticCurveTo(24,22,17,36); g.lineTo(7,33); g.lineTo(1,27); g.closePath(); qPaint(g, '#78858b');
      qPoly(g, '#c2ced0', [[18,9],[22,19],[17,36],[13,33],[18,21]], false);
      qPoly(g, '#444c51', [[1,17],[6,16],[6,29],[1,27]], false);
    }
    g.restore();
  }
  function qCharacter(g, o, kind) {
    const p = o.pose, bull = kind === 'niuyao', soldier = kind === 'tianbing', monkey = !bull && !soldier;
    const gear=monkey?p.equipment:null;
    const f = o.f || 1, s = o.s || 1, lean = p.lean || 0, time = o.time || 0;
    g.save(); g.translate(o.x,o.y);
    if (p.lying) { g.rotate(-f*Math.PI/2*0.94); g.translate(0,-10); }
    if (p.spin != null) { g.translate(0,-38); g.rotate(p.spin); g.translate(0,38); }
    if (o.squash) g.scale(1+0.1*o.squash,1-0.13*o.squash);
    g.scale(f*s,s);
    const hipY = (bull ? -22 : -26) + (p.dy || 0), tor = bull ? 24 : soldier ? 19 : 22;
    const sh = [Math.sin(lean)*tor,hipY-Math.cos(lean)*tor];
    const spread = bull ? 9 : 5, armLen = bull ? 11 : 10;
    const shB = [sh[0]-(bull ? 14 : soldier ? 5 : 2),sh[1]+4], shF = [sh[0]+(bull ? 15 : soldier ? 6 : 4)+(p.shoulderF || 0),sh[1]+4];
    const ab = p.armB || [0,0], af = p.armF || [0,0];
    const elbF = seg(...shF,af[0],armLen), handF = seg(...elbF,af[1],armLen);
    let elbB = seg(...shB,ab[0],armLen), handB = seg(...elbB,ab[1],armLen);
    if (p.gripBlend > 0) {
      handB = [U.lerp(handB[0],handF[0]+Math.sin(p.wA)*p.grip,p.gripBlend),U.lerp(handB[1],handF[1]+Math.cos(p.wA)*p.grip,p.gripBlend)];
      const dx=handB[0]-shB[0],dy=handB[1]-shB[1],len=Math.max(0.1,Math.hypot(dx,dy));
      const bend=Math.sqrt(Math.max(0,armLen*armLen-len*len/4));
      elbB=[(shB[0]+handB[0])/2-dy/len*bend,(shB[1]+handB[1])/2+dx/len*bend];
    }
    if (monkey) {
      const motion=o.motion || {}, wag=(p.tail || 0)+(motion.tail || 0)*0.65;
      g.beginPath(); g.moveTo(-7,hipY+1); g.bezierCurveTo(-31,hipY+10+wag*9,-37,hipY-7+wag*13,-27,hipY-13+wag*9);
      g.lineCap='round'; g.strokeStyle=Q_INK; g.lineWidth=6; g.stroke();
      g.strokeStyle='#b77a36'; g.lineWidth=3.8; g.stroke();
      const lift=motion.cape || 0, wob=Math.sin(time*3.2)*1.2;
      const hx=-27-lift*16-wob,hy=hipY+6-lift*14;
      g.beginPath(); g.moveTo(sh[0]-6,sh[1]-1);
      g.quadraticCurveTo(-25-lift*15,sh[1]+6-lift*4,hx,hy);
      g.lineTo(hx+8,hy-3); g.lineTo(-8,hipY+10); g.lineTo(sh[0]+2,sh[1]+4); g.closePath(); qPaint(g,'#a93934');
      qPoly(g,'#d75a43',[[sh[0]-6,sh[1]],[hx+4,hy-7],[-8,hipY+3]],false);
      if(heroAtlas){
        // 保留动态轮廓和弹簧随动，绘画纹理随展开的布面缩放。
        g.save();g.beginPath();g.moveTo(sh[0]-6,sh[1]-1);
        g.quadraticCurveTo(-25-lift*15,sh[1]+6-lift*4,hx,hy);
        g.lineTo(hx+8,hy-3);g.lineTo(-8,hipY+10);g.lineTo(sh[0]+2,sh[1]+4);g.closePath();g.clip();
        const left=Math.min(hx,-8),top=Math.min(sh[1]-2,hy-8),right=Math.max(sh[0]+3,-8),bottom=Math.max(hipY+11,hy+2);
        heroPart(g,'cape',left,top,right-left,bottom-top);g.restore();
      }
    }
    if (p.weapon && p.weaponBehind) qWeapon(g,p.weapon,handF,p.wA || 0,p.staffOffset || 0,p.weaponItem);
    qLeg(g,[-spread,hipY],p.legB || [0,0],bull,true,soldier,gear);
    qArm(g,shB,elbB,handB,bull,true,soldier,gear);
    qLeg(g,[spread,hipY],p.legF || [0,0],bull,false,soldier,gear);
    // 胸肩与腰裙跟随躯干倾角，遮住大腿的关节接缝。
    g.save(); g.translate(0,hipY); g.rotate(lean);
    if(monkey&&baseAtlas&&!equipped(gear&&gear.armor,'armor')){
      basePart(g,'chest',-12,-25,27,29);
      if(heroAtlas)heroPart(g,'skirt',-15,-2,31,17);
      else qPoly(g,'#d7af68',[[-13,0],[12,0],[15,12],[5,15],[-15,11]]);
    }else if(monkey&&(equipmentAtlas||equipmentStyle(gear&&gear.armor))){
      if(equipped(gear&&gear.armor,'armor')){
        equipmentPart(g,'chest',-12,-25,27,29,false,gear.armor);equipmentPart(g,'skirt',-16,-3,33,19,false,gear.armor);
      }else{
        const cloth=g.createLinearGradient(-11,-24,13,2);cloth.addColorStop(0,'#48615d');cloth.addColorStop(.55,'#2f4949');cloth.addColorStop(1,'#1d333b');
        qPoly(g,cloth,[[-10,-23],[9,-23],[12,-12],[9,3],[-9,3],[-12,-11]]);
        qPoly(g,'#81918a',[[-7,-22],[-3,-22],[1,-3],[-2,-2]],false);
        if(heroAtlas)heroPart(g,'skirt',-15,-2,31,17);
        else qPoly(g,'#d7af68',[[-13,0],[12,0],[15,12],[5,15],[-15,11]]);
        qPoly(g,'#a33931',[[-10,-25],[9,-25],[6,-19],[-5,-19]]);
        qPoly(g,'#d75a43',[[1,-20],[7,-18],[5,-11],[1,-15]],false);
      }
    } else if(monkey && heroAtlas){
      heroPart(g,'chest',-12,-25,27,29);
      heroPart(g,'skirt',-15,-2,31,17);
    } else if(soldier && enemyAtlas) {
      enemyPart(g,'soldierTorso',-19,-24,38,34);
    } else if (bull) {
      g.beginPath(); g.moveTo(-18,-tor); g.quadraticCurveTo(0,-tor-4,20,-tor);
      g.quadraticCurveTo(26,-18,23,-12); g.quadraticCurveTo(21,-4,15,4);
      g.lineTo(-14,4); g.quadraticCurveTo(-24,-8,-22,-16); g.closePath(); qPaint(g,'#a95136');
      qPoly(g,'#793c2d',[[-19,-20],[-9,-19],[-7,-2],[-14,4],[-22,-12]],false);
      g.strokeStyle='#713829'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(-5,-17); g.quadraticCurveTo(5,-12,14,-16); g.moveTo(3,-11); g.lineTo(2,-4); g.stroke();
      qPoly(g,'#544738',[[-15,-2],[15,-2],[17,10],[9,8],[5,13],[-1,10],[-8,12],[-18,8]]);
      qPoly(g,'#352f29',[[-15,-2],[15,-2],[15,3],[-16,3]]);
      qPoly(g,'#a78f60',[[-2,-2],[4,-2],[5,4],[0,6],[-4,3]]);
      qPoly(g,'#697071',[[-21,-24],[-11,-27],[-4,-20],[-9,-13],[-23,-16]]);
      qPoly(g,'#949b97',[[-21,-24],[-11,-27],[-4,-20],[-10,-21]],false);
      if(archerBullAtlas)archerBullPart(g,'bullChest',-25,-27,50,34);
    } else {
      g.beginPath(); g.moveTo(-10,-tor); g.quadraticCurveTo(0,-tor-2,11,-tor);
      g.lineTo(13,-12); g.lineTo(9,4); g.lineTo(-9,4); g.lineTo(-12,-12); g.closePath();
      qPaint(g,soldier ? '#647c91' : '#344d4b');
      qPoly(g,soldier ? '#3f576c' : '#263c3c',[[-10,-tor],[-3,-tor+1],[-3,1],[-9,4],[-12,-12]],false);
      if (soldier) {
        g.strokeStyle='#34485a'; g.lineWidth=1;
        for (const y of [-12,-7]) { g.beginPath(); g.moveTo(-8,y); g.lineTo(9,y); g.stroke(); }
        g.beginPath(); g.moveTo(0,-16); g.lineTo(0,-3); g.moveTo(6,-15); g.lineTo(6,-3); g.stroke();
        qPoly(g,'#566e83',[[-10,1],[-1,1],[-2,12],[-13,10]]);
        qPoly(g,'#72879a',[[1,1],[10,1],[13,10],[2,12]]);
        g.strokeStyle='#d2ac60'; g.lineWidth=1.2;
        g.beginPath(); g.moveTo(-13,10); g.lineTo(-2,12); g.moveTo(2,12); g.lineTo(13,10); g.stroke();
      } else {
        qPoly(g,'#dfb157',[[-7,-20],[-3,-21],[6,-3],[2,-2]]);
        qPoly(g,'#edc477',[[-11,0],[0,0],[-2,13],[-7,10],[-14,12]]);
        qPoly(g,'#e4af50',[[0,0],[10,0],[13,9],[6,13],[2,9]]);
        qPoly(g,'#422e20',[[-11,3],[-5,3],[-8,6],[-12,6]],false);
        qPoly(g,'#422e20',[[-7,8],[-2,6],[-3,9],[-7,10]],false);
        qPoly(g,'#422e20',[[3,2],[10,3],[8,6],[4,5]],false);
      }
      qPoly(g,soldier ? '#4b4134' : '#953c32',[[-10,-3],[10,-3],[10,2],[-10,2]]);
      ellO(g,2,-0.5,3,3,'#d8ae55',1);
      qPoly(g,soldier ? '#899cab' : '#d7a64c',[[5,-tor-1],[12,-tor],[15,-tor+7],[5,-tor+6]]);
      qPoly(g,soldier ? '#d2ad62' : '#f1cb6a',[[5,-tor-1],[12,-tor],[14,-tor+2],[6,-tor+2]],false);
      if (monkey) {
        qPoly(g,'#b64035',[[-8,-tor-2],[8,-tor-2],[6,-tor+4],[-3,-tor+5],[-8,-tor+1]]);
        qPoly(g,'#d96645',[[1,-tor+1],[5,-tor+3],[2,-tor+14],[-1,-tor+10]],false);
      }
    }
    if(monkey&&(equipmentAtlas||equipmentStyle(gear&&gear.acc))&&equipped(gear&&gear.acc,'acc')){
      // 风火轮保持原饰品语义：腰侧小型风火环，跟随躯干，不改变走法。
      equipmentPart(g,'acc',-14,0,8.5,14,false,gear.acc);
    }
    g.restore();
    qArm(g,shF,elbF,handF,bull,false,soldier,gear);
    if (p.weapon && !p.weaponBehind) qWeapon(g,p.weapon,handF,p.wA || 0,p.staffOffset || 0,p.weaponItem);
    const headA=(p.headA || 0)+lean*0.55, neck=bull ? 7 : 12;
    g.save(); g.translate(sh[0]+Math.sin(headA)*neck,sh[1]-Math.cos(headA)*neck); g.rotate(headA*0.6);
    if (monkey) qMonkeyHead(g,p,time); else if (soldier) qSoldierHead(g,p,time); else qBullHead(g,p,true);
    g.restore();
    // 握棒的拳头压在棒身前，第三段后手继续跟随棒身。
    if (p.weapon && !p.weaponBehind) {
      if(monkey&&heroAtlas)heroFist(g,handF);
      else {g.save();g.translate(...handF);
        qPoly(g,bull ? '#a95136' : '#efbd85',[[-3,-3],[2,-3],[3,0],[2,3],[-3,2]]);g.restore();}
    }
    if (p.gripBlend > 0) qArm(g,shB,elbB,handB,bull,true,soldier,gear);
    g.restore();
  }

  /* ---- 天宫弓手：轻甲 / 羽冠 / 箭筒 / 三阶段拉弦 ---- */
  function qArcherHead(g, p, time) {
    if(archerBullAtlas){archerBullPart(g,'archerHead',-30,-40,58,53);return;}
    // 额头与眼睛保持裸露，轻盔、羽冠区别于重甲天兵。
    g.beginPath(); g.moveTo(-10,-11); g.quadraticCurveTo(1,-16,11,-8);
    g.lineTo(12,-1); g.lineTo(15,2); g.quadraticCurveTo(14,9,6,12);
    g.quadraticCurveTo(-7,10,-11,3); g.closePath(); qPaint(g,'#edc397');
    qPoly(g,'#ca916c',[[11,-7],[12,-1],[15,2],[13,8],[6,12],[1,9],[9,6]],false);
    ellO(g,-10,-1,3.5,4.5,'#e5b187',1);
    g.strokeStyle='#a77051'; g.lineWidth=0.9;
    g.beginPath(); g.moveTo(-11,-2); g.quadraticCurveTo(-7,-3,-9,1); g.stroke();
    qPoly(g,'#313c3d',[[-13,-9],[-8,-16],[2,-18],[10,-12],[11,-7],[6,-9],[-3,-7],[-5,6],[-9,5],[-10,1]]);
    g.beginPath(); g.moveTo(-13,-7); g.lineTo(-14,-13);
    g.quadraticCurveTo(-10,-25,1,-23); g.quadraticCurveTo(10,-23,13,-13);
    g.lineTo(12,-8); g.lineTo(6,-11); g.lineTo(-2,-10); g.lineTo(-6,-4);
    g.lineTo(-12,-2); g.closePath(); qPaint(g,'#466a70');
    qPoly(g,'#29494f',[[-13,-12],[-7,-19],[-5,-8],[-6,-4],[-12,-2]],false);
    qPoly(g,'#799398',[[-7,-21],[0,-23],[6,-20],[8,-14],[2,-16]],false);
    g.strokeStyle='#ddb76a'; g.lineWidth=1.65;
    g.beginPath(); g.moveTo(-12,-4); g.lineTo(-6,-6); g.lineTo(-2,-11); g.lineTo(6,-12); g.lineTo(12,-9); g.stroke();
    // 两片后掠的羽翎：外轮廓集中，不用细碎装饰撑大头像。
    g.beginPath(); g.moveTo(-3,-21); g.quadraticCurveTo(-8,-34,-23,-34);
    g.quadraticCurveTo(-20,-23,-6,-21); g.closePath(); qPaint(g,'#dbe4cf');
    qPoly(g,'#89a9a0',[[-4,-22],[-23,-34],[-17,-27],[-9,-24]],false);
    g.beginPath(); g.moveTo(-1,-22); g.quadraticCurveTo(-1,-32,-11,-39);
    g.quadraticCurveTo(-15,-28,-4,-22); g.closePath(); qPaint(g,'#f0dfb0');
    g.strokeStyle='#b5985e'; g.lineWidth=0.8;
    g.beginPath(); g.moveTo(-3,-23); g.lineTo(-10,-36); g.stroke();
    ellO(g,-3,-22,2.5,2.5,'#d5ad5d',0.9);
    const blink = time % 3.7 < 0.12;
    if (!blink) {
      qPoly(g,'#fff1d5',[[-2,-3],[2,-2],[2,1],[-1,1]],false);
      qPoly(g,'#fff1d5',[[6,-4],[12,-2],[11,1],[7,1]],false);
      ell(g,1,-0.5,1,1.5,'#303f38'); ell(g,10,-0.5,1.3,1.7,'#303f38');
      ell(g,9.7,-1.1,0.4,0.5,'#fff');
    }
    g.strokeStyle='#3a3b30'; g.lineWidth=1.4;
    g.beginPath(); g.moveTo(-3,-4.5); g.lineTo(2,-3); g.moveTo(6,-5); g.lineTo(12,-3); g.stroke();
    if (blink) { g.lineWidth=1; g.beginPath(); g.moveTo(-2,0); g.lineTo(2,0); g.moveTo(7,0); g.lineTo(11,0); g.stroke(); }
    g.strokeStyle='#986448'; g.lineWidth=0.9;
    g.beginPath(); g.moveTo(7,7); g.quadraticCurveTo(10,7.5,12,6); g.stroke();
  }
  function qArcherArm(g, shoulder, hand, back) {
    // 两节等长手臂，握弓、拉弦手都由明确的目标点解算。
    const dx=hand[0]-shoulder[0],dy=hand[1]-shoulder[1],len=Math.max(0.1,Math.hypot(dx,dy));
    const bend=Math.sqrt(Math.max(0,144-len*len/4)),side=back ? 1 : -1;
    const elbow=[(shoulder[0]+hand[0])/2-side*dy/len*bend,(shoulder[1]+hand[1])/2+side*dx/len*bend];
    qSegment(g,shoulder,elbow,8,6.5,back ? '#2d5154' : '#41696a','#234346');
    qSegment(g,elbow,hand,6.5,5.5,back ? '#8d7150' : '#ac8d5d','#735b43');
    g.save(); g.translate(...hand);
    qPoly(g,'#ecc194',[[-3,-2.6],[2.5,-3],[3.3,0],[2,3],[-2.5,3],[-3.5,0]]);
    g.strokeStyle='#a5714d'; g.lineWidth=0.8;
    g.beginPath(); g.moveTo(-0.5,0); g.lineTo(2,0.7); g.stroke(); g.restore();
  }
  function qArcherLeg(g, hip, angles, back) {
    const knee=seg(...hip,angles[0],12),foot=seg(...knee,angles[1],12);
    qSegment(g,hip,knee,10,7.5,back ? '#254649' : '#356166','#213d40');
    qSegment(g,knee,foot,7.5,6,back ? '#254649' : '#356166','#213d40');
    qBoot(g,foot,angles[1],false,back);
  }
  function qArcherBow(g, hand, angle, pull, arrow) {
    g.save(); g.translate(...hand); g.rotate(angle);
    // 反曲弓的金色弓梢、木胎与绿色握柄各有独立块面。
    g.beginPath(); g.moveTo(2,-29); g.quadraticCurveTo(9,-30,10,-21);
    g.quadraticCurveTo(10,-10,0,-3); g.lineTo(0,3);
    g.quadraticCurveTo(10,10,10,21); g.quadraticCurveTo(9,30,2,29);
    g.lineCap='round'; g.lineJoin='round'; g.strokeStyle=Q_INK; g.lineWidth=5.5; g.stroke();
    g.strokeStyle='#b17b48'; g.lineWidth=3.2; g.stroke();
    g.strokeStyle='#e6bf6f'; g.lineWidth=1.3;
    g.beginPath(); g.moveTo(3,-28); g.quadraticCurveTo(8,-29,9,-23);
    g.moveTo(9,23); g.quadraticCurveTo(8,29,3,28); g.stroke();
    g.strokeStyle='#345953'; g.lineWidth=4;
    g.beginPath(); g.moveTo(0,-3); g.lineTo(0,3); g.stroke();
    g.strokeStyle='#d7cfaa'; g.lineWidth=0.95;
    g.beginPath(); g.moveTo(2,-28); g.lineTo(2-pull,0); g.lineTo(2,28); g.stroke();
    if (arrow) {
      const notch=2-pull;
      g.strokeStyle=Q_INK; g.lineWidth=2.7;
      g.beginPath(); g.moveTo(notch,0); g.lineTo(notch+35,0); g.stroke();
      g.strokeStyle='#cfb77d'; g.lineWidth=1.2; g.stroke();
      qPoly(g,'#c3d5d4',[[notch+35,0],[notch+29,-2.4],[notch+30,0],[notch+29,2.4]]);
      qPoly(g,'#dbe3cd',[[notch,-0.2],[notch-4,-3.2],[notch+3,-2],[notch+6,-0.2]],false);
      qPoly(g,'#7f9e94',[[notch,0.2],[notch-4,3.2],[notch+3,2],[notch+6,0.2]],false);
    }
    g.restore();
  }
  // o = { x,y,f,s,pose,time,state,stateT,squash }; 与 qCharacter 相同的坐标约定。
  function qArcher(g, o) {
    const p=o.pose,f=o.f || 1,s=o.s || 1,time=o.time || 0,st=o.state || 'idle';
    const shoot=st === 'shoot',t=Math.max(0,o.stateT || 0),lean=p.lean || 0;
    const ease=(v)=>{ const k=U.clamp(v,0,1); return k*k*(3-2*k); };
    // AI 在 0.20 秒生成真正的箭。此处只控制举弓、拉弦和收势，不生成投射物。
    const raise=shoot ? (t < 0.2 ? ease(t/0.07) : 1-ease((t-0.27)/0.15)) : 0;
    const pull=shoot && t < 0.2 ? ease((t-0.07)/0.13)*25 : 0;
    const release=shoot && t >= 0.2 ? 1-ease((t-0.2)/0.1) : 0;
    g.save(); g.translate(o.x,o.y);
    if (p.lying || st === 'dead') { g.rotate(-f*Math.PI/2*0.94); g.translate(0,-10); }
    if (p.spin != null) { g.translate(0,-38); g.rotate(p.spin); g.translate(0,38); }
    if (o.squash) g.scale(1+0.1*o.squash,1-0.13*o.squash);
    g.scale(f*s,s);
    const hipY=-25+(p.dy || 0),tor=19,sh=[Math.sin(lean)*tor,hipY-Math.cos(lean)*tor];
    const shB=[sh[0]-2,sh[1]+4],shF=[sh[0]+6,sh[1]+4];
    const walk=st === 'walk' ? Math.sin(time*11)*1.4 : 0;
    const hurt=st === 'hurt' || st === 'getup' || o.hitstun ? 1 : 0;
    const bowHand=[sh[0]+17+raise*2-hurt*3,sh[1]+15-raise*10+walk];
    const bowAngle=-0.18*(1-raise)-hurt*0.3;
    const recover=ease((t-0.26)/0.16),nock=ease(t/0.05);
    const drawHand=shoot ? (t < 0.2
      ? [U.lerp(sh[0]-7,bowHand[0]+2-pull,nock),U.lerp(sh[1]+17,bowHand[1],nock)]
      : [sh[0]-4-3*recover-release*5,sh[1]+5+12*recover-release*1.5])
      : [sh[0]-7,sh[1]+17+walk*0.6];
    // 箭筒与绦带先画在背侧，肩上仍能看见羽尾。
    g.save(); g.translate(sh[0]-15,sh[1]+7); g.rotate(-0.19);
    for (let i=0;i<3;i++) {
      const ax=(i-1)*3.1,ay=-20-i%2*3;
      g.strokeStyle='#cbb483'; g.lineWidth=1.5;
      g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax,14); g.stroke();
      qPoly(g,i === 1 ? '#e4dfc1' : '#9eb8a6',[[ax,ay-4],[ax-3,ay-1],[ax-2,ay+4],[ax,ay+5],[ax+2,ay+2],[ax+3,ay-2]]);
    }
    g.beginPath(); g.moveTo(-6,-3); g.lineTo(6,-3); g.lineTo(4,25);
    g.quadraticCurveTo(0,29,-5,25); g.closePath(); qPaint(g,'#6c503a');
    qPoly(g,'#3e3930',[[-6,-3],[-2,-3],[-2,24],[-5,25]],false);
    qPoly(g,'#bc985b',[[-6,-3],[6,-3],[6,1],[-6,1]]);
    g.strokeStyle='#af8a53'; g.lineWidth=1;
    g.beginPath(); g.moveTo(-4,19); g.lineTo(4,19); g.stroke(); g.restore();
    const sash=Math.sin(time*3.6)*1.5+(st === 'walk' ? 3 : 0);
    g.beginPath(); g.moveTo(sh[0]-6,sh[1]); g.quadraticCurveTo(-20,sh[1]+6,-26-sash,hipY+2);
    g.lineTo(-20-sash,hipY+2); g.lineTo(-17-sash,hipY+7);
    g.quadraticCurveTo(-14,sh[1]+13,sh[0]+1,sh[1]+5); g.closePath(); qPaint(g,'#3a7e69');
    qPoly(g,'#64a487',[[sh[0]-6,sh[1]],[-22-sash,hipY-2],[-19-sash,hipY+2],[sh[0]-1,sh[1]+4]],false);
    qArcherLeg(g,[-4.5,hipY],p.legB || [0,0],true);
    qArcherLeg(g,[4.5,hipY],p.legF || [0,0],false);
    g.save(); g.translate(0,hipY); g.rotate(lean);
    g.beginPath(); g.moveTo(-9,-tor); g.quadraticCurveTo(0,-tor-2,11,-tor);
    g.lineTo(12,-9); g.lineTo(8,3); g.lineTo(-8,3); g.lineTo(-11,-10); g.closePath(); qPaint(g,'#3f6366');
    qPoly(g,'#29464b',[[-9,-tor],[-3,-tor],[-2,2],[-8,3],[-11,-10]],false);
    qPoly(g,'#688788',[[0,-tor+1],[8,-tor+1],[8,-12],[1,-10]],false);
    // 胸甲上的三行宽鳞片与斜挎带，保持小尺寸可读。
    g.strokeStyle='#223d41'; g.lineWidth=0.95;
    for (const yy of [-11,-7]) { g.beginPath(); g.moveTo(-6,yy); g.lineTo(8,yy); g.stroke(); }
    g.beginPath(); g.moveTo(-1,-14); g.lineTo(-1,-4); g.moveTo(4,-14); g.lineTo(4,-4); g.stroke();
    qPoly(g,'#af8550',[[-9,-tor],[-5,-tor+1],[7,-2],[4,0]]);
    qPoly(g,'#436465',[[-9,0],[-1,0],[-2,11],[-12,8]]);
    qPoly(g,'#587b78',[[1,0],[9,0],[12,8],[2,11]]);
    g.strokeStyle='#bd9f61'; g.lineWidth=1.2;
    g.beginPath(); g.moveTo(-12,8); g.lineTo(-2,11); g.moveTo(2,11); g.lineTo(12,8); g.stroke();
    qPoly(g,'#326a5b',[[-10,-3],[10,-3],[10,2],[-10,2]]);
    ellO(g,1,-0.5,2.8,2.8,'#d6ad5b',1);
    qPoly(g,'#7d9994',[[6,-tor-1],[12,-tor],[14,-tor+5],[6,-tor+5]]);
    qPoly(g,'#d3b26f',[[6,-tor-1],[12,-tor],[13,-tor+1],[7,-tor+1]],false);
    if(archerBullAtlas)archerBullPart(g,'archerChest',-16,-23,32,31);
    g.restore();
    // 拉弦臂压在胸甲前，蓄满时后手仍清楚可见。
    qArcherArm(g,shB,drawHand,true);
    qArcherArm(g,shF,bowHand,false);
    qArcherBow(g,bowHand,bowAngle,pull,shoot && t >= 0.03 && t < 0.2);
    // 头部最后画，斜弦和后手始终不会遮住眼睛、眉毛与嘴。
    const ha=(p.headA || 0)+lean*0.4;
    g.save(); g.translate(sh[0]+Math.sin(ha)*11,sh[1]-Math.cos(ha)*11); g.rotate(ha*0.5);
    qArcherHead(g,p,time); g.restore();
    // 握弓手重新压在握柄上，弓身不会穿过拳头。
    g.save(); g.translate(...bowHand);
    qPoly(g,'#ecc194',[[-3,-2.6],[2.5,-3],[3.3,0],[2,3],[-2.5,3],[-3.5,0]]); g.restore();
    g.restore();
  }

  /* ---- 巨灵神：狮盔重甲、宽肩与双刃宣花斧 ---- */
  function qJulingHead(g, angry, t) {
    if(enemyAtlas){enemyPart(g,'julingHead',-27,-37,52,57);return;}
    const face=g.createLinearGradient(-13,-12,15,16);face.addColorStop(0,'#f4cd99');face.addColorStop(.55,'#dca978');face.addColorStop(1,'#ae7250');
    g.beginPath(); g.moveTo(-13,-10); g.quadraticCurveTo(0,-17,14,-9);
    g.lineTo(17,5); g.quadraticCurveTo(12,17,1,17);
    g.lineTo(-12,12); g.quadraticCurveTo(-18,3,-13,-10); g.closePath(); qPaint(g,face);
    qPoly(g,'#ba7a53',[[11,-8],[16,-4],[17,5],[10,14],[1,17],[3,10],[11,7]],false);
    qPoly(g,'#334b58',[[-17,-3],[-18,-13],[-12,-24],[-2,-27],[10,-24],[17,-16],[19,-6],[11,-7],[4,-12],[-5,-9],[-9,5],[-15,6]]);
    qPoly(g,'#d3a54f',[[-17,-13],[-12,-24],[-2,-27],[0,-23],[-8,-18],[-12,-8],[-9,5],[-15,6]]);
    qPoly(g,'#f1cc70',[[-12,-24],[-2,-27],[0,-23],[-8,-18]],false);
    qPoly(g,'#d1a148',[[0,-24],[6,-22],[11,-13],[5,-10],[0,-13],[-3,-19]]);
    ellO(g,4,-17,3,3.6,'#6a9b98',0.8);
    qPoly(g,'#c89a47',[[-18,-12],[-24,-17],[-23,-7],[-16,-2]]);
    qPoly(g,'#edc368',[[15,-15],[22,-16],[21,-7],[17,-4]]);
    qPoly(g,'#973f35',[[-9,-25],[-12,-35],[-4,-32],[2,-35],[8,-29],[5,-24]]);
    qPoly(g,'#ce6550',[[-11,-32],[-4,-30],[1,-32],[5,-28],[-2,-27]],false);
    const blink = !angry && t % 4.1 < 0.1;
    if (!blink) {
      qPoly(g,'#fff0cf',[[-7,-2],[0,-0.5],[-1,3],[-6,2]],false);
      qPoly(g,'#fff0cf',[[5,-2],[13,-0.5],[11,3],[6,3]],false);
      ell(g,-1,1,1.2,1.8,angry ? '#9a3428' : '#342b24');
      ell(g,10,1,1.4,1.8,angry ? '#9a3428' : '#342b24');
    }
    g.strokeStyle='#392e28'; g.lineWidth=2.3; g.lineCap='round';
    g.beginPath(); g.moveTo(-9,-4); g.lineTo(0,-1.7); g.moveTo(5,-1.8); g.lineTo(14,-4); g.stroke();
    qPoly(g,'#edbd86',[[6,3],[12,4],[14,7],[8,8],[4,6]],false);
    g.strokeStyle='#915735'; g.lineWidth=1;
    g.beginPath(); g.moveTo(7,8); g.lineTo(12,8); g.stroke();
    qPoly(g,'#3b352c',[[-8,8],[-11,15],[-5,24],[2,21],[7,24],[13,14],[9,8],[3,11]]);
    qPoly(g,'#615142',[[-7,13],[-5,19],[-1,18],[1,13]],false);
    g.strokeStyle='#332c25'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(6,9); g.quadraticCurveTo(-3,6,-8,10);
    g.moveTo(7,9); g.quadraticCurveTo(13,7,16,10); g.stroke();
    g.strokeStyle='#d7986b'; g.lineWidth=1;
    g.beginPath(); g.moveTo(3,13); g.lineTo(9,13); g.stroke();
  }
  function qJulingAxe(g, hand, angle) {
    g.save(); g.translate(...hand); g.rotate(-angle);
    qPoly(g,'#72432d',[[-2.7,-50],[2.7,-50],[2.7,23],[-2.7,23]]);
    qPoly(g,'#b47743',[[-1.8,-45],[-0.6,-45],[-0.6,19],[-1.8,19]],false);
    for (const y of [-27,6,19]) qPoly(g,'#cda552',[[-4,y],[4,y],[4,y+4],[-4,y+4]]);
    // 外刃为青铜，内圈留深色厚度；斧头随手柄旋转，双手不会脱开。
    // v84：原冷白钢色读作半透明水晶，改青铜+黄铜刃口与铠甲同语言。
    g.beginPath(); g.moveTo(-3,-50); g.lineTo(-15,-56); g.lineTo(-27,-52);
    g.quadraticCurveTo(-32,-38,-22,-27); g.lineTo(-12,-30); g.lineTo(-4,-36);
    g.lineTo(4,-36); g.lineTo(13,-29); g.lineTo(25,-25);
    const steel=g.createLinearGradient(-28,-55,30,-28);steel.addColorStop(0,'#e8d296');steel.addColorStop(.36,'#c99f4d');steel.addColorStop(.65,'#8a6a33');steel.addColorStop(1,'#e3c276');
    g.quadraticCurveTo(36,-39,28,-55); g.lineTo(15,-59); g.lineTo(3,-50); g.closePath(); qPaint(g,steel);
    qPoly(g,'#f0dfae',[[-27,-52],[-31,-39],[-22,-27],[-18,-32],[-22,-42],[-21,-53]],false);
    qPoly(g,'#f0dfae',[[28,-55],[34,-40],[25,-25],[20,-31],[25,-42],[22,-55]],false);
    qPoly(g,'#7a5c2e',[[-15,-49],[-8,-44],[-4,-36],[-12,-30],[-18,-35],[-20,-44]],false);
    qPoly(g,'#7a5c2e',[[8,-45],[16,-50],[23,-46],[21,-35],[13,-29],[4,-36]],false);
    qPoly(g,'#cba052',[[-6,-49],[0,-54],[6,-49],[6,-35],[0,-30],[-6,-35]]);
    ellO(g,0,-43,3,3,'#7a5c2e',0.8);
    g.strokeStyle='#8a6a33'; g.lineWidth=1.1;
    g.beginPath(); g.moveTo(-14,-42); g.quadraticCurveTo(-23,-47,-18,-36);
    g.moveTo(15,-42); g.quadraticCurveTo(24,-48,19,-35); g.stroke();
    g.strokeStyle='#ffefc0';g.lineWidth=.75;
    g.beginPath();g.moveTo(-25,-49);g.quadraticCurveTo(-27,-40,-22,-32);g.moveTo(27,-51);g.quadraticCurveTo(30,-39,25,-30);g.stroke();
    g.restore();
  }
  function qJulingArm(g, shoulder, hand, back) {
    const dx=hand[0]-shoulder[0], dy=hand[1]-shoulder[1], len=Math.max(0.01,Math.hypot(dx,dy));
    const bend=Math.sqrt(Math.max(0,23*23-len*len/4));
    const elbow=[(shoulder[0]+hand[0])/2-dy/len*bend,(shoulder[1]+hand[1])/2+dx/len*bend];
    qSegment(g,shoulder,elbow,15,12,back ? '#485966' : '#71858b','#344753',back ? '#6f8990' : '#bbccc3');
    qSegment(g,elbow,hand,13,10,back ? '#9a793e' : '#d0a452','#725b37',back ? '#c6a35c' : '#f3d78e');
    g.save(); g.translate(...hand);
    qPoly(g,back ? '#b98259' : '#e0ac79',[[-5,-4],[4,-4],[6,-1],[5,4],[-3,5],[-6,1]]);
    g.strokeStyle='#9c6843'; g.lineWidth=0.9;
    g.beginPath(); g.moveTo(0,-1); g.lineTo(3,0); g.stroke(); g.restore();
  }
  function qJulingLeg(g, hip, foot, back) {
    const knee=[(hip[0]+foot[0])/2+(back ? -3 : 3),(hip[1]+foot[1])/2];
    qSegment(g,hip,knee,17,13,back ? '#663d35' : '#8d493b','#513631');
    qSegment(g,knee,foot,14,11,back ? '#3d505d' : '#597380','#2b414c',back ? '#69838a' : '#a4b9b6');
    g.save(); g.translate(...knee);
    qPoly(g,back ? '#9d793d' : '#d1a453',[[-7,-4],[6,-4],[8,3],[0,8],[-7,4]]);
    qPoly(g,'#ecd083',[[-5,-3],[4,-3],[3,0],[-5,0]],false); g.restore();
    g.save(); g.translate(...foot); g.scale(1.45,1.15); qBoot(g,[0,0],0,false,back,false,true); g.restore();
  }
  function qJulingTrialPose(e,t) {
    const guard={lean:0,dy:0,hand:[38,-27],angle:-.15,grip:0,footF:[17,-2],footB:[-16,-2]};
    const smooth=v=>{v=U.clamp(v,0,1);return v*v*(3-2*v);};
    const mix=(a,b,k)=>({
      lean:U.lerp(a.lean,b.lean,k),dy:U.lerp(a.dy,b.dy,k),angle:U.lerp(a.angle,b.angle,k),grip:U.lerp(a.grip,b.grip,k),
      hand:[U.lerp(a.hand[0],b.hand[0],k),U.lerp(a.hand[1],b.hand[1],k)],
      footF:[U.lerp(a.footF[0],b.footF[0],k),U.lerp(a.footF[1],b.footF[1],k)],
      footB:[U.lerp(a.footB[0],b.footB[0],k),U.lerp(a.footB[1],b.footB[1],k)],
    });
    const pat=e.pat,stage=pat && pat.trial && pat.stage,local=pat ? pat.stageT || 0 : 0;
    let p=mix(guard,guard,0);
    if(stage) {
      const name=e.state==='recover' ? e.recoverPat || pat.n : pat.n,slam=name==='slam',charge=name==='charge';
      const ready=charge
        ? {lean:-.14,dy:3,hand:[26,-41],angle:-.65,grip:1,footF:[21,-2],footB:[-19,-2]}
        : {lean:-.12,dy:2,hand:[14,slam ? -87 : -81],angle:slam ? -.3 : -.95,grip:1,footF:[20,-2],footB:[-18,-2]};
      const impact=charge
        ? {lean:.3,dy:2,hand:[38,-40],angle:-.78,grip:1,footF:[22,-2],footB:[-18,-2]}
        : {lean:slam ? .3 : .25,dy:slam ? 5 : 4,hand:slam ? [20,-64] : [38,-44],angle:slam ? -2.95 : -2.2,grip:1,footF:[23,-2],footB:[-19,-2]};
      const end=charge ? impact : {
        lean:slam ? .27 : .2,dy:slam ? 5 : 3,hand:slam ? [23,-65] : [36,-39],
        angle:slam ? -2.85 : -2.12,grip:1,footF:[22,-2],footB:[-18,-2],
      };
      if(stage==='tele') {
        // 连击下一棍从上一棍末态再举斧；不在阶段切换时瞬间回到站姿。
        p=mix(name==='combo' && pat.step>0 ? end : guard,ready,smooth(local/pat.windup));
      } else if(stage==='atk' && charge) {
        p=mix(ready,impact,smooth(local/.1));
        const stride=Math.sin(t*9),steps=smooth(local/.1)*(1-smooth((local-(pat.activeDur-.12))/.12));
        p.footF=[p.footF[0]+stride*10*steps,-2-Math.max(0,stride)*5*steps];
        p.footB=[p.footB[0]-stride*10*steps,-2-Math.max(0,-stride)*5*steps];
        p.dy-=Math.abs(Math.cos(t*9))*steps;
      } else if(stage==='atk') {
        const hitTime=pat.hitTime || .08,settle=pat.activeDur*.6;
        p=local<=hitTime ? mix(ready,impact,smooth(local/hitTime))
          : mix(impact,end,smooth((local-settle)/(pat.activeDur-settle)));
      } else if(stage==='recover') {
        // 固定停身窗口先保留低斧与前倾，再收斧回架；全程仅绘制。
        const frac=U.clamp(local/pat.recoverDur,0,1);
        p=mix(end,guard,smooth((frac-.35)/.65));
        p.dy+=Math.sin(frac*Math.PI)*.8;
      }
    } else if(e.state==='intro') {
      p.hand=[38,U.lerp(-36,-27,smooth((e.stateT || 0)/.65))];
      p.angle=U.lerp(-.3,-.15,smooth((e.stateT || 0)/.65));
    } else if(e.state==='walk') {
      const stride=Math.sin(t*7.5);
      p.lean=.08;p.dy=-Math.abs(Math.cos(t*7.5));
      p.footF=[16+stride*11,-2-Math.max(0,stride)*5];p.footB=[-16-stride*11,-2-Math.max(0,-stride)*5];
      p.hand=[38,-27+stride];p.angle=-.15+stride*.025;
    } else p.dy=Math.sin(t*(e.phase>1 ? 3 : 2.1))*(e.phase>1 ? .8 : .55);
    p.angry=e.phase>1 || stage==='tele' || stage==='atk';
    if(e.hitstunT>0)p.lean-=.1;
    return p;
  }
  function qJulingPose(e,t) {
    if(e.level && e.level.combatQualityTrial===true)return qJulingTrialPose(e,t);
    const pose={lean:0,dy:0,hand:[38,-27],angle:-0.15,grip:false,footF:[17,-2],footB:[-16,-2],angry:e.phase>1};
    if (e.state==='walk') {
      const stride=Math.sin(t*7.5), charging=e.pat && e.pat.n==='charge' && e.pat.step>0;
      pose.lean=charging ? 0.32 : 0.08; pose.dy=-Math.abs(Math.cos(t*7.5));
      pose.footF=[16+stride*11,-2-Math.max(0,stride)*5];
      pose.footB=[-16-stride*11,-2-Math.max(0,-stride)*5];
      pose.hand=charging ? [39,-40] : [38,-27+stride]; pose.angle=charging ? -0.65 : -0.15+stride*0.025;
      pose.angry=charging || pose.angry;
    }
    if (e.pat && (e.pat.n==='combo' || e.pat.n==='slam')) {
      const slam=e.pat.n==='slam';
      // AI 会提前 0.05 秒递增 step；绘制仍按完整的动作周期收势。
      const cycle=Math.min(2,Math.max(0,Math.floor(e.pat.t/0.55)));
      const local=slam ? e.pat.t : e.pat.t-cycle*0.55;
      const wind=slam ? 0.5 : 0.32;
      const impact=slam ? 0.51 : 0.39;
      let k=U.clamp((local-wind)/(impact-wind),0,1); k=1-(1-k)*(1-k);
      const raised=U.clamp(local/wind,0,1);
      const ready=[U.lerp(38,14,raised),U.lerp(-27,slam ? -87 : -81,raised)];
      pose.hand=[U.lerp(ready[0],slam ? 35 : 39,k),U.lerp(ready[1],slam ? -59 : -44,k)];
      pose.angle=U.lerp(U.lerp(-0.15,slam ? -0.3 : -0.95,raised),slam ? -2.7 : -2.2,k);
      pose.lean=U.lerp(-0.08*raised,slam ? 0.30 : 0.25,k); pose.dy=U.lerp(2,4,k);
      pose.footF=[19+k*4,-2]; pose.footB=[-17-k*2,-2];
      pose.grip=U.clamp((raised-0.45)/0.35,0,1); pose.angry=true;
      // 过命中窗口后收斧回身，下一次蓄势从同一持斧姿态接上。
      const settle=U.clamp((local-(slam ? 0.68 : 0.46))/(slam ? 0.27 : cycle===2 ? 0.04 : 0.09),0,1);
      const recover=settle*settle*(3-2*settle);
      pose.hand=[U.lerp(pose.hand[0],38,recover),U.lerp(pose.hand[1],-27,recover)];
      pose.angle=U.lerp(pose.angle,-0.15,recover); pose.lean*=1-recover;
      pose.dy*=1-recover; pose.grip*=1-recover;
      pose.footF[0]=U.lerp(pose.footF[0],17,recover);
      pose.footB[0]=U.lerp(pose.footB[0],-16,recover);
    } else if (e.pat && e.pat.n==='charge' && e.pat.step===0) {
      const k=U.clamp(e.pat.t/0.4,0,1);
      pose.lean=-0.12; pose.dy=3; pose.hand=[37,-32-k*8]; pose.angle=-0.35-k*0.30;
      pose.footF=[21,-2]; pose.footB=[-19,-2]; pose.angry=true;
    } else if (e.state==='intro') {
      const k=U.clamp(e.stateT/0.65,0,1);
      pose.hand=[38,U.lerp(-36,-27,k)]; pose.angle=U.lerp(-0.30,-0.15,k); pose.angry=true;
    } else if (e.state==='tele' || e.state==='atk') {
      const strike=e.state==='atk'; pose.grip=true; pose.angry=true;
      pose.hand=strike ? [39,-44] : [14,-81]; pose.angle=strike ? -2.2 : -0.95;
    }
    if (e.hitstunT>0) pose.lean-=0.1;
    if (e.state==='idle' && !e.pat) pose.dy=Math.sin(t*2.1)*0.55;
    return pose;
  }
  function qJuling(g,e,t) {
    const p=qJulingPose(e,t), hipY=-27+p.dy, tor=29;
    const raging=e.level && e.level.combatQualityTrial===true && e.phase>1;
    const sh=[Math.sin(p.lean)*tor,hipY-Math.cos(p.lean)*tor];
    const shB=[sh[0]-19,sh[1]+5],shF=[sh[0]+23,sh[1]+5];
    const handF=[p.hand[0],p.hand[1]+p.dy];
    const grip=[handF[0]+Math.sin(p.angle)*13,handF[1]+Math.cos(p.angle)*13];
    const handB=[U.lerp(-25,grip[0],p.grip),U.lerp(hipY-2,grip[1],p.grip)];
    g.save(); g.translate(e.x,e.y);
    if (e.state==='down') {g.rotate(-(e.facing || 1)*Math.PI*0.47);g.translate(0,-12);}
    const sq=squashOf(e); if(sq)g.scale(1+sq*0.07,1-sq*0.09);
    g.scale((e.facing || 1)*1.16,1.16);
    // 背后红绶与裙片先画，让宽肩重甲成为主体剪影。
    const flutter=Math.sin(t*(raging ? 6 : 3))*(raging ? 3 : 2);
    qPoly(g,raging ? '#b94730' : '#853d34',[[sh[0]-13,sh[1]],[-33,hipY-10],[-37+flutter,hipY+13],[-20,hipY+7],[-11,hipY-1]]);
    qJulingLeg(g,[-12,hipY],p.footB,true); qJulingArm(g,shB,handB,true);
    qJulingLeg(g,[12,hipY],p.footF,false);
    g.save(); g.translate(0,hipY);g.rotate(p.lean);
    if(enemyAtlas)enemyPart(g,'julingTorso',-35,-35,71,60);
    else {
    qPoly(g,'#586f77',[[-19,-29],[-10,-33],[11,-33],[21,-28],[22,-8],[15,5],[-16,5],[-23,-10]]);
    qPoly(g,'#334b57',[[-19,-29],[-10,-33],[-7,-4],[-16,5],[-23,-10]],false);
    qPoly(g,'#cba253',[[-18,-28],[-9,-30],[0,-22],[11,-29],[20,-26],[19,-20],[1,-14],[-19,-20]]);
    qPoly(g,'#f0cb72',[[-17,-27],[-9,-28],[0,-20],[10,-27],[18,-25],[1,-17]],false);
    ellO(g,2,-13,7,7,'#c39949',1.1);
    qPoly(g,'#ead07d',[[-2,-17],[6,-18],[8,-13],[4,-8],[-1,-9],[-4,-13]],false);
    g.strokeStyle='#7f6236';g.lineWidth=1.1;
    g.beginPath();g.moveTo(-2,-14);g.lineTo(1,-12);g.moveTo(4,-12);g.lineTo(7,-14);g.moveTo(2,-12);g.lineTo(3,-9);g.stroke();
    qPoly(g,'#ad8041',[[-27,-31],[-15,-34],[-7,-28],[-9,-18],[-29,-19],[-34,-24]]);
    qPoly(g,'#edc66d',[[-27,-31],[-15,-34],[-7,-28],[-10,-26],[-26,-27]],false);
    qPoly(g,'#d4ab58',[[12,-30],[26,-31],[34,-25],[31,-17],[12,-18],[9,-24]]);
    qPoly(g,'#f2d588',[[13,-29],[26,-30],[32,-25],[25,-25],[12,-25]],false);
    for(const x of [-23,21]) {g.beginPath();g.arc(x,-24,3.3,0.3,5);g.strokeStyle='#805f32';g.lineWidth=1.1;g.stroke();}
    qPoly(g,'#6f3c32',[[-19,0],[18,0],[23,15],[14,16],[6,20],[-1,16],[-11,20],[-23,13]]);
    for(const [x,c] of [[-17,'#354c59'],[-5,'#5f7780'],[8,'#6c8388']]) {
      qPoly(g,c,[[x,3],[x+9,3],[x+11,15],[x+1,16]]);
      g.strokeStyle='#d3ac5d';g.lineWidth=1.2;g.beginPath();g.moveTo(x+1,14);g.lineTo(x+10,13);g.stroke();
    }
    qPoly(g,'#9c773e',[[-20,-2],[19,-2],[19,3],[-20,3]]);
    ellO(g,2,1,5,5,'#e0bb62',1.1);ell(g,2,1,1.8,2,'#63918e');
    }
    if(raging) {
      // 暖色只沿肩甲与甲缝跳动，保留脚下、斧刃和危险预警的对比。
      g.save();g.globalAlpha=.55+Math.sin(t*6)*.12;g.strokeStyle='#e3793d';g.lineWidth=1.5;
      g.beginPath();g.moveTo(-26,-25);g.lineTo(-18,-28);g.lineTo(-11,-25);
      g.moveTo(13,-25);g.lineTo(21,-28);g.lineTo(28,-24);g.moveTo(-8,-7);g.lineTo(2,-2);g.lineTo(12,-7);g.stroke();g.restore();
    }
    g.restore();
    qJulingArm(g,shF,handF,false);qJulingAxe(g,handF,p.angle);
    const headA=p.lean*0.45;
    g.save();g.translate(sh[0]+Math.sin(headA)*10,sh[1]-Math.cos(headA)*10);g.rotate(headA*0.5);
    qJulingHead(g,p.angry,t);g.restore();
    // 武器和拳头共享同一握点，双手只在重击时合拢。
    for(const hand of p.grip ? [handF,handB] : [handF]) {
      g.save();g.translate(...hand);qPoly(g,'#dda575',[[-4,-3],[4,-3],[5,0],[3,4],[-4,3]]);g.restore();
    }
    g.restore();
  }

  /* ---- 增长天王：南方宝剑天王，莲冠、蓝金鳞甲与云纹披风 ---- */
  function qZengPose(e,t) {
    const q={lean:0,dy:Math.sin(t*2.1)*.35,hand:[26,-32],angle:.3,grip:0,glow:0,battle:false,footF:[12,-1],footB:[-12,-1]};
    const mix=(target,k)=>{for(const key of Object.keys(target)){const a=q[key],b=target[key];q[key]=Array.isArray(b)?b.map((v,i)=>U.lerp(a[i],v,k)):U.lerp(a,b,k);}};
    const ease=(v)=>U.ease(U.clamp(v,0,1));
    if(e.state==='walk'&&!e.pat) {
      const stride=Math.sin(t*8),speed=U.clamp(Math.abs(e.vx||0)/(e.spd||75),0,1);
      q.lean=.08*speed;q.dy=-Math.abs(Math.cos(t*8))*speed*.6;
      q.footF=[12+stride*8*speed,-1-Math.max(0,stride)*4*speed];q.footB=[-12-stride*8*speed,-1-Math.max(0,-stride)*4*speed];
      q.hand=[26,-32+stride*speed];q.angle=.3-stride*.035*speed;
    }
    const pat=e.pat,T=pat&&Number.isFinite(pat.t)?pat.t:0;
    if(pat) {
      q.dy=0;q.battle=true;
      if(pat.n==='wave') {
        const ready={hand:[19,-48],angle:.05,lean:-.06,glow:.85};
        mix(ready,ease(T/.30));
        // 两次出力分别对齐真实 f0/f1 发射窗口，不能依赖每帧清零的 stateT。
        for(const [start,end] of [[.38,.56],[.65,.84]]) {
          const k=T<start?0:T<start+.07?ease((T-start)/.07):1-ease((T-(start+.09))/(end-start-.09));
          if(k>0)mix({hand:[29,-37],angle:1.58,lean:.12,glow:1},k);
        }
        if(T>.84)mix({hand:[26,-32],angle:.3,lean:0,glow:0},ease((T-.84)/.16));
      } else if(pat.n==='dash') {
        const ready={hand:[20,-35],angle:1.42,lean:.22,dy:3,footF:[17,-1],footB:[-16,-1],glow:.75};
        mix(ready,ease(T/.32));
        if(pat.step>0||T>.4)mix({hand:[30,-37],angle:1.53,lean:.40,dy:5,footF:[19,-2],footB:[-17,-4],glow:1},ease((T-.4)/.07));
        if(T>.77)mix({hand:[26,-32],angle:.3,lean:0,dy:0,footF:[12,-1],footB:[-12,-1],glow:0},ease((T-.77)/.08));
      } else if(pat.n==='combo') {
        // step 会在 .50 提前递增，完整蓄势/挥斩/收剑仍由连续 pat.t 驱动。
        const cycle=Math.min(2,Math.floor(T/.55)),local=T-cycle*.55;
        const raised=[{hand:[16,-55],angle:-.65},{hand:[11,-56],angle:-1.3},{hand:[7,-75],angle:0}][cycle];
        mix({...raised,lean:-.06,grip:cycle===2?1:0},ease(local/.28));
        mix({hand:cycle===2?[25,-34]:[30,-35],angle:cycle===0?1.7:cycle===1?1.3:2.15,lean:cycle===2?.21:.14,dy:2,glow:.35},ease((local-.32)/.045));
        if(local>.44)mix({hand:[26,-32],angle:.3,lean:0,dy:0,grip:0,glow:0},ease((local-.44)/(cycle===2?.06:.11)));
      } else if(pat.n==='rend') {
        // 合握升至冠前上方，后手仍在剑柄上，露出两眼与鼻口。
        mix({hand:[7,-75],angle:-.08,lean:-.06,grip:1,glow:1},ease(T/.44));
        mix({hand:[25,-34],angle:2.15,lean:.20,dy:3,glow:1},ease((T-.54)/.06));
        if(T>.76)mix({hand:[26,-32],angle:.3,lean:0,dy:0,grip:0,glow:0},ease((T-.76)/.29));
      }
    }
    if(e.hitstunT>0){q.lean-=.09;q.battle=true;}
    return q;
  }
  function qZengHead(g,battle,t) {
    if(zengAtlas){zengPart(g,battle?'battle':'neutral',-17,-29,30,32.6);return;}
    qPoly(g,'#35302e',[[-15,-8],[-17,-20],[-10,-29],[-2,-24],[6,-26],[13,-17],[14,-6]]);
    ellO(g,-11,-4,3.5,4.5,'#d3a278',1);
    g.beginPath();g.moveTo(-9,-13);g.quadraticCurveTo(3,-19,12,-11);g.lineTo(14,1);g.quadraticCurveTo(10,12,2,13);g.quadraticCurveTo(-10,10,-10,0);g.closePath();
    const skin=cachedGrad(g,'zeng-face',()=>{const c=g.createLinearGradient(-10,-13,14,12);c.addColorStop(0,'#f8d8ad');c.addColorStop(1,'#c58b67');return c;});qPaint(g,skin);
    qPoly(g,'#e7bd62',[[-13,-17],[-10,-25],[-4,-22],[-1,-29],[3,-24],[7,-28],[11,-19],[10,-14],[2,-18],[-7,-14]]);
    ellO(g,7,-21,2.2,3,'#ba4141',.8);ell(g,6.5,-22, .65,.8,'#ffe0b0');
    if(battle||t%4.8>.1){qPoly(g,'#fff4dc',[[-5,-3],[1,-2],[0,2],[-4,1]],false);qPoly(g,'#fff4dc',[[6,-3],[12,-4],[11,1],[7,2]],false);ell(g,0,0,1,1.5,'#302922');ell(g,10,-.5,1,1.5,'#302922');}
    g.strokeStyle='#392920';g.lineWidth=1.65;g.beginPath();g.moveTo(-6,-6);g.lineTo(1,-3);g.moveTo(6,-4);g.lineTo(12,-7);g.stroke();
    qPoly(g,'#ecbb8b',[[9,0],[14,2],[11,4],[8,3]],false);
    if(battle){ellO(g,8,7,3,2,'#6e3f31',.7);g.strokeStyle='#f6d7b2';g.lineWidth=.8;g.beginPath();g.moveTo(6,6);g.lineTo(10,6);g.stroke();}
    else{g.strokeStyle='#784d38';g.lineWidth=.9;g.beginPath();g.moveTo(4,7);g.quadraticCurveTo(8,8,11,6);g.stroke();}
  }
  function qZengArm(g,shoulder,hand,back) {
    const dx=hand[0]-shoulder[0],dy=hand[1]-shoulder[1],len=Math.max(.01,Math.hypot(dx,dy));
    const bend=Math.sqrt(Math.max(0,15*15-len*len/4));
    const elbow=[(shoulder[0]+hand[0])/2-dy/len*bend,(shoulder[1]+hand[1])/2+dx/len*bend];
    qSegment(g,shoulder,elbow,9,7,back?'#29496b':'#467398','#213c5b',back?'#64819a':'#8aa5b1');
    qSegment(g,elbow,hand,8,6,back?'#b88c45':'#d4a952','#76592f',back?'#d2b06c':'#f1d58d');
    g.save();g.translate(...elbow);ellO(g,0,1,2.1,2.7,back?'#416986':'#568da5',.7);g.restore();
  }
  function qZengFist(g,hand,back=false) {
    g.save();g.translate(...hand);qPoly(g,back?'#bf8e64':'#edc398',[[-3.5,-3],[2.5,-3],[4,0],[2.5,3.5],[-2.5,3],[-4,.5]]);
    g.strokeStyle='#a16e47';g.lineWidth=.7;g.beginPath();g.moveTo(0,-1);g.lineTo(2,0);g.stroke();g.restore();
  }
  function qZengLeg(g,hip,foot,back) {
    const knee=[(hip[0]+foot[0])/2+(back?-2:2),(hip[1]+foot[1])/2];
    qSegment(g,hip,knee,10,8,back?'#223b60':'#31517b','#1a304e');
    qSegment(g,knee,foot,8,6,back?'#294862':'#456b87','#243c54',back?'#6b8192':'#9bb5c0');
    g.save();g.translate(...knee);qPoly(g,back?'#ab8244':'#d9af61',[[-4,-3],[4,-3],[5,2],[0,5],[-4,2]]);g.restore();
    g.save();g.translate(...foot);g.beginPath();g.moveTo(-4,-6);g.lineTo(3,-7);g.lineTo(4,-3);g.quadraticCurveTo(10,-3,10,0);g.lineTo(7,2);g.lineTo(-5,2);g.closePath();qPaint(g,back?'#293c51':'#3d526a');
    g.strokeStyle=back?'#ae8b4b':'#e8c577';g.lineWidth=1.5;g.beginPath();g.moveTo(-4,-5);g.lineTo(3,-5);g.moveTo(-4,1);g.lineTo(8,1);g.stroke();g.restore();
  }
  function qZengSword(g,hand,angle,glow) {
    g.save();g.translate(...hand);g.rotate(angle);
    if(glow>0){g.save();g.globalAlpha*=glow*.22;g.strokeStyle='#9bd7ff';g.lineWidth=6;g.beginPath();g.moveTo(0,-7);g.lineTo(0,-44);g.stroke();g.restore();}
    qPoly(g,'#354c68',[[-2,-6],[2,-6],[2,9],[-2,9]]);for(const y of [0,4]){g.strokeStyle='#deb96c';g.lineWidth=.8;g.beginPath();g.moveTo(-2,y);g.lineTo(2,y-1);g.stroke();}
    ellO(g,0,10,2.6,2.6,'#dcb65c',.8);
    const steel=cachedGrad(g,'zeng-blade',()=>{const c=g.createLinearGradient(-3,0,3,0);c.addColorStop(0,'#e7f4ef');c.addColorStop(.47,'#b9d4db');c.addColorStop(.5,'#608b9e');c.addColorStop(1,'#a7cbd4');return c;});
    qPoly(g,steel,[[-3,-8],[-2.7,-36],[0,-45],[2.7,-36],[3,-8]]);
    g.strokeStyle='#f8f5d5';g.lineWidth=.8;g.beginPath();g.moveTo(-1.6,-10);g.lineTo(-1.5,-35);g.lineTo(0,-43);g.stroke();
    qPoly(g,'#e5ba5e',[[-7,-7],[-4,-11],[-1,-9],[1,-9],[4,-11],[7,-7],[4,-5],[-4,-5]]);ellO(g,0,-7,1.5,1.8,'#55a3b6',.6);
    g.restore();
  }
  function qZeng(g,e,t) {
    const p=qZengPose(e,t),hipY=-24+p.dy,sh=[Math.sin(p.lean)*25,hipY-Math.cos(p.lean)*25];
    const shB=[sh[0]-12,sh[1]+3],shF=[sh[0]+13,sh[1]+3],handF=[p.hand[0],p.hand[1]+p.dy];
    const grip=[handF[0]-Math.sin(p.angle)*8,handF[1]+Math.cos(p.angle)*8];
    const handB=[U.lerp(-17,grip[0],p.grip),U.lerp(hipY-6,grip[1],p.grip)];
    g.save();g.translate(e.x,e.y);if(e.state==='down'){g.rotate(-(e.facing||1)*Math.PI*.47);g.translate(0,-9);}
    const sq=squashOf(e);if(sq)g.scale(1+sq*.07,1-sq*.09);
    g.scale((e.pat&&e.pat.n==='dash'&&e.pat.dir||e.facing||1)*1.36,1.36);
    const flutter=Math.sin(t*4)*1.5,trail=U.clamp(Math.abs(e.vx||0)/520,0,1)*10;
    g.beginPath();g.moveTo(sh[0]-10,sh[1]-1);g.quadraticCurveTo(-28-trail,hipY-13,-30-trail+flutter,hipY+9);g.quadraticCurveTo(-22,hipY+16,-7,hipY+4);g.lineTo(sh[0]+1,sh[1]+4);g.closePath();qPaint(g,'#294f87');
    g.beginPath();g.moveTo(sh[0]-10,sh[1]+2);g.quadraticCurveTo(-23-trail,hipY-10,-26-trail+flutter,hipY+8);g.quadraticCurveTo(-22,hipY+11,-12,hipY+6);g.closePath();qPaint(g,'#ece2c9',false);
    g.strokeStyle='#d7b56a';g.lineWidth=1;g.beginPath();g.moveTo(-24-trail+flutter,hipY+6);g.quadraticCurveTo(-27-trail,hipY,-21-trail,hipY-2);g.quadraticCurveTo(-17-trail,hipY+1,-22-trail,hipY+2);g.stroke();
    qZengLeg(g,[-7,hipY],p.footB,true);qZengArm(g,shB,handB,true);qZengFist(g,handB,true);qZengLeg(g,[7,hipY],p.footF,false);
    g.save();g.translate(0,hipY);g.rotate(p.lean);
    if(zengAtlas){zengPart(g,'chest',-21,-28,42,34.7);zengPart(g,'waist',-17,-2,36,17);}
    else {
      qPoly(g,'#3d6790',[[-17,-25],[-7,-29],[11,-27],[19,-21],[17,-3],[9,3],[-13,3],[-18,-8]]);
      qPoly(g,'#233e64',[[-17,-25],[-8,-27],[-8,1],[-13,3],[-18,-8]],false);
      for(let y=-20;y<-2;y+=5)for(let x=-11;x<15;x+=6){g.beginPath();g.arc(x,y,2.5,0,Math.PI);g.strokeStyle='#7196ad';g.lineWidth=.7;g.stroke();}
      qPoly(g,'#d5ad5a',[[-21,-27],[-12,-30],[-6,-25],[-8,-17],[-22,-17],[-25,-21]]);qPoly(g,'#e5c577',[[11,-26],[21,-27],[25,-20],[19,-16],[10,-18]]);
      qPoly(g,'#eee6d1',[[-10,-27],[0,-22],[10,-27],[12,-24],[0,-19],[-12,-24]]);ellO(g,2,-13,4.5,4.5,'#d5ad5a',.8);
      qPoly(g,'#eee3c7',[[-17,-2],[17,-2],[18,2],[-18,2]]);ellO(g,2,0,3.5,3.5,'#dcba68',.8);ell(g,2,0,1.5,1.7,'#b84444');
      for(const x of [-15,-4,7]){qPoly(g,'#355d86',[[x,3],[x+10,3],[x+12,16],[x+2,18],[x-2,13]]);g.strokeStyle='#d4ae62';g.lineWidth=1.2;g.beginPath();g.moveTo(x,13);g.lineTo(x+3,16);g.lineTo(x+11,14);g.stroke();}
    }
    g.restore();
    qZengArm(g,shF,handF,false);qZengSword(g,handF,p.angle,p.glow);
    // v85 颈部填充：头转 22% 而躯干全量转，出招姿势领口脱开——立领色柱画在头之下
    qPoly(g,'#24406f',[[sh[0]-5,sh[1]-12],[sh[0]+5,sh[1]-12],[sh[0]+6,sh[1]+6],[sh[0]+4,sh[1]+12],[sh[0]-4,sh[1]+12],[sh[0]-6,sh[1]+6]]);
    g.strokeStyle='#d7b56a'; g.lineWidth=1;
    g.beginPath(); g.moveTo(sh[0]-4.5,sh[1]-10.5); g.lineTo(sh[0]+4.5,sh[1]-10.5); g.stroke();
    g.save();g.translate(sh[0]+Math.sin(p.lean*.4)*5,sh[1]-2);g.rotate(p.lean*.22);qZengHead(g,p.battle,t);g.restore();
    qZengFist(g,handF);if(p.grip>.01)qZengFist(g,handB,true);g.restore();
  }

  // 梯度缓存：同一 ctx + 同一 key 只创建一次（消除每帧分配）
  const gradMaps = new WeakMap();
  function cachedGrad(g, key, make) {
    let m = gradMaps.get(g);
    if (!m) { m = new Map(); gradMaps.set(g, m); }
    let gr = m.get(key);
    if (!gr) { gr = make(); m.set(key, gr); }
    return gr;
  }

  // 受击白闪缓冲：把实体画进离屏画布，再叠一层白色剪影
  const flashBufs = new Map();
  function flashBuf(key, w, h) {
    let b = flashBufs.get(key);
    if (!b || b.w < w || b.h < h) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w); cv.height = Math.ceil(h);
      b = { cv, ctx: cv.getContext('2d'), w: Math.ceil(w), h: Math.ceil(h) };
      flashBufs.set(key, b);
    }
    return b;
  }
  function flashWrap(g, e, bw, bh, drawFn, bottomPad = 0) {
    if (!(e.flashT > 0)) { drawFn(g); return; }
    const B = flashBuf(e.bid || e.type || 'p', bw, bh + bottomPad);
    const c = B.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, B.w, B.h);
    c.save();
    c.translate(B.w / 2 - e.x, B.h - bottomPad - e.y);
    drawFn(c);
    c.restore();
    // 正常绘制
    g.drawImage(B.cv, e.x - B.w / 2, e.y + bottomPad - B.h);
    // 白色剪影叠加
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#fff';
    c.fillRect(0, 0, B.w, B.h);
    c.globalCompositeOperation = 'source-over';
    g.save();
    g.globalAlpha = Math.min(1, e.flashT * 5);
    g.drawImage(B.cv, e.x - B.w / 2, e.y + bottomPad - B.h);
    g.restore();
  }

  function text(g, str, x, y, o = {}) {
    g.save();
    // o.font 可指定字体族（如楷体题字）；默认保持原微软雅黑
    g.font = `${o.bold ? 'bold ' : ''}${o.size || 14}px ${o.font || '"Microsoft YaHei"'}, sans-serif`;
    g.textAlign = o.align || 'center';
    g.textBaseline = o.base || 'middle';
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.strokeW || 3; g.lineJoin = 'round'; g.strokeText(str, x, y); }
    g.fillStyle = o.color || '#fff';
    g.fillText(str, x, y);
    g.restore();
  }

  /* ============ 通用人形骨架 ============
   * o = { x, y(脚底), f(朝向±1), s(缩放), pose, col, cfg }
   * pose = { dy, lean, headA, armF:[上,下], armB, legF, legB, wA(武器角), tail, glow, spin, lying }
   */
  function human(g, o) {
    const p = o.pose, col = o.col, s = o.s || 1, f = o.f || 1;
    const cfg = o.cfg || {};
    const sq = o.squash || 0;
    g.save();
    g.translate(o.x, o.y);
    if (p.lying) { g.rotate(-f * Math.PI / 2 * 0.94); g.translate(0, -10); }
    if (p.spin != null) { g.translate(0, -38); g.rotate(p.spin); g.translate(0, 38); }
    // 落地压扁/起跳拉伸（以脚底为轴）
    if (sq) g.scale((1 + 0.10 * sq), (1 - 0.13 * sq));
    g.scale(f * s, s);

    const dy = p.dy || 0;
    const hipY = -26 + dy;
    const lean = p.lean || 0;
    const hip = [0, hipY];
    const TOR = col.monkey ? 23 : 20;
    const sh = [hip[0] + Math.sin(lean) * TOR, hipY - Math.cos(lean) * TOR];

    // ---- 后侧肢体 ----
    const legB = p.legB || [0, 0], armB = p.armB || [0, 0];
    const hipB = [col.monkey ? -4 : -2.5, hipY], kneeB = seg(hipB[0], hipB[1], legB[0], 12), footB = seg(kneeB[0], kneeB[1], legB[1], 12);
    limb(g, [hipB, kneeB, footB], col.legShade, 7.5);
    limb(g, [kneeB, footB], col.boot || col.legShade, 8);
    const armF = p.armF || [0, 0];
    const shF = [sh[0] + (col.monkey ? 3 : 2), sh[1] + 3], elbF = seg(shF[0], shF[1], armF[0], 10), handF = seg(elbF[0], elbF[1], armF[1], 10);
    const shB = [sh[0] - 2, sh[1] + 3];
    let elbB = seg(shB[0], shB[1], armB[0], 10), handB = seg(elbB[0], elbB[1], armB[1], 10);
    if (p.gripBlend > 0) {
      // 后手沿棒身握住：随蓄势/收招渐入渐出，避免两只手脱离武器。
      const hx = handF[0] + Math.sin(p.wA) * p.grip, hy = handF[1] + Math.cos(p.wA) * p.grip;
      handB = [U.lerp(handB[0], hx, p.gripBlend), U.lerp(handB[1], hy, p.gripBlend)];
      const dx = handB[0] - shB[0], ddy = handB[1] - shB[1], len = Math.max(0.1, Math.hypot(dx, ddy));
      const bend = Math.sqrt(Math.max(0, 100 - len * len / 4));
      elbB = [(shB[0] + handB[0]) / 2 - ddy / len * bend, (shB[1] + handB[1]) / 2 + dx / len * bend];
    }
    limb(g, [shB, elbB, handB], col.armShade, 6.5);

    // ---- 尾巴（悟空） ----
    if (p.tail != null) {
      const wag = Math.sin((o.time || 0) * (col.monkey ? 3.2 : 4)) * (col.monkey ? 0.10 : 0.25) + p.tail + (o.motion ? o.motion.tail * 0.65 : 0);
      const tx = -3, ty = hipY + 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(-16, hipY + wag * 12, -13, hipY - 12 + wag * 16);
      g.strokeStyle = shade(col.tail || '#a5713d', 0.5); g.lineWidth = 7.4; g.stroke();
      g.strokeStyle = col.tail || '#a5713d'; g.lineWidth = 5; g.stroke();
      // 尾尖毛球
      ellO(g, -13, hipY - 12 + wag * 16, 3.6, 3.2, shade(col.tail || '#a5713d', 1.2), 1.2);
    }

    // ---- 披风 ----
    if (cfg.cape) {
      const wob = Math.sin((o.time || 0) * (col.monkey ? 3.2 : 6)) * (col.monkey ? 1.1 : 2) + (o.run && !o.motion ? Math.sin((o.time || 0) * 13) * 2.5 : 0);
      const lift = o.motion ? o.motion.cape : 0;
      const hemX = (col.monkey ? -20 : -14) - wob * 1.5 - lift * 15, hemY = hipY + 22 - lift * 14;
      g.beginPath();
      g.moveTo(sh[0] - 4, sh[1] - 2);
      g.quadraticCurveTo(-18 - wob - lift * 18, sh[1] + 18 - lift * 5, hemX, hemY);
      if (col.monkey) g.lineTo(hemX + 7, hemY - 3);
      g.lineTo(-2, hipY + 16);
      g.quadraticCurveTo(-4, sh[1] + 12, sh[0] - 1, sh[1] + 3);
      g.closePath();
      g.fillStyle = cfg.cape; g.fill();
      g.strokeStyle = shade(cfg.cape, 0.5); g.lineWidth = 2; g.stroke();
      // 内衬高光
      g.strokeStyle = shade(cfg.cape, 1.35); g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(sh[0] - 3, sh[1] + 1);
      g.quadraticCurveTo(-13 - wob - lift * 13, sh[1] + 15 - lift * 4, col.monkey ? hemX + 5 : -10 - wob, col.monkey ? hemY - 5 : hipY + 18);
      g.stroke();
    }

    // ---- 龟壳（龟丞相） ----
    if (cfg.shell) {
      ellO(g, -2, sh[1] + 8, 17, 15, '#6a4a2a', 2);
      ellO(g, -2, sh[1] + 6, 13, 11, '#8a6a3a', 1.4);
      g.strokeStyle = '#5a3f22'; g.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(i * 8, sh[1] - 2); g.lineTo(i * 8, sh[1] + 16); g.stroke();
      }
      // 六角纹
      g.strokeStyle = shade('#8a6a3a', 0.7); g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(-2, sh[1] + 6, 6, 5, 0, 0, TAU); g.stroke();
    }

    // ---- 躯干（渐变+描边） ----
    g.save();
    g.translate(hip[0], hip[1]); g.rotate(lean);
    const bodyG = cachedGrad(g, 'tor_' + col.cloth, () => {
      const gr = g.createLinearGradient(0, -TOR, 0, 4);
      gr.addColorStop(0, shade(col.cloth, 1.22));
      gr.addColorStop(0.55, col.cloth);
      gr.addColorStop(1, shade(col.cloth, 0.82));
      return gr;
    });
    const bodyW = col.monkey ? 10 : 8.5;
    rr(g, -bodyW, -TOR, bodyW * 2, TOR + 4, 6);
    g.fillStyle = bodyG; g.fill();
    g.strokeStyle = shade(col.cloth, 0.45); g.lineWidth = 2; g.stroke();
    // 胸口高光
    g.fillStyle = 'rgba(255,255,255,0.14)';
    rr(g, -5.5, -TOR + 3, 5, TOR * 0.55, 2.5); g.fill();
    // 腰带+扣
    rrF(g, -9, -6, 18, 5.5, 2, col.belt || '#f5c542', 1.5);
    g.fillStyle = shade(col.belt || '#f5c542', 0.7);
    g.fillRect(-2.2, -5.4, 4.4, 4.2);
    // 护肩
    if (cfg.pads || cfg.padsBig) {
      const pr = cfg.padsBig ? 1.35 : 1;
      ellO(g, -5.5, -TOR + 2, 5.5 * pr, 4.5 * pr, col.pad || '#c8d4e0', 1.5);
      ellO(g, 5.5, -TOR + 2, 5.5 * pr, 4.5 * pr, col.pad || '#c8d4e0', 1.5);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(-6, -TOR + 1, 3 * pr, 1.6 * pr, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(5, -TOR + 1, 3 * pr, 1.6 * pr, 0, 0, TAU); g.fill();
    }
    // 甲裙（天兵/天将）
    if (cfg.armorSkirt) {
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * 6 - 4.5, -1);
        g.lineTo(i * 6 + 4.5, -1);
        g.lineTo(i * 6.6 + 5, 8);
        g.lineTo(i * 6.6 - 5, 8);
        g.closePath();
        g.fillStyle = shade(col.cloth, 0.88); g.fill();
        g.strokeStyle = shade(col.cloth, 0.45); g.lineWidth = 1.4; g.stroke();
      }
    }
    g.restore();

    // ---- 裙摆 ----
    if (cfg.skirt === 'tiger') {
      g.beginPath();
      g.moveTo(-9, hipY + 1);
      g.lineTo(9, hipY + 1);
      g.lineTo(12, hipY + 12);
      g.lineTo(-12, hipY + 12);
      g.closePath();
      const skG = g.createLinearGradient(0, hipY, 0, hipY + 12);
      skG.addColorStop(0, '#f6cf62'); skG.addColorStop(1, '#d9a53a');
      g.fillStyle = skG; g.fill();
      g.strokeStyle = '#5a4118'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * 7, hipY + 2.5);
        g.lineTo(i * 8 - 2, hipY + 11);
        g.stroke();
      }
    } else if (cfg.skirt === 'robe') {
      g.beginPath();
      g.moveTo(-9, hipY);
      g.lineTo(9, hipY);
      g.lineTo(14, 2);
      g.lineTo(-14, 2);
      g.closePath();
      const rbG = cachedGrad(g, 'rob_' + (col.robe || '#7b5bd6'), () => {
        const gr = g.createLinearGradient(0, hipY, 0, 2);
        gr.addColorStop(0, shade(col.robe || '#7b5bd6', 1.18));
        gr.addColorStop(1, shade(col.robe || '#7b5bd6', 0.85));
        return gr;
      });
      g.fillStyle = rbG; g.fill();
      g.strokeStyle = shade(col.robe || '#7b5bd6', 0.45); g.lineWidth = 1.8; g.stroke();
      rrF(g, -13, -2, 26, 3.5, 1.5, col.robe2 || '#f5c542', 1.2);
    }

    // ---- 前腿 ----
    const legF = p.legF || [0, 0];
    const hipF = [col.monkey ? 4 : 2.5, hipY], kneeF = seg(hipF[0], hipF[1], legF[0], 12), footF = seg(kneeF[0], kneeF[1], legF[1], 12);
    limb(g, [hipF, kneeF, footF], col.leg, 7.5);
    limb(g, [kneeF, footF], col.boot, 8);
    // 靴口 + 鞋底
    ellO(g, footF[0], footF[1] - 3, 4, 2.5, col.bootTrim || '#f5c542', 1.2);
    g.strokeStyle = shade(col.boot, 0.6); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(footF[0] - 3.5, footF[1] + 0.5); g.lineTo(footF[0] + 4, footF[1] + 0.5); g.stroke();

    // ---- 头 ----
    const headA = (p.headA || 0) + lean * 0.55;
    const HR = col.headR || 12;
    const HJ = HR + 2.5;
    const hc = [sh[0] + Math.sin(headA) * HJ, sh[1] - Math.cos(headA) * HJ];
    g.save();
    g.translate(hc[0], hc[1]); g.rotate(headA * 0.6);
    drawHead(g, col, cfg, p, o.time || 0, HR);
    // 虾兵触须
    if (cfg.antennae) {
      g.strokeStyle = '#e86a6a'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(2, -HR + 2); g.quadraticCurveTo(14, -HR - 4, 22, -HR - 1); g.stroke();
      g.beginPath(); g.moveTo(4, -HR + 4); g.quadraticCurveTo(16, -HR + 1, 24, -HR + 5); g.stroke();
    }
    // 牛魔王牛头（角+耳+吻部）
    if (cfg.bull) {
      ellO(g, -HR - 1, -HR * 0.55, 3.2, 2.6, '#c8c0b0', 1);
      ellO(g, HR + 1, -HR * 0.55, 3.2, 2.6, '#c8c0b0', 1);
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-HR * 0.75, -HR * 0.8); g.quadraticCurveTo(-HR * 1.3, -HR * 1.25, -HR * 0.72, -HR * 1.55); g.stroke();
      g.beginPath(); g.moveTo(HR * 0.75, -HR * 0.8); g.quadraticCurveTo(HR * 1.3, -HR * 1.25, HR * 0.72, -HR * 1.55); g.stroke();
      ellO(g, 3.5, HR * 0.42, 6.2, 4.4, '#d8b898', 1.2);
      ell(g, 1.6, HR * 0.42, 0.9, 1.3, '#6a4a3a');
      ell(g, 5.6, HR * 0.42, 0.9, 1.3, '#6a4a3a');
      g.fillStyle = '#5a4634';
      g.beginPath(); g.arc(-HR * 0.4, 0, HR * 0.34, 0, TAU); g.fill();
    }
    // 红孩儿冲天鬏
    if (cfg.topknot) {
      ellO(g, 0, -HR - 4, 3.4, 3.8, '#3a2418', 1.1);
      g.strokeStyle = '#e05555'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-3, -HR - 1.5); g.quadraticCurveTo(0, -HR - 5, 3, -HR - 1.5); g.stroke();
      ell(g, 0, -HR - 7.5, 1.2, 1.2, '#f5c542');
    }
    // 铁扇公主发髻
    if (cfg.bun) {
      ellO(g, -1, -HR - 3.5, 4, 3.6, '#2b1a2e', 1.1);
      g.strokeStyle = '#f5c542'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-5, -HR - 3); g.lineTo(4, -HR - 4); g.stroke();
      ell(g, 4.4, -HR - 4.4, 1.3, 1.3, '#f5c542');
    }
    // 火妖焰发
    if (cfg.flameHair) {
      for (const [fx, fh] of [[-5, 9], [0, 13], [5, 9]]) {
        const fl = Math.sin((o.time || 0) * 11 + fx) * 2;
        g.fillStyle = 'rgba(255,120,40,0.95)';
        g.beginPath();
        g.moveTo(fx - 3, -HR + 2);
        g.quadraticCurveTo(fx + fl, -HR - fh, fx + 3, -HR + 2);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,220,110,0.9)';
        g.beginPath();
        g.moveTo(fx - 1.4, -HR + 2);
        g.quadraticCurveTo(fx + fl * 0.6, -HR - fh * 0.55, fx + 1.4, -HR + 2);
        g.closePath(); g.fill();
      }
    }
    // 夜叉鱼鳍耳
    if (cfg.fins) {
      g.fillStyle = 'rgba(90,150,170,0.85)';
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(side * (HR - 2), -2);
        g.lineTo(side * (HR + 7), -8);
        g.lineTo(side * (HR + 5), 2);
        g.lineTo(side * (HR + 8), 8);
        g.lineTo(side * (HR - 2), 5);
        g.closePath(); g.fill();
      }
    }
    // 龙王龙须
    if (cfg.whiskers) {
      const wv = Math.sin((o.time || 0) * 3) * 3;
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(HR - 3, 4); g.quadraticCurveTo(HR + 10 + wv, 8, HR + 20 + wv, 20); g.stroke();
      g.beginPath(); g.moveTo(-HR + 3, 4); g.quadraticCurveTo(-HR - 10 - wv, 8, -HR - 20 - wv, 20); g.stroke();
    }
    g.restore();

    // ---- 前臂 + 武器 ----
    limb(g, [shF, elbF, handF], col.arm, 6.5);
    // 手（带描边）+ 腕毛
    ellO(g, handF[0], handF[1], 3.2, 3.2, col.hand || col.arm, 1.2);
    if (cfg.furCuff) {
      g.strokeStyle = shade(col.furCuff, 1.1); g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const aa = armF[1] + i * 0.5;
        g.beginPath();
        g.moveTo(handF[0] - Math.sin(aa) * 5 - Math.cos(aa) * 1.5, handF[1] - Math.cos(aa) * 5 + Math.sin(aa) * 1.5);
        g.lineTo(handF[0] - Math.sin(aa) * 5 - Math.cos(aa) * 3.5, handF[1] - Math.cos(aa) * 5 + Math.sin(aa) * 3.5);
        g.stroke();
      }
    }

    if (p.weapon) {
      const offset = p.staffOffset || 0;
      weapon(g, p.weapon, handF[0] + Math.sin(p.wA || 0) * offset, handF[1] + Math.cos(p.wA || 0) * offset, p.wA || 0, s);
    }
    if (p.gripBlend > 0) {
      limb(g, [elbB, handB], col.armShade, 6.5);
      ellO(g, handB[0], handB[1], 3.2, 3.2, col.hand || col.arm, 1.2);
    }
    g.restore();
  }

  /* ---- 头部（人类/神将 + 悟空猴脸） ---- */
  function drawHead(g, col, cfg, p, time, HR) {
    if (col.monkey) { monkeyHead(g, col, p, time, HR); return; }
    // 脸（描边+腮红+下巴影）
    ellO(g, 0, 0, HR, HR * 1.04, col.skin, 1.5);
    // 眼睛（朝前）
    const eye = col.eye || '#2b2b2b';
    if (p.angry) {
      g.strokeStyle = eye; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(2, -3.5); g.lineTo(6.5, -1.8); g.stroke();
      g.beginPath(); g.moveTo(-1, -3.2); g.lineTo(0.8, -2.2); g.stroke();
      ell(g, 3.5, -0.5, 1.6, 1.8, eye);
    } else {
      ell(g, 3.6, -2, 2, 2.6, '#fff');
      ell(g, 4.2, -1.8, 1.1, 1.5, eye);
      ell(g, 3.8, -2.4, 0.5, 0.6, '#fff');
      ell(g, -1.8, -2, 1.7, 2.3, '#fff');
      ell(g, -1.3, -1.8, 0.9, 1.3, eye);
    }
    // 眉
    g.strokeStyle = shade(col.skin, 0.62); g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(2.2, -4.6); g.lineTo(5.6, -5); g.stroke();
    g.beginPath(); g.moveTo(-3.4, -4.8); g.lineTo(-0.6, -4.6); g.stroke();
    // 腮红
    ell(g, 5.6, 1.8, 1.7, 1.1, 'rgba(230,130,110,0.30)');
    // 下巴阴影
    g.strokeStyle = 'rgba(150,100,70,0.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(1, 1.5, HR * 0.9, Math.PI * 0.22, Math.PI * 0.62); g.stroke();
    // 胡子
    if (cfg.beard) {
      g.fillStyle = cfg.beard;
      g.beginPath();
      g.moveTo(2, 3); g.quadraticCurveTo(4, 13, 0, 15);
      g.quadraticCurveTo(-5, 12, -4, 3);
      g.closePath(); g.fill();
      g.strokeStyle = shade(typeof cfg.beard === 'string' && cfg.beard[0] === '#' ? cfg.beard : '#888888', 0.6);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(1, 9, -0.5, 13); g.stroke();
    }
    // 头盔
    if (cfg.helmet === 'bing') {
      const hc = col.helm || '#9fb2c8';
      g.beginPath(); g.arc(0, -1.5, HR * 1.04, Math.PI, 0); g.closePath();
      g.fillStyle = hc; g.fill();
      g.strokeStyle = shade(hc, 0.55); g.lineWidth = 1.5; g.stroke();
      rrF(g, -HR * 1.04, -2.5, HR * 2.08, 2.6, 1, shade(hc, 0.85), 1.2);
      g.strokeStyle = '#e05555'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -HR - 1); g.lineTo(Math.sin(time * 5) * 2, -HR - 6); g.stroke();
      ell(g, Math.sin(time * 5) * 2, -HR - 7, 1.5, 1.5, '#f07a6a');
    } else if (cfg.helmet === 'general') {
      const hc = col.helm || '#5a6f9a';
      g.beginPath(); g.arc(0, -2, HR * 1.1, Math.PI * 0.95, 0.05); g.closePath();
      g.fillStyle = hc; g.fill();
      g.strokeStyle = shade(hc, 0.5); g.lineWidth = 1.6; g.stroke();
      rrF(g, -HR * 1.1, -3.4, HR * 2.2, 3, 1.2, '#f5c542', 1.2);
      ellO(g, 0, -HR - 2, 2.8, 3.6, '#e05555', 1.2);
    } else if (cfg.helmet === 'guan') { // 天王冠
      const hc = col.helm || '#3d4f8a';
      rrF(g, -HR, -HR - 2, HR * 2, HR * 1.25, 4, hc, 1.6);
      rrF(g, -HR, -HR - 2, HR * 2, 2.6, 1, '#f5c542', 1);
      g.fillStyle = '#f5c542';
      g.beginPath(); g.moveTo(-3.4, -HR - 2); g.lineTo(0, -HR - 9); g.lineTo(3.4, -HR - 2); g.closePath(); g.fill();
      g.strokeStyle = shade('#f5c542', 0.6); g.lineWidth = 1.2; g.stroke();
      if (cfg.crownGem) ellO(g, 0, -HR - 4, 1.6, 1.8, '#e05555', 1);
    } else if (cfg.helmet === 'erlang') {
      const hc = col.helm || '#cdd7e4';
      g.beginPath(); g.arc(0, -2, HR * 1.06, Math.PI * 0.9, 0.1); g.closePath();
      g.fillStyle = hc; g.fill();
      g.strokeStyle = shade(hc, 0.55); g.lineWidth = 1.5; g.stroke();
      rrF(g, -HR * 1.06, -3.6, HR * 2.12, 2.8, 1, '#f5c542', 1);
      // 二郎神三只眼：额头竖眼
      ellO(g, 2.5, -6.5, 2.6, 1.8, '#ffe9b0', 1);
      ell(g, 2.5, -6.5, 1, 1.4, '#e05a2a');
    }
  }

  function monkeyHead(g, col, p, time, HR) {
    const hair = col.hair || '#8a5a2e';
    // 棕毛鬃圈（脸后一圈炸毛，带尖刺）
    g.fillStyle = shade(hair, 0.92);
    g.beginPath();
    g.arc(0, 0, HR * 1.28, 0, TAU); g.fill();
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const a0 = Math.PI * 1.02 + i * (Math.PI * 0.96 / 6);
      const a1 = a0 + Math.PI * 0.06;
      const r1 = HR * 1.28, r2 = HR * 1.55;
      g.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1 - 2);
      g.lineTo(Math.cos((a0 + a1) / 2) * r2, Math.sin((a0 + a1) / 2) * r2 - 2);
      g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1 - 2);
    }
    g.closePath(); g.fill();
    // 耳朵（带耳廓）
    ellO(g, -9.5, -2, 3.8, 4.4, col.skin, 1.2);
    ell(g, -9.5, -2, 2, 2.5, '#e8a87c');
    ellO(g, 10, -2, 3.4, 4.2, col.skin, 1.2);
    ell(g, 10, -2, 1.8, 2.3, '#e8a87c');
    // 脸（描边）
    ellO(g, 0, 0, HR, HR * 1.02, col.skin, 1.6);
    // 脸颊绒毛
    g.strokeStyle = shade(col.skin, 0.82); g.lineWidth = 1.2; g.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(side * (HR - 1.5), -2 + i * 2.6);
        g.lineTo(side * (HR + 2.5), -3 + i * 2.8);
        g.stroke();
      }
    }
    // 毛发头盖（双色+高光，收窄露脸）
    g.fillStyle = hair;
    g.beginPath();
    g.arc(0, -1, HR * 1.02, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath(); g.fill();
    g.strokeStyle = shade(hair, 0.55); g.lineWidth = 1.4; g.stroke();
    ell(g, -5, -10, 3.6, 4, hair);
    ell(g, 5, -10, 3.6, 4, hair);
    g.strokeStyle = shade(hair, 1.35); g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -1.5, HR * 0.8, Math.PI * 1.18, Math.PI * 1.48); g.stroke();
    // 金箍（带扣+宝珠）
    g.strokeStyle = shade('#f5c542', 0.6); g.lineWidth = 3.8;
    g.beginPath(); g.arc(0, -1, HR * 0.99, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    g.strokeStyle = '#f5c542'; g.lineWidth = 2.6;
    g.beginPath(); g.arc(0, -1, HR * 0.99, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    g.fillStyle = '#f5c542';
    ell(g, -2.5, -HR * 1.02, 2, 2, '#f5c542');
    ell(g, -2.5, -HR * 1.02 - 0.6, 0.8, 0.8, '#fff2c0');
    // 眼睛
    const blink = (time % 3.2) < 0.12;
    if (p.glow) {
      // 火眼金睛发光
      ell(g, 4, -2.5, 3, 3.2, '#fff3c4');
      ell(g, 4, -2.5, 1.8, 2, '#ffb02e');
      ell(g, -2.6, -2.5, 2.6, 2.8, '#fff3c4');
      ell(g, -2.6, -2.5, 1.5, 1.7, '#ffb02e');
      g.strokeStyle = '#ffdf7e'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.6;
        g.beginPath(); g.moveTo(4 + Math.sin(a) * 4, -2.5 - Math.cos(a) * 4);
        g.lineTo(4 + Math.sin(a) * 7, -2.5 - Math.cos(a) * 7); g.stroke();
      }
    } else if (blink) {
      g.strokeStyle = '#4a2f18'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(2.4, -2.5); g.lineTo(5.6, -2.5); g.stroke();
      g.beginPath(); g.moveTo(-4, -2.5); g.lineTo(-1.2, -2.5); g.stroke();
    } else {
      const look = p.angry ? 1.1 : 0.7;
      ell(g, 4, -2.5, 2.6, p.regal ? 2.2 : 3.1, '#fff');
      ell(g, 4 + look, -2.2, 1.4, 1.8, '#3a2410');
      ell(g, 4 + look - 0.5, -2.9, 0.6, 0.7, '#ffffff');
      ell(g, -2.6, -2.5, 2.4, p.regal ? 2.0 : 2.9, '#fff');
      ell(g, -2.6 + look, -2.2, 1.3, 1.7, '#3a2410');
      ell(g, -2.6 + look - 0.5, -2.9, 0.55, 0.65, '#ffffff');
    }
    // 眉毛（攻击时倒竖）
    g.strokeStyle = shade(hair, 0.7); g.lineWidth = 2; g.lineCap = 'round';
    if (p.angry) {
      g.beginPath(); g.moveTo(1.6, -6.4); g.lineTo(6.2, -4.8); g.stroke();
      g.beginPath(); g.moveTo(-4.4, -6.2); g.lineTo(-1, -4.8); g.stroke();
    } else if (p.regal) {
      g.beginPath(); g.moveTo(1.8, -6.2); g.lineTo(6.3, -5.5); g.stroke();
      g.beginPath(); g.moveTo(-4.8, -6.1); g.lineTo(-1.2, -5.6); g.stroke();
    } else {
      g.beginPath(); g.moveTo(2, -6); g.lineTo(5.8, -6.6); g.stroke();
      g.beginPath(); g.moveTo(-4.6, -6.4); g.lineTo(-1.2, -6.4); g.stroke();
    }
    // 鼻子 + 嘴 + 腮红
    ell(g, 6.5, 1.5, 1, 0.8, '#d98e5f');
    ell(g, -1.5, 2.2, 1.7, 1.1, 'rgba(240,150,130,0.35)');
    if (p.angry) {
      ell(g, 5.5, 4.5, 2.6, 2, '#7a3b2a');
      g.fillStyle = '#fff';
      g.fillRect(4.4, 3.2, 1.2, 1.4); g.fillRect(6.2, 3.2, 1.2, 1.4);
    } else if (p.regal) {
      g.strokeStyle = '#85442a'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(2.7, 4.5); g.quadraticCurveTo(5.3, 5.2, 7, 3.9); g.stroke();
    } else {
      g.strokeStyle = '#a05a32'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(4.5, 3, 3, 0.15, Math.PI * 0.75); g.stroke();
    }
    // 下巴阴影
    g.strokeStyle = 'rgba(180,120,80,0.4)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(1, 2, HR * 0.92, Math.PI * 0.25, Math.PI * 0.6); g.stroke();
  }

  /* ---- 武器（局部坐标，画在手位置，角度同骨架约定）—— 全系重绘：描边+高光+缠绳 ---- */
  function weapon(g, kind, hx, hy, a, s) {
    g.save();
    g.translate(hx, hy);
    g.rotate(-a); // 使正角度=指向前方
    const O = (c) => shade(c, 0.5);
    switch (kind) {
      case 'staff': // 金箍棒：红木杆+金箍双箍纹+高光
        g.lineCap = 'round';
        g.strokeStyle = O('#8a4b2a'); g.lineWidth = 6;
        g.beginPath(); g.moveTo(0, -27); g.lineTo(0, 30); g.stroke();
        g.strokeStyle = '#8a4b2a'; g.lineWidth = 4.2;
        g.beginPath(); g.moveTo(0, -27); g.lineTo(0, 30); g.stroke();
        g.strokeStyle = 'rgba(255,220,160,0.5)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-1.2, -24); g.lineTo(-1.2, 26); g.stroke();
        for (const [y0, y1] of [[-29, -21], [22, 30]]) {
          rrF(g, -3.2, y0, 6.4, y1 - y0, 2.4, '#f5c542', 1.4);
          g.fillStyle = shade('#f5c542', 0.75);
          g.fillRect(-3.2, y0 + 2.6, 6.4, 1.1);
          g.fillRect(-3.2, y1 - 3.4, 6.4, 1.1);
        }
        // 顶端宝珠
        ellO(g, 0, -30.5, 2.2, 2.2, '#e05555', 1);
        ell(g, -0.7, -31.2, 0.7, 0.7, '#ffb0a0');
        break;
      case 'spear':
        g.strokeStyle = O('#7d6b55'); g.lineWidth = 4.2;
        g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 38); g.stroke();
        g.strokeStyle = '#7d6b55'; g.lineWidth = 2.8;
        g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 38); g.stroke();
        g.strokeStyle = 'rgba(255,230,180,0.4)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(-0.8, -20); g.lineTo(-0.8, 36); g.stroke();
        // 缨枪红缨
        g.strokeStyle = '#e05555'; g.lineWidth = 1.6; g.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const aa = -0.8 + i * 0.4;
          g.beginPath(); g.moveTo(0, 28);
          g.lineTo(Math.sin(aa) * 6, 28 + Math.cos(aa) * 6 + 2); g.stroke();
        }
        g.beginPath(); g.moveTo(-3.6, 30); g.lineTo(0, 44); g.lineTo(3.6, 30); g.closePath();
        g.fillStyle = '#d8e2ec'; g.fill();
        g.strokeStyle = O('#d8e2ec'); g.lineWidth = 1.1; g.stroke();
        g.fillStyle = '#f4f9ff';
        g.beginPath(); g.moveTo(-0.9, 31); g.lineTo(0, 42); g.lineTo(0.9, 31); g.closePath(); g.fill();
        break;
      case 'sword':
        g.strokeStyle = O('#4a3a28'); g.lineWidth = 4.6;
        g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 3); g.stroke();
        g.strokeStyle = '#4a3a28'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 3); g.stroke();
        // 缠绳
        g.strokeStyle = '#2e241a'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-1.6, -7 + i * 3.4); g.lineTo(1.6, -5.4 + i * 3.4); g.stroke(); }
        rrF(g, -5.4, 3, 10.8, 3.2, 1.4, '#f5c542', 1.2);
        g.beginPath();
        g.moveTo(-2.6, 6); g.lineTo(-2.6, 34); g.lineTo(0, 40); g.lineTo(2.6, 34); g.lineTo(2.6, 6);
        g.closePath();
        g.fillStyle = '#d8e2ec'; g.fill();
        g.strokeStyle = O('#d8e2ec'); g.lineWidth = 1.2; g.stroke();
        g.fillStyle = '#f4f9ff';
        g.beginPath(); g.moveTo(-0.9, 6); g.lineTo(-0.9, 33); g.lineTo(0.9, 33); g.lineTo(0.9, 6); g.closePath(); g.fill();
        g.fillStyle = '#9fb2c8';
        g.beginPath(); g.moveTo(-2.6, 34); g.lineTo(0, 40); g.lineTo(2.6, 34); g.closePath(); g.fill();
        ellO(g, 0, 42, 1.8, 1.8, '#f5c542', 1);
        break;
      case 'hammer':
        g.strokeStyle = O('#6b4a2a'); g.lineWidth = 6;
        g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 32); g.stroke();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 4.2;
        g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 32); g.stroke();
        rrF(g, -14, 26, 28, 20, 5, '#7c8894', 1.6);
        rrF(g, -14, 26, 28, 7, 4, '#a5b2bd', 1.1);
        // 箍带+铆钉
        g.fillStyle = '#4a545e';
        g.fillRect(-14, 33, 28, 2.2);
        ellO(g, -8.5, 38, 1.8, 1.8, '#cdd7e4', 0.8);
        ellO(g, 8.5, 38, 1.8, 1.8, '#cdd7e4', 0.8);
        ell(g, -4, 29, 1, 1, 'rgba(255,255,255,0.5)');
        break;
      case 'trident': // 三尖两刃刀
        g.strokeStyle = O('#5a4632'); g.lineWidth = 5.2;
        g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 42); g.stroke();
        g.strokeStyle = '#5a4632'; g.lineWidth = 3.6;
        g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 42); g.stroke();
        g.strokeStyle = 'rgba(220,190,140,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-0.9, -18); g.lineTo(-0.9, 40); g.stroke();
        rrF(g, -4.4, 24, 8.8, 3.2, 1.4, '#f5c542', 1.1);
        g.beginPath(); g.moveTo(0, 42); g.lineTo(-2.8, 30); g.lineTo(2.8, 30); g.closePath();
        g.fillStyle = '#e8f0f8'; g.fill();
        g.strokeStyle = O('#e8f0f8'); g.lineWidth = 1; g.stroke();
        for (const dir of [-1, 1]) {
          g.beginPath();
          g.moveTo(0, 30);
          g.quadraticCurveTo(dir * 10, 24, dir * 8, 10);
          g.lineTo(dir * 4, 14);
          g.quadraticCurveTo(dir * 4, 22, 0, 26);
          g.closePath();
          g.fillStyle = '#e8f0f8'; g.fill();
          g.strokeStyle = O('#e8f0f8'); g.lineWidth = 1; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.beginPath(); g.moveTo(dir * 1.4, 28); g.quadraticCurveTo(dir * 7, 22, dir * 6.2, 13); g.lineTo(dir * 4.4, 16); g.quadraticCurveTo(dir * 4.2, 21, dir * 1.4, 26); g.closePath(); g.fill();
        }
        ellO(g, 0, 28.6, 1.6, 1.6, '#e05555', 0.9);
        break;
      case 'bow':
        g.strokeStyle = O('#8a5a2e'); g.lineWidth = 4.6;
        g.beginPath(); g.arc(0, 0, 16, -Math.PI * 0.42, Math.PI * 0.42); g.stroke();
        g.strokeStyle = '#8a5a2e'; g.lineWidth = 3.2;
        g.beginPath(); g.arc(0, 0, 16, -Math.PI * 0.42, Math.PI * 0.42); g.stroke();
        g.strokeStyle = '#a5713d'; g.lineWidth = 4.4; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(3.4, -14.6); g.lineTo(3.4, 14.6); g.stroke(); // 握把
        g.strokeStyle = '#e8e0d0'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(16 * Math.cos(-Math.PI * 0.42), 16 * Math.sin(-Math.PI * 0.42));
        g.lineTo(16 * Math.cos(Math.PI * 0.42), 16 * Math.sin(Math.PI * 0.42));
        g.stroke();
        ellO(g, 16 * Math.cos(-Math.PI * 0.42), 16 * Math.sin(-Math.PI * 0.42), 1.6, 1.6, '#f5c542', 0.8);
        ellO(g, 16 * Math.cos(Math.PI * 0.42), 16 * Math.sin(Math.PI * 0.42), 1.6, 1.6, '#f5c542', 0.8);
        break;
      case 'pipa':
        g.beginPath();
        g.moveTo(-1, -14); g.lineTo(3, -14); g.lineTo(6, 6);
        g.quadraticCurveTo(7, 16, 0, 17);
        g.quadraticCurveTo(-8, 16, -7, 6);
        g.closePath();
        g.fillStyle = '#a0522d'; g.fill();
        g.strokeStyle = O('#a0522d'); g.lineWidth = 1.3; g.stroke();
        ellO(g, -0.5, 8, 5.5, 7.5, '#c97b4a', 1);
        g.strokeStyle = '#f0e6d2'; g.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-2 + i * 2.5, -12); g.lineTo(-2 + i * 2.5, 12); g.stroke(); }
        // 品位横档 + 轸子
        g.strokeStyle = '#f5c542'; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-4 + i * 0.6, 4 + i * 3); g.lineTo(3.4 - i * 0.4, 4 + i * 3); g.stroke(); }
        ell(g, -1.2, -13, 1, 1, '#f5c542'); ell(g, 1.6, -13, 1, 1, '#f5c542'); ell(g, 4.2, -12, 1, 1, '#f5c542');
        break;
      case 'axe':
        g.lineCap = 'round';
        g.strokeStyle = O('#4a3421'); g.lineWidth = 6;
        g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 34); g.stroke();
        g.strokeStyle = '#4a3421'; g.lineWidth = 4.2;
        g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 34); g.stroke();
        g.strokeStyle = 'rgba(220,190,140,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-0.9, -16); g.lineTo(-0.9, 32); g.stroke();
        // 双刃斧头
        for (const dir of [-1, 1]) {
          g.beginPath();
          g.moveTo(dir * 2, 18);
          g.quadraticCurveTo(dir * 20, 14, dir * 22, 26);
          g.quadraticCurveTo(dir * 20, 36, dir * 2, 32);
          g.closePath();
          g.fillStyle = '#9aa7b4'; g.fill();
          g.strokeStyle = O('#9aa7b4'); g.lineWidth = 1.4; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.45)';
          g.beginPath();
          g.moveTo(dir * 6, 20);
          g.quadraticCurveTo(dir * 15, 18, dir * 18, 25);
          g.lineTo(dir * 14, 26);
          g.quadraticCurveTo(dir * 9, 22, dir * 6, 23);
          g.closePath(); g.fill();
        }
        rrF(g, -4, 16, 8, 4, 1.6, '#f5c542', 1.1);
        break;
      case 'fan':
        // 芭蕉扇：大叶扇面+扇骨+柄
        g.strokeStyle = O('#3f7a4a'); g.lineWidth = 4.6;
        g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 8); g.stroke();
        g.strokeStyle = '#3f7a4a'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 8); g.stroke();
        g.save();
        g.translate(0, -8);
        g.rotate(-0.12);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-20, -14, -24, -34);
        g.quadraticCurveTo(-4, -30, 0, -2);
        g.quadraticCurveTo(4, -30, 24, -34);
        g.quadraticCurveTo(20, -14, 0, 0);
        g.closePath();
        g.fillStyle = '#4a8a56'; g.fill();
        g.strokeStyle = O('#4a8a56'); g.lineWidth = 1.5; g.stroke();
        g.strokeStyle = 'rgba(20,60,34,0.7)'; g.lineWidth = 1;
        for (const a of [-0.55, -0.28, 0, 0.28, 0.55]) {
          g.beginPath(); g.moveTo(0, -1);
          g.lineTo(Math.sin(a) * 22, -Math.cos(a) * 27 - 3);
          g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.moveTo(0, -2);
        g.quadraticCurveTo(-12, -14, -16, -28);
        g.quadraticCurveTo(-4, -22, 0, -4);
        g.closePath(); g.fill();
        // 宝光
        ell(g, 0, -20, 3, 3, 'rgba(180,255,200,0.5)');
        g.restore();
        break;
      case 'feather':
        g.fillStyle = '#eef4fb';
        g.beginPath(); g.ellipse(0, 12, 2.2, 13, 0, 0, TAU); g.fill();
        g.strokeStyle = '#c8d6e8'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 24); g.stroke();
        break;
    }
    g.restore();
  }

  /* ============ 悟空 ============ */
  const WK_GUARD = {
    dy: 1, lean: .07, headA: -.07, wA: 2.40, tail: -.12,
    armF: [-1.1891, -1.9583], armB: [.20, .16], legF: [.30, .12], legB: [-.35, -.12],
    shoulderF: 0, staffOffset: 15, grip: -14, gripBlend: 0,
  };
  function wkGuard(time) {
    const b=Math.sin(time*2);
    return {...WK_GUARD,dy:1+b*.12,lean:.07+b*.004,armF:[-1.1891+b*.006,-1.9583],wA:2.40+b*.005,tail:-.12+b*.018};
  }
  // 起手、出力、余势。时间节点对应 player.atkDef 的三段命中窗口。
  const WK_STRIKES = [
    [
      { dy: 5, lean: -0.18, headA: 0.08, wA: Math.PI-1.4, tail: -0.38, armF: [-0.85, -1.15], armB: [-0.55, -0.15], legF: [0.55, -0.48], legB: [-0.6, 0.33] },
      { dy: 3.8, lean: 0.28, headA: -0.08, wA: 1.45, tail: 0.2, armF: [1.05, 1.65], armB: [-0.7, -0.3], legF: [0.52, 0.12], legB: [-0.74, -0.1] },
      { dy: 4, lean: 0.32, headA: -0.10, wA: 1.65, tail: 0.12, armF: [1.28, 1.55], armB: [-0.6, 0.1], legF: [0.55, 0.12], legB: [-0.72, -0.16] },
    ],
    [
      { dy: 6, lean: -0.14, headA: 0.05, wA: 1.22, tail: -0.25, armF: [0.55, 0.8], armB: [-0.45, 0.8], legF: [0.75, 0.35], legB: [-0.72, -0.3] },
      { dy: 2, lean: 0.17, headA: -0.12, wA: 2.1, tail: 0.32, armF: [1.7, 2.5], armB: [1.25, 1.85], legF: [0.15, 0.12], legB: [-0.52, -0.12] },
      { dy: 1.3, lean: 0.25, headA: -0.10, wA: 2.45, tail: 0.16, armF: [1.95, 2.35], armB: [1.5, 1.6], legF: [0.12, 0.05], legB: [-0.50, -0.1] },
    ],
    [
      { dy: 4.3, lean: -0.14, headA: 0.06, wA: Math.PI - 0.4, tail: -0.38, armF: [2.2, 2.0], armB: [2.4, 2.2], legF: [0.6, 0.12], legB: [-0.6, -0.2] },
      { dy: 6, lean: 0.38, headA: -0.14, wA: 1.16, tail: 0.48, armF: [0.9, 1.2], armB: [0.65, 1.1], legF: [0.72, 0.12], legB: [-0.9, -0.08] },
      { dy: 5, lean: 0.33, headA: -0.10, wA: 1.12, tail: 0.26, armF: [0.8, 1.12], armB: [0.55, 1.0], legF: [0.62, 0.16], legB: [-0.82, -0.12] },
    ],
  ];

  function blendWkPose(q, a, b, k) {
    for (const key of ['dy', 'lean', 'headA', 'wA', 'tail']) q[key] = U.lerp(a[key], b[key], k);
    for (const key of ['staffOffset','gripBlend','shoulderF']) q[key] = U.lerp(a[key] || 0,b[key] || 0,k);
    for (const key of ['armF', 'armB', 'legF', 'legB']) q[key] = [U.lerp(a[key][0], b[key][0], k), U.lerp(a[key][1], b[key][1], k)];
  }

  // 连斩蓄势：沿用同一大圣骨架，动作相位只读取 Player 的真实技能时钟。
  const WK_HEAVY_RAISED = {...WK_GUARD,dy:3,lean:-.12,headA:.02,wA:2.98,tail:-.36,
    armF:[2.40,2.75],armB:[.4,2.0],legF:[.55,.05],legB:[-.65,-.12],staffOffset:22,gripBlend:1};
  const WK_HEAVY_IMPACT = {...WK_GUARD,dy:5.5,lean:.30,headA:-.12,wA:1.07,tail:.38,
    armF:[.80,1.12],armB:[.55,1.0],legF:[.65,.08],legB:[-.80,-.12],staffOffset:22,gripBlend:1};
  const WK_HEAVY_RECOVER = {...WK_HEAVY_IMPACT,dy:4.5,lean:.24,wA:1.13,tail:.18,armF:[.85,1.10]};
  const WK_FLASH_PREP = {...WK_GUARD,dy:1,lean:.28,headA:-.12,wA:Math.PI-1.12,tail:-.40,
    armF:[.48,.72],armB:[-.5,.35],legF:[.50,-.30],legB:[-.62,-.15],staffOffset:0,gripBlend:0};
  const WK_SLASH_READY = {...WK_GUARD,dy:3,lean:-.06,headA:-.08,wA:1.95,tail:-.2,
    armF:[.60,1.10],armB:[-.35,.55],legF:[.50,-.15],legB:[-.62,-.12],staffOffset:14,gripBlend:.28};
  const WK_SLASH_SWEEP = {...WK_SLASH_READY,dy:3,lean:.20,wA:1.28,tail:.22,
    armF:[1.0,1.45],legF:[.56,-.10],legB:[-.66,-.12]};
  const WK_SLASH_REVERSE = {...WK_SLASH_READY,dy:2.5,lean:.15,wA:2.10,tail:.12,
    armF:[1.70,2.40],legF:[.50,-.08],legB:[-.62,-.12],gripBlend:.40};
  const WK_SLASH_COLLECT = {...WK_SLASH_READY,dy:3,lean:.18,wA:1.75,tail:.25,
    armF:[1.45,1.80],legF:[.52,-.10],legB:[-.66,-.12],gripBlend:.45};
  const WK_SLASH_FRAMES = [[.045,WK_SLASH_READY],[.10,WK_SLASH_SWEEP],
    [.135,{...WK_SLASH_SWEEP,wA:1.18}],[.20,WK_SLASH_REVERSE],
    [.245,{...WK_SLASH_REVERSE,wA:2.30}],[.30,WK_SLASH_COLLECT]];

  function wkSkillSmooth(k) { k=U.clamp(k,0,1);return k*k*(3-2*k); }
  function wkSkillEase(k) { return U.ease(U.clamp(k,0,1)); }
  function wkSkillMix(a,b,k) {
    const q={...a};blendWkPose(q,a,b,U.clamp(k,0,1));q.grip=a.grip || -14;return q;
  }
  function wkFitGrip(q) {
    // 两节10px骨长内再合后手，防止举棒中段把后臂拉长。
    const dx=6+(q.shoulderF || 0)+10*(Math.sin(q.armF[0])+Math.sin(q.armF[1]))+Math.sin(q.wA)*q.grip;
    const dy=10*(Math.cos(q.armF[0])+Math.cos(q.armF[1]))+Math.cos(q.wA)*q.grip;
    q.gripBlend*=wkSkillSmooth((20-Math.hypot(dx,dy))/3);return q;
  }
  function wkHeavyPose(t,hitTime=.28,dur=.65,linked=false,entry=WK_GUARD,endPose=WK_GUARD) {
    const dropStart=Math.max(0,hitTime-.07),recoverStart=hitTime+.11;
    if(t<dropStart) return wkSkillMix(linked ? WK_HEAVY_RAISED : entry,WK_HEAVY_RAISED,wkSkillSmooth(t/Math.max(.001,dropStart)));
    if(t<hitTime) return wkSkillMix(WK_HEAVY_RAISED,WK_HEAVY_IMPACT,Math.pow(U.clamp((t-dropStart)/(hitTime-dropStart),0,1),2));
    if(t<recoverStart) return wkSkillMix(WK_HEAVY_IMPACT,WK_HEAVY_RECOVER,wkSkillEase((t-hitTime)/.11));
    const q=wkSkillMix(WK_HEAVY_RECOVER,endPose,wkSkillEase((t-recoverStart)/Math.max(.001,dur-recoverStart)));
    q.gripBlend=U.lerp(q.gripBlend,endPose.gripBlend || 0,wkSkillEase((t-recoverStart)/.08));return q;
  }
  function wkSlashPose(p,t,entry) {
    let start=0,from=entry;
    for(const [end,to] of WK_SLASH_FRAMES) {
      if(t<=end) return wkSkillMix(from,to,wkSkillSmooth((t-start)/(end-start)));
      start=end;from=to;
    }
    return wkSkillMix(WK_SLASH_COLLECT,p.linkReady ? WK_HEAVY_RAISED : WK_GUARD,wkSkillSmooth((t-.30)/.12));
  }
  function wkSkillPose(p,time) {
    const t=p.stateT || 0,v=p.visual,entry=v && (v.poseState!==p.state ? v.pose : v.poseFrom) || WK_GUARD;
    let q;
    if(p.skillAction==='heavy') {
      const hitTime=p.heavyHitTime || .28,dur=p.heavyDur || p.stateDur || .65,start=p.heavyLinked ? WK_HEAVY_RAISED : entry;
      q=wkHeavyPose(t,hitTime,dur,!!p.heavyLinked,start);
      if(t>=dur-.12 && p.actionBuffer==='skill2' && p.mp>=Z.BAL.skills.jd.mp && (p.cds.jd || 0)<=0) {
        q=wkSkillMix(wkHeavyPose(dur-.12,hitTime,dur,!!p.heavyLinked,start),WK_FLASH_PREP,wkSkillSmooth((t-(dur-.12))/.12));
      }
    } else if(p.skillAction==='slash') q=wkSlashPose(p,t,entry);
    else {
      const sprint={...WK_GUARD,dy:1,lean:.40,headA:-.14,wA:Math.PI-1.12,tail:-.58,
        armF:[.48,.72],armB:[-.65,.35],legF:[.65,-.95],legB:[-.66,-.50],staffOffset:0};
      // 同一棒轴转向上方；跑动的负角等价翻轴并反偏握，保留两端位置，避免插值经竖直向下扫地。
      const flashEntry=entry.wA<0 ? {...entry,wA:entry.wA+Math.PI,staffOffset:-(entry.staffOffset || 0)} : entry;
      const lift=wkSkillSmooth(t/.04);q=wkSkillMix(flashEntry,sprint,lift);
      q.staffOffset+=12*Math.sin(Math.PI*lift); // 低手换握时先滑到偏低段，棒尾始终离地。
      if(t>.26) {
        const settle=wkSkillEase((t-.26)/.08);q=wkSkillMix(q,WK_GUARD,settle);
        q.staffOffset+=12*Math.sin(Math.PI*settle);
      }
    }
    wkFitGrip(q);q.weapon='staff';q.weaponBehind=p.skillAction==='flash' || (p.skillAction==='heavy' && q.wA<0);
    q.angry=t>.06 && (p.skillAction!=='heavy' || t<(p.heavyHitTime || .28)+.12);
    q.regal=true;q.glow=false;q.cloud=false;q.spin=null;q.lying=false;q.time=time;return q;
  }

  function wkPoseBase(p, time) {
    if(p.skillAction) return wkSkillPose(p,time);
    const st = p.state;
    const d = p.stateDur || 0.3;
    const guard=wkGuard(time);
    const q = {
      ...guard,
      weapon: 'staff', glow: false, angry: false, regal: true,
      cloud: false, spin: null, lying: false, time,
    };
    switch (st) {
      case 'idle':
      case 'run':
      case 'jump':
      case 'fall': {
        // 参考原作的肩背斜持与短步；按实际速度连续起跑、停步。
        const rest=guard;
        const ph = p.visual && Number.isFinite(p.visual.runPhase) ? p.visual.runPhase : time * TAU/.42, s1 = Math.sin(ph), c1=Math.cos(ph);
        const carry=p.visual && Number.isFinite(p.visual.carry) ? p.visual.carry : U.ease(U.clamp(Math.abs(p.vx || 0)/(p.spd || 252),0,1));
        const legs=[[s1*9,22-5*Math.max(0,c1)],[-s1*9,22-5*Math.max(0,-c1)]].map(([x,y])=>{
          const a=Math.atan2(x,y),bend=Math.acos(U.clamp(Math.hypot(x,y)/24,0,1));
          return [a+bend,a-bend];
        });
        // 对称棒轴以向上端为同一参考，反偏握保留后拖位置；起停只转约27°，不经向下竖棒。
        const run={...WK_GUARD,lean:.11,dy:1.05-Math.abs(s1)*.45,headA:-.08,wA:Math.PI-1.2+c1*.03,tail:-.25+s1*.04,
          staffOffset:-6,
          armF:[.42-s1*.30,.55],armB:[.1-s1*.35,.30],legF:legs[0],legB:legs[1]};
        blendWkPose(q,rest,run,carry);
        if(carry>0 && carry<1)q.staffOffset+=12*Math.sin(Math.PI*carry); // 换握时先沿棒滑过低握段，再提回中段，手放下时棒尾仍离地。
        const height=p.onGround===true ? 0 : p.groundY!=null ? Math.max(0,p.groundY-p.y) : p.onGround===false ? 40 : 0;
        const lift=U.ease(U.clamp(height/30,0,1)),fall=U.ease(U.clamp(((p.vy || 0)+160)/700,0,1));
        const air={...WK_GUARD,lean:U.lerp(.11,.06,fall),headA:-.08,wA:U.lerp(q.wA,3.03,U.clamp((p.vy || 0)/700,0,1)*(1-carry)),staffOffset:U.lerp(15,-15,carry),tail:U.lerp(-.55,.45,fall),
          armF:[-1.25,-2.12],armB:[U.lerp(.3,-.35,fall),.25],legF:[U.lerp(.55,.35,fall),U.lerp(-.75,-.25,fall)],legB:[U.lerp(-.25,-.35,fall),U.lerp(-.5,-.15,fall)]};
        blendWkPose(q,q,air,lift);
        // 实际跳落留住空中棍轴，由已有着地快照收回；无历史时仍按离地高度连续采样。
        if(p.onGround===false && p.visual && p.visual.pose)q.wA=air.wA;
        break;
      }
      case 'atk1':
      case 'atk2':
      case 'atk3': {
        const idx = Number(st[3]) - 1, t = p.stateT || 0;
        const ws = [0.08, 0.10, 0.14][idx], we = [0.20, 0.22, 0.28][idx];
        const windup = ws - 0.035, impact = ws + 0.018, frames = WK_STRIKES[idx];
        if (t < windup) blendWkPose(q, guard, frames[0], U.ease(t / windup));
        else if (t < impact) blendWkPose(q, frames[0], frames[1], 1 - Math.pow(1 - (t - windup) / (impact - windup), 3));
        else if (t < we) blendWkPose(q, frames[1], frames[2], U.ease((t - impact) / (we - impact)));
        else blendWkPose(q, frames[2], guard, U.ease(U.clamp((t - we) / (d - we), 0, 1)));
        q.angry = t >= windup && t < we;
        if (idx === 2) {
          const release=1-U.ease(U.clamp((t-we)/(d-we),0,1)),slide=Math.min(U.ease(U.clamp(t/windup,0,1)),release);
          q.grip = -14; q.gripBlend = Math.min(U.ease(U.clamp((t-windup*.5)/(windup*.5),0,1)),release);
          q.staffOffset = U.lerp(q.staffOffset,22,slide); // 先举棍再合后手，偏低握与重击握点连续。
        }
        break;
      }
      case 'cast':
        {
          const t=p.stateT||0,k=U.ease(U.clamp(t/.18,0,1));
          q.armF=[U.lerp(.5,1.35,k),U.lerp(.95,.18,k)];q.armB=[-.4,.45];
          q.lean=U.lerp(-.06,.18,k);q.glow=true;q.wA=U.lerp(1,1.32,k);
          q.legF=[.4,-.1];q.legB=[-.55,-.1];q.headA=-.08;
          q.staffOffset=0;q.shoulderF=0;
          blendWkPose(q,guard,q,U.ease(U.clamp(t/.08,0,1)));
          blendWkPose(q,q,guard,U.ease(U.clamp((t-.32)/.18,0,1)));
          q.glow=t<.38;
        }
        break;
      case 'dash': {
        const t=p.stateT || 0,start=U.ease(U.clamp(t/.055,0,1)),settle=U.ease(U.clamp((t-(d-.08))/.08,0,1));
        q.lean = 0.4;
        q.legF = [0.75, -1.05]; q.legB = [-0.55, -0.85];
        q.armF = [.65, 1.35]; q.armB = [0.95, -0.25];
        q.wA = Math.PI-1.25; q.tail = -0.7; q.glow = false;q.shoulderF=0;q.staffOffset=0;
        blendWkPose(q,guard,q,start);blendWkPose(q,q,guard,settle);
        q.staffOffset+=6*Math.sin(Math.PI*settle); // 收势先接回偏低握段，手臂摆回途中棍尾不扫地。
        break;
      }
      case 'spin':
        {
          // 每 .15 秒一次棍扫；身体稳住重心，云旋和棍影由 FX 表现。
          const a=(p.stateT||0)*TAU/.15, sway=Math.sin(a);
          q.lean=.14+sway*.09;q.armF=[1.4+sway*.32,1.6-sway*.15];q.armB=[-.5,.6];
          q.wA=1.52+sway*.4;q.legF=[.5,-.2];q.legB=[-.6,-.15];
          q.dy=2-Math.abs(sway);q.tail=.35+sway*.15;q.angry=true;
          q.staffOffset=0;q.shoulderF=0;
          blendWkPose(q,guard,q,U.ease(U.clamp((p.stateT||0)/.08,0,1)));
          blendWkPose(q,q,guard,U.ease(U.clamp(((p.stateT||0)-.95)/.1,0,1)));
        }
        break;
      case 'wu': {
        const t=p.stateT||0;
        q.armB=[-.35,.5];q.angry=true;q.glow=true;
        q.legF=[.6,-.12];q.legB=[-.65,-.12];
        q.staffOffset=0;q.shoulderF=0;
        if(t<.86){
          // 每次 .16 + n*.17 秒命中时落棒；余弦余势连续回到下一次起手。
          const strike=t<.16 ? U.ease(U.clamp((t-.1)/.06,0,1)) : .5+.5*Math.cos((t-.16)*TAU/.17);
          q.armF=[U.lerp(2.25,.95,strike),U.lerp(1.8,1.5,strike)];
          q.wA=U.lerp(-1.1,1.45,strike);q.lean=U.lerp(-.08,.3,strike);q.dy=3+strike*2;
          blendWkPose(q,guard,q,U.ease(U.clamp(t/.1,0,1)));
          // 肩后棍先转为横势，手举起后转棒；.1 秒后接回原重击角与命中节奏。
          if(t<.1){const carryA=U.lerp(guard.wA,Math.PI/2,U.ease(U.clamp(t/.045,0,1)));q.wA=U.lerp(carryA,-1.1,U.ease(U.clamp((t-.06)/.04,0,1)));}
        }else{
          const lastStrike=.5+.5*Math.cos((.86-.16)*TAU/.17);
          const raised=U.ease(U.clamp((t-.86)/.09,0,1));
          const impact=U.ease(U.clamp((t-.95)/.05,0,1)), settle=U.ease(U.clamp((t-1.08)/.22,0,1));
          q.armF=[
            U.lerp(U.lerp(U.lerp(2.25,.95,lastStrike),2.3,raised),.9,impact),
            U.lerp(U.lerp(U.lerp(1.8,1.5,lastStrike),2,raised),1.1,impact),
          ];
          q.wA=U.lerp(U.lerp(U.lerp(-1.1,1.45,lastStrike),Math.PI-.35,raised),1.14,impact);
          q.lean=U.lerp(U.lerp(U.lerp(-.08,.3,lastStrike),-.12,raised),.34,impact);
          q.dy=U.lerp(U.lerp(3+lastStrike*2,3,raised),6,impact);
          q.grip=-14;q.gripBlend=raised;q.staffOffset=22*raised;
          blendWkPose(q,q,guard,settle);
          q.gripBlend*=1-U.ease(U.clamp((t-1.08)/.06,0,1)); // 收势先松后手，再回肩后握姿，避免后臂被拉长。
        }
        break;
      }
      case 'hurt':
        q.lean = -0.3; q.headA = -0.18; q.dy = 3;
        q.armF = [-0.7, -0.5]; q.armB = [-0.35, 0.35];
        q.legF = [0.3, -0.45]; q.wA = -1.9; q.tail = -0.3;
        q.staffOffset=0;q.shoulderF=0;
        blendWkPose(q,q,guard,U.ease(U.clamp(((p.stateT || 0)-.2)/.08,0,1)));
        break;
      case 'down':
        q.lying = true;
        break;
      case 'getup':
        q.lean = -0.22; q.dy = 5; q.headA = -0.1;
        q.armF = [-0.55, -0.35]; q.armB = [-0.3, 0.25];
        q.legF = [0.35, -0.5]; q.wA = -1.7; q.tail = -0.2;
        q.staffOffset=0;q.shoulderF=0;
        blendWkPose(q,q,guard,U.ease(U.clamp(((p.stateT || 0)-.28)/.17,0,1)));
        break;
      case 'win': {
        const b = Math.sin(time * 5);
        q.dy = -Math.abs(b) * 3;
        q.armF = [2.7 + b * 0.1, 0.05]; q.armB = [0.3, 0.25];
        q.wA = -0.5; q.headA = -0.06;
        q.staffOffset=0;q.shoulderF=0;
        break;
      }
    }
    return q;
  }

  function wkPose(p,time) {
    const q=wkPoseBase(p,time),v=p.visual;
    if(!p.skillAction && v && v.pose) {
      const free=['idle','run','jump','fall'].includes(p.state);
      const groundChanged=free && v.poseGround!=null && v.poseGround!==Number(p.onGround);
      const changed=v.poseState!==p.state || groundChanged,from=changed ? v.pose : v.poseFrom;
      const elapsed=groundChanged ? 0 : changed ? p.stateT || 0 : Math.max(0,time-(v.poseStart || 0));
      const duration={atk1:.045,atk2:.06,atk3:.08,cast:.08,dash:.055,spin:.08,wu:.1,hurt:.06,down:.06,getup:.08}[p.state] || (free ? .20 : .08);
      if(from && elapsed<duration){const k=U.clamp(elapsed/duration,0,1);blendWkPose(q,from,q,free ? k : U.ease(k));}
    }
    // 身侧后的握手用后景棍层；按混合后的手位决定，避免动作边界瞬间换层。
    // 自由移动（待机/跑/跳/落）一律后景：拖棒与肩背都从躯干后面走，不穿模。
    const handFromShoulder = 4 + (q.shoulderF || 0) + 10 * (Math.sin(q.armF[0]) + Math.sin(q.armF[1]));
    if(!p.skillAction) q.weaponBehind = ['idle','run','jump','fall'].includes(p.state) ? true : handFromShoulder < -8;
    return q;
  }
  // updateVisual 的只读采样接口；无历史时直接使用各动作自己的起手/收势。
  Z.Spr.sampleWukongPose=function(p,time) {
    const q=wkPose(p,time),pose={};
    for(const key of ['dy','lean','headA','wA','tail','staffOffset','grip','gripBlend','shoulderF'])pose[key]=q[key] || 0;
    for(const key of ['armF','armB','legF','legB'])pose[key]=q[key].slice();
    return pose;
  };

  function wkSkillCrescent(g,x,y,f,r,sq,start,end,width,alpha) {
    g.save();g.translate(x,y);g.scale(f,1);g.globalAlpha*=alpha;g.beginPath();
    for(let i=0;i<=18;i++) {
      const k=i/18,a=U.lerp(start,end,k),rr=r+Math.sin(k*Math.PI)*width*.22;
      i ? g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr*sq) : g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr*sq);
    }
    for(let i=18;i>=0;i--) {
      const k=i/18,a=U.lerp(start,end,k),rr=r-Math.sin(k*Math.PI)*width;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr*sq);
    }
    g.closePath();g.fillStyle='#f6b53f';g.fill();
    g.beginPath();g.ellipse(0,0,r,r*sq,0,start,end,end<start);g.strokeStyle='#fff0ab';g.lineWidth=1.6;g.stroke();g.restore();
  }
  function drawWkHeavyArc(g,p,t,alpha=1,hitTime=.28) {
    const start=Math.max(0,hitTime-.06);if(t<start || t>hitTime+.12) return;
    const progress=U.clamp((t-start)/(hitTime-start),0,1),fade=1-wkSkillEase((t-hitTime-.01)/.11);
    wkSkillCrescent(g,p.x+p.facing*18,p.y-40,p.facing,92,.60,-1.43,U.lerp(-1.2,.60,progress),9,fade*alpha*.72);
    if(t>=hitTime && t<hitTime+.09) {
      g.save();g.translate(p.x+p.facing*82,p.y-3);g.scale(p.facing,1);g.globalAlpha*=alpha*(1-wkSkillEase((t-hitTime)/.09));
      g.strokeStyle='#f8db83';g.lineWidth=1.6;g.lineCap='round';
      for(let i=0;i<5;i++) {
        const a=-Math.PI+i*Math.PI/4,r=7+(t-hitTime)*130;
        g.beginPath();g.moveTo(Math.cos(a)*r*.45,Math.sin(a)*r*.45);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();
      }
      g.restore();
    }
  }
  function drawWkSlashArcs(g,p,t) {
    for(let i=0;i<3;i++) {
      const hit=[.10,.20,.30][i],start=hit-.035;if(t<start || t>hit+.055) continue;
      const k=U.clamp((t-start)/.035,0,1),fade=1-wkSkillEase((t-hit)/.055),a0=i===1 ? .75 : -1.10,a1=i===1 ? -1.0 : i===2 ? .18 : .66;
      wkSkillCrescent(g,p.x+p.facing*22,p.y-46,p.facing,61,.62,a0,U.lerp(a0,a1,k),5,fade*.64);
    }
  }
  function drawWkFlash(g,p,t) {
    if(t<.02 || t>.32) return;
    const fade=t>.26 ? 1-wkSkillEase((t-.26)/.06) : wkSkillEase((t-.02)/.04);
    g.save();g.translate(p.x,p.y);g.scale(p.facing,1);g.globalAlpha*=fade*.62;
    g.fillStyle='#e6532e';g.beginPath();g.moveTo(-7,-55);g.quadraticCurveTo(-40,-64,-75,-34);
    g.quadraticCurveTo(-57,-40,-49,-35);g.quadraticCurveTo(-62,-27,-70,-24);g.quadraticCurveTo(-35,-33,-11,-20);g.closePath();g.fill();
    g.fillStyle='#f7ba45';g.beginPath();g.moveTo(-12,-47);g.quadraticCurveTo(-31,-53,-52,-36);g.quadraticCurveTo(-34,-39,-12,-27);g.closePath();g.fill();
    g.strokeStyle='#ffe5a0';g.lineWidth=1.4;g.lineCap='round';
    for(let i=0;i<3;i++){g.beginPath();g.moveTo(-19-i*8,-46+i*11);g.lineTo(-54-i*8,-43+i*11);g.stroke();}g.restore();
  }
  let wkShadowCanvas,wkShadowContext;
  function drawWkSkillShadows(g,p,gearOverride) {
    if(!p.skillShadows || !p.skillShadows.length) return;
    if(!wkShadowCanvas) {
      wkShadowCanvas=document.createElement('canvas');wkShadowCanvas.width=240;wkShadowCanvas.height=190;wkShadowContext=wkShadowCanvas.getContext('2d');
    }
    for(const s of p.skillShadows) {
      if(s.life<=0) continue;
      const preparing=p.skillAction==='slash' && p.linkReady && (p.stateT || 0)>.30;
      const alpha=(s.striking || preparing ? .74 : .62)*Math.min(1,s.life/.36)*wkSkillEase((s.age || 0)/.045);if(!alpha) continue;
      const frozen=s.pose || WK_SLASH_COLLECT;
      let q=s.striking ? wkHeavyPose(s.strikeT,s.strikeHitTime || .28,s.strikeDur || .65,!!s.linked,frozen,frozen) : wkSkillMix(frozen,frozen,0);
      if(!s.striking && preparing) q=wkSkillMix(frozen,WK_HEAVY_RAISED,wkSkillSmooth(((p.stateT || 0)-.30)/.12));
      wkFitGrip(q);q.weapon='staff';q.weaponBehind=false;q.regal=true;q.angry=s.striking;q.glow=false;q.cloud=false;q.spin=null;q.lying=false;
      wkShadowContext.clearRect(0,0,240,190);
      renderWukong(wkShadowContext,{x:120,y:150,groundY:150,facing:s.strikeFacing || s.facing,
        visual:{...s.visual,flip:null},animClock:s.age || 0},q,gearOverride);
      wkShadowContext.save();wkShadowContext.globalCompositeOperation='source-atop';wkShadowContext.fillStyle='rgba(255,218,128,.58)';
      wkShadowContext.fillRect(0,0,240,190);wkShadowContext.restore();
      g.save();g.globalAlpha*=alpha;g.shadowColor='rgba(89,62,27,.6)';g.shadowBlur=1.2;g.drawImage(wkShadowCanvas,s.x-120,s.y-150);g.restore();
      if(s.striking) drawWkHeavyArc(g,{x:s.x,y:s.y,facing:s.strikeFacing || s.facing},s.strikeT,.72,s.strikeHitTime || .28);
      g.save();g.globalAlpha*=alpha*.5;g.strokeStyle='#efd17e';g.lineWidth=1;g.beginPath();g.ellipse(s.x,s.y-1,19,4,0,0,TAU);g.stroke();g.restore();
    }
  }

  // 主角与残影直接复用本地骨架与装备上下文，不经过持棍方案预览。
  function renderWukong(g,p,pose,gearOverride) {
    g.save();
    const time = p.animClock || 0;
    // 影子
    const airH = Math.max(0, (p.groundY != null ? p.groundY - p.y : 0));
    if (!p.dead) shadow(g, p.x, p.groundY || p.y, Math.max(6, 16 - airH * 0.04), 0.25);
    const gear=gearOverride==null?(Z.Save&&Z.Save.d&&Z.Save.d.equip):gearOverride;
    pose.weaponItem=gear&&gear.weapon;
    pose.equipment=gear;
    if (p.dead) { pose.lying = true; }
    // 无敌闪烁
    if (p.invulnT > 0 && p.state !== 'dash') g.globalAlpha = (Math.floor(time * 18) % 2) ? 0.45 : 1;
    const drawBody = (ctx) => qCharacter(ctx, {
      x: p.x, y: p.y, f: p.facing, s: 1, pose, time,
      squash: squashOf(p), motion: p.visual,
    }, 'wukong');
    const flip = !p.skillAction && p.visual && p.visual.flip != null ? p.visual.flip : null;
    const drawFlip = (ctx) => {
      if (flip == null) { drawBody(ctx); return; }
      ctx.save();
      ctx.translate(p.x, p.y - 24);
      ctx.rotate(Z.U.TAU * flip * p.facing);
      ctx.translate(-p.x, -(p.y - 24));
      drawBody(ctx);
      ctx.restore();
    };
    if (p.flashT > 0) flashWrap(g, p, 240, 190, drawFlip, 56);
    else drawFlip(g);
    g.restore();
  }
  Z.Spr.drawWukong = function (g,p,gearOverride) {
    g.save();drawWkSkillShadows(g,p,gearOverride);
    const t=p.stateT || 0;
    if(p.skillAction==='flash') drawWkFlash(g,p,t);
    renderWukong(g,p,wkPose(p,p.animClock || 0),gearOverride);
    if(p.skillAction==='heavy') drawWkHeavyArc(g,p,t,1,p.heavyHitTime || .28);
    if(p.skillAction==='slash') drawWkSlashArcs(g,p,t);
    g.restore();
  };

  // 仅持棍方案预览调用；默认悟空与战斗姿态不使用此表。
  const WK_PROPOSALS = {
    A: { lean:.03, wA:Math.PI/2, armF:[.7479,-.8421], armB:[-.18,.18], legF:[.22,.08], legB:[-.28,-.08], runLean:.12, breath:2.2 },
    B: { lean:.04, wA:1.30, armF:[.7955,-.6463], armB:[-.28,.35], legF:[.36,.06], legB:[-.42,-.08], runLean:.08, breath:2.0 },
    C: { lean:.01, wA:1.82, armF:[1.1234,-.9677], armB:[-.12,.08], legF:[.3,.12], legB:[-.32,-.14], runLean:.10, breath:2.4 },
    D: { lean:-.04, wA:1.55, armF:[-.0742,3.5949], armB:[-.35,.24], legF:[.18,.12], legB:[-.38,-.12], runLean:.04, breath:1.9 },
  };
  // variant 为 A/B/C/D，time 为秒；返回无实体引用的新姿态，非法 variant 回退原采样。
  Z.Spr.sampleWukongProposal = function (p, variant, time=p.animClock || 0) {
    if (!Object.prototype.hasOwnProperty.call(WK_PROPOSALS,variant)) return Z.Spr.sampleWukongPose(p,time);
    const base=WK_PROPOSALS[variant],b=Math.sin(time*base.breath);
    const phase=p.visual && Number.isFinite(p.visual.runPhase) ? p.visual.runPhase : time*13;
    const stride=Math.sin(phase),bob=Math.abs(Math.cos(phase));
    const run=p.state==='run' ? U.ease(U.clamp(Math.abs(p.vx || 0)/(p.spd || 252),0,1)) : 0;
    const q={
      dy:U.lerp(3+b*.22,3-bob*1.2,run), lean:U.lerp(base.lean+b*.004,base.runLean,run),
      headA:U.lerp(-.04,-.08,run),wA:base.wA+b*.004*(1-run)+Math.cos(phase)*.02*run,
      tail:U.lerp(-.12+b*.025,-.25+stride*.06,run),
      staffOffset:0,shoulderF:0,grip:-14,gripBlend:0,
      weapon:'staff',weaponBehind:variant==='D',glow:false,angry:false,regal:true,
      cloud:false,spin:null,lying:false,time,
      armF:[base.armF[0]+b*.009*(1-run)+stride*.025*run,base.armF[1]-stride*.02*run],
      armB:[U.lerp(base.armB[0],-stride*.5,run),U.lerp(base.armB[1],.45,run)],
      legF:[U.lerp(base.legF[0],stride*.82,run),U.lerp(base.legF[1],-Math.max(0,-stride)*1.05-.1,run)],
      legB:[U.lerp(base.legB[0],-stride*.82,run),U.lerp(base.legB[1],-Math.max(0,stride)*1.05-.1,run)],
    };
    return q;
  };
  // 仅预览绘制，复用原骨架与 90px 棍；非法 variant 回退正式 drawWukong。
  Z.Spr.drawWukongProposal = function (g, p, variant) {
    if (!Object.prototype.hasOwnProperty.call(WK_PROPOSALS,variant)) return Z.Spr.drawWukong(g,p);
    const time=p.animClock || 0,pose=Z.Spr.sampleWukongProposal(p,variant,time);
    const airH=Math.max(0,p.groundY!=null ? p.groundY-p.y : 0);
    if (!p.dead) shadow(g,p.x,p.groundY || p.y,Math.max(6,16-airH*.04),.25);
    if (p.dead) pose.lying=true;
    if (p.invulnT>0 && p.state!=='dash') g.globalAlpha=(Math.floor(time*18)%2) ? .45 : 1;
    const drawBody=ctx=>qCharacter(ctx,{x:p.x,y:p.y,f:p.facing,s:1,pose,time,squash:squashOf(p),motion:p.visual},'wukong');
    if (p.flashT>0) flashWrap(g,p,240,190,drawBody,56); else drawBody(g);
    g.globalAlpha=1;
  };

  function shadow(g, x, y, r, a) {
    g.save();
    const alpha = g.globalAlpha * a;
    g.globalAlpha = alpha * .22; ell(g, x, y - 1, r * 1.18, r * .32, '#243c3b');
    g.globalAlpha = alpha * .48; ell(g, x, y - 1, r, r * .23, '#1b302f');
    g.globalAlpha = alpha * .75; ell(g, x, y - 1, r * .68, r * .13, '#142926');
    g.restore();
  }
  /* ============ 小怪 ============ */
  function mobPose(e, time) {
    const st = e.state;
    const q = {
      dy: 0, lean: 0, headA: 0,
      armF: [0.3, 0.2], armB: [0.1, 0.25],
      legF: [0.1, 0.05], legB: [-0.1, -0.05],
      wA: 0.1, tail: null, angry: false, time,
    };
    if (st === 'walk') {
      const ph = time * 11;
      const s1 = Math.sin(ph);
      q.lean = 0.08; q.dy = -Math.abs(Math.cos(ph)) * 1.2;
      q.legF = [s1 * 0.65, s1 * 0.65 * 0.35 - 0.1];
      q.legB = [-s1 * 0.65, -s1 * 0.65 * 0.35 - 0.1];
      q.armF = [Math.sin(ph + Math.PI) * 0.35 + 0.35, -0.3];
      q.armB = [Math.sin(ph) * 0.35 + 0.35, -0.3];
      q.wA = 1.35;
    } else if (st === 'tele') {
      q.lean = -0.22; q.dy = 3;
      q.armF = [-1.2, -0.6]; q.wA = -2.3; q.angry = true;
      q.legF = [0.25, -0.2];
    } else if (st === 'atk') {
      q.lean = 0.3; q.armF = [1.7, 0.05]; q.wA = 1.0; q.angry = true;
      q.legF = [0.6, -0.15]; q.legB = [-0.4, -0.25]; q.dy = 1;
    } else if (st === 'shoot') {
      q.lean = 0.15; q.armF = [1.45, 0.05]; q.armB = [1.0, -0.35]; q.wA = 0;
    } else if (st === 'hurt') {
      q.lean = -0.3; q.dy = 2; q.armF = [-0.6, -0.4]; q.wA = -1.6;
    } else if (st === 'down') {
      q.lying = true;
    } else if (st === 'getup') {
      q.lean = -0.22; q.dy = 4; q.armF = [-0.5, -0.3]; q.wA = -1.6;
    } else { // idle
      const b = Math.sin(time * 2.5 + (e.seed || 0) * 7);
      q.dy = b * 1; q.armF = [0.28 + b * 0.02, 0.2]; q.wA = 0.12 + b * 0.03;
    }
    return q;
  }

  // 天兵用长枪前刺，收枪 .42s、出枪 .06s 与正式 AI 的命中窗口一致。
  // 只计算绘制姿态；不写实体或改变战斗状态。
  function qSoldierPose(e,time) {
    const q=mobPose(e,time),guard={lean:.02,dy:0,wA:Math.PI-.08,armF:[.45,.85],armB:[-.5,.7],legF:[.1,.05],legB:[-.1,-.05]};
    const ready={lean:-.16,dy:2,wA:1.88,armF:[-.25,1.12],armB:[-.3,.55],legF:[.3,-.2],legB:[-.3,-.1]};
    const thrust={lean:.24,dy:2.5,wA:Math.PI/2,armF:[1.22,1.42],armB:[.9,1.2],legF:[.58,-.12],legB:[-.46,-.16]};
    q.weapon='spear';
    if(e.state==='tele'||e.state==='atk') {
      const t=e.stateT||0;
      if(e.state==='tele')blendWkPose(q,{...guard,headA:0,tail:0},{...ready,headA:.08,tail:0},U.ease(U.clamp(t/.36,0,1)));
      else if(t<.06)blendWkPose(q,{...ready,headA:.08,tail:0},{...thrust,headA:-.06,tail:0},U.ease(U.clamp(t/.06,0,1)));
      else if(t<.2)blendWkPose(q,{...thrust,headA:-.06,tail:0},{...thrust,headA:-.06,tail:0},0);
      else if(t<.24)blendWkPose(q,{...thrust,headA:-.06,tail:0},{...ready,headA:.08,tail:0},U.ease((t-.2)/.04));
      else blendWkPose(q,{...ready,headA:.08,tail:0},{...guard,headA:0,tail:0},U.ease(U.clamp((t-.24)/.06,0,1)));
      q.grip=-14;q.gripBlend=e.state==='tele' ? U.ease(U.clamp((t-.18)/.18,0,1)) : Math.pow(1-U.clamp((t-.22)/.08,0,1),4);
      q.staffOffset=-10*q.gripBlend;q.angry=true;
    } else if(e.state==='idle'||e.state==='walk') {
      const swing=e.state==='walk'?Math.sin(time*11)*.06:Math.sin(time*2.5)*.015;
      q.armF=[.45+swing,.85];q.armB=guard.armB;q.wA=guard.wA+swing;
    }
    if(e.hitstunT>0 && e.state!=='down' && e.state!=='getup') {
      q.lean-=.18;q.headA=.12;q.dy+=2;q.angry=false;
    }
    return q;
  }

  // 全章节守军原创透明部件；只替换骨架内的头/躯干/壳，四肢、持刀、抛火仍随状态运动。
  const journeyEnemySheets={
    retainers:{file:'journey-enemies-parts-v1.png'},beasts:{file:'journey-beasts-parts-v1.png'},ocean:{file:'journey-ocean-parts-v1.png'},
  };
  const journeyEnemyRects={
    shrimpHead:['retainers',46,5,653,405],shrimpBody:['retainers',783,40,367,378],
    fireHead:['retainers',135,424,456,388],fireBody:['retainers',783,428,385,404],
    generalHead:['retainers',57,822,589,399],generalBody:['retainers',763,842,433,392],
    batBody:['beasts',96,10,479,678],batWing:['beasts',644,169,597,462],
    dogHead:['beasts',14,620,564,617],dogBody:['beasts',592,832,648,366],
    crabBody:['ocean',12,39,652,527],crabClaw:['ocean',682,122,563,401],
    jellyBell:['ocean',24,620,730,550],jellyRibbon:['ocean',920,569,276,675],
  };
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src;
    for(const sheet of Object.values(journeyEnemySheets)) {
      const img=new Image();img.onload=()=>{sheet.image=img;};
      const url=base?new URL('../assets/art/characters/'+sheet.file,base):null;if(url)url.search=new URL(base).search;
      img.src=url?url.href:'assets/art/characters/'+sheet.file;
    }
  }
  Z.Spr.journeyEnemyArtReady=()=>Object.values(journeyEnemySheets).every(sheet=>!!sheet.image);
  function journeyEnemyPart(g,name,x,y,w,h) {
    const [sheet,...rect]=journeyEnemyRects[name],img=journeyEnemySheets[sheet].image;if(!img)return false;
    g.save();g.translate(x,y);
    // 两张毛发轮廓的包围框相邻；按原图留白裁掉邻件，不修改原始 alpha 图。
    if(name==='batBody'){g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(w*.29,h);g.lineTo(0,h*.87);g.closePath();g.clip();}
    if(name==='dogHead'){g.beginPath();g.moveTo(0,h*.14);g.lineTo(w*.145,h*.01);g.lineTo(w*.41,h*.20);g.lineTo(w*.78,h*.20);g.lineTo(w*.95,h*.09);g.lineTo(w,h*.25);g.lineTo(w,h);g.lineTo(0,h);g.closePath();g.clip();}
    g.drawImage(img,...rect,0,0,w,h);g.restore();return true;
  }

  // 天将、虾兵和火妖共用短肢体绘制；色块、头部及装备区别兵种。
  // 攻击姿势严格读取原 AI 的 .42s 起手、.06s 命中与 .30s 收招，不写实体。
  function qRetainer(g,e,time) {
    const shrimp=e.type==='xiabing',fire=e.type==='huoyao',general=e.type==='tianjiang';
    const c=shrimp?{main:'#bf6559',dark:'#713d3c',light:'#eda38b',gold:'#c9bb85',skin:'#de9b7f'}:
      fire?{main:'#644244',dark:'#382f3a',light:'#a97557',gold:'#d79752',skin:'#a85234'}:
      {main:'#914747',dark:'#512f3a',light:'#c37a64',gold:'#d8b16a',skin:'#ecc29b'};
    const t=e.stateT||0,st=e.state,walk=st==='walk'?Math.sin(time*11):0;
    const ease=v=>U.ease(U.clamp(v,0,1));
    const wind=st==='tele'?ease(t/.38):st==='atk'?1-ease((t-.20)/.10):0;
    const strike=st==='atk'?ease(t/.06)*(1-ease((t-.20)/.10)):0;
    const cast=fire&&st==='cast'?(t<.32?ease(t/.23):1-ease((t-.32)/.23)):0;
    const throwOut=fire&&st==='cast'?ease((t-.27)/.05)*(1-ease((t-.39)/.16)):0;
    const hurt=st==='hurt'||e.hitstunT>0?1:0,lean=.04-wind*.13+strike*.32+throwOut*.16-hurt*.19;
    const hip=-25+(Math.abs(walk)*-1.2)+wind*2;
    const shoulder=[Math.sin(lean)*21,hip-Math.cos(lean)*21];
    const hand=[18-wind*21+strike*36-cast*9+throwOut*20-hurt*4,-34-wind*23+strike*17-cast*15+throwOut*7];
    const backHand=[-13+cast*7,-34-cast*11];
    const arm=(s,h,back)=>{
      const dx=h[0]-s[0],dy=h[1]-s[1],len=Math.max(.1,Math.hypot(dx,dy));
      const bend=Math.sqrt(Math.max(0,12*12-len*len/4));
      const elbow=[(s[0]+h[0])/2-dy/len*bend,(s[1]+h[1])/2+dx/len*bend];
      qSegment(g,s,elbow,general?12:9,8,back?c.dark:c.main,c.dark,c.light);
      qSegment(g,elbow,h,9,7,back?c.dark:c.gold,c.dark,c.light);
      g.save();g.translate(...h);qPoly(g,c.skin,[[-4,-3],[2,-4],[4,-1],[3,3],[-3,3]]);g.restore();
    };
    const leg=(x,phase,back)=>{
      const knee=[x+phase*4,hip+12],foot=[x+phase*9,-Math.max(0,phase)*3];
      qSegment(g,[x,hip],knee,12,9,back?c.dark:c.main,c.dark,c.light);
      qSegment(g,knee,foot,9,7,back?c.dark:c.main,c.dark,c.light);qBoot(g,foot,phase*.2,false,back);
    };
    shadow(g,e.x,e.groundY||e.y,general?18:14,.22);
    const body=ctx=>{
      g=ctx;g.save();g.translate(e.x,e.y);g.scale(e.facing||1,1);
      if(st==='down'){g.translate(0,-42);g.rotate(-1.45);g.translate(0,-9);}
      if(st==='getup'){const rise=1-ease(t/.4);g.translate(0,-42*rise);g.rotate(-1.45*rise);g.translate(0,-9*rise);}
      const squash=squashOf(e);g.scale(1+.1*squash,1-.13*squash);
      if(general){qPoly(g,c.dark,[[shoulder[0]-9,shoulder[1]-1],[-29-walk*2,-13],[-24,-7],[-14,-10],[-4,-30]]);
        qPoly(g,c.main,[[shoulder[0]-8,shoulder[1]],[-24-walk*2,-15],[-15,-14],[-5,-31]],false);}
      if(shrimp){ // 分节尾甲与尾扇在躯干后面，不扩大受击框。
        qPoly(g,c.main,[[-12,-29],[-23,-22],[-27,-12],[-22,-8],[-17,-12],[-17,-19],[-9,-22]]);
        qPoly(g,c.light,[[-27,-12],[-35,-16],[-34,-9],[-29,-6],[-22,-8]]);
        g.strokeStyle=c.dark;g.lineWidth=1;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-16-i*3,-24+i*5);g.lineTo(-22-i*2,-23+i*5);g.stroke();}}
      leg(-7,-walk,true);arm([shoulder[0]-9,shoulder[1]+5],backHand,true);leg(7,walk,false);
      g.save();g.translate(0,hip);g.rotate(lean);
      if(!journeyEnemyPart(g,shrimp?'shrimpBody':fire?'fireBody':'generalBody',-18,-26,38,40)) {
      const material=g.createLinearGradient(-15,-22,16,4);material.addColorStop(0,c.light);material.addColorStop(.38,c.main);material.addColorStop(1,c.dark);
      qPoly(g,material,[[-12,-23],[11,-23],[16,-14],[12,3],[-11,3],[-16,-12]]);
      qPoly(g,c.dark,[[-12,-23],[-7,-20],[-7,3],[-11,3],[-16,-12]],false);
      qPoly(g,c.gold,[[-12,-21],[-6,-21],[2,-7],[8,-21],[13,-19],[4,-3],[-2,-3]]);
      qPoly(g,c.main,[[-14,0],[0,1],[-2,14],[-9,12],[-17,9]]);
      qPoly(g,c.light,[[1,1],[13,0],[17,10],[8,14],[2,12]]);
      g.strokeStyle=c.dark;g.lineWidth=1;
      for(let y=-11;y<10;y+=5){g.beginPath();g.moveTo(-10,y);g.lineTo(11,y);g.stroke();}
      qPoly(g,c.dark,[[-13,-1],[13,-1],[13,4],[-13,4]]);ellO(g,1,2,4,3,c.gold,1);
      for(const side of [-1,1]){g.save();g.scale(side,1);qPoly(g,c.main,[[8,-24],[17,-26],[22,-18],[17,-14],[9,-17]]);
        qPoly(g,c.gold,[[9,-24],[17,-26],[22,-18],[19,-18],[15,-22],[10,-21]],false);g.restore();}
      if(fire){qPoly(g,'#e4a453',[[-6,-17],[0,-22],[5,-16],[3,-9],[-2,-7],[-6,-12]]);qPoly(g,'#f9d27c',[[-2,-16],[0,-19],[2,-13],[-1,-11]],false);}
      }
      g.restore();arm([shoulder[0]+9,shoulder[1]+5],hand,false);
      // 宽头盔/虾壳冠/火焰脸沿用统一墨线与两级明暗。
      g.save();g.translate(shoulder[0],shoulder[1]-12);g.rotate(lean*.45);
      const headDrawn=shrimp?journeyEnemyPart(g,'shrimpHead',-55,-41,85,53):fire?journeyEnemyPart(g,'fireHead',-32,-28,46,40):journeyEnemyPart(g,'generalHead',-44,-28,59,40);
      if(!headDrawn) {
      if(fire){
        qPoly(g,'#8a3a2e',[[-14,5],[-17,-8],[-10,-23],[-8,-11],[0,-30],[6,-16],[12,-24],[17,-10],[14,4]]);
        qPoly(g,'#dc7438',[[-11,-4],[-10,-16],[-4,-11],[0,-24],[5,-12],[11,-18],[12,-3]],false);
        qPoly(g,'#f6c16a',[[-6,-7],[0,-19],[3,-8],[8,-11],[5,0],[-2,2]],false);
      } else {
        qPoly(g,c.dark,[[-14,5],[-17,-9],[-12,-20],[0,-24],[12,-20],[17,-8],[14,5]]);
        qPoly(g,c.main,[[-14,-6],[-12,-18],[0,-23],[11,-18],[15,-6],[6,-8],[-5,-6]]);
        qPoly(g,c.light,[[-10,-17],[0,-23],[4,-20],[1,-10],[-7,-9]],false);
        qPoly(g,c.gold,[[-14,-7],[0,-11],[14,-7],[13,-3],[0,-7],[-13,-3]]);
        if(general){qPoly(g,c.gold,[[-3,-23],[0,-30],[4,-22],[3,-12],[-2,-12]]);
          g.beginPath();g.moveTo(0,-26);g.bezierCurveTo(-5,-40,-22,-38,-26,-27);g.quadraticCurveTo(-14,-32,-4,-22);g.closePath();qPaint(g,'#aa3e3b');}
        else {g.strokeStyle=c.dark;g.lineWidth=2;for(const dy of [0,6]){g.beginPath();g.moveTo(4,-20);g.quadraticCurveTo(21,-33-dy,35,-30-dy+Math.sin(time*3)*2);g.stroke();g.strokeStyle=c.light;g.lineWidth=1;g.stroke();g.strokeStyle=c.dark;g.lineWidth=2;}}
      }
      qPoly(g,c.skin,[[-11,-6],[-3,-9],[8,-6],[12,0],[10,10],[3,14],[-7,11],[-12,3]]);
      qPoly(g,shade(c.skin,.77),[[8,-6],[12,0],[10,10],[3,14],[0,9],[6,6]],false);
      if(shrimp){qPoly(g,c.light,[[8,-1],[18,2],[11,5],[8,4]]);qPoly(g,c.dark,[[-12,-1],[-15,5],[-10,11],[-8,6]]);}
      const blink=time%4.1<.10;
      g.strokeStyle=Q_INK;g.lineWidth=1.5;g.beginPath();g.moveTo(-7,-2-wind);g.lineTo(-2,-1);g.moveTo(3,-1);g.lineTo(9,-3-wind);g.stroke();
      if(!blink){qPoly(g,fire?'#ffe6a0':'#fff0cd',[[-7,0],[-2,1],[-3,4],[-7,3]],false);qPoly(g,fire?'#ffe6a0':'#fff0cd',[[3,1],[9,0],[8,4],[4,4]],false);ell(g,-3.5,2,1,1.7,Q_INK);ell(g,7,2,1.1,1.8,Q_INK);}
      g.strokeStyle=Q_INK;g.lineWidth=1;g.beginPath();g.moveTo(1,9);g.lineTo(7,8);g.stroke();
      if(general){qPoly(g,c.dark,[[-2,7],[2,8],[5,7],[7,9],[3,10],[-2,9]]);}
      }
      g.restore();
      if(!fire){g.save();g.translate(...hand);g.rotate(-.18-wind*.7+strike*2.2);
        qPoly(g,'#694c3a',[[-2,7],[2,7],[2,-12],[-2,-12]]);
        qPoly(g,c.gold,[[-7,-10],[7,-10],[6,-14],[-6,-14]]);
        const steel=g.createLinearGradient(-4,-40,6,-12);steel.addColorStop(0,'#f3ebc9');steel.addColorStop(.45,'#b8ced0');steel.addColorStop(1,'#576e7c');
        qPoly(g,steel,[[-3,-13],[-3,-42],[2,-48],[6,-33],[4,-13]]);
        qPoly(g,'#edf1dc',[[-3,-13],[-3,-42],[2,-48],[0,-32],[0,-13]],false);g.restore();
      } else if(cast>0&&t<.32){g.save();g.translate(hand[0]+4,hand[1]-8);g.scale(.45+cast*.55,.45+cast*.55);
        qPoly(g,'#f28a44',[[-7,4],[-10,-3],[-5,-11],[-3,-6],[1,-17],[6,-7],[9,-1],[6,6],[0,9]]);
        qPoly(g,'#ffe4a0',[[-3,5],[-5,0],[0,-8],[4,0],[2,6]],false);g.restore();}
      // 前拳压住剑柄，法师掌心始终跟随真实抛球起点附近。
      g.save();g.translate(...hand);qPoly(g,c.skin,[[-4,-3],[2,-4],[4,-1],[3,3],[-3,3]]);g.restore();g.restore();
    };
    flashWrap(g,e,250,210,body,64);
  }

  Z.Spr.drawMob = function (g, e) {
    const time = e.animClock || 0;
    if (e.type === 'feiyao') { flashWrap(g,e,170,130,ctx=>drawFeiyao(ctx,e,time),32); return; }
    if (e.type === 'xiaotian') { flashWrap(g,e,170,130,ctx=>drawDog(ctx,e,time),48); return; }
    if (e.type === 'xiejiang') { flashWrap(g,e,190,150,ctx=>drawCrab(ctx,e,time),48); return; }
    if (e.type === 'shuimu') { flashWrap(g,e,170,140,ctx=>drawJelly(ctx,e,time),32); return; }
    if (e.type === 'tianjiang' || e.type === 'xiabing' || e.type === 'huoyao') { qRetainer(g,e,time); return; }
    if (e.type === 'gongshou') {
      const pose=mobPose(e,time);
      if(e.hitstunT>0){pose.lean-=0.18;pose.dy+=2;pose.headA=0.12;}
      shadow(g,e.x,e.groundY || e.y,13,0.22);
      flashWrap(g,e,240,190,(ctx)=>qArcher(ctx,{
        x:e.x,y:e.y,f:e.facing,s:0.92,pose,time,
        state:e.state,stateT:e.stateT,hitstun:e.hitstunT>0,squash:squashOf(e),
      }),40);
      return;
    }
    if (e.type === 'tianbing' || e.type === 'niuyao') {
      const bull = e.type === 'niuyao', pose = bull ? mobPose(e,time) : qSoldierPose(e,time);
      pose.weapon = bull ? 'axe' : 'spear';
      if (bull && (e.state === 'idle' || e.state === 'walk')) {
        const swing = e.state === 'walk' ? Math.sin(time * 11) * 0.06 : 0;
        pose.armF = [0.6 + swing, 0.9];
        pose.wA = 0.35 + swing;
      }
      shadow(g,e.x,e.groundY || e.y,bull ? 22 : 13,0.22);
      const drawBody = (ctx) => qCharacter(ctx, {
        x:e.x,y:e.y,f:e.facing,s:bull ? 0.98 : 0.92,pose,time,squash:squashOf(e),
      },e.type);
      flashWrap(g,e,260,210,drawBody,40);
      return;
    }
    // 未知预览类型仍有明确的守军回退；所有正式兵种在上方各自绘制。
    const pose=qSoldierPose(e,time);pose.weapon='spear';
    shadow(g,e.x,e.groundY||e.y,13,.22);
    flashWrap(g,e,240,210,ctx=>qCharacter(ctx,{x:e.x,y:e.y,f:e.facing,s:.92,pose,time,squash:squashOf(e)},'tianbing'),40);
  };

  function drawFeiyao(g,e,time) {
    const tele=e.state==='tele',dive=e.state==='dash',rest=e.state==='recover'||e.state==='down';
    const flap=Math.sin(time*(tele?32:16))*.20;
    g.save();g.translate(e.x,e.y-e.h/2);g.scale(e.facing||1,1);
    if(rest){g.translate(0,7);g.scale(1.12,.65);}else if(dive)g.rotate(.42);
    if(tele)g.translate(Math.sin(time*46)*1.2,-2);
    for(const side of [-1,1]) {
      g.save();g.scale(side,1);g.rotate(rest?-.1:dive?.5:flap);
      if(!journeyEnemyPart(g,'batWing',4,-24,35,28)) {
      const wing=g.createLinearGradient(5,-17,33,7);wing.addColorStop(0,'#ae8caa');wing.addColorStop(.5,'#76628c');wing.addColorStop(1,'#433b61');
      g.beginPath();g.moveTo(4,-4);g.quadraticCurveTo(13,-24,31,-23);
      g.lineTo(36,-5);g.quadraticCurveTo(26,-12,24,1);g.quadraticCurveTo(16,-7,14,8);g.lineTo(5,9);g.closePath();qPaint(g,wing);
      g.strokeStyle='#d0a5a7';g.lineWidth=1;g.beginPath();g.moveTo(6,-3);g.lineTo(31,-22);g.moveTo(7,-1);g.lineTo(24,0);g.moveTo(7,2);g.lineTo(14,7);g.stroke();
      qPoly(g,'#dac0a0',[[29,-22],[32,-27],[35,-20],[31,-20]]);
      }g.restore();
    }
    if(!journeyEnemyPart(g,'batBody',-17,-34,34,48)) {
    const fur=g.createLinearGradient(-12,-15,13,13);fur.addColorStop(0,'#b198ae');fur.addColorStop(.45,'#796981');fur.addColorStop(1,'#453b5b');
    qPoly(g,fur,[[-11,-8],[-8,-16],[3,-18],[11,-12],[14,-2],[11,10],[4,15],[-8,12],[-14,3]]);
    qPoly(g,'#d1bca8',[[-10,2],[-5,0],[0,4],[6,0],[11,3],[6,11],[1,8],[-5,12]]);
    for(const side of [-1,1]){g.save();g.scale(side,1);qPoly(g,'#645570',[[6,-12],[9,-26],[14,-18],[12,-6]]);
      qPoly(g,'#c5a9a7',[[9,-17],[10,-22],[12,-17],[10,-11]],false);g.restore();}
    qPoly(g,'#ccb4a1',[[-9,-7],[-2,-6],[0,-1],[4,-7],[11,-9],[9,-2],[4,2],[-5,1]]);
    g.strokeStyle=Q_INK;g.lineWidth=1.7;g.beginPath();g.moveTo(-9,-8);g.lineTo(-2,-5);g.moveTo(4,-5);g.lineTo(11,-9);g.stroke();
    ell(g,-4,-3,1.3,2,'#45343d');ell(g,8,-4,1.5,2.2,'#45343d');
    ell(g,1,2,3.1,2,'#3c303d');
    qPoly(g,'#f0dfbb',[[-3,5],[-1,10],[1,6],[4,10],[6,4]]);
    }
    for(const side of [-1,1]) {g.save();g.translate(side*5,12);qPoly(g,'#c3b29d',[[-4,0],[-5,5],[-1,3],[1,6],[3,1]]);g.restore();}
    g.restore();
  }

  function drawCrab(g,e,time) {
    const st=e.state,t=e.stateT||0,walk=st==='walk'?Math.sin(time*12):Math.sin(time*2)*.25;
    const wind=st==='tele'?U.ease(U.clamp(t/.42,0,1)):st==='atk'?1:0;
    const hit=st==='atk'?U.ease(U.clamp(t/.06,0,1))*(1-U.ease(U.clamp((t-.2)/.1,0,1))):0;
    g.save();g.translate(e.x,e.y);g.scale(e.facing||1,1);shadow(g,0,0,25,.23);
    if(st==='down'){g.translate(0,-52);g.rotate(Math.PI);}
    if(st==='getup'){const rise=1-U.ease(U.clamp(t/.4,0,1));g.translate(0,-52*rise);g.rotate(Math.PI*rise);}
    const bob=Math.abs(walk)*1.4;
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const foot=[side*(25+i*3)+walk*(i%2?2:-2),-1],knee=[side*(22+i*2),-9-i*3];
      qSegment(g,[side*(11+i*4),-20-bob],knee,5,4,'#ad553e','#633e35','#d49167');
      qSegment(g,knee,foot,4,2,'#c36d4c','#633e35','#d49167');
    }
    const painted=journeyEnemyPart(g,'crabBody',-27,-52-bob,54,44);
    if(!painted) {
    const shell=g.createLinearGradient(-24,-37,23,-12);shell.addColorStop(0,'#e6ad75');shell.addColorStop(.35,'#bd6749');shell.addColorStop(1,'#704335');
    qPoly(g,shell,[[-25,-24-bob],[-19,-38-bob],[-8,-42-bob],[12,-41-bob],[23,-31-bob],[25,-20-bob],[16,-12-bob],[-13,-12-bob]]);
    qPoly(g,'#667a70',[[-18,-33-bob],[-8,-40-bob],[12,-39-bob],[20,-31-bob],[14,-25-bob],[-11,-25-bob]]);
    g.strokeStyle='#d0b879';g.lineWidth=1.3;g.beginPath();g.moveTo(-17,-33-bob);g.lineTo(0,-29-bob);g.lineTo(18,-32-bob);g.moveTo(0,-29-bob);g.lineTo(1,-39-bob);g.stroke();
    qPoly(g,'#d8bf84',[[-5,-36-bob],[1,-40-bob],[7,-35-bob],[1,-31-bob]]);
    // 壳前缘像甲片压住腹甲，重甲体型不靠扩展判定表达。
    qPoly(g,'#d7a26e',[[-15,-24-bob],[16,-24-bob],[12,-14-bob],[0,-11-bob],[-12,-15-bob]]);
    g.strokeStyle='#80533b';g.lineWidth=1;for(let y=-21;y<=-15;y+=3){g.beginPath();g.moveTo(-10,y-bob);g.lineTo(11,y-bob);g.stroke();}
    }
    for(const side of [-1,1]){
      g.save();g.translate(side*23,-26-bob);g.rotate(side*(.15-wind*.5+hit*.75));
      qSegment(g,[0,0],[side*7,-3],7,6,'#a85d42','#6a4034','#dc9b69');
      g.scale(side,1);
      if(!journeyEnemyPart(g,'crabClaw',3,-14,30,22)) {
      qPoly(g,'#c77d52',[[5,-7],[12,-12],[22,-11],[28,-3],[22,4],[12,6],[5,1]]);
      qPoly(g,'#e0b27c',[[12,-12],[22,-11],[28,-3],[24,-2],[20,-7],[11,-7]],false);
      qPoly(g,'#e8cf9b',[[20,-10],[29,-15-wind*5],[28,-7],[23,-3]]);
      qPoly(g,'#bd895e',[[21,3],[30,1+wind*5],[26,7],[19,6]]);
      g.strokeStyle='#744632';g.lineWidth=1.1;g.beginPath();g.moveTo(12,-4);g.lineTo(20,-2);g.stroke();
      }g.restore();
    }
    if(!painted)for(const ex of [-4,8]) {
      qSegment(g,[ex,-34-bob],[ex+2,-45-bob],4,3,'#b87150','#704333','#e2b078');
      ellO(g,ex+2,-46-bob,4.4,4,'#e9d3a0',1);ell(g,ex+3,-45.5-bob,1.7,2.4,'#352f31');
      g.strokeStyle='#694431';g.lineWidth=1.5;g.beginPath();g.moveTo(ex-2,-48-bob);g.lineTo(ex+5,-46.5-bob);g.stroke();
    }
    g.restore();
  }

  function drawJelly(g,e,time) {
    const tele=e.state==='tele',zap=e.state==='atk',charged=tele||zap;
    g.save();g.translate(e.x,e.y-e.h/2+Math.sin(time*2.4)*2.4);g.scale(e.facing||1,1);
    if(e.state==='down'){g.translate(0,-10);g.rotate(1.4);}
    if(e.state==='getup'){const rise=1-U.ease(U.clamp((e.stateT||0)/.4,0,1));g.translate(0,-10*rise);g.rotate(1.4*rise);}
    const pulse=charged?Math.sin(time*24)*.035:Math.sin(time*3)*.025;g.scale(1+pulse,1-pulse);
    // 玉蓝触带与金色结珠保持水母轮廓，避免普通圆脸小人。
    for(let i=0;i<6;i++) {
      const x=-14+i*5.5,sw=Math.sin(time*3+i)*4;
      if(journeyEnemySheets.ocean.image){g.save();g.translate(x,0);g.rotate(sw*.045);journeyEnemyPart(g,'jellyRibbon',-3,0,6,27+i%2*4);g.restore();continue;}
      g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x+sw,9,x-sw,15,x+sw*.7,23+i%2*4);
      g.strokeStyle='#345b75';g.lineWidth=3.6;g.lineCap='round';g.stroke();
      g.strokeStyle=charged?'#d9f3e2':'#93c8c8';g.lineWidth=1.8;g.stroke();
      if(i%2===0)ellO(g,x+sw*.7,22,1.7,2.1,'#d2bd80',.7);
    }
    if(!journeyEnemyPart(g,'jellyBell',-24,-28,48,36)) {
    const bell=g.createLinearGradient(-18,-24,20,7);bell.addColorStop(0,'#e3ead2');bell.addColorStop(.3,'#9cd1cd');bell.addColorStop(.7,'#648fab');bell.addColorStop(1,'#354e79');
    g.beginPath();g.moveTo(-21,1);g.quadraticCurveTo(-24,-15,-10,-23);g.quadraticCurveTo(5,-31,17,-16);
    g.quadraticCurveTo(22,-10,22,1);g.quadraticCurveTo(17,7,10,2);g.quadraticCurveTo(3,8,-4,3);g.quadraticCurveTo(-13,8,-21,1);g.closePath();qPaint(g,bell);
    g.strokeStyle='#c4ded0';g.lineWidth=1;for(const x of [-12,0,12]){g.beginPath();g.moveTo(0,-23);g.quadraticCurveTo(x,-17,x*1.2,0);g.stroke();}
    g.strokeStyle='#d9c88f';g.lineWidth=2.2;g.beginPath();g.moveTo(-20,1);g.quadraticCurveTo(-13,6,-4,2);g.quadraticCurveTo(3,7,10,2);g.quadraticCurveTo(17,6,21,1);g.stroke();
    qPoly(g,'#d5c68e',[[-5,-25],[0,-31],[6,-25],[1,-20]]);ell(g,1,-25,1.5,2,'#faf4d8');
    // 小眼睛嵌在深色伞缘内，不在高光中丢失。
    g.strokeStyle='#2e435e';g.lineWidth=1.7;g.beginPath();g.moveTo(-9,-9);g.lineTo(-4,-7);g.moveTo(3,-7);g.lineTo(9,-9);g.stroke();
    ell(g,-6,-5,1.4,2,'#263d59');ell(g,7,-5,1.5,2,'#263d59');
    }
    if(charged){
      g.strokeStyle='#f4f5c5';g.lineWidth=1.4;
      for(const side of [-1,1]){g.save();g.scale(side,1);g.beginPath();g.moveTo(25,-12);g.lineTo(29,-5);g.lineTo(25,-1);g.lineTo(29,7);g.stroke();g.restore();}
      ell(g,0,-15,3+Math.sin(time*22),3,'#e5efc7');
    }
    g.restore();
  }

  function drawDog(g,e,time) {
    const st=e.state,t=e.stateT||0,walk=st==='walk'?Math.sin(time*18):0;
    const tele=st==='tele'?U.ease(U.clamp(t/.42,0,1)):0,hit=st==='atk'?Math.sin(Math.min(1,t/.3)*Math.PI):0;
    g.save();g.translate(e.x,e.y);g.scale(e.facing||1,1);shadow(g,0,0,20,.22);
    if(st==='down'){g.translate(0,-35);g.rotate(-1.5);g.translate(0,-6);}
    if(st==='getup'){const rise=1-U.ease(U.clamp(t/.4,0,1));g.translate(0,-35*rise);g.rotate(-1.5*rise);g.translate(0,-6*rise);}
    const crouch=tele*4-hit*2;
    // 后腿与弯尾。
    g.beginPath();g.moveTo(-17,-21+crouch);g.bezierCurveTo(-35,-20,-35,-38+Math.sin(time*4)*2,-24,-36);
    g.lineCap='round';g.strokeStyle=Q_INK;g.lineWidth=7;g.stroke();g.strokeStyle='#657583';g.lineWidth=4.5;g.stroke();
    for(const back of [true,false]) {
      for(const x of [-13,12]) {
        const step=walk*(x<0?-1:1)*(back?-1:1),foot=[x+step*5+(back?-3:2),-Math.max(0,step)*3];
        qSegment(g,[x,-18+crouch],[x+step*2,-8+crouch],6,4.5,back?'#45515d':'#74828a','#33414c','#a4b0ad');
        qSegment(g,[x+step*2,-8+crouch],foot,4.5,3.5,back?'#45515d':'#74828a','#33414c','#a4b0ad');
        g.save();g.translate(...foot);qPoly(g,back?'#40505b':'#88928d',[[-3,-3],[3,-3],[6,0],[5,2],[-4,2]]);g.restore();
      }
      if(back) {
        if(!journeyEnemyPart(g,'dogBody',-25,-34+crouch,48,27)) {
        const fur=g.createLinearGradient(-18,-26,16,-10);fur.addColorStop(0,'#9da9a9');fur.addColorStop(.5,'#667784');fur.addColorStop(1,'#394e61');
        g.beginPath();g.ellipse(-3,-21+crouch,21,11,0,0,TAU);qPaint(g,fur);
        qPoly(g,'#3a5264',[[-12,-31+crouch],[-1,-32+crouch],[8,-26+crouch],[1,-19+crouch],[-13,-22+crouch]]);
        g.strokeStyle='#d6bc78';g.lineWidth=1.4;g.beginPath();g.moveTo(-12,-30+crouch);g.lineTo(-4,-24+crouch);g.lineTo(5,-26+crouch);g.stroke();
        }
      }
    }
    g.save();g.translate(12+hit*4-tele*3,-29+crouch);g.rotate(-tele*.2+hit*.18);
    if(!journeyEnemyPart(g,'dogHead',-12,-31,38,42)) {
    qPoly(g,'#a8b8b3',[[-10,3],[-15,-2],[-10,-4],[-13,-10],[-6,-8],[-2,-15],[8,-11],[13,-1],[7,10],[-3,12]]);
    qPoly(g,'#718795',[[-6,-7],[-9,-20],[-1,-16],[4,-8],[8,-19],[13,-16],[12,-2],[6,4],[-4,2]]);
    qPoly(g,'#d3cbb0',[[-5,-9],[-6,-16],[-2,-13]],false);qPoly(g,'#d3cbb0',[[8,-10],[9,-15],[11,-14]],false);
    qPoly(g,'#a5b6b7',[[-3,-5],[8,-8],[13,-3],[20,1],[19,6],[10,8],[2,5],[-4,0]]);
    qPoly(g,'#d7d9c3',[[10,2],[20,1],[19,6],[10,8],[5,5]],false);
    ell(g,19,1,3,2.5,'#34404b');
    qPoly(g,'#ead799',[[4,-3],[10,-4],[9,0],[5,0]],false);ell(g,8,-2,1.1,1.8,'#45382e');
    g.strokeStyle=Q_INK;g.lineWidth=1.4;g.beginPath();g.moveTo(3,-5);g.lineTo(11,-5.5);g.moveTo(11,5);g.lineTo(17,4);g.stroke();
    if(tele||hit>0)qPoly(g,'#eee3c4',[[12,5],[14,10],[16,5]]);
    }
    g.restore();
    qPoly(g,'#9c4b43',[[5,-25+crouch],[12,-24+crouch],[12,-15+crouch],[5,-16+crouch]]);
    ellO(g,10,-15+crouch,3.5,4,'#d7b16c',1);ell(g,10,-15+crouch,1,1.5,'#6b5941');g.restore();
  }

  /* ---- 后八守将：与悟空相同的短肢体、块面、金属边与明确武器轮廓 ---- */
  // 原创透明头/胸甲沿同一关节蒙皮，动作与规则均仍由实体计时驱动。
  const journeyRects = {
    chiguo: { head:[0,0,318,318], chest:[7,318,329,265], at:[-27,-40,49,53] },
    erlang: { head:[319,0,320,326], chest:[337,318,308,267], at:[-28,-40,52,53] },
    yecha: { head:[641,3,306,328], chest:[644,323,304,264], at:[-26,-39,48,52] },
    guiguo: { head:[984,14,268,348], chest:[949,318,299,268], at:[-22,-39,42,55] },
    aoguang: { head:[0,546,338,410], chest:[0,924,341,322], at:[-27,-45,50,61] },
    honghaier: { head:[337,599,291,307], chest:[346,920,299,321], at:[-25,-37,47,50] },
    tieshan: { head:[642,570,295,345], chest:[645,919,301,326], at:[-24,-43,47,56] },
    niuwang: { head:[933,569,320,358], chest:[937,918,316,325], at:[-31,-44,60,68] },
  };
  let journeyAtlas = null;
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src,img=new Image();
    img.onload=()=>{journeyAtlas=img;};
    const url=base?new URL('../assets/art/characters/journey-boss-parts-v1.png',base):null;
    if(url)url.search=new URL(base).search;
    img.src=url?url.href:'assets/art/characters/journey-boss-parts-v1.png';
  }
  Z.Spr.journeyBossArtReady=()=>!!journeyAtlas;
  function journeyPart(g,id,part,x,y,w,h) {
    const rect=journeyRects[id][part];g.save();g.translate(x,y);
    // 龙角、长须与邻近行略重叠；裁掉邻件，PNG 原始 alpha 保持不变。
    if(id==='aoguang'&&part==='head') {
      g.beginPath();g.moveTo(w*.11,h*.03);g.lineTo(w*.25,0);g.lineTo(w*.28,h*.10);g.lineTo(w*.72,h*.09);g.lineTo(w*.80,h*.04);g.lineTo(w,h*.23);g.lineTo(w,h);g.lineTo(w*.76,h);g.lineTo(w*.76,h*.90);g.lineTo(0,h*.90);g.lineTo(0,h*.25);g.closePath();g.clip();
    }
    if(id==='erlang'&&part==='head') {
      g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(w*.61,h);g.lineTo(w*.61,h*.968);g.lineTo(w*.39,h*.968);g.lineTo(w*.39,h);g.lineTo(0,h);g.closePath();g.clip();
    }
    if(id==='guiguo'&&part==='head') {
      g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(w*.70,h);g.lineTo(w*.70,h*.86);g.lineTo(w*.43,h*.835);g.lineTo(0,h*.835);g.closePath();g.clip();
    }
    if(id==='niuwang'&&part==='head') {
      g.beginPath();g.moveTo(0,0);g.lineTo(w*.475,0);g.lineTo(w*.475,h*.035);g.lineTo(w*.85,h*.035);g.lineTo(w*.85,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(w*.55,h);g.lineTo(w*.55,h*.97);g.lineTo(w*.27,h*.97);g.lineTo(w*.27,h);g.lineTo(0,h);g.closePath();g.clip();
    }
    if(part==='chest') {
      g.beginPath();g.moveTo(0,h*.16);g.lineTo(w*.26,h*.07);g.lineTo(w*.39,0);g.lineTo(w*.69,0);g.lineTo(w*.81,h*.12);g.lineTo(w,h*.19);g.lineTo(w,h);g.lineTo(0,h);g.closePath();g.clip();
    }
    g.drawImage(journeyAtlas,...rect,0,0,w,h);g.restore();
  }
  const JOURNEY_STYLE = {
    chiguo: { cloth:'#76528b', dark:'#40324f', light:'#b49bc2', gold:'#d9b46b', skin:'#efc397', hair:'#34303c', weapon:'pipa', robe:true },
    erlang: { cloth:'#8ba6b2', dark:'#334b62', light:'#d9e4df', gold:'#ddbd70', skin:'#edc69f', hair:'#23333f', weapon:'trident' },
    yecha: { cloth:'#3c7280', dark:'#243e4b', light:'#83aeb2', gold:'#d6b471', skin:'#86aaa8', hair:'#294450', weapon:'fork' },
    guiguo: { cloth:'#677c50', dark:'#354935', light:'#adb984', gold:'#d3b273', skin:'#afbf88', hair:'#eee1bf', weapon:'staff', robe:true },
    aoguang: { cloth:'#356c9d', dark:'#253c61', light:'#8ec7d5', gold:'#e5c17a', skin:'#b7d4c6', hair:'#e4e3c6', weapon:'pearl', robe:true },
    honghaier: { cloth:'#bd4939', dark:'#71332c', light:'#ee9c67', gold:'#eac26b', skin:'#f2c49b', hair:'#482a27', weapon:'firespear' },
    tieshan: { cloth:'#438477', dark:'#294d4a', light:'#a6cdb2', gold:'#e7c581', skin:'#f1d0b3', hair:'#263b3e', weapon:'fan', robe:true },
    niuwang: { cloth:'#655044', dark:'#352b2c', light:'#a28b70', gold:'#d39850', skin:'#ae7150', hair:'#382b29', weapon:'axe', heavy:true },
  };
  function journeyPose(e,t) {
    const rest={lean:0,dy:Math.sin(t*2.1)*.45,hand:[24,-40],angle:.12,grip:0,cast:0,strike:0,footF:[12,0],footB:[-12,-1]};
    const q={...rest,hand:rest.hand.slice(),footF:rest.footF.slice(),footB:rest.footB.slice()};
    const mix=(target,k)=>{k=U.clamp(k,0,1);for(const key in target){const a=q[key],b=target[key];q[key]=Array.isArray(b)?b.map((v,i)=>U.lerp(a[i],v,k)):U.lerp(a,b,k);}};
    const ease=v=>U.ease(U.clamp(v,0,1));
    const recovering=e.recoveryT>0,pat=e.pat || (recovering?{n:e.recoverPat,t:e.recoverAt}:null);
    if(!pat && e.state==='walk') {
      const step=Math.sin(t*8.5),speed=U.clamp(Math.abs(e.vx||0)/150,0,1);
      q.lean=.07*speed;q.dy=-Math.abs(Math.cos(t*8.5))*speed;
      q.footF=[12+step*9*speed,-Math.max(0,step)*4*speed];q.footB=[-12-step*9*speed,-Math.max(0,-step)*4*speed];
      q.hand=[24,-40+step*speed];
    }
    if(pat) {
      const T=pat.t||0,n=pat.n;
      q.dy=1;
      if(n==='combo'||n==='slam') {
        const local=n==='slam'?T:T-Math.min(2,Math.floor(T/.55))*.55,wind=n==='slam'?.5:.32;
        mix({hand:[5,-68],angle:-.55,lean:-.1,grip:1,footF:[16,0],footB:[-16,0]},ease(local/wind));
        mix({hand:[31,-39],angle:1.95,lean:.23,dy:4,strike:1},ease((local-wind)/.045));
        const tail=n==='slam'?.72:.45;
        if(local>tail)mix(rest,ease((local-tail)/(n==='slam'?.24:.10)));
      } else if(n==='dash'||n==='charge'||n==='thrust'||n==='spin') {
        const wind=n==='thrust'?.35:n==='spin'?.45:.4,active=T>=wind;
        mix({hand:[9,-43],angle:1.38,lean:-.12,dy:3,grip:1,footF:[18,0],footB:[-17,0]},ease(T/wind));
        if(active) {
          mix({hand:[30,-42],angle:n==='spin'?1.55+Math.sin((T-wind)*17)*.65:1.55,lean:.35,dy:4,strike:1},ease((T-wind)/.055));
          const step=Math.sin((T-wind)*22);q.footF=[18+step*6,-Math.max(0,step)*5];q.footB=[-17-step*6,-Math.max(0,-step)*5];
        }
      } else {
        const at=n==='wave'?.45:n==='waves3'?.5:n==='breath'?.55:n==='blink'?.35:.6;
        mix({hand:[20,-55],angle:-.4,lean:-.05,cast:1,footF:[14,0],footB:[-14,0]},ease(T/(at*.8)));
        const pulse=n==='wave'?Math.max(0,1-Math.abs(T-.45)/.16,1-Math.abs(T-.72)/.16):Math.max(0,1-(T-at)/.26)*(T>=at?1:0);
        mix({hand:[31,-43],angle:.95,lean:.15,strike:1},pulse);
      }
      if(recovering)mix(rest,ease((1-e.recoveryT/e.recoveryDur-.10)/.65));
    }
    if(e.bid==='chiguo') { q.hand=[18+q.strike*4,-38+Math.sin(t*22)*q.cast*2];q.angle=-.25;q.grip=0; }
    if(e.bid==='tieshan') { q.grip=0;q.hand=[23+q.strike*7,-45-q.cast*8];q.angle=-.2+q.strike*1.2; }
    if(e.hitstunT>0)q.lean-=.08;
    return q;
  }
  function journeyArm(g,shoulder,hand,c,back) {
    const dx=hand[0]-shoulder[0],dy=hand[1]-shoulder[1],len=Math.max(.01,Math.hypot(dx,dy));
    const bend=Math.sqrt(Math.max(0,17*17-len*len/4));
    const elbow=[(shoulder[0]+hand[0])/2-dy/len*bend,(shoulder[1]+hand[1])/2+dx/len*bend];
    qSegment(g,shoulder,elbow,c.heavy?15:11,c.heavy?12:9,back?c.dark:c.cloth,c.dark,c.light);
    qSegment(g,elbow,hand,c.heavy?12:9,c.heavy?10:7,back?shade(c.gold,.7):c.gold,shade(c.gold,.45),shade(c.gold,1.22));
    g.save();g.translate(...elbow);ellO(g,0,.5,c.heavy?3.6:2.8,3.2,back?c.dark:c.cloth,.8);ell(g,-.6,-.5,1,1.2,c.light);g.restore();
    g.save();g.translate(...hand);
    g.beginPath();g.moveTo(-3.3,-3);g.quadraticCurveTo(0,-4.5,3,-3);g.quadraticCurveTo(5,-1,4,2.5);g.quadraticCurveTo(1,5,-3,3);g.quadraticCurveTo(-5.6,.5,-3.3,-3);g.closePath();qPaint(g,back?shade(c.skin,.8):c.skin);
    g.strokeStyle=shade(c.skin,.62);g.lineWidth=.65;g.beginPath();g.moveTo(-1,-1.8);g.quadraticCurveTo(1,-.6,2,1.4);g.moveTo(1.3,-2);g.lineTo(2.8,-.1);g.stroke();
    ell(g,-1.8,-1.9,1.4,.8,shade(c.skin,1.1));g.restore();
  }
  function journeyHead(g,id,c,p,t,rage) {
    if(journeyAtlas) {journeyPart(g,id,'head',...journeyRects[id].at);return;}
    const angry=!!p.strike||rage;
    if(id==='niuwang') { g.save();g.scale(1.18,1.14);qBullHead(g,{angry});g.restore();
      qPoly(g,'#382b29',[[-9,12],[9,13],[6,23],[0,20],[-5,23],[-10,17]]);return; }
    // 头发、耳朵与不对称三分之二侧脸。
    qPoly(g,c.hair,[[-16,-6],[-17,-17],[-11,-24],[2,-25],[13,-21],[17,-9],[13,6],[-12,8]]);
    ellO(g,-14,0,4.5,5.5,c.skin,1);ellO(g,14,0,3,4,c.skin,1);
    const face=cachedGrad(g,'journey-face-'+id,()=>{const gr=g.createLinearGradient(-12,-12,14,13);gr.addColorStop(0,shade(c.skin,1.15));gr.addColorStop(.55,c.skin);gr.addColorStop(1,shade(c.skin,.8));return gr;});
    qPoly(g,face,[[-12,-13],[-3,-16],[9,-13],[14,-6],[13,7],[7,14],[-5,13],[-13,5]]);
    qPoly(g,shade(c.skin,.85),[[11,-5],[14,-4],[13,7],[7,14],[2,12],[9,7]],false);
    const blink=t%4.1<.09&&!angry;
    if(!blink) {
      qPoly(g,'#fff3d9',[[-7,-3],[-2,-2],[-2,2],[-7,1]],false);
      qPoly(g,'#fff3d9',[[3,-4],[11,-2],[10,3],[4,2]],false);
      ell(g,-3,-.5,1.2,1.9,'#35312e');ell(g,8,-.5,id==='tieshan'?1.3:1.6,2.2,'#35312e');ell(g,7.6,-1.2,.5,.7,'#fff');
    }
    g.strokeStyle=shade(c.hair,.75);g.lineWidth=id==='guiguo'?2.2:1.6;g.lineCap='round';
    g.beginPath();g.moveTo(-8,-5);g.lineTo(-1,angry?-2:-4);g.moveTo(3,angry?-2:-4);g.lineTo(11,-5);g.stroke();
    if(blink){g.beginPath();g.moveTo(-7,0);g.lineTo(-2,0);g.moveTo(4,0);g.lineTo(10,0);g.stroke();}
    g.strokeStyle=shade(c.skin,.55);g.lineWidth=.9;g.beginPath();g.moveTo(6,5);g.lineTo(10,5);g.moveTo(3,9);g.quadraticCurveTo(7,11,10,8.5);g.stroke();
    if(id==='honghaier') {
      for(const side of [-1,1]) {ellO(g,side*12,-20,7,6,c.hair,1.2);qPoly(g,'#ce5141',[[side*9,-17],[side*17,-15],[side*20,-10],[side*14,-13]]);}
      qPoly(g,c.hair,[[-11,-13],[-6,-20],[3,-18],[10,-13],[5,-15],[1,-10],[-3,-15]]);
      ellO(g,1,-15,3,3.5,c.gold,.8);
    } else if(id==='tieshan') {
      ellO(g,-3,-25,10,7,c.hair,1.3);qPoly(g,c.hair,[[-15,-12],[-11,-22],[3,-23],[14,-14],[7,-16],[1,-18],[-6,-11]]);
      g.strokeStyle=c.gold;g.lineWidth=2;g.beginPath();g.moveTo(-14,-26);g.lineTo(12,-25);g.stroke();
      for(const x of [9,13]){ellO(g,x,-25,2.5,2.8,x===9?'#8bdbc3':c.gold,.7);g.strokeStyle=c.gold;g.lineWidth=.8;g.beginPath();g.moveTo(x,-22);g.lineTo(x+1,-13);g.stroke();ell(g,x+1,-12,1.5,2,'#d8ead1');}
      g.strokeStyle='#9c5a51';g.lineWidth=1.2;g.beginPath();g.moveTo(4,9);g.quadraticCurveTo(7,10,9,8.8);g.stroke();
    } else if(id==='yecha') {
      for(const side of [-1,1])qPoly(g,'#d7ccb1',[[side*10,-14],[side*19,-24],[side*18,-8],[side*11,-5]]);
      qPoly(g,c.gold,[[-10,-14],[-4,-20],[0,-31],[5,-22],[13,-15],[5,-12],[-3,-13]]);
      qPoly(g,'#f4e5bd',[[-3,8],[0,15],[1,7]],false);qPoly(g,'#f4e5bd',[[9,7],[11,14],[12,5]],false);
    } else if(id==='aoguang') {
      for(const side of [-1,1]) {g.strokeStyle='#7f653f';g.lineWidth=5;g.beginPath();g.moveTo(side*11,-16);g.lineTo(side*15,-29);g.lineTo(side*24,-34);g.moveTo(side*15,-28);g.lineTo(side*12,-36);g.stroke();g.strokeStyle=c.gold;g.lineWidth=3;g.stroke();}
      qPoly(g,c.gold,[[-10,-16],[-9,-22],[-3,-20],[2,-28],[7,-20],[13,-19],[11,-14]]);
      for(const side of [-1,1]) {g.strokeStyle=c.hair;g.lineWidth=1.6;g.beginPath();g.moveTo(side*5,7);g.bezierCurveTo(side*21,5,side*29,16,side*24,20);g.stroke();}
      qPoly(g,c.hair,[[-4,11],[8,11],[5,27],[1,24],[-2,27],[-5,18]]);
    } else if(id==='guiguo') {
      qPoly(g,c.hair,[[-8,7],[-1,8],[1,13],[-13,13]]);qPoly(g,c.hair,[[5,8],[11,7],[17,12],[8,13]]);
      qPoly(g,c.hair,[[-4,12],[8,12],[7,24],[2,30],[-3,24],[-6,17]]);
      qPoly(g,c.dark,[[-13,-15],[-11,-25],[9,-26],[14,-17]]);qPoly(g,c.gold,[[-12,-17],[13,-18],[13,-14],[-12,-13]]);ellO(g,2,-24,3.5,3.5,'#a8c98a',.9);
    } else {
      // 持国冠与二郎翼冠以形制区别，第三眼保留在眉心。
      qPoly(g,c.gold,[[-16,-13],[-14,-23],[-7,-20],[-3,-31],[3,-24],[10,-30],[14,-19],[16,-14],[7,-11],[-8,-12]]);
      qPoly(g,c.cloth,[[-10,-16],[-8,-22],[-2,-20],[3,-26],[7,-22],[11,-24],[11,-16]]);ellO(g,3,-17,3,4,id==='chiguo'?'#ad6d9d':'#7fc0c6',.8);
      if(id==='erlang') {for(const side of [-1,1])qPoly(g,'#bfced0',[[side*12,-19],[side*24,-28],[side*21,-15],[side*13,-10]]);qPoly(g,'#f1d893',[[1,-10],[3,-13],[5,-10],[3,-6]],false);ell(g,3,-9.5,.8,1.8,'#755a33');}
    }
  }
  function journeyWeapon(g,kind,hand,angle,c,cast) {
    g.save();g.translate(...hand);g.rotate(angle);
    const metal=g.createLinearGradient(-22,-58,22,-24);metal.addColorStop(0,'#f3e8c6');metal.addColorStop(.27,'#b9ced0');metal.addColorStop(.52,'#728d96');metal.addColorStop(.58,'#d7e3da');metal.addColorStop(1,'#70808a');
    const gold=g.createLinearGradient(-10,-50,12,-20);gold.addColorStop(0,'#f9e4a5');gold.addColorStop(.38,c.gold);gold.addColorStop(1,shade(c.gold,.55));
    if(kind==='pipa') {
      // v84：琵琶放大 1.45× 并侧倾——原尺寸琴颈被前臂遮住，读作圆盾
      g.scale(1.45,1.45);
      qPoly(g,'#80513a',[[-3.4,-36],[3.4,-36],[4.2,-8],[-4.2,-8]]);
      g.beginPath();g.moveTo(-5,-15);g.bezierCurveTo(-9,-8,-17,-5,-14.5,8);g.bezierCurveTo(-12,21.5,12.5,21.5,15,8);g.bezierCurveTo(16.5,-4,7,-9,4.8,-15);g.closePath();qPaint(g,'#b8935c');
      ellO(g,1,5,10,12,'#d9b273',1);g.strokeStyle='#7a5433';g.lineWidth=.8;
      for(const x of [-2,0,2]){g.beginPath();g.moveTo(x,-34);g.lineTo(x,14);g.stroke();}
      for(const y of [-30,-25,-20,-15])qPoly(g,c.gold,[[-5,y],[5,y],[5,y+1.6],[-5,y+1.6]],false);
      ell(g,-5,6,1.8,2.4,'#624a34');ell(g,7.5,6,1.8,2.4,'#624a34');
      g.strokeStyle='rgba(255,244,214,.5)';g.lineWidth=.7;g.beginPath();g.moveTo(-12,2);g.quadraticCurveTo(0,7,13,2);g.stroke();
    } else if(kind==='fan') {
      qPoly(g,'#956b41',[[-2,5],[2,5],[2,-7],[-2,-7]]);
      g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(-15,-8,-28,-25);g.bezierCurveTo(-21,-44,18,-45,30,-26);g.quadraticCurveTo(15,-9,0,0);g.closePath();qPaint(g,'#86b79b');
      g.strokeStyle=c.gold;g.lineWidth=1.2;for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(i*5,-16,i*8,-30-Math.max(0,3-Math.abs(i))*2);g.stroke();}
      g.strokeStyle='#d7e4b3';g.lineWidth=2;g.beginPath();g.moveTo(-25,-25);g.bezierCurveTo(-17,-39,16,-39,27,-26);g.stroke();
    } else {
      qPoly(g,kind==='axe'?'#604333':'#765342',[[-2.1,-46],[2.1,-46],[2.1,29],[-2.1,29]]);
      qPoly(g,c.gold,[[-3,-8],[3,-8],[3,1],[-3,1]],false);qPoly(g,c.gold,[[-3,24],[3,24],[3,30],[-3,30]]);
      if(kind==='axe') {
        // v84：斧刃改玄铁色（原冷白钢读作水晶），刃口留冷光
        const iron=g.createLinearGradient(-26,-52,26,-24);iron.addColorStop(0,'#8d897f');iron.addColorStop(.45,'#57534b');iron.addColorStop(.75,'#413e38');iron.addColorStop(1,'#767065');
        for(const side of [-1,1])qPoly(g,iron,[[0,-43],[side*12,-52],[side*24,-51],[side*28,-36],[side*22,-23],[side*10,-26],[0,-36]]);
        for(const side of [-1,1])qPoly(g,'#d9d5c9',[[side*24,-51],[side*28,-36],[side*22,-23],[side*18,-26],[side*23,-37]],false);
        g.strokeStyle=shade(c.gold,.6);g.lineWidth=.9;for(const side of [-1,1]){g.beginPath();g.moveTo(side*8,-39);g.quadraticCurveTo(side*20,-49,side*19,-37);g.quadraticCurveTo(side*13,-31,side*13,-38);g.stroke();}
        ellO(g,0,-37,5,6,gold,1);ell(g,-1.2,-39,1.2,2,'#fbe7af');
      } else if(kind==='pearl'||kind==='staff') {
        g.strokeStyle=c.gold;g.lineWidth=5;g.beginPath();g.moveTo(0,-39);g.bezierCurveTo(-13,-46,-8,-59,1,-56);g.bezierCurveTo(13,-55,12,-42,0,-39);g.stroke();
        const gem=g.createRadialGradient(-1,-52,1,1,-49,7);gem.addColorStop(0,'#f5fae0');gem.addColorStop(.4,kind==='pearl'?'#ace6e3':'#afc48b');gem.addColorStop(1,kind==='pearl'?'#3b868f':'#52683f');
        ellO(g,1,-49,6,7,gem,1);ell(g,-1,-52,1.5,1.7,'#f7f4ce');
      } else {
        qPoly(g,metal,[[0,-67],[-6,-49],[-2,-36],[2,-36],[6,-49]]);qPoly(g,'#f5e9c8',[[0,-65],[-4,-49],[0,-40]],false);
        if(kind==='trident'||kind==='fork')for(const side of [-1,1])qPoly(g,metal,[[side*3,-39],[side*13,-44],[side*13,-58],[side*8,-52],[side*8,-46],[side*3,-44]]);
        const red=kind==='firespear'?'#cc4f36':'#a84643';qPoly(g,red,[[-3,-39],[-12,-30],[-17,-35],[-13,-22],[-3,-32],[5,-32],[8,-22],[12,-34],[3,-39]]);
      }
      g.strokeStyle='rgba(255,239,190,.6)';g.lineWidth=.7;g.beginPath();g.moveTo(-.7,-31);g.lineTo(-.7,21);g.stroke();
    }
    if(cast>0){g.globalAlpha*=cast*.5;g.strokeStyle=c.gold;g.lineWidth=1;g.beginPath();g.ellipse(0,-35,8,13,0,0,TAU);g.stroke();}
    g.restore();
  }
  function qJourneyBoss(g,e,t) {
    const id=e.bid,c=JOURNEY_STYLE[id],p=journeyPose(e,t),s=(e.h||100)/100;
    const hip=-28+p.dy,sh=[Math.sin(p.lean)*26,hip-Math.cos(p.lean)*26],wide=c.heavy?16:11;
    const hand=[p.hand[0],p.hand[1]+p.dy],back=id==='chiguo'?[8,-61+p.dy]:[U.lerp(-18,hand[0]-Math.sin(p.angle)*16,p.grip),U.lerp(hip-5,hand[1]+Math.cos(p.angle)*16,p.grip)];
    g.save();g.translate(e.x,e.y);g.scale((e.facing||1)*s,s);
    if(e.dead||e.state==='down'){g.rotate(-Math.PI*.47);g.translate(0,-10);}
    const sway=Math.sin(t*4)*2,trail=Math.min(12,Math.abs(e.vx||0)/35);
    if(id==='guiguo') {
      ellO(g,-11,sh[1]+13,23,27,'#445a40',1.8);ellO(g,-14,sh[1]+11,18,23,'#8d8d54',1.2);
      g.strokeStyle='#526442';g.lineWidth=1.4;g.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;g.moveTo(-14+Math.cos(a)*8,sh[1]+11+Math.sin(a)*9);g.lineTo(-14+Math.cos(a)*17,sh[1]+11+Math.sin(a)*21);}g.stroke();qPoly(g,'#728254',[[-22,sh[1]+6],[-15,sh[1]+1],[-7,sh[1]+6],[-7,sh[1]+16],[-15,sh[1]+21],[-22,sh[1]+16]]);
    } else {
      g.beginPath();g.moveTo(sh[0]-9,sh[1]);g.quadraticCurveTo(-29-trail,hip-11,-31-trail+sway,hip+15);g.lineTo(-8,hip+9);g.lineTo(sh[0]+2,sh[1]+3);g.closePath();qPaint(g,c.dark);
      g.strokeStyle=c.gold;g.lineWidth=1.2;g.beginPath();g.moveTo(-29-trail+sway,hip+12);g.quadraticCurveTo(-22,hip+15,-10,hip+7);g.stroke();
    }
    const leg=(x,foot,backLeg)=>{
      const knee=[(x+foot[0])*.5+(backLeg?-2:2),hip*.48];
      qSegment(g,[x,hip],knee,c.heavy?15:11,9,backLeg?c.dark:c.cloth,c.dark,c.light);
      qSegment(g,knee,foot,9,7,backLeg?c.dark:c.cloth,c.dark,c.light);
      g.save();g.translate(...knee);qPoly(g,backLeg?shade(c.gold,.7):c.gold,[[-4,-3],[3,-4],[5,0],[2,4],[-3,3]]);g.strokeStyle=c.light;g.lineWidth=.7;g.beginPath();g.moveTo(-2,-2);g.lineTo(2,-2);g.stroke();g.restore();
      g.save();g.translate(...foot);g.beginPath();g.moveTo(-5,-7);g.quadraticCurveTo(0,-10,4,-7);g.lineTo(5,-3);g.quadraticCurveTo(12,-3,12,0);g.quadraticCurveTo(8,3,-5,2);g.closePath();qPaint(g,c.dark);
      g.strokeStyle=c.gold;g.lineWidth=1.2;g.beginPath();g.moveTo(-4,-6);g.quadraticCurveTo(0,-7,4,-6);g.moveTo(-4,1);g.quadraticCurveTo(4,2,10,.6);g.stroke();g.strokeStyle=c.light;g.lineWidth=.7;g.beginPath();g.moveTo(1,-4);g.quadraticCurveTo(7,-3,8,-2);g.stroke();g.restore();
    };
    leg(-8,p.footB,true);journeyArm(g,[sh[0]-wide,sh[1]+3],back,c,true);
    g.save();g.translate(0,hip);g.rotate(p.lean);
    if(c.robe)qPoly(g,c.cloth,[[-15,-8],[13,-8],[22,24],[4,28],[-21,24]]);
    qPoly(g,c.cloth,[[-wide-5,-25],[-7,-30],[8,-30],[wide+6,-24],[wide+3,-3],[7,5],[-14,3]]);
    qPoly(g,c.dark,[[-wide-5,-25],[-7,-30],[-6,2],[-14,3]],false);
    if(id==='honghaier')qPoly(g,c.skin,[[-7,-27],[7,-27],[11,-8],[-8,-8]]);
    else for(let y=-21;y<-4;y+=5)for(let x=-9;x<=12;x+=7){g.strokeStyle=c.light;g.lineWidth=.7;g.beginPath();g.arc(x,y,3,0,Math.PI);g.stroke();}
    for(const side of [-1,1])qPoly(g,c.gold,[[side*9,-28],[side*(wide+8),-28],[side*(wide+12),-19],[side*(wide+5),-15],[side*10,-18]]);
    qPoly(g,c.light,[[-10,-28],[0,-22],[10,-28],[12,-24],[0,-17],[-12,-24]]);
    qPoly(g,c.gold,[[-17,-3],[17,-3],[17,3],[-17,3]]);ellO(g,1,0,4,4.5,c.dark,.9);ell(g,1,-.5,1.8,2,id==='honghaier'?'#ef8e4e':'#bce0c6');
    if(!c.robe)for(const x of [-13,-3,7])qPoly(g,c.cloth,[[x,4],[x+9,4],[x+11,14],[x+2,17],[x-2,13]]);
    else {g.strokeStyle=c.gold;g.lineWidth=1.8;g.beginPath();g.moveTo(-18,21);g.quadraticCurveTo(0,28,19,21);g.stroke();}
    if(journeyAtlas) {
      // 胸甲覆盖原有形体，衣摆仍与双腿独立；前臂随后压在肩甲之上。
      const chestW=c.heavy?51:46;
      journeyPart(g,id,'chest',-chestW*.5,-31,chestW,c.robe?40:38);
    }
    g.restore();leg(8,p.footF,false);
    // 武器先入手，再绘拳头；琵琶双手分别抱颈、拨弦。
    // v85 颈部填充：躯干绕髋旋转而头只转 35%，攻防姿势下领口会脱开——立领色柱画在头之下、胸之上，任何姿势保持相连。
    qPoly(g, c.dark, [[sh[0] - 5.5, sh[1] - 12], [sh[0] + 5.5, sh[1] - 12], [sh[0] + 6.5, sh[1] + 6], [sh[0] + 4.5, sh[1] + 13], [sh[0] - 4.5, sh[1] + 13], [sh[0] - 6.5, sh[1] + 6]]);
    g.strokeStyle = c.gold; g.lineWidth = 1;
    g.beginPath(); g.moveTo(sh[0] - 5, sh[1] - 10.5); g.lineTo(sh[0] + 5, sh[1] - 10.5); g.stroke();
    journeyWeapon(g,c.weapon,id==='chiguo'?[24,-40+p.dy]:hand,id==='chiguo'?0.55:p.angle,c,p.cast*(1-p.strike));
    journeyArm(g,[sh[0]+wide,sh[1]+3],hand,c,false);
    if(p.grip>.01){g.save();g.translate(...back);qPoly(g,c.skin,[[-4,-3],[3,-3],[4,2],[-2,4],[-4,1]]);g.restore();}
    g.save();g.translate(sh[0],sh[1]-17);g.rotate(p.lean*.35);journeyHead(g,id,c,p,t,e.phase>=2);g.restore();
    if(e.phase>=2&&(id==='niuwang'||id==='honghaier')) {g.save();g.globalAlpha=.32;g.strokeStyle='#ef9c4c';g.lineWidth=2;g.beginPath();g.moveTo(sh[0]-wide-6,sh[1]+3);g.lineTo(sh[0]-wide-4,sh[1]-7);g.moveTo(sh[0]+wide+5,sh[1]+3);g.lineTo(sh[0]+wide+7,sh[1]-7);g.stroke();g.restore();}
    g.restore();
  }

  /* ============ Boss ============ */
  Z.Spr.drawBoss = function (g, e, time) {
    const t = e.animClock || 0;
    if (e.bid === 'juling') {
      shadow(g,e.x,e.groundY || e.y,32,0.28);
      flashWrap(g,e,360,300,ctx=>qJuling(ctx,e,t),80);
      return;
    }
    if (e.bid === 'zengzhang') {
      shadow(g,e.x,e.groundY ?? e.y,27,.28);
      flashWrap(g,e,340,260,ctx=>qZeng(ctx,e,t),100);
      return;
    }
    if (JOURNEY_STYLE[e.bid]) {
      shadow(g,e.x,e.groundY??e.y,e.bid==='niuwang'?32:24,.28);
      flashWrap(g,e,400,320,ctx=>qJourneyBoss(ctx,e,t),85);
      return;
    }
    // 未知扩展首领仍有可辨识回退；已知守将均走上面的专属绘制。
    shadow(g,e.x,e.groundY??e.y,24,.28);
    flashWrap(g,e,360,300,ctx=>qJuling(ctx,e,t),80);
  };

  /* ============ 宠物 ============ */
  // 认可 r1 灵兽原画的独立头、躯干、四肢/翼/耳/尾图集；只读真实助战事件。
  const petRects={
    hou:[[14,0,449,460],[486,110,319,330],[874,59,339,376],[92,492,280,270],[502,492,272,284],[843,548,377,148],[49,815,314,360],[512,825,257,347],[799,742,448,471]],
    tu:[[14,91,406,343],[449,104,401,318],[894,31,341,413],[48,494,376,319],[478,523,276,292],[928,493,266,355],[88,886,306,320],[548,889,271,310],[912,951,297,201]],
    he:[[70,7,347,414],[464,110,338,271],[856,45,379,376],[25,424,415,399],[463,442,375,375],[986,476,197,310],[141,866,184,342],[454,821,393,415],[916,917,297,268]],
    long:[[60,13,434,434],[547,113,259,327],[870,107,361,300],[24,463,439,363],[537,506,262,280],[958,532,254,238],[89,864,237,330],[505,878,227,316],[829,803,422,434]],
  };
  const petAtlases={};
  if(typeof Image!=='undefined') {
    const base=document.currentScript&&document.currentScript.src;
    for(const id of Object.keys(petRects)) {
      const img=new Image();
      img.onload=()=>{if(img.naturalWidth===1254&&img.naturalHeight===1254)petAtlases[id]=img;};
      const file='pet-'+id+'-parts-'+(id==='hou'?'r2':'r1')+'.png';
      const url=base?new URL('../assets/art/pets/'+file,base):null;
      if(url)url.search=new URL(base).search;
      img.src=url?url.href:'assets/art/pets/'+file;
    }
  }
  Z.Spr.petArtReady=ptype=>!!petAtlases[ptype];
  function petPart(g,id,i,x,y,w,h,ax=.5,ay=.5,a=0) {
    g.save();g.translate(x,y);g.rotate(a);
    g.drawImage(petAtlases[id],...petRects[id][i],-w*ax,-h*ay,w,h);g.restore();
  }
  function drawPetArt(g,pet,clock,active,phase,walk,step,breath) {
    const id=pet.ptype,part=(...args)=>petPart(g,id,...args);
    // showAction 与命中/发射/治疗同帧；第一帧即出力，余下时长完整回收。
    const k=active?1-U.ease(phase):0;
    if(id==='hou') {
      g.translate(7*k,-breath-5*k-Math.abs(step)*.7);g.rotate(.18*k);
      part(2,-7,-12,20,23,.94,.88,-.12+Math.sin(clock*3)*.06-.2*k);
      part(7,-4,-12,10,14,.58,.10,step*.22+.55*k);
      part(4,-4,-25,10,12,.16,.17,-step*.22+.5*k);
      part(1,0,-20,20,22);
      part(6,4,-11,11,14,.57,.10,-step*.22+.75*k);
      part(5,4,-23,18,7,.96,.58,Math.sin(clock*4)*.07+.2*walk+.35*k);
      part(3,5,-25,13,13,.16,.17,step*.22-.85*k);
      part(active&&phase<.65?8:0,2,-22,27,27,.50,.94,-.04*k+breath*.015);
    } else if(id==='tu') {
      const dose=active?(.55+.45*Math.cos(phase*TAU*2))*(1-phase):0;
      g.translate(0,-breath-Math.abs(step)*.8);
      part(7,-4,-10,9,11,.40,.11,step*.12);
      part(1,0,-13,19,19);
      part(6,3,-8,10,10,.43,.10,-step*.12);
      part(5,-2,-15,9,12,.48,.20,.08+Math.sin(clock*3)*.035);
      // 耳根先入头部；耳朵与头独立，跟随步伐滞后摇摆。
      g.save();g.translate(3,-21);g.rotate(-.03*dose+Math.sin(clock*3)*.02);
      part(2,-4,-14,8,19,.78,.94,-.22+Math.sin(clock*4)*.05-step*.04);
      part(3,10,-22,16,18,.24,.20,.12+Math.sin(clock*4-.7)*.06+step*.03);
      part(0,0,0,24,21,.50,.82);g.restore();
      part(8,13,-2,11,7,.5,.86);
      part(4,6,-16+3.4*dose,11,12,.20,.15,-.13+.12*dose);
    } else if(id==='he') {
      g.translate(2*k,-26+Math.sin(clock*5)*1.2-k);
      const flap=Math.sin(clock*6)*.33,spread=-.52*k;
      part(4,-2,-2,24,24,.93,.86,flap*.8+spread-.1);
      part(2,-8,1,23,23,.96,.27,Math.sin(clock*4)*.10-.12*k);
      part(6,-2,5,6,10,.25,.10,.08+flap*.12);
      part(5,3,5,6,10,.28,.10,-.08-flap*.12);
      part(1,0,0,24,18);
      part(active&&phase<.65?7:0,6,-1,22,26,.60,.96,-.10*k);
      part(3,1,-2,26,25,.94,.86,flap+spread+.14);
    } else if(id==='long') {
      g.translate(2*k,-30+Math.sin(clock*4)*1.2-k);
      const sway=Math.sin(clock*3.8)*.07;
      part(7,-10,2,7,10,.52,.08,-.2-sway);
      part(5,6,0,9,8,.20,.10,-.05+.22*k);
      // 后躯段和尾段各自摆动，连接处重叠覆盖隐藏接点。
      g.save();g.translate(-.5,9);g.rotate(sway);
      part(3,-17,0,17,16,.94,.79,-sway*1.5+Math.sin(clock*3.8-.5)*.05);
      part(2,0,0,24,19,.91,.86);
      g.restore();
      part(1,8,-6,15,20,.53,.04,-sway*.6+.05*k);
      part(6,-12,1,8,11,.54,.08,.18+sway);
      part(active&&phase<.65?8:0,8,-3,23,23,.40,.97,-.08*k);
      part(4,7,1,10,10,.22,.12,-.10-.25*k);
      if(active) {
        g.save();g.globalAlpha=k*.45;g.strokeStyle='#b9eced';g.lineWidth=1.1;
        g.beginPath();g.moveTo(24,-12);g.quadraticCurveTo(29,-15,31,-12);
        g.moveTo(24,-10);g.quadraticCurveTo(29,-7,31,-9);g.stroke();g.restore();
      }
    }
  }
  function petPaint(g, color, width=1.2) {
    g.fillStyle=color;g.fill();g.strokeStyle=Q_INK;g.lineWidth=width;g.stroke();
  }
  function petOval(g,x,y,rx,ry,color) {ell(g,x,y,rx,ry,color);g.strokeStyle=Q_INK;g.lineWidth=1.2;g.stroke();}
  function petLine(g,points,color,width) {
    g.beginPath();g.moveTo(...points[0]);for(const p of points.slice(1))g.lineTo(...p);
    g.strokeStyle=Q_INK;g.lineWidth=width+1.6;g.stroke();g.strokeStyle=color;g.lineWidth=width;g.stroke();
  }
  Z.Spr.drawPetUnit = function (g, pet, time) {
    // 统筹在真实命中/发射/治疗处写入动作；缺失、过期或不匹配字段仅画待机。
    const clock=Number.isFinite(pet.animClock)?pet.animClock:Number.isFinite(time)?time:0;
    const kind={hou:'melee',he:'shoot',tu:'heal',long:'shoot'}[pet.ptype],age=pet.visualActionT,dur=pet.visualActionDur;
    const active=!!kind&&pet.visualAction===kind&&Number.isFinite(age)&&Number.isFinite(dur)&&dur>0&&age>=0&&age<dur;
    const phase=active?age/dur:0,k=active?(phase<.28?U.ease(phase/.28):1-U.ease((phase-.28)/.72)):0;
    const breath=Math.sin(clock*3)*.55,walk=U.clamp(Math.abs(pet.visualVx||0)/220,0,1),step=Math.sin(clock*12)*walk;
    const x=pet.x,y=pet.y,f=pet.facing===-1?-1:1;
    g.save();g.lineCap='round';g.lineJoin='round';
    shadow(g,x,pet.groundY ?? pet.level?.gy ?? y,pet.ptype==='long'?13:10,.18);
    g.translate(x,y);g.scale(f,1);
    if(petAtlases[pet.ptype]) {drawPetArt(g,pet,clock,active,phase,walk,step,breath);g.restore();return;}
    if (pet.ptype === 'hou') {
      g.translate(9*k,-breath-6*k-Math.abs(step)*.8);g.rotate(.18*k);
      // 卷尾与后肢先画，扑击时尾巴反向舒展。
      g.beginPath();g.moveTo(-6,-12);g.bezierCurveTo(-20,-6-4*k,-25,-23,-15+5*k,-25+breath);
      g.strokeStyle=Q_INK;g.lineWidth=4.6;g.stroke();g.strokeStyle='#aa7441';g.lineWidth=2.8;g.stroke();
      petLine(g,[[-5,-10],[-7-step*2-k*3,-2+k]],'#8d5938',3.3);
      petLine(g,[[4,-10],[6+step*2-k*2,-1]],'#b98349',3.6);
      petOval(g,0,-14,8.8,8.5,'#ad743f');ell(g,1,-12,5.5,5.4,'#efd09b');
      petLine(g,[[-5,-18],[-9,-12+2*k]],'#98603b',3);
      petOval(g,-3,-27,3,3.2,'#ac703e');petOval(g,9,-26.5,2.7,3,'#b7834e');
      ell(g,-3,-27,1.5,1.8,'#e9bd8e');ell(g,9,-26.5,1.2,1.6,'#e9bd8e');
      petOval(g,3,-25.8,7.6,7.4,'#b98349');
      ell(g,1.3,-27,3.2,3.5,'#f0ce9b');ell(g,5.7,-27,3.1,3.5,'#f0ce9b');ell(g,5,-22.8,5,3.2,'#f3d7ad');
      petLine(g,[[1,-29],[2.8,-29.4]],'#543726',.65);petLine(g,[[5,-29.3],[7,-28.8]],'#543726',.65);
      ell(g,2.3,-27.2,.8,1.15,'#2c2220');ell(g,6,-27.1,.8,1.15,'#2c2220');ell(g,7.6,-23.7,1,.65,'#8d5942');
      ell(g,2,-27.8,.3,.4,'#fff');ell(g,5.7,-27.7,.3,.4,'#fff');
      // 紧箍金圈与红围巾：小大圣身份标识
      g.save();g.translate(3.5,-29.6);g.rotate(-.06);
      g.beginPath();g.moveTo(-5.5,0);g.quadraticCurveTo(0,-2.2,6.5,-.5);
      g.strokeStyle='#8a6420';g.lineWidth=2.6;g.stroke();g.strokeStyle='#f2c84b';g.lineWidth=1.6;g.stroke();
      g.beginPath();g.arc(6.8,-.6,1.5,0,Z.U.TAU);g.fillStyle='#f2c84b';g.fill();g.strokeStyle='#8a6420';g.lineWidth=.7;g.stroke();
      g.restore();
      g.beginPath();g.moveTo(-4,-17);g.quadraticCurveTo(-12-3*k,-15+2*breath,-16-4*k,-10+3*breath);g.lineTo(-11,-8+2*breath);g.quadraticCurveTo(-7,-13,-2,-14);g.closePath();
      g.fillStyle='#c94b3e';g.fill();g.strokeStyle='#7e2a22';g.lineWidth=.9;g.stroke();
      g.beginPath();g.moveTo(4.2,-21.4);g.quadraticCurveTo(6,-20.5,7.2,-21.5);g.strokeStyle='#6a4432';g.lineWidth=.7;g.stroke();
      petLine(g,[[-3,-19],[5,-18]],'#dfad4c',2.4);ell(g,4,-17.7,1.2,1.3,'#f7d66f');
      petLine(g,[[4,-17],[8+8*k,-13-4*k]],'#bc874d',3.4);petOval(g,8+8*k,-13-4*k,2.5,2.3,'#efd1a4');
    } else if (pet.ptype === 'he') {
      g.translate(3*k,-26+Math.sin(clock*5)*1.4-2*k);
      const flap=Math.sin(clock*6)*.16+k*.65;
      g.save();g.rotate(-flap);g.beginPath();g.moveTo(-2,-3);g.quadraticCurveTo(-11,-18,-23,-17);g.lineTo(-20,-7);g.lineTo(-15,-3);g.lineTo(-8,3);g.closePath();petPaint(g,'#cbd9d7');
      petLine(g,[[-8,-7],[-20,-13]],'#f3f2df',.7);g.restore();
      petLine(g,[[1,4],[3,12],[7,13]],'#c59854',1.2);petLine(g,[[-3,4],[-5,10],[-1,12]],'#ad824d',1.1);
      g.beginPath();g.moveTo(-8,-2);g.lineTo(-18,-5);g.lineTo(-15,2);g.lineTo(-7,3);g.closePath();petPaint(g,'#45625e');
      // 飘带尾翎：两根长翎随动作轻摆
      const rib=Math.sin(clock*4)*1.6;
      for(const [off,c] of [[0,'#e9e4c8'],[2.5,'#cfd8c8']]){
        g.beginPath();g.moveTo(-15,-2+off);g.quadraticCurveTo(-26,-6+off+rib,-34,-1+off+rib*1.8);
        g.strokeStyle=Q_INK;g.lineWidth=2.6;g.stroke();g.strokeStyle=c;g.lineWidth=1.5;g.stroke();
        ell(g,-34,-1+off+rib*1.8,1.4,1.1,c);
      }
      petOval(g,0,0,9.5,6.4,'#f7f3df');ell(g,2,2,6,3.3,'#ddd9bf');
      g.beginPath();g.moveTo(5,-2);g.quadraticCurveTo(13,-6,11,-13);
      g.strokeStyle=Q_INK;g.lineWidth=6.2;g.stroke();g.strokeStyle='#faf5e3';g.lineWidth=4;g.stroke();
      petOval(g,11.5,-15,4,3.5,'#fbf5e4');ell(g,10.1,-17.5,2.3,1.5,'#c95143');
      petLine(g,[[9,-18],[8,-23]],'#d9c18a',1);petLine(g,[[11,-18],[13,-22]],'#ede0b6',1);
      g.beginPath();g.moveTo(14.5,-16);g.lineTo(21+2*k,-14.5);g.lineTo(14.5,-13);g.closePath();petPaint(g,'#d99842',.8);
      ell(g,12.7,-15.7,.9,1,'#252c2b');ell(g,13,-16,.25,.3,'#fff6dc');
      g.save();g.translate(1,1);g.rotate(flap*.7);g.beginPath();g.moveTo(-3,-2);g.quadraticCurveTo(8,-11,17,-6);g.lineTo(14,1);g.lineTo(10,5);g.lineTo(2,5);g.closePath();petPaint(g,'#f3edd7');
      for(let i=0;i<3;i++)petLine(g,[[4+i*3,-3],[6+i*3,3-i]],'#a4b6ad',.65);g.restore();
    } else if (pet.ptype === 'long') {
      // 水弹由实体生成；此处只在真实发射事件中略向前吐息。
      g.translate(3*k,-30+Math.sin(clock*4)*1.4-2*k);g.rotate(-.04*k);const wob=Math.sin(clock*4)*1.1+2*k;
      g.save();g.globalAlpha=.35;g.strokeStyle='#a0d9dd';g.lineWidth=1.3;
      g.beginPath();g.moveTo(-24,8);g.quadraticCurveTo(-17,3+breath,-9,8);g.quadraticCurveTo(-2,12,5,7);g.stroke();
      g.beginPath();g.arc(-17,5+breath,3,.4,2.6);g.stroke();g.restore();
      for(let i=0;i<4;i++){const bx=-13+i*7;g.beginPath();g.moveTo(bx,-3);g.lineTo(bx+3,-10+i*.8);g.lineTo(bx+6,-2);g.closePath();petPaint(g,'#3e8060',.9);}
      g.beginPath();g.moveTo(-18,5+wob);g.bezierCurveTo(-7,-7,1,-2,5,1);g.quadraticCurveTo(11,6,15,-5);
      g.strokeStyle=Q_INK;g.lineWidth=9;g.stroke();g.strokeStyle='#5fa47c';g.lineWidth=6.5;g.stroke();
      g.beginPath();g.moveTo(-16,5+wob);g.quadraticCurveTo(-6,-3,2,1);g.quadraticCurveTo(10,7,14,0);g.strokeStyle='#d9d09a';g.lineWidth=2;g.stroke();
      for(let i=0;i<4;i++){const sx=-10+i*6;g.beginPath();g.arc(sx,-1+i%2*2,1.6,0,Math.PI);g.strokeStyle='#2e7358';g.lineWidth=.7;g.stroke();}
      petLine(g,[[4,1],[2,8],[5,9]],'#639979',1.8);petLine(g,[[11,-2],[13,4],[16,4]],'#80b58c',1.8);
      petLine(g,[[12,-10],[9,-16],[6,-17]],'#e3cb93',1.7);petLine(g,[[9,-15],[10,-19]],'#e3cb93',1.2);
      petLine(g,[[17,-11],[18,-18],[21,-20]],'#efdbad',1.8);petLine(g,[[18,-17],[16,-20]],'#efdbad',1.2);
      petOval(g,15.5,-6,7.5,6,'#73b38b');ell(g,13,-8,4,2.4,'#95cba0');petOval(g,21,-4,4.7,3.3,'#aed1a2');
      ell(g,19,-8,1.5,1.5,'#eec465');ell(g,19.5,-8,.7,1.2,'#233f34');ell(g,23.5,-4.8,.65,.55,'#426d52');
      petLine(g,[[18,-10],[21,-10.5]],'#39694a',.8);
      g.beginPath();g.moveTo(24,-3);g.quadraticCurveTo(30,-7+wob,33,-2);g.moveTo(24,-1);g.quadraticCurveTo(29,4-wob,33,1);
      g.strokeStyle='#d1bc81';g.lineWidth=1.1;g.stroke();
      if(active){g.save();g.globalAlpha=k*.45;g.strokeStyle='#b9eced';g.lineWidth=1.4;
        g.beginPath();g.moveTo(27,-2);g.quadraticCurveTo(32+3*k,-6,35+4*k,-3);
        g.moveTo(27,0);g.quadraticCurveTo(32+3*k,4,35+4*k,1);g.stroke();g.restore();}
      // 环绕水珠：龙裔水灵之气
      for(let i=0;i<3;i++){const a=clock*2.2+i*Z.U.TAU/3,ox=Math.cos(a)*17,oy=Math.sin(a)*7-4;
        g.save();g.globalAlpha=.5+.2*Math.sin(a*2);ell(g,ox,oy,1.7,1.9,'#a8e0ea');ell(g,ox-.5,oy-.6,.5,.6,'#eafcff');g.restore();}
    } else { // 玉兔
      g.translate(0,-breath-Math.abs(step)*.7);petOval(g,-7,-8,3.4,3.2,'#f7f2df');
      petOval(g,0,-9,8.6,8,'#f2eddb');ell(g,2,-8,5.5,4.5,'#fff8e6');
      petLine(g,[[-3,-3],[-5-step,-1]],'#d9d8c8',2.5);petLine(g,[[3,-3],[6+step,-1]],'#f7f3df',2.8);
      petOval(g,-1,-27.5,2.3,7,'#f7f0df');petOval(g,5,-26.7,2.4,6.7,'#f7f0df');
      ell(g,-1,-27.5,1,5,'#d99498');ell(g,5,-26.7,1,4.7,'#e8adb1');
      petOval(g,2,-18,6.8,6,'#fff8e5');ell(g,5,-18.2,1,1.25,'#3c3438');ell(g,5.3,-18.6,.3,.35,'#fff');
      ell(g,6.8,-15.8,.8,.6,'#ca7d88');ell(g,2.4,-15.3,1.8,.9,'#eebabc');
      // 桃花头饰与胸前玉佩
      for(let i=0;i<5;i++){const a=i/5*Z.U.TAU;ell(g,-2+Math.cos(a)*1.7,-24.5+Math.sin(a)*1.7,1.2,1.2,'#f2a7b8');}
      ell(g,-2,-24.5,1,1,'#f7d66f');
      petOval(g,-1,-9,1.6,2,'#7ec8a0');petLine(g,[[-3,-12],[-1,-10.5],[1,-12]],'#c9b06a',.8);
      petLine(g,[[-3,-13],[4,-12]],'#8fa985',2);ell(g,4,-12,1.1,1.1,'#d6bc65');
      // 药杵、双手与药臼构成捣药轮廓；只有真实治疗事件推动药杵。
      petLine(g,[[11,-17+7*k],[12,-5+7*k]],'#a68055',2.2);
      petLine(g,[[3,-11],[10,-11+5*k]],'#f5efdc',2.2);petOval(g,10,-11+5*k,2,1.7,'#fff6df');
      g.beginPath();g.moveTo(7,-6);g.quadraticCurveTo(12,-9,18,-6);g.lineTo(16,0);g.quadraticCurveTo(12,2,9,0);g.closePath();petPaint(g,'#779c91');
      petOval(g,12.5,-6,5.4,1.8,'#bad2b1');ell(g,12.5,-6.1,3.6,.85,'#577967');
      if(active){g.save();g.globalAlpha=k*.65;for(let i=0;i<3;i++){const px=9+i*4;ell(g,px,-12-i*3-8*phase,1.1,1.8,'#a8d991');}g.restore();}
    }
    g.restore();
  };

  /* ============ 图标 ============ */
  function itemGlyph(g, base, c, s, item) {
    g.save();
    g.scale(s / 40, s / 40);
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 3; g.lineCap = 'round';
    if((equipmentAtlas||equipmentStyle(item))&&equipped(item,base)&&base!=='weapon'){
      if(base==='head')equipmentPart(g,'head',4,10,32,16.3,false,item);
      else if(base==='armor')equipmentPart(g,'chest',7,4,26,29,false,item);
      else if(base==='acc')equipmentPart(g,'acc',10,4,19,31.7,false,item);
      if(base==='head'||base==='armor'||base==='acc'){g.restore();return;}
    }
    if (base === 'weapon') {
      g.save();g.translate(20,20);g.rotate(Math.PI/4);g.scale(.4,.4);
      const equipped=qStaffItem(g,item);g.restore();
      if(equipped){g.restore();return;}
      g.beginPath(); g.moveTo(9, 31); g.lineTo(31, 9); g.stroke();
      g.lineWidth = 5; g.strokeStyle = '#f5c542';
      g.beginPath(); g.moveTo(7, 33); g.lineTo(11, 29); g.stroke();
      g.beginPath(); g.moveTo(29, 11); g.lineTo(33, 7); g.stroke();
    } else if (base === 'head') {
      g.beginPath(); g.moveTo(8, 26); g.lineTo(12, 12); g.lineTo(20, 20); g.lineTo(28, 12); g.lineTo(32, 26); g.closePath(); g.fill();
      g.fillRect(8, 26, 24, 4);
    } else if (base === 'armor') {
      g.beginPath(); g.moveTo(12, 10); g.lineTo(28, 10); g.lineTo(32, 16); g.lineTo(28, 22); g.lineTo(28, 32); g.lineTo(12, 32); g.lineTo(12, 22); g.lineTo(8, 16); g.closePath(); g.fill();
      g.fillStyle = '#fff3'; g.fillRect(12, 12, 16, 3);
    } else if (base === 'acc') {
      g.beginPath(); g.arc(20, 20, 11, 0, TAU); g.stroke();
      g.beginPath(); g.arc(20, 20, 4, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(20, 4); g.lineTo(20, 12); g.moveTo(20, 28); g.lineTo(20, 36);
      g.moveTo(4, 20); g.lineTo(12, 20); g.moveTo(28, 20); g.lineTo(36, 20); g.stroke();
    }
    g.restore();
  }

  Z.Spr.drawItemIcon = function (g, item, x, y, s, opts = {}) {
    const q = Z.BAL.qualities[item.q] || Z.BAL.qualities[0];
    g.save();
    // 底
    g.fillStyle = opts.bg || 'rgba(20,26,38,0.85)';
    rr(g, x, y, s, s, 6); g.fill();
    g.strokeStyle = q.c; g.lineWidth = opts.sel ? 3 : 1.6;
    rr(g, x + 1, y + 1, s - 2, s - 2, 5); g.stroke();
    g.translate(x, y); // 图元用局部坐标，必须平移到格子内
    itemGlyph(g, item.base, q.c, s, item);
    if (item.lv > 0 && !opts.hidePlus) text(g, '+' + item.lv, x + s - 4 - x, y + s - 9 - y, { size: Math.max(9, s * 0.22), color: '#ffd24a', bold: true, align: 'right' });
    g.restore();
  };

  function wukongSkillGlyph(g,id,x,y,size) {
    g.save();g.translate(x,y);g.scale(size/48,size/48);g.lineCap='round';g.lineJoin='round';
    if(id==='jd') {
      // 烈焰沿运动方向拖尾，箭形核心与其它棍术一眼区分。
      const flame=g.createLinearGradient(10,35,35,10);flame.addColorStop(0,'#a83d25');flame.addColorStop(.55,'#ec8735');flame.addColorStop(1,'#ffdc83');
      g.fillStyle=flame;g.strokeStyle='#753c2c';g.lineWidth=1.4;
      g.beginPath();g.moveTo(9,34);g.quadraticCurveTo(16,26,13,17);g.lineTo(20,23);g.quadraticCurveTo(22,15,22,9);
      g.lineTo(27,17);g.lineTo(39,9);g.lineTo(34,24);g.lineTo(39,24);g.quadraticCurveTo(28,34,18,37);g.closePath();g.fill();g.stroke();
      g.fillStyle='#fff0b2';g.beginPath();g.moveTo(16,33);g.lineTo(28,21);g.lineTo(25,21);g.lineTo(34,14);g.lineTo(29,26);g.lineTo(28,23);g.closePath();g.fill();
      g.strokeStyle='#b95e32';g.lineWidth=1.2;g.beginPath();g.moveTo(8,25);g.lineTo(12,22);g.moveTo(14,39);g.lineTo(19,37);g.stroke();
    } else if(id==='wu') {
      // 无双采用大圣冠纹与金瞳，避免普通五角星的通用图标感。
      const gold=g.createLinearGradient(0,10,0,37);gold.addColorStop(0,'#fff0b7');gold.addColorStop(.5,'#d9a44e');gold.addColorStop(1,'#9b622d');
      g.fillStyle=gold;g.strokeStyle='#714923';g.lineWidth=1.2;
      g.beginPath();g.moveTo(8,17);g.lineTo(15,20);g.lineTo(18,10);g.lineTo(24,17);g.lineTo(30,10);g.lineTo(33,20);g.lineTo(40,17);g.lineTo(36,28);g.lineTo(12,28);g.closePath();g.fill();g.stroke();
      g.strokeStyle='#ffe5a1';g.lineWidth=2.2;g.beginPath();g.moveTo(12,28);g.quadraticCurveTo(18,21,24,27);g.quadraticCurveTo(30,21,36,28);g.stroke();
      g.fillStyle='#a5412e';g.beginPath();g.moveTo(24,17);g.lineTo(27,21);g.lineTo(24,25);g.lineTo(21,21);g.closePath();g.fill();
      g.strokeStyle='#ffdc6e';g.lineWidth=2.2;g.beginPath();g.moveTo(13,32);g.lineTo(21,35);g.moveTo(27,35);g.lineTo(35,32);g.stroke();
      g.strokeStyle='#967549';g.lineWidth=1;g.beginPath();g.arc(24,24,17,.3,1.13);g.moveTo(7,24);g.arc(24,24,17,2.02,2.85);g.stroke();
    } else if(id==='qs') {
      // 三条相隔的棍弧强调连斩，前后色阶保留小尺寸可读性。
      for(const [yy,col,w] of [[13,'#527d78',2],[21,'#8cbab0',2.4],[29,'#e4db9b',3]]) {
        g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(9,yy+5);g.bezierCurveTo(17,yy-7,31,yy-7,39,yy+3);g.stroke();
      }
      g.save();g.translate(24,25);g.rotate(-.67);
      g.fillStyle='#80512e';rr(g,-2.5,-17,5,34,1.4);g.fill();
      g.fillStyle='#c59146';g.fillRect(-1.3,-15,2.6,29);
      g.fillStyle='#f4d38b';g.fillRect(-3,-17,6,6);g.fillRect(-3,11,6,6);
      g.strokeStyle='#fff0bc';g.lineWidth=1;g.beginPath();g.moveTo(-1.8,-16);g.lineTo(-1.8,-12);g.moveTo(-1.8,12);g.lineTo(-1.8,16);g.stroke();g.restore();
    } else {
      g.fillStyle='#b9863d';g.beginPath();g.moveTo(26,34);g.lineTo(23,29);g.lineTo(30,31);g.lineTo(35,25);g.lineTo(35,33);g.lineTo(41,35);g.lineTo(34,38);g.lineTo(27,39);g.closePath();g.fill();
      g.strokeStyle='#edcd8a';g.lineWidth=1.3;g.beginPath();g.moveTo(23,11);g.bezierCurveTo(34,13,39,20,38,27);g.moveTo(19,9);g.bezierCurveTo(31,6,42,17,41,23);g.stroke();
      g.save();g.translate(23,23);g.rotate(-.61);
      g.fillStyle='#6f472b';rr(g,-3.4,-18,6.8,36,2);g.fill();
      g.fillStyle='#ba803b';g.fillRect(-2,-16,4,32);g.fillStyle='#e8bb67';g.fillRect(-1.2,-15,1.4,29);
      g.fillStyle='#f0cf86';g.fillRect(-4,-18,8,7);g.fillRect(-4,11,8,7);
      g.strokeStyle='#fff0ba';g.lineWidth=1.2;g.beginPath();g.moveTo(-2.5,-17);g.lineTo(-2.5,-12);g.moveTo(-2.5,12);g.lineTo(-2.5,17);g.stroke();g.restore();
    }
    g.restore();
  }
  Z.Spr.drawSkillIcon = function (g, id, x, y, s, frac) {
    g.save();
    const cx = x + s / 2, cy = y + s / 2;
    const face=g.createRadialGradient(cx-s*.16,cy-s*.23,s*.04,cx,cy,s*.52);
    face.addColorStop(0,id==='jd'?'#684735':id==='wu'?'#655137':'#365c58');
    face.addColorStop(.72,id==='jd'?'#302d2b':'#193633');face.addColorStop(1,'#102422');
    ell(g,cx,cy+1,s*.5,s*.5,'#10201f');ell(g,cx,cy,s*.48,s*.48,face);
    const rim=g.createLinearGradient(x,y,x+s,y+s);rim.addColorStop(0,'#f1dc9e');rim.addColorStop(.48,'#b58a4d');rim.addColorStop(1,'#68523a');
    g.strokeStyle=rim;g.lineWidth=Math.max(1.4,s*.045);g.beginPath();g.arc(cx,cy,s*.465,0,TAU);g.stroke();
    g.strokeStyle='rgba(230,209,153,.28)';g.lineWidth=1;g.beginPath();g.arc(cx,cy,s*.405,-2.65,-.55);g.stroke();
    if (id==='hy'||id==='jd'||id==='qs'||id==='wu') wukongSkillGlyph(g,id,x+s*.035,y+s*.035,s*.93);
    // 冷却遮罩
    if (frac != null && frac > 0) {
      g.fillStyle = 'rgba(10,14,22,0.72)';
      g.beginPath(); g.moveTo(cx, cy);
      g.arc(cx, cy, s / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      g.closePath(); g.fill();
    }
    g.restore();
  };

  function star(g, cx, cy, R, r, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rad = i % 2 === 0 ? R : r;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  }

  Z.Spr.drawCoin = function (g, x, y, r) {
    ell(g, x, y, r, r, '#f5c542');
    ell(g, x, y, r * 0.82, r * 0.82, '#ffd75e');
    g.fillStyle = '#d9a926';
    const sq = r * 0.5;
    g.fillRect(x - sq / 2, y - sq / 2, sq, sq);
    ell(g, x - r * 0.3, y - r * 0.35, r * 0.22, r * 0.14, '#fff2b0');
  };
  Z.Spr.drawStone = function (g, x, y, r) {
    g.fillStyle = '#54e0d8';
    g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y - r * 0.2); g.lineTo(x + r * 0.5, y + r);
    g.lineTo(x - r * 0.5, y + r); g.lineTo(x - r * 0.8, y - r * 0.2);
    g.closePath(); g.fill();
    g.fillStyle = '#aef4ef';
    g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x + r * 0.35, y - r * 0.2); g.lineTo(x, y + r * 0.2); g.lineTo(x - r * 0.35, y - r * 0.2); g.closePath(); g.fill();
  };
  Z.Spr.drawPotion = function (g, x, y, r, kind) {
    const c = kind === 'mp' ? '#54a0ff' : '#ff6a5e';
    g.fillStyle = 'rgba(230,238,248,0.25)';
    rr(g, x - r * 0.55, y - r * 0.2, r * 1.1, r * 1.2, r * 0.4); g.fill();
    g.fillStyle = c;
    rr(g, x - r * 0.5, y, r, r, r * 0.45); g.fill();
    g.fillStyle = '#8a5a2e';
    g.fillRect(x - r * 0.22, y - r * 0.55, r * 0.44, r * 0.5);
    ell(g, x - r * 0.2, y + r * 0.35, r * 0.16, r * 0.22, 'rgba(255,255,255,0.55)');
  };
  Z.Spr.drawPetBall = function (g, x, y, r) {
    ell(g, x, y, r, r, '#f0f4fa');
    g.save();
    g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.closePath();
    g.fillStyle = '#e05555'; g.fill();
    g.restore();
    g.fillStyle = '#2b3542'; g.fillRect(x - r, y - r * 0.14, r * 2, r * 0.28);
    ell(g, x, y, r * 0.3, r * 0.3, '#fff');
    g.strokeStyle = '#2b3542'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.stroke();
  };

  Z.Spr.drawChest = function (g, chest) {
    const x = chest.x, y = chest.y;
    const open = chest.opened;
    g.save();
    g.translate(x, y);
    shadow(g, 0, 0, 20, 0.25);
    const glow = 0.5 + 0.3 * Math.sin(chest.t * 3);
    if (!open) {
      g.globalAlpha = glow * 0.5;
      ell(g, 0, -14, 24, 18, 'rgba(255,210,80,0.5)');
      g.globalAlpha = 1;
    }
    // 箱体
    g.fillStyle = '#7a5236';
    rr(g, -18, -18, 36, 18, 3); g.fill();
    // 盖
    if (open) {
      g.fillStyle = '#8a5f3e';
      g.save();
      g.translate(-18, -18);
      g.rotate(-2.2);
      rr(g, 0, -8, 36, 10, 4); g.fill();
      g.restore();
    } else {
      g.fillStyle = '#8a5f3e';
      g.beginPath();
      g.moveTo(-18, -18);
      g.quadraticCurveTo(0, -30, 18, -18);
      g.closePath(); g.fill();
    }
    // 金饰
    g.fillStyle = '#f5c542';
    g.fillRect(-3, -18, 6, 18);
    if (!open) ell(g, 0, -12, 3.2, 4, '#f5c542');
    g.strokeStyle = '#f5c542'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-18, -11); g.lineTo(18, -11); g.stroke();
    g.restore();
  };

  // 原创桃根灵藏；世界坐标绘制，不参与平台或命中判定。
  Z.Spr.drawSecret = function (g, secret, time) {
    const open=secret.open, pulse=.5+.5*Math.sin(time*2.4);
    g.save();g.translate(secret.config.x,secret.y);
    shadow(g,0,0,37,.22);
    const bark=g.createLinearGradient(-24,-66,25,-4);
    bark.addColorStop(0,'#b18b72');bark.addColorStop(.42,'#765646');bark.addColorStop(1,'#493c32');
    g.fillStyle=bark;g.strokeStyle='#4e4136';g.lineWidth=2;g.lineJoin='round';
    g.beginPath();g.moveTo(-37,-3);g.quadraticCurveTo(-13,-14,-19,-37);
    g.lineTo(-14,-68);g.quadraticCurveTo(-3,-61,7,-68);g.lineTo(17,-38);
    g.quadraticCurveTo(15,-15,38,-3);g.quadraticCurveTo(16,2,0,-5);g.quadraticCurveTo(-17,3,-37,-3);g.closePath();g.fill();g.stroke();
    g.strokeStyle='#c5a083';g.lineWidth=2;
    for(const side of [-1,1]){g.beginPath();g.moveTo(side*9,-60);g.quadraticCurveTo(side*6,-30,side*25,-9);g.stroke();}
    g.strokeStyle='#5c4638';g.lineWidth=1.5;g.beginPath();g.moveTo(-6,-57);g.quadraticCurveTo(-12,-40,-6,-32);g.moveTo(9,-37);g.lineTo(14,-24);g.stroke();
    ell(g,0,-19,15,18,open?'#28392f':'#5d493b');
    if(open){
      const glow=g.createRadialGradient(0,-16,1,0,-16,15);glow.addColorStop(0,'#bfe1a4');glow.addColorStop(.5,'#688e65');glow.addColorStop(1,'rgba(34,62,44,0)');
      ell(g,0,-16,14,17,glow);ell(g,0,-10,9,3,'#c9c69a');
      g.strokeStyle='#b0aa79';g.lineWidth=2;g.beginPath();g.moveTo(-15,-24);g.lineTo(-19,-9);g.moveTo(14,-26);g.lineTo(19,-8);g.stroke();
    }else{
      g.strokeStyle='#dbc68d';g.lineWidth=1.5;g.beginPath();g.moveTo(-2,-33);g.lineTo(3,-26);g.lineTo(-3,-20);g.lineTo(2,-13);g.lineTo(-2,-8);g.stroke();
      g.globalAlpha=.22+pulse*.2;ell(g,0,-20,19,22,'#e7d78c');g.globalAlpha=1;
    }
    // 低矮苔叶与桃瓣提示可探索，外轮廓不形成可站立横沿。
    ell(g,-23,-8,12,4,'#78856a');ell(g,26,-7,9,3,'#687e5e');
    for(const [x,y,r] of [[-28,-12,-.5],[23,-15,.7],[-8,-64,.2]]){
      g.save();g.translate(x,y);g.rotate(r);ell(g,0,0,5,2.6,'#d8a1a5');ell(g,-1,-.5,3,1,'#edc4ba');g.restore();
    }
    if(!open){g.globalAlpha=.45+pulse*.35;g.fillStyle='#f2dc95';star(g,19,-43,3.5,1.4,4);g.globalAlpha=1;}
    if(secret.flashT>0){g.globalAlpha=Math.min(.65,secret.flashT*2);ell(g,0,-25,24,32,'#fff1bb');}
    g.restore();
  };

  /* ============ 法宝：图标与战斗表现 ============ */
  const relicElementColors = { '金': '#e0b95c', '木': '#5da85a', '水': '#5aa8dd', '火': '#e0745c', '土': '#bd9257' };
  const relicRects = { cloud_umbrella:[34,16,751,696], jade_leaf:[883,15,480,698], sea_tide_pearl:[1489,100,650,545] };
  let relicAtlas = null;
  if (typeof Image !== 'undefined') {
    const base=document.currentScript && document.currentScript.src, img=new Image();
    img.onload=()=>{relicAtlas=img;};
    const url=base ? new URL('../assets/art/ui/relic-atlas-v1.png',base) : null;
    if(url)url.search=new URL(base).search;
    img.src=url ? url.href : 'assets/art/ui/relic-atlas-v1.png';
  }

  // 伞面穹顶 + 云头收边 + 金顶 + 玉柄；leaf 画叶脉与露珠。局部坐标以 (0,0) 为中心。
  function relicUmbrellaBody(g, s, silhouette) {
    const R = s * 0.78;
    const canopy = g.createLinearGradient(0, -R, 0, R * 0.2);
    if (silhouette) { canopy.addColorStop(0, '#b7bdc6'); canopy.addColorStop(1, '#8d939c'); }
    else { canopy.addColorStop(0, '#93a9de'); canopy.addColorStop(.55, '#5b70b3'); canopy.addColorStop(1, '#3c4a86'); }
    g.beginPath();
    g.moveTo(-R, R * 0.08);
    g.quadraticCurveTo(-R, -R * 0.98, 0, -R * 0.98);
    g.quadraticCurveTo(R, -R * 0.98, R, R * 0.08);
    // 三个云头圆弧从右向左收边
    for (let i = 0; i < 3; i++) {
      const step = (R * 2) / 3;
      g.quadraticCurveTo(R - step * (i + 0.5), R * 0.5, R - step * (i + 1), R * 0.08);
    }
    g.closePath();
    g.fillStyle = canopy; g.fill();
    g.strokeStyle = silhouette ? '#7d838c' : '#c9d4f4'; g.lineWidth = 1.2; g.stroke();
    if (!silhouette) {
      // 伞面云纹与金脊
      ell(g, -R * 0.34, -R * 0.34, R * 0.26, R * 0.09, 'rgba(222,232,252,0.45)');
      ell(g, R * 0.3, -R * 0.52, R * 0.19, R * 0.07, 'rgba(222,232,252,0.38)');
      g.strokeStyle = 'rgba(245,197,66,0.55)'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, -R * 0.92); g.quadraticCurveTo(-R * 0.3, -R * 0.5, -R * 0.52, R * 0.02);
      g.moveTo(0, -R * 0.92); g.quadraticCurveTo(R * 0.3, -R * 0.5, R * 0.52, R * 0.02);
      g.stroke();
      // 金顶
      g.fillStyle = '#f5c542';
      g.fillRect(-R * 0.05, -R * 1.1, R * 0.1, R * 0.16);
      ell(g, 0, -R * 1.14, R * 0.1, R * 0.1, '#f5c542');
      ell(g, -R * 0.03, -R * 1.17, R * 0.035, R * 0.035, '#fff2b0');
    }
    // 玉柄
    g.strokeStyle = silhouette ? '#8d939c' : '#5a4632'; g.lineWidth = Math.max(1.4, s * 0.1); g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, R * 0.08); g.lineTo(0, R * 0.66); g.stroke();
    if (!silhouette) {
      g.strokeStyle = '#8fd28a'; g.lineWidth = Math.max(1, s * 0.055);
      g.beginPath(); g.moveTo(-s * 0.1, R * 0.4); g.lineTo(s * 0.1, R * 0.4); g.stroke();
    }
  }
  function relicLeafBody(g, s, silhouette) {    const L = s * 0.88;
    g.save();
    g.rotate(-0.5);
    const leaf = g.createLinearGradient(-L * 0.6, -L, L * 0.6, L);
    if (silhouette) { leaf.addColorStop(0, '#bcc6b6'); leaf.addColorStop(1, '#8f9a8c'); }
    else { leaf.addColorStop(0, '#9ed17c'); leaf.addColorStop(.5, '#6fae62'); leaf.addColorStop(1, '#43814c'); }
    g.beginPath();
    g.moveTo(0, -L);
    g.quadraticCurveTo(L * 0.74, -L * 0.25, 0, L);
    g.quadraticCurveTo(-L * 0.74, -L * 0.25, 0, -L);
    g.closePath();
    g.fillStyle = leaf; g.fill();
    g.strokeStyle = silhouette ? '#7f8a7e' : '#2f5d3c'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(240,250,225,0.8)'; g.lineWidth = Math.max(1, s * 0.06);
    g.beginPath(); g.moveTo(0, -L * 0.84); g.lineTo(0, L * 0.88); g.stroke();
    g.lineWidth = Math.max(0.8, s * 0.04);
    for (const dir of [-1, 1]) for (const t of [-0.42, 0.05, 0.5]) {
      const yy = L * t;
      g.beginPath(); g.moveTo(0, yy);
      g.quadraticCurveTo(dir * L * 0.3, yy - L * 0.05, dir * L * 0.46, yy - L * 0.2);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = silhouette ? '#8d939c' : '#7a5a38'; g.lineWidth = Math.max(1.2, s * 0.09); g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s * 0.12, s * 0.5); g.quadraticCurveTo(s * 0.22, s * 0.74, s * 0.56, s * 0.6); g.stroke();
    if (!silhouette) ell(g, -s * 0.1, -s * 0.24, s * 0.09, s * 0.13, 'rgba(240,255,244,0.85)');
  }

  function relicPearlBody(g, s, silhouette) {
    const R = s * 0.62;
    // 珠核
    const orb = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.12, 0, 0, R);
    if (silhouette) { orb.addColorStop(0, '#c2c8cc'); orb.addColorStop(1, '#8d949a'); }
    else { orb.addColorStop(0, '#d8f2fb'); orb.addColorStop(.55, '#7fc3e2'); orb.addColorStop(1, '#3d7fae'); }
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = orb; g.fill();
    g.strokeStyle = silhouette ? '#7d838c' : '#bfe6f4'; g.lineWidth = 1.3; g.stroke();
    if (!silhouette) {
      // 潮纹双漩与高光
      g.strokeStyle = 'rgba(235,250,255,0.8)'; g.lineWidth = 1.1;
      g.beginPath(); g.arc(-R * 0.18, R * 0.1, R * 0.5, -0.5, 1.9); g.stroke();
      g.beginPath(); g.arc(R * 0.3, -R * 0.05, R * 0.32, 2.4, 4.6); g.stroke();
      ell(g, -R * 0.32, -R * 0.36, R * 0.16, R * 0.1, 'rgba(255,255,255,0.85)');
      // 外环浪圈
      g.strokeStyle = 'rgba(130,205,240,0.6)'; g.lineWidth = Math.max(1, s * 0.05);
      g.beginPath(); g.arc(0, R * 0.18, R * 1.12, 0.35, Math.PI - 0.35); g.stroke();
    }
  }

  // 法宝图标：relic 为完整记录或 {id}（未合成剪影）；size 为整体直径。
  Z.Spr.drawRelicIcon = function (g, relic, x, y, size, opts = {}) {
    const def = Z.BAL.relicDefs[relic && relic.id] || {};
    if (!def.name) return;
    const s = size / 2, silhouette = opts.silhouette === true;
    const element = relic.element;
    g.save();
    g.translate(x, y);
    // 底衬
    if (opts.bg !== false) {
      const backing=g.createRadialGradient(-s*.2,-s*.25,s*.12,0,0,s);
      backing.addColorStop(0,silhouette?'#e8e5d7':'#fff9e8');backing.addColorStop(1,silhouette?'#d7d7c8':'#d9ddc9');
      g.fillStyle = backing;
      g.beginPath(); g.arc(0, 0, s * 0.98, 0, TAU); g.fill();
      g.strokeStyle=silhouette?'#b7bcaa':'#b2b99e';g.lineWidth=Math.max(.7,size*.012);
      g.beginPath();g.arc(0,0,s*.96,0,TAU);g.stroke();
    }
    if (relicAtlas && !silhouette && relicRects[relic.id]) {
      const r=relicRects[relic.id],scale=size*.97/Math.max(r[2],r[3]),w=r[2]*scale,h=r[3]*scale;
      g.drawImage(relicAtlas,...r,-w/2,-h/2,w,h);
    } else if (def.type === 'shield') relicUmbrellaBody(g, s * 0.92, silhouette);
    else if (def.type === 'tide') relicPearlBody(g, s * 0.92, silhouette);
    else relicLeafBody(g, s * 0.92, silhouette);
    // 五行角标：法宝随身印记
    if (element && !opts.noElement && !silhouette) {
      const bx = s * 0.66, by = s * 0.66, br = s * 0.3;
      ell(g, bx, by, br, br, '#f7f1de');
      g.strokeStyle = relicElementColors[element] || '#bd9257'; g.lineWidth = Math.max(1.2, s * 0.07);
      g.beginPath(); g.arc(bx, by, br, 0, TAU); g.stroke();
      text(g, element, bx, by, { size: Math.max(8, s * 0.34), color: relicElementColors[element] || '#bd9257', bold: true });
    }
    g.restore();
  };

  // 法宝主动效果：护盾穹顶悬伞 / 回春叶环；随 world animClock 推进，暂停即冻结。
  Z.Spr.drawRelicEffect = function (g, player) {
    const e = player.relicEffect;
    if (!e || !player.level) return;
    const t = player.animClock || 0, x = player.x, midY = player.y - player.h * 0.55;
    g.save();
    if (e.type === 'shield') {
      const frac = e.maxShield > 0 ? Math.max(0.18, e.shield / e.maxShield) : 1;
      const pulse = 0.85 + 0.15 * Math.sin(t * 5);
      g.globalAlpha *= (0.26 + 0.2 * frac) * pulse;
      const dome = g.createRadialGradient(x, midY, 5, x, midY, 56);
      dome.addColorStop(0, 'rgba(196,226,255,0.1)');
      dome.addColorStop(.72, 'rgba(150,192,242,0.5)');
      dome.addColorStop(1, 'rgba(128,170,230,0)');
      ell(g, x, midY, 52, 60, dome);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(184,220,255,' + (0.55 * frac).toFixed(3) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, player.y + 3, 47, Math.PI, TAU); g.stroke();
      // 头顶悬伞随呼吸浮沉
      g.globalAlpha = 0.85;
      g.save();
      g.translate(x, player.y - player.h - 26 + Math.sin(t * 2.2) * 3.5);
      g.rotate(Math.sin(t * 1.4) * 0.08);
      g.scale(0.32, 0.32);
      relicUmbrellaBody(g, 34, false);
      g.restore();
    } else if (e.type === 'heal') {
      const fade = Math.min(1, e.remaining / 0.8);
      g.globalAlpha *= 0.5 * fade;
      const aura = g.createRadialGradient(x, player.y - 6, 3, x, player.y - 6, 46);
      aura.addColorStop(0, 'rgba(150,232,150,0.55)');
      aura.addColorStop(1, 'rgba(120,208,130,0)');
      ell(g, x, player.y - 6, 44, 20, aura);
      // 三片灵叶环绕上升
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.55 + i / 3) % 1;
        const lx = x + Math.sin((phase + i * 0.33) * TAU + i) * 26;
        const ly = player.y - 8 - phase * (player.h + 26);
        g.save();
        g.globalAlpha = (0.85 * fade) * Math.sin(phase * Math.PI);
        g.translate(lx, ly);
        g.rotate(phase * 5 + i * 2.1);
        g.scale(0.16, 0.16);
        relicLeafBody(g, 26, false);
        g.restore();
      }
    }
    g.restore();
  };

  Object.assign(Z.Spr, { text, rr, ell, shadow, star });
})();
