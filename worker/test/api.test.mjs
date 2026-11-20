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

// Написати (Раб Божий … Капітан, у своїх межах)
r = await api(LEAD, 'broadcastInfo', {});
ok(!r.ok, 'розсилка: лідер не може');
r = await api(VOVA, 'broadcastInfo', { units: ['nat'] });
ok(r.ok && r.data.count === 5, 'розсилка: Україна — усі з роллю, крім себе (' + (r.data && r.data.count) + ')');
r = await api(VOVA, 'broadcastInfo', { units: ['nat'], pending: true });
ok(r.ok && r.data.count === 5, 'розсилка: + ті, хто чекає');
r = await api(VOVA, 'broadcastInfo', { units: ['nat'], roles: ['CAPTAIN', 'AREA_DIRECTOR', 'REGIONAL_DIRECTOR'] });
ok(r.ok && r.data.count === 3, 'розсилка: лише керівні ролі (' + (r.data && r.data.count) + ')');
r = await api(CAP, 'broadcastInfo', { units: ['r:r0'] });
ok(!r.ok, 'розсилка: капітан не може писати регіону');
r = await api(CAP, 'broadcastInfo', {});
ok(r.ok && r.data.count === 2, 'розсилка: капітан — своя команда (без себе)');
r = await api(AD, 'broadcastInfo', { units: ['a:a1'], roles: ['LEADER'] });
ok(r.ok && r.data.count === 1, 'розсилка: ЕД — лідерам своєї ерії');
sent.length = 0;
r = await api(CAP, 'broadcast', { units: ['t:' + capTeam.id], text: 'Молимось за табір <3' });
const bmsg = sent.filter((s) => /Молимось за табір &lt;3/.test(s.text || ''));
ok(r.ok && r.data.sent === 2 && bmsg.length === 2 && /📣 <b>Кап Тан<\/b> · Капітан · Нова команда/.test(bmsg[0].text) && bmsg[0].reply_markup, 'розсилка: капітан своїй команді, з підписом');
// велика розсилка — через чергу
for (let i = 100; i < 140; i++) await api({ id: i, first_name: 'Т' + i }, 'register', { name: 'Тест ' + i, roles: ['VOLUNTEER'], teamId: capTeam.id, areaId: 'a1' });
for (let i = 100; i < 140; i++) { const q = await api(CAP, 'requests'); if (!q.data.length) break; await api(CAP, 'decide', { roleIds: q.data[0].roles.map((x) => x.id), approve: true }); }
sent.length = 0;
r = await api(VOVA, 'broadcast', { units: ['nat'], text: 'Велика розсилка', button: false });
const first = sent.filter((s) => /Велика розсилка/.test(s.text || '')).length;
let left = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
ok(r.ok && r.data.sent === 45 && first === 25 && left === 20, 'велика розсилка: 25 одразу, 21 у черзі (' + (r.data && r.data.sent) + '/' + first + '/' + left + ')');
const notFive = new Date(); notFive.setUTCMinutes(7);
await W.scheduled({ scheduledTime: notFive.getTime() }, env, ectx);
left = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
ok(left === 0 && sent.filter((s) => /Велика розсилка/.test(s.text || '')).length === 45, 'cron дослав решту, без дублів');
r = await api(VOVA, 'broadcastInfo', { units: ['nat'] });
ok(r.data.history.length === 2 && r.data.queued === 0, 'історія розсилок (Раб Божий бачить усі)');
r = await api(CAP, 'broadcastInfo', {});
ok(r.data.history.length === 1, 'історія: капітан бачить свої');


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


// «Мої» знані: хто вніс
r = await api(CAP, 'knownBulk', { teamId: capTeam.id, names: 'Капітанів Підліток' });
r = await api(LEAD, 'knownList', { teamId: capTeam.id });
ok(r.data.find((x) => x.name === 'Марко Іванюк').authorId === '5' && r.data.find((x) => x.name === 'Капітанів Підліток').authorId === '4', 'знані: видно, хто вніс');


// окремий застосунок: вхід через бота
const auth = async (path, b) => (await W.fetch(new Request('https://w/auth/' + path, { method: 'POST', body: JSON.stringify(b || {}) }), env, ectx)).json();
let st0 = await auth('start');
ok(st0.ok && /^https:\/\/t\.me\/yl_bot\?start=login_[a-f0-9]{40}$/.test(st0.link), 'вхід: посилання на бота');
let pl = await auth('poll', { nonce: st0.nonce });
ok(pl.ok && pl.pending, 'вхід: поки чекаємо');
sent.length = 0;
await req('/tg', { message: { chat: { id: 4, type: 'private' }, from: CAP, text: '/start login_' + st0.nonce } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
ok(sent.some((x) => /Вхід у MyYL підтверджено/.test(x.text || '')), 'вхід: бот підтвердив');
pl = await auth('poll', { nonce: st0.nonce });
ok(pl.ok && pl.session && pl.user.id === 4, 'вхід: отримано сесію');
const pl2 = await auth('poll', { nonce: st0.nonce });
ok(!pl2.ok, 'вхід: повторно токен не видається');
let rs = await req('/', { session: pl.session, action: 'me' }); rs = await rs.json();
ok(rs.ok && rs.data.status === 'active' && rs.data.user.id === '4', 'вхід: API працює з сесією');
rs = await (await req('/', { session: pl.session.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), action: 'me' })).json();
ok(!rs.ok && rs.error === 'auth', 'вхід: підроблена сесія відхилена');
sent.length = 0;
await req('/tg', { message: { chat: { id: 5, type: 'private' }, from: LEAD, text: '/start login_' + st0.nonce } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
ok(sent.some((x) => /застаріло/.test(x.text || '')), 'вхід: використане посилання не спрацює вдруге');


// знані: права й «Без команди»
r = await api(AD, 'knownSave', { teamId: capTeam.id, item: { name: 'Чужий' } });
ok(!r.ok && /лише її учасники/.test(r.message), 'знані: ЕД не додає в команду');
r = await api(AD, 'knownSave', { teamId: '', item: { name: 'Мій підліток', stage: 'friends' } });
ok(r.ok, 'знані: ЕД додає «Без команди»');
const noTeamId = r.data.id;
r = await api(AD, 'knownBulk', { teamId: '', names: 'Мій підліток\nЩе один' });
ok(r.ok && r.data.added === 1, 'знані: список без команди, дубль пропущено');
r = await api(AD, 'knownList', { mine: true });
ok(r.ok && r.data.length === 2 && r.data.every((x) => x.team === 'Без команди' && x.canEdit), 'знані: «Мій список» з «Без команди»');
r = await api(VOVA, 'knownStage', { id: noTeamId, stage: 'own' });
ok(!r.ok, 'знані: чужий особистий список не змінити');
r = await api(AD, 'knownList', { units: ['a:a1'] });
ok(r.ok && !r.data.some((x) => x.name === 'Мій підліток') && r.data.every((x) => x.canEdit === false), 'знані: перегляд ерії — без «Без команди», ЕД лише дивиться');
r = await api(LEAD, 'knownList', { mine: true });
ok(r.ok && r.data.length >= 4 && r.data.every((x) => x.canEdit), 'знані: «Мій список» лідера');
const lm = r.data.find((x) => x.name === 'Софія Бойко');
r = await api(AD, 'knownSave', { teamId: capTeam.id, item: Object.assign({}, lm, { phone: '1' }) });
ok(!r.ok, 'знані: ЕД не редагує знаних команди');
r = await api(CAP, 'knownStage', { id: lm.id, stage: 'own' });
ok(r.ok, 'знані: капітан (учасник команди) змінює етап');
me = await api(AD, 'me');
ok(me.data.caps.knownNoTeam === true && me.data.caps.knownEditTeams.length === 0, 'caps: ЕД — лише «Без команди»');

// події: для кого + редагування
const evDay = T.kyivDay(new Date(Date.now() + 5 * 864e5));
r = await api(VOVA, 'eventSave', { level: 'nat', unitId: '', title: 'Нарада капітанів', date: evDay, roles: ['CAPTAIN', 'AREA_DIRECTOR'] });
const capEv = r.data.id;
ok(r.ok, 'подія для капітанів');
ok((await api(CAP, 'events')).data.some((e) => e.id === capEv && e.rolesLabel === 'Капітан, Еріа Директор'), 'капітан бачить подію для капітанів');
ok(!(await api(LEAD, 'events')).data.some((e) => e.id === capEv), 'лідер не бачить подію для капітанів');
r = await api(VOVA, 'eventSave', { id: capEv, level: 'nat', unitId: '', title: 'Нарада всіх', date: evDay, roles: [] });
ok(r.ok && (await api(LEAD, 'events')).data.some((e) => e.id === capEv && e.title === 'Нарада всіх'), 'редагування: тепер для всіх');
r = await api(LEAD, 'eventSave', { id: capEv, level: 'team', unitId: capTeam.id, title: 'Хак', date: evDay });
ok(!r.ok, 'редагування: лідер не змінює чужу подію');

// бот: посилання на окремий застосунок
sent.length = 0;
await req('/tg', { message: { chat: { id: 9, type: 'private' }, from: { id: 9, first_name: 'Гість' }, text: '/start' } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
const wel = sent.find((x) => x.m === 'sendMessage');
ok(wel && /^https:\/\/t\.me\/\w+\?startapp=home$/.test(wel.reply_markup.inline_keyboard[0][0].url), 'бот: «Відкрити MyYL» — головний застосунок');
ok(wel && /\?startapp=home&addToHomeScreen$/.test(wel.reply_markup.inline_keyboard[1][0].url), 'бот: кнопка «Додати на головний екран»');
sent.length = 0;
await req('/tg', { message: { chat: { id: 9, type: 'private' }, from: { id: 9, first_name: 'Гість' }, text: '/app' } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
ok(sent.some((x) => /Окремий застосунок/i.test(x.text || '') && x.reply_markup.inline_keyboard[1][0].url === 'https://vovayounglife.github.io/MyYL-mini-app/?app=1'), 'бот: /app з інструкцією');


// подія: де (одиниці) + ролі
r = await api(VOVA, 'eventSave', { level: 'nat', unitId: '', title: 'West керівники', date: evDay, aud: ['r:r0'], roles: ['AREA_DIRECTOR', 'REGIONAL_DIRECTOR'] });
const wEv = r.data.id;
ok((await api(AD, 'events')).data.some((e) => e.id === wEv && e.audLabel === 'West'), 'подія West: ЕД з West бачить');
ok((await api(RD, 'events')).data.some((e) => e.id === wEv), 'подія West: РД з West бачить');
ok(!(await api(CAP, 'events')).data.some((e) => e.id === wEv), 'подія West: капітан не бачить');
r = await api(VOVA, 'eventSave', { level: 'nat', unitId: '', title: 'Kyiv', date: evDay, aud: ['r:r1'], roles: ['AREA_DIRECTOR'] });
ok(!(await api(AD, 'events')).data.some((e) => e.title === 'Kyiv'), 'подія Kyiv: ЕД з West не бачить');
r = await api(AD, 'eventSave', { level: 'area', unitId: 'a1', title: 'Чужа', date: evDay, aud: ['r:r1'] });
ok(r.ok && (await api(VOVA, 'events')).data.some((e) => e.title === 'Чужа' && !e.audLabel), 'подія: одиниця поза своєю ерією ігнорується');


// сповіщення
me = await api(VOVA, 'me');
ok(me.data.profile.notif.bc === false && me.data.profile.notif.requests === true, 'сповіщення: Раб Божий за замовчуванням без чужих розсилок');
sent.length = 0;
await api(AD, 'broadcast', { units: ['a:a1'], text: 'Від ЕД' });
ok(!sent.some((x) => x.chat_id === '1' && /Від ЕД/.test(x.text || '')) && !sent.some((x) => x.chat_id === '3' && /Від ЕД/.test(x.text || '')), 'сповіщення: Раб Божий і автор не отримують');
await api(LEAD, 'saveProfile', { notif: { bc: false } });
sent.length = 0;
r = await api(AD, 'broadcast', { units: ['a:a1'], text: 'Ще раз' });
ok(!sent.some((x) => x.chat_id === '5'), 'сповіщення: лідер вимкнув розсилки');
me = await api(LEAD, 'me');
ok(me.data.profile.notif.bc === false && me.data.profile.notif.remind === true, 'сповіщення: збережено');
// статистика «Команда»
r = await api(AD, 'stats', { units: ['a:a1'], cat: 'people' });
ok(r.ok && r.data.cats.some((x) => x.key === 'people' && x.label === 'Команда') && r.data.kpis[0].l === 'Людей усього' && r.data.breakdown.rows.length === 2 && r.data.chart.bars.length === 8 && r.data.chart.bars[7].label === 'Офіс', 'статистика «Команда» по ерії');
r = await api(CAP, 'stats', { units: ['t:' + capTeam.id], cat: 'people' });
ok(r.ok && r.data.breakdown.title === 'Ролі' && r.data.breakdown.rows.some((x) => x.name === 'Волонтер'), 'статистика «Команда» по команді — ролі');


// хто вносить: клуб — Капітан, Адмін команди, Еріа Директор; МГ і КР — кожен за себе
r = await api(RD, 'saveReport', { type: 'club', teamId: capTeam.id, mode: 'week', teens: 3 });
ok(!r.ok && /Еріа Директор/.test(r.message), 'клуб: РД не вносить');
r = await api(AD, 'saveReport', { type: 'club', teamId: capTeam.id, mode: 'week', teens: 3 });
ok(r.ok, 'клуб: Еріа Директор вносить');
me = await api(AD, 'me');
ok(me.data.caps.report.club.length === 2 && me.data.caps.report.kr.length === 0, 'caps: ЕД — клуби своєї ерії, КР — не за команду');
const krA0 = (await api(VOVA, 'stats', { units: ['a:a1'], cat: 'kr', period: 'week' })).data;
r = await api(AD, 'saveReport', { type: 'kr', mode: 'week', hours: 2 });
ok(r.ok && r.data.week.items.some((x) => x.type === 'kr' && x.status === 'ok' && x.hours === 2), 'КР: ЕД вносить за себе');
const krA1 = (await api(VOVA, 'stats', { units: ['a:a1'], cat: 'kr', period: 'week' })).data;
const krR1 = (await api(VOVA, 'stats', { units: ['r:r0'], cat: 'kr', period: 'week' })).data;
ok(Number(String(krA1.kpis[0].v).replace(',', '.')) - Number(String(krA0.kpis[0].v).replace(',', '.')) === 2, 'КР ЕД: зараховано в ерію');
const repAD = await api(AD, 'report', { units: ['a:a1'], items: ['kr'], from: T.kyivDay(new Date(Date.now() - 7 * 864e5)), to: T.kyivDay(new Date()) });
ok(repAD.ok && Number(String(repAD.data.rows[0].values.kr.h).replace(',', '.')) >= 2, 'КР ЕД: є у звіті ерії');
me = await api(AD, 'me');
ok(me.data.caps.reportSelf.kr && me.data.caps.reportSelf.unit === 'Ерія Тернопіль', 'caps: ЕД може вносити за себе (Ерія Тернопіль)');
const DUO = { id: 77, first_name: 'Дует' };
await api(DUO, 'register', { name: 'Дует Лідер', roles: ['LEADER'], teamId: capTeam.id, areaId: 'a1' });
await api(DUO, 'requestRoles', { roles: ['LEADER'], teamId: teamId, areaId: 'a1' });
reqs = await api(VOVA, 'requests');
for (const p of reqs.data.filter((x) => x.tgId === '77')) await api(VOVA, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });
me = await api(DUO, 'me');
ok(me.data.caps.report.kr.length === 2 && me.data.week.items.filter((x) => x.type === 'kr').length === 1, 'КР: одна позиція тижня для людини у двох командах');
const before = (await api(VOVA, 'stats', { units: ['a:a1'], cat: 'kr', period: 'week' })).data;
r = await api(DUO, 'saveReport', { type: 'kr', mode: 'week', hours: 3, teamId: 'будь-яка' });
ok(r.ok && r.data.week.items.find((x) => x.type === 'kr').hours === 3, 'КР: внесено за себе (3 год, не 6)');
const after = (await api(VOVA, 'stats', { units: ['a:a1'], cat: 'kr', period: 'week' })).data;
const hrs = (d) => Number(String(d.kpis[0].v).replace(',', '.'));
ok(Math.abs(hrs(after) - hrs(before) - 3) < 0.01, 'КР: в ерії +3 год без подвійного рахунку (' + hrs(before) + '→' + hrs(after) + ')');
const tA = (await api(VOVA, 'stats', { units: ['t:' + capTeam.id], cat: 'kr', period: 'week' })).data, tB = (await api(VOVA, 'stats', { units: ['t:' + teamId], cat: 'kr', period: 'week' })).data;
ok(hrs(tA) >= 3 && hrs(tB) >= 3, 'КР: зараховано в обидві команди');


// видалення команди / обʼєднання дубля
r = await api(AD, 'teamSave', { areaId: 'a1', name: 'Порожня' });
const emptyT = r.data.id;
r = await api(AD, 'teamDelete', { id: emptyT, dry: true });
ok(r.ok && r.data.empty && r.data.targets.length >= 2, 'видалення: порожня команда');
r = await api(CAP, 'teamDelete', { id: emptyT });
ok(!r.ok, 'видалення: капітан не може');
r = await api(AD, 'teamDelete', { id: emptyT });
ok(r.ok && !(await api(AD, 'structureTree')).data[0].areas[0].teams.some((x) => x.id === emptyT), 'видалення: порожню видалено');
r = await api(AD, 'teamSave', { areaId: 'a1', name: 'Дубль' });
const dup = r.data.id;
await api({ id: 88, first_name: 'Д' }, 'register', { name: 'Дубль Капітан', roles: ['CAPTAIN'], teamId: dup, areaId: 'a1', email: 'd@gmail.com' });
reqs = await api(AD, 'requests'); for (const p of reqs.data.filter((x) => x.tgId === '88')) await api(AD, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });
await api({ id: 88, first_name: 'Д' }, 'saveReport', { type: 'club', teamId: dup, mode: 'week', teens: 4 });
await api({ id: 88, first_name: 'Д' }, 'knownSave', { teamId: dup, item: { name: 'Дублів Підліток' } });
r = await api(AD, 'teamDelete', { id: dup, dry: true });
ok(r.ok && !r.data.empty && r.data.usage.people === 1 && r.data.usage.reports === 1 && r.data.usage.known === 1, 'видалення: дубль з даними');
r = await api(AD, 'teamDelete', { id: dup });
ok(!r.ok, 'видалення: з даними без перенесення — не можна');
r = await api(AD, 'teamDelete', { id: dup, mergeInto: teamId });
ok(r.ok && r.data.merged, 'обʼєднання виконано');
const mm = await api({ id: 88, first_name: 'Д' }, 'me');
ok(mm.data.myTeams[0].id === teamId && mm.data.week.items.find((x) => x.type === 'club').status === 'ok', 'обʼєднання: людина й звіт перейшли');
r = await api(AD, 'knownList', { units: ['t:' + teamId] });
ok(r.data.some((x) => x.name === 'Дублів Підліток'), 'обʼєднання: знані перейшли');


// знані «Без команди» в статистиці рівня автора
const kA = (await api(VOVA, 'stats', { units: ['a:a1'], cat: 'known' })).data;
const kT = (await api(VOVA, 'stats', { units: ['t:' + capTeam.id, 't:' + teamId], cat: 'known' })).data;
ok(Number(kA.kpis[0].v) - Number(kT.kpis[0].v) === 2, 'знані «Без команди» ЕД рахуються в його ерії (+2): ' + kA.kpis[0].v + ' vs ' + kT.kpis[0].v);
const kR = (await api(VOVA, 'stats', { units: ['r:r0'], cat: 'known' })).data;
ok(kR.breakdown.rows.find((x) => x.name === 'Тернопіль').value === Number(kA.kpis[0].v), 'знані: розбивка регіону враховує «Без команди»');
const rk = await api(VOVA, 'report', { units: ['a:a1'], items: ['known'], from: monthAgo, to: today });
ok(rk.data.rows[0].values.known.total === kA.kpis[0].v, 'знані «Без команди» — і у звіті');
// напрям команди
r = await api(AD, 'teamSave', { areaId: 'a1', name: 'Мами', dir: 'YoungMoms' });
const momT = r.data.id;
let tree = (await api(AD, 'structureTree')).data;
ok(tree[0].areas[0].teams.find((x) => x.id === momT).dir === 'YoungMoms', 'напрям: YoungMoms при створенні');
await api(AD, 'teamSave', { id: momT, dir: 'College' });
tree = (await api(AD, 'structureTree')).data;
ok(tree[0].areas[0].teams.find((x) => x.id === momT).dir === 'College', 'напрям: змінено на College');
r = await api(AD, 'teamSave', { id: momT, dir: 'Хакер' });
tree = (await api(AD, 'structureTree')).data;
ok(tree[0].areas[0].teams.find((x) => x.id === momT).dir === 'College', 'напрям: невідомий ігнорується');


// основна роль: особисті знані рахуються там
await api(VOVA, 'requestRoles', { roles: ['REGIONAL_DIRECTOR'], regionId: 'r0' });
await api(VOVA, 'knownBulk', { teamId: '', names: 'Вовин 1\nВовин 2\nВовин 3' });
const kr0 = Number((await api(VOVA, 'stats', { units: ['r:r0'], cat: 'known' })).data.kpis[0].v);
me = await api(VOVA, 'me');
const rdRole = me.data.roles.find((x) => x.key === 'REGIONAL_DIRECTOR' && x.unitId === 'r0');
r = await api(VOVA, 'saveProfile', { main: rdRole.id });
ok(r.ok && r.data.main === rdRole.id, 'основна роль збережена');
const kr1 = Number((await api(VOVA, 'stats', { units: ['r:r0'], cat: 'known' })).data.kpis[0].v);
ok(kr1 - kr0 === 3, 'основна роль West: особисті знані рахуються в West (' + kr0 + '→' + kr1 + ')');
r = await api(VOVA, 'saveProfile', { main: 'чужа' });
ok(!r.ok, 'основна роль: лише своя');
// склад: усі ролі людини, можна зняти
r = await api(RD, 'teamMembers', { units: ['t:' + teamId] });
const vv = r.data.find((p) => p.tgId === '1');
ok(vv && vv.all.some((x) => x.label === 'Раб Божий' && !x.canRemove) && vv.all.some((x) => x.label === 'Капітан'), 'склад: видно всі ролі людини, Раба Божого не зняти');
const duo = r.data.find((p) => p.tgId === '77');
const duoOther = duo && duo.all.find((x) => x.label === 'Лідер' && x.unit !== 'Команда «Тернопіль-Центр»');
ok(duoOther && duoOther.canRemove, 'склад: РД може зняти роль в іншій команді');
// видалення без перенесення
r = await api(AD, 'teamSave', { areaId: 'a1', name: 'Тимчасова' });
const tmpT = r.data.id;
await api({ id: 91, first_name: 'Т' }, 'register', { name: 'Тимч', roles: ['CAPTAIN'], teamId: tmpT, areaId: 'a1', email: 't@gmail.com' });
reqs = await api(AD, 'requests'); for (const p of reqs.data.filter((x) => x.tgId === '91')) await api(AD, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });
await api({ id: 91, first_name: 'Т' }, 'saveReport', { type: 'club', teamId: tmpT, mode: 'week', teens: 9 });
r = await api(AD, 'teamDelete', { id: tmpT, dry: true });
ok(r.data.targets.every((x) => x.same), 'видалення: перенести можна лише в межах ерії');
r = await api(AD, 'teamDelete', { id: tmpT, drop: true });
ok(r.ok && (await api({ id: 91, first_name: 'Т' }, 'me')).data.status !== 'active', 'видалення без перенесення: ролі зняті, команда зникла');


// офіс ерії / регіону з власною назвою ролі
const OFF = { id: 220, first_name: 'Офіс' };
r = await api(OFF, 'register', { name: 'Ірина Бух', roles: ['AREA_OFFICE'], regionId: 'r0', areaId: 'a1', titles: { AREA_OFFICE: 'Бухгалтер' } });
ok(r.ok, 'офіс ерії: заявка');
reqs = await api(AD, 'requests');
const offReq = reqs.data.find((p) => p.tgId === '220');
ok(offReq && offReq.primary && offReq.roles[0].label === 'Бухгалтер (офіс ерії)' && offReq.roles[0].titled, 'офіс ерії: ЕД бачить заявку з назвою ролі');
r = await api(AD, 'decide', { roleIds: [offReq.roles[0].id], approve: true, titles: { [offReq.roles[0].id]: 'Головний бухгалтер' } });
me = await api(OFF, 'me');
ok(me.data.status === 'active' && me.data.roles.find((x) => x.key === 'AREA_OFFICE').label === 'Головний бухгалтер (офіс ерії)', 'офіс ерії: підтверджено з відредагованою назвою');
r = await api(AD, 'teamMembers', { units: ['a:a1'] });
ok(r.ok && r.data.some((p) => p.tgId === '220' && p.team === 'Офіс ерії Тернопіль') && r.data[0].office, 'склад ерії: офіс ерії першим');
r = await api(AD, 'stats', { units: ['a:a1'], cat: 'people' });
ok(r.data.kpis.find((k) => k.l === 'В офісі ерій і регіонів').v === '2', 'статистика: офіс ерії враховано (ЕД + бухгалтер)');
r = await api(RD, 'roleTitle', { roleId: offReq.roles[0].id, title: 'Фінансист' });
ok(r.ok && r.data.label === 'Фінансист (офіс ерії)', 'назву ролі змінює керівник');
r = await api(CAP, 'roleTitle', { roleId: offReq.roles[0].id, title: 'Хак' });
ok(!r.ok, 'капітан не змінює назву офісної ролі');


// ── повторювані події ──
const tday = T.kyivDay(new Date());
const addD = (k, n) => { const q = k.split('-').map(Number); return new Date(Date.UTC(q[0], q[1] - 1, q[2] + n)).toISOString().slice(0, 10); };
r = await api(AD, 'eventSave', { level: 'area', unitId: 'a1', title: 'Молитва щосереди', date: tday, time: '19:00', rep: 'week', until: addD(tday, 28) });
ok(r.ok, 'повтор: подію створено');
const serId = r.data.id;
let evs = (await api(CAP, 'events')).data.filter((e) => e.seriesId === serId);
ok(evs.length === 5 && evs[0].id === serId + '@' + tday && evs[1].date === addD(tday, 7) && evs[0].repLabel === 'щотижня', 'повтор: 5 дат щотижня до кінця');
r = await api(CAP, 'rsvp', { id: evs[1].id, going: true });
evs = (await api(CAP, 'events')).data.filter((e) => e.seriesId === serId);
ok(r.ok && evs[1].isGoing && !evs[0].isGoing, 'повтор: «Йду» лише на одну дату');
r = await api(CAP, 'rsvp', { id: serId + '@' + addD(tday, 3), going: true });
ok(!r.ok, 'повтор: неіснуюча дата відхиляється');
r = await api(AD, 'eventDelete', { id: evs[2].id, only: true });
evs = (await api(CAP, 'events')).data.filter((e) => e.seriesId === serId);
ok(r.ok && evs.length === 4 && !evs.some((e) => e.date === addD(tday, 14)), 'повтор: скасовано одну дату');
r = await api(AD, 'eventSave', { id: evs[0].id, level: 'area', unitId: 'a1', title: 'Молитва', date: tday, time: '19:00', rep: 'month' });
evs = (await api(CAP, 'events')).data.filter((e) => e.seriesId === serId);
ok(r.ok && evs.length === 12 && evs[0].title === 'Молитва' && evs[0].repLabel === 'щомісяця', 'повтор: редагування серії → щомісяця, 12 найближчих');
r = await api(AD, 'eventDelete', { id: evs[3].id });
ok(r.ok && !(await api(CAP, 'events')).data.some((e) => e.seriesId === serId), 'повтор: видалено всю серію');

// ── задачі ──
r = await api(LEAD, 'taskSave', { title: 'X', units: ['a:a1'] });
ok(!r.ok, 'задачі: лідер не створює');
r = await api(AD, 'audCount', { units: ['a:a1'], roles: ['CAPTAIN', 'LEADER'] });
ok(r.ok && r.data.count >= 2, 'задачі: лічильник аудиторії');
sent.length = 0;
r = await api(AD, 'taskSave', { title: 'Здати списки на табір', desc: 'До п’ятниці', due: addD(tday, 5), units: ['a:a1'], roles: ['CAPTAIN', 'LEADER'] });
ok(r.ok && r.data.count >= 2 && sent.some((m) => m.chat_id === '4' && /Нова задача/.test(m.text)), 'задачі: створено і надіслано');
const taskId = r.data.id;
let tl = await api(CAP, 'tasks');
let tk = tl.data.list.find((t) => t.id === taskId);
ok(tk && tk.mine && tk.mine.status === 'todo' && !tk.oversee && !tk.people, 'задачі: капітан бачить свою, без чужих статусів');
me = await api(CAP, 'me');
ok(me.data.todo.tasks === 1, 'задачі: лічильник на головній');
r = await api(CAP, 'taskStatus', { id: taskId, status: 'doing', note: 'Зібрав половину' });
ok(r.ok && r.data.mine.status === 'doing', 'задачі: статус «в процесі» з нотаткою');
tk = (await api(AD, 'tasks')).data.list.find((t) => t.id === taskId);
ok(tk.oversee && tk.people.find((p) => p.tgId === '4').note === 'Зібрав половину' && tk.doing === 1, 'задачі: автор бачить стан і нотатки');
tk = (await api(RD, 'tasks')).data.list.find((t) => t.id === taskId);
ok(tk && tk.oversee, 'задачі: регіональний (вища роль) теж бачить хід');
r = await api(SUG, 'taskStatus', { id: taskId, status: 'done' });
ok(!r.ok, 'задачі: не виконавець не змінює статус');
sent.length = 0;
r = await api(AD, 'taskNudge', { id: taskId });
ok(r.ok && r.data.sent >= 2, 'задачі: нагадати тим, хто не виконав');
for (const u of [CAP, LEAD]) await api(u, 'taskStatus', { id: taskId, status: 'done' });
tk = (await api(AD, 'tasks')).data.list.find((t) => t.id === taskId);
const allDone = tk.done === tk.total;
ok(!allDone || sent.some((m) => m.chat_id === '3' && /виконали задачу/.test(m.text)), 'задачі: автору — коли всі виконали');
r = await api(CAP, 'taskClose', { id: taskId });
ok(!r.ok, 'задачі: завершує лише автор');
r = await api(AD, 'taskClose', { id: taskId });
ok(r.ok && r.data.closed, 'задачі: автор завершив');
r = await api(AD, 'taskDelete', { id: taskId });
ok(r.ok && !(await api(AD, 'tasks')).data.list.some((t) => t.id === taskId), 'задачі: видалено');

// ── опитування ──
r = await api(AD, 'pollSave', { question: 'Коли збори?', options: ['Субота', 'Неділя', ''], units: ['a:a1'] });
ok(r.ok && r.data.count >= 2, 'опитування: створено');
const pollId = r.data.id;
let pq = (await api(LEAD, 'polls')).data.list.find((p) => p.id === pollId);
ok(pq && pq.canVote && pq.options.length === 2 && !pq.counts && !pq.who, 'опитування: учасник бачить варіанти, без результатів');
r = await api(LEAD, 'pollVote', { id: pollId, opts: [1] });
ok(r.ok && r.data.mine[0] === 1 && !r.data.who, 'опитування: голос прийнято');
r = await api(CAP, 'pollVote', { id: pollId, opts: [0, 1] });
ok(r.ok && r.data.mine.length === 1 && r.data.mine[0] === 0, 'опитування: один варіант, якщо не множинний');
pq = (await api(AD, 'polls')).data.list.find((p) => p.id === pollId);
ok(pq.counts[0] === 1 && pq.counts[1] === 1 && pq.who[1].includes('Лід Ер') && pq.voted === 2 && Array.isArray(pq.notVoted), 'опитування: автор бачить кількість і хто за що');
pq = (await api(RD, 'polls')).data.list.find((p) => p.id === pollId);
ok(pq && pq.who, 'опитування: вища роль бачить, хто за що');
r = await api(AD, 'pollClose', { id: pollId });
r = await api(LEAD, 'pollVote', { id: pollId, opts: [0] });
ok(!r.ok, 'опитування: після завершення голосувати не можна');
r = await api(AD, 'pollSave', { question: 'Відкрите?', options: ['Так', 'Ні'], units: ['a:a1'], open: true, multi: true });
r = await api(LEAD, 'pollVote', { id: r.data.id, opts: [0, 1] });
ok(r.ok && r.data.mine.length === 2 && r.data.counts && !r.data.who, 'опитування: відкриті результати — кількість без імен; кілька варіантів');


// ── дозволи й доступ ──
r = await api(LEAD, 'permsGet', {});
ok(!r.ok, 'дозволи: лідер не налаштовує');
r = await api(RD, 'permsGet', {});
ok(r.ok && r.data.unit === 'r:r0' && r.data.roles[0].key === 'REGIONAL_ADMIN' && r.data.cells.LEADER['rep.mg'].on && !r.data.cells.SUGAR['rep.kr'].on, 'дозволи: регіональний бачить ролі нижче з типовими значеннями');
r = await api(AD, 'permSet', { unit: 'a:a1', role: 'LEADER', perm: 'rep.mg', on: false });
ok(r.ok && r.data.cells.LEADER['rep.mg'].on === false && r.data.cells.LEADER['rep.mg'].custom, 'дозволи: ЕД заборонив лідерам МГ');
me = await api(LEAD, 'me');
ok(me.data.caps.report.mg.length === 0 && !me.data.caps.reportSelf.mg, 'дозволи: у лідера зникла МГ');
r = await api(LEAD, 'saveReport', { type: 'mg', mode: 'week', count: 3 });
ok(!r.ok, 'дозволи: сервер не приймає МГ від лідера');
const capPerm = (await api(CAP, 'permsGet', {})).data;
ok(capPerm.unit.indexOf('t:') === 0 && capPerm.cells.LEADER['rep.mg'].locked && !capPerm.roles.some((x) => x.key === 'CAPTAIN'), 'дозволи: капітан бачить замок від ерії, себе не налаштовує');
r = await api(CAP, 'permSet', { unit: capPerm.unit, role: 'LEADER', perm: 'rep.mg', on: true });
ok(!r.ok, 'дозволи: нижча ланка не знімає заборону вищої');
r = await api(CAP, 'permSet', { unit: capPerm.unit, role: 'SUGAR', perm: 'rep.kr', on: true });
me = await api(SUG, 'me');
ok(r.ok && me.data.caps.report.kr.length === 1, 'дозволи: капітан дозволив сахаркам КР');
r = await api(CAP, 'permSet', { unit: 'a:a1', role: 'SUGAR', perm: 'rep.kr', on: true });
ok(!r.ok, 'дозволи: капітан не налаштовує ерію');
r = await api(RD, 'permSet', { unit: 'r:r0', role: 'SUGAR', perm: 'part.polls', on: false });
const pollN = (await api(AD, 'audCount', { units: ['a:a1'], kind: 'poll' })).data.count, allN = (await api(AD, 'audCount', { units: ['a:a1'] })).data.count;
ok(r.ok && pollN === allN - 1, 'дозволи: сахарок не отримує опитувань');
r = await api(AD, 'permSet', { unit: 'a:a1', role: 'CAPTAIN', perm: 'see.stats', on: false });
me = await api(CAP, 'me');
r = await api(CAP, 'stats', {});
ok(me.data.caps.stats === false && !r.ok, 'дозволи: капітан без статистики');
r = await api(AD, 'permReset', { unit: 'a:a1', role: 'CAPTAIN' });
r = await api(AD, 'permReset', { unit: 'a:a1', role: 'LEADER' });
me = await api(LEAD, 'me');
ok(me.data.caps.report.mg.length === 1 && (await api(CAP, 'stats', {})).ok, 'дозволи: скинуто до типових');
await api(RD, 'permReset', { unit: 'r:r0', role: 'SUGAR' });
await api(CAP, 'permReset', { unit: capPerm.unit, role: 'SUGAR' });


// ── каса команди ──
const curM = T.kyivDay(new Date()).slice(0, 7);
let fx = await api(CAP, 'finTx', { teamId: capTeam.id });
const bal0 = fx.data.balance;
ok(fx.ok && typeof bal0 === 'number', 'каса: поточний баланс ' + bal0);
r = await api(LEAD, 'finTx', { teamId: capTeam.id });
ok(!r.ok, 'каса: лідер не веде касу');
r = await api(RD, 'finTxAdd', { teamId: capTeam.id, kind: 'in', amount: 10 });
ok(!r.ok, 'каса: регіональний лише переглядає');
fx = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'in', src: 'office', amount: 200 });
ok(fx.ok && fx.data.balance === bal0 + 200 && fx.data.items[0].srcLabel === 'Дав офіс', 'каса: дохід від офісу');
r = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'out', amount: 120 });
ok(!r.ok, 'каса: витрата без опису не приймається');
fx = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'out', amount: 120.5, note: 'Піца на клуб' });
ok(fx.ok && fx.data.balance === bal0 + 79.5 && fx.data.month.spent > 0, 'каса: витрата зменшила баланс');
let fg = await api(RD, 'financeGet', { teamId: capTeam.id, month: curM });
ok(fg.data.current.balance === bal0 + 79.5, 'каса: місячний звіт оновився');
fx = await api(CAP, 'finTxDelete', { teamId: capTeam.id, id: fx.data.items.find((x) => x.kind === 'out').id });
ok(fx.ok && fx.data.balance === bal0 + 200 && !fx.data.items.some((x) => x.kind === 'out'), 'каса: видалення повертає баланс');
const prevMonthDay = (() => { const q = curM.split('-').map(Number); return new Date(Date.UTC(q[0], q[1] - 2, 15)).toISOString().slice(0, 10); })();
fg = await api(CAP, 'financeGet', { teamId: capTeam.id, month: curM });
const curNoPrev = fg.data.current.balance - fg.data.current.prev;
fx = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'in', src: 'church', amount: 50, date: prevMonthDay });
fg = await api(CAP, 'financeGet', { teamId: capTeam.id, month: curM });
ok(fx.ok && fg.data.current.prev === 50 && fx.data.balance === 50 + curNoPrev, 'каса: запис минулим місяцем переносить залишок');


// ── національний офіс ──
const NO = { id: 230, first_name: 'Нац' };
sent.length = 0;
r = await api(NO, 'register', { name: 'Наталія Офіс', roles: ['OFFICE'], titles: { OFFICE: 'Фандрейзер, HR' } });
ok(r.ok && sent.some((m) => m.chat_id === '1' && /Нова заявка/.test(m.text)), 'нац. офіс: заявка без регіону, Раб Божий отримав');
me = await api(VOVA, 'me');
const defOff = me.data.roleDefs.find((x) => x.key === 'OFFICE');
ok(defOff.level === 'nat' && defOff.titles[0].items.includes('Операційний директор') && defOff.titles[1].group === 'Експерти', 'нац. офіс: список посад');
reqs = await api(RD, 'requests');
const noReqRd = [].concat(reqs.data || []).find((p) => p.tgId === '230');
ok(!noReqRd || !noReqRd.primary, 'нац. офіс: регіональний не основний підтверджувач');
reqs = await api(VOVA, 'requests');
const noReq = reqs.data.find((p) => p.tgId === '230');
ok(noReq && noReq.roles[0].label === 'Фандрейзер, HR (національний офіс)', 'нац. офіс: Раб Божий бачить заявку з посадою');
r = await api(RD, 'decide', { roleIds: [noReq.roles[0].id], approve: true });
ok(!r.ok, 'нац. офіс: регіональний не підтверджує');
r = await api(VOVA, 'decide', { roleIds: [noReq.roles[0].id], approve: true });
r = await api(VOVA, 'teamMembers', { units: ['nat'] });
ok(r.ok && r.data.some((p) => p.tgId === '230' && p.team === 'Національний офіс'), 'нац. офіс: у складі окремою групою');


// ── люди в складі без MyYL ──
const audBefore = (await api(AD, 'audCount', { units: ['a:a1'] })).data.count;
r = await api(LEAD, 'memberAdd', { teamId: capTeam.id, names: 'Хтось Інший', role: 'HELPER' });
ok(!r.ok, 'склад: лідер не додає людей');
r = await api(CAP, 'memberAdd', { teamId: capTeam.id, names: 'Олег Тестовий\n2) Марія Нова', role: 'HELPER' });
ok(r.ok && r.data.added === 2, 'склад: капітан додав двох');
r = await api(CAP, 'memberAdd', { teamId: capTeam.id, names: 'Тестовий Олег', role: 'LEADER' });
ok(r.ok && r.data.dup === 1, 'склад: дубль (інший порядок слів) пропущено');
r = await api(CAP, 'memberAdd', { teamId: capTeam.id, names: 'Новий Капітан', role: 'CAPTAIN' });
ok(!r.ok, 'склад: капітан не дає роль капітана');
me = await api(CAP, 'me');
const capAdd = me.data.caps.addTeams.find((x) => x.id === capTeam.id);
ok(capAdd && capAdd.roles.includes('HELPER') && !capAdd.roles.includes('CAPTAIN'), 'склад: caps.addTeams');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
const olegRow = r.data.find((p) => p.name === 'Олег Тестовий');
ok(olegRow && olegRow.registered === false && r.data.find((p) => p.tgId === '4').registered === true, 'склад: позначка «в MyYL»');
ok((await api(AD, 'audCount', { units: ['a:a1'] })).data.count === audBefore, 'склад: люди без MyYL не отримують розсилок');
const OLEG = { id: 240, first_name: 'Олег' };
r = await api(OLEG, 'claimFind', { teamId: capTeam.id, name: 'Олег Тестовийй' });
ok(r.ok && r.data.length >= 1 && r.data[0].name === 'Олег Тестовий' && r.data[0].roles[0] === 'Помічник', 'реєстрація: знайдено схоже імʼя в команді');
sent.length = 0;
r = await api(OLEG, 'register', { name: 'Олег Тестовийй', teamId: capTeam.id, areaId: 'a1', claim: r.data[0].id, roles: [] });
me = await api(OLEG, 'me');
ok(r.ok && me.data.status === 'active' && me.data.roles.some((x) => x.key === 'HELPER' && x.status === 'активна') && sent.some((m) => m.chat_id === '4' && /обрав\(ла\) себе/.test(m.text)), 'реєстрація: обрав себе — роль одразу, капітан отримав повідомлення');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
ok(!r.data.some((p) => p.name === 'Олег Тестовий' && !p.registered) && r.data.some((p) => p.tgId === '240' && p.registered), 'склад: запис без MyYL став зареєстрованим');
// імпорт з табличок
const seed = [{ area: ['Тернопіль'], team: 'Імпорт Тест', people: [['Лід Ер', 'HELPER'], ['Петро Новий', 'LEADER'], ['Хтось', 'BOSS']] }];
r = await admin('members', { teams: seed });
ok(r.ok && r.totals.teamsCreated === 1 && r.totals.linked === 1 && r.totals.added === 1 && r.totals.bad === 1, 'імпорт: команда створена, зареєстрований привʼязаний, новий доданий');
r = await admin('members', { teams: seed });
ok(r.ok && r.skipped, 'імпорт: повторно не виконується');
const keyE = crypto.createHash('sha256').update('k3y').digest(), ivE = crypto.randomBytes(12);
const ciph = crypto.createCipheriv('aes-256-gcm', keyE, ivE);
const encB = Buffer.concat([ivE, ciph.update(JSON.stringify([{ area: ['Невідома'], team: 'X', people: [] }]), 'utf8'), ciph.final(), ciph.getAuthTag()]).toString('base64');
r = await admin('members', { enc: encB });
ok(r.ok && r.missingAreas[0] === 'Невідома', 'імпорт: зашифровані дані розшифровано');


// ── історія з табличок ──
const encOf = (obj) => { const iv = crypto.randomBytes(12), c2 = crypto.createCipheriv('aes-256-gcm', keyE, iv); return Buffer.concat([iv, c2.update(JSON.stringify(obj), 'utf8'), c2.final(), c2.getAuthTag()]).toString('base64'); };
const hist = [{ area: ['Тернопіль'], team: 'Імпорт Тест', club: [['2025-10-03', 12, 4, 'Тема', 'Проповідник: Оля'], ['2025-10-10', 0, 0, '', '']],
  mg: [['2025-10-05', 5, 'Петро Новий', ''], ['2025-10-05', 5, 'Петро Новий', '']], kr: [['2025-10-06', 2, 'Лід Ер']], known: [['Аня', 'Петро Новий'], ['аня', 'Лід Ер'], ['Макс', '']],
  fin: [['2025-09', 0, 500, 100, 200, 400], ['2025-10', 400, 0, 0, 100, 300]] }, { area: ['Тернопіль'], team: 'Немає такої', club: [] }];
const encH = encOf(hist);
r = await admin('history', { enc: encH, index: 0 });
ok(r.ok && r.n === 2 && r.club === 2 && r.mg === 1 && r.kr === 1 && r.known === 2 && r.fin === 2 && r.unknownAuthors === 0, 'історія: імпорт команди ' + JSON.stringify(r));
r = await admin('history', { enc: encH, index: 0 });
ok(r.ok && r.skipped, 'історія: повторно не імпортується');
r = await admin('history', { enc: encH, index: 1 });
ok(r.ok && r.missing, 'історія: невідома команда пропущена');
r = await admin('history', { enc: encH, index: 2 });
ok(r.ok && r.done, 'історія: кінець списку');
const impTeam = (await api(VOVA, 'me')).data.scopes.find((x) => x.name === 'Імпорт Тест');
r = await api(VOVA, 'financeGet', { teamId: impTeam.unitId, month: '2025-10' });
ok(r.ok && r.data.current.balance === 300 && r.data.current.prev === 400, 'історія: фінанси місяця');
r = await api(VOVA, 'knownList', { units: [impTeam.key] });
ok(r.ok && JSON.stringify(r.data).includes('Макс'), 'історія: знані');


// ── звірка балансу каси ──
let fz = await api(CAP, 'finTx', { teamId: capTeam.id });
const balZ = fz.data.balance;
fz = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'adj', balance: '1234,5', note: 'перерахували гаманець' });
ok(fz.ok && fz.data.balance === 1234.5 && fz.data.items[0].kind === 'adj' && fz.data.items[0].amount === Math.round((1234.5 - balZ) * 100) / 100, 'каса: звірка балансу');
r = await api(CAP, 'finTxAdd', { teamId: capTeam.id, kind: 'adj', balance: 1234.5 });
ok(!r.ok, 'каса: звірка без змін відхиляється');
fz = await api(CAP, 'finTxDelete', { teamId: capTeam.id, id: fz.data.items[0].id });
ok(fz.ok && fz.data.balance === balZ, 'каса: скасування звірки');
r = await api(VOVA, 'nudge', { units: ['a:a1'], type: 'mg' });
ok(!r.ok, 'нагадати можна лише про клуб');


// ── свій період і напрямки ──
r = await api(VOVA, 'stats', { units: [impTeam.key], cat: 'club', period: 'custom', from: '2025-10-01', to: '2025-10-31' });
ok(r.ok && r.data.period === 'custom' && r.data.kpis[0].v === '1' && r.data.kpis[1].v === '12' && r.data.range.from === '2025-10-01', 'статистика: свій період');
r = await api(VOVA, 'stats', { units: [impTeam.key], cat: 'club', period: 'custom', from: '2024-01-01', to: '2025-12-31' });
ok(r.ok && r.data.chart.bars.length === 24, 'статистика: довгий період — по місяцях');
r = await api(VOVA, 'teamSave', { id: impTeam.unitId, name: 'Імпорт Тест', areaId: 'a1', dir: 'WyldLife' });
r = await api(VOVA, 'dirStats', { units: ['a:a1'], period: 'custom', from: '2025-10-01', to: '2025-10-31' });
const wy = r.ok && r.data.rows.find((x) => x.dir === 'WyldLife');
ok(wy && wy.clubs === 1 && wy.teens === 12 && wy.teams === 1 && r.data.rows.length >= 5, 'напрямки: статистика за напрямком ' + JSON.stringify(wy));
r = await api(LEAD, 'dirStats', {});
ok(r.ok, 'напрямки: доступно в межах своєї команди');


// ── корисні ресурси ──
r = await api(LEAD, 'resList', {});
ok(r.ok && r.data.list.some((x) => /Будні лідера/.test(x.title)) && !r.data.canAdd, 'ресурси: подкаст видно всім; лідер не додає');
r = await api(LEAD, 'resSave', { title: 'X', url: 'x.com' });
ok(!r.ok, 'ресурси: лідер не може додати');
sent.length = 0;
r = await api(RD, 'resSave', { title: 'Посібник для лідерів', url: 'drive.google.com/x', aud: 'all' });
ok(r.ok && r.data.pending && sent.some((m) => m.chat_id === '1' && /чекає підтвердження/.test(m.text)), 'ресурси: «для всіх» від РД чекає Раба Божого');
const resAll = r.data.id;
ok(!(await api(LEAD, 'resList', {})).data.list.some((x) => x.id === resAll), 'ресурси: непідтверджене не видно іншим');
r = await api(RD, 'resDecide', { id: resAll, approve: true });
ok(!r.ok, 'ресурси: РД не підтверджує «для всіх»');
r = await api(VOVA, 'resDecide', { id: resAll, approve: true });
ok(r.ok && !r.data.pending && (await api(LEAD, 'resList', {})).data.list.some((x) => x.id === resAll), 'ресурси: Раб Божий підтвердив — бачать усі');
r = await api(RD, 'resSave', { title: 'Для West', url: 'https://w.example', aud: 'r:r0' });
ok(r.ok && !r.data.pending, 'ресурси: РД для свого регіону — одразу');
r = await api(LEAD, 'resList', {});
ok(r.data.list.some((x) => x.title === 'Для West'), 'ресурси: людина з West бачить ресурс регіону');
r = await api(NO, 'resSave', { title: 'Матеріали College', url: 'https://c.example', aud: 'dir:College' });
ok(r.ok && r.data.pending, 'ресурси: напрямок — чекає експерта');
r = await api(VOVA, 'resDecide', { id: r.data.id, approve: true });
r = await api(LEAD, 'resList', {});
ok(!r.data.list.some((x) => x.title === 'Матеріали College'), 'ресурси: напрямок не для цієї команди — не видно');
r = await api(LEAD, 'resDelete', { id: resAll });
ok(!r.ok, 'ресурси: видаляє лише автор або Раб Божий');


{
  const fd = new FormData(); fd.append('initData', initData(LEAD)); fd.append('file', new Blob(['hi']), 'a.txt');
  const ru = await (await W.fetch(new Request('https://yl.example.workers.dev/upload', { method: 'POST', body: fd }), env, ectx)).json();
  ok(!ru.ok && ru.error === 'forbidden', 'файли: лідер не завантажує');
  const rf = await W.fetch(new Request('https://yl.example.workers.dev/f/res0budni?k=x'), env, ectx);
  ok(rf.status === 404, 'файли: без ключа — 404');
}


// ── встановили MyYL ──
r = await api(AD, 'installStats', { units: ['a:a1'] });
ok(r.ok && r.data.total > r.data.reg && r.data.reg > 0 && r.data.rows.length >= 1 && r.data.users.some((u) => u.name === 'Кап Тан') && r.data.notYet.some((u) => u.name === 'Марія Нова'), 'встановили: ерія — X з Y, імена ' + r.data.reg + '/' + r.data.total);
r = await api(VOVA, 'installStats', {});
ok(r.ok && r.data.title === 'Регіони' && r.data.rows.some((x) => x.name === 'West'), 'встановили: Україна → регіони');


// ── людина з бота збігається з записом «без MyYL» ──
await api(CAP, 'memberAdd', { teamId: capTeam.id, names: 'Вадим Гарань', role: 'LEADER' });
const VG = { id: 270, first_name: 'Вадим' };
r = await api(VG, 'register', { name: 'Гарань Вадим', roles: ['LEADER'], teamId: capTeam.id, areaId: 'a1' });
me = await api(VG, 'me');
ok(r.ok && r.data.status === 'active' && me.data.status === 'active' && me.data.roles.filter((x) => x.key === 'LEADER').length === 1, 'обʼєднання: зареєструвався без вибору — роль зі складу активна, дубля немає');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
ok(r.data.filter((p) => /Гарань/.test(p.name)).length === 1 && r.data.find((p) => /Гарань/.test(p.name)).registered, 'обʼєднання: у складі один, з позначкою YL');

// ── імпорт з YL Pray: склад, нові команди, анкета; привʼязка за юзернеймом Telegram ──
r = await admin('pray', { list: [
  { name: 'Тарас Новенький', unit: 'team', area: ['Тернопіль'], team: capTeam.name, key: 'LEADER', bday: '2001-05-03', ig: '@taras_n', tg: '@Taras_TG', phone: '0991112233' },
  { name: 'Петро Зновуновий', unit: 'team', area: ['Львів'], team: 'Зовсім Нова', key: 'HELPER', title: 'Друг служіння' },
  { name: 'Гарань Вадим', unit: 'team', area: ['Тернопіль'], team: capTeam.name, key: 'LEADER', ig: 'instagram.com/vadym.h' },
  { name: 'Хтось Безерійний', unit: 'team', area: ['Нема'], team: 'X', key: 'LEADER' },
] });
ok(r.ok && r.people.created === 2 && r.people.found === 1 && r.roles.added === 2 && r.roles.had === 1 && r.teamsCreated.length === 1 && r.missing.indexOf('ерія Нема') >= 0, 'YL Pray: нові люди й команда, наявні — без дублів');
ok(r.fields.ig === 2 && r.fields.bday === 1 && r.fields.username === 1 && r.fields.title === 1, 'YL Pray: анкета дописана');
r = await admin('pray', { list: [{ name: 'Тарас Новенький', unit: 'team', area: ['Тернопіль'], team: capTeam.name, key: 'LEADER' }] });
ok(r.ok && r.people.found === 1 && r.roles.had === 1, 'YL Pray: повторний імпорт нічого не дублює');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
const vg = r.data.find((p) => /Гарань/.test(p.name));
ok(vg && (vg.profile || {}).ig === '@vadym.h', 'YL Pray: Instagram у картці (посилання → @юзернейм)');
// команда з іншою назвою: ті самі люди → переносимо в наявну
r = await admin('pray', { list: [
  { name: 'Вадим Гарань', unit: 'team', area: ['Тернопіль'], team: 'Glyna Інакше', key: 'LEADER' },
  { name: 'Тарас Новенький', unit: 'team', area: ['Тернопіль'], team: 'Glyna Інакше', key: 'LEADER' },
  { name: 'Зовсім Новенька', unit: 'team', area: ['Тернопіль'], team: 'Glyna Інакше', key: 'HELPER', ig: '@zn' },
] });
ok(r.teamsCreated.length === 1, 'YL Pray: створено команду з іншою назвою');
r = await admin('prayFix', { teams: ['Тернопіль · Glyna Інакше'] });
const pfx = r.teams[0];
ok(r.ok && pfx.into === capTeam.name && pfx.merged === 2 && pfx.moved === 1, 'YL Pray: команду обʼєднано з наявною, дублі прибрано');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
ok(r.data.filter((p) => /Гарань/.test(p.name)).length === 1 && r.data.filter((p) => /Новенький/.test(p.name)).length === 1 && r.data.some((p) => /Зовсім Новенька/.test(p.name)), 'YL Pray: у складі без дублів, нова людина перенесена');
// обʼєднання за назвою (латиниця ↔ кирилиця) і зашифрований звіт про дублі
await admin('pray', { list: [{ name: 'Остап Латинський', unit: 'team', area: ['Тернопіль'], team: 'Svitlo Kopiya', key: 'HELPER' }] });
await admin('import', { teams: [{ id: 'tSv', area_id: 'a1', name: 'Світло Копія', state: 'active', known: 0 }] });
r = await admin('teams', { merge: [{ from: 'Тернопіль · Svitlo Kopiya', into: 'Тернопіль · Svitlo Kopiya' }], audit: true });
ok(r.ok && r.merged[0].into === 'Світло Копія' && r.merged[0].moved === 1 && typeof r.audit === 'string' && !/Остап/.test(JSON.stringify(r)), 'команди: обʼєднано за транслітом, звіт зашифровано');
// видалити зі складу: лідер не може, капітан може; запис без MyYL зникає повністю
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
const zn = r.data.find((p) => /Зовсім Новенька/.test(p.name));
ok(zn && zn.canDrop && !r.data.find((p) => p.tgId === '4').canDrop, 'склад: можна видалити інших, себе — ні');
r = await api(LEAD, 'memberRemove', { roleIds: zn.roles.map((x) => x.id) });
ok(!r.ok && r.error !== 'bad_action', 'склад: лідер не видаляє людей');
r = await api(CAP, 'memberRemove', { roleIds: zn.roles.map((x) => x.id) });
ok(r.ok && r.data.deleted === true, 'склад: капітан видалив запис без MyYL');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
ok(!r.data.some((p) => /Зовсім Новенька/.test(p.name)), 'склад: людини більше немає');
// одна людина двома записами в різних командах ерії → один запис з обома ролями; перейменування команди
await api(VOVA, 'memberAdd', { teamId: 'tSv', names: 'Суботін Данило', role: 'HELPER' });
await api(VOVA, 'memberAdd', { teamId: capTeam.id, names: 'Данило Субботін', role: 'LEADER' });
await admin('pray', { list: [{ name: 'Суботін Данило', unit: 'team', area: ['Тернопіль'], team: 'Світло Копія', key: 'HELPER', ig: '@ds' }] });
r = await admin('teams', { people: [{ area: 'Тернопіль', name: 'Данило Субботін' }], rename: [{ team: 'Тернопіль · Світло Копія', name: 'Світло Друге' }] });
ok(r.ok && r.people[0].found === 2 && r.people[0].moved === 1 && r.renamed[0].to === 'Світло Друге', 'дублі людей: обʼєднано, команду перейменовано');
r = await api(CAP, 'teamMembers', { teamId: capTeam.id });
const dsb = r.data.find((p) => /Субот|Суббот/.test(p.name));
ok(dsb && dsb.all.length === 2 && dsb.profile.ig === '@ds', 'дублі людей: обидві ролі й анкета в одному записі');
const TN = { id: 281, first_name: 'Тарас', username: 'taras_tg' };
r = await api(TN, 'register', { name: 'Тарас', roles: ['LEADER'], teamId: capTeam.id, areaId: 'a1' });
me = await api(TN, 'me');
ok(me.data.status === 'active' && me.data.roles.filter((x) => x.key === 'LEADER').length === 1 && me.data.profile.ig === '@taras_n' && me.data.profile.bday === '2001-05-03', 'YL Pray: юзернейм Telegram привʼязав людину й анкету');

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
ok(!capMsg && !rem.some((s) => /Мала група|Контактна/.test(s.text)) && rem.every((s) => /Клуб/.test(s.text)), 'тижневе нагадування: лише клуб, і лише якщо не здано');
ok(evr.length === 2, 'нагадування про подію двом учасникам');
console.log(fails ? fails + ' FAILED' : 'ALL OK (cron)');
if (fails) process.exit(1);
