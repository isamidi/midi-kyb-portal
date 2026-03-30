import React, { useState } from 'react'
import { useAuth } from '../App'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserPlus, Link2, CreditCard,
  History, Settings, LogOut, Menu, X, ChevronRight
} from 'lucide-react'
import KYBProgressBanner from './KYBProgressBanner'

const NAV_ITEMS = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/portal/personas', label: 'Mis Personas', icon: Users },
  { path: '/portal/agregar', label: 'Agregar Personas', icon: UserPlus },
  { path: '/portal/pagos', label: 'Pagos', icon: CreditCard },
  { path: '/portal/historial', label: 'Historial', icon: History },
  { path: '/portal/link', label: 'Link de Registro', icon: Link2 },
  { path: '/portal/ajustes', label: 'Ajustes', icon: Settings },
]

export default function PortalLayout() {
  const { user, signOut, company } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path
    return location.pathname.startsWith(item.path)
  }

  return (
    <div className="portal-wrapper">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="portal-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`portal-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="portal-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#825DC7" />
              <text x="50" y="65" textAnchor="middle" fill="#fff"
                fontFamily="Cormorant Garamond, serif" fontWeight="600" fontSize="42">
                M
              </text>
            </svg>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                Midi for Business
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Portal Empresarial
              </div>
            </div>
          </div>
          <button className="portal-sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Company info */}
        <div className="portal-company-badge">
          <div className="portal-company-avatar">
            {company?.name?.charAt(0) || 'E'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
              {company?.name || 'Mi Empresa'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
              {company?.role === 'owner' ? 'Administrador' : company?.role || 'Admin'}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="portal-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <button
                key={item.path}
                className={`portal-nav-item ${active ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setSidebarOpen(false) }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="portal-sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            {user?.email}
          </div>
          <button
            className="portal-nav-item"
            onClick={() => { signOut(); navigate('/') }}
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="portal-main">
        {/* Mobile header */}
        <header className="portal-mobile-header">
          <button className="portal-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 500 }}>
            Midi for Business
          </span>
          <div style={{ width: 32 }} />
        </header>

        <KYBProgressBanner />
        <main className="portal-content">
          <Outlet />
        </main>

        <footer style={{ textAlign: 'center', padding: '20px', fontSize: '0.75rem', color: '#aaa' }}>
          Midi Technologies Inc. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
