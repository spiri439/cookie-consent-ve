(function(){
  const CC_COOKIE = 'ccve_prefs';
  const ANALYTICS_PATTERNS = [ /^_ga/, /^_gid$/, /^_gcl_au$/, /^__utm/ , /^_uet/ ];
  const MARKETING_PATTERNS = [ /^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom-session$/, /^tawk_?uuid$/, /^datadog/ ];
  function readPrefs(){
    const m = document.cookie.match(/(?:^|; )ccve_prefs=([^;]*)/);
    return m ? JSON.parse(decodeURIComponent(m[1])) : null;
  }
  function writePrefs(prefs){
    const v = encodeURIComponent(JSON.stringify(prefs));
    document.cookie = `ccve_prefs=${v}; Path=/; SameSite=Lax; Max-Age=31536000`;
    enforcePrefs(prefs);
  }
  function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function getAllCookieNames(){
    if (!document.cookie) return [];
    return document.cookie.split('; ').map(x=>x.split('=')[0]);
  }
  function deleteCookie(name){
    // Best effort delete at root path
    document.cookie = `${name}=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  function deleteCookieAllVariants(name){
    const host = location.hostname;
    const apex = host.startsWith('www.') ? host.slice(4) : host;
    const domains = [undefined, host, '.'+host, apex!==host? apex: undefined, apex!==host? '.'+apex: undefined].filter(Boolean);
    const paths = ['/', undefined];
    for(const d of domains){
      for(const p of paths){
        const domainAttr = d? `; Domain=${d}` : '';
        const pathAttr = p? `; Path=${p}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${pathAttr}${domainAttr}`;
      }
    }
  }
  function eraseByPatterns(patterns){
    const names = getAllCookieNames();
    for(const n of names){
      if(patterns.some(rx=>rx.test(n))){ deleteCookie(n); deleteCookieAllVariants(n); }
    }
  }
  function enforcePrefs(prefs){
    if(!prefs) return;
    const accepted = new Set(prefs.accepted||[]);
    // If analytics not accepted, purge analytics-like cookies
    if(!accepted.has('analytics')) eraseByPatterns(ANALYTICS_PATTERNS);
    // If marketing not accepted, purge marketing-like cookies
    if(!accepted.has('marketing')) eraseByPatterns(MARKETING_PATTERNS);
  }
  function installCookieGuard(){
    const d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
    if(!d || !d.set || !d.get) return;
    const nativeSet = d.set.bind(document);
    const nativeGet = d.get.bind(document);
    try {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get(){ return nativeGet(); },
        set(value){
          // value looks like "name=val; attr..." -> extract name
          const name = String(value).split('=')[0];
          const prefs = readPrefs();
          const accepted = new Set((prefs&&prefs.accepted)||[]);
          const blockedAnalytics = !accepted.has('analytics') && ANALYTICS_PATTERNS.some(rx=>rx.test(name));
          const blockedMarketing = !accepted.has('marketing') && MARKETING_PATTERNS.some(rx=>rx.test(name));
          if(blockedAnalytics || blockedMarketing){
            // Block write silently
            return;
          }
          nativeSet(value);
        }
      });
    } catch(e) {
      // ignore guard if cannot install
    }
  }
  function showBanner(){
    if(readPrefs()) return;
    const wrap = el('div','ccve-banner');
    wrap.innerHTML = '<div class="ccve-text">We use cookies. Configure preferences or accept all.</div>';
    const actions = el('div','ccve-actions');
    const btnAccept = el('button','ccve-btn ccve-accept'); btnAccept.textContent='Accept all';
    const btnReject = el('button','ccve-btn ccve-reject'); btnReject.textContent='Reject all';
    const btnPrefs = el('button','ccve-btn ccve-prefs'); btnPrefs.textContent='Preferences';
    actions.append(btnReject, btnPrefs, btnAccept); wrap.append(actions); document.body.append(wrap);
    btnAccept.onclick = ()=>{ writePrefs({accepted:['necessary','analytics','marketing']}); wrap.remove(); };
    btnReject.onclick = ()=>{ writePrefs({accepted:['necessary']}); wrap.remove(); };
    btnPrefs.onclick = ()=>{ wrap.remove(); showModal(); };
  }
  function showModal(){
    const cur = readPrefs() || {accepted:['necessary']};
    const overlay = el('div','ccve-overlay');
    const modal = el('div','ccve-modal');
    modal.innerHTML = '<h3>Cookie preferences</h3>';
    const list = el('div','ccve-list');
    list.innerHTML = `
      <label><input type="checkbox" checked disabled> Necessary</label>
      <label><input id="ccve-ana" type="checkbox" ${cur.accepted.includes('analytics')?'checked':''}> Analytics</label>
      <label><input id="ccve-mkt" type="checkbox" ${cur.accepted.includes('marketing')?'checked':''}> Marketing</label>
    `;
    const actions = el('div','ccve-actions');
    const save = el('button','ccve-btn'); save.textContent='Save';
    const acceptAll = el('button','ccve-btn'); acceptAll.textContent='Accept all';
    const close = el('button','ccve-btn'); close.textContent='Close';
    actions.append(save, acceptAll, close);
    modal.append(list, actions); overlay.append(modal); document.body.append(overlay);
    save.onclick=()=>{
      const accepted = ['necessary'];
      if(document.getElementById('ccve-ana').checked) accepted.push('analytics');
      if(document.getElementById('ccve-mkt').checked) accepted.push('marketing');
      writePrefs({accepted}); overlay.remove();
    };
    acceptAll.onclick=()=>{ writePrefs({accepted:['necessary','analytics','marketing']}); overlay.remove(); };
    close.onclick=()=>overlay.remove();
  }
  window.CCVE = { show: showBanner, showPreferences: showModal, getPrefs: readPrefs, enforce: ()=>enforcePrefs(readPrefs()) };
  document.addEventListener('DOMContentLoaded', ()=>{ showBanner(); installCookieGuard(); enforcePrefs(readPrefs()); setInterval(()=>enforcePrefs(readPrefs()), 1000); });
})();


