/* ═══════════════════════════════════════════════════
   js/synapse-particles.js
   Spawns directional particles and arrow overlays for
   each phase of glutamatergic transmission.
   Depends on: synapse-data.js (COLS, layout constants,
               AMPA_DX, NMDA_DX, CAMKII_DY, VESICLES)
═══════════════════════════════════════════════════ */

/**
 * Spawn N particles travelling from (fx,fy) → (tx,ty).
 * If bindTarget is true, particles stick at (tx,ty) when they arrive.
 */
function spawnDir(particles, type, fx, fy, tx, ty, n, bindTarget) {
  const dx   = tx - fx, dy = ty - fy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  for (let i = 0; i < n; i++) {
    const t  = Math.random() * .2;
    const sp = .9 + Math.random() * .9;
    const p = {
      type,
      x:  fx + dx * t + (Math.random() - .5) * 5,
      y:  fy + dy * t + (Math.random() - .5) * 5,
      vx: (dx / dist) * sp,
      vy: (dy / dist) * sp,
      life: Math.ceil(dist / sp * (1 + Math.random() * .2)),
      r: type === 'ca'  ? 4.5
       : type === 'ca2' ? 4
       : type === 'na'  ? 3.8
       : type === 'ap'  ? 7
       : 3.5,
    };
    if (bindTarget) p.bindTarget = { x: tx, y: ty };
    particles.push(p);
  }
}

/** Add a fading directional arrow to the shared `arrows` array. */
function spawnArrow(arrows, x1, y1, x2, y2, col, life) {
  arrows.push({ x1, y1, x2, y2, col, life });
}

/**
 * Trigger the appropriate particles and arrows for a given phase.
 * Mutates the particles[], arrows[], and VESICLES[] in place.
 *
 * Phase sequence:
 *   rest → ap → vgcc → ca_in → fusion → release →
 *   ampa_open → nmda_open → camkii
 */
function phaseParticles(phase, particles, arrows, VESICLES) {
  // Clear old arrows; particles fade naturally
  arrows.length = 0;

  switch (phase) {

    // ── Step 1: Action potential travels down each axon column ──
    case 'ap':
      for (const col of COLS) {
        spawnDir(particles, 'ap', col.cx, 0, col.cx, AXON_BOT, 8);
        spawnArrow(arrows, col.cx, 4, col.cx, AXON_BOT - 4, ION_COLORS.ap, 110);
      }
      break;

    // ── Step 2: VGCCs open; Ca²⁺ enters perpendicular to each VGCC semicircle ──
    case 'vgcc':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (let vi = 0; vi < 2; vi++) {
          const ang = VGCC_ANGLES[vi];
          const vx = cx + Math.cos(ang) * TERM_R;
          const vy = PRE_TOP + Math.sin(ang) * TERM_R;
          // Perpendicular: inward normal (-cos, -sin) from membrane into cytoplasm
          const perp = 45;
          const srcX = vx + Math.cos(ang) * 25;   // start in cleft (outward from membrane)
          const srcY = vy + Math.sin(ang) * 25;
          const dstX = vx - Math.cos(ang) * perp;  // end inside (inward)
          const dstY = vy - Math.sin(ang) * perp;
          spawnDir(particles, 'ca', srcX, srcY, dstX, dstY, 12);
          spawnArrow(arrows, srcX, srcY, dstX, dstY, ION_COLORS.ca, 115);
        }
      }
      break;

    // ── Step 3: Ca²⁺ continues perpendicular into terminal toward vesicles (particles only, no arrows) ──
    case 'ca_in':
      for (const v of VESICLES) {
        if (!v.docked) continue;
        v.fusing      = true;
        v.fuseProgress = 0;
        v.cx = v.origCx; v.cy = v.origCy; // reset for replay
      }
      const vesTargetY = PRE_TOP + TERM_R * .15;
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (let vi = 0; vi < 2; vi++) {
          const ang = VGCC_ANGLES[vi];
          const vx = cx + Math.cos(ang) * TERM_R;
          const vy = PRE_TOP + Math.sin(ang) * TERM_R;
          const caFromX = vx - Math.cos(ang) * 35;
          const caFromY = vy - Math.sin(ang) * 35;
          spawnDir(particles, 'ca', caFromX, caFromY, cx, vesTargetY, 8);
        }
      }
      break;

    // ── Step 4: Vesicle disappears (merges); glutamate flows out from 3 fusion sites per terminal ──
    case 'fusion':
      for (const v of VESICLES) {
        if (v.stuckAtMembrane) v.released = true;  // vesicle disappears now
      }
      // Glutamate from 3 points: left of VGCC, between VGCCs, right of VGCC
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (let fi = 0; fi < 3; fi++) {
          const t = FUSE_TARGETS[fi];
          const fx = cx + t.dx;
          const fy = PRE_BOT + t.dy;
          spawnDir(particles, 'glu', fx, fy, fx, CLEFT_T + CLEFT_H * .5, 6);
          spawnArrow(arrows, fx, fy, fx, CLEFT_T + CLEFT_H * .5, ION_COLORS.glu, 105);
        }
      }
      break;

    // ── Step 5: Glutamate continues from cleft into AMPA receptors, binds (flow only, no arrows) ──
    case 'release':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        const cleftY = CLEFT_T + CLEFT_H * .5;
        for (let vi = 0; vi < 2; vi++) {
          const tgtX = cx + AMPA_DX[vi];
          spawnDir(particles, 'glu', cx, cleftY, tgtX, POST_T, 6, true);
        }
      }
      break;

    // ── Step 6: Glutamate disappears from AMPA; AMPA opens; Na⁺ flows in ──
    case 'ampa_open':
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].type === 'glu') particles.splice(i, 1);
      }
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (const dx of AMPA_DX) {
          spawnDir(particles, 'na', cx + dx, POST_T + 5, cx + dx, POST_T + 155, 16);
          spawnArrow(arrows, cx + dx, POST_T + 6, cx + dx, POST_T + 150, ION_COLORS.na, 100);
        }
      }
      break;

    // ── Step 7: NMDA opens; Ca²⁺ flows in ──
    case 'nmda_open':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (const dx of NMDA_DX) {
          spawnDir(particles, 'ca2', cx + dx, POST_T + 5, cx + dx, POST_T + 165, 18);
          spawnArrow(arrows, cx + dx, POST_T + 6, cx + dx, POST_T + 160, ION_COLORS.ca, 105);
        }
      }
      break;

    // ── Step 8: Ca²⁺ activates CaMKII → LTP (flow only, no arrows; 2 directions toward CaMKII) ──
    case 'camkii':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        const srcX = cx + NMDA_DX[0];
        const srcY = POST_T + 155;
        for (let ki = 0; ki < 2; ki++) {
          const kx = cx + (ki === 0 ? -48 : 48);
          const ky = CAMKII_DY[ki];
          spawnDir(particles, 'ca2', srcX, srcY, kx, ky, 10);
        }
      }
      break;

    // 'rest'; nothing to spawn
    default:
      break;
  }
}
