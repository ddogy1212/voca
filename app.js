
const K_WORDS="vw_words_v4",K_META="vw_meta_v4",K_API="vw_api_v4",K_TODAY="vw_today_seen_v4";
const savedApi=load(K_API,{apiKey:"",model:"gpt-5.6"});
const S={
  words:load(K_WORDS,[]),meta:load(K_META,{correct:0,wrong:0,lastStudy:null,streak:0}),
  apiKey:savedApi.apiKey||"",model:savedApi.model||"gpt-5.6",
  mode:"wordlist",photos:[],extracted:null,
  reviewQueue:[],reviewIndex:0,reviewFlipped:false,
  testMode:"meaning",testScope:"all",testQueue:[],testIndex:0,testCorrect:0,lastGrade:null,
  filter:"all",todayWords:[],todaySeen:load(K_TODAY,[])
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
  if(id==="home")renderHome();if(id==="review")startReview();if(id==="test")startTest();if(id==="library")renderLibrary();
  scrollTo({top:0,behavior:"smooth"});
}
$$("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));$$(".back").forEach(b=>b.onclick=()=>show("home"));

function studyTouch(){
  const today=new Date().toISOString().slice(0,10);
  if(S.meta.lastStudy===today)return;
  if(S.meta.lastStudy){
    const a=new Date(S.meta.lastStudy+"T00:00:00"),b=new Date(today+"T00:00:00");
    S.meta.streak=((b-a)/86400000===1)?(S.meta.streak||0)+1:1;
  }else S.meta.streak=1;
  S.meta.lastStudy=today;
}
function weakness(w){return Math.max(0,Math.min(100,(w.wrong||0)*20+(6-(w.strength||0))*10+((w.dueAt||0)<=now()?12:0)-(w.correct||0)*2))}
function renderHome(){
  const due=S.words.filter(w=>(w.dueAt||0)<=now()),weak=S.words.filter(w=>weakness(w)>=45),tries=S.meta.correct+S.meta.wrong;
  $("#dueHero").textContent=`복습 ${due.length}개`;$("#totalStat").textContent=S.words.length;$("#weakStat").textContent=weak.length;$("#accStat").textContent=tries?Math.round(S.meta.correct/tries*100)+"%":"-";$("#streak").textContent=S.meta.streak||0;
  $("#heroSub").textContent=S.words.length?(due.length?"지금 복습할 단어부터 빠르게 털자.":"오늘 예정 복습은 끝났어."):"하단 ＋에서 사진을 추가해.";
  const list=$("#dueList");if(!due.length){list.className="mini-list empty";list.textContent=S.words.length?"지금 밀린 복습은 없어.":"아직 단어가 없어."}
  else{list.className="mini-list";list.innerHTML=due.sort((a,b)=>weakness(b)-weakness(a)).slice(0,5).map(w=>`<div class="row"><b>${esc(w.term)}</b><span>${esc(w.meanings[0]||"")}</span></div>`).join("")}
}

$("#apiBtn").onclick=()=>{$("#apiModal").classList.remove("hidden");$("#apiKeyInput").value=S.apiKey;$("#modelInput").value=S.model};
$("#closeApiBtn").onclick=()=>$("#apiModal").classList.add("hidden");
$("#saveApiBtn").onclick=()=>{
  const k=$("#apiKeyInput").value.trim(),m=$("#modelInput").value.trim()||"gpt-5.6";
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
async function openai(body){
  if(!needApi())throw Error("API 키 필요");
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+S.apiKey},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d?.error?.message||`API 오류 ${r.status}`);
  return d;
}

/* Multiple photo upload + drag/drop */
$$(".mode").forEach(b=>b.onclick=()=>{$$(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.mode=b.dataset.mode});
$("#imageInput").onchange=e=>addFiles([...e.target.files]);
const dz=$("#dropZone");
["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("dragging")}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("dragging")}));
dz.addEventListener("drop",e=>addFiles([...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"))));
async function addFiles(files){
  const room=8-S.photos.length;if(room<=0)return toast("한 번에 최대 8장이야.");
  const accepted=files.slice(0,room);
  for(const f of accepted){
    if(!/^image\/(png|jpeg|webp)$/i.test(f.type))continue;
    if(f.size>20*1024*1024){toast(`${f.name}: 20MB 초과라 제외`);continue}
    const data=await fileToData(f);S.photos.push({id:uid(),name:f.name,size:f.size,data});
  }
  renderPhotos();$("#imageInput").value="";
}
function fileToData(f){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)})}
function renderPhotos(){
  const box=$("#photoList");box.classList.toggle("hidden",!S.photos.length);
  box.innerHTML=S.photos.map((p,i)=>`<div class="photo-item"><img src="${p.data}" alt=""><button data-remove="${p.id}">×</button><span>${i+1}. ${esc(p.name)}</span></div>`).join("");
  $$("[data-remove]").forEach(b=>b.onclick=e=>{e.preventDefault();S.photos=S.photos.filter(p=>p.id!==b.dataset.remove);renderPhotos()});
  $("#analyzeBtn").disabled=!S.photos.length;
}
function imageContent(prefix=""){
  const c=[];S.photos.forEach((p,i)=>{c.push({type:"input_text",text:`${prefix}사진 ${i+1}: ${p.name}`});c.push({type:"input_image",image_url:p.data,detail:"high"})});return c;
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
function verifyPrompt(extracted){
  return `아래는 영어 학습지/단어장 사진을 이미지 모델이 읽은 1차 결과다.
반드시 웹 검색 도구를 사용해 철자와 일반적으로 인정되는 영어 단어/표현인지, 제시한 한국어 핵심 뜻이 타당한지 확인하라.
동시에 첨부 원본 사진과 다시 비교해서 OCR성 오독(철자 하나 차이, 행이 엇갈린 뜻, 존재하지 않는 단어)을 수정하라.
웹에는 없는 교재 고유 표현이나 문맥형 표현은 사진 근거가 명확하면 유지해도 된다.
검색 결과가 애매하면 임의로 고치지 말고 warnings에 남겨라.
1차 결과:
${JSON.stringify(extracted)}
반드시 JSON 하나만:
{"title":"검증 후 제목","summary":"","items":[{"term":"","meanings":[],"partOfSpeech":"","context":"","synonyms":[],"antonyms":[],"derivatives":[],"importance":1,"sourceType":"","sourceLabel":"","verified":true}],"extraItems":[],"warnings":[],"corrections":[{"before":"1차 인식","after":"수정 결과","reason":"짧은 이유"}],"verificationNote":"웹 검색과 원본 사진 재대조 완료"}
원래 맞았던 항목도 모두 items에 유지하고, 확신할 수 없는 항목은 제외하거나 warnings로 보내라.`;
}
$("#analyzeBtn").onclick=async()=>{
  if(!S.photos.length||!needApi())return;
  const total=S.photos.reduce((a,p)=>a+p.size,0);if(total>42*1024*1024)return toast("사진 총용량이 커. 42MB 이하로 나눠서 해줘.");
  const btn=$("#analyzeBtn");btn.disabled=true;$("#extractPanel").classList.add("hidden");$("#analysisStatus").classList.remove("hidden");
  try{
    $("#analysisStatus").innerHTML="<b>1 / 2 · AI가 원본 사진 읽는 중</b>사이트 OCR 없이 여러 장을 직접 비교하고 있어.";
    const first=await openai({model:S.model,input:[{role:"user",content:[{type:"input_text",text:extractionPrompt()},...imageContent()]}]});
    const extracted=parseAIJSON(responseText(first));
    $("#analysisStatus").innerHTML="<b>2 / 2 · 웹 검색으로 오인식 검증 중</b>철자·뜻을 검색하고 원본 사진과 다시 대조하고 있어.";
    const second=await openai({
      model:S.model,
      tools:[{type:"web_search_preview",search_context_size:"low"}],
      tool_choice:"required",
      include:["web_search_call.action.sources"],
      input:[{role:"user",content:[{type:"input_text",text:verifyPrompt(extracted)},...imageContent("검증용 ")]}]
    });
    const usedSearch=(second.output||[]).some(x=>x.type==="web_search_call");
    if(!usedSearch)throw Error("웹 검색 검증이 실행되지 않았어. 다시 시도해줘.");
    S.extracted=parseAIJSON(responseText(second));S.extracted.webVerified=true;renderExtract();
    $("#analysisStatus").classList.add("hidden");$("#extractPanel").classList.remove("hidden");$("#extractPanel").scrollIntoView({behavior:"smooth"});
  }catch(e){$("#analysisStatus").innerHTML=`<b>중단됨</b>${esc(e.message)}`;toast(e.message)}
  finally{btn.disabled=false}
};
function relText(x){return [x.synonyms?.length?"동의: "+x.synonyms.join(", "):"",x.antonyms?.length?"반의: "+x.antonyms.join(", "):"",x.derivatives?.length?"파생: "+x.derivatives.join(", "):""].filter(Boolean).join(" · ")}
function pick(x,key,checked){return `<label class="pick"><input type="checkbox" data-pick="${key}" ${checked?"checked":""}><span><b>${esc(x.term||"")}</b><small>${esc((x.meanings||[]).join(", "))}</small>${x.context?`<small>${esc(x.context)}</small>`:""}${relText(x)?`<small>${esc(relText(x))}</small>`:""}</span></label>`}
function renderExtract(){
  const d=S.extracted||{};$("#extractTitle").textContent=d.title||"검증 결과";$("#summary").textContent=d.summary||"";$("#summary").classList.toggle("hidden",!d.summary);$("#verifyBadge").classList.toggle("hidden",!d.webVerified);
  $("#extractWarnings").innerHTML=(d.warnings||[]).map(x=>"⚠ "+esc(x)).join("<br>");$("#extractWarnings").classList.toggle("hidden",!(d.warnings||[]).length);
  $("#correctionsBox").innerHTML=(d.corrections||[]).map(x=>`수정: <b>${esc(x.before)}</b> → <b>${esc(x.after)}</b> · ${esc(x.reason||"")}`).join("<br>");$("#correctionsBox").classList.toggle("hidden",!(d.corrections||[]).length);
  $("#mainItems").innerHTML=(d.items||[]).map((x,i)=>pick(x,"m"+i,true)).join("")||`<div class="fine">확실하게 검증된 단어가 없어.</div>`;
  $("#extraItems").innerHTML=(d.extraItems||[]).map((x,i)=>pick(x,"e"+i,false)).join("");$("#extraBlock").classList.toggle("hidden",!(d.extraItems||[]).length);
}
$("#selectAll").onclick=()=>$$("[data-pick]").forEach(x=>x.checked=true);
function makeWord(x){
  return {id:uid(),term:String(x.term||"").trim(),meanings:(x.meanings||[]).map(String).filter(Boolean),partOfSpeech:String(x.partOfSpeech||""),context:String(x.context||""),synonyms:x.synonyms||[],antonyms:x.antonyms||[],derivatives:x.derivatives||[],importance:Number(x.importance||2),sourceType:String(x.sourceType||"wordlist"),sourceLabel:String(x.sourceLabel||""),createdAt:now(),dueAt:now(),strength:0,stability:.5,seen:0,correct:0,wrong:0,star:false,acceptedAnswers:[],goodCount:0,testEnabled:true};
}
function addWord(x){
  if(!x.term)return false;const old=S.words.find(w=>norm(w.term)===norm(x.term));
  if(old){old.meanings=[...new Set([...(old.meanings||[]),...(x.meanings||[])])];old.synonyms=[...new Set([...(old.synonyms||[]),...(x.synonyms||[])])];old.antonyms=[...new Set([...(old.antonyms||[]),...(x.antonyms||[])])];old.derivatives=[...new Set([...(old.derivatives||[]),...(x.derivatives||[])])];if(!old.context)old.context=x.context||"";return false}
  S.words.push(makeWord(x));return true;
}
$("#savePicked").onclick=()=>{
  const d=S.extracted||{};if(!d.webVerified)return toast("웹 검색 검증이 끝난 결과만 저장할 수 있어.");
  const arr=[];(d.items||[]).forEach((x,i)=>{$(`[data-pick="m${i}"]`)?.checked&&arr.push(x)});(d.extraItems||[]).forEach((x,i)=>{$(`[data-pick="e${i}"]`)?.checked&&arr.push(x)});
  let n=0;arr.forEach(x=>{if(addWord(x))n++});save();toast(`${n}개 새로 저장`);S.photos=[];renderPhotos();show("home");
};

/* Today words */
function todayPrompt(){
  const current=S.words.slice(-180).map(w=>({term:w.term,meaning:w.meanings?.[0]||"",strength:w.strength||0,wrong:w.wrong||0}));
  const exclude=[...new Set([...S.words.map(w=>w.term),...S.todaySeen])].slice(-500);
  return `한국 고등학생의 수능/평가원·교육청 모의고사 영어 독해 어휘 코치로 행동하라.
반드시 웹 검색을 사용해 한국 수능·모의고사 영어 독해에서 활용 가치가 높은 어휘를 확인하라. 가능하면 평가원/KICE, EBS, 교육기관 자료 및 신뢰 가능한 영어 사전·교육 자료를 우선 참고하라.
아래 학생이 현재 외우는 단어를 고려해서:
- 2개 정도는 현재 학습 단어의 동의어/반의어/파생어/혼동어처럼 연결 학습 효과가 큰 단어
- 나머지는 수능·모의고사 독해에 폭넓게 유용한 핵심 학술/추상 어휘
로 총 5개를 골라라.
이미 외우는 단어와 이미 오늘 추천한 단어는 절대 중복하지 마라.
현재 학습: ${JSON.stringify(current)}
제외: ${JSON.stringify(exclude)}
'공식 빈도 순위'처럼 확인되지 않은 주장은 하지 마라.
JSON 하나만:
{"items":[{"term":"영어 표제어","meanings":["수능 독해용 핵심 한국어 뜻"],"partOfSpeech":"품사","context":"왜 알아야 하는지 쉬운 한국어 1문장","synonyms":["핵심 동의어"],"antonyms":["필요하면 반의어"],"derivatives":["중요 파생형"],"importance":1,"sourceType":"today","sourceLabel":"오늘의 단어","origin":"linked|exam","reason":"추천 이유"}],"note":"웹 검색 확인 완료"}`;
}
async function loadToday(){
  if(!needApi())return;const status=$("#todayStatus");status.classList.remove("hidden");status.innerHTML="<b>웹에서 확인 중…</b>현재 단어장과 수능·모의고사 독해 어휘를 비교하고 있어.";
  $("#loadTodayBtn").disabled=true;$("#moreTodayBtn").disabled=true;
  try{
    const d=await openai({model:S.model,tools:[{type:"web_search_preview",search_context_size:"medium"}],tool_choice:"required",include:["web_search_call.action.sources"],input:todayPrompt()});
    if(!(d.output||[]).some(x=>x.type==="web_search_call"))throw Error("웹 검색이 실행되지 않았어.");
    const j=parseAIJSON(responseText(d)),fresh=(j.items||[]).filter(x=>x.term&&!S.todaySeen.some(t=>norm(t)===norm(x.term))&&!S.words.some(w=>norm(w.term)===norm(x.term)));
    S.todayWords.push(...fresh);S.todaySeen.push(...fresh.map(x=>x.term));save();renderToday();status.classList.add("hidden");$("#moreTodayBtn").classList.remove("hidden");
  }catch(e){status.innerHTML=`<b>불러오기 실패</b>${esc(e.message)}`;toast(e.message)}
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
  studyTouch();w.seen=(w.seen||0)+1;if(w.goodCount===undefined)w.goodCount=0;if(w.testEnabled===undefined)w.testEnabled=true;
  if(g==="again")w.wrong=(w.wrong||0)+1;
  if(g==="good"){w.correct=(w.correct||0)+1;w.goodCount++;if(w.goodCount>=2&&w.testEnabled!==false){w.testEnabled=false;toast(`✅ ${w.term}: 앎 2회 → 시험 졸업`)}}
  w.dueAt=now()+interval(w,g);save();
}
function startReview(shuf=false){
  if(!S.words.length){$("#reviewEmpty").classList.remove("hidden");$("#reviewArea").classList.add("hidden");return}
  $("#reviewEmpty").classList.add("hidden");$("#reviewArea").classList.remove("hidden");const due=S.words.filter(w=>(w.dueAt||0)<=now());let base=due.length?due:[...S.words].sort((a,b)=>weakness(b)-weakness(a));if(shuf)base=shuffle(base);S.reviewQueue=base;S.reviewIndex=0;renderReview();
}
$("#shuffleBtn").onclick=()=>startReview(true);
function renderReview(){
  if(S.reviewIndex>=S.reviewQueue.length){toast("이번 암기 끝 ✨");show("home");return}
  const w=S.reviewQueue[S.reviewIndex];S.reviewFlipped=false;$("#reviewProgress").style.width=`${(S.reviewIndex+1)/S.reviewQueue.length*100}%`;$("#reviewTag").textContent=w.sourceType==="passage"?"PASSAGE":w.sourceType==="today"?"TODAY":w.sourceType==="suggested"?"EXTRA":"WORD";$("#reviewTerm").textContent=w.term;$("#reviewPOS").textContent=w.partOfSpeech||"";$("#reviewMeaning").textContent=w.meanings.join(" · ");$("#reviewContext").textContent=w.context||"";$("#reviewBack").classList.add("hidden");$("#memoryBtns").classList.add("hidden");$("#tapHint").classList.remove("hidden");const rel=[];(w.synonyms||[]).forEach(x=>rel.push(`<span class="rel">≈ ${esc(x)}</span>`));(w.antonyms||[]).forEach(x=>rel.push(`<span class="rel">↔ ${esc(x)}</span>`));(w.derivatives||[]).forEach(x=>rel.push(`<span class="rel">↗ ${esc(x)}</span>`));$("#relations").innerHTML=rel.join("");$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요";
}
$("#flash").onclick=()=>{S.reviewFlipped=!S.reviewFlipped;$("#reviewBack").classList.toggle("hidden",!S.reviewFlipped);$("#memoryBtns").classList.toggle("hidden",!S.reviewFlipped);$("#tapHint").classList.toggle("hidden",S.reviewFlipped)};
$$("[data-memory]").forEach(b=>b.onclick=e=>{e.stopPropagation();applyMemory(S.reviewQueue[S.reviewIndex],b.dataset.memory);S.reviewIndex++;renderReview()});
$("#speakBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(!w||!("speechSynthesis"in window))return;const u=new SpeechSynthesisUtterance(w.term);u.lang="en-US";u.rate=.85;speechSynthesis.cancel();speechSynthesis.speak(u)};
$("#starBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(!w)return;w.star=!w.star;save();$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요"};
let touch=null;$("#flash").addEventListener("touchstart",e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY}},{passive:true});$("#flash").addEventListener("touchend",e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){if(dx<0&&S.reviewIndex<S.reviewQueue.length-1){S.reviewIndex++;renderReview()}else if(dx>0&&S.reviewIndex>0){S.reviewIndex--;renderReview()}}else if(dy<-90&&S.reviewFlipped){applyMemory(S.reviewQueue[S.reviewIndex],"good");S.reviewIndex++;renderReview()}},{passive:true});

/* test */
$$(".test-mode").forEach(b=>b.onclick=()=>{$$(".test-mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.testMode=b.dataset.test;startTest()});
$$(".test-scope").forEach(b=>b.onclick=()=>{$$(".test-scope").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.testScope=b.dataset.scope;startTest()});
$("#restartTest").onclick=startTest;
function startTest(){
  let eligible=S.words.filter(w=>w.testEnabled!==false);if(S.testScope==="star")eligible=eligible.filter(w=>w.star);
  if(!eligible.length){$("#testEmpty").classList.remove("hidden");$("#testArea").classList.add("hidden");$("#testEmptyTitle").textContent=S.testScope==="star"?"시험 가능한 즐겨찾기가 없어":"테스트 목록이 비어 있어";$("#testEmptyText").textContent="단어 보관함에서 ‘시험 넣기’를 누르면 다시 출제돼.";return}
  $("#testEmpty").classList.add("hidden");$("#testArea").classList.remove("hidden");const ordered=[...eligible].sort((a,b)=>weakness(b)-weakness(a)),top=ordered.slice(0,Math.min(5,ordered.length)),rest=shuffle(ordered.slice(top.length));S.testQueue=shuffle(top).concat(rest).slice(0,Math.min(10,eligible.length));S.testIndex=0;S.testCorrect=0;renderTest();
}
function renderTest(){
  if(S.testIndex>=S.testQueue.length){toast(`테스트 완료 ${S.testCorrect}/${S.testQueue.length}`);show("home");return}
  const w=S.testQueue[S.testIndex];$("#testNo").textContent=`${S.testIndex+1} / ${S.testQueue.length}`;$("#testScore").textContent=`${S.testCorrect} correct`;
  if(S.testMode==="meaning"){$("#promptLabel").textContent="이 단어의 뜻은?";$("#question").textContent=w.term;$("#answer").placeholder="한국어 뜻 입력"}else{$("#promptLabel").textContent="이 뜻의 영어 단어는?";$("#question").textContent=w.meanings[0]||"";$("#answer").placeholder="영어 단어 입력"}
  $("#answer").value="";$("#answer").disabled=false;$("#gradeBtn").disabled=false;$("#gradeBtn").textContent="채점하기";$("#resultBox").className="result hidden";$("#nextBtn").classList.add("hidden");$("#acceptBtn").classList.add("hidden");S.lastGrade=null;
}
$("#answer").onkeydown=e=>{if(e.key==="Enter"){if($("#nextBtn").classList.contains("hidden"))$("#gradeBtn").click();else $("#nextBtn").click()}};
$("#gradeBtn").onclick=async()=>{
  const w=S.testQueue[S.testIndex],a=$("#answer").value.trim();if(!a)return toast("답을 먼저 입력해줘.");const btn=$("#gradeBtn");btn.disabled=true;btn.textContent="채점 중…";
  try{
    let d;if(S.testMode==="reverse"){const ok=norm(a)===norm(w.term);d={verdict:ok?"correct":"wrong",reason:ok?"철자가 일치해.":`정답은 ${w.term}`,acceptedMeaning:w.term}}
    else{
      const exact=[...(w.meanings||[]),...(w.acceptedAnswers||[])].some(m=>{const x=norm(m),y=norm(a);return x===y||(x.length>=2&&y.length>=2&&(x.includes(y)||y.includes(x)))});
      if(exact)d={verdict:"correct",reason:"등록된 핵심 의미와 직접 일치해.",acceptedMeaning:w.meanings[0]||""};
      else{if(!needApi())throw Error("AI 연결 필요");const prompt=`영어 뜻 테스트를 한국 고등학생 독해 기준으로 채점하라.
단어:${w.term}
등록 뜻:${JSON.stringify(w.meanings)}
허용 답:${JSON.stringify(w.acceptedAnswers||[])}
문맥:${w.context||"(없음)"}
학생 답:${a}
사전 표현과 달라도 실제 독해에서 핵심 의미 파악에 지장이 없으면 correct, 방향은 맞지만 오해 가능하면 almost, 다른 뜻이면 wrong.
JSON 하나만:{"verdict":"correct"|"almost"|"wrong","reason":"한국어 한 문장","acceptedMeaning":"핵심 뜻"}`;d=parseAIJSON(responseText(await openai({model:S.model,input:prompt})))}
    }
    const v=d.verdict||"wrong",ok=v==="correct";if(ok){S.testCorrect++;S.meta.correct++;w.correct=(w.correct||0)+1;w.dueAt=now()+interval(w,"good")}else{S.meta.wrong++;w.wrong=(w.wrong||0)+1;w.dueAt=now()+interval(w,v==="almost"?"hard":"again")}w.seen=(w.seen||0)+1;studyTouch();save();S.lastGrade={answer:a,verdict:v};const labels={correct:"정답 ✅",almost:"거의 맞음 △",wrong:"오답 ✕"};$("#resultBox").className=`result ${v}`;$("#resultBox").innerHTML=`<b>${labels[v]}</b><br>${esc(d.reason||"")}<br><small>핵심 뜻: ${esc(d.acceptedMeaning||w.meanings[0]||w.term)}</small>`;$("#answer").disabled=true;$("#nextBtn").classList.remove("hidden");$("#acceptBtn").classList.toggle("hidden",ok||S.testMode==="reverse");
  }catch(e){toast(e.message);btn.disabled=false;btn.textContent="채점하기"}
};
$("#acceptBtn").onclick=()=>{const w=S.testQueue[S.testIndex],a=S.lastGrade?.answer;if(!a)return;w.acceptedAnswers=[...new Set([...(w.acceptedAnswers||[]),a])];save();$("#acceptBtn").classList.add("hidden");toast("앞으로 이 답도 정답 인정")};$("#nextBtn").onclick=()=>{S.testIndex++;renderTest()};

/* library */
function renderLibrary(){
  const q=norm($("#search").value);let arr=S.words.filter(w=>!q||norm(w.term).includes(q)||norm(w.meanings.join(" ")).includes(q));
  if(S.filter==="star")arr=arr.filter(w=>w.star);if(S.filter==="wrong")arr=arr.filter(w=>(w.wrong||0)>0);if(S.filter==="passage")arr=arr.filter(w=>w.sourceType==="passage");if(S.filter==="test")arr=arr.filter(w=>w.testEnabled!==false);if(S.filter==="graduated")arr=arr.filter(w=>w.testEnabled===false);
  $("#libraryList").innerHTML=arr.length?arr.map(w=>{const enabled=w.testEnabled!==false;return `<div class="word-row"><div class="word-main"><b>${esc(w.term)} ${w.star?"★":""}<span class="test-badge ${enabled?"":"off"}">${enabled?"시험중":"시험졸업"}</span></b><small>${esc(w.meanings.join(", "))}</small><small>${esc(w.sourceLabel||w.sourceType)} · 앎 ${w.goodCount||0}/2 · 맞음 ${w.correct||0} / 틀림 ${w.wrong||0}</small></div><div class="word-btns"><button class="test-toggle ${enabled?"":"off"}" data-testtoggle="${w.id}">${enabled?"시험 빼기":"시험 넣기"}</button><button data-star="${w.id}">${w.star?"★":"☆"}</button><button data-del="${w.id}">✕</button></div></div>`}).join(""):`<div class="empty-state"><div class="big-ico">📚</div><h3>단어 없음</h3></div>`;
  $$("[data-star]").forEach(b=>b.onclick=()=>{const w=S.words.find(x=>x.id===b.dataset.star);w.star=!w.star;save();renderLibrary()});
  $$("[data-testtoggle]").forEach(b=>b.onclick=()=>{const w=S.words.find(x=>x.id===b.dataset.testtoggle);if(w.testEnabled===false){w.testEnabled=true;w.goodCount=0;toast(`${w.term} → 시험에 다시 추가`)}else{w.testEnabled=false;toast(`${w.term} → 시험에서 제외`)}save();renderLibrary()});
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

function migrate(){for(const w of S.words){if(w.testEnabled===undefined)w.testEnabled=true;if(w.goodCount===undefined)w.goodCount=0;if(!Array.isArray(w.acceptedAnswers))w.acceptedAnswers=[];if(!Array.isArray(w.synonyms))w.synonyms=[];if(!Array.isArray(w.antonyms))w.antonyms=[];if(!Array.isArray(w.derivatives))w.derivatives=[]}}
migrate();save();if(S.apiKey)$("#apiDot").classList.add("on");else setTimeout(()=>$("#apiModal").classList.remove("hidden"),350);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
renderHome();
