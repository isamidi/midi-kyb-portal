import React, { useState, useEffect } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Users, CreditCard, Link2, UserPlus, TrendingUp, Clock, ArrowRight } from 'lucide-react'

export default function PortalDashboard() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalPersonas: 0, activePersonas: 0, pendingInvites: 0, totalPaid: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!company?.id) return; loadDashboard() }, [company?.id])

  const loadDashboard = async () => {
    try {
      const { count: totalPersonas } = await supabase.from('personas').select('*', { count: 'exact', head: true }).eq('company_id', company.id)
      const { count: activePersonas } = await supabase.from('personas').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'active')
      const { count: pendingInvites } = await supabase.from('invitation_codes').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending')
      const { data: payments } = await supabase.from('payments').select('amount').eq('company_id', company.id).eq('status', 'completed')
      const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      setStats({ totalPersonas: totalPersonas || 0, activePersonas: activePersonas || 0, pendingInvites: pendingInvites || 0, totalPaid })
      const { data: recent } = await supabase.from('personas').select('full_name, created_at, type').eq('company_id', company.id).order('created_at', { ascending: false }).limit(5)
      setRecentActivity(recent || [])
    } catch (err) { console.error('Error loading dashboard:', err) } finally { setLoading(false) }
  }

  const statCards = [
    { label: 'Total Personas', value: stats.totalPersonas, icon: Users, color: '#825DC7', bg: 'rgba(130, 93, 199, 0.08)' },
    { label: 'Activas', value: stats.activePersonas, icon: TrendingUp, color: '#5a6000', bg: 'rgba(226, 232, 104, 0.2)' },
    { label: 'Invitaciones Pendientes', value: stats.pendingInvites, icon: Clock, color: '#F5812B', bg: 'rgba(245, 129, 43, 0.1)' },
    { label: 'Total Pagado', value: `$${stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: CreditCard, color: '#26213F', bg: 'rgba(38, 33, 63, 0.06)' },
  ]

  if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-purple" style={{ width: 32, height: 32 }} /></div>)
  }

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 4 }}>Bienvenido, {company?.name || 'Empresa'}</h2>
        <p className="text-muted">Gestiona tu equipo, pagos y personas desde aquí.</p>
      </div>
      <div className="portal-stats-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className="portal-stat-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={22} color={card.color} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--midi-navy)', lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4 }}>{card.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1.2rem' }}>Acciones rápidas</h3>
        <div className="portal-quick-actions">
          <button className="portal-action-card" onClick={() => navigate('/portal/agregar')}><UserPlus size={22} color="#825DC7" /><span>Agregar Personas</span><ArrowRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} /></button>
          <button className="portal-action-card" onClick={() => navigate('/portal/pagos')}><CreditCard size={22} color="#825DC7" /><span>Nuevo Pago</span><ArrowRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} /></button>
          <button className="portal-action-card" onClick={() => navigate('/portal/link')}><Link2 size={22} color="#825DC7" /><span>Link de Registro</span><ArrowRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} /></button>
        </div>
      </div>
      {stats.totalPersonas === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px', marginTop: 24 }}>
          <Users size={48} color="#d0cbe0" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Empieza agregando personas</h3>
          <p className="text-muted" style={{ marginBottom: 20 }}>Agrega contratistas, creators o freelancers para empezar a pagarles a través de Midi.</p>
          <button className="btn btn-primary" onClick={() => navigate('/portal/agregar')}><UserPlus size={18} /> Agregar primera persona</button>
        </div>
      )}
    </div>
  )
}
