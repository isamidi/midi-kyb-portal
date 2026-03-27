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

  // Stages definition
  const stages = [
    { name: 'Registro', value: 'registro', color: '#f3e5f5' },
    { name: 'Documentos', value: 'documentos', color: '#eef0ff' },
    { name: 'Compliance Midi', value: 'compliance_midi', color: '#ffe8d6' },
    { name: 'Compliance Banco', value: 'compliance_banco', color: '#fff3e0' },
    { name: 'Contrato', value: 'contrato', color: '#f1f8e9' },
    { name: 'Activacion', value: 'activacion', color: '#e8f5e9' },
    { name: 'Activo', value: 'activo', color: '#c8e6c9' },
  ];

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

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
    fetchAdminUsers();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = supabase
      .channel('companies_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => {
          fetchCompanies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter companies based on search and filters
  useEffect(() => {
    let result = companies;

    // Apply stage filter
    if (activeStageFilter !== 'Todas') {
      result = result.filter((c) => c.stage === activeStageFilter);
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.company_name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term)
      );
    }

    // Apply filter chips
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
        .select(
          `
          *,
          company_categories(name),
          admin_users(name)
        `
        )
        .order('registered_at', { ascending: false });

      if (error) throw error;

      setCompanies(data || []);
      fetchSolicitudesAndPersonas(data || []);
      fetchStageHistory(data || []);
      fetchActivityLog(data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('id, name');
      if (error) throw error;
      const usersMap = {};
      data?.forEach((user) => {
        usersMap[user.id] = user.name;
      });
      setAdminUsers(usersMap);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const fetchSolicitudesAndPersonas = async (companiesList) => {
    try {
      // Fetch solicitudes
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

      // Fetch personas
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

  const getDaysDifference = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDayColor = (days) => {
    if (days < 7) return '#6b6580';
    if (days <= 14) return '#F5812B';
    return '#e53935';
  };

  const getStageColor = (stage) => {
    const stageObj = stages.find((s) => s.value === stage);
    return stageObj?.color || '#f5f5f5';
  };

  const getStageName = (stage) => {
    const stageObj = stages.find((s) => s.value === stage);
    return stageObj?.name || stage;
  };

  const getStageCount = (stage) => {
    if (stage === 'Todas') {
      return companies.length;
    }
    return companies.filter((c) => c.stage === stage).length;
  };

  const handleChangeStage = async (companyId, newStage) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ stage: newStage, stage_entered_at: new Date().toISOString() })
        .eq('id', companyId);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_log').insert([
        {
          company_id: companyId,
          admin_id: adminUser?.id,
          action: `Etapa cambiada a ${getStageName(newStage)}`,
          created_at: new Date().toISOString(),
        },
      ]);

      // Refresh data
      fetchCompanies();
      setStageDropdownCompanyId(null);
    } catch (err) {
      console.error('Error changing stage:', err);
    }
  };

  const handleCreateCompany = async (formData) => {
    try {
      const { error } = await supabase.from('companies').insert([
        {
          company_name: formData.name,
          email: formData.email,
          category: formData.category,
          stage: 'registro',
          registered_at: new Date().toISOString(),
          stage_entered_at: new Date().toISOString(),
        },
      ]);

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
    const currentIndex = stages.findIndex((s) => s.value === currentStage);
    if (currentIndex === -1 || currentIndex === stages.length - 1) return [];
    return [stages[currentIndex + 1]];
  };

  const getPreviousStages = (currentStage) => {
    const currentIndex = stages.findIndex((s) => s.value === currentStage);
    if (currentIndex <= 0) return [];
    return [stages[currentIndex - 1]];
  };

  const canChangeStage = (stage) => {
    const permitted = getPermittedStages(adminUser?.role);
    return permitted.includes(stage);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Pipeline KYB</h1>
        {(adminUser?.role === 'admin' || adminUser?.role === 'ventas') && (
          <button
            onClick={() => setShowNewCompanyModal(true)}
            style={styles.newCompanyButton}
          >
            + Nueva Empresa
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        {['Todas', ...stages.map((s) => s.value)].map((stage) => {
          const displayName = stage === 'Todas' ? 'Todas' : getStageName(stage);
          const count = getStageCount(stage);
          const isActive = activeStageFilter === stage;

          return (
            <button
              key={stage}
              onClick={() => setActiveStageFilter(stage)}
              style={{
                ...styles.statCard,
                ...(isActive ? styles.statCardActive : {}),
              }}
            >
              <div style={styles.statDot} style={{
                ...styles.statDot,
                backgroundColor: stage === 'Todas' ? '#825DC7' : getStageColor(stage),
              }} />
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
        <input
          type="text"
          placeholder="Search by company name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
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
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Companies Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.tableCell}>Empresa</th>
              <th style={styles.tableCell}>Etapa</th>
              <th style={styles.tableCell}>Vendedor</th>
              <th style={styles.tableCell}>DÃ­as en etapa</th>
              <th style={styles.tableCell}>DÃ­as totales</th>
              <th style={styles.tableCell}>Solicitudes</th>
              {['activacion', 'activo'].includes(activeStageFilter) && (
                <th style={styles.tableCell}>Activacion</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.map((company) => {
              const daysInStage = company.stage_entered_at ? getDaysDifference(company.stage_entered_at) : 0;
              const totalDays = company.registered_at ? getDaysDifference(company.registered_at) : 0;
              const solCount = solicitudes[company.id]?.count || 0;
              const persData = personas[company.id] || { total: 0, activated: 0 };

              return (
                <tr
                  key={company.id}
                  onClick={() => handleOpenCompanyDetail(company)}
                  style={styles.tableRow}
                >
                  {/* Empresa Column */}
                  <td style={styles.tableCell}>
                    <div style={styles.companyCell}>
                      <div style={styles.avatar}>
                        {company.company_name?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div style={styles.companyInfo}>
                        <p style={styles.companyName}>{company.company_name}</p>
                        <p style={styles.companyEmail}>{company.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Etapa Column */}
                  <td style={styles.tableCell}>
                    <div style={styles.stageCell}>
                      <span
                        style={{
                          ...styles.stageBadge,
                          backgroundColor: getStageColor(company.stage),
                        }}
                      >
                        {getStageName(company.stage)}
                      </span>
                      {canChangeStage(company.stage) && (
                        <div style={styles.stageDropdownContainer}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStageDropdownCompanyId(
                                stageDropdownCompanyId === company.id ? null : company.id
                              );
                            }}
                            style={styles.stageChangeButton}
                          >
                            â®
                          </button>
                          {stageDropdownCompanyId === company.id && (
                            <div style={styles.stageDropdown}>
                              <p style={styles.dropdownLabel}>Siguiente</p>
                              {getNextStages(company.stage).map((stage) => (
                                <button
                                  key={stage.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChangeStage(company.id, stage.value);
                                  }}
                                  style={styles.dropdownOption}
                                >
                                  {stage.name}
                                </button>
                              ))}
                              <p style={styles.dropdownLabel}>Anterior</p>
                              {getPreviousStages(company.stage).map((stage) => (
                                <button
                                  key={stage.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChangeStage(company.id, stage.value);
                                  }}
                                  style={styles.dropdownOption}
                                >
                                  {stage.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Vendedor Column */}
                  <td style={styles.tableCell}>
                    <p style={styles.cellText}>
                      {adminUsers[company.assigned_to] || 'Unassigned'}
                    </p>
                  </td>

                  {/* DÃ­as en etapa Column */}
                  <td style={styles.tableCell}>
                    <p
                      style={{
                        ...styles.cellText,
                        color: getDayColor(daysInStage),
                        fontWeight: '600',
                      }}
                    >
                      {daysInStage}d
                    </p>
                  </td>

                  {/* DÃ­as totales Column */}
                  <td style={styles.tableCell}>
                    <p
                      style={{
                        ...styles.cellText,
                        color: getDayColor(totalDays),
                        fontWeight: '600',
                      }}
                    >
                      {totalDays}d
                    </p>
                  </td>

                  {/* Solicitudes Column */}
                  <td style={styles.tableCell}>
                    <p style={styles.cellText}>{solCount}</p>
                  </td>

                  {/* Activacion Column (conditional) */}
                  {['activacion', 'activo'].includes(activeStageFilter) && (
                    <td style={styles.tableCell}>
                      <div style={styles.progressContainer}>
                        <div style={styles.progressBar}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${persData.total > 0 ? (persData.activated / persData.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p style={styles.progressText}>
                          {persData.activated}/{persData.total}
                        </p>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedCompany && (
        <DetailPanel
          company={selectedCompany}
          adminUser={adminUser}
          onClose={() => {
            setShowDetailPanel(false);
            setSelectedCompany(null);
          }}
          stageHistory={stageHistory[selectedCompany.id] || []}
          activityLog={activityLog[selectedCompany.id] || []}
          personas={personas[selectedCompany.id] || { total: 0, activated: 0 }}
          solicitudes={solicitudes[selectedCompany.id]?.count || 0}
          getStageName={getStageName}
          getStageColor={getStageColor}
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
  company,
  adminUser,
  onClose,
  stageHistory,
  activityLog,
  personas,
  solicitudes,
  getStageName,
  getStageColor,
  getDaysDifference,
}) => {
  const [newSolicitudText, setNewSolicitudText] = useState('');
  const [solicitudesList, setSolicitudesList] = useState([]);

  useEffect(() => {
    fetchSolicitudes();
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

  const handleAddSolicitud = async () => {
    if (!newSolicitudText.trim()) return;

    try {
      const { error } = await supabase.from('solicitudes').insert([
        {
          company_id: company.id,
          description: newSolicitudText,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setNewSolicitudText('');
      fetchSolicitudes();
    } catch (err) {
      console.error('Error adding solicitud:', err);
    }
  };

  const canAddSolicitud = ['compliance_midi', 'compliance_banco'].includes(company.stage) || adminUser?.role === 'admin';

  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div
        style={styles.detailPanel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.detailHeader}>
          <div style={styles.detailCompanyInfo}>
            <div style={styles.detailAvatar}>
              {company.company_name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <h2 style={styles.detailCompanyName}>{company.company_name}</h2>
              <p style={styles.detailCompanyEmail}>{company.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeButton}>â</button>
        </div>

        {/* Stage Timeline */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Timeline</h3>
          <div style={styles.timeline}>
            {stageHistory.length === 0 ? (
              <p style={styles.placeholderText}>No stage history available</p>
            ) : (
              stageHistory.map((entry, idx) => (
                <div key={idx} style={styles.timelineEntry}>
                  <div
                    style={{
                      ...styles.timelineDot,
                      backgroundColor: getStageColor(entry.stage),
                    }}
                  />
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineStage}>{getStageName(entry.stage)}</p>
                    <p style={styles.timelineDate}>
                      {new Date(entry.entered_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activation Progress */}
        {['activacion', 'activo'].includes(company.stage) && (
          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Activacion</h3>
            <div style={styles.activationContainer}>
              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${personas.total > 0 ? (personas.activated / personas.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p style={styles.progressText}>
                  {personas.activated}/{personas.total} activated
                </p>
              </div>
            </div>
          </div>
        )}

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
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSolicitud();
                    }
                  }}
                  style={styles.solicitudField}
                />
                <button
                  onClick={handleAddSolicitud}
                  style={styles.solicitudButton}
                >
                  Add
                </button>
              </div>
            )}
            {solicitudesList.length === 0 ? (
              <p style={styles.placeholderText}>No solicitudes</p>
            ) : (
              <div style={styles.solicitudesList}>
                {solicitudesList.map((sol) => (
                  <div key={sol.id} style={styles.solicitudItem}>
                    <p style={styles.solicitudText}>{sol.description}</p>
                    <p style={styles.solicitudDate}>
                      {new Date(sol.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Log */}
        <div style={styles.detailSection}>
          <h3 style={styles.sectionTitle}>Activity</h3>
          {activityLog.length === 0 ? (
            <p style={styles.placeholderText}>No activity log</p>
          ) : (
            <div style={styles.activityList}>
              {activityLog.map((log, idx) => (
                <div key={idx} style={styles.activityItem}>
                  <p style={styles.activityAction}>{log.action}</p>
                  <p style={styles.activityDate}>
                    {new Date(log.created_at).toLocaleDateString()}
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      onCreate(formData);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={styles.modalTitle}>Nueva Empresa</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={styles.formInput}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={styles.formInput}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>CategorÃ­a</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={styles.formInput}
            />
          </div>
          <div style={styles.modalButtonGroup}>
            <button type="button" onClick={onClose} style={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" style={styles.submitButton}>
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Inline styles
const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    color: '#26213F',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '36px',
    fontWeight: '700',
    margin: 0,
    color: '#26213F',
  },
  newCompanyButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '12px 24px',
    backgroundColor: '#825DC7',
    color: '#FFFDF1',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '32px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'DM Sans', sans-serif",
  },
  statCardActive: {
    borderColor: '#825DC7',
    backgroundColor: '#f8f5ff',
  },
  statDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statCardContent: {
    flex: 1,
  },
  statLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '500',
    margin: 0,
    color: '#666',
    textTransform: 'uppercase',
  },
  statCount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '24px',
    fontWeight: '700',
    margin: '4px 0 0 0',
    color: '#26213F',
  },
  toolbar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  filterChips: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#666',
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
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'DM Sans', sans-serif",
  },
  tableHeader: {
    backgroundColor: '#f8f8f8',
    borderBottom: '2px solid #f0f0f0',
  },
  tableCell: {
    padding: '16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  companyCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#825DC7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFDF1',
    fontWeight: '600',
    flexShrink: 0,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
    color: '#26213F',
  },
  companyEmail: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    margin: '4px 0 0 0',
    color: '#999',
  },
  stageCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
  },
  stageBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    color: '#26213F',
  },
  stageDropdownContainer: {
    position: 'relative',
  },
  stageChangeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
    transition: 'color 0.2s ease',
  },
  stageDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '8px',
    minWidth: '140px',
    zIndex: 10,
    marginTop: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  dropdownLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '700',
    margin: '8px 12px 4px 12px',
    color: '#999',
    textTransform: 'uppercase',
  },
  dropdownOption: {
    display: 'block',
    width: 'calc(100% - 24px)',
    padding: '8px 12px',
    margin: '0 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#26213F',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.2s ease',
  },
  cellText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    margin: 0,
    color: '#26213F',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: '#f0f0f0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E2E868',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '600',
    margin: 0,
    color: '#26213F',
    minWidth: '45px',
  },
  detailOverlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  detailPanel: {
    width: '420px',
    height: '100vh',
    backgroundColor: '#FFFDF1',
    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  detailHeader: {
    padding: '24px',
    borderBottom: '2px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  detailCompanyInfo: {
    display: 'flex',
    gap: '12px',
    flex: 1,
  },
  detailAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#825DC7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFDF1',
    fontWeight: '700',
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
    margin: '4px 0 0 0',
    color: '#999',
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#999',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease',
  },
  detailSection: {
    padding: '24px',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    margin: '0 0 16px 0',
    color: '#26213F',
    textTransform: 'uppercase',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  timelineEntry: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '4px',
  },
  timelineContent: {
    flex: 1,
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
    margin: '4px 0 0 0',
    color: '#999',
  },
  activationContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  solicitudInput: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  solicitudField: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    border: '2px solid #f0f0f0',
    borderRadius: '6px',
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
    borderRadius: '6px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  solicitudesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  solicitudItem: {
    padding: '12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
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
    color: '#999',
    fontStyle: 'italic',
    margin: 0,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  activityItem: {
    padding: '12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    padding: '32px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 24px 0',
    color: '#26213F',
  },
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#26213F',
    textTransform: 'uppercase',
  },
  formInput: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#f8f8f8',
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
    backgroundColor: '#f0f0f0',
    color: '#26213F',
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
