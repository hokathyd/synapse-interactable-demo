/* ═══════════════════════════════════════════════════
   js/synapse-draw.js
   All canvas draw calls for the interactive synapse diagram.
   Depends on: synapse-data.js (constants + PARTS)
   Exports (globals): drawFrame(), hitRegions[]
═══════════════════════════════════════════════════ */

// Hit-regions accumulate each frame; read by synapse-ui.js for mouse events
let hitRegions = [];

// Track mouse position for hover tooltip (written by synapse-ui.js)
let synMx = 0, synMy = 0;
let hov = null, hovId = null;   // currently hovered key + id
let sel = null, selId = null;   // currently selected (clicked) key + id

// Shared animation tick counter
let tick = 0;


// ── Colour palette (blue/purple reserved for axon terminal & dendrite) ───
// Presynaptic (axon + terminal): blues
const PRE_FILL   = 'rgba(80,120,200,.55)';
const PRE_FILL_H = 'rgba(100,140,220,.75)';
const PRE_STR    = '#6088d8';
const PRE_STR_H  = '#80a8f0';

// Postsynaptic (spine + shaft): purples
const POST_FILL   = 'rgba(120,80,180,.55)';
const POST_FILL_H = 'rgba(140,100,200,.75)';
const POST_STR    = '#8060c8';
const POST_STR_H  = '#a080e8';


// ── Utility ───────────────────────────────────────────────────

/** Register a rectangular hit-region for mouse interaction. */
function reg(key, x, y, rx, ry, id) {
  hitRegions.push({ key, x, y, rx, ry, id: id ?? null });
}

/** Draw a soft radial glow at (x,y). */
function glowAt(ctx, x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** Draw a directional arrow from (x1,y1) to (x2,y2). */
function drawArrow(ctx, ar) {
  const al = Math.min(1, ar.life / 22) * .9;
  const dx = ar.x2 - ar.x1, dy = ar.y2 - ar.y1;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 4) return;
  const ux = dx / d, uy = dy / d, hl = 11;

  ctx.save();
  ctx.globalAlpha = al;
  ctx.strokeStyle = ar.col; ctx.fillStyle = ar.col;
  ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ar.x1, ar.y1);
  ctx.lineTo(ar.x2 - ux * hl * .5, ar.y2 - uy * hl * .5);
  ctx.stroke();
  // Arrow head
  ctx.beginPath();
  ctx.moveTo(ar.x2, ar.y2);
  ctx.lineTo(ar.x2 - ux * hl - uy * 5, ar.y2 - uy * hl + ux * 5);
  ctx.lineTo(ar.x2 - ux * hl + uy * 5, ar.y2 - uy * hl - ux * 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}


// ── Section draw functions ────────────────────────────────────

/**
 * Draw the presynaptic region:
 * axon column rectangles + semicircular terminal bulge, VGCCs, vesicles.
 */
function drawPresynaptic(ctx, phase, VESICLES) {
  // Background tint for the presynaptic zone (blue for axon terminal)
  ctx.fillStyle = 'rgba(60,100,180,.18)';
  ctx.fillRect(0, 0, ctx.canvas.width, PRE_BOT);

  for (let ci = 0; ci < 2; ci++) {
    const cx  = COLS[ci].cx;
    const isH = hov === 'terminal' && hovId === ci;
    const isS = sel === 'terminal' && selId === ci;
    if (isH || isS) { ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(100,140,220,.5)'; }

    // Merged axon + semicircular terminal as one path
    ctx.beginPath();
    ctx.moveTo(cx - TERM_R, 0);
    ctx.lineTo(cx + TERM_R, 0);
    ctx.lineTo(cx + TERM_R, PRE_TOP);
    ctx.arc(cx, PRE_TOP, TERM_R, 0, Math.PI, false); // bulge downward
    ctx.lineTo(cx - TERM_R, 0);
    ctx.closePath();
    ctx.fillStyle   = isH || isS ? PRE_FILL_H : PRE_FILL;
    ctx.strokeStyle = isH || isS ? PRE_STR_H  : PRE_STR;
    ctx.lineWidth   = isH || isS ? 2.5 : 1.8;
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    reg('terminal', cx, PRE_TOP / 2, TERM_R, PRE_TOP / 2 + TERM_R * .5, ci);
  }

  // "PRESYNAPTIC" region label; left side (light text on dark bg)
  ctx.font = '700 11px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(160,180,240,.9)';
  ctx.textAlign = 'left';
  ctx.fillText('PRESYNAPTIC', 8, 36);

  drawVGCCs(ctx, phase);
  drawSnareTethers(ctx, VESICLES, phase);
  drawVesicles(ctx, VESICLES);
}

/**
 * Draw voltage-gated Ca²⁺ channels (VGCCs) as inward-facing semicircles
 * on the curved surface of each terminal.
 */
function drawVGCCs(ctx, phase) {
  const vgccOpen = ['vgcc', 'fusion'].includes(phase);

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    const vgccAngles = VGCC_ANGLES;

    for (let vi = 0; vi < 2; vi++) {
      const ang = vgccAngles[vi];
      // Surface point on the terminal arc
      const vx = cx + Math.cos(ang) * TERM_R;
      const vy = PRE_TOP + Math.sin(ang) * TERM_R;

      const isH = hov === 'vgcc' && hovId === ci * 10 + vi;
      const isS = sel === 'vgcc' && selId === ci * 10 + vi;
      if (isH || isS) glowAt(ctx, vx, vy, 30, ION_RGBA.ca(.42));

      // Draw dome pointing inward (VGCC; orange shade)
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(ang + Math.PI / 2 + Math.PI); // orient dome inward
      const vr = 22;
      ctx.beginPath();
      ctx.moveTo(-vr, 0);
      ctx.arc(0, 0, vr, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle   = vgccOpen ? ION_RGBA.ca(.72) : 'rgba(255,140,0,.42)';
      ctx.strokeStyle = isH || isS ? RECEPTOR_COLORS.vgcc : (vgccOpen ? RECEPTOR_COLORS.vgcc : 'rgba(255,140,0,.6)');
      ctx.lineWidth   = isH || isS ? 2.8 : 1.8;
      ctx.fill(); ctx.stroke();

      // Dashed open-pore indicator
      if (vgccOpen) {
        ctx.beginPath(); ctx.moveTo(0, -vr); ctx.lineTo(0, vr);
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();

      reg('vgcc', vx, vy, 26, 26, ci * 10 + vi);
    }
  }
}

/**
 * Draw SNARE tether lines between docked vesicles and the membrane.
 * Only shown from step 2 (snare) onward until fusion starts.
 */
function drawSnareTethers(ctx, VESICLES, phase) {
  const SNARE_COL = 'rgba(140,160,180,.55)';
  const SNARE_WIDTH = 1.5;

  // SNARE lines appear in step 1 (ap), pull vesicles down in step 2 (snare)
  const showSnare = ['ap', 'snare'].includes(phase);

  for (const v of VESICLES) {
    // Show tethers during snare (docked or being yanked down); hide once at membrane
    const showTether = v.docked || v.fusing;
    if (!showSnare || !showTether || v.stuckAtMembrane || v.released) continue;

    const cx = COLS[v.col].cx;
    const fuseIdx = v.origCx < cx - 15 ? 0 : (v.origCx > cx + 15 ? 2 : 1);
    const t = FUSE_TARGETS[fuseIdx];
    const mx = cx + t.dx;
    const my = PRE_BOT + t.dy;

    // Tether from vesicle bottom to membrane fusion site
    const vx = v.cx;
    const vy = v.cy + v.r;

    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(mx, my);
    ctx.strokeStyle = SNARE_COL;
    ctx.lineWidth = SNARE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Small bridge shape at membrane contact (SNARE complex)
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(160,180,200,.5)';
    ctx.strokeStyle = 'rgba(140,160,180,.7)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Draw synaptic vesicles.
 * Step 2: SNARE yanks vesicles down to membrane. Step 5: vesicle fuses (releases glutamate).
 */
function drawVesicles(ctx, VESICLES) {
  for (const v of VESICLES) {
    if (v.released) continue;  // hidden when merged

    // Step 2: SNARE yanks vesicle down to fusion site
    if (v.fusing) {
      v.fuseProgress = Math.min(1, (v.fuseProgress || 0) + 0.02);
      const fp  = v.fuseProgress;
      const cx  = COLS[v.col].cx;
      const fuseIdx = v.origCx < cx - 15 ? 0 : (v.origCx > cx + 15 ? 2 : 1);
      const t   = FUSE_TARGETS[fuseIdx];
      const tx  = cx + t.dx;
      const ty  = PRE_BOT + t.dy;
      v.cx = v.origCx + (tx - v.origCx) * fp;
      v.cy = v.origCy + (ty - v.origCy) * fp;
      if (fp >= 1) { v.fusing = false; v.stuckAtMembrane = true; }
    }

    const isH = hov === 'vesicle' && hovId === v.id;
    const isS = sel === 'vesicle' && selId === v.id;
    if (isH || isS) glowAt(ctx, v.cx, v.cy, v.r + 8, ION_RGBA.glu(.3));

    // Vesicle circle (glutamate-colored)
    ctx.beginPath(); ctx.arc(v.cx, v.cy, v.r, 0, Math.PI * 2);
    ctx.fillStyle   = isH || isS ? ION_RGBA.glu(.52) : ION_RGBA.glu(.38);
    ctx.strokeStyle = isH || isS ? '#cc3300' : ION_COLORS.glu;
    ctx.lineWidth   = isH || isS ? 2.8 : 2.2;
    ctx.fill(); ctx.stroke();

    // Glutamate dots inside
    const dotR = Math.min(2.8, v.r * .28);
    for (let di = 0; di < 3; di++) {
      const da = (di / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(v.cx + Math.cos(da) * v.r * .44, v.cy + Math.sin(da) * v.r * .44, dotR, 0, Math.PI * 2);
      ctx.fillStyle = ION_COLORS.glu;
      ctx.fill();
    }

    reg('vesicle', v.cx, v.cy, v.r + 4, v.r + 4, v.id);
  }
}

/**
 * Draw the synaptic cleft band with label and resting-state ions.
 */
function drawCleft(ctx, particles) {
  const W = ctx.canvas.width;

  // Cleft background (black like reference)
  ctx.fillStyle = '#08090f';
  ctx.fillRect(0, CLEFT_T, W, CLEFT_H);

  // Border lines (neutral, not blue/purple)
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, CLEFT_T); ctx.lineTo(W, CLEFT_T); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, POST_T);  ctx.lineTo(W, POST_T);  ctx.stroke();

  reg('cleft', W / 2, (CLEFT_T + POST_T) / 2, W * .46, CLEFT_H / 2);

  drawStaticIons(ctx, particles, W);
}

/**
 * Draw static background ions throughout the diagram when not animating.
 * Uses a minimum-distance rule so labels don't pile up.
 */
function drawStaticIons(ctx, particles, W) {
  const animating = particles.some(p => ['glu','ca','na','ca2'].includes(p.type));

  // ── Cleft ions (extracellular; more Ca²⁺ to show source for VGCC entry) ──
  const cleftIons = [
    { col: ION_RGBA.ca(.85),  x: W * .12, y: CLEFT_T + CLEFT_H * .25 },
    { col: ION_RGBA.ca(.8),   x: W * .22, y: CLEFT_T + CLEFT_H * .55 },
    { col: ION_RGBA.ca(.75),  x: W * .18, y: CLEFT_T + CLEFT_H * .75 },
    { col: ION_RGBA.ca(.8),   x: W * .48, y: CLEFT_T + CLEFT_H * .35 },
    { col: ION_RGBA.ca(.75),  x: W * .52, y: CLEFT_T + CLEFT_H * .65 },
    { col: ION_RGBA.ca(.8),   x: W * .78, y: CLEFT_T + CLEFT_H * .28 },
    { col: ION_RGBA.ca(.75),  x: W * .82, y: CLEFT_T + CLEFT_H * .72 },
    { col: ION_RGBA.na(.75),  x: W * .32, y: CLEFT_T + CLEFT_H * .58 },
    { col: ION_RGBA.k(.75),   x: W * .58, y: CLEFT_T + CLEFT_H * .42 },
    { col: ION_RGBA.mg(.85),  x: W * .72, y: CLEFT_T + CLEFT_H * .62 },
    { col: ION_RGBA.glu(.6),  x: W * .88, y: CLEFT_T + CLEFT_H * .38 },
  ];
  if (!animating) {
    drawIonGroup(ctx, cleftIons);
  }

  // ── Presynaptic Ca²⁺ (low concentration at rest) ──
  if (!['vgcc','fusion'].includes(window._synapsePhase)) {
    for (let ci = 0; ci < 2; ci++) {
      const cx = COLS[ci].cx;
      const preIons = [
        { col: ION_RGBA.ca(.28), x: cx - 40, y: PRE_TOP + 45 },
        { col: ION_RGBA.ca(.28), x: cx + 30, y: PRE_TOP + 60 },
        { col: ION_RGBA.ca(.28), x: cx - 15, y: PRE_TOP + 85 },
        { col: ION_RGBA.ca(.28), x: cx + 50, y: PRE_TOP + 75 },
      ];
      drawIonGroup(ctx, preIons);
    }
  }

  // ── Postsynaptic Na⁺ / K⁺ ──
  const postIons = [
    { col: ION_RGBA.na(.3), x: W * .22, y: POST_T + 90 },
    { col: ION_RGBA.k(.3),  x: W * .38, y: POST_T + 110 },
    { col: ION_RGBA.na(.3), x: W * .62, y: POST_T + 90 },
    { col: ION_RGBA.k(.3),  x: W * .78, y: POST_T + 115 },
  ];
  drawIonGroup(ctx, postIons);
}

/** Draw a group of ion dots (no labels). */
function drawIonGroup(ctx, ions) {
  for (const ion of ions) {
    ctx.beginPath(); ctx.arc(ion.x, ion.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = ion.col;
    ctx.shadowBlur = 5; ctx.shadowColor = ion.col;
    ctx.fill(); ctx.shadowBlur = 0;
  }
}

/**
 * Draw postsynaptic region: dendrite shaft, spine boxes, PSD-95,
 * AMPA receptors, NMDA receptor, CaMKII.
 */
function drawPostsynaptic(ctx, phase) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // ── Dendrite shaft; fills from POST_BOT to bottom of canvas ──
  {
    const isHS = hov === 'dendrite', isSS = sel === 'dendrite';
    ctx.fillStyle   = isHS || isSS ? POST_FILL_H : POST_FILL;
    ctx.strokeStyle = isHS || isSS ? POST_STR_H  : POST_STR;
    ctx.lineWidth   = isHS || isSS ? 2.2 : 1.6;
    ctx.beginPath(); ctx.rect(0, POST_BOT, W, H - POST_BOT);
    ctx.fill(); ctx.stroke();
    reg('dendrite', W / 2, POST_BOT + (H - POST_BOT) / 2, W * .46, (H - POST_BOT) / 2);
  }

  // Spine background (dark-mode)
  ctx.fillStyle = 'rgba(80,50,120,.25)';
  ctx.fillRect(0, POST_T, W, POST_BOT - POST_T);

  // "POSTSYNAPTIC" label; bottom left (light text on dark bg)
  ctx.font = '700 11px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(180,160,220,.85)';
  ctx.textAlign = 'left';
  ctx.fillText('POSTSYNAPTIC', 8, H - 8);

  drawSpineBoxes(ctx);
  drawPSD95(ctx);
  drawAMPA(ctx, phase);
  drawNMDA(ctx, phase);
  drawCaMKII(ctx, phase);
}

/** Draw the two rounded spine boxes. */
function drawSpineBoxes(ctx) {
  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    const bx = cx - BOX_SPINE_W / 2;
    const by = POST_T + 8;
    const bh = POST_BOT - POST_T - 8;
    const isH = hov === 'spine' && hovId === ci;
    const isS = sel === 'spine' && selId === ci;

    if (isH || isS) { ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(140,100,220,.5)'; }

    ctx.beginPath();
    ctx.moveTo(bx, by + bh);
    ctx.lineTo(bx, by + 8);
    ctx.arc(bx + 8, by + 8, 8, Math.PI, Math.PI * 1.5, false);
    ctx.lineTo(bx + BOX_SPINE_W - 8, by);
    ctx.arc(bx + BOX_SPINE_W - 8, by + 8, 8, Math.PI * 1.5, 0, false);
    ctx.lineTo(bx + BOX_SPINE_W, by + bh);
    ctx.fillStyle   = isH || isS ? POST_FILL_H : POST_FILL;
    ctx.strokeStyle = isH || isS ? POST_STR_H  : POST_STR;
    ctx.lineWidth   = isH || isS ? 2.5 : 1.8;
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    reg('spine', cx, by + bh / 2, BOX_SPINE_W / 2, bh / 2, ci);
  }
}

/** Draw the PSD-95 scaffold bar along the top of each spine. */
function drawPSD95(ctx) {
  for (let ci = 0; ci < 2; ci++) {
    const cx  = COLS[ci].cx;
    const psdY = POST_T + 4, psdH = 14;
    const isH = hov === 'psd95' && hovId === ci;
    const isS = sel === 'psd95' && selId === ci;
    ctx.beginPath();
    ctx.rect(cx - BOX_SPINE_W / 2 + 8, psdY, BOX_SPINE_W - 16, psdH);
    ctx.fillStyle   = isH || isS ? 'rgba(148,163,184,.6)' : 'rgba(148,163,184,.45)';
    ctx.strokeStyle = isH || isS ? RECEPTOR_COLORS.psd95 : 'rgba(148,163,184,.65)';
    ctx.lineWidth   = isH || isS ? 2 : 1.4;
    ctx.fill(); ctx.stroke();
    reg('psd95', cx, psdY + psdH / 2, BOX_SPINE_W / 2 - 8, psdH / 2, ci);
  }
}

/**
 * Draw AMPA receptors as pairs of ellipses straddling the postsynaptic membrane.
 * The pore gap widens when active (glutamate bound).
 */
function drawAMPA(ctx, phase) {
  const ampaActive = ['ampa_open','nmda_open','camkii'].includes(phase);

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    for (let ai = 0; ai < AMPA_DX.length; ai++) {
      const ax = cx + AMPA_DX[ai], ay = POST_T;
      const isH = hov === 'ampa' && hovId === ci * 10 + ai;
      const isS = sel === 'ampa' && selId === ci * 10 + ai;
      if (isH || isS) glowAt(ctx, ax, ay + 28, 42, 'rgba(105,240,174,.28)');

      const gap = ampaActive ? 14 : 5; // pore widens on activation

      // Two subunit ellipses (AMPA; mint green)
      for (const dx of [-gap / 2 - 14, gap / 2 + 2]) {
        ctx.beginPath(); ctx.ellipse(ax + dx + 6, ay + 28, 13, 30, 0, 0, Math.PI * 2);
        ctx.fillStyle   = ampaActive ? 'rgba(105,240,174,.58)' : 'rgba(105,240,174,.4)';
        ctx.strokeStyle = isH || isS ? RECEPTOR_COLORS.ampa : (ampaActive ? RECEPTOR_COLORS.ampa : 'rgba(105,240,174,.6)');
        ctx.lineWidth   = isH || isS ? 2.8 : 1.8;
        ctx.fill(); ctx.stroke();
      }

      // Open-pore Na⁺ colour hint
      if (ampaActive) {
        ctx.fillStyle = ION_RGBA.na(.3);
        ctx.fillRect(ax - gap / 2 + 2, ay + 3, gap, 52);
      }

      reg('ampa', ax, ay + 28, 36, 32, ci * 10 + ai);
    }
  }
}

/**
 * Draw the NMDA receptor.
 * Shows a prominent Mg²⁺ block at rest; opens with Ca²⁺-colour pore when active.
 * Positioned between (and clearly separated from) the two AMPA receptors.
 */
function drawNMDA(ctx, phase) {
  const nmdaActive = ['nmda_open','camkii'].includes(phase);

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    const nx = cx + NMDA_DX[0], ny = POST_T;
    const isH = hov === 'nmda' && hovId === ci * 10;
    const isS = sel === 'nmda' && selId === ci * 10;
    if (isH || isS) glowAt(ctx, nx, ny + 30, 46, 'rgba(38,166,154,.28)');

    const gap2 = nmdaActive ? 14 : 4;

    // Two subunit ellipses (NMDA; teal)
    for (const dx of [-gap2 / 2 - 14, gap2 / 2 + 2]) {
      ctx.beginPath(); ctx.ellipse(nx + dx + 6, ny + 30, 14, 34, 0, 0, Math.PI * 2);
      ctx.fillStyle   = nmdaActive ? 'rgba(38,166,154,.62)' : 'rgba(38,166,154,.38)';
      ctx.strokeStyle = isH || isS ? RECEPTOR_COLORS.nmda : (nmdaActive ? RECEPTOR_COLORS.nmda : 'rgba(38,166,154,.55)');
      ctx.lineWidth   = isH || isS ? 2.8 : 1.8;
      ctx.fill(); ctx.stroke();
    }

    if (!nmdaActive) {
      // Mg²⁺ block in the pore
      ctx.fillStyle = ION_RGBA.mg(.95);
      ctx.beginPath(); ctx.roundRect(nx - 11, ny + 14, 22, 26, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(38,166,154,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 8px Nunito,sans-serif'; ctx.fillStyle = 'rgba(255,200,200,.9)';
      ctx.textAlign = 'center'; ctx.fillText('BLOCKED', nx, ny + 10);
    } else {
      // Open pore; Ca²⁺ colour hint
      ctx.fillStyle = ION_RGBA.ca(.32);
      ctx.fillRect(nx - gap2 / 2 + 1, ny + 3, gap2, 54);
      ctx.font = '600 8px Nunito,sans-serif'; ctx.fillStyle = 'rgba(255,220,180,.9)';
      ctx.textAlign = 'center'; ctx.fillText('OPEN', nx, ny + 10);
    }

    reg('nmda', nx, ny + 30, 36, 36, ci * 10);
  }
}

/**
 * Draw CaMKII hexagons inside each spine.
 * Pulses and brightens during the camkii phase.
 */
function drawCaMKII(ctx, phase) {
  const ckOn = phase === 'camkii';

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    for (let ki = 0; ki < 2; ki++) {
      const kx    = cx + (ki === 0 ? -48 : 48);
      const ky    = CAMKII_DY[ki];
      const pulse = ckOn ? .5 + .5 * Math.sin(tick * .09) : 0;
      const isH   = hov === 'camkii' && hovId === ci * 10 + ki;
      const isS   = sel === 'camkii' && selId === ci * 10 + ki;
      if (isH || isS) glowAt(ctx, kx, ky, 18, 'rgba(224,122,95,.25)');

      // Hexagon (CaMKII; coral)
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
        k === 0 ? ctx.moveTo(kx + Math.cos(a) * 13, ky + Math.sin(a) * 13)
                : ctx.lineTo(kx + Math.cos(a) * 13, ky + Math.sin(a) * 13);
      }
      ctx.closePath();
      ctx.fillStyle   = ckOn ? `rgba(224,122,95,${.35 + pulse * .35})` : 'rgba(224,122,95,.18)';
      ctx.strokeStyle = isH || isS ? RECEPTOR_COLORS.camkii : (ckOn ? `rgba(224,122,95,${.8 + pulse * .2})` : 'rgba(224,122,95,.45)');
      ctx.lineWidth   = isH || isS ? 2.2 : 1.4;
      ctx.fill(); ctx.stroke();

      // Centre dot
      ctx.beginPath(); ctx.arc(kx, ky, 3, 0, Math.PI * 2);
      ctx.fillStyle = ckOn ? 'rgba(224,122,95,.9)' : 'rgba(224,122,95,.5)';
      ctx.fill();

      reg('camkii', kx, ky, 16, 16, ci * 10 + ki);
    }
  }
}

/** Draw all live particles (Ca²⁺, Na⁺, Glu, AP); no labels. */
function drawParticles(ctx, particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    // Glutamate with bindTarget: stick at receptor when arrived
    if (p.bindTarget && !p.bound) {
      const dy = p.bindTarget.y - p.y;
        if (dy <= 4 && Math.abs(p.x - p.bindTarget.x) < 12) {
        p.bound = true;
        p.x = p.bindTarget.x + (Math.random() - 0.5) * 14;
        p.y = p.bindTarget.y;
        p.vx = 0; p.vy = 0; p.life = 999;
      }
    }
    if (!p.bound) {
      p.x += p.vx; p.y += p.vy; p.life--;
    }
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    const al = Math.min(1, p.life / 18);
    let fc, sc;
    if      (p.type === 'ca')  { fc = ION_RGBA.ca(al * .92);  sc = ION_RGBA.ca(.6); }
    else if (p.type === 'glu') { fc = ION_RGBA.glu(al * .9);  sc = ION_RGBA.glu(.55); }
    else if (p.type === 'na')  { fc = ION_RGBA.na(al * .9);   sc = ION_RGBA.na(.55); }
    else if (p.type === 'ca2') { fc = ION_RGBA.ca(al * .92); sc = ION_RGBA.ca(.6); }
    else                       { fc = ION_RGBA.ap(al * .78); sc = ION_RGBA.ap(.88); } // ap

    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = fc; ctx.shadowBlur = 9; ctx.shadowColor = sc;
    ctx.fill(); ctx.shadowBlur = 0;
  }
}

/** Draw all live arrow overlays. */
function drawArrows(ctx, arrows) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    drawArrow(ctx, arrows[i]);
    arrows[i].life--;
    if (arrows[i].life <= 0) arrows.splice(i, 1);
  }
}

/** Draw the hover tooltip on the synapse canvas. */
function drawSynapseTooltip(ctx) {
  if (!hov || !PARTS[hov]) return;
  const W   = ctx.canvas.width;
  const lbl = PARTS[hov].title;
  ctx.font  = '700 10px Nunito,sans-serif';
  const tw  = ctx.measureText(lbl).width;
  const pad = 8, th = 20;
  let tx = synMx + 14, ty = synMy - 12;
  if (tx + tw + pad * 2 > W) tx = synMx - tw - pad * 2 - 14;
  if (ty - th < 0) ty = synMy + 26;

  ctx.fillStyle = 'rgba(17,22,32,.92)';
  ctx.beginPath();
  ctx.roundRect(tx - 4, ty - th + 2, tw + pad * 2, th + 4, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#c8d0e0';
  ctx.textAlign = 'left';
  ctx.fillText(lbl, tx + pad - 4, ty);
}


/**
 * Master draw function; called every animation frame by synapse-ui.js.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string}  phase     Current phase name
 * @param {Array}   particles Live particle array (mutated in place)
 * @param {Array}   arrows    Live arrow array (mutated in place)
 * @param {Array}   VESICLES  Vesicle state array
 */
function drawFrame(ctx, phase, particles, arrows, VESICLES) {
  tick++;
  // Expose phase globally so drawStaticIons can read it
  window._synapsePhase = phase;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  hitRegions = []; // reset each frame

  // Clear (dark theme #0a0e14, matches reference)
  ctx.fillStyle = '#0a0e14'; ctx.fillRect(0, 0, W, H);

  drawPresynaptic(ctx, phase, VESICLES);
  drawCleft(ctx, particles);
  drawPostsynaptic(ctx, phase);
  drawParticles(ctx, particles);
  drawArrows(ctx, arrows);
  drawSynapseTooltip(ctx);
}
