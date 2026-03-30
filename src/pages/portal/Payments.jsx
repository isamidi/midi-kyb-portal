import React, { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabaseClient'
import { CreditCard, Clock, Check, AlertCircle, RefreshCw, Zap, Search, Lock } from 'lucide-react'

export default function Payments() {
  const { company, applicationStatus } = useAuth()
  const isPaymentBlocked = applicationStatus !== 'contract_signed'
  const [tab, setTab] = useState('new') // new | history
  const [personas, setPersonas] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPersons, setSelectedPersons] = useState([])
  const [paymentType, setPaymentType] = useState('one_time')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [recurring, setRecurring] = useState('monthly')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!company?.id) return
    loadData()
  }, [company?.id])

  const loadData = async () => {
    try {
      const [personsRes, paymentsRes] = await Promise.all([
        supabase.from('personas').select('id, full_name, email, type, sub_code')
          .eq('company_id', company.id).eq('status', 'active'),
        supabase.from('payments').select('*, personas(full_name, email)')
          .eq('company_id', company.id).order('created_at', { ascending: false }).limit(50),
      ])
      setPersonas(personsRes.data || [])
      setPayments(paymentsRes.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const togglePerson = (id) => {
    setSelectedPersons(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSendPayment = async () => {
    if (!selectedPersons.length || !amount) return
    setSending(true)
    setSuccess(null)

    try {
      const inserts = selectedPersons.map(personId => ({
        company_id: company.id,
        person_id: personId,
        amount: parseFloat(amount),
        currency: 'USD',
        type: paymentType,
        recurring_interval: paymentType === 'recurring' ? recurring : null,
        note: note || null,
        status: 'pending',
      }))

      const { error } = await supabase.from('payments').insert(inserts)
      if (error) throw error

      setSuccess(`${inserts.length} pago(s) creado(s) exitosamente.`)
      setSelectedPersons([])
      setAmount('')
      setNote('')
      loadData()
    } catch (err) {
      console.error('Error creating payments:', err)
    } finally {
      setSending(false)
    }
  }

  const filteredPersonas = personas.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return (
    <div className="animate-in">
      <h2 style={{ marginBottom: 4 }}>Pagos</h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Gestiona pagos a tus contratistas, creators y freelancers.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button className={`portal-tab ${tab === 'new' ? 'active' : ''}`}
          onClick={() => setTab('new')}>
          <Zap size={16} /> Nuevo Pago
        </button>
        <button className={`portal-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}>
          <Clock size={16} /> Historial
        </button>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <Check size={18} /> {success}
        </div>
      )}

      {/* New Payment */}
      {tab === 'new' && isPaymentBlocked && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: 'rgba(130, 93, 199, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Lock size={28} color="#825DC7" />
          </div>
          <h3 style={{ marginBottom: 8, color: '#26213F' }}>Pagos bloqueados</h3>
          <p className="text-muted" style={{ marginBottom: 16, maxWidth: 380, margin: '0 auto 16px' }}>
            Para realizar pagos, primero debes completar el proceso KYB y firmar el contrato de servicio con Midi.
          </p>
          {applicationStatus === 'approved' && (
            <a href="/kyb/contract" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', backgroundColor: '#825DC7', color: '#FFFDF1',
              borderRadius: 10, fontWeight: 600, fontSize: '0.875rem',
              textDecoration: 'none', fontFamily: "'DM Sans', sans-serif",
            }}>
              Firmar contrato →
            </a>
          )}
          {(applicationStatus === 'submitted' || applicationStatus === 'in_review') && (
            <p style={{ fontSize: '0.8rem', color: '#999', marginTop: 8 }}>
              Tu solicitud esta en revision. Te notificaremos cuando puedas firmar el contrato.
            </p>
          )}
        </div>
      )}

      {tab === 'new' && !isPaymentBlocked && (
        <div className="card">
          {/* Payment type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={`portal-toggle ${paymentType === 'one_time' ? 'active' : ''}`}
              onClick={() => setPaymentType('one_time')}
            >
              <Zap size={14} /> Pago único
            </button>
            <button
              className={`portal-toggle ${paymentType === 'recurring' ? 'active' : ''}`}
              onClick={() => setPaymentType('recurring')}
            >
              <RefreshCw size={14} /> Recurrente
            </button>
          </div>

          {/* Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: paymentType === 'recurring' ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div className="input-group">
              <label>Monto (USD)</label>
              <input className="input-field" type="number" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            {paymentType === 'recurring' && (
              <div className="input-group">
                <label>Frecuencia</label>
                <select className="input-field" value={recurring}
                  onChange={e => setRecurring(e.target.value)}>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Nota (opcional)</label>
            <input className="input-field" placeholder="Concepto del pago..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* Person selector */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 500, fontSize: '0.875rem', display: 'block', marginBottom: 8 }}>
              Seleccionar personas ({selectedPersons.length} seleccionada{selectedPersons.length !== 1 ? 's' : ''})
            </label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
              <input className="input-field" placeholder="Buscar persona..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }} />
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e0dce8', borderRadius: 12 }}>
              {filteredPersonas.map(p => (
                <label key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  background: selectedPersons.includes(p.id) ? 'rgba(130,93,199,0.06)' : 'transparent',
                  borderBottom: '1px solid #f5f3fa',
                }}>
                  <input type="checkbox" checked={selectedPersons.includes(p.id)}
                    onChange={() => togglePerson(p.id)}
                    style={{ accentColor: '#825DC7' }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{p.full_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{p.email}</div>
                  </div>
                </label>
              ))}
              {filteredPersonas.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                  No se encontraron personas.
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-full mt-3" onClick={handleSendPayment}
            disabled={sending || !selectedPersons.length || !amount}>
            {sending
              ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Procesando...</>
              : <><CreditCard size={18} /> Enviar {selectedPersons.length > 0 ? `${selectedPersons.length} pago(s)` : 'pago'}</>
            }
          </button>
        </div>
      )}

      {/* Payment History */}
      {tab === 'history' && (
        <div>
          {payments.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Monto</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(pay => (
                    <tr key={pay.id}>
                      <td style={{ fontWeight: 500 }}>
                        {pay.personas?.full_name || 'Persona'}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        ${parseFloat(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', padding: '3px 8px', borderRadius: 8,
                          background: pay.type === 'recurring' ? 'rgba(130,93,199,0.1)' : 'rgba(226,232,104,0.2)',
                          color: pay.type === 'recurring' ? '#825DC7' : '#5a6000',
                          fontWeight: 600,
                        }}>
                          {pay.type === 'recurring' ? 'Recurrente' : 'Único'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${pay.status === 'completed' ? 'approved' : pay.status === 'pending' ? 'pending' : 'missing'}`}>
                          {pay.status === 'completed' ? 'Completado' : pay.status === 'pending' ? 'Pendiente' : pay.status}
                        </span>
                      </td>
                      <td style={{ color: '#888', fontSize: '0.85rem' }}>
                        {new Date(pay.created_at).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <CreditCard size={48} color="#d0cbe0" style={{ marginBottom: 16 }} />
              <h3 style={{ marginBottom: 8 }}>Sin pagos todavía</h3>
              <p className="text-muted">
                Los pagos que realices aparecerán aquí.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
