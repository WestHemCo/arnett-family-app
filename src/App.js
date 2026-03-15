import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Inventory from './pages/Inventory'
import Recipes from './pages/Recipes'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={styles.loading}>
      <div style={styles.loadingText}>Arnett Family App</div>
    </div>
  )

  return (
    <BrowserRouter>
      {session && <Nav session={session} />}
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/inventory" />} />
        <Route path="/inventory" element={session ? <Inventory session={session} /> : <Navigate to="/login" />} />
        <Route path="/recipes" element={session ? <Recipes session={session} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={session ? "/inventory" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

const styles = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#1A252F'
  },
  loadingText: {
    color: '#FFFFFF', fontSize: '24px', fontFamily: 'system-ui, sans-serif',
    fontWeight: '600', letterSpacing: '0.05em'
  }
}
