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
  const [solicitutdes, setSolicitutdes] = useState({});
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
          c.name?.toLowerCase().includes(term) ||
          c.contact_email?.toLowerCase().includes(term)
      );
    }

    // Apply filter chips
    if (filterChip === 'Con solicitutdes') {
      result = result.filter((c) => (solicitutdes[c.id]?.count || 0) > 0);
    } else if (filterChip === 'Alertas') {
      result = result.filter((c) => {
        const daysInStage = c.stage_entered_at ? getDaysDifference(c.stage_entered_at) : 0;
        return daysInStage > 14;
      });
    } else if (filterChip === 'Mis empresas') {
      result = result.filter((c) => c.assigned_to === adminUser?.id);
    }

    setFilteredCompanies(result);
  }, [companies, searchTerm, activeStageFilter, filterChip, solicitutdes, adminUser]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('registered_at', { ascending: false });

      if (error) throw error;

      setCompanies(data || []);
      fetchSolicitutdesAndPersonas(data || []);
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
      const { data, error } = await supabase.from('admin_users').select('id, full_name');
      if (error) throw error;
      const usersMap = {};
      data?.forEach((user) => {
        usersMap[user.id] = user.full_name;
      });
      setAdminUsers(usersMap);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const fetchSolicitutdesAndPersonas = async (companiesList) => {
    try {
      // Fetch solicitutdes
      const { data: solData, error: solError } = await supabase
        .from('solicitutdes')
        .select('company_id, id')
        .is('resolved_at', null);

      if (!solError && solData) {
        const solMap = {};
        companiesList.forEach((c) => {
          solMap[c.id] = { count: solData.filter((s) => s.company_id === c.id).length };
        });
        setSolicitutdes(solMap);
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
      console.error('Error fetching solicitutdes/personas:', err);
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
          name: formData.name,
          contact_email: formData.email,
          category_id: formData.category,
          stage: 'registro',
          registered_at: new Date().toISOString(),
          stage_entered_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_log').insert([
        {
          company_id: null,
          admin_id: adminUser?.id,
          action: `Nueva empresa creada: ${formData.name}`,
          created_at: new Date().toISOString(),
        },
      ]);

      fetchCompanies();
      setShowNewCompanyModal(false);
    } catch (err) {
      console.error('Error creating company:', err);
    }
  };

  if (loading) {
    return <div style={styles.loadingContainer}>Cargando...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header with search and filters */}
      <div style={styles.header}>
        <h1 style={styles.title}>Pipeline KYB</h1>
        <input
          type="text"
          placeholder="Buscar empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <button
          onClick={() => setShowNewCompanyModal(true)}
          style={styles.createButton}
        >
          + Nueva Empresa
        </button>
      </div>

      {/* Stage filters */}
      <div style={styles.stageFilters}>
        {['Todas', ...stages.map((s) => s.value)].map((stage) => (
          <button
            key={stage}
            onClick={() => setActiveStageFilter(stage)}
            style={{
              ...styles.stageButton,
              backgroundColor:
                activeStageFilter === stage
                  ? getStageColor(stage)
                  : '#f0f0f0',
              fontWeight: activeStageFilter === stage ? 'bold' : 'normal',
            }}
          >
            {stage === 'Todas' ? 'Todas' : getStageName(stage)} (
            {getStageCount(stage)})
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div style={styles.filterChips}>
        {['Con solicitutdes', 'Alertas', 'Mis empresas'].map((chip) => (
          <button
            key={chip}
            onClick={() => setFilterChip(filterChip === chip ? 'Todas' : chip)}
            style={{
              ...styles.filterChip,
              backgroundColor: filterChip === chip ? '#6b5b95' : '#e0e0e0',
              color: filterChip === chip ? 'white' : '#333',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Companies list */}
      <div style={styles.companiesList}>
        {filteredCompanies.length === 0 ? (
          <p style={styles.emptyState}>No hay empresas</p>
        ) : (
          filteredCompanies.map((company) => (
            <div
              key={company.id}
              style={styles.companyCard}
              onClick={() => {
                setSelectedCompany(company);
                setShowDetailPanel(true);
              }}
            >
              <div style={styles.companyCardHeader}>
                <h3 style={styles.companyName}>{company.name}</h3>
                <span
                  style={{
                    ...styles.stageBadge,
                    backgroundColor: getStageColor(company.stage),
                  }}
                >
                  {getStageName(company.stage)}
                </span>
              </div>
              <p style={styles.companyEmail}>{company.contact_email}</p>
              <div style={styles.companyMeta}>
                <span>
                  Solicitutdes: {solicitutdes[company.id]?.count || 0}
                </span>
                <span>
                  Personas: {personas[company.id]?.activated || 0}/
                  {personas[company.id]?.total || 0}
                </span>
                <span style={{ color: getDayColor(getDaysDifference(company.stage_entered_at)) }}>
                  {getDaysDifference(company.stage_entered_at)} días
                </span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStageDropdownCompanyId(
                      stageDropdownCompanyId === company.id ? null : company.id
                    );
                  }}
                  style={styles.stageChangeButton}
                >
                  Cambiar Etapa
                </button>
                {stageDropdownCompanyId === company.id && (
                  <div style={styles.stageDropdownContainer}>
                    {stages.map((stage) => (
                      <button
                        key={stage.value}
                        onClick={() => handleChangeStage(company.id, stage.value)}
                        style={styles.dropdownOption}
                      >
                        {stage.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail panel */}
      {showDetailPanel && selectedCompany && (
        <div style={styles.detailPanel}>
          <button
            onClick={() => setShowDetailPanel(false)}
            style={styles.closeButton}
          >
            ✕
          </button>
          <div>
            <h2 style={styles.detailCompanyName}>{selectedCompany.name}</h2>
            <div style={styles.detailSection}>
              <h3>Información General</h3>
              <p>Email: {selectedCompany.contact_email}</p>
              <p>Etapa: {getStageName(selectedCompany.stage)}</p>
              <p>
                Registrado:{' '}
                {new Date(selectedCompany.registered_at).toLocaleDateString()}
              </p>
            </div>

            {/* Solicitutdes section */}
            <div style={styles.detailSection}>
              <h3>Solicitutdes ({solicitutdes[selectedCompany.id]?.count || 0})</h3>
              {solicitutdes[selectedCompany.id]?.count > 0 ? (
                <p>Hay {solicitutdes[selectedCompany.id]?.count} solicitutdes pendientes</p>
              ) : (
                <p>No hay solicitutdes</p>
              )}
            </div>

            {/* Personas section */}
            <div style={styles.detailSection}>
              <h3>
                Personas ({personas[selectedCompany.id]?.activated || 0}/
                {personas[selectedCompany.id]?.total || 0})
              </h3>
              <p>
                {personas[selectedCompany.id]?.total || 0} personas registradas
              </p>
            </div>

            {/* Timeline section */}
            <div style={styles.detailSection}>
              <h3>Historial de Etapas</h3>
              {stageHistory[selectedCompany.id]?.length > 0 ? (
                <div style={styles.timeline}>
                  {stageHistory[selectedCompany.id]?.map((entry, idx) => (
                    <div key={idx} style={styles.timelineItem}>
                      <span style={styles.timelineDate}>
                        {new Date(entry.entered_at).toLocaleDateString()}
                      </span>
                      <span style={styles.timelineStage}>
                        {getStageName(entry.stage)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No hay historial</p>
              )}
            </div>

            {/* Activity log section */}
            <div style={styles.detailSection}>
              <h3>Actividad Reciente</h3>
              {activityLog[selectedCompany.id]?.length > 0 ? (
                <div>
                  {activityLog[selectedCompany.id]?.map((log, idx) => (
                    <div key={idx} style={styles.activityItem}>
                      <span style={styles.activityDate}>
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                      <span>{log.action}</span>
                      {log.admin_id && (
                        <span style={styles.activityAdmin}>
                          por {adminUsers[log.admin_id]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No hay actividad</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New company modal */}
      {showNewCompanyModal && (
        <div style={styles.modalOverlay} onClick={() => setShowNewCompanyModal(false)}>
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Nueva Empresa</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleCreateCompany({
                  name: formData.get('name'),
                  email: formData.get('email'),
                  category: formData.get('category'),
                });
              }}
            >
              <input
                type="text"
                name="name"
                placeholder="Nombre de la empresa"
                required
                style={styles.modalInput}
              />
              <input
                type="email"
                name="email"
                placeholder="Email de contacto"
                required
                style={styles.modalInput}
              />
              <select name="category" required style={styles.modalInput}>
                <option value="">Seleccionar categoría</option>
                <option value="fintech">FinTech</option>
                <option value="ecommerce">E-commerce</option>
                <option value="tech">Tech</option>
              </select>
              <button type="submit" style={styles.submitButton}>
                Crear
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#fff',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    flex: 1,
    maxWidth: '300px',
  },
  createButton: {
    padding: '8px 16px',
    backgroundColor: '#6b5b95',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  stageFilters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  stageButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  filterChips: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  filterChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },
  companiesList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  emptyState: {
    gridColumn: '1/-1',
    textAlign: 'center',
    color: '#666',
  },
  companyCard: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  companyCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  companyName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
  },
  stageBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  companyEmail: {
    margin: '8px 0',
    fontSize: '14px',
    color: '#666',
  },
  companyMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#666',
    marginBottom: '12px',
  },
  actions: {
    position: 'relative',
  },
  stageChangeButton: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  stageDropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    zIndex: 10,
    marginTop: '4px',
  },
  dropdownOption: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'white',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '12px',
  },
  detailPanel: {
    position: 'fixed',
    right: 0,
    top: 0,
    width: '400px',
    height: '100vh',
    backgroundColor: 'white',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
    overflow: 'auto',
    padding: '24px',
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  },
  detailCompanyName: {
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '20px',
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  timelineItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  timelineDate: {
    minWidth: '100px',
    fontSize: '12px',
    color: '#666',
  },
  timelineStage: {
    fontSize: '14px',
    fontWeight: '500',
  },
  activityItem: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'flex-start',
    fontSize: '14px',
  },
  activityDate: {
    minWidth: '100px',
    fontSize: '12px',
    color: '#666',
  },
  activityAdmin: {
    fontSize: '12px',
    color: '#999',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '32px',
    minWidth: '400px',
  },
  modalInput: {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#6b5b95',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
};

export default PipelineKYB;
