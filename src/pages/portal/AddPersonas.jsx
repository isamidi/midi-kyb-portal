import React, { useState } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { UserPlus, Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'

function genCode(name) {
  const p = (name || 'MIDI').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '')
  return p + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function AddPersonas() {
  const { company } = useAuth()
  const [tab, setTab] = useState('manual')
  const [form, setForm] = useState({ full_name: '', email: '', type: 'contractor', country: '', phone: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState(null)

  const handleManual = async (e) => {
    e.preventDefault()
    if (!form.full_name || !form.email) return setError('Nombre y email requeridos.')
    setSaving(true); setError(null); setSuccess(null)
    try {
      const subCode = genCode(company?.name)
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      const { error: err } = await supabase.from('company_persons').insert({
        company_id: company.id, full_name: form.full_name, email: form.email, type: form.type,
        country: form.country || null, phone: form.phone || null, sub_code: subCode, tags, status: 'active'
      })
      if (err) throw err
      setSuccess(form.full_name + ' agregado con codigo ' + subCode)
      setForm({ full_name: '', email: '', type: 'contractor', country: '', phone: '', tags: '' })
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleCsvSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvFile(file); setCsvResult(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const lines = evt.target.result.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(','); const obj = {}
        headers.forEach((h, i) => { obj[h] = vals[i]?.trim() || '' })
        return obj
      }).filter(r => r.full_name || r.email)
      setCsvPreview(rows.slice(0, 5))
    }
    reader.readAsText(file)
  }

  const handleCsvUpload = async () => {
    if (!csvFile) return; setCsvUploading(true); setCsvResult(null)
    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(','); const obj = {}
        headers.forEach((h, i) => { obj[h] = vals[i]?.trim() || '' }); return obj
      }).filter(r => r.full_name || r.email)
      const inserts = rows.map(r => ({ company_id: company.id, full_name: r.full_name || r.nombre || '', email: r.email || '', type: r.type || 'contractor', country: r.country || null, sub_code: genCode(company?.name), tags: r.tags ? r.tags.split(';').map(t => t.trim()) : [], status: 'active' }))
      const { error: err } = await supabase.from('company_persons').insert(inserts)
      if (err) throw err
      setCsvResult({ success: true, count: inserts.length }); setCsvFile(null); setCsvPreview([])
    } catch (err) { setCsvResult({ success: false, message: err.message }) } finally { setCsvUploading(false) }
  }

  return (
    <div className='animate-in'>
      <h2 style={{ marginBottom: 4 }}>Agregar Personas</h2>
      <p className='text-muted' style={{ marginBottom: 24 }}>Agrega contratistas, creators o freelancers.</p>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button className={'portal-tab ' + (tab === 'manual' ? 'active' : '')} onClick={() => setTab('manual')}><UserPlus size={16} /> Manual</button>
        <button className={'portal-tab ' + (tab === 'csv' ? 'active' : '')} onClick={() => setTab('csv')}><FileSpreadsheet size={16} /> CSV Masivo</button>
      </div>
      {success && <div className='alert alert-success' style={{ marginBottom: 16 }}><Check size={18} /> {success}</div>}
      {error && <div className='alert alert-error' style={{ marginBottom: 16 }}><AlertCircle size={18} /> {error}</div>}
      {tab === 'manual' && (
        <form onSubmit={handleManual} className='card'>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className='input-group' style={{ gridColumn: '1 / -1' }}><label>Nombre completo *</label><input className='input-field' placeholder='Maria Lopez' value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div className='input-group'><label>Email *</label><input className='input-field' type='email' placeholder='maria@email.com' value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className='input-group'><label>Tipo</label><select className='input-field' value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value='contractor'>Contratista</option><option value='creator'>Creator</option><option value='freelancer'>Freelancer</option></select></div>
            <div className='input-group'><label>Pais</label><input className='input-field' placeholder='Colombia' value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            <div className='input-group'><label>Telefono</label><input className='input-field' placeholder='+57 300 123 4567' value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className='input-group' style={{ gridColumn: '1 / -1' }}><label>Tags (separados por coma)</label><input className='input-field' placeholder='UGC, Q1 2026, Marketing' value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          </div>
          <button type='submit' className='btn btn-primary btn-full mt-3' disabled={saving}>{saving ? 'Guardando...' : 'Agregar persona'}</button>
        </form>
      )}
      {tab === 'csv' && (
        <div className='card'>
          <p style={{ fontSize: '0.9rem', marginBottom: 16, color: '#666' }}>Sube un CSV con columnas: full_name, email, type, country, phone, tags</p>
          <div className='upload-zone' onClick={() => document.getElementById('csv-input').click()}>
            <input id='csv-input' type='file' accept='.csv' style={{ display: 'none' }} onChange={handleCsvSelect} />
            <Upload size={32} color='#825DC7' style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 500 }}>{csvFile ? csvFile.name : 'Haz clic para seleccionar un CSV'}</p>
          </div>
          {csvPreview.length > 0 && <button className='btn btn-primary btn-full mt-3' onClick={handleCsvUpload} disabled={csvUploading}>{csvUploading ? 'Procesando...' : 'Subir personas'}</button>}
          {csvResult && <div className={'alert ' + (csvResult.success ? 'alert-success' : 'alert-error')} style={{ marginTop: 16 }}>{csvResult.success ? csvResult.count + ' personas agregadas.' : csvResult.message}</div>}
        </div>
      )}
    </div>
  )
}
