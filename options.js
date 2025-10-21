/* === Helpers ================================================== */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* === Elements ================================================= */
const enableGroupTab = $('#enableGroupTab');
const placementCard = $('#placementCard');
const placementRadios = $$('input[name="placement"]');

/* === Load prefs ============================================== */
chrome.storage.sync.get(
  { enableGroupTab: true, placementMode: 'after' },
  p => {
    enableGroupTab.checked = p.enableGroupTab;
    togglePlacement(p.enableGroupTab);
    placementRadios.forEach(r => r.checked = (r.value === p.placementMode));
  }
);

/* === Save handlers =========================================== */
enableGroupTab.addEventListener('change', () => {
  chrome.storage.sync.set({ enableGroupTab: enableGroupTab.checked });
  togglePlacement(enableGroupTab.checked);
});
placementRadios.forEach(r =>
  r.addEventListener('change', () => {
    if (r.checked) chrome.storage.sync.set({ placementMode: r.value });
  })
);

/* === UI helper =============================================== */
function togglePlacement(state) {
  placementCard.classList.toggle('disabled', !state);
  placementRadios.forEach(r => r.disabled = !state);
}