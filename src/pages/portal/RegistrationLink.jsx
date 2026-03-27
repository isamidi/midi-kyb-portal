import React, { useState, useEffect } from 'react'
import { useAuth } from '../../App'
import { supabase } from '../../lib/supabaseClient'
import { Link2, Copy, Check, RefreshCw } from 'lucide-react'

export default function RegistrationLink() {
  const { company } = useAuth()
  const [code, setCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { if (!company?.id) return; loadCode() }, [company?.id])

  const loadCode = async () => {
    try {
      const { data } = await supabase.from('companies').select('company_code').eq('id', company.id).single()
      setCode(data?.company_code || null)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const name = (company?.name || 'MIDI').toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6)
      const newCode = name + '-' + new Date().getFullYear()
      await supabase.from('companies').update({ company_code: newCode }).eq('id', company.id)
      setCode(newCode)
    } catch (err) { console.error(err) } finally { setGenerating(false) }
  }

  const url = code ? 'https://midi-kyb-portal.netlify.app/join/' + code : null

  const copyLink = async () => {
    if (!url) return; await navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className='spinner spinner-purple' style={{ width: 32, height: 32 }} /></div>

  return (
    <div className='animate-in'>
      <h2 style={{ marginBottom: 4 }}>Link de Registro</h2>
      <p className='text-muted' style={{ marginBottom: 24 }}>Comparte este link para que personas se registren directamente.</p>
      <div className='card'>
        {code ? (<>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>CODIGO DE EMPRESA</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--midi-purple-light)', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: '1.2rem', color: 'var(--midi-purple)', letterSpacing: '0.05em' }}>{code}</div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>LINK DE REGISTRO</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f7fc', border: '1px solid #e0dce8', borderRadius: 12, padding: '12px 16px' }}>
              <Link2 size={16} color='#825DC7' />
              <code style={{ flex: 1, fontSize: '0.85rem', color: 'var(--midi-navy)', wordBreak: 'break-all' }}>{url}</code>
              <button onClick={copyLink} style={{ background: copied ? 'rgba(226,232,104,0.3)' : 'var(--midi-purple)', color: copied ? '#5a6000' : '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </button>
            </div>
          </div>
          <div style={{ background: 'var(--midi-cream)', borderRadius: 12, padding: 20 }}>
            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12 }}>Como funciona?</p>
            {['Comparte el link con tus contratistas o creators.', 'Ellos completan su registro con sus datos.', 'Aparecen automaticamente en tu lista de personas.', 'Ya puedes enviarles pagos a traves de Midi.'].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--midi-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>{s}</span>
              </div>
            ))}
          </div>
          <button className='btn btn-outline btn-sm mt-3' onClick={generate} disabled={generating}><RefreshCw size={14} className={generating ? 'spinning' : ''} /> Regenerar codigo</button>
        </>) : (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <Link2 size={48} color='#d0cbe0' style={{ marginBottom: 16 }} />
            <h3 style={{ marginBottom: 8 }}>Genera tu link de registro</h3>
            <p className='text-muted' style={{ marginBottom: 20 }}>Crea un codigo unico para tu empresa.</p>
            <button className='btn btn-primary' onClick={generate} disabled={generating}><Link2 size={18} /> Generar codigo</button>
          </div>
        )}
      </div>
    </div>
  )
}
