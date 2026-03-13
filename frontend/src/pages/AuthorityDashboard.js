import { useState, useEffect } from 'react';
import axios from 'axios';
import PotholeMap from '../components/PotholeMap';
import StatsPanel from '../components/StatsPanel';

const API = 'http://localhost:5000';

export default function AuthorityDashboard() {
  const [potholes, setPotholes] = useState([]);
  const [stats, setStats] = useState({});
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState('all');

  const currentLocation = { lat: 17.7231, lng: 83.3012 };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [p, s] = await Promise.all([
        axios.get(`${API}/potholes`),
        axios.get(`${API}/stats`)
      ]);
      setPotholes(p.data);
      setStats(s.data);
    } catch (e) {}
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/potholes/${id}/status`, { status });
      fetchData();
    } catch (e) {}
  };

  const resetAll = async () => {
    if (window.confirm('Reset all pothole data?')) {
      await axios.delete(`${API}/reset`);
      fetchData();
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Severity', 'Latitude', 'Longitude', 'Confidence', 'Source', 'Status', 'Timestamp'];
    const rows = potholes.map(p => [
      p.id, p.severity, p.lat, p.lng,
      p.confidence, p.source, p.repairStatus, p.timestamp
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pothole_report.csv';
    a.click();
  };

  const filteredPotholes = potholes.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'severe') return p.severity === 'severe';
    if (filter === 'moderate') return p.severity === 'moderate';
    if (filter === 'minor') return p.severity === 'minor';
    if (filter === 'pending') return p.repairStatus === 'pending';
    if (filter === 'repaired') return p.repairStatus === 'repaired';
    return true;
  });

  const severityColor = {
    severe: '#ef4444',
    moderate: '#f59e0b',
    minor: '#22c55e'
  };

  const tabs = ['overview', 'map', 'reports'];

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white' }}>

      {/* Header */}
      <div style={{
        background: '#1e293b',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
          🏛️ Authority Dashboard
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={exportCSV}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#16a34a',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📥 Export CSV
          </button>
          <button
            onClick={resetAll}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🗑️ Reset
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
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
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'transparent',
              color: tab === t ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: tab === t ? 'bold' : 'normal',
              textTransform: 'capitalize'
            }}
          >
            {t === 'overview' && '📊 '}
            {t === 'map' && '🗺️ '}
            {t === 'reports' && '📋 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '16px' }}>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'white' }}>
              Road Condition Overview
            </h3>
            <StatsPanel stats={stats} />

            {/* Quick Summary */}
            <div style={{
              background: '#1e293b',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '16px'
            }}>
              <h4 style={{ color: '#f59e0b', marginBottom: '12px' }}>
                ⚡ Quick Summary
              </h4>
              <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '2' }}>
                <div>🔴 Severe potholes needing immediate attention: <strong style={{ color: '#ef4444' }}>{stats.severe || 0}</strong></div>
                <div>🟡 Moderate potholes scheduled for repair: <strong style={{ color: '#f59e0b' }}>{stats.moderate || 0}</strong></div>
                <div>🟢 Minor road damage monitored: <strong style={{ color: '#22c55e' }}>{stats.minor || 0}</strong></div>
                <div>⏳ Total pending repairs: <strong style={{ color: '#94a3b8' }}>{stats.pending || 0}</strong></div>
                <div>✅ Successfully repaired: <strong style={{ color: '#22c55e' }}>{stats.repaired || 0}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {tab === 'map' && (
          <div>
            <h3 style={{ marginBottom: '12px', color: 'white' }}>
              City Pothole Map
            </h3>
            <PotholeMap
              potholes={potholes}
              currentLocation={currentLocation}
              route={null}
              showRoute={false}
            />
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h3 style={{ color: 'white' }}>Pothole Reports</h3>

              {/* Filter Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['all', 'severe', 'moderate', 'minor', 'pending', 'repaired'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '99px',
                      border: 'none',
                      background: filter === f ? '#3b82f6' : '#1e293b',
                      color: filter === f ? 'white' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                    {['ID', 'Severity', 'Location', 'Confidence', 'Source', 'Time', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPotholes.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{
                        padding: '30px',
                        textAlign: 'center',
                        color: '#64748b'
                      }}>
                        No potholes found. Start detection in Driver Mode first.
                      </td>
                    </tr>
                  )}
                  {filteredPotholes.map((p, i) => (
                    <tr key={p.id} style={{
                      background: i % 2 === 0 ? '#1e293b' : '#0f172a',
                      borderBottom: '1px solid #1e293b'
                    }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{p.id}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          color: severityColor[p.severity],
                          fontWeight: 'bold'
                        }}>
                          {p.severity === 'severe' && '🔴 '}
                          {p.severity === 'moderate' && '🟡 '}
                          {p.severity === 'minor' && '🟢 '}
                          {p.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {Math.round(p.confidence * 100)}%
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {p.source === 'camera' && '📷'}
                        {p.source === 'sensor' && '📡'}
                        {p.source === 'demo' && '🎮'}
                        {' '}{p.source}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {new Date(p.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '99px',
                          fontSize: '11px',
                          background: p.repairStatus === 'repaired' ? '#16a34a30' :
                                      p.repairStatus === 'under maintenance' ? '#d9770630' : '#ef444430',
                          color: p.repairStatus === 'repaired' ? '#22c55e' :
                                 p.repairStatus === 'under maintenance' ? '#f59e0b' : '#ef4444'
                        }}>
                          {p.repairStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <select
                          defaultValue={p.repairStatus}
                          onChange={e => updateStatus(p.id, e.target.value)}
                          style={{
                            background: '#0f172a',
                            color: 'white',
                            border: '1px solid #334155',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="under maintenance">Under Maintenance</option>
                          <option value="repaired">Repaired</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}