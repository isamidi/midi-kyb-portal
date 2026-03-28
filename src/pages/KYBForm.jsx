import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import {
  Building2, Phone, MapPin, Briefcase, FileText, Shield, ArrowRight, ArrowLeft,
  CheckCircle, Circle, Sparkles, Loader2, Save, Globe, AlertTriangle
} from 'lucide-react'

/*
  KYBForm â Step 2 of KYB Process

  Flow: Documents uploaded â AI extracts data â Form pre-filled â Client completes remaining fields

  Sections:
  1. Company Info (auto-filled from governance doc)
  2. Contact Info (email entered, digital presence auto from domain)
  3. Operating Address (manual or from bank statement)
  4. Expected Activity (all manual)
  5. Business Model (auto-suggested from website scraping)
  6. Compliance (sanctioned countries check)

  Features:
  - Free navigation between sections via sidebar
  - Auto-save on field change (debounced)
  - All sections required before submit
  - Can exit and return, progress persists
*/

// ââ Section Definitions ââââââââââââââââââââââââââââââââââââââââââââââ
const SECTIONS = [
  { id: 'company_info', label: 'Company Info', icon: Building2 },
  { id: 'contact_info', label: 'Contact Info', icon: Phone },
  { id: 'operating_address', label: 'Operating Address', icon: MapPin },
  { id: 'expected_activity', label: 'Expected Activity', icon: Briefcase },
  { id: 'business_model', label: 'Business Model', icon: FileText },
  { id: 'compliance', label: 'Compliance', icon: Shield },
]

// ââ Options ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const ENTITY_TYPES = [
  'Corporation (U.S. Companies)-Domestic',
  'Corporation (Non-U.S. companies)-Foreign',
  'Partnership',
  'Corporation',
  'Limited Liability Company',
  'Partnership (Unincorporated)',
  'Private Company',
  'Government',
  'Other',
]

const PAYMENT_PURPOSES = ['Remote Worker', 'Freelancer Fees', 'Other']

const SERVICE_LOCATIONS = [
  'Argentina', 'Brazil', 'Chile', 'Colombia',
  'Dominican Republic', 'Ecuador', 'Mexico', 'Peru',
]

const BUSINESS_NATURES = [
  'Agriculture, Forestry, Fishing and Hunting',
  'Utilities',
  'Construction',
  'Manufacturing',
  'Grantmaking and Giving Services (e.g., Charitable Organizations)',
  'Staff services',
  'Other Services',
  'Professional, Scientific, and Technical Services',
  'Finance and Insurance',
  'Real Estate and Leasing',
  'Marketing/Creative',
  'Consulting',
  'Technology services',
]

const EXPECTED_ACTIVITY_RANGES = [
  'Less than $25K',
  'Between $25K and $50K',
  'Between $50K and $75K',
  'Between $75K and $100K',
]

const ACTIVITY_FREQUENCIES = ['Weekly', 'Bi-Weekly', 'Monthly', 'Other']

const RELATIONSHIP_DURATIONS = ['Less than 2yrs', '2 to 5Yrs', 'More than 5Yrs']

const SANCTIONED_COUNTRIES = [
  'None of These', 'Cuba', 'North Korea (DPKR)', 'Crimea Region (Ukraine)',
  'Luhansk People\'s Republic (LNR)', 'Russia', 'Venezuela', 'Iran',
  'Syria', 'Donetsk People\'s Republic (DNR)', 'Myanmar (Burma)', 'Belarus',
]

// ââ Initial Form State âââââââââââââââââââââââââââââââââââââââââââââââ
const INITIAL_FORM = {
  // Company Info
  full_legal_name: '',
  trade_name: '',
  entity_type: '',
  registration_number: '',
  tax_id_ein: '',

  // Contact Info
  entity_phone: '',
  entity_email: '',
  digital_presence: '',

  // Operating Address
  operating_address: '',
  country_of_incorporation: '',
  city: '',
  state: '',
  zip_postal_code: '',

  // Expected Activity
  purpose_of_payment: [],
  number_of_workers: '',
  service_locations: [],
  nature_of_business: [],
  avg_relationship_duration: '',
  workers_under_18: '',
  expected_activity_usd: '',
  expected_activity_frequency: '',

  // Business Model
  business_model_description: '',

  // Compliance
  sanctioned_countries: [],
}

// ââ Validation âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const REQUIRED_FIELDS = {
  company_info: ['full_legal_name', 'trade_name', 'entity_type', 'registration_number', 'tax_id_ein'],
  contact_info: ['entity_phone', 'entity_email', 'digital_presence'],
  operating_address: ['operating_address', 'country_of_incorporation', 'city', 'state', 'zip_postal_code'],
  expected_activity: ['purpose_of_payment', 'number_of_workers', 'service_locations', 'nature_of_business', 'avg_relationship_duration', 'workers_under_18', 'expected_activity_usd', 'expected_activity_frequency'],
  business_model: ['business_model_description'],
  compliance: ['sanctioned_countries'],
}

function isSectionComplete(sectionId, formData) {
  const fields = REQUIRED_FIELDS[sectionId] || []
  return fields.every(field => {
    const val = formData[field]
    if (Array.isArray(val)) return val.length > 0
    return val !== '' && val !== null && val !== undefined
  })
}

// ââ Main Component âââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function KYBForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { kybData, setKybData, companyId } = useKYB()
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [activeSection, setActiveSection] = useState('company_info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [autoFilledFields, setAutoFilledFields] = useState(new Set())
  const [scrapingWebsite, setScrapingWebsite] = useState(false)
  const [error, setError] = useState('')

  // Load existing form data from Supabase
  useEffect(() => {
    if (!companyId) return
    const loadData = async () => {
      setLoading(true)
      try {
        // Load extracted data from kyb_applications
        const { data: apps } = await supabase
          .from('kyb_applications')
          .select('extracted_data, status')
          .eq('company_id', companyId)
          .limit(1)

        const app = apps?.[0]

        // Load saved form data (if user saved before)
        const { data: savedForms } = await supabase
          .from('kyb_applications')
          .select('form_data')
          .eq('company_id', companyId)
          .limit(1)

        const savedForm = savedForms?.[0]
        const extracted = app?.extracted_data || {}
        const saved = savedForm?.form_data || {}

        // Merge: saved data takes priority, then extracted, then empty
        const merged = { ...INITIAL_FORM }
        const autoFilled = new Set()

        // Map extracted fields to form fields
        const extractionMap = {
          entity_name: 'full_legal_name',
          trade_name: 'trade_name',
          type_of_company: 'entity_type',
          registration_number: 'registration_number',
          tin_ein: 'tax_id_ein',
          tax_id_ein: 'tax_id_ein',
          country_of_registration: 'country_of_incorporation',
          country_of_incorporation: 'country_of_incorporation',
          entity_address: 'operating_address',
          operating_address: 'operating_address',
        }

        // Apply extracted data
        for (const [extractKey, formKey] of Object.entries(extractionMap)) {
          if (extracted[extractKey] && !saved[formKey]) {
            merged[formKey] = extracted[extractKey]
            autoFilled.add(formKey)
          }
        }

        // Apply saved form data on top
        for (const [key, val] of Object.entries(saved)) {
          if (val !== '' && val !== null && val !== undefined) {
            merged[key] = val
          }
        }

        setFormData(merged)
        setAutoFilledFields(autoFilled)
      } catch (err) {
        console.error('Error loading form data:', err)
      }
      setLoading(false)
    }
    loadData()
  }, [companyId])

  // Auto-save (debounced)
  const saveToDb = useCallback(async (data) => {
    if (!companyId) return
    setSaving(true)
    try {
      await supabase
        .from('kyb_applications')
        .update({ form_data: data, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
      setLastSaved(new Date())
    } catch (err) {
      console.error('Auto-save failed:', err)
    }
    setSaving(false)
  }, [companyId])

  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => saveToDb(formData), 2000)
    return () => clearTimeout(timer)
  }, [formData, loading, saveToDb])

  // Update form field
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Remove from auto-filled set once user edits
    setAutoFilledFields(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  // Toggle checkbox value in array field
  const toggleArrayField = (field, value) => {
    setFormData(prev => {
      const arr = prev[field] || []
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(v => v !== value) }
      }
      return { ...prev, [field]: [...arr, value] }
    })
  }

  // Auto-derive digital presence from entity email domain
  const deriveDigitalPresence = async (email) => {
    if (!email || !email.includes('@')) return
    const domain = email.split('@')[1]
    if (!domain || domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook')) return

    const website = `https://${domain}`
    if (!formData.digital_presence) {
      updateField('digital_presence', website)
      setAutoFilledFields(prev => new Set([...prev, 'digital_presence']))
    }

    // Try to scrape website for business model suggestion
    if (!formData.business_model_description) {
      setScrapingWebsite(true)
      try {
        const { data, error: fnError } = await supabase.functions.invoke('scrape-website', {
          body: { url: website, company_id: companyId },
        })
        if (!fnError && data?.business_model) {
          updateField('business_model_description', data.business_model)
          setAutoFilledFields(prev => new Set([...prev, 'business_model_description']))
        }
      } catch (err) {
        console.error('Website scraping failed:', err)
      }
      setScrapingWebsite(false)
    }
  }

  // Handle email blur to trigger auto-fill
  const handleEmailBlur = () => {
    if (formData.entity_email) {
      deriveDigitalPresence(formData.entity_email)
    }
  }

  // Navigation
  const currentIndex = SECTIONS.findIndex(s => s.id === activeSection)
  const goNext = () => {
    if (currentIndex < SECTIONS.length - 1) {
      setActiveSection(SECTIONS[currentIndex + 1].id)
    }
  }
  const goPrev = () => {
    if (currentIndex > 0) {
      setActiveSection(SECTIONS[currentIndex - 1].id)
    }
  }

  // Check all sections complete
  const allComplete = SECTIONS.every(s => isSectionComplete(s.id, formData))

  const handleSubmit = async () => {
    // Save current progress and continue - validation happens at submit in Review
    // Final save
    await saveToDb(formData)
    navigate('/kyb/review')
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
        <p className="text-muted" style={{ marginTop: 12 }}>Loading your application...</p>
      </div>
    )
  }

  // ââ Render Helpers âââââââââââââââââââââââââââââââââââââââââââââââââ
  const renderField = (label, field, type = 'text', props = {}) => {
    const isAutoFilled = autoFilledFields.has(field)
    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 6, color: '#333' }}>
          {label} <span style={{ color: 'var(--midi-orange)' }}>*</span>
          {isAutoFilled && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#825DC7', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Auto-filled
            </span>
          )}
        </label>
        {type === 'textarea' ? (
          <textarea
            value={formData[field] || ''}
            onChange={e => updateField(field, e.target.value)}
            rows={props.rows || 5}
            placeholder={props.placeholder || ''}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: isAutoFilled ? '1.5px solid rgba(130, 93, 199, 0.3)' : '1.5px solid #ddd',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              background: isAutoFilled ? 'rgba(130, 93, 199, 0.03)' : '#fff',
              transition: 'border-color 0.2s',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#825DC7'}
            onBlur={e => e.target.style.borderColor = isAutoFilled ? 'rgba(130, 93, 199, 0.3)' : '#ddd'}
          />
        ) : (
          <input
            type={type}
            value={formData[field] || ''}
            onChange={e => updateField(field, e.target.value)}
            placeholder={props.placeholder || ''}
            onBlur={props.onBlur}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: isAutoFilled ? '1.5px solid rgba(130, 93, 199, 0.3)' : '1.5px solid #ddd',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              background: isAutoFilled ? 'rgba(130, 93, 199, 0.03)' : '#fff',
              transition: 'border-color 0.2s',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#825DC7'}
          />
        )}
        {props.hint && <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 4 }}>{props.hint}</div>}
      </div>
    )
  }

  const renderCheckboxGroup = (label, field, options, hint) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, color: '#333' }}>
        {label} <span style={{ color: 'var(--midi-orange)' }}>*</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {options.map(opt => (
          <label key={opt} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
            background: (formData[field] || []).includes(opt) ? 'rgba(130, 93, 199, 0.08)' : '#fff',
            border: (formData[field] || []).includes(opt) ? '1.5px solid rgba(130, 93, 199, 0.3)' : '1.5px solid #eee',
            transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              checked={(formData[field] || []).includes(opt)}
              onChange={() => toggleArrayField(field, opt)}
              style={{ accentColor: '#825DC7' }}
            />
            {opt}
          </label>
        ))}
      </div>
      {hint && <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 4 }}>{hint}</div>}
    </div>
  )

  const renderRadioGroup = (label, field, options) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, color: '#333' }}>
        {label} <span style={{ color: 'var(--midi-orange)' }}>*</span>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <label key={opt} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
            background: formData[field] === opt ? 'rgba(130, 93, 199, 0.08)' : '#fff',
            border: formData[field] === opt ? '1.5px solid rgba(130, 93, 199, 0.3)' : '1.5px solid #eee',
            transition: 'all 0.15s',
          }}>
            <input
              type="radio"
              name={field}
              checked={formData[field] === opt}
              onChange={() => updateField(field, opt)}
              style={{ accentColor: '#825DC7' }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )

  // ââ Section Renderers ââââââââââââââââââââââââââââââââââââââââââââââ
  const renderCompanyInfo = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Company Info</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        Please complete all fields. If not applicable, indicate with "N/A".
      </p>

      {renderField('Full Legal Name of the Entity', 'full_legal_name')}
      {renderField('Trade Name / BDA Name (If Applicable)', 'trade_name')}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, color: '#333' }}>
          Entity Type <span style={{ color: 'var(--midi-orange)' }}>*</span>
          {autoFilledFields.has('entity_type') && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#825DC7', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Auto-filled
            </span>
          )}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
          {ENTITY_TYPES.map(type => (
            <label key={type} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
              background: formData.entity_type === type ? 'rgba(130, 93, 199, 0.08)' : '#fff',
              border: formData.entity_type === type ? '1.5px solid rgba(130, 93, 199, 0.3)' : '1.5px solid #eee',
              transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="entity_type"
                checked={formData.entity_type === type}
                onChange={() => updateField('entity_type', type)}
                style={{ accentColor: '#825DC7' }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {renderField('Registration Number', 'registration_number')}
        {renderField('Tax ID / EIN Number (If Applicable)', 'tax_id_ein')}
      </div>
    </div>
  )

  const renderContactInfo = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Contact Info</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        Company contact information and online presence.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {renderField('Entity Phone Number', 'entity_phone', 'tel', { placeholder: '+1' })}
        {renderField('Entity Email', 'entity_email', 'email', {
          placeholder: 'company@domain.com',
          onBlur: handleEmailBlur,
          hint: 'We\'ll use this to auto-detect your website and digital presence.',
        })}
      </div>

      {renderField('Digital Presence (if applicable)', 'digital_presence', 'textarea', {
        rows: 3,
        placeholder: 'Links to your company\'s official website, social media accounts, or any mobile or web applications related to your business.',
        hint: 'Provide links to your company\'s official website, social media accounts, or any mobile or web applications related to your business.',
      })}

      {scrapingWebsite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(130, 93, 199, 0.04)', borderRadius: 12, border: '1px solid rgba(130, 93, 199, 0.15)', marginBottom: 16 }}>
          <Loader2 size={16} className="spinning" color="#825DC7" />
          <span style={{ fontSize: '0.85rem', color: '#825DC7' }}>Analyzing your website to pre-fill business model...</span>
        </div>
      )}
    </div>
  )

  const renderOperatingAddress = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Operating Address</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        Enter the full address where your company operates. If your entity does not have a physical location, please provide the address of the Ultimate Beneficial Owner (UBO).
      </p>

      {renderField('Operating Physical Address (P.O. Box Not Acceptable)', 'operating_address', 'text', {
        hint: 'If your entity does not have a physical location, please provide the address of the Ultimate Beneficial Owner (UBO).',
      })}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {renderField('Country of Incorporation', 'country_of_incorporation')}
        {renderField('City', 'city')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {renderField('State', 'state')}
        {renderField('ZIP / Postal Code', 'zip_postal_code')}
      </div>
    </div>
  )

  const renderExpectedActivity = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Expected Activity</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        Help us understand the type and volume of payments your company expects to make through Midi.
      </p>

      {renderCheckboxGroup('Purpose of Payment (Select all that apply)', 'purpose_of_payment', PAYMENT_PURPOSES)}

      {renderField('Number of Remote Workers and/or Freelancers', 'number_of_workers', 'number', {
        placeholder: 'e.g., 25',
      })}

      {renderCheckboxGroup('Location of Service Providers to the Entity (Select all that apply)', 'service_locations', SERVICE_LOCATIONS)}
      {renderCheckboxGroup('Nature of Business (Select all that apply)', 'nature_of_business', BUSINESS_NATURES)}

      {renderRadioGroup('Average working relationship with Remote Workers and/or Freelancers', 'avg_relationship_duration', RELATIONSHIP_DURATIONS)}

      {renderRadioGroup('Are any Remote Workers and/or Freelancers under 18 years old?', 'workers_under_18', ['Yes', 'No'])}

      {renderRadioGroup('Expected Activity (USD)', 'expected_activity_usd', EXPECTED_ACTIVITY_RANGES)}

      {renderRadioGroup('Expected Activity Frequency', 'expected_activity_frequency', ACTIVITY_FREQUENCIES)}
    </div>
  )

  const renderBusinessModel = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Overview of the Entity's Business Model and Activities</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        Please provide a detailed overview of the entity's business model, including its specific industry or sector (e.g., fintech, e-commerce, consulting, logistics). Describe the entity's core activities and explain how it generates value or revenue, including examples of its main products, services, and operations.
      </p>

      {renderField('Describe Entity\'s Business Model', 'business_model_description', 'textarea', {
        rows: 8,
        placeholder: 'Describe your company\'s business model, industry, core activities, and how it generates revenue...',
        hint: 'Avoid one-line answers. A clear explanation usually takes a few sentences and gives us a full picture of your business activity.',
      })}
    </div>
  )

  const renderCompliance = () => (
    <div>
      <h3 style={{ marginBottom: 4 }}>Compliance Check</h3>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
        If your entity has no physical presence, please select if management team or operations are located and/or served at any of the following countries.
      </p>

      {renderCheckboxGroup(
        'Select all that apply',
        'sanctioned_countries',
        SANCTIONED_COUNTRIES,
        'Select "None of These" if your entity has no presence in any of these countries.'
      )}
    </div>
  )

  const sectionRenderers = {
    company_info: renderCompanyInfo,
    contact_info: renderContactInfo,
    operating_address: renderOperatingAddress,
    expected_activity: renderExpectedActivity,
    business_model: renderBusinessModel,
    compliance: renderCompliance,
  }

  // ââ Main Render ââââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <div style={{ display: 'flex', gap: 24, minHeight: '70vh' }}>
      {/* Sidebar Navigation */}
      <div style={{
        width: 240,
        flexShrink: 0,
        position: 'sticky',
        top: 24,
        alignSelf: 'flex-start',
      }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sections
          </div>
          {SECTIONS.map((section) => {
            const complete = isSectionComplete(section.id, formData)
            const isActive = section.id === activeSection
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 10,
                  background: isActive ? 'rgba(130, 93, 199, 0.1)' : 'transparent',
                  color: isActive ? '#825DC7' : '#555',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginBottom: 2,
                }}
              >
                {complete ? (
                  <CheckCircle size={18} color="#5a6000" />
                ) : (
                  <Icon size={18} style={{ opacity: isActive ? 1 : 0.5 }} />
                )}
                {section.label}
              </button>
            )
          })}

          {/* Save status */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee', fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? (
              <><Loader2 size={12} className="spinning" /> Saving...</>
            ) : lastSaved ? (
              <><Save size={12} /> Saved {lastSaved.toLocaleTimeString()}</>
            ) : null}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#fff', borderRadius: 12, boxShadow: 'var(--midi-shadow-sm)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 6 }}>
            {SECTIONS.filter(s => isSectionComplete(s.id, formData)).length} of {SECTIONS.length} sections complete
          </div>
          <div style={{ width: '100%', height: 6, background: '#eee', borderRadius: 3 }}>
            <div style={{
              width: `${(SECTIONS.filter(s => isSectionComplete(s.id, formData)).length / SECTIONS.length) * 100}%`,
              height: '100%',
              background: allComplete ? 'var(--midi-lime)' : 'var(--midi-purple)',
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card" style={{ padding: '32px 36px' }}>
          {sectionRenderers[activeSection]?.()}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
          <button
            className="btn btn-secondary"
            onClick={goPrev}
            disabled={currentIndex === 0}
            style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
          >
            <ArrowLeft size={18} /> Back
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            {currentIndex < SECTIONS.length - 1 ? (
              <button className="btn btn-primary" onClick={goNext}>
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={false}
                style={{ background: allComplete ? 'var(--midi-purple)' : undefined }}
              >
                Review & Submit <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
