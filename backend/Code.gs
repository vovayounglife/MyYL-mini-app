/**
 * ════════════════════════════════════════════════════════════════
 *  Young Life Україна · Mini App · бекенд
 *  Google Apps Script, привʼязаний до Google Таблиці «⚙️ Система»
 * ════════════════════════════════════════════════════════════════
 *
 *  Що тут живе:
 *   • API для Mini App (doPost з полем action)
 *   • вебхук Telegram-бота (doPost з ?key=…)
 *   • структура на Диску: Young Life Mini App / Регіон / Ерія / таблиця команди
 *   • доступи на Диску за ролями, нагадування, сповіщення
 *
 *  ⚠️ Після БУДЬ-ЯКОЇ зміни коду:
 *  Розгорнути → Керувати розгортаннями → ✏️ → Версія: «Нова версія» → Розгорнути.
 */

// ───────────────────────────── НАЛАШТУВАННЯ ─────────────────────────────

const TZ = 'Europe/Kiev';
const APP_URL = 'https://vovayounglife.github.io/MyYL-mini-app/';
const ROOT_FOLDER_NAME = 'Young Life Mini App';
const INITDATA_MAX_AGE_SEC = 7 * 24 * 3600;

// rank: менше число = вища роль. level: до чого привʼязана роль.
const ROLES = [
  { key: 'SUPER', label: 'Раб Божий', rank: 0, level: 'nat' },          // власник системи — найвища роль
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
];
// Права ролей команди (найнижча роль, якій ще можна):
const RANK = {
  CLUB: 7,      // клуби вносять Капітан, Адмін команди
  MG: 9,        // малі групи — Лідер, DGL і вище
  KR: 10,       // контактну роботу — Помічник і вище
  KNOWN: 10,    // знані по імені бачать і ведуть Помічник і вище
  FINANCE: 7,   // фінанси — Капітан, Адмін команди
  APPROVE: 6,   // підтверджують ролі Капітан і вище
  EVENT: 9,     // події в календар — Лідер і вище
  GMAIL: 6,     // Gmail для доступу до таблиць — Капітан і вище
};

// ───────────────────────────── СТРУКТУРА ТАБЛИЦІ ─────────────────────────────

const SH = {
  HELP: 'ℹ️ Як це працює', REGIONS: 'Регіони', AREAS: 'Ерії', TEAMS: 'Команди', PEOPLE: 'Люди', ROLES: 'Ролі',
  EVENTS: 'Події', RSVP: 'Учасники подій', LOG: 'Зведення', SETTINGS: 'Налаштування',
};
const ST = { PENDING: 'очікує', ACTIVE: 'активна', REJECTED: 'відхилена', REMOVED: 'знята' };
const HEAD = {
  REGIONS: ['ID', 'Назва', 'Папка'],
  AREAS: ['ID', 'Регіон ID', 'Назва', 'Папка'],
  TEAMS: ['ID', 'Ерія ID', 'Назва', 'Таблиця', 'Активна', 'Знаних'],
  PEOPLE: ['Telegram ID', 'Username', "Ім'я", 'Телефон', 'Gmail', 'Дата народження', 'Рік покаяння', 'Рік хрещення', 'Рік ЛПYL', 'Відповідальності', 'Зареєстровано', 'Статус'],
  ROLES: ['ID', 'Telegram ID', "Ім'я", 'Роль', 'Рівень', 'Обʼєкт ID', 'Обʼєкт', 'Статус', 'Хто вирішив', 'Дата заявки', 'Дата рішення'],
  EVENTS: ['ID', 'Рівень', 'Обʼєкт ID', 'Назва', 'Дата', 'Час', 'Місце', 'Опис', 'Автор ID', 'Автор', 'Створено'],
  RSVP: ['Подія ID', 'Telegram ID', "Ім'я", 'Команда', 'Дата'],
  LOG: ['Записано', 'Дата', 'Тиждень', 'Тип', 'Режим', 'Команда ID', 'Ерія ID', 'Регіон ID', 'Кількість', 'Нових', 'Лідерів', 'Годин', 'Надійшло', 'Витрачено', 'Автор ID', 'Автор'],
  SETTINGS: ['Ключ', 'Значення', 'Опис'],
};
const TEAM_HEAD = {
  'Клуби': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Підлітків', 'Нових', 'Лідерів', 'Присутні', 'Нотатка', 'Автор'],
  'Малі групи': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Учасників', 'Нових', 'Тема', 'Присутні', 'Нотатка', 'Автор'],
  'КР': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Годин', 'Нотатка', 'Автор'],
  'Знані': ['ID', "Ім'я", 'Телефон', 'Instagram', 'День народження', 'Школа', 'Клас', 'Лідер', 'Нотатка', 'Додано', 'Активний'],
  'Фінанси': ['Місяць', 'Попередній залишок', 'Дав офіс', 'Дала церква', 'Зібрали командою', 'Витратили', 'Залишок', 'Автор', 'Оновлено'],
};
const MODE = { event: 'подія', week: 'тиждень', none: 'не було' };
const TYPE_LABEL = { club: 'Клуб', mg: 'Мала група', kr: 'Контактна робота' };
const SEED_REGIONS = [
  ['West', ['Чернівці У', 'Чернівці Б', 'Тернопіль', 'Львів', 'Закарпаття', 'Івано-Франківськ']],
  ['Kyiv', []], ['Central', []], ['North', []], ['South', []], ['East', []], ['Office', []],
];
const REGION_ALIASES = { 'West': ['West Side'] }; // старі назви, які перейменовуються в нові
const SEED_SETTINGS = [
  ['REMINDER_DAY', 'SUNDAY', 'День щотижневого нагадування про звіти (MONDAY…SUNDAY)'],
  ['REMINDER_HOUR', 18, 'Година нагадування'],
  ['EVENT_REMIND_DAYS', '3,1', 'За скільки днів нагадувати про подію'],
];

// ───────────────────────────── ВХІД ─────────────────────────────

function doGet() { return HtmlService.createHtmlOutput('Young Life Mini App · бекенд працює ✅'); }

function doPost(e) {
  resetMemo_();
  const props = PropertiesService.getScriptProperties();
  // 1) Вебхук Telegram
  if (e && e.parameter && e.parameter.key) {
    try {
      if (e.parameter.key === props.getProperty('WEBHOOK_KEY') && !e.parameter.ping) {
        const upd = JSON.parse(e.postData.contents);
        const cache = CacheService.getScriptCache();
        if (!cache.get('upd_' + upd.update_id)) { cache.put('upd_' + upd.update_id, '1', 21600); onUpdate_(upd); }
      }
    } catch (err) { console.error(err && err.stack || err); }
    return HtmlService.createHtmlOutput('ok');
  }
  // 2) API для Mini App
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const tgUser = verifyInitData_(req.initData);
    if (!tgUser) throw new ApiError('auth', 'Не вдалося перевірити Telegram. Відкрий застосунок заново.');
    const fn = API[req.action];
    if (!fn) throw new ApiError('bad_action', 'Невідома дія: ' + req.action);
    out = { ok: true, data: fn(ctx_(tgUser), req.data || {}) };
  } catch (err) {
    if (!(err instanceof ApiError)) console.error(err && err.stack || err);
    out = { ok: false, error: err.code || 'error', message: err instanceof ApiError ? err.message : 'Сталася помилка. Спробуй ще раз.' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function ApiError(code, message) { this.code = code; this.message = message; }
ApiError.prototype = Object.create(Error.prototype);
function deny_(msg) { throw new ApiError('forbidden', msg || 'Немає доступу.'); }
function bad_(msg) { throw new ApiError('bad_request', msg); }

// ───────────────────────────── ПЕРЕВІРКА TELEGRAM ─────────────────────────────

function verifyInitData_(initData) {
  if (!initData || typeof initData !== 'string') return null;
  const token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) throw new ApiError('setup', 'Бот ще не налаштований.');
  const params = {};
  initData.split('&').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i < 0) return;
    params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
  });
  const hash = params.hash;
  if (!hash) return null;
  delete params.hash;
  const dcs = Object.keys(params).sort().map(function (k) { return k + '=' + params[k]; }).join('\n');
  const secret = Utilities.computeHmacSha256Signature(bytes_(token), bytes_('WebAppData'));
  const calc = hex_(Utilities.computeHmacSha256Signature(bytes_(dcs), secret));
  if (calc !== hash) return null;
  const age = Date.now() / 1000 - Number(params.auth_date || 0);
  if (age > INITDATA_MAX_AGE_SEC) throw new ApiError('auth_expired', 'Сесія застаріла. Закрий і відкрий застосунок заново.');
  try { return JSON.parse(params.user); } catch (e) { return null; }
}
function bytes_(s) { return Utilities.newBlob(s).getBytes(); }
function hex_(b) { return b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join(''); }

// ───────────────────────────── КОНТЕКСТ КОРИСТУВАЧА ─────────────────────────────

function ctx_(tg) {
  const id = String(tg.id);
  const person = getPerson_(id);
  const all = loadRoles_().filter(function (r) { return r.tgId === id; });
  const active = all.filter(function (r) { return r.status === ST.ACTIVE; });
  return { id: id, tg: tg, person: person, roles: active, allRoles: all, name: (person && person.name) || fullName_(tg) };
}

function roleDef_(key) { return ROLES.filter(function (r) { return r.key === key; })[0] || null; }
function roleByLabel_(v) {
  const s = str_(v).toLowerCase();
  return ROLES.filter(function (r) { return r.label.toLowerCase() === s || r.key.toLowerCase() === s; })[0] || null;
}

// чи роль r «накриває» обʼєкт рівня level з id
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
function upperRoles_(c) { return c.roles.filter(function (r) { return r.level !== 'team'; }); }
function teamRoles_(c, teamId, maxRank) {
  return c.roles.filter(function (r) { return r.level === 'team' && r.unitId === teamId && r.rank <= maxRank; });
}
function canViewTeam_(c, teamId) { return c.roles.some(function (r) { return covers_(r, 'team', teamId); }); }
function canTeam_(c, teamId, maxRank) {
  return teamRoles_(c, teamId, maxRank).length > 0 || upperRoles_(c).some(function (r) { return covers_(r, 'team', teamId); });
}
function isSugarOnly_(c) { return c.roles.length > 0 && c.roles.every(function (r) { return r.key === 'SUGAR'; }); }
function canDecide_(c, target) {
  const def = roleDef_(target.key);
  if (!def) return false;
  return c.roles.some(function (r) { return r.rank <= RANK.APPROVE && r.rank < def.rank && covers_(r, target.level, target.unitId); });
}
function reportTeams_(c, maxRank) {
  const st = loadStruct_();
  const ids = {};
  c.roles.forEach(function (r) {
    if (r.level === 'team' && r.rank <= maxRank && st.team[r.unitId] && st.team[r.unitId].active) ids[r.unitId] = true;
    if (r.level !== 'team') st.teams.forEach(function (t) { if (t.active && covers_(r, 'team', t.id)) ids[t.id] = true; });
  });
  return Object.keys(ids);
}

// ───────────────────────────── API ─────────────────────────────

const API = {};

API.me = function (c) {
  const st = loadStruct_();
  const out = {
    user: { id: c.id, name: c.name, username: c.tg.username || '', phone: c.person ? c.person.phone : '', email: c.person ? c.person.email : '', title: c.person ? c.person.title : '' },
    profile: c.person ? profileOf_(c.person) : null,
    structure: {
      regions: st.regions.map(function (r) { return { id: r.id, name: r.name }; }),
      areas: st.areas.map(function (a) { return { id: a.id, regionId: a.regionId, name: a.name }; }),
      teams: st.teams.filter(function (t) { return t.active; }).map(function (t) { return { id: t.id, areaId: t.areaId, name: t.name }; }),
    },
    roleDefs: ROLES.map(function (r) { return { key: r.key, label: r.label, level: r.level, rank: r.rank }; }),
    roles: c.allRoles.filter(function (r) { return r.status === ST.ACTIVE || r.status === ST.PENDING; }).map(roleOut_),
  };
  if (!c.roles.length) {
    out.status = c.allRoles.some(function (r) { return r.status === ST.PENDING; }) ? 'pending' : 'new';
    if (out.status === 'pending') out.approvers = pendingApproversText_(c);
    return out;
  }
  out.status = 'active';
  const myTeams = {};
  c.roles.forEach(function (r) { if (r.level === 'team' && st.team[r.unitId]) myTeams[r.unitId] = true; });
  out.caps = {
    report: { club: reportTeams_(c, RANK.CLUB), mg: reportTeams_(c, RANK.MG), kr: reportTeams_(c, RANK.KR) },
    knownTeams: reportTeams_(c, RANK.KNOWN),
    financeTeams: reportTeams_(c, RANK.FINANCE),
    viewTeams: st.teams.filter(function (t) { return t.active && canViewTeam_(c, t.id); }).map(function (t) { return t.id; }),
    approve: c.roles.some(function (r) { return r.rank <= RANK.APPROVE; }),
    eventUnits: eventUnits_(c),
    upper: upperRoles_(c).length > 0,
    sugarOnly: isSugarOnly_(c),
    surveys: false,
    manage: c.roles.some(function (r) { return MANAGE_AREAS.indexOf(r.key) >= 0 || MANAGE_TEAMS.indexOf(r.key) >= 0; }),
  };
  out.myTeams = Object.keys(myTeams).map(function (id) { return teamOut_(id); });
  out.scopes = allowedScopes_(c);
  out.week = weekStatus_(c);
  out.pendingCount = out.caps.approve ? pendingFor_(c).length : 0;
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
  const keys = d.roles.map(String).filter(function (k) { return roleDef_(k); });
  if (!keys.length) bad_('Обери хоча б одну роль.');
  const needTeam = keys.some(function (k) { return roleDef_(k).level === 'team'; });
  if (needTeam && !teamId) {
    const newName = str_(d.newTeamName);
    if (!newName) bad_('Обери команду або впиши назву нової.');
    if (!st.area[areaId]) bad_('Обери ерію.');
    teamId = createTeam_(areaId, newName, false);
  }
  if (needTeam && !st.team[teamId] && !loadStruct_(true).team[teamId]) bad_('Команду не знайдено.');
  if (keys.some(function (k) { return roleDef_(k).rank <= RANK.GMAIL; }) && !/@/.test(str_(d.email) || (getPerson_(c.id) || {}).email || '')) {
    bad_('Для ролі Капітан і вище вкажи Gmail — на нього відкриється доступ до таблиць.');
  }
  if (d.email) savePerson_(c, { email: d.email });
  const created = [];
  withLock_(function () {
    resetMemo_('roles');
    const existing = loadRoles_().filter(function (r) { return r.tgId === c.id && (r.status === ST.ACTIVE || r.status === ST.PENDING); });
    keys.forEach(function (k) {
      const def = roleDef_(k);
      const unitId = def.level === 'team' ? teamId : def.level === 'area' ? areaId : def.level === 'region' ? regionId : '';
      if (def.level !== 'nat' && !unitId) bad_('Не вказано, де саме роль «' + def.label + '».');
      if (existing.some(function (r) { return r.key === k && r.unitId === unitId; })) return;
      const row = {
        'ID': uid_(), 'Telegram ID': c.id, "Ім'я": (getPerson_(c.id) || {}).name || c.name, 'Роль': def.label, 'Рівень': def.level,
        'Обʼєкт ID': unitId, 'Обʼєкт': unitName_(def.level, unitId), 'Статус': ST.PENDING, 'Дата заявки': new Date(),
      };
      append_(SH.ROLES, row);
      created.push(row['ID']);
    });
  });
  resetMemo_('roles');
  if (created.length) notifyApprovers_(c, created);
  return { status: 'pending', approvers: pendingApproversText_(ctx_(c.tg)) };
}

API.requests = function (c) {
  if (!c.roles.some(function (r) { return r.rank <= RANK.APPROVE; })) deny_();
  const byPerson = {};
  pendingFor_(c).forEach(function (r) {
    const p = byPerson[r.tgId] = byPerson[r.tgId] || { tgId: r.tgId, name: r.name, username: '', when: r.requested, roles: [] };
    const person = getPerson_(r.tgId);
    if (person) { p.username = person.username; p.phone = person.phone; }
    p.roles.push(roleOut_(r));
  });
  return Object.keys(byPerson).map(function (k) { return byPerson[k]; });
};

API.decide = function (c, d) {
  const ids = (d.roleIds || []).map(String);
  const approve = !!d.approve;
  const done = [];
  withLock_(function () {
    resetMemo_('roles');
    loadRoles_().filter(function (r) { return ids.indexOf(r.id) >= 0 && r.status === ST.PENDING; }).forEach(function (r) {
      if (!canDecide_(c, r)) deny_('Ти не можеш вирішувати щодо ролі «' + r.label + '».');
      if (approve && r.level === 'team') activateTeam_(r.unitId);
      update_(SH.ROLES, r.row, { 'Статус': approve ? ST.ACTIVE : ST.REJECTED, 'Хто вирішив': c.name, 'Дата рішення': new Date() });
      done.push(r);
    });
  });
  resetMemo_();
  if (!done.length) return { done: 0 };
  const tgId = done[0].tgId;
  if (approve) {
    done.forEach(function (r) { try { grantDrive_(r); } catch (e) { console.warn('Drive: ' + e); } });
    sendApp_(tgId, '🎉 Доступ відкрито!\nРолі: <b>' + esc_(done.map(function (r) { return r.label + ' · ' + r.unitName; }).join(', ')) + '</b>', 'Відкрити застосунок');
  } else {
    send_(tgId, 'Заявку на роль «' + esc_(done.map(function (r) { return r.label; }).join(', ')) + '» не підтверджено. Якщо це помилка — звернись до свого керівника.');
  }
  return { done: done.length };
};

API.removeRole = function (c, d) {
  const r = loadRoles_().filter(function (x) { return x.id === String(d.roleId) && x.status === ST.ACTIVE; })[0];
  if (!r) bad_('Роль не знайдено.');
  if (r.tgId !== c.id && !canDecide_(c, r)) deny_();
  update_(SH.ROLES, r.row, { 'Статус': ST.REMOVED, 'Хто вирішив': c.name, 'Дата рішення': new Date() });
  resetMemo_('roles');
  try { revokeDrive_(r); } catch (e) { console.warn('Drive: ' + e); }
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
  const date = mode === 'event' && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? parseDay_(d.date) : new Date();
  const week = weekKey_(date);
  const n = function (v) { const x = Number(v); return isFinite(x) && x >= 0 ? x : 0; };
  const none = mode === 'none';
  const st = loadStruct_();
  const team = st.team[teamId];
  const ss = teamSS_(teamId);
  const att = (d.attendees || []).map(String).join(',');
  const now = new Date();
  withLock_(function () {
    if (type === 'club') appendTo_(ss, 'Клуби', { 'Записано': now, 'Дата': date, 'Тиждень': "'" + week, 'Режим': MODE[mode], 'Підлітків': none ? 0 : n(d.teens), 'Нових': none ? 0 : n(d.newT), 'Лідерів': none ? 0 : n(d.leaders), 'Присутні': att, 'Нотатка': cell_(d.note), 'Автор': c.name });
    if (type === 'mg') appendTo_(ss, 'Малі групи', { 'Записано': now, 'Дата': date, 'Тиждень': "'" + week, 'Режим': MODE[mode], 'Учасників': none ? 0 : n(d.teens), 'Нових': none ? 0 : n(d.newT), 'Тема': cell_(d.topic), 'Присутні': att, 'Нотатка': cell_(d.note), 'Автор': c.name });
    if (type === 'kr') appendTo_(ss, 'КР', { 'Записано': now, 'Дата': date, 'Тиждень': "'" + week, 'Режим': MODE[mode], 'Годин': none ? 0 : n(d.hours), 'Нотатка': cell_(d.note), 'Автор': c.name });
    append_(SH.LOG, {
      'Записано': now, 'Дата': date, 'Тиждень': "'" + week, 'Тип': type, 'Режим': MODE[mode], 'Команда ID': teamId, 'Ерія ID': team.areaId,
      'Регіон ID': st.teamRegion(teamId), 'Кількість': none ? 0 : n(d.teens), 'Нових': none ? 0 : n(d.newT), 'Лідерів': none ? 0 : n(d.leaders),
      'Годин': none ? 0 : n(d.hours), 'Автор ID': c.id, 'Автор': c.name,
    });
  });
  resetMemo_('log');
  return { week: weekStatus_(c) };
};

// ── знані по імені ──
function canKnown_(c, teamId) { return canTeam_(c, teamId, RANK.KNOWN); }

API.knownList = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canKnown_(c, teamId)) deny_();
  return readSheet_(teamSS_(teamId).getSheetByName('Знані')).filter(function (r) { return !no_(r['Активний']); }).map(function (r) {
    return {
      id: str_(r['ID']), name: str_(r["Ім'я"]), phone: str_(r['Телефон']), ig: str_(r['Instagram']), bday: str_(dayStr_(r['День народження'])),
      school: str_(r['Школа']), grade: str_(r['Клас']), leader: str_(r['Лідер']), note: str_(r['Нотатка']),
    };
  });
};

API.knownSave = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canKnown_(c, teamId)) deny_();
  const it = d.item || {};
  if (str_(it.name).length < 2) bad_('Вкажи імʼя.');
  const ss = teamSS_(teamId);
  const sh = ss.getSheetByName('Знані');
  const vals = { "Ім'я": cell_(it.name), 'Телефон': cell_(it.phone), 'Instagram': cell_(it.ig), 'День народження': cell_(it.bday), 'Школа': cell_(it.school), 'Клас': cell_(it.grade), 'Лідер': cell_(it.leader), 'Нотатка': cell_(it.note) };
  let id = str_(it.id);
  withLock_(function () {
    const existing = id ? readSheet_(sh).filter(function (r) { return str_(r['ID']) === id; })[0] : null;
    if (existing) { updateIn_(sh, existing._row, vals); return; }
    id = uid_();
    appendTo_(ss, 'Знані', Object.assign({ 'ID': id, 'Додано': new Date(), 'Активний': 'так' }, vals));
    const st = loadStruct_();
    append_(SH.LOG, { 'Записано': new Date(), 'Дата': new Date(), 'Тиждень': "'" + weekKey_(new Date()), 'Тип': 'known', 'Режим': '', 'Команда ID': teamId, 'Ерія ID': st.team[teamId].areaId, 'Регіон ID': st.teamRegion(teamId), 'Кількість': 1, 'Автор ID': c.id, 'Автор': c.name });
    refreshKnownCount_(teamId, sh);
  });
  return { id: id };
};

API.knownArchive = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canKnown_(c, teamId)) deny_();
  const sh = teamSS_(teamId).getSheetByName('Знані');
  const r = readSheet_(sh).filter(function (x) { return str_(x['ID']) === str_(d.id); })[0];
  if (r) { updateIn_(sh, r._row, { 'Активний': 'ні' }); refreshKnownCount_(teamId, sh); }
  return { ok: true };
};

function refreshKnownCount_(teamId, sh) {
  const n = readSheet_(sh).filter(function (r) { return !no_(r['Активний']); }).length;
  const t = loadStruct_(true).team[teamId];
  if (t) update_(SH.TEAMS, t.row, { 'Знаних': n });
  resetMemo_('struct');
}

// ── склад команди ──
API.teamMembers = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canViewTeam_(c, teamId)) deny_();
  const byPerson = {};
  loadRoles_().filter(function (r) { return r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId; }).forEach(function (r) {
    const p = byPerson[r.tgId] = byPerson[r.tgId] || { tgId: r.tgId, name: r.name, roles: [], rank: 99 };
    p.roles.push({ id: r.id, label: r.label, canRemove: canDecide_(c, r) });
    p.rank = Math.min(p.rank, r.rank);
  });
  return Object.keys(byPerson).map(function (k) {
    const p = byPerson[k];
    const person = getPerson_(k);
    if (person) { p.name = person.name || p.name; p.username = person.username; p.profile = profileOf_(person); }
    return p;
  }).sort(function (a, b) { return a.rank - b.rank || a.name.localeCompare(b.name); });
};

// ── фінанси ──
API.financeGet = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canTeam_(c, teamId, RANK.FINANCE)) deny_();
  const rows = readSheet_(teamSS_(teamId).getSheetByName('Фінанси')).map(finOut_).sort(function (a, b) { return a.month < b.month ? 1 : -1; });
  const month = /^\d{4}-\d{2}$/.test(d.month || '') ? d.month : Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  const cur = rows.filter(function (r) { return r.month === month; })[0];
  const prevRow = rows.filter(function (r) { return r.month < month; })[0];
  return {
    month: month,
    current: cur || { month: month, prev: prevRow ? prevRow.balance : 0, office: 0, church: 0, team: 0, spent: 0, balance: prevRow ? prevRow.balance : 0 },
    history: rows.filter(function (r) { return r.month !== month; }).slice(0, 6),
    canEdit: canTeam_(c, teamId, RANK.FINANCE),
  };
};

API.financeSave = function (c, d) {
  const teamId = str_(d.teamId);
  if (!canTeam_(c, teamId, RANK.FINANCE)) deny_();
  const month = str_(d.month);
  if (!/^\d{4}-\d{2}$/.test(month)) bad_('Невірний місяць.');
  const n = function (v) { const x = Number(v); return isFinite(x) ? x : 0; };
  const v = { prev: n(d.prev), office: n(d.office), church: n(d.church), team: n(d.team), spent: n(d.spent) };
  v.balance = v.prev + v.office + v.church + v.team - v.spent;
  const ss = teamSS_(teamId);
  const sh = ss.getSheetByName('Фінанси');
  const st = loadStruct_();
  withLock_(function () {
    const vals = { 'Місяць': "'" + month, 'Попередній залишок': v.prev, 'Дав офіс': v.office, 'Дала церква': v.church, 'Зібрали командою': v.team, 'Витратили': v.spent, 'Залишок': v.balance, 'Автор': c.name, 'Оновлено': new Date() };
    const ex = readSheet_(sh).filter(function (r) { return monthKey_(r['Місяць']) === month; })[0];
    if (ex) updateIn_(sh, ex._row, vals); else appendTo_(ss, 'Фінанси', vals);
    // у зведенні — один рядок на команду й місяць
    const logSh = sheet_(SH.LOG);
    readSheet_(logSh).filter(function (r) { return r['Тип'] === 'fin' && str_(r['Команда ID']) === teamId && monthKey_(r['Дата']) === month; })
      .map(function (r) { return r._row; }).sort(function (a, b) { return b - a; }).forEach(function (row) { logSh.deleteRow(row); });
    append_(SH.LOG, { 'Записано': new Date(), 'Дата': parseDay_(month + '-01'), 'Тиждень': "'" + weekKey_(parseDay_(month + '-01')), 'Тип': 'fin', 'Режим': '', 'Команда ID': teamId, 'Ерія ID': st.team[teamId].areaId, 'Регіон ID': st.teamRegion(teamId), 'Надійшло': v.office + v.church + v.team, 'Витрачено': v.spent, 'Автор ID': c.id, 'Автор': c.name });
  });
  resetMemo_('log');
  return v;
};

// ── календар ──
function eventUnits_(c) {
  const out = [];
  const seen = {};
  c.roles.forEach(function (r) {
    if (r.level === 'team' && r.rank > RANK.EVENT) return;
    const k = r.level + ':' + r.unitId;
    if (seen[k]) return;
    seen[k] = true;
    out.push({ level: r.level, unitId: r.unitId, label: levelLabel_(r.level, r.unitId) });
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
  return c.roles.some(function (r) {
    if (covers_(r, ev.level, ev.unitId)) return true;
    return ancestors_(r.level, r.unitId).some(function (a) { return a.level === ev.level && a.unitId === ev.unitId; });
  });
}
function canManageEvent_(c, ev) {
  if (ev.authorId === c.id) return true;
  return c.roles.some(function (r) { return r.rank <= RANK.APPROVE && covers_(r, ev.level, ev.unitId); });
}

API.events = function (c) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const rsvp = readAll_(SH.RSVP);
  return loadEvents_().filter(function (e) { return e.date >= today && canSeeEvent_(c, e); }).map(function (e) {
    const people = rsvp.filter(function (r) { return str_(r['Подія ID']) === e.id; });
    const manage = canManageEvent_(c, e);
    return Object.assign({}, e, {
      levelLabel: levelLabel_(e.level, e.unitId), going: people.length,
      isGoing: people.some(function (r) { return str_(r['Telegram ID']) === c.id; }),
      manage: manage,
      people: manage ? people.map(function (r) { return { name: str_(r["Ім'я"]), team: str_(r['Команда']) }; }) : [],
    });
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
};

API.eventSave = function (c, d) {
  const units = eventUnits_(c);
  const u = units.filter(function (x) { return x.level === d.level && x.unitId === str_(d.unitId); })[0];
  if (!u) deny_('Ти не можеш додавати події на цьому рівні.');
  if (str_(d.title).length < 2) bad_('Вкажи назву.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) bad_('Вкажи дату.');
  const id = uid_();
  append_(SH.EVENTS, { 'ID': id, 'Рівень': u.level, 'Обʼєкт ID': u.unitId, 'Назва': cell_(d.title), 'Дата': "'" + d.date, 'Час': cell_(d.time), 'Місце': cell_(d.place), 'Опис': cell_(d.desc), 'Автор ID': c.id, 'Автор': c.name, 'Створено': new Date() });
  resetMemo_('events');
  rsvpSet_(c, id, true);
  return { id: id };
};

API.eventDelete = function (c, d) {
  const e = loadEvents_().filter(function (x) { return x.id === str_(d.id); })[0];
  if (!e) bad_('Подію не знайдено.');
  if (!canManageEvent_(c, e)) deny_();
  sheet_(SH.EVENTS).deleteRow(e.row);
  resetMemo_('events');
  return { ok: true };
};

API.rsvp = function (c, d) {
  const e = loadEvents_().filter(function (x) { return x.id === str_(d.id); })[0];
  if (!e || !canSeeEvent_(c, e)) deny_();
  rsvpSet_(c, e.id, !!d.going);
  return { ok: true };
};

function rsvpSet_(c, eventId, going) {
  withLock_(function () {
    const sh = sheet_(SH.RSVP);
    const mine = readSheet_(sh).filter(function (r) { return str_(r['Подія ID']) === eventId && str_(r['Telegram ID']) === c.id; });
    if (going && !mine.length) {
      const team = c.roles.filter(function (r) { return r.level === 'team'; })[0];
      append_(SH.RSVP, { 'Подія ID': eventId, 'Telegram ID': c.id, "Ім'я": c.name, 'Команда': team ? team.unitName : '', 'Дата': new Date() });
    }
    if (!going) mine.map(function (r) { return r._row; }).sort(function (a, b) { return b - a; }).forEach(function (row) { sh.deleteRow(row); });
  });
  resetMemo_('rsvp');
}

// ── структура: ерії й команди ──
// Хто редагує ерії свого регіону (Раб Божий — усі регіони):
const MANAGE_AREAS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN'];
// Хто створює й редагує команди (Еріа Директор — у своїй ерії; регіон — у своєму регіоні; Раб Божий — усюди):
const MANAGE_TEAMS = ['SUPER', 'REGIONAL_DIRECTOR', 'REGIONAL_ADMIN', 'AREA_DIRECTOR'];

function canEditAreas_(c, regionId) {
  return c.roles.some(function (r) { return r.key === 'SUPER' || (MANAGE_AREAS.indexOf(r.key) >= 0 && r.level === 'region' && r.unitId === regionId); });
}
function canEditTeams_(c, areaId) {
  return c.roles.some(function (r) { return MANAGE_TEAMS.indexOf(r.key) >= 0 && covers_(r, 'area', areaId); });
}
function cleanName_(v) {
  const n = str_(v).replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) bad_('Назва має бути від 2 до 60 символів.');
  return n;
}

API.structureTree = function (c) {
  const st = loadStruct_();
  const people = {};
  loadRoles_().filter(function (r) { return r.status === ST.ACTIVE && r.level === 'team'; }).forEach(function (r) { (people[r.unitId] = people[r.unitId] || {})[r.tgId] = true; });
  return st.regions.map(function (rg) {
    const editAreas = canEditAreas_(c, rg.id);
    const areas = st.areas.filter(function (a) { return a.regionId === rg.id && (editAreas || canEditTeams_(c, a.id)); }).map(function (a) {
      return {
        id: a.id, name: a.name, canEditTeams: canEditTeams_(c, a.id),
        teams: st.teams.filter(function (t) { return t.areaId === a.id; }).map(function (t) { return { id: t.id, name: t.name, state: t.state, people: Object.keys(people[t.id] || {}).length }; })
          .sort(function (x, y) { return (x.state === 'closed') - (y.state === 'closed') || x.name.localeCompare(y.name); }),
      };
    }).sort(function (x, y) { return x.name.localeCompare(y.name); });
    return { id: rg.id, name: rg.name, canEditAreas: editAreas, areas: areas };
  }).filter(function (rg) { return rg.canEditAreas || rg.areas.length; });
};

API.areaSave = function (c, d) {
  const st = loadStruct_(true);
  if (!d.id && !canEditAreas_(c, str_(d.regionId))) deny_('Ти не можеш додавати ерії в цей регіон.');
  const name = cleanName_(d.name);
  if (d.id) {
    const a = st.area[str_(d.id)];
    if (!a) bad_('Ерію не знайдено.');
    if (!canEditAreas_(c, a.regionId)) deny_('Ти не можеш редагувати цю ерію.');
    if (st.areas.some(function (x) { return x.id !== a.id && x.regionId === a.regionId && x.name.toLowerCase() === name.toLowerCase(); })) bad_('Така ерія в регіоні вже є.');
    update_(SH.AREAS, a.row, { 'Назва': name });
    if (a.folder) { try { DriveApp.getFolderById(a.folder).setName(name); } catch (e) { console.warn(e); } }
    resetMemo_();
    return { id: a.id };
  }
  const regionId = str_(d.regionId);
  if (!st.region[regionId]) bad_('Регіон не знайдено.');
  if (!canEditAreas_(c, regionId)) deny_('Ти не можеш додавати ерії в цей регіон.');
  if (st.areas.some(function (x) { return x.regionId === regionId && x.name.toLowerCase() === name.toLowerCase(); })) bad_('Така ерія в регіоні вже є.');
  const id = uid_();
  append_(SH.AREAS, { 'ID': id, 'Регіон ID': regionId, 'Назва': name });
  resetMemo_();
  return { id: id };
};

API.teamSave = function (c, d) {
  const st = loadStruct_(true);
  if (d.id) {
    const t = st.team[str_(d.id)];
    if (!t) bad_('Команду не знайдено.');
    if (!canEditTeams_(c, t.areaId)) deny_('Ти не можеш редагувати цю команду.');
    const v = {};
    if (d.name != null) {
      const name = cleanName_(d.name);
      if (st.teams.some(function (x) { return x.id !== t.id && x.areaId === t.areaId && x.name.toLowerCase() === name.toLowerCase(); })) bad_('Така команда в ерії вже є.');
      v['Назва'] = name;
      if (t.file) { try { DriveApp.getFileById(t.file).setName('Команда «' + name + '»'); } catch (e) { console.warn(e); } }
    }
    if (d.state === 'active') v['Активна'] = 'так';
    if (d.state === 'closed') v['Активна'] = 'ні';
    update_(SH.TEAMS, t.row, v);
    resetMemo_();
    return { id: t.id };
  }
  const areaId = str_(d.areaId);
  if (!st.area[areaId]) bad_('Ерію не знайдено.');
  if (!canEditTeams_(c, areaId)) deny_('Ти не можеш створювати команди в цій ерії.');
  const name = cleanName_(d.name);
  if (st.teams.some(function (x) { return x.areaId === areaId && x.name.toLowerCase() === name.toLowerCase(); })) bad_('Така команда в ерії вже є.');
  const id = createTeam_(areaId, name, true);
  return { id: id };
};

// ── статистика ──
API.stats = function (c, d) {
  const scopes = allowedScopes_(c);
  const scope = scopes.filter(function (s) { return s.key === d.scope; })[0] || scopes[0];
  if (!scope) deny_();
  const cats = statCats_(c, scope);
  const cat = cats.some(function (x) { return x.key === d.cat; }) ? d.cat : cats[0].key;
  return computeStats_(c, scope, cat, d.period || 'month', cats, scopes);
};

API.nudge = function (c, d) {
  if (!c.roles.some(function (r) { return r.rank <= RANK.APPROVE; })) deny_();
  const scope = allowedScopes_(c).filter(function (s) { return s.key === d.scope; })[0];
  if (!scope) deny_();
  const type = d.type;
  if (!TYPE_LABEL[type]) bad_('Невідомий тип.');
  const miss = missingFor_(scope, type);
  let sent = 0;
  miss.people.forEach(function (tgId) {
    const r = sendApp_(tgId, '🔔 Нагадування: заповни, будь ласка, «' + TYPE_LABEL[type] + '» за цей тиждень. Якщо не було — так і відміть.', 'Відкрити');
    if (r && r.ok) sent++;
    Utilities.sleep(40);
  });
  return { sent: sent };
};

// ───────────────────────────── СТАТИСТИКА: ОБЧИСЛЕННЯ ─────────────────────────────

function allowedScopes_(c) {
  const st = loadStruct_();
  const seen = {};
  const out = [];
  const add = function (key, label, depth, level, unitId, sub, name) { if (seen[key]) return; seen[key] = true; out.push({ key: key, label: label, depth: depth, level: level, unitId: unitId, sub: sub || '', name: name || label }); };
  const addTeam = function (t, depth) { if (t.active) { const a = st.area[t.areaId] || {}; add('t:' + t.id, t.name, depth, 'team', t.id, (a.name || '') + ' · ' + ((st.region[a.regionId] || {}).name || ''), t.name); } };
  const addArea = function (a, depth) { add('a:' + a.id, 'Ерія ' + a.name, depth, 'area', a.id, 'регіон ' + ((st.region[a.regionId] || {}).name || ''), a.name); st.teams.filter(function (t) { return t.areaId === a.id; }).forEach(function (t) { addTeam(t, depth + 1); }); };
  const addRegion = function (r, depth) { add('r:' + r.id, 'Регіон ' + r.name, depth, 'region', r.id, '', r.name); st.areas.filter(function (a) { return a.regionId === r.id; }).forEach(function (a) { addArea(a, depth + 1); }); };
  const sorted = c.roles.slice().sort(function (a, b) { return a.rank - b.rank; });
  sorted.forEach(function (r) {
    if (r.level === 'nat') { add('nat', 'Уся Україна', 0, 'nat', '', '', 'Україна'); st.regions.forEach(function (x) { addRegion(x, 1); }); }
    if (r.level === 'region' && st.region[r.unitId]) addRegion(st.region[r.unitId], 0);
    if (r.level === 'area' && st.area[r.unitId]) addArea(st.area[r.unitId], 0);
    if (r.level === 'team' && st.team[r.unitId]) addTeam(st.team[r.unitId], 0);
  });
  return out;
}

function scopeTeamIds_(scope) {
  const st = loadStruct_();
  return st.teams.filter(function (t) {
    if (!t.active) return false;
    if (scope.level === 'nat') return true;
    if (scope.level === 'region') return st.teamRegion(t.id) === scope.unitId;
    if (scope.level === 'area') return t.areaId === scope.unitId;
    return t.id === scope.unitId;
  }).map(function (t) { return t.id; });
}

function statCats_(c, scope) {
  if (isSugarOnly_(c)) return [{ key: 'club', label: 'Клуби' }];
  const cats = [{ key: 'overview', label: 'Огляд' }, { key: 'club', label: 'Клуби' }, { key: 'mg', label: 'Малі групи' }, { key: 'kr', label: 'Контактна робота' }];
  const upperCovers = upperRoles_(c).some(function (r) { return covers_(r, scope.level, scope.unitId); });
  const teamOk = function (rank) { return scope.level === 'team' && teamRoles_(c, scope.unitId, rank).length > 0; };
  if (upperCovers || teamOk(RANK.KNOWN)) cats.push({ key: 'known', label: 'Знані' });
  if (upperCovers || teamOk(RANK.FINANCE)) cats.push({ key: 'finance', label: 'Фінанси' });
  return cats;
}

function computeStats_(c, scope, cat, period, cats, scopes) {
  const st = loadStruct_();
  const teamIds = scopeTeamIds_(scope);
  const inScope = {};
  teamIds.forEach(function (id) { inScope[id] = true; });
  const P = { week: 1, month: 4, q: 13, year: 52 }[period] || 4;
  const nowWk = weekKey_(new Date());
  const periodStart = addDaysKey_(nowWk, -7 * (P - 1));
  const chartWeeks = period === 'year' ? 52 : period === 'q' ? 13 : 8;
  const chartStart = addDaysKey_(nowWk, -7 * (chartWeeks - 1));
  const rows = loadLog_().filter(function (r) { return inScope[r.teamId] && r.week >= (periodStart < chartStart ? periodStart : chartStart); });
  const inP = rows.filter(function (r) { return r.week >= periodStart; });
  const ok = function (r) { return r.mode !== MODE.none; };
  const sum = function (arr, f) { return arr.reduce(function (a, r) { return a + (Number(f(r)) || 0); }, 0); };
  const of = function (type, arr) { return (arr || inP).filter(function (r) { return r.type === type; }); };
  const nf = function (v) { return Math.round(v).toLocaleString('uk-UA'); };
  const df = function (v) { return String(Math.round(v * 10) / 10).replace('.', ','); };

  const clubs = of('club').filter(ok), mgs = of('mg').filter(ok), krs = of('kr').filter(ok);
  const knownTotal = teamIds.reduce(function (a, id) { return a + (Number(st.team[id].known) || 0); }, 0);
  const fin = of('fin', rows.filter(function (r) { return r.type === 'fin' && monthKey_(r.date) >= monthKey_(parseDay_(periodStart)); }));
  const K = {
    overview: [[nf(clubs.length), 'Клубів'], [nf(sum(clubs, function (r) { return r.count; })), 'Підлітків на клубах'], [nf(mgs.length), 'Зустрічей малих груп'], [df(sum(krs, function (r) { return r.hours; })), 'Годин контактної роботи']],
    club: [[nf(clubs.length), 'Клубів проведено'], [nf(sum(clubs, function (r) { return r.count; })), 'Відвідувань підлітків'], [clubs.length ? df(sum(clubs, function (r) { return r.count; }) / clubs.length) : '—', 'Середньо на клубі'], [nf(sum(clubs, function (r) { return r.newT; })), 'Нових підлітків']],
    mg: [[nf(mgs.length), 'Зустрічей малих груп'], [nf(sum(mgs, function (r) { return r.count; })), 'Відвідувань'], [mgs.length ? df(sum(mgs, function (r) { return r.count; }) / mgs.length) : '—', 'Середньо на зустрічі'], [nf(sum(mgs, function (r) { return r.newT; })), 'Нових учасників']],
    kr: [[df(sum(krs, function (r) { return r.hours; })), 'Годин контактної роботи'], [df(sum(krs, function (r) { return r.hours; }) / P), 'Годин у середньому за тиждень'], [nf(uniq_(krs.map(function (r) { return r.authorId; })).length), 'Людей вносили КР'], [nf(of('kr').filter(function (r) { return !ok(r); }).length), 'Відміток «не було»']],
    known: [[nf(knownTotal), 'Знаних по імені'], [nf(of('known').length), 'Нових за період'], [nf(teamIds.length), teamIds.length === 1 ? 'Команда' : 'Команд'], [teamIds.length ? df(knownTotal / teamIds.length) : '—', 'У середньому на команду']],
    finance: [[nf(sum(fin, function (r) { return r.inc; })) + ' ₴', 'Надійшло'], [nf(sum(fin, function (r) { return r.spent; })) + ' ₴', 'Витрачено'], [nf(sum(fin, function (r) { return r.inc - r.spent; })) + ' ₴', 'Різниця'], [nf(uniq_(fin.map(function (r) { return r.teamId; })).length), 'Команд здали звіт']],
  };

  // графік
  const metric = {
    overview: function (r) { return r.type === 'club' && ok(r) ? r.count : 0; }, club: function (r) { return r.type === 'club' && ok(r) ? r.count : 0; },
    mg: function (r) { return r.type === 'mg' && ok(r) ? r.count : 0; }, kr: function (r) { return r.type === 'kr' ? r.hours : 0; },
    known: function (r) { return r.type === 'known' ? 1 : 0; }, finance: function (r) { return r.type === 'fin' ? r.inc : 0; },
  }[cat];
  const titles = { overview: 'Підлітки на клубах', club: 'Підлітки на клубах', mg: 'Учасники малих груп', kr: 'Години контактної роботи', known: 'Нові знані по імені', finance: 'Надходження, ₴' };
  let buckets = [];
  if (period === 'year') {
    const ML = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = Utilities.formatDate(d, TZ, 'yyyy-MM');
      buckets.push({ key: mk, label: ML[d.getMonth()], v: 0 });
    }
    rows.forEach(function (r) { const b = buckets.filter(function (x) { return x.key === monthKey_(r.date); })[0]; if (b) b.v += Number(metric(r)) || 0; });
  } else {
    for (let k = chartStart; k <= nowWk; k = addDaysKey_(k, 7)) buckets.push({ key: k, label: k.slice(8, 10) + '.' + k.slice(5, 7), v: 0 });
    rows.forEach(function (r) { const b = buckets.filter(function (x) { return x.key === r.week; })[0]; if (b) b.v += Number(metric(r)) || 0; });
  }

  // розбивка на рівень нижче
  const ML2 = { overview: 'підлітків на клубах', club: 'підлітків на клубах', mg: 'учасників малих груп', kr: 'годин КР', known: 'знаних по імені', finance: 'надходжень, ₴' };
  let groups = [];
  if (scope.level === 'nat') groups = st.regions.map(function (x) { return { key: 'r:' + x.id, name: x.name, test: function (r) { return r.regionId === x.id; }, teams: teamIds.filter(function (id) { return st.teamRegion(id) === x.id; }) }; });
  if (scope.level === 'region') groups = st.areas.filter(function (a) { return a.regionId === scope.unitId; }).map(function (x) { return { key: 'a:' + x.id, name: x.name, test: function (r) { return r.areaId === x.id; }, teams: teamIds.filter(function (id) { return st.team[id].areaId === x.id; }) }; });
  if (scope.level === 'area') groups = teamIds.map(function (id) { return { key: 't:' + id, name: st.team[id].name, test: function (r) { return r.teamId === id; }, teams: [id] }; });
  if (scope.level === 'team' && (cat === 'kr' || cat === 'mg')) {
    const names = {};
    of(cat).forEach(function (r) { names[r.authorId] = r.author; });
    groups = Object.keys(names).map(function (id) { return { key: '', name: names[id], test: function (r) { return r.authorId === id; } }; });
  }
  const scopeKeys = {};
  scopes.forEach(function (s) { scopeKeys[s.key] = true; });
  // хто з дочірніх уже звітував цього тижня (клуби — для огляду/клубів, інакше — свій тип)
  const repType = cat === 'mg' || cat === 'kr' ? cat : 'club';
  const reported = {};
  loadLog_().forEach(function (r) { if (r.week === nowWk && r.type === repType && inScope[r.teamId]) reported[r.teamId] = true; });
  const breakdown = groups.map(function (g) {
    const v = cat === 'known' ? g.teams.reduce(function (a, id) { return a + (Number(st.team[id].known) || 0); }, 0) : sum(inP.filter(g.test), metric);
    const row = { name: g.name, value: v, text: cat === 'kr' ? df(v) : nf(v), drill: g.key && scopeKeys[g.key] ? g.key : '' };
    if (g.teams) { row.total = g.teams.length; row.done = g.teams.filter(function (id) { return reported[id]; }).length; row.teams = g.teams.length; }
    return row;
  }).sort(function (a, b) { return b.value - a.value; });

  // хлібні крихти: від найвищого доступного рівня до поточного
  const chain = [];
  if (scope.level === 'team') { const t = st.team[scope.unitId]; chain.push('nat', 'r:' + st.teamRegion(scope.unitId), 'a:' + t.areaId, scope.key); }
  if (scope.level === 'area') chain.push('nat', 'r:' + st.area[scope.unitId].regionId, scope.key);
  if (scope.level === 'region') chain.push('nat', scope.key);
  if (scope.level === 'nat') chain.push('nat');
  const byKey = {};
  scopes.forEach(function (s) { byKey[s.key] = s; });
  const path = chain.filter(function (k) { return byKey[k]; }).map(function (k) { return { key: k, label: byKey[k].name }; });

  // звітність цього тижня
  const report = ['club', 'mg', 'kr'].map(function (type) {
    const m = weekReport_(scope, type, teamIds);
    return { type: type, label: TYPE_LABEL[type] === 'Клуб' ? 'Клуби' : TYPE_LABEL[type] === 'Мала група' ? 'Малі групи' : 'Контактна робота', ok: m.ok, none: m.none, total: m.total, unit: m.unit, missing: m.missingNames };
  });

  return {
    scope: scope, scopes: scopes, cats: cats, cat: cat, period: period,
    kpis: K[cat].map(function (k) { return { v: k[0], l: k[1] }; }),
    chart: { title: titles[cat], sub: period === 'year' ? 'по місяцях, останні 12' : 'по тижнях, останні ' + buckets.length, bars: buckets.map(function (b) { return { label: b.label, v: b.v }; }) },
    breakdown: { title: ({ nat: 'Регіони', region: 'Ерії', area: 'Команди', team: 'Люди' }[scope.level]), metric: ML2[cat], repLabel: TYPE_LABEL[repType].toLowerCase(), rows: breakdown },
    path: path,
    report: report,
    weekLabel: weekLabel_(nowWk),
    canNudge: c.roles.some(function (r) { return r.rank <= RANK.APPROVE; }),
  };
}

// хто здав цього тижня: клуби — по командах; МГ і КР — по людях (у межах однієї команди) або по командах
function weekReport_(scope, type, teamIds) {
  const wk = weekKey_(new Date());
  const st = loadStruct_();
  const rows = loadLog_().filter(function (r) { return r.week === wk && r.type === type; });
  if (scope.level === 'team' && type !== 'club') {
    const rank = type === 'mg' ? RANK.MG : RANK.KR;
    const people = eligiblePeople_(scope.unitId, rank);
    let okN = 0, noneN = 0;
    const miss = [], missIds = [];
    people.forEach(function (p) {
      const mine = rows.filter(function (r) { return r.authorId === p.tgId && r.teamId === scope.unitId; });
      if (mine.some(function (r) { return r.mode !== MODE.none; })) okN++;
      else if (mine.length) noneN++;
      else { miss.push(p.name); missIds.push(p.tgId); }
    });
    return { ok: okN, none: noneN, total: people.length, unit: 'людей', missingNames: miss, missingIds: missIds };
  }
  let okN = 0, noneN = 0;
  const miss = [], missTeams = [];
  teamIds.forEach(function (id) {
    const mine = rows.filter(function (r) { return r.teamId === id; });
    if (mine.some(function (r) { return r.mode !== MODE.none; })) okN++;
    else if (mine.length) noneN++;
    else { miss.push(scope.level === 'region' || scope.level === 'nat' ? st.team[id].name + ' · ' + (st.area[st.team[id].areaId] || {}).name : st.team[id].name); missTeams.push(id); }
  });
  return { ok: okN, none: noneN, total: teamIds.length, unit: 'команд', missingNames: miss, missingTeams: missTeams };
}

function missingFor_(scope, type) {
  const teamIds = scopeTeamIds_(scope);
  const m = weekReport_(scope, type, teamIds);
  const rank = { club: RANK.CLUB, mg: RANK.MG, kr: RANK.KR }[type];
  if (m.missingIds) return { people: m.missingIds };
  const ids = {};
  (m.missingTeams || []).forEach(function (teamId) { eligiblePeople_(teamId, rank).forEach(function (p) { ids[p.tgId] = true; }); });
  return { people: Object.keys(ids) };
}

function eligiblePeople_(teamId, maxRank) {
  const by = {};
  loadRoles_().filter(function (r) { return r.status === ST.ACTIVE && r.level === 'team' && r.unitId === teamId && r.rank <= maxRank; })
    .forEach(function (r) { by[r.tgId] = { tgId: r.tgId, name: (getPerson_(r.tgId) || {}).name || r.name }; });
  return Object.keys(by).map(function (k) { return by[k]; });
}

function weekStatus_(c) {
  const st = loadStruct_();
  const wk = weekKey_(new Date());
  const rows = loadLog_().filter(function (r) { return r.week === wk; });
  const teams = {};
  c.roles.filter(function (r) { return r.level === 'team' && st.team[r.unitId] && st.team[r.unitId].active; }).forEach(function (r) { teams[r.unitId] = Math.min(teams[r.unitId] || 99, r.rank); });
  const items = [];
  Object.keys(teams).forEach(function (teamId) {
    const rank = teams[teamId];
    const many = Object.keys(teams).length > 1;
    const add = function (type, perTeam) {
      const mine = rows.filter(function (r) { return r.type === type && r.teamId === teamId && (perTeam || r.authorId === c.id); });
      const status = mine.some(function (r) { return r.mode !== MODE.none; }) ? 'ok' : mine.length ? 'none' : 'missing';
      const hours = type === 'kr' ? mine.reduce(function (a, r) { return a + (Number(r.hours) || 0); }, 0) : 0;
      items.push({ type: type, teamId: teamId, label: TYPE_LABEL[type] + (many ? ' · ' + st.team[teamId].name : ''), status: status, hours: hours });
    };
    if (rank <= RANK.CLUB) add('club', true);
    if (rank <= RANK.MG) add('mg', false);
    if (rank <= RANK.KR) add('kr', false);
  });
  return { key: wk, label: weekLabel_(wk), items: items };
}

function scopeCard_(c) {
  const top = allowedScopes_(c).filter(function (s) { return s.level !== 'team'; })[0];
  if (!top) return null;
  const ids = scopeTeamIds_(top);
  const m = weekReport_(top, 'club', ids);
  return { scope: top.key, title: top.label, done: m.ok + m.none, total: m.total };
}

// ───────────────────────────── ЗАЯВКИ ─────────────────────────────

function pendingFor_(c) {
  return loadRoles_().filter(function (r) { return r.status === ST.PENDING && r.tgId !== c.id && canDecide_(c, r); });
}

function approversFor_(target) {
  const byPerson = {};
  loadRoles_().filter(function (r) { return r.status === ST.ACTIVE; }).forEach(function (r) { (byPerson[r.tgId] = byPerson[r.tgId] || []).push(r); });
  return Object.keys(byPerson).filter(function (id) { return id !== target.tgId && canDecide_({ id: id, roles: byPerson[id] }, target); });
}

function notifyApprovers_(c, roleIds) {
  const rows = loadRoles_().filter(function (r) { return roleIds.indexOf(r.id) >= 0; });
  const who = {};
  rows.forEach(function (r) { approversFor_(r).forEach(function (id) { who[id] = true; }); });
  const text = '🆕 <b>Нова заявка</b>\n' + esc_(c.name) + (c.tg.username ? ' (@' + esc_(c.tg.username) + ')' : '') + '\n' +
    rows.map(function (r) { return '• ' + esc_(r.label) + ' · ' + esc_(r.unitName); }).join('\n');
  Object.keys(who).forEach(function (id) { sendApp_(id, text, 'Розглянути', 'requests'); Utilities.sleep(40); });
}

function pendingApproversText_(c) {
  const p = c.allRoles.filter(function (r) { return r.status === ST.PENDING; });
  if (!p.length) return '';
  const st = loadStruct_();
  const r = p[0];
  if (r.level === 'team') {
    const t = st.team[r.unitId];
    const area = t ? (st.area[t.areaId] || {}).name : '';
    const needArea = p.some(function (x) { return roleDef_(x.key).rank <= RANK.APPROVE; }) || (t && !t.active);
    return needArea ? 'керівництво ерії ' + area : 'капітан команди «' + (t ? t.name : '') + '» або керівництво ерії ' + area;
  }
  return 'керівництво вищого рівня';
}

// ───────────────────────────── ДИСК: ПАПКИ, ТАБЛИЦІ, ДОСТУПИ ─────────────────────────────

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* створимо нову */ } }
  const f = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER', f.getId());
  return f;
}

function regionFolder_(regionId) {
  const st = loadStruct_(true);
  const r = st.region[regionId];
  if (r.folder) { try { return DriveApp.getFolderById(r.folder); } catch (e) { /* створимо */ } }
  const f = rootFolder_().createFolder(r.name);
  update_(SH.REGIONS, r.row, { 'Папка': f.getId() });
  resetMemo_('struct');
  return f;
}

function areaFolder_(areaId) {
  const st = loadStruct_(true);
  const a = st.area[areaId];
  if (a.folder) { try { return DriveApp.getFolderById(a.folder); } catch (e) { /* створимо */ } }
  const f = regionFolder_(a.regionId).createFolder(a.name);
  update_(SH.AREAS, a.row, { 'Папка': f.getId() });
  resetMemo_('struct');
  return f;
}

function teamSS_(teamId) {
  const st = loadStruct_();
  const t = st.team[teamId];
  if (!t) bad_('Команду не знайдено.');
  if (t.file) { try { return ensureTeamSheets_(SpreadsheetApp.openById(t.file)); } catch (e) { /* створимо */ } }
  const ss = SpreadsheetApp.create('Команда «' + t.name + '»');
  DriveApp.getFileById(ss.getId()).moveTo(areaFolder_(t.areaId));
  ensureTeamSheets_(ss);
  const first = ss.getSheets()[0];
  if (/^(Аркуш|Sheet|Лист)\s?\d+$/.test(first.getName()) && ss.getSheets().length > 1) ss.deleteSheet(first);
  update_(SH.TEAMS, t.row, { 'Таблиця': ss.getId() });
  resetMemo_('struct');
  return ss;
}

function ensureTeamSheets_(ss) {
  Object.keys(TEAM_HEAD).forEach(function (name) {
    if (ss.getSheetByName(name)) return;
    const sh = ss.insertSheet(name);
    const head = TEAM_HEAD[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#fde8df');
    sh.setFrozenRows(1);
  });
  return ss;
}

function createTeam_(areaId, name, active) {
  const id = uid_();
  append_(SH.TEAMS, { 'ID': id, 'Ерія ID': areaId, 'Назва': cell_(name), 'Активна': active ? 'так' : 'очікує', 'Знаних': 0 });
  resetMemo_('struct');
  return id;
}

function activateTeam_(teamId) {
  const t = loadStruct_(true).team[teamId];
  if (t && !t.active) { update_(SH.TEAMS, t.row, { 'Активна': 'так' }); resetMemo_('struct'); }
}

function driveTarget_(r) {
  if (roleDef_(r.key).rank > RANK.GMAIL) return null;
  if (r.level === 'nat') return rootFolder_();
  if (r.level === 'region') return regionFolder_(r.unitId);
  if (r.level === 'area') return areaFolder_(r.unitId);
  return DriveApp.getFileById(teamSS_(r.unitId).getId());
}

function grantDrive_(r) {
  const email = (getPerson_(r.tgId) || {}).email;
  if (!email || !/@/.test(email)) return;
  const target = driveTarget_(r);
  if (target) target.addViewer(email);
}

function revokeDrive_(r) {
  const email = (getPerson_(r.tgId) || {}).email;
  if (!email || !/@/.test(email)) return;
  const target = driveTarget_(r);
  if (!target) return;
  // не забираємо, якщо інша активна роль дає той самий доступ
  const still = loadRoles_().some(function (x) { return x.id !== r.id && x.tgId === r.tgId && x.status === ST.ACTIVE && x.level === r.level && x.unitId === r.unitId && roleDef_(x.key).rank <= RANK.GMAIL; });
  if (!still) { try { target.removeViewer(email); } catch (e) { console.warn(e); } }
}

// ───────────────────────────── TELEGRAM: БОТ ─────────────────────────────

function onUpdate_(upd) {
  const m = upd.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return;
  const text = (m.text || '').trim();
  if (/^\/start\b/.test(text)) {
    const payload = text.split(/\s+/)[1] || '';
    if (payload.indexOf('admin_') === 0) return claimAdmin_(m, payload.slice(6));
  }
  if (text === '/id') return send_(m.chat.id, 'Твій Telegram ID: <code>' + m.from.id + '</code>');
  return sendApp_(m.chat.id, 'Привіт! Це застосунок Young Life Україна 💙💛\nЗвіти, знані по імені, календар і статистика — тут 👇', 'Відкрити Young Life');
}

function claimAdmin_(m, code) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('ADMIN_CLAIM');
  if (!expected || code !== expected) return send_(m.chat.id, 'Посилання недійсне або вже використане.');
  props.deleteProperty('ADMIN_CLAIM');
  const c = { id: String(m.from.id), tg: m.from, name: fullName_(m.from) };
  if (!getPerson_(c.id)) savePerson_(c, { name: c.name });
  const top = ROLES[0];
  const mine = loadRoles_().filter(function (r) { return r.tgId === c.id && r.status === ST.ACTIVE; });
  if (mine.some(function (r) { return r.key === top.key; })) return sendApp_(m.chat.id, 'Ти вже маєш роль <b>' + top.label + '</b> 🙂', 'Відкрити Young Life');
  const nats = mine.filter(function (r) { return r.key === 'NATIONAL_ADMIN'; });
  const nat = nats[0];
  // зайві дублікати «Національний Адмін» у цієї ж людини — знімаємо
  nats.slice(1).forEach(function (r) { update_(SH.ROLES, r.row, { 'Статус': ST.REMOVED, 'Хто вирішив': 'посилання власника', 'Дата рішення': new Date() }); });
  if (nat) update_(SH.ROLES, nat.row, { 'Роль': top.label, 'Хто вирішив': 'посилання власника', 'Дата рішення': new Date() });
  else append_(SH.ROLES, { 'ID': uid_(), 'Telegram ID': c.id, "Ім'я": c.name, 'Роль': top.label, 'Рівень': 'nat', 'Обʼєкт ID': '', 'Обʼєкт': 'Україна', 'Статус': ST.ACTIVE, 'Хто вирішив': 'посилання власника', 'Дата заявки': new Date(), 'Дата рішення': new Date() });
  resetMemo_();
  return sendApp_(m.chat.id, '✅ Готово! Твоя роль — <b>' + top.label + '</b>: найвищий рівень доступу.\nВідкрий застосунок, допиши профіль і поділись ботом з командами.', 'Відкрити Young Life');
}

function tg_(method, params) {
  const token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(params || {}), muteHttpExceptions: true,
  });
  let data;
  try { data = JSON.parse(res.getContentText()); } catch (e) { data = { ok: false, description: res.getContentText() }; }
  if (!data.ok) console.warn('Telegram ' + method + ': ' + data.description);
  return data;
}

function send_(chatId, text, extra) {
  return tg_('sendMessage', Object.assign({ chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }, extra || {}));
}

function sendApp_(chatId, text, button, screen) {
  const url = APP_URL + (screen ? '?screen=' + screen : '');
  return send_(chatId, text, { reply_markup: { inline_keyboard: [[{ text: button || 'Відкрити', web_app: { url: url } }]] } });
}

// ───────────────────────────── НАГАДУВАННЯ ─────────────────────────────

function weeklyReminder() {
  resetMemo_();
  const by = {};
  loadRoles_().filter(function (r) { return r.status === ST.ACTIVE && r.level === 'team'; }).forEach(function (r) { (by[r.tgId] = by[r.tgId] || []).push(r); });
  let sent = 0;
  Object.keys(by).forEach(function (id) {
    const w = weekStatus_({ id: id, roles: by[id] });
    const miss = w.items.filter(function (x) { return x.status === 'missing'; });
    if (!miss.length) return;
    sendApp_(id, '🔔 <b>Нагадування</b>\nЗа цей тиждень ще не заповнено:\n' + miss.map(function (x) { return '• ' + esc_(x.label); }).join('\n') +
      '\n\nЯкщо цього тижня не було — просто відміть «Не було».', 'Заповнити');
    sent++;
    Utilities.sleep(50);
  });
  console.log('Нагадувань: ' + sent);
}

function eventReminder() {
  resetMemo_();
  const days = String(setting_('EVENT_REMIND_DAYS') || '3,1').split(',').map(Number).filter(isFinite);
  const rsvp = readAll_(SH.RSVP);
  days.forEach(function (n) {
    const day = Utilities.formatDate(new Date(Date.now() + n * 864e5), TZ, 'yyyy-MM-dd');
    loadEvents_().filter(function (e) { return e.date === day; }).forEach(function (e) {
      rsvp.filter(function (r) { return str_(r['Подія ID']) === e.id; }).forEach(function (r) {
        sendApp_(str_(r['Telegram ID']), '📅 ' + (n === 1 ? 'Завтра' : 'Через ' + n + ' дні') + ': <b>' + esc_(e.title) + '</b>\n' + esc_([e.time, e.place].filter(Boolean).join(' · ')), 'Деталі', 'calendar');
        Utilities.sleep(40);
      });
    });
  });
}

// ───────────────────────────── ДАНІ ─────────────────────────────

const MEMO_ = {};
function memo_(k, fn) { if (!(k in MEMO_)) MEMO_[k] = fn(); return MEMO_[k]; }
function resetMemo_(prefix) { Object.keys(MEMO_).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete MEMO_[k]; }); }

function ss_() {
  return memo_('ss', function () {
    const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  });
}
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new ApiError('setup', 'Немає аркуша «' + name + '». Запусти «🤖 Бот → 1. Створити структуру».');
  return sh;
}

function readSheet_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const h = v.shift().map(function (x) { return String(x).trim(); });
  const out = [];
  v.forEach(function (r, i) {
    if (!r.some(function (x) { return x !== '' && x != null; })) return;
    const o = { _row: i + 2 };
    h.forEach(function (k, j) { if (k) o[k] = r[j]; });
    out.push(o);
  });
  return out;
}
function readAll_(name) { return memo_('rows_' + name, function () { return readSheet_(sheet_(name)); }); }

function headerOf_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(str_); }
function append_(name, obj) { appendTo_(ss_(), name, obj); resetMemo_('rows_' + name); }
function appendTo_(ss, name, obj) {
  const sh = ss.getSheetByName(name);
  sh.appendRow(headerOf_(sh).map(function (h) { return h in obj ? obj[h] : ''; }));
}
function update_(name, row, obj) { updateIn_(sheet_(name), row, obj); resetMemo_('rows_' + name); }
function updateIn_(sh, row, obj) {
  headerOf_(sh).forEach(function (h, j) { if (h in obj) sh.getRange(row, j + 1).setValue(obj[h]); });
}

function loadStruct_(fresh) {
  if (fresh) { resetMemo_('struct'); resetMemo_('rows_' + SH.REGIONS); resetMemo_('rows_' + SH.AREAS); resetMemo_('rows_' + SH.TEAMS); }
  return memo_('struct', function () {
    const s = { regions: [], areas: [], teams: [], region: {}, area: {}, team: {} };
    readAll_(SH.REGIONS).forEach(function (r) { const x = { id: str_(r['ID']), name: str_(r['Назва']), folder: str_(r['Папка']), row: r._row }; if (x.id) { s.regions.push(x); s.region[x.id] = x; } });
    readAll_(SH.AREAS).forEach(function (r) { const x = { id: str_(r['ID']), regionId: str_(r['Регіон ID']), name: str_(r['Назва']), folder: str_(r['Папка']), row: r._row }; if (x.id) { s.areas.push(x); s.area[x.id] = x; } });
    readAll_(SH.TEAMS).forEach(function (r) {
      const raw = str_(r['Активна']).toLowerCase();
      const x = { id: str_(r['ID']), areaId: str_(r['Ерія ID']), name: str_(r['Назва']), file: str_(r['Таблиця']), active: yes_(r['Активна']), state: yes_(r['Активна']) ? 'active' : raw === 'очікує' ? 'pending' : 'closed', known: Number(r['Знаних']) || 0, row: r._row };
      if (x.id) { s.teams.push(x); s.team[x.id] = x; }
    });
    s.teamRegion = function (teamId) { const t = s.team[teamId]; return t && s.area[t.areaId] ? s.area[t.areaId].regionId : ''; };
    return s;
  });
}

function loadRoles_() {
  return memo_('roles', function () {
    return readAll_(SH.ROLES).map(function (r) {
      const def = roleByLabel_(r['Роль']);
      if (!def) return null;
      return {
        id: str_(r['ID']), tgId: str_(r['Telegram ID']), name: str_(r["Ім'я"]), key: def.key, label: def.label, rank: def.rank,
        level: def.level, unitId: str_(r['Обʼєкт ID']), unitName: unitName_(def.level, str_(r['Обʼєкт ID'])) || str_(r['Обʼєкт']),
        status: str_(r['Статус']).toLowerCase(), requested: r['Дата заявки'], row: r._row,
      };
    }).filter(Boolean);
  });
}

function loadEvents_() {
  return memo_('events', function () {
    return readAll_(SH.EVENTS).map(function (r) {
      return {
        id: str_(r['ID']), level: str_(r['Рівень']), unitId: str_(r['Обʼєкт ID']), title: str_(r['Назва']), date: dayStr_(r['Дата']),
        time: timeStr_(r['Час']), place: str_(r['Місце']), desc: str_(r['Опис']), authorId: str_(r['Автор ID']), author: str_(r['Автор']), row: r._row,
      };
    }).filter(function (e) { return e.id && e.date; });
  });
}

function loadLog_() {
  return memo_('log', function () {
    return readAll_(SH.LOG).map(function (r) {
      const d = r['Дата'] instanceof Date ? r['Дата'] : new Date(r['Дата']);
      return {
        date: d, week: r['Тиждень'] ? dayStr_(r['Тиждень']) : weekKey_(d), type: str_(r['Тип']), mode: str_(r['Режим']),
        teamId: str_(r['Команда ID']), areaId: str_(r['Ерія ID']), regionId: str_(r['Регіон ID']),
        count: Number(r['Кількість']) || 0, newT: Number(r['Нових']) || 0, leaders: Number(r['Лідерів']) || 0, hours: Number(r['Годин']) || 0,
        inc: Number(r['Надійшло']) || 0, spent: Number(r['Витрачено']) || 0, authorId: str_(r['Автор ID']), author: str_(r['Автор']),
      };
    });
  });
}

function getPerson_(id) {
  const r = readAll_(SH.PEOPLE).filter(function (x) { return str_(x['Telegram ID']) === String(id); })[0];
  if (!r) return null;
  return {
    row: r._row, tgId: str_(r['Telegram ID']), username: str_(r['Username']), name: str_(r["Ім'я"]), phone: str_(r['Телефон']), email: str_(r['Gmail']),
    bday: dayStr_(r['Дата народження']), repent: str_(r['Рік покаяння']), baptism: str_(r['Рік хрещення']), lpyl: str_(r['Рік ЛПYL']), resp: str_(r['Відповідальності']),
    title: str_(r['Статус']),
  };
}

function savePerson_(c, d) {
  withLock_(function () {
    resetMemo_('rows_' + SH.PEOPLE);
    const p = getPerson_(c.id);
    const v = {};
    if (d.name != null) v["Ім'я"] = cell_(d.name);
    if (d.phone != null) v['Телефон'] = cell_(d.phone);
    if (d.email != null) v['Gmail'] = cell_(String(d.email).trim().toLowerCase());
    if (d.bday != null) v['Дата народження'] = cell_(d.bday);
    if (d.repent != null) v['Рік покаяння'] = cell_(d.repent);
    if (d.baptism != null) v['Рік хрещення'] = cell_(d.baptism);
    if (d.lpyl != null) v['Рік ЛПYL'] = cell_(d.lpyl);
    if (d.resp != null) v['Відповідальності'] = cell_(d.resp);
    if (d.title != null) { ensureColumn_(SH.PEOPLE, 'Статус'); v['Статус'] = cell_(String(d.title).slice(0, 60)); }
    v['Username'] = (c.tg && c.tg.username) || (p && p.username) || '';
    if (p) update_(SH.PEOPLE, p.row, v);
    else append_(SH.PEOPLE, Object.assign({ 'Telegram ID': c.id, 'Зареєстровано': new Date() }, v));
  });
  resetMemo_('rows_' + SH.PEOPLE);
}

function profileOf_(p) { return { name: p.name, title: p.title, phone: p.phone, email: p.email, bday: p.bday, repent: p.repent, baptism: p.baptism, lpyl: p.lpyl, resp: p.resp }; }

// додає колонку в кінець аркуша, якщо її ще немає (для таблиць, створених старішою версією)
function ensureColumn_(name, header) {
  const sh = sheet_(name);
  const h = headerOf_(sh);
  if (h.indexOf(header) >= 0) return;
  sh.getRange(1, h.length + 1).setValue(header).setFontWeight('bold').setBackground('#fde8df');
  resetMemo_('rows_' + name);
}
function roleOut_(r) { return { id: r.id, key: r.key, label: r.label, level: r.level, unitId: r.unitId, unitName: r.unitName, status: r.status }; }
function teamOut_(id) { const st = loadStruct_(); const t = st.team[id]; return { id: id, name: t.name, areaId: t.areaId, areaName: (st.area[t.areaId] || {}).name || '', regionId: st.teamRegion(id) }; }
function finOut_(r) {
  return { month: monthKey_(r['Місяць']), prev: Number(r['Попередній залишок']) || 0, office: Number(r['Дав офіс']) || 0, church: Number(r['Дала церква']) || 0, team: Number(r['Зібрали командою']) || 0, spent: Number(r['Витратили']) || 0, balance: Number(r['Залишок']) || 0 };
}
function unitName_(level, id) {
  const st = loadStruct_();
  if (level === 'nat') return 'Україна';
  if (level === 'region') return (st.region[id] || {}).name || '';
  if (level === 'area') return (st.area[id] || {}).name || '';
  return (st.team[id] || {}).name || '';
}
function levelLabel_(level, id) {
  if (level === 'nat') return 'Національна';
  if (level === 'region') return 'Регіон ' + unitName_(level, id);
  if (level === 'area') return 'Ерія ' + unitName_(level, id);
  return 'Команда «' + unitName_(level, id) + '»';
}
function setting_(key) {
  const r = readAll_(SH.SETTINGS).filter(function (x) { return str_(x['Ключ']) === key; })[0];
  return r ? r['Значення'] : null;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ───────────────────────────── ДРІБНІ ПОМІЧНИКИ ─────────────────────────────

function str_(v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); }
function yes_(v) { return v === true || /^(так|yes|true|1|\+)$/i.test(str_(v)); }
function no_(v) { return v === false || /^(ні|no|false|0|-)$/i.test(str_(v)); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function cell_(v) { if (v == null) return ''; const s = String(v).slice(0, 2000); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function uniq_(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
function fullName_(f) { return [f.first_name, f.last_name].filter(Boolean).join(' ') || f.username || String(f.id); }
function parseDay_(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function dayStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : str_(v); }
function timeStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : str_(v); }
function monthKey_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM') : str_(v).slice(0, 7); }
function weekKey_(d) {
  const p = Utilities.formatDate(d, TZ, 'yyyy-MM-dd').split('-').map(Number);
  const dow = Number(Utilities.formatDate(d, TZ, 'u'));
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2] - dow + 1)), 'UTC', 'yyyy-MM-dd');
}
function addDaysKey_(k, n) {
  const p = k.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)), 'UTC', 'yyyy-MM-dd');
}
function weekLabel_(k) {
  const M = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const e = addDaysKey_(k, 6);
  const d1 = Number(k.slice(8, 10)), d2 = Number(e.slice(8, 10));
  const m1 = Number(k.slice(5, 7)) - 1, m2 = Number(e.slice(5, 7)) - 1;
  return m1 === m2 ? d1 + '–' + d2 + ' ' + M[m2] : d1 + ' ' + M[m1] + ' – ' + d2 + ' ' + M[m2];
}

// ═════════════════════════════ МЕНЮ В ТАБЛИЦІ ═════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🤖 Бот')
    .addItem('1. Створити структуру', 'menuSetup')
    .addItem('2. Вказати токен бота', 'menuToken')
    .addItem('3. Підключити бота', 'menuConnect')
    .addSeparator()
    .addItem('🔔 Увімкнути нагадування', 'menuRemindersOn')
    .addItem('🔕 Вимкнути нагадування', 'menuRemindersOff')
    .addItem('🩺 Перевірити стан', 'menuStatus')
    .addItem('👑 Посилання для власника (Раб Божий)', 'menuAdminLink')
    .addToUi();
}

function menuSetup() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  if (!props.getProperty('WEBHOOK_KEY')) props.setProperty('WEBHOOK_KEY', Utilities.getUuid().replace(/-/g, ''));
  ss.setSpreadsheetTimeZone(TZ);
  resetMemo_();
  const created = [];
  const mk = function (name, head, seed) {
    let sh = ss.getSheetByName(name);
    if (sh) return sh;
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#fde8df');
    sh.setFrozenRows(1);
    if (seed && seed.length) sh.getRange(2, 1, seed.length, head.length).setValues(seed);
    created.push(name);
    return sh;
  };
  mk(SH.HELP, ['Аркуш', 'Що тут'], [
    ['Регіони / Ерії / Команди', 'Структура. Команди додаються самі (заявка «моєї команди немає») або вручну: ID будь-який унікальний, Активна = так. Таблиця й папки створюються автоматично.'],
    ['Люди', 'Профілі з Mini App. Gmail потрібен Капітанам і вище — на нього відкривається доступ на читання до таблиць.'],
    ['Ролі', 'Одна роль = один рядок. Статус: очікує / активна / відхилена / знята. Можна правити вручну.'],
    ['Події, Учасники подій', 'Календар Young Life.'],
    ['Зведення', 'Кожен звіт дублюється сюди для швидкої статистики. Не видаляй колонки.'],
    ['Налаштування', 'День і година нагадувань.'],
    ['Безпека', 'Редактори цієї таблиці бачать усі дані й код. Не давай доступ на редагування нікому, крім адмінів.'],
  ]);
  mk(SH.REGIONS, HEAD.REGIONS);
  mk(SH.AREAS, HEAD.AREAS);
  mk(SH.TEAMS, HEAD.TEAMS);
  mk(SH.PEOPLE, HEAD.PEOPLE);
  mk(SH.ROLES, HEAD.ROLES);
  mk(SH.EVENTS, HEAD.EVENTS);
  mk(SH.RSVP, HEAD.RSVP);
  mk(SH.LOG, HEAD.LOG);
  mk(SH.SETTINGS, HEAD.SETTINGS, SEED_SETTINGS);
  ['Telegram ID'].forEach(function () { ss.getSheetByName(SH.PEOPLE).getRange('A2:A').setNumberFormat('0'); });
  ss.getSheetByName(SH.ROLES).getRange('B2:B').setNumberFormat('0');
  ss.getSheetByName(SH.ROLES).getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ROLES.map(function (r) { return r.label; }), true).build());
  ss.getSheetByName(SH.ROLES).getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([ST.PENDING, ST.ACTIVE, ST.REJECTED, ST.REMOVED], true).build());
  // стартова структура West Side
  resetMemo_();
  // регіони й ерії: додаємо відсутні (за назвою), нічого не видаляємо
  const added = [];
  SEED_REGIONS.forEach(function (r) {
    let st = loadStruct_(true);
    let reg = st.regions.filter(function (x) { return x.name === r[0]; })[0];
    if (!reg) {
      const old = st.regions.filter(function (x) { return (REGION_ALIASES[r[0]] || []).indexOf(x.name) >= 0; })[0];
      if (old) { update_(SH.REGIONS, old.row, { 'Назва': r[0] }); reg = old; }
    }
    let rid = reg ? reg.id : '';
    if (!reg) { rid = uid_(); append_(SH.REGIONS, { 'ID': rid, 'Назва': r[0] }); added.push(r[0]); }
    st = loadStruct_(true);
    r[1].forEach(function (a) {
      if (!st.areas.some(function (x) { return x.regionId === rid && x.name === a; })) append_(SH.AREAS, { 'ID': uid_(), 'Регіон ID': rid, 'Назва': a });
    });
  });
  resetMemo_();
  if (added.length) created.push('регіони: ' + added.join(', '));
  ss.getSheets().forEach(function (s) { if (/^(Аркуш|Sheet|Лист)\s?\d+$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s); });
  const root = rootFolder_();
  try { DriveApp.getFileById(ss.getId()).moveTo(root); } catch (e) { /* лишаємо як є */ }
  alert_('✅ Готово', (created.length ? 'Створено аркуші: ' + created.join(', ') : 'Усі аркуші вже на місці.') +
    '\nПапка на Диску: «' + ROOT_FOLDER_NAME + '».\n\nДалі — «🤖 Бот» → «2. Вказати токен бота».');
}

function menuToken() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Токен бота', 'Встав токен від @BotFather (виглядає як 123456789:AA…):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const token = r.getResponseText().trim();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('BOT_TOKEN', token);
  const me = tg_('getMe', {});
  if (!me.ok) { props.deleteProperty('BOT_TOKEN'); return alert_('❌ Токен не підходить', me.description || ''); }
  props.setProperty('BOT_USERNAME', me.result.username);
  alert_('✅ Бот @' + me.result.username + ' знайдено',
    'Тепер: Розгорнути → Нове розгортання → Вебзастосунок. Виконувати як: Я. Доступ: Усі.\nСкопіюй URL (закінчується на /exec) і обери «3. Підключити бота».');
}

function menuConnect() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const r = ui.prompt('Підключення', 'Встав URL вебзастосунку (закінчується на /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return alert_('❌ Не той URL', 'URL має закінчуватися на /exec.');
  props.setProperty('WEBAPP_URL', url);
  const ping = UrlFetchApp.fetch(url + '?key=' + props.getProperty('WEBHOOK_KEY') + '&ping=1', { method: 'post', payload: '{}', contentType: 'application/json', followRedirects: false, muteHttpExceptions: true });
  if (ping.getResponseCode() !== 200) {
    return alert_('⚠️ Google не пускає Telegram до скрипта (код ' + ping.getResponseCode() + ')', 'Перевір, що в розгортанні доступ «Усі» (Anyone). Якщо це робочий акаунт Google Workspace — розгорни з особистого Gmail.');
  }
  const res = tg_('setWebhook', { url: url + '?key=' + props.getProperty('WEBHOOK_KEY'), allowed_updates: ['message'], drop_pending_updates: true });
  if (!res.ok) return alert_('❌ Telegram відхилив вебхук', res.description || '');
  tg_('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Відкрити', web_app: { url: APP_URL } } });
  tg_('setMyCommands', { commands: [{ command: 'start', description: 'Відкрити застосунок' }] });
  const hasAdmin = loadRoles_().some(function (x) { return x.rank <= 1 && x.status === ST.ACTIVE; });
  if (hasAdmin) return alert_('✅ Бот підключено', 'API для Mini App: ' + url + '\n(цю адресу треба вписати в config.js на GitHub)');
  showLink_('✅ Бот підключено!', 'API для Mini App (впиши в config.js на GitHub): ' + url + '\n\nВідкрий це посилання у своєму Telegram, щоб отримати найвищу роль «' + ROLES[0].label + '» (одноразове):', adminLink_());
}

function menuRemindersOn() {
  menuRemindersOff_();
  const day = String(setting_('REMINDER_DAY') || 'SUNDAY').toUpperCase();
  const hour = Number(setting_('REMINDER_HOUR')) || 18;
  ScriptApp.newTrigger('weeklyReminder').timeBased().onWeekDay(ScriptApp.WeekDay[day]).atHour(hour).inTimezone(TZ).create();
  ScriptApp.newTrigger('eventReminder').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();
  alert_('🔔 Нагадування увімкнено', 'Звіти: ' + day + ', ' + hour + ':00. Події: щодня о 9:00 тим, хто записався.');
}
function menuRemindersOff() { menuRemindersOff_(); alert_('🔕 Нагадування вимкнено', ''); }
function menuRemindersOff_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['weeklyReminder', 'eventReminder'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
}

function menuStatus() {
  resetMemo_();
  const props = PropertiesService.getScriptProperties();
  const info = (tg_('getWebhookInfo', {}).result) || {};
  const roles = loadRoles_();
  const triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  alert_('🩺 Стан', [
    'Бот: @' + (props.getProperty('BOT_USERNAME') || '—'),
    'Вебхук: ' + (info.url ? '✅' : '❌ не підключено'),
    info.last_error_message ? 'Остання помилка: ' + info.last_error_message : 'Помилок доставки немає',
    'API (впиши в config.js): ' + (props.getProperty('WEBAPP_URL') || '—'),
    'Активних ролей: ' + roles.filter(function (r) { return r.status === ST.ACTIVE; }).length + ', заявок: ' + roles.filter(function (r) { return r.status === ST.PENDING; }).length,
    'Нагадування: ' + (triggers.indexOf('weeklyReminder') >= 0 ? 'увімкнено' : 'вимкнено'),
  ].join('\n'));
}

function menuAdminLink() { showLink_('👑 Посилання для власника', 'Одноразове. Хто відкриє його в Telegram — отримає найвищу роль «' + ROLES[0].label + '» (якщо вже був Національним Адміном — роль підвищиться):', adminLink_()); }
function adminLink_() {
  const props = PropertiesService.getScriptProperties();
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  props.setProperty('ADMIN_CLAIM', code);
  return 'https://t.me/' + props.getProperty('BOT_USERNAME') + '?start=admin_' + code;
}
function alert_(title, text) { const ui = SpreadsheetApp.getUi(); ui.alert(title, text, ui.ButtonSet.OK); }
function showLink_(title, text, url) {
  const html = HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-line">' + esc_(text) +
    '<p><a href="' + esc_(url) + '" target="_blank" style="font-size:16px">' + esc_(url) + '</a></p></div>').setWidth(560).setHeight(240);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}
