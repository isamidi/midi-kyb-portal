import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Create admin context to share user data with child components
export const AdminContext = React.createContext(null);

// Inline SVG Icons
const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="12" y="2" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="12" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="12" y="12" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const PeopleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 18C2 15.2386 4.46005 13 7 13C9.53995 13 12 15.2386 12 18" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M14 18C14 15.5 15.5 13.5 18 13" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="2" height="6" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="7" width="2" height="10" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="15" y="4" width="2" height="13" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 2V1M10 19V18M18 10H19M1 10H2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13.6 4.6L14.2 3.4M6.4 15.4L5.8 16.6M15.4 13.6L16.6 14.2M4.6 6.4L3.4 5.8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 16H2V2H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 5L16 10L11 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const navItems = [
  {
    path: '/admin/pipeline',
    label: 'Pipeline KYB',
    icon: GridIcon,
  },
  {
    path: '/admin/empresas',
    label: 'Empresas Activas',
    icon: PeopleIcon,
  },
  {
    path: '/admin/metricas',
    label: 'Metricas',
    icon: ChartIcon,
  },
  {
    path: '/admin/config',
    label: 'Configuracion',
    icon: GearIcon,
  },
];

const AdminLayout = () => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchAdminUser = async () => {
      try {
        setLoading(true);

        // Get current auth user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          setError('No authenticated user');
          navigate('/login');
          return;
        }

        // Fetch admin user from admin_users table
        const { data, error: fetchError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError || !data) {
          setError('Access denied. You are not an admin user.');
          setLoading(false);
          return;
        }

        setAdminUser(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching admin user:', err);
        setError('Error loading admin user');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
          Loading admin panel...
        </p>
      </div>
    );
  }

  if (error || !adminUser) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorContent}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#26213F', marginBottom: '16px' }}>
            Access Denied
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#666', marginBottom: '24px' }}>
            {error || 'You do not have permission to access the admin panel.'}
          </p>
          <button
            onClick={() => navigate('/')}
            style={styles.errorButton}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={adminUser}>
      <div style={styles.container}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          {/* Logo Section */}
          <div style={styles.logoSection}>
            <Link to="/admin" style={styles.logoLink}>
              <h1 style={styles.logo}>Midi</h1>
            </Link>
            <p style={styles.panelLabel}>Admin Panel</p>
          </div>

          {/* Navigation */}
          <nav style={styles.nav}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  }}
                >
                  <span style={styles.navIcon}>
                    <Icon />
                  </span>
                  <span style={styles.navLabel}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div style={styles.userSection}>
            <div style={styles.userInfo}>
              <div style={styles.avatarPlaceholder}>
                {adminUser.full_name ? adminUser.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div style={styles.userDetails}>
                <p style={styles.userName}>{adminUser.full_name || 'Admin User'}</p>
                <div style={styles.roleContainer}>
                  <span style={styles.roleBadge}>
                    {adminUser.role || 'admin'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={styles.logoutButton}
              title="Cerrar sesion"
            >
              <LogoutIcon />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main style={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </AdminContext.Provider>
  );
};

// Inline styles
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#FFFDF1',
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '240px',
    height: '100vh',
    backgroundColor: '#26213F',
    display: 'flex',
    flexDirection: 'column',
    color: '#FFFDF1',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  logoSection: {
    padding: '24px 20px',
    borderBottom: '1px solid rgba(226, 232, 104, 0.2)',
    textAlign: 'center',
  },
  logoLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#E2E868',
    letterSpacing: '1px',
  },
  panelLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '500',
    margin: 0,
    color: '#825DC7',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    gap: '8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    color: 'rgba(255, 253, 241, 0.7)',
    textDecoration: 'none',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    marginLeft: 0,
  },
  navItemActive: {
    backgroundColor: 'rgba(226, 232, 104, 0.1)',
    color: '#E2E868',
    borderLeftColor: '#E2E868',
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'inherit',
  },
  navLabel: {
    flex: 1,
  },
  userSection: {
    padding: '20px',
    borderTop: '1px solid rgba(226, 232, 104, 0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatarPlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#825DC7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#FFFDF1',
    flexShrink: 0,
  },
  userDetails: {
    minWidth: 0,
    flex: 1,
  },
  userName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    margin: 0,
    color: '#FFFDF1',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleContainer: {
    marginTop: '4px',
  },
  roleBadge: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    padding: '2px 8px',
    backgroundColor: '#F5812B',
    color: '#FFFDF1',
    borderRadius: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'inline-block',
  },
  logoutButton: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(226, 232, 104, 0.1)',
    color: '#E2E868',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  mainContent: {
    flex: 1,
    marginLeft: '240px',
    height: '100vh',
    overflowY: 'auto',
    backgroundColor: '#FFFDF1',
    padding: '40px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#FFFDF1',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #825DC7',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#FFFDF1',
    padding: '20px',
  },
  errorContent: {
    textAlign: 'center',
    maxWidth: '400px',
  },
  errorButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '12px 32px',
    backgroundColor: '#26213F',
    color: '#FFFDF1',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default AdminLayout;
