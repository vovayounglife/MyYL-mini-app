/**
 * ════════════════════════════════════════════════════════════════
 *  Young Life Україна · Mini App · копія даних на Google Диску
 * ════════════════════════════════════════════════════════════════
 *  Застосунок тепер працює на швидкому сервері (Cloudflare). Цей скрипт:
 *   • один раз переносить на сервер усе, що вже внесли в таблиці (меню «☁️ Сервер → 2»);
 *   • кожні 10 хвилин забирає з сервера нове і дописує в таблиці команд,
 *     створює папки регіонів/ерій і таблиці команд, відкриває й забирає доступи за ролями.
 *
 *   • щогодини читає таблиці one-to-one з папок ерій і оновлює їх у робочому просторі MyYL.
 *
 *  Вставляється ЗАМІСТЬ старого Code.gs у тій самій таблиці «⚙️ Система».
 */

const ROOT_FOLDER_NAME = 'Young Life Mini App';
const TZ = 'Europe/Kyiv';
const GMAIL_RANK = 6; // доступ до таблиць — Капітан і вище

const ROLE_LABELS = {
  SUPER: 'власник', NATIONAL_ADMIN: 'Національний Адмін', REGIONAL_DIRECTOR: 'Регіональний Директор', REGIONAL_ADMIN: 'Регіональний Адмін',
  AREA_DIRECTOR: 'Еріа Директор', AREA_ADMIN: 'Еріа Адмін', CAPTAIN: 'Капітан', TEAM_ADMIN: 'Адмін команди', DGL: 'DGL', LEADER: 'Лідер',
  HELPER: 'Помічник', SUGAR: 'Сахарок', VOLUNTEER: 'Волонтер', OFFICE: 'Працівник офісу',
};
const TEAM_HEAD = {
  'Клуби': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Підлітків', 'Нових', 'Лідерів', 'Присутні', 'Нотатка', 'Автор'],
  'Малі групи': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Учасників', 'Нових', 'Тема', 'Присутні', 'Нотатка', 'Автор'],
  'КР': ['Записано', 'Дата', 'Тиждень', 'Режим', 'Годин', 'Нотатка', 'Автор'],
  'Знані': ['ID', "Ім'я", 'Телефон', 'Instagram', 'День народження', 'Школа', 'Клас', 'Лідер', 'Нотатка', 'Додано', 'Активний', 'Етап'],
  'Фінанси': ['Місяць', 'Попередній залишок', 'Дав офіс', 'Дала церква', 'Зібрали командою', 'Витратили', 'Залишок', 'Автор', 'Оновлено'],
};
const SYS = {
  REGIONS: 'Регіони', AREAS: 'Ерії', TEAMS: 'Команди', PEOPLE: 'Люди', ROLES: 'Ролі', EVENTS: 'Події', RSVP: 'Учасники подій',
  LOG: 'Зведення', SETTINGS: 'Налаштування',
};
const LOG_HEAD = ['Записано', 'Дата', 'Тиждень', 'Тип', 'Режим', 'Команда ID', 'Ерія ID', 'Регіон ID', 'Кількість', 'Нових', 'Лідерів', 'Годин', 'Надійшло', 'Витрачено', 'Автор ID', 'Автор'];
const TIME_BUDGET_MS = 4.5 * 60 * 1000;

// ═════════════════════════════ МЕНЮ ═════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('☁️ Сервер')
    .addItem('1. Підключити до сервера', 'menuConnect')
    .addItem('2. Перенести дані на сервер (один раз)', 'menuImport')
    .addItem('3. Увімкнути копіювання на Диск', 'menuSyncOn')
    .addSeparator()
    .addItem('🔄 Скопіювати зараз', 'syncNow')
    .addItem('👑 Посилання для власника (власник)', 'menuAdminLink')
    .addItem('🩺 Перевірити стан', 'menuStatus')
    .addSeparator()
    .addItem('🗂 Оновити one-to-one в робочому просторі', 'menuOtoNow')
    .addToUi();
}

function menuConnect() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const url = ui.prompt('Адреса сервера', 'Встав адресу з GitHub (вигляд: https://yl-mini-app.ХХХ.workers.dev)', ui.ButtonSet.OK_CANCEL);
  if (url.getSelectedButton() !== ui.Button.OK) return;
  const key = ui.prompt('Ключ синхронізації', 'Встав той самий SYNC_KEY, що й у секретах GitHub', ui.ButtonSet.OK_CANCEL);
  if (key.getSelectedButton() !== ui.Button.OK) return;
  props.setProperty('WORKER_URL', url.getResponseText().trim().replace(/\/+$/, ''));
  props.setProperty('SYNC_KEY', key.getResponseText().trim());
  const res = call_('sync', { cursor: { seq: 1e15, since: new Date().toISOString() } });
  ui.alert(res.ok ? '✅ Сервер на звʼязку. Далі — пункт 2.' : '❌ Не вдалося: ' + (res.error || res.message));
}

function menuAdminLink() {
  const res = call_('admin-link', {});
  SpreadsheetApp.getUi().alert(res.ok ? 'Відкрий це посилання у своєму Telegram (діє один раз):\n\n' + res.link : '❌ ' + (res.error || ''));
}

function menuStatus() {
  const p = PropertiesService.getScriptProperties();
  const cur = JSON.parse(p.getProperty('SYNC_CURSOR') || '{}');
  const trig = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncNow'; }).length;
  SpreadsheetApp.getUi().alert('Сервер: ' + (p.getProperty('WORKER_URL') || '—') +
    '\nКопіювання на Диск: ' + (trig ? 'увімкнено (кожні 10 хв)' : 'вимкнено') +
    '\nОстаннє копіювання: ' + (p.getProperty('LAST_SYNC') || '—') +
    '\nЗвітів скопійовано: до №' + (cur.seq || 0) +
    '\nOne-to-one в робочому просторі: ' + (p.getProperty('OTO_LAST_TXT') || '—'));
}

function menuSyncOn() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); }); // прибираємо й старі нагадування — тепер їх шле сервер
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(10).create();
  syncNow();
  SpreadsheetApp.getUi().alert('✅ Готово. Нові дані зʼявлятимуться на Диску кожні 10 хвилин.');
}

// ═════════════════════════════ ПЕРЕНЕСЕННЯ ═════════════════════════════

function menuImport() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Перенести всі дані з таблиць на сервер?', 'Можна запускати повторно — дублікатів не буде.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  const n = importAll();
  // старі нагадування з таблиці більше не потрібні — їх шле сервер
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() !== 'syncNow') ScriptApp.deleteTrigger(t); });
  ui.alert('✅ Перенесено записів: ' + n + '\n\nТепер напиши Claude, що дані перенесено, — він перемкне застосунок на новий сервер. Потім пункт 3.');
}

function importAll() {
  const props = PropertiesService.getScriptProperties();
  const ss = sys_();
  const read = function (name) { const sh = ss.getSheetByName(name); return sh ? rows_(sh) : []; };
  const labelToKey = {};
  Object.keys(ROLE_LABELS).forEach(function (k) { labelToKey[ROLE_LABELS[k]] = k; });
  const map = driveMap_();
  const data = {};

  data.regions = read(SYS.REGIONS).filter(function (r) { return s_(r['ID']); }).map(function (r) {
    if (s_(r['Папка'])) map.r[s_(r['ID'])] = { id: s_(r['Папка']), name: s_(r['Назва']) };
    return { id: s_(r['ID']), name: s_(r['Назва']) };
  });
  data.areas = read(SYS.AREAS).filter(function (r) { return s_(r['ID']); }).map(function (r) {
    if (s_(r['Папка'])) map.a[s_(r['ID'])] = { id: s_(r['Папка']), name: s_(r['Назва']) };
    return { id: s_(r['ID']), region_id: s_(r['Регіон ID']), name: s_(r['Назва']) };
  });
  const teamsRaw = read(SYS.TEAMS).filter(function (r) { return s_(r['ID']); });
  data.teams = teamsRaw.map(function (r) {
    const raw = s_(r['Активна']).toLowerCase();
    if (s_(r['Таблиця'])) map.t[s_(r['ID'])] = { id: s_(r['Таблиця']), name: s_(r['Назва']) };
    return { id: s_(r['ID']), area_id: s_(r['Ерія ID']), name: s_(r['Назва']), state: /^(так|yes|true|1|\+)$/.test(raw) ? 'active' : raw === 'очікує' ? 'pending' : 'closed', known: Number(r['Знаних']) || 0 };
  });
  saveDriveMap_(map);
  data.people = read(SYS.PEOPLE).filter(function (r) { return s_(r['Telegram ID']); }).map(function (r) {
    return { tg_id: s_(r['Telegram ID']), username: s_(r['Username']), name: s_(r["Ім'я"]), phone: s_(r['Телефон']), email: s_(r['Gmail']).toLowerCase(), bday: dv_(r['Дата народження']), repent: s_(r['Рік покаяння']), baptism: s_(r['Рік хрещення']), lpyl: s_(r['Рік ЛПYL']), resp: s_(r['Відповідальності']), title: s_(r['Статус']), registered: iso_(r['Зареєстровано']) };
  });
  data.roles = read(SYS.ROLES).filter(function (r) { return s_(r['ID']) && labelToKey[s_(r['Роль'])]; }).map(function (r) {
    const key = labelToKey[s_(r['Роль'])];
    return { id: s_(r['ID']), tg_id: s_(r['Telegram ID']), name: s_(r["Ім'я"]), role_key: key, level: s_(r['Рівень']), unit_id: s_(r['Обʼєкт ID']), status: s_(r['Статус']).toLowerCase(), decided_by: s_(r['Хто вирішив']), requested: iso_(r['Дата заявки']), decided: iso_(r['Дата рішення']) };
  });
  data.events = read(SYS.EVENTS).filter(function (r) { return s_(r['ID']); }).map(function (r) {
    return { id: s_(r['ID']), level: s_(r['Рівень']), unit_id: s_(r['Обʼєкт ID']), title: s_(r['Назва']), date: day_(r['Дата']), time: isDate_(r['Час']) ? Utilities.formatDate(r['Час'], TZ, 'HH:mm') : s_(r['Час']), place: s_(r['Місце']), descr: s_(r['Опис']), author_id: s_(r['Автор ID']), author: s_(r['Автор']), created: iso_(r['Створено']) };
  });
  data.rsvp = read(SYS.RSVP).filter(function (r) { return s_(r['Подія ID']); }).map(function (r) {
    return { event_id: s_(r['Подія ID']), tg_id: s_(r['Telegram ID']), name: s_(r["Ім'я"]), team: s_(r['Команда']), created: iso_(r['Дата']) };
  });
  // звіти — зі зведення (там є автор); ID стабільний, тож повторний запуск не дублює
  data.reports = read(SYS.LOG).filter(function (r) { return /^(club|mg|kr)$/.test(s_(r['Тип'])); }).map(function (r) {
    const d = day_(r['Дата']);
    const id = 'imp' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, [iso_(r['Записано']), s_(r['Тип']), s_(r['Команда ID']), s_(r['Автор ID'])].join('|'))).slice(0, 12);
    return { id: id, created: iso_(r['Записано']), date: d, week: s_(r['Тиждень']) ? day_(r['Тиждень']) : d, type: s_(r['Тип']), mode: s_(r['Режим']), team_id: s_(r['Команда ID']), area_id: s_(r['Ерія ID']), region_id: s_(r['Регіон ID']), count: Number(r['Кількість']) || 0, new_t: Number(r['Нових']) || 0, leaders: Number(r['Лідерів']) || 0, hours: Number(r['Годин']) || 0, author_id: s_(r['Автор ID']), author: s_(r['Автор']) };
  });
  data.settings = read(SYS.SETTINGS).filter(function (r) { return /^(REMINDER_DAY|REMINDER_HOUR|EVENT_REMIND_DAYS)$/.test(s_(r['Ключ'])); }).map(function (r) { return { key: s_(r['Ключ']), value: s_(r['Значення']) }; });
  // знані й фінанси — з таблиць команд
  data.known = []; data.finance = [];
  Object.keys(map.t).forEach(function (teamId) {
    let tss;
    try { tss = SpreadsheetApp.openById(map.t[teamId].id); } catch (e) { return; }
    const kn = tss.getSheetByName('Знані');
    if (kn) rows_(kn).filter(function (r) { return s_(r['ID']); }).forEach(function (r) {
      data.known.push({ id: s_(r['ID']), team_id: teamId, name: s_(r["Ім'я"]), phone: s_(r['Телефон']), ig: s_(r['Instagram']), bday: dv_(r['День народження']), school: s_(r['Школа']), grade: s_(r['Клас']), leader: s_(r['Лідер']), note: s_(r['Нотатка']), added: day_(r['Додано']), active: /^(ні|no|false|0)$/i.test(s_(r['Активний'])) ? 0 : 1, updated: '2000-01-01T00:00:00Z' });
    });
    const fin = tss.getSheetByName('Фінанси');
    if (fin) rows_(fin).filter(function (r) { return s_(r['Місяць']); }).forEach(function (r) {
      data.finance.push({ team_id: teamId, month: isDate_(r['Місяць']) ? Utilities.formatDate(r['Місяць'], TZ, 'yyyy-MM') : s_(r['Місяць']).slice(0, 7), prev: Number(r['Попередній залишок']) || 0, office: Number(r['Дав офіс']) || 0, church: Number(r['Дала церква']) || 0, team: Number(r['Зібрали командою']) || 0, spent: Number(r['Витратили']) || 0, balance: Number(r['Залишок']) || 0, author: s_(r['Автор']), updated: '2000-01-01T00:00:00Z' });
    });
  });

  let total = 0, last = null;
  ['regions', 'areas', 'teams', 'people', 'roles', 'events', 'rsvp', 'reports', 'known', 'finance', 'settings'].forEach(function (table) {
    const rows = data[table];
    for (let i = 0; i < rows.length; i += 40) {
      const part = {};
      part[table] = rows.slice(i, i + 40);
      const res = call_('import', part);
      if (!res.ok) throw new Error('Імпорт ' + table + ': ' + (res.message || res.error));
      total += res.imported;
      last = res.cursor;
    }
  });
  if (!last) last = call_('import', {}).cursor;
  // уже наявне на Диску не копіюємо вдруге
  props.setProperty('SYNC_CURSOR', JSON.stringify(last));
  props.setProperty('GRANTS', '[]');
  return total;
}

// ═════════════════════════════ КОПІЮВАННЯ НА ДИСК ═════════════════════════════

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  const started = Date.now();
  const props = PropertiesService.getScriptProperties();
  const timeLeft = function () { return Date.now() - started < TIME_BUDGET_MS; };
  try {
    let cursor = JSON.parse(props.getProperty('SYNC_CURSOR') || '{}');
    let more = true, first = true;
    while (more && timeLeft()) {
      const res = call_('sync', { cursor: cursor });
      if (!res.ok) throw new Error('sync: ' + (res.message || res.error));
      const map = driveMap_();
      if (first) {
        syncStructure_(res, map);
        syncGrants_(res, map, props);
        mirrorSystem_(res, map);
      }
      // знані й фінанси
      let doneSide = true;
      Object.keys(res.known).forEach(function (teamId) { if (!timeLeft()) { doneSide = false; return; } writeKnown_(teamSS_(teamId, res, map), res.known[teamId]); });
      res.finance.forEach(function (f) { if (!timeLeft()) { doneSide = false; return; } upsertFinance_(teamSS_(f.team_id, res, map), f); });
      // звіти
      const done = writeReports_(res, map, timeLeft, Number(cursor.seq) || 0);
      saveDriveMap_(map);
      cursor = { seq: done.seq, since: first && doneSide ? res.cursor.since : cursor.since };
      if (done.seq < res.cursor.seq) more = false; else more = res.more;
      props.setProperty('SYNC_CURSOR', JSON.stringify(cursor));
      first = false;
    }
    props.setProperty('LAST_SYNC', Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy HH:mm'));
    // робочому простору — де лежать таблиці команд і папки ерій (лише коли щось змінилось)
    try { driveMapPush_(); } catch (e) { console.warn('карта Диску: ' + e); }
    // раз на годину — таблиці one-to-one для робочого простору (якщо лишився час)
    try { otoMaybe_(started); } catch (e) { console.warn('one-to-one: ' + e); }
  } finally {
    lock.releaseLock();
  }
}

function writeReports_(res, map, timeLeft, seq) {
  const SHEET = { club: 'Клуби', mg: 'Малі групи', kr: 'КР' };
  const byTeam = {};
  const logRows = [];
  for (let i = 0; i < res.reports.length; i++) {
    const r = res.reports[i];
    if (!timeLeft()) break;
    const sheet = SHEET[r.type];
    const created = r.created ? new Date(r.created) : new Date();
    const date = parseDay_(r.date);
    if (sheet && r.team_id) {
      const k = r.team_id + '|' + sheet;
      const none = r.mode === 'не було';
      const row = r.type === 'club' ? [created, date, "'" + r.week, r.mode, r.count, r.new_t, r.leaders, r.attendees || '', r.note || '', r.author]
        : r.type === 'mg' ? [created, date, "'" + r.week, r.mode, r.count, r.new_t, r.topic || '', r.attendees || '', r.note || '', r.author]
          : [created, date, "'" + r.week, r.mode, none ? 0 : r.hours, r.note || '', r.author];
      (byTeam[k] = byTeam[k] || { teamId: r.team_id, sheet: sheet, rows: [] }).rows.push(row.map(safe_));
    }
    logRows.push([created, date, "'" + r.week, r.type, r.mode, r.team_id, r.area_id, r.region_id, r.count, r.new_t, r.leaders, r.hours, '', '', r.author_id, safe_(r.author)]);
    seq = r.seq;
  }
  Object.keys(byTeam).forEach(function (k) {
    const g = byTeam[k];
    const sh = teamSS_(g.teamId, res, map).getSheetByName(g.sheet);
    sh.getRange(sh.getLastRow() + 1, 1, g.rows.length, g.rows[0].length).setValues(g.rows);
  });
  if (logRows.length) {
    const log = sysSheet_(SYS.LOG, LOG_HEAD);
    log.getRange(log.getLastRow() + 1, 1, logRows.length, LOG_HEAD.length).setValues(logRows);
  }
  return { seq: seq };
}

function writeKnown_(ss, rows) {
  const sh = ss.getSheetByName('Знані');
  const head = TEAM_HEAD['Знані'];
  const STAGE = { meet: 'Хочу познайомитись', friends: 'Дружимо', grow: 'Допомагаю зростати в вірі', own: 'Йдуть самі' };
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (!rows.length) return;
  const vals = rows.map(function (r) { return [r.id, r.name, r.phone, r.ig, r.bday, r.school, r.grade, r.leader, r.note, r.added, r.active ? 'так' : 'ні', STAGE[r.stage] || STAGE.meet].map(safe_); });
  sh.getRange(2, 1, vals.length, head.length).setValues(vals);
}

function upsertFinance_(ss, f) {
  const sh = ss.getSheetByName('Фінанси');
  const row = ["'" + f.month, f.prev, f.office, f.church, f.team, f.spent, f.balance, safe_(f.author), f.updated ? new Date(f.updated) : new Date()];
  const n = sh.getLastRow() - 1;
  const months = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return isDate_(r[0]) ? Utilities.formatDate(r[0], TZ, 'yyyy-MM') : s_(r[0]).slice(0, 7); }) : [];
  const i = months.indexOf(f.month);
  sh.getRange(i >= 0 ? i + 2 : sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

// ── папки й таблиці ──

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* створимо */ } }
  const f = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER', f.getId());
  return f;
}

function folderFor_(kind, id, name, parent, map) {
  const m = map[kind][id];
  if (m) {
    try {
      const f = DriveApp.getFolderById(m.id);
      if (m.name !== name) { f.setName(name); m.name = name; }
      return f;
    } catch (e) { /* створимо заново */ }
  }
  const f = parent().createFolder(name);
  map[kind][id] = { id: f.getId(), name: name };
  return f;
}

function regionFolder_(regionId, res, map) {
  const r = res.regions.filter(function (x) { return x.id === regionId; })[0];
  return folderFor_('r', regionId, r ? r.name : regionId, rootFolder_, map);
}

function areaFolder_(areaId, res, map) {
  const a = res.areas.filter(function (x) { return x.id === areaId; })[0];
  return folderFor_('a', areaId, a ? a.name : areaId, function () { return regionFolder_(a.region_id, res, map); }, map);
}

function teamSS_(teamId, res, map) {
  const t = res.teams.filter(function (x) { return x.id === teamId; })[0] || { id: teamId, name: teamId, area_id: '' };
  const title = 'Команда «' + t.name + '»';
  const m = map.t[teamId];
  if (m) {
    try {
      const ss = SpreadsheetApp.openById(m.id);
      if (m.name !== t.name) { ss.rename(title); m.name = t.name; }
      return ensureTeamSheets_(ss);
    } catch (e) { /* створимо заново */ }
  }
  const ss = SpreadsheetApp.create(title);
  if (t.area_id) DriveApp.getFileById(ss.getId()).moveTo(areaFolder_(t.area_id, res, map));
  ensureTeamSheets_(ss);
  const first = ss.getSheets()[0];
  if (/^(Аркуш|Sheet|Лист)\s?\d+$/.test(first.getName()) && ss.getSheets().length > 1) ss.deleteSheet(first);
  map.t[teamId] = { id: ss.getId(), name: t.name };
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

function syncStructure_(res, map) {
  // перейменування папок і таблиць, які вже існують
  res.regions.forEach(function (r) { if (map.r[r.id] && map.r[r.id].name !== r.name) regionFolder_(r.id, res, map); });
  res.areas.forEach(function (a) { if (map.a[a.id] && map.a[a.id].name !== a.name) areaFolder_(a.id, res, map); });
  res.teams.forEach(function (t) { if (map.t[t.id] && map.t[t.id].name !== t.name) teamSS_(t.id, res, map); });
}

// ── доступи: Капітан і вище бачать свої таблиці ──

function syncGrants_(res, map, props) {
  const key = function (g) { return g.email + '|' + g.level + '|' + g.unitId; };
  const prev = JSON.parse(props.getProperty('GRANTS') || '[]');
  const now = res.grants.map(key);
  const target = function (g) {
    if (g.level === 'nat') return rootFolder_();
    if (g.level === 'region') return regionFolder_(g.unitId, res, map);
    if (g.level === 'area') return areaFolder_(g.unitId, res, map);
    return DriveApp.getFileById(teamSS_(g.unitId, res, map).getId());
  };
  const parse = function (k) { const p = k.split('|'); return { email: p[0], level: p[1], unitId: p[2] }; };
  now.filter(function (k) { return prev.indexOf(k) < 0; }).forEach(function (k) { try { target(parse(k)).addViewer(parse(k).email); } catch (e) { console.warn('addViewer ' + k + ': ' + e); } });
  prev.filter(function (k) { return now.indexOf(k) < 0; }).forEach(function (k) { try { target(parse(k)).removeViewer(parse(k).email); } catch (e) { console.warn('removeViewer ' + k + ': ' + e); } });
  props.setProperty('GRANTS', JSON.stringify(now));
}

// ── довідники в системній таблиці (для перегляду) ──

function mirrorSystem_(res, map) {
  const st = {};
  res.teams.forEach(function (t) { st[t.id] = t.state === 'active' ? 'так' : t.state === 'pending' ? 'очікує' : 'закрита'; });
  rewrite_(SYS.REGIONS, ['ID', 'Назва', 'Папка'], res.regions.map(function (r) { return [r.id, r.name, (map.r[r.id] || {}).id || '']; }));
  rewrite_(SYS.AREAS, ['ID', 'Регіон ID', 'Назва', 'Папка'], res.areas.map(function (a) { return [a.id, a.region_id, a.name, (map.a[a.id] || {}).id || '']; }));
  rewrite_(SYS.TEAMS, ['ID', 'Ерія ID', 'Назва', 'Таблиця', 'Активна', 'Знаних'], res.teams.map(function (t) { return [t.id, t.area_id, t.name, (map.t[t.id] || {}).id || '', st[t.id], t.known]; }));
  rewrite_(SYS.PEOPLE, ['Telegram ID', 'Username', "Ім'я", 'Телефон', 'Gmail', 'Дата народження', 'Рік покаяння', 'Рік хрещення', 'Рік ЛПYL', 'Відповідальності', 'Зареєстровано', 'Статус'],
    res.people.map(function (p) { return [p.tg_id, p.username, p.name, p.phone, p.email, p.bday, p.repent, p.baptism, p.lpyl, p.resp, p.registered, p.title].map(safe_); }));
  rewrite_(SYS.ROLES, ['ID', 'Telegram ID', "Ім'я", 'Роль', 'Рівень', 'Обʼєкт ID', 'Статус', 'Хто вирішив', 'Дата заявки', 'Дата рішення'],
    res.roles.map(function (r) { return [r.id, r.tg_id, r.name, r.label, r.level, r.unit_id, r.status, r.decided_by, r.requested, r.decided].map(safe_); }));
}

function rewrite_(name, head, rows) {
  const sh = sysSheet_(name, head);
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(function (r) { return r.map(function (v) { return v == null ? '' : v; }); }));
}

// ═════════════════════════════ ONE-TO-ONE → РОБОЧИЙ ПРОСТІР ═════════════════════════════
// Читаємо лише бали та дати зустрічей. Нотатки, висновки й молитовні потреби не беремо.
const WS_ID = 'west';
const OTO_EVERY_MS = 60 * 60 * 1000;
const OTO_NAME = /one\s*-?\s*to\s*-?\s*one/i;
const OTO_SKIP_SHEETS = /як користуватися|зведення|приклад|шаблон|інструкц/i;
const OTO_PLACEHOLDER = /^(лідер|капітан|керівник|людина)\s*\d*$/i;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function driveMapPush_() {
  const props = PropertiesService.getScriptProperties();
  const m = driveMap_();
  const ids = function (o) { const r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] && o[k].id) r[k] = o[k].id; }); return r; };
  const map = { t: ids(m.t), a: ids(m.a), r: ids(m.r) };
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(map)));
  if (props.getProperty('DRIVE_MAP_SENT') === hash) return;
  const res = call_('ws-drive', { map: map });
  if (res.ok) props.setProperty('DRIVE_MAP_SENT', hash);
}
function menuOtoNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { SpreadsheetApp.getUi().alert('Зараз іде копіювання — спробуй за хвилину.'); return; }
  let r;
  try { driveMapPush_(); r = otoSync_(Date.now() + 5 * 60 * 1000); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert(r.ok ? '✅ One-to-one: таблиць ' + r.files + (r.changed ? ' — оновлено в робочому просторі.' : ' — змін немає.') + (r.pending ? '\nЩе ' + r.pending + ' дочитаю наступного разу.' : '')
    : '❌ ' + (r.error || 'не вдалося'));
}
function otoMaybe_(started) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('OTO_LAST') || 0);
  const left = TIME_BUDGET_MS - (Date.now() - started);
  if (Date.now() - last < OTO_EVERY_MS || left < 90 * 1000) return;
  otoSync_(started + TIME_BUDGET_MS);
}
function otoSync_(deadline) {
  const props = PropertiesService.getScriptProperties();
  const cfg = call_('ws-config', { ws: WS_ID });
  if (!cfg.ok) return { ok: false, error: 'сервер: ' + (cfg.error || cfg.message) };
  const folders = {};
  (cfg.areas || []).forEach(function (a) { const m = /folders\/([\w-]+)/.exec(a.otoFolder || ''); if (m) folders[m[1]] = 1; });
  const out = [], seen = {};
  let pending = 0;
  Object.keys(folders).forEach(function (fid) {
    let it;
    try { it = DriveApp.getFolderById(fid).getFiles(); } catch (e) { console.warn('папка ' + fid + ': ' + e); return; }
    while (it.hasNext()) {
      const f = it.next(), name = f.getName(), mime = f.getMimeType();
      if (!OTO_NAME.test(name) || (mime !== MimeType.GOOGLE_SHEETS && mime !== XLSX_MIME) || seen[f.getId()]) continue;
      seen[f.getId()] = 1;
      const key = 'OTO_' + f.getId(), upd = f.getLastUpdated().getTime();
      let c = null;
      try { c = JSON.parse(props.getProperty(key) || 'null'); } catch (e) { c = null; }
      if (!c || c.u !== upd) {
        if (Date.now() > deadline - 25 * 1000) { pending++; if (!c) continue; }
        else {
          try {
            const title = otoClean_(name);
            c = { u: upd, d: { id: f.getId(), title: title, area: otoArea_(title), group: otoGroup_(title), ok: true, people: otoRead_(f) } };
          } catch (e) { console.warn(name + ': ' + e); c = c || { u: upd, d: { id: f.getId(), title: otoClean_(name), area: otoArea_(name), group: otoGroup_(name), ok: false, people: [] } }; }
          try { props.setProperty(key, JSON.stringify(c)); } catch (e) { console.warn('кеш ' + name + ': ' + e); }
        }
      }
      out.push(c.d);
    }
  });
  // таблиці, яких уже немає в папках, — прибираємо з памʼяті
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('OTO_') === 0 && k !== 'OTO_LAST' && k !== 'OTO_LAST_TXT' && !seen[k.slice(4)]) props.deleteProperty(k); });
  const res = call_('ws-oto', { ws: WS_ID, files: out });
  if (!res.ok) return { ok: false, error: 'сервер: ' + (res.error || res.message) };
  props.setProperty('OTO_LAST', String(Date.now()));
  props.setProperty('OTO_LAST_TXT', Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy HH:mm') + ' · таблиць ' + out.length);
  return { ok: true, files: out.length, changed: res.changed, pending: pending };
}
// Google Таблиця читається напряму; файл Excel — через тимчасову копію-Таблицю, яку одразу видаляємо
function otoRead_(file) {
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) return otoParseSS_(SpreadsheetApp.openById(file.getId()));
  const tok = ScriptApp.getOAuthToken();
  const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.getId() + '/copy?supportsAllDrives=true', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true,
    payload: JSON.stringify({ name: 'тимчасова копія one-to-one (MyYL)', mimeType: MimeType.GOOGLE_SHEETS }),
  });
  const tmp = JSON.parse(r.getContentText() || '{}').id;
  if (!tmp) throw new Error('не вдалося прочитати файл Excel (' + r.getResponseCode() + ')');
  try { return otoParseSS_(SpreadsheetApp.openById(tmp)); }
  finally { UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + tmp + '?supportsAllDrives=true', { method: 'delete', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true }); }
}
function otoParseSS_(ss) {
  const out = [];
  ss.getSheets().forEach(function (sh) {
    const name = sh.getName();
    if (OTO_SKIP_SHEETS.test(name)) return;
    const p = otoPerson_(sh.getDataRange().getValues(), name);
    if (p) out.push(p);
  });
  return out;
}
function otoTxt_(v) { if (v == null) return ''; if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); return String(v).trim(); }
function otoDate_(v) {
  if (v == null || v === '') return null;
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  if (typeof v === 'number' && v > 20000 && v < 80000) return Utilities.formatDate(new Date(Math.round((v - 25569) * 864e5)), 'UTC', 'yyyy-MM-dd');
  return String(v).trim() || null;
}
function otoScore_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v >= 0 && v <= 10 ? v : null;
  const s = String(v).trim().replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(s)) { const n = +s; return n <= 10 ? n : null; }
  return null;
}
function otoR1_(x) { return Math.round(x * 10) / 10; }
function otoMean_(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
function otoSphere_(s) { s = String(s).replace(/\s+/g, ' ').trim().toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function otoPerson_(rows, sheetName) {
  let personName = '', role = '', meetCols = null, dateRow = null, start = -1;
  for (let i = 0; i < rows.length && i < 60; i++) {
    const r = rows[i] || [];
    const a = otoTxt_(r[0]), b = otoTxt_(r[1]);
    if (/^Ім.я та прізвище/i.test(a)) personName = b;
    else if (/^Роль/i.test(a)) role = b;
    if (!meetCols) {
      const cols = [];
      r.forEach(function (c, j) { const m = /Зустріч\s*(\d)/i.exec(otoTxt_(c)); if (m && cols[+m[1] - 1] == null) cols[+m[1] - 1] = j; });
      if (cols.filter(function (x) { return x != null; }).length >= 2) meetCols = cols;
    }
    if (/^Дата зустрічі/i.test(b) || /^Дата зустрічі/i.test(a)) dateRow = r;
    if (/^Сфера\s*\/\s*пункт/i.test(a)) { start = i + 1; break; }
  }
  if (start < 0 || !personName || OTO_PLACEHOLDER.test(personName)) return null;
  if (!meetCols) meetCols = [2, 4, 6, 8];
  const spheres = [];
  let cur = null;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || [];
    const a = otoTxt_(r[0]);
    if (/^ЗАГАЛЬНИЙ БАЛ/i.test(a) || /^РЕЗУЛЬТАТИ/i.test(a)) break;
    const m = /^(\d+)\.\s*(.+)$/.exec(a);
    if (m) {
      const nm = otoSphere_(m[2]);
      cur = (m[1] === '0' || /без балу|ф[іi]тбек|фідбек|попередніх цілей/i.test(nm)) ? null : { name: nm, items: [] };
      if (cur) spheres.push(cur);
      continue;
    }
    if (!cur || !a) continue;
    cur.items.push([0, 1, 2, 3].map(function (k) { return meetCols[k] == null ? null : otoScore_(r[meetCols[k]]); }));
  }
  const meetings = [0, 1, 2, 3].map(function (k) {
    const sp = {};
    spheres.forEach(function (s) {
      const v = s.items.map(function (it) { return it[k]; }).filter(function (x) { return x != null; });
      if (v.length) sp[s.name] = otoR1_(otoMean_(v));
    });
    const vals = Object.keys(sp).map(function (x) { return sp[x]; });
    const date = otoDate_(dateRow && meetCols[k] != null ? dateRow[meetCols[k]] : null);
    return { held: vals.length > 0 || !!date, date: date, total: vals.length ? otoR1_(otoMean_(vals)) : null, spheres: sp };
  });
  return { name: personName, role: role, meetings: meetings };
}
function otoArea_(t) {
  t = String(t);
  if (/Чернівці\s*У/i.test(t)) return 'cv-u';
  if (/Чернівці\s*Б/i.test(t)) return 'cv-b';
  if (/Тернопіл/i.test(t)) return 'ternopil';
  if (/Льв[іо]в/i.test(t)) return 'lviv';
  if (/Франк/i.test(t)) return 'if';
  if (/Закарпат/i.test(t)) return 'zak';
  if (/офіс|керівники/i.test(t)) return 'office';
  return 'other';
}
function otoGroup_(t) {
  t = String(t);
  if (/Капітан/i.test(t)) return 'Капітани';
  if (/Лідер/i.test(t)) return 'Лідери';
  if (/керівник|офіс/i.test(t)) return 'Керівники';
  return 'Інше';
}
function otoClean_(t) { return String(t || '').replace(/\.xlsx\s*$/i, '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, ''); }

// ═════════════════════════════ ПОМІЧНИКИ ═════════════════════════════

function call_(action, body) {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('WORKER_URL');
  if (!url) throw new Error('Спершу «☁️ Сервер → 1. Підключити до сервера».');
  const res = UrlFetchApp.fetch(url + '/admin/' + action, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body || {}),
    headers: { 'x-sync-key': p.getProperty('SYNC_KEY') || '' }, muteHttpExceptions: true,
  });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { ok: false, error: 'HTTP ' + res.getResponseCode() }; }
}

function sys_() { return SpreadsheetApp.getActive() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')); }
function sysSheet_(name, head) {
  const ss = sys_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function rows_(sh) {
  const v = sh.getDataRange().getValues();
  const head = v.shift() || [];
  return v.map(function (r) { const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}
function driveMap_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DRIVE_MAP') || '{"r":{},"a":{},"t":{}}'); }
function saveDriveMap_(m) { PropertiesService.getScriptProperties().setProperty('DRIVE_MAP', JSON.stringify(m)); }
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v); }
function s_(v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); }
function safe_(v) { if (v == null) return ''; if (typeof v !== 'string') return v; return /^[=+\-@]/.test(v) ? "'" + v : v; }
function iso_(v) { if (isDate_(v)) return v.toISOString(); return s_(v); }
function dv_(v) { return isDate_(v) ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : s_(v); }
function day_(v) { return isDate_(v) ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : s_(v).slice(0, 10); }
function parseDay_(s) { const p = String(s || '').split('-').map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2], 12) : ''; }
