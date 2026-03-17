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
const PRE_BOT   = PRE_TOP + TERM_R;  // = 300 — bottom of terminals / top of cleft

const CLEFT_T   = PRE_BOT;       // top of synaptic cleft
const CLEFT_H   = 44;            // height of cleft band
const POST_T    = CLEFT_T + CLEFT_H; // = 344 — top of dendritic spines

// Spine height: stretch to leave room for CaMKII + fill canvas
const POST_BOT  = POST_T + 230;  // = 574 — bottom of spine boxes / top of dendrite shaft
const SHAFT_H   = 106;           // dendrite shaft occupies the remaining canvas height

// Horizontal columns (only 2, shifted right to avoid label overlap)
const COLS = [{ cx: 270 }, { cx: 570 }];

// Terminal and spine box share the same width
const BOX_W       = TERM_R * 2;   // = 240
const BOX_SPINE_W = BOX_W;

// AMPA receptor x-offsets relative to each column centre
// Spread wide enough that they don't touch NMDA (which sits at -20)
const AMPA_DX = [-85, 45];  // two AMPA receptors, well separated from NMDA

// NMDA receptor x-offset — centred between the two AMPA receptors
const NMDA_DX = [-20];      // sits between -85 and +45

// CaMKII positions (y) inside each spine, two per spine
const CAMKII_DY = [POST_T + 140, POST_T + 168];


// ── Part descriptions (hover/click info panel) ────────────────
const PARTS = {
  vesicle: {
    tag:  'Presynaptic',
    title: 'Synaptic Vesicle (~40 nm)',
    body:  'Tiny lipid membrane bubble packed with ~3,000 glutamate molecules (1,000–5,000 typical). ' +
           'Ca²⁺ binds synaptotagmin on docked vesicles; this forces SNARE proteins (syntaxin, ' +
           'SNAP-25, synaptobrevin) to zipper, pulling the vesicle and plasma membranes together for fusion.',
  },
  vgcc: {
    tag:  'Presynaptic',
    title: 'Voltage-Gated Ca²⁺ Channel (VGCC)',
    body:  'Protein channel (mainly P/Q-type Cav2.1 or N-type Cav2.2) normally closed at rest. ' +
           'Depolarization opens VGCCs for ~1 ms; Ca²⁺ rushes in down its huge concentration ' +
           'gradient — the direct trigger for vesicle fusion and glutamate release.',
  },
  axon: {
    tag:  'Presynaptic',
    title: 'Axon (myelinated)',
    body:  'Carries action potentials from the cell body DOWN to the presynaptic terminal. ' +
           'The electrical signal (Na⁺ influx, K⁺ efflux) propagates along the axon and ' +
           'depolarizes the terminal membrane — triggering VGCC opening.',
  },
  cleft: {
    tag:  'Synaptic Cleft',
    title: 'Synaptic Cleft (~20 nm)',
    body:  'Narrow gap between pre- and postsynaptic membranes. Because the cleft is only 10–20 nm ' +
           'wide, glutamate reaches receptors in ~0.2–0.5 ms by simple diffusion. EAAT transporters ' +
           'on astrocytes and neurons clear excess glutamate after transmission.',
  },
  ampa: {
    tag:  'Postsynaptic',
    title: 'AMPA Receptor',
    body:  'Ionotropic glutamate receptor. Glutamate binding opens the cation channel — mainly ' +
           'Na⁺ rushes in (some K⁺ out), producing a fast, large EPSC that depolarizes the ' +
           'postsynaptic membrane within 1–2 ms. Main driver of fast excitatory transmission.',
  },
  nmda: {
    tag:  'Postsynaptic',
    title: 'NMDA Receptor',
    body:  'The coincidence detector. Blocked by Mg²⁺ sitting in the pore at rest. AMPA-driven ' +
           'depolarization ejects Mg²⁺; with glutamate bound, the channel conducts Ca²⁺ (plus ' +
           'Na⁺). Main route for Ca²⁺ entry — the plasticity signal that activates CaMKII.',
  },
  spine: {
    tag:  'Postsynaptic',
    title: 'Dendritic Spine',
    body:  'Tiny protrusion on the dendrite hosting one synapse. Contains AMPA/NMDA receptors, ' +
           'PSD-95 scaffold, and CaMKII. Spine size correlates with synaptic strength and ' +
           'changes with LTP.',
  },
  psd95: {
    tag:  'Postsynaptic',
    title: 'PSD-95 Scaffold',
    body:  'Master anchor of the postsynaptic density. Holds AMPA/NMDA receptors in place via ' +
           'PDZ domains. Binds SAPAP, SHANK, Homer — organising the postsynaptic apparatus and ' +
           'gating receptor trafficking during plasticity.',
  },
  camkii: {
    tag:  'Postsynaptic',
    title: 'CaMKII',
    body:  'Ca²⁺/calmodulin-dependent kinase II. Activated by Ca²⁺ from NMDA receptors. ' +
           'Autophosphorylates at Thr286 → stays active after Ca²⁺ drops. ' +
           'Phosphorylates AMPARs → increased conductance + insertion → LTP.',
  },
  terminal: {
    tag:  'Presynaptic',
    title: 'Axon Terminal (Bouton)',
    body:  'The presynaptic terminal is the bulbous end of the axon where neurotransmitter is ' +
           'stored and released. Vesicles are docked near the active zone, ready for rapid ' +
           'fusion when Ca²⁺ enters through VGCCs.',
  },
  dendrite: {
    tag:  'Postsynaptic',
    title: 'Dendrite Shaft',
    body:  'The main postsynaptic process. Signals from all spines summate here and travel ' +
           'toward the postsynaptic cell body. Multiple spines on one dendrite receive inputs ' +
           'from many different presynaptic neurons.',
  },
};


// ── Step popup descriptions ───────────────────────────────────
const STEP_POPUPS = [
  {
    tag:   'Step 1 — AP',
    title: 'Action Potential Travels Down the Axon to the Presynaptic Terminal',
    body:  'The electrical signal (a wave of Na⁺ influx followed by K⁺ efflux) propagates along ' +
           'the axon and depolarizes the terminal membrane from ~−70 mV to positive values. ' +
           'This is the trigger that starts everything.',
  },
  {
    tag:   'Step 2 — VGCCs',
    title: 'VGCCs Open — Voltage-Gated Ca²⁺ Channels',
    body:  'Depolarization activates presynaptic Ca²⁺ channels (mainly P/Q-type Cav2.1 or N-type ' +
           'Cav2.2). They open for only ~1 ms but let Ca²⁺ rush in down its huge concentration ' +
           'gradient (~10,000-fold higher outside).',
  },
  {
    tag:   'Step 3 — Ca²⁺',
    title: 'Ca²⁺ Floods In — Triggers Vesicle Fusion',
    body:  'The local Ca²⁺ concentration near the channels jumps to ~10–100 µM. Ca²⁺ binds the ' +
           'sensor protein synaptotagmin on docked vesicles; this conformational change forces ' +
           'the SNARE proteins (syntaxin, SNAP-25, synaptobrevin) to fully zipper, pulling the ' +
           'vesicle and plasma membranes together for fusion.',
  },
  {
    tag:   'Step 4 — Fusion',
    title: 'Vesicle Fusion — Releases ~3,000 Glutamate Molecules into the Cleft',
    body:  'Exocytosis occurs in <1 ms. One synaptic vesicle typically contains 1,000–5,000 ' +
           'glutamate molecules; ~3,000 is a commonly cited average. This "quantal" release ' +
           'creates a brief, high-concentration pulse (~1–3 mM) in the cleft.',
  },
  {
    tag:   'Step 5 — Diffusion',
    title: 'Glutamate Diffuses Across the ~20 nm Synaptic Cleft',
    body:  'Because the cleft is only 10–20 nm wide, glutamate reaches the postsynaptic receptors ' +
           'in ~0.2–0.5 ms by simple diffusion. The narrow gap ensures fast, precise signaling ' +
           'before glutamate is cleared by transporters (EAATs) on astrocytes and neurons.',
  },
  {
    tag:   'Step 6 — AMPA',
    title: 'AMPA Receptors Open — Na⁺ Flows In → Fast EPSC',
    body:  'Glutamate binds AMPA receptors, opening their cation channel. Mainly Na⁺ rushes in ' +
           '(some K⁺ out), producing a fast, large excitatory postsynaptic current (EPSC) that ' +
           'depolarizes the postsynaptic membrane within 1–2 ms. This is the main driver of fast ' +
           'excitatory transmission.',
  },
  {
    tag:   'Step 7 — NMDA',
    title: 'NMDA Unblocks — Mg²⁺ Ejected; Ca²⁺ Enters Postsynaptic Cell',
    body:  'Glutamate also binds NMDA receptors at the same time. At resting potential they are ' +
           'blocked by Mg²⁺ sitting in the pore. The depolarization from step 6 (AMPA) pushes ' +
           'the Mg²⁺ out, allowing the channel to conduct Ca²⁺ (plus Na⁺). NMDA current is ' +
           'slower and longer-lasting, and it is the main route for Ca²⁺ entry into the ' +
           'postsynaptic neuron.',
  },
  {
    tag:   'Step 8 — LTP',
    title: 'CaMKII Activates — Ca²⁺ via NMDA → LTP',
    body:  'The Ca²⁺ influx through NMDA binds calmodulin, which activates CaMKII. CaMKII ' +
           'autophosphorylates (stays active for minutes to hours) and phosphorylates AMPA ' +
           'receptors while also triggering insertion of new AMPA receptors into the membrane ' +
           'and spine enlargement. This strengthens the synapse long-term — the cellular basis ' +
           'of LTP (long-term potentiation) and a key mechanism of learning and memory.',
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
