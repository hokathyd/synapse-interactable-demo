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
const TERM_R    = 120;           // radius of each terminal semicircle
const PRE_BOT   = PRE_TOP + TERM_R;  // = 300; bottom of terminals / top of cleft

const CLEFT_T   = PRE_BOT;       // top of synaptic cleft
const CLEFT_H   = 44;            // height of cleft band
const POST_T    = CLEFT_T + CLEFT_H; // = 344; top of dendritic spines

// Spine height: stretch to leave room for CaMKII + fill canvas
const POST_BOT  = POST_T + 230;  // = 574; bottom of spine boxes / top of dendrite shaft
const SHAFT_H   = 106;           // dendrite shaft occupies the remaining canvas height

// Horizontal columns (only 2, shifted right to avoid label overlap)
const COLS = [{ cx: 270 }, { cx: 570 }];

// Terminal and spine box share the same width
const BOX_W       = TERM_R * 2;   // = 240
const BOX_SPINE_W = BOX_W;

// AMPA receptor x-offsets relative to each column centre
// Spread wide enough that they don't touch NMDA (which sits at -20)
const AMPA_DX = [-85, 45];  // two AMPA receptors, well separated from NMDA

// NMDA receptor x-offset; centred between the two AMPA receptors
const NMDA_DX = [-20];      // sits between -85 and +45

// CaMKII positions (y) inside each spine, two per spine
const CAMKII_DY = [POST_T + 140, POST_T + 168];


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
    tag:   'Step 1; AP',
    title: 'Action Potential Arrives',
    body:  'The electrical signal travels down the axon and reaches the terminal. This change in ' +
           'membrane voltage is the trigger for everything that follows.',
  },
  {
    tag:   'Step 2; VGCCs',
    title: 'Ca²⁺ Channels Open',
    body:  'The voltage change opens Ca²⁺ channels. They stay open for only ~1 ms, but Ca²⁺ flows ' +
           'in quickly because there is much more outside than inside the cell',
  },
  {
    tag:   'Step 3; Ca²⁺',
    title: 'Ca²⁺ Triggers Vesicle Fusion',
    body:  'Ca²⁺ binds to proteins on the docked vesicles. This causes the vesicle and cell ' +
           'membrane to merge together',
  },
  {
    tag:   'Step 4; Fusion',
    title: 'Vesicle Fuses; Glutamate Released',
    body:  'The vesicle fuses with the membrane and releases ~3,000 glutamate molecules into ' +
           'the cleft. This happens in under 1 ms',
  },
  {
    tag:   'Step 5; Diffusion',
    title: 'Glutamate Crosses the Cleft',
    body:  'The cleft is very narrow (10-20 nm), so glutamate reaches the receptors in under ' +
           'half a millisecond. Other cells then clear it away',
  },
  {
    tag:   'Step 6; AMPA',
    title: 'AMPA Receptors Open',
    body:  'Glutamate binds to AMPA receptors and opens them. Na⁺ flows in, depolarizing the ' +
           'cell within 1-2 ms. This is the fast excitatory signal.',
  },
  {
    tag:   'Step 7; NMDA',
    title: 'NMDA Unblocks; Ca²⁺ Enters',
    body:  'NMDA receptors are blocked by Mg²⁺ at rest. The depolarization from AMPA pushes ' +
           'Mg²⁺ out, so Ca²⁺ (and Na⁺) can now flow in. This Ca²⁺ signal drives plasticity',
  },
  {
    tag:   'Step 8; LTP',
    title: 'CaMKII Strengthens the Synapse',
    body:  'Ca²⁺ from NMDA activates CaMKII. CaMKII adds more AMPA receptors to the membrane and ' +
           'makes them more responsive. The synapse is potentiated long-term; this is LTP.',
  },
];


// ── Vesicle initial positions ─────────────────────────────────
// Relative to each column centre, expressed as [dx, dy from PRE_TOP]
const VPOS_REL = [
  [-TERM_R * .35,  TERM_R * .15],
  [ TERM_R * .35,  TERM_R * .15],
  [ 0,             TERM_R * .28],
  [-TERM_R * .55,  TERM_R * .35],
  [ TERM_R * .55,  TERM_R * .35],
];

/**
 * Build the vesicle array for both columns.
 * Each vesicle tracks its animated position, original position,
 * fusion state, and which column it belongs to.
 */
function buildVesicles() {
  const vesicles = [];
  for (let col = 0; col < 2; col++) {
    const cx = COLS[col].cx;
    for (let i = 0; i < VPOS_REL.length; i++) {
      const ox = cx + VPOS_REL[i][0];
      const oy = PRE_TOP + VPOS_REL[i][1];
      vesicles.push({
        id:          col * 5 + i,
        col,
        cx:          ox,   // current (animated) x
        cy:          oy,   // current (animated) y
        origCx:      ox,   // reset target
        origCy:      oy,
        r:           16,   // radius in px
        docked:      i >= 2, // only docked vesicles fuse
        released:    false,
        fusing:      false,
        fuseProgress: 0,   // 0..1 animation progress
      });
    }
  }
  return vesicles;
}
