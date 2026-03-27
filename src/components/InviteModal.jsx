import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Plus, Mail, UserCheck, Clock, AlertCircle } from 'lucide-react'

export default function InviteModal({ companyId, userRole, isOpen, onClose }) {
    const [teamMembers, setTeamMembers] = useState([])
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

  // Load team members
  useEffect(() => {
        if (!isOpen || !companyId) return
        loadTeamMembers()
  }, [isOpen, companyId])

  const loadTeamMembers = async () => {
        setLoading(true)
        try {
                const { data: members } = await supabase
                  .from('company_users')
                  .select('id, user_id, email, role, status, created_at')
                  .eq('company_id', companyId)
                  .order('created_at', { ascending: true })

          setTeamMembers(members || [])
        } catch (err) {
                console.error('Error loading team members:', err)
                setError('Error cargando equipo')
        } finally {
                setLoading(false)
        }
  }

  const handleInvite = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!email.trim()) {
                setError('Ingresa un correo electrónico')
                return
        }

        // Check if already invited
        if (teamMembers.some(m => m.email === email)) {
                setError('Este usuario ya está en el equipo')
                return
        }

        setSending(true)

        try {
                const { error: insertError } = await supabase
                  .from('company_users')
                  .insert({
                              company_id: companyId,
                              email: email,
                              role: 'member',
                              status: 'invited',
                              invited_by: (await supabase.auth.getUser()).data.user.id,
                  })

          if (insertError) throw insertError

          setSuccess(`Invitación enviada a ${email}`)
                setEmail('')
                setTimeout(() => {
                          setSuccess('')
                          loadTeamMembers()
                }, 2000)
        } catch (err) {
                setError(err.message || 'Error enviando invitación')
        } finally {
                setSending(false)
        }
  }

  const getStatusLabel = (status) => {
        switch (status) {
          case 'active':
                    return <span style={{ color: '#5a6000', fontSize: '0.75rem', fontWeight: 600 }}>ACTIVO</span>
                      case 'invited':
                    return <span style={{ color: '#F5812B', fontSize: '0.75rem', fontWeight: 600 }}>INVITADO</span>
                      default:
                    return status
        }
  }

  if (!isOpen) return null

  return (
        <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
        }}>
                <div className="card" style={{
                  width: '100%',
                  maxWidth: 500,
                  maxHeight: '90vh',
                  overflow: 'auto',
                  padding: 0,
        }}>
                  {/* Header */}
                          <div style={{
                    padding: '24px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
        }}>
                                      <h3 style={{
                      margin: 0,
                      fontSize: '1.2rem',
                      fontFamily: "'Cormorant Garamond', serif",
                      color: 'var(--midi-navy)',
        }}>
                                                    Equipo
                                      </h3>
                                      <button
                                                    onClick={onClose}
                                                    style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#aaa',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    padding: 4,
                                                    }}
                                                  >
                                                  <X size={20} />
                                      </button>
                          </div>
                
                  {/* Content */}
                        <div style={{ padding: '24px' }}>
                          {/* Current team members */}
                          {teamMembers.length > 0 && (
                      <div style={{ marginBottom: 28 }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--midi-navy)' }}>
                                                    Miembros del equipo ({teamMembers.length})
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {teamMembers.map((member) => (
                                          <div
                                                                key={member.id}
                                                                style={{
                                                                                        padding: '12px 14px',
                                                                                        background: member.status === 'active' ? '#f9f8fc' : '#fef9f9',
                                                                                        borderRadius: 10,
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'space-between',
                                                                                        gap: 12,
                                                                                        border: `1px solid ${member.status === 'active' ? '#e0dce8' : '#fde8e8'}`,
                                                                }}
                                                              >
                                                              <div style={{ flex: 1 }}>
                                                                                    <div style={{
                                                                                        fontSize: '0.9rem',
                                                                                        fontWeight: 500,
                                                                                        color: 'var(--midi-navy)',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: 6,
                                                              }}>
                                                                                      {member.status === 'active' ? (
                                                                                          <UserCheck size={14} color="#5a6000" />
                                                                                        ) : (
                                                                                          <Clock size={14} color="#F5812B" />
                                                                                        )}
                                                                                      {member.email}
                                                                                      </div>
                                                                                    <div style={{
                                                                                        fontSize: '0.75rem',
                                                                                        color: '#888',
                                                                                        marginTop: 2,
                                                                                        textTransform: 'capitalize',
                                                              }}>
                                                                                      {member.role}
                                                                                      </div>
                                                              </div>
                                            {getStatusLabel(member.status)}
                                          </div>
                                        ))}
                                    </div>
                      </div>
                                  )}
                        
                          {/* Invite section - only show if user is admin */}
                          {userRole === 'admin' && (
                      <div>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--midi-navy)' }}>
                                                    Invitar miembro
                                    </h4>
                      
                                    <form onSubmit={handleInvite} style={{
                                        padding: '16px',
                                        background: 'var(--midi-cream)',
                                        borderRadius: 12,
                                        border: '1.5px solid rgba(130, 93, 199, 0.1)',
                      }}>
                                                    <div style={{
                                          display: 'flex',
                                          gap: 8,
                                          marginBottom: 12,
                      }}>
                                                                      <input
                                                                                            type="email"
                                                                                            value={email}
                                                                                            onChange={e => { setEmail(e.target.value); setError(''); setSuccess(''); }}
                                                                                            placeholder="correo@empresa.com"
                                                                                            className="input-field"
                                                                                            style={{ flex: 1, margin: 0 }}
                                                                                          />
                                                                      <button
                                                                                            type="submit"
                                                                                            disabled={sending || !email.trim()}
                                                                                            style={{
                                                                                                                    padding: '8px 16px',
                                                                                                                    background: 'var(--midi-purple)',
                                                                                                                    color: '#fff',
                                                                                                                    border: 'none',
                                                                                                                    borderRadius: 8,
                                                                                                                    cursor: 'pointer',
                                                                                                                    fontWeight: 600,
                                                                                                                    fontSize: '0.85rem',
                                                                                                                    display: 'flex',
                                                                                                                    alignItems: 'center',
                                                                                                                    gap: 6,
                                                                                                                    transition: 'opacity 0.2s',
                                                                                                                    opacity: sending || !email.trim() ? 0.6 : 1,
                                                                                              }}
                                                                                          >
                                                                        {sending ? (
                                                                                                                  <><div className="spinner" style={{ width: 14, height: 14 }} /> Enviando...</>
                                                                                                                ) : (
                                                                                                                  <><Plus size={16} /> Invitar</>
                                                                                                                )}
                                                                      </button>
                                                    </div>
                                    
                                      {error && (
                                          <div style={{
                                                                fontSize: '0.8rem',
                                                                color: '#e74c3c',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                          }}>
                                                              <AlertCircle size={14} />
                                            {error}
                                          </div>
                                                    )}
                                    
                                      {success && (
                                          <div style={{
                                                                fontSize: '0.8rem',
                                                                color: '#5a6000',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                          }}>
                                                              <Mail size={14} />
                                            {success}
                                          </div>
                                                    )}
                                    </form>
                      
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: '#888',
                                        marginTop: 12,
                                        lineHeight: 1.4,
                      }}>
                                                    Los miembros invitados recibirán un correo para unirse al equipo.
                                                    Solo los administradores pueden invitar nuevos miembros.
                                    </p>
                      </div>
                                  )}
                        
                          {!userRole || userRole !== 'admin' && teamMembers.length === 0 && (
                      <div style={{
                                      textAlign: 'center',
                                      padding: '20px 0',
                                      color: '#888',
                      }}>
                                    <p style={{ fontSize: '0.9rem' }}>No hay miembros del equipo aún</p>
                                    <p style={{ fontSize: '0.8rem' }}>Solo administradores pueden invitar miembros</p>
                      </div>
                                  )}
                        </div>
                </div>
        </div>
      )
}
