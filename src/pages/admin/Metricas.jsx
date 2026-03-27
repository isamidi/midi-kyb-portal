import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const Metricas = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const colors = {
    purple: '#825DC7',
    navy: '#26213F',
    lime: '#E2E868',
    orange: '#F5812B',
    white: '#ffffff',
    lightGray: '#f5f5f5',
    positive: '#22c55e',
    negative: '#F5812B',
    darkText: '#2a2a2a',
    lightText: '#9a92a8',
    barPurple: '#825DC7',
    barBlue: '#3b82f6',
    barOrange: '#F5812B',
    barGold: '#b8750d',
    barOlive: '#a8b800',
    barGreen: '#22c55e',
    barEmerald: '#10b981',
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const formatCurrencyK = (amount) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const getMonthKeyFromDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch all companies
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, registered_at, contract_signed_at, first_payment_at, stage');

      if (companiesError) throw companiesError;

      // Fetch stage history for timing calculations
      const { data: stageHistory, error: stageHistoryError } = await supabase
        .from('stage_history')
        .select('company_id, from_stage, to_stage, transitioned_at, created_at');

      if (stageHistoryError) throw stageHistoryError;

      // Fetch personas
      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .select('id, status, activated_at');

      if (personasError) throw personasError;

      // Fetch payment records
      const { data: paymentRecords, error: paymentRecordsError } = await supabase
        .from('payment_records')
        .select('total_amount, period_year, period_month');

      if (paymentRecordsError) throw paymentRecordsError;

      // Process data
      const processedData = processMetricsData(companies, stageHistory, personas, paymentRecords);
      setData(processedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics data:', err);
      setError('Error loading metrics');
    } finally {
      setLoading(false);
    }
  };

  const processMetricsData = (companies, stageHistory, personas, paymentRecords) => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // 1. Calculate average time from registro to primer pago (in days)
    let avgDaysToFirstPayment = 0;
    let validPayments = 0;
    companies?.forEach((company) => {
      if (company.first_payment_at && company.registered_at) {
        const registered = new Date(company.registered_at);
        const firstPayment = new Date(company.first_payment_at);
        const days = (firstPayment - registered) / (1000 * 60 * 60 * 24);
        avgDaysToFirstPayment += days;
        validPayments++;
      }
    });
    avgDaysToFirstPayment = validPayments > 0 ? Math.round(avgDaysToFirstPayment / validPayments) : 0;

    // 2. Companies that completed funnel (stage = 'activo')
    const totalCompanies = companies?.length || 0;
    const activoCompanies = companies?.filter((c) => c.stage === 'activo')?.length || 0;
    const funnelCompletionPercent = totalCompanies > 0 ? Math.round((activoCompanies / totalCompanies) * 100) : 0;

    // 3. Total active personas (status = 'cuenta_activa')
    const activePersonas = personas?.filter((p) => p.status === 'cuenta_activa')?.length || 0;

    // 4. Calculate volume for current month (this month)
    const currentMonthKey = getMonthKeyFromDate(currentMonth);
    const currentMonthVolume = paymentRecords
      ?.filter((pr) => {
        const key = `${pr.period_year}-${String(pr.period_month).padStart(2, '0')}`;
        return key === currentMonthKey;
      })
      ?.reduce((sum, pr) => sum + (pr.total_amount || 0), 0) || 0;

    // 5. Build funnel stages
    const funnelData = buildFunnelData(companies);

    // 6. Calculate time per stage
    const stageTimings = calculateStageTimings(stageHistory);

    // 7. Build monthly personas data (last 6 months)
    const monthlyPersonas = buildMonthlyPersonasData(personas, today);

    // 8. Build monthly volume data (last 6 months)
    const monthlyVolume = buildMonthlyVolumeData(paymentRecords, today);

    return {
      avgDaysToFirstPayment,
      funnelCompletionPercent,
      activePersonas,
      currentMonthVolume,
      funnelData,
      stageTimings,
      monthlyPersonas,
      monthlyVolume,
    };
  };

  const buildFunnelData = (companies) => {
    const stages = [
      { id: 'registro', label: 'Registro', color: colors.barPurple, filter: () => true },
      { id: 'documentos', label: 'Documentos', color: colors.barBlue, filter: (c) => c.stage && ['documentos', 'compliance_midi', 'compliance_banco', 'contrato', 'firmadas', 'activo'].includes(c.stage) },
      { id: 'compliance_midi', label: 'Compliance Midi', color: colors.barOrange, filter: (c) => c.stage && ['compliance_midi', 'compliance_banco', 'contrato', 'firmadas', 'activo'].includes(c.stage) },
      { id: 'compliance_banco', label: 'Compliance Banco', color: colors.barGold, filter: (c) => c.stage && ['compliance_banco', 'contrato', 'firmadas', 'activo'].includes(c.stage) },
      { id: 'contrato', label: 'Contrato', color: colors.barOlive, filter: (c) => c.stage && ['contrato', 'firmadas', 'activo'].includes(c.stage) },
      { id: 'firmadas', label: 'Firmadas', color: colors.barGreen, filter: (c) => c.contract_signed_at !== null },
      { id: 'activo', label: 'Activas', color: colors.barEmerald, filter: (c) => c.first_payment_at !== null },
    ];

    const funnelCounts = stages.map((stage) => {
      const count = companies?.filter(stage.filter)?.length || 0;
      return { ...stage, count };
    });

    // Calculate drops between stages
    const funnelWithDrops = funnelCounts.map((stage, index) => {
      const drop = index > 0 ? funnelCounts[index - 1].count - stage.count : 0;
      return { ...stage, drop };
    });

    return funnelWithDrops;
  };

  const calculateStageTimings = (stageHistory) => {
    // Calculate average time spent in each stage
    const stageTimings = [
      { label: 'Registro â Documentos', stages: ['registro', 'documentos'] },
      { label: 'Documentos â Compliance Midi', stages: ['documentos', 'compliance_midi'] },
      { label: 'Compliance Midi â Compliance Banco', stages: ['compliance_midi', 'compliance_banco'] },
      { label: 'Compliance Banco â Contrato', stages: ['compliance_banco', 'contrato'] },
      { label: 'Contrato â Firma', stages: ['contrato', 'firmadas'] },
      { label: 'Firma â Primer pago', stages: ['firmadas', 'activo'] },
    ];

    const timings = stageTimings.map((timing) => {
      const transitions = stageHistory
        ?.filter((sh) => sh.from_stage === timing.stages[0] && sh.to_stage === timing.stages[1])
        ?.map((sh) => {
          const from = new Date(sh.created_at || sh.transitioned_at);
          const to = new Date(sh.transitioned_at);
          return (to - from) / (1000 * 60 * 60 * 24);
        }) || [];

      const avgDays = transitions.length > 0
        ? Math.round(transitions.reduce((a, b) => a + b, 0) / transitions.length)
        : 0;

      return { ...timing, avgDays };
    });

    return timings;
  };

  const buildMonthlyPersonasData = (personas, referenceDate) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      months.push(date);
    }

    const monthlyData = months.map((month) => {
      const yearMonth = getMonthKeyFromDate(month);
      const count = personas
        ?.filter((p) => {
          if (!p.activated_at) return false;
          const pDate = new Date(p.activated_at);
          return getMonthKeyFromDate(pDate) === yearMonth;
        })
        ?.length || 0;

      return {
        month,
        monthKey: yearMonth,
        monthLabel: `${monthNames[month.getMonth()].slice(0, 3)} ${month.getDate() === 1 ? '' : ''}`.trim() || monthNames[month.getMonth()].slice(0, 3),
        count,
        isCurrentMonth: month.getMonth() === referenceDate.getMonth() && month.getFullYear() === referenceDate.getFullYear(),
      };
    });

    return monthlyData;
  };

  const buildMonthlyVolumeData = (paymentRecords, referenceDate) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      months.push(date);
    }

    const monthlyData = months.map((month) => {
      const yearMonth = getMonthKeyFromDate(month);
      const volume = paymentRecords
        ?.filter((pr) => {
          const key = `${pr.period_year}-${String(pr.period_month).padStart(2, '0')}`;
          return key === yearMonth;
        })
        ?.reduce((sum, pr) => sum + (pr.total_amount || 0), 0) || 0;

      return {
        month,
        monthKey: yearMonth,
        monthLabel: `${monthNames[month.getMonth()].slice(0, 3)} ${month.getDate() === 1 ? '' : ''}`.trim() || monthNames[month.getMonth()].slice(0, 3),
        volume,
        isCurrentMonth: month.getMonth() === referenceDate.getMonth() && month.getFullYear() === referenceDate.getFullYear(),
      };
    });

    return monthlyData;
  };

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: colors.navy }}>
            Cargando mÃ©tricas...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageContainer}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: 'red' }}>{error}</p>
      </div>
    );
  }

  // Find max values for chart scaling
  const maxPersonasMonth = Math.max(...(data?.monthlyPersonas?.map((m) => m.count) || [1]));
  const maxVolumeMonth = Math.max(...(data?.monthlyVolume?.map((m) => m.volume) || [1]));
  const maxStageTime = Math.max(...(data?.stageTimings?.map((s) => s.avgDays) || [1]));

  return (
    <div style={styles.pageContainer}>
      {/* Title */}
      <h1 style={styles.pageTitle}>MÃ©tricas de Negocio</h1>

      {/* Top KPI Cards */}
      <div style={styles.kpiGrid}>
        {/* Card 1: Tiempo promedio registro a primer pago */}
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Tiempo promedio registro â primer pago</p>
          <p style={styles.kpiValue}>{data?.avgDaysToFirstPayment || 0}</p>
          <p style={styles.kpiSubtitle}>dÃ­as</p>
        </div>

        {/* Card 2: Empresas que completaron el funnel */}
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Empresas que completaron el funnel</p>
          <p style={styles.kpiValue}>{data?.funnelCompletionPercent || 0}%</p>
          <p style={styles.kpiSubtitle}>de todas las empresas</p>
        </div>

        {/* Card 3: Personas activas totales */}
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Personas activas totales</p>
          <p style={styles.kpiValue}>{data?.activePersonas || 0}</p>
          <p style={styles.kpiSubtitle}>cuentas activas</p>
        </div>

        {/* Card 4: Volumen total este mes */}
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Volumen total este mes</p>
          <p style={styles.kpiValue}>{formatCurrencyK(data?.currentMonthVolume || 0)}</p>
          <p style={styles.kpiSubtitle}>USD</p>
        </div>
      </div>

      {/* Funnel de ConversiÃ³n */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Funnel de ConversiÃ³n</h2>
        <div style={styles.funnelContainer}>
          {data?.funnelData?.map((stage, index) => {
            const maxCount = Math.max(...(data?.funnelData?.map((s) => s.count) || [1]));
            const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

            return (
              <div key={stage.id} style={styles.funnelRow}>
                <div style={styles.funnelBar}>
                  <div
                    style={{
                      ...styles.funnelBarFill,
                      width: `${width}%`,
                      backgroundColor: stage.color,
                    }}
                  ></div>
                </div>
                <div style={styles.funnelInfo}>
                  <p style={styles.stageName}>{stage.label}</p>
                  <p style={styles.stageCount}>
                    {stage.count} <span style={styles.stagePercent}>({Math.round((stage.count / (data?.funnelData?.[0]?.count || 1)) * 100)}%)</span>
                  </p>
                  {stage.drop > 0 && (
                    <p style={styles.stageDrop}>-{stage.drop} empresas</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tiempo Promedio por Etapa */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Tiempo Promedio por Etapa</h2>
        <div style={styles.timingContainer}>
          {data?.stageTimings?.map((timing) => {
            const maxTime = Math.max(...(data?.stageTimings?.map((s) => s.avgDays) || [1]));
            const width = maxTime > 0 ? (timing.avgDays / maxTime) * 100 : 0;
            const isMax = timing.avgDays === maxTime && maxTime > 0;

            return (
              <div key={timing.label} style={styles.timingRow}>
                <p style={styles.timingLabel}>{timing.label}</p>
                <div style={styles.timingBarContainer}>
                  <div
                    style={{
                      ...styles.timingBar,
                      width: `${width}%`,
                      backgroundColor: isMax ? colors.negative : colors.barPurple,
                    }}
                  ></div>
                </div>
                <p style={{
                  ...styles.timingValue,
                  color: isMax ? colors.negative : colors.navy,
                  fontWeight: isMax ? '700' : '600',
                }}>
                  {timing.avgDays} dÃ­as
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Charts Side by Side */}
      <div style={styles.chartsGrid}>
        {/* Left: Personas activas mes a mes */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Personas activas mes a mes</h3>
          <div style={styles.barChartContainer}>
            {data?.monthlyPersonas?.map((month) => {
              const height = maxPersonasMonth > 0 ? (month.count / maxPersonasMonth) * 100 : 0;

              return (
                <div key={month.monthKey} style={styles.barWrapper}>
                  <div style={styles.barValue}>{month.count > 0 ? month.count : '-'}</div>
                  <div
                    style={{
                      ...styles.barChartBar,
                      height: `${Math.max(height, 5)}%`,
                      backgroundColor: month.isCurrentMonth ? colors.barPurple : `${colors.barPurple}60`,
                      borderRadius: '8px 8px 0 0',
                    }}
                  ></div>
                  <p style={styles.barLabel}>{month.monthLabel}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Volumen pagado mes a mes */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Volumen pagado mes a mes (USD)</h3>
          <div style={styles.barChartContainer}>
            {data?.monthlyVolume?.map((month) => {
              const height = maxVolumeMonth > 0 ? (month.volume / maxVolumeMonth) * 100 : 0;

              return (
                <div key={month.monthKey} style={styles.barWrapper}>
                  <div style={styles.barValue}>{month.volume > 0 ? formatCurrencyK(month.volume) : '-'}</div>
                  <div
                    style={{
                      ...styles.barChartBar,
                      height: `${Math.max(height, 5)}%`,
                      backgroundColor: month.isCurrentMonth ? colors.barGreen : `${colors.barGreen}60`,
                      borderRadius: '8px 8px 0 0',
                    }}
                  ></div>
                  <p style={styles.barLabel}>{month.monthLabel}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    padding: '0',
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
  pageTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '36px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
    letterSpacing: '0.5px',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  kpiLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#9a92a8',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '32px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  kpiSubtitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#9a92a8',
    margin: 0,
    marginTop: '4px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '24px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
    letterSpacing: '0.5px',
  },
  funnelContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  funnelRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  funnelBar: {
    flex: 1,
    height: '40px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  funnelBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  funnelInfo: {
    minWidth: '200px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  stageName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  stageCount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    color: '#26213F',
    margin: 0,
  },
  stagePercent: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '400',
    color: '#9a92a8',
  },
  stageDrop: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#e53935',
    margin: 0,
  },
  timingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  timingRow: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr 100px',
    alignItems: 'center',
    gap: '16px',
  },
  timingLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    color: '#26213F',
    margin: 0,
  },
  timingBarContainer: {
    height: '32px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  timingBar: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  timingValue: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    margin: 0,
    textAlign: 'right',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  chartTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  barChartContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    minHeight: '240px',
    justifyContent: 'space-around',
    padding: '12px 0',
  },
  barWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minHeight: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#26213F',
    minHeight: '16px',
    textAlign: 'center',
  },
  barChartBar: {
    width: '100%',
    minHeight: '40px',
    transition: 'all 0.3s ease',
  },
  barLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#9a92a8',
    margin: 0,
    textAlign: 'center',
    minWidth: '60px',
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

export default Metricas;
