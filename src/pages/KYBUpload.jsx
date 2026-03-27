import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import { Upload, FileText, X, ArrowRight, Info, CheckCircle, Sparkles, Loader2 } from 'lucide-react'

/*
    Required Documents per the Midi KYB process:
    1. Corporate Document (Operating Agreement, Bylaws, Partnership Agreement)
    2. Photo ID of all individuals with 10%+ ownership + control persons + authorized signatories
    3. Most recent monthly bank statement
    4. Certification of Beneficial Owners (BSJI form - we generate this from the form data)
    5. Bank Account Information Form (we collect this in the form step)
  */

const REQUIRED_DOCS = [
  {
        id: 'corporate_document',
        label: 'Documento Corporativo',
        hint: 'Operating Agreement, Bylaws, o Partnership Agreement. Muestra owners, shares, y directors.',
        required: true,
        extractable: ['entity_name', 'registration_number', 'registration_date', 'type_of_company', 'country_of_registration', 'beneficial_owners'],
  },
  {
        id: 'ein_tax_id',
        label: 'EIN o Tax ID',
        hint: 'IRS Letter (CP575) o documento de identificación fiscal de la empresa.',
        required: true,
        extractable: ['tin_ein', 'entity_name'],
  },
  {
        id: 'id_representative',
        label: 'ID del Representante Legal / Control Person',
        hint: 'Pasaporte o ID gubernamental del authorized signer y personas con control.',
        required: true,
        extractable: ['contact_name', 'contact_id_number'],
        multiple: true,
  },
  {
        id: 'bank_statement',
        label: 'Estado de Cuenta Bancario Reciente',
        hint: 'El más reciente (del mes inmediatamente anterior).',
        required: true,
        extractable: ['bank_name', 'account_number', 'entity_address'],
  },
  {
        id: 'proof_address',
        label: 'Comprobante de Dirección de la Empresa',
        hint: 'Utility bill, bank statement o lease de los últimos 3 meses.',
        required: false,
        extractable: ['operating_address'],
  },
  ]

export default function KYBUpload() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { kybData, setKybData, companyId } = useKYB()
    const [files, setFiles] = useState({})
    const [uploading, setUploading] = useState(false)
    const [extracting, setExtracting] = useState({}) // { docId: 'pending' | 'done' | 'error' }
  const [extractedCount, setExtractedCount] = useState(0)
    const [error, setError] = useState('')
    const fileInputRefs = useRef({})

  const handleFileSelect = (docId, fileList) => {
        if (!fileList || fileList.length === 0) return
        const file = fileList[0]

        const maxSize = 10 * 1024 * 1024
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

        if (file.size > maxSize) {
                setError(`${file.name} es demasiado grande. Máximo 10MB.`)
                return
        }
        if (!allowedTypes.includes(file.type)) {
                setError('Solo se aceptan archivos PDF, JPG, PNG o WebP')
                return
        }

        setError('')
        setFiles(prev => ({ ...prev, [docId]: file }))
  }

  const removeFile = (docId) => {
        setFiles(prev => {
                const next = { ...prev }
                        delete next[docId]
                return next
        })
  }

  const requiredCount = REQUIRED_DOCS.filter(d => d.required).length
    const requiredUploaded = REQUIRED_DOCS.filter(d => d.required && files[d.id]).length
    const totalUploaded = Object.keys(files).length
    const canContinue = requiredUploaded === requiredCount

  // Trigger extraction for a single document (runs in background)
  const extractDocument = async (docId, filePath, documentId) => {
        setExtracting(prev => ({ ...prev, [docId]: 'pending' }))
        try {
                const { data, error: fnError } = await supabase.functions.invoke('extract-document', {
                          body: {
                                      file_path: filePath,
                                      document_type: docId,
                                      company_id: companyId,
                                      document_id: documentId,
                          },
                })

          if (fnError) throw fnError

          setExtracting(prev => ({ ...prev, [docId]: 'done' }))
                setExtractedCount(prev => prev + 1)
                return data?.extracted_fields || {}
        } catch (err) {
                console.error(`Extraction failed for ${docId}:`, err)
                setExtracting(prev => ({ ...prev, [docId]: 'error' }))
                return null
        }
  }

  const handleContinue = async () => {
        if (!canContinue) {
                setError('Sube todos los documentos requeridos para continuar')
                return
        }

        setUploading(true)
        setError('')

        try {
                const uploadedDocs = []
                        const extractionPromises = []

                                for (const [docId, file] of Object.entries(files)) {
                                          const ext = file.name.split('.').pop()
                                          const filePath = `${companyId}/${docId}_${Date.now()}.${ext}`

                  // Upload to storage
                  const { data, error: uploadError } = await supabase.storage
                                            .from('kyb-documents')
                                            .upload(filePath, file)

                  if (uploadError) throw uploadError

                  // Save document metadata to DB
                  const { data: docRecord } = await supabase
                                            .from('kyb_documents')
                                            .insert({
                                                          company_id: companyId,
                                                          document_type: docId,
                                                          file_path: data.path,
                                                          file_name: file.name,
                                                          file_size: file.size,
                                                          mime_type: file.type,
                                                          uploaded_by: user.id,
                                            })
                                            .select('id')
                                            .single()

                  uploadedDocs.push({
                              document_type: docId,
                              file_path: data.path,
                              file_name: file.name,
                              file_size: file.size,
                  })

                  // Launch extraction in parallel (don't await)
                  extractionPromises.push(
                              extractDocument(docId, data.path, docRecord?.id)
                            )
                                }

          // Save uploaded docs to application
          await supabase
                  .from('kyb_applications')
                  .update({ documents: uploadedDocs })
                  .eq('company_id', companyId)

          setKybData(prev => ({
                    ...prev,
                    documents: uploadedDocs,
          }))

          setUploading(false)

          // Wait for all extractions to finish (show progress)
          await Promise.allSettled(extractionPromises)

          // Small delay so user sees the extraction completed
          setTimeout(() => navigate('/kyb/form'), 800)
        } catch (err) {
                setError(err.message || 'Error subiendo documentos. Intenta de nuevo.')
                setUploading(false)
        }
  }

  return (
        <div className="animate-in">
              <h2 style={{ marginBottom: 8 }}>
                      Sube los <span className="text-purple">documentos</span>span> de tu empresa
              </h2>h2>
              <p className="text-muted" style={{ marginBottom: 8 }}>
                      Con estos documentos llenamos la mayor parte del formulario automáticamente.
                      Solo tendrás que completar lo que no podamos extraer.
              </p>p>
        
              <div className="alert alert-info mb-4" style={{ marginTop: 16 }}>
                      <Info size={18} style={{ flexShrink: 0 }} />
                      <span>PDF, JPG o PNG. Máximo 10MB por archivo. Los campos marcados con * son obligatorios.</span>span>
              </div>div>
        
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {REQUIRED_DOCS.map((doc) => {
                    const hasFile = !!files[doc.id]
                                return (
                                              <div
                                                              key={doc.id}
                                                              className="card"
                                                              style={{
                                                                                padding: '20px 24px',
                                                                                border: hasFile ? '1.5px solid rgba(226, 232, 104, 0.5)' : '1.5px solid transparent',
                                                                                transition: 'border-color 0.2s',
                                                              }}
                                                            >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                                                            <div style={{ flex: 1, minWidth: 200 }}>
                                                                                              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                                {hasFile && <CheckCircle size={16} color="#5a6000" />}
                                                                                                {doc.label}
                                                                                                {doc.required && <span style={{ color: 'var(--midi-orange)', fontSize: '0.8rem' }}>*</span>span>}
                                                                                                </div>div>
                                                                                              <div style={{ fontSize: '0.8rem', color: '#888' }}>{doc.hint}</div>div>
                                                                            </div>div>
                                                            
                                                              {hasFile ? (
                                                                                <div className="file-item" style={{ margin: 0, flex: 'none' }}>
                                                                                                    <FileText size={16} color="#825DC7" />
                                                                                                    <span className="file-name" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                      {files[doc.id].name}
                                                                                                      </span>span>
                                                                                                    <button className="remove-btn" onClick={() => removeFile(doc.id)}>
                                                                                                                          <X size={16} />
                                                                                                      </button>button>
                                                                                </div>div>
                                                                              ) : (
                                                                                <button
                                                                                                      onClick={() => fileInputRefs.current[doc.id]?.click()}
                                                                                                      className="btn btn-sm btn-secondary"
                                                                                                      style={{ flex: 'none' }}
                                                                                                    >
                                                                                                    <Upload size={16} />
                                                                                                    Subir
                                                                                                    <input
                                                                                                                            ref={el => fileInputRefs.current[doc.id] = el}
                                                                                                                            type="file"
                                                                                                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                                                                                            onChange={e => handleFileSelect(doc.id, e.target.files)}
                                                                                                                            style={{ display: 'none' }}
                                                                                                                          />
                                                                                </button>button>
                                                                            )}
                                                            </div>div>
                                              </div>div>
                                            )
                })}
              </div>div>
        
          {/* Progress indicator */}
              <div style={{
                  marginTop: 24,
                  padding: '16px 20px',
                  background: '#fff',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--midi-shadow-sm)',
        }}>
                      <div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  {requiredUploaded} de {requiredCount} requeridos
                                </span>span>
                        {totalUploaded > requiredUploaded && (
                      <span style={{ color: '#888', fontSize: '0.85rem', marginLeft: 8 }}>
                                    (+{totalUploaded - requiredUploaded} opcionales)
                      </span>span>
                                )}
                      </div>div>
                      <div style={{ width: 120, height: 6, background: '#eee', borderRadius: 3 }}>
                                <div style={{
                      width: `${(requiredUploaded / requiredCount) * 100}%`,
                      height: '100%',
                      background: canContinue ? 'var(--midi-lime)' : 'var(--midi-purple)',
                      borderRadius: 3,
                      transition: 'width 0.3s',
        }} />
                      </div>div>
              </div>div>
        
          {/* Extraction status */}
          {Object.keys(extracting).length > 0 && (
                  <div className="card" style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(130, 93, 199, 0.04)', border: '1px solid rgba(130, 93, 199, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                        <Sparkles size={18} color="#825DC7" />
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#825DC7' }}>
                                                      Extrayendo información con AI...
                                        </span>span>
                            </div>div>
                    {Object.entries(extracting).map(([docId, status]) => {
                                const doc = REQUIRED_DOCS.find(d => d.id === docId)
                                              return (
                                                              <div key={docId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 4, color: '#555' }}>
                                                                {status === 'pending' && <Loader2 size={14} className="spinning" style={{ color: '#825DC7' }} />}
                                                                {status === 'done' && <CheckCircle size={14} color="#5a6000" />}
                                                                {status === 'error' && <X size={14} color="#e74c3c" />}
                                                                              <span>{doc?.label || docId}</span>span>
                                                                {status === 'done' && <span style={{ color: '#5a6000', fontSize: '0.75rem' }}>Datos extraídos</span>span>}
                                                                {status === 'error' && <span style={{ color: '#e74c3c', fontSize: '0.75rem' }}>Se llenará manualmente</span>span>}
                                                              </div>div>
                                                            )
                    })}
                  </div>div>
              )}
        
          {error && <div className="alert alert-error mt-2">{error}</div>div>}
        
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                                  className="btn btn-primary"
                                  onClick={handleContinue}
                                  disabled={!canContinue || uploading}
                                >
                        {uploading
                                      ? <><div className="spinner" /> Subiendo documentos...</>>
                                      : Object.values(extracting).some(s => s === 'pending')
                                        ? <><div className="spinner" /> Extrayendo información...</>>
                                        : <>Continuar al formulario <ArrowRight size={18} /></>>
                        }
                      </button>button>
              </div>div>
        </div>div>
      )
}</></></></div>
