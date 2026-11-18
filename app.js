/* Young Life Україна · Mini App · інтерфейс */
(function () {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
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
    known: { teamId: null, list: null, mine: false, detail: null, edit: null },
    team: { teamId: null, list: null, open: null },
    fin: { teamId: null, month: ym(new Date()), data: null, cur: null },
    reqs: null, reqSel: {},
    reg: { step: 1, name: '', phone: '', email: '', regionId: '', areaId: '', teamId: '', newTeam: '', roles: {}, upper: false },
    roleReq: null, profile: null,
  };
  let toastTimer = null;

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
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ initData: tg.initData, action: action, data: data || {} }) });
      const j = await res.json();
      if (!j.ok) { const e = new Error(j.message || 'Помилка'); e.code = j.error; throw e; }
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
  const myLine = () => (S.me.user.title || roleLine());
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
    if (S.screen === 'known' && (S.known.detail || S.known.edit)) { if (S.known.edit && S.known.detail) S.known.edit = null; else { S.known.detail = null; S.known.edit = null; } return render(); }
    if (S.screen === 'profile' && S.roleReq) { S.roleReq = null; return render(); }
    if (S.screen === 'onboarding' && S.reg.step > 1) { S.reg.step--; return render(); }
    S.screen = S.stack.pop() || 'home';
    render();
  }
  function canBack() {
    return S.stack.length > 0 || (S.screen === 'calendar' && (S.ev || S.evForm)) || (S.screen === 'known' && (S.known.detail || S.known.edit)) ||
      (S.screen === 'profile' && S.roleReq) || (S.screen === 'onboarding' && S.reg.step > 1);
  }
  function syncBack() {
    if (!tg || !tg.BackButton) return;
    if (canBack()) tg.BackButton.show(); else tg.BackButton.hide();
  }

  function enter(screen, o) {
    if (screen === 'home' && !S.events) loadEvents();
    if (screen === 'calendar') { S.ev = o.ev || null; S.evForm = null; loadEvents(); }
    if (screen === 'add') initAdd(o.type, o.teamId);
    if (screen === 'stats') { if (o.scope) S.stats.scope = o.scope; if (o.cat) S.stats.cat = o.cat; loadStats(); }
    if (screen === 'known') { S.known.detail = null; S.known.edit = null; S.known.teamId = S.known.teamId && caps().knownTeams.indexOf(S.known.teamId) >= 0 ? S.known.teamId : myTeamFirst(caps().knownTeams); loadKnown(); }
    if (screen === 'team') { S.team.open = null; S.team.teamId = S.team.teamId && caps().viewTeams.indexOf(S.team.teamId) >= 0 ? S.team.teamId : myTeamFirst(caps().viewTeams); loadTeam(); }
    if (screen === 'finance') { S.fin.teamId = S.fin.teamId && caps().financeTeams.indexOf(S.fin.teamId) >= 0 ? S.fin.teamId : myTeamFirst(caps().financeTeams); loadFin(); }
    if (screen === 'requests') loadReqs();
    if (screen === 'profile') { S.roleReq = null; S.profile = Object.assign({}, S.me.profile || {}); }
  }

  // ───────────── завантаження ─────────────
  async function loadMe() {
    try {
      S.me = await api('me');
    } catch (e) { S.fatal = e.message; return renderFatal(); }
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
    try { S.events = await api('events'); } catch (e) { S.events = S.events || []; toast(e.message); }
    if (S.screen === 'calendar' || S.screen === 'home') render();
  }
  async function loadStats() {
    S.stats.loading = true; render();
    try {
      S.stats.data = await api('stats', { scope: S.stats.scope, cat: S.stats.cat, period: S.stats.period });
      S.stats.scope = S.stats.data.scope.key; S.stats.cat = S.stats.data.cat;
    } catch (e) { toast(e.message); }
    S.stats.loading = false;
    if (S.screen === 'stats') render();
  }
  async function loadKnown(force) {
    const id = S.known.teamId;
    if (!id) { S.known.list = []; return render(); }
    if (!force && S.knownCache[id]) { S.known.list = S.knownCache[id]; return render(); }
    S.known.list = null; render();
    try { S.knownCache[id] = S.known.list = await api('knownList', { teamId: id }); } catch (e) { S.known.list = []; toast(e.message); }
    if (S.screen === 'known' || S.screen === 'add') render();
  }
  async function loadTeam() {
    if (!S.team.teamId) { S.team.list = []; return render(); }
    S.team.list = null; render();
    try { S.team.list = await api('teamMembers', { teamId: S.team.teamId }); } catch (e) { S.team.list = []; toast(e.message); }
    if (S.screen === 'team') render();
  }
  async function loadFin() {
    if (!S.fin.teamId) return render();
    S.fin.data = null; render();
    try { S.fin.data = await api('financeGet', { teamId: S.fin.teamId, month: S.fin.month }); S.fin.cur = Object.assign({}, S.fin.data.current); } catch (e) { toast(e.message); }
    if (S.screen === 'finance') render();
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
    $app.innerHTML = `<main class="main${nav ? '' : ' no-nav'}">${view}</main>${nav}`;
    if (S.toast) document.body.insertAdjacentHTML('beforeend', document.querySelector('.toast') ? '' : `<div class="toast" role="status">${esc(S.toast)}</div>`);
    syncBack();
  }
  function renderFatal() {
    $app.innerHTML = `<main class="main no-nav"><div class="row"><div class="logo">YL</div><h2>Young Life Україна</h2></div>
      <div class="card col"><h2>Не вдалося відкрити застосунок</h2><div class="muted">${esc(S.fatal)}</div>
      <button class="btn" type="button" data-a="reload">Спробувати ще раз</button></div></main>`;
  }

  function navHtml() {
    const c = caps();
    const canReport = ['club', 'mg', 'kr'].some((t) => (c.report[t] || []).length);
    const tabs = [['home', 'Головна'], ['add', 'Внести'], ['calendar', 'Календар'], ['stats', 'Статистика'], ['more', 'Ще']].filter((t) => t[0] !== 'add' || canReport);
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
    if (m.scopeCard) {
      const sc = m.scopeCard; const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
      h += `<div class="card col"><h2>${esc(sc.title)}</h2><div class="small muted">Звітували про клуби цього тижня</div>
        <div class="row" style="align-items:baseline;gap:6px"><span style="font:800 30px Manrope,Inter,sans-serif">${sc.done}</span><span class="muted">з ${sc.total} команд</span></div>
        <div class="track"><i style="width:${pct}%;background:var(--turq)"></i></div>
        <button type="button" class="btn sec2 sm" data-a="goStats" data-scope="${esc(sc.scope)}" data-cat="club">Хто ще не здав →</button></div>`;
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
    return h;
  };

  function sectionTiles() {
    const c = caps();
    const out = [];
    if ((c.knownTeams || []).length) out.push({ k: 'known', label: 'Знані по імені', sub: 'підлітки, за яких молимось', icon: 'known', ic: 'ic-coral' });
    if ((c.viewTeams || []).length) out.push({ k: 'team', label: 'Склад команди', sub: 'ролі й анкети', icon: 'club', ic: 'ic-teal' });
    if ((c.financeTeams || []).length) out.push({ k: 'finance', label: 'Фінансовий звіт', sub: 'щомісяця', icon: 'finance', ic: 'ic-yellow' });
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
  function evCard(e) {
    const p = evDateParts(e);
    return `<button type="button" class="ev" data-a="openEv" data-id="${esc(e.id)}"><span class="ev-date tag lvl-${e.level}"><b>${p.day}</b><span>${p.wd}</span></span>
      <span class="grow"><span class="b" style="display:block">${esc(e.title)}</span><span class="small muted">${esc(e.levelLabel)}${e.place ? ' · ' + esc(e.place) : ''}${e.time ? ' · ' + esc(e.time) : ''}</span></span>
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
  function evDetailView() {
    const e = (S.events || []).filter((x) => x.id === S.ev)[0];
    if (!e) return header('Подія') + '<div class="empty">Подію не знайдено</div>';
    const p = evDateParts(e);
    let h = header(e.title, '', '');
    h += `<div><span class="tag lvl-${e.level}">${esc(e.levelLabel)}</span></div>`;
    h += `<div class="card rows"><div class="kv"><span>Коли</span><span>${p.day} ${MGEN[p.d.getMonth()]}${e.time ? ', ' + esc(e.time) : ''}</span></div>
      ${e.place ? `<div class="kv"><span>Де</span><span>${esc(e.place)}</span></div>` : ''}<div class="kv"><span>Організатор</span><span>${esc(e.author || '—')}</span></div></div>`;
    if (e.desc) h += `<div style="white-space:pre-line">${esc(e.desc)}</div>`;
    h += `<div class="row small muted">${icon('club', 18)}${e.going} ${e.going % 10 === 1 && e.going % 100 !== 11 ? 'людина йде' : 'людей йдуть'}</div>`;
    h += e.isGoing ? `<button type="button" class="btn ghost" data-a="rsvp" data-id="${esc(e.id)}" data-g="0" style="border-color:var(--teal);color:var(--teal)">Ти йдеш ✓ — скасувати</button>`
      : `<button type="button" class="btn" data-a="rsvp" data-id="${esc(e.id)}" data-g="1">Йду / їду</button>`;
    h += `<button type="button" class="btn sec2" data-a="evCal" data-id="${esc(e.id)}">${icon('calendar', 18)} Додати у свій календар</button>`;
    h += '<div class="small muted center">Бот нагадає в Telegram тим, хто записався</div>';
    if (e.manage) {
      h += `<div class="card col"><h2>Учасники (${e.people.length})</h2>${e.people.length ? e.people.map((x) => `<div class="row between small"><span>${esc(x.name)}</span><span class="muted">${esc(x.team)}</span></div>`).join('') : '<div class="small muted">Ще ніхто не записався</div>'}</div>`;
      h += `<button type="button" class="btn ghost" data-a="evDelete" data-id="${esc(e.id)}">Видалити подію</button>`;
    }
    return h;
  }
  function evFormView() {
    const f = S.evForm, units = caps().eventUnits || [];
    let h = header('Нова подія');
    h += '<div class="card col">';
    h += units.length > 1
      ? `<label class="f"><span>Календар</span><select class="in" data-bind="evForm.unit">${units.map((u, i) => `<option value="${i}"${String(i) === String(f.unit) ? ' selected' : ''}>${esc(u.label)}</option>`).join('')}</select></label>`
      : `<div class="small muted">Додається в календар: <b>${esc(units[0] ? units[0].label : '')}</b></div>`;
    h += `<label class="f"><span>Назва</span><input class="in" type="text" data-bind="evForm.title" value="${esc(f.title)}" placeholder="Наприклад: Різдвяний клуб"></label>
      <div class="grid2"><label class="f"><span>Дата</span><input class="in" type="date" data-bind="evForm.date" value="${esc(f.date)}" min="${ymd(new Date())}"></label>
      <label class="f"><span>Час</span><input class="in" type="time" data-bind="evForm.time" value="${esc(f.time)}"></label></div>
      <label class="f"><span>Місце</span><input class="in" type="text" data-bind="evForm.place" value="${esc(f.place)}" placeholder="Адреса або назва"></label>
      <label class="f"><span>Опис</span><textarea class="in" rows="3" data-bind="evForm.desc">${esc(f.desc)}</textarea></label>
      <button type="button" class="btn" data-a="evSave">Додати подію</button></div>`;
    return h;
  }

  // ───────────── СТАТИСТИКА ─────────────
  VIEWS.stats = function () {
    const st = S.stats, d = st.data;
    let h = header('Статистика', d ? d.scope.label : '');
    const scopes = (d && d.scopes) || me().scopes || [];
    if (scopes.length > 1) {
      h += `<label class="f"><span>Рівень</span><select class="in" data-ch="statsScope">${scopes.map((s) => `<option value="${esc(s.key)}"${d && s.key === d.scope.key ? ' selected' : ''}>${'— '.repeat(s.depth)}${esc(s.label)}</option>`).join('')}</select></label>`;
    }
    if (!d) return h + loading();
    if (d.cats.length > 1) h += `<div class="pills">${d.cats.map((c) => `<button type="button" class="pill${c.key === d.cat ? ' on' : ''}" data-a="statsCat" data-c="${c.key}">${esc(c.label)}</button>`).join('')}</div>`;
    h += `<div class="seg">${[['week', 'Тиждень'], ['month', 'Місяць'], ['q', '3 міс'], ['year', 'Рік']].map((p) => `<button type="button" class="${p[0] === st.period ? 'on' : ''}" data-a="statsPeriod" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>`;
    if (st.loading) h += '<div class="small muted center">Оновлюю…</div>';
    h += `<div class="kpis">${d.kpis.map((k) => `<div class="card kpi"><div class="v">${esc(k.v)}</div><div class="l">${esc(k.l)}</div></div>`).join('')}</div>`;
    if (d.cat === 'overview') {
      h += `<div class="card col" style="gap:6px"><h2>Звітність цього тижня</h2><div class="small muted">${esc(d.weekLabel)}</div>${d.report.map((r) => {
        const tot = r.total || 1;
        return `<button type="button" class="brk" style="border-top:1px solid var(--line);padding:10px 0" data-a="statsCat" data-c="${r.type}">
          <span class="row between" style="width:100%"><span class="b">${esc(r.label)}</span><span class="b">${r.ok + r.none} з ${r.total} ${esc(r.unit)}</span></span>
          <span class="track" style="width:100%"><i style="width:${r.ok / tot * 100}%;background:var(--turq)"></i><i style="width:${r.none / tot * 100}%;background:var(--muted);opacity:.45"></i></span>
          <span class="xs muted">${r.none ? '«Не було»: ' + r.none + ' · ' : ''}ще не здали: ${r.missing.length}</span></button>`;
      }).join('')}</div>`;
    }
    const bars = d.chart.bars, max = Math.max.apply(null, bars.map((b) => b.v).concat([1]));
    const short = (v) => d.cat === 'kr' ? df(v) : v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? df(v / 1000) + 'k' : nf(v);
    h += `<div class="card"><h2>${esc(d.chart.title)}</h2><div class="small muted" style="margin-bottom:12px">${esc(d.chart.sub)}</div>
      <div class="chart">${bars.map((b, i) => `<div class="bar${i === bars.length - 1 ? ' last' : ''}"><span>${b.v ? short(b.v) : ''}</span><i style="height:${Math.max(2, Math.round(b.v / max * 118))}px"></i></div>`).join('')}</div>
      <div class="chart-labels">${bars.map((b) => `<span>${esc(b.label)}</span>`).join('')}</div></div>`;
    if (d.breakdown.rows.length) {
      const rmax = Math.max.apply(null, d.breakdown.rows.map((r) => r.value).concat([1]));
      const COL = ['var(--coral)', 'var(--yellow)', 'var(--turq)', 'var(--blue)', 'var(--purple)', 'var(--pink)'];
      h += `<div class="card col" style="gap:2px"><h2 style="margin-bottom:6px">${esc(d.breakdown.title)}</h2>${d.breakdown.rows.map((r, i) =>
        `<button type="button" class="brk" ${r.drill ? `data-a="statsDrill" data-k="${esc(r.drill)}"` : 'disabled style="cursor:default;opacity:1"'}>
          <span class="row between" style="width:100%"><span>${esc(r.name)}${r.drill ? ' <span class="muted">›</span>' : ''}</span><span class="b">${esc(r.text)}</span></span>
          <span class="track" style="width:100%"><i style="width:${Math.round(r.value / rmax * 100)}%;background:${COL[i % 6]};border-radius:4px"></i></span></button>`).join('')}
        ${d.breakdown.rows.some((r) => r.drill) ? '<div class="xs muted" style="margin-top:4px">Натисни на рядок, щоб перейти глибше</div>' : ''}</div>`;
    }
    const rep = d.report.filter((r) => r.type === d.cat)[0];
    if (rep) {
      h += `<div class="card col"><h2>Цього тижня ще не здали</h2>${rep.missing.length ? `<div class="row wrap" style="gap:8px">${rep.missing.slice(0, 30).map((m) => `<span class="tag warn">${esc(m)}</span>`).join('')}${rep.missing.length > 30 ? `<span class="tag">…і ще ${rep.missing.length - 30}</span>` : ''}</div>` : '<div class="b" style="color:var(--teal)">Усі здали</div>'}
        <div class="small muted">Відмітили «не було»: ${rep.none}</div>
        ${d.canNudge && rep.missing.length ? `<button type="button" class="btn sec2 sm" data-a="nudge" data-type="${rep.type}">Нагадати їм у Telegram</button>` : ''}</div>`;
    }
    return h;
  };

  // ───────────── ЩЕ ─────────────
  VIEWS.more = function () {
    const c = caps();
    const items = sectionTiles().map((t) => ({ k: t.k, label: t.label, sub: t.sub, icon: t.icon, ic: t.ic }));
    if (c.approve) items.push({ k: 'requests', label: 'Заявки', sub: 'підтвердження ролей', icon: 'requests', ic: 'ic-blue', badge: me().pendingCount });
    items.push({ k: 'profile', label: 'Мій профіль', sub: myLine(), icon: 'profile', ic: 'ic-soft' });
    return header('Ще') + `<div class="card list">${items.map((m) => `<button type="button" class="li" data-a="tabGo" data-s="${m.k}"><span class="ic ${m.ic}">${icon(m.icon, 18)}</span>
      <span class="grow"><span class="b" style="display:block">${esc(m.label)}</span><span class="small muted">${esc(m.sub)}</span></span>${m.badge ? `<span class="badge">${m.badge}</span>` : ''}<span class="muted">${icon('chev', 18)}</span></button>`).join('')}</div>`;
  };

  // ───────────── ЗНАНІ ПО ІМЕНІ ─────────────
  VIEWS.known = function () {
    const k = S.known;
    if (k.edit) return knownEditView();
    if (k.detail) return knownDetailView();
    let h = header('Знані по імені', k.teamId ? teamName(k.teamId) : '', `<button type="button" class="icon-btn accent" data-a="knownNew" aria-label="Додати підлітка">${icon('plus', 22)}</button>`);
    h += teamSelect(caps().knownTeams, k.teamId, 'knownTeam');
    h += `<label class="sr" for="kq">Пошук</label><input id="kq" class="in" type="search" placeholder="Пошук за іменем" data-live="knownSearch">`;
    h += `<div class="pills"><button type="button" class="pill${!k.mine ? ' on' : ''}" data-a="knownMine" data-v="0">Усі</button><button type="button" class="pill${k.mine ? ' on' : ''}" data-a="knownMine" data-v="1">Мої</button></div>`;
    if (!k.list) return h + loading();
    const f = first().toLowerCase();
    const list = k.list.filter((p) => !k.mine || String(p.leader).toLowerCase().indexOf(f) >= 0);
    if (!list.length) return h + `<div class="empty">${k.list.length ? 'Нікого не знайдено' : 'Список порожній. Додай першого підлітка кнопкою «+».'}</div>`;
    h += `<div class="small muted">${list.length} ${list.length % 10 === 1 && list.length % 100 !== 11 ? 'підліток' : 'підлітків'} · за них молимось</div>`;
    const AV = ['rgba(255,122,89,.2)', 'rgba(20,184,166,.2)', 'rgba(76,110,245,.2)', 'rgba(244,166,35,.26)', 'rgba(155,93,229,.2)', 'rgba(239,71,111,.2)'];
    h += `<div class="card list" id="knownList">${list.map((p, i) => `<button type="button" class="li" data-a="knownOpen" data-id="${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}">
      <span class="avatar" style="background:${AV[i % 6]}">${esc(initials(p.name))}</span><span class="grow"><span class="b" style="display:block">${esc(p.name)}</span>
      <span class="small muted">${esc([p.grade, p.school, p.leader ? 'веде ' + p.leader : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`;
    return h;
  };
  function knownDetailView() {
    const p = (S.known.list || []).filter((x) => x.id === S.known.detail)[0];
    if (!p) return header('Знані по імені') + '<div class="empty">Не знайдено</div>';
    let h = header(p.name, [p.grade, p.school].filter(Boolean).join(' · '), `<button type="button" class="icon-btn" data-a="knownEdit" aria-label="Редагувати"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg></button>`);
    const tel = String(p.phone || '').replace(/[^\d+]/g, '');
    const ig = String(p.ig || '').replace(/^@/, '');
    if (tel || ig) h += `<div class="grid2">${tel ? `<button type="button" class="btn sec2" data-a="openUrl" data-url="tel:${esc(tel)}">${icon('phone', 18)} Подзвонити</button>` : ''}${ig ? `<button type="button" class="btn sec2" data-a="openUrl" data-url="https://instagram.com/${esc(encodeURIComponent(ig))}">Instagram</button>` : ''}</div>`;
    h += `<div class="card rows">${[['Телефон', p.phone], ['Instagram', p.ig], ['День народження', p.bday ? fmtDay(p.bday) : ''], ['Школа', p.school], ['Клас', p.grade], ['Веде', p.leader]].filter((x) => x[1]).map((x) => `<div class="kv"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('') || '<div class="kv"><span>Даних поки немає</span><span></span></div>'}</div>`;
    if (p.note) h += `<div class="note"><div class="sec" style="margin:0 0 6px">Молитовна нотатка</div><div style="white-space:pre-line">${esc(p.note)}</div></div>`;
    return h;
  }
  function knownEditView() {
    const e = S.known.edit;
    return header(e.id ? 'Редагувати' : 'Новий підліток', teamName(S.known.teamId)) + `<div class="card col">
      <label class="f"><span>Імʼя та прізвище *</span><input class="in" type="text" data-bind="known.edit.name" value="${esc(e.name)}"></label>
      <div class="grid2"><label class="f"><span>Телефон</span><input class="in" type="tel" data-bind="known.edit.phone" value="${esc(e.phone)}"></label>
      <label class="f"><span>Instagram</span><input class="in" type="text" data-bind="known.edit.ig" value="${esc(e.ig)}" placeholder="@нік"></label></div>
      <div class="grid2"><label class="f"><span>День народження</span><input class="in" type="date" data-bind="known.edit.bday" value="${esc(e.bday)}"></label>
      <label class="f"><span>Клас</span><input class="in" type="text" data-bind="known.edit.grade" value="${esc(e.grade)}" placeholder="9-А"></label></div>
      <label class="f"><span>Школа</span><input class="in" type="text" data-bind="known.edit.school" value="${esc(e.school)}"></label>
      <label class="f"><span>Хто з лідерів веде</span><input class="in" type="text" data-bind="known.edit.leader" value="${esc(e.leader)}"></label>
      <label class="f"><span>Молитовна нотатка</span><textarea class="in" rows="3" data-bind="known.edit.note">${esc(e.note)}</textarea></label>
      <button type="button" class="btn" data-a="knownSave">Зберегти</button>
      ${e.id ? '<button type="button" class="btn ghost" data-a="knownArchive">Прибрати зі списку</button>' : ''}</div>
      <div class="xs muted">Дані підлітків бачать лише команда, ерія й регіон. Переконайся, що батьки погодились.</div>`;
  }
  const fmtDay = (s) => { const d = parseDay(s); return isNaN(d) ? s : d.getDate() + ' ' + MGEN[d.getMonth()]; };

  // ───────────── СКЛАД КОМАНДИ ─────────────
  VIEWS.team = function () {
    const t = S.team;
    let h = header('Склад команди', t.teamId ? teamName(t.teamId) + (areaById((teamById(t.teamId) || {}).areaId) ? ' · ' + areaById(teamById(t.teamId).areaId).name : '') : '');
    h += teamSelect(caps().viewTeams, t.teamId, 'teamTeam');
    if (!t.list) return h + loading();
    if (!t.list.length) return h + '<div class="empty">У команді ще нікого немає</div>';
    h += `<div class="card list">${t.list.map((p) => {
      const open = t.open === p.tgId, pr = p.profile || {};
      return `<button type="button" class="li" data-a="teamOpen" data-id="${esc(p.tgId)}"><span class="avatar">${esc(initials(p.name))}</span>
        <span class="grow"><span class="b" style="display:block">${esc(p.name)}</span><span class="row wrap" style="gap:6px;margin-top:4px">${p.roles.map((r) => `<span class="tag">${esc(r.label)}</span>`).join('')}</span></span></button>
        ${open ? `<div style="padding:0 16px 12px;border-bottom:1px solid var(--line)">${[['Telegram', p.username ? '@' + p.username : ''], ['Телефон', pr.phone], ['Дата народження', pr.bday ? fmtDay(pr.bday) : ''], ['Рік покаяння', pr.repent], ['Рік хрещення', pr.baptism], ['Рік ЛПYL', pr.lpyl], ['Відповідальності', pr.resp]].filter((x) => x[1]).map((x) => `<div class="kv small"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('') || '<div class="small muted">Анкету ще не заповнено</div>'}
          ${p.roles.filter((r) => r.canRemove).map((r) => `<button type="button" class="btn ghost sm" style="margin-top:8px;width:100%" data-a="roleRemove" data-id="${esc(r.id)}" data-label="${esc(r.label)}" data-name="${esc(p.name)}">Зняти роль «${esc(r.label)}»</button>`).join('')}</div>` : ''}`;
    }).join('')}</div><div class="xs muted">Анкету кожен заповнює у своєму профілі.</div>`;
    return h;
  };

  // ───────────── ФІНАНСИ ─────────────
  const FIN_FIELDS = [['office', 'Дав офіс'], ['church', 'Дала церква'], ['team', 'Зібрали командою'], ['spent', 'Витратили']];
  const finBalance = (c) => (Number(c.prev) || 0) + (Number(c.office) || 0) + (Number(c.church) || 0) + (Number(c.team) || 0) - (Number(c.spent) || 0);
  const monthLabel = (k) => { const p = String(k).split('-').map(Number); return MFULL[p[1] - 1] + ' ' + p[0]; };
  VIEWS.finance = function () {
    const f = S.fin;
    let h = header('Фінансовий звіт', f.teamId ? teamName(f.teamId) + ' · бачать капітан, ерія і регіон' : '');
    h += teamSelect(caps().financeTeams, f.teamId, 'finTeam');
    h += `<label class="f"><span>Місяць</span><input class="in" type="month" value="${esc(f.month)}" max="${ym(new Date())}" data-ch="finMonth"></label>`;
    if (!f.data || !f.cur) return h + loading();
    const c = f.cur;
    h += `<div class="card rows"><div class="kv"><span>Попередній залишок</span><span><input class="in" style="width:120px;min-height:40px;text-align:right" type="number" inputmode="decimal" value="${esc(c.prev)}" data-bind="fin.cur.prev" data-live="finCalc"> ₴</span></div>
      ${FIN_FIELDS.map((x) => `<div class="kv"><label for="fin_${x[0]}" style="color:var(--text);font-weight:500">${x[1]}</label><span><input id="fin_${x[0]}" class="in" style="width:120px;min-height:40px;text-align:right" type="number" inputmode="decimal" value="${esc(c[x[0]])}" data-bind="fin.cur.${x[0]}" data-live="finCalc"> ₴</span></div>`).join('')}
      <div class="kv"><span style="color:var(--text);font-weight:700">Залишок</span><span style="font:800 22px Manrope,Inter,sans-serif"><span id="finBal">${nf(finBalance(c))}</span> ₴</span></div></div>`;
    if (f.data.canEdit) h += `<button type="button" class="btn" data-a="finSave">Зберегти ${esc(monthLabel(f.month).toLowerCase())}</button>`;
    if (f.data.history.length) {
      h += `<div class="sec">Попередні місяці</div><div class="card list">${f.data.history.map((r) => `<div class="li" style="min-height:52px"><span class="grow">${esc(monthLabel(r.month))}</span><span class="b">залишок ${nf(r.balance)} ₴</span></div>`).join('')}</div>`;
    }
    return h;
  };

  // ───────────── ЗАЯВКИ ─────────────
  VIEWS.requests = function () {
    let h = header('Заявки', 'Ти підтверджуєш лише ролі, нижчі за свою, у своїх межах');
    if (!S.reqs) return h + loading();
    if (!S.reqs.length) return h + '<div class="empty">Нових заявок немає</div>';
    h += S.reqs.map((p) => `<div class="card col"><div class="row"><span class="avatar" style="background:rgba(76,110,245,.18)">${esc(initials(p.name))}</span>
      <div class="grow"><div class="b">${esc(p.name)}</div><div class="small muted">${p.username ? '@' + esc(p.username) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</div></div></div>
      <div class="col" style="gap:4px">${p.roles.map((r) => `<label class="check" style="border:0;border-radius:12px;background:var(--soft);min-height:46px;padding:0 12px"><input type="checkbox" data-ch="reqToggle" data-id="${esc(r.id)}"${S.reqSel[r.id] ? ' checked' : ''}>
        <span class="grow"><span class="b">${esc(r.label)}</span> <span class="small muted">· ${esc(r.unitName)}</span></span></label>`).join('')}</div>
      <div class="row"><button type="button" class="btn sec2 sm" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="0">Відхилити</button>
      <button type="button" class="btn teal sm grow" data-a="reqDecide" data-tg="${esc(p.tgId)}" data-ok="1">Підтвердити вибрані</button></div></div>`).join('');
    return h;
  };

  // ───────────── ПРОФІЛЬ ─────────────
  VIEWS.profile = function () {
    if (S.roleReq) return roleReqView();
    const m = me(), p = S.profile || {};
    let h = header('Мій профіль');
    h += `<div class="row">${myAvatar()}<div><div style="font:800 20px Manrope,Inter,sans-serif">${esc(m.user.name)}</div><div class="small muted">${esc(myLine())}${m.user.username ? ' · @' + esc(m.user.username) : ''}</div></div></div>`;
    h += `<div class="sec">Мої ролі</div><div class="card list">${(m.roles || []).map((r) => `<div class="li" style="min-height:52px"><span class="grow b">${esc(r.label)}</span><span class="small muted">${esc(r.unitName)}</span>${r.status !== 'активна' ? '<span class="tag warn">очікує</span>' : ''}</div>`).join('')}
      <button type="button" class="li" style="justify-content:center;color:var(--accent-text);font-weight:600" data-a="roleReqOpen">+ Попросити ще роль</button></div>`;
    const F = [['name', 'Імʼя та прізвище', 'text'], ['title', 'Статус під іменем (необовʼязково)', 'text'], ['phone', 'Телефон', 'tel'], ['email', 'Gmail (для доступу до таблиць)', 'email'], ['bday', 'Дата народження', 'date'], ['repent', 'Рік покаяння', 'number'], ['baptism', 'Рік хрещення', 'number'], ['lpyl', 'Рік проходження ЛПYL', 'number'], ['resp', 'Відповідальності на клубі', 'text']];
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
    if (o.areaId) {
      h += `<div class="f"><span>Команда</span></div><div class="card list">${teams.map((t) => `<label class="check"><input type="radio" name="${prefix}Team" data-ch="${prefix}Team" value="${esc(t.id)}"${t.id === o.teamId ? ' checked' : ''}><span class="grow">${esc(t.name)}</span></label>`).join('')}
        <label class="check"><input type="radio" name="${prefix}Team" data-ch="${prefix}Team" value="__new"${o.teamId === '__new' ? ' checked' : ''}><span class="grow">Моєї команди немає</span><span class="xs muted">створимо нову</span></label></div>`;
      if (o.teamId === '__new') h += `<label class="f"><span>Назва нової команди</span><input class="in" type="text" data-bind="${prefix === 'reg' ? 'reg' : 'roleReq'}.newTeam" value="${esc(o.newTeam)}"></label>`;
    }
    return h;
  }
  function roleFields(o, prefix) {
    const defs = me().roleDefs.filter((r) => r.key !== 'NATIONAL_ADMIN');
    const team = defs.filter((r) => r.level === 'team');
    const upper = defs.filter((r) => r.level !== 'team');
    const box = (r) => `<label class="check"><input type="checkbox" data-ch="${prefix}Role" data-k="${r.key}"${o.roles[r.key] ? ' checked' : ''}><span class="grow b" style="font-weight:500">${esc(r.label)}</span></label>`;
    let h = `<div class="card list">${team.map(box).join('')}</div>`;
    h += `<label class="toggle-row"><span class="b" style="font-weight:500">Я служу на рівні ерії або регіону</span><input type="checkbox" data-ch="${prefix}Upper"${o.upper ? ' checked' : ''}></label>`;
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
    const res = await run(() => api('saveReport', {
      type: a.type, teamId: a.teamId, mode: a.mode, date: a.date, teens: a.teens, newT: a.newT, leaders: a.leaders, hours: a.hours,
      topic: a.topic, note: a.note, attendees: a.mark ? Object.keys(a.att).filter((k) => a.att[k]) : [],
    }), 'Збережено. Дякую!');
    if (res) { S.me.week = res.week; go('home'); }
  };
  A.markNone = async (d) => {
    const res = await run(() => api('saveReport', { type: d.type, teamId: d.team, mode: 'none' }), 'Відмічено: ' + typeOf(d.type).none.toLowerCase());
    if (res) { S.me.week = res.week; if (S.screen === 'add') go('home'); else render(); }
  };

  // календар
  A.openEv = (d) => { if (S.screen !== 'calendar') go('calendar', { ev: d.id }); else { S.ev = d.id; render(); window.scrollTo(0, 0); } };
  A.evFilter = (d) => { S.evFilter = d.l; render(); };
  A.evNew = () => { S.evForm = { unit: 0, title: '', date: ymd(new Date(Date.now() + 7 * 864e5)), time: '', place: '', desc: '' }; render(); };
  A.evSave = async () => {
    const f = S.evForm, u = (caps().eventUnits || [])[Number(f.unit) || 0];
    if (!u) return;
    if (String(f.title).trim().length < 2) return toast('Вкажи назву події');
    const res = await run(() => api('eventSave', { level: u.level, unitId: u.unitId, title: f.title, date: f.date, time: f.time, place: f.place, desc: f.desc }), 'Подію додано: ' + u.label);
    if (res) { S.evForm = null; S.events = null; render(); loadEvents(); }
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
    if (/^\d{1,2}:\d{2}$/.test(e.time || '')) { const t = e.time.split(':'); const st = day + 'T' + pad(Number(t[0])) + t[1] + '00'; const en = day + 'T' + pad(Math.min(23, Number(t[0]) + 2)) + t[1] + '00'; dates = st + '/' + en; }
    else { const nd = new Date(parseDay(e.date).getTime() + 864e5); dates = day + '/' + ymd(nd).replace(/-/g, ''); }
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Europe/Kiev&text=' + encodeURIComponent(e.title) + '&dates=' + dates +
      '&location=' + encodeURIComponent(e.place || '') + '&details=' + encodeURIComponent((e.desc || '') + '\n\nYoung Life Україна · ' + e.levelLabel);
    A.openUrl({ url: url });
  };
  A.evDelete = (d) => {
    const doIt = async () => { const res = await run(() => api('eventDelete', { id: d.id }), 'Подію видалено'); if (res) { S.ev = null; S.events = null; render(); loadEvents(); } };
    if (tg && tg.showConfirm) tg.showConfirm('Видалити подію?', (ok) => { if (ok) doIt(); }); else if (confirm('Видалити подію?')) doIt();
  };

  // статистика
  A.statsScope = (d, el) => { S.stats.scope = el.value; loadStats(); };
  A.statsCat = (d) => { S.stats.cat = d.c; loadStats(); };
  A.statsPeriod = (d) => { S.stats.period = d.p; loadStats(); };
  A.statsDrill = (d) => { S.stats.scope = d.k; loadStats(); window.scrollTo(0, 0); };
  A.nudge = async (d) => { const r = await run(() => api('nudge', { scope: S.stats.scope, type: d.type })); if (r) toast('Нагадування надіслано: ' + r.sent, 'success'); };

  // знані
  A.knownTeam = (d, el) => { S.known.teamId = el.value; loadKnown(); };
  A.knownMine = (d) => { S.known.mine = d.v === '1'; render(); };
  A.knownSearch = (d, el) => {
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#knownList .li').forEach((li) => { li.classList.toggle('hidden', !!q && li.dataset.name.indexOf(q) < 0); });
  };
  A.knownOpen = (d) => { S.known.detail = d.id; render(); window.scrollTo(0, 0); };
  A.knownNew = () => { S.known.edit = { id: '', name: '', phone: '', ig: '', bday: '', school: '', grade: '', leader: first(), note: '' }; render(); };
  A.knownEdit = () => { const p = S.known.list.filter((x) => x.id === S.known.detail)[0]; S.known.edit = Object.assign({}, p); render(); };
  A.knownSave = async () => {
    const e = S.known.edit;
    if (String(e.name).trim().length < 2) return toast('Вкажи імʼя');
    const res = await run(() => api('knownSave', { teamId: S.known.teamId, item: e }), 'Збережено');
    if (res) { S.known.edit = null; S.known.detail = e.id ? e.id : null; delete S.knownCache[S.known.teamId]; loadKnown(true); }
  };
  A.knownArchive = () => {
    const doIt = async () => { const res = await run(() => api('knownArchive', { teamId: S.known.teamId, id: S.known.edit.id }), 'Прибрано зі списку'); if (res) { S.known.edit = null; S.known.detail = null; delete S.knownCache[S.known.teamId]; loadKnown(true); } };
    if (tg && tg.showConfirm) tg.showConfirm('Прибрати підлітка зі списку знаних?', (ok) => { if (ok) doIt(); }); else if (confirm('Прибрати зі списку?')) doIt();
  };

  // склад
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
  A.profileSave = async () => { const res = await run(() => api('saveProfile', S.profile), 'Анкету збережено'); if (res) { S.me.profile = res; S.me.user.name = res.name || S.me.user.name; S.me.user.title = res.title || ''; render(); } };
  A.roleReqOpen = () => {
    const t = (S.me.myTeams || [])[0];
    S.roleReq = { regionId: t ? t.regionId : '', areaId: t ? t.areaId : '', teamId: t ? t.id : '', newTeam: '', roles: {}, upper: false, email: (S.me.profile || {}).email || '' };
    render();
  };
  A.roleReqSend = async () => {
    const p = rolePayload(S.roleReq);
    if (!p.roles.length) return toast('Обери роль');
    const res = await run(() => api('requestRoles', p), 'Заявку надіслано');
    if (res) { S.roleReq = null; S.me = await api('me'); render(); }
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
      if (!r.areaId) return toast('Обери регіон та ерію');
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

  // ───────────── СТАРТ ─────────────
  function start() {
    if (!tg || !tg.initData) {
      $app.innerHTML = `<main class="main no-nav"><div class="row"><div class="logo">YL</div><h2>Young Life Україна</h2></div>
        <div class="card col"><h2>Відкрий через Telegram</h2><div class="muted">Цей застосунок працює всередині Telegram. Знайди бота Young Life і натисни «Відкрити».</div></div></main>`;
      return;
    }
    tg.ready();
    tg.expand();
    if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
    tg.onEvent('themeChanged', () => document.documentElement.classList.toggle('dark', tg.colorScheme === 'dark'));
    try { tg.setHeaderColor('secondary_bg_color'); } catch (e) { /* старий Telegram */ }
    tg.BackButton.onClick(back);
    if (!API_URL) {
      $app.innerHTML = '<main class="main no-nav"><div class="card col"><h2>Застосунок ще налаштовується</h2><div class="muted">Адресу сервера не вказано в config.js.</div></div></main>';
      return;
    }
    loadMe();
  }
  start();
})();
