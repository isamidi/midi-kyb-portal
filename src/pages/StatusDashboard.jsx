import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import {
  Clock, CheckCircle, AlertCircle, FileSearch, Building2,
  PartyPopper, Upload, ArrowRight, RefreshCw, FileText, X, Send
} from 'lucide-react'

const STATUS_CONFIG = {
  submitted: {
    label: 'Aplicación Enviada',
    description: 'Tu aplicación ha sido recibida. Nuestro equipo la revisará pronto.',
    icon: Clock,
    color: '#825DC7',
    bg: 'rgba(130, 93, 199, 0.08)',
    step: 1,
  },
  midi_review: {
    label: 'En Revisión por Midi',
    description: 'Nuestro equipo de compliance está revisando tu documentación.',
    icon: FileSearch,
    color: '#825DC7',
    bg: 'rgba(130, 93, 199, 0.08)',
    step: 2,
  },
  documents_missing: {
    label: 'Documentos Faltantes',
    description: 'Necesitamos documentos adicionales para continuar con tu verificación.',
    icon: AlertCircle,
    color: '#e74c3c',
    bg: 'rgba(231, 76, 60, 0.06)',
    step: 2,
  },
  bank_review: {
    label: 'En Aprobación del Banco',
    description: 'Tu documentación fue aprobada por Midi. Ahora está en revisión por Banco San Juan Internacional.',
    icon: Building2,
    color: '#F5812B',
    bg: 'rgba(245, 129, 43, 0.08)',
    step: 3,
  },
  approved: {
    label: 'Aprobado',
    description: 'Tu empresa ha sido aprobada. Firma el contrato para empezar.',
    icon: PartyPopper,
    color: '#5a6000',
    bg: 'rgba(226, 232, 104, 0.2)',
    step: 4,
  },
  rejected: {
    label: 'No Aprobado',
    description: 'Lamentablemente tu aplicación no fue aprobada en este momento. Contáctanos para más detalles.',
    icon: AlertCircle,
    color: '#e74c3c',
    bg: 'rgba(231, 76, 60, 0.06)',
    step: 0,
  },
}

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Enviada', icon: CheckCircle },
  { key: 'midi_review', label: 'Revisión Midi', icon: FileSearch },
  { key: 'bank_review', label: 'Aprobación Banco', icon: Building2 },
  { key: 'approved', label: 'Aprobado', icon: PartyPopper },
]

export default function StatusDashboard() {
  const { user } = useAuth()
  const { kybData, companyId } = useKYB()
  const navigate = useNavigate()
  const [application, setApplication] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [loading, setLoading] = useState(true)

  // Document re-upload state
  const [missingDocs, setMissingDocs] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRefs = useRef({})

  const fetchApplication = async () => {
    setLoading(true)
    try {
      const { data: app } = await supabase
        .from('kyb_applications')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (app) {
        setApplication(app)

        const { data: logs } = await supabase
          .from('application_status_log')
          .select('*')
          .eq('application_id', app.id)
          .order('created_at', { ascending: false })

        setStatusLogs(logs || [])

        // Parse missing documents
        if (app.status === 'documents_missing' && app.missing_documents) {
          const docs = Array.isArray(app.missing_documents)
            ? app.missing_documents
            : []
          setMissingDocs(docs)
          setUploadedFiles({})
          setUploadSuccess(false)
        }
      }
    } catch (err) {
      console.error('Error fetching application:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    fetchApplication()

    // Real-time subscription
    const channel = supabase
      .channel('kyb-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kyb_applications',
        filter: `company_id=eq.${companyId}`,
      }, () => {
        fetchApplication()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [companyId])

  // File handling for missing docs
  const handleFileSelect = (docIndex, fileList) => {
    if (!fileList || fileList.length === 0) return
    const file = fileList[0]
    const maxSize = 10 * 1024 * 1024
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

    if (file.size > maxSize) {
      setUploadError(`${file.name} es demasiado grande. Máximo 10MB.`)
      return
    }
    if (!allowed.includes(file.type)) {
      setUploadError('Solo se aceptan PDF, JPG, PNG o WebP')
      return
    }
    setUploadError('')
    setUploadedFiles(prev => ({ ...prev, [docIndex]: file }))
  }

  const removeFile = (docIndex) => {
    setUploadedFiles(prev => {
      const next = { ...prev }
      delete next[docIndex]
      return next
    })
  }

  const handleSubmitDocs = async () => {
    const fileCount = Object.keys(uploadedFiles).length
    if (fileCount === 0) {
      setUploadError('Sube al menos un documento para continuar')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      // Upload files to Supabase Storage
      const uploaded = []
      for (const [docIndex, file] of Object.entries(uploadedFiles)) {
        const ext = file.name.split('.').pop()
        const filePath = `${companyId}/additional_${docIndex}_${Date.now()}.${ext}`

        const { data, error: upErr } = await supabase.storage
          .from('kyb-documents')
          .upload(filePath, file)

        if (upErr) throw upErr

        uploaded.push({
          document_type: `additional_${docIndex}`,
          file_path: data.path,
          file_name: file.name,
          file_size: file.size,
          requested_doc: missingDocs[docIndex]?.label || missingDocs[docIndex] || `Document ${docIndex}`,
        })
      }

      // Update application: append new docs, change status back to midi_review
      const existingDocs = application.documents || []
      const { error: updateErr } = await supabase
        .from('kyb_applications')
        .update({
          status: 'midi_review',
          documents: [...existingDocs, ...uploaded],
          missing_documents: [],
        })
        .eq('id', application.id)

      if (updateErr) throw updateErr

      // Log the status change
      await supabase.from('application_status_log').insert({
        application_id: application.id,
        status: 'midi_review',
        message: `Documentos adicionales enviados (${uploaded.length}). Vuelve a revisión.`,
      })

      setUploadSuccess(true)
      setUploadedFiles({})

      // Refresh
      setTimeout(() => fetchApplication(), 1000)
    } catch (err) {
      setUploadError(err.message || 'Error subiendo documentos.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-center" style={{ minHeight: 300 }}>
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  const status = application?.status || kybData.status || 'submitted'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.submitted
  const StatusIcon = config.icon
  const currentStep = config.step

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>
            Estado de tu <span className="text-purple">aplicación</span>
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Seguimiento en tiempo real de tu proceso de verificación
          </p>
        </div>
        <button onClick={fetchApplication} className="btn btn-sm btn-secondary">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Current Status Card */}
      <div className="card" style={{
        padding: '32px',
        border: `2px solid ${config.color}20`,
        background: config.bg,
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: `${config.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <StatusIcon size={26} color={config.color} />
          </div>
          <div>
            <h3 style={{
              fontSize: '1.3rem',
              fontFamily: "'Cormorant Garamond', serif",
              color: config.color,
              marginBottom: 6,
            }}>
              {config.label}
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.5 }}>
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {status !== 'rejected' && (
        <div className="card" style={{ padding: '28px 32px', marginBottom: 24 }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 20 }}>Progreso</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {TIMELINE_STEPS.map((step, i) => {
              const stepNum = i + 1
              const completed = currentStep > stepNum
              const active = currentStep === stepNum
              const StepIcon = step.icon

              return (
                <React.Fragment key={step.key}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    flex: 'none', position: 'relative',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: completed ? 'var(--midi-lime)' :
                        active ? 'var(--midi-purple)' : '#eee',
                      color: completed ? 'var(--midi-navy)' :
                        active ? '#fff' : '#aaa',
                      transition: 'all 0.3s',
                      boxShadow: active ? '0 0 0 4px rgba(130, 93, 199, 0.2)' : 'none',
                    }}>
                      {completed ? <CheckCircle size={20} /> : <StepIcon size={18} />}
                    </div>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: active || completed ? 600 : 400,
                      color: active || completed ? 'var(--midi-navy)' : '#aaa',
                      marginTop: 8, whiteSpace: 'nowrap', textAlign: 'center',
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 3, borderRadius: 2, margin: '0 8px',
                      marginBottom: 24,
                      background: completed ? 'var(--midi-lime)' : '#eee',
                      transition: 'background 0.3s',
                    }} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ MISSING DOCUMENTS — Re-upload Section ============ */}
      {status === 'documents_missing' && !uploadSuccess && (
        <div className="card" style={{
          padding: '28px',
          border: '2px solid #fde8e8',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <AlertCircle size={20} color="#e74c3c" />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Se necesitan documentos adicionales</span>
          </div>

          <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.5 }}>
            Sube los documentos solicitados abajo. Una vez que los envíes, tu aplicación volverá a revisión automáticamente.
          </p>

          {/* List of requested documents with upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {missingDocs.map((doc, i) => {
              const docLabel = typeof doc === 'object' ? doc.label : doc
              const docHint = typeof doc === 'object' ? doc.hint : null
              const hasFile = !!uploadedFiles[i]

              return (
                <div key={i} style={{
                  padding: '16px 20px',
                  background: hasFile ? 'rgba(226, 232, 104, 0.1)' : '#fef9f9',
                  borderRadius: 12,
                  border: hasFile ? '1.5px solid rgba(226, 232, 104, 0.4)' : '1.5px solid #fde8e8',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{
                        fontWeight: 600, fontSize: '0.9rem', marginBottom: 2,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {hasFile && <CheckCircle size={14} color="#5a6000" />}
                        {!hasFile && <span style={{ color: '#e74c3c', fontSize: '0.8rem' }}>●</span>}
                        {docLabel}
                      </div>
                      {docHint && <div style={{ fontSize: '0.78rem', color: '#888' }}>{docHint}</div>}
                    </div>

                    {hasFile ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', background: '#fff', borderRadius: 10,
                      }}>
                        <FileText size={14} color="#825DC7" />
                        <span style={{
                          fontSize: '0.85rem', fontWeight: 500, maxWidth: 150,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {uploadedFiles[i].name}
                        </span>
                        <button
                          onClick={() => removeFile(i)}
                          style={{
                            background: 'none', border: 'none', color: '#ccc',
                            cursor: 'pointer', padding: 2, display: 'flex',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[i]?.click()}
                        className="btn btn-sm"
                        style={{
                          background: 'rgba(231, 76, 60, 0.08)',
                          color: '#c0392b',
                          border: 'none',
                          fontSize: '0.82rem',
                        }}
                      >
                        <Upload size={14} /> Subir
                        <input
                          ref={el => fileInputRefs.current[i] = el}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={e => handleFileSelect(i, e.target.files)}
                          style={{ display: 'none' }}
                        />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Also allow extra uploads not in the specific list */}
          <div style={{
            marginTop: 16, padding: '14px 20px',
            border: '2px dashed #e0dce8', borderRadius: 12,
            textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onClick={() => {
              const extraIndex = missingDocs.length + Object.keys(uploadedFiles).filter(k => parseInt(k) >= missingDocs.length).length
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.pdf,.jpg,.jpeg,.png,.webp'
              input.onchange = (e) => handleFileSelect(extraIndex, e.target.files)
              input.click()
            }}
          >
            <p style={{ fontSize: '0.85rem', color: '#888' }}>
              <Upload size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              ¿Tienes documentos adicionales? Súbelos aquí
            </p>
          </div>

          {/* Extra uploaded files */}
          {Object.entries(uploadedFiles)
            .filter(([k]) => parseInt(k) >= missingDocs.length)
            .map(([k, file]) => (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', background: 'rgba(226, 232, 104, 0.1)',
                borderRadius: 10, marginTop: 8,
              }}>
                <FileText size={14} color="#825DC7" />
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>{file.name}</span>
                <button
                  onClick={() => removeFile(parseInt(k))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))
          }

          {uploadError && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              <AlertCircle size={16} /> {uploadError}
            </div>
          )}

          {/* Submit button */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmitDocs}
              disabled={Object.keys(uploadedFiles).length === 0 || uploading}
            >
              {uploading
                ? <><div className="spinner" /> Subiendo...</>
                : <><Send size={16} /> Enviar documentos</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Upload success message */}
      {uploadSuccess && status === 'documents_missing' && (
        <div className="card" style={{
          padding: '24px', marginBottom: 24,
          background: 'rgba(226, 232, 104, 0.12)',
          border: '2px solid rgba(226, 232, 104, 0.3)',
          textAlign: 'center',
        }}>
          <CheckCircle size={32} color="#5a6000" style={{ marginBottom: 8 }} />
          <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>Documentos enviados</p>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Tu aplicación volvió a revisión. Te notificaremos cuando haya novedades.
          </p>
        </div>
      )}

      {/* Approved CTA — Go to Contract */}
      {status === 'approved' && (
        <div className="card" style={{
          padding: '32px', textAlign: 'center',
          background: 'rgba(226, 232, 104, 0.12)',
          border: '2px solid rgba(226, 232, 104, 0.3)',
          marginBottom: 24,
        }}>
          <PartyPopper size={40} color="#5a6000" style={{ marginBottom: 12 }} />
          <h3 style={{ marginBottom: 8, color: 'var(--midi-navy)' }}>
            Tu empresa ha sido aprobada
          </h3>
          <p className="text-muted" style={{ marginBottom: 20, fontSize: '0.95rem' }}>
            Solo falta un paso: firma el contrato de servicio para activar tu cuenta.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/kyb/contract')}
          >
            Firmar contrato <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Activity Log */}
      {statusLogs.length > 0 && (
        <div className="card" style={{ padding: '24px' }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>Historial</p>
          {statusLogs.map((log, i) => (
            <div key={log.id || i} style={{
              display: 'flex', gap: 12, padding: '12px 0',
              borderBottom: i < statusLogs.length - 1 ? '1px solid #f5f3fa' : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === 0 ? 'var(--midi-purple)' : '#ddd',
                marginTop: 6, flexShrink: 0,
              }} />
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  {STATUS_CONFIG[log.status]?.label || log.status}
                </p>
                {log.message && (
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>{log.message}</p>
                )}
                <p style={{ fontSize: '0.75rem', color: '#bbb', marginTop: 4 }}>
                  {new Date(log.created_at).toLocaleString('es', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
