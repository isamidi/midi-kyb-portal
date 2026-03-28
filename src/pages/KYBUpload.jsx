import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import { Upload, FileText, X, ArrowRight, Info, CheckCircle, Sparkles, Loader2, Plus } from 'lucide-react'

/*
  KYB Document Upload — Step 1
  Matches Jotform structure:
  1. Company Governance (Operating Agreement, Bylaws, etc.)
  2. Organization Chart (ownership & control structure)
  3. Identification (IDs for UBOs 10%+, CEO, CFO, authorized reps) — multiple files
  4. Bank Statement (most recent full calendar month)
*/

const REQUIRED_DOCS = [
  {
    id: 'company_governance',
    label: 'Company Governance',
    hint: 'Operating Agreement, Bylaws, Partnership Agreement, Shareholders Agreement, or Articles of Association.',
    required: true,
    extractable: ['entity_name', 'trade_name', 'entity_type', 'registration_number', 'tax_id_ein', 'country_of_incorporation', 'beneficial_owners'],
  },
  {
    id: 'organization_chart',
    label: 'Organization Chart',
    hint: 'Ownership and control structure showing shareholders, subsidiaries, and Ultimate Beneficial Owner (UBO).',
    required: true,
    extractable: ['beneficial_owners', 'ownership_percentages', 'subsidiaries'],
  },
  {
    id: 'id_documents',
    label: 'Identification (ID)',
    hint: 'Valid government-issued photo ID for all UBOs (10%+), CEO, CFO, and authorized representatives. Passport, national ID card, or driver\'s license.',
    required: true,
    extractable: ['contact_name', 'contact_id_number', 'nationality'],
    multiple: true,
  },
  {
    id: 'bank_statement',
    label: 'Bank Statement',
    hint: 'Most recent bank statement (for the last full calendar month). Must be complete, legible, and unaltered.',
    required: true,
    extractable: ['bank_name', 'account_number', 'entity_name', 'entity_address'],
  },
]

export default function KYBUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { kybData, setKybData, companyId } = useKYB()
  const [files, setFiles] = useState({}) // { docId: File | File[] }
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState({})
  const [extractedCount, setExtractedCount] = useState(0)
  const [error, setError] = useState('')
  const fileInputRefs = useRef({})

  // Load existing uploaded documents if returning to this step
  useEffect(() => {
    if (!companyId) return
    const loadExisting = async () => {
      const { data } = await supabase
        .from('kyb_documents')
        .select('*')
        .eq('company_id', companyId)
      if (data && data.length > 0) {
        // Mark existing docs as uploaded
        const existing = {}
        data.forEach(doc => {
          if (REQUIRED_DOCS.find(d => d.id === doc.document_type)?.multiple) {
            if (!existing[doc.document_type]) existing[doc.document_type] = []
            existing[doc.document_type].push({ name: doc.file_name, existing: true, id: doc.id })
          } else {
            existing[doc.document_type] = { name: doc.file_name, existing: true, id: doc.id }
          }
        })
        setFiles(existing)
      }
    }
    loadExisting()
  }, [companyId])

  const handleFileSelect = (docId, fileList) => {
    if (!fileList || fileList.length === 0) return
    const doc = REQUIRED_DOCS.find(d => d.id === docId)

    const maxSize = 10 * 1024 * 1024
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

    for (const file of fileList) {
      if (file.size > maxSize) {
        setError(`${file.name} is too large. Maximum 10MB.`)
        return
      }
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF, JPG, PNG, or WebP files are accepted.')
        return
      }
    }

    setError('')

    if (doc?.multiple) {
      // Append to array of files
      setFiles(prev => ({
        ...prev,
        [docId]: [...(prev[docId] || []), ...Array.from(fileList)],
      }))
    } else {
      setFiles(prev => ({ ...prev, [docId]: fileList[0] }))
    }
  }

  const removeFile = (docId, index) => {
    const doc = REQUIRED_DOCS.find(d => d.id === docId)
    if (doc?.multiple) {
      setFiles(prev => ({
        ...prev,
        [docId]: (prev[docId] || []).filter((_, i) => i !== index),
      }))
    } else {
      setFiles(prev => {
        const next = { ...prev }
        delete next[docId]
        return next
      })
    }
  }

  const hasFile = (docId) => {
    const f = files[docId]
    if (Array.isArray(f)) return f.length > 0
    return !!f
  }

  const requiredCount = REQUIRED_DOCS.filter(d => d.required).length
  const requiredUploaded = REQUIRED_DOCS.filter(d => d.required && hasFile(d.id)).length
  const canContinue = requiredUploaded === requiredCount

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
      setError('Please upload all required documents to continue.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const uploadedDocs = []
      const extractionPromises = []

      for (const doc of REQUIRED_DOCS) {
        const docFiles = doc.multiple ? (files[doc.id] || []) : (files[doc.id] ? [files[doc.id]] : [])

        for (const file of docFiles) {
          // Skip already-uploaded files
          if (file.existing) {
            uploadedDocs.push({
              document_type: doc.id,
              file_name: file.name,
              existing: true,
            })
            continue
          }

          const ext = file.name.split('.').pop()
          const filePath = `${companyId}/${doc.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`

          const { data, error: uploadError } = await supabase.storage
            .from('kyb-documents')
            .upload(filePath, file)

          if (uploadError) throw uploadError

          const { data: docRecord } = await supabase
            .from('kyb_documents')
            .insert({
              company_id: companyId,
              document_type: doc.id,
              file_path: data.path,
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: user.id,
            })
            .select('id')
            .single()

          uploadedDocs.push({
            document_type: doc.id,
            file_path: data.path,
            file_name: file.name,
            file_size: file.size,
          })

          extractionPromises.push(
            extractDocument(doc.id, data.path, docRecord?.id)
          )
        }
      }

      await supabase
        .from('kyb_applications')
        .update({ documents: uploadedDocs })
        .eq('company_id', companyId)

      setKybData(prev => ({
        ...prev,
        documents: uploadedDocs,
      }))

      setUploading(false)
      await Promise.allSettled(extractionPromises)
      setTimeout(() => navigate('/kyb/form'), 800)
    } catch (err) {
      setError(err.message || 'Error uploading documents. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="animate-in">
      <h2 style={{ marginBottom: 8 }}>
        Upload your company <span className="text-purple">documents</span>
      </h2>
      <p className="text-muted" style={{ marginBottom: 8 }}>
        We'll use these documents to pre-fill most of your application automatically.
        You'll only need to complete what we can't extract.
      </p>

      <div className="alert alert-info mb-4" style={{ marginTop: 16 }}>
        <Info size={18} style={{ flexShrink: 0 }} />
        <span>PDF, JPG, or PNG. Maximum 10MB per file. Fields marked with * are required.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REQUIRED_DOCS.map((doc) => {
          const uploaded = hasFile(doc.id)
          const docFiles = doc.multiple ? (files[doc.id] || []) : (files[doc.id] ? [files[doc.id]] : [])

          return (
            <div
              key={doc.id}
              className="card"
              style={{
                padding: '20px 24px',
                border: uploaded ? '1.5px solid rgba(226, 232, 104, 0.5)' : '1.5px solid transparent',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {uploaded && <CheckCircle size={16} color="#5a6000" />}
                    {doc.label}
                    {doc.required && <span style={{ color: 'var(--midi-orange)', fontSize: '0.8rem' }}>*</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{doc.hint}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {docFiles.map((file, idx) => (
                    <div key={idx} className="file-item" style={{ margin: 0 }}>
                      <FileText size={16} color="#825DC7" />
                      <span className="file-name" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <button className="remove-btn" onClick={() => removeFile(doc.id, idx)}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  {(!uploaded || doc.multiple) && (
                    <button
                      onClick={() => fileInputRefs.current[doc.id]?.click()}
                      className="btn btn-sm btn-secondary"
                      style={{ flex: 'none' }}
                    >
                      {doc.multiple && uploaded ? <><Plus size={16} /> Add more</> : <><Upload size={16} /> Upload</>}
                      <input
                        ref={el => fileInputRefs.current[doc.id] = el}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        multiple={doc.multiple}
                        onChange={e => handleFileSelect(doc.id, e.target.files)}
                        style={{ display: 'none' }}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress */}
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
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          {requiredUploaded} of {requiredCount} required
        </span>
        <div style={{ width: 120, height: 6, background: '#eee', borderRadius: 3 }}>
          <div style={{
            width: `${(requiredUploaded / requiredCount) * 100}%`,
            height: '100%',
            background: canContinue ? 'var(--midi-lime)' : 'var(--midi-purple)',
            borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Extraction status */}
      {Object.keys(extracting).length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(130, 93, 199, 0.04)', border: '1px solid rgba(130, 93, 199, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="#825DC7" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#825DC7' }}>
              Extracting information with AI...
            </span>
          </div>
          {Object.entries(extracting).map(([docId, status]) => {
            const doc = REQUIRED_DOCS.find(d => d.id === docId)
            return (
              <div key={docId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 4, color: '#555' }}>
                {status === 'pending' && <Loader2 size={14} className="spinning" style={{ color: '#825DC7' }} />}
                {status === 'done' && <CheckCircle size={14} color="#5a6000" />}
                {status === 'error' && <X size={14} color="#e74c3c" />}
                <span>{doc?.label || docId}</span>
                {status === 'done' && <span style={{ color: '#5a6000', fontSize: '0.75rem' }}>Data extracted</span>}
                {status === 'error' && <span style={{ color: '#e74c3c', fontSize: '0.75rem' }}>Will be filled manually</span>}
              </div>
            )
          })}
        </div>
      )}

      {error && <div className="alert alert-error mt-2">{error}</div>}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleContinue}
          disabled={!canContinue || uploading}
        >
          {uploading
            ? <><div className="spinner" /> Uploading documents...</>
            : Object.values(extracting).some(s => s === 'pending')
              ? <><div className="spinner" /> Extracting information...</>
              : <>Continue to form <ArrowRight size={18} /></>
          }
        </button>
      </div>
    </div>
  )
}
