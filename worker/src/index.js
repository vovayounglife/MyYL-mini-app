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
  { key: 'SUPER', label: 'Адміністратор MyYL', rank: 0, level: 'nat', hidden: true },
  // окремо не обирається: «Національний адмін» — посада в Національному офісі; роль лишається для тих, хто її вже має
  { key: 'NATIONAL_ADMIN', label: 'Національний Адмін', rank: 1, level: 'nat', hidden: true },
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
  // Національний офіс України: людина обирає посаду зі списку (або пише свою), підтверджує Національний Адмін / власник
  { key: 'OFFICE', label: 'Національний офіс', rank: 13, level: 'nat', viewOnly: true, titled: true },
  // Офіс ерії: людина сама називає свою роль, підтверджувач може змінити
  { key: 'AREA_OFFICE', label: 'Офіс ерії', rank: 14, level: 'area', viewOnly: true, titled: true },
];
// посади в національному офісі (як в альбомі «Офіс» / «Експерти»)
const OFFICE_TITLES = [
  { group: 'Офіс', items: ['Національний адмін', 'Операційний директор', 'Фінансовий директор', 'Голова навчального відділу', 'Голова медіа відділу', 'Керівник Young Life продукції',
    'Регіональний директор Young Life Україна', 'Регіональний адміністратор', 'HR', 'Фандрейзер', 'Координатор EP/DGL', 'Перекладач', 'MEA DGL адміністратор',
    'Фінансовий асистент', 'Діловод', 'Офісний працівник'] },
  { group: 'Експерти', items: ['Експерт Young Moms', 'Експерт Capernaum', 'Експерт College', 'Експерт WyldLife'] },
];
const RANK = { CLUB: 7, MG: 9, KR: 10, KNOWN: 10, FINANCE: 7, APPROVE: 6, EVENT: 9, GMAIL: 6 };
// ── дозволи: типові значення = як було до налаштувань; вища ланка задає рамки, нижча може лише звузити ──
const PERMS = [
  { key: 'rep.club', group: 'rep', label: 'Вносити клуб', def: (r) => (r.level === 'team' ? r.rank <= RANK.CLUB : CLUB_UPPER.indexOf(r.key) >= 0), levels: ['team', 'area', 'region'] },
  { key: 'rep.mg', group: 'rep', label: 'Вносити малу групу (за себе)', def: (r) => r.level !== 'team' || r.rank <= RANK.MG },
  { key: 'rep.kr', group: 'rep', label: 'Вносити контактну роботу (за себе)', def: (r) => r.level !== 'team' || r.rank <= RANK.KR },
  { key: 'rep.known', group: 'rep', label: 'Додавати знаних у команду', def: (r) => r.level === 'team' && r.rank <= RANK.KNOWN, levels: ['team'] },
  { key: 'rep.fin', group: 'rep', label: 'Вносити фінанси команди', def: (r) => (r.level === 'team' ? r.rank <= RANK.FINANCE : FIN_UPPER.indexOf(r.key) >= 0), levels: ['team', 'area'] },
  { key: 'see.stats', group: 'see', label: 'Статистика', def: () => true },
  { key: 'see.team', group: 'see', label: 'Склад команди', def: () => true },
  { key: 'see.known', group: 'see', label: 'Знані команди', def: (r) => r.level !== 'team' || r.rank <= RANK.KNOWN },
  { key: 'see.fin', group: 'see', label: 'Фінанси', def: (r) => r.level !== 'team' || r.rank <= RANK.FINANCE },
  { key: 'see.myyl', group: 'see', label: 'Моя команда в MyYL', def: () => true },
  { key: 'part.events', group: 'part', label: 'Бачити події календаря', def: () => true },
  { key: 'part.tasks', group: 'part', label: 'Отримувати задачі', def: () => true },
  { key: 'part.polls', group: 'part', label: 'Голосувати в опитуваннях', def: () => true },
];
const PERM = {};
PERMS.forEach((x) => { PERM[x.key] = x; });
const PERM_LV = { nat: 0, region: 1, area: 2, team: 3 };
const ST = { PENDING: 'очікує', ACTIVE: 'активна', REJECTED: 'відхилена', REMOVED: 'знята' };
const MODE = { event: 'подія', week: 'тиждень', none: 'не було' };
const TYPE_LABEL = { club: 'Клуб', mg: 'Мала група', kr: 'Контактна робота' };

// Хто підтверджує ролі (власник — будь-яку). 'same' — та сама одиниця; 'cover' — роль накриває одиницю заявки.
const APPROVAL = {
  NATIONAL_ADMIN: [],
  REGIONAL_DIRECTOR: [],
  REGIONAL_ADMIN: [['REGIONAL_DIRECTOR', 'same']],
  AREA_DIRECTOR: [['REGIONAL_DIRECTOR', 'cover']],
  AREA_ADMIN: [['AREA_DIRECTOR', 'same'], ['REGIONAL_DIRECTOR', 'cover'], ['REGIONAL_ADMIN', 'cover']],
  CAPTAIN: [['AREA_DIRECTOR', 'cover'], ['AREA_ADMIN', 'cover'], ['REGIONAL_ADMIN', 'cover']],
  OFFICE: [['NATIONAL_ADMIN', 'same']],
  AREA_OFFICE: [['AREA_DIRECTOR', 'same'], ['AREA_ADMIN', 'same'], ['REGIONAL_DIRECTOR', 'cover'], ['REGIONAL_ADMIN', 'cover']],
};
const SUPER_NOTIFY = ['NATIONAL_ADMIN', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'AREA_DIRECTOR', 'OFFICE'];
const MANAGE_AREAS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN'];
const DIRS = ['YoungLife', 'WyldLife', 'College', 'Capernaum', 'YoungMoms'];
// клуб за команду вносять Капітан, Адмін команди і ці вищі ролі (у своїх межах); МГ і КР — кожен лише за себе
const CLUB_UPPER = ['AREA_DIRECTOR', 'AREA_ADMIN', 'REGIONAL_ADMIN'];
const MANAGE_TEAMS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'AREA_DIRECTOR', 'AREA_ADMIN'];
// касу команди вносять Капітан, Адмін команди, а також керівництво ерії
const FIN_UPPER = ['AREA_DIRECTOR', 'AREA_ADMIN'];

// ───────────────────────────── ВХІД ─────────────────────────────

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    try {
      if (url.pathname === '/clog' && req.method === 'POST') {
        // збій запиту на телефоні: що саме не вдалося (без особистих даних), останні 300 записів
        const t = (await req.text()).slice(0, 1500);
        ctx.waitUntil(env.DB.batch([env.DB.prepare('INSERT INTO client_log (ts, data) VALUES (?, ?)').bind(new Date().toISOString(), t),
          env.DB.prepare('DELETE FROM client_log WHERE rowid NOT IN (SELECT rowid FROM client_log ORDER BY ts DESC LIMIT 300)')]).catch(() => {}));
        return cors(new Response('ok'));
      }
      if (url.pathname === '/tg' && req.method === 'POST') return await handleTelegram(req, env, ctx);
      if (url.pathname === '/upload' && req.method === 'POST') return await handleUpload(req, env, ctx);
      if (url.pathname.indexOf('/f/') === 0 && req.method === 'GET') return await handleFile(req, env, url);
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
    if (p.hour === 9) { const t0 = kyivDay(when); await S.loadWsDue(addDaysKey_(t0, -1), addDaysKey_(t0, 1)); use(S, () => wsReminder_()); }
    // хто вже в боті, але ще записаний у складі «без MyYL» — обʼєднуємо
    use(S, () => linkPlaceholders_());
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
  me: { log: 'week', events: true, tp: true, ck: true, bugCount: true, lastClubs: true, plans: 'open' },
  clubPage: { log: 'week', clubs: true, plans: 'team', ideas: true }, clubPlanSave: { clubs: true, plans: 'team' }, clubPlanDone: { log: 'week', ck: true, clubs: true, plans: 'team' },
  clubIdeaAdd: { ideas: true }, clubIdeaDel: { ideas: true }, ideaBank: { plans: 'done' }, actAsFind: {}, checkin: { log: 'week', ck: true }, myStats: { mine: true }, register: {}, requestRoles: {}, requests: {}, roleEdit: {}, roleGrant: {}, decide: {}, removeRole: {}, saveProfile: {},
  saveReport: { log: 'week', ck: true }, knownList: { known: true }, knownSave: { known: true }, knownArchive: { known: true }, knownBulk: { known: true }, knownStage: { known: true },
  teamMembers: {}, financeGet: { finance: true }, financeSave: { finance: true },
  finTx: { finance: true, ftx: true }, finTxAdd: { finance: true, ftx: true }, finTxDelete: { finance: true, ftx: true },
  events: { events: true }, eventSave: { events: true }, eventDelete: { events: true }, rsvp: { events: true },
  structureTree: {}, roleTitle: {}, areaSave: {}, teamSave: {}, teamDelete: { usage: true }, stats: { log: 'stats', clubs: true }, clubEdit: { clubs: true }, clubDelete: { clubs: true }, dupes: {}, dupMerge: {}, dupSkip: {}, clubPick: {}, bugSend: {}, bugs: { bugs: true }, bugDone: { bugs: true }, nudge: { log: 'week' },
  memberAdd: {}, memberRemove: {}, claimFind: {},
  myylTree: {}, broadcastInfo: { bc: true }, broadcast: {}, report: { log: 'report', known: true }, knownExport: { known: true },
  dirStats: { log: 'stats' }, installStats: {},
  resList: { res: true }, resSave: { res: true }, resDecide: { res: true }, resDelete: { res: true },
  audCount: {}, permsGet: {}, permSet: {}, permReset: {}, tasks: { tp: true }, taskSave: { tp: true }, taskStatus: { tp: true }, taskClose: { tp: true }, taskDelete: { tp: true }, taskNudge: { tp: true },
  polls: { tp: true }, pollSave: { tp: true }, pollVote: { tp: true }, pollClose: { tp: true }, pollDelete: { tp: true },
};

async function handleApi(req, env, ctx) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'bad_request', message: 'Невірний запит.' }); }
  const S = new Store(env, ctx);
  try {
    const tgUser = body.session ? await verifySession(body.session, env) : await verifyInitData(body.initData, env.BOT_TOKEN);
    if (!tgUser) throw new ApiError('auth', 'Не вдалося перевірити Telegram. Відкрий застосунок заново.');
    return json({ ok: true, data: await runAs_(S, tgUser, body.action, body.data || {}, body.viewAs, body.actAs) });
  } catch (err) {
    S.abort();
    if (!(err instanceof ApiError)) console.error(err && err.stack || err);
    return json({ ok: false, error: err.code || 'error', message: err instanceof ApiError ? err.message : 'Сталася помилка. Спробуй ще раз.' });
  }
}
async function runAs_(S, tgUser, action, d, viewAs, actAs) {
  const body = { action: action };
  if (viewAs && !VIEW_OK.test(action)) throw new ApiError('preview', 'Це режим перегляду — зміни вимкнені. Вийди з нього, щоб працювати від себе.');
  {
    const fn = API[body.action];
    const need = NEEDS[body.action];
    if (!fn || !need) throw new ApiError('bad_action', 'Невідома дія: ' + body.action);
    await S.loadBase();
    // «Переглянути, як»: лише власник застосунку працює від імені іншої людини — з усіма її правами
    let actor = null;
    if (actAs) {
      if (viewAs) throw new ApiError('bad_request', 'Спершу вийди з режиму перегляду.');
      const t = use(S, () => {
        const rc = ctx_(tgUser);
        if (!isSuper_(rc)) throw new ApiError('forbidden', 'Немає доступу.');
        const id = str_(actAs);
        const p = getPerson_(id);
        if (!isReal_(id) || id === rc.id || (!p && !loadRoles_().some((r) => r.tgId === id))) throw new ApiError('act_as', 'Цю людину не знайдено — повертаю тебе до себе.');
        return { tg: { id: id, first_name: (p && p.name) || '' }, actor: { id: rc.id, name: rc.name } };
      });
      actor = t.actor; tgUser = t.tg;
      if (!/^(me|stats|knownList|myStats|clubPage|ideaBank|events|tasks|polls)$/.test(action)) console.log('actAs', actor.id, '→', tgUser.id, action);
    }
    if (need.log === 'week') await S.loadLog(weekKey_(new Date()));
    if (need.log === 'stats') await S.loadLog(statsFromWeek(d.period, d), true);
    if (need.log === 'report') await S.loadLog(weekKey_(/^\d{4}-\d{2}-\d{2}$/.test(d.from || '') ? d.from : kyivDay(new Date())), true);
    if (need.clubs) await S.loadClubs();
    if (need.plans) await S.loadPlans(need.plans === 'team' ? str_(d.teamId) : need.plans === 'done' ? '*done' : null);
    if (need.ideas) await S.loadIdeas(str_(d.teamId));
    if (need.lastClubs) S.lastClubRows = ((await S.db.prepare("SELECT r.* FROM reports r JOIN (SELECT team_id, MAX(date) AS d FROM reports WHERE type = 'club' GROUP BY team_id) m ON r.team_id = m.team_id AND r.date = m.d WHERE r.type = 'club' ORDER BY r.seq").all()).results || []).map(logFromRow);
    if (need.bugCount) S.bugOpen = (await S.db.prepare("SELECT COUNT(*) AS n FROM bugs WHERE COALESCE(done, '') = ''").first('n')) || 0;
    if (need.bugs) S.bugs = ((await S.db.prepare('SELECT * FROM bugs ORDER BY created DESC LIMIT 200').all()).results || []);
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
    if (need.ftx) await S.loadFinTx(str_(d.teamId));
    if (need.bc) await S.loadBroadcasts();
    if (need.res) await S.loadRes();
    if (need.tp) await S.loadTP();
    if (need.ck) await S.loadCheckins(String(tgUser.id));
    if (need.mine) await S.loadMine(String(tgUser.id));
    if (need.usage) await S.loadTeamUsage(str_(d.id));
    if (need.ws) await S.loadWs(str_(d.ws) || WS_DEFAULT);
    if (need.wsComments) await S.loadWsComments(str_(d.card || d.id));
    if (need.wsPage) await S.loadWsPage(str_(d.id));
    if (need.wsKv) await S.loadWsKv(str_(d.ws) || WS_DEFAULT, need.wsKv);
    if (need.wsMine) await S.loadWsMine(String(tgUser.id));
    if (need.wsStats) await S.loadWsStats();
    const data = use(S, () => { const c = ctx_(tgUser); if (actor) c.actor = actor; const out = fn(viewAs ? viewCtx_(c, viewAs) : c, d); if (actor && action === 'me' && out) out.actAs = { id: c.id, name: c.name }; return out; });
    await S.flush();
    return data;
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
      this.db.prepare('SELECT * FROM perms'),
    ]);
    const [regions, areas, teams, people, roles, settings, perms] = res.map((r) => r.results || []);
    const b = { ver: ver, settings: {}, perms: {} };
    perms.forEach((r) => { b.perms[r.unit + '|' + r.role_key + '|' + r.perm] = Number(r.val) ? 1 : 0; });
    b.regions = regions.map((r) => ({ id: r.id, name: r.name }));
    b.areas = areas.map((r) => ({ id: r.id, regionId: r.region_id, name: r.name }));
    b.teams = teams.map((r) => ({ id: r.id, areaId: r.area_id, name: r.name, state: r.state, active: r.state === 'active', known: Number(r.known) || 0, dir: r.dir || '' }));
    b.people = {};
    people.forEach((r) => { b.people[r.tg_id] = personFromRow(r); });
    b.roles = roles.map(roleFromRow).filter(Boolean);
    settings.forEach((r) => { b.settings[r.key] = r.value; });
    indexBase(b);
    BASE = b; this.b = b;
  }
  // усі звіти за клуб (історія команди й дата останнього звіту)
  async loadPlans(teamId) {
    const q = teamId === '*done' ? this.db.prepare("SELECT * FROM club_plans WHERE status = 'done' ORDER BY date DESC LIMIT 3000") : teamId ? this.db.prepare('SELECT * FROM club_plans WHERE team_id = ? ORDER BY date DESC').bind(teamId) : this.db.prepare("SELECT * FROM club_plans WHERE status = 'plan'");
    this.plans = ((await q.all()).results || []).map(planFromRow_);
  }
  async loadIdeas(teamId) {
    this.ideas = ((await this.db.prepare('SELECT * FROM club_ideas WHERE team_id = ? ORDER BY created DESC').bind(teamId).all()).results || []);
  }
  async loadClubs() {
    const rs = await this.db.prepare("SELECT * FROM reports WHERE type = 'club' ORDER BY date DESC, seq DESC").all();
    this.clubs = (rs.results || []).map(logFromRow);
  }
  async loadLog(fromWeek, withExtras) {
    const rs = await this.db.prepare('SELECT * FROM reports WHERE week >= ?').bind(fromWeek).all();
    this.log = (rs.results || []).map(logFromRow);
    if (withExtras) {
      // нові знані й фінанси — у тому ж форматі, що й звіти (для статистики)
      const fromDay = fromWeek;
      const [kn, fin, stg, slf, gone] = await this.db.batch([
        this.db.prepare("SELECT team_id, added, author_id FROM known WHERE added >= ? AND active = 1").bind(fromDay),
        this.db.prepare('SELECT team_id, month, office, church, team, spent FROM finance WHERE month >= ?').bind(fromDay.slice(0, 7)),
        this.db.prepare("SELECT team_id, COALESCE(stage, 'meet') AS stage, COUNT(*) AS n FROM known WHERE active = 1 GROUP BY team_id, COALESCE(stage, 'meet')"),
        this.db.prepare("SELECT author_id, COALESCE(stage, 'meet') AS stage, COUNT(*) AS n FROM known WHERE active = 1 AND team_id = '' GROUP BY author_id, COALESCE(stage, 'meet')"),
        this.db.prepare("SELECT team_id, added, updated, author_id FROM known WHERE active = 0 AND updated >= ?").bind(fromDay),
      ]);
      // особисті знані «Без команди»: рахуємо на рівні автора
      this.knownSelf = (slf.results || []).map((r) => Object.assign({ stage: r.stage, n: r.n }, authorUnit_(this.b, r.author_id)));
      this.knownStages = {};
      (stg.results || []).forEach((r) => { (this.knownStages[r.team_id] = this.knownStages[r.team_id] || {})[r.stage] = r.n; });
      const b = this.b;
      // знані, яких прибрали за цей час: для графіка «скільки було на дату»
      this.knownGone = [];
      (gone.results || []).forEach((r) => {
        const t = b.team[r.team_id], u = r.team_id ? (t ? { areaId: t.areaId, regionId: b.teamRegion(r.team_id) } : null) : authorUnit_(b, r.author_id);
        if (u) this.knownGone.push({ teamId: r.team_id || '', areaId: u.areaId, regionId: u.regionId, added: String(r.added || '').slice(0, 10), gone: String(r.updated || '').slice(0, 10) });
      });
      (kn.results || []).forEach((r) => {
        const t = b.team[r.team_id]; const day = String(r.added || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        if (!r.team_id) { const u = authorUnit_(b, r.author_id); this.log.push({ type: 'known', date: day, week: weekKey_(day), teamId: '', areaId: u.areaId, regionId: u.regionId, mode: '', count: 1, newT: 0, leaders: 0, hours: 0, inc: 0, spent: 0 }); return; }
        if (!t) return;
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
      this.db.prepare(EV_LIVE_SQL('')).bind(addDaysKey_(today, -1), today),
      this.db.prepare('SELECT r.* FROM rsvp r JOIN events e ON (r.event_id = e.id OR r.event_id LIKE e.id || \'@%\') WHERE ' + EV_LIVE_SQL('e.').replace(/^SELECT \* FROM events WHERE /, '')).bind(addDaysKey_(today, -1), today),
    ]);
    this.events = (ev.results || []).map((r) => ({ id: r.id, roles: String(r.roles || '').split(',').filter(Boolean), aud: String(r.aud || '').split(',').filter(Boolean), level: r.level, unitId: r.unit_id || '', title: r.title || '', date: r.date, end: r.end_date && r.end_date > r.date ? r.end_date : '', time: r.time || '', place: r.place || '', desc: r.descr || '', authorId: r.author_id || '', author: r.author || '', rep: REPEAT[r.rep] ? r.rep : '', until: r.rep_until || '', skip: String(r.rep_skip || '').split(',').filter(Boolean) }));
    this.rsvp = (rs.results || []).map((r) => ({ eventId: r.event_id, tgId: r.tg_id, name: r.name || '', team: r.team || '' }));
  }
  async loadKnownTeams(ids) {
    if (!ids.length) return;
    const rs = await this.db.prepare('SELECT * FROM known WHERE team_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all();
    ids.forEach((id) => { this.known[id] = []; });
    (rs.results || []).forEach((r) => { (this.known[r.team_id] = this.known[r.team_id] || []).push(r); });
  }
  async loadCheckins(tgId) {
    const r = await this.db.prepare('SELECT * FROM checkins WHERE tg_id = ? AND week = ?').bind(tgId, weekKey_(new Date())).first();
    this.ck = r || null;
  }
  // усе «моє» для особистої статистики: звіти МГ/КР, клуби з відміткою присутності, відмітки тижнів, знані
  async loadMine(tgId) {
    const like = '%,' + tgId + ',%';
    const [rep, att, ck, kn, cr, rs, tp, pv, bg, pp] = await this.db.batch([
      this.db.prepare("SELECT week, date, type, mode, hours, count, new_t, topic, note, created, pid FROM reports WHERE author_id = ? AND type IN ('mg','kr')").bind(tgId),
      this.db.prepare("SELECT DISTINCT week FROM reports WHERE type = 'club' AND (',' || COALESCE(attendees, '') || ',') LIKE ?").bind(like),
      this.db.prepare('SELECT * FROM checkins WHERE tg_id = ?').bind(tgId),
      this.db.prepare('SELECT stage, added, note, bday, phone FROM known WHERE author_id = ? AND active = 1').bind(tgId),
      this.db.prepare("SELECT COUNT(*) AS n, MAX(count) AS mx, COUNT(DISTINCT team_id) AS teams FROM reports WHERE author_id = ? AND type = 'club' AND COALESCE(mode, '') <> 'none'").bind(tgId),
      this.db.prepare('SELECT COUNT(*) AS n FROM rsvp WHERE tg_id = ?').bind(tgId),
      this.db.prepare("SELECT COUNT(*) AS n FROM task_people WHERE tg_id = ? AND status = 'done'").bind(tgId),
      this.db.prepare('SELECT COUNT(DISTINCT poll_id) AS n FROM poll_votes WHERE tg_id = ?').bind(tgId),
      this.db.prepare('SELECT COUNT(*) AS n FROM bugs WHERE tg_id = ?').bind(tgId),
      this.db.prepare('SELECT phone, email, bday, repent, baptism, ig, lpyl, registered FROM people WHERE tg_id = ?').bind(tgId),
    ]);
    const one = (x) => ((x && x.results) || [])[0] || {};
    this.mine = { rep: rep.results || [], att: (att.results || []).map((r) => r.week), ck: ck.results || [], known: kn.results || [],
      club: one(cr), rsvp: one(rs).n || 0, tasks: one(tp).n || 0, polls: one(pv).n || 0, bugs: one(bg).n || 0, person: one(pp) };
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
  async loadFinTx(teamId) {
    const rs = await this.db.prepare('SELECT * FROM fin_tx WHERE team_id = ? ORDER BY date DESC, created DESC LIMIT 40').bind(teamId || '').all();
    this.finTx = (rs.results || []).map((r) => ({ id: r.id, teamId: r.team_id, date: r.date, kind: r.kind, src: r.src || '', amount: Number(r.amount) || 0, note: r.note || '', authorId: r.author_id || '', author: r.author || '', created: r.created || '' }));
  }
  async loadFinance(teamId) {
    if (!teamId) return;
    const rs = await this.db.prepare('SELECT * FROM finance WHERE team_id = ?').bind(teamId).all();
    this.finance[teamId] = rs.results || [];
  }
  async loadTeamUsage(id) {
    const q = (sql) => this.db.prepare(sql).bind(id);
    const [rep, kn, fin] = await this.db.batch([
      q('SELECT COUNT(*) AS n FROM reports WHERE team_id = ?'), q('SELECT COUNT(*) AS n FROM known WHERE team_id = ? AND active = 1'), q('SELECT COUNT(*) AS n FROM finance WHERE team_id = ?'),
    ]);
    const n = (r) => ((r.results || [])[0] || {}).n || 0;
    this.usage = { reports: n(rep), known: n(kn), finance: n(fin) };
  }
  async loadTP() {
    const since = new Date(Date.now() - 120 * 864e5).toISOString();
    const [t, tp, p, pv] = await this.db.batch([
      this.db.prepare("SELECT * FROM tasks WHERE COALESCE(closed, '') = '' OR created >= ?").bind(since),
      this.db.prepare("SELECT x.* FROM task_people x JOIN tasks t ON t.id = x.task_id WHERE COALESCE(t.closed, '') = '' OR t.created >= ?").bind(since),
      this.db.prepare("SELECT * FROM polls WHERE COALESCE(closed, '') = '' OR created >= ?").bind(since),
      this.db.prepare("SELECT v.* FROM poll_votes v JOIN polls p ON p.id = v.poll_id WHERE COALESCE(p.closed, '') = '' OR p.created >= ?").bind(since),
    ]);
    const list = (v) => String(v || '').split(',').filter(Boolean);
    const base = (r) => ({ id: r.id, units: list(r.units), roles: list(r.roles), audience: r.audience || '', authorId: r.author_id || '', author: r.author || '', authorRank: Number(r.author_rank) || 99, created: r.created || '', closed: r.closed || '' });
    this.tasks = (t.results || []).map((r) => Object.assign(base(r), { title: r.title || '', desc: r.descr || '', due: r.due || '' }));
    this.taskPeople = (tp.results || []).map((r) => ({ taskId: r.task_id, tgId: r.tg_id, name: r.name || '', status: TASK_ST[r.status] ? r.status : 'todo', note: r.note || '', updated: r.updated || '' }));
    this.polls = (p.results || []).map((r) => Object.assign(base(r), { question: r.question || '', options: JSON.parse(r.options || '[]'), multi: !!r.multi, open: !!r.open_results, people: list(r.people) }));
    this.votes = (pv.results || []).map((r) => ({ pollId: r.poll_id, tgId: r.tg_id, opt: Number(r.opt), name: r.name || '' }));
  }
  async loadRes() {
    const rs = await this.db.prepare("SELECT * FROM resources WHERE status != 'відхилено' ORDER BY created DESC LIMIT 500").all();
    this.res = (rs.results || []).map((r) => ({ id: r.id, title: r.title || '', url: r.url || '', fileId: r.file_id || '', fileName: r.file_name || '', fkey: r.fkey || '', note: r.note || '', aud: r.aud || 'all', status: r.status, authorId: r.author_id || '', author: r.author || '', created: r.created || '' }));
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
  send(chatId, text, extra) { if (!isReal_(chatId)) return; this.out.push({ chat_id: String(chatId), text: text, extra: extra }); }
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

// одиниця автора для особистих записів: найвища не-командна роль; інакше — ерія його команди
function authorUnit_(b, tgId) {
  const act = b.roles.filter((r) => r.tgId === String(tgId) && r.status === ST.ACTIVE).sort((a, x) => a.rank - x.rank);
  const mainId = (b.people[String(tgId)] || {}).main;
  const main = mainId && act.filter((r) => r.id === mainId)[0];
  const up = main && main.level !== 'team' ? main : main ? null : act.filter((r) => r.level !== 'team')[0];
  if (main && main.level === 'team' && b.team[main.unitId]) { const t = b.team[main.unitId]; return { areaId: t.areaId, regionId: (b.area[t.areaId] || {}).regionId || '' }; }
  if (up) {
    if (up.level === 'area') return { areaId: up.unitId, regionId: (b.area[up.unitId] || {}).regionId || '' };
    if (up.level === 'region') return { areaId: '', regionId: up.unitId };
    return { areaId: '', regionId: '' };
  }
  const tm = act.filter((r) => r.level === 'team' && b.team[r.unitId])[0];
  if (tm) { const t = b.team[tm.unitId]; return { areaId: t.areaId, regionId: (b.area[t.areaId] || {}).regionId || '' }; }
  return { areaId: '', regionId: '' };
}
const selfKnown_ = (scope, stage) => (S.knownSelf || []).filter((r) => (!stage || r.stage === stage) && upperRowIn_(scope, { teamId: '', areaId: r.areaId, regionId: r.regionId })).reduce((a, r) => a + r.n, 0);

function indexBase(b) {
  b.region = {}; b.area = {}; b.team = {};
  b.regions.forEach((x) => { b.region[x.id] = x; });
  b.areas.forEach((x) => { b.area[x.id] = x; });
  b.teams.forEach((x) => { b.team[x.id] = x; });
  b.teamRegion = (teamId) => { const t = b.team[teamId]; return t && b.area[t.areaId] ? b.area[t.areaId].regionId : ''; };
}
function personFromRow(r) {
  let notif = {}, prefs = {};
  try { notif = r.notif ? JSON.parse(r.notif) : {}; } catch (e) { notif = {}; }
  try { prefs = r.prefs ? JSON.parse(r.prefs) : {}; } catch (e) { prefs = {}; }
  return { prefs: prefs, main: r.main || '', registered: r.registered || '', tgId: r.tg_id, username: r.username || '', name: r.name || '', phone: r.phone || '', email: r.email || '', bday: r.bday || '', repent: r.repent || '', baptism: r.baptism || '', lpyl: r.lpyl || '', resp: r.resp || '', title: r.title || '', ig: r.ig || '', family: r.family || '', notif: notif };
}
function roleFromRow(r) {
  const def = roleDef_(r.role_key);
  if (!def) return null;
  const title = def.titled ? String(r.title || '').trim() : '';
  return { id: r.id, tgId: r.tg_id, name: r.name || '', key: def.key, title: title, label: title ? title + ' (' + def.label.toLowerCase() + ')' : def.label, rank: def.rank, level: def.level, unitId: r.unit_id || '', status: r.status, requested: r.requested || '', decided: r.decided || '' };
}
function logFromRow(r) {
  return { id: r.id, pid: r.pid || '', date: r.date, week: r.week, type: r.type, mode: r.mode, teamId: r.team_id, areaId: r.area_id, regionId: r.region_id, count: r.count || 0, newT: r.new_t || 0, leaders: r.leaders || 0, parents: r.parents || 0, note: r.note || '', created: r.created || '', hours: r.hours || 0, inc: 0, spent: 0, authorId: r.author_id || '', author: r.author || '', attendees: r.attendees || '' };
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

// вища роль r лежить у межах вибору (одиниці або кількох)
function upperIn_(scope, r) {
  if (scope.level === 'multi') return scope.members.some((m) => upperIn_(m, r));
  return within_({ level: scope.level, unitId: scope.unitId }, r);
}
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
const loadKnownGone_ = () => S.knownGone || [];
const loadEvents_ = () => S.events;
// ── повторювані події: серія зберігається одним рядком, дати розгортаються на льоту ──
const REPEAT = { week: 'щотижня', '2week': 'раз на 2 тижні', month: 'щомісяця' };
const EV_LIVE_SQL = (a) => 'SELECT * FROM events WHERE COALESCE(' + a + 'end_date, ' + a + 'date) >= ? OR (COALESCE(' + a + "rep, '') != '' AND (COALESCE(" + a + "rep_until, '') = '' OR " + a + 'rep_until >= ?))';
const dayDiff_ = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
// дати серії від from до to (включно, за датою початку); max — не більше стількох
function repeatDates_(e, from, to, max) {
  if (!e.rep) return e.date >= from && e.date <= to ? [e.date] : [];
  const out = [];
  const last = e.until && e.until < to ? e.until : to;
  const p = e.date.split('-').map(Number);
  for (let i = 0; out.length < (max || 400) && i < 1000; i++) {
    let d;
    if (e.rep === 'month') {
      const dt = new Date(Date.UTC(p[0], p[1] - 1 + i, p[2]));
      if (dt.getUTCDate() !== p[2]) continue; // у місяці немає такого числа (напр., 31-го)
      d = dt.toISOString().slice(0, 10);
    } else d = addDaysKey_(e.date, i * (e.rep === '2week' ? 14 : 7));
    if (d > last) break;
    if (d >= from && e.skip.indexOf(d) < 0) out.push(d);
  }
  return out;
}
// одна дата серії як окрема подія (id «серія@дата»)
function occurrence_(e, date) {
  if (!e.rep) return e;
  const len = e.end ? dayDiff_(e.date, e.end) : 0;
  return Object.assign({}, e, { id: e.id + '@' + date, seriesId: e.id, date: date, end: len ? addDaysKey_(date, len) : '', start0: e.date, end0: e.end });
}
function eventById_(id) {
  const parts = String(id || '').split('@');
  const e = loadEvents_().filter((x) => x.id === parts[0])[0];
  if (!e) return null;
  if (!parts[1]) return e.rep ? null : e;
  if (!e.rep || !/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) || repeatDates_(e, parts[1], parts[1]).indexOf(parts[1]) < 0) return null;
  return occurrence_(e, parts[1]);
}
function unitName_(level, id) {
  const st = loadStruct_();
  if (level === 'nat') return 'Україна';
  if (level === 'region') return (st.region[id] || {}).name || '';
  if (level === 'area') return (st.area[id] || {}).name || '';
  return (st.team[id] || {}).name || '';
}

// Записи (у памʼять — одразу, у базу — при flush)
function insertRole_(row) {
  S.run('INSERT INTO roles (id, tg_id, name, role_key, level, unit_id, status, decided_by, requested, decided, title) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [row.id, row.tgId, row.name, row.key, row.level, row.unitId, row.status, row.decidedBy || '', row.requested || nowIso(), row.decided || '', row.title || ''], true);
  S.b.roles.push(roleFromRow({ id: row.id, tg_id: row.tgId, name: row.name, role_key: row.key, unit_id: row.unitId, status: row.status, requested: row.requested || nowIso(), title: row.title || '' }));
}
function setRoleStatus_(r, status, by) {
  S.run('UPDATE roles SET status = ?, decided_by = ?, decided = ? WHERE id = ?', [status, by || '', nowIso(), r.id], true);
  r.status = status;
}
function savePerson_(c, d) {
  const p = getPerson_(c.id);
  const v = {};
  const F = { name: 'name', phone: 'phone', bday: 'bday', repent: 'repent', baptism: 'baptism', lpyl: 'lpyl', resp: 'resp', ig: 'ig' };
  Object.keys(F).forEach((k) => { if (d[k] != null) v[F[k]] = clip_(d[k]); });
  if (v.ig) v.ig = igNorm_(v.ig);
  if (d.email != null) v.email = clip_(String(d.email).trim().toLowerCase());
  if (d.title != null) v.title = clip_(String(d.title).slice(0, 60));
  if (d.main != null) v.main = clip_(d.main);
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
  // «Національний адмін» — посада в Національному офісі з повноваженнями на всю Україну (не належить жодному регіону)
  active.filter((r) => r.key === 'OFFICE' && /націон\S*\s+адмін/i.test(r.title || '')).forEach((r) => {
    if (!roles.some((x) => x.key === 'NATIONAL_ADMIN')) roles.push(Object.assign({}, r, { id: r.id + ':na', key: 'NATIONAL_ADMIN', label: 'Національний адмін', rank: 1, level: 'nat', unitId: '', virtual: true }));
  });
  return { id: id, tg: tg, person: person, roles: roles, active: active, allRoles: all, get name() { const p = getPerson_(id); return (p && p.name) || fullName_(tg); } };
}
// ── «Відобразити як для»: перегляд застосунку очима нижчої ролі (лише читання) ──
const VIEW_OK = /^(ws|wsCard|wsPage|wsProfiles|wsAnalytics|me|knownList|stats|dirStats|installStats|teamMembers|events|tasks|polls|resList|requests|financeGet|finTx|structureTree|myylTree|permsGet|audCount|claimFind|broadcastInfo|myStats|report)$/;
// ролі, якими людина може «подивитися»: усі нижчі за її найвищу (без «власник»)
function viewRoles_(c) {
  if (!c.roles.length) return [];
  const top = Math.min.apply(null, c.roles.map((r) => r.rank));
  // «Національний офіс» очима — лише власник
  return ROLES.filter((r) => r.key !== 'SUPER' && !r.hidden && r.rank > top && (r.key !== 'OFFICE' || isSuper_(c))).map((r) => ({ key: r.key, label: r.label, level: r.level }));
}
function viewCtx_(c, v) {
  const def = roleDef_(String(v.key || ''));
  if (!def || def.key === 'SUPER') throw new ApiError('bad_request', 'Невідома роль для перегляду.');
  if (!viewRoles_(c).some((r) => r.key === def.key)) throw new ApiError('forbidden', 'Можна дивитися лише очима ролей, нижчих за твою.');
  // ланка: та, що обрана, або перша доступна цього рівня в межах людини
  const pref = { team: 't:', area: 'a:', region: 'r:', nat: 'nat' }[def.level];
  const sc = allowedScopes_(c);
  let unit = String(v.unit || '');
  const fits = (k) => (def.level === 'nat' ? k === 'nat' : k.indexOf(pref) === 0);
  if (!unit || !sc.some((x) => x.key === unit) || !fits(unit)) {
    const own = c.roles.filter((r) => r.level === def.level).map((r) => (r.level === 'nat' ? 'nat' : pref + r.unitId))[0];
    unit = own || ((sc.filter((x) => fits(x.key))[0] || {}).key) || (def.level === 'nat' ? 'nat' : '');
  }
  if (!unit) throw new ApiError('bad_request', 'У тебе немає ланки рівня «' + def.label + '» для перегляду.');
  const unitId = unit === 'nat' ? '' : unit.slice(2);
  const role = { id: 'view:' + def.key, tgId: c.id, name: c.name, key: def.key, label: def.label, rank: def.rank, level: def.level, unitId: unitId, status: ST.ACTIVE, title: '', requested: '', decided: '' };
  const vr = def.viewOnly ? [] : [role];
  return { id: c.id, tg: c.tg, person: c.person, roles: vr, active: [role], allRoles: [role], get name() { return c.name; },
    view: { key: def.key, label: def.label, unit: unit, unitName: unit === 'nat' ? 'Україна' : unitName_(def.level, unitId) } };
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
// чи дозволено ролі r (з її місцем) дію perm: заборона на будь-якому рівні вище — остаточна
function okR_(r, perm) {
  const P = PERM[perm];
  if (!P || r.key === 'SUPER') return true;
  let v = P.def(r);
  if (P.levels && P.levels.indexOf(r.level) < 0) return v;
  const map = S.b.perms;
  if (!map || !Object.keys(map).length) return v;
  const chain = ancestors_(r.level, r.unitId);
  for (let i = chain.length - 1; i >= 0; i--) {
    const x = map[unitKey_(chain[i].level, chain[i].unitId) + '|' + r.key + '|' + perm];
    if (x === 0) return false;
    if (x === 1) v = true;
  }
  return v;
}
// контекст лише з тими ролями, яким дозволено perm
const P_ = (c, perm) => Object.assign({}, c, { roles: c.roles.filter((r) => okR_(r, perm)), active: (c.active || c.roles).filter((r) => r.key === 'OFFICE' || okR_(r, perm)) });
const teamRoles_ = (c, teamId, perm) => c.roles.filter((r) => r.level === 'team' && r.unitId === teamId && okR_(r, perm));
const canViewTeam_ = (c, teamId) => c.roles.some((r) => covers_(r, 'team', teamId) && okR_(r, 'see.team'));
const canTeam_ = (c, teamId, perm) => teamRoles_(c, teamId, perm).length > 0 || upperRoles_(c).some((r) => covers_(r, 'team', teamId) && okR_(r, perm));
// директор ерії бачить статистику всього свого регіону (лише перегляд статистики)
const wideStats_ = (c) => {
  const st = loadStruct_();
  const extra = c.roles.filter((r) => (r.key === 'AREA_DIRECTOR' || r.key === 'AREA_ADMIN') && r.level === 'area' && st.area[r.unitId])
    .map((r) => Object.assign({}, r, { id: r.id + ':r', level: 'region', unitId: st.area[r.unitId].regionId, virtual: true }));
  return extra.length ? Object.assign({}, c, { roles: c.roles.concat(extra) }) : c;
};
const isSugarOnly_ = (c) => c.roles.length > 0 && c.roles.every((r) => r.key === 'SUGAR');
const isSuper_ = (c) => c.roles.some((r) => r.key === 'SUPER');
// Національний офіс: роль «лише перегляд», але своя особиста статистика (МГ, КР, знані) і статистика офісу та України
const isOffice_ = (c) => (c.active || []).some((r) => r.key === 'OFFICE');
const officeOnly_ = (c) => !c.roles.length && isOffice_(c);
// контекст для статистики/звітів офісу: Україна (лише загальні цифри) + «Національний офіс»; withNat=false — без України
const officeCtx_ = (c, withNat) => Object.assign({}, c, { officeView: true, roles: [{ id: 'office', key: 'OFFICE', level: 'nat', unitId: '', rank: 13, officeView: true, withNat: withNat !== false }] });

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
  // Адмін команди підтверджує й додає ролі нижчі за свою у своїй команді
  return c.roles.some((r) => (r.rank <= RANK.APPROVE && r.rank < def.rank && covers_(r, target.level, target.unitId)) ||
    (r.key === 'TEAM_ADMIN' && def.level === 'team' && target.level === 'team' && r.unitId === target.unitId && def.rank > r.rank));
}
function primaryApprovers_(target) {
  const def = roleDef_(target.key);
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.tgId !== target.tgId && isReal_(r.tgId));
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
function clubTeams_(c) {
  const st = loadStruct_();
  const ids = {};
  c.roles.forEach((r) => {
    if (!okR_(r, 'rep.club')) return;
    if (r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active) ids[r.unitId] = true;
    if (r.level !== 'team') st.teams.forEach((t) => { if (t.active && covers_(r, 'team', t.id)) ids[t.id] = true; });
  });
  return Object.keys(ids);
}
// команди, де людина сама має роль не нижчу за maxRank
function ownTeams_(c, perm) {
  const st = loadStruct_();
  return uniq_(c.roles.filter((r) => r.level === 'team' && okR_(r, perm) && st.team[r.unitId] && st.team[r.unitId].active).map((r) => r.unitId));
}
// вища роль без команди: особистий запис МГ/КР іде на рівень її одиниці (ерія / регіон / Україна)
function upperSelfUnit_(c) {
  const mainId = (getPerson_(c.id) || {}).main;
  const main = mainId && c.roles.filter((x) => x.id === mainId && x.level !== 'team')[0];
  const r = main || c.roles.filter((x) => x.level !== 'team').sort((a, b) => a.rank - b.rank)[0];
  if (!r && isOffice_(c)) return { level: 'nat', unitId: '' };
  return r ? { level: r.level, unitId: r.unitId } : null;
}
const canSelf_ = (c, perm) => ownTeams_(c, perm).length > 0 || !!upperSelfUnit_(P_(c, perm));
// записи без команди (вищі ролі) — враховуються в підсумках їхньої ерії / регіону / України
function upperRowIn_(scope, r) {
  if (r.teamId) return false;
  if (scope.level === 'multi') return scope.members.some((m) => upperRowIn_(m, r));
  if (scope.level === 'nat') return true;
  if (scope.level === 'office') return !r.areaId && !r.regionId;
  if (scope.level === 'region') return r.regionId === scope.unitId;
  if (scope.level === 'area') return r.areaId === scope.unitId;
  return false;
}
// особисті записи (МГ/КР) зберігаються в кожній команді людини з одним pid — у підсумках рахуємо один раз
function dd_(arr) { const seen = {}; return arr.filter((r) => { if (!r.pid) return true; if (seen[r.pid]) return false; seen[r.pid] = 1; return true; }); }

function reportTeams_(c, perm) {
  const st = loadStruct_();
  const ids = {};
  c.roles.forEach((r) => {
    if (!okR_(r, perm)) return;
    if (r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active) ids[r.unitId] = true;
    if (r.level !== 'team') st.teams.forEach((t) => { if (t.active && covers_(r, 'team', t.id)) ids[t.id] = true; });
  });
  return Object.keys(ids);
}
const canApproveAny_ = (c) => c.roles.some((r) => r.rank <= RANK.APPROVE || r.key === 'REGIONAL_ADMIN' || r.key === 'AREA_ADMIN' || r.key === 'TEAM_ADMIN');
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
      teams: st.teams.filter((t) => t.active).map((t) => ({ id: t.id, areaId: t.areaId, name: t.name, dir: t.dir })),
      dirs: DIRS,
    },
    roleDefs: ROLES.filter((r) => r.key !== 'SUPER').map((r) => ({ key: r.key, label: r.label, level: r.level, rank: r.rank, hidden: !!r.hidden, titled: !!r.titled, titles: r.key === 'OFFICE' ? OFFICE_TITLES : undefined })),
    roles: c.allRoles.filter((r) => (r.status === ST.ACTIVE || r.status === ST.PENDING) && r.key !== 'SUPER').map(roleOut_),
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
    report: { club: myClubTeams_(c), mg: ownTeams_(c, 'rep.mg'), kr: ownTeams_(c, 'rep.kr') },
    clubAll: clubTeams_(c),
    reportSelf: { mg: canSelf_(c, 'rep.mg'), kr: canSelf_(c, 'rep.kr'), unit: (() => { if (officeOnly_(c)) return 'Національному офісу'; const u = !ownTeams_(c, 'rep.kr').length && upperSelfUnit_(c); return u ? levelLabel_(u.level, u.unitId) : ''; })() },
    knownTeams: reportTeams_(c, 'see.known'),
    knownEditTeams: uniq_(c.roles.filter((r) => r.level === 'team' && okR_(r, 'rep.known') && loadStruct_().team[r.unitId] && loadStruct_().team[r.unitId].active).map((r) => r.unitId)),
    knownNoTeam: canNoTeam_(c),
    financeTeams: reportTeams_(c, 'see.fin'),
    financeEdit: st.teams.filter((t) => t.active && canFinEdit_(c, t.id)).map((t) => t.id),
    viewTeams: st.teams.filter((t) => t.active && canViewTeam_(c, t.id)).map((t) => t.id),
    approve: canApproveAny_(c),
    eventUnits: eventUnits_(c),
    upper: upperRoles_(c).length > 0,
    sugarOnly: isSugarOnly_(c),
    surveys: false,
    manage: c.roles.some((r) => MANAGE_AREAS.indexOf(r.key) >= 0 || MANAGE_TEAMS.indexOf(r.key) >= 0),
    myyl: allowedScopes_(P_(c, 'see.myyl')).length > 0,
    stats: P_(c, 'see.stats').roles.length > 0 || officeOnly_(c),
    perms: permUnits_(c).length > 0,
    addTeams: addTeams_(c),
    reportItems: reportItems_(c),
    dirs: canDirs_(c),
    broadcast: canBroadcast_(c),
    isSuper: isSuper_(c),
  };
  out.myTeams = Object.keys(myTeams).map(teamOut_);
  out.scopes = allowedScopes_(c);
  const wide = wideStats_(P_(c, 'see.stats'));
  if (wide.roles.some((r) => r.virtual) || c.roles.some((r) => r.level === 'nat')) out.statScopes = allowedScopes_(wide, { office: true });
  if (c.roles.some((r) => r.level === 'nat')) out.reportScopes = reportScopes_(c);
  if (officeOnly_(c)) { out.statScopes = allowedScopes_(officeCtx_(c)); out.reportScopes = allowedScopes_(officeCtx_(c)); }
  out.week = weekStatus_(c);
  out.myWeek = myWeek_(c);
  if (c.view) out.viewAs = c.view; else out.viewRoles = viewRoles_(c);
  out.todo = tpCounts_(c);
  if (out.caps.approve) out.editRoles = editRoles_(c);
  if (out.caps.isSuper) out.bugsOpen = S.bugOpen || 0;
  // останній внесений клуб — для команд, де людина вносить клуб (показуємо над формою)
  const lc = {};
  (S.lastClubRows || []).forEach((r) => { lc[r.teamId] = { date: r.date, none: r.mode === MODE.none, teens: r.count, leaders: r.leaders }; });
  out.clubPlans = myClubPlans_(c);
  out.lastClubs = {};
  out.caps.report.club.forEach((id) => { if (lc[id]) out.lastClubs[id] = lc[id]; });
  out.pendingCount = out.caps.approve ? pendingFor_(c).filter((r) => primaryApprovers_(r).indexOf(c.id) >= 0).length : 0;
  if (out.caps.upper) out.scopeCard = scopeCard_(c);
  return out;
};

API.register = function (c, d) {
  const name = str_(d.name).replace(/\s+/g, ' ');
  if (name.length < 2) bad_('Вкажи імʼя та прізвище.');
  const claim = str_(d.claim);
  if (!claim && (!d.roles || !d.roles.length)) bad_('Обери хоча б одну роль.');
  savePerson_(c, { name: name, phone: d.phone, email: d.email });
  if (claim) {
    claimMember_(c, claim, name, str_(d.teamId));
    if (!d.roles || !d.roles.length) return { status: 'active', approvers: '' };
  }
  const res = requestRoles_(c, d);
  // якщо капітан уже вніс цю людину в склад — роль одразу активна
  if (linkPlaceholders_(c.id) && loadRoles_().some((r) => r.tgId === c.id && r.status === ST.ACTIVE)) res.status = 'active';
  return res;
};
// записи «без MyYL», що збігаються з людиною в боті: повне імʼя — одразу; схоже — якщо вона в тій самій команді чи ерії
function linkPlaceholders_(onlyId) {
  const st = loadStruct_();
  const roles = loadRoles_();
  const real = Object.keys(S.b.people).filter((id) => isReal_(id) && S.b.people[id].name && (!onlyId || id === onlyId));
  if (!real.length) return 0;
  const areaOf = (r) => (r.level === 'team' ? (st.team[r.unitId] || {}).areaId : r.level === 'area' ? r.unitId : '');
  let n = 0;
  uniq_(roles.filter((r) => !isReal_(r.tgId) && r.status === ST.ACTIVE).map((r) => r.tgId)).forEach((mid) => {
    const pname = (getPerson_(mid) || {}).name;
    if (!pname) return;
    const mine = roles.filter((r) => r.tgId === mid && r.status === ST.ACTIVE);
    const un = String((getPerson_(mid) || {}).username || '').toLowerCase();
    const byUser = un ? real.filter((id) => String(S.b.people[id].username || '').toLowerCase() === un) : [];
    if (byUser.length === 1) { mergeMember_(mid, byUser[0]); n++; return; }
    const cands = real.filter((id) => {
      const sc = nameScore_(pname, S.b.people[id].name);
      if (!sc.same) return false;
      if (sc.exact) return true;
      return roles.some((t) => t.tgId === id && (t.status === ST.ACTIVE || t.status === ST.PENDING) && mine.some((m) => t.unitId === m.unitId || (areaOf(t) && areaOf(t) === areaOf(m))));
    });
    if (cands.length !== 1) return;
    mergeMember_(mid, cands[0]);
    n++;
  });
  return n;
}
// дописати порожні поля анкети (нічого вже заповненого не перезаписуємо); повертає назви дописаних полів
const FILL_ = ['phone', 'bday', 'ig', 'family', 'title', 'username'];
function fillPerson_(id, src, keepUser) {
  const p = S.b.people[id];
  if (!p) return [];
  const v = {};
  FILL_.forEach((k) => {
    if (!src[k] || p[k]) return;
    if (k === 'username' && isReal_(id) && !keepUser) return; // юзернейм зареєстрованих — лише з Telegram
    v[k] = clip_(String(src[k])).slice(0, 80);
  });
  const keys = Object.keys(v);
  if (keys.length) { S.run('UPDATE people SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE tg_id = ?', keys.map((k) => v[k]).concat([id]), true); Object.assign(p, v); }
  return keys;
}
function mergeMember_(mid, id) {
  const name = S.b.people[id].name;
  const theirs = loadRoles_().filter((r) => r.tgId === id);
  const got = [];
  loadRoles_().filter((r) => r.tgId === mid).forEach((r) => {
    const dup = theirs.filter((t) => t.key === r.key && t.unitId === r.unitId && (t.status === ST.ACTIVE || t.status === ST.PENDING))[0];
    if (dup && dup.status === ST.ACTIVE) { r.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, r.id], true); return; }
    if (dup) { dup.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, dup.id], true); }
    r.tgId = id; r.name = name;
    S.run('UPDATE roles SET tg_id = ?, name = ? WHERE id = ?', [id, name, r.id], true);
    if (r.status === ST.ACTIVE) got.push(r);
  });
  fillPerson_(id, S.b.people[mid] || {}, true);
  S.run('DELETE FROM people WHERE tg_id = ?', [mid], true);
  delete S.b.people[mid];
  if (got.length && wants_(id, 'requests')) sendApp_(id, '✅ Тебе вже внесли в склад: ' + got.map((r) => esc_(r.label + ' · ' + levelLabel_(r.level, r.unitId).replace(/^Команда /, ''))).join(', ') + '. Роль активна — заходь!', 'Відкрити');
}

// ── люди в складі без MyYL (їх додає капітан / адмін команди або імпорт) ──
// tg_id таких людей починається з «m:»; коли людина реєструється, вона обирає себе — і ролі переходять до неї
const isReal_ = (id) => /^\d+$/.test(String(id || ''));
function nameToks_(s) {
  return String(s || '').toLowerCase().replace(/[ʼ’'`"]/g, '').replace(/ё/g, 'е').replace(/[^a-zа-яіїєґ\s-]/gi, ' ').split(/[\s-]+/).filter((x) => x.length >= 2);
}
function lev_(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = [];
  for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; }
  return m[a.length][b.length];
}
// повні й короткі форми імен: «Ольга» = «Оля», «Анастасія» = «Настя», «Галина» = «Галя»…
const NICK_ = [
  'ольга оля олька', 'анастасія настя настуся ася', 'галина галя', 'тетяна таня', 'ірина іра ірка', 'олександр саша сашко олекса', 'олександра саша сашка', 'володимир вова володя',
  'дмитро діма дмитрик', 'юлія юля', 'катерина катя катруся', 'марія марічка маша маруся', 'софія соня софійка', 'вікторія віка', 'євген женя', 'євгенія женя',
  'олексій льоша олесь', 'сергій сєрьожа серьожа', 'максим макс', 'владислав влад владик', 'владислава влада', 'єлизавета ліза лізa', 'дарина даша дарʼя дарья дарка', 'христина христя',
  'наталія наталя ната наташа', 'василь вася', 'микола коля', 'петро петя', 'іван ваня іванко', 'михайло мишко міша', 'юрій юра юрко', 'богдан бодя', 'богдана бодя',
  'анна ганна аня ганя', 'надія надя', 'любов люба', 'роман рома', 'ярослав ярик ярко', 'ярослава яся ярина', 'станіслав стас', 'ростислав ростик', 'святослав свят',
  'валентин валік', 'валентина валя', 'артем тьома', 'оксана ксюша', 'ксенія ксюша', 'іванна іванка', 'олена лена альона', 'людмила люда люся міла', 'світлана світла свєта',
  'вероніка ніка', 'валерія лєра лера', 'соломія соля', 'ангеліна ліна', 'поліна поля', 'віталіна віта', 'маріанна маряна марʼяна', 'антон тоша', 'андрій андрійко', 'тимофій тимко тіма', 'яніна яна',
];
const NICK_MAP_ = {};
NICK_.forEach((g, i) => g.split(' ').forEach((w) => { (NICK_MAP_[w.replace(/[ʼ’']/g, '')] = NICK_MAP_[w.replace(/[ʼ’']/g, '')] || []).push(i); }));
// звучання імені незалежно від абетки: «Olya» = «Оля», «Hanna» = «Ганна», «Khrystyna» = «Христина»
function phon_(t) {
  let x = String(t || '').toLowerCase().split('').map((ch) => (TR_[ch] != null ? TR_[ch] : ch)).join('');
  x = x.replace(/kh/g, 'h').replace(/ts/g, 'c').replace(/ck/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/w/g, 'v').replace(/[yj]/g, 'i')
    .replace(/h/g, 'g').replace(/ie/g, 'e').replace(/ii/g, 'i').replace(/(.)\1+/g, '$1');
  return x;
}
let NICK_PH_ = null;
const nickPh_ = (t) => {
  if (!NICK_PH_) { NICK_PH_ = {}; NICK_.forEach((g, i) => g.split(' ').forEach((w) => { const k = phon_(w.replace(/[ʼ’']/g, '')); (NICK_PH_[k] = NICK_PH_[k] || []).push(i); })); }
  return NICK_PH_[phon_(t)];
};
const nickEq_ = (a, b) => { const A = NICK_MAP_[a] || nickPh_(a), B = NICK_MAP_[b] || nickPh_(b); return !!(A && B && A.some((x) => B.indexOf(x) >= 0)); };
const latin_ = (t) => /[a-z]/.test(t);
const tokEq_ = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && lev_(a, b) <= 1) || nickEq_(a, b) ||
  ((latin_(a) !== latin_(b) || (latin_(a) && latin_(b))) && (phon_(a) === phon_(b) || (Math.min(a.length, b.length) >= 4 && lev_(phon_(a), phon_(b)) <= 1)));
function nameScore_(a, b) {
  const A = nameToks_(a), B = nameToks_(b);
  const s = A.filter((x) => B.some((y) => tokEq_(x, y))).length;
  return { s: s, exact: A.length > 0 && A.length === B.length && A.every((x) => B.indexOf(x) >= 0), same: A.length > 0 && s >= Math.min(A.length, B.length, 2),
    alike: A.length > 0 && A.length === B.length && A.every((x) => B.some((y) => tokEq_(x, y))) && B.every((y) => A.some((x) => tokEq_(x, y))) };
}
// чи може c дати роль key у команді teamId (капітан і вище — як підтвердження; адмін команди — ролі нижче себе)
function canAssign_(c, teamId, key) {
  const def = roleDef_(key);
  if (!def || def.level !== 'team' || !loadStruct_().team[teamId]) return false;
  if (isSuper_(c)) return true;
  if (canDecide_(c, { key: key, level: 'team', unitId: teamId, tgId: '' })) return true;
  return c.roles.some((r) => r.key === 'TEAM_ADMIN' && r.unitId === teamId && def.rank > r.rank);
}
function addTeams_(c) {
  const st = loadStruct_();
  const keys = ROLES.filter((x) => x.level === 'team').map((x) => x.key);
  const out = [];
  st.teams.forEach((t) => {
    const roles = keys.filter((k) => canAssign_(c, t.id, k));
    if (roles.length) out.push({ id: t.id, roles: roles });
  });
  return out;
}
// додати людину в команду: дубль — пропускаємо; зареєстрований з тим самим імʼям — одразу даємо роль йому; інакше — запис без MyYL
function addMember_(by, teamId, rawName, key) {
  const name = clip_(String(rawName || '').replace(/\s+/g, ' ').trim()).slice(0, 80);
  if (nameToks_(name).length < 1 || name.length < 2) return 'bad';
  const inTeam = loadRoles_().filter((r) => r.level === 'team' && r.unitId === teamId && (r.status === ST.ACTIVE || r.status === ST.PENDING));
  if (inTeam.some((r) => nameScore_(name, (getPerson_(r.tgId) || {}).name || r.name).same)) return 'dup';
  const twin = Object.keys(S.b.people).filter((id) => isReal_(id) && nameScore_(name, S.b.people[id].name).exact);
  const def = roleDef_(key);
  const row = { id: uid_(), tgId: '', name: name, key: key, level: 'team', unitId: teamId, status: ST.ACTIVE, decidedBy: by, decided: nowIso(), requested: nowIso() };
  if (twin.length === 1) {
    row.tgId = twin[0]; row.name = S.b.people[twin[0]].name || name;
    insertRole_(row);
    return 'linked';
  }
  row.tgId = 'm:' + uid_();
  S.run('INSERT INTO people (tg_id, name, registered) VALUES (?,?,?)', [row.tgId, name, ''], true);
  S.b.people[row.tgId] = personFromRow({ tg_id: row.tgId, name: name });
  insertRole_(row);
  if (def && def.rank <= RANK.APPROVE) activateTeam_(teamId);
  return 'added';
}
API.memberAdd = function (c, d) {
  const teamId = str_(d.teamId), key = str_(d.role);
  if (!canAssign_(c, teamId, key)) deny_('Ти не можеш давати цю роль у цій команді.');
  const names = (Array.isArray(d.names) ? d.names : String(d.names || d.name || '').split(/\n|;/)).map((x) => String(x).replace(/^\s*(\d+[.)]|[-•*–])\s*/, '').trim()).filter(Boolean).slice(0, 100);
  if (!names.length) bad_('Впиши імʼя та прізвище.');
  const res = { added: 0, linked: 0, dup: 0, bad: 0 };
  names.forEach((n) => { res[addMember_(c.name, teamId, n, key)]++; });
  return res;
};
// хто з цієї команди схожий на людину, яка реєструється
API.claimFind = function (c, d) {
  const teamId = str_(d.teamId), name = str_(d.name);
  if (!teamId || name.length < 2) return [];
  const by = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId && !isReal_(r.tgId)).forEach((r) => {
    const nm = (getPerson_(r.tgId) || {}).name || r.name;
    const sc = nameScore_(name, nm);
    if (!sc.s) return;
    const p = by[r.tgId] = by[r.tgId] || { id: r.tgId, name: nm, roles: [], score: sc.s + (sc.exact ? 1 : 0) };
    p.roles.push(r.label);
  });
  return Object.keys(by).map((k) => by[k]).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 6).map((p) => ({ id: p.id, name: p.name, roles: p.roles }));
};
function claimMember_(c, mid, name, teamId) {
  if (isReal_(mid) || mid.indexOf('m:') !== 0) bad_('Невірний вибір.');
  const rows = loadRoles_().filter((r) => r.tgId === mid && r.status === ST.ACTIVE);
  if (!rows.length) bad_('Цього запису вже немає в складі — обери роль звичайним способом.');
  if (teamId && !rows.some((r) => r.unitId === teamId)) bad_('Цей запис з іншої команди.');
  const pname = (getPerson_(mid) || {}).name || rows[0].name;
  if (!nameScore_(name, pname).s) bad_('Імʼя не схоже — обери роль звичайним способом.');
  S.run('UPDATE roles SET tg_id = ?, name = ? WHERE tg_id = ?', [c.id, name, mid], true);
  S.run('DELETE FROM people WHERE tg_id = ?', [mid], true);
  delete S.b.people[mid];
  rows.forEach((r) => { r.tgId = c.id; r.name = name; });
  // повідомити тих, хто відповідає за ці ролі: раптом обрали не себе
  const text = '🔗 <b>' + esc_(name) + '</b> зареєструвався(-лась) у MyYL і обрав(ла) себе в складі: ' + rows.map((r) => esc_(r.label + ' · ' + levelLabel_(r.level, r.unitId).replace(/^Команда /, ''))).join(', ') +
    (nameScore_(name, pname).exact ? '' : '\n(у списку було: ' + esc_(pname) + ')') + '\n\nЯкщо це не та людина — зніми роль у «Склад команди».';
  uniq_([].concat.apply([], rows.map((r) => primaryApprovers_(r)))).filter((id) => id !== c.id).forEach((id) => sendApp_(id, text, 'Склад команди', 'team'));
}

API.requestRoles = function (c, d) {
  if (!getPerson_(c.id)) bad_('Спершу зареєструйся.');
  return requestRoles_(c, d);
};

function requestRoles_(c, d) {
  const st = loadStruct_();
  let teamId = str_(d.teamId);
  const areaId = str_(d.areaId);
  const regionId = str_(d.regionId) || (st.area[areaId] || {}).regionId || '';
  const keys = (d.roles || []).map(String).filter((k) => roleDef_(k) && k !== 'SUPER' && !roleDef_(k).hidden);
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
    // власник не чекає на підтвердження власних ролей
    if (sup && def.level === 'team') activateTeam_(unitId);
    const row = { id: uid_(), tgId: c.id, name: c.name, key: k, level: def.level, unitId: unitId, status: sup ? ST.ACTIVE : ST.PENDING, decidedBy: sup ? c.name : '', decided: sup ? nowIso() : '', title: def.titled ? clip_(((d.titles || {})[k] || '')).slice(0, 120) : '' };
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
// ролі, на які можна виправити заявку (нижчі за свою; остаточно перевіряє roleEdit)
function editRoles_(c) {
  const top = isSuper_(c) ? 0 : Math.min.apply(null, c.roles.map((r) => r.rank).concat([99]));
  return ROLES.filter((r) => r.key !== 'SUPER' && !r.hidden && r.rank > top).map((r) => ({ key: r.key, label: r.label, level: r.level }));
}

function setRoleTitle_(r, title) {
  const t = clip_(title).slice(0, 120);
  S.run('UPDATE roles SET title = ? WHERE id = ?', [t, r.id], true);
  const def = roleDef_(r.key);
  r.title = t; r.label = t ? t + ' (' + def.label.toLowerCase() + ')' : def.label;
}
// назву ролі в офісі змінює той, хто може її підтверджувати
API.roleTitle = function (c, d) {
  const r = loadRoles_().filter((x) => x.id === str_(d.roleId))[0];
  if (!r || !(roleDef_(r.key) || {}).titled) bad_('Цю роль не можна перейменувати.');
  if (!canDecide_(c, r)) deny_();
  setRoleTitle_(r, d.title);
  return { label: r.label };
};

API.decide = function (c, d) {
  const ids = (d.roleIds || []).map(String);
  const approve = !!d.approve;
  const done = [];
  loadRoles_().filter((r) => ids.indexOf(r.id) >= 0 && r.status === ST.PENDING).forEach((r) => {
    if (!canDecide_(c, r)) deny_('Ти не можеш вирішувати щодо ролі «' + r.label + '».');
    if (approve && d.titles && d.titles[r.id] != null && (roleDef_(r.key) || {}).titled) setRoleTitle_(r, d.titles[r.id]);
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

// додати роль конкретній людині в нижчій структурі (одразу активна — додає той, хто має право підтверджувати)
API.roleGrant = function (c, d) {
  const id = str_(d.tgId);
  const person = getPerson_(id);
  if (!person) bad_('Людину не знайдено.');
  const def = roleDef_(str_(d.key));
  if (!def || def.key === 'SUPER' || def.hidden) bad_('Обери роль.');
  const u = str_(d.unit);
  const level = u === 'nat' ? 'nat' : { r: 'region', a: 'area', t: 'team' }[u.slice(0, 1)];
  const unitId = u === 'nat' ? '' : u.slice(2);
  if (level !== def.level) bad_('Для ролі «' + def.label + '» обери ' + ({ nat: 'Україну', region: 'регіон', area: 'ерію', team: 'команду' }[def.level]) + '.');
  const st = loadStruct_();
  if ((level === 'region' && !st.region[unitId]) || (level === 'area' && !st.area[unitId]) || (level === 'team' && !st.team[unitId])) bad_('Такої ланки немає.');
  const target = { key: def.key, level: level, unitId: unitId, tgId: id };
  if (!canDecide_(c, target)) deny_('Таку роль у цій ланці ти не можеш додавати.');
  const dup = loadRoles_().filter((x) => x.tgId === id && x.key === def.key && x.level === level && x.unitId === unitId && (x.status === ST.ACTIVE || x.status === ST.PENDING))[0];
  if (dup && dup.status === ST.ACTIVE) bad_('У людини вже є ця роль.');
  if (dup) { setRoleStatus_(dup, ST.ACTIVE, c.name); }
  else insertRole_({ id: uid_(), tgId: id, name: person.name || '', key: def.key, level: level, unitId: unitId, status: ST.ACTIVE, decidedBy: c.name, decided: nowIso(), requested: nowIso() });
  if (level === 'team') activateTeam_(unitId);
  if (isReal_(id)) sendApp_(id, '🎉 Тобі додали роль: <b>' + esc_(def.label + ' · ' + unitName_(level, unitId)) + '</b>', 'Відкрити застосунок');
  return { ok: true };
};

// заявка з помилкою: той, хто підтверджує, міняє роль і/або ланку (регіон, ерію, команду) до підтвердження
API.roleEdit = function (c, d) {
  const r = loadRoles_().filter((x) => x.id === str_(d.roleId) && x.status === ST.PENDING)[0];
  if (!r) bad_('Заявку вже розглянуто.');
  if (!canDecide_(c, r)) deny_();
  const def = roleDef_(str_(d.key));
  if (!def || def.key === 'SUPER' || def.hidden) bad_('Обери роль.');
  const u = str_(d.unit);
  const level = u === 'nat' ? 'nat' : { r: 'region', a: 'area', t: 'team' }[u.slice(0, 1)];
  const unitId = u === 'nat' ? '' : u.slice(2);
  if (level !== def.level) bad_('Для ролі «' + def.label + '» обери ' + ({ nat: 'Україну', region: 'регіон', area: 'ерію', team: 'команду' }[def.level]) + '.');
  const st = loadStruct_();
  if ((level === 'region' && !st.region[unitId]) || (level === 'area' && !st.area[unitId]) || (level === 'team' && !st.team[unitId])) bad_('Такої ланки немає.');
  const target = { key: def.key, level: level, unitId: unitId, tgId: r.tgId };
  if (!canDecide_(c, target)) deny_('Таку роль у цій ланці ти не можеш підтверджувати.');
  if (loadRoles_().some((x) => x.id !== r.id && x.tgId === r.tgId && x.key === def.key && x.level === level && x.unitId === unitId && (x.status === ST.ACTIVE || x.status === ST.PENDING))) bad_('У людини вже є така роль.');
  S.run('UPDATE roles SET role_key = ?, level = ?, unit_id = ?, title = ? WHERE id = ?', [def.key, level, unitId, def.titled ? (r.title || '') : '', r.id], true);
  Object.assign(r, { key: def.key, level: level, unitId: unitId, rank: def.rank, title: def.titled ? r.title || '' : '' });
  r.label = def.titled && r.title ? r.title + ' (' + def.label.toLowerCase() + ')' : def.label;
  return { role: roleOut_(r) };
};

API.removeRole = function (c, d) {
  const r = loadRoles_().filter((x) => x.id === String(d.roleId) && x.status === ST.ACTIVE)[0];
  if (!r) bad_('Роль не знайдено.');
  if (r.tgId !== c.id && !canDecide_(c, r)) deny_();
  setRoleStatus_(r, ST.REMOVED, c.name);
  return { ok: true };
};

// видалити людину зі складу команди (усі її ролі в цій команді); запис без MyYL без інших ролей — видаляється повністю
const canDrop_ = (c, r) => r.tgId !== c.id && (canDecide_(c, r) || (r.level === 'team' && canAssign_(c, r.unitId, r.key)));
API.memberRemove = function (c, d) {
  const ids = (Array.isArray(d.roleIds) ? d.roleIds : []).map(String);
  const rs = loadRoles_().filter((x) => ids.indexOf(x.id) >= 0 && (x.status === ST.ACTIVE || x.status === ST.PENDING));
  if (!rs.length) bad_('Людину вже прибрано зі складу.');
  if (uniq_(rs.map((r) => r.tgId)).length !== 1) bad_('Обери одну людину.');
  if (!rs.every((r) => canDrop_(c, r))) deny_('Ти не можеш прибрати цю людину зі складу.');
  rs.forEach((r) => setRoleStatus_(r, ST.REMOVED, c.name));
  const id = rs[0].tgId;
  let deleted = false;
  if (!isReal_(id) && !loadRoles_().some((r) => r.tgId === id && (r.status === ST.ACTIVE || r.status === ST.PENDING))) {
    S.run('DELETE FROM people WHERE tg_id = ?', [id], true); delete S.b.people[id]; deleted = true;
  }
  return { removed: rs.length, deleted: deleted };
};

API.saveProfile = function (c, d) {
  if (!getPerson_(c.id)) bad_('Спершу зареєструйся.');
  if (d.main != null && d.main !== '' && !c.active.some((r) => r.id === String(d.main))) bad_('Обери одну зі своїх ролей.');
  savePerson_(c, d);
  return profileOf_(getPerson_(c.id));
};

// ── звіти ──
API.saveReport = function (c, d) {
  const type = d.type;
  const perm = { club: 'rep.club', mg: 'rep.mg', kr: 'rep.kr' }[type];
  if (!perm) bad_('Невідомий тип звіту.');
  const personal = type !== 'club';
  let teams = personal ? ownTeams_(c, perm) : [str_(d.teamId)];
  const upper = personal && !teams.length ? upperSelfUnit_(P_(c, perm)) : null;
  if (personal && !teams.length && !upper) deny_(type === 'mg' ? 'Малу групу вносить сам лідер — для цього потрібна роль Лідера (або вища).' : 'Контактну роботу кожен вносить за себе — для цього потрібна роль.');
  if (upper) teams = [''];
  if (!personal && clubTeams_(c).indexOf(teams[0]) < 0) deny_('Клуб вносять Капітан, Адмін команди або Еріа Директор.');
  // клуб — лише окрема подія (або «не було»), без підсумку тижня
  const mode = MODE[d.mode] && !(type === 'club' && d.mode === 'week') ? d.mode : 'event';
  const today = kyivDay(new Date());
  const date = mode === 'event' && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : today;
  const week = weekKey_(date);
  const n = (v) => { const x = Number(v); return isFinite(x) && x >= 0 ? x : 0; };
  const none = mode === 'none';
  const st = loadStruct_();
  const pid = personal ? uid_() : null;
  teams.forEach((teamId) => {
  const team = st.team[teamId] || {};
  const areaId = teamId ? team.areaId : upper.level === 'area' ? upper.unitId : '';
  const regionId = teamId ? st.teamRegion(teamId) : upper.level === 'region' ? upper.unitId : upper.level === 'area' ? (st.area[upper.unitId] || {}).regionId || '' : '';
  const row = {
    id: uid_(), pid: pid, created: nowIso(), date: date, week: week, type: type, mode: MODE[mode], team_id: teamId, area_id: areaId, region_id: regionId,
    count: none || type === 'kr' ? 0 : n(d.teens), new_t: none || type === 'kr' ? 0 : n(d.newT), leaders: none || type === 'kr' ? 0 : n(d.leaders), parents: none || type !== 'club' ? 0 : n(d.parents),
    hours: none || type !== 'kr' ? 0 : n(d.hours), topic: type === 'mg' ? clip_(d.topic) : '', note: clip_(d.note),
    attendees: (d.attendees || []).map(String).join(','), author_id: c.id, author: c.name,
  };
  const keys = Object.keys(row);
  S.run('INSERT INTO reports (' + keys.join(', ') + ') VALUES (' + keys.map(() => '?').join(',') + ')', keys.map((k) => row[k]));
  S.log.push(logFromRow(row));
  });
  return { week: weekStatus_(c), myWeek: myWeek_(c) };
};

// ── мій тиждень: відмітки члена команди (клуб, МГ, КР) ──
const CK_KINDS = ['club', 'mg', 'kr'];
function myWeek_(c) {
  if (!c.roles.length && !isOffice_(c)) return null;
  const wk = weekKey_(new Date());
  const rows = loadLog_().filter((r) => r.week === wk);
  const ck = S.ck || {};
  // присутність на клубі: відмітка в звіті клубу або сам вніс звіт (капітан, адмін) і клуб був
  const att = rows.some((r) => r.type === 'club' && r.mode !== MODE.none && ((',' + (r.attendees || '') + ',').indexOf(',' + c.id + ',') >= 0 || r.authorId === c.id));
  // мала група й КР — це звіти, їх може бути кілька за тиждень: рахуємо
  const mine = (t) => dd_(rows.filter((r) => r.type === t && r.authorId === c.id && r.mode !== MODE.none));
  const mg = mine('mg'), kr = mine('kr');
  const krH = Math.round(kr.reduce((a, r) => a + (Number(r.hours) || 0), 0) * 10) / 10;
  const items = [
    { key: 'club', label: 'Був(ла) на клубі', on: !!ck.club || att, locked: att },
    { key: 'mg', label: 'Мала група', n: mg.length, on: mg.length > 0 },
    { key: 'kr', label: 'Контактна робота', n: kr.length, hours: krH, on: kr.length > 0 },
  ];
  if (!c.roles.length) items.splice(0, items.length, ...items.filter((x) => x.key !== 'club')); // офіс: без клубу
  return { key: wk, label: weekLabel_(wk), items: items, done: items.filter((x) => x.on).length };
}
API.checkin = function (c, d) {
  const kind = String(d.kind || '');
  if (kind !== 'club') bad_('Невідома відмітка.');
  if (!c.roles.length) deny_('Відмічати тиждень можна після підтвердження ролі.');
  const wk = weekKey_(new Date());
  const cur = Object.assign({ club: 0, mg: 0, kr: 0 }, S.ck || {});
  cur[kind] = d.on ? 1 : 0;
  S.run('INSERT INTO checkins (tg_id, week, club, mg, kr, updated) VALUES (?,?,?,?,?,?) ON CONFLICT (tg_id, week) DO UPDATE SET club = excluded.club, mg = excluded.mg, kr = excluded.kr, updated = excluded.updated',
    [c.id, wk, cur.club, cur.mg, cur.kr, nowIso()]);
  S.ck = cur;
  return { myWeek: myWeek_(c) };
};

// ── моя статистика й ачівки ──
// ачівки: [ключ, категорія, назва, опис, показник, поріг, секретна]
const ACH_CATS = [['start', 'Старт', '🌱'], ['streak', 'Постійність', '🔥'], ['club', 'Клуби', '🎉'], ['mg', 'Малі групи', '📖'], ['kr', 'Контактна робота', '🤝'],
  ['known', 'Знані по імені', '🙏'], ['team', 'Спільнота', '🤲'], ['me', 'Я в MyYL', '🪪'], ['special', 'Особливі', '✨']];
const ACH = [
  ['first', 'start', 'Перший крок', 'Перша відмітка чи звіт', 'acts', 1],
  ['month1', 'start', 'Перший місяць', '4 тижні з активністю', 'acts', 4],
  ['half', 'start', 'Півроку в служінні', '26 активних тижнів', 'acts', 26],
  ['year1', 'start', 'Рік служіння', '52 активні тижні', 'acts', 52],
  ['year2', 'start', 'Два роки вірності', '104 активні тижні', 'acts', 104],
  ['months6', 'start', 'Пів року поруч', 'Активність у 6 різних місяцях', 'months', 6],
  ['months12', 'start', 'Кожен місяць', 'Активність у 12 різних місяцях', 'months', 12],
  ['streak4', 'streak', 'Вогник', '4 тижні поспіль', 'streak', 4],
  ['streak12', 'streak', 'Марафонець', '12 тижнів поспіль', 'streak', 12],
  ['streak26', 'streak', 'Незгасний', '26 тижнів поспіль', 'streak', 26],
  ['streak52', 'streak', 'Рік без пропусків', '52 тижні поспіль', 'streak', 52],
  ['full', 'streak', 'Повний тиждень', 'Клуб, мала група і КР за тиждень', 'full', 1],
  ['full5', 'streak', 'П’ять повних', '5 повних тижнів', 'full', 5],
  ['full20', 'streak', 'Усе й завжди', '20 повних тижнів', 'full', 20],
  ['full50', 'streak', 'Пʼятдесят повних', '50 повних тижнів', 'full', 50],
  ['fullRun3', 'streak', 'Три в ряд', '3 повні тижні поспіль', 'fullRun', 3],
  ['fullRun8', 'streak', 'Повна сила', '8 повних тижнів поспіль', 'fullRun', 8],
  ['club1', 'club', 'Перший клуб', 'Відмітка про клуб', 'clubs', 1],
  ['club10', 'club', 'Свій на клубі', '10 клубів', 'clubs', 10],
  ['club30', 'club', 'Серце клубу', '30 клубів', 'clubs', 30],
  ['club75', 'club', 'Легенда клубу', '75 клубів', 'clubs', 75],
  ['club150', 'club', 'Клуб — це дім', '150 клубів', 'clubs', 150],
  ['clubRep1', 'club', 'Літописець', 'Перший внесений звіт за клуб', 'clubRep', 1],
  ['clubRep25', 'club', 'Хроніст', '25 звітів за клуб', 'clubRep', 25],
  ['clubRep100', 'club', 'Памʼять команди', '100 звітів за клуб', 'clubRep', 100],
  ['clubBig30', 'club', 'Повна зала', 'Клуб на 30+ підлітків', 'clubMax', 30],
  ['clubBig60', 'club', 'Аншлаг', 'Клуб на 60+ підлітків', 'clubMax', 60],
  ['clubTeams2', 'club', 'Міст між командами', 'Звіти за клуби двох і більше команд', 'clubTeams', 2],
  ['mg1', 'mg', 'Перша група', 'Перша мала група', 'mgs', 1],
  ['mg10', 'mg', 'Пастир групи', '10 малих груп', 'mgs', 10],
  ['mg40', 'mg', 'Наставник', '40 малих груп', 'mgs', 40],
  ['mg100', 'mg', 'Сотня зустрічей', '100 малих груп', 'mgs', 100],
  ['mg200', 'mg', 'Двісті зустрічей', '200 малих груп', 'mgs', 200],
  ['mgT50', 'mg', 'Повна кімната', '50 відвідувань підлітків на МГ', 'mgTeens', 50],
  ['mgT200', 'mg', 'Сотні сердець', '200 відвідувань підлітків на МГ', 'mgTeens', 200],
  ['mgT500', 'mg', 'Пʼятсот облич', '500 відвідувань підлітків на МГ', 'mgTeens', 500],
  ['mgNew1', 'mg', 'Нове обличчя', 'Перший новий підліток на МГ', 'mgNew', 1],
  ['mgNew10', 'mg', 'Відкриті двері', '10 нових підлітків на МГ', 'mgNew', 10],
  ['mgNew30', 'mg', 'Широке коло', '30 нових підлітків на МГ', 'mgNew', 30],
  ['mgTopic10', 'mg', 'Слово до серця', '10 малих груп із темою', 'mgTopic', 10],
  ['mgPray10', 'mg', 'Молитовна група', '10 малих груп із молитовною нотаткою', 'mgPray', 10],
  ['kr1', 'kr', 'Перша зустріч', 'Перша контактна робота', 'krN', 1],
  ['krN20', 'kr', 'Завжди поруч', '20 зустрічей КР', 'krN', 20],
  ['krN50', 'kr', 'На звʼязку', '50 зустрічей КР', 'krN', 50],
  ['krN100', 'kr', 'Сотня зустрічей поруч', '100 зустрічей КР', 'krN', 100],
  ['kr10', 'kr', 'Поруч', '10 годин КР', 'kr', 10],
  ['kr50', 'kr', 'Друг на кожен день', '50 годин КР', 'kr', 50],
  ['kr150', 'kr', 'Життя поруч', '150 годин КР', 'kr', 150],
  ['kr300', 'kr', 'Триста годин дружби', '300 годин КР', 'kr', 300],
  ['krLong', 'kr', 'Довга розмова', 'Одна КР на 3+ години', 'krMax', 3],
  ['krWeek10', 'kr', 'Тиждень поруч', '10 годин КР за один тиждень', 'krWeekMax', 10],
  ['known1', 'known', 'Перше імʼя', 'Перший підліток у «Знаних»', 'known', 1],
  ['known10', 'known', 'Знаю по імені', '10 підлітків', 'known', 10],
  ['known30', 'known', 'Молитовник', '30 підлітків', 'known', 30],
  ['known75', 'known', 'Великі ворота', '75 підлітків', 'known', 75],
  ['known150', 'known', 'Ціле покоління', '150 підлітків', 'known', 150],
  ['friends10', 'known', 'Справжні друзі', '10 підлітків у стадії «Дружимо» і далі', 'friends', 10],
  ['friends30', 'known', 'Коло довіри', '30 підлітків у стадії «Дружимо» і далі', 'friends', 30],
  ['grow5', 'known', 'Зростаємо разом', '5 підлітків зростають у вірі', 'grow', 5],
  ['grow15', 'known', 'Сад, що росте', '15 підлітків зростають у вірі', 'grow', 15],
  ['own1', 'known', 'Йдуть самі', 'Підліток у стадії «Йдуть самі»', 'own', 1],
  ['own5', 'known', 'Учні, що ведуть', '5 підлітків «Йдуть самі»', 'own', 5],
  ['knownPray10', 'known', 'Молюсь конкретно', '10 знаних із молитовною нотаткою', 'knownNote', 10],
  ['knownBday10', 'known', 'Памʼятаю дні народження', '10 знаних із днем народження', 'knownBday', 10],
  ['rsvp1', 'team', 'Йду!', 'Перша подія з календаря', 'rsvp', 1],
  ['rsvp10', 'team', 'Завжди разом', '10 подій', 'rsvp', 10],
  ['rsvp30', 'team', 'Душа спільноти', '30 подій', 'rsvp', 30],
  ['task1', 'team', 'Зроблено', 'Перша виконана задача', 'tasks', 1],
  ['task10', 'team', 'Надійний', '10 виконаних задач', 'tasks', 10],
  ['task50', 'team', 'Опора команди', '50 виконаних задач', 'tasks', 50],
  ['poll1', 'team', 'Мій голос', 'Перше опитування', 'polls', 1],
  ['poll15', 'team', 'Голос команди', '15 опитувань', 'polls', 15],
  ['prof3', 'me', 'Привіт, це я', '3 поля профілю заповнено', 'profile', 3],
  ['prof7', 'me', 'Відкрита книга', 'Увесь профіль заповнено', 'profile', 7],
  ['days30', 'me', 'Свій', '30 днів у MyYL', 'days', 30],
  ['days365', 'me', 'Рік у MyYL', '365 днів у MyYL', 'days', 365],
  ['bug1', 'me', 'Пильне око', 'Перше повідомлення про помилку', 'bugs', 1],
  ['bug5', 'me', 'Тестувальник', '5 повідомлень про помилки', 'bugs', 5],
  ['fast20', 'special', 'Блискавка', '20 звітів, внесених у день зустрічі', 'fast', 20, 1],
  ['weekend10', 'special', 'Без вихідних', '10 зустрічей МГ чи КР у вихідні', 'weekend', 10, 1],
  ['summer8', 'special', 'Літо в служінні', '8 активних тижнів за одне літо', 'summer', 8, 1],
  ['winter8', 'special', 'Зимовий вогонь', '8 активних тижнів за одну зиму', 'winter', 8, 1],
  ['newyear', 'special', 'Новорічне служіння', 'Активність у тиждень Нового року', 'newyear', 1, 1],
  ['comeback', 'special', 'Повернення', 'Повернувся до служіння після перерви в місяць і більше', 'comeback', 1, 1],
];
// додаткові показники для ачівок
function achExtra_(m, W, weeks, reps) {
  const cl = m.club || {}, pr = m.person || {};
  const mg = reps.filter((r) => r.type === 'mg'), kr = reps.filter((r) => r.type === 'kr');
  const txt = (x) => String(x || '').trim() !== '';
  const dow = (d) => { if (!d) return -1; const p = String(d).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); };
  let fullRun = 0, run = 0, prev = '', comeback = 0;
  const isFull = (x) => x.club && (x.mg || x.mgN) && (x.kr || x.krH);
  weeks.forEach((w) => {
    if (prev && weekShift_(prev, 5) <= w) comeback = 1;
    run = isFull(W[w]) ? (prev && weekShift_(prev, 1) === w && isFull(W[prev]) ? run + 1 : 1) : 0;
    fullRun = Math.max(fullRun, run); prev = w;
  });
  const summer = {}, winter = {}, months = {};
  let newyear = 0;
  weeks.forEach((w) => {
    const y = Number(w.slice(0, 4)), mo = Number(w.slice(5, 7)), d = Number(w.slice(8, 10));
    months[w.slice(0, 7)] = 1;
    if (mo >= 6 && mo <= 8) summer[y] = (summer[y] || 0) + 1;
    if (mo === 12 || mo <= 2) { const k = mo === 12 ? y + 1 : y; winter[k] = (winter[k] || 0) + 1; }
    if ((mo === 12 && d >= 26) || (mo === 1 && d === 1)) newyear = 1;
  });
  const mx = (o) => Object.keys(o).reduce((a, k) => Math.max(a, o[k]), 0);
  const regDays = pr.registered ? Math.floor((Date.now() - new Date(pr.registered).getTime()) / 864e5) : 0;
  return {
    clubRep: Number(cl.n) || 0, clubMax: Number(cl.mx) || 0, clubTeams: Number(cl.teams) || 0,
    mgNew: mg.reduce((a, r) => a + (Number(r.new_t) || 0), 0), mgTopic: mg.filter((r) => txt(r.topic)).length, mgPray: mg.filter((r) => txt(r.note)).length,
    krMax: kr.reduce((a, r) => Math.max(a, Number(r.hours) || 0), 0), krWeekMax: weeks.reduce((a, w) => Math.max(a, W[w].krH || 0), 0),
    knownNote: m.known.filter((k) => txt(k.note)).length, knownBday: m.known.filter((k) => txt(k.bday)).length,
    rsvp: m.rsvp || 0, tasks: m.tasks || 0, polls: m.polls || 0, bugs: m.bugs || 0,
    profile: ['phone', 'email', 'bday', 'repent', 'baptism', 'ig', 'lpyl'].filter((k) => txt(pr[k])).length, days: isNaN(regDays) ? 0 : regDays,
    fast: reps.filter((r) => r.created && r.date && String(r.created).slice(0, 10) === String(r.date).slice(0, 10)).length,
    weekend: reps.filter((r) => { const x = dow(r.date); return x === 0 || x === 6; }).length,
    summer: mx(summer), winter: mx(winter), months: Object.keys(months).length, newyear: newyear, comeback: comeback, fullRun: fullRun,
  };
}
function weekShift_(wk, n) { const d = new Date(wk + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7 * n); return d.toISOString().slice(0, 10); }
API.myStats = function (c, d) {
  const m = S.mine || { rep: [], att: [], ck: [], known: [] };
  m.known = m.known || [];
  const period = ['month', 'quarter', 'year', 'all'].indexOf(d.period) >= 0 ? d.period : 'all';
  const nowWk = weekKey_(new Date());
  const from = period === 'all' ? '' : weekShift_(nowWk, -({ month: 4, quarter: 13, year: 52 }[period]) + 1);
  const inP = (wk) => !from || wk >= from;
  const reps = dd_(m.rep.map((r) => Object.assign({}, r))).filter((r) => r.mode !== MODE.none);
  // тижні з подіями: звіти, клуби з відміткою, особисті відмітки
  const W = {};
  const mark = (wk, k, v) => { if (!wk) return; W[wk] = W[wk] || { club: 0, mg: 0, kr: 0, krH: 0, mgN: 0 }; W[wk][k] = Math.max(W[wk][k], v === undefined ? 1 : v); };
  m.att.forEach((wk) => mark(wk, 'club'));
  m.ck.forEach((r) => { if (r.club) mark(r.week, 'club'); if (r.mg) mark(r.week, 'mg'); if (r.kr) mark(r.week, 'kr'); });
  let mgTeens = 0, krN = 0;
  reps.forEach((r) => { mark(r.week, r.type); if (r.type === 'kr') { W[r.week].krH += Number(r.hours) || 0; krN++; } if (r.type === 'mg') { W[r.week].mgN += 1; mgTeens += Number(r.count) || 0; } });
  krN += m.ck.filter((r) => r.kr).length;
  const weeks = Object.keys(W).sort();
  const sum = (f, only) => weeks.filter((w) => !only || inP(w)).reduce((a, w) => a + f(W[w]), 0);
  const totals = (only) => ({
    clubs: sum((x) => x.club, only),
    mgs: sum((x) => Math.max(x.mg, x.mgN), only),
    kr: Math.round(sum((x) => x.krH, only) * 10) / 10,
    krWeeks: sum((x) => x.kr, only),
    active: sum(() => 1, only),
    full: sum((x) => (x.club && (x.mg || x.mgN) && (x.kr || x.krH) ? 1 : 0), only),
  });
  // серія: тижні поспіль з активністю (поточний тиждень ще може бути порожнім)
  let streak = 0, wk = W[nowWk] ? nowWk : weekShift_(nowWk, -1);
  while (W[wk]) { streak++; wk = weekShift_(wk, -1); }
  let best = 0, run = 0, prev = '';
  weeks.forEach((w) => { run = prev && weekShift_(prev, 1) === w ? run + 1 : 1; best = Math.max(best, run); prev = w; });
  const known = m.known.length, own = m.known.filter((k) => k.stage === 'own').length;
  const grow = m.known.filter((k) => k.stage === 'grow' || k.stage === 'own').length, friends = m.known.filter((k) => k.stage && k.stage !== 'meet').length;
  const all = totals(false), cur = totals(true);
  const val = Object.assign({ acts: all.active, full: all.full, streak: best, clubs: all.clubs, mgs: all.mgs, kr: all.kr, known: known, own: own, grow: grow, friends: friends, mgTeens: mgTeens, krN: krN },
    achExtra_(m, W, weeks, reps));
  const ach = ACH.map((a) => {
    const v = val[a[4]] || 0, done = v >= a[5], secret = !!a[6] && !done;
    return { key: a[0], cat: a[1], title: secret ? 'Секретна ачівка' : a[2], desc: secret ? 'Відкриється сама, коли настане момент' : a[3], have: secret ? 0 : Math.min(v, a[5]), need: a[5], done: done, secret: secret };
  });
  // останні 12 тижнів для «доріжки»
  const trail = [];
  for (let i = 11; i >= 0; i--) { const w = weekShift_(nowWk, -i); const x = W[w] || {}; trail.push({ week: w, club: !!x.club, mg: !!(x.mg || x.mgN), kr: !!(x.kr || x.krH) }); }
  return { cats: ACH_CATS.map((x) => ({ key: x[0], title: x[1], ic: x[2] })), period: period, kpi: { clubs: cur.clubs, mgs: cur.mgs, kr: cur.kr, known: known, active: cur.active, streak: streak, best: best }, ach: ach, trail: trail };
};

// ── знані по імені ──
const canKnown_ = (c, teamId) => canTeam_(c, teamId, 'see.known');

const STAGES = [['meet', 'Хочу познайомитись'], ['friends', 'Дружимо'], ['grow', 'Допомагаю зростати в вірі'], ['own', 'Йдуть самі']];
const stageOk_ = (v) => STAGES.some((x) => x[0] === v);
const stageSum_ = (teamIds, stage) => teamIds.reduce((a, id) => a + (Number(((S.knownStages || {})[id] || {})[stage]) || 0), 0);

// бачать: команда (Помічник+) і вищі рівні; додають і змінюють — лише учасники цієї команди; «Без команди» — особистий список автора
const canKnownEdit_ = (c, teamId) => teamRoles_(c, teamId, 'rep.known').length > 0;
const canNoTeam_ = (c) => (c.roles.length > 0 && !isSugarOnly_(c)) || isOffice_(c);
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
  // вищі одиниці з вибору — показуємо їхній «офіс» (ролі рівня регіону / ерії / країни)
  const sel = Array.isArray(d.units) && d.units.length ? pickScope_(c, d.units).scope : null;
  const ups = !sel ? [] : sel.level === 'multi' ? sel.members.filter((m) => m.level !== 'team') : sel.level !== 'team' ? [sel] : [];
  if (!teams.length && !ups.length) deny_();
  const st = loadStruct_();
  const OFFICE_NAME = { nat: 'Національний офіс', region: 'Офіс регіону ', area: 'Офіс ерії ' };
  const ORDER = { nat: '0', region: '1', area: '2' };
  const set = {};
  teams.forEach((id) => { set[id] = true; });
  const byPerson = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && set[r.unitId]).forEach((r) => {
    const p = byPerson[r.tgId + '|' + r.unitId] = byPerson[r.tgId + '|' + r.unitId] || { tgId: r.tgId, name: r.name, roles: [], rank: 99, teamId: r.unitId, team: (st.team[r.unitId] || {}).name || '' };
    p.roles.push({ id: r.id, label: r.label, canRemove: canDecide_(c, r) });
    p.rank = Math.min(p.rank, r.rank);
  });
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level !== 'team' && r.key !== 'SUPER' && ups.some((u) => within_(u, r) && (r.level !== 'nat' || u.level === 'nat'))).forEach((r) => {
    const gk = 'u:' + unitKey_(r.level, r.unitId);
    const p = byPerson[r.tgId + '|' + gk] = byPerson[r.tgId + '|' + gk] || { tgId: r.tgId, name: r.name, roles: [], rank: 99, teamId: gk, office: true,
      team: OFFICE_NAME[r.level] + (r.level === 'nat' ? '' : unitName_(r.level, r.unitId)), sortKey: ORDER[r.level] + unitName_(r.level, r.unitId) };
    p.roles.push({ id: r.id, label: r.label, canRemove: r.tgId !== c.id && canDecide_(c, r) });
    p.rank = Math.min(p.rank, r.rank);
  });
  return Object.keys(byPerson).map((k) => {
    const p = byPerson[k];
    const person = getPerson_(p.tgId);
    if (person) { p.name = person.name || p.name; p.username = person.username; p.profile = profileOf_(person); }
    p.registered = isReal_(p.tgId);
    p.canDrop = p.roles.every((x) => { const r = loadRoles_().filter((y) => y.id === x.id)[0]; return r && canDrop_(c, r); });
    // усі ролі людини (у будь-яких командах і на будь-яких рівнях) — щоб бачити, хто де служить
    p.all = loadRoles_().filter((r) => r.tgId === p.tgId && r.status === ST.ACTIVE && r.key !== 'SUPER').sort((a, b) => a.rank - b.rank)
      .map((r) => ({ id: r.id, label: r.label, unit: levelLabel_(r.level, r.unitId), titled: !!(roleDef_(r.key) || {}).titled, title: r.title || '', canRemove: r.tgId !== c.id && canDecide_(c, r) }));
    return p;
  }).sort((a, b) => (a.office ? a.sortKey : '9' + a.team).localeCompare(b.office ? b.sortKey : '9' + b.team) || a.rank - b.rank || a.name.localeCompare(b.name));
};

// ── фінанси ──
// вносять лише Капітан і Адмін саме цієї команди; вищі рівні — тільки дивляться
const canFinEdit_ = (c, teamId) => teamRoles_(c, teamId, 'rep.fin').length > 0 || c.roles.some((r) => FIN_UPPER.indexOf(r.key) >= 0 && covers_(r, 'team', teamId) && okR_(r, 'rep.fin'));

API.financeGet = function (c, d) {
  if (!isSingleTeam_(d)) return financeOverview_(c, d);
  const teamId = Array.isArray(d.units) && d.units.length ? String(d.units[0]).slice(2) : str_(d.teamId);
  if (!canTeam_(c, teamId, 'see.fin')) deny_();
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
  const teams = pickTeams_(c, d, (cc, id) => canTeam_(cc, id, 'see.fin'));
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

// ── каса команди: окремі доходи й витрати, які одразу потрапляють у місячний звіт ──
const FIN_SRC = { office: 'Дав офіс', church: 'Дала церква', team: 'Зібрала команда' };
function finApply_(c, teamId, month, delta) {
  const rows = (S.finance[teamId] = S.finance[teamId] || []);
  let row = rows.filter((r) => r.month === month)[0];
  if (!row) {
    const before = rows.filter((r) => r.month < month).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
    row = { team_id: teamId, month: month, prev: before ? Number(before.balance) || 0 : 0, office: 0, church: 0, team: 0, spent: 0, balance: 0 };
    rows.push(row);
  }
  ['prev', 'office', 'church', 'team', 'spent'].forEach((k) => { row[k] = Math.round(((Number(row[k]) || 0) + (delta[k] || 0)) * 100) / 100; });
  // перерахунок цього й наступних місяців: залишок переноситься далі
  const asc = rows.slice().sort((a, b) => (a.month < b.month ? -1 : 1));
  let prevBal = null;
  asc.forEach((r) => {
    if (r.month < month) { prevBal = Number(r.balance) || 0; return; }
    if (r.month > month && prevBal != null) r.prev = prevBal;
    r.balance = Math.round(((Number(r.prev) || 0) + (Number(r.office) || 0) + (Number(r.church) || 0) + (Number(r.team) || 0) - (Number(r.spent) || 0)) * 100) / 100;
    prevBal = r.balance;
    S.run('INSERT INTO finance (team_id, month, prev, office, church, team, spent, balance, author, updated) VALUES (?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (team_id, month) DO UPDATE SET prev = excluded.prev, office = excluded.office, church = excluded.church, team = excluded.team, spent = excluded.spent, balance = excluded.balance, author = excluded.author, updated = excluded.updated',
    [teamId, r.month, r.prev || 0, r.office || 0, r.church || 0, r.team || 0, r.spent || 0, r.balance, c.name, nowIso()]);
  });
}
const finDelta_ = (t, sign) => (t.kind === 'adj' ? { prev: sign * t.amount } : t.kind === 'out' ? { spent: sign * t.amount } : { [FIN_SRC[t.src] ? t.src : 'team']: sign * t.amount });
API.finTx = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canFinEdit_(c, teamId)) deny_('Касу команди ведуть Капітан і Адмін команди.');
  const rows = (S.finance[teamId] || []).map(finOut_).sort((a, b) => (a.month < b.month ? 1 : -1));
  const month = kyivDay(new Date()).slice(0, 7);
  const cur = rows.filter((r) => r.month === month)[0];
  return {
    teamId: teamId,
    balance: rows.length ? rows[0].balance : 0,
    month: { label: month, inc: cur ? cur.office + cur.church + cur.team : 0, spent: cur ? cur.spent : 0 },
    items: (S.finTx || []).map((t) => ({ id: t.id, date: t.date, kind: t.kind, src: t.src, srcLabel: t.kind === 'in' ? FIN_SRC[t.src] || '' : '', amount: t.amount, note: t.note, author: t.author })),
  };
};
API.finTxAdd = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canFinEdit_(c, teamId)) deny_('Касу команди ведуть Капітан і Адмін команди.');
  if (d.kind === 'adj') return finAdjust_(c, teamId, d);
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!isFinite(amount) || amount <= 0) bad_('Вкажи суму більше нуля.');
  if (amount > 10000000) bad_('Завелика сума.');
  const kind = d.kind === 'out' ? 'out' : 'in';
  const today = kyivDay(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && d.date <= today ? d.date : today;
  const t = { id: uid_(), teamId: teamId, date: date, kind: kind, src: kind === 'in' ? (FIN_SRC[d.src] ? d.src : 'team') : '', amount: amount, note: clip_(d.note).slice(0, 300), authorId: c.id, author: c.name, created: nowIso() };
  if (kind === 'out' && !t.note) bad_('Напиши, на що витратили.');
  S.run('INSERT INTO fin_tx (id, team_id, date, kind, src, amount, note, author_id, author, created) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [t.id, teamId, t.date, t.kind, t.src, t.amount, t.note, t.authorId, t.author, t.created]);
  finApply_(c, teamId, date.slice(0, 7), finDelta_(t, 1));
  S.finTx = [t].concat(S.finTx || []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.created < b.created ? 1 : -1)).slice(0, 40);
  return API.finTx(c, d);
};
// «Редагувати баланс»: звести баланс у застосунку з реальною сумою в касі (різниця йде в «Попередній залишок» поточного місяця)
function finAdjust_(c, teamId, d) {
  const target = Math.round(Number(String(d.balance).replace(',', '.')) * 100) / 100;
  if (!isFinite(target) || d.balance === '' || d.balance == null) bad_('Вкажи, скільки зараз реально в касі.');
  if (Math.abs(target) > 10000000) bad_('Завелика сума.');
  const rows = (S.finance[teamId] || []).slice().sort((a, b) => (a.month < b.month ? 1 : -1));
  const cur = rows.length ? Number(rows[0].balance) || 0 : 0;
  const delta = Math.round((target - cur) * 100) / 100;
  if (!delta) bad_('Баланс уже такий.');
  const today = kyivDay(new Date());
  const t = { id: uid_(), teamId: teamId, date: today, kind: 'adj', src: '', amount: delta, note: ('Звірка: було ' + cur + ' ₴, стало ' + target + ' ₴' + (clip_(d.note) ? ' · ' + clip_(d.note) : '')).slice(0, 300), authorId: c.id, author: c.name, created: nowIso() };
  S.run('INSERT INTO fin_tx (id, team_id, date, kind, src, amount, note, author_id, author, created) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [t.id, teamId, t.date, t.kind, t.src, t.amount, t.note, t.authorId, t.author, t.created]);
  finApply_(c, teamId, (rows[0] && rows[0].month > today.slice(0, 7) ? rows[0].month : today.slice(0, 7)), finDelta_(t, 1));
  S.finTx = [t].concat(S.finTx || []).slice(0, 40);
  return API.finTx(c, d);
}
API.finTxDelete = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canFinEdit_(c, teamId)) deny_();
  const t = (S.finTx || []).filter((x) => x.id === str_(d.id))[0];
  if (!t) bad_('Запис не знайдено — онови сторінку.');
  S.run('DELETE FROM fin_tx WHERE id = ?', [t.id]);
  finApply_(c, teamId, t.date.slice(0, 7), finDelta_(t, -1));
  S.finTx = S.finTx.filter((x) => x.id !== t.id);
  return API.finTx(c, d);
};

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
    return (c.active || c.roles).some((r) => okR_(r, 'part.events') && aud.some((u) => (!roles.length || roles.indexOf(r.key) >= 0) && (within_(u, r) || (!roles.length && covers_(r, u.level, u.unitId)))));
  }
  return (c.active || c.roles).some((r) => okR_(r, 'part.events') && (covers_(r, ev.level, ev.unitId) || ancestors_(r.level, r.unitId).some((a) => a.level === ev.level && a.unitId === ev.unitId)));
}
function canManageEvent_(c, ev) {
  if (ev.authorId === c.id) return true;
  return c.roles.some((r) => r.rank <= RANK.APPROVE && covers_(r, ev.level, ev.unitId));
}

API.events = function (c) {
  const today = kyivDay(new Date());
  const all = [];
  loadEvents_().forEach((e) => {
    if (!e.rep) { all.push(e); return; }
    const len = e.end ? dayDiff_(e.date, e.end) : 0;
    repeatDates_(e, addDaysKey_(today, -len), addDaysKey_(today, 366), 12).forEach((d) => all.push(occurrence_(e, d)));
  });
  return all.filter((e) => (e.end || e.date) >= today && canSeeEvent_(c, e)).map((e) => {
    const people = S.rsvp.filter((r) => r.eventId === e.id);
    const manage = canManageEvent_(c, e);
    return Object.assign({}, e, {
      levelLabel: levelLabel_(e.level, e.unitId), going: people.length,
      rolesLabel: (e.roles || []).map((k) => (roleDef_(k) || {}).label).filter(Boolean).join(', '),
      audLabel: (e.aud || []).map(unitLabel_).join(', '),
      isGoing: people.some((r) => r.tgId === c.id),
      manage: manage, repLabel: REPEAT[e.rep] || '', skip: undefined,
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
  const rep = REPEAT[d.rep] ? d.rep : '';
  const until = rep && /^\d{4}-\d{2}-\d{2}$/.test(d.until || '') ? d.until : '';
  if (until && until < d.date) bad_('«Повторювати до» раніше за дату початку.');
  if (rep && end && dayDiff_(d.date, end) >= (rep === 'month' ? 28 : rep === '2week' ? 14 : 7)) bad_('Подія довша за проміжок між повторами.');
  if (d.id) {
    const ex = loadEvents_().filter((x) => x.id === str_(d.id).split('@')[0])[0];
    if (!ex) bad_('Подію не знайдено.');
    if (!canManageEvent_(c, ex)) deny_('Редагувати подію може автор або керівник цього рівня.');
    Object.assign(ex, { level: u.level, unitId: u.unitId, title: clip_(d.title), date: d.date, end: end, time: clip_(d.time), place: clip_(d.place), desc: clip_(d.desc), roles: roles, aud: audList, rep: rep, until: until });
    S.run('UPDATE events SET level = ?, unit_id = ?, title = ?, date = ?, end_date = ?, time = ?, place = ?, descr = ?, roles = ?, aud = ?, rep = ?, rep_until = ? WHERE id = ?',
      [ex.level, ex.unitId, ex.title, ex.date, ex.end || null, ex.time, ex.place, ex.desc, rolesStr, audStr, rep, until, ex.id]);
    return { id: ex.id };
  }
  const e = { id: uid_(), level: u.level, unitId: u.unitId, title: clip_(d.title), date: d.date, end: end, time: clip_(d.time), place: clip_(d.place), desc: clip_(d.desc), authorId: c.id, author: c.name, roles: roles, aud: audList, rep: rep, until: until, skip: [] };
  S.run('INSERT INTO events (id, level, unit_id, title, date, end_date, time, place, descr, author_id, author, created, roles, aud, rep, rep_until) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [e.id, e.level, e.unitId, e.title, e.date, e.end || null, e.time, e.place, e.desc, e.authorId, e.author, nowIso(), rolesStr, audStr, rep, until]);
  S.events.push(e);
  if (!rep) rsvpSet_(c, e.id, true);
  return { id: e.id };
};

API.eventDelete = function (c, d) {
  const id = str_(d.id);
  const e = loadEvents_().filter((x) => x.id === id.split('@')[0])[0];
  if (!e) bad_('Подію не знайдено.');
  if (!canManageEvent_(c, e)) deny_();
  // лише одна дата повторюваної події
  if (d.only && id.indexOf('@') > 0) {
    const day = id.split('@')[1];
    if (e.skip.indexOf(day) < 0) e.skip.push(day);
    S.run('UPDATE events SET rep_skip = ? WHERE id = ?', [e.skip.join(','), e.id]);
    S.run('DELETE FROM rsvp WHERE event_id = ?', [id]);
    return { ok: true };
  }
  S.run('DELETE FROM events WHERE id = ?', [e.id]);
  S.run("DELETE FROM rsvp WHERE event_id = ? OR event_id LIKE ?", [e.id, e.id + '@%']);
  return { ok: true };
};

API.rsvp = function (c, d) {
  const e = eventById_(d.id);
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
      teams: st.teams.filter((t) => t.areaId === a.id).map((t) => ({ id: t.id, name: t.name, state: t.state, dir: t.dir, people: Object.keys(people[t.id] || {}).length }))
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

// Видалити команду (напр., випадковий дубль). Порожню — одразу; з даними — лише перенісши все в іншу команду.
API.teamDelete = function (c, d) {
  const st = loadStruct_();
  const t = st.team[str_(d.id)];
  if (!t) bad_('Команду не знайдено.');
  if (!canEditTeams_(c, t.areaId)) deny_('Ти не можеш видаляти цю команду.');
  const roles = loadRoles_().filter((r) => r.level === 'team' && r.unitId === t.id && (r.status === ST.ACTIVE || r.status === ST.PENDING));
  const u = Object.assign({ people: uniq_(roles.map((r) => r.tgId)).length }, S.usage || {});
  const empty = !u.people && !u.reports && !u.known && !u.finance;
  const targets = st.teams.filter((x) => x.id !== t.id && x.state !== 'closed' && x.areaId === t.areaId && canEditTeams_(c, x.areaId))
    .map((x) => ({ id: x.id, name: x.name, area: (st.area[x.areaId] || {}).name || '', same: x.areaId === t.areaId }))
    .sort((a, b) => (b.same - a.same) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
  if (d.dry) return { usage: u, empty: empty, targets: targets };
  const into = str_(d.mergeInto);
  if (!empty && !into && !d.drop) bad_('У команді є дані. Обери, куди їх перенести, або видали разом з даними.');
  if (into) {
    const tt = st.team[into];
    if (!tt || into === t.id || tt.areaId !== t.areaId) bad_('Переносити можна лише в іншу команду цієї ж ерії.');
    if (!canEditTeams_(c, tt.areaId)) deny_('Ти не можеш переносити в цю команду.');
    const reg = st.teamRegion(into);
    S.run('UPDATE roles SET unit_id = ? WHERE level = ? AND unit_id = ?', [into, 'team', t.id], true);
    // якщо людина вже мала таку саму роль у цільовій команді — дубль знімаємо
    S.run("UPDATE roles SET status = ? WHERE level = 'team' AND unit_id = ? AND status IN (?, ?) AND rowid NOT IN (SELECT MIN(rowid) FROM roles WHERE level = 'team' AND unit_id = ? AND status IN (?, ?) GROUP BY tg_id, role_key)",
      [ST.REMOVED, into, ST.ACTIVE, ST.PENDING, into, ST.ACTIVE, ST.PENDING], true);
    S.run('UPDATE reports SET team_id = ?, area_id = ?, region_id = ? WHERE team_id = ?', [into, tt.areaId, reg, t.id]);
    S.run('UPDATE known SET team_id = ?, updated = ? WHERE team_id = ?', [into, nowIso(), t.id]);
    S.run('UPDATE OR IGNORE finance SET team_id = ?, updated = ? WHERE team_id = ?', [into, nowIso(), t.id]);
    S.run('DELETE FROM finance WHERE team_id = ?', [t.id]);
    S.run("UPDATE events SET unit_id = ? WHERE level = 'team' AND unit_id = ?", [into, t.id]);
    S.run('UPDATE events SET aud = REPLACE(aud, ?, ?) WHERE aud LIKE ?', [',t:' + t.id + ',', ',t:' + into + ',', '%,t:' + t.id + ',%']);
    refreshKnownCount_(into);
  } else {
    // без перенесення: ролі знімаються, дані команди видаляються
    S.run("UPDATE roles SET status = ? WHERE level = 'team' AND unit_id = ?", [ST.REMOVED, t.id], true);
    S.run('DELETE FROM reports WHERE team_id = ?', [t.id]);
    S.run('DELETE FROM known WHERE team_id = ?', [t.id]);
    S.run('DELETE FROM finance WHERE team_id = ?', [t.id]);
    S.run('DELETE FROM rsvp WHERE event_id IN (SELECT id FROM events WHERE level = ? AND unit_id = ?)', ['team', t.id]);
    S.run("DELETE FROM events WHERE level = 'team' AND unit_id = ?", [t.id]);
  }
  S.run('DELETE FROM teams WHERE id = ?', [t.id], true);
  return { ok: true, merged: !!into };
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
    if (d.dir != null && (d.dir === '' || DIRS.indexOf(d.dir) >= 0)) { S.run('UPDATE teams SET dir = ? WHERE id = ?', [d.dir, t.id], true); t.dir = d.dir; }
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
  const id = createTeam_(areaId, name, true);
  const dir = DIRS.indexOf(d.dir) >= 0 ? d.dir : 'YoungLife';
  S.run('UPDATE teams SET dir = ? WHERE id = ?', [dir, id], true);
  st.team[id].dir = dir;
  return { id: id };
};

// ── Моя команда в MyYL: дерево людей у межах відповідальності ──
API.myylTree = function (c0) {
  const c = P_(c0, 'see.myyl');
  const st = loadStruct_();
  const scopes = allowedScopes_(c);
  if (!scopes.length) deny_();
  const units = {};
  scopes.forEach((s) => { units[s.key] = { key: s.key, level: s.level, id: s.unitId, name: s.name, sub: s.sub, dir: s.level === 'team' ? (st.team[s.unitId] || {}).dir || '' : '', children: [], people: [], parent: '' }; });
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
  // «власник» — службова роль, у складі не показуємо
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.key !== 'SUPER').forEach((r) => {
    const k = r.level === 'nat' ? 'nat' : (r.level === 'region' ? 'r:' : r.level === 'area' ? 'a:' : 't:') + r.unitId;
    if (!units[k]) return;
    const m = byUnit[k] = byUnit[k] || {};
    const p = m[r.tgId] = m[r.tgId] || { tgId: r.tgId, name: r.name, roles: [], rank: 99, ids: [], drop: true };
    p.roles.push({ label: r.label, rank: r.rank });
    p.rank = Math.min(p.rank, r.rank);
    p.ids.push(r.id); if (!canDrop_(c0, r)) p.drop = false;
  });
  Object.keys(byUnit).forEach((k) => {
    units[k].people = Object.keys(byUnit[k]).map((id) => {
      const p = byUnit[k][id];
      const person = getPerson_(id) || {};
      return { tgId: id, name: person.name || p.name, username: person.username || '', ig: person.ig || '', title: person.title || '', rank: p.rank,
        roles: p.roles.sort((a, b) => a.rank - b.rank).map((x) => x.label), registered: isReal_(id), dropIds: p.drop ? p.ids : null };
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
  club: { label: 'Клуби', cols: [['n', 'Клубів'], ['v', 'Підлітків (усього)'], ['avg', 'Підлітків середньо'], ['new', 'Нових'], ['l', 'Лідерів (усього)'], ['lavg', 'Лідерів середньо'], ['par', 'Батьків'], ['rep', 'Звітували, тижнів']] },
  mg: { label: 'Малі групи', cols: [['n', 'Зустрічей'], ['v', 'Підлітків (усього)'], ['avg', 'Підлітків середньо'], ['new', 'Нових'], ['l', 'Лідерів (усього)'], ['p', 'Лідерів вносили']] },
  kr: { label: 'Контактна робота', cols: [['h', 'Годин'], ['p', 'Людей вносили'], ['none', 'Відміток «не було»']] },
  known: { label: 'Знані по імені', cols: [['total', 'Знаних зараз'], ['meet', 'Хочу познайомитись'], ['friends', 'Дружимо'], ['grow', 'Зростають у вірі'], ['own', 'Йдуть самі'], ['new', 'Нових за період']] },
  finance: { label: 'Фінанси', cols: [['inc', 'Надійшло, ₴'], ['out', 'Витрачено, ₴'], ['net', 'Різниця, ₴'], ['teams', 'Команд здали']] },
};
const reportScopes_ = (c) => (isSuper_(c) ? allowedScopes_(c, { office: true }) : allowedScopes_(c, { office: true }).filter((s) => s.depth <= 1));
function reportItems_(c) {
  if (officeOnly_(c)) c = officeCtx_(c);
  // лідери й нижче звіти не готують
  if (!c.roles.some((r) => r.level !== 'team' || r.rank < RANK.MG)) return [];
  const ok = {};
  reportScopes_(c).forEach((s) => statCats_(c, s).forEach((x) => { if (REPORT_ITEMS[x.key]) ok[x.key] = true; }));
  const out = Object.keys(REPORT_ITEMS).filter((k) => ok[k]);
  if (ok.known && !c.officeView) out.push('names'); // підлітки по іменах
  return out;
}
// список підлітків (знаних) по іменах: команда, стадія, контакти
const NAME_COLS = [['name', 'Імʼя'], ['team', 'Команда'], ['stage', 'Стадія'], ['leader', 'Хто веде'], ['school', 'Школа'], ['grade', 'Клас'], ['bday', 'День народження'], ['phone', 'Телефон'], ['ig', 'Instagram'], ['added', 'Додано']];
function namesOut_(rows) {
  const st = loadStruct_();
  const stg = {}; STAGES.forEach((x, i) => { stg[x[0]] = [i, x[1]]; });
  const day = (k) => { const p = String(k || '').slice(0, 10).split('-'); return p.length === 3 ? Number(p[2]) + '.' + p[1] + '.' + p[0] : ''; };
  return rows.filter((r) => r.active).map((r) => {
    const o = knownOut_(r);
    return { name: o.name, team: r.team_id ? (st.team[r.team_id] || {}).name || '' : NO_TEAM, stage: stg[o.stage][1], _s: stg[o.stage][0], leader: o.leader, school: o.school, grade: o.grade, bday: day(o.bday), phone: o.phone, ig: o.ig, added: day(r.added) };
  }).sort((a, b) => a.team.localeCompare(b.team) || a._s - b._s || a.name.localeCompare(b.name)).map((x) => { delete x._s; return x; });
}
function namesHtml_(names) {
  const e = esc_;
  return '<h2>Підлітки по іменах · ' + names.length + '</h2><div class="w"><table class="nm"><thead><tr><th>№</th>' + NAME_COLS.map((c) => '<th>' + e(c[1]) + '</th>').join('') + '</tr></thead><tbody>' +
    names.map((r, i) => '<tr><td>' + (i + 1) + '</td>' + NAME_COLS.map((c) => '<td>' + e(r[c[0]] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
// знані: витягти поточний список файлом у Telegram
API.knownExport = function (c, d) {
  let rows, what;
  if (d.mine) { rows = (S.knownMine || []).filter((r) => r.active && canRowView_(c, r)); what = 'Мій список'; }
  else {
    const teams = pickTeams_(c, d, canKnown_);
    if (!teams.length) deny_();
    rows = [].concat.apply([], teams.map((id) => S.known[id] || []));
    const p = pickScope_(c, keysOf_(d));
    what = p.scope ? (p.scope.label || p.scope.name) : '';
  }
  const names = namesOut_(rows);
  if (!names.length) bad_('У цьому списку поки нікого немає.');
  const day = kyivDay(new Date());
  const doc = { title: 'Знані по імені', period: what + ' · станом на ' + day.split('-').reverse().join('.'), author: c.name, created: day, sections: [], rows: [], total: null, names: names };
  S.sendDoc(c.id, 'YL-znani-' + day + '.html', reportHtml_(doc), '🙏 <b>Знані по імені</b>\n' + esc_(what) + ' · ' + names.length);
  return { sent: true, count: names.length };
};

function reportRow_(teamIds, items, from, to, allowed, scope) {
  const st = loadStruct_();
  const inT = {};
  teamIds.forEach((id) => { inT[id] = true; });
  const rows = dd_(loadLog_().filter((r) => inT[r.teamId] || (scope && upperRowIn_(scope, r))));
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
      // лідери на МГ: з поля «лідерів», а в старих звітах — щонайменше автор
      const lead = (r) => (it === 'mg' ? Math.max(1, Number(r.leaders) || 0) : r.leaders);
      const l = sum(a, lead);
      out[it] = { n: nf(a.length), v: nf(v), avg: a.length ? df(v / a.length) : '—', new: nf(sum(a, (r) => r.newT)), l: nf(l) };
      if (it === 'club') { out[it].lavg = a.length ? df(l / a.length) : '—'; out[it].par = nf(sum(a, (r) => r.parents)); }
      if (it === 'mg') out[it].p = nf(uniq_(a.map((r) => r.authorId)).length);
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
      out[it] = { total: nf(teamIds.reduce((x, id) => x + (Number((st.team[id] || {}).known) || 0), 0) + (scope ? selfKnown_(scope) : 0)), new: nf(of('known').length) };
      STAGES.forEach((x) => { out[it][x[0]] = nf(stageSum_(teamIds, x[0]) + (scope ? selfKnown_(scope, x[0]) : 0)); });
    }
    if (it === 'finance') {
      const f = rows.filter((r) => r.type === 'fin' && r.date.slice(0, 7) >= from.slice(0, 7) && r.date.slice(0, 7) <= to.slice(0, 7));
      out[it] = { inc: nf(sum(f, (r) => r.inc)), out: nf(sum(f, (r) => r.spent)), net: nf(sum(f, (r) => r.inc - r.spent)), teams: uniq_(f.map((r) => r.teamId)).length + ' з ' + teamIds.length };
    }
  });
  return out;
}

API.report = function (c, d) {
  // офіс: звіт по Україні (лише загальні цифри, без розбивки) і по Національному офісу
  const office = officeOnly_(c);
  if (office) { c = officeCtx_(c); d = Object.assign({}, d, { split: false }); }
  const scopes = reportScopes_(c);
  const byKey = {};
  allowedScopes_(c, { office: true }).forEach((s) => { byKey[s.key] = s; });
  const keys = uniq_((d.units || []).map(String)).filter((k) => scopes.some((s) => s.key === k));
  if (!keys.length) bad_('Обери хоча б один регіон, ерію чи команду.');
  if (keys.length > 40) bad_('Забагато одиниць: максимум 40.');
  const avail = reportItems_(c);
  const items = Object.keys(REPORT_ITEMS).filter((k) => (d.items || []).indexOf(k) >= 0 && avail.indexOf(k) >= 0);
  const wantNames = (d.items || []).indexOf('names') >= 0 && avail.indexOf('names') >= 0;
  if (!items.length && !wantNames) bad_('Обери, що має бути у звіті.');
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(d.from || '') || !re.test(d.to || '') || d.to < d.from) bad_('Перевір період: дата кінця має бути не раніше за дату початку.');
  if (d.from < addDaysKey_(d.to, -400)) bad_('Період — не довше року.');
  const from = d.from, to = d.to;
  const allowedFor = (s) => { const a = {}; statCats_(c, s).forEach((x) => { a[x.key] = true; }); return a; };
  const LVL = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '', office: '' };
  const rows = [];
  const union = {};
  keys.forEach((k) => {
    const s = byKey[k];
    const ids = scopeTeamIds_(s);
    ids.forEach((id) => { union[id] = true; });
    rows.push({ name: LVL[s.level] + s.name, sub: s.sub, level: s.level, child: false, values: reportRow_(ids, items, from, to, allowedFor(s), s) });
    if (d.split && s.level !== 'team') {
      Object.keys(byKey).map((x) => byKey[x]).filter((x) => x.parent === k).sort((a, b) => a.name.localeCompare(b.name)).forEach((ch) => {
        rows.push({ name: LVL[ch.level] + ch.name, sub: '', level: ch.level, child: true, values: reportRow_(scopeTeamIds_(ch), items, from, to, allowedFor(ch), ch) });
      });
    }
  });
  let total = null;
  if (keys.length > 1) {
    const allow = {};
    items.forEach((it) => { allow[it] = keys.every((k) => allowedFor(byKey[k])[it]); });
    total = { name: 'Разом', values: reportRow_(Object.keys(union), items, from, to, allow, { level: 'multi', members: keys.map((k) => byKey[k]) }) };
  }
  const fmt = (k) => { const p = k.split('-'); return Number(p[2]) + '.' + p[1] + '.' + p[0]; };
  const out = {
    title: 'Звіт Young Life', period: fmt(from) + ' – ' + fmt(to), from, to, author: c.name, created: kyivDay(new Date()),
    sections: items.map((it) => ({ key: it, label: REPORT_ITEMS[it].label, cols: REPORT_ITEMS[it].cols.map((x) => ({ key: x[0], label: x[1] })) })),
    rows, total,
  };
  if (items.indexOf('club') >= 0 && !office) {
    // кожен внесений клуб окремо (лише команди, де клуби можна бачити)
    const okT = {};
    keys.filter((k) => allowedFor(byKey[k]).club).forEach((k) => scopeTeamIds_(byKey[k]).forEach((id) => { okT[id] = true; }));
    const st = loadStruct_();
    out.clubList = loadLog_().filter((r) => r.type === 'club' && okT[r.teamId] && r.date >= from && r.date <= to)
      .sort((a, b) => ((st.team[a.teamId] || {}).name || '').localeCompare((st.team[b.teamId] || {}).name || '') || (a.date < b.date ? -1 : 1))
      .map((r) => ({ team: (st.team[r.teamId] || {}).name || '', date: fmt(r.date), none: r.mode === MODE.none, week: r.mode === MODE.week, teens: r.count, newT: r.newT, leaders: r.leaders, parents: r.parents, note: r.note }));
  }
  if (wantNames) {
    // лише команди, де є право бачити знаних
    const teamIds = uniq_([].concat.apply([], keys.filter((k) => allowedFor(byKey[k]).known).map((k) => scopeTeamIds_(byKey[k])))).filter((id) => canKnown_(c, id));
    out.names = namesOut_([].concat.apply([], teamIds.map((id) => S.known[id] || [])));
    out.nameCols = NAME_COLS.map((x) => ({ key: x[0], label: x[1] }));
  }
  if (d.send) {
    const names = keys.map((k) => byKey[k].name).slice(0, 3).join(', ') + (keys.length > 3 ? ' та ін.' : '');
    S.sendDoc(c.id, 'YL-zvit-' + from + '_' + to + '.html', reportHtml_(out), '📊 <b>Звіт Young Life</b>\n' + esc_(names) + '\n' + esc_(out.period));
    out.sent = true;
  }
  return out;
};

function clubListHtml_(list) {
  const e = esc_;
  const par = list.some((x) => x.parents);
  return '<h2>Кожен клуб окремо · ' + list.length + '</h2><div class="w"><table class="nm"><thead><tr><th>Команда</th><th>Дата</th><th>Підлітків</th><th>Нових</th><th>Лідерів</th>' + (par ? '<th>Батьків</th>' : '') + '<th>Нотатка</th></tr></thead><tbody>' +
    list.map((x) => '<tr><td>' + e(x.team) + '</td><td>' + e(x.date) + (x.week ? ' (тиждень)' : '') + '</td>' + (x.none ? '<td colspan="' + (par ? 4 : 3) + '">клубу не було</td>' : '<td>' + x.teens + '</td><td>' + x.newT + '</td><td>' + x.leaders + '</td>' + (par ? '<td>' + x.parents + '</td>' : '')) + '<td>' + e(x.note || '') + '</td></tr>').join('') +
    '</tbody></table></div>';
}
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
    'tr.tot td{font-weight:700;border-top:2px solid #1d1d1f;background:#fff4ef}table.nm{min-width:760px}table.nm td,table.nm th{text-align:left;white-space:nowrap;font-weight:400}table.nm td:first-child{color:#6b6b70}@media print{body{padding:0}}</style></head><body>' +
    '<div class="hd"><h1>' + e(r.title) + '</h1><div class="m">' + (r.sections.length ? 'Період: ' : '') + e(r.period) + ' · сформував(ла): ' + e(r.author) + ' · ' + e(r.created) + '</div></div>' +
    r.sections.map(table).join('') + (r.clubList ? clubListHtml_(r.clubList) : '') + (r.names ? namesHtml_(r.names) : '') +
    (r.sections.length ? '<p class="m" style="margin-top:28px">«Звітували, тижнів» — скільки тижнів команди внесли звіт про клуб (разом з «не було») з усіх можливих. «—» — немає доступу до цих даних.</p>' : '') +
    (r.names ? '<p class="m">Особисті дані підлітків — лише для служіння. Не пересилай файл стороннім.</p>' : '') + '</body></html>';
}

// ── розсилка від власника ──
const canBroadcast_ = (c) => c.roles.some((r) => r.rank <= RANK.APPROVE || r.key === 'TEAM_ADMIN');
// хто потрапляє у вибір «де + які ролі» (без автора)
function audience_(c, d, perm) {
  const p = pickScope_(c, Array.isArray(d.units) && d.units.length ? d.units : [allowedScopes_(c)[0] && allowedScopes_(c)[0].key]);
  if (!p.scope) deny_();
  const units = p.scope.level === 'multi' ? p.scope.members : [p.scope];
  const roles = uniq_((d.roles || []).map(String).filter((k) => roleDef_(k)));
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && (!roles.length || roles.indexOf(r.key) >= 0) && units.some((u) => within_(u, r)) && (!perm || okR_(r, perm)));
  const LV = { nat: '', region: 'Регіон ', area: 'Ерія ', team: '' };
  const where = units.map((u) => LV[u.level] + (u.level === 'nat' ? 'Україна' : u.name)).join(', ');
  const who = roles.length ? roles.map((k) => roleDef_(k).label).join(', ') : 'усі';
  return { ids: uniq_(act.map((r) => r.tgId)).filter((id) => id !== c.id && isReal_(id)), units: units.map((u) => u.key || unitKey_(u.level, u.unitId)), roles: roles, label: where + ' · ' + who };
}
function bcRecipients_(c, d) {
  const a = audience_(c, d);
  const units = a.units.map(keyUnit_);
  const roles = a.roles;
  let ids = a.ids.filter((id) => wants_(id, 'bc'));
  // власник, уся Україна, усім — також тим, хто ще чекає підтвердження
  if (isSuper_(c) && d.pending && !roles.length && units.some((u) => u.level === 'nat')) ids = uniq_(ids.concat(Object.keys(S.b.people).filter((id) => id !== c.id && wants_(id, 'bc'))));
  return { ids: ids, label: a.label, units: units };
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
  const sig = signLine_(c, r.units);
  // власник на всю Україну — без підпису, просто від бота
  const head = sig == null ? '' : '📣 <b>' + esc_(c.name) + '</b>' + (sig ? ' · ' + esc_(sig) : '') + '\n\n';
  const body = head + esc_(text);
  r.ids.forEach((id) => {
    if (d.button === false) S.send(id, body);
    else sendApp_(id, body, 'Відкрити Young Life');
  });
  S.run('INSERT INTO broadcasts (id, text, audience, count, author, created, author_id) VALUES (?,?,?,?,?,?,?)', [uid_(), text, r.label, r.ids.length, c.name, nowIso(), c.id]);
  return { sent: r.ids.length, audience: r.label };
};

// ── задачі й опитування ──
const TASK_ST = { todo: 'Не почато', doing: 'В процесі', done: 'Виконано' };
const topRank_ = (c) => Math.min.apply(null, c.roles.map((r) => r.rank).concat([99]));
// бачить хід виконання / результати: автор, власник і вищі ролі, що охоплюють усі вибрані місця
function oversees_(c, x) {
  if (x.authorId === c.id || isSuper_(c)) return true;
  return c.roles.some((r) => r.rank <= RANK.APPROVE && r.rank < x.authorRank && x.units.length > 0 && x.units.every((k) => { const u = keyUnit_(k); return covers_(r, u.level, u.unitId); }));
}
// підпис автора: власник на всю Україну — null (без підпису); у межах регіону й нижче — його роль там (напр. «Регіональний Директор · West»)
function signLine_(c, units) {
  const lab = (r) => r.label + (r.level === 'nat' ? '' : ' · ' + unitName_(r.level, r.unitId));
  const own = c.roles.filter((r) => r.key !== 'SUPER').sort((a, b) => a.rank - b.rank);
  if (isSuper_(c)) {
    if (!units || !units.length || units.some((u) => u.level === 'nat')) return null;
    const fit = own.filter((r) => units.every((u) => covers_(r, u.level, u.unitId)))[0];
    return fit ? lab(fit) : own[0] ? lab(own[0]) : '';
  }
  const top = c.roles.filter((r) => r.key !== 'SUPER').sort((a, b) => a.rank - b.rank)[0];
  return top ? lab(top) : '';
}
const authorLine_ = (c, keys) => {
  if (isSuper_(c)) { const sig = signLine_(c, (keys || []).map(keyUnit_)); return sig == null ? 'Young Life Україна' : esc_(c.name) + (sig ? ' · ' + esc_(sig) : ''); }
  const top = c.roles.slice().sort((a, b) => a.rank - b.rank)[0]; return esc_(c.name) + (top ? ' · ' + esc_(top.label + (top.level === 'nat' ? '' : ' · ' + unitName_(top.level, top.unitId))) : '');
};
const fmtDue_ = (k) => { const M = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']; return Number(k.slice(8, 10)) + ' ' + M[Number(k.slice(5, 7)) - 1]; };
function tpCounts_(c) {
  return {
    tasks: (S.taskPeople || []).filter((x) => x.tgId === c.id && x.status !== 'done' && S.tasks.some((t) => t.id === x.taskId && !t.closed)).length,
    polls: (S.polls || []).filter((p) => !p.closed && p.people.indexOf(c.id) >= 0 && !S.votes.some((v) => v.pollId === p.id && v.tgId === c.id)).length,
  };
}

API.audCount = function (c, d) {
  if (!canBroadcast_(c)) deny_();
  const a = audience_(c, d || {}, d && d.kind === 'poll' ? 'part.polls' : d && d.kind === 'task' ? 'part.tasks' : '');
  return { count: a.ids.length, label: a.label };
};

function taskOut_(c, t) {
  const ppl = S.taskPeople.filter((x) => x.taskId === t.id);
  const mine = ppl.filter((x) => x.tgId === c.id)[0];
  const self = t.audience === 'Собі';
  const see = !self && oversees_(c, t);
  const o = { self: self, id: t.id, title: t.title, desc: t.desc, due: t.due, author: t.author, audience: t.audience, created: t.created, closed: t.closed, total: ppl.length,
    done: ppl.filter((x) => x.status === 'done').length, doing: ppl.filter((x) => x.status === 'doing').length, mine: mine ? { status: mine.status, note: mine.note } : null,
    oversee: see, canEdit: t.authorId === c.id || isSuper_(c) };
  if (see) o.people = ppl.map((x) => ({ tgId: x.tgId, name: (getPerson_(x.tgId) || {}).name || x.name, status: x.status, note: x.note, updated: x.updated }))
    .sort((a, b) => ['doing', 'todo', 'done'].indexOf(a.status) - ['doing', 'todo', 'done'].indexOf(b.status) || a.name.localeCompare(b.name));
  return o;
}
API.tasks = function (c) {
  // «Задача собі» бачить лише автор
  const list = S.tasks.filter((t) => (t.audience === 'Собі' ? t.authorId === c.id : oversees_(c, t) || S.taskPeople.some((x) => x.taskId === t.id && x.tgId === c.id))).map((t) => taskOut_(c, t));
  return { list: list.sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || (a.due || '9') .localeCompare(b.due || '9') || (a.created < b.created ? 1 : -1)), canCreate: canBroadcast_(c), canSelf: c.roles.length > 0 };
};
API.taskSave = function (c, d) {
  // «Задача собі» — може кожен; іншим — Капітан і вище
  if (!d.self && !canBroadcast_(c)) deny_('Створювати задачі можуть Капітан і вищі ролі.');
  const title = clip_(d.title).slice(0, 200);
  if (title.length < 2) bad_('Напиши, що треба зробити.');
  const due = /^\d{4}-\d{2}-\d{2}$/.test(d.due || '') ? d.due : '';
  const a = d.self ? { ids: [c.id], units: [], roles: [], label: 'Собі' } : audience_(c, d, 'part.tasks');
  if (!a.ids.length) bad_('За цим вибором ще нікого немає.');
  if (a.ids.length > 1500) bad_('Забагато людей — звузь вибір.');
  const t = { id: uid_(), title: title, desc: clip_(d.desc), due: due, units: a.units, roles: a.roles, audience: a.label, authorId: c.id, author: c.name, authorRank: topRank_(c), created: nowIso(), closed: '' };
  S.run('INSERT INTO tasks (id, title, descr, due, units, roles, audience, author_id, author, author_rank, created, closed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [t.id, t.title, t.desc, t.due, t.units.join(','), t.roles.join(','), t.audience, t.authorId, t.author, t.authorRank, t.created, '']);
  S.run("INSERT OR IGNORE INTO task_people (task_id, tg_id, name, status, note, updated) SELECT ?, value, '', 'todo', '', '' FROM json_each(?)", [t.id, JSON.stringify(a.ids)]);
  S.tasks.push(t);
  a.ids.forEach((id) => S.taskPeople.push({ taskId: t.id, tgId: id, name: '', status: 'todo', note: '', updated: '' }));
  const text = '✅ <b>Нова задача</b> від ' + authorLine_(c, t.units) + '\n\n<b>' + esc_(t.title) + '</b>' + (t.due ? '\nТермін: ' + fmtDue_(t.due) : '') + (t.desc ? '\n\n' + esc_(t.desc.slice(0, 1500)) : '');
  if (!d.self) a.ids.filter((id) => wants_(id, 'tasks')).forEach((id) => sendApp_(id, text, 'Відкрити задачу', 'tasks'));
  return { id: t.id, count: a.ids.length };
};
API.taskStatus = function (c, d) {
  const t = S.tasks.filter((x) => x.id === str_(d.id))[0];
  const me = t && S.taskPeople.filter((x) => x.taskId === t.id && x.tgId === c.id)[0];
  if (!me) deny_();
  if (t.closed) bad_('Задачу вже завершено.');
  const st = TASK_ST[d.status] ? d.status : me.status;
  const wasDone = me.status === 'done';
  me.status = st; me.note = d.note != null ? clip_(d.note).slice(0, 1000) : me.note; me.updated = nowIso();
  S.run('UPDATE task_people SET status = ?, note = ?, name = ?, updated = ? WHERE task_id = ? AND tg_id = ?', [me.status, me.note, c.name, me.updated, t.id, c.id]);
  const ppl = S.taskPeople.filter((x) => x.taskId === t.id);
  if (!wasDone && st === 'done' && ppl.every((x) => x.status === 'done') && wants_(t.authorId, 'tasks')) sendApp_(t.authorId, '🎉 Усі ' + ppl.length + ' виконали задачу «' + esc_(t.title) + '»', 'Переглянути', 'tasks');
  return taskOut_(c, t);
};
function myTP_(list, c, id, what) {
  const x = list.filter((y) => y.id === str_(id))[0];
  if (!x) bad_(what + ' не знайдено.');
  if (!(x.authorId === c.id || isSuper_(c))) deny_('Це може зробити лише автор.');
  return x;
}
API.taskClose = function (c, d) {
  const t = myTP_(S.tasks, c, d.id, 'Задачу');
  t.closed = d.reopen ? '' : nowIso();
  S.run('UPDATE tasks SET closed = ? WHERE id = ?', [t.closed, t.id]);
  return taskOut_(c, t);
};
API.taskDelete = function (c, d) {
  const t = myTP_(S.tasks, c, d.id, 'Задачу');
  S.run('DELETE FROM task_people WHERE task_id = ?', [t.id]);
  S.run('DELETE FROM tasks WHERE id = ?', [t.id]);
  return { ok: true };
};
// нагадати тим, хто ще не виконав
API.taskNudge = function (c, d) {
  const t = S.tasks.filter((x) => x.id === str_(d.id))[0];
  if (!t || !oversees_(c, t)) deny_();
  const ids = S.taskPeople.filter((x) => x.taskId === t.id && x.status !== 'done').map((x) => x.tgId).filter((id) => wants_(id, 'tasks'));
  ids.forEach((id) => sendApp_(id, '⏰ <b>Нагадування про задачу</b> від ' + authorLine_(c, t.units) + '\n\n<b>' + esc_(t.title) + '</b>' + (t.due ? '\nТермін: ' + fmtDue_(t.due) : ''), 'Відкрити задачу', 'tasks'));
  return { sent: ids.length };
};

function pollOut_(c, p) {
  const vs = S.votes.filter((v) => v.pollId === p.id);
  const see = oversees_(c, p);
  const voted = uniq_(vs.map((v) => v.tgId));
  const mine = vs.filter((v) => v.tgId === c.id).map((v) => v.opt);
  const o = { id: p.id, question: p.question, options: p.options, multi: p.multi, open: p.open, author: p.author, audience: p.audience, created: p.created, closed: p.closed,
    canVote: p.people.indexOf(c.id) >= 0 && !p.closed, mine: mine, total: p.people.length, voted: voted.length, oversee: see, canEdit: p.authorId === c.id || isSuper_(c) };
  if (see || ((p.open || p.closed) && (mine.length || p.people.indexOf(c.id) < 0 || p.closed))) o.counts = p.options.map((x, i) => vs.filter((v) => v.opt === i).length);
  if (see) {
    const nm = (id, n) => (getPerson_(id) || {}).name || n || '';
    o.who = p.options.map((x, i) => vs.filter((v) => v.opt === i).map((v) => nm(v.tgId, v.name)).sort());
    o.notVoted = p.people.filter((id) => voted.indexOf(id) < 0).map((id) => nm(id)).filter(Boolean).sort();
  }
  return o;
}
API.polls = function (c) {
  const list = S.polls.filter((p) => oversees_(c, p) || p.people.indexOf(c.id) >= 0).map((p) => pollOut_(c, p));
  return { list: list.sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || (a.created < b.created ? 1 : -1)), canCreate: canBroadcast_(c) };
};
API.pollSave = function (c, d) {
  if (!canBroadcast_(c)) deny_('Створювати опитування можуть Капітан і вищі ролі.');
  const q = clip_(d.question).slice(0, 300);
  if (q.length < 2) bad_('Напиши питання.');
  const opts = uniq_((d.options || []).map((x) => clip_(x).slice(0, 120)).filter(Boolean));
  if (opts.length < 2) bad_('Додай щонайменше два варіанти.');
  if (opts.length > 12) bad_('Максимум 12 варіантів.');
  const a = audience_(c, d, 'part.polls');
  if (!a.ids.length) bad_('За цим вибором ще нікого немає.');
  if (a.ids.length > 1500) bad_('Забагато людей — звузь вибір.');
  const p = { id: uid_(), question: q, options: opts, multi: !!d.multi, open: !!d.open, units: a.units, roles: a.roles, audience: a.label, people: a.ids, authorId: c.id, author: c.name, authorRank: topRank_(c), created: nowIso(), closed: '' };
  S.run('INSERT INTO polls (id, question, options, multi, open_results, units, roles, audience, people, author_id, author, author_rank, created, closed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [p.id, p.question, JSON.stringify(p.options), p.multi ? 1 : 0, p.open ? 1 : 0, p.units.join(','), p.roles.join(','), p.audience, p.people.join(','), p.authorId, p.author, p.authorRank, p.created, '']);
  S.polls.push(p);
  const text = '📊 <b>Опитування</b> від ' + authorLine_(c, p.units) + '\n\n<b>' + esc_(q) + '</b>\n' + opts.map((x) => '• ' + esc_(x)).join('\n');
  a.ids.filter((id) => wants_(id, 'tasks')).forEach((id) => sendApp_(id, text, 'Проголосувати', 'polls'));
  return { id: p.id, count: a.ids.length };
};
API.pollVote = function (c, d) {
  const p = S.polls.filter((x) => x.id === str_(d.id))[0];
  if (!p || p.people.indexOf(c.id) < 0) deny_();
  if (p.closed) bad_('Опитування вже завершено.');
  let opts = (d.opts || []).map(Number).filter((i, k, arr) => i >= 0 && i < p.options.length && Math.floor(i) === i && arr.indexOf(i) === k);
  if (!opts.length) bad_('Обери варіант.');
  if (!p.multi) opts = opts.slice(0, 1);
  S.run('DELETE FROM poll_votes WHERE poll_id = ? AND tg_id = ?', [p.id, c.id]);
  S.votes = S.votes.filter((v) => !(v.pollId === p.id && v.tgId === c.id));
  opts.forEach((i) => {
    S.run('INSERT INTO poll_votes (poll_id, tg_id, opt, name, created) VALUES (?,?,?,?,?)', [p.id, c.id, i, c.name, nowIso()]);
    S.votes.push({ pollId: p.id, tgId: c.id, opt: i, name: c.name });
  });
  return pollOut_(c, p);
};
API.pollClose = function (c, d) {
  const p = myTP_(S.polls, c, d.id, 'Опитування');
  p.closed = d.reopen ? '' : nowIso();
  S.run('UPDATE polls SET closed = ? WHERE id = ?', [p.closed, p.id]);
  return pollOut_(c, p);
};
API.pollDelete = function (c, d) {
  const p = myTP_(S.polls, c, d.id, 'Опитування');
  S.run('DELETE FROM poll_votes WHERE poll_id = ?', [p.id]);
  S.run('DELETE FROM polls WHERE id = ?', [p.id]);
  return { ok: true };
};

// ── «Корисні ресурси»: посилання й файли; кому корисно — усім, регіону або напрямку служіння ──
const RES_ADD = ['SUPER', 'NATIONAL_ADMIN', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'OFFICE'];
const RES_ST = { PENDING: 'очікує', ACTIVE: 'активний', REJECTED: 'відхилено' };
const canAddRes_ = (c) => (c.active || c.roles).some((r) => RES_ADD.indexOf(r.key) >= 0);
// експерт напрямку — працівник нацофісу з посадою «Експерт <напрямок>»
const isExpert_ = (r, dir) => r.key === 'OFFICE' && /експерт/i.test(r.title || '') && na_(r.title).indexOf(na_(dir)) >= 0;
function resApprovers_(aud) {
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && isReal_(r.tgId));
  const supers = uniq_(act.filter((r) => r.key === 'SUPER').map((r) => r.tgId));
  let ids = [];
  if (aud.indexOf('r:') === 0) ids = act.filter((r) => r.key === 'REGIONAL_DIRECTOR' && r.unitId === aud.slice(2)).map((r) => r.tgId);
  if (aud.indexOf('dir:') === 0) ids = act.filter((r) => isExpert_(r, aud.slice(4))).map((r) => r.tgId);
  return { primary: uniq_(ids).length ? uniq_(ids) : supers, all: uniq_(ids.concat(supers)) };
}
const resAudLabel_ = (aud) => (aud === 'all' ? 'Для всіх' : aud.indexOf('r:') === 0 ? 'Регіон ' + unitName_('region', aud.slice(2)) : aud.indexOf('dir:') === 0 ? aud.slice(4) : '');
function resSees_(c, x) {
  if (isSuper_(c) || x.authorId === c.id) return true;
  if (x.status !== RES_ST.ACTIVE) return resApprovers_(x.aud).all.indexOf(c.id) >= 0;
  if (x.aud === 'all') return true;
  const mine = c.active || c.roles;
  if (mine.some((r) => r.level === 'nat')) return true;
  const st = loadStruct_();
  if (x.aud.indexOf('r:') === 0) {
    const rid = x.aud.slice(2);
    return mine.some((r) => (r.level === 'region' && r.unitId === rid) || (r.level === 'area' && (st.area[r.unitId] || {}).regionId === rid) || (r.level === 'team' && st.teamRegion(r.unitId) === rid));
  }
  if (x.aud.indexOf('dir:') === 0) {
    const dir = x.aud.slice(4);
    return mine.some((r) => (r.level === 'team' && (st.team[r.unitId] || {}).dir === dir) || isExpert_(r, dir) ||
      (r.level !== 'team' && st.teams.some((t) => t.dir === dir && covers_(r, 'team', t.id))));
  }
  return false;
}
function resOut_(c, x) {
  return { id: x.id, title: x.title, url: x.url, hasFile: !!x.fileId, fileName: x.fileName, fkey: x.fkey, note: x.note, aud: x.aud, audLabel: resAudLabel_(x.aud), status: x.status,
    pending: x.status === RES_ST.PENDING, author: x.author, created: x.created,
    canDecide: x.status === RES_ST.PENDING && (isSuper_(c) || resApprovers_(x.aud).all.indexOf(c.id) >= 0), canDelete: isSuper_(c) || x.authorId === c.id };
}
API.resList = function (c) {
  return {
    list: (S.res || []).filter((x) => resSees_(c, x)).map((x) => resOut_(c, x)),
    canAdd: canAddRes_(c), regions: loadStruct_().regions.map((r) => ({ id: r.id, name: r.name })), dirs: DIRS,
  };
};
API.resSave = function (c, d) {
  if (!canAddRes_(c)) deny_('Додавати ресурси можуть Регіональні директори й адміни та Національний офіс.');
  const title = clip_(d.title).slice(0, 150);
  if (title.length < 2) bad_('Напиши назву.');
  let url = clip_(d.url).trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const f = d.file && d.file.fileId ? d.file : null;
  if (!url && !f) bad_('Додай посилання або файл.');
  let aud = str_(d.aud) || 'all';
  if (aud.indexOf('r:') === 0 && !loadStruct_().region[aud.slice(2)]) bad_('Обери регіон.');
  if (aud.indexOf('dir:') === 0 && DIRS.indexOf(aud.slice(4)) < 0) bad_('Обери напрямок.');
  if (aud !== 'all' && aud.indexOf('r:') !== 0 && aud.indexOf('dir:') !== 0) aud = 'all';
  const ap = resApprovers_(aud);
  const auto = isSuper_(c) || ap.primary.indexOf(c.id) >= 0;
  const x = { id: uid_(), title: title, url: url, fileId: f ? clip_(f.fileId) : '', fileName: f ? clip_(f.name).slice(0, 120) : '', fkey: f ? uid_() + uid_() : '', note: clip_(d.note).slice(0, 500),
    aud: aud, status: auto ? RES_ST.ACTIVE : RES_ST.PENDING, authorId: c.id, author: c.name, created: nowIso() };
  S.run('INSERT INTO resources (id, title, url, file_id, file_name, fkey, note, aud, status, author_id, author, created, decided_by, decided) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [x.id, x.title, x.url, x.fileId, x.fileName, x.fkey, x.note, x.aud, x.status, x.authorId, x.author, x.created, auto ? c.name : '', auto ? x.created : '']);
  S.res = [x].concat(S.res || []);
  if (!auto) {
    const text = '📚 <b>Новий корисний ресурс</b> чекає підтвердження\n\n<b>' + esc_(title) + '</b>\nКому: ' + esc_(resAudLabel_(aud)) + '\nДодав(ла): ' + esc_(c.name);
    ap.primary.filter((id) => id !== c.id && wants_(id, 'requests')).forEach((id) => sendApp_(id, text, 'Переглянути', 'res'));
  }
  return resOut_(c, x);
};
API.resDecide = function (c, d) {
  const x = (S.res || []).filter((y) => y.id === str_(d.id))[0];
  if (!x) bad_('Ресурс не знайдено.');
  if (!resOut_(c, x).canDecide) deny_();
  x.status = d.approve ? RES_ST.ACTIVE : RES_ST.REJECTED;
  S.run('UPDATE resources SET status = ?, decided_by = ?, decided = ? WHERE id = ?', [x.status, c.name, nowIso(), x.id]);
  if (x.authorId !== c.id && wants_(x.authorId, 'requests')) sendApp_(x.authorId, (d.approve ? '✅ Ресурс «' : '🚫 Ресурс «') + esc_(x.title) + (d.approve ? '» опубліковано' : '» не підтверджено') + ' (' + esc_(c.name) + ')', 'Корисні ресурси', 'res');
  return resOut_(c, x);
};
API.resDelete = function (c, d) {
  const x = (S.res || []).filter((y) => y.id === str_(d.id))[0];
  if (!x) bad_('Ресурс не знайдено.');
  if (!(isSuper_(c) || x.authorId === c.id)) deny_('Видалити може лише автор.');
  S.run('DELETE FROM resources WHERE id = ?', [x.id]);
  return { ok: true };
};

// файл для ресурсу: зберігаємо в Telegram (до 20 МБ), віддаємо за посиланням /f/<id>?k=<ключ>
async function handleUpload(req, env, ctx) {
  let form;
  try { form = await req.formData(); } catch (e) { return json({ ok: false, error: 'bad_request', message: 'Невірний запит.' }); }
  const S1 = new Store(env, ctx);
  try {
    const sess = form.get('session'), init = form.get('initData');
    const u = sess ? await verifySession(String(sess), env) : await verifyInitData(String(init || ''), env.BOT_TOKEN);
    if (!u) return json({ ok: false, error: 'auth', message: 'Не вдалося перевірити Telegram.' });
    await S1.loadBase();
    if (!use(S1, () => canAddRes_(ctx_(u)))) return json({ ok: false, error: 'forbidden', message: 'Додавати файли можуть ті, хто додає ресурси.' });
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ ok: false, error: 'bad_request', message: 'Файл не отримано.' });
    if (file.size > 20 * 1024 * 1024) return json({ ok: false, error: 'too_big', message: 'Файл більший за 20 МБ — додай його посиланням (Google Диск).' });
    const fd = new FormData();
    fd.append('chat_id', String(u.id));
    fd.append('caption', '📎 Файл для «Корисних ресурсів» MyYL');
    fd.append('document', file, file.name || 'file');
    const r = await tgForm(env, 'sendDocument', fd);
    const m = (r && r.result) || {};
    const doc = m.document || m.video || m.audio || m.animation || (m.photo && m.photo[m.photo.length - 1]);
    if (!r || !r.ok || !doc) return json({ ok: false, error: 'upload', message: 'Не вдалося зберегти файл. Спробуй ще раз або додай посиланням.' });
    return json({ ok: true, data: { fileId: doc.file_id, name: file.name || doc.file_name || 'file', size: file.size } });
  } catch (e) {
    return json({ ok: false, error: 'error', message: e.message || 'Помилка' });
  }
}
async function handleFile(req, env, url) {
  const id = url.pathname.slice(3).replace(/[^a-z0-9]/gi, '');
  const row = await env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first();
  if (!row || !row.file_id || row.fkey !== url.searchParams.get('k') || row.status !== RES_ST.ACTIVE) return new Response('Файл не знайдено', { status: 404 });
  const info = await tg(env, 'getFile', { file_id: row.file_id });
  if (!info.ok || !info.result || !info.result.file_path) return new Response('Файл недоступний', { status: 404 });
  const f = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + info.result.file_path);
  const name = row.file_name || 'file';
  return new Response(f.body, { headers: { 'content-type': f.headers.get('content-type') || 'application/octet-stream',
    'content-disposition': "inline; filename*=UTF-8''" + encodeURIComponent(name), 'cache-control': 'private, max-age=3600' } });
}

// ── «Дозволи й доступ»: кожна ланка (Капітан і вище) налаштовує ролі нижче у своїй одиниці ──
function permUnits_(c) {
  const by = {};
  c.roles.forEach((r) => {
    if (r.rank > RANK.APPROVE) return;
    const k = unitKey_(r.level, r.unitId);
    if (!by[k] || by[k].rank > r.rank) by[k] = { key: k, level: r.level, unitId: r.unitId, rank: r.rank, label: r.level === 'nat' ? 'Уся Україна' : levelLabel_(r.level, r.unitId).replace(/^Команда /, '') };
  });
  return Object.keys(by).map((k) => by[k]).sort((a, b) => PERM_LV[a.level] - PERM_LV[b.level] || a.label.localeCompare(b.label));
}
const permTargets_ = (u) => ROLES.filter((d) => !d.viewOnly && !d.hidden && d.key !== 'SUPER' && d.rank > u.rank && PERM_LV[d.level] >= PERM_LV[u.level]);
const permsFor_ = (d) => PERMS.filter((p) => !p.levels || p.levels.indexOf(d.level) >= 0);
function permCell_(u, d, p) {
  let v = p.def({ key: d.key, level: d.level, rank: d.rank });
  let lockedBy = '';
  const chain = ancestors_(u.level, u.unitId);
  for (let i = chain.length - 1; i >= 1; i--) {
    const x = S.b.perms[unitKey_(chain[i].level, chain[i].unitId) + '|' + d.key + '|' + p.key];
    if (x === 0) { lockedBy = chain[i].level === 'nat' ? 'національний рівень' : levelLabel_(chain[i].level, chain[i].unitId); break; }
    if (x === 1) v = true;
  }
  const own = S.b.perms[u.key + '|' + d.key + '|' + p.key];
  return { on: !lockedBy && (own === 0 ? false : own === 1 ? true : v), base: !lockedBy && v, locked: lockedBy, custom: own != null };
}
API.permsGet = function (c, d) {
  const units = permUnits_(c);
  if (!units.length) deny_('Налаштовувати дозволи можуть Капітан і вищі ролі.');
  const u = units.filter((x) => x.key === str_(d.unit))[0] || units[0];
  const roles = permTargets_(u);
  const cells = {};
  roles.forEach((rd) => { cells[rd.key] = {}; permsFor_(rd).forEach((p) => { cells[rd.key][p.key] = permCell_(u, rd, p); }); });
  return {
    units: units.map((x) => ({ key: x.key, label: x.label })), unit: u.key, unitLabel: u.label,
    roles: roles.map((x) => ({ key: x.key, label: x.label, level: x.level })),
    perms: PERMS.map((p) => ({ key: p.key, label: p.label, group: p.group })), cells: cells,
  };
};
function permEdit_(c, d) {
  const u = permUnits_(c).filter((x) => x.key === str_(d.unit))[0];
  if (!u) deny_();
  const rd = permTargets_(u).filter((x) => x.key === str_(d.role))[0];
  if (!rd) deny_('Цю роль налаштовує вища ланка.');
  return { u: u, rd: rd };
}
API.permSet = function (c, d) {
  const e = permEdit_(c, d);
  const p = permsFor_(e.rd).filter((x) => x.key === str_(d.perm))[0];
  if (!p) bad_('Невідомий дозвіл.');
  const cell = permCell_(e.u, e.rd, p);
  if (cell.locked) bad_('Це заборонено вище (' + cell.locked + ') — змінити може лише вища ланка.');
  const k = e.u.key + '|' + e.rd.key + '|' + p.key;
  if (!!d.on === cell.base) {
    S.run('DELETE FROM perms WHERE unit = ? AND role_key = ? AND perm = ?', [e.u.key, e.rd.key, p.key], true);
    delete S.b.perms[k];
  } else {
    S.run('INSERT INTO perms (unit, role_key, perm, val, by_name, updated) VALUES (?,?,?,?,?,?) ON CONFLICT (unit, role_key, perm) DO UPDATE SET val = excluded.val, by_name = excluded.by_name, updated = excluded.updated',
      [e.u.key, e.rd.key, p.key, d.on ? 1 : 0, c.name, nowIso()], true);
    S.b.perms[k] = d.on ? 1 : 0;
  }
  return API.permsGet(c, { unit: e.u.key });
};
API.permReset = function (c, d) {
  const e = permEdit_(c, d);
  S.run('DELETE FROM perms WHERE unit = ? AND role_key = ?', [e.u.key, e.rd.key], true);
  Object.keys(S.b.perms).forEach((k) => { if (k.indexOf(e.u.key + '|' + e.rd.key + '|') === 0) delete S.b.perms[k]; });
  return API.permsGet(c, { unit: e.u.key });
};

// ── вибір однієї або кількох одиниць ──
function pickScope_(c, keys, opt) {
  const scopes = allowedScopes_(c, opt);
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
API.stats = function (c0, d) {
  const c = officeOnly_(c0) ? officeCtx_(c0) : wideStats_(P_(c0, 'see.stats'));
  if (!c.roles.length) deny_('Статистику для твоєї ролі вимкнено.');
  const p = pickScope_(c, keysOf_(d), { office: true });
  const scopes = p.scopes;
  const scope = p.scope || scopes[0];
  if (!scope) deny_();
  const cats = statCats_(c, scope);
  const cat = cats.some((x) => x.key === d.cat) ? d.cat : cats[0].key;
  const out = computeStats_(c, scope, cat, d.period || 'month', cats, scopes, customRange_(d));
  // «Останні внесені»: свіжі записи (клуб, МГ, КР) у вибраній ланці
  {
    const ids = {}; scopeTeamIds_(scope).forEach((id) => { ids[id] = true; });
    const typeOk = { club: cats.some((x) => x.key === 'club'), mg: cats.some((x) => x.key === 'mg'), kr: cats.some((x) => x.key === 'kr') };
    const stR = loadStruct_();
    out.recent = dd_(loadLog_().filter((r) => typeOk[r.type] && (ids[r.teamId] || upperRowIn_(scope, r))))
      .sort((a, b) => ((b.created || b.date) > (a.created || a.date) ? 1 : -1)).slice(0, 30)
      .map((r) => ({ type: r.type, date: r.date, created: r.created || '', team: r.teamId ? (stR.team[r.teamId] || {}).name || '' : '', author: r.author || '', none: r.mode === MODE.none, week: r.mode === MODE.week,
        teens: r.count, newT: r.newT, leaders: r.leaders, parents: r.parents, hours: r.hours }));
  }
  // офіс бачить по Україні лише загальні цифри — без розбивки по регіонах і командах
  if (c.officeView && scope.level === 'nat') { out.breakdown.rows = []; out.breakdown.title = ''; out.recent = []; out.report = []; out.canNudge = false; }
  // коли команда востаннє звітувала за клуб; для однієї команди — історія звітів за клуб
  const last = lastClubs_();
  const st = loadStruct_();
  out.breakdown.rows.forEach((row) => { const id = row.drill && row.drill.indexOf('t:') === 0 ? row.drill.slice(2) : (row.teamId || ''); if (id && last[id]) { row.last = last[id].date; row.lastNone = last[id].mode === MODE.none; } else if (id) row.last = ''; });
  if (scope.level === 'team') {
    const id = scope.unitId;
    const canEdit = canClubFix_(c0, id);
    out.club = { last: last[id] ? last[id].date : '', capernaum: (st.team[id] || {}).dir === 'Capernaum', canEdit: canEdit,
      history: (S.clubs || []).filter((r) => r.teamId === id).slice(0, 40).map(clubOut_) };
  }
  return out;
};
function lastClubs_() { const o = {}; (S.clubs || []).forEach((r) => { if (r.teamId && !o[r.teamId]) o[r.teamId] = r; }); return o; }
const clubOut_ = (r) => ({ id: r.id, date: r.date, none: r.mode === MODE.none, week: r.mode === MODE.week, teens: r.count, newT: r.newT, leaders: r.leaders, parents: r.parents, note: r.note, author: r.author });

// «За кого вношу клуб»: людина сама обирає команди (за замовчуванням — усі, де може; порожньо — лише за себе)
function myClubTeams_(c) {
  const all = clubTeams_(c);
  const pick = ((getPerson_(c.id) || {}).prefs || {}).clubTeams;
  return Array.isArray(pick) ? all.filter((id) => pick.indexOf(id) >= 0) : all;
}
API.clubPick = function (c, d) {
  const p = getPerson_(c.id);
  if (!p) bad_('Спершу заповни профіль.');
  const all = clubTeams_(c);
  const prefs = Object.assign({}, p.prefs || {});
  if (d.all) delete prefs.clubTeams; else prefs.clubTeams = uniq_((d.teams || []).map(String)).filter((id) => all.indexOf(id) >= 0);
  p.prefs = prefs;
  S.run('UPDATE people SET prefs = ? WHERE tg_id = ?', [JSON.stringify(prefs), c.id], true);
  return { club: myClubTeams_(c) };
};
// змінити чи видалити звіт за клуб: хто вносить клуб у цій команді, а також Еріа Директор і Еріа Адмін
// ── «Наш клуб»: план наступного клубу, кошик ідей, архів проведених ──
const IDEA_CATS = [['game', 'Гра'], ['song', 'Пісня'], ['topic', 'Тема'], ['other', 'Інше']];
// програма клубу: впорядкований список пунктів
const PROG_KINDS = ['game', 'song', 'talk', 'other'];
const CLUB_ROLE_HINTS = ['Ведучий', 'Гра', 'Пісні й музика', 'Зустріч підлітків', 'Перекус', 'Техніка й звук', 'Молитва', 'Фото'];
function planFromRow_(r) {
  const j = (x, def) => { try { return x ? JSON.parse(x) : def; } catch (e) { return def; } };
  return { id: r.id, teamId: r.team_id, date: r.date || '', topic: r.topic || '', sermon: r.sermon || '', preacher: r.preacher || '', scripture: r.scripture || '', program: j(r.program, []), roles: j(r.roles, []), note: r.note || '',
    status: r.status || 'plan', report: j(r.report, null), reportId: r.report_id || '', created: r.created || '', updated: r.updated || '', doneAt: r.done_at || '', doneBy: r.done_by || '' };
}
function teamRank_(c, teamId) { return c.roles.filter((r) => r.level === 'team' && r.unitId === teamId).reduce((a, r) => Math.min(a, r.rank), 99); }
function clubPlanCan_(c, teamId) {
  const sup = isSuper_(c), rk = teamRank_(c, teamId);
  const up = c.roles.some((r) => r.level !== 'team' && covers_(r, 'team', teamId));
  const ad = c.roles.some((r) => (r.key === 'AREA_DIRECTOR' || r.key === 'AREA_ADMIN') && covers_(r, 'team', teamId));
  return { view: sup || rk < 99 || up, edit: sup || rk <= RANK.MG || ad, date: sup || rk <= RANK.CLUB || ad, idea: sup || rk <= RANK.KR || ad, ideaDel: sup || rk <= RANK.CLUB || ad,
    report: clubTeams_(c).indexOf(teamId) >= 0 };
}
function lastClubDate_(teamId) {
  const r = (S.clubs || S.lastClubRows || []).filter((x) => x.teamId === teamId && x.mode !== MODE.none).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return r ? r.date : '';
}
function nextClubDate_(teamId, after) {
  const today = kyivDay(new Date());
  let d = after ? addDaysKey_(after, 7) : '';
  if (!d) { const last = lastClubDate_(teamId); d = last ? addDaysKey_(last, 7) : today; }
  for (let i = 0; d < today && i < 600; i++) d = addDaysKey_(d, 7);
  return d;
}
const openPlan_ = (teamId) => (S.plans || []).filter((p) => p.teamId === teamId && p.status === 'plan')[0] || null;
function planRow_(p) {
  return { id: p.id, team_id: p.teamId, date: p.date, topic: p.topic, sermon: p.sermon || '', preacher: p.preacher, scripture: p.scripture, program: JSON.stringify(p.program || []), roles: JSON.stringify(p.roles || []), note: p.note,
    status: p.status, report: p.report ? JSON.stringify(p.report) : '', report_id: p.reportId || '', created: p.created, updated: p.updated, author_id: p.authorId || '', done_at: p.doneAt || '', done_by: p.doneBy || '' };
}
function planInsert_(p) { const row = planRow_(p), k = Object.keys(row); S.run('INSERT INTO club_plans (' + k.join(', ') + ') VALUES (' + k.map(() => '?').join(',') + ')', k.map((x) => row[x])); (S.plans = S.plans || []).push(p); }
function planUpdate_(p) { const row = planRow_(p), k = Object.keys(row).filter((x) => x !== 'id'); S.run('UPDATE club_plans SET ' + k.map((x) => x + ' = ?').join(', ') + ' WHERE id = ?', k.map((x) => row[x]).concat([p.id])); }
// наступний клуб: ролі (і відповідальні) підтягуються з попереднього; якщо клубу не було — і тема з проповідником теж
function planNext_(teamId, prev, c) {
  const carry = prev && prev.status === 'none';
  const p = { id: uid_(), teamId: teamId, date: nextClubDate_(teamId, prev ? prev.date : ''), topic: carry ? prev.topic : '', sermon: carry ? prev.sermon || '' : '', preacher: carry ? prev.preacher : '', scripture: carry ? prev.scripture : '',
    program: carry ? (prev.program || []).map((x) => Object.assign({}, x)) : [],
    roles: prev ? (prev.roles || []).map((r) => ({ name: r.name, who: (r.who || []).slice(), text: r.text || '' })) : [], note: '', status: 'plan', report: null, reportId: '',
    created: nowIso(), updated: nowIso(), authorId: c ? c.id : '' };
  planInsert_(p);
  return p;
}
// звіт за клуб уже внесли (через «Внести») — план сам іде в архів, а на його місці з'являється наступний
function planSync_(teamId) {
  const p = openPlan_(teamId);
  if (!p || !p.date) return;
  const used = {};
  (S.plans || []).forEach((x) => { if (x.reportId) used[x.reportId] = true; });
  const wk = weekKey_(p.date);
  const r = (S.clubs || S.lastClubRows || []).filter((x) => x.teamId === teamId && weekKey_(x.date) === wk && !used[x.id])[0];
  if (!r) return;
  planArchive_(p, r, { id: r.authorId, name: r.author });
}
function planArchive_(p, r, who) {
  const none = r.mode === MODE.none;
  p.status = none ? 'none' : 'done';
  p.report = none ? { none: true, note: r.note || '' } : { teens: r.count, newT: r.newT, leaders: r.leaders, parents: r.parents, note: r.note || '' };
  p.reportId = r.id; p.date = r.date || p.date; p.doneAt = nowIso(); p.doneBy = (who && who.name) || ''; p.updated = nowIso();
  planUpdate_(p);
  return planNext_(p.teamId, p, null);
}
function teamPeople_(teamId) {
  const by = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId).forEach((r) => {
    const k = r.tgId || 'r:' + r.id;
    const x = by[k] = by[k] || { id: k, name: r.name, rank: 99, role: '' };
    if (r.rank < x.rank) { x.rank = r.rank; x.role = r.label; }
  });
  return Object.keys(by).map((k) => by[k]).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'uk'));
}
function planOut_(p, people) {
  const nm = {};
  people.forEach((x) => { nm[x.id] = x.name; });
  return Object.assign({}, p, { roles: (p.roles || []).map((r) => ({ name: r.name, text: r.text || '', who: (r.who || []).filter((id) => nm[id]).map((id) => ({ id: id, name: nm[id] })) })) });
}
// для головної: найближчий клуб кожної моєї команди
function myClubPlans_(c) {
  const st = loadStruct_();
  const ids = uniq_(c.roles.filter((r) => r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active).map((r) => r.unitId));
  return ids.map((id) => {
    planSync_(id);
    const p = openPlan_(id), can = clubPlanCan_(c, id);
    const mine = p ? (p.roles || []).filter((r) => (r.who || []).indexOf(c.id) >= 0).map((r) => r.name) : [];
    return { teamId: id, team: st.team[id].name, canEdit: can.edit, plan: p ? { date: p.date, topic: p.topic, preacher: p.preacher, scripture: p.scripture, roles: (p.roles || []).length, filled: (p.roles || []).filter((r) => (r.who || []).length || r.text).length, mine: mine } : null };
  });
}
API.clubPage = function (c, d) {
  const teamId = str_(d.teamId), st = loadStruct_(), team = st.team[teamId];
  if (!team) bad_('Команду не знайдено.');
  const can = clubPlanCan_(c, teamId);
  if (!can.view) deny_('План клубу бачать учасники команди та її керівники.');
  planSync_(teamId);
  const people = teamPeople_(teamId);
  let plan = openPlan_(teamId);
  const done = (S.plans || []).filter((p) => p.teamId === teamId && p.status !== 'plan').sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!plan) {
    const prev = done[0];
    plan = { id: '', teamId: teamId, date: nextClubDate_(teamId, prev ? prev.date : ''), topic: '', sermon: '', preacher: '', scripture: '', program: [], note: '', status: 'plan',
      roles: prev ? (prev.roles || []).map((r) => ({ name: r.name, who: (r.who || []).slice(), text: r.text || '' })) : [] };
  }
  const lc = (S.clubs || []).filter((x) => x.teamId === teamId)[0];
  return {
    team: { id: teamId, name: team.name, dir: team.dir || '' }, can: can, plan: planOut_(plan, people), people: people.map((x) => ({ id: x.id, name: x.name, role: x.role })),
    archive: done.map((p) => planOut_(p, people)), ideas: (S.ideas || []).map((x) => ({ id: x.id, cat: x.cat, text: x.text, desc: x.descr || '', author: x.author || '', created: x.created })),
    ideaCats: IDEA_CATS, hints: CLUB_ROLE_HINTS, lastClub: lc ? { date: lc.date, teens: lc.count, leaders: lc.leaders, none: lc.mode === MODE.none } : null, today: kyivDay(new Date()),
  };
};
API.clubPlanSave = function (c, d) {
  const teamId = str_(d.teamId);
  if (!loadStruct_().team[teamId]) bad_('Команду не знайдено.');
  const can = clubPlanCan_(c, teamId);
  if (!can.edit) deny_('План клубу заповнюють капітан, адмін команди та лідери.');
  const people = teamPeople_(teamId), ok = {};
  people.forEach((x) => { ok[x.id] = true; });
  const roles = (Array.isArray(d.roles) ? d.roles : []).slice(0, 40).map((r) => ({ name: clip_((r && r.name) || '').slice(0, 80), text: clip_((r && r.text) || '').slice(0, 120),
    who: uniq_((Array.isArray(r && r.who) ? r.who : []).map(String).filter((id) => ok[id])).slice(0, 12) })).filter((r) => r.name);
  let p = openPlan_(teamId);
  if (d.id && p && p.id !== str_(d.id)) bad_('План уже змінився — онови сторінку.');
  const isNew = !p;
  if (isNew) {
    const prev = (S.plans || []).filter((x) => x.teamId === teamId && x.status !== 'plan').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    p = { id: uid_(), teamId: teamId, date: nextClubDate_(teamId, prev ? prev.date : ''), status: 'plan', created: nowIso(), authorId: c.id, report: null, reportId: '' };
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : p.date;
  if (date !== p.date && !can.date) deny_('Дату клубу змінює капітан або адмін команди.');
  Object.assign(p, { date: date, topic: clip_(d.topic || '').slice(0, 200), preacher: clip_(d.preacher || '').slice(0, 100), scripture: clip_(d.scripture || '').slice(0, 120),
    note: clip_(d.note || '').slice(0, 1000), roles: roles, sermon: clip_(d.sermon).slice(0, 200),
    program: (Array.isArray(d.program) ? d.program : []).slice(0, 40).map((g) => ({ kind: PROG_KINDS.indexOf(g && g.kind) >= 0 ? g.kind : 'other', name: clip_(g && g.name).slice(0, 120), desc: clip_(g && g.desc).slice(0, 600) })).filter((g) => g.name), updated: nowIso() });
  if (isNew) planInsert_(p); else planUpdate_(p);
  return { id: p.id, date: p.date };
};
API.clubPlanDone = function (c, d) {
  const teamId = str_(d.teamId);
  const can = clubPlanCan_(c, teamId);
  if (!can.report) deny_('Звіт за клуб дає капітан або адмін команди — той, хто вносить клуб.');
  const p = openPlan_(teamId);
  if (!p || (d.id && p.id !== str_(d.id))) bad_('Спершу збережи план клубу.');
  const today = kyivDay(new Date());
  if (p.date > today) bad_('Клуб ще попереду (' + p.date + '). Звіт можна дати в день клубу або пізніше.');
  API.saveReport(c, { type: 'club', teamId: teamId, mode: d.none ? 'none' : 'event', date: p.date, teens: d.teens, newT: d.newT, leaders: d.leaders, parents: d.parents, note: d.note });
  const r = S.log.filter((x) => x.type === 'club' && x.teamId === teamId && x.authorId === c.id).slice(-1)[0];
  const next = planArchive_(p, r, { id: c.id, name: c.name });
  return { next: { id: next.id, date: next.date } };
};
API.clubIdeaAdd = function (c, d) {
  const teamId = str_(d.teamId);
  if (!loadStruct_().team[teamId]) bad_('Команду не знайдено.');
  if (!clubPlanCan_(c, teamId).idea) deny_('Ідеї додають капітан, адмін, лідери й помічники.');
  const text = clip_(d.text || '').slice(0, 500);
  if (!text) bad_('Напиши ідею.');
  const cat = IDEA_CATS.some((x) => x[0] === d.cat) ? d.cat : 'other';
  const row = { id: uid_(), team_id: teamId, cat: cat, text: text, descr: clip_(d.desc).slice(0, 600), author_id: c.id, author: c.name, created: nowIso() };
  const k = Object.keys(row);
  S.run('INSERT INTO club_ideas (' + k.join(', ') + ') VALUES (' + k.map(() => '?').join(',') + ')', k.map((x) => row[x]));
  return { id: row.id };
};
API.clubIdeaDel = function (c, d) {
  const teamId = str_(d.teamId);
  if (!clubPlanCan_(c, teamId).ideaDel) deny_('Чистити кошик ідей можуть капітан і адмін команди.');
  if (d.all) { const cat = IDEA_CATS.some((x) => x[0] === d.cat) ? d.cat : ''; S.run('DELETE FROM club_ideas WHERE team_id = ?' + (cat ? ' AND cat = ?' : ''), cat ? [teamId, cat] : [teamId]); return { ok: true }; }
  const x = (S.ideas || []).filter((i) => i.id === str_(d.id))[0];
  if (!x) bad_('Ідею вже видалено.');
  S.run('DELETE FROM club_ideas WHERE id = ? AND team_id = ?', [x.id, teamId]);
  return { ok: true };
};

// ── «Банк ідей»: усе, що команди вже провели на клубах (теми, проповіді, ігри, пісні), без повторів ──
const BANK_CATS = [['topic', 'Теми клубів'], ['sermon', 'Проповіді'], ['game', 'Ігри'], ['song', 'Пісні']];
function bankKey_(t) { return String(t || '').toLowerCase().replace(/[ʼ'’`"«»]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
API.ideaBank = function (c) {
  if (!c.roles.length && !isOffice_(c)) deny_('Банк ідей відкривається після підтвердження ролі.');
  const st = loadStruct_(), by = {};
  const letters = (t) => (String(t || '').match(/\p{L}/gu) || []).length;
  const add = (cat, text, desc, p) => {
    text = String(text || '').trim(); desc = String(desc || '').trim();
    if (letters(text) < 3) return;
    if (cat === 'game' && letters(desc) < 10) return; // гра без зрозумілого опису — не беремо
    const k = cat + '|' + phon_(bankKey_(text)), team = (st.team[p.teamId] || {}).name || '';
    const x = by[k];
    if (!x) { by[k] = { cat: cat, text: text, desc: desc, team: team, date: p.date, teams: team ? [team] : [] }; return; }
    if (desc.length > x.desc.length) { x.desc = desc; x.team = team; x.date = p.date; }
    if (team && x.teams.indexOf(team) < 0) x.teams.push(team);
  };
  (S.plans || []).filter((p) => p.status === 'done').forEach((p) => {
    add('topic', p.topic, p.scripture, p);
    if (p.sermon) add('sermon', p.sermon, p.scripture, p);
    (p.program || []).forEach((g) => { if (g.kind === 'game' || g.kind === 'song') add(g.kind, g.name, g.kind === 'game' ? g.desc : '', p); if (g.kind === 'talk') add('sermon', g.name, g.desc, p); });
  });
  const items = Object.keys(by).map((k) => by[k]).sort((a, b) => b.teams.length - a.teams.length || (a.date < b.date ? 1 : -1));
  return { cats: BANK_CATS, items: items };
};
function canClubFix_(c, teamId) {
  return isSuper_(c) || clubTeams_(c).indexOf(teamId) >= 0 || c.roles.some((r) => (r.key === 'AREA_DIRECTOR' || r.key === 'AREA_ADMIN') && covers_(r, 'team', teamId));
}
API.clubDelete = function (c, d) {
  const r = (S.clubs || []).filter((x) => x.id === str_(d.id))[0];
  if (!r) bad_('Звіт уже видалено.');
  if (!canClubFix_(c, r.teamId)) deny_('Видаляти звіт за клуб можуть ті, хто його вносить, а також Еріа Директор і Еріа Адмін.');
  S.run('DELETE FROM reports WHERE id = ?', [r.id]);
  return { ok: true };
};
API.clubEdit = function (c, d) {
  const r = (S.clubs || []).filter((x) => x.id === str_(d.id))[0];
  if (!r) bad_('Звіт не знайдено.');
  if (!canClubFix_(c, r.teamId)) deny_('Змінювати звіт за клуб можуть Капітан, Адмін команди, Еріа Директор і Еріа Адмін.');
  const n = (v) => { const x = Number(v); return isFinite(x) && x >= 0 ? Math.round(x) : 0; };
  const none = !!d.none;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && d.date <= kyivDay(new Date()) ? d.date : r.date;
  const mode = none ? MODE.none : r.mode === MODE.none ? MODE.event : r.mode;
  const v = { date: date, week: weekKey_(date), mode: mode, count: none ? 0 : n(d.teens), new_t: none ? 0 : n(d.newT), leaders: none ? 0 : n(d.leaders), parents: none ? 0 : n(d.parents), note: clip_(d.note) };
  const keys = Object.keys(v);
  S.run('UPDATE reports SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?', keys.map((k) => v[k]).concat([r.id]));
  return { ok: true };
};

API.nudge = function (c, d) {
  if (!c.roles.some((r) => r.rank <= RANK.APPROVE)) deny_();
  const scope = pickScope_(c, keysOf_(d)).scope;
  if (!scope) deny_();
  const type = d.type;
  if (type !== 'club') bad_('Нагадувати можна лише про клуб.');
  const miss = missingFor_(scope, type);
  miss.people.filter((tgId) => wants_(tgId, 'remind')).forEach((tgId) => sendApp_(tgId, '🔔 Нагадування: заповни, будь ласка, «' + TYPE_LABEL[type] + '» за цей тиждень. Якщо не було — так і відміть.', 'Відкрити'));
  return { sent: miss.people.length };
};

// свій період: from..to (YYYY-MM-DD), не довше 5 років
function customRange_(d) {
  const ok = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '');
  if (!d || d.period !== 'custom' || !ok(d.from)) return null;
  const today = kyivDay(new Date());
  let to = ok(d.to) ? d.to : today;
  if (to > today) to = today;
  let from = d.from > to ? to : d.from;
  if (from < addDaysKey_(to, -366 * 5)) from = addDaysKey_(to, -366 * 5);
  return { from: from, to: to, days: dayDiff_(from, to) + 1 };
}
function statsFromWeek(period, d) {
  const cr = customRange_(Object.assign({ period: period }, d || {}));
  if (cr) return weekKey_(cr.from);
  const nowWk = weekKey_(new Date());
  const weeks = period === 'year' ? 53 : period === 'q' ? 13 : 8;
  return addDaysKey_(nowWk, -7 * weeks);
}

function allowedScopes_(c, opt) {
  const st = loadStruct_();
  const seen = {};
  const out = [];
  const add = (key, label, depth, level, unitId, sub, name, parent) => { if (seen[key]) return; seen[key] = true; out.push({ key, label, depth, level, unitId, sub: sub || '', name: name || label, parent: parent || '' }); };
  const addTeam = (t, depth) => { if (t.active) { const a = st.area[t.areaId] || {}; add('t:' + t.id, t.name, depth, 'team', t.id, (a.name || '') + ' · ' + ((st.region[a.regionId] || {}).name || ''), t.name, 'a:' + t.areaId); } };
  const addArea = (a, depth) => { add('a:' + a.id, 'Ерія ' + a.name, depth, 'area', a.id, 'регіон ' + ((st.region[a.regionId] || {}).name || ''), a.name, 'r:' + a.regionId); st.teams.filter((t) => t.areaId === a.id).forEach((t) => addTeam(t, depth + 1)); };
  const addRegion = (r, depth) => { add('r:' + r.id, 'Регіон ' + r.name, depth, 'region', r.id, '', r.name, 'nat'); st.areas.filter((a) => a.regionId === r.id).forEach((a) => addArea(a, depth + 1)); };
  c.roles.slice().sort((a, b) => a.rank - b.rank).forEach((r) => {
    if (r.officeView) { if (r.withNat) add('nat', 'Уся Україна', 0, 'nat', '', '', 'Україна'); add('office', 'Національний офіс', 0, 'office', '', '', 'Національний офіс', 'nat'); return; }
    if (r.level === 'nat') { add('nat', 'Уся Україна', 0, 'nat', '', '', 'Україна'); if (opt && opt.office) add('office', 'Національний офіс', 1, 'office', '', '', 'Національний офіс', 'nat'); st.regions.forEach((x) => addRegion(x, 1)); }
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
  if (scope.level === 'office') return [{ key: 'mg', label: 'Малі групи' }, { key: 'kr', label: 'Контактна робота' }, { key: 'known', label: 'Знані' }];
  if (c.officeView) return [{ key: 'overview', label: 'Огляд' }, { key: 'club', label: 'Клуби' }, { key: 'mg', label: 'Малі групи' }, { key: 'kr', label: 'Контактна робота' }];
  if (scope.level === 'multi') {
    const lists = scope.members.map((m) => statCats_(c, m).map((x) => x.key));
    return statCats_(c, scope.members[0]).filter((x) => lists.every((l) => l.indexOf(x.key) >= 0));
  }
  const cats = [{ key: 'overview', label: 'Огляд' }, { key: 'people', label: 'Команда' }, { key: 'club', label: 'Клуби' }, { key: 'mg', label: 'Малі групи' }, { key: 'kr', label: 'Контактна робота' }];
  const upperCovers = (perm) => upperRoles_(c).some((r) => covers_(r, scope.level, scope.unitId) && okR_(r, perm));
  const teamOk = (perm) => scope.level === 'team' && teamRoles_(c, scope.unitId, perm).length > 0;
  if (upperCovers('see.known') || teamOk('see.known')) cats.push({ key: 'known', label: 'Знані' });
  if (upperCovers('see.fin') || teamOk('see.fin')) cats.push({ key: 'finance', label: 'Фінанси' });
  return cats;
}

// «Встановили MyYL»: скільки людей зі складу вже зареєстровані (по регіонах, еріях, командах) + імена
API.installStats = function (c0, d) {
  const c = P_(c0, 'see.team');
  if (!c.roles.length) deny_();
  const p = pickScope_(c, keysOf_(d));
  const scope = p.scope || p.scopes[0];
  if (!scope) deny_();
  const st = loadStruct_();
  const act = loadRoles_().filter((r) => (r.status === ST.ACTIVE || r.status === ST.PENDING) && r.key !== 'SUPER');
  const inUnit = (u) => act.filter((r) => within_(u, r) && (r.level !== 'nat' || u.level === 'nat'));
  const count = (rows) => { const ids = uniq_(rows.map((r) => r.tgId)); const reg = ids.filter(isReal_); return { total: ids.length, reg: reg.length }; };
  const members = scope.level === 'multi' ? scope.members : [scope];
  const all = [].concat.apply([], members.map(inUnit));
  let kids = [];
  if (scope.level === 'multi') kids = scope.members.map((m) => ({ key: m.key, name: m.name, u: m }));
  else if (scope.level === 'nat') kids = st.regions.map((x) => ({ key: 'r:' + x.id, name: x.name, u: { level: 'region', unitId: x.id } }));
  else if (scope.level === 'region') kids = st.areas.filter((a) => a.regionId === scope.unitId).map((x) => ({ key: 'a:' + x.id, name: x.name, u: { level: 'area', unitId: x.id } }));
  else if (scope.level === 'area') kids = st.teams.filter((t) => t.areaId === scope.unitId && t.active).map((x) => ({ key: 't:' + x.id, name: x.name, u: { level: 'team', unitId: x.id } }));
  const scopeKeys = {};
  p.scopes.forEach((x) => { scopeKeys[x.key] = 1; });
  const rows = kids.map((k) => Object.assign({ name: k.name, drill: scopeKeys[k.key] ? k.key : '' }, count(inUnit(k.u)))).filter((r) => r.total).sort((a, b) => b.reg / b.total - a.reg / a.total || b.total - a.total);
  // люди: ім'я, головна роль, коли зареєструвався
  const byId = {};
  all.forEach((r) => { const x = byId[r.tgId] = byId[r.tgId] || { id: r.tgId, roles: [] }; x.roles.push(r); });
  const people = Object.keys(byId).map((id) => {
    const per = getPerson_(id) || {};
    const rs = byId[id].roles.sort((a, b) => a.rank - b.rank), top = rs.filter((r) => r.key !== 'SUPER')[0];
    return { name: per.name || rs[0].name, role: top ? top.label + ' · ' + levelLabel_(top.level, top.unitId).replace(/^Команда /, '') : '', reg: isReal_(id), since: per.registered ? String(per.registered).slice(0, 10) : '', at: per.registered || '' };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const t = count(all);
  return { scope: scope, scopes: p.scopes, total: t.total, reg: t.reg, rows: rows, title: { nat: 'Регіони', region: 'Ерії', area: 'Команди', team: '', multi: 'Вибрані' }[scope.level] || '',
    latest: people.filter((x) => x.reg && x.at).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10).map((x) => ({ name: x.name, role: x.role, at: x.at })),
    users: people.filter((x) => x.reg), notYet: people.filter((x) => !x.reg).map((x) => ({ name: x.name, role: x.role })) };
};

// статистика за напрямками — від ерії і вище (капітанам і нижче не потрібна)
const canDirs_ = (c) => P_(c, 'see.stats').roles.some((r) => r.level !== 'team');
API.dirStats = function (c0, d) {
  if (!canDirs_(c0)) deny_('Статистика за напрямками — для керівництва ерій і вище.');
  const c = wideStats_(P_(c0, 'see.stats'));
  if (!c.roles.length) deny_('Статистику для твоєї ролі вимкнено.');
  const p = pickScope_(c, keysOf_(d));
  const scope = p.scope || p.scopes[0];
  if (!scope) deny_();
  const st = loadStruct_();
  const cr = customRange_(d);
  const P = cr ? Math.max(1, Math.ceil(cr.days / 7)) : { week: 1, month: 4, q: 13, year: 52 }[d.period] || 4;
  const start = cr ? cr.from : addDaysKey_(weekKey_(new Date()), -7 * (P - 1));
  const inPer = (r) => (cr ? String(r.date).slice(0, 10) >= cr.from && String(r.date).slice(0, 10) <= cr.to : r.week >= start);
  const teamIds = scopeTeamIds_(scope);
  const dirOf = (id) => (DIRS.indexOf((st.team[id] || {}).dir) >= 0 ? st.team[id].dir : '');
  const rows = dd_(loadLog_().filter((r) => r.teamId && teamIds.indexOf(r.teamId) >= 0 && inPer(r) && r.mode !== MODE.none));
  const tRoles = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && teamIds.indexOf(r.unitId) >= 0);
  const one = (dir) => {
    const ids = teamIds.filter((id) => dirOf(id) === dir);
    const set = {};
    ids.forEach((id) => { set[id] = 1; });
    const rr = rows.filter((r) => set[r.teamId]);
    const clubs = rr.filter((r) => r.type === 'club'), mgs = rr.filter((r) => r.type === 'mg'), krs = rr.filter((r) => r.type === 'kr');
    const teens = clubs.reduce((a, r) => a + (Number(r.count) || 0), 0);
    return {
      dir: dir, label: dir || 'Без напрямку', teams: ids.length,
      people: uniq_(tRoles.filter((r) => set[r.unitId]).map((r) => r.tgId)).length,
      clubs: clubs.length, teens: teens, avg: clubs.length ? Math.round(teens / clubs.length * 10) / 10 : 0,
      newT: clubs.reduce((a, r) => a + (Number(r.newT) || 0), 0),
      mg: mgs.length, mgPeople: mgs.reduce((a, r) => a + (Number(r.count) || 0), 0),
      kr: Math.round(krs.reduce((a, r) => a + (Number(r.hours) || 0), 0) * 10) / 10,
      known: ids.reduce((a, id) => a + (Number(st.team[id].known) || 0), 0),
      names: dir ? [] : ids.map((id) => st.team[id].name).sort(),
    };
  };
  const list = DIRS.map(one).concat([one('')]).filter((x) => x.dir || x.teams);
  return { scope: scope, scopes: p.scopes, period: cr ? 'custom' : d.period || 'month', range: cr, rows: list,
    total: { teams: teamIds.length, withDir: teamIds.filter(dirOf).length } };
};

function computeStats_(c, scope, cat, period, cats, scopes, cr) {
  const st = loadStruct_();
  const teamIds = scopeTeamIds_(scope);
  const inScope = {};
  teamIds.forEach((id) => { inScope[id] = true; });
  if (period === 'custom' && !cr) period = 'month';
  const P = cr ? Math.max(1, Math.ceil(cr.days / 7)) : { week: 1, month: 4, q: 13, year: 52 }[period] || 4;
  const nowWk = weekKey_(new Date());
  const periodStart = cr ? cr.from : addDaysKey_(nowWk, -7 * (P - 1));
  const chartWeeks = period === 'year' ? 52 : period === 'q' ? 13 : 8;
  const chartStart = cr ? weekKey_(cr.from) : addDaysKey_(nowWk, -7 * (chartWeeks - 1));
  const chartEnd = cr ? weekKey_(cr.to) : nowWk;
  const byMonth = period === 'year' || (cr && cr.days > 120);
  const from = periodStart < chartStart ? periodStart : chartStart;
  const inPer = (r) => (cr ? String(r.date).slice(0, 10) >= cr.from && String(r.date).slice(0, 10) <= cr.to : r.week >= periodStart);
  const rowsAll = loadLog_().filter((r) => (inScope[r.teamId] || upperRowIn_(scope, r)) && (cr ? inPer(r) : r.week >= from));
  const rows = dd_(rowsAll);
  const inP = rows.filter(inPer);
  const inPAll = rowsAll.filter(inPer);
  const ok = (r) => r.mode !== MODE.none;
  const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
  const of = (type, arr) => (arr || inP).filter((r) => r.type === type);
  const nf = (v) => Math.round(v).toLocaleString('uk-UA');
  const df = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

  const clubs = of('club').filter(ok), mgs = of('mg').filter(ok), krs = of('kr').filter(ok);
  const knownTotal = teamIds.reduce((a, id) => a + (Number(st.team[id].known) || 0), 0) + selfKnown_(scope);
  const fin = rows.filter((r) => r.type === 'fin' && r.date.slice(0, 7) >= periodStart.slice(0, 7) && (!cr || r.date.slice(0, 7) <= cr.to.slice(0, 7)));
  // люди в командах: активні командні ролі
  const tRoles = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && inScope[r.unitId]);
  const peopleIn = (ids) => { const set = {}; ids.forEach((id) => { set[id] = true; }); return uniq_(tRoles.filter((r) => set[r.unitId]).map((r) => r.tgId)).length; };
  const uRoles = scope.level === 'team' ? [] : loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level !== 'team' && r.key !== 'SUPER' && (r.level !== 'nat' || scope.level === 'nat') && upperIn_(scope, r));
  const officeIn = (key) => { const u = keyUnit_(key); return uniq_(uRoles.filter((r) => within_(u, r)).map((r) => r.tgId)); };
  const pplTotal = uniq_(tRoles.map((r) => r.tgId).concat(uRoles.map((r) => r.tgId))).length;
  const pplTeams = uniq_(tRoles.map((r) => r.tgId)).length;
  const pplNew = uniq_(tRoles.filter((r) => String(r.requested).slice(0, 10) >= periodStart && (!cr || String(r.requested).slice(0, 10) <= cr.to)).map((r) => r.tgId)).length;
  const pplRank = (max) => uniq_(tRoles.filter((r) => r.rank <= max).map((r) => r.tgId)).length;
  const K = {
    people: scope.level === 'team' ? [[nf(pplTeams), 'Людей у команді'], [nf(pplRank(RANK.MG)), 'Лідерів і вище'], [nf(pplNew), 'Нових за період']]
      : [[nf(pplTotal), 'Людей усього'], [nf(pplTeams), 'У командах'], [nf(uniq_(uRoles.map((r) => r.tgId)).length), 'В офісі ерій і регіонів'], [nf(teamIds.length), teamIds.length === 1 ? 'Команда' : 'Команд'], [teamIds.length ? df(pplTeams / teamIds.length) : '—', 'Середньо в команді'], [nf(pplNew), 'Нових за період']],
    overview: [[nf(clubs.length), 'Клубів'], [nf(sum(clubs, (r) => r.count)), 'Підлітків на клубах'], [nf(mgs.length), 'Зустрічей малих груп'], [df(sum(krs, (r) => r.hours)), 'Годин контактної роботи']],
    club: [[nf(clubs.length), 'Клубів проведено'], [nf(sum(clubs, (r) => r.count)), 'Відвідувань підлітків'], [clubs.length ? df(sum(clubs, (r) => r.count) / clubs.length) : '—', 'Середньо на клубі'], [nf(sum(clubs, (r) => r.newT)), 'Нових підлітків']],
    mg: [[nf(mgs.length), 'Зустрічей малих груп'], [nf(sum(mgs, (r) => r.count)), 'Відвідувань'], [mgs.length ? df(sum(mgs, (r) => r.count) / mgs.length) : '—', 'Середньо на зустрічі'], [nf(sum(mgs, (r) => r.newT)), 'Нових учасників']],
    kr: [[df(sum(krs, (r) => r.hours)), 'Годин контактної роботи'], [df(sum(krs, (r) => r.hours) / P), 'Годин у середньому за тиждень'], [nf(uniq_(krs.map((r) => r.authorId)).length), 'Людей вносили КР'], [nf(of('kr').filter((r) => !ok(r)).length), 'Відміток «не було»']],
    known: [[nf(knownTotal), 'Знаних по імені'], [nf(of('known').length), 'Нових за період']].concat(STAGES.map((x) => [nf(stageSum_(teamIds, x[0]) + selfKnown_(scope, x[0])), x[1]])),
    finance: [[nf(sum(fin, (r) => r.inc)) + ' ₴', 'Надійшло'], [nf(sum(fin, (r) => r.spent)) + ' ₴', 'Витрачено'], [nf(sum(fin, (r) => r.inc - r.spent)) + ' ₴', 'Різниця'], [nf(uniq_(fin.map((r) => r.teamId)).length), 'Команд здали звіт']],
  };
  { const par = sum(clubs, (r) => r.parents); if (par) K.club.push([nf(par), 'Батьків на клубах (Capernaum)']); }
  const metric = {
    overview: (r) => (r.type === 'club' && ok(r) ? r.count : 0), club: (r) => (r.type === 'club' && ok(r) ? r.count : 0),
    mg: (r) => (r.type === 'mg' && ok(r) ? r.count : 0), kr: (r) => (r.type === 'kr' ? r.hours : 0),
    known: (r) => (r.type === 'known' ? 1 : 0), finance: (r) => (r.type === 'fin' ? r.inc : 0), people: () => 0,
  }[cat];
  const titles = { people: 'Ролі в командах', overview: 'Підлітки на клубах', club: 'Підлітки на клубах', mg: 'Учасники малих груп', kr: 'Години контактної роботи', known: 'Нові знані по імені', finance: 'Надходження, ₴' };
  const buckets = [];
  const byKey = {};
  if (byMonth) {
    const ML = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    const cur = cr ? cr.to : kyivDay(new Date());
    let y = Number(cur.slice(0, 4)), m = Number(cur.slice(5, 7));
    const firstM = cr ? cr.from.slice(0, 7) : '';
    const tmp = [];
    for (let i = 0; i < (cr ? 60 : 12); i++) {
      const key = y + '-' + String(m).padStart(2, '0');
      if (cr && key < firstM) break;
      tmp.unshift({ key: key, label: ML[m - 1] + (cr && cr.days > 366 ? ' ' + String(y).slice(2) : ''), v: 0 });
      m--; if (!m) { m = 12; y--; }
    }
    tmp.forEach((b) => { buckets.push(b); byKey[b.key] = b; });
    rows.forEach((r) => { const b = byKey[String(r.date).slice(0, 7)]; if (b) b.v += Number(metric(r)) || 0; });
  } else {
    for (let k = chartStart; k <= chartEnd; k = addDaysKey_(k, 7)) { const b = { key: k, label: k.slice(8, 10) + '.' + k.slice(5, 7), v: 0 }; buckets.push(b); byKey[k] = b; }
    rows.forEach((r) => { const b = byKey[r.week]; if (b) b.v += Number(metric(r)) || 0; });
    // одна команда, клуби: підпис стовпчика — день, коли клуб відбувся (а не початок тижня)
    if (scope.level === 'team' && (cat === 'club' || cat === 'overview')) {
      rows.filter((r) => r.type === 'club' && r.mode === MODE.event && byKey[r.week]).forEach((r) => { const b = byKey[r.week]; if (!b.day || r.date > b.day) { b.day = r.date; b.label = r.date.slice(8, 10) + '.' + r.date.slice(5, 7); } });
    }
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
    const v = cat === 'people' ? (g.count != null ? g.count : g.key && g.key.indexOf('t:') !== 0 ? uniq_(tRoles.filter((r) => g.teams.indexOf(r.unitId) >= 0).map((r) => r.tgId).concat(officeIn(g.key))).length : peopleIn(g.teams)) : cat === 'known' ? g.teams.reduce((a, id) => a + (Number(st.team[id].known) || 0), 0) + (g.key && g.key.indexOf('t:') !== 0 ? selfKnown_(Object.assign(keyUnit_(g.key), {}), '') : 0) : sum(dd_(inPAll.filter(g.test)), metric);
    const row = { name: g.name, value: v, text: cat === 'kr' ? df(v) : nf(v), drill: g.key && scopeKeys[g.key] ? g.key : '' };
    if (g.key && g.key.indexOf('t:') === 0) row.teamId = g.key.slice(2);
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

  // «хто не здав» — лише клуби: МГ і КР — особиста лідерська робота
  const report = ['club'].map((type) => {
    const m = weekReport_(scope, type, teamIds);
    return { type: type, label: { club: 'Клуби', mg: 'Малі групи', kr: 'Контактна робота' }[type], ok: m.ok, none: m.none, total: m.total, unit: m.unit, missing: m.missingNames };
  });

  // кількість на кінець кожного тижня/місяця — як змінювалась за період (люди в командах, знані)
  let trend = null;
  if (cat === 'people' || cat === 'known') {
    const today = kyivDay(new Date());
    const ends = buckets.map((b) => {
      let e = byMonth ? (() => { const y = Number(b.key.slice(0, 4)), m = Number(b.key.slice(5, 7)); return b.key + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0'); })() : addDaysKey_(b.key, 6);
      if (e > today) e = today;
      return e;
    });
    let at;
    if (cat === 'people') {
      const all = loadRoles_().filter((r) => r.level === 'team' && inScope[r.unitId] && (r.status === ST.ACTIVE || (r.status === ST.REMOVED && r.decided)));
      at = (day) => uniq_(all.filter((r) => String(r.requested || r.decided || '').slice(0, 10) <= day && (r.status === ST.ACTIVE || String(r.decided).slice(0, 10) > day)).map((r) => r.tgId || 'r:' + r.id)).length;
    } else {
      const inSc = (r) => inScope[r.teamId] || upperRowIn_(scope, r);
      const added = loadLog_().filter((r) => r.type === 'known' && inSc(r)).map((r) => r.date);
      const gone = loadKnownGone_().filter(inSc);
      at = (day) => knownTotal - added.filter((d) => d > day).length + gone.filter((g) => g.added <= day && g.gone > day).length;
    }
    const pts = buckets.map((b, i) => ({ label: b.label, v: Math.max(0, at(ends[i])) }));
    if (pts.length) {
      const startDay = addDaysKey_(cr ? cr.from : byMonth ? buckets[0].key + '-01' : buckets[0].key, -1);
      const v0 = Math.max(0, at(startDay));
      trend = { title: cat === 'people' ? 'Скільки людей у командах' : 'Скільки знаних по імені', sub: 'на кінець кожного ' + (byMonth ? 'місяця' : 'тижня'),
        from: v0, to: pts[pts.length - 1].v, delta: pts[pts.length - 1].v - v0, points: pts };
    }
  }
  const roleBars = ROLES.filter((x) => x.level === 'team').map((x) => ({ label: { CAPTAIN: 'Кап', TEAM_ADMIN: 'Адм', DGL: 'DGL', LEADER: 'Лід', HELPER: 'Пом', SUGAR: 'Сах', VOLUNTEER: 'Вол' }[x.key] || x.label.slice(0, 3), v: uniq_(tRoles.filter((r) => r.key === x.key).map((r) => r.tgId)).length }));
  if (uRoles.length) roleBars.push({ label: 'Офіс', v: uniq_(uRoles.map((r) => r.tgId)).length });
  return {
    scope, scopes, cats, cat, period, range: cr,
    kpis: K[cat].map((k) => ({ v: k[0], l: k[1] })),
    chart: cat === 'people' ? { title: titles[cat], sub: 'Капітан · Адмін · DGL · Лідер · Помічник · Сахарок · Волонтер' + (uRoles.length ? ' · Офіс (ролі ерій і регіонів)' : ''), bars: roleBars }
      : { title: titles[cat], sub: scope.level === 'team' && (cat === 'club' || cat === 'overview') && !byMonth ? 'по клубах — дата, коли клуб відбувся' + (cr ? '' : ', останні ' + chartWeeks + ' тижнів') : cr ? (byMonth ? 'по місяцях' : 'по тижнях') + ' · ' + fmtDue_(cr.from) + ' ' + cr.from.slice(0, 4) + ' – ' + fmtDue_(cr.to) + ' ' + cr.to.slice(0, 4) : period === 'year' ? 'по місяцях, останні 12' : 'по тижнях, останні ' + buckets.length, bars: buckets.map((b) => ({ label: b.label, v: b.v })) },
    trend,
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
    const people = eligiblePeople_(scope.unitId, 'rep.' + type);
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
  if (m.missingIds) return { people: m.missingIds };
  const ids = {};
  (m.missingTeams || []).forEach((teamId) => eligiblePeople_(teamId, 'rep.' + type).forEach((p) => { ids[p.tgId] = true; }));
  return { people: Object.keys(ids) };
}

function eligiblePeople_(teamId, perm) {
  const by = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId && isReal_(r.tgId) && okR_(r, perm))
    .forEach((r) => { by[r.tgId] = { tgId: r.tgId, name: (getPerson_(r.tgId) || {}).name || r.name }; });
  return Object.keys(by).map((k) => by[k]);
}

function weekStatus_(c) {
  const st = loadStruct_();
  const wk = weekKey_(new Date());
  const rows = loadLog_().filter((r) => r.week === wk);
  const teams = {};
  c.roles.filter((r) => r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active).forEach((r) => { (teams[r.unitId] = teams[r.unitId] || []).push(r); });
  const items = [];
  const many = Object.keys(teams).length > 1;
  Object.keys(teams).forEach((teamId) => {
    const add = (type, perTeam) => {
      const mine = rows.filter((r) => r.type === type && r.teamId === teamId && (perTeam || r.authorId === c.id));
      const status = mine.some((r) => r.mode !== MODE.none) ? 'ok' : mine.length ? 'none' : 'missing';
      const hours = type === 'kr' ? mine.reduce((a, r) => a + (Number(r.hours) || 0), 0) : 0;
      items.push({ type, teamId, label: TYPE_LABEL[type] + (many ? ' · ' + st.team[teamId].name : ''), status, hours });
    };
    if (teams[teamId].some((r) => okR_(r, 'rep.club'))) add('club', true);
  });
  // МГ і КР — особисті: один пункт на людину, незалежно від кількості команд
  const own = Object.keys(teams);
  const addOwn = (type, perm) => {
    const tid = own.filter((id) => teams[id].some((r) => okR_(r, perm)))[0] || (upperSelfUnit_(P_(c, perm)) ? '' : null);
    if (tid == null) return;
    const mine = dd_(rows.filter((r) => r.type === type && r.authorId === c.id));
    const status = mine.some((r) => r.mode !== MODE.none) ? 'ok' : mine.length ? 'none' : 'missing';
    items.push({ type: type, teamId: tid, label: TYPE_LABEL[type], status: status, hours: type === 'kr' ? mine.reduce((a, r) => a + (Number(r.hours) || 0), 0) : 0 });
  };
  addOwn('mg', 'rep.mg');
  addOwn('kr', 'rep.kr');
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
    return (person && person.name) || (top && top.name) || '';
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
  if (mine.some((r) => r.key === top.key)) return sendApp_(m.chat.id, 'У тебе вже є повний доступ 🙂', 'Відкрити Young Life');
  const nats = mine.filter((r) => r.key === 'NATIONAL_ADMIN');
  nats.slice(1).forEach((r) => setRoleStatus_(r, ST.REMOVED, 'посилання власника'));
  if (nats[0]) {
    S.run('UPDATE roles SET role_key = ?, decided_by = ?, decided = ? WHERE id = ?', [top.key, 'посилання власника', nowIso(), nats[0].id], true);
  } else {
    insertRole_({ id: uid_(), tgId: c.id, name: c.name, key: top.key, level: 'nat', unitId: '', status: ST.ACTIVE, decidedBy: 'посилання власника', decided: nowIso() });
  }
  return sendApp_(m.chat.id, '✅ Готово! У тебе повний доступ до MyYL.', 'Відкрити Young Life');
}

const appLink_ = () => (S.env.APP_URL || '').replace(/\?.*$/, '') + '?app=1';
// головний застосунок бота (BotFather → Configure Mini App): лише з нього Telegram дає «Додати на головний екран»
const BOT_NAME_ = () => S.env.BOT_USERNAME || 'MyYL_mini_app';
const mainLink_ = (screen) => 'https://t.me/' + BOT_NAME_() + '?startapp=' + (screen || 'home');
const homeLink_ = () => mainLink_() + '&addToHomeScreen';
function sendWelcome_(chatId) {
  S.send(chatId, 'Привіт! Це MyYL — застосунок Young Life Україна 💙💛\nЗвіти, знані по імені, календар і статистика — тут 👇\n\n📲 Хочеш іконку YL на головному екрані телефону? Натисни «Додати на головний екран».', { reply_markup: { inline_keyboard: [
    [{ text: 'Відкрити MyYL', url: mainLink_() }],
    [{ text: '📲 Додати на головний екран', url: homeLink_() }],
  ] } });
}
function sendInstall_(chatId) {
  S.send(chatId, '📲 <b>Іконка MyYL на головному екрані</b>\n\nНайпростіше: натисни кнопку нижче — Telegram відкриє MyYL і запропонує «Додати на головний екран». Або в MyYL натисни ⋯ вгорі праворуч → «Add to Home Screen».\n\n<b>Окремий застосунок без Telegram</b>\n<b>iPhone:</b> відкрий посилання в Safari → «Поділитися» → «На початковий екран» → «Додати».\n<b>Android:</b> відкрий у Chrome → меню ⋮ → «Встановити застосунок».\n\nПотім відкрий MyYL з іконки й натисни «Увійти через Telegram».', { reply_markup: { inline_keyboard: [[{ text: '📲 Додати на головний екран', url: homeLink_() }], [{ text: '🌐 Окремий застосунок (браузер)', url: appLink_() }]] } });
}

function sendApp_(chatId, text, button, screen) {
  S.send(chatId, text, { reply_markup: { inline_keyboard: [[{ text: button || 'Відкрити', url: mainLink_(screen) }]] } });
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
    const miss = weekStatus_({ id: id, roles: by[id] }).items.filter((x) => x.status === 'missing' && x.type === 'club');
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
    [].concat.apply([], loadEvents_().map((s0) => repeatDates_(s0, day, day).map((dd) => occurrence_(s0, dd)))).forEach((e) => {
      S.rsvp.filter((r) => r.eventId === e.id && wants_(r.tgId, 'events')).forEach((r) => {
        sendApp_(r.tgId, '📅 ' + (n === 1 ? 'Завтра' : 'Через ' + n + ' дні') + ': <b>' + esc_(e.title) + '</b>\n' + esc_([e.time, e.place].filter(Boolean).join(' · ')), 'Деталі', 'calendar');
      });
    });
  });
}

// ───────────────────────────── СЛУЖБОВЕ: БОТ, ІМПОРТ, СИНХРОНІЗАЦІЯ З ДИСКОМ ─────────────────────────────

async function sha256hex_(text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function decryptSeed_(b64, secret) {
  const raw = Uint8Array.from(atob(b64.replace(/\s+/g, '')), (ch) => ch.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12));
  return new TextDecoder().decode(plain);
}
// [{ area: ['Чернівці У', …], team: 'Volt', people: [['Імʼя Прізвище', 'LEADER'], …] }]
const na_ = (x) => String(x || '').toLowerCase().replace(/[^a-zа-яіїєґ0-9]/gi, '');
function findArea_(aliases) {
  const al = [].concat(aliases || []).map(na_);
  return loadStruct_().areas.filter((a) => al.indexOf(na_(a.name)) >= 0)[0] || null;
}
// назви команд у табличках і в MyYL можуть трохи відрізнятись («Young Life HLYNA» / «HLYNA»)
function findTeamIn_(areaId, name) {
  const core = (x) => na_(String(x).toLowerCase().replace(/\b(young|life|wyld|wild|yl|teens|new)\b/g, ' ')) || na_(x);
  const inArea = loadStruct_().teams.filter((x) => x.areaId === areaId);
  return inArea.filter((x) => na_(x.name) === na_(name))[0] || inArea.filter((x) => core(x.name) === core(name))[0] ||
    inArea.filter((x) => core(x.name).length >= 4 && core(name).length >= 4 && (core(x.name).indexOf(core(name)) >= 0 || core(name).indexOf(core(x.name)) >= 0))[0] || null;
}
// хто з команди (за імʼям у табличці) — щоб особисті записи МГ/КР і знані привʼязались до людини
function teamPerson_(teamId, name) {
  if (!name) return null;
  const cand = uniq_(loadRoles_().filter((r) => r.level === 'team' && r.unitId === teamId && r.status === ST.ACTIVE).map((r) => r.tgId))
    .map((id) => ({ id: id, name: (getPerson_(id) || {}).name || '' })).filter((p) => p.name && nameScore_(name, p.name).s >= 1);
  const best = cand.filter((p) => nameScore_(name, p.name).same);
  return best.length === 1 ? best[0] : cand.length === 1 ? cand[0] : null;
}
// історія з командної таблички: клуби, МГ, КР, знані, фінанси (те, що вже є в MyYL, не дублюється)
function importHistory_(team, t, ex) {
  const st = loadStruct_();
  const areaId = team.areaId, regionId = st.teamRegion(team.id);
  const now = nowIso();
  const has = {};
  ex.reports.forEach((r) => { has[r.type + '|' + r.date + '|' + (r.type === 'club' ? '' : r.author_id || r.author || '')] = 1; });
  const reps = [];
  const add = (type, d, o) => {
    const k = type + '|' + d + '|' + (type === 'club' ? '' : o.author_id || o.author || '');
    if (has[k]) return false;
    has[k] = 1;
    reps.push(Object.assign({ id: uid_(), created: now, date: d, week: weekKey_(d), type: type, mode: MODE.event, team_id: team.id, area_id: areaId, region_id: regionId, count: 0, new_t: 0, leaders: 0, hours: 0, topic: '', note: '', author_id: '', author: 'Командна табличка', pid: type === 'club' ? null : uid_() }, o));
    return true;
  };
  const res = { club: 0, mg: 0, kr: 0, known: 0, fin: 0, unknownAuthors: 0 };
  (t.club || []).forEach((c) => { if (add('club', c[0], { mode: c[1] || c[2] ? MODE.event : MODE.none, count: c[1] || 0, leaders: c[2] || 0, topic: clip_(c[3] || '').slice(0, 200), note: clip_(c[4] || '').slice(0, 300) })) res.club++; });
  (t.mg || []).forEach((m) => {
    const p = teamPerson_(team.id, m[2]);
    if (!p) res.unknownAuthors++;
    if (add('mg', m[0], { count: m[1] || 0, author_id: p ? p.id : '', author: p ? p.name : m[2] || m[3] || 'Командна табличка', note: clip_(m[3] || '').slice(0, 200) })) res.mg++;
  });
  (t.kr || []).forEach((k) => {
    const p = teamPerson_(team.id, k[2]);
    if (!p) res.unknownAuthors++;
    if (add('kr', k[0], { hours: k[1] || 0, author_id: p ? p.id : '', author: p ? p.name : k[2] || 'Командна табличка' })) res.kr++;
  });
  if (reps.length) {
    S.run("INSERT INTO reports (id, created, date, week, type, mode, team_id, area_id, region_id, count, new_t, leaders, hours, topic, note, author_id, author, pid) " +
      "SELECT json_extract(value, '$.id'), json_extract(value, '$.created'), json_extract(value, '$.date'), json_extract(value, '$.week'), json_extract(value, '$.type'), json_extract(value, '$.mode'), " +
      "json_extract(value, '$.team_id'), json_extract(value, '$.area_id'), json_extract(value, '$.region_id'), json_extract(value, '$.count'), json_extract(value, '$.new_t'), json_extract(value, '$.leaders'), " +
      "json_extract(value, '$.hours'), json_extract(value, '$.topic'), json_extract(value, '$.note'), json_extract(value, '$.author_id'), json_extract(value, '$.author'), json_extract(value, '$.pid') FROM json_each(?)", [JSON.stringify(reps)]);
  }
  // знані: етап «Дружимо» — їх уже знають по імені
  const seen = {};
  ex.known.forEach((k) => { seen[na_(k.name)] = 1; });
  const kn = [];
  (t.known || []).forEach((k) => {
    const n = clip_(k[0]).slice(0, 80);
    if (!n || seen[na_(n)]) return;
    seen[na_(n)] = 1;
    const p = teamPerson_(team.id, k[1]);
    kn.push({ id: uid_(), n: n, a: p ? p.id : '', l: p ? p.name : k[1] || '' });
  });
  if (kn.length) {
    S.run("INSERT INTO known (id, team_id, name, added, active, updated, stage, author_id, phone, ig, bday, school, grade, leader, note) " +
      "SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.n'), ?, 1, ?, 'friends', json_extract(value, '$.a'), '', '', '', '', '', json_extract(value, '$.l'), '' FROM json_each(?)",
    [team.id, '2024-01-01', now, JSON.stringify(kn)]);
    S.run('UPDATE teams SET known = (SELECT COUNT(*) FROM known WHERE team_id = ? AND active = 1) WHERE id = ?', [team.id, team.id], true);
    res.known = kn.length;
  }
  // фінанси: лише місяці, яких ще немає в MyYL
  const months = {};
  ex.finance.forEach((f) => { months[f.month] = 1; });
  const fin = (t.fin || []).filter((f) => { if (months[f[0]]) return false; months[f[0]] = 1; return true; }).map((f) => ({ m: f[0], p: f[1], o: f[2], t: f[3], s: f[4], b: f[5] }));
  if (fin.length) {
    S.run("INSERT OR IGNORE INTO finance (team_id, month, prev, office, church, team, spent, balance, author, updated) SELECT ?, json_extract(value, '$.m'), json_extract(value, '$.p'), json_extract(value, '$.o'), 0, " +
      "json_extract(value, '$.t'), json_extract(value, '$.s'), json_extract(value, '$.b'), 'Командна табличка', ? FROM json_each(?)", [team.id, now, JSON.stringify(fin)]);
    res.fin = fin.length;
  }
  return res;
}
function importMembers_(list) {
  const st = loadStruct_();
  const na = na_;
  const totals = { added: 0, linked: 0, dup: 0, bad: 0, teamsCreated: 0 };
  const missingAreas = [];
  const teams = [];
  list.forEach((t) => {
    const aliases = [].concat(t.area || []).map(na);
    const area = st.areas.filter((a) => aliases.indexOf(na(a.name)) >= 0)[0];
    if (!area) { if (missingAreas.indexOf(String([].concat(t.area)[0])) < 0) missingAreas.push(String([].concat(t.area)[0])); return; }
    // назви команд у табличках і в MyYL можуть трохи відрізнятись («Young Life HLYNA» / «HLYNA»)
    const core = (x) => na(String(x).toLowerCase().replace(/\b(young|life|wyld|wild|yl|teens|new)\b/g, ' ')) || na(x);
    const inArea = st.teams.filter((x) => x.areaId === area.id);
    let team = inArea.filter((x) => na(x.name) === na(t.team))[0] || inArea.filter((x) => core(x.name) === core(t.team))[0] ||
      inArea.filter((x) => core(x.name).length >= 4 && core(t.team).length >= 4 && (core(x.name).indexOf(core(t.team)) >= 0 || core(t.team).indexOf(core(x.name)) >= 0))[0];
    const row = { area: area.name, team: t.team, matched: team ? team.name : '', created: false, added: 0, linked: 0, dup: 0, bad: 0 };
    if (!team && !(t.people || []).length) return;
    if (!team) { team = st.team[createTeam_(area.id, t.team, true)]; row.created = true; totals.teamsCreated++; }
    else activateTeam_(team.id);
    (t.people || []).forEach((p) => {
      if (!roleDef_(p[1]) || roleDef_(p[1]).level !== 'team') { row.bad++; totals.bad++; return; }
      const r = addMember_('Командна табличка', team.id, p[0], p[1]);
      row[r]++; totals[r]++;
    });
    teams.push(row);
  });
  return { totals: totals, missingAreas: missingAreas, teams: teams };
}

// люди з альбому YL Pray: склад команд, ролі в еріях і регіоні + анкета (Instagram, Telegram, ДН, телефон, родина)
// [{ name, unit: 'team'|'area'|'region', region: [..], area: [..], team, key, title, bday, ig, tg, phone, family, also: [{ unit, region, area, team, key }] }]
function importPray_(list) {
  const st = loadStruct_();
  const out = { rows: list.length, people: { found: 0, created: 0 }, roles: { added: 0, had: 0, skipped: 0 }, fields: {}, teamsCreated: [], missing: [], linkedByTg: 0 };
  const miss = (x) => { if (out.missing.indexOf(x) < 0) out.missing.push(x); };
  const findRegion = (al) => { const a = [].concat(al || []).map(na_); return st.regions.filter((r) => a.indexOf(na_(r.name)) >= 0)[0] || (st.regions.length === 1 ? st.regions[0] : null); };
  const areaOfUnit = (r) => (r.level === 'team' ? (st.team[r.unitId] || {}).areaId : r.level === 'area' ? r.unitId : '');
  const place = (e) => {
    const def = roleDef_(e.key);
    if (!def) return null;
    if (e.unit === 'region') { const rg = findRegion(e.region); if (!rg) { miss('регіон ' + [].concat(e.region)[0]); return null; } return { key: e.key, level: 'region', unitId: rg.id, areaId: '' }; }
    const a = findArea_(e.area);
    if (!a) { miss('ерія ' + [].concat(e.area)[0]); return null; }
    if (e.unit === 'area') return def.level === 'area' ? { key: e.key, level: 'area', unitId: a.id, areaId: a.id } : null;
    if (def.level !== 'team') return null;
    let t = findTeamIn_(a.id, e.team);
    if (!t) { t = st.team[createTeam_(a.id, e.team, true)]; out.teamsCreated.push(a.name + ' · ' + e.team); }
    return { key: e.key, level: 'team', unitId: t.id, areaId: a.id };
  };
  const personIn = (name, pl) => {
    const roles = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
    const here = uniq_(roles.filter((r) => r.level === pl.level && r.unitId === pl.unitId).map((r) => r.tgId)).filter((id) => nameScore_(name, (getPerson_(id) || {}).name || '').same);
    if (here.length === 1) return here[0];
    const exact = Object.keys(S.b.people).filter((id) => nameScore_(name, S.b.people[id].name).exact);
    const near = exact.filter((id) => roles.some((r) => r.tgId === id && pl.areaId && areaOfUnit(r) === pl.areaId));
    if (near.length === 1) return near[0];
    if (exact.length === 1) return exact[0];
    // те саме імʼя з незначною різницею — лише якщо людина вже в цій ерії
    const sim = Object.keys(S.b.people).filter((id) => nameScore_(name, S.b.people[id].name).same && roles.some((r) => r.tgId === id && pl.areaId && areaOfUnit(r) === pl.areaId));
    return sim.length === 1 ? sim[0] : null;
  };
  const giveRole = (id, pl) => {
    const has = loadRoles_().filter((r) => r.tgId === id && r.level === pl.level && r.unitId === pl.unitId && (r.status === ST.ACTIVE || r.status === ST.PENDING));
    if (has.some((r) => r.key === pl.key || r.status === ST.ACTIVE)) { out.roles.had++; return; }
    insertRole_({ id: uid_(), tgId: id, name: (getPerson_(id) || {}).name || '', key: pl.key, level: pl.level, unitId: pl.unitId, status: ST.ACTIVE, decidedBy: 'YL Pray', decided: nowIso(), requested: nowIso() });
    if (pl.level === 'team') activateTeam_(pl.unitId);
    out.roles.added++;
  };
  list.forEach((row) => {
    const name = clip_(String(row.name || '').replace(/\s+/g, ' ').trim()).slice(0, 80);
    if (nameToks_(name).length < 2) { out.roles.skipped++; return; }
    const main = place(row);
    const alsoPl = (row.also || []).map(place).filter(Boolean);
    const first = main || alsoPl[0];
    if (!first) { out.roles.skipped++; return; }
    let id = personIn(name, first);
    if (id) out.people.found++;
    else {
      id = 'm:' + uid_();
      S.run('INSERT INTO people (tg_id, name, registered) VALUES (?,?,?)', [id, name, ''], true);
      S.b.people[id] = personFromRow({ tg_id: id, name: name });
      out.people.created++;
    }
    [main].concat(alsoPl).filter(Boolean).forEach((pl) => giveRole(id, pl));
    const got = fillPerson_(id, { phone: row.phone, bday: row.bday, ig: row.ig ? igNorm_(row.ig) : '', family: row.family, title: row.title, username: String(row.tg || '').replace(/^@/, '') }, false);
    got.forEach((k) => { out.fields[k] = (out.fields[k] || 0) + 1; });
  });
  out.linkedByTg = linkPlaceholders_();
  return out;
}

// перенести склад команди t у best (лише ролі: команди без звітів), дублі людей обʼєднати, t видалити
function mergeTeamInto_(t, best) {
  const live = () => loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const nm = (id) => (getPerson_(id) || {}).name || '';
  let moved = 0, merged = 0;
  live().filter((r) => r.level === 'team' && r.unitId === t.id).forEach((r) => {
    const theirs = live().filter((x) => x.level === 'team' && x.unitId === best.id);
    const twin = uniq_(theirs.map((x) => x.tgId)).filter((o) => o === r.tgId || nameScore_(nm(r.tgId), nm(o)).same);
    if (twin.length === 1 && twin[0] !== r.tgId && !isReal_(r.tgId) && !live().some((x) => x.tgId === r.tgId && x.id !== r.id)) {
      fillPerson_(twin[0], getPerson_(r.tgId) || {}, false);
      r.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, r.id], true);
      S.run('DELETE FROM people WHERE tg_id = ?', [r.tgId], true); delete S.b.people[r.tgId];
      merged++; return;
    }
    if (twin.length === 1 && twin[0] === r.tgId) { r.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, r.id], true); merged++; return; }
    r.unitId = best.id; S.run('UPDATE roles SET unit_id = ? WHERE id = ?', [best.id, r.id], true); moved++;
  });
  // звіти, знані, фінанси й події — теж у цільову команду (у створених імпортом їх немає, але про всяк випадок)
  const reg = loadStruct_().teamRegion(best.id);
  S.run('UPDATE reports SET team_id = ?, area_id = ?, region_id = ? WHERE team_id = ?', [best.id, best.areaId, reg, t.id]);
  S.run('UPDATE known SET team_id = ? WHERE team_id = ?', [best.id, t.id]);
  S.run('UPDATE OR IGNORE finance SET team_id = ? WHERE team_id = ?', [best.id, t.id]);
  S.run('DELETE FROM finance WHERE team_id = ?', [t.id]);
  S.run("UPDATE events SET unit_id = ? WHERE level = 'team' AND unit_id = ?", [best.id, t.id]);
  S.run('DELETE FROM teams WHERE id = ?', [t.id], true);
  S.b.teams = S.b.teams.filter((x) => x.id !== t.id); delete S.b.team[t.id];
  activateTeam_(best.id);
  return { moved: moved, merged: merged };
}
// одна людина двома записами в межах ерії (напр. «Суботін Данило» і «Данило Субботін») — обʼєднати в один, ролі зберегти
function mergePeopleByName_(areaName, name) {
  const st = loadStruct_();
  const a = st.areas.filter((x) => x.name === areaName)[0];
  if (!a) return { name: '?', error: 'немає ерії' };
  const units = [a.id].concat(st.teams.filter((x) => x.areaId === a.id).map((x) => x.id));
  const live = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const ids = uniq_(live.filter((r) => units.indexOf(r.unitId) >= 0).map((r) => r.tgId)).filter((id) => nameScore_(name, (getPerson_(id) || {}).name || '').same);
  const real = ids.filter(isReal_);
  if (ids.length < 2 || real.length > 1) return { found: ids.length, error: ids.length < 2 ? 'немає дубля' : 'двоє зареєстрованих' };
  const keep = real[0] || ids.slice().sort((x, y) => FILL_.filter((k) => (getPerson_(y) || {})[k]).length - FILL_.filter((k) => (getPerson_(x) || {})[k]).length)[0];
  let moved = 0;
  ids.filter((id) => id !== keep).forEach((id) => {
    live.filter((r) => r.tgId === id).forEach((r) => {
      const dup = loadRoles_().some((x) => x.tgId === keep && x.key === r.key && x.unitId === r.unitId && (x.status === ST.ACTIVE || x.status === ST.PENDING));
      if (dup) { r.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, r.id], true); return; }
      r.tgId = keep; S.run('UPDATE roles SET tg_id = ?, name = ? WHERE id = ?', [keep, (getPerson_(keep) || {}).name || '', r.id], true); moved++;
    });
    fillPerson_(keep, getPerson_(id) || {}, false);
    S.run('DELETE FROM people WHERE tg_id = ?', [id], true); delete S.b.people[id];
  });
  return { found: ids.length, moved: moved };
}
// у кожній ерії: записи, що збігаються повністю (з урахуванням «Оля» = «Ольга», «Суботін» = «Субботін») — обʼєднати
function autoMergePeople_() {
  const st = loadStruct_();
  const done = [];
  st.areas.forEach((a) => {
    const units = [a.id].concat(st.teams.filter((x) => x.areaId === a.id).map((x) => x.id));
    const live = loadRoles_().filter((r) => (r.status === ST.ACTIVE || r.status === ST.PENDING) && units.indexOf(r.unitId) >= 0);
    const ids = uniq_(live.map((r) => r.tgId));
    const nm = (id) => (getPerson_(id) || {}).name || '';
    const seen = {};
    ids.forEach((x) => {
      if (seen[x] || !getPerson_(x)) return;
      const grp = [x].concat(ids.filter((y) => y !== x && !seen[y] && getPerson_(y) && nameScore_(nm(x), nm(y)).alike));
      if (grp.length < 2) return;
      grp.forEach((y) => { seen[y] = 1; });
      if (grp.filter(isReal_).length > 1) return;
      const names = grp.map(nm);
      const r = mergeIds_(grp);
      done.push({ area: a.name, names: names, keep: nm(r) });
    });
  });
  return done;
}
// обʼєднати кілька записів однієї людини: лишається зареєстрований або найповніший
function mergeIds_(ids) {
  const live = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const real = ids.filter(isReal_);
  const keep = real[0] || ids.slice().sort((x, y) => FILL_.filter((k) => (getPerson_(y) || {})[k]).length - FILL_.filter((k) => (getPerson_(x) || {})[k]).length)[0];
  ids.filter((id) => id !== keep).forEach((id) => {
    live.filter((r) => r.tgId === id).forEach((r) => {
      const dup = loadRoles_().some((x) => x.tgId === keep && x.key === r.key && x.unitId === r.unitId && (x.status === ST.ACTIVE || x.status === ST.PENDING));
      if (dup) { r.status = ST.REMOVED; S.run('UPDATE roles SET status = ? WHERE id = ?', [ST.REMOVED, r.id], true); return; }
      r.tgId = keep; S.run('UPDATE roles SET tg_id = ?, name = ? WHERE id = ?', [keep, (getPerson_(keep) || {}).name || '', r.id], true);
    });
    fillPerson_(keep, getPerson_(id) || {}, false);
    S.run('DELETE FROM people WHERE tg_id = ?', [id], true); delete S.b.people[id];
  });
  return keep;
}
// усі записи цієї людини в будь-яких еріях (повне збігання з урахуванням коротких імен) — в один
function mergeAll_(name) {
  const ids = Object.keys(S.b.people).filter((id) => nameScore_(name, S.b.people[id].name).alike);
  if (ids.length < 2) return { found: ids.length, error: 'немає дубля' };
  if (ids.filter(isReal_).length > 1) return { found: ids.length, error: 'двоє зареєстрованих' };
  mergeIds_(ids);
  return { merged: ids.length };
}
// ── «Переглянути, як»: пошук людини (лише власник застосунку) ──
API.actAsFind = function (c, d) {
  if (!isSuper_(c) || c.actor) deny_();
  const q = String(d.q || '').trim().toLowerCase();
  if (q.length < 2) return { list: [] };
  const qp = phon_(q), byId = {};
  loadRoles_().filter((r) => r.status === ST.ACTIVE && isReal_(r.tgId) && r.tgId !== c.id).forEach((r) => { (byId[r.tgId] = byId[r.tgId] || []).push(r); });
  Object.keys(S.b.people).forEach((id) => { if (isReal_(id) && id !== c.id && !byId[id]) byId[id] = []; });
  const list = Object.keys(byId).map((id) => {
    const per = getPerson_(id) || {}, rs = byId[id].filter((r) => r.key !== 'SUPER').sort((a, b) => a.rank - b.rank);
    const name = per.name || (rs[0] && rs[0].name) || '';
    return { id: id, name: name, role: rs.length ? rs.slice(0, 2).map((r) => r.label + ' · ' + levelLabel_(r.level, r.unitId).replace(/^Команда /, '')).join(', ') : 'без ролі' };
  }).filter((x) => x.name && (x.name.toLowerCase().indexOf(q) >= 0 || phon_(x.name).indexOf(qp) >= 0)).sort((a, b) => a.name.localeCompare(b.name, 'uk')).slice(0, 25);
  return { list: list };
};
// ── «Повідомити про помилку»: пише кожен, читає власник ──
API.bugSend = function (c, d) {
  const text = clip_(d.text).slice(0, 3000);
  if (text.length < 3) bad_('Опиши, що сталося.');
  const b = { id: uid_(), tg_id: c.id, name: c.name, text: text, screen: clip_(d.screen).slice(0, 40), info: clip_(d.info).slice(0, 400), created: nowIso() };
  S.run('INSERT INTO bugs (id, tg_id, name, text, screen, info, created, done) VALUES (?,?,?,?,?,?,?,?)', [b.id, b.tg_id, b.name, b.text, b.screen, b.info, b.created, '']);
  const supers = uniq_(loadRoles_().filter((r) => r.key === 'SUPER' && r.status === ST.ACTIVE).map((r) => r.tgId));
  supers.forEach((id) => sendApp_(id, '🐞 <b>Помилка в MyYL</b> від ' + esc_(c.name) + (b.screen ? ' · екран «' + esc_(b.screen) + '»' : '') + '\n\n' + esc_(text), 'Відкрити повідомлення', 'bugs'));
  return { ok: true };
};
API.bugs = function (c) {
  if (!isSuper_(c)) deny_();
  return { list: (S.bugs || []).map((b) => ({ id: b.id, name: b.name, text: b.text, screen: b.screen, info: b.info, created: b.created, done: !!b.done })) };
};
API.bugDone = function (c, d) {
  if (!isSuper_(c)) deny_();
  const b = (S.bugs || []).filter((x) => x.id === str_(d.id))[0];
  if (!b) bad_('Не знайдено.');
  S.run('UPDATE bugs SET done = ? WHERE id = ?', [d.undo ? '' : nowIso(), b.id]);
  return { ok: true };
};
// ── «Можливі дублікати» (власник): схожі імена (і латиниця = кирилиця), хоча б один — не зареєстрований у боті або однакове імʼя ──
function dupPairs_() {
  const st = loadStruct_();
  const live = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const ids = uniq_(live.map((r) => r.tgId)).filter((id) => getPerson_(id) && getPerson_(id).name);
  const where = (id) => uniq_(live.filter((r) => r.tgId === id).map((r) => (r.level === 'team' ? (st.team[r.unitId] || {}).name || '?' : unitName_(r.level, r.unitId)))).slice(0, 3).join(', ');
  let skip = [];
  try { skip = JSON.parse(S.setting('DUPES_SKIP') || '[]'); } catch (e) { skip = []; }
  const buckets = {};
  ids.forEach((id) => uniq_(nameToks_(getPerson_(id).name).filter((t) => t.length >= 3).map((t) => phon_(surKey_(t)).slice(0, 4))).forEach((k) => { (buckets[k] = buckets[k] || []).push(id); }));
  const seen = {}, out = [];
  Object.keys(buckets).forEach((k) => {
    const b = buckets[k];
    if (b.length > 60) return;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const x = b[i], y = b[j];
      const key = [x, y].sort().join('|');
      if (seen[key] || skip.indexOf(key) >= 0) continue;
      seen[key] = 1;
      if (isReal_(x) && isReal_(y)) continue;
      const sc = nameScore_(getPerson_(x).name, getPerson_(y).name);
      if (!sc.alike) continue;
      out.push({ key: key, why: sc.exact ? 'однакове імʼя' : 'схоже імʼя', people: [x, y].map((id) => ({ id: id, name: getPerson_(id).name, where: where(id), real: isReal_(id) })) });
    }
  });
  return out.sort((a, b) => a.people[0].name.localeCompare(b.people[0].name)).slice(0, 80);
}
API.dupes = function (c) {
  if (!isSuper_(c)) deny_();
  return { list: dupPairs_() };
};
API.dupMerge = function (c, d) {
  if (!isSuper_(c)) deny_();
  const ids = (d.ids || []).map(String).filter((id) => getPerson_(id));
  if (ids.length !== 2 || ids[0] === ids[1]) bad_('Обери двох людей.');
  if (ids.every(isReal_)) bad_('Обидва вже в боті — їх не обʼєднати автоматично.');
  const keep = mergeIds_(ids);
  return { keep: keep, name: (getPerson_(keep) || {}).name || '' };
};
API.dupSkip = function (c, d) {
  if (!isSuper_(c)) deny_();
  const key = (d.ids || []).map(String).sort().join('|');
  let skip = [];
  try { skip = JSON.parse(S.setting('DUPES_SKIP') || '[]'); } catch (e) { skip = []; }
  if (skip.indexOf(key) < 0) skip.push(key);
  S.b.settings.DUPES_SKIP = JSON.stringify(skip.slice(-2000));
  S.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['DUPES_SKIP', S.b.settings.DUPES_SKIP], true);
  return { ok: true };
};
// явне обʼєднання: [«Яна Ковальчук», «Яніна Ковальчук»] — кожне імʼя має відповідати рівно одному запису
function mergeNames_(names) {
  const ids = [];
  for (const n of names) {
    const m = Object.keys(S.b.people).filter((id) => nameScore_(n, S.b.people[id].name).exact);
    if (m.length !== 1) return { names: names.length, error: m.length ? 'кілька записів з таким імʼям' : 'не знайдено' };
    if (ids.indexOf(m[0]) < 0) ids.push(m[0]);
  }
  if (ids.length < 2) return { error: 'це вже один запис' };
  if (ids.filter(isReal_).length > 1) return { error: 'двоє зареєстрованих' };
  mergeIds_(ids);
  return { merged: ids.length };
}
// однофамільці: пари людей з однаковим прізвищем (Степанов = Степанова, Вітовський = Вітовська)
const FIRST_ = new Set(('тарас данило денис олег ілля марко назар віктор вікторія яна христина діана аліна каріна злата мирослава мирослав остап орест ігор ігорь павло ' +
  'петро степан григорій георгій едуард кирило матвій давид даніїл даниїл адам вадим віталій вячеслав руслан артур ярема зіновій любомир лілія ліля маргарита рита ' +
  'інна емілія еліна евеліна мілана міла софія анастасія олеся леся віра неля нелля жанна алла вадим максим олексій лука марта уляна ульяна ева єва').split(' '));
function surKey_(t) {
  return t.replace(/ська$/, 'ський').replace(/цька$/, 'цький').replace(/зька$/, 'зький').replace(/ова$/, 'ов').replace(/єва$/, 'єв').replace(/ева$/, 'ев').replace(/іна$/, 'ін').replace(/ина$/, 'ин').replace(/ая$/, 'ий');
}
function namesakes_() {
  const st = loadStruct_();
  const live = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const where = (id) => uniq_(live.filter((r) => r.tgId === id).map((r) => (r.level === 'team' ? (st.team[r.unitId] || {}).name + ' (' + ((st.area[(st.team[r.unitId] || {}).areaId] || {}).name || '') + ')' : unitName_(r.level, r.unitId)) + ' — ' + r.label)).join('; ');
  const by = {};
  uniq_(live.map((r) => r.tgId)).forEach((id) => {
    const p = getPerson_(id); if (!p || !p.name) return;
    const toks = nameToks_(p.name).filter((t) => !/(івна|ївна|овна|евна|ович|йович|євич|евич)$/.test(t));
    let sur = toks.filter((t) => !NICK_MAP_[t] && !FIRST_.has(t));
    if (sur.length > 1 && toks.length >= 2) sur = sur.slice(0, 2);
    uniq_(sur.map(surKey_)).forEach((k) => { if (k.length >= 3) (by[k] = by[k] || []).push(id); });
  });
  return Object.keys(by).filter((k) => uniq_(by[k]).length > 1).sort().map((k) => ({ surname: k, people: uniq_(by[k]).map((id) => (isReal_(id) ? '✅ ' : '') + getPerson_(id).name + ' · ' + where(id)) }));
}
// латиниця/кирилиця: «Hlyna» = «Глина» = «Glyna», «Capernaum» = «Капернаум»
const TR_ = { а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ь: '', ю: 'iu', я: 'ia' };
function teamKey_(name) {
  const t = String(name || '').toLowerCase().split('').map((ch) => (TR_[ch] != null ? TR_[ch] : ch)).join('')
    .replace(/\b(young|life|wyld|wild|yl|wl|teens|new|team|kids)\b/g, ' ').replace(/[^a-z0-9]/g, '')
    .replace(/h/g, 'g').replace(/c/g, 'k').replace(/y/g, 'i').replace(/w/g, 'v');
  return t || na_(name);
}
// одна команда за назвою «Ерія · Команда» (точно або за ключем назви)
function teamByFull_(full, notId) {
  const st = loadStruct_();
  const i = full.indexOf(' · ');
  const area = st.areas.filter((a) => a.name === full.slice(0, i))[0];
  if (!area) return null;
  const nm = full.slice(i + 3), inA = st.teams.filter((x) => x.areaId === area.id && x.id !== notId);
  const ex = inA.filter((x) => x.name === nm);
  if (ex.length === 1) return ex[0];
  const k = inA.filter((x) => teamKey_(x.name) === teamKey_(nm));
  return k.length === 1 ? k[0] : null;
}
// перевірка дублів: схожі назви команд в ерії; люди з однаковим імʼям у межах ерії
function audit_() {
  const st = loadStruct_();
  const live = loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
  const nm = (id) => (getPerson_(id) || {}).name || '';
  const out = { areas: [], teamDupes: [], peopleDupes: [] };
  st.areas.forEach((a) => {
    const teams = st.teams.filter((x) => x.areaId === a.id);
    const cnt = (id) => uniq_(live.filter((r) => r.level === 'team' && r.unitId === id).map((r) => r.tgId)).length;
    out.areas.push({ area: a.name, teams: teams.map((x) => x.name + ' (' + cnt(x.id) + ')') });
    for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
      const A = teamKey_(teams[i].name), B = teamKey_(teams[j].name);
      if (A === B || (Math.min(A.length, B.length) >= 4 && (A.indexOf(B) >= 0 || B.indexOf(A) >= 0)) || (A.length >= 5 && B.length >= 5 && lev2_(A, B) <= 2))
        out.teamDupes.push(a.name + ': ' + teams[i].name + ' (' + cnt(teams[i].id) + ') ≈ ' + teams[j].name + ' (' + cnt(teams[j].id) + ')');
    }
    const unitsA = [a.id].concat(teams.map((x) => x.id));
    const ids = uniq_(live.filter((r) => unitsA.indexOf(r.unitId) >= 0).map((r) => r.tgId));
    const where = (id) => uniq_(live.filter((r) => r.tgId === id && unitsA.indexOf(r.unitId) >= 0).map((r) => (r.level === 'team' ? (st.team[r.unitId] || {}).name : 'ерія') + ' — ' + r.label)).join(', ');
    const seen = {};
    ids.forEach((x) => {
      if (seen[x]) return;
      const grp = ids.filter((y) => y !== x && !seen[y] && nameScore_(nm(x), nm(y)).same);
      if (!grp.length) return;
      [x].concat(grp).forEach((y) => { seen[y] = 1; });
      out.peopleDupes.push({ area: a.name, people: [x].concat(grp).map((y) => (isReal_(y) ? '✅ ' : '— ') + nm(y) + ' · ' + where(y)) });
    });
  });
  return out;
}
function lev2_(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; }
  return m[a.length][b.length];
}
async function encryptOut_(text, secret) {
  const k = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(text)));
  const all = new Uint8Array(12 + c.length); all.set(iv); all.set(c, 12);
  let bin = ''; all.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin);
}

// команди, створені імпортом, могли вже бути в MyYL під іншою назвою (Glyna / HLYNA, KAIROS / Кайрос…):
// шукаємо в тій самій ерії команду, де вже є ці люди, і переносимо туди (дублікати людей обʼєднуємо)
function prayFix_(names) {
  const st = loadStruct_();
  const out = [];
  names.forEach((full) => {
    const i = full.indexOf(' · ');
    const area = st.areas.filter((a) => a.name === full.slice(0, i))[0];
    const t = area && st.teams.filter((x) => x.areaId === area.id && x.name === full.slice(i + 3))[0];
    if (!t) { out.push({ team: full, notFound: true }); return; }
    const live = () => loadRoles_().filter((r) => r.status === ST.ACTIVE || r.status === ST.PENDING);
    const mine = live().filter((r) => r.level === 'team' && r.unitId === t.id);
    const ids = uniq_(mine.map((r) => r.tgId));
    const nm = (id) => (getPerson_(id) || {}).name || '';
    let best = null, bestN = 0;
    st.teams.filter((x) => x.areaId === area.id && x.id !== t.id).forEach((x) => {
      const theirs = uniq_(live().filter((r) => r.level === 'team' && r.unitId === x.id).map((r) => r.tgId));
      const n = ids.filter((id) => theirs.some((o) => o === id || nameScore_(nm(id), nm(o)).same)).length;
      if (n > bestN) { bestN = n; best = x; }
    });
    const row = { team: full, size: ids.length, best: best ? best.name : '', overlap: bestN };
    if (!best || bestN < Math.max(2, Math.ceil(ids.length * 0.3))) { out.push(row); return; }
    const mv = mergeTeamInto_(t, best);
    out.push(Object.assign(row, { into: best.name }, mv));
  });
  return out;
}

async function handleAdmin(req, env, ctx, url) {
  const key = req.headers.get('x-sync-key') || url.searchParams.get('key');
  if (!env.SYNC_KEY || key !== env.SYNC_KEY) return json({ ok: false, error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  const db = env.DB;
  const action = url.pathname.slice('/admin/'.length);
  if (action.indexOf('ws-') === 0) return json(await wsAdmin_(env, ctx, action, body));
  if (action === 'probe') {
    // виконати запит від імені «власник» (SUPER) і повернути лише час, розмір і помилку — без даних
    const sup = await db.prepare("SELECT tg_id FROM roles WHERE role_key = 'SUPER' AND status = 'активна' LIMIT 1").first('tg_id');
    const out = [];
    for (const q of (Array.isArray(body.q) ? body.q : [])) {
      const t0 = Date.now(); const S0 = new Store(env, ctx);
      try { const data = await runAs_(S0, { id: Number(sup), first_name: 'probe' }, q.action, q.data || {}); out.push({ a: q.action, ok: true, ms: Date.now() - t0, bytes: JSON.stringify(data).length }); }
      catch (e) { S0.abort(); out.push({ a: q.action, ok: false, ms: Date.now() - t0, err: String(e && (e.code || '') + ' ' + (e.message || e)).slice(0, 200), stack: e instanceof ApiError ? '' : String(e && e.stack || '').slice(0, 600) }); }
    }
    return json({ ok: true, out: out });
  }
  if (action === 'clog') {
    const r = await env.DB.prepare('SELECT ts, data FROM client_log ORDER BY ts DESC LIMIT 40').all();
    return json({ ok: true, rows: r.results || [] });
  }

  if (action === 'history') {
    // історія з командних табличок — по одній команді за запит (index)
    const list = JSON.parse(await decryptSeed_(String(body.enc), env.SYNC_KEY));
    const i = Number(body.index) || 0, t = list[i];
    if (!t) return json({ ok: true, n: list.length, done: true });
    const mk = 'hist:' + (await sha256hex_(JSON.stringify(t))).slice(0, 16);
    if (!body.force && await db.prepare('SELECT 1 AS x FROM meta WHERE k = ?').bind(mk).first('x')) return json({ ok: true, n: list.length, team: t.team, skipped: true });
    const S0 = new Store(env, ctx);
    await S0.loadBase();
    const team = use(S0, () => {
      const a = findArea_(t.area);
      if (!a) return null;
      const direct = findTeamIn_(a.id, t.team);
      if (direct || !Array.isArray(t.roster) || !t.roster.length) return direct;
      // команду могли перейменувати чи обʼєднати — шукаємо ту, де зараз найбільше людей з цієї таблички
      let best = null, bestN = 0;
      loadStruct_().teams.filter((x) => x.areaId === a.id).forEach((x) => {
        const names = uniq_(loadRoles_().filter((r) => r.level === 'team' && r.unitId === x.id && r.status === ST.ACTIVE).map((r) => r.tgId)).map((id) => (getPerson_(id) || {}).name || '');
        const n = t.roster.filter((nm) => names.some((pn) => nameScore_(nm, pn).same)).length;
        if (n > bestN) { bestN = n; best = x; }
      });
      return bestN >= Math.min(2, t.roster.length) ? best : null;
    });
    if (!team) return json({ ok: true, n: list.length, team: t.team, missing: true });
    const ex = await db.batch([
      db.prepare('SELECT type, date, author_id, author FROM reports WHERE team_id = ?').bind(team.id),
      db.prepare('SELECT name FROM known WHERE team_id = ? AND active = 1').bind(team.id),
      db.prepare('SELECT month FROM finance WHERE team_id = ?').bind(team.id),
    ]);
    const res = use(S0, () => importHistory_(team, t, { reports: ex[0].results || [], known: ex[1].results || [], finance: ex[2].results || [] }));
    S0.run('INSERT OR IGNORE INTO meta (k, v) VALUES (?, 1)', [mk]);
    await S0.flush();
    return json(Object.assign({ ok: true, n: list.length, team: t.team, matched: team.name }, res));
  }

  if (action === 'teams') {
    // обʼєднати команди [{ from: 'Ерія · Назва', into: 'Ерія · Назва' }] і/або перевірити дублі (звіт зашифровано — у логах лише шифр)
    const S0 = new Store(env, ctx);
    await S0.loadBase();
    const merged = use(S0, () => (Array.isArray(body.merge) ? body.merge : []).map((m) => {
      const a = teamByFull_(String(m.from)), b = a && teamByFull_(String(m.into), a.id);
      if (!a || !b || a.id === b.id || a.areaId !== b.areaId) return { from: m.from, into: m.into, error: !a ? 'немає from' : !b ? 'немає into' : 'не та ерія' };
      return Object.assign({ from: a.name, into: b.name }, mergeTeamInto_(a, b));
    }));
    const renamed = use(S0, () => (Array.isArray(body.rename) ? body.rename : []).map((m) => {
      const t = teamByFull_(String(m.team));
      if (!t || !String(m.name || '').trim()) return { team: m.team, error: 'немає команди' };
      const old = t.name; t.name = clip_(String(m.name).trim());
      S.run('UPDATE teams SET name = ? WHERE id = ?', [t.name, t.id], true);
      return { from: old, to: t.name };
    }));
    const ppl = body.enc ? JSON.parse(await decryptSeed_(String(body.enc), env.SYNC_KEY)) : (body.people || []);
    const auto = body.autoPeople ? use(S0, () => autoMergePeople_()) : null;
    const people = use(S0, () => ppl.map((x) => (x.all ? mergeAll_(String(x.all)) : Array.isArray(x.names) ? mergeNames_(x.names.map(String)) : mergePeopleByName_(String(x.area), String(x.name)))));
    await S0.flush();
    const res = { ok: true, merged: merged, renamed: renamed, people: people.map((x, i) => Object.assign({ n: i + 1 }, x)) };
    if (auto) { res.autoMerged = auto.length; res.autoEnc = await encryptOut_(JSON.stringify(auto), env.SYNC_KEY); }
    if (body.namesakes) res.namesakes = await encryptOut_(JSON.stringify(use(S0, () => namesakes_())), env.SYNC_KEY);
    if (body.audit) res.audit = await encryptOut_(JSON.stringify(use(S0, () => audit_())), env.SYNC_KEY);
    return json(res);
  }

  if (action === 'prayFix') {
    const S0 = new Store(env, ctx);
    await S0.loadBase();
    const res = use(S0, () => prayFix_(Array.isArray(body.teams) ? body.teams.map(String) : []));
    await S0.flush();
    return json({ ok: true, teams: res });
  }

  if (action === 'pray') {
    const list = body.enc ? JSON.parse(await decryptSeed_(String(body.enc), env.SYNC_KEY)) : body.list;
    if (!Array.isArray(list)) return json({ ok: false, error: 'bad_payload' }, 400);
    const mk = 'pray:' + (await sha256hex_(JSON.stringify(list))).slice(0, 16);
    if (!body.force && await db.prepare('SELECT 1 AS x FROM meta WHERE k = ?').bind(mk).first('x')) return json({ ok: true, skipped: 'вже перенесено раніше' });
    const S0 = new Store(env, ctx);
    await S0.loadBase();
    const res = use(S0, () => importPray_(list));
    S0.run('INSERT OR IGNORE INTO meta (k, v) VALUES (?, 1)', [mk]);
    await S0.flush();
    return json(Object.assign({ ok: true }, res));
  }

  if (action === 'members') {
    // склад команд із командних табличок: дані зашифровані ключем SYNC_KEY (у публічному репозиторії лише шифр)
    const list = body.enc ? JSON.parse(await decryptSeed_(String(body.enc), env.SYNC_KEY)) : body.teams;
    if (!Array.isArray(list)) return json({ ok: false, error: 'bad_payload' }, 400);
    const hash = await sha256hex_(JSON.stringify(list));
    if (!body.force && await db.prepare('SELECT 1 AS x FROM meta WHERE k = ?').bind('seed:' + hash.slice(0, 16)).first('x')) return json({ ok: true, skipped: 'вже перенесено раніше' });
    const S0 = new Store(env, ctx);
    await S0.loadBase();
    const report = use(S0, () => importMembers_(list));
    S0.run('INSERT OR IGNORE INTO meta (k, v) VALUES (?, 1)', ['seed:' + hash.slice(0, 16)]);
    await S0.flush();
    return json(Object.assign({ ok: true }, report));
  }

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
const igNorm_ = (x) => { const m = String(x || '').trim().match(/(?:instagram\.com\/)?@?([A-Za-z0-9._]{1,30})/); return m ? '@' + m[1] : ''; };
function profileOf_(p) { return { main: p.main || '', name: p.name, title: p.title, phone: p.phone, email: p.email, bday: p.bday, ig: p.ig || '', family: p.family || '', repent: p.repent, baptism: p.baptism, lpyl: p.lpyl, resp: p.resp, notif: notifOf_(p.tgId) }; }
// bc — розсилки від інших; remind — нагадування про звіти; events — про події; requests — нові заявки
const NOTIF = ['bc', 'remind', 'events', 'requests', 'tasks'];
function notifOf_(tgId) {
  const p = getPerson_(tgId) || {};
  const sup = loadRoles_().some((r) => r.tgId === String(tgId) && r.status === ST.ACTIVE && r.key === 'SUPER');
  const out = {};
  NOTIF.forEach((k) => { const v = (p.notif || {})[k]; out[k] = v == null ? !(sup && k === 'bc') : !!v; });
  return out;
}
const wants_ = (tgId, k) => notifOf_(tgId)[k];
function roleOut_(r) { return { id: r.id, key: r.key, title: r.title || '', titled: !!(roleDef_(r.key) || {}).titled, label: r.label, level: r.level, unitId: r.unitId, unitName: unitName_(r.level, r.unitId), status: r.status }; }
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
// ───────────────────────────── РОБОЧИЙ ПРОСТІР КОМАНДИ ─────────────────────────────
// Дошка задач (колонки, картки, виконавці, дедлайни, коментарі, посилання на Google-документи), сторінки з підсторінками,
// стратегія (цілі, 9 напрямків, проекти), профілі команди й аналітика командних табличок. Доступ — лише учасникам простору.
const WS_DEFAULT = 'west';
const WS_CIRCLES = [['c01', 'Покращення системи навчання'], ['c02', 'Рекрутинг'], ['c03', 'Контактна робота'], ['c04', 'Піклування про команду'],
  ['c05', 'Якісні табори і клуби різних форматів'], ['c06', 'Бренд Young Life'], ['c07', 'Підзвітність та комунікація'], ['c08', 'Молитовна стратегія'], ['c09', 'Фандрейзинг']]
  .map((x) => ({ id: x[0], title: x[1] }));
const WS_STRATEGY = { title: 'Стратегія West Side 2026–2027', vision: 'Young Life West Side 2340', docUrl: 'https://docs.google.com/document/d/1X6XmpYlWfBF6mSglV5pAwjZ-99hmogd3NfUYhp6Ws7M/edit',
  targets: [{ k: 'leaders', l: 'лідерів', n: 2000 }, { k: 'teams', l: 'команд', n: 300 }, { k: 'staff', l: 'стафів', n: 40 }] };
const WS_REP = { day: 'Щодня', week: 'Щотижня', '2week': 'Раз на 2 тижні', month: 'Щомісяця' };
const WS_ITEM_ST = { idea: 'Ідея', plan: 'Заплановано', doing: 'В роботі', done: 'Готово', pause: 'Пауза' };
const WS_BIG = ['profiles', 'photos', 'analytics', 'oto'];
const WS_DEF_COLS = [['Треба зробити', ''], ['В роботі', ''], ['Чекає', ''], ['Готово', 'done']];
const clipN_ = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, n);
const wsList_ = (v) => String(v || '').split(',').filter(Boolean);
const wsJson_ = (v, def) => { try { const x = JSON.parse(v || ''); return x == null ? def : x; } catch (e) { return def; } };
const isDay_ = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function wsCardRow_(r) {
  return { id: r.id, board: r.board_id || '', col: r.col_id || '', pos: Number(r.pos) || 0, title: r.title || '', desc: r.descr || '', due: r.due || '', who: wsList_(r.assignees),
    circle: r.circle || '', item: r.item_id || '', links: wsJson_(r.links, []), check: wsJson_(r.checklist, []), done: !!Number(r.done), archived: !!Number(r.archived),
    authorId: r.author_id || '', author: r.author || '', created: r.created || '', updated: r.updated || '', updatedBy: r.updated_by || '', reminded: r.reminded || '',
    doneBy: wsList_(r.done_by), rep: WS_REP[r.rep] ? r.rep : '', repN: Number(r.rep_n) || 0, repLast: r.rep_last || '' };
}
function wsPageRow_(r) {
  return { id: r.id, parent: r.parent_id || '', title: r.title || '', icon: r.icon || '', pos: Number(r.pos) || 0, authorId: r.author_id || '', created: r.created || '',
    updated: r.updated || '', updatedBy: r.updated_by || '', len: Number(r.len) || 0 };
}
function wsItemRow_(r) {
  return { id: r.id, circle: r.circle || '', kind: r.kind === 'goal' ? 'goal' : 'project', title: r.title || '', desc: r.descr || '', status: WS_ITEM_ST[r.status] ? r.status : 'plan',
    owner: r.owner || '', due: r.due || '', url: r.url || '', pos: Number(r.pos) || 0, created: r.created || '', updated: r.updated || '' };
}

Store.prototype.loadWs = async function (wsId) {
  const q = (sql) => this.db.prepare(sql).bind(wsId);
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const res = await this.db.batch([
    q('SELECT * FROM ws WHERE id = ?'),
    q('SELECT * FROM ws_members WHERE ws = ?'),
    q('SELECT * FROM ws_boards WHERE ws = ? ORDER BY pos'),
    q('SELECT * FROM ws_cols WHERE ws = ? ORDER BY pos'),
    this.db.prepare('SELECT * FROM ws_cards WHERE ws = ? AND (archived = 0 OR updated >= ?)').bind(wsId, since),
    q('SELECT id, parent_id, title, icon, pos, author_id, created, updated, updated_by, LENGTH(body) AS len FROM ws_pages WHERE ws = ?'),
    q('SELECT * FROM ws_items WHERE ws = ? ORDER BY pos'),
    q("SELECT k, v, updated FROM ws_kv WHERE ws = ? AND k NOT IN ('profiles', 'photos', 'analytics', 'oto')"),
    q('SELECT * FROM ws_log WHERE ws = ? ORDER BY ts DESC LIMIT 40'),
    q('SELECT card_id, COUNT(*) AS n FROM ws_comments WHERE ws = ? GROUP BY card_id'),
  ]);
  const [w, m, b, cl, cd, pg, it, kv, lg, cc] = res.map((x) => x.results || []);
  const W = { id: wsId, row: w[0] || null, kv: {}, kvAt: {}, cc: {} };
  W.members = m.map((r) => ({ tgId: String(r.tg_id), role: r.role === 'admin' ? 'admin' : 'member', pkey: r.pkey || '', area: r.area || '', added: r.added || '' }));
  W.boards = b.map((r) => ({ id: r.id, title: r.title || '', pos: Number(r.pos) || 0 }));
  W.cols = cl.map((r) => ({ id: r.id, board: r.board_id, title: r.title || '', kind: r.kind === 'done' ? 'done' : '', pos: Number(r.pos) || 0 }));
  W.cards = cd.map(wsCardRow_);
  W.pages = pg.map(wsPageRow_);
  W.items = it.map(wsItemRow_);
  kv.forEach((r) => { W.kv[r.k] = wsJson_(r.v, null); W.kvAt[r.k] = r.updated || ''; });
  W.log = lg.map((r) => ({ ts: r.ts, tgId: r.tg_id || '', name: r.name || '', text: r.text || '', card: r.card_id || '' }));
  cc.forEach((r) => { W.cc[r.card_id] = Number(r.n) || 0; });
  // перша дошка зʼявляється сама
  if (W.row && !W.boards.length) {
    const bid = 'b' + uid_(), now = nowIso();
    W.boards.push({ id: bid, title: 'Задачі', pos: 1 });
    this.run('INSERT INTO ws_boards (id, ws, title, pos, created) VALUES (?,?,?,?,?)', [bid, wsId, 'Задачі', 1, now]);
    WS_DEF_COLS.forEach((x, i) => {
      const col = { id: 'c' + uid_(), board: bid, title: x[0], kind: x[1], pos: i + 1 };
      W.cols.push(col);
      this.run('INSERT INTO ws_cols (id, ws, board_id, title, kind, pos) VALUES (?,?,?,?,?,?)', [col.id, wsId, bid, col.title, col.kind, col.pos]);
    });
  }
  this.ws = W;
};
Store.prototype.loadWsComments = async function (cardId) {
  const rs = await this.db.prepare('SELECT * FROM ws_comments WHERE card_id = ? ORDER BY created').bind(cardId || '').all();
  this.wsComments = (rs.results || []).map((r) => ({ id: r.id, card: r.card_id, tgId: r.tg_id || '', name: r.name || '', text: r.text || '', created: r.created || '' }));
};
Store.prototype.loadWsPage = async function (id) {
  this.wsPageBody = (await this.db.prepare('SELECT body FROM ws_pages WHERE id = ?').bind(id || '').first('body')) || '';
};
Store.prototype.loadWsKv = async function (wsId, keys) {
  const rs = await this.db.prepare('SELECT k, v, updated FROM ws_kv WHERE ws = ? AND k IN (' + keys.map(() => '?').join(',') + ')').bind(wsId, ...keys).all();
  this.wsBig = {};
  (rs.results || []).forEach((r) => { this.wsBig[r.k] = wsJson_(r.v, null); this.wsBig[r.k + 'At'] = r.updated || ''; });
};
Store.prototype.loadWsMine = async function (tgId) {
  const [w, m, c, o] = await this.db.batch([
    this.db.prepare('SELECT id, name FROM ws ORDER BY created'),
    this.db.prepare('SELECT ws, role FROM ws_members WHERE tg_id = ?').bind(tgId),
    this.db.prepare("SELECT ws, id, title, due, done_by FROM ws_cards WHERE archived = 0 AND done = 0 AND assignees LIKE ?").bind('%,' + tgId + ',%'),
    this.db.prepare("SELECT ws, v FROM ws_kv WHERE k = 'open'"),
  ]);
  this.wsMine = { all: w.results || [], member: m.results || [], cards: c.results || [], open: wsOpenMap_(o.results) };
};
Store.prototype.loadWsDue = async function (from, to) {
  const [c, w, o] = await this.db.batch([
    this.db.prepare("SELECT * FROM ws_cards WHERE archived = 0 AND done = 0 AND due >= ? AND due <= ?").bind(from, to),
    this.db.prepare('SELECT id, name FROM ws'),
    this.db.prepare("SELECT ws, v FROM ws_kv WHERE k = 'open'"),
  ]);
  this.wsOpen = wsOpenMap_(o.results);
  this.wsDue = (c.results || []).map((r) => Object.assign(wsCardRow_(r), { ws: r.ws }));
  this.wsNames = {};
  (w.results || []).forEach((r) => { this.wsNames[r.id] = r.name || ''; });
};

// статистика команд регіону простору — з бази MyYL: склад, знані, клуби, малі групи, КР
const WS_TEAM_ROLES = ROLES.filter((r) => r.level === 'team').sort((a, b) => a.rank - b.rank);
Store.prototype.loadWsStats = async function () {
  const W = this.ws, b = this.b;
  this.wsStats = null;
  if (!W || !W.row) return;
  const reg = b.regions.filter((r) => r.name === W.row.region)[0];
  if (!reg) return;
  const today = kyivDay(new Date());
  const w3 = addDaysKey_(today, -91), ly1 = addDaysKey_(today, -365), ly0 = addDaysKey_(ly1, -91);
  const m12 = addDaysKey_(today.slice(0, 8) + '01', -330).slice(0, 7) + '-01';
  const none = MODE.none;
  const [agg, mon, drive] = await this.db.batch([
    this.db.prepare("SELECT team_id, type, SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) AS n3, SUM(CASE WHEN date >= ? THEN count ELSE 0 END) AS t3, " +
      "SUM(CASE WHEN date >= ? THEN leaders ELSE 0 END) AS s3, MAX(CASE WHEN date >= ? THEN count END) AS mx3, MAX(date) AS last, SUM(CASE WHEN date >= ? THEN hours ELSE 0 END) AS h3, " +
      "COUNT(DISTINCT CASE WHEN date >= ? THEN COALESCE(NULLIF(author_id, ''), author) END) AS p3, SUM(CASE WHEN date >= ? AND date <= ? THEN 1 ELSE 0 END) AS nly, " +
      "SUM(CASE WHEN date >= ? AND date <= ? THEN count ELSE 0 END) AS tly FROM reports WHERE date >= ? AND date <= ? AND type IN ('club', 'mg', 'kr') AND COALESCE(mode, '') != ? GROUP BY team_id, type")
      .bind(w3, w3, w3, w3, w3, w3, ly0, ly1, ly0, ly1, ly0, today, none),
    this.db.prepare("SELECT team_id, substr(date, 1, 7) AS m, COUNT(*) AS n, AVG(count) AS t, AVG(leaders) AS s FROM reports WHERE type = 'club' AND date >= ? AND date <= ? AND COALESCE(mode, '') != ? GROUP BY team_id, m")
      .bind(m12, today, none),
    this.db.prepare("SELECT v FROM ws_kv WHERE ws = '_drive' AND k = 'map'"),
  ]);
  this.wsStats = { reg: reg, today: today, w3: w3, m12: m12, agg: agg.results || [], mon: mon.results || [], drive: wsJson_(((drive.results || [])[0] || {}).v, {}) || {} };
};
function wsAnalyticsLive_() {
  const X = S.wsStats;
  if (!X) return null;
  const b = S.b, kvAreas = S.ws.kv.areas || [];
  const nk = (x) => String(x || '').toLowerCase().replace(/[^a-zа-яіїєґ0-9]/gi, '');
  const areas = b.areas.filter((a) => a.regionId === X.reg.id).map((a, i) => {
    const k = kvAreas.filter((z) => nk(z.name) === nk(a.name))[0] || {};
    const fid = (X.drive.a || {})[a.id];
    return { key: k.key || a.id, id: a.id, name: a.name, director: k.director || '', acting: !!k.acting, color: k.color || '', order: k.order || 50 + i,
      folder: fid ? 'https://drive.google.com/drive/folders/' + fid : '', otoFolder: k.otoFolder || '' };
  });
  const keyOf = {};
  areas.forEach((a) => { keyOf[a.id] = a.key; });
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.level === 'team');
  const months = [];
  for (let k = 11; k >= 0; k--) { const d = new Date(Date.UTC(Number(X.today.slice(0, 4)), Number(X.today.slice(5, 7)) - 1 - k, 15)); months.push(d.toISOString().slice(0, 7)); }
  const teams = b.teams.filter((t) => t.active && b.teamRegion(t.id) === X.reg.id).map((t) => {
    const mine = act.filter((r) => r.unitId === t.id);
    const people = uniq_(mine.map((r) => r.tgId));
    const roles = {};
    WS_TEAM_ROLES.forEach((def) => { const n = uniq_(mine.filter((r) => r.key === def.key).map((r) => r.tgId)).length; if (n) roles[def.label] = n; });
    const g = (type) => X.agg.filter((r) => r.team_id === t.id && r.type === type)[0] || {};
    const cl = g('club'), mg = g('mg'), kr = g('kr');
    const n3 = Number(cl.n3) || 0, nly = Number(cl.nly) || 0;
    const sheet = (X.drive.t || {})[t.id];
    return {
      id: t.id, name: t.name, area: keyOf[t.areaId] || t.areaId, dir: t.dir || '', members: people.length, roles: roles, known: Number(t.known) || 0,
      clubs: { n: n3, totalTeens: Number(cl.t3) || 0, avgTeens: n3 ? Math.round(cl.t3 / n3 * 10) / 10 : null, avgServ: n3 ? Math.round(cl.s3 / n3 * 10) / 10 : null, maxTeens: cl.mx3 == null ? null : Number(cl.mx3), last: cl.last || '' },
      clubsLY: { n: nly, avgTeens: nly ? Math.round(cl.tly / nly * 10) / 10 : null },
      monthly: months.map((m) => { const r = X.mon.filter((z) => z.team_id === t.id && z.m === m)[0]; return { m: m, n: r ? Number(r.n) : 0, teens: r ? Math.round(r.t * 10) / 10 : null, serv: r ? Math.round(r.s * 10) / 10 : null }; }),
      sg: { n: Number(mg.n3) || 0, avg: Number(mg.n3) ? Math.round(mg.t3 / mg.n3 * 10) / 10 : null },
      kr: { hours: Math.round((Number(kr.h3) || 0) * 10) / 10, people: Number(kr.p3) || 0 },
      sheet: sheet ? 'https://docs.google.com/spreadsheets/d/' + sheet + '/edit' : '',
    };
  });
  return { source: 'myyl', region: X.reg.name, updated: nowIso(), window: { from: X.w3, to: X.today }, areas: areas, teams: teams };
}

// простір спершу закритий: його бачить лише той, хто має найвищі права в MyYL; команді відкривається окремою кнопкою
function wsOpenMap_(rows) { const o = {}; (rows || []).forEach((r) => { o[r.ws] = !!(wsJson_(r.v, {}) || {}).on; }); return o; }
const wsIsOpen_ = () => !!(S.ws && S.ws.kv.open && S.ws.kv.open.on);
const isSuperId_ = (id) => loadRoles_().some((r) => r.tgId === String(id) && r.status === ST.ACTIVE && r.key === 'SUPER');
// у «Ще» й на головній: у яких просторах людина і скільки її задач горить
function wsMineOut_(c) {
  const M = S.wsMine;
  if (!M || c.view) return [];
  const sup = isSuper_(c);
  const today = kyivDay(new Date()), soon = addDaysKey_(today, 2);
  return M.all.filter((w) => sup || (M.open[w.id] && M.member.some((m) => m.ws === w.id))).map((w) => {
    const mine = M.cards.filter((x) => x.ws === w.id && String(x.done_by || '').indexOf(',' + c.id + ',') < 0);
    const next = mine.filter((x) => x.due).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)).slice(0, 3).map((x) => ({ id: x.id, title: x.title || '', due: x.due }));
    return { id: w.id, name: w.name || '', open: mine.length, soon: mine.filter((x) => x.due && x.due <= soon).length, late: mine.filter((x) => x.due && x.due < today).length, next: next };
  });
}

// хто тут і з якими правами (той, хто має найвищі права в MyYL, — завжди керує й стає учасником сам)
function wsAcc_(c, admin) {
  const W = S.ws;
  if (!W || !W.row) bad_('Робочий простір не знайдено.');
  let m = W.members.filter((x) => x.tgId === c.id)[0];
  const sup = isSuper_(c);
  if (!m && !sup) deny_('Цей робочий простір — лише для його команди.');
  if (!sup && !wsIsOpen_()) deny_('Робочий простір ще готується — його відкриють згодом.');
  if (!m && sup) {
    m = { tgId: c.id, role: 'admin', pkey: wsAutoKey_(c.name), area: '', added: nowIso() };
    W.members.push(m);
    S.run('INSERT OR IGNORE INTO ws_members (ws, tg_id, role, pkey, area, added) VALUES (?,?,?,?,?,?)', [W.id, m.tgId, m.role, m.pkey, m.area, m.added]);
  }
  const isAdmin = sup || m.role === 'admin';
  if (admin && !isAdmin) deny_('Це може зробити лише той, хто керує простором.');
  return { m: m, admin: isAdmin };
}
const wsName_ = (id) => (getPerson_(id) || {}).name || '';
function wsAutoKey_(name) {
  const P = (S.ws && S.ws.kv.pnames) || [];
  const hit = P.filter((p) => [p.ua, p.full, p.en].filter(Boolean).some((n) => nameScore_(n, name).s >= 1));
  return hit.length === 1 ? hit[0].id : '';
}
function wsMemberOut_(m) {
  const p = getPerson_(m.tgId) || {};
  return { id: m.tgId, name: p.name || '', username: p.username || '', role: m.role, pkey: m.pkey, area: m.area };
}
function wsCardOut_(x) {
  const W = S.ws;
  return { id: x.id, board: x.board, col: x.col, pos: x.pos, title: x.title, desc: x.desc, due: x.due, who: x.who, circle: x.circle, item: x.item, links: x.links, check: x.check,
    done: x.done, doneBy: x.doneBy || [], rep: x.rep || '', repN: x.repN || 0, repLast: x.repLast || '', archived: x.archived, authorId: x.authorId, author: x.author, created: x.created, updated: x.updated, updatedBy: x.updatedBy, comments: W.cc[x.id] || 0 };
}
// поточний стан 2340 — наживо з MyYL по регіону простору; кожна людина рахується один раз:
// стафи — учасники цього простору (офісна команда); лідери — усі в командах регіону, крім стафів
function wsLive_() {
  const b = S.b, reg = b.regions.filter((r) => r.name === S.ws.row.region)[0];
  if (!reg) return { leaders: null, teams: null, staff: null, region: '' };
  const teams = b.teams.filter((t) => t.active && b.teamRegion(t.id) === reg.id);
  const inReg = {};
  teams.forEach((t) => { inReg[t.id] = 1; });
  const act = loadRoles_().filter((r) => r.status === ST.ACTIVE && r.key !== 'SUPER');
  const staff = uniq_(S.ws.members.map((m) => m.tgId));
  const leaders = uniq_(act.filter((r) => r.level === 'team' && inReg[r.unitId]).map((r) => r.tgId)).filter((id) => staff.indexOf(id) < 0);
  return { leaders: leaders.length, teams: teams.length, staff: staff.length, region: reg.name };
}
function wsStrategy_() {
  const s = Object.assign({}, WS_STRATEGY, S.ws.kv.strategy || {});
  s.circles = (S.ws.kv.circles && S.ws.kv.circles.length ? S.ws.kv.circles : WS_CIRCLES).map((x) => ({ id: x.id, title: x.title }));
  return s;
}
function wsWriteCard_(x) {
  S.run('INSERT OR REPLACE INTO ws_cards (id, ws, board_id, col_id, pos, title, descr, due, assignees, circle, item_id, links, checklist, done, archived, author_id, author, created, updated, updated_by, reminded, done_by, rep, rep_n, rep_last) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [x.id, S.ws.id, x.board, x.col, x.pos, x.title, x.desc, x.due, x.who.length ? ',' + x.who.join(',') + ',' : '', x.circle, x.item, JSON.stringify(x.links), JSON.stringify(x.check),
      x.done ? 1 : 0, x.archived ? 1 : 0, x.authorId, x.author, x.created, x.updated, x.updatedBy, x.reminded || '', (x.doneBy || []).length ? ',' + x.doneBy.join(',') + ',' : '', x.rep || '', x.repN || 0, x.repLast || '']);
}
function wsLog_(c, text, cardId) {
  const e = { ts: nowIso(), tgId: c.id, name: c.name, text: text, card: cardId || '' };
  S.ws.log.unshift(e);
  S.run('INSERT INTO ws_log (ws, ts, tg_id, name, text, card_id) VALUES (?,?,?,?,?,?)', [S.ws.id, e.ts, e.tgId, e.name, e.text, e.card]);
  S.run('DELETE FROM ws_log WHERE ws = ? AND ts < ?', [S.ws.id, new Date(Date.now() - 90 * 864e5).toISOString()]);
}
const wsUrl_ = (u) => { const s = clipN_(u, 1500); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; };
function wsLinks_(arr) {
  return [].concat(arr || []).slice(0, 25).map((l) => ({ t: clipN_(l && l.t, 200), u: wsUrl_(l && l.u) })).filter((l) => l.u);
}
const wsCardLink_ = (id) => 'wsc_' + id;
const wsTag_ = () => '«' + esc_(S.ws.row.name || 'Робочий простір') + '»';
function wsNotify_(ids, c, text, cardId) {
  uniq_(ids).filter((id) => id !== c.id && isReal_(id) && wants_(id, 'tasks') && (wsIsOpen_() || isSuperId_(id))).forEach((id) => sendApp_(id, text, 'Відкрити задачу', wsCardLink_(cardId)));
}

// виконання: кожен виконавець ставить свою галочку; коли виконали всі — задача виконана й іде в архів
const wsColsOf_ = (bid) => S.ws.cols.filter((k) => k.board === bid).sort((a, b) => a.pos - b.pos);
const wsEndPos_ = (colId, skip) => S.ws.cards.filter((y) => y.col === colId && y.id !== skip && !y.archived).reduce((a, y) => Math.max(a, y.pos), 0) + 1;
// повторювальна задача після виконання не йде в архів, а переноситься на наступний раз
function wsNextDue_(due, rep) {
  const today = kyivDay(new Date());
  let k = isDay_(due) ? due : today;
  const step = (d) => {
    if (rep === 'day') return addDaysKey_(d, 1);
    if (rep === 'week') return addDaysKey_(d, 7);
    if (rep === '2week') return addDaysKey_(d, 14);
    const p = d.split('-').map(Number), y = p[0] + (p[1] === 12 ? 1 : 0), m = p[1] === 12 ? 1 : p[1] + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(p[2], last)).padStart(2, '0');
  };
  let n = 0;
  do { k = step(k); n++; } while (k <= today && n < 800);
  return k;
}
function wsFinish_(x) {
  if (x.rep) {
    x.repN = (x.repN || 0) + 1; x.repLast = kyivDay(new Date());
    x.due = wsNextDue_(x.due, x.rep); x.reminded = '';
    x.done = false; x.archived = false; x.doneBy = [];
    x.check = (x.check || []).map((k) => ({ t: k.t, d: false }));
    const cols = wsColsOf_(x.board), cur = cols.filter((k) => k.id === x.col)[0];
    if (cur && cur.kind === 'done') { const t = cols.filter((k) => k.kind !== 'done')[0]; if (t) { x.col = t.id; x.pos = wsEndPos_(t.id, x.id); } }
    x.repeated = true;
    return;
  }
  x.done = true; x.archived = true; x.doneBy = x.who.slice();
  const dc = wsColsOf_(x.board).filter((k) => k.kind === 'done')[0];
  if (dc && dc.id !== x.col) { x.col = dc.id; x.pos = wsEndPos_(dc.id, x.id); }
}
function wsUnfinish_(x, keepDoneBy) {
  x.done = false; x.archived = false;
  if (!keepDoneBy) x.doneBy = [];
  const cols = wsColsOf_(x.board), cur = cols.filter((k) => k.id === x.col)[0];
  if (cur && cur.kind === 'done') { const t = cols.filter((k) => k.kind !== 'done')[0]; if (t) { x.col = t.id; x.pos = wsEndPos_(t.id, x.id); } }
}
const wsAllDone_ = (x) => x.who.length > 0 && x.who.every((id) => (x.doneBy || []).indexOf(id) >= 0);
API.wsTick = function (c, d) {
  wsAcc_(c);
  const x = S.ws.cards.filter((y) => y.id === str_(d.id))[0];
  if (!x) bad_('Задачу не знайдено — можливо, її видалили.');
  const was = x.done, mine = x.who.indexOf(c.id) >= 0;
  x.doneBy = (x.doneBy || []).filter((id) => x.who.indexOf(id) >= 0);
  let mark = '';
  if (x.done) {
    // зняти галочку: свою (якщо виконавців кілька) або з усієї задачі
    if (mine && x.who.length > 1) { x.doneBy = x.doneBy.filter((id) => id !== c.id); wsUnfinish_(x, true); } else wsUnfinish_(x);
  } else if (mine) {
    const i = x.doneBy.indexOf(c.id);
    if (i >= 0) x.doneBy.splice(i, 1); else { x.doneBy.push(c.id); mark = 'mine'; }
    if (wsAllDone_(x)) wsFinish_(x);
  } else wsFinish_(x);
  x.updated = nowIso(); x.updatedBy = c.name;
  wsWriteCard_(x);
  if (x.repeated) {
    wsLog_(c, 'виконав(ла) «' + x.title + '» (' + x.repN + '-й раз) — наступного разу ' + fmtDue_(x.due), x.id);
    wsNotify_([x.authorId], c, '🔁 <b>' + esc_(c.name) + '</b> виконав(ла) «' + esc_(x.title) + '». Наступного разу: ' + fmtDue_(x.due), x.id);
  } else if (x.done && !was) {
    wsLog_(c, x.who.length > 1 ? 'останнім(ою) відмітив(ла) «' + x.title + '» — виконали всі' : 'виконав(ла) «' + x.title + '»', x.id);
    wsNotify_([x.authorId], c, '✅ Задачу «' + esc_(x.title) + '» виконано' + (x.who.length > 1 ? ' — відмітили всі ' + x.who.length : ' — ' + esc_(c.name)) + '. Вона в архіві.', x.id);
  } else if (mark) wsLog_(c, 'виконав(ла) свою частину «' + x.title + '» (' + x.doneBy.length + ' з ' + x.who.length + ')', x.id);
  return wsCardOut_(x);
};
API.ws = function (c) {
  const A = wsAcc_(c);
  const W = S.ws;
  return {
    id: W.id, name: W.row.name || '', me: { id: c.id, admin: A.admin, pkey: A.m.pkey, area: A.m.area },
    members: W.members.map(wsMemberOut_).sort((a, b) => a.name.localeCompare(b.name, 'uk')),
    boards: W.boards.map((b) => ({ id: b.id, title: b.title, cols: W.cols.filter((x) => x.board === b.id).sort((a, b2) => a.pos - b2.pos).map((x) => ({ id: x.id, title: x.title, kind: x.kind })) })),
    cards: W.cards.map(wsCardOut_),
    pages: W.pages.sort((a, b) => a.pos - b.pos || (a.created < b.created ? -1 : 1)),
    items: W.items.sort((a, b) => a.pos - b.pos),
    strategy: wsStrategy_(), itemSt: WS_ITEM_ST, reps: WS_REP,
    areas: W.kv.areas || [],
    current: wsLive_(),
    open: wsIsOpen_(), has: W.kv.meta || {}, pnames: A.admin ? (W.kv.pnames || []) : [],
    log: W.log.slice(0, 30),
  };
};
API.wsCard = function (c, d) {
  wsAcc_(c);
  const x = S.ws.cards.filter((y) => y.id === str_(d.id))[0];
  if (!x) bad_('Задачу не знайдено — можливо, її видалили.');
  return { card: wsCardOut_(x), comments: S.wsComments || [] };
};
API.wsCardSave = function (c, d) {
  const A = wsAcc_(c);
  const W = S.ws, now = nowIso();
  let x = d.id ? W.cards.filter((y) => y.id === str_(d.id))[0] : null;
  if (d.id && !x) bad_('Задачу не знайдено — можливо, її видалили.');
  const isNew = !x;
  const colsOf = (bid) => W.cols.filter((k) => k.board === bid).sort((a, b) => a.pos - b.pos);
  const endPos = (colId, skip) => W.cards.filter((y) => y.col === colId && y.id !== skip && !y.archived).reduce((a, y) => Math.max(a, y.pos), 0) + 1;
  if (isNew) {
    const title = clipN_(d.title, 300);
    if (!title) bad_('Напиши назву задачі.');
    const board = W.boards.filter((b) => b.id === str_(d.board))[0] || W.boards[0];
    if (!board) bad_('Спершу створи дошку.');
    const col = colsOf(board.id).filter((k) => k.id === str_(d.col))[0] || colsOf(board.id)[0];
    if (!col) bad_('На дошці немає колонок.');
    x = { id: uid_(), board: board.id, col: col.id, pos: endPos(col.id), title: title, desc: '', due: '', who: [], doneBy: [], rep: '', repN: 0, repLast: '', circle: '', item: '', links: [], check: [], done: false, archived: false,
      authorId: c.id, author: c.name, created: now, updated: now, updatedBy: c.name, reminded: '' };
  }
  const was = { who: isNew ? [] : x.who.slice(), done: isNew ? false : x.done, col: isNew ? '' : x.col };
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k);
  if (has('title') && !isNew) { const t = clipN_(d.title, 300); if (!t) bad_('Назва не може бути порожньою.'); x.title = t; }
  if (has('desc')) x.desc = clipN_(d.desc, 8000);
  if (has('due')) { const due = isDay_(d.due) ? d.due : ''; if (due !== x.due) x.reminded = ''; x.due = due; }
  if (has('who')) {
    const ok = W.members.map((m) => m.tgId);
    x.who = uniq_([].concat(d.who || []).map(String)).filter((id) => ok.indexOf(id) >= 0).slice(0, 12);
    x.doneBy = (x.doneBy || []).filter((id) => x.who.indexOf(id) >= 0);
    if (!x.done && !isNew && wsAllDone_(x)) wsFinish_(x);
  }
  if (has('item')) { const it = W.items.filter((i) => i.id === str_(d.item))[0]; x.item = it ? it.id : ''; if (it && it.circle && !has('circle')) x.circle = it.circle; }
  if (has('circle')) x.circle = wsStrategy_().circles.some((k) => k.id === str_(d.circle)) ? str_(d.circle) : '';
  if (has('links')) x.links = wsLinks_(d.links);
  if (has('addLink')) { const l = wsLinks_([d.addLink])[0]; if (!l) bad_('Встав повне посилання, що починається з https://'); if (x.links.length >= 25) bad_('Забагато посилань.'); x.links.push(l); }
  if (has('check')) x.check = [].concat(d.check || []).slice(0, 60).map((k) => ({ t: clipN_(k && k.t, 300), d: !!(k && k.d) })).filter((k) => k.t);
  if (has('rep')) {
    x.rep = WS_REP[d.rep] ? d.rep : '';
    if (x.rep && !x.due) { x.due = kyivDay(new Date()); x.reminded = ''; }
  }
  if (has('archived')) { if (!d.archived && x.done) wsUnfinish_(x); else x.archived = !!d.archived; }
  if (has('col') && str_(d.col) && str_(d.col) !== x.col) {
    const col = W.cols.filter((k) => k.id === str_(d.col))[0];
    if (!col) bad_('Такої колонки вже немає.');
    const from = W.cols.filter((k) => k.id === x.col)[0];
    x.board = col.board; x.col = col.id; x.pos = endPos(col.id, x.id);
    if (col.kind === 'done') wsFinish_(x); else if (x.done || (from && from.kind === 'done')) { x.done = false; x.archived = false; x.doneBy = []; }
  }
  if (has('done') && !!d.done !== x.done) { if (d.done) wsFinish_(x); else wsUnfinish_(x); }
  if (has('shift') && !isNew) {
    const list = W.cards.filter((y) => y.col === x.col && !y.archived).sort((a, b) => a.pos - b.pos);
    const i = list.indexOf(x), j = i + (Number(d.shift) < 0 ? -1 : 1);
    if (i >= 0 && list[j]) { const o = list[j], p = o.pos; o.pos = x.pos; x.pos = p; if (o.pos === x.pos) x.pos += Number(d.shift) < 0 ? -0.5 : 0.5; o.updated = now; wsWriteCard_(o); }
  }
  x.updated = now; x.updatedBy = c.name;
  if (isNew) W.cards.push(x);
  wsWriteCard_(x);
  const colName = (W.cols.filter((k) => k.id === x.col)[0] || {}).title || '';
  if (isNew) wsLog_(c, 'створив(ла) задачу «' + x.title + '»', x.id);
  else if (x.repeated) wsLog_(c, 'виконав(ла) «' + x.title + '» (' + x.repN + '-й раз) — наступного разу ' + fmtDue_(x.due), x.id);
  else if (x.done && !was.done) wsLog_(c, 'виконав(ла) «' + x.title + '»', x.id);
  else if (was.col && was.col !== x.col) wsLog_(c, 'перемістив(ла) «' + x.title + '» → ' + colName, x.id);
  // повідомлення: новим виконавцям; автору — коли задачу виконав хтось інший
  const added = x.who.filter((id) => was.who.indexOf(id) < 0);
  if (added.length && !x.done) wsNotify_(added, c, '📌 <b>' + esc_(c.name) + '</b> доручає тобі задачу в ' + wsTag_() + ':\n\n<b>' + esc_(x.title) + '</b>' +
    (x.due ? '\n🗓 Дедлайн: ' + fmtDue_(x.due) : '') + (x.desc ? '\n\n' + esc_(x.desc.slice(0, 600)) : ''), x.id);
  if (x.done && !was.done && !isNew) wsNotify_([x.authorId], c, '✅ <b>' + esc_(c.name) + '</b> виконав(ла) задачу «' + esc_(x.title) + '»', x.id);
  return wsCardOut_(x);
};
API.wsCardDelete = function (c, d) {
  const A = wsAcc_(c);
  const W = S.ws, x = W.cards.filter((y) => y.id === str_(d.id))[0];
  if (!x) bad_('Задачу не знайдено.');
  if (!A.admin && x.authorId !== c.id) deny_('Видалити задачу може її автор або той, хто керує простором. Можна перенести в архів.');
  W.cards.splice(W.cards.indexOf(x), 1);
  S.run('DELETE FROM ws_comments WHERE card_id = ?', [x.id]);
  S.run('DELETE FROM ws_cards WHERE id = ?', [x.id]);
  wsLog_(c, 'видалив(ла) задачу «' + x.title + '»', '');
  return { ok: true };
};
API.wsComment = function (c, d) {
  wsAcc_(c);
  const x = S.ws.cards.filter((y) => y.id === str_(d.card))[0];
  if (!x) bad_('Задачу не знайдено.');
  const text = clipN_(d.text, 3000);
  if (!text) bad_('Напиши коментар.');
  const k = { id: uid_(), card: x.id, tgId: c.id, name: c.name, text: text, created: nowIso() };
  S.run('INSERT INTO ws_comments (id, ws, card_id, tg_id, name, text, created) VALUES (?,?,?,?,?,?,?)', [k.id, S.ws.id, k.card, k.tgId, k.name, k.text, k.created]);
  (S.wsComments = S.wsComments || []).push(k);
  S.ws.cc[x.id] = (S.ws.cc[x.id] || 0) + 1;
  wsLog_(c, 'прокоментував(ла) «' + x.title + '»', x.id);
  wsNotify_(x.who.concat([x.authorId]), c, '💬 <b>' + esc_(c.name) + '</b> у задачі «' + esc_(x.title) + '»:\n\n' + esc_(text.slice(0, 700)), x.id);
  return { card: wsCardOut_(x), comments: S.wsComments };
};
API.wsCommentDelete = function (c, d) {
  const A = wsAcc_(c);
  const k = (S.wsComments || []).filter((y) => y.id === str_(d.id))[0];
  if (!k) bad_('Коментар не знайдено.');
  if (k.tgId !== c.id && !A.admin) deny_('Видалити можна лише свій коментар.');
  S.run('DELETE FROM ws_comments WHERE id = ?', [k.id]);
  S.wsComments.splice(S.wsComments.indexOf(k), 1);
  S.ws.cc[k.card] = Math.max(0, (S.ws.cc[k.card] || 1) - 1);
  const x = S.ws.cards.filter((y) => y.id === k.card)[0];
  return { card: x ? wsCardOut_(x) : null, comments: S.wsComments };
};
API.wsColSave = function (c, d) {
  wsAcc_(c);
  const W = S.ws;
  let col = d.id ? W.cols.filter((k) => k.id === str_(d.id))[0] : null;
  if (d.id && !col) bad_('Колонку не знайдено.');
  if (!col) {
    const board = W.boards.filter((b) => b.id === str_(d.board))[0];
    if (!board) bad_('Дошку не знайдено.');
    const cols = W.cols.filter((k) => k.board === board.id);
    if (cols.length >= 12) bad_('Забагато колонок на одній дошці.');
    col = { id: 'c' + uid_(), board: board.id, title: '', kind: '', pos: cols.reduce((a, k) => Math.max(a, k.pos), 0) + 1 };
    // нову колонку ставимо перед «Готово»
    const done = cols.filter((k) => k.kind === 'done')[0];
    if (done) { col.pos = done.pos; done.pos += 1; S.run('UPDATE ws_cols SET pos = ? WHERE id = ?', [done.pos, done.id]); }
    W.cols.push(col);
  }
  if (Object.prototype.hasOwnProperty.call(d, 'title') || !col.title) { const t = clipN_(d.title, 60); if (!t) bad_('Назви колонку.'); col.title = t; }
  if (Object.prototype.hasOwnProperty.call(d, 'done')) {
    col.kind = d.done ? 'done' : '';
    if (d.done) W.cols.filter((k) => k.board === col.board && k.id !== col.id && k.kind === 'done').forEach((k) => { k.kind = ''; S.run('UPDATE ws_cols SET kind = ? WHERE id = ?', ['', k.id]); });
  }
  if (d.shift) {
    const list = W.cols.filter((k) => k.board === col.board).sort((a, b) => a.pos - b.pos);
    const i = list.indexOf(col), o = list[i + (Number(d.shift) < 0 ? -1 : 1)];
    if (o) { const p = o.pos; o.pos = col.pos; col.pos = p; if (o.pos === col.pos) col.pos += Number(d.shift) < 0 ? -0.5 : 0.5; S.run('UPDATE ws_cols SET pos = ? WHERE id = ?', [o.pos, o.id]); }
  }
  S.run('INSERT OR REPLACE INTO ws_cols (id, ws, board_id, title, kind, pos) VALUES (?,?,?,?,?,?)', [col.id, W.id, col.board, col.title, col.kind, col.pos]);
  return API.ws(c);
};
API.wsColDelete = function (c, d) {
  wsAcc_(c);
  const W = S.ws, col = W.cols.filter((k) => k.id === str_(d.id))[0];
  if (!col) bad_('Колонку не знайдено.');
  if (W.cols.filter((k) => k.board === col.board).length <= 1) bad_('На дошці має лишитися хоча б одна колонка.');
  if (W.cards.some((x) => x.col === col.id && !x.archived)) bad_('Спершу перенеси задачі з цієї колонки.');
  W.cols.splice(W.cols.indexOf(col), 1);
  S.run('DELETE FROM ws_cols WHERE id = ?', [col.id]);
  return API.ws(c);
};
API.wsBoardSave = function (c, d) {
  wsAcc_(c);
  const W = S.ws;
  const title = clipN_(d.title, 80);
  if (!title) bad_('Назви дошку.');
  let b = d.id ? W.boards.filter((x) => x.id === str_(d.id))[0] : null;
  if (d.id && !b) bad_('Дошку не знайдено.');
  if (b) { b.title = title; S.run('UPDATE ws_boards SET title = ? WHERE id = ?', [title, b.id]); return API.ws(c); }
  if (W.boards.length >= 20) bad_('Забагато дошок.');
  b = { id: 'b' + uid_(), title: title, pos: W.boards.reduce((a, x) => Math.max(a, x.pos), 0) + 1 };
  W.boards.push(b);
  S.run('INSERT INTO ws_boards (id, ws, title, pos, created) VALUES (?,?,?,?,?)', [b.id, W.id, b.title, b.pos, nowIso()]);
  WS_DEF_COLS.filter((x, i) => i !== 2).forEach((x, i) => {
    const col = { id: 'c' + uid_(), board: b.id, title: x[0], kind: x[1], pos: i + 1 };
    W.cols.push(col);
    S.run('INSERT INTO ws_cols (id, ws, board_id, title, kind, pos) VALUES (?,?,?,?,?,?)', [col.id, W.id, b.id, col.title, col.kind, col.pos]);
  });
  const out = API.ws(c); out.newBoard = b.id; return out;
};
API.wsBoardDelete = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, b = W.boards.filter((x) => x.id === str_(d.id))[0];
  if (!b) bad_('Дошку не знайдено.');
  if (W.boards.length <= 1) bad_('Має лишитися хоча б одна дошка.');
  if (W.cards.some((x) => x.board === b.id && !x.archived)) bad_('На дошці ще є задачі — перенеси або видали їх.');
  W.boards.splice(W.boards.indexOf(b), 1);
  W.cols = W.cols.filter((k) => k.board !== b.id);
  S.run('DELETE FROM ws_cols WHERE board_id = ?', [b.id]);
  S.run('DELETE FROM ws_cards WHERE board_id = ?', [b.id]);
  S.run('DELETE FROM ws_boards WHERE id = ?', [b.id]);
  return API.ws(c);
};

// ── сторінки (як у Notion): текст із заголовками, списками, чекбоксами й посиланнями; підсторінки ──
function wsPath_(id) {
  const out = [], seen = {};
  let p = S.ws.pages.filter((x) => x.id === id)[0];
  while (p && !seen[p.id]) { seen[p.id] = 1; out.unshift({ id: p.id, title: p.title, icon: p.icon }); p = S.ws.pages.filter((x) => x.id === p.parent)[0]; }
  return out;
}
function wsDescendants_(id) {
  const out = [];
  const walk = (pid) => S.ws.pages.filter((x) => x.parent === pid).forEach((x) => { if (out.indexOf(x.id) < 0) { out.push(x.id); walk(x.id); } });
  walk(id);
  return out;
}
API.wsPage = function (c, d) {
  wsAcc_(c);
  const p = S.ws.pages.filter((x) => x.id === str_(d.id))[0];
  if (!p) bad_('Сторінку не знайдено — можливо, її видалили.');
  return { page: Object.assign({}, p, { body: S.wsPageBody || '' }), path: wsPath_(p.id), children: S.ws.pages.filter((x) => x.parent === p.id).sort((a, b) => a.pos - b.pos) };
};
API.wsPageSave = function (c, d) {
  wsAcc_(c);
  const W = S.ws, now = nowIso();
  let p = d.id ? W.pages.filter((x) => x.id === str_(d.id))[0] : null;
  if (d.id && !p) bad_('Сторінку не знайдено — можливо, її видалили.');
  if (p && d.base && d.base !== p.updated) throw new ApiError('conflict', (p.updatedBy || 'Хтось') + ' щойно змінив(ла) цю сторінку. Глянь свіжу версію — твій текст збережено в редакторі.');
  const parent = str_(d.parent);
  if (parent) {
    if (!W.pages.some((x) => x.id === parent)) bad_('Батьківську сторінку не знайдено.');
    if (p && (parent === p.id || wsDescendants_(p.id).indexOf(parent) >= 0)) bad_('Не можна вкласти сторінку саму в себе.');
  }
  const title = clipN_(d.title, 200) || 'Без назви';
  const icon = clipN_(d.icon, 8);
  const body = clipN_(d.body, 60000);
  if (!p) {
    if (W.pages.length >= 1000) bad_('Забагато сторінок.');
    p = { id: uid_(), parent: parent, title: title, icon: icon, pos: W.pages.filter((x) => x.parent === parent).reduce((a, x) => Math.max(a, x.pos), 0) + 1, authorId: c.id, created: now, updated: now, updatedBy: c.name, len: body.length };
    W.pages.push(p);
    S.run('INSERT INTO ws_pages (id, ws, parent_id, title, icon, body, pos, author_id, created, updated, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [p.id, W.id, p.parent, p.title, p.icon, body, p.pos, p.authorId, p.created, p.updated, p.updatedBy]);
    wsLog_(c, 'створив(ла) сторінку «' + p.title + '»', '');
  } else {
    p.parent = parent; p.title = title; p.icon = icon; p.updated = now; p.updatedBy = c.name; p.len = body.length;
    S.run('UPDATE ws_pages SET parent_id = ?, title = ?, icon = ?, body = ?, updated = ?, updated_by = ? WHERE id = ?', [p.parent, p.title, p.icon, body, p.updated, p.updatedBy, p.id]);
  }
  return { page: Object.assign({}, p, { body: body }), path: wsPath_(p.id), children: W.pages.filter((x) => x.parent === p.id).sort((a, b) => a.pos - b.pos) };
};
API.wsPageDelete = function (c, d) {
  const A = wsAcc_(c);
  const W = S.ws, p = W.pages.filter((x) => x.id === str_(d.id))[0];
  if (!p) bad_('Сторінку не знайдено.');
  if (!A.admin && p.authorId !== c.id) deny_('Видалити сторінку може її автор або той, хто керує простором.');
  const ids = [p.id].concat(wsDescendants_(p.id));
  S.run('DELETE FROM ws_pages WHERE id IN (SELECT value FROM json_each(?))', [JSON.stringify(ids)]);
  W.pages = W.pages.filter((x) => ids.indexOf(x.id) < 0);
  wsLog_(c, 'видалив(ла) сторінку «' + p.title + '»', '');
  return { ok: true, removed: ids.length, parent: p.parent };
};

// ── стратегія: цілі й проекти в 9 напрямках ──
API.wsItemSave = function (c, d) {
  wsAcc_(c);
  const W = S.ws, now = nowIso();
  let it = d.id ? W.items.filter((x) => x.id === str_(d.id))[0] : null;
  if (d.id && !it) bad_('Не знайдено.');
  const title = clipN_(d.title, 200);
  if (!title) bad_('Напиши назву.');
  const circle = wsStrategy_().circles.some((k) => k.id === str_(d.circle)) ? str_(d.circle) : '';
  const owner = W.members.some((m) => m.tgId === str_(d.owner)) ? str_(d.owner) : '';
  const v = { circle: circle, kind: d.kind === 'goal' ? 'goal' : 'project', title: title, desc: clipN_(d.desc, 4000), status: WS_ITEM_ST[d.status] ? d.status : 'plan', owner: owner,
    due: isDay_(d.due) ? d.due : '', url: wsUrl_(d.url) };
  if (!it) { it = Object.assign({ id: uid_(), pos: W.items.reduce((a, x) => Math.max(a, x.pos), 0) + 1, created: now }, v); W.items.push(it); wsLog_(c, 'додав(ла) ' + (v.kind === 'goal' ? 'ціль' : 'проект') + ' «' + title + '»', ''); }
  else Object.assign(it, v);
  it.updated = now;
  S.run('INSERT OR REPLACE INTO ws_items (id, ws, circle, kind, title, descr, status, owner, due, url, pos, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [it.id, W.id, it.circle, it.kind, it.title, it.desc, it.status, it.owner, it.due, it.url, it.pos, it.created, it.updated]);
  return { item: it, ws: API.ws(c) };
};
API.wsItemDelete = function (c, d) {
  wsAcc_(c);
  const W = S.ws, it = W.items.filter((x) => x.id === str_(d.id))[0];
  if (!it) bad_('Не знайдено.');
  W.items.splice(W.items.indexOf(it), 1);
  W.cards.filter((x) => x.item === it.id).forEach((x) => { x.item = ''; });
  S.run("UPDATE ws_cards SET item_id = '' WHERE item_id = ?", [it.id]);
  S.run('DELETE FROM ws_items WHERE id = ?', [it.id]);
  return API.ws(c);
};
function wsKvSet_(k, v) {
  const s = JSON.stringify(v);
  if (s.length > 1900000) bad_('Завеликий файл даних («' + k + '»).');
  S.ws.kv[k] = v;
  S.run('INSERT OR REPLACE INTO ws_kv (ws, k, v, updated) VALUES (?,?,?,?)', [S.ws.id, k, s, nowIso()]);
}
API.wsStrategySave = function (c, d) {
  wsAcc_(c, true);
  const cur = wsStrategy_();
  const s = { title: clipN_(d.title, 120) || cur.title, vision: clipN_(d.vision, 200) || cur.vision, docUrl: d.docUrl != null ? wsUrl_(d.docUrl) : cur.docUrl,
    targets: (Array.isArray(d.targets) ? d.targets : cur.targets).slice(0, 6).map((t) => ({ k: str_(t.k).slice(0, 20), l: clipN_(t.l, 40), n: Math.max(0, Math.round(Number(t.n) || 0)) })).filter((t) => t.l) };
  wsKvSet_('strategy', s);
  if (Array.isArray(d.circles)) {
    const ids = cur.circles.map((k) => k.id);
    const list = d.circles.slice(0, 15).map((k, i) => ({ id: ids.indexOf(str_(k.id)) >= 0 ? str_(k.id) : 'c' + uid_().slice(0, 6), title: clipN_(k.title, 120) })).filter((k) => k.title);
    if (list.length) wsKvSet_('circles', list);
  }
  return API.ws(c);
};

// ── учасники ──
API.wsPeopleFind = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, q = str_(d.q).toLowerCase();
  const inWs = W.members.map((m) => m.tgId);
  const st = loadStruct_();
  const region = st.regions.filter((r) => r.name === W.row.region)[0];
  const roleLine = (id) => loadRoles_().filter((r) => r.tgId === id && r.status === ST.ACTIVE && r.key !== 'SUPER').map((r) => r.label + (r.level === 'nat' ? '' : ' · ' + unitName_(r.level, r.unitId))).slice(0, 2).join(', ');
  let ids;
  if (q.length >= 2) ids = Object.keys(S.b.people).filter((id) => isReal_(id) && String(S.b.people[id].name || '').toLowerCase().indexOf(q) >= 0);
  else {
    // підказка: хто служить на рівні ерії чи регіону цього простору або в офісі ерії
    const inReg = (r) => region && ((r.level === 'region' && r.unitId === region.id) || (r.level === 'area' && st.area[r.unitId] && st.area[r.unitId].regionId === region.id));
    ids = uniq_(loadRoles_().filter((r) => r.status === ST.ACTIVE && r.key !== 'SUPER' && inReg(r)).map((r) => r.tgId)).filter(isReal_);
  }
  return ids.filter((id) => inWs.indexOf(id) < 0).slice(0, 25).map((id) => ({ id: id, name: (S.b.people[id] || {}).name || id, role: roleLine(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
};
API.wsMemberSave = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, id = str_(d.id);
  if (!isReal_(id) || !getPerson_(id)) bad_('Цієї людини ще немає в MyYL.');
  let m = W.members.filter((x) => x.tgId === id)[0];
  const isNew = !m;
  if (!m) { m = { tgId: id, role: 'member', pkey: wsAutoKey_(wsName_(id)), area: '', added: nowIso() }; W.members.push(m); }
  if (d.role) {
    const role = d.role === 'admin' ? 'admin' : 'member';
    if (role === 'member' && m.role === 'admin' && W.members.filter((x) => x.role === 'admin').length <= 1 && !isSuper_(c)) bad_('Має лишитися хоча б одна людина, що керує простором.');
    m.role = role;
  }
  if (d.pkey != null) m.pkey = str_(d.pkey).slice(0, 40);
  if (d.area != null) m.area = str_(d.area).slice(0, 40);
  S.run('INSERT OR REPLACE INTO ws_members (ws, tg_id, role, pkey, area, added) VALUES (?,?,?,?,?,?)', [W.id, m.tgId, m.role, m.pkey, m.area, m.added]);
  if (isNew && id !== c.id && wsIsOpen_() && wants_(id, 'tasks')) sendApp_(id, '👋 <b>' + esc_(c.name) + '</b> додав(ла) тебе в робочий простір ' + wsTag_() + '.\n\nТут задачі команди з дедлайнами, сторінки й документи, стратегія та профілі.', 'Відкрити простір', 'ws');
  if (isNew) wsLog_(c, 'додав(ла) ' + wsName_(id) + ' в команду простору', '');
  return API.ws(c);
};
// відкрити простір команді (усі учасники отримають запрошення) або знову закрити
API.wsOpen = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, was = wsIsOpen_(), on = !!d.on;
  wsKvSet_('open', { on: on, at: nowIso(), by: c.name });
  if (on && !was) {
    W.members.filter((m) => m.tgId !== c.id && wants_(m.tgId, 'tasks')).forEach((m) => sendApp_(m.tgId, '👋 <b>' + esc_(c.name) + '</b> відкриває для тебе робочий простір ' + wsTag_() + '.\n\nТут задачі команди з дедлайнами, сторінки й документи, стратегія та профілі.', 'Відкрити простір', 'ws'));
    wsLog_(c, 'відкрив(ла) простір для команди', '');
  }
  return API.ws(c);
};
API.wsMemberRemove = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, m = W.members.filter((x) => x.tgId === str_(d.id))[0];
  if (!m) bad_('Цієї людини немає в просторі.');
  if (m.tgId === c.id) bad_('Себе прибрати не можна.');
  if (m.role === 'admin' && W.members.filter((x) => x.role === 'admin').length <= 1) bad_('Має лишитися хоча б одна людина, що керує простором.');
  W.members.splice(W.members.indexOf(m), 1);
  S.run('DELETE FROM ws_members WHERE ws = ? AND tg_id = ?', [W.id, m.tgId]);
  return API.ws(c);
};

// ── профілі (сильні сторони) та аналітика командних табличок; оновлюються файлом даних ──
API.wsProfiles = function (c) {
  wsAcc_(c);
  const B = S.wsBig || {};
  return { profiles: B.profiles || null, photos: B.photos || {}, at: B.profilesAt || '' };
};
API.wsAnalytics = function (c) {
  wsAcc_(c);
  const B = S.wsBig || {};
  return { analytics: wsAnalyticsLive_(), oto: B.oto || null, at: nowIso() };
};
API.wsImport = function (c, d) {
  wsAcc_(c, true);
  const W = S.ws, got = [];
  const meta = Object.assign({}, W.kv.meta || {});
  if (d.profiles && Array.isArray(d.profiles.people) && Array.isArray(d.profiles.themes)) {
    wsKvSet_('profiles', { themes: d.profiles.themes, people: d.profiles.people, domains: d.profiles.domains || null });
    wsKvSet_('pnames', d.profiles.people.map((p) => ({ id: str_(p.id), ua: str_(p.ua), en: str_(p.en), full: str_(p.full) })));
    meta.profiles = d.profiles.people.length; got.push('профілі: ' + d.profiles.people.length);
    // підвʼязати учасників до профілів за імʼям
    W.members.filter((m) => !m.pkey).forEach((m) => {
      m.pkey = wsAutoKey_(wsName_(m.tgId));
      if (m.pkey) S.run('UPDATE ws_members SET pkey = ? WHERE ws = ? AND tg_id = ?', [m.pkey, W.id, m.tgId]);
    });
  }
  if (d.photos && typeof d.photos === 'object') {
    const ph = {};
    Object.keys(d.photos).slice(0, 60).forEach((k) => { const v = String(d.photos[k] || ''); if (/^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 400000) ph[str_(k)] = v; });
    wsKvSet_('photos', ph); got.push('фото: ' + Object.keys(ph).length);
  }
  if (d.analytics && Array.isArray(d.analytics.teams)) {
    wsKvSet_('analytics', d.analytics);
    const teams = d.analytics.teams;
    wsKvSet_('current', { leaders: teams.reduce((a, t) => a + (Number(t.members) || 0), 0), teams: teams.length, at: str_(d.analytics.updated) || nowIso().slice(0, 10) });
    meta.analytics = teams.length; got.push('команди: ' + teams.length);
  }
  if (d.oto && Array.isArray(d.oto.files)) { wsKvSet_('oto', d.oto); meta.oto = d.oto.files.length; got.push('one-to-one: ' + d.oto.files.length); }
  if (Array.isArray(d.areas)) {
    wsKvSet_('areas', d.areas.slice(0, 20).map((a) => ({ key: str_(a.key).slice(0, 30), name: clipN_(a.name, 60), director: clipN_(a.director, 80), acting: !!a.acting, color: /^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : '',
      teamFolder: wsUrl_(a.teamFolder), otoFolder: wsUrl_(a.otoFolder), order: Number(a.order) || 0 })).filter((a) => a.key && a.name));
    got.push('ерії: ' + d.areas.length);
  }
  if (d.strategy && typeof d.strategy === 'object') { API.wsStrategySave(c, d.strategy); got.push('стратегія'); }
  if (!got.length) bad_('У файлі немає даних для простору.');
  meta.updated = nowIso();
  wsKvSet_('meta', meta);
  wsLog_(c, 'оновив(ла) дані простору (' + got.join(', ') + ')', '');
  return { got: got, ws: API.ws(c) };
};

// ── дані з Google Диску (скрипт «⚙️ Система»): налаштування й one-to-one ──
const wsNum_ = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
function wsOtoClean_(files) {
  return files.slice(0, 60).map((f) => ({
    id: str_(f && f.id).slice(0, 80), title: clipN_(f && f.title, 200), area: str_(f && f.area).slice(0, 30), group: clipN_(f && f.group, 40), ok: !(f && f.ok === false),
    people: (Array.isArray(f && f.people) ? f.people : []).slice(0, 80).map((p) => ({
      name: clipN_(p && p.name, 120), role: clipN_(p && p.role, 160),
      meetings: (Array.isArray(p && p.meetings) ? p.meetings : []).slice(0, 6).map((m) => {
        const sp = {};
        Object.keys((m && m.spheres) || {}).slice(0, 20).forEach((k) => { const v = wsNum_(m.spheres[k]); if (v != null) sp[clipN_(k, 80)] = v; });
        return { held: !!(m && m.held), date: m && m.date ? clipN_(m.date, 20) : null, total: wsNum_(m && m.total), spheres: sp };
      }),
    })).filter((p) => p.name),
  })).filter((f) => f.id);
}
async function wsAdmin_(env, ctx, action, body) {
  const wsId = str_(body.ws) || WS_DEFAULT;
  const S0 = new Store(env, ctx);
  await S0.loadBase();
  await S0.loadWs(wsId);
  const prev = action === 'ws-oto' ? await env.DB.prepare("SELECT v FROM ws_kv WHERE ws = ? AND k = 'oto'").bind(wsId).first('v') : null;
  const out = use(S0, () => {
    const W = S.ws;
    if (!W.row) return { ok: false, error: 'no_ws' };
    if (action === 'ws-config') return { ok: true, name: W.row.name, areas: (W.kv.areas || []).map((a) => ({ key: a.key, name: a.name, otoFolder: a.otoFolder, teamFolder: a.teamFolder })) };
    if (action === 'ws-drive') {
      // де скрипт «⚙️ Система» створив папки ерій і таблиці команд на Диску
      const ids = (o) => { const r = {}; Object.keys(o || {}).slice(0, 2000).forEach((k) => { const v = String((o[k] && o[k].id) || o[k] || ''); if (/^[\w-]{10,100}$/.test(v)) r[str_(k).slice(0, 60)] = v; }); return r; };
      const map = { t: ids(body.map && body.map.t), a: ids(body.map && body.map.a), r: ids(body.map && body.map.r), at: nowIso() };
      S.run("INSERT OR REPLACE INTO ws_kv (ws, k, v, updated) VALUES ('_drive', 'map', ?, ?)", [JSON.stringify(map), map.at]);
      return { ok: true, teams: Object.keys(map.t).length, areas: Object.keys(map.a).length };
    }
    if (action === 'ws-oto') {
      if (!Array.isArray(body.files)) return { ok: false, error: 'bad_request' };
      const files = wsOtoClean_(body.files);
      const old = (wsJson_(prev, {}) || {}).files || null;
      if (old && JSON.stringify(old) === JSON.stringify(files)) return { ok: true, changed: false, files: files.length };
      wsKvSet_('oto', { updated: nowIso(), source: 'drive', files: files });
      const meta = Object.assign({}, W.kv.meta || {}, { oto: files.length, otoAt: nowIso() });
      wsKvSet_('meta', meta);
      wsLog_({ id: '', name: 'Google Диск' }, 'оновлено one-to-one (' + files.length + ' табл.)', '');
      return { ok: true, changed: true, files: files.length };
    }
    return { ok: false, error: 'bad_action' };
  });
  await S0.flush();
  return out;
}

// ── нагадування про дедлайни (щодня о 9:00 за Києвом): завтра, сьогодні, прострочено на день ──
function wsReminder_() {
  const today = kyivDay(new Date());
  (S.wsDue || []).forEach((x) => {
    if (x.reminded === today) return;
    const d = x.due === today ? 0 : x.due < today ? -1 : 1;
    const head = d === 1 ? '⏰ <b>Завтра дедлайн</b>' : d === 0 ? '🔥 <b>Сьогодні дедлайн</b>' : '⚠️ <b>Дедлайн минув учора</b>';
    const to = (x.who.length ? x.who.filter((id) => x.doneBy.indexOf(id) < 0) : [x.authorId]).filter((id) => isReal_(id) && wants_(id, 'tasks') && (S.wsOpen[x.ws] || isSuperId_(id)));
    to.forEach((id) => sendApp_(id, head + ' · ' + esc_(S.wsNames[x.ws] || 'робочий простір') + '\n\n<b>' + esc_(x.title) + '</b>' + (x.check.length ? '\n☑️ ' + x.check.filter((k) => k.d).length + ' з ' + x.check.length : ''), 'Відкрити задачу', wsCardLink_(x.id)));
    S.run('UPDATE ws_cards SET reminded = ? WHERE id = ?', [today, x.id]);
  });
}

Object.assign(NEEDS, {
  ws: { ws: true }, wsCard: { ws: true, wsComments: true }, wsCardSave: { ws: true }, wsTick: { ws: true }, wsCardDelete: { ws: true }, wsComment: { ws: true, wsComments: true }, wsCommentDelete: { ws: true, wsComments: true },
  wsColSave: { ws: true }, wsColDelete: { ws: true }, wsBoardSave: { ws: true }, wsBoardDelete: { ws: true },
  wsPage: { ws: true, wsPage: true }, wsPageSave: { ws: true }, wsPageDelete: { ws: true }, wsItemSave: { ws: true }, wsItemDelete: { ws: true }, wsStrategySave: { ws: true },
  wsPeopleFind: { ws: true }, wsMemberSave: { ws: true }, wsMemberRemove: { ws: true }, wsOpen: { ws: true },
  wsProfiles: { ws: true, wsKv: ['profiles', 'photos'] }, wsAnalytics: { ws: true, wsKv: ['oto'], wsStats: true }, wsImport: { ws: true },
});
NEEDS.me.wsMine = true;
{
  const meBase = API.me;
  API.me = function (c, d) { const o = meBase(c, d); if (o && o.status === 'active') o.ws = wsMineOut_(c); return o; };
}

export const __test = { wsReminder_, nameScore_, API, Store, use, verifyInitData, weekKey_, kyivDay, weeklyReminder, eventReminder, resetBase: () => { BASE = null; } };
