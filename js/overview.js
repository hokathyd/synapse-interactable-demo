/* ═══════════════════════════════════════════════════
   js/overview.js
   Draws the animated two-neuron overview on #neuron-canvas.
   Features:
     • Presynaptic neuron (soma + myelinated axon + bouton)
     • Postsynaptic neuron (soma + dendrites + myelinated axon)
     • Periodic action-potential glow travelling along the axon
     • Glutamate dots released into the cleft when the AP hits
     • Hover tooltips naming each structural region
     • Highlighted transmission pathway (terminal → cleft → dendrites)
═══════════════════════════════════════════════════ */

(function () {

  // ── Canvas setup ──────────────────────────────────
  const nc = document.getElementById('neuron-canvas');
  const c  = nc.getContext('2d');
  const W  = nc.width;
  const H  = nc.height;
  const MID = H / 2;

  let tick = 0;
  let apT  = -1;   // action-potential progress (0–1), -1 = idle
  let dots = [];   // glutamate dot particles released at cleft

  // ── Neuron geometry ───────────────────────────────
  const PRE     = { sx: 155, sy: MID, r: 30 };  // presynaptic soma
  const BOUTON_R = 20;                            // axon terminal radius
  const PRE_TERM = { x: 430, y: MID };            // axon terminal centre

  const POST    = { sx: 710, sy: MID, r: 28 };  // postsynaptic soma
  const CLEFT_X = PRE_TERM.x + BOUTON_R + 4;     // left edge of synaptic cleft

  // Axon extents (pre: soma→terminal, post: soma→right edge)
  const axonX1      = PRE.sx + PRE.r;
  const axonX2      = PRE_TERM.x - BOUTON_R + 2;  // touches terminal
  const postAxonX1  = POST.sx + POST.r;

  // Pre-compute myelin sheath positions along each axon
  const preMyelin      = myelinPts(axonX1, MID, axonX2,  MID, 25);
  const postAxonMyelin = myelinPts(postAxonX1, MID, W + 2, MID, 22);

  // ── Dendrite trees (deterministic fractal lines) ──
  const preDend = buildTree(PRE.sx, PRE.sy, [
    { a: -Math.PI * .82, l: 62, d: 4, lw: 2.2 },
    { a: -Math.PI * .58, l: 55, d: 3, lw: 2.0 },
    { a: -Math.PI * .36, l: 50, d: 3, lw: 1.9 },
    { a:  Math.PI * .78, l: 60, d: 4, lw: 2.1 },
    { a:  Math.PI * .56, l: 50, d: 3, lw: 2.0 },
    { a: -Math.PI,       l: 54, d: 3, lw: 2.0 },
  ], 42);

  const postDend = buildTree(POST.sx, POST.sy, [
    { a:  Math.PI,       l: 82, d: 4, lw: 2.2 }, // long branch toward cleft
    { a:  Math.PI * .82, l: 70, d: 4, lw: 2.1 },
    { a: -Math.PI * .82, l: 68, d: 4, lw: 2.1 },
    { a:  Math.PI * .62, l: 58, d: 3, lw: 2.0 },
    { a: -Math.PI * .62, l: 55, d: 3, lw: 2.0 },
    { a:  Math.PI * .44, l: 48, d: 3, lw: 1.9 },
  ], 77);

  // ── Hover-tooltip regions ─────────────────────────
  let hovPart = null, mx = 0, my = 0;

  const INTRO_PARTS = {
    preSoma:  { label: 'Presynaptic Neuron (Soma)',       x: 155, y: MID, rx: 35, ry: 35 },
    preAxon:  { label: 'Myelinated Axon',                 x: 290, y: MID, rx: 80, ry: 14 },
    preTerm:  { label: 'Axon Terminal (Bouton)',           x: 430, y: MID, rx: 28, ry: 28 },
    cleft:    { label: 'Synaptic Cleft',                  x: 462, y: MID, rx: 14, ry: 30 },
    postDend: { label: 'Postsynaptic Dendrites',          x: 560, y: MID, rx: 70, ry: 40 },
    postSoma: { label: 'Postsynaptic Neuron (Soma)',      x: 710, y: MID, rx: 35, ry: 35 },
    postAxon: { label: 'Postsynaptic Axon (myelinated)', x: 810, y: MID, rx: 70, ry: 14 },
  };

  nc.addEventListener('mousemove', e => {
    const rect = nc.getBoundingClientRect();
    mx = (e.clientX - rect.left) * (W / rect.width);
    my = (e.clientY - rect.top)  * (H / rect.height);
    hovPart = null;
    for (const [, p] of Object.entries(INTRO_PARTS)) {
      if (Math.abs(mx - p.x) < p.rx && Math.abs(my - p.y) < p.ry) {
        hovPart = p.label;
        break;
      }
    }
    nc.style.cursor = hovPart ? 'pointer' : 'default';
  });
  nc.addEventListener('mouseleave', () => { hovPart = null; nc.style.cursor = 'default'; });


  // ── Helper: Linear Congruential Generator (deterministic random) ──
  function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
  }

  /**
   * Build a branching dendrite tree as an array of line segments.
   * @param {number} rx,ry  Root position
   * @param {Array}  branches  Array of { a:angle, l:length, d:depth, lw:lineWidth }
   * @param {number} seed   Seed for deterministic geometry
   */
  function buildTree(rx, ry, branches, seed) {
    const rng   = lcg(seed);
    const lines = [];

    function grow(x1, y1, ang, len, dep, lw) {
      if (dep === 0 || len < 5) return;
      const x2 = x1 + Math.cos(ang) * len;
      const y2 = y1 + Math.sin(ang) * len;
      lines.push({ x1, y1, x2, y2, lw, spine: false });

      // Small dendritic-spine stubs along each branch
      if (dep >= 2) {
        const t  = .44 + rng() * .18;
        const sx = x1 + (x2 - x1) * t;
        const sy = y1 + (y2 - y1) * t;
        const sa = ang + (rng() > .5 ? 1 : -1) * Math.PI / 2;
        const sl = 5 + rng() * 4;
        lines.push({ x1: sx, y1: sy, x2: sx + Math.cos(sa) * sl, y2: sy + Math.sin(sa) * sl, lw: .85, spine: true });
      }

      const spread = .46 + rng() * .14;
      grow(x2, y2, ang - spread, len * .66, dep - 1, lw * .76);
      grow(x2, y2, ang + spread, len * .69, dep - 1, lw * .76);
    }

    for (const b of branches) grow(rx, ry, b.a, b.l, b.d, b.lw);
    return lines;
  }

  /**
   * Compute evenly-spaced myelin sheath positions along a line segment.
   * Returns array of { x, y, ang } objects used by drawMyelinTube().
   */
  function myelinPts(x1, y1, x2, y2, spacing) {
    const dx  = x2 - x1, dy = y2 - y1;
    const L   = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux  = dx / L, uy = dy / L;
    const ang = Math.atan2(dy, dx);
    const pts = [];
    for (let d = 22; d < L - 18; d += spacing) {
      pts.push({ x: x1 + ux * d, y: y1 + uy * d, ang });
    }
    return pts;
  }


  // ── Draw primitives ───────────────────────────────

  /** Draw a neuron soma (irregular circle with nucleus) */
  function drawSoma(x, y, r, c1, c2) {
    // Irregular outline
    c.beginPath();
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const j = .80 + .20 * Math.sin(i * 2.4 + x * .04);
      c.lineTo(x + Math.cos(a) * r * j, y + Math.sin(a) * r * j);
    }
    c.closePath();
    const g = c.createRadialGradient(x - r * .28, y - r * .28, 2, x, y, r * 1.05);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    c.fillStyle = g; c.fill();
    c.strokeStyle = c2; c.lineWidth = 2; c.stroke();

    // Nucleus
    c.beginPath(); c.ellipse(x - 3, y, r * .38, r * .28, -.12, 0, Math.PI * 2);
    const ng = c.createRadialGradient(x - 5, y - 3, 1, x - 3, y, r * .36);
    ng.addColorStop(0, 'rgba(160,210,255,.82)');
    ng.addColorStop(1, 'rgba(100,160,220,.35)');
    c.fillStyle = ng; c.fill();
    c.beginPath(); c.arc(x - 4, y, r * .08, 0, Math.PI * 2);
    c.fillStyle = 'rgba(60,80,160,.55)'; c.fill();
  }

  /** Draw an axon as a line with myelin sheath ellipses */
  function drawMyelinTube(x1, y1, x2, y2, myel, lw) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = '#5828a0'; c.lineWidth = lw; c.stroke();

    for (const m of myel) {
      c.save();
      c.translate(m.x, m.y); c.rotate(m.ang);
      c.beginPath(); c.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      c.fillStyle   = 'rgba(200,178,242,.26)';
      c.strokeStyle = 'rgba(165,135,222,.42)';
      c.lineWidth = 1; c.fill(); c.stroke();
      c.restore();
    }
  }

  /** Draw a dendrite tree from a pre-computed line array */
  function drawLines(lines) {
    for (const l of lines) {
      c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2);
      c.strokeStyle = l.spine ? 'rgba(155,115,215,.5)' : '#7040a8';
      c.lineWidth   = l.lw;  c.stroke();
      if (l.spine) {
        c.beginPath(); c.arc(l.x2, l.y2, 2.2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(158,118,220,.48)'; c.fill();
      }
    }
  }

  /** Draw the blue branching axon terminal (bouton) */
  function drawBouton(x, y) {
    // Filled circle base
    c.beginPath(); c.arc(x, y, BOUTON_R, 0, Math.PI * 2);
    c.fillStyle = 'rgba(40,104,200,.38)'; c.strokeStyle = '#2060b0'; c.lineWidth = 2.2;
    c.fill(); c.stroke();

    // Fan of branch lines from the terminal centre
    const branchAngles = [-.6, -.3, 0, .3, .6];
    for (const ba of branchAngles) {
      const len = 34 + Math.abs(ba) * 10;
      const ex  = x + Math.cos(ba) * len;
      const ey  = y + Math.sin(ba) * len;
      c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey);
      c.strokeStyle = '#2868c8'; c.lineWidth = 3.2; c.stroke();
      for (const sa of [ba - .34, ba + .34]) {
        c.beginPath(); c.moveTo(ex, ey);
        c.lineTo(ex + Math.cos(sa) * 16, ey + Math.sin(sa) * 16);
        c.strokeStyle = '#4888d8'; c.lineWidth = 1.8; c.stroke();
      }
    }

    // Junction dot
    c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2);
    c.fillStyle = '#2868c8'; c.fill();
  }


  // ── Main animation loop ───────────────────────────

  function loop() {
    c.clearRect(0, 0, W, H);
    tick++;

    // Fire an action potential roughly every 200 frames
    if (tick % 200 === 15 && apT < 0) apT = 0;
    if (apT >= 0) { apT += .008; if (apT > 1.08) apT = -1; }

    // Spawn glutamate dots as the AP reaches the bouton
    if (apT > .87 && apT < .94 && tick % 4 === 0) {
      for (let i = 0; i < 3; i++) {
        dots.push({
          x:  PRE_TERM.x + BOUTON_R + 4 + (Math.random() - .5) * 6,
          y:  PRE_TERM.y + (Math.random() - .5) * 5,
          vx: .7 + Math.random() * .4,
          vy: (Math.random() - .5) * .4,
          life: 48 + Math.random() * 16,
        });
      }
    }
    // Advance glutamate dots
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.x += d.vx; d.y += d.vy; d.life--;
      if (d.life <= 0) dots.splice(i, 1);
    }

    // ── Draw presynaptic neuron ──
    drawLines(preDend);
    drawMyelinTube(axonX1, MID, axonX2, MID, preMyelin, 4);

    // Action-potential glow travelling along the axon
    if (apT >= 0 && apT <= 1) {
      const ax = axonX1 + apT * (axonX2 - axonX1);
      c.beginPath(); c.arc(ax, MID, 9, 0, Math.PI * 2);
      c.fillStyle   = `rgba(250,210,60,${.9 - apT * .14})`;
      c.shadowBlur  = 22; c.shadowColor = 'rgba(250,210,60,.9)';
      c.fill(); c.shadowBlur = 0;
    }

    drawSoma(PRE.sx, PRE.sy, PRE.r, '#b080e0', '#4820a0');
    drawBouton(PRE_TERM.x, PRE_TERM.y);

    // Synaptic cleft dashed divider
    c.setLineDash([3, 4]);
    c.strokeStyle = 'rgba(190,160,235,.45)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(CLEFT_X, MID - 28); c.lineTo(CLEFT_X, MID + 28); c.stroke();
    c.setLineDash([]);

    // ── Draw postsynaptic neuron ──
    drawLines(postDend);
    drawMyelinTube(postAxonX1, MID, W + 4, MID, postAxonMyelin, 3.5);
    drawSoma(POST.sx, POST.sy, POST.r, '#a068d0', '#381898');

    // Glutamate dots drifting into cleft
    for (const d of dots) {
      const al = Math.min(1, d.life / 32);
      c.beginPath(); c.arc(d.x, d.y, 3.2, 0, Math.PI * 2);
      c.fillStyle  = `rgba(138,63,176,${al * .9})`;
      c.shadowBlur = 7; c.shadowColor = 'rgba(138,63,176,.5)';
      c.fill(); c.shadowBlur = 0;
    }

    drawOverviewLabels();
    drawTransmissionHighlight();
    drawHoverTooltip();

    requestAnimationFrame(loop);
  }


  // ── Labels ────────────────────────────────────────

  function drawOverviewLabels() {
    // Neuron names — larger, prominent
    c.font = '700 13px Nunito,sans-serif';
    c.fillStyle = 'rgba(172,142,228,.92)';
    c.textAlign = 'left';  c.fillText('Presynaptic neuron', 6, 18);
    c.textAlign = 'center'; c.fillText('Postsynaptic neuron', POST.sx + 50, 18);

    // Sub-labels
    c.font = '500 8.5px Nunito Sans,sans-serif';
    c.fillStyle = 'rgba(145,115,208,.62)';
    c.textAlign = 'center';
    c.fillText('myelinated axon', (axonX1 + axonX2) / 2, MID - 18);
    c.fillText('axon terminal',   PRE_TERM.x, PRE_TERM.y - BOUTON_R - 10);
    c.fillText('axon →',          (postAxonX1 + (W - 8)) / 2, POST.sy - 16);
    c.textAlign = 'left';

    // Vertical "Synaptic Cleft" label
    c.font = '700 9px Nunito,sans-serif';
    c.fillStyle = 'rgba(130,90,190,.85)';
    c.save();
    c.translate(CLEFT_X + 10, MID);
    c.rotate(-Math.PI / 2);
    c.textAlign = 'center';
    c.fillText('Synaptic Cleft', 0, 0);
    c.restore();
  }

  /**
   * Subtle highlight showing which regions participate in glutamatergic transmission:
   * axon terminal → synaptic cleft → postsynaptic dendrites
   */
  function drawTransmissionHighlight() {
    // 1. Blue glow around axon terminal
    const hlGrad = c.createLinearGradient(PRE_TERM.x - BOUTON_R - 5, 0, CLEFT_X + 30, 0);
    hlGrad.addColorStop(0, 'rgba(80,160,255,0)');
    hlGrad.addColorStop(.3, 'rgba(80,160,255,.18)');
    hlGrad.addColorStop(.7, 'rgba(80,160,255,.18)');
    hlGrad.addColorStop(1, 'rgba(80,160,255,0)');
    c.fillStyle = hlGrad;
    c.beginPath();
    c.roundRect(PRE_TERM.x - BOUTON_R - 2, MID - BOUTON_R - 2, BOUTON_R * 2 + 4, BOUTON_R * 2 + 4, 8);
    c.fill();
    c.beginPath(); c.arc(PRE_TERM.x, PRE_TERM.y, BOUTON_R + 5, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(50,140,255,.35)'; c.lineWidth = 2.5; c.stroke();

    // 2. Purple band across the synaptic cleft
    c.fillStyle = 'rgba(180,100,255,.12)';
    c.fillRect(CLEFT_X - 1, MID - 28, 14, 56);
    c.strokeStyle = 'rgba(170,90,240,.45)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(CLEFT_X, MID - 28);     c.lineTo(CLEFT_X, MID + 28);     c.stroke();
    c.beginPath(); c.moveTo(CLEFT_X + 13, MID - 28); c.lineTo(CLEFT_X + 13, MID + 28); c.stroke();

    // 3. Radial glow over postsynaptic dendrites
    const dendHL = c.createRadialGradient(POST.sx - 60, MID, 5, POST.sx - 60, MID, 80);
    dendHL.addColorStop(0, 'rgba(180,80,255,.22)');
    dendHL.addColorStop(1, 'rgba(180,80,255,0)');
    c.fillStyle = dendHL;
    c.beginPath(); c.arc(POST.sx - 60, MID, 80, 0, Math.PI * 2); c.fill();
  }

  /** Draw a tooltip box when hovering over a named region */
  function drawHoverTooltip() {
    if (!hovPart) return;
    const pad = 8, th = 22;
    c.font = '700 10.5px Nunito,sans-serif';
    const tw = c.measureText(hovPart).width;
    let tx = mx + 12, ty = my - 14;
    if (tx + tw + pad * 2 > W) tx = mx - tw - pad * 2 - 12;
    if (ty - th < 0) ty = my + 26;

    c.fillStyle = 'rgba(30,12,60,.82)';
    c.beginPath();
    c.roundRect(tx - 2, ty - th + 2, tw + pad * 2, th + 4, 6);
    c.fill();
    c.strokeStyle = 'rgba(160,120,255,.6)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#e8d8ff';
    c.textAlign = 'left';
    c.fillText(hovPart, tx + pad - 2, ty);
  }

  // Kick off the animation
  loop();

})();
