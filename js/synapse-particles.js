/* ═══════════════════════════════════════════════════
   js/synapse-particles.js
   Spawns directional particles and arrow overlays for
   each phase of glutamatergic transmission.
   Depends on: synapse-data.js (COLS, layout constants,
               AMPA_DX, NMDA_DX, CAMKII_DY, VESICLES)
═══════════════════════════════════════════════════ */

/**
 * Spawn N particles travelling from (fx,fy) → (tx,ty).
 * Particles are added to the shared `particles` array.
 */
function spawnDir(particles, type, fx, fy, tx, ty, n) {
  const dx   = tx - fx, dy = ty - fy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  for (let i = 0; i < n; i++) {
    const t  = Math.random() * .2;
    const sp = .9 + Math.random() * .9;
    particles.push({
      type,
      x:  fx + dx * t + (Math.random() - .5) * 5,
      y:  fy + dy * t + (Math.random() - .5) * 5,
      vx: (dx / dist) * sp,
      vy: (dy / dist) * sp,
      life: Math.ceil(dist / sp * (1 + Math.random() * .2)),
      // Radius by ion type
      r: type === 'ca'  ? 4.5
       : type === 'ca2' ? 4
       : type === 'na'  ? 3.8
       : type === 'ap'  ? 7
       : 3.5,
    });
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

    // ── Step 2: VGCCs open; Ca²⁺ enters from outside ──
    case 'vgcc':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (let vi = 0; vi < 2; vi++) {
          const ang = vi === 0 ? (Math.PI * .55) : (Math.PI * .45);
          const vx  = cx + Math.cos(ang) * TERM_R;
          const vy  = PRE_TOP + Math.sin(ang) * TERM_R;
          // Ca²⁺ flows inward through the VGCC
          spawnDir(particles, 'ca', vx, AXON_BOT + 25, vx, vy - 5, 12);
          spawnArrow(arrows, vx, AXON_BOT + 20, vx, vy - 4, ION_COLORS.ca, 95);
        }
      }
      break;

    // ── Step 3: Ca²⁺ triggers vesicle fusion ──
    case 'ca_in':
      for (const v of VESICLES) {
        if (!v.docked) continue;
        v.fusing      = true;
        v.fuseProgress = 0;
        v.cx = v.origCx; v.cy = v.origCy; // reset for replay

        const ang = v.cx < COLS[v.col].cx ? (Math.PI * .55) : (Math.PI * .45);
        const vx  = COLS[v.col].cx + Math.cos(ang) * TERM_R;
        const vy  = PRE_TOP + Math.sin(ang) * TERM_R;
        spawnDir(particles, 'ca', vx, vy, v.cx, v.cy, 5);
        spawnArrow(arrows, vx, vy, v.cx, v.cy, ION_COLORS.ca, 80);
      }
      break;

    // ── Step 4: Vesicle fusion; glutamate into cleft ──
    case 'fusion':
      for (const v of VESICLES) {
        if (!v.fusing) continue;
        v.fusing   = false;
        v.released = true;
        spawnDir(particles, 'glu', v.cx, v.cy, v.cx, CLEFT_T + CLEFT_H * .6, 12);
      }
      for (const col of COLS) {
        spawnArrow(arrows, col.cx, PRE_BOT - 5, col.cx, POST_T + 8, ION_COLORS.glu, 95);
      }
      break;

    // ── Step 5: Glutamate diffuses to receptors ──
    case 'release':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (const dx of AMPA_DX) {
          spawnDir(particles, 'glu', cx + dx, CLEFT_T + 4, cx + dx, POST_T + 8, 7);
          spawnArrow(arrows, cx + dx, CLEFT_T + 3, cx + dx, POST_T + 6, ION_COLORS.glu, 88);
        }
        for (const dx of NMDA_DX) {
          spawnDir(particles, 'glu', cx + dx, CLEFT_T + 4, cx + dx, POST_T + 8, 6);
          spawnArrow(arrows, cx + dx, CLEFT_T + 3, cx + dx, POST_T + 6, ION_COLORS.glu, 88);
        }
      }
      break;

    // ── Step 6: AMPA opens; Na⁺ flows in ──
    case 'ampa_open':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (const dx of AMPA_DX) {
          spawnDir(particles, 'na', cx + dx, POST_T + 5, cx + dx, POST_T + 120, 16);
          spawnArrow(arrows, cx + dx, POST_T + 6, cx + dx, POST_T + 110, ION_COLORS.na, 92);
        }
      }
      break;

    // ── Step 7: NMDA opens; Ca²⁺ flows in ──
    case 'nmda_open':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (const dx of NMDA_DX) {
          spawnDir(particles, 'ca2', cx + dx, POST_T + 5, cx + dx, POST_T + 130, 18);
          spawnArrow(arrows, cx + dx, POST_T + 6, cx + dx, POST_T + 120, ION_COLORS.ca, 98);
        }
      }
      break;

    // ── Step 8: Ca²⁺ activates CaMKII → LTP ──
    case 'camkii':
      for (let ci = 0; ci < 2; ci++) {
        const cx = COLS[ci].cx;
        for (let ki = 0; ki < 2; ki++) {
          const kx = cx + (ki === 0 ? -38 : 38);
          const ky = CAMKII_DY[ki];
          for (const dx of NMDA_DX) {
            spawnArrow(arrows, cx + dx, POST_T + 120, kx, ky, ION_COLORS.ca, 98);
          }
        }
      }
      break;

    // 'rest'; nothing to spawn
    default:
      break;
  }
}
