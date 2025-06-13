// ──────────────────────────────────────────────────────────────
// New Tab Same Group  •  v1.6.3   (13 Jun 2025)
//   – One unified logic using previousActiveTab / currentActiveTab
//     so the 1-second delay works reliably.
//   – Default cancel shortcut Ctrl+G / ⌘+G, active only during
//     that second, then released to the OS.
// ──────────────────────────────────────────────────────────────

/* === Preferences ============================================ */
let enabled = true;
let placement = 'after';             // after | first | last
let enableDelay = false;             // 1-second window
const DELAY_MS = 1000;

browser.storage.sync.get(
  { enableGroupTab:true, placementMode:'after', enableDelayGrouping:false },
  p => { enabled=p.enableGroupTab; placement=p.placementMode; enableDelay=p.enableDelayGrouping; }
);
browser.storage.onChanged.addListener(ch => {
  if (ch.enableGroupTab)      enabled     = ch.enableGroupTab.newValue;
  if (ch.placementMode)       placement   = ch.placementMode.newValue;
  if (ch.enableDelayGrouping) enableDelay = ch.enableDelayGrouping.newValue;
});

/* === Dynamic shortcut (Ctrl/⌘+G) ============================ */
const CMD = 'cancel-pending-grouping';
let userSC='', activeSC='';

async function readUserSC(){
  const all = await browser.commands.getAll();
  userSC = (all.find(c=>c.name===CMD)?.shortcut)||'';
}
async function defSC(){
  const {os} = await browser.runtime.getPlatformInfo();
  return os==='mac' ? 'Command+G' : 'Ctrl+G';
}
async function enableSC(){
  if (!activeSC){
    if (!userSC) await readUserSC();
    const sc = userSC || await defSC();
    await browser.commands.update({ name:CMD, shortcut:sc });
    activeSC = sc;
  }
}
async function disableSC(){
  if (activeSC){
    await browser.commands.update({ name:CMD, shortcut:'' });
    activeSC='';
  }
}

/* === Track active & previous active tabs ==================== */
let currentActiveTab=null;
let previousActiveTab=null;

refreshActive();
setInterval(refreshActive, 5000);

function refreshActive(){
  browser.tabs.query({active:true, lastFocusedWindow:true})
    .then(t=>{ if(t[0]) currentActiveTab=t[0]; })
    .catch(()=>{});
}
function updateActive(tab){
  if(currentActiveTab && currentActiveTab.id!==tab.id)
    previousActiveTab=currentActiveTab;
  currentActiveTab=tab;
}
browser.windows.onFocusChanged.addListener(refreshActive);
browser.tabs.onActivated.addListener(({tabId}) =>
  browser.tabs.get(tabId).then(updateActive).catch(()=>{})
);

/* === Delayed grouping ======================================= */
const pending=new Map();             // tabId → timer
browser.commands.onCommand.addListener(cmd=>{ if(cmd===CMD) cancelAll(); });

function cancelAll(){
  for(const t of pending.values()) clearTimeout(t);
  pending.clear();
  disableSC();
}

browser.tabs.onCreated.addListener(async newTab=>{
  if(!enabled) return;

  // Détermine le bon onglet source
  let sourceTab = newTab.active ? previousActiveTab : currentActiveTab;
  if(!sourceTab) return;

  if(enableDelay){
    await enableSC();
    const timer=setTimeout(()=>{
      pending.delete(newTab.id);
      if(!pending.size) disableSC();
      groupTab(newTab, sourceTab);
    }, DELAY_MS);
    pending.set(newTab.id, timer);
  }else{
    groupTab(newTab, sourceTab);
  }
});

browser.tabs.onRemoved.addListener(id=>{
  if(pending.has(id)){
    clearTimeout(pending.get(id));
    pending.delete(id);
    if(!pending.size) disableSC();
  }
});

/* === Group helper =========================================== */
async function groupTab(newTab, src){
  try{
    if(!src || src.groupId===-1 || newTab.windowId!==src.windowId) return;

    await browser.tabs.group({ groupId:src.groupId, tabIds:[newTab.id] });

    let target=src.index+1, move=placement!=='last';

    if(placement==='first'){
      const g=await browser.tabs.query({groupId:src.groupId, windowId:src.windowId});
      const others=g.filter(t=>t.id!==newTab.id).map(t=>t.index);
      target=others.length?Math.min(...others):0;
    }else if(placement==='last'){ move=false; }

    if(move){
      const all=await browser.tabs.query({windowId:newTab.windowId});
      target=Math.max(0,Math.min(target,all.length));
      await browser.tabs.move(newTab.id,{index:target});
    }
  }catch(e){ console.warn('Grouping error',e.message); }
}

/* === Log install/update ===================================== */
browser.runtime.onInstalled.addListener(({reason})=>
  console.log('New Tab Same Group updated:', reason)
);
