import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

/* ─── Leaflet icon fix ─── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API    = 'http://localhost:5000';
const CENTER = { lat: 17.7231, lng: 83.3012 };
const CAPTURE_INTERVAL_MS = 1000;
const POINTS_PER_POTHOLE  = 10;

const DRIVE_ROUTE = [
  { lat: 17.7200, lng: 83.2970 },{ lat: 17.7210, lng: 83.2985 },
  { lat: 17.7215, lng: 83.2998 },{ lat: 17.7225, lng: 83.3005 },
  { lat: 17.7235, lng: 83.3010 },{ lat: 17.7241, lng: 83.3022 },
  { lat: 17.7248, lng: 83.3030 },{ lat: 17.7250, lng: 83.3010 },
  { lat: 17.7255, lng: 83.3038 },{ lat: 17.7260, lng: 83.3045 },
  { lat: 17.7265, lng: 83.3055 },{ lat: 17.7270, lng: 83.3065 },
  { lat: 17.7280, lng: 83.3075 },
];

const VIZAG_DESTINATIONS = [
  { label: '🏖️  RK Beach',             lat: 17.7192, lng: 83.3382 },
  { label: '✈️  Vizag Airport',         lat: 17.7213, lng: 83.2245 },
  { label: '🏥  King George Hospital',  lat: 17.7227, lng: 83.3118 },
  { label: '🛍️  CMR Central Mall',      lat: 17.7326, lng: 83.3192 },
  { label: '🎓  Andhra University',     lat: 17.7340, lng: 83.3312 },
  { label: '🚉  Vizag Railway Station', lat: 17.7133, lng: 83.2993 },
  { label: '⛰️  Kailasagiri',           lat: 17.7625, lng: 83.3778 },
  { label: '🏢  Siripuram Junction',    lat: 17.7231, lng: 83.3200 },
];

const SEV_COLOR  = { severe: '#f43f5e', moderate: '#f59e0b', minor: '#10b981' };
const SEV_RADIUS = { severe: 20, moderate: 14, minor: 9 };

const SIM_SPOTS = [
  { lat: 17.7241, lng: 83.3022, sev: 'severe',   conf: 0.91 },
  { lat: 17.7215, lng: 83.2998, sev: 'moderate', conf: 0.63 },
  { lat: 17.7260, lng: 83.3045, sev: 'minor',    conf: 0.45 },
  { lat: 17.7198, lng: 83.3078, sev: 'severe',   conf: 0.88 },
  { lat: 17.7275, lng: 83.2965, sev: 'moderate', conf: 0.71 },
];

const driverIcon = new L.DivIcon({
  html:       '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.8))">🚗</div>',
  className:  '',
  iconSize:   [34, 34],
  iconAnchor: [17, 17],
});

function beep(severity) {
  try {
    const ac  = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type            = 'sine';
    osc.frequency.value = severity === 'severe' ? 920 : severity === 'moderate' ? 660 : 440;
    g.gain.setValueAtTime(0.4, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.7);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.7);
  } catch (_) {}
}

function MapFollow({ pos }) {
  const map = useMap();
  useEffect(() => { map.setView([pos.lat, pos.lng], map.getZoom(), { animate: true }); }, [pos, map]);
  return null;
}

/* ══════════════════════════════════════════════════════
   GLOBAL STYLES  —  PitStop brand
══════════════════════════════════════════════════════ */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: #080812;
    color: #f0f0ff;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0f0f1e; }
  ::-webkit-scrollbar-thumb { background: #6d28d9; border-radius: 4px; }

  /* ── Animations ── */
  @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes fadeUp      { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn     { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes float       { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(2deg)} }
  @keyframes slideDown   { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes slideUp     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin        { to{transform:rotate(360deg)} }
  @keyframes haloGlow    { 0%,100%{box-shadow:0 0 30px rgba(109,40,217,.3)} 50%{box-shadow:0 0 60px rgba(109,40,217,.65),0 0 100px rgba(109,40,217,.2)} }
  @keyframes orbitDot    { from{transform:rotate(0deg) translateX(16px)} to{transform:rotate(360deg) translateX(16px)} }
  @keyframes shimmer     { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes bounceIn    { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }

  /* ── Utility ── */
  .glass {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(14px);
  }

  .card {
    background: rgba(255,255,255,.033);
    border: 1px solid rgba(255,255,255,.075);
    border-radius: 20px;
    transition: all .25s ease;
  }
  .card:hover {
    background: rgba(109,40,217,.1);
    border-color: rgba(109,40,217,.38);
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(109,40,217,.14);
  }

  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-weight: 700;
    transition: all .2s ease;
  }
  .btn-violet {
    background: linear-gradient(135deg,#7c3aed,#6d28d9);
    color: #fff; border-radius: 12px;
    padding: 13px 26px; font-size: 14px;
    box-shadow: 0 4px 22px rgba(109,40,217,.45);
  }
  .btn-violet:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(109,40,217,.65); }
  .btn-outline {
    background: rgba(255,255,255,.055);
    border: 1px solid rgba(255,255,255,.17) !important;
    color: rgba(255,255,255,.82); border-radius: 12px;
    padding: 13px 26px; font-size: 14px;
  }
  .btn-outline:hover { background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.32) !important; transform:translateY(-2px); }
  .btn-sm {
    padding: 6px 14px; border-radius: 9px; font-size: 11px;
  }
  .btn-danger { background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; border-radius:9px; padding:6px 12px; font-size:11px; }
  .btn-success { background:linear-gradient(135deg,#059669,#047857); color:#fff; border-radius:9px; padding:6px 12px; font-size:11px; }

  /* ── Logo mark ── */
  .ps-logo {
    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 55%, #10b981 100%);
    border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    box-shadow: 0 4px 22px rgba(109,40,217,.5);
    flex-shrink: 0;
  }
  .ps-logo::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 50%; background: rgba(255,255,255,.15);
    border-radius: 13px 13px 0 0;
  }

  /* ── Nav link ── */
  .nav-link {
    color: rgba(255,255,255,.55); font-size: 13.5px; font-weight: 500;
    cursor: pointer; padding: 7px 14px; border-radius: 9px;
    transition: all .18s; font-family: 'DM Sans', sans-serif;
  }
  .nav-link:hover { color:#fff; background:rgba(109,40,217,.18); }
  .nav-link.active { color:#c4b5fd; background:rgba(109,40,217,.15); font-weight:600; }

  /* ── Tab ── */
  .tab {
    flex: 1; padding: 12px 6px; border: none;
    background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all .2s; color: rgba(255,255,255,.35);
  }
  .tab.on { font-weight: 700; border-bottom: 2px solid #7c3aed; color: #a78bfa; }

  /* ── Pill / badge ── */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 99px; font-size: 11px; font-weight: 600;
    padding: 4px 12px;
  }
  .pill-live { background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.35); color:#10b981; }
  .pill-mode { border-radius: 99px; padding: 5px 14px; font-size: 12px; font-weight: 700; }

  /* ── Feature badge ── */
  .fbadge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 13px; border-radius: 99px;
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.55); font-size: 12px; font-weight: 500;
    transition: all .2s; cursor: default;
    font-family: 'DM Sans', sans-serif;
  }
  .fbadge:hover { border-color:rgba(109,40,217,.45); color:#c4b5fd; background:rgba(109,40,217,.1); }

  /* ── Road dashes ── */
  .road-dash {
    height: 3px; width: 100%;
    background: repeating-linear-gradient(90deg,
      rgba(109,40,217,.5) 0, rgba(109,40,217,.5) 28px,
      transparent 28px, transparent 48px
    );
  }

  /* ── Breadcrumb ── */
  .bc { display:flex; align-items:center; gap:7px; font-size:12px; color:rgba(255,255,255,.28); margin-bottom:14px; flex-wrap:wrap; }
  .bc span { cursor:pointer; transition:color .18s; }
  .bc span:hover { color:rgba(255,255,255,.75); }
  .bc .sep { color:rgba(255,255,255,.15); cursor:default; }
  .bc .cur { color:rgba(255,255,255,.65); font-weight:500; cursor:default; }

  /* ── Leaflet dark popup ── */
  .leaflet-popup-content-wrapper {
    background: #11112a !important; color: #f0f0ff !important;
    border: 1px solid rgba(109,40,217,.4) !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 30px rgba(0,0,0,.65) !important;
  }
  .leaflet-popup-tip { background: #11112a !important; }
  .leaflet-popup-content { color:rgba(240,240,255,.8) !important; font-family:'DM Sans',sans-serif !important; font-size:13px !important; line-height:1.75 !important; }
  .leaflet-popup-close-button { color:rgba(255,255,255,.38) !important; }

  .sensor-fill { transition:width .45s cubic-bezier(.4,0,.2,1); }
  select option { background:#11112a; color:#f0f0ff; }
`;

/* ── Reusable Logo ── */
function Logo({ size = 38 }) {
  return (
    <div className="ps-logo" style={{ width: size, height: size, fontSize: size * 0.5 }}>🏁</div>
  );
}

/* ── Breadcrumb ── */
function Breadcrumb({ screen, tab, goHome, goMode }) {
  const mL = { driver: 'Driver Mode', authority: 'Authority' };
  const tL = { map: 'Live Map', camera: 'Camera', sensor: 'Sensor', route: 'Route Planner', overview: 'Overview', reports: 'Reports' };
  return (
    <div className="bc">
      <span onClick={goHome}>🏠 PitStop</span>
      <span className="sep">›</span>
      <span onClick={goMode} style={{ color:'rgba(255,255,255,.45)' }}>{mL[screen]}</span>
      {tab && <><span className="sep">›</span><span className="cur">{tL[tab]}</span></>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════ */
export default function App() {
  /* ─── state ─── */
  const [screen,   setScreen]   = useState('home');
  const [tab,      setTab]      = useState('map');
  const [potholes, setPotholes] = useState([]);
  const [stats,    setStats]    = useState({});
  const [warning,  setWarning]  = useState(null);
  const [toast,    setToast]    = useState(null);

  const [driverPos,    setDriverPos]    = useState(CENTER);
  const [isDriving,    setIsDriving]    = useState(false);
  const [drivePercent, setDrivePercent] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [alertLevel,   setAlertLevel]   = useState(null);
  const [nearestDist,  setNearestDist]  = useState(null);
  const prevPosRef   = useRef(null);
  const driveStepRef = useRef(0);
  const driveActive  = useRef(false);
  const driveTimer   = useRef(null);

  const [detecting,      setDetecting]      = useState(false);
  const [camStatus,      setCamStatus]      = useState('Click Start Detection to begin');
  const [camCount,       setCamCount]       = useState(0);
  const [lastHit,        setLastHit]        = useState(null);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [flash,          setFlash]          = useState(false);
  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const detectActive    = useRef(false);
  const camInterval     = useRef(null);
  const processingRef   = useRef(false);
  const simIdx          = useRef(0);

  const [points,      setPoints]      = useState(0);
  const [pointsFlash, setPointsFlash] = useState(false);

  const [sensorOn,    setSensorOn]    = useState(false);
  const [magnitude,   setMagnitude]   = useState(0);
  const [xyz,         setXyz]         = useState({ x:0, y:0, z:9.8 });
  const [sensorLog,   setSensorLog]   = useState([]);
  const [sensorCount, setSensorCount] = useState(0);
  const sensorTimer = useRef(null);

  const [routeResult,  setRouteResult]  = useState(null);
  const [showRoute,    setShowRoute]    = useState(false);
  const [routeCalc,    setRouteCalc]    = useState(false);
  const [searchQ,      setSearchQ]      = useState('');
  const [selDest,      setSelDest]      = useState(null);
  const [showDD,       setShowDD]       = useState(false);
  const [customLat,    setCustomLat]    = useState('');
  const [customLng,    setCustomLng]    = useState('');
  const [useCustom,    setUseCustom]    = useState(false);
  const [searchErr,    setSearchErr]    = useState('');

  const [filter, setFilter] = useState('all');

  const warnQ     = useRef([]);
  const warnShown = useRef(false);

  /* ─── fetch ─── */
  const fetch_ = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([axios.get(`${API}/potholes`), axios.get(`${API}/stats`)]);
      setPotholes(p.data); setStats(s.data);
    } catch (_) {}
  }, []);

  useEffect(() => { fetch_(); const iv = setInterval(fetch_, 3000); return () => clearInterval(iv); }, [fetch_]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const toast_ = (msg, type = 'success') => setToast({ msg, type });

  /* ─── nav helpers ─── */
  const goHome = useCallback(() => {
    stopDrive(); stopCamera(); stopSensor();
    setScreen('home');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goDriver    = useCallback((t = 'map')    => { setScreen('driver');    setTab(t); }, []);
  const goAuthority = useCallback((t = 'overview') => { setScreen('authority'); setTab(t); }, []);

  /* ─── warnings ─── */
  const smartWarn = useCallback((msg, sev, dist = 0, spd = 0) => {
    if (spd === 0 && dist > 10) return;
    let lvl = null;
    if (dist < 30 && sev === 'severe')           lvl = 'critical';
    else if (dist < 50)                           lvl = 'moderate';
    else if (dist < 100)                          lvl = 'low';
    else return;
    beep(sev);
    warnQ.current.push({ msg, sev, lvl, dist, spd });
    setAlertLevel(lvl);
    if (!warnShown.current) drainQ();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simpleWarn = useCallback((msg, sev) => smartWarn(msg, sev, 0, 30), [smartWarn]);

  const drainQ = () => {
    if (!warnQ.current.length) { warnShown.current = false; setAlertLevel(null); return; }
    warnShown.current = true;
    const n = warnQ.current.shift();
    setWarning(n); setAlertLevel(n.lvl || 'moderate');
    const dur = n.lvl === 'critical' ? 6000 : n.lvl === 'low' ? 3000 : 5000;
    setTimeout(() => { setWarning(null); setAlertLevel(null); setTimeout(drainQ, 400); }, dur);
  };

  /* ─── helpers ─── */
  const addDemo = async () => {
    try { await axios.post(`${API}/add_demo`); await fetch_(); toast_('10 demo potholes loaded!'); }
    catch (_) { toast_('Backend offline — run Flask first!', 'error'); }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset all PitStop data?')) return;
    try {
      await axios.delete(`${API}/reset`); await fetch_();
      setRouteResult(null); setShowRoute(false); setPoints(0);
      toast_('Data reset.');
    } catch (_) { toast_('Reset failed — is Flask running?', 'error'); }
  };

  const exportCSV = () => {
    const rows = [
      ['ID','Severity','Lat','Lng','Confidence','Source','Status','Timestamp'],
      ...potholes.map(p => [p.id,p.severity,p.lat,p.lng,p.confidence,p.source,p.repairStatus,p.timestamp]),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type:'text/csv' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pitstop_report.csv' }).click();
    toast_('Exported pitstop_report.csv!');
  };

  const updateStatus = async (id, status) => {
    await axios.put(`${API}/potholes/${id}/status`, { status }); await fetch_();
  };

  const earnPts = useCallback((n = 1) => {
    setPoints(p => p + n * POINTS_PER_POTHOLE);
    setPointsFlash(true); setTimeout(() => setPointsFlash(false), 700);
  }, []);

  /* ─── drive ─── */
  const startDrive = async () => {
    let cur = potholes;
    if (!cur.length) {
      try { await axios.post(`${API}/add_demo`); const r = await axios.get(`${API}/potholes`); cur = r.data; setPotholes(cur); } catch (_) {}
    }
    driveStepRef.current = 0; driveActive.current = true;
    setIsDriving(true); setDrivePercent(0); setDriverPos({ ...DRIVE_ROUTE[0] });
    toast_('Drive simulation started — watch for alerts!');
    driveTimer.current = setInterval(async () => {
      if (!driveActive.current) return;
      const step = driveStepRef.current;
      if (step >= DRIVE_ROUTE.length) {
        clearInterval(driveTimer.current); driveActive.current = false;
        setIsDriving(false); setDrivePercent(100);
        toast_('Drive complete! 🏁'); return;
      }
      const pos = DRIVE_ROUTE[step]; driveStepRef.current = step + 1;
      setDriverPos({ ...pos }); setDrivePercent(Math.round(((step+1)/DRIVE_ROUTE.length)*100));
      let spd = 30;
      if (prevPosRef.current) {
        const dLat = (pos.lat - prevPosRef.current.lat)*111000;
        const dLng = (pos.lng - prevPosRef.current.lng)*111000*Math.cos(pos.lat*Math.PI/180);
        spd = Math.round((Math.sqrt(dLat*dLat+dLng*dLng)/2)*3.6);
      }
      prevPosRef.current = pos; setCurrentSpeed(spd);
      try {
        const res = await axios.get(`${API}/warning`, { params:{ lat:pos.lat, lng:pos.lng } });
        if (res.data.hasWarning && res.data.nearest) {
          const n = res.data.nearest; const dist = n.distance||0; setNearestDist(dist);
          const msg = dist<30
            ? `🚨 DANGER! Pothole ${dist}m AHEAD — ${n.severity.toUpperCase()} — BRAKE NOW!`
            : dist<50 ? `⚠️  Pothole ${dist}m ahead — ${n.severity.toUpperCase()} — Slow down`
            : `📍 Pothole ${dist}m ahead — ${n.severity.toUpperCase()}`;
          smartWarn(msg, n.severity, dist, spd);
        } else { setNearestDist(null); }
      } catch (_) {}
    }, 2000);
  };

  const stopDrive = () => {
    clearInterval(driveTimer.current); driveActive.current = false;
    setIsDriving(false); setDriverPos({ ...CENTER });
  };

  /* ─── camera ─── */
  const startCamera = async () => {
    detectActive.current = true; processingRef.current = false;
    setDetecting(true); setLastHit(null); setIsProcessing(false);
    setCamStatus('Starting camera…');
    let hasCam = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:640}, height:{ideal:480} } });
      videoRef.current.srcObject = s; await videoRef.current.play(); hasCam = true;
    } catch (_) {
      try { const s = await navigator.mediaDevices.getUserMedia({ video:true }); videoRef.current.srcObject = s; await videoRef.current.play(); hasCam = true; } catch (_2) {}
    }
    if (hasCam) { setCamStatus(`✅ Camera live — scanning every ${CAPTURE_INTERVAL_MS/1000}s via YOLOv8`); startCamInt(); }
    else        { setCamStatus('⚡ No webcam — simulation mode active'); simIdx.current = 0; startSimInt(); }
  };

  const stopCamera = () => {
    detectActive.current = false; setDetecting(false); setIsProcessing(false); processingRef.current = false;
    if (camInterval.current) { clearInterval(camInterval.current); camInterval.current = null; }
    setCamStatus('Click Start Detection to begin');
    try { videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); if (videoRef.current) videoRef.current.srcObject = null; } catch (_) {}
  };

  const startCamInt = () => {
    if (camInterval.current) clearInterval(camInterval.current);
    camInterval.current = setInterval(async () => {
      if (!detectActive.current || processingRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      processingRef.current = true; setIsProcessing(true);
      try {
        const c = canvasRef.current; const v = videoRef.current;
        if (!v.videoWidth) { processingRef.current = false; setIsProcessing(false); return; }
        const ctx = c.getContext('2d'); c.width = v.videoWidth; c.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const b64 = c.toDataURL('image/jpeg', .7).split(',')[1];
        const lat = CENTER.lat+(Math.random()-.5)*.01; const lng = CENTER.lng+(Math.random()-.5)*.01;
        const res = await axios.post(`${API}/detect`, { image:b64, lat, lng }, { timeout:3000 });
        if (res.data.detected && res.data.count > 0) {
          const conf = res.data.detections[0].confidence;
          const sev  = conf>.75?'severe':conf>.5?'moderate':'minor';
          setFlash(true); setTimeout(() => setFlash(false), 300);
          setCamCount(n => n+1); setLastHit({ conf, sev, time: new Date().toLocaleTimeString(), count: res.data.count });
          earnPts(res.data.count);
          simpleWarn(`CAMERA: ${res.data.count} pothole(s) — ${sev.toUpperCase()} — ${Math.round(conf*100)}% conf`, sev);
          await fetch_();
        }
      } catch (_) {} finally { processingRef.current = false; setIsProcessing(false); }
    }, CAPTURE_INTERVAL_MS);
  };

  const startSimInt = () => {
    if (camInterval.current) clearInterval(camInterval.current);
    camInterval.current = setInterval(async () => {
      if (!detectActive.current) return;
      const spot = SIM_SPOTS[simIdx.current % SIM_SPOTS.length]; simIdx.current++;
      try {
        const mag = spot.sev==='severe'?28:spot.sev==='moderate'?20:16;
        await axios.post(`${API}/sensor`, { x:mag*.6, y:mag*.5, z:mag*.6, lat:spot.lat, lng:spot.lng });
        await fetch_();
      } catch (_) {}
      setFlash(true); setTimeout(() => setFlash(false), 300);
      setCamCount(n=>n+1); setLastHit({ conf:spot.conf, sev:spot.sev, time:new Date().toLocaleTimeString(), count:1 });
      earnPts(1); simpleWarn(`SIM: ${spot.sev.toUpperCase()} — ${Math.round(spot.conf*100)}% conf`, spot.sev);
    }, CAPTURE_INTERVAL_MS*4);
  };

  /* ─── sensor ─── */
  const startSensor = () => {
    setSensorOn(true);
    sensorTimer.current = setInterval(async () => {
      const hit = Math.random() < .18;
      const x = hit?(Math.random()*18+14):(Math.random()*3-1.5);
      const y = hit?(Math.random()*18+14):(Math.random()*3-1.5);
      const z = hit?(Math.random()*12+18):(9.8+Math.random()*1.5-.75);
      const mag = parseFloat(Math.sqrt(x*x+y*y+z*z).toFixed(2));
      setMagnitude(mag); setXyz({ x:parseFloat(x.toFixed(2)), y:parseFloat(y.toFixed(2)), z:parseFloat(z.toFixed(2)) });
      try {
        const res = await axios.post(`${API}/sensor`, { x, y, z, lat:CENTER.lat+(Math.random()-.5)*.01, lng:CENTER.lng+(Math.random()-.5)*.01 });
        if (res.data.detected) {
          const sev = mag>28?'severe':mag>18?'moderate':'minor';
          setSensorCount(n=>n+1);
          setSensorLog(l => [{ time:new Date().toLocaleTimeString(), mag:res.data.magnitude, sev }, ...l].slice(0,8));
          earnPts(1); simpleWarn(`SENSOR: Pothole — ${res.data.magnitude} m/s² — ${sev.toUpperCase()}`, sev);
          await fetch_();
        }
      } catch (_) {}
    }, 1000);
  };
  const stopSensor = () => { clearInterval(sensorTimer.current); setSensorOn(false); };

  /* ─── route ─── */
  const calcRoute = async () => {
    setSearchErr('');
    let dest = null;
    if (useCustom) {
      const la = parseFloat(customLat); const ln = parseFloat(customLng);
      if (isNaN(la)||isNaN(ln)) { setSearchErr('⚠️ Enter valid lat/lng numbers'); return; }
      dest = { label:'Custom Location', lat:la, lng:ln };
    } else if (selDest) { dest = selDest; }
    else { setSearchErr('⚠️ Select a destination first'); return; }
    if (!potholes.length) { await addDemo(); await new Promise(r => setTimeout(r, 800)); }
    setRouteCalc(true);
    try {
      const res = await axios.get(`${API}/route`, { params:{ start_lat:CENTER.lat, start_lng:CENTER.lng, end_lat:dest.lat, end_lng:dest.lng } });
      setRouteResult({ ...res.data, destination:dest }); setShowRoute(true);
      toast_(`Route to ${dest.label} ready — Green = safest path`);
    } catch (_) { toast_('Route error — is Flask running?', 'error'); }
    setRouteCalc(false);
  };

  /* ─── derived ─── */
  const filtered = potholes.filter(p => {
    if (filter==='all') return true;
    if (['severe','moderate','minor'].includes(filter)) return p.severity===filter;
    if (filter==='pending')  return p.repairStatus==='pending';
    if (filter==='repaired') return p.repairStatus==='repaired';
    return true;
  });

  const magColor = magnitude>25?'#f43f5e':magnitude>15?'#f59e0b':'#10b981';
  const magLabel = magnitude>25?'🚨 POTHOLE DETECTED':magnitude>15?'⚠️ ROUGH ROAD':'✅ SMOOTH ROAD';

  const tier = (() => {
    if (points>=500) return { label:'👑 Road Queen',   color:'#f59e0b' };
    if (points>=200) return { label:'💎 Road Diva',    color:'#a855f7' };
    if (points>=100) return { label:'🔥 Road Warrior', color:'#ef4444' };
    if (points>=50)  return { label:'⚡ Road Scout',   color:'#6366f1' };
    return               { label:'🌱 Rookie',        color:'#10b981' };
  })();

  const filtDests = VIZAG_DESTINATIONS.filter(d => d.label.toLowerCase().includes(searchQ.toLowerCase()));

  /* ══════════════════════════════════════════════════════
     HOME
  ══════════════════════════════════════════════════════ */
  if (screen === 'home') return (
    <>
      <style>{G}</style>
      <div style={{ minHeight:'100vh', background:'linear-gradient(140deg, #080812 0%, #13093a 45%, #0b1f3f 75%, #080812 100%)', position:'relative', overflow:'hidden' }}>

        {/* Background orbs */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:'-10%', left:'-5%',  width:'55vw', height:'55vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(109,40,217,.18) 0%, transparent 68%)' }} />
          <div style={{ position:'absolute', bottom:'-5%', right:'-3%', width:'44vw', height:'44vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(91,33,182,.14) 0%, transparent 68%)' }} />
          <div style={{ position:'absolute', top:'42%', right:'16%', width:'26vw', height:'26vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(16,185,129,.08) 0%, transparent 68%)' }} />
          {/* Road stripe bottom */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'5px', background:'repeating-linear-gradient(90deg, rgba(109,40,217,.45) 0, rgba(109,40,217,.45) 36px, transparent 36px, transparent 60px)' }} />
        </div>

        {/* ── NAVBAR ── */}
        <nav style={{ position:'sticky', top:0, zIndex:300, background:'rgba(8,8,18,.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,.06)', padding:'0 5%', display:'flex', alignItems:'center', justifyContent:'space-between', height:'66px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
            <Logo size={40} />
            <div>
              <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'20px', color:'#f0f0ff', letterSpacing:'-0.5px', lineHeight:1.1 }}>PitStop</div>
              <div style={{ fontSize:'9px', color:'rgba(255,255,255,.3)', letterSpacing:'2px', textTransform:'uppercase' }}>Road Intelligence</div>
            </div>
          </div>

          <div style={{ display:'flex', gap:'2px' }}>
            {[
              { label:'Home',         fn: null },
              { label:'Driver',       fn: () => goDriver('map') },
              { label:'Authority',    fn: () => goAuthority('overview') },
            ].map(i => (
              <span key={i.label} className={`nav-link${i.label==='Home'?' active':''}`} onClick={i.fn||undefined}>{i.label}</span>
            ))}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div className="pill pill-live">
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite' }} />
              System Live
            </div>
            <button className="btn btn-violet btn-sm" onClick={() => goDriver('map')}>Open App →</button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <div style={{ padding:'68px 5% 50px', maxWidth:'1180px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'52px', flexWrap:'wrap' }}>

            {/* Left copy */}
            <div style={{ flex:1, minWidth:'300px', animation:'fadeUp .65s ease both' }}>

              <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(109,40,217,.15)', border:'1px solid rgba(109,40,217,.35)', borderRadius:'99px', padding:'6px 16px', marginBottom:'22px' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#a78bfa', animation:'pulse 1.5s infinite' }} />
                <span style={{ color:'#c4b5fd', fontSize:'12.5px', fontWeight:600 }}>YOLOv8 AI · Visakhapatnam · Real-time</span>
              </div>

              <h1 style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'clamp(34px,5.5vw,62px)', lineHeight:1.08, marginBottom:'22px', letterSpacing:'-1.5px' }}>
                <span style={{ color:'#f0f0ff' }}>Drive Smart.</span><br />
                <span style={{ background:'linear-gradient(135deg, #7c3aed, #a78bfa 50%, #10b981)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Avoid Potholes.</span><br />
                <span style={{ color:'rgba(240,240,255,.78)' }}>Stay Safe.</span>
              </h1>

              <p style={{ color:'rgba(255,255,255,.48)', fontSize:'15.5px', lineHeight:1.78, maxWidth:'460px', marginBottom:'32px', fontFamily:"'DM Sans', sans-serif" }}>
                PitStop uses AI computer vision + accelerometer fusion to detect road hazards in real-time — warning drivers instantly and giving city authorities a repair dashboard.
              </p>

              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'30px' }}>
                <button className="btn btn-violet" style={{ fontSize:'15px', padding:'14px 30px', borderRadius:'13px' }} onClick={() => goDriver('map')}>
                  🚗 Launch Driver Mode
                </button>
                <button className="btn btn-outline" style={{ fontSize:'15px', padding:'14px 28px', borderRadius:'13px' }} onClick={() => goAuthority('overview')}>
                  🏛️ Authority Dashboard
                </button>
              </div>

              <div style={{ display:'flex', gap:'7px', flexWrap:'wrap' }}>
                {['YOLOv8 AI','Sensor Fusion','GPS Alerts','Smart Warnings','Safe Routes','Repair Tracking'].map(f => (
                  <span key={f} className="fbadge">{f}</span>
                ))}
              </div>
            </div>

            {/* Right card */}
            <div style={{ flex:1, minWidth:'290px', maxWidth:'460px', animation:'scaleIn .75s ease both' }}>
              <div style={{ background:'linear-gradient(135deg, rgba(109,40,217,.2), rgba(91,33,182,.14), rgba(16,185,129,.07))', border:'1px solid rgba(109,40,217,.32)', borderRadius:'26px', padding:'30px', backdropFilter:'blur(22px)', animation:'haloGlow 4s infinite', position:'relative', overflow:'hidden', boxShadow:'inset 0 1px 0 rgba(255,255,255,.1)' }}>
                <div style={{ position:'absolute', top:'17px', right:'18px', display:'flex', gap:'6px' }}>
                  {['#f43f5e','#f59e0b','#10b981'].map(c => <div key={c} style={{ width:11, height:11, borderRadius:'50%', background:c, opacity:.85 }} />)}
                </div>

                <div style={{ textAlign:'center', padding:'6px 0 18px' }}>
                  <div style={{ fontSize:'70px', animation:'float 3.8s ease-in-out infinite', display:'inline-block', filter:'drop-shadow(0 10px 30px rgba(109,40,217,.65))' }}>🏁</div>
                  <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'15px', color:'rgba(255,255,255,.7)', marginTop:'6px' }}>PitStop · Live Dashboard</div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px', marginBottom:'13px' }}>
                  {[
                    { l:'Detected', v:stats.total||0,    c:'#a78bfa', i:'🕳️' },
                    { l:'Severe',   v:stats.severe||0,   c:'#f43f5e', i:'🔴' },
                    { l:'Repaired', v:stats.repaired||0, c:'#10b981', i:'✅' },
                    { l:'Pending',  v:stats.pending||0,  c:'#f59e0b', i:'⏳' },
                  ].map(s => (
                    <div key={s.l} style={{ background:'rgba(255,255,255,.05)', borderRadius:'13px', padding:'13px', textAlign:'center', border:`1px solid ${s.c}22` }}>
                      <div style={{ fontSize:'20px', marginBottom:'4px' }}>{s.i}</div>
                      <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'26px', color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:'10px', color:'rgba(255,255,255,.3)', marginTop:'2px' }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                <div style={{ textAlign:'center', color:'rgba(255,255,255,.26)', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite' }} />
                  Syncing with Flask backend every 3s
                </div>
              </div>

              {/* Quick-mode tiles */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px', marginTop:'10px' }}>
                {[
                  { i:'🚗', l:'Driver Mode',    d:'Real-time detection', c:'#7c3aed', fn:()=>goDriver('map') },
                  { i:'🏛️', l:'Authority Mode', d:'Repair management',   c:'#5b21b6', fn:()=>goAuthority('overview') },
                ].map(m => (
                  <div key={m.l} onClick={m.fn} style={{ background:`${m.c}12`, border:`1px solid ${m.c}38`, borderRadius:'16px', padding:'16px', cursor:'pointer', transition:'all .22s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${m.c}22`;e.currentTarget.style.transform='translateY(-3px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${m.c}12`;e.currentTarget.style.transform='none';}}>
                    <div style={{ fontSize:'26px', marginBottom:'7px' }}>{m.i}</div>
                    <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'13px', color:'#f0f0ff', marginBottom:'3px' }}>{m.l}</div>
                    <div style={{ fontSize:'11px', color:'rgba(255,255,255,.35)', marginBottom:'8px' }}>{m.d}</div>
                    <div style={{ fontSize:'11px', color:m.c, fontWeight:700 }}>Enter →</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FEATURES GRID ── */}
          <div style={{ marginTop:'80px' }}>
            <div style={{ textAlign:'center', marginBottom:'38px' }}>
              <div style={{ display:'inline-block', background:'rgba(109,40,217,.1)', border:'1px solid rgba(109,40,217,.24)', borderRadius:'99px', padding:'5px 18px', marginBottom:'14px' }}>
                <span style={{ color:'#a78bfa', fontSize:'11.5px', fontWeight:700, letterSpacing:'1.2px', textTransform:'uppercase' }}>Features</span>
              </div>
              <h2 style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'30px', marginBottom:'10px' }}>Everything You Need</h2>
              <p style={{ color:'rgba(255,255,255,.36)', fontSize:'14px', maxWidth:'480px', margin:'0 auto' }}>Two modes — one for drivers on the road, one for city authorities managing repairs</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'13px' }}>
              {[
                { i:'📷', t:'YOLOv8 Camera',   d:'Frame-by-frame AI detection at 1fps from your car camera',      c:'#7c3aed', fn:()=>goDriver('camera') },
                { i:'📡', t:'Accelerometer',   d:'Sensor fusion via device gyroscope detects road vibrations',    c:'#8b5cf6', fn:()=>goDriver('sensor') },
                { i:'🗺️', t:'Live GPS Map',    d:'Color-coded severity markers with real-time GPS tracking',      c:'#10b981', fn:()=>goDriver('map') },
                { i:'⚠️', t:'Smart Alerts',    d:'Speed + distance aware warnings with 3 urgency levels',        c:'#f59e0b', fn:()=>goDriver('map') },
                { i:'🔀', t:'Safe Routes',     d:'Alternate routing to avoid pothole clusters automatically',     c:'#f43f5e', fn:()=>goDriver('route') },
                { i:'📊', t:'Authority Panel', d:'Repair status management, analytics, and CSV export',          c:'#5b21b6', fn:()=>goAuthority('overview') },
              ].map(f => (
                <div key={f.t} className="card" style={{ padding:'22px', cursor:'pointer' }} onClick={f.fn}>
                  <div style={{ width:46, height:46, borderRadius:'13px', background:`${f.c}16`, border:`1px solid ${f.c}32`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', marginBottom:'14px' }}>
                    {f.i}
                  </div>
                  <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'14px', color:'#f0f0ff', marginBottom:'6px' }}>{f.t}</div>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,.38)', lineHeight:1.65, marginBottom:'12px' }}>{f.d}</div>
                  <div style={{ fontSize:'11px', color:f.c, fontWeight:700 }}>Try it →</div>
                </div>
              ))}
            </div>
          </div>

          {/* Points if earned */}
          {points > 0 && (
            <div style={{ textAlign:'center', padding:'28px 0 8px', animation:'bounceIn .5s ease' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'14px', background:`${tier.color}10`, border:`1px solid ${tier.color}35`, borderRadius:'18px', padding:'16px 30px' }}>
                <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'19px', color:tier.color }}>{tier.label}</div>
                <div style={{ width:1, height:26, background:'rgba(255,255,255,.1)' }} />
                <div style={{ color:'rgba(255,255,255,.48)', fontSize:'13.5px' }}><strong style={{ color:tier.color }}>{points}</strong> PitStop Points this session</div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,.05)', padding:'22px 5%', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
            <Logo size={26} />
            <span style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, color:'rgba(255,255,255,.4)', fontSize:'13px' }}>PitStop</span>
          </div>
          <div style={{ color:'rgba(255,255,255,.18)', fontSize:'11px' }}>
            Powered by YOLOv8 + Flask + React · Visakhapatnam Smart Roads Initiative
          </div>
          <div style={{ display:'flex', gap:'18px' }}>
            {[['Driver', ()=>goDriver('map')], ['Authority', ()=>goAuthority('overview')]].map(([l,fn]) => (
              <span key={l} onClick={fn} style={{ color:'rgba(255,255,255,.28)', fontSize:'12px', cursor:'pointer', transition:'color .18s' }}
                onMouseEnter={e=>e.target.style.color='rgba(255,255,255,.7)'}
                onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.28)'}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════
     DRIVER / AUTHORITY CHROME
  ══════════════════════════════════════════════════════ */
  const isDriver = screen === 'driver';
  const accent   = isDriver ? '#7c3aed' : '#5b21b6';
  const tabs     = isDriver ? ['map','camera','sensor','route'] : ['overview','map','reports'];
  const tabIcons = { map:'🗺️', camera:'📷', sensor:'📡', route:'🔀', overview:'📊', reports:'📋' };

  return (
    <>
      <style>{G}</style>
      <div style={{ background:'linear-gradient(180deg,#080812 0%,#0f0f24 100%)', minHeight:'100vh', color:'#f0f0ff' }}>

        {/* ── CRITICAL WARNING ── */}
        {warning && alertLevel==='critical' && (
          <div onClick={()=>{setWarning(null);setAlertLevel(null);}} style={{ position:'fixed',top:0,left:0,right:0,zIndex:9999, background:'linear-gradient(135deg,#dc2626,#991b1b)', padding:'15px 22px', textAlign:'center', cursor:'pointer', borderBottom:'3px solid #fca5a5', animation:'pulse .55s ease-in-out infinite', boxShadow:'0 4px 40px rgba(220,38,38,.9)' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'16px' }}>🚨🚨 {warning.msg} 🚨🚨</div>
            <div style={{ fontSize:'11px', opacity:.8, marginTop:'3px' }}>Speed: {currentSpeed} km/h · {warning.dist}m away · tap to dismiss</div>
          </div>
        )}
        {warning && alertLevel==='moderate' && (
          <div onClick={()=>{setWarning(null);setAlertLevel(null);}} style={{ position:'fixed',top:0,left:0,right:0,zIndex:9999, background:'linear-gradient(135deg,#d97706,#b45309)', padding:'12px 22px', textAlign:'center', cursor:'pointer', boxShadow:'0 4px 24px rgba(0,0,0,.7)' }}>
            <span style={{ fontWeight:700, fontSize:'14px' }}>⚠️ {warning.msg}</span>
            <span style={{ fontSize:'11px', opacity:.7, marginLeft:'10px' }}>{warning.dist}m · {currentSpeed} km/h · tap to dismiss</span>
          </div>
        )}
        {warning && alertLevel==='low' && (
          <div onClick={()=>{setWarning(null);setAlertLevel(null);}} style={{ position:'fixed',top:0,left:0,right:0,zIndex:9999, background:'#15803d', padding:'8px 22px', textAlign:'center', cursor:'pointer' }}>
            <span style={{ fontSize:'12px', fontWeight:600 }}>📍 {warning.msg}</span>
            <span style={{ fontSize:'10px', opacity:.65, marginLeft:'8px' }}>tap to dismiss</span>
          </div>
        )}

        {/* ── TOAST ── */}
        {toast && (
          <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:9998, padding:'12px 17px', borderRadius:'13px', fontSize:'13px', fontWeight:600, background:toast.type==='success'?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,.55)', maxWidth:'300px', border:'1px solid rgba(255,255,255,.1)', animation:'slideUp .3s ease' }}>
            {toast.type==='success'?'✅':'❌'} {toast.msg}
          </div>
        )}

        {/* ── HEADER ── */}
        <div style={{ background:'rgba(8,8,18,.96)', backdropFilter:'blur(22px)', borderBottom:'1px solid rgba(255,255,255,.07)', padding:'0 14px', marginTop:warning?'50px':'0', transition:'margin .3s', display:'flex', alignItems:'center', justifyContent:'space-between', height:'60px', position:'sticky', top:0, zIndex:500, gap:'8px', flexWrap:'wrap' }}>

          {/* Left: logo + nav pills */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'9px', cursor:'pointer' }} onClick={goHome}>
              <Logo size={34} />
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'16px', color:'rgba(240,240,255,.85)' }}>PitStop</span>
            </div>

            <div style={{ width:1, height:22, background:'rgba(255,255,255,.08)' }} />

            <button onClick={goHome} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.55)', padding:'4px 11px', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:600 }}>← Home</button>

            {/* Mode badge */}
            <div style={{ background:`${accent}16`, border:`1px solid ${accent}38`, borderRadius:'99px', padding:'5px 13px', display:'flex', alignItems:'center', gap:'7px' }}>
              <span style={{ fontSize:'14px' }}>{isDriver?'🚗':'🏛️'}</span>
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'12px', color:isDriver?'#c4b5fd':'#a5b4fc' }}>{isDriver?'Driver Mode':'Authority'}</span>
            </div>

            {/* Quick mode-switch */}
            {isDriver
              ? <button onClick={()=>goAuthority('overview')} style={{ background:'rgba(91,33,182,.12)', border:'1px solid rgba(91,33,182,.3)', color:'#a5b4fc', padding:'4px 11px', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:600 }}>🏛️ Authority</button>
              : <button onClick={()=>goDriver('map')} style={{ background:'rgba(124,58,237,.12)', border:'1px solid rgba(124,58,237,.3)', color:'#c4b5fd', padding:'4px 11px', borderRadius:'8px', cursor:'pointer', fontSize:'11px', fontWeight:600 }}>🚗 Driver</button>
            }

            <div className="pill pill-live" style={{ padding:'3px 9px', fontSize:'10px' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite' }} />
              {potholes.length} potholes
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
            {isDriver && (
              <div style={{ padding:'4px 11px', borderRadius:'99px', background:pointsFlash?tier.color:`${tier.color}15`, border:`1px solid ${tier.color}42`, color:pointsFlash?'#080812':tier.color, fontSize:'11px', fontWeight:700, transition:'all .28s' }}>
                🏁 {points} pts
              </div>
            )}
            <button onClick={addDemo} style={{ padding:'5px 12px', borderRadius:'8px', border:'none', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#080812', cursor:'pointer', fontSize:'11px', fontWeight:700 }}>+ Demo</button>
            {!isDriver && (
              <>
                <button onClick={exportCSV} className="btn btn-success btn-sm">↓ CSV</button>
                <button onClick={resetAll}  className="btn btn-danger  btn-sm">Reset</button>
              </>
            )}
          </div>
        </div>

        {/* ── TAB BAR ── */}
        <div style={{ display:'flex', background:'rgba(8,8,18,.92)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          {tabs.map(t => (
            <button key={t} className={`tab${tab===t?' on':''}`} onClick={()=>setTab(t)}>
              {tabIcons[t]} {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="road-dash" style={{ opacity:.4 }} />

        {/* ══════════════════════════════════════════════════════
            TAB CONTENT
        ══════════════════════════════════════════════════════ */}
        <div style={{ padding:'14px' }}>
          <Breadcrumb screen={screen} tab={tab} goHome={goHome} goMode={isDriver?()=>goDriver(null):()=>goAuthority(null)} />

          {/* ────────── MAP ────────── */}
          {tab==='map' && (
            <div style={{ position:'relative', margin:'-14px', marginTop:'-32px' }}>
              <MapContainer center={[CENTER.lat,CENTER.lng]} zoom={15} style={{ height:'calc(100vh - 138px)', width:'100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {isDriver && <MapFollow pos={driverPos} />}
                {isDriver && (
                  <Marker position={[driverPos.lat,driverPos.lng]} icon={driverIcon}>
                    <Popup><strong>📍 Your Location</strong><br />{driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)}</Popup>
                  </Marker>
                )}
                {isDriver && <Polyline positions={DRIVE_ROUTE.map(p=>[p.lat,p.lng])} pathOptions={{ color:'#7c3aed', weight:3, dashArray:'7,5', opacity:.7 }} />}
                {potholes.map(p => (
                  <CircleMarker key={p.id} center={[p.lat,p.lng]} radius={SEV_RADIUS[p.severity]||10}
                    pathOptions={{ color:p.repairStatus==='repaired'?'#475569':SEV_COLOR[p.severity]||'#94a3b8', fillColor:p.repairStatus==='repaired'?'#475569':SEV_COLOR[p.severity]||'#94a3b8', fillOpacity:.87, weight:2 }}>
                    <Popup>
                      <strong style={{ textTransform:'uppercase', color:SEV_COLOR[p.severity] }}>{p.severity} POTHOLE</strong><br />
                      Confidence: {Math.round((p.confidence||0)*100)}%<br />
                      Source: {p.source}<br />Status: {p.repairStatus}<br />
                      <small style={{ color:'rgba(255,255,255,.35)' }}>{new Date(p.timestamp).toLocaleString()}</small>
                    </Popup>
                  </CircleMarker>
                ))}
                {showRoute && routeResult?.directRoute   && <Polyline positions={routeResult.directRoute.points}   pathOptions={{ color:'#f43f5e', weight:5, dashArray:'10,6' }} />}
                {showRoute && routeResult?.alternateRoute && <Polyline positions={routeResult.alternateRoute.points} pathOptions={{ color:'#10b981', weight:5 }} />}
              </MapContainer>

              {/* Drive HUD (top-left) */}
              {isDriver && (
                <div style={{ position:'absolute', top:'14px', left:'14px', zIndex:1000, display:'flex', flexDirection:'column', gap:'8px' }}>
                  <button onClick={isDriving?stopDrive:startDrive} style={{ padding:'11px 20px', borderRadius:'12px', border:'none', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:'13px', cursor:'pointer', background:isDriving?'rgba(239,68,68,.93)':'rgba(124,58,237,.95)', color:'#fff', backdropFilter:'blur(10px)', boxShadow:'0 4px 22px rgba(0,0,0,.6)' }}>
                    {isDriving?'⏹ Stop Drive':'▶ Simulate Drive'}
                  </button>

                  {isDriving && (
                    <div style={{ background:'rgba(8,8,18,.92)', backdropFilter:'blur(12px)', border:`1px solid rgba(124,58,237,.32)`, borderRadius:'13px', padding:'11px 16px', display:'flex', gap:'16px', alignItems:'center' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ color:'#f59e0b', fontWeight:800, fontSize:'26px', fontFamily:'monospace', lineHeight:1 }}>{currentSpeed}</div>
                        <div style={{ color:'rgba(255,255,255,.26)', fontSize:'9px', marginTop:2 }}>km/h</div>
                      </div>
                      <div style={{ width:1, height:34, background:'rgba(255,255,255,.08)' }} />
                      <div style={{ textAlign:'center' }}>
                        <div style={{ color:nearestDist===null?'#475569':nearestDist<30?'#f43f5e':nearestDist<50?'#f59e0b':'#10b981', fontWeight:800, fontSize:'26px', fontFamily:'monospace', lineHeight:1 }}>{nearestDist!==null?nearestDist:'–'}</div>
                        <div style={{ color:'rgba(255,255,255,.26)', fontSize:'9px', marginTop:2 }}>m ahead</div>
                      </div>
                    </div>
                  )}

                  {isDriving && (
                    <div style={{ background:'rgba(8,8,18,.88)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'10px', padding:'9px 13px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                        <span style={{ color:'rgba(255,255,255,.32)', fontSize:'10px' }}>Route progress</span>
                        <span style={{ color:'#10b981', fontSize:'10px', fontWeight:700 }}>{drivePercent}%</span>
                      </div>
                      <div style={{ background:'rgba(255,255,255,.07)', borderRadius:'99px', height:'5px', overflow:'hidden' }}>
                        <div style={{ width:`${drivePercent}%`, height:'100%', background:'linear-gradient(90deg,#7c3aed,#10b981)', borderRadius:'99px', transition:'width .4s' }} />
                      </div>
                    </div>
                  )}

                  {!isDriving && (
                    <div style={{ display:'flex', gap:'7px' }}>
                      <button onClick={()=>setTab('camera')} style={{ flex:1, padding:'8px', borderRadius:'9px', border:'1px solid rgba(124,58,237,.3)', background:'rgba(124,58,237,.1)', color:'#c4b5fd', cursor:'pointer', fontSize:'11px', fontWeight:600, backdropFilter:'blur(8px)' }}>📷 Camera</button>
                      <button onClick={()=>setTab('sensor')} style={{ flex:1, padding:'8px', borderRadius:'9px', border:'1px solid rgba(16,185,129,.3)', background:'rgba(16,185,129,.08)', color:'#10b981', cursor:'pointer', fontSize:'11px', fontWeight:600, backdropFilter:'blur(8px)' }}>📡 Sensor</button>
                    </div>
                  )}
                </div>
              )}

              {/* Camera viewfinder HUD (top-right, driver only) */}
              {isDriver && (
                <div style={{ position:'absolute', top:'14px', right:'14px', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
                  <div onClick={()=>setTab('camera')} style={{ width:110, height:110, borderRadius:'50%', overflow:'hidden', border:flash?'3px solid #f43f5e':detecting?'3px solid #10b981':'3px solid rgba(124,58,237,.55)', boxShadow:flash?'0 0 24px rgba(244,63,94,.85)':detecting?'0 0 20px rgba(16,185,129,.7)':'0 0 18px rgba(124,58,237,.4)', background:'#080812', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', cursor:'pointer', transition:'all .2s' }}>
                    {detecting
                      ? <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted playsInline />
                      : <div style={{ textAlign:'center', color:'rgba(255,255,255,.2)' }}><div style={{ fontSize:'28px' }}>📷</div><div style={{ fontSize:'9px', marginTop:3 }}>tap</div></div>
                    }
                    {detecting   && <div style={{ position:'absolute', bottom:'8px', left:'50%', transform:'translateX(-50%)', background:'rgba(16,185,129,.92)', color:'#fff', padding:'2px 8px', borderRadius:'99px', fontSize:'9px', fontWeight:700, whiteSpace:'nowrap' }}>● LIVE</div>}
                    {isProcessing && <div style={{ position:'absolute', top:'7px', left:'50%', transform:'translateX(-50%)', background:'rgba(245,158,11,.92)', color:'#080812', padding:'2px 7px', borderRadius:'99px', fontSize:'8px', fontWeight:700, whiteSpace:'nowrap' }}>🔍 SCAN</div>}
                  </div>
                  <button onClick={detecting?stopCamera:startCamera} style={{ padding:'5px 14px', borderRadius:'99px', border:'none', background:detecting?'rgba(239,68,68,.92)':'rgba(124,58,237,.9)', color:'#fff', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                    {detecting?`⏹ ${camCount} hits`:'▶ Camera'}
                  </button>
                  {lastHit && (
                    <div style={{ background:'rgba(8,8,18,.9)', border:`1px solid ${SEV_COLOR[lastHit.sev]}`, borderRadius:'9px', padding:'5px 11px', fontSize:'10px', color:SEV_COLOR[lastHit.sev], fontWeight:700, textAlign:'center' }}>
                      {lastHit.sev.toUpperCase()}<br /><span style={{ color:'rgba(255,255,255,.26)', fontSize:'9px' }}>{Math.round(lastHit.conf*100)}% conf</span>
                    </div>
                  )}
                </div>
              )}

              {/* Legend bar */}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:1000, background:'rgba(8,8,18,.9)', backdropFilter:'blur(10px)', padding:'8px 14px', display:'flex', gap:'14px', flexWrap:'wrap', fontSize:'11px', color:'rgba(255,255,255,.45)', borderTop:'1px solid rgba(255,255,255,.05)', alignItems:'center' }}>
                {[['#f43f5e','Severe'],['#f59e0b','Moderate'],['#10b981','Minor'],['#475569','Repaired'],['#7c3aed','Drive Route']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:c }} />{l}
                  </div>
                ))}
                {isDriver && (
                  <button onClick={()=>setTab('route')} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:'7px', border:'1px solid rgba(245,158,11,.35)', background:'rgba(245,158,11,.1)', color:'#f59e0b', cursor:'pointer', fontSize:'10px', fontWeight:700 }}>
                    🔀 Route Planner →
                  </button>
                )}
                {!isDriver && (
                  <button onClick={()=>setTab('reports')} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:'7px', border:'1px solid rgba(124,58,237,.35)', background:'rgba(124,58,237,.1)', color:'#c4b5fd', cursor:'pointer', fontSize:'10px', fontWeight:700 }}>
                    📋 Reports →
                  </button>
                )}
                <div style={{ color:'rgba(255,255,255,.18)', fontSize:'10px' }}>{potholes.length} potholes · Vizag</div>
              </div>
            </div>
          )}

          {/* ────────── CAMERA ────────── */}
          {tab==='camera' && (
            <div style={{ maxWidth:'660px', margin:'0 auto', animation:'fadeUp .3s ease' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h3 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'18px' }}>📷 Camera Detection</h3>
                  <span style={{ color:'rgba(255,255,255,.3)', fontSize:'11px' }}>YOLOv8 neural network · 1 frame/sec · confidence threshold 40%</span>
                </div>
                {detecting && <div className="pill pill-live" style={{ animation:'pulse 1.5s infinite' }}>● LIVE · {camCount} detections</div>}
              </div>

              {lastHit && (
                <div style={{ background:`${SEV_COLOR[lastHit.sev]}0d`, border:`1px solid ${SEV_COLOR[lastHit.sev]}42`, borderRadius:'16px', padding:'14px 18px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', animation:'scaleIn .3s ease' }}>
                  <div>
                    <div style={{ color:SEV_COLOR[lastHit.sev], fontWeight:700, fontSize:'14px', fontFamily:"'Syne',sans-serif" }}>POTHOLE DETECTED — {lastHit.sev.toUpperCase()}</div>
                    <div style={{ color:'rgba(255,255,255,.38)', fontSize:'12px', marginTop:'3px' }}>Confidence: {Math.round(lastHit.conf*100)}% · Count: {lastHit.count} · {lastHit.time}</div>
                    <div style={{ color:'#a78bfa', fontSize:'11px', marginTop:'3px', fontWeight:600 }}>+{lastHit.count*POINTS_PER_POTHOLE} PitStop Points 🏁</div>
                  </div>
                  <div style={{ fontSize:'36px' }}>{lastHit.sev==='severe'?'🔴':lastHit.sev==='moderate'?'🟡':'🟢'}</div>
                </div>
              )}

              <div style={{ borderRadius:'18px', overflow:'hidden', marginBottom:'12px', position:'relative', background:'#000', border:flash?'2px solid #f43f5e':detecting?'2px solid rgba(124,58,237,.6)':'2px solid rgba(255,255,255,.06)', boxShadow:flash?'0 0 30px rgba(244,63,94,.65)':detecting?'0 0 22px rgba(124,58,237,.3)':'none', transition:'all .2s', minHeight:'220px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <video ref={videoRef} style={{ width:'100%', display:detecting?'block':'none' }} muted playsInline />
                {!detecting && (
                  <div style={{ textAlign:'center', color:'rgba(255,255,255,.15)', padding:'44px' }}>
                    <div style={{ fontSize:'52px', marginBottom:'10px' }}>📷</div>
                    <div style={{ fontSize:'14px' }}>Camera feed will appear here</div>
                  </div>
                )}
                {detecting && isProcessing && (
                  <div style={{ position:'absolute', top:'12px', left:'12px', background:'rgba(245,158,11,.92)', color:'#080812', padding:'4px 11px', borderRadius:'99px', fontSize:'11px', fontWeight:700 }}>🔍 SCANNING</div>
                )}
              </div>
              <canvas ref={canvasRef} width={640} height={480} style={{ display:'none' }} />

              <div style={{ textAlign:'center', marginBottom:'12px' }}>
                <button onClick={detecting?stopCamera:startCamera} className={`btn ${detecting?'btn-danger':'btn-violet'}`} style={{ padding:'14px 44px', fontSize:'15px', borderRadius:'13px' }}>
                  {detecting?'⏹ Stop Detection':'▶ Start Detection'}
                </button>
              </div>

              <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:'12px', padding:'12px 16px', fontSize:'12px', color:'rgba(255,255,255,.35)', textAlign:'center', marginBottom:'14px' }}>
                {camStatus}
              </div>

              {/* Cross-tab navigation */}
              <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
                <button onClick={()=>setTab('map')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.45)', cursor:'pointer', fontSize:'12px', fontWeight:500 }}>← Map</button>
                <button onClick={()=>setTab('sensor')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(16,185,129,.32)', background:'rgba(16,185,129,.08)', color:'#10b981', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>Try Sensor →</button>
              </div>
            </div>
          )}

          {/* ────────── SENSOR ────────── */}
          {tab==='sensor' && (
            <div style={{ maxWidth:'540px', margin:'0 auto', animation:'fadeUp .3s ease' }}>
              <div style={{ marginBottom:'18px' }}>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'18px', marginBottom:'4px' }}>📡 Accelerometer Sensor</h3>
                <p style={{ color:'rgba(255,255,255,.3)', fontSize:'12px' }}>Detects road vibrations via device accelerometer · threshold: 15 m/s²</p>
              </div>

              {/* Big magnitude display */}
              <div style={{ background:`${magColor}0c`, border:`1px solid ${magColor}35`, borderRadius:'22px', padding:'28px', textAlign:'center', marginBottom:'14px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at center, ${magColor}07 0%, transparent 68%)`, pointerEvents:'none' }} />
                <div style={{ fontFamily:'monospace', fontSize:'70px', fontWeight:900, color:magColor, lineHeight:1, textShadow:`0 0 36px ${magColor}55` }}>{magnitude}</div>
                <div style={{ color:'rgba(255,255,255,.26)', fontSize:'12px', marginTop:'4px' }}>m/s² magnitude</div>
                <div style={{ marginTop:'12px', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'17px', color:magColor }}>{magLabel}</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'9px', marginBottom:'14px' }}>
                {[['X',xyz.x,'#f43f5e'],['Y',xyz.y,'#10b981'],['Z',xyz.z,'#7c3aed']].map(([ax,val,c])=>(
                  <div key={ax} style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${c}22`, borderRadius:'13px', padding:'14px', textAlign:'center' }}>
                    <div style={{ color:c, fontWeight:700, fontSize:'20px', fontFamily:'monospace' }}>{val}</div>
                    <div style={{ color:'rgba(255,255,255,.28)', fontSize:'11px', marginTop:2 }}>Axis {ax}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                  <span style={{ color:'rgba(255,255,255,.35)', fontSize:'12px' }}>Vibration level</span>
                  <span style={{ color:'rgba(255,255,255,.2)', fontSize:'11px' }}>danger threshold: 15 m/s²</span>
                </div>
                <div style={{ background:'rgba(255,255,255,.06)', borderRadius:'99px', height:'10px', overflow:'hidden' }}>
                  <div className="sensor-fill" style={{ width:`${Math.min(100,(magnitude/40)*100)}%`, height:'100%', background:`linear-gradient(90deg,#10b981,${magColor})`, borderRadius:'99px' }} />
                </div>
              </div>

              <button onClick={sensorOn?stopSensor:startSensor} className={`btn ${sensorOn?'btn-danger':'btn-violet'}`} style={{ width:'100%', padding:'14px', borderRadius:'13px', fontSize:'14px', marginBottom:'12px' }}>
                {sensorOn?'⏹ Stop Sensor':'▶ Start Sensor Monitoring'}
              </button>

              <div style={{ textAlign:'center', color:'#a78bfa', fontSize:'13px', marginBottom:'12px', fontWeight:600 }}>
                Potholes found this session: <strong>{sensorCount}</strong>
              </div>

              {sensorLog.length > 0 && (
                <div style={{ background:'rgba(255,255,255,.025)', borderRadius:'13px', padding:'13px', border:'1px solid rgba(255,255,255,.06)', marginBottom:'14px' }}>
                  <div style={{ color:'rgba(255,255,255,.22)', fontSize:'10.5px', marginBottom:'10px', fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase' }}>Recent Detections</div>
                  {sensorLog.map((e,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:i<sensorLog.length-1?'1px solid rgba(255,255,255,.04)':'none' }}>
                      <span style={{ color:'#a78bfa', fontSize:'12px', fontFamily:'monospace' }}>{e.time}</span>
                      <span style={{ color:SEV_COLOR[e.sev]||'#94a3b8', fontSize:'12px', fontWeight:700 }}>{e.sev?.toUpperCase()}</span>
                      <span style={{ color:'rgba(255,255,255,.26)', fontSize:'11px' }}>{e.mag} m/s²</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
                <button onClick={()=>setTab('camera')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(255,255,255,.09)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.45)', cursor:'pointer', fontSize:'12px', fontWeight:500 }}>← Camera</button>
                <button onClick={()=>setTab('route')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(245,158,11,.32)', background:'rgba(245,158,11,.08)', color:'#f59e0b', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>Plan Route →</button>
              </div>
            </div>
          )}

          {/* ────────── ROUTE ────────── */}
          {tab==='route' && (
            <div style={{ maxWidth:'660px', margin:'0 auto', animation:'fadeUp .3s ease' }}>
              <div style={{ marginBottom:'18px' }}>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'18px', marginBottom:'4px' }}>🔀 Safe Route Planner</h3>
                <p style={{ color:'rgba(255,255,255,.3)', fontSize:'12px' }}>Find the safest path by routing around detected pothole clusters</p>
              </div>

              <div style={{ background:'rgba(255,255,255,.035)', border:'1px solid rgba(255,255,255,.08)', borderRadius:'18px', padding:'20px', marginBottom:'13px' }}>
                <div style={{ color:'rgba(255,255,255,.45)', fontSize:'11px', fontWeight:700, marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.6px' }}>📍 Destination</div>
                <div style={{ position:'relative', marginBottom:'10px' }}>
                  <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);setShowDD(true);setSelDest(null);}} onFocus={()=>setShowDD(true)}
                    placeholder="🔍 Search Vizag destinations…"
                    style={{ width:'100%', padding:'12px 15px', borderRadius:'11px', border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.05)', color:'#f0f0ff', fontSize:'13px', outline:'none', fontFamily:"'DM Sans',sans-serif" }}
                    onMouseEnter={e=>e.target.style.borderColor='rgba(124,58,237,.5)'}
                    onMouseLeave={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}
                  />
                  {showDD && filtDests.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200, background:'#11112a', border:'1px solid rgba(124,58,237,.3)', borderRadius:'12px', marginTop:'4px', overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.65)' }}>
                      {filtDests.map(d=>(
                        <div key={d.label}
                          onClick={()=>{setSelDest(d);setSearchQ(d.label);setShowDD(false);setUseCustom(false);}}
                          style={{ padding:'11px 15px', cursor:'pointer', fontSize:'13px', color:'rgba(255,255,255,.78)', borderBottom:'1px solid rgba(255,255,255,.04)', transition:'background .15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(124,58,237,.18)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          {d.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', color:'rgba(255,255,255,.38)', fontSize:'12px', cursor:'pointer' }}>
                  <input type="checkbox" checked={useCustom} onChange={e=>setUseCustom(e.target.checked)} style={{ accentColor:'#7c3aed' }} /> Use custom coordinates
                </label>
                {useCustom && (
                  <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
                    <input value={customLat} onChange={e=>setCustomLat(e.target.value)} placeholder="Latitude" style={{ flex:1, padding:'10px 12px', borderRadius:'9px', border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'#f0f0ff', fontSize:'12px', outline:'none' }} />
                    <input value={customLng} onChange={e=>setCustomLng(e.target.value)} placeholder="Longitude" style={{ flex:1, padding:'10px 12px', borderRadius:'9px', border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'#f0f0ff', fontSize:'12px', outline:'none' }} />
                  </div>
                )}
                {searchErr && <div style={{ color:'#f43f5e', fontSize:'12px', marginTop:'8px' }}>{searchErr}</div>}
              </div>

              <button onClick={calcRoute} disabled={routeCalc} className="btn btn-violet" style={{ width:'100%', padding:'14px', borderRadius:'13px', fontSize:'14px', marginBottom:'16px', opacity:routeCalc?.6:1, cursor:routeCalc?'not-allowed':'pointer' }}>
                {routeCalc?'⏳ Calculating…':'🔍 Find Safest Route'}
              </button>

              {routeResult && (
                <div style={{ animation:'fadeUp .4s ease' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    {[
                      { key:'directRoute',    label:'🔴 Direct Route' },
                      { key:'alternateRoute', label:'🟢 Alternate Route' },
                    ].map(({ key, label }) => {
                      const r = routeResult[key];
                      return (
                        <div key={key} style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${r?.recommended?'rgba(16,185,129,.4)':'rgba(244,63,94,.25)'}`, borderRadius:'16px', padding:'16px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                            <span style={{ fontWeight:700, color:'#f0f0ff', fontSize:'13px' }}>{label}</span>
                            {r?.recommended && <span style={{ background:'rgba(16,185,129,.16)', border:'1px solid rgba(16,185,129,.38)', color:'#10b981', padding:'2px 9px', borderRadius:'99px', fontSize:'10px', fontWeight:700 }}>✓ BEST</span>}
                          </div>
                          <div style={{ display:'flex', gap:'18px' }}>
                            <div><div style={{ color:'rgba(255,255,255,.3)', fontSize:'10px', marginBottom:2 }}>Potholes</div><div style={{ color:'#f43f5e', fontWeight:800, fontSize:'22px', fontFamily:'monospace' }}>{r?.potholeCount}</div></div>
                            <div><div style={{ color:'rgba(255,255,255,.3)', fontSize:'10px', marginBottom:2 }}>Danger Score</div><div style={{ color:'#f59e0b', fontWeight:800, fontSize:'22px', fontFamily:'monospace' }}>{r?.dangerScore}</div></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ background:routeResult.alternateRoute?.recommended?'rgba(16,185,129,.1)':'rgba(124,58,237,.1)', border:`1px solid ${routeResult.alternateRoute?.recommended?'rgba(16,185,129,.38)':'rgba(124,58,237,.38)'}`, borderRadius:'13px', padding:'13px', textAlign:'center', color:routeResult.alternateRoute?.recommended?'#10b981':'#a78bfa', fontWeight:700, fontSize:'14px', marginBottom:'12px' }}>
                    {routeResult.alternateRoute?.recommended
                      ? '✅ Take the Alternate Route — Safer conditions ahead!'
                      : '✅ Direct Route is Safe — No major hazards detected!'}
                  </div>

                  <div style={{ borderRadius:'16px', overflow:'hidden', marginBottom:'12px', border:'1px solid rgba(255,255,255,.07)' }}>
                    <MapContainer center={[CENTER.lat,CENTER.lng]} zoom={14} style={{ height:'260px', width:'100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {potholes.map(p=><CircleMarker key={p.id} center={[p.lat,p.lng]} radius={SEV_RADIUS[p.severity]||8} pathOptions={{ color:SEV_COLOR[p.severity], fillColor:SEV_COLOR[p.severity], fillOpacity:.82, weight:2 }}><Popup>{p.severity} pothole</Popup></CircleMarker>)}
                      {routeResult.directRoute   && <Polyline positions={routeResult.directRoute.points}   pathOptions={{ color:'#f43f5e', weight:4, dashArray:'8,5' }} />}
                      {routeResult.alternateRoute && <Polyline positions={routeResult.alternateRoute.points} pathOptions={{ color:'#10b981', weight:4 }} />}
                    </MapContainer>
                  </div>

                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={()=>setTab('map')} style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(124,58,237,.32)', background:'rgba(124,58,237,.09)', color:'#c4b5fd', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>🗺️ Full Map</button>
                    <button onClick={()=>{setRouteResult(null);setShowRoute(false);}} style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.08)', background:'transparent', color:'rgba(255,255,255,.35)', cursor:'pointer', fontSize:'12px' }}>✖ Clear</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────── OVERVIEW (Authority) ────────── */}
          {tab==='overview' && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'18px', marginBottom:'3px' }}>📊 Road Condition Overview</h3>
                  <p style={{ color:'rgba(255,255,255,.3)', fontSize:'12px' }}>Visakhapatnam · Live pothole intelligence from PitStop</p>
                </div>
                <button onClick={()=>setTab('reports')} className="btn btn-violet btn-sm">View Reports →</button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:'9px', marginBottom:'18px' }}>
                {[
                  { l:'Total',       v:stats.total||0,            c:'#a78bfa', i:'🕳️' },
                  { l:'Severe',      v:stats.severe||0,           c:'#f43f5e', i:'🔴' },
                  { l:'Moderate',    v:stats.moderate||0,         c:'#f59e0b', i:'🟡' },
                  { l:'Minor',       v:stats.minor||0,            c:'#10b981', i:'🟢' },
                  { l:'Pending',     v:stats.pending||0,          c:'rgba(255,255,255,.4)', i:'⏳' },
                  { l:'Maintenance', v:stats.underMaintenance||0, c:'#38bdf8', i:'🔧' },
                  { l:'Repaired',    v:stats.repaired||0,         c:'#10b981', i:'✅' },
                  { l:'Camera',      v:stats.cameraDetected||0,   c:'#a78bfa', i:'📷' },
                  { l:'Sensor',      v:stats.sensorDetected||0,   c:'#22d3ee', i:'📡' },
                ].map(s => (
                  <div key={s.l} style={{ background:'rgba(255,255,255,.035)', border:`1px solid ${s.c}18`, borderRadius:'15px', padding:'15px', textAlign:'center', transition:'all .2s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.07)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.035)';e.currentTarget.style.transform='none';}}>
                    <div style={{ fontSize:'22px', marginBottom:'6px' }}>{s.i}</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'28px', color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:'10px', color:'rgba(255,255,255,.28)', marginTop:'3px' }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div style={{ background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', borderRadius:'18px', padding:'20px' }}>
                  <h4 style={{ color:'#f59e0b', fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:'14px', fontSize:'14px' }}>⚡ Priority Summary</h4>
                  <div style={{ fontSize:'13px', color:'rgba(255,255,255,.45)', lineHeight:2.2 }}>
                    <div>Immediate action (severe): <strong style={{ color:'#f43f5e' }}>{stats.severe||0}</strong></div>
                    <div>Scheduled (moderate): <strong style={{ color:'#f59e0b' }}>{stats.moderate||0}</strong></div>
                    <div>Monitoring (minor): <strong style={{ color:'#10b981' }}>{stats.minor||0}</strong></div>
                    <div>Pending: <strong style={{ color:'rgba(255,255,255,.5)' }}>{stats.pending||0}</strong></div>
                    <div>Completed: <strong style={{ color:'#10b981' }}>{stats.repaired||0}</strong></div>
                  </div>
                </div>
                <div style={{ background:'rgba(109,40,217,.06)', border:'1px solid rgba(109,40,217,.2)', borderRadius:'18px', padding:'20px' }}>
                  <h4 style={{ color:'#a78bfa', fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:'14px', fontSize:'14px' }}>🚀 Quick Actions</h4>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {[
                      { label:'🗺️ View City Map',  fn:()=>setTab('map'),     c:'rgba(124,58,237,.25)', b:'rgba(124,58,237,.2)' },
                      { label:'📋 Manage Reports', fn:()=>setTab('reports'), c:'rgba(91,33,182,.25)',  b:'rgba(91,33,182,.18)' },
                      { label:'⬇ Export CSV',      fn:exportCSV,             c:'rgba(16,185,129,.25)', b:'rgba(16,185,129,.12)' },
                    ].map(a=>(
                      <button key={a.label} onClick={a.fn} style={{ padding:'10px 14px', borderRadius:'10px', border:`1px solid ${a.c}`, background:a.b, color:'rgba(255,255,255,.78)', cursor:'pointer', fontSize:'12px', fontWeight:600, textAlign:'left', transition:'all .18s' }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='.8'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────── REPORTS (Authority) ────────── */}
          {tab==='reports' && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, margin:0, fontSize:'18px' }}>📋 Pothole Reports</h3>
                  <span style={{ color:'rgba(255,255,255,.3)', fontSize:'11px' }}>{filtered.length} records · Visakhapatnam</span>
                </div>
                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                  {['all','severe','moderate','minor','pending','repaired'].map(f=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 12px', borderRadius:'99px', fontSize:'11px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:500, border:filter===f?'none':'1px solid rgba(255,255,255,.08)', background:filter===f?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.04)', color:filter===f?'#fff':'rgba(255,255,255,.38)', boxShadow:filter===f?'0 2px 12px rgba(109,40,217,.35)':'none' }}>
                      {f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length===0 && (
                <div style={{ background:'rgba(255,255,255,.025)', borderRadius:'13px', padding:'34px', textAlign:'center', color:'rgba(255,255,255,.22)', fontSize:'13px', border:'1px dashed rgba(255,255,255,.07)' }}>
                  No records. Click <strong style={{ color:'#f59e0b' }}>+ Demo</strong> to load sample data.
                </div>
              )}

              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'680px' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['ID','Severity','Location','Conf','Source','Time','Status','Update'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:'rgba(255,255,255,.27)', fontWeight:700, fontSize:'10.5px', textTransform:'uppercase', letterSpacing:'.6px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p,i)=>(
                      <tr key={p.id}
                        style={{ background:i%2===0?'rgba(255,255,255,.02)':'transparent', borderBottom:'1px solid rgba(255,255,255,.035)', transition:'background .15s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(109,40,217,.09)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'rgba(255,255,255,.02)':'transparent'}>
                        <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.18)', fontFamily:'monospace', fontSize:'10px' }}>{p.id}</td>
                        <td style={{ padding:'10px 12px' }}><span style={{ color:SEV_COLOR[p.severity]||'#94a3b8', fontWeight:700, fontSize:'11px' }}>{p.severity==='severe'?'🔴':p.severity==='moderate'?'🟡':'🟢'} {p.severity}</span></td>
                        <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.38)', fontFamily:'monospace', fontSize:'10px' }}>{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</td>
                        <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.38)' }}>{Math.round((p.confidence||0)*100)}%</td>
                        <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.38)' }}>{p.source==='camera'?'📷':p.source==='sensor'?'📡':'🎮'} {p.source}</td>
                        <td style={{ padding:'10px 12px', color:'rgba(255,255,255,.38)' }}>{new Date(p.timestamp).toLocaleTimeString()}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ padding:'3px 9px', borderRadius:'99px', fontSize:'10px', fontWeight:600, background:p.repairStatus==='repaired'?'rgba(16,185,129,.14)':p.repairStatus==='under maintenance'?'rgba(245,158,11,.14)':'rgba(244,63,94,.14)', color:p.repairStatus==='repaired'?'#10b981':p.repairStatus==='under maintenance'?'#f59e0b':'#f43f5e' }}>
                            {p.repairStatus}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <select defaultValue={p.repairStatus} onChange={e=>updateStatus(p.id,e.target.value)} style={{ background:'#11112a', color:'#f0f0ff', border:'1px solid rgba(109,40,217,.3)', borderRadius:'8px', padding:'4px 8px', fontSize:'11px', cursor:'pointer', outline:'none' }}>
                            <option value="pending">Pending</option>
                            <option value="under maintenance">Maintenance</option>
                            <option value="repaired">Repaired</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop:'13px', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={()=>setTab('overview')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:'12px' }}>← Overview</button>
                <button onClick={()=>setTab('map')} style={{ padding:'8px 18px', borderRadius:'9px', border:'1px solid rgba(109,40,217,.35)', background:'rgba(109,40,217,.1)', color:'#c4b5fd', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>🗺️ View on Map</button>
              </div>
            </div>
          )}

        </div>{/* /content */}

        {/* ── PITSTOP POINTS BAR (Driver only) ── */}
        {isDriver && (
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9000, background:'rgba(8,8,18,.97)', backdropFilter:'blur(14px)', borderTop:`1px solid ${tier.color}25`, padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:`${tier.color}18`, border:`2px solid ${tier.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>{tier.label.split(' ')[0]}</div>
              <div>
                <div style={{ color:tier.color, fontWeight:700, fontSize:'11px' }}>{tier.label.split(' ').slice(1).join(' ')}</div>
                <div style={{ color:'rgba(255,255,255,.2)', fontSize:'9px' }}>PitStop Rank</div>
              </div>
            </div>
            <div style={{ flex:1, maxWidth:'200px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                <span style={{ color:'rgba(255,255,255,.22)', fontSize:'9px' }}>Progress to next rank</span>
                <span style={{ color:tier.color, fontSize:'9px', fontWeight:700 }}>{points%100}/100</span>
              </div>
              <div style={{ background:'rgba(255,255,255,.06)', borderRadius:'99px', height:'5px', overflow:'hidden' }}>
                <div style={{ width:`${Math.min(100,points%100)}%`, height:'100%', background:`linear-gradient(90deg,${tier.color}88,${tier.color})`, borderRadius:'99px', transition:'width .4s ease' }} />
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ color:pointsFlash?'#fff':tier.color, fontWeight:800, fontSize:'20px', fontFamily:'monospace', transition:'color .28s' }}>🏁 {points}</div>
              <div style={{ color:'rgba(255,255,255,.2)', fontSize:'9px' }}>PitStop Points</div>
            </div>
          </div>
        )}
        {isDriver && <div style={{ height:'56px' }} />}

      </div>
    </>
  );
}