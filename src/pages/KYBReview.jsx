import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Edit2, Send } from 'lucide-react'

export default function KYBReview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { kybData, setKybData } = useKYB()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const formData = kybData?.form_data || {}
  const uploadedDocs = kybData?.uploaded_docs || {}

  const sections = [
    { title: 'Información de la Empresa', fields: [
      { label: 'Nombre Legal', value: formData.entity_name },
      { label: 'Tipo de Empresa', value: formData.type_of_company },
      { label: 'País de Registro', value: formData.country_of_registration },
      { label: 'Número de Registro', value: formData.registration_number },
      { label: 'TIN/EIN', value: formData.tin_ein },
      { label: 'Dirección', value: formData.entity_address },
      { label: 'Industria', value: formData.industry },
      { label: 'Sitio Web', value: formData.website },
    ]},
    { title: 'Persona de Contacto', fields: [
      { label: 'Nombre', value: formData.contact_name },
      { label: 'Email', value: formData.contact_email },
      { label: 'Teléfono', value: formData.contact_phone },
      { label: 'Cargo', value: formData.contact_title },
    ]},
    { title: 'Información Bancaria', fields: [
      { label: 'Banco', value: formData.bank_name },
      { label: 'Número de Cuenta', value: formData.account_number ? '****' + formData.account_number.slice(-4) : '' },
      { label: 'Routing Number', value: formData.routing_number },
    ]},
  ]

  const docCount = Object.keys(uploadedDocs).length
  const isComplete = formData.entity_name && formData.tin_ein && docCount >= 3

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const { error: updateErr } = await supabase
        .from('kyb_applications')
        .update({ status: 'submitted', step: 5, submitted_at: new Date().toISOString() })
        .eq('id', kybData.id)
      if (updateErr) throw updateErr
      setKybData({ ...kybData, status: 'submitted', step: 5 })
      navigate('/kyb/status')
    } catch (err) {
      setError(err.message)
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Revisa tu Aplicación</h2>
      <p className="text-muted" style={{ marginBottom: 32 }}>Verifica que toda la información sea correcta antes de enviar.</p>

      {sections.map((section, i) => (
        <div key={i} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{section.title}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/kyb/form')}>
              <Edit2 size={14} /> Editar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {section.fields.map((field, j) => (
              <div key={j}>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>{field.label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                  {field.value || <span style={{ color: '#ccc' }}>No proporcionado</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.1rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginBottom: 16 }}>Documentos Subidos</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docCount > 0 ? Object.entries(uploadedDocs).map(([docId, info]) => (
            <div key={docId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="#5a6000" />
              <span style={{ fontSize: '0.9rem' }}>{info.name || docId}</span>
            </div>
          )) : <p className="text-muted">No se han subido documentos aún.</p>}
        </div>
      </div>

      {error && <div className="alert alert-error mb-3">{error}</div>}

      {!isComplete && (
        <div className="alert alert-info mb-3">
          <AlertCircle size={18} /> Completa toda la información requerida antes de enviar.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/kyb/upload')}>
          <ArrowLeft size={18} /> Volver
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!isComplete || submitting}>
          {submitting ? <><div className="spinner" /> Enviando...</> : <><Send size={18} /> Enviar Aplicación</>}
        </button>
      </div>
    </div>
  )
}
