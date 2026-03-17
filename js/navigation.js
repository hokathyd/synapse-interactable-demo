/* ═══════════════════════════════════════════════════
   js/navigation.js
   Handles switching between the Overview (intro) page
   and the Interactive Synapse page, with a zoom overlay
   transition between them.
═══════════════════════════════════════════════════ */

/**
 * Navigate from Overview → Synapse page.
 * Shows a dark overlay with text, then swaps pages and boots the synapse diagram.
 */
function goSynapse() {
  const ov = document.getElementById('zoom-overlay');
  ov.classList.add('show');

  // After overlay fades in, swap pages and initialise the synapse diagram
  setTimeout(() => {
    document.getElementById('page-intro').classList.remove('active');
    document.getElementById('page-synapse').classList.add('active');
    startSynapse(); // defined in synapse-ui.js
  }, 1100);

  // Fade the overlay back out
  setTimeout(() => ov.classList.remove('show'), 1500);
}

/**
 * Navigate from Synapse page → Overview page.
 */
function goIntro() {
  document.getElementById('page-synapse').classList.remove('active');
  document.getElementById('page-intro').classList.add('active');
}

/**
 * Close the step-detail popup below the synapse canvas.
 */
function closePopup() {
  document.getElementById('step-popup').classList.remove('show');
}
