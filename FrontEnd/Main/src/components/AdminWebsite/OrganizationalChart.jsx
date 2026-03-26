import React, { useEffect, useState } from 'react';
import {
  Users, BarChart2, AlertCircle, RefreshCw, Mail, Phone
} from 'lucide-react';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/OrganizationalChart.css';

const OrganizationalChart = () => {
  const [admins, setAdmins] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' or 'list'

  const loadOrganizationalData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch admin users
      const adminRes = await apiFetch('/api/accounts/users/?role=ADMIN');
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        setAdmins(Array.isArray(adminData) ? adminData : []);
      } else {
        setAdmins([]);
      }

      // Fetch teacher users (staff)
      const teacherRes = await apiFetch('/api/accounts/users/?role=TEACHER');
      if (teacherRes.ok) {
        const teacherData = await teacherRes.json();
        setTeachers(Array.isArray(teacherData) ? teacherData : []);
      } else {
        setTeachers([]);
      }
    } catch (err) {
      console.error('Error loading organizational data:', err);
      setError(err.message || 'Failed to load organizational data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizationalData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrganizationalData();
    setRefreshing(false);
  };

  const getInitials = (user) => {
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.username.substring(0, 2).toUpperCase();
  };

  const getRoleColor = (role) => {
    const roleStr = String(role || '').toLowerCase();
    if (roleStr.includes('admin')) return '#3b82f6';
    if (roleStr.includes('secretary')) return '#a78bfa';
    if (roleStr.includes('treasurer')) return '#f59e0b';
    if (roleStr.includes('registrar')) return '#60a5fa';
    return '#6b7280';
  };

  const PersonCard = ({ user, isAdmin = false }) => (
    <div className="org-person-card">
      <div className="org-avatar" style={{ background: getRoleColor(user.role) }}>
        {getInitials(user)}
      </div>
      <div className="org-person-info">
        <h3 className="org-person-name">
          {user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.username}
        </h3>
        <p className="org-person-role">
          {user.role === 'ADMIN' || user.role === 'TEACHER' ? 'Staff Member' : user.role}
        </p>
        {user.email && (
          <div className="org-person-contact">
            <Mail size={14} />
            <span>{user.email}</span>
          </div>
        )}
        {isAdmin && user.admin_profile?.permissions_level && (
          <p className="org-person-level" style={{ color: getRoleColor(user.role) }}>
            {user.admin_profile.permissions_level}
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="org-chart-container">
        <div className="org-loading">
          <div className="org-spinner" />
          <p>Loading organizational data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="org-chart-container">
      <div className="org-chart-header">
        <div>
          <p className="org-chart-subtitle">School Administration & Staff Structure</p>
        </div>
        <button
          className="org-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh data"
          type="button"
        >
          <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div className="org-chart-controls">
        <button
          className={`org-view-btn ${viewMode === 'hierarchy' ? 'active' : ''}`}
          onClick={() => setViewMode('hierarchy')}
        >
          <BarChart2 size={16} /> Hierarchy
        </button>
        <button
          className={`org-view-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          <Users size={16} /> List View
        </button>
      </div>

      {error && (
        <div className="org-error">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {viewMode === 'hierarchy' ? (
        <div className="org-hierarchy">
          {/* Admin Section */}
          <div className="org-level">
            <h3 className="org-level-title">Administration</h3>
            {admins.length > 0 ? (
              <div className="org-level-grid">
                {admins.map((admin) => (
                  <PersonCard key={admin.id} user={admin} isAdmin={true} />
                ))}
              </div>
            ) : (
              <div className="org-empty">
                <p>No administrators found</p>
              </div>
            )}
          </div>

          {/* Teachers/Staff Section */}
          {teachers.length > 0 && (
            <div className="org-level">
              <h3 className="org-level-title">Faculty & Staff</h3>
              <div className="org-level-grid">
                {teachers.slice(0, 12).map((teacher) => (
                  <PersonCard key={teacher.id} user={teacher} />
                ))}
                {teachers.length > 12 && (
                  <div className="org-more-card">
                    <p>+{teachers.length - 12} more staff members</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="org-list-view">
          <table className="org-list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="org-admin-row">
                  <td className="org-name">
                    <div className="org-small-avatar" style={{ background: getRoleColor(admin.role) }}>
                      {getInitials(admin)}
                    </div>
                    {admin.first_name && admin.last_name
                      ? `${admin.first_name} ${admin.last_name}`
                      : admin.username}
                  </td>
                  <td>{admin.email}</td>
                  <td><span className="org-role-badge admin">Administrator</span></td>
                </tr>
              ))}
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="org-name">
                    <div className="org-small-avatar" style={{ background: getRoleColor(teacher.role) }}>
                      {getInitials(teacher)}
                    </div>
                    {teacher.first_name && teacher.last_name
                      ? `${teacher.first_name} ${teacher.last_name}`
                      : teacher.username}
                  </td>
                  <td>{teacher.email}</td>
                  <td><span className="org-role-badge teacher">Faculty</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          {admins.length === 0 && teachers.length === 0 && (
            <div className="org-empty">
              <Users size={48} />
              <p>No staff members found</p>
            </div>
          )}
        </div>
      )}

      <div className="org-chart-footer">
        <p className="org-total-count">
          Total Staff: <strong>{admins.length + teachers.length}</strong> 
          ({admins.length} Admin, {teachers.length} Faculty)
        </p>
      </div>
    </div>
  );
};

export default OrganizationalChart;
