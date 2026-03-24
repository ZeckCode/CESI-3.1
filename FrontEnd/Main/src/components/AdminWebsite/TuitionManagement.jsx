// TuitionManagement.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, Download, Plus, Edit2, Trash2,
  DollarSign, AlertCircle, CheckCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import Pagination from './Pagination';
import '../AdminWebsiteCSS/TuitionManagement.css';
import { apiFetchData } from '../api/apiFetch';
import Toast from '../Global/Toast';

const API = '';

const GRADE_OPTIONS = [
  { value: 'prek', label: 'Pre-Kinder' },
  { value: 'kinder', label: 'Kinder' },
  { value: 'grade1', label: 'Grade 1' },
  { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' },
  { value: 'grade4', label: 'Grade 4' },
  { value: 'grade5', label: 'Grade 5' },
  { value: 'grade6', label: 'Grade 6' },
];

const gradeLabelMap = Object.fromEntries(GRADE_OPTIONS.map((g) => [g.value, g.label]));

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return `₱${num.toLocaleString()}`;
};

const normalizeStatus = (value) => String(value || '').toLowerCase();

const paymentModeLabel = (value) => {
  const v = String(value || '').toLowerCase();
  if (!v) return '—';
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const getErrorMessage = (error, fallback) => {
  if (error?.data?.detail) return error.data.detail;
  if (error?.message) return error.message;
  return fallback;
};

const TuitionManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedFee, setSelectedFee] = useState(null);
  const [viewMode, setViewMode] = useState('student');
  const [tmPage, setTmPage] = useState(1);

  const [studentTuition, setStudentTuition] = useState([]);
  const [tuitionFees, setTuitionFees] = useState([]);
  const [configStats, setConfigStats] = useState({
    total_configs: 0,
    active_configs: 0,
    avg_total_cash: 0,
  });

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toasts, setToasts] = useState([]);

  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const addToast = useCallback((title, message, type = 'warning') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ITEMS_PER_PAGE = 10;

  const [formData, setFormData] = useState({
    grade_key: '',
    grade_label: '',
    cash: '',
    installment: '',
    initial: '',
    monthly: '',
    reservation_fee: '2000',
    misc_aug: '',
    misc_nov: '',
    assessment: '300',
    credit: '0',
    transaction_type: 'cash',
    payment_status: 'active',
    description: '',
    status: 'active',
    is_active: true,
  });

  const grades = useMemo(() => ['all', ...GRADE_OPTIONS.map((g) => g.value)], []);

  const resetForm = () => {
    setFormData({
      grade_key: '',
      grade_label: '',
      cash: '',
      installment: '',
      initial: '',
      monthly: '',
      reservation_fee: '2000',
      misc_aug: '',
      misc_nov: '',
      assessment: '300',
      credit: '0',
      transaction_type: 'cash',
      payment_status: 'active',
      description: '',
      status: 'active',
      is_active: true,
    });
    setSelectedFee(null);
    setProofFile(null);
    setProofPreview(null);
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);

      const data = await apiFetchData(`${API}/api/finance/student-tuition-overview/`, {
        method: 'GET',
      });

      const rows = Array.isArray(data) ? data : data?.results || [];

      const mapped = rows.map((item) => ({
        id: item.id,
        studentName: item.student_name || '—',
        parentName: item.parent_name || '—',
        gradeLevel: item.grade_level || '—',
        paymentMode: item.payment_mode || '',
        studentNumber: item.student_number || '—',
        lrn: item.lrn || '—',
        contactNumber: item.contact_number || '—',
        username: item.username || '—',
        totalDue: Number(item.total_due || 0),
        totalPaid: Number(item.total_paid || 0),
        remainingBalance: Number(item.remaining_balance || 0),
        accountStatus: item.account_status || 'PENDING',
      }));

      setStudentTuition(mapped);
    } catch (error) {
      console.error('Failed to load student tuition overview:', error);
      setStudentTuition([]);
      addToast('Load Failed', getErrorMessage(error, 'Failed to load student tuition overview.'), 'error');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadTuitionConfigs = async () => {
    try {
      setLoadingFees(true);

      const data = await apiFetchData(`${API}/api/finance/tuition-configs/`, {
        method: 'GET',
      });

      const rows = Array.isArray(data) ? data : data?.results || [];
      setTuitionFees(rows);
    } catch (error) {
      console.error('Failed to load tuition configs:', error);
      setTuitionFees([]);
      addToast('Load Failed', getErrorMessage(error, 'Failed to load tuition configurations.'), 'error');
    } finally {
      setLoadingFees(false);
    }
  };

  const loadTuitionStats = async () => {
    try {
      const data = await apiFetchData(`${API}/api/finance/tuition-configs/stats/`, {
        method: 'GET',
      });

      setConfigStats({
        total_configs: Number(data?.total_configs || 0),
        active_configs: Number(data?.active_configs || 0),
        avg_total_cash: Number(data?.avg_total_cash || 0),
      });
    } catch (error) {
      console.error('Failed to load tuition stats:', error);
      setConfigStats({
        total_configs: 0,
        active_configs: 0,
        avg_total_cash: 0,
      });
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      loadStudents(),
      loadTuitionConfigs(),
      loadTuitionStats(),
    ]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    setTmPage(1);
  }, [searchTerm, filterGrade, viewMode]);

  const getFilteredData = () => {
    if (viewMode === 'student') {
      return studentTuition.filter((student) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          (student.studentName || '').toLowerCase().includes(q) ||
          (student.parentName || '').toLowerCase().includes(q) ||
          (student.studentNumber || '').toLowerCase().includes(q) ||
          (student.contactNumber || '').toLowerCase().includes(q) ||
          (student.username || '').toLowerCase().includes(q);

        const studentGrade = String(student.gradeLevel || '').toLowerCase();
        const matchesFilter =
          filterGrade === 'all' ||
          studentGrade === filterGrade.toLowerCase() ||
          studentGrade === String(gradeLabelMap[filterGrade] || '').toLowerCase();

        return matchesSearch && matchesFilter;
      });
    }

    return tuitionFees.filter((fee) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (fee.grade_label || '').toLowerCase().includes(q) ||
        (fee.grade_key || '').toLowerCase().includes(q) ||
        (fee.description || '').toLowerCase().includes(q);

      const matchesFilter = filterGrade === 'all' || fee.grade_key === filterGrade;

      return matchesSearch && matchesFilter;
    });
  };

  const getPaymentStats = () => {
    if (viewMode === 'student') {
      const totalStudents = studentTuition.length;
      const cashCount = studentTuition.filter((s) => String(s.paymentMode).toLowerCase() === 'cash').length;
      const installmentCount = studentTuition.filter((s) => String(s.paymentMode).toLowerCase() === 'installment').length;
      return { totalStudents, cashCount, installmentCount };
    }

    return {
      totalConfigs: configStats.total_configs,
      activeConfigs: configStats.active_configs,
      avgTotalCash: configStats.avg_total_cash,
    };
  };

  const handleAddNew = () => {
    setModalMode('add');
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (fee) => {
    if (viewMode === 'student') return;

    setModalMode('edit');
    setSelectedFee(fee);
    setFormData({
      grade_key: fee.grade_key || '',
      grade_label: fee.grade_label || '',
      cash: fee.cash ?? '',
      installment: fee.installment ?? '',
      initial: fee.initial ?? '',
      monthly: fee.monthly ?? '',
      reservation_fee: fee.reservation_fee ?? '2000',
      misc_aug: fee.misc_aug ?? '',
      misc_nov: fee.misc_nov ?? '',
      assessment: fee.assessment ?? '300',
      description: fee.description || '',
      status: fee.status || 'active',
      is_active: fee.is_active ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (viewMode === 'student') return;
    if (!window.confirm('Are you sure you want to delete this tuition record?')) return;

    try {
      await apiFetchData(`${API}/api/finance/tuition-configs/${id}/`, {
        method: 'DELETE',
      });

      await loadTuitionConfigs();
      await loadTuitionStats();
      addToast('Deleted', 'Tuition record deleted successfully.', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      addToast('Delete Failed', getErrorMessage(error, 'Failed to delete tuition record.'), 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.grade_key || !formData.grade_label) {
      addToast('Missing Fields', 'Please select a grade first.', 'warning');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        grade_key: formData.grade_key,
        grade_label: formData.grade_label,
        cash: Number(formData.cash || 0),
        installment: Number(formData.installment || 0),
        initial: Number(formData.initial || 0),
        monthly: Number(formData.monthly || 0),
        reservation_fee: Number(formData.reservation_fee || 0),
        misc_aug: Number(formData.misc_aug || 0),
        misc_nov: Number(formData.misc_nov || 0),
        assessment: Number(formData.assessment || 0),
        description: formData.description,
        status: formData.status,
        is_active: Boolean(formData.is_active),
      };

      if (modalMode === 'add') {
        await apiFetchData(`${API}/api/finance/tuition-configs/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        addToast('Added', 'Tuition record added successfully.', 'success');
      } else {
        await apiFetchData(`${API}/api/finance/tuition-configs/${selectedFee.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        addToast('Updated', 'Tuition record updated successfully.', 'success');
      }

      setShowModal(false);
      resetForm();
      await loadTuitionConfigs();
      await loadTuitionStats();
    } catch (error) {
      console.error('Save failed:', error);
      addToast('Save Failed', getErrorMessage(error, 'Failed to save tuition record.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = () => {
    const data = getFilteredData();
    
    if (data.length === 0) {
      addToast('Export', 'No data to export.', 'warning');
      return;
    }

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    let csv = [];
    if (viewMode === 'student') {
      csv = [
        ['Student Number', 'Student Name', 'Grade Level', 'Payment Mode', 'Parent/Guardian', 'Contact Number', 'Tuition Fee', 'Total Paid', 'Remaining Balance', 'Account Status'].join(','),
        ...data.map((student) => [
          escapeCsv(student.studentNumber),
          escapeCsv(student.studentName),
          escapeCsv(student.gradeLevel),
          escapeCsv(paymentModeLabel(student.paymentMode)),
          escapeCsv(student.parentName),
          escapeCsv(student.contactNumber),
          escapeCsv(formatCurrency(student.totalDue)),
          escapeCsv(formatCurrency(student.totalPaid)),
          escapeCsv(formatCurrency(student.remainingBalance)),
          escapeCsv(student.accountStatus),
        ].join(','))
      ];
    } else {
      csv = [
        ['Grade Level', 'Cash Payment', 'Initial Payment', 'Monthly Payment', 'Reservation Fee', 'Misc (Aug)', 'Misc (Nov)', 'Assessment', 'Status', 'Description'].join(','),
        ...data.map((fee) => [
          escapeCsv(fee.grade_label),
          escapeCsv(formatCurrency(fee.cash)),
          escapeCsv(formatCurrency(fee.initial)),
          escapeCsv(formatCurrency(fee.monthly)),
          escapeCsv(formatCurrency(fee.reservation_fee)),
          escapeCsv(formatCurrency(fee.misc_aug)),
          escapeCsv(formatCurrency(fee.misc_nov)),
          escapeCsv(formatCurrency(fee.assessment)),
          escapeCsv(fee.is_active ? 'Active' : 'Inactive'),
          escapeCsv(fee.description),
        ].join(','))
      ];
    }

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tuition-${viewMode}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast('Export Successful', `Exported ${data.length} ${viewMode === 'student' ? 'students' : 'fee structures'}.`, 'success');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'grade_key') {
      setFormData((prev) => ({
        ...prev,
        grade_key: value,
        grade_label: gradeLabelMap[value] || '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDFs only)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      addToast('Invalid File Type', 'Please upload an image or PDF file.', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast('File Too Large', 'Maximum file size is 5MB.', 'error');
      return;
    }

    setProofFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProofPreview(event.target?.result);
      };
      reader.readAsDataURL(file);
    } else {
      // For PDFs, show a generic icon
      setProofPreview('PDF');
    }
  };

  const removeProofFile = () => {
    setProofFile(null);
    setProofPreview(null);
  };

  const filteredData = getFilteredData();
  const tmTotalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice(
    (tmPage - 1) * ITEMS_PER_PAGE,
    tmPage * ITEMS_PER_PAGE
  );
  const stats = getPaymentStats();

  return (
    <main className="tuition-management-main">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <section className="tm-section">
        <div className="tm-stats-grid">
          <div className="tm-stat-card tm-stat-blue">
            <div className="tm-stat-header">
              <span className="tm-stat-label">
                {viewMode === 'student' ? 'Total Students' : 'Grade Levels'}
              </span>
              <DollarSign size={24} className="tm-stat-icon" />
            </div>
            <div className="tm-stat-value">
              {viewMode === 'student' ? stats.totalStudents : stats.totalConfigs}
            </div>
            <div className="tm-stat-change">
              {viewMode === 'student' ? 'Student tuition profiles' : 'Fee structures configured'}
            </div>
          </div>

          <div className="tm-stat-card tm-stat-green">
            <div className="tm-stat-header">
              <span className="tm-stat-label">
                {viewMode === 'student' ? 'Cash Mode' : 'Active Fees'}
              </span>
              <CheckCircle size={24} className="tm-stat-icon" />
            </div>
            <div className="tm-stat-value">
              {viewMode === 'student' ? stats.cashCount : stats.activeConfigs}
            </div>
            <div className="tm-stat-change">
              {viewMode === 'student' ? 'Students on cash plan' : 'Active tuition configurations'}
            </div>
          </div>

          <div className="tm-stat-card tm-stat-purple">
            <div className="tm-stat-header">
              <span className="tm-stat-label">
                {viewMode === 'student' ? 'Installment Mode' : 'Avg Total Cash'}
              </span>
              <DollarSign size={24} className="tm-stat-icon" />
            </div>
            <div className="tm-stat-value">
              {viewMode === 'student' ? stats.installmentCount : formatCurrency(stats.avgTotalCash)}
            </div>
            <div className="tm-stat-change">
              {viewMode === 'student' ? 'Students on installment plan' : 'Average configured cash total'}
            </div>
          </div>
        </div>
      </section>

      <section className="tm-section">
        <div className="tm-section-header">
          <div>
            <h2 className="tm-section-title">
              {viewMode === 'student' ? 'Student Tuition Profiles' : 'Tuition Fee Structure'}
            </h2>
            <p className="tm-section-subtitle">
              {viewMode === 'student'
                ? 'View student payment plan information'
                : 'Manage tuition configuration by grade'}
            </p>
          </div>

          <div className="tm-button-group">
            <button
              className={`tm-view-toggle ${viewMode === 'student' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'student' ? 'grade' : 'student')}
              title={`Switch to ${viewMode === 'student' ? 'Grade' : 'Student'} View`}
            >
              {viewMode === 'student' ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
              {viewMode === 'student' ? 'Student View' : 'Grade View'}
            </button>

            {viewMode === 'grade' && (
              <button className="tm-btn-primary" onClick={handleAddNew}>
                <Plus size={18} />
                Add New Fee
              </button>
            )}
          </div>
        </div>

        <div className="tm-filters-container">
          <div className="tm-search-box">
            <Search size={20} className="tm-search-icon" />
            <input
              type="text"
              placeholder={
                viewMode === 'student'
                  ? 'Search by student, parent, student no., contact, or username...'
                  : 'Search by grade level or description...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="tm-search-input"
            />
          </div>

          <button className="tm-btn-export" onClick={handleExportData}>
            <Download size={18} />
            Export
          </button>

          <div className="tm-filter-group">
            <Filter size={20} />
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="tm-filter-select"
            >
              <option value="all">All Grades</option>
              {grades.filter((g) => g !== 'all').map((grade) => (
                <option key={grade} value={grade}>
                  {gradeLabelMap[grade] || grade}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tm-table-container">
          <table className="tm-table">
            <thead>
              <tr>
                {viewMode === 'student' ? (
                  <>
                    <th>Student Name</th>
                    <th>Parent</th>
                    <th>Grade</th>
                    <th>Payment Mode</th>
                    <th>Tuition Fee</th>
                    <th>Total Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Student No.</th>
                    <th>Contact</th>
                  </>
                ) : (
                  <>
                    <th>Grade</th>
                    <th>Cash</th>
                    <th>Installment</th>
                    <th>Initial</th>
                    <th>Monthly</th>
                    <th>Total Cash</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {(viewMode === 'student' ? loadingStudents : loadingFees) ? (
                <tr>
                  <td colSpan={viewMode === 'student' ? 10 : 9} className="tm-no-data">
                    <p>Loading...</p>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className={`tm-table-row ${hoveredRow === item.id ? 'tm-row-hover' : ''}`}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {viewMode === 'student' ? (
                      <>
                        <td className="tm-table-cell tm-cell-bold">{item.studentName}</td>
                        <td className="tm-table-cell">{item.parentName}</td>
                        <td className="tm-table-cell">
                          {gradeLabelMap[item.gradeLevel] || item.gradeLevel || '—'}
                        </td>
                        <td className="tm-table-cell">{paymentModeLabel(item.paymentMode)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.totalDue)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.totalPaid)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.remainingBalance)}</td>
                        <td className="tm-table-cell">
                          <span className={`tm-status tm-status-${normalizeStatus(item.accountStatus)}`}>
                            {item.accountStatus}
                          </span>
                        </td>
                        <td className="tm-table-cell">{item.studentNumber || '—'}</td>
                        <td className="tm-table-cell">{item.contactNumber || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="tm-table-cell tm-cell-bold">
                          {item.grade_label || gradeLabelMap[item.grade_key] || item.grade_key}
                        </td>
                        <td className="tm-table-cell">{formatCurrency(item.cash)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.installment)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.initial)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.monthly)}</td>
                        <td className="tm-table-cell">{formatCurrency(item.total_cash)}</td>
                        <td className="tm-table-cell">
                          <span className={`tm-status tm-status-${normalizeStatus(item.status)}`}>
                            {String(item.status || '').charAt(0).toUpperCase() + String(item.status || '').slice(1)}
                          </span>
                        </td>
                        <td className="tm-table-cell">
                          {item.updated_date ? new Date(item.updated_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="tm-table-cell tm-actions-cell">
                          <button
                            className="tm-action-btn tm-edit-btn"
                            title="Edit"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="tm-action-btn tm-delete-btn"
                            title="Delete"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={viewMode === 'student' ? 10 : 9} className="tm-no-data">
                    <AlertCircle size={24} />
                    <p>No records found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            currentPage={tmPage}
            totalPages={tmTotalPages}
            onPageChange={setTmPage}
            totalItems={filteredData.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </section>

      {showModal && (
        <div className="tm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tm-modal-header">
              <h3>{modalMode === 'add' ? 'Add New Tuition Fee' : 'Edit Tuition Fee'}</h3>
              <button className="tm-modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="tm-modal-body">
              <div className="tm-form-group">
                <label>Grade *</label>
                <select
                  name="grade_key"
                  value={formData.grade_key}
                  onChange={handleInputChange}
                  className="tm-form-input"
                  disabled={modalMode === 'edit'}
                >
                  <option value="">Select Grade</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tm-form-group">
                <label>Grade Label *</label>
                <input
                  type="text"
                  name="grade_label"
                  value={formData.grade_label}
                  onChange={handleInputChange}
                  className="tm-form-input"
                  placeholder="Enter label"
                />
              </div>

              <div className="tm-form-group">
                <label>Cash Tuition (₱)</label>
                <input
                  type="number"
                  name="cash"
                  value={formData.cash}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Installment Tuition (₱)</label>
                <input
                  type="number"
                  name="installment"
                  value={formData.installment}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Initial Payment (₱)</label>
                <input
                  type="number"
                  name="initial"
                  value={formData.initial}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Monthly Payment (₱)</label>
                <input
                  type="number"
                  name="monthly"
                  value={formData.monthly}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Reservation Fee (₱)</label>
                <input
                  type="number"
                  name="reservation_fee"
                  value={formData.reservation_fee}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Miscellaneous August (₱)</label>
                <input
                  type="number"
                  name="misc_aug"
                  value={formData.misc_aug}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Miscellaneous November (₱)</label>
                <input
                  type="number"
                  name="misc_nov"
                  value={formData.misc_nov}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Assessment Fee (₱)</label>
                <input
                  type="number"
                  name="assessment"
                  value={formData.assessment}
                  onChange={handleInputChange}
                  className="tm-form-input"
                />
              </div>

              <div className="tm-form-group">
                <label>Credit / Overpayment (₱)</label>
                <input
                  type="number"
                  name="credit"
                  value={formData.credit}
                  onChange={handleInputChange}
                  className="tm-form-input"
                  placeholder="Amount paid above total due"
                />
              </div>

              <div className="tm-form-group">
                <label>Transaction Type</label>
                <select
                  name="transaction_type"
                  value={formData.transaction_type}
                  onChange={handleInputChange}
                  className="tm-form-input"
                >
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                </select>
              </div>

              <div className="tm-form-group">
                <label>Payment Status</label>
                <select
                  name="payment_status"
                  value={formData.payment_status}
                  onChange={handleInputChange}
                  className="tm-form-input"
                >
                  <option value="active">Active</option>
                  {formData.transaction_type === 'installment' && (
                    <option value="pending">Pending</option>
                  )}
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="tm-form-group">
                <label>Proof of Payment</label>
                <div style={{ marginTop: '8px' }}>
                  {!proofPreview ? (
                    <div style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backgroundColor: '#f8fafc',
                      '&:hover': { borderColor: '#2196F3', backgroundColor: '#f0f7ff' }
                    }} onClick={() => document.getElementById('proof-file-input')?.click()}>
                      <div style={{ color: '#64748b', marginBottom: '8px' }}>
                        📄 Click to upload or drag and drop
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        PNG, JPG, GIF or PDF (max. 5MB)
                      </div>
                      <input
                        id="proof-file-input"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleProofFileChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: '#ecfdf5',
                      position: 'relative'
                    }}>
                      {proofPreview === 'PDF' ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📄</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#065f46' }}>
                            {proofFile?.name}
                          </div>
                        </div>
                      ) : (
                        <img
                          src={proofPreview}
                          alt="Proof Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '6px',
                            display: 'block',
                            margin: '0 auto'
                          }}
                        />
                      )}
                      <button
                        onClick={removeProofFile}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="tm-form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="tm-form-input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="tm-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                  />
                  Is Active
                </label>
              </div>

              <div className="tm-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter description"
                  className="tm-form-input tm-form-textarea"
                  rows="3"
                />
              </div>
            </div>

            <div className="tm-modal-footer">
              <button className="tm-btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="tm-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modalMode === 'add' ? 'Add Fee' : 'Update Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TuitionManagement;