import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import PotholeMap from '../components/PotholeMap';
import SensorPanel from '../components/SensorPanel';
import WarningAlert from '../components/WarningAlert';
import RoutePanel from '../components/RoutePanel';

const API = 'http://localhost:5000';

export default function DriverApp() {
  const [potholes, setPotholes] = useState([]);
  const [warning, setWarning] = useState(null);
  const [tab, setTab] = useState('map');
  const [detecting, setDetecting] = useState(false);
  const [route, setRoute] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('idle');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectingRef = useRef(false);

  const currentLocation = { lat: 17.7231, lng: 83.3012 };

  useEffect(() => {
    fetchPotholes();
    const interval = setInterval(() => {
      fetchPotholes();
      checkWarnings();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchPotholes = async () => {
    try {
      const res = await axios.get(`${API}/potholes`);
      setPotholes(res.data);
    } catch (e) {}
  };

  const checkWarnings = async () => {
    try {
      const res = await axios.get(`${API}/warning`, {
        params: { lat: currentLocation.lat, lng: currentLocation.lng }
      });
      if (res.data.hasWarning) {
        setWarning(res.data.nearest);
      }
    } catch (e) {}
  };

  const startCameraDetection = async () => {
    setDetecting(true);
    detectingRef.current = true;
    setDetectionStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setDetectionStatus('detecting');
      runDetectionLoop();
    } catch (e) {
      setDetectionStatus('demo');
      runDemoMode();
    }
  };

  const stopCameraDetection = () => {
    setDetecting(false);
    detectingRef.current = false;
    setDetectionStatus('idle');
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  const runDetectionLoop = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    const capture = async () => {
      if (!detectingRef.current) return;
      ctx.drawImage(video, 0, 0, 640, 480);
      const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      const lat = currentLocation.lat + (Math.random() - 0.5) * 0.01;
      const lng = currentLocation.lng + (Math.random() - 0.5) * 0.01;
      try {
        const res = await axios.post(`${API}/detect`, { image: imageData, lat, lng });
        if (res.data.detected) {
          setWarning({
            severity: res.data.detections[0]?.confidence > 0.75 ? 'severe' : 'moderate',
            distance: Math.floor(Math.random() * 150 + 50)
          });
          fetchPotholes();
        }
      } catch (e) {}
      setTimeout(capture, 2500);
    };
    capture();
  };

  const runDemoMode = async () => {
    try {
      await axios.post(`${API}/add_demo`);
      setWarning({ severity: 'severe', distance: 120 });
      fetchPotholes();
    } catch (e) {}
  };

  const handleSensorPothole = (data) => {
    setWarning(data);
    fetchPotholes();
  };

  const handleRouteCalculated = (routeData) => {
    setRoute(routeData);
    setShowRoute(routeData !== null);
  };

  const getStatusMessage = () => {
    if (detectionStatus === 'idle') return 'Click Start Detection to begin';
    if (detectionStatus === 'starting') return 'Starting camera...';
    if (detectionStatus === 'detecting') return 'Analyzing road for potholes...';
    if (detectionStatus === 'demo') return 'Running in Demo Mode - potholes simulated';
    return '';
  };

  const tabs = ['map', 'camera', 'sensor', 'route'];

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white' }}>

      <WarningAlert warning={warning} />

      <div style={{
        background: '#1e293b',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
          Driver Mode
        </div>
        <div style={{
          fontSize: '12px',
          color: '#22c55e',
          background: '#16a34a20',
          padding: '4px 10px',
          borderRadius: '99px',
          border: '1px solid #22c55e'
        }}>
          LIVE
        </div>
      </div>

      <div style={{
        display: 'flex',
        background: '#1e293b',
        borderBottom: '1px solid #334155'
      }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent',
              background: 'transparent',
              color: tab === t ? '#f59e0b' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: tab === t ? 'bold' : 'normal',
              textTransform: 'capitalize'
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>

        {tab === 'map' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h3 style={{ color: 'white' }}>Live Pothole Map</h3>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                {potholes.length} potholes detected
              </span>
            </div>
            <PotholeMap
              potholes={potholes}
              currentLocation={currentLocation}
              route={route}
              showRoute={showRoute}
            />
          </div>
        )}

        {tab === 'camera' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '16px', color: 'white' }}>Camera Detection</h3>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxWidth: '600px',
                borderRadius: '12px',
                background: '#1e293b',
                minHeight: '220px'
              }}
              muted
            />
            <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={detecting ? stopCameraDetection : startCameraDetection}
                style={{
                  padding: '12px 32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: detecting ? '#ef4444' : '#3b82f6',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {detecting ? 'Stop Detection' : 'Start Detection'}
              </button>
            </div>
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: '#1e293b',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#94a3b8'
            }}>
              {getStatusMessage()}
            </div>
          </div>
        )}

        {tab === 'sensor' && (
          <SensorPanel
            onPotholeDetected={handleSensorPothole}
            currentLocation={currentLocation}
          />
        )}

        {tab === 'route' && (
          <div>
            <RoutePanel
              currentLocation={currentLocation}
              onRouteCalculated={handleRouteCalculated}
            />
            {showRoute && (
              <div style={{ marginTop: '16px' }}>
                <PotholeMap
                  potholes={potholes}
                  currentLocation={currentLocation}
                  route={route}
                  showRoute={showRoute}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}