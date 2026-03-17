/* ═══════════════════════════════════════════════════
   js/synapse-data.js
   All static data for the synapse diagram:
     • Layout constants (pixel positions, sizes)
     • Part hover/click descriptions
     • Step-by-step popup content
     • Vesicle initial positions
   Exposed as globals consumed by synapse-draw.js,
   synapse-particles.js, and synapse-ui.js.
═══════════════════════════════════════════════════ */

// ── Layout constants ─────────────────────────────────────────
// Vertical zones (px from top of 840×680 canvas):

const AXON_BOT  = 180;           // bottom of the axon column rectangles
const PRE_TOP   = AXON_BOT;      // top of the semicircular terminal bulge
const TERM_R    = 100;           // radius of terminal semicircle (shorter; spine+shaft ≈ terminal)
const PRE_BOT   = PRE_TOP + TERM_R;  // bottom of terminals / top of cleft

const CLEFT_T   = PRE_BOT;       // top of synaptic cleft
const CLEFT_H   = 127;           // height of cleft band
const POST_T    = CLEFT_T + CLEFT_H; // top of dendritic spines

// Spine + shaft ≈ terminal height; space from shorter terminal added to spine
const POST_BOT  = POST_T + 233;  // bottom of spine boxes / top of dendrite shaft

// Horizontal columns (only 2, shifted right to avoid label overlap)
const COLS = [{ cx: 270 }, { cx: 570 }];

// Terminal and spine box share the same width
const BOX_W       = TERM_R * 2;   // = 240
const BOX_SPINE_W = BOX_W;

// AMPA receptor x-offsets relative to each column centre (centered in spine)
const AMPA_DX = [-80, 80];  // two AMPA receptors, symmetric (wider spine)

// VGCC positions and angles (matches drawVGCCs .35π and .65π)
const VGCC_ANGLES = [Math.PI * .35, Math.PI * .65];
const VGCC_DX = [Math.round(TERM_R * Math.cos(VGCC_ANGLES[0])), Math.round(TERM_R * Math.cos(VGCC_ANGLES[1]))];
const VGCC_DY = Math.round(TERM_R * Math.sin(VGCC_ANGLES[0]));


// NMDA receptor x-offset; centred between the two AMPA receptors
const NMDA_DX = [0];       // center of spine

// CaMKII positions (y) inside each spine, two per spine
const CAMKII_DY = [POST_T + 155, POST_T + 195];

// Ion/molecule colors (hex); use consistently across diagram, particles, arrows
const ION_COLORS = {
  ca:  '#FF8C00',  // Ca²⁺ orange
  na:  '#9E9E9E',  // Na⁺ grey
  k:   '#FF69B4',  // K⁺ pink
  mg:  '#4B0082',  // Mg²⁺ indigo
  glu: '#FF0000',  // Glutamate red
  ap:  '#FFEB3B',  // Action potential yellow
};
// Receptor / channel structure colors (blue/purple reserved for axon terminal & dendrite)
const RECEPTOR_COLORS = {
  vgcc:  '#FF8C00',  // VGCC; warm orange (Ca²⁺ association)
  ampa:  '#69f0ae',  // AMPA; bright mint green
  nmda:  '#26a69a',  // NMDA; teal (distinct from AMPA)
  psd95: '#94a3b8',  // PSD-95 scaffold; slate gray
  camkii:'#e07a5f',  // CaMKII; coral (distinct from AP yellow)
};
// rgba(alpha) helpers for translucent fills
const ION_RGBA = {
  ca:  a => `rgba(255,140,0,${a})`,
  na:  a => `rgba(158,158,158,${a})`,
  k:   a => `rgba(255,105,180,${a})`,
  mg:  a => `rgba(75,0,130,${a})`,
  glu: a => `rgba(255,0,0,${a})`,
  ap:  a => `rgba(255,235,59,${a})`,
};


// ── Part descriptions (hover/click info panel) ────────────────
const PARTS = {
  vesicle: {
    tag:  'Presynaptic',
    title: 'Synaptic Vesicle',
    body:  'A small membrane-bound sac holding ~3,000 glutamate molecules. When Ca²⁺ enters, it ' +
           'binds proteins that fuse the vesicle with the cell membrane, releasing glutamate ' +
           'into the cleft.',
  },
  vgcc: {
    tag:  'Presynaptic',
    title: 'Voltage-Gated Ca²⁺ Channel (VGCC)',
    body:  'A channel that stays closed until the action potential arrives. It then opens briefly ' +
           '(~1 ms) and lets Ca²⁺ flow in; there is much more Ca²⁺ outside than inside, so it ' +
           'wants to flow in in order to bring the concentration gradient to equilibrium). This triggers vesicle fusion',
  },
  axon: {
    tag:  'Presynaptic',
    title: 'Axon',
    body:  'Carries the electrical signal from the cell body to the terminal. When the signal ' +
           'reaches the terminal, it opens the Ca²⁺ channels',
  },
  cleft: {
    tag:  'Synaptic Cleft',
    title: 'Synaptic Cleft',
    body:  'The narrow gap (~20 nm) between the two neurons. Glutamate crosses it by diffusion ' +
           'in under a millisecond. Other cells then remove excess glutamate to end the signal.',
  },
  ampa: {
    tag:  'Postsynaptic',
    title: 'AMPA Receptor',
    body:  'When glutamate binds, this receptor opens and lets Na⁺ flow in. This produces the ' +
           'fast excitatory signal within 1-2 ms.',
  },
  nmda: {
    tag:  'Postsynaptic',
    title: 'NMDA Receptor',
    body:  'The coincidence detector; blocked by Mg²⁺ at rest. Once AMPA depolarizes the cell, ' +
           'the block is removed and Ca²⁺ (and Na⁺) can flow in. This Ca²⁺ signal drives LTP',
  },
  spine: {
    tag:  'Postsynaptic',
    title: 'Dendritic Spine',
    body:  'A small protrusion on the dendrite where one synapse sits. It holds the receptors ' +
           'and signaling proteins. Spine size can change when the synapse strengthens.',
  },
  psd95: {
    tag:  'Postsynaptic',
    title: 'PSD-95 Scaffold',
    body:  'A protein that holds receptors and other molecules in place at the synapse. It helps ' +
           'organize the structure and controls how receptors are added or removed.',
  },
  camkii: {
    tag:  'Postsynaptic',
    title: 'CaMKII',
    body:  'An enzyme activated by Ca²⁺ from NMDA receptors. It adds more AMPA receptors to the ' +
           'membrane and makes them work better, strengthening the synapse (LTP).',
  },
  terminal: {
    tag:  'Presynaptic',
    title: 'Axon Terminal',
    body:  'The bulb at the end of the axon where glutamate is stored in vesicles. Vesicles are ' +
           'docked and ready to fuse when Ca²⁺ enters.',
  },
  dendrite: {
    tag:  'Postsynaptic',
    title: 'Dendrite Shaft',
    body:  'The main branch of the dendrite. It collects signals from all the spines and sends ' +
           'them toward the cell body.',
  },
};


// ── Step popup descriptions ───────────────────────────────────
const STEP_POPUPS = [
  {
    tag:   'Step 1; Docked',
    title: 'Vesicles Docked & Primed (SNARE Complex)',
    body:  'Vesicles are already docked and primed at the presynaptic membrane before an action ' +
           'potential arrives. SNARE proteins (v-SNARE on vesicle, t-SNARE on membrane) mediate ' +
           'docking and priming, preparing vesicles to fuse quickly when Ca²⁺ rises.',
  },
  {
    tag:   'Step 2; AP',
    title: 'Action Potential Arrives',
    body:  'The electrical signal travels down the axon and reaches the terminal. The depolarization ' +
           'of the presynaptic terminal triggers the next step.',
  },
  {
    tag:   'Step 3; VGCCs',
    title: 'Voltage-Gated Ca²⁺ Channels Open',
    body:  'The voltage change opens voltage-gated Ca²⁺ channels (VGCCs). Ca²⁺ floods in due to ' +
           'the depolarization—there is much more Ca²⁺ outside than inside.',
  },
  {
    tag:   'Step 4; Fusion',
    title: 'Ca²⁺ Triggers Fusion; Glutamate Released',
    body:  'Ca²⁺ binds synaptotagmin, which triggers the SNARE complex to pull vesicle and membrane ' +
           'together → vesicle fusion. Glutamate is released into the cleft.',
  },
  {
    tag:   'Step 5; Binding',
    title: 'Glutamate Crosses Cleft; Binds to AMPA',
    body:  'Glutamate diffuses across the narrow cleft (10–20 nm) in under half a millisecond. ' +
           'It binds to AMPA receptors on the postsynaptic membrane and stays there—' +
           'it does not pass through the cell.',
  },
  {
    tag:   'Step 6; AMPA',
    title: 'AMPA Receptors Open; Na⁺ Flows In',
    body:  'Glutamate unbinds (disappears) as AMPA receptors open. Na⁺ flows in, depolarizing the ' +
           'cell within 1–2 ms. This is the fast excitatory signal (EPSP).',
  },
  {
    tag:   'Step 7; NMDA',
    title: 'NMDA Unblocks; Ca²⁺ Enters',
    body:  'NMDA receptors are blocked by Mg²⁺ at rest. The depolarization from AMPA pushes ' +
           'Mg²⁺ out, so Ca²⁺ (and Na⁺) can now flow in. This Ca²⁺ signal drives plasticity.',
  },
  {
    tag:   'Step 8; LTP',
    title: 'CaMKII Strengthens the Synapse',
    body:  'Ca²⁺ from NMDA activates CaMKII. CaMKII adds more AMPA receptors to the membrane and ' +
           'makes them more responsive. The synapse is potentiated long-term; this is LTP.',
  },
];


// ── Vesicle initial positions ─────────────────────────────────
// 5 per terminal: top 3, then 1 between each slightly lower; first 3 docked
const VPOS_REL = [
  [-72,  TERM_R * .04], [  0,  TERM_R * .04], [ 72,  TERM_R * .04],  // top row; docked
  [-36,  TERM_R * .20], [ 36,  TERM_R * .20],                        // between each, slightly down
];

// Fusion targets: L-shaped; left up+right, center stays, right up+left
const FUSE_TARGETS = [
  { dx: -72, dy: -48 },   // left: up and to the right
  { dx:   0, dy:  -8 },   // center
  { dx:  72, dy: -48 },   // right: up and to the left
];

/**
 * Build the vesicle array for both columns.
 * First 3 per column: start docked and primed at the membrane (SNARE complex).
 * Vesicles are already at the fusion site before the action potential arrives.
 */
function buildVesicles() {
  const vesicles = [];
  for (let col = 0; col < 2; col++) {
    const cx = COLS[col].cx;
    for (let i = 0; i < VPOS_REL.length; i++) {
      const ox = cx + VPOS_REL[i][0];
      const oy = PRE_TOP + VPOS_REL[i][1];
      const docked = i < 3;
      const fuseIdx = ox < cx - 15 ? 0 : (ox > cx + 15 ? 2 : 1);
      const t = FUSE_TARGETS[fuseIdx];
      const tx = cx + t.dx;
      const ty = PRE_BOT + t.dy;
      vesicles.push({
        id:          col * VPOS_REL.length + i,
        col,
        cx:          docked ? tx : ox,
        cy:          docked ? ty : oy,
        origCx:      ox,
        origCy:      oy,
        r:           12,
        docked,
        released:    false,
        fusing:      false,
        stuckAtMembrane: docked,
        fuseProgress: 0,
      });
    }
  }
  return vesicles;
}
