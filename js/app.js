let CARDS = [];
let SPREADS = {
  "3": { name:"과거·현재·미래 (3장)", count:3, positions:[{label:"과거"},{label:"현재"},{label:"미래"}]},
  "5": { name:"5장 리딩", count:5, positions:[{label:"상황"},{label:"장애/과제"},{label:"조언"},{label:"결과"},{label:"숨은 영향"}]},
  "10":{ name:"켈틱 크로스 (10장)", count:10, positions:[{label:"현재"},{label:"장애/도움(교차)"},{label:"근본 원인"},{label:"과거"},{label:"의식/목표"},{label:"가까운 미래"},{label:"나(태도)"},{label:"환경/타인"},{label:"희망/두려움"},{label:"결말"}]}
};
let selectedSpread="3";
let lastDraw=null;

const $ = (s)=>document.querySelector(s);
function esc(s){ return (s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

async function loadCards(){
  const res = await fetch("./data/cards.json");
  CARDS = await res.json();
}

function renderSpreads(){
  const row = $("#spreadRow");
  row.innerHTML="";
  ["3","5","10"].forEach(k=>{
    const s = SPREADS[k];
    const btn=document.createElement("button");
    btn.className="spreadBtn";
    btn.dataset.key=k;
    btn.innerHTML=`<b>${esc(s.name)}</b><div class="hint">${s.count}장 • ${s.positions.map(p=>p.label).slice(0,3).join(" / ")}${s.count>3?" …":""}</div>`;
    btn.onclick=()=>setSpread(k);
    row.appendChild(btn);
  });
  setSpread("3");
}

function setSpread(k){
  selectedSpread=k;
  document.querySelectorAll(".spreadBtn").forEach(b=>b.classList.toggle("active", b.dataset.key===k));
  const s=SPREADS[k];
  $("#spreadTitle").textContent=s.name;
  $("#spreadDesc").textContent=s.positions.map((p,i)=>`${i+1}.${p.label}`).join("  ·  ");
}

function localSummary(question, spreadName, cards){
  let rev=0, majors=0; const suitCounts={}; const keywords=[];
  cards.forEach(c=>{
    if(c.arcana==="Major") majors++;
    const suit = c.suit || "Major";
    suitCounts[suit]=(suitCounts[suit]||0)+1;
    if(c.is_reversed) rev++;
    const k = c.is_reversed?c.reversed.keywords:c.upright.keywords;
    keywords.push(...(k||[]).slice(0,2));
  });
  const topSuit = Object.entries(suitCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Major";
  const tone = rev>=cards.length/2 ? "조심스럽게 속도를 조절" : "흐름이 비교적 매끄럽게 진행";
  const majorNote = majors>=Math.max(1, Math.floor(cards.length/3)) ? "중요한 전환점/핵심 메시지(메이저 비중 높음)" : "일상적 선택/실행(마이너 중심)";
  const kw = keywords.slice(0,8).join(" · ");
  const bullets = cards.map(c=>{
    const m = c.is_reversed?c.reversed.meaning:c.upright.meaning;
    return `- **${c.position.label} / ${c.name_kr}** (${c.is_reversed?'역':'정'}): ${m}`;
  }).join("\n");
  return `**${spreadName} 종합**: 이번 리딩은 **${topSuit}** 성향이 강하고, ${majorNote} 쪽으로 읽혀요. 전반적으로 **${tone}**하는 게 핵심입니다.\n키워드 흐름: ${kw}\n\n✅ **실행 팁**: (1) 지금 가능한 작은 행동 1개를 정하고 (2) 감정/정보를 분리해 판단하고 (3) 7일 내 확인 가능한 목표로 쪼개보세요.\n\n**카드별 해석**\n${bullets}`;
}

function draw(){
  const s=SPREADS[selectedSpread];
  const deck=[...CARDS];
  for(let i=deck.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  const allowRev=$("#revToggle").checked;
  const picked=deck.slice(0,s.count).map((c,i)=>{
    const cc={...c};
    cc.is_reversed = allowRev ? Math.random()<0.5 : false;
    cc.position = s.positions[i];
    // adjust image path for static
    cc.image = cc.image.replace("/data/cards/","./data/cards/");
    return cc;
  });
  lastDraw={spread:s, cards:picked};
  renderCards(picked);
  $("#summary").classList.remove("empty");
  $("#summary").textContent=localSummary($("#question").value||"", s.name, picked);
  $("#modeUsed").textContent="mode: local";
}

function renderCards(cards){
  const grid=$("#grid");
  grid.innerHTML="";
  cards.forEach(c=>{
    const div=document.createElement("div");
    div.className="tarot";
    const meaning=c.is_reversed?c.reversed.meaning:c.upright.meaning;
    div.innerHTML=`
      <div class="meta">
        <span class="badge pos">${esc(c.position.label)}</span>
        <span class="badge ${c.is_reversed?'rev':''}">${c.is_reversed?'역방향':'정방향'}</span>
      </div>
      <img src="${esc(c.image)}" class="${c.is_reversed?'rev':''}" alt="${esc(c.name_kr)}"/>
      <div class="label">
        <div class="name">${esc(c.name_kr)}</div>
        <div class="desc">${esc(meaning)}</div>
      </div>`;
    div.onclick=()=>openModal(c);
    grid.appendChild(div);
  });
}

function openModal(card){
  const modal=$("#modal");
  modal.classList.remove("hidden");
  const isRev=!!card.is_reversed;
  $("#modalImg").src=card.image;
  $("#modalImg").style.transform=isRev?"rotate(180deg)":"none";
  $("#modalPos").textContent=`${card.position.label} · ${isRev?'역방향':'정방향'}`;
  $("#modalTitle").textContent=`${card.name_kr} (${card.name_en})`;
  $("#modalText").textContent=isRev?card.reversed.meaning:card.upright.meaning;
  const kws=isRev?card.reversed.keywords:card.upright.keywords;
  const chips=$("#modalChips"); chips.innerHTML="";
  (kws||[]).slice(0,8).forEach(k=>{ const s=document.createElement("span"); s.className="chip"; s.textContent=k; chips.appendChild(s); });
}

function closeModal(){ $("#modal").classList.add("hidden"); }
$("#modalClose")?.addEventListener("click", closeModal);
document.addEventListener("click",(e)=>{ const m=$("#modal"); if(!m.classList.contains("hidden") && e.target===m) closeModal(); });
window.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModal(); });

$("#drawBtn")?.addEventListener("click", draw);
$("#clearBtn")?.addEventListener("click", ()=>{ $("#grid").innerHTML=""; $("#summary").textContent="아직 카드가 없어요. ✨"; $("#summary").classList.add("empty"); $("#modeUsed").textContent=""; });
$("#shuffleBtn")?.addEventListener("click", draw);

(async ()=>{
  await loadCards();
  renderSpreads();
})();