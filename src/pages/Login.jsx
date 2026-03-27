import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr
      navigate('/kyb/form')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="text-center mb-4">
          <h2 style={{ color: '#825DC7' }}>Midi</h2>
          <p className="text-muted mt-1">Inicia sesión para continuar tu aplicación KYB</p>
        </div>
        <div className="card">
          {error && <div className="alert alert-error mb-3">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input className="input-field" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input className="input-field" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" required />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? <><div className="spinner" /> Ingresando...</> : 'Iniciar Sesión'}
            </button>
          </form>
          <p className="text-center text-muted mt-3" style={{ fontSize: '0.9rem' }}>
            ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
