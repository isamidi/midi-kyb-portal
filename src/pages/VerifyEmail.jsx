import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mail, ShieldCheck, Loader, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'

const OTP_LENGTH = 8

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const companyName = location.state?.company_name || ''
  const mode = location.state?.mode || 'register'

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef([])

  useEffect(() => {
    if (!email) {
      navigate('/register')
      return
    }
    inputRefs.current[0]?.focus()
  }, [email, navigate])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === 0) return
    const newOtp = [...otp]
    for (let i = 0; i < OTP_LENGTH; i++) {
      newOtp[i] = pasted[i] || ''
    }
    setOtp(newOtp)
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()
  }

  const handleVerify = async () => {
    const token = otp.join('')
    if (token.length !== OTP_LENGTH) {
      setError('Ingresa el codigo completo de ' + OTP_LENGTH + ' digitos')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })
      if (verifyErr) throw verifyErr

      const userId = verifyData.user?.id

      if (mode === 'register' && companyName && userId) {
        const { data: existingLink } = await supabase
          .from('company_users')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!existingLink) {
          const { data: company, error: compErr } = await supabase
            .from('companies')
            .insert({ name: companyName })
            .select()
            .single()
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

        navigate('/kyb/upload')
      } else {
        navigate('/kyb/upload')
      }
    } catch (err) {
      setError(
        err.message === 'Token has expired or is invalid'
          ? 'Codigo invalido o expirado. Intenta de nuevo.'
          : err.message
      )
      setOtp(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setResending(true)
    setError(null)
    setResent(false)

    try {
      const { error: resendErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: mode === 'register' }
      })
      if (resendErr) throw resendErr

      setResent(true)
      setCountdown(60)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    if (otp.every(d => d !== '') && otp.join('').length === OTP_LENGTH) {
      handleVerify()
    }
  }, [otp])

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div className="text-center mb-4">
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(130, 93, 199, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Mail size={28} color="#825DC7" />
          </div>
          <h2 style={{ color: '#825DC7', marginBottom: 8 }}>Verifica tu email</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Enviamos un codigo de {OTP_LENGTH} digitos a
          </p>
          <p style={{ fontWeight: 600, color: '#26213F', fontSize: '0.95rem' }}>
            {email}
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="alert alert-error mb-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {resent && (
            <div className="alert" style={{
              background: 'rgba(226, 232, 104, 0.15)',
              border: '1px solid rgba(226, 232, 104, 0.4)',
              borderRadius: 10, padding: '10px 14px',
              fontSize: '0.85rem', color: '#5a6000',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <ShieldCheck size={16} /> Codigo reenviado exitosamente
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                style={{
                  width: 42, height: 52, textAlign: 'center',
                  fontSize: '1.3rem', fontWeight: 700, color: '#825DC7',
                  border: digit ? '2px solid #825DC7' : '2px solid #e0dce8',
                  borderRadius: 10, outline: 'none', transition: 'all 0.15s',
                  background: digit ? 'rgba(130, 93, 199, 0.04)' : '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={e => e.target.style.borderColor = '#825DC7'}
                onBlur={e => { if (!digit) e.target.style.borderColor = '#e0dce8' }}
              />
            ))}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleVerify}
            disabled={loading || otp.join('').length !== OTP_LENGTH}
          >
            {loading
              ? <><Loader size={18} className="spinning" /> Verificando...</>
              : <><ShieldCheck size={18} /> Verificar codigo</>
            }
          </button>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
              No recibiste el codigo?
            </p>
            <button
              onClick={handleResend}
              disabled={resending || countdown > 0}
              style={{
                background: 'none', border: 'none',
                color: countdown > 0 ? '#bbb' : '#825DC7',
                fontWeight: 600, fontSize: '0.85rem',
                cursor: countdown > 0 ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <RefreshCw size={14} />
              {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar codigo'}
            </button>
          </div>
        </div>

        <p className="text-center text-muted mt-3" style={{ fontSize: '0.85rem' }}>
          <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> Volver al registro
          </Link>
        </p>
      </div>
    </div>
  )
}
