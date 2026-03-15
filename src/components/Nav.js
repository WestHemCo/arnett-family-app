import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Nav({ session }) {
  const navigate  = useNavigate()
  const location  = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const links = [
    { label: 'Inventory', path: '/inventory' },
    { label: 'Recipes',   path: '/recipes'   },
  ]

  return (
    <nav style={s.nav}>
      <div style={s.inner}>
        <div style={s.brand}>
          <div style={s.logo}>AF</div>
          <span style={s.brandName}>Arnett Family</span>
        </div>

        <div style={s.links}>
          {links.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                ...s.link,
                ...(location.pathname === link.path ? s.linkActive : {})
              }}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div style={s.right}>
          <span style={s.email}>{session.user.email}</span>
          <button onClick={handleSignOut} style={s.signOut}>Sign out</button>
        </div>
      </div>
    </nav>
  )
}

const s = {
  nav: {
    background: '#1A252F', borderBottom: '1px solid #0F1E2A',
    position: 'sticky', top: 0, zIndex: 100
  },
  inner: {
    maxWidth: '960px', margin: '0 auto', padding: '0 24px',
    display: 'flex', alignItems: 'center', height: '56px', gap: '24px'
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginRight: '8px' },
  logo: {
    width: '32px', height: '32px', borderRadius: '8px', background: '#2563EB',
    color: '#FFFFFF', fontSize: '12px', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.05em'
  },
  brandName: { color: '#FFFFFF', fontSize: '15px', fontWeight: '600' },
  links: { display: 'flex', gap: '4px', flex: 1 },
  link: {
    background: 'transparent', border: 'none', color: '#94A3B8',
    fontSize: '14px', fontWeight: '500', padding: '6px 12px',
    borderRadius: '6px', transition: 'all 0.15s'
  },
  linkActive: { background: '#0F3460', color: '#FFFFFF' },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  email: { color: '#64748B', fontSize: '13px' },
  signOut: {
    background: 'transparent', border: '1px solid #334155', color: '#94A3B8',
    fontSize: '13px', padding: '5px 10px', borderRadius: '6px'
  }
}
