import { useState, useEffect, useCallback, useRef } from "react";

const WEATHER_KEY = process.env.REACT_APP_WEATHER_KEY || "33eefb77231a47a3299d4e67d3aadd72";
const RSS_PROXY   = "https://api.rss2json.com/v1/api.json?rss_url=";

const NEWS_CATEGORIES = ["general","technology","science","business","health"];
const CATEGORY_LABELS = { general:"Top Stories", technology:"Tech", science:"Science", business:"Business", health:"Health" };
const CATEGORY_META = {
  general:    { color:"#6366f1", bg:"#eef2ff", darkBg:"#1e1b4b", emoji:"🌍" },
  technology: { color:"#0ea5e9", bg:"#e0f2fe", darkBg:"#0c2340", emoji:"💻" },
  science:    { color:"#10b981", bg:"#d1fae5", darkBg:"#052e16", emoji:"🔬" },
  business:   { color:"#f59e0b", bg:"#fef3c7", darkBg:"#2d1a00", emoji:"📈" },
  health:     { color:"#ef4444", bg:"#fee2e2", darkBg:"#2d0a0a", emoji:"❤️" },
};
const RSS_URLS = {
  general:    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
  technology: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pKVGlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
  science:    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pKVGlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
  business:   "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pKVGlnQVAB?hl=en-IN&gl=IN&ceid=IN:en",
  health:     "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ?hl=en-IN&gl=IN&ceid=IN:en",
};
const FALLBACK_IMAGES = {
  general:    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80",
  technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80",
  science:    "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&q=80",
  business:   "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80",
  health:     "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&q=80",
};
const TRENDING_CITIES = ["Delhi","Mumbai","Bangalore","Chennai","Kolkata","London","New York","Tokyo"];
const CITY_SUGGESTIONS = [
  "Mumbai","Delhi","Bangalore","Chennai","Kolkata","Hyderabad","Pune","Ahmedabad",
  "Jaipur","Surat","Lucknow","Kanpur","Nagpur","Indore","Bhopal","Patna","Varanasi",
  "London","New York","Tokyo","Paris","Dubai","Singapore","Sydney","Los Angeles",
  "Berlin","Toronto","Beijing","Shanghai","Seoul","Bangkok","Istanbul","Cairo",
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function weatherIcon(code) {
  if (!code) return "⛅";
  const c = String(code);
  if (c.startsWith("01")) return "☀️";
  if (c.startsWith("02") || c.startsWith("03") || c.startsWith("04")) return "⛅";
  if (c.startsWith("09") || c.startsWith("10")) return "🌧️";
  if (c.startsWith("11")) return "⛈️";
  if (c.startsWith("13")) return "❄️";
  return "🌫️";
}
function getGradient(code) {
  if (!code) return ["#667eea","#764ba2"];
  const c = String(code);
  if (c.startsWith("01")) return ["#f6d365","#fda085"];
  if (c.startsWith("02") || c.startsWith("03")) return ["#89f7fe","#66a6ff"];
  if (c.startsWith("04")) return ["#a1c4fd","#c2e9fb"];
  if (c.startsWith("09") || c.startsWith("10")) return ["#2c3e8c","#4facfe"];
  if (c.startsWith("11")) return ["#232526","#414345"];
  if (c.startsWith("13")) return ["#e0eafc","#cfdef3"];
  return ["#89f7fe","#66a6ff"];
}
function getConditionBadge(temp, code) {
  if (!code) return null;
  const c = String(code);
  if (c.startsWith("11")) return { label:"⛈️ Storm Warning", color:"#ef4444" };
  if (c.startsWith("09") || c.startsWith("10")) return { label:"🌧️ Carry an Umbrella", color:"#0ea5e9" };
  if (c.startsWith("13")) return { label:"❄️ Cold — Dress Warmly", color:"#818cf8" };
  if (temp >= 40) return { label:"🥵 Extreme Heat — Stay Indoors", color:"#ef4444" };
  if (temp >= 35) return { label:"🌡️ Hot — Stay Hydrated", color:"#f59e0b" };
  if (temp <= 10) return { label:"🧥 Cold — Wear Layers", color:"#6366f1" };
  return { label:"✅ Pleasant Weather", color:"#10b981" };
}
function formatTime(unix, tz) {
  return new Date((unix + tz) * 1000).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", timeZone:"UTC" });
}
function readingTime(text) {
  if (!text) return "2 min read";
  return `${Math.max(1, Math.round(text.split(" ").length / 200))} min read`;
}

// ── ANIMATED WEATHER BG ───────────────────────────────────────────────────────
function AnimatedWeatherBg({ code }) {
  const c = String(code || "");
  const isRain  = c.startsWith("09") || c.startsWith("10") || c.startsWith("11");
  const isSnow  = c.startsWith("13");
  const isSunny = c.startsWith("01");
  const isCloudy = c.startsWith("02") || c.startsWith("03") || c.startsWith("04");
  const count = isRain ? 20 : isSnow ? 16 : isSunny ? 8 : isCloudy ? 5 : 0;
  if (count === 0) return null;

  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", borderRadius:"inherit", pointerEvents:"none", zIndex:0 }}>
      <style>{`
        @keyframes rainFall {
          0%   { transform: translateY(-20px) translateX(0); opacity: 0.7; }
          100% { transform: translateY(420px) translateX(-10px); opacity: 0; }
        }
        @keyframes snowFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(420px) rotate(360deg); opacity: 0; }
        }
        @keyframes sunRay {
          0%,100% { opacity: 0.3; transform: scale(1); }
          50%     { opacity: 0.7; transform: scale(1.4); }
        }
        @keyframes cloudDrift {
          0%   { transform: translateX(-60px); opacity: 0.15; }
          50%  { opacity: 0.25; }
          100% { transform: translateX(60px); opacity: 0.15; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => {
        const left = `${(i * 43 + 7) % 100}%`;
        const delay = `${(i * 0.18) % 2.5}s`;
        const dur   = `${1.0 + (i % 6) * 0.25}s`;
        if (isRain) return (
          <div key={i} style={{
            position:"absolute", left, top:`-${(i*17)%30}%`,
            width:2, height:16, borderRadius:2,
            background:"rgba(255,255,255,0.35)",
            animation:`rainFall ${dur} linear ${delay} infinite`,
          }} />
        );
        if (isSnow) return (
          <div key={i} style={{
            position:"absolute", left, top:`-${(i*11)%30}%`,
            width:8, height:8, borderRadius:"50%",
            background:"rgba(255,255,255,0.55)",
            animation:`snowFall ${1.8 + (i%5)*0.4}s linear ${delay} infinite`,
          }} />
        );
        if (isSunny) return (
          <div key={i} style={{
            position:"absolute",
            left:`${20+(i*15)%65}%`, top:`${5+(i*20)%50}%`,
            width:6, height:6, borderRadius:"50%",
            background:"rgba(255,220,80,0.6)",
            animation:`sunRay ${2+(i%4)*0.5}s ease-in-out ${delay} infinite`,
          }} />
        );
        if (isCloudy) return (
          <div key={i} style={{
            position:"absolute",
            left:`${(i*30)%80}%`, top:`${10+(i*20)%50}%`,
            width:80+i*20, height:30+i*10, borderRadius:999,
            background:"rgba(255,255,255,0.12)",
            animation:`cloudDrift ${4+(i%3)*2}s ease-in-out ${delay} infinite`,
          }} />
        );
        return null;
      })}
    </div>
  );
}

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h  = e => setDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return dark;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function useWeather(query) {
  const [data, setData]         = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly, setHourly]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const prevTempRef             = useRef(null);

  const fetchWeather = useCallback(async (q) => {
    if (!q) return;
    setLoading(true); setError(null);
    try {
      const isCoords = typeof q === "object";
      const param = isCoords ? `lat=${q.lat}&lon=${q.lon}` : `q=${encodeURIComponent(q)}`;
      const [curRes, fcRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?${param}&appid=${WEATHER_KEY}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?${param}&appid=${WEATHER_KEY}&units=metric&cnt=40`),
      ]);
      if (!curRes.ok) throw new Error("City not found — try another name");
      const cur = await curRes.json();
      const fc  = await fcRes.json();
      prevTempRef.current = data?.main?.temp || null;
      setData(cur);
      setHourly(fc.list.slice(0, 8));
      const days = {};
      fc.list.forEach(item => {
        const d = item.dt_txt.slice(0, 10);
        if (!days[d] || item.dt_txt.includes("12:00")) days[d] = item;
      });
      setForecast(Object.values(days).slice(0, 5));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [data]);

  useEffect(() => { if (query) fetchWeather(query); }, [query]);
  return { data, forecast, hourly, loading, error, prevTemp: prevTempRef.current, refetch: fetchWeather };
}

function useNews(category, refreshKey) {
  const [articles, setArticles]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdated, setUpdated] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function go() {
      setLoading(true); setError(null);
      try {
        const res  = await fetch(`${RSS_PROXY}${encodeURIComponent(RSS_URLS[category])}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (json.status !== "ok") throw new Error("parse failed");
        if (!cancelled) { setArticles((json.items||[]).slice(0,9)); setUpdated(new Date()); }
      } catch(e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    go();
    const iv = setInterval(go, 10*60*1000);
    return () => { cancelled=true; clearInterval(iv); };
  }, [category, refreshKey]);
  return { articles, loading, error, lastUpdated };
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
const Sk = ({ w="100%", h=16, r=8, dark }) => (
  <div style={{ width:w, height:h, borderRadius:r,
    background: dark
      ? "linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)"
      : "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
    backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }} />
);

function Toast({ message, visible }) {
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%",
      transform:`translateX(-50%) translateY(${visible?0:80}px)`,
      opacity:visible?1:0, transition:"all .3s ease",
      background:"#0f172a", color:"#fff", padding:"10px 22px",
      borderRadius:999, fontSize:13, fontWeight:600,
      boxShadow:"0 8px 24px rgba(0,0,0,0.25)", zIndex:9999, whiteSpace:"nowrap" }}>
      {message}
    </div>
  );
}

function OnboardingScreen({ onAllow, onSkip, dark }) {
  const bg   = dark ? "#0f172a" : "#f1f5f9";
  const card = dark ? "#1e293b" : "#fff";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const sub  = dark ? "#94a3b8" : "#64748b";
  return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:card, borderRadius:24, padding:"48px 40px", maxWidth:420, width:"100%",
        textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.14)" }}>
        <div style={{ fontSize:80, marginBottom:12, animation:"bounce 2s infinite" }}>⛅</div>
        <h1 style={{ fontSize:30, fontWeight:800, color:text, margin:"0 0 12px", letterSpacing:"-1px" }}>WeatherPulse</h1>
        <p style={{ fontSize:15, color:sub, marginBottom:36, lineHeight:1.7 }}>
          Live weather &amp; news for any city. Let us find your location for instant updates.
        </p>
        <button onClick={onAllow} style={{ width:"100%", padding:"15px", borderRadius:14, border:"none",
          background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", fontSize:15,
          fontWeight:700, cursor:"pointer", marginBottom:12,
          boxShadow:"0 4px 20px rgba(99,102,241,0.45)" }}>
          📍 Use My Location
        </button>
        <button onClick={onSkip} style={{ width:"100%", padding:"15px", borderRadius:14,
          border:`1.5px solid ${dark?"#334155":"#e2e8f0"}`, background:"transparent",
          color:sub, fontSize:15, fontWeight:600, cursor:"pointer" }}>
          🔍 Search a City Instead
        </button>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      </div>
    </div>
  );
}

// ── WEATHER CARD ──────────────────────────────────────────────────────────────
function WeatherCard({ data, forecast, hourly, loading, error, prevTemp, unit, dark }) {
  const [g1,g2] = data ? getGradient(data.weather[0].icon) : ["#667eea","#764ba2"];
  const temp    = data ? (unit==="C" ? data.main.temp : data.main.temp*9/5+32) : 0;
  const feels   = data ? (unit==="C" ? data.main.feels_like : data.main.feels_like*9/5+32) : 0;
  const badge   = data ? getConditionBadge(data.main.temp, data.weather[0].icon) : null;
  const trend   = prevTemp ? (data?.main.temp > prevTemp ? "↑" : data?.main.temp < prevTemp ? "↓" : null) : null;

  if (error) return (
    <div style={{ background:dark?"#1e293b":"#fff", borderRadius:20, padding:"24px 28px", marginBottom:24, border:`1px solid ${dark?"#334155":"#e2e8f0"}` }}>
      <p style={{ color:"#ef4444", fontSize:14, margin:0 }}>⚠️ {error}</p>
    </div>
  );

  return (
    <div style={{ background:`linear-gradient(135deg,${g1} 0%,${g2} 100%)`, borderRadius:20,
      padding:"28px 28px 22px", marginBottom:24, color:"#fff",
      boxShadow:"0 12px 40px rgba(0,0,0,0.18)", position:"relative", overflow:"hidden",
      transition:"background 0.8s ease" }}>
      {data && <AnimatedWeatherBg code={data.weather[0].icon} />}

      {loading || !data ? (
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", gap:14 }}>
          <Sk h={70} w={180} dark /><Sk h={20} w={260} dark />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))", gap:8, marginTop:8 }}>
            {[...Array(6)].map((_,i)=><Sk key={i} h={80} dark />)}
          </div>
        </div>
      ) : (
        <div style={{ position:"relative", zIndex:1 }}>
          {/* Main temp row */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:10 }}>
                <div style={{ fontSize:"clamp(52px,9vw,80px)", fontWeight:800, lineHeight:1, letterSpacing:"-3px" }}>
                  {Math.round(temp)}°{unit}
                </div>
                {trend && <span style={{ fontSize:24, marginBottom:10, opacity:.85, fontWeight:700 }}>{trend}</span>}
              </div>
              <div style={{ fontSize:16, opacity:.88, marginTop:6 }}>
                {data.weather[0].description.charAt(0).toUpperCase()+data.weather[0].description.slice(1)}
                {"  ·  Feels like "}{Math.round(feels)}°{unit}
              </div>
              {badge && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:12,
                  background:"rgba(255,255,255,0.22)", backdropFilter:"blur(10px)",
                  padding:"6px 14px", borderRadius:999, fontSize:13, fontWeight:700,
                  boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }}>
                  {badge.label}
                </div>
              )}
            </div>
            <div style={{ fontSize:"clamp(52px,9vw,80px)", filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.2))", lineHeight:1 }}>
              {weatherIcon(data.weather[0].icon)}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))", gap:10, marginBottom:20 }}>
            {[
              ["💧","Humidity",`${data.main.humidity}%`],
              ["🌬️","Wind",`${Math.round(data.wind.speed*3.6)} km/h`],
              ["📊","Pressure",`${data.main.pressure} hPa`],
              ["👁️","Visibility",`${(data.visibility/1000).toFixed(1)} km`],
              ["🌅","Sunrise",formatTime(data.sys.sunrise,data.timezone)],
              ["🌇","Sunset",formatTime(data.sys.sunset,data.timezone)],
            ].map(([icon,label,val])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.2)", backdropFilter:"blur(8px)",
                borderRadius:14, padding:"12px 8px", textAlign:"center" }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                <div style={{ fontSize:"clamp(12px,1.8vw,15px)", fontWeight:700 }}>{val}</div>
                <div style={{ fontSize:11, opacity:.75, marginTop:3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Hourly */}
          {hourly.length > 0 && (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, opacity:.65, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:"1px" }}>Next 24 Hours</div>
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6 }}>
                {hourly.map((item,i)=>{
                  const t = unit==="C" ? item.main.temp : item.main.temp*9/5+32;
                  const time = new Date(item.dt*1000).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
                  return (
                    <div key={i} style={{ minWidth:62, background:"rgba(255,255,255,0.18)", borderRadius:12,
                      padding:"10px 6px", textAlign:"center", flexShrink:0 }}>
                      <div style={{ fontSize:11, opacity:.75, marginBottom:4 }}>{i===0?"Now":time}</div>
                      <div style={{ fontSize:20 }}>{weatherIcon(item.weather[0].icon)}</div>
                      <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{Math.round(t)}°</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5-day */}
          {forecast.length > 0 && (
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.22)", paddingTop:16 }}>
              <div style={{ fontSize:11, opacity:.65, fontWeight:700, marginBottom:10, textTransform:"uppercase", letterSpacing:"1px" }}>5-Day Forecast</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                {forecast.map((item,i)=>{
                  const t = unit==="C" ? item.main.temp : item.main.temp*9/5+32;
                  const day = i===0?"Today":new Date(item.dt*1000).toLocaleDateString("en-IN",{weekday:"short"});
                  return (
                    <div key={item.dt} style={{ textAlign:"center", background:"rgba(255,255,255,0.18)", borderRadius:12, padding:"10px 4px" }}>
                      <div style={{ fontSize:11, opacity:.75, marginBottom:4 }}>{day}</div>
                      <div style={{ fontSize:22 }}>{weatherIcon(item.weather[0].icon)}</div>
                      <div style={{ fontSize:14, fontWeight:700, marginTop:4 }}>{Math.round(t)}°</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── NEWS CARD ─────────────────────────────────────────────────────────────────
function NewsCard({ article, category, dark, bookmarks, toggleBookmark, index }) {
  const meta  = CATEGORY_META[category];
  const parts = article.title?.split(" - ") || [];
  const src   = parts.length>1 ? parts[parts.length-1] : article.author||"News";
  const title = parts.length>1 ? parts.slice(0,-1).join(" - ") : article.title;
  const date  = article.pubDate ? new Date(article.pubDate).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "";
  const img   = article.thumbnail || article.enclosure?.link || FALLBACK_IMAGES[category];
  const saved = bookmarks.includes(article.link);

  return (
    <div style={{ background:dark?"#1e293b":"#fff", borderRadius:16,
      border:`1px solid ${dark?"#334155":"#f1f5f9"}`, overflow:"hidden",
      transition:"transform .2s, box-shadow .2s", cursor:"pointer", position:"relative",
      boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}
      onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 16px 36px rgba(0,0,0,0.13)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)"; }}>
      <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none", color:"inherit" }}>
        <div style={{ position:"relative" }}>
          <img src={img} alt="" style={{ width:"100%", height:175, objectFit:"cover", display:"block" }}
            onError={e=>{ e.target.src=FALLBACK_IMAGES[category]; }} />
          <div style={{ position:"absolute", top:10, left:10, background:meta.color, color:"#fff",
            fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:999, letterSpacing:"0.2px" }}>
            {meta.emoji} {CATEGORY_LABELS[category]}
          </div>
          {index<3 && (
            <div style={{ position:"absolute", top:10, right:44, background:"#ef4444", color:"#fff",
              fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:999 }}>
              🔥 Trending
            </div>
          )}
          <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.55)",
            color:"#fff", fontSize:11, padding:"3px 8px", borderRadius:999, backdropFilter:"blur(4px)" }}>
            {readingTime(article.description)}
          </div>
        </div>
        <div style={{ padding:"14px 16px 16px" }}>
          <div style={{ fontSize:14, fontWeight:600, lineHeight:1.5, color:dark?"#f1f5f9":"#0f172a",
            marginBottom:10, display:"-webkit-box", WebkitLineClamp:3,
            WebkitBoxOrient:"vertical", overflow:"hidden" }}>
            {title}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12, color:"#94a3b8" }}>
            <span style={{ background:dark?meta.darkBg:meta.bg, color:meta.color,
              fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999 }}>{src}</span>
            <span>{date}</span>
          </div>
        </div>
      </a>
      <button onClick={e=>{ e.stopPropagation(); toggleBookmark(article.link); }}
        style={{ position:"absolute", top:10, right:10, background:saved?"#6366f1":"rgba(0,0,0,0.45)",
          border:"none", borderRadius:"50%", width:32, height:32, fontSize:15,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          backdropFilter:"blur(4px)", transition:"background .2s", color:"#fff" }}>
        {saved?"🔖":"🏷️"}
      </button>
    </div>
  );
}

// ── SEARCH WITH AUTOCOMPLETE ──────────────────────────────────────────────────
function SearchBar({ onSearch, dark }) {
  const [val, setVal]           = useState("");
  const [suggestions, setSugs]  = useState([]);
  const [showSugs, setShowSugs] = useState(false);
  const ref = useRef(null);

  function handleInput(e) {
    const v = e.target.value;
    setVal(v);
    if (v.length >= 2) {
      const filtered = CITY_SUGGESTIONS.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0,6);
      setSugs(filtered);
      setShowSugs(filtered.length > 0);
    } else {
      setShowSugs(false);
    }
  }
  function submit(city) {
    if (!city.trim()) return;
    onSearch(city.trim());
    setVal(""); setShowSugs(false);
  }

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setShowSugs(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const border = dark ? "#334155" : "#e2e8f0";
  const bg     = dark ? "#0f172a" : "#f8fafc";
  const sugBg  = dark ? "#1e293b" : "#fff";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const hover  = dark ? "#334155" : "#f1f5f9";

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, background:bg,
        border:`1.5px solid ${border}`, borderRadius:12, padding:"6px 8px 6px 12px" }}>
        <span style={{ fontSize:15 }}>🔍</span>
        <input value={val} onChange={handleInput}
          onKeyDown={e=>{ if(e.key==="Enter") submit(val); if(e.key==="Escape") setShowSugs(false); }}
          onFocus={()=>{ if(suggestions.length>0) setShowSugs(true); }}
          placeholder="Search city…"
          style={{ border:"none", outline:"none", fontSize:14, background:"transparent",
            width:150, color:text }} />
        <button onClick={()=>submit(val)}
          style={{ padding:"5px 14px", borderRadius:8, border:"none", background:"#6366f1",
            color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Go</button>
      </div>
      {showSugs && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
          background:sugBg, border:`1.5px solid ${border}`, borderRadius:12,
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:999, overflow:"hidden" }}>
          {suggestions.map(city=>(
            <div key={city} onClick={()=>submit(city)}
              style={{ padding:"10px 16px", fontSize:14, cursor:"pointer", color:text,
                display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=hover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span>📍</span>{city}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const dark  = useDarkMode();
  const clock = useClock();

  const [onboarded, setOnboarded]       = useState(false);
  const [weatherQuery, setWeatherQuery] = useState(null);
  const [newsCategory, setNewsCategory] = useState("general");
  const [newsSearch, setNewsSearch]     = useState("");
  const [refreshKey, setRefreshKey]     = useState(0);
  const [unit, setUnit]                 = useState("C");
  const [bookmarks, setBookmarks]       = useState(() => { try { return JSON.parse(localStorage.getItem("wp_bm")||"[]"); } catch { return []; } });
  const [favCities, setFavCities]       = useState(() => { try { return JSON.parse(localStorage.getItem("wp_cities")||'["Mumbai","Delhi","Bangalore"]'); } catch { return ["Mumbai","Delhi","Bangalore"]; } });
  const [toast, setToast]               = useState({ visible:false, msg:"" });
  const [showBM, setShowBM]             = useState(false);
  const [addCityMode, setAddCityMode]   = useState(false);
  const [addCityVal, setAddCityVal]     = useState("");

  const { data, forecast, hourly, loading:wL, error:wE, prevTemp } = useWeather(weatherQuery);
  const { articles, loading:nL, error:nE, lastUpdated }            = useNews(newsCategory, refreshKey);

  useEffect(() => { try { localStorage.setItem("wp_bm", JSON.stringify(bookmarks)); } catch {} }, [bookmarks]);
  useEffect(() => { try { localStorage.setItem("wp_cities", JSON.stringify(favCities)); } catch {} }, [favCities]);

  const showToast = useCallback((msg) => {
    setToast({ visible:true, msg });
    setTimeout(() => setToast(t=>({ ...t, visible:false })), 2500);
  }, []);

  function handleAllow() {
    setOnboarded(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setWeatherQuery({ lat:p.coords.latitude, lon:p.coords.longitude }),
        () => setWeatherQuery("Mumbai")
      );
    } else { setWeatherQuery("Mumbai"); }
  }
  function handleSkip() { setOnboarded(true); setWeatherQuery("Mumbai"); }

  function handleSearch(city) {
    setWeatherQuery(city);
    showToast(`🔍 Loading ${city}…`);
  }
  function handleCityClick(city) {
    setWeatherQuery(city);
    showToast(`📍 Switched to ${city}`);
  }
  function addFavCity() {
    const v = addCityVal.trim();
    if (!v) return;
    if (favCities.includes(v)) { showToast("Already in favourites!"); return; }
    if (favCities.length >= 5) { showToast("Max 5 favourite cities"); return; }
    setFavCities(p=>[...p, v]);
    setWeatherQuery(v);
    setAddCityVal(""); setAddCityMode(false);
    showToast(`⭐ Added ${v}`);
  }
  function removeFavCity(city) {
    setFavCities(p=>p.filter(c=>c!==city));
    showToast(`🗑️ Removed ${city}`);
  }
  function toggleBookmark(link) {
    setBookmarks(p => p.includes(link) ? p.filter(l=>l!==link) : [...p, link]);
    showToast(bookmarks.includes(link) ? "🗑️ Removed bookmark" : "🔖 Bookmarked!");
  }
  function shareWeather() {
    const t = data ? `${data.name}: ${Math.round(data.main.temp)}°C, ${data.weather[0].description} — via WeatherPulse` : "Check out WeatherPulse!";
    navigator.clipboard?.writeText(t).then(()=>showToast("📋 Copied to clipboard!"));
  }
  function refreshNews() { setRefreshKey(k=>k+1); showToast("🔄 Refreshing news…"); }

  // Theme
  const bg      = dark ? "#0f172a" : "#f1f5f9";
  const surface = dark ? "#1e293b" : "#fff";
  const border  = dark ? "#334155" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const sub     = dark ? "#94a3b8" : "#64748b";

  const filtered = articles.filter(a => a.title && a.link && (!newsSearch || a.title.toLowerCase().includes(newsSearch.toLowerCase())));
  const bmArticles = articles.filter(a => bookmarks.includes(a.link));

  if (!onboarded) return <OnboardingScreen onAllow={handleAllow} onSkip={handleSkip} dark={dark} />;

  return (
    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", background:bg, minHeight:"100vh", color:text, transition:"background .3s,color .3s" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing:border-box; }
        a { text-decoration:none; color:inherit; }
        input { font-family:inherit; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background:${dark?"#475569":"#cbd5e1"}; border-radius:99px; }
        input::placeholder { color:${dark?"#475569":"#94a3b8"}; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, position:"sticky", top:0, zIndex:200, boxShadow:`0 1px 8px rgba(0,0,0,${dark?0.3:0.06})` }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          {/* Logo + city */}
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#6366f1", letterSpacing:"-0.5px", whiteSpace:"nowrap" }}>⛅ WeatherPulse</div>
            {data && (
              <div style={{ fontSize:13, color:sub, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", display:"inline-block" }} />
                {data.name}, {data.sys?.country}
              </div>
            )}
          </div>
          {/* Right controls */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {/* Live clock */}
            <div style={{ fontSize:13, fontWeight:600, color:sub, background:dark?"#0f172a":"#f8fafc",
              border:`1.5px solid ${border}`, borderRadius:10, padding:"6px 12px", letterSpacing:"0.5px" }}>
              🕐 {clock.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </div>
            <SearchBar onSearch={handleSearch} dark={dark} />
            <button onClick={()=>setUnit(u=>u==="C"?"F":"C")}
              style={{ padding:"7px 14px", borderRadius:10, border:`1.5px solid ${border}`,
                background:surface, color:text, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              °{unit==="C"?"F":"C"}
            </button>
            <button onClick={shareWeather} title="Share"
              style={{ padding:"7px 12px", borderRadius:10, border:`1.5px solid ${border}`, background:surface, fontSize:16, cursor:"pointer" }}>🌐</button>
            <button onClick={handleAllow} title="Use my location"
              style={{ padding:"7px 12px", borderRadius:10, border:`1.5px solid ${border}`, background:surface, fontSize:16, cursor:"pointer" }}>📍</button>
          </div>
        </div>
      </div>

      {/* ── PAGE BODY ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px 60px" }}>

        {/* Favourite cities */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:16 }}>
          {favCities.map(city=>(
            <div key={city} style={{ display:"flex", alignItems:"center", gap:0 }}>
              <button onClick={()=>handleCityClick(city)}
                style={{ padding:"6px 16px 6px 12px", borderRadius:"999px 0 0 999px", fontSize:13, fontWeight:500,
                  border:`1.5px solid ${border}`, borderRight:"none",
                  background:weatherQuery===city?"#6366f1":surface,
                  color:weatherQuery===city?"#fff":sub, cursor:"pointer", transition:"all .2s" }}>
                📍 {city}
              </button>
              <button onClick={()=>removeFavCity(city)}
                style={{ padding:"6px 8px", borderRadius:"0 999px 999px 0", fontSize:12, fontWeight:700,
                  border:`1.5px solid ${border}`, borderLeft:"none",
                  background:weatherQuery===city?"#6366f1":surface,
                  color:weatherQuery===city?"rgba(255,255,255,0.7)":"#94a3b8", cursor:"pointer" }}>
                ×
              </button>
            </div>
          ))}
          {/* Add city */}
          {addCityMode ? (
            <div style={{ display:"flex", gap:6 }}>
              <input value={addCityVal} onChange={e=>setAddCityVal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") addFavCity(); if(e.key==="Escape") setAddCityMode(false); }}
                placeholder="City name…" autoFocus
                style={{ padding:"6px 12px", borderRadius:10, border:`1.5px solid #6366f1`, background:surface,
                  color:text, fontSize:13, outline:"none", width:140 }} />
              <button onClick={addFavCity}
                style={{ padding:"6px 14px", borderRadius:10, border:"none", background:"#6366f1",
                  color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add</button>
              <button onClick={()=>setAddCityMode(false)}
                style={{ padding:"6px 10px", borderRadius:10, border:`1.5px solid ${border}`, background:surface,
                  color:sub, fontSize:13, cursor:"pointer" }}>Cancel</button>
            </div>
          ) : (
            favCities.length < 5 && (
              <button onClick={()=>setAddCityMode(true)}
                style={{ padding:"6px 14px", borderRadius:999, fontSize:13, fontWeight:500,
                  border:`1.5px dashed ${border}`, background:"transparent", color:sub, cursor:"pointer" }}>
                + Add City
              </button>
            )
          )}
        </div>

        {/* Trending cities */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:24 }}>
          <span style={{ fontSize:12, color:sub, fontWeight:700, marginRight:4, whiteSpace:"nowrap" }}>🔥 Trending:</span>
          {TRENDING_CITIES.map(city=>(
            <button key={city} onClick={()=>handleCityClick(city)}
              style={{ padding:"4px 12px", borderRadius:999, fontSize:12, fontWeight:500,
                border:`1px solid ${border}`, background:"transparent", color:sub, cursor:"pointer",
                transition:"all .15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background="#6366f1"; e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="#6366f1"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=sub; e.currentTarget.style.borderColor=border; }}>
              {city}
            </button>
          ))}
        </div>

        {/* Weather */}
        <WeatherCard data={data} forecast={forecast} hourly={hourly}
          loading={wL} error={wE} prevTemp={prevTemp} unit={unit} dark={dark} />

        {/* News header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:18, fontWeight:700 }}>📰 Top Stories</div>
            {lastUpdated && (
              <span style={{ fontSize:12, color:sub }}>
                Updated {lastUpdated.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:dark?"#0f172a":"#f8fafc",
              border:`1.5px solid ${border}`, borderRadius:10, padding:"5px 10px" }}>
              <span>🔎</span>
              <input value={newsSearch} onChange={e=>setNewsSearch(e.target.value)}
                placeholder="Search news…"
                style={{ border:"none", outline:"none", fontSize:13, background:"transparent", width:130, color:text }} />
            </div>
            <button onClick={()=>setShowBM(b=>!b)}
              style={{ padding:"6px 14px", borderRadius:10, border:`1.5px solid ${border}`,
                background:showBM?"#6366f1":surface, color:showBM?"#fff":sub,
                fontSize:13, fontWeight:600, cursor:"pointer" }}>
              🔖 {bookmarks.length}
            </button>
            <button onClick={refreshNews}
              style={{ padding:"6px 14px", borderRadius:10, border:`1.5px solid ${border}`,
                background:surface, color:sub, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {NEWS_CATEGORIES.map(cat=>{
            const m = CATEGORY_META[cat];
            const active = newsCategory===cat && !showBM;
            return (
              <button key={cat} onClick={()=>{ setNewsCategory(cat); setShowBM(false); }}
                style={{ padding:"7px 18px", borderRadius:999, fontSize:13, fontWeight:500,
                  border:`1.5px solid ${active?m.color:border}`,
                  background:active?m.color:surface,
                  color:active?"#fff":sub, cursor:"pointer", transition:"all .2s" }}>
                {m.emoji} {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>

        {nE && <p style={{ color:"#ef4444", fontSize:14, marginBottom:12 }}>⚠️ Could not load news.</p>}

        {/* News grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
          {nL
            ? [...Array(6)].map((_,i)=>(
                <div key={i} style={{ background:surface, borderRadius:16, overflow:"hidden" }}>
                  <Sk h={175} r={0} dark={dark} />
                  <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                    <Sk h={13} w={70} dark={dark} /><Sk h={15} dark={dark} /><Sk h={15} w="75%" dark={dark} /><Sk h={12} w={110} dark={dark} />
                  </div>
                </div>
              ))
            : (showBM ? bmArticles : filtered).map((article,i)=>(
                <NewsCard key={i} article={article} category={newsCategory}
                  dark={dark} bookmarks={bookmarks} toggleBookmark={toggleBookmark} index={i} />
              ))
          }
          {showBM && bmArticles.length===0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"60px 0", color:sub }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔖</div>
              <div style={{ fontSize:15 }}>No bookmarks yet — tap 🏷️ on any article</div>
            </div>
          )}
          {!nL && !showBM && filtered.length===0 && newsSearch && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"60px 0", color:sub }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔎</div>
              <div style={{ fontSize:15 }}>No results for "{newsSearch}"</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:"center", padding:"24px 20px", fontSize:13, color:sub, borderTop:`1px solid ${border}` }}>
        ⛅ WeatherPulse · OpenWeatherMap &amp; Google News · Auto-refreshes every 10 min
      </div>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}
