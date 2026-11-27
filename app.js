/* Young Life Україна · Mini App · інтерфейс */
(function () {
  'use strict';

  const realTg = window.Telegram && window.Telegram.WebApp;
  const IN_TG = !!(realTg && realTg.initData);
  const SESSION_KEY = 'yl:session';
  const APP_LINK = 'https://vovayounglife.github.io/MyYL-mini-app/?app=1';
  const BOT_NAME = 'MyYL_mini_app';
  const MAIN_LINK = 'https://t.me/' + BOT_NAME + '?startapp=home';
  const HOME_LINK = MAIN_LINK + '&addToHomeScreen';
  // відкрито як головний застосунок бота (лише тоді Telegram дозволяє іконку на головному екрані)
  const IS_MAIN = !!(realTg && realTg.initDataUnsafe && realTg.initDataUnsafe.start_param);
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
  // основна адреса сервера і запасна (якщо мережа не пускає workers.dev); робоча запамʼятовується
  const API_HOSTS = [(window.YL_CONFIG || {}).API_URL || '', (window.YL_CONFIG || {}).API_URL_BACKUP || 'https://myyl-api.pages.dev'].filter(Boolean);
  let API_URL = API_HOSTS[0] || '';
  try { const h = localStorage.getItem('yl:apiHost'); if (h && API_HOSTS.indexOf(h) >= 0) API_URL = h; } catch (e) { /* ок */ }
  const switchHost = () => {
    const i = API_HOSTS.indexOf(API_URL), next = API_HOSTS[(i + 1) % API_HOSTS.length];
    if (!next || next === API_URL) return false;
    API_URL = next;
    try { localStorage.setItem('yl:apiHost', API_URL); } catch (e) { /* ок */ }
    return true;
  };
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
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    ws: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
    tree: 'M12 3v6M12 9H5v5M12 9h7v5M3 14h4v4H3zM17 14h4v4h-4zM10 14h4v4h-4zM12 9v5',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    task: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
    poll: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    res: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    tg: 'M21.5 4.5L2.5 11.7l6 2.2 2.3 6.6 3.4-4.1 5.3 3.9z',
    idea: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z',
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
    stats: { scope: null, cat: 'overview', period: 'month', data: null, loading: false, from: '', to: '' },
    dirs: { data: null, period: 'month', from: '', to: '' },
    res: { data: null, form: null },
    club: { teamId: '', data: null, f: null, dirty: false, pick: null }, bank: { data: null, cats: {}, pick: null, tag: 'all', q: '' },
    inst: { data: null, q: '', showNot: false },
    known: { teamId: null, list: null, mode: 'mine', detail: null, edit: null, bulk: null }, pick: {}, knownMem: {},
    team: { teamId: null, list: null, open: null },
    fin: { teamId: null, month: ym(new Date()), data: null, cur: null },
    thanks: false, reqs: null, reqSel: {}, tree: null, structOpen: {}, structEdit: null,
    reqTitle: {},
    reg: { step: 1, titles: {}, name: '', phone: '', email: '', regionId: '', areaId: '', teamId: '', newTeam: '', roles: {}, upper: false },
    roleReq: null, profile: null,
    myyl: { data: null, at: null, open: null },
    rep: { units: {}, items: {}, preset: 'month', from: '', to: '', split: false, data: null, busy: false },
    perms: { unit: '', role: '', data: null, busy: false },
    fx: { teamId: '', data: null, kind: 'in', src: 'team', amount: '', note: '', date: '', busy: false },
    tasks: { data: null, tab: 'mine', open: null, form: null, note: '' },
    polls: { data: null, tab: 'open', form: null, sel: {}, showNot: {} },
    bc: { info: null, text: '', roles: [], pending: false, count: null, button: true, sending: false },
  };
  let toastTimer = null;

  // ───────────── локальний кеш: показуємо останні дані миттєво, оновлюємо у фоні ─────────────
  const UID = (() => { try { return String(tg.initDataUnsafe.user.id); } catch (e) { return 'x'; } })();
  // «Відобразити як для»: роль, очима якої дивимось (лише на цю сесію; кеш телефону не чіпаємо)
  let VIEW_AS = null;
  try { VIEW_AS = JSON.parse(sessionStorage.getItem('yl:viewAs') || 'null'); } catch (e) { VIEW_AS = null; }
  // «Переглянути, як» (лише власник застосунку): працюємо від імені іншої людини — лише на цю сесію
  let ACT_AS = null;
  try { ACT_AS = JSON.parse(sessionStorage.getItem('yl:actAs') || 'null'); } catch (e) { ACT_AS = null; }
  let VIEW_ROLES = null;
  try { VIEW_ROLES = JSON.parse(sessionStorage.getItem('yl:viewRoles') || 'null'); } catch (e) { VIEW_ROLES = null; }
  const LS = {
    get(k) { if (VIEW_AS || ACT_AS) return null; try { return JSON.parse(localStorage.getItem('yl1:' + UID + ':' + k)); } catch (e) { return null; } },
    set(k, v) { if (VIEW_AS || ACT_AS) return; try { localStorage.setItem('yl1:' + UID + ':' + k, JSON.stringify(v)); } catch (e) { /* повна памʼять — не страшно */ } },
  };
  const statsKey = () => [((S.pick && S.pick.stats) || { keys: [] }).keys.join(','), S.stats.cat, S.stats.period, S.stats.period === 'custom' ? S.stats.from + '_' + S.stats.to : ''].join('|');
  // чи можна зараз перемалювати екран, не збивши людині введення
  const safeToRender = () => !(S.screen === 'ws' && S.ws && wsBusyForm()) && !['add', 'onboarding', 'finance', 'profile', 'broadcast', 'report'].includes(S.screen) && !S.evForm && !S.tasks.form && !S.polls.form && !S.res.form && !S.known.edit && !S.known.bulk && !S.structEdit && !S.thanks && !(S.screen === 'club' && S.club.dirty);

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
  // збій запиту — коротко на сервер для діагностики (без особистих даних)
  function clog(o) {
    try {
      const d = JSON.stringify(Object.assign({ v: ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1], tg: IN_TG ? (tg.platform || '') + ' ' + (tg.version || '') : 'pwa', ua: navigator.userAgent.slice(0, 140), on: navigator.onLine }, o));
      const u = API_URL.replace(/\/$/, '') + '/clog';
      if (navigator.sendBeacon && navigator.sendBeacon(u, d)) return;
      fetch(u, { method: 'POST', body: d, keepalive: true }).catch(() => {});
    } catch (e) { /* ок */ }
  }
  const READ_ACTIONS = /^(ws|wsCard|wsPage|wsProfiles|wsAnalytics|wsPeopleFind|me|knownList|stats|dirStats|installStats|teamMembers|events|tasks|polls|resList|requests|financeGet|finTx|structureTree|myylTree|permsGet|audCount|claimFind|broadcastInfo)$/;
  const INFLIGHT = {};
  const HOST_FAIL = {};
  async function api(action, data) {
    const auth = IN_TG ? { initData: tg.initData } : { session: SESSION && SESSION.token };
    const body = JSON.stringify(Object.assign(auth, { action: action, data: data || {} }, VIEW_AS ? { viewAs: VIEW_AS } : {}, ACT_AS ? { actAs: ACT_AS.id } : {}));
    // однакові запити перегляду, що вже в дорозі, не дублюємо
    const read = READ_ACTIONS.test(action);
    if (read && INFLIGHT[body]) return INFLIGHT[body];
    const p = apiRun(action, body, read);
    if (read) { INFLIGHT[body] = p; p.then(() => { delete INFLIGHT[body]; }, () => { delete INFLIGHT[body]; }); }
    return p;
  }
  async function apiRun(action, body, read) {
    S.busy++; progress();
    try {
      // перегляд даних — до 5 спроб із паузами (слабкий Wi‑Fi, перемикання мережі в iPhone); збереження — одна, щоб не задвоїти
      const tries = read ? 5 : 1;
      const PAUSE = [0, 700, 1500, 2500, 4000];
      let j, lastErr;
      for (let k = 0; k < tries; k++) {
        if (k) await new Promise((r) => setTimeout(r, PAUSE[k]));
        let st = 0, ct = '', txt = '';
        const host = API_URL;
        try {
          // без AbortController: у WebView iPhone запити з «сигналом» інколи обриваються самі
          const res = await Promise.race([
            fetch(host, { method: 'POST', body: body }),
            new Promise((_, rej) => setTimeout(() => { const e = new Error('timeout'); e.name = 'TimeoutError'; rej(e); }, 25000)),
          ]);
          st = res.status; ct = res.headers.get('content-type') || '';
          txt = await res.text();
          j = JSON.parse(txt);
          lastErr = null;
          HOST_FAIL[host] = 0;
          break;
        } catch (e) {
          lastErr = e;
          // адреса не відповіла двічі поспіль — переходимо на запасну
          // адреса не відповіла — наступна спроба йде на іншу (обидві ведуть на той самий сервер)
          if (!st && API_URL === host) switchHost();
          clog({ a: action, try: k + 1, err: (e && e.name) + ': ' + (e && e.message), st: st, ct: ct, len: txt.length, head: txt.slice(0, 160), bytes: body.length, host: host.replace(/^https:\/\//, '').slice(0, 30), vis: document.visibilityState });
        }
      }
      if (lastErr) throw lastErr;
      if (!j.ok) {
        if (j.error === 'act_as') { A.actExit(); }
        if (!IN_TG && (j.error === 'auth' || j.error === 'auth_expired')) { logout(true); }
        const e = new Error(j.message || 'Помилка'); e.code = j.error; throw e;
      }
      return j.data;
    } catch (e) {
      if (!e.code) e.message = e.name === 'TimeoutError' ? 'Сервер довго не відповідає. Спробуй ще раз за хвилинку.' : 'Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.';
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
  // фото, які люди завантажили в MyYL (ключ змінюється з кожним новим фото)
  const phUrl = (id) => { const k = id && S.me && S.me.photos && S.me.photos[String(id)]; if (!k) return ''; let o = ''; try { o = new URL(API_URL).origin; } catch (e) { o = ''; } return o + '/p/' + encodeURIComponent(id) + '?k=' + encodeURIComponent(k); };
  const avaHtml = (id, name, style) => { const u = phUrl(id); return u ? `<img class="avatar" src="${esc(u)}" alt="" loading="lazy" style="object-fit:cover;padding:0;${style || ''}">` : `<span class="avatar"${style ? ` style="${style}"` : ''}>${esc(initials(name))}</span>`; };
  const myPhotoAny = () => phUrl(S.me && S.me.user && S.me.user.id) || myPhoto();
  // для себе: якщо обрано «з Telegram», а сервер ще не знає фото — беремо з Telegram напряму
  const myAvatar = () => myPhotoAny() ? `<img class="avatar lg" src="${esc(myPhotoAny())}" alt="" style="object-fit:cover;padding:0">` : `<div class="avatar lg">${esc(initials(S.me.user.name))}</div>`;
  // невідома роль (напр. службова, якої вже немає в списку) не повинна ламати екран
  const roleDef = (k) => S.me.roleDefs.filter((r) => r.key === k)[0] || { key: k, label: '', rank: 99, level: '' };
  const myTeamFirst = (ids) => { const mine = (S.me.myTeams || []).map((t) => t.id).filter((id) => ids.indexOf(id) >= 0); return mine[0] || ids[0] || null; };

  // ───────────── навігація ─────────────
  const TOP = ['home', 'add', 'known', 'stats', 'more'];
  function go(screen, opts) {
    S.homeEdit = false; S.homeDraft = null;
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
    if (S.screen === 'structure' && (S.structEdit || S.structDelS)) { S.structEdit = null; S.structDelS = null; return render(); }
    if (S.screen === 'stats' && S.stats.find) { S.stats.find = false; return render(); }
    if (S.screen === 'myyl' && myylParent()) { S.myyl.at = myylParent(); S.myyl.open = null; render(); window.scrollTo(0, 0); return; }
    if (S.screen === 'onboarding' && S.reg.step > 1) { S.reg.step--; return render(); }
    if (S.screen === 'tasks' && (S.tasks.form || S.tasks.open)) { if (S.tasks.form) S.tasks.form = null; else S.tasks.open = null; return render(); }
    if (S.screen === 'polls' && S.polls.form) { S.polls.form = null; return render(); }
    if (S.screen === 'team' && S.team.add) { S.team.add = null; return render(); }
    if (S.screen === 'res' && S.res.form) { S.res.form = null; return render(); }
    if (S.screen === 'ws' && wsBack()) return;
    if (S.screen === 'home' && S.homeEdit) { S.homeEdit = false; S.homeDraft = null; render(); window.scrollTo(0, 0); return; }
    S.screen = S.stack.pop() || 'home';
    render();
  }
  function canBack() {
    return S.stack.length > 0 || (S.screen === 'home' && !!S.homeEdit) || (S.screen === 'ws' && wsCanBack()) || (S.screen === 'calendar' && (S.ev || S.evForm)) || (S.screen === 'known' && (S.known.detail || S.known.edit || S.known.bulk)) ||
      (S.screen === 'profile' && S.roleReq) || (S.screen === 'onboarding' && S.reg.step > 1) || (S.screen === 'structure' && (S.structEdit || S.structDelS)) || (S.screen === 'stats' && S.stats.find) || (S.screen === 'myyl' && !!myylParent()) || (S.screen === 'tasks' && !!(S.tasks.form || S.tasks.open)) || (S.screen === 'polls' && !!S.polls.form) || (S.screen === 'team' && !!S.team.add) || (S.screen === 'res' && !!S.res.form);
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
    if (screen === 'add') { if (o.type) { S.addKnown = false; S.addFin = false; } S.fx.data = null; initAdd(o.type, o.teamId); }
    if (screen === 'stats') { if (o.scope) setPick('stats', o.scope); ensurePick('stats'); if (o.cat) S.stats.cat = o.cat; loadStats(); }
    if (screen === 'known') { S.known.detail = null; S.known.edit = null; S.known.bulk = null; if (S.known.mode === 'browse') ensurePick('known', ownTeamKeys('known')); loadKnown(); }
    if (screen === 'team') { S.team.open = null; ensurePick('team', ownTeamKeys('team')); loadTeam(); }
    if (screen === 'finance') { ensurePick('finance', ownTeamKeys('finance')); loadFin(); }
    if (screen === 'requests') loadReqs();
    if (screen === 'perms') loadPerms();
    if (screen === 'inst') { ensurePick('inst'); loadInst(); }
    if (screen === 'mystats') loadMyStats();
    if (screen === 'ach') loadAch();
    if (screen === 'bugs') loadBugs();
    if (screen === 'clubIdeas' && !S.club.data) loadClub();
    if (screen === 'club') { S.club.pick = null; if (!S.club.dirty || !S.club.data) loadClub(); }
    if (screen === 'bank') { S.bank.pick = null; loadBank(); }
    if (screen === 'dupes') loadDupes();
    if (screen === 'bug') S.bug = { text: '', from: S.stack[S.stack.length - 2] || '' };
    if (screen === 'res') { S.res.form = null; loadRes(); }
    if (screen === 'dirs') { ensurePick('dirs'); loadDirs(); }
    if (screen === 'tasks') { S.tasks.open = o.id || null; S.tasks.form = null; loadTasks(); }
    if (screen === 'polls') { S.polls.form = null; loadPolls(); }
    if (screen === 'myyl') { S.myyl.open = null; loadMyyl(); }
    if (screen === 'broadcast') loadBc();
    if (screen === 'ws') wsEnter(o);
    if (screen === 'report') initReport();
    if (screen === 'structure') { S.structEdit = null; loadTree(); }
    if (screen === 'stats') { S.stats.find = false; S.stats.showAll = false; S.stats.showMiss = false; }
    if (screen === 'profile') { S.roleReq = null; S.profile = Object.assign({}, S.me.profile || {}); }
  }


  // точкова діаграма: скільки було на кінець кожного тижня/місяця
  function trendCard(t) {
    const P = t.points, n = P.length, W = 320, H = 150, L = 14, R = 14, T = 22, B = 26;
    const vs = P.map((p) => p.v).concat([t.from]);
    let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (hi === lo) { lo = Math.max(0, lo - 1); hi = hi + 1; }
    const pad = (hi - lo) * 0.15; lo = Math.max(0, lo - pad); hi += pad;
    const X = (i) => n === 1 ? W / 2 : L + (W - L - R) * i / (n - 1), Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const step = Math.max(1, Math.ceil(n / 6));
    const delta = t.delta, cls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * f}" y2="${T + (H - T - B) * f}" class="tr-grid"/>`).join('');
    const line = P.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
    const dots = P.map((p, i) => {
      const chg = i === 0 ? p.v !== t.from : p.v !== P[i - 1].v, last = i === n - 1, show = last || i === 0 || (chg && n <= 14);
      return `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${last ? 6 : chg ? 4.5 : 3.2}" class="tr-dot${last ? ' last' : chg ? ' chg' : ''}"><title>${esc(p.label)}: ${p.v}</title></circle>` +
        (show ? `<text x="${X(i).toFixed(1)}" y="${(Y(p.v) - 10).toFixed(1)}" class="tr-v${last ? ' last' : ''}" text-anchor="${i === 0 && n > 1 ? 'start' : last && n > 1 ? 'end' : 'middle'}">${nf(p.v)}</text>` : '');
    }).join('');
    const labels = P.map((p, i) => (i % step === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < step / 2) ? `<text x="${X(i).toFixed(1)}" y="${H - 6}" class="tr-l" text-anchor="${i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}">${esc(p.label)}</text>` : '').join('');
    return `<div class="card trend"><div class="row between" style="align-items:flex-start;gap:10px"><span><h2>${esc(t.title)}</h2><div class="small muted">${esc(t.sub)}</div></span>
      <span class="tr-delta ${cls}">${delta > 0 ? '▲ +' + nf(delta) : delta < 0 ? '▼ −' + nf(-delta) : 'без змін'}</span></div>
      <div class="xs muted" style="margin-top:4px">На початку періоду — <b>${nf(t.from)}</b>, зараз — <b>${nf(t.to)}</b></div>
      <svg viewBox="0 0 ${W} ${H}" class="tr-svg">${grid}<path d="${line}" class="tr-line"/>${dots}${labels}</svg></div>`;
  }
  // ───────────── завантаження ─────────────
  function route() {
    if (S.me.status === 'new') { S.reg.name = S.reg.name || ''; S.screen = 'onboarding'; return true; }
    if (S.me.status === 'pending') { S.screen = 'pending'; return true; }
    return false;
  }
  function wantScreen() {
    const q = new URLSearchParams(location.search).get('screen');
    if (q) return q;
    try { return (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) { return ''; }
  }
  async function loadMe() {
    const cached = LS.get('me');
    if (cached && cached.status === 'active') {
      // миттєвий старт з останніх даних
      S.me = cached; S.events = cached.events || null;
      const want = wantScreen();
      S.screen = 'home';
      if (wsWant(want)) { /* задача чи сторінка простору */ } else if (want && VIEWS[want] && want !== 'onboarding' && want !== 'pending') go(want); else render();
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
    if (S.me.status === 'new') { S.reg.name = S.reg.name || ''; S.screen = 'onboarding'; }
    else if (S.me.status === 'pending') S.screen = 'pending';
    else {
      const want = wantScreen();
      S.screen = 'home';
      enter('home', {});
      if (wsWant(want)) return;
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
      const d = await api('stats', { units: S.pick.stats.keys, cat: S.stats.cat, period: S.stats.period, from: S.stats.from, to: S.stats.to });
      if (statsKey() !== key) return; // людина вже перейшла далі
      S.stats.data = d; S.stats.at = 'оновлено о ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
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
  async function loadAudCount(scr) {
    const f = audState(scr); if (!f) return;
    const prm = { units: (S.pick[scr] || { keys: [] }).keys, roles: f.roles || [], kind: scr }, key = JSON.stringify(prm);
    f.count = null; render();
    try { const r = await api('audCount', prm); if (audState(scr) === f && JSON.stringify({ units: (S.pick[scr] || { keys: [] }).keys, roles: f.roles || [], kind: scr }) === key) f.count = r.count; } catch (e) { toast(e.message); }
    if (S.screen === (scr === 'task' ? 'tasks' : 'polls')) render();
  }
  function refreshTodo() {
    const t = S.me.todo = S.me.todo || {};
    if (S.tasks.data) t.tasks = S.tasks.data.list.filter((x) => x.mine && !x.closed && x.mine.status !== 'done').length;
    if (S.polls.data) t.polls = S.polls.data.list.filter((x) => x.canVote && !x.mine.length).length;
  }
  async function loadPerms() {
    try { S.perms.data = await api('permsGet', { unit: S.perms.unit }); S.perms.unit = S.perms.data.unit; if (!S.perms.data.roles.some((r) => r.key === S.perms.role)) S.perms.role = (S.perms.data.roles[0] || {}).key || ''; } catch (e) { toast(e.message); }
    if (S.screen === 'perms') render();
  }
  async function loadTasks() {
    try { S.tasks.data = await api('tasks'); refreshTodo(); } catch (e) { S.tasks.data = S.tasks.data || { list: [], canCreate: false }; toast(e.message); }
    if (S.screen === 'tasks' && !S.tasks.form) render();
  }
  async function loadPolls() {
    try { S.polls.data = await api('polls'); refreshTodo(); } catch (e) { S.polls.data = S.polls.data || { list: [], canCreate: false }; toast(e.message); }
    if (S.screen === 'polls' && !S.polls.form) render();
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
    // горизонтальні ряди (вибір команд, вкладки) не повинні відскакувати на початок після кожного оновлення
    const HS = '.pills, .rtab-w, .board';
    const hsKey = (el, i) => S.screen + '|' + ((el.closest('[id]') || {}).id || '') + '|' + el.className + '|' + i;
    const hsSaved = {};
    $app.querySelectorAll(HS).forEach((el, i) => { if (el.scrollLeft) hsSaved[hsKey(el, i)] = el.scrollLeft; });
    const view = VIEWS[S.screen] ? VIEWS[S.screen]() : '';
    const nav = S.me.status === 'active' ? navHtml() : '';
    // новий екран (або інший заголовок у ньому) — плавна поява; звичайні оновлення — без анімації
    const vKey = S.screen + '|' + ((view.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
    const enter = vKey !== S._vKey; S._vKey = vKey;
    const ab = ACT_AS ? `<div class="viewbar actbar" role="status"><span class="grow">🎭 <b>Ти зараз як:</b> ${esc((S.me && S.me.actAs && S.me.actAs.name) || ACT_AS.name)} · усе, що зробиш, буде від її/його імені</span><button type="button" data-a="actExit">Вийти</button></div>` : '';
    const vb = VIEW_AS && S.me && S.me.viewAs ? `<div class="viewbar" role="status"><span class="grow">👁 <b>Режим перегляду</b> · ${esc(S.me.viewAs.label)} · ${esc(S.me.viewAs.unitName || '')}</span><button type="button" data-a="viewExit">Вийти</button></div>` : '';
    $app.innerHTML = ab + vb + `<main class="main${nav ? '' : ' no-nav'}${enter ? ' enter' : ''}${vb || ab ? ' has-viewbar' : ''}">${view}</main>${nav}` + (S.thanks ? `<div class="modal-bg" role="dialog" aria-modal="true" aria-labelledby="thxT"><div class="modal">
      <div id="thxT" class="thx-text">Дякую тобі за вірність в малому</div>
      <button type="button" class="thx-btn" data-a="thanksClose" aria-label="Амінь">🙏</button></div></div>` : '');
    if (S.toast) document.body.insertAdjacentHTML('beforeend', document.querySelector('.toast') ? '' : `<div class="toast" role="status">${esc(S.toast)}</div>`);
    syncBack();
    glide();
    $app.querySelectorAll(HS).forEach((p, i) => {
      const k = hsKey(p, i);
      if (hsSaved[k] != null) p.scrollLeft = hsSaved[k];
      // вибраний пункт ряду вибору має бути видно; якщо вже видно — нічого не рухаємо
      const on = p.classList.contains('lvl') && p.querySelector('.pill.on:not(.multi)');
      if (!on) return;
      const l = on.offsetLeft - p.offsetLeft, r = l + on.offsetWidth;
      if (hsSaved[k] == null ? l > p.clientWidth - 40 : (l < p.scrollLeft || r > p.scrollLeft + p.clientWidth)) p.scrollLeft = l - (p.clientWidth - on.offsetWidth) / 2;
    });
  }
  // «бульбашка», що перетікає між пунктами перемикача та нижнього меню
  const GL = {};
  function glide() {
    $app.querySelectorAll('.seg, nav.tabs .in-nav').forEach((box, i) => {
      const on = box.querySelector(':scope > button.on');
      if (!on) return;
      const key = box.classList.contains('in-nav') ? 'nav' : S.screen + '|' + i;
      const g = document.createElement('i');
      g.className = 'glide';
      box.insertBefore(g, box.firstChild);
      box.classList.add('has-glide');
      const r = { l: on.offsetLeft, w: on.offsetWidth, t: on.offsetTop, h: on.offsetHeight };
      const set = (x) => { g.style.left = x.l + 'px'; g.style.width = x.w + 'px'; g.style.top = x.t + 'px'; g.style.height = x.h + 'px'; };
      const prev = GL[key];
      GL[key] = r;
      if (prev && (prev.l !== r.l || prev.w !== r.w)) {
        g.style.transition = 'none'; set(prev);
        void g.offsetWidth;
        g.style.transition = ''; set(r);
      } else set(r);
    });
  }
  function renderFatal() {
    $app.innerHTML = `<main class="main no-nav"><div class="row"><div class="logo"><img src="icons/yl-mark.png" alt="Young Life"></div><h2>Young Life Україна</h2></div>
      <div class="card col"><h2>Не вдалося відкрити застосунок</h2><div class="muted">${esc(S.fatal)}</div>
      <button class="btn" type="button" data-a="reload">Спробувати ще раз</button></div></main>`;
  }

  // клуб — за команду; МГ і КР — за себе (у свої команди або, для вищих ролей, на рівень своєї ерії/регіону)
  const canType = (t) => { const c = caps(); return t === 'club' ? (c.report.club || []).length > 0 : !!((c.reportSelf || {})[t] || (c.report[t] || []).length); };
  const canKnownAdd = () => (caps().knownEditTeams || []).length > 0 || !!caps().knownNoTeam;
  function navHtml() {
    const c = caps();
    const canKnown = (c.knownTeams || []).length > 0 || !!c.knownNoTeam;
    // «Внести» — завжди; «Знані» — якщо є доступ; «Календар» — у «Ще»
    const tabs = [['home', 'Головна'], ['add', 'Внести'], ['known', 'Знані'], ['stats', 'Статистика'], ['more', 'Ще']]
      .filter((t) => (t[0] !== 'known' || canKnown) && (t[0] !== 'stats' || ((S.me.statScopes || S.me.scopes || []).length && c.stats !== false)) && (t[0] !== 'add' || !c.sugarOnly));
    const active = TOP.indexOf(S.screen) >= 0 ? S.screen : 'more';
    return `<nav class="tabs" aria-label="Розділи"><div class="in-nav">${tabs.map((t) =>
      `<button type="button" class="${t[0] === active ? 'on' : ''}" data-a="tab" data-s="${t[0]}">${icon(t[0], 24)}${t[1]}${t[0] === 'more' && (S.me.pendingCount || S.me.bugsOpen) ? '<span class="dot"></span>' : ''}</button>`).join('')}</div></nav>`;
  }

  const header = (title, sub, extra) => `<div class="row">${canBack() && !IN_TG ? `<button type="button" class="icon-btn" data-a="back" aria-label="Назад">${icon('back')}</button>` : ''}<div class="grow"><h1 style="font-size:22px">${esc(title)}</h1>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</div>${extra || ''}</div>`;
  const loading = () => '<div class="loader"><div class="spin"></div>Завантаження…</div>';
  const teamSelect = (ids, cur, ch) => ids.length > 1
    ? `<label class="f"><span>Команда</span><select class="in" data-ch="${ch}">${ids.map((id) => `<option value="${esc(id)}"${id === cur ? ' selected' : ''}>${esc(teamName(id))}${areaById((teamById(id) || {}).areaId) ? ' · ' + esc(areaById(teamById(id).areaId).name) : ''}</option>`).join('')}</select></label>`
    : '';

  const VIEWS = {};
  // ───────────── НАШ КЛУБ: план, кошик ідей, архів ─────────────
  const WDL = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  const IDEA_IC = { game: '🎲', ggame: '🤸', song: '🎵', topic: '💡', other: '📌', sermon: '📖', quest: '🧭', movie: '🎬' };
  const bankFrom = (x) => x.teams.length ? `💬 команда «${esc(x.team)}»${x.teams.length > 1 ? ' · і ще ' + (x.teams.length - 1) : ''}${x.pick ? ' · ⭐ є в добірці' : ''}` : '⭐ добірка Young Life';
  const PROG_KINDS = [['song', 'Пісня'], ['game', 'Гра'], ['ggame', 'Загальна гра'], ['talk', 'Проповідь'], ['other', 'Інше']];
  const PROG_IC = { song: '🎵', game: '🎲', ggame: '🤸', talk: '📖', other: '📌' };
  const PROG_PH = { song: 'Назва пісні', game: 'Назва гри', ggame: 'Назва загальної гри', talk: 'Тема проповіді', other: 'Що саме: зустріч, перекус, оголошення…' };
  const CLUB_FMT = [['club', '🎉 Клуб'], ['quest', '🧭 Квест'], ['movie', '🎬 Фільм']];
  const fmtLabel = (v) => { const x = CLUB_FMT.filter((k) => k[0] === v)[0]; return x ? x[1] : v ? '✨ ' + v : ''; };
  const daysTo = (k) => Math.round((parseDay(k) - parseDay(ymd(new Date()))) / 864e5);
  const whenLine = (k) => { if (!k) return ''; const n = daysTo(k), d = parseDay(k); return WDL[d.getDay()] + ', ' + d.getDate() + ' ' + MGEN[d.getMonth()] + (n === 0 ? ' · сьогодні' : n === 1 ? ' · завтра' : n > 1 ? ' · через ' + plural(n, 'день', 'дні', 'днів') : ''); };
  function clubHomeCards() {
    const L = (me().clubPlans || []).slice(0, 3);
    return L.map((cp) => {
      const p = cp.plan;
      let body;
      if (!p) body = `<div class="cl-empty">${cp.canEdit ? 'Наступний клуб ще не заплановано — заплануй тему, гру й ролі' : 'План наступного клубу ще не створено'}</div>`;
      else body = `<div class="cl-date">📅 ${esc(whenLine(p.date))}</div>
        <div class="cl-topic">${p.topic ? esc(p.topic) : '<span class="muted">Тему ще не обрано</span>'}</div>
        <div class="cl-meta">${p.preacher ? `<span>🎤 ${esc(p.preacher)}</span>` : ''}${p.scripture ? `<span>📖 ${esc(p.scripture)}</span>` : ''}${p.roles ? `<span>👥 ролі: ${p.filled} з ${p.roles}</span>` : ''}</div>
        ${p.mine.length ? `<div class="cl-mine">Твоя роль: <b>${esc(p.mine.join(', '))}</b></div>` : ''}`;
      return `<button type="button" class="card cl-home" data-a="clubGo" data-t="${esc(cp.teamId)}"><div class="row between"><span class="cl-h">🎉 Наш клуб</span><span class="xs muted">${esc(cp.team)}</span></div>${body}
        <span class="cl-cta">${p ? 'Відкрити план' : cp.canEdit ? 'Запланувати' : 'Відкрити'} ${icon('chev', 16)}</span></button>`;
    }).join('');
  }
  async function loadClub() {
    const C = S.club;
    if (!C.teamId) { const L = me().clubPlans || []; C.teamId = L.length ? L[0].teamId : ''; }
    if (!C.teamId) { C.data = { none: true }; render(); return; }
    try {
      const d = await api('clubPage', { teamId: C.teamId });
      C.data = d; C.dirty = false;
      const p = d.plan;
      C.f = { id: p.id, format: p.format || 'club', formatOther: '', date: p.date, topic: p.topic, sermon: p.sermon || '', preacher: p.preacher, scripture: p.scripture, note: p.note || '',
        program: (p.program || []).map((g) => ({ kind: g.kind, name: g.name, desc: g.desc || '' })),
        roles: (p.roles || []).map((r) => ({ name: r.name, text: r.text || '', who: r.who.map((w) => w.id) })) };
      C.rep = { teens: '', newT: '', leaders: '', parents: '', note: '' };
    } catch (e) { toast(e.message, 'error'); C.data = C.data || { error: true }; }
    if (S.screen === 'club' || S.screen === 'clubIdeas') render();
  }
  VIEWS.club = function () {
    const C = S.club, d = C.data, teams = me().clubPlans || [];
    let h = header('Наш клуб', d && d.team ? d.team.name : '');
    if (teams.length > 1) h += `<div class="chips" style="margin-bottom:4px">${teams.map((t) => `<button type="button" class="chip${t.teamId === C.teamId ? ' on' : ''}" data-a="clubTeam" data-t="${esc(t.teamId)}">${esc(t.team)}</button>`).join('')}</div>`;
    if (!d) return h + loading();
    if (d.none) return h + '<div class="empty">План клубу ведуть учасники команди. У тебе поки немає ролі в команді.</div>';
    if (d.error || !d.plan) return h + '<div class="empty">Не вдалося завантажити. Потягни екран вниз, щоб оновити.</div>';
    h += `<div class="cl-quick"><button type="button" class="chip" data-a="tabGo" data-s="clubIdeas">🧺 Накидати в кошик ідей${d.ideas.length ? ' · ' + d.ideas.length : ''}</button><button type="button" class="chip" data-a="tabGo" data-s="bank">✨ Надихнутись від інших</button></div>`;
    h += planCard(d) + reportCard(d) + archiveCard(d);
    return h;
  };
  // кошик ідей — окремий екран для брейншторму
  VIEWS.clubIdeas = function () {
    const d = S.club.data;
    let h = header('Кошик ідей', d && d.team ? d.team.name + ' · брейншторм для наступних клубів' : '');
    if (!d || !d.ideas) return h + loading();
    return h + ideasCard(d) + `<button type="button" class="link-btn" data-a="tabGo" data-s="bank">✨ Надихнутись від інших команд →</button>`;
  };
  function ideasCard(d) {
    const C = S.club, cats = d.ideaCats, f = C.idea || (C.idea = { cat: 'game', text: '', desc: '' });
    const flt = C.ideaCat || 'all', list = d.ideas.filter((x) => flt === 'all' || x.cat === flt);
    const cnt = (k) => d.ideas.filter((x) => x.cat === k).length;
    let h = `<div class="card col" style="gap:10px">`;
    h += `<div class="chips"><button type="button" class="chip${flt === 'all' ? ' on' : ''}" data-a="ideaFlt" data-v="all">Усі · ${d.ideas.length}</button>${cats.map((c) => `<button type="button" class="chip${flt === c[0] ? ' on' : ''}" data-a="ideaFlt" data-v="${c[0]}">${IDEA_IC[c[0]]} ${esc(c[1])} · ${cnt(c[0])}</button>`).join('')}</div>`;
    if (!list.length) h += `<div class="small muted">${d.ideas.length ? 'У цій категорії порожньо' : 'Поки порожньо. Накидайте ідеї для наступних клубів — ігри, пісні, теми.'}</div>`;
    else h += `<div class="col" style="gap:0">${list.map((x) => `<div class="idea"><span class="idea-ic">${IDEA_IC[x.cat] || '📌'}</span><span class="grow"><b>${esc(x.text)}</b>${x.desc ? `<br><span class="small">${esc(x.desc)}</span>` : ''}<br><span class="xs muted">${esc(x.author)}</span></span>
      ${d.can.edit ? `<button type="button" class="link-btn xs" data-a="ideaToPlan" data-id="${x.id}" title="Додати в план">→ у план</button>` : ''}${d.can.ideaDel ? `<button type="button" class="icon-btn sm" data-a="ideaDel" data-id="${x.id}" aria-label="Видалити">×</button>` : ''}</div>`).join('')}</div>`;
    if (d.can.ideaDel && d.ideas.length) h += `<button type="button" class="link-btn xs" style="align-self:flex-start" data-a="ideaClear">🧹 Очистити ${flt === 'all' ? 'весь кошик' : 'категорію «' + esc((cats.find((c) => c[0] === flt) || [0, ''])[1]) + '»'}</button>`;
    if (d.can.idea) {
      h += `<div class="idea-add col" style="gap:8px"><div class="seg">${cats.map((c) => `<button type="button" class="${f.cat === c[0] ? 'on' : ''}" data-a="ideaCatSet" data-v="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
        <input class="in" type="text" maxlength="500" data-bind="club.idea.text" value="${esc(f.text)}" placeholder="${f.cat === 'game' ? 'Назва гри' : f.cat === 'song' ? 'Назва пісні' : f.cat === 'topic' ? 'Тема клубу чи проповіді' : 'Ідея'}">
        ${f.cat === 'game' ? `<textarea class="in" rows="2" maxlength="600" data-bind="club.idea.desc" placeholder="Коротко правила чи коментар">${esc(f.desc)}</textarea>` : ''}
        <button type="button" class="btn sec2" data-a="ideaAdd">${icon('plus', 18)} Додати в кошик</button></div>`;
    }
    return h + '</div>';
  }
  function planCard(d) {
    const C = S.club, f = C.f, can = d.can, ro = !can.edit;
    const nm = {}; d.people.forEach((p) => { nm[p.id] = p.name; });
    let h = `<div class="sec">📋 Наступний клуб</div><div class="card col" style="gap:12px">`;
    if (ro) {
      h += `<div class="cl-date">📅 ${esc(whenLine(f.date))}${f.format && f.format !== 'club' ? ' · ' + esc(fmtLabel(f.format)) : ''}</div>
        ${[['Тема клубу', f.topic], ['Тема проповіді', f.sermon], ['Проповідник', f.preacher], ['Місце з Біблії', f.scripture]].filter((x) => x[1]).map((x) => `<div><span class="xs muted">${x[0]}</span><br><b>${esc(x[1])}</b></div>`).join('') || '<div class="small muted">План ще не заповнено.</div>'}
        ${f.roles.length ? `<div><span class="xs muted">Ролі</span>${f.roles.map((r) => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${esc(r.name)}</span><b class="small">${esc(r.who.map((id) => nm[id]).filter(Boolean).concat(r.text ? [r.text] : []).join(', ') || '—')}</b></div>`).join('')}</div>` : ''}
        ${f.program.length ? `<div><span class="xs muted">Програма</span>${f.program.map((g, i) => `<div class="prog-ro"><span class="prog-n">${i + 1}</span><span>${PROG_IC[g.kind] || '•'} <b>${esc(g.name)}</b>${g.desc ? `<br><span class="small">${esc(g.desc)}</span>` : ''}</span></div>`).join('')}</div>` : ''}
        ${f.note ? `<div class="small">${esc(f.note)}</div>` : ''}<div class="xs muted">План заповнюють капітан, адмін команди та лідери.</div></div>`;
      return h;
    }
    h += `<label class="f"><span>Дата клубу</span><input class="in" type="date" data-bind="club.f.date" data-live="clubDirty" value="${esc(f.date)}"${can.date ? '' : ' disabled'}></label>
      <div class="xs muted" style="margin-top:-6px">${esc(whenLine(f.date))}${can.date ? '' : ' · дату змінює капітан або адмін'}</div>
      <div class="f"><span>Формат клубу</span><div class="chips">${CLUB_FMT.concat((d.myFormats || []).map((x) => [x, '✨ ' + x])).map((k) => `<button type="button" class="chip${f.format === k[0] ? ' on' : ''}" data-a="clubFmt" data-v="${esc(k[0])}">${esc(k[1])}</button>`).join('')}<button type="button" class="chip${f.format === '_other' ? ' on' : ''}" data-a="clubFmt" data-v="_other">Інше…</button></div>
      ${f.format === '_other' ? `<input class="in" type="text" maxlength="60" data-bind="club.f.formatOther" data-live="clubDirty" value="${esc(f.formatOther || '')}" placeholder="Наприклад: Караоке-батл, Виїзний клуб">` : ''}</div>
      <label class="f"><span>Тема клубу</span><input class="in" type="text" maxlength="200" data-bind="club.f.topic" data-live="clubDirty" value="${esc(f.topic)}" placeholder="Наприклад: Блудний син"></label>
      <label class="f"><span>Тема проповіді</span><input class="in" type="text" maxlength="200" data-bind="club.f.sermon" data-live="clubDirty" value="${esc(f.sermon)}" placeholder="Якщо відрізняється від теми клубу"></label>
      <div class="row" style="gap:10px"><label class="f grow"><span>Проповідник</span><input class="in" type="text" maxlength="100" list="clubPeople" data-bind="club.f.preacher" data-live="clubDirty" value="${esc(f.preacher)}" placeholder="Хто говорить"></label>
      <label class="f grow"><span>Місце з Біблії</span><input class="in" type="text" maxlength="120" data-bind="club.f.scripture" data-live="clubDirty" value="${esc(f.scripture)}" placeholder="Лк 15:11-32"></label></div>
      <datalist id="clubPeople">${d.people.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>`;
    // ролі
    h += `<div class="cl-sub">👥 Ролі й відповідальні</div>`;
    if (!f.roles.length) h += `<div class="xs muted">Заповніть ролі один раз — на наступні клуби вони підтягнуться самі (зайве можна прибрати).</div>`;
    h += f.roles.map((r, i) => {
      const open = C.pick === i;
      return `<div class="cl-row col" style="gap:6px"><div class="row" style="gap:6px"><input class="in grow" type="text" maxlength="80" data-bind="club.f.roles.${i}.name" data-live="clubDirty" value="${esc(r.name)}" placeholder="Роль">
        <button type="button" class="icon-btn sm" data-a="clubRowDel" data-k="roles" data-i="${i}" aria-label="Прибрати роль">×</button></div>
        <div class="chips">${r.who.map((id) => `<button type="button" class="chip on" data-a="clubWho" data-i="${i}" data-id="${esc(id)}">${esc(nm[id] || '?')} ×</button>`).join('')}
        <button type="button" class="chip" data-a="clubPick" data-i="${i}">${open ? 'Готово' : '+ хто відповідає'}</button></div>
        ${open ? `<div class="chips cl-pick">${d.people.filter((p) => r.who.indexOf(p.id) < 0).map((p) => `<button type="button" class="chip" data-a="clubWho" data-i="${i}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<span class="xs muted">Усі вже вибрані</span>'}</div>` : ''}
        <input class="in" type="text" maxlength="120" data-bind="club.f.roles.${i}.text" data-live="clubDirty" value="${esc(r.text)}" placeholder="Або хто (не з команди), коментар"></div>`;
    }).join('');
    const have = f.roles.map((r) => r.name.toLowerCase());
    h += `<div class="chips">${d.hints.filter((x) => have.indexOf(x.toLowerCase()) < 0).map((x) => `<button type="button" class="chip" data-a="clubRoleAdd" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}<button type="button" class="chip" data-a="clubRoleAdd" data-v="">+ своя роль</button></div>`;
    // програма клубу: порядок — перетягуванням за ☰
    h += `<div class="cl-sub">🗒 Програма клубу</div>`;
    if (!f.program.length) h += `<div class="xs muted">Пункти по черзі: пісні, ігри, проповідь, перекус… Порядок змінюєш, перетягуючи за ☰.</div>`;
    h += `<div class="prog" data-noptr>${f.program.map((g, i) => `<div class="prog-it" data-i="${i}"><span class="prog-h" data-drag="${i}" aria-label="Перетягнути">☰</span><span class="prog-n">${i + 1}</span>
      <div class="grow col" style="gap:6px"><div class="row" style="gap:6px"><button type="button" class="prog-k" data-a="progKind" data-i="${i}" title="Змінити тип">${PROG_IC[g.kind]}</button>
      <input class="in grow" type="text" maxlength="120" data-bind="club.f.program.${i}.name" data-live="clubDirty" value="${esc(g.name)}" placeholder="${PROG_PH[g.kind]}">
      <button type="button" class="icon-btn sm" data-a="clubRowDel" data-k="program" data-i="${i}" aria-label="Прибрати">×</button></div>
      ${g.kind === 'game' || g.kind === 'ggame' || g.kind === 'talk' || g.desc ? `<textarea class="in" rows="2" maxlength="600" data-bind="club.f.program.${i}.desc" data-live="clubDirty" placeholder="${g.kind === 'game' || g.kind === 'ggame' ? 'Опис: коротко правила чи коментар' : g.kind === 'talk' ? 'Місце з Біблії, головна думка' : 'Коментар'}">${esc(g.desc)}</textarea>` : ''}</div></div>`).join('')}</div>
      <div class="chips">${PROG_KINDS.map((k) => `<button type="button" class="chip" data-a="progAdd" data-k="${k[0]}">+ ${k[1]}</button>`).join('')}</div>`;
    h += `<label class="f"><span>Нотатка</span><textarea class="in" rows="2" maxlength="1000" data-bind="club.f.note" data-live="clubDirty" placeholder="Що підготувати, купити, про що помолитися">${esc(f.note)}</textarea></label>
      <button type="button" class="btn" data-a="clubSave"${C.dirty || !f.id ? '' : ' disabled'}>${icon('check', 18)} ${f.id ? (C.dirty ? 'Зберегти план' : 'Збережено') : 'Створити план'}</button></div>`;
    return h;
  }
  function reportCard(d) {
    const C = S.club, f = C.f, today = d.today;
    if (!f.id) return '';
    if (f.date > today) return `<div class="xs muted" style="margin:2px 6px">Після клубу тут можна буде дати звіт — і план піде в архів, а на його місці з'явиться наступний клуб.</div>`;
    if (!d.can.report) return `<div class="card small muted">Клуб уже минув. Звіт дасть капітан або адмін команди — тоді план піде в архів, а тут з'явиться наступний клуб.</div>`;
    const r = C.rep, cap = d.team.dir === 'Capernaum';
    const inp = (k, l) => `<label class="f" style="flex:1;min-width:90px"><span>${l}</span><input class="in" type="number" inputmode="numeric" min="0" data-bind="club.rep.${k}" value="${esc(r[k])}"></label>`;
    return `<div class="sec">✅ Клуб проведено?</div><div class="card col" style="gap:10px"><div class="small muted">Звіт піде в статистику клубів, план — в архів, а тут з'явиться наступний клуб через тиждень.</div>
      <div class="row wrap" style="gap:8px">${inp('teens', 'Підлітків')}${inp('newT', 'Нових')}${inp('leaders', 'Лідерів')}${cap ? inp('parents', 'Батьків') : ''}</div>
      <label class="f"><span>Як пройшло</span><textarea class="in" rows="2" maxlength="1000" data-bind="club.rep.note" placeholder="Що вдалося, за кого помолитися">${esc(r.note)}</textarea></label>
      <button type="button" class="btn" data-a="clubDone">${icon('check', 18)} Зберегти звіт і в архів</button>
      <button type="button" class="link-btn small" data-a="clubDone" data-none="1">Клубу не було</button></div>`;
  }
  function archiveCard(d) {
    const C = S.club, A0 = d.archive;
    if (!A0.length) return `<div class="sec">🗂 Архів клубу</div><div class="empty small">Тут збиратимуться проведені клуби з темами, іграми й звітами.</div>`;
    const list = C.archAll ? A0 : A0.slice(0, 5);
    return `<div class="sec">🗂 Архів клубу · ${A0.length}</div><div class="card list">${list.map((p) => {
      const r = p.report || {}, open = C.archOpen === p.id;
      return `<button type="button" class="li arch" data-a="clubArch" data-id="${p.id}"><span class="grow"><b>${esc(fmtDay(p.date))}</b> · ${p.topic ? esc(p.topic) : '<span class="muted">без теми</span>'}<br>
        <span class="xs muted">${p.status === 'none' ? 'клубу не було' : (r.teens || 0) + ' підл. · ' + (r.newT || 0) + ' нових · ' + (r.leaders || 0) + ' лід.' + (r.parents ? ' · ' + r.parents + ' батьків' : '')}</span>
        ${open ? `<span class="arch-d">${p.sermon ? `<span>📖 ${esc(p.sermon)}</span>` : ''}${p.preacher ? `<span>🎤 ${esc(p.preacher)}</span>` : ''}${p.scripture ? `<span>📜 ${esc(p.scripture)}</span>` : ''}
          ${(p.program || []).map((g, i) => `<span>${i + 1}. ${PROG_IC[g.kind] || '•'} ${esc(g.name)}${g.desc ? ' — ' + esc(g.desc) : ''}</span>`).join('')}
          ${(p.roles || []).map((x) => `<span>👥 ${esc(x.name)}: ${esc(x.who.map((w) => w.name).concat(x.text ? [x.text] : []).join(', ') || '—')}</span>`).join('')}
          ${r.note ? `<span>💬 ${esc(r.note)}</span>` : ''}${p.doneBy ? `<span class="muted">звіт: ${esc(p.doneBy)}</span>` : ''}</span>` : ''}</span>${icon(open ? 'back' : 'chev', 16)}</button>`;
    }).join('')}</div>${A0.length > 5 && !C.archAll ? `<button type="button" class="link-btn" data-a="clubArchAll">Показати ще ${A0.length - 5}</button>` : ''}`;
  }

  // ───────────── БАНК ІДЕЙ ─────────────
  async function loadBank() { try { S.bank.data = await api('ideaBank'); } catch (e) { toast(e.message, 'error'); } if (S.screen === 'bank') render(); }
  VIEWS.bank = function () {
    const B = S.bank, d = B.data;
    let h = header('Банк ідей', 'добірка Young Life і все, що команди провели на клубах');
    if (!d) return h + loading();
    const on = (k) => B.cats[k] !== false;
    const cnt = (k) => d.items.filter((x) => x.cat === k).length;
    h += `<div class="card col" style="gap:12px"><div class="small muted">Що шукаєш?</div><div class="chips">${d.cats.map((c) => `<button type="button" class="chip${on(c[0]) ? ' on' : ''}" data-a="bankCat" data-v="${c[0]}">${on(c[0]) ? '☑' : '☐'} ${IDEA_IC[c[0]]} ${esc(c[1])} · ${cnt(c[0])}</button>`).join('')}</div>
      <button type="button" class="btn" data-a="bankRandom"${d.items.some((x) => on(x.cat)) ? '' : ' disabled'}>✨ Надихнутись</button>`;
    if (B.pick) { const x = B.pick; h += `<div class="bank-pick"><div class="xs muted">${IDEA_IC[x.cat]} ${esc((d.cats.find((c) => c[0] === x.cat) || [0, ''])[1])}</div><div class="bank-t">${esc(x.text)}</div>${x.desc ? `<div class="small" style="white-space:pre-line">${esc(x.desc)}</div>` : ''}
      <div class="xs muted" style="margin-top:6px">${x.teams.length ? `від команди «${esc(x.team)}»${x.teams.length > 1 ? ' · проводили ще ' + plural(x.teams.length - 1, 'команда', 'команди', 'команд') : ''}` : '⭐ добірка Young Life'}</div></div>`; }
    h += '</div>';
    if (!d.items.length) return h + '<div class="empty">Банк поки порожній. Він наповнюється сам, коли команди дають звіт за клуб із планом: теми, проповіді, ігри з описом і пісні.</div>';
    const T = B.tag || 'all', q = (B.q || '').trim().toLowerCase();
    h += `<div class="seg seg-scroll bank-seg" style="margin-top:6px"><button type="button" class="${T === 'all' ? 'on' : ''}" data-a="bankTag" data-v="all">Усі</button>${d.cats.map((c) => `<button type="button" class="${T === c[0] ? 'on' : ''}" data-a="bankTag" data-v="${c[0]}">${esc(c[1].split(' ')[0])}</button>`).join('')}</div>
      <input class="in" type="search" placeholder="Пошук" value="${esc(B.q || '')}" data-bind="bank.q" data-live="bankQ">`;
    const list = d.items.filter((x) => (T === 'all' || x.cat === T) && (!q || (x.text + ' ' + x.desc).toLowerCase().indexOf(q) >= 0));
    const shown = list.slice(0, B.more || 40);
    let grp = '';
    const grpHead = (x) => { if (x.cat !== 'movie' || !x.pick) return ''; const g = String(x.desc || '').split(' · ')[0]; if (!g || g === grp) return ''; grp = g; return `<div class="li bank-grp">🎬 ${esc(g)}</div>`; };
    h += `<div class="card list" id="bankList">${shown.map((x) => `${T === 'movie' ? grpHead(x) : ''}<div class="li" style="align-items:flex-start;gap:10px"><span class="idea-ic">${IDEA_IC[x.cat]}</span><span class="grow"><b>${esc(x.text)}</b>${x.desc ? `<br><span class="small" style="white-space:pre-line">${esc(T === 'movie' && x.pick ? x.desc.split(' · ').slice(1).join(' · ') : x.desc)}</span>` : ''}
      <br><span class="xs muted">${bankFrom(x)}</span></span></div>`).join('') || '<div class="li small muted">Нічого не знайдено</div>'}</div>`;
    if (list.length > shown.length) h += `<button type="button" class="link-btn" data-a="bankMore">Показати ще ${list.length - shown.length}</button>`;
    return h;
  };


  // ───────────── ГОЛОВНА ─────────────
  // ── головна: блоки, які людина сама вмикає й пересуває («Налаштувати вигляд екрану») ──
  const HOME_DEF = [
    ['alerts', 'Сповіщення', 'нові заявки, задачі й опитування'],
    ['week', 'Мій тиждень', 'клуб, мала група, контактна робота'],
    ['quick', 'Швидко внести', 'кнопки для швидкого звіту'],
    ['ws', 'Робочий простір', 'задачі з дедлайнами'],
    ['club', 'Наш клуб', 'план наступного клубу'],
    ['tiles', 'Розділи', 'моя команда, знані, ресурси, задачі'],
    ['events', 'Найближчі події', 'календар на місяць'],
    ['scope', 'Клуби цього тижня', 'скільки команд звітували'],
  ];
  function homeBlocks() {
    const m = me(), c = caps(), items = (m.week && m.week.items) || [], todo = m.todo || {};
    const B = {};
    B.alerts = () => {
      let h = '';
      if (m.pendingCount) {
        h += `<button type="button" class="banner" data-a="tabGo" data-s="requests"><span class="badge" style="width:32px;height:32px;border-radius:16px">${m.pendingCount}</span>
        <span class="grow"><b>Нові заявки</b><br><span class="small muted">Люди чекають на підтвердження ролі</span></span>${icon('chev')}</button>`;
      }
      if (todo.tasks) h += `<button type="button" class="banner" data-a="tabGo" data-s="tasks"><span class="badge" style="width:32px;height:32px;border-radius:16px">${todo.tasks}</span>
        <span class="grow"><b>Задачі до виконання</b><br><span class="small muted">Тобі доручили — відміть, як просувається</span></span>${icon('chev')}</button>`;
      if (todo.polls) h += `<button type="button" class="banner" data-a="tabGo" data-s="polls"><span class="badge" style="width:32px;height:32px;border-radius:16px;background:var(--blue)">${todo.polls}</span>
        <span class="grow"><b>${todo.polls === 1 ? 'Нове опитування' : 'Нові опитування'}</b><br><span class="small muted">Твій голос ще не враховано</span></span>${icon('chev')}</button>`;
      return h;
    };
    B.week = () => m.myWeek ? myWeekCard(m.myWeek)
      : `<button type="button" class="banner" data-a="tabGo" data-s="mystats"><span class="ms-fire" style="font-size:26px">🏅</span><span class="grow"><b>Моя статистика</b><br><span class="small muted">клуби, малі групи, КР, знані · ачівки — у «Ще»</span></span>${icon('chev')}</button>`;
    // швидко внести: клуб, МГ, КР і знані; ✓ — цього тижня вже внесено
    // вище капітана звіт за клуб на головній не вносять (лише «Був на клубі»)
    // без дублів: що вже є в «Мій тиждень» (клуб, МГ, КР) — у «Швидко внести» не повторюємо, якщо «Мій тиждень» показано
    B.quick = (weekShown) => {
      const inCard = (k) => weekShown && !!m.myWeek && (k === 'mg' || k === 'kr' || (k === 'club' && teamRole()));
      const quick = TYPES.filter((t) => canType(t.k) && (t.k !== 'club' || teamRole()) && !inCard(t.k));
      const doneT = (k) => items.some((x) => x.type === k && x.status !== 'missing');
      const qt = quick.map((t) => `<button type="button" class="tile" style="position:relative" data-a="openAdd" data-type="${t.k}"><span class="ic ${t.ic}">${icon(t.k, 18)}</span>${t.label}${doneT(t.k) ? '<span class="tile-ok" aria-label="цього тижня внесено">✓</span>' : ''}</button>`);
      const knownTile = (c.knownTeams || []).length || c.knownNoTeam;
      if (canKnownAdd() && !knownTile) qt.push(`<button type="button" class="tile" data-a="addKnownGo" data-m="one"><span class="ic ic-coral">${icon('known', 18)}</span>Знані</button>`);
      return qt.length ? `<div class="sec">Швидко внести</div><div class="grid${qt.length === 3 ? '3' : '2'}">${qt.join('')}</div>` : '';
    };
    B.ws = () => wsHomeCard();
    B.club = () => clubHomeCards();
    // головні розділи: моя команда, знані, корисні ресурси, задачі
    B.tiles = () => {
      const home = [];
      if ((c.viewTeams || []).length) home.push({ k: 'team', label: 'Моя команда', sub: 'склад, ролі й анкети', icon: 'club', ic: 'ic-teal' });
      else if (c.myyl) home.push({ k: 'myyl', label: 'Моя команда', sub: 'усі гілки й люди', icon: 'tree', ic: 'ic-teal' });
      if ((c.knownTeams || []).length || c.knownNoTeam) home.push({ k: 'known', label: 'Знані', sub: 'підлітки, за яких молимось', icon: 'known', ic: 'ic-coral' });
      home.push({ k: 'res', label: 'Корисні ресурси', sub: 'файли й посилання', icon: 'res', ic: 'ic-yellow' });
      if (!todo.tasks) home.push({ k: 'tasks', label: 'Задачі до виконання', sub: 'доручені тобі й тобою', icon: 'task', ic: 'ic-purple' });
      return `<div class="grid2">${home.map((t) =>
        `<button type="button" class="tile h" style="position:relative" data-a="tabGo" data-s="${t.k}"><span class="ic ${t.ic}">${icon(t.icon, 18)}</span><span class="grow"><span style="display:block">${esc(t.label)}</span><span class="xs muted" style="font-weight:400">${esc(t.sub)}</span></span></button>`).join('')}</div>`;
    };
    B.events = () => {
      let h = `<div class="row between" style="margin:8px 4px -4px"><span class="sec" style="margin:0">Найближчі події</span><button type="button" class="link-btn" data-a="tab" data-s="calendar">Усі</button></div>`;
      if (!S.events) h += loading();
      else if (!S.events.length) h += '<div class="empty small">Подій поки немає</div>';
      else {
        const soon = S.events.filter(inMonth);
        h += soon.length ? soon.map(evCard).join('') : '<div class="empty small">У найближчий місяць подій немає</div>';
        if (S.events.length > soon.length) h += `<button type="button" class="link-btn" style="align-self:center" data-a="tab" data-s="calendar">Усі події · ще ${S.events.length - soon.length}</button>`;
      }
      return h;
    };
    B.scope = () => {
      if (!m.scopeCard) return '';
      const sc = m.scopeCard; const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
      return `<button type="button" class="mini-stat" data-a="goStats" data-scope="${esc(sc.scope)}" data-cat="club"><span class="grow"><span class="xs muted" style="display:block">${esc(sc.title)} · клуби цього тижня</span>
        <span class="small"><b>${sc.done}</b> з ${sc.total} команд звітували</span><span class="track" style="height:4px;margin-top:6px"><i style="width:${pct}%;background:var(--turq)"></i></span></span><span class="xs muted">Деталі ›</span></button>`;
    };
    return B;
  }
  // які блоки взагалі є в цієї людини (щоб у налаштуваннях не було порожніх)
  function homeAvail() {
    const m = me(), c = caps();
    const has = { alerts: true, week: true, tiles: true, events: true, club: true };
    has.quick = !!homeBlocks().quick(false);
    has.ws = (m.ws || []).length > 0;
    has.club = !!clubHomeCards();
    has.scope = !!m.scopeCard;
    return HOME_DEF.filter((d) => has[d[0]]).map((d) => d[0]).concat(homeLinks().map((x) => 'm_' + x.k));
  }
  // ярлики з «Ще», які можна поставити на головну
  const homeLinks = () => { const out = []; moreSections().forEach(([t, items]) => items.forEach((m) => { if (!m.a && out.every((x) => x.k !== m.k)) out.push(Object.assign({ grp: t }, m)); })); return out; };
  const homeLinkTile = (x) => `<button type="button" class="tile h" style="position:relative" data-a="tabGo" data-s="${esc(x.k)}"><span class="ic ${x.ic}">${icon(x.icon, 18)}</span><span class="grow"><span style="display:block">${esc(x.label)}</span><span class="xs muted" style="font-weight:400">${esc(x.sub || '')}</span></span>${x.badge ? `<span class="badge" style="position:absolute;top:8px;right:8px">${x.badge}</span>` : ''}</button>`;
  // порядок: збережений + нові блоки (яких ще не було) на своїх звичних місцях
  function homeLayout() {
    const saved = S.homeDraft || (me().user || {}).home || null;
    const def = HOME_DEF.map((d) => d[0]);
    let order = saved && saved.order && saved.order.length ? saved.order.filter((k) => def.indexOf(k) >= 0 || /^m_/.test(k)) : def.slice();
    def.forEach((k, i) => { if (order.indexOf(k) < 0) { const prev = def.slice(0, i).reverse().find((x) => order.indexOf(x) >= 0); order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k); } });
    return { order: order, hide: (saved && saved.hide) || [] };
  }
  VIEWS.home = function () {
    if (S.homeEdit) return homeEditView();
    let h = `<div class="row"><img class="avatar lg" src="icons/icon-192.png?v=6" alt="MyYL" style="object-fit:cover;padding:0"><div class="grow"><h1 style="font-size:22px">Привіт, ${esc(first())}!</h1><div class="small muted">${esc(myLine())}</div></div></div>`;
    const offer = installOffer(true);
    if (offer) h += `<div class="card col" style="gap:10px">${offer}</div>`;
    const B = homeBlocks(), L = homeLayout();
    const shown = L.order.filter((k) => L.hide.indexOf(k) < 0);
    // ярлики з «Ще», що стоять поруч, — однією сіткою по два
    let run = [];
    const flush = () => { if (run.length) h += `<div class="grid2">${run.map(homeLinkTile).join('')}</div>`; run = []; };
    shown.forEach((k) => {
      if (/^m_/.test(k)) { const x = moreItem(k.slice(2)); if (x && !x.a) run.push(x); return; }
      flush();
      h += B[k] ? (k === 'quick' ? B.quick(shown.indexOf('week') >= 0) : B[k]()) : '';
    });
    flush();
    if (!shown.length) h += '<div class="empty small">Усі блоки сховано — налаштуй, що показувати</div>';
    h += `<button type="button" class="link-btn small" style="align-self:center;margin-top:6px" data-a="homeEdit">${icon('more', 16)} Налаштувати вигляд екрану</button>`;
    return h;
  };
  function homeEditView() {
    const L = homeLayout(), av = homeAvail();
    const rows = L.order.filter((k) => av.indexOf(k) >= 0);
    const links = homeLinks();
    const name = (k) => { if (/^m_/.test(k)) { const x = links.filter((y) => 'm_' + y.k === k)[0] || {}; return [k, x.label || '', 'ярлик з «Ще»', x]; } return HOME_DEF.filter((d) => d[0] === k)[0]; };
    let h = header('Вигляд головного екрана', 'Обери блоки й постав їх у потрібному порядку');
    h += `<div class="card list hed" data-noptr>${rows.map((k, i) => {
      const d = name(k), on = L.hide.indexOf(k) < 0;
      return `<div class="hed-row${on ? '' : ' off'}" data-k="${k}">
        <span class="hed-grip" aria-label="Перетягни, щоб пересунути">☰</span>
        ${d[3] ? `<span class="grow hed-lbl"><span class="ic ${d[3].ic} hed-ic">${icon(d[3].icon, 16)}</span><span><span class="b" style="display:block">${esc(d[1])}</span><span class="xs muted">${esc(d[2])}</span></span></span><button type="button" class="icon-btn sm" data-a="homeDel" data-k="${k}" aria-label="Прибрати з головної">✕</button>`
          : `<label class="grow hed-lbl"><input type="checkbox" data-ch="homeToggle" data-k="${k}"${on ? ' checked' : ''}><span><span class="b" style="display:block">${esc(d[1])}</span><span class="xs muted">${esc(d[2])}</span></span></label>`}
        <button type="button" class="icon-btn sm" data-a="homeMove" data-k="${k}" data-v="-1" aria-label="Вище"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="icon-btn sm" data-a="homeMove" data-k="${k}" data-v="1" aria-label="Нижче"${i === rows.length - 1 ? ' disabled' : ''}>▼</button>
      </div>`;
    }).join('')}</div>`;
    h += '<div class="xs muted" style="text-align:center">Тягни за ☰ або тисни стрілки. Сховані блоки нікуди не зникають — їх можна повернути будь-коли.</div>';
    // додати з «Ще»
    const free = links.filter((x) => L.order.indexOf('m_' + x.k) < 0);
    if (free.length) {
      h += '<div class="sec">Додати з «Ще»</div>';
      let grp = '';
      h += `<div class="card list">${free.map((x) => {
        const head = x.grp !== grp ? `<div class="xs muted hed-grp">${esc(x.grp)}</div>` : '';
        grp = x.grp;
        return head + `<button type="button" class="li" data-a="homeAdd" data-k="${esc(x.k)}"><span class="ic ${x.ic}">${icon(x.icon, 18)}</span><span class="grow"><span class="b" style="display:block">${esc(x.label)}</span><span class="small muted">${esc(x.sub || '')}</span></span><span class="hed-plus" aria-hidden="true">+</span></button>`;
      }).join('')}</div>`;
    }
    h += `<div class="grid2"><button type="button" class="btn ghost" data-a="homeReset">Як було</button><button type="button" class="btn" data-a="homeSave"${S.homeBusy ? ' disabled' : ''}>Готово</button></div>`;
    return h;
  }

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
    const types = TYPES.filter((t) => canType(t.k)).map((t) => t.k);
    const t = types.indexOf(type) >= 0 ? type : (S.add && types.indexOf(S.add.type) >= 0 ? S.add.type : types[0]);
    const teams = (c.report[t] || []);
    S.add = {
      type: t, teamId: teams.indexOf(teamId) >= 0 ? teamId : myTeamFirst(teams), mode: 'event', date: ymd(new Date()),
      teens: 0, newT: 0, leaders: t === 'mg' ? 1 : 0, parents: 0, hours: 1, topic: '', note: '', mark: false, att: {},
    };
  }
  const FIELDS = {
    club: [['teens', 'Підлітків усього', 1], ['newT', 'З них нових', 1], ['leaders', 'Лідерів', 1]],
    mg: [['teens', 'Підлітків', 1], ['newT', 'З них нових', 1], ['leaders', 'Лідерів', 1]],
    kr: [['hours', 'Годин з підлітками', 0.5]],
  };
  // «За які команди я вношу клуб» — щоб не перевантажувати «Внести»
  function clubPickView() {
    const c = caps(), all = c.clubAll || [], sel = c.report.club || [];
    const P = S.clubPick || (S.clubPick = { on: {} });
    let h = header('За які команди я вношу клуб', 'Решту команд вносять їхні капітани чи адміни');
    h += `<div class="card list"><label class="check"><input type="checkbox" data-ch="clubPickAll"${all.every((id) => P.on[id]) ? ' checked' : ''}><span class="grow b">Усі команди (${all.length})</span></label>
      ${all.map((id) => { const t = teamById(id) || {}; return `<label class="check"><input type="checkbox" data-ch="clubPickT" data-id="${esc(id)}"${P.on[id] ? ' checked' : ''}><span class="grow"><span style="display:block">${esc(t.name || id)}</span>${(() => { const ar = (struct().areas || []).filter((x) => x.id === t.areaId)[0]; return ar ? `<span class="xs muted">Ерія ${esc(ar.name)}</span>` : ''; })()}</span></label>`; }).join('')}</div>
      <div class="small muted">Нічого не обрано — вкладки «Клуб» у тебе не буде: вносиш лише свою статистику. Право вносити клуб лишається — можна повернути будь-коли.</div>
      <div class="grid2"><button type="button" class="btn ghost" data-a="clubPickClose">Скасувати</button><button type="button" class="btn" data-a="clubPickSave">Зберегти</button></div>`;
    return h;
  }
  VIEWS.add = function () {
    if (S.clubPickOpen) return clubPickView();
    const c = caps();
    const link = (c.clubAll || []).length ? `<button type="button" class="link-btn small" style="align-self:center;margin-top:6px" data-a="clubPickOpen">⚙ За кого я вношу клуб · ${(c.report.club || []).length ? (c.report.club.length === c.clubAll.length ? 'усі команди' : c.report.club.length + ' з ' + c.clubAll.length) : 'лише за себе'}</button>` : '';
    return addViewInner() + link;
  };
  function addViewInner() {
    const c = caps(), a = S.add;
    const types = TYPES.filter((t) => canType(t.k));
    const kn = canKnownAdd();
    const fin = (c.financeEdit || []).length > 0;
    const showFin = fin && (S.addFin || (!types.length && !kn));
    let h = header('Внести');
    if (types.length + (kn ? 1 : 0) + (fin ? 1 : 0) > 1) h += `<div class="seg">${types.map((t) => `<button type="button" class="${a && t.k === a.type && !S.addKnown && !showFin ? 'on' : ''}" data-a="addType" data-type="${t.k}">${t.short}</button>`).join('')}${kn ? `<button type="button" class="${!showFin && (S.addKnown || !types.length) ? 'on' : ''}" data-a="addKnownTab">Знані</button>` : ''}${fin ? `<button type="button" class="${showFin ? 'on' : ''}" data-a="addFinTab">Каса</button>` : ''}</div>`;
    if (showFin) return h + finAddView();
    if (S.addKnown || !types.length) {
      if (!kn) return h + '<div class="empty">Для твоєї ролі немає що вносити</div>';
      return h + `<div class="card col"><h2>Знані по імені</h2><div class="small muted">Підлітки, яких ти знаєш по імені. Можна додати одного з контактами або одразу цілий список імен.</div>
        <button type="button" class="btn" data-a="addKnownGo" data-m="one">${icon('plus', 18)} Додати одного</button>
        <button type="button" class="btn sec2" data-a="addKnownGo" data-m="bulk">Додати списком</button>
        <button type="button" class="link-btn" data-a="tabGo" data-s="known">Відкрити мій список знаних →</button></div>`;
    }
    if (!a || !a.type) return h + '<div class="empty">Для твоєї ролі немає звітів</div>';
    if (a.type === 'club') {
      h += teamSelect(c.report[a.type], a.teamId, 'addTeam');
      const lc = (me().lastClubs || {})[a.teamId];
      h += `<div class="xs muted" style="margin-top:-4px">${lc ? 'Останній внесений клуб: ' + esc(fmtDay(lc.date)) + (lc.none ? ' · клубу не було' : ' · ' + lc.leaders + ' л · ' + lc.teens + ' п') : 'Клубів цієї команди ще не вносили'}</div>`;
    }
    else { const ts = c.report[a.type] || []; h += `<div class="small muted">Вносиш за себе · зараховується ${ts.length ? (ts.length > 1 ? 'всім твоїм командам: ' : 'команді ') + '<b>' + esc(ts.map(teamName).join(', ')) + '</b>' : '<b>' + esc((c.reportSelf || {}).unit || '') + '</b>'}</div>`; }
    // клуб — лише окремою подією з датою, коли він відбувся
    if (a.type === 'club') a.mode = 'event';
    else h += `<div class="pills">${[['event', 'Окрема подія'], ['week', 'Підсумок тижня']].map((m) => `<button type="button" class="pill${a.mode === m[0] ? ' on' : ''}" data-a="addMode" data-m="${m[0]}">${m[1]}</button>`).join('')}</div>`;
    h += '<div class="card rows">';
    h += a.mode === 'event'
      ? `<div class="stepper"><label for="addDate" style="font-weight:500">Дата</label><input id="addDate" class="in" style="width:auto;min-height:40px" type="date" value="${esc(a.date)}" max="${ymd(new Date())}" data-bind="add.date"></div>`
      : `<div class="stepper"><span style="font-weight:500">Тиждень</span><span class="b">${esc(me().week ? me().week.label : 'цей тиждень')}</span></div>`;
    // Capernaum: на клубі рахуємо ще й батьків
    const flds = FIELDS[a.type].concat(a.type === 'club' && (teamById(a.teamId) || {}).dir === 'Capernaum' ? [['parents', 'Батьків', 1]] : []);
    h += flds.map((f) => `<div class="stepper"><label for="st_${f[0]}" style="font-weight:500">${f[1]}</label><span class="ctl">
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
  }

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
      <span class="grow"><span class="b" style="display:block">${esc(e.title)}</span><span class="small muted">${e.repLabel ? '🔁 ' : ''}${going ? '<b style="color:var(--teal)">триває</b> · ' : ''}${e.end ? 'до ' + esc(fmtShortDay(e.end)) + ' · ' : ''}${esc(e.levelLabel)}${e.place ? ' · ' + esc(e.place) : ''}${e.time ? ' · ' + esc(e.time) : ''}</span></span>
      ${e.isGoing ? '<span class="xs b" style="color:var(--teal)">Йду</span>' : ''}</button>`;
  }
  VIEWS.calendar = function () {
    const c = caps();
    if (S.evForm) return evFormView();
    if (S.ev) return evDetailView();
    let h = header('Календар Young Life', '', (c.eventUnits || []).length ? `<button type="button" class="icon-btn accent" data-a="evNew" aria-label="Додати подію">${icon('plus', 22)}</button>` : '');
    h += `<div class="pills">${[['all', 'Усі']].concat(Object.keys(LVL).map((k) => [k, LVL[k]])).map((l) => `<button type="button" class="pill${S.evFilter === l[0] ? ' on' : ''}" data-a="evFilter" data-l="${l[0]}">${l[1]}</button>`).join('')}</div>`;
    if (!S.events) return h + loading();
    const all = S.events.filter((e) => S.evFilter === 'all' || e.level === S.evFilter);
    if (!all.length) return h + '<div class="empty">Подій немає</div>';
    // найближчий місяць; решта — за кнопкою «Усі»
    const soon = all.filter(inMonth), list = S.evAll ? all : soon;
    if (!list.length) h += '<div class="empty small">У найближчий місяць подій немає</div>';
    let cur = '';
    list.forEach((e) => { const m = evDateParts(e).month; if (m !== cur) { cur = m; h += `<div class="sec">${esc(m)}</div>`; } h += evCard(e); });
    if (all.length > soon.length) h += `<button type="button" class="btn sec2" data-a="evAll">${S.evAll ? 'Лише найближчий місяць' : 'Усі події · ще ' + (all.length - soon.length)}</button>`;
    return h;
  }
  const inMonth = (e) => e.date <= ymd(new Date(Date.now() + 31 * 864e5));
  const evUnits = (f) => { const u = (caps().eventUnits || []).slice(); if (f && f.extraUnit && !u.some((x) => x.level === f.extraUnit.level && x.unitId === f.extraUnit.unitId)) u.push(f.extraUnit); return u; };
  function evDetailView() {
    const e = (S.events || []).filter((x) => x.id === S.ev)[0];
    if (!e) return header('Подія') + '<div class="empty">Подію не знайдено</div>';
    const p = evDateParts(e);
    let h = header(e.title, '', '');
    h += `<div><span class="tag lvl-${e.level}">${esc(e.levelLabel)}</span></div>`;
    h += `<div class="card rows"><div class="kv"><span>Коли</span><span>${esc(fmtRange(e))}${e.time ? ', ' + esc(e.time) : ''}</span></div>
      ${e.repLabel ? `<div class="kv"><span>Повторюється</span><span>🔁 ${esc(e.repLabel)}${e.until ? ' до ' + esc(fmtShortDay(e.until)) : ''}</span></div>` : ''}
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
      h += e.seriesId
        ? `<button type="button" class="btn sec2" data-a="evEdit" data-id="${esc(e.id)}">Редагувати всю серію</button><div class="grid2"><button type="button" class="btn ghost" data-a="evDelete" data-id="${esc(e.id)}" data-only="1">Скасувати цю дату</button><button type="button" class="btn ghost" data-a="evDelete" data-id="${esc(e.id)}" data-series="1">Видалити серію</button></div>`
        : `<div class="grid2"><button type="button" class="btn sec2" data-a="evEdit" data-id="${esc(e.id)}">Редагувати</button><button type="button" class="btn ghost" data-a="evDelete" data-id="${esc(e.id)}">Видалити</button></div>`;
    }
    return h;
  }
  const AUD_GROUPS = [['all', 'Усім'], ['leaders', 'Лідерам і вище'], ['captains', 'Капітанам і вище'], ['heads', 'Керівництву ерій і регіонів']];
  const audRoles = (g) => S.me.roleDefs.filter((r) => !r.titled && (g === 'leaders' ? r.rank <= 9 : g === 'captains' ? r.rank <= 6 : g === 'heads' ? r.rank <= 5 : false)).map((r) => r.key);
  function rolesField(scr, f, hint) {
    const sel = f.roles = (f.roles || []).filter((k) => roleDef(k).label);
    const grp = !sel.length ? 'all' : (AUD_GROUPS.filter((g) => g[0] !== 'all' && audRoles(g[0]).join() === sel.slice().sort((a, b) => roleDef(a).rank - roleDef(b).rank).join())[0] || [''])[0];
    return `<div class="pills" style="flex-wrap:wrap">${AUD_GROUPS.map((g) => `<button type="button" class="pill${grp === g[0] ? ' on' : ''}" data-a="audGroup" data-s="${scr}" data-g="${g[0]}">${g[1]}</button>`).join('')}<button type="button" class="pill${sel.length && !grp ? ' on' : ''}" data-a="audCustom" data-s="${scr}">Вибрати ролі</button></div>
      ${f.audOpen || (sel.length && !grp) ? `<div class="pills" style="flex-wrap:wrap">${S.me.roleDefs.filter((r) => !r.hidden).map((r) => `<button type="button" class="pill${sel.indexOf(r.key) >= 0 ? ' on' : ''}" style="min-height:34px" data-a="audRole" data-s="${scr}" data-k="${r.key}">${esc(r.label)}</button>`).join('')}</div>` : ''}
      ${hint ? `<span class="xs muted" style="font-weight:400">${hint(sel)}</span>` : ''}`;
  }
  function audienceField(f) {
    const pk = picker('event');
    return `<div class="f"><span>Для кого (хто бачить подію і може піти)</span>
      ${pk ? `<div class="xs muted" style="font-weight:400">Де:</div>${pk}<div class="xs muted" style="font-weight:400;margin-top:4px">Ролі:</div>` : ''}
      ${rolesField('event', f, (sel) => (sel.length ? 'Бачать лише: ' + esc(sel.map((k) => roleDef(k).label).join(', ')) + (pk ? ' — у вибраних ' + esc(pickLabel('event').toLowerCase().indexOf('вибрано') === 0 ? 'місцях' : pickLabel('event')) : '') + '. Ти й керівники рівня бачать завжди.' : 'Бачать усі ролі у вибраних місцях і вище.'))}</div>`;
  }
  const audState = (scr) => (scr === 'event' ? S.evForm : scr === 'task' ? S.tasks.form : scr === 'poll' ? S.polls.form : S.bc);
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
      <div class="grid2"><label class="f"><span>Повторювати</span><select class="in" data-bind="evForm.rep" data-ch="evRep">${[['', 'Не повторювати'], ['week', 'Щотижня'], ['2week', 'Раз на 2 тижні'], ['month', 'Щомісяця']].map((o) => `<option value="${o[0]}"${(f.rep || '') === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
      ${f.rep ? `<label class="f"><span>Повторювати до</span><input class="in" type="date" data-bind="evForm.until" value="${esc(f.until || '')}" min="${esc(f.date)}"></label>` : '<span></span>'}</div>
      ${f.rep ? '<div class="xs muted" style="margin-top:-6px">«Повторювати до» можна залишити порожнім — тоді без кінця. Кожну дату можна скасувати окремо.</div>' : ''}
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
    // що показати — окремі плитки з іконками (інший вигляд, ніж вибір регіону / ерії / команди)
    const CAT_IC = { overview: ['stats', 'cc-teal'], people: ['profile', 'cc-blue'], club: ['club', 'cc-coral'], mg: ['mg', 'cc-purple'], kr: ['kr', 'cc-blue'], known: ['known', 'cc-yellow'], finance: ['doc', 'cc-green'] };
    if (d.cats.length > 1) h += `<div class="sec" style="margin-bottom:-4px">Що показати</div><div class="cat-strip">${d.cats.map((c) => { const k = CAT_IC[c.key] || ['stats', 'cc-teal']; return `<button type="button" class="cat-t ${k[1]}${c.key === (st.loading ? st.cat : d.cat) ? ' on' : ''}" data-a="statsCat" data-c="${c.key}"><span class="cat-i">${icon(k[0], 20)}</span><span>${esc(c.label)}</span></button>`; }).join('')}</div>`;
    h += periodBar(st, 'stats');
    // за кого зараз показано статистику
    { const LV = { region: 'Регіон ', area: 'Ерія ', team: 'Команда ' }; const sc = d.scope || {}; const pth = d.path || [];
      const main = sc.level === 'nat' ? 'Уся Україна' : sc.level === 'multi' ? sc.label : sc.level === 'office' ? 'Національний офіс' : (LV[sc.level] || '') + (pth.length ? pth[pth.length - 1].label : sc.name || '');
      const up = sc.level === 'multi' || sc.level === 'nat' || sc.level === 'office' ? '' : pth.slice(0, -1).map((p) => p.label).join(' › ');
      h += `<div class="stat-who">📍 Показано: <b>${esc(main)}</b>${up ? `<span class="xs muted"> · ${esc(up)}</span>` : ''}</div>`; }
    h += `<div class="xs muted">${st.loading ? 'Оновлюю…' : 'Дані живі: оновлюються одразу після внесення' + (st.at ? ' · ' + st.at : '')} · <button type="button" class="link-btn xs" data-a="statsReload">↻ оновити</button>${d.cat === 'known' ? '<br>Знані «Без команди» рахуються на рівні ерії чи регіону того, хто вніс.' : ''}</div>`;
    h += `<div class="kpis">${d.kpis.map((k) => `<div class="card kpi"><div class="v">${esc(k.v)}</div><div class="l">${esc(k.l)}</div></div>`).join('')}</div>`;

    if (d.trend && d.trend.points.length) h += trendCard(d.trend);
    const bars = d.chart.bars, max = Math.max.apply(null, bars.map((x) => x.v).concat([1]));
    const short = (v) => d.cat === 'kr' ? df(v) : v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? df(v / 1000) + 'k' : nf(v);
    h += `<div class="card"><h2>${esc(d.chart.title)}</h2><div class="small muted" style="margin-bottom:12px">${esc(d.chart.sub)}</div>
      <div class="chart">${bars.map((x, i) => `<div class="bar${i === bars.length - 1 ? ' last' : ''}"><span>${x.v ? short(x.v) : ''}</span><i style="height:${Math.max(2, Math.round(x.v / max * 118))}px"></i></div>`).join('')}</div>
      <div class="chart-labels">${bars.map((x) => `<span>${esc(x.label)}</span>`).join('')}</div></div>`;
    // розбивка — головний спосіб навігації вниз
    const b = d.breakdown;
    if (b.rows.length) {
      let rows = b.rows.slice();
      const sort = st.sort === 'name' ? 'name' : 'value';
      if (sort === 'name') rows.sort((x, y) => x.name.localeCompare(y.name));
      const many = rows.length > 8;
      const shown = many && !st.showAll ? rows.slice(0, 8) : rows;
      const rmax = Math.max.apply(null, b.rows.map((r) => r.value).concat([1]));
      const COL = ['var(--coral)', 'var(--yellow)', 'var(--turq)', 'var(--blue)', 'var(--purple)', 'var(--pink)'];
      const hasRep = rows.some((r) => r.total != null);
      h += `<div class="card col" style="gap:4px"><div class="row between"><h2>${esc(b.title)} · ${b.rows.length}</h2></div>
        <div class="xs muted">Показник: ${esc(b.metric)}${hasRep ? ' · «здали» — ' + esc(b.repLabel) + ' цього тижня' : ''}</div>
        <div class="pills" style="margin:6px 0 4px">${[['value', 'Більше'], ['name', 'А–Я']].map((s) => `<button type="button" class="pill${sort === s[0] ? ' on' : ''}" style="min-height:34px" data-a="statsSort" data-s="${s[0]}">${s[1]}</button>`).join('')}</div>
        ${many ? '<input class="in" type="search" placeholder="Пошук у списку" data-live="statsRowFind" style="min-height:42px;margin-bottom:4px">' : ''}
        <div id="brkList">${shown.map((r, i) => {
          const lag = r.total != null && r.done < r.total;
          return `<button type="button" class="brk" data-q="${esc(r.name.toLowerCase())}" ${r.drill ? `data-a="statsDrill" data-k="${esc(r.drill)}"` : 'disabled style="cursor:default;opacity:1"'}>
            <span class="row between" style="width:100%;gap:8px"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.drill ? ' <span class="muted">›</span>' : ''}</span>
            ${r.total != null ? `<span class="tag ${lag ? 'warn' : 'ok'}" style="flex:0 0 auto">здали ${r.done}/${r.total}</span>` : ''}<span class="b" style="flex:0 0 auto;min-width:44px;text-align:right">${esc(r.text)}</span></span>
            <span class="track" style="width:100%"><i style="width:${Math.round(r.value / rmax * 100)}%;background:${COL[i % 6]};border-radius:4px"></i></span>
            ${r.last != null ? `<span class="xs ${r.last ? 'muted' : ''}" style="align-self:flex-start${r.last ? '' : ';color:var(--accent-text)'}">${r.last ? 'останній звіт за клуб: ' + esc(fmtDay(r.last)) + (r.lastNone ? ' (не було)' : '') : 'звітів за клуб ще не було'}</span>` : ''}</button>`;
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
    if (d.club) h += clubHistory(d.club);
    if ((d.recent || []).length) h += recentCard(d.recent);
    return h;
  };
  // «Останні внесені» — свіжі записи в цій ланці
  function recentCard(list) {
    const T = { club: 'Клуб', mg: 'Мала група', kr: 'КР' };
    const shown = S.stats.recentAll ? list : list.slice(0, 5);
    const nums = (r) => (r.none ? 'не було' : r.type === 'kr' ? fmtNum(r.hours) + ' год' : r.teens + ' п' + (r.newT ? ' (нових ' + r.newT + ')' : '') + (r.leaders ? ' · ' + r.leaders + ' л' : '') + (r.parents ? ' · ' + r.parents + ' батьків' : ''));
    return `<div class="card col" style="gap:6px"><div class="row between"><h2>Останні внесені</h2><span class="xs muted">${list.length}</span></div>
      ${shown.map((r) => `<div class="ch-row"><div class="row between" style="gap:8px"><span><span class="tag">${T[r.type]}</span> <span class="b">${esc(fmtDay(r.date))}</span></span><span class="small b">${esc(nums(r))}</span></div>
        <div class="xs muted">${r.team ? esc(r.team) + ' · ' : ''}${esc(r.author || '—')}${r.created ? ' · внесено ' + esc(fmtDay(String(r.created).slice(0, 10))) : ''}</div></div>`).join('')}
      ${list.length > 5 ? `<button type="button" class="link-btn" data-a="recentMore">${S.stats.recentAll ? 'Згорнути' : 'Показати ще (' + (list.length - 5) + ')'}</button>` : ''}</div>`;
  }
  // історія звітів за клуб однієї команди (внизу статистики) + «змінити»
  function clubHistory(cl) {
    const E = S.stats.clubEdit;
    let h = `<div class="card col" style="gap:6px"><div class="row between"><h2>Історія звітів за клуб</h2><span class="xs muted">${cl.history.length}</span></div>
      <div class="small muted">${cl.last ? 'Останній звіт: ' + esc(fmtDay(cl.last)) : 'Звітів за клуб ще не було'}</div>`;
    if (!cl.history.length) return h + '</div>';
    const n = (k, v) => `<span class="ch-n"><b>${v}</b><span class="xs muted">${k}</span></span>`;
    const all = S.stats.histAll;
    const shownH = all ? cl.history : cl.history.slice(0, 5);
    h += shownH.map((r) => {
      if (E && E.id === r.id) {
        const inp = (k, l) => `<label class="f" style="flex:1;min-width:70px"><span>${l}</span><input class="in" type="number" min="0" inputmode="numeric" data-bind="stats.clubEdit.${k}" value="${esc(E[k])}"></label>`;
        return `<div class="ch-row col" style="gap:8px">
          <label class="f"><span>Дата</span><input class="in" type="date" data-bind="stats.clubEdit.date" value="${esc(E.date)}"></label>
          <label class="toggle-row" style="padding:0"><span class="small">Клубу не було</span><input type="checkbox" data-ch="clubEditNone"${E.none ? ' checked' : ''}></label>
          ${E.none ? '' : `<div class="row wrap" style="gap:8px">${inp('teens', 'Підлітків')}${inp('newT', 'Нових')}${inp('leaders', 'Лідерів')}${cl.capernaum || E.parents ? inp('parents', 'Батьків') : ''}</div>`}
          <label class="f"><span>Нотатка</span><input class="in" type="text" data-bind="stats.clubEdit.note" value="${esc(E.note || '')}"></label>
          <div class="grid2"><button type="button" class="btn ghost sm" data-a="clubEditCancel">Скасувати</button><button type="button" class="btn sm" data-a="clubEditSave">Зберегти</button></div>
          <button type="button" class="link-btn danger-t" data-a="clubDelete" data-id="${esc(r.id)}">🗑 Видалити цей звіт</button></div>`;
      }
      return `<div class="ch-row"><div class="row between" style="gap:8px"><span class="b">${esc(fmtDay(r.date))}${r.week ? ' <span class="xs muted">· підсумок тижня</span>' : ''}</span>
          ${cl.canEdit ? `<button type="button" class="link-btn" data-a="clubEditOpen" data-id="${esc(r.id)}">змінити</button>` : ''}</div>
        ${r.none ? '<div class="small muted">Клубу не було</div>' : `<div class="row" style="gap:14px;flex-wrap:wrap">${n('підлітків', r.teens)}${n('нових', r.newT)}${n('лідерів', r.leaders)}${cl.capernaum || r.parents ? n('батьків', r.parents) : ''}</div>`}
        ${r.note ? `<div class="xs muted">${esc(r.note)}</div>` : ''}<div class="xs muted">вніс(ла): ${esc(r.author || '—')}</div></div>`;
    }).join('');
    if (cl.history.length > 5) h += `<button type="button" class="link-btn" data-a="histAll">${all ? 'Згорнути' : 'Показати ще (' + (cl.history.length - 5) + ')'}</button>`;
    return h + '</div>';
  }

  // ───────────── СТРУКТУРА (ерії й команди) ─────────────
  VIEWS.structure = function () {
    const t = S.tree;
    let h = header('Ерії та команди', 'Додавай, перейменовуй, закривай');
    if (S.structEdit) {
      const e = S.structEdit;
      const title = e.kind === 'area' ? (e.id ? 'Перейменувати ерію' : 'Нова ерія · ' + e.parentName) : (e.id ? 'Змінити команду' : 'Нова команда · ' + e.parentName);
      h += `<div class="card col"><h2>${esc(title)}</h2><label class="f"><span>Назва</span><input class="in" type="text" data-bind="structEdit.name" value="${esc(e.name)}" maxlength="60"></label>
        ${e.kind === 'team' ? `<div class="f"><span>Напрям роботи</span><div class="pills" style="flex-wrap:wrap">${DIRS.map((x) => `<button type="button" class="pill${e.dir === x ? ' on' : ''}" data-a="structDir" data-v="${x}">${x}</button>`).join('')}</div></div>` : ''}
        <div class="row"><button type="button" class="btn sec2 sm" data-a="structCancel">Скасувати</button><button type="button" class="btn sm grow" data-a="structSave">Зберегти</button></div></div>`;
    }
    if (S.structDelS) h += structDelView();
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
              <span class="grow"><span class="b" style="display:block${tm.state === 'closed' ? ';opacity:.55' : ''}">${esc(tm.name)}${tm.dir ? ` <span class="tag" style="font-size:11px;padding:1px 7px">${esc(tm.dir)}</span>` : ''}</span><span class="xs muted">${tm.people} ${tm.people % 10 === 1 && tm.people % 100 !== 11 ? 'людина' : 'людей'}</span></span>${ST_TAG[tm.state]}
              ${a.canEditTeams ? `<button type="button" class="btn ghost sm" style="min-height:36px;padding:0 10px" data-a="structEditTeam" data-id="${esc(tm.id)}" data-name="${esc(tm.name)}" data-dir="${esc(tm.dir || '')}">Змінити</button>
              ${tm.state === 'active' ? `<button type="button" class="btn ghost sm" style="min-height:36px;padding:0 10px" data-a="structTeamState" data-id="${esc(tm.id)}" data-s="closed" data-name="${esc(tm.name)}">Закрити</button>`
                : `<button type="button" class="btn teal sm" style="min-height:36px;padding:0 10px" data-a="structTeamState" data-id="${esc(tm.id)}" data-s="active" data-name="${esc(tm.name)}">${tm.state === 'pending' ? 'Активувати' : 'Відкрити'}</button>`}
              <button type="button" class="icon-btn" style="width:36px;height:36px;color:var(--pink)" data-a="structDel" data-id="${esc(tm.id)}" data-name="${esc(tm.name)}" aria-label="Видалити команду ${esc(tm.name)}">✕</button>` : ''}</div>`).join('')
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

const DIRS = ['YoungLife', 'WyldLife', 'College', 'Capernaum', 'YoungMoms'];
  const LEVELS = [['nat', 'Україна'], ['region', 'Регіон'], ['area', 'Ерія'], ['team', 'Команда']];
  const byName = (a, b) => a.name.localeCompare(b.name);

  // ───────────── ЄДИНИЙ ВИБІР: регіон / ерія / команда (одна або кілька) ─────────────
  const scopeBy = () => { const m = {}; (S.me.statScopes || []).concat(S.me.scopes || []).forEach((x) => { m[x.key] = x; }); return m; };
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
    // статистика: директор ерії бачить увесь свій регіон
    if ((scr === 'stats' || scr === 'dirs') && S.me.statScopes) return S.me.statScopes;
    if (scr === 'report') return S.me.reportScopes || (caps().isSuper ? sc : sc.filter((x) => x.depth <= 1));
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
  // стан вибору: keys — що вибрано; ctx — чиїх «дітей» показуємо (регіони України, ерії регіону, команди ерії)
  function pkTree(scr) {
    const units = unitsFor(scr), by = {};
    units.forEach((x) => { by[x.key] = x; });
    const kids = (k) => units.filter((x) => (k ? x.parent === k : !by[x.parent])).sort(byName);
    return { units: units, by: by, kids: kids };
  }
  function ctxFor(T, key) {
    const x = T.by[key];
    if (!x) return '';
    if (T.kids(key).length) return key;           // є що вибирати глибше — показуємо дітей
    return T.by[x.parent] ? x.parent : '';         // команда — лишаємось серед сусідів
  }
  function makePick(scr, keys, multi) {
    const T = pkTree(scr);
    const ks = (keys || []).filter((k) => T.by[k]);
    const first = ks[0] || (T.units[0] && T.units[0].key);
    S.pick[scr] = { keys: first ? (ks.length ? ks : [first]) : [], ctx: first ? (ks.length > 1 ? (T.by[T.by[ks[0]].parent] ? T.by[ks[0]].parent : '') : ctxFor(T, first)) : '', multi: !!multi || ks.length > 1 };
    return S.pick[scr];
  }
  function ensurePick(scr, prefer) {
    const T = pkTree(scr);
    const P = S.pick[scr];
    if (P && P.keys.length && P.keys.every((k) => T.by[k])) return P;
    const k0 = (prefer || []).filter((k) => T.by[k])[0];
    return makePick(scr, k0 ? [k0] : [], P ? P.multi && false : false);
  }
  const ownTeamKeys = (scr) => { const list = caps()[PICK_TEAMS[scr]] || []; const id = (S.me.myTeams || []).map((t) => t.id).filter((x) => list.indexOf(x) >= 0)[0]; return id ? ['t:' + id] : []; };
  function setPick(scr, key) { makePick(scr, [key], false); }
  function levelTarget(units, curKey, level) {
    const by = {};
    units.forEach((x) => { by[x.key] = x; });
    const cur = by[curKey];
    const ORD = LEVELS.map((l) => l[0]);
    let t = '';
    if (cur && ORD.indexOf(level) <= ORD.indexOf(cur.level)) { for (let k = cur.key; k && by[k]; k = by[k].parent) if (by[k].level === level) { t = k; break; } }
    else if (cur) {
      const under = (x) => { for (let k = x.parent; k && by[k]; k = by[k].parent) if (k === cur.key) return true; return false; };
      const c = units.filter((x) => x.level === level && under(x)).sort(byName); t = c[0] ? c[0].key : '';
    }
    if (!t) { const c = units.filter((x) => x.level === level).sort(byName); t = c[0] ? c[0].key : ''; }
    return t;
  }
  const LV_PLURAL = { region: 'Регіони', area: 'Ерії', team: 'Команди', nat: 'Україна' };
  const LV_OF = { nat: 'України', region: 'регіону', area: 'ерії' };
  function picker(scr) {
    const P = S.pick[scr];
    const T = pkTree(scr);
    if (!P || T.units.length < 2) return '';
    const ctxU = T.by[P.ctx];
    const list = T.kids(P.ctx);
    const shownLevel = (list[0] || ctxU || T.by[P.keys[0]] || {}).level;
    const lv = LEVELS.filter((l) => l[0] !== 'nat' && T.units.some((x) => x.level === l[0])); // «Україна» = «Усі» серед регіонів
    const allOn = ctxU && P.keys.length === 1 && P.keys[0] === P.ctx;
    let h = `<div class="col pick" id="pk-${scr}" style="gap:8px">`;
    if (lv.length > 1) h += `<div class="seg" role="tablist" aria-label="Рівень">${lv.map((l) => `<button type="button" role="tab" aria-selected="${l[0] === shownLevel}" class="${l[0] === shownLevel ? 'on' : ''}" data-a="pkLevel" data-s="${scr}" data-l="${l[0]}">${l[1]}</button>`).join('')}</div>`;
    if (list.length) {
      if (ctxU) h += `<div class="xs muted" style="margin:-2px 0 -4px">${esc(LV_PLURAL[shownLevel] || '')} ${esc(LV_OF[ctxU.level] || '')} ${esc(ctxU.level === 'nat' ? '' : ctxU.name)}</div>`;
      if (list.length > 10) h += `<input class="in" type="search" style="min-height:40px" placeholder="Знайти…" data-live="pkFind" data-s="${scr}" aria-label="Пошук">`;
      h += `<div class="pills lvl">${ctxU ? `<button type="button" class="pill${allOn ? ' on' : ''}" data-a="pkAll" data-s="${scr}" aria-pressed="${!!allOn}">Усі</button>` : ''}${list.map((x) => {
        const on = P.keys.indexOf(x.key) >= 0;
        return `<button type="button" class="pill${on ? ' on' : ''}" data-a="pkUnit" data-s="${scr}" data-k="${esc(x.key)}" data-q="${esc(x.name.toLowerCase())}" aria-pressed="${on}">${esc(x.name)}</button>`;
      }).join('')}${list.length > 1 ? `<button type="button" class="pill multi${P.multi ? ' on' : ''}" data-a="pkMulti" data-s="${scr}" aria-pressed="${P.multi}">${P.multi ? '☑' : '☐'} Кілька</button>` : ''}</div>`;
      if (P.multi && P.keys.length > 1) h += `<div class="xs muted">Вибрано: ${P.keys.length} · <button type="button" class="link-btn xs" data-a="pkAll" data-s="${scr}">скинути</button></div>`;
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
    if (scr === 'dirs') loadDirs();
    if (scr === 'inst') loadInst();
    if (scr === 'known') { S.known.detail = null; loadKnown(); }
    if (scr === 'team') { S.team.open = null; loadTeam(); }
    if (scr === 'finance') loadFin();
    if (scr === 'report') { S.rep.data = null; render(); }
    if (scr === 'broadcast') loadBcCount();
    if (scr === 'task' || scr === 'poll') loadAudCount(scr);
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
    let h = header(LV_NAME[u.level] + u.name, [u.dir, unitCounts(u)].filter(Boolean).join(' · '));
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
          ${ppl.map((o) => `<button type="button" class="li" data-a="myylGo" data-k="${esc(o.x.key)}" data-q="${esc(o.p.name.toLowerCase())}">${avaHtml(o.p.tgId, o.p.name)}<span class="grow"><span class="b" style="display:block">${esc(o.p.name)}</span><span class="small muted">${esc(o.p.roles[0] + ' · ' + o.x.name)}</span></span></button>`).join('')}
          <div class="li small muted" data-empty>Нічого не знайдено</div></div>`;
    }
    h += '<div id="myylMain" style="display:contents">';
    // люди цього рівня
    h += `<div class="sec">${LV_PEOPLE[u.level]}</div>`;
    if (!u.people.length) h += `<div class="empty small">${u.level === 'team' ? 'У команді ще нікого немає' : 'На цьому рівні ще немає людей з ролями'}</div>`;
    else {
      h += `<div class="card list">${u.people.map((p) => {
        const open = m.open === p.tgId;
        return `<button type="button" class="li" data-a="myylPerson" data-id="${esc(p.tgId)}" aria-expanded="${open}">${avaHtml(p.tgId, p.name)}
          <span class="grow"><span class="b" style="display:block">${esc(p.name)}</span>
          <span class="row wrap" style="gap:6px;margin-top:4px">${p.roles.map((r) => `<span class="tag">${esc(r)}</span>`).join('')}</span></span></button>
          ${open ? `<div style="padding:0 16px 12px;border-bottom:1px solid var(--line)">${p.username
            ? `<button type="button" class="btn sec2 sm" style="width:100%" data-a="openUrl" data-url="https://t.me/${esc(encodeURIComponent(p.username))}">${icon('tg', 18)} Написати @${esc(p.username)}</button>`
            : '<div class="small muted">Немає публічного імені в Telegram</div>'}
            ${grantBtn(p.tgId, p.name, u.level, u.id)}${grantForm(p.tgId)}
            ${p.dropIds ? `<button type="button" class="btn ghost sm danger-t" style="margin-top:10px;width:100%" data-a="memberRemove" data-ids="${esc(p.dropIds.join(','))}" data-name="${esc(p.name)}" data-team="${esc(u.name)}" data-reg="${p.registered ? 1 : ''}">🗑 Видалити з «${esc(u.name)}»</button>` : ''}</div>` : ''}`;
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
      <div class="xs muted">${caps().isSuper && (S.pick.broadcast || { keys: [] }).keys.indexOf('nat') >= 0 ? 'На всю Україну — без підпису: просто повідомлення від бота.' : caps().isSuper ? 'Підпис: твоє імʼя й роль у цьому регіоні (напр. Регіональний Директор · West).' : 'Повідомлення буде з підписом: твоє імʼя й роль.'}</div></div>`;
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

  // ───────────── КАСА КОМАНДИ (у «Внести») ─────────────
  const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' ₴';
  const FIN_SRC = [['team', 'Зібрала команда'], ['office', 'Офіс'], ['church', 'Церква']];
  async function loadFx() {
    const F = S.fx, ids = caps().financeEdit || [];
    if (ids.indexOf(F.teamId) < 0) F.teamId = ids[0] || '';
    if (!F.teamId) return;
    F.loading = true; F.err = '';
    try { F.data = await api('finTx', { teamId: F.teamId }); } catch (e) { F.err = e.message; }
    F.loading = false;
    if (S.screen === 'add' && S.addFin) render();
  }
  function finAddView() {
    const F = S.fx, ids = caps().financeEdit || [];
    if (!F.date) F.date = ymd(new Date());
    let h = teamSelect(ids, F.teamId, 'fxTeam');
    if (F.err) return h + `<div class="empty">${esc(F.err)}</div>`;
    if (!F.data || F.data.teamId !== F.teamId) { if (!F.loading) loadFx(); return h + loading(); }
    const D = F.data;
    h += `<div class="card col" style="gap:4px;text-align:center"><div class="small muted">Каса команди${ids.length > 1 ? ' · ' + esc(teamName(F.teamId)) : ''}</div>
      <div class="b" style="font-size:32px;${D.balance < 0 ? 'color:var(--coral)' : ''}">${money(D.balance)}</div>
      <div class="small muted">Цього місяця: <b style="color:var(--teal)">+${money(D.month.inc)}</b> · <b>−${money(D.month.spent)}</b></div>
      ${F.adj ? `<div class="col" style="gap:8px;text-align:left;margin-top:8px;border-top:1px solid var(--line);padding-top:10px">
        <label class="f"><span>Скільки зараз реально в касі, ₴</span><input class="in" type="text" inputmode="decimal" autocomplete="off" data-bind="fx.adjBal" value="${esc(F.adjBal)}" placeholder="${esc(String(D.balance))}"></label>
        <label class="f"><span>Коментар (необовʼязково)</span><input class="in" type="text" maxlength="200" data-bind="fx.adjNote" value="${esc(F.adjNote || '')}" placeholder="Наприклад: давно не вели, перерахували гаманець"></label>
        <div class="grid2"><button type="button" class="btn" data-a="fxAdjSave">Зберегти баланс</button><button type="button" class="btn ghost" data-a="fxAdj">Скасувати</button></div>
        <div class="xs muted">Різниця запишеться як «Звірка балансу» — її видно в записах і можна скасувати.</div></div>`
        : '<button type="button" class="link-btn" style="align-self:center" data-a="fxAdj">Редагувати баланс</button>'}</div>`;
    h += `<div class="card col"><div class="seg"><button type="button" class="${F.kind === 'in' ? 'on' : ''}" data-a="fxKind" data-v="in">+ Дохід</button><button type="button" class="${F.kind === 'out' ? 'on' : ''}" data-a="fxKind" data-v="out">− Витрата</button></div>
      <label class="f"><span>Сума, ₴</span><input class="in" type="text" inputmode="decimal" autocomplete="off" data-bind="fx.amount" value="${esc(F.amount)}" placeholder="0"></label>
      ${F.kind === 'in' ? `<div class="f"><span>Звідки</span><div class="pills">${FIN_SRC.map((x) => `<button type="button" class="pill${F.src === x[0] ? ' on' : ''}" data-a="fxSrc" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>` : ''}
      <label class="f"><span>${F.kind === 'out' ? 'На що витратили' : 'Коментар (необовʼязково)'}</span><input class="in" type="text" maxlength="300" data-bind="fx.note" value="${esc(F.note)}" placeholder="${F.kind === 'out' ? 'Наприклад: піца на клуб' : 'Наприклад: пожертва після служіння'}"></label>
      <label class="f"><span>Дата</span><input class="in" type="date" data-bind="fx.date" value="${esc(F.date)}" max="${ymd(new Date())}"></label>
      <button type="button" class="btn" data-a="fxAdd"${F.busy ? ' disabled' : ''}>${F.kind === 'out' ? 'Записати витрату' : 'Записати дохід'}</button>
      <div class="xs muted">Кожен запис одразу потрапляє в місячний фінансовий звіт команди.</div></div>`;
    if (D.items.length) {
      h += `<div class="sec">Останні записи</div><div class="card list">${D.items.map((t) => `<div class="li" style="cursor:default"><span class="grow"><span class="b" style="display:block;color:${t.kind === 'adj' ? 'var(--text)' : t.kind === 'in' ? 'var(--teal)' : 'var(--coral)'}">${t.kind === 'adj' ? '⚖️ Звірка ' + (t.amount > 0 ? '+' : '−') + money(Math.abs(t.amount)) : (t.kind === 'in' ? '+' : '−') + money(t.amount)}</span>
        <span class="xs muted">${esc(fmtShortDay(t.date))} · ${esc([t.srcLabel, t.note].filter(Boolean).join(' · '))}${t.author ? ' · ' + esc(t.author) : ''}</span></span>
        <button type="button" class="btn ghost sm" style="min-height:32px;padding:0 10px" data-a="fxDel" data-id="${esc(t.id)}" aria-label="Видалити запис">✕</button></div>`).join('')}</div>`;
    }
    h += '<button type="button" class="link-btn" data-a="tabGo" data-s="finance">Місячний фінансовий звіт →</button>';
    return h;
  }

  // ───────────── ДОЗВОЛИ Й ДОСТУП ─────────────
  const PERM_GROUPS = [['rep', 'Які звіти заповнювати'], ['see', 'Що бачити'], ['part', 'У чому брати участь']];
  VIEWS.perms = function () {
    const P = S.perms, D = P.data;
    let h = header('Дозволи й доступ', 'що можуть ланки нижче');
    if (!D) return h + loading();
    if (D.units.length > 1) h += `<div class="pills lvl" role="tablist">${D.units.map((u) => `<button type="button" class="pill${u.key === D.unit ? ' on' : ''}" data-a="permUnit" data-k="${esc(u.key)}">${esc(u.label)}</button>`).join('')}</div>`;
    if (!D.roles.length) return h + '<div class="empty">Нижче за тебе тут немає ролей</div>';
    h += `<div class="pills lvl" role="tablist" aria-label="Роль">${D.roles.map((r) => `<button type="button" class="pill${r.key === P.role ? ' on' : ''}" data-a="permRole" data-k="${r.key}">${esc(r.label)}</button>`).join('')}</div>`;
    const role = D.roles.filter((r) => r.key === P.role)[0] || D.roles[0];
    const cells = D.cells[role.key] || {};
    h += `<div class="small muted">Галочки діють на всіх «${esc(role.label)}» у межах: <b>${esc(D.unitLabel)}</b>. Те, що заборонила вища ланка, тут змінити не можна (🔒).</div>`;
    PERM_GROUPS.forEach((g) => {
      const items = D.perms.filter((p) => p.group === g[0] && cells[p.key]);
      if (!items.length) return;
      h += `<div class="sec">${g[1]}</div><div class="card list">${items.map((p) => {
        const c = cells[p.key];
        const note = c.locked ? `🔒 заборонено: ${esc(c.locked)}` : c.custom ? (c.on ? 'дозволено тут' : 'заборонено тут') : 'як типово';
        return `<label class="toggle-row"${c.locked ? ' style="opacity:.6"' : ''}><span class="grow"><span style="display:block">${esc(p.label)}</span><span class="xs ${c.custom && !c.locked ? 'b' : 'muted'}"${c.custom && !c.locked ? ' style="color:var(--teal)"' : ''}>${note}</span></span>
          <input type="checkbox" data-ch="permToggle" data-k="${p.key}"${c.on ? ' checked' : ''}${c.locked || P.busy ? ' disabled' : ''}></label>`;
      }).join('')}</div>`;
    });
    if (Object.keys(cells).some((k) => cells[k].custom)) h += `<button type="button" class="btn ghost" data-a="permReset">Скинути «${esc(role.label)}» до типових</button>`;
    return h;
  };

  // ───────────── ПЕРІОД (спільний) ─────────────
  function periodBar(o, scr) {
    let h = `<div class="seg">${[['week', 'Тиждень'], ['month', 'Місяць'], ['q', '3 міс'], ['year', 'Рік'], ['custom', 'Свій']].map((p) => `<button type="button" class="${p[0] === o.period ? 'on' : ''}" data-a="statsPeriod" data-s="${scr}" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>`;
    if (o.period === 'custom') h += `<div class="row" style="gap:8px;align-items:flex-end"><label class="f grow"><span>З</span><input class="in" type="date" data-bind="${scr}.from" value="${esc(o.from)}" max="${ymd(new Date())}"></label>
      <label class="f grow"><span>По</span><input class="in" type="date" data-bind="${scr}.to" value="${esc(o.to)}" max="${ymd(new Date())}"></label>
      <button type="button" class="btn sm" style="min-height:44px" data-a="periodApply" data-s="${scr}">Показати</button></div>`;
    return h;
  }

  // ───────────── ВСТАНОВИЛИ MyYL ─────────────
  async function loadInst() {
    try { S.inst.data = await api('installStats', { units: (S.pick.inst || { keys: [] }).keys }); } catch (e) { toast(e.message); }
    if (S.screen === 'inst') render();
  }
  const pctOf = (a, b) => (b ? Math.round(a / b * 100) : 0);
  // ── мій тиждень: відмітки одним дотиком ──
  const MW_IC = { club: 'club', mg: 'mg', kr: 'kr' };
  const teamRole = () => activeRoles().some((r) => r.level === 'team');
  function myWeekCard(w) {
    const tot = w.items.length || 3;
    const all = w.done === tot;
    const it = (k) => w.items.find((x) => x.key === k) || {};
    const club = it('club'), mg = it('mg'), kr = it('kr');
    const canClub = canType('club') && teamRole(), canMg = canType('mg'), canKr = canType('kr');
    const cs = ((me().week || {}).items || []).find((x) => x.type === 'club');
    const btn = (x, inner, attrs) => `<button type="button" class="mw-btn${x.on ? ' on' : ''}" ${attrs}>${inner}</button>`;
    let h = `<div class="card col mw${all ? ' mw-full' : ''}" style="gap:12px">
      <div class="row between"><div><b>Мій тиждень</b><div class="xs muted">${esc(w.label)}</div></div><span class="mw-count">${w.done}<span class="muted">/${tot}</span></span></div><div class="mw-row${club.key ? '' : ' mw2'}">`;
    // клуб — просто галочка (Національний офіс клубу не має)
    if (club.key) h += btn(club, `<span class="mw-ic">${club.on ? icon('check', 20) : icon('club', 20)}</span><span>${esc(club.label)}</span><span class="xs mw-sub">${club.locked ? 'зі звіту клубу' : club.on ? 'так ✓' : 'натисни'}</span>`,
      `data-a="checkin" data-k="club" data-on="${club.on ? '' : 1}"${club.locked ? ' disabled' : ''} aria-pressed="${club.on ? 'true' : 'false'}"`);
    // мала група й КР — статистика: кожен дотик відкриває внесення, можна кілька разів на тиждень
    h += btn(mg, `<span class="mw-ic">${mg.n ? '<b>' + mg.n + '</b>' : icon('mg', 20)}</span><span>${esc(mg.label)}</span><span class="xs mw-sub">${mg.n ? 'за тиждень · ＋ ще' : '＋ внести'}</span>`,
      canMg ? 'data-a="openAdd" data-type="mg"' : 'disabled');
    h += btn(kr, `<span class="mw-ic">${kr.n ? '<b>' + fmtNum(kr.hours) + '</b>' : icon('kr', 20)}</span><span>${esc(kr.label)}</span><span class="xs mw-sub">${kr.n ? 'год · ＋ ще' : '＋ внести'}</span>`,
      canKr ? 'data-a="openAdd" data-type="kr"' : 'disabled');
    h += '</div>';
    // капітан / адмін команди: звіт за клуб усієї команди
    if (canClub) h += `<button type="button" class="mw-club${cs && cs.status !== 'missing' ? ' ok' : ''}" data-a="openAdd" data-type="club"${cs ? ` data-team="${esc(cs.teamId)}"` : ''}>
      <span class="grow"><b>Звіт за клуб команди</b><br><span class="xs muted">${cs && cs.status === 'ok' ? 'цього тижня внесено ✓' : cs && cs.status === 'none' ? 'відмічено «клубу не було»' : 'ще не внесено — скільки підлітків, хто з лідерів був'}</span></span>${icon('chev')}</button>`;
    h += `<div class="row" style="gap:16px;flex-wrap:wrap"><button type="button" class="linkish small" data-a="tabGo" data-s="mystats">${all ? '🔥 Повний тиждень! ' : ''}Моя статистика →</button><button type="button" class="linkish small" data-a="tabGo" data-s="ach">🏅 Ачівки →</button></div></div>`;
    return h;
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    const cols = ['#ff8547', '#ffc46b', '#2dd4bf', '#a78bfa', '#f472b6'];
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * .3) + 's'; p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
  }

  // ── моя статистика й ачівки ──
  const ACH_IC = { first: '👣', month1: '🌱', half: '🌿', year1: '🌳', streak4: '⚡', streak12: '🏃', streak26: '🔥', full: '⭐', full5: '🌟', full20: '💫',
    club1: '🎈', club10: '🎉', club30: '💛', club75: '👑', mg1: '📖', mg10: '🧑‍🤝‍🧑', mg40: '🧭', mg100: '💯', mgT50: '🏠', mgT200: '❤️',
    kr1: '☕', krN20: '🚶', kr10: '🤝', kr50: '🫂', kr150: '🏔️', known1: '✍️', known10: '🙏', known30: '🕊️', known75: '🚪', friends10: '🤗', grow5: '🌾', own1: '🌱', own5: '🔦',
    year2: '🌲', months6: '📅', months12: '🗓️', streak52: '☀️', full50: '🏆', fullRun3: '🎯', fullRun8: '💪', club150: '🏡', clubRep1: '📝', clubRep25: '📚', clubRep100: '🏛️',
    clubBig30: '🎪', clubBig60: '🎆', clubTeams2: '🌉', mg200: '🔥', mgT500: '🌍', mgNew1: '👋', mgNew10: '🚪', mgNew30: '⭕', mgTopic10: '💬', mgPray10: '🛐',
    krN50: '📱', krN100: '🥾', kr300: '⛰️', krLong: '🌙', krWeek10: '🗺️', known150: '👥', friends30: '💞', grow15: '🌻', knownPray10: '📿', knownBday10: '🎂',
    rsvp1: '✋', rsvp10: '🎟️', rsvp30: '🎊', task1: '✅', task10: '🧱', task50: '🏗️', poll1: '🗳️', poll15: '📣', prof3: '👤', prof7: '📖', days30: '🏠', days365: '🎉',
    bug1: '🔍', bug5: '🛠️', fast20: '⚡', weekend10: '🌅', summer8: '🏕️', winter8: '❄️', newyear: '🎄', comeback: '🔄' };
  const ACH_LV = [[0, 'Новачок'], [5, 'Учень'], [12, 'Помічник'], [22, 'Служитель'], [35, 'Наставник'], [50, 'Пастир'], [65, 'Легенда'], [80, 'Світло для покоління']];
  function achLevel(n) {
    let i = 0; while (i + 1 < ACH_LV.length && n >= ACH_LV[i + 1][0]) i++;
    const nx = ACH_LV[i + 1];
    return { n: i + 1, title: ACH_LV[i][1], next: nx ? nx[1] : '', left: nx ? nx[0] - n : 0, pct: nx ? Math.round((n - ACH_LV[i][0]) / (nx[0] - ACH_LV[i][0]) * 100) : 100 };
  }
  // нові ачівки — святкуємо один раз
  function achCelebrate(d) {
    if (!d || !d.ach) return;
    const got = d.ach.filter((a) => a.done).map((a) => a.key), seen = LS.get('achSeen');
    LS.set('achSeen', got);
    if (!seen) return;
    const fresh = d.ach.filter((a) => a.done && seen.indexOf(a.key) < 0);
    if (fresh.length) { toast('🏅 Нова ачівка' + (fresh.length > 1 ? ' (' + fresh.length + ')' : '') + ': ' + fresh.map((a) => a.title).join(', '), 'success'); }
  }
  const MS_P = [['month', 'Місяць'], ['quarter', '3 міс'], ['year', 'Рік'], ['all', 'Увесь час']];
  async function loadMyStats() {
    const P = S.myStatsP || 'all';
    try { S.myStats = await api('myStats', { period: P }); if (P === 'all') achCelebrate(S.myStats); } catch (e) { toast(e.message, 'error'); }
    if (S.screen === 'mystats') render();
  }
  async function loadAch() {
    try { S.achD = await api('myStats', { period: 'all' }); achCelebrate(S.achD); } catch (e) { toast(e.message, 'error'); }
    if (S.screen === 'ach') render();
  }
  VIEWS.mystats = function () {
    let h = header('Моя статистика', first() + ' · твоє служіння');
    const P = S.myStatsP || 'all';
    h += `<div class="seg">${MS_P.map((p) => `<button type="button" class="${p[0] === P ? 'on' : ''}" data-a="msPeriod" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>`;
    const d = S.myStats;
    if (!d) return h + loading();
    const k = d.kpi;
    const tile = (v, l, cls) => `<div class="card ms-k${cls ? ' ' + cls : ''}"><b>${v}</b><span class="small muted">${l}</span></div>`;
    h += `<div class="grid2">${tile(k.clubs, 'клубів відвідано')}${tile(k.mgs, 'малих груп')}${tile(fmtNum(k.kr), 'годин контактної роботи')}${tile(k.known, 'імен у «Знаних»')}</div>`;
    h += `<div class="card row ms-streak"><span class="ms-fire">🔥</span><span class="grow"><b>${k.streak} ${weeksWord(k.streak)} поспіль</b><br><span class="small muted">найдовша серія — ${k.best} · активних тижнів: ${k.active}</span></span></div>`;
    h += `<div class="sec">Останні 12 тижнів</div><div class="card ms-trail">${d.trail.map((t) => `<span class="ms-w" title="${esc(t.week)}"><i class="${t.club ? 'c' : ''}"></i><i class="${t.mg ? 'm' : ''}"></i><i class="${t.kr ? 'k' : ''}"></i></span>`).join('')}
      <div class="ms-leg xs muted"><span><i class="c"></i>клуб</span><span><i class="m"></i>мала група</span><span><i class="k"></i>КР</span></div></div>`;
    const done = d.ach.filter((a) => a.done).length;
    h += `<button type="button" class="banner" data-a="tabGo" data-s="ach"><span class="ms-fire" style="font-size:26px">🏅</span><span class="grow"><b>Ачівки · ${done} з ${d.ach.length}</b><br><span class="small muted">нагороди за служіння — окремий розділ</span></span>${icon('chev')}</button>`;
    h += '<div class="xs muted" style="text-align:center">Клуби рахуються з твоїх відміток і з відміток присутності у звіті клубу. Малі групи й КР — з твоїх звітів і відміток тижня.</div>';
    return h;
  };
  VIEWS.ach = function () {
    let h = header('Ачівки', first() + ' · нагороди за служіння');
    const d = S.achD;
    if (!d) return h + loading();
    const done = d.ach.filter((a) => a.done).length;
    const lv = achLevel(done);
    h += `<div class="ach-head card"><div class="row" style="gap:12px;align-items:center"><span class="ach-lv">${lv.n}</span><span class="grow"><span class="xs muted">рівень служіння</span><br><b>${esc(lv.title)}</b></span><span class="small muted">${done} з ${d.ach.length}</span></div>
      <span class="track" style="height:8px;margin-top:10px;display:block"><i style="width:${lv.pct}%;background:var(--grad)"></i></span>
      <div class="xs muted" style="margin-top:6px">${lv.next ? 'До рівня «' + esc(lv.next) + '» — ще ' + plural(lv.left, 'ачівка', 'ачівки', 'ачівок') : 'Найвищий рівень. Дякуємо за вірність!'}</div></div>`;
    const near = d.ach.filter((a) => !a.done && !a.secret && a.have > 0).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3);
    if (near.length) h += `<div class="sec">🎯 Найближчі</div><div class="card list">${near.map((a) => `<div class="li ach-near"><span class="ach-ic-s">${ACH_IC[a.key] || '⭐'}</span><span class="grow"><b>${esc(a.title)}</b><br><span class="xs muted">${esc(a.desc)}</span>
      <span class="track" style="height:6px;margin-top:6px;display:block"><i style="width:${Math.round(a.have / a.need * 100)}%;background:var(--grad)"></i></span></span><span class="small muted">${fmtNum(a.have)}/${a.need}</span></div>`).join('')}</div>`;
    (d.cats || [{ key: '', title: 'Усі', ic: '🏅' }]).forEach((cat) => {
      const list = d.ach.filter((a) => !cat.key || a.cat === cat.key);
      // «Кемпи» показуємо одразу — значки за участь у таборах як лідер зʼявляться згодом
      if (!list.length && cat.key === 'camp') { h += `<div class="sec">${cat.ic} ${esc(cat.title)}</div><div class="card ach-soon"><span class="ach-ring" style="--p:0"><span class="ach-ic">🏕</span></span><span class="grow small">Тут будуть значки за участь у таборах як лідер. Скоро!</span></div>`; return; }
      if (!list.length) return;
      h += `<div class="sec">${cat.ic} ${esc(cat.title)} · ${list.filter((a) => a.done).length}/${list.length}</div><div class="card ach-grid">${list.map((a) => {
        const pct = Math.round(a.have / a.need * 100);
        return `<button type="button" class="ach-c${a.done ? ' got' : ''}" data-a="achInfo" data-t="${esc(a.title)}" data-d="${esc(a.desc)}" data-p="${a.done ? 'Отримано ✓' : a.secret ? 'секрет' : fmtNum(a.have) + ' з ' + a.need}">
          <span class="ach-ring" style="--p:${a.done ? 100 : pct}"><span class="ach-ic">${a.secret ? '❓' : ACH_IC[a.key] || '⭐'}</span></span><span class="ach-n">${esc(a.title)}</span></button>`;
      }).join('')}</div>`;
    });
    h += '<div class="xs muted" style="text-align:center">Натисни на кружечок — побачиш, що треба для ачівки. ❓ — секретні: відкриваються самі. Рахується за весь час служіння.</div>';
    h += '<button type="button" class="linkish small" style="align-self:center" data-a="tabGo" data-s="mystats">Моя статистика →</button>';
    return h;
  };
  // ── повідомити про помилку / повідомлення про помилки ──
  VIEWS.bug = function () {
    const B = S.bug || { text: '' };
    if (B.sent) return header('Дякуємо!') + '<div class="card col" style="text-align:center;gap:8px"><div style="font-size:42px">🙏</div><div class="b">Повідомлення надіслано</div><div class="small muted">Ми подивимось і виправимо. Якщо треба — напишемо тобі в Telegram.</div><button type="button" class="btn ghost" data-a="tabGo" data-s="home">На головну</button></div>';
    return header('Повідомити про помилку', 'побачить розробник застосунку') + `<div class="card col">
      <label class="f"><span>Що сталося?</span><textarea class="in" rows="6" maxlength="3000" data-bind="bug.text" placeholder="Що ти робив(ла), що мало статися і що сталося натомість. Наприклад: «Натискаю Зберегти на малій групі — пише Немає звʼязку».">${esc(B.text)}</textarea></label>
      <div class="xs muted">Разом із текстом надішлемо твоє імʼя, версію застосунку і тип телефону — це допомагає швидше знайти причину.</div>
      <button type="button" class="btn" data-a="bugSend"${B.busy ? ' disabled' : ''}>${icon('send', 18)} Надіслати</button></div>`;
  };
  async function loadBugs() { try { S.bugsD = await api('bugs'); } catch (e) { toast(e.message, 'error'); } if (S.screen === 'bugs') render(); }
  VIEWS.bugs = function () {
    let h = header('Повідомлення про помилки');
    const d = S.bugsD;
    if (!d) return h + loading();
    const open = d.list.filter((b) => !b.done), done = d.list.filter((b) => b.done);
    const T = S.bugsTab === 'done' ? 'done' : 'open';
    h += `<div class="seg"><button type="button" class="${T === 'open' ? 'on' : ''}" data-a="bugsTab" data-v="open">Нові · ${open.length}</button><button type="button" class="${T === 'done' ? 'on' : ''}" data-a="bugsTab" data-v="done">Виправлені · ${done.length}</button></div>`;
    const list = T === 'open' ? open : done;
    if (!list.length) return h + `<div class="empty">${T === 'open' ? 'Нових повідомлень немає 🎉' : 'Тут будуть виправлені'}</div>`;
    return h + list.map((b) => `<div class="card col" style="gap:6px"><div class="row between"><span class="b">${esc(b.name)}</span><span class="xs muted">${esc(fmtDay(String(b.created).slice(0, 10)))} ${esc(String(b.created).slice(11, 16))}</span></div>
      <div style="white-space:pre-line">${esc(b.text)}</div>
      <div class="xs muted">${b.screen ? 'екран: ' + esc(b.screen) + ' · ' : ''}${esc(b.info || '')}</div>
      <button type="button" class="btn ${b.done ? 'ghost' : 'sec2'} sm" data-a="bugDone" data-id="${esc(b.id)}" data-v="${b.done ? '1' : ''}">${b.done ? 'Повернути в нові' : '✓ Виправлено'}</button></div>`).join('');
  };
  const confirmAsk = (msg) => new Promise((res) => { if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => res(!!ok)); else res(window.confirm(msg)); });
  // ── можливі дублікати (власник) ──
  async function loadDupes() { try { S.dupesD = await api('dupes'); } catch (e) { toast(e.message, 'error'); } if (S.screen === 'dupes') render(); }
  VIEWS.dupes = function () {
    let h = header('Можливі дублікати', 'схожі імена в різних записах');
    const d = S.dupesD;
    if (!d) return h + loading();
    if (!d.list.length) return h + '<div class="empty">Схожих записів не знайдено 🎉</div>';
    h += '<div class="small muted">Пара — це одна людина? «Обʼєднати» перенесе ролі в один запис (зареєстрований у боті лишається головним). «Не дубль» — пара більше не зʼявиться.</div>';
    return h + d.list.map((x) => `<div class="card col" style="gap:8px"><span class="tag warn" style="align-self:flex-start">${esc(x.why)}</span>
      ${x.people.map((p) => `<div><span class="b">${esc(p.name)}</span>${p.real ? ' <span class="yl-badge">YL</span>' : ' <span class="xs muted">ще не в MyYL</span>'}<div class="xs muted">${esc(p.where)}</div></div>`).join('')}
      <div class="grid2"><button type="button" class="btn ghost sm" data-a="dupSkip" data-k="${esc(x.key)}">Не дубль</button><button type="button" class="btn sm" data-a="dupMerge" data-k="${esc(x.key)}">Обʼєднати</button></div></div>`).join('');
  };

  const fmtNum = (v) => String(Math.round((Number(v) || 0) * 10) / 10).replace('.', ',');
  const weeksWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'тиждень' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'тижні' : 'тижнів');

  VIEWS.inst = function () {
    const I = S.inst, d = I.data;
    let h = header('Встановили MyYL', pickLabel('inst'));
    h += picker('inst');
    if (!d) return h + loading();
    h += `<div class="card col" style="gap:6px;text-align:center"><div class="b" style="font-size:32px">${d.reg} <span class="muted" style="font-size:18px">з ${d.total}</span></div>
      <div class="small muted">людей у складі вже зареєстровані в MyYL · ${pctOf(d.reg, d.total)}%</div>
      <span class="track" style="height:8px"><i style="width:${pctOf(d.reg, d.total)}%;background:var(--turq)"></i></span></div>`;
    if (d.rows.length) {
      h += `<div class="card col" style="gap:4px"><h2>${esc(d.title)}</h2>${d.rows.map((r) => `<button type="button" class="brk" style="border-top:1px solid var(--line);padding:9px 0"${r.drill ? ` data-a="instGo" data-k="${esc(r.drill)}"` : ' disabled'}>
        <span class="row between" style="width:100%"><span class="b">${esc(r.name)}</span><span class="small"><b>${r.reg}</b> з ${r.total} · ${pctOf(r.reg, r.total)}%</span></span>
        <span class="track" style="width:100%"><i style="width:${pctOf(r.reg, r.total)}%;background:var(--turq)"></i></span></button>`).join('')}</div>`;
    }
    const q = String(I.q || '').toLowerCase();
    const f = (l) => (q ? l.filter((x) => x.name.toLowerCase().indexOf(q) >= 0) : l);
    if ((d.latest || []).length) {
      const when = (t) => { const x = new Date(t); return isNaN(x) ? '' : fmtDay(ymd(x)) + ' · ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
      h += `<div class="sec">Останні, хто встановив · ${d.latest.length}</div><div class="card list">${d.latest.map((u) => `<div class="li" style="cursor:default">${avaHtml(u.id, u.name)}<span class="grow"><span class="b" style="display:block">${esc(u.name)}</span><span class="xs muted">${esc(u.role)}</span></span><span class="xs muted" style="text-align:right">${esc(when(u.at))}</span></div>`).join('')}</div>`;
    }
    h += `<div class="sec">Користувачі MyYL · ${d.users.length}</div>`;
    if (d.users.length > 8) h += `<input class="in" type="search" style="min-height:40px" placeholder="Знайти…" value="${esc(I.q)}" data-bind="inst.q" data-live="instFind" aria-label="Пошук">`;
    h += `<div class="card list" id="instList">${f(d.users).map((u) => `<div class="li" style="cursor:default">${avaHtml(u.id, u.name)}<span class="grow"><span class="b" style="display:block">${esc(u.name)}${ylBadge}</span><span class="xs muted">${esc(u.role)}${u.since ? ' · з ' + esc(fmtShortDay(u.since)) + ' ' + u.since.slice(0, 4) : ''}</span></span></div>`).join('') || '<div class="empty small">Нікого</div>'}</div>`;
    if (d.notYet.length) {
      h += `<button type="button" class="link-btn" style="align-self:flex-start" data-a="instNot">${I.showNot ? 'Сховати' : 'Ще не в MyYL · ' + d.notYet.length}</button>`;
      if (I.showNot) h += `<div class="card list">${f(d.notYet).map((u) => `<div class="li" style="cursor:default"><span class="avatar" style="opacity:.6">${esc(initials(u.name))}</span><span class="grow"><span style="display:block">${esc(u.name)}</span><span class="xs muted">${esc(u.role)}</span></span></div>`).join('')}</div>`;
    }
    return h;
  };

  // ───────────── СТАТИСТИКА ЗА НАПРЯМКАМИ ─────────────
  const DIR_COLORS = { YoungLife: 'var(--coral)', WyldLife: 'var(--teal)', College: 'var(--blue)', Capernaum: 'var(--purple)', YoungMoms: 'var(--yellow)', '': 'var(--muted)' };
  async function loadDirs() {
    const D = S.dirs;
    D.loading = true; render();
    try { D.data = await api('dirStats', { units: (S.pick.dirs || { keys: [] }).keys, period: D.period, from: D.from, to: D.to }); } catch (e) { toast(e.message); }
    D.loading = false;
    if (S.screen === 'dirs') render();
  }
  VIEWS.dirs = function () {
    const D = S.dirs, d = D.data;
    let h = header('Статистика за напрямками', pickLabel('dirs'));
    h += picker('dirs');
    h += periodBar(D, 'dirs');
    if (!d) return h + loading();
    if (D.loading) h += '<div class="xs muted">Оновлюю…</div>';
    const rows = d.rows.filter((x) => x.dir);
    const max = Math.max.apply(null, rows.map((x) => x.teens).concat([1]));
    h += `<div class="card col" style="gap:8px"><h2>Підлітки на клубах</h2>${rows.map((x) => `<div><div class="row between small"><span class="b">${esc(x.label)}</span><span>${nf(x.teens)}${x.clubs ? ' · ' + nf(x.clubs) + ' клуб.' : ''}</span></div>
      <span class="track" style="height:8px;margin-top:4px"><i style="width:${Math.round(x.teens / max * 100)}%;background:${DIR_COLORS[x.dir]}"></i></span></div>`).join('')}</div>`;
    const M = [['teams', 'Команд'], ['people', 'Людей у командах'], ['clubs', 'Клубів'], ['teens', 'Підлітків на клубах'], ['avg', 'Середньо на клубі'], ['newT', 'Нових підлітків'], ['mg', 'Зустрічей МГ'], ['mgPeople', 'Учасників МГ'], ['kr', 'Годин КР'], ['known', 'Знаних по імені']];
    const all = d.rows;
    h += `<div class="card" style="padding:0"><div class="rtab-w"><table class="rtab"><thead><tr><th></th>${all.map((x) => `<th>${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${M.map((m) => `<tr><td>${m[1]}</td>${all.map((x) => `<td>${m[0] === 'avg' || m[0] === 'kr' ? df(x[m[0]]) : nf(x[m[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    const none = all.filter((x) => !x.dir)[0];
    if (none && none.teams) h += `<div class="note small">Без напрямку: <b>${none.teams}</b> ${none.teams === 1 ? 'команда' : 'команд'} — ${esc(none.names.slice(0, 12).join(', '))}${none.names.length > 12 ? '…' : ''}. Напрямок вказується в «Ерії та команди» → команда.</div>`;
    h += `<div class="xs muted">Командам з напрямком: ${d.total.withDir} з ${d.total.teams}. Малі групи й КР — за командою, до якої їх внесено.</div>`;
    return h;
  };

  // ───────────── КОРИСНІ РЕСУРСИ ─────────────
  const API_BASE = () => API_URL.replace(/\/+$/, '').replace(/\/api$/, '');
  const resFileUrl = (x) => API_BASE() + '/f/' + x.id + '?k=' + x.fkey;
  async function loadRes() {
    try { S.res.data = await api('resList'); } catch (e) { S.res.data = S.res.data || { list: [], canAdd: false, regions: [], dirs: [] }; toast(e.message); }
    if (S.screen === 'res' && !S.res.form) render();
  }
  function resItem(x) {
    const ic = x.hasFile ? 'doc' : 'link';
    return `<div class="li" style="align-items:flex-start;padding-top:12px;padding-bottom:12px"><span class="ic ic-yellow">${icon(ic, 18)}</span>
      <button type="button" class="grow" style="all:unset;cursor:pointer;flex:1;min-width:0" data-a="resOpen" data-id="${esc(x.id)}">
        <span class="b" style="display:block">${esc(x.title)}</span>
        ${x.note ? `<span class="small muted" style="display:block;margin-top:2px">${esc(x.note)}</span>` : ''}
        <span class="row wrap" style="gap:6px;margin-top:6px"><span class="tag">${esc(x.audLabel)}</span>${x.hasFile ? `<span class="xs muted">${esc(x.fileName)}</span>` : ''}${x.pending ? '<span class="tag warn">чекає підтвердження</span>' : ''}</span></button>
      ${x.canDelete ? `<button type="button" class="btn ghost sm" style="min-height:32px;padding:0 10px" data-a="resDel" data-id="${esc(x.id)}" aria-label="Видалити">✕</button>` : ''}</div>
      ${x.canDecide ? `<div class="grid2" style="padding:0 16px 12px"><button type="button" class="btn sm" data-a="resDecide" data-id="${esc(x.id)}" data-ok="1">Підтвердити</button><button type="button" class="btn ghost sm" data-a="resDecide" data-id="${esc(x.id)}">Відхилити</button></div>` : ''}`;
  }
  VIEWS.res = function () {
    const R = S.res;
    if (R.form) return resFormView();
    let h = header('Корисні ресурси', '', R.data && R.data.canAdd ? `<button type="button" class="icon-btn accent" data-a="resNew" aria-label="Додати ресурс">${icon('plus', 22)}</button>` : '');
    if (!R.data) return h + loading();
    const L = R.data.list;
    if (!L.length) return h + '<div class="empty">Ще немає ресурсів</div>';
    const pend = L.filter((x) => x.pending), act = L.filter((x) => !x.pending);
    if (pend.length) h += `<div class="sec">Чекають підтвердження · ${pend.length}</div><div class="card list">${pend.map(resItem).join('')}</div>`;
    if (act.length) h += `${pend.length ? '<div class="sec">Опубліковані</div>' : ''}<div class="card list">${act.map(resItem).join('')}</div>`;
    return h;
  };
  function resFormView() {
    const f = S.res.form, D = S.res.data;
    const audKind = f.aud === 'all' ? 'all' : f.aud.indexOf('r:') === 0 ? 'r' : 'dir';
    const hint = { all: 'Для всіх — публікується після підтвердження.', r: 'Для регіону — підтверджує Регіональний директор цього регіону.', dir: 'Для напрямку — підтверджує експерт цього напрямку з Національного офісу.' }[audKind];
    return header('Новий ресурс') + `<div class="card col">
      <label class="f"><span>Назва</span><input class="in" type="text" maxlength="150" data-bind="res.form.title" value="${esc(f.title)}" placeholder="Наприклад: Подкаст «Будні лідера»"></label>
      <label class="f"><span>Посилання</span><input class="in" type="url" inputmode="url" data-bind="res.form.url" value="${esc(f.url)}" placeholder="https://…"></label>
      <div class="f"><span>або файл (до 20 МБ)</span>${f.file ? `<div class="row between small"><span>📎 ${esc(f.file.name)}</span><button type="button" class="link-btn xs" data-a="resFileDrop">прибрати</button></div>`
        : `<input class="in" type="file" data-ch="resFile"${f.uploading ? ' disabled' : ''}>${f.uploading ? '<div class="xs muted">Завантажую…</div>' : ''}`}</div>
      <label class="f"><span>Коротко, про що (необовʼязково)</span><textarea class="in" rows="2" maxlength="500" data-bind="res.form.note">${esc(f.note)}</textarea></label>
      <div class="f"><span>Кому буде корисно</span><div class="seg">${[['all', 'Всім'], ['r', 'Регіону'], ['dir', 'Напрямку']].map((x) => `<button type="button" class="${audKind === x[0] ? 'on' : ''}" data-a="resAud" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>
      ${audKind === 'r' ? `<select class="in" data-ch="resAudSel">${D.regions.map((r) => `<option value="r:${esc(r.id)}"${f.aud === 'r:' + r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : ''}
      ${audKind === 'dir' ? `<select class="in" data-ch="resAudSel">${D.dirs.map((d) => `<option value="dir:${esc(d)}"${f.aud === 'dir:' + d ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>` : ''}
      <div class="xs muted">${hint} Свій регіон / свій напрямок публікується одразу.</div>
      <button type="button" class="btn" data-a="resSave"${f.uploading ? ' disabled' : ''}>Додати</button></div>`;
  }

  // ───────────── ЗАДАЧІ ─────────────
  const TASK_ST = [['todo', 'Не почато'], ['doing', 'В процесі'], ['done', 'Виконано']];
  const taskStLabel = (k) => (TASK_ST.filter((x) => x[0] === k)[0] || TASK_ST[0])[1];
  const taskStCls = (k) => (k === 'done' ? 'ok' : k === 'doing' ? '' : 'warn');
  const plusBtn = (a, label) => `<button type="button" class="icon-btn accent" data-a="${a}" aria-label="${label}">${icon('plus', 22)}</button>`;
  function audBlock(scr, f) {
    return `<div class="f"><span>Кому</span>${picker(scr)}${rolesField(scr, f)}</div>
      <div class="small">${f.count == null ? '<span class="muted">Рахую…</span>' : `Отримають: <b>${plural(f.count, 'людина', 'людини', 'людей')}</b>`}</div>`;
  }
  function dueTag(t) {
    if (!t.due) return '';
    const late = !t.closed && t.due < ymd(new Date()) && (t.mine ? t.mine.status !== 'done' : t.done < t.total);
    return `<span class="tag${late ? ' warn' : ''}">до ${esc(fmtShortDay(t.due))}${late ? ' · прострочено' : ''}</span>`;
  }
  VIEWS.tasks = function () {
    const T = S.tasks;
    if (T.form) return taskFormView();
    if (T.open) return taskDetailView();
    let h = header('Задачі до виконання', '', T.data && (T.data.canCreate || T.data.canSelf) ? plusBtn('taskNew', T.data.canCreate ? 'Нова задача' : 'Задача собі') : '');
    if (!T.data) return h + loading();
    const L = T.data.list;
    const groups = { mine: L.filter((t) => t.mine && !t.closed), from: L.filter((t) => t.oversee && !t.closed), closed: L.filter((t) => t.closed) };
    const tabs = [['mine', 'Мені · ' + groups.mine.length]].concat(groups.from.length || T.data.canCreate ? [['from', 'Доручені · ' + groups.from.length]] : []).concat(groups.closed.length ? [['closed', 'Завершені']] : []);
    const tab = tabs.some((x) => x[0] === T.tab) ? T.tab : 'mine';
    if (tabs.length > 1) h += `<div class="seg" role="tablist">${tabs.map((x) => `<button type="button" role="tab" class="${tab === x[0] ? 'on' : ''}" data-a="taskTab" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`;
    const list = groups[tab];
    if (!list.length) return h + `<div class="empty">${tab === 'mine' ? 'Тобі зараз нічого не доручено' : tab === 'from' ? 'Тут будуть задачі, які ти доручиш іншим. Натисни «+».' : 'Завершених немає'}</div>`;
    h += `<div class="card list">${list.map((t) => {
      const pct = t.total ? Math.round(t.done / t.total * 100) : 0;
      return `<button type="button" class="li" style="align-items:flex-start;padding-top:12px;padding-bottom:12px" data-a="taskOpen" data-id="${esc(t.id)}"><span class="ic ic-teal">${icon('task', 18)}</span>
        <span class="grow"><span class="b" style="display:block">${esc(t.title)}</span>
        <span class="row wrap" style="gap:6px;margin-top:4px">${t.self ? '<span class="tag self">Задача собі</span>' : ''}${tab === 'mine' && t.mine ? `<span class="tag ${taskStCls(t.mine.status)}">${taskStLabel(t.mine.status)}</span>` : ''}${dueTag(t)}<span class="xs muted">${tab === 'mine' ? 'від ' + esc(t.author) : esc(t.audience)}</span></span>
        ${t.oversee && tab !== 'mine' ? `<span class="xs muted" style="display:block;margin-top:6px">Виконали ${t.done} з ${t.total}${t.doing ? ' · в процесі ' + t.doing : ''}</span><span class="track" style="height:4px;margin-top:4px"><i style="width:${pct}%;background:var(--turq)"></i></span>` : ''}</span>
        <span class="muted">${icon('chev', 18)}</span></button>`;
    }).join('')}</div>`;
    return h;
  };
  function taskDetailView() {
    const T = S.tasks, t = ((T.data && T.data.list) || []).filter((x) => x.id === T.open)[0];
    if (!t) return header('Задача') + (T.data ? '<div class="empty">Задачу не знайдено</div>' : loading());
    let h = header(t.title, t.closed ? 'Завершена' : '');
    h += `<div class="card rows"><div class="kv"><span>Доручив(ла)</span><span>${esc(t.author)}</span></div><div class="kv"><span>Кому</span><span>${esc(t.audience)}</span></div>
      ${t.due ? `<div class="kv"><span>Термін</span><span>${dueTag(t)}</span></div>` : ''}</div>`;
    if (t.desc) h += `<div style="white-space:pre-line">${esc(t.desc)}</div>`;
    if (t.mine) {
      h += `<div class="card col"><h2>Мій стан</h2><div class="seg">${TASK_ST.map((x) => `<button type="button" class="${t.mine.status === x[0] ? 'on' : ''}" data-a="taskSt" data-v="${x[0]}"${t.closed ? ' disabled' : ''}>${x[1]}</button>`).join('')}</div>
        <label class="f"><span>Нотатка про виконання</span><textarea class="in" rows="3" data-bind="tasks.note" placeholder="Що вже зроблено, що заважає…"${t.closed ? ' disabled' : ''}>${esc(T.note)}</textarea></label>
        ${t.closed ? '' : '<button type="button" class="btn sec2" data-a="taskSt">Зберегти нотатку</button>'}</div>`;
    }
    if (t.oversee) {
      const pct = t.total ? Math.round(t.done / t.total * 100) : 0;
      h += `<div class="card col" style="gap:6px"><div class="row between"><h2>Хід виконання</h2><span class="b">${t.done} / ${t.total}</span></div>
        <span class="track" style="height:6px"><i style="width:${pct}%;background:var(--turq)"></i></span>
        ${(t.people || []).map((p) => `<div style="border-top:1px solid var(--line);padding:8px 0"><div class="row between" style="gap:8px"><span class="b small">${esc(p.name)}</span><span class="tag ${taskStCls(p.status)}">${taskStLabel(p.status)}</span></div>
          ${p.note ? `<div class="small" style="white-space:pre-line;margin-top:4px">${esc(p.note)}</div>` : ''}${p.updated ? `<div class="xs muted">${esc(fmtWhen(p.updated))}</div>` : ''}</div>`).join('')}</div>`;
      if (!t.closed && t.done < t.total) h += '<button type="button" class="btn sec2" data-a="taskNudge">⏰ Нагадати тим, хто ще не виконав</button>';
    }
    if (t.canEdit) h += `<div class="grid2"><button type="button" class="btn sec2" data-a="taskClose">${t.closed ? 'Відкрити знову' : 'Завершити задачу'}</button><button type="button" class="btn ghost" data-a="taskDelete">Видалити</button></div>`;
    return h;
  }
  function taskFormView() {
    const f = S.tasks.form;
    const canOthers = !!(S.tasks.data && S.tasks.data.canCreate);
    const self = f.self || !canOthers;
    return header(self ? 'Задача собі' : 'Нова задача', self ? 'Бачиш лише ти' : 'Отримають повідомлення в боті') + `<div class="card col">
      ${canOthers ? `<div class="seg"><button type="button" class="${!self ? 'on' : ''}" data-a="taskSelf" data-v="0">Доручити іншим</button><button type="button" class="${self ? 'on' : ''}" data-a="taskSelf" data-v="1">Задача собі</button></div>` : ''}
      <label class="f"><span>Що треба зробити</span><input class="in" type="text" maxlength="200" data-bind="tasks.form.title" value="${esc(f.title)}" placeholder="${self ? 'Наприклад: подзвонити Максу' : 'Наприклад: здати списки на табір'}"></label>
      <label class="f"><span>Деталі</span><textarea class="in" rows="4" data-bind="tasks.form.desc" placeholder="Що саме, як, кому передати…">${esc(f.desc)}</textarea></label>
      <label class="f"><span>Термін (необовʼязково)</span><input class="in" type="date" data-bind="tasks.form.due" value="${esc(f.due)}" min="${ymd(new Date())}"></label>
      ${self ? `<button type="button" class="btn" data-a="taskSave">${icon('check', 18)} Додати собі</button>
      <div class="xs muted">Особиста задача: ніхто інший її не бачить. Відмічай стан, як у звичайних задачах.</div></div>`
      : `${audBlock('task', f)}
      <button type="button" class="btn" data-a="taskSave"${!f.count ? ' disabled' : ''}>${icon('send', 18)} Доручити</button>
      <div class="xs muted">Кожен відмічає свій стан і пише нотатку. Ти бачиш хід виконання; вищі ролі над вибраними місцями — теж.</div></div>`}`;
  }

  // ───────────── ОПИТУВАННЯ ─────────────
  VIEWS.polls = function () {
    const P = S.polls;
    if (P.form) return pollFormView();
    let h = header('Опитування', '', P.data && P.data.canCreate ? plusBtn('pollNew', 'Нове опитування') : '');
    if (!P.data) return h + loading();
    const L = P.data.list, open = L.filter((x) => !x.closed), closed = L.filter((x) => x.closed);
    if (closed.length) h += `<div class="seg" role="tablist"><button type="button" role="tab" class="${P.tab !== 'closed' ? 'on' : ''}" data-a="pollTab" data-v="open">Активні · ${open.length}</button><button type="button" role="tab" class="${P.tab === 'closed' ? 'on' : ''}" data-a="pollTab" data-v="closed">Завершені · ${closed.length}</button></div>`;
    const list = P.tab === 'closed' ? closed : open;
    if (!list.length) return h + `<div class="empty">${P.data.canCreate ? 'Опитувань поки немає. Натисни «+», щоб запитати своїх людей.' : 'Опитувань поки немає'}</div>`;
    return h + list.map(pollCard).join('');
  };
  function pollCard(p) {
    const P = S.polls, sel = P.sel[p.id] || p.mine;
    let h = `<div class="card col" style="gap:8px"><div><div class="b" style="font-size:17px">${esc(p.question)}</div>
      <div class="xs muted">${esc(p.author)} · ${esc(p.audience)}${p.multi ? ' · можна кілька варіантів' : ''}${p.closed ? ' · завершено' : ''}</div></div>`;
    if (p.canVote) {
      h += `<div class="col" style="gap:4px">${p.options.map((o, i) => `<label class="check" style="border:0;border-radius:12px;background:var(--soft);min-height:46px;padding:0 12px"><input type="${p.multi ? 'checkbox' : 'radio'}" name="pv${esc(p.id)}" data-ch="pollPick" data-id="${esc(p.id)}" data-i="${i}"${sel.indexOf(i) >= 0 ? ' checked' : ''}><span class="grow">${esc(o)}</span>${p.mine.indexOf(i) >= 0 ? '<span class="xs b" style="color:var(--teal)">твій голос</span>' : ''}</label>`).join('')}</div>
        <button type="button" class="btn${p.mine.length ? ' sec2' : ''}" data-a="pollVote" data-id="${esc(p.id)}">${p.mine.length ? 'Змінити голос' : 'Проголосувати'}</button>`;
    } else if (p.mine.length) h += `<div class="small">Твій голос: <b>${esc(p.mine.map((i) => p.options[i]).join(', '))}</b></div>`;
    if (p.counts) {
      const max = Math.max.apply(null, p.counts.concat([1]));
      h += `<div class="col" style="gap:6px">${p.options.map((o, i) => `<div><div class="row between small" style="gap:8px"><span>${esc(o)}</span><span class="b">${p.counts[i]}</span></div>
        <span class="track" style="height:6px;margin-top:3px"><i style="width:${Math.round(p.counts[i] / max * 100)}%;background:var(--purple)"></i></span>
        ${p.who && p.who[i].length ? `<div class="xs muted" style="margin-top:3px">${esc(p.who[i].join(', '))}</div>` : ''}</div>`).join('')}</div>`;
    }
    h += `<div class="xs muted">Проголосували ${p.voted} з ${p.total}</div>`;
    if (p.notVoted && p.notVoted.length) {
      h += `<button type="button" class="link-btn xs" style="align-self:flex-start" data-a="pollNot" data-id="${esc(p.id)}">${P.showNot[p.id] ? 'Сховати' : 'Ще не проголосували (' + p.notVoted.length + ')'}</button>`;
      if (P.showNot[p.id]) h += `<div class="xs muted">${esc(p.notVoted.join(', '))}</div>`;
    }
    if (p.canEdit) h += `<div class="grid2"><button type="button" class="btn sec2 sm" data-a="pollClose" data-id="${esc(p.id)}">${p.closed ? 'Відкрити знову' : 'Завершити'}</button><button type="button" class="btn ghost sm" data-a="pollDelete" data-id="${esc(p.id)}">Видалити</button></div>`;
    return h + '</div>';
  }
  function pollFormView() {
    const f = S.polls.form;
    return header('Нове опитування', 'Прийде повідомленням у боті') + `<div class="card col">
      <label class="f"><span>Питання</span><input class="in" type="text" maxlength="300" data-bind="polls.form.question" value="${esc(f.question)}" placeholder="Наприклад: Коли зручно зібратись?"></label>
      <div class="f"><span>Варіанти</span>${f.options.map((o, i) => `<div class="row" style="gap:6px"><input class="in grow" type="text" maxlength="120" data-bind="polls.form.options.${i}" value="${esc(o)}" placeholder="Варіант ${i + 1}">${f.options.length > 2 ? `<button type="button" class="btn ghost sm" style="min-height:42px;padding:0 12px" data-a="pollOptDel" data-i="${i}" aria-label="Прибрати варіант">✕</button>` : ''}</div>`).join('')}
        ${f.options.length < 12 ? '<button type="button" class="link-btn" style="align-self:flex-start" data-a="pollOptAdd">+ Додати варіант</button>' : ''}</div>
      <label class="toggle-row" style="padding:0"><span class="small">Можна обрати кілька варіантів</span><input type="checkbox" data-bind="polls.form.multi"${f.multi ? ' checked' : ''}></label>
      <label class="toggle-row" style="padding:0"><span><span class="small" style="display:block">Показувати кількість голосів усім</span><span class="xs muted">імена бачиш лише ти й вищі ролі</span></span><input type="checkbox" data-bind="polls.form.open"${f.open ? ' checked' : ''}></label>
      ${audBlock('poll', f)}
      <button type="button" class="btn" data-a="pollSave"${!f.count ? ' disabled' : ''}>${icon('send', 18)} Надіслати опитування</button></div>`;
  }

  // ───────────── ПІДГОТУВАТИ ЗВІТ ─────────────
  const REP_ITEMS = { club: 'Клуби', mg: 'Малі групи', kr: 'Контактна робота', known: 'Знані по імені (кількість)', finance: 'Фінанси', names: '🙏 Підлітки по іменах — список' };
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
    const canSplit = S.pick.report.keys.some((k) => by[k] && by[k].level !== 'team' && by[k].level !== 'office');
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
    if (d.clubList) {
      const par = d.clubList.some((x) => x.parents);
      h += `<div class="sec">Кожен клуб окремо · ${d.clubList.length}</div>`;
      h += d.clubList.length ? `<div class="card" style="padding:0"><div class="rtab-w"><table class="rtab nm"><thead><tr><th>Команда</th><th>Дата</th><th>Підлітків</th><th>Нових</th><th>Лідерів</th>${par ? '<th>Батьків</th>' : ''}</tr></thead><tbody>
        ${d.clubList.map((x) => `<tr><td>${esc(x.team)}</td><td>${esc(x.date)}</td>${x.none ? `<td colspan="${par ? 4 : 3}" class="muted">не було</td>` : `<td>${x.teens}</td><td>${x.newT}</td><td>${x.leaders}</td>${par ? `<td>${x.parents}</td>` : ''}`}</tr>`).join('')}</tbody></table></div></div>`
        : '<div class="empty">За цей період клубів не вносили</div>';
    }
    if (d.names) {
      h += `<div class="sec">Підлітки по іменах · ${d.names.length}</div>`;
      h += d.names.length ? `<div class="card" style="padding:0"><div class="rtab-w"><table class="rtab nm"><thead><tr><th>Імʼя</th><th>Команда</th><th>Стадія</th><th>Хто веде</th></tr></thead><tbody>
        ${d.names.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.team)}</td><td>${esc(p.stage)}</td><td>${esc(p.leader)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="xs muted">Повний список з контактами — у файлі: «Файлом у Telegram».</div>` : '<div class="note small">У вибраних командах знаних поки немає.</div>';
    }
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
  // два способи мати MyYL на телефоні — компактно, для головної, очікування і «Ще»
  function installCards() {
    const added = S.homeSt === 'added';
    const a = IN_TG ? `<button type="button" class="btn sm" data-a="installHome"${added ? ' disabled' : ''}>${added ? 'Додано ✓' : 'Додати'}</button>`
      : `<button type="button" class="btn sm" data-a="openUrl" data-url="${HOME_LINK}">Додати</button>`;
    const b = IN_TG ? '<button type="button" class="btn sec2 sm" data-a="openApp">У браузері</button>'
      : S.installEvt ? '<button type="button" class="btn sm" data-a="pwaInstall">Встановити</button>'
      : '<button type="button" class="btn sec2 sm" data-a="tabGo" data-s="install">Як це</button>';
    return `<div class="grid2">
      <div class="card opt"><div class="opt-ic">✈️</div><b>Іконка Telegram</b><span class="xs muted">Найпростіше: відкривається одразу в Telegram</span>${a}</div>
      <div class="card opt"><div class="opt-ic">📱</div><b>Окремий застосунок</b><span class="xs muted">На весь екран, без Telegram</span>${b}</div></div>`;
  }
  const installOffer = (closable) => (IS_INSTALLED || S.homeSt === 'added' || (closable && LS.get('hideInstall'))) ? '' :
    `<div class="row" style="margin-top:4px"><b class="grow">📲 MyYL на головний екран</b>${closable ? '<button type="button" class="btn ghost sm" style="min-height:30px;padding:0 10px" data-a="hideInstall" aria-label="Сховати">✕</button>' : ''}</div>
     ${installCards()}<button type="button" class="linkish xs" data-a="tabGo" data-s="install">Детальніше про обидва способи →</button>`;
  VIEWS.install = function () {
    let h = header('MyYL на телефоні', 'Два способи — обери зручний');
    if (IS_INSTALLED) return h + '<div class="card col"><h2>✅ Застосунок встановлено</h2><div class="muted">Ти зараз у ньому. Відкривай MyYL з іконки на головному екрані.</div></div>';
    const step = (n, t) => `<div class="kv"><span class="step-n">${n}</span><span style="text-align:left;flex:1">${t}</span></div>`;
    h += installCards();
    h += `<details class="card det"${IN_TG ? ' open' : ''}><summary>✈️ Іконка Telegram — як додати</summary><div class="rows small">
        ${step(1, 'Натисни <b>«Додати»</b> — Telegram запропонує «На головний екран»')}
        ${step(2, 'Або в MyYL: <b>⋯</b> вгорі праворуч → <b>Add to Home Screen</b>')}
        ${step(3, `Нема пункту? Відкрий MyYL через профіль <b>@${BOT_NAME}</b> → «Відкрити» і повтори. Не допомогло — онови Telegram`)}</div>
        <button type="button" class="btn ghost sm" data-a="copyHome">Скопіювати посилання для команди</button></details>
      <details class="card det"${IN_TG ? '' : ' open'}><summary>📱 Окремий застосунок — iPhone</summary><div class="rows small">
        ${step(1, `Відкрий посилання в <b>Safari</b>${IN_TG ? ' (кнопка «У браузері» вище)' : ''}`)}
        ${step(2, '«Поділитися» <b>⎋</b> → «На початковий екран» → «Додати»')}
        ${step(3, 'Відкрий MyYL з іконки → «Увійти через Telegram»')}</div></details>
      <details class="card det"><summary>📱 Окремий застосунок — Android</summary><div class="rows small">
        ${step(1, 'Відкрий посилання в <b>Chrome</b>')}
        ${step(2, 'Меню <b>⋮</b> → «Встановити застосунок»')}
        ${step(3, 'Відкрий MyYL з іконки → «Увійти через Telegram»')}</div></details>
      ${IN_TG ? '<button type="button" class="btn ghost sm" data-a="copyApp">Скопіювати посилання на окремий застосунок</button>' : ''}`;
    return h;
  };

  // ───────────── СПОВІЩЕННЯ ─────────────
  VIEWS.notif = function () {
    const m = me();
    let h = header('Сповіщення', 'Що бот надсилає тобі в Telegram');
    const N = (m.profile && m.profile.notif) || {};
    const NL = [['bc', 'Розсилки від інших', 'повідомлення «Написати» від керівників'], ['remind', 'Нагадування про звіти', 'якщо щось не внесено за тиждень'], ['events', 'Нагадування про події', 'на які ти записався'], ['tasks', 'Задачі й опитування', 'нові задачі, нагадування, опитування']].concat(caps().approve ? [['requests', 'Нові заявки на ролі', 'коли хтось чекає твого підтвердження']] : []);
    h += `<div class="card list">${NL.map((x) => `<label class="check" style="min-height:58px"><span class="grow"><span class="b" style="display:block">${x[1]}</span><span class="xs muted">${x[2]}</span></span><input type="checkbox" data-ch="notifToggle" data-k="${x[0]}"${N[x[0]] !== false ? ' checked' : ''}></label>`).join('')}</div>`;
    h += '<div class="xs muted">Вимкнене сповіщення не зникає з застосунку: заявки, події й звіти так само видно тут.</div>';
    return h;
  };

  function structDelView() {
    const x = S.structDelS;
    let h = `<div class="card col" style="border:2px solid var(--pink)"><h2>Видалити команду «${esc(x.name)}»</h2>`;
    if (!x.info) return h + loading() + '</div>';
    const u = x.info.usage;
    if (x.info.empty) {
      h += '<div class="small muted">Команда порожня — у ній немає людей і даних.</div>';
      h += `<div class="row"><button type="button" class="btn sec2 sm" data-a="structDelCancel">Скасувати</button><button type="button" class="btn sm grow" style="background:var(--pink)" data-a="structDelGo">Видалити</button></div>`;
    } else {
      h += `<div class="small">У команді є дані: ${[u.people ? u.people + ' люд.' : '', u.reports ? u.reports + ' звітів' : '', u.known ? u.known + ' знаних' : '', u.finance ? u.finance + ' фін. звітів' : ''].filter(Boolean).join(', ')}.</div>
        <div class="pills" style="flex-wrap:wrap">${x.info.targets.length ? `<button type="button" class="pill${x.mode !== 'drop' ? ' on' : ''}" data-a="structDelMode" data-m="move">Перенести в іншу команду ерії</button>` : ''}<button type="button" class="pill${x.mode === 'drop' || !x.info.targets.length ? ' on' : ''}" data-a="structDelMode" data-m="drop">Не переносити</button></div>
        ${x.mode !== 'drop' && x.info.targets.length ? `<div class="small muted">Люди, звіти, знані, фінанси й події перейдуть у вибрану команду.</div>
          <label class="f"><span>Перенести в</span><select class="in" data-bind="structDelS.into"><option value="">— обери команду —</option>${x.info.targets.map((t) => `<option value="${esc(t.id)}"${x.into === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`
        : '<div class="small" style="color:var(--pink)">Ролі людей у цій команді знімуться, а її звіти, знані, фінанси й події видаляться назавжди.</div>'}
        <div class="row"><button type="button" class="btn sec2 sm" data-a="structDelCancel">Скасувати</button><button type="button" class="btn sm grow" style="background:var(--pink)" data-a="structDelGo">${x.mode !== 'drop' && x.info.targets.length ? 'Перенести й видалити' : 'Видалити з даними'}</button></div>`;
    }
    return h + '</div>';
  }

  // ───────────── ЩЕ ─────────────
  // пункти «Ще» по групах — і для екрана «Ще», і для ярликів на головній
  function moreSections() {
    const c = caps();
    const tiles = sectionTiles();
    const tile = (k) => tiles.filter((t) => t.k === k)[0];
    const td = me().todo || {};
    const has = (x) => !!x;
    // 1. особисте
    const mine = [{ k: 'profile', label: 'Мій профіль', sub: myLine(), icon: 'profile', ic: 'ic-soft' },
      { k: 'mystats', label: 'Моя статистика', sub: 'клуби, малі групи, КР, знані', icon: 'stats', ic: 'ic-coral' },
      { k: 'ach', label: 'Ачівки', sub: 'нагороди за служіння', icon: 'check', ic: 'ic-yellow' }];
    if (c.approve) mine.push({ k: 'requests', label: 'Заявки', sub: 'підтвердження ролей', icon: 'requests', ic: 'ic-blue', badge: me().pendingCount });
    // 2. команда
    const team = [tile('myyl') && Object.assign({}, tile('myyl'), { label: 'Моя команда' }),
      { k: 'calendar', label: 'Календар Young Life', sub: 'події, «Йду / їду», нагадування', icon: 'calendar', ic: 'ic-blue' },
      { k: 'tasks', label: 'Задачі до виконання', sub: c.broadcast ? 'доручити й стежити за виконанням' : 'що тобі доручили', icon: 'task', ic: 'ic-teal', badge: td.tasks },
      { k: 'polls', label: 'Опитування', sub: c.broadcast ? 'запитати й побачити, хто як голосує' : 'голосуй за варіант', icon: 'poll', ic: 'ic-purple', badge: td.polls },
      { k: 'res', label: 'Корисні ресурси', sub: 'файли й посилання для служіння', icon: 'res', ic: 'ic-yellow' },
      { k: 'bank', label: 'Банк ідей', sub: 'теми, ігри, пісні, проповіді з клубів усіх команд', icon: 'idea', ic: 'ic-coral' },
      tile('broadcast')].filter(has);
    (me().ws || []).forEach((w) => team.unshift({ k: 'ws', label: 'Робочий простір', sub: w.name + ' · задачі, сторінки, стратегія', icon: 'ws', ic: 'ic-purple', badge: w.late || w.open || 0 }));
    if ((me().clubPlans || []).length) team.splice(1, 0, { k: 'club', label: 'Наш клуб', sub: 'план, програма, кошик ідей, архів', icon: 'club', ic: 'ic-teal' });
    // 3. звіти
    const reps = [tile('finance') && Object.assign({}, tile('finance'), { label: 'Місячний фінансовий звіт' })];
    if ((c.reportItems || []).length) reps.push({ k: 'report', label: 'Підготувати звіт', sub: 'за період, по регіону, ерії чи команді', icon: 'doc', ic: 'ic-yellow' });
    if (c.dirs) reps.push({ k: 'dirs', label: 'Статистика за напрямками', sub: 'YoungLife · WyldLife · College · Capernaum · YoungMoms', icon: 'stats', ic: 'ic-purple' });
    reps.push(tile('team') && Object.assign({}, tile('team'), { label: 'Склад команд' }));
    // 4. керування й налаштування
    const manage = [tile('structure')];
    if ((S.me.scopes || []).length) manage.push({ k: 'inst', label: 'Встановили MyYL', sub: 'хто вже в застосунку — по регіонах, еріях, командах', icon: 'phoneApp', ic: 'ic-teal' });
    if (c.perms) manage.push({ k: 'perms', label: 'Дозволи й доступ', sub: 'що можуть ланки нижче', icon: 'lock', ic: 'ic-soft' });
    manage.push({ k: 'notif', label: 'Сповіщення', sub: 'що бот надсилає тобі', icon: 'bell', ic: 'ic-yellow' });
    // 5. застосунок
    const app = [{ k: 'install', label: IS_INSTALLED ? 'Застосунок MyYL' : 'Додати на головний екран', sub: IS_INSTALLED ? 'встановлено ✓' : (S.homeSt === 'added' ? 'іконку додано ✓' : 'іконка YL на телефоні — як це зробити'), icon: 'phoneApp', ic: 'ic-teal' }];
    app.push({ k: 'bug', label: 'Повідомити про помилку', sub: 'щось не працює чи незручно — напиши', icon: 'send', ic: 'ic-coral' });
    if (c.isSuper) app.push({ k: 'bugs', label: 'Повідомлення про помилки', sub: 'що пишуть користувачі', icon: 'bell', ic: 'ic-purple', badge: me().bugsOpen });
    return [['Особисте', mine], ['Команда', team], ['Звіти', reps.filter(has)], ['Керування', manage.filter(has)], ['Застосунок', app]];
  }
  const moreItem = (k) => { let f = null; moreSections().forEach(([, items]) => items.forEach((m) => { if (!f && m.k === k) f = m; })); return f; };
  VIEWS.more = function () {
    const c = caps();
    const list = (items) => `<div class="card list">${items.map((m) => `<button type="button" class="li" ${m.a ? `data-a="${m.a}"` : `data-a="tabGo" data-s="${m.k}"`}><span class="ic ${m.ic}">${icon(m.icon, 18)}</span>
      <span class="grow"><span class="b" style="display:block">${esc(m.label)}</span><span class="small muted">${esc(m.sub)}</span></span>${m.badge ? `<span class="badge">${m.badge}</span>` : ''}<span class="muted">${icon('chev', 18)}</span></button>`).join('')}</div>`;
    let h = header('Ще');
    moreSections().forEach(([t, items]) => {
      if (items.length) h += `<div class="sec">${t}</div>` + list(items);
    });
    if (ACT_AS) h += `<div class="card row view-pick"><span class="grow small"><b>🎭 Ти зараз як: ${esc((S.me && S.me.actAs && S.me.actAs.name) || ACT_AS.name)}</b><br><span class="xs muted">повний функціонал цієї людини</span></span><button type="button" class="btn sm" data-a="actExit">Повернутися до себе</button></div>`;
    else if (c.isSuper && !VIEW_AS) {
      const F = S.actFind || {};
      h += `<div class="card col view-pick" style="gap:8px"><span class="small"><b>🎭 Переглянути, як:</b><br><span class="xs muted">введи імʼя — і побачиш застосунок цієї людини з усіма її можливостями: вносити, звітувати, редагувати</span></span>
        <input class="in" type="search" placeholder="Імʼя або прізвище" value="${esc(F.q || '')}" data-bind="actFind.q" data-live="actFind" aria-label="Кого показати">
        ${F.loading ? '<div class="xs muted">Шукаю…</div>' : ''}${(F.list || []).length ? `<div class="list">${F.list.map((x) => `<button type="button" class="li" data-a="actAs" data-id="${esc(x.id)}" data-n="${esc(x.name)}"><span class="grow"><b>${esc(x.name)}</b><br><span class="xs muted">${esc(x.role)}</span></span>${icon('chev', 16)}</button>`).join('')}</div>` : F.q && F.q.trim().length >= 2 && !F.loading ? '<div class="xs muted">Нікого не знайдено</div>' : ''}</div>`;
    }
    const vr = (VIEW_ROLES || (S.me && S.me.viewRoles) || []);
    if ((vr.length || VIEW_AS) && !ACT_AS) {
      h += `<label class="card row view-pick"><span class="grow small"><b>👁 Відобразити як для</b><br><span class="xs muted">лише перегляд, нічого не зміниться</span></span>
        <select class="in" data-ch="viewPick" aria-label="Відобразити як для"><option value="">Себе</option>${vr.map((r) => `<option value="${r.key}"${VIEW_AS && VIEW_AS.key === r.key ? ' selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>`;
    }
    if (c.isSuper && !VIEW_AS) h += `<button type="button" class="card row li" style="margin-top:2px" data-a="tabGo" data-s="dupes"><span class="ic ic-yellow">${icon('club', 18)}</span><span class="grow"><span class="b" style="display:block">Можливі дублікати</span><span class="small muted">схожі імена, латиниця й кирилиця — обʼєднати чи залишити</span></span><span class="muted">${icon('chev', 18)}</span></button>`;
    return h;
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
    h += `<div class="row" style="gap:8px;align-items:center"><div class="small muted grow">${list.length} ${word(list.length)} · за них молимось${list.length ? ' · гортай колонки вбік →' : ''}</div>
      ${list.length ? `<button type="button" class="linkish small" data-a="knownExport"${k.exporting ? ' disabled' : ''}>📄 Витягти список</button>` : ''}</div>`;
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
  const ylBadge = '<span class="yl-badge" title="Зареєстрований(-а) в MyYL" aria-label="є в MyYL">YL</span>';
  function memberFormView() {
    const a = S.team.add, list = caps().addTeams || [];
    const cur = list.filter((x) => x.id === a.teamId)[0] || list[0];
    if (!cur) return header('Додати людей') + '<div class="empty">Немає команд, куди ти можеш додавати</div>';
    if (cur.roles.indexOf(a.role) < 0) a.role = cur.roles.indexOf('LEADER') >= 0 ? 'LEADER' : cur.roles[cur.roles.length - 1];
    return header('Додати людей у склад') + `<div class="card col">
      ${teamSelect(list.map((x) => x.id), cur.id, 'memTeam')}
      <label class="f"><span>Роль</span><select class="in" data-bind="team.add.role">${cur.roles.map((k) => `<option value="${k}"${k === a.role ? ' selected' : ''}>${esc(roleDef(k).label)}</option>`).join('')}</select></label>
      <label class="f"><span>Імʼя та прізвище</span><textarea class="in" rows="5" data-bind="team.add.names" placeholder="Кожна людина з нового рядка:
Анна Попович
Матвій Шаповалов">${esc(a.names)}</textarea></label>
      <button type="button" class="btn" data-a="memberSave"${a.busy ? ' disabled' : ''}>${icon('plus', 18)} Додати</button>
      <div class="xs muted">Роль діє одразу, підтверджувати не треба. Коли людина зареєструється в MyYL, вона обере себе зі списку команди — і біля імені з'явиться ${ylBadge}</div></div>`;
  }
  VIEWS.team = function () {
    const t = S.team;
    if (t.add) return memberFormView();
    const canAdd = (caps().addTeams || []).length > 0;
    let h = header('Склад команди', pickLabel('team'), canAdd ? `<button type="button" class="icon-btn accent" data-a="memberNew" aria-label="Додати людей">${icon('plus', 22)}</button>` : '');
    h += picker('team');
    if (!t.list) return h + loading();
    if (!t.list.length) return h + '<div class="empty">Тут ще нікого немає</div>';
    const groups = [];
    t.list.forEach((p) => { const g = groups[groups.length - 1]; if (g && g.id === p.teamId) g.list.push(p); else groups.push({ id: p.teamId, name: p.team, list: [p] }); });
    const regN = (l) => l.filter((p) => p.registered !== false).length;
    if (groups.length === 1) h += `<div class="small muted">${g0Line(groups[0], regN)}</div>`;
    h += groups.map((g) => `${groups.length > 1 ? `<div class="sec">${esc(g.name)} · ${g0Line(g, regN)}</div>` : ''}<div class="card list">${g.list.map((p) => {
      const oid = p.tgId + '|' + p.teamId, open = t.open === oid, pr = p.profile || {};
      return `<button type="button" class="li" data-a="teamOpen" data-id="${esc(oid)}">${avaHtml(p.tgId, p.name)}
        <span class="grow"><span class="b" style="display:block">${esc(p.name)}${p.registered !== false ? ylBadge : ''}</span><span class="row wrap" style="gap:6px;margin-top:4px">${p.roles.map((r) => `<span class="tag">${esc(r.label)}</span>`).join('')}${p.registered === false ? '<span class="xs muted">ще не в MyYL</span>' : ''}</span></span></button>
        ${open ? `<div style="padding:0 16px 12px;border-bottom:1px solid var(--line)">${[['Telegram', p.username ? '@' + p.username : ''], ['Instagram', pr.ig], ['Телефон', pr.phone], ['Дата народження', pr.bday ? fmtDay(pr.bday) : ''], ['Родина', pr.family], ['Рік покаяння', pr.repent], ['Рік хрещення', pr.baptism], ['Рік ЛПYL', pr.lpyl], ['Відповідальності', pr.resp]].filter((x) => x[1]).map((x) => `<div class="kv small"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('') || '<div class="small muted">Анкету ще не заповнено</div>'}
          <div class="sec" style="margin:10px 0 4px">Ролі й команди</div>
          ${(p.all || p.roles.map((r) => ({ id: r.id, label: r.label, unit: p.team, canRemove: r.canRemove }))).map((r) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line);gap:8px"><span class="grow small"><b>${esc(r.label)}</b> · ${esc(r.unit)}</span>${r.canRemove && r.titled ? `<button type="button" class="btn ghost sm" style="min-height:32px;padding:0 10px" data-a="roleRename" data-id="${esc(r.id)}">Назва</button>` : ''}${r.canRemove ? `<button type="button" class="btn ghost sm" style="min-height:32px;padding:0 10px" data-a="roleRemove" data-id="${esc(r.id)}" data-label="${esc(r.label + ' · ' + r.unit)}" data-name="${esc(p.name)}">Зняти</button>` : ''}</div>${t.rename && t.rename.id === r.id ? `<div class="row" style="gap:6px;padding-bottom:8px"><input id="renameIn" class="in grow" type="text" maxlength="60" data-bind="team.rename.title" value="${esc(t.rename.title)}" placeholder="Назва ролі"><button type="button" class="btn sm" data-a="roleRenameSave">OK</button><button type="button" class="btn ghost sm" data-a="roleRenameCancel">✕</button></div>` : ''}`).join('')}
          ${grantBtn(p.tgId, p.name, 'team', p.teamId)}${grantForm(p.tgId)}
          ${p.canDrop ? `<button type="button" class="btn ghost sm danger-t" style="margin-top:10px;width:100%" data-a="memberRemove" data-ids="${esc(p.roles.map((r) => r.id).join(','))}" data-name="${esc(p.name)}" data-team="${esc(p.team)}" data-reg="${p.registered !== false ? 1 : ''}">🗑 Видалити зі складу</button>` : ''}</div>` : ''}`;
    }).join('')}</div>`).join('') + '<div class="xs muted">Анкету кожен заповнює у своєму профілі.</div>';
    return h;
  };

  function g0Line(g, regN) { const n = regN(g.list); return g.list.length + ' ' + (g.list.length === 1 ? 'людина' : g.list.length < 5 && g.list.length > 1 ? 'людини' : 'людей') + (n < g.list.length ? ' · у MyYL ' + n : ''); }

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
  // виправити заявку: роль і ланку (регіон → ерія → команда)
  function reqEditForm() { return roleUnitForm(S.reqEdit, 'reqEdit', 'Зберегти зміни', 'Після збереження підтверди заявку як звичайно — людина отримає вже виправлену роль.'); }
  function roleUnitForm(E, P, saveLabel, note) {
    const st = struct();
    const roles = me().editRoles || [];
    const def = roles.find((x) => x.key === E.key) || {};
    const areas = st.areas.filter((a) => a.regionId === E.regionId), teams = st.teams.filter((t) => t.areaId === E.areaId);
    const sel = (ch, label, list, cur, dis) => `<label class="f"><span>${label}</span><select class="in" data-ch="${ch}"${dis ? ' disabled' : ''}><option value="">Обери…</option>${list.map((x) => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    let h = `<div class="card col" style="gap:8px;margin:2px 0 8px;background:var(--glass-hi)"><label class="f"><span>Роль</span><select class="in" data-ch="${P}Key">${roles.map((x) => `<option value="${x.key}"${x.key === E.key ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`;
    if (def.level && def.level !== 'nat') h += sel(P + 'Region', 'Регіон', st.regions, E.regionId);
    if (def.level === 'area' || def.level === 'team') h += sel(P + 'Area', 'Ерія', areas, E.areaId, !E.regionId);
    if (def.level === 'team') h += sel(P + 'Team', 'Команда', teams.filter((t) => t.state !== 'closed'), E.teamId, !E.areaId);
    h += `<div class="row"><button type="button" class="btn sec2 sm" data-a="${P}Cancel">Скасувати</button><button type="button" class="btn sm grow" data-a="${P}Save">${saveLabel}</button></div>
      ${note ? `<div class="xs muted">${note}</div>` : ''}</div>`;
    return h;
  }
  VIEWS.requests = function () {
    let h = header('Заявки', S.reqOthers ? 'Не стосуються тебе напряму, але ти можеш підтвердити' : 'Чекають саме на тебе');
    if (!S.reqs) return h + loading();
    const main = S.reqs.filter((p) => p.primary), other = S.reqs.filter((p) => !p.primary);
    h += `<div class="seg" role="tablist"><button type="button" role="tab" class="${!S.reqOthers ? 'on' : ''}" data-a="reqTab" data-v="0">Мені · ${main.length}</button><button type="button" role="tab" class="${S.reqOthers ? 'on' : ''}" data-a="reqTab" data-v="1">Інші заявки · ${other.length}</button></div>`;
    const card = (p) => `<div class="card col"><div class="row">${avaHtml(p.tgId, p.name, 'background:rgba(76,110,245,.18)')}
      <div class="grow"><div class="b">${esc(p.name)}</div><div class="small muted">${p.username ? '@' + esc(p.username) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</div></div></div>
      <div class="col" style="gap:4px">${p.roles.map((r) => `<label class="check" style="border:0;border-radius:12px;background:var(--soft);min-height:46px;padding:0 12px"><input type="checkbox" data-ch="reqToggle" data-id="${esc(r.id)}"${S.reqSel[r.id] ? ' checked' : ''}>
        <span class="grow"><span class="b">${esc(r.label)}</span> <span class="small muted">· ${esc(r.unitName)}</span></span>${(me().editRoles || []).length ? `<button type="button" class="btn ghost sm" style="min-height:32px;padding:0 10px" data-a="reqEdit" data-id="${esc(r.id)}">Змінити</button>` : ''}</label>${S.reqEdit && S.reqEdit.id === r.id ? reqEditForm() : ''}${r.titled ? `<label class="f" style="padding:0 4px 6px"><span>Назва ролі — можна виправити перед підтвердженням</span><input class="in" type="text" maxlength="60" data-bind="reqTitle.${esc(r.id)}" value="${esc(S.reqTitle[r.id] != null ? S.reqTitle[r.id] : r.title)}"></label>` : ''}`).join('')}</div>
      <div class="row"><button type="button" class="btn sec2 sm" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="0">Відхилити</button>
      <button type="button" class="btn teal sm grow" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="1">Підтвердити вибрані</button></div></div>`;
    if (!S.reqOthers) {
      h += main.length ? main.map(card).join('') : '<div class="empty">Нових заявок для тебе немає</div>';
    } else {
      h += '<div class="xs muted">Ці заявки вже отримали відповідальні на своєму рівні. Підтверджуй тих, кого знаєш.</div>';
      h += other.length ? other.map(card).join('') : '<div class="empty">Інших заявок немає</div>';
    }
    return h;
  };

  // ───────────── ПРОФІЛЬ ─────────────
  VIEWS.profile = function () {
    if (S.roleReq) return roleReqView();
    const m = me(), p = S.profile || {};
    let h = header('Мій профіль', '', IN_TG ? '' : '<button type="button" class="btn ghost sm" data-a="logout">Вийти</button>');
    h += `<div class="row">${myAvatar()}<div><div style="font:800 20px Manrope,Inter,sans-serif">${esc(m.user.name)}</div><div class="small muted">${esc(myLine())}${m.user.username ? ' · @' + esc(m.user.username) : ''}</div></div></div>`;
    const PH = m.user.photo || { own: false, tg: !!myPhoto(), useTg: true };
    h += `<div class="card col" style="gap:8px">
      <label class="toggle-row" style="min-height:44px"><span><span class="b" style="display:block">Моє фото з Telegram</span><span class="xs muted">${PH.tg ? 'береться з твого профілю в Telegram' : 'у Telegram фото не знайдено (або воно приховане)'}</span></span><input type="checkbox" data-ch="photoTg"${PH.useTg ? ' checked' : ''}${S.phBusy ? ' disabled' : ''}></label>
      <div class="row" style="gap:8px"><label class="btn sm sec2 grow" style="cursor:pointer">${S.phBusy ? 'Завантажую…' : (PH.own ? '📷 Змінити своє фото' : '📷 Завантажити своє фото')}<input type="file" accept="image/*" data-ch="photoPick" style="display:none"${S.phBusy ? ' disabled' : ''}></label>${PH.own ? '<button type="button" class="btn sm ghost" data-a="photoDel">Прибрати</button>' : ''}</div>
      <div class="xs muted">Фото бачать у складі команди, гілках MyYL і робочому просторі.</div></div>`;
    const act = (m.roles || []).filter((r) => r.status === 'активна');
    if (act.length > 1) h += `<div class="sec">Основна роль</div><div class="card col" style="gap:6px"><select class="in" data-ch="mainRole"><option value="">Автоматично — найвища роль</option>${act.map((r) => `<option value="${esc(r.id)}"${(m.profile || {}).main === r.id ? ' selected' : ''}>${esc(r.label + ' · ' + r.unitName)}</option>`).join('')}</select>
      <div class="xs muted">Тут рахуються твої особисті записи: знані «Без команди», а для вищих ролей — мала група й контактна робота.</div></div>`;
    h += `<div class="sec">Мої ролі</div><div class="card list">${(m.roles || []).map((r) => `<div class="li" style="min-height:52px"><span class="grow b">${esc(r.label)}</span><span class="small muted">${esc(r.unitName)}</span>${r.status !== 'активна' ? '<span class="tag warn">очікує</span>' : ''}</div>`).join('')}
      <button type="button" class="li" style="justify-content:center;color:var(--accent-text);font-weight:600" data-a="roleReqOpen">${caps().isSuper ? '+ Додати собі роль' : '+ Попросити ще роль'}</button></div>`;
    const F = [['name', 'Імʼя та прізвище', 'text'], ['phone', 'Телефон', 'tel'], ['ig', 'Instagram', 'text'], ['email', 'Gmail (для доступу до таблиць)', 'email'], ['bday', 'Дата народження', 'date'], ['repent', 'Рік покаяння', 'number'], ['baptism', 'Рік хрещення', 'number'], ['lpyl', 'Рік проходження ЛПYL', 'number'], ['resp', 'Відповідальності на клубі', 'text']];
    h += `<div class="sec">Анкета</div><div class="card col">${F.map((f) => `<label class="f"><span>${f[1]}</span><input class="in" type="${f[2]}" ${f[2] === 'number' ? 'inputmode="numeric" min="1950" max="2100"' : ''} value="${esc(p[f[0]] || '')}" data-bind="profile.${f[0]}"></label>`).join('')}
      <button type="button" class="btn" data-a="profileSave">Зберегти анкету</button></div>`;
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
    const defs = me().roleDefs.filter((r) => r.key !== 'SUPER' && !r.hidden);
    const team = defs.filter((r) => r.level === 'team');
    const upper = defs.filter((r) => r.level !== 'team' && r.key !== 'OFFICE');
    const office = defs.filter((r) => r.key === 'OFFICE');
    const HINT = { OFFICE: 'обереш посаду', AREA_OFFICE: 'назвеш свою роль сам' };
    const obj = prefix === 'reg' ? 'reg' : 'roleReq';
    const box = (r) => `<label class="check"><input type="checkbox" data-ch="${prefix}Role" data-k="${r.key}"${o.roles[r.key] ? ' checked' : ''}><span class="grow b" style="font-weight:500">${esc(r.label)}</span>${HINT[r.key] ? `<span class="xs muted">${HINT[r.key]}</span>` : ''}</label>`
      + (r.titles && o.roles[r.key] ? officeTitles(o, prefix, obj, r) : '')
      + (r.titled && !r.titles && o.roles[r.key] ? `<div style="padding:4px 16px 12px"><label class="f"><span>Як називається твоя роль? (${esc(r.label.toLowerCase())})</span><input class="in" type="text" maxlength="60" data-bind="${obj}.titles.${r.key}" value="${esc((o.titles || {})[r.key] || '')}" placeholder="напр., Бухгалтер, Координатор подій"></label></div>` : '');
    let h = `<div class="card list">${team.map(box).join('')}</div>`;
    if (office.length) h += `<div class="card list">${office.map(box).join('')}</div>`;
    h += `<label class="toggle-row"><span class="b" style="font-weight:500">Я служу на рівні ерії, регіону чи країни</span><input type="checkbox" data-ch="${prefix}Upper"${o.upper ? ' checked' : ''}></label>`;
    if (o.upper) h += `<div class="card list">${upper.map(box).join('')}</div>`;
    const needMail = Object.keys(o.roles).some((k) => o.roles[k] && roleDef(k) && roleDef(k).rank <= 6);
    if (needMail) h += `<label class="f"><span>Gmail — на нього відкриється доступ до таблиць на Диску</span><input class="in" type="email" data-bind="${prefix === 'reg' ? 'reg' : 'roleReq'}.email" value="${esc(o.email)}" placeholder="name@gmail.com"></label>`;
    return h;
  }
  // посади нацофісу: можна кілька + своя
  function officeTitles(o, prefix, obj, r) {
    const sel = o.offSel || {};
    return `<div class="col" style="gap:8px;padding:4px 16px 14px"><div class="small">Яка твоя посада? <span class="muted">Можна кілька</span></div>
      ${r.titles.map((g) => `<div class="xs muted b">${esc(g.group)}</div><div class="pills" style="flex-wrap:wrap">${g.items.map((t) => `<button type="button" class="pill${sel[t] ? ' on' : ''}" data-a="${prefix}OffT" data-t="${esc(t)}" aria-pressed="${!!sel[t]}">${esc(t)}</button>`).join('')}</div>`).join('')}
      <label class="f"><span>Інша посада (якщо немає в списку)</span><input class="in" type="text" maxlength="60" data-bind="${obj}.offOther" value="${esc(o.offOther || '')}" placeholder="Напиши свою"></label></div>`;
  }
  const officeTitle = (o) => Object.keys(o.offSel || {}).filter((k) => o.offSel[k]).concat(String(o.offOther || '').trim() ? [String(o.offOther).trim()] : []).join(', ');
  function rolePayload(o) {
    return {
      name: o.name, phone: o.phone, email: o.email, regionId: o.regionId, areaId: o.areaId,
      teamId: o.teamId === '__new' ? '' : o.teamId, newTeamName: o.teamId === '__new' ? o.newTeam : '',
      roles: Object.keys(o.roles).filter((k) => o.roles[k]),
      titles: Object.assign({}, o.titles || {}, o.roles.OFFICE ? { OFFICE: officeTitle(o) } : {}),
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
    let h = `<div class="row between"><div class="row">${canBack() ? `<button type="button" class="icon-btn" data-a="back" aria-label="Назад">${icon('back')}</button>` : '<div class="logo"><img src="icons/yl-mark.png" alt="Young Life"></div>'}<b>Young Life Україна</b></div><span class="small muted">Крок ${r.step} з 3</span></div>
      <div class="track"><i style="width:${Math.round(r.step / 3 * 100)}%;background:var(--accent);border-radius:4px"></i></div>`;
    if (r.step === 1) {
      h += `<div><h1>Привіт! Давай познайомимось</h1><p class="muted" style="margin:6px 0 0">Тут звіти, знані по імені, календар і статистика твоєї команди. Паролі не потрібні — тебе впізнає Telegram.</p></div>
        <label class="f"><span>Імʼя та прізвище — українською, як тебе знає команда</span><input class="in" type="text" data-bind="reg.name" value="${esc(r.name)}" placeholder="Наприклад: Олена Коваль" autocomplete="off"></label>
        <label class="f"><span>Телефон</span><input class="in" type="tel" data-bind="reg.phone" value="${esc(r.phone)}" placeholder="+380…" autocomplete="tel"></label>
        ${tg && tg.requestContact ? `<button type="button" class="btn ghost" data-a="regContact">${icon('phone', 18)} Взяти номер з Telegram</button>` : ''}
        <button type="button" class="btn" data-a="regNext">Далі</button>`;
    }
    if (r.step === 2) h += `<div><h1>Де ти служиш?</h1><p class="muted" style="margin:6px 0 0">Обери регіон, ерію та команду.</p></div>
      <label class="toggle-row card" style="padding:12px 16px"><span><span class="b" style="display:block">Я працюю в національному офісі</span><span class="small muted">Регіон можна не обирати, якщо не служиш ще й у команді</span></span><input type="checkbox" data-ch="regOffice"${r.office ? ' checked' : ''}></label>
      ${whereFields(r, 'reg')}<button type="button" class="btn" data-a="regNext">Далі</button>`;
    if (r.step === 3 && (r.claims || []).length) {
      h += `<div class="card col" style="gap:6px"><h2>Ти вже є в складі «${esc(teamName(r.teamId))}»?</h2><div class="small muted">Капітан уже додав людей у команду. Обери себе — роль запрацює одразу, без підтвердження.</div>
        ${r.claims.map((x) => `<label class="check" style="padding:0"><input type="radio" name="regClaim" data-ch="regClaim" data-id="${esc(x.id)}"${r.claim === x.id ? ' checked' : ''}><span class="grow"><b>${esc(x.name)}</b> <span class="small muted">· ${esc(x.roles.join(', '))}</span></span></label>`).join('')}
        <label class="check" style="padding:0"><input type="radio" name="regClaim" data-ch="regClaim" data-id=""${!r.claim ? ' checked' : ''}><span class="grow">Ні, мене тут немає</span></label></div>`;
    }
    if (r.step === 3) h += `<div><h1>${r.claim ? 'Ще якась роль?' : 'Яка твоя роль?'}</h1><p class="muted" style="margin:6px 0 0">${r.claim ? 'Необовʼязково. Якщо служиш ще десь — обери, це піде на підтвердження.' : 'Можна обрати кілька. Ролі підтверджує капітан команди або хтось вище.'}</p></div>${roleFields(r, 'reg')}<button type="button" class="btn" data-a="regSubmit">Надіслати заявку</button>`;
    return h;
  };

  VIEWS.pending = function () {
    const m = me();
    return `<div class="row"><div class="logo"><img src="icons/yl-mark.png" alt="Young Life"></div><b>Young Life Україна</b></div>
      <div style="width:72px;height:72px;border-radius:36px;background:rgba(20,184,166,.16);color:var(--teal);display:flex;align-items:center;justify-content:center;margin-top:16px">${icon('check', 36)}</div>
      <h1>Заявку надіслано</h1><p class="muted" style="margin:0">Її розгляне ${esc(m.approvers || 'керівництво')}. Щойно доступ відкриють — бот напише тобі в Telegram.</p>
      <div class="card list">${(m.roles || []).map((r) => `<div class="li" style="min-height:52px"><span class="grow b">${esc(r.label)}</span><span class="small muted">${esc(r.unitName)}</span><span class="tag warn">очікує</span></div>`).join('')}</div>
      <button type="button" class="btn sec2" data-a="reload">Оновити</button>
      ${installOffer(false) ? `<div class="card col" style="gap:10px">${installOffer(false)}</div>` : ''}`;
  };

  // ───────────── ДІЇ ─────────────
  const A = {};
  function thank() { S.thanks = true; haptic('success'); render(); }
  A.thanksClose = () => { try { tg.HapticFeedback.impactOccurred('medium'); } catch (e) { /* ок */ } S.thanks = false; render(); };
  A.reload = () => { $app.innerHTML = loading(); S.me = null; loadMe(); };
  A.back = back;
  A.tab = (d) => go(d.s);
  A.tabGo = (d) => go(d.s);
  // ── наш клуб ──
  A.clubGo = (d) => { if (S.club.teamId !== d.t) { S.club.data = null; S.club.archOpen = null; S.club.archAll = false; } S.club.teamId = d.t; go('club'); };
  A.clubTeam = async (d) => {
    if (d.t === S.club.teamId) return;
    if (S.club.dirty && !(await confirmAsk('План не збережено. Перейти до іншої команди без збереження?'))) return;
    S.club.teamId = d.t; S.club.data = null; S.club.dirty = false; S.club.archOpen = null; S.club.archAll = false; render(); loadClub();
  };
  A.clubDirty = () => {
    if (S.club.dirty) return;
    S.club.dirty = true;
    const b = document.querySelector('[data-a="clubSave"]'); if (b) { b.disabled = false; b.lastChild.textContent = ' ' + (S.club.f.id ? 'Зберегти план' : 'Створити план'); }
  };
  A.clubFmt = (d) => { S.club.f.format = d.v; clubRe(); if (d.v === '_other') { const i = document.querySelector('[data-bind="club.f.formatOther"]'); if (i) i.focus(); } };
  const clubRe = () => { S.club.dirty = true; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.progAdd = (d) => { const f = S.club.f; f.program.push({ kind: d.k, name: d.k === 'talk' ? f.sermon || f.topic || '' : '', desc: d.k === 'talk' ? f.scripture || '' : '' }); clubRe(); const L = document.querySelectorAll('[data-bind^="club.f.program."][data-bind$=".name"]'); if (L.length) L[L.length - 1].focus(); };
  A.progKind = (d) => { const g = S.club.f.program[Number(d.i)], K = PROG_KINDS.map((k) => k[0]); g.kind = K[(K.indexOf(g.kind) + 1) % K.length]; clubRe(); };
  A.clubRowDel = (d) => { S.club.f[d.k].splice(Number(d.i), 1); if (d.k === 'roles') S.club.pick = null; clubRe(); };
  A.clubRoleAdd = (d) => { S.club.f.roles.push({ name: d.v || '', text: '', who: [] }); S.club.pick = d.v ? S.club.f.roles.length - 1 : null; clubRe(); if (!d.v) { const L = document.querySelectorAll('[data-bind^="club.f.roles."][data-bind$=".name"]'); if (L.length) L[L.length - 1].focus(); } };
  A.clubPick = (d) => { const i = Number(d.i); S.club.pick = S.club.pick === i ? null : i; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.clubWho = (d) => { const r = S.club.f.roles[Number(d.i)], k = r.who.indexOf(d.id); if (k >= 0) r.who.splice(k, 1); else r.who.push(d.id); clubRe(); };
  A.clubSave = async (d, el) => {
    const C = S.club, f = C.f;
    el.disabled = true;
    try {
      const fmt = f.format === '_other' ? String(f.formatOther || '').trim() : f.format;
      if (f.format === '_other' && !fmt) { toast('Напиши свій формат клубу'); el.disabled = false; return; }
      const r = await api('clubPlanSave', { teamId: C.teamId, id: f.id, format: fmt || 'club', date: f.date, topic: f.topic, sermon: f.sermon, preacher: f.preacher, scripture: f.scripture, note: f.note, program: f.program, roles: f.roles });
      f.id = r.id; C.dirty = false; toast('План клубу збережено', 'success'); refreshMe(); await loadClub();
    } catch (e) { toast(e.message, 'error'); el.disabled = false; }
  };
  A.clubDone = async (d, el) => {
    const C = S.club, r = C.rep, none = !!d.none;
    if (C.dirty && !(await confirmAsk('Зміни в плані не збережено. Дати звіт без них?'))) return;
    if (!none && !Number(r.teens)) { toast('Вкажи, скільки було підлітків', 'error'); return; }
    if (none && !(await confirmAsk('Записати, що клубу не було? Тема й ігри перейдуть на наступний клуб.'))) return;
    el.disabled = true;
    try {
      const x = await api('clubPlanDone', { teamId: C.teamId, id: C.f.id, none: none, teens: r.teens, newT: r.newT, leaders: r.leaders, parents: r.parents, note: r.note });
      toast((none ? 'Записано. ' : 'Звіт збережено, клуб в архіві. ') + 'Наступний — ' + fmtDay(x.next.date), 'success');
      C.dirty = false; refreshMe(); await loadClub(); window.scrollTo(0, 0);
    } catch (e) { toast(e.message, 'error'); el.disabled = false; }
  };
  A.clubArch = (d) => { S.club.archOpen = S.club.archOpen === d.id ? null : d.id; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.clubArchAll = () => { S.club.archAll = true; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.ideaFlt = (d) => { S.club.ideaCat = d.v; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.ideaCatSet = (d) => { S.club.idea.cat = d.v; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.ideaAdd = async (d, el) => {
    const C = S.club, f = C.idea;
    if (!f.text.trim()) { toast('Напиши ідею', 'error'); return; }
    el.disabled = true;
    try { await api('clubIdeaAdd', { teamId: C.teamId, cat: f.cat, text: f.text, desc: f.cat === 'game' ? f.desc : '' }); C.idea = { cat: f.cat, text: '', desc: '' }; toast('Ідею додано в кошик', 'success'); await reloadIdeas(); }
    catch (e) { toast(e.message, 'error'); el.disabled = false; }
  };
  // оновити лише кошик, не чіпаючи незбережений план
  async function reloadIdeas() {
    const C = S.club;
    try { const x = await api('clubPage', { teamId: C.teamId }); C.data.ideas = x.ideas; } catch (e) { toast(e.message, 'error'); }
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }
  A.ideaDel = async (d) => {
    const x = S.club.data.ideas.find((i) => i.id === d.id);
    if (!x || !(await confirmAsk('Видалити ідею «' + x.text + '»?'))) return;
    try { await api('clubIdeaDel', { teamId: S.club.teamId, id: d.id }); await reloadIdeas(); } catch (e) { toast(e.message, 'error'); }
  };
  A.ideaClear = async () => {
    const C = S.club, cat = C.ideaCat && C.ideaCat !== 'all' ? C.ideaCat : '';
    const n = C.data.ideas.filter((x) => !cat || x.cat === cat).length;
    if (!(await confirmAsk('Видалити ' + plural(n, 'ідею', 'ідеї', 'ідей') + (cat ? ' з цієї категорії' : ' з кошика') + '? Повернути не вийде.'))) return;
    try { await api('clubIdeaDel', { teamId: C.teamId, all: true, cat: cat }); toast('Кошик почищено', 'success'); await reloadIdeas(); } catch (e) { toast(e.message, 'error'); }
  };
  A.ideaToPlan = (d) => {
    const C = S.club, x = C.data.ideas.find((i) => i.id === d.id), f = C.f;
    if (!x) return;
    if (x.cat === 'game' || x.cat === 'ggame' || x.cat === 'song') f.program.push({ kind: x.cat, name: x.text, desc: x.desc || '' });
    else if (x.cat === 'topic' && !f.topic) f.topic = x.text;
    else if (x.cat === 'topic' && !f.sermon) f.sermon = x.text;
    else f.note = (f.note ? f.note + '\n' : '') + x.text;
    toast('Додано в план — не забудь зберегти', 'success'); clubRe();
  };
  // ── банк ідей ──
  A.bankCat = (d) => { S.bank.cats[d.v] = S.bank.cats[d.v] === false; S.bank.pick = null; render(); };
  A.bankRandom = () => {
    const B = S.bank, L = B.data.items.filter((x) => B.cats[x.cat] !== false && x !== B.pick);
    const pool = L.length ? L : B.data.items.filter((x) => B.cats[x.cat] !== false);
    if (!pool.length) return;
    B.pick = pool[Math.floor(Math.random() * pool.length)]; haptic('light'); const y = window.scrollY; render(); window.scrollTo(0, y);
  };
  A.bankTag = (d) => { S.bank.tag = d.v; S.bank.more = 0; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.bankMore = () => { S.bank.more = (S.bank.more || 40) + 40; const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.bankQ = (d, el) => {
    clearTimeout(A.bankQ.t);
    A.bankQ.t = setTimeout(() => { const y = window.scrollY; render(); window.scrollTo(0, y); const i = document.querySelector('[data-live="bankQ"]'); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* type=search */ } } }, 250);
  };
  // перетягування пунктів програми (палець або миша) за ☰
  (function progDrag() {
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('[data-drag]');
      if (!h || S.screen !== 'club') return;
      const it = h.closest('.prog-it'), box = it.parentNode;
      e.preventDefault();
      drag = { it: it, box: box, from: Number(it.dataset.i), id: e.pointerId, y0: e.clientY };
      it.classList.add('drag'); haptic('light');
      try { h.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const items = [...drag.box.children].filter((x) => x !== drag.it);
      const after = items.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (after) { if (drag.it.nextSibling !== after) drag.box.insertBefore(drag.it, after); } else if (drag.box.lastChild !== drag.it) drag.box.appendChild(drag.it);
      [...drag.box.children].forEach((x, i) => { const n = x.querySelector('.prog-n'); if (n) n.textContent = i + 1; });
    }, { passive: false });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const to = [...drag.box.children].indexOf(drag.it), from = drag.from;
      drag.it.classList.remove('drag'); drag = null;
      if (to < 0 || to === from) return;
      const P = S.club.f.program, x = P.splice(from, 1)[0]; P.splice(to, 0, x);
      haptic('light'); clubRe();
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();
  A.bugSend = async () => {
    const B = S.bug; if (String(B.text).trim().length < 3) return toast('Опиши, що сталося');
    B.busy = true; render();
    const v = ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '';
    const info = 'v' + v + ' · ' + (IN_TG ? 'Telegram ' + (tg.platform || '') + ' ' + (tg.version || '') : 'окремий застосунок') + ' · ' + navigator.userAgent.slice(0, 200);
    const ok = await run(() => api('bugSend', { text: B.text, screen: B.from, info: info }));
    B.busy = false; if (ok) B.sent = true; render();
  };
  A.bugsTab = (d) => { S.bugsTab = d.v; render(); };
  A.bugDone = async (d) => {
    const ok = await run(() => api('bugDone', { id: d.id, undo: !!d.v }));
    if (ok) { const b = S.bugsD.list.filter((x) => x.id === d.id)[0]; if (b) b.done = !d.v; S.me.bugsOpen = S.bugsD.list.filter((x) => !x.done).length; render(); }
  };
  A.dupMerge = async (d) => {
    const x = S.dupesD.list.filter((y) => y.key === d.k)[0]; if (!x) return;
    if (!(await confirmAsk('Обʼєднати «' + x.people[0].name + '» і «' + x.people[1].name + '» в один запис?'))) return;
    const ok = await run(() => api('dupMerge', { ids: x.people.map((p) => p.id) }), 'Обʼєднано');
    if (ok) { S.dupesD.list = S.dupesD.list.filter((y) => y.key !== d.k); render(); }
  };
  A.dupSkip = async (d) => {
    const x = S.dupesD.list.filter((y) => y.key === d.k)[0]; if (!x) return;
    const ok = await run(() => api('dupSkip', { ids: x.people.map((p) => p.id) }));
    if (ok) { S.dupesD.list = S.dupesD.list.filter((y) => y.key !== d.k); render(); }
  };
  A.viewAs = (d) => {
    const vr = VIEW_ROLES || (S.me && S.me.viewRoles) || [];
    try { sessionStorage.setItem('yl:viewAs', JSON.stringify({ key: d.k })); sessionStorage.setItem('yl:viewRoles', JSON.stringify(vr)); } catch (e) { /* ок */ }
    location.reload();
  };
  A.viewPick = (d, el) => (el.value ? A.viewAs({ k: el.value }) : A.viewExit());
  A.achInfo = (d) => toast(d.t + ' — ' + d.d + ' · ' + d.p);
  A.actFind = () => {
    clearTimeout(A.actFind.t);
    A.actFind.t = setTimeout(async () => {
      const F = S.actFind = S.actFind || {}, q = (F.q || '').trim();
      if (q.length < 2) { F.list = []; } else {
        F.loading = true;
        try { const r = await api('actAsFind', { q: q }); if ((F.q || '').trim() === q) F.list = r.list; } catch (e) { toast(e.message, 'error'); }
        F.loading = false;
      }
      if (S.screen !== 'more') return;
      const y = window.scrollY; render(); window.scrollTo(0, y);
      const i = document.querySelector('[data-live="actFind"]'); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* */ } }
    }, 300);
  };
  A.actAs = (d) => { try { sessionStorage.setItem('yl:actAs', JSON.stringify({ id: d.id, name: d.n })); sessionStorage.removeItem('yl:viewAs'); } catch (e) { /* ок */ } location.reload(); };
  A.actExit = () => { try { sessionStorage.removeItem('yl:actAs'); } catch (e) { /* ок */ } location.reload(); };
  A.viewExit = () => { try { sessionStorage.removeItem('yl:viewAs'); sessionStorage.removeItem('yl:viewRoles'); } catch (e) { /* ок */ } location.reload(); };
  A.checkin = async (d, el) => {
    const w = S.me && S.me.myWeek; if (!w) return;
    const it = w.items.find((x) => x.key === d.k); if (!it || it.locked) return;
    const before = w.done;
    it.on = !!d.on; w.done = w.items.filter((x) => x.on).length;   // одразу на екрані
    try { tg.HapticFeedback && tg.HapticFeedback.impactOccurred(it.on ? 'medium' : 'light'); } catch (e) { /* ок */ }
    render();
    if (w.done === 3 && before < 3) { confetti(); toast('🔥 Повний тиждень! Дякуємо за служіння', 'success'); }
    try { const r = await api('checkin', { kind: d.k, on: !!d.on }); S.me.myWeek = r.myWeek; LS.set('me', S.me); S.myStats = null; if (S.screen === 'home') render(); }
    catch (e) { it.on = !d.on; w.done = w.items.filter((x) => x.on).length; render(); toast(e.message, 'error'); }
  };
  A.msPeriod = (d) => { S.myStatsP = d.p; S.myStats = null; render(); loadMyStats(); };
  A.goStats = (d) => go('stats', { scope: d.scope, cat: d.cat });
  A.openUrl = (d) => { if (/^https?:/.test(d.url) && tg && tg.openLink) tg.openLink(d.url); else location.href = d.url; };

  // внесення
  A.openAdd = (d) => go('add', { type: d.type, teamId: d.team });
  A.addFinTab = () => { S.addFin = true; S.addKnown = false; render(); };
  A.fxTeam = (d, el) => { S.fx.teamId = el.value; S.fx.data = null; S.fx.err = ''; render(); };
  A.fxKind = (d) => { S.fx.kind = d.v; render(); };
  A.fxAdj = () => { S.fx.adj = !S.fx.adj; S.fx.adjBal = ''; S.fx.adjNote = ''; render(); };
  A.fxAdjSave = async () => {
    const F = S.fx, v = String(F.adjBal || '').replace(/\s/g, '').replace(',', '.');
    if (v === '' || !isFinite(Number(v))) return toast('Вкажи суму, яка зараз у касі');
    const res = await run(() => api('finTxAdd', { teamId: F.teamId, kind: 'adj', balance: v, note: F.adjNote }), 'Баланс зведено');
    if (res) { F.data = res; F.adj = false; render(); }
  };
  A.fxSrc = (d) => { S.fx.src = d.v; render(); };
  A.fxAdd = async () => {
    const F = S.fx, amount = Number(String(F.amount).replace(',', '.'));
    if (!(amount > 0)) return toast('Вкажи суму');
    if (F.kind === 'out' && !String(F.note).trim()) return toast('Напиши, на що витратили');
    F.busy = true; render();
    const res = await run(() => api('finTxAdd', { teamId: F.teamId, kind: F.kind, src: F.src, amount: amount, note: F.note, date: F.date }), F.kind === 'out' ? 'Витрату записано' : 'Дохід записано');
    F.busy = false;
    if (res) { F.data = res; F.amount = ''; F.note = ''; }
    render();
  };
  A.fxDel = (d) => {
    const F = S.fx, t = F.data.items.filter((x) => x.id === d.id)[0];
    const doIt = async () => { const res = await run(() => api('finTxDelete', { teamId: F.teamId, id: d.id }), 'Запис видалено'); if (res) { F.data = res; render(); } };
    const msg = t.kind === 'adj' ? 'Скасувати звірку балансу? Баланс повернеться до попереднього.' : 'Видалити запис ' + (t.kind === 'in' ? '+' : '−') + money(t.amount) + '? Баланс каси перерахується.';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  A.addType = (d) => { S.addFin = false; S.addKnown = false; initAdd(d.type, S.add && S.add.teamId); render(); };
  A.addKnownTab = () => { S.addKnown = true; S.addFin = false; render(); };
  A.addKnownGo = (d) => { S.known.mode = 'mine'; S.known.detail = null; go('known'); if (d.m === 'bulk') A.knownBulkOpen(); else A.knownNew(); };
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
      type: a.type, teamId: a.teamId, mode: a.mode, date: a.date, teens: a.teens, newT: a.newT, leaders: a.leaders, parents: a.parents, hours: a.hours,
      topic: a.topic, note: a.note, attendees: a.mark ? Object.keys(a.att).filter((k) => a.att[k]) : [],
    };
    // одразу дякуємо й позначаємо як здане, а зберігаємо у фоні
    const backup = { add: JSON.parse(JSON.stringify(a)), week: JSON.parse(JSON.stringify(S.me.week)) };
    weekMark(a.type, a.teamId, 'ok', a.type === 'kr' ? Number(a.hours) || 0 : 0);
    if (a.type === 'club') { S.me.lastClubs = S.me.lastClubs || {}; const prev = S.me.lastClubs[a.teamId]; if (!prev || a.date >= prev.date) S.me.lastClubs[a.teamId] = { date: a.date, none: false, teens: Number(a.teens) || 0, leaders: Number(a.leaders) || 0 }; }
    go('home'); thank();
    try { const res = await api('saveReport', payload); S.me.week = res.week; if (res.myWeek) S.me.myWeek = res.myWeek; S.myStats = null; LS.set('me', S.me); if (S.screen === 'home' && !S.thanks) render(); }
    catch (e) { S.me.week = backup.week; S.add = backup.add; S.thanks = false; S.screen = 'add'; render(); toast('Не вдалося зберегти: ' + e.message, 'error'); }
  };
  A.markNone = async (d) => {
    const backup = JSON.parse(JSON.stringify(S.me.week));
    weekMark(d.type, d.team, 'none', 0);
    if (S.screen === 'add') go('home');
    thank();
    try { const res = await api('saveReport', { type: d.type, teamId: d.team, mode: 'none' }); S.me.week = res.week; if (res.myWeek) S.me.myWeek = res.myWeek; S.myStats = null; LS.set('me', S.me); if (S.screen === 'home' && !S.thanks) render(); }
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
  A.evAll = () => { S.evAll = !S.evAll; render(); };
  const ownerKeyOf = (u) => (!u ? '' : u.level === 'nat' ? 'nat' : { region: 'r:', area: 'a:', team: 't:' }[u.level] + u.unitId);
  function resetEvPick(keys) {
    const f = S.evForm, u = evUnits(f)[Number(f.unit) || 0], by = scopeBy();
    const ks = (keys && keys.length ? keys : [ownerKeyOf(u)]).filter((k) => by[k]);
    makePick('event', ks, ks.length > 1);
  }
  A.evNew = () => { S.evForm = { unit: 0, title: '', date: ymd(new Date(Date.now() + 7 * 864e5)), end: '', time: '', place: '', desc: '', roles: [] }; resetEvPick(); render(); };
  A.evOwner = () => { resetEvPick(); render(); };
  A.evDate = () => { const f = S.evForm; if (f.end && f.end < f.date) f.end = ''; const e = document.querySelector('[data-bind="evForm.end"]'); if (e) { e.min = f.date; e.value = f.end; } };
  A.evSave = async () => {
    const f = S.evForm, u = evUnits(f)[Number(f.unit) || 0];
    if (!u) return;
    if (String(f.title).trim().length < 2) return toast('Вкажи назву події');
    if (f.end && f.end < f.date) return toast('Дата кінця раніше за дату початку');
    if (f.rep && f.until && f.until < f.date) return toast('«Повторювати до» раніше за дату початку');
    const res = await run(() => api('eventSave', { id: f.id || '', roles: f.roles || [], aud: (S.pick.event && S.pick.event.keys) || [], level: u.level, unitId: u.unitId, title: f.title, date: f.date, end: f.end || '', time: f.time, place: f.place, desc: f.desc, rep: f.rep || '', until: f.rep ? f.until || '' : '' }), f.id ? 'Зміни збережено' : 'Подію додано: ' + u.label);
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
      (e.rep ? '&recur=' + encodeURIComponent('RRULE:FREQ=' + (e.rep === 'month' ? 'MONTHLY' : 'WEEKLY') + (e.rep === '2week' ? ';INTERVAL=2' : '') + (e.until ? ';UNTIL=' + e.until.replace(/-/g, '') : '')) : '') +
      '&location=' + encodeURIComponent(e.place || '') + '&details=' + encodeURIComponent((e.desc || '') + '\n\nYoung Life Україна · ' + e.levelLabel);
    A.openUrl({ url: url });
  };
  const audChanged = (scr) => { if (scr === 'broadcast') loadBcCount(); else if (scr === 'task' || scr === 'poll') loadAudCount(scr); else render(); };
  A.audGroup = (d) => { const f = audState(d.s); f.roles = audRoles(d.g); f.audOpen = false; audChanged(d.s); };
  A.audCustom = (d) => { audState(d.s).audOpen = true; render(); };
  A.audRole = (d) => { const f = audState(d.s); const r = f.roles = (f.roles || []).slice(); const i = r.indexOf(d.k); if (i >= 0) r.splice(i, 1); else r.push(d.k); audChanged(d.s); };
  A.evEdit = (d) => {
    const e = (S.events || []).filter((x) => x.id === d.id)[0]; if (!e) return;
    const f = { id: e.seriesId || e.id, rep: e.rep || '', until: e.until || '', title: e.title, date: e.start0 || e.date, end: (e.seriesId ? e.end0 : e.end) || '', time: e.time || '', place: e.place || '', desc: e.desc || '', roles: (e.roles || []).filter((k) => roleDef(k).label), audOpen: false };
    let units = caps().eventUnits || [];
    let idx = units.findIndex((x) => x.level === e.level && x.unitId === e.unitId);
    if (idx < 0) { f.extraUnit = { level: e.level, unitId: e.unitId, label: e.levelLabel }; idx = units.length; }
    f.unit = idx; S.evForm = f; resetEvPick(e.aud || []); render(); window.scrollTo(0, 0);
  };
  A.evRep = () => render();
  A.evDelete = (d) => {
    const only = d.only === '1';
    const doIt = async () => { const res = await run(() => api('eventDelete', { id: d.id, only: only }), only ? 'Цю дату скасовано' : 'Подію видалено'); if (res) { S.ev = null; S.events = null; render(); loadEvents(); } };
    const msg = only ? 'Скасувати подію лише на ' + fmtShortDay(d.id.split('@')[1]) + '? Інші дати залишаться.' : d.series === '1' ? 'Видалити всю серію повторів? Зникнуть усі дати й записи «Йду».' : 'Видалити подію?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };

  // встановили MyYL
  A.instGo = (d) => { setPick('inst', d.k); S.inst.data = null; render(); loadInst(); window.scrollTo(0, 0); };
  A.instNot = () => { S.inst.showNot = !S.inst.showNot; render(); };
  A.instFind = () => { const y = window.scrollY; render(); const el = document.querySelector('[data-bind="inst.q"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } window.scrollTo(0, y); };
  // ресурси
  const resById = (id) => S.res.data.list.filter((x) => x.id === id)[0];
  A.resOpen = (d) => { const x = resById(d.id); const u = x.hasFile ? resFileUrl(x) : x.url; if (tg && tg.openLink) tg.openLink(u); else window.open(u, '_blank', 'noopener'); };
  A.resNew = () => { S.res.form = { title: '', url: '', note: '', aud: 'all', file: null }; render(); window.scrollTo(0, 0); };
  A.resAud = (d) => { const f = S.res.form, D = S.res.data; f.aud = d.v === 'all' ? 'all' : d.v === 'r' ? 'r:' + ((D.regions[0] || {}).id || '') : 'dir:' + (D.dirs[0] || ''); render(); };
  A.resAudSel = (d, el) => { S.res.form.aud = el.value; };
  A.resFileDrop = () => { S.res.form.file = null; render(); };
  A.resFile = async (d, el) => {
    const file = el.files && el.files[0], f = S.res.form;
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { el.value = ''; return toast('Файл більший за 20 МБ — додай його посиланням (Google Диск)'); }
    f.uploading = true; render();
    try {
      const fd = new FormData();
      if (IN_TG) fd.append('initData', tg.initData); else fd.append('session', SESSION && SESSION.token);
      fd.append('file', file, file.name);
      const j = await (await fetch(API_BASE() + '/upload', { method: 'POST', body: fd })).json();
      if (!j.ok) throw new Error(j.message || 'Не вдалося завантажити');
      f.file = j.data; if (!String(f.title).trim()) f.title = file.name.replace(/\.[^.]+$/, '');
      toast('Файл завантажено', 'success');
    } catch (e) { toast(e.message || 'Не вдалося завантажити'); }
    f.uploading = false; render();
  };
  A.resSave = async () => {
    const f = S.res.form;
    if (String(f.title).trim().length < 2) return toast('Напиши назву');
    if (!String(f.url).trim() && !f.file) return toast('Додай посилання або файл');
    const res = await run(() => api('resSave', { title: f.title, url: f.url, note: f.note, aud: f.aud, file: f.file }));
    if (res) { toast(res.pending ? 'Надіслано на підтвердження' : 'Ресурс додано', 'success'); S.res.form = null; S.res.data = null; render(); loadRes(); }
  };
  A.resDecide = async (d) => { const res = await run(() => api('resDecide', { id: d.id, approve: d.ok === '1' }), d.ok === '1' ? 'Опубліковано' : 'Відхилено'); if (res) loadRes(); };
  A.resDel = (d) => {
    const x = resById(d.id);
    const doIt = async () => { const res = await run(() => api('resDelete', { id: d.id }), 'Ресурс видалено'); if (res) loadRes(); };
    const msg = 'Видалити ресурс «' + x.title + '»?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  // дозволи
  A.permUnit = (d) => { S.perms.unit = d.k; S.perms.data = null; render(); loadPerms(); };
  A.permRole = (d) => { S.perms.role = d.k; render(); };
  A.permToggle = async (d, el) => {
    const P = S.perms;
    P.busy = true;
    const res = await run(() => api('permSet', { unit: P.unit, role: P.role, perm: d.k, on: el.checked }), el.checked ? 'Дозволено' : 'Заборонено');
    P.busy = false;
    if (res) P.data = res; else el.checked = !el.checked;
    render();
  };
  A.permReset = () => {
    const P = S.perms, role = (P.data.roles.filter((r) => r.key === P.role)[0] || {}).label;
    const doIt = async () => { const res = await run(() => api('permReset', { unit: P.unit, role: P.role }), 'Повернуто типові'); if (res) { P.data = res; render(); } };
    const msg = 'Скинути всі зміни для «' + role + '» у межах ' + P.data.unitLabel + '?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  // задачі
  const curTask = () => ((S.tasks.data && S.tasks.data.list) || []).filter((x) => x.id === S.tasks.open)[0];
  const putTask = (t) => { const L = S.tasks.data.list; const i = L.findIndex((x) => x.id === t.id); if (i >= 0) L[i] = t; refreshTodo(); };
  A.taskTab = (d) => { S.tasks.tab = d.v; render(); };
  A.taskOpen = (d) => { S.tasks.open = d.id; const t = curTask(); S.tasks.note = t && t.mine ? t.mine.note : ''; render(); window.scrollTo(0, 0); };
  A.taskNew = () => {
    const others = !!(S.tasks.data && S.tasks.data.canCreate);
    S.tasks.form = { title: '', desc: '', due: '', roles: [], count: null, self: !others };
    if (others) { ensurePick('task'); loadAudCount('task'); }
    render();
  };
  A.taskSelf = (d) => { S.tasks.form.self = d.v === '1'; if (!S.tasks.form.self) { ensurePick('task'); loadAudCount('task'); } render(); };
  A.taskSave = async () => {
    const f = S.tasks.form;
    if (String(f.title).trim().length < 2) return toast('Напиши, що треба зробити');
    const self = f.self || !(S.tasks.data && S.tasks.data.canCreate);
    const res = await run(() => api('taskSave', self ? { self: true, title: f.title, desc: f.desc, due: f.due } : { title: f.title, desc: f.desc, due: f.due, units: (S.pick.task || { keys: [] }).keys, roles: f.roles || [] }));
    if (res) { toast(self ? 'Задачу додано собі' : 'Доручено: ' + plural(res.count, 'людині', 'людям', 'людям'), 'success'); S.tasks.form = null; S.tasks.tab = self ? 'mine' : 'from'; S.tasks.data = null; render(); loadTasks(); }
  };
  A.taskSt = async (d) => {
    const t = curTask(); if (!t) return;
    const res = await run(() => api('taskStatus', { id: t.id, status: d.v || t.mine.status, note: S.tasks.note }), d.v === 'done' ? 'Виконано — дякуємо!' : 'Збережено');
    if (res) { putTask(res); render(); }
  };
  A.taskNudge = async () => { const t = curTask(); const res = await run(() => api('taskNudge', { id: t.id })); if (res) toast(res.sent ? 'Нагадали: ' + plural(res.sent, 'людині', 'людям', 'людям') : 'Нікому нагадувати', 'success'); };
  A.taskClose = async () => { const t = curTask(); const res = await run(() => api('taskClose', { id: t.id, reopen: !!t.closed }), t.closed ? 'Задачу відкрито' : 'Задачу завершено'); if (res) { putTask(res); render(); } };
  A.taskDelete = () => {
    const t = curTask();
    const doIt = async () => { const res = await run(() => api('taskDelete', { id: t.id }), 'Задачу видалено'); if (res) { S.tasks.open = null; S.tasks.data = null; render(); loadTasks(); } };
    const msg = 'Видалити задачу «' + t.title + '»? Зникнуть і всі нотатки виконавців.';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  // опитування
  const putPoll = (p) => { const L = S.polls.data.list; const i = L.findIndex((x) => x.id === p.id); if (i >= 0) L[i] = p; refreshTodo(); };
  const pollById = (id) => S.polls.data.list.filter((x) => x.id === id)[0];
  A.pollTab = (d) => { S.polls.tab = d.v; render(); };
  A.pollNot = (d) => { S.polls.showNot[d.id] = !S.polls.showNot[d.id]; render(); };
  A.pollPick = (d, el) => {
    const p = pollById(d.id), i = Number(d.i);
    let sel = (S.polls.sel[d.id] || p.mine).slice();
    if (!p.multi) sel = [i]; else if (el.checked) { if (sel.indexOf(i) < 0) sel.push(i); } else sel = sel.filter((x) => x !== i);
    S.polls.sel[d.id] = sel;
  };
  A.pollVote = async (d) => {
    const sel = S.polls.sel[d.id] || pollById(d.id).mine;
    if (!sel.length) return toast('Обери варіант');
    const res = await run(() => api('pollVote', { id: d.id, opts: sel }), 'Голос враховано');
    if (res) { delete S.polls.sel[d.id]; putPoll(res); render(); }
  };
  A.pollNew = () => { S.polls.form = { question: '', options: ['', ''], multi: false, open: false, roles: [], count: null }; ensurePick('poll'); render(); loadAudCount('poll'); };
  A.pollOptAdd = () => { S.polls.form.options.push(''); render(); const ins = document.querySelectorAll('[data-bind^="polls.form.options."]'); if (ins.length) ins[ins.length - 1].focus(); };
  A.pollOptDel = (d) => { S.polls.form.options.splice(Number(d.i), 1); render(); };
  A.pollSave = async () => {
    const f = S.polls.form, opts = f.options.map((x) => String(x).trim()).filter(Boolean);
    if (String(f.question).trim().length < 2) return toast('Напиши питання');
    if (opts.length < 2) return toast('Додай щонайменше два варіанти');
    const res = await run(() => api('pollSave', { question: f.question, options: opts, multi: !!f.multi, open: !!f.open, units: (S.pick.poll || { keys: [] }).keys, roles: f.roles || [] }));
    if (res) { toast('Надіслано: ' + plural(res.count, 'людині', 'людям', 'людям'), 'success'); S.polls.form = null; S.polls.tab = 'open'; S.polls.data = null; render(); loadPolls(); }
  };
  A.pollClose = async (d) => { const p = pollById(d.id); const res = await run(() => api('pollClose', { id: p.id, reopen: !!p.closed }), p.closed ? 'Опитування відкрито' : 'Опитування завершено'); if (res) { putPoll(res); render(); } };
  A.pollDelete = (d) => {
    const p = pollById(d.id);
    const doIt = async () => { const res = await run(() => api('pollDelete', { id: p.id }), 'Опитування видалено'); if (res) { S.polls.data.list = S.polls.data.list.filter((x) => x.id !== p.id); refreshTodo(); render(); } };
    const msg = 'Видалити опитування «' + p.question + '» разом з усіма голосами?';
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };

  // статистика
  A.statsScope = (d, el) => { S.stats.scope = el.value; loadStats(); };
  A.statsCat = (d) => { S.stats.cat = d.c; loadStats(); };
  A.statsReload = () => { S.statsMem = {}; loadStats(); };
  A.statsPeriod = (d) => {
    const o = d.s === 'dirs' ? S.dirs : S.stats;
    o.period = d.p;
    if (d.p === 'custom') {
      // свій період: за замовчуванням — з 1 вересня (навчальний рік) до сьогодні
      const t = new Date(); if (!o.to) o.to = ymd(t);
      if (!o.from) o.from = (t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1) + '-09-01';
    }
    if (d.s === 'dirs') loadDirs(); else loadStats();
  };
  A.periodApply = (d) => {
    const o = d.s === 'dirs' ? S.dirs : S.stats;
    if (!o.from || !o.to) return toast('Вкажи обидві дати');
    if (o.from > o.to) { const x = o.from; o.from = o.to; o.to = x; }
    if (d.s === 'dirs') loadDirs(); else loadStats();
  };
  A.statsDrill = (d) => { setPick('stats', d.k); S.stats.find = false; S.stats.showAll = false; S.stats.showMiss = false; loadStats(); window.scrollTo(0, 0); };
  A.statsFindToggle = () => { S.stats.find = !S.stats.find; render(); const i = document.getElementById('statsFindIn'); if (i) i.focus(); };
  A.statsFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('#statsFindList [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0)); };
  A.statsRowFind = (d, el) => {
    const q = el.value.trim().toLowerCase();
    if (q && !S.stats.showAll) { S.stats.showAll = true; render(); const i = document.querySelector('[data-live="statsRowFind"]'); if (i) { i.value = el.value; i.focus(); } }
    document.querySelectorAll('#brkList [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0));
  };
  A.statsSort = (d) => { S.stats.sort = d.s; render(); };
  A.clubEditOpen = (d) => { const r = ((S.stats.data && S.stats.data.club) || { history: [] }).history.filter((x) => x.id === d.id)[0]; if (!r) return; S.stats.clubEdit = Object.assign({}, r); render(); };
  A.clubEditCancel = () => { S.stats.clubEdit = null; render(); };
  A.clubPickOpen = () => { const on = {}; (caps().report.club || []).forEach((id) => { on[id] = true; }); S.clubPick = { on: on }; S.clubPickOpen = true; render(); };
  A.clubPickClose = () => { S.clubPickOpen = false; render(); };
  A.clubPickAll = (d, el) => { (caps().clubAll || []).forEach((id) => { S.clubPick.on[id] = el.checked; }); render(); };
  A.clubPickT = (d, el) => { S.clubPick.on[d.id] = el.checked; render(); };
  A.clubPickSave = async () => {
    const all = caps().clubAll || [], on = all.filter((id) => S.clubPick.on[id]);
    const res = await run(() => api('clubPick', on.length === all.length ? { all: true } : { teams: on }), 'Збережено');
    if (res) { caps().report.club = res.club; S.clubPickOpen = false; if (S.add && S.add.type === 'club' && !res.club.length) S.add = null; render(); }
  };
  A.recentMore = () => { S.stats.recentAll = !S.stats.recentAll; render(); };
  A.histAll = () => { S.stats.histAll = !S.stats.histAll; render(); };
  A.clubDelete = async (d) => {
    const r = ((S.stats.data && S.stats.data.club) || { history: [] }).history.filter((x) => x.id === d.id)[0]; if (!r) return;
    if (!(await confirmAsk('Видалити звіт за клуб від ' + fmtDay(r.date) + '? Його не можна буде повернути.'))) return;
    const ok = await run(() => api('clubDelete', { id: d.id }), 'Звіт видалено');
    if (ok) { S.stats.clubEdit = null; loadStats(); }
  };
  A.clubEditNone = (d, el) => { S.stats.clubEdit.none = el.checked; render(); };
  A.clubEditSave = async () => {
    const E = S.stats.clubEdit;
    const ok = await run(() => api('clubEdit', { id: E.id, date: E.date, none: !!E.none, teens: E.teens, newT: E.newT, leaders: E.leaders, parents: E.parents, note: E.note }), 'Звіт оновлено');
    if (ok) { S.stats.clubEdit = null; loadStats(); }
  };
  A.statsShowAll = () => { S.stats.showAll = !S.stats.showAll; render(); };
  A.statsShowMiss = () => { S.stats.showMiss = !S.stats.showMiss; render(); };

  // структура
  A.structToggle = (d) => { S.structOpen[d.id] = !S.structOpen[d.id]; render(); };
  A.structFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('[data-q]').forEach((x) => { if (x.closest('#app')) x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0); }); };
  A.structNewArea = (d) => { S.structEdit = { kind: 'area', parentId: d.id, parentName: d.name, name: '' }; render(); window.scrollTo(0, 0); };
  A.structEditArea = (d) => { S.structEdit = { kind: 'area', id: d.id, name: d.name }; render(); window.scrollTo(0, 0); };
  A.structDir = (d) => { S.structEdit.dir = d.v; render(); };
  A.structNewTeam = (d) => { S.structEdit = { kind: 'team', parentId: d.id, parentName: d.name, name: '', dir: 'YoungLife' }; S.structOpen[d.id] = true; render(); window.scrollTo(0, 0); };
  A.structEditTeam = (d) => { S.structEdit = { kind: 'team', id: d.id, name: d.name, dir: d.dir || '' }; render(); window.scrollTo(0, 0); };
  A.structDel = async (d) => {
    S.structEdit = null; S.structDelS = { id: d.id, name: d.name, info: null, into: '' }; render(); window.scrollTo(0, 0);
    const r = await run(() => api('teamDelete', { id: d.id, dry: true }));
    if (!r) { S.structDelS = null; return render(); }
    if (S.structDelS && S.structDelS.id === d.id) { S.structDelS.info = r; render(); }
  };
  A.structDelCancel = () => { S.structDelS = null; render(); };
  A.structDelMode = (d) => { S.structDelS.mode = d.m; render(); };
  A.structDelGo = () => {
    const x = S.structDelS; if (!x || !x.info) return;
    const drop = !x.info.empty && (x.mode === 'drop' || !x.info.targets.length);
    if (!x.info.empty && !drop && !x.into) return toast('Обери, куди перенести дані', 'error');
    const target = x.into ? (x.info.targets.filter((t) => t.id === x.into)[0] || {}).name : '';
    const msg = x.info.empty ? 'Видалити команду «' + x.name + '»?' : drop ? 'Видалити «' + x.name + '» разом з усіма даними? Ролі людей знімуться. Цю дію не можна скасувати.' : 'Перенести все з «' + x.name + '» у «' + target + '» і видалити «' + x.name + '»? Цю дію не можна скасувати.';
    const doIt = async () => {
      const r = await run(() => api('teamDelete', { id: x.id, mergeInto: drop ? '' : x.into || '', drop: drop }), x.info.empty || drop ? 'Команду видалено' : 'Перенесено й видалено');
      if (r) { S.structDelS = null; S.me = await api('me').catch(() => S.me); loadTree(); }
    };
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
  A.structCancel = () => { S.structEdit = null; render(); };
  A.structSave = async () => {
    const e = S.structEdit;
    if (String(e.name || '').trim().length < 2) return toast('Вкажи назву');
    const res = await run(() => e.kind === 'area'
      ? api('areaSave', { id: e.id || '', regionId: e.parentId, name: e.name })
      : api('teamSave', e.id ? { id: e.id, name: e.name, dir: e.dir || '' } : { areaId: e.parentId, name: e.name, dir: e.dir || 'YoungLife' }), 'Збережено');
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
  A.pkLevel = (d) => {
    const P = S.pick[d.s]; if (!P) return;
    const T = pkTree(d.s);
    const t = levelTarget(T.units, P.keys[0], d.l); if (!t) return;
    if (T.by[t].parent === P.keys[0] && P.keys.length === 1) { P.ctx = P.keys[0]; render(); return; } // на рівень нижче: показуємо дітей, вибір той самий («Усі»)
    P.keys = [t]; P.multi = false; P.ctx = T.by[T.by[t].parent] ? T.by[t].parent : '';
    onPick(d.s);
  };
  A.pkUnit = (d) => {
    const P = S.pick[d.s]; if (!P) return;
    const T = pkTree(d.s);
    if (P.multi) {
      let ks = P.keys.filter((k) => k !== P.ctx);
      const i = ks.indexOf(d.k);
      if (i >= 0) ks.splice(i, 1); else ks.push(d.k);
      P.keys = ks.length ? ks : [P.ctx || d.k];
    } else {
      if (P.keys.length === 1 && P.keys[0] === d.k && T.by[d.k].level === 'team') return;
      P.keys = [d.k]; P.ctx = ctxFor(T, d.k);   // вибрав регіон — далі його ерії; ерію — її команди
    }
    onPick(d.s);
  };
  A.pkAll = (d) => { const P = S.pick[d.s]; if (!P || !P.ctx) return; P.keys = [P.ctx]; P.multi = false; onPick(d.s); };
  A.pkMulti = (d) => { const P = S.pick[d.s]; if (!P) return; P.multi = !P.multi; if (!P.multi && P.keys.length > 1) { P.keys = [P.ctx || P.keys[0]]; onPick(d.s); } else render(); };
  A.pkFind = (d, el) => { const q = el.value.trim().toLowerCase(); document.querySelectorAll('#pk-' + d.s + ' [data-q]').forEach((x) => x.classList.toggle('hidden', !!q && x.dataset.q.indexOf(q) < 0)); };

  // склад
  const homeOk = () => !!(tg && tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0'));
  const viaLink = () => { try { tg.openTelegramLink(HOME_LINK); } catch (e) { try { tg.openLink(HOME_LINK); } catch (e2) { location.href = HOME_LINK; } } };
  A.installHome = () => {
    if (S.homeSt === 'added') return toast('Іконка вже є на головному екрані');
    if (!IN_TG) return viaLink();
    if (!homeOk()) {
      const msg = 'Твоя версія Telegram ще не вміє додавати застосунки на головний екран. Онови Telegram в App Store / Google Play і спробуй знову.';
      return tg.showAlert ? tg.showAlert(msg) : toast(msg);
    }
    if (!IS_MAIN || S.homeSt === 'unsupported') return viaLink();
    S.homeWait = Date.now();
    try { tg.addToHomeScreen(); } catch (e) { viaLink(); }
  };
  A.copyHome = async () => { try { await navigator.clipboard.writeText(HOME_LINK); toast('Посилання скопійовано', 'success'); } catch (e) { toast(HOME_LINK); } };
  A.hideInstall = () => { LS.set('hideInstall', 1); render(); toast('Сховано. Знайдеш у «Ще» → «Додати на головний екран»'); };
  A.openApp = () => { try { tg.openLink(APP_LINK, { try_browser: IS_IOS ? 'safari' : 'chrome' }); } catch (e) { tg.openLink(APP_LINK); } };
  A.copyApp = async () => { try { await navigator.clipboard.writeText(APP_LINK); toast('Посилання скопійовано', 'success'); } catch (e) { toast(APP_LINK); } };
  A.pwaInstall = async () => { const ev = S.installEvt; if (!ev) return; ev.prompt(); try { await ev.userChoice; } catch (e) { /* ок */ } S.installEvt = null; render(); };
  A.logout = () => { if (confirm('Вийти з MyYL на цьому пристрої?')) logout(false); };
  A.loginStart = () => loginStart();
  A.loginCancel = () => { S.login = null; clearTimeout(S.loginTimer); renderLogin(); };
  A.knownExport = async () => {
    const browse = S.known.mode === 'browse', P = S.pick.known;
    if (browse && (!P || !P.keys.length)) return toast('Обери, чий список', 'error');
    S.known.exporting = true; render();
    const res = await run(() => api('knownExport', browse ? { units: P.keys } : { mine: true }));
    S.known.exporting = false; render();
    if (res) toast('Список (' + res.count + ') надіслано файлом у чат з ботом', 'success');
  };
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
  A.roleRename = (d) => {
    const r = [].concat.apply([], S.team.list.map((p) => p.all || [])).filter((x) => x.id === d.id)[0];
    S.team.rename = { id: d.id, title: r ? r.title : '' }; render();
    const el = document.getElementById('renameIn'); if (el) el.focus();
  };
  A.roleRenameCancel = () => { S.team.rename = null; render(); };
  A.roleRenameSave = async () => {
    const t = S.team.rename;
    if (!String(t.title || '').trim()) return toast('Напиши назву ролі');
    const res = await run(() => api('roleTitle', { roleId: t.id, title: t.title }), 'Назву змінено');
    if (res) { S.team.rename = null; loadTeam(); }
  };
  A.memberNew = () => {
    const P = S.pick.team, list = caps().addTeams || [];
    const curT = P && P.keys.length === 1 && P.keys[0].indexOf('t:') === 0 ? P.keys[0].slice(2) : '';
    S.team.add = { teamId: list.some((x) => x.id === curT) ? curT : (list[0] || {}).id, names: '', role: '' };
    render(); window.scrollTo(0, 0);
  };
  A.memTeam = (d, el) => { S.team.add.teamId = el.value; render(); };
  A.memberSave = async () => {
    const a = S.team.add;
    if (!String(a.names).trim()) return toast('Впиши хоча б одне імʼя');
    a.busy = true; render();
    const res = await run(() => api('memberAdd', { teamId: a.teamId, role: a.role, names: a.names }));
    a.busy = false;
    if (!res) return render();
    const parts = [res.added ? 'додано ' + res.added : '', res.linked ? res.linked + ' вже в MyYL — роль додано їм' : '', res.dup ? res.dup + ' вже були в складі' : ''].filter(Boolean);
    toast(parts.join(', ') || 'Нікого не додано', 'success');
    S.team.add = null; S.team.list = null; render(); loadTeam();
  };
  A.memberRemove = (d) => {
    const msg = 'Видалити ' + d.name + ' зі складу «' + d.team + '»?\n\n' + (d.reg ? 'Ролі в цій команді буде знято. Сам акаунт MyYL лишиться.' : 'Людина ще не в MyYL — якщо вона більше ніде не числиться, запис буде видалено повністю.');
    const doIt = async () => { const res = await run(() => api('memberRemove', { roleIds: d.ids.split(',') }), 'Видалено зі складу'); if (res) { S.team.open = null; S.myyl.open = null; if (S.screen === 'myyl') loadMyyl(); else loadTeam(); } };
    if (tg && tg.showConfirm) tg.showConfirm(msg, (ok) => { if (ok) doIt(); }); else if (confirm(msg)) doIt();
  };
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
  A.reqTab = (d) => { S.reqOthers = d.v === '1'; render(); window.scrollTo(0, 0); };
  A.reqToggle = (d, el) => { S.reqSel[d.id] = el.checked; };
  A.reqEdit = (d) => {
    if (S.reqEdit && S.reqEdit.id === d.id) { S.reqEdit = null; return render(); }
    const r = (S.reqs || []).flatMap((p) => p.roles).find((x) => x.id === d.id); if (!r) return;
    const st = struct();
    const team = r.level === 'team' ? st.teams.find((t) => t.id === r.unitId) : null;
    const areaId = r.level === 'area' ? r.unitId : team ? team.areaId : '';
    const area = st.areas.find((a) => a.id === areaId);
    S.reqEdit = { id: r.id, key: r.key, regionId: r.level === 'region' ? r.unitId : area ? area.regionId : '', areaId: areaId, teamId: team ? team.id : '' };
    render();
  };
  A.reqEditCancel = () => { S.reqEdit = null; render(); };
  // ── додати роль людині ──
  const unitOf = (level, unitId) => {
    const st = struct();
    const team = level === 'team' ? st.teams.find((t) => t.id === unitId) : null;
    const areaId = level === 'area' ? unitId : team ? team.areaId : '';
    const area = st.areas.find((a) => a.id === areaId);
    return { regionId: level === 'region' ? unitId : area ? area.regionId : '', areaId: areaId, teamId: team ? team.id : '' };
  };
  const grantBtn = (tgId, name, level, unitId) => ((me().editRoles || []).length ? `<button type="button" class="btn ghost sm" style="margin-top:8px;width:100%" data-a="grantOpen" data-id="${esc(tgId)}" data-name="${esc(name)}" data-l="${esc(level || '')}" data-u="${esc(unitId || '')}">＋ Додати роль</button>` : '');
  const grantForm = (tgId) => (S.grant && S.grant.tgId === tgId ? roleUnitForm(S.grant, 'grant', 'Додати роль', 'Роль одразу стане активною — людина отримає сповіщення.') : '');
  A.grantOpen = (d) => {
    if (S.grant && S.grant.tgId === d.id) { S.grant = null; return render(); }
    const roles = me().editRoles || [];
    const key = (roles.find((r) => r.level === (d.l || 'team') && r.key === 'LEADER') || roles.find((r) => r.level === (d.l || 'team')) || roles[0] || {}).key;
    S.grant = Object.assign({ tgId: d.id, name: d.name, key: key }, unitOf(d.l, d.u));
    render();
  };
  A.grantCancel = () => { S.grant = null; render(); };
  A.grantKey = (d, el) => { S.grant.key = el.value; render(); };
  A.grantRegion = (d, el) => { Object.assign(S.grant, { regionId: el.value, areaId: '', teamId: '' }); render(); };
  A.grantArea = (d, el) => { Object.assign(S.grant, { areaId: el.value, teamId: '' }); render(); };
  A.grantTeam = (d, el) => { S.grant.teamId = el.value; render(); };
  A.grantSave = async () => {
    const E = S.grant, def = (me().editRoles || []).find((x) => x.key === E.key) || {};
    const unit = def.level === 'nat' ? 'nat' : def.level === 'region' ? (E.regionId && 'r:' + E.regionId) : def.level === 'area' ? (E.areaId && 'a:' + E.areaId) : (E.teamId && 't:' + E.teamId);
    if (!unit) return toast('Обери, де саме', 'error');
    const res = await run(() => api('roleGrant', { tgId: E.tgId, key: E.key, unit: unit }), 'Роль додано');
    if (res) { S.grant = null; if (S.screen === 'myyl') loadMyyl(); else if (S.screen === 'team') loadTeam(); else render(); }
  };
  A.reqEditKey = (d, el) => { S.reqEdit.key = el.value; render(); };
  A.reqEditRegion = (d, el) => { Object.assign(S.reqEdit, { regionId: el.value, areaId: '', teamId: '' }); render(); };
  A.reqEditArea = (d, el) => { Object.assign(S.reqEdit, { areaId: el.value, teamId: '' }); render(); };
  A.reqEditTeam = (d, el) => { S.reqEdit.teamId = el.value; render(); };
  A.reqEditSave = async () => {
    const E = S.reqEdit, def = (me().editRoles || []).find((x) => x.key === E.key) || {};
    const unit = def.level === 'nat' ? 'nat' : def.level === 'region' ? (E.regionId && 'r:' + E.regionId) : def.level === 'area' ? (E.areaId && 'a:' + E.areaId) : (E.teamId && 't:' + E.teamId);
    if (!unit) return toast('Обери, де саме служитиме людина', 'error');
    const res = await run(() => api('roleEdit', { roleId: E.id, key: E.key, unit: unit }), 'Заявку виправлено');
    if (res) { S.reqEdit = null; loadReqs(); }
  };
  A.reqDecide = async (d) => {
    const p = S.reqs.filter((x) => x.tgId === d.tg)[0];
    if (!p) return;
    const approve = d.ok === '1';
    const ids = approve ? p.roles.filter((r) => S.reqSel[r.id]).map((r) => r.id) : p.roles.map((r) => r.id);
    if (!ids.length) return toast('Обери хоча б одну роль');
    const titles = {};
    ids.forEach((id) => { if (S.reqTitle[id] != null) titles[id] = S.reqTitle[id]; });
    const res = await run(() => api('decide', { roleIds: ids, approve: approve, titles: titles }), approve ? p.name + ': доступ відкрито' : 'Заявку відхилено');
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
  A.mainRole = async (d, el) => {
    const res = await run(() => api('saveProfile', { main: el.value }), 'Основну роль збережено');
    if (res) { S.me.profile = res; LS.set('me', S.me); }
  };
  A.profileSave = async () => { const res = await run(() => api('saveProfile', Object.assign({}, S.profile, { notif: undefined })), 'Анкету збережено'); if (res) { S.me.profile = res; S.me.user.name = res.name || S.me.user.name; S.me.user.title = res.title || ''; render(); } };
  A.roleReqOpen = () => {
    const t = (S.me.myTeams || [])[0];
    S.roleReq = { titles: {}, regionId: t ? t.regionId : '', areaId: t ? t.areaId : '', teamId: t ? t.id : '', newTeam: '', roles: {}, upper: false, email: (S.me.profile || {}).email || '' };
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
    A[pre + 'OffT'] = (d) => { const o = obj(); o.offSel = o.offSel || {}; o.offSel[d.t] = !o.offSel[d.t]; render(); };
    A[pre + 'Office'] = (d, el) => { const o = obj(); o.office = el.checked; o.roles.OFFICE = el.checked; render(); };
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
    if (r.step === 1 && String(r.name).trim().split(/\s+/).filter((x) => x.length >= 2).length < 2) return toast('Впиши імʼя та прізвище — два слова');
    if (r.step === 2) {
      if (!r.regionId && !r.office) return toast('Обери регіон або відміть «Я працюю в національному офісі»');
      if (r.regionId && !r.areaId && struct().areas.some((a) => a.regionId === r.regionId)) return toast('Обери ерію');
      if (r.teamId === '__new' && String(r.newTeam).trim().length < 2) return toast('Впиши назву нової команди');
    }
    r.step++; render(); window.scrollTo(0, 0);
    if (r.step === 3) {
      r.claims = []; r.claim = '';
      if (r.teamId && r.teamId !== '__new') api('claimFind', { teamId: r.teamId, name: r.name }).then((list) => { r.claims = list || []; if (S.reg === r && r.step === 3) render(); }).catch(() => {});
    }
  };
  A.regClaim = (d) => { S.reg.claim = d.id || ''; render(); };
  A.regSubmit = async () => {
    const r = S.reg, p = rolePayload(r);
    if (!p.roles.length && !r.claim) return toast('Обери хоча б одну роль або себе в списку команди');
    if (r.claim) p.claim = r.claim;
    const teamRole = p.roles.some((k) => roleDef(k).level === 'team');
    if (teamRole && !r.teamId) { r.step = 2; render(); return toast('Обери команду'); }
    if (p.roles.some((k) => roleDef(k).level === 'area') && !r.areaId) { r.step = 2; render(); return toast('Обери ерію'); }
    if (p.roles.indexOf('OFFICE') >= 0 && !p.titles.OFFICE) return toast('Обери свою посаду в національному офісі');
    if (p.roles.some((k) => roleDef(k).titled && !String(p.titles[k] || '').trim())) return toast('Напиши, як називається твоя роль в офісі');
    const res = await run(() => api('register', p));
    if (res) { S.me = await api('me'); S.screen = S.me.status === 'active' ? 'home' : 'pending'; haptic('success'); render(); }
  };

  // ───────────── ПОДІЇ DOM ─────────────
  // ═════════════ РОБОЧИЙ ПРОСТІР КОМАНДИ ═════════════
  // задачі (дошка з колонками), сторінки, стратегія, команда (профілі, ерії, one-to-one)
  S.ws = { data: null, id: '', tab: 'board', board: '', view: 'cols', filter: 'all', fcircle: '', showDone: false, arch: false, quick: {},
    open: null, cc: null, cf: null, cmt: '', link: { u: '', t: '' }, linkOpen: false, chk: '',
    page: null, pd: null, pe: null, pq: '',
    circle: null, item: null, itf: null, sf: null, cq: '',
    tteam: 'people', prof: null, person: null, theme: null, matrix: false, an: null, area: null, team: null, otoP: null,
    members: false, find: null, colEdit: null, boardEdit: null, log: false };
  const W_ = () => S.ws;
  const WD_ = () => S.ws.data;
  const WS_CC = ['#4c6a92', '#a4502f', '#2f6b57', '#8f3550', '#94681f', '#5e4a7d', '#3d6f7a', '#7a5c3d', '#6f655a'];
  const WS_DOM = { ex: ['Виконання', '#6d3b7d'], inf: ['Вплив', '#b5651d'], rb: ['Стосунки', '#2f5f99'], st: ['Стратегічне мислення', '#2f7a57'] };
  const WS_REPS = [['day', 'Щодня'], ['week', 'Щотижня'], ['2week', 'Раз на 2 тижні'], ['month', 'Щомісяця']];
  const repLabel = (k) => (WS_REPS.filter((x) => x[0] === k)[0] || ['', ''])[1];
  const WS_ITEM_ORDER = ['idea', 'plan', 'doing', 'pause', 'done'];
  const WS_ICONS = ['📄', '📝', '📌', '🗓', '🎯', '💡', '📚', '🏕', '🙏', '💰', '📣', '🤝', '🧭', '✅'];
  const wsMember = (id) => ((WD_() && WD_().members) || []).filter((m) => m.id === id)[0];
  const wsFirst = (id) => { const m = wsMember(id); return m ? String(m.name || '').split(/\s+/)[0] : ''; };
  const wsCircle = (id) => ((WD_() && WD_().strategy.circles) || []).filter((c) => c.id === id)[0];
  const wsCircleN = (id) => { const L = (WD_() && WD_().strategy.circles) || []; return L.findIndex((c) => c.id === id) + 1; };
  const wsCircleColor = (id) => WS_CC[(wsCircleN(id) - 1 + WS_CC.length) % WS_CC.length];
  const wsCard = (id) => ((WD_() && WD_().cards) || []).filter((c) => c.id === id)[0];
  const wsItem = (id) => ((WD_() && WD_().items) || []).filter((c) => c.id === id)[0];
  const wsCol = (id) => { const d = WD_(); let x = null; (d ? d.boards : []).forEach((b) => b.cols.forEach((c) => { if (c.id === id) x = c; })); return x; };
  const wsAreaOf = (k) => ((WD_() && WD_().areas) || []).filter((a) => a.key === k)[0];
  const wsBusyForm = () => !!(S.ws.nf || S.ws.cf || S.ws.pe || S.ws.itf || S.ws.sf || S.ws.colEdit || S.ws.boardEdit || (S.ws.cmt || '').trim() || (S.ws.cq || '').trim() || Object.keys(S.ws.quick).some((k) => (S.ws.quick[k] || '').trim()));
  const daysFrom = (k) => Math.round((parseDay(k) - parseDay(ymd(new Date()))) / 864e5);
  function wsDue(due, done) {
    if (!due) return '';
    const n = daysFrom(due), d = parseDay(due), lbl = d.getDate() + ' ' + MSHORT[d.getMonth()];
    if (done) return `<span class="wdue">🗓 ${lbl}</span>`;
    if (n < 0) return `<span class="wdue late">⚠️ ${lbl} · прострочено</span>`;
    if (n === 0) return '<span class="wdue soon">🔥 сьогодні</span>';
    if (n === 1) return '<span class="wdue soon">⏰ завтра</span>';
    return `<span class="wdue">🗓 ${lbl}${n <= 6 ? ' · ' + WD[d.getDay()] : ''}</span>`;
  }
  function wsAva(id, cls) {
    const m = wsMember(id), P = S.ws.prof, ph = phUrl(id) || (m && m.pkey && P && P.photos && P.photos[m.pkey]);
    const name = (m && m.name) || '?';
    if (ph) return `<img class="wava ${cls || ''}" src="${esc(ph)}" alt="${esc(name)}" title="${esc(name)}">`;
    let h = 0; String(id).split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) % 997; });
    return `<span class="wava ${cls || ''}" style="background:${WS_CC[h % WS_CC.length]}" title="${esc(name)}">${esc(initials(name))}</span>`;
  }
  function linkKind(u) {
    const s = String(u || '');
    if (/docs\.google\.com\/document/.test(s)) return ['📄', 'Google Документ', 'doc'];
    if (/docs\.google\.com\/spreadsheets/.test(s)) return ['📊', 'Google Таблиця', 'sheet'];
    if (/docs\.google\.com\/presentation/.test(s)) return ['📽', 'Google Презентація', 'slides'];
    if (/docs\.google\.com\/forms|forms\.gle/.test(s)) return ['📝', 'Google Форма', 'form'];
    if (/drive\.google\.com\/(drive\/)?(u\/\d\/)?folders/.test(s)) return ['📁', 'Папка на Диску', 'folder'];
    if (/drive\.google\.com/.test(s)) return ['📎', 'Файл на Диску', 'file'];
    let host = ''; try { host = new URL(s).hostname.replace(/^www\./, ''); } catch (e) { host = 'Посилання'; }
    return ['🔗', host, 'web'];
  }
  const linkChip = (u, t) => { const k = linkKind(u); return `<button type="button" class="wlink k-${k[2]}" data-a="wsOpen" data-u="${esc(u)}"><span>${k[0]}</span><span class="grow">${esc(t || k[1])}</span></button>`; };
  // текст з посиланнями: Google-документи — кнопками, решта — короткими посиланнями
  function wsInline(s) {
    let h = esc(s);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<button type="button" class="linkish" data-a="wsOpen" data-u="${u}">${t}</button>`);
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (m, pre, u) => { const k = linkKind(u.replace(/&amp;/g, '&')); return pre + (k[2] === 'web' ? `<button type="button" class="linkish" data-a="wsOpen" data-u="${u}">${esc(k[1])}</button>` : `<button type="button" class="wlink inl k-${k[2]}" data-a="wsOpen" data-u="${u}">${k[0]} ${k[1]}</button>`); });
    return h;
  }
  const wsText = (s) => String(s || '').split('\n').map(wsInline).join('<br>');
  // сторінка: # заголовки, - списки, - [ ] чекбокси (натискаються), > примітка, --- лінія
  function wsMd(body) {
    const out = [];
    String(body || '').split('\n').forEach((ln, i) => {
      let m;
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) out.push(`<div class="wb-h${m[1].length}">${wsInline(m[2])}</div>`);
      else if ((m = ln.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/))) out.push(`<button type="button" class="wb-chk${m[1] !== ' ' ? ' on' : ''}" data-a="wsTick" data-l="${i}"><span class="bx">${m[1] !== ' ' ? '✓' : ''}</span><span class="grow">${wsInline(m[2])}</span></button>`);
      else if ((m = ln.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/))) out.push(`<div class="wb-li"><span>•</span><span class="grow">${wsInline(m[1])}</span></div>`);
      else if ((m = ln.match(/^>\s?(.*)$/))) out.push(`<div class="wb-q">${wsInline(m[1])}</div>`);
      else if (/^-{3,}$/.test(ln.trim())) out.push('<hr class="wb-hr">');
      else if (!ln.trim()) out.push('<div class="wb-sp"></div>');
      else out.push(`<div class="wb-p">${wsInline(ln)}</div>`);
    });
    return out.join('');
  }
  async function wsLoad(silent) {
    try {
      const d = await api('ws', { ws: S.ws.id || '' });
      S.ws.data = d; S.ws.id = d.id;
      if (S.ws.board !== '_rep' && !d.boards.some((b) => b.id === S.ws.board)) S.ws.board = (d.boards[0] || {}).id || '';
      // фото учасників для аватарок — тихо, після першого показу
      if (!S.ws.prof && d.has && d.has.profiles) setTimeout(wsLoadProf, S.ws.tab === 'team' ? 0 : 600);
    } catch (e) { if (!S.ws.data) S.ws.data = { error: e.message }; if (!silent) toast(e.message); }
    if (S.screen === 'ws' && (!wsBusyForm() || !silent)) render();
  }
  async function wsLoadProf() {
    if (S.ws.profLoading) return; S.ws.profLoading = true;
    try { S.ws.prof = await api('wsProfiles', { ws: S.ws.id }); } catch (e) { S.ws.prof = { profiles: null, photos: {} }; }
    S.ws.profLoading = false;
    if (S.screen === 'ws' && !wsBusyForm()) render();
  }
  async function wsLoadAn() {
    try { S.ws.an = await api('wsAnalytics', { ws: S.ws.id }); } catch (e) { S.ws.an = { analytics: null, oto: null }; toast(e.message); }
    if (S.screen === 'ws') render();
  }
  async function wsLoadCard(id) {
    try { const r = await api('wsCard', { ws: S.ws.id, id: id }); S.ws.cc = r.comments; wsPut(r.card); }
    catch (e) { toast(e.message); if (S.ws.open === id) S.ws.open = null; }
    if (S.screen === 'ws') render();
  }
  async function wsLoadPage(id) {
    try { S.ws.pd = await api('wsPage', { ws: S.ws.id, id: id }); }
    catch (e) { toast(e.message); S.ws.page = null; S.ws.pd = null; }
    if (S.screen === 'ws') render();
  }
  function wsPut(card) {
    if (!WD_() || !WD_().cards) return;
    const L = WD_().cards, i = L.findIndex((x) => x.id === card.id);
    if (i >= 0) L[i] = card; else L.push(card);
    wsMineSync();
  }
  // лічильник «мої задачі» на головній і в «Ще»
  function wsMineSync() {
    const d = WD_(); if (!d || !d.cards || !S.me || !S.me.ws) return;
    const w = S.me.ws.filter((x) => x.id === d.id)[0]; if (!w) return;
    const today = ymd(new Date()), soon = ymd(new Date(Date.now() + 2 * 864e5));
    const mine = d.cards.filter((c) => !c.done && !c.archived && c.who.indexOf(d.me.id) >= 0 && (c.doneBy || []).indexOf(d.me.id) < 0);
    w.open = mine.length; w.next = mine.filter((c) => c.due).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 3).map((c) => ({ id: c.id, title: c.title, due: c.due })); w.soon = mine.filter((c) => c.due && c.due <= soon).length; w.late = mine.filter((c) => c.due && c.due < today).length;
  }
  function wsEnter(o) {
    const W = S.ws;
    if (o.ws) W.id = o.ws;
    ['open', 'nf', 'cf', 'pe', 'itf', 'sf', 'colEdit', 'boardEdit', 'person', 'theme', 'area', 'team', 'otoP', 'circle', 'item'].forEach((k) => { W[k] = null; });
    W.members = false; W.matrix = false; W.page = null; W.pd = null;
    if (o.card) { W.tab = 'board'; W.open = o.card; W.cc = null; }
    if (o.page) { W.tab = 'pages'; W.page = o.page; }
    wsLoad(!!W.data).then(() => { if (o.card && WD_() && !WD_().error) wsLoadCard(o.card); if (o.page && WD_() && !WD_().error) wsLoadPage(o.page); });
  }
  // «назад» усередині простору: від найглибшого рівня
  const WS_LAYERS = [
    ['nf', () => { S.ws.nf = null; }], ['cf', () => { S.ws.cf = null; }], ['colEdit', () => { S.ws.colEdit = null; }], ['boardEdit', () => { S.ws.boardEdit = null; }],
    ['open', () => { S.ws.open = null; S.ws.cc = null; S.ws.linkOpen = false; }],
    ['pe', () => { S.ws.pe = null; }], ['page', () => { const p = S.ws.pd && S.ws.pd.path; const up = p && p.length > 1 ? p[p.length - 2].id : null; S.ws.page = up; S.ws.pd = null; if (up) wsLoadPage(up); }],
    ['itf', () => { S.ws.itf = null; }], ['item', () => { S.ws.item = null; }], ['sf', () => { S.ws.sf = null; }], ['circle', () => { S.ws.circle = null; }],
    ['theme', () => { S.ws.theme = null; }], ['matrix', () => { S.ws.matrix = false; }], ['person', () => { S.ws.person = null; }],
    ['team', () => { S.ws.team = null; }], ['otoP', () => { S.ws.otoP = null; }], ['area', () => { S.ws.area = null; }], ['members', () => { S.ws.members = false; S.ws.find = null; }],
  ];
  function wsCanBack() { return WS_LAYERS.some((l) => !!S.ws[l[0]]); }
  function wsBack() { const l = WS_LAYERS.filter((x) => !!S.ws[x[0]])[0]; if (!l) return false; l[1](); render(); window.scrollTo(0, 0); return true; }

  VIEWS.ws = function () {
    const W = S.ws, d = W.data;
    if (!d) return header('Робочий простір') + loading();
    if (d.error) return header('Робочий простір') + `<div class="empty">${esc(d.error)}</div>`;
    if (W.members) return wsMembersView();
    if (W.nf) return wsNewView();
    if (W.colEdit) return wsColEditView();
    if (W.boardEdit) return wsBoardEditView();
    if (W.open) return wsCardView();
    if (W.pe) return wsPageEditView();
    if (W.page) return wsPageView();
    if (W.itf) return wsItemFormView();
    if (W.item) return wsItemView();
    if (W.sf) return wsStratFormView();
    if (W.circle) return wsCircleView();
    if (W.theme) return wsThemeView();
    if (W.matrix) return wsMatrixView();
    if (W.person) return wsPersonView();
    if (W.team) return wsTeamView();
    if (W.otoP) return wsOtoPersonView();
    if (W.area) return wsAreaView();
    let h = header('Робочий простір', d.name + (d.open === false ? ' · 🔒 бачиш лише ти' : ''), d.me.admin ? `<button type="button" class="icon-btn" data-a="wsMembers" aria-label="Команда простору й дані">${icon('profile', 20)}</button>` : '');
    const tabs = [['board', 'Задачі'], ['pages', 'Сторінки'], ['strategy', 'Стратегія'], ['team', 'Команда']];
    h += `<div class="seg wtabs" role="tablist">${tabs.map((t) => `<button type="button" role="tab" class="${W.tab === t[0] ? 'on' : ''}" data-a="wsTab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    if (W.tab === 'board') h += wsBoardTab();
    if (W.tab === 'pages') h += wsPagesTab();
    if (W.tab === 'strategy') h += wsStratTab();
    if (W.tab === 'team') h += wsTeamTab();
    return h;
  };

  // ───── задачі ─────
  function wsFiltered() {
    const W = S.ws, d = W.data, today = ymd(new Date());
    return d.cards.filter((c) => !c.archived && (W.filter !== 'mine' || c.who.indexOf(d.me.id) >= 0) && (W.filter !== 'late' || (!c.done && c.due && c.due < today)) &&
      (W.filter !== 'none' || !c.who.length) && (!W.fcircle || c.circle === W.fcircle));
  }
  // моя галочка: якщо я виконавець — моя частина, інакше — уся задача
  const wsMeId = () => (WD_() && WD_().me.id) || '';
  const wsTickOn = (c) => (c.who.indexOf(wsMeId()) >= 0 ? (c.doneBy || []).indexOf(wsMeId()) >= 0 : c.done);
  const wsAvas = (c, n) => `<span class="wavas">${c.who.slice(0, n || 4).map((id) => `<span class="wav${(c.doneBy || []).indexOf(id) >= 0 ? ' ok' : ''}">${wsAva(id, 'sm')}</span>`).join('')}</span>`;
  function wsCardTile(c, showCol) {
    const nc = c.check.length, dc = c.check.filter((k) => k.d).length;
    const cir = c.circle && wsCircle(c.circle);
    const col = showCol && wsCol(c.col);
    const on = wsTickOn(c), part = c.who.length > 1 ? (c.doneBy || []).length : 0;
    return `<div class="kcard wcard${c.done ? ' done' : ''}"${cir ? ` style="--cc:${wsCircleColor(c.circle)}"` : ''}>
      <button type="button" class="wtick${on ? ' on' : ''}" data-a="wsCardTick" data-id="${esc(c.id)}" aria-label="${on ? 'Зняти галочку' : 'Виконано'}">${on ? '✓' : ''}</button>
      <button type="button" class="wopen" data-a="wsCardOpen" data-id="${esc(c.id)}">
      ${cir ? `<span class="wcir">${wsCircleN(c.circle)} · ${esc(cir.title)}</span>` : ''}
      <span class="wct">${esc(c.title)}</span>
      <span class="wmeta">${c.rep ? `<span class="wchip rep">🔁 ${esc(repLabel(c.rep).toLowerCase())}</span>` : ''}${wsDue(c.due, c.done)}${part ? `<span class="wchip ok">✓ ${part}/${c.who.length}</span>` : ''}${col ? `<span class="wchip">${esc(c.archived ? 'архів' : col.title)}</span>` : ''}${nc ? `<span class="wchip${dc === nc ? ' ok' : ''}">☑ ${dc}/${nc}</span>` : ''}${c.links.length ? `<span class="wchip">🔗 ${c.links.length}</span>` : ''}${c.comments ? `<span class="wchip">💬 ${c.comments}</span>` : ''}
      ${c.who.length ? wsAvas(c) : ''}</span></button></div>`;
  }
  function wsBoardTab() {
    const W = S.ws, d = W.data, today = ymd(new Date());
    const isRep = W.board === '_rep';
    const board = isRep ? null : d.boards.filter((b) => b.id === W.board)[0] || d.boards[0];
    const repN = d.cards.filter((c) => c.rep && !c.archived).length;
    let h = '';
    const mineN = d.cards.filter((c) => !c.archived && !c.done && c.who.indexOf(d.me.id) >= 0 && (c.doneBy || []).indexOf(d.me.id) < 0).length;
    const lateN = d.cards.filter((c) => !c.archived && !c.done && c.due && c.due < today).length;
    h += '<button type="button" class="btn sm" data-a="wsNew">+ Нова задача</button>';
    h += `<div class="pills" data-noptr>${d.boards.map((b) => `<button type="button" class="pill${board && b.id === board.id ? ' on' : ''}" data-a="wsBoard" data-id="${esc(b.id)}">${esc(b.title)}</button>`).join('')}<button type="button" class="pill${isRep ? ' on' : ''}" data-a="wsBoard" data-id="_rep">🔁 Повторювальні${repN ? ' · ' + repN : ''}</button><button type="button" class="pill multi" data-a="wsBoardNew">+ Дошка</button></div>`;
    h += `<div class="pills" data-noptr>${[['all', 'Усі'], ['mine', 'Мої' + (mineN ? ' · ' + mineN : '')], ['late', 'Прострочені' + (lateN ? ' · ' + lateN : '')], ['none', 'Без виконавця']].map((x) => `<button type="button" class="pill sm${W.filter === x[0] ? ' on' : ''}" data-a="wsFilter" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`;
    h += `<div class="row" style="gap:8px"><select class="in grow" style="min-height:40px" data-ch="wsFCircle" aria-label="Напрямок"><option value="">Усі напрямки</option>${d.strategy.circles.map((c, i) => `<option value="${esc(c.id)}"${W.fcircle === c.id ? ' selected' : ''}>${i + 1}. ${esc(c.title)}</option>`).join('')}</select>
      <div class="seg" style="flex:0 0 auto"><button type="button" class="${W.view === 'cols' ? 'on' : ''}" data-a="wsView" data-v="cols" aria-label="Колонки">▥</button><button type="button" class="${W.view === 'list' ? 'on' : ''}" data-a="wsView" data-v="list" aria-label="За дедлайнами">☰</button></div></div>`;
    const list = wsFiltered();
    if (isRep && W.view !== 'list') {
      // окрема дошка: усі повторювальні задачі з усіх дошок, колонки — як часто
      h += `<div class="board wboard" data-noptr>${WS_REPS.map((r) => {
        const cs = list.filter((c) => c.rep === r[0]).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
        return `<div class="col-st wcol"><div class="col-h"><span class="grow">🔁 ${r[1]}</span><span class="n">${cs.length}</span></div>
          ${cs.map((c) => wsCardTile(c)).join('')}
          <div class="wquick"><input class="in" type="text" maxlength="300" placeholder="+ ${r[1].toLowerCase()}" data-bind="ws.quick._rep_${r[0]}" value="${esc(W.quick['_rep_' + r[0]] || '')}" data-enter="wsQuick" data-col="_rep_${r[0]}"><button type="button" class="icon-btn" data-a="wsQuick" data-col="_rep_${r[0]}" aria-label="Додати">${icon('plus', 18)}</button></div></div>`;
      }).join('')}</div>
      <div class="xs muted">Коли повторювальну задачу виконали всі, вона не йде в архів, а переноситься на наступний раз — галочки й чек-лист очищаються.</div>`;
    } else if (!board) return h + '<div class="empty">Ще немає дошки</div>';
    else if (W.view === 'list') h += wsDeadlineList(list);
    else {
      h += `<div class="board wboard" data-noptr>${board.cols.map((col) => {
        const cs = list.filter((c) => c.col === col.id && !c.rep).sort((a, b) => a.pos - b.pos);
        const shown = col.kind === 'done' && !W.showDone ? cs.slice(-5).reverse() : cs;
        return `<div class="col-st wcol${col.kind === 'done' ? ' wdone' : ''}"><div class="col-h"><span class="grow">${col.kind === 'done' ? '✓ ' : ''}${esc(col.title)}</span><span class="n">${cs.length}</span>
          <button type="button" class="wcol-m" data-a="wsColEdit" data-id="${esc(col.id)}" aria-label="Налаштувати колонку">⋯</button></div>
          ${shown.map((c) => wsCardTile(c)).join('')}
          ${col.kind === 'done' && cs.length > 5 ? `<button type="button" class="link-btn xs" data-a="wsShowDone">${W.showDone ? 'Згорнути' : 'Показати всі ' + cs.length}</button>` : ''}
          <div class="wquick"><input class="in" type="text" maxlength="300" placeholder="+ Нова задача" data-bind="ws.quick.${esc(col.id)}" value="${esc(W.quick[col.id] || '')}" data-enter="wsQuick" data-col="${esc(col.id)}"><button type="button" class="icon-btn" data-a="wsQuick" data-col="${esc(col.id)}" aria-label="Додати">${icon('plus', 18)}</button></div></div>`;
      }).join('')}<button type="button" class="col-st wcol wadd" data-a="wsColNew">+ Колонка</button></div>`;
    }
    const arch = d.cards.filter((c) => c.archived);
    h += `<div class="row between"><button type="button" class="link-btn xs" data-a="wsLog">${W.log ? 'Сховати' : '🕘 Що нового в команді'}</button>${arch.length ? `<button type="button" class="link-btn xs" data-a="wsArch">${W.arch ? 'Сховати архів' : '🗄 Архів · ' + arch.length}</button>` : ''}</div>`;
    if (W.log) h += `<div class="card list">${(d.log || []).length ? d.log.slice(0, 20).map((e) => `<${e.card ? 'button type="button" data-a="wsCardOpen" data-id="' + esc(e.card) + '"' : 'div'} class="li wlog">${wsAva(e.tgId, 'sm')}<span class="grow small"><b>${esc(String(e.name).split(/\s+/)[0])}</b> ${esc(e.text)}<br><span class="xs muted">${esc(fmtWhen(e.ts))}</span></span></${e.card ? 'button' : 'div'}>`).join('') : '<div class="empty">Ще нічого не відбувалося</div>'}</div>`;
    if (W.arch) h += `<div class="col" style="gap:8px">${arch.map((c) => wsCardTile(c, true)).join('')}</div>`;
    return h;
  }
  function wsDeadlineList(list) {
    const today = ymd(new Date()), wk = ymd(new Date(Date.now() + 7 * 864e5));
    const open = list.filter((c) => !c.done);
    const g = [['⚠️ Прострочено', open.filter((c) => c.due && c.due < today)], ['🔥 Сьогодні й завтра', open.filter((c) => c.due && c.due >= today && daysFrom(c.due) <= 1)],
      ['🗓 Цього тижня', open.filter((c) => c.due && daysFrom(c.due) > 1 && c.due <= wk)], ['Пізніше', open.filter((c) => c.due && c.due > wk)], ['Без дедлайну', open.filter((c) => !c.due)]];
    const h = g.filter((x) => x[1].length).map((x) => `<div class="sec">${x[0]} · ${x[1].length}</div><div class="col" style="gap:8px">${x[1].sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map((c) => wsCardTile(c, true)).join('')}</div>`).join('');
    return h || '<div class="empty">Відкритих задач немає 🎉</div>';
  }
  function wsCardView() {
    const W = S.ws, d = W.data, c = wsCard(W.open);
    if (!c) return header('Задача') + loading();
    const board = d.boards.filter((b) => b.id === c.board)[0] || d.boards[0];
    const col = wsCol(c.col);
    const canDel = d.me.admin || c.authorId === d.me.id;
    let h = header(c.done ? '✓ Виконано' : (col ? col.title : 'Задача'), board ? board.title : '');
    if (W.cf) {
      h += `<div class="card col"><label class="f"><span>Назва</span><input class="in" type="text" maxlength="300" data-bind="ws.cf.title" value="${esc(W.cf.title)}"></label>
        <label class="f"><span>Опис</span><textarea class="in" rows="7" maxlength="8000" data-bind="ws.cf.desc" placeholder="Що саме треба, деталі, посилання…">${esc(W.cf.desc)}</textarea></label>
        <div class="grid2"><button type="button" class="btn" data-a="wsCardEditSave">${icon('check', 18)} Зберегти</button><button type="button" class="btn ghost" data-a="wsBack">Скасувати</button></div></div>`;
      return h;
    }
    h += `<div class="card col wsheet"><div class="row" style="align-items:flex-start"><h2 class="grow" style="font-size:20px">${esc(c.title)}</h2><button type="button" class="icon-btn" data-a="wsCardEdit" aria-label="Редагувати">✏️</button></div>
      ${c.desc ? `<div class="small wdesc">${wsText(c.desc)}</div>` : '<button type="button" class="link-btn xs" style="align-self:flex-start" data-a="wsCardEdit">+ Додати опис</button>'}
      ${(() => {
        const mine = c.who.indexOf(d.me.id) >= 0, on = wsTickOn(c), many = c.who.length > 1;
        const lbl = on ? (mine && many ? '↩︎ Зняти мою галочку' : '↩︎ Повернути в роботу') : (mine && many ? '✓ Я виконав(ла) свою частину' : '✓ Позначити виконаною');
        return `<button type="button" class="btn${on ? ' sec2' : ' teal'}" data-a="wsDone">${lbl}</button>` +
          (many ? `<div class="row" style="gap:8px">${wsAvas(c, 12)}<span class="small muted">виконали ${(c.doneBy || []).length} з ${c.who.length}${c.done ? ' · задача в архіві' : ' · коли відмітять усі — піде в архів'}</span></div>` : (c.done ? '<div class="xs muted">Задача виконана й лежить в архіві</div>' : ''));
      })()}
      ${c.rep ? '' : `<div class="f"><span>Колонка</span><div class="chips" data-noptr>${(board ? board.cols : []).map((k) => `<button type="button" class="chip${k.id === c.col ? ' on' : ''}" data-a="wsMove" data-id="${esc(k.id)}">${esc(k.title)}</button>`).join('')}</div></div>`}</div>`;
    h += `<div class="card col"><div class="f"><span>Хто виконує</span><div class="chips">${d.members.map((m) => `<button type="button" class="chip wwho${c.who.indexOf(m.id) >= 0 ? ' on' : ''}" data-a="wsWho" data-id="${esc(m.id)}">${wsAva(m.id, 'xs')}${esc(String(m.name).split(/\s+/)[0] || '—')}</button>`).join('')}</div></div>
      <div class="grid2"><label class="f"><span>Дедлайн</span><input class="in" type="date" value="${esc(c.due)}" data-ch="wsDueSet"></label>
      <div class="f"><span>&nbsp;</span>${c.due ? `<div class="row" style="min-height:48px;gap:6px">${wsDue(c.due, c.done)}<button type="button" class="link-btn xs" data-a="wsDueClear">прибрати</button></div>` : '<div class="xs muted" style="min-height:48px;display:flex;align-items:center">Нагадаю в боті за день, у день і якщо прострочено</div>'}</div></div>
      <label class="f"><span>Повторювати</span><select class="in" data-ch="wsRepSet"><option value="">Не повторювати</option>${WS_REPS.map((r) => `<option value="${r[0]}"${c.rep === r[0] ? ' selected' : ''}>${r[1]}</option>`).join('')}</select></label>
      ${c.rep ? `<div class="xs muted" style="margin-top:-4px">🔁 Після виконання переноситься на наступний раз${c.repN ? ` · виконано ${plural(c.repN, 'раз', 'рази', 'разів')}, востаннє ${esc(fmtShortDay(c.repLast))}` : ''}</div>` : ''}
      <label class="f"><span>Напрямок стратегії</span><select class="in" data-ch="wsCircleSet"><option value="">—</option>${d.strategy.circles.map((k, i) => `<option value="${esc(k.id)}"${k.id === c.circle ? ' selected' : ''}>${i + 1}. ${esc(k.title)}</option>`).join('')}</select></label>
      ${d.items.length ? `<label class="f"><span>Ціль чи проект</span><select class="in" data-ch="wsItemSet"><option value="">—</option>${d.items.map((it) => `<option value="${esc(it.id)}"${it.id === c.item ? ' selected' : ''}>${it.kind === 'goal' ? '🎯' : '📁'} ${esc(it.title)}</option>`).join('')}</select></label>` : ''}</div>`;
    // чек-лист
    const dc = c.check.filter((k) => k.d).length;
    h += `<div class="card col" style="gap:6px"><div class="row between"><h2>☑️ Чек-лист</h2>${c.check.length ? `<span class="small b">${dc} / ${c.check.length}</span>` : ''}</div>
      ${c.check.length ? `<span class="track" style="height:5px"><i style="width:${Math.round(dc / c.check.length * 100)}%;background:var(--turq)"></i></span>` : ''}
      ${c.check.map((k, i) => `<div class="row wchk"><button type="button" class="wb-chk${k.d ? ' on' : ''} grow" data-a="wsChk" data-i="${i}"><span class="bx">${k.d ? '✓' : ''}</span><span class="grow">${esc(k.t)}</span></button><button type="button" class="wx" data-a="wsChkDel" data-i="${i}" aria-label="Прибрати">×</button></div>`).join('')}
      <div class="wquick"><input class="in" type="text" maxlength="300" placeholder="+ Пункт" data-bind="ws.chk" value="${esc(W.chk)}" data-enter="wsChkAdd"><button type="button" class="icon-btn" data-a="wsChkAdd" aria-label="Додати пункт">${icon('plus', 18)}</button></div></div>`;
    // посилання
    h += `<div class="card col" style="gap:8px"><h2>🔗 Документи й посилання</h2>
      ${c.links.map((l, i) => `<div class="row" style="gap:6px">${linkChip(l.u, l.t)}<button type="button" class="wx" data-a="wsLinkDel" data-i="${i}" aria-label="Прибрати посилання">×</button></div>`).join('')}
      ${W.linkOpen ? `<input class="in" type="url" inputmode="url" placeholder="https://docs.google.com/…" data-bind="ws.link.u" value="${esc(W.link.u)}">
        <input class="in" type="text" maxlength="200" placeholder="Назва (необовʼязково)" data-bind="ws.link.t" value="${esc(W.link.t)}">
        <div class="grid2"><button type="button" class="btn sm" data-a="wsLinkAdd">Додати</button><button type="button" class="btn sm ghost" data-a="wsLinkToggle">Скасувати</button></div>
        <div class="xs muted">Google Документ, Таблиця, Презентація, Форма чи папка на Диску — або будь-яке посилання. Хто бачить сам файл — налаштовується в Google.</div>`
      : '<button type="button" class="btn sm sec2" data-a="wsLinkToggle">+ Прикріпити Google-документ чи посилання</button>'}</div>`;
    // коментарі
    const C = W.cc;
    h += `<div class="card col" style="gap:8px"><h2>💬 Коментарі${c.comments ? ' · ' + c.comments : ''}</h2>
      ${C == null ? '<div class="xs muted">Завантажую…</div>' : C.map((k) => `<div class="row wcm" style="align-items:flex-start">${wsAva(k.tgId, 'sm')}<div class="grow"><div class="small"><b>${esc(k.name)}</b> <span class="xs muted">${esc(fmtWhen(k.created))}</span></div><div class="small">${wsText(k.text)}</div></div>${k.tgId === d.me.id || d.me.admin ? `<button type="button" class="wx" data-a="wsCmtDel" data-id="${esc(k.id)}" aria-label="Видалити коментар">×</button>` : ''}</div>`).join('')}
      <textarea class="in" rows="2" maxlength="3000" placeholder="Написати коментар… (виконавці отримають повідомлення)" data-bind="ws.cmt">${esc(W.cmt)}</textarea>
      <button type="button" class="btn sm" data-a="wsCmt">${icon('send', 16)} Надіслати</button></div>`;
    h += `<div class="xs muted center">Створив(ла) ${esc(c.author)} · ${esc(fmtWhen(c.created))}${c.updatedBy && c.updated !== c.created ? '<br>Змінено: ' + esc(c.updatedBy) + ' · ' + esc(fmtWhen(c.updated)) : ''}</div>
      <div class="grid2"><button type="button" class="btn sm sec2" data-a="wsShift" data-v="-1">↑ Вище</button><button type="button" class="btn sm sec2" data-a="wsShift" data-v="1">↓ Нижче</button></div>
      <div class="grid2"><button type="button" class="btn sm ghost" data-a="wsArchive">${c.archived ? '↩︎ З архіву' : '🗄 В архів'}</button>${canDel ? '<button type="button" class="btn sm ghost danger-t" data-a="wsCardDel">Видалити</button>' : '<span></span>'}</div>`;
    return h;
  }
  async function wsSave(patch, okMsg) {
    const c = wsCard(S.ws.open); if (!c) return null;
    const r = await run(() => api('wsCardSave', Object.assign({ ws: S.ws.id, id: c.id }, patch)), okMsg);
    if (r) { wsPut(r); haptic('light'); }
    render();
    return r;
  }
  function wsNewView() {
    const f = S.ws.nf, d = WD_();
    const board = d.boards.filter((b) => b.id === f.board)[0] || d.boards[0];
    let h = header('Нова задача', f.who.length === 1 && f.who[0] === d.me.id ? 'собі' : '');
    h += `<div class="card col"><label class="f"><span>Що треба зробити</span><input class="in" type="text" maxlength="300" data-bind="ws.nf.title" value="${esc(f.title)}" placeholder="Наприклад: зустрітися з капітанами Тернополя"></label>
      <div class="f"><span>Напрямок стратегії</span><div class="wcpick">${d.strategy.circles.map((c, i) => `<button type="button" class="${f.circle === c.id ? 'on' : ''}" style="--cc:${WS_CC[i % WS_CC.length]}" data-a="wsNfCircle" data-id="${esc(c.id)}"><span class="wc-n">${i + 1}</span><span class="grow">${esc(c.title)}</span></button>`).join('')}</div></div>
      ${d.items.filter((it) => !f.circle || it.circle === f.circle).length ? `<label class="f"><span>Ціль чи проект</span><select class="in" data-bind="ws.nf.item"><option value="">—</option>${d.items.filter((it) => !f.circle || it.circle === f.circle).map((it) => `<option value="${esc(it.id)}"${it.id === f.item ? ' selected' : ''}>${it.kind === 'goal' ? '🎯' : '📁'} ${esc(it.title)}</option>`).join('')}</select></label>` : ''}
      <div class="f"><span>Хто виконує</span><div class="chips">${d.members.map((m) => `<button type="button" class="chip wwho${f.who.indexOf(m.id) >= 0 ? ' on' : ''}" data-a="wsNfWho" data-id="${esc(m.id)}">${wsAva(m.id, 'xs')}${m.id === d.me.id ? 'Я' : esc(String(m.name).split(/\s+/)[0] || '—')}</button>`).join('')}</div></div>
      <div class="grid2"><label class="f"><span>Дедлайн</span><input class="in" type="date" data-bind="ws.nf.due" value="${esc(f.due)}"></label>
      <label class="f"><span>Колонка</span><select class="in" data-bind="ws.nf.col">${(board ? board.cols : []).filter((k) => k.kind !== 'done').map((k) => `<option value="${esc(k.id)}"${k.id === f.col ? ' selected' : ''}>${esc(k.title)}</option>`).join('')}</select></label></div>
      <label class="f"><span>Повторювати</span><select class="in" data-bind="ws.nf.rep"><option value="">Не повторювати</option>${WS_REPS.map((r) => `<option value="${r[0]}"${f.rep === r[0] ? ' selected' : ''}>${r[1]}</option>`).join('')}</select></label>
      <button type="button" class="btn" data-a="wsNfSave"${S.ws.nfBusy ? ' disabled' : ''}>${icon('send', 18)} ${f.who.some((id) => id !== d.me.id) ? 'Надіслати задачу' : 'Додати задачу'}</button>
      <div class="xs muted">Задача зʼявиться і на дошці, і в «Стратегії» у своєму напрямку — це одна задача: галочка в будь-якому місці відмічає її скрізь.</div></div>`;
    return h;
  }
  function wsColEditView() {
    const E = S.ws.colEdit, d = WD_();
    const col = E.id && wsCol(E.id);
    let h = header(col ? 'Колонка' : 'Нова колонка');
    h += `<div class="card col"><label class="f"><span>Назва</span><input class="in" type="text" maxlength="60" data-bind="ws.colEdit.title" value="${esc(E.title)}" placeholder="Наприклад: На погодженні"></label>
      ${col ? `<label class="toggle-row"><span><span class="b" style="display:block">Колонка «Готово»</span><span class="xs muted">задачі тут вважаються виконаними</span></span><input type="checkbox" data-bind="ws.colEdit.done"${E.done ? ' checked' : ''}></label>` : ''}
      <button type="button" class="btn" data-a="wsColSave">${icon('check', 18)} Зберегти</button>
      ${col ? `<div class="grid2"><button type="button" class="btn sm sec2" data-a="wsColShift" data-v="-1">← Лівіше</button><button type="button" class="btn sm sec2" data-a="wsColShift" data-v="1">Правіше →</button></div>
      <button type="button" class="btn sm ghost danger-t" data-a="wsColDel">Видалити колонку</button>` : ''}</div>`;
    return h;
  }
  function wsBoardEditView() {
    const E = S.ws.boardEdit, d = WD_();
    let h = header(E.id ? 'Дошка' : 'Нова дошка', E.id ? '' : 'Наприклад: Табори, Фандрейзинг, Навчання');
    h += `<div class="card col"><label class="f"><span>Назва дошки</span><input class="in" type="text" maxlength="80" data-bind="ws.boardEdit.title" value="${esc(E.title)}"></label>
      <button type="button" class="btn" data-a="wsBoardSave">${icon('check', 18)} Зберегти</button>
      ${E.id && d.me.admin && d.boards.length > 1 ? '<button type="button" class="btn sm ghost danger-t" data-a="wsBoardDel">Видалити дошку</button>' : ''}</div>`;
    return h;
  }

  // ───── сторінки ─────
  function wsPagesTab() {
    const W = S.ws, d = W.data;
    const q = (W.pq || '').trim().toLowerCase();
    const kids = (id) => d.pages.filter((p) => p.parent === id);
    const row = (p) => { const n = kids(p.id).length; return `<button type="button" class="li" data-a="wsPageOpen" data-id="${esc(p.id)}"><span class="wpi">${esc(p.icon || '📄')}</span>
      <span class="grow"><span class="b" style="display:block">${esc(p.title)}</span><span class="xs muted">${esc(fmtWhen(p.updated))}${p.updatedBy ? ' · ' + esc(String(p.updatedBy).split(/\s+/)[0]) : ''}${n ? ' · ' + plural(n, 'підсторінка', 'підсторінки', 'підсторінок') : ''}</span></span><span class="muted">${icon('chev', 18)}</span></button>`; };
    let h = '<button type="button" class="btn sec2" data-a="wsPageNew">+ Нова сторінка</button>';
    if (d.pages.length > 6) h += `<input class="in" type="search" placeholder="Знайти сторінку" value="${esc(W.pq)}" data-bind="ws.pq" data-live="wsPq">`;
    const list = q ? d.pages.filter((p) => p.title.toLowerCase().indexOf(q) >= 0) : kids('');
    if (!d.pages.length) return h + '<div class="empty">Тут будуть нотатки зустрічей, плани, інструкції й посилання на документи.<br>Сторінки можна вкладати одна в одну, як у Notion.</div>';
    h += list.length ? `<div class="card list">${list.map(row).join('')}</div>` : '<div class="empty">Нічого не знайдено</div>';
    if (!q) {
      const recent = d.pages.slice().sort((a, b) => (a.updated < b.updated ? 1 : -1)).filter((p) => p.parent).slice(0, 5);
      if (recent.length) h += `<div class="sec">Нещодавно змінені</div><div class="card list">${recent.map(row).join('')}</div>`;
    }
    h += '<div class="xs muted center">Підказка: у тексті <b># Заголовок</b>, <b>- пункт</b>, <b>- [ ] чекбокс</b>, посилання на Google-документи стають кнопками</div>';
    return h;
  }
  function wsPageView() {
    const W = S.ws, P = W.pd;
    if (!P || !P.page || P.page.id !== W.page) return header('Сторінка') + loading();
    const p = P.page, d = W.data;
    let h = '';
    if (P.path.length > 1) h += `<div class="wcrumbs">${P.path.slice(0, -1).map((x) => `<button type="button" class="linkish xs" data-a="wsPageOpen" data-id="${esc(x.id)}">${esc(x.icon || '📄')} ${esc(x.title)}</button>`).join('<span class="muted xs"> / </span>')}</div>`;
    h += header((p.icon ? p.icon + ' ' : '') + p.title, 'Змінено ' + fmtWhen(p.updated) + (p.updatedBy ? ' · ' + p.updatedBy : ''), `<button type="button" class="icon-btn" data-a="wsPageEdit" aria-label="Редагувати">✏️</button>`);
    h += p.body ? `<div class="card wbody">${wsMd(p.body)}</div>` : '<button type="button" class="card empty" style="width:100%" data-a="wsPageEdit">Порожня сторінка — натисни, щоб писати</button>';
    h += `<div class="sec">Підсторінки</div>${P.children.length ? `<div class="card list">${P.children.map((x) => `<button type="button" class="li" data-a="wsPageOpen" data-id="${esc(x.id)}"><span class="wpi">${esc(x.icon || '📄')}</span><span class="grow b">${esc(x.title)}</span><span class="muted">${icon('chev', 18)}</span></button>`).join('')}</div>` : ''}
      <button type="button" class="btn sm sec2" data-a="wsPageNew" data-parent="${esc(p.id)}">+ Підсторінка</button>`;
    if (d.me.admin || p.authorId === d.me.id) h += '<button type="button" class="btn sm ghost danger-t" data-a="wsPageDel">Видалити сторінку</button>';
    return h;
  }
  function wsPageEditView() {
    const W = S.ws, E = W.pe, d = W.data;
    const bad = E.id ? [E.id].concat((function walk(id) { return d.pages.filter((x) => x.parent === id).reduce((a, x) => a.concat([x.id], walk(x.id)), []); })(E.id)) : [];
    let h = header(E.id ? 'Редагування' : 'Нова сторінка', E.conflict ? '' : 'Зміни бачитиме вся команда простору');
    if (E.conflict) h += `<div class="note small">${esc(E.conflict)}</div>`;
    h += `<div class="card col"><div class="wicons" data-noptr>${WS_ICONS.map((ic) => `<button type="button" class="${E.icon === ic ? 'on' : ''}" data-a="wsPageIcon" data-v="${ic}">${ic}</button>`).join('')}</div>
      <input class="in wtitle" type="text" maxlength="200" placeholder="Назва сторінки" data-bind="ws.pe.title" value="${esc(E.title)}">
      <div class="wtool" data-noptr>${[['h', 'Заголовок'], ['li', '• Список'], ['chk', '☐ Чекбокс'], ['q', '› Примітка'], ['hr', '— Лінія'], ['link', '🔗 Посилання']].map((x) => `<button type="button" data-a="wsIns" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <textarea id="wsBody" class="in wed" rows="16" maxlength="60000" data-bind="ws.pe.body" placeholder="Пиши тут. Можна вставляти посилання на Google-документи.">${esc(E.body)}</textarea>
      <label class="f"><span>Вкладена в</span><select class="in" data-bind="ws.pe.parent"><option value="">— верхній рівень —</option>${d.pages.filter((x) => bad.indexOf(x.id) < 0).map((x) => `<option value="${esc(x.id)}"${x.id === E.parent ? ' selected' : ''}>${esc((x.icon || '📄') + ' ' + x.title)}</option>`).join('')}</select></label>
      <div class="grid2"><button type="button" class="btn" data-a="wsPageSave">${icon('check', 18)} Зберегти</button><button type="button" class="btn ghost" data-a="wsBack">Скасувати</button></div></div>`;
    return h;
  }

  // ───── стратегія ─────
  function wsTargets() {
    const d = WD_(), cur = d.current || {};
    return `<div class="wtargets">${d.strategy.targets.map((t) => {
      const v = cur[t.k], pct = v != null && t.n ? Math.min(100, Math.round(v / t.n * 100)) : 0;
      return `<div class="wtarget"><div class="wt-v"><b>${v == null ? '—' : nf(v)}</b><span> / ${nf(t.n)}</span></div><div class="xs muted">${esc(t.l)}</div><span class="track" style="height:6px"><i style="width:${pct}%;background:var(--accent)"></i></span><div class="xs b">${v == null ? '' : pct + '%'}</div></div>`;
    }).join('')}</div>`;
  }
  function wsStratTab() {
    const W = S.ws, d = W.data, st = d.strategy;
    const vis = String(st.vision || ''), num = (vis.match(/\d{3,}/) || [''])[0];
    let h = `<div class="card whero"><div class="xs muted">${esc(st.title)}</div><div class="wh-v">${num ? esc(vis.replace(num, '').trim()) + ' <b>' + esc(num) + '</b>' : esc(vis)}</div>${wsTargets()}
      <div class="xs muted">Наживо з MyYL${d.current.region ? ' · регіон ' + esc(d.current.region) : ''}: лідери — усі в командах регіону, команди — активні, стафи — учасники цього простору. Кожна людина рахується один раз.</div>
      <div class="row" style="gap:8px">${st.docUrl ? `<button type="button" class="btn sm sec2 grow" data-a="wsOpen" data-u="${esc(st.docUrl)}">📄 Повна стратегія</button>` : ''}${d.me.admin ? '<button type="button" class="btn sm ghost" data-a="wsStratEdit">✏️ Змінити</button>' : ''}</div></div>`;
    h += `<div class="sec">9 напрямків</div><div class="wcircles">${st.circles.map((c, i) => {
      const its = d.items.filter((x) => x.circle === c.id), open = d.cards.filter((x) => x.circle === c.id && !x.done && !x.archived).length;
      return `<button type="button" class="wcircle" style="--cc:${WS_CC[i % WS_CC.length]}" data-a="wsCircle" data-id="${esc(c.id)}"><span class="wc-n">${i + 1}</span><span class="grow"><span class="wc-t">${esc(c.title)}</span>
        <span class="xs muted">${[its.length ? plural(its.length, 'ціль/проект', 'цілі/проекти', 'цілей/проектів') : '', open ? plural(open, 'задача', 'задачі', 'задач') : ''].filter(Boolean).join(' · ') || 'ще порожньо'}</span></span>${icon('chev', 16)}</button>`;
    }).join('')}</div>`;
    const doing = d.items.filter((x) => x.status === 'doing');
    if (doing.length) h += `<div class="sec">Зараз у роботі</div><div class="card list">${doing.map(wsItemRow).join('')}</div>`;
    return h;
  }
  function wsItemRow(it) {
    const d = WD_(), open = d.cards.filter((x) => x.item === it.id && !x.archived), done = open.filter((x) => x.done).length;
    return `<button type="button" class="li" data-a="wsItemOpen" data-id="${esc(it.id)}"><span class="wpi">${it.kind === 'goal' ? '🎯' : '📁'}</span><span class="grow"><span class="b" style="display:block">${esc(it.title)}</span>
      <span class="row wrap" style="gap:6px;margin-top:3px"><span class="tag st-${it.status}">${esc(d.itemSt[it.status])}</span>${it.owner ? `<span class="xs muted">${esc(wsFirst(it.owner))}</span>` : ''}${it.due ? wsDue(it.due, it.status === 'done') : ''}${open.length ? `<span class="xs muted">задачі ${done}/${open.length}</span>` : ''}</span></span><span class="muted">${icon('chev', 18)}</span></button>`;
  }
  function wsCircleView() {
    const W = S.ws, d = W.data, c = wsCircle(W.circle);
    if (!c) { W.circle = null; return wsStratTab(); }
    const i = wsCircleN(c.id);
    let h = header(i + '. ' + c.title, 'Напрямок стратегії');
    const its = d.items.filter((x) => x.circle === c.id);
    ['goal', 'project'].forEach((k) => {
      const L = its.filter((x) => x.kind === k).sort((a, b) => WS_ITEM_ORDER.indexOf(a.status) - WS_ITEM_ORDER.indexOf(b.status));
      h += `<div class="row between" style="margin-top:4px"><div class="sec" style="margin:0 4px">${k === 'goal' ? '🎯 Цілі' : '📁 Проекти'}</div><button type="button" class="link-btn xs" data-a="wsItemNew" data-k="${k}">+ ${k === 'goal' ? 'Ціль' : 'Проект'}</button></div>`;
      h += L.length ? `<div class="card list">${L.map(wsItemRow).join('')}</div>` : `<div class="xs muted" style="padding:0 6px">${k === 'goal' ? 'Що хочемо досягти в цьому напрямку' : 'Конкретні проекти, що ведуть до цілей'}</div>`;
    });
    const cards = d.cards.filter((x) => x.circle === c.id && !x.archived);
    h += `<div class="sec">✅ Задачі · ${cards.filter((x) => !x.done).length} відкритих</div><button type="button" class="btn sm" data-a="wsNew" data-circle="${esc(c.id)}">+ Нова задача в цьому напрямку</button>` + wsQuickAdd({ circle: c.id });
    h += `<div class="col" style="gap:8px">${cards.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.due || '9').localeCompare(b.due || '9')).map((x) => wsCardTile(x, true)).join('')}</div>`;
    return h;
  }
  const wsQuickAdd = (o) => `<div class="wquick"><input class="in" type="text" maxlength="300" placeholder="+ Нова задача сюди" data-bind="ws.cq" value="${esc(S.ws.cq)}" data-enter="wsCq"${o.item ? ` data-item="${esc(o.item)}"` : ''}${o.circle ? ` data-circle="${esc(o.circle)}"` : ''}><button type="button" class="icon-btn" data-a="wsCq"${o.item ? ` data-item="${esc(o.item)}"` : ''}${o.circle ? ` data-circle="${esc(o.circle)}"` : ''} aria-label="Додати задачу">${icon('plus', 18)}</button></div>`;
  function wsItemView() {
    const W = S.ws, d = W.data, it = wsItem(W.item);
    if (!it) { W.item = null; return wsCircleView(); }
    const c = wsCircle(it.circle);
    let h = header((it.kind === 'goal' ? '🎯 ' : '📁 ') + it.title, c ? wsCircleN(c.id) + '. ' + c.title : '', `<button type="button" class="icon-btn" data-a="wsItemEdit" aria-label="Редагувати">✏️</button>`);
    h += `<div class="chips">${WS_ITEM_ORDER.map((k) => `<button type="button" class="chip${it.status === k ? ' on' : ''}" data-a="wsItemSt" data-v="${k}">${esc(d.itemSt[k])}</button>`).join('')}</div>`;
    h += `<div class="card rows">${it.owner ? `<div class="kv"><span>Відповідальна людина</span><span>${esc((wsMember(it.owner) || {}).name || '')}</span></div>` : ''}${it.due ? `<div class="kv"><span>Термін</span><span>${wsDue(it.due, it.status === 'done')}</span></div>` : ''}
      <div class="kv"><span>Змінено</span><span>${esc(fmtWhen(it.updated))}</span></div></div>`;
    if (it.desc) h += `<div class="card small wdesc">${wsText(it.desc)}</div>`;
    if (it.url) h += linkChip(it.url, '');
    const cards = d.cards.filter((x) => x.item === it.id && !x.archived);
    h += `<div class="sec">✅ Задачі · ${cards.filter((x) => x.done).length} з ${cards.length} виконано</div><button type="button" class="btn sm" data-a="wsNew" data-circle="${esc(it.circle)}" data-item="${esc(it.id)}">+ Нова задача</button>` + wsQuickAdd({ item: it.id, circle: it.circle });
    h += `<div class="col" style="gap:8px">${cards.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map((x) => wsCardTile(x, true)).join('')}</div>`;
    return h;
  }
  function wsItemFormView() {
    const W = S.ws, f = W.itf, d = W.data;
    let h = header(f.id ? 'Редагування' : (f.kind === 'goal' ? 'Нова ціль' : 'Новий проект'));
    h += `<div class="card col"><div class="seg"><button type="button" class="${f.kind === 'goal' ? 'on' : ''}" data-a="wsItfKind" data-v="goal">🎯 Ціль</button><button type="button" class="${f.kind !== 'goal' ? 'on' : ''}" data-a="wsItfKind" data-v="project">📁 Проект</button></div>
      <label class="f"><span>Назва</span><input class="in" type="text" maxlength="200" data-bind="ws.itf.title" value="${esc(f.title)}"></label>
      <label class="f"><span>Напрямок</span><select class="in" data-bind="ws.itf.circle">${d.strategy.circles.map((c, i) => `<option value="${esc(c.id)}"${c.id === f.circle ? ' selected' : ''}>${i + 1}. ${esc(c.title)}</option>`).join('')}</select></label>
      <label class="f"><span>Опис</span><textarea class="in" rows="4" maxlength="4000" data-bind="ws.itf.desc" placeholder="Що саме, як зрозуміємо, що вийшло">${esc(f.desc)}</textarea></label>
      <div class="grid2"><label class="f"><span>Відповідальна людина</span><select class="in" data-bind="ws.itf.owner"><option value="">—</option>${d.members.map((m) => `<option value="${esc(m.id)}"${m.id === f.owner ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Термін</span><input class="in" type="date" data-bind="ws.itf.due" value="${esc(f.due)}"></label></div>
      <label class="f"><span>Документ (необовʼязково)</span><input class="in" type="url" inputmode="url" placeholder="https://docs.google.com/…" data-bind="ws.itf.url" value="${esc(f.url)}"></label>
      <div class="grid2"><button type="button" class="btn" data-a="wsItemSave">${icon('check', 18)} Зберегти</button><button type="button" class="btn ghost" data-a="wsBack">Скасувати</button></div>
      ${f.id ? '<button type="button" class="btn sm ghost danger-t" data-a="wsItemDel">Видалити</button>' : ''}</div>`;
    return h;
  }
  function wsStratFormView() {
    const f = S.ws.sf;
    let h = header('Стратегія', 'Бачить уся команда простору');
    h += `<div class="card col"><label class="f"><span>Назва</span><input class="in" type="text" maxlength="120" data-bind="ws.sf.title" value="${esc(f.title)}"></label>
      <label class="f"><span>Візія (з числом цілі)</span><input class="in" type="text" maxlength="200" data-bind="ws.sf.vision" value="${esc(f.vision)}"></label>
      <label class="f"><span>Посилання на документ стратегії</span><input class="in" type="url" data-bind="ws.sf.docUrl" value="${esc(f.docUrl)}"></label>
      <div class="f"><span>Цілі</span>${f.targets.map((t, i) => `<div class="row" style="gap:8px"><input class="in" style="flex:0 0 110px" type="number" min="0" inputmode="numeric" data-bind="ws.sf.targets.${i}.n" value="${esc(t.n)}"><input class="in grow" type="text" maxlength="40" data-bind="ws.sf.targets.${i}.l" value="${esc(t.l)}"></div>`).join('')}</div>
      <div class="f"><span>Напрямки</span>${f.circles.map((c, i) => `<div class="row" style="gap:8px"><span class="wc-n" style="--cc:${WS_CC[i % WS_CC.length]}">${i + 1}</span><input class="in grow" type="text" maxlength="120" data-bind="ws.sf.circles.${i}.title" value="${esc(c.title)}"></div>`).join('')}</div>
      <div class="grid2"><button type="button" class="btn" data-a="wsStratSave">${icon('check', 18)} Зберегти</button><button type="button" class="btn ghost" data-a="wsBack">Скасувати</button></div></div>`;
    return h;
  }

  // ───── команда: люди, профілі сильних сторін, ерії, one-to-one ─────
  function wsTeamTab() {
    const W = S.ws;
    let h = `<div class="seg">${[['people', 'Люди'], ['areas', 'Ерії й команди'], ['oto', 'One-to-one']].map((x) => `<button type="button" class="${W.tteam === x[0] ? 'on' : ''}" data-a="wsTTeam" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`;
    if (W.tteam === 'people') h += wsPeopleTab();
    if (W.tteam === 'areas') h += wsAreasTab();
    if (W.tteam === 'oto') h += wsOtoTab();
    return h;
  }
  const wsProfP = (k) => { const P = S.ws.prof && S.ws.prof.profiles; return P && k ? P.people.filter((p) => p.id === k)[0] : null; };
  const wsTheme = (id) => { const P = S.ws.prof && S.ws.prof.profiles; return P ? P.themes.filter((t) => t.id === id)[0] : null; };
  const themeChip = (id, rank, plain) => { const t = wsTheme(id); if (!t) return ''; const dm = WS_DOM[t.dom] || ['', '#777']; const tag = plain ? 'span' : 'button'; return `<${tag}${plain ? '' : ' type="button" data-a="wsTheme" data-id="' + esc(id) + '"'} class="wth" style="--dc:${dm[1]}">${rank ? `<i>${rank}</i>` : ''}${esc(t.ua)}</${tag}>`; };
  function wsPeopleTab() {
    const W = S.ws, d = W.data;
    if (!S.ws.prof) { wsLoadProf(); }
    const today = ymd(new Date());
    let h = `<div class="col" style="gap:8px">${d.members.map((m) => {
      const p = wsProfP(m.pkey), a = wsAreaOf(m.area);
      const mine = d.cards.filter((c) => !c.done && !c.archived && c.who.indexOf(m.id) >= 0), late = mine.filter((c) => c.due && c.due < today).length;
      return `<button type="button" class="card wperson" data-a="wsPerson" data-id="${esc(m.id)}">${wsAva(m.id, 'lg')}<span class="grow"><span class="b" style="display:block">${esc(m.name || '—')}</span>
        <span class="xs muted">${a ? esc(a.name) : ''}${m.role === 'admin' ? (a ? ' · ' : '') + 'керує простором' : ''}</span>
        ${p ? `<span class="wths">${(p.top10 || []).slice(0, 5).map((id) => themeChip(id, 0, true)).join('')}</span>` : ''}
        <span class="xs">${mine.length ? '✅ ' + plural(mine.length, 'задача', 'задачі', 'задач') + (late ? ' · <b style="color:#b3261e">' + late + ' прострочено</b>' : '') : '<span class="muted">відкритих задач немає</span>'}</span></span></button>`;
    }).join('')}</div>`;
    if (S.ws.prof && S.ws.prof.profiles) h += '<button type="button" class="btn sm sec2" data-a="wsMatrix">🧩 Сильні сторони всієї команди</button>';
    else if (S.ws.prof) h += `<div class="xs muted center">Профілі сильних сторін ще не завантажені${d.me.admin ? ' — додай файл даних у налаштуваннях простору (кнопка вгорі)' : ''}</div>`;
    return h;
  }
  function wsPersonView() {
    const W = S.ws, d = W.data, m = wsMember(W.person);
    if (!m) { W.person = null; return VIEWS.ws(); }
    const p = wsProfP(m.pkey), a = wsAreaOf(m.area);
    let h = header(m.name || 'Учасник', a ? a.name : '');
    h += `<div class="card row" style="gap:14px">${wsAva(m.id, 'xl')}<div class="grow col" style="gap:6px">${m.username ? `<button type="button" class="linkish small" data-a="wsOpen" data-u="https://t.me/${esc(m.username)}">✈️ @${esc(m.username)}</button>` : ''}
      ${a ? `<button type="button" class="linkish small" data-a="wsAreaGo" data-k="${esc(a.key)}">📊 Аналітика ерії ${esc(a.name)}</button>` : ''}</div></div>`;
    const cards = d.cards.filter((c) => !c.archived && c.who.indexOf(m.id) >= 0);
    const open = cards.filter((c) => !c.done);
    h += `<div class="sec">✅ Задачі · ${open.length} відкритих</div>${open.length ? `<div class="col" style="gap:8px">${open.sort((x, y) => (x.due || '9').localeCompare(y.due || '9')).map((c) => wsCardTile(c, true)).join('')}</div>` : '<div class="xs muted" style="padding:0 6px">Немає відкритих задач</div>'}`;
    if (p) {
      const cnt = p.counts || {}, tot = Object.keys(WS_DOM).reduce((s, k) => s + (cnt[k] || 0), 0) || 1;
      h += `<div class="sec">Сильні сторони (CliftonStrengths)</div><div class="card col" style="gap:10px">
        <div class="wdoms">${Object.keys(WS_DOM).map((k) => `<i style="flex:${cnt[k] || 0};background:${WS_DOM[k][1]}"></i>`).join('')}</div>
        <div class="row wrap" style="gap:10px">${Object.keys(WS_DOM).map((k) => `<span class="xs"><b style="color:${WS_DOM[k][1]}">●</b> ${WS_DOM[k][0]} · ${cnt[k] || 0}</span>`).join('')}</div>
        <div class="wths">${(p.top10 || []).map((id, i) => themeChip(id, i + 1)).join('')}</div></div>`;
      (p.top5 || []).forEach((x, i) => {
        const t = wsTheme(x.theme);
        h += `<details class="card det"><summary><span class="wc-n" style="--cc:${(WS_DOM[(t || {}).dom] || ['', '#777'])[1]}">${i + 1}</span>&nbsp; ${esc((t || {}).ua || x.theme)}</summary><div class="small col" style="padding:0 16px 14px;gap:8px">${(x.ua || []).map((s) => `<div>${esc(s)}</div>`).join('')}</div></details>`;
      });
    } else if (S.ws.prof) h += '<div class="xs muted center">Профілю сильних сторін для цієї людини ще немає</div>';
    else h += loading();
    return h;
  }
  function wsMatrixView() {
    const P = S.ws.prof && S.ws.prof.profiles, d = WD_();
    if (!P) return header('Сильні сторони команди') + loading();
    const ppl = P.people;
    const rows = P.themes.map((t) => ({ t: t, n: ppl.filter((p) => (t.ranks || {})[p.id] && t.ranks[p.id] <= 10).length, avg: t.avg || 99 }))
      .sort((a, b) => b.n - a.n || a.avg - b.avg);
    let h = header('Сильні сторони команди', 'місце теми в топ-10 кожного');
    h += `<div class="row wrap" style="gap:10px">${Object.keys(WS_DOM).map((k) => `<span class="xs"><b style="color:${WS_DOM[k][1]}">●</b> ${WS_DOM[k][0]}</span>`).join('')}</div>`;
    h += `<div class="card rtab-w" style="padding:0"><table class="rtab wmx"><thead><tr><th>Тема</th>${ppl.map((p) => `<th>${esc(p.ua)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td><button type="button" class="linkish small" data-a="wsTheme" data-id="${esc(r.t.id)}"><b style="color:${(WS_DOM[r.t.dom] || ['', '#777'])[1]}">●</b> ${esc(r.t.ua)}</button></td>${ppl.map((p) => { const k = (r.t.ranks || {})[p.id]; return `<td class="${k && k <= 5 ? 'top5' : k && k <= 10 ? 'top10' : ''}">${k && k <= 10 ? k : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    return h;
  }
  function wsThemeView() {
    const t = wsTheme(S.ws.theme), P = S.ws.prof && S.ws.prof.profiles;
    if (!t) { S.ws.theme = null; return VIEWS.ws(); }
    const dm = WS_DOM[t.dom] || ['', '#777'], tx = (t.txt && t.txt.ua) || {};
    let h = header(t.ua, (t.en ? t.en + ' · ' : '') + dm[0]);
    const who = P.people.filter((p) => (t.ranks || {})[p.id] && t.ranks[p.id] <= 10).sort((a, b) => t.ranks[a.id] - t.ranks[b.id]);
    if (who.length) h += `<div class="chips">${who.map((p) => `<span class="chip" style="display:inline-flex;align-items:center">${esc(p.ua)} · <b>&nbsp;#${t.ranks[p.id]}</b></span>`).join('')}</div>`;
    if (tx.short) h += `<div class="card small" style="border-left:4px solid ${dm[1]}">${esc(tx.short)}</div>`;
    [['act', 'Як використовувати'], ['blind', 'На що зважати'], ['why', 'Чому це важливо']].forEach((x) => { if (tx[x[0]]) h += `<details class="card det"><summary>${x[1]}</summary><div class="small" style="padding:0 16px 14px;white-space:pre-line">${esc(tx[x[0]])}</div></details>`; });
    return h;
  }
  const kpi = (v, l) => `<div class="card kpi"><div class="v">${v == null ? '—' : v}</div><div class="l">${l}</div></div>`;
  function wsTot(list) {
    const t = { teams: list.length, members: 0, known: 0, clubs: 0, teens: 0, active: 0 };
    list.forEach((x) => { t.members += x.members || 0; t.known += x.known || 0; const c = x.clubs || {}; t.clubs += c.n || 0; t.teens += c.totalTeens || 0; if (c.n) t.active++; });
    t.avg = t.clubs ? df(t.teens / t.clubs) : null;
    return t;
  }
  function wsAnGate() {
    if (!S.ws.an) { wsLoadAn(); return loading(); }
    if (!S.ws.an.analytics) return '<div class="empty">Не знайшов регіону цього простору в MyYL</div>';
    return '';
  }
  function wsAreasTab() {
    const g = wsAnGate(); if (g) return g;
    const A = S.ws.an.analytics, d = WD_(), T = wsTot(A.teams);
    let h = `<div class="xs muted">Наживо з MyYL${A.region ? ' · регіон ' + esc(A.region) : ''}${A.window ? ' · клуби, малі групи й КР за ' + esc(fmtShortDay(A.window.from)) + ' – ' + esc(fmtShortDay(A.window.to)) : ''}</div>`;
    h += `<div class="kpis">${kpi(T.teams, 'команд · ' + T.active + ' з клубами')}${kpi(nf(T.members), 'людей у командах')}${kpi(nf(T.known), 'знаних по імені')}${kpi(T.clubs, 'клубів · ' + (T.avg || '—') + ' підлітків у середньому')}</div>`;
    const areas = (A.areas || []).slice().sort((a, b) => a.order - b.order).filter((a) => A.teams.some((t) => t.area === a.key));
    h += `<div class="col" style="gap:8px">${areas.map((a) => {
      const L = A.teams.filter((t) => t.area === a.key), t = wsTot(L);
      return `<button type="button" class="card warea" style="--cc:${a.color || '#6f655a'}" data-a="wsArea" data-k="${esc(a.key)}"><span class="grow"><span class="b" style="display:block">${esc(a.name)}</span><span class="xs muted">${esc(a.director)}${a.acting ? ' (в.о.)' : ''}</span>
        <span class="wnums"><span><b>${t.teams}</b> команд</span><span><b>${t.members}</b> людей</span><span><b>${t.known}</b> знаних</span><span><b>${t.clubs}</b> клубів</span><span><b>${t.avg || '—'}</b> сер.</span></span></span>${icon('chev', 18)}</button>`;
    }).join('')}</div>`;
    return h;
  }
  function wsAreaView() {
    const g = wsAnGate();
    const a = (S.ws.an && S.ws.an.analytics && (S.ws.an.analytics.areas || []).filter((x) => x.key === S.ws.area)[0]) || wsAreaOf(S.ws.area) || { key: S.ws.area, name: S.ws.area };
    if (g) return header(a.name) + g;
    const L = S.ws.an.analytics.teams.filter((t) => t.area === a.key).sort((x, y) => (y.members || 0) - (x.members || 0)), T = wsTot(L);
    let h = header(a.name, (a.director || '') + (a.acting ? ' (в.о.)' : ''));
    h += `<div class="kpis">${kpi(T.teams, 'команд')}${kpi(T.members, 'людей')}${kpi(T.known, 'знаних')}${kpi(T.clubs, 'клубів · ' + (T.avg || '—') + ' сер.')}</div>`;
    h += `<div class="row" style="gap:8px">${a.folder ? `<button type="button" class="btn sm sec2 grow" data-a="wsOpen" data-u="${esc(a.folder)}">📁 Таблиці команд MyYL</button>` : ''}${a.otoFolder ? `<button type="button" class="btn sm sec2 grow" data-a="wsOpen" data-u="${esc(a.otoFolder)}">📁 One-to-one</button>` : ''}</div>`;
    h += `<div class="card list">${L.map((t) => `<button type="button" class="li" data-a="wsTeamOpen" data-id="${esc(t.id)}"><span class="grow"><span class="b" style="display:block">${esc(t.name)}</span>
      <span class="xs muted">${t.members || 0} у команді · ${t.known || 0} знаних · клубів ${(t.clubs || {}).n || 0}${(t.clubs || {}).avgTeens != null ? ' · ' + df(t.clubs.avgTeens) + ' підлітків' : ''}</span></span>${icon('chev', 18)}</button>`).join('')}</div>`;
    return h;
  }
  function wsTeamView() {
    const A = S.ws.an && S.ws.an.analytics, t = A && A.teams.filter((x) => x.id === S.ws.team)[0];
    if (!t) { S.ws.team = null; return VIEWS.ws(); }
    const c = t.clubs || {}, ly = t.clubsLY || {};
    let h = header(t.name, (wsAreaOf(t.area) || {}).name || '');
    h += `<div class="kpis">${kpi(t.members || 0, 'у команді')}${kpi(t.known || 0, 'знаних по імені')}${kpi(c.n || 0, 'клубів за 3 міс.')}${kpi(c.avgTeens != null ? df(c.avgTeens) : '—', 'підлітків у середньому' + (ly.avgTeens != null ? ' · рік тому ' + df(ly.avgTeens) : ''))}</div>`;
    const R = t.roles || {};
    h += `<div class="card rows">${Object.keys(R).filter((k) => R[k]).map((k) => `<div class="kv"><span>${esc(k)}</span><span>${R[k]}</span></div>`).join('')}
      ${c.maxTeens != null ? `<div class="kv"><span>Найбільше на клубі</span><span>${c.maxTeens}</span></div>` : ''}${c.avgServ != null ? `<div class="kv"><span>Служать на клубі (сер.)</span><span>${df(c.avgServ)}</span></div>` : ''}
      ${c.last ? `<div class="kv"><span>Останній клуб</span><span>${esc(fmtShortDay(c.last))}</span></div>` : ''}${t.sg && t.sg.n ? `<div class="kv"><span>Малі групи</span><span>${t.sg.n} · сер. ${df(t.sg.avg)}</span></div>` : ''}
      ${t.kr && t.kr.hours ? `<div class="kv"><span>Контактна робота</span><span>${df(t.kr.hours)} год${t.kr.people ? ' · ' + plural(t.kr.people, 'людина', 'людини', 'людей') : ''}</span></div>` : ''}</div>`;
    const M = (t.monthly || []).slice(-12);
    if (M.length) {
      const mx = Math.max.apply(null, M.map((x) => x.teens || 0).concat([1]));
      h += `<div class="card col"><h2>Підлітків на клубі · по місяцях</h2><div class="chart">${M.map((x, i) => `<div class="bar${i === M.length - 1 ? ' last' : ''}"><span>${x.teens != null ? df(x.teens) : ''}</span><i style="height:${Math.round((x.teens || 0) / mx * 120)}px"></i></div>`).join('')}</div>
        <div class="chart-labels">${M.map((x) => `<span>${MSHORT[Number(x.m.slice(5, 7)) - 1]}</span>`).join('')}</div></div>`;
    }
    if (t.sheet) h += `<button type="button" class="btn sm sec2" data-a="wsOpen" data-u="${esc(t.sheet)}">📊 Таблиця команди на Диску</button>`;
    return h;
  }
  function wsOtoTab() {
    const g = wsAnGate(); if (g && !(S.ws.an && S.ws.an.oto)) return g;
    const O = S.ws.an.oto;
    if (!O || !O.files || !O.files.length) return '<div class="empty">Даних one-to-one ще немає</div>';
    const d = WD_();
    let h = O.updated ? `<div class="xs muted">${O.source === 'drive' ? 'Оновлюється з таблиць на Диску щогодини' : 'Дані з файлу'} · ${esc(fmtWhen(O.updated))}</div>` : '';
    const areas = d.areas.slice().sort((a, b) => a.order - b.order).filter((a) => O.files.some((f) => f.area === a.key));
    areas.forEach((a) => {
      const files = O.files.filter((f) => f.area === a.key && f.ok !== false);
      const ppl = [].concat.apply([], files.map((f) => (f.people || []).map((p, i) => Object.assign({ fid: f.id, i: i, group: f.group }, p))));
      const held = ppl.reduce((s, p) => s + (p.meetings || []).filter((m) => m.held).length, 0);
      h += `<div class="sec">${esc(a.name)} · зустрічей ${held} з ${ppl.length * 4}</div><div class="card list">${ppl.map((p) => {
        const ms = p.meetings || [], last = ms.filter((m) => m.held).slice(-1)[0];
        return `<button type="button" class="li" data-a="wsOtoP" data-f="${esc(p.fid)}" data-i="${p.i}"><span class="grow"><span class="b" style="display:block">${esc(p.name)}</span><span class="xs muted">${esc(p.role || p.group || '')}</span></span>
          <span class="wdots">${ms.map((m) => `<i class="${m.held ? 'on' : ''}"></i>`).join('')}</span>${last && last.total != null ? `<span class="badge">${df(last.total)}</span>` : ''}</button>`;
      }).join('') || '<div class="empty">—</div>'}</div>`;
    });
    return h;
  }
  function wsOtoPersonView() {
    const O = S.ws.an && S.ws.an.oto, k = S.ws.otoP, f = O && O.files.filter((x) => x.id === k.f)[0], p = f && f.people[k.i];
    if (!p) { S.ws.otoP = null; return VIEWS.ws(); }
    let h = header(p.name, p.role || f.group || '');
    (p.meetings || []).forEach((m, i) => {
      h += `<div class="card col" style="gap:6px"><div class="row between"><h2>Зустріч ${i + 1}</h2><span class="small ${m.held ? 'b' : 'muted'}">${m.held ? (m.date ? esc(fmtShortDay(m.date)) : 'була') : 'ще не було'}${m.total != null ? ' · ' + df(m.total) : ''}</span></div>
        ${Object.keys(m.spheres || {}).map((s) => `<div class="row" style="gap:8px"><span class="small grow">${esc(s)}</span><span class="track" style="width:90px"><i style="width:${Math.min(100, (m.spheres[s] || 0) * 10)}%;background:var(--turq)"></i></span><span class="xs b" style="width:24px;text-align:right">${df(m.spheres[s])}</span></div>`).join('')}</div>`;
    });
    if (f.id) h += `<button type="button" class="btn sm sec2" data-a="wsOpen" data-u="https://docs.google.com/spreadsheets/d/${esc(f.id)}/edit">📊 Відкрити таблицю one-to-one</button>`;
    return h;
  }

  // ───── учасники й дані простору (для тих, хто керує) ─────
  function wsMembersView() {
    const W = S.ws, d = W.data, F = W.find || {};
    let h = header('Команда простору', plural(d.members.length, 'учасник', 'учасники', 'учасників'));
    h += d.open ? `<div class="card row" style="gap:10px"><span style="font-size:22px">🔓</span><span class="grow small"><b>Відкрито для команди</b><br><span class="xs muted">учасники бачать простір і отримують повідомлення</span></span><button type="button" class="btn sm ghost" data-a="wsOpenSet" data-v="0">Закрити</button></div>`
      : `<div class="card col" style="gap:8px;border:1.5px solid var(--yellow)"><div class="small"><b>🔒 Зараз простір бачиш лише ти.</b> Учасники, яких додаси, його не бачать і повідомлень не отримують, поки ти не відкриєш.</div><button type="button" class="btn sm" data-a="wsOpenSet" data-v="1">Відкрити для команди</button></div>`;
    h += `<div class="card list">${d.members.map((m) => `<div class="li" style="flex-wrap:wrap;gap:8px">${wsAva(m.id, 'sm')}<span class="grow b">${esc(m.name || m.id)}</span>
      ${m.id !== d.me.id ? `<button type="button" class="wx" data-a="wsMemDel" data-id="${esc(m.id)}" aria-label="Прибрати">×</button>` : ''}
      <div class="grid3" style="width:100%"><select class="in" style="min-height:38px" data-ch="wsMemRole" data-id="${esc(m.id)}" aria-label="Права"><option value="member">Учасник</option><option value="admin"${m.role === 'admin' ? ' selected' : ''}>Керує</option></select>
      <select class="in" style="min-height:38px" data-ch="wsMemArea" data-id="${esc(m.id)}" aria-label="Ерія"><option value="">Ерія…</option>${d.areas.map((a) => `<option value="${esc(a.key)}"${a.key === m.area ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <select class="in" style="min-height:38px" data-ch="wsMemKey" data-id="${esc(m.id)}" aria-label="Профіль"><option value="">Профіль…</option>${(d.pnames || []).map((p) => `<option value="${esc(p.id)}"${p.id === m.pkey ? ' selected' : ''}>${esc(p.ua || p.id)}</option>`).join('')}</select></div></div>`).join('')}</div>`;
    h += `<div class="sec">Додати людину з MyYL</div><input class="in" type="search" placeholder="Імʼя або прізвище" value="${esc(F.q || '')}" data-bind="ws.find.q" data-live="wsFind">
      ${F.list == null ? '<div class="xs muted">Шукаю…</div>' : F.list.length ? `<div class="card list">${F.list.map((p) => `<button type="button" class="li" data-a="wsMemAdd" data-id="${esc(p.id)}"><span class="grow"><b>${esc(p.name)}</b><br><span class="xs muted">${esc(p.role)}</span></span><span class="chip">+ Додати</span></button>`).join('')}</div>` : `<div class="xs muted">${F.q && F.q.trim().length >= 2 ? 'Нікого не знайдено. Людина має спершу зареєструватися в MyYL.' : 'Почни вводити імʼя.'}</div>`}`;
    h += `<div class="sec">Дані простору</div><div class="card col" style="gap:8px"><div class="small">Профілі сильних сторін, фото, ерії, аналітика командних табличок і one-to-one оновлюються файлом даних (.json).</div>
      ${d.has && d.has.updated ? `<div class="xs muted">Останнє оновлення: ${esc(fmtWhen(d.has.updated))}${d.has.profiles ? ' · профілів ' + d.has.profiles : ''}${d.has.analytics ? ' · команд ' + d.has.analytics : ''}${d.has.oto ? ' · таблиць 1:1 ' + d.has.oto : ''}</div>` : '<div class="xs muted">Ще не завантажувалися</div>'}
      <label class="btn sm sec2" style="cursor:pointer">${W.imp ? 'Завантажую…' : '⬆️ Завантажити файл даних'}<input type="file" accept=".json,application/json" data-ch="wsImport" style="display:none"${W.imp ? ' disabled' : ''}></label></div>`;
    return h;
  }

  // ───── дії ─────
  // фото профілю: квадрат 360×360 JPEG, обрізаємо по центру
  A.photoPick = (d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    if (!/^image\//.test(f.type || 'image/')) return toast('Обери фото');
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const N = 360, c = document.createElement('canvas'); c.width = N; c.height = N;
        const sz = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - sz) / 2, sy = (img.naturalHeight - sz) / 2;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.drawImage(img, sx, sy, sz, sz, 0, 0, N, N);
        let data = c.toDataURL('image/jpeg', 0.85);
        if (data.length > 280000) data = c.toDataURL('image/jpeg', 0.7);
        S.phBusy = true; render();
        const r = await run(() => api('photoSet', { data: data }), 'Фото оновлено');
        S.phBusy = false;
        if (r) { S.me.photos = S.me.photos || {}; S.me.photos[String(S.me.user.id)] = r.key || r.photo; S.me.user.photo = Object.assign({}, S.me.user.photo || {}, { own: true, useTg: false }); LS.set('me', S.me); }
        render();
      };
      img.onerror = () => toast('Не вдалося відкрити це фото — спробуй інше');
      img.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  };
  // ── вигляд головної ──
  const homeD = () => S.homeDraft || (S.homeDraft = JSON.parse(JSON.stringify(homeLayout())));
  A.homeEdit = () => { S.homeEdit = true; S.homeDraft = JSON.parse(JSON.stringify(homeLayout())); render(); window.scrollTo(0, 0); };
  A.homeToggle = (d, el) => {
    const D = homeD(), i = D.hide.indexOf(d.k);
    if (el.checked && i >= 0) D.hide.splice(i, 1); else if (!el.checked && i < 0) D.hide.push(d.k);
    delete D.reset;
    haptic('light'); render();
  };
  // пересунути на одне місце серед доступних людині блоків
  const homeShift = (k, dir) => {
    const D = homeD(), av = homeAvail(), vis = D.order.filter((x) => av.indexOf(x) >= 0);
    const i = vis.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= vis.length) return;
    const a = D.order.indexOf(vis[i]), b = D.order.indexOf(vis[j]);
    D.order[a] = vis[j]; D.order[b] = vis[i];
    delete D.reset;
  };
  A.homeAdd = (d) => {
    const D = homeD(), k = 'm_' + d.k;
    if (D.order.indexOf(k) < 0) D.order.push(k);
    delete D.reset; haptic('success'); toast('Додано — внизу списку, можна пересунути');
    const y = window.scrollY; render(); window.scrollTo(0, y);
  };
  A.homeDel = (d) => {
    const D = homeD(), i = D.order.indexOf(d.k);
    if (i >= 0) D.order.splice(i, 1);
    delete D.reset; haptic('light');
    const y = window.scrollY; render(); window.scrollTo(0, y);
  };
  A.homeMove = (d) => { homeShift(d.k, Number(d.v)); haptic('light'); const y = window.scrollY; render(); window.scrollTo(0, y); };
  A.homeReset = () => { S.homeDraft = { order: HOME_DEF.map((x) => x[0]), hide: [], reset: true }; haptic('light'); render(); };
  A.homeSave = async () => {
    const D = homeD();
    S.homeBusy = true; render();
    const r = await run(() => api('homeSet', D.reset ? { reset: true } : { order: D.order, hide: D.hide }), 'Головний екран оновлено');
    S.homeBusy = false;
    if (r) { S.me.user.home = r.home; LS.set('me', S.me); S.homeEdit = false; S.homeDraft = null; window.scrollTo(0, 0); }
    render();
  };
  // перетягування блоків за ⋮⋮ (палець або миша)
  (function homeDrag() {
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.hed-grip');
      if (!h || S.screen !== 'home' || !S.homeEdit) return;
      const it = h.closest('.hed-row');
      e.preventDefault();
      drag = { it: it, box: it.parentNode, id: e.pointerId };
      it.classList.add('drag'); haptic('light');
      try { h.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const items = [...drag.box.children].filter((x) => x !== drag.it);
      const after = items.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (after) { if (drag.it.nextSibling !== after) drag.box.insertBefore(drag.it, after); } else if (drag.box.lastChild !== drag.it) drag.box.appendChild(drag.it);
    }, { passive: false });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const keys = [...drag.box.children].map((x) => x.dataset.k);
      drag.it.classList.remove('drag'); drag = null;
      const D = homeD(), rest = D.order.filter((k) => keys.indexOf(k) < 0);
      const next = keys.concat(rest);
      if (next.join() !== D.order.join()) { D.order = next; delete D.reset; haptic('light'); }
      const y = window.scrollY; render(); window.scrollTo(0, y);
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();
  A.photoTg = async (d, el) => {
    const want = !!el.checked, P = S.me.user.photo || {};
    if (!want && !P.own) { el.checked = true; toast('Спершу завантаж своє фото — кнопка нижче'); return; }
    S.phBusy = true; render();
    const r = await run(() => api('photoPref', { tg: want }), want ? 'Тепер фото з Telegram' : 'Тепер твоє фото');
    S.phBusy = false;
    if (r) { S.me.photos = S.me.photos || {}; if (r.key) S.me.photos[String(S.me.user.id)] = r.key; else delete S.me.photos[String(S.me.user.id)]; S.me.user.photo = { own: r.hasOwn, tg: r.hasTg, useTg: r.tg }; LS.set('me', S.me); }
    render();
  };
  A.photoDel = async () => {
    if (!(await confirmAsk('Прибрати своє фото?'))) return;
    const r = await run(() => api('photoSet', { remove: true }), 'Фото прибрано');
    if (r) { S.me.photos = S.me.photos || {}; if (r.key) S.me.photos[String(S.me.user.id)] = r.key; else delete S.me.photos[String(S.me.user.id)]; S.me.user.photo = Object.assign({}, S.me.user.photo || {}, { own: false, useTg: true }); LS.set('me', S.me); }
    render();
  };
  A.wsTab = (d) => { S.ws.tab = d.v; if (d.v === 'team' && !S.ws.prof) wsLoadProf(); render(); };
  A.wsBack = () => { wsBack(); };
  A.wsOpen = (d, el, e) => { if (e) e.preventDefault(); if (d.u) tg.openLink(d.u); };
  A.wsBoard = (d) => { S.ws.board = d.id; render(); };
  A.wsBoardNew = () => { S.ws.boardEdit = { title: '' }; render(); };
  A.wsBoardSave = async () => {
    const E = S.ws.boardEdit; if (!String(E.title).trim()) return toast('Назви дошку');
    const r = await run(() => api('wsBoardSave', { ws: S.ws.id, id: E.id || '', title: E.title }), 'Збережено');
    if (r) { S.ws.data = r; if (r.newBoard) S.ws.board = r.newBoard; S.ws.boardEdit = null; } render();
  };
  A.wsBoardDel = async () => {
    if (!(await confirmAsk('Видалити дошку? На ній не має бути задач.'))) return;
    const r = await run(() => api('wsBoardDelete', { ws: S.ws.id, id: S.ws.boardEdit.id }), 'Дошку видалено');
    if (r) { S.ws.data = r; S.ws.board = r.boards[0].id; S.ws.boardEdit = null; } render();
  };
  A.wsFilter = (d) => { S.ws.filter = d.v; render(); };
  A.wsFCircle = (d, el) => { S.ws.fcircle = el.value; render(); };
  A.wsView = (d) => { S.ws.view = d.v; render(); };
  A.wsShowDone = () => { S.ws.showDone = !S.ws.showDone; render(); };
  A.wsLog = () => { S.ws.log = !S.ws.log; render(); };
  A.wsArch = () => { S.ws.arch = !S.ws.arch; render(); };
  A.wsQuick = async (d) => {
    const t = String(S.ws.quick[d.col] || '').trim(); if (!t) return;
    const rp = /^_rep_(.+)$/.exec(d.col || '');
    const patch = rp ? { ws: S.ws.id, title: t, rep: rp[1] } : { ws: S.ws.id, title: t, col: d.col };
    if (S.ws.filter === 'mine') patch.who = [S.ws.data.me.id];
    if (S.ws.fcircle) patch.circle = S.ws.fcircle;
    S.ws.quick[d.col] = '';
    const r = await run(() => api('wsCardSave', patch));
    if (r) { wsPut(r); haptic('light'); } else S.ws.quick[d.col] = t;
    render();
    const i = document.querySelector('[data-bind="ws.quick.' + d.col + '"]'); if (i && r) i.focus();
  };
  A.wsCq = async (d) => {
    const t = String(S.ws.cq || '').trim(); if (!t) return;
    const r = await run(() => api('wsCardSave', { ws: S.ws.id, title: t, item: d.item || '', circle: d.circle || '' }));
    if (r) { wsPut(r); S.ws.cq = ''; haptic('light'); } render();
  };
  A.wsNew = (d) => {
    const D = WD_(), board = D.boards.filter((b) => b.id === S.ws.board)[0] || D.boards[0];
    // S.ws.board може бути «_rep» — тоді задача лягає на першу дошку, а видно її на дошці повторювальних
    S.ws.nf = { rep: S.ws.board === '_rep' ? 'week' : '', title: '', circle: (d && d.circle) || S.ws.fcircle || '', item: (d && d.item) || '', who: [D.me.id], due: '', board: board ? board.id : '', col: board ? ((board.cols.filter((k) => k.kind !== 'done')[0] || {}).id || '') : '' };
    render(); window.scrollTo(0, 0);
  };
  A.wsNfCircle = (d) => { const f = S.ws.nf; f.circle = f.circle === d.id ? '' : d.id; const it = wsItem(f.item); if (it && f.circle && it.circle !== f.circle) f.item = ''; render(); };
  A.wsNfWho = (d) => { const w = S.ws.nf.who, i = w.indexOf(d.id); if (i >= 0) w.splice(i, 1); else w.push(d.id); render(); };
  A.wsNfSave = async () => {
    const f = S.ws.nf;
    if (!String(f.title).trim()) return toast('Напиши, що треба зробити');
    if (S.ws.nfBusy) return;
    S.ws.nfBusy = true;
    const r = await run(() => api('wsCardSave', { ws: S.ws.id, title: f.title, board: f.board, col: f.col, circle: f.circle, item: f.item, who: f.who, due: f.due, rep: f.rep || '' }));
    S.ws.nfBusy = false;
    if (!r) return render();
    wsPut(r);
    // назад у задачі: без форм і вкладених екранів, на дошці з новою задачею
    const W = S.ws;
    ['nf', 'open', 'cf', 'circle', 'item', 'itf', 'sf', 'person', 'theme', 'area', 'team', 'otoP', 'page', 'pd', 'pe', 'colEdit', 'boardEdit'].forEach((k) => { W[k] = null; });
    W.matrix = false; W.members = false; W.tab = 'board'; W.board = r.rep ? '_rep' : (r.board || W.board); W.arch = false;
    if (W.filter === 'mine' && r.who.indexOf(WD_().me.id) < 0) W.filter = 'all';
    if (W.fcircle && W.fcircle !== r.circle) W.fcircle = '';
    render(); window.scrollTo(0, 0);
    const others = r.who.filter((id) => id !== WD_().me.id);
    wsSent('Задача надіслана', others.length && WD_().open === false ? 'Простір поки закритий — повідомлення в боті не надсилаються' : others.length ? (others.length === 1 ? (wsFirst(others[0]) || 'Виконавець') + ' отримає повідомлення в боті' : plural(others.length, 'виконавець отримає', 'виконавці отримають', 'виконавців отримають') + ' повідомлення в боті') : 'Задачу додано тобі');
    setTimeout(() => {
      const el = document.querySelector('[data-a="wsCardOpen"][data-id="' + r.id + '"]');
      const card = el && el.closest('.wcard');
      if (card) { try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch (e) { /* ок */ } card.classList.add('wflash'); }
    }, 120);
  };
  // підтвердження посеред екрана
  function wsSent(title, sub) {
    haptic('success');
    const old = document.querySelector('.wsent'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="wsent" role="status" aria-live="polite"><div class="wsent-b"><div class="wsent-i">✓</div><div class="wsent-t">${esc(title)}</div>${sub ? `<div class="wsent-s">${esc(sub)}</div>` : ''}</div></div>`);
    const box = document.querySelector('.wsent');
    const close = () => { if (box && box.parentNode) { box.classList.add('out'); setTimeout(() => box.remove(), 220); } };
    box.addEventListener('click', close);
    setTimeout(close, 1700);
  }
  A.wsColNew = () => { S.ws.colEdit = { board: S.ws.board, title: '' }; render(); };
  A.wsColEdit = (d) => { const c = wsCol(d.id); S.ws.colEdit = { id: c.id, title: c.title, done: c.kind === 'done' }; render(); };
  A.wsColSave = async () => {
    const E = S.ws.colEdit; if (!String(E.title).trim()) return toast('Назви колонку');
    const r = await run(() => api('wsColSave', Object.assign({ ws: S.ws.id, title: E.title }, E.id ? { id: E.id, done: !!E.done } : { board: E.board })), 'Збережено');
    if (r) { S.ws.data = r; S.ws.colEdit = null; } render();
  };
  A.wsColShift = async (d) => { const r = await run(() => api('wsColSave', { ws: S.ws.id, id: S.ws.colEdit.id, shift: Number(d.v) })); if (r) { S.ws.data = r; S.ws.colEdit = null; } render(); };
  A.wsColDel = async () => {
    if (!(await confirmAsk('Видалити колонку?'))) return;
    const r = await run(() => api('wsColDelete', { ws: S.ws.id, id: S.ws.colEdit.id }), 'Колонку видалено');
    if (r) { S.ws.data = r; S.ws.colEdit = null; } render();
  };
  A.wsCardOpen = (d) => { S.ws.open = d.id; S.ws.cc = null; S.ws.cf = null; S.ws.cmt = ''; S.ws.chk = ''; S.ws.linkOpen = false; render(); window.scrollTo(0, 0); wsLoadCard(d.id); };
  A.wsCardEdit = () => { const c = wsCard(S.ws.open); S.ws.cf = { title: c.title, desc: c.desc }; render(); };
  A.wsCardEditSave = async () => { const f = S.ws.cf; if (!String(f.title).trim()) return toast('Назва не може бути порожньою'); const r = await wsSave({ title: f.title, desc: f.desc }, 'Збережено'); if (r) { S.ws.cf = null; render(); } };
  async function wsTickRun(id) {
    const c = wsCard(id); if (!c) return;
    const was = wsTickOn(c);
    const r = await run(() => api('wsTick', { ws: S.ws.id, id: id }));
 if (r && r.repN > (c.repN || 0)) { wsPut(r); haptic('success'); toast('Виконано ✓ Наступного разу: ' + fmtShortDay(r.due)); render(); return; }
    if (r) { wsPut(r); haptic(was ? 'light' : 'success'); if (!was) toast(r.done ? (r.who.length > 1 ? 'Виконали всі — задача в архіві 🙌' : 'Виконано — задача в архіві 🙌') : 'Твою частину відмічено ✓'); }
    render();
  }
  A.wsDone = () => wsTickRun(S.ws.open);
  A.wsCardTick = (d) => wsTickRun(d.id);
  A.wsMove = (d) => wsSave({ col: d.id });
  A.wsWho = (d) => { const c = wsCard(S.ws.open), w = c.who.slice(), i = w.indexOf(d.id); if (i >= 0) w.splice(i, 1); else w.push(d.id); return wsSave({ who: w }); };
  A.wsDueSet = (d, el) => wsSave({ due: el.value || '' });
  A.wsDueClear = () => wsSave({ due: '' });
  A.wsCircleSet = (d, el) => wsSave({ circle: el.value });
  A.wsRepSet = (d, el) => wsSave({ rep: el.value }, el.value ? 'Задача тепер повторювальна — вона на дошці «🔁 Повторювальні»' : 'Повтор вимкнено');
  A.wsItemSet = (d, el) => wsSave({ item: el.value });
  A.wsChk = (d) => { const c = wsCard(S.ws.open), k = c.check.map((x) => Object.assign({}, x)); k[d.i].d = !k[d.i].d; return wsSave({ check: k }); };
  A.wsChkDel = (d) => { const c = wsCard(S.ws.open), k = c.check.slice(); k.splice(Number(d.i), 1); return wsSave({ check: k }); };
  A.wsChkAdd = async () => {
    const t = String(S.ws.chk || '').trim(); if (!t) return;
    const c = wsCard(S.ws.open); S.ws.chk = '';
    const r = await wsSave({ check: c.check.concat([{ t: t, d: false }]) });
    if (!r) S.ws.chk = t; else { const i = document.querySelector('[data-bind="ws.chk"]'); if (i) i.focus(); }
  };
  A.wsLinkToggle = () => { S.ws.linkOpen = !S.ws.linkOpen; S.ws.link = { u: '', t: '' }; render(); };
  A.wsLinkAdd = async () => {
    const L = S.ws.link, u = String(L.u || '').trim();
    if (!/^https?:\/\//i.test(u)) return toast('Встав повне посилання, що починається з https://');
    const r = await wsSave({ addLink: { u: u, t: L.t } }, 'Прикріплено');
    if (r) { S.ws.linkOpen = false; S.ws.link = { u: '', t: '' }; render(); }
  };
  A.wsLinkDel = async (d) => { if (!(await confirmAsk('Відкріпити посилання?'))) return; const c = wsCard(S.ws.open), L = c.links.slice(); L.splice(Number(d.i), 1); return wsSave({ links: L }); };
  A.wsCmt = async () => {
    const t = String(S.ws.cmt || '').trim(); if (!t) return;
    const r = await run(() => api('wsComment', { ws: S.ws.id, card: S.ws.open, text: t }));
    if (r) { S.ws.cmt = ''; S.ws.cc = r.comments; wsPut(r.card); haptic('light'); } render();
  };
  A.wsCmtDel = async (d) => {
    if (!(await confirmAsk('Видалити коментар?'))) return;
    const r = await run(() => api('wsCommentDelete', { ws: S.ws.id, card: S.ws.open, id: d.id }));
    if (r) { S.ws.cc = r.comments; if (r.card) wsPut(r.card); } render();
  };
  A.wsShift = (d) => wsSave({ shift: Number(d.v) });
  A.wsArchive = async () => { const c = wsCard(S.ws.open); const r = await wsSave({ archived: !c.archived }, c.archived ? 'Повернуто з архіву' : 'Перенесено в архів'); if (r && r.archived) { S.ws.open = null; render(); } };
  A.wsCardDel = async () => {
    const c = wsCard(S.ws.open);
    if (!(await confirmAsk('Видалити задачу «' + c.title + '» разом з коментарями?'))) return;
    const r = await run(() => api('wsCardDelete', { ws: S.ws.id, id: c.id }), 'Задачу видалено');
    if (r) { WD_().cards = WD_().cards.filter((x) => x.id !== c.id); wsMineSync(); S.ws.open = null; } render();
  };
  // сторінки
  A.wsPq = () => { clearTimeout(A.wsPq.t); A.wsPq.t = setTimeout(() => { render(); const i = document.querySelector('[data-live="wsPq"]'); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* ок */ } } }, 250); };
  A.wsPageOpen = (d) => { S.ws.tab = 'pages'; S.ws.page = d.id; S.ws.pd = null; S.ws.pe = null; render(); window.scrollTo(0, 0); wsLoadPage(d.id); };
  A.wsPageNew = (d) => { S.ws.pe = { id: '', parent: d.parent || '', title: '', icon: '📄', body: '', base: '' }; render(); window.scrollTo(0, 0); };
  A.wsPageEdit = () => { const p = S.ws.pd.page; S.ws.pe = { id: p.id, parent: p.parent, title: p.title, icon: p.icon || '📄', body: p.body, base: p.updated }; render(); };
  A.wsPageIcon = (d) => { S.ws.pe.icon = d.v; render(); };
  A.wsIns = (d) => {
    const ta = document.getElementById('wsBody'); if (!ta) return;
    const v = ta.value, s = ta.selectionStart || 0, e = ta.selectionEnd || s;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    const PRE = { h: '# ', li: '- ', chk: '- [ ] ', q: '> ' };
    let nv, pos;
    if (PRE[d.v]) { nv = v.slice(0, ls) + PRE[d.v] + v.slice(ls); pos = s + PRE[d.v].length; }
    else if (d.v === 'hr') { const ins = (s && v[s - 1] !== '\n' ? '\n' : '') + '---\n'; nv = v.slice(0, s) + ins + v.slice(e); pos = s + ins.length; }
    else { const sel = v.slice(s, e) || 'назва'; const ins = '[' + sel + '](https://)'; nv = v.slice(0, s) + ins + v.slice(e); pos = s + ins.length - 1; }
    ta.value = nv; S.ws.pe.body = nv; ta.focus(); try { ta.setSelectionRange(pos, pos); } catch (x) { /* ок */ }
  };
  A.wsPageSave = async () => {
    const E = S.ws.pe;
    try {
      const r = await api('wsPageSave', { ws: S.ws.id, id: E.id, parent: E.parent, title: E.title, icon: E.icon, body: E.body, base: E.base });
      toast('Збережено', 'success');
      S.ws.pe = null; S.ws.page = r.page.id; S.ws.pd = r;
      wsLoad(true);
    } catch (e) {
      if (e.code === 'conflict') {
        // хтось змінив сторінку: показуємо свіжу версію поруч не затираючи — текст людини лишається в редакторі
        E.conflict = e.message;
        try { const fresh = await api('wsPage', { ws: S.ws.id, id: E.id }); E.base = fresh.page.updated; S.ws.pd = fresh; E.conflict += '\n\nСвіжа версія: «' + String(fresh.page.body).slice(0, 300) + (fresh.page.body.length > 300 ? '…' : '') + '». Натисни «Зберегти» ще раз, щоб записати свою.'; } catch (x) { /* ок */ }
        haptic('error');
      } else toast(e.message, 'error');
    }
    render(); window.scrollTo(0, 0);
  };
  A.wsTick = async (d) => {
    const P = S.ws.pd; if (!P) return;
    const L = String(P.page.body).split('\n'), i = Number(d.l);
    L[i] = L[i].replace(/\[( |x|X)\]/, (m, x) => (x === ' ' ? '[x]' : '[ ]'));
    const body = L.join('\n'), old = P.page.body;
    P.page.body = body; render();
    try { const r = await api('wsPageSave', { ws: S.ws.id, id: P.page.id, parent: P.page.parent, title: P.page.title, icon: P.page.icon, body: body, base: P.page.updated }); S.ws.pd = r; haptic('light'); }
    catch (e) { P.page.body = old; toast(e.code === 'conflict' ? 'Сторінку щойно змінили — оновлюю' : e.message, 'error'); if (e.code === 'conflict') wsLoadPage(P.page.id); }
    render();
  };
  A.wsPageDel = async () => {
    const p = S.ws.pd.page, n = WD_().pages.filter((x) => x.parent === p.id).length;
    if (!(await confirmAsk('Видалити сторінку «' + p.title + '»' + (n ? ' разом з підсторінками' : '') + '?'))) return;
    const r = await run(() => api('wsPageDelete', { ws: S.ws.id, id: p.id }), 'Видалено');
    if (r) { S.ws.page = r.parent || null; S.ws.pd = null; if (r.parent) wsLoadPage(r.parent); wsLoad(true); } render();
  };
  // стратегія
  A.wsCircle = (d) => { S.ws.circle = d.id; S.ws.cq = ''; render(); window.scrollTo(0, 0); };
  A.wsItemOpen = (d) => { const it = wsItem(d.id); S.ws.tab = 'strategy'; if (it) S.ws.circle = it.circle || S.ws.circle; S.ws.item = d.id; S.ws.cq = ''; render(); window.scrollTo(0, 0); };
  A.wsItemNew = (d) => { S.ws.itf = { id: '', kind: d.k || 'project', circle: S.ws.circle || WD_().strategy.circles[0].id, title: '', desc: '', status: 'plan', owner: '', due: '', url: '' }; render(); };
  A.wsItemEdit = () => { const it = wsItem(S.ws.item); S.ws.itf = Object.assign({}, it); render(); };
  A.wsItfKind = (d) => { S.ws.itf.kind = d.v; render(); };
  A.wsItemSave = async () => {
    const f = S.ws.itf; if (!String(f.title).trim()) return toast('Напиши назву');
    const r = await run(() => api('wsItemSave', Object.assign({ ws: S.ws.id }, f)), 'Збережено');
    if (r) { S.ws.data = r.ws; S.ws.itf = null; S.ws.item = r.item.id; S.ws.circle = r.item.circle; } render();
  };
  A.wsItemSt = async (d) => { const it = wsItem(S.ws.item); const r = await run(() => api('wsItemSave', Object.assign({ ws: S.ws.id }, it, { status: d.v }))); if (r) { S.ws.data = r.ws; haptic('light'); } render(); };
  A.wsItemDel = async () => {
    if (!(await confirmAsk('Видалити? Задачі лишаться, але відвʼяжуться.'))) return;
    const r = await run(() => api('wsItemDelete', { ws: S.ws.id, id: S.ws.itf.id }), 'Видалено');
    if (r) { S.ws.data = r; S.ws.itf = null; S.ws.item = null; } render();
  };
  A.wsStratEdit = () => { const s = WD_().strategy; S.ws.sf = JSON.parse(JSON.stringify({ title: s.title, vision: s.vision, docUrl: s.docUrl, targets: s.targets, circles: s.circles })); render(); };
  A.wsStratSave = async () => { const r = await run(() => api('wsStrategySave', Object.assign({ ws: S.ws.id }, S.ws.sf)), 'Стратегію збережено'); if (r) { S.ws.data = r; S.ws.sf = null; } render(); };
  // команда
  A.wsTTeam = (d) => { S.ws.tteam = d.v; render(); };
  A.wsPerson = (d) => { S.ws.person = d.id; render(); window.scrollTo(0, 0); };
  A.wsTheme = (d) => { S.ws.theme = d.id; render(); window.scrollTo(0, 0); };
  A.wsMatrix = () => { S.ws.matrix = true; render(); window.scrollTo(0, 0); };
  A.wsArea = (d) => { S.ws.area = d.k; render(); window.scrollTo(0, 0); };
  A.wsAreaGo = (d) => { S.ws.tab = 'team'; S.ws.tteam = 'areas'; S.ws.person = null; S.ws.area = d.k; render(); window.scrollTo(0, 0); };
  A.wsTeamOpen = (d) => { S.ws.team = d.id; render(); window.scrollTo(0, 0); };
  A.wsOtoP = (d) => { S.ws.otoP = { f: d.f, i: Number(d.i) }; render(); window.scrollTo(0, 0); };
  // учасники
  A.wsMembers = () => { S.ws.members = true; S.ws.find = { q: '', list: null }; render(); wsFindRun(); };
  async function wsFindRun() {
    const F = S.ws.find; if (!F) return;
    const q = F.q || '';
    try { const L = await api('wsPeopleFind', { ws: S.ws.id, q: q }); if (S.ws.find && S.ws.find.q === q) S.ws.find.list = L; } catch (e) { if (S.ws.find) S.ws.find.list = []; }
    if (S.screen === 'ws' && S.ws.members) { render(); const i = document.querySelector('[data-live="wsFind"]'); if (i && q) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* ок */ } } }
  }
  A.wsFind = () => { clearTimeout(A.wsFind.t); A.wsFind.t = setTimeout(wsFindRun, 350); };
  A.wsMemAdd = async (d) => { const r = await run(() => api('wsMemberSave', { ws: S.ws.id, id: d.id }), 'Додано — людина отримала повідомлення'); if (r) { S.ws.data = r; S.ws.find.list = (S.ws.find.list || []).filter((x) => x.id !== d.id); } render(); };
  A.wsOpenSet = async (d) => {
    const on = d.v === '1', n = WD_().members.length - 1;
    if (!(await confirmAsk(on ? 'Відкрити простір для команди? ' + (n ? plural(n, 'учасник отримає', 'учасники отримають', 'учасників отримають') + ' запрошення в боті.' : 'Учасників ще немає.') : 'Закрити простір? Учасники перестануть його бачити, дані лишаться.'))) return;
    const r = await run(() => api('wsOpen', { ws: S.ws.id, on: on }), on ? 'Простір відкрито для команди' : 'Простір закрито — бачиш лише ти');
    if (r) S.ws.data = r; render();
  };
  A.wsMemDel = async (d) => { const m = wsMember(d.id); if (!(await confirmAsk('Прибрати ' + (m ? m.name : '') + ' з простору?'))) return; const r = await run(() => api('wsMemberRemove', { ws: S.ws.id, id: d.id }), 'Прибрано'); if (r) S.ws.data = r; render(); };
  const memSet = async (id, patch) => { const r = await run(() => api('wsMemberSave', Object.assign({ ws: S.ws.id, id: id }, patch)), 'Збережено'); if (r) S.ws.data = r; render(); };
  A.wsMemRole = (d, el) => memSet(d.id, { role: el.value });
  A.wsMemArea = (d, el) => memSet(d.id, { area: el.value });
  A.wsMemKey = (d, el) => memSet(d.id, { pkey: el.value });
  A.wsImport = (d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) return toast('Файл завеликий');
    const rd = new FileReader();
    rd.onload = async () => {
      let obj; try { obj = JSON.parse(String(rd.result)); } catch (e) { return toast('Це не файл даних (.json)'); }
      S.ws.imp = true; render();
      const r = await run(() => api('wsImport', Object.assign({ ws: S.ws.id }, obj)));
      S.ws.imp = false;
      if (r) { S.ws.data = r.ws; S.ws.prof = null; S.ws.an = null; toast('Оновлено: ' + r.got.join(', '), 'success'); wsLoadProf(); }
      render();
    };
    rd.readAsText(f);
  };
  // Enter у полі швидкого додавання
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.key !== 'Enter' || !el || !el.dataset || !el.dataset.enter || e.isComposing) return;
    e.preventDefault();
    const fn = A[el.dataset.enter]; if (fn) fn(el.dataset, el, e);
  });
  // головна: мої задачі в робочих просторах
  function wsHomeCard() {
    // як «Наш клуб» у капітанів: картка простору на головній для його учасників
    return ((S.me && S.me.ws) || []).map((w) => {
      const next = (w.next || []).slice(0, 3);
      return `<div class="card cl-home wshome"><button type="button" class="wsh-top" data-a="tabGo" data-s="ws"><span class="cl-h">🗂 Робочий простір</span><span class="xs muted">${esc(w.name)}</span></button>
        <button type="button" class="wsh-top" data-a="tabGo" data-s="ws"><span class="cl-topic">${w.open ? plural(w.open, 'задача', 'задачі', 'задач') + ' на тобі' : 'Відкритих задач на тобі немає'}</span></button>
        ${w.late || w.soon ? `<div class="cl-meta">${w.late ? `<span style="color:#b3261e">⚠️ прострочено: ${w.late}</span>` : ''}${w.soon ? `<span>🔥 дедлайн скоро: ${w.soon}</span>` : ''}</div>` : ''}
        ${next.length ? `<div class="col" style="gap:6px">${next.map((c) => `<div class="wsh-task"><button type="button" class="wtick" data-a="wsHomeTick" data-w="${esc(w.id)}" data-id="${esc(c.id)}" aria-label="Виконано"></button><button type="button" class="wopen row" data-a="wsHomeTask" data-id="${esc(c.id)}"><span class="grow">${esc(c.title)}</span>${wsDue(c.due, false)}</button></div>`).join('')}</div>` : ''}
        <div class="wsh-go">${[['board', '✅ Задачі'], ['pages', '📄 Сторінки'], ['strategy', '🎯 Стратегія'], ['team', '👥 Команда']].map((x) => `<button type="button" data-a="wsHomeTab" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>`;
    }).join('');
  }
  A.wsHomeTab = (d) => { S.ws.tab = d.v; go('ws'); };
  A.wsHomeTask = (d) => { go('ws', { card: d.id }); };
  A.wsHomeTick = async (d) => {
    const r = await run(() => api('wsTick', { ws: d.w, id: d.id }));
    if (!r) return;
    haptic('success'); toast(r.rep && !r.done && !(r.doneBy || []).length ? 'Виконано ✓ Наступного разу: ' + fmtShortDay(r.due) : r.done ? 'Виконано — задача в архіві 🙌' : 'Твою частину відмічено ✓');
    const w = (S.me.ws || []).filter((x) => x.id === d.w)[0];
    if (w) { w.next = (w.next || []).filter((x) => x.id !== d.id); w.open = Math.max(0, (w.open || 1) - 1); }
    if (WD_() && WD_().id === d.w) wsPut(r);
    render();
  };
  // посилання з бота: wsc_<задача>, wsp_<сторінка>
  function wsWant(want) {
    let m;
    if (!S.me || !(S.me.ws || []).length) return false;
    if ((m = /^wsc_([A-Za-z0-9]+)$/.exec(want))) { go('ws', { card: m[1] }); return true; }
    if ((m = /^wsp_([A-Za-z0-9]+)$/.exec(want))) { go('ws', { page: m[1] }); return true; }
    return false;
  }

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
  // вхід поза Telegram: питаємо обидві адреси сервера одночасно, береться перша, що відповіла; кілька спроб
  async function authCall(p, body) {
    const hosts = [API_URL].concat(API_HOSTS.filter((h) => h !== API_URL));
    const one = (h) => Promise.race([
      fetch(h.replace(/\/+$/, '') + '/auth/' + p, { method: 'POST', body: JSON.stringify(body || {}), cache: 'no-store' }).then((r) => r.json()).then((j) => ({ h: h, j: j })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ]);
    const anyOf = (ps) => new Promise((res, rej) => { let n = ps.length; ps.forEach((x) => x.then(res, () => { if (--n === 0) rej(new Error('net')); })); });
    let last;
    for (let t = 0; t < 3; t++) {
      try {
        const r = await anyOf(hosts.map(one));
        if (r.h !== API_URL) { API_URL = r.h; try { localStorage.setItem('yl:apiHost', API_URL); } catch (e) { /* ок */ } }
        return r.j;
      } catch (e) { last = e; await new Promise((res) => setTimeout(res, 800 * (t + 1))); }
    }
    try { clog({ a: 'auth/' + p, err: String(last && last.message || last), tg: 'pwa' }); } catch (e) { /* ок */ }
    throw last;
  }
  function logout(expired) {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ок */ }
    SESSION = null; S.me = null;
    renderLogin(expired ? 'Сесія завершилась. Увійди ще раз.' : '');
  }
  function renderLogin(msg) {
    const L = S.login;
    $app.innerHTML = `<main class="main no-nav login"><div class="login-box">
      <img src="icons/icon-192.png?v=6" alt="" class="login-logo" width="88" height="88">
      <h1 style="font-size:28px;margin:0">MyYL</h1><div class="muted">Young Life Україна</div>
      ${msg ? `<div class="note small">${esc(msg)}</div>` : ''}
      ${L ? `<div class="card col" style="gap:10px;text-align:center"><div class="spin" style="margin:0 auto"></div>
          <div class="b">Чекаю підтвердження в Telegram…</div>
          <div class="small muted">У чаті з ботом натисни <b>«Старт»</b> (або «Запустити»), а потім повернись сюди.</div>
          <a class="btn sec2 sm" href="${esc(L.link)}" target="_blank" rel="noopener">Не відкрився Telegram? Натисни тут</a>
          <button type="button" class="link-btn" data-a="loginCancel">Скасувати</button></div>`
        : `<button type="button" class="btn" data-a="loginStart"${S.loginBusy ? ' disabled' : ''}>${S.loginBusy ? 'Зʼєднуюсь із сервером…' : icon('tg', 20) + ' Увійти через Telegram'}</button>
          <div class="small muted" style="text-align:center">Відкриється наш бот у Telegram — підтвердь вхід одним натисканням. Пароль не потрібен.</div>`}
      ${!IS_INSTALLED ? `<div class="xs muted" style="text-align:center;margin-top:8px">Порада: додай MyYL на головний екран — ${IS_IOS ? 'Safari → «Поділитися» → «На початковий екран»' : 'меню браузера → «Встановити застосунок»'}.</div>` : ''}
    </div></main>`;
  }
  async function loginStart() {
    let r;
    S.loginBusy = true; renderLogin();
    try { r = await authCall('start', {}); } catch (e) { S.loginBusy = false; return renderLogin('Не вдалося зʼєднатися з сервером. Перевір інтернет (або вимкни VPN / «Допомога Wi‑Fi») і спробуй ще раз.'); }
    S.loginBusy = false;
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
      const r = await authCall('poll', { nonce: L.nonce });
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
  // ── потягни вниз — оновити поточний екран ──
  const PULL_RELOAD = {
    ws: () => Promise.all([wsLoad(true), S.ws.open ? wsLoadCard(S.ws.open) : null, S.ws.page && !S.ws.pe ? wsLoadPage(S.ws.page) : null]),
    home: () => Promise.all([refreshMe(), loadEvents()]), more: refreshMe, calendar: loadEvents, stats: loadStats, known: () => loadKnown(true), team: loadTeam, finance: loadFin,
    requests: loadReqs, perms: loadPerms, inst: loadInst, mystats: loadMyStats, ach: loadAch, bugs: loadBugs, dupes: loadDupes, res: loadRes, dirs: loadDirs,
    tasks: loadTasks, polls: loadPolls, myyl: loadMyyl, structure: loadTree, pending: refreshMe, bank: loadBank, club: () => (S.club.dirty ? null : loadClub()), clubIdeas: () => reloadIdeas(),
  };
  async function pullRefresh() {
    const f = PULL_RELOAD[S.screen];
    S.statsMem = {}; S.knownMem = {};
    try { await Promise.all([f ? f() : refreshMe(), S.screen === 'home' || S.screen === 'more' ? null : refreshMe()]); } catch (e) { /* лоадери самі показують помилку */ }
    if (S.me && S.me.status === 'active') LS.set('me', S.me);
    if (S.me && S.me.status === 'active' && (S.screen === 'pending' || S.screen === 'onboarding')) { S.screen = 'home'; }
    if (safeToRender()) render();
  }
  (function pullToRefresh() {
    const MAX = 110, NEED = 72;
    let ind = null, y0 = 0, x0 = 0, dy = 0, on = false, busy = false;
    const el = () => { if (!ind) { ind = document.createElement('div'); ind.className = 'ptr'; ind.innerHTML = '<span class="ptr-c"><img src="icons/yl-mark.png" alt="" width="24" height="24"></span>'; document.body.appendChild(ind); } return ind; };
    const set = (d, anim) => { const i = el(); i.style.transition = anim ? 'transform .3s var(--spring), opacity .3s' : 'none'; i.style.opacity = d > 4 ? Math.min(1, d / NEED) : 0; i.style.transform = `translate(-50%, ${d - 46}px)`; i.firstChild.style.transform = `rotate(${d * 3.2}deg)`; i.classList.toggle('ready', d >= NEED); };
    setTimeout(el, 1200); // логотип завантажується заздалегідь, щоб у першому свайпі не було порожнього кружечка
    const blocked = (t) => !S.me || !S.me.status || document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) ||
      (t && t.closest && t.closest('.sheet, .modal, .overlay, [data-noptr], .hscroll, .seg-scroll, .cat-strip, .chips, .tabs-scroll'));
    document.addEventListener('touchstart', (e) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) { on = false; return; }
      on = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!on) return;
      const ry = e.touches[0].clientY - y0, rx = Math.abs(e.touches[0].clientX - x0);
      if (ry <= 0 || window.scrollY > 0 || (dy === 0 && rx > ry)) { if (dy > 0) set(0, true); on = dy > 0 && ry > 0; dy = 0; return; }
      dy = Math.min(MAX, ry * 0.5);
      if (e.cancelable) e.preventDefault();
      set(dy);
    }, { passive: false });
    const end = async () => {
      if (!on) return; on = false;
      if (dy < NEED) { set(0, true); dy = 0; return; }
      busy = true; haptic('success'); set(56, true); el().classList.add('spin');
      const t0 = Date.now();
      await pullRefresh();
      await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - t0))));
      el().classList.remove('spin'); set(0, true); dy = 0; busy = false;
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  })();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; if (S.screen === 'install') render(); });

  // ───────────── СТАРТ ─────────────
  // iOS ігнорує user-scalable=no: жест масштабування блокуємо вручну, подвійний дотик — через touch-action у стилях
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
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
    // гортання довгих списків не має згортати застосунок у Telegram
    try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { /* старий Telegram */ }
    if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
    // шапка й фон Telegram — у тон скляного фону
    const paint = () => {
      const dark = tg.colorScheme === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      try { tg.setHeaderColor(dark ? '#16121a' : '#fff3ea'); } catch (e) { try { tg.setHeaderColor('secondary_bg_color'); } catch (e2) { /* старий Telegram */ } }
      try { tg.setBackgroundColor && tg.setBackgroundColor(dark ? '#16121a' : '#fff3ea'); } catch (e) { /* ок */ }
      try { tg.setBottomBarColor && tg.setBottomBarColor(dark ? '#16121a' : '#fff3ea'); } catch (e) { /* ок */ }
    };
    paint();
    tg.onEvent('themeChanged', paint);
    // повноекранний Telegram: кнопки Close / ⌄ / ⋯ лежать поверх застосунку — відсуваємо вміст нижче
    const safeTop = () => {
      const a = (tg.safeAreaInset && tg.safeAreaInset.top) || 0;
      let b = (tg.contentSafeAreaInset && tg.contentSafeAreaInset.top) || 0;
      if (tg.isFullscreen && !b) b = 52;
      document.documentElement.style.setProperty('--top-safe', (tg.isFullscreen ? a + b : 0) + 'px');
    };
    safeTop();
    ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'].forEach((ev) => { try { tg.onEvent(ev, safeTop); } catch (e) { /* старий Telegram */ } });
    tg.BackButton.onClick(back);
    if (!IN_TG) { if (!API_URL) return; return loadMe(); }
    S.homeSt = '';
    if (tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
      try { tg.checkHomeScreenStatus((st) => { S.homeSt = st; if (S.screen === 'more' || S.screen === 'install') render(); }); } catch (e) { /* ок */ }
      tg.onEvent('homeScreenAdded', () => { S.homeSt = 'added'; toast('Готово! Іконка YL тепер на головному екрані', 'success'); if (S.screen === 'more' || S.screen === 'install') render(); });
      // цей запуск не вміє додати іконку (відкрито не як головний застосунок бота) — відкриваємо головний з пропозицією
      tg.onEvent('homeScreenFailed', () => { if (S.homeWait && Date.now() - S.homeWait < 15000) { S.homeWait = 0; viaLink(); } });
    } else S.homeSt = 'unsupported';
    if (!API_URL) {
      $app.innerHTML = '<main class="main no-nav"><div class="card col"><h2>Застосунок ще налаштовується</h2><div class="muted">Адресу сервера не вказано в config.js.</div></div></main>';
      return;
    }
    loadMe();
  }
  start();
})();
