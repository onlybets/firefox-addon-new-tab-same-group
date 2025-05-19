// ──────────────────────────
// New Tab Same Group • logic
// ──────────────────────────

// A — Preferences -------------------------------------------------
let enabled = true;
let placement = 'after'; // 'after' | 'first' | 'last'
let enableStandardTabShortcut = true; // New preference for the shortcut

// Global flag for the standard tab shortcut
let isStandardNewTabViaShortcut = false;

chrome.storage.sync.get(
  {
    enableGroupTab: true,
    placementMode: 'after',
    enableStandardTabShortcut: true // Default value for the new option
  },
  (r) => {
    enabled = r.enableGroupTab;
    placement = r.placementMode;
    enableStandardTabShortcut = r.enableStandardTabShortcut;
  }
);

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enableGroupTab) {
    enabled = changes.enableGroupTab.newValue;
  }
  if (changes.placementMode) {
    placement = changes.placementMode.newValue;
  }
  if (changes.enableStandardTabShortcut) {
    enableStandardTabShortcut = changes.enableStandardTabShortcut.newValue;
  }
});

// B — Track the last active tab -----------------------------------
let lastActiveTab = null;
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    lastActiveTab = await chrome.tabs.get(tabId);
  } catch (e) {
    // It's possible the tab is closed before get() resolves,
    // especially when closing multiple tabs quickly.
    if (e.message.includes('No tab with id') || e.message.includes('Invalid tab ID')) {
      console.log(`onActivated: Tab ${tabId} not found, likely closed.`);
      lastActiveTab = null; // Reset if the tab no longer exists
    } else {
      console.error('onActivated error:', e);
    }
  }
});

// C — Handle new‑tab creation -------------------------------------
chrome.tabs.onCreated.addListener(async (newTab) => {
  // If the tab was created via our special shortcut, ignore it and reset the flag.
  if (isStandardNewTabViaShortcut) {
    isStandardNewTabViaShortcut = false;
    console.log('New standard tab created via shortcut, ignoring for grouping.');
    // Update lastActiveTab if this new tab becomes active.
    // This will be handled by onActivated, but we can anticipate if it's the only tab or if it's active.
    if (newTab.active) {
        try {
            lastActiveTab = await chrome.tabs.get(newTab.id);
        } catch(e) { /* ignore */ }
    }
    return;
  }

  if (!enabled || !lastActiveTab) return;

  // Freeze reference BEFORE any async wait
  const sourceTab = lastActiveTab;

  // Check if sourceTab still exists (it could have been closed in the meantime)
  try {
    await chrome.tabs.get(sourceTab.id);
  } catch (e) {
    console.log(`sourceTab ${sourceTab.id} no longer exists, cannot group new tab ${newTab.id}.`);
    return;
  }

  if (
    newTab.windowId !== sourceTab.windowId ||
    sourceTab.groupId === -1 // Do nothing if the source tab is not in a group
  ) {
    return;
  }

  try {
    // 1) Add new tab to same group
    await chrome.tabs.group({ groupId: sourceTab.groupId, tabIds: [newTab.id] });

    // 2) Determine final position
    let targetIndex = sourceTab.index + 1; // default for 'after'
    let moveNeeded = placement !== 'last'; // in 'last', keep as‑is

    if (placement === 'first') {
      // To be the first in the group, find the index of the current first tab in the group.
      const groupTabs = await chrome.tabs.query({ groupId: sourceTab.groupId, windowId: sourceTab.windowId });
      if (groupTabs.length > 0) {
        // Filter out the newTab itself before finding the minimum index,
        // as its index might not be final yet or could be 0 temporarily.
        const otherGroupTabsIndexes = groupTabs.filter(t => t.id !== newTab.id).map(t => t.index);
        if (otherGroupTabsIndexes.length > 0) {
            targetIndex = Math.min(...otherGroupTabsIndexes);
        } else { // The new tab is the only one (or will be the first)
            targetIndex = 0; // Or sourceTab.index if we want it relative to source if it's the only one
        }
      } else { // The new tab is the only one in the group (shouldn't happen if sourceTab.groupId !== -1)
        targetIndex = 0;
      }
    } else if (placement === 'last') {
      // Assume adding to the group places it at the end.
      // If cases prove otherwise, it will need to be moved explicitly.
      moveNeeded = false;
    }


    // 3) Move if required
    if (moveNeeded) {
      // Ensure targetIndex is valid
      const allTabsInWindow = await chrome.tabs.query({ windowId: newTab.windowId });
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex > allTabsInWindow.length) targetIndex = allTabsInWindow.length; // index can be equal to length for "append"

      await chrome.tabs.move(newTab.id, { index: targetIndex });
    }

    // 4) Snapshot for next iteration
    // Update lastActiveTab only if the new tab is the one that became active.
    // Often, the new tab becomes active, but not always (e.g., opening in the background).
    // onActivated will handle updating lastActiveTab more reliably.
    // However, if the new tab IS active, we can update it here.
    const updatedNewTab = await chrome.tabs.get(newTab.id);
    if (updatedNewTab.active) {
        lastActiveTab = updatedNewTab;
    }

  } catch (err) {
    // Handle errors where the source tab or new tab no longer exists
    if (err.message.includes('No tab with id') || err.message.includes('Invalid tab ID') || err.message.includes('No group with id')) {
        console.log(`Error during grouping/moving tab ${newTab.id}, likely a tab or group was closed: ${err.message}`);
    } else {
        console.error('Grouping/moving error:', err);
    }
  }
});

// D — Handle commands (keyboard shortcuts) -----------------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-standard-new-tab") {
    if (enableStandardTabShortcut) {
      isStandardNewTabViaShortcut = true; // Set the flag BEFORE creating the tab
      try {
        await chrome.tabs.create({}); // Opens a standard new tab
      } catch (e) {
        console.error("Error creating standard new tab:", e);
        isStandardNewTabViaShortcut = false; // Reset the flag in case of an error
      }
    }
  }
});

// E — Install log --------------------------------------------------
chrome.runtime.onInstalled.addListener((details) => {
  console.log('New Tab Same Group installed/updated. Reason:', details.reason);
  if (details.reason === 'install') {
    // Maybe open the options page on first install
    // chrome.runtime.openOptionsPage();
  }
  // Initialize preferences if they don't exist (already handled by get with default values)
});
