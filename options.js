const enableCB      = document.getElementById('enable');
const placementCard = document.getElementById('placementCard');
const radios        = document.querySelectorAll('input[name="placement"]');

// Load prefs
chrome.storage.sync.get(
  { enableGroupTab: true, placementMode: 'after' },
  res => {
    enableCB.checked = res.enableGroupTab;
    radios.forEach(r => r.checked = r.value === res.placementMode);
    togglePlacementCard(res.enableGroupTab);
  }
);

// Master toggle
enableCB.addEventListener('change', () => {
  chrome.storage.sync.set({ enableGroupTab: enableCB.checked });
  togglePlacementCard(enableCB.checked);
});

// Placement radios
radios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      chrome.storage.sync.set({ placementMode: radio.value });
    }
  });
});

function togglePlacementCard(isEnabled) {
  placementCard.classList.toggle('disabled', !isEnabled);
  radios.forEach(r => r.disabled = !isEnabled);
}