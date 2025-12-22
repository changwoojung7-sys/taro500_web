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
let lastDraw = null; // { spread:number, cards:[...], ai:{card_comments:[], overall_comment:{}} }
let revealedCount = 0;
let aiLoading = false;

const SPREADS = {
  3: { name: "과거·현재·미래 (3장)", positions: ["과거", "현재", "미래"] },
  5: { name: "5장 리딩", positions: ["상황", "장애/과제", "조언", "결과", "숨은 영향"] },
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
  // ✅ 디폴트로 long 사용 원하면 HTML에서 checked 주는 게 가장 확실
  return el ? !!el.checked : true;
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

      console.log("SPREAD SELECTED:", selectedSpread);
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
    ai: null, // { card_comments:[], overall_comment:{} }
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
  // 서버가 index를 0-based로 보내도록 했다는 전제
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

  // ✅ short + long + (AI 코멘트) 표시
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

// ✅ Render API에서 내려온 AI 리딩 텍스트 출력
if (draw.ai_result) {
  lines.push("");
  lines.push("**[AI 종합 리딩]**");
  lines.push("");
  lines.push(safeText(draw.ai_result));
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
  if (!lastDraw || aiLoading) return;
  if (lastDraw.ai) return; // 이미 AI 결과 있음
  aiLoading = true;

  const summaryEl = $("#summary");
  const baseSummaryText = buildRichSummary({ ...lastDraw, ai: null }); // AI 없이 요약 생성

  try {
    if (summaryEl) {
      summaryEl.classList.remove("empty");
      summaryEl.textContent = baseSummaryText + "\n\n(OpenAI 리딩 중...)";
    }

    // ✅ Netlify 전용  Functions 기본 경로
    //const endpoint = "/.functions/tarot_ai";

    // ✅ Cloudflare Pages 전용
    const endpoint = "/api/tarot_ai";

    const payload = {
      mode: "openai",
      spread: lastDraw.spread,
      useLong: useLongMeaningEnabled(),
      summaryText: baseSummaryText, // ← 네가 원한 “요약 프롬프트 그대로 넘기기”
      cards: lastDraw.cards.map((c, i) => ({
        index: i,
        id: c.id,
        name_kr: c.name_kr,
        name_en: c.name_en,
        position_label: c.position_label,
        is_reversed: !!c.is_reversed,
        keywords: (getMeaningObj(c).keywords || []),
        meaning_short_kr: getMeaningObj(c).meaning_short_kr || getMeaningObj(c).meaning || "",
        meaning_long_kr: getMeaningObj(c).meaning_long_kr || "",
      })),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI 호출 실패: ${res.status} ${t}`);
    }

    const aiResult = await res.json();

    // ✅ 저장 (전역 실행 금지!)
    lastDraw.ai = {
      card_comments: Array.isArray(aiResult.card_comments) ? aiResult.card_comments : [],
      overall_comment: aiResult.overall_comment || {},
    };

    // ✅ 종합 패널 갱신 (AI 종합 코멘트 포함)
    if (summaryEl) {
      summaryEl.textContent = buildRichSummary(lastDraw);
    }
  } catch (e) {
    console.error(e);
    if (summaryEl) {
      summaryEl.textContent =
        baseSummaryText +
        "\n\n(OpenAI 리딩 실패. 로컬 해설로 표시됩니다.)\n" +
        "오류: " + (e?.message || e);
    }
  } finally {
    aiLoading = false;
  }
}

/* ------------------------
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
