import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const OTP_LENGTH = 8

export default function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email
  const companyName = location.state?.company_name
  const mode = location.state?.mode || 'login'

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    if (!email) navigate('/login')
  }, [email, navigate])

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\\D/g, '').slice(0, OTP_LENGTH)
    const next = [...otp]
    paste.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    const focusIdx = Math.min(paste.length, OTP_LENGTH - 1)
    inputsRef.current[focusIdx]?.focus()
  }

  const handleVerify = async () => {
    const token = otp.join('')
    if (token.length < OTP_LENGTH) { setError('Ingresa el codigo completo'); return }
    setLoading(true); setError('')
    try {
      if (mode === 'login') {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password: token,
        })
        if (signInErr) throw signInErr
      } else {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password: token,
          options: { data: { company_name: companyName } }
        })
        if (signUpErr) {
          if (signUpErr.message?.includes('already registered')) {
            const { data: fallbackData, error: fallbackErr } = await supabase.auth.signInWithPassword({
              email,
              password: token,
            })
            if (fallbackErr) throw fallbackErr
          } else {
            throw signUpErr
          }
        }
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No se pudo obtener el usuario')
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cu?.company_id) {
        const { data: app } = await supabase
          .from('kyb_applications')
          .select('status')
          .eq('company_id', cu.company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const st = app?.status
        if (st === 'contract_signed' || st === 'approved') {
          navigate('/portal')
        } else if (st) {
          navigate('/kyb', { state: { resuming: true } })
        } else {
          navigate('/kyb')
        }
      } else {
        navigate('/kyb')
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setError('Codigo incorrecto. Usa el codigo de prueba: 00000000')
      } else {
        setError(msg)
      }
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResent(true)
    setError('Modo prueba: usa el codigo 00000000')
    setTimeout(() => setResent(false), 5000)
  }

  if (!email) return null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a0533 0%, #0a0a1a 100%)' }}>
      <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center', border: '1px solid rgba(139,92,246,0.3)' }}>
        <h2 style={{ color: '#fff', marginBottom: 8 }}>Verifica tu email</h2>
        <p style={{ color: '#a0a0b0', fontSize: 14, marginBottom: 24 }}>
          Ingresa el codigo de acceso para <strong style={{ color: '#c084fc' }}>{email}</strong>
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputsRef.current[i] = el}
              type="text" inputMode="numeric" maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              style={{ width: 40, height: 48, textAlign: 'center', fontSize: 20, background: '#0f0f23', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, color: '#fff', outline: 'none' }}
            />
          ))}
        </div>
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
        <button onClick={handleVerify} disabled={loading}
          style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', marginBottom: 16, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Verificando...' : 'Verificar'}
        </button>
        <button onClick={handleResend} disabled={resent}
          style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
          {resent ? 'Codigo: 00000000' : 'Reenviar codigo'}
        </button>
      </div>
    </div>
  )
}
