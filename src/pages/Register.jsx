import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Building2, Mail, Loader } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    company_name: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Test mode: skip OTP send, go directly to verify page
      navigate('/verify-email', {
        state: {
          email: form.email,
          company_name: form.company_name,
          mode: 'register'
        }
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div className="text-center mb-4">
          <h2 style={{ color: '#825DC7' }}>Midi</h2>
          <p className="text-muted mt-1">Crea tu cuenta para iniciar el proceso KYB</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error mb-3">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Nombre de la Empresa</label>
              <input
                className="input-field"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                placeholder="Ej: Acme Corp LLC"
                required
              />
            </div>

            <div className="input-group">
              <label>Email Corporativo</label>
              <input
                className="input-field"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
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
                : 'Continuar'
              }
            </button>
          </form>

          <p className="text-center text-muted mt-3" style={{ fontSize: '0.9rem' }}>
            Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
