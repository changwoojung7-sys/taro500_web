/* =====================================================
   TARO 500 – app.js FINAL (Fixed)
   - Spread select (3/5/10)
   - Shuffle
   - Draw -> show backs first
   - Click to flip one by one (with reversed rotation)
   - Modal: close button / backdrop / ESC
   - After all revealed -> rich local summary
   - OpenAI mode: card comments + overall comment (after all revealed)
   ===================================================== */

let CARDS = [];
let selectedSpread = 3;
let lastDraw = null; // { spread:number, cards:[...], ai:{card_comments:[], overall_comment:{}, result?:""} }
let revealedCount = 0;
let aiLoading = false;

const SPREADS = {
  3: { name: "과거·현재·미래 (3장)", positions: ["과거", "현재", "미래"] },
  5: { name: "5장 리딩", positions: ["상황", "장애/도전", "조언", "결과", "숨은 영향"] },
  10: {
    name: "켈틱 크로스 (10장)",
    positions: [
      "현재", "장애/도움(교차)", "근본 원인", "과거", "의식/목표",
      "가까운 미래", "나(태도)", "환경/타인", "희망/두려움", "결말",
    ],
  },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function baseURL() {
  return new URL(".", window.location.href);
}
function absURL(path) {
  try {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return new URL(path, window.location.origin).toString();
    return new URL(path, baseURL()).toString();
  } catch {
    return path || "";
  }
}
function safeText(v) {
  return (v ?? "").toString();
}

function getMode() {
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : "auto";
}
function revEnabled() {
  const el = $("#revToggle");
  return el ? !!el.checked : false;
}
function useLongMeaningEnabled() {
  const el = document.querySelector("#useLongMeaning");
  return el ? !!el.checked : true;
}

/* =========================
   OpenAI Usage (Local)
========================= */
const OPENAI_LIMIT = 3;
const OPENAI_KEY = "openai_usage_v1";

function getOpenAIUsage() {
  const raw = localStorage.getItem(OPENAI_KEY);
  if (!raw) return { date: todayKey(), count: 0 };

  const parsed = JSON.parse(raw);
  if (parsed.date !== todayKey()) {
    return { date: todayKey(), count: 0 };
  }
  return parsed;
}

function setOpenAIUsage(count) {
  localStorage.setItem(
    OPENAI_KEY,
    JSON.stringify({ date: todayKey(), count })
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function increaseOpenAIUsage() {
  const key = getTodayKey();
  const next = getOpenAIUsage() + 1;
  localStorage.setItem(key, String(next));
  updateOpenAIUI();
}

function getRemainingCount() {
  return Math.max(0, OPENAI_LIMIT - getOpenAIUsage());
}

function getResetTimeText() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const hh = String(tomorrow.getHours()).padStart(2, "0");
  const mm = String(tomorrow.getMinutes()).padStart(2, "0");
  return `내일 ${hh}:${mm} 이후 초기화`;
}

function showLimitMessage(msg) {
  const summary = document.querySelector("#summary");
  if (!summary) return;

  summary.textContent =
    `🌙 ${msg}\n\n` +
    `⏰ 다음 이용 가능 시간: ${getTomorrowResetTime()}\n\n` +
    `현재는 로컬 해설로 안내드릴게요.`;

  summary.scrollIntoView({ behavior: "smooth", block: "start" });
}

function disableOpenAIOption() {
  const openaiRadio = document.querySelector('input[value="openai"]');
  if (openaiRadio) {
    openaiRadio.checked = false;
    openaiRadio.disabled = true;
  }
}

function getTomorrowResetTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toLocaleString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function updateOpenAIUsageUI(used = 0, limit = 3) {
  const el = document.getElementById("openaiUsageNote");
  if (!el) return;

  if (used < limit) {
    el.textContent = `OpenAI 사용 ${used}/${limit}`;
    el.classList.remove("warn");
  } else {
    el.textContent = "오늘 OpenAI 사용 완료";
    el.classList.add("warn");
  }
}


/* ------------------------
   Load cards.json
------------------------- */
async function loadCards() {
  if (window.location.protocol === "file:") {
    console.warn("file:// 환경에서는 fetch가 CORS로 차단됩니다. 로컬서버로 실행하세요.");
  }

  const url = new URL("data/cards.json", baseURL()).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("cards.json 로드 실패: " + res.status);

  const data = await res.json();
  if (!Array.isArray(data) || data.length < 10) {
    throw new Error("cards.json 형식이 올바르지 않거나 데이터가 부족합니다.");
  }

  CARDS = data.map((c) => ({ ...c, image: absURL(c.image) }));
  console.log("CARDS LOADED:", CARDS.length);
}

/* ------------------------
   Spread Buttons
------------------------- */
function initSpreadButtons() {
  $$(".spreadBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".spreadBtn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const v = parseInt(btn.dataset.spread, 10);
      if ([3, 5, 10].includes(v)) selectedSpread = v;

      const spreadTitle = $("#spreadTitle");
      if (spreadTitle) spreadTitle.textContent = SPREADS[selectedSpread].name;

      const grid = $("#grid");
      if (grid) grid.classList.toggle("celtic", selectedSpread === 10);
    });
  });

  const first = document.querySelector(`.spreadBtn[data-spread="${selectedSpread}"]`);
  if (first) first.classList.add("active");
  if ($("#spreadTitle")) $("#spreadTitle").textContent = SPREADS[selectedSpread].name;
}

/* ------------------------
   Shuffle
------------------------- */
function shuffleDeck() {
  if (!CARDS.length) return;
  CARDS.sort(() => Math.random() - 0.5);

  const grid = $("#grid");
  if (grid) {
    grid.classList.remove("shake");
    void grid.offsetWidth;
    grid.classList.add("shake");
  }

  const summary = $("#summary");
  if (summary) {
    summary.classList.remove("empty");
    summary.textContent = "덱을 섞었어요. 이제 ‘카드 뽑기’를 눌러주세요.";
  }
}

/* ------------------------
   Draw
------------------------- */
function drawCards() {
  if (!CARDS.length) {
    alert("카드가 아직 로드되지 않았어요. (cards.json 확인)");
    return;
  }

  revealedCount = 0;
  aiLoading = false;

  const deck = [...CARDS].sort(() => Math.random() - 0.5);
  const picked = deck.slice(0, selectedSpread);

  const useRev = revEnabled();
  const positions = SPREADS[selectedSpread].positions || [];

  const cardsWithMeta = picked.map((c, i) => {
    const is_reversed = useRev ? Math.random() < 0.35 : false;
    return {
      ...c,
      is_reversed,
      position_label: positions[i] || `${i + 1}번째`,
    };
  });

  lastDraw = {
    spread: selectedSpread,
    cards: cardsWithMeta,
    ai: null, // 나중에 {card_comments, overall_comment, result?}
  };

  renderBackCards(cardsWithMeta);

  const summary = $("#summary");
  if (summary) {
    summary.classList.remove("empty");
    summary.textContent = "카드를 눌러 한 장씩 뒤집어 보세요.";
  }

  if ($("#spreadTitle")) $("#spreadTitle").textContent = SPREADS[selectedSpread].name;
}

/* ------------------------
   Render (Back first)
------------------------- */
function renderBackCards(cards) {
  const grid = $("#grid");
  if (!grid) return;

  grid.innerHTML = "";
  const backSrc = absURL("data/card-back.png");

  cards.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "tarot tarotFlip";
    wrap.dataset.idx = String(idx);
    wrap.dataset.revealed = "0";

    const revClass = card.is_reversed ? "rev" : "";

    wrap.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <img src="${backSrc}" alt="back"/>
          <div class="tapHint">클릭해서 공개</div>
        </div>
        <div class="card-face card-front">
          <img src="${safeText(card.image)}" class="${revClass}"
               style="${card.is_reversed ? "transform: rotate(180deg);" : ""}"
               alt="${safeText(card.name_kr)}"/>
          <div class="label">
            <div class="name">${safeText(card.name_kr)}${card.is_reversed ? " (역)" : ""}</div>
            <div class="desc">${safeText(getCardShortLine(card))}</div>
          </div>
        </div>
      </div>
    `;

    wrap.addEventListener("click", async () => {
      // 이미 공개된 카드면 모달만 열기
      if (wrap.dataset.revealed === "1") {
        openModal(card, idx);
        return;
      }

      wrap.classList.add("flipped");
      wrap.dataset.revealed = "1";
      revealedCount += 1;

      openModal(card, idx);

      // 전부 공개 후 종합해설
      if (lastDraw && revealedCount === lastDraw.cards.length) {
        const summary = $("#summary");
        if (summary) {
          summary.classList.remove("empty");
          summary.textContent = buildRichSummary(lastDraw);

          // 🔽 🔽 🔽 핵심 추가 🔽 🔽 🔽
          // 결과 영역을 미리 넓혀서 AI 결과가 안 가려지게 함
          summary.style.maxHeight = "none";
          summary.style.minHeight = "480px";   // 약 10줄 이상 공간 확보
          summary.style.paddingBottom = "120px";
          summary.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // OpenAI 모드면 여기서 AI 호출 (한 번만)
        if (getMode() === "openai") {
          await runOpenAIReadingIfNeeded();
        }
      }
    });

    grid.appendChild(wrap);
  });
}

/* ------------------------
   Card Text Helpers
------------------------- */
function getMeaningObj(card) {
  const up = card.upright || {};
  const rv = card.reversed || {};
  return card.is_reversed ? rv : up;
}
function getCardShortLine(card) {
  const m = getMeaningObj(card);
  const kw = Array.isArray(m.keywords) ? m.keywords.slice(0, 3).join(", ") : "";
  const meaning = safeText(m.meaning_short_kr || m.meaning);
  if (kw && meaning) return `${kw} · ${meaning}`;
  return meaning || kw || " ";
}

/* ------------------------
   Modal
------------------------- */
function initModalEvents() {
  const modal = $("#modal");
  if (!modal) return;

  $("#modalClose")?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function getAICardComment(idx) {
  const list = lastDraw?.ai?.card_comments;
  if (!Array.isArray(list)) return null;
  return list.find((x) => Number(x.index) === Number(idx)) || null;
}

function openModal(card, idx) {
  const modal = $("#modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  if ($("#modalImg")) $("#modalImg").src = safeText(card.image);

  if ($("#modalPos")) {
    $("#modalPos").textContent = `${idx + 1}번째 카드 · ${safeText(card.position_label)} · ${
      card.is_reversed ? "역방향" : "정방향"
    }`;
  }

  if ($("#modalTitle")) {
    $("#modalTitle").textContent = `${safeText(card.name_kr)} (${safeText(card.name_en)})`;
  }

  // short + long + (AI 코멘트) 표시
  const m = getMeaningObj(card);
  const shortText = safeText(m.meaning_short_kr || m.meaning || "");
  const longText = safeText(m.meaning_long_kr || "");

  let text = "";
  if (shortText) text += `■ 한 줄 핵심\n${shortText}\n\n`;
  if (longText) text += `■ 자세한 해설\n${longText}\n`;

  // AI 카드별 코멘트 (있을 때만)
  const ai = getAICardComment(idx);
  if (ai?.message) {
    text += `\n■ 타로 리더 코멘트\n${safeText(ai.message)}\n`;
  }

  if ($("#modalText")) $("#modalText").textContent = text.trim();

  const chips = $("#modalChips");
  if (chips) {
    chips.innerHTML = "";
    if (Array.isArray(m.keywords)) {
      m.keywords.slice(0, 8).forEach((k) => {
        const span = document.createElement("span");
        span.className = "chip";
        span.textContent = safeText(k);
        chips.appendChild(span);
      });
    }
  }
}

function closeModal() {
  $("#modal")?.classList.add("hidden");
}

/* ------------------------
   Rich Local Summary
------------------------- */
function buildRichSummary(draw) {
  const spread = draw.spread;
  const name = SPREADS[spread]?.name || `${spread}장`;
  const cards = draw.cards || [];
  const useLong = useLongMeaningEnabled();

  const lines = [];
  lines.push(`**${name} 리딩 종합해설**`);
  lines.push("");
  lines.push("지금 펼쳐진 카드들은 하나의 흐름으로 연결되어 있습니다.");
  lines.push("각 카드가 말해주는 메시지를 차분히 따라가며 읽어볼게요.");
  lines.push("");

  cards.forEach((c, i) => {
    const pos = safeText(c.position_label || `${i + 1}번째 자리`);
    const dir = c.is_reversed ? "역방향" : "정방향";
    const m = getMeaningObj(c);

    const keywords = Array.isArray(m.keywords) ? m.keywords.slice(0, 4).join(", ") : "";
    const meaningText = useLong
      ? safeText(m.meaning_long_kr || m.meaning)
      : safeText(m.meaning_short_kr || m.meaning);

    lines.push(`**${i + 1}. ${pos} — ${safeText(c.name_kr)} (${dir})**`);
    if (keywords) lines.push(`키워드: ${keywords}`);
    lines.push(meaningText);
    lines.push("");
  });

  // 키워드 집계
  const allKW = [];
  const revKW = [];
  cards.forEach((c) => {
    const m = getMeaningObj(c);
    if (Array.isArray(m.keywords)) {
      m.keywords.forEach((k) => {
        allKW.push(safeText(k));
        if (c.is_reversed) revKW.push(safeText(k));
      });
    }
  });

  const topKW = topN(allKW, 6);
  const topRev = topN(revKW, 4);

  lines.push("**전체 흐름 요약**");
  if (topKW.length) lines.push(`- 핵심 키워드: ${topKW.join(" · ")}`);
  if (topRev.length) lines.push(`- 주의(역방향) 포인트: ${topRev.join(" · ")}`);
  lines.push("");

  lines.push("**추천 액션 3가지**");
  lines.push("1) 오늘 할 수 있는 ‘가장 작은 행동’ 1개를 정하고 바로 실행해보세요.");
  lines.push("2) 역방향 카드가 가리키는 부분(조급함/불안/통제 등)은 ‘속도 조절’로 완화하는 게 좋습니다.");
  lines.push("3) 7일 안에 확인 가능한 목표로 쪼개서, 결과를 기록하며 흐름을 점검해보세요.");
  lines.push("");

  lines.push("타로는 미래를 단정하지 않습니다. 지금의 흐름을 참고해, 당신에게 가장 맞는 선택을 해보세요.");

  // ✅ OpenAI 리딩 결과 출력 (최종)
if (draw.ai) {
  lines.push("");
  lines.push("**[OpenAI 리딩] 종합 코멘트**");
  lines.push("");

  // 1순위: result (지금 서버가 주는 값)
  if (draw.ai.result) {
    lines.push(safeText(draw.ai.result));
  }

  // 2순위: 구조형 응답 (추후 확장 대비)
  else if (draw.ai.overall_comment) {
    const o = draw.ai.overall_comment;
    if (o.summary) lines.push(`- 전체 흐름: ${safeText(o.summary)}`);
    if (o.advice)  lines.push(`- 조언: ${safeText(o.advice)}`);
    if (o.closing) lines.push(safeText(o.closing));
  }
}


  return lines.join("\n");
}

function topN(arr, n) {
  const freq = new Map();
  arr.forEach((x) => {
    const k = safeText(x).trim();
    if (!k) return;
    freq.set(k, (freq.get(k) || 0) + 1);
  });
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/* ------------------------
   OpenAI Reading (after all revealed)
------------------------- */
async function runOpenAIReadingIfNeeded() {
  if (!lastDraw || aiLoading || lastDraw.ai) return;

  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  if (mode !== "openai") return;

  aiLoading = true;

  const summaryEl = document.getElementById("summary");
  const loadingEl = document.getElementById("aiLoading");

  // 🔹 AI 없이 만든 “로컬 요약” (프롬프트로도 사용)
  const baseSummaryText = buildRichSummary({ ...lastDraw, ai: null });

  try {
    // 로딩 UI
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (summaryEl) {
      summaryEl.textContent = baseSummaryText + "\n\n(OpenAI 리딩 중...)";
    }

    const payload = {
      mode: "openai",
      spread: lastDraw.spread,
      summaryText: baseSummaryText,
      cards: lastDraw.cards.map((c, i) => ({
        index: i,
        name_kr: c.name_kr,
        name_en: c.name_en,
        position_label: c.position_label,
        is_reversed: !!c.is_reversed,
      })),
    };

    const res = await fetch("/api/tarot_ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    /* ===============================
       ✅ 429: 사용 제한 (정상 흐름)
    =============================== */
    if (res.status === 429 && result.code === "LIMIT_EXCEEDED") {
      if (summaryEl) {
        summaryEl.textContent =
          baseSummaryText +
          "\n\n🌙 " + (result.message || "오늘 OpenAI 타로 리딩은 3회까지만 가능합니다.") +
          "\n⏰ 내일 00:00 이후 다시 이용할 수 있어요.";
      }

      // OpenAI 옵션 비활성화 + 로컬 강제
      const openaiRadio = document.querySelector('input[value="openai"]');
      const localRadio = document.querySelector('input[value="local"]');
      if (openaiRadio) openaiRadio.disabled = true;
      if (localRadio) localRadio.checked = true;

      updateOpenAIUsageUI(result.limit, result.limit);

      return; // ❗ 에러 아님
    }

    /* ===============================
       ❌ 진짜 서버 오류
    =============================== */
    if (!res.ok || !result.ok) {
      if (summaryEl) {
        summaryEl.textContent =
          baseSummaryText +
          "\n\n(OpenAI 서버 오류로 로컬 해설이 유지됩니다.)";
      }
      return;
    }

    /* ===============================
       ✅ 성공
    =============================== */
    lastDraw.ai = result.data || null;

    updateOpenAIUsageUI(result.usage || 0, result.limit || 3);

    if (summaryEl) {
      summaryEl.textContent = buildRichSummary(lastDraw);
    }

  } catch (err) {
    // ❌ 네트워크 등 예외 상황만 여기로
    if (summaryEl) {
      summaryEl.textContent =
        baseSummaryText +
        "\n\n(OpenAI 연결 오류로 로컬 해설이 유지됩니다.)";
    }
  } finally {
    aiLoading = false;
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

/*------------------------
   Clear
------------------------- */
function clearAll() {
  const grid = $("#grid");
  if (grid) grid.innerHTML = "";

  revealedCount = 0;
  aiLoading = false;
  lastDraw = null;

  const summary = $("#summary");
  if (summary) {
    summary.textContent = "아직 카드가 없어요. ✨";
    summary.classList.add("empty");
  }
}

/* ------------------------
   Bind UI Events
------------------------- */
function bindEvents() {
  $("#shuffleBtn")?.addEventListener("click", shuffleDeck);
  $("#drawBtn")?.addEventListener("click", drawCards);
  $("#clearBtn")?.addEventListener("click", clearAll);

  initSpreadButtons();
  initModalEvents();
}

/* ------------------------
   Boot
------------------------- */
(async function boot() {
  try {
    bindEvents();
    await loadCards();

    const summary = $("#summary");
    if (summary) {
      summary.classList.remove("empty");
      summary.textContent = "준비 완료! 스프레드를 선택하고 ‘카드 뽑기’를 눌러주세요.";
    }
  } catch (e) {
    console.error(e);
    const summary = $("#summary");
    if (summary) {
      summary.classList.remove("empty");
      summary.textContent =
        "카드 데이터를 불러오지 못했습니다.\n" +
        "- file:// 로 열면 CORS 때문에 실패합니다.\n" +
        "- 로컬서버 또는 Webserver에서 실행하세요.\n\n" +
        "오류: " + (e?.message || e);
    }
  }




})();
