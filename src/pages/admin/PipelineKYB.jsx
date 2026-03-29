import React, { useState, useEffect, useContext } from 'react';
import { AdminContext } from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabaseClient';

const PipelineKYB = () => {
  const adminUser = useContext(AdminContext);
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStageFilter, setActiveStageFilter] = useState('Todas');
  const [filterChip, setFilterChip] = useState('Todas');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [stageDropdownCompanyId, setStageDropdownCompanyId] = useState(null);
  const [solicitudes, setSolicitudes] = useState({});
  const [personas, setPersonas] = useState({});
  const [stageHistory, setStageHistory] = useState({});
  const [activityLog, setActivityLog] = useState({});
  const [adminUsers, setAdminUsers] = useState({});
  const [contracts, setContracts] = useState({});

  // Stages definition with Midi brand colors
  const stages = [
    { name: 'Registro', value: 'registro', color: '#f3e5f5', dotColor: '#825DC7' },
    { name: 'Documentos', value: 'documentos', color: '#eef0ff', dotColor: '#6C7AE0' },
    { name: 'Compliance Midi', value: 'compliance_midi', color: '#ffe8d6', dotColor: '#F5812B' },
    { name: 'Compliance Banco', value: 'compliance_banco', color: '#fff3e0', dotColor: '#E8A838' },
    { name: 'Contrato', value: 'contrato', color: '#f1f8e9', dotColor: '#66BB6A' },
    { name: 'Activacion', value: 'activacion', color: '#e8f5e9', dotColor: '#43A047' },
    { name: 'Activo', value: 'activo', color: '#c8e6c9', dotColor: '#2E7D32' },
  ];

  // Stage to KYB application status mapping
  const stageToStatusMap = {
    registro: 'submitted',
    documentos: 'submitted',
    compliance_midi: 'midi_review',
    compliance_banco: 'bank_review',
    contrato: 'approved',
    activacion: 'approved',
    activo: 'approved',
  };

  // Permission mapping
  const getPermittedStages = (role) => {
    const permissions = {
      admin: ['registro', 'documentos', 'compliance_midi', 'compliance_banco', 'contrato', 'activacion', 'activo'],
      ventas: ['registro', 'documentos'],
      compliance_midi: ['compliance_midi'],
      compliance_banco: ['compliance_banco'],
      operaciones: ['contrato', 'activacion', 'activo'],
    };
    return permissions[role] || [];
  };

  useEffect(() => {
    fetchCompanies();
    fetchAdminUsers();
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('companies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        fetchCompanies();
      })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let result = companies;
    if (activeStageFilter !== 'Todas') {
      result = result.filter((c) => c.stage === activeStageFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.contact_email?.toLowerCase().includes(term)
      );
    }
    if (filterChip === 'Con solicitudes') {
      result = result.filter((c) => (solicitudes[c.id]?.count || 0) > 0);
    } else if (filterChip === 'Alertas') {
      result = result.filter((c) => {
        const daysInStage = c.stage_entered_at ? getDaysDifference(c.stage_entered_at) : 0;
        return daysInStage > 14;
      });
    } else if (filterChip === 'Mis empresas') {
      result = result.filter((c) => c.assigned_to === adminUser?.id);
    }
    setFilteredCompanies(result);
  }, [companies, searchTerm, activeStageFilter, filterChip, solicitudes, adminUser]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('registered_at', { ascending: false });
      if (error) throw error;
      setCompanies(data || []);
      fetchSolicitudesAndPersonas(data || []);
      fetchStageHistory(data || []);
      fetchActivityLog(data || []);
      fetchContracts(data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('id, full_name');
      if (error) throw error;
      const usersMap = {};
      data?.forEach((user) => { usersMap[user.id] = user.full_name; });
      setAdminUsers(usersMap);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const fetchSolicitudesAndPersonas = async (companiesList) => {
    try {
      const { data: solData, error: solError } = await supabase
        .from('solicitudes')
        .select('company_id, id')
        .is('resolved_at', null);
      if (!solError && solData) {
        const solMap = {};
        companiesList.forEach((c) => {
          solMap[c.id] = { count: solData.filter((s) => s.company_id === c.id).length };
        });
        setSolicitudes(solMap);
      }
      const { data: perData, error: perError } = await supabase
        .from('personas')
        .select('company_id, id, activated_at');
      if (!perError && perData) {
        const perMap = {};
        companiesList.forEach((c) => {
          const cPersonas = perData.filter((p) => p.company_id === c.id);
          perMap[c.id] = {
            total: cPersonas.length,
            activated: cPersonas.filter((p) => p.activated_at).length,
          };
        });
        setPersonas(perMap);
      }
    } catch (err) {
      console.error('Error fetching solicitudes/personas:', err);
    }
  };

  const fetchStageHistory = async (companiesList) => {
    try {
      const { data, error } = await supabase.from('stage_history').select('*');
      if (error) throw error;
      const historyMap = {};
      companiesList.forEach((c) => {
        historyMap[c.id] = data?.filter((h) => h.company_id === c.id) || [];
      });
      setStageHistory(historyMap);
    } catch (err) {
      console.error('Error fetching stage history:', err);
    }
  };

  const fetchActivityLog = async (companiesList) => {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const logMap = {};
      companiesList.forEach((c) => {
        logMap[c.id] = data?.filter((a) => a.company_id === c.id).slice(0, 10) || [];
      });
      setActivityLog(logMap);
    } catch (err) {
      console.error('Error fetching activity log:', err);
    }
  };

  const fetchContracts = async (companiesList) => {
    try {
      const { data, error } = await supabase
        .from('signed_contracts')
        .select('company_id, signed_at, signer_name');
      if (error) throw error;
      const contractMap = {};
      (data || []).forEach((c) => {
        contractMap[c.company_id] = c;
      });
      setContracts(contractMap);
    } catch (err) {
      console.error('Error fetching contracts:', err);
    }
  };

  const getDaysDifference = (dateString) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 0;
    const now = new Date();
    return Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  };

  const getDayColor = (days) => {
    if (days < 7) return '#6b6580';
    if (days <= 14) return '#F5812B';
    return '#e53935';
  };

  const getStageObj = (stage) => stages.find((s) => s.value === stage);
  const getStageColor = (stage) => getStageObj(stage)?.color || '#f5f5f5';
  const getStageDotColor = (stage) => getStageObj(stage)?.dotColor || '#825DC7';
  const getStageName = (stage) => getStageObj(stage)?.name || stage;

  const getStageCount = (stage) => {
    if (stage === 'Todas') return companies.length;
    return companies.filter((c) => c.stage === stage).length;
  };

  const handleChangeStage = async (companyId, newStage) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ stage: newStage, stage_entered_at: new Date().toISOString() })
        .eq('id', companyId);
      if (error) throw error;

      // Sync kyb_applications status
      const newStatus = stageToStatusMap[newStage];
      if (newStatus) {
        await supabase
          .from('kyb_applications')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('company_id', companyId);
      }

      // Log activity
      await supabase.from('activity_log').insert([{
        company_id: companyId,
        admin_id: adminUser?.id,
        action: `Etapa cambiada a ${getStageName(newStage)}`,
        created_at: new Date().toISOString(),
      }]);

      fetchCompanies();
      setStageDropdownCompanyId(null);
    } catch (err) {
      console.error('Error changing stage:', err);
    }
  };

  const handleCreateCompany = async (formData) => {
    try {
      const { error } = await supabase.from('companies').insert([{
        name: formData.name,
        contact_email: formData.email,
        category_id: formData.category,
        stage: 'registro',
        registered_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      fetchCompanies();
      setShowNewCompanyModal(false);
    } catch (err) {
      console.error('Error creating company:', err);
    }
  };

  const handleOpenCompanyDetail = (company) => {
    setSelectedCompany(company);
    setShowDetailPanel(true);
  };

  const getNextStages = (currentStage) => {
    const i = stages.findIndex((s) => s.value === currentStage);
    if (i === -1 || i === stages.length - 1) return [];
    return [stages[i + 1]];
  };

  const getPreviousStages = (currentStage) => {
    const i = stages.findIndex((s) => s.value === currentStage);
    if (i <= 0) return [];
    return [stages[i - 1]];
  };

  const canChangeStage = (stage) => {
    const permitted = getPermittedStages(adminUser?.role);
    return permitted.includes(stage);
  };

  const handleExport = () => {
    const headers = ['Empresa', 'Email', 'Etapa', 'Vendedor', 'Dias en Etapa', 'Dias Totales', 'Solicitudes', 'Personas', 'Activadas'];
    const rows = filteredCompanies.map((c) => {
      const daysInStage = c.stage_entered_at ? getDaysDifference(c.stage_entered_at) : 0;
      const totalDays = c.registered_at ? getDaysDifference(c.registered_at) : 0;
      const solCount = solicitudes[c.id]?.count || 0;
      const persData = personas[c.id] || { total: 0, activated: 0 };
      return [
        c.name || '',
        c.contact_email || '',
        getStageName(c.stage),
        adminUsers[c.assigned_to] || 'Sin asignar',
        daysInStage,
        totalDays,
        solCount,
        persData.total,
        persData.activated,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-kyb-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setStageDropdownCompanyId(null);
    if (stageDropdownCompanyId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [stageDropdownCompanyId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid #f0f0f0', borderTop: '3px solid #825DC7',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#999', fontSize: '14px' }}>Cargando pipeline...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Pipeline KYB</h1>
          <p style={styles.subtitle}>{companies.length} empresas en el pipeline</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleExport} style={styles.exportButton}>
            <span style={{ fontSize: '15px' }}>&#8615;</span> Export
          </button>
          {(adminUser?.role === 'admin' || adminUser?.role === 'ventas') && (
            <button onClick={() => setShowNewCompanyModal(true)} style={styles.newCompanyButton}>
              + Nueva Empresa
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsBar}>
        {['Todas', ...stages.map((s) => s.value)].map((stage) => {
          const displayName = stage === 'Todas' ? 'Todas' : getStageName(stage);
          const count = getStageCount(stage);
          const isActive = activeStageFilter === stage;
          const dotColor = stage === 'Todas' ? '#825DC7' : getStageDotColor(stage);

          return (
            <button
              key={stage}
              onClick={() => setActiveStageFilter(stage)}
              style={{
                ...styles.statCard,
                ...(isActive ? { borderColor: dotColor, backgroundColor: `${dotColor}08` } : {}),
              }}
            >
              <div style={{ ...styles.statDot, backgroundColor: dotColor }} />
              <div style={styles.statCardContent}>
                <p style={styles.statLabel}>{displayName}</p>
                <p style={styles.statCount}>{count}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search and Filter Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}>&#128269;</span>
          <input
            type="text"
            placeholder="Buscar empresa, contacto o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filterChips}>
          {['Todas', 'Con solicitudes', 'Alertas', 'Mis empresas'].map((chip) => (
            <button
              key={chip}
              onClick={() => setFilterChip(chip)}
              style={{
                ...styles.filterChip,
                ...(filterChip === chip ? styles.filterChipActive : {}),
              }}
            >
              {chip === 'Alertas' && '⚠ '}{chip}
            </button>
          ))}
        </div>
      </div>

      {/* Companies Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={{ ...styles.th, width: '25%' }}>EMPRESA</th>
              <th style={{ ...styles.th, width: '16%' }}>ETAPA</th>
              <th style={{ ...styles.th, width: '13%' }}>VENDEDOR</th>
              <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>DIAS EN ETAPA</th>
              <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>DIAS TOTALES</th>
              <th style={{ ...styles.th, width: '12%', textAlign: 'center' }}>SOLICITUDES</th>
              <th style={{ ...styles.th, width: '14%' }}>ACTIVACION</th>
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '48px 16px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", color: '#999', fontSize: '14px' }}>
                  {searchTerm ? 'No se encontraron empresas con ese filtro' : 'No hay empresas en el pipeline'}
                </td>
              </tr>
            ) : (
              filteredCompanies.map((company, idx) => {
                const daysInStage = company.stage_entered_at ? getDaysDifference(company.stage_entered_at) : 0;
                const totalDays = company.registered_at ? getDaysDifference(company.registered_at) : 0;
                const solCount = solicitudes[company.id]?.count || 0;
                const persData = personas[company.id] || { total: 0, activated: 0 };
                const activationPct = persData.total > 0 ? Math.round((persData.activated / persData.total) * 100) : 0;
                const vendorName = adminUsers[company.assigned_to] || null;
                const vendorInitials = vendorName ? vendorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : null;

                return (
                  <tr
                    key={company.id}
                    onClick={() => handleOpenCompanyDetail(company)}
                    style={{
                      ...styles.tableRow,
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa'; }}
                  >
                    {/* Empresa */}
                    <td style={styles.td}>
                      <div style={styles.companyCell}>
                        <div style={styles.avatar}>
                          {company.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p style={styles.companyName}>{company.name || 'Sin nombre'}</p>
                          <p style={styles.companyEmail}>{company.contact_email || 'Sin email'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Etapa */}
                    <td style={styles.td}>
                      <div style={styles.stageCell}>
                        <span style={{
                          ...styles.stageBadge,
                          backgroundColor: getStageColor(company.stage),
                          borderLeft: `3px solid ${getStageDotColor(company.stage)}`,
                        }}>
                          {getStageName(company.stage)}
                        </span>
                        {canChangeStage(company.stage) && (
                          <div style={styles.stageDropdownContainer}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStageDropdownCompanyId(stageDropdownCompanyId === company.id ? null : company.id);
                              }}
                              style={styles.cambiarBtn}
                            >
                              Cambiar
                            </button>
                            {stageDropdownCompanyId === company.id && (
                              <div style={styles.stageDropdown} onClick={(e) => e.stopPropagation()}>
                                {getNextStages(company.stage).length > 0 && (
                                  <>
                                    <p style={styles.dropdownLabel}>Siguiente</p>
                                    {getNextStages(company.stage).map((stage) => (
                                      <button
                                        key={stage.value}
                                        onClick={(e) => { e.stopPropagation(); handleChangeStage(company.id, stage.value); }}
                                        style={styles.dropdownOption}
                                      >
                                        <span style={{ ...styles.miniDot, backgroundColor: stage.dotColor }} />
                                        {stage.name}
                                      </button>
                                    ))}
                                  </>
                                )}
                                {getPreviousStages(company.stage).length > 0 && (
                                  <>
                                    <p style={styles.dropdownLabel}>Anterior</p>
                                    {getPreviousStages(company.stage).map((stage) => (
                                      <button
                                        key={stage.value}
                                        onClick={(e) => { e.stopPropagation(); handleChangeStage(company.id, stage.value); }}
                                        style={styles.dropdownOption}
                                      >
                                        <span style={{ ...styles.miniDot, backgroundColor: stage.dotColor }} />
                                        {stage.name}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Vendedor */}
                    <td style={styles.td}>
                      {vendorName ? (
                        <div style={styles.vendorCell}>
                          <div style={styles.vendorAvatar}>{vendorInitials}</div>
                          <span style={styles.vendorName}>{vendorName.split(' ')[0]}</span>
                        </div>
                      ) : (
                        <span style={{ ...styles.cellText, color: '#ccc', fontSize: '12px' }}>Sin asignar</span>
                      )}
                    </td>

                    {/* Dias en Etapa */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{
                        ...styles.daysBadge,
                        color: getDayColor(daysInStage),
                        backgroundColor: daysInStage > 14 ? '#fef2f2' : daysInStage > 7 ? '#fff7ed' : 'transparent',
                      }}>
                        {daysInStage}d
                      </span>
                    </td>

                    {/* Dias Totales */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{ ...styles.cellText, fontWeight: '500', color: '#6b6580' }}>
                        {totalDays}d
                      </span>
                    </td>

                    {/* Solicitudes */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {solCount > 0 ? (
                        <span style={styles.solBadge}>
                          {solCount} pendiente{solCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={styles.solNone}>Sin solicitudes</span>
                      )}
                    </td>

                    {/* Activacion */}
                    <td style={styles.td}>
                      {persData.total > 0 ? (
                        <div style={styles.activationCell}>
                          <div style={styles.activationTop}>
                            <span style={styles.activationCount}>{persData.activated} / {persData.total}</span>
                            <span style={styles.activationPct}>{activationPct}%</span>
                          </div>
                          <div style={styles.progressBar}>
                            <div style={{
                              ...styles.progressFill,
                              width: `${activationPct}%`,
                              backgroundColor: activationPct >= 50 ? '#43A047' : activationPct >= 25 ? '#E2E868' : '#F5812B',
                            }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#ccc', fontFamily: "'DM Sans', sans-serif" }}>--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedCompany && (
        <DetailPanel
          company={selectedCompany}
          adminUser={adminUser}
          onClose={() => { setShowDetailPanel(false); setSelectedCompany(null); }}
          stageHistory={stageHistory[selectedCompany.id] || []}
          activityLog={activityLog[selectedCompany.id] || []}
          personas={personas[selectedCompany.id] || { total: 0, activated: 0 }}
          solicitudes={solicitudes[selectedCompany.id]?.count || 0}
          contract={contracts[selectedCompany.id] || null}
          getStageName={getStageName}
          getStageColor={getStageColor}
          getStageDotColor={getStageDotColor}
          getDaysDifference={getDaysDifference}
        />
      )}

      {/* New Company Modal */}
      {showNewCompanyModal && (
        <NewCompanyModal
          onClose={() => setShowNewCompanyModal(false)}
          onCreate={handleCreateCompany}
        />
      )}
    </div>
  );
};

// Detail Panel Component
const DetailPanel = ({
  company, adminUser, onClose, stageHistory, activityLog, personas,
  solicitudes, contract, getStageName, getStageColor, getStageDotColor, getDaysDifference,
}) => {
  const [newSolicitudText, setNewSolicitudText] = useState('');
  const [solicitudesList, setSolicitudesList] = useState([]);
  const [personasList, setPersonasList] = useState([]);

  useEffect(() => {
    fetchSolicitudes();
    fetchPersonas();
  }, [company.id]);

  const fetchSolicitudes = async () => {
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSolicitudesList(data || []);
    } catch (err) {
      console.error('Error fetching solicitudes:', err);
    }
  };

  const fetchPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPersonasList(data || []);
    } catch (err) {
      console.error('Error fetching personas:', err);
    }
  };

  const handleAddSolicitud = async () => {
    if (!newSolicitudText.trim()) return;
    try {
      const { error } = await supabase.from('solicitudes').insert([{
        company_id: company.id,
        description: newSolicitudText,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setNewSolicitudText('');
      fetchSolicitudes();
    } catch (err) {
      console.error('Error adding solicitud:', err);
    }
  };

  const canAddSolicitud = ['compliance_midi', 'compliance_banco'].includes(company.stage) || adminUser?.role === 'admin';
  const daysInStage = company.stage_entered_at ? getDaysDifference(company.stage_entered_at) : 0;
  const totalDays = company.registered_at ? getDaysDifference(company.registered_at) : 0;

  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.detailHeader}>
          <div style={styles.detailCompanyInfo}>
            <div style={styles.detailAvatar}>
              {company.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <h2 style={styles.detailCompanyName}>{company.name}</h2>
              <p style={styles.detailCompanyEmail}>{company.contact_email}</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                  fontFamily: "'DM Sans', sans-serif",
                  backgroundColor: getStageColor(company.stage),
                  borderLeft: `3px solid ${getStageDotColor(company.stage)}`,
                  color: '#26213F',
                }}>
                  {getStageName(company.stage)}
                </span>
                <span style={{ fontSize: '12px', color: '#999', fontFamily: "'DM Sans', sans-serif" }}>
                  {daysInStage}d en etapa / {totalDays}d total
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeButton}>&#10005;</button>
        </div>

        {/* Contract Status */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Contrato</h3>
          {contract ? (
            <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #43A047' }}>
              <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                Firmado
              </p>
              <p style={{ margin: '4px 0 0', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#666' }}>
                Por: {contract.signer_name} / {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          ) : (
            <p style={{ ...styles.placeholderText, color: '#F5812B' }}>Pendiente de firma</p>
          )}
        </div>

        {/* Personas */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Personas ({personasList.length})</h3>
          {personasList.length === 0 ? (
            <p style={styles.placeholderText}>No hay personas registradas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {personasList.map((p) => (
                <div key={p.id} style={{
                  padding: '10px 12px', backgroundColor: '#f8f8f8', borderRadius: '8px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '600', color: '#26213F' }}>
                      {p.full_name || p.email || 'Sin nombre'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#999' }}>
                      {p.email || ''}
                    </p>
                  </div>
                  <span style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                    fontFamily: "'DM Sans', sans-serif",
                    backgroundColor: p.activated_at ? '#e8f5e9' : '#fff3e0',
                    color: p.activated_at ? '#2E7D32' : '#E8A838',
                  }}>
                    {p.activated_at ? 'Activada' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activation Progress */}
        {personas.total > 0 && (
          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Activacion</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#26213F' }}>
                  {personas.activated} / {personas.total} activadas
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700', color: '#825DC7' }}>
                  {personas.total > 0 ? Math.round((personas.activated / personas.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ ...styles.progressBar, height: '8px' }}>
                <div style={{
                  ...styles.progressFill, height: '8px',
                  width: `${personas.total > 0 ? (personas.activated / personas.total) * 100 : 0}%`,
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Timeline</h3>
          {stageHistory.length === 0 ? (
            <p style={styles.placeholderText}>Sin historial de etapas</p>
          ) : (
            <div style={styles.timeline}>
              {stageHistory.map((entry, idx) => (
                <div key={idx} style={styles.timelineEntry}>
                  <div style={{
                    ...styles.timelineDot,
                    backgroundColor: getStageDotColor(entry.stage),
                  }} />
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineStage}>{getStageName(entry.stage)}</p>
                    <p style={styles.timelineDate}>
                      {entry.entered_at ? new Date(entry.entered_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solicitudes */}
        {(canAddSolicitud || solicitudesList.length > 0) && (
          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Solicitudes</h3>
            {canAddSolicitud && (
              <div style={styles.solicitudInput}>
                <input
                  type="text"
                  placeholder="Agregar solicitud..."
                  value={newSolicitudText}
                  onChange={(e) => setNewSolicitudText(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') handleAddSolicitud(); }}
                  style={styles.solicitudField}
                />
                <button onClick={handleAddSolicitud} style={styles.solicitudButton}>Agregar</button>
              </div>
            )}
            {solicitudesList.length === 0 ? (
              <p style={styles.placeholderText}>Sin solicitudes</p>
            ) : (
              <div style={styles.solicitudesList}>
                {solicitudesList.map((sol) => (
                  <div key={sol.id} style={styles.solicitudItem}>
                    <p style={styles.solicitudText}>{sol.description}</p>
                    <p style={styles.solicitudDate}>
                      {sol.created_at ? new Date(sol.created_at).toLocaleDateString() : 'N/A'}
                      {sol.resolved_at && ' (Resuelta)'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Log */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Actividad</h3>
          {activityLog.length === 0 ? (
            <p style={styles.placeholderText}>Sin actividad registrada</p>
          ) : (
            <div style={styles.activityList}>
              {activityLog.map((log, idx) => (
                <div key={idx} style={styles.activityItem}>
                  <p style={styles.activityAction}>{log.action}</p>
                  <p style={styles.activityDate}>
                    {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// New Company Modal Component
const NewCompanyModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({ name: '', email: '', category: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.email) onCreate(formData);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Nueva Empresa</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Nombre de la empresa</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={styles.formInput}
              placeholder="Ej: Acme Corp"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email de contacto</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={styles.formInput}
              placeholder="contacto@empresa.com"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Categoria</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={styles.formInput}
              placeholder="Ej: Agencia, Plataforma..."
            />
          </div>
          <div style={styles.modalButtonGroup}>
            <button type="button" onClick={onClose} style={styles.cancelButton}>Cancelar</button>
            <button type="submit" style={styles.submitButton}>Crear Empresa</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    color: '#26213F',
    maxWidth: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '32px',
    fontWeight: '700',
    margin: 0,
    color: '#26213F',
  },
  subtitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#999',
    margin: '4px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  exportButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    color: '#26213F',
    border: '2px solid #e8e8e8',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  newCompanyButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 20px',
    backgroundColor: '#825DC7',
    color: '#FFFDF1',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '10px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 12px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'DM Sans', sans-serif",
    textAlign: 'left',
  },
  statDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statCardContent: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    margin: 0,
    color: '#999',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statCount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '22px',
    fontWeight: '700',
    margin: '2px 0 0 0',
    color: '#26213F',
  },
  toolbar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchContainer: {
    flex: 1,
    minWidth: '200px',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    color: '#999',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px 10px 38px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  },
  filterChips: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '8px 14px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#666',
    whiteSpace: 'nowrap',
  },
  filterChipActive: {
    backgroundColor: '#825DC7',
    borderColor: '#825DC7',
    color: '#FFFDF1',
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    border: '1px solid #f0f0f0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'DM Sans', sans-serif",
  },
  tableHeaderRow: {
    backgroundColor: '#fafafa',
    borderBottom: '2px solid #f0f0f0',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'DM Sans', sans-serif",
  },
  tableRow: {
    borderBottom: '1px solid #f5f5f5',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '14px 16px',
    fontSize: '13px',
    fontFamily: "'DM Sans', sans-serif",
    verticalAlign: 'middle',
  },
  companyCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#825DC7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFDF1',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0,
  },
  companyName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    margin: 0,
    color: '#26213F',
  },
  companyEmail: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    margin: '2px 0 0 0',
    color: '#999',
  },
  stageCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
  },
  stageBadge: {
    padding: '5px 10px',
    borderRadius: '6px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '600',
    color: '#26213F',
    whiteSpace: 'nowrap',
  },
  cambiarBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#825DC7',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 6px',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'opacity 0.2s ease',
    opacity: 0.7,
  },
  stageDropdownContainer: {
    position: 'relative',
  },
  stageDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e8e8e8',
    borderRadius: '10px',
    minWidth: '160px',
    zIndex: 100,
    marginTop: '4px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    padding: '6px 0',
  },
  dropdownLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '10px',
    fontWeight: '700',
    margin: '8px 14px 4px 14px',
    color: '#bbb',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dropdownOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 14px',
    backgroundColor: 'transparent',
    border: 'none',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#26213F',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
    boxSizing: 'border-box',
  },
  miniDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  vendorCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  vendorAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#E2E868',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#26213F',
    fontWeight: '700',
    fontSize: '10px',
    flexShrink: 0,
  },
  vendorName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '500',
    color: '#26213F',
  },
  cellText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: 0,
    color: '#26213F',
  },
  daysBadge: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  solBadge: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '20px',
    backgroundColor: '#fef2f2',
    color: '#e53935',
    whiteSpace: 'nowrap',
  },
  solNone: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    color: '#ccc',
  },
  activationCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '100px',
  },
  activationTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activationCount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#26213F',
  },
  activationPct: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '700',
    color: '#825DC7',
  },
  progressBar: {
    width: '100%',
    height: '5px',
    backgroundColor: '#f0f0f0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#825DC7',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  // Detail Panel
  detailOverlay: {
    position: 'fixed',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  detailPanel: {
    width: '440px',
    height: '100vh',
    backgroundColor: '#FFFDF1',
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  detailHeader: {
    padding: '24px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    backgroundColor: '#ffffff',
  },
  detailCompanyInfo: {
    display: 'flex',
    gap: '14px',
    flex: 1,
  },
  detailAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#825DC7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFDF1',
    fontWeight: '700',
    fontSize: '18px',
    flexShrink: 0,
  },
  detailCompanyName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: '#26213F',
  },
  detailCompanyEmail: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: '2px 0 0 0',
    color: '#999',
  },
  closeButton: {
    backgroundColor: '#f5f5f5',
    border: 'none',
    fontSize: '16px',
    color: '#999',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  detailSection: {
    padding: '20px 24px',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '700',
    margin: '0 0 14px 0',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  timelineEntry: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  timelineDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineStage: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    margin: 0,
    color: '#26213F',
  },
  timelineDate: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    margin: 0,
    color: '#999',
  },
  solicitudInput: {
    display: 'flex',
    gap: '8px',
    marginBottom: '14px',
  },
  solicitudField: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  solicitudButton: {
    padding: '8px 16px',
    backgroundColor: '#825DC7',
    color: '#FFFDF1',
    border: 'none',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  solicitudesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  solicitudItem: {
    padding: '10px 12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '8px',
  },
  solicitudText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: 0,
    color: '#26213F',
  },
  solicitudDate: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    margin: '4px 0 0 0',
    color: '#999',
  },
  placeholderText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#ccc',
    margin: 0,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  activityItem: {
    padding: '10px 12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '8px',
  },
  activityAction: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    margin: 0,
    color: '#26213F',
  },
  activityDate: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    margin: '4px 0 0 0',
    color: '#999',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 24px 0',
    color: '#26213F',
  },
  formGroup: {
    marginBottom: '18px',
  },
  formLabel: {
    display: 'block',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    margin: '0 0 6px 0',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  formInput: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#fafafa',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  },
  modalButtonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    border: 'none',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  submitButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#825DC7',
    color: '#FFFDF1',
    border: 'none',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default PipelineKYB;
