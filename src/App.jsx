import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'

import Register from './pages/Register'
import Login from './pages/Login'
import KYBUpload from './pages/KYBUpload'
import KYBForm from './pages/KYBForm'
import KYBReview from './pages/KYBReview'
import StatusDashboard from './pages/StatusDashboard'
import ContractSign from './pages/ContractSign'
import Layout from './components/Layout'

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

export default function App() {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [kybData, setKybData] = useState({
    documents: [],
    formFields: {},
    applicationId: null,
    status: null,
    companyId: null,
  })

  useEffect(() => {
    // Check active session and load company info
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        // Load company info from company_users junction table
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('companies(*), role')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single()

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
        }
      }

      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCompany(null)
    setKybData({ documents: [], formFields: {}, applicationId: null, status: null, companyId: null })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, company }}>
      <KYBContext.Provider value={{ kybData, setKybData, companyId: company?.id }}>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </KYBContext.Provider>
    </AuthContext.Provider>
  )
}
