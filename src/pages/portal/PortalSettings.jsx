import React, { useState, useEffect } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { Save, Check, Building2 } from 'lucide-react'

export default function PortalSettings() {
  const { company } = useAuth()
  const [form, setForm] = useState({ name: '', industry: '', website: '', country: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => { if (!company?.id) return; load() }, [company?.id])

  const load = async () => {
    try {
      const { data } = await supabase.from('companies').select('name, industry, website, country').eq('id', company.id).single()
      if (data) setForm({ name: data.name || '', industry: data.industry || '', website: data.website || '', country: data.country || '' })
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setSuccess(false)
    try {
      await supabase.from('companies').update({ name: form.name, industry: form.industry || null, website: form.website || null, country: form.country || null }).eq('id', company.id)
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className='spinner spinner-purple' style={{ width: 32, height: 32 }} /></div>

  return (
    <div className='animate-in'>
      <h2 style={{ marginBottom: 4 }}>Ajustes</h2>
      <p className='text-muted' style={{ marginBottom: 24 }}>Configura la informacion de tu empresa.</p>
      {success && <div className='alert alert-success' style={{ marginBottom: 16 }}><Check size={18} /> Cambios guardados.</div>}
      <form onSubmit={handleSave} className='card'>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0eef5' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--midi-purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={24} color='#825DC7' /></div>
          <div><div style={{ fontWeight: 600 }}>Informacion de empresa</div><div style={{ fontSize: '0.8rem', color: '#888' }}>Datos generales</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className='input-group' style={{ gridColumn: '1 / -1' }}><label>Nombre</label><input className='input-field' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className='input-group'><label>Industria</label><input className='input-field' placeholder='Tecnologia...' value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} /></div>
          <div className='input-group'><label>Pais</label><input className='input-field' placeholder='Colombia' value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
          <div className='input-group' style={{ gridColumn: '1 / -1' }}><label>Sitio web</label><input className='input-field' placeholder='https://miempresa.com' value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
        </div>
        <button type='submit' className='btn btn-primary mt-3' disabled={saving}>{saving ? 'Guardando...' : <><Save size={18} /> Guardar cambios</>}</button>
      </form>
    </div>
  )
}
