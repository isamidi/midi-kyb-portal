import React, { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabaseClient'
import { CheckCircle, Clock, FileText, Shield, PenTool, AlertTriangle, Users, X } from 'lucide-react'

const STEPS = [
  { key: 'documents', label: 'Documentos', icon: FileText },
  { key: 'compliance', label: 'Compliance', icon: Shield },
  { key: 'contract', label: 'Contrato', icon: PenTool },
  { key: 'active', label: 'Activo', icon: CheckCircle },
]

function getStepStatus(applicationStatus) {
  switch (applicationStatus) {
    case 'submitted':
    case 'in_review':
      return {
        currentStep: 1,
        stepStates: ['completed', 'active', 'pending', 'pending'],
        phase: 'review',
      }
    case 'approved':
      return {
        currentStep: 2,
        stepStates: ['completed', 'completed', 'active', 'pending'],
        phase: 'contract',
      }
    case 'contract_signed':
      return {
        currentStep: 3,
        stepStates: ['completed', 'completed', 'completed', 'completed'],
        phase: 'complete',
      }
    default:
      return {
        currentStep: 0,
        stepStates: ['active', 'pending', 'pending', 'pending'],
        phase: 'documents',
      }
  }
}

export default function KYBProgressBanner() {
  const { applicationStatus, company } = useAuth()
  const [complianceIssue, setComplianceIssue] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  // Don't show banner if fully active (contract_signed)
  if (applicationStatus === 'contract_signed' || dismissed) {
    return null
  }

  const { currentStep, stepStates, phase } = getStepStatus(applicationStatus)
  const progressPct = (stepStates.filter(s => s === 'completed').length / STEPS.length) * 100

  return (
    <div style={styles.bannerWrapper}>
      {/* Progress bar */}
      <div style={styles.banner}>
        <div style={styles.bannerTop}>
          <div style={styles.bannerTitle}>
            <Clock size={16} color="#825DC7" />
            <span>Proceso KYB en curso</span>
          </div>
        </div>

        {/* Steps */}
        <div style={styles.stepsContainer}>
          {STEPS.map((step, idx) => {
            const state = stepStates[idx]
            const Icon = step.icon
            const isLast = idx === STEPS.length - 1
            return (
              <div key={step.key} style={styles.stepRow}>
                <div style={{
                  ...styles.stepCircle,
                  ...(state === 'completed' ? styles.stepCompleted : {}),
                  ...(state === 'active' ? styles.stepActive : {}),
                  ...(state === 'pending' ? styles.stepPending : {}),
                }}>
                  {state === 'completed' ? (
                    <CheckCircle size={14} color="#fff" />
                  ) : (
                    <Icon size={14} color={state === 'active' ? '#825DC7' : '#ccc'} />
                  )}
                </div>
                <span style={{
                  ...styles.stepLabel,
                  color: state === 'completed' ? '#2E7D32' : state === 'active' ? '#825DC7' : '#aaa',
                  fontWeight: state === 'active' ? 700 : state === 'completed' ? 600 : 400,
                }}>
                  {step.label}
                </span>
                {!isLast && (
                  <div style={{
                    ...styles.stepLine,
                    backgroundColor: state === 'completed' ? '#825DC7' : '#e8e8e8',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar visual */}
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Compliance issue warning (yellow) */}
      {complianceIssue && (
        <div style={styles.warningBanner}>
          <AlertTriangle size={16} color="#E8A838" />
          <span>{complianceIssue}</span>
        </div>
      )}

      {/* Main message based on phase */}
      <div style={styles.messageBanner}>
        {phase === 'review' && (
          <>
            <div style={styles.messageIcon}>
              <Users size={18} color="#825DC7" />
            </div>
            <div style={styles.messageContent}>
              <p style={styles.messageTitle}>
                Empieza a invitar a tu equipo mientras revisamos tu solicitud
              </p>
              <p style={styles.messageText}>
                Puedes agregar personas manualmente o subir un CSV con tu lista.
                El primer pago se habilitara una vez que se firme el contrato.
              </p>
            </div>
          </>
        )}
        {phase === 'contract' && (
          <>
            <div style={styles.messageIcon}>
              <PenTool size={18} color="#825DC7" />
            </div>
            <div style={styles.messageContent}>
              <p style={styles.messageTitle}>
                Tu solicitud fue aprobada. Firma el contrato para activar pagos.
              </p>
              <p style={styles.messageText}>
                Puedes seguir agregando personas. Los pagos se habilitaran cuando firmes el contrato de servicio.
              </p>
              <a href="/kyb/contract" style={styles.contractLink}>
                Ir a firmar contrato →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  bannerWrapper: {
    padding: '0 32px',
    marginBottom: 0,
  },
  banner: {
    background: 'linear-gradient(135deg, rgba(130, 93, 199, 0.04) 0%, rgba(226, 232, 104, 0.06) 100%)',
    border: '1px solid rgba(130, 93, 199, 0.15)',
    borderRadius: '14px',
    padding: '20px 24px',
    marginTop: '20px',
  },
  bannerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  bannerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 700,
    color: '#26213F',
  },
  stepsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
    marginBottom: '14px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  stepCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepCompleted: {
    backgroundColor: '#825DC7',
  },
  stepActive: {
    backgroundColor: 'rgba(130, 93, 199, 0.12)',
    border: '2px solid #825DC7',
  },
  stepPending: {
    backgroundColor: '#f5f5f5',
    border: '2px solid #e8e8e8',
  },
  stepLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  stepLine: {
    flex: 1,
    height: '2px',
    marginLeft: '6px',
    marginRight: '6px',
    borderRadius: '1px',
  },
  progressTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: '#f0f0f0',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#825DC7',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: '#FFF8E1',
    border: '1px solid #FFE082',
    borderRadius: '10px',
    marginTop: '10px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#5D4200',
  },
  messageBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(130, 93, 199, 0.12)',
    borderRadius: '12px',
    marginTop: '10px',
  },
  messageIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'rgba(130, 93, 199, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageContent: {
    flex: 1,
  },
  messageTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 700,
    color: '#26213F',
    margin: '0 0 4px 0',
  },
  messageText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#666',
    margin: 0,
    lineHeight: '1.5',
  },
  contractLink: {
    display: 'inline-block',
    marginTop: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    color: '#825DC7',
    textDecoration: 'none',
  },
}
