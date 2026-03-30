import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import Register from './pages/Register'
import Login from './pages/Login'
import VerifyEmail from './pages/VerifyEmail'
import KYBUpload from './pages/KYBUpload'
import KYBForm from './pages/KYBForm'
import KYBReview from './pages/KYBReview'
import StatusDashboard from './pages/StatusDashboard'
import ContractSign from './pages/ContractSign'
import Layout from './components/Layout'
import PortalLayout from './components/PortalLayout'
import PortalDashboard from './pages/portal/PortalDashboard'
import Personas from './pages/portal/Personas'
import AddPersonas from './pages/portal/AddPersonas'
import Payments from './pages/portal/Payments'
import RegistrationLink from './pages/portal/RegistrationLink'
import PortalSettings from './pages/portal/PortalSettings'

// Admin Dashboard
import AdminLayout from './components/admin/AdminLayout'
import PipelineKYB from './pages/admin/PipelineKYB'
import EmpresasActivas from './pages/admin/EmpresasActivas'
import Metricas from './pages/admin/Metricas'
import Configuracion from './pages/admin/Configuracion'

// Auth context
export const AuthContext = createContext(null)
export function useAuth() {
  return useContext(AuthContext)
}

// KYB data context (shared state across KYB steps)
export const KYBContext = createContext(null)
export function useKYB() {
  return useContext(KYBContext)
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Portal route - redirects to KYB if not approved
function PortalRoute({ children }) {
  const { user, loading, applicationStatus } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner-purple" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Allow portal access for submitted, in_review, approved, and contract_signed statuses
  const allowedStatuses = ['submitted', 'in_review', 'approved', 'contract_signed']
  if (!allowedStatuses.includes(applicationStatus)) {
    return <Navigate to="/kyb/upload" replace />
  }

  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applicationStatus, setApplicationStatus] = useState(null)
  const [kybData, setKybData] = useState({
    documents: [],
    formFields: {},
    applicationId: null,
    status: null,
    companyId: null,
  })

  // Extracted function to load company data for a given userId
  const loadCompanyData = async (userId) => {
    try {
      const { data: companyUsers, error: cuError } = await supabase
        .from('company_users')
        .select('companies(*), role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)

      const companyUser = companyUsers?.[0]

      if (cuError) {
        console.error('Error fetching company user:', cuError)
      }

      if (companyUser?.companies) {
        setCompany({
          id: companyUser.companies.id,
          name: companyUser.companies.name,
          role: companyUser.role,
        })
        setKybData(prev => ({
          ...prev,
          companyId: companyUser.companies.id,
        }))

        const { data: apps, error: appError } = await supabase
          .from('kyb_applications')
          .select('status')
          .eq('company_id', companyUser.companies.id)
          .limit(1)

        if (appError) {
          console.error('Error fetching application:', appError)
        }

        const app = apps?.[0]
        if (app) {
          setApplicationStatus(app.status)
        }
      }
    } catch (err) {
      console.error('loadCompanyData error:', err)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadCompanyData(session.user.id)
      }
      setLoading(false)
    })

    // IMPORTANT: This callback must be SYNCHRONOUS.
    // Making it async blocks verifyOtp() from resolving (Supabase internal deadlock).
    // Use fire-and-forget for loadCompanyData instead.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)
      if (newUser) {
        // Fire-and-forget: don't await, don't block the callback
        loadCompanyData(newUser.id).catch(console.error)
      } else {
        setCompany(null)
        setApplicationStatus(null)
        setKybData({
          documents: [],
          formFields: {},
          applicationId: null,
          status: null,
          companyId: null,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCompany(null)
    setApplicationStatus(null)
    setKybData({
      documents: [],
      formFields: {},
      applicationId: null,
      status: null,
      companyId: null,
    })
  }

  const getDefaultRoute = () => {
    const portalStatuses = ['submitted', 'in_review', 'approved', 'contract_signed']
    if (portalStatuses.includes(applicationStatus)) {
      return '/portal'
    }
    return '/kyb/upload'
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signOut, company, applicationStatus, setApplicationStatus }}
    >
      <KYBContext.Provider value={{ kybData, setKybData, companyId: company?.id }}>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* KYB Flow */}
          <Route
            path="/kyb/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="upload" element={<KYBUpload />} />
                    <Route path="form" element={<KYBForm />} />
                    <Route path="review" element={<KYBReview />} />
                    <Route path="status" element={<StatusDashboard />} />
                    <Route path="contract" element={<ContractSign />} />
                    <Route path="*" element={<Navigate to="upload" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Portal Empresarial */}
          <Route
            path="/portal"
            element={
              <PortalRoute>
                <PortalLayout />
              </PortalRoute>
            }
          >
            <Route index element={<PortalDashboard />} />
            <Route path="personas" element={<Personas />} />
            <Route path="agregar" element={<AddPersonas />} />
            <Route path="pagos" element={<Payments />} />
            <Route path="historial" element={<Payments />} />
            <Route path="link" element={<RegistrationLink />} />
            <Route path="ajustes" element={<PortalSettings />} />
          </Route>

          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<PipelineKYB />} />
            <Route path="pipeline" element={<PipelineKYB />} />
            <Route path="empresas" element={<EmpresasActivas />} />
            <Route path="metricas" element={<Metricas />} />
            <Route path="config" element={<Configuracion />} />
          </Route>

          {/* Catch-all */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Navigate to={getDefaultRoute()} replace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </KYBContext.Provider>
    </AuthContext.Provider>
  )
}
