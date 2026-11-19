/* Young Life Україна · Mini App · інтерфейс */
(function () {
  'use strict';

  const realTg = window.Telegram && window.Telegram.WebApp;
  const IN_TG = !!(realTg && realTg.initData);
  const SESSION_KEY = 'yl:session';
  const APP_LINK = 'https://vovayounglife.github.io/MyYL-mini-app/?app=1';
  let SESSION = null;
  try { SESSION = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { SESSION = null; }
  const IS_INSTALLED = !IN_TG && ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // поза Telegram — та сама програма з власними замінниками функцій Telegram
  function makeShim() {
    const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    return {
      standalone: true, initData: '',
      initDataUnsafe: { user: (SESSION && SESSION.user) || null },
      colorScheme: mq && mq.matches ? 'dark' : 'light',
      ready() {}, expand() {}, setHeaderColor() {},
      onEvent(ev, fn) { if (ev === 'themeChanged' && mq && mq.addEventListener) mq.addEventListener('change', (e) => { this.colorScheme = e.matches ? 'dark' : 'light'; fn(); }); },
      BackButton: { show() {}, hide() {}, onClick() {} },
      HapticFeedback: { notificationOccurred() { try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* ок */ } }, impactOccurred() {} },
      showConfirm(m, cb) { cb(window.confirm(m)); },
      showAlert(m) { window.alert(m); },
      openLink(u) { window.open(u, '_blank', 'noopener'); },
      isVersionAtLeast() { return false; },
    };
  }
  const tg = IN_TG ? realTg : makeShim();
  const API_URL = (window.YL_CONFIG || {}).API_URL || '';
  const $app = document.getElementById('app');

  // ───────────── іконки ─────────────
  const IC = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    add: 'M12 8v8M8 12h8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    stats: 'M5 20V11M12 20V5M19 20v-6M3 20h18',
    more: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    club: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    mg: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    kr: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    known: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
    finance: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    requests: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    plus: 'M12 5v14M5 12h14',
    back: 'M15 18l-6-6 6-6',
    chev: 'M9 18l6-6-6-6',
    check: 'M20 6L9 17l-5-5',
    doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    phoneApp: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
    tree: 'M12 3v6M12 9H5v5M12 9h7v5M3 14h4v4H3zM17 14h4v4h-4zM10 14h4v4h-4zM12 9v5',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    tg: 'M21.5 4.5L2.5 11.7l6 2.2 2.3 6.6 3.4-4.1 5.3 3.9z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  };
  const icon = (n, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]}"></path></svg>`;

  // ───────────── дрібниці ─────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const ym = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const nf = (n) => Math.round(Number(n) || 0).toLocaleString('uk-UA');
  const df = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');
  const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const MFULL = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  const MGEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const MSHORT = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
  const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const TYPES = [
    { k: 'club', label: 'Клуб', short: 'Клуб', none: 'Цього тижня клубу не було', ic: 'ic-coral' },
    { k: 'mg', label: 'Мала група', short: 'Мала група', none: 'Цього тижня малої групи не було', ic: 'ic-teal' },
    { k: 'kr', label: 'Контактна робота', short: 'КР', none: 'Цього тижня контактної роботи не було', ic: 'ic-yellow' },
  ];
  const typeOf = (k) => TYPES.filter((t) => t.k === k)[0];
  const parseDay = (s) => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); };
  const haptic = (t) => { try { tg.HapticFeedback.notificationOccurred(t || 'success'); } catch (e) { /* ок */ } };

  // ───────────── стан ─────────────
  const S = {
    me: null, screen: 'loading', stack: [], toast: '', busy: 0, fatal: '',
    events: null, ev: null, evForm: null, evFilter: 'all',
    add: null, knownCache: {},
    stats: { scope: null, cat: 'overview', period: 'month', data: null, loading: false },
    known: { teamId: null, list: null, mode: 'mine', detail: null, edit: null, bulk: null }, pick: {}, knownMem: {},
    team: { teamId: null, list: null, open: null },
    fin: { teamId: null, month: ym(new Date()), data: null, cur: null },
    thanks: false, reqs: null, reqSel: {}, tree: null, structOpen: {}, structEdit: null,
    reg: { step: 1, name: '', phone: '', email: '', regionId: '', areaId: '', teamId: '', newTeam: '', roles: {}, upper: false },
    roleReq: null, profile: null,
    myyl: { data: null, at: null, open: null },
    rep: { units: {}, items: {}, preset: 'month', from: '', to: '', split: false, data: null, busy: false },
    bc: { info: null, text: '', roles: [], pending: false, count: null, button: true, sending: false },
  };
  let toastTimer = null;

  // ───────────── локальний кеш: показуємо останні дані миттєво, оновлюємо у фоні ─────────────
  const UID = (() => { try { return String(tg.initDataUnsafe.user.id); } catch (e) { return 'x'; } })();
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem('yl1:' + UID + ':' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('yl1:' + UID + ':' + k, JSON.stringify(v)); } catch (e) { /* повна памʼять — не страшно */ } },
  };
  const statsKey = () => [((S.pick && S.pick.stats) || { keys: [] }).keys.join(','), S.stats.cat, S.stats.period].join('|');
  // чи можна зараз перемалювати екран, не збивши людині введення
  const safeToRender = () => !['add', 'onboarding', 'finance', 'profile', 'broadcast', 'report'].includes(S.screen) && !S.evForm && !S.known.edit && !S.known.bulk && !S.structEdit && !S.thanks;

  function toast(msg, kind) {
    S.toast = msg;
    if (kind) haptic(kind);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = ''; const t = document.querySelector('.toast'); if (t) t.remove(); }, 2600);
    const t = document.querySelector('.toast');
    if (t) t.textContent = msg; else document.body.insertAdjacentHTML('beforeend', `<div class="toast" role="status">${esc(msg)}</div>`);
  }

  function setPath(path, val) {
    const parts = path.split('.');
    let o = S;
    for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = val;
  }

  // ───────────── API ─────────────
  async function api(action, data) {
    S.busy++; progress();
    try {
      const auth = IN_TG ? { initData: tg.initData } : { session: SESSION && SESSION.token };
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(Object.assign(auth, { action: action, data: data || {} })) });
      const j = await res.json();
      if (!j.ok) {
        if (!IN_TG && (j.error === 'auth' || j.error === 'auth_expired')) { logout(true); }
        const e = new Error(j.message || 'Помилка'); e.code = j.error; throw e;
      }
      return j.data;
    } catch (e) {
      if (!e.code) e.message = 'Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.';
      throw e;
    } finally { S.busy--; progress(); }
  }
  function progress() {
    let p = document.querySelector('.progress');
    if (S.busy && !p) document.body.insertAdjacentHTML('afterbegin', '<div class="progress"></div>');
    if (!S.busy && p) p.remove();
  }
  async function run(fn, okMsg) {
    try { const r = await fn(); if (okMsg) toast(okMsg, 'success'); return r; } catch (e) { toast(e.message, 'error'); return null; }
  }

  // ───────────── дані користувача ─────────────
  const me = () => S.me;
  const caps = () => (S.me && S.me.caps) || {};
  const first = () => String((S.me && S.me.user.name) || '').split(/\s+/)[0];
  const struct = () => S.me.structure;
  const teamById = (id) => struct().teams.filter((t) => t.id === id)[0];
  const areaById = (id) => struct().areas.filter((a) => a.id === id)[0];
  const teamName = (id) => (teamById(id) || {}).name || '—';
  const activeRoles = () => (S.me.roles || []).filter((r) => r.status === 'активна');
  const roleLine = () => activeRoles().map((r) => r.label + ' · ' + r.unitName).join(', ');
  const myLine = () => {
    if (S.me.user.title) return S.me.user.title;
    const r = activeRoles();
    return r.slice(0, 2).map((x) => x.label + ' · ' + x.unitName).join(', ') + (r.length > 2 ? ' +' + (r.length - 2) : '');
  };
  const myPhoto = () => { try { return (tg.initDataUnsafe.user || {}).photo_url || ''; } catch (e) { return ''; } };
  const myAvatar = () => myPhoto() ? `<img class="avatar lg" src="${esc(myPhoto())}" alt="" style="object-fit:cover;padding:0">` : `<div class="avatar lg">${esc(initials(S.me.user.name))}</div>`;
  const roleDef = (k) => S.me.roleDefs.filter((r) => r.key === k)[0];
  const myTeamFirst = (ids) => { const mine = (S.me.myTeams || []).map((t) => t.id).filter((id) => ids.indexOf(id) >= 0); return mine[0] || ids[0] || null; };

  // ───────────── навігація ─────────────
  const TOP = ['home', 'add', 'calendar', 'stats', 'more'];
  function go(screen, opts) {
    if (TOP.indexOf(screen) >= 0) S.stack = []; else if (S.screen !== screen) S.stack.push(S.screen);
    S.screen = screen;
    enter(screen, opts || {});
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    if (S.screen === 'calendar' && (S.ev || S.evForm)) { S.ev = null; S.evForm = null; return render(); }
    if (S.screen === 'known' && S.known.bulk) { S.known.bulk = null; return render(); }
    if (S.screen === 'known' && (S.known.detail || S.known.edit)) { if (S.known.edit && S.known.detail) S.known.edit = null; else { S.known.detail = null; S.known.edit = null; } return render(); }
    if (S.screen === 'profile' && S.roleReq) { S.roleReq = null; return render(); }
    if (S.screen === 'structure' && S.structEdit) { S.structEdit = null; return render(); }
    if (S.screen === 'stats' && S.stats.find) { S.stats.find = false; return render(); }
    if (S.screen === 'myyl' && myylParent()) { S.myyl.at = myylParent(); S.myyl.open = null; render(); window.scrollTo(0, 0); return; }
    if (S.screen === 'onboarding' && S.reg.step > 1) { S.reg.step--; return render(); }
    S.screen = S.stack.pop() || 'home';
    render();
  }
  function canBack() {
    return S.stack.length > 0 || (S.screen === 'calendar' && (S.ev || S.evForm)) || (S.screen === 'known' && (S.known.detail || S.known.edit || S.known.bulk)) ||
      (S.screen === 'profile' && S.roleReq) || (S.screen === 'onboarding' && S.reg.step > 1) || (S.screen === 'structure' && S.structEdit) || (S.screen === 'stats' && S.stats.find) || (S.screen === 'myyl' && !!myylParent());
  }
  function myylParent() { const d = S.myyl.data; const u = d && S.myyl.at && d.units[S.myyl.at]; return u && u.parent && d.units[u.parent] ? u.parent : ''; }
  let histOn = false, histIgnore = false;
  function syncHistory() {
    if (IN_TG) return;
    const cb = canBack();
    if (cb && !histOn) { history.pushState({ yl: 1 }, ''); histOn = true; }
    else if (!cb && histOn) { histOn = false; histIgnore = true; history.back(); }
  }
  window.addEventListener('popstate', () => { if (histIgnore) { histIgnore = false; return; } if (histOn) { histOn = false; back(); } });
  function syncBack() {
    syncHistory();
    if (!tg || !tg.BackButton) return;
    if (canBack()) tg.BackButton.show(); else tg.BackButton.hide();
  }

  function enter(screen, o) {
    if (screen === 'home' && !S.events) loadEvents();
    if (screen === 'calendar' && S.events) { /* показуємо, що є, і тихо оновлюємо */ }
    if (screen === 'calendar') { S.ev = o.ev || null; S.evForm = null; loadEvents(); }
    if (screen === 'add') initAdd(o.type, o.teamId);
    if (screen === 'stats') { if (o.scope) setPick('stats', o.scope); ensurePick('stats'); if (o.cat) S.stats.cat = o.cat; loadStats(); }
    if (screen === 'known') { S.known.detail = null; S.known.edit = null; S.known.bulk = null; if (S.known.mode === 'browse') ensurePick('known', ownTeamKeys('known')); loadKnown(); }
    if (screen === 'team') { S.team.open = null; ensurePick('team', ownTeamKeys('team')); loadTeam(); }
    if (screen === 'finance') { ensurePick('finance', ownTeamKeys('finance')); loadFin(); }
    if (screen === 'requests') loadReqs();
    if (screen === 'myyl') { S.myyl.open = null; loadMyyl(); }
    if (screen === 'broadcast') loadBc();
    if (screen === 'report') initReport();
    if (screen === 'structure') { S.structEdit = null; loadTree(); }
    if (screen === 'stats') { S.stats.find = false; S.stats.showAll = false; S.stats.showMiss = false; }
    if (screen === 'profile') { S.roleReq = null; S.profile = Object.assign({}, S.me.profile || {}); }
  }

  // ───────────── завантаження ─────────────
  function route() {
    if (S.me.status === 'new') { S.reg.name = S.reg.name || S.me.user.name; S.screen = 'onboarding'; return true; }
    if (S.me.status === 'pending') { S.screen = 'pending'; return true; }
    return false;
  }
  async function loadMe() {
    const cached = LS.get('me');
    if (cached && cached.status === 'active') {
      // миттєвий старт з останніх даних
      S.me = cached; S.events = cached.events || null;
      const want = new URLSearchParams(location.search).get('screen');
      S.screen = 'home';
      if (want && VIEWS[want] && want !== 'onboarding' && want !== 'pending') go(want); else render();
      try {
        const fresh = await api('me');
        S.me = fresh; S.events = fresh.events || S.events; LS.set('me', fresh);
        if (route()) return render();
        if (safeToRender()) render();
      } catch (e) { toast(e.message); }
      return;
    }
    try {
      S.me = await api('me');
    } catch (e) { if (!IN_TG && (e.code === 'auth' || e.code === 'auth_expired')) return; S.fatal = e.message; return renderFatal(); }
    if (S.me.status === 'active') { LS.set('me', S.me); S.events = S.me.events || null; }
    if (S.me.status === 'new') { S.reg.name = S.reg.name || S.me.user.name; S.screen = 'onboarding'; }
    else if (S.me.status === 'pending') S.screen = 'pending';
    else {
      const want = new URLSearchParams(location.search).get('screen');
      S.screen = 'home';
      enter('home', {});
      if (want && VIEWS[want] && want !== 'onboarding' && want !== 'pending') { go(want); return; }
    }
    render();
  }
  async function loadEvents() {
    try { S.events = await api('events'); if (S.me) { S.me.events = S.events; LS.set('me', S.me); } } catch (e) { S.events = S.events || []; toast(e.message); }
    if ((S.screen === 'calendar' || S.screen === 'home') && safeToRender()) render();
  }
  async function loadStats() {
    const key = statsKey();
    const hit = (S.statsMem || {})[key] || LS.get('st:' + key);
    if (hit) S.stats.data = hit;
    S.stats.loading = true; render();
    try {
      const d = await api('stats', { units: S.pick.stats.keys, cat: S.stats.cat, period: S.stats.period });
      if (statsKey() !== key) return; // людина вже перейшла далі
      S.stats.data = d;
      if (d.scope.level !== 'multi' && S.pick.stats.keys.join() !== d.scope.key) setPick('stats', d.scope.key);
      S.stats.cat = d.cat;
      S.statsMem = S.statsMem || {}; S.statsMem[key] = d; S.statsMem[statsKey()] = d;
      LS.set('st:' + statsKey(), d);
    } catch (e) { toast(e.message); }
    S.stats.loading = false;
    if (S.screen === 'stats' && !S.stats.find) render();
  }
  async function loadKnown(force) {
    const browse = S.known.mode === 'browse';
    const P = S.pick.known;
    if (browse && (!P || !P.keys.length)) { S.known.list = []; return render(); }
    const key = browse ? P.keys.join(',') : 'mine';
    if (!force && S.knownMem[key]) S.known.list = S.knownMem[key];
    else S.known.list = LS.get('kn:' + key) || null;
    render();
    try {
      const data = await api('knownList', browse ? { units: P.keys } : { mine: true });
      S.knownMem[key] = data; LS.set('kn:' + key, data);
      const nowKey = S.known.mode === 'browse' ? (S.pick.known || { keys: [] }).keys.join(',') : 'mine';
      if (nowKey === key) S.known.list = data;
    } catch (e) { S.known.list = S.known.list || []; toast(e.message); }
    S.knownCache = {};
    if (S.screen === 'known' && !S.known.edit && !S.known.bulk) render();
  }
  async function loadTeam() {
    const P = S.pick.team;
    if (!P || !P.keys.length) { S.team.list = []; return render(); }
    S.team.list = null; render();
    try { S.team.list = await api('teamMembers', { units: P.keys }); } catch (e) { S.team.list = []; toast(e.message); }
    if (S.screen === 'team') render();
  }
  async function loadFin() {
    const P = S.pick.finance;
    if (!P || !P.keys.length) return render();
    S.fin.teamId = P.keys.length === 1 && P.keys[0].indexOf('t:') === 0 ? P.keys[0].slice(2) : null;
    S.fin.data = null; render();
    try { S.fin.data = await api('financeGet', { units: P.keys, month: S.fin.month }); S.fin.cur = S.fin.data.mode ? null : Object.assign({}, S.fin.data.current); } catch (e) { toast(e.message); }
    if (S.screen === 'finance') render();
  }
  async function loadTree() {
    S.tree = null; render();
    try { S.tree = await api('structureTree'); } catch (e) { S.tree = []; toast(e.message); }
    if (S.screen === 'structure') render();
  }
  async function loadMyyl() {
    if (!S.myyl.data) { S.myyl.data = LS.get('myyl'); }
    render();
    try {
      S.myyl.data = await api('myylTree'); LS.set('myyl', S.myyl.data);
      if (!S.myyl.at || !S.myyl.data.units[S.myyl.at]) S.myyl.at = S.myyl.data.roots.length === 1 ? S.myyl.data.roots[0] : null;
    } catch (e) { if (!S.myyl.data) S.myyl.data = { roots: [], units: {} }; toast(e.message); }
    if (S.screen === 'myyl') render();
  }
  const bcParams = () => ({ units: (S.pick.broadcast || { keys: [] }).keys, roles: S.bc.roles || [], pending: !!S.bc.pending });
  async function loadBc() {
    ensurePick('broadcast');
    S.bc.info = null; S.bc.count = null; render();
    try { S.bc.info = await api('broadcastInfo', bcParams()); S.bc.count = S.bc.info.count; } catch (e) { S.bc.info = { history: [], queued: 0 }; toast(e.message); }
    if (S.screen === 'broadcast') { const t = document.getElementById('bcText'); if (t) S.bc.text = t.value; render(); }
  }
  async function loadBcCount() {
    const t = document.getElementById('bcText'); if (t) S.bc.text = t.value;
    S.bc.count = null; render();
    const key = JSON.stringify(bcParams());
    try { const r = await api('broadcastInfo', bcParams()); if (JSON.stringify(bcParams()) === key) { S.bc.count = r.count; S.bc.info = r; } } catch (e) { toast(e.message); }
    if (S.screen === 'broadcast') { const tt = document.getElementById('bcText'); if (tt) S.bc.text = tt.value; render(); }
  }
  async function loadReqs() {
    S.reqs = null; render();
    try { S.reqs = await api('requests'); S.reqSel = {}; S.reqs.forEach((p) => p.roles.forEach((r) => { S.reqSel[r.id] = true; })); } catch (e) { S.reqs = []; toast(e.message); }
    S.me.pendingCount = (S.reqs || []).reduce((a, p) => a + p.roles.length, 0);
    if (S.screen === 'requests') render();
  }

  // ───────────── рендер ─────────────
  function render() {
    if (!S.me) return;
    const view = VIEWS[S.screen] ? VIEWS[S.screen]() : '';
    const nav = S.me.status === 'active' ? navHtml() : '';
    $app.innerHTML = `<main class="main${nav ? '' : ' no-nav'}">${view}</main>${nav}` + (S.thanks ? `<div class="modal-bg" role="dialog" aria-modal="true" aria-labelledby="thxT"><div class="modal">
      <div id="thxT" class="thx-text">Дякую тобі за вірність в малому</div>
      <button type="button" class="thx-btn" data-a="thanksClose" aria-label="Амінь">🙏</button></div></div>` : '');
    if (S.toast) document.body.insertAdjacentHTML('beforeend', document.querySelector('.toast') ? '' : `<div class="toast" role="status">${esc(S.toast)}</div>`);
    syncBack();
    document.querySelectorAll('.pills.lvl').forEach((p) => { const on = p.querySelector('.pill.on'); if (on) p.scrollLeft = on.offsetLeft - p.offsetLeft - (p.clientWidth - on.clientWidth) / 2; });
  }
  function renderFatal() {
    $app.innerHTML = `<main class="main no-nav"><div class="row"><div class="logo">YL</div><h2>Young Life Україна</h2></div>
      <div class="card col"><h2>Не вдалося відкрити застосунок</h2><div class="muted">${esc(S.fatal)}</div>
      <button class="btn" type="button" data-a="reload">Спробувати ще раз</button></div></main>`;
  }

  function navHtml() {
    const c = caps();
    const canReport = ['club', 'mg', 'kr'].some((t) => (c.report[t] || []).length);
    const tabs = [['home', 'Головна'], ['add', 'Внести'], ['calendar', 'Календар'], ['stats', 'Статистика'], ['more', 'Ще']]
      .filter((t) => (t[0] !== 'add' || canReport) && (t[0] !== 'stats' || (S.me.scopes || []).length));
    const active = TOP.indexOf(S.screen) >= 0 ? S.screen : 'more';
    return `<nav class="tabs" aria-label="Розділи"><div class="in-nav">${tabs.map((t) =>
      `<button type="button" class="${t[0] === active ? 'on' : ''}" data-a="tab" data-s="${t[0]}">${icon(t[0], 24)}${t[1]}${t[0] === 'more' && S.me.pendingCount ? '<span class="dot"></span>' : ''}</button>`).join('')}</div></nav>`;
  }

  const header = (title, sub, extra) => `<div class="row">${canBack() ? `<button type="button" class="icon-btn" data-a="back" aria-label="Назад">${icon('back')}</button>` : ''}<div class="grow"><h1 style="font-size:22px">${esc(title)}</h1>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</div>${extra || ''}</div>`;
  const loading = () => '<div class="loader"><div class="spin"></div>Завантаження…</div>';
  const teamSelect = (ids, cur, ch) => ids.length > 1
    ? `<label class="f"><span>Команда</span><select class="in" data-ch="${ch}">${ids.map((id) => `<option value="${esc(id)}"${id === cur ? ' selected' : ''}>${esc(teamName(id))}${areaById((teamById(id) || {}).areaId) ? ' · ' + esc(areaById(teamById(id).areaId).name) : ''}</option>`).join('')}</select></label>`
    : '';

  const VIEWS = {};

  // ───────────── ГОЛОВНА ─────────────
  VIEWS.home = function () {
    const m = me(), c = caps();
    let h = `<div class="row">${myAvatar()}<div class="grow"><h1 style="font-size:22px">Привіт, ${esc(first())}!</h1><div class="small muted">${esc(myLine())}</div></div></div>`;
    const items = (m.week && m.week.items) || [];
    if (items.length) {
      const done = items.filter((x) => x.status !== 'missing').length;
      h += `<div class="card col"><div class="row between"><div><h2>Цей тиждень</h2><div class="small muted">${esc(m.week.label)}</div></div>
        <div style="font:800 22px Manrope,Inter,sans-serif">${done}<span class="small muted"> з ${items.length}</span></div></div>
        ${items.map((it) => `<div class="week-item"><span class="grow b" style="font-weight:500">${esc(it.label)}</span>${
          it.status === 'ok' ? `<button type="button" class="status ok" data-a="openAdd" data-type="${it.type}" data-team="${esc(it.teamId)}">${it.type === 'kr' ? df(it.hours) + ' год' : 'Внесено'}</button>`
          : it.status === 'none' ? `<button type="button" class="status none" data-a="openAdd" data-type="${it.type}" data-team="${esc(it.teamId)}">Не було</button>`
          : `<button type="button" class="btn ghost sm" data-a="markNone" data-type="${it.type}" data-team="${esc(it.teamId)}">Не було</button><button type="button" class="btn sm" data-a="openAdd" data-type="${it.type}" data-team="${esc(it.teamId)}">Внести</button>`
        }</div>`).join('')}</div>`;
    }
    if (m.pendingCount) {
      h += `<button type="button" class="banner" data-a="tabGo" data-s="requests"><span class="badge" style="width:32px;height:32px;border-radius:16px">${m.pendingCount}</span>
        <span class="grow"><b>Нові заявки</b><br><span class="small muted">Люди чекають на підтвердження ролі</span></span>${icon('chev')}</button>`;
    }
    const quick = TYPES.filter((t) => (c.report[t.k] || []).length);
    if (quick.length && items.length) {
      h += `<div class="sec">Швидко внести</div><div class="grid3">${quick.map((t) =>
        `<button type="button" class="tile" data-a="openAdd" data-type="${t.k}"><span class="ic ${t.ic}">${icon(t.k, 18)}</span>${t.label}</button>`).join('')}</div>`;
    }
    const tiles = sectionTiles();
    if (tiles.length) {
      h += `<div class="sec">Розділи</div><div class="grid2">${tiles.map((t) =>
        `<button type="button" class="tile h" data-a="tabGo" data-s="${t.k}"><span class="ic ${t.ic}">${icon(t.icon, 18)}</span><span class="grow"><span style="display:block">${esc(t.label)}</span><span class="xs muted" style="font-weight:400">${esc(t.sub)}</span></span></button>`).join('')}</div>`;
    }
    h += `<div class="row between" style="margin:8px 4px -4px"><span class="sec" style="margin:0">Найближчі події</span><button type="button" class="link-btn" data-a="tab" data-s="calendar">Усі</button></div>`;
    if (!S.events) h += loading();
    else if (!S.events.length) h += '<div class="empty small">Подій поки немає</div>';
    else h += S.events.slice(0, 2).map(evCard).join('');
    if (m.scopeCard) {
      const sc = m.scopeCard; const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
      h += `<button type="button" class="mini-stat" data-a="goStats" data-scope="${esc(sc.scope)}" data-cat="club"><span class="grow"><span class="xs muted" style="display:block">${esc(sc.title)} · клуби цього тижня</span>
        <span class="small"><b>${sc.done}</b> з ${sc.total} команд звітували</span><span class="track" style="height:4px;margin-top:6px"><i style="width:${pct}%;background:var(--turq)"></i></span></span><span class="xs muted">Деталі ›</span></button>`;
    }
    return h;
  };

  function sectionTiles() {
    const c = caps();
    const out = [];
    if (c.myyl) out.push({ k: 'myyl', label: 'Моя команда в MyYL', sub: 'усі гілки й люди', icon: 'tree', ic: 'ic-blue' });
    if (c.broadcast) out.push({ k: 'broadcast', label: 'Написати', sub: c.isSuper ? 'усім або вибраним у боті' : 'своїм людям у боті', icon: 'send', ic: 'ic-coral' });
    if ((c.knownTeams || []).length || c.knownNoTeam) out.push({ k: 'known', label: 'Знані по імені', sub: 'підлітки, за яких молимось', icon: 'known', ic: 'ic-coral' });
    if ((c.viewTeams || []).length) out.push({ k: 'team', label: 'Склад команди', sub: 'ролі й анкети', icon: 'club', ic: 'ic-teal' });
    if ((c.financeTeams || []).length) out.push({ k: 'finance', label: 'Фінансовий звіт', sub: 'щомісяця', icon: 'finance', ic: 'ic-yellow' });
    if (c.manage) out.push({ k: 'structure', label: 'Ерії та команди', sub: 'додати, перейменувати', icon: 'more', ic: 'ic-purple' });
    return out;
  }

  // ───────────── ВНЕСТИ ─────────────
  function initAdd(type, teamId) {
    const c = caps();
    const types = TYPES.filter((t) => (c.report[t.k] || []).length).map((t) => t.k);
    const t = types.indexOf(type) >= 0 ? type : (S.add && types.indexOf(S.add.type) >= 0 ? S.add.type : types[0]);
    const teams = (c.report[t] || []);
    S.add = {
      type: t, teamId: teams.indexOf(teamId) >= 0 ? teamId : myTeamFirst(teams), mode: 'event', date: ymd(new Date()),
      teens: 0, newT: 0, leaders: 0, hours: 1, topic: '', note: '', mark: false, att: {},
    };
  }
  const FIELDS = {
    club: [['teens', 'Підлітків усього', 1], ['newT', 'З них нових', 1], ['leaders', 'Лідерів', 1]],
    mg: [['teens', 'Учасників', 1], ['newT', 'З них нових', 1]],
    kr: [['hours', 'Годин з підлітками', 0.5]],
  };
  VIEWS.add = function () {
    const c = caps(), a = S.add;
    if (!a || !a.type) return header('Новий запис') + '<div class="empty">Для твоєї ролі немає звітів</div>';
    const types = TYPES.filter((t) => (c.report[t.k] || []).length);
    let h = header('Новий запис');
    if (types.length > 1) h += `<div class="seg">${types.map((t) => `<button type="button" class="${t.k === a.type ? 'on' : ''}" data-a="addType" data-type="${t.k}">${t.short}</button>`).join('')}</div>`;
    h += teamSelect(c.report[a.type], a.teamId, 'addTeam');
    h += `<div class="pills">${[['event', 'Окрема подія'], ['week', 'Підсумок тижня']].map((m) => `<button type="button" class="pill${a.mode === m[0] ? ' on' : ''}" data-a="addMode" data-m="${m[0]}">${m[1]}</button>`).join('')}</div>`;
    h += '<div class="card rows">';
    h += a.mode === 'event'
      ? `<div class="stepper"><label for="addDate" style="font-weight:500">Дата</label><input id="addDate" class="in" style="width:auto;min-height:40px" type="date" value="${esc(a.date)}" max="${ymd(new Date())}" data-bind="add.date"></div>`
      : `<div class="stepper"><span style="font-weight:500">Тиждень</span><span class="b">${esc(me().week ? me().week.label : 'цей тиждень')}</span></div>`;
    h += FIELDS[a.type].map((f) => `<div class="stepper"><label for="st_${f[0]}" style="font-weight:500">${f[1]}</label><span class="ctl">
      <button type="button" data-a="step" data-k="${f[0]}" data-d="${-f[2]}" aria-label="Менше">−</button>
      <input id="st_${f[0]}" type="number" inputmode="decimal" min="0" step="${f[2]}" value="${a[f[0]]}" data-bind="add.${f[0]}">
      <button type="button" data-a="step" data-k="${f[0]}" data-d="${f[2]}" aria-label="Більше">+</button></span></div>`).join('');
    if (a.type === 'mg') h += `<div class="f" style="padding:12px 0;border-bottom:1px solid var(--line)"><label for="mgTopic" style="font-weight:500">Тема зустрічі</label><input id="mgTopic" class="in" type="text" value="${esc(a.topic)}" data-bind="add.topic" placeholder="Наприклад: Притча про блудного сина"></div>`;
    h += `<div class="f" style="padding:12px 0"><label for="addNote" style="font-weight:500">Нотатка <span class="muted" style="font-weight:400">(необовʼязково)</span></label><textarea id="addNote" class="in" rows="2" data-bind="add.note" placeholder="Що варто відзначити, за що помолитися">${esc(a.note)}</textarea></div>`;
    h += '</div>';
    if ((a.type === 'club' || a.type === 'mg') && (c.knownTeams || []).indexOf(a.teamId) >= 0) {
      h += `<div class="card rows"><label class="toggle-row"><span><span class="b" style="display:block">Відмітити по іменах</span><span class="small muted">Кількість порахується сама</span></span>
        <input type="checkbox" data-ch="addMark"${a.mark ? ' checked' : ''}></label>`;
      if (a.mark) {
        const list = S.knownCache[a.teamId];
        if (!list) h += loading();
        else if (!list.length) h += '<div class="small muted" style="padding:8px 0 14px">Список знаних порожній — додай підлітків у «Знані по імені».</div>';
        else {
          h += '<div style="border-top:1px solid var(--line);padding:4px 0">' + list.map((p) => `<label class="check" style="padding:0"><input type="checkbox" data-ch="addAtt" data-id="${esc(p.id)}"${a.att[p.id] ? ' checked' : ''}><span class="grow">${esc(p.name)}</span><span class="xs muted">${esc(p.grade)}</span></label>`).join('') + '</div>';
          h += `<div class="small muted" style="padding:6px 0 12px">Відмічено: ${Object.keys(a.att).filter((k) => a.att[k]).length}</div>`;
        }
      }
      h += '</div>';
    }
    h += `<button type="button" class="btn" data-a="addSave">Зберегти</button>`;
    h += `<button type="button" class="btn ghost" data-a="markNone" data-type="${a.type}" data-team="${esc(a.teamId)}">${typeOf(a.type).none}</button>`;
    return h;
  };

  // ───────────── КАЛЕНДАР ─────────────
  const LVL = { nat: 'Національні', region: 'Регіон', area: 'Ерія', team: 'Команда' };
  function evDateParts(e) { const d = parseDay(e.date); return { day: d.getDate(), wd: WD[d.getDay()], mon: MSHORT[d.getMonth()], month: MFULL[d.getMonth()] + ' ' + d.getFullYear(), d: d }; }
  const fmtShortDay = (k) => { const d = parseDay(k); return d.getDate() + ' ' + MSHORT[d.getMonth()]; };
  const fmtRange = (e) => {
    const a = parseDay(e.date);
    if (!e.end) return a.getDate() + ' ' + MGEN[a.getMonth()];
    const b = parseDay(e.end);
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? a.getDate() + '–' + b.getDate() + ' ' + MGEN[b.getMonth()] : a.getDate() + ' ' + MGEN[a.getMonth()] + ' – ' + b.getDate() + ' ' + MGEN[b.getMonth()];
  };
  function evCard(e) {
    const p = evDateParts(e);
    const going = e.date < ymd(new Date());
    return `<button type="button" class="ev" data-a="openEv" data-id="${esc(e.id)}"><span class="ev-date tag lvl-${e.level}"><b>${p.day}</b><span>${p.wd}</span></span>
      <span class="grow"><span class="b" style="display:block">${esc(e.title)}</span><span class="small muted">${going ? '<b style="color:var(--teal)">триває</b> · ' : ''}${e.end ? 'до ' + esc(fmtShortDay(e.end)) + ' · ' : ''}${esc(e.levelLabel)}${e.place ? ' · ' + esc(e.place) : ''}${e.time ? ' · ' + esc(e.time) : ''}</span></span>
      ${e.isGoing ? '<span class="xs b" style="color:var(--teal)">Йду</span>' : ''}</button>`;
  }
  VIEWS.calendar = function () {
    const c = caps();
    if (S.evForm) return evFormView();
    if (S.ev) return evDetailView();
    let h = header('Календар Young Life', '', (c.eventUnits || []).length ? `<button type="button" class="icon-btn accent" data-a="evNew" aria-label="Додати подію">${icon('plus', 22)}</button>` : '');
    h += `<div class="pills">${[['all', 'Усі']].concat(Object.keys(LVL).map((k) => [k, LVL[k]])).map((l) => `<button type="button" class="pill${S.evFilter === l[0] ? ' on' : ''}" data-a="evFilter" data-l="${l[0]}">${l[1]}</button>`).join('')}</div>`;
    if (!S.events) return h + loading();
    const list = S.events.filter((e) => S.evFilter === 'all' || e.level === S.evFilter);
    if (!list.length) return h + '<div class="empty">Подій немає</div>';
    let cur = '';
    list.forEach((e) => { const m = evDateParts(e).month; if (m !== cur) { cur = m; h += `<div class="sec">${esc(m)}</div>`; } h += evCard(e); });
    return h;
  }
  const evUnits = (f) => { const u = (caps().eventUnits || []).slice(); if (f && f.extraUnit && !u.some((x) => x.level === f.extraUnit.level && x.unitId === f.extraUnit.unitId)) u.push(f.extraUnit); return u; };
  function evDetailView() {
    const e = (S.events || []).filter((x) => x.id === S.ev)[0];
    if (!e) return header('Подія') + '<div class="empty">Подію не знайдено</div>';
    const p = evDateParts(e);
    let h = header(e.title, '', '');
    h += `<div><span class="tag lvl-${e.level}">${esc(e.levelLabel)}</span></div>`;
    h += `<div class="card rows"><div class="kv"><span>Коли</span><span>${esc(fmtRange(e))}${e.time ? ', ' + esc(e.time) : ''}</span></div>
      ${e.place ? `<div class="kv"><span>Де</span><span>${esc(e.place)}</span></div>` : ''}<div class="kv"><span>Організатор</span><span>${esc(e.author || '—')}</span></div>
      ${e.rolesLabel || e.audLabel ? `<div class="kv"><span>Для кого</span><span>${esc([e.rolesLabel, e.audLabel].filter(Boolean).join(' · '))}</span></div>` : ''}</div>`;
    if (e.desc) h += `<div style="white-space:pre-line">${esc(e.desc)}</div>`;
    h += `<div class="row small muted">${icon('club', 18)}${e.going} ${e.going % 10 === 1 && e.going % 100 !== 11 ? 'людина йде' : 'людей йдуть'}</div>`;
    h += e.isGoing ? `<button type="button" class="btn ghost" data-a="rsvp" data-id="${esc(e.id)}" data-g="0" style="border-color:var(--teal);color:var(--teal)">Ти йдеш ✓ — скасувати</button>`
      : `<button type="button" class="btn" data-a="rsvp" data-id="${esc(e.id)}" data-g="1">Йду / їду</button>`;
    h += `<button type="button" class="btn sec2" data-a="evCal" data-id="${esc(e.id)}">${icon('calendar', 18)} Додати у свій календар</button>`;
    h += '<div class="small muted center">Бот нагадає в Telegram тим, хто записався</div>';
    if (e.manage) {
      h += `<div class="card col"><h2>Учасники (${e.people.length})</h2>${e.people.length ? e.people.map((x) => `<div class="row between small"><span>${esc(x.name)}</span><span class="muted">${esc(x.team)}</span></div>`).join('') : '<div class="small muted">Ще ніхто не записався</div>'}</div>`;
      h += `<div class="grid2"><button type="button" class="btn sec2" data-a="evEdit" data-id="${esc(e.id)}">Редагувати</button><button type="button" class="btn ghost" data-a="evDelete" data-id="${esc(e.id)}">Видалити</button></div>`;
    }
    return h;
  }
  const AUD_GROUPS = [['all', 'Усім'], ['leaders', 'Лідерам і вище'], ['captains', 'Капітанам і вище'], ['heads', 'Керівництву ерій і регіонів']];
  const audRoles = (g) => S.me.roleDefs.filter((r) => r.key !== 'OFFICE' && (g === 'leaders' ? r.rank <= 9 : g === 'captains' ? r.rank <= 6 : g === 'heads' ? r.rank <= 5 : false)).map((r) => r.key);
  function rolesField(scr, f, hint) {
    const sel = f.roles || [];
    const grp = !sel.length ? 'all' : (AUD_GROUPS.filter((g) => g[0] !== 'all' && audRoles(g[0]).join() === sel.slice().sort((a, b) => roleDef(a).rank - roleDef(b).rank).join())[0] || [''])[0];
    return `<div class="pills" style="flex-wrap:wrap">${AUD_GROUPS.map((g) => `<button type="button" class="pill${grp === g[0] ? ' on' : ''}" data-a="audGroup" data-s="${scr}" data-g="${g[0]}">${g[1]}</button>`).join('')}<button type="button" class="pill${sel.length && !grp ? ' on' : ''}" data-a="audCustom" data-s="${scr}">Вибрати ролі</button></div>
      ${f.audOpen || (sel.length && !grp) ? `<div class="pills" style="flex-wrap:wrap">${S.me.roleDefs.map((r) => `<button type="button" class="pill${sel.indexOf(r.key) >= 0 ? ' on' : ''}" style="min-height:34px" data-a="audRole" data-s="${scr}" data-k="${r.key}">${esc(r.label)}</button>`).join('')}</div>` : ''}
      ${hint ? `<span class="xs muted" style="font-weight:400">${hint(sel)}</span>` : ''}`;
  }
  function audienceField(f) {
    const pk = picker('event');
    return `<div class="f"><span>Для кого (хто бачить подію і може піти)</span>
      ${pk ? `<div class="xs muted" style="font-weight:400">Де:</div>${pk}<div class="xs muted" style="font-weight:400;margin-top:4px">Ролі:</div>` : ''}
      ${rolesField('event', f, (sel) => (sel.length ? 'Бачать лише: ' + esc(sel.map((k) => roleDef(k).label).join(', ')) + (pk ? ' — у вибраних ' + esc(pickLabel('event').toLowerCase().indexOf('вибрано') === 0 ? 'місцях' : pickLabel('event')) : '') + '. Ти й керівники рівня бачать завжди.' : 'Бачать усі ролі у вибраних місцях і вище.'))}</div>`;
  }
  const audState = (scr) => (scr === 'event' ? S.evForm : S.bc);
  function evFormView() {
    const f = S.evForm, units = evUnits(f);
    let h = header(f.id ? 'Редагувати подію' : 'Нова подія');
    h += '<div class="card col">';
    h += units.length > 1
      ? `<label class="f"><span>Календар</span><select class="in" data-bind="evForm.unit" data-ch="evOwner">${units.map((u, i) => `<option value="${i}"${String(i) === String(f.unit) ? ' selected' : ''}>${esc(u.label)}</option>`).join('')}</select></label>`
      : `<div class="small muted">Додається в календар: <b>${esc(units[0] ? units[0].label : '')}</b></div>`;
    h += `<label class="f"><span>Назва</span><input class="in" type="text" data-bind="evForm.title" value="${esc(f.title)}" placeholder="Наприклад: Різдвяний клуб"></label>
      <div class="grid2"><label class="f"><span>Дата початку</span><input class="in" type="date" data-bind="evForm.date" data-ch="evDate" value="${esc(f.date)}" min="${ymd(new Date())}"></label>
      <label class="f"><span>Дата кінця</span><input class="in" type="date" data-bind="evForm.end" value="${esc(f.end || '')}" min="${esc(f.date)}"></label></div>
      <div class="xs muted" style="margin-top:-6px">Дата кінця — для подій на кілька днів (табір, конференція). Для одноденної залиш порожньою.</div>
      <label class="f"><span>Час початку</span><input class="in" type="time" data-bind="evForm.time" value="${esc(f.time)}"></label>
      <label class="f"><span>Місце</span><input class="in" type="text" data-bind="evForm.place" value="${esc(f.place)}" placeholder="Адреса або назва"></label>
      <label class="f"><span>Опис</span><textarea class="in" rows="3" data-bind="evForm.desc">${esc(f.desc)}</textarea></label>
      ${audienceField(f)}
      <button type="button" class="btn" data-a="evSave">${f.id ? 'Зберегти зміни' : 'Додати подію'}</button></div>`;
    return h;
  }

  // ───────────── СТАТИСТИКА ─────────────
  VIEWS.stats = function () {
    const st = S.stats, d = st.data;
    const pathSub = !d ? '' : d.scope.level === 'multi' ? d.scope.label : d.path && d.path.length > 1 ? d.path.slice(0, -1).map((p) => p.label).join(' › ') : '';
    let h = header('Статистика', pathSub);
    // єдиний вибір рівня й одиниць — без гортання
    h += picker('stats');
    if (!d) return h + loading();
    if (d.cats.length > 1) h += `<div class="pills">${d.cats.map((c) => `<button type="button" class="pill${c.key === d.cat ? ' on' : ''}" data-a="statsCat" data-c="${c.key}">${esc(c.label)}</button>`).join('')}</div>`;
    h += `<div class="seg">${[['week', 'Тиждень'], ['month', 'Місяць'], ['q', '3 міс'], ['year', 'Рік']].map((p) => `<button type="button" class="${p[0] === st.period ? 'on' : ''}" data-a="statsPeriod" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>`;
    if (st.loading) h += '<div class="small muted center">Оновлюю…</div>';
    h += `<div class="kpis">${d.kpis.map((k) => `<div class="card kpi"><div class="v">${esc(k.v)}</div><div class="l">${esc(k.l)}</div></div>`).join('')}</div>`;

    const bars = d.chart.bars, max = Math.max.apply(null, bars.map((x) => x.v).concat([1]));
    const short = (v) => d.cat === 'kr' ? df(v) : v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? df(v / 1000) + 'k' : nf(v);
    h += `<div class="card"><h2>${esc(d.chart.title)}</h2><div class="small muted" style="margin-bottom:12px">${esc(d.chart.sub)}</div>
      <div class="chart">${bars.map((x, i) => `<div class="bar${i === bars.length - 1 ? ' last' : ''}"><span>${x.v ? short(x.v) : ''}</span><i style="height:${Math.max(2, Math.round(x.v / max * 118))}px"></i></div>`).join('')}</div>
      <div class="chart-labels">${bars.map((x) => `<span>${esc(x.label)}</span>`).join('')}</div></div>`;
    // розбивка — головний спосіб навігації вниз
    const b = d.breakdown;
    if (b.rows.length) {
      let rows = b.rows.slice();
      const sort = st.sort || 'value';
      if (sort === 'name') rows.sort((x, y) => x.name.localeCompare(y.name));
      if (sort === 'behind') rows.sort((x, y) => ((x.done || 0) / (x.total || 1)) - ((y.done || 0) / (y.total || 1)) || x.value - y.value);
      const many = rows.length > 8;
      const shown = many && !st.showAll ? rows.slice(0, 8) : rows;
      const rmax = Math.max.apply(null, b.rows.map((r) => r.value).concat([1]));
      const COL = ['var(--coral)', 'var(--yellow)', 'var(--turq)', 'var(--blue)', 'var(--purple)', 'var(--pink)'];
      const hasRep = rows.some((r) => r.total != null);
      h += `<div class="card col" style="gap:4px"><div class="row between"><h2>${esc(b.title)} · ${b.rows.length}</h2></div>
        <div class="xs muted">Показник: ${esc(b.metric)}${hasRep ? ' · «здали» — ' + esc(b.repLabel) + ' цього тижня' : ''}</div>
        <div class="pills" style="margin:6px 0 4px">${[['value', 'Більше'], ['name', 'А–Я']].concat(hasRep ? [['behind', 'Хто відстає']] : []).map((s) => `<button type="button" class="pill${sort === s[0] ? ' on' : ''}" style="min-height:34px" data-a="statsSort" data-s="${s[0]}">${s[1]}</button>`).join('')}</div>
        ${many ? '<input class="in" type="search" placeholder="Пошук у списку" data-live="statsRowFind" style="min-height:42px;margin-bottom:4px">' : ''}
        <div id="brkList">${shown.map((r, i) => {
          const lag = r.total != null && r.done < r.total;
          return `<button type="button" class="brk" data-q="${esc(r.name.toLowerCase())}" ${r.drill ? `data-a="statsDrill" data-k="${esc(r.drill)}"` : 'disabled style="cursor:default;opacity:1"'}>
            <span class="row between" style="width:100%;gap:8px"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.drill ? ' <span class="muted">›</span>' : ''}</span>
            ${r.total != null ? `<span class="tag ${lag ? 'warn' : 'ok'}" style="flex:0 0 auto">здали ${r.done}/${r.total}</span>` : ''}<span class="b" style="flex:0 0 auto;min-width:44px;text-align:right">${esc(r.text)}</span></span>
            <span class="track" style="width:100%"><i style="width:${Math.round(r.value / rmax * 100)}%;background:${COL[i % 6]};border-radius:4px"></i></span></button>`;
        }).join('')}</div>
        ${many ? `<button type="button" class="link-btn" data-a="statsShowAll">${st.showAll ? 'Згорнути' : 'Показати всі (' + rows.length + ')'}</button>` : ''}
        ${b.rows.some((r) => r.drill) ? '<div class="xs muted">Натисни на рядок, щоб перейти на рівень нижче</div>' : ''}</div>`;
    }

    if (d.cat === 'overview') {
      h += `<div class="card col" style="gap:6px"><h2>Звітність цього тижня</h2><div class="small muted">${esc(d.weekLabel)}</div>${d.report.map((r) => {
        const tot = r.total || 1;
        return `<button type="button" class="brk" style="border-top:1px solid var(--line);padding:10px 0" data-a="statsCat" data-c="${r.type}">
          <span class="row between" style="width:100%"><span class="b">${esc(r.label)}</span><span class="b">${r.ok + r.none} з ${r.total} ${esc(r.unit)}</span></span>
          <span class="track" style="width:100%"><i style="width:${r.ok / tot * 100}%;background:var(--turq)"></i><i style="width:${r.none / tot * 100}%;background:var(--muted);opacity:.45"></i></span>
          <span class="xs muted">${r.none ? '«Не було»: ' + r.none + ' · ' : ''}ще не здали: ${r.missing.length}</span></button>`;
      }).join('')}</div>`;
    }
    const rep = d.report.filter((r) => r.type === d.cat)[0];
    if (rep) {
      const open = st.showMiss;
      h += `<div class="card col"><div class="row between"><h2>Цього тижня ще не здали · ${rep.missing.length}</h2>${rep.missing.length ? `<button type="button" class="link-btn" data-a="statsShowMiss">${open ? 'Сховати' : 'Показати'}</button>` : ''}</div>
        ${!rep.missing.length ? '<div class="b" style="color:var(--teal)">Усі здали</div>' : open ? `<div class="row wrap" style="gap:8px;max-height:280px;overflow:auto">${rep.missing.map((m) => `<span class="tag warn">${esc(m)}</span>`).join('')}</div>` : ''}
        <div class="small muted">Відмітили «не було»: ${rep.none}</div>
        ${d.canNudge && rep.missing.length ? `<button type="button" class="btn sec2 sm" data-a="nudge" data-type="${rep.type}">Нагадати їм у Telegram</button>` : ''}</div>`;
    }
    return h;
  };

  // ───────────── СТРУКТУРА (ерії й команди) ─────────────
  VIEWS.structure = function () {
    const t = S.tree;
    let h = header('Ерії та команди', 'Додавай, перейменовуй, закривай');
    if (S.structEdit) {
      const e = S.structEdit;
      const title = e.kind === 'area' ? (e.id ? 'Перейменувати ерію' : 'Нова ерія · ' + e.parentName) : (e.id ? 'Перейменувати команду' : 'Нова команда · ' + e.parentName);
      h += `<div class="card col"><h2>${esc(title)}</h2><label class="f"><span>Назва</span><input class="in" type="text" data-bind="structEdit.name" value="${esc(e.name)}" maxlength="60"></label>
        <div class="row"><button type="button" class="btn sec2 sm" data-a="structCancel">Скасувати</button><button type="button" class="btn sm grow" data-a="structSave">Зберегти</button></div></div>`;
    }
    if (!t) return h + loading();
    if (!t.length) return h + '<div class="empty">Немає ерій чи команд, якими ти керуєш</div>';
    const total = t.reduce((a, r) => a + r.areas.reduce((x, ar) => x + ar.teams.length, 0), 0);
    if (total > 10) h += '<input class="in" type="search" placeholder="Знайти ерію чи команду" data-live="structFind">';
    const ST_TAG = { pending: '<span class="tag warn">очікує</span>', closed: '<span class="tag">закрита</span>', active: '' };
    t.forEach((rg) => {
      h += `<div class="sec" data-region>${esc(rg.name)}</div><div class="card list" data-region-card>`;
      rg.areas.forEach((a) => {
        const open = S.structOpen[a.id];
        const q = (a.name + ' ' + a.teams.map((x) => x.name).join(' ')).toLowerCase();
        h += `<div data-q="${esc(q)}"><button type="button" class="li" data-a="structToggle" data-id="${esc(a.id)}"><span class="ic ic-teal">${icon('club', 18)}</span>
          <span class="grow"><span class="b" style="display:block">Ерія ${esc(a.name)}</span><span class="small muted">${a.teams.filter((x) => x.state === 'active').length} команд${a.teams.some((x) => x.state === 'pending') ? ' · є нові заявки' : ''}</span></span>
          <span class="muted" style="transform:rotate(${open ? 90 : 0}deg)">${icon('chev', 18)}</span></button>`;
        if (open) {
          h += '<div style="padding:4px 16px 12px;border-bottom:1px solid var(--line)">';
          if (rg.canEditAreas) h += `<button type="button" class="link-btn" data-a="structEditArea" data-id="${esc(a.id)}" data-name="${esc(a.name)}">Перейменувати ерію</button>`;
          h += a.teams.length ? a.teams.map((tm) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line);gap:8px">
              <span class="grow"><span class="b" style="display:block${tm.state === 'closed' ? ';opacity:.55' : ''}">${esc(tm.name)}</span><span class="xs muted">${tm.people} ${tm.people % 10 === 1 && tm.people % 100 !== 11 ? 'людина' : 'людей'}</span></span>${ST_TAG[tm.state]}
              ${a.canEditTeams ? `<button type="button" class="btn ghost sm" style="min-height:36px;padding:0 10px" data-a="structEditTeam" data-id="${esc(tm.id)}" data-name="${esc(tm.name)}">Назва</button>
              ${tm.state === 'active' ? `<button type="button" class="btn ghost sm" style="min-height:36px;padding:0 10px" data-a="structTeamState" data-id="${esc(tm.id)}" data-s="closed" data-name="${esc(tm.name)}">Закрити</button>`
                : `<button type="button" class="btn teal sm" style="min-height:36px;padding:0 10px" data-a="structTeamState" data-id="${esc(tm.id)}" data-s="active" data-name="${esc(tm.name)}">${tm.state === 'pending' ? 'Активувати' : 'Відкрити'}</button>`}` : ''}</div>`).join('')
            : '<div class="small muted" style="padding:8px 0">Команд ще немає</div>';
          if (a.canEditTeams) h += `<button type="button" class="btn sec2 sm" style="width:100%;margin-top:8px" data-a="structNewTeam" data-id="${esc(a.id)}" data-name="${esc(a.name)}">+ Нова команда</button>`;
          h += '</div>';
        }
        h += '</div>';
      });
      if (!rg.areas.length) h += '<div class="li small muted">Ерій ще немає</div>';
      if (rg.canEditAreas) h += `<button type="button" class="li" style="justify-content:center;color:var(--accent-text);font-weight:600" data-a="structNewArea" data-id="${esc(rg.id)}" data-name="${esc(rg.name)}">+ Нова ерія</button>`;
      h += '</div>';
    });
    h += '<div class="xs muted">Закрита команда зникає зі списків і статистики, але її дані зберігаються. Відкрити можна будь-коли.</div>';
    return h;
  };

  const LEVELS = [['nat', 'Україна'], ['region', 'Регіон'], ['area', 'Ерія'], ['team', 'Команда']];
  const byName = (a, b) => a.name.localeCompare(b.name);

  // ───────────── ЄДИНИЙ ВИБІР: регіон / ерія / команда (одна або кілька) ─────────────
  const scopeBy = () => { const m = {}; (S.me.scopes || []).forEach((x) => { m[x.key] = x; }); return m; };
  function teamsUnder(keys) {
    const by = scopeBy(), out = [];
    (S.me.scopes || []).forEach((x) => {
      if (x.level !== 'team') return;
      for (let k = x.key; k && by[k]; k = by[k].parent) if (keys.indexOf(k) >= 0) { out.push(x.unitId); break; }
    });
    return out;
  }
  const PICK_TEAMS = { known: 'knownTeams', team: 'viewTeams', finance: 'financeTeams' };
  function unitsFor(scr) {
    const sc = S.me.scopes || [];
    if (scr === 'report') return caps().isSuper ? sc : sc.filter((x) => x.depth <= 1);
    if (scr === 'event') {
      const f = S.evForm, u = f && evUnits(f)[Number(f.unit) || 0];
      if (!u) return [];
      const ok = u.level === 'nat' ? 'nat' : { region: 'r:', area: 'a:', team: 't:' }[u.level] + u.unitId;
      const by = scopeBy();
      return sc.filter((x) => { for (let k = x.key; k && by[k]; k = by[k].parent) if (k === ok) return true; return false; });
    }
    const list = caps()[PICK_TEAMS[scr]];
    if (!list) return sc;
    const by = scopeBy(), ok = {}, keep = {};
    list.forEach((id) => { ok['t:' + id] = true; });
    sc.forEach((x) => { if (x.level === 'team' && ok[x.key]) for (let k = x.key; k && by[k]; k = by[k].parent) keep[k] = true; });
    return sc.filter((x) => keep[x.key]);
  }
  function ensurePick(scr, prefer) {
    const units = unitsFor(scr), by = {};
    units.forEach((x) => { by[x.key] = x; });
    let P = S.pick[scr];
    if (!P || !P.keys.length || !P.keys.every((k) => by[k])) {
      const k0 = (prefer || []).filter((k) => by[k])[0] || (units[0] && units[0].key);
      P = S.pick[scr] = { keys: k0 ? [k0] : [], level: k0 ? by[k0].level : '', multi: P ? !!P.multi : false };
    }
    return P;
  }
  const ownTeamKeys = (scr) => { const list = caps()[PICK_TEAMS[scr]] || []; const id = (S.me.myTeams || []).map((t) => t.id).filter((x) => list.indexOf(x) >= 0)[0]; return id ? ['t:' + id] : []; };
  function setPick(scr, key) {
    const x = scopeBy()[key];
    if (!x) return;
    S.pick[scr] = { keys: [key], level: x.level, multi: S.pick[scr] ? S.pick[scr].multi && false : false };
  }
  function levelTarget(units, curKey, level) {
    const by = {};
    units.forEach((x) => { by[x.key] = x; });
    const cur = by[curKey];
    const ORD = LEVELS.map((l) => l[0]);
    let t = '';
    if (cur && ORD.indexOf(level) < ORD.indexOf(cur.level)) { for (let k = cur.parent; k && by[k]; k = by[k].parent) if (by[k].level === level) { t = k; break; } }
    else if (cur) {
      const under = (x) => { for (let k = x.parent; k && by[k]; k = by[k].parent) if (k === cur.key) return true; return false; };
      const c = units.filter((x) => x.level === level && under(x)).sort(byName); t = c[0] ? c[0].key : '';
    }
    if (!t) { const c = units.filter((x) => x.level === level).sort(byName); t = c[0] ? c[0].key : ''; }
    return t;
  }
  function picker(scr) {
    const units = unitsFor(scr), P = S.pick[scr];
    if (!P || units.length < 2) return '';
    const by = {};
    units.forEach((x) => { by[x.key] = x; });
    const lv = LEVELS.filter((l) => units.some((x) => x.level === l[0]));
    const level = P.level || (by[P.keys[0]] || {}).level;
    const pn = (x) => (by[x.parent] || {}).name || '';
    const cur = by[P.keys[0]];
    const parentKey = cur && cur.level === level && by[cur.parent] ? cur.parent : '';
    // у межах батьківської одиниці: регіони — в Україні, ерії — в регіоні, команди — в ерії
    const list = units.filter((x) => x.level === level && (parentKey ? x.parent === parentKey : !by[x.parent])).sort((a, b) => pn(a).localeCompare(pn(b)) || byName(a, b));
    const manyParents = !parentKey && new Set(list.map(pn)).size > 1;
    const pLbl = parentKey ? ({ nat: '', region: 'регіону ', area: 'ерії ' }[by[parentKey].level] || '') + (by[parentKey].level === 'nat' ? 'України' : by[parentKey].name) : '';
    let h = `<div class="col pick" id="pk-${scr}" style="gap:8px">`;
    if (lv.length > 1) h += `<div class="seg" role="tablist" aria-label="Рівень">${lv.map((l) => `<button type="button" role="tab" aria-selected="${l[0] === level}" class="${l[0] === level ? 'on' : ''}" data-a="pkLevel" data-s="${scr}" data-l="${l[0]}">${l[1]}</button>`).join('')}</div>`;
    if (list.length > 1) {
      if (list.length > 10) h += `<input class="in" type="search" style="min-height:40px" placeholder="Знайти: ${esc(((LEVELS.filter((l) => l[0] === level)[0] || [])[1] || '').toLowerCase())}…" data-live="pkFind" data-s="${scr}" aria-label="Пошук">`;
      if (pLbl && level !== 'region') h += `<div class="xs muted" style="margin:-2px 0 -4px">${esc(((LEVELS.filter((l) => l[0] === level)[0] || [])[1] || '').replace('Ерія', 'Ерії').replace('Команда', 'Команди'))} ${esc(pLbl)} · щоб змінити, обери вище «${level === 'team' ? 'Ерія' : 'Регіон'}»</div>`;
      h += `<div class="pills lvl"><button type="button" class="pill multi${P.multi ? ' on' : ''}" data-a="pkMulti" data-s="${scr}" aria-pressed="${P.multi}">${P.multi ? '☑' : '☐'} Кілька</button>${list.map((x) => {
        const on = P.keys.indexOf(x.key) >= 0;
        return `<button type="button" class="pill${on ? ' on' : ''}" data-a="pkUnit" data-s="${scr}" data-k="${esc(x.key)}" data-q="${esc((x.name + ' ' + pn(x)).toLowerCase())}" aria-pressed="${on}">${esc(x.name)}${manyParents && level !== 'region' ? `<span class="hint"> · ${esc(pn(x))}</span>` : ''}</button>`;
      }).join('')}</div>`;
      if (P.multi && P.keys.length > 1) h += `<div class="xs muted">Вибрано: ${P.keys.length} · <button type="button" class="link-btn xs" data-a="pkReset" data-s="${scr}">скинути</button></div>`;
    }
    return h + '</div>';
  }
  const pickLabel = (scr) => {
    const P = S.pick[scr], by = scopeBy();
    if (!P || !P.keys.length) return '';
    if (P.keys.length > 1) return 'Вибрано: ' + P.keys.length;
    const x = by[P.keys[0]];
    return x ? ({ nat: '', region: 'Регіон ', area: 'Ерія ', team: '' }[x.level] || '') + x.name : '';
  };
  function onPick(scr) {
    if (scr === 'stats') { S.stats.showAll = false; S.stats.showMiss = false; loadStats(); }
    if (scr === 'known') { S.known.detail = null; loadKnown(); }
    if (scr === 'team') { S.team.open = null; loadTeam(); }
    if (scr === 'finance') loadFin();
    if (scr === 'report') { S.rep.data = null; render(); }
    if (scr === 'broadcast') loadBcCount();
    if (scr === 'event') render();
  }

  // ───────────── МОЯ КОМАНДА В MyYL ─────────────
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return n + ' ' + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many); };
  const LV_PEOPLE = { nat: 'Національна команда', region: 'Команда регіону', area: 'Команда ерії', team: 'Склад команди' };
  const LV_KIDS = { nat: 'Регіони', region: 'Ерії', area: 'Команди' };
  const LV_NAME = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '' };
  const unitCounts = (u) => [plural(u.peopleCount, 'людина', 'людини', 'людей'), u.level !== 'team' ? plural(u.teamsCount, 'команда', 'команди', 'команд') : ''].filter(Boolean).join(' · ');
  VIEWS.myyl = function () {
    const m = S.myyl, d = m.data;
    if (!d) return header('Моя команда в MyYL') + loading();
    if (!d.roots.length) return header('Моя команда в MyYL') + '<div class="empty">Тут зʼявляться люди, коли в тебе буде роль у команді, ерії чи регіоні</div>';
    const units = d.units;
    if (!m.at && d.roots.length === 1) m.at = d.roots[0];
    // кілька незалежних гілок (напр., ролі у двох командах) — спершу вибір
    if (!m.at || !units[m.at]) {
      return header('Моя команда в MyYL', 'Обери гілку') + `<div class="card list">${d.roots.map((k) => unitLi(units[k])).join('')}</div>`;
    }
    const u = units[m.at];
    const chain = [];
    for (let k = m.at; k && units[k]; k = units[k].parent) chain.unshift(units[k]);
    let h = header(LV_NAME[u.level] + u.name, unitCounts(u));
    if (chain.length > 1 || d.roots.length > 1) {
      h += `<nav aria-label="Гілка" class="row wrap" style="gap:4px">${d.roots.length > 1 ? '<button type="button" class="pill" data-a="myylGo" data-k="">Усі</button><span class="muted" aria-hidden="true">›</span>' : ''}${chain.map((x, i) => i === chain.length - 1
        ? `<span class="pill on" style="display:inline-flex;align-items:center">${esc(x.name)}</span>`
        : `<button type="button" class="pill" data-a="myylGo" data-k="${esc(x.key)}">${esc(x.name)}</button><span class="muted" aria-hidden="true">›</span>`).join('')}</nav>`;
    }
    // пошук по всій гілці
    const sub = [];
    const collect = (k) => { units[k].children.forEach((ck) => { sub.push(units[ck]); collect(ck); }); };
    collect(m.at);
    if (sub.length > 6) {
      const ppl = [];
      [u].concat(sub).forEach((x) => x.people.forEach((p) => ppl.push({ p, x })));
      h += `<input class="in" type="search" placeholder="Знайти команду чи людину" data-live="myylFind" aria-label="Пошук у гілці">
        <div id="myylFindList" class="card list hidden">${sub.map((x) => `<button type="button" class="li" data-a="myylGo" data-k="${esc(x.key)}" data-q="${esc((x.name + ' ' + (x.sub || '')).toLowerCase())}">
          <span class="ic ${x.level === 'team' ? 'ic-teal' : 'ic-blue'}">${icon(x.level === 'team' ? 'club' : 'tree', 18)}</span><span class="grow"><span class="b" style="display:block">${esc(LV_NAME[x.level] + x.name)}</span><span class="small muted">${esc(x.sub || '')}</span></span>${icon('chev', 18)}</button>`).join('')}
          ${ppl.map((o) => `<button type="button" class="li" data-a="myylGo" data-k="${esc(o.x.key)}" data-q="${esc(o.p.name.toLowerCase())}"><span class="avatar">${esc(initials(o.p.name))}</span><span class="grow"><span class="b" style="display:block">${esc(o.p.name)}</span><span class="small muted">${esc(o.p.roles[0] + ' · ' + o.x.name)}</span></span></button>`).join('')}
          <div class="li small muted" data-empty>Нічого не знайдено</div></div>`;
    }
    h += '<div id="myylMain" style="display:contents">';
    // люди цього рівня
    h += `<div class="sec">${LV_PEOPLE[u.level]}</div>`;
    if (!u.people.length) h += `<div class="empty small">${u.level === 'team' ? 'У команді ще нікого немає' : 'На цьому рівні ще немає людей з ролями'}</div>`;
    else {
      h += `<div class="card list">${u.people.map((p) => {
        const open = m.open === p.tgId;
        return `<button type="button" class="li" data-a="myylPerson" data-id="${esc(p.tgId)}" aria-expanded="${open}"><span class="avatar">${esc(initials(p.name))}</span>
          <span class="grow"><span class="b" style="display:block">${esc(p.name)}</span>${p.title ? `<span class="small muted" style="display:block">${esc(p.title)}</span>` : ''}
          <span class="row wrap" style="gap:6px;margin-top:4px">${p.roles.map((r) => `<span class="tag">${esc(r)}</span>`).join('')}</span></span></button>
          ${open ? `<div style="padding:0 16px 12px;border-bottom:1px solid var(--line)">${p.username
            ? `<button type="button" class="btn sec2 sm" style="width:100%" data-a="openUrl" data-url="https://t.me/${esc(encodeURIComponent(p.username))}">${icon('tg', 18)} Написати @${esc(p.username)}</button>`
            : '<div class="small muted">Немає публічного імені в Telegram</div>'}</div>` : ''}`;
      }).join('')}</div>`;
    }
    if (u.level === 'team' && (caps().viewTeams || []).indexOf(u.id) >= 0) {
      h += `<button type="button" class="btn sec2" data-a="myylTeam" data-id="${esc(u.id)}">Анкети й ролі команди →</button>`;
    }
    // гілки нижче
    if (u.children.length) {
      h += `<div class="sec">${LV_KIDS[u.level]} · ${u.children.length}</div><div class="card list">${u.children.map((k) => unitLi(units[k])).join('')}</div>`;
    } else if (u.level !== 'team') {
      h += `<div class="sec">${LV_KIDS[u.level]}</div><div class="empty small">Поки немає</div>`;
    }
    h += '</div>';
    return h;
  };
  function unitLi(x) {
    const lead = x.people.filter((p) => p.rank <= 6).slice(0, 2).map((p) => p.name.split(/\s+/)[0]).join(', ');
    return `<button type="button" class="li" data-a="myylGo" data-k="${esc(x.key)}"><span class="ic ${x.level === 'team' ? 'ic-teal' : 'ic-blue'}">${icon(x.level === 'team' ? 'club' : 'tree', 18)}</span>
      <span class="grow"><span class="b" style="display:block">${esc(LV_NAME[x.level] + x.name)}</span><span class="small muted">${esc(unitCounts(x) + (lead ? ' · ' + lead : ''))}</span></span><span class="muted">${icon('chev', 18)}</span></button>`;
  }

  // ───────────── НАПИСАТИ ─────────────
  VIEWS.broadcast = function () {
    const b = S.bc, info = b.info;
    let h = header('Написати', 'Повідомлення прийде від бота');
    h += `<div class="card col"><div class="f"><span>Кому</span>${picker('broadcast')}${rolesField('broadcast', b)}</div>`;
    if (info && info.isSuper && (S.pick.broadcast || { keys: [] }).keys.indexOf('nat') >= 0 && !(b.roles || []).length) h += `<label class="toggle-row" style="padding:0"><span class="small">Також тим, хто ще чекає підтвердження ролі</span><input type="checkbox" data-ch="bcPending"${b.pending ? ' checked' : ''}></label>`;
    h += `<div class="small" id="bcWho">${b.count == null ? '<span class="muted">Рахую…</span>' : `Отримають: <b>${plural(b.count, 'людина', 'людини', 'людей')}</b>`}</div>
      <label class="f"><span>Текст</span><textarea id="bcText" class="in" rows="7" maxlength="3500" data-bind="bc.text" data-live="bcCount" placeholder="Наприклад: Друзі, цієї суботи молимось за табір о 19:00…">${esc(b.text)}</textarea></label>
      <div class="xs muted" id="bcCount" style="text-align:right;margin-top:-6px">${b.text.length} / 3500</div>
      <label class="toggle-row" style="padding:4px 0"><span><span class="b" style="display:block">Кнопка «Відкрити Young Life»</span><span class="small muted">під повідомленням</span></span><input type="checkbox" data-bind="bc.button"${b.button ? ' checked' : ''}></label>
      <button type="button" class="btn" data-a="bcSend"${b.sending || !b.count ? ' disabled' : ''}>${icon('send', 18)} Надіслати</button>
      <div class="xs muted">Повідомлення буде з підписом: твоє імʼя й роль.</div></div>`;
    if (!info) return h + loading();
    if (info.queued) h += `<div class="small muted">Ще доставляється: ${plural(info.queued, 'повідомлення', 'повідомлення', 'повідомлень')} (до 40 на хвилину).</div>`;
    if (info.history.length) {
      h += `<div class="sec">${info.isSuper ? 'Останні розсилки' : 'Твої останні розсилки'}</div><div class="card list">${info.history.map((x) => `<div class="li" style="align-items:flex-start;padding-top:10px;padding-bottom:10px"><span class="grow">
        <span style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line">${esc(x.text)}</span>
        <span class="xs muted" style="display:block;margin-top:4px">${info.isSuper && x.author ? esc(x.author) + ' · ' : ''}${esc(x.audience)} · ${plural(x.count, 'людина', 'людини', 'людей')} · ${esc(fmtWhen(x.created))}</span></span></div>`).join('')}</div>`;
    }
    return h;
  };
  const fmtWhen = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + MGEN[d.getMonth()] + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  // ───────────── ПІДГОТУВАТИ ЗВІТ ─────────────
  const REP_ITEMS = { club: 'Клуби', mg: 'Малі групи', kr: 'Контактна робота', known: 'Знані по імені', finance: 'Фінанси' };
  const REP_PRESETS = [['week', 'Цей тиждень'], ['lastweek', 'Минулий тиждень'], ['month', 'Цей місяць'], ['lastmonth', 'Минулий місяць'], ['q', '3 місяці'], ['year', 'З початку року'], ['custom', 'Свій період']];
  function presetRange(p) {
    const t = new Date(); t.setHours(12, 0, 0, 0);
    const dow = (t.getDay() + 6) % 7, D = 864e5;
    if (p === 'week') return [ymd(new Date(t - dow * D)), ymd(t)];
    if (p === 'lastweek') return [ymd(new Date(t - (dow + 7) * D)), ymd(new Date(t - (dow + 1) * D))];
    if (p === 'month') return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)];
    if (p === 'lastmonth') return [ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), ymd(new Date(t.getFullYear(), t.getMonth(), 0))];
    if (p === 'q') return [ymd(new Date(t.getFullYear(), t.getMonth() - 3, t.getDate())), ymd(t)];
    if (p === 'year') return [ymd(new Date(t.getFullYear(), 0, 1)), ymd(t)];
    return [S.rep.from, S.rep.to];
  }
  function initReport() {
    const r = S.rep, items = caps().reportItems || [];
    if (!Object.keys(r.items).length) items.forEach((k) => { r.items[k] = ['club', 'mg', 'kr'].indexOf(k) >= 0; });
    if (!S.pick.report) { ensurePick('report'); S.pick.report.multi = true; } else ensurePick('report');
    if (r.preset !== 'custom') { const x = presetRange(r.preset); r.from = x[0]; r.to = x[1]; }
  }
  const fmtD = (k) => { const p = String(k).split('-'); return p.length === 3 ? Number(p[2]) + '.' + p[1] + '.' + p[0] : ''; };
  VIEWS.report = function () {
    const r = S.rep, units = unitsFor('report'), items = caps().reportItems || [];
    let h = header('Підготувати звіт', caps().isSuper ? 'Будь-який регіон, ерія чи команда' : 'Свій рівень і рівень нижче');
    if (!units.length || !items.length) return h + '<div class="empty">Для твоєї ролі звіти недоступні</div>';
    const by = scopeBy();
    h += `<div class="sec">По кому · ${esc(pickLabel('report'))}</div>` + (units.length > 1 ? picker('report') : `<div class="small">${esc(pickLabel('report'))}</div>`);
    const canSplit = S.pick.report.keys.some((k) => by[k] && by[k].level !== 'team');
    if (canSplit) h += `<div class="card" style="padding:4px 16px"><label class="toggle-row"><span><span class="b" style="display:block">Розбити на рівень нижче</span><span class="small muted">окремий рядок для кожної ерії / команди</span></span><input type="checkbox" data-bind="rep.split"${r.split ? ' checked' : ''}></label></div>`;
    h += `<div class="sec">Що включити</div><div class="card list">${items.map((k) => `<label class="check"><input type="checkbox" data-ch="repItem" data-k="${k}"${r.items[k] ? ' checked' : ''}><span class="grow">${REP_ITEMS[k]}</span></label>`).join('')}</div>`;
    h += `<div class="sec">Період</div><div class="pills" style="flex-wrap:wrap">${REP_PRESETS.map((p) => `<button type="button" class="pill${r.preset === p[0] ? ' on' : ''}" data-a="repPreset" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>`;
    if (r.preset === 'custom') h += `<div class="grid2"><label class="f"><span>З</span><input class="in" type="date" data-bind="rep.from" value="${esc(r.from)}" max="${ymd(new Date())}"></label><label class="f"><span>По</span><input class="in" type="date" data-bind="rep.to" value="${esc(r.to)}" max="${ymd(new Date())}"></label></div>`;
    else h += `<div class="small muted">${fmtD(r.from)} – ${fmtD(r.to)}</div>`;
    h += `<div class="grid2"><button type="button" class="btn" data-a="repRun"${r.busy ? ' disabled' : ''}>Сформувати</button><button type="button" class="btn sec2" data-a="repSend"${r.busy ? ' disabled' : ''}>${icon('tg', 18)} Файлом у Telegram</button></div>`;
    if (r.data) h += reportOut(r.data);
    return h;
  };
  function reportOut(d) {
    let h = `<div id="repOut" class="card col" style="gap:4px"><h2>${esc(d.title)}</h2><div class="small muted">${esc(d.period)}</div></div>`;
    d.sections.forEach((sec) => {
      h += `<div class="sec">${esc(sec.label)}</div><div class="card" style="padding:0"><div class="rtab-w"><table class="rtab"><thead><tr><th></th>${sec.cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
        ${d.rows.map((row) => `<tr class="${row.child ? 'ch' : 'top'}"><td>${row.child ? '↳ ' : ''}${esc(row.name)}</td>${sec.cols.map((c) => `<td>${esc(row.values[sec.key][c.key])}</td>`).join('')}</tr>`).join('')}
        ${d.total ? `<tr class="tot"><td>${esc(d.total.name)}</td>${sec.cols.map((c) => `<td>${esc(d.total.values[sec.key][c.key])}</td>`).join('')}</tr>` : ''}</tbody></table></div></div>`;
    });
    return h + '<div class="xs muted">«—» — немає доступу до цих даних. Файл у Telegram можна переслати або роздрукувати.</div>';
  }
  function repParams() {
    const r = S.rep;
    return { units: S.pick.report.keys.slice(), items: Object.keys(r.items).filter((k) => r.items[k]), from: r.from, to: r.to, split: !!r.split };
  }
  async function repCall(send) {
    const r = S.rep, p = repParams();
    if (!p.units.length) return toast('Обери, по кому звіт', 'error');
    if (!p.items.length) return toast('Обери, що включити у звіт', 'error');
    if (!p.from || !p.to || p.to < p.from) return toast('Перевір дати періоду', 'error');
    p.send = !!send;
    r.busy = true; render();
    const res = await run(() => api('report', p));
    r.busy = false;
    if (res) { r.data = res; if (send) toast('Звіт надіслано в чат з ботом', 'success'); }
    render();
    if (res && !send) { const o = document.getElementById('repOut'); if (o && o.scrollIntoView) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  // ───────────── ВСТАНОВИТИ ─────────────
  VIEWS.install = function () {
    let h = header('Встановити MyYL', 'Окремий застосунок на телефоні');
    if (IS_INSTALLED) return h + '<div class="card col"><h2>✅ Застосунок встановлено</h2><div class="muted">Ти зараз у ньому. Відкривай MyYL з іконки на головному екрані.</div></div>';
    h += `<div class="card col"><h2>Окремий застосунок</h2><div class="small muted">Відкривається з іконки YL на весь екран, без Telegram. Дані ті самі. Вхід — один раз через Telegram.</div>`;
    if (IN_TG) {
      h += `<button type="button" class="btn" data-a="openApp">Відкрити в браузері</button>
        <button type="button" class="btn sec2 sm" data-a="copyApp">Скопіювати посилання</button>`;
    } else if (S.installEvt) h += '<button type="button" class="btn" data-a="pwaInstall">Встановити</button>';
    h += `</div>
      <div class="sec">iPhone</div><div class="card rows small">
        <div class="kv"><span>1</span><span style="text-align:left;flex:1">Відкрий посилання в <b>Safari</b>${IN_TG ? ' (якщо відкрилось у Telegram — натисни значок компаса чи «Відкрити в Safari»)' : ''}</span></div>
        <div class="kv"><span>2</span><span style="text-align:left;flex:1">Натисни «Поділитися» <b>⎋</b> унизу екрана</span></div>
        <div class="kv"><span>3</span><span style="text-align:left;flex:1">«На початковий екран» → «Додати»</span></div>
        <div class="kv"><span>4</span><span style="text-align:left;flex:1">Відкрий MyYL з іконки → «Увійти через Telegram»</span></div></div>
      <div class="sec">Android</div><div class="card rows small">
        <div class="kv"><span>1</span><span style="text-align:left;flex:1">Відкрий посилання в <b>Chrome</b></span></div>
        <div class="kv"><span>2</span><span style="text-align:left;flex:1">Меню <b>⋮</b> → «Встановити застосунок» або «Додати на головний екран»</span></div>
        <div class="kv"><span>3</span><span style="text-align:left;flex:1">Відкрий MyYL з іконки → «Увійти через Telegram»</span></div></div>`;
    if (IN_TG && tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
      h += `<div class="sec">Або ярлик Telegram</div><div class="card col"><div class="small muted">Іконка на головному екрані, яка відкриває MyYL через Telegram.</div>
        <button type="button" class="btn sec2" data-a="installHome"${S.homeSt === 'added' ? ' disabled' : ''}>${S.homeSt === 'added' ? 'Ярлик уже додано ✓' : 'Додати ярлик Telegram'}</button></div>`;
    }
    return h;
  };

  // ───────────── ЩЕ ─────────────
  VIEWS.more = function () {
    const c = caps();
    const items = sectionTiles().map((t) => ({ k: t.k, label: t.label, sub: t.sub, icon: t.icon, ic: t.ic }));
    if (c.approve) items.push({ k: 'requests', label: 'Заявки', sub: 'підтвердження ролей', icon: 'requests', ic: 'ic-blue', badge: me().pendingCount });
    if ((c.reportItems || []).length) items.push({ k: 'report', label: 'Підготувати звіт', sub: 'за період, по регіону, ерії чи команді', icon: 'doc', ic: 'ic-yellow' });
    items.push({ k: 'profile', label: 'Мій профіль', sub: myLine(), icon: 'profile', ic: 'ic-soft' });
    items.push({ k: 'install', label: IS_INSTALLED ? 'Застосунок MyYL' : 'Встановити на головний екран', sub: IS_INSTALLED ? 'встановлено ✓' : 'окремий застосунок з іконкою YL', icon: 'phoneApp', ic: 'ic-teal' });
    return header('Ще') + `<div class="card list">${items.map((m) => `<button type="button" class="li" ${m.a ? `data-a="${m.a}"` : `data-a="tabGo" data-s="${m.k}"`}><span class="ic ${m.ic}">${icon(m.icon, 18)}</span>
      <span class="grow"><span class="b" style="display:block">${esc(m.label)}</span><span class="small muted">${esc(m.sub)}</span></span>${m.badge ? `<span class="badge">${m.badge}</span>` : ''}<span class="muted">${icon('chev', 18)}</span></button>`).join('')}</div>`;
  };

  // ───────────── ЗНАНІ ПО ІМЕНІ ─────────────
  const STAGES = [['meet', 'Хочу познайомитись'], ['friends', 'Дружимо'], ['grow', 'Допомагаю зростати в вірі'], ['own', 'Йдуть самі']];
  const stageLabel = (k) => (STAGES.filter((x) => x[0] === k)[0] || STAGES[0])[1];
  const knownSelTeams = () => { const P = S.pick.known; const ok = caps().knownTeams || []; return P ? teamsUnder(P.keys).filter((id) => ok.indexOf(id) >= 0) : []; };
  // куди можна додавати: лише свої команди (+ «Без команди»)
  function knownTargets() {
    const edit = caps().knownEditTeams || [];
    const ids = S.known.mode === 'browse' ? knownSelTeams().filter((id) => edit.indexOf(id) >= 0) : edit.slice();
    const out = ids.map((id) => ({ id: id, name: teamName(id) }));
    if (S.known.mode !== 'browse' && caps().knownNoTeam) out.push({ id: '', name: 'Без команди' });
    return out;
  }
  VIEWS.known = function () {
    const k = S.known;
    if (k.bulk) return knownBulkView();
    if (k.edit) return knownEditView();
    if (k.detail) return knownDetailView();
    const canBrowse = (caps().knownTeams || []).length > 0;
    let h = header('Знані по імені', k.mode === 'browse' ? pickLabel('known') : 'Ті, кого вніс ти');
    if (canBrowse) h += `<div class="seg" role="tablist"><button type="button" role="tab" class="${k.mode !== 'browse' ? 'on' : ''}" data-a="knownMode" data-m="mine">Мій список</button><button type="button" role="tab" class="${k.mode === 'browse' ? 'on' : ''}" data-a="knownMode" data-m="browse">Регіон · ерія · команда</button></div>`;
    if (k.mode === 'browse') h += picker('known');
    const targets = knownTargets();
    if (targets.length) h += `<div class="grid2"><button type="button" class="btn sm" data-a="knownNew">${icon('plus', 18)} Одного</button><button type="button" class="btn sec2 sm" data-a="knownBulkOpen">Додати списком</button></div>`;
    else if (k.mode === 'browse') h += '<div class="xs muted">Додавати знаних у команду можуть лише її учасники. Тут можна переглядати.</div>';
    h += `<label class="sr" for="kq">Пошук</label><input id="kq" class="in" type="search" placeholder="Пошук за іменем" data-live="knownSearch">`;
    if (!k.list) return h + loading();
    const list = k.list;
    const multiTeam = new Set(list.map((p) => p.teamId)).size > 1;
    const word = (n) => n % 10 === 1 && n % 100 !== 11 ? 'підліток' : 'підлітків';
    h += `<div class="small muted">${list.length} ${word(list.length)} · за них молимось${list.length ? ' · гортай колонки вбік →' : ''}</div>`;
    if (!list.length) return h + `<div class="note small">${k.mode === 'browse' ? 'Тут поки нікого немає.' : 'У твоєму списку ще нікого немає. Додай тих, кого знаєш по імені, — по одному або одразу списком.'}</div>`;
    h += `<div class="board" id="knownBoard">${STAGES.map((st) => {
      const col = list.filter((p) => (p.stage || 'meet') === st[0]);
      return `<section class="col-st st-${st[0]}" aria-label="${esc(st[1])}"><div class="col-h"><span>${esc(st[1])}</span><span class="n">${col.length}</span></div>
        ${col.length ? col.map((p) => `<button type="button" class="kcard" data-a="knownOpen" data-id="${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}"><span class="b" style="display:block">${esc(p.name)}</span>
          <span class="xs muted">${esc([multiTeam ? p.team : '', p.grade, p.leader ? 'веде ' + p.leader : ''].filter(Boolean).join(' · ') || (p.phone ? p.phone : (p.canEdit ? 'додай контакти' : '')))}</span></button>`).join('') : '<div class="xs muted" style="padding:6px 4px">Поки нікого</div>'}</section>`;
    }).join('')}</div>`;
    return h;
  };
  const knownItem = () => (S.known.list || []).filter((x) => x.id === S.known.detail)[0];
  function stagePills(cur, action, disabled) {
    return `<div class="pills" style="flex-wrap:wrap">${STAGES.map((st) => `<button type="button" class="pill st-pill st-${st[0]}${cur === st[0] ? ' on' : ''}" data-a="${action}" data-st="${st[0]}" aria-pressed="${cur === st[0]}"${disabled ? ' disabled' : ''}>${esc(st[1])}</button>`).join('')}</div>`;
  }
  function knownDetailView() {
    const p = knownItem();
    if (!p) return header('Знані по імені') + '<div class="empty">Не знайдено</div>';
    let h = header(p.name, [p.team, p.grade, p.school].filter(Boolean).join(' · '), p.canEdit ? `<button type="button" class="icon-btn" data-a="knownEdit" aria-label="Редагувати"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg></button>` : '');
    h += `<div class="card col" style="gap:8px"><div class="small muted">Етап${p.canEdit ? '' : ' · змінюють учасники команди'}</div>${stagePills(p.stage || 'meet', 'knownStage', !p.canEdit)}</div>`;
    const tel = String(p.phone || '').replace(/[^\d+]/g, '');
    const ig = String(p.ig || '').replace(/^@/, '');
    if (tel || ig) h += `<div class="grid2">${tel ? `<button type="button" class="btn sec2" data-a="openUrl" data-url="tel:${esc(tel)}">${icon('phone', 18)} Подзвонити</button>` : ''}${ig ? `<button type="button" class="btn sec2" data-a="openUrl" data-url="https://instagram.com/${esc(encodeURIComponent(ig))}">Instagram</button>` : ''}</div>`;
    const rows = [['Телефон', p.phone], ['Instagram', p.ig], ['День народження', p.bday ? fmtDay(p.bday) : ''], ['Школа', p.school], ['Клас', p.grade], ['Веде', p.leader]].filter((x) => x[1]);
    h += `<div class="card rows">${rows.map((x) => `<div class="kv"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('') || '<div class="kv"><span>Контактів поки немає</span><span></span></div>'}</div>`;
    if (!rows.length && p.canEdit) h += `<button type="button" class="btn sec2" data-a="knownEdit">Додати контакти й дані</button>`;
    if (p.note) h += `<div class="note"><div class="sec" style="margin:0 0 6px">Молитовна нотатка</div><div style="white-space:pre-line">${esc(p.note)}</div></div>`;
    return h;
  }
  function teamPick(bind, cur) {
    const t = knownTargets();
    if (t.length < 2) return '';
    return `<label class="f"><span>Команда</span><select class="in" data-bind="${bind}">${t.map((x) => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`;
  }
  function knownEditView() {
    const e = S.known.edit;
    return header(e.id ? 'Редагувати' : 'Новий підліток', e.id ? e.team || '' : '') + `<div class="card col">
      ${e.id ? '' : teamPick('known.edit.teamId', e.teamId)}
      <label class="f"><span>Імʼя та прізвище *</span><input class="in" type="text" data-bind="known.edit.name" value="${esc(e.name)}"></label>
      <div class="f"><span>Етап</span>${stagePills(e.stage || 'meet', 'knownEditStage')}</div>
      <div class="grid2"><label class="f"><span>Телефон</span><input class="in" type="tel" data-bind="known.edit.phone" value="${esc(e.phone)}"></label>
      <label class="f"><span>Instagram</span><input class="in" type="text" data-bind="known.edit.ig" value="${esc(e.ig)}" placeholder="@нік"></label></div>
      <div class="grid2"><label class="f"><span>День народження</span><input class="in" type="date" data-bind="known.edit.bday" value="${esc(e.bday)}"></label>
      <label class="f"><span>Клас</span><input class="in" type="text" data-bind="known.edit.grade" value="${esc(e.grade)}" placeholder="9-А"></label></div>
      <label class="f"><span>Школа</span><input class="in" type="text" data-bind="known.edit.school" value="${esc(e.school)}"></label>
      <label class="f"><span>Хто з лідерів веде</span><input class="in" type="text" data-bind="known.edit.leader" value="${esc(e.leader)}"></label>
      <label class="f"><span>Молитовна нотатка</span><textarea class="in" rows="3" data-bind="known.edit.note">${esc(e.note)}</textarea></label>
      <button type="button" class="btn" data-a="knownSave">Зберегти</button>
      ${e.id ? '<button type="button" class="btn ghost" data-a="knownArchive">Прибрати зі списку</button>' : ''}</div>
      <div class="xs muted">${e.teamId || e.id ? 'Знаних команди бачать команда, ерія й регіон.' : '«Без команди» — твій особистий список, його бачиш лише ти.'} Переконайся, що батьки погодились.</div>`;
  }
  function knownBulkView() {
    const b = S.known.bulk;
    const n = String(b.text).split(/[\n;,]+/).map((x) => x.trim()).filter((x) => x.length > 1).length;
    return header('Додати списком', knownTargets().length < 2 ? (b.teamId ? teamName(b.teamId) : 'Без команди') : '') + `<div class="card col">
      ${teamPick('known.bulk.teamId', b.teamId)}
      <label class="f"><span>Імена — кожне з нового рядка</span><textarea id="bulkText" class="in" rows="9" data-bind="known.bulk.text" data-live="knownBulkCount" placeholder="Марко Іванюк&#10;Софія Бойко&#10;Денис Ткач">${esc(b.text)}</textarea></label>
      <div class="xs muted" id="bulkCount">${n ? 'Імен: ' + n : 'Можна вставити список з нотаток чи чату. Номери й крапки на початку рядків приберуться самі.'}</div>
      <div class="f"><span>Куди додати</span>${stagePills(b.stage, 'knownBulkStage')}</div>
      <button type="button" class="btn" data-a="knownBulkSave">Додати</button></div>
      <div class="xs muted">Ті, хто вже є у списку, пропускаються. Контакти й дані кожного можна дописати потім — натисни на імʼя.</div>`;
  }
  const fmtDay = (s) => { const d = parseDay(s); return isNaN(d) ? s : d.getDate() + ' ' + MGEN[d.getMonth()]; };

  // ───────────── СКЛАД КОМАНДИ ─────────────
  VIEWS.team = function () {
    const t = S.team;
    let h = header('Склад команди', pickLabel('team'));
    h += picker('team');
    if (!t.list) return h + loading();
    if (!t.list.length) return h + '<div class="empty">Тут ще нікого немає</div>';
    const groups = [];
    t.list.forEach((p) => { const g = groups[groups.length - 1]; if (g && g.id === p.teamId) g.list.push(p); else groups.push({ id: p.teamId, name: p.team, list: [p] }); });
    h += groups.map((g) => `${groups.length > 1 ? `<div class="sec">${esc(g.name)} · ${g.list.length}</div>` : ''}<div class="card list">${g.list.map((p) => {
      const oid = p.tgId + '|' + p.teamId, open = t.open === oid, pr = p.profile || {};
      return `<button type="button" class="li" data-a="teamOpen" data-id="${esc(oid)}"><span class="avatar">${esc(initials(p.name))}</span>
        <span class="grow"><span class="b" style="display:block">${esc(p.name)}</span><span class="row wrap" style="gap:6px;margin-top:4px">${p.roles.map((r) => `<span class="tag">${esc(r.label)}</span>`).join('')}</span></span></button>
        ${open ? `<div style="padding:0 16px 12px;border-bottom:1px solid var(--line)">${[['Telegram', p.username ? '@' + p.username : ''], ['Телефон', pr.phone], ['Дата народження', pr.bday ? fmtDay(pr.bday) : ''], ['Рік покаяння', pr.repent], ['Рік хрещення', pr.baptism], ['Рік ЛПYL', pr.lpyl], ['Відповідальності', pr.resp]].filter((x) => x[1]).map((x) => `<div class="kv small"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('') || '<div class="small muted">Анкету ще не заповнено</div>'}
          ${p.roles.filter((r) => r.canRemove).map((r) => `<button type="button" class="btn ghost sm" style="margin-top:8px;width:100%" data-a="roleRemove" data-id="${esc(r.id)}" data-label="${esc(r.label)}" data-name="${esc(p.name)}">Зняти роль «${esc(r.label)}»</button>`).join('')}</div>` : ''}`;
    }).join('')}</div>`).join('') + '<div class="xs muted">Анкету кожен заповнює у своєму профілі.</div>';
    return h;
  };

  // ───────────── ФІНАНСИ ─────────────
  const FIN_FIELDS = [['office', 'Дав офіс'], ['church', 'Дала церква'], ['team', 'Зібрали командою'], ['spent', 'Витратили']];
  const finBalance = (c) => (Number(c.prev) || 0) + (Number(c.office) || 0) + (Number(c.church) || 0) + (Number(c.team) || 0) - (Number(c.spent) || 0);
  const monthLabel = (k) => { const p = String(k).split('-').map(Number); return MFULL[p[1] - 1] + ' ' + p[0]; };
  VIEWS.finance = function () {
    const f = S.fin;
    let h = header('Фінансовий звіт', pickLabel('finance'));
    h += picker('finance');
    h += `<label class="f"><span>Місяць</span><input class="in" type="month" value="${esc(f.month)}" max="${ym(new Date())}" data-ch="finMonth"></label>`;
    if (!f.data) return h + loading();
    if (f.data.mode === 'overview') {
      const T = f.data.total;
      h += `<div class="kpis"><div class="card kpi"><div class="v">${T.done} з ${T.teams}</div><div class="l">Команд здали за ${esc(monthLabel(f.month).toLowerCase())}</div></div><div class="card kpi"><div class="v">${nf(T.balance)} ₴</div><div class="l">Залишок разом</div></div>
        <div class="card kpi"><div class="v">${nf(T.inc)} ₴</div><div class="l">Надійшло</div></div><div class="card kpi"><div class="v">${nf(T.spent)} ₴</div><div class="l">Витрачено</div></div></div>`;
      h += `<div class="card" style="padding:0"><div class="rtab-w"><table class="rtab"><thead><tr><th>Команда</th><th>Надійшло</th><th>Витрачено</th><th>Залишок</th></tr></thead><tbody>${f.data.rows.map((r) => `<tr class="top"><td>${esc(r.name)}<div class="xs muted" style="font-weight:400">${esc(r.area)}</div></td>${r.done ? `<td>${nf(r.inc)}</td><td>${nf(r.spent)}</td><td>${nf(r.balance)}</td>` : '<td colspan="3" style="text-align:center"><span class="tag warn">ще не здали</span></td>'}</tr>`).join('')}</tbody></table></div></div>`;
      return h + '<div class="xs muted">Щоб побачити деталі команди, вибери її вгорі.</div>';
    }
    if (!f.cur) return h + loading();
    const c = f.cur;
    const inSt = f.data.canEdit ? ' style="width:120px;min-height:40px;text-align:right"' : ' readonly tabindex="-1" style="width:120px;min-height:40px;text-align:right;background:transparent;border-color:transparent"';
    if (!f.data.canEdit) h += '<div class="note small">Фінансовий звіт вносять лише Капітан і Адмін команди. Ти можеш його переглядати.</div>';
    h += `<div class="card rows"><div class="kv"><span>Попередній залишок</span><span><input class="in"${inSt} type="number" inputmode="decimal" value="${esc(c.prev)}" data-bind="fin.cur.prev" data-live="finCalc"> ₴</span></div>
      ${FIN_FIELDS.map((x) => `<div class="kv"><label for="fin_${x[0]}" style="color:var(--text);font-weight:500">${x[1]}</label><span><input id="fin_${x[0]}" class="in"${inSt} type="number" inputmode="decimal" value="${esc(c[x[0]])}" data-bind="fin.cur.${x[0]}" data-live="finCalc"> ₴</span></div>`).join('')}
      <div class="kv"><span style="color:var(--text);font-weight:700">Залишок</span><span style="font:800 22px Manrope,Inter,sans-serif"><span id="finBal">${nf(finBalance(c))}</span> ₴</span></div></div>`;
    if (f.data.canEdit) h += `<button type="button" class="btn" data-a="finSave">Зберегти ${esc(monthLabel(f.month).toLowerCase())}</button>`;
    if (f.data.history.length) {
      h += `<div class="sec">Попередні місяці</div><div class="card list">${f.data.history.map((r) => `<div class="li" style="min-height:52px"><span class="grow">${esc(monthLabel(r.month))}</span><span class="b">залишок ${nf(r.balance)} ₴</span></div>`).join('')}</div>`;
    }
    return h;
  };

  // ───────────── ЗАЯВКИ ─────────────
  VIEWS.requests = function () {
    let h = header('Заявки', 'Тут — заявки, які чекають саме на тебе');
    if (!S.reqs) return h + loading();
    const main = S.reqs.filter((p) => p.primary), other = S.reqs.filter((p) => !p.primary);
    if (!main.length) h += '<div class="empty">Нових заявок немає</div>';
    const card = (p) => `<div class="card col"><div class="row"><span class="avatar" style="background:rgba(76,110,245,.18)">${esc(initials(p.name))}</span>
      <div class="grow"><div class="b">${esc(p.name)}</div><div class="small muted">${p.username ? '@' + esc(p.username) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</div></div></div>
      <div class="col" style="gap:4px">${p.roles.map((r) => `<label class="check" style="border:0;border-radius:12px;background:var(--soft);min-height:46px;padding:0 12px"><input type="checkbox" data-ch="reqToggle" data-id="${esc(r.id)}"${S.reqSel[r.id] ? ' checked' : ''}>
        <span class="grow"><span class="b">${esc(r.label)}</span> <span class="small muted">· ${esc(r.unitName)}</span></span></label>`).join('')}</div>
      <div class="row"><button type="button" class="btn sec2 sm" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="0">Відхилити</button>
      <button type="button" class="btn teal sm grow" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="1">Підтвердити вибрані</button></div></div>`;
    h += main.map(card).join('');
    if (other.length) {
      h += `<button type="button" class="btn ghost" data-a="reqOthers">${S.reqOthers ? 'Сховати' : 'Показати'} інші заявки, які ти теж можеш підтвердити (${other.length})</button>`;
      if (S.reqOthers) h += '<div class="xs muted">Їх уже отримали відповідальні на своєму рівні. Втручайся, лише якщо потрібно.</div>' + other.map(card).join('');
    }
    return h;
  };

  // ───────────── ПРОФІЛЬ ─────────────
  VIEWS.profile = function () {
    if (S.roleReq) return roleReqView();
    const m = me(), p = S.profile || {};
    let h = header('Мій профіль', '', IN_TG ? '' : '<button type="button" class="btn ghost sm" data-a="logout">Вийти</button>');
    h += `<div class="row">${myAvatar()}<div><div style="font:800 20px Manrope,Inter,sans-serif">${esc(m.user.name)}</div><div class="small muted">${esc(myLine())}${m.user.username ? ' · @' + esc(m.user.username) : ''}</div></div></div>`;
    h += `<div class="sec">Мої ролі</div><div class="card list">${(m.roles || []).map((r) => `<div class="li" style="min-height:52px"><span class="grow b">${esc(r.label)}</span><span class="small muted">${esc(r.unitName)}</span>${r.status !== 'активна' ? '<span class="tag warn">очікує</span>' : ''}</div>`).join('')}
      <button type="button" class="li" style="justify-content:center;color:var(--accent-text);font-weight:600" data-a="roleReqOpen">${activeRoles().some((r) => r.key === 'SUPER') ? '+ Додати собі роль' : '+ Попросити ще роль'}</button></div>`;
    const F = [['name', 'Імʼя та прізвище', 'text'], ['title', 'Статус під іменем (необовʼязково)', 'text'], ['phone', 'Телефон', 'tel'], ['email', 'Gmail (для доступу до таблиць)', 'email'], ['bday', 'Дата народження', 'date'], ['repent', 'Рік покаяння', 'number'], ['baptism', 'Рік хрещення', 'number'], ['lpyl', 'Рік проходження ЛПYL', 'number'], ['resp', 'Відповідальності на клубі', 'text']];
    h += `<div class="sec">Анкета</div><div class="card col">${F.map((f) => `<label class="f"><span>${f[1]}</span><input class="in" type="${f[2]}" ${f[2] === 'number' ? 'inputmode="numeric" min="1950" max="2100"' : ''} value="${esc(p[f[0]] || '')}" data-bind="profile.${f[0]}"></label>`).join('')}
      <button type="button" class="btn" data-a="profileSave">Зберегти анкету</button></div>`;
    const N = (m.profile && m.profile.notif) || {};
    const NL = [['bc', 'Розсилки від інших', 'повідомлення «Написати» від керівників'], ['remind', 'Нагадування про звіти', 'якщо щось не внесено за тиждень'], ['events', 'Нагадування про події', 'на які ти записався']].concat(caps().approve ? [['requests', 'Нові заявки на ролі', 'коли хтось чекає твого підтвердження']] : []);
    h += `<div class="sec">Сповіщення в боті</div><div class="card list">${NL.map((x) => `<label class="check" style="min-height:58px"><span class="grow"><span class="b" style="display:block">${x[1]}</span><span class="xs muted">${x[2]}</span></span><input type="checkbox" data-ch="notifToggle" data-k="${x[0]}"${N[x[0]] !== false ? ' checked' : ''}></label>`).join('')}</div>`;
    return h;
  };

  // ── вибір «де» + ролі (реєстрація і «попросити ще роль») ──
  function whereFields(o, prefix) {
    const st = struct();
    const areas = st.areas.filter((a) => a.regionId === o.regionId);
    const teams = st.teams.filter((t) => t.areaId === o.areaId);
    let h = `<div class="grid2"><label class="f"><span>Регіон</span><select class="in" data-ch="${prefix}Region"><option value="">Обери…</option>${st.regions.map((r) => `<option value="${esc(r.id)}"${r.id === o.regionId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Ерія</span><select class="in" data-ch="${prefix}Area"${o.regionId ? '' : ' disabled'}><option value="">Обери…</option>${areas.map((a) => `<option value="${esc(a.id)}"${a.id === o.areaId ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label></div>`;
    if (o.regionId && !areas.length) h += '<div class="note small">У цьому регіоні ще не додано ерій. Якщо ти служиш на рівні регіону — переходь далі й обери роль регіону. Якщо в команді — напиши адміну, щоб додав твою ерію.</div>';
    if (o.areaId) {
      h += `<div class="f"><span>Команда</span></div><div class="card list">${teams.map((t) => `<label class="check"><input type="radio" name="${prefix}Team" data-ch="${prefix}Team" value="${esc(t.id)}"${t.id === o.teamId ? ' checked' : ''}><span class="grow">${esc(t.name)}</span></label>`).join('')}
        <label class="check"><input type="radio" name="${prefix}Team" data-ch="${prefix}Team" value="__new"${o.teamId === '__new' ? ' checked' : ''}><span class="grow">Моєї команди немає</span><span class="xs muted">створимо нову</span></label></div>`;
      if (o.teamId === '__new') h += `<label class="f"><span>Назва нової команди</span><input class="in" type="text" data-bind="${prefix === 'reg' ? 'reg' : 'roleReq'}.newTeam" value="${esc(o.newTeam)}"></label>`;
    }
    return h;
  }
  function roleFields(o, prefix) {
    const defs = me().roleDefs.filter((r) => r.key !== 'SUPER');
    const team = defs.filter((r) => r.level === 'team');
    const upper = defs.filter((r) => r.level !== 'team');
    const HINT = { OFFICE: 'поки що лише календар офісу' };
    const box = (r) => `<label class="check"><input type="checkbox" data-ch="${prefix}Role" data-k="${r.key}"${o.roles[r.key] ? ' checked' : ''}><span class="grow b" style="font-weight:500">${esc(r.label)}</span>${HINT[r.key] ? `<span class="xs muted">${HINT[r.key]}</span>` : ''}</label>`;
    let h = `<div class="card list">${team.map(box).join('')}</div>`;
    h += `<label class="toggle-row"><span class="b" style="font-weight:500">Я служу на рівні ерії, регіону чи країни</span><input type="checkbox" data-ch="${prefix}Upper"${o.upper ? ' checked' : ''}></label>`;
    if (o.upper) h += `<div class="card list">${upper.map(box).join('')}</div>`;
    const needMail = Object.keys(o.roles).some((k) => o.roles[k] && roleDef(k) && roleDef(k).rank <= 6);
    if (needMail) h += `<label class="f"><span>Gmail — на нього відкриється доступ до таблиць на Диску</span><input class="in" type="email" data-bind="${prefix === 'reg' ? 'reg' : 'roleReq'}.email" value="${esc(o.email)}" placeholder="name@gmail.com"></label>`;
    return h;
  }
  function rolePayload(o) {
    return {
      name: o.name, phone: o.phone, email: o.email, regionId: o.regionId, areaId: o.areaId,
      teamId: o.teamId === '__new' ? '' : o.teamId, newTeamName: o.teamId === '__new' ? o.newTeam : '',
      roles: Object.keys(o.roles).filter((k) => o.roles[k]),
    };
  }
  function roleReqView() {
    const o = S.roleReq;
    return header('Попросити ще роль') + `<div class="col">${whereFields(o, 'rr')}</div><div class="sec">Яка роль</div>${roleFields(o, 'rr')}
      <button type="button" class="btn" data-a="roleReqSend">Надіслати заявку</button>`;
  }

  // ───────────── РЕЄСТРАЦІЯ ─────────────
  VIEWS.onboarding = function () {
    const r = S.reg;
    let h = `<div class="row between"><div class="row">${canBack() ? `<button type="button" class="icon-btn" data-a="back" aria-label="Назад">${icon('back')}</button>` : '<div class="logo">YL</div>'}<b>Young Life Україна</b></div><span class="small muted">Крок ${r.step} з 3</span></div>
      <div class="track"><i style="width:${Math.round(r.step / 3 * 100)}%;background:var(--accent);border-radius:4px"></i></div>`;
    if (r.step === 1) {
      h += `<div><h1>Привіт! Давай познайомимось</h1><p class="muted" style="margin:6px 0 0">Тут звіти, знані по імені, календар і статистика твоєї команди. Паролі не потрібні — тебе впізнає Telegram.</p></div>
        <label class="f"><span>Імʼя та прізвище</span><input class="in" type="text" data-bind="reg.name" value="${esc(r.name)}" autocomplete="name"></label>
        <label class="f"><span>Телефон</span><input class="in" type="tel" data-bind="reg.phone" value="${esc(r.phone)}" placeholder="+380…" autocomplete="tel"></label>
        ${tg && tg.requestContact ? `<button type="button" class="btn ghost" data-a="regContact">${icon('phone', 18)} Взяти номер з Telegram</button>` : ''}
        <button type="button" class="btn" data-a="regNext">Далі</button>`;
    }
    if (r.step === 2) h += `<div><h1>Де ти служиш?</h1><p class="muted" style="margin:6px 0 0">Обери регіон, ерію та команду.</p></div>${whereFields(r, 'reg')}<button type="button" class="btn" data-a="regNext">Далі</button>`;
    if (r.step === 3) h += `<div><h1>Яка твоя роль?</h1><p class="muted" style="margin:6px 0 0">Можна обрати кілька. Ролі підтверджує капітан команди або хтось вище.</p></div>${roleFields(r, 'reg')}<button type="button" class="btn" data-a="regSubmit">Надіслати заявку</button>`;
    return h;
  };

  VIEWS.pending = function () {
    const m = me();
    return `<div class="row"><div class="logo">YL</div><b>Young Life Україна</b></div>
      <div style="width:72px;height:72px;border-radius:36px;background:rgba(20,184,166,.16);color:var(--teal);display:flex;align-items:center;justify-content:center;margin-top:16px">${icon('check', 36)}</div>
      <h1>Заявку надіслано</h1><p class="muted" style="margin:0">Її розгляне ${esc(m.approvers || 'керівництво')}. Щойно доступ відкриють — бот напише тобі в Telegram.</p>
      <div class="card list">${(m.roles || []).map((r) => `<div class="li" style="min-height:52px"><span class="grow b">${esc(r.label)}</span><span class="small muted">${esc(r.unitName)}</span><span class="tag warn">очікує</span></div>`).join('')}</div>
      <button type="button" class="btn sec2" data-a="reload">Оновити</button>`;
  };

  // ───────────── ДІЇ ─────────────
  const A = {};
  function thank() { S.thanks = true; haptic('success'); render(); }
  A.thanksClose = () => { try { tg.HapticFeedback.impactOccurred('medium'); } catch (e) { /* ок */ } S.thanks = false; render(); };
  A.reload = () => { $app.innerHTML = loading(); S.me = null; loadMe(); };
  A.back = back;
  A.tab = (d) => go(d.s);
  A.tabGo = (d) => go(d.s);
  A.goStats = (d) => go('stats', { scope: d.scope, cat: d.cat });
  A.openUrl = (d) => { if (/^https?:/.test(d.url) && tg && tg.openLink) tg.openLink(d.url); else location.href = d.url; };

  // внесення
  A.openAdd = (d) => go('add', { type: d.type, teamId: d.team });
  A.addType = (d) => { initAdd(d.type, S.add && S.add.teamId); render(); };
  A.addMode = (d) => { S.add.mode = d.m; render(); };
  A.step = (d) => { const a = S.add; a[d.k] = Math.max(0, Math.round(((Number(a[d.k]) || 0) + Number(d.d)) * 2) / 2); render(); };
  A.addTeam = (d, el) => { S.add.teamId = el.value; S.add.att = {}; render(); if (S.add.mark && !S.knownCache[S.add.teamId]) A.addMark(null, { checked: true }); };
  A.addMark = async (d, el) => {
    S.add.mark = el.checked; render();
    if (el.checked && !S.knownCache[S.add.teamId]) {
      try { S.knownCache[S.add.teamId] = await api('knownList', { teamId: S.add.teamId }); } catch (e) { toast(e.message); S.add.mark = false; }
      render();
    }
  };
  A.addAtt = (d, el) => { S.add.att[d.id] = el.checked; S.add.teens = Object.keys(S.add.att).filter((k) => S.add.att[k]).length; render(); };
  A.addSave = async () => {
    const a = S.add;
    if (!a.teamId) return toast('Обери команду');
    if (a.type === 'kr' && !(Number(a.hours) > 0)) return toast('Вкажи кількість годин або натисни «не було»');
    if (a.type !== 'kr' && !(Number(a.teens) > 0)) return toast('Вкажи кількість учасників або натисни «не було»');
    const payload = {
      type: a.type, teamId: a.teamId, mode: a.mode, date: a.date, teens: a.teens, newT: a.newT, leaders: a.leaders, hours: a.hours,
      topic: a.topic, note: a.note, attendees: a.mark ? Object.keys(a.att).filter((k) => a.att[k]) : [],
    };
    // одразу дякуємо й позначаємо як здане, а зберігаємо у фоні
    const backup = { add: JSON.parse(JSON.stringify(a)), week: JSON.parse(JSON.stringify(S.me.week)) };
    weekMark(a.type, a.teamId, 'ok', a.type === 'kr' ? Number(a.hours) || 0 : 0);
    go('home'); thank();
    try { const res = await api('saveReport', payload); S.me.week = res.week; LS.set('me', S.me); if (S.screen === 'home' && !S.thanks) render(); }
    catch (e) { S.me.week = backup.week; S.add = backup.add; S.thanks = false; S.screen = 'add'; render(); toast('Не вдалося зберегти: ' + e.message, 'error'); }
  };
  A.markNone = async (d) => {
    const backup = JSON.parse(JSON.stringify(S.me.week));
    weekMark(d.type, d.team, 'none', 0);
    if (S.screen === 'add') go('home');
    thank();
    try { const res = await api('saveReport', { type: d.type, teamId: d.team, mode: 'none' }); S.me.week = res.week; LS.set('me', S.me); if (S.screen === 'home' && !S.thanks) render(); }
    catch (e) { S.me.week = backup; S.thanks = false; render(); toast('Не вдалося зберегти: ' + e.message, 'error'); }
  };
  function weekMark(type, teamId, status, hours) {
    ((S.me.week && S.me.week.items) || []).forEach((it) => {
      if (it.type !== type || it.teamId !== teamId) return;
      if (status === 'ok') { it.status = 'ok'; it.hours = (Number(it.hours) || 0) + hours; } else if (it.status !== 'ok') it.status = 'none';
    });
  }

  // календар
  A.openEv = (d) => { if (S.screen !== 'calendar') go('calendar', { ev: d.id }); else { S.ev = d.id; render(); window.scrollTo(0, 0); } };
  A.evFilter = (d) => { S.evFilter = d.l; render(); };
  const ownerKeyOf = (u) => (!u ? '' : u.level === 'nat' ? 'nat' : { region: 'r:', area: 'a:', team: 't:' }[u.level] + u.unitId);
  function resetEvPick(keys) {
    const f = S.evForm, u = evUnits(f)[Number(f.unit) || 0], by = scopeBy();
    const ks = (keys && keys.length ? keys : [ownerKeyOf(u)]).filter((k) => by[k]);
    S.pick.event = { keys: ks, level: ks[0] ? by[ks[0]].level : '', multi: ks.length > 1 };
  }
  A.evNew = () => { S.evForm = { unit: 0, title: '', date: ymd(new Date(Date.now() + 7 * 864e5)), end: '', time: '', place: '', desc: '', roles: [] }; resetEvPick(); render(); };
  A.evOwner = () => { resetEvPick(); render(); };
  A.evDate = () => { const f = S.evForm; if (f.end && f.end < f.date) f.end = ''; const e = document.querySelector('[data-bind="evForm.end"]'); if (e) { e.min = f.date; e.value = f.end; } };
  A.evSave = async () => {
    const f = S.evForm, u = evUnits(f)[Number(f.unit) || 0];
    if (!u) return;
    if (String(f.title).trim().length < 2) return toast('Вкажи назву події');
    if (f.end && f.end < f.date) return toast('Дата кінця раніше за дату початку');
    const res = await run(() => api('eventSave', { id: f.id || '', roles: f.roles || [], aud: (S.pick.event && S.pick.event.keys) || [], level: u.level, unitId: u.unitId, title: f.title, date: f.date, end: f.end || '', time: f.time, place: f.place, desc: f.desc }), f.id ? 'Зміни збережено' : 'Подію додано: ' + u.label);
    if (res) { const wasId = f.id; S.evForm = null; S.events = null; if (!wasId) S.ev = null; render(); loadEvents(); }
  };
  A.rsvp = async (d) => {
    const going = d.g === '1';
    const res = await run(() => api('rsvp', { id: d.id, going: going }), going ? 'Записали! Бот нагадає перед подією' : 'Скасовано');
    if (res) { const e = S.events.filter((x) => x.id === d.id)[0]; if (e) { e.isGoing = going; e.going += going ? 1 : -1; } render(); }
  };
  A.evCal = (d) => {
    const e = S.events.filter((x) => x.id === d.id)[0];
    if (!e) return;
    const day = e.date.replace(/-/g, '');
    let dates;
    if (e.end) dates = day + '/' + ymd(new Date(parseDay(e.end).getTime() + 864e5)).replace(/-/g, '');
    else if (/^\d{1,2}:\d{2}$/.test(e.time || '')) { const t = e.time.split(':'); const st = day + 'T' + pad(Number(t[0])) + t[1] + '00'; const en = day + 'T' + pad(Math.min(23, Number(t[0]) + 2)) + t[1] + '00'; dates = st + '/' + en; }
    else { const nd = new Date(parseDay(e.date).getTime() + 864e5); dates = day + '/' + ymd(nd).replace(/-/g, ''); }
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Europe/Kiev&text=' + encodeURIComponent(e.title) + '&dates=' + dates +
      '&location=' + encodeURIComponent(e.place || '') + '&details=' + encodeURIComponent((e.desc || '') + '\n\nYoung Life Україна · ' + e.levelLabel);
    A.openUrl({ url: url });
  };
  const audChanged = (scr) => { if (scr === 'broadcast') loadBcCount(); else render(); };
  A.audGroup = (d) => { const f = audState(d.s); f.roles = audRoles(d.g); f.audOpen = false; audChanged(d.s); };
  A.audCustom = (d) => { audState(d.s).audOpen = true; render(); };
  A.audRole = (d) => { const f = audState(d.s); const r = f.roles = (f.roles || []).slice(); const i = r.indexOf(d.k); if (i >= 0) r.splice(i, 1); else r.push(d.k); audChanged(d.s); };
  A.evEdit = (d) => {
    const e = (S.events || []).filter((x) => x.id === d.id)[0]; if (!e) return;
    const f = { id: e.id, title: e.title, date: e.date, end: e.end || '', time: e.time || '', place: e.place || '', desc: e.desc || '', roles: (e.roles || []).slice(), audOpen: false };
    let units = caps().eventUnits || [];
    let idx = units.findIndex((x) => x.level === e.level && x.unitId === e.unitId);
    if (idx < 0) { f.extraUnit = { level: e.level, unitId: e.unitId, label: e.levelLabel }; idx = units.length; }
    f.unit = idx; S.evForm = f; resetEvPick(e.aud || []); render(); window.scrollTo(0, 0);
  };
  A.evDelete = (d) => {
    const doIt = async () => { const res = await run(() => api('eventDelete', { id: d.id }), 'Подію видалено'); if (res) { S.ev = null; S.events = null; render(); loadEvents(); } };
    if (tg && tg.showConfirm) tg.showConfirm('Видалити подію?', (ok) => { if (ok) doIt(); }); else if (confirm('Видалити подію?')) doIt();
  };

  // статистика
  A.statsScope = (d, el) => { S.stats.scope = el.value; loadStats(); };
  A.statsCat = (d) => { S.stats.cat = d.c; loadStats(); };
  A.statsPeriod = (d) => { S.stats.period = d.p; loadStats(); };
  A.statsDrill = (d) => { setPick('stats', d.k); S.stats.find = false; S.stats.showAll = false; S.stats.showMiss = false; loadStats(); window.scrollTo(0, 0); };
  A.statsFindToggle = () => { S.stats.find = !S.stats.find; render(); const i = document.getElementById('statsFindIn'); if (i) i.focus(); };
  A.statsFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('#statsFindList [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0)); };
  A.statsRowFind = (d, el) => {
    const q = el.value.trim().toLowerCase();
    if (q && !S.stats.showAll) { S.stats.showAll = true; render(); const i = document.querySelector('[data-live="statsRowFind"]'); if (i) { i.value = el.value; i.focus(); } }
    document.querySelectorAll('#brkList [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0));
  };
  A.statsSort = (d) => { S.stats.sort = d.s; render(); };
  A.statsShowAll = () => { S.stats.showAll = !S.stats.showAll; render(); };
  A.statsShowMiss = () => { S.stats.showMiss = !S.stats.showMiss; render(); };

  // структура
  A.structToggle = (d) => { S.structOpen[d.id] = !S.structOpen[d.id]; render(); };
  A.structFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('[data-q]').forEach((x) => { if (x.closest('#app')) x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0); }); };
  A.structNewArea = (d) => { S.structEdit = { kind: 'area', parentId: d.id, parentName: d.name, name: '' }; render(); window.scrollTo(0, 0); };
  A.structEditArea = (d) => { S.structEdit = { kind: 'area', id: d.id, name: d.name }; render(); window.scrollTo(0, 0); };
  A.structNewTeam = (d) => { S.structEdit = { kind: 'team', parentId: d.id, parentName: d.name, name: '' }; S.structOpen[d.id] = true; render(); window.scrollTo(0, 0); };
  A.structEditTeam = (d) => { S.structEdit = { kind: 'team', id: d.id, name: d.name }; render(); window.scrollTo(0, 0); };
  A.structCancel = () => { S.structEdit = null; render(); };
  A.structSave = async () => {
    const e = S.structEdit;
    if (String(e.name || '').trim().length < 2) return toast('Вкажи назву');
    const res = await run(() => e.kind === 'area'
      ? api('areaSave', { id: e.id || '', regionId: e.parentId, name: e.name })
      : api('teamSave', e.id ? { id: e.id, name: e.name } : { areaId: e.parentId, name: e.name }), 'Збережено');
    if (res) { S.structEdit = null; await refreshMe(); loadTree(); }
  };
  A.structTeamState = (d) => {
    const doIt = async () => { const res = await run(() => api('teamSave', { id: d.id, state: d.s }), d.s === 'closed' ? 'Команду закрито' : 'Команда активна'); if (res) { await refreshMe(); loadTree(); } };
    if (d.s === 'closed') { const m = 'Закрити команду «' + d.name + '»? Дані збережуться, її можна буде відкрити знову.'; if (tg && tg.showConfirm) tg.showConfirm(m, (ok) => { if (ok) doIt(); }); else if (confirm(m)) doIt(); }
    else doIt();
  };
  async function refreshMe() { try { const m = await api('me'); S.me = m; } catch (e) { /* лишаємо старе */ } }
  A.nudge = async (d) => { const r = await run(() => api('nudge', { units: S.pick.stats.keys, type: d.type })); if (r) toast('Нагадування надіслано: ' + r.sent, 'success'); };

  // знані
  A.knownTeam = (d, el) => { S.known.teamId = el.value; loadKnown(); };
  A.knownMine = (d) => { S.known.mine = d.v === '1'; render(); window.scrollTo(0, 0); };
  A.knownSearch = (d, el) => {
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#knownBoard .kcard').forEach((li) => { li.classList.toggle('hidden', !!q && li.dataset.name.indexOf(q) < 0); });
  };
  A.knownOpen = (d) => { S.known.detail = d.id; render(); window.scrollTo(0, 0); };
  const firstTarget = () => { const t = knownTargets(); const mine = (S.me.myTeams || []).map((x) => x.id); return (t.filter((x) => mine.indexOf(x.id) >= 0)[0] || t[0] || { id: '' }).id; };
  A.knownMode = (d) => { if (S.known.mode === d.m) return; S.known.mode = d.m; if (d.m === 'browse') ensurePick('known', ownTeamKeys('known')); loadKnown(); };
  A.knownNew = () => { S.known.edit = { id: '', teamId: firstTarget(), stage: 'meet', name: '', phone: '', ig: '', bday: '', school: '', grade: '', leader: first(), note: '' }; render(); window.scrollTo(0, 0); };
  A.knownEdit = () => { const p = knownItem(); if (p && p.canEdit) { S.known.edit = Object.assign({}, p); render(); window.scrollTo(0, 0); } };
  A.knownEditStage = (d) => { S.known.edit.stage = d.st; render(); };
  A.knownStage = async (d) => {
    const p = knownItem(); if (!p || !p.canEdit || p.stage === d.st) return;
    const old = p.stage; p.stage = d.st; render(); haptic('success');
    const res = await run(() => api('knownStage', { id: p.id, stage: d.st }));
    if (!res) { p.stage = old; render(); } else { S.knownMem = {}; toast('Етап: ' + stageLabel(d.st)); }
  };
  A.knownSave = async () => {
    const e = S.known.edit;
    if (String(e.name).trim().length < 2) return toast('Вкажи імʼя');
    const res = await run(() => api('knownSave', { teamId: e.id ? e.teamId : (e.teamId || ''), item: e }), 'Збережено');
    if (res) { S.known.edit = null; S.known.detail = e.id ? e.id : null; S.knownMem = {}; loadKnown(true); }
  };
  A.knownArchive = () => {
    const e = S.known.edit;
    const doIt = async () => { const res = await run(() => api('knownArchive', { id: e.id }), 'Прибрано зі списку'); if (res) { S.known.edit = null; S.known.detail = null; S.knownMem = {}; loadKnown(true); } };
    if (tg && tg.showConfirm) tg.showConfirm('Прибрати підлітка зі списку знаних?', (ok) => { if (ok) doIt(); }); else if (confirm('Прибрати зі списку?')) doIt();
  };
  A.knownBulkOpen = () => { S.known.bulk = { text: '', stage: 'meet', teamId: firstTarget() }; render(); window.scrollTo(0, 0); const t = document.getElementById('bulkText'); if (t) t.focus(); };
  A.knownBulkStage = (d) => { S.known.bulk.stage = d.st; render(); };
  A.knownBulkCount = (d, el) => { const n = el.value.split(/[\n;,]+/).map((x) => x.trim()).filter((x) => x.length > 1).length; const c = document.getElementById('bulkCount'); if (c) c.textContent = n ? 'Імен: ' + n : ''; };
  A.knownBulkSave = async () => {
    const b = S.known.bulk;
    if (!String(b.text).trim()) return toast('Впиши імена — кожне з нового рядка', 'error');
    const res = await run(() => api('knownBulk', { teamId: b.teamId || '', names: b.text, stage: b.stage }));
    if (res) { toast('Додано: ' + res.added, 'success'); S.known.bulk = null; S.knownMem = {}; loadKnown(true); }
  };
  A.pkLevel = (d) => { const P = S.pick[d.s]; if (!P || P.level === d.l) return; const t = levelTarget(unitsFor(d.s), P.keys[0], d.l); P.level = d.l; P.keys = t ? [t] : []; onPick(d.s); };
  A.pkUnit = (d) => {
    const P = S.pick[d.s]; if (!P) return;
    if (P.multi) { const i = P.keys.indexOf(d.k); if (i >= 0) { if (P.keys.length > 1) P.keys.splice(i, 1); else return; } else P.keys.push(d.k); }
    else { if (P.keys.length === 1 && P.keys[0] === d.k) return; P.keys = [d.k]; }
    onPick(d.s);
  };
  A.pkMulti = (d) => { const P = S.pick[d.s]; if (!P) return; P.multi = !P.multi; const was = P.keys.length; if (!P.multi) P.keys = P.keys.slice(0, 1); if (was !== P.keys.length) onPick(d.s); else render(); };
  A.pkReset = (d) => { const P = S.pick[d.s]; if (!P) return; P.keys = P.keys.slice(0, 1); onPick(d.s); };
  A.pkFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('#pk-' + d.s + ' [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0)); };

  // склад
  const homeOk = () => !!(tg && tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0'));
  A.installHome = () => {
    if (S.homeSt === 'added') return toast('Застосунок уже є на головному екрані');
    if (homeOk()) { try { tg.addToHomeScreen(); } catch (e) { toast('Не вдалося. Спробуй ще раз.'); } return; }
    const msg = 'Твоя версія Telegram ще не вміє додавати застосунки на головний екран. Онови Telegram в App Store / Google Play і спробуй знову.';
    if (tg && tg.showAlert) tg.showAlert(msg); else toast(msg);
  };
  A.hideInstall = () => { LS.set('hideInstall', 1); render(); };
  A.openApp = () => { try { tg.openLink(APP_LINK, { try_browser: IS_IOS ? 'safari' : 'chrome' }); } catch (e) { tg.openLink(APP_LINK); } };
  A.copyApp = async () => { try { await navigator.clipboard.writeText(APP_LINK); toast('Посилання скопійовано', 'success'); } catch (e) { toast(APP_LINK); } };
  A.pwaInstall = async () => { const ev = S.installEvt; if (!ev) return; ev.prompt(); try { await ev.userChoice; } catch (e) { /* ок */ } S.installEvt = null; render(); };
  A.logout = () => { if (confirm('Вийти з MyYL на цьому пристрої?')) logout(false); };
  A.loginStart = () => loginStart();
  A.loginCancel = () => { S.login = null; clearTimeout(S.loginTimer); renderLogin(); };
  A.repUnit = (d, el) => { S.rep.units[d.k] = el.checked; S.rep.data = null; render(); };
  A.repItem = (d, el) => { S.rep.items[d.k] = el.checked; S.rep.data = null; };
  A.repPreset = (d) => { const r = S.rep; r.preset = d.p; if (d.p !== 'custom') { const x = presetRange(d.p); r.from = x[0]; r.to = x[1]; } r.data = null; render(); };
  A.repRun = () => repCall(false);
  A.repSend = () => repCall(true);
  A.myylGo = (d) => { const f = document.querySelector('[data-live="myylFind"]'); if (f) f.value = ''; S.myyl.at = d.k || null; S.myyl.open = null; render(); window.scrollTo(0, 0); };
  A.myylPerson = (d) => { S.myyl.open = S.myyl.open === d.id ? null : d.id; render(); };
  A.myylTeam = (d) => { setPick('team', 't:' + d.id); go('team'); };
  A.myylFind = (d, el) => {
    const q = el.value.trim().toLowerCase();
    const list = document.getElementById('myylFindList'), main = document.getElementById('myylMain');
    if (!list) return;
    list.classList.toggle('hidden', !q); if (main) main.classList.toggle('hidden', !!q);
    let n = 0;
    list.querySelectorAll('[data-q]').forEach((x) => { const hit = !!q && x.dataset.q.indexOf(q) >= 0; x.classList.toggle('hidden', !hit); if (hit) n++; });
    const e = list.querySelector('[data-empty]'); if (e) e.classList.toggle('hidden', n > 0);
  };
  A.bcPending = (d, el) => { S.bc.pending = el.checked; loadBcCount(); };
  A.bcCount = (d, el) => { const c = document.getElementById('bcCount'); if (c) c.textContent = el.value.length + ' / 3500'; };
  A.bcSend = () => {
    const b = S.bc;
    if (b.text.trim().length < 2) return toast('Напиши текст повідомлення', 'error');
    if (!b.count) return toast('За цим вибором ще нікого немає', 'error');
    const doIt = async () => {
      b.sending = true; render();
      const r = await run(() => api('broadcast', Object.assign(bcParams(), { text: b.text, button: b.button })));
      b.sending = false;
      if (r) { toast('Надіслано: ' + plural(r.sent, 'людина', 'людини', 'людей'), 'success'); b.text = ''; loadBc(); } else render();
    };
    const msg = 'Надіслати повідомлення ' + plural(b.count, 'людині', 'людям', 'людям') + ' (' + pickLabel('broadcast') + ')?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  A.teamTeam = (d, el) => { S.team.teamId = el.value; loadTeam(); };
  A.teamOpen = (d) => { S.team.open = S.team.open === d.id ? null : d.id; render(); };
  A.roleRemove = (d) => {
    const doIt = async () => { const res = await run(() => api('removeRole', { roleId: d.id }), 'Роль знято'); if (res) loadTeam(); };
    const msg = 'Зняти роль «' + d.label + '» з ' + d.name + '?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };

  // фінанси
  A.finTeam = (d, el) => { S.fin.teamId = el.value; loadFin(); };
  A.finMonth = (d, el) => { if (/^\d{4}-\d{2}$/.test(el.value)) { S.fin.month = el.value; loadFin(); } };
  A.finCalc = () => { const b = document.getElementById('finBal'); if (b) b.textContent = nf(finBalance(S.fin.cur)); };
  A.finSave = async () => { const c = S.fin.cur; const res = await run(() => api('financeSave', Object.assign({ teamId: S.fin.teamId, month: S.fin.month }, c)), 'Фінансовий звіт збережено'); if (res) loadFin(); };

  // заявки
  A.reqOthers = () => { S.reqOthers = !S.reqOthers; render(); };
  A.reqToggle = (d, el) => { S.reqSel[d.id] = el.checked; };
  A.reqDecide = async (d) => {
    const p = S.reqs.filter((x) => x.tgId === d.tg)[0];
    if (!p) return;
    const approve = d.ok === '1';
    const ids = approve ? p.roles.filter((r) => S.reqSel[r.id]).map((r) => r.id) : p.roles.map((r) => r.id);
    if (!ids.length) return toast('Обери хоча б одну роль');
    const res = await run(() => api('decide', { roleIds: ids, approve: approve }), approve ? p.name + ': доступ відкрито' : 'Заявку відхилено');
    if (res) {
      if (approve && ids.length < p.roles.length) await run(() => api('decide', { roleIds: p.roles.filter((r) => ids.indexOf(r.id) < 0).map((r) => r.id), approve: false }));
      loadReqs();
    }
  };

  // профіль
  A.notifToggle = async (d, el) => {
    const n = Object.assign({}, (S.me.profile && S.me.profile.notif) || {}); n[d.k] = el.checked;
    const res = await run(() => api('saveProfile', { notif: n }), el.checked ? 'Сповіщення увімкнено' : 'Сповіщення вимкнено');
    if (res) { S.me.profile = res; LS.set('me', S.me); } else el.checked = !el.checked;
  };
  A.profileSave = async () => { const res = await run(() => api('saveProfile', Object.assign({}, S.profile, { notif: undefined })), 'Анкету збережено'); if (res) { S.me.profile = res; S.me.user.name = res.name || S.me.user.name; S.me.user.title = res.title || ''; render(); } };
  A.roleReqOpen = () => {
    const t = (S.me.myTeams || [])[0];
    S.roleReq = { regionId: t ? t.regionId : '', areaId: t ? t.areaId : '', teamId: t ? t.id : '', newTeam: '', roles: {}, upper: false, email: (S.me.profile || {}).email || '' };
    render();
  };
  A.roleReqSend = async () => {
    const p = rolePayload(S.roleReq);
    if (!p.roles.length) return toast('Обери роль');
    const res = await run(() => api('requestRoles', p));
    if (res) { toast(res.status === 'active' ? 'Роль додано' : 'Заявку надіслано', 'success'); S.roleReq = null; S.me = await api('me'); S.profile = Object.assign({}, S.me.profile || {}); render(); }
  };
  ['reg', 'rr'].forEach((pre) => {
    const obj = () => (pre === 'reg' ? S.reg : S.roleReq);
    A[pre + 'Region'] = (d, el) => { const o = obj(); o.regionId = el.value; o.areaId = ''; o.teamId = ''; render(); };
    A[pre + 'Area'] = (d, el) => { const o = obj(); o.areaId = el.value; o.teamId = ''; render(); };
    A[pre + 'Team'] = (d, el) => { obj().teamId = el.value; render(); };
    A[pre + 'Role'] = (d, el) => { obj().roles[d.k] = el.checked; render(); };
    A[pre + 'Upper'] = (d, el) => { obj().upper = el.checked; render(); };
  });

  // реєстрація
  A.regContact = () => {
    try {
      tg.requestContact((ok, res) => {
        const ph = ok && res && res.responseUnsafe && res.responseUnsafe.contact && res.responseUnsafe.contact.phone_number;
        if (ph) { S.reg.phone = (ph[0] === '+' ? '' : '+') + ph; render(); } else if (ok) toast('Номер надіслано. Можеш вписати його й вручну.');
      });
    } catch (e) { toast('Впиши номер вручну'); }
  };
  A.regNext = () => {
    const r = S.reg;
    if (r.step === 1 && String(r.name).trim().length < 2) return toast('Вкажи імʼя та прізвище');
    if (r.step === 2) {
      if (!r.regionId) return toast('Обери регіон');
      if (!r.areaId && struct().areas.some((a) => a.regionId === r.regionId)) return toast('Обери ерію');
      if (r.teamId === '__new' && String(r.newTeam).trim().length < 2) return toast('Впиши назву нової команди');
    }
    r.step++; render(); window.scrollTo(0, 0);
  };
  A.regSubmit = async () => {
    const r = S.reg, p = rolePayload(r);
    if (!p.roles.length) return toast('Обери хоча б одну роль');
    const teamRole = p.roles.some((k) => roleDef(k).level === 'team');
    if (teamRole && !r.teamId) { r.step = 2; render(); return toast('Обери команду'); }
    const res = await run(() => api('register', p));
    if (res) { S.me = await api('me'); S.screen = S.me.status === 'active' ? 'home' : 'pending'; haptic('success'); render(); }
  };

  // ───────────── ПОДІЇ DOM ─────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (fn) fn(el.dataset, el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.live && A[el.dataset.live]) A[el.dataset.live](el.dataset, el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.bind && el.tagName === 'SELECT') setPath(el.dataset.bind, el.value);
    if (el.dataset.ch && A[el.dataset.ch]) A[el.dataset.ch](el.dataset, el);
  });

  // ───────────── ВХІД В ОКРЕМИЙ ЗАСТОСУНОК ─────────────
  const AUTH_URL = (p) => API_URL.replace(/\/+$/, '') + '/auth/' + p;
  function logout(expired) {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ок */ }
    SESSION = null; S.me = null;
    renderLogin(expired ? 'Сесія завершилась. Увійди ще раз.' : '');
  }
  function renderLogin(msg) {
    const L = S.login;
    $app.innerHTML = `<main class="main no-nav login"><div class="login-box">
      <img src="icons/icon-192.png" alt="" class="login-logo" width="88" height="88">
      <h1 style="font-size:28px;margin:0">MyYL</h1><div class="muted">Young Life Україна</div>
      ${msg ? `<div class="note small">${esc(msg)}</div>` : ''}
      ${L ? `<div class="card col" style="gap:10px;text-align:center"><div class="spin" style="margin:0 auto"></div>
          <div class="b">Чекаю підтвердження в Telegram…</div>
          <div class="small muted">У чаті з ботом натисни <b>«Старт»</b> (або «Запустити»), а потім повернись сюди.</div>
          <a class="btn sec2 sm" href="${esc(L.link)}" target="_blank" rel="noopener">Не відкрився Telegram? Натисни тут</a>
          <button type="button" class="link-btn" data-a="loginCancel">Скасувати</button></div>`
        : `<button type="button" class="btn" data-a="loginStart">${icon('tg', 20)} Увійти через Telegram</button>
          <div class="small muted" style="text-align:center">Відкриється наш бот у Telegram — підтвердь вхід одним натисканням. Пароль не потрібен.</div>`}
      ${!IS_INSTALLED ? `<div class="xs muted" style="text-align:center;margin-top:8px">Порада: додай MyYL на головний екран — ${IS_IOS ? 'Safari → «Поділитися» → «На початковий екран»' : 'меню браузера → «Встановити застосунок»'}.</div>` : ''}
    </div></main>`;
  }
  async function loginStart() {
    let r;
    try { r = await (await fetch(AUTH_URL('start'), { method: 'POST', body: '{}' })).json(); } catch (e) { return renderLogin('Немає звʼязку із сервером. Перевір інтернет.'); }
    if (!r || !r.ok) return renderLogin('Не вдалося почати вхід. Спробуй ще раз.');
    S.login = { nonce: r.nonce, link: r.link, until: Date.now() + 10 * 60 * 1000 };
    renderLogin();
    // відкриваємо Telegram: спершу застосунок, а посилання — запасний варіант на екрані
    try { window.location.href = r.app; } catch (e) { /* ок */ }
    pollLogin();
  }
  async function pollLogin() {
    const L = S.login;
    clearTimeout(S.loginTimer);
    if (!L) return;
    if (Date.now() > L.until) { S.login = null; return renderLogin('Час на вхід минув. Спробуй ще раз.'); }
    try {
      const r = await (await fetch(AUTH_URL('poll'), { method: 'POST', body: JSON.stringify({ nonce: L.nonce }) })).json();
      if (r.ok && r.session) {
        SESSION = { token: r.session, user: r.user };
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch (e) { /* ок */ }
        S.login = null;
        location.replace(location.pathname + '?app=1');
        return;
      }
      if (!r.ok) { S.login = null; return renderLogin(r.message || 'Спробуй ще раз.'); }
    } catch (e) { /* немає мережі — спробуємо ще */ }
    S.loginTimer = setTimeout(pollLogin, 2500);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.login) pollLogin(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; if (S.screen === 'install') render(); });

  // ───────────── СТАРТ ─────────────
  function start() {
    if (!IN_TG) {
      document.documentElement.classList.add('standalone');
      if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ок */ } }
      if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
      tg.onEvent('themeChanged', () => document.documentElement.classList.toggle('dark', tg.colorScheme === 'dark'));
      if (!SESSION || !SESSION.token) return renderLogin();
    }
    tg.ready();
    tg.expand();
    if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
    tg.onEvent('themeChanged', () => document.documentElement.classList.toggle('dark', tg.colorScheme === 'dark'));
    try { tg.setHeaderColor('secondary_bg_color'); } catch (e) { /* старий Telegram */ }
    tg.BackButton.onClick(back);
    if (!IN_TG) { if (!API_URL) return; return loadMe(); }
    S.homeSt = '';
    if (tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
      try { tg.checkHomeScreenStatus((st) => { S.homeSt = st; if (S.screen === 'more' || S.screen === 'install') render(); }); } catch (e) { /* ок */ }
      tg.onEvent('homeScreenAdded', () => { S.homeSt = 'added'; toast('Готово! Іконка YL тепер на головному екрані', 'success'); if (S.screen === 'more') render(); });
    } else S.homeSt = 'unsupported';
    if (!API_URL) {
      $app.innerHTML = '<main class="main no-nav"><div class="card col"><h2>Застосунок ще налаштовується</h2><div class="muted">Адресу сервера не вказано в config.js.</div></div></main>';
      return;
    }
    loadMe();
  }
  start();
})();
