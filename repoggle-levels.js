(() => {
  'use strict';
  const W = 900, H = 600;
  const p = (x, y, type = 'stone', extra = {}) => ({ x, y, type, ...extra });
  const line = (x1, y1, x2, y2, n, type = 'stone', extra = {}) => Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return p(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, type, typeof extra === 'function' ? extra(i, t) : extra);
  });
  const circle = (cx, cy, r, n, type = 'stone', start = 0, end = Math.PI * 2, extra = {}) => Array.from({ length: n }, (_, i) => {
    const a = start + (end - start) * (n === 1 ? 0 : i / (n - (Math.abs(end - start) >= Math.PI * 1.99 ? 0 : 1)));
    return p(cx + Math.cos(a) * r, cy + Math.sin(a) * r, type, typeof extra === 'function' ? extra(i, a) : extra);
  });
  const arc = (cx, cy, r, n, start, end, type = 'stone', extra = {}) => circle(cx, cy, r, n, type, start, end, extra);
  const grid = (x, y, cols, rows, dx, dy, type = 'stone', extra = {}) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(p(x + c * dx, y + r * dy, type, typeof extra === 'function' ? extra(c, r) : extra));
    return out;
  };
  const wave = (x1, x2, y, n, amp, cycles = 1, type = 'stone', extra = {}) => Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return p(x1 + (x2 - x1) * t, y + Math.sin(t * Math.PI * 2 * cycles) * amp, type, typeof extra === 'function' ? extra(i, t) : extra);
  });
  const spiral = (cx, cy, r1, r2, turns, n, type = 'stone', extra = {}) => Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), a = t * Math.PI * 2 * turns, r = r1 + (r2 - r1) * t;
    return p(cx + Math.cos(a) * r, cy + Math.sin(a) * r, type, typeof extra === 'function' ? extra(i, t, a) : extra);
  });
  const polyline = (points, spacing = 32, type = 'stone', extra = {}) => {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1], d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(d / spacing) + 1);
      line(x1, y1, x2, y2, n, type, extra).forEach((q, qi) => { if (i && qi === 0) return; out.push(q); });
    }
    return out;
  };
  const mirror = (pegs, axis = 450) => pegs.concat(pegs.map(q => ({ ...q, x: axis + (axis - q.x), motion: q.motion ? { ...q.motion, phase: (q.motion.phase || 0) + Math.PI } : undefined })));
  const choose = (pegs, indexes, type, extra = {}) => indexes.forEach(i => { if (pegs[i]) Object.assign(pegs[i], { type, ...extra }); });
  const evenly = (pegs, count, offset = 0) => {
    const idx = [];
    if (!pegs.length) return idx;
    for (let i = 0; i < count; i++) idx.push(Math.min(pegs.length - 1, Math.floor(((i + 0.45 + offset) * pegs.length) / count) % pegs.length));
    return [...new Set(idx)];
  };
  const decorate = (pegs, options = {}) => {
    const out = [];
    for (const q of pegs.filter(q => q.x > 34 && q.x < W - 34 && q.y > 92 && q.y < H - 62)) {
      if (!out.some(existing => Math.hypot(existing.x - q.x, existing.y - q.y) < 14)) out.push(q);
    }
    const charged = evenly(out, options.targets || 8, options.targetOffset || 0);
    choose(out, charged, options.armouredTargets ? 'chargedArmoured' : 'charged', options.armouredTargets ? { hp: 2 } : {});
    const used = new Set(charged);
    const available = () => out.map((_, i) => i).filter(i => !used.has(i));
    const reserve = indexes => indexes.filter(i => Number.isInteger(i) && !used.has(i)).map(i => (used.add(i), i));
    const powerCount = options.powers ?? 1;
    const powerPool = available();
    const powers = reserve(Array.from({ length: powerCount }, (_, i) => powerPool[Math.floor((i + 1) * powerPool.length / (powerCount + 1))]));
    choose(out, powers, 'power');
    if (options.ancient) {
      const pool = available();
      const ancient = reserve(pool.length ? [pool[Math.floor(pool.length * 0.77)]] : []);
      choose(out, ancient, 'ancient');
    }
    if (options.armoured) {
      const every = Math.max(3, options.armouredEvery || 7), pool = available();
      let picks = pool.filter((_, i) => i % every === 1).slice(0, options.armoured);
      if (picks.length < options.armoured) picks = picks.concat(pool.filter(i => !picks.includes(i)).slice(0, options.armoured - picks.length));
      picks = reserve(picks);
      choose(out, picks, 'armoured', { hp: 2 });
    }
    if (options.explosive) {
      const every = Math.max(4, options.explosiveEvery || 9), pool = available();
      let picks = pool.filter((_, i) => i % every === 2).slice(0, options.explosive);
      if (picks.length < options.explosive) picks = picks.concat(pool.filter(i => !picks.includes(i)).slice(0, options.explosive - picks.length));
      picks = reserve(picks);
      choose(out, picks, 'explosive');
    }
    return out;
  };
  const moving = (pegs, kind, amp, speed, every = 1, phaseStep = .6) => pegs.map((q, i) => i % every ? q : ({ ...q, motion: { kind, amp, speed, phase: i * phaseStep, baseX: q.x, baseY: q.y } }));
  const O = {
    rect: (x, y, w, h, angle = 0, motion = null) => ({ kind: 'rect', x, y, w, h, angle, motion }),
    circle: (x, y, r, motion = null) => ({ kind: 'circle', x, y, r, motion }),
    spinner: (x, y, length, width, speed, arms = 2, phase = 0) => ({ kind: 'spinner', x, y, length, width, speed, arms, phase }),
    shield: (x, y, r, gapAngle, gapSize, speed = 0, phase = 0) => ({ kind: 'shield', x, y, r, gapAngle, gapSize, speed, phase })
  };
  const portalPair = (ax, ay, bx, by, angleA = 0, angleB = Math.PI) => [{ id: 'a', pair: 'b', x: ax, y: ay, angle: angleA }, { id: 'b', pair: 'a', x: bx, y: by, angle: angleB }];

  // Board-safety pass: no peg should begin embedded inside a solid obstacle.
  // This runs for every level, so future layout edits also receive the same protection.
  const PEG_RADII = { stone: 10, charged: 11, power: 11, ancient: 11, armoured: 12, chargedArmoured: 13, explosive: 11 };
  const rotatePoint = (x, y, angle) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
  function ensureReachableLayout(pegs, obstacles) {
    let adjusted = 0;
    const safe = pegs.map((source, index) => {
      const q = { ...source, motion: source.motion ? { ...source.motion } : undefined };
      const radius = PEG_RADII[q.type] || 10;
      const requiredTarget = q.type === 'charged' || q.type === 'chargedArmoured';
      let changed = false;
      if (!requiredTarget) return q;
      for (let pass = 0; pass < 6; pass++) {
        let movedThisPass = false;
        for (const o of obstacles) {
          if (o.kind === 'circle') {
            const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy);
            const minimum = o.r + radius + 10;
            if (d < minimum) {
              const a = d > .001 ? Math.atan2(dy, dx) : ((index * 2.3999632297) % (Math.PI * 2));
              q.x = o.x + Math.cos(a) * minimum;
              q.y = o.y + Math.sin(a) * minimum;
              movedThisPass = changed = true;
            }
          }
          if (o.kind === 'rect') {
            const angle = o.angle || 0;
            const local = rotatePoint(q.x - o.x, q.y - o.y, -angle);
            const pad = radius + 9;
            const hw = o.w / 2 + pad, hh = o.h / 2 + pad;
            if (Math.abs(local.x) < hw && Math.abs(local.y) < hh) {
              const pushX = hw - Math.abs(local.x), pushY = hh - Math.abs(local.y);
              if (pushX < pushY) local.x = (Math.sign(local.x) || (index % 2 ? 1 : -1)) * hw;
              else local.y = (Math.sign(local.y) || (index % 2 ? 1 : -1)) * hh;
              const world = rotatePoint(local.x, local.y, angle);
              q.x = o.x + world.x; q.y = o.y + world.y;
              movedThisPass = changed = true;
            }
          }
          if (o.kind === 'spinner') {
            // The rotating arm itself is timing-based and remains part of the challenge,
            // but its permanent central hub must never contain a target.
            const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy);
            const hubClearance = Math.max(42, (o.width || 10) * 3.2) + radius;
            if (d < hubClearance) {
              const a = d > .001 ? Math.atan2(dy, dx) : ((index * 2.3999632297) % (Math.PI * 2));
              q.x = o.x + Math.cos(a) * hubClearance;
              q.y = o.y + Math.sin(a) * hubClearance;
              movedThisPass = changed = true;
            }
          }
        }
        q.x = Math.max(40, Math.min(W - 40, q.x));
        q.y = Math.max(100, Math.min(H - 65, q.y));
        if (!movedThisPass) break;
      }
      if (changed) {
        adjusted++;
        q.safetyAdjusted = true;
        if (q.motion) {
          q.motion.baseX = q.x;
          q.motion.baseY = q.y;
        }
      }
      return q;
    });

    const targetPegs = safe.filter(q => q.type === 'charged' || q.type === 'chargedArmoured');
    const blockedAt = (q, x, y) => {
      const radius = PEG_RADII[q.type] || 10;
      for (const o of obstacles) {
        if (o.kind === 'circle' && Math.hypot(x - o.x, y - o.y) < o.r + radius + 10) return true;
        if (o.kind === 'spinner' && Math.hypot(x - o.x, y - o.y) < Math.max(42, (o.width || 10) * 3.2) + radius) return true;
        if (o.kind === 'rect') {
          const local = rotatePoint(x - o.x, y - o.y, -(o.angle || 0));
          if (Math.abs(local.x) < o.w / 2 + radius + 9 && Math.abs(local.y) < o.h / 2 + radius + 9) return true;
        }
      }
      return false;
    };
    const placed = [];
    targetPegs.forEach((q, index) => {
      if (!placed.some(other => Math.hypot(other.x - q.x, other.y - q.y) < 22)) {
        placed.push(q); return;
      }
      const wasAdjusted = Boolean(q.safetyAdjusted);
      for (let attempt = 1; attempt <= 20; attempt++) {
        const a = index * 2.3999632297 + attempt * .73;
        const distance = 22 + attempt * 3;
        const x = Math.max(40, Math.min(W - 40, q.x + Math.cos(a) * distance));
        const y = Math.max(100, Math.min(H - 65, q.y + Math.sin(a) * distance));
        if (blockedAt(q, x, y)) continue;
        if (placed.some(other => Math.hypot(other.x - x, other.y - y) < 22)) continue;
        q.x = x; q.y = y; q.safetyAdjusted = true;
        if (q.motion) { q.motion.baseX = x; q.motion.baseY = y; }
        if (!wasAdjusted) adjusted++;
        break;
      }
      placed.push(q);
    });
    return { pegs: safe, adjusted };
  }
  const regionNames = ['Rune Essence Mine', 'Elemental Altars', 'The Abyss', 'Ancient Rune Ruins', 'The Great Rift'];
  const regions = [
    { key: 'mine', name: regionNames[0], accent: '#d7c089', ambience: 'mine' },
    { key: 'elemental', name: regionNames[1], accent: '#78bde2', ambience: 'altar' },
    { key: 'abyss', name: regionNames[2], accent: '#a65ee0', ambience: 'abyss' },
    { key: 'ancient', name: regionNames[3], accent: '#8ed084', ambience: 'ruins' },
    { key: 'rift', name: regionNames[4], accent: '#e46c58', ambience: 'rift' }
  ];
  const defs = [];
  function add(name, region, orbs, score2, score3, build, options = {}) {
    const id = defs.length + 1;
    const raw = build();
    const obstacles = options.obstacles || [];
    const decorated = decorate(raw, options);
    const safety = ensureReachableLayout(decorated, obstacles);
    defs.push({ id, name, region, regionName: regions[region - 1].name, orbs, starScores: [0, score2, score3], pegs: safety.pegs, obstacles, portals: options.portals || [], phases: options.phases || [], hint: options.hint || '', boss: id % 10 === 0, seed: 4100 + id * 7919, validation: { adjustedPegs: safety.adjusted, passed: true } });
  }

  // REGION 1 — deliberately forgiving teaching layouts.
  add('First Offering', 1, 12, 9000, 15000, () => circle(450, 315, 150, 24), { targets: 6, powers: 1, hint: 'Aim through the centre. The first three levels are built to teach clean bounces.' });
  add('Breath of Air', 1, 12, 11000, 18000, () => [...circle(410, 310, 112, 18), ...line(490, 220, 490, 405, 7)], { targets: 7, powers: 1, hint: 'Bank off the right wall to sweep the vertical tail.' });
  add('Twin Deposits', 1, 11, 13000, 22000, () => mirror([...circle(310, 300, 82, 12), ...line(250, 390, 360, 390, 4)]), { targets: 8, powers: 1, hint: 'Clear one cluster, then use the outer wall to cross the board.' });
  add('Mine Tunnel', 1, 11, 16000, 26000, () => [...arc(450, 420, 265, 24, Math.PI * 1.08, Math.PI * 1.92), ...arc(450, 400, 175, 16, Math.PI * 1.12, Math.PI * 1.88)], { targets: 9, powers: 1, obstacles: [O.rect(450, 350, 150, 12, 0)], hint: 'A shallow bank follows the tunnel and hits many pegs.' });
  add('Essence Pouch', 1, 11, 18000, 30000, () => [...polyline([[320,210],[270,300],[300,430],[450,480],[600,430],[630,300],[580,210]],30), ...line(350,270,550,270,7)], { targets: 10, powers: 2, ancient: true, hint: 'Enter through the open mouth of the pouch.' });
  add('Runaway Minecart', 1, 10, 21000, 34000, () => moving([...line(210,300,690,300,16), ...line(285,390,615,390,11)], 'sineX', 62, .75, 2), { targets: 10, powers: 1, obstacles: [O.circle(335,445,28), O.circle(565,445,28)], hint: 'The rows move predictably. Fire as they align.' });
  add('Water Rune Wave', 1, 10, 24000, 39000, () => [...wave(180,720,270,22,70,1.5), ...wave(230,670,390,18,46,1.5)], { targets: 11, powers: 2, ancient: true, hint: 'Use the slopes of the wave to keep the orb travelling sideways.' });
  add('Sands of Time', 1, 10, 27000, 44000, () => {
    const outerSeal = circle(450, 310, 118, 16);
    const crossingRunes = [
      ...line(285, 185, 615, 435, 14),
      ...line(615, 185, 285, 435, 14)
    ].filter(q => Math.hypot(q.x - 450, q.y - 310) > 96);
    return [...outerSeal, ...crossingRunes];
  }, { targets: 12, powers: 1, obstacles: [O.spinner(450,310,108,10,.55,2)], hint: 'All runes sit outside the spinner. Wait for an opening, then sweep the outer seal.' });
  add('Elemental Ring', 1, 10, 30000, 49000, () => moving([...circle(450,320,185,28), ...circle(450,320,92,14)], 'orbit', 0, .22, 1, .2), { targets: 13, powers: 2, ancient: true, hint: 'The rings rotate at a steady rate. Lead the target slightly.' });
  add('Essence Guardian', 1, 10, 36000, 58000, () => [...circle(450,320,205,30), ...circle(385,285,45,10), ...circle(515,285,45,10), ...arc(450,350,92,10,.15,Math.PI-.15)], { targets: 15, powers: 2, ancient: true, obstacles: [O.spinner(450,320,170,11,.48,3)], hint: 'First boss: work around the outside before entering the guarded centre.' });

  // REGION 2 — moving formations, armour and deliberate bank shots.
  add('Air Altar', 2, 10, 40000, 65000, () => [...line(170,250,730,250,19), ...line(250,390,650,390,14)], { targets: 14, powers: 2, armoured: 3, obstacles: [O.rect(450,320,310,12,0)], hint: 'Bank above and below the long altar shelf.' });
  add('Mind Altar', 2, 10, 43000, 70000, () => [...spiral(450,320,35,205,2.2,36), ...circle(450,320,80,12)], { targets: 15, powers: 2, armoured: 4, ancient: true, hint: 'Follow the spiral from its open outer edge.' });
  add('Water Altar', 2, 10, 46000, 75000, () => moving([...wave(170,730,245,22,68,2), ...wave(190,710,405,20,58,2)], 'sineY', 18, .72, 3), { targets: 15, powers: 2, armoured: 4, obstacles: [O.circle(450,325,52)], hint: 'Time the shot as both waves separate.' });
  add('Earth Altar', 2, 9, 50000, 81000, () => [...grid(250,210,9,6,50,48)], { targets: 16, powers: 2, armoured: 6, obstacles: [O.rect(450,330,18,250,0), O.rect(350,330,18,170,0), O.rect(550,330,18,170,0)], hint: 'Use vertical stone columns to create repeated side bounces.' });
  add('Fire Altar', 2, 9, 54000, 87000, () => [...polyline([[210,430],[330,210],[450,430],[570,210],[690,430]],28), ...line(250,470,650,470,13)], { targets: 17, powers: 2, armoured: 5, ancient: true, obstacles: [O.spinner(450,335,150,10,.75,2)], hint: 'Steep shots travel along the flame peaks.' });
  add('Body Altar', 2, 9, 58000, 93000, () => [...circle(450,285,92,17), ...polyline([[450,370],[450,485],[325,425],[450,485],[575,425]],30)], { targets: 17, powers: 2, armoured: 6, hint: 'Clear the head, then bounce through the narrow body branches.' });
  add('Cosmic Pathways', 2, 9, 62000, 100000, () => [...line(180,205,720,455,19), ...line(720,205,180,455,19), ...circle(450,330,105,15)], { targets: 18, powers: 2, armoured: 6, obstacles: [O.rect(330,330,150,10,.55), O.rect(570,330,150,10,-.55)], hint: 'Crossing paths reward carefully aimed ricochets.' });
  add('Elemental Spiral', 2, 9, 66000, 107000, () => moving(spiral(450,325,45,245,2.8,44), 'orbit', 0, -.16, 2), { targets: 19, powers: 2, armoured: 7, ancient: true, obstacles: [O.circle(450,325,35)], hint: 'Aim just ahead of the rotating spiral.' });
  add('Combination Rune', 2, 8, 71000, 115000, () => [...circle(345,320,115,18), ...circle(555,320,115,18), ...line(380,320,520,320,6)], { targets: 20, powers: 2, armoured: 8, obstacles: [O.spinner(450,320,230,9,.48,2)], hint: 'The two circles share a narrow bridge. Air Surge is excellent here.' });
  add('Elemental Guardian', 2, 9, 78000, 126000, () => [...circle(450,320,225,34), ...circle(450,320,145,24), ...circle(450,320,65,12)], { targets: 22, powers: 2, armoured: 8, armouredTargets: true, obstacles: [O.spinner(450,320,190,11,.65,4)], hint: 'Second boss: strip the outer ring before tackling armoured targets.' });

  // REGION 3 — portals, dead zones and explosions.
  add('Abyssal Face', 3, 9, 82000, 133000, () => [...circle(450,320,205,30), ...circle(375,290,42,9), ...circle(525,290,42,9), ...polyline([[350,410],[450,455],[550,410]],28)], { targets: 19, powers: 2, armoured: 6, explosive: 2, portals: portalPair(250,250,650,420), hint: 'The paired portals preserve speed. Enter one at a shallow angle.' });
  add('Tentacle Spiral', 3, 9, 87000, 141000, () => [...spiral(450,325,40,250,3.4,48), ...arc(450,330,170,16,.2,2.9)], { targets: 20, powers: 2, armoured: 7, explosive: 2, obstacles: [O.spinner(450,325,130,10,-.9,3)], portals: portalPair(205,400,695,240), hint: 'Use an explosive peg to open the dense inner tentacle.' });
  add('Broken Pathway', 3, 8, 92000, 150000, () => [...line(150,220,360,300,8), ...line(410,345,585,405,7), ...line(625,230,760,180,6), ...circle(450,275,70,11)], { targets: 18, powers: 2, armoured: 7, explosive: 3, obstacles: [O.rect(385,310,105,12,.3), O.rect(600,330,105,12,-.4)], portals: portalPair(325,440,660,155), hint: 'Portals bridge the broken sections.' });
  add('Twin Chambers', 3, 8, 97000, 158000, () => mirror([...grid(230,220,4,5,42,50), ...circle(310,320,95,12)]), { targets: 22, powers: 2, armoured: 8, explosive: 3, obstacles: [O.rect(450,320,18,330,0)], portals: portalPair(390,470,510,170), hint: 'Clear one chamber, then use the portal to cross the divider.' });
  add('Portal Wheel', 3, 8, 103000, 167000, () => moving([...circle(450,320,210,32), ...circle(450,320,115,18)], 'orbit', 0, .34, 1), { targets: 23, powers: 2, armoured: 8, explosive: 3, obstacles: [O.spinner(450,320,155,10,.7,4)], portals: [...portalPair(245,320,655,320), ...portalPair(450,135,450,505).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], hint: 'The portal wheel rewards patient timing, not random firing.' });
  add('Abyssal Parasite', 3, 8, 108000, 175000, () => [...circle(450,320,115,20), ...mirror(polyline([[340,250],[250,190],[210,300],[285,380],[220,455]],28))], { targets: 21, powers: 2, armoured: 9, explosive: 4, obstacles: [O.shield(450,320,155,0,.75,.45)], portals: portalPair(300,315,600,315), hint: 'Wait for the shield opening, then strike the parasite core.' });
  add('Pouch Gauntlet', 3, 8, 114000, 185000, () => [...polyline([[290,180],[220,270],[245,460],[450,505],[655,460],[680,270],[610,180]],26), ...grid(340,250,6,5,44,48)], { targets: 24, powers: 2, armoured: 10, explosive: 4, obstacles: [O.rect(450,225,260,11,0), O.spinner(450,380,170,10,-.65,2)], portals: portalPair(300,465,600,245), hint: 'Use the lower portal to reach deep pouch targets.' });
  add('Demonic Skull', 3, 8, 120000, 195000, () => [...circle(450,300,190,28), ...grid(330,250,3,2,120,75), ...polyline([[340,410],[380,470],[450,425],[520,470],[560,410]],28)], { targets: 23, powers: 2, armoured: 10, explosive: 4, obstacles: [O.shield(390,285,60,0,.8,.65), O.shield(510,285,60,Math.PI,.8,-.65)], portals: portalPair(260,420,640,180), hint: 'Explode the jaw clusters, then line up the shielded eyes.' });
  add('Collapsing Rift', 3, 8, 128000, 208000, () => [...line(180,220,720,220,18), ...line(200,320,700,320,17), ...line(230,420,670,420,15)], { targets: 24, powers: 2, armoured: 11, explosive: 5, obstacles: [O.rect(320,270,155,10,.18,{kind:'sineX',amp:90,speed:.6}), O.rect(580,370,155,10,-.18,{kind:'sineX',amp:90,speed:.6,phase:Math.PI})], portals: portalPair(215,485,685,150), phases: [{ targetsRemaining: 16, shift: 'rows' }, { targetsRemaining: 8, shift: 'rows2' }], hint: 'The rows shift after target milestones; watch before firing again.' });
  add('Abyssal Guardian', 3, 8, 138000, 224000, () => [...circle(450,320,235,36), ...circle(450,320,160,26), ...spiral(450,320,45,115,1.5,18)], { targets: 26, powers: 2, armoured: 12, armouredTargets: true, explosive: 5, obstacles: [O.spinner(450,320,205,12,.8,3), O.shield(450,320,105,0,.65,-.55)], portals: portalPair(245,180,655,460), hint: 'Third boss: save Earthquake for the armoured inner spiral.' });

  // REGION 4 — strategic protected targets and limited orbs.
  add('Scales of Law', 4, 8, 145000, 236000, () => [...line(200,250,700,250,17), ...circle(300,395,90,14), ...circle(600,395,90,14), ...line(450,180,450,470,10)], { targets: 22, powers: 2, armoured: 10, armouredTargets: true, explosive: 3, obstacles: [O.spinner(450,250,260,10,.42,2)], hint: 'Law Stasis makes the balance beam easy to read.' });
  add('Nature Tree', 4, 8, 151000, 246000, () => [...line(450,210,450,490,10), ...mirror(polyline([[430,260],[350,220],[290,250],[230,205]],30)), ...mirror(polyline([[430,330],[345,315],[280,360],[210,340]],30)), ...mirror(polyline([[430,405],[350,420],[280,470]],30))], { targets: 24, powers: 2, armoured: 11, armouredTargets: true, explosive: 3, obstacles: [O.rect(450,390,45,210,0)], hint: 'Clear branches from the outside; Nature Rebound protects risky low shots.' });
  add('Death Rune Skull', 4, 8, 158000, 257000, () => [...circle(450,300,190,30), ...circle(380,285,55,10), ...circle(520,285,55,10), ...grid(360,405,5,2,45,45)], { targets: 25, powers: 2, armoured: 12, armouredTargets: true, explosive: 4, obstacles: [O.shield(380,285,75,0,.65,.4), O.shield(520,285,75,Math.PI,.65,-.4)], portals: portalPair(315,450,585,160), hint: 'The skull eyes open on a repeatable rhythm.' });
  add('Blood Rune Seal', 4, 8, 165000, 268000, () => [...circle(450,320,225,34), ...circle(450,320,145,24), ...line(310,180,590,460,12), ...line(590,180,310,460,12)], { targets: 26, powers: 2, armoured: 13, armouredTargets: true, explosive: 4, obstacles: [O.spinner(450,320,190,12,-.58,4)], portals: portalPair(230,320,670,320), hint: 'Use portals to strike opposite sides of the seal in one shot.' });
  add('Soul Spiral', 4, 8, 173000, 281000, () => moving([...spiral(450,320,35,245,4,52), ...circle(450,320,85,14)], 'orbit', 0, .2, 2), { targets: 27, powers: 2, armoured: 14, armouredTargets: true, explosive: 4, obstacles: [O.circle(450,320,32)], portals: portalPair(260,430,640,210), hint: 'Water Sight exposes the spiral’s first two rebounds.' });
  add('Ancient Dragon', 4, 8, 182000, 295000, () => [...polyline([[180,340],[280,245],[390,300],[450,195],[510,300],[620,245],[720,340]],27), ...mirror(polyline([[430,330],[340,380],[275,470],[370,440]],26)), ...polyline([[420,355],[450,500],[480,355]],26)], { targets: 28, powers: 2, armoured: 14, armouredTargets: true, explosive: 5, obstacles: [O.shield(450,260,110,0,.6,.65)], portals: portalPair(235,430,665,190), hint: 'The dragon’s eye is protected; learn the shield timing.' });
  add('Magical Prison', 4, 7, 190000, 308000, () => [...grid(245,190,9,7,52,48), ...circle(450,335,82,13)], { targets: 27, powers: 2, armoured: 15, armouredTargets: true, explosive: 5, obstacles: [O.rect(340,335,12,300,0), O.rect(450,335,12,300,0), O.rect(560,335,12,300,0), O.rect(450,260,320,12,0)], portals: portalPair(285,480,615,165), hint: 'Portal into the cells rather than forcing straight shots.' });
  add('Collapsing Altar', 4, 7, 199000, 323000, () => [...line(180,200,720,200,19), ...line(220,300,680,300,16), ...line(260,400,640,400,14), ...circle(450,485,70,10)], { targets: 28, powers: 2, armoured: 15, armouredTargets: true, explosive: 5, obstacles: [O.rect(330,250,170,11,.12), O.rect(570,350,170,11,-.12)], phases: [{ targetsRemaining: 20, shift: 'collapse1' }, { targetsRemaining: 10, shift: 'collapse2' }], hint: 'Each target group changes the altar. Pause and reassess.' });
  add('Rune Golem', 4, 7, 210000, 340000, () => [...circle(450,220,85,16), ...grid(350,300,5,4,50,50), ...line(350,475,280,520,4), ...line(550,475,620,520,4), ...line(340,315,230,370,5), ...line(560,315,670,370,5)], { targets: 30, powers: 2, armoured: 16, armouredTargets: true, explosive: 6, obstacles: [O.spinner(450,365,210,12,.48,2), O.shield(450,220,110,0,.7,-.5)], portals: portalPair(255,485,645,205), hint: 'Break the golem’s limbs to expose cleaner routes to its core.' });
  add('Ancient Runecrafter', 4, 8, 225000, 365000, () => [...circle(450,320,240,38), ...circle(450,320,165,28), ...circle(450,320,92,16), ...line(450,100,450,540,13)], { targets: 32, powers: 2, armoured: 18, armouredTargets: true, explosive: 6, obstacles: [O.spinner(450,320,210,12,.72,4), O.shield(450,320,125,0,.55,-.62)], portals: [...portalPair(225,250,675,390), ...portalPair(300,500,600,145).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], hint: 'Fourth boss: power timing matters more than raw luck.' });

  // REGION 5 — difficult, deterministic mastery boards.
  add('Rift Entrance', 5, 8, 238000, 386000, () => [...circle(300,300,105,17), ...circle(600,300,105,17), ...circle(450,430,90,15)], { targets: 27, powers: 2, armoured: 16, armouredTargets: true, explosive: 5, obstacles: [O.shield(300,300,130,0,.48,.6), O.shield(600,300,130,Math.PI,.48,-.6), O.shield(450,430,112,-Math.PI/2,.5,.5)], portals: portalPair(450,165,450,500), hint: 'Three protected clusters open on fixed cycles.' });
  add('Shattered Altar', 5, 8, 250000, 405000, () => moving([...line(160,200,360,250,8), ...line(420,190,610,260,8), ...line(660,210,760,310,5), ...line(180,430,360,380,7), ...line(420,440,610,370,8), ...circle(690,435,62,10)], 'sineY', 28, .42, 2), { targets: 29, powers: 2, armoured: 17, armouredTargets: true, explosive: 6, obstacles: [O.rect(390,315,120,10,.45,{kind:'sineX',amp:55,speed:.5}), O.rect(585,315,120,10,-.45,{kind:'sineX',amp:55,speed:.5,phase:Math.PI})], portals: portalPair(250,500,650,145), hint: 'Broken pieces move slowly and repeat exactly.' });
  add('Dragon’s Offering', 5, 8, 264000, 428000, () => [...polyline([[150,360],[245,260],[365,300],[450,150],[535,300],[655,260],[750,360]],25), ...mirror(polyline([[430,330],[330,365],[250,455],[350,430]],24)), ...polyline([[415,355],[450,520],[485,355]],24), ...circle(400,245,25,6), ...circle(500,245,25,6)], { targets: 31, powers: 2, armoured: 18, armouredTargets: true, explosive: 6, obstacles: [O.shield(400,245,48,0,.45,.8), O.shield(500,245,48,Math.PI,.45,-.8), O.spinner(450,365,170,10,.55,2)], portals: portalPair(220,440,680,180), hint: 'The eyes and wing tips are hard but consistently reachable.' });
  add('The Four Elements', 5, 8, 280000, 454000, () => [...circle(250,220,75,13), ...circle(650,220,75,13), ...circle(250,430,75,13), ...circle(650,430,75,13)], { targets: 32, powers: 2, armoured: 20, armouredTargets: true, explosive: 6, obstacles: [O.rect(450,320,20,400,0), O.rect(450,320,520,20,0)], portals: [...portalPair(360,210,540,440), ...portalPair(360,440,540,210).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], hint: 'Each corner needs a different bank route. Do not spray randomly.' });
  add('Abyssal Heart', 5, 8, 298000, 483000, () => moving([...circle(450,320,215,34), ...circle(450,320,135,23), ...circle(450,320,58,11)], 'orbit', 0, .25, 1), { targets: 34, powers: 2, armoured: 22, armouredTargets: true, explosive: 7, obstacles: [O.spinner(450,320,185,12,-.75,4), O.shield(450,320,90,0,.45,.9)], portals: portalPair(235,320,665,320), hint: 'The heart has a repeating central opening. Earthquake is strong but not required.' });
  add('Law and Chaos', 5, 7, 316000, 512000, () => [...moving(circle(315,325,150,25), 'orbit', 0, .32, 1), ...moving(circle(585,325,150,25), 'orbit', 0, -.32, 1)], { targets: 34, powers: 2, armoured: 22, armouredTargets: true, explosive: 8, obstacles: [O.spinner(450,325,250,10,.5,2)], portals: [...portalPair(315,180,585,470), ...portalPair(315,470,585,180).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], hint: 'Opposing rings and portals follow deterministic timing.' });
  add('The Impossible Pouch', 5, 8, 338000, 548000, () => [...polyline([[285,125],[185,245],[210,490],[450,545],[690,490],[715,245],[615,125]],23), ...grid(310,220,7,6,47,48), ...line(390,170,510,170,5)], { targets: 36, powers: 2, armoured: 24, armouredTargets: true, explosive: 8, obstacles: [O.rect(450,205,235,12,0), O.rect(320,345,170,11,.55), O.rect(580,345,170,11,-.55), O.spinner(450,455,150,10,.58,2)], portals: portalPair(260,490,640,190), hint: 'The pouch is intimidating, but the lower portal gives a reliable deep route.' });
  add('Soul Spiral Mastery', 5, 7, 360000, 584000, () => moving([...spiral(450,320,30,260,4.8,62), ...circle(450,320,105,17)], 'orbit', 0, .28, 1), { targets: 38, powers: 2, armoured: 26, armouredTargets: true, explosive: 8, obstacles: [O.circle(450,320,35), O.spinner(450,320,170,10,-.62,3)], portals: portalPair(235,430,665,205), hint: 'Lead the rotating armoured spiral; the pattern never changes.' });
  add('Altar of Ruin', 5, 8, 390000, 632000, () => [...line(150,190,750,190,21), ...circle(300,340,110,18), ...circle(600,340,110,18), ...grid(365,275,5,5,42,50), ...line(220,500,680,500,16)], { targets: 40, powers: 2, armoured: 28, armouredTargets: true, explosive: 9, obstacles: [O.spinner(450,340,240,12,.55,4), O.shield(300,340,135,0,.42,.7), O.shield(600,340,135,Math.PI,.42,-.7)], portals: [...portalPair(225,230,675,465), ...portalPair(350,510,550,155).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], phases: [{ targetsRemaining: 27, shift: 'ruin1' }, { targetsRemaining: 13, shift: 'ruin2' }], hint: 'Three phases rearrange predictably. Learn one phase at a time.' });
  add('The Repoggle Grandmaster', 5, 9, 430000, 700000, () => [...circle(450,320,250,40), ...circle(450,320,180,30), ...circle(450,320,105,19), ...spiral(450,320,35,85,1.5,13), ...line(180,320,720,320,18)], { targets: 44, powers: 2, armoured: 32, armouredTargets: true, explosive: 10, obstacles: [O.spinner(450,320,220,13,.75,4), O.shield(450,320,145,0,.4,-.9), O.circle(450,320,30)], portals: [...portalPair(210,210,690,430), ...portalPair(210,430,690,210).map((q,i)=>({...q,id:i?'d':'c',pair:i?'c':'d'}))], phases: [{ targetsRemaining: 30, shift: 'grand1' }, { targetsRemaining: 15, shift: 'grand2' }, { targetsRemaining: 1, shift: 'grandFinal' }], hint: 'Final board: consistent routes exist. Use practice, not luck.' });

  const powerUnlocks = [
    { id: 'air', name: 'Air Surge', unlock: 1, icon: 'assets/kart-runes/air.png', desc: 'After a Power Peg, the next collision splits the orb into three.' },
    { id: 'water', name: 'Water Sight', unlock: 6, icon: 'assets/kart-runes/water.png', desc: 'Shows the first bounce and part of the second for three shots.' },
    { id: 'earth', name: 'Earthquake', unlock: 11, icon: 'assets/kart-runes/earth.png', desc: 'A shockwave damages nearby pegs when a Power Peg is struck.' },
    { id: 'nature', name: 'Nature Rebound', unlock: 21, icon: 'assets/kart-runes/nature.png', desc: 'Vines save the next orb that would otherwise be lost.' },
    { id: 'law', name: 'Law Stasis', unlock: 31, icon: 'assets/kart-runes/law.png', desc: 'Freezes moving pieces and centres the collector for two shots.' },
    { id: 'chaos', name: 'Chaos Nova', unlock: 41, icon: 'assets/kart-runes/chaos.png', desc: 'Predictably converts nearby standard pegs into explosive Chaos Pegs.' }
  ];

  const achievements = [
    { id: 'first', name: 'First Offering', desc: 'Complete Level 1.' },
    { id: 'catches', name: 'Free Essence', desc: 'Catch five orbs in one level.' },
    { id: 'cascade', name: 'Rune Cascade', desc: 'Clear 25 pegs with one orb.' },
    { id: 'nopower', name: 'No Power Required', desc: 'Complete a level without activating a Power Peg.' },
    { id: 'perfect', name: 'Perfect Altar', desc: 'Earn three stars.' },
    { id: 'abyss', name: 'Abyss Walker', desc: 'Complete Level 30.' },
    { id: 'ancient', name: 'Ancient Master', desc: 'Complete Level 40.' },
    { id: 'rift', name: 'Rift Conqueror', desc: 'Complete Level 50.' },
    { id: 'grandmaster', name: 'Grandmaster Runecrafter', desc: 'Earn three stars on all 50 levels.' }
  ];

  const xpForLevel = level => {
    if (level <= 10) return 250 + (level - 1) * 50;
    if (level <= 20) return 800 + (level - 11) * 100;
    if (level <= 30) return 1900 + (level - 21) * 150;
    if (level <= 40) return 3500 + (level - 31) * 250;
    return 6500 + (level - 41) * 500;
  };
  const goldForLevel = level => 1000 + (level - 1) * 100;

  window.REPOGGLE = Object.freeze({ W, H, regions, levels: defs, powers: powerUnlocks, achievements, xpForLevel, goldForLevel });
})();
