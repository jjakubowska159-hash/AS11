import { useState, useEffect, useRef } from "react";

const GM: Record<number,[string,string,string]> = {
  1:["G","1-8","Ind"],2:["G","2-14","Ind"],3:["Sakralne","3-60","Ind"],
  4:["Ajna","4-63","Kol"],5:["Sakralne","5-15","Kol"],6:["SplotS","6-59","Plem"],
  7:["G","7-31","Kol"],8:["Gardło","1-8","Ind"],9:["Sakralne","9-52","Kol"],
  10:["G","10-20|10-34|10-57","Ind"],11:["Ajna","11-56","Kol"],12:["Gardło","12-22","Ind"],
  13:["G","13-33","Kol"],14:["Sakralne","2-14","Ind"],15:["G","5-15","Kol"],
  16:["Gardło","16-48","Kol"],17:["Ajna","17-62","Kol"],18:["Śledziona","18-58","Kol"],
  19:["Root","19-49","Plem"],20:["Gardło","10-20|20-34|20-57","Ind"],
  21:["Serce","21-45","Plem"],22:["SplotS","12-22","Ind"],
  23:["Gardło","23-43","Ind"],24:["Ajna","24-61","Ind"],25:["G","25-51","Ind"],
  26:["Serce","26-44","Plem"],27:["Sakralne","27-50","Plem"],28:["Śledziona","28-38","Ind"],
  29:["Sakralne","29-46","Kol"],30:["SplotS","30-41","Kol"],
  31:["Gardło","7-31","Kol"],32:["Śledziona","32-54","Plem"],33:["Gardło","13-33","Kol"],
  34:["Sakralne","10-34|20-34|34-57","Ind"],35:["Gardło","35-36","Kol"],
  36:["SplotS","35-36","Kol"],37:["SplotS","37-40","Plem"],
  38:["Root","28-38","Ind"],39:["Root","39-55","Ind"],40:["Serce","37-40","Plem"],
  41:["Root","30-41","Kol"],42:["Sakralne","42-53","Kol"],43:["Ajna","23-43","Ind"],
  44:["Śledziona","26-44","Plem"],45:["Gardło","21-45","Plem"],46:["G","29-46","Kol"],
  47:["Ajna","47-64","Kol"],48:["Śledziona","16-48","Kol"],49:["SplotS","19-49","Plem"],
  50:["Śledziona","27-50","Plem"],51:["Serce","25-51","Ind"],52:["Root","9-52","Kol"],
  53:["Root","42-53","Kol"],54:["Root","32-54","Plem"],55:["SplotS","39-55","Ind"],
  56:["Gardło","11-56","Kol"],57:["Śledziona","10-57|20-57|34-57","Ind"],58:["Root","18-58","Kol"],
  59:["Sakralne","6-59","Plem"],60:["Root","3-60","Ind"],61:["Head","24-61","Ind"],
  62:["Gardło","17-62","Kol"],63:["Head","4-63","Kol"],64:["Head","47-64","Kol"]
};

const CP = (() => {
  const seen = new Set<string>(), pairs: [number,number][] = [];
  Object.entries(GM).forEach(([g, arr]) => {
    arr[1].split('|').forEach(ch => {
      const [a,b] = ch.split('-').map(Number);
      const k = Math.min(a,b)+'-'+Math.max(a,b);
      if (!seen.has(k)) { seen.add(k); pairs.push([a,b]); }
    });
  });
  return pairs;
})();

const detect = (str: string) => {
  const gates = new Set(str.split(/[,\s\n]+/).map(Number).filter(n=>n>=1&&n<=64));
  const chs = CP.filter(([a,b])=>gates.has(a)&&gates.has(b));
  const ctrs = [...new Set(chs.flatMap(([a,b])=>[GM[a]?.[0],GM[b]?.[0]]).filter(Boolean))] as string[];
  return { chs: chs.map(([a,b])=>`${a}-${b}`), ctrs };
};

const LS_KEY = 'ana1_sessions';
const lsLoad = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); } catch { return []; } };
const lsSave = (data: any[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} };

const streamAPI = async (
  endpoint: string,
  payload: object,
  onChunk: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void
) => {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); onError("Błąd: "+(e.error||res.status)); return; }
    const reader = res.body!.getReader(), dec = new TextDecoder(); let buf = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim(); if (raw === "[DONE]") continue;
        try { const ev = JSON.parse(raw); if (ev.type==="content_block_delta"&&ev.delta?.type==="text_delta") onChunk(ev.delta.text); } catch {}
      }
    }
    onDone();
  } catch(e: any) { onError("Błąd: "+e.message); }
};

const Inline = ({text}: {text: string}) => {
  const parts: React.ReactNode[] = []; let last=0, i=0;
  const re=/\*\*(.+?)\*\*/g; let m: RegExpExecArray|null;
  while((m=re.exec(text))!==null){
    if(m.index>last) parts.push(<span key={i++}>{text.slice(last,m.index)}</span>);
    parts.push(<strong key={i++} style={{color:'#d4c49a',fontWeight:'bold'}}>{m[1]}</strong>);
    last=m.index+m[0].length;
  }
  if(last<text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return <>{parts.length?parts:text}</>;
};

const MD = ({text}: {text: string}) => {
  if(!text) return null;
  const c={
    h1:{fontSize:17,color:'#c4a870',letterSpacing:4,margin:'24px 0 10px',fontWeight:'normal' as const,fontFamily:'Georgia,serif'},
    h2:{fontSize:14,color:'#b8a888',letterSpacing:2,margin:'22px 0 8px',fontWeight:'normal' as const,borderBottom:'1px solid #2a2418',paddingBottom:8},
    h3:{fontSize:12,color:'#9a8868',letterSpacing:1,margin:'16px 0 6px',fontWeight:'bold' as const,fontFamily:'sans-serif',textTransform:'uppercase' as const},
    p:{fontSize:13,color:'#ccc4b4',lineHeight:1.95,margin:'3px 0',fontFamily:'Georgia,serif'},
    hr:{border:'none',borderTop:'1px solid #1e1c16',margin:'18px 0'},
    li:{fontSize:13,color:'#ccc4b4',lineHeight:1.9,margin:'2px 0',display:'flex',gap:8,fontFamily:'Georgia,serif'},
    it:{fontSize:12,color:'#7a6a50',fontStyle:'italic' as const,margin:'2px 0',fontFamily:'Georgia,serif'},
  };
  return (
    <div>
      {text.split('\n').map((line,i)=>{
        if(line.startsWith('# ')) return <div key={i} style={c.h1}>{line.slice(2)}</div>;
        if(line.startsWith('## ')) return <div key={i} style={c.h2}>{line.slice(3)}</div>;
        if(line.startsWith('### ')) return <div key={i} style={c.h3}>{line.slice(4)}</div>;
        if(line==='---') return <hr key={i} style={c.hr}/>;
        if(!line.trim()) return <div key={i} style={{height:5}}/>;
        if(line.startsWith('— ')||line.startsWith('- ')) return <div key={i} style={c.li}><span style={{color:'#b8a888',flexShrink:0}}>—</span><span><Inline text={line.slice(2)}/></span></div>;
        if(/^\d+\./.test(line)){const[n,...r]=line.split(/\.\s+/);return <div key={i} style={c.li}><span style={{color:'#b8a888',flexShrink:0,minWidth:14}}>{n}.</span><span><Inline text={r.join('. ')}/></span></div>;}
        if(line.startsWith('*')&&line.endsWith('*')&&!line.startsWith('**')) return <div key={i} style={c.it}>{line.slice(1,-1)}</div>;
        return <div key={i} style={c.p}><Inline text={line}/></div>;
      })}
    </div>
  );
};

const MDDoc = ({text}: {text: string}) => {
  if(!text) return null;
  const c={
    h1:{fontSize:22,color:'#211D2B',letterSpacing:'.02em',margin:'0 0 10px',fontWeight:'normal' as const,fontFamily:'"Source Serif 4",Georgia,serif',textAlign:'center' as const,paddingBottom:20,borderBottom:'2px solid #211D2B'},
    h2:{fontSize:11,color:'#5C6670',letterSpacing:'.16em',textTransform:'uppercase' as const,margin:'28px 0 10px',fontWeight:'normal' as const,fontFamily:'"IBM Plex Mono",ui-monospace,Menlo,monospace'},
    h3:{fontSize:13,color:'#A9782E',letterSpacing:0,margin:'14px 0 6px',fontWeight:'bold' as const,fontFamily:'"Source Serif 4",Georgia,serif'},
    p:{fontSize:14,color:'#211D2B',lineHeight:1.85,margin:'4px 0',fontFamily:'"Source Serif 4",Georgia,serif'},
    hr:{border:'none',borderTop:'1px solid #CFC7B8',margin:'22px 0'},
    li:{fontSize:14,color:'#211D2B',lineHeight:1.8,margin:'3px 0',display:'flex',gap:8,fontFamily:'"Source Serif 4",Georgia,serif'},
    it:{fontSize:11,color:'#5C6670',fontStyle:'normal' as const,textAlign:'center' as const,margin:'0 0 22px',fontFamily:'"IBM Plex Mono",ui-monospace,Menlo,monospace',letterSpacing:'.08em',textTransform:'uppercase' as const},
  };
  return (
    <div>
      {text.split('\n').map((line,i)=>{
        if(line.startsWith('# ')) return <div key={i} style={c.h1}>{line.slice(2)}</div>;
        if(line.startsWith('## ')) return <div key={i} style={c.h2}>{line.slice(3)}</div>;
        if(line.startsWith('### ')) return <div key={i} style={c.h3}>{line.slice(4)}</div>;
        if(line==='---') return <hr key={i} style={c.hr}/>;
        if(!line.trim()) return <div key={i} style={{height:6}}/>;
        if(line.startsWith('— ')||line.startsWith('- ')) return <div key={i} style={c.li}><span style={{color:'#c4a040',flexShrink:0}}>—</span><span><Inline text={line.slice(2)}/></span></div>;
        if(/^\d+\./.test(line)){const[n,...r]=line.split(/\.\s+/);return <div key={i} style={c.li}><span style={{color:'#c4a040',flexShrink:0,minWidth:16}}>{n}.</span><span><Inline text={r.join('. ')}/></span></div>;}
        if(line.startsWith('*')&&line.endsWith('*')&&!line.startsWith('**')) return <div key={i} style={c.it}>{line.slice(1,-1)}</div>;
        return <div key={i} style={c.p}><Inline text={line}/></div>;
      })}
    </div>
  );
};

export default function ANA1() {
  const [view,setView]           = useState('form');
  const [lang, setLang] = useState<'PL'|'DE'>('PL');
  const [form,setForm]           = useState<Record<string,string>>({});
  const [intake,setIntake]       = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [formTab,setFormTab]     = useState('chart');
  const [result,setResult]       = useState('');
  const [cliDoc,setCliDoc]       = useState('');
  const [loading,setLoading]     = useState(false);
  const [loadDoc,setLoadDoc]     = useState(false);
  const [error,setError]         = useState('');
  const [validErr,setValidErr]   = useState('');
  const [copied,setCopied]       = useState(false);
  const [copiedDoc,setCopiedDoc] = useState(false);
  const [sessions,setSessions]   = useState<any[]>([]);
  const [detected,setDetected]   = useState<{chs:string[],ctrs:string[]}>({chs:[],ctrs:[]});
  // ── Słońce / Ziemia panel ──
  const [showSE,setShowSE]       = useState(false);
  const [se,setSe]               = useState<Record<string,string>>({});
  const setSEf = (k: string, v: string) => setSe(f=>({...f,[k]:v}));
  const resultRef = useRef('');

  useEffect(() => { setSessions(lsLoad()); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if(form.gates) setDetected(detect(form.gates));
      else setDetected({chs:[],ctrs:[]});
    }, 300);
    return () => clearTimeout(t);
  }, [form.gates]);

  const setF = (k: string, v: string) => setForm(f=>({...f,[k]:v}));

  const saveArc = (res: string) => {
    const prev = lsLoad();
    const s = {
  id: Date.now(),
  name: form.name,
  date: form.date || new Date().toLocaleDateString('pl-PL'),
  hdType: form.hdType,
  profile: form.profile,
  lang,
  form: { ...form },
  result: res,
  ts: Date.now()
};
    const updated = [s,...prev].slice(0,49);
    lsSave(updated); setSessions(updated);
  };

  const delArc = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s=>s.id!==id);
    setSessions(updated); lsSave(updated);
  };

  const missing = () => {
    const m: string[] = [];
    if(!form.name) m.push("Imię");
    if(!form.hdType) m.push("Typ HD");
    if(!form.authority) m.push("Autorytet");
    if(!form.profile) m.push("Profil");
    if(!form.pain&&!intake) m.push("Wzorzec/ból");
    return m;
  };

  const goReview = () => { const m=missing(); if(m.length){setValidErr("Uzupełnij: "+m.join(" · "));return;} setValidErr(""); setView('review'); };

  const generate = async () => {
    setError(""); setResult(""); resultRef.current=""; setView('analysis'); setLoading(true);
    streamAPI(
      '/api/ana1-analysis',
      { lang, name:form.name, date:form.date, hdType:form.hdType, authority:form.authority, profile:form.profile, gates:form.gates, pain:form.pain, context:form.context, intake, detectedChs: form.gates?.trim() ? detect(form.gates).chs : undefined,
detectedCtrs: form.gates?.trim() ? detect(form.gates).ctrs : undefined, sunC:form.sunC, earthC:form.earthC, sunU:form.sunU, earthU:form.earthU, varTraw:form.varTraw, varSrod:form.varSrod, varSwiad:form.varSwiad, varPersp:form.varPersp },
      chunk => { resultRef.current+=chunk; setResult(p=>p+chunk); },
      () => { setLoading(false); saveArc(resultRef.current); },
      e => { setError(e); setLoading(false); }
    );
  };

  // ── Generuj dokument po sesji 1:1 (60 min) z Słońce/Ziemia ──────────────
  const genDoc = async () => {
    setCliDoc(""); setView('clientDoc'); setLoadDoc(true); setShowSE(false);
    streamAPI(
      '/api/ana1-doc',
{
  analysis: resultRef.current,
  detectedCtrs: form.gates?.trim() ? detect(form.gates).ctrs : undefined,
  detectedChs: form.gates?.trim() ? detect(form.gates).chs : undefined,
  name: form.name,
  date: form.date||"—",
  lang,
  varTraw:form.varTraw, varSrod:form.varSrod, varSwiad:form.varSwiad, varPersp:form.varPersp,
  sunPersonality:  se.sunP  || form.sunC  || "",
  earthPersonality: se.earthP || form.earthC || "",
  sunDesign:       se.sunD  || form.sunU  || "",
  earthDesign:     se.earthD || form.earthU || "",
},
      chunk => setCliDoc(p=>p+chunk),
      () => setLoadDoc(false),
      e => { setError(e); setLoadDoc(false); }
    );
  };
const genDocDirect = async () => {
  if (!form.gates?.trim()) {
  setError(
    'Uzupełnij aktywne bramy klienta przed wygenerowaniem dokumentu. Są potrzebne do ustalenia Centrów i kanałów.'
  );
  setView('clientDoc');
  setLoadDoc(false);
  return;
}

setError('');
  setCliDoc(""); setLoadDoc(true); setShowSE(false);
  streamAPI(
    '/api/ana1-doc',
    {
      sessionNotes,
      name: form.name,
      date: form.date||"—",
      hdType: form.hdType,
      authority: form.authority,
      profile: form.profile,
      pain: form.pain,
      gates: form.gates,
      detectedChs: detect(form.gates).chs,
      detectedCtrs: detect(form.gates).ctrs,
      lang,
      varTraw:form.varTraw, varSrod:form.varSrod, varSwiad:form.varSwiad, varPersp:form.varPersp,
      sunPersonality: se.sunP||form.sunC||"",
      earthPersonality: se.earthP||form.earthC||"",
      sunDesign: se.sunD||form.sunU||"",
      earthDesign: se.earthD||form.earthU||"",
    },
    chunk => setCliDoc(p=>p+chunk),
    () => setLoadDoc(false),
    e => { setError(e); setLoadDoc(false); }
  );
};
  // ── Wydruk / zapis do PDF ────────────────────────────────────────────────
  const mdToHtml = (content: string) =>
    content.split("\n").map(l => {
      const b = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      if (l.startsWith("# ")) return "<h1>" + b(l.slice(2)) + "</h1>";
      if (l.startsWith("## ")) return "<h2>" + b(l.slice(3)) + "</h2>";
      if (l.startsWith("### ")) return "<h3>" + b(l.slice(4)) + "</h3>";
      if (/^---+$/.test(l)) return "<hr/>";
      if (l.startsWith("— ") || l.startsWith("- ")) return "<li>" + b(l.slice(2)) + "</li>";
      if (/^\d+\.\s/.test(l)) return "<li>" + b(l.replace(/^\d+\.\s/, "")) + "</li>";
      if (l.startsWith("*") && l.endsWith("*") && !l.startsWith("**") && l.length > 2) return "<p class='meta'>" + b(l.slice(1, -1)) + "</p>";
      if (!l.trim()) return "";
      return "<p>" + b(l) + "</p>";
    }).join("");

  const handlePrint = (content: string, who: string, kind: "client" | "internal") => {
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) { setError("Przeglądarka zablokowała nowe okno — zezwól na wyskakujące okna i spróbuj ponownie."); return; }
    const cl = kind === "client";
    const printTitle = cl
  ? (lang === 'DE'
      ? 'Dein Spiegel Deine Karte Dein Weg'
      : 'Twoje Lustro Twoja Mapa Twoja Droga')
  : (lang === 'DE' ? 'Analyse' : 'Analiza');
    const css = cl
      ? "body{background:#F6F2EA;color:#211D2B;font-family:'Source Serif 4',Georgia,serif;max-width:760px;margin:40px auto;padding:0 36px;line-height:1.85}"
        + "h1{font-size:22px;font-weight:normal;text-align:center;border-bottom:2px solid #211D2B;padding-bottom:18px;margin:0 0 10px}"
        + "h2{font-size:11px;font-weight:normal;color:#5C6670;letter-spacing:.16em;text-transform:uppercase;font-family:'IBM Plex Mono',ui-monospace,monospace;margin:26px 0 8px}"
        + "h3{font-size:13px;color:#A9782E;margin:14px 0 5px}"
        + "p{font-size:14px;margin:5px 0}"
        + "p.meta{font-size:11px;color:#5C6670;text-align:center;letter-spacing:.08em;text-transform:uppercase;font-family:'IBM Plex Mono',ui-monospace,monospace;margin:0 0 22px}"
        + "li{font-size:14px;margin:3px 0;line-height:1.8}"
        + "strong{color:#A9782E}"
        + "hr{border:none;border-top:1px solid #CFC7B8;margin:20px 0}"
      : "body{background:#fff;color:#1a1a1a;font-family:Georgia,serif;max-width:820px;margin:26px auto;padding:0 30px;line-height:1.6}"
        + "h1{font-size:19px;font-weight:normal;letter-spacing:2px;border-bottom:2px solid #b8a888;padding-bottom:10px}"
        + "h2{font-size:13px;font-weight:normal;letter-spacing:1px;color:#7a5a20;border-bottom:1px solid #e6dcc4;padding-bottom:4px;margin:18px 0 6px}"
        + "h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a6a30;margin:12px 0 4px}"
        + "p{font-size:12.5px;margin:3px 0}"
        + "p.meta{font-size:11px;color:#777;font-style:italic}"
        + "li{font-size:12.5px;margin:2px 0}"
        + "strong{color:#000}"
        + "hr{border:none;border-top:1px solid #ddd;margin:12px 0}";
    const fonts = cl
      ? "<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap' rel='stylesheet'>"
      : "";
    const foot = cl ? "" : "<hr/><p class='meta'>Reflectorlab · analiza wewnętrzna · " + new Date().toLocaleDateString("pl-PL") + "</p>";
    win.document.write(
      "<!DOCTYPE html><html lang='pl'><head><meta charset='UTF-8'/><title>"
      + printTitle + " — " + who + "</title>" + fonts
      + "<style>" + css + "@media print{body{margin:12mm 0}h1,h2,h3{break-after:avoid}}</style></head><body>"
      + mdToHtml(content) + foot + "</body></html>"
    );
    win.document.close();
    setTimeout(() => win.print(), cl ? 800 : 300);
  };
  const copy = (txt: string, set: (v: boolean)=>void) => { navigator.clipboard.writeText(txt); set(true); setTimeout(()=>set(false),2500); };
  const reset = () => { setView('form'); setForm({}); setIntake(''); setResult(''); setCliDoc(''); setSessionNotes(''); setError(''); setValidErr(''); setDetected({chs:[],ctrs:[]}); setShowSE(false); setSe({}); resultRef.current=''; };

const S: Record<string,any> = {
    wrap:{minHeight:"100vh",background:"#0a0a0a",color:"#e0d8cc"},
    nav:{background:"#0d0c09",borderBottom:"1px solid #1e1c16",padding:"13px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"},
    nT:{fontSize:13,letterSpacing:4,color:"#b8a888",fontWeight:"normal",fontFamily:"Georgia,serif"},
    nB:(a:boolean)=>({background:a?"#1e1c14":"none",border:"1px solid "+(a?"#3a3020":"#252018"),color:a?"#b8a888":"#9a8a68",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:10,letterSpacing:2,fontFamily:"sans-serif"}),
    main:{padding:"24px 18px",maxWidth:740,margin:"0 auto"},
    card:{background:"#141414",border:"1px solid #252018",borderRadius:12,padding:24,marginBottom:14},
    sT:{fontSize:10,letterSpacing:3,color:"#b0a080",textTransform:"uppercase" as const,marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1e1c16",fontFamily:"sans-serif"},
    lbl:{fontSize:10,letterSpacing:2,color:"#b0a080",textTransform:"uppercase" as const,marginBottom:5,display:"block",fontFamily:"sans-serif"},
    hnt:{fontSize:11,color:"#9a8a70",marginBottom:5,fontStyle:"italic" as const,fontFamily:"sans-serif"},
    inp:{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:7,padding:"10px 12px",color:"#e0d8cc",fontSize:13,boxSizing:"border-box" as const,outline:"none",fontFamily:"Georgia,serif"},
    sel:{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:7,padding:"10px 12px",color:"#e0d8cc",fontSize:13,boxSizing:"border-box" as const,outline:"none",fontFamily:"sans-serif"},
    ta:(h?: number)=>({width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:7,padding:"10px 12px",color:"#e0d8cc",fontSize:12,boxSizing:"border-box" as const,outline:"none",resize:"vertical" as const,minHeight:h||80,fontFamily:"Georgia,serif",lineHeight:1.8}),
    fld:{marginBottom:16},
    req:{color:"#8a4030",marginLeft:2},
    btnG:{width:"100%",padding:"13px",borderRadius:8,border:"none",background:"#b8a888",color:"#0a0a0a",fontSize:12,fontWeight:"bold",cursor:"pointer",letterSpacing:2,fontFamily:"sans-serif"},
    btnD:{width:"100%",padding:"13px",borderRadius:8,border:"none",background:"#1a1a1a",color:"#3a3a3a",fontSize:12,fontWeight:"bold",cursor:"not-allowed" as const,letterSpacing:2,fontFamily:"sans-serif"},
    btnO:{background:"none",border:"1px solid #3a3020",color:"#b0a080",padding:"9px 16px",borderRadius:7,cursor:"pointer",fontSize:10,letterSpacing:2,fontFamily:"sans-serif"},
    btnS:{background:"#1e1c14",border:"1px solid #3a3020",color:"#b8a888",padding:"9px 20px",borderRadius:7,cursor:"pointer",fontSize:11,letterSpacing:2,fontWeight:"bold",fontFamily:"sans-serif"},
    btnSE:{background:"#0d1a0a",border:"1px solid #2a4020",color:"#7ab060",padding:"9px 20px",borderRadius:7,cursor:"pointer",fontSize:11,letterSpacing:2,fontWeight:"bold",fontFamily:"sans-serif"},
    row:{display:"flex",gap:8,marginTop:14,flexWrap:"wrap" as const,alignItems:"center"},
    div:{border:"none",borderTop:"1px solid #1e1c16",margin:"16px 0"},
    err:{background:"#1a0a08",border:"1px solid #4a2010",borderRadius:7,padding:"10px 14px",marginBottom:12,color:"#c06040",fontSize:12,fontFamily:"sans-serif"},
    det:{background:"#0d1209",border:"1px solid #2a3818",borderRadius:7,padding:"10px 14px",marginTop:8},
    seBox:{background:"#0a0f08",border:"1px solid #2a3818",borderRadius:10,padding:"18px 16px",marginBottom:14},
    seTitle:{fontSize:10,letterSpacing:3,color:"#5a8040",textTransform:"uppercase" as const,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #1a2010",fontFamily:"sans-serif"},
    tag:(t:string)=>({display:"inline-block",background:t==='g'?"#121a0a":"#0a1020",color:t==='g'?"#7ab060":"#5080b0",border:"1px solid "+(t==='g'?"#2a3818":"#183050"),borderRadius:20,padding:"2px 10px",fontSize:10,marginRight:4,marginBottom:3,fontFamily:"sans-serif",letterSpacing:1}),
    tab:(a:boolean)=>({padding:"8px 16px",background:"none",border:"none",borderBottom:"2px solid "+(a?"#b8a888":"transparent"),color:a?"#b8a888":"#5a5040",cursor:"pointer",fontSize:10,letterSpacing:2,fontFamily:"sans-serif",marginBottom:-1}),
    cur:{display:"inline-block",width:2,height:"0.9em",background:"#b8a888",marginLeft:2,verticalAlign:"text-bottom",animation:"blink 1s step-end infinite"},
    arcRow:{background:"#0f0e0a",border:"1px solid #252018",borderRadius:8,padding:"13px 16px",marginBottom:7,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"},
    docWrap:{background:"#F6F2EA",border:"1px solid #CFC7B8",borderRadius:12,padding:"40px 36px"},
    infoBox:{background:"#0f0e0a",border:"1px solid #2a2010",borderRadius:8,padding:"12px 16px",marginBottom:16},
    infoList:{margin:0,padding:"0 0 0 16px",color:"#a09070",fontSize:12,lineHeight:2,fontFamily:"sans-serif"},
  };

  // ─── WIDOK: FORMULARZ ────────────────────────────────────────────────────
  if(view==='form') return (
    <div style={S.wrap}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <nav style={S.nav}>
        <span style={S.nT}>⟡ ANA1 · v6</span>
        <div style={{display:"flex",gap:6}}>
          <button style={S.nB(true)}>NOWA SESJA</button>
          <button style={S.nB(false)} onClick={()=>setView('archive')}>ARCHIWUM{sessions.length>0?` (${sessions.length})`:""}</button>
        </div>
      </nav>
      <div style={S.main}>
        <div style={S.card}>
          <div style={S.infoBox}>
            <ul style={S.infoList}>
              <li>Analiza do sesji: Typ · Profil · Autorytet · 9 Centrów · Wzorzec · Narzędzie · plan 60 min</li>
              <li>Dokument dla klienta po sesji 1:1 — z sekcją Słońce/Ziemia świadome/nieświadome</li>
              <li>Live detektor bram — kanały i centra widoczne w czasie rzeczywistym</li>
              <li>Archiwum sesji — zapisane automatycznie w przeglądarce</li>
            </ul>
          </div>

          <div style={{borderBottom:"1px solid #1e1c16",marginBottom:18,display:"flex"}}>
            <button style={S.tab(formTab==='chart')} onClick={()=>setFormTab('chart')}>DANE CHARTU</button>
            <button style={S.tab(formTab==='intake')} onClick={()=>setFormTab('intake')}>NOTATNIK INTAKE{intake?" ✓":""}</button>
            <button style={S.tab(formTab==='session')} onClick={()=>setFormTab('session')}>SESJA GŁÓWNA{sessionNotes?" ✓":""}</button>
          </div>

          {formTab==='chart' && <>
            <div style={S.sT}>Klient</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
  <span style={{...S.lbl,marginBottom:0}}>Język dokumentów klienta</span>
  {(['PL','DE'] as const).map(l=>(
    <button key={l} style={S.nB(lang===l)} onClick={()=>setLang(l)}>{l}</button>
  ))}
</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div><label style={S.lbl}>Imię<span style={S.req}>*</span></label><input style={S.inp} placeholder="np. Anna" value={form.name||""} onChange={e=>setF("name",e.target.value)}/></div>
              <div><label style={S.lbl}>Data sesji</label><input style={S.inp} placeholder="12.05.2026" value={form.date||""} onChange={e=>setF("date",e.target.value)}/></div>
            </div>

            <div style={S.sT}>Chart HD</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
              {[
                {k:"hdType",l:"Typ HD",opts:["Generator","Manifestujący Generator (MG)","Projektor","Manifestor","Reflektor"]},
                {k:"authority",l:"Autorytet",opts:["Emocjonalny","Sakralny","Śledzionowy","Ego/Serce","Tożsamościowy (G)","Umysłowy","Księżycowy"]},
                {k:"profile",l:"Profil",opts:["1/3","1/4","2/4","2/5","3/5","3/6","4/6","4/1","5/1","5/2","6/2","6/3"]},
              ].map(f=>(
                <div key={f.k}>
                  <label style={S.lbl}>{f.l}<span style={S.req}>*</span></label>
                  <select style={S.sel} value={form[f.k]||""} onChange={e=>setF(f.k,e.target.value)}>
                    <option value="">— wybierz —</option>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={S.fld}>
              <label style={S.lbl}>Aktywne Bramy (Personality + Design)</label>
              <div style={S.hnt}>Wklej liczby po przecinku — detektor wyliczy kanały i centra na żywo</div>
              <textarea style={S.ta(65)} placeholder="np. 1, 8, 13, 20, 34, 38, 57, 10, 28..." value={form.gates||""} onChange={e=>setF("gates",e.target.value)}/>
              {detected.chs.length>0 && (
                <div style={S.det}>
                  <div style={{fontSize:9,color:"#5a8040",letterSpacing:2,marginBottom:7,fontFamily:"sans-serif"}}>⟡ WYKRYTE AUTOMATYCZNIE</div>
                  <div style={{marginBottom:5}}>
                    <span style={{fontSize:9,color:"#4a4030",fontFamily:"sans-serif",marginRight:6,letterSpacing:1}}>KANAŁY:</span>
                    {detected.chs.map(c=><span key={c} style={S.tag('b')}>{c}</span>)}
                  </div>
                  <div>
                    <span style={{fontSize:9,color:"#4a4030",fontFamily:"sans-serif",marginRight:6,letterSpacing:1}}>CENTRA DEF.:</span>
                    {detected.ctrs.map(c=><span key={c} style={S.tag('g')}>{c}</span>)}
                  </div>
                </div>
              )}
            </div>
<div style={{...S.card, marginBottom:14, border:"1px solid #1e2a1a"}}>
              <div style={{...S.sT, marginBottom:10}}>Aktywacje Słońca i Ziemi <span style={{color:"#3a3428",fontWeight:"normal",fontSize:9,letterSpacing:1}}>(opcjonalne — precyzują dobór narzędzia)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {k:"sunC",  l:"Świadome Słońce",    ph:"np. 1.1"},
                  {k:"earthC",l:"Świadoma Ziemia",     ph:"np. 2.1"},
                  {k:"sunU",  l:"Nieświadome Słońce",  ph:"np. 13.3"},
                  {k:"earthU",l:"Nieświadoma Ziemia",  ph:"np. 7.3"},
                ].map(f=>(
                  <div key={f.k} style={S.fld}>
                    <label style={S.lbl}>{f.l}</label>
                    <input style={S.inp} placeholder={f.ph} value={form[f.k]||""} onChange={e=>setF(f.k,e.target.value)}/>
                  </div>
                ))}
              </div>
              {(form.sunC||form.earthC||form.sunU||form.earthU) && (
                <div style={{fontSize:11,color:"#5a8040",marginTop:4,fontFamily:"sans-serif",letterSpacing:1}}>
                  ⟡ dane trafią do doboru narzędzia podświadomości
                </div>
              )}
            </div>
            <div style={{...S.card, marginBottom:14, border:"1px solid #1e2a1a"}}>
              <div style={{...S.sT, marginBottom:10}}>Variables — Strzałki <span style={{color:"#3a3428",fontWeight:"normal",fontSize:9,letterSpacing:1}}>(opcjonalne — jak ta osoba porusza się w świecie)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {k:"varTraw", l:"Trawienie · lewa góra",  opts:["← Aktywne","→ Pasywne"]},
                  {k:"varSrod", l:"Środowisko · lewy dół",  opts:["← Spójne","→ Zmienne"]},
                  {k:"varSwiad",l:"Świadomość · prawa góra",opts:["← Strategiczna","→ Receptywna"]},
                  {k:"varPersp",l:"Perspektywa · prawy dół",opts:["← Skupiona","→ Peryferyjna"]},
                ].map(f=>(
                  <div key={f.k}>
                    <label style={S.lbl}>{f.l}</label>
                    <select style={S.sel} value={form[f.k]||""} onChange={e=>setF(f.k,e.target.value)}>
                      <option value="">— nie podano —</option>
                      {f.opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.sT}>Serce sesji</div>
            <div style={S.fld}>
              <label style={S.lbl}>Główny ból / wzorzec<span style={S.req}>*</span></label>
              <textarea style={S.ta()} placeholder="Co klienta sprowadza? Jaki schemat się powtarza? Co chce zmienić?" value={form.pain||""} onChange={e=>setF("pain",e.target.value)}/>
            </div>
            <div style={S.fld}>
              <label style={S.lbl}>Dodatkowy kontekst <span style={{color:"#3a3428"}}>opcjonalnie</span></label>
              <textarea style={S.ta(55)} placeholder="Wiek, etap życia, praca, relacje, znajomość HD..." value={form.context||""} onChange={e=>setF("context",e.target.value)}/>
            </div>
          </>}

          {formTab==='intake' && <>
            <div style={S.sT}>Notatnik — rozmowa wstępna (bezpłatna, 30 min)</div>
            <div style={{...S.hnt,marginBottom:12,fontSize:12}}>Notuj podczas rozmowy wstępnej. Te notatki trafiają do Twojej analizy przygotowawczej.</div>
            <textarea
              style={{...S.ta(300),lineHeight:2}}
              placeholder={"Co mówi...\nCo powtarza...\nJakie słowa używa...\nCo jest za tym...\nJakie emocje...\nCo ukrywa...\nCo go zaskoczyło..."}
              value={intake}
              onChange={e=>setIntake(e.target.value)}
            />
            {intake&&<div style={{fontSize:11,color:"#5a8040",marginTop:7,fontFamily:"sans-serif",letterSpacing:1}}>{intake.length} znaków · ✓ trafi do analizy</div>}
          </>}
{formTab==='session' && <>
  <div style={S.sT}>Notatnik — sesja 1:1 (60 min)</div>
  <div style={{...S.hnt,marginBottom:12,fontSize:12}}>Notatki z sesji — niezależnie od analizy. Trafią do dokumentu dla klienta.</div>
  <textarea
    style={{...S.ta(300),lineHeight:2}}
    placeholder={"Co się pojawiło...\nPrzełomy...\nKluczowe wglądy...\nCo zaskoczyło klienta...\nJakie narzędzie wybrałyśmy..."}
    value={sessionNotes}
    onChange={e=>setSessionNotes(e.target.value)}
  />
  {sessionNotes&&<div style={{fontSize:11,color:"#5a8040",marginTop:7,fontFamily:"sans-serif",letterSpacing:1}}>{sessionNotes.length} znaków · ✓ trafi do dokumentu klienta</div>}
</>}
          {validErr&&<div style={{...S.err,marginTop:12}}>{validErr}</div>}
<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
  <button style={missing().length?S.btnD:S.btnG} disabled={!!missing().length} onClick={goReview}>
    ⟡ ANALIZA + PLAN SESJI
  </button>
  <button
    style={(missing().length||!sessionNotes.trim())?S.btnD:{...S.btnS,width:"100%",padding:"13px"}}
    disabled={!!missing().length||!sessionNotes.trim()}
    onClick={()=>{genDocDirect();setView('clientDoc');}}
  >
    ⟡ DOKUMENT DLA KLIENTA PO SESJI →
  </button>
</div>
        </div>
      </div>
    </div>
  );

  // ─── WIDOK: REVIEW ───────────────────────────────────────────────────────
  if(view==='review') return (
    <div style={S.wrap}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <nav style={S.nav}><span style={S.nT}>⟡ Przegląd danych</span><button style={S.nB(false)} onClick={()=>setView('form')}>← WRÓĆ</button></nav>
      <div style={S.main}><div style={S.card}>
        <div style={S.sT}>Dane do analizy</div>
        {([["Klient",form.name],["Data",form.date||"—"],["Typ HD",form.hdType],["Autorytet",form.authority],["Profil",form.profile],["Bramy",form.gates||"—"],["Ból/wzorzec",form.pain||"—"],intake?["Notatki intake",intake.slice(0,100)+(intake.length>100?"...":"")]:null] as [string,string][]).filter(Boolean).map(([k,v])=>(
          <div key={k} style={{marginBottom:10}}>
            <div style={{fontSize:9,color:"#5a5040",letterSpacing:2,textTransform:"uppercase",fontFamily:"sans-serif"}}>{k}</div>
            <div style={{fontSize:12,color:"#e0d8cc",marginTop:2,lineHeight:1.7,fontFamily:"Georgia,serif"}}>{v}</div>
          </div>
        ))}
        {detected.chs.length>0&&<div style={{marginBottom:10}}>
          <div style={{fontSize:9,color:"#5a7040",letterSpacing:2,textTransform:"uppercase",fontFamily:"sans-serif",marginBottom:5}}>KANAŁY WYKRYTE</div>
          {detected.chs.map(c=><span key={c} style={S.tag('b')}>{c}</span>)}
        </div>}
        <hr style={S.div}/>
        {error&&<div style={S.err}>{error}</div>}
        <button style={S.btnG} onClick={generate}>⟡ GENERUJ ANALIZĘ</button>
        <div style={{textAlign:"center",marginTop:10}}><button style={S.btnO} onClick={()=>{setError("");setView('form');}}>← edytuj</button></div>
      </div></div>
    </div>
  );

  // ─── WIDOK: ANALIZA ──────────────────────────────────────────────────────
  if(view==='analysis') return (
    <div style={S.wrap}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <nav style={S.nav}>
        <span style={S.nT}>⟡ {form.name||"analiza"}</span>
        <div style={{display:"flex",gap:6}}>
          {!loading&&<button style={S.nB(false)} onClick={reset}>NOWA SESJA</button>}
          <button
  style={{
    ...S.nB(false),
    opacity: loading ? 0.4 : 1,
    cursor: loading ? 'not-allowed' : 'pointer'
  }}
  disabled={loading}
  onClick={() => setView('archive')}
>
  ARCHIWUM
</button>
        </div>
      </nav>
      <div style={S.main}><div style={S.card}>
        {loading&&!result&&<div style={{textAlign:"center",padding:"50px 0",color:"#7a6a50",fontSize:11,letterSpacing:2,fontFamily:"sans-serif"}}>⟡<br/><br/>ANA1 analizuje...<br/><span style={{fontSize:10,color:"#3a3428"}}>głęboka analiza — chwilę</span></div>}
        {result&&<><MD text={result}/>{loading&&<span style={S.cur}/>}</>}

        {!loading&&result&&<>
          <hr style={S.div}/>

          {/* ── Panel Słońce / Ziemia ── */}
          {showSE&&(
            <div style={S.seBox}>
              <div style={S.seTitle}>☉ Słońce i Ziemia — sekcja do dokumentu klienta</div>
              <div style={{fontSize:11,color:"#3a4a30",marginBottom:14,fontFamily:"sans-serif",fontStyle:"italic"}}>
                Opcjonalnie — wpisz numer bramy i krótki opis (2-3 zdania). Trafia jako osobna sekcja do dokumentu klienta.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {k:"sunP",  l:"☉ Słońce Świadome",  sub:"Personality Sun",  ph:"Brama X — co to mówi o tej osobie..."},
                  {k:"earthP",l:"⊕ Ziemia Świadoma",  sub:"Personality Earth", ph:"Brama X — zakorzenienie, równowaga..."},
                  {k:"sunD",  l:"☉ Słońce Nieświadome",sub:"Design Sun",       ph:"Brama X — nieświadoma siła napędowa..."},
                  {k:"earthD",l:"⊕ Ziemia Nieświadoma",sub:"Design Earth",     ph:"Brama X — nieświadome zakorzenienie..."},
                ].map(f=>(
                  <div key={f.k} style={S.fld}>
                    <label style={{...S.lbl,color:"#5a8040"}}>
                      {f.l}
                      <span style={{color:"#3a4a30",marginLeft:4,fontWeight:"normal",textTransform:"none" as const,fontSize:9}}>{f.sub}</span>
                    </label>
                    <textarea style={{...S.ta(70),background:"#0d150a",border:"1px solid #2a3818",color:"#c0d8b0"}} placeholder={f.ph} value={se[f.k]||""} onChange={e=>setSEf(f.k,e.target.value)}/>
                  </div>
                ))}
              </div>
              <button style={{...S.btnG,background:"#4a7030",marginTop:4}} onClick={genDoc}>⟡ GENERUJ DOKUMENT DLA KLIENTA →</button>
            </div>
          )}

          <div style={S.row}>
            <button style={S.btnO} onClick={reset}>⟡ Nowa</button>
            <button style={S.btnO} onClick={()=>copy(result,setCopied)}>{copied?"SKOPIOWANO ✓":"KOPIUJ"}</button>
            <button style={S.btnO} onClick={()=>handlePrint(result,form.name||"analiza","internal")}>⬇ PDF</button>
            <button style={{...S.btnS,flex:1}} onClick={()=>setShowSE(v=>!v)}>
              {showSE?"ZAMKNIJ PANEL ×":"DOKUMENT DLA KLIENTA →"}
            </button>
          </div>
        </>}

        {!loading&&!result&&error&&<div>
          <div style={S.err}>{error}</div>
          <div style={S.row}>
            <button style={S.btnO} onClick={()=>setView('review')}>← wróć</button>
            <button style={{...S.btnG,flex:1,padding:"9px"}} onClick={generate}>Spróbuj ponownie</button>
          </div>
        </div>}
      </div></div>
    </div>
  );

  // ─── WIDOK: DOKUMENT DLA KLIENTA PO SESJI 1:1 ────────────────────────────
  if(view==='clientDoc') return (
    <div style={S.wrap}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <nav style={S.nav}>
        <span style={S.nT}>⟡ Dokument klienta · {form.name}</span>
        <div style={{display:"flex",gap:6}}>
          {!loadDoc&&<button style={S.nB(false)} onClick={()=>setView('analysis')}>← ANALIZA</button>}
          <button style={S.nB(false)} onClick={reset}>NOWA SESJA</button>
        </div>
      </nav>
      <div style={S.main}>
        {loadDoc&&!cliDoc&&<div style={{textAlign:"center",padding:"60px 0",color:"#9a8060",fontSize:11,letterSpacing:2,fontFamily:"sans-serif"}}>⟡<br/><br/>Tworzę dokument dla {form.name}...<br/><span style={{fontSize:10,color:"#5a4020"}}>personalny · elegancki · głęboki</span></div>}
        {cliDoc&&<div style={S.docWrap}><MDDoc text={cliDoc}/>{loadDoc&&<span style={{...S.cur,background:"#c4a040"}}/>}</div>}
                {!loadDoc&&!cliDoc&&error&&<div>
          <div style={S.err}>{error}</div>
          <div style={S.row}>
            <button style={S.btnO} onClick={()=>setView('form')}>← wróć do formularza</button>
            <button style={{...S.btnG,flex:1,padding:"9px"}} onClick={genDocDirect}>Spróbuj ponownie</button>
          </div>
        </div>}
        {!loadDoc&&cliDoc&&<div style={{...S.row,marginTop:12}}>
          <button style={S.btnO} onClick={()=>setView('analysis')}>← analiza</button>
          <button style={S.btnO} onClick={()=>copy(cliDoc,setCopiedDoc)}>{copiedDoc?"SKOPIOWANO ✓":"KOPIUJ DOKUMENT"}</button>
          <button style={S.btnO} onClick={()=>handlePrint(cliDoc,form.name,"client")}>⬇ PDF</button>
          <button style={{...S.btnS,flex:1}} onClick={()=>{ setShowSE(true); setView('analysis'); }}>EDYTUJ SŁOŃCE/ZIEMIA</button>
        </div>}
      </div>
    </div>
  );

  // ─── WIDOK: ARCHIWUM ─────────────────────────────────────────────────────
  if(view==='archive') return (
    <div style={S.wrap}>
      <nav style={S.nav}>
        <span style={S.nT}>⟡ Archiwum sesji</span>
        <button style={S.nB(false)} onClick={()=>setView('form')}>+ NOWA SESJA</button>
      </nav>
      <div style={S.main}><div style={S.card}>
        <div style={S.sT}>Zapisane analizy ({sessions.length})</div>
        {sessions.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#3a3428",fontSize:11,letterSpacing:2,fontFamily:"sans-serif"}}>Brak zapisanych sesji</div>}
        {sessions.map((sess: any)=>(
          <div
  key={sess.id}
  style={S.arcRow}
  onClick={() => {
    const savedForm = sess.form || {
      name: sess.name,
      date: sess.date,
      hdType: sess.hdType,
      profile: sess.profile
    };

    setSe({});
    setShowSE(false);
    setIntake('');
    setSessionNotes('');
    setCliDoc('');
    setError('');
    setValidErr('');
    setCopied(false);
    setCopiedDoc(false);
    setFormTab('chart');

    setForm(savedForm);
    setLang(sess.lang === 'DE' ? 'DE' : 'PL');

    setDetected(
      savedForm.gates?.trim()
        ? detect(savedForm.gates)
        : { chs: [], ctrs: [] }
    );

    setResult(sess.result || '');
    resultRef.current = sess.result || '';
    setView('analysis');
  }}
>
            <div>
              <div style={{fontSize:13,color:"#e0d8cc",marginBottom:2,fontFamily:"Georgia,serif"}}>{sess.name}</div>
              <div style={{fontSize:10,color:"#5a5040",fontFamily:"sans-serif",letterSpacing:1}}>{sess.date} · {sess.hdType} · {sess.profile}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#3a3428",fontFamily:"sans-serif"}}>{new Date(sess.ts).toLocaleDateString('pl-PL')}</span>
              <button style={{...S.btnO,padding:"4px 10px",fontSize:9}} onClick={e=>delArc(sess.id,e)}>usuń</button>
            </div>
          </div>
        ))}
      </div></div>
    </div>
  );

  return null;
}