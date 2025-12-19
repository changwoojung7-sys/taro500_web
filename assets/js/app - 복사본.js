/* =====================================================
   TARO 500 – app.js FINAL (Complete)
   - Spread select (3/5/10)
   - Shuffle
   - Draw -> show backs first
   - Click to flip one by one (with reversed rotation)
   - Modal: close button / backdrop / ESC
   - After all revealed -> rich local summary
   ===================================================== */

let CARDS = [];
let selectedSpread = 3;
let lastDraw = null; // { spread:number, cards:[...] }
let revealedCount = 0;

const SPREADS = {
  3: {
    name: "과거·현재·미래 (3장)",
    positions: ["과거", "현재", "미래"],
  },
  5: {
    name: "5장 리딩",
    positions: ["상황", "장애/과제", "조언", "결과", "숨은 영향"],
  },
  10: {
    name: "켈틱 크로스 (10장)",
    positions: [
      "현재",
      "장애/도움(교차)",
      "근본 원인",
      "과거",
      "의식/목표",
      "가까운 미래",
      "나(태도)",
      "환경/타인",
      "희망/두려움",
      "결말",
    ],
  },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function baseURL() {
  // 현재 index.html 기준 상대경로 계산
  return new URL(".", window.location.href);
}
function absURL(path) {
  // cards.json 내부가 "/data/..." 처럼 절대경로면 origin 기준으로 유지
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

/* ------------------------
   Load cards.json
------------------------- */
async function loadCards() {
  // file:// 에선 fetch가 막히므로 안내
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

  // 이미지 경로 보정
  CARDS = data.map((c) => ({
    ...c,
    image: absURL(c.image),
  }));

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
      if (grid) {
        grid.classList.toggle("celtic", selectedSpread === 10);
      }

      console.log("SPREAD SELECTED:", selectedSpread);
    });
  });

  // 초기 active 보정
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

  lastDraw = { spread: selectedSpread, cards: cardsWithMeta };

  renderBackCards(cardsWithMeta);

  const summary = $("#summary");
  if (summary) {
    summary.classList.remove("empty");
    summary.textContent = "카드를 눌러 한 장씩 뒤집어 보세요.";
  }

  // 결과 타이틀(있다면)
  const spreadTitle = $("#spreadTitle");
  if (spreadTitle) spreadTitle.textContent = SPREADS[selectedSpread].name;
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

    // NOTE: rev 회전은 img.rev 로 처리 (CSS 없으면 inline transform도 걸어둠)
    const revClass = card.is_reversed ? "rev" : "";

    wrap.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <img src="${backSrc}" alt="back"/>
          <div class="tapHint">클릭해서 공개</div>
        </div>
        <div class="card-face card-front">
          <img src="${safeText(card.image)}" class="${revClass}" style="${card.is_reversed ? "transform: rotate(180deg);" : ""}" alt="${safeText(card.name_kr)}"/>
          <div class="label">
            <div class="name">${safeText(card.name_kr)}${card.is_reversed ? " (역)" : ""}</div>
            <div class="desc">${safeText(getCardShortLine(card))}</div>
          </div>
        </div>
      </div>
    `;

    wrap.addEventListener("click", () => {
      if (wrap.dataset.revealed === "1") {
        openModal(card, idx);
        return;
      }

      wrap.classList.add("flipped");
      wrap.dataset.revealed = "1";
      revealedCount += 1;

      openModal(card, idx);

      if (lastDraw && revealedCount === lastDraw.cards.length) {
        // 전부 공개 후 종합해설 생성
        const summary = $("#summary");
        if (summary) {
          summary.classList.remove("empty");
          summary.textContent = buildRichSummary(lastDraw);
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
  // cards.json 구조: upright {keywords, meaning}, reversed {keywords, meaning}
  const up = card.upright || {};
  const rv = card.reversed || {};
  return card.is_reversed ? rv : up;
}

function getCardShortLine(card) {
  const m = getMeaningObj(card);
  const kw = Array.isArray(m.keywords) ? m.keywords.slice(0, 3).join(", ") : "";
  const meaning = safeText(m.meaning);
  if (kw && meaning) return `${kw} · ${meaning}`;
  return meaning || kw || " ";
}

function getCardLongText(card) {
  const m = getMeaningObj(card);
  const kw = Array.isArray(m.keywords) ? m.keywords.join(", ") : "";
  const meaning = safeText(m.meaning);
  let extra = "";

  // 확장 필드가 있으면 활용 (사용자가 교체한 상세 JSON에도 대응)
  if (card.description_kr) extra = safeText(card.description_kr);
  else if (card.meaning_long_kr) extra = safeText(card.meaning_long_kr);
  else if (card.meaning_short_kr) extra = safeText(card.meaning_short_kr);

  const lines = [];
  if (kw) lines.push(`키워드: ${kw}`);
  if (meaning) lines.push(`해석: ${meaning}`);
  if (extra && extra !== meaning) lines.push(`설명: ${extra}`);

  return lines.join("\n");
}

/* ------------------------
   AI Comments Integration
------------------------- */
lastDraw.aiComments = aiResult.card_comments;
lastDraw.aiOverall = aiResult.overall_comment;

function getAICardComment(idx) {
  return lastDraw?.aiComments?.find(c => c.index === idx);
}

const ai = getAICardComment(idx);
if (ai) {
  modalText.textContent += "\n\n[타로 리더 코멘트]\n" + ai.message;
}

function renderAIOverall(overall) {
  return `
**전체 흐름**
${overall.summary}

**조언**
${overall.advice}

${overall.closing}
`;
}


/* ------------------------
   Modal (Closeable)
------------------------- */
function initModalEvents() {
  const modal = $("#modal");
  if (!modal) return;

  // 닫기 버튼
  $("#modalClose")?.addEventListener("click", closeModal);

  // 배경 클릭 닫기
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(card, idx) {
  const modal = $("#modal");
  if (!modal) {
    // 모달이 없으면 summary로만 표시
    const summary = $("#summary");
    if (summary) {
      summary.classList.remove("empty");
      summary.textContent =
        `${idx + 1}번째 카드 · ${card.position_label} · ${card.is_reversed ? "역방향" : "정방향"}\n` +
        `${safeText(card.name_kr)} (${safeText(card.name_en)})\n\n` +
        getCardLongText(card);
    }
    return;
  }

  modal.classList.remove("hidden");

  if ($("#modalImg")) $("#modalImg").src = safeText(card.image);
  if ($("#modalPos"))
    $("#modalPos").textContent = `${idx + 1}번째 카드 · ${safeText(card.position_label)} · ${
      card.is_reversed ? "역방향" : "정방향"
    }`;
  if ($("#modalTitle")) $("#modalTitle").textContent = `${safeText(card.name_kr)} (${safeText(card.name_en)})`;
  if ($("#modalText")) {
    const m = getMeaningObj(card);
    const shortText =
      m.meaning_short_kr || m.meaning || "";
    const longText =
      m.meaning_long_kr || "";
    let text = "";
    if (shortText) {
      text += `■ 한 줄 핵심\n${shortText}\n\n`;
    }
    if (longText) {
      text += `■ 자세한 해설\n${longText}`;
    }
    $("#modalText").textContent = text.trim();
  }

  // 키워드 칩(있으면)
  const chips = $("#modalChips");
  if (chips) {
    chips.innerHTML = "";
    const m = getMeaningObj(card);
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

  // 헤더 (타로 리더 말투)
  lines.push(`**${name} 리딩 종합해설**`);
  lines.push("");
  lines.push("지금 펼쳐진 카드들은 하나의 흐름으로 연결되어 있습니다.");
  lines.push("각 카드가 말해주는 메시지를 차분히 따라가며 읽어볼게요.");
  lines.push("");

  // 카드별 해설
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

  // (옵션) 카드 상세해설 종합 블록을 따로 한번 더 넣고 싶다면
  // - 지금은 카드별에서 이미 long을 쓰고 있으니,
  // - "추가 섹션"이 필요할 때만 활성화
  // 원하면 아래 주석을 해제해서 사용하세요.
  /*
  if (useLong) {
    lines.push("**카드 상세 해설 종합**");
    cards.forEach((c, i) => {
      const longText = getCardLongMeaning(c);
      if (!longText) return;
      lines.push("");
      lines.push(`▶ ${i + 1}. ${safeText(c.position_label)} – ${safeText(c.name_kr)}`);
      lines.push(longText);
    });
    lines.push("");
  }
  */

  // 전체 키워드 집계
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

  // 전체 흐름 요약
  lines.push("**전체 흐름을 종합해보면**");
  lines.push("이번 리딩은 단일한 사건보다는, 시간의 흐름 속에서 점진적으로 전개되는 상황을 보여줍니다.");
  lines.push("현재의 선택과 태도가 앞으로의 방향에 중요한 영향을 미치며, 카드들은 ‘서두르기보다는 흐름을 읽고 대응하라’는 메시지를 반복해서 전하고 있습니다.");
  lines.push("");

  lines.push("**전체 흐름 요약**");
  if (topKW.length) lines.push(`- 핵심 키워드: ${topKW.join(" · ")}`);
  if (topRev.length) lines.push(`- 주의(역방향) 포인트: ${topRev.join(" · ")}`);
  lines.push("");

  // 스프레드별 구조적 해석
  lines.push("**해석의 결론**");
  if (spread === 3) {
    const [a, b, c] = cards;
    lines.push(`- 과거(${safeText(a?.name_kr)}): 지나온 흐름/기반을 보여줍니다.`);
    lines.push(`- 현재(${safeText(b?.name_kr)}): 지금의 핵심 이슈·에너지입니다.`);
    lines.push(`- 미래(${safeText(c?.name_kr)}): 그대로 가면 펼쳐질 방향/결과입니다.`);
  } else if (spread === 5) {
    lines.push("- 상황→장애→조언→결과→숨은 영향 순으로 “원인과 해결”이 보입니다.");
  } else if (spread === 10) {
    lines.push("- 켈틱크로스는 ‘현재/교차/근본/과거/의식/미래/나/환경/희망/결말’ 구조로 큰 그림을 그립니다.");
  }
  lines.push("");

  // 실천 제안(3개) - 리더 말투로 조금 부드럽게
  lines.push("**추천 액션 3가지**");
  lines.push("1) 오늘 할 수 있는 ‘가장 작은 행동’ 1개를 정하고 바로 실행해보세요.");
  lines.push("2) 역방향 카드가 가리키는 부분(조급함/불안/통제 등)은 ‘속도 조절’로 완화하는 게 좋습니다.");
  lines.push("3) 7일 안에 확인 가능한 목표로 쪼개서, 결과를 기록하며 흐름을 점검해보세요.");
  lines.push("");

  lines.push("타로는 미래를 단정하지 않습니다. 지금의 흐름을 참고해, 당신에게 가장 맞는 선택을 해보세요.");

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
   Clear
------------------------- */
function clearAll() {
  const grid = $("#grid");
  if (grid) grid.innerHTML = "";

  revealedCount = 0;
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

    // 카드 로드 후 안내
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
        "- 로컬서버 또는 Netlify/Vercel에서 실행하세요.\n\n" +
        "오류: " + (e?.message || e);
    }
  }
})();

function useLongMeaningEnabled() {
  const el = document.querySelector("#useLongMeaning");
  return el ? el.checked : false;
}

function getCardLongMeaning(card) {
  if (card.is_reversed) {
    return card.reversed?.meaning_long_kr
        || card.reversed?.meaning
        || "";
  }
  return card.upright?.meaning_long_kr
      || card.upright?.meaning
      || "";
}
