import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import MemberProfile from './pages/MemberProfile.jsx'
import Waiting from './pages/Waiting.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import MemberRadio from './pages/MemberRadio.jsx'
import { clearAuth } from './auth.js'


export default function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('scout-user')
    return saved ? JSON.parse(saved) : null
  })

  function saveUser(u) {
    sessionStorage.setItem('scout-user', JSON.stringify(u))
    setUser(u)
  }

  function handleLogout() {
    clearAuth()
    setUser(null)
  }

  if (!user) return <Login onLogin={saveUser} />

  if (user.role === 'admin') {
    return <AdminPanel user="Admin" onLogout={handleLogout} />
  }

  return (
    <Routes>
      <Route path="/profile" element={<MemberProfile user={user} onComplete={saveUser} />} />
      <Route path="/waiting" element={<Waiting user={user} />} />
      <Route path="/radio" element={<MemberRadio user={user} onLogout={handleLogout} />} />
      <Route path="*" element={<Navigate to={user.profileComplete ? '/waiting' : '/profile'} replace />} />
    </Routes>
  )
}
