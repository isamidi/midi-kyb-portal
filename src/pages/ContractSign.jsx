import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import {
  FileText, PenTool, Check, AlertCircle, Download,
  Calendar, Building2, PartyPopper, Loader, ArrowRight,
  LayoutDashboard
} from 'lucide-react'

export default function ContractSign() {
  const { user, company, setApplicationStatus } = useAuth()
  const { kybData } = useKYB()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [signed, setSigned] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [redirectCountdown, setRedirectCountdown] = useState(null)

  useEffect(() => {
    loadContract()
  }, [])

  // Auto-redirect countdown after signing
  useEffect(() => {
    if (redirectCountdown === null) return
    if (redirectCountdown <= 0) {
      navigate('/portal')
      return
    }
    const timer = setTimeout(() => setRedirectCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [redirectCountdown, navigate])

  const loadContract = async () => {
    try {
      // Check if already signed
      const { data: existing } = await supabase
        .from('signed_contracts')
        .select('*')
        .eq('company_id', company?.id)
        .single()

      if (existing) {
        setSigned(true)
        setContract(existing)
        setLoading(false)
        return
      }

      // Load application for contract display
      const { data: app } = await supabase
        .from('kyb_applications')
        .select('*')
        .eq('company_id', company?.id)
        .single()

      if (app) {
        setContract({ application: app })
      }
    } catch (err) {
      console.error('Error loading contract:', err)
    } finally {
      setLoading(false)
    }
  }

  // Canvas drawing handlers
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#26213F'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  useEffect(() => { initCanvas() }, [loading])

  const startDraw = (e) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
    setHasSig(true)
  }

  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDraw = () => setDrawing(false)

  const clearSig = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
    initCanvas()
  }

  const handleSign = async () => {
    if (!hasSig) return
    setSubmitting(true)
    setError(null)

    try {
      const sigData = canvasRef.current.toDataURL('image/png')

      // Insert signed contract
      const { error: insertErr } = await supabase
        .from('signed_contracts')
        .insert({
          company_id: company.id,
          signed_by: user.id,
          signature_data: sigData,
          signed_at: new Date().toISOString(),
        })

      if (insertErr) throw insertErr

      // Update application status to contract_signed
      await supabase
        .from('kyb_applications')
        .update({ status: 'contract_signed' })
        .eq('company_id', company.id)

      // Log status change
      await supabase
        .from('application_status_log')
        .insert({
          application_id: kybData.applicationId,
          old_status: 'approved',
          new_status: 'contract_signed',
          changed_by: user.id,
          note: 'Contract signed via portal',
        })

      // Update local state
      if (setApplicationStatus) {
        setApplicationStatus('contract_signed')
      }

      setSigned(true)
      setRedirectCountdown(10)
    } catch (err) {
      setError(err.message || 'Error al firmar contrato.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  // ===== SIGNED STATE =====
  if (signed) {
    return (
      <div className="animate-in" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(226, 232, 104, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <PartyPopper size={40} color="#5a6000" />
        </div>

        <h2 style={{ marginBottom: 8 }}>Contrato firmado!</h2>
        <p style={{ color: '#666', fontSize: '1rem', marginBottom: 32 }}>
          Tu empresa esta lista para operar con Midi. Ahora puedes acceder a tu portal
          empresarial para agregar personas, gestionar pagos y mas.
        </p>

        {/* Portal preview card */}
        <div style={{
          background: 'var(--midi-gradient-purple)',
          borderRadius: 16, padding: '28px 24px',
          color: '#fff', textAlign: 'left', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <LayoutDashboard size={22} />
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Tu Portal Empresarial</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              'Agregar contratistas y creators',
              'Pagos unicos y recurrentes',
              'Link de auto-registro',
              'Dashboard en tiempo real',
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <Check size={14} style={{ flexShrink: 0 }} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-lg btn-full"
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 12 }}
        >
          <LayoutDashboard size={20} /> Ir al Portal Empresarial
          <ArrowRight size={18} />
        </button>

        {redirectCountdown !== null && redirectCountdown > 0 && (
          <p style={{ fontSize: '0.8rem', color: '#888' }}>
            Redirigiendo automaticamente en {redirectCountdown}s...
          </p>
        )}
      </div>
    )
  }

  // ===== CONTRACT SIGNING STATE =====
  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--midi-purple-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={24} color="#825DC7" />
        </div>
        <div>
          <h2 style={{ marginBottom: 2, fontSize: '1.6rem' }}>Contrato de Servicio</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Revisa y firma el contrato para activar tu cuenta empresarial.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Contract body */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', background: 'var(--midi-cream)', borderRadius: 12, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#825DC7" />
            <span style={{ fontWeight: 600 }}>{company?.name || 'Empresa'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: '0.85rem' }}>
            <Calendar size={16} />
            {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#444' }}>
          <p style={{ marginBottom: 16 }}>
            Este Contrato de Servicios se celebra entre <strong>Midi Technologies Inc.</strong> ("Midi") y
            <strong> {company?.name || 'la Empresa'}</strong> ("el Cliente").
          </p>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>1. Servicios</p>
          <p style={{ marginBottom: 16 }}>
            Midi proporcionara al Cliente acceso a su plataforma de pagos para contratistas, creators y freelancers,
            incluyendo procesamiento de pagos, cuentas en USD y tarjetas de debito.
          </p>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>2. Obligaciones del Cliente</p>
          <p style={{ marginBottom: 16 }}>
            El Cliente se compromete a cumplir con todas las regulaciones AML/KYC aplicables y a proporcionar
            informacion veraz sobre sus operaciones y beneficiarios.
          </p>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>3. Tarifas</p>
          <p style={{ marginBottom: 16 }}>
            Las tarifas seran segun el plan seleccionado. Midi se reserva el derecho de modificar tarifas
            con 30 dias de aviso previo.
          </p>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>4. Vigencia</p>
          <p>
            Este contrato tiene una vigencia de 12 meses y se renueva automaticamente.
          </p>
        </div>
      </div>

      {/* Signature pad */}
      <div className="card">
        <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 12 }}>
          <PenTool size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Firma electronica
        </label>
        <div style={{
          border: '2px dashed #d0cbe0', borderRadius: 12, overflow: 'hidden',
          background: '#fafafa', position: 'relative',
        }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={180}
            style={{ width: '100%', height: 180, cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {!hasSig && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              color: '#bbb', fontSize: '0.85rem', pointerEvents: 'none',
            }}>
              Firma aqui
            </div>
          )}
        </div>
        {hasSig && (
          <button onClick={clearSig} style={{
            background: 'none', border: 'none', color: '#888',
            fontSize: '0.8rem', cursor: 'pointer', marginTop: 8, padding: '4px 0',
          }}>
            Limpiar firma
          </button>
        )}
      </div>

      <button
        className="btn btn-primary btn-lg btn-full mt-3"
        onClick={handleSign}
        disabled={!hasSig || submitting}
      >
        {submitting
          ? <><Loader size={20} className="spinning" /> Firmando contrato...</>
          : <><PenTool size={20} /> Firmar contrato</>
        }
      </button>
    </div>
  )
}
