import { useState, useEffect } from 'react';

export default function WarningAlert({ warning }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (warning) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [warning]);

  if (!visible || !warning) return null;

  const bgColor = warning.severity === 'severe' ? '#dc2626' :
                  warning.severity === 'moderate' ? '#d97706' : '#16a34a';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: bgColor,
      color: 'white',
      padding: '16px 24px',
      textAlign: 'center',
      fontSize: '18px',
      fontWeight: 'bold',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      animation: 'slideDown 0.3s ease'
    }}>
      ⚠️ POTHOLE AHEAD — {warning.distance}m away — {warning.severity?.toUpperCase()} — SLOW DOWN!
    </div>
  );
}