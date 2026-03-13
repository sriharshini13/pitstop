export default function StatsPanel({ stats }) {
  const cards = [
    { label: 'Total Potholes', value: stats.total || 0, color: '#f59e0b', icon: '🕳️' },
    { label: 'Severe', value: stats.severe || 0, color: '#ef4444', icon: '🔴' },
    { label: 'Moderate', value: stats.moderate || 0, color: '#f59e0b', icon: '🟡' },
    { label: 'Minor', value: stats.minor || 0, color: '#22c55e', icon: '🟢' },
    { label: 'Pending Repair', value: stats.pending || 0, color: '#94a3b8', icon: '⏳' },
    { label: 'Under Maintenance', value: stats.underMaintenance || 0, color: '#3b82f6', icon: '🔧' },
    { label: 'Repaired', value: stats.repaired || 0, color: '#22c55e', icon: '✅' },
    { label: 'Camera Detected', value: stats.cameraDetected || 0, color: '#a855f7', icon: '📷' },
    { label: 'Sensor Detected', value: stats.sensorDetected || 0, color: '#06b6d4', icon: '📡' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      padding: '16px'
    }}>
      {cards.map(card => (
        <div key={card.label} style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
          border: `1px solid ${card.color}33`
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{card.icon}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: card.color }}>
            {card.value}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}