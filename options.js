// UI Elements
const enableGroupTabCB = document.getElementById('enableGroupTab'); // Renamed for clarity
const placementCard = document.getElementById('placementCard');
const radios = document.querySelectorAll('input[name="placement"]');

const enableStandardShortcutCB = document.getElementById('enableStandardShortcut');
// No need to target standardShortcutCard for now, unless we want to disable it
// based on another option, which is not the case here.

// Load saved preferences
chrome.storage.sync.get(
  {
    enableGroupTab: true, // Main extension preference
    placementMode: 'after', // Placement mode for grouped tabs
    enableStandardTabShortcut: true // New preference for the standard shortcut
  },
  (prefs) => {
    // Apply the main preference
    enableGroupTabCB.checked = prefs.enableGroupTab;
    togglePlacementCardVisibility(prefs.enableGroupTab); // Manage visibility/state of the placement card

    // Apply placement mode
    radios.forEach(r => r.checked = (r.value === prefs.placementMode));

    // Apply standard shortcut preference
    enableStandardShortcutCB.checked = prefs.enableStandardTabShortcut;
  }
);

// Listener for main extension enable/disable
enableGroupTabCB.addEventListener('change', () => {
  const isEnabled = enableGroupTabCB.checked;
  chrome.storage.sync.set({ enableGroupTab: isEnabled });
  togglePlacementCardVisibility(isEnabled);
});

// Listeners for placement options
radios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) { // Ensure a radio button is actually checked
      chrome.storage.sync.set({ placementMode: radio.value });
    }
  });
});

// Listener for standard shortcut enable/disable
enableStandardShortcutCB.addEventListener('change', () => {
  chrome.storage.sync.set({ enableStandardTabShortcut: enableStandardShortcutCB.checked });
});

// Function to manage visibility and state of the placement card
function togglePlacementCardVisibility(isEnabled) {
  placementCard.classList.toggle('disabled', !isEnabled);
  radios.forEach(r => r.disabled = !isEnabled);
}
