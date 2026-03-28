import React, { useState, useEffect } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { CreditCard, Clock, Check, RefreshCw, Zap, Search } from 'lucide-react'

export default function Payments() {
  const { company } = useAuth()
  const [tab, setTab] = useState('new')
  const [personas, setPersonas] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [payType, setPayType] = useState('one_time')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [recurring, setRecurring] = useState('monthly')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { if (!company?.id) return; loadData() }, [company?.id])

  const loadData = async () => {
    try {
      const [pRes, payRes] = await Promise.all([
        supabase.from('personas').select('id, full_name, email, type').eq('company_id', company.id).eq('status', 'active'),
        supabase.from('payments').select('*, personas(full_name)').eq('company_id', company.id).order('created_at', { ascending: false }).limit(50),
      ])
      setPersonas(pRes.data || []); setPayments(payRes.data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSend = async () => {
    if (!selected.length || !amount) return; setSending(true); setSuccess(null)
    try {
      const inserts = selected.map(pid => ({ company_id: company.id, person_id: pid, amount: parseFloat(amount), currency: 'USD', type: payType, recurring_interval: payType === 'recurring' ? recurring : null, note: note || null, status: 'pending' }))
      const { error } = await supabase.from('payments').insert(inserts)
      if (error) throw error
      setSuccess(inserts.length + ' pago(s) creado(s).'); setSelected([]); setAmount(''); setNote(''); loadData()
    } catch (err) { console.error(err) } finally { setSending(false) }
  }

  const fp = personas.filter(p => !search || p.full_name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className='spinner spinner-purple' style={{ width: 32, height: 32 }} /></div>

  return (
    <div className='animate-in'>
      <h2 style={{ marginBottom: 4 }}>Pagos</h2>
      <p className='text-muted' style={{ marginBottom: 24 }}>Gestiona pagos a contratistas, creators y freelancers.</p>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button className={'portal-tab ' + (tab === 'new' ? 'active' : '')} onClick={() => setTab('new')}><Zap size={16} /> Nuevo Pago</button>
        <button className={'portal-tab ' + (tab === 'history' ? 'active' : '')} onClick={() => setTab('history')}><Clock size={16} /> Historial</button>
      </div>
      {success && <div className='alert alert-success' style={{ marginBottom: 16 }}><Check size={18} /> {success}</div>}
      {tab === 'new' && (
        <div className='card'>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className={'portal-toggle ' + (payType === 'one_time' ? 'active' : '')} onClick={() => setPayType('one_time')}><Zap size={14} /> Pago unico</button>
            <button className={'portal-toggle ' + (payType === 'recurring' ? 'active' : '')} onClick={() => setPayType('recurring')}><RefreshCw size={14} /> Recurrente</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: payType === 'recurring' ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div className='input-group'><label>Monto (USD)</label><input className='input-field' type='number' placeholder='0.00' value={amount} onChange={e => setAmount(e.target.value)} /></div>
            {payType === 'recurring' && <div className='input-group'><label>Frecuencia</label><select className='input-field' value={recurring} onChange={e => setRecurring(e.target.value)}><option value='weekly'>Semanal</option><option value='biweekly'>Quincenal</option><option value='monthly'>Mensual</option></select></div>}
          </div>
          <div className='input-group'><label>Nota (opcional)</label><input className='input-field' placeholder='Concepto...' value={note} onChange={e => setNote(e.target.value)} /></div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 500, fontSize: '0.875rem', display: 'block', marginBottom: 8 }}>Seleccionar personas ({selected.length})</label>
            <div style={{ position: 'relative', marginBottom: 8 }}><Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} /><input className='input-field' placeholder='Buscar...' value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} /></div>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e0dce8', borderRadius: 12 }}>
              {fp.map(p => (<label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: selected.includes(p.id) ? 'rgba(130,93,199,0.06)' : 'transparent', borderBottom: '1px solid #f5f3fa' }}><input type='checkbox' checked={selected.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: '#825DC7' }} /><div><div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{p.full_name}</div><div style={{ fontSize: '0.7rem', color: '#888' }}>{p.email}</div></div></label>))}
            </div>
          </div>
          <button className='btn btn-primary btn-full mt-3' onClick={handleSend} disabled={sending || !selected.length || !amount}>{sending ? 'Procesando...' : 'Enviar ' + selected.length + ' pago(s)'}</button>
        </div>
      )}
      {tab === 'history' && (
        payments.length > 0 ? (
          <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
            <table className='portal-table'><thead><tr><th>Persona</th><th>Monto</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>{payments.map(pay => (<tr key={pay.id}>
                <td style={{ fontWeight: 500 }}>{pay.personas?.full_name || 'Persona'}</td>
                <td style={{ fontWeight: 600 }}>${parseFloat(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td><span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 8, background: pay.type === 'recurring' ? 'rgba(130,93,199,0.1)' : 'rgba(226,232,104,0.2)', color: pay.type === 'recurring' ? '#825DC7' : '#5a6000', fontWeight: 600 }}>{pay.type === 'recurring' ? 'Recurrente' : 'Unico'}</span></td>
                <td><span className={'status-badge ' + (pay.status === 'completed' ? 'approved' : 'pending')}>{pay.status === 'completed' ? 'Completado' : 'Pendiente'}</span></td>
                <td style={{ color: '#888', fontSize: '0.85rem' }}>{new Date(pay.created_at).toLocaleDateString('es-ES')}</td>
              </tr>))}</tbody></table></div>
        ) : <div className='card' style={{ textAlign: 'center', padding: '48px 32px' }}><CreditCard size={48} color='#d0cbe0' style={{ marginBottom: 16 }} /><h3>Sin pagos todavia</h3></div>
      )}
    </div>
  )
}
