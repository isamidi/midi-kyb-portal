import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import {
  Building2, Phone, MapPin, Briefcase, FileText, Shield, ArrowLeft,
  CheckCircle, Send, Edit3, AlertTriangle, Loader2
} from 'lucide-react'

/*
  KYBReview — Step 3: Review all form data before submission

  Shows a read-only summary of all sections.
  Client can click "Edit" on any section to go back to that section.
  Submit sends the application for review.
*/

const SECTIONS = [
  { id: 'company_info', label: 'Company Info', icon: Building2 },
  { id: 'contact_info', label: 'Contact Info', icon: Phone },
  { id: 'operating_address', label: 'Operating Address', icon: MapPin },
  { id: 'expected_activity', label: 'Expected Activity', icon: Briefcase },
  { id: 'business_model', label: 'Business Model', icon: FileText },
  { id: 'compliance', label: 'Compliance', icon: Shield },
]

const FIELD_LABELS = {
  full_legal_name: 'Full Legal Name of the Entity',
  trade_name: 'Trade Name / BDA Name',
  entity_type: 'Entity Type',
  registration_number: 'Registration Number',
  tax_id_ein: 'Tax ID / EIN Number',
  entity_phone: 'Entity Phone Number',
  entity_email: 'Entity Email',
  digital_presence: 'Digital Presence',
  operating_address: 'Operating Physical Address',
  country_of_incorporation: 'Country of Incorporation',
  city: 'City',
  state: 'State',
  zip_postal_code: 'ZIP / Postal Code',
  purpose_of_payment: 'Purpose of Payment',
  number_of_workers: 'Number of Remote Workers / Freelancers',
  service_locations: 'Location of Service Providers',
  nature_of_business: 'Nature of Business',
  avg_relationship_duration: 'Average Working Relationship',
  workers_under_18: 'Workers Under 18',
  expected_activity_usd: 'Expected Activity (USD)',
  expected_activity_frequency: 'Expected Activity Frequency',
  business_model_description: 'Business Model Description',
  sanctioned_countries: 'Sanctioned Countries Check',
}

const SECTION_FIELDS = {
  company_info: ['full_legal_name', 'trade_name', 'entity_type', 'registration_number', 'tax_id_ein'],
  contact_info: ['entity_phone', 'entity_email', 'digital_presence'],
  operating_address: ['operating_address', 'country_of_incorporation', 'city', 'state', 'zip_postal_code'],
  expected_activity: ['purpose_of_payment', 'number_of_workers', 'service_locations', 'nature_of_business', 'avg_relationship_duration', 'workers_under_18', 'expected_activity_usd', 'expected_activity_frequency'],
  business_model: ['business_model_description'],
  compliance: ['sanctioned_countries'],
}

export default function KYBReview() {
  const navigate = useNavigate()
  const { user, setApplicationStatus } = useAuth()
  const { companyId } = useKYB()
  const [formData, setFormData] = useState({})
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!companyId) return
    const loadData = async () => {
      setLoading(true)
      try {
        const { data: apps } = await supabase
          .from('kyb_applications')
          .select('form_data, documents')
          .eq('company_id', companyId)
          .limit(1)

        const app = apps?.[0]
        if (app?.form_data) setFormData(app.form_data)
        if (app?.documents) setDocuments(app.documents)
      } catch (err) {
        console.error('Error loading review data:', err)
      }
      setLoading(false)
    }
    loadData()
  }, [companyId])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      // Update application status to submitted
      const { error: updateError } = await supabase
        .from('kyb_applications')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)

      if (updateError) throw updateError

      // Update company stage to documentos (submitted for compliance review)
      await supabase
        .from('companies')
        .update({ stage: 'documentos' })
        .eq('id', companyId)

      // Log the status change
      await supabase.from('application_status_log').insert({
        application_id: companyId,
        old_status: 'draft',
        new_status: 'submitted',
        changed_by: user.id,
        note: 'KYB application submitted by company',
      })

      setApplicationStatus('submitted')
      setSubmitted(true)

      // Redirect to status dashboard after a moment
      setTimeout(() => navigate('/kyb/status'), 2000)
    } catch (err) {
      setError(err.message || 'Error submitting application. Please try again.')
      setSubmitting(false)
    }
  }

  const formatValue = (value) => {
    if (Array.isArray(value)) return value.join(', ')
    return value || 'N/A'
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
        <p className="text-muted" style={{ marginTop: 12 }}>Loading review...</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="page-center animate-in" style={{ textAlign: 'center' }}>
        <CheckCircle size={64} color="#5a6000" />
        <h2 style={{ marginTop: 16 }}>Application Submitted!</h2>
        <p className="text-muted" style={{ marginTop: 8, maxWidth: 480 }}>
          Your KYB application has been submitted for review. Our compliance team will review your documents and information. You'll be notified once it's approved.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <h2 style={{ marginBottom: 8 }}>
        Review your <span className="text-purple">application</span>
      </h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Please review all information before submitting. Click "Edit" on any section to make changes.
      </p>

      {/* Documents summary */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Uploaded Documents</h3>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => navigate('/kyb/upload')}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <Edit3 size={14} /> Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {documents.map((doc, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: '#f8f8f8', borderRadius: 8, fontSize: '0.82rem',
            }}>
              <FileText size={14} color="#825DC7" />
              {doc.file_name || doc.document_type}
            </div>
          ))}
        </div>
      </div>

      {/* Form sections */}
      {SECTIONS.map((section) => {
        const Icon = section.icon
        const fields = SECTION_FIELDS[section.id] || []

        return (
          <div key={section.id} className="card" style={{ padding: '20px 24px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={20} color="#825DC7" />
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{section.label}</h3>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => navigate('/kyb/form', { state: { section: section.id } })}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <Edit3 size={14} /> Edit
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: section.id === 'business_model' ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px 24px' }}>
              {fields.map(field => (
                <div key={field}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {FIELD_LABELS[field]}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#333', fontWeight: 500 }}>
                    {formatValue(formData[field])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/kyb/form')}>
          <ArrowLeft size={18} /> Back to Form
        </button>

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: 'var(--midi-gradient-purple)',
            padding: '16px 32px',
            fontSize: '1.05rem',
          }}
        >
          {submitting ? (
            <><Loader2 size={18} className="spinning" /> Submitting...</>
          ) : (
            <><Send size={18} /> Submit Application</>
          )}
        </button>
      </div>
    </div>
  )
}
