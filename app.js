
const K_WORDS="vw_words_v4",K_META="vw_meta_v4",K_API="vw_api_v4",K_TODAY="vw_today_seen_v4",K_TODAY_CACHE="vw_today_cache_v5",K_REWARD="vw_quiet_reward_v1";
const savedApi=load(K_API,{apiKey:"",model:"gpt-5.6-terra"});
const todayCacheSaved=load(K_TODAY_CACHE,{date:"",queue:[],display:[]});
const rewardSaved=load(K_REWARD,{date:"",reviewIds:[],testIds:[],transformKeys:[],claimed:false,history:[],seriesPieces:{},secretSeen:[]});
const S={
  words:load(K_WORDS,[]),meta:load(K_META,{correct:0,wrong:0,lastStudy:null,streak:0}),
  apiKey:savedApi.apiKey||"",model:savedApi.model||"gpt-5.6-terra",
  mode:"wordlist",photos:[],extracted:null,
  reviewQueue:[],reviewIndex:0,reviewFlipped:false,reviewPreset:null,
  testMode:"meaning",testSource:null,testQueue:[],testIndex:0,testCorrect:0,lastGrade:null,
  transformType:"mixed",transformSource:null,transformQueue:[],transformIndex:0,transformCorrect:0,
  reward:rewardSaved,rewardSeriesView:0,
  filter:"all",todayWords:todayCacheSaved.date===new Date().toISOString().slice(0,10)?(todayCacheSaved.display||[]):[],
  todayQueue:todayCacheSaved.date===new Date().toISOString().slice(0,10)?(todayCacheSaved.queue||[]):[],
  todaySeen:load(K_TODAY,[])
};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(){localStorage.setItem(K_WORDS,JSON.stringify(S.words));localStorage.setItem(K_META,JSON.stringify(S.meta));localStorage.setItem(K_TODAY,JSON.stringify(S.todaySeen));renderHome()}
function now(){return Date.now()}function day(n){return n*86400000}
function norm(s){return String(s||"").toLowerCase().trim().replace(/\s+/g," ")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function uid(){return crypto.randomUUID?.()||Date.now()+"_"+Math.random().toString(36).slice(2)}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>x.classList.remove("show"),2400)}
function show(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  $$(".nav").forEach(v=>v.classList.toggle("active",v.dataset.go===id));
  if(id==="home")renderHome();
  if(id==="review")startReview();
  if(id==="test")startTest();
  if(id==="transform")startTransform();
  if(id==="sources")renderSources();
  if(id==="report")renderReport();
  if(id==="library")renderLibrary();
  scrollTo({top:0,behavior:"smooth"});
}
$$("[data-go]").forEach(b=>b.onclick=()=>{
  if(b.dataset.resetSource==="1"&&b.dataset.go==="test")S.testSource=null;
  if(b.dataset.resetSource==="1"&&b.dataset.go==="transform")S.transformSource=null;
  show(b.dataset.go);
});
$$(".back").forEach(b=>b.onclick=()=>show("home"));

function studyTouch(){
  const today=new Date().toISOString().slice(0,10);
  if(S.meta.lastStudy===today)return;
  if(S.meta.lastStudy){
    const a=new Date(S.meta.lastStudy+"T00:00:00"),b=new Date(today+"T00:00:00");
    S.meta.streak=((b-a)/86400000===1)?(S.meta.streak||0)+1:1;
  }else S.meta.streak=1;
  S.meta.lastStudy=today;
}
function weakness(w){
  return Math.max(0,Math.min(100,
    (w.wrong||0)*20+
    (w.skipCount||0)*18+
    (6-(w.strength||0))*10+
    ((w.dueAt||0)<=now()?12:0)-
    (w.correct||0)*2
  ));
}

function wordReadiness(w){
  let score=18;
  score+=(w.strength||0)*10;
  score+=Math.min(4,w.correct||0)*7;
  score+=Math.min(2,w.goodCount||0)*8;
  if(w.testEnabled===false)score+=24;
  score-=Math.min(4,w.wrong||0)*9;
  score-=Math.min(4,w.skipCount||0)*10;
  if((w.dueAt||0)<=now())score-=5;
  return Math.max(0,Math.min(100,Math.round(score)));
}
function sourceKey(w){
  const s=String(w.sourceLabel||"").trim();
  return s||"출처 미지정";
}
function sourceGroups(){
  const map=new Map();
  for(const w of S.words){
    const k=sourceKey(w);
    if(!map.has(k))map.set(k,[]);
    map.get(k).push(w);
  }
  return [...map.entries()].sort((a,b)=>b[1].length-a[1].length);
}
function avg(arr,fn){return arr.length?arr.reduce((s,x)=>s+fn(x),0)/arr.length:0}
function markReviewed(w){w.lastReviewedAt=now()}

const REWARD_SERIES=[
  {id:"sky",name:"밤하늘 기록",desc:"8조각을 모으면 전체 밤하늘이 완성돼.",className:"series-sky"},
  {id:"aurora",name:"오로라 기록",desc:"차분한 오로라 장면을 8조각으로 모아.",className:"series-aurora"},
  {id:"city",name:"밤의 도시",desc:"도시의 불빛을 하나씩 완성해.",className:"series-city"},
  {id:"paper",name:"종이 위의 별자리",desc:"마지막 조각까지 모으면 전체 구도가 드러나.",className:"series-paper"}
];
const SECRET_CARDS=[
  {title:"시험에서 자주 생기는 착각",body:"동의어는 100% 같은 뜻이 아니야. 실제 문제에서는 문맥에 자연스럽게 들어가는지까지 보는 경우가 많아."},
  {title:"adapt / adopt",body:"adapt는 ‘적응시키다·적응하다’, adopt는 ‘채택하다·입양하다’. 철자가 비슷해서 독해에서 빠르게 헷갈리기 쉬워."},
  {title:"economic / economical",body:"economic은 ‘경제의’, economical은 보통 ‘경제적인·절약되는’. 형태가 비슷해도 쓰임이 갈려."},
  {title:"imply / infer",body:"imply는 말하는 쪽이 ‘암시하다’, infer는 읽거나 듣는 쪽이 ‘추론하다’. 주체를 보면 구분하기 쉬워."},
  {title:"respectively",body:"respectively가 나오면 앞뒤 항목의 순서를 연결해서 읽어. 긴 문장에서 대응 관계를 빠르게 잡는 신호가 돼."},
  {title:"however의 함정",body:"however를 무조건 ‘그러나’로만 외우지 마. ‘아무리 ~해도’나 ‘어떻게 ~하든’처럼 쓰이는 경우도 있어."},
  {title:"파생어를 같이 외우는 이유",body:"품사가 바뀌면 문장 속 자리도 달라져. 단어 하나보다 명사·형용사·동사 묶음으로 기억하면 변형 문제에 강해져."},
  {title:"뜻을 여러 개 외울 때",body:"뜻을 전부 똑같이 외우기보다 가장 자주 쓰는 핵심 의미 하나를 중심에 두고 문맥별 의미를 가지처럼 붙이는 편이 기억하기 쉬워."},
  {title:"비슷한 철자가 보이면",body:"철자 차이가 1~2글자인 단어는 따로 외우기보다 둘을 한 화면에서 비교하는 게 좋아. 앱 리포트의 ‘헷갈릴 가능성이 큰 단어’를 활용해."},
  {title:"모르겠음 버튼의 의미",body:"넘기기는 실패가 아니라 복습 신호야. 모르는 순간을 정확히 표시해야 다음 암기에서 그 단어가 더 자주 나와."},
  {title:"문맥에서 뜻이 흐릿할 때",body:"문장 전체 번역보다 그 단어가 긍정·부정인지, 원인·결과인지, 증가·감소인지부터 잡으면 선택지를 빠르게 줄일 수 있어."},
  {title:"반의어가 강한 이유",body:"한 단어를 반대말과 묶어 기억하면 의미의 경계가 선명해져. 변형어 시험에서 반의어까지 함께 보는 이유야."}
];

function rewardToday(){
  return new Date().toISOString().slice(0,10);
}
function ensureRewardDay(){
  const today=rewardToday();
  if(S.reward.date!==today){
    S.reward.date=today;
    S.reward.reviewIds=[];
    S.reward.testIds=[];
    S.reward.transformKeys=[];
    S.reward.claimed=false;
  }
  if(!Array.isArray(S.reward.reviewIds))S.reward.reviewIds=[];
  if(!Array.isArray(S.reward.testIds))S.reward.testIds=[];
  if(!Array.isArray(S.reward.transformKeys))S.reward.transformKeys=[];
  if(!Array.isArray(S.reward.history))S.reward.history=[];
  if(!S.reward.seriesPieces||typeof S.reward.seriesPieces!=="object")S.reward.seriesPieces={};
  if(!Array.isArray(S.reward.secretSeen))S.reward.secretSeen=[];
}
function saveReward(){
  ensureRewardDay();
  localStorage.setItem(K_REWARD,JSON.stringify(S.reward));
}
function rewardGoals(){
  const words=Math.max(0,S.words.length);
  const testable=S.words.filter(w=>w.testEnabled!==false).length;
  const transformable=S.words.filter(w=>(w.synonyms||[]).length||(w.antonyms||[]).length||(w.derivatives||[]).length).length;
  return {
    review:words?Math.min(8,Math.max(3,words)):0,
    test:testable?Math.min(5,Math.max(2,testable)):0,
    transform:transformable?Math.min(3,Math.max(1,transformable)):0
  };
}
function rewardProgress(){
  ensureRewardDay();
  const g=rewardGoals();
  const parts=[];
  if(g.review)parts.push(Math.min(1,S.reward.reviewIds.length/g.review));
  if(g.test)parts.push(Math.min(1,S.reward.testIds.length/g.test));
  if(g.transform)parts.push(Math.min(1,S.reward.transformKeys.length/g.transform));
  const pct=parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length*100):0;
  const ready=parts.length>0&&parts.every(x=>x>=1);
  return {g,pct,ready};
}
function rewardRecord(kind,key){
  ensureRewardDay();
  if(!key)return;
  if(kind==="review"&&!S.reward.reviewIds.includes(key))S.reward.reviewIds.push(key);
  if(kind==="test"&&!S.reward.testIds.includes(key))S.reward.testIds.push(key);
  if(kind==="transform"&&!S.reward.transformKeys.includes(key))S.reward.transformKeys.push(key);
  saveReward();
  renderRewardStrip();
}
function renderRewardStrip(){
  ensureRewardDay();
  const {g,pct,ready}=rewardProgress();
  const strip=$("#rewardStrip");
  if(!strip)return;
  strip.classList.toggle("ready",ready&&!S.reward.claimed);
  strip.classList.toggle("claimed",S.reward.claimed);
  $("#rewardMiniProgress span").style.width=(S.reward.claimed?100:pct)+"%";

  const chunks=[];
  if(g.review)chunks.push(`암기 ${Math.min(S.reward.reviewIds.length,g.review)}/${g.review}`);
  if(g.test)chunks.push(`테스트 ${Math.min(S.reward.testIds.length,g.test)}/${g.test}`);
  if(g.transform)chunks.push(`변형 ${Math.min(S.reward.transformKeys.length,g.transform)}/${g.transform}`);

  if(S.reward.claimed){
    $("#rewardIcon").textContent="✓";
    $("#rewardTitle").textContent="오늘의 봉투 받음";
    $("#rewardProgressText").textContent="내일 다시 하나 열 수 있어.";
    $("#openRewardBtn").textContent="완료";
    $("#openRewardBtn").disabled=true;
  }else if(ready){
    $("#rewardIcon").textContent="✉️";
    $("#rewardTitle").textContent="오늘의 봉투 · 열 수 있음";
    $("#rewardProgressText").textContent="오늘 학습 조건을 모두 채웠어.";
    $("#openRewardBtn").textContent="열기";
    $("#openRewardBtn").disabled=false;
  }else{
    $("#rewardIcon").textContent="🎁";
    $("#rewardTitle").textContent="오늘의 봉투";
    $("#rewardProgressText").textContent=chunks.length?chunks.join(" · "):"단어를 추가하면 시작돼.";
    $("#openRewardBtn").textContent="잠김";
    $("#openRewardBtn").disabled=true;
  }
}
function deterministicInt(seed,max){
  let h=2166136261;
  for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return Math.abs(h>>>0)%max;
}
function currentRewardSeriesIndex(){
  for(let i=0;i<REWARD_SERIES.length;i++){
    const pieces=S.reward.seriesPieces[REWARD_SERIES[i].id]||[];
    if(pieces.length<8)return i;
  }
  return REWARD_SERIES.length-1;
}
function renderCollectionBoard(target,seriesIndex){
  const series=REWARD_SERIES[seriesIndex]||REWARD_SERIES[0];
  const pieces=S.reward.seriesPieces[series.id]||[];
  target.className=`collection-board ${series.className}`;
  target.innerHTML=Array.from({length:8},(_,i)=>`<div class="collection-tile ${pieces.includes(i)?"":"locked"}"></div>`).join("");
}
function renderCollectionView(seriesIndex=S.rewardSeriesView||0){
  ensureRewardDay();
  const series=REWARD_SERIES[seriesIndex]||REWARD_SERIES[0];
  S.rewardSeriesView=seriesIndex;
  const pieces=S.reward.seriesPieces[series.id]||[];
  $("#collectionTitle").textContent=series.name;
  $("#collectionDesc").textContent=`${series.desc} · ${pieces.length}/8`;
  renderCollectionBoard($("#collectionBoard"),seriesIndex);
  $("#collectionSeriesTabs").innerHTML=REWARD_SERIES.map((s,i)=>{
    const n=(S.reward.seriesPieces[s.id]||[]).length;
    return `<button class="collection-tab ${i===seriesIndex?"active":""}" data-series="${i}">${esc(s.name)} ${n}/8</button>`;
  }).join("");
  $$("[data-series]").forEach(b=>b.onclick=()=>renderCollectionView(+b.dataset.series));
}
function showRewardPane(id){
  ["rewardOpening","rewardPieceResult","rewardSecretResult","collectionView"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==id));
}
function closeRewardModal(){
  $("#rewardModal").classList.add("hidden");
  renderRewardStrip();
}
$("#openRewardBtn").onclick=()=>{
  const p=rewardProgress();
  if(!p.ready||S.reward.claimed)return;
  showRewardPane("rewardOpening");
  $("#rewardModal").classList.remove("hidden");
};
$("#collectionBtn").onclick=()=>{
  renderCollectionView(currentRewardSeriesIndex());
  showRewardPane("collectionView");
  $("#rewardModal").classList.remove("hidden");
};
$("#closeRewardBtn").onclick=closeRewardModal;
$("#collectionCloseBtn").onclick=closeRewardModal;
$("#pieceDoneBtn").onclick=closeRewardModal;
$("#secretDoneBtn").onclick=closeRewardModal;

$("#revealRewardBtn").onclick=()=>{
  ensureRewardDay();
  if(S.reward.claimed)return closeRewardModal();

  const seriesIndex=currentRewardSeriesIndex();
  const series=REWARD_SERIES[seriesIndex];
  const pieces=S.reward.seriesPieces[series.id]||[];
  const seed=rewardToday()+"|"+S.words.length+"|"+S.reward.reviewIds.length+"|"+S.reward.testIds.length;
  const pieceChance=pieces.length<8 && deterministicInt(seed+"type",100)<68;

  let result;
  if(pieceChance){
    const missing=Array.from({length:8},(_,i)=>i).filter(i=>!pieces.includes(i));
    const piece=missing[deterministicInt(seed+"piece",missing.length)];
    pieces.push(piece);
    pieces.sort((a,b)=>a-b);
    S.reward.seriesPieces[series.id]=pieces;
    result={type:"piece",series:series.id,piece};
    $("#pieceResultText").textContent=`${series.name} · ${pieces.length}/8${pieces.length===8?" · 완성!":""}`;
    renderCollectionBoard($("#pieceResultPreview"),seriesIndex);
    showRewardPane("rewardPieceResult");
  }else{
    let available=SECRET_CARDS.map((_,i)=>i).filter(i=>!S.reward.secretSeen.includes(i));
    if(!available.length){S.reward.secretSeen=[];available=SECRET_CARDS.map((_,i)=>i)}
    const idx=available[deterministicInt(seed+"secret",available.length)];
    const card=SECRET_CARDS[idx];
    S.reward.secretSeen.push(idx);
    result={type:"secret",index:idx};
    $("#secretTitle").textContent=card.title;
    $("#secretBody").textContent=card.body;
    showRewardPane("rewardSecretResult");
  }

  S.reward.claimed=true;
  S.reward.history.push({date:rewardToday(),...result});
  if(S.reward.history.length>180)S.reward.history=S.reward.history.slice(-180);
  saveReward();
  renderRewardStrip();
};

function renderHome(){
  const due=S.words.filter(w=>(w.dueAt||0)<=now()),weak=S.words.filter(w=>weakness(w)>=45),tries=S.meta.correct+S.meta.wrong;
  $("#dueHero").textContent=`복습 ${due.length}개`;$("#totalStat").textContent=S.words.length;$("#weakStat").textContent=weak.length;$("#accStat").textContent=tries?Math.round(S.meta.correct/tries*100)+"%":"-";$("#streak").textContent=S.meta.streak||0;
  $("#heroSub").textContent=S.words.length?(due.length?"지금 복습할 단어부터 빠르게 털자.":"오늘 예정 복습은 끝났어."):"하단 ＋에서 사진을 추가해.";
  renderRewardStrip();
  const list=$("#dueList");if(!due.length){list.className="mini-list empty";list.textContent=S.words.length?"지금 밀린 복습은 없어.":"아직 단어가 없어."}
  else{list.className="mini-list";list.innerHTML=due.sort((a,b)=>weakness(b)-weakness(a)).slice(0,5).map(w=>`<div class="row"><b>${esc(w.term)}</b><span>${esc(w.meanings[0]||"")}</span></div>`).join("")}
}

$("#apiBtn").onclick=()=>{$("#apiModal").classList.remove("hidden");$("#apiKeyInput").value=S.apiKey;$("#modelInput").value=S.model};
$("#closeApiBtn").onclick=()=>$("#apiModal").classList.add("hidden");
$("#saveApiBtn").onclick=()=>{
  const k=$("#apiKeyInput").value.trim(),m=$("#modelInput").value.trim()||"gpt-5.6-terra";
  if(k.length<10)return toast("API 키를 확인해줘.");
  S.apiKey=k;S.model=m;localStorage.setItem(K_API,JSON.stringify({apiKey:k,model:m}));$("#apiDot").classList.add("on");$("#apiModal").classList.add("hidden");toast("저장 완료 · 다음부터 자동 연결");
};
$("#forgetApiBtn").onclick=()=>{localStorage.removeItem(K_API);S.apiKey="";$("#apiKeyInput").value="";$("#apiDot").classList.remove("on");toast("저장 키 삭제 완료")};
function needApi(){if(S.apiKey)return true;$("#apiModal").classList.remove("hidden");toast("처음 한 번 API 키를 넣어줘.");return false}
function responseText(d){
  let text="";
  for(const out of(d.output||[]))if(out.type==="message")for(const c of(out.content||[]))if(c.type==="output_text")text+=c.text||"";
  return text||d.output_text||"";
}
function parseAIJSON(t){
  let s=String(t||"").trim().replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/\s*```$/,"");
  try{return JSON.parse(s)}catch{const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));throw Error("AI 결과 형식을 읽지 못했어. 다시 시도해줘.")}
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function taskModel(task){
  if(task==="photo") return "gpt-5.6-terra";
  if(task==="fast") return "gpt-5.6-luna";
  return S.model||"gpt-5.6-terra";
}
const progressTimers={};
function setProgress(prefix,pct,label,detail){
  pct=Math.max(0,Math.min(100,Math.round(pct)));
  const box=$("#"+prefix+"Status"),bar=$("#"+prefix+"Bar"),num=$("#"+prefix+"Pct"),lab=$("#"+prefix+"Label"),det=$("#"+prefix+"Detail");
  if(box)box.classList.remove("hidden");if(bar)bar.style.width=pct+"%";if(num)num.textContent=pct+"%";if(lab&&label)lab.textContent=label;if(det&&detail)det.textContent=detail;
}
function startProgress(prefix,label,detail,start=3,cap=88){
  clearInterval(progressTimers[prefix]);let pct=start;setProgress(prefix,pct,label,detail);
  progressTimers[prefix]=setInterval(()=>{if(pct>=cap)return;const step=pct<35?2:pct<65?1.2:.55;pct=Math.min(cap,pct+step);setProgress(prefix,pct)},650);
}
function stopProgress(prefix){clearInterval(progressTimers[prefix]);delete progressTimers[prefix]}
async function openai(body,{prefix=null,timeoutMs=75000,retries=2}={}){
  if(!needApi())throw Error("API 키 필요");
  let lastErr;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const r=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+S.apiKey},
        body:JSON.stringify(body),
        signal:controller.signal
      });
      clearTimeout(timer);
      const d=await r.json().catch(()=>({}));
      if(r.ok)return d;
      const msg=d?.error?.message||`API 오류 ${r.status}`;
      const retryable=r.status===429||r.status===408||r.status===500||r.status===502||r.status===503||r.status===504;
      if(!retryable||attempt>=retries)throw Error(msg);
      const retryAfter=Number(r.headers.get("retry-after")||0);
      const wait=Math.max(retryAfter*1000,900*Math.pow(2,attempt)+Math.random()*350);
      if(prefix)setProgress(prefix,Math.min(86,55+attempt*10),`잠깐 대기 · 자동 재시도 ${attempt+1}/${retries}`,`API가 바쁜 것 같아. ${Math.ceil(wait/1000)}초 후 다시 시도해.`);
      await sleep(wait);lastErr=Error(msg);continue;
    }catch(e){
      clearTimeout(timer);
      lastErr=e;
      const retryable=e.name==="AbortError"||/network|fetch|failed/i.test(String(e.message||e));
      if(!retryable||attempt>=retries)break;
      const wait=900*Math.pow(2,attempt)+Math.random()*300;
      if(prefix)setProgress(prefix,Math.min(86,52+attempt*10),`연결 재시도 ${attempt+1}/${retries}`,e.name==="AbortError"?"응답이 늦어서 자동으로 다시 요청 중이야.":"네트워크 연결을 다시 시도하고 있어.");
      await sleep(wait);
    }
  }
  if(lastErr?.name==="AbortError")throw Error("응답 시간이 너무 길어 중단했어. 사진 수를 줄이거나 잠시 뒤 다시 해줘.");
  throw lastErr||Error("API 요청 실패");
}

/* Multiple photo upload + drag/drop */
$$(".mode").forEach(b=>b.onclick=()=>{$$(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.mode=b.dataset.mode});

/* Manual vocabulary entry */
$("#toggleManualBtn").onclick=()=>{
  const body=$("#manualBody");
  const opening=body.classList.contains("hidden");
  body.classList.toggle("hidden",!opening);
  $("#toggleManualBtn").textContent=opening?"닫기":"열기";
  if(opening)setTimeout(()=>$("#manualBulk").focus(),50);
};

function parseManualLine(line){
  const raw=String(line||"").trim();
  if(!raw)return null;

  // Most explicit separators first
  const separators=["\t"," = ","="," : ",":",","," - "," – "," — "];
  let left="",right="";
  for(const sep of separators){
    const idx=raw.indexOf(sep);
    if(idx>0){
      left=raw.slice(0,idx).trim();
      right=raw.slice(idx+sep.length).trim();
      break;
    }
  }

  // Fallback: first whitespace run separates English from Korean when obvious.
  if(!left){
    const m=raw.match(/^([A-Za-z][A-Za-z0-9'’.\-\s]*?)\s{2,}(.+)$/);
    if(m){left=m[1].trim();right=m[2].trim()}
  }

  if(!left||!right)return {error:true,raw};

  // Require at least one Latin letter in the term.
  if(!/[A-Za-z]/.test(left))return {error:true,raw};

  const meanings=right
    .split(/\s*[\/;]\s*/)
    .map(x=>x.trim())
    .filter(Boolean);

  return {
    term:left,
    meanings:meanings.length?meanings:[right],
    partOfSpeech:"",
    context:"",
    synonyms:[],
    antonyms:[],
    derivatives:[],
    importance:1,
    sourceType:"manual",
    sourceLabel:$("#manualSource").value.trim()||"직접 입력"
  };
}

$("#manualAddBtn").onclick=()=>{
  const text=$("#manualBulk").value.trim();
  if(!text)return toast("먼저 단어를 입력해줘.");

  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const parsed=[],bad=[];

  for(const line of lines){
    const x=parseManualLine(line);
    if(!x)continue;
    if(x.error)bad.push(line);
    else parsed.push(x);
  }

  if(!parsed.length){
    toast("형식을 읽지 못했어. 예: reinforce = 강화하다");
    return;
  }

  let added=0,merged=0;
  const starAll=$("#manualStar").checked;

  for(const x of parsed){
    const existing=S.words.find(w=>norm(w.term)===norm(x.term));
    if(existing){
      existing.meanings=[...new Set([...(existing.meanings||[]),...(x.meanings||[])])];
      if(starAll)existing.star=true;
      merged++;
    }else{
      const w=makeWord(x);
      if(starAll)w.star=true;
      S.words.push(w);
      added++;
    }
  }

  save();
  $("#manualBulk").value="";
  $("#manualStar").checked=false;

  if(bad.length){
    toast(`${added}개 추가 · ${merged}개 병합 · ${bad.length}줄 형식 확인 필요`);
  }else{
    toast(`${added}개 추가 · ${merged}개 기존 단어와 병합 ✅`);
  }

  renderHome();
};

const imageInput=$("#imageInput");
const dz=$("#dropZone");
const choosePhotosBtn=$("#choosePhotosBtn");

function setPhotoStatus(text,state=""){
  const el=$("#photoSelectStatus");
  if(!el)return;
  el.textContent=text;
  el.className="photo-select-status"+(state?` ${state}`:"");
}

// 갤럭시/Android PWA에서 label-hidden-input 조합 대신
// 사용자가 누른 실제 버튼 이벤트에서 file input을 직접 연다.
choosePhotosBtn.addEventListener("click",e=>{
  e.preventDefault();
  e.stopPropagation();
  setPhotoStatus("사진 선택기를 여는 중…");
  imageInput.click();
});

imageInput.addEventListener("click",()=>{
  // 같은 사진을 다시 골라도 change가 확실히 발생하게 초기화
  imageInput.value="";
});

imageInput.addEventListener("change",async e=>{
  try{
    const files=Array.from(e.target.files||[]);
    setPhotoStatus(files.length?`${files.length}장 선택 감지됨 · 앱에 넣는 중…`:"선택된 사진이 없어.");
    await addFiles(files);
  }catch(err){
    console.error("photo change error",err);
    setPhotoStatus("사진 선택 처리 중 오류: "+(err?.message||err),"error");
    toast("사진 선택 처리 오류");
  }
});

["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{
  e.preventDefault();
  dz.classList.add("dragging");
}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{
  e.preventDefault();
  dz.classList.remove("dragging");
}));
dz.addEventListener("drop",async e=>{
  try{
    const files=Array.from(e.dataTransfer?.files||[]);
    setPhotoStatus(files.length?`${files.length}장 드롭 감지됨 · 앱에 넣는 중…`:"드롭된 사진이 없어.");
    await addFiles(files);
  }catch(err){
    console.error("photo drop error",err);
    setPhotoStatus("드래그앤드롭 처리 오류: "+(err?.message||err),"error");
  }
});

function likelyImageFile(f){
  const type=String(f?.type||"").toLowerCase();
  const name=String(f?.name||"").toLowerCase();
  return type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}
async function makePreviewData(file){
  try{
    return await fileToData(file);
  }catch{
    try{return URL.createObjectURL(file)}catch{return ""}
  }
}

async function addFiles(files){
  const room=8-S.photos.length;
  if(room<=0){
    setPhotoStatus("이미 8장이 들어가 있어. 일부를 지우고 다시 추가해줘.","error");
    return toast("한 번에 최대 8장이야.");
  }

  const accepted=files.filter(likelyImageFile).slice(0,room);
  if(!accepted.length){
    setPhotoStatus("선택은 감지됐는데 이미지 파일을 찾지 못했어.","error");
    return toast("사진 파일을 찾지 못했어.");
  }

  let added=0, skipped=0;
  for(const f of accepted){
    if((f.size||0)>25*1024*1024){
      skipped++;
      continue;
    }

    // 미리보기부터 생성해서 즉시 화면에 보이게 한다.
    const preview=await makePreviewData(f);
    S.photos.push({
      id:uid(),
      name:f.name||`사진 ${S.photos.length+1}`,
      size:f.size||0,
      originalSize:f.size||0,
      file:f,
      preview,
      data:null,
      preparedBytes:0
    });
    added++;
    renderPhotos();
    setPhotoStatus(`${S.photos.length}장 앱에 들어옴 ✅`,"ok");
  }

  imageInput.value="";
  if(!added){
    setPhotoStatus("사진을 넣지 못했어. 파일 용량이나 형식을 확인해줘.","error");
    return toast("추가된 사진이 없어.");
  }

  if(skipped)toast(`${added}장 추가 · 큰 사진 ${skipped}장 제외`);
  else toast(`${added}장 추가됨 📸`);
}
function renderPhotos(){
  const box=$("#photoList");
  box.classList.toggle("hidden",!S.photos.length);
  box.innerHTML=S.photos.map((p,i)=>`
    <div class="photo-item">
      <img src="${p.preview||p.data||""}" alt="선택 사진 ${i+1}">
      <button type="button" data-remove="${p.id}" aria-label="사진 삭제">×</button>
      <span>${i+1}. ${esc(p.name)}</span>
    </div>
  `).join("");

  $$("[data-remove]").forEach(b=>b.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    const found=S.photos.find(p=>p.id===b.dataset.remove);
    if(found?.preview && String(found.preview).startsWith("blob:")){
      try{URL.revokeObjectURL(found.preview)}catch{}
    }
    S.photos=S.photos.filter(p=>p.id!==b.dataset.remove);
    renderPhotos();
  });

  $("#analyzeBtn").disabled=!S.photos.length;
  if(S.photos.length)setPhotoStatus(`${S.photos.length}장 앱에 들어옴 ✅`,"ok");
  else setPhotoStatus("아직 선택된 사진이 없어.");
}

function fileToData(f){
  return new Promise((ok,no)=>{
    const r=new FileReader();
    r.onload=()=>ok(r.result);
    r.onerror=no;
    r.readAsDataURL(f);
  });
}

function loadImageFromFile(file){
  return new Promise(async(ok,no)=>{
    try{
      if("createImageBitmap" in window){
        const bm=await createImageBitmap(file);
        return ok({
          source:bm,
          width:bm.width,
          height:bm.height,
          close:()=>bm.close?.()
        });
      }
    }catch{}

    const url=URL.createObjectURL(file);
    const im=new Image();
    im.onload=()=>ok({
      source:im,
      width:im.naturalWidth||im.width,
      height:im.naturalHeight||im.height,
      close:()=>URL.revokeObjectURL(url)
    });
    im.onerror=()=>{
      URL.revokeObjectURL(url);
      no(Error("이 사진 형식은 브라우저에서 열 수 없어."));
    };
    im.src=url;
  });
}

function canvasToData(canvas,quality=.92){
  return new Promise((ok,no)=>canvas.toBlob(async blob=>{
    if(!blob)return no(Error("이미지 변환 실패"));
    ok({data:await fileToData(blob),bytes:blob.size});
  },"image/jpeg",quality));
}

async function prepareImageForHighDetail(file){
  const type=String(file.type||"").toLowerCase();

  // 이미 작고 API가 직접 받을 수 있는 형식이면 재인코딩하지 않음
  if(/image\/(jpeg|jpg|png|webp)/i.test(type) && file.size<=2400000){
    return {data:await fileToData(file),bytes:file.size};
  }

  let decoded;
  try{
    decoded=await loadImageFromFile(file);
  }catch(e){
    if(/heic|heif/i.test(type+" "+file.name)){
      throw Error("HEIC/HEIF 사진을 이 브라우저가 변환하지 못했어. 갤럭시 카메라의 '고효율 사진'을 잠시 끄고 JPEG로 찍어줘.");
    }
    throw e;
  }

  try{
    const pixels=decoded.width*decoded.height;
    const scale=Math.min(
      1,
      2048/Math.max(decoded.width,decoded.height),
      Math.sqrt(2500000/Math.max(1,pixels))
    );

    const c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(decoded.width*scale));
    c.height=Math.max(1,Math.round(decoded.height*scale));

    const ctx=c.getContext("2d",{alpha:false});
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(decoded.source,0,0,c.width,c.height);

    return await canvasToData(c,.92);
  }finally{
    decoded.close?.();
  }
}

async function prepareSelectedPhotosForApi(){
  for(let i=0;i<S.photos.length;i++){
    const p=S.photos[i];
    if(p.data)continue;

    const pct=5+Math.round(((i+1)/S.photos.length)*20);
    setProgress(
      "analysis",
      pct,
      `사진 준비 ${i+1}/${S.photos.length}`,
      `${p.name}을 AI 전송용으로 준비하고 있어.`
    );

    const prepared=await prepareImageForHighDetail(p.file);
    p.data=prepared.data;
    p.preparedBytes=prepared.bytes;
  }
}

function imageContent(prefix=""){
  const c=[];
  S.photos.forEach((p,i)=>{
    if(!p.data)throw Error(`${p.name} 사진 준비가 끝나지 않았어.`);
    c.push({type:"input_text",text:`${prefix}사진 ${i+1}: ${p.name}`});
    c.push({type:"input_image",image_url:p.data,detail:"high"});
  });
  return c;
}

function extractionPrompt(){
  const source=$("#sourceLabel").value.trim();
  if(S.mode==="passage")return `너는 한국 고등학교 영어 내신/수능 독해 어휘 코치다.
첨부된 여러 장의 원본 사진을 페이지 순서대로 직접 시각적으로 읽어라. 사이트 OCR 결과는 없다.
각 사진의 철자와 문맥을 두 번 대조하고, 확신이 낮은 철자는 추측하지 말고 warnings에 남겨라.
지문 이해와 시험 변형에 중요한 어휘만 골라라. 쉬운 기능어는 제외하고 원문 문장을 길게 복사하지 마라.
출처 라벨: ${source||"(없음)"}
JSON 하나만:
{"title":"자료 제목","summary":"전체 지문 핵심 한국어 1~2문장","items":[{"term":"실제 등장 표제어","meanings":["문맥 핵심 뜻"],"partOfSpeech":"품사","context":"문맥 역할","synonyms":["유용한 동의어"],"antonyms":["필요한 반의어"],"derivatives":["중요 파생형"],"importance":1,"sourceType":"passage","sourceLabel":${JSON.stringify(source)}}],"extraItems":[{"term":"변형 대비 추가어","meanings":["뜻"],"partOfSpeech":"","context":"원 단어와 관계","synonyms":[],"antonyms":[],"derivatives":[],"importance":2,"sourceType":"suggested","sourceLabel":${JSON.stringify(source)}}],"warnings":[]}`;
  return `너는 영어 단어장 사진을 매우 보수적으로 읽는 어휘 추출기다.
첨부된 여러 장의 원본 사진을 직접 시각적으로 읽어 영어 단어/표현과 같은 행/항목의 한국어 뜻을 대응시켜라. 사이트 OCR 결과는 없다.
각 철자와 뜻의 행 대응을 두 번 대조해라. 확신이 낮으면 추측하지 말고 warnings에 남기거나 제외해라.
출처 라벨: ${source||"(없음)"}
JSON 하나만:
{"title":"사진 단어장","summary":"","items":[{"term":"사진 속 영어","meanings":["사진의 한국어 뜻"],"partOfSpeech":"","context":"","synonyms":["확실한 핵심 동의어만"],"antonyms":["확실한 반의어만"],"derivatives":["중요 파생형만"],"importance":1,"sourceType":"wordlist","sourceLabel":${JSON.stringify(source)}}],"extraItems":[{"term":"같이 알면 좋은 추가어","meanings":["뜻"],"partOfSpeech":"","context":"관계","synonyms":[],"antonyms":[],"derivatives":[],"importance":2,"sourceType":"suggested","sourceLabel":${JSON.stringify(source)}}],"warnings":[]}`;
}

function onePassPhotoPrompt(){
  const base=extractionPrompt();
  return `${base}

추가 검증 규칙:
- 사진을 먼저 직접 읽고 각 철자/행 대응을 스스로 재검토한다.
- 그 다음 웹 검색 도구를 딱 한 번의 검증 패스로 사용해서, 특히 철자가 이상하거나 뜻 대응이 의심스러운 항목을 묶어서 확인한다.
- 존재하지 않는 철자, 명백한 오독, 영어-한국어 행이 엇갈린 항목은 수정하거나 제외한다.
- 검색 결과만 믿고 사진과 다른 단어로 바꾸지 마라.
- 최종 JSON에는 corrections 배열과 verificationNote를 추가한다.
- corrections: [{"before":"처음 읽은 값","after":"최종 값","reason":"짧은 이유"}]
- verificationNote는 "원본 재검토 + 웹 검색 검증 완료"로 한다.
- JSON 이외의 텍스트는 출력하지 마라.`;
}
$("#analyzeBtn").onclick=async()=>{
  if(!S.photos.length||!needApi())return;
  const btn=$("#analyzeBtn");
  btn.disabled=true;
  $("#extractPanel").classList.add("hidden");
  startProgress("analysis","사진 준비 중","선택한 사진을 확인하고 있어.",3,91);
  try{
    await prepareSelectedPhotosForApi();
    const total=S.photos.reduce((a,p)=>a+(p.preparedBytes||p.size||0),0);
    if(total>18*1024*1024)throw Error("최적화 후에도 사진 용량이 커. 4장씩 나눠서 해줘.");
    setProgress("analysis",27,"AI로 전송 중",`${S.photos.length}장 준비 완료 · 사진 인식과 검색 검증을 시작해.`);
    const result=await openai({
      model:taskModel("photo"),
      reasoning:{effort:"none"},
      text:{verbosity:"low"},
      max_output_tokens:6500,
      max_tool_calls:1,
      parallel_tool_calls:false,
      tools:[{type:"web_search",search_context_size:"low"}],
      tool_choice:"required",
      input:[{role:"user",content:[{type:"input_text",text:onePassPhotoPrompt()},...imageContent()]}]
    },{prefix:"analysis",timeoutMs:80000,retries:2});
    setProgress("analysis",93,"결과 정리 중","철자와 뜻의 중복·오인식 표시를 정리하고 있어.");
    const usedSearch=(result.output||[]).some(x=>x.type==="web_search_call");
    if(!usedSearch)throw Error("검색 검증이 실행되지 않았어. 다시 시도해줘.");
    S.extracted=parseAIJSON(responseText(result));S.extracted.webVerified=true;renderExtract();bindPickEditors();
    setProgress("analysis",100,"완료","AI 인식 + 웹 검색 검증이 끝났어.");
    stopProgress("analysis");
    setTimeout(()=>$("#analysisStatus").classList.add("hidden"),900);
    $("#extractPanel").classList.remove("hidden");$("#extractPanel").scrollIntoView({behavior:"smooth"});
  }catch(e){
    stopProgress("analysis");setProgress("analysis",0,"실패",e.message);toast(e.message);
  }finally{btn.disabled=false}
};
function relText(x){return [x.synonyms?.length?"동의: "+x.synonyms.join(", "):"",x.antonyms?.length?"반의: "+x.antonyms.join(", "):"",x.derivatives?.length?"파생: "+x.derivatives.join(", "):""].filter(Boolean).join(" · ")}
function pick(x,key,checked){
  return `<div class="pick" data-pickrow="${key}">
    <input type="checkbox" data-pick="${key}" ${checked?"checked":""}>
    <span class="pick-content">
      <b>${esc(x.term||"")}</b>
      <small>${esc((x.meanings||[]).join(", "))}</small>
      ${x.context?`<small>${esc(x.context)}</small>`:""}
      ${relText(x)?`<small>${esc(relText(x))}</small>`:""}
      <div class="pick-editor hidden" data-editor="${key}">
        <input class="input" data-edit-term="${key}" value="${esc(x.term||"")}" placeholder="영어 단어/표현">
        <input class="input" data-edit-meaning="${key}" value="${esc((x.meanings||[]).join(" / "))}" placeholder="한국어 뜻">
        <div class="pick-editor-actions">
          <button type="button" class="save" data-save-edit="${key}">저장</button>
          <button type="button" data-cancel-edit="${key}">취소</button>
        </div>
      </div>
    </span>
    <button type="button" class="pick-edit-btn" data-edit-pick="${key}">수정</button>
  </div>`;
}
function renderExtract(){
  const d=S.extracted||{};$("#extractTitle").textContent=d.title||"검증 결과";$("#summary").textContent=d.summary||"";$("#summary").classList.toggle("hidden",!d.summary);$("#verifyBadge").classList.toggle("hidden",!d.webVerified);
  $("#extractWarnings").innerHTML=(d.warnings||[]).map(x=>"⚠ "+esc(x)).join("<br>");$("#extractWarnings").classList.toggle("hidden",!(d.warnings||[]).length);
  $("#correctionsBox").innerHTML=(d.corrections||[]).map(x=>`수정: <b>${esc(x.before||"")}</b> → <b>${esc(x.after||"")}</b> · ${esc(x.reason||"")}`).join("<br>");$("#correctionsBox").classList.toggle("hidden",!(d.corrections||[]).length);
  $("#mainItems").innerHTML=(d.items||[]).map((x,i)=>pick(x,"m"+i,true)).join("")||`<div class="fine">확실하게 검증된 단어가 없어.</div>`;
  $("#extraItems").innerHTML=(d.extraItems||[]).map((x,i)=>pick(x,"e"+i,false)).join("");$("#extraBlock").classList.toggle("hidden",!(d.extraItems||[]).length);
}
function getExtractItemByKey(key){
  const type=String(key||"").charAt(0);
  const index=Number(String(key||"").slice(1));
  if(!Number.isInteger(index)||index<0)return null;
  if(type==="m")return S.extracted?.items?.[index]||null;
  if(type==="e")return S.extracted?.extraItems?.[index]||null;
  return null;
}
function refreshPickRow(key){
  const row=$(`[data-pickrow="${key}"]`);
  if(!row)return;
  const item=getExtractItemByKey(key);
  if(!item)return;
  const checked=$(`[data-pick="${key}"]`)?.checked??true;
  const wrap=document.createElement("div");
  wrap.innerHTML=pick(item,key,checked);
  row.replaceWith(wrap.firstElementChild);
  bindPickEditors();
}
function bindPickEditors(){
  $$("[data-edit-pick]").forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.editPick;
      $(`[data-editor="${key}"]`)?.classList.toggle("hidden");
    };
  });
  $$("[data-cancel-edit]").forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.cancelEdit;
      $(`[data-editor="${key}"]`)?.classList.add("hidden");
    };
  });
  $$("[data-save-edit]").forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.saveEdit;
      const item=getExtractItemByKey(key);
      if(!item)return;
      const term=$(`[data-edit-term="${key}"]`)?.value.trim()||"";
      const meaningText=$(`[data-edit-meaning="${key}"]`)?.value.trim()||"";
      if(!term)return toast("영어 단어를 입력해줘.");
      if(!meaningText)return toast("한국어 뜻을 입력해줘.");
      const meanings=meaningText.split(/\s*[\/;]\s*/).map(x=>x.trim()).filter(Boolean);
      item.term=term;
      item.meanings=meanings.length?meanings:[meaningText];
      refreshPickRow(key);
      toast("수정 완료 ✏️");
    };
  });
}
$("#selectAll").onclick=()=>$$("[data-pick]").forEach(x=>x.checked=true);
function makeWord(x){
  return {id:uid(),term:String(x.term||"").trim(),meanings:(x.meanings||[]).map(String).filter(Boolean),partOfSpeech:String(x.partOfSpeech||""),context:String(x.context||""),synonyms:x.synonyms||[],antonyms:x.antonyms||[],derivatives:x.derivatives||[],importance:Number(x.importance||2),sourceType:String(x.sourceType||"wordlist"),sourceLabel:String(x.sourceLabel||""),createdAt:now(),dueAt:now(),strength:0,stability:.5,seen:0,correct:0,wrong:0,star:false,goodCount:0,skipCount:0,testEnabled:true};
}
function addWord(x){
  if(!x.term)return false;const old=S.words.find(w=>norm(w.term)===norm(x.term));
  if(old){old.meanings=[...new Set([...(old.meanings||[]),...(x.meanings||[])])];old.synonyms=[...new Set([...(old.synonyms||[]),...(x.synonyms||[])])];old.antonyms=[...new Set([...(old.antonyms||[]),...(x.antonyms||[])])];old.derivatives=[...new Set([...(old.derivatives||[]),...(x.derivatives||[])])];if(!old.context)old.context=x.context||"";return false}
  S.words.push(makeWord(x));return true;
}
$("#savePicked").onclick=()=>{
  const d=S.extracted||{};if(!d.webVerified)return toast("웹 검색 검증이 끝난 결과만 저장할 수 있어.");
  const arr=[];(d.items||[]).forEach((x,i)=>{$(`[data-pick="m${i}"]`)?.checked&&arr.push(x)});(d.extraItems||[]).forEach((x,i)=>{$(`[data-pick="e${i}"]`)?.checked&&arr.push(x)});
  let n=0;arr.forEach(x=>{if(addWord(x))n++});
  S.photos.forEach(p=>{if(p.preview&&String(p.preview).startsWith("blob:")){try{URL.revokeObjectURL(p.preview)}catch{}}});
  save();toast(`${n}개 새로 저장`);S.photos=[];renderPhotos();show("home");
};

/* Today words — v0.5: 15개 캐시 후 5개씩 즉시 표시 */
function saveTodayCache(){
  localStorage.setItem(K_TODAY_CACHE,JSON.stringify({date:new Date().toISOString().slice(0,10),queue:S.todayQueue,display:S.todayWords}));
}
function todayPrompt(){
  const current=S.words.slice(-100).map(w=>({term:w.term,meaning:w.meanings?.[0]||"",strength:w.strength||0,wrong:w.wrong||0}));
  const exclude=[...new Set([...S.words.map(w=>w.term),...S.todaySeen,...S.todayQueue.map(x=>x.term),...S.todayWords.map(x=>x.term)])].slice(-350);
  return `한국 고등학생의 수능/평가원·교육청 모의고사 영어 독해 어휘 코치다.
웹 검색을 한 번 사용해 KICE/평가원, EBS, 교육자료, 신뢰 가능한 영어 사전 등에서 수능·모의고사 독해에 실제로 유용한 어휘인지 확인한다.
학생의 현재 단어장과 연결 학습이 되는 어휘도 포함한다.
총 15개를 고른다:
- 약 5개: 현재 학습 단어와 동의어/반의어/파생어/혼동어로 연결되는 단어
- 약 10개: 수능·모의고사 독해에서 폭넓게 알아둘 가치가 큰 학술·추상 어휘
이미 단어장에 있거나 제외 목록에 있는 단어는 절대 넣지 않는다.
'공식 출제 빈도 순위'처럼 근거 없는 표현은 쓰지 않는다.
현재 학습:${JSON.stringify(current)}
제외:${JSON.stringify(exclude)}
JSON 하나만 출력:
{"items":[{"term":"영어 표제어","meanings":["독해 핵심 한국어 뜻"],"partOfSpeech":"품사","context":"독해에서 어떻게 이해하면 되는지","synonyms":["핵심 동의어"],"antonyms":["필요한 반의어"],"derivatives":["중요 파생형"],"importance":1,"sourceType":"today","sourceLabel":"오늘의 단어","origin":"linked|exam","reason":"추천 이유"}],"note":"웹 검색 검증 완료"}`;
}
function showFiveFromTodayQueue(){
  const take=S.todayQueue.splice(0,5);
  if(!take.length)return false;
  S.todayWords.push(...take);S.todaySeen.push(...take.map(x=>x.term));save();saveTodayCache();renderToday();$("#moreTodayBtn").classList.remove("hidden");return true;
}
async function fetchTodayBatch(){
  startProgress("today","웹 검색 시작","15개를 한 번 받아서 이후 5개씩 빠르게 보여줄게.",7,90);
  setProgress("today",16,"내 단어장 비교 중","이미 외우는 단어와 중복되지 않게 정리하고 있어.");
  const d=await openai({
    model:taskModel("fast"),
    reasoning:{effort:"none"},
    text:{verbosity:"low"},
    max_output_tokens:3600,
    max_tool_calls:1,
    parallel_tool_calls:false,
    tools:[{type:"web_search",search_context_size:"low"}],
    tool_choice:"required",
    input:todayPrompt()
  },{prefix:"today",timeoutMs:55000,retries:2});
  setProgress("today",92,"추천 목록 정리 중","중복과 이미 외우는 단어를 한 번 더 제거하고 있어.");
  if(!(d.output||[]).some(x=>x.type==="web_search_call"))throw Error("웹 검색이 실행되지 않았어.");
  const j=parseAIJSON(responseText(d));
  const fresh=(j.items||[]).filter(x=>x.term&&!S.todaySeen.some(t=>norm(t)===norm(x.term))&&!S.words.some(w=>norm(w.term)===norm(x.term))&&!S.todayQueue.some(w=>norm(w.term)===norm(x.term)));
  S.todayQueue.push(...fresh);saveTodayCache();
}
async function loadToday(){
  if(S.todayQueue.length>=5){
    showFiveFromTodayQueue();toast("캐시에서 바로 5개 불러왔어 ⚡");return;
  }
  if(!needApi())return;
  $("#loadTodayBtn").disabled=true;$("#moreTodayBtn").disabled=true;
  try{
    await fetchTodayBatch();
    if(!S.todayQueue.length)throw Error("새 추천 단어를 충분히 찾지 못했어. 한 번 더 눌러줘.");
    showFiveFromTodayQueue();
    setProgress("today",100,"완료",`5개 표시 완료 · 다음 ${Math.min(10,S.todayQueue.length)}개는 미리 받아뒀어.`);
    stopProgress("today");setTimeout(()=>$("#todayStatus").classList.add("hidden"),1100);
  }catch(e){stopProgress("today");setProgress("today",0,"불러오기 실패",e.message);toast(e.message)}
  finally{$("#loadTodayBtn").disabled=false;$("#moreTodayBtn").disabled=false}
}
$("#loadTodayBtn").onclick=loadToday;$("#moreTodayBtn").onclick=loadToday;
function renderToday(){
  $("#todayList").innerHTML=S.todayWords.map((x,i)=>`<div class="today-card"><div class="topline"><div><h3>${esc(x.term)}</h3><div class="meaning">${esc((x.meanings||[]).join(" · "))}</div></div><span class="source-tag">${x.origin==="linked"?"내 단어 연결":"시험 독해"}</span></div><p>${esc(x.reason||x.context||"")}</p>${relText(x)?`<p>${esc(relText(x))}</p>`:""}<div class="today-actions"><button data-today-add="${i}">＋ 단어장 추가</button><button data-today-star="${i}">★ 추가+즐겨찾기</button></div></div>`).join("");
  $$("[data-today-add]").forEach(b=>b.onclick=()=>{const x=S.todayWords[+b.dataset.todayAdd];const added=addWord(x);save();toast(added?"단어장에 추가":"이미 단어장에 있어")});
  $$("[data-today-star]").forEach(b=>b.onclick=()=>{const x=S.todayWords[+b.dataset.todayStar];addWord(x);const w=S.words.find(w=>norm(w.term)===norm(x.term));if(w)w.star=true;save();toast("추가 + 즐겨찾기 완료")});
}

/* review */
function interval(w,g){if(g==="again"){w.strength=Math.max(0,(w.strength||0)-1);w.stability=Math.max(.3,(w.stability||.5)*.55);return 5*60000}if(g==="hard"){w.strength=Math.max(1,w.strength||0);w.stability=Math.min(90,(w.stability||.5)*1.45);return Math.max(30*60000,day(w.stability*.45))}w.strength=Math.min(6,(w.strength||0)+1);w.stability=Math.min(180,(w.stability||.5)*(2.05+w.strength*.08));return day(Math.max(1,w.stability))}
function applyMemory(w,g){
  studyTouch();markReviewed(w);w.seen=(w.seen||0)+1;if(w.goodCount===undefined)w.goodCount=0;if(w.testEnabled===undefined)w.testEnabled=true;
  if(g==="again")w.wrong=(w.wrong||0)+1;
  if(g==="good"){
    rewardRecord("review",w.id);
    w.correct=(w.correct||0)+1;
    w.goodCount++;
    w.skipCount=Math.max(0,(w.skipCount||0)-1);
    if(w.goodCount>=2){
      if(w.testEnabled!==false)w.testEnabled=false;

      // 같은 세션에서 '넘김' 가중치 때문에 미리 복제된 동일 단어도 즉시 제거.
      // 현재 인덱스 이전은 유지하고, 이후에 남은 동일 id만 삭제한다.
      if(Array.isArray(S.reviewQueue)){
        const currentIndex=S.reviewIndex;
        S.reviewQueue=S.reviewQueue.filter((item,idx)=>idx<=currentIndex || item.id!==w.id);
      }

      toast(`✅ ${w.term}: 앎 2회 → 암기·시험 졸업`);
    }
  }
  w.dueAt=now()+interval(w,g);save();
}
function startReview(shuf=false){
  if(!S.words.length){
    $("#reviewEmpty").classList.remove("hidden");
    $("#reviewArea").classList.add("hidden");
    $("#reviewEmpty h3").textContent="외울 단어가 없어";
    $("#reviewEmpty p").textContent="하단 ＋에서 사진이나 단어를 추가해줘.";
    return;
  }

  const availableForReview=S.words.filter(w=>(w.goodCount||0)<2);
  if(!availableForReview.length && !(Array.isArray(S.reviewPreset)&&S.reviewPreset.length)){
    $("#reviewEmpty").classList.remove("hidden");
    $("#reviewArea").classList.add("hidden");
    $("#reviewEmpty h3").textContent="현재 암기할 단어가 없어";
    $("#reviewEmpty p").textContent="‘앎’ 2회가 된 단어는 암기에서 졸업했어. 보관함에서 ‘시험 넣기’를 누르면 다시 시작할 수 있어.";
    return;
  }

  $("#reviewEmpty").classList.add("hidden");
  $("#reviewArea").classList.remove("hidden");

  let base;
  if(Array.isArray(S.reviewPreset)&&S.reviewPreset.length){
    base=S.reviewPreset
      .map(id=>S.words.find(w=>w.id===id))
      .filter(w=>w&&(w.goodCount||0)<2);
    S.reviewPreset=null;
  }else{
    const reviewable=S.words.filter(w=>(w.goodCount||0)<2);
    const due=reviewable
      .filter(w=>(w.dueAt||0)<=now())
      .sort((a,b)=>weakness(b)-weakness(a));
    base=due.length?due:[...reviewable].sort((a,b)=>weakness(b)-weakness(a));
  }

  // 시험에서 넘긴 단어는 같은 암기 세션 안에서도 1~2회 더 등장.
  const weighted=[];
  for(const w of base){
    weighted.push(w);
    const extra=Math.min(2,w.skipCount||0);
    for(let i=0;i<extra;i++)weighted.push(w);
  }

  // 기본 우선순위는 유지하되 사용자가 '섞기'를 누른 경우에만 전체 셔플.
  S.reviewQueue=shuf?shuffle(weighted):weighted;
  S.reviewIndex=0;
  renderReview();
}
$("#shuffleBtn").onclick=()=>startReview(true);
function speakEnglish(text){
  if(!text||!("speechSynthesis" in window))return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-US";
    u.rate=.84;
    speechSynthesis.speak(u);
  }catch{}
}
function renderReview(){
  if(S.reviewIndex>=S.reviewQueue.length){toast("이번 암기 끝 ✨");show("home");return}
  const w=S.reviewQueue[S.reviewIndex];S.reviewFlipped=false;$("#reviewProgress").style.width=`${(S.reviewIndex+1)/S.reviewQueue.length*100}%`;$("#reviewTag").textContent=w.sourceType==="passage"?"PASSAGE":w.sourceType==="today"?"TODAY":w.sourceType==="suggested"?"EXTRA":"WORD";$("#reviewTerm").textContent=w.term;$("#reviewPOS").textContent=w.partOfSpeech||"";$("#reviewMeaning").textContent=w.meanings.join(" · ");$("#reviewContext").textContent=w.context||"";$("#reviewBack").classList.add("hidden");$("#memoryBtns").classList.add("hidden");$("#tapHint").classList.remove("hidden");const rel=[];(w.synonyms||[]).forEach(x=>rel.push(`<span class="rel">≈ ${esc(x)}</span>`));(w.antonyms||[]).forEach(x=>rel.push(`<span class="rel">↔ ${esc(x)}</span>`));(w.derivatives||[]).forEach(x=>rel.push(`<span class="rel">↗ ${esc(x)}</span>`));$("#relations").innerHTML=rel.join("");$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요";
  setTimeout(()=>speakEnglish(w.term),90);
}
$("#flash").onclick=()=>{S.reviewFlipped=!S.reviewFlipped;$("#reviewBack").classList.toggle("hidden",!S.reviewFlipped);$("#memoryBtns").classList.toggle("hidden",!S.reviewFlipped);$("#tapHint").classList.toggle("hidden",S.reviewFlipped)};
$$("[data-memory]").forEach(b=>b.onclick=e=>{e.stopPropagation();applyMemory(S.reviewQueue[S.reviewIndex],b.dataset.memory);S.reviewIndex++;renderReview()});
$("#speakBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(w)speakEnglish(w.term)};
$("#starBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(!w)return;w.star=!w.star;save();$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요"};
let touch=null;$("#flash").addEventListener("touchstart",e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY}},{passive:true});$("#flash").addEventListener("touchend",e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){if(dx<0&&S.reviewIndex<S.reviewQueue.length-1){S.reviewIndex++;renderReview()}else if(dx>0&&S.reviewIndex>0){S.reviewIndex--;renderReview()}}else if(dy<-90&&S.reviewFlipped){applyMemory(S.reviewQueue[S.reviewIndex],"good");S.reviewIndex++;renderReview()}},{passive:true});

/* test */
$$(".test-mode").forEach(b=>b.onclick=()=>{$$(".test-mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.testMode=b.dataset.test;startTest()});
$("#restartTest").onclick=startTest;
$("#clearTestSource").onclick=()=>{S.testSource=null;startTest()};

function startTest(){
  $("#testSourceBanner").classList.toggle("hidden",!S.testSource);
  $("#testSourceName").textContent=S.testSource||"";

  let eligible=S.words.filter(w=>w.testEnabled!==false);
  if(S.testSource)eligible=eligible.filter(w=>sourceKey(w)===S.testSource);

  if(!eligible.length){
    $("#testEmpty").classList.remove("hidden");
    $("#testArea").classList.add("hidden");
    $("#testEmptyTitle").textContent="테스트 목록이 비어 있어";
    $("#testEmptyText").textContent="시험졸업 단어는 보관함에서 ‘시험 넣기’를 누르면 다시 출제할 수 있어.";
    return;
  }

  $("#testEmpty").classList.add("hidden");
  $("#testArea").classList.remove("hidden");

  // 시험졸업이 아닌 단어는 전부 한 번씩 본다.
  // 취약 단어를 앞쪽에 두고, 나머지만 섞는다.
  const ordered=[...eligible].sort((a,b)=>weakness(b)-weakness(a));
  const priority=ordered.slice(0,Math.min(8,ordered.length));
  const rest=shuffle(ordered.slice(priority.length));
  S.testQueue=[...priority,...rest];
  S.testIndex=0;
  S.testCorrect=0;
  renderTest();
}
function renderTest(){
  if(S.testIndex>=S.testQueue.length){toast(`테스트 완료 ${S.testCorrect}/${S.testQueue.length}`);show("home");return}
  const w=S.testQueue[S.testIndex];$("#testNo").textContent=`${S.testIndex+1} / ${S.testQueue.length}`;$("#testScore").textContent=`${S.testCorrect} correct`;
  if(S.testMode==="meaning"){$("#promptLabel").textContent="이 단어의 뜻은?";$("#question").textContent=w.term;$("#answer").placeholder="한국어 뜻 입력"}else{$("#promptLabel").textContent="이 뜻의 영어 단어는?";$("#question").textContent=w.meanings[0]||"";$("#answer").placeholder="영어 단어 입력"}
  $("#answer").value="";
  $("#answer").disabled=false;
  $("#gradeBtn").disabled=false;
  $("#skipBtn").disabled=false;
  $("#graduateBtn").disabled=false;
  $("#gradeBtn").textContent="채점하기";
  $("#resultBox").className="result hidden";
  $("#nextBtn").classList.add("hidden");
  S.lastGrade=null;
  if(S.testMode==="meaning")setTimeout(()=>speakEnglish(w.term),100);
}
$("#answer").onkeydown=e=>{if(e.key==="Enter"){if($("#nextBtn").classList.contains("hidden"))$("#gradeBtn").click();else $("#nextBtn").click()}};
$("#gradeBtn").onclick=async()=>{
  const w=S.testQueue[S.testIndex],a=$("#answer").value.trim();
  if(!a)return toast("답을 먼저 입력해줘.");
  const btn=$("#gradeBtn");
  btn.disabled=true;
  $("#skipBtn").disabled=true;
  $("#graduateBtn").disabled=true;
  btn.textContent="채점 중…";
  try{
    let d;if(S.testMode==="reverse"){const ok=norm(a)===norm(w.term);d={verdict:ok?"correct":"wrong",reason:ok?"철자가 일치해.":`정답은 ${w.term}`,acceptedMeaning:w.term}}
    else{
      const exact=[...(w.meanings||[])].some(m=>{const x=norm(m),y=norm(a);return x===y||(x.length>=2&&y.length>=2&&(x.includes(y)||y.includes(x)))});
      if(exact)d={verdict:"correct",reason:"등록된 핵심 의미와 직접 일치해.",acceptedMeaning:w.meanings[0]||""};
      else{if(!needApi())throw Error("AI 연결 필요");const prompt=`영어 뜻 테스트를 한국 고등학생 독해 기준으로 채점하라.
단어:${w.term}
등록 뜻:${JSON.stringify(w.meanings)}
문맥:${w.context||"(없음)"}
학생 답:${a}
사전 표현과 달라도 실제 독해에서 핵심 의미 파악에 지장이 없으면 correct, 방향은 맞지만 오해 가능하면 almost, 다른 뜻이면 wrong.
JSON 하나만:{"verdict":"correct"|"almost"|"wrong","reason":"한국어 한 문장","acceptedMeaning":"핵심 뜻"}`;d=parseAIJSON(responseText(await openai({model:taskModel("fast"),reasoning:{effort:"none"},text:{verbosity:"low"},max_output_tokens:350,input:prompt},{timeoutMs:30000,retries:1})))}
    }
    const v=d.verdict||"wrong",ok=v==="correct";markReviewed(w);if(ok){rewardRecord("test",w.id);S.testCorrect++;S.meta.correct++;w.correct=(w.correct||0)+1;w.dueAt=now()+interval(w,"good")}else{S.meta.wrong++;w.wrong=(w.wrong||0)+1;w.dueAt=now()+interval(w,v==="almost"?"hard":"again")}w.seen=(w.seen||0)+1;studyTouch();save();S.lastGrade={answer:a,verdict:v};const labels={correct:"정답 ✅",almost:"거의 맞음 △",wrong:"오답 ✕"};$("#resultBox").className=`result ${v}`;$("#resultBox").innerHTML=`<b>${labels[v]}</b><br>${esc(d.reason||"")}<br><small>핵심 뜻: ${esc(d.acceptedMeaning||w.meanings[0]||w.term)}</small>`;$("#answer").disabled=true;$("#graduateBtn").disabled=false;$("#nextBtn").classList.remove("hidden");
  }catch(e){
    toast(e.message);
    btn.disabled=false;
    $("#skipBtn").disabled=false;
    $("#graduateBtn").disabled=false;
    btn.textContent="채점하기";
  }
};
$("#graduateBtn").onclick=()=>{
  const w=S.testQueue[S.testIndex];
  if(!w)return;

  w.testEnabled=false;
  w.goodCount=Math.max(2,w.goodCount||0);
  markReviewed(w);
  save();

  toast(`🎓 ${w.term}: 암기·시험 졸업`);
  S.testIndex++;
  renderTest();
};

$("#skipBtn").onclick=()=>{
  const w=S.testQueue[S.testIndex];
  if(!w)return;

  markReviewed(w);
  w.skipCount=(w.skipCount||0)+1;
  w.seen=(w.seen||0)+1;

  // 넘기기는 오답률에는 포함하지 않지만,
  // 기억이 약한 것으로 판단해 복습 우선순위를 강하게 높인다.
  w.strength=Math.max(0,(w.strength||0)-1);
  w.stability=Math.max(.25,(w.stability||.5)*.65);
  w.dueAt=now();
  w.testEnabled=true;

  studyTouch();
  save();

  toast(`↪ ${w.term}: 암기에서 더 자주 보여줄게`);
  S.testIndex++;
  renderTest();
};

$("#nextBtn").onclick=()=>{S.testIndex++;renderTest()};


/* school-exam transformation mode */
function relationForType(w,type){
  if(type==="synonym")return w.synonyms||[];
  if(type==="antonym")return w.antonyms||[];
  if(type==="derivative")return w.derivatives||[];
  return [];
}
function availableTransformTypes(w){
  const a=[];
  if((w.synonyms||[]).length)a.push("synonym");
  if((w.antonyms||[]).length)a.push("antonym");
  if((w.derivatives||[]).length)a.push("derivative");
  return a;
}
function buildTransformQueue(){
  let words=S.words.filter(w=>availableTransformTypes(w).length);
  if(S.transformSource)words=words.filter(w=>sourceKey(w)===S.transformSource);
  const qs=[];
  for(const w of shuffle(words)){
    let types=availableTransformTypes(w);
    if(S.transformType!=="mixed")types=types.filter(t=>t===S.transformType);
    if(!types.length)continue;
    const type=types[Math.floor(Math.random()*types.length)];
    const rel=relationForType(w,type);
    if(!rel.length)continue;
    const correct=rel[Math.floor(Math.random()*rel.length)];
    const pool=[];
    for(const other of words){
      if(other.id===w.id)continue;
      pool.push(...relationForType(other,type));
      pool.push(other.term);
    }
    const distractors=shuffle([...new Set(pool.filter(x=>norm(x)!==norm(correct)&&norm(x)!==norm(w.term)))]);
    const options=shuffle([correct,...distractors.slice(0,3)]);
    while(options.length<4){
      const filler=S.words.find(x=>!options.some(o=>norm(o)===norm(x.term))&&norm(x.term)!==norm(w.term));
      if(!filler)break;
      options.push(filler.term);
    }
    qs.push({wordId:w.id,type,correct,options:shuffle([...new Set(options)]).slice(0,4)});
    if(qs.length>=12)break;
  }
  return qs;
}
function transformTypeLabel(type){
  return type==="synonym"?"동의어":type==="antonym"?"반의어":"파생어";
}
function transformQuestionText(w,type){
  if(type==="synonym")return `“${w.term}”와 의미가 가장 가까운 것은?`;
  if(type==="antonym")return `“${w.term}”와 의미가 가장 반대인 것은?`;
  return `“${w.term}”의 파생형으로 가장 적절한 것은?`;
}
$$(".transform-type").forEach(b=>b.onclick=()=>{
  $$(".transform-type").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  S.transformType=b.dataset.transformType;
  startTransform();
});
$("#restartTransform").onclick=startTransform;
$("#clearTransformSource").onclick=()=>{S.transformSource=null;startTransform()};
function startTransform(){
  $("#transformSourceBanner").classList.toggle("hidden",!S.transformSource);
  $("#transformSourceName").textContent=S.transformSource||"";
  S.transformQueue=buildTransformQueue();
  S.transformIndex=0;
  S.transformCorrect=0;
  if(!S.transformQueue.length){
    $("#transformEmpty").classList.remove("hidden");
    $("#transformArea").classList.add("hidden");
    return;
  }
  $("#transformEmpty").classList.add("hidden");
  $("#transformArea").classList.remove("hidden");
  renderTransform();
}
function renderTransform(){
  if(S.transformIndex>=S.transformQueue.length){
    toast(`변형어 모드 완료 ${S.transformCorrect}/${S.transformQueue.length}`);
    renderReport();
    show("report");
    return;
  }
  const q=S.transformQueue[S.transformIndex],w=S.words.find(x=>x.id===q.wordId);
  $("#transformNo").textContent=`${S.transformIndex+1} / ${S.transformQueue.length}`;
  $("#transformScore").textContent=`${S.transformCorrect} correct`;
  $("#transformKind").textContent=transformTypeLabel(q.type);
  $("#transformPrompt").textContent=transformQuestionText(w,q.type);
  $("#transformOptions").innerHTML=q.options.map(o=>`<button class="transform-option" data-transform-answer="${esc(o)}">${esc(o)}</button>`).join("");
  $("#transformExplain").className="result hidden";
  $("#transformNextBtn").classList.add("hidden");
  $("#transformSkipBtn").disabled=false;
  $$("[data-transform-answer]").forEach(btn=>btn.onclick=()=>gradeTransform(btn.dataset.transformAnswer));
}
function gradeTransform(answer){
  const q=S.transformQueue[S.transformIndex],w=S.words.find(x=>x.id===q.wordId);
  if(!w)return;
  const ok=norm(answer)===norm(q.correct);
  markReviewed(w);
  if(ok){
    rewardRecord("transform",`${w.id}:${q.type}`);
    S.transformCorrect++;
    S.meta.transformCorrect=(S.meta.transformCorrect||0)+1;
    w.correct=(w.correct||0)+1;
  }else{
    S.meta.transformWrong=(S.meta.transformWrong||0)+1;
    w.wrong=(w.wrong||0)+1;
    w.dueAt=now();
  }
  studyTouch();save();
  $$("[data-transform-answer]").forEach(b=>{
    b.disabled=true;
    if(norm(b.dataset.transformAnswer)===norm(q.correct))b.classList.add("correct");
    else if(norm(b.dataset.transformAnswer)===norm(answer)&&!ok)b.classList.add("wrong");
  });
  $("#transformExplain").className=`result ${ok?"correct":"wrong"}`;
  $("#transformExplain").innerHTML=`<b>${ok?"정답 ✅":"오답 ✕"}</b><br>${esc(w.term)} → ${transformTypeLabel(q.type)}: <b>${esc(q.correct)}</b>`;
  $("#transformNextBtn").classList.remove("hidden");
  $("#transformSkipBtn").disabled=true;
}
$("#transformSkipBtn").onclick=()=>{
  const q=S.transformQueue[S.transformIndex],w=S.words.find(x=>x.id===q.wordId);
  if(w){
    markReviewed(w);
    w.skipCount=(w.skipCount||0)+1;
    w.dueAt=now();
    w.testEnabled=true;
    studyTouch();save();
  }
  toast("넘긴 단어는 걷기 암기에서 더 자주 나와.");
  S.transformIndex++;
  renderTransform();
};
$("#transformNextBtn").onclick=()=>{S.transformIndex++;renderTransform()};

/* source decks */
function renderSources(){
  const groups=sourceGroups();
  const box=$("#sourceGroups");
  if(!groups.length){
    box.innerHTML=`<div class="empty-state"><div class="big-ico">🗂️</div><h3>아직 묶을 단어가 없어</h3><p>사진 추가나 직접 입력에서 출처 이름을 적으면 자동으로 지문별로 묶여.</p></div>`;
    return;
  }
  box.innerHTML=groups.map(([name,words])=>{
    const ready=Math.round(avg(words,wordReadiness));
    const risk=words.filter(w=>weakness(w)>=60).length;
    const graduated=words.filter(w=>w.testEnabled===false).length;
    const encoded=encodeURIComponent(name);
    return `<div class="source-card">
      <div class="source-card-head">
        <div><h3>${esc(name)}</h3><p>위험 ${risk}개 · 시험 졸업 ${graduated}개 · 준비도 ${ready}%</p></div>
        <span class="source-count">${words.length} words</span>
      </div>
      <div class="source-mini-progress"><span style="width:${ready}%"></span></div>
      <div class="source-actions">
        <button data-source-test="${encoded}">⚡ 이 지문만 시험</button>
        <button data-source-transform="${encoded}">🔁 이 지문 변형어</button>
      </div>
    </div>`;
  }).join("");
  $$("[data-source-test]").forEach(b=>b.onclick=()=>{
    S.testSource=decodeURIComponent(b.dataset.sourceTest);
    show("test");
  });
  $$("[data-source-transform]").forEach(b=>b.onclick=()=>{
    S.transformSource=decodeURIComponent(b.dataset.sourceTransform);
    show("transform");
  });
}

/* study report */
function editDistance(a,b){
  a=norm(a);b=norm(b);
  const dp=Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let prev=dp[0];dp[0]=i;
    for(let j=1;j<=b.length;j++){
      const tmp=dp[j];
      dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
      prev=tmp;
    }
  }
  return dp[b.length];
}
function confusionCandidates(){
  const arr=[];
  for(let i=0;i<S.words.length;i++){
    for(let j=i+1;j<S.words.length;j++){
      const a=S.words[i],b=S.words[j];
      if(a.term.length<4||b.term.length<4)continue;
      const d=editDistance(a.term,b.term);
      const prefix=norm(a.term).slice(0,3)===norm(b.term).slice(0,3);
      if(d===1||(prefix&&d<=2)){
        arr.push({a,b,d,risk:weakness(a)+weakness(b)});
      }
    }
  }
  return arr.sort((x,y)=>y.risk-x.risk).slice(0,6);
}
function renderReport(){
  const total=S.words.length;
  const readiness=total?Math.round(avg(S.words,wordReadiness)):0;
  const mastered=S.words.filter(w=>w.testEnabled===false).length;
  const risk=S.words.filter(w=>weakness(w)>=60).length;
  const sevenDays=now()-day(7);
  const recent=S.words.filter(w=>(w.lastReviewedAt||w.createdAt||0)>=sevenDays).length;
  const tries=(S.meta.correct||0)+(S.meta.wrong||0);
  const accuracy=tries?Math.round((S.meta.correct||0)/tries*100)+"%":"-";

  $("#readinessPct").textContent=readiness;
  $("#readinessRingText").textContent=readiness+"%";
  $("#readinessRing").style.setProperty("--pct",readiness);
  $("#reportMastered").textContent=mastered;
  $("#reportRisk").textContent=risk;
  $("#reportRecent").textContent=recent;
  $("#reportAccuracy").textContent=accuracy;

  const danger=[...S.words].sort((a,b)=>weakness(b)-weakness(a)).slice(0,8);
  $("#dangerWords").innerHTML=danger.length?danger.map(w=>`<div class="report-row">
    <div class="main"><b>${esc(w.term)}</b><small>${esc((w.meanings||[]).join(", "))} · 넘김 ${w.skipCount||0} · 오답 ${w.wrong||0}</small></div>
    <span class="risk-pill">위험 ${weakness(w)}</span>
  </div>`).join(""):`<div class="fine">아직 분석할 단어가 없어.</div>`;

  const pairs=confusionCandidates();
  $("#confusionPairs").innerHTML=pairs.length?pairs.map(x=>`<div class="report-row">
    <div class="main"><b>${esc(x.a.term)} ↔ ${esc(x.b.term)}</b><small>${esc(x.a.meanings?.[0]||"")} / ${esc(x.b.meanings?.[0]||"")}</small></div>
    <span class="risk-pill">주의</span>
  </div>`).join(""):`<div class="fine">철자가 비슷한 단어쌍이 아직 없어.</div>`;

  const groups=sourceGroups();
  $("#sourceReadiness").innerHTML=groups.length?groups.slice(0,8).map(([name,words])=>{
    const r=Math.round(avg(words,wordReadiness));
    return `<div class="report-row">
      <div class="main"><b>${esc(name)}</b><small>${words.length}개 단어</small></div>
      <span class="${r>=70?"ready-pill":"risk-pill"}">${r}%</span>
    </div>`;
  }).join(""):`<div class="fine">출처별 데이터가 아직 없어.</div>`;
}
$("#quickStudyBtn").onclick=()=>{
  const pool=[...S.words]
    .filter(w=>w.testEnabled!==false||weakness(w)>=45)
    .sort((a,b)=>weakness(b)-weakness(a))
    .slice(0,12);
  if(!pool.length)return toast("복습할 단어가 없어.");
  S.reviewPreset=pool.map(w=>w.id);
  toast(`위험 단어 ${pool.length}개로 10분 집중 시작`);
  show("review");
};

/* library */
function renderLibrary(){
  const q=norm($("#search").value);let arr=S.words.filter(w=>!q||norm(w.term).includes(q)||norm(w.meanings.join(" ")).includes(q));
  if(S.filter==="star")arr=arr.filter(w=>w.star);if(S.filter==="wrong")arr=arr.filter(w=>(w.wrong||0)>0);if(S.filter==="passage")arr=arr.filter(w=>w.sourceType==="passage");if(S.filter==="test")arr=arr.filter(w=>w.testEnabled!==false);if(S.filter==="graduated")arr=arr.filter(w=>w.testEnabled===false);
  $("#libraryList").innerHTML=arr.length?arr.map(w=>{const enabled=w.testEnabled!==false;return `<div class="word-row"><div class="word-main"><b>${esc(w.term)} ${w.star?"★":""}<span class="test-badge ${enabled?"":"off"}">${enabled?"시험중":"시험졸업"}</span></b><small>${esc(w.meanings.join(", "))}</small><small>${esc(w.sourceLabel||w.sourceType)} · 앎 ${w.goodCount||0}/2 · 넘김 ${w.skipCount||0} · 맞음 ${w.correct||0} / 틀림 ${w.wrong||0}</small></div><div class="word-btns"><button class="test-toggle ${enabled?"":"off"}" data-testtoggle="${w.id}">${enabled?"시험 빼기":"시험 넣기"}</button><button data-star="${w.id}">${w.star?"★":"☆"}</button><button data-del="${w.id}">✕</button></div></div>`}).join(""):`<div class="empty-state"><div class="big-ico">📚</div><h3>단어 없음</h3></div>`;
  $$("[data-star]").forEach(b=>b.onclick=()=>{const w=S.words.find(x=>x.id===b.dataset.star);w.star=!w.star;save();renderLibrary()});
  $$("[data-testtoggle]").forEach(b=>b.onclick=()=>{const w=S.words.find(x=>x.id===b.dataset.testtoggle);if(w.testEnabled===false){w.testEnabled=true;w.goodCount=0;w.dueAt=now();toast(`${w.term} → 시험·암기에 다시 추가`)}else{w.testEnabled=false;toast(`${w.term} → 시험에서 제외`)}save();renderLibrary()});
  $$("[data-del]").forEach(b=>b.onclick=()=>{S.words=S.words.filter(x=>x.id!==b.dataset.del);save();renderLibrary()});
}
$("#search").oninput=renderLibrary;$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.filter=b.dataset.filter;renderLibrary()});
$("#exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify({version:4,words:S.words,meta:S.meta,todaySeen:S.todaySeen},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`VocabWalk-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
$("#importFile").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.words))throw Error("올바른 백업이 아니야.");S.words=d.words;S.meta=d.meta||S.meta;S.todaySeen=d.todaySeen||S.todaySeen;migrate();save();renderLibrary();toast(`${S.words.length}개 복원`)}catch(err){toast(err.message)}};
$("#clearBtn").onclick=()=>{if(confirm("정말 모든 단어와 학습 기록을 삭제할까?")){S.words=[];S.meta={correct:0,wrong:0,lastStudy:null,streak:0};S.todaySeen=[];save();renderLibrary();toast("전체 삭제 완료")}};

$("#sampleBtn").onclick=()=>{const a=[{term:"reinforce",meanings:["강화하다","보강하다"],partOfSpeech:"v.",synonyms:["strengthen","bolster"],antonyms:["weaken"],derivatives:["reinforcement"],sourceType:"sample",sourceLabel:"샘플"},{term:"undermine",meanings:["약화시키다","훼손하다"],partOfSpeech:"v.",synonyms:["weaken","impair"],sourceType:"sample",sourceLabel:"샘플"},{term:"compelling",meanings:["설득력 있는","매우 흥미로운"],partOfSpeech:"adj.",synonyms:["convincing","persuasive"],sourceType:"sample",sourceLabel:"샘플"}];let n=0;a.forEach(x=>{if(addWord(x))n++});save();toast(`샘플 ${n}개 추가`)};

/* PWA install */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});
$("#installBtn").onclick=()=>{const ua=navigator.userAgent;let guide;if(/iPhone|iPad|iPod/i.test(ua))guide="iPhone/iPad: 브라우저의 <b>공유 버튼</b> → <b>홈 화면에 추가</b> → 추가.";else guide="Android: 브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러. 설치 버튼이 지원되면 아래 버튼도 사용할 수 있어.";$("#installGuide").innerHTML=guide;$("#nativeInstallBtn").classList.toggle("hidden",!deferredPrompt);$("#installModal").classList.remove("hidden")};
$("#closeInstallBtn").onclick=()=>$("#installModal").classList.add("hidden");
$("#nativeInstallBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installModal").classList.add("hidden")};

function migrate(){
  for(const w of S.words){
    if(w.testEnabled===undefined)w.testEnabled=true;
    if(w.goodCount===undefined)w.goodCount=0;
    if(w.skipCount===undefined)w.skipCount=0;
    if(w.lastReviewedAt===undefined)w.lastReviewedAt=0;
    if(!Array.isArray(w.synonyms))w.synonyms=[];
    if(!Array.isArray(w.antonyms))w.antonyms=[];
    if(!Array.isArray(w.derivatives))w.derivatives=[];
  }
}
migrate();ensureRewardDay();saveReward();save();saveTodayCache();renderToday();renderRewardStrip();if(S.apiKey)$("#apiDot").classList.add("on");else setTimeout(()=>$("#apiModal").classList.remove("hidden"),350);
if("serviceWorker"in navigator){
  window.addEventListener("load",async()=>{
    try{
      const reg=await navigator.serviceWorker.register("./service-worker.js?v=063",{updateViaCache:"none"});
      await reg.update();
    }catch(e){console.warn("SW update failed",e)}
  });
}
renderHome();
