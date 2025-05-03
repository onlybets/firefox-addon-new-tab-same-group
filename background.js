// ──────────────────────────
// New Tab Same Group • logic
// ──────────────────────────

// A — Preferences -------------------------------------------------
let enabled   = true;
let placement = 'after';           // 'after' | 'first' | 'last'

chrome.storage.sync.get(
  { enableGroupTab: true, placementMode: 'after' },
  (r) => {
    enabled   = r.enableGroupTab;
    placement = r.placementMode;
  }
);
chrome.storage.onChanged.addListener((ch) => {
  if (ch.enableGroupTab) enabled   = ch.enableGroupTab.newValue;
  if (ch.placementMode)  placement = ch.placementMode.newValue;
});

// B — Track the last active tab -----------------------------------
let lastActiveTab = null;
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { lastActiveTab = await chrome.tabs.get(tabId); }
  catch (e) { console.error('onActivated error:', e); }
});

// C — Handle new‑tab creation -------------------------------------
chrome.tabs.onCreated.addListener(async (newTab) => {
  if (!enabled || !lastActiveTab) return;

  // Freeze reference BEFORE any async wait
  const sourceTab = lastActiveTab;

  if (
    newTab.windowId !== sourceTab.windowId ||
    sourceTab.groupId === -1
  ) return;

  try {
    // 1) Add new tab to same group
    await chrome.tabs.group({ groupId: sourceTab.groupId, tabIds: [newTab.id] });

    // 2) Determine final position
    let targetIndex = sourceTab.index + 1; // default for 'after'
    let moveNeeded  = (placement !== 'last'); // in 'last', keep as‑is

    if (placement === 'first') {
      const groupTabs = await chrome.tabs.query({ groupId: sourceTab.groupId });
      targetIndex = Math.min(...groupTabs.map(t => t.index));
    } else if (placement === 'last') {
      // Already at end after grouping → no move
      moveNeeded = false;
    }

    // 3) Move if required
    if (moveNeeded) {
      await chrome.tabs.move(newTab.id, { index: targetIndex });
    }

    // 4) Snapshot for next iteration
    lastActiveTab = await chrome.tabs.get(newTab.id);

  } catch (err) {
    console.error('Grouping/moving error:', err);
  }
});

// D — Install log --------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  console.log('New Tab Same Group installed.');
});