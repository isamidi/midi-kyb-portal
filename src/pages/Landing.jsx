import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, CheckCircle, Clock, Sparkles } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="page-wrapper">
      <header style={{ padding: '20px 0', borderBottom: '1px solid #e0dce8' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#825DC7', fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Midi</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>Iniciar Sesión</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>Comenzar</button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <section className="container" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center', maxWidth: 720 }}>
          <div className="animate-in">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(130,93,199,0.08)', padding: '8px 16px', borderRadius: 20, marginBottom: 24, fontSize: '0.85rem', color: '#825DC7', fontWeight: 600 }}>
              <Sparkles size={16} /> Verificación KYB simplificada
            </div>
            <h1 style={{ marginBottom: 20 }}>Abre tu cuenta empresarial<br /><span style={{ color: '#825DC7' }}>en minutos, no semanas</span></h1>
            <p style={{ fontSize: '1.15rem', color: '#7a7590', maxWidth: 560, margin: '0 auto 32px' }}>
              Completa el proceso Know Your Business con asistencia de IA que extrae datos de tus documentos automáticamente.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
              Iniciar Verificación <ArrowRight size={20} />
            </button>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, maxWidth: 900, margin: '0 auto' }}>
            {[
              { icon: <Shield size={28} color="#825DC7" />, title: 'Seguro y Encriptado', desc: 'Tus documentos están protegidos con encriptación de grado bancario.' },
              { icon: <Sparkles size={28} color="#825DC7" />, title: 'Extracción con IA', desc: 'Nuestra IA lee tus documentos y pre-llena el formulario automáticamente.' },
              { icon: <Clock size={28} color="#825DC7" />, title: 'Aprobación Rápida', desc: 'Proceso optimizado para que tengas tu cuenta lista lo antes posible.' },
              { icon: <CheckCircle size={28} color="#825DC7" />, title: 'Todo en un Solo Lugar', desc: 'Sube documentos, firma contratos y da seguimiento desde un portal.' }
            ].map((f, i) => (
              <div key={i} className="card" style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{f.title}</h3>
                <p style={{ color: '#7a7590', fontSize: '0.9rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={{ padding: '24px 0', borderTop: '1px solid #e0dce8', textAlign: 'center' }}>
        <p style={{ color: '#7a7590', fontSize: '0.85rem' }}>Midi Technologies Inc. — Fintech para creadores.</p>
      </footer>
    </div>
  )
}
