import React, { useState, useEffect } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, CreditCard, Users } from 'lucide-react'

const TYPE_LABELS = {
  contractor: { label: 'Contratista', color: '#825DC7', bg: 'rgba(130,93,199,0.1)' },
  creator: { label: 'Creator', color: '#F5812B', bg: 'rgba(245,129,43,0.1)' },
  freelancer: { label: 'Freelancer', color: '#5a6000', bg: 'rgba(226,232,104,0.25)' },
}
const STATUS_LABELS = {
  active: { label: 'Activo', color: '#5a6000', bg: 'rgba(226,232,104,0.2)' },
  pending: { label: 'Pendiente', color: '#856404', bg: '#fff3cd' },
  inactive: { label: 'Inactivo', color: '#888', bg: '#f0f0f0' },
}

export default function Personas() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [qpPerson, setQpPerson] = useState(null)
  const [qpAmount, setQpAmount] = useState('')

  useEffect(() => { if (!company?.id) return; loadData() }, [company?.id])

  const loadData = async () => {
    try {
      const { data } = await supabase.from('personas').select('*').eq('company_id', company.id).order('created_at', { ascending: false })
      setPersonas(data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const filtered = personas.filter(p => {
    const ms = !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
    return ms && (filterType === 'all' || p.type === filterType)
  })

  const handleQuickPay = async () => {
    if (!qpPerson || !qpAmount) return
    await supabase.from('payments').insert({ company_id: company.id, person_id: qpPerson.id, amount: parseFloat(qpAmount), currency: 'USD', type: 'one_time', status: 'pending' })
    setQpPerson(null); setQpAmount('')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className='spinner spinner-purple' style={{ width: 32, height: 32 }} /></div>

  return (
    <div className='animate-in'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h2 style={{ marginBottom: 4 }}>Mis Personas</h2><p className='text-muted'>{personas.length} personas registradas</p></div>
        <button className='btn btn-primary btn-sm' onClick={() => navigate('/portal/agregar')}><UserPlus size={16} /> Agregar</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className='input-field' placeholder='Buscar por nombre, email...' value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 42, width: '100%' }} />
        </div>
        <select className='input-field' value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 160 }}>
          <option value='all'>Todos</option><option value='contractor'>Contratistas</option><option value='creator'>Creators</option><option value='freelancer'>Freelancers</option>
        </select>
      </div>
      {filtered.length > 0 ? (
        <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
          <table className='portal-table'><thead><tr><th>Persona</th><th>Codigo</th><th>Tipo</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
            <tbody>{filtered.map(person => {
              const ti = TYPE_LABELS[person.type] || TYPE_LABELS.contractor
              const si = STATUS_LABELS[person.status] || STATUS_LABELS.pending
              return (<tr key={person.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--midi-purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--midi-purple)', fontWeight: 600, fontSize: '0.8rem' }}>{person.full_name?.charAt(0)}</div><div><div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{person.full_name}</div><div style={{ fontSize: '0.75rem', color: '#888' }}>{person.email}</div></div></div></td>
                <td><code style={{ fontSize: '0.8rem', background: '#f5f3fa', padding: '3px 8px', borderRadius: 6 }}>{person.sub_code || '-'}</code></td>
                <td><span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 12, color: ti.color, background: ti.bg }}>{ti.label}</span></td>
                <td><span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 12, color: si.color, background: si.bg }}>{si.label}</span></td>
                <td style={{ textAlign: 'right' }}><button className='btn btn-sm btn-secondary' onClick={() => setQpPerson(person)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}><CreditCard size={14} /> Pagar</button></td>
              </tr>)})}
            </tbody></table></div>
      ) : (
        <div className='card' style={{ textAlign: 'center', padding: '48px 32px' }}>
          <Users size={48} color='#d0cbe0' style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>{search ? 'No se encontraron resultados' : 'Sin personas'}</h3>
          {!search && <button className='btn btn-primary' onClick={() => navigate('/portal/agregar')}><UserPlus size={18} /> Agregar personas</button>}
        </div>
      )}
      {qpPerson && (
        <div className='portal-modal-overlay' onClick={() => setQpPerson(null)}>
          <div className='portal-modal' onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Pago rapido a {qpPerson.full_name}</h3>
            <div className='input-group'><label>Monto (USD)</label><input className='input-field' type='number' placeholder='0.00' value={qpAmount} onChange={e => setQpAmount(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className='btn btn-outline btn-sm' onClick={() => setQpPerson(null)} style={{ flex: 1 }}>Cancelar</button>
              <button className='btn btn-primary btn-sm' onClick={handleQuickPay} style={{ flex: 1 }} disabled={!qpAmount}><CreditCard size={16} /> Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
