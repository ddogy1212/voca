
const K_WORDS="vw_words_v4",K_META="vw_meta_v4",K_LEGACY_API="vw_api_v4",K_BETA="vw_beta_access_v1",K_SERVER="vw_beta_server_v1",K_REWARD="vw_quiet_reward_v1",K_GRADE_CACHE="vw_grade_cache_v1",K_PHOTO_CACHE="vw_photo_cache_v4",K_API_STATS="vw_api_stats_v1",K_API_MONTH="vw_api_month_v1",K_FOLDERS="vw_source_folders_v1",K_STUDY_LANG="vw_study_language_v1",K_LAST_MINOR="vw_last_minor_language_v1";
const STUDY_LANGS={
  en:{code:"en",name:"영어",short:"영",emoji:"🇬🇧",tts:"en-US",kind:"english",sampleTerm:"reinforce",sampleMeaning:"강화하다"},
  ru:{code:"ru",name:"러시아어",short:"러",emoji:"🇷🇺",tts:"ru-RU",kind:"minor",sampleTerm:"помогать",sampleMeaning:"돕다"},
  ja:{code:"ja",name:"일본어",short:"일",emoji:"🇯🇵",tts:"ja-JP",kind:"minor",sampleTerm:"大切",sampleMeaning:"소중함, 중요함"},
  fr:{code:"fr",name:"프랑스어",short:"불",emoji:"🇫🇷",tts:"fr-FR",kind:"minor",sampleTerm:"important",sampleMeaning:"중요한"},
  zh:{code:"zh",name:"중국어",short:"중",emoji:"🇨🇳",tts:"zh-CN",kind:"minor",sampleTerm:"重要",sampleMeaning:"중요하다"}
};
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function freshMeta(){return {correct:0,wrong:0,lastStudy:null,streak:0}}
function freshReward(){return {date:"",reviewIds:[],testIds:[],transformKeys:[],claimed:false,history:[],seriesPieces:{},secretSeen:[]}}
function freshCache(){return {items:{},order:[]}}
function validStudyLang(x){return Object.prototype.hasOwnProperty.call(STUDY_LANGS,x)?x:"en"}
function profileKey(base,lang){lang=validStudyLang(lang);return lang==="en"?base:`${base}_${lang}`}
const initialStudyLang=validStudyLang(localStorage.getItem(K_STUDY_LANG)||"en");
const savedBeta=load(K_BETA,{code:"",label:""});
const savedServer=String(localStorage.getItem(K_SERVER)||"").trim();
// 브라우저에 남아 있을 수 있는 구형 OpenAI 키는 계속 제거한다.
localStorage.removeItem(K_LEGACY_API);
const rewardSaved=load(profileKey(K_REWARD,initialStudyLang),freshReward());
const gradeCacheSaved=load(profileKey(K_GRADE_CACHE,initialStudyLang),freshCache());
const photoCacheSaved=load(profileKey(K_PHOTO_CACHE,initialStudyLang),freshCache());
const apiStatsSaved=load(K_API_STATS,{date:"",calls:0,cacheHits:0});
const apiMonthSaved=load(K_API_MONTH,{month:"",photoUsed:0,calls:0,cacheHits:0,inputTokens:0,outputTokens:0,models:{}});
const folderSaved=load(profileKey(K_FOLDERS,initialStudyLang),[]);
const S={
  studyLang:initialStudyLang,lastMinorLang:initialStudyLang!=="en"?initialStudyLang:(validStudyLang(localStorage.getItem(K_LAST_MINOR)||"ru")==="en"?"ru":validStudyLang(localStorage.getItem(K_LAST_MINOR)||"ru")),
  words:load(profileKey(K_WORDS,initialStudyLang),[]),meta:load(profileKey(K_META,initialStudyLang),freshMeta()),
  betaCode:savedBeta.code||"",betaLabel:savedBeta.label||"",serverUrl:savedServer,
  mode:"wordlist",photos:[],extracted:null,
  reviewQueue:[],reviewIndex:0,reviewFlipped:false,reviewPreset:null,reviewRangeMode:"all",reviewSource:null,
  testSkipTimer:null,
  testMode:"meaning",testRangeMode:"all",testSource:null,testQueue:[],testIndex:0,testCorrect:0,lastGrade:null,
  transformType:"mixed",transformSource:null,transformQueue:[],transformIndex:0,transformCorrect:0,
  reward:rewardSaved,rewardSeriesView:0,
  gradeCache:gradeCacheSaved,photoCache:photoCacheSaved,apiStats:apiStatsSaved,apiMonth:apiMonthSaved,
  folders:Array.isArray(folderSaved)?folderSaved:[],folderEditMode:"create",folderEditOldName:null,folderManagerName:null,folderWordEditId:null,extractEditKey:null,
  filter:"all"
};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function save(){localStorage.setItem(profileKey(K_WORDS,S.studyLang),JSON.stringify(S.words));localStorage.setItem(profileKey(K_META,S.studyLang),JSON.stringify(S.meta));localStorage.setItem(profileKey(K_FOLDERS,S.studyLang),JSON.stringify(S.folders));renderHome()}
function now(){return Date.now()}function day(n){return n*86400000}
function norm(s){return String(s||"").toLowerCase().trim().replace(/\s+/g," ")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function uid(){return crypto.randomUUID?.()||Date.now()+"_"+Math.random().toString(36).slice(2)}
function normalizeServerUrl(raw){
  let s=String(raw||"").trim();
  if(!s)return "";
  if(!/^https:\/\//i.test(s))s="https://"+s;
  try{
    const u=new URL(s);
    if(u.protocol!=="https:")throw Error();
    u.pathname=u.pathname.replace(/\/+$/g,"");
    u.search="";u.hash="";
    return u.toString().replace(/\/$/,"");
  }catch{return ""}
}
function apiEndpoint(path){
  const base=normalizeServerUrl(S.serverUrl);
  if(!base)throw Error("AI 서버 주소를 먼저 연결해줘.");
  return base+path;
}
(function absorbServerLink(){
  try{
    const u=new URL(location.href),incoming=normalizeServerUrl(u.searchParams.get("server")||"");
    if(!incoming)return;
    S.serverUrl=incoming;localStorage.setItem(K_SERVER,incoming);
    u.searchParams.delete("server");history.replaceState(null,"",u.pathname+(u.search?u.search:"")+(u.hash||""));
  }catch{}
})();

function shuffle(a){
  const out=[...a];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>x.classList.remove("show"),2400)}
function langCfg(){return STUDY_LANGS[S.studyLang]||STUDY_LANGS.en}
function isMinorMode(){return langCfg().kind==="minor"}
function clearVolatileStudyState(){
  if(S.testSkipTimer){clearTimeout(S.testSkipTimer);S.testSkipTimer=null}
  for(const p of S.photos||[]){if(p.preview&&String(p.preview).startsWith("blob:")){try{URL.revokeObjectURL(p.preview)}catch{}}}
  S.mode="wordlist";S.photos=[];S.extracted=null;
  S.reviewQueue=[];S.reviewIndex=0;S.reviewPreset=null;S.reviewRangeMode="all";S.reviewSource=null;
  S.testQueue=[];S.testIndex=0;S.testCorrect=0;S.testRangeMode="all";S.testSource=null;S.lastGrade=null;
  S.transformQueue=[];S.transformIndex=0;S.transformCorrect=0;S.transformSource=null;
  S.folderManagerName=null;S.folderWordEditId=null;S.filter="all";
}
function persistCurrentProfile(){
  localStorage.setItem(profileKey(K_WORDS,S.studyLang),JSON.stringify(S.words));
  localStorage.setItem(profileKey(K_META,S.studyLang),JSON.stringify(S.meta));
  localStorage.setItem(profileKey(K_FOLDERS,S.studyLang),JSON.stringify(S.folders));
  localStorage.setItem(profileKey(K_REWARD,S.studyLang),JSON.stringify(S.reward));
  localStorage.setItem(profileKey(K_GRADE_CACHE,S.studyLang),JSON.stringify(S.gradeCache));
  localStorage.setItem(profileKey(K_PHOTO_CACHE,S.studyLang),JSON.stringify(S.photoCache));
}
function loadStudyProfile(lang){
  S.studyLang=validStudyLang(lang);
  S.words=load(profileKey(K_WORDS,S.studyLang),[]);
  S.meta=load(profileKey(K_META,S.studyLang),freshMeta());
  S.folders=load(profileKey(K_FOLDERS,S.studyLang),[]);
  S.reward=load(profileKey(K_REWARD,S.studyLang),freshReward());
  S.gradeCache=load(profileKey(K_GRADE_CACHE,S.studyLang),freshCache());
  S.photoCache=load(profileKey(K_PHOTO_CACHE,S.studyLang),freshCache());
  S.rewardSeriesView=0;
  migrate();syncFoldersFromWords();ensureRewardDay();saveFolders();saveReward();saveGradeCache();savePhotoCache();
}
function updateStudyLanguageUI(){
  const c=langCfg(),minor=isMinorMode();
  document.body.classList.toggle("minor-study-mode",minor);
  $("#englishStudyModeBtn")?.classList.toggle("active",!minor);
  $("#minorStudyModeBtn")?.classList.toggle("active",minor);
  $("#minorLanguageRow")?.classList.toggle("hidden",!minor);
  $$('[data-study-lang]').forEach(b=>b.classList.toggle("active",b.dataset.studyLang===S.studyLang));
  const note=$("#activeStudyModeNote");if(note)note.textContent=minor?`${c.emoji} 부전공어 · ${c.name} · 다른 언어/영어와 완전 분리`:`${c.emoji} 영어 단어장 · 부전공어와 완전 분리`;
  const passage=$("#passageModeBtn");if(passage)passage.textContent=`🧾 ${c.name} 지문`;
  const source=$("#sourceLabel");if(source)source.placeholder=`폴더 이름 (예: ${minor?c.name+" 3과":"D17, 영어 프린트 3과"})`;
  const mh=$("#manualHelp");if(mh)mh.innerHTML=`한 줄에 하나씩 입력해. <b>${c.name} = 한국어 뜻</b> 형식이 제일 편해.<br>예: <code>${esc(c.sampleTerm)} = ${esc(c.sampleMeaning)}</code>`;
  const bulk=$("#manualBulk");if(bulk)bulk.placeholder=`${c.sampleTerm} = ${c.sampleMeaning}`;
  const mbtn=$("#meaningTestModeBtn");if(mbtn)mbtn.textContent=`${c.short} → 한`;
  const rbtn=$("#reverseTestModeBtn");if(rbtn)rbtn.textContent=`한 → ${c.short}`;
  const search=$("#search");if(search)search.placeholder=`${c.name} / 한국어 검색`;
  const fl=$("#folderEditTermLabel");if(fl)fl.textContent=`${c.name} 단어 / 표현`;
  const notice=$("#minorAccuracyNotice");if(notice)notice.classList.toggle("hidden",!minor);
  $$(".mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===S.mode));
  const precision=$("#precisionAnalyzeBtn");if(precision)precision.textContent=minor?`🔎 ${c.name} 초정밀 재검사 · Terra (선택)`:`🔎 정밀 재검사 · Terra (선택)`;
  const fine=[...document.querySelectorAll('.precision-note')][0];if(fine)fine.textContent=minor?`${c.name} 원문을 다시 대조하는 선택 기능이야. 기본 인식도 부전공어 전용 정밀 규칙을 사용해.`:`기본 분석보다 모델 단가가 높아. 결과가 이상할 때만 눌러.`;
  if($("#photoSelectStatus")&&!S.photos.length)$("#photoSelectStatus").textContent=`아직 선택된 ${c.name} 자료 사진이 없어.`;
}
function switchStudyLanguage(lang){
  lang=validStudyLang(lang);if(lang===S.studyLang){updateStudyLanguageUI();return}
  persistCurrentProfile();clearVolatileStudyState();
  if(lang!=="en"){S.lastMinorLang=lang;localStorage.setItem(K_LAST_MINOR,lang)}
  localStorage.setItem(K_STUDY_LANG,lang);
  loadStudyProfile(lang);updateStudyLanguageUI();renderPhotos();renderHome();renderRewardStrip();show("home");
  toast(`${langCfg().emoji} ${langCfg().name} 모드로 전환 · 단어/폴더/테스트 완전 분리`);
}
$("#englishStudyModeBtn").onclick=()=>switchStudyLanguage("en");
$("#minorStudyModeBtn").onclick=()=>switchStudyLanguage(S.lastMinorLang||"ru");
$$('[data-study-lang]').forEach(b=>b.onclick=()=>switchStudyLanguage(b.dataset.studyLang));
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
  if(b.dataset.resetSource==="1"&&b.dataset.go==="test"){S.testRangeMode="all";S.testSource=null;}
  if(b.dataset.resetSource==="1"&&b.dataset.go==="transform")S.transformSource=null;
  if(b.dataset.resetReview==="1"&&b.dataset.go==="review"){S.reviewRangeMode="all";S.reviewSource=null;S.reviewPreset=null;}
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
function cleanFolderName(name){return String(name||"").trim().replace(/\s+/g," ")}
function folderNameExists(name,except=null){
  const n=norm(cleanFolderName(name));
  return S.folders.some(x=>norm(x)===n&&norm(x)!==norm(except||""));
}
function ensureFolder(name){
  const n=cleanFolderName(name);
  if(!n||n==="출처 미지정")return;
  if(!S.folders.some(x=>norm(x)===norm(n)))S.folders.push(n);
}
function forceSourceFolder(data,name){
  const n=cleanFolderName(name);
  if(!data||!n||n==="출처 미지정")return data;
  ensureFolder(n);
  saveFolders();
  for(const key of ["items","extraItems"]){
    if(Array.isArray(data[key])){
      data[key]=data[key].map(item=>({...item,sourceLabel:n}));
    }
  }
  if(!data.title||data.title==="사진 단어장"||data.title==="자료 제목")data.title=n;
  return data;
}
function syncFoldersFromWords(){
  if(!Array.isArray(S.folders))S.folders=[];
  S.folders=S.folders.map(cleanFolderName).filter(x=>x&&x!=="출처 미지정");
  const unique=[];
  for(const f of S.folders){if(!unique.some(x=>norm(x)===norm(f)))unique.push(f)}
  S.folders=unique;
  for(const w of S.words)ensureFolder(w.sourceLabel);
}
function sourceGroups(){
  syncFoldersFromWords();
  const map=new Map();
  for(const f of S.folders)map.set(f,[]);
  let hasUnfiled=false;
  for(const w of S.words){
    const k=sourceKey(w);
    if(k==="출처 미지정")hasUnfiled=true;
    if(!map.has(k))map.set(k,[]);
    map.get(k).push(w);
  }
  const arr=[...map.entries()].filter(([name])=>name!=="출처 미지정"||hasUnfiled);
  arr.sort((a,b)=>{
    if(a[0]==="출처 미지정")return 1;
    if(b[0]==="출처 미지정")return -1;
    const ai=S.folders.findIndex(x=>norm(x)===norm(a[0]));
    const bi=S.folders.findIndex(x=>norm(x)===norm(b[0]));
    return ai-bi;
  });
  return arr;
}
function saveFolders(){localStorage.setItem(profileKey(K_FOLDERS,S.studyLang),JSON.stringify(S.folders))}
function openFolderEdit(mode,oldName=null){
  S.folderEditMode=mode;S.folderEditOldName=oldName;
  $("#folderEditTitle").textContent=mode==="rename"?"폴더 이름 바꾸기":"새 폴더 만들기";
  $("#folderEditSave").textContent=mode==="rename"?"이름 변경":"만들기";
  $("#folderNameInput").value=mode==="rename"?(oldName||""):"";
  $("#folderEditModal").classList.remove("hidden");
  setTimeout(()=>$("#folderNameInput").focus(),50);
}
function closeFolderEdit(){$("#folderEditModal").classList.add("hidden")}
function selectedFolderWordIds(){return $$('[data-folder-word]:checked').map(x=>x.value)}
function updateFolderSelectedCount(){
  const selected=selectedFolderWordIds().length;
  const total=$$('[data-folder-word]').length;
  $("#folderSelectedCount").textContent=`${selected}개 선택`;
  $("#folderSelectAll").checked=total>0&&selected===total;
  $("#folderSelectAll").indeterminate=selected>0&&selected<total;
  $("#folderMoveBtn").disabled=selected===0;
  $("#folderDeleteWordsBtn").disabled=selected===0;
}
function renderFolderManager(){
  const name=S.folderManagerName;
  if(!name)return;
  const words=S.words.filter(w=>sourceKey(w)===name);
  $("#folderManagerTitle").textContent=name;
  const list=$("#folderWordList");
  list.innerHTML=words.length?words.map(w=>`<div class="folder-word-row">
    <input class="folder-word-check" data-folder-word type="checkbox" value="${esc(w.id)}">
    <div class="folder-word-main"><b>${esc(w.term)}</b><small>${esc((w.meanings||[]).join(", "))}</small></div>
    <span class="folder-word-status">${w.testEnabled===false?"시험졸업":`앎 ${w.goodCount||0}/2`}</span>
    <button class="folder-word-edit-btn" type="button" data-folder-edit-word="${esc(w.id)}">수정</button>
  </div>`).join(""):`<div class="folder-empty-manager">이 폴더에는 단어가 없어.</div>`;
  const targets=["출처 미지정",...S.folders.filter(f=>norm(f)!==norm(name))];
  $("#folderMoveTarget").innerHTML=targets.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
  $$('[data-folder-word]').forEach(x=>x.onchange=updateFolderSelectedCount);
  $$('[data-folder-edit-word]').forEach(b=>b.onclick=()=>openFolderWordEdit(b.dataset.folderEditWord));
  $("#folderSelectAll").checked=false;$("#folderSelectAll").indeterminate=false;
  updateFolderSelectedCount();
}
function openFolderManager(name){
  S.folderManagerName=name;
  renderFolderManager();
  $("#folderManagerModal").classList.remove("hidden");
}
function closeFolderManager(){S.folderManagerName=null;$("#folderManagerModal").classList.add("hidden")}
function openFolderWordEdit(id){
  const w=S.words.find(x=>x.id===id);
  if(!w)return;
  S.folderWordEditId=id;
  $("#folderEditTerm").value=w.term||"";
  $("#folderEditMeaning").value=(w.meanings||[]).join(" / ");
  $("#folderWordEditModal").classList.remove("hidden");
  setTimeout(()=>$("#folderEditTerm").focus(),50);
}
function closeFolderWordEdit(){
  S.folderWordEditId=null;
  $("#folderWordEditModal").classList.add("hidden");
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
  localStorage.setItem(profileKey(K_REWARD,S.studyLang),JSON.stringify(S.reward));
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
    $("#openRewardBtn").textContent="✓ 완료";
    $("#openRewardBtn").disabled=true;
  }else if(ready){
    $("#rewardIcon").textContent="✉️";
    $("#rewardTitle").textContent="오늘의 봉투 · 열 수 있음";
    $("#rewardProgressText").textContent="오늘 학습 조건을 모두 채웠어.";
    $("#openRewardBtn").textContent="✉ 열기";
    $("#openRewardBtn").disabled=false;
  }else{
    $("#rewardIcon").textContent="🎁";
    $("#rewardTitle").textContent="오늘의 봉투";
    $("#rewardProgressText").textContent=chunks.length?chunks.join(" · "):"단어를 추가하면 시작돼.";
    $("#openRewardBtn").textContent="🔒 잠김";
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
$("#collectionBtn").textContent="🧩 컬렉션";
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

$("#apiBtn").onclick=()=>{
  renderApiUsage();renderBetaStatus();
  $("#apiModal").classList.remove("hidden");
  $("#betaCodeInput").value=S.betaCode||"";
  $("#serverUrlInput").value=S.serverUrl||"";
};
$("#closeApiBtn").onclick=()=>$("#apiModal").classList.add("hidden");
function renderBetaStatus(){
  const el=$("#betaConnectStatus");if(!el)return;
  const hasServer=!!normalizeServerUrl(S.serverUrl),hasCode=!!S.betaCode;
  if(hasServer&&hasCode){el.textContent=`연결됨${S.betaLabel?` · ${S.betaLabel}`:""}`;el.classList.add("ok");$("#apiDot").classList.add("on")}
  else if(hasServer){el.textContent="서버 연결됨 · 초대코드를 입력해줘.";el.classList.remove("ok");$("#apiDot").classList.remove("on")}
  else{el.textContent="AI 서버 주소와 초대코드를 연결해줘.";el.classList.remove("ok");$("#apiDot").classList.remove("on")}
}
async function verifyBetaCode(server,code){
  const r=await fetch(server+"/ping",{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=UTF-8"},
    body:JSON.stringify({inviteCode:code})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d?.error||`서버 연결 실패 (${r.status})`);
  return d;
}
$("#saveApiBtn").onclick=async()=>{
  const btn=$("#saveApiBtn"),code=$("#betaCodeInput").value.trim(),server=normalizeServerUrl($("#serverUrlInput").value);
  if(!server)return toast("AI 서버 주소를 확인해줘.");
  if(code.length<4)return toast("초대코드를 확인해줘.");
  btn.disabled=true;btn.textContent="연결 확인 중…";
  try{
    const d=await verifyBetaCode(server,code);
    S.serverUrl=server;S.betaCode=code;S.betaLabel=d.label||"";
    localStorage.setItem(K_SERVER,S.serverUrl);
    localStorage.setItem(K_BETA,JSON.stringify({code:S.betaCode,label:S.betaLabel}));
    renderBetaStatus();$("#apiModal").classList.add("hidden");toast("비공개 베타 연결 완료 ✅");
  }catch(e){toast(e.message);$("#betaConnectStatus").textContent=e.message;$("#betaConnectStatus").classList.remove("ok")}
  finally{btn.disabled=false;btn.textContent="초대코드 연결"}
};
$("#forgetApiBtn").onclick=()=>{
  localStorage.removeItem(K_BETA);localStorage.removeItem(K_SERVER);
  S.betaCode="";S.betaLabel="";S.serverUrl="";
  $("#betaCodeInput").value="";$("#serverUrlInput").value="";renderBetaStatus();toast("베타 연결 해제 완료");
};
$("#copyBetaLinkBtn").onclick=async()=>{
  const server=normalizeServerUrl($("#serverUrlInput").value||S.serverUrl);
  if(!server)return toast("먼저 Worker 주소를 넣어줘.");
  const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("server",server);
  try{await navigator.clipboard.writeText(u.toString());toast("친구용 링크 복사 완료 🔗")}
  catch{prompt("이 링크를 복사해서 친구에게 보내줘.",u.toString())}
};
function needApi(){
  if(normalizeServerUrl(S.serverUrl)&&S.betaCode)return true;
  renderBetaStatus();$("#apiModal").classList.remove("hidden");
  $("#serverUrlInput").value=S.serverUrl||"";
  toast(S.serverUrl?"초대코드를 먼저 연결해줘.":"AI 서버 주소를 먼저 연결해줘.");
  return false;
}

const MONTHLY_PHOTO_LIMIT=150;
const MODEL_PRICES={"gpt-5.6-luna":{input:.20,cached:.02,output:1.20,cacheWrite:.25},"gpt-5.6-terra":{input:2.00,cached:.20,output:12.00,cacheWrite:2.50}};
function localMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function blankApiMonth(){return {month:localMonthKey(),photoUsed:0,calls:0,cacheHits:0,inputTokens:0,outputTokens:0,models:{}}}
function ensureApiMonth(){if(!S.apiMonth||S.apiMonth.month!==localMonthKey())S.apiMonth=blankApiMonth();if(!S.apiMonth.models||typeof S.apiMonth.models!=="object")S.apiMonth.models={}}
function saveApiMonth(){ensureApiMonth();localStorage.setItem(K_API_MONTH,JSON.stringify(S.apiMonth))}
function getModelUsage(model){ensureApiMonth();if(!S.apiMonth.models[model])S.apiMonth.models[model]={calls:0,inputTokens:0,cachedTokens:0,cacheWriteTokens:0,outputTokens:0,costUSD:0};return S.apiMonth.models[model]}
function estimateUsageCost(model,u){const p=MODEL_PRICES[model];if(!p||!u)return 0;const input=Number(u.input_tokens||0),cached=Number(u.input_tokens_details?.cached_tokens||0),write=Number(u.input_tokens_details?.cache_write_tokens||0),normal=Math.max(0,input-cached-write),output=Number(u.output_tokens||0);return (normal*p.input+cached*p.cached+write*p.cacheWrite+output*p.output)/1_000_000}
function recordResponseUsage(model,response){ensureApiMonth();const b=getModelUsage(model||"unknown"),u=response?.usage;b.calls++;S.apiMonth.calls++;if(u){const input=Number(u.input_tokens||0),cached=Number(u.input_tokens_details?.cached_tokens||0),write=Number(u.input_tokens_details?.cache_write_tokens||0),output=Number(u.output_tokens||0);b.inputTokens+=input;b.cachedTokens+=cached;b.cacheWriteTokens+=write;b.outputTokens+=output;b.costUSD+=estimateUsageCost(model,u);S.apiMonth.inputTokens+=input;S.apiMonth.outputTokens+=output}saveApiMonth();renderApiUsage()}
function noteMonthlyCacheHit(){ensureApiMonth();S.apiMonth.cacheHits=(S.apiMonth.cacheHits||0)+1;saveApiMonth();renderApiUsage()}
function photoRemaining(){ensureApiMonth();return Math.max(0,MONTHLY_PHOTO_LIMIT-Number(S.apiMonth.photoUsed||0))}
function canUsePhotos(n){return Number(n||0)<=photoRemaining()}
function consumePhotoUnit(n=1){ensureApiMonth();S.apiMonth.photoUsed=Math.min(MONTHLY_PHOTO_LIMIT,Number(S.apiMonth.photoUsed||0)+Number(n||0));saveApiMonth();renderApiUsage();renderPhotoQuota()}
function totalApiCost(){ensureApiMonth();return Object.values(S.apiMonth.models||{}).reduce((s,x)=>s+Number(x.costUSD||0),0)}
function compactUsageNum(n){n=Number(n||0);if(n>=1_000_000)return (n/1_000_000).toFixed(2)+"M";if(n>=1_000)return (n/1_000).toFixed(1)+"K";return String(Math.round(n))}
function renderApiUsage(){ensureApiMonth();if(!$("#apiUsageMonth"))return;const used=Number(S.apiMonth.photoUsed||0),remain=photoRemaining();$("#apiUsageMonth").textContent=S.apiMonth.month;$("#photoUsedCount").textContent=used;$("#photoRemainingCount").textContent=`${remain}장 남음`;$("#photoQuotaBar").style.width=`${Math.min(100,used/MONTHLY_PHOTO_LIMIT*100)}%`;$("#apiMonthlyCalls").textContent=compactUsageNum(S.apiMonth.calls);$("#apiMonthlyCacheHits").textContent=compactUsageNum(S.apiMonth.cacheHits);$("#apiMonthlyInput").textContent=compactUsageNum(S.apiMonth.inputTokens);$("#apiMonthlyOutput").textContent=compactUsageNum(S.apiMonth.outputTokens);const luna=S.apiMonth.models["gpt-5.6-luna"]||{},terra=S.apiMonth.models["gpt-5.6-terra"]||{};$("#apiLunaUsage").textContent=`${luna.calls||0}회 · $${Number(luna.costUSD||0).toFixed(4)}`;$("#apiTerraUsage").textContent=`${terra.calls||0}회 · $${Number(terra.costUSD||0).toFixed(4)}`;$("#apiEstimatedCost").textContent=`$${totalApiCost().toFixed(4)}`}
function renderPhotoQuota(){ensureApiMonth();const hint=$("#photoQuotaHint"),btn=$("#analyzeBtn");if(!hint||!btn)return;const used=Number(S.apiMonth.photoUsed||0),remain=photoRemaining();hint.textContent=remain>0?`이번 달 사진 ${used} / ${MONTHLY_PHOTO_LIMIT}장 · ${remain}장 남음`:"이번 달 사진 150장을 모두 사용했어. 다음 달 1일에 초기화돼.";hint.classList.toggle("limit",remain===0);btn.classList.toggle("quota-blocked",remain===0);btn.disabled=!S.photos.length||remain===0}
function statsToday(){
  const d=new Date().toISOString().slice(0,10);
  if(S.apiStats.date!==d)S.apiStats={date:d,calls:0,cacheHits:0};
}
function saveApiStats(){
  statsToday();
  localStorage.setItem(K_API_STATS,JSON.stringify(S.apiStats));
}
function noteApiCall(){
  statsToday();S.apiStats.calls=(S.apiStats.calls||0)+1;saveApiStats();
}
function noteCacheHit(){
  statsToday();S.apiStats.cacheHits=(S.apiStats.cacheHits||0)+1;saveApiStats();
  noteMonthlyCacheHit();
}
function saveGradeCache(){
  localStorage.setItem(profileKey(K_GRADE_CACHE,S.studyLang),JSON.stringify(S.gradeCache));
}
function gradeCacheKey(w,a){
  return [norm(w.term),norm(a),(w.meanings||[]).map(norm).sort().join("|")].join("::");
}
function getGradeCache(w,a){
  const k=gradeCacheKey(w,a),v=S.gradeCache?.items?.[k];
  if(v){noteCacheHit();return v}
  return null;
}
function putGradeCache(w,a,v){
  if(!S.gradeCache||typeof S.gradeCache!=="object")S.gradeCache={items:{},order:[]};
  if(!S.gradeCache.items)S.gradeCache.items={};
  if(!Array.isArray(S.gradeCache.order))S.gradeCache.order=[];
  const k=gradeCacheKey(w,a);
  if(!S.gradeCache.items[k])S.gradeCache.order.push(k);
  S.gradeCache.items[k]=v;
  while(S.gradeCache.order.length>400){
    const old=S.gradeCache.order.shift();
    delete S.gradeCache.items[old];
  }
  saveGradeCache();
}
function savePhotoCache(){
  localStorage.setItem(profileKey(K_PHOTO_CACHE,S.studyLang),JSON.stringify(S.photoCache));
}
function photoCacheKey(){
  const source=$("#sourceLabel").value.trim();
  const parts=S.photos.map(p=>{
    const f=p.file;
    return [p.name,p.size,f?.lastModified||0].join(":");
  });
  return [S.studyLang,S.mode,source,...parts].join("||");
}
function getPhotoCache(){
  const k=photoCacheKey(),v=S.photoCache?.items?.[k];
  if(v){noteCacheHit();return JSON.parse(JSON.stringify(v))}
  return null;
}
function putPhotoCache(value){
  if(!S.photoCache||typeof S.photoCache!=="object")S.photoCache={items:{},order:[]};
  if(!S.photoCache.items)S.photoCache.items={};
  if(!Array.isArray(S.photoCache.order))S.photoCache.order=[];
  const k=photoCacheKey();
  if(!S.photoCache.items[k])S.photoCache.order.push(k);
  S.photoCache.items[k]=value;
  while(S.photoCache.order.length>12){
    const old=S.photoCache.order.shift();
    delete S.photoCache.items[old];
  }
  savePhotoCache();
}
function compactKorean(s){
  return norm(s)
    .replace(/[()[\]{}.,!?·ㆍ:;'"“”‘’/\\\-_\s]/g,"")
    .replace(/(하는것|한것|한다|하다|된다|되다|시키다|시킨다|임|이다)$/,"");
}
function localMeaningMatch(answer,meanings){
  const a=compactKorean(answer);
  if(a.length<1)return false;
  return (meanings||[]).some(m=>{
    const x=compactKorean(m);
    if(!x)return false;
    if(x===a)return true;
    if(x.length>=2&&a.length>=2&&(x.includes(a)||a.includes(x)))return true;
    return false;
  });
}

function responseText(d){
  let text="";
  for(const out of(d.output||[]))if(out.type==="message")for(const c of(out.content||[]))if(c.type==="output_text")text+=c.text||"";
  return text||d.output_text||"";
}
function cleanAIJSONText(t){
  return String(t||"")
    .trim()
    .replace(/^```json\s*/i,"")
    .replace(/^```\s*/,"")
    .replace(/\s*```$/,"")
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'");
}
function tryParseAIJSON(t){
  const s=cleanAIJSONText(t);
  try{return JSON.parse(s)}catch(e1){
    const a=s.indexOf('{'), b=s.lastIndexOf('}');
    if(a>=0&&b>a){
      const sliced=s.slice(a,b+1);
      try{return JSON.parse(sliced)}catch(e2){
        return null;
      }
    }
    return null;
  }
}
function normalizeExtractedData(d){
  if(!d||typeof d!=="object")d={};
  if(!Array.isArray(d.items))d.items=[];
  if(!Array.isArray(d.extraItems))d.extraItems=[];
  if(!Array.isArray(d.warnings))d.warnings=[];
  if(!Array.isArray(d.corrections))d.corrections=[];
  d.title=String(d.title||"");
  d.summary=String(d.summary||"");
  const normItem=(x,sourceTypeDefault)=>({
    term:String(x?.term||"").trim(),
    meanings:Array.isArray(x?.meanings)?x.meanings.map(v=>String(v||'').trim()).filter(Boolean):[],
    partOfSpeech:String(x?.partOfSpeech||""),
    context:String(x?.context||""),
    synonyms:Array.isArray(x?.synonyms)?x.synonyms.map(v=>String(v||'').trim()).filter(Boolean).slice(0,2):[],
    antonyms:Array.isArray(x?.antonyms)?x.antonyms.map(v=>String(v||'').trim()).filter(Boolean).slice(0,2):[],
    derivatives:Array.isArray(x?.derivatives)?x.derivatives.map(v=>String(v||'').trim()).filter(Boolean).slice(0,3):[],
    importance:Number(x?.importance||1),
    confidence:Number.isFinite(Number(x?.confidence))?Math.max(0,Math.min(1,Number(x.confidence))):1,
    page:Number.isFinite(Number(x?.page))?Number(x.page):0,
    sourceType:String(x?.sourceType||sourceTypeDefault),
    sourceLabel:String(x?.sourceLabel||$("#sourceLabel")?.value.trim()||"")
  });
  d.items=d.items.map(x=>normItem(x,S.mode==="passage"?"passage":"wordlist")).filter(x=>x.term&&x.meanings.length);
  d.extraItems=d.extraItems.map(x=>normItem(x,'suggested')).filter(x=>x.term&&x.meanings.length).slice(0,12);
  d.warnings=d.warnings.map(v=>String(v||'').trim()).filter(Boolean).slice(0,20);
  d.corrections=d.corrections.map(x=>({before:String(x?.before||''),after:String(x?.after||''),reason:String(x?.reason||'')})).filter(x=>x.before||x.after||x.reason).slice(0,20);
  return d;
}
async function parseAIJSONOrRepair(t,kind="generic"){
  const parsed=tryParseAIJSON(t);
  if(parsed)return normalizeExtractedData(parsed);
  if(!needApi())throw Error("AI 결과 형식을 읽지 못했어. 다시 시도해줘.");
  const prompt=`아래 텍스트는 JSON이어야 했는데 약간 망가졌다. 내용을 최대한 유지하면서 유효한 JSON 하나만 복구해라. 설명 금지.\n종류:${kind}\n텍스트:\n${cleanAIJSONText(t)}`;
  const repaired=responseText(await openai({
    model:taskModel("fast"),
    reasoning:{effort:"none"},
    text:{verbosity:"low"},
    max_output_tokens:4200,
    input:prompt
  },{timeoutMs:25000,retries:0}));
  const parsed2=tryParseAIJSON(repaired);
  if(parsed2)return normalizeExtractedData(parsed2);
  throw Error("AI 결과 형식이 조금 망가졌어. 다시 시도해줘.");
}
function parseAIJSON(t){
  const parsed=tryParseAIJSON(t);
  if(parsed)return parsed;
  throw Error("AI 결과 형식을 읽지 못했어. 다시 시도해줘.");
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function photoStructuredText(){
  return {
    verbosity:"low",
    format:{
      type:"json_schema",
      name:"vocab_photo_extract",
      strict:true,
      schema:{
        type:"object",
        properties:{
          title:{type:"string"},
          summary:{type:"string"},
          items:{
            type:"array",
            items:{
              type:"object",
              properties:{
                term:{type:"string"},
                meanings:{type:"array",items:{type:"string"}},
                partOfSpeech:{type:"string"},
                context:{type:"string"},
                synonyms:{type:"array",items:{type:"string"}},
                antonyms:{type:"array",items:{type:"string"}},
                derivatives:{type:"array",items:{type:"string"}},
                importance:{type:"number"},
                confidence:{type:"number"},
                page:{type:"number"},
                sourceType:{type:"string"},
                sourceLabel:{type:"string"}
              },
              required:["term","meanings","partOfSpeech","context","synonyms","antonyms","derivatives","importance","confidence","page","sourceType","sourceLabel"],
              additionalProperties:false
            }
          },
          extraItems:{
            type:"array",
            items:{
              type:"object",
              properties:{
                term:{type:"string"},
                meanings:{type:"array",items:{type:"string"}},
                partOfSpeech:{type:"string"},
                context:{type:"string"},
                synonyms:{type:"array",items:{type:"string"}},
                antonyms:{type:"array",items:{type:"string"}},
                derivatives:{type:"array",items:{type:"string"}},
                importance:{type:"number"},
                confidence:{type:"number"},
                page:{type:"number"},
                sourceType:{type:"string"},
                sourceLabel:{type:"string"}
              },
              required:["term","meanings","partOfSpeech","context","synonyms","antonyms","derivatives","importance","confidence","page","sourceType","sourceLabel"],
              additionalProperties:false
            }
          },
          warnings:{type:"array",items:{type:"string"}},
          corrections:{
            type:"array",
            items:{
              type:"object",
              properties:{
                before:{type:"string"},
                after:{type:"string"},
                reason:{type:"string"}
              },
              required:["before","after","reason"],
              additionalProperties:false
            }
          },
          verificationNote:{type:"string"}
        },
        required:["title","summary","items","extraItems","warnings","corrections","verificationNote"],
        additionalProperties:false
      }
    }
  };
}
function taskModel(task){
  if(task==="photo_precision") return "gpt-5.6-terra";
  return "gpt-5.6-luna";
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
async function openai(body,{prefix=null,timeoutMs=75000,retries=0,precision=false}={}){
  if(!needApi())throw Error("초대코드 필요");
  let lastErr;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      noteApiCall();
      const r=await fetch(apiEndpoint("/ai"),{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=UTF-8"},
        body:JSON.stringify({
          inviteCode:S.betaCode,
          mode:precision?"precision":"standard",
          request:body
        }),
        signal:controller.signal
      });
      clearTimeout(timer);
      const d=await r.json().catch(()=>({}));
      if(r.ok){recordResponseUsage(d._vocabwalk_model||taskModel(precision?"photo_precision":"fast"),d);return d;}
      const msg=d?.error||d?.error?.message||`AI 서버 오류 ${r.status}`;
      const retryable=r.status===429||r.status===408||r.status===500||r.status===502||r.status===503||r.status===504;
      if(!retryable||attempt>=retries)throw Error(msg);
      const wait=900*Math.pow(2,attempt)+Math.random()*350;
      if(prefix)setProgress(prefix,Math.min(86,55+attempt*10),`잠깐 대기 · 재시도 ${attempt+1}/${retries}`,`${Math.ceil(wait/1000)}초 후 다시 시도해.`);
      await sleep(wait);lastErr=Error(msg);continue;
    }catch(e){
      clearTimeout(timer);lastErr=e;
      const retryable=e.name==="AbortError"||/network|fetch|failed/i.test(String(e.message||e));
      if(!retryable||attempt>=retries)break;
      await sleep(900*Math.pow(2,attempt)+Math.random()*300);
    }
  }
  if(lastErr?.name==="AbortError")throw Error("응답 시간이 너무 길어 중단했어. 사진 수를 줄이거나 잠시 뒤 다시 해줘.");
  throw lastErr||Error("AI 서버 요청 실패");
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

  renderPhotoQuota();
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
  let decoded;
  try{
    decoded=await loadImageFromFile(file);
  }catch(e){
    if(/heic|heif/i.test(type+" "+file.name)){
      throw Error("HEIC/HEIF 사진을 이 브라우저가 변환하지 못했어. JPEG로 찍어서 다시 넣어줘.");
    }
    throw e;
  }

  try{
    // 손글씨 정확도 우선: 기존 1800px보다 해상도를 높이고,
    // 연필 글씨가 흐려지지 않도록 약하게 대비를 보정한다.
    const pixels=decoded.width*decoded.height;
    const maxSide=isMinorMode()?2200:2000;
    const maxPixels=isMinorMode()?3600000:3000000;
    const scale=Math.min(
      1,
      maxSide/Math.max(decoded.width,decoded.height),
      Math.sqrt(maxPixels/Math.max(1,pixels))
    );

    const c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(decoded.width*scale));
    c.height=Math.max(1,Math.round(decoded.height*scale));

    const ctx=c.getContext("2d",{alpha:false});
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,c.width,c.height);
    try{ctx.filter="contrast(1.14) brightness(1.025)"}catch{}
    ctx.drawImage(decoded.source,0,0,c.width,c.height);
    try{ctx.filter="none"}catch{}

    return await canvasToData(c,isMinorMode()?0.88:0.84);
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

function minorOrthographyRules(){
  if(S.studyLang==="ru")return `러시아어 전용 확인: 키릴 문자 자체를 읽고 라틴 문자로 바꾸지 마라. е/ё, и/й, ь/ъ, ш/щ, ц/ч, 어미를 특히 다시 대조한다. 강세표시가 사진에 실제로 있으면 보존하고, 없으면 새로 만들지 않는다.`;
  if(S.studyLang==="ja")return `일본어 전용 확인: 한자·히라가나·가타카나를 서로 바꾸지 말고 원문 그대로 보존한다. 작은 っ/ゃ/ゅ/ょ, 장음 ー, 탁점/반탁점, 오쿠리가나를 한 글자씩 다시 대조한다. 후리가나가 있으면 원 단어를 임의로 후리가나로 교체하지 않는다.`;
  if(S.studyLang==="fr")return `프랑스어 전용 확인: é/è/ê/ë, à/â, ç, î/ï, ô, ù/û/ü 등 악센트와 cédille를 반드시 보존한다. apostrophe와 하이픈, 사진에 적힌 관사·성 표시를 멋대로 지우거나 추가하지 않는다.`;
  if(S.studyLang==="zh")return `중국어 전용 확인: 간체/번체를 원문과 다르게 자동 변환하지 않는다. 모양이 비슷한 한자를 획 단위로 다시 대조한다. 병음과 성조표시가 사진에 있을 때만 context에 보존하고, 없으면 추측해 추가하지 않는다.`;
  return "";
}
function extractionPrompt(){
  const source=$("#sourceLabel").value.trim();
  const c=langCfg();
  if(S.studyLang==="en"){
    if(S.mode==="passage")return `너는 한국 고등학교 영어 내신/수능 독해 어휘 코치다.
원본 사진을 직접 읽고, 철자와 문맥을 보수적으로 확인한다. 사이트 OCR 결과는 없다.
추측 금지. 확신이 낮은 것은 warnings에 남긴다.
출처:${source||"(없음)"}
JSON만 출력:
{"title":"자료 제목","summary":"핵심 한국어 1~2문장","items":[{"term":"표제어","meanings":["문맥 뜻"],"partOfSpeech":"","context":"","synonyms":[],"antonyms":[],"derivatives":[],"importance":1,"confidence":0.95,"page":1,"sourceType":"passage","sourceLabel":${JSON.stringify(source)}}],"extraItems":[],"warnings":[],"corrections":[],"verificationNote":"원본 사진 대조 완료"}`;
    return `너는 손글씨 영어 단어장을 정확히 옮기는 전사기다. 사이트 OCR은 없다.
왼쪽 영어와 오른쪽 한국어를 반드시 같은 가로줄끼리 대응한다.
위에서 아래 순서대로 한 줄씩 읽는다.
영어는 단어뿐 아니라 account for, take ~ into account 같은 표현도 한 항목으로 보존한다.
보이는 철자를 멋대로 사전형/더 그럴듯한 단어로 고치지 않는다. 확신이 낮으면 confidence를 낮추고 warnings에 적는다.
한국어 뜻도 같은 줄에 실제로 적힌 뜻만 넣는다.
별표, 번호, 여백, 다른 페이지의 글씨는 단어로 인식하지 않는다.
동의어·반의어·파생어·추가 추천어는 이번 인식 단계에서는 만들지 않는다. 정확한 전사가 최우선이다.
출처:${source||"(없음)"}
JSON만 출력:
{"title":"사진 단어장","summary":"","items":[{"term":"사진에 적힌 영어/표현","meanings":["같은 줄의 한국어 뜻"],"partOfSpeech":"","context":"","synonyms":[],"antonyms":[],"derivatives":[],"importance":1,"confidence":0.95,"page":1,"sourceType":"wordlist","sourceLabel":${JSON.stringify(source)}}],"extraItems":[],"warnings":[],"corrections":[],"verificationNote":"원본 사진 대조 완료"}`;
  }

  const ortho=minorOrthographyRules();
  if(S.mode==="passage")return `너는 한국 고등학생의 ${c.name} 부전공 학습을 돕는 초정밀 어휘 전사·검증 코치다.
사용자는 원문 철자가 틀렸는지 스스로 판단하기 어려울 수 있으므로 정확성이 최우선이다. 사이트 OCR은 없고 원본 사진 자체를 직접 읽는다.
${ortho}
중요 절차: (1) 원문을 한 번 전사한다. (2) 사진을 처음부터 다시 훑으며 각 term을 문자 단위로 두 번째 대조한다. (3) 한국어 뜻과 같은 행/문맥인지 다시 확인한다.
사전에 있을 법하다는 이유로 철자나 형태를 고치지 않는다. 불확실한 한 글자라도 있으면 confidence를 0.88 이하로 낮추고 warnings에 정확히 어떤 부분이 흐린지 적는다.
지문에서 실제 문맥상 중요한 어휘를 items에 넣고 meanings는 한국어로 쓴다. 동의어·반의어·파생/관련 형태는 확실한 경우에만 소수 추가한다.
출처:${source||"(없음)"}
JSON만 출력:
{"title":"${c.name} 자료","summary":"핵심 한국어 1~2문장","items":[{"term":"원문 그대로의 ${c.name} 표제어/표현","meanings":["문맥상 한국어 뜻"],"partOfSpeech":"","context":"","synonyms":[],"antonyms":[],"derivatives":[],"importance":1,"confidence":0.95,"page":1,"sourceType":"passage","sourceLabel":${JSON.stringify(source)}}],"extraItems":[],"warnings":[],"corrections":[],"verificationNote":"${c.name} 원문 문자 단위 2중 대조 완료"}`;

  return `너는 ${c.name} 단어장 사진을 옮기는 초정밀 전사기다. 사용자는 네 철자 오류를 알아채기 어려울 수 있으므로 속도보다 정확도를 우선한다. 사이트 OCR은 없다.
${ortho}
왼쪽(또는 표제어 열)의 ${c.name}와 오른쪽 한국어 뜻을 반드시 같은 가로줄끼리 대응한다.
정확도 절차: 먼저 표제어 열만 위→아래로 전사하고 행 수를 센다. 다음 한국어 뜻 열을 별도로 읽는다. 마지막으로 사진을 처음부터 다시 보며 각 표제어를 문자 단위로 두 번째 대조하고 같은 행의 뜻과 묶는다.
보이는 형태를 사전형, 더 흔한 표현, 현대 표기로 임의 교정하지 않는다. 애매하면 추측하지 말고 confidence를 0.88 이하로 낮추며 warnings에 위치와 의심 문자를 적는다.
한국어 뜻은 같은 줄에 실제 적힌 뜻만 넣는다. 번호·별표·페이지 장식은 단어로 만들지 않는다.
동의어·반의어·파생어·추가 추천어는 이 전사 단계에서는 임의 생성하지 않는다. 원문 정확 복사가 최우선이다.
출처:${source||"(없음)"}
JSON만 출력:
{"title":"${c.name} 사진 단어장","summary":"","items":[{"term":"사진 원문 그대로의 ${c.name} 단어/표현","meanings":["같은 줄의 한국어 뜻"],"partOfSpeech":"","context":"","synonyms":[],"antonyms":[],"derivatives":[],"importance":1,"confidence":0.95,"page":1,"sourceType":"wordlist","sourceLabel":${JSON.stringify(source)}}],"extraItems":[],"warnings":[],"corrections":[],"verificationNote":"${c.name} 원문 문자 단위 2중 대조 완료"}`;
}
function singlePhotoAccuracyPrompt(pageNo){
  const c=langCfg();
  const common=`이 요청에는 ${pageNo}번째 사진 한 장만 있다.
정확도 절차:
1. 표제어 열만 위→아래로 읽어 행 수를 파악한다.
2. 한국어 뜻 열을 별도로 위→아래로 읽는다.
3. 마지막에 같은 수평선/같은 행끼리 다시 대조해 term과 meaning을 묶는다.
4. 철자가 흐리면 문맥이나 사전 지식으로 상상해서 채우지 말고 confidence를 낮추며 warnings에 적는다.
5. 한 행을 건너뛰거나 두 행을 합치지 않았는지 마지막에 다시 검사한다.
6. page 필드는 모든 item에 ${pageNo}를 넣는다.`;
  const extra=isMinorMode()?`
7. ${c.name} 원문을 사진의 첫 항목부터 끝 항목까지 문자 단위로 한 번 더 독립적으로 대조한다.
8. ${minorOrthographyRules()}
9. 조금이라도 애매한 표기는 confidence 0.88 이하 + warnings로 표시한다. 사용자가 모를 수 있으니 확신 없는 철자를 확정하지 마라.`:"";
  return `${extractionPrompt()}

${common}${extra}
JSON 이외에는 아무것도 출력하지 마라.`;
}

function onePassPhotoPrompt(){
  return `${extractionPrompt()}
원본 사진 자체 대조가 우선이다. 웹 검색은 저장 조건이 아니며, 철자 확인이 정말 필요한 경우에만 보조적으로 쓴다. JSON만 출력한다.`;
}

$("#analyzeBtn").onclick=async()=>{
  if(!S.photos.length||!needApi())return;
  const requestedFolder=cleanFolderName($("#sourceLabel").value);
  const btn=$("#analyzeBtn");
  btn.disabled=true;
  $("#extractPanel").classList.add("hidden");
  startProgress("analysis",isMinorMode()?`${langCfg().name} 정밀 확인 중`:"사진 확인 중",isMinorMode()?"부전공어 전용 문자 단위 2중 대조를 준비하고 있어.":"정확도 우선 모드로 페이지별 인식을 준비하고 있어.",3,90);
  try{
    const cached=getPhotoCache();
    if(cached){
      S.extracted=forceSourceFolder(cached,requestedFolder);
      renderExtract();bindPickEditors();
      setProgress("analysis",100,"캐시에서 완료","이 버전에서 이미 분석한 같은 사진 결과를 재사용했어.");
      stopProgress("analysis");
      setTimeout(()=>$("#analysisStatus").classList.add("hidden"),900);
      $("#extractPanel").classList.remove("hidden");
      $("#extractPanel").scrollIntoView({behavior:"smooth"});
      return;
    }

    if(!canUsePhotos(S.photos.length)){
      const remain=photoRemaining();
      throw Error(remain>0?`이번 달 사진이 ${remain}장 남았어. 선택한 ${S.photos.length}장을 ${remain}장 이하로 줄여줘.`:"이번 달 사진 150장을 모두 사용했어. 다음 달 1일에 다시 사용할 수 있어.");
    }

    await prepareSelectedPhotosForApi();
    const total=S.photos.reduce((a,p)=>a+(p.preparedBytes||p.size||0),0);
    if(total>24*1024*1024)throw Error("고화질 준비 후 사진 용량이 커. 4장씩 나눠서 해줘.");

    const merged={
      title:S.mode==="passage"?"자료 제목":"사진 단어장",
      summary:"",items:[],extraItems:[],warnings:[],corrections:[],
      verificationNote:"원본 사진 페이지별 대조 완료",
      webVerified:false,usedWebSearch:false
    };

    for(let i=0;i<S.photos.length;i++){
      const photo=S.photos[i];
      const pct=25+Math.round((i/Math.max(1,S.photos.length))*55);
      setProgress("analysis",pct,isMinorMode()?`${langCfg().name} 정밀 인식 ${i+1}/${S.photos.length}`:`저비용 인식 ${i+1}/${S.photos.length}`,`${photo.name} · ${isMinorMode()?"문자·악센트·기호를 2중 대조":"Luna로 먼저 정확하게 읽는 중"}`);

      const lunaResult=await openai({
        model:taskModel("photo"),
        reasoning:{effort:"none"},
        text:photoStructuredText(),
        max_output_tokens:isMinorMode()?(S.mode==="wordlist"?3200:3800):(S.mode==="wordlist"?2400:3000),
        input:[{role:"user",content:[
          {type:"input_text",text:singlePhotoAccuracyPrompt(i+1)},
          {type:"input_image",image_url:photo.data,detail:"high"}
        ]}]
      },{prefix:"analysis",timeoutMs:60000,retries:0});

      let d=normalizeExtractedData(parseAIJSON(responseText(lunaResult)));
      consumePhotoUnit(1);

      d.verificationNote=isMinorMode()?`${langCfg().name} 전용 정밀 규칙 · 문자 단위 2중 대조 완료`:"Luna 기본 인식 완료";

      if(!merged.summary&&d.summary)merged.summary=d.summary;
      merged.items.push(...(d.items||[]).map(x=>({...x,page:i+1})));
      merged.extraItems.push(...(d.extraItems||[]));
      merged.warnings.push(...(d.warnings||[]).map(w=>`사진 ${i+1}: ${w}`));
      merged.corrections.push(...(d.corrections||[]));
    }

    // 같은 영어가 여러 페이지에 반복되면 뜻을 합치고, 첫 등장 순서는 유지한다.
    const byTerm=new Map();
    for(const item of merged.items){
      const k=norm(item.term);
      if(!k)continue;
      if(!byTerm.has(k))byTerm.set(k,item);
      else{
        const old=byTerm.get(k);
        old.meanings=[...new Set([...(old.meanings||[]),...(item.meanings||[])])];
        old.confidence=Math.min(Number(old.confidence||1),Number(item.confidence||1));
      }
    }
    merged.items=[...byTerm.values()];
    S.extracted=forceSourceFolder(normalizeExtractedData(merged),requestedFolder);
    S.extracted.webVerified=false;
    S.extracted.usedWebSearch=false;
    S.extracted.verificationNote=isMinorMode()?`${langCfg().name} 전용 정밀 인식 완료 · Terra 자동 호출 0회`:"Luna 기본 인식 완료 · Terra 자동 호출 0회";

    putPhotoCache(S.extracted);
    renderExtract();bindPickEditors();
    setProgress("analysis",100,"완료",`총 ${S.extracted.items.length}개 · ${isMinorMode()?langCfg().name+" 문자 단위 2중 대조 · ":""}Luna 사용 · Terra 자동 호출 0회`);
    stopProgress("analysis");
    setTimeout(()=>$("#analysisStatus").classList.add("hidden"),1000);
    $("#extractPanel").classList.remove("hidden");
    $("#extractPanel").scrollIntoView({behavior:"smooth"});
  }catch(e){
    stopProgress("analysis");
    setProgress("analysis",0,"실패",e.message);
    toast(e.message);
  }finally{
    btn.disabled=false;
  }
};

async function runManualPrecisionAnalysis(){
  if(!S.photos.length||!needApi())return;
  const requestedFolder=cleanFolderName($("#sourceLabel").value);
  if(!confirm("정밀 재검사는 Terra를 사용해 기본 Luna보다 모델 단가가 높아. 현재 선택한 사진을 정말 다시 검사할까?"))return;
  const btn=$("#precisionAnalyzeBtn");btn.disabled=true;btn.textContent="🔎 Terra 정밀 재검사 중…";
  startProgress("analysis","정밀 재검사","사용자가 요청해서 Terra로 원본 사진을 다시 확인하고 있어.",5,90);
  try{
    await prepareSelectedPhotosForApi();
    const merged={title:S.mode==="passage"?"자료 제목":"사진 단어장",summary:"",items:[],extraItems:[],warnings:[],corrections:[],verificationNote:"Terra 수동 정밀 재검사 완료",webVerified:false,usedWebSearch:false};
    for(let i=0;i<S.photos.length;i++){
      const photo=S.photos[i];
      setProgress("analysis",15+Math.round((i/Math.max(1,S.photos.length))*70),`정밀 재검사 ${i+1}/${S.photos.length}`,`${photo.name} · Terra 수동 분석`);
      const result=await openai({
        model:taskModel("photo_precision"),reasoning:{effort:"none"},text:photoStructuredText(),max_output_tokens:isMinorMode()?(S.mode==="wordlist"?3600:4200):(S.mode==="wordlist"?2600:3200),
        input:[{role:"user",content:[{type:"input_text",text:`${singlePhotoAccuracyPrompt(i+1)}\n이 요청은 사용자가 직접 선택한 정밀 재검사다. 원본 사진을 매우 보수적으로 다시 대조하고, 애매하면 추측하지 마라.`},{type:"input_image",image_url:photo.data,detail:"high"}]}]
      },{prefix:"analysis",timeoutMs:65000,retries:0,precision:true});
      const d=normalizeExtractedData(parseAIJSON(responseText(result)));
      if(!merged.summary&&d.summary)merged.summary=d.summary;
      merged.items.push(...(d.items||[]).map(x=>({...x,page:i+1})));
      merged.extraItems.push(...(d.extraItems||[]));
      merged.warnings.push(...(d.warnings||[]).map(w=>`사진 ${i+1}: ${w}`));
      merged.corrections.push(...(d.corrections||[]));
    }
    const byTerm=new Map();
    for(const item of merged.items){const k=norm(item.term);if(!k)continue;if(!byTerm.has(k))byTerm.set(k,item);else{const old=byTerm.get(k);old.meanings=[...new Set([...(old.meanings||[]),...(item.meanings||[])])];old.confidence=Math.min(Number(old.confidence||1),Number(item.confidence||1));}}
    merged.items=[...byTerm.values()];
    S.extracted=forceSourceFolder(normalizeExtractedData(merged),requestedFolder);S.extracted.verificationNote="Terra 수동 정밀 재검사 완료";
    putPhotoCache(S.extracted);renderExtract();bindPickEditors();
    setProgress("analysis",100,"정밀 재검사 완료",`총 ${S.extracted.items.length}개 · Terra는 이번 버튼을 눌렀을 때만 사용됐어.`);
    stopProgress("analysis");setTimeout(()=>$("#analysisStatus").classList.add("hidden"),1100);
    toast("Terra 정밀 재검사 완료");
  }catch(e){stopProgress("analysis");setProgress("analysis",0,"정밀 재검사 실패",e.message);toast(e.message)}
  finally{btn.disabled=false;btn.textContent="🔎 정밀 재검사 · Terra (선택)"}
}
$("#precisionAnalyzeBtn").onclick=runManualPrecisionAnalysis;

function relText(x){return [x.synonyms?.length?"동의: "+x.synonyms.join(", "):"",x.antonyms?.length?"반의: "+x.antonyms.join(", "):"",x.derivatives?.length?"파생: "+x.derivatives.join(", "):""].filter(Boolean).join(" · ")}
function pick(x,key,checked){
  return `<div class="pick" data-pickrow="${key}">
    <input type="checkbox" data-pick="${key}" ${checked?"checked":""}>
    <span class="pick-content">
      <b>${esc(x.term||"")}</b>
      <small>${esc((x.meanings||[]).join(", "))}</small>
      ${x.context?`<small>${esc(x.context)}</small>`:""}
      ${Number(x.confidence||1)<(isMinorMode()?0.9:0.8)?`<small class="confidence-warn">⚠ ${isMinorMode()?langCfg().name+" 원문 재확인 권장":"글씨 확인 필요 · 직접 수정 권장"}</small>`:""}
      ${x.userEdited?`<small class="extract-user-edited">✓ 직접 수정됨</small>`:""}
      ${relText(x)?`<small>${esc(relText(x))}</small>`:""}
    </span>
    <button type="button" class="pick-edit-btn" data-edit-pick="${key}">✏️ 수정</button>
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
function languageInputCode(){
  return ({en:"en",ru:"ru",ja:"ja",fr:"fr",zh:"zh-CN"})[S.studyLang]||"";
}

function openExtractWordEdit(key){
  const item=getExtractItemByKey(key);
  if(!item)return;

  S.extractEditKey=key;

  const cfg=langCfg();
  $("#extractEditTitle").textContent=`${cfg.emoji} ${cfg.name} 인식 결과 수정`;
  $("#extractEditTermLabel").textContent=`${cfg.name} 단어 / 표현`;

  const term=$("#extractEditTerm");
  term.value=item.term||"";
  term.setAttribute("lang",languageInputCode());
  term.setAttribute("aria-label",`${cfg.name} 단어 또는 표현`);

  $("#extractEditMeaning").value=(item.meanings||[]).join(" / ");

  const hint=$("#extractEditLanguageHint");
  if(isMinorMode()){
    hint.textContent=`${cfg.name}는 AI 인식 오류를 사용자가 놓칠 수 있으니 원문 철자·문자를 직접 확인해줘. 수정한 값이 그대로 저장돼.`;
  }else{
    hint.textContent="AI가 읽은 단어와 뜻을 저장 전에 직접 수정할 수 있어.";
  }

  $("#extractWordEditModal").classList.remove("hidden");
  setTimeout(()=>{
    term.focus();
    try{term.setSelectionRange(term.value.length,term.value.length)}catch{}
  },80);
}

function closeExtractWordEdit(){
  S.extractEditKey=null;
  $("#extractWordEditModal").classList.add("hidden");
}

function bindPickEditors(){
  $$("[data-edit-pick]").forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      openExtractWordEdit(btn.dataset.editPick);
    };
  });
}
$("#selectAll").onclick=()=>$$("[data-pick]").forEach(x=>x.checked=true);
function makeWord(x){
  return {id:uid(),term:String(x.term||"").trim(),meanings:(x.meanings||[]).map(String).filter(Boolean),partOfSpeech:String(x.partOfSpeech||""),context:String(x.context||""),synonyms:x.synonyms||[],antonyms:x.antonyms||[],derivatives:x.derivatives||[],importance:Number(x.importance||2),sourceType:String(x.sourceType||"wordlist"),sourceLabel:String(x.sourceLabel||""),createdAt:now(),dueAt:now(),strength:0,stability:.5,seen:0,correct:0,wrong:0,star:false,goodCount:0,skipCount:0,testEnabled:true};
}
function addWord(x){
  if(!x.term)return false;ensureFolder(x.sourceLabel);const old=S.words.find(w=>norm(w.term)===norm(x.term));
  if(old){old.meanings=[...new Set([...(old.meanings||[]),...(x.meanings||[])])];old.synonyms=[...new Set([...(old.synonyms||[]),...(x.synonyms||[])])];old.antonyms=[...new Set([...(old.antonyms||[]),...(x.antonyms||[])])];old.derivatives=[...new Set([...(old.derivatives||[]),...(x.derivatives||[])])];if(!old.context)old.context=x.context||"";return false}
  S.words.push(makeWord(x));return true;
}
$("#savePicked").onclick=()=>{
  const d=S.extracted||{};
  const arr=[];(d.items||[]).forEach((x,i)=>{$(`[data-pick="m${i}"]`)?.checked&&arr.push(x)});(d.extraItems||[]).forEach((x,i)=>{$(`[data-pick="e${i}"]`)?.checked&&arr.push(x)});
  let n=0;arr.forEach(x=>{if(addWord(x))n++});
  S.photos.forEach(p=>{if(p.preview&&String(p.preview).startsWith("blob:")){try{URL.revokeObjectURL(p.preview)}catch{}}});
  save();toast(`${n}개 새로 저장`);S.photos=[];renderPhotos();show("home");
};

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
function populateReviewFolderPicker(){
  syncFoldersFromWords();
  const groups=sourceGroups();
  const picker=$("#reviewFolderPicker");

  picker.innerHTML=groups.map(([name,words])=>{
    const active=words.filter(w=>(w.goodCount||0)<2).length;
    return `<option value="${esc(name)}">${esc(name)} · ${active}개</option>`;
  }).join("");

  if(S.reviewSource && groups.some(([name])=>name===S.reviewSource)){
    picker.value=S.reviewSource;
  }else if(groups.length){
    S.reviewSource=groups[0][0];
    picker.value=S.reviewSource;
  }else{
    S.reviewSource=null;
  }
}
function syncReviewRangeUI(){
  const folderMode=S.reviewRangeMode==="folder";
  $("#reviewAllBtn").classList.toggle("active",!folderMode);
  $("#reviewFolderBtn").classList.toggle("active",folderMode);
  $("#reviewFolderPickerWrap").classList.toggle("hidden",!folderMode);
  if(folderMode)populateReviewFolderPicker();
}
$("#reviewAllBtn").onclick=()=>{
  S.reviewRangeMode="all";
  S.reviewSource=null;
  S.reviewPreset=null;
  startReview();
};
$("#reviewFolderBtn").onclick=()=>{
  S.reviewRangeMode="folder";
  S.reviewPreset=null;
  populateReviewFolderPicker();
  startReview();
};
$("#reviewFolderPicker").onchange=e=>{
  S.reviewRangeMode="folder";
  S.reviewSource=e.target.value||null;
  S.reviewPreset=null;
  startReview();
};


function buildSpacedReviewQueue(base,shuf=false){
  const primary=shuf?shuffle([...base]):[...base];
  const queue=[...primary];

  // 넘김 가중치는 유지하되 동일 단어가 바로 연속되지 않도록
  // 추가 복습 카드를 여러 라운드로 뒤쪽에 분산한다.
  for(let round=1;round<=2;round++){
    let extras=primary.filter(w=>Math.min(2,w.skipCount||0)>=round);
    if(shuf)extras=shuffle(extras);

    for(const w of extras){
      // 직전 카드와 같은 단어면 가능한 다른 위치에 먼저 넣는다.
      if(queue.length && queue[queue.length-1]?.id===w.id && primary.length>1){
        const alt=primary.find(x=>x.id!==w.id);
        if(alt && !queue.some((x,i)=>i>=primary.length && x===alt)){
          queue.push(alt);
        }
      }
      queue.push(w);
    }
  }

  // 혹시 남아 있는 연속 중복도 가능한 한 뒤 카드와 교환한다.
  for(let i=1;i<queue.length;i++){
    if(queue[i]?.id!==queue[i-1]?.id)continue;
    const j=queue.findIndex((x,idx)=>idx>i && x?.id!==queue[i]?.id);
    if(j>i){
      [queue[i],queue[j]]=[queue[j],queue[i]];
    }
  }
  return queue;
}

function deferSameReviewWord(wordId,minGap=2){
  if(!Array.isArray(S.reviewQueue))return;
  const next=S.reviewIndex+1;
  if(next>=S.reviewQueue.length)return;

  // 다음 카드가 방금 본 단어라면 최소 몇 장 뒤로 미룬다.
  if(S.reviewQueue[next]?.id===wordId){
    const [dup]=S.reviewQueue.splice(next,1);
    const target=Math.min(S.reviewQueue.length, next+Math.max(1,minGap));
    S.reviewQueue.splice(target,0,dup);
  }
}

const praiseLines=[
  "좋아! 정확해 👏",
  "정답! 잘 기억했어 🔥",
  "완벽해 ✨",
  "좋아, 제대로 외웠네 😎",
  "정확해! 계속 가자 ✅",
  "굿! 바로 맞췄어 🙌"
];
function randomPraise(){
  return praiseLines[Math.floor(Math.random()*praiseLines.length)];
}

function startReview(shuf=false){
  syncReviewRangeUI();

  if(!S.words.length){
    $("#reviewEmpty").classList.remove("hidden");
    $("#reviewArea").classList.add("hidden");
    $("#reviewEmpty h3").textContent="외울 단어가 없어";
    $("#reviewEmpty p").textContent="하단 ＋에서 사진이나 단어를 추가해줘.";
    return;
  }

  let rangeWords=S.words;
  if(S.reviewRangeMode==="folder"){
    if(!S.reviewSource)populateReviewFolderPicker();
    rangeWords=rangeWords.filter(w=>sourceKey(w)===S.reviewSource);
  }

  const availableForReview=rangeWords.filter(w=>(w.goodCount||0)<2);

  if(!availableForReview.length && !(Array.isArray(S.reviewPreset)&&S.reviewPreset.length)){
    $("#reviewEmpty").classList.remove("hidden");
    $("#reviewArea").classList.add("hidden");
    $("#reviewEmpty h3").textContent=S.reviewRangeMode==="folder"?"이 폴더에 암기할 단어가 없어":"현재 암기할 단어가 없어";
    $("#reviewEmpty p").textContent="‘앎’ 2회가 된 단어는 암기에서 졸업해. 보관함에서 ‘시험 넣기’를 누르면 다시 시작할 수 있어.";
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
    const due=availableForReview
      .filter(w=>(w.dueAt||0)<=now())
      .sort((a,b)=>weakness(b)-weakness(a));
    base=due.length?due:[...availableForReview].sort((a,b)=>weakness(b)-weakness(a));
  }

  S.reviewQueue=buildSpacedReviewQueue(base,shuf);
  S.reviewIndex=0;
  renderReview();
}
$("#shuffleBtn").onclick=()=>startReview(true);
function speakEnglish(text){
  if(!text||!("speechSynthesis" in window))return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=langCfg().tts;
    u.rate=(S.studyLang==="ja"||S.studyLang==="zh")?0.78:0.84;
    speechSynthesis.speak(u);
  }catch{}
}
function renderReview(){
  if(S.reviewIndex>=S.reviewQueue.length){toast("이번 암기 끝 ✨");show("home");return}
  const w=S.reviewQueue[S.reviewIndex];S.reviewFlipped=false;$("#reviewProgress").style.width=`${(S.reviewIndex+1)/S.reviewQueue.length*100}%`;$("#reviewTag").textContent=w.sourceType==="passage"?"PASSAGE":w.sourceType==="suggested"?"EXTRA":"WORD";$("#reviewTerm").textContent=w.term;$("#reviewPOS").textContent=w.partOfSpeech||"";$("#reviewMeaning").textContent=w.meanings.join(" · ");$("#reviewContext").textContent=w.context||"";$("#reviewBack").classList.add("hidden");$("#memoryBtns").classList.add("hidden");$("#tapHint").classList.remove("hidden");const rel=[];(w.synonyms||[]).forEach(x=>rel.push(`<span class="rel">≈ ${esc(x)}</span>`));(w.antonyms||[]).forEach(x=>rel.push(`<span class="rel">↔ ${esc(x)}</span>`));(w.derivatives||[]).forEach(x=>rel.push(`<span class="rel">↗ ${esc(x)}</span>`));$("#relations").innerHTML=rel.join("");$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요";
  setTimeout(()=>speakEnglish(w.term),90);
}
$("#flash").onclick=()=>{S.reviewFlipped=!S.reviewFlipped;$("#reviewBack").classList.toggle("hidden",!S.reviewFlipped);$("#memoryBtns").classList.toggle("hidden",!S.reviewFlipped);$("#tapHint").classList.toggle("hidden",S.reviewFlipped)};
$$("[data-memory]").forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  const w=S.reviewQueue[S.reviewIndex];
  const grade=b.dataset.memory;
  if(!w)return;

  applyMemory(w,grade);

  // 애매/모름을 눌러도 동일 단어가 바로 다음 카드로 연속 등장하지 않게 미룬다.
  if(grade==="hard")deferSameReviewWord(w.id,3);
  if(grade==="again")deferSameReviewWord(w.id,2);

  if(grade==="good" && (w.goodCount||0)<2){
    toast(randomPraise());
  }

  S.reviewIndex++;
  renderReview();
});
$("#speakBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(w)speakEnglish(w.term)};
$("#starBtn").onclick=()=>{const w=S.reviewQueue[S.reviewIndex];if(!w)return;w.star=!w.star;save();$("#starBtn").textContent=w.star?"★ 중요":"☆ 중요"};
let touch=null;$("#flash").addEventListener("touchstart",e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY}},{passive:true});$("#flash").addEventListener("touchend",e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){if(dx<0&&S.reviewIndex<S.reviewQueue.length-1){S.reviewIndex++;renderReview()}else if(dx>0&&S.reviewIndex>0){S.reviewIndex--;renderReview()}}else if(dy<-90&&S.reviewFlipped){const w=S.reviewQueue[S.reviewIndex];applyMemory(w,"good");if((w.goodCount||0)<2)toast(randomPraise());S.reviewIndex++;renderReview()}},{passive:true});

/* test */
$$(".test-mode").forEach(b=>b.onclick=()=>{
  $$(".test-mode").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  S.testMode=b.dataset.test;
  startTest();
});

function populateTestFolderPicker(){
  syncFoldersFromWords();
  const groups=sourceGroups();
  const picker=$("#testFolderPicker");
  picker.innerHTML=groups.map(([name,words])=>{
    const activeCount=words.filter(w=>w.testEnabled!==false).length;
    return `<option value="${esc(name)}">${esc(name)} · ${activeCount}개</option>`;
  }).join("");

  if(S.testSource && groups.some(([name])=>name===S.testSource)){
    picker.value=S.testSource;
  }else if(groups.length){
    S.testSource=groups[0][0];
    picker.value=S.testSource;
  }else{
    S.testSource=null;
  }
}

function syncTestRangeUI(){
  const folderMode=S.testRangeMode==="folder";
  $("#testAllRandomBtn").classList.toggle("active",!folderMode);
  $("#testFolderModeBtn").classList.toggle("active",folderMode);
  $("#testFolderPickerWrap").classList.toggle("hidden",!folderMode);

  // 구형 범위 배너는 새 범위 선택 UI로 대체.
  $("#testSourceBanner").classList.add("hidden");

  if(folderMode)populateTestFolderPicker();
}

$("#restartTest").onclick=startTest;

$("#testAllRandomBtn").onclick=()=>{
  S.testRangeMode="all";
  S.testSource=null;
  startTest();
};

$("#testFolderModeBtn").onclick=()=>{
  S.testRangeMode="folder";
  populateTestFolderPicker();
  startTest();
};

$("#testFolderPicker").onchange=e=>{
  S.testRangeMode="folder";
  S.testSource=e.target.value||null;
  startTest();
};

$("#clearTestSource").onclick=()=>{
  S.testRangeMode="all";
  S.testSource=null;
  startTest();
};

function startTest(){
  syncTestRangeUI();

  let eligible=S.words.filter(w=>w.testEnabled!==false);

  if(S.testRangeMode==="folder"){
    if(!S.testSource)populateTestFolderPicker();
    eligible=eligible.filter(w=>sourceKey(w)===S.testSource);
  }

  if(!eligible.length){
    $("#testEmpty").classList.remove("hidden");
    $("#testArea").classList.add("hidden");
    $("#testEmptyTitle").textContent=S.testRangeMode==="folder"?"이 폴더에 시험 볼 단어가 없어":"테스트 목록이 비어 있어";
    $("#testEmptyText").textContent="시험졸업 단어는 보관함에서 ‘시험 넣기’를 누르면 다시 출제할 수 있어.";
    return;
  }

  $("#testEmpty").classList.add("hidden");
  $("#testArea").classList.remove("hidden");

  // 선택 범위의 시험졸업 제외 단어를 모두, 완전히 랜덤한 순서로 한 번씩 출제.
  S.testQueue=shuffle(eligible);
  S.testIndex=0;
  S.testCorrect=0;
  renderTest();
}
function renderTest(){
  if(S.testSkipTimer){
    clearTimeout(S.testSkipTimer);
    S.testSkipTimer=null;
  }
  if(S.testIndex>=S.testQueue.length){toast(`테스트 완료 ${S.testCorrect}/${S.testQueue.length}`);show("home");return}
  const w=S.testQueue[S.testIndex];$("#testNo").textContent=`${S.testIndex+1} / ${S.testQueue.length}`;$("#testScore").textContent=`${S.testCorrect} correct`;
  const c=langCfg();
  if(S.testMode==="meaning"){$("#promptLabel").textContent=`이 ${c.name} 단어의 뜻은?`;$("#question").textContent=w.term;$("#answer").placeholder="한국어 뜻 입력"}else{$("#promptLabel").textContent=`이 뜻의 ${c.name} 단어는?`;$("#question").textContent=w.meanings[0]||"";$("#answer").placeholder=`${c.name} 단어 입력`}
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
      const exact=localMeaningMatch(a,w.meanings||[]);
      if(exact){
        d={verdict:"correct",reason:"등록된 핵심 의미와 일치해.",acceptedMeaning:w.meanings[0]||""};
      }else{
        const cached=getGradeCache(w,a);
        if(cached){
          d=cached;
        }else{
          if(!needApi())throw Error("AI 연결 필요");
          const prompt=`${langCfg().name} 뜻 테스트 채점.
원어 단어:${w.term}
등록 뜻:${JSON.stringify(w.meanings)}
문맥:${w.context||"(없음)"}
학생 답:${a}
핵심 의미가 같으면 correct, 방향은 맞지만 부족하면 almost, 다르면 wrong.
JSON만:{"verdict":"correct"|"almost"|"wrong","reason":"짧은 한국어 한 문장","acceptedMeaning":"핵심 뜻"}`;
          d=parseAIJSON(responseText(await openai({
            model:taskModel("fast"),
            reasoning:{effort:"none"},
            text:{verbosity:"low"},
            max_output_tokens:220,
            input:prompt
          },{timeoutMs:25000,retries:0})));
          putGradeCache(w,a,d);
        }
      }
    }
    const v=d.verdict||"wrong",ok=v==="correct";markReviewed(w);let praise="";if(ok){rewardRecord("test",w.id);S.testCorrect++;S.meta.correct++;w.correct=(w.correct||0)+1;w.dueAt=now()+interval(w,"good");praise=randomPraise();toast(praise)}else{S.meta.wrong++;w.wrong=(w.wrong||0)+1;w.dueAt=now()+interval(w,v==="almost"?"hard":"again")}w.seen=(w.seen||0)+1;studyTouch();save();S.lastGrade={answer:a,verdict:v};const labels={correct:"정답 ✅",almost:"거의 맞음 △",wrong:"오답 ✕"};$("#resultBox").className=`result ${v}`;$("#resultBox").innerHTML=`<b>${labels[v]}</b>${praise?`<br><strong>${esc(praise)}</strong>`:""}<br>${esc(d.reason||"")}<br><small>핵심 뜻: ${esc(d.acceptedMeaning||w.meanings[0]||w.term)}</small>`;$("#answer").disabled=true;$("#graduateBtn").disabled=false;$("#nextBtn").classList.remove("hidden");
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

  const currentIndex=S.testIndex;

  markReviewed(w);
  w.skipCount=(w.skipCount||0)+1;
  w.seen=(w.seen||0)+1;

  // 모르겠음은 오답률에는 포함하지 않고 복습 우선순위만 높인다.
  w.strength=Math.max(0,(w.strength||0)-1);
  w.stability=Math.max(.25,(w.stability||.5)*.65);
  w.dueAt=now();
  w.testEnabled=true;

  studyTouch();
  save();

  $("#answer").disabled=true;
  $("#gradeBtn").disabled=true;
  $("#skipBtn").disabled=true;
  $("#graduateBtn").disabled=true;
  $("#nextBtn").classList.add("hidden");

  const answerText=S.testMode==="meaning"
    ? (w.meanings||[]).join(" · ")
    : w.term;

  $("#resultBox").className="result almost";
  $("#resultBox").innerHTML=`<b>정답 보기 👀</b><br><strong>${esc(answerText||"정답 정보 없음")}</strong><br><small>잠깐 보고 다음 문제로 넘어갈게.</small>`;

  // 약 1.6초 동안 정답을 보여준 뒤 자동으로 다음 문제.
  S.testSkipTimer=setTimeout(()=>{
    if(S.testIndex===currentIndex){
      S.testIndex++;
      renderTest();
    }
  },1600);
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
  syncFoldersFromWords();saveFolders();
  const groups=sourceGroups();
  const box=$("#sourceGroups");
  if(!groups.length){
    box.innerHTML=`<div class="empty-state"><div class="big-ico">🗂️</div><h3>아직 폴더가 없어</h3><p>위의 ‘＋ 폴더’를 눌러 직접 만들거나, 사진을 추가하면 출처 이름으로 자동 생성돼.</p></div>`;
    return;
  }
  box.innerHTML=groups.map(([name,words])=>{
    const ready=words.length?Math.round(avg(words,wordReadiness)):0;
    const risk=words.filter(w=>weakness(w)>=60).length;
    const graduated=words.filter(w=>w.testEnabled===false).length;
    const encoded=encodeURIComponent(name);
    const special=name==="출처 미지정";
    return `<div class="source-card">
      <div class="source-card-topline ${special?"no-menu":""}">
        <div class="source-card-title-wrap"><h3>${esc(name)}</h3><p>${words.length?`위험 ${risk}개 · 시험 졸업 ${graduated}개 · 준비도 ${ready}%`:"빈 폴더"}</p></div>
        <div class="source-card-menu">
          ${special?"":`<button data-source-rename="${encoded}">이름</button><button class="danger" data-source-delete="${encoded}">삭제</button>`}
        </div>
      </div>
      <span class="source-count">${words.length} words</span>
      <div class="source-mini-progress"><span style="width:${ready}%"></span></div>
      ${words.length?"":`<div class="empty-folder-note">단어를 옮겨 넣으면 여기에 표시돼.</div>`}
      <div class="source-actions source-actions-4">
        <button class="manage-source-btn" data-source-manage="${encoded}">☑ 단어 관리</button>
        <button data-source-review="${encoded}" ${words.length?"":"disabled"}>🚶 이 폴더 암기</button>
        <button data-source-test="${encoded}" ${words.length?"":"disabled"}>⚡ 이 폴더 시험</button>
        <button data-source-transform="${encoded}" ${words.length?"":"disabled"}>🔁 변형어</button>
      </div>
    </div>`;
  }).join("");
  $$('[data-source-manage]').forEach(b=>b.onclick=()=>openFolderManager(decodeURIComponent(b.dataset.sourceManage)));
  $$('[data-source-rename]').forEach(b=>b.onclick=()=>openFolderEdit("rename",decodeURIComponent(b.dataset.sourceRename)));
  $$('[data-source-delete]').forEach(b=>b.onclick=()=>{
    const name=decodeURIComponent(b.dataset.sourceDelete);
    const count=S.words.filter(w=>sourceKey(w)===name).length;
    const msg=count?`‘${name}’ 폴더를 삭제할까?\n안의 ${count}개 단어는 삭제하지 않고 ‘출처 미지정’으로 이동돼.`:`‘${name}’ 빈 폴더를 삭제할까?`;
    if(!confirm(msg))return;
    S.words.forEach(w=>{if(sourceKey(w)===name)w.sourceLabel=""});
    S.folders=S.folders.filter(f=>norm(f)!==norm(name));
    if(S.testSource===name)S.testSource=null;if(S.transformSource===name)S.transformSource=null;
    save();saveFolders();renderSources();toast("폴더 삭제 완료");
  });
  $$('[data-source-review]').forEach(b=>b.onclick=()=>{
    if(b.disabled)return;
    S.reviewRangeMode="folder";
    S.reviewSource=decodeURIComponent(b.dataset.sourceReview);
    S.reviewPreset=null;
    show("review");
  });
  $$('[data-source-test]').forEach(b=>b.onclick=()=>{
    if(b.disabled)return;S.testRangeMode="folder";S.testSource=decodeURIComponent(b.dataset.sourceTest);show("test");
  });
  $$('[data-source-transform]').forEach(b=>b.onclick=()=>{
    if(b.disabled)return;S.transformSource=decodeURIComponent(b.dataset.sourceTransform);show("transform");
  });
}

$("#newFolderBtn").onclick=()=>openFolderEdit("create");
$("#folderEditCancel").onclick=closeFolderEdit;
$("#folderEditSave").onclick=()=>{
  const name=cleanFolderName($("#folderNameInput").value);
  if(!name)return toast("폴더 이름을 입력해줘.");
  if(name==="출처 미지정")return toast("이 이름은 기본 폴더라 사용할 수 없어.");
  if(S.folderEditMode==="create"){
    if(folderNameExists(name))return toast("이미 같은 이름의 폴더가 있어.");
    S.folders.push(name);saveFolders();closeFolderEdit();renderSources();toast(`📁 ${name} 폴더 생성`);
  }else{
    const old=S.folderEditOldName;
    if(!old)return;
    if(norm(name)!==norm(old)&&folderNameExists(name,old))return toast("이미 같은 이름의 폴더가 있어.");
    S.folders=S.folders.map(f=>norm(f)===norm(old)?name:f);
    S.words.forEach(w=>{if(sourceKey(w)===old)w.sourceLabel=name});
    if(S.testSource===old)S.testSource=name;if(S.transformSource===old)S.transformSource=name;
    save();saveFolders();closeFolderEdit();renderSources();toast("폴더 이름 변경 완료");
  }
};
$("#folderNameInput").onkeydown=e=>{if(e.key==="Enter")$("#folderEditSave").click()};

$("#extractWordEditCancel").onclick=closeExtractWordEdit;
$("#extractWordEditSave").onclick=()=>{
  const key=S.extractEditKey;
  const item=getExtractItemByKey(key);
  if(!item)return closeExtractWordEdit();

  const term=String($("#extractEditTerm").value||"").trim();
  const meaningText=String($("#extractEditMeaning").value||"").trim();
  const meanings=meaningText
    .split(/\s*[\/;]\s*/)
    .map(x=>x.trim())
    .filter(Boolean);

  if(!term)return toast(`${langCfg().name} 단어/표현을 입력해줘.`);
  if(!meanings.length)return toast("한국어 뜻을 하나 이상 입력해줘.");

  item.term=term;
  item.meanings=[...new Set(meanings)];
  item.confidence=1;
  item.userEdited=true;

  closeExtractWordEdit();
  refreshPickRow(key);
  toast(`✏️ ${term} 수정 완료`);
};
$("#extractEditTerm").onkeydown=e=>{
  if(e.key==="Enter" && !e.isComposing){
    e.preventDefault();
    $("#extractEditMeaning").focus();
  }
};
$("#extractEditMeaning").onkeydown=e=>{
  if((e.ctrlKey||e.metaKey) && e.key==="Enter"){
    e.preventDefault();
    $("#extractWordEditSave").click();
  }
};
$("#extractWordEditModal").onclick=e=>{
  if(e.target.id==="extractWordEditModal")closeExtractWordEdit();
};

$("#folderManagerClose").onclick=closeFolderManager;
$("#folderWordEditCancel").onclick=closeFolderWordEdit;
$("#folderWordEditSave").onclick=()=>{
  const w=S.words.find(x=>x.id===S.folderWordEditId);
  if(!w)return closeFolderWordEdit();

  const term=String($("#folderEditTerm").value||"").trim();
  const meaningText=String($("#folderEditMeaning").value||"").trim();
  const meanings=meaningText.split(/\s*[\/;]\s*/).map(x=>x.trim()).filter(Boolean);

  if(!term)return toast(`${langCfg().name} 단어를 입력해줘.`);
  if(!meanings.length)return toast("한국어 뜻을 하나 이상 입력해줘.");

  const duplicate=S.words.find(x=>x.id!==w.id&&norm(x.term)===norm(term));
  if(duplicate)return toast(`이미 같은 ${langCfg().name} 단어가 단어장에 있어.`);

  // Only correct the content. Keep all study history/statistics untouched.
  w.term=term;
  w.meanings=[...new Set(meanings)];

  save();
  closeFolderWordEdit();
  renderFolderManager();
  renderSources();
  toast(`✏️ ${term} 수정 완료`);
};
$("#folderEditTerm").onkeydown=e=>{
  if(e.key==="Enter"){
    e.preventDefault();
    $("#folderEditMeaning").focus();
  }
};
$("#folderSelectAll").onchange=e=>{$$('[data-folder-word]').forEach(x=>x.checked=e.target.checked);updateFolderSelectedCount()};
$("#folderMoveBtn").onclick=()=>{
  const ids=selectedFolderWordIds();if(!ids.length)return;
  const target=$("#folderMoveTarget").value;
  if(target!=="출처 미지정")ensureFolder(target);
  const set=new Set(ids);
  S.words.forEach(w=>{if(set.has(w.id))w.sourceLabel=target==="출처 미지정"?"":target});
  save();saveFolders();
  const n=ids.length;renderFolderManager();renderSources();toast(`${n}개 단어 이동 완료`);
};
$("#folderDeleteWordsBtn").onclick=()=>{
  const ids=selectedFolderWordIds();if(!ids.length)return;
  if(!confirm(`선택한 ${ids.length}개 단어를 완전히 삭제할까?\n학습 기록도 함께 삭제돼.`))return;
  const set=new Set(ids);S.words=S.words.filter(w=>!set.has(w.id));
  save();renderFolderManager();renderSources();toast(`${ids.length}개 단어 삭제 완료`);
};

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
  S.reviewRangeMode="all";
  S.reviewSource=null;
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
$("#exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify({version:6,studyLang:S.studyLang,languageName:langCfg().name,words:S.words,meta:S.meta,folders:S.folders},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`VocabWalk-${S.studyLang}-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
$("#importFile").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.words))throw Error("올바른 백업이 아니야.");const backupLang=d.studyLang?validStudyLang(d.studyLang):"en";if(backupLang!==S.studyLang&&!confirm(`이 백업은 ${STUDY_LANGS[backupLang].name} 모드 데이터야. 현재 ${langCfg().name} 모드에 넣으면 언어가 섞일 수 있어. 그래도 불러올까?`))return;S.words=d.words;S.meta=d.meta||S.meta;S.folders=Array.isArray(d.folders)?d.folders:S.folders;migrate();save();renderLibrary();toast(`${langCfg().name} 모드에 ${S.words.length}개 복원`)}catch(err){toast(err.message)}finally{e.target.value=""}};
$("#clearBtn").onclick=()=>{if(confirm(`정말 ${langCfg().name} 모드의 모든 단어와 학습 기록을 삭제할까? 다른 언어 모드는 지워지지 않아.`)){S.words=[];S.meta={correct:0,wrong:0,lastStudy:null,streak:0};S.folders=[];save();renderLibrary();toast("전체 삭제 완료")}};

$("#sampleBtn").onclick=()=>{const samples={
  en:[{term:"reinforce",meanings:["강화하다","보강하다"],partOfSpeech:"v.",synonyms:["strengthen","bolster"],antonyms:["weaken"],derivatives:["reinforcement"]},{term:"undermine",meanings:["약화시키다","훼손하다"],partOfSpeech:"v."},{term:"compelling",meanings:["설득력 있는","매우 흥미로운"],partOfSpeech:"adj."}],
  ru:[{term:"помогать",meanings:["돕다"],partOfSpeech:"гл."},{term:"важный",meanings:["중요한"],partOfSpeech:"прил."},{term:"возможность",meanings:["가능성","기회"],partOfSpeech:"сущ."}],
  ja:[{term:"大切",meanings:["소중함","중요함"]},{term:"助ける",meanings:["돕다"]},{term:"機会",meanings:["기회"]}],
  fr:[{term:"important",meanings:["중요한"],partOfSpeech:"adj."},{term:"aider",meanings:["돕다"],partOfSpeech:"v."},{term:"possibilité",meanings:["가능성","기회"],partOfSpeech:"n."}],
  zh:[{term:"重要",meanings:["중요하다","중요한"]},{term:"帮助",meanings:["돕다","도움"]},{term:"机会",meanings:["기회"]}]
};const a=(samples[S.studyLang]||samples.en).map(x=>({...x,sourceType:"sample",sourceLabel:"샘플"}));let n=0;a.forEach(x=>{if(addWord(x))n++});save();toast(`${langCfg().name} 샘플 ${n}개 추가`)};

/* PWA install */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});
const installBtn=$("#installBtn");
if(installBtn)installBtn.onclick=()=>{const ua=navigator.userAgent;let guide;if(/iPhone|iPad|iPod/i.test(ua))guide="iPhone/iPad: 브라우저의 <b>공유 버튼</b> → <b>홈 화면에 추가</b> → 추가.";else guide="Android: 브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러. 설치 버튼이 지원되면 아래 버튼도 사용할 수 있어.";$("#installGuide").innerHTML=guide;$("#nativeInstallBtn").classList.toggle("hidden",!deferredPrompt);$("#installModal").classList.remove("hidden")};
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
migrate();syncFoldersFromWords();saveFolders();ensureRewardDay();saveReward();saveGradeCache();savePhotoCache();saveApiStats();ensureApiMonth();saveApiMonth();updateStudyLanguageUI();save();renderRewardStrip();renderApiUsage();renderPhotoQuota();renderBetaStatus();if(!S.betaCode)setTimeout(()=>$("#apiModal").classList.remove("hidden"),350);
if("serviceWorker"in navigator){
  window.addEventListener("load",async()=>{
    try{
      const reg=await navigator.serviceWorker.register("./service-worker.js?v=082",{updateViaCache:"none"});
      await reg.update();
    }catch(e){console.warn("SW update failed",e)}
  });
}
renderHome();
