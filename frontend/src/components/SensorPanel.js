import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

export default function SensorPanel({ onPotholeDetected, currentLocation }) {
  const [isActive, setIsActive] = useState(false);
  const [magnitude, setMagnitude] = useState(0);
  const [sensorData, setSensorData] = useState({ x: 0, y: 0, z: 9.8 });
  const [detectionCount, setDetectionCount] = useState(0);
  const [log, setLog] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startSensor = () => {
    setIsActive(true);

    // Try real device accelerometer first
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleRealMotion);
    }

    // Simulate sensor data for demo
    intervalRef.current = setInterval(() => {
      simulateSensorReading();
    }, 1000);
  };

  const stopSensor = () => {
    setIsActive(false);
    window.removeEventListener('devicemotion', handleRealMotion);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleRealMotion = (event) => {
    const { x, y, z } = event.accelerationIncludingGravity;
    processSensorData(x || 0, y || 0, z || 9.8);
  };

  const simulateSensorReading = () => {
    // Normal road: small random values
    // Pothole: occasionally spike to high values
    const isPothole = Math.random() < 0.15; // 15% chance of pothole

    const x = isPothole ? (Math.random() * 20 + 15) : (Math.random() * 4 - 2);
    const y = isPothole ? (Math.random() * 20 + 15) : (Math.random() * 4 - 2);
    const z = isPothole ? (Math.random() * 15 + 20) : (9.8 + Math.random() * 2 - 1);

    processSensorData(x, y, z);
  };

  const processSensorData = async (x, y, z) => {
    const mag = Math.sqrt(x * x + y * y + z * z);
    setMagnitude(parseFloat(mag.toFixed(2)));
    setSensorData({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)), z: parseFloat(z.toFixed(2)) });

    try {
      const res = await axios.post(`${API}/sensor`, {
        x, y, z,
        lat: currentLocation.lat + (Math.random() - 0.5) * 0.005,
        lng: currentLocation.lng + (Math.random() - 0.5) * 0.005
      });

      if (res.data.detected) {
        setDetectionCount(prev => prev + 1);
        const newLog = {
          time: new Date().toLocaleTimeString(),
          magnitude: res.data.magnitude,
          message: '🚨 Pothole detected via sensor!'
        };
        setLog(prev => [newLog, ...prev].slice(0, 5));
        onPotholeDetected({
          severity: mag > 25 ? 'severe' : mag > 18 ? 'moderate' : 'minor',
          distance: Math.floor(Math.random() * 100 + 10)
        });
      }
    } catch (e) {}
  };

  const getMagnitudeColor = () => {
    if (magnitude > 25) return '#ef4444';
    if (magnitude > 15) return '#f59e0b';
    return '#22c55e';
  };

  const getMagnitudeLabel = () => {
    if (magnitude > 25) return 'POTHOLE DETECTED!';
    if (magnitude > 15) return 'ROUGH ROAD';
    return 'SMOOTH ROAD';
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      margin: '16px'
    }}>
      <h3 style={{ color: '#f59e0b', marginBottom: '16px' }}>
        📡 Accelerometer Sensor
      </h3>

      {/* Magnitude Display */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        background: '#0f172a',
        borderRadius: '12px',
        marginBottom: '16px',
        border: `2px solid ${getMagnitudeColor()}`
      }}>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: getMagnitudeColor() }}>
          {magnitude}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>m/s² magnitude</div>
        <div style={{
          marginTop: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: getMagnitudeColor()
        }}>
          {getMagnitudeLabel()}
        </div>
      </div>

      {/* Sensor Values */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { axis: 'X', value: sensorData.x, color: '#ef4444' },
          { axis: 'Y', value: sensorData.y, color: '#22c55e' },
          { axis: 'Z', value: sensorData.z, color: '#3b82f6' }
        ].map(s => (
          <div key={s.axis} style={{
            background: '#0f172a',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: s.color, fontWeight: 'bold', fontSize: '18px' }}>
              {s.value}
            </div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>Axis {s.axis}</div>
          </div>
        ))}
      </div>

      {/* Magnitude Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
          Vibration Level (threshold: 15 m/s²)
        </div>
        <div style={{ background: '#0f172a', borderRadius: '99px', height: '12px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (magnitude / 40) * 100)}%`,
            height: '100%',
            background: getMagnitudeColor(),
            borderRadius: '99px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Start Stop Button */}
      <button
        onClick={isActive ? stopSensor : startSensor}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background: isActive ? '#ef4444' : '#3b82f6',
          color: 'white',
          fontSize: '15px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '16px'
        }}
      >
        {isActive ? '⏹ Stop Sensor' : '▶ Start Sensor Monitoring'}
      </button>

      {/* Detection Count */}
      <div style={{
        textAlign: 'center',
        color: '#f59e0b',
        fontSize: '13px',
        marginBottom: '12px'
      }}>
        Potholes detected by sensor: <strong>{detectionCount}</strong>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '8px' }}>
            Recent Detections:
          </div>
          {log.map((entry, i) => (
            <div key={i} style={{
              background: '#0f172a',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '4px',
              fontSize: '12px',
              color: '#94a3b8'
            }}>
              <span style={{ color: '#f59e0b' }}>{entry.time}</span> — {entry.message} (mag: {entry.magnitude})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}