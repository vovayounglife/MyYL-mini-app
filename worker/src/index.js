/**
 * ════════════════════════════════════════════════════════════════
 *  Young Life Україна · Mini App · бекенд на Cloudflare Workers + D1
 * ════════════════════════════════════════════════════════════════
 *  POST /            — API для Mini App ({ initData, action, data })
 *  POST /tg          — вебхук Telegram-бота
 *  POST /admin/*     — службові дії (ключ SYNC_KEY): налаштування бота, імпорт, синхронізація з Google Диском
 *  cron щогодини     — нагадування про звіти й події
 *
 *  Секрети (wrangler secret): BOT_TOKEN, SYNC_KEY. Змінна APP_URL — адреса інтерфейсу.
 */

// ───────────────────────────── НАЛАШТУВАННЯ ─────────────────────────────

const TZ = 'Europe/Kyiv';
const INITDATA_MAX_AGE_SEC = 7 * 24 * 3600;

// rank: менше число = вища роль. level: до чого привʼязана роль.
const ROLES = [
  { key: 'SUPER', label: 'Раб Божий', rank: 0, level: 'nat' },
  { key: 'NATIONAL_ADMIN', label: 'Національний Адмін', rank: 1, level: 'nat' },
  { key: 'REGIONAL_DIRECTOR', label: 'Регіональний Директор', rank: 2, level: 'region' },
  { key: 'REGIONAL_ADMIN', label: 'Регіональний Адмін', rank: 3, level: 'region' },
  { key: 'AREA_DIRECTOR', label: 'Еріа Директор', rank: 4, level: 'area' },
  { key: 'AREA_ADMIN', label: 'Еріа Адмін', rank: 5, level: 'area' },
  { key: 'CAPTAIN', label: 'Капітан', rank: 6, level: 'team' },
  { key: 'TEAM_ADMIN', label: 'Адмін команди', rank: 7, level: 'team' },
  { key: 'DGL', label: 'DGL', rank: 8, level: 'team' },
  { key: 'LEADER', label: 'Лідер', rank: 9, level: 'team' },
  { key: 'HELPER', label: 'Помічник', rank: 10, level: 'team' },
  { key: 'SUGAR', label: 'Сахарок', rank: 11, level: 'team' },
  { key: 'VOLUNTEER', label: 'Волонтер', rank: 12, level: 'team' },
  // Працівник офісу: привʼязаний до регіону (зазвичай «Office»), поки що бачить лише календар у межах офісу
  { key: 'OFFICE', label: 'Працівник офісу', rank: 13, level: 'region', viewOnly: true },
];
const RANK = { CLUB: 7, MG: 9, KR: 10, KNOWN: 10, FINANCE: 7, APPROVE: 6, EVENT: 9, GMAIL: 6 };
const ST = { PENDING: 'очікує', ACTIVE: 'активна', REJECTED: 'відхилена', REMOVED: 'знята' };
const MODE = { event: 'подія', week: 'тиждень', none: 'не було' };
const TYPE_LABEL = { club: 'Клуб', mg: 'Мала група', kr: 'Контактна робота' };

// Хто підтверджує ролі (Раб Божий — будь-яку). 'same' — та сама одиниця; 'cover' — роль накриває одиницю заявки.
const APPROVAL = {
  NATIONAL_ADMIN: [],
  REGIONAL_DIRECTOR: [],
  REGIONAL_ADMIN: [['REGIONAL_DIRECTOR', 'same']],
  AREA_DIRECTOR: [['REGIONAL_DIRECTOR', 'cover']],
  AREA_ADMIN: [['AREA_DIRECTOR', 'same'], ['REGIONAL_DIRECTOR', 'cover'], ['REGIONAL_ADMIN', 'cover']],
  CAPTAIN: [['AREA_DIRECTOR', 'cover'], ['AREA_ADMIN', 'cover'], ['REGIONAL_ADMIN', 'cover']],
  OFFICE: [['REGIONAL_DIRECTOR', 'same'], ['REGIONAL_ADMIN', 'same']],
};
const SUPER_NOTIFY = ['NATIONAL_ADMIN', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'AREA_DIRECTOR'];
const MANAGE_AREAS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN'];
const MANAGE_TEAMS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'AREA_DIRECTOR'];

// ───────────────────────────── ВХІД ─────────────────────────────

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    try {
      if (url.pathname === '/tg' && req.method === 'POST') return await handleTelegram(req, env, ctx);
      if (url.pathname.startsWith('/auth/') && req.method === 'POST') return await handleAuth(req, env, url);
      if (url.pathname.startsWith('/admin/') && req.method === 'POST') return await handleAdmin(req, env, ctx, url);
      if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/api')) return await handleApi(req, env, ctx);
      if (req.method === 'GET' && url.pathname === '/') return cors(new Response('Young Life Mini App · бекенд працює ✅', { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e && e.stack || e);
      return json({ ok: false, error: 'error', message: 'Сталася помилка. Спробуй ще раз.' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    const when = new Date(event.scheduledTime || Date.now());
    const p = kyivParts(when);
    if (when.getUTCMinutes() !== 5) { await drainOutbox(env, 40); return; }
    const S = new Store(env, ctx);
    await S.loadBase();
    const day = String(S.setting('REMINDER_DAY') || 'SUNDAY').toUpperCase();
    const hour = Number(S.setting('REMINDER_HOUR')) || 18;
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    if (DAYS[p.dow % 7] === day && p.hour === hour) { await S.loadLog(weekKey_(new Date())); use(S, () => weeklyReminder()); }
    if (p.hour === 9) { await S.loadEvents(); use(S, () => eventReminder()); }
    await S.flush();
    await drainOutbox(env, 30);
  },
};

function json(obj, status) {
  return cors(new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8' } }));
}
function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}

class ApiError extends Error { constructor(code, message) { super(message); this.code = code; } }
function deny_(msg) { throw new ApiError('forbidden', msg || 'Немає доступу.'); }
function bad_(msg) { throw new ApiError('bad_request', msg); }

// Які дані потрібні кожній дії (завантажуються до запуску логіки)
const NEEDS = {
  me: { log: 'week', events: true }, register: {}, requestRoles: {}, requests: {}, decide: {}, removeRole: {}, saveProfile: {},
  saveReport: { log: 'week' }, knownList: { known: true }, knownSave: { known: true }, knownArchive: { known: true }, knownBulk: { known: true }, knownStage: { known: true },
  teamMembers: {}, financeGet: { finance: true }, financeSave: { finance: true },
  events: { events: true }, eventSave: { events: true }, eventDelete: { events: true }, rsvp: { events: true },
  structureTree: {}, areaSave: {}, teamSave: {}, stats: { log: 'stats' }, nudge: { log: 'week' },
  myylTree: {}, broadcastInfo: { bc: true }, broadcast: {}, report: { log: 'report' },
};

async function handleApi(req, env, ctx) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'bad_request', message: 'Невірний запит.' }); }
  const S = new Store(env, ctx);
  try {
    const tgUser = body.session ? await verifySession(body.session, env) : await verifyInitData(body.initData, env.BOT_TOKEN);
    if (!tgUser) throw new ApiError('auth', 'Не вдалося перевірити Telegram. Відкрий застосунок заново.');
    const fn = API[body.action];
    const need = NEEDS[body.action];
    if (!fn || !need) throw new ApiError('bad_action', 'Невідома дія: ' + body.action);
    const d = body.data || {};
    await S.loadBase();
    if (need.log === 'week') await S.loadLog(weekKey_(new Date()));
    if (need.log === 'stats') await S.loadLog(statsFromWeek(d.period), true);
    if (need.log === 'report') await S.loadLog(weekKey_(/^\d{4}-\d{2}-\d{2}$/.test(d.from || '') ? d.from : kyivDay(new Date())), true);
    if (need.events) await S.loadEvents();
    if (need.known) {
      if (d.mine || (body.action !== 'knownList' && !str_(d.teamId))) await S.loadKnownMine(String(tgUser.id));
      if (!d.mine) await S.loadKnownTeams(unitTeams_(S.b, d));
      const rid = str_(d.id || (d.item && d.item.id));
      if (rid) await S.loadKnownRow(rid);
    }
    if (need.finance) {
      const ids = unitTeams_(S.b, d);
      if (isSingleTeam_(d)) await S.loadFinance(ids[0]);
      else await S.loadFinanceMonth(ids, /^\d{4}-\d{2}$/.test(d.month || '') ? d.month : kyivDay(new Date()).slice(0, 7));
    }
    if (need.bc) await S.loadBroadcasts();
    const data = use(S, () => fn(ctx_(tgUser), d));
    await S.flush();
    return json({ ok: true, data: data });
  } catch (err) {
    S.abort();
    if (!(err instanceof ApiError)) console.error(err && err.stack || err);
    return json({ ok: false, error: err.code || 'error', message: err instanceof ApiError ? err.message : 'Сталася помилка. Спробуй ще раз.' });
  }
}

// ───────────────────────────── ПЕРЕВІРКА TELEGRAM ─────────────────────────────

async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof msg === 'string' ? new TextEncoder().encode(msg) : msg));
}
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

async function verifyInitData(initData, token) {
  if (!initData || typeof initData !== 'string') return null;
  if (!token) throw new ApiError('setup', 'Бот ще не налаштований.');
  const params = {};
  initData.split('&').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
  });
  const hash = params.hash;
  if (!hash) return null;
  delete params.hash;
  const dcs = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), token);
  if (hex(await hmac(secret, dcs)) !== hash) return null;
  if (Date.now() / 1000 - Number(params.auth_date || 0) > INITDATA_MAX_AGE_SEC) throw new ApiError('auth_expired', 'Сесія застаріла. Закрий і відкрий застосунок заново.');
  try { return JSON.parse(params.user); } catch (e) { return null; }
}

// ───────────────────────────── СХОВИЩЕ (D1 + памʼять) ─────────────────────────────

const DIRECT_SEND = 25; // скільки повідомлень надсилати прямо в запиті (ліміт підзапитів Cloudflare)
let BASE = null; // кеш довідників у памʼяті ізоляту: перевіряється за версією в meta

let S = null; // поточне сховище — встановлюється лише на час синхронної логіки (без await)
function use(store, fn) { S = store; try { return fn(); } finally { S = null; } }

class Store {
  constructor(env, ctx) {
    this.env = env; this.ctx = ctx; this.db = env.DB;
    this.q = []; this.baseDirty = false; this.out = []; this.docs = [];
    this.log = []; this.events = []; this.rsvp = []; this.known = {}; this.finance = {};
  }
  async loadBase() {
    const ver = await this.db.prepare("SELECT v FROM meta WHERE k = 'ver'").first('v');
    if (BASE && BASE.ver === ver) { this.b = BASE; return; }
    const res = await this.db.batch([
      this.db.prepare('SELECT * FROM regions'), this.db.prepare('SELECT * FROM areas'), this.db.prepare('SELECT * FROM teams'),
      this.db.prepare('SELECT * FROM people'), this.db.prepare('SELECT * FROM roles'), this.db.prepare('SELECT * FROM settings'),
    ]);
    const [regions, areas, teams, people, roles, settings] = res.map((r) => r.results || []);
    const b = { ver: ver, settings: {} };
    b.regions = regions.map((r) => ({ id: r.id, name: r.name }));
    b.areas = areas.map((r) => ({ id: r.id, regionId: r.region_id, name: r.name }));
    b.teams = teams.map((r) => ({ id: r.id, areaId: r.area_id, name: r.name, state: r.state, active: r.state === 'active', known: Number(r.known) || 0 }));
    b.people = {};
    people.forEach((r) => { b.people[r.tg_id] = personFromRow(r); });
    b.roles = roles.map(roleFromRow).filter(Boolean);
    settings.forEach((r) => { b.settings[r.key] = r.value; });
    indexBase(b);
    BASE = b; this.b = b;
  }
  async loadLog(fromWeek, withExtras) {
    const rs = await this.db.prepare('SELECT * FROM reports WHERE week >= ?').bind(fromWeek).all();
    this.log = (rs.results || []).map(logFromRow);
    if (withExtras) {
      // нові знані й фінанси — у тому ж форматі, що й звіти (для статистики)
      const fromDay = fromWeek;
      const [kn, fin, stg] = await this.db.batch([
        this.db.prepare('SELECT team_id, added FROM known WHERE added >= ?').bind(fromDay),
        this.db.prepare('SELECT team_id, month, office, church, team, spent FROM finance WHERE month >= ?').bind(fromDay.slice(0, 7)),
        this.db.prepare("SELECT team_id, COALESCE(stage, 'meet') AS stage, COUNT(*) AS n FROM known WHERE active = 1 GROUP BY team_id, COALESCE(stage, 'meet')"),
      ]);
      this.knownStages = {};
      (stg.results || []).forEach((r) => { (this.knownStages[r.team_id] = this.knownStages[r.team_id] || {})[r.stage] = r.n; });
      const b = this.b;
      (kn.results || []).forEach((r) => {
        const t = b.team[r.team_id]; const day = String(r.added || '').slice(0, 10);
        if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        this.log.push({ type: 'known', date: day, week: weekKey_(day), teamId: r.team_id, areaId: t.areaId, regionId: b.teamRegion(r.team_id), mode: '', count: 1, newT: 0, leaders: 0, hours: 0, inc: 0, spent: 0 });
      });
      (fin.results || []).forEach((r) => {
        const t = b.team[r.team_id]; const day = r.month + '-01';
        if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        this.log.push({ type: 'fin', date: day, week: weekKey_(day), teamId: r.team_id, areaId: t.areaId, regionId: b.teamRegion(r.team_id), mode: '', count: 0, newT: 0, leaders: 0, hours: 0, inc: (r.office || 0) + (r.church || 0) + (r.team || 0), spent: r.spent || 0 });
      });
    }
  }
  async loadEvents() {
    const today = kyivDay(new Date());
    const [ev, rs] = await this.db.batch([
      this.db.prepare('SELECT * FROM events WHERE COALESCE(end_date, date) >= ?').bind(addDaysKey_(today, -1)),
      this.db.prepare('SELECT r.* FROM rsvp r JOIN events e ON e.id = r.event_id WHERE COALESCE(e.end_date, e.date) >= ?').bind(addDaysKey_(today, -1)),
    ]);
    this.events = (ev.results || []).map((r) => ({ id: r.id, roles: String(r.roles || '').split(',').filter(Boolean), aud: String(r.aud || '').split(',').filter(Boolean), level: r.level, unitId: r.unit_id || '', title: r.title || '', date: r.date, end: r.end_date && r.end_date > r.date ? r.end_date : '', time: r.time || '', place: r.place || '', desc: r.descr || '', authorId: r.author_id || '', author: r.author || '' }));
    this.rsvp = (rs.results || []).map((r) => ({ eventId: r.event_id, tgId: r.tg_id, name: r.name || '', team: r.team || '' }));
  }
  async loadKnownTeams(ids) {
    if (!ids.length) return;
    const rs = await this.db.prepare('SELECT * FROM known WHERE team_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all();
    ids.forEach((id) => { this.known[id] = []; });
    (rs.results || []).forEach((r) => { (this.known[r.team_id] = this.known[r.team_id] || []).push(r); });
  }
  async loadKnownMine(tgId) {
    const rs = await this.db.prepare('SELECT * FROM known WHERE author_id = ?').bind(tgId).all();
    this.knownMine = rs.results || [];
  }
  async loadKnownRow(id) {
    this.knownRow = await this.db.prepare('SELECT * FROM known WHERE id = ?').bind(id).first();
  }
  async loadFinanceMonth(ids, month) {
    this.finMonth = {};
    if (!ids.length) return;
    const rs = await this.db.prepare('SELECT * FROM finance WHERE month = ? AND team_id IN (SELECT value FROM json_each(?))').bind(month, JSON.stringify(ids)).all();
    (rs.results || []).forEach((r) => { this.finMonth[r.team_id] = r; });
  }
  async loadFinance(teamId) {
    if (!teamId) return;
    const rs = await this.db.prepare('SELECT * FROM finance WHERE team_id = ?').bind(teamId).all();
    this.finance[teamId] = rs.results || [];
  }
  async loadBroadcasts() {
    const [h, q] = await this.db.batch([
      this.db.prepare('SELECT * FROM broadcasts ORDER BY created DESC LIMIT 200'),
      this.db.prepare('SELECT COUNT(*) AS n FROM outbox'),
    ]);
    this.broadcasts = h.results || [];
    this.queued = ((q.results || [])[0] || {}).n || 0;
  }
  setting(k) { return this.b.settings[k]; }
  run(sql, params, base) {
    this.q.push(this.db.prepare(sql).bind(...(params || [])));
    if (base) this.baseDirty = true;
  }
  send(chatId, text, extra) { this.out.push({ chat_id: String(chatId), text: text, extra: extra }); }
  sendDoc(chatId, filename, content, caption) { this.docs.push({ chat_id: String(chatId), filename, content, caption }); }
  async flush() {
    if (this.baseDirty) this.q.push(this.db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"));
    if (this.q.length) {
      try { await this.db.batch(this.q); } catch (e) { BASE = null; throw e; }
      if (this.baseDirty) BASE = null;
    }
    this.q = [];
    if (this.docs.length) {
      const docs = this.docs.splice(0);
      const p = Promise.all(docs.map((x) => {
        const form = new FormData();
        form.append('chat_id', x.chat_id);
        if (x.caption) { form.append('caption', x.caption); form.append('parse_mode', 'HTML'); }
        form.append('document', new File([x.content], x.filename, { type: 'text/html' }));
        return tgForm(this.env, 'sendDocument', form);
      }));
      if (this.ctx && this.ctx.waitUntil) this.ctx.waitUntil(p); else await p;
    }
    if (this.out.length) {
      const msgs = this.out.splice(0);
      let p;
      if (msgs.length <= DIRECT_SEND) p = sendAll(this.env, msgs);
      else {
        // багато повідомлень — у чергу, перші надсилаємо одразу, решту щохвилини дошле cron
        const rows = msgs.map((m) => ({ c: m.chat_id, t: m.text, e: m.extra ? JSON.stringify(m.extra) : null }));
        await this.db.prepare("INSERT INTO outbox (chat_id, text, extra, created) SELECT json_extract(value, '$.c'), json_extract(value, '$.t'), json_extract(value, '$.e'), ? FROM json_each(?)")
          .bind(nowIso(), JSON.stringify(rows)).run();
        p = drainOutbox(this.env, DIRECT_SEND);
      }
      if (this.ctx && this.ctx.waitUntil) this.ctx.waitUntil(p); else await p;
    }
  }
  abort() { if (this.q.length && this.baseDirty) BASE = null; this.q = []; this.out = []; if (this.baseDirty) BASE = null; }
}

function indexBase(b) {
  b.region = {}; b.area = {}; b.team = {};
  b.regions.forEach((x) => { b.region[x.id] = x; });
  b.areas.forEach((x) => { b.area[x.id] = x; });
  b.teams.forEach((x) => { b.team[x.id] = x; });
  b.teamRegion = (teamId) => { const t = b.team[teamId]; return t && b.area[t.areaId] ? b.area[t.areaId].regionId : ''; };
}
function personFromRow(r) {
  let notif = {};
  try { notif = r.notif ? JSON.parse(r.notif) : {}; } catch (e) { notif = {}; }
  return { tgId: r.tg_id, username: r.username || '', name: r.name || '', phone: r.phone || '', email: r.email || '', bday: r.bday || '', repent: r.repent || '', baptism: r.baptism || '', lpyl: r.lpyl || '', resp: r.resp || '', title: r.title || '', notif: notif };
}
function roleFromRow(r) {
  const def = roleDef_(r.role_key);
  if (!def) return null;
  return { id: r.id, tgId: r.tg_id, name: r.name || '', key: def.key, label: def.label, rank: def.rank, level: def.level, unitId: r.unit_id || '', status: r.status, requested: r.requested || '' };
}
function logFromRow(r) {
  return { id: r.id, date: r.date, week: r.week, type: r.type, mode: r.mode, teamId: r.team_id, areaId: r.area_id, regionId: r.region_id, count: r.count || 0, newT: r.new_t || 0, leaders: r.leaders || 0, hours: r.hours || 0, inc: 0, spent: 0, authorId: r.author_id || '', author: r.author || '' };
}

// Одиниці з запиту (units: ['nat','r:…','a:…','t:…'] або teamId) → активні команди (без перевірки прав)
function unitTeams_(b, d) {
  const keys = Array.isArray(d.units) && d.units.length ? d.units.map(String) : d.teamId ? ['t:' + str_(d.teamId)] : [];
  const ids = {};
  keys.forEach((k) => {
    if (k.indexOf('t:') === 0) { if (b.team[k.slice(2)]) ids[k.slice(2)] = true; return; }
    b.teams.forEach((t) => {
      if (!t.active) return;
      if (k === 'nat' || (k.indexOf('r:') === 0 && b.teamRegion(t.id) === k.slice(2)) || (k.indexOf('a:') === 0 && t.areaId === k.slice(2))) ids[t.id] = true;
    });
  });
  return Object.keys(ids).slice(0, 400);
}
const isSingleTeam_ = (d) => (!Array.isArray(d.units) || !d.units.length) ? !!d.teamId : d.units.length === 1 && String(d.units[0]).indexOf('t:') === 0;

const keyUnit_ = (k) => (k === 'nat' ? { level: 'nat', unitId: '' } : { level: { r: 'region', a: 'area', t: 'team' }[String(k).charAt(0)] || '', unitId: String(k).slice(2) });
const unitKey_ = (level, id) => (level === 'nat' ? 'nat' : { region: 'r:', area: 'a:', team: 't:' }[level] + id);
// роль r знаходиться всередині одиниці u (u — { level, unitId })
const within_ = (u, r) => covers_(u, r.level, r.unitId) || (u.level === r.level && u.unitId === r.unitId);
function unitLabel_(k) {
  const u = keyUnit_(k);
  if (u.level === 'nat') return 'Україна';
  return ({ region: '', area: 'ерія ', team: '' }[u.level] || '') + unitName_(u.level, u.unitId);
}

// Доступ до даних для логіки (синхронно)
const loadStruct_ = () => S.b;
const loadRoles_ = () => S.b.roles;
const getPerson_ = (id) => S.b.people[String(id)] || null;
const loadLog_ = () => S.log;
const loadEvents_ = () => S.events;
function unitName_(level, id) {
  const st = loadStruct_();
  if (level === 'nat') return 'Україна';
  if (level === 'region') return (st.region[id] || {}).name || '';
  if (level === 'area') return (st.area[id] || {}).name || '';
  return (st.team[id] || {}).name || '';
}

// Записи (у памʼять — одразу, у базу — при flush)
function insertRole_(row) {
  S.run('INSERT INTO roles (id, tg_id, name, role_key, level, unit_id, status, decided_by, requested, decided) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [row.id, row.tgId, row.name, row.key, row.level, row.unitId, row.status, row.decidedBy || '', row.requested || nowIso(), row.decided || ''], true);
  S.b.roles.push(roleFromRow({ id: row.id, tg_id: row.tgId, name: row.name, role_key: row.key, unit_id: row.unitId, status: row.status, requested: row.requested || nowIso() }));
}
function setRoleStatus_(r, status, by) {
  S.run('UPDATE roles SET status = ?, decided_by = ?, decided = ? WHERE id = ?', [status, by || '', nowIso(), r.id], true);
  r.status = status;
}
function savePerson_(c, d) {
  const p = getPerson_(c.id);
  const v = {};
  const F = { name: 'name', phone: 'phone', bday: 'bday', repent: 'repent', baptism: 'baptism', lpyl: 'lpyl', resp: 'resp' };
  Object.keys(F).forEach((k) => { if (d[k] != null) v[F[k]] = clip_(d[k]); });
  if (d.email != null) v.email = clip_(String(d.email).trim().toLowerCase());
  if (d.title != null) v.title = clip_(String(d.title).slice(0, 60));
  if (d.notif && typeof d.notif === 'object') {
    const n = {};
    NOTIF.forEach((k) => { if (d.notif[k] != null) n[k] = d.notif[k] ? 1 : 0; });
    v.notif = JSON.stringify(n);
  }
  v.username = (c.tg && c.tg.username) || (p && p.username) || '';
  if (p) {
    const keys = Object.keys(v);
    S.run('UPDATE people SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE tg_id = ?', keys.map((k) => v[k]).concat([c.id]), true);
    Object.assign(p, v);
  } else {
    const row = Object.assign({ tg_id: c.id, registered: nowIso() }, v);
    const keys = Object.keys(row);
    S.run('INSERT INTO people (' + keys.join(', ') + ') VALUES (' + keys.map(() => '?').join(',') + ')', keys.map((k) => row[k]), true);
    S.b.people[c.id] = personFromRow(row);
  }
}
function createTeam_(areaId, name, active) {
  const id = uid_();
  const state = active ? 'active' : 'pending';
  S.run('INSERT INTO teams (id, area_id, name, state, known) VALUES (?,?,?,?,0)', [id, areaId, clip_(name), state], true);
  const t = { id: id, areaId: areaId, name: clip_(name), state: state, active: !!active, known: 0 };
  S.b.teams.push(t); S.b.team[id] = t;
  return id;
}
function activateTeam_(teamId) {
  const t = S.b.team[teamId];
  if (t && !t.active) { S.run("UPDATE teams SET state = 'active' WHERE id = ?", [teamId], true); t.state = 'active'; t.active = true; }
}

// ───────────────────────────── КОНТЕКСТ І ПРАВА ─────────────────────────────

function ctx_(tg) {
  const id = String(tg.id);
  const person = getPerson_(id);
  const all = loadRoles_().filter((r) => r.tgId === id);
  const active = all.filter((r) => r.status === ST.ACTIVE);
  const roles = active.filter((r) => !(roleDef_(r.key) || {}).viewOnly);
  return { id: id, tg: tg, person: person, roles: roles, active: active, allRoles: all, get name() { const p = getPerson_(id); return (p && p.name) || fullName_(tg); } };
}
function roleDef_(key) { return ROLES.filter((r) => r.key === key)[0] || null; }

function covers_(r, level, unitId) {
  const st = loadStruct_();
  if (r.level === 'nat') return true;
  if (r.level === 'region') {
    if (level === 'region') return unitId === r.unitId;
    if (level === 'area') return (st.area[unitId] || {}).regionId === r.unitId;
    if (level === 'team') return st.teamRegion(unitId) === r.unitId;
    return false;
  }
  if (r.level === 'area') {
    if (level === 'area') return unitId === r.unitId;
    if (level === 'team') return (st.team[unitId] || {}).areaId === r.unitId;
    return false;
  }
  return level === 'team' && unitId === r.unitId;
}
const upperRoles_ = (c) => c.roles.filter((r) => r.level !== 'team');
const teamRoles_ = (c, teamId, maxRank) => c.roles.filter((r) => r.level === 'team' && r.unitId === teamId && r.rank <= maxRank);
const canViewTeam_ = (c, teamId) => c.roles.some((r) => covers_(r, 'team', teamId));
const canTeam_ = (c, teamId, maxRank) => teamRoles_(c, teamId, maxRank).length > 0 || upperRoles_(c).some((r) => covers_(r, 'team', teamId));
const isSugarOnly_ = (c) => c.roles.length > 0 && c.roles.every((r) => r.key === 'SUGAR');
const isSuper_ = (c) => c.roles.some((r) => r.key === 'SUPER');

function ruleMatch_(r, rule, target) {
  if (r.key !== rule[0]) return false;
  if (rule[1] === 'same') return r.level === target.level && r.unitId === target.unitId;
  return covers_(r, target.level, target.unitId);
}
function canDecide_(c, target) {
  const def = roleDef_(target.key);
  if (!def || def.key === 'SUPER') return false;
  if (isSuper_(c)) return true;
  const rules = APPROVAL[def.key];
  if (rules) return c.roles.some((r) => rules.some((rule) => ruleMatch_(r, rule, target)));
  return c.roles.some((r) => r.rank <= RANK.APPROVE && r.rank < def.rank && covers_(r, target.level, target.unitId));
}
function primaryApprovers_(target) {
  const def = roleDef_(target.key);
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.tgId !== target.tgId);
  const ids = (pred) => uniq_(act.filter(pred).map((r) => r.tgId));
  const supers = ids((r) => r.key === 'SUPER');
  let out = [];
  const rules = APPROVAL[def.key];
  if (rules) {
    out = ids((r) => rules.some((rule) => ruleMatch_(r, rule, target)));
    if (SUPER_NOTIFY.indexOf(def.key) >= 0) out = uniq_(out.concat(supers));
  } else {
    const tiers = [
      (r) => r.key === 'CAPTAIN' && r.unitId === target.unitId,
      (r) => (r.key === 'AREA_DIRECTOR' || r.key === 'AREA_ADMIN') && covers_(r, 'team', target.unitId),
      (r) => (r.key === 'REGIONAL_DIRECTOR' || r.key === 'REGIONAL_ADMIN') && covers_(r, 'team', target.unitId),
    ];
    for (let i = 0; i < tiers.length && !out.length; i++) out = ids(tiers[i]);
  }
  return out.length ? out : supers;
}
function reportTeams_(c, maxRank) {
  const st = loadStruct_();
  const ids = {};
  c.roles.forEach((r) => {
    if (r.level === 'team' && r.rank <= maxRank && st.team[r.unitId] && st.team[r.unitId].active) ids[r.unitId] = true;
    if (r.level !== 'team') st.teams.forEach((t) => { if (t.active && covers_(r, 'team', t.id)) ids[t.id] = true; });
  });
  return Object.keys(ids);
}
const canApproveAny_ = (c) => c.roles.some((r) => r.rank <= RANK.APPROVE || r.key === 'REGIONAL_ADMIN' || r.key === 'AREA_ADMIN');
const pendingFor_ = (c) => loadRoles_().filter((r) => r.status === ST.PENDING && r.tgId !== c.id && canDecide_(c, r));

// ───────────────────────────── API ─────────────────────────────

const API = {};

API.me = function (c) {
  const st = loadStruct_();
  const out = {
    user: { id: c.id, name: c.name, username: c.tg.username || '', phone: c.person ? c.person.phone : '', email: c.person ? c.person.email : '', title: c.person ? c.person.title : '' },
    profile: c.person ? profileOf_(c.person) : null,
    structure: {
      regions: st.regions.map((r) => ({ id: r.id, name: r.name })),
      areas: st.areas.map((a) => ({ id: a.id, regionId: a.regionId, name: a.name })),
      teams: st.teams.filter((t) => t.active).map((t) => ({ id: t.id, areaId: t.areaId, name: t.name })),
    },
    roleDefs: ROLES.map((r) => ({ key: r.key, label: r.label, level: r.level, rank: r.rank })),
    roles: c.allRoles.filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING).map(roleOut_),
  };
  if (!c.active.length) {
    out.status = c.allRoles.some((r) => r.status === ST.PENDING) ? 'pending' : 'new';
    if (out.status === 'pending') out.approvers = pendingApproversText_(c);
    return out;
  }
  out.status = 'active';
  out.events = API.events(c);
  const myTeams = {};
  c.roles.forEach((r) => { if (r.level === 'team' && st.team[r.unitId]) myTeams[r.unitId] = true; });
  out.caps = {
    report: { club: reportTeams_(c, RANK.CLUB), mg: reportTeams_(c, RANK.MG), kr: reportTeams_(c, RANK.KR) },
    knownTeams: reportTeams_(c, RANK.KNOWN),
    knownEditTeams: uniq_(c.roles.filter((r) => r.level === 'team' && r.rank <= RANK.KNOWN && loadStruct_().team[r.unitId] && loadStruct_().team[r.unitId].active).map((r) => r.unitId)),
    knownNoTeam: canNoTeam_(c),
    financeTeams: reportTeams_(c, RANK.FINANCE),
    viewTeams: st.teams.filter((t) => t.active && canViewTeam_(c, t.id)).map((t) => t.id),
    approve: canApproveAny_(c),
    eventUnits: eventUnits_(c),
    upper: upperRoles_(c).length > 0,
    sugarOnly: isSugarOnly_(c),
    surveys: false,
    manage: c.roles.some((r) => MANAGE_AREAS.indexOf(r.key) >= 0 || MANAGE_TEAMS.indexOf(r.key) >= 0),
    myyl: allowedScopes_(c).length > 0,
    reportItems: reportItems_(c),
    broadcast: canBroadcast_(c),
    isSuper: isSuper_(c),
  };
  out.myTeams = Object.keys(myTeams).map(teamOut_);
  out.scopes = allowedScopes_(c);
  out.week = weekStatus_(c);
  out.pendingCount = out.caps.approve ? pendingFor_(c).filter((r) => primaryApprovers_(r).indexOf(c.id) >= 0).length : 0;
  if (out.caps.upper) out.scopeCard = scopeCard_(c);
  return out;
};

API.register = function (c, d) {
  const name = str_(d.name);
  if (name.length < 2) bad_('Вкажи імʼя та прізвище.');
  if (!d.roles || !d.roles.length) bad_('Обери хоча б одну роль.');
  savePerson_(c, { name: name, phone: d.phone, email: d.email });
  return requestRoles_(c, d);
};

API.requestRoles = function (c, d) {
  if (!getPerson_(c.id)) bad_('Спершу зареєструйся.');
  return requestRoles_(c, d);
};

function requestRoles_(c, d) {
  const st = loadStruct_();
  let teamId = str_(d.teamId);
  const areaId = str_(d.areaId);
  const regionId = str_(d.regionId) || (st.area[areaId] || {}).regionId || '';
  const keys = (d.roles || []).map(String).filter((k) => roleDef_(k) && k !== 'SUPER');
  if (!keys.length) bad_('Обери хоча б одну роль.');
  const needTeam = keys.some((k) => roleDef_(k).level === 'team');
  if (needTeam && teamId && !st.team[teamId]) bad_('Команду не знайдено.');
  if (!isSuper_(c) && keys.some((k) => roleDef_(k).rank <= RANK.GMAIL) && !/@/.test(str_(d.email) || (getPerson_(c.id) || {}).email || '')) {
    bad_('Для ролі Капітан і вище вкажи Gmail — на нього відкриється доступ до таблиць.');
  }
  if (needTeam && !teamId) {
    const newName = str_(d.newTeamName);
    if (!newName) bad_('Обери команду або впиши назву нової.');
    if (!st.area[areaId]) bad_('Обери ерію.');
    teamId = createTeam_(areaId, newName, false);
  }
  if (d.email) savePerson_(c, { email: d.email });
  const existing = loadRoles_().filter((r) => r.tgId === c.id && (r.status === ST.ACTIVE || r.status === ST.PENDING));
  const created = [];
  const sup = isSuper_(c);
  keys.forEach((k) => {
    const def = roleDef_(k);
    const unitId = def.level === 'team' ? teamId : def.level === 'area' ? areaId : def.level === 'region' ? regionId : '';
    if (def.level !== 'nat' && !unitId) bad_('Не вказано, де саме роль «' + def.label + '».');
    if (existing.some((r) => r.key === k && r.unitId === unitId)) return;
    // Раб Божий не чекає на підтвердження власних ролей
    if (sup && def.level === 'team') activateTeam_(unitId);
    const row = { id: uid_(), tgId: c.id, name: c.name, key: k, level: def.level, unitId: unitId, status: sup ? ST.ACTIVE : ST.PENDING, decidedBy: sup ? c.name : '', decided: sup ? nowIso() : '' };
    insertRole_(row);
    created.push(row.id);
  });
  if (sup) return { status: 'active', approvers: '' };
  if (created.length) notifyApprovers_(c, created);
  return { status: 'pending', approvers: pendingApproversText_(ctx_(c.tg)) };
}

API.requests = function (c) {
  if (!canApproveAny_(c)) deny_();
  const byPerson = {};
  pendingFor_(c).forEach((r) => {
    const p = byPerson[r.tgId] = byPerson[r.tgId] || { tgId: r.tgId, name: r.name, username: '', when: r.requested, roles: [], primary: false };
    const person = getPerson_(r.tgId);
    if (person) { p.username = person.username; p.phone = person.phone; p.name = person.name || p.name; }
    const o = roleOut_(r);
    o.primary = primaryApprovers_(r).indexOf(c.id) >= 0;
    if (o.primary) p.primary = true;
    p.roles.push(o);
  });
  return Object.keys(byPerson).map((k) => byPerson[k]).sort((a, b) => (b.primary - a.primary));
};

API.decide = function (c, d) {
  const ids = (d.roleIds || []).map(String);
  const approve = !!d.approve;
  const done = [];
  loadRoles_().filter((r) => ids.indexOf(r.id) >= 0 && r.status === ST.PENDING).forEach((r) => {
    if (!canDecide_(c, r)) deny_('Ти не можеш вирішувати щодо ролі «' + r.label + '».');
    if (approve && r.level === 'team') activateTeam_(r.unitId);
    setRoleStatus_(r, approve ? ST.ACTIVE : ST.REJECTED, c.name);
    done.push(r);
  });
  if (!done.length) return { done: 0 };
  const tgId = done[0].tgId;
  if (approve) sendApp_(tgId, '🎉 Доступ відкрито!\nРолі: <b>' + esc_(done.map((r) => r.label + ' · ' + unitName_(r.level, r.unitId)).join(', ')) + '</b>', 'Відкрити застосунок');
  else S.send(tgId, 'Заявку на роль «' + esc_(done.map((r) => r.label).join(', ')) + '» не підтверджено. Якщо це помилка — звернись до свого керівника.');
  return { done: done.length };
};

API.removeRole = function (c, d) {
  const r = loadRoles_().filter((x) => x.id === String(d.roleId) && x.status === ST.ACTIVE)[0];
  if (!r) bad_('Роль не знайдено.');
  if (r.tgId !== c.id && !canDecide_(c, r)) deny_();
  setRoleStatus_(r, ST.REMOVED, c.name);
  return { ok: true };
};

API.saveProfile = function (c, d) {
  if (!getPerson_(c.id)) bad_('Спершу зареєструйся.');
  savePerson_(c, d);
  return profileOf_(getPerson_(c.id));
};

// ── звіти ──
API.saveReport = function (c, d) {
  const type = d.type;
  const rank = { club: RANK.CLUB, mg: RANK.MG, kr: RANK.KR }[type];
  if (!rank) bad_('Невідомий тип звіту.');
  const teamId = str_(d.teamId);
  if (reportTeams_(c, rank).indexOf(teamId) < 0) deny_('Ти не можеш вносити цей звіт для цієї команди.');
  const mode = MODE[d.mode] ? d.mode : 'event';
  const today = kyivDay(new Date());
  const date = mode === 'event' && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : today;
  const week = weekKey_(date);
  const n = (v) => { const x = Number(v); return isFinite(x) && x >= 0 ? x : 0; };
  const none = mode === 'none';
  const st = loadStruct_();
  const team = st.team[teamId];
  const row = {
    id: uid_(), created: nowIso(), date: date, week: week, type: type, mode: MODE[mode], team_id: teamId, area_id: team.areaId, region_id: st.teamRegion(teamId),
    count: none || type === 'kr' ? 0 : n(d.teens), new_t: none || type === 'kr' ? 0 : n(d.newT), leaders: none || type !== 'club' ? 0 : n(d.leaders),
    hours: none || type !== 'kr' ? 0 : n(d.hours), topic: type === 'mg' ? clip_(d.topic) : '', note: clip_(d.note),
    attendees: (d.attendees || []).map(String).join(','), author_id: c.id, author: c.name,
  };
  const keys = Object.keys(row);
  S.run('INSERT INTO reports (' + keys.join(', ') + ') VALUES (' + keys.map(() => '?').join(',') + ')', keys.map((k) => row[k]));
  S.log.push(logFromRow(row));
  return { week: weekStatus_(c) };
};

// ── знані по імені ──
const canKnown_ = (c, teamId) => canTeam_(c, teamId, RANK.KNOWN);

const STAGES = [['meet', 'Хочу познайомитись'], ['friends', 'Дружимо'], ['grow', 'Допомагаю зростати в вірі'], ['own', 'Йдуть самі']];
const stageOk_ = (v) => STAGES.some((x) => x[0] === v);
const stageSum_ = (teamIds, stage) => teamIds.reduce((a, id) => a + (Number(((S.knownStages || {})[id] || {})[stage]) || 0), 0);

// бачать: команда (Помічник+) і вищі рівні; додають і змінюють — лише учасники цієї команди; «Без команди» — особистий список автора
const canKnownEdit_ = (c, teamId) => teamRoles_(c, teamId, RANK.KNOWN).length > 0;
const canNoTeam_ = (c) => c.roles.length > 0 && !isSugarOnly_(c);
const canRowView_ = (c, r) => (r.team_id ? canKnown_(c, r.team_id) : r.author_id === c.id);
const canRowEdit_ = (c, r) => (r.team_id ? canKnownEdit_(c, r.team_id) : r.author_id === c.id);
const NO_TEAM = 'Без команди';

API.knownList = function (c, d) {
  const st = loadStruct_();
  let rows;
  if (d.mine) rows = (S.knownMine || []).filter((r) => r.active && canRowView_(c, r));
  else {
    const teams = pickTeams_(c, d, canKnown_);
    if (!teams.length) deny_();
    rows = [].concat.apply([], teams.map((id) => (S.known[id] || []).filter((r) => r.active)));
  }
  return rows.map((r) => Object.assign(knownOut_(r), { teamId: r.team_id || '', team: r.team_id ? (st.team[r.team_id] || {}).name || '' : NO_TEAM, canEdit: canRowEdit_(c, r) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

function knownTargetCheck_(c, teamId) {
  if (teamId) { if (!loadStruct_().team[teamId]) bad_('Команду не знайдено.'); if (!canKnownEdit_(c, teamId)) deny_('Додавати знаних у команду можуть лише її учасники.'); }
  else if (!canNoTeam_(c)) deny_();
}

API.knownBulk = function (c, d) {
  const teamId = str_(d.teamId);
  knownTargetCheck_(c, teamId);
  const stage = stageOk_(d.stage) ? d.stage : 'meet';
  const pool = teamId ? (S.known[teamId] || []) : (S.knownMine || []).filter((r) => !r.team_id);
  const have = {};
  pool.filter((r) => r.active).forEach((r) => { have[String(r.name).toLowerCase()] = true; });
  const names = [];
  String(d.names || '').split(/[\n;,]+/).forEach((x) => {
    const n = x.replace(/^[\s\d.)•\-–]+/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (n.length < 2 || have[n.toLowerCase()]) return;
    have[n.toLowerCase()] = true;
    names.push(n);
  });
  if (!names.length) bad_('Немає нових імен: впиши кожне з нового рядка (ті, що вже є в списку, пропускаються).');
  if (names.length > 300) bad_('За раз — до 300 імен.');
  const now = nowIso(), day = kyivDay(new Date());
  const rows = names.map((n) => ({ id: uid_(), n: n }));
  S.run("INSERT INTO known (id, team_id, name, added, active, updated, stage, author_id, phone, ig, bday, school, grade, leader, note) SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.n'), ?, 1, ?, ?, ?, '', '', '', '', '', '', '' FROM json_each(?)",
    [teamId, day, now, stage, c.id, JSON.stringify(rows)]);
  if (teamId) refreshKnownCount_(teamId);
  return { added: names.length };
};

function knownRowFor_(c, d) {
  const r = S.knownRow;
  if (!r || r.id !== str_(d.id || (d.item && d.item.id)) || !r.active) bad_('Не знайдено.');
  if (!canRowEdit_(c, r)) deny_(r.team_id ? 'Змінювати знаних команди можуть лише її учасники.' : 'Це особистий список іншої людини.');
  return r;
}

API.knownStage = function (c, d) {
  if (!stageOk_(d.stage)) bad_('Невідомий етап.');
  const r = knownRowFor_(c, d);
  S.run('UPDATE known SET stage = ?, updated = ? WHERE id = ?', [d.stage, nowIso(), r.id]);
  return { ok: true };
};

API.knownSave = function (c, d) {
  const it = d.item || {};
  if (str_(it.name).length < 2) bad_('Вкажи імʼя.');
  const v = { name: clip_(it.name), phone: clip_(it.phone), ig: clip_(it.ig), bday: clip_(it.bday), school: clip_(it.school), grade: clip_(it.grade), leader: clip_(it.leader), note: clip_(it.note) };
  if (stageOk_(it.stage)) v.stage = it.stage;
  const now = nowIso();
  if (str_(it.id)) {
    const r = knownRowFor_(c, d);
    const keys = Object.keys(v);
    S.run('UPDATE known SET ' + keys.map((k) => k + ' = ?').join(', ') + ', updated = ? WHERE id = ?', keys.map((k) => v[k]).concat([now, r.id]));
    return { id: r.id };
  }
  const teamId = str_(d.teamId);
  knownTargetCheck_(c, teamId);
  const id = uid_();
  const row = Object.assign({ id: id, team_id: teamId, added: kyivDay(new Date()), active: 1, updated: now, stage: 'meet', author_id: c.id }, v);
  const keys = Object.keys(row);
  S.run('INSERT INTO known (' + keys.join(', ') + ') VALUES (' + keys.map(() => '?').join(',') + ')', keys.map((k) => row[k]));
  if (teamId) refreshKnownCount_(teamId);
  return { id: id };
};

API.knownArchive = function (c, d) {
  const r = knownRowFor_(c, d);
  S.run('UPDATE known SET active = 0, updated = ? WHERE id = ?', [nowIso(), r.id]);
  if (r.team_id) refreshKnownCount_(r.team_id);
  return { ok: true };
};

function refreshKnownCount_(teamId) {
  S.run('UPDATE teams SET known = (SELECT COUNT(*) FROM known WHERE team_id = ? AND active = 1) WHERE id = ?', [teamId, teamId], true);
}

// ── склад команди ──
API.teamMembers = function (c, d) {
  const teams = pickTeams_(c, d, canViewTeam_);
  if (!teams.length) deny_();
  const st = loadStruct_();
  const set = {};
  teams.forEach((id) => { set[id] = true; });
  const byPerson = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && set[r.unitId]).forEach((r) => {
    const p = byPerson[r.tgId + '|' + r.unitId] = byPerson[r.tgId + '|' + r.unitId] || { tgId: r.tgId, name: r.name, roles: [], rank: 99, teamId: r.unitId, team: (st.team[r.unitId] || {}).name || '' };
    p.roles.push({ id: r.id, label: r.label, canRemove: canDecide_(c, r) });
    p.rank = Math.min(p.rank, r.rank);
  });
  return Object.keys(byPerson).map((k) => {
    const p = byPerson[k];
    const person = getPerson_(p.tgId);
    if (person) { p.name = person.name || p.name; p.username = person.username; p.profile = profileOf_(person); }
    return p;
  }).sort((a, b) => a.team.localeCompare(b.team) || a.rank - b.rank || a.name.localeCompare(b.name));
};

// ── фінанси ──
// вносять лише Капітан і Адмін саме цієї команди; вищі рівні — тільки дивляться
const canFinEdit_ = (c, teamId) => teamRoles_(c, teamId, RANK.FINANCE).length > 0;

API.financeGet = function (c, d) {
  if (!isSingleTeam_(d)) return financeOverview_(c, d);
  const teamId = Array.isArray(d.units) && d.units.length ? String(d.units[0]).slice(2) : str_(d.teamId);
  if (!canTeam_(c, teamId, RANK.FINANCE)) deny_();
  const rows = (S.finance[teamId] || []).map(finOut_).sort((a, b) => (a.month < b.month ? 1 : -1));
  const month = /^\d{4}-\d{2}$/.test(d.month || '') ? d.month : kyivDay(new Date()).slice(0, 7);
  const cur = rows.filter((r) => r.month === month)[0];
  const prevRow = rows.filter((r) => r.month < month)[0];
  return {
    month: month,
    current: cur || { month: month, prev: prevRow ? prevRow.balance : 0, office: 0, church: 0, team: 0, spent: 0, balance: prevRow ? prevRow.balance : 0 },
    history: rows.filter((r) => r.month !== month).slice(0, 6),
    canEdit: canFinEdit_(c, teamId),
  };
};

function financeOverview_(c, d) {
  const teams = pickTeams_(c, d, (cc, id) => canTeam_(cc, id, RANK.FINANCE));
  if (!teams.length) deny_();
  const st = loadStruct_();
  const month = /^\d{4}-\d{2}$/.test(d.month || '') ? d.month : kyivDay(new Date()).slice(0, 7);
  const tot = { inc: 0, spent: 0, balance: 0, done: 0 };
  const rows = teams.map((id) => {
    const t = st.team[id], f = (S.finMonth || {})[id];
    const row = { teamId: id, name: t.name, area: (st.area[t.areaId] || {}).name || '', done: !!f };
    if (f) {
      row.inc = (f.office || 0) + (f.church || 0) + (f.team || 0); row.spent = f.spent || 0; row.balance = f.balance || 0;
      tot.inc += row.inc; tot.spent += row.spent; tot.balance += row.balance; tot.done++;
    }
    return row;
  }).sort((a, b) => (b.done - a.done) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
  return { mode: 'overview', month: month, rows: rows, total: Object.assign(tot, { teams: teams.length }) };
}

API.financeSave = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canFinEdit_(c, teamId)) deny_('Фінансовий звіт вносять лише Капітан і Адмін команди. Вищі рівні можуть його переглядати.');
  const month = str_(d.month);
  if (!/^\d{4}-\d{2}$/.test(month)) bad_('Невірний місяць.');
  const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const v = { prev: n(d.prev), office: n(d.office), church: n(d.church), team: n(d.team), spent: n(d.spent) };
  v.balance = v.prev + v.office + v.church + v.team - v.spent;
  S.run('INSERT INTO finance (team_id, month, prev, office, church, team, spent, balance, author, updated) VALUES (?,?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT (team_id, month) DO UPDATE SET prev = excluded.prev, office = excluded.office, church = excluded.church, team = excluded.team, spent = excluded.spent, balance = excluded.balance, author = excluded.author, updated = excluded.updated',
  [teamId, month, v.prev, v.office, v.church, v.team, v.spent, v.balance, c.name, nowIso()]);
  return v;
};

// ── календар ──
function eventUnits_(c) {
  const out = [];
  const seen = {};
  c.roles.forEach((r) => {
    if (r.level === 'team' && r.rank > RANK.EVENT) return;
    const k = r.level + ':' + r.unitId;
    if (seen[k]) return;
    seen[k] = true;
    out.push({ level: r.level, unitId: r.unitId, label: levelLabel_(r.level, r.unitId) });
    if (r.key === 'SUPER') loadStruct_().regions.forEach((x) => {
      if (seen['region:' + x.id]) return;
      seen['region:' + x.id] = true;
      out.push({ level: 'region', unitId: x.id, label: levelLabel_('region', x.id) });
    });
  });
  return out;
}
function ancestors_(level, unitId) {
  const st = loadStruct_();
  const out = [{ level: level, unitId: unitId }];
  if (level === 'team') { const t = st.team[unitId]; if (t) { out.push({ level: 'area', unitId: t.areaId }); out.push({ level: 'region', unitId: st.teamRegion(unitId) }); } }
  if (level === 'area') { const a = st.area[unitId]; if (a) out.push({ level: 'region', unitId: a.regionId }); }
  if (level !== 'nat') out.push({ level: 'nat', unitId: '' });
  return out;
}
function canSeeEvent_(c, ev) {
  if (ev.authorId === c.id || canManageEvent_(c, ev)) return true;
  const roles = ev.roles || [];
  if ((ev.aud && ev.aud.length) || roles.length) {
    const aud = (ev.aud && ev.aud.length ? ev.aud : [unitKey_(ev.level, ev.unitId)]).map(keyUnit_);
    return (c.active || c.roles).some((r) => aud.some((u) => (!roles.length || roles.indexOf(r.key) >= 0) && (within_(u, r) || (!roles.length && covers_(r, u.level, u.unitId)))));
  }
  return (c.active || c.roles).some((r) => covers_(r, ev.level, ev.unitId) || ancestors_(r.level, r.unitId).some((a) => a.level === ev.level && a.unitId === ev.unitId));
}
function canManageEvent_(c, ev) {
  if (ev.authorId === c.id) return true;
  return c.roles.some((r) => r.rank <= RANK.APPROVE && covers_(r, ev.level, ev.unitId));
}

API.events = function (c) {
  const today = kyivDay(new Date());
  return loadEvents_().filter((e) => (e.end || e.date) >= today && canSeeEvent_(c, e)).map((e) => {
    const people = S.rsvp.filter((r) => r.eventId === e.id);
    const manage = canManageEvent_(c, e);
    return Object.assign({}, e, {
      levelLabel: levelLabel_(e.level, e.unitId), going: people.length,
      rolesLabel: (e.roles || []).map((k) => (roleDef_(k) || {}).label).filter(Boolean).join(', '),
      audLabel: (e.aud || []).map(unitLabel_).join(', '),
      isGoing: people.some((r) => r.tgId === c.id),
      manage: manage,
      people: manage ? people.map((r) => ({ name: r.name, team: r.team })) : [],
    });
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1));
};

API.eventSave = function (c, d) {
  const old = d.id ? loadEvents_().filter((x) => x.id === str_(d.id))[0] : null;
  const u = eventUnits_(c).filter((x) => x.level === d.level && x.unitId === str_(d.unitId))[0] ||
    (old && old.level === d.level && old.unitId === str_(d.unitId) ? { level: old.level, unitId: old.unitId } : null);
  if (!u) deny_('Ти не можеш додавати події на цьому рівні.');
  if (str_(d.title).length < 2) bad_('Вкажи назву.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) bad_('Вкажи дату.');
  const end = /^\d{4}-\d{2}-\d{2}$/.test(d.end || '') && d.end > d.date ? d.end : '';
  if (d.end && /^\d{4}-\d{2}-\d{2}$/.test(d.end) && d.end < d.date) bad_('Дата кінця раніше за дату початку.');
  const roles = uniq_((d.roles || []).map(String).filter((k) => roleDef_(k)));
  const rolesStr = roles.length ? ',' + roles.join(',') + ',' : '';
  const ownerKey = unitKey_(u.level, u.unitId);
  const aud = uniq_((d.aud || []).map(String)).filter((k) => { const x = keyUnit_(k); return x.level && (k === ownerKey || covers_({ level: u.level, unitId: u.unitId }, x.level, x.unitId)); }).slice(0, 60);
  const audList = aud.length === 1 && aud[0] === ownerKey ? [] : aud;
  const audStr = audList.length ? ',' + audList.join(',') + ',' : '';
  if (d.id) {
    const ex = loadEvents_().filter((x) => x.id === str_(d.id))[0];
    if (!ex) bad_('Подію не знайдено.');
    if (!canManageEvent_(c, ex)) deny_('Редагувати подію може автор або керівник цього рівня.');
    Object.assign(ex, { level: u.level, unitId: u.unitId, title: clip_(d.title), date: d.date, end: end, time: clip_(d.time), place: clip_(d.place), desc: clip_(d.desc), roles: roles, aud: audList });
    S.run('UPDATE events SET level = ?, unit_id = ?, title = ?, date = ?, end_date = ?, time = ?, place = ?, descr = ?, roles = ?, aud = ? WHERE id = ?',
      [ex.level, ex.unitId, ex.title, ex.date, ex.end || null, ex.time, ex.place, ex.desc, rolesStr, audStr, ex.id]);
    return { id: ex.id };
  }
  const e = { id: uid_(), level: u.level, unitId: u.unitId, title: clip_(d.title), date: d.date, end: end, time: clip_(d.time), place: clip_(d.place), desc: clip_(d.desc), authorId: c.id, author: c.name, roles: roles, aud: audList };
  S.run('INSERT INTO events (id, level, unit_id, title, date, end_date, time, place, descr, author_id, author, created, roles, aud) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [e.id, e.level, e.unitId, e.title, e.date, e.end || null, e.time, e.place, e.desc, e.authorId, e.author, nowIso(), rolesStr, audStr]);
  S.events.push(e);
  rsvpSet_(c, e.id, true);
  return { id: e.id };
};

API.eventDelete = function (c, d) {
  const e = loadEvents_().filter((x) => x.id === str_(d.id))[0];
  if (!e) bad_('Подію не знайдено.');
  if (!canManageEvent_(c, e)) deny_();
  S.run('DELETE FROM events WHERE id = ?', [e.id]);
  S.run('DELETE FROM rsvp WHERE event_id = ?', [e.id]);
  return { ok: true };
};

API.rsvp = function (c, d) {
  const e = loadEvents_().filter((x) => x.id === str_(d.id))[0];
  if (!e || !canSeeEvent_(c, e)) deny_();
  rsvpSet_(c, e.id, !!d.going);
  return { ok: true };
};

function rsvpSet_(c, eventId, going) {
  if (going) {
    const team = c.roles.filter((r) => r.level === 'team')[0];
    const teamName = team ? unitName_('team', team.unitId) : '';
    S.run('INSERT OR IGNORE INTO rsvp (event_id, tg_id, name, team, created) VALUES (?,?,?,?,?)', [eventId, c.id, c.name, teamName, nowIso()]);
    if (!S.rsvp.some((r) => r.eventId === eventId && r.tgId === c.id)) S.rsvp.push({ eventId: eventId, tgId: c.id, name: c.name, team: teamName });
  } else {
    S.run('DELETE FROM rsvp WHERE event_id = ? AND tg_id = ?', [eventId, c.id]);
    S.rsvp = S.rsvp.filter((r) => !(r.eventId === eventId && r.tgId === c.id));
  }
}

// ── структура: ерії й команди ──
function canEditAreas_(c, regionId) {
  return c.roles.some((r) => r.key === 'SUPER' || (MANAGE_AREAS.indexOf(r.key) >= 0 && r.level === 'region' && r.unitId === regionId));
}
function canEditTeams_(c, areaId) { return c.roles.some((r) => MANAGE_TEAMS.indexOf(r.key) >= 0 && covers_(r, 'area', areaId)); }
function cleanName_(v) {
  const n = str_(v).replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) bad_('Назва має бути від 2 до 60 символів.');
  return n;
}

API.structureTree = function (c) {
  const st = loadStruct_();
  const people = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team').forEach((r) => { (people[r.unitId] = people[r.unitId] || {})[r.tgId] = true; });
  return st.regions.map((rg) => {
    const editAreas = canEditAreas_(c, rg.id);
    const areas = st.areas.filter((a) => a.regionId === rg.id && (editAreas || canEditTeams_(c, a.id))).map((a) => ({
      id: a.id, name: a.name, canEditTeams: canEditTeams_(c, a.id),
      teams: st.teams.filter((t) => t.areaId === a.id).map((t) => ({ id: t.id, name: t.name, state: t.state, people: Object.keys(people[t.id] || {}).length }))
        .sort((x, y) => (x.state === 'closed') - (y.state === 'closed') || x.name.localeCompare(y.name)),
    })).sort((x, y) => x.name.localeCompare(y.name));
    return { id: rg.id, name: rg.name, canEditAreas: editAreas, areas: areas };
  }).filter((rg) => rg.canEditAreas || rg.areas.length);
};

API.areaSave = function (c, d) {
  const st = loadStruct_();
  if (!d.id && !canEditAreas_(c, str_(d.regionId))) deny_('Ти не можеш додавати ерії в цей регіон.');
  const name = cleanName_(d.name);
  if (d.id) {
    const a = st.area[str_(d.id)];
    if (!a) bad_('Ерію не знайдено.');
    if (!canEditAreas_(c, a.regionId)) deny_('Ти не можеш редагувати цю ерію.');
    if (st.areas.some((x) => x.id !== a.id && x.regionId === a.regionId && x.name.toLowerCase() === name.toLowerCase())) bad_('Така ерія в регіоні вже є.');
    S.run('UPDATE areas SET name = ? WHERE id = ?', [name, a.id], true);
    a.name = name;
    return { id: a.id };
  }
  const regionId = str_(d.regionId);
  if (!st.region[regionId]) bad_('Регіон не знайдено.');
  if (st.areas.some((x) => x.regionId === regionId && x.name.toLowerCase() === name.toLowerCase())) bad_('Така ерія в регіоні вже є.');
  const id = uid_();
  S.run('INSERT INTO areas (id, region_id, name) VALUES (?,?,?)', [id, regionId, name], true);
  const a = { id: id, regionId: regionId, name: name };
  st.areas.push(a); st.area[id] = a;
  return { id: id };
};

API.teamSave = function (c, d) {
  const st = loadStruct_();
  if (d.id) {
    const t = st.team[str_(d.id)];
    if (!t) bad_('Команду не знайдено.');
    if (!canEditTeams_(c, t.areaId)) deny_('Ти не можеш редагувати цю команду.');
    if (d.name != null) {
      const name = cleanName_(d.name);
      if (st.teams.some((x) => x.id !== t.id && x.areaId === t.areaId && x.name.toLowerCase() === name.toLowerCase())) bad_('Така команда в ерії вже є.');
      S.run('UPDATE teams SET name = ? WHERE id = ?', [name, t.id], true);
      t.name = name;
    }
    if (d.state === 'active' || d.state === 'closed') {
      S.run('UPDATE teams SET state = ? WHERE id = ?', [d.state, t.id], true);
      t.state = d.state; t.active = d.state === 'active';
    }
    return { id: t.id };
  }
  const areaId = str_(d.areaId);
  if (!st.area[areaId]) bad_('Ерію не знайдено.');
  if (!canEditTeams_(c, areaId)) deny_('Ти не можеш створювати команди в цій ерії.');
  const name = cleanName_(d.name);
  if (st.teams.some((x) => x.areaId === areaId && x.name.toLowerCase() === name.toLowerCase())) bad_('Така команда в ерії вже є.');
  return { id: createTeam_(areaId, name, true) };
};

// ── Моя команда в MyYL: дерево людей у межах відповідальності ──
API.myylTree = function (c) {
  const st = loadStruct_();
  const scopes = allowedScopes_(c);
  if (!scopes.length) deny_();
  const units = {};
  scopes.forEach((s) => { units[s.key] = { key: s.key, level: s.level, id: s.unitId, name: s.name, sub: s.sub, children: [], people: [], parent: '' }; });
  const parentKey = (u) => {
    if (u.level === 'team') return 'a:' + (st.team[u.id] || {}).areaId;
    if (u.level === 'area') return 'r:' + (st.area[u.id] || {}).regionId;
    if (u.level === 'region') return 'nat';
    return '';
  };
  Object.keys(units).forEach((k) => {
    const u = units[k];
    const pk = parentKey(u);
    if (units[pk]) { u.parent = pk; units[pk].children.push(k); }
  });
  // люди з активними ролями — на тій одиниці, де роль
  const byUnit = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE).forEach((r) => {
    const k = r.level === 'nat' ? 'nat' : (r.level === 'region' ? 'r:' : r.level === 'area' ? 'a:' : 't:') + r.unitId;
    if (!units[k]) return;
    const m = byUnit[k] = byUnit[k] || {};
    const p = m[r.tgId] = m[r.tgId] || { tgId: r.tgId, name: r.name, roles: [], rank: 99 };
    p.roles.push({ label: r.label, rank: r.rank });
    p.rank = Math.min(p.rank, r.rank);
  });
  Object.keys(byUnit).forEach((k) => {
    units[k].people = Object.keys(byUnit[k]).map((id) => {
      const p = byUnit[k][id];
      const person = getPerson_(id) || {};
      return { tgId: id, name: person.name || p.name, username: person.username || '', title: person.title || '', rank: p.rank,
        roles: p.roles.sort((a, b) => a.rank - b.rank).map((x) => x.label) };
    }).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  });
  // підсумки по гілці: люди й команди
  const walk = (k) => {
    const u = units[k];
    const ids = {};
    u.people.forEach((p) => { ids[p.tgId] = true; });
    let teams = u.level === 'team' ? 1 : 0;
    u.children.forEach((ck) => { const r = walk(ck); Object.assign(ids, r.ids); teams += r.teams; });
    u.peopleCount = Object.keys(ids).length;
    u.teamsCount = teams;
    return { ids, teams };
  };
  const roots = Object.keys(units).filter((k) => !units[k].parent);
  roots.forEach(walk);
  Object.keys(units).forEach((k) => {
    const u = units[k];
    u.children.sort((a, b) => units[a].name.localeCompare(units[b].name));
  });
  return { roots: roots, units: units };
};

// ── Підготувати звіт: свій рівень і рівень нижче ──
const REPORT_ITEMS = {
  club: { label: 'Клуби', cols: [['n', 'Клубів'], ['v', 'Відвідувань'], ['avg', 'Середньо'], ['new', 'Нових'], ['rep', 'Звітували, тижнів']] },
  mg: { label: 'Малі групи', cols: [['n', 'Зустрічей'], ['v', 'Відвідувань'], ['avg', 'Середньо'], ['new', 'Нових']] },
  kr: { label: 'Контактна робота', cols: [['h', 'Годин'], ['p', 'Людей вносили'], ['none', 'Відміток «не було»']] },
  known: { label: 'Знані по імені', cols: [['total', 'Знаних зараз'], ['meet', 'Хочу познайомитись'], ['friends', 'Дружимо'], ['grow', 'Зростають у вірі'], ['own', 'Йдуть самі'], ['new', 'Нових за період']] },
  finance: { label: 'Фінанси', cols: [['inc', 'Надійшло, ₴'], ['out', 'Витрачено, ₴'], ['net', 'Різниця, ₴'], ['teams', 'Команд здали']] },
};
const reportScopes_ = (c) => (isSuper_(c) ? allowedScopes_(c) : allowedScopes_(c).filter((s) => s.depth <= 1));
function reportItems_(c) {
  const ok = {};
  reportScopes_(c).forEach((s) => statCats_(c, s).forEach((x) => { if (REPORT_ITEMS[x.key]) ok[x.key] = true; }));
  return Object.keys(REPORT_ITEMS).filter((k) => ok[k]);
}

function reportRow_(teamIds, items, from, to, allowed) {
  const st = loadStruct_();
  const inT = {};
  teamIds.forEach((id) => { inT[id] = true; });
  const rows = loadLog_().filter((r) => inT[r.teamId]);
  const inP = rows.filter((r) => r.date >= from && r.date <= to);
  const ok = (r) => r.mode !== MODE.none;
  const sum = (a, f) => a.reduce((x, r) => x + (Number(f(r)) || 0), 0);
  const nf = (v) => Math.round(v).toLocaleString('uk-UA');
  const df = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const weeks = [];
  for (let k = weekKey_(from); k <= weekKey_(to); k = addDaysKey_(k, 7)) weeks.push(k);
  const out = {};
  items.forEach((it) => {
    if (!allowed[it]) { out[it] = {}; REPORT_ITEMS[it].cols.forEach((c) => { out[it][c[0]] = '—'; }); return; }
    const of = (t) => inP.filter((r) => r.type === t);
    if (it === 'club' || it === 'mg') {
      const a = of(it).filter(ok);
      const v = sum(a, (r) => r.count);
      out[it] = { n: nf(a.length), v: nf(v), avg: a.length ? df(v / a.length) : '—', new: nf(sum(a, (r) => r.newT)) };
      if (it === 'club') {
        const done = {};
        rows.filter((r) => r.type === 'club' && weeks.indexOf(r.week) >= 0).forEach((r) => { done[r.teamId + '|' + r.week] = true; });
        out[it].rep = Object.keys(done).length + ' з ' + (weeks.length * teamIds.length);
      }
    }
    if (it === 'kr') {
      const a = of('kr');
      out[it] = { h: df(sum(a.filter(ok), (r) => r.hours)), p: nf(uniq_(a.filter(ok).map((r) => r.authorId)).length), none: nf(a.filter((r) => !ok(r)).length) };
    }
    if (it === 'known') {
      out[it] = { total: nf(teamIds.reduce((x, id) => x + (Number((st.team[id] || {}).known) || 0), 0)), new: nf(of('known').length) };
      STAGES.forEach((x) => { out[it][x[0]] = nf(stageSum_(teamIds, x[0])); });
    }
    if (it === 'finance') {
      const f = rows.filter((r) => r.type === 'fin' && r.date.slice(0, 7) >= from.slice(0, 7) && r.date.slice(0, 7) <= to.slice(0, 7));
      out[it] = { inc: nf(sum(f, (r) => r.inc)), out: nf(sum(f, (r) => r.spent)), net: nf(sum(f, (r) => r.inc - r.spent)), teams: uniq_(f.map((r) => r.teamId)).length + ' з ' + teamIds.length };
    }
  });
  return out;
}

API.report = function (c, d) {
  const scopes = reportScopes_(c);
  const byKey = {};
  allowedScopes_(c).forEach((s) => { byKey[s.key] = s; });
  const keys = uniq_((d.units || []).map(String)).filter((k) => scopes.some((s) => s.key === k));
  if (!keys.length) bad_('Обери хоча б один регіон, ерію чи команду.');
  if (keys.length > 40) bad_('Забагато одиниць: максимум 40.');
  const avail = reportItems_(c);
  const items = Object.keys(REPORT_ITEMS).filter((k) => (d.items || []).indexOf(k) >= 0 && avail.indexOf(k) >= 0);
  if (!items.length) bad_('Обери, що має бути у звіті.');
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(d.from || '') || !re.test(d.to || '') || d.to < d.from) bad_('Перевір період: дата кінця має бути не раніше за дату початку.');
  if (d.from < addDaysKey_(d.to, -400)) bad_('Період — не довше року.');
  const from = d.from, to = d.to;
  const allowedFor = (s) => { const a = {}; statCats_(c, s).forEach((x) => { a[x.key] = true; }); return a; };
  const LVL = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '' };
  const rows = [];
  const union = {};
  keys.forEach((k) => {
    const s = byKey[k];
    const ids = scopeTeamIds_(s);
    ids.forEach((id) => { union[id] = true; });
    rows.push({ name: LVL[s.level] + s.name, sub: s.sub, level: s.level, child: false, values: reportRow_(ids, items, from, to, allowedFor(s)) });
    if (d.split && s.level !== 'team') {
      Object.keys(byKey).map((x) => byKey[x]).filter((x) => x.parent === k).sort((a, b) => a.name.localeCompare(b.name)).forEach((ch) => {
        rows.push({ name: LVL[ch.level] + ch.name, sub: '', level: ch.level, child: true, values: reportRow_(scopeTeamIds_(ch), items, from, to, allowedFor(ch)) });
      });
    }
  });
  let total = null;
  if (keys.length > 1) {
    const allow = {};
    items.forEach((it) => { allow[it] = keys.every((k) => allowedFor(byKey[k])[it]); });
    total = { name: 'Разом', values: reportRow_(Object.keys(union), items, from, to, allow) };
  }
  const fmt = (k) => { const p = k.split('-'); return Number(p[2]) + '.' + p[1] + '.' + p[0]; };
  const out = {
    title: 'Звіт Young Life', period: fmt(from) + ' – ' + fmt(to), from, to, author: c.name, created: kyivDay(new Date()),
    sections: items.map((it) => ({ key: it, label: REPORT_ITEMS[it].label, cols: REPORT_ITEMS[it].cols.map((x) => ({ key: x[0], label: x[1] })) })),
    rows, total,
  };
  if (d.send) {
    const names = keys.map((k) => byKey[k].name).slice(0, 3).join(', ') + (keys.length > 3 ? ' та ін.' : '');
    S.sendDoc(c.id, 'YL-zvit-' + from + '_' + to + '.html', reportHtml_(out), '📊 <b>Звіт Young Life</b>\n' + esc_(names) + '\n' + esc_(out.period));
    out.sent = true;
  }
  return out;
};

function reportHtml_(r) {
  const e = esc_;
  const table = (sec) => '<h2>' + e(sec.label) + '</h2><div class="w"><table><thead><tr><th></th>' + sec.cols.map((c) => '<th>' + e(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
    r.rows.map((row) => '<tr class="' + (row.child ? 'ch' : 'top') + '"><td>' + (row.child ? '↳ ' : '') + e(row.name) + '</td>' + sec.cols.map((c) => '<td>' + e(row.values[sec.key][c.key]) + '</td>').join('') + '</tr>').join('') +
    (r.total ? '<tr class="tot"><td>' + e(r.total.name) + '</td>' + sec.cols.map((c) => '<td>' + e(r.total.values[sec.key][c.key]) + '</td>').join('') + '</tr>' : '') +
    '</tbody></table></div>';
  return '<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(r.title + ' · ' + r.period) + '</title><style>' +
    'body{font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#1d1d1f;margin:0;padding:24px;max-width:960px;margin:auto}' +
    '.hd{border-left:6px solid #ff7a59;padding:4px 0 4px 14px;margin-bottom:20px}h1{font-size:24px;margin:0}.m{color:#6b6b70;font-size:13px}' +
    'h2{font-size:17px;margin:26px 0 8px}.w{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:420px}' +
    'th,td{padding:8px 10px;border-bottom:1px solid #e6e6ea;text-align:right;white-space:nowrap}th{font-size:12px;color:#6b6b70;font-weight:600}' +
    'td:first-child,th:first-child{text-align:left;white-space:normal}tr.top td{font-weight:600}tr.ch td{color:#444}tr.ch td:first-child{padding-left:22px}' +
    'tr.tot td{font-weight:700;border-top:2px solid #1d1d1f;background:#fff4ef}@media print{body{padding:0}}</style></head><body>' +
    '<div class="hd"><h1>' + e(r.title) + '</h1><div class="m">Період: ' + e(r.period) + ' · сформував(ла): ' + e(r.author) + ' · ' + e(r.created) + '</div></div>' +
    r.sections.map(table).join('') +
    '<p class="m" style="margin-top:28px">«Звітували, тижнів» — скільки тижнів команди внесли звіт про клуб (разом з «не було») з усіх можливих. «—» — немає доступу до цих даних.</p></body></html>';
}

// ── розсилка від Раба Божого ──
const canBroadcast_ = (c) => c.roles.some((r) => r.rank <= RANK.APPROVE);
function bcRecipients_(c, d) {
  const p = pickScope_(c, Array.isArray(d.units) && d.units.length ? d.units : [allowedScopes_(c)[0] && allowedScopes_(c)[0].key]);
  if (!p.scope) deny_();
  const units = p.scope.level === 'multi' ? p.scope.members : [p.scope];
  const roles = uniq_((d.roles || []).map(String).filter((k) => roleDef_(k)));
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && (!roles.length || roles.indexOf(r.key) >= 0) && units.some((u) => within_(u, r)));
  let ids = uniq_(act.map((r) => r.tgId));
  ids = ids.filter((id) => id !== c.id && wants_(id, 'bc'));
  // Раб Божий, уся Україна, усім — також тим, хто ще чекає підтвердження
  if (isSuper_(c) && d.pending && !roles.length && units.some((u) => u.level === 'nat')) ids = uniq_(ids.concat(Object.keys(S.b.people).filter((id) => id !== c.id && wants_(id, 'bc'))));
  const LV = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '' };
  const where = units.map((u) => LV[u.level] + (u.level === 'nat' ? 'Україна' : u.name)).join(', ');
  const who = roles.length ? roles.map((k) => roleDef_(k).label).join(', ') : 'усі';
  return { ids: ids, label: where + ' · ' + who };
}

API.broadcastInfo = function (c, d) {
  if (!canBroadcast_(c)) deny_();
  const r = bcRecipients_(c, d || {});
  return {
    count: r.ids.length, label: r.label, isSuper: isSuper_(c),
    history: (S.broadcasts || []).filter((b) => isSuper_(c) || b.author_id === c.id).slice(0, 5).map((b) => ({ text: b.text, audience: b.audience, count: b.count, created: b.created, author: b.author })),
    queued: S.queued || 0,
  };
};

API.broadcast = function (c, d) {
  if (!canBroadcast_(c)) deny_('Писати можуть Капітан і вищі ролі.');
  const text = String(d.text || '').trim();
  if (text.length < 2) bad_('Напиши текст повідомлення.');
  if (text.length > 3500) bad_('Задовге повідомлення: максимум 3500 символів.');
  const r = bcRecipients_(c, d);
  if (!r.ids.length) bad_('За цим вибором ще нікого немає.');
  const top = c.roles.slice().sort((a, b) => a.rank - b.rank)[0];
  const head = '📣 <b>' + esc_(c.name) + '</b>' + (top ? ' · ' + esc_(top.label + (top.level === 'nat' ? '' : ' · ' + unitName_(top.level, top.unitId))) : '') + '\n\n';
  const body = head + esc_(text);
  r.ids.forEach((id) => {
    if (d.button === false) S.send(id, body);
    else sendApp_(id, body, 'Відкрити Young Life');
  });
  S.run('INSERT INTO broadcasts (id, text, audience, count, author, created, author_id) VALUES (?,?,?,?,?,?,?)', [uid_(), text, r.label, r.ids.length, c.name, nowIso(), c.id]);
  return { sent: r.ids.length, audience: r.label };
};

// ── вибір однієї або кількох одиниць ──
function pickScope_(c, keys) {
  const scopes = allowedScopes_(c);
  const by = {};
  scopes.forEach((x) => { by[x.key] = x; });
  const sel = uniq_((keys || []).map(String)).map((k) => by[k]).filter(Boolean).slice(0, 60);
  if (sel.length < 2) return { scopes: scopes, scope: sel[0] || null };
  const LV = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '' };
  return { scopes: scopes, scope: { key: 'm:' + sel.map((x) => x.key).join(','), level: 'multi', unitId: '', name: 'Вибрано: ' + sel.length, label: sel.map((x) => LV[x.level] + x.name).join(', '), sub: '', parent: '', members: sel } };
}
const keysOf_ = (d) => (Array.isArray(d.units) && d.units.length ? d.units : d.scope ? [d.scope] : []);
// команди з вибраних одиниць, до яких є доступ
function pickTeams_(c, d, can) {
  let ids;
  if (Array.isArray(d.units) && d.units.length) { const p = pickScope_(c, d.units); ids = p.scope ? scopeTeamIds_(p.scope) : []; }
  else ids = d.teamId ? [str_(d.teamId)] : [];
  return ids.filter((id) => can(c, id));
}

// ── статистика ──
API.stats = function (c, d) {
  const p = pickScope_(c, keysOf_(d));
  const scopes = p.scopes;
  const scope = p.scope || scopes[0];
  if (!scope) deny_();
  const cats = statCats_(c, scope);
  const cat = cats.some((x) => x.key === d.cat) ? d.cat : cats[0].key;
  return computeStats_(c, scope, cat, d.period || 'month', cats, scopes);
};

API.nudge = function (c, d) {
  if (!c.roles.some((r) => r.rank <= RANK.APPROVE)) deny_();
  const scope = pickScope_(c, keysOf_(d)).scope;
  if (!scope) deny_();
  const type = d.type;
  if (!TYPE_LABEL[type]) bad_('Невідомий тип.');
  const miss = missingFor_(scope, type);
  miss.people.filter((tgId) => wants_(tgId, 'remind')).forEach((tgId) => sendApp_(tgId, '🔔 Нагадування: заповни, будь ласка, «' + TYPE_LABEL[type] + '» за цей тиждень. Якщо не було — так і відміть.', 'Відкрити'));
  return { sent: miss.people.length };
};

function statsFromWeek(period) {
  const nowWk = weekKey_(new Date());
  const weeks = period === 'year' ? 53 : period === 'q' ? 13 : 8;
  return addDaysKey_(nowWk, -7 * weeks);
}

function allowedScopes_(c) {
  const st = loadStruct_();
  const seen = {};
  const out = [];
  const add = (key, label, depth, level, unitId, sub, name, parent) => { if (seen[key]) return; seen[key] = true; out.push({ key, label, depth, level, unitId, sub: sub || '', name: name || label, parent: parent || '' }); };
  const addTeam = (t, depth) => { if (t.active) { const a = st.area[t.areaId] || {}; add('t:' + t.id, t.name, depth, 'team', t.id, (a.name || '') + ' · ' + ((st.region[a.regionId] || {}).name || ''), t.name, 'a:' + t.areaId); } };
  const addArea = (a, depth) => { add('a:' + a.id, 'Ерія ' + a.name, depth, 'area', a.id, 'регіон ' + ((st.region[a.regionId] || {}).name || ''), a.name, 'r:' + a.regionId); st.teams.filter((t) => t.areaId === a.id).forEach((t) => addTeam(t, depth + 1)); };
  const addRegion = (r, depth) => { add('r:' + r.id, 'Регіон ' + r.name, depth, 'region', r.id, '', r.name, 'nat'); st.areas.filter((a) => a.regionId === r.id).forEach((a) => addArea(a, depth + 1)); };
  c.roles.slice().sort((a, b) => a.rank - b.rank).forEach((r) => {
    if (r.level === 'nat') { add('nat', 'Уся Україна', 0, 'nat', '', '', 'Україна'); st.regions.forEach((x) => addRegion(x, 1)); }
    if (r.level === 'region' && st.region[r.unitId]) addRegion(st.region[r.unitId], 0);
    if (r.level === 'area' && st.area[r.unitId]) addArea(st.area[r.unitId], 0);
    if (r.level === 'team' && st.team[r.unitId]) addTeam(st.team[r.unitId], 0);
  });
  return out;
}

function scopeTeamIds_(scope) {
  const st = loadStruct_();
  if (scope.level === 'multi') return uniq_([].concat.apply([], scope.members.map(scopeTeamIds_)));
  return st.teams.filter((t) => {
    if (!t.active) return false;
    if (scope.level === 'nat') return true;
    if (scope.level === 'region') return st.teamRegion(t.id) === scope.unitId;
    if (scope.level === 'area') return t.areaId === scope.unitId;
    return t.id === scope.unitId;
  }).map((t) => t.id);
}

function statCats_(c, scope) {
  if (isSugarOnly_(c)) return [{ key: 'club', label: 'Клуби' }];
  if (scope.level === 'multi') {
    const lists = scope.members.map((m) => statCats_(c, m).map((x) => x.key));
    return statCats_(c, scope.members[0]).filter((x) => lists.every((l) => l.indexOf(x.key) >= 0));
  }
  const cats = [{ key: 'overview', label: 'Огляд' }, { key: 'people', label: 'Команда' }, { key: 'club', label: 'Клуби' }, { key: 'mg', label: 'Малі групи' }, { key: 'kr', label: 'Контактна робота' }];
  const upperCovers = upperRoles_(c).some((r) => covers_(r, scope.level, scope.unitId));
  const teamOk = (rank) => scope.level === 'team' && teamRoles_(c, scope.unitId, rank).length > 0;
  if (upperCovers || teamOk(RANK.KNOWN)) cats.push({ key: 'known', label: 'Знані' });
  if (upperCovers || teamOk(RANK.FINANCE)) cats.push({ key: 'finance', label: 'Фінанси' });
  return cats;
}

function computeStats_(c, scope, cat, period, cats, scopes) {
  const st = loadStruct_();
  const teamIds = scopeTeamIds_(scope);
  const inScope = {};
  teamIds.forEach((id) => { inScope[id] = true; });
  const P = { week: 1, month: 4, q: 13, year: 52 }[period] || 4;
  const nowWk = weekKey_(new Date());
  const periodStart = addDaysKey_(nowWk, -7 * (P - 1));
  const chartWeeks = period === 'year' ? 52 : period === 'q' ? 13 : 8;
  const chartStart = addDaysKey_(nowWk, -7 * (chartWeeks - 1));
  const from = periodStart < chartStart ? periodStart : chartStart;
  const rows = loadLog_().filter((r) => inScope[r.teamId] && r.week >= from);
  const inP = rows.filter((r) => r.week >= periodStart);
  const ok = (r) => r.mode !== MODE.none;
  const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
  const of = (type, arr) => (arr || inP).filter((r) => r.type === type);
  const nf = (v) => Math.round(v).toLocaleString('uk-UA');
  const df = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

  const clubs = of('club').filter(ok), mgs = of('mg').filter(ok), krs = of('kr').filter(ok);
  const knownTotal = teamIds.reduce((a, id) => a + (Number(st.team[id].known) || 0), 0);
  const fin = rows.filter((r) => r.type === 'fin' && r.date.slice(0, 7) >= periodStart.slice(0, 7));
  // люди в командах: активні командні ролі
  const tRoles = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && inScope[r.unitId]);
  const peopleIn = (ids) => { const set = {}; ids.forEach((id) => { set[id] = true; }); return uniq_(tRoles.filter((r) => set[r.unitId]).map((r) => r.tgId)).length; };
  const pplTotal = uniq_(tRoles.map((r) => r.tgId)).length;
  const pplNew = uniq_(tRoles.filter((r) => String(r.requested).slice(0, 10) >= periodStart).map((r) => r.tgId)).length;
  const pplRank = (max) => uniq_(tRoles.filter((r) => r.rank <= max).map((r) => r.tgId)).length;
  const K = {
    people: [[nf(pplTotal), 'Людей у командах'], [nf(teamIds.length), teamIds.length === 1 ? 'Команда' : 'Команд'], [teamIds.length ? df(pplTotal / teamIds.length) : '—', 'Середньо в команді'], [nf(pplRank(RANK.MG)), 'Лідерів і вище'], [nf(pplNew), 'Нових за період']],
    overview: [[nf(clubs.length), 'Клубів'], [nf(sum(clubs, (r) => r.count)), 'Підлітків на клубах'], [nf(mgs.length), 'Зустрічей малих груп'], [df(sum(krs, (r) => r.hours)), 'Годин контактної роботи']],
    club: [[nf(clubs.length), 'Клубів проведено'], [nf(sum(clubs, (r) => r.count)), 'Відвідувань підлітків'], [clubs.length ? df(sum(clubs, (r) => r.count) / clubs.length) : '—', 'Середньо на клубі'], [nf(sum(clubs, (r) => r.newT)), 'Нових підлітків']],
    mg: [[nf(mgs.length), 'Зустрічей малих груп'], [nf(sum(mgs, (r) => r.count)), 'Відвідувань'], [mgs.length ? df(sum(mgs, (r) => r.count) / mgs.length) : '—', 'Середньо на зустрічі'], [nf(sum(mgs, (r) => r.newT)), 'Нових учасників']],
    kr: [[df(sum(krs, (r) => r.hours)), 'Годин контактної роботи'], [df(sum(krs, (r) => r.hours) / P), 'Годин у середньому за тиждень'], [nf(uniq_(krs.map((r) => r.authorId)).length), 'Людей вносили КР'], [nf(of('kr').filter((r) => !ok(r)).length), 'Відміток «не було»']],
    known: [[nf(knownTotal), 'Знаних по імені'], [nf(of('known').length), 'Нових за період']].concat(STAGES.map((x) => [nf(stageSum_(teamIds, x[0])), x[1]])),
    finance: [[nf(sum(fin, (r) => r.inc)) + ' ₴', 'Надійшло'], [nf(sum(fin, (r) => r.spent)) + ' ₴', 'Витрачено'], [nf(sum(fin, (r) => r.inc - r.spent)) + ' ₴', 'Різниця'], [nf(uniq_(fin.map((r) => r.teamId)).length), 'Команд здали звіт']],
  };
  const metric = {
    overview: (r) => (r.type === 'club' && ok(r) ? r.count : 0), club: (r) => (r.type === 'club' && ok(r) ? r.count : 0),
    mg: (r) => (r.type === 'mg' && ok(r) ? r.count : 0), kr: (r) => (r.type === 'kr' ? r.hours : 0),
    known: (r) => (r.type === 'known' ? 1 : 0), finance: (r) => (r.type === 'fin' ? r.inc : 0), people: () => 0,
  }[cat];
  const titles = { people: 'Ролі в командах', overview: 'Підлітки на клубах', club: 'Підлітки на клубах', mg: 'Учасники малих груп', kr: 'Години контактної роботи', known: 'Нові знані по імені', finance: 'Надходження, ₴' };
  const buckets = [];
  const byKey = {};
  if (period === 'year') {
    const ML = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    const cur = kyivDay(new Date());
    let y = Number(cur.slice(0, 4)), m = Number(cur.slice(5, 7));
    const tmp = [];
    for (let i = 0; i < 12; i++) { tmp.unshift({ key: y + '-' + String(m).padStart(2, '0'), label: ML[m - 1], v: 0 }); m--; if (!m) { m = 12; y--; } }
    tmp.forEach((b) => { buckets.push(b); byKey[b.key] = b; });
    rows.forEach((r) => { const b = byKey[String(r.date).slice(0, 7)]; if (b) b.v += Number(metric(r)) || 0; });
  } else {
    for (let k = chartStart; k <= nowWk; k = addDaysKey_(k, 7)) { const b = { key: k, label: k.slice(8, 10) + '.' + k.slice(5, 7), v: 0 }; buckets.push(b); byKey[k] = b; }
    rows.forEach((r) => { const b = byKey[r.week]; if (b) b.v += Number(metric(r)) || 0; });
  }

  const ML2 = { people: 'людей', overview: 'підлітків на клубах', club: 'підлітків на клубах', mg: 'учасників малих груп', kr: 'годин КР', known: 'знаних по імені', finance: 'надходжень, ₴' };
  let groups = [];
  if (scope.level === 'nat') groups = st.regions.map((x) => ({ key: 'r:' + x.id, name: x.name, test: (r) => r.regionId === x.id, teams: teamIds.filter((id) => st.teamRegion(id) === x.id) }));
  if (scope.level === 'region') groups = st.areas.filter((a) => a.regionId === scope.unitId).map((x) => ({ key: 'a:' + x.id, name: x.name, test: (r) => r.areaId === x.id, teams: teamIds.filter((id) => st.team[id].areaId === x.id) }));
  if (scope.level === 'area') groups = teamIds.map((id) => ({ key: 't:' + id, name: st.team[id].name, test: (r) => r.teamId === id, teams: [id] }));
  if (scope.level === 'multi') {
    const LVN = { nat: 'Україна', region: '', area: 'Ерія ', team: '' };
    groups = scope.members.map((m) => { const ids = scopeTeamIds_(m); const set = {}; ids.forEach((id) => { set[id] = true; }); return { key: m.key, name: (LVN[m.level] || '') + (m.level === 'nat' ? '' : m.name), test: (r) => !!set[r.teamId], teams: ids }; });
  }
  if (scope.level === 'team' && cat === 'people') {
    const ROLE_SHORT = {};
    ROLES.filter((x) => x.level === 'team').forEach((x) => { ROLE_SHORT[x.key] = x.label; });
    groups = ROLES.filter((x) => x.level === 'team' && tRoles.some((r) => r.key === x.key)).map((x) => ({ key: '', name: x.label, count: uniq_(tRoles.filter((r) => r.key === x.key).map((r) => r.tgId)).length }));
  }
  if (scope.level === 'team' && (cat === 'kr' || cat === 'mg')) {
    const names = {};
    of(cat).forEach((r) => { names[r.authorId] = r.author; });
    groups = Object.keys(names).map((id) => ({ key: '', name: names[id], test: (r) => r.authorId === id }));
  }
  const scopeKeys = {};
  scopes.forEach((s) => { scopeKeys[s.key] = s; });
  const repType = cat === 'mg' || cat === 'kr' ? cat : 'club';
  const reported = {};
  loadLog_().forEach((r) => { if (r.week === nowWk && r.type === repType && inScope[r.teamId]) reported[r.teamId] = true; });
  const breakdown = groups.map((g) => {
    const v = cat === 'people' ? (g.count != null ? g.count : peopleIn(g.teams)) : cat === 'known' ? g.teams.reduce((a, id) => a + (Number(st.team[id].known) || 0), 0) : sum(inP.filter(g.test), metric);
    const row = { name: g.name, value: v, text: cat === 'kr' ? df(v) : nf(v), drill: g.key && scopeKeys[g.key] ? g.key : '' };
    if (cat === 'people' && g.teams) row.sub = g.teams.length + (g.teams.length === 1 ? ' команда' : ' команд');
    if (g.teams && cat !== 'people') { row.total = g.teams.length; row.done = g.teams.filter((id) => reported[id]).length; row.teams = g.teams.length; }
    return row;
  }).sort((a, b) => b.value - a.value);

  const chain = [];
  if (scope.level === 'team') { const t = st.team[scope.unitId]; chain.push('nat', 'r:' + st.teamRegion(scope.unitId), 'a:' + t.areaId, scope.key); }
  if (scope.level === 'area') chain.push('nat', 'r:' + st.area[scope.unitId].regionId, scope.key);
  if (scope.level === 'region') chain.push('nat', scope.key);
  if (scope.level === 'nat') chain.push('nat');
  const path = chain.filter((k) => scopeKeys[k]).map((k) => ({ key: k, label: scopeKeys[k].name }));

  const report = ['club', 'mg', 'kr'].map((type) => {
    const m = weekReport_(scope, type, teamIds);
    return { type: type, label: { club: 'Клуби', mg: 'Малі групи', kr: 'Контактна робота' }[type], ok: m.ok, none: m.none, total: m.total, unit: m.unit, missing: m.missingNames };
  });

  const roleBars = ROLES.filter((x) => x.level === 'team').map((x) => ({ label: { CAPTAIN: 'Кап', TEAM_ADMIN: 'Адм', DGL: 'DGL', LEADER: 'Лід', HELPER: 'Пом', SUGAR: 'Сах', VOLUNTEER: 'Вол' }[x.key] || x.label.slice(0, 3), v: uniq_(tRoles.filter((r) => r.key === x.key).map((r) => r.tgId)).length }));
  return {
    scope, scopes, cats, cat, period,
    kpis: K[cat].map((k) => ({ v: k[0], l: k[1] })),
    chart: cat === 'people' ? { title: titles[cat], sub: 'Капітан · Адмін · DGL · Лідер · Помічник · Сахарок · Волонтер', bars: roleBars }
      : { title: titles[cat], sub: period === 'year' ? 'по місяцях, останні 12' : 'по тижнях, останні ' + buckets.length, bars: buckets.map((b) => ({ label: b.label, v: b.v })) },
    breakdown: { title: cat === 'people' && scope.level === 'team' ? 'Ролі' : ({ nat: 'Регіони', region: 'Ерії', area: 'Команди', team: 'Люди', multi: 'Вибрані' }[scope.level]), metric: ML2[cat], repLabel: TYPE_LABEL[repType].toLowerCase(), rows: breakdown },
    path, report,
    weekLabel: weekLabel_(nowWk),
    canNudge: c.roles.some((r) => r.rank <= RANK.APPROVE),
  };
}

function weekReport_(scope, type, teamIds) {
  const wk = weekKey_(new Date());
  const st = loadStruct_();
  const rows = loadLog_().filter((r) => r.week === wk && r.type === type);
  if (scope.level === 'team' && type !== 'club') {
    const people = eligiblePeople_(scope.unitId, type === 'mg' ? RANK.MG : RANK.KR);
    let okN = 0, noneN = 0;
    const miss = [], missIds = [];
    people.forEach((p) => {
      const mine = rows.filter((r) => r.authorId === p.tgId && r.teamId === scope.unitId);
      if (mine.some((r) => r.mode !== MODE.none)) okN++;
      else if (mine.length) noneN++;
      else { miss.push(p.name); missIds.push(p.tgId); }
    });
    return { ok: okN, none: noneN, total: people.length, unit: 'людей', missingNames: miss, missingIds: missIds };
  }
  let okN = 0, noneN = 0;
  const miss = [], missTeams = [];
  teamIds.forEach((id) => {
    const mine = rows.filter((r) => r.teamId === id);
    if (mine.some((r) => r.mode !== MODE.none)) okN++;
    else if (mine.length) noneN++;
    else { miss.push(scope.level === 'region' || scope.level === 'nat' || scope.level === 'multi' ? st.team[id].name + ' · ' + (st.area[st.team[id].areaId] || {}).name : st.team[id].name); missTeams.push(id); }
  });
  return { ok: okN, none: noneN, total: teamIds.length, unit: 'команд', missingNames: miss, missingTeams: missTeams };
}

function missingFor_(scope, type) {
  const m = weekReport_(scope, type, scopeTeamIds_(scope));
  const rank = { club: RANK.CLUB, mg: RANK.MG, kr: RANK.KR }[type];
  if (m.missingIds) return { people: m.missingIds };
  const ids = {};
  (m.missingTeams || []).forEach((teamId) => eligiblePeople_(teamId, rank).forEach((p) => { ids[p.tgId] = true; }));
  return { people: Object.keys(ids) };
}

function eligiblePeople_(teamId, maxRank) {
  const by = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId && r.rank <= maxRank)
    .forEach((r) => { by[r.tgId] = { tgId: r.tgId, name: (getPerson_(r.tgId) || {}).name || r.name }; });
  return Object.keys(by).map((k) => by[k]);
}

function weekStatus_(c) {
  const st = loadStruct_();
  const wk = weekKey_(new Date());
  const rows = loadLog_().filter((r) => r.week === wk);
  const teams = {};
  c.roles.filter((r) => r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active).forEach((r) => { teams[r.unitId] = Math.min(teams[r.unitId] || 99, r.rank); });
  const items = [];
  const many = Object.keys(teams).length > 1;
  Object.keys(teams).forEach((teamId) => {
    const rank = teams[teamId];
    const add = (type, perTeam) => {
      const mine = rows.filter((r) => r.type === type && r.teamId === teamId && (perTeam || r.authorId === c.id));
      const status = mine.some((r) => r.mode !== MODE.none) ? 'ok' : mine.length ? 'none' : 'missing';
      const hours = type === 'kr' ? mine.reduce((a, r) => a + (Number(r.hours) || 0), 0) : 0;
      items.push({ type, teamId, label: TYPE_LABEL[type] + (many ? ' · ' + st.team[teamId].name : ''), status, hours });
    };
    if (rank <= RANK.CLUB) add('club', true);
    if (rank <= RANK.MG) add('mg', false);
    if (rank <= RANK.KR) add('kr', false);
  });
  return { key: wk, label: weekLabel_(wk), items };
}

function scopeCard_(c) {
  const top = allowedScopes_(c).filter((s) => s.level !== 'team')[0];
  if (!top) return null;
  const m = weekReport_(top, 'club', scopeTeamIds_(top));
  return { scope: top.key, title: top.label, done: m.ok + m.none, total: m.total };
}

// ───────────────────────────── ЗАЯВКИ ─────────────────────────────

function notifyApprovers_(c, roleIds) {
  const rows = loadRoles_().filter((r) => roleIds.indexOf(r.id) >= 0);
  const who = {};
  rows.forEach((r) => primaryApprovers_(r).forEach((id) => { who[id] = true; }));
  const text = '🆕 <b>Нова заявка</b>\n' + esc_(c.name) + (c.tg.username ? ' (@' + esc_(c.tg.username) + ')' : '') + '\n' +
    rows.map((r) => '• ' + esc_(r.label) + ' · ' + esc_(unitName_(r.level, r.unitId))).join('\n');
  Object.keys(who).filter((id) => wants_(id, 'requests')).forEach((id) => sendApp_(id, text, 'Розглянути', 'requests'));
}

function pendingApproversText_(c) {
  const p = c.allRoles.filter((r) => r.status === ST.PENDING);
  if (!p.length) return '';
  const all = loadRoles_().filter((r) => r.status === ST.ACTIVE);
  const ids = uniq_([].concat.apply([], p.map(primaryApprovers_)));
  const names = ids.slice(0, 4).map((id) => {
    const person = getPerson_(id);
    const top = all.filter((r) => r.tgId === id).sort((a, b) => a.rank - b.rank)[0];
    return ((person && person.name) || (top && top.name) || '') + (top ? ' (' + top.label + ')' : '');
  });
  return names.length ? names.join(', ') + (ids.length > 4 ? ' та інші' : '') : 'керівництво';
}

// ───────────────────────────── TELEGRAM ─────────────────────────────

// ── вхід в окремий застосунок: посилання на бота → бот підтверджує → застосунок отримує токен ──
const LOGIN_TTL = 10 * 60 * 1000;
const SESSION_DAYS = 180;
const b64u = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)));
async function sessionKey(env) { return hmac(new TextEncoder().encode('session:' + env.BOT_TOKEN), 'yl-session'); }
async function makeSession(env, u) {
  const body = b64u(JSON.stringify({ u: u, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return body + '.' + hex(await hmac(await sessionKey(env), body));
}
async function verifySession(token, env) {
  const p = String(token || '').split('.');
  if (p.length !== 2) return null;
  if (hex(await hmac(await sessionKey(env), p[0])) !== p[1]) return null;
  let d;
  try { d = JSON.parse(unb64u(p[0])); } catch (e) { return null; }
  if (!d || !d.u || !d.u.id) return null;
  if (d.exp < Date.now()) throw new ApiError('auth_expired', 'Сесія завершилась. Увійди через Telegram ще раз.');
  return d.u;
}
async function handleAuth(req, env, url) {
  const body = await req.json().catch(() => ({}));
  const db = env.DB;
  if (url.pathname === '/auth/start') {
    const nonce = hex(crypto.getRandomValues(new Uint8Array(20)));
    await db.batch([
      db.prepare('DELETE FROM auth_login WHERE created < ?').bind(Date.now() - 24 * 3600 * 1000),
      db.prepare('INSERT INTO auth_login (nonce, created) VALUES (?, ?)').bind(nonce, Date.now()),
    ]);
    const bot = (await db.prepare("SELECT value FROM settings WHERE key = 'BOT_USERNAME'").first('value')) || '';
    return json({ ok: true, nonce: nonce, bot: bot, link: 'https://t.me/' + bot + '?start=login_' + nonce, app: 'tg://resolve?domain=' + bot + '&start=login_' + nonce });
  }
  if (url.pathname === '/auth/poll') {
    const nonce = String(body.nonce || '');
    if (!/^[a-f0-9]{40}$/.test(nonce)) return json({ ok: false, error: 'bad_request' });
    const row = await db.prepare('SELECT * FROM auth_login WHERE nonce = ?').bind(nonce).first();
    if (!row || row.used || row.created < Date.now() - LOGIN_TTL) return json({ ok: false, error: 'expired', message: 'Час на вхід минув. Спробуй ще раз.' });
    if (!row.user_json) return json({ ok: true, pending: true });
    const r = await db.prepare('UPDATE auth_login SET used = 1 WHERE nonce = ? AND used = 0').bind(nonce).run();
    if (!r.meta || !r.meta.changes) return json({ ok: false, error: 'expired', message: 'Спробуй ще раз.' });
    const u = JSON.parse(row.user_json);
    return json({ ok: true, session: await makeSession(env, u), user: u });
  }
  return json({ ok: false, error: 'bad_action' }, 400);
}

async function webhookSecret(env) { return hex(await hmac(new TextEncoder().encode(String(env.SYNC_KEY || '')), 'tg-webhook')).slice(0, 48); }

async function handleTelegram(req, env, ctx) {
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await webhookSecret(env)) return new Response('forbidden', { status: 403 });
  const upd = await req.json().catch(() => ({}));
  const m = upd.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return new Response('ok');
  const text = (m.text || '').trim();
  const loginM = /^\/start\s+login_([A-Za-z0-9]{20,64})$/.exec(text);
  if (loginM) {
    const u = { id: m.from.id, first_name: m.from.first_name || '', last_name: m.from.last_name || '', username: m.from.username || '' };
    const r = await env.DB.prepare('UPDATE auth_login SET user_json = ? WHERE nonce = ? AND used = 0 AND user_json IS NULL AND created > ?').bind(JSON.stringify(u), loginM[1], Date.now() - LOGIN_TTL).run();
    const okLogin = r.meta && r.meta.changes > 0;
    await tg(env, 'sendMessage', { chat_id: m.chat.id, parse_mode: 'HTML', text: okLogin ? '✅ <b>Вхід у MyYL підтверджено.</b>\nПовернись у застосунок — він відкриється сам.' : 'Посилання для входу застаріло. Натисни «Увійти через Telegram» у застосунку ще раз.' });
    return new Response('ok');
  }
  const S2 = new Store(env, ctx);
  await S2.loadBase();
  use(S2, () => {
    if (/^\/start\b/.test(text)) {
      const payload = text.split(/\s+/)[1] || '';
      if (payload.indexOf('admin_') === 0) return claimAdmin_(m, payload.slice(6));
    }
    if (text === '/id') return S.send(m.chat.id, 'Твій Telegram ID: <code>' + m.from.id + '</code>');
    if (/^\/app\b/.test(text)) return sendInstall_(m.chat.id);
    return sendWelcome_(m.chat.id);
  });
  await S2.flush();
  return new Response('ok');
}

function claimAdmin_(m, code) {
  const expected = S.setting('ADMIN_CLAIM');
  if (!expected || code !== expected) return S.send(m.chat.id, 'Посилання недійсне або вже використане.');
  S.run("DELETE FROM settings WHERE key = 'ADMIN_CLAIM'", [], true);
  const c = ctx_(m.from);
  if (!getPerson_(c.id)) savePerson_(c, { name: fullName_(m.from) });
  const top = ROLES[0];
  const mine = loadRoles_().filter((r) => r.tgId === c.id && r.status === ST.ACTIVE);
  if (mine.some((r) => r.key === top.key)) return sendApp_(m.chat.id, 'Ти вже маєш роль <b>' + top.label + '</b> 🙂', 'Відкрити Young Life');
  const nats = mine.filter((r) => r.key === 'NATIONAL_ADMIN');
  nats.slice(1).forEach((r) => setRoleStatus_(r, ST.REMOVED, 'посилання власника'));
  if (nats[0]) {
    S.run('UPDATE roles SET role_key = ?, decided_by = ?, decided = ? WHERE id = ?', [top.key, 'посилання власника', nowIso(), nats[0].id], true);
  } else {
    insertRole_({ id: uid_(), tgId: c.id, name: c.name, key: top.key, level: 'nat', unitId: '', status: ST.ACTIVE, decidedBy: 'посилання власника', decided: nowIso() });
  }
  return sendApp_(m.chat.id, '✅ Готово! Твоя роль — <b>' + top.label + '</b>: найвищий рівень доступу.', 'Відкрити Young Life');
}

const appLink_ = () => (S.env.APP_URL || '').replace(/\?.*$/, '') + '?app=1';
function sendWelcome_(chatId) {
  S.send(chatId, 'Привіт! Це застосунок Young Life Україна 💙💛\nЗвіти, знані по імені, календар і статистика — тут 👇\n\n📲 Хочеш окрему іконку на телефоні? Натисни «Встановити на телефон».', { reply_markup: { inline_keyboard: [
    [{ text: 'Відкрити Young Life', web_app: { url: (S.env.APP_URL || '').replace(/\?.*$/, '') } }],
    [{ text: '📲 Встановити на телефон', url: appLink_() }],
  ] } });
}
function sendInstall_(chatId) {
  S.send(chatId, '📲 <b>MyYL як окремий застосунок</b>\n\n<b>iPhone:</b> відкрий посилання в Safari → «Поділитися» → «На початковий екран» → «Додати».\n<b>Android:</b> відкрий у Chrome → меню ⋮ → «Встановити застосунок».\n\nПотім відкрий MyYL з іконки й натисни «Увійти через Telegram».', { reply_markup: { inline_keyboard: [[{ text: '📲 Відкрити посилання', url: appLink_() }]] } });
}

function sendApp_(chatId, text, button, screen) {
  const base = (S.env.APP_URL || '').replace(/\?.*$/, '');
  const url = base + (screen ? '?screen=' + screen : '');
  S.send(chatId, text, { reply_markup: { inline_keyboard: [[{ text: button || 'Відкрити', web_app: { url: url } }]] } });
}

async function tg(env, method, params) {
  let data;
  try {
    const res = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params || {}),
    });
    data = await res.json().catch(() => ({ ok: false }));
  } catch (e) { data = { ok: false, error_code: 429, description: 'network: ' + e.message }; }
  if (!data.ok) console.warn('Telegram ' + method + ': ' + data.description);
  return data;
}
async function tgForm(env, method, form) {
  try {
    const res = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) console.warn('Telegram ' + method + ': ' + data.description);
    return data;
  } catch (e) { console.warn('Telegram ' + method + ': ' + e.message); return { ok: false }; }
}

async function sendAll(env, msgs) {
  const out = [];
  for (const m of msgs) {
    const r = await tg(env, 'sendMessage', Object.assign({ chat_id: m.chat_id, text: m.text, parse_mode: 'HTML', disable_web_page_preview: true }, m.extra || {}));
    out.push(r);
    if (r.error_code === 429) break; // Telegram просить зачекати — решта лишиться в черзі
    if (msgs.length > 20) await new Promise((res) => setTimeout(res, 40));
  }
  return out;
}

// Надсилає до n повідомлень із черги. Рядки спершу «бронюються», тож паралельні запуски не дублюють.
async function drainOutbox(env, n) {
  const now = Date.now();
  const rs = await env.DB.prepare('UPDATE outbox SET claimed = ? WHERE id IN (SELECT id FROM outbox WHERE claimed IS NULL OR claimed < ? ORDER BY id LIMIT ?) RETURNING id, chat_id, text, extra')
    .bind(now, now - 5 * 60 * 1000, n).all();
  const rows = (rs.results || []).sort((a, b) => a.id - b.id);
  if (!rows.length) return 0;
  const res = await sendAll(env, rows.map((r) => ({ chat_id: r.chat_id, text: r.text, extra: r.extra ? JSON.parse(r.extra) : null })));
  // надіслані (або назавжди недоступні: бот заблоковано тощо) — прибираємо; при 429 решта повернеться в чергу
  const done = rows.filter((r, i) => res[i] && res[i].error_code !== 429).map((r) => r.id);
  const back = rows.filter((r, i) => !res[i] || res[i].error_code === 429).map((r) => r.id);
  const st = [];
  if (done.length) st.push(env.DB.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(done)));
  if (back.length) st.push(env.DB.prepare('UPDATE outbox SET claimed = NULL WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(back)));
  if (st.length) await env.DB.batch(st);
  return done.length;
}

// ───────────────────────────── НАГАДУВАННЯ ─────────────────────────────

function weeklyReminder() {
  const by = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team').forEach((r) => { (by[r.tgId] = by[r.tgId] || []).push(r); });
  Object.keys(by).forEach((id) => {
    if (!wants_(id, 'remind')) return;
    const miss = weekStatus_({ id: id, roles: by[id] }).items.filter((x) => x.status === 'missing');
    if (!miss.length) return;
    sendApp_(id, '🔔 <b>Нагадування</b>\nЗа цей тиждень ще не заповнено:\n' + miss.map((x) => '• ' + esc_(x.label)).join('\n') +
      '\n\nЯкщо цього тижня не було — просто відміть «Не було».', 'Заповнити');
  });
}

function eventReminder() {
  const days = String(S.setting('EVENT_REMIND_DAYS') || '3,1').split(',').map(Number).filter(isFinite);
  const today = kyivDay(new Date());
  days.forEach((n) => {
    const day = addDaysKey_(today, n);
    loadEvents_().filter((e) => e.date === day).forEach((e) => {
      S.rsvp.filter((r) => r.eventId === e.id && wants_(r.tgId, 'events')).forEach((r) => {
        sendApp_(r.tgId, '📅 ' + (n === 1 ? 'Завтра' : 'Через ' + n + ' дні') + ': <b>' + esc_(e.title) + '</b>\n' + esc_([e.time, e.place].filter(Boolean).join(' · ')), 'Деталі', 'calendar');
      });
    });
  });
}

// ───────────────────────────── СЛУЖБОВЕ: БОТ, ІМПОРТ, СИНХРОНІЗАЦІЯ З ДИСКОМ ─────────────────────────────

async function handleAdmin(req, env, ctx, url) {
  const key = req.headers.get('x-sync-key') || url.searchParams.get('key');
  if (!env.SYNC_KEY || key !== env.SYNC_KEY) return json({ ok: false, error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  const db = env.DB;
  const action = url.pathname.slice('/admin/'.length);

  if (action === 'setup') {
    const origin = url.origin;
    const me = await tg(env, 'getMe', {});
    const hook = await tg(env, 'setWebhook', { url: origin + '/tg', secret_token: await webhookSecret(env), allowed_updates: ['message'], drop_pending_updates: false });
    await tg(env, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Відкрити', web_app: { url: env.APP_URL } } });
    await tg(env, 'setMyCommands', { commands: [{ command: 'start', description: 'Відкрити застосунок' }, { command: 'app', description: 'Встановити MyYL на телефон' }] });
    if (me.ok) await db.prepare("INSERT INTO settings (key, value) VALUES ('BOT_USERNAME', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(me.result.username).run();
    return json({ ok: !!hook.ok, bot: me.ok ? me.result.username : null, api: origin, webhook: hook.description || 'ok' });
  }

  if (action === 'admin-link') {
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await db.batch([
      db.prepare("INSERT INTO settings (key, value) VALUES ('ADMIN_CLAIM', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(code),
      db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"),
    ]);
    BASE = null;
    const bot = await db.prepare("SELECT value FROM settings WHERE key = 'BOT_USERNAME'").first('value');
    return json({ ok: true, link: 'https://t.me/' + bot + '?start=admin_' + code });
  }

  if (action === 'import') {
    // перенесення з Google Таблиць частинами (до 40 рядків за раз); INSERT OR REPLACE — можна повторювати
    const COLS = {
      regions: ['id', 'name'], areas: ['id', 'region_id', 'name'], teams: ['id', 'area_id', 'name', 'state', 'known'],
      people: ['tg_id', 'username', 'name', 'phone', 'email', 'bday', 'repent', 'baptism', 'lpyl', 'resp', 'title', 'registered'],
      roles: ['id', 'tg_id', 'name', 'role_key', 'level', 'unit_id', 'status', 'decided_by', 'requested', 'decided'],
      events: ['id', 'level', 'unit_id', 'title', 'date', 'end_date', 'time', 'place', 'descr', 'author_id', 'author', 'created'],
      rsvp: ['event_id', 'tg_id', 'name', 'team', 'created'],
      reports: ['id', 'created', 'date', 'week', 'type', 'mode', 'team_id', 'area_id', 'region_id', 'count', 'new_t', 'leaders', 'hours', 'topic', 'note', 'attendees', 'author_id', 'author'],
      known: ['id', 'team_id', 'name', 'phone', 'ig', 'bday', 'school', 'grade', 'leader', 'note', 'added', 'active', 'updated', 'author_id'],
      finance: ['team_id', 'month', 'prev', 'office', 'church', 'team', 'spent', 'balance', 'author', 'updated'],
      settings: ['key', 'value'],
    };
    const stm = [];
    Object.keys(COLS).forEach((table) => {
      const cols = COLS[table];
      (body[table] || []).forEach((r) => stm.push(db.prepare('INSERT OR REPLACE INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(',') + ')')
        .bind(...cols.map((k) => (r[k] == null ? null : r[k])))));
    });
    if (stm.length > 45) return json({ ok: false, error: 'too_many', message: 'Надсилай до 45 рядків за раз.' }, 400);
    stm.push(db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"));
    await db.batch(stm);
    BASE = null;
    const maxSeq = await db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM reports').first('m');
    return json({ ok: true, imported: stm.length - 1, cursor: { seq: maxSeq, since: new Date().toISOString() } });
  }

  if (action === 'sync') {
    // для скрипта Google: структура, доступи і все нове з минулого разу
    const cur = body.cursor || {};
    const seq = Number(cur.seq) || 0;
    const since = String(cur.since || '1970-01-01T00:00:00Z');
    const now = new Date().toISOString();
    const res = await db.batch([
      db.prepare('SELECT * FROM regions'), db.prepare('SELECT * FROM areas'), db.prepare('SELECT * FROM teams'),
      db.prepare("SELECT r.role_key, r.level, r.unit_id, p.email FROM roles r JOIN people p ON p.tg_id = r.tg_id WHERE r.status = ? AND p.email LIKE '%@%'").bind(ST.ACTIVE),
      db.prepare('SELECT * FROM reports WHERE seq > ? ORDER BY seq LIMIT 2000').bind(seq),
      db.prepare('SELECT * FROM known WHERE team_id IN (SELECT DISTINCT team_id FROM known WHERE updated > ?) ORDER BY name').bind(since),
      db.prepare('SELECT * FROM finance WHERE updated > ?').bind(since),
      db.prepare('SELECT * FROM people'),
      db.prepare('SELECT * FROM roles ORDER BY requested'),
    ]);
    const [regions, areas, teams, grantRows, reports, knownRows, finance, people, roles] = res.map((r) => r.results || []);
    const grants = grantRows.filter((g) => { const d = roleDef_(g.role_key); return d && d.rank <= RANK.GMAIL; })
      .map((g) => ({ email: String(g.email).toLowerCase(), level: g.level, unitId: g.unit_id || '' }));
    const known = {};
    knownRows.forEach((k) => { (known[k.team_id] = known[k.team_id] || []).push(k); });
    roles.forEach((r) => { const d = roleDef_(r.role_key); r.label = d ? d.label : r.role_key; });
    const lastSeq = reports.length ? reports[reports.length - 1].seq : seq;
    return json({ ok: true, regions, areas, teams, grants, reports, known, finance, people, roles, cursor: { seq: lastSeq, since: now }, more: reports.length === 2000 });
  }

  return json({ ok: false, error: 'bad_action' }, 400);
}

// ───────────────────────────── ДРІБНІ ПОМІЧНИКИ ─────────────────────────────

function str_(v) { return String(v == null ? '' : v).trim(); }
function clip_(v) { return String(v == null ? '' : v).trim().slice(0, 2000); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function uid_() { return crypto.randomUUID().replace(/-/g, '').slice(0, 10); }
function uniq_(a) { return a.filter((x, i) => x && a.indexOf(x) === i); }
function fullName_(f) { return [f.first_name, f.last_name].filter(Boolean).join(' ') || f.username || String(f.id); }
function nowIso() { return new Date().toISOString(); }
function profileOf_(p) { return { name: p.name, title: p.title, phone: p.phone, email: p.email, bday: p.bday, repent: p.repent, baptism: p.baptism, lpyl: p.lpyl, resp: p.resp, notif: notifOf_(p.tgId) }; }
// bc — розсилки від інших; remind — нагадування про звіти; events — про події; requests — нові заявки
const NOTIF = ['bc', 'remind', 'events', 'requests'];
function notifOf_(tgId) {
  const p = getPerson_(tgId) || {};
  const sup = loadRoles_().some((r) => r.tgId === String(tgId) && r.status === ST.ACTIVE && r.key === 'SUPER');
  const out = {};
  NOTIF.forEach((k) => { const v = (p.notif || {})[k]; out[k] = v == null ? !(sup && k === 'bc') : !!v; });
  return out;
}
const wants_ = (tgId, k) => notifOf_(tgId)[k];
function roleOut_(r) { return { id: r.id, key: r.key, label: r.label, level: r.level, unitId: r.unitId, unitName: unitName_(r.level, r.unitId), status: r.status }; }
function teamOut_(id) { const st = loadStruct_(); const t = st.team[id]; return { id: id, name: t.name, areaId: t.areaId, areaName: (st.area[t.areaId] || {}).name || '', regionId: st.teamRegion(id) }; }
function knownOut_(r) { return { id: r.id, stage: stageOk_(r.stage) ? r.stage : 'meet', authorId: r.author_id || '', name: r.name || '', phone: r.phone || '', ig: r.ig || '', bday: r.bday || '', school: r.school || '', grade: r.grade || '', leader: r.leader || '', note: r.note || '' }; }
function finOut_(r) { return { month: r.month, prev: r.prev || 0, office: r.office || 0, church: r.church || 0, team: r.team || 0, spent: r.spent || 0, balance: r.balance || 0 }; }
function levelLabel_(level, id) {
  if (level === 'nat') return 'Національна';
  if (level === 'region') return 'Регіон ' + unitName_(level, id);
  if (level === 'area') return 'Ерія ' + unitName_(level, id);
  return 'Команда «' + unitName_(level, id) + '»';
}

// Час за Києвом
const KYIV_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' });
function kyivParts(d) {
  const o = {};
  KYIV_FMT.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
  return { day: o.year + '-' + o.month + '-' + o.day, hour: Number(o.hour) % 24, dow: dow };
}
function kyivDay(d) { return kyivParts(d).day; }
function weekKey_(d) {
  const s = typeof d === 'string' ? d.slice(0, 10) : kyivDay(d);
  const p = s.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
function addDaysKey_(k, n) {
  const p = k.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}
function weekLabel_(k) {
  const M = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const e = addDaysKey_(k, 6);
  const d1 = Number(k.slice(8, 10)), d2 = Number(e.slice(8, 10));
  const m1 = Number(k.slice(5, 7)) - 1, m2 = Number(e.slice(5, 7)) - 1;
  return m1 === m2 ? d1 + '–' + d2 + ' ' + M[m2] : d1 + ' ' + M[m1] + ' – ' + d2 + ' ' + M[m2];
}

// для тестів
export const __test = { API, Store, use, verifyInitData, weekKey_, kyivDay, weeklyReminder, eventReminder, resetBase: () => { BASE = null; } };
