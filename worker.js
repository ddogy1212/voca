const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODELS = { standard: "gpt-5.6-luna", precision: "gpt-5.6-terra" };
const bursts = new Map();

function json(data,status=200,origin="*"){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "Access-Control-Allow-Origin":origin||"*",
      "Access-Control-Allow-Methods":"POST, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type, X-VocabWalk-Invite",
      "Vary":"Origin"
    }
  });
}
function allowedOrigin(request,env){
  const origin=request.headers.get("Origin")||"";
  const raw=String(env.ALLOWED_ORIGIN||"").trim();
  if(!raw)return origin||"*";
  const allowed=raw.split(",").map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin)?origin:"";
}
function parseInvites(env){
  return String(env.BETA_INVITE_CODES||"")
    .split(",").map(x=>x.trim()).filter(Boolean)
    .map(entry=>{const i=entry.indexOf(":");return i>0?{label:entry.slice(0,i).trim(),code:entry.slice(i+1).trim()}:{label:"friend",code:entry}})
    .filter(x=>x.code);
}
function same(a,b){
  a=String(a||"");b=String(b||"");
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function auth(request,env){
  const code=(request.headers.get("X-VocabWalk-Invite")||"").trim();
  return parseInvites(env).find(x=>same(code,x.code))||null;
}
function burstOkay(label){
  const now=Date.now(),key=label||"friend",old=bursts.get(key)||[];
  const recent=old.filter(t=>now-t<60_000);
  if(recent.length>=40)return false;
  recent.push(now);bursts.set(key,recent);return true;
}
function sanitizeRequest(x,precision){
  if(!x||typeof x!=="object"||!Array.isArray(x.input)||!x.input.length)throw Error("AI 입력이 비어 있어.");
  const raw=JSON.stringify(x.input);
  if(raw.length>5_500_000)throw Error("사진 요청이 너무 커. 사진을 줄이거나 다시 선택해줘.");
  const imageCount=(raw.match(/\"type\":\"input_image\"/g)||[]).length;
  if(imageCount>1)throw Error("요청 1회당 사진 1장만 허용해.");
  return {
    input:x.input,
    text:x.text,
    max_output_tokens:Math.min(Math.max(64,Number(x.max_output_tokens||1200)),precision?3200:2800),
    reasoning:{effort:"none"},
    store:false
  };
}

export default {
  async fetch(request,env){
    const origin=allowedOrigin(request,env);
    if(request.method==="OPTIONS"){
      if(!origin)return json({error:"허용되지 않은 사이트 요청이야."},403,"*");
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":origin,
        "Access-Control-Allow-Methods":"POST, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type, X-VocabWalk-Invite",
        "Access-Control-Max-Age":"86400",
        "Vary":"Origin"
      }});
    }
    if(!origin)return json({error:"허용되지 않은 사이트 요청이야."},403,"*");
    const url=new URL(request.url);
    if(request.method!=="POST")return json({ok:true,service:"VocabWalk Beta Worker",build:77},200,origin);
    const invite=auth(request,env);
    if(!invite)return json({error:"초대코드를 확인해줘."},401,origin);
    if(!burstOkay(invite.label))return json({error:"요청이 너무 빠르게 반복됐어. 잠깐 뒤 다시 해줘."},429,origin);
    if(url.pathname.endsWith("/ping"))return json({ok:true,label:invite.label,build:77},200,origin);
    if(!url.pathname.endsWith("/ai"))return json({error:"없는 경로야."},404,origin);
    if(!env.OPENAI_API_KEY)return json({error:"Worker에 OPENAI_API_KEY가 아직 설정되지 않았어."},500,origin);

    try{
      const body=await request.json();
      const mode=body?.mode==="precision"?"precision":"standard";
      const model=MODELS[mode]; // Client cannot choose Sol or any other model.
      const clean=sanitizeRequest(body?.request,mode==="precision");
      const upstream=await fetch(OPENAI_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${env.OPENAI_API_KEY}`},
        body:JSON.stringify({model,...clean})
      });
      const data=await upstream.json().catch(()=>({}));
      if(!upstream.ok)return json({error:data?.error?.message||`OpenAI 오류 ${upstream.status}`},upstream.status,origin);
      const u=data?.usage||{};
      console.log(JSON.stringify({event:"vocabwalk_ai",invite:invite.label,model,mode,input_tokens:u.input_tokens||0,output_tokens:u.output_tokens||0,ts:new Date().toISOString()}));
      data._vocabwalk_model=model;data._vocabwalk_invite=invite.label;
      return json(data,200,origin);
    }catch(e){
      return json({error:e?.message||"AI 요청 처리 실패"},400,origin);
    }
  }
};
