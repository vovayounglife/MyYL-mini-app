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
ok(r.ok && r.data.ws.current.leaders === 18 && r.data.ws.current.teams === 2 && r.data.ws.current.staff === 3, 'імпорт: поточний стан 2340 рахується');
ok(r.data.ws.members.find((m) => m.id === '7').pkey === 'nastia' && r.data.ws.members.find((m) => m.id === '1').pkey === 'vova', 'учасники підвʼязались до своїх профілів');
r = await api(SONIA, 'wsProfiles', {});
ok(r.ok && r.data.profiles.people.length === 2 && r.data.photos.vova && !r.data.photos.bad, 'профілі й фото (лише безпечні)');
r = await api(SONIA, 'wsAnalytics', {});
ok(r.ok && r.data.analytics.teams.length === 2 && r.data.oto.files.length === 1, 'аналітика й one-to-one');
r = await api(OUT, 'wsProfiles', {});
ok(!r.ok, 'сторонній не бачить профілів');

// ── учасники: прибрати ──
r = await api(VOVA, 'wsMemberRemove', { id: '1' });
ok(!r.ok, 'себе прибрати не можна');
r = await api(VOVA, 'wsMemberRemove', { id: '8' });
ok(r.ok && r.data.members.length === 2, 'Софію прибрано');
r = await api(SONIA, 'ws', {});
ok(!r.ok, 'після цього Софія не бачить простору');

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
