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


// ── Colour palette ────────────────────────────────────────────
// Presynaptic (axon + terminal): blues
const PRE_FILL   = 'rgba(190,218,252,.65)';
const PRE_FILL_H = 'rgba(160,200,248,.82)';
const PRE_STR    = '#5888c8';
const PRE_STR_H  = '#2860a8';

// Postsynaptic (spine + shaft): purples
const POST_FILL   = 'rgba(218,210,252,.65)';
const POST_FILL_H = 'rgba(195,180,252,.82)';
const POST_STR    = '#8858c8';
const POST_STR_H  = '#5828a8';


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
  // Background tint for the presynaptic zone
  ctx.fillStyle = 'rgba(210,228,252,.28)';
  ctx.fillRect(0, 0, ctx.canvas.width, PRE_BOT);

  for (let ci = 0; ci < 2; ci++) {
    const cx  = COLS[ci].cx;
    const isH = hov === 'terminal' && hovId === ci;
    const isS = sel === 'terminal' && selId === ci;
    if (isH || isS) { ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(80,130,220,.45)'; }

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

  // "PRESYNAPTIC" region label — left side, below terminal labels
  ctx.font = '700 11px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(30,70,160,.55)';
  ctx.textAlign = 'left';
  ctx.fillText('PRESYNAPTIC', 8, 36);

  drawVGCCs(ctx, phase);
  drawVesicles(ctx, VESICLES);
}

/**
 * Draw voltage-gated Ca²⁺ channels (VGCCs) as inward-facing semicircles
 * on the curved surface of each terminal.
 */
function drawVGCCs(ctx, phase) {
  const vgccOpen = ['vgcc', 'ca_in', 'fusion'].includes(phase);

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    // Two VGCC positions on the arc of each terminal
    const vgccAngles = [Math.PI * .62, Math.PI * .38];

    for (let vi = 0; vi < 2; vi++) {
      const ang = vgccAngles[vi];
      // Surface point on the terminal arc
      const vx = cx + Math.cos(ang) * TERM_R;
      const vy = PRE_TOP + Math.sin(ang) * TERM_R;

      const isH = hov === 'vgcc' && hovId === ci * 10 + vi;
      const isS = sel === 'vgcc' && selId === ci * 10 + vi;
      if (isH || isS) glowAt(ctx, vx, vy, 30, 'rgba(58,159,200,.42)');

      // Draw dome pointing inward (toward terminal centre)
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(ang + Math.PI / 2 + Math.PI); // orient dome inward
      const vr = 22;
      ctx.beginPath();
      ctx.moveTo(-vr, 0);
      ctx.arc(0, 0, vr, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle   = vgccOpen ? 'rgba(58,159,200,.72)' : 'rgba(100,160,200,.3)';
      ctx.strokeStyle = isH || isS ? '#1070b0' : (vgccOpen ? '#2888c0' : 'rgba(80,130,180,.55)');
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
 * Draw synaptic vesicles.
 * Docked vesicles animate toward the membrane during the fusion phase.
 */
function drawVesicles(ctx, VESICLES) {
  for (const v of VESICLES) {
    if (v.released) continue;

    // Fusing animation: vesicle creeps toward the arc membrane
    if (v.fusing) {
      v.fuseProgress = Math.min(1, (v.fuseProgress || 0) + 0.025);
      const fp  = v.fuseProgress;
      const ang = v.cx < COLS[v.col].cx ? (Math.PI * .62) : (Math.PI * .38);
      const tx  = COLS[v.col].cx + Math.cos(ang) * TERM_R * (1 - fp * 0.3);
      const ty  = PRE_TOP + Math.sin(ang) * TERM_R * (1 - fp * 0.3);
      v.cx = v.origCx + (tx - v.origCx) * fp;
      v.cy = v.origCy + (ty - v.origCy) * fp;
      if (fp >= 1) { v.fusing = false; v.released = true; continue; }
    }

    const isH = hov === 'vesicle' && hovId === v.id;
    const isS = sel === 'vesicle' && selId === v.id;
    if (isH || isS) glowAt(ctx, v.cx, v.cy, v.r + 8, 'rgba(138,63,176,.3)');

    // Vesicle circle
    ctx.beginPath(); ctx.arc(v.cx, v.cy, v.r, 0, Math.PI * 2);
    ctx.fillStyle   = isH || isS ? 'rgba(155,75,225,.48)' : 'rgba(155,80,215,.28)';
    ctx.strokeStyle = isH || isS ? '#6010a0' : '#8a3fb0';
    ctx.lineWidth   = isH || isS ? 2.8 : 2.2;
    ctx.fill(); ctx.stroke();

    // Glutamate dots inside
    for (let di = 0; di < 3; di++) {
      const da = (di / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(v.cx + Math.cos(da) * v.r * .44, v.cy + Math.sin(da) * v.r * .44, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = isH || isS ? '#5010a0' : '#8030c0';
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

  // Cleft background
  ctx.fillStyle = 'rgba(235,228,255,.92)';
  ctx.fillRect(0, CLEFT_T, W, CLEFT_H);

  // Border lines
  ctx.strokeStyle = 'rgba(110,80,180,.35)'; ctx.lineWidth = 1.5;
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

  // ── Cleft ions ──
  const cleftIons = [
    { lbl: 'Ca²⁺', col: 'rgba(58,159,200,.75)',  x: W * .15, y: CLEFT_T + CLEFT_H * .38 },
    { lbl: 'Na⁺',  col: 'rgba(79,168,232,.75)',  x: W * .30, y: CLEFT_T + CLEFT_H * .62 },
    { lbl: 'K⁺',   col: 'rgba(100,180,100,.75)', x: W * .50, y: CLEFT_T + CLEFT_H * .38 },
    { lbl: 'Mg²⁺', col: 'rgba(160,160,175,.85)', x: W * .68, y: CLEFT_T + CLEFT_H * .62 },
    { lbl: 'Glu',  col: 'rgba(138,63,176,.60)',  x: W * .84, y: CLEFT_T + CLEFT_H * .38 },
  ];
  if (!animating) {
    drawIonGroup(ctx, cleftIons);
  }

  // ── Presynaptic Ca²⁺ (low concentration at rest) ──
  if (!['vgcc','ca_in','fusion'].includes(window._synapsePhase)) {
    for (let ci = 0; ci < 2; ci++) {
      const cx = COLS[ci].cx;
      const preIons = [
        { lbl: 'Ca²⁺', col: 'rgba(58,159,200,.28)', x: cx - 40, y: PRE_TOP + 45 },
        { lbl: 'Ca²⁺', col: 'rgba(58,159,200,.28)', x: cx + 30, y: PRE_TOP + 60 },
        { lbl: 'Ca²⁺', col: 'rgba(58,159,200,.28)', x: cx - 15, y: PRE_TOP + 85 },
        { lbl: 'Ca²⁺', col: 'rgba(58,159,200,.28)', x: cx + 50, y: PRE_TOP + 75 },
      ];
      drawIonGroup(ctx, preIons);
    }
  }

  // ── Postsynaptic Na⁺ / K⁺ ──
  const postIons = [
    { lbl: 'Na⁺', col: 'rgba(79,168,232,.30)',  x: W * .22, y: POST_T + 90 },
    { lbl: 'K⁺',  col: 'rgba(100,180,100,.30)', x: W * .38, y: POST_T + 110 },
    { lbl: 'Na⁺', col: 'rgba(79,168,232,.30)',  x: W * .62, y: POST_T + 90 },
    { lbl: 'K⁺',  col: 'rgba(100,180,100,.30)', x: W * .78, y: POST_T + 115 },
  ];
  drawIonGroup(ctx, postIons);
}

/**
 * Draw a group of ion dots, labelling each one ONLY if no same-label dot
 * has been drawn within MIN_LABEL_DIST pixels (avoids crowded labels).
 */
function drawIonGroup(ctx, ions) {
  const MIN_LABEL_DIST = 55; // px — minimum distance between same-type labels
  const labelled = {}; // label → [{x,y}]

  for (const ion of ions) {
    // Always draw the dot
    ctx.beginPath(); ctx.arc(ion.x, ion.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = ion.col;
    ctx.shadowBlur = 5; ctx.shadowColor = ion.col;
    ctx.fill(); ctx.shadowBlur = 0;

    // Only show label if far enough from existing labels of the same type
    const prev = labelled[ion.lbl] || [];
    const tooClose = prev.some(p => {
      const dx = p.x - ion.x, dy = p.y - ion.y;
      return Math.sqrt(dx * dx + dy * dy) < MIN_LABEL_DIST;
    });

    if (!tooClose) {
      ctx.font = '600 8px Nunito,sans-serif';
      ctx.fillStyle = ion.col;
      ctx.textAlign = 'center';
      ctx.fillText(ion.lbl, ion.x, ion.y - 8);
      labelled[ion.lbl] = [...prev, { x: ion.x, y: ion.y }];
    }
  }
}

/**
 * Draw postsynaptic region: dendrite shaft, spine boxes, PSD-95,
 * AMPA receptors, NMDA receptor, CaMKII.
 */
function drawPostsynaptic(ctx, phase) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // ── Dendrite shaft — fills from POST_BOT to bottom of canvas ──
  {
    const isHS = hov === 'dendrite', isSS = sel === 'dendrite';
    ctx.fillStyle   = isHS || isSS ? POST_FILL_H : POST_FILL;
    ctx.strokeStyle = isHS || isSS ? POST_STR_H  : POST_STR;
    ctx.lineWidth   = isHS || isSS ? 2.2 : 1.6;
    ctx.beginPath(); ctx.rect(0, POST_BOT, W, H - POST_BOT);
    ctx.fill(); ctx.stroke();
    reg('dendrite', W / 2, POST_BOT + (H - POST_BOT) / 2, W * .46, (H - POST_BOT) / 2);
  }

  // Spine background
  ctx.fillStyle = 'rgba(220,212,252,.38)';
  ctx.fillRect(0, POST_T, W, POST_BOT - POST_T);

  // "POSTSYNAPTIC" label — bottom left
  ctx.font = '700 11px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(80,50,165,.52)';
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

    if (isH || isS) { ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(110,65,210,.42)'; }

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
    const psdY = POST_T + 6, psdH = 6;
    const isH = hov === 'psd95' && hovId === ci;
    const isS = sel === 'psd95' && selId === ci;
    ctx.beginPath();
    ctx.rect(cx - BOX_SPINE_W / 2 + 8, psdY, BOX_SPINE_W - 16, psdH);
    ctx.fillStyle   = isH || isS ? 'rgba(62,100,190,.45)' : 'rgba(62,100,190,.18)';
    ctx.strokeStyle = isH || isS ? 'rgba(62,100,190,.8)'  : 'rgba(62,100,190,.32)';
    ctx.lineWidth   = isH || isS ? 1.5 : 1;
    ctx.fill(); ctx.stroke();
    reg('psd95', cx, psdY + psdH / 2, BOX_SPINE_W / 2 - 8, psdH, ci);
  }
}

/**
 * Draw AMPA receptors as pairs of ellipses straddling the postsynaptic membrane.
 * The pore gap widens when active (glutamate bound).
 */
function drawAMPA(ctx, phase) {
  const ampaActive = ['release','ampa_open','nmda_open','camkii'].includes(phase);

  for (let ci = 0; ci < 2; ci++) {
    const cx = COLS[ci].cx;
    for (let ai = 0; ai < AMPA_DX.length; ai++) {
      const ax = cx + AMPA_DX[ai], ay = POST_T;
      const isH = hov === 'ampa' && hovId === ci * 10 + ai;
      const isS = sel === 'ampa' && selId === ci * 10 + ai;
      if (isH || isS) glowAt(ctx, ax, ay + 28, 42, 'rgba(80,140,220,.32)');

      const gap = ampaActive ? 14 : 5; // pore widens on activation

      // Two subunit ellipses
      for (const dx of [-gap / 2 - 14, gap / 2 + 2]) {
        ctx.beginPath(); ctx.ellipse(ax + dx + 6, ay + 28, 13, 30, 0, 0, Math.PI * 2);
        ctx.fillStyle   = ampaActive ? 'rgba(70,130,220,.68)' : 'rgba(104,144,208,.35)';
        ctx.strokeStyle = isH || isS ? '#2050cc' : (ampaActive ? '#4078d8' : 'rgba(90,120,185,.65)');
        ctx.lineWidth   = isH || isS ? 2.8 : 1.8;
        ctx.fill(); ctx.stroke();
      }

      // Open-pore Na⁺ colour hint
      if (ampaActive) {
        ctx.fillStyle = 'rgba(79,168,232,.30)';
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
    if (isH || isS) glowAt(ctx, nx, ny + 30, 46, 'rgba(150,80,200,.32)');

    const gap2 = nmdaActive ? 14 : 4;

    // Two subunit ellipses (taller than AMPA)
    for (const dx of [-gap2 / 2 - 14, gap2 / 2 + 2]) {
      ctx.beginPath(); ctx.ellipse(nx + dx + 6, ny + 30, 14, 34, 0, 0, Math.PI * 2);
      ctx.fillStyle   = nmdaActive ? 'rgba(130,80,200,.68)' : 'rgba(144,96,192,.28)';
      ctx.strokeStyle = isH || isS ? '#5020a8' : (nmdaActive ? '#7848b8' : 'rgba(120,80,170,.55)');
      ctx.lineWidth   = isH || isS ? 2.8 : 1.8;
      ctx.fill(); ctx.stroke();
    }

    if (!nmdaActive) {
      // Mg²⁺ block — large grey rectangle in the pore
      ctx.fillStyle = 'rgba(160,160,175,.95)';
      ctx.beginPath(); ctx.roundRect(nx - 11, ny + 14, 22, 26, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(120,120,140,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '700 10px Nunito,sans-serif'; ctx.fillStyle = '#333';
      ctx.textAlign = 'center'; ctx.fillText('Mg²⁺', nx, ny + 30);
      ctx.font = '600 8px Nunito,sans-serif'; ctx.fillStyle = 'rgba(180,30,30,.75)';
      ctx.textAlign = 'center'; ctx.fillText('BLOCKED', nx, ny + 10);
    } else {
      // Open pore — Ca²⁺ colour hint
      ctx.fillStyle = 'rgba(224,112,80,.32)';
      ctx.fillRect(nx - gap2 / 2 + 1, ny + 3, gap2, 54);
      ctx.font = '600 8px Nunito,sans-serif'; ctx.fillStyle = 'rgba(180,80,20,.80)';
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
      const kx    = cx + (ki === 0 ? -38 : 38);
      const ky    = CAMKII_DY[ki];
      const pulse = ckOn ? .5 + .5 * Math.sin(tick * .09) : 0;
      const isH   = hov === 'camkii' && hovId === ci * 10 + ki;
      const isS   = sel === 'camkii' && selId === ci * 10 + ki;
      if (isH || isS) glowAt(ctx, kx, ky, 18, 'rgba(200,160,50,.3)');

      // Hexagon
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
        k === 0 ? ctx.moveTo(kx + Math.cos(a) * 13, ky + Math.sin(a) * 13)
                : ctx.lineTo(kx + Math.cos(a) * 13, ky + Math.sin(a) * 13);
      }
      ctx.closePath();
      ctx.fillStyle   = ckOn ? `rgba(210,160,40,${.28 + pulse * .35})` : 'rgba(150,110,60,.1)';
      ctx.strokeStyle = isH || isS ? '#a07010' : (ckOn ? `rgba(210,160,40,${.8 + pulse * .2})` : 'rgba(150,110,60,.28)');
      ctx.lineWidth   = isH || isS ? 2.2 : 1.4;
      ctx.fill(); ctx.stroke();

      // Centre dot
      ctx.beginPath(); ctx.arc(kx, ky, 3, 0, Math.PI * 2);
      ctx.fillStyle = ckOn ? 'rgba(220,170,40,.9)' : 'rgba(150,110,60,.3)';
      ctx.fill();

      reg('camkii', kx, ky, 16, 16, ci * 10 + ki);
    }
  }
}

/**
 * Draw all live particles (Ca²⁺, Na⁺, Glu, AP glow).
 * Labels are shown on every other particle, only when sufficiently opaque,
 * and only if no same-type label was drawn within MIN_DIST pixels this frame.
 */
function drawParticles(ctx, particles) {
  const MIN_DIST  = 40; // px — minimum gap between particle labels of the same type
  const labelled  = {}; // type → [{x,y}] — positions already labelled this frame

  const ION_LABELS = { ca: 'Ca²⁺', glu: 'Glu', na: 'Na⁺', ca2: 'Ca²⁺' };

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    const al = Math.min(1, p.life / 18);
    let fc, sc;
    if      (p.type === 'ca')  { fc = `rgba(58,159,200,${al*.92})`;  sc = 'rgba(58,159,200,.6)'; }
    else if (p.type === 'glu') { fc = `rgba(138,63,176,${al*.9})`;   sc = 'rgba(138,63,176,.55)'; }
    else if (p.type === 'na')  { fc = `rgba(79,168,232,${al*.9})`;   sc = 'rgba(79,168,232,.55)'; }
    else if (p.type === 'ca2') { fc = `rgba(224,112,80,${al*.92})`;  sc = 'rgba(224,112,80,.6)'; }
    else                       { fc = `rgba(245,205,55,${al*.78})`;  sc = 'rgba(245,205,55,.88)'; } // ap

    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = fc; ctx.shadowBlur = 9; ctx.shadowColor = sc;
    ctx.fill(); ctx.shadowBlur = 0;

    // Ion label — sparse: skip odd indices, dim particles, and nearby same-type labels
    const lbl = ION_LABELS[p.type];
    if (lbl && i % 2 === 0 && al > 0.45) {
      const prev = labelled[p.type] || [];
      const tooClose = prev.some(pt => {
        const dx = pt.x - p.x, dy = pt.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_DIST;
      });
      if (!tooClose) {
        ctx.font = '600 7px Nunito,sans-serif';
        ctx.fillStyle = fc;
        ctx.textAlign = 'center';
        ctx.fillText(lbl, p.x, p.y - p.r - 2);
        labelled[p.type] = [...prev, { x: p.x, y: p.y }];
      }
    }
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

  ctx.fillStyle = 'rgba(20,8,50,.85)';
  ctx.beginPath();
  ctx.roundRect(tx - 4, ty - th + 2, tw + pad * 2, th + 4, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,110,240,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#e8d4ff';
  ctx.textAlign = 'left';
  ctx.fillText(lbl, tx + pad - 4, ty);
}


/**
 * Master draw function — called every animation frame by synapse-ui.js.
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

  // Clear
  ctx.fillStyle = '#faf8ff'; ctx.fillRect(0, 0, W, H);

  drawPresynaptic(ctx, phase, VESICLES);
  drawCleft(ctx, particles);
  drawPostsynaptic(ctx, phase);
  drawParticles(ctx, particles);
  drawArrows(ctx, arrows);
  drawSynapseTooltip(ctx);
}
