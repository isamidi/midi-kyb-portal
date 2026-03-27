import React, { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Check, AlertCircle, Users } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import InviteModal from './InviteModal'

const BASE_STEPS = [
  { path: '/kyb/upload', label: 'Documentos', num: 1 },
  { path: '/kyb/form', label: 'Formulario', num: 2 },
  { path: '/kyb/review', label: 'Revisión', num: 3 },
  { path: '/kyb/status', label: 'Estado', num: 4 },
  { path: '/kyb/contract', label: 'Contrato', num: 5 },
  ]

export default function Layout({ children }) {
    const { user, signOut, company } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [appStatus, setAppStatus] = useState(null)
    const [teamModalOpen, setTeamModalOpen] = useState(false)

  // Fetch application status for dynamic progress bar
  useEffect(() => {
        if (!company?.id) return
        const fetchStatus = async () => {
                const { data } = await supabase
                  .from('kyb_applications')
                  .select('status')
                  .eq('company_id', company.id)
                  .single()
                if (data) setAppStatus(data.status)
        }
        fetchStatus()

                // Real-time updates
                const channel = supabase
          .channel('layout-status')
          .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'kyb_applications',
                    filter: `company_id=eq.${company.id}`,
          }, (payload) => {
                    setAppStatus(payload.new.status)
          })
          .subscribe()

                return () => supabase.removeChannel(channel)
  }, [company?.id])

  // Dynamic steps based on status
  const isDocsMissing = appStatus === 'documents_missing'
    const isApprovedOrSigned = appStatus === 'approved' || appStatus === 'contract_signed'

  const STEPS = BASE_STEPS.map((step, i) => {
        if (i === 3 && isDocsMissing) {
                return { ...step, label: 'Docs Faltantes', alert: true }
        }
        if (i === 4 && isApprovedOrSigned) {
                return { ...step, label: 'Firma de Contrato' }
        }
        return step
  })

  const currentStepIndex = STEPS.findIndex(s => location.pathname.startsWith(s.path))

  return (
        <div className="page-wrapper">
          {/* Top nav */}
              <header style={{
                  background: '#fff',
                  borderBottom: '1px solid #eee',
                  padding: '14px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
        }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <svg width="32" height="32" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="48" fill="#825DC7" />
                                            <text x="50" y="65" textAnchor="middle" fill="#fff"
                                                            fontFamily="Cormorant Garamond, serif" fontWeight="600" fontSize="42">
                                                          M
                                            </text>text>
                                </svg>svg>
                                <span style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '1.3rem',
                      fontWeight: 500,
                      color: 'var(--midi-navy)',
        }}>
                                            Midi for Business
                                </span>span>
                      </div>div>
              
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: '0.85rem', color: '#888' }}>
                                  {user?.email}
                                </span>span>
                                <button
                                              onClick={() => setTeamModalOpen(true)}
                                              style={{
                                                              background: 'none',
                                                              border: 'none',
                                                              color: '#888',
                                                              cursor: 'pointer',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: 4,
                                                              fontSize: '0.85rem',
                                                              padding: '6px 10px',
                                                              borderRadius: 8,
                                              }}
                                              onMouseEnter={e => e.target.style.color = 'var(--midi-purple)'}
                                              onMouseLeave={e => e.target.style.color = '#888'}
                                              title="Equipo"
                                            >
                                            <Users size={16} />
                                            Equipo
                                </button>button>
                                <button
                                              onClick={() => { signOut(); navigate('/') }}
                                              style={{
                                                              background: 'none',
                                                              border: 'none',
                                                              color: '#888',
                                                              cursor: 'pointer',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: 4,
                                                              fontSize: '0.85rem',
                                                              padding: '6px 10px',
                                                              borderRadius: 8,
                                              }}
                                              onMouseEnter={e => e.target.style.color = 'var(--midi-purple)'}
                                              onMouseLeave={e => e.target.style.color = '#888'}
                                            >
                                            <LogOut size={16} />
                                            Salir
                                </button>button>
                      </div>div>
              </header>header>
        
          {/* Progress bar */}
              <div style={{
                  background: '#fff',
                  padding: '16px 24px',
                  borderBottom: '1px solid #eee',
        }}>
                      <div className="container">
                                <div className="progress-tracker">
                                  {STEPS.map((step, i) => {
                        const isCompleted = i < currentStepIndex
                                        const isActive = i === currentStepIndex
                                                        const isAlert = step.alert && (isActive || i === 3)
                                                                        return (
                                                                                          <div
                                                                                                              key={step.path}
                                                                                                              className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isAlert ? 'alert' : ''}`}
                                                                                                            >
                                                                                                            <div className="step-circle" style={isAlert ? {
                                                                                                                                  background: '#e74c3c',
                                                                                                                                  borderColor: '#e74c3c',
                                                                                                                                  color: '#fff',
                                                                                                                                  animation: 'pulse-red 2s infinite',
                                                                                                              } : undefined}>
                                                                                                              {isCompleted ? <Check size={18} /> : isAlert ? <AlertCircle size={16} /> : step.num}
                                                                                                              </div>div>
                                                                                                            <span className="step-label" style={isAlert ? { color: '#e74c3c', fontWeight: 600 } : undefined}>
                                                                                                              {step.label}
                                                                                                              </span>span>
                                                                                            </div>div>
                                                                                        )
                                  })}
                                </div>div>
                      </div>div>
              </div>div>
        
          {/* Content */}
              <main style={{ flex: 1, padding: '40px 24px' }}>
                      <div className="container" style={{ maxWidth: 720 }}>
                        {children}
                      </div>div>
              </main>main>
        
          {/* Footer */}
              <footer style={{
                  textAlign: 'center',
                  padding: '20px',
                  fontSize: '0.8rem',
                  color: '#aaa',
        }}>
                      Midi Technologies Inc. All rights reserved.
              </footer>footer>
        
          {/* Team Modal */}
              <InviteModal
                        companyId={company?.id}
                        userRole={company?.role}
                        isOpen={teamModalOpen}
                        onClose={() => setTeamModalOpen(false)}
                      />
        </div>div>
      )
}</div>
