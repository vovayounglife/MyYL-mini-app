import crypto from 'node:crypto';
import { makeD1 } from './d1mock.mjs';
const W = (await import('../src/index.js')).default;
const T = (await import('../src/index.js')).__test;
const TOKEN = '123:ABC';
const env = { DB: makeD1(new URL('../schema.sql', import.meta.url)), BOT_TOKEN: TOKEN, SYNC_KEY: 'k3y', APP_URL: 'https://vovayounglife.github.io/MyYL-mini-app/' };
const sent = [];
globalThis.fetch = async (url, opt) => {
  const m = String(url).split('/').pop();
  let b;
  if (opt.body instanceof FormData) { b = {}; for (const [k, v] of opt.body.entries()) b[k] = typeof v === 'string' ? v : { name: v.name, text: await v.text() }; }
  else b = JSON.parse(opt.body || '{}');
  sent.push({ m, ...b });
  const result = m === 'getMe' ? { username: 'yl_bot' } : true;
  return new Response(JSON.stringify({ ok: true, result }));
};
const waits = [];
const ectx = { waitUntil: (p) => waits.push(p) };
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('❌', msg); } else console.log('✅', msg); };
function initData(user) {
  const p = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) };
  const dcs = Object.keys(p).sort().map((k) => k + '=' + p[k]).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return Object.entries({ ...p, hash }).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
async function req(path, body, headers) {
  const r = await W.fetch(new Request('https://yl.example.workers.dev' + path, { method: 'POST', body: JSON.stringify(body), headers: headers || {} }), env, ectx);
  await Promise.all(waits.splice(0));
  return r;
}
async function api(user, action, data) { const r = await req('/', { initData: initData(user), action, data }); return r.json(); }
const admin = (p, b) => req('/admin/' + p, b || {}, { 'x-sync-key': 'k3y' }).then((r) => r.json());

const VOVA = { id: 1, first_name: 'Вова', username: 'vova' };
const RD = { id: 2, first_name: 'Рег', last_name: 'Дир' };
const AD = { id: 3, first_name: 'Ерія', last_name: 'Дир' };
const CAP = { id: 4, first_name: 'Кап' };
const LEAD = { id: 5, first_name: 'Лід' };
const SUG = { id: 6, first_name: 'Цукор' };

// seed regions like menuSetup
await admin('import', { regions: ['West', 'Kyiv', 'Central', 'North', 'South', 'East', 'Office'].map((n, i) => ({ id: 'r' + i, name: n })), areas: [{ id: 'a1', region_id: 'r0', name: 'Тернопіль' }, { id: 'a2', region_id: 'r0', name: 'Львів' }] });
const setup = await admin('setup');
ok(setup.ok && setup.bot === 'yl_bot', 'setup бота');
const sw = sent.find((s) => s.m === 'setWebhook');
ok(sw && sw.url.endsWith('/tg') && sw.secret_token, 'вебхук з секретом');
const bad = await req('/admin/sync', {}, { 'x-sync-key': 'wrong' });
ok(bad.status === 403, 'адмін без ключа — 403');

// claim
const link = await admin('admin-link');
const code = link.link.split('admin_')[1];
let r = await req('/tg', { message: { chat: { id: 1, type: 'private' }, from: VOVA, text: '/start admin_' + code } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
ok(r.status === 200, 'вебхук прийнято');
r = await req('/tg', { message: { chat: { id: 1, type: 'private' }, from: VOVA, text: 'hi' } }, { 'X-Telegram-Bot-Api-Secret-Token': 'nope' });
ok(r.status === 403, 'вебхук без секрету — 403');
let me = await api(VOVA, 'me');
ok(me.ok && me.data.status === 'active' && me.data.roles[0].label === 'Раб Божий', 'Вова — Раб Божий');
ok(me.data.structure.regions.length === 7, '7 регіонів');
const bogus = await W.fetch(new Request('https://x/', { method: 'POST', body: JSON.stringify({ initData: 'user=%7B%22id%22%3A1%7D&hash=00', action: 'me' }) }), env, ectx).then((x) => x.json());
ok(!bogus.ok && bogus.error === 'auth', 'підроблений initData відхилено');

// team creation by super, Vova adds himself a role
let t = await api(VOVA, 'teamSave', { areaId: 'a1', name: 'Тернопіль-Центр' });
ok(t.ok, 'Раб Божий створює команду');
const teamId = t.data.id;
r = await api(VOVA, 'requestRoles', { roles: ['CAPTAIN'], teamId, areaId: 'a1' });
ok(r.ok && r.data.status === 'active', 'Раб Божий додає собі роль без підтвердження');

// RD registers
sent.length = 0;
r = await api(RD, 'register', { name: 'Рег Дир', roles: ['REGIONAL_DIRECTOR'], regionId: 'r0', email: 'rd@gmail.com' });
ok(r.ok && r.data.status === 'pending', 'РД — заявка');
ok(sent.some((s) => s.chat_id === '1' && /Нова заявка/.test(s.text)), 'Вова отримав сповіщення про РД');
let reqs = await api(VOVA, 'requests');
await api(VOVA, 'decide', { roleIds: reqs.data[0].roles.map((x) => x.id), approve: true });
me = await api(RD, 'me');
ok(me.data.status === 'active', 'РД активний');

// AD registers -> RD + super notified
sent.length = 0;
await api(AD, 'register', { name: 'Ерія Дир', roles: ['AREA_DIRECTOR'], areaId: 'a1', email: 'ad@gmail.com' });
ok(sent.some((s) => s.chat_id === '2') && sent.some((s) => s.chat_id === '1'), 'Еріа Директор: сповіщення РД і Вові');
reqs = await api(RD, 'requests');
await api(RD, 'decide', { roleIds: reqs.data[0].roles.map((x) => x.id), approve: true });

// captain proposes new team
sent.length = 0;
r = await api(CAP, 'register', { name: 'Кап Тан', roles: ['CAPTAIN'], areaId: 'a1', newTeamName: 'Нова команда', email: 'cap@gmail.com' });
ok(r.ok, 'Капітан пропонує нову команду');
ok(sent.some((s) => s.chat_id === '3') && !sent.some((s) => s.chat_id === '1'), 'Капітан: сповіщення Еріа Директору, не Вові');
me = await api(VOVA, 'me');
ok(!me.data.structure.teams.some((x) => x.name === 'Нова команда'), 'нова команда ще неактивна');
reqs = await api(AD, 'requests');
await api(AD, 'decide', { roleIds: reqs.data[0].roles.map((x) => x.id), approve: true });
me = await api(CAP, 'me');
const capTeam = me.data.myTeams[0];
ok(me.data.status === 'active' && capTeam.name === 'Нова команда', 'команда активувалась після підтвердження');

// leader & sugar
await api(LEAD, 'register', { name: 'Лід Ер', roles: ['LEADER'], teamId: capTeam.id, areaId: 'a1' });
await api(SUG, 'register', { name: 'Цукор', roles: ['SUGAR'], teamId: capTeam.id, areaId: 'a1' });
reqs = await api(CAP, 'requests');
ok(reqs.data.length === 2, 'Капітан бачить 2 заявки');
for (const p of reqs.data) await api(CAP, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });

// reports
me = await api(CAP, 'me');
ok(me.data.week.items.some((x) => x.type === 'club' && x.status === 'missing'), 'клуб ще не здано');
r = await api(CAP, 'saveReport', { type: 'club', teamId: capTeam.id, mode: 'event', date: T.kyivDay(new Date()), teens: 12, newT: 3, leaders: 4 });
ok(r.ok && r.data.week.items.find((x) => x.type === 'club').status === 'ok', 'клуб здано');
r = await api(LEAD, 'saveReport', { type: 'club', teamId: capTeam.id, mode: 'event', teens: 1 });
ok(!r.ok && r.error === 'forbidden', 'лідер не може здати клуб');
r = await api(LEAD, 'saveReport', { type: 'mg', teamId: capTeam.id, mode: 'week', teens: 5, topic: 'Віра' });
ok(r.ok, 'лідер здає МГ');
r = await api(LEAD, 'saveReport', { type: 'kr', teamId: capTeam.id, mode: 'none' });
ok(r.ok && r.data.week.items.find((x) => x.type === 'kr').status === 'none', 'лідер: КР «не було»');

// known
r = await api(LEAD, 'knownSave', { teamId: capTeam.id, item: { name: 'Оля Підліток', phone: '0991112233' } });
ok(r.ok, 'знані: додано');
r = await api(SUG, 'knownList', { teamId: capTeam.id });
ok(!r.ok, 'сахарок не бачить знаних');
r = await api(AD, 'knownList', { teamId: capTeam.id });
ok(r.ok && r.data.length === 1, 'Еріа Директор бачить знаних');

// finance
r = await api(CAP, 'financeSave', { teamId: capTeam.id, month: T.kyivDay(new Date()).slice(0, 7), prev: 100, office: 500, church: 0, team: 50, spent: 300 });
ok(r.ok && r.data.balance === 350, 'фінанси: баланс 350');
r = await api(LEAD, 'financeGet', { teamId: capTeam.id });
ok(!r.ok, 'лідер не бачить фінанси');
r = await api(RD, 'financeGet', { teamId: capTeam.id });
ok(r.ok && r.data.current.balance === 350, 'РД бачить фінанси');

// events
const day = T.kyivDay(new Date(Date.now() + 86400000 * 3));
r = await api(LEAD, 'eventSave', { level: 'team', unitId: capTeam.id, title: 'Табір', date: day, time: '10:00' });
ok(r.ok, 'лідер додає подію команди');
r = await api(LEAD, 'eventSave', { level: 'region', unitId: 'r0', title: 'X', date: day });
ok(!r.ok, 'лідер не додає подію регіону');
r = await api(VOVA, 'eventSave', { level: 'region', unitId: 'r3', title: 'Північ', date: day });
ok(r.ok, 'Раб Божий додає подію в будь-який регіон');
me = await api(SUG, 'me');
const ev = me.data.events.find((e) => e.title === 'Табір');
ok(ev && ev.going === 1, 'сахарок бачить подію, 1 йде');
await api(SUG, 'rsvp', { id: ev.id, going: true });
me = await api(SUG, 'me');
ok(me.data.events.find((e) => e.title === 'Табір').isGoing, 'сахарок: «Йду»');

// stats
r = await api(VOVA, 'stats', { scope: 'nat', cat: 'club', period: 'month' });
ok(r.ok && r.data.kpis[1].v === '12', 'статистика: 12 підлітків по Україні');
r = await api(RD, 'stats', { scope: 'r:r0', cat: 'finance', period: 'month' });
ok(r.ok && /550/.test(r.data.kpis[0].v) && /250/.test(r.data.kpis[2].v), 'статистика фінансів регіону');
r = await api(AD, 'stats', { scope: 'a:a1', cat: 'known', period: 'month' });
ok(r.ok && r.data.kpis[0].v === '1', 'статистика знаних ерії');
r = await api(SUG, 'stats', {});
ok(r.ok && r.data.cats.length === 1 && r.data.cats[0].key === 'club', 'сахарок — лише клуби');

// structure
r = await api(AD, 'areaSave', { regionId: 'r0', name: 'Нова ерія' });
ok(!r.ok, 'Еріа Директор не додає ерії');
r = await api(RD, 'areaSave', { regionId: 'r0', name: 'Луцьк' });
ok(r.ok, 'РД додає ерію');
r = await api(AD, 'teamSave', { id: capTeam.id, state: 'closed' });
ok(r.ok, 'Еріа Директор закриває команду');
await api(AD, 'teamSave', { id: capTeam.id, state: 'active' });
r = await api(AD, 'structureTree');
ok(r.ok && r.data[0].areas.length === 1, 'дерево структури для ЕД');

// nudge
sent.length = 0;
r = await api(AD, 'nudge', { scope: 'a:a1', type: 'club' });
ok(r.ok && r.data.sent === 1, 'нагадування: Вові (капітан Тернопіль-Центр)');

// sync
r = await admin('sync', { cursor: {} });
ok(r.ok && r.reports.length === 3 && r.grants.length >= 3 && r.known[capTeam.id].length === 1 && r.finance.length === 1, 'sync віддає звіти, доступи, знаних, фінанси');
const r2 = await admin('sync', { cursor: r.cursor });
ok(r2.reports.length === 0 && Object.keys(r2.known).length === 0, 'sync з курсором — нічого нового');

// cron
sent.length = 0;
await T.resetBase();
const wk = { scheduledTime: Date.now() };
await W.scheduled(wk, env, ectx); await Promise.all(waits.splice(0));
console.log('   cron надіслав:', sent.length);


// Моя команда в MyYL
let tr = await api(VOVA, 'myylTree');
ok(tr.ok && tr.data.roots[0] === 'nat' && tr.data.units.nat.children.length === 7, 'MyYL: Раб Божий бачить Україну і 7 регіонів');
ok(tr.data.units['r:r0'].peopleCount >= 5 && tr.data.units['r:r0'].people.some((p) => p.tgId === '2'), 'MyYL: у West видно РД і людей гілки');
tr = await api(AD, 'myylTree');
ok(tr.ok && tr.data.roots.length === 1 && tr.data.roots[0] === 'a:a1' && tr.data.units['a:a1'].children.length === 2 && !tr.data.units['r:r0'], 'MyYL: Еріа Директор бачить лише свою ерію і її команди');
const capKey = 't:' + capTeam.id;
ok(tr.data.units[capKey].people.length === 3 && tr.data.units[capKey].people[0].roles[0] === 'Капітан', 'MyYL: склад команди в гілці, капітан першим');
tr = await api(SUG, 'myylTree');
ok(tr.ok && tr.data.roots[0] === capKey && Object.keys(tr.data.units).length === 1, 'MyYL: сахарок бачить лише свою команду');

// Написати всім
r = await api(AD, 'broadcastInfo');
ok(!r.ok, 'розсилка: не Раб Божий — немає доступу');
r = await api(AD, 'broadcast', { audience: 'all', text: 'Привіт' });
ok(!r.ok, 'розсилка: не Раб Божий не може надіслати');
r = await api(VOVA, 'broadcastInfo');
ok(r.ok && r.data.audiences.find((a) => a.key === 'all').count === 6 && r.data.audiences.find((a) => a.key === 'leaders').count === 4, 'розсилка: аудиторії пораховано');
sent.length = 0;
r = await api(VOVA, 'broadcast', { audience: 'all', text: 'Молимось за табір <3' });
const bmsg = sent.filter((s) => /Молимось за табір &lt;3/.test(s.text || ''));
ok(r.ok && r.data.sent === 6 && bmsg.length === 6 && bmsg[0].reply_markup, 'розсилка: 6 повідомлень з кнопкою, HTML екрановано');
// велика розсилка — через чергу
for (let i = 100; i < 140; i++) await api({ id: i, first_name: 'Т' + i }, 'register', { name: 'Тест ' + i, roles: ['VOLUNTEER'], teamId: capTeam.id, areaId: 'a1' });
sent.length = 0;
r = await api(VOVA, 'broadcast', { audience: 'all', text: 'Велика розсилка', button: false });
const first = sent.filter((s) => s.text === 'Велика розсилка').length;
let left = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
ok(r.ok && r.data.sent === 46 && first === 25 && left === 21, 'велика розсилка: 25 одразу, 21 у черзі (' + first + '/' + left + ')');
const notFive = new Date(); notFive.setUTCMinutes(7);
await W.scheduled({ scheduledTime: notFive.getTime() }, env, ectx);
left = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
ok(left === 0 && sent.filter((s) => s.text === 'Велика розсилка').length === 46, 'cron дослав решту, без дублів');
r = await api(VOVA, 'broadcastInfo');
ok(r.data.history.length === 2 && r.data.queued === 0, 'історія розсилок');


// фінанси вносять лише капітан / адмін команди
r = await api(RD, 'financeSave', { teamId: capTeam.id, month: T.kyivDay(new Date()).slice(0, 7), prev: 0, office: 1, church: 0, team: 0, spent: 0 });
ok(!r.ok && /лише Капітан/.test(r.message), 'фінанси: РД не може вносити');
r = await api(VOVA, 'financeGet', { teamId: capTeam.id });
ok(r.ok && r.data.canEdit === false && r.data.current.balance === 350, 'фінанси: Раб Божий бачить, але не редагує');
r = await api(CAP, 'financeGet', { teamId: capTeam.id });
ok(r.ok && r.data.canEdit === true, 'фінанси: капітан редагує');

// подія з датою кінця
const d1 = T.kyivDay(new Date(Date.now() - 864e5)), d2 = T.kyivDay(new Date(Date.now() + 2 * 864e5));
r = await api(VOVA, 'eventSave', { level: 'nat', unitId: '', title: 'Табір триває', date: d1, end: d2 });
ok(r.ok, 'подія на кілька днів');
r = await api(VOVA, 'eventSave', { level: 'nat', unitId: '', title: 'X', date: d2, end: d1 });
ok(!r.ok, 'кінець раніше за початок — помилка');
r = await api(LEAD, 'events');
const camp = r.data.find((e) => e.title === 'Табір триває');
ok(camp && camp.end === d2 && camp.date === d1, 'подія, що вже йде, видна з датою кінця');

// рівні статистики: батьківські ключі
r = await api(VOVA, 'stats', { scope: 't:' + capTeam.id });
ok(r.data.scopes.find((x) => x.key === 't:' + capTeam.id).parent === 'a:a1' && r.data.scopes.find((x) => x.key === 'a:a1').parent === 'r:r0', 'статистика: є батьківські ключі');

// звіт
const today = T.kyivDay(new Date()), monthAgo = T.kyivDay(new Date(Date.now() - 30 * 864e5));
me = await api(AD, 'me');
ok(me.data.caps.reportItems.join() === 'club,mg,kr,known,finance', 'звіт: пункти для Еріа Директора');
r = await api(AD, 'report', { units: ['r:r0'], items: ['club'], from: monthAgo, to: today });
ok(!r.ok, 'звіт: ЕД не може замовити регіон (вище за свій рівень)');
r = await api(AD, 'report', { units: ['a:a1', 't:' + capTeam.id], items: ['club', 'finance', 'known'], from: monthAgo, to: today, split: true });
ok(r.ok && r.data.rows.length === 1 + 2 + 1 && r.data.total, 'звіт: ерія з розбивкою + команда + разом');
const capRow = r.data.rows.find((x) => x.child && x.name === 'Нова команда');
ok(capRow && capRow.values.club.v === '12' && capRow.values.finance.inc === '550' && capRow.values.known.total === '1', 'звіт: цифри команди вірні');
ok(r.data.total.values.club.v === '12', 'звіт: «Разом» без подвійного рахунку');
r = await api(VOVA, 'report', { units: ['nat', 'r:r0'], items: ['club', 'kr'], from: monthAgo, to: today });
ok(r.ok, 'звіт: Раб Божий — Україна і регіон');
r = await api(VOVA, 'report', { units: ['a:a1'], items: ['club'], from: monthAgo, to: today });
ok(r.ok, 'звіт: Раб Божий замовляє будь-яку одиницю (ерію)');
r = await api(AD, 'report', { units: ['t:' + capTeam.id], items: ['club'], from: monthAgo, to: today });
ok(r.ok, 'звіт: ЕД — команда (рівень нижче)');
r = await api(SUG, 'report', { units: ['t:' + capTeam.id], items: ['club', 'finance'], from: monthAgo, to: today });
ok(r.ok && r.data.sections.length === 1 && r.data.sections[0].key === 'club', 'звіт: сахарок — лише клуби');
sent.length = 0;
r = await api(AD, 'report', { units: ['a:a1'], items: ['club', 'mg'], from: monthAgo, to: today, send: true });
const doc = sent.find((x) => x.m === 'sendDocument');
ok(r.ok && doc && doc.chat_id === '3' && /<table>/.test(doc.document.text) && /Тернопіль/.test(doc.document.text), 'звіт: HTML-файл надіслано в Telegram');


// знані: масове додавання й етапи
r = await api(LEAD, 'knownBulk', { teamId: capTeam.id, names: '1. Марко Іванюк\nСофія Бойко\n\nоля підліток\n• Денис, Тарас', stage: 'friends' });
ok(r.ok && r.data.added === 4, 'знані: додано 4 нових, дубль «Оля» пропущено (' + (r.data && r.data.added) + ')');
r = await api(LEAD, 'knownList', { teamId: capTeam.id });
const marko = r.data.find((x) => x.name === 'Марко Іванюк');
ok(r.data.length === 5 && marko && marko.stage === 'friends' && r.data.find((x) => x.name === 'Оля Підліток').stage === 'meet', 'знані: етапи збережено');
r = await api(LEAD, 'knownStage', { teamId: capTeam.id, id: marko.id, stage: 'grow' });
ok(r.ok, 'знані: зміна етапу');
r = await api(LEAD, 'knownSave', { teamId: capTeam.id, item: Object.assign({}, marko, { phone: '0501112233', stage: 'own' }) });
r = await api(LEAD, 'knownList', { teamId: capTeam.id });
ok(r.data.find((x) => x.id === marko.id).stage === 'own' && r.data.find((x) => x.id === marko.id).phone === '0501112233', 'знані: редагування контактів і етапу');
r = await api(SUG, 'knownBulk', { teamId: capTeam.id, names: 'Хтось' });
ok(!r.ok, 'знані: сахарок не додає');
r = await api(AD, 'knownList', { units: ['a:a1'] });
ok(r.ok && r.data.length === 5 && r.data[0].team, 'знані: по всій ерії, з назвою команди');
r = await api(AD, 'stats', { units: ['a:a1'], cat: 'known' });
ok(r.ok && r.data.kpis[0].v === '5' && r.data.kpis.find((k) => k.l === 'Дружимо').v === '3' && r.data.kpis.find((k) => k.l === 'Йдуть самі').v === '1', 'статистика знаних по етапах');
r = await api(AD, 'report', { units: ['a:a1'], items: ['known'], from: monthAgo, to: today });
ok(r.ok && r.data.rows[0].values.known.friends === '3', 'звіт знаних по етапах');

// кілька одиниць
r = await api(VOVA, 'stats', { units: ['t:' + capTeam.id, 't:' + teamId], cat: 'club' });
ok(r.ok && r.data.scope.level === 'multi' && r.data.breakdown.rows.length === 2 && r.data.kpis[1].v === '12', 'статистика: дві команди разом');
r = await api(VOVA, 'stats', { units: ['r:r0', 'r:r1'], cat: 'overview' });
ok(r.ok && r.data.breakdown.title === 'Вибрані', 'статистика: два регіони');
r = await api(LEAD, 'stats', { units: ['r:r0'] });
ok(r.ok && r.data.scope.key === 't:' + capTeam.id, 'статистика: чужа одиниця → своя');
r = await api(AD, 'teamMembers', { units: ['a:a1'] });
ok(r.ok && r.data.some((p) => p.team === 'Нова команда') && r.data.some((p) => p.team === 'Тернопіль-Центр'), 'склад: по ерії, з назвами команд');
r = await api(LEAD, 'teamMembers', { units: ['a:a1'] });
ok(!r.ok, 'склад: лідер не може відкрити ерію');
r = await api(RD, 'financeGet', { units: ['r:r0'] });
ok(r.ok && r.data.mode === 'overview' && r.data.rows.length === 2 && r.data.total.done === 1 && r.data.total.inc === 550, 'фінанси: огляд регіону');
r = await api(RD, 'financeGet', { units: ['t:' + capTeam.id] });
ok(r.ok && !r.data.mode && r.data.current.balance === 350 && r.data.canEdit === false, 'фінанси: одна команда через units');

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL OK');
// cron at 9:05 Kyiv today, weekly reminder set to today 9h
const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const kd = T.kyivDay(new Date());
const dow = new Date(kd + 'T12:00:00Z').getUTCDay();
await admin('import', { settings: [{ key: 'REMINDER_DAY', value: DAYS[dow] }, { key: 'REMINDER_HOUR', value: '9' }] });
// 09:05 Kyiv = find UTC by trying offsets
let ts; for (const off of [2, 3]) { const d = new Date(kd + 'T' + String(9 - off).padStart(2, '0') + ':05:00Z'); if (new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',hour:'2-digit',hour12:false}).format(d) === '09') ts = d.getTime(); }
sent.length = 0;
await W.scheduled({ scheduledTime: ts }, env, ectx); await Promise.all(waits.splice(0));
const rem = sent.filter((s) => /Нагадування/.test(s.text || ''));
const evr = sent.filter((s) => /Табір/.test(s.text || ''));
console.log('   тижневих нагадувань:', rem.length, rem.map((s) => s.chat_id).join(','), '| про подію:', evr.length);
const capMsg = rem.find((s) => s.chat_id === '4');
ok(rem.some((s) => s.chat_id === '1') && !rem.some((s) => s.chat_id === '5') && capMsg && !/Клуб/.test(capMsg.text) && /Мала група/.test(capMsg.text), 'тижневе нагадування: лише те, що не здано (лідер усе здав, капітану — без клубу)');
ok(evr.length === 2, 'нагадування про подію двом учасникам');
console.log(fails ? fails + ' FAILED' : 'ALL OK (cron)');
if (fails) process.exit(1);
