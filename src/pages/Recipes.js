import React from 'react'

export default function Recipes({ session }) {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Recipe Ledger</h1>
        <p style={s.subtitle}>Family recipe library</p>
      </div>
      <div style={s.placeholder}>
        <div style={s.icon}>🍽</div>
        <p style={s.placeholderText}>Recipes coming soon.</p>
        <p style={s.placeholderSub}>R001 Thai Chicken and Coconut Soup will be the first entry.</p>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '24px', maxWidth: '960px', margin: '0 auto' },
  header: { marginBottom: '32px' },
  title: { fontSize: '28px', fontWeight: '600', color: '#1A252F' },
  subtitle: { fontSize: '14px', color: '#64748B', marginTop: '4px' },
  placeholder: {
    background: '#FFFFFF', border: '0.5px solid #CBD5E1', borderRadius: '16px',
    padding: '64px 24px', textAlign: 'center'
  },
  icon: { fontSize: '40px', marginBottom: '16px' },
  placeholderText: { fontSize: '18px', fontWeight: '500', color: '#1A252F', marginBottom: '8px' },
  placeholderSub: { fontSize: '14px', color: '#64748B' }
}
