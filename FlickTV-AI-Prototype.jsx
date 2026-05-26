import { useState, useEffect, useRef } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#060810",
  bgCard:      "#0D1117",
  bgElevated:  "#131924",
  surface:     "#1A2332",
  surfaceHigh: "#1E2A3A",
  accent:      "#00D4FF",
  accentDim:   "#0099BB",
  gold:        "#FFB800",
  success:     "#00E676",
  danger:      "#FF4444",
  purple:      "#8B5CF6",
  textPrimary: "#FFFFFF",
  textSec:     "#8B9BBB",
  textMuted:   "#455670",
  glass:       "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.08)",
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id:"1",  name:"CNN International", category:"news",     group:"News",        logo:"📺", country:"US", isHd:true,  isLive:true,  color:"#CC0000" },
  { id:"2",  name:"BBC World News",    category:"news",     group:"News",        logo:"🔴", country:"GB", isHd:true,  isLive:true,  color:"#BB1919" },
  { id:"3",  name:"Al Jazeera",        category:"news",     group:"News",        logo:"🌐", country:"QA", isHd:true,  isLive:true,  color:"#00A86B" },
  { id:"4",  name:"ESPN HD",           category:"sports",   group:"Sports",      logo:"⚽", country:"US", isHd:true,  isLive:true,  color:"#CC0000" },
  { id:"5",  name:"Sky Sports",        category:"sports",   group:"Sports",      logo:"🏆", country:"GB", isHd:true,  isLive:true,  color:"#005099" },
  { id:"6",  name:"beIN Sports",       category:"sports",   group:"Sports",      logo:"🔵", country:"QA", isHd:true,  isLive:true,  color:"#005A8C" },
  { id:"7",  name:"HBO Max",           category:"movies",   group:"Movies",      logo:"🎬", country:"US", isHd:true,  isLive:false, color:"#6C2BD9" },
  { id:"8",  name:"Cartoon Network",  category:"kids",     group:"Kids",        logo:"🎭", country:"US", isHd:false, isLive:true,  color:"#F7912A" },
  { id:"9",  name:"MTV Hits",         category:"music",    group:"Music",       logo:"🎵", country:"US", isHd:false, isLive:true,  color:"#FF6600" },
  { id:"10", name:"National Geo",     category:"doc",      group:"Documentary", logo:"🌍", country:"US", isHd:true,  isLive:false, color:"#FFCD00" },
  { id:"11", name:"Islam Channel",    category:"religious",group:"Religious",   logo:"☪️", country:"GB", isHd:false, isLive:true,  color:"#1B5E20" },
  { id:"12", name:"France 24",        category:"news",     group:"News",        logo:"🇫🇷", country:"FR", isHd:true, isLive:true,  color:"#003189" },
  { id:"13", name:"Discovery",        category:"doc",      group:"Documentary", logo:"🔬", country:"US", isHd:true,  isLive:false, color:"#0081CC" },
  { id:"14", name:"Nick Jr.",         category:"kids",     group:"Kids",        logo:"🦄", country:"US", isHd:false, isLive:true,  color:"#FF8C00" },
  { id:"15", name:"BBC One",          category:"entertainment",group:"Entertainment",logo:"🎪",country:"GB",isHd:true,isLive:true,color:"#CC0000"},
  { id:"16", name:"FOX Sports",       category:"sports",   group:"Sports",      logo:"🦊", country:"US", isHd:true,  isLive:true,  color:"#003087" },
  { id:"17", name:"TV5 Monde",        category:"entertainment",group:"Entertainment",logo:"🎭",country:"FR",isHd:true,isLive:true,color:"#004B9E"},
  { id:"18", name:"DW News",          category:"news",     group:"News",        logo:"🇩🇪", country:"DE", isHd:true, isLive:true,  color:"#CC0000" },
];

const CATEGORIES = [
  { id:"all",           label:"All",           emoji:"📺" },
  { id:"news",          label:"News",          emoji:"📰" },
  { id:"sports",        label:"Sports",        emoji:"⚽" },
  { id:"movies",        label:"Movies",        emoji:"🎬" },
  { id:"entertainment", label:"TV",            emoji:"🎪" },
  { id:"kids",          label:"Kids",          emoji:"🦄" },
  { id:"music",         label:"Music",         emoji:"🎵" },
  { id:"doc",           label:"Docs",          emoji:"🔬" },
  { id:"religious",     label:"Religious",     emoji:"☪️" },
];

const AI_RESPONSES = {
  news:    { msg:"Here are the top news channels I found for you! 📰 CNN, BBC, and Al Jazeera are all streaming live right now.", channels:["1","2","3"] },
  sports:  { msg:"Game on! 🏆 I found these sports channels with live coverage happening right now.", channels:["4","5","6"] },
  fix:     { msg:"Let me diagnose that stream for you 🔧\n\n**Diagnosis:** The stream URL may have expired or the server is temporarily down.\n\n**Fixes:**\n• Refresh the playlist to get updated URLs\n• Check your internet connection\n• Try switching to a backup stream\n• Contact your IPTV provider", channels:[] },
  recommend:{ msg:"Based on your viewing history, I recommend these channels for you! ✨", channels:["2","5","10","11"] },
  default: { msg:"I found some channels matching your search! Tap any to start watching.", channels:["1","4","7"] },
};

// ─── ICONS (inline SVG components) ────────────────────────────────────────────
const Icon = ({ name, size=20, color=C.textSec, style={} }) => {
  const icons = {
    home:    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={color}/>,
    live:    <><circle cx="12" cy="12" r="3" fill={color}/><path d="M20.94 11A8.994 8.994 0 0012 3a8.994 8.994 0 00-8.94 8H1a11 11 0 0022 0z" fill={color}/></>,
    search:  <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16a6.47 6.47 0 004.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 115 9.5 4.5 4.5 0 019.5 14z" fill={color}/>,
    heart:   <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" fill={color}/>,
    profile: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill={color}/>,
    star:    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill={color}/>,
    play:    <path d="M8 5v14l11-7z" fill={color}/>,
    add:     <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" fill={color}/>,
    ai:      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill={color}/>,
    close:   <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill={color}/>,
    send:    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={color}/>,
    back:    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" fill={color}/>,
    mic:     <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a1 1 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" fill={color}/>,
    import:  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill={color}/>,
    settings:<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87a.49.49 0 00.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill={color}/>,
    fix:     <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill={color}/>,
    check:   <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={color}/>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style}>
      {icons[name] || null}
    </svg>
  );
};

// ─── CHANNEL CARD ──────────────────────────────────────────────────────────────
const ChannelCard = ({ ch, onPlay, onFav, isFav, size="md" }) => {
  const isLg = size === "lg";
  return (
    <div
      onClick={onPlay}
      style={{
        background: `linear-gradient(135deg, ${C.surface}, ${C.bgCard})`,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        ...(isLg
          ? { display:"flex", alignItems:"center", padding:12, gap:12, marginBottom:8 }
          : { width: 140, flexShrink:0 }),
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.accent + "55";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${C.accent}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.glassBorder;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Logo area */}
      <div style={{
        ...(isLg
          ? { width:52, height:52, borderRadius:12, flexShrink:0 }
          : { height:90 }),
        background: `linear-gradient(135deg, ${ch.color}33, ${ch.color}11)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize: isLg ? 26 : 36,
        position:"relative",
      }}>
        {ch.logo}
        {ch.isLive && (
          <div style={{
            position:"absolute", top:6, left:6,
            display:"flex", alignItems:"center", gap:3,
            background:"rgba(255,68,68,0.9)", borderRadius:4,
            padding:"2px 5px",
          }}>
            <div style={{ width:5, height:5, borderRadius:9999, background:"#fff", animation:"pulse 1s infinite" }} />
            <span style={{ color:"#fff", fontSize:9, fontWeight:800, letterSpacing:0.5 }}>LIVE</span>
          </div>
        )}
        {ch.isHd && (
          <div style={{
            position:"absolute", top: isLg ? "auto" : 6, bottom: isLg ? "auto" : "auto",
            right:6, top:6,
            background:C.surface, borderRadius:4,
            padding:"2px 5px",
          }}>
            <span style={{ color:C.accent, fontSize:9, fontWeight:800 }}>HD</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: isLg ? 0 : "10px 10px 12px", flex:1, minWidth:0 }}>
        <div style={{
          color:C.textPrimary, fontSize:13, fontWeight:600,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          marginBottom: isLg ? 4 : 2,
        }}>{ch.name}</div>
        <div style={{ color:C.textMuted, fontSize:11 }}>{ch.group}</div>
      </div>

      {/* Fav button */}
      {onFav && (
        <div
          onClick={e => { e.stopPropagation(); onFav(); }}
          style={{ padding: isLg ? "0 4px" : "0 10px 10px 0", cursor:"pointer" }}
        >
          <span style={{ fontSize:16, color: isFav ? C.danger : C.textMuted }}>
            {isFav ? "❤️" : "🤍"}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── ROW SECTION ──────────────────────────────────────────────────────────────
const Section = ({ title, badge, channels, onPlay, favorites, onFav, onSeeAll }) => (
  <div style={{ marginBottom:28 }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, paddingRight:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {badge && <div style={{ width:8, height:8, borderRadius:4, background:badge }} />}
        <span style={{ color:C.textPrimary, fontSize:17, fontWeight:700, letterSpacing:"-0.4px" }}>{title}</span>
      </div>
      <span
        onClick={onSeeAll}
        style={{ color:C.accent, fontSize:13, fontWeight:600, cursor:"pointer" }}
      >See all</span>
    </div>
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingLeft:24, paddingRight:24, paddingBottom:4,
      scrollbarWidth:"none", msOverflowStyle:"none" }}>
      {channels.map(ch => (
        <ChannelCard
          key={ch.id} ch={ch}
          onPlay={() => onPlay(ch)}
          onFav={() => onFav(ch.id)}
          isFav={favorites.includes(ch.id)}
        />
      ))}
    </div>
  </div>
);

// ─── PLAYER MODAL ──────────────────────────────────────────────────────────────
const PlayerModal = ({ channel, onClose }) => {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showCtrls, setShowCtrls] = useState(true);
  const timer = useRef();

  const touch = () => {
    setShowCtrls(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowCtrls(false), 3000);
  };

  useEffect(() => { touch(); return () => clearTimeout(timer.current); }, []);

  return (
    <div style={{
      position:"fixed", inset:0, background:"#000", zIndex:100,
      display:"flex", flexDirection:"column",
    }}
    onClick={touch}
    >
      {/* Video placeholder */}
      <div style={{
        flex:1,
        background:`radial-gradient(ellipse at center, ${channel.color}33 0%, #000 70%)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:80, position:"relative",
      }}>
        <span style={{ filter:"drop-shadow(0 0 40px rgba(255,255,255,0.3))", opacity: paused ? 0.4 : 1, transition:"opacity 0.3s" }}>
          {channel.logo}
        </span>
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:2,
          background:`linear-gradient(90deg, ${C.accent}, transparent)`,
          animation: paused ? "none" : "progress 20s linear infinite",
        }} />
      </div>

      {/* Controls overlay */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.9) 100%)",
        transition:"opacity 0.3s ease",
        opacity: showCtrls ? 1 : 0,
        pointerEvents: showCtrls ? "auto" : "none",
      }}>
        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 20px 0" }}>
          <div
            onClick={onClose}
            style={{ width:40, height:40, borderRadius:20, background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
          >
            <Icon name="back" color="#fff" size={20} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,68,68,0.9)", borderRadius:6, padding:"4px 8px" }}>
            <div style={{ width:6, height:6, borderRadius:3, background:"#fff" }} />
            <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>LIVE</span>
          </div>
          <span style={{ color:"#fff", fontSize:16, fontWeight:600 }}>{channel.name}</span>
        </div>

        {/* Center play */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)" }}>
          <div
            onClick={() => setPaused(!paused)}
            style={{
              width:72, height:72, borderRadius:36,
              background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)",
              border:"2px solid rgba(255,255,255,0.3)",
              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
              transition:"transform 0.1s",
            }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.9)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <span style={{ fontSize:32, marginLeft: paused ? 4 : 0 }}>{paused ? "▶" : "⏸"}</span>
          </div>
        </div>

        {/* Bottom controls */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          padding:"0 20px 24px",
          display:"flex", alignItems:"center", gap:16,
        }}>
          <span
            onClick={() => setMuted(!muted)}
            style={{ fontSize:22, cursor:"pointer", opacity:0.9 }}
          >{muted ? "🔇" : "🔊"}</span>
          <input
            type="range" min={0} max={100} value={volume}
            onChange={e => setVolume(e.target.value)}
            style={{ width:80, accentColor:C.accent }}
          />
          <div style={{ flex:1 }} />
          <span style={{ color:"rgba(255,255,255,0.7)", fontSize:13 }}>CC</span>
          <span style={{ color:"rgba(255,255,255,0.7)", fontSize:13 }}>HD</span>
          <span style={{ fontSize:20, cursor:"pointer", opacity:0.9 }}>⛶</span>
        </div>
      </div>

      <style>{`
        @keyframes progress { from { width:0 } to { width:100% } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

// ─── IMPORT MODAL ──────────────────────────────────────────────────────────────
const ImportModal = ({ onClose, onImport }) => {
  const [tab, setTab] = useState("m3u");
  const [url, setUrl] = useState("https://iptv-org.github.io/iptv/index.m3u");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [xtream, setXtream] = useState({ server:"", user:"", pass:"" });

  const handleImport = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    setDone(true);
    setTimeout(() => { onImport(CHANNELS); onClose(); }, 1200);
  };

  const inputStyle = {
    width:"100%", background:C.surface, border:`1px solid ${C.glassBorder}`,
    borderRadius:12, padding:"12px 14px", color:C.textPrimary, fontSize:14,
    outline:"none", boxSizing:"border-box",
  };
  const tabStyle = active => ({
    flex:1, padding:"10px 0", textAlign:"center", cursor:"pointer",
    fontSize:13, fontWeight:600, borderRadius:10,
    color: active ? "#000" : C.textSec,
    background: active ? C.accent : "transparent",
    transition:"all 0.2s",
  });

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.85)",
      backdropFilter:"blur(10px)", zIndex:90, display:"flex",
      alignItems:"center", justifyContent:"center", padding:24,
    }}
    onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:C.bgCard, border:`1px solid ${C.glassBorder}`,
        borderRadius:20, padding:24, width:"100%", maxWidth:480,
        maxHeight:"80vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ color:C.textPrimary, fontSize:20, fontWeight:800 }}>Import Playlist</div>
            <div style={{ color:C.textSec, fontSize:13, marginTop:2 }}>Add your IPTV source</div>
          </div>
          <div onClick={onClose} style={{ cursor:"pointer", color:C.textMuted, fontSize:22 }}>✕</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:C.surface, borderRadius:12, padding:4, gap:4, marginBottom:20 }}>
          {[["m3u","M3U URL"],["xtream","Xtream"],["file","File"]].map(([id,label]) => (
            <div key={id} style={tabStyle(tab===id)} onClick={() => setTab(id)}>{label}</div>
          ))}
        </div>

        {tab === "m3u" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <label style={{ color:C.textSec, fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" }}>M3U Playlist URL</label>
              <input style={inputStyle} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div style={{ color:C.textMuted, fontSize:12 }}>
              💡 Try: <span style={{ color:C.accent, cursor:"pointer" }} onClick={() => setUrl("https://iptv-org.github.io/iptv/index.m3u")}>iptv-org free playlist</span>
            </div>
          </div>
        )}

        {tab === "xtream" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[["Server URL","server","http://yourserver.com:8080"],["Username","user","username"],["Password","pass","password"]].map(([lbl,k,ph]) => (
              <div key={k}>
                <label style={{ color:C.textSec, fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" }}>{lbl}</label>
                <input style={inputStyle} value={xtream[k]} onChange={e => setXtream(p=>({...p,[k]:e.target.value}))} placeholder={ph} type={k==="pass"?"password":"text"} />
              </div>
            ))}
          </div>
        )}

        {tab === "file" && (
          <div style={{
            border:`2px dashed ${C.glassBorder}`, borderRadius:16,
            padding:40, textAlign:"center", cursor:"pointer",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.accent+"55"}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.glassBorder}
          >
            <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
            <div style={{ color:C.textPrimary, fontWeight:600 }}>Drop M3U file here</div>
            <div style={{ color:C.textMuted, fontSize:13, marginTop:4 }}>or tap to browse</div>
          </div>
        )}

        {done ? (
          <div style={{ marginTop:20, background:"rgba(0,230,118,0.1)", border:"1px solid rgba(0,230,118,0.3)", borderRadius:14, padding:14, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ color:C.success, fontWeight:700 }}>Imported Successfully!</div>
              <div style={{ color:C.textSec, fontSize:13 }}>{CHANNELS.length} channels loaded</div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              marginTop:20, width:"100%",
              background: loading ? C.surface : `linear-gradient(135deg, ${C.accent}, #0066FF)`,
              border:"none", borderRadius:14, padding:"14px 0",
              color: loading ? C.textSec : "#000",
              fontSize:15, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
              transition:"all 0.2s",
            }}
          >
            {loading ? "⏳ Importing..." : "Import Playlist"}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── AI ASSISTANT ──────────────────────────────────────────────────────────────
const AIAssistant = ({ onClose, channels, onPlay }) => {
  const [messages, setMessages] = useState([
    { id:0, role:"ai", text:"Hey! I'm Flick AI 👋\n\nI can help you find channels, fix streams, and recommend shows. What would you like to watch?", channels:[] }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef();

  const QUICK = [
    { icon:"📰", label:"Play News",    q:"Play a news channel" },
    { icon:"⚽", label:"Sports",       q:"Find sports channels" },
    { icon:"🔧", label:"Fix Stream",   q:"Fix broken stream" },
    { icon:"✨", label:"Recommend",    q:"Recommend channels" },
  ];

  const send = async (text) => {
    if (!text.trim() || typing) return;
    setMessages(p => [...p, { id:Date.now(), role:"user", text, channels:[] }]);
    setInput(""); setTyping(true);

    await new Promise(r => setTimeout(r, 1200));

    const lower = text.toLowerCase();
    let res = AI_RESPONSES.default;
    if (lower.includes("news")) res = AI_RESPONSES.news;
    else if (lower.includes("sport") || lower.includes("football")) res = AI_RESPONSES.sports;
    else if (lower.includes("fix") || lower.includes("broken")) res = AI_RESPONSES.fix;
    else if (lower.includes("recommend") || lower.includes("suggest")) res = AI_RESPONSES.recommend;

    const matchedChannels = channels.filter(c => res.channels.includes(c.id));
    setMessages(p => [...p, { id:Date.now()+1, role:"ai", text:res.msg, channels:matchedChannels }]);
    setTyping(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.9)",
      backdropFilter:"blur(20px)", zIndex:90,
      display:"flex", flexDirection:"column",
    }}>
      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", gap:14,
        padding:"20px 20px 16px",
        borderBottom:`1px solid ${C.glassBorder}`,
      }}>
        <div onClick={onClose} style={{ cursor:"pointer" }}>
          <Icon name="back" color={C.textSec} size={22} />
        </div>
        <div style={{
          width:44, height:44, borderRadius:22,
          background:`linear-gradient(135deg, ${C.accent}, #0066FF)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:22,
          boxShadow:`0 0 20px ${C.accent}44`,
        }}>✨</div>
        <div>
          <div style={{ color:C.textPrimary, fontWeight:700, fontSize:16 }}>Flick AI</div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:C.success }} />
            <span style={{ color:C.success, fontSize:12 }}>Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:16 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display:"flex", justifyContent: msg.role==="user" ? "flex-end" : "flex-start",
            alignItems:"flex-start", gap:8,
          }}>
            {msg.role==="ai" && (
              <div style={{ width:28, height:28, borderRadius:14, background:`linear-gradient(135deg,${C.accent},#0066FF)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0, marginTop:2 }}>✨</div>
            )}
            <div style={{ maxWidth:"78%", display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{
                background: msg.role==="user"
                  ? `linear-gradient(135deg,${C.accent},#0066FF)`
                  : C.surface,
                border: `1px solid ${msg.role==="user" ? "transparent" : C.glassBorder}`,
                borderRadius: msg.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding:"11px 14px",
                color: msg.role==="user" ? "#000" : C.textPrimary,
                fontSize:14, lineHeight:"1.6",
                fontWeight: msg.role==="user" ? 600 : 400,
              }}>
                {msg.text.split('\n').map((line,i) => <div key={i}>{line || <br/>}</div>)}
              </div>
              {msg.channels?.length > 0 && (
                <div>
                  {msg.channels.map(ch => (
                    <ChannelCard key={ch.id} ch={ch} size="lg" onPlay={() => onPlay(ch)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:14, background:`linear-gradient(135deg,${C.accent},#0066FF)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>✨</div>
            <div style={{ background:C.surface, border:`1px solid ${C.glassBorder}`, borderRadius:"18px 18px 18px 4px", padding:"12px 16px" }}>
              <div style={{ display:"flex", gap:4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:7, height:7, borderRadius:4, background:C.textMuted,
                    animation:`bounce 1.2s ${i*0.2}s ease infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {messages.length === 1 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"0 20px 12px" }}>
          {QUICK.map(q => (
            <div
              key={q.label}
              onClick={() => send(q.q)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                background:C.surface, border:`1px solid ${C.glassBorder}`,
                borderRadius:9999, padding:"8px 14px", cursor:"pointer",
                fontSize:13, fontWeight:600, color:C.textSec,
              }}
            >
              <span>{q.icon}</span> {q.label}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display:"flex", alignItems:"flex-end", gap:10,
        padding:"12px 16px 20px",
        borderTop:`1px solid ${C.glassBorder}`,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && send(input)}
          placeholder="Ask Flick AI anything..."
          style={{
            flex:1, background:C.surface, border:`1px solid ${C.glassBorder}`,
            borderRadius:20, padding:"12px 16px", color:C.textPrimary,
            fontSize:14, outline:"none",
          }}
        />
        <div
          onClick={() => send(input)}
          style={{
            width:44, height:44, borderRadius:22,
            background: input.trim() ? `linear-gradient(135deg,${C.accent},#0066FF)` : C.surface,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            border:`1px solid ${input.trim() ? "transparent" : C.glassBorder}`,
            transition:"all 0.2s",
          }}
        >
          <Icon name="send" color={input.trim() ? "#000" : C.textMuted} size={18} />
        </div>
      </div>

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
};

// ─── SEARCH SCREEN ─────────────────────────────────────────────────────────────
const SearchScreen = ({ channels, onPlay, favorites, onFav }) => {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const results = channels.filter(c =>
    (cat==="all" || c.category===cat) &&
    (!query || c.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ padding:"0 24px", overflowY:"auto", flex:1 }}>
      <div style={{ paddingTop:24, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", background:C.surface, border:`1px solid ${C.glassBorder}`, borderRadius:14, padding:"0 14px", gap:10 }}>
          <Icon name="search" size={18} color={C.textMuted} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search 10,000+ channels..."
            style={{ flex:1, background:"none", border:"none", padding:"14px 0", color:C.textPrimary, fontSize:14, outline:"none" }}
          />
          {query && <span onClick={() => setQuery("")} style={{ color:C.textMuted, cursor:"pointer", fontSize:18 }}>✕</span>}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:20, paddingBottom:4, scrollbarWidth:"none" }}>
        {CATEGORIES.map(c => (
          <div
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{
              display:"flex", alignItems:"center", gap:5, flexShrink:0,
              background: cat===c.id ? C.accent : C.surface,
              border:`1px solid ${cat===c.id ? C.accent : C.glassBorder}`,
              borderRadius:9999, padding:"7px 14px", cursor:"pointer",
              fontSize:13, fontWeight:600,
              color: cat===c.id ? "#000" : C.textSec,
            }}
          >
            <span>{c.emoji}</span>{c.label}
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{ color:C.textMuted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
        {results.length} channels
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:0, paddingBottom:80 }}>
        {results.map(ch => (
          <ChannelCard key={ch.id} ch={ch} size="lg" onPlay={() => onPlay(ch)} onFav={() => onFav(ch.id)} isFav={favorites.includes(ch.id)} />
        ))}
      </div>
    </div>
  );
};

// ─── PROFILE SCREEN ────────────────────────────────────────────────────────────
const ProfileScreen = () => {
  const plan = "Free";
  const menuItems = [
    { icon:"📋", label:"My Playlists",    badge:"3" },
    { icon:"📺", label:"Watch History",   badge:"" },
    { icon:"💳", label:"Upgrade to Premium", badge:"✨", accent:true },
    { icon:"🔔", label:"Notifications",   badge:"" },
    { icon:"🌐", label:"Language",        badge:"EN" },
    { icon:"🎨", label:"Appearance",      badge:"" },
    { icon:"🔒", label:"Privacy",         badge:"" },
    { icon:"❓", label:"Help & Support",  badge:"" },
    { icon:"🚪", label:"Sign Out",        badge:"",  danger:true },
  ];

  return (
    <div style={{ overflowY:"auto", flex:1, paddingBottom:80 }}>
      {/* Profile card */}
      <div style={{
        margin:24, background:`linear-gradient(135deg, ${C.surface}, ${C.bgCard})`,
        border:`1px solid ${C.glassBorder}`, borderRadius:20, padding:20,
        display:"flex", alignItems:"center", gap:16,
      }}>
        <div style={{
          width:64, height:64, borderRadius:32,
          background:`linear-gradient(135deg, ${C.accent}, #0066FF)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:28, fontWeight:800, color:"#fff",
          boxShadow:`0 0 20px ${C.accent}44`,
        }}>F</div>
        <div style={{ flex:1 }}>
          <div style={{ color:C.textPrimary, fontSize:17, fontWeight:700 }}>Faisal</div>
          <div style={{ color:C.textSec, fontSize:13, marginTop:2 }}>faisal@flicktv.ai</div>
          <div style={{
            marginTop:8, display:"inline-flex", alignItems:"center", gap:5,
            background:"rgba(255,184,0,0.12)", border:"1px solid rgba(255,184,0,0.3)",
            borderRadius:6, padding:"3px 9px",
          }}>
            <span style={{ fontSize:12 }}>⭐</span>
            <span style={{ color:C.gold, fontSize:12, fontWeight:700 }}>{plan} Plan</span>
          </div>
        </div>
        <span style={{ color:C.textMuted, fontSize:18, cursor:"pointer" }}>✏️</span>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:12, margin:"0 24px 24px", justifyContent:"space-between" }}>
        {[["24", "Favorites"],["142", "Watched"],["8", "Playlists"]].map(([n,l]) => (
          <div key={l} style={{
            flex:1, background:C.surface, border:`1px solid ${C.glassBorder}`,
            borderRadius:14, padding:"14px 0", textAlign:"center",
          }}>
            <div style={{ color:C.accent, fontSize:22, fontWeight:800 }}>{n}</div>
            <div style={{ color:C.textMuted, fontSize:12, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div style={{ margin:"0 24px", display:"flex", flexDirection:"column", gap:2 }}>
        {menuItems.map(item => (
          <div
            key={item.label}
            style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"14px 16px", borderRadius:14,
              background:"transparent", cursor:"pointer", transition:"background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surface}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize:20 }}>{item.icon}</span>
            <span style={{
              flex:1, fontSize:14, fontWeight:500,
              color: item.danger ? C.danger : item.accent ? C.accent : C.textPrimary
            }}>{item.label}</span>
            {item.badge && (
              <span style={{
                fontSize:12, fontWeight:700,
                background: item.accent ? C.accent : C.surface,
                color: item.accent ? "#000" : C.textMuted,
                padding:"2px 8px", borderRadius:6,
              }}>{item.badge}</span>
            )}
            <span style={{ color:C.textMuted, fontSize:18 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function FlickTVApp() {
  const [tab, setTab] = useState("home");
  const [channels, setChannels] = useState(CHANNELS);
  const [favorites, setFavorites] = useState(["2","5","11"]);
  const [history, setHistory] = useState([CHANNELS[0], CHANNELS[3], CHANNELS[6]]);
  const [playing, setPlaying] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [activeCat, setActiveCat] = useState("all");

  const filtered = channels.filter(c => activeCat==="all" || c.category===activeCat);
  const trending = [...channels].sort(() => Math.random()-0.5).slice(0,8);

  const play = (ch) => {
    setPlaying(ch);
    setHistory(p => [ch, ...p.filter(c => c.id !== ch.id)].slice(0, 20));
  };
  const toggleFav = (id) => setFavorites(p => p.includes(id) ? p.filter(i=>i!==id) : [...p,id]);

  const TABS = [
    { id:"home",     icon:"home",    label:"Home" },
    { id:"live",     icon:"live",    label:"Live TV" },
    { id:"search",   icon:"search",  label:"Search" },
    { id:"favorites",icon:"heart",   label:"Favorites" },
    { id:"profile",  icon:"profile", label:"Profile" },
  ];

  const favChannels = channels.filter(c => favorites.includes(c.id));

  return (
    <div style={{
      width:"100%", maxWidth:430, margin:"0 auto",
      height:"100vh", background:C.bg,
      fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      display:"flex", flexDirection:"column", overflow:"hidden",
      position:"relative",
    }}>
      {/* Status bar */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"10px 20px 4px",
        color:C.textPrimary, fontSize:13, fontWeight:700,
        flexShrink:0,
      }}>
        <span>9:41</span>
        <span>FlickTV AI</span>
        <span>⚡ 5G</span>
      </div>

      {/* Screen content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* HOME */}
        {tab === "home" && (
          <div style={{ flex:1, overflowY:"auto" }}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 24px 8px" }}>
              <div>
                <div style={{ color:C.accent, fontSize:26, fontWeight:900, letterSpacing:"-1.5px" }}>FlickTV</div>
                <div style={{ color:C.textSec, fontSize:13, marginTop:1 }}>Good evening 👋</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div
                  onClick={() => setShowAI(true)}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    background:`linear-gradient(135deg, ${C.accent}, #0066FF)`,
                    borderRadius:22, padding:"8px 14px", cursor:"pointer",
                  }}
                >
                  <span style={{ fontSize:14 }}>✨</span>
                  <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>Flick AI</span>
                </div>
                <div
                  onClick={() => setShowImport(true)}
                  style={{
                    width:38, height:38, borderRadius:19,
                    background:C.surface, border:`1px solid ${C.glassBorder}`,
                    display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
                  }}
                >
                  <Icon name="import" size={18} color={C.textSec} />
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div
              onClick={() => setTab("search")}
              style={{
                margin:"0 24px 16px",
                display:"flex", alignItems:"center", gap:10,
                background:C.surface, border:`1px solid ${C.glassBorder}`,
                borderRadius:14, padding:"13px 14px", cursor:"pointer",
              }}
            >
              <Icon name="search" size={18} color={C.textMuted} />
              <span style={{ flex:1, color:C.textMuted, fontSize:14 }}>Search channels, shows...</span>
              <div style={{
                width:28, height:28, borderRadius:14,
                background:"rgba(0,212,255,0.1)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Icon name="mic" size={14} color={C.accent} />
              </div>
            </div>

            {/* Categories */}
            <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 24px 16px", scrollbarWidth:"none" }}>
              {CATEGORIES.map(c => (
                <div
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:5, flexShrink:0,
                    background: activeCat===c.id ? C.accent : C.surface,
                    border:`1px solid ${activeCat===c.id ? C.accent : C.glassBorder}`,
                    borderRadius:9999, padding:"8px 14px", cursor:"pointer",
                    fontSize:13, fontWeight:600,
                    color: activeCat===c.id ? "#000" : C.textSec,
                    transition:"all 0.2s",
                  }}
                >
                  <span style={{ fontSize:12 }}>{c.emoji}</span>{c.label}
                </div>
              ))}
            </div>

            {/* Continue Watching */}
            {history.length > 0 && (
              <Section
                title="Continue Watching"
                channels={history.slice(0,8)}
                onPlay={play} favorites={favorites} onFav={toggleFav}
                onSeeAll={() => {}}
              />
            )}

            {/* Trending */}
            <Section
              title="Trending Now"
              badge={C.danger}
              channels={trending}
              onPlay={play} favorites={favorites} onFav={toggleFav}
              onSeeAll={() => {}}
            />

            {/* Category section */}
            <Section
              title={activeCat === "all" ? "✨ For You" : CATEGORIES.find(c=>c.id===activeCat)?.label || ""}
              channels={filtered.slice(0,10)}
              onPlay={play} favorites={favorites} onFav={toggleFav}
              onSeeAll={() => {}}
            />

            <div style={{ height:100 }} />
          </div>
        )}

        {/* LIVE TV */}
        {tab === "live" && (
          <div style={{ flex:1, overflowY:"auto" }}>
            <div style={{ padding:"20px 24px 16px" }}>
              <div style={{ color:C.textPrimary, fontSize:20, fontWeight:800, letterSpacing:"-0.5px" }}>Live TV</div>
              <div style={{ color:C.textSec, fontSize:13, marginTop:2 }}>{channels.filter(c=>c.isLive).length} channels live now</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:0, padding:"0 24px", paddingBottom:80 }}>
              {channels.filter(c=>c.isLive).map(ch => (
                <ChannelCard key={ch.id} ch={ch} size="lg" onPlay={() => play(ch)} onFav={() => toggleFav(ch.id)} isFav={favorites.includes(ch.id)} />
              ))}
            </div>
          </div>
        )}

        {/* SEARCH */}
        {tab === "search" && (
          <SearchScreen channels={channels} onPlay={play} favorites={favorites} onFav={toggleFav} />
        )}

        {/* FAVORITES */}
        {tab === "favorites" && (
          <div style={{ flex:1, overflowY:"auto" }}>
            <div style={{ padding:"20px 24px 16px" }}>
              <div style={{ color:C.textPrimary, fontSize:20, fontWeight:800, letterSpacing:"-0.5px" }}>Favorites</div>
              <div style={{ color:C.textSec, fontSize:13, marginTop:2 }}>{favChannels.length} saved channels</div>
            </div>
            {favChannels.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 24px" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
                <div style={{ color:C.textPrimary, fontSize:16, fontWeight:600 }}>No favorites yet</div>
                <div style={{ color:C.textSec, fontSize:13, marginTop:6 }}>Tap the heart icon on any channel</div>
              </div>
            ) : (
              <div style={{ padding:"0 24px", paddingBottom:80, display:"flex", flexDirection:"column" }}>
                {favChannels.map(ch => (
                  <ChannelCard key={ch.id} ch={ch} size="lg" onPlay={() => play(ch)} onFav={() => toggleFav(ch.id)} isFav={true} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && <ProfileScreen />}
      </div>

      {/* Bottom nav */}
      <div style={{
        display:"flex", justifyContent:"space-around",
        background:C.bgCard, borderTop:`1px solid ${C.glassBorder}`,
        paddingBottom:"env(safe-area-inset-bottom, 8px)",
        flexShrink:0,
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", padding:"10px 0 6px", cursor:"pointer",
                gap:4,
              }}
            >
              <div style={{ position:"relative" }}>
                <Icon name={t.icon} size={22} color={active ? C.accent : C.textMuted} />
                {active && (
                  <div style={{
                    position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)",
                    width:4, height:4, borderRadius:2, background:C.accent,
                  }} />
                )}
              </div>
              <span style={{ fontSize:10, fontWeight:active ? 700 : 500, color: active ? C.accent : C.textMuted }}>
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Overlays */}
      {playing && <PlayerModal channel={playing} onClose={() => setPlaying(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={chs => setChannels(chs)} />}
      {showAI && <AIAssistant onClose={() => setShowAI(false)} channels={channels} onPlay={ch => { play(ch); setShowAI(false); }} />}

      <style>{`
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { display: none; }
        input { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
