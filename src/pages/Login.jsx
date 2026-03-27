import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mail, Loader } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        }
      })
      if (otpErr) throw otpErr

      navigate('/verify-email', {
        state: {
          email,
          mode: 'login'
        }
      })
    } catch (err) {
      if (err.message?.includes('Signups not allowed')) {
        setError('No existe una cuenta con este email. Registrate primero.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="text-center mb-4">
          <h2 style={{ color: '#825DC7' }}>Midi</h2>
          <p className="text-muted mt-1">Inicia sesion para continuar tu aplicacion KYB</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error mb-3">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
              />
            </div>

            <p style={{ fontSize: '0.8rem', color: '#9a92a8', marginBottom: 16, textAlign: 'center' }}>
              Te enviaremos un codigo de verificacion a tu email
            </p>

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading
                ? <><Loader size={18} className="spinning" /> Enviando codigo...</>
                : 'Iniciar Sesion'
              }
            </button>
          </form>

          <p className="text-center text-muted mt-3" style={{ fontSize: '0.9rem' }}>
            No tienes cuenta? <Link to="/register">Registrate aqui</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
