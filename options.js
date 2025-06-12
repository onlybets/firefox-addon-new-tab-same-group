/* === Helpers ================================================== */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* === Elements ================================================= */
const enableGroupTab   = $('#enableGroupTab');
const placementCard    = $('#placementCard');
const placementRadios  = $$('input[name="placement"]');

const enableStdShort   = $('#enableStandardShortcut');
const enableDelay      = $('#enableDelay');

/* === Load prefs ============================================== */
chrome.storage.sync.get(
  { enableGroupTab:true, placementMode:'after',
    enableStandardTabShortcut:true, enableDelayGrouping:false },
  p => {
    enableGroupTab.checked  = p.enableGroupTab;
    togglePlacement(p.enableGroupTab);
    placementRadios.forEach(r => r.checked = (r.value === p.placementMode));
    enableStdShort.checked  = p.enableStandardTabShortcut;
    enableDelay.checked     = p.enableDelayGrouping;
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
enableStdShort.addEventListener('change', () =>
  chrome.storage.sync.set({ enableStandardTabShortcut: enableStdShort.checked })
);
enableDelay.addEventListener('change', () =>
  chrome.storage.sync.set({ enableDelayGrouping: enableDelay.checked })
);

/* === Shortcut settings links ================================= */
$$('.editShortcut').forEach(link =>
  link.addEventListener('click', e => {
    e.preventDefault();
    if (chrome.commands?.openShortcutSettings) chrome.commands.openShortcutSettings();
    else chrome.tabs.create({ url: 'about:addons' });
  })
);

/* === UI helper =============================================== */
function togglePlacement(state){
  placementCard.classList.toggle('disabled', !state);
  placementRadios.forEach(r => r.disabled = !state);
}
