import React, { useState, useEffect, useContext } from 'react';
import { AdminContext } from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabaseClient';

const EmpresasActivas = () => {
  const adminUser = useContext(AdminContext);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 27)); // March 27, 2026
  const [data, setData] = useState(null);
  const [previousMonthData, setPreviousMonthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const colors = {
    purple: '#825DC7',
    navy: '#26213F',
    lime: '#E2E868',
    orange: '#F5812B',
    cream: '#FFFDF1',
    positive: '#22c55e',
    negative: '#e53935',
    neutral: '#9a92a8',
    white: '#ffffff',
    lightGray: '#f5f5f5',
    darkText: '#2a2a2a',
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Helper function to get avatar initials
  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  // Fetch data for current month
  useEffect(() => {
    fetchMonthData(currentDate);
    fetchMonthData(getPreviousMonth(currentDate), true);
  }, [currentDate]);

  const getPreviousMonth = (date) => {
    const prev = new Date(date);
    prev.setMonth(prev.getMonth() - 1);
    return prev;
  };

  const fetchMonthData = async (date, isPrevious = false) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Fetch payment records for the month
      const { data: paymentRecords, error: paymentError } = await supabase
        .from('payment_records')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      if (paymentError) throw paymentError;

      // Get unique company IDs from payment records
      const companyIds = [...new Set(paymentRecords?.map((pr) => pr.company_id) || [])];

      // Fetch company details
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, company_name, email, company_category_id, contract_signed_at, avatar_url')
        .in('id', companyIds.length > 0 ? companyIds : [null]);

      if (companiesError) throw companiesError;

      // Fetch company categories
      const { data: categories, error: categoriesError } = await supabase
        .from('company_categories')
        .select('id, name, color');

      if (categoriesError) throw categoriesError;

      // Fetch all companies for signed count
      const { data: allCompanies, error: allError } = await supabase
        .from('companies')
        .select('id, contract_signed_at');

      if (allError) throw allError;

      // Process data
      const categoryMap = {};
      categories?.forEach((cat) => {
        categoryMap[cat.id] = { name: cat.name, color: cat.color };
      });

      const companyMap = {};
      companies?.forEach((comp) => {
        companyMap[comp.id] = comp;
      });

      // Build company records with payment info
      const companyRecords = paymentRecords?.map((pr) => ({
        ...pr,
        company: companyMap[pr.company_id],
        category: categoryMap[companyMap[pr.company_id]?.company_category_id],
      })) || [];

      // Calculate summary data
      const totalSignedCompanies = (allCompanies || []).filter(
        (c) => c.contract_signed_at !== null
      ).length;

      const totalActivePaid = companyRecords.length;
      const totalActivePaidPercent = totalSignedCompanies > 0
        ? Math.round((totalActivePaid / totalSignedCompanies) * 100)
        : 0;

      const totalVolume = companyRecords.reduce((sum, pr) => sum + (pr.total_amount || 0), 0);
      const totalPersonas = companyRecords.reduce((sum, pr) => sum + (pr.personas_paid || 0), 0);
      const avgFrequency = companyRecords.length > 0
        ? (companyRecords.reduce((sum, pr) => sum + (pr.payment_frequency || 0), 0) / companyRecords.length).toFixed(1)
        : 0;

      // Build category breakdown
      const categoryBreakdown = {};
      companyRecords.forEach((pr) => {
        if (!pr.category) return;
        if (!categoryBreakdown[pr.category.id]) {
          categoryBreakdown[pr.category.id] = {
            id: pr.category.id,
            name: pr.category.name,
            color: pr.category.color || '#999',
            activeCount: 0,
            totalVolume: 0,
            totalPersonas: 0,
            companies: [],
          };
        }
        categoryBreakdown[pr.category.id].activeCount += 1;
        categoryBreakdown[pr.category.id].totalVolume += pr.total_amount || 0;
        categoryBreakdown[pr.category.id].totalPersonas += pr.personas_paid || 0;
        categoryBreakdown[pr.category.id].companies.push(pr);
      });

      const summaryData = {
        year,
        month,
        totalSignedCompanies,
        activeCompaniesCount: totalActivePaid,
        activeCompaniesPercent: totalActivePaidPercent,
        totalVolume,
        totalPersonas,
        avgFrequency,
        companyRecords,
        categoryBreakdown: Object.values(categoryBreakdown),
      };

      if (isPrevious) {
        setPreviousMonthData(summaryData);
      } else {
        setData(summaryData);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching month data:', err);
      setError('Error loading data');
    } finally {
      if (!isPrevious) setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const getPersonasChange = (company) => {
    if (!previousMonthData) return { value: 0, color: colors.neutral };

    const currentPersonas = company.personas_paid || 0;
    const previousRecord = previousMonthData.companyRecords.find(
      (pr) => pr.company_id === company.company_id
    );
    const previousPersonas = previousRecord?.personas_paid || 0;
    const change = currentPersonas - previousPersonas;

    if (change > 0) return { value: change, color: colors.positive };
    if (change < 0) return { value: change, color: colors.negative };
    return { value: 0, color: colors.neutral };
  };

  const getTotalPersonasChange = () => {
    if (!previousMonthData || !data) return { value: 0, color: colors.neutral };
    const change = data.totalPersonas - previousMonthData.totalPersonas;
    if (change > 0) return { value: change, color: colors.positive };
    if (change < 0) return { value: change, color: colors.negative };
    return { value: 0, color: colors.neutral };
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: colors.navy }}>
            Cargando datos...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: 'red' }}>{error}</p>
      </div>
    );
  }

  const monthDisplay = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const personasChange = getTotalPersonasChange();

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.headerContainer}>
        <div>
          <h1 style={styles.pageTitle}>Empresas Activas</h1>
        </div>
        <div style={styles.monthNavigator}>
          <button
            onClick={handlePreviousMonth}
            style={styles.navButton}
            title="Mes anterior"
          >
            â
          </button>
          <span style={styles.monthDisplay}>{monthDisplay}</span>
          <button
            onClick={handleNextMonth}
            style={styles.navButton}
            title="PrÃ³ximo mes"
          >
            â
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardsGrid}>
        {/* Empresas firmadas */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Empresas firmadas</p>
          <p style={styles.cardValue}>{data?.totalSignedCompanies || 0}</p>
        </div>

        {/* Empresas activas */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Empresas activas</p>
          <p style={styles.cardValue}>{data?.activeCompaniesCount || 0}</p>
          <p style={styles.cardSubtitle}>
            {data?.activeCompaniesCount || 0} de {data?.totalSignedCompanies || 0} pagaron{' '}
            {data?.activeCompaniesPercent || 0}%
          </p>
        </div>

        {/* Volumen total pagado */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Volumen total pagado</p>
          <p style={styles.cardValue}>{formatCurrency(data?.totalVolume || 0)}</p>
        </div>

        {/* Personas pagadas */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Personas pagadas</p>
          <p style={styles.cardValue}>{data?.totalPersonas || 0}</p>
        </div>

        {/* Cambio en personas */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Cambio en personas</p>
          <p
            style={{
              ...styles.cardValue,
              color: personasChange.color,
            }}
          >
            {personasChange.value > 0 ? '+' : ''}{personasChange.value}
          </p>
        </div>

        {/* Frecuencia promedio */}
        <div style={styles.summaryCard}>
          <p style={styles.cardLabel}>Frecuencia promedio</p>
          <p style={styles.cardValue}>{data?.avgFrequency || 0}x</p>
          <p style={styles.cardSubtitle}>pagos/mes</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {data?.categoryBreakdown && data.categoryBreakdown.length > 0 && (
        <div>
          <h2 style={styles.sectionTitle}>Desglose por categorÃ­a</h2>
          <div style={styles.categoryCardsGrid}>
            {data.categoryBreakdown.map((category) => (
              <div key={category.id} style={styles.categoryCard}>
                <div style={styles.categoryHeader}>
                  <div
                    style={{
                      ...styles.colorDot,
                      backgroundColor: category.color || colors.purple,
                    }}
                  ></div>
                  <p style={styles.categoryName}>{category.name}</p>
                </div>
                <div style={styles.categoryStats}>
                  <div>
                    <p style={styles.statLabel}>Activas</p>
                    <p style={styles.statValue}>{category.activeCount}</p>
                  </div>
                  <div>
                    <p style={styles.statLabel}>Volumen</p>
                    <p style={styles.statValue}>{formatCurrency(category.totalVolume)}</p>
                  </div>
                  <div>
                    <p style={styles.statLabel}>Personas</p>
                    <p style={styles.statValue}>{category.totalPersonas}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Table */}
      {data?.companyRecords && data.companyRecords.length > 0 && (
        <div>
          <h2 style={styles.sectionTitle}>Detalles por empresa</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Empresa</th>
                  <th style={styles.th}>CategorÃ­a</th>
                  <th style={styles.th}>Monto pagado</th>
                  <th style={styles.th}>Personas</th>
                  <th style={styles.th}>Cambio</th>
                  <th style={styles.th}>Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {data.companyRecords.map((record) => {
                  const personasChange = getPersonasChange(record);
                  return (
                    <tr key={record.id} style={styles.tableRow}>
                      <td style={styles.td}>
                        <div style={styles.companyCell}>
                          <div
                            style={{
                              ...styles.companyAvatar,
                              backgroundColor: record.category?.color || colors.purple,
                            }}
                          >
                            {getInitials(record.company?.company_name)}
                          </div>
                          <div style={styles.companyInfo}>
                            <p style={styles.companyName}>{record.company?.company_name}</p>
                            <p style={styles.companyEmail}>{record.company?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.categoryBadge,
                            backgroundColor: `${record.category?.color || colors.purple}20`,
                            color: record.category?.color || colors.purple,
                          }}
                        >
                          {record.category?.name || 'Sin categorÃ­a'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.amount}>{formatCurrency(record.total_amount || 0)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.personas}>{record.personas_paid || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.change,
                            color: personasChange.color,
                          }}
                        >
                          {personasChange.value > 0 ? '+' : ''}{personasChange.value}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.frequency}>
                          {(record.payment_frequency || 0).toFixed(1)}x / mes
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!data?.companyRecords || data.companyRecords.length === 0) && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No hay datos de empresas activas para este periodo</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  container: {
    padding: '40px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
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
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '36px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
    letterSpacing: '0.5px',
  },
  monthNavigator: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#ffffff',
    padding: '12px 20px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  navButton: {
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '20px',
    color: '#825DC7',
    cursor: 'pointer',
    padding: '4px 8px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  monthDisplay: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#26213F',
    minWidth: '140px',
    textAlign: 'center',
  },  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  cardLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#9a92a8',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '32px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  cardSubtitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#9a92a8',
    margin: 0,
    marginTop: '4px',
  },
  sectionTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '18px',
    fontWeight: '700',
    color: '#26213F',
    margin: '0 0 20px 0',
  },
  categoryCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  colorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  categoryName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  categoryStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  statLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '600',
    color: '#9a92a8',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: '700',
    color: '#26213F',
    margin: '4px 0 0 0',
  },
  tableWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'DM Sans', sans-serif",
  },
  tableHeader: {
    backgroundColor: '#f9f9f9',
    borderBottom: '2px solid rgba(0, 0, 0, 0.08)',
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontWeight: '700',
    fontSize: '13px',
    color: '#26213F',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
    transition: 'background-color 0.2s ease',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
  },
  companyCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  companyAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '12px',
    color: '#ffffff',
    flexShrink: 0,
  },
  companyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  companyName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  companyEmail: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    color: '#9a92a8',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '12px',
  },
  amount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
  },
  personas: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
  },
  change: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
  },
  frequency: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    color: '#26213F',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    padding: '60px 20px',
    borderRadius: '14px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  emptyText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#9a92a8',
    margin: 0,
  },
};

// Add keyframe animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default EmpresasActivas;
