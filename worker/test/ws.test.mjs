// Робочий простір команди: доступ, дошка, коментарі, сторінки, стратегія, учасники, імпорт, нагадування
import crypto from 'node:crypto';
import { makeD1 } from './d1mock.mjs';
const W = (await import('../src/index.js')).default;
const T = (await import('../src/index.js')).__test;
T.resetBase();
const TOKEN = '123:ABC';
const env = { DB: makeD1(new URL('../schema.sql', import.meta.url)), BOT_TOKEN: TOKEN, SYNC_KEY: 'k3y', APP_URL: 'https://vovayounglife.github.io/MyYL-mini-app/' };
const sent = [];
globalThis.fetch = async (url, opt) => {
  const m = String(url).split('/').pop();
  const b = JSON.parse(opt.body || '{}');
  sent.push({ m, ...b });
  return new Response(JSON.stringify({ ok: true, result: m === 'getMe' ? { username: 'yl_bot' } : true }));
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
const api = (user, action, data) => req('/', { initData: initData(user), action, data }).then((r) => r.json());
const admin = (p, b) => req('/admin/' + p, b || {}, { 'x-sync-key': 'k3y' }).then((r) => r.json());

const VOVA = { id: 1, first_name: 'Вова', last_name: 'Григорчук' };
const NASTIA = { id: 7, first_name: 'Настя', last_name: 'Савчак' };
const SONIA = { id: 8, first_name: 'Софія', last_name: 'Орищин' };
const OUT = { id: 9, first_name: 'Сторонній' };

await admin('import', { regions: ['West', 'Kyiv'].map((n, i) => ({ id: 'r' + i, name: n })), areas: [{ id: 'a1', region_id: 'r0', name: 'Тернопіль' }, { id: 'a2', region_id: 'r0', name: 'Львів' }] });
const setup = await admin('setup');
const sw = sent.find((s) => s.m === 'setWebhook');
const link = await admin('admin-link');
await req('/tg', { message: { chat: { id: 1, type: 'private' }, from: VOVA, text: '/start admin_' + link.link.split('admin_')[1] } }, { 'X-Telegram-Bot-Api-Secret-Token': sw.secret_token });
ok(setup.ok, 'підготовка: бот і перший вхід');
// Настя й Софія — керівниці ерій регіону West; Сторонній — з Києва
await api(NASTIA, 'register', { name: 'Настя Савчак', roles: ['AREA_DIRECTOR'], areaId: 'a1', email: 'nastia@gmail.com' });
await api(SONIA, 'register', { name: 'Софія Орищин', roles: ['AREA_DIRECTOR'], areaId: 'a2', email: 'sonia@gmail.com' });
await api(OUT, 'register', { name: 'Сторонній Гість', roles: ['REGIONAL_DIRECTOR'], regionId: 'r1', email: 'out@gmail.com' });
const reqs = await api(VOVA, 'requests');
for (const p of reqs.data) await api(VOVA, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });

// ── доступ ──
let me = await api(VOVA, 'me');
ok(me.ok && me.data.ws && me.data.ws.length === 1 && me.data.ws[0].id === 'west', 'me: простір West видно тому, хто керує MyYL');
me = await api(NASTIA, 'me');
ok(me.ok && me.data.ws.length === 0, 'me: Настя ще не в просторі');
let r = await api(NASTIA, 'ws', {});
ok(!r.ok && r.error === 'forbidden', 'чужий не бачить простір');
r = await api(VOVA, 'ws', {});
ok(r.ok && r.data.members.length === 1 && r.data.me.admin && r.data.boards.length === 1 && r.data.boards[0].cols.length === 4, 'перший вхід: дошка з 4 колонками, Вова — учасник, що керує');
ok(!JSON.stringify(r.data).includes('SUPER'), 'службова найвища роль не потрапляє в дані простору');
ok(r.data.strategy.circles.length === 9 && r.data.strategy.targets[0].n === 2000, 'стратегія: 9 напрямків і ціль 2340');
const board = r.data.boards[0], [c1, c2, , cDone] = board.cols;

// ── учасники ──
r = await api(VOVA, 'wsPeopleFind', {});
ok(r.ok && r.data.some((x) => x.id === '7') && r.data.some((x) => x.id === '8') && !r.data.some((x) => x.id === '9'), 'підказка: люди регіону West, без чужого регіону');
r = await api(VOVA, 'wsPeopleFind', { q: 'сторон' });
ok(r.ok && r.data.some((x) => x.id === '9'), 'пошук за імʼям — будь-хто з MyYL');
ok((await api(VOVA, 'ws', {})).data.open === false, 'простір спершу закритий');
sent.length = 0;
r = await api(VOVA, 'wsMemberSave', { id: '7' });
ok(r.ok && r.data.members.length === 2 && !sent.some((s) => s.chat_id === '7'), 'закритий: Настю додано без повідомлення');
r = await api(NASTIA, 'ws', {});
ok(!r.ok && /готується/.test(r.message), 'закритий: учасниця ще не бачить простору');
me = await api(NASTIA, 'me');
ok(me.data.ws.length === 0, 'закритий: у Насті його немає ні в «Ще», ні на головній');
r = await api(VOVA, 'wsCardSave', { title: 'Тиха задача', who: ['7'] });
ok(r.ok && !sent.some((s) => s.chat_id === '7'), 'закритий: доручення не надсилається');
await api(VOVA, 'wsCardDelete', { id: r.data.id });
r = await api(NASTIA, 'wsOpen', { on: true });
ok(!r.ok, 'відкрити може лише той, хто керує');
sent.length = 0;
r = await api(VOVA, 'wsOpen', { on: true });
ok(r.ok && r.data.open && sent.some((s) => s.chat_id === '7' && /робочий простір/.test(s.text)), 'відкрито: Настя отримала запрошення');
sent.length = 0;
await api(VOVA, 'wsMemberSave', { id: '8', area: 'lviv' });
ok(sent.some((s) => s.chat_id === '8' && /робочий простір/.test(s.text)), 'відкритий: новій учасниці приходить повідомлення');
r = await api(NASTIA, 'wsMemberSave', { id: '9' });
ok(!r.ok && r.error === 'forbidden', 'учасник не додає людей');
me = await api(NASTIA, 'me');
ok(me.data.ws.length === 1 && me.data.ws[0].open === 0, 'me: тепер Настя в просторі');

// ── задачі ──
sent.length = 0;
const tomorrow = T.kyivDay(new Date(Date.now() + 864e5));
r = await api(VOVA, 'wsCardSave', { title: 'Підготувати табір', col: c1.id });
ok(r.ok && r.data.col === c1.id && !r.data.done, 'нова задача в першій колонці');
const card = r.data;
r = await api(VOVA, 'wsCardSave', { id: card.id, who: ['7', '999'], due: tomorrow, desc: 'Списки й транспорт', circle: 'c05', addLink: { t: '', u: 'https://docs.google.com/document/d/abc/edit' } });
ok(r.ok && r.data.who.join() === '7' && r.data.due === tomorrow && r.data.links.length === 1 && r.data.circle === 'c05', 'виконавець (лише з учасників), дедлайн, напрямок, Google-документ');
ok(sent.some((s) => s.chat_id === '7' && /доручає тобі задачу/.test(s.text) && /startapp=wsc_/.test(JSON.stringify(s.reply_markup))), 'Насті — повідомлення з кнопкою на задачу');
r = await api(VOVA, 'wsCardSave', { id: card.id, addLink: { u: 'javascript:alert(1)' } });
ok(!r.ok, 'небезпечне посилання не приймається');
me = await api(NASTIA, 'me');
ok(me.data.ws[0].open === 1 && me.data.ws[0].soon === 1, 'me: у Насті 1 задача з близьким дедлайном');
r = await api(NASTIA, 'wsCardSave', { id: card.id, check: [{ t: 'Автобус', d: true }, { t: 'Меню', d: false }, { t: '' }] });
ok(r.ok && r.data.check.length === 2, 'чек-лист');
r = await api(NASTIA, 'wsCardSave', { id: card.id, col: c2.id });
ok(r.ok && r.data.col === c2.id, 'перенесено в «В роботі»');
sent.length = 0;
r = await api(NASTIA, 'wsComment', { card: card.id, text: 'Автобус замовила' });
ok(r.ok && r.data.comments.length === 1 && r.data.card.comments === 1, 'коментар');
ok(sent.some((s) => s.chat_id === '1' && /Автобус замовила/.test(s.text)) && !sent.some((s) => s.chat_id === '7'), 'про коментар знає автор, сама Настя — ні');
r = await api(VOVA, 'wsCard', { id: card.id });
ok(r.ok && r.data.comments[0].name === 'Настя Савчак', 'задача з коментарями');
sent.length = 0;
r = await api(NASTIA, 'wsCardSave', { id: card.id, done: true });
ok(r.ok && r.data.done && r.data.col === cDone.id, 'виконано → у колонку «Готово»');
ok(sent.some((s) => s.chat_id === '1' && /виконав\(ла\)/.test(s.text)), 'автор дізнався, що виконано');
r = await api(NASTIA, 'wsCardSave', { id: card.id, col: c1.id });
ok(r.ok && !r.data.done, 'назад із «Готово» — знову не виконано');
const second = (await api(NASTIA, 'wsCardSave', { title: 'Друга', col: c1.id })).data;
r = await api(NASTIA, 'wsCardSave', { id: second.id, shift: -1 });
let ws = await api(VOVA, 'ws', {});
const inC1 = ws.data.cards.filter((x) => x.col === c1.id).sort((a, b) => a.pos - b.pos).map((x) => x.title);
ok(inC1[0] === 'Друга', 'порядок у колонці: вище');
r = await api(VOVA, 'wsCardDelete', { id: second.id });
ok(r.ok, 'той, хто керує, видаляє чужу задачу');
r = await api(SONIA, 'wsCardDelete', { id: card.id });
ok(!r.ok && r.error === 'forbidden', 'інший учасник не видаляє чужу задачу');
r = await api(OUT, 'wsCardSave', { title: 'Хак' });
ok(!r.ok && r.error === 'forbidden', 'сторонній не створює задач');

// ── галочки: кожен виконавець відмічає своє; коли всі — задача виконана й в архіві ──
const multi = (await api(VOVA, 'wsCardSave', { title: 'Спільна задача', who: ['1', '7', '8'], circle: 'c03' })).data;
r = await api(NASTIA, 'wsTick', { id: multi.id });
ok(r.ok && r.data.doneBy.join() === '7' && !r.data.done && !r.data.archived, 'галочка Насті — лише її частина');
me = await api(NASTIA, 'me');
ok(!me.data.ws[0].next.some((x) => x.id === multi.id) && me.data.ws[0].open === 1, 'у Насті задача зникла з «на тобі»');
r = await api(SONIA, 'wsTick', { id: multi.id });
ok(r.ok && r.data.doneBy.length === 2 && !r.data.done, 'Софія теж — 2 з 3');
r = await api(SONIA, 'wsTick', { id: multi.id });
ok(r.ok && r.data.doneBy.join() === '7', 'Софія зняла свою галочку');
await api(SONIA, 'wsTick', { id: multi.id });
sent.length = 0;
r = await api(VOVA, 'wsTick', { id: multi.id });
ok(r.ok && r.data.done && r.data.archived && r.data.doneBy.length === 3, 'відмітили всі — виконано й в архіві');
ws = await api(SONIA, 'ws', {});
const inStrat = ws.data.cards.filter((x) => x.circle === 'c03' && !x.archived);
ok(!inStrat.some((x) => x.id === multi.id) && ws.data.cards.find((x) => x.id === multi.id).done, 'та сама задача виконана й у «Стратегії» (одна задача — скрізь)');
r = await api(NASTIA, 'wsTick', { id: multi.id });
ok(r.ok && !r.data.done && !r.data.archived && r.data.doneBy.length === 2, 'зняла галочку — задача знову відкрита, решта галочок лишилась');
const solo = (await api(VOVA, 'wsCardSave', { title: 'Без виконавців' })).data;
r = await api(SONIA, 'wsTick', { id: solo.id });
ok(r.ok && r.data.done && r.data.archived, 'задача без виконавців — галочка будь-кого її закриває');
r = await api(VOVA, 'wsCardSave', { id: solo.id, archived: false });
ok(r.ok && !r.data.done && !r.data.archived, 'повернути з архіву — знову в роботі');
await api(VOVA, 'wsCardDelete', { id: solo.id }); await api(VOVA, 'wsCardDelete', { id: multi.id });

// ── повторювальні задачі ──
const todayK = T.kyivDay(new Date());
let rc = (await api(VOVA, 'wsCardSave', { title: 'Звіт тижня', who: ['1', '7'], check: [{ t: 'Таблиця', d: true }] })).data;
r = await api(VOVA, 'wsCardSave', { id: rc.id, rep: 'week' });
ok(r.ok && r.data.rep === 'week' && r.data.due === todayK, 'повтор щотижня: без дедлайну — від сьогодні');
await api(VOVA, 'wsTick', { id: rc.id });
sent.length = 0;
r = await api(NASTIA, 'wsTick', { id: rc.id });
ok(r.ok && !r.data.done && !r.data.archived && r.data.repN === 1 && r.data.due === T.kyivDay(new Date(Date.now() + 7 * 864e5)) && r.data.doneBy.length === 0 && !r.data.check[0].d,
  'усі відмітили — не в архів, а наступного тижня з чистими галочками (' + r.data.due + ')');
ok(sent.some((s) => s.chat_id === '1' && /Наступного разу/.test(s.text)), 'автору — коли наступного разу');
const mon = (await api(VOVA, 'wsCardSave', { title: 'Місячний фінзвіт', rep: 'month', due: '2026-01-31' })).data;
r = await api(VOVA, 'wsTick', { id: mon.id });
ok(r.ok && r.data.repN === 1 && r.data.due > todayK && Number(r.data.due.slice(8)) >= 28, 'щомісяця: прострочена переноситься на найближчу майбутню дату (' + r.data.due + ')');
r = await api(VOVA, 'wsCardSave', { id: mon.id, rep: '' });
ok(r.ok && r.data.rep === '', 'повтор можна вимкнути');
await api(VOVA, 'wsCardDelete', { id: rc.id }); await api(VOVA, 'wsCardDelete', { id: mon.id });

// ── колонки й дошки ──
r = await api(SONIA, 'wsColSave', { board: board.id, title: 'Ідеї' });
const cols = r.data.boards[0].cols;
ok(r.ok && cols.length === 5 && cols[cols.length - 1].kind === 'done' && cols[cols.length - 2].title === 'Ідеї', 'нова колонка стає перед «Готово»');
r = await api(SONIA, 'wsColDelete', { id: c1.id });
ok(!r.ok, 'колонку з задачами видалити не можна');
r = await api(SONIA, 'wsBoardSave', { title: 'Табори' });
ok(r.ok && r.data.boards.length === 2 && r.data.newBoard, 'нова дошка');
r = await api(SONIA, 'wsBoardDelete', { id: r.data.newBoard });
ok(!r.ok && r.error === 'forbidden', 'дошку видаляє лише той, хто керує');

// ── сторінки ──
r = await api(SONIA, 'wsPageSave', { title: 'Нотатки зустрічі', icon: '📝', body: '# План\n- [ ] Табір\nhttps://docs.google.com/spreadsheets/d/x' });
ok(r.ok && r.data.page.title === 'Нотатки зустрічі', 'сторінка створена');
const pg = r.data.page;
r = await api(SONIA, 'wsPageSave', { parent: pg.id, title: 'Підсторінка', body: 'текст' });
const child = r.data.page;
ok(r.ok && child.parent === pg.id, 'підсторінка');
r = await api(VOVA, 'wsPage', { id: pg.id });
ok(r.ok && /- \[ \] Табір/.test(r.data.page.body) && r.data.children.length === 1, 'сторінка з текстом і підсторінками');
const base = r.data.page.updated;
await new Promise((res) => setTimeout(res, 5));
r = await api(SONIA, 'wsPageSave', { id: pg.id, base, title: pg.title, body: 'Софія змінила' });
ok(r.ok, 'зміна сторінки');
r = await api(VOVA, 'wsPageSave', { id: pg.id, base, title: pg.title, body: 'Вова теж' });
ok(!r.ok && r.error === 'conflict' && /Софія/.test(r.message), 'одночасна зміна — попередження, нічого не затерто');
r = await api(SONIA, 'wsPageSave', { id: pg.id, parent: child.id, title: 'x', body: '' });
ok(!r.ok, 'сторінку не можна вкласти саму в себе');
r = await api(NASTIA, 'wsPageDelete', { id: pg.id });
ok(!r.ok && r.error === 'forbidden', 'чужу сторінку видаляє лише автор або той, хто керує');
r = await api(SONIA, 'wsPageDelete', { id: pg.id });
ok(r.ok && r.data.removed === 2, 'видалено разом з підсторінками');

// ── стратегія ──
r = await api(NASTIA, 'wsItemSave', { circle: 'c02', kind: 'project', title: 'Рекрутингова кампанія', status: 'doing', owner: '7' });
ok(r.ok && r.data.item.circle === 'c02' && r.data.item.status === 'doing', 'проект у напрямку «Рекрутинг»');
const item = r.data.item;
r = await api(NASTIA, 'wsCardSave', { title: 'Пост в Instagram', item: item.id });
ok(r.ok && r.data.item === item.id && r.data.circle === 'c02', 'задача привʼязана до проекту і напрямку');
r = await api(NASTIA, 'wsStrategySave', { vision: 'x' });
ok(!r.ok && r.error === 'forbidden', 'стратегію змінює лише той, хто керує');
r = await api(VOVA, 'wsStrategySave', { targets: [{ k: 'leaders', l: 'лідерів', n: 2100 }, { k: 'teams', l: 'команд', n: 300 }, { k: 'staff', l: 'стафів', n: 40 }] });
ok(r.ok && r.data.strategy.targets[0].n === 2100 && r.data.strategy.circles.length === 9, 'ціль змінено');
r = await api(VOVA, 'wsItemDelete', { id: item.id });
ok(r.ok && !r.data.cards.some((x) => x.item === item.id), 'проект видалено, задачі відвʼязано');

// ── імпорт профілів і аналітики ──
const imp = {
  profiles: { themes: [{ id: 'woo', ua: 'Зачарування', dom: 'inf', ranks: { vova: 2, nastia: 1 }, txt: { ua: { short: 's' } } }], people: [{ id: 'vova', ua: 'Вова', top10: ['woo'] }, { id: 'nastia', ua: 'Настя', top10: ['woo'] }] },
  photos: { vova: 'data:image/jpeg;base64,AAAA', bad: 'http://x' },
  analytics: { updated: '2026-11-18', teams: [{ id: 't1', name: 'LIFT', area: 'lviv', members: 7 }, { id: 't2', name: 'Kairos', area: 'ternopil', members: 11 }] },
  oto: { files: [{ area: 'ternopil', people: [] }] },
  areas: [{ key: 'ternopil', name: 'Тернопіль', director: 'Настя Савчак', color: '#2f6b57', teamFolder: 'https://drive.google.com/drive/folders/x' }],
};
r = await api(NASTIA, 'wsImport', imp);
ok(!r.ok && r.error === 'forbidden', 'імпорт — лише той, хто керує');
r = await api(VOVA, 'wsImport', imp);
ok(r.ok && r.data.got.length === 5, 'імпорт: усі частини даних');
ok(r.data.ws.members.find((m) => m.id === '7').pkey === 'nastia' && r.data.ws.members.find((m) => m.id === '1').pkey === 'vova', 'учасники підвʼязались до своїх профілів');
r = await api(SONIA, 'wsProfiles', {});
ok(r.ok && r.data.profiles.people.length === 2 && r.data.photos.vova && !r.data.photos.bad, 'профілі й фото (лише безпечні)');
r = await api(SONIA, 'wsAnalytics', {});
ok(r.ok && r.data.analytics.source === 'myyl' && r.data.analytics.region === 'West' && r.data.oto.files.length === 1, 'аналітика з бази MyYL, one-to-one з файлу');
r = await api(OUT, 'wsProfiles', {});
ok(!r.ok, 'сторонній не бачить профілів');

// ── поточний стан 2340 — наживо з MyYL ──
r = await api(VOVA, 'ws', {});
ok(r.data.current.staff === 3 && r.data.current.teams === 0 && r.data.current.leaders === 0 && r.data.current.region === 'West', '2340: стафи — учасники простору (Вова, Настя, Софія)');
const tid = (await api(VOVA, 'teamSave', { areaId: 'a1', name: 'Kairos' })).data.id;
await api(VOVA, 'teamSave', { areaId: 'a1', name: 'Crossroad' });
const LEADX = { id: 20, first_name: 'Лідер', last_name: 'Перший' };
await api(LEADX, 'register', { name: 'Лідер Перший', roles: ['LEADER', 'HELPER'], teamId: tid, areaId: 'a1' });
await api(NASTIA, 'requestRoles', { roles: ['CAPTAIN'], teamId: tid, areaId: 'a1' });
for (const p of (await api(VOVA, 'requests')).data) await api(VOVA, 'decide', { roleIds: p.roles.map((x) => x.id), approve: true });
r = await api(VOVA, 'memberAdd', { teamId: tid, role: 'VOLUNTEER', names: ['Петро Безтелеграму'] });
ok(r.ok, 'у склад додано людину без MyYL');
r = await api(VOVA, 'ws', {});
ok(r.data.current.teams === 2 && r.data.current.leaders === 2 && r.data.current.staff === 3, '2340: 2 команди, 2 лідери (Настя не задвоюється), 3 стафи (' + JSON.stringify(r.data.current) + ')');

// ── статистика команд — з бази MyYL ──
r = await api(NASTIA, 'saveReport', { type: 'club', teamId: tid, mode: 'event', date: T.kyivDay(new Date()), teens: 14, newT: 2, leaders: 5 });
ok(r.ok, 'капітан вносить клуб');
await api(LEADX, 'saveReport', { type: 'mg', teamId: tid, mode: 'week', teens: 6, topic: 'Віра' });
await api(LEADX, 'knownSave', { teamId: tid, item: { name: 'Оля Підліток' } });
let ad0 = await admin('ws-drive', { map: { t: { [tid]: { id: 'SHEET_kairos_123456', name: 'Kairos' } }, a: { a1: { id: 'FOLDER_ternopil_1234', name: 'Тернопіль' } }, r: {} } });
ok(ad0.ok && ad0.teams === 1, 'диск: карта таблиць команд');
r = await api(VOVA, 'wsAnalytics', {});
const K = r.data.analytics.teams.find((x) => x.id === tid), TA = r.data.analytics.areas.find((x) => x.id === 'a1');
ok(K && K.members === 3 && K.roles['Капітан'] === 1 && K.roles['Лідер'] === 1 && K.roles['Помічник'] === 1 && K.roles['Волонтер'] === 1, 'команда: склад з ролями, кожна людина один раз (' + JSON.stringify(K && K.roles) + ')');
ok(K.clubs.n === 1 && K.clubs.avgTeens === 14 && K.clubs.avgServ === 5 && K.sg.n === 1 && K.known === 1 && K.monthly.length === 12 && K.monthly[11].n === 1, 'команда: клуби, малі групи, знані, по місяцях');
ok(/spreadsheets\/d\/SHEET_kairos_123456/.test(K.sheet) && TA.key === 'ternopil' && /FOLDER_ternopil_1234/.test(TA.folder) && K.area === 'ternopil', 'команда: таблиця MyYL на Диску, ерія звʼязана з налаштуваннями');

// ── учасники: прибрати ──
r = await api(VOVA, 'wsMemberRemove', { id: '1' });
ok(!r.ok, 'себе прибрати не можна');
r = await api(VOVA, 'wsMemberRemove', { id: '8' });
ok(r.ok && r.data.members.length === 2, 'Софію прибрано');
r = await api(SONIA, 'ws', {});
ok(!r.ok, 'після цього Софія не бачить простору');

// ── one-to-one з Google Диску (скрипт «⚙️ Система») ──
let ad = await req('/admin/ws-config', { ws: 'west' }, { 'x-sync-key': 'wrong' });
ok(ad.status === 403, 'диск: без ключа — 403');
ad = await admin('ws-config', { ws: 'west' });
ok(ad.ok && ad.areas.some((a) => a.key === 'ternopil' && /folders/.test(a.teamFolder)), 'диск: налаштування з папками ерій');
const otoFiles = [{ id: 'f1', title: 'Тернопіль - Капітани - One to one', area: 'ternopil', group: 'Капітани', people: [{ name: 'Капітан Іван', role: 'Капітан', meetings: [{ held: true, date: '2026-11-20', total: 8.25, spheres: { 'Духовне життя': 9, bad: 'x' } }, { held: false }] }] }];
ad = await admin('ws-oto', { ws: 'west', files: otoFiles });
ok(ad.ok && ad.changed === true && ad.files === 1, 'диск: one-to-one оновлено');
ad = await admin('ws-oto', { ws: 'west', files: otoFiles });
ok(ad.ok && ad.changed === false, 'диск: без змін — нічого не переписується');
r = await api(VOVA, 'wsAnalytics', {});
const of = r.data.oto;
ok(of.source === 'drive' && of.files[0].people[0].meetings[0].total === 8.3 && !('bad' in of.files[0].people[0].meetings[0].spheres), 'диск: дані в просторі, бали числами');
r = await api(VOVA, 'ws', {});
ok(r.data.log.some((e) => /one-to-one/.test(e.text)), 'диск: запис у «Що нового»');

// ── фото профілю ──
const png = 'data:image/png;base64,' + Buffer.from('fakepngbytes').toString('base64');
r = await api(NASTIA, 'photoSet', { data: 'data:text/html;base64,PHNjcmlwdD4=' });
ok(!r.ok, 'фото: не картинку не приймає');
r = await api(NASTIA, 'photoSet', { data: png });
ok(r.ok && r.data.photo, 'фото: завантажено');
const pk = r.data.photo;
me = await api(VOVA, 'me');
ok(me.data.photos && me.data.photos['7'] === pk, 'фото: інші бачать ключ фото Насті');
let ph = await W.fetch(new Request('https://x/p/7?k=' + pk), env, ectx);
ok(ph.status === 200 && ph.headers.get('content-type') === 'image/png' && (await ph.text()) === 'fakepngbytes', 'фото: віддається за ключем');
ph = await W.fetch(new Request('https://x/p/7?k=wrong'), env, ectx);
ok(ph.status === 404, 'фото: без правильного ключа — 404');
r = await api(NASTIA, 'photoSet', { remove: true });
me = await api(VOVA, 'me');
ok(r.ok && !me.data.photos['7'], 'фото: прибрано');

// ── фото з Telegram за замовчуванням ──
const SONIA_TG = Object.assign({}, SONIA, { photo_url: 'https://t.me/i/userpic/320/sonia.jpg' });
await api(SONIA_TG, 'me');
me = await api(VOVA, 'me');
const sk = me.data.photos['8'];
ok(sk && sk[0] === 't', 'фото з Telegram запамʼятовано при вході і показується за замовчуванням');
ph = await W.fetch(new Request('https://x/p/8?k=' + sk), env, ectx);
ok(ph.status === 302 && ph.headers.get('location') === 'https://t.me/i/userpic/320/sonia.jpg', 'фото з Telegram — переадресація на Telegram');
r = await api(SONIA, 'photoPref', { tg: false });
ok(!r.ok, 'без свого фото вимкнути «з Telegram» не можна');
await api(SONIA, 'photoSet', { data: png });
me = await api(VOVA, 'me');
ok(me.data.photos['8'][0] !== 't', 'завантажила своє — показується своє');
r = await api(SONIA, 'photoPref', { tg: true });
me = await api(VOVA, 'me');
ok(r.ok && me.data.photos['8'] === sk, 'галочка «моє фото з Telegram» — знову з Telegram');
me = await api(SONIA, 'me');
ok(me.data.user.photo.own && me.data.user.photo.tg && me.data.user.photo.useTg, 'у профілі видно: є своє, є з Telegram, вибрано з Telegram');
// бот підтягує фото тих, хто не відкривав застосунок з фото
const fetchWas = globalThis.fetch;
globalThis.fetch = async (url, opt) => { const m = String(url).split('/').pop(); if (m === 'getUserProfilePhotos') return new Response(JSON.stringify({ ok: true, result: { total_count: 1, photos: [[{ file_id: 'SMALL', width: 160 }, { file_id: 'BIG', width: 320 }]] } })); return fetchWas(url, opt); };
const t35 = new Date(); t35.setUTCMinutes(35, 0, 0);
await W.scheduled({ scheduledTime: t35.getTime() }, env, ectx); await Promise.all(waits.splice(0));
globalThis.fetch = fetchWas;
me = await api(VOVA, 'me');
ok(me.data.photos['7'] && me.data.photos['7'][0] === 't', 'бот підтягнув фото з Telegram для Насті');

// ── нагадування про дедлайни ──
const today = T.kyivDay(new Date());
const yest = T.kyivDay(new Date(Date.now() - 864e5));
await api(VOVA, 'wsCardSave', { title: 'Сьогодні', due: today, who: ['7'] });
await api(VOVA, 'wsCardSave', { title: 'Учора', due: yest, who: ['7'] });
const doneOne = (await api(VOVA, 'wsCardSave', { title: 'Вже готово', due: today, who: ['7'] })).data;
await api(VOVA, 'wsCardSave', { id: doneOne.id, done: true });
await api(VOVA, 'wsCardSave', { title: 'Без виконавця', due: tomorrow });
let ts; for (const off of [2, 3]) { const d = new Date(today + 'T' + String(9 - off).padStart(2, '0') + ':05:00Z'); if (new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', hour12: false }).format(d) === '09') ts = d.getTime(); }
sent.length = 0;
await W.scheduled({ scheduledTime: ts }, env, ectx); await Promise.all(waits.splice(0));
const rem = sent.filter((s) => /дедлайн/i.test(s.text || ''));
ok(rem.some((s) => s.chat_id === '7' && /Сьогодні дедлайн/.test(s.text) && /Сьогодні/.test(s.text)), 'нагадування: сьогодні');
ok(rem.some((s) => s.chat_id === '7' && /минув учора/.test(s.text)), 'нагадування: прострочено');
ok(rem.some((s) => s.chat_id === '7' && /Завтра дедлайн/.test(s.text) && /Підготувати табір/.test(s.text)), 'нагадування: завтра');
ok(rem.some((s) => s.chat_id === '1' && /Без виконавця/.test(s.text)), 'без виконавця — нагадування автору');
ok(!rem.some((s) => /Вже готово/.test(s.text)), 'виконані не нагадуються');
sent.length = 0;
await W.scheduled({ scheduledTime: ts }, env, ectx); await Promise.all(waits.splice(0));
ok(!sent.some((s) => /дедлайн/i.test(s.text || '')), 'повторно того ж дня не нагадує');

console.log(fails ? '\n' + fails + ' FAILED (ws)' : '\nALL OK (ws)');
if (fails) process.exit(1);
