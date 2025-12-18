/* =========================================================
   TARO 500 - app.js (FINAL)
   - index.html 업그레이드 버전 대응
   - 카드 드로우 / 모달 / 종합해설 / 제한 / PDF / 복사
   ========================================================= */

/* ---------------------------
   CONFIG
---------------------------- */
const DAILY_LIMIT = 3;
const CARDS_JSON = "./assets/data/cards.json";
const AI_ENDPOINT = "/.netlify/functions/tarot_ai";

/* ---------------------------
   STATE
---------------------------- */
let deck = [];
let picked = [];
let spreadCount = 3;
let spreadName = "3장";
let lastSummary = "";

/* ---------------------------
   UTIL : DAILY LIMIT
---------------------------- */
function getLimitState() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem("taro_limit");
  if (!raw) return { date: today, count: 0 };
  const data = JSON.parse(raw);
  if (data.date !== today) return { date: today, count: 0 };
  return data;
}

function saveLimitState(state) {
  localStorage.setItem("taro_limit", JSON.stringify(state));
}

function canUseToday() {
  const s = getLimitState();
  return s.count < DAILY_LIMIT;
}

function increaseUse() {
  const s = getLimitState();
  s.count += 1;
  saveLimitState(s);
  updateUsageUI();
}

function updateUsageUI() {
  const s = getLimitState();
  const remain = Math.max(0, DAILY_LIMIT - s.count);
  const usageText = document.getElementById("usageText");
  const limitNote = document.getElementById("limitNote");
  if (usageText) usageText.textContent = `오늘 남은 무료 리딩: ${remain}회`;
  if (limitNote) limitNote.style.display = remain === 0 ? "block" : "none";
}

/* ---------------------------
   UTIL
---------------------------- */
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChecked(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

/* ---------------------------
   INIT
---------------------------- */
async function init() {
  const res = await fetch(CARDS_JSON);
  deck = await res.json();

  buildSpreadButtons();
  bindEvents();
  updateUsageUI();
}
document.addEventListener("DOMContentLoaded", init);

/* ---------------------------
   SPREAD BUTTONS
---------------------------- */
function buildSpreadButtons() {
  const row = document.getElementById("spreadRow");
  if (!row) return;

  const spreads = [
    { count: 3, label: "3장", desc: "과거 · 현재 · 미래" },
    { count: 5, label: "5장", desc: "상황 · 장애 · 조언" },
    { count: 10, label: "켈틱 크로스", desc: "심층 리딩" }
  ];

  row.innerHTML = "";
  spreads.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "btn chip";
    btn.textContent = s.label;
    btn.onclick = () => {
      spreadCount = s.count;
      spreadName = s.label;
      document.getElementById("spreadTitle").textContent = `${s.label} 스프레드`;
      document.getElementById("spreadDesc").textContent = s.desc;
      qsa(".spreadRow .btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
    row.appendChild(btn);
  });

  row.querySelector(".btn")?.classList.add("active");
}

/* ---------------------------
   EVENTS
---------------------------- */
function bindEvents() {
  qs("#drawBtn")?.addEventListener("click", onDraw);
  qs("#clearBtn")?.addEventListener("click", onClear);
  qs("#shuffleBtn")?.addEventListener("click", onShuffle);
  qs("#pdfBtn")?.addEventListener("click", onSavePDF);
  qs("#copyBtn")?.addEventListener("click", onCopySummary);

  qs("#modalClose")?.addEventListener("click", closeModal);
  qs("#modal")?.addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
}

/* ---------------------------
   ACTIONS
---------------------------- */
async function onDraw() {
  if (!canUseToday()) {
    updateUsageUI();
    return;
  }

  const revOn = qs("#revToggle")?.checked ?? true;
  const category = getChecked("category") || "general";
  const mode = getChecked("mode") || "auto";
  const question = qs("#question")?.value || "";

  const d = shuffle(deck);
  picked = d.slice(0, spreadCount).map((c, i) => ({
    ...c,
    pos: i + 1,
    is_reversed: revOn ? Math.random() < 0.5 : false
  }));

  renderGrid();
  renderMeta(category, revOn);

  increaseUse();

  await renderSummary({ mode, category, question });
}

function onClear() {
  picked = [];
  qs("#grid").innerHTML = "";
  qs("#summary").innerHTML = "아직 카드가 없어요. ✨";
  qs("#summary").classList.add("empty");
  qs("#metaRow").style.display = "none";
}

function onShuffle() {
  deck = shuffle(deck);
}

/* ---------------------------
   GRID / MODAL
---------------------------- */
function renderGrid() {
  const grid = qs("#grid");
  grid.innerHTML = "";

  picked.forEach(c => {
    const card = document.createElement("div");
    card.className = "cardItem";
    card.innerHTML = `
      <img src="${c.image}" class="${c.is_reversed ? "rev" : ""}" />
      <div class="cardLabel">${c.pos}. ${c.name_kr}</div>
    `;
    card.onclick = () => openModal(c);
    grid.appendChild(card);
  });
}

function openModal(c) {
  qs("#modalImg").src = c.image;
  qs("#modalPos").textContent = `Position ${c.pos}`;
  qs("#modalTitle").textContent = `${c.name_kr} (${c.is_reversed ? "역" : "정"})`;

  const chips = qs("#modalChips");
  chips.innerHTML = "";
  const keys = c.is_reversed ? c.reversed.keywords : c.upright.keywords;
  keys.forEach(k => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = k;
    chips.appendChild(span);
  });

  qs("#modalText").textContent =
    c.is_reversed ? c.reversed.meaning : c.upright.meaning;

  qs("#modal").classList.remove("hidden");
}

function closeModal() {
  qs("#modal").classList.add("hidden");
}

/* ---------------------------
   SUMMARY
---------------------------- */
async function renderSummary({ mode, category, question }) {
  const box = qs("#summary");
  box.classList.remove("empty");
  box.textContent = "해설을 생성 중입니다…";

  const usedMode = (mode === "auto") ? "자동" : (mode === "local" ? "로컬" : "OpenAI");
  qs("#modeUsed").textContent = `모드: ${usedMode}`;

  // LOCAL SUMMARY
  if (mode === "local" || mode === "auto") {
    lastSummary = localSummary(category, question);
    box.textContent = lastSummary;
    if (mode === "local") return;
  }

  // OPENAI
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: picked,
        question,
        category
      })
    });
    const data = await res.json();
    if (data?.result) {
      lastSummary = data.result;
      box.textContent = lastSummary;
      qs("#modeUsed").textContent = "모드: OpenAI";
    }
  } catch (e) {
    // fallback
    box.textContent = lastSummary + "\n\n(OpenAI 연결 실패 – 로컬 해설 표시)";
  }
}

function localSummary(category, question) {
  const majorCount = picked.filter(c => c.arcana === "Major").length;
  const revCount = picked.filter(c => c.is_reversed).length;

  return `질문: ${question || "미입력"}

이번 리딩에서는 전체 ${picked.length}장 중 메이저 카드가 ${majorCount}장 등장했습니다.
이는 상황의 중요도가 높다는 신호입니다.

역방향 카드 ${revCount}장은 현재 내부적인 갈등이나 조정이 필요함을 나타냅니다.

카테고리(${category}) 관점에서 볼 때,
지금은 성급한 결정보다는 흐름을 관찰하며 균형을 맞추는 것이 유리합니다.
`;
}

/* ---------------------------
   META / PDF / COPY
---------------------------- */
function renderMeta(category, revOn) {
  qs("#metaRow").style.display = "flex";
  qs("#metaCategory").textContent = category;
  qs("#metaSpread").textContent = spreadName;
  qs("#metaReversed").textContent = revOn ? "역방향 포함" : "정방향만";
}

function onSavePDF() {
  if (!lastSummary) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;
  doc.setFontSize(14);
  doc.text("Tarot Reading Result", 10, y);
  y += 10;

  doc.setFontSize(11);
  picked.forEach(c => {
    doc.text(
      `${c.pos}. ${c.name_kr} (${c.is_reversed ? "역" : "정"})`,
      10, y
    );
    y += 7;
  });

  y += 5;
  doc.addPage();
  doc.text(lastSummary, 10, 20, { maxWidth: 180 });

  doc.save("tarot_result.pdf");
}

function onCopySummary() {
  if (!lastSummary) return;
  navigator.clipboard.writeText(lastSummary);
  alert("종합해설이 복사되었습니다.");
}
