import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Main from './pages/Main'

function AppInner() {
  const { token } = useAuth()
  const isAuthed = token || localStorage.getItem('medagent_token')
  return isAuthed ? <Main /> : <Login />
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>
}
