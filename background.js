// ──────────────────────────────────────────────────────────────
// New Tab Same Group  •  v1.7.0   (21 Oct 2025)
//   – Snapshot + history-fallback algorithm (bullet-proof)
//   – Automatic tab grouping without shortcuts
// ──────────────────────────────────────────────────────────────

/* === Preferences ============================================ */
let enabled = true;
let placement = 'after';     // after | first | last

browser.storage.sync.get(
  { enableGroupTab:true, placementMode:'after' },
  p => { enabled=p.enableGroupTab; placement=p.placementMode; }
);
browser.storage.onChanged.addListener(ch=>{
  if(ch.enableGroupTab) enabled   = ch.enableGroupTab.newValue;
  if(ch.placementMode)  placement = ch.placementMode.newValue;
});



/* === Track active & previous (history) ====================== */
let lastActiveTab=null;                     // snapshot via refresh
const activeHist=new Map();                // windowId → [current, previous]

refreshSnapshot();
setInterval(refreshSnapshot,5000);

function refreshSnapshot(){
  browser.tabs.query({active:true, lastFocusedWindow:true})
    .then(t=>{ if(t[0]) lastActiveTab=t[0]; })
    .catch(()=>{});
}
browser.tabs.onActivated.addListener(({tabId, windowId})=>{
  browser.tabs.get(tabId).then(tab=>{
    const arr=activeHist.get(windowId)||[];
    if(arr[0] && arr[0].id!==tab.id) arr.unshift(tab); else arr[0]=tab;
    activeHist.set(windowId, arr.slice(0,2));
    lastActiveTab=tab;
  }).catch(()=>{});
});
browser.windows.onFocusChanged.addListener(refreshSnapshot);



/* === Main onCreated handler ================================ */
browser.tabs.onCreated.addListener(async newTab=>{
  if(!enabled) return;

  // 1) snapshot source
  let source=lastActiveTab;

  // 2) fallback if snapshot is self or missing
  if(newTab.active && source && source.id===newTab.id) source=null;
  if(!source){
    const hist=(activeHist.get(newTab.windowId)||[]);
    source = newTab.active ? hist[1] : hist[0];
  }
  if(!source) return;   // still nothing → abort

  // 3) group immediately
  groupTab(newTab, source);
});



/* === Group helper =========================================== */
async function groupTab(newTab, src){
  try{
    if(!src || src.groupId===-1 || newTab.windowId!==src.windowId) return;

    await browser.tabs.group({groupId:src.groupId, tabIds:[newTab.id]});

    let idx=src.index+1, move=placement!=='last';

    if(placement==='first'){
      const g=await browser.tabs.query({groupId:src.groupId, windowId:src.windowId});
      const others=g.filter(t=>t.id!==newTab.id).map(t=>t.index);
      idx=others.length?Math.min(...others):0;
    }else if(placement==='last'){ move=false; }

    if(move){
      const all=await browser.tabs.query({windowId:newTab.windowId});
      idx=Math.max(0,Math.min(idx,all.length));
      await browser.tabs.move(newTab.id,{index:idx});
    }
  }catch(e){ console.warn('Grouping error',e.message); }
}

/* === Install/update log ===================================== */
browser.runtime.onInstalled.addListener(({reason})=>
  console.log('New Tab Same Group updated:', reason)
);
