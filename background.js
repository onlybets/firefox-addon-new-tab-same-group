// ──────────────────────────────────────────────────────────────
// New Tab Same Group  •  v1.6.1   (12 Jun 2025)
//   – 1-second delayed grouping with dynamic shortcut
//   – Ctrl+Space (Win/Linux) or ⌘ Space (macOS) enabled only
//     during that second, then released to the OS.
//   – lastActiveTab refreshed every 5 s for reliability.
//   – Thanks to Firefox user 17957929 for the insights.
// ──────────────────────────────────────────────────────────────

/* === Preferences (storage) =================================== */
let enabled      = true;
let placement    = 'after';       // after | first | last
let enableDelay  = false;
const DELAY_MS   = 1000;

chrome.storage.sync.get(
  { enableGroupTab:true, placementMode:'after', enableDelayGrouping:false },
  p => { enabled = p.enableGroupTab; placement = p.placementMode; enableDelay = p.enableDelayGrouping; }
);
chrome.storage.onChanged.addListener(ch => {
  if (ch.enableGroupTab)   enabled   = ch.enableGroupTab.newValue;
  if (ch.placementMode)    placement = ch.placementMode.newValue;
  if (ch.enableDelayGrouping) enableDelay = ch.enableDelayGrouping.newValue;
});

/* === Dynamic shortcut (Ctrl/⌘ Space) ========================= */
const CMD_NAME = 'cancel-pending-grouping';
let   userShortcut   = '';   // user-defined in about:addons
let   activeShortcut = '';   // currently set via commands.update()

async function readUserShortcut() {
  const all = await browser.commands.getAll();
  const cmd = all.find(c => c.name === CMD_NAME);
  userShortcut = cmd && cmd.shortcut ? cmd.shortcut : '';
}
async function defaultShortcut() {
  const info = await browser.runtime.getPlatformInfo();
  return info.os === 'mac' ? 'Command+Space' : 'Ctrl+Space';
}
async function enableShortcut() {
  if (!activeShortcut) {
    if (!userShortcut) await readUserShortcut();
    const sc = userShortcut || await defaultShortcut();
    await browser.commands.update({ name: CMD_NAME, shortcut: sc });
    activeShortcut = sc;
  }
}
async function disableShortcut() {
  if (activeShortcut) {
    await browser.commands.update({ name: CMD_NAME, shortcut: '' });
    activeShortcut = '';
  }
}

/* === lastActiveTab tracking (refresh every 5 s) =============== */
let lastActiveTab = null;
refreshLastActiveTab();
setInterval(refreshLastActiveTab, 5000);

function refreshLastActiveTab() {
  browser.tabs.query({ active:true, lastFocusedWindow:true })
    .then(t => { if (t[0]) lastActiveTab = t[0]; })
    .catch(() => {});
}
browser.windows.onFocusChanged.addListener(refreshLastActiveTab);
browser.tabs.onActivated.addListener(({ tabId }) =>
  browser.tabs.get(tabId).then(t => { lastActiveTab = t; }).catch(() => {})
);

/* === Delayed grouping logic =================================== */
const pending = new Map();   // tabId → timerID
browser.commands.onCommand.addListener(cmd => { if (cmd === CMD_NAME) cancelPending(); });

function cancelPending() {
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
  disableShortcut();
}

browser.tabs.onCreated.addListener(async newTab => {
  if (!enabled || !lastActiveTab) return;

  if (enableDelay) {
    await enableShortcut();
    const timer = setTimeout(() => {
      pending.delete(newTab.id);
      if (!pending.size) disableShortcut();
      groupTabNow(newTab);
    }, DELAY_MS);
    pending.set(newTab.id, timer);
  } else {
    groupTabNow(newTab);
  }
});

browser.tabs.onRemoved.addListener(id => {
  if (pending.has(id)) {
    clearTimeout(pending.get(id));
    pending.delete(id);
    if (!pending.size) disableShortcut();
  }
});

/* === Immediate grouping helper ================================ */
async function groupTabNow(newTab) {
  try {
    const src = lastActiveTab;
    if (!src || src.groupId === -1 || newTab.windowId !== src.windowId) return;

    await browser.tabs.group({ groupId: src.groupId, tabIds: [newTab.id] });

    let target = src.index + 1;
    let move   = placement !== 'last';

    if (placement === 'first') {
      const gTabs = await browser.tabs.query({ groupId: src.groupId, windowId: src.windowId });
      const others = gTabs.filter(t => t.id !== newTab.id).map(t => t.index);
      target = others.length ? Math.min(...others) : 0;
    } else if (placement === 'last') {
      move = false;
    }

    if (move) {
      const all = await browser.tabs.query({ windowId: newTab.windowId });
      target = Math.min(Math.max(target, 0), all.length);
      await browser.tabs.move(newTab.id, { index: target });
    }
  } catch (e) { console.warn('Grouping error:', e.message); }
}

/* === Install/update log ======================================= */
browser.runtime.onInstalled.addListener(({ reason }) =>
  console.log('New Tab Same Group installed/updated:', reason)
);
