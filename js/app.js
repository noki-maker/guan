/* ============ 应用逻辑 ============ */

const HEXAGRAMS = []
  .concat(window.HEX_PART1, window.HEX_PART2, window.HEX_PART3, window.HEX_PART4);
HEXAGRAMS.forEach((h, i) => (h.idx = i));

const TRIG_MAP = {};
TRIGRAMS.forEach(t => (TRIG_MAP[t.key] = t));

/* ---------- 经文注音 ---------- */
const PHRASES = PINYIN_PHRASES.slice().sort((a, b) => b.t.length - a.t.length);
function pyOn() { return localStorage.getItem("yi.pinyin") !== "off"; }
function setPyOn(v) { localStorage.setItem("yi.pinyin", v ? "on" : "off"); }
/* 把生僻字、易错多音字包成 <ruby> 注音 */
function rubyize(text) {
  if (!pyOn() || !text) return text;
  let out = "", i = 0;
  while (i < text.length) {
    let hit = null;
    for (const p of PHRASES) if (text.startsWith(p.t, i)) { hit = p; break; }
    if (hit) {
      for (let k = 0; k < hit.t.length; k++) {
        const py = hit.r[k];
        out += py ? `<ruby>${hit.t[k]}<rt>${py}</rt></ruby>` : hit.t[k];
      }
      i += hit.t.length;
      continue;
    }
    const ch = text[i], py = PINYIN_CHARS[ch];
    out += py ? `<ruby>${ch}<rt>${py}</rt></ruby>` : ch;
    i++;
  }
  return out;
}

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);

function bitsOf(h) { return TRIG_MAP[h.l].bits + TRIG_MAP[h.u].bits; } // 自下而上
function yaoTitle(bit, pos) { // pos: 0(初)..5(上)
  if (pos === 0) return bit ? "初九" : "初六";
  if (pos === 5) return bit ? "上九" : "上六";
  return (bit ? "九" : "六") + "二三四五"[pos - 1];
}
function yaoLabel(bit, pos) {
  if (pos === 0) return bit ? "初·阳" : "初·阴";
  if (pos === 5) return bit ? "上·阳" : "上·阴";
  return (bit ? "阳爻" : "阴爻") + "·" + "二三四五"[pos - 1];
}

/* 卦画：bits 自下而上，1=阳；爻数 = bits.length（2=四象、3=经卦、6=别卦） */
function yaoLinesHTML(bits, size, style) {
  let s = `<div class="gua-lines ${size}"${style ? ` style="${style}"` : ""}>`;
  for (let i = bits.length - 1; i >= 0; i--) {
    if (bits[i] === "1") s += `<div class="yline"></div>`;
    else s += `<div class="yline yin"><i></i><i></i></div>`;
  }
  return s + `</div>`;
}
const guaHTML = (bits, size) => yaoLinesHTML(bits, size);
const triHTML = (bits, size, style) => yaoLinesHTML(bits, size, style);   // 经卦三爻
function miniYao(bit) {
  return bit ? `<div class="gua-lines gua-sm" style="width:34px;font-size:12px"><div class="yline"></div></div>`
    : `<div class="gua-lines gua-sm" style="width:34px;font-size:12px"><div class="yline yin"><i></i><i></i></div></div>`;
}

/* ---------- 进度 ---------- */
const PKEY = "yi.learned";
function getLearned() { try { return new Set(JSON.parse(localStorage.getItem(PKEY) || "[]")); } catch (e) { return new Set(); } }
function setLearned(set) { localStorage.setItem(PKEY, JSON.stringify([...set])); }
function toggleLearned(i) {
  const s = getLearned();
  s.has(i) ? s.delete(i) : s.add(i);
  setLearned(s);
}
const TRIG_LEARNED = "yi.trigrams";
function getTrigLearned() { try { return new Set(JSON.parse(localStorage.getItem(TRIG_LEARNED) || "[]")); } catch (e) { return new Set(); } }
function toggleTrigLearned(k) {
  const s = getTrigLearned();
  s.has(k) ? s.delete(k) : s.add(k);
  localStorage.setItem(TRIG_LEARNED, JSON.stringify([...s]));
}

/* ---------- 底部导航 ---------- */
let gongFilter = "序";
let quizState = null;

$("#tabbar").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("active", b === btn));
  const tab = btn.dataset.tab;
  $("#view-learn").classList.toggle("hidden", tab !== "learn");
  $("#view-gua").classList.toggle("hidden", tab !== "gua");
  $("#view-quiz").classList.toggle("hidden", tab !== "quiz");
  if (tab === "gua") renderGua();
  if (tab === "quiz") renderQuizHome();
  window.scrollTo(0, 0);
});

/* ---------- 学习页 ---------- */
function renderLearn() {
  const learned = getLearned();
  const stages = [
    { n: 1, t: "阴阳 · 万物之始", d: "认识爻：阳爻与阴爻，一阴一阳之谓道", act: "showYinyang", done: false },
    { n: 2, t: "四象 · 两仪生四象", d: "太阳、少阴、少阳、太阴——两个爻的组合", act: "showSixiang", done: false },
    /* 次序用《说卦传》父母六子：乾父坤母、震长男巽长女、坎中男离中女、艮少男兑少女，
       与下方弹层网格（TRIGRAMS 数组顺序）一致；先天次序见四象页「出自」的分组 */
    { n: 3, t: "八卦 · 乾坤震巽坎离艮兑", d: "乾父坤母与六子，八个基本卦的字、象、性、用，配记忆歌诀", act: "showBagua", done: false },
    { n: 4, t: "六十四卦 · 八宫推演", d: "两卦相重为六十四卦，用八宫规则推导记忆", act: "showGong", done: false },
    /* 第 5 阶段带打卡进度：已掌握过卦才标绿，否则与前面阶段同色 */
    { n: 5, t: "背诵方法 · 卦序歌与爻", d: "卦序歌、爻位口诀与记忆路线，逐卦打卡攻破", act: "showMethod",
      done: learned.size > 0, tip: learned.size ? `已掌握 ${learned.size} 卦` : "" }
  ];
  $("#view-learn").innerHTML = `
    <div class="card">
      <div class="path-diagram">
        <span class="node">太极</span><span class="sep">→</span>
        <span class="node">两仪 阴阳</span><span class="sep">→</span>
        <span class="node">四象</span><span class="sep">→</span>
        <span class="node">八卦</span><span class="sep">→</span>
        <span class="node">六十四卦</span>
      </div>
      <p class="fine" style="text-align:center">学习路线：由浅入深，逐级叠加</p>
    </div>
    ${stages.map(s => `
      <div class="card stage" data-act="${s.act}">
        <div class="num ${s.done ? "done" : ""}"${s.tip ? ` title="${s.tip}"` : ""}>${s.n}</div>
        <div class="txt"><h2>${s.t}</h2><p class="fine">${s.d}</p></div>
        <span class="arrow">›</span>
      </div>`).join("")}
    <div class="card">
      <h2>今日进度</h2>
      <div class="progress-wrap">
        <div class="progress-bar"><i style="width:${(learned.size / 64 * 100).toFixed(1)}%"></i></div>
        <p class="progress-text">已掌握 <b>${learned.size}</b> / 64 卦 · 逢卦必过六爻，才算真正拿下</p>
      </div>
    </div>`;
  $("#view-learn").querySelectorAll(".stage").forEach(el =>
    el.addEventListener("click", () => ACTIONS[el.dataset.act]()));
}

const ACTIONS = {
  showYinyang() {
    const b = BASICS.yinyang;
    openModal(`
      <h2>阴阳 · 易之门户</h2>
      <p class="sub">背卦之前，先懂符号</p>
      <img class="taiji" src="img/taiji.svg?v=20260915g" alt="先天太极图（阴阳鱼）：黑白双鱼合抱成圆，白鱼点黑眼、黑鱼点白眼" width="120" height="120">
      <p class="fine" style="text-align:center;margin-bottom:10px">先天太极图（阴阳鱼）· 外圆为「太极」，内分黑白双鱼合抱；白鱼点黑眼、黑鱼点白眼，示阴中有阳、阳中有阴，首尾相衔而循环不已</p>
      <p>${b.intro}</p><hr class="hr">
      ${b.chars.map(c => `<h3>${c.t}</h3><p>${c.d}</p>`).join("")}
      <h3>为何阳称九、阴称六？</h3>
      <p class="fine">九为老阳之数、六为老阴之数（揲蓍成爻时，老阳三十六、老阴二十四，皆以四约之得九、六）。老主变，故爻辞以九六名爻——变，正是《易》的灵魂。</p>
    `);
  },
  showSixiang() {
    openModal(`
      <h2>四象 · 阴阳再分</h2>
      <p class="sub">两仪各加一爻，成四象；四象各加一爻，成八卦</p>
      <div class="sixiang-grid">
        ${BASICS.four.map(f => `
          <div class="sx-card">
            ${yaoLinesHTML(f.bits.join(""), "gua-sm", "width:2.4em;margin:0 auto")}
            <h4>${f.name}</h4>
            <p>${f.desc}</p><p>${f.attr}</p>
            ${f.gua ? `<p style="color:#4e7d51">出自：${f.gua}</p>` : ""}
          </div>`).join("")}
      </div>
      <hr class="hr">
      <p class="fine">画法以「初爻在下」为准：两仪各在<strong>上</strong>加一爻——阳仪（下爻为阳）上加一阴即少阴，故少阴阴在上；阴仪（下爻为阴）上加一阳即少阳，故少阳阳在上。少阴正是离、震二卦的下两爻，少阳正是巽、坎二卦的下两爻。</p>
      <p class="fine">自下而上读爻：下爻为「位」，上爻为「势」。太阳如夏至之阳极，太阴如冬至之阴极；少阳如春，少阴如秋。四象是理解八卦阴阳分布的关键。</p>
    `);
  },
  showBagua() { renderBaguaToModal(); },
  showGong() {
    openModal(`
      <h2>六十四卦 · 八宫推演</h2>
      <p class="sub">两个八卦上下相重，即得六十四卦</p>
      <p>八个基本卦（经卦）两两相叠，每一重卦由下卦（内卦）与上卦（外卦）组成，共六爻。自下而上称为：初、二、三、四、五、上。</p>
      <h3>八宫记忆法</h3>
      <p>${BASICS.gongRule}</p>
      <p class="fine">例：乾宫——乾（本宫）→ 姤（初爻变）→ 遁（再变二爻）→ 否 → 观 → 剥（五世）→ 晋（游魂，四爻复）→ 大有（归魂，下卦复原）。</p>
      <h3>下一步</h3>
      <p>打开底部「卦象」页，按宫逐卦攻克；每卦务必读全六爻注解，再点「已掌握」打卡。</p>
    `);
  },
  showMethod() {
    openModal(`
      <h2>背诵方法</h2>
      <p class="sub">先骨架，后血肉</p>
      <h3>第一步 · 卦名卦象</h3>
      <p>用「自测」页反复做「看卦画认卦名 / 看卦名认卦画」，先把六十四个名字与卦画对应牢固。</p>
      <h3>第二步 · 卦辞大象</h3>
      <p>每卦记两句：卦辞（断语）与《象》曰（君子如何效法）。先通读大意，再逐字背诵。</p>
      <h3>第三步 · 六爻</h3>
      <p>爻是重头。诀窍：先辨爻位阴阳（阳爻称九、阴爻称六），再按「初—二—三—四—五—上」的位置叙事记忆——爻辞往往描绘一个由低到高、由潜到亢的过程。</p>
      <h3>卦序歌（记忆骨架）</h3>
      <p style="white-space:pre-line;font-size:14px">${BASICS.xuciSong}</p>
      <h3>每日节奏</h3>
      <p class="fine">每天新学 2 卦 + 复习昨日 2 卦（间隔重复）；自测正确率连续 3 次满分再打卡「已掌握」。约一个多月可通背全经。</p>
    `);
  }
};

/* ---------- 八卦 ---------- */
function renderBaguaToModal() {
  const learned = getTrigLearned();
  openModal(`
    <h2>八卦 · 经卦</h2>
    <p class="sub">取象歌：${BASICS.baguaSong}</p>
    <div class="bagua-grid">
      ${TRIGRAMS.map(t => `
        <div class="bg-card ${learned.has(t.key) ? "done" : ""}" data-trig="${t.key}" role="button" tabindex="0">
          ${triHTML(t.bits, "gua-sm", "width:2.4em;margin:0 auto")}
          <div class="name">${t.key}</div>
          <div class="py">${t.py}</div>
          <div class="song">${t.song} · ${t.nature}</div>
          <div class="nature">${t.virtue}</div>
          ${learned.has(t.key) ? `<div class="done-tag">已熟</div>` : ""}
        </div>`).join("")}
    </div>
    <p class="fine" style="margin-top:10px">点按任意一卦查看详解；长按卡片可标记该卦已熟（已熟的再长按即取消）。</p>
  `);
  bindTrigCards();
}
/* 点按 = 看详解；长按 = 标记已熟。用 pointer 事件，鼠标与触屏都可用 */
function bindTrigCards() {
  document.querySelectorAll("[data-trig]").forEach(el => {
    let timer = null, longFired = false;
    const start = () => {
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        timer = null;
        toggleTrigLearned(el.dataset.trig);
        if (navigator.vibrate) navigator.vibrate(15);
        const box = document.querySelector(".modal-box");
        const st = box ? box.scrollTop : 0;   // 重绘后保持滚动位置
        renderBaguaToModal();
        const nb = document.querySelector(".modal-box");
        if (nb) nb.scrollTop = st;
      }, 550);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("click", () => {
      if (longFired) { longFired = false; return; }   // 长按后不再触发详解
      showTrigDetail(el.dataset.trig);
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showTrigDetail(el.dataset.trig); }
    });
  });
}
function showTrigDetail(key) {
  const t = TRIG_MAP[key];
  const learned = getTrigLearned();
  openModal(`
    <div style="text-align:center">${triHTML(t.bits, "gua-md", "margin:0 auto")}</div>
    <h2>${t.key} <small style="font-size:14px;color:var(--muted)">${t.py}</small></h2>
    <p class="sub">${t.song} · 八卦之一</p>
    <div class="kv">
      <span>象：${t.nature}</span><span>性：${t.virtue}</span><span>伦：${t.family}</span>
      <span>位：${t.dir}</span><span>身：${t.body}</span>
    </div>
    <p>${t.desc}</p>
    <p class="fine">三爻自下而上为：${[...t.bits].map((b, i) => `${["下", "中", "上"][i]}爻·${b === "1" ? "阳" : "阴"}`).join("、")}。三画依次象「地、人、天」三才；重卦后它或居下卦（内）、或居上卦（外），六十四卦皆由此生。</p>
    <button class="modal-close" id="trig-done">${learned.has(key) ? "取消「已熟」标记" : "标记此卦已熟"}</button>
  `);
  $("#trig-done").onclick = () => { toggleTrigLearned(key); showTrigDetail(key); };
}

/* ---------- 卦象页 ---------- */
function renderGua() {
  const learned = getLearned();
  const chips = ["序", ...GONGS.map(g => g.gong)];
  let body = "";
  if (gongFilter === "序") {
    body = `<div class="hex-grid">` + HEXAGRAMS.map(h => hexCell(h, learned)).join("") + `</div>`;
  } else {
    const g = GONGS.find(x => x.gong === gongFilter);
    const idx = name => HEXAGRAMS.find(h => h.n === name).idx;
    body = `<div class="hex-grid">` + g.list.map((n, i) => hexCell(HEXAGRAMS[idx(n)], learned,
      ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"][i])).join("") + `</div>`;
  }
  $("#view-gua").innerHTML = `
    <div class="progress-wrap">
      <div class="progress-bar"><i style="width:${(learned.size / 64 * 100).toFixed(1)}%"></i></div>
      <p class="progress-text">已掌握 ${learned.size} / 64 卦</p>
    </div>
    <div class="chips">${chips.map(c =>
      `<button class="chip ${c === gongFilter ? "active" : ""}" data-f="${c}">${c === "序" ? "卦序" : c}</button>`).join("")}</div>
    ${body}`;
  document.querySelectorAll(".chip").forEach(c =>
    c.addEventListener("click", () => { gongFilter = c.dataset.f; renderGua(); window.scrollTo(0, 0); }));
  document.querySelectorAll(".hex-cell").forEach(c =>
    c.addEventListener("click", () => openHex(+c.dataset.i)));
}
function hexCell(h, learned, extra) {
  return `<div class="hex-cell ${learned.has(h.idx) ? "learned" : ""}" data-i="${h.idx}">
    ${extra ? `<span class="num">${extra}</span>` : `<span class="num">${h.idx + 1}</span>`}
    ${learned.has(h.idx) ? `<span class="mark">✓</span>` : ""}
    ${guaHTML(bitsOf(h), "gua-sm").replace('class="gua-lines', 'style="margin:0 auto" class="gua-lines')}
    <div class="name">${h.n}</div><div class="py">${h.p}</div>
  </div>`;
}

/* ---------- 卦详情 ---------- */
let curHex = -1;
function openHex(i) {
  curHex = i;
  renderHexDetail();
  $("#hex-detail").classList.remove("hidden");
  $("#hex-detail").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeHex() {
  $("#hex-detail").classList.add("hidden");
  document.body.style.overflow = "";
  if (!$("#view-gua").classList.contains("hidden")) renderGua();
  if (!$("#view-learn").classList.contains("hidden")) renderLearn();
}
function renderHexDetail() {
  const h = HEXAGRAMS[curHex];
  const bits = bitsOf(h);
  const learned = getLearned();
  const prev = HEXAGRAMS[(curHex + 63) % 64], next = HEXAGRAMS[(curHex + 1) % 64];
  $("#hex-detail").innerHTML = `
    <div class="detail-bar">
      <button data-go="back">‹ 返回</button>
      <span style="font-size:14px;color:var(--muted)">第 ${h.idx + 1} 卦 · 共 64 卦</span>
      <button class="primary" data-go="mark">${learned.has(h.idx) ? "已掌握 ✓" : "标记掌握"}</button>
    </div>
    <div class="detail-body">
      <div class="hex-head">
        ${guaHTML(bits, "gua-lg")}
        <div class="gname" style="margin-top:10px">${h.n}</div>
        <div class="gpy">${h.p}</div>
        <div class="compose">${h.l}下${h.u}上 · ${h.xiang2} · ${h.wuxing}</div>
        <button class="py-btn" data-go="py">拼音注音 · ${pyOn() ? "已开" : "已关"}</button>
      </div>
      <div class="quote"><div class="src">卦辞</div><div class="txt">${rubyize(h.w)}</div><div class="note">${h.wz}</div></div>
      <div class="quote"><div class="src">象曰 · 大象</div><div class="txt">${rubyize(h.x)}</div><div class="note">${h.xz}</div></div>
      <h2 style="font-size:17px;margin:6px 0 10px;color:var(--accent)">六爻详注 <small class="fine" style="font-weight:400">自下而上</small></h2>
      ${h.y.map((y, i) => {
        const bit = bits[i] === "1";
        return `<div class="yao-item">
          <div class="yt">
            <span class="badge ${bit ? "yang" : ""}">${yaoTitle(bit, i)}</span>
            ${miniYao(bit)}
            <span class="fine">${yaoLabel(bit, i)}</span>
          </div>
          <div class="text" style="margin-top:8px">${rubyize(y[0])}</div>
          <div class="note">${y[1]}</div>
        </div>`;
      }).join("")}
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="big-btn" style="flex:1" data-go="prev">‹ ${prev.n}</button>
        <button class="big-btn" style="flex:1" data-go="next">${next.n} ›</button>
      </div>
    </div>`;
  $("#hex-detail").querySelectorAll("[data-go]").forEach(b =>
    b.addEventListener("click", () => {
      const g = b.dataset.go;
      if (g === "back") closeHex();
      else if (g === "mark") { toggleLearned(curHex); renderHexDetail(); }
      else if (g === "py") { setPyOn(!pyOn()); renderHexDetail(); }
      else if (g === "prev") { curHex = (curHex + 63) % 64; renderHexDetail(); $("#hex-detail").scrollTop = 0; }
      else { curHex = (curHex + 1) % 64; renderHexDetail(); $("#hex-detail").scrollTop = 0; }
    }));
}

/* ---------- 弹层 ---------- */
function openModal(html) {
  $("#modal").innerHTML = `<div class="modal-box">${html}<button class="modal-close" onclick="closeModal()">关闭</button></div>`;
  $("#modal").classList.remove("hidden");
}
function closeModal() { $("#modal").classList.add("hidden"); }

/* ---------- 自测 ---------- */
function renderQuizHome() {
  if (quizState && !quizState.finished) { renderQuizQ(); return; }
  $("#view-quiz").innerHTML = `
    <div class="card">
      <h2>自测巩固</h2>
      <p class="fine">每轮 10 题，四选一。认卦画、认卦名，双管齐下。</p>
      <div class="quiz-modes">
        <button class="qm-btn" data-m="1">看卦画<br>认卦名<small>由象及名</small></button>
        <button class="qm-btn" data-m="2">看卦名<br>认卦画<small>由名及象</small></button>
      </div>
      <p class="fine" id="quiz-best"></p>
    </div>`;
  $("#quiz-best").textContent = `最佳成绩：${localStorage.getItem("yi.best") || "—"} / 10`;
  document.querySelectorAll(".qm-btn").forEach(b =>
    b.addEventListener("click", () => startQuiz(+b.dataset.m)));
}
function startQuiz(mode) {
  const order = [...Array(64).keys()].sort(() => Math.random() - .5);
  quizState = { mode, order, pos: 0, score: 0, finished: false };
  renderQuizQ();
}
function renderQuizQ() {
  const q = quizState;
  if (q.pos >= 10) { quizResult(); return; }
  const target = HEXAGRAMS[q.order[q.pos]];
  const wrongs = [...Array(64).keys()].filter(i => i !== target.idx).sort(() => Math.random() - .5).slice(0, 3);
  const opts = [target.idx, ...wrongs].sort(() => Math.random() - .5);
  const stem = q.mode === 1 ? "这是哪一卦？" : "哪幅卦画是它？";
  $("#view-quiz").innerHTML = `
    <div class="card quiz-question">
      <p class="stem">第 ${q.pos + 1} / 10 题 · ${stem}</p>
      ${q.mode === 1
        ? guaHTML(bitsOf(target), "gua-lg").replace('class="gua-lines', 'style="margin:0 auto" class="gua-lines')
        : `<div class="gname" style="font-size:26px;font-weight:700">${target.n}</div><div class="fine">${target.p}</div>`}
      <div class="quiz-options">
        ${opts.map(i => {
          const o = HEXAGRAMS[i];
          return `<button class="opt" data-i="${i}" data-ok="${i === target.idx}">
            ${q.mode === 1 ? `${o.n}<br><span class="fine">${o.p}</span>`
              : guaHTML(bitsOf(o), "gua-sm").replace('class="gua-lines', 'style="margin:0 auto 6px" class="gua-lines')}
          </button>`;
        }).join("")}
      </div>
      <p class="quiz-score">得分 ${q.score}</p>
    </div>`;
  document.querySelectorAll(".opt").forEach(b =>
    b.addEventListener("click", function () {
      document.querySelectorAll(".opt").forEach(o => {
        o.disabled = true;
        if (o.dataset.ok === "true") o.classList.add("right");
      });
      if (this.dataset.ok !== "true") this.classList.add("wrong");
      else q.score++;
      setTimeout(() => { q.pos++; renderQuizQ(); }, 750);
    }));
}
function quizResult() {
  const q = quizState;
  q.finished = true;
  const best = +(localStorage.getItem("yi.best") || 0);
  if (q.score > best) localStorage.setItem("yi.best", q.score);
  const comment = q.score >= 9 ? "卦画已入心中，可攻爻辞！" : q.score >= 6 ? "不错，错卦回详情页再读三遍。" : "回「卦象」页按宫过一遍，再来。";
  $("#view-quiz").innerHTML = `
    <div class="card quiz-result">
      <div class="score">${q.score}<span style="font-size:20px;color:var(--muted)"> / 10</span></div>
      <p>${comment}</p>
      <button class="big-btn" onclick="quizState=null;renderQuizHome()">再来一轮</button>
    </div>`;
}

/* ---------- 启动 ---------- */
renderLearn();
