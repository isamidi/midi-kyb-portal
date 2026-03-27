import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminContext } from '../../components/admin/AdminLayout';

const Configuracion = () => {
  const adminUser = useContext(AdminContext);
  const [users, setUsers] = useState([]);
  const [categories, setCategoriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);

  // Form states
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'ventas', team: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#825DC7' });

  // Colors palette
  const colors = {
    purple: '#825DC7',
    navy: '#26213F',
    orange: '#F5812B',
    cream: '#FFFDF1',
    white: '#ffffff',
    lightGray: '#f5f5f5',
    darkGray: '#9a92a8',
  };

  const roleBadgeColors = {
    admin: { bg: '#f3e8ff', text: '#825DC7' },
    ventas: { bg: '#eef0ff', text: '#3b82f6' },
    compliance_midi: { bg: '#fef3e8', text: '#F5812B' },
    compliance_banco: { bg: '#fff3e0', text: '#8b6f47' },
    operaciones: { bg: '#ecfdf5', text: '#059669' },
  };

  const permissionsMatrix = {
    admin: {
      'Cambiar etapas (todas)': true,
      'Agregar empresas': true,
      'Agregar solicitudes': true,
      'Ver todo el pipeline': true,
      'Gestionar usuarios': true,
      'Ver metricas': true,
    },
    ventas: {
      'Cambiar etapas (todas)': false,
      'Agregar empresas': true,
      'Agregar solicitudes': false,
      'Ver todo el pipeline': false,
      'Gestionar usuarios': false,
      'Ver metricas': false,
    },
    compliance_midi: {
      'Cambiar etapas (todas)': false,
      'Agregar empresas': false,
      'Agregar solicitudes': true,
      'Ver todo el pipeline': false,
      'Gestionar usuarios': false,
      'Ver metricas': false,
    },
    compliance_banco: {
      'Cambiar etapas (todas)': false,
      'Agregar empresas': false,
      'Agregar solicitudes': true,
      'Ver todo el pipeline': false,
      'Gestionar usuarios': false,
      'Ver metricas': false,
    },
    operaciones: {
      'Cambiar etapas (todas)': false,
      'Agregar empresas': false,
      'Agregar solicitudes': false,
      'Ver todo el pipeline': true,
      'Gestionar usuarios': false,
      'Ver metricas': true,
    },
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch admin users
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch categories with company count
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('company_categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Get company counts per category
      const { data: companiesData } = await supabase
        .from('companies')
        .select('category_id, is_active');

      const categoryMap = {};
      (companiesData || []).forEach((c) => {
        if (c.category_id && c.is_active) {
          categoryMap[c.category_id] = (categoryMap[c.category_id] || 0) + 1;
        }
      });

      const categoriesWithCounts = (categoriesData || []).map((cat) => ({
        ...cat,
        companyCount: categoryMap[cat.id] || 0,
      }));

      setCategoriesData(categoriesWithCounts);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error loading configuration data');
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin
  if (!adminUser || adminUser.role !== 'admin') {
    return (
      <div style={styles.container}>
        <p style={styles.restrictedMessage}>
          Solo administradores pueden acceder a esta seccion
        </p>
      </div>
    );
  }

  // Handle add user
  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.role) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .insert([
          {
            full_name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            team: userForm.team || null,
            is_active: true,
            initials: userForm.name
              .split(' ')
              .map((n) => n.charAt(0))
              .join('')
              .toUpperCase(),
          },
        ])
        .select();

      if (error) throw error;
      setUsers([...users, ...data]);
      setUserForm({ name: '', email: '', role: 'ventas', team: '' });
      setShowAddUserForm(false);
    } catch (err) {
      console.error('Error adding user:', err);
      alert('Error al agregar usuario');
    }
  };

  // Handle update user
  const handleUpdateUser = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      setUsers(users.map((u) => (u.id === id ? data[0] : u)));
      setEditingUserId(null);
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Error al actualizar usuario');
    }
  };

  // Handle add category
  const handleAddCategory = async () => {
    if (!categoryForm.name) {
      alert('Por favor ingresa un nombre de categorÃ­a');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_categories')
        .insert([
          {
            name: categoryForm.name,
            color: categoryForm.color,
          },
        ])
        .select();

      if (error) throw error;
      setCategoriesData([...categories, { ...data[0], companyCount: 0 }]);
      setCategoryForm({ name: '', color: '#825DC7' });
      setShowAddCategoryForm(false);
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Error al agregar categorÃ­a');
    }
  };

  // Handle update category
  const handleUpdateCategory = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('company_categories')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      setCategoriesData(
        categories.map((c) => (c.id === id ? { ...data[0], companyCount: c.companyCount } : c))
      );
      setEditingCategoryId(null);
    } catch (err) {
      console.error('Error updating category:', err);
      alert('Error al actualizar categorÃ­a');
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: colors.navy }}>
          Cargando configuraciÃ³n...
        </p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Users Section */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Usuarios del dashboard</h2>
          {!showAddUserForm && (
            <button
              onClick={() => setShowAddUserForm(true)}
              style={styles.primaryButton}
            >
              + Agregar usuario
            </button>
          )}
        </div>

        {/* Add User Form */}
        {showAddUserForm && (
          <div style={styles.formCard}>
            <div style={styles.formGrid}>
              <input
                type="text"
                placeholder="Nombre"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                style={styles.formInput}
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                style={styles.formInput}
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                style={styles.formInput}
              >
                <option value="ventas">Ventas</option>
                <option value="compliance_midi">Compliance Midi</option>
                <option value="compliance_banco">Compliance Banco</option>
                <option value="operaciones">Operaciones</option>
              </select>
              <input
                type="text"
                placeholder="Team (opcional)"
                value={userForm.team}
                onChange={(e) => setUserForm({ ...userForm, team: e.target.value })}
                style={styles.formInput}
              />
            </div>
            <div style={styles.formActions}>
              <button onClick={handleAddUser} style={styles.saveButton}>
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowAddUserForm(false);
                  setUserForm({ name: '', email: '', role: 'ventas', team: '' });
                }}
                style={styles.cancelButton}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        {users.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Avatar</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Team</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Ãltimo acceso</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={styles.tableRow}>
                    <td style={styles.td}>
                      <div
                        style={{
                          ...styles.avatarBadge,
                          backgroundColor: colors.purple,
                        }}
                      >
                        {user.initials || user.full_name?.charAt(0).toUpperCase()}
                      </div>
                    </td>
                    <td style={styles.td}>{user.full_name}</td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.roleBadge,
                          backgroundColor: roleBadgeColors[user.role]?.bg || colors.lightGray,
                          color: roleBadgeColors[user.role]?.text || colors.navy,
                        }}
                      >
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={styles.td}>{user.team || '-'}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor: user.is_active ? '#d1fae5' : '#f3f4f6',
                          color: user.is_active ? '#059669' : '#6b7280',
                        }}
                      >
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {user.last_access
                        ? new Date(user.last_access).toLocaleDateString('es-ES')
                        : 'Nunca'}
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => setEditingUserId(editingUserId === user.id ? null : user.id)}
                        style={styles.editLink}
                      >
                        {editingUserId === user.id ? 'Cerrar' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* User Edit Forms */}
        {editingUserId && (
          <div style={styles.editFormContainer}>
            {users.map((user) => {
              if (user.id !== editingUserId) return null;
              return (
                <div key={user.id} style={styles.formCard}>
                  <h3 style={styles.formTitle}>Editar: {user.full_name}</h3>
                  <div style={styles.formGrid}>
                    <input
                      type="text"
                      defaultValue={user.full_name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        const initials = newName
                          .split(' ')
                          .map((n) => n.charAt(0))
                          .join('')
                          .toUpperCase();
                        const updated = { full_name: newName, initials };
                        handleUpdateUser(user.id, updated);
                      }}
                      style={styles.formInput}
                      placeholder="Nombre"
                    />
                    <input
                      type="email"
                      defaultValue={user.email}
                      onChange={(e) =>
                        handleUpdateUser(user.id, { email: e.target.value })
                      }
                      style={styles.formInput}
                      placeholder="Email"
                    />
                    <select
                      defaultValue={user.role}
                      onChange={(e) =>
                        handleUpdateUser(user.id, { role: e.target.value })
                      }
                      style={styles.formInput}
                    >
                      <option value="ventas">Ventas</option>
                      <option value="compliance_midi">Compliance Midi</option>
                      <option value="compliance_banco">Compliance Banco</option>
                      <option value="operaciones">Operaciones</option>
                    </select>
                    <input
                      type="text"
                      defaultValue={user.team || ''}
                      onChange={(e) =>
                        handleUpdateUser(user.id, { team: e.target.value || null })
                      }
                      style={styles.formInput}
                      placeholder="Team"
                    />
                  </div>
                  <button
                    onClick={() => setEditingUserId(null)}
                    style={styles.saveButton}
                  >
                    Listo
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Categories Section */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Categorias de empresa</h2>
          {!showAddCategoryForm && (
            <button
              onClick={() => setShowAddCategoryForm(true)}
              style={styles.primaryButton}
            >
              + Agregar categoria
            </button>
          )}
        </div>

        {/* Add Category Form */}
        {showAddCategoryForm && (
          <div style={styles.formCard}>
            <div style={styles.formGrid}>
              <input
                type="text"
                placeholder="Nombre de categorÃ­a"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                style={styles.formInput}
              />
              <div style={styles.colorPickerContainer}>
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  style={styles.colorInput}
                />
                <span style={styles.colorLabel}>{categoryForm.color}</span>
              </div>
            </div>
            <div style={styles.formActions}>
              <button onClick={handleAddCategory} style={styles.saveButton}>
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowAddCategoryForm(false);
                  setCategoryForm({ name: '', color: '#825DC7' });
                }}
                style={styles.cancelButton}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Categories List */}
        {categories.length > 0 && (
          <div style={styles.categoriesGrid}>
            {categories.map((category) => (
              <div key={category.id} style={styles.categoryItem}>
                <div style={styles.categoryItemHeader}>
                  <div
                    style={{
                      ...styles.colorDot,
                      backgroundColor: category.color,
                    }}
                  ></div>
                  <div style={styles.categoryItemInfo}>
                    <p style={styles.categoryItemName}>{category.name}</p>
                    <p style={styles.categoryItemCount}>
                      {category.companyCount} empresa{category.companyCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setEditingCategoryId(
                      editingCategoryId === category.id ? null : category.id
                    )
                  }
                  style={styles.editLink}
                >
                  {editingCategoryId === category.id ? 'Cerrar' : 'Editar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Category Edit Forms */}
        {editingCategoryId && (
          <div style={styles.editFormContainer}>
            {categories.map((category) => {
              if (category.id !== editingCategoryId) return null;
              return (
                <div key={category.id} style={styles.formCard}>
                  <h3 style={styles.formTitle}>Editar: {category.name}</h3>
                  <div style={styles.formGrid}>
                    <input
                      type="text"
                      defaultValue={category.name}
                      onChange={(e) =>
                        handleUpdateCategory(category.id, { name: e.target.value })
                      }
                      style={styles.formInput}
                      placeholder="Nombre"
                    />
                    <div style={styles.colorPickerContainer}>
                      <input
                        type="color"
                        defaultValue={category.color}
                        onChange={(e) =>
                          handleUpdateCategory(category.id, { color: e.target.value })
                        }
                        style={styles.colorInput}
                      />
                      <span style={styles.colorLabel}>{category.color}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingCategoryId(null)}
                    style={styles.saveButton}
                  >
                    Listo
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Roles & Permissions Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Roles y permisos</h2>
        <div style={styles.permissionsGrid}>
          {Object.entries(permissionsMatrix).map(([role, permissions]) => (
            <div key={role} style={styles.permissionCard}>
              <h3
                style={{
                  ...styles.permissionCardTitle,
                  backgroundColor: roleBadgeColors[role]?.bg || colors.lightGray,
                  color: roleBadgeColors[role]?.text || colors.navy,
                }}
              >
                {role.replace(/_/g, ' ')}
              </h3>
              <ul style={styles.permissionsList}>
                {Object.entries(permissions).map(([permission, hasAccess]) => (
                  <li key={permission} style={styles.permissionItem}>
                    <span
                      style={{
                        ...styles.permissionDot,
                        color: hasAccess ? '#059669' : '#d1d5db',
                      }}
                    >
                      â
                    </span>
                    <span style={styles.permissionText}>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '18px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  primaryButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 20px',
    backgroundColor: '#825DC7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  container: {
    padding: '40px',
  },
  restrictedMessage: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    color: '#e53935',
    textAlign: 'center',
    padding: '40px 20px',
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
    fontSize: '12px',
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
    color: '#26213F',
  },
  avatarBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    color: '#ffffff',
    flexShrink: 0,
  },
  roleBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'capitalize',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '12px',
  },
  editLink: {
    fontFamily: "'DM Sans', sans-serif",
    backgroundColor: 'transparent',
    color: '#825DC7',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  formTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '16px',
    fontWeight: '700',
    color: '#26213F',
    margin: '0 0 16px 0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  formInput: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#26213F',
    transition: 'border-color 0.2s ease',
  },
  colorPickerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  colorInput: {
    width: '40px',
    height: '40px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  colorLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#26213F',
    fontWeight: '600',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
  },
  saveButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 20px',
    backgroundColor: '#825DC7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cancelButton: {
    fontFamily: "'DM Sans', sans-serif",
    padding: '10px 20px',
    backgroundColor: '#f0f0f0',
    color: '#26213F',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  editFormContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px',
  },
  categoryItem: {
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  categoryItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  categoryItemName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    color: '#26213F',
    margin: 0,
  },
  categoryItemCount: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    color: '#9a92a8',
    margin: 0,
  },
  permissionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  permissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  permissionCardTitle: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    margin: 0,
    padding: '12px 16px',
    textTransform: 'capitalize',
  },
  permissionsList: {
    listStyle: 'none',
    margin: 0,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  permissionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  permissionDot: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
  permissionText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#26213F',
    fontWeight: '500',
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

export default Configuracion;
