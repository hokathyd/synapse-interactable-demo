/* ═══════════════════════════════════════════════════
   js/synapse-ui.js
   Wires up the interactive synapse diagram:
     • requestAnimationFrame draw loop
     • Phase state machine (rest → ap → … → camkii)
     • Mouse events: hover highlight + click info panel
     • Button handlers: Fire AP, Next, Replay, Reset
     • Speed slider + Autoplay checkbox
   Depends on: synapse-data.js, synapse-draw.js,
               synapse-particles.js
═══════════════════════════════════════════════════ */

// Guard: only initialise once even if goSynapse() is called multiple times
let synapseStarted = false;

/**
 * Entry point; called by navigation.js when the user clicks "Zoom into synapse".
 */
function startSynapse() {
  if (synapseStarted) return;
  synapseStarted = true;
  initSynapse();
}

function initSynapse() {
  const canvas = document.getElementById('syn-canvas');
  const ctx    = canvas.getContext('2d');

  // ── Phase order ──────────────────────────────────
  // Vesicles start docked & primed at rest; Fire AP → ap → vgcc → fusion → ...
  const PHASES = ['rest','ap','vgcc','fusion','release','ampa_open','nmda_open','camkii'];

  // How many ticks each phase lasts before auto-advancing (at 1× speed)
  const PHASE_DURATIONS = {
    ap: 85, vgcc: 95, fusion: 110,
    release: 105, ampa_open: 120, nmda_open: 130,
    camkii: 99999, // stays until manually advanced
  };

  // ── Mutable state ────────────────────────────────
  let particles  = [];  // live particle objects
  let arrows     = [];  // live arrow objects
  const VESICLES = buildVesicles(); // from synapse-data.js

  let phase      = 'rest';
  let phaseTimer = 99999; // ticks remaining in current phase
  let waiting    = false; // true when paused for manual "Next →" click
  let speedMult  = 1;


  // ── Speed slider ─────────────────────────────────
  document.getElementById('speed-slider').addEventListener('input', e => {
    speedMult = parseFloat(e.target.value);
    document.getElementById('speed-val').textContent = speedMult + '×';
  });


  // ── Animation loop ───────────────────────────────
  function loop() {
    const isAuto = document.getElementById('cb-auto').checked;

    // Count down the phase timer when playing
    if (!waiting || isAuto) {
      phaseTimer -= isAuto ? speedMult : 1;
      if (phaseTimer <= 0) advancePhase();
    }

    // Delegate all drawing to synapse-draw.js
    drawFrame(ctx, phase, particles, arrows, VESICLES);

    requestAnimationFrame(loop);
  }


  // ── Phase transitions ────────────────────────────

  function advancePhase() {
    const idx = PHASES.indexOf(phase);
    if (idx >= PHASES.length - 1) return;
    goToPhase(PHASES[idx + 1]);
  }

  function goBackPhase() {
    const idx = PHASES.indexOf(phase);
    if (idx < 1) return; // can't go back from rest
    const prevPhase = PHASES[idx - 1];
    // Reset vesicles when going back
    for (const v of VESICLES) {
      v.fusing = false;
      v.released = false;
      v.fuseProgress = 0;
      if (v.docked) {
        v.stuckAtMembrane = true;
        const cx = COLS[v.col].cx;
        const fuseIdx = v.origCx < cx - 15 ? 0 : (v.origCx > cx + 15 ? 2 : 1);
        const t = FUSE_TARGETS[fuseIdx];
        v.cx = cx + t.dx;
        v.cy = PRE_BOT + t.dy;
      } else {
        v.stuckAtMembrane = false;
        v.cx = v.origCx;
        v.cy = v.origCy;
      }
    }
    particles.length = 0;
    if (prevPhase === 'rest') {
      phase = 'rest';
      phaseTimer = 99999;
      waiting = false;
      particles.length = 0;
      arrows.length = 0;
      setStepUI(0);  // Step 1: vesicles docked & primed
      for (const v of VESICLES) {
        v.fusing = false;
        v.released = false;
        v.fuseProgress = 0;
        if (v.docked) {
          v.stuckAtMembrane = true;
          const cx = COLS[v.col].cx;
          const fuseIdx = v.origCx < cx - 15 ? 0 : (v.origCx > cx + 15 ? 2 : 1);
          const t = FUSE_TARGETS[fuseIdx];
          v.cx = cx + t.dx;
          v.cy = PRE_BOT + t.dy;
        } else {
          v.stuckAtMembrane = false;
          v.cx = v.origCx;
          v.cy = v.origCy;
        }
      }
      document.querySelectorAll('.step-row').forEach(el => el.classList.remove('active', 'done'));
      document.getElementById('step-popup').classList.remove('show');
      document.getElementById('btn-fire').disabled = false;
      document.getElementById('btn-back').disabled = true;
      document.getElementById('btn-next').disabled = true;
      document.getElementById('btn-replay').style.display = 'none';
    } else {
      goToPhase(prevPhase);
    }
  }

  function goToPhase(ph) {
    phase = ph;
    // Spawn particles / arrows appropriate to this phase
    phaseParticles(ph, particles, arrows, VESICLES);
    // Update the step list highlight and popup text (rest=step 0, ap=step 1, etc.)
    setStepUI(ph === 'rest' ? 0 : PHASES.indexOf(ph));

    const isAuto = document.getElementById('cb-auto').checked;
    const idx = PHASES.indexOf(ph);
    document.getElementById('btn-back').disabled = (idx < 1);
    if (isAuto) {
      phaseTimer = stepDur(ph);
      waiting    = false;
    } else {
      phaseTimer = 99999;
      waiting    = true;
      document.getElementById('btn-replay').style.display = 'block';
      document.getElementById('btn-next').disabled = (idx >= PHASES.length - 1);
    }
  }

  function stepDur(ph) {
    return (PHASE_DURATIONS[ph] || 80) / speedMult;
  }


  // ── Step list UI ─────────────────────────────────
  // Sync step row labels from STEP_POPUPS
  document.querySelectorAll('.step-row').forEach((el, i) => {
    if (STEP_POPUPS[i]) {
      el.querySelector('.snum').textContent = i;
      el.querySelector('.stxt').textContent = STEP_POPUPS[i].label || STEP_POPUPS[i].title;
    }
  });

  function setStepUI(idx) {
    document.querySelectorAll('.step-row').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if      (i === idx) el.classList.add('active');
      else if (i <  idx) el.classList.add('done');
    });

    // Show step popup below canvas
    if (idx >= 0 && idx < STEP_POPUPS.length) {
      const d = STEP_POPUPS[idx];
      document.getElementById('pop-tag').textContent   = d.tag;
      document.getElementById('pop-title').textContent = d.title;
      document.getElementById('pop-body').textContent  = d.body;
      document.getElementById('step-popup').classList.add('show');
    } else {
      document.getElementById('step-popup').classList.remove('show');
    }
  }


  // ── Button handlers ──────────────────────────────

  // Fire AP; starts the sequence from rest
  document.getElementById('btn-fire').addEventListener('click', () => {
    if (phase !== 'rest') return;
    document.getElementById('btn-fire').disabled = true;
    goToPhase('ap');
  });

  // Back; go to previous phase
  document.getElementById('btn-back').addEventListener('click', () => {
    goBackPhase();
  });

  // Next →; advance one phase while in manual mode
  document.getElementById('btn-next').addEventListener('click', () => {
    if (waiting) advancePhase();
  });

  // Replay; re-spawn the current phase's particles/arrows
  document.getElementById('btn-replay').addEventListener('click', () => {
    arrows.length = 0;
    phaseParticles(phase, particles, arrows, VESICLES);
  });

  // Reset all; return to rest state
  document.getElementById('btn-reset').addEventListener('click', () => {
    phase      = 'rest';
    phaseTimer = 99999;
    waiting    = false;
    particles.length = 0;
    arrows.length    = 0;

    // Reset vesicles; docked ones return to fusion site
    for (const v of VESICLES) {
      v.fusing      = false;
      v.released    = false;
      v.fuseProgress = 0;
      if (v.docked) {
        v.stuckAtMembrane = true;
        const cx = COLS[v.col].cx;
        const fuseIdx = v.origCx < cx - 15 ? 0 : (v.origCx > cx + 15 ? 2 : 1);
        const t = FUSE_TARGETS[fuseIdx];
        v.cx = cx + t.dx;
        v.cy = PRE_BOT + t.dy;
      } else {
        v.stuckAtMembrane = false;
        v.cx = v.origCx;
        v.cy = v.origCy;
      }
    }

    setStepUI(0);  // Step 1: vesicles docked & primed
    document.getElementById('btn-fire').disabled   = false;
    document.getElementById('btn-back').disabled   = true;
    document.getElementById('btn-next').disabled   = true;
    document.getElementById('btn-replay').style.display = 'none';
    showInfo(null, null);
  });

  // Autoplay toggle; if switched on while waiting, resume
  document.getElementById('cb-auto').addEventListener('change', e => {
    if (e.target.checked && waiting && phase !== 'rest' && phase !== 'camkii') {
      waiting    = false;
      phaseTimer = stepDur(phase);
    }
  });


  // ── Info panel (hover/click) ──────────────────────

  function showInfo(key, id) {
    sel   = key;
    selId = id ?? null;
    const box = document.getElementById('info-box');
    if (!key || !PARTS[key]) {
      box.innerHTML = '<span class="placeholder">Hover over any part, then click to read about it.</span>';
      box.classList.remove('lit');
      return;
    }
    const d = PARTS[key];
    box.innerHTML = `<div class="itag">${d.tag}</div><h3>${d.title}</h3><p>${d.body}</p>`;
    box.classList.add('lit');
  }


  // ── Mouse events on the canvas ───────────────────

  // Hit test: iterate in reverse so overlayed elements (vesicle, AMPA, NMDA, CaMKII)
  // take precedence over terminal/spine when hovering over both
  function hitTest(mx, my) {
    for (let i = hitRegions.length - 1; i >= 0; i--) {
      const reg = hitRegions[i];
      if (Math.abs(mx - reg.x) < reg.rx && Math.abs(my - reg.y) < reg.ry) {
        return { key: reg.key, id: reg.id };
      }
    }
    return null;
  }

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    synMx = (e.clientX - r.left) * (canvas.width  / r.width);
    synMy = (e.clientY - r.top)  * (canvas.height / r.height);

    const h = hitTest(synMx, synMy);
    hov = h ? h.key : null;
    hovId = h ? h.id : null;
    canvas.style.cursor = h ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', () => { hov = null; hovId = null; });

  canvas.addEventListener('click', e => {
    const r  = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width  / r.width);
    const my = (e.clientY - r.top)  * (canvas.height / r.height);
    const h  = hitTest(mx, my);
    showInfo(h ? h.key : null, h ? h.id : null);
  });


  // Initial state: step 1 (vesicles docked & primed)
  setStepUI(0);

  // Kick off the render loop
  loop();
}
