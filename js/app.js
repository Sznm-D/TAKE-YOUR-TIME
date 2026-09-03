/* ============================================================
   TAKE YOUR ★ STUDY — 功能逻辑 + localStorage 持久化
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 数据模型 ---------- */
  const STORE_KEY = 'p5_study_v1';
  const defaultStore = () => ({
    schedule: [],     // {id, date:'YYYY-MM-DD', start:'09:00', end:'10:30', title, color}
    todos: [],        // {id, title, done, priority, createdAt}
    goals: [],        // {id, title, subs:[{id, text, done}]}
    confidants: [],   // {id, title, arcana, rank, desc}
    events: [],       // {id, date, title}
    sessions: [],     // {id, date, subject, seconds, ts}
    reviews: [],      // {id, date, wins, problems, tomorrow, rating}
    notes: [],        // {id, title, body, ts}
  });

  let store = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultStore(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultStore();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  /* ---------- 每个页面对应的背景图（demo.jpg 除外） ---------- */
  const PAGE_BG = {
    home: 'new-background/0fbc99155eef5e5845c85d9e584668f2.jpg',
    schedule: 'new-background/286e921933cb3d56d39a1ef3c350f800.jpg',
    todo: 'new-background/5330a08739883a1bc64c2ee0568944cc.jpg',
    goals: 'new-background/576bd5d72db8d2e405cc13c847841f19.jpg',
    planning: 'new-background/5e7b8163b8f4371a2fd3f00d2cb062e5.jpg',
    calendar: 'new-background/616684a8c71855738c69eeefdf9fe476.jpg',
    timer: 'new-background/6ac7c3894e01880348ee38e42a7a3c5f.jpg',
    review: 'new-background/6b590a08cf78294d7f09991aa23ce195.jpg',
    notes: 'new-background/dcae8452b8b9d7c761a0f10da1d0800c.jpg',
  };
  // 每页背景巨型首字母（P3R 装饰字母）
  const PAGE_GLYPH = {
    home: 'H', schedule: 'S', todo: 'T', goals: 'O', planning: 'C',
    calendar: 'C', timer: 'S', review: 'R', notes: 'M',
  };
  let activeBgLayer = null;
  let requestedBgUrl = '';
  const BG_READY = new Map();

  function preloadBackground(url) {
    if (BG_READY.has(url)) return BG_READY.get(url);
    const img = new Image();
    const ready = new Promise((resolve) => {
      img.onload = () => {
        if (img.decode) img.decode().catch(() => { }).then(resolve);
        else resolve();
      };
      img.onerror = resolve;
      img.decoding = 'async';
      img.src = url;
    });
    BG_READY.set(url, ready);
    return ready;
  }

  function applyPageBg(page) {
    const url = PAGE_BG[page] || PAGE_BG.home;
    requestedBgUrl = url;
    const layer = $('#bgLayer');
    if (layer) {
      const layers = Array.from(layer.querySelectorAll('.bg-image'));
      if (layers.length) {
        preloadBackground(url).then(() => {
          if (requestedBgUrl !== url) return;
          const current = activeBgLayer || layers.find((item) => item.classList.contains('is-visible'));
          const next = layers.find((item) => item !== current) || layers[0];
          if (!current || next !== current || next.dataset.url !== url) {
            next.style.backgroundImage = 'url("' + url + '")';
            next.dataset.url = url;
            next.classList.add('is-visible');
            if (current && current !== next) current.classList.remove('is-visible');
            activeBgLayer = next;
          }
        });
      }
    }
    const glyph = $('#bgGlyph');
    if (glyph) glyph.textContent = PAGE_GLYPH[page] || 'T';
  }

  /* ---------- 工具 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayStr() { return toDateStr(new Date()); }
  function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDate(s) {
    const [y, m, d] = s.split('-');
    return y + '.' + m + '.' + d;
  }
  function fmtDur(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }
  function fmtClock(sec) {
    sec = Math.floor(sec);
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor((sec % 3600) / 60)) + ':' + pad(sec % 60);
  }
  function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function focusSeconds(dateStr) {
    const t = store.sessions.filter((s) => s.date === dateStr).reduce((a, s) => a + s.seconds, 0);
    return t;
  }
  function weekSeconds() {
    const now = new Date();
    const day = now.getDay() || 7; // Monday=1 .. Sunday=7
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
    const range = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      range.push(toDateStr(d));
    }
    return range.reduce((a, ds) => a + focusSeconds(ds), 0);
  }
  function streakDays() {
    // 从今天起向前连续有学习记录的日期数
    let streak = 0;
    const d = new Date();
    // 若今天没有记录，从昨天开始算连续
    if (focusSeconds(toDateStr(d)) === 0) d.setDate(d.getDate() - 1);
    while (focusSeconds(toDateStr(d)) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  /* ---------- 弹窗 ---------- */
  function openModal(title, bodyHtml, actions) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    const actBox = $('#modalActions');
    actBox.innerHTML = '';
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = () => { a.fn(); };
      actBox.appendChild(b);
    });
    $('#modalMask').classList.add('show');
  }
  function closeModal() { $('#modalMask').classList.remove('show'); }
  $('#modalMask').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  /* ---------- 导航 ---------- */
  const PAGES = ['home', 'schedule', 'todo', 'goals', 'planning', 'calendar', 'timer', 'review', 'notes'];
  let currentPage = 'home';

  function flashScreen() {
    const f = $('#flash');
    if (!f) return;
    f.classList.remove('flash');
    void f.offsetWidth; // 强制重排以重启动画
    f.classList.add('flash');
  }
  function switchPage(page) {
    currentPage = page;
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + page));
    applyPageBg(page);
    renderAll();
    flashScreen();
  }
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => switchPage(n.dataset.page)));

  /* ---------- HUD ---------- */
  function renderHUD() {
    const now = new Date();
    $('#hudYear').textContent = now.getFullYear();
    $('#hudMonth').textContent = pad(now.getMonth() + 1);
    $('#hudDay').textContent = pad(now.getDate());
    $('#hudDow').textContent = WEEK_EN[now.getDay()];
    $('#hudClock').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    $('#hudToday').textContent = fmtDur(focusSeconds(todayStr()));
    $('#hudWeek').textContent = fmtDur(weekSeconds());
    $('#hudStreak').textContent = streakDays();
  }
  setInterval(renderHUD, 1000);

  /* ---------- 首页 ---------- */
  function renderHome() {
    const t = todayStr();
    $('#homeBigDate').textContent = fmtDate(t) + ' ' + WEEK_EN[new Date().getDay()];
    const h = new Date().getHours();
    let greet = 'PHANTOM THIEF, TAKE YOUR TIME.';
    if (h < 6) greet = '夜深了，注意休息。';
    else if (h < 12) greet = '早上好，开启新的战斗。';
    else if (h < 18) greet = '下午好，别让目标溜走。';
    else greet = '晚上好，是时候复盘了。';
    $('#homeGreet').textContent = greet;
    $('#homeStreakDays').textContent = streakDays();

    const todaySec = focusSeconds(t);
    const goal = 4 * 3600;
    const pct = Math.min(100, Math.round(todaySec / goal * 100));
    $('#homeTodayFill').style.width = pct + '%';
    $('#homeTodayVal').textContent = fmtDur(todaySec) + ' / 目标 4h';

    $('#homeTodoDone').textContent = store.todos.filter((x) => x.done).length;
    $('#homeTodoLeft').textContent = store.todos.filter((x) => !x.done).length;
    $('#homeTodayTime').textContent = fmtDur(todaySec);
    const goalsDone = store.goals.filter((g) => g.subs.length && g.subs.every((s) => s.done)).length;
    $('#homeGoalRank').textContent = goalsDone + '/' + store.goals.length;

    // 今日 schedule
    const blks = store.schedule.filter((b) => b.date === t).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    $('#homeSchedule').innerHTML = blks.length
      ? blks.map((b) => `<li><span class="time">${b.start}</span><span class="dot">▸</span>${escapeHtml(b.title)}</li>`).join('')
      : '<div class="mini-empty">今天还没有安排。</div>';

    // 今日 todo
    const todos = store.todos.slice(0, 6);
    $('#homeTodo').innerHTML = todos.length
      ? todos.map((x) => `<li><span class="dot">${x.done ? '★' : '☆'}</span>${escapeHtml(x.title)}</li>`).join('')
      : '<div class="mini-empty">待办是空的，添加一个吧。</div>';
  }

  /* ---------- 时间轴 ---------- */
  const SCH_START = 6, SCH_END = 24;
  let schDate = todayStr();

  function renderSchedule() {
    $('#schDate').textContent = fmtDate(schDate);
    const blks = store.schedule.filter((b) => b.date === schDate);
    const tl = $('#timeline');
    let html = '';
    for (let h = SCH_START; h < SCH_END; h++) {
      html += `<div class="hour-row"><span class="hour-label">${pad(h)}:00</span>`;
      // 该小时内的事件（区间重叠判断）
      const inHour = blks.filter((b) => {
        const s = timeToMin(b.start), e = timeToMin(b.end);
        return s < (h + 1) * 60 && e > h * 60;
      });
      inHour.forEach((b) => {
        const s = Math.max(timeToMin(b.start), h * 60);
        const e = Math.min(timeToMin(b.end), (h + 1) * 60);
        const top = (s - h * 60) / 60 * 100;
        const height = (e - s) / 60 * 100;
        html += `<div class="block ${b.color || 'c1'}" style="top:${top}%;height:${height}%" data-id="${b.id}" title="点击编辑">
          ${escapeHtml(b.title)}<span class="block-time">${b.start}–${b.end}</span></div>`;
      });
      html += '</div>';
    }
    tl.innerHTML = html;
    $$('#timeline .block').forEach((el) => {
      el.addEventListener('click', () => editBlock(el.dataset.id));
    });
  }

  function editBlock(id) {
    const b = store.schedule.find((x) => x.id === id);
    if (!b) return;
    const colors = ['c1', 'c2', 'c3', 'c4', 'c5'];
    openModal('编辑时间块', `
      <label>内容</label><input class="input" id="mTitle" value="${escapeHtml(b.title)}" />
      <label>开始时间</label><input class="input" id="mStart" type="time" value="${b.start}" />
      <label>结束时间</label><input class="input" id="mEnd" type="time" value="${b.end}" />
      <label>颜色</label>
      <select class="input select" id="mColor">
        ${colors.map((c) => `<option value="${c}" ${b.color === c ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}
      </select>
    `, [
      { label: '删除', cls: '', fn: () => { store.schedule = store.schedule.filter((x) => x.id !== id); save(); closeModal(); renderAll(); } },
      {
        label: '保存', cls: 'btn-red', fn: () => {
          b.title = $('#mTitle').value || '未命名';
          b.start = $('#mStart').value; b.end = $('#mEnd').value; b.color = $('#mColor').value;
          save(); closeModal(); renderAll();
        }
      },
    ]);
  }

  function addBlock() {
    openModal('新增时间块', `
      <label>内容</label><input class="input" id="mTitle" placeholder="学习科目 / 事项…" />
      <label>开始时间</label><input class="input" id="mStart" type="time" value="09:00" />
      <label>结束时间</label><input class="input" id="mEnd" type="time" value="10:30" />
      <label>颜色</label>
      <select class="input select" id="mColor">
        <option value="c1">RED</option><option value="c2">BLUE</option><option value="c3">ORANGE</option><option value="c4">GREEN</option><option value="c5">PURPLE</option>
      </select>
    `, [
      { label: '取消', cls: '', fn: closeModal },
      {
        label: '保存', cls: 'btn-red', fn: () => {
          store.schedule.push({ id: uid(), date: schDate, start: $('#mStart').value, end: $('#mEnd').value, title: $('#mTitle').value || '未命名', color: $('#mColor').value });
          save(); closeModal(); renderAll();
        }
      },
    ]);
  }

  /* ---------- 待办 ---------- */
  let todoFilter = 'all';
  function renderTodo() {
    let list = store.todos.slice();
    if (todoFilter === 'active') list = list.filter((x) => !x.done);
    if (todoFilter === 'done') list = list.filter((x) => x.done);
    const total = store.todos.length;
    const done = store.todos.filter((x) => x.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('#todoPct').textContent = pct + '%';
    $('#todoFill').style.width = pct + '%';

    $('#todoList').innerHTML = list.length
      ? list.map((x) => `
        <li class="todo-item p${x.priority} ${x.done ? 'done' : ''}">
          <span class="todo-check ${x.done ? 'checked' : ''}" data-id="${x.id}">${x.done ? '✓' : ''}</span>
          <span class="todo-title">${escapeHtml(x.title)}</span>
          <span class="todo-meta ${x.done ? 'tag-done' : 'tag-p' + x.priority}">${x.done ? '已完成' : '优先级 ' + (['', '低', '中', '高'][x.priority] || '中')}</span>
          <span class="todo-del" data-id="${x.id}">✕</span>
        </li>`).join('')
      : '<div class="mini-empty">暂无待办。</div>';

    $$('#todoList .todo-check').forEach((el) => el.addEventListener('click', () => {
      const t = store.todos.find((x) => x.id === el.dataset.id);
      if (t) { t.done = !t.done; save(); renderAll(); }
    }));
    $$('#todoList .todo-del').forEach((el) => el.addEventListener('click', () => {
      store.todos = store.todos.filter((x) => x.id !== el.dataset.id);
      save(); renderAll();
    }));
  }

  /* ---------- 分层目标 ---------- */
  function renderGoals() {
    $('#goalList').innerHTML = store.goals.length
      ? store.goals.map((g) => {
        const total = g.subs.length;
        const done = g.subs.filter((s) => s.done).length;
        const pct = total ? Math.round(done / total * 100) : 0;
        return `<div class="goal-item">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="goal-head">
            <span class="goal-title">★ ${escapeHtml(g.title)}</span>
            <span class="goal-pct">${pct}%</span>
            <span class="goal-del" data-id="${g.id}">✕</span>
          </div>
          <div class="goal-bar"><div class="meter-fill" style="width:${pct}%"></div></div>
          <div class="goal-sub">
            ${g.subs.map((s) => `
              <div class="sub-item">
                <span class="todo-check ${s.done ? 'checked' : ''}" data-gid="${g.id}" data-sid="${s.id}">${s.done ? '✓' : ''}</span>
                <span>${escapeHtml(s.text)}</span>
                <span class="goal-del" data-gid="${g.id}" data-sid="${s.id}" style="margin-left:auto">✕</span>
              </div>`).join('')}
          </div>
          <div class="sub-input-row">
            <input class="input sub-new" data-gid="${g.id}" placeholder="添加子任务…" />
            <button class="btn btn-red sub-add" data-gid="${g.id}">＋</button>
          </div>
        </div>`;
      }).join('')
      : '<div class="mini-empty">还没有目标。设置一个一级目标，再拆分成子任务。</div>';

    $$('#goalList .goal-del[data-sid]').forEach((el) => el.addEventListener('click', () => {
      const g = store.goals.find((x) => x.id === el.dataset.gid);
      if (g) { g.subs = g.subs.filter((s) => s.id !== el.dataset.sid); save(); renderAll(); }
    }));
    $$('#goalList .goal-del:not([data-sid])').forEach((el) => el.addEventListener('click', () => {
      store.goals = store.goals.filter((x) => x.id !== el.dataset.id);
      save(); renderAll();
    }));
    $$('#goalList .todo-check').forEach((el) => el.addEventListener('click', () => {
      const g = store.goals.find((x) => x.id === el.dataset.gid);
      const s = g && g.subs.find((y) => y.id === el.dataset.sid);
      if (s) { s.done = !s.done; save(); renderAll(); }
    }));
    $$('#goalList .sub-add').forEach((el) => el.addEventListener('click', () => {
      const g = store.goals.find((x) => x.id === el.dataset.gid);
      const input = el.parentElement.querySelector('.sub-new');
      if (g && input.value.trim()) {
        g.subs.push({ id: uid(), text: input.value.trim(), done: false });
        save(); renderAll();
      }
    }));
  }

  /* ---------- 长期规划 (Confidants) ---------- */
  function renderConfidants() {
    $('#confList').innerHTML = store.confidants.length
      ? store.confidants.map((c) => {
        const stars = Array.from({ length: 10 }, (_, i) => i < c.rank ? '★' : '☆');
        return `<div class="conf-item">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="conf-arcana"><span class="arcana-sym">♜</span><span class="arcana-name">${escapeHtml(c.arcana)}</span></div>
          <div class="conf-body">
            <div class="conf-title">${escapeHtml(c.title)}</div>
            <div class="conf-rank-label">RANK ${c.rank} / 10</div>
            <div class="conf-stars">${stars.map((s) => `<span class="${s === '★' ? 'on' : 'off'}">${s}</span>`).join('')}</div>
          </div>
          <div class="conf-actions">
            <button class="btn" data-id="${c.id}" data-op="up">RANK ▲</button>
            <button class="btn" data-id="${c.id}" data-op="down">RANK ▼</button>
            <button class="btn" data-id="${c.id}" data-op="del">✕</button>
          </div>
        </div>`;
      }).join('')
      : '<div class="mini-empty">还没有长期规划。像 P5 的羁绊一样，缔结一个 Arcana 目标吧。</div>';

    $$('#confList .btn').forEach((el) => el.addEventListener('click', () => {
      const c = store.confidants.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const op = el.dataset.op;
      if (op === 'up') c.rank = Math.min(10, c.rank + 1);
      else if (op === 'down') c.rank = Math.max(1, c.rank - 1);
      else store.confidants = store.confidants.filter((x) => x.id !== c.id);
      save(); renderAll();
    }));
  }

  /* ---------- 日历 ---------- */
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let calSelected = null;

  function renderCalendar() {
    $('#calTitle').textContent = calYear + '.' + pad(calMonth + 1);
    const first = new Date(calYear, calMonth, 1);
    const startDow = (first.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const studyDays = new Set(store.sessions.map((s) => s.date));

    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = calYear + '-' + pad(calMonth + 1) + '-' + pad(d);
      const evs = store.events.filter((e) => e.date === ds);
      const cls = ['cal-day'];
      if (ds === todayStr()) cls.push('today');
      if (studyDays.has(ds)) cls.push('study');
      cells += `<div class="${cls.join(' ')}" data-date="${ds}">
        <span class="d-num">${d}</span>
        <div class="d-events">${evs.slice(0, 2).map((e) => `<div class="d-ev">${escapeHtml(e.title)}</div>`).join('')}</div>
      </div>`;
    }
    $('#calGrid').innerHTML = cells;
    $$('#calGrid .cal-day:not(.empty)').forEach((el) => el.addEventListener('click', () => {
      calSelected = el.dataset.date;
      renderCalDetail();
    }));
    if (calSelected && calSelected.startsWith(calYear + '-' + pad(calMonth + 1))) {
      $$('#calGrid .cal-day').forEach((el) => { if (el.dataset.date === calSelected) el.style.outline = '2px solid #fff'; });
    }
    renderCalDetail();
  }

  function renderCalDetail() {
    const ds = calSelected || todayStr();
    const evs = store.events.filter((e) => e.date === ds);
    const sec = focusSeconds(ds);
    $('#calDetail').innerHTML = `
      <h3>${fmtDate(ds)} ${WEEK_EN[parseDate(ds).getDay()]} ${sec ? '— 学习 ' + fmtDur(sec) : ''}</h3>
      ${evs.length ? evs.map((e) => `<div class="event-row"><span>★</span><span>${escapeHtml(e.title)}</span><span class="del" data-id="${e.id}">✕</span></div>`).join('') : '<div class="mini-empty">这一天没有事件。</div>'}
      <div class="todo-input-row" style="margin-top:12px">
        <input class="input" id="calEvInput" placeholder="添加事件…" />
        <button class="btn btn-red" id="calEvAdd">追加</button>
      </div>`;
    const input = $('#calEvInput');
    const addBtn = $('#calEvAdd');
    if (addBtn) addBtn.addEventListener('click', () => {
      if (input && input.value.trim()) {
        store.events.push({ id: uid(), date: ds, title: input.value.trim() });
        save(); renderCalendar();
      }
    });
    $$('#calDetail .del').forEach((el) => el.addEventListener('click', () => {
      store.events = store.events.filter((e) => e.id !== el.dataset.id);
      save(); renderCalendar();
    }));
  }

  /* ---------- 计时 ---------- */
  let timerSec = 0;
  let timerRunning = false;
  let timerInterval = null;
  let timerSubject = '';

  function renderTimer() {
    $('#timerDisplay').textContent = fmtClock(timerSec);
    $('#timerMode').textContent = timerRunning ? 'FOCUS MODE' : 'IDLE';
    $('#timerStart').textContent = timerRunning ? '计时中' : '开始';
  }

  function startTimer() {
    if (timerRunning) return;
    timerSubject = $('#timerSubject').value.trim() || '未命名科目';
    timerRunning = true;
    $('#timerFinish').classList.remove('show');
    timerInterval = setInterval(() => { timerSec++; renderTimer(); }, 1000);
    renderTimer();
  }
  function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    renderTimer();
  }
  function resetTimer() {
    if (timerSec > 0) {
      store.sessions.push({ id: uid(), date: todayStr(), subject: timerSubject || '未命名科目', seconds: timerSec, ts: Date.now() });
      save();
      $('#timerFinish').textContent = 'FINISH! +' + fmtDur(timerSec);
      $('#timerFinish').classList.add('show');
      setTimeout(() => $('#timerFinish').classList.remove('show'), 2500);
    }
    timerRunning = false;
    clearInterval(timerInterval);
    timerSec = 0;
    timerSubject = '';
    $('#timerSubject').value = '';
    renderTimer(); renderRecords();
  }

  function renderRecords() {
    const list = store.sessions.slice().sort((a, b) => b.ts - a.ts).slice(0, 50);
    $('#recordList').innerHTML = list.length
      ? list.map((s) => `<li>
          <span class="r-sub">${escapeHtml(s.subject)}</span>
          <span class="r-date">${s.date}</span>
          <span class="r-time">${fmtDur(s.seconds)}</span>
          <span class="del" data-id="${s.id}">✕</span>
        </li>`).join('')
      : '<div class="mini-empty">还没有学习记录。</div>';
    $$('#recordList .del').forEach((el) => el.addEventListener('click', () => {
      store.sessions = store.sessions.filter((s) => s.id !== el.dataset.id);
      save(); renderRecords(); renderHUD();
    }));
  }

  /* ---------- 复盘 ---------- */
  let revDate = todayStr();
  let revRating = 3;

  function renderReview() {
    $('#revDate').textContent = fmtDate(revDate);
    const r = store.reviews.find((x) => x.date === revDate);
    $('#revWins').value = r ? r.wins : '';
    $('#revProblems').value = r ? r.problems : '';
    $('#revTomorrow').value = r ? r.tomorrow : '';
    revRating = r ? r.rating : 3;
    $$('#revRate span').forEach((s, i) => s.classList.toggle('on', i < revRating));

    const list = store.reviews.slice().sort((a, b) => b.date.localeCompare(a.date));
    $('#revList').innerHTML = list.length
      ? list.map((x) => `<li class="rev-entry">
          <div class="rev-head"><span class="rev-date">${x.date}</span><span class="rev-stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</span><span class="rev-del" data-id="${x.id}">✕</span></div>
          <div class="rev-text">${escapeHtml(x.wins)}</div>
        </li>`).join('')
      : '<div class="mini-empty">还没有复盘记录。</div>';
    $$('#revList .rev-del').forEach((el) => el.addEventListener('click', () => {
      store.reviews = store.reviews.filter((x) => x.id !== el.dataset.id);
      save(); renderReview();
    }));
  }

  /* ---------- 记事本 ---------- */
  let currentNoteId = null;
  function renderNotes() {
    const list = store.notes.slice().sort((a, b) => b.ts - a.ts);
    $('#noteList').innerHTML = list.length
      ? list.map((n) => `<div class="note-item ${n.id === currentNoteId ? 'active' : ''}" data-id="${n.id}">
          <div class="n-title">${escapeHtml(n.title || '无标题')}</div>
          <div class="n-date">${fmtDate(n.ts ? toDateStr(new Date(n.ts)) : todayStr())}</div>
        </div>`).join('')
      : '<div class="mini-empty">还没有笔记。</div>';
    $$('#noteList .note-item').forEach((el) => el.addEventListener('click', () => {
      currentNoteId = el.dataset.id;
      const n = store.notes.find((x) => x.id === currentNoteId);
      $('#noteEditorTitle').value = n ? n.title : '';
      $('#noteEditorBody').value = n ? n.body : '';
      renderNotes();
    }));
    const cur = store.notes.find((x) => x.id === currentNoteId);
    if (cur) { $('#noteEditorTitle').value = cur.title; $('#noteEditorBody').value = cur.body; }
    if (!currentNoteId) { $('#noteEditorTitle').value = ''; $('#noteEditorBody').value = ''; }
  }

  /* ---------- AI 助手（结城理 · 学习任务辅助） ---------- */
  const ASSISTANT_QUOTES = [
    'Memento Mori——时光易逝，正因如此才要珍惜此刻。',
    '专注不是天赋，而是可以练习的能力。',
    '把大目标拆成小步，今天只走好一步。',
    '休息也是计划的一部分，别透支自己。',
    '你已经比昨天更靠近目标了。',
    '拖延时，先只专注 5 分钟，往往就停不下来了。',
  ];

  function assistantCtx() {
    const now = new Date();
    return {
      h: now.getHours(),
      todaySec: focusSeconds(todayStr()),
      weekSec: weekSeconds(),
      streak: streakDays(),
      pending: store.todos.filter((t) => !t.done),
      pendingHigh: store.todos.filter((t) => !t.done && t.priority === 3),
      goals: store.goals,
      goalDone: store.goals.filter((g) => g.subs.length && g.subs.every((s) => s.done)).length,
    };
  }

  function buildStudyContext() {
    const now = new Date();
    const today = todayStr();
    const c = assistantCtx();
    const goalSec = 4 * 3600;
    const left = goalSec - c.todaySec;
    const lines = [];
    lines.push('今天是 ' + fmtDate(today) + ' ' + WEEK_EN[now.getDay()] + '，现在 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '。');
    lines.push('今日已专注 ' + fmtDur(c.todaySec) + '；本周 ' + fmtDur(c.weekSec) + '；连续 ' + c.streak + ' 天。');
    lines.push('今日学习目标 4 小时，' + (left > 0 ? '还差 ' + fmtDur(left) : '已达成') + '。');

    if (c.pending.length) {
      lines.push('未完成待办（' + c.pending.length + ' 个）：' + c.pending.map((t) => t.title + (t.priority === 3 ? '（高优先）' : '')).join('、') + '。');
    } else {
      lines.push('待办清单已全部完成。');
    }

    if (c.goals.length) {
      lines.push('分层目标：' + c.goals.map((g) => g.title + ' ' + g.subs.filter((s) => s.done).length + '/' + g.subs.length).join('；') + '。');
    } else {
      lines.push('还没有设定分层目标。');
    }

    const blks = store.schedule.filter((b) => b.date === today).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    lines.push(blks.length
      ? '今日日程：' + blks.map((b) => b.start + '-' + b.end + ' ' + b.title).join('；') + '。'
      : '今日还没有安排日程。');

    const rev = store.reviews.find((r) => r.date === today);
    lines.push(rev ? '今日复盘：已完成' : '今日复盘：尚未写。');

    if (timerRunning) {
      lines.push('计时器正在运行：' + (timerSubject || '未命名科目') + '，已计时 ' + fmtClock(timerSec) + '。');
    }

    return lines.join('\n');
  }

  function assistantMsg() {
    const c = assistantCtx();
    const goalSec = 4 * 3600;
    const msgs = [];
    if (c.h < 6) msgs.push('夜深了，身体是革命的本钱，早点休息。');
    else if (c.h < 12) msgs.push('早上好，导航者。先定下今天最重要的一件事。');
    else if (c.h < 18) msgs.push('下午好，别让精力中途消散，检查一下待办。');
    else msgs.push('晚上好，是时候去 REFLECTION 复盘今天了。');

    if (c.todaySec === 0) msgs.push('今天还没开始学习。点 STUDY TIME，开始第一次计时吧。');
    else {
      const left = goalSec - c.todaySec;
      msgs.push(left > 0
        ? '今日已专注 ' + fmtDur(c.todaySec) + '，距 4 小时目标还差 ' + fmtDur(left) + '。'
        : '今日已专注 ' + fmtDur(c.todaySec) + '，达成目标，干得漂亮！');
    }
    if (c.streak >= 3) msgs.push('已连续专注 ' + c.streak + ' 天，保持这股势头。');
    if (c.pendingHigh.length) msgs.push('你有 ' + c.pendingHigh.length + ' 个高优先待办，先攻克它们。');
    else if (c.pending.length) msgs.push('还有 ' + c.pending.length + ' 个待办在等你。');
    else msgs.push('待办清单已清空，太棒了！');
    if (c.goals.length) msgs.push('目标进度：' + c.goalDone + '/' + c.goals.length + ' 已完成。');

    const tips = {
      schedule: '在时间轴上双击空白处，可添加今天的学习时间段。',
      todo: '添加待办时选好优先级，先做最高优先级的。',
      goals: '把大目标拆成子任务，进度会自动计算。',
      planning: '用 RANK ▲ 提升长期目标的羁绊等级。',
      calendar: '学习过的日子会标上月亮 ☾。',
      timer: '点「开始」即可计时，停止时会自动记录。',
      review: '记录今天的收获、不足与明日计划。',
      notes: '随手记下灵感，点左侧可切换笔记。',
    };
    if (tips[currentPage]) msgs.push(tips[currentPage]);
    if (Math.random() < 0.35) msgs.push(ASSISTANT_QUOTES[Math.floor(Math.random() * ASSISTANT_QUOTES.length)]);

    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  let bubbleHideTimer = null;
  function showAssistantMessage(text) {
    $('#assistantText').textContent = text;
    $('#assistantBubble').classList.add('show');
    clearTimeout(bubbleHideTimer);
    bubbleHideTimer = setTimeout(() => $('#assistantBubble').classList.remove('show'), 7000);
  }

  /* AI 学习建议（结城理） */
  const API_CHAT = '/api/chat';

  function addAdvice(text) {
    const log = $('#assistantAdviceLog');
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function fetchAdvice() {
    const log = $('#assistantAdviceLog');
    const typing = document.createElement('div');
    typing.className = 'msg ai typing';
    typing.textContent = '正在整理建议…';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch(API_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '（请根据我当前的学习数据，给我一条具体、可执行的学习任务建议或提醒。）' }],
        context: buildStudyContext(),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        typing.remove();
        if (data && data.reply) addAdvice(data.reply);
        else addAdvice('（后端未返回内容：' + ((data && data.error) || '未知错误') + '）');
      })
      .catch(() => {
        typing.remove();
        addAdvice(assistantMsg());
      });
  }

  function toggleAdvice() {
    const advice = $('#assistantAdvice');
    const opening = !advice.classList.contains('show');
    advice.classList.toggle('show');
    if (opening) fetchAdvice();
  }

  /* ---------- 总渲染 ---------- */
  function renderAll() {
    renderHUD();
    switch (currentPage) {
      case 'home': renderHome(); break;
      case 'schedule': renderSchedule(); break;
      case 'todo': renderTodo(); break;
      case 'goals': renderGoals(); break;
      case 'planning': renderConfidants(); break;
      case 'calendar': renderCalendar(); break;
      case 'timer': renderTimer(); renderRecords(); break;
      case 'review': renderReview(); break;
      case 'notes': renderNotes(); break;
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 时间轴
    $('#schPrev').onclick = () => { schDate = toDateStr(new Date(parseDate(schDate).getTime() - 86400000)); renderAll(); };
    $('#schNext').onclick = () => { schDate = toDateStr(new Date(parseDate(schDate).getTime() + 86400000)); renderAll(); };
    $('#schToday').onclick = () => { schDate = todayStr(); renderAll(); };
    $('#schAdd').onclick = addBlock;
    $('#timeline').addEventListener('dblclick', addBlock);

    // 待办
    $('#todoAdd').onclick = () => {
      const v = $('#todoInput').value.trim();
      if (!v) return;
      store.todos.push({ id: uid(), title: v, done: false, priority: Number($('#todoPriority').value), createdAt: Date.now() });
      $('#todoInput').value = '';
      save(); renderAll();
    };
    $('#todoInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#todoAdd').click(); });
    $$('.chip').forEach((c) => c.addEventListener('click', () => {
      $$('.chip').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
      todoFilter = c.dataset.filter;
      renderTodo();
    }));

    // 目标
    $('#goalAdd').onclick = () => {
      const v = $('#goalInput').value.trim();
      if (!v) return;
      store.goals.push({ id: uid(), title: v, subs: [] });
      $('#goalInput').value = '';
      save(); renderAll();
    };
    $('#goalInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#goalAdd').click(); });

    // 规划
    $('#confAdd').onclick = () => {
      const v = $('#confInput').value.trim();
      if (!v) return;
      store.confidants.push({ id: uid(), title: v, arcana: $('#confArcana').value, rank: 1, desc: '' });
      $('#confInput').value = '';
      save(); renderAll();
    };
    $('#confInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#confAdd').click(); });

    // 日历
    $('#calPrev').onclick = () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderAll(); };
    $('#calNext').onclick = () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderAll(); };
    $('#calToday').onclick = () => { calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); calSelected = todayStr(); renderAll(); };

    // 计时
    $('#timerStart').onclick = startTimer;
    $('#timerPause').onclick = pauseTimer;
    $('#timerReset').onclick = resetTimer;

    // 复盘
    $('#revPrev').onclick = () => { revDate = toDateStr(new Date(parseDate(revDate).getTime() - 86400000)); renderAll(); };
    $('#revNext').onclick = () => { revDate = toDateStr(new Date(parseDate(revDate).getTime() + 86400000)); renderAll(); };
    $('#revToday').onclick = () => { revDate = todayStr(); renderAll(); };
    $$('#revRate span').forEach((s) => s.addEventListener('click', () => {
      revRating = Number(s.dataset.v);
      $$('#revRate span').forEach((x, i) => x.classList.toggle('on', i < revRating));
    }));
    $('#revSave').onclick = () => {
      let r = store.reviews.find((x) => x.date === revDate);
      const data = {
        wins: $('#revWins').value, problems: $('#revProblems').value,
        tomorrow: $('#revTomorrow').value, rating: revRating,
      };
      if (r) Object.assign(r, data);
      else store.reviews.push(Object.assign({ id: uid(), date: revDate }, data));
      save(); renderAll();
    };

    // 记事本
    $('#noteAdd').onclick = () => {
      const v = $('#noteTitle').value.trim() || '无标题';
      const n = { id: uid(), title: v, body: '', ts: Date.now() };
      store.notes.push(n);
      currentNoteId = n.id;
      $('#noteTitle').value = '';
      save(); renderNotes();
    };
    $('#noteSave').onclick = () => {
      if (!currentNoteId) return;
      const n = store.notes.find((x) => x.id === currentNoteId);
      if (n) { n.title = $('#noteEditorTitle').value || '无标题'; n.body = $('#noteEditorBody').value; n.ts = Date.now(); save(); renderNotes(); }
    };
    $('#noteDelete').onclick = () => {
      if (!currentNoteId) return;
      store.notes = store.notes.filter((x) => x.id !== currentNoteId);
      currentNoteId = null;
      save(); renderNotes();
    };

    // AI 助手（结城理 · 学习建议）
    $('#assistantFigure').onclick = toggleAdvice;
    $('#assistantAdviceBtn').onclick = toggleAdvice;
  }

  /* ---------- 启动 ---------- */
  function init() {
    bindEvents();
    // 预加载所有背景图，避免切换页面时闪烁
    Object.values(PAGE_BG).forEach(preloadBackground);
    applyPageBg('home');
    renderAll();
    // AI 助手：定时学习提醒
    setTimeout(() => showAssistantMessage(assistantMsg()), 2200);
    setInterval(() => { if (!document.hidden) showAssistantMessage(assistantMsg()); }, 30000);
    // 载入动画结束后隐藏
    setTimeout(() => $('#splash').classList.add('hide'), 1500);
    // 键盘快捷键：1-9 切换页面
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < PAGES.length) switchPage(PAGES[idx]);
    });
  }

  init();
})();
