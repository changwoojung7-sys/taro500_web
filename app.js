const state = {
  cards: [],
  spread: 1,
  useReversed: true,
  drawMode: "auto", // auto | pick
  picked: [],
  question: "",
  lastResult: [],
};

function $(sel){ return document.querySelector(sel); }
function $$ (sel){ return Array.from(document.querySelectorAll(sel)); }

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  setTimeout(()=>t.classList.remove("on"), 2200);
}

function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}

async function loadCards(){
  const res = await fetch("cards.json");
  const data = await res.json();
  state.cards = data.cards;
}

function setSpread(n){
  state.spread = n;
  $("#customWrap").style.display = (n==="custom") ? "block" : "none";
  $$(".chip").forEach(c=>c.classList.remove("on"));
  const el = document.querySelector(`.chip[data-spread="${n}"]`);
  if(el) el.classList.add("on");
  updateButtons();
}

function getSpreadCount(){
  if(state.spread==="custom"){
    return parseInt($("#customCount").value,10);
  }
  return parseInt(state.spread,10);
}

function updateButtons(){
  const cnt = getSpreadCount();
  $("#btnShuffle").disabled = state.cards.length===0;
  $("#btnDraw").disabled = state.cards.length===0;
  $("#pickHint").textContent = (state.drawMode==="pick")
    ? `카드를 클릭해서 ${cnt}장 선택하세요.`
    : `자동으로 ${cnt}장을 뽑습니다.`;
}

function renderPlaceholders(){
  const area = $("#spreadArea");
  area.innerHTML = "";
  const cnt = getSpreadCount();
  for(let i=0;i<cnt;i++){
    const w = document.createElement("div");
    w.className = "cardWrap";
    w.innerHTML = `
      <div class="card" data-idx="${i}">
        <div class="face back">
          <img alt="back" src="assets/cards/back.svg"/>
        </div>
        <div class="face front">
          <img alt="front" src="assets/cards/back.svg"/>
          <div class="ribbon">선택 전</div>
        </div>
      </div>`;
    w.addEventListener("click", ()=> onPick(i));
    area.appendChild(w);
  }
}

function onPick(slotIdx){
  if(state.drawMode!=="pick") return;
  const cnt = getSpreadCount();
  if(state.picked.length>=cnt) return;

  // pick a random remaining card
  const remaining = state.cards.filter(c=>!state.picked.find(p=>p.id===c.id));
  if(remaining.length===0) return;
  const card = remaining[Math.floor(Math.random()*remaining.length)];
  const reversed = state.useReversed ? (Math.random()<0.5) : false;
  const pick = { ...card, reversed };
  state.picked.push(pick);

  // render this slot immediately
  const slotCardEl = document.querySelector(`.card[data-idx="${slotIdx}"]`);
  applyCardToElement(slotCardEl, pick);
  slotCardEl.classList.add("flipped");

  if(state.picked.length===cnt){
    finalizeResult(state.picked);
  }else{
    toast(`${state.picked.length}/${cnt} 선택됨`);
  }
}

function applyCardToElement(cardEl, pick){
  const img = cardEl.querySelector(".front img");
  img.src = pick.image;
  const ribbon = cardEl.querySelector(".ribbon");
  ribbon.textContent = `${pick.name_kr} · ${pick.reversed ? "역방향" : "정방향"}`;
  // rotate image if reversed
  img.style.transform = pick.reversed ? "rotate(180deg)" : "rotate(0deg)";
}

function buildMeaning(pick){
  const d = pick.reversed ? pick.reversed : pick.upright;
  const kws = d.keywords || [];
  const meaning = d.meaning || "";
  return { kws, meaning };
}

function renderDetail(pick){
  const head = `${pick.name_kr} <span class="badge" style="margin-left:8px">${pick.reversed ? "역방향" : "정방향"}</span>`;
  const en = `<div class="small">${pick.name_en} · ${pick.arcana==="Major" ? "메이저 아르카나" : `마이너(${pick.suit_kr})`}</div>`;
  const {kws, meaning} = buildMeaning(pick);
  const kwHtml = kws.map(k=>`<span class="kw">${k}</span>`).join("");
  $("#detailTitle").innerHTML = head;
  $("#detailMeta").innerHTML = en;
  $("#detailMeaning").textContent = meaning;
  $("#detailKws").innerHTML = kwHtml;

  const q = state.question.trim();
  $("#detailQuestion").textContent = q ? `질문: ${q}` : "질문이 비어있습니다. (선택)";
  $("#detailAdvice").textContent = makeAdvice(pick, q);
}

function makeAdvice(pick, question){
  // 아주 간단한 룰 기반 조언(정적 사이트에서도 동작)
  const reversed = pick.reversed;
  const arc = pick.arcana;
  const base = reversed ? "무리하지 말고" : "한 발 더";
  const focus = arc==="Major" ? "큰 방향" : "실행 계획";
  if(question){
    return `${base} 나아가되, 지금은 ${focus}을/를 질문(“${question}”)에 맞춰 정리하는 게 좋아요.`;
  }
  return `${base} 나아가되, 지금은 ${focus}을/를 먼저 정리해보세요.`;
}

function finalizeResult(result){
  state.lastResult = result;
  $("#resultCount").textContent = `${result.length}장 결과`;
  // default show first card detail
  if(result[0]) renderDetail(result[0]);

  // click-to-focus
  $$(".card").forEach((cEl, idx)=>{
    cEl.addEventListener("click", ()=>{
      const pick = state.lastResult[idx];
      if(!pick) return;
      cEl.classList.toggle("flipped");
      renderDetail(pick);
    });
  });

  toast("리딩이 준비됐어요 ✨");
}

function localDraw(){
  const cnt = getSpreadCount();
  const deck = shuffle([...state.cards]);
  const chosen = deck.slice(0,cnt).map(c=>{
    const reversed = state.useReversed ? (Math.random()<0.5) : false;
    return {...c, reversed};
  });
  // render
  const cardsEl = $$(".card");
  chosen.forEach((pick, i)=>{
    const el = cardsEl[i];
    applyCardToElement(el, pick);
    // auto flip sequentially
    setTimeout(()=>el.classList.add("flipped"), 120*i);
  });
  finalizeResult(chosen);
}

async function apiDraw(){
  // optional: if Flask backend exists
  const cnt = getSpreadCount();
  const res = await fetch(`/api/draw?count=${cnt}&reversed=${state.useReversed ? "1":"0"}&q=${encodeURIComponent(state.question||"")}`);
  if(!res.ok) throw new Error("API draw failed");
  const data = await res.json();
  return data.result;
}

async function doDraw(){
  state.question = $("#question").value || "";
  state.picked = [];
  renderPlaceholders();

  const cnt = getSpreadCount();
  if(state.drawMode==="pick"){
    toast(`카드를 선택해 ${cnt}장을 완성하세요`);
    return;
  }

  // Try API first if running on Flask, otherwise fall back to local
  try{
    const result = await apiDraw();
    // render result
    const cardsEl = $$(".card");
    result.forEach((pick, i)=>{
      const el = cardsEl[i];
      applyCardToElement(el, pick);
      setTimeout(()=>el.classList.add("flipped"), 120*i);
    });
    finalizeResult(result);
  }catch(e){
    localDraw();
  }
}

function doShuffle(){
  renderPlaceholders();
  toast("카드를 섞는 중…");
  // small visual shake
  const d = $("#deck");
  d.animate([{transform:"rotate(-6deg) translateY(0)"},{transform:"rotate(-10deg) translateY(2px)"},{transform:"rotate(-6deg) translateY(0)"}], {duration:420});
}

function bindUI(){
  $$(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=> setSpread(ch.dataset.spread));
  });
  $("#customCount").addEventListener("input", ()=>{
    $("#customLabel").textContent = $("#customCount").value;
    renderPlaceholders();
    updateButtons();
  });

  $("#useReversed").addEventListener("change", e=>{
    state.useReversed = e.target.checked;
    updateButtons();
  });

  $$("input[name='drawMode']").forEach(r=>{
    r.addEventListener("change", e=>{
      state.drawMode = e.target.value;
      state.picked = [];
      renderPlaceholders();
      updateButtons();
    });
  });

  $("#btnShuffle").addEventListener("click", doShuffle);
  $("#btnDraw").addEventListener("click", doDraw);

  // nav simple
  $("#navHome").addEventListener("click", ()=> showSection("home"));
  $("#navLibrary").addEventListener("click", ()=> showSection("library"));
  $("#navGuide").addEventListener("click", ()=> showSection("guide"));
}

function showSection(name){
  $$("#nav button").forEach(b=>b.classList.remove("active"));
  $(`#nav${name[0].toUpperCase()+name.slice(1)}`).classList.add("active");

  $$(".section").forEach(s=>s.style.display="none");
  $(`#sec-${name}`).style.display="block";

  if(name==="library") renderLibrary();
}

function renderLibrary(){
  const wrap = $("#libWrap");
  const q = ($("#libSearch").value||"").trim();
  const filter = ($("#libFilter").value||"all");
  let list = state.cards;

  if(filter==="major") list = list.filter(c=>c.arcana==="Major");
  if(filter==="minor") list = list.filter(c=>c.arcana==="Minor");
  if(filter==="wands") list = list.filter(c=>c.suit_en==="Wands");
  if(filter==="cups") list = list.filter(c=>c.suit_en==="Cups");
  if(filter==="swords") list = list.filter(c=>c.suit_en==="Swords");
  if(filter==="pentacles") list = list.filter(c=>c.suit_en==="Pentacles");

  if(q){
    const qq = q.toLowerCase();
    list = list.filter(c=> (c.name_en||"").toLowerCase().includes(qq) || (c.name_kr||"").includes(q));
  }

  wrap.innerHTML = list.slice(0,120).map(c=>`
    <div class="tog" style="gap:12px; cursor:pointer" data-id="${c.id}">
      <img src="${c.image}" alt="${c.name_en}" style="width:54px; height:90px; object-fit:cover; border-radius:12px; border:1px solid rgba(226,232,240,.12); background:rgba(2,6,23,.25)" onerror="this.src='assets/cards/back.svg'"/>
      <div style="display:flex; flex-direction:column; gap:2px">
        <div style="font-weight:800">${c.name_kr}</div>
        <div class="small">${c.name_en} · ${c.arcana==="Major" ? "Major" : c.suit_en}</div>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-id]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = parseInt(el.dataset.id,10);
      const card = state.cards.find(x=>x.id===id);
      if(!card) return;
      const pick = {...card, reversed:false};
      renderDetail(pick);
      toast("도감 카드 표시");
    });
  });
}

async function init(){
  await loadCards();
  bindUI();
  setSpread("1");
  renderPlaceholders();
  showSection("home");

  $("#libSearch").addEventListener("input", ()=>renderLibrary());
  $("#libFilter").addEventListener("change", ()=>renderLibrary());

  updateButtons();
  $("#deckCount").textContent = `${state.cards.length}장 덱 로드됨`;
}

document.addEventListener("DOMContentLoaded", init);
