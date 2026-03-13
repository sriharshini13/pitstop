import { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

export default function RoutePanel({ currentLocation, onRouteCalculated }) {
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);

  const calculateRoute = async () => {
    setCalculating(true);
    try {
      const endLat = currentLocation.lat + 0.02;
      const endLng = currentLocation.lng + 0.02;

      const res = await axios.get(`${API}/route`, {
        params: {
          start_lat: currentLocation.lat,
          start_lng: currentLocation.lng,
          end_lat: endLat,
          end_lng: endLng
        }
      });

      setResult(res.data);
      onRouteCalculated(res.data);
    } catch (e) {
      console.error(e);
    }
    setCalculating(false);
  };

  const clearRoute = () => {
    setResult(null);
    onRouteCalculated(null);
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      margin: '16px'
    }}>
      <h3 style={{ color: '#f59e0b', marginBottom: '16px' }}>
        🗺️ Alternate Route Suggestion
      </h3>

      <button
        onClick={calculateRoute}
        disabled={calculating}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background: calculating ? '#334155' : '#3b82f6',
          color: 'white',
          fontSize: '15px',
          fontWeight: 'bold',
          cursor: calculating ? 'not-allowed' : 'pointer',
          marginBottom: '12px'
        }}
      >
        {calculating ? '⏳ Calculating...' : '🔍 Find Safest Route'}
      </button>

      {result && (
        <div>
          {/* Direct Route */}
          <div style={{
            background: '#0f172a',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '10px',
            border: `1px solid ${result.directRoute.recommended ? '#22c55e' : '#ef4444'}`
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontWeight: 'bold', color: 'white' }}>
                🔴 Direct Route
              </span>
              {result.directRoute.recommended && (
                <span style={{
                  background: '#16a34a',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontSize: '11px'
                }}>
                  RECOMMENDED
                </span>
              )}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              Potholes on route: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                {result.directRoute.potholeCount}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              Danger score: <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                {result.directRoute.dangerScore}
              </span>
            </div>
          </div>

          {/* Alternate Route */}
          <div style={{
            background: '#0f172a',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '10px',
            border: `1px solid ${result.alternateRoute.recommended ? '#22c55e' : '#ef4444'}`
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontWeight: 'bold', color: 'white' }}>
                🟢 Alternate Route
              </span>
              {result.alternateRoute.recommended && (
                <span style={{
                  background: '#16a34a',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontSize: '11px'
                }}>
                  RECOMMENDED
                </span>
              )}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              Potholes on route: <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
                {result.alternateRoute.potholeCount}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              Danger score: <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                {result.alternateRoute.dangerScore}
              </span>
            </div>
          </div>

          {/* Recommendation */}
          <div style={{
            background: result.alternateRoute.recommended ? '#16a34a20' : '#1d4ed820',
            border: `1px solid ${result.alternateRoute.recommended ? '#22c55e' : '#3b82f6'}`,
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center',
            color: result.alternateRoute.recommended ? '#22c55e' : '#3b82f6',
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '10px'
          }}>
            {result.alternateRoute.recommended
              ? '✅ Take the Alternate Route — Safer road conditions!'
              : '✅ Direct Route is Safe — No major potholes detected!'}
          </div>

          <button
            onClick={clearRoute}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ✖ Clear Route
          </button>
        </div>
      )}
    </div>
  );
}