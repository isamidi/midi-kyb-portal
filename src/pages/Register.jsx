import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Building2, Mail, Lock, Loader } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    password: '',
    confirm: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirm) {
      setError('Las contrasenas no coinciden')
      return
    }
    if (form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { company_name: form.company_name }
        }
      })

      if (authErr) throw authErr

      const userId = authData.user?.id
      if (userId) {
        // Create company and related records
        const { data: company, error: compErr } = await supabase
          .from('companies').insert({ name: form.company_name }).select().single()

        if (compErr) throw compErr

        await supabase.from('company_users').insert({
          company_id: company.id,
          user_id: userId,
          role: 'admin'
        })

        await supabase.from('kyb_applications').insert({
          company_id: company.id,
          status: 'draft',
          step: 1
        })
      }

      // Redirect to email verification with OTP
      navigate('/verify-email', { state: { email: form.email } })
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

            <div className="input-group">
              <label>Contrasena</label>
              <input
                className="input-field"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimo 6 caracteres"
                required
              />
            </div>

            <div className="input-group">
              <label>Confirmar Contrasena</label>
              <input
                className="input-field"
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Repite tu contrasena"
                required
              />
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading
                ? <><Loader size={18} className="spinning" /> Creando cuenta...</>
                : 'Crear Cuenta'
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
