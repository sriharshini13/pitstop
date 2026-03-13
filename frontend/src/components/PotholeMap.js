import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const severityColor = {
  severe: '#ef4444',
  moderate: '#f59e0b',
  minor: '#22c55e',
  demo: '#a855f7'
};

const severityRadius = {
  severe: 16,
  moderate: 11,
  minor: 7
};

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function RecenterMap({ location }) {
  const map = useMap();
  map.setView([location.lat, location.lng], map.getZoom());
  return null;
}

export default function PotholeMap({
  potholes,
  currentLocation,
  route,
  showRoute
}) {
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        center={[currentLocation.lat, currentLocation.lng]}
        zoom={15}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <RecenterMap location={currentLocation} />

        {/* Current driver position */}
        <Marker position={[currentLocation.lat, currentLocation.lng]}>
          <Popup>📍 Your Current Location</Popup>
        </Marker>

        {/* Pothole markers */}
        {potholes.map(p => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={severityRadius[p.severity] || 8}
            color={p.repairStatus === 'repaired' ? '#64748b' : severityColor[p.severity]}
            fillColor={p.repairStatus === 'repaired' ? '#64748b' : severityColor[p.severity]}
            fillOpacity={0.8}
            weight={2}
          >
            <Popup>
              <div style={{ minWidth: '160px' }}>
                <strong>{p.severity?.toUpperCase()} POTHOLE</strong><br />
                <span>Confidence: {p.confidence}</span><br />
                <span>Source: {p.source}</span><br />
                <span>Status: {p.repairStatus}</span><br />
                <small>{new Date(p.timestamp).toLocaleString()}</small>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Direct route - red */}
        {showRoute && route?.directRoute && (
          <Polyline
            positions={route.directRoute.points}
            color="#ef4444"
            weight={4}
            dashArray="8,4"
          />
        )}

        {/* Alternate route - green */}
        {showRoute && route?.alternateRoute && (
          <Polyline
            positions={route.alternateRoute.points}
            color="#22c55e"
            weight={4}
          />
        )}
      </MapContainer>

      {/* Map Legend */}
      <div style={{
        background: '#1e293b',
        padding: '12px 16px',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        {[
          { color: '#ef4444', label: 'Severe' },
          { color: '#f59e0b', label: 'Moderate' },
          { color: '#22c55e', label: 'Minor' },
          { color: '#64748b', label: 'Repaired' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '12px', height: '12px',
              borderRadius: '50%',
              background: item.color
            }} />
            {item.label}
          </div>
        ))}
        {showRoute && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '3px', background: '#ef4444' }} />
              Dangerous Route
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '3px', background: '#22c55e' }} />
              Safe Route
            </div>
          </>
        )}
      </div>
    </div>
  );
}