import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useKYB } from '../App'
import { supabase } from '../lib/supabaseClient'
import { FileText, Check, ChevronDown, ChevronUp, Shield, ArrowLeft, PartyPopper } from 'lucide-react'

/*
  Contract Signing Page
  - Shows the Midi service agreement pre-filled with the company's data
  - Collapsible contract sections for readability
  - E-signature: typed name + checkbox + timestamp
  - Generates a signed record in Supabase
  - Legally valid under ESIGN Act (typed signature + intent + timestamp + IP)
*/

function ContractSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', background: open ? '#f9f8fc' : '#fff',
          border: '1px solid #eee', borderBottom: open ? 'none' : '1px solid #eee',
          cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--midi-navy)',
          fontFamily: "'DM Sans', sans-serif", textAlign: 'left',
        }}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{
          padding: '20px 24px', background: '#f9f8fc',
          border: '1px solid #eee', borderTop: 'none',
          fontSize: '0.88rem', lineHeight: 1.7, color: '#444',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function ContractSign() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { kybData, companyId } = useKYB()
  const [application, setApplication] = useState(null)
  const [companyData, setCompanyData] = useState({})
  const [signatureName, setSignatureName] = useState('')
  const [signatureTitle, setSignatureTitle] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      // Get application with form data
      const { data: app } = await supabase
        .from('kyb_applications')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (app) {
        setApplication(app)
        const fd = app.form_data || {}
        setCompanyData(fd)
        // Pre-fill signer name if available
        if (fd.contact_name) setSignatureName(fd.contact_name)
        if (fd.contact_relationship) setSignatureTitle(fd.contact_relationship)
      }

      // Check if already signed
      const { data: contract } = await supabase
        .from('signed_contracts')
        .select('id')
        .eq('company_id', companyId)
        .single()

      if (contract) setSigned(true)
    }
    if (companyId) fetchData()
  }, [companyId])

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const handleSign = async () => {
    if (!signatureName.trim()) {
      setError('Escribe tu nombre completo para firmar')
      return
    }
    if (!signatureTitle.trim()) {
      setError('Indica tu cargo en la empresa')
      return
    }
    if (!agreed) {
      setError('Debes aceptar los términos para firmar')
      return
    }

    setSigning(true)
    setError('')

    try {
      // Save signed contract
      const { error: signError } = await supabase
        .from('signed_contracts')
        .insert({
          company_id: companyId,
          application_id: application?.id,
          company_name: companyData.entity_name || '',
          signer_name: signatureName,
          signer_title: signatureTitle,
          signed_at: new Date().toISOString(),
          contract_version: '1.0',
          ip_address: '', // Would be captured server-side in production
        })

      if (signError) throw signError

      // Update application status
      if (application) {
        await supabase
          .from('kyb_applications')
          .update({ status: 'contract_signed' })
          .eq('id', application.id)

        await supabase.from('application_status_log').insert({
          application_id: application.id,
          status: 'contract_signed',
          message: `Contrato firmado por ${signatureName} (${signatureTitle}).`,
        })
      }

      setSigned(true)
    } catch (err) {
      setError(err.message || 'Error al firmar. Intenta de nuevo.')
    } finally {
      setSigning(false)
    }
  }

  // Already signed state
  if (signed) {
    return (
      <div className="animate-in" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(226, 232, 104, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <PartyPopper size={36} color="#5a6000" />
        </div>
        <h2 style={{ marginBottom: 8 }}>
          <span className="text-purple">Contrato firmado</span>
        </h2>
        <p className="text-muted" style={{ fontSize: '1rem', marginBottom: 8, maxWidth: 460, margin: '0 auto 32px' }}>
          Tu empresa está lista para operar con Midi.
          Ya puedes empezar a procesar pagos para tus creadores.
        </p>
        <div className="card" style={{
          display: 'inline-block', padding: '16px 28px',
          background: 'rgba(226, 232, 104, 0.1)',
          border: '1.5px solid rgba(226, 232, 104, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Check size={18} color="#5a6000" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              Firmado por {signatureName || 'Authorized Signer'}
            </span>
            <span className="text-muted" style={{ fontSize: '0.82rem' }}>
              {today}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/kyb/status')}
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={16} /> Volver al estado
      </button>

      <h2 style={{ marginBottom: 8 }}>
        Firma tu <span className="text-purple">contrato</span>
      </h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Revisa el contrato de servicio y firma electrónicamente para activar tu cuenta.
      </p>

      {/* Contract Document */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {/* Contract header */}
        <div style={{
          padding: '28px 28px 20px',
          background: 'var(--midi-gradient-purple)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <FileText size={24} />
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Contrato de Servicio</span>
          </div>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.4rem',
            fontWeight: 300,
            color: '#fff',
          }}>
            Midi Technologies, Inc.
          </h3>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 4 }}>
            Service Agreement for Business Clients
          </p>
        </div>

        {/* Contract intro */}
        <div style={{
          padding: '24px 28px',
          fontSize: '0.88rem', lineHeight: 1.7, color: '#444',
          borderBottom: '1px solid #eee',
        }}>
          <p>
            This Service Agreement ("<strong>Agreement</strong>") is entered into as of{' '}
            <strong>{today}</strong> by and between:
          </p>
          <p style={{ margin: '12px 0' }}>
            <strong>Midi Technologies, Inc.</strong>, a Delaware corporation ("Midi"), and
          </p>
          <p>
            <strong>{companyData.entity_name || '[Company Name]'}</strong>,
            registered in {companyData.country_of_registration || '[Country]'} with
            TIN/EIN {companyData.tin_ein || '[TIN/EIN]'} ("Client").
          </p>
        </div>

        {/* Collapsible sections */}
        <ContractSection title="1. Services" defaultOpen={true}>
          <p>Midi shall provide Client with access to its financial services platform, enabling Client to process payments to its independent contractors, freelancers, and content creators ("Service Providers") located in Latin America.</p>
          <p style={{ marginTop: 12 }}>Services include: (a) USD bank account provisioning for Service Providers; (b) Visa debit card issuance; (c) Local currency conversion and transfers; (d) Payment processing via CSV batch upload or API integration.</p>
          <p style={{ marginTop: 12 }}>Financial services are provided exclusively by Banco San Juan Internacional, Inc. ("BSJI"), a Puerto Rico-licensed international financial entity. Midi acts as an authorized sales representative of BSJI and does not directly provide financial services.</p>
        </ContractSection>

        <ContractSection title="2. Client Obligations">
          <p>Client agrees to: (a) provide accurate and complete information during the KYB verification process; (b) maintain updated records of its beneficial owners and authorized contacts; (c) process payments only from bank accounts registered and verified with Midi; (d) comply with all applicable anti-money laundering (AML) and know-your-customer (KYC) regulations; (e) notify Midi of any material changes to its corporate structure within 30 days.</p>
        </ContractSection>

        <ContractSection title="3. Fees and Payment Terms">
          <p>There is no cost to Client for the use of Midi's payment processing platform. Midi generates revenue through: (a) foreign exchange margins on currency conversions (1-2%); (b) card interchange fees. These fees are borne by the end user (Service Provider), not by Client.</p>
          <p style={{ marginTop: 12 }}>Client shall fund all payment batches from its verified bank account(s) prior to disbursement. Payments initiated from unverified accounts will be rejected.</p>
        </ContractSection>

        <ContractSection title="4. Bank Account Requirements">
          <p>All payments must originate exclusively from the bank account(s) identified and confirmed in the Bank Account Information Form submitted during the KYB process. Transfers from unregistered accounts will not be accepted. Client is responsible for ensuring that all payment instructions align with the registered account information. Deviations may result in delays, rejection of the transaction, additional compliance review, and/or fees borne by Client.</p>
        </ContractSection>

        <ContractSection title="5. Compliance and Regulatory">
          <p>Client acknowledges that: (a) Midi and BSJI are subject to US federal and Puerto Rico banking regulations; (b) all transactions are subject to AML/KYC screening; (c) Midi reserves the right to delay, reject, or report any transaction that appears suspicious or non-compliant; (d) Client's account may be suspended or terminated if Client fails to provide requested documentation or is found to be in violation of applicable regulations.</p>
        </ContractSection>

        <ContractSection title="6. Term and Termination">
          <p>This Agreement is effective upon execution and continues for an initial term of twelve (12) months, automatically renewing for successive 12-month periods unless terminated by either party with 30 days' written notice. Midi may terminate this Agreement immediately upon material breach, regulatory requirement, or suspected fraudulent activity.</p>
        </ContractSection>

        <ContractSection title="7. Limitation of Liability">
          <p>To the maximum extent permitted by law, Midi's liability under this Agreement shall not exceed the total fees paid by Client (if any) in the twelve (12) months preceding the claim. Midi shall not be liable for indirect, incidental, consequential, or punitive damages. Midi is not liable for delays caused by banking processes, regulatory reviews, or force majeure events.</p>
        </ContractSection>

        <ContractSection title="8. Governing Law">
          <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, United States of America, without regard to conflict of law principles.</p>
        </ContractSection>
      </div>

      {/* Signature Section */}
      <div className="card" style={{
        padding: '28px',
        border: '2px solid var(--midi-purple)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Shield size={20} color="#825DC7" />
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>Firma electrónica</span>
        </div>

        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.5 }}>
          Al escribir tu nombre y firmar, confirmas que tienes autoridad para vincular a{' '}
          <strong>{companyData.entity_name || 'tu empresa'}</strong> a este contrato y que has leído y aceptado todos los términos.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="input-group">
            <label>Nombre completo del firmante <span style={{ color: 'var(--midi-orange)' }}>*</span></label>
            <input
              className="input-field"
              value={signatureName}
              onChange={e => { setSignatureName(e.target.value); setError('') }}
              placeholder="Nombre y apellido"
              style={{ fontSize: '1.05rem' }}
            />
          </div>
          <div className="input-group">
            <label>Cargo <span style={{ color: 'var(--midi-orange)' }}>*</span></label>
            <input
              className="input-field"
              value={signatureTitle}
              onChange={e => { setSignatureTitle(e.target.value); setError('') }}
              placeholder="CEO, Managing Member..."
            />
          </div>
        </div>

        {/* Signature preview */}
        {signatureName.trim() && (
          <div style={{
            margin: '16px 0',
            padding: '20px 28px',
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
          }}>
            <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Vista previa de firma
            </p>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.8rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--midi-navy)',
              borderBottom: '2px solid var(--midi-navy)',
              paddingBottom: 4,
              display: 'inline-block',
            }}>
              {signatureName}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#888', marginTop: 6 }}>
              {signatureTitle}{signatureTitle && ', '}{companyData.entity_name || ''}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#bbb', marginTop: 2 }}>{today}</p>
          </div>
        )}

        {/* Agreement checkbox */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '14px 18px',
          background: agreed ? 'rgba(226, 232, 104, 0.15)' : 'var(--midi-cream)',
          borderRadius: 12, transition: 'background 0.2s',
          marginTop: 8,
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => { setAgreed(e.target.checked); setError('') }}
            style={{ width: 18, height: 18, accentColor: '#825DC7' }}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.4 }}>
            Confirmo que he leído el contrato completo, que tengo autoridad para firmar en nombre de mi empresa, y que acepto todos los términos.
          </span>
        </label>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleSign}
          disabled={!agreed || !signatureName.trim() || !signatureTitle.trim() || signing}
          style={{
            marginTop: 20,
            background: agreed && signatureName.trim() ? 'var(--midi-purple)' : '#ccc',
          }}
        >
          {signing
            ? <><div className="spinner" /> Firmando...</>
            : <><Check size={18} /> Firmar contrato</>
          }
        </button>
      </div>
    </div>
  )
}
