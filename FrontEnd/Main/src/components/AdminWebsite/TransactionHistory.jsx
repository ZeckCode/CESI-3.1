import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Filter, Download, FileDown, 
  CheckCircle, Clock,
  Plus, X, ChevronDown, ChevronUp, Edit2, Trash2,
  Bell, Receipt
} from 'lucide-react';
import * as XLSX from 'xlsx';
import '../AdminWebsiteCSS/TransactionHistory.css';
import Pagination from './Pagination';
import { getToken } from '../Auth/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE = '';

const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
};

const TRANSACTION_TYPES = [
  { value: 'TUITION', label: 'Tuition Fee' },
  { value: 'REGISTRATION', label: 'Registration Fee' },
  { value: 'MISC', label: 'Miscellaneous' },
  { value: 'BOOKS', label: 'Books & Materials' },
  { value: 'UNIFORM', label: 'Uniform' },
  { value: 'OTHER', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GCASH', label: 'GCash' },
  { value: 'PAYMAYA', label: 'PayMaya' },
  { value: 'CHECK', label: 'Check' },
  { value: 'OTHER', label: 'Other' },
];

const ENTRY_TYPES = [
  { value: 'DEBIT', label: 'Debit / Billing' },
  { value: 'CREDIT', label: 'Credit / Payment' },
];

const ITEM_OPTIONS = [
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'INITIAL', label: 'Initial Payment' },
  { value: 'MONTHLY', label: 'Monthly Installment' },
  { value: 'MISC', label: 'Miscellaneous' },
  { value: 'RESERVATION', label: 'Reservation Fee' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'POSTED', label: 'Posted' },
];

const EMPTY_FORM = {
  parent: '',
  student_name: '',
  transaction_type: 'TUITION',
  entry_type: 'CREDIT',
  item: 'PAYMENT',
  school_year: '2026-2027',
  semester: '1st',
  amount: '',
  description: '',
  payment_method: 'CASH',
  transaction_date: '',
  due_date: '',
  status: 'PAID',
};

const formatCurrency = (value) => `₱${Number(value || 0).toLocaleString()}`;

const formatStudentType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '—';

  if (['old', 'old_student', 'returning', 'returning_student'].includes(v)) {
    return 'Old Student';
  }

  if (['new', 'new_student', 'new enrollee', 'new_enrollee'].includes(v)) {
    return 'New Student';
  }

  return value;
};

const formatPaymentMode = (value) => {
  const v = String(value || '').trim();
  if (!v) return '—';

  const map = {
    CASH: 'Cash',
    INSTALLMENT: 'Installment',
  };

  return map[v.toUpperCase()] || v;
};

const buildLedgerGroupTitle = (group) => {
  return [
    `SY ${group.school_year || '—'}`,
    group.grade_level || '—',
    formatStudentType(group.student_type),
    formatPaymentMode(group.payment_mode),
  ].join(' • ');
};


const statusPriority = {
  OVERDUE: 1,
  PARTIAL: 2,
  PENDING: 3,
  POSTED: 4,
  PAID: 5,
};

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total_billed: 0,
    total_collected: 0,
    outstanding_balance: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEntryType, setFilterEntryType] = useState('all');

  const [txnPage, setTxnPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [expandedRow, setExpandedRow] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [parentOptions, setParentOptions] = useState([]);
  const [parentSearch, setParentSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [parentLoading, setParentLoading] = useState(false);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus !== 'all') params.append('status', filterStatus.toUpperCase());
      if (filterEntryType !== 'all') params.append('entry_type', filterEntryType.toUpperCase());

      const res = await fetch(`${API_BASE}/api/finance/transactions/?${params.toString()}`, {
        credentials: 'include',
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    }
  }, [searchTerm, filterStatus, filterEntryType]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finance/transactions/stats/`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        total_billed: Number(data.total_billed || 0),
        total_collected: Number(data.total_collected || 0),
        outstanding_balance: Number(data.outstanding_balance || 0),
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [fetchTransactions, fetchStats]);

  useEffect(() => {
    setTxnPage(1);
  }, [searchTerm, filterStatus, filterEntryType]);

  const searchParents = useCallback(async (query) => {
    setParentLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/finance/parents/?search=${encodeURIComponent(query)}`,
        { credentials: 'include', headers: authHeaders() }
      );

      if (!res.ok) {
        setParentOptions([]);
        setShowDropdown(true);
        return;
      }

      const data = await res.json();
      setParentOptions(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching parents:', err);
      setParentOptions([]);
    } finally {
      setParentLoading(false);
    }
  }, []);

  const handleParentSearchChange = (e) => {
    const val = e.target.value;
    setParentSearch(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchParents(val.trim()), 300);
  };

  const selectParent = (parent) => {
    setSelectedParent(parent);
    setFormData((prev) => ({
      ...prev,
      parent: parent.id,
      student_name: parent.student_name || prev.student_name || '',
    }));

    const displayName = parent.student_name
      ? `${parent.student_name}${parent.student_number ? ` — ${parent.student_number}` : ''}`
      : `${parent.email || parent.username}`;

    setParentSearch(displayName);
    setShowDropdown(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModal = () => {
    setEditingTxn(null);
    setFormData({ ...EMPTY_FORM });
    setParentSearch('');
    setSelectedParent(null);
    setFormError('');
    setShowModal(true);
    searchParents('');
  };

  const openEditModal = (txn) => {
    setEditingTxn(txn);
    setFormData({
      parent: txn.parent,
      student_name: txn.student_name || '',
      transaction_type: txn.transaction_type || 'TUITION',
      entry_type: txn.entry_type || 'CREDIT',
      item: txn.item || 'PAYMENT',
      school_year: txn.school_year || '2026-2027',
      semester: txn.semester || '1st',
      amount: txn.amount || '',
      description: txn.description || '',
      payment_method: txn.payment_method || 'CASH',
      transaction_date: txn.transaction_date || '',
      due_date: txn.due_date || '',
      status: txn.status || 'POSTED',
    });

    setParentSearch(
      txn.student_name
        ? `${txn.student_name}${txn.student_number ? ` — ${txn.student_number}` : ''}`
        : ''
    );
    setSelectedParent({ id: txn.parent });
    setFormError('');
    setShowModal(true);
    searchParents('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'entry_type') {
        if (value === 'DEBIT' && next.item === 'PAYMENT') next.item = 'REGISTRATION';
        if (
          value === 'CREDIT' &&
          ['REGISTRATION', 'MONTHLY', 'MISC', 'RESERVATION', 'ASSESSMENT'].includes(next.item)
        ) {
          next.item = 'PAYMENT';
        }
      }

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.parent) {
      setFormError('Please select a parent/student account.');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        ...formData,
        amount: parseFloat(formData.amount).toFixed(2),
        due_date: formData.due_date || null,
        transaction_date: formData.transaction_date || null,
      };

      const isEdit = !!editingTxn;
      const url = isEdit
        ? `${API_BASE}/api/finance/transactions/${editingTxn.id}/`
        : `${API_BASE}/api/finance/transactions/`;

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail =
          errData.detail ||
          errData.amount?.[0] ||
          errData.item?.[0] ||
          errData.due_date?.[0] ||
          JSON.stringify(errData) ||
          'Server error';
        throw new Error(detail);
      }

      setShowModal(false);
      setEditingTxn(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/finance/transactions/${deleteTarget.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete');
      }

      setDeleteTarget(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const sendReminder = async (transactionId) => {
    setSendingReminderId(transactionId);
    try {
      const res = await fetch(`${API_BASE}/api/reminders/payments/${transactionId}/send/`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to send reminder.');
      alert(data.detail || 'Payment reminder sent successfully.');
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert(err.message || 'Failed to send reminder.');
    } finally {
      setSendingReminderId(null);
    }
  };

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    try {
      const res = await fetch(`${API_BASE}/api/reminders/payments/send-bulk/`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to send bulk reminders.');
      alert(data.detail || 'Bulk reminders sent successfully.');
    } catch (err) {
      console.error('Error sending bulk reminders:', err);
      alert(err.message || 'Failed to send bulk reminders.');
    } finally {
      setSendingBulk(false);
    }
  };

  // PDF Export Function
  const exportToPDF = (groupedTransactions, stats) => {
    const doc = new jsPDF('landscape');
    
    // Add title and header
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text('Transaction History Report', 14, 15);
    
    // Add date
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    const currentDate = new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${currentDate}`, 14, 22);
    
    // Add stats summary
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Summary Statistics', 14, 35);
    
    // Update the statsData in the exportToPDF function:
    const statsData = [
      ['Total Billed', `₱${Number(stats.total_billed || 0).toLocaleString()}`],
      ['Total Collected', `₱${Number(stats.total_collected || 0).toLocaleString()}`],
      ['Outstanding Balance', `₱${Number(stats.outstanding_balance || 0).toLocaleString()}`],
      ['Collection Rate', stats.total_billed > 0 
        ? `${Math.round((stats.total_collected / stats.total_billed) * 100)}%` 
        : '—'],
    ];
    
    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: statsData,
      theme: 'grid',
      headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 60 }
      }
    });
    
    // Add transactions summary table
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Transaction Summary (By Student)', 14, finalY);
    
    // In the summaryData mapping:
    const summaryData = groupedTransactions.map(group => [
      group.student_number,
      group.student_name,
      group.grade_level || '—',
      group.payment_mode || '—',
      `₱${Number(group.total_debit || 0).toLocaleString()}`,  // Changed from '₱' to the actual peso symbol
      `₱${Number(group.total_credit || 0).toLocaleString()}`, // Changed here too
      `₱${Number(group.balance || 0).toLocaleString()}`,      // And here
      group.account_status
    ]);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Student No.', 'Student Name', 'Grade', 'Payment Mode', 'Total Debit', 'Total Credit', 'Balance', 'Status']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 7, cellPadding: 3 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 20 }
      }
    });
    
    // Add footer with page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(108, 117, 125);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width - 20,
        doc.internal.pageSize.height - 10
      );
    }
    
    // Save the PDF
    doc.save(`transaction_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportData = () => {
    try {
      // Prepare summary data
    const summaryData = groupedTransactions.map((group) => ({
      'Date': group.latest_date || '—',
      'Enrollment ID': group.enrollment_id || '—',
      'Student Number': group.student_number,
      'Student Name': group.student_name,
      'School Year': group.school_year || '—',
      'Semester': group.semester || '—',
      'Grade Level': group.grade_level || '—',
      'Student Type': formatStudentType(group.student_type),
      'Payment Mode': formatPaymentMode(group.payment_mode),
      'Total Debit': Number(group.total_debit || 0),
      'Total Credit': Number(group.total_credit || 0),
      'Balance': Number(group.balance || 0),
      'Status': group.account_status,
    }));

      // Prepare detailed ledger data
      const detailData = [];
      groupedTransactions.forEach((group) => {
        group.rows.forEach((tx) => {
         detailData.push({
          'Enrollment ID': group.enrollment_id || '—',
          'Ledger Group': buildLedgerGroupTitle(group),
          'Student Number': group.student_number,
          'Student Name': group.student_name,
          'Date': tx.transaction_date || '—',
          'Reference': tx.reference_number || '—',
          'Entry Type': entryLabel(tx.entry_type),
          'Item': itemLabel(tx.item),
          'Debit': Number(tx.debit || 0),
          'Credit': Number(tx.credit || 0),
          'Balance': Number(tx._runningBalance || 0),
          'Status': tx.status,
          'Description': tx.description || '',
        });
        });
      });

      // Create workbook with two sheets
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [
        { wch: 15 }, // Date
        { wch: 15 }, // Student Number
        { wch: 20 }, // Student Name
        { wch: 12 }, // Grade Level
        { wch: 15 }, // Payment Mode
        { wch: 15 }, // Total Debit
        { wch: 15 }, // Total Credit
        { wch: 15 }, // Balance
        { wch: 12 }, // Status
      ];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Detailed ledger sheet
      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      detailSheet['!cols'] = [
        { wch: 15 }, // Student Number
        { wch: 20 }, // Student Name
        { wch: 15 }, // Date
        { wch: 15 }, // Reference
        { wch: 15 }, // Entry Type
        { wch: 15 }, // Item
        { wch: 12 }, // Debit
        { wch: 12 }, // Credit
        { wch: 12 }, // Balance
        { wch: 12 }, // Status
        { wch: 25 }, // Description
      ];
      XLSX.utils.book_append_sheet(wb, detailSheet, 'Ledger Details');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `Transaction_History_${timestamp}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);
      alert(`✓ Export successful! File: ${filename}`);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    }
  };

  const itemLabel = (val) => ITEM_OPTIONS.find((i) => i.value === val)?.label || val;
  const entryLabel = (val) => ENTRY_TYPES.find((e) => e.value === val)?.label || val;

  const statusClass = (s) => {
    if (!s) return '';
    return String(s).toLowerCase();
  };

 const groupedTransactions = useMemo(() => {
    const map = new Map();

    transactions.forEach((tx) => {
      const enrollmentKey =
        tx.enrollment_id != null && tx.enrollment_id !== ''
          ? `enrollment-${tx.enrollment_id}`
          : [
              tx.student_number || `parent-${tx.parent}`,
              tx.school_year || 'no-sy',
              tx.grade_level || 'no-grade',
              tx.student_type || 'no-type',
              tx.payment_mode || 'no-mode',
            ].join('|');

      if (!map.has(enrollmentKey)) {
        map.set(enrollmentKey, {
          key: enrollmentKey,
          enrollment_id: tx.enrollment_id || null,
          parent: tx.parent,
          student_number: tx.student_number || '—',
          student_name: tx.student_name || '—',
          school_year: tx.school_year || '—',
          semester: tx.semester || '—',
          grade_level: tx.grade_level || '—',
          payment_mode: tx.payment_mode || '—',
          student_type: tx.student_type || '—',
          latest_date: tx.transaction_date || '',
          total_debit: 0,
          total_credit: 0,
          balance: 0,
          account_status: tx.status || 'PENDING',
          rows: [],
        });
      }

      const group = map.get(enrollmentKey);
      group.rows.push(tx);
      group.total_debit += Number(tx.debit || 0);
      group.total_credit += Number(tx.credit || 0);

      if ((tx.transaction_date || '') > group.latest_date) {
        group.latest_date = tx.transaction_date || '';
      }

      const currentPriority = statusPriority[group.account_status] || 99;
      const nextPriority = statusPriority[tx.status] || 99;
      if (nextPriority < currentPriority) {
        group.account_status = tx.status || 'PENDING';
      }
    });

    const result = Array.from(map.values()).map((group) => {
      const sortedRows = group.rows
        .slice()
        .sort((a, b) => {
          const dateCompare = String(a.transaction_date || '').localeCompare(String(b.transaction_date || ''));
          if (dateCompare !== 0) return dateCompare;
          return Number(a.id || 0) - Number(b.id || 0);
        });

      let runningBalance = 0;
      const normalizedRows = sortedRows.map((tx) => {
        const debit = Number(tx.debit || 0);
        const credit = Number(tx.credit || 0);
        runningBalance += debit - credit;

        return {
          ...tx,
          _runningBalance: runningBalance,
        };
      });

      return {
        ...group,
        rows: normalizedRows,
        balance: runningBalance,
      };
    });

    return result.sort((a, b) =>
      String(b.latest_date || '').localeCompare(String(a.latest_date || ''))
    );
  }, [transactions]);

  const txnTotalPages = Math.max(1, Math.ceil(groupedTransactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = useMemo(
    () =>
      groupedTransactions.slice(
        (txnPage - 1) * ITEMS_PER_PAGE,
        txnPage * ITEMS_PER_PAGE
      ),
    [groupedTransactions, txnPage]
  );

  const isReminderEligible = (group) =>
    Number(group.balance || 0) > 0 &&
    ['PENDING', 'OVERDUE', 'PARTIAL', 'POSTED'].includes(group.account_status);

  return (
    <main className="transaction-history-main">
      <section className="th-section">
        <div className="th-stats-grid">
          <div className="th-stat-card th-stat-blue">
            <div className="th-stat-header">
              <span className="th-stat-label">Total Billed</span>
              <Receipt size={24} className="th-stat-icon" />
            </div>
            <div className="th-stat-value">{formatCurrency(stats.total_billed)}</div>
            <div className="th-stat-change positive">Ledger debits</div>
          </div>

          <div className="th-stat-card th-stat-green">
            <div className="th-stat-header">
              <span className="th-stat-label">Total Collected</span>
              <CheckCircle size={24} className="th-stat-icon" />
            </div>
            <div className="th-stat-value">{formatCurrency(stats.total_collected)}</div>
            <div className="th-stat-change positive">
              {stats.total_billed > 0
                ? `${Math.round((stats.total_collected / stats.total_billed) * 100)}% collection rate`
                : '—'}
            </div>
          </div>

          <div className="th-stat-card th-stat-yellow">
            <div className="th-stat-header">
              <span className="th-stat-label">Outstanding Balance</span>
              <Clock size={24} className="th-stat-icon" />
            </div>
            <div className="th-stat-value">{formatCurrency(stats.outstanding_balance)}</div>
            <div className="th-stat-change">Unpaid balance</div>
          </div>
        </div>
      </section>

      <section className="th-section">
        <div className="th-section-header">
          <div>
            <h2 className="th-section-title">Transaction History</h2>
          <p className="th-section-subtitle">One summary row per approved enrollment ledger</p>
          </div>
          <div className="th-header-actions">
            <button className="th-btn-success" onClick={openModal}>
              <Plus size={18} /> Add Ledger Entry
            </button>

            <button
              className="th-btn-warning"
              onClick={sendBulkReminders}
              disabled={sendingBulk}
            >
              <Bell size={18} /> {sendingBulk ? 'Sending...' : 'Send Bulk Reminders'}
            </button>

            <button className="th-btn-primary" onClick={handleExportData}>
              <Download size={18} /> Export to Excel
            </button>

            <button className="th-btn-primary" onClick={() => exportToPDF(groupedTransactions, stats)}
              title="Export to PDF">
              <FileDown size={18} /> Export to PDF
            </button>
          </div>
        </div>

        <div className="th-filters-container" style={{ gap: '12px', flexWrap: 'wrap' }}>
          <div className="th-search-box">
            <Search size={20} className="th-search-icon" />
            <input
              type="text"
              placeholder="Search by student, student number, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="th-search-input"
            />
          </div>

          <div className="th-filter-group">
            <Filter size={20} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="th-filter-select"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="posted">Posted</option>
            </select>
          </div>

          <div className="th-filter-group">
            <Filter size={20} />
            <select
              value={filterEntryType}
              onChange={(e) => setFilterEntryType(e.target.value)}
              className="th-filter-select"
            >
              <option value="all">All Entry Types</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

        <div className="th-table-container">
          <table className="th-table">
            <thead>
              <tr>
                <th>Date</th>
                {/* <th>Ledger Group</th> */}
                <th>Student No.</th>
                <th>Student Name</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {groupedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr>
                        <td>{group.latest_date || '—'}</td>
                          {/* <td> */}
                            {/* <div style={{ fontWeight: 700, color: '#1e293b' }}> */}
                              {/* {buildLedgerGroupTitle(group)} */}
                            {/* </div> */}
                            {/* <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                              {group.enrollment_id ? `Enrollment #${group.enrollment_id}` : 'Legacy ledger record'}
                            </div> */}
                          {/* </td> */}
                          <td>{group.student_number}</td>
                          <td className="th-student-name-cell">{group.student_name}</td>
                          <td className="th-amount-cell">{formatCurrency(group.total_debit)}</td>
                          <td className="th-amount-cell">{formatCurrency(group.total_credit)}</td>
                          <td className="th-amount-cell">{formatCurrency(group.balance)}</td>
                          <td>
                            <span className={`th-status-badge th-status-${statusClass(group.account_status)}`}>
                              {group.account_status}
                            </span>
                          </td>
                          <td className="th-actions-cell">
                        {isReminderEligible(group) && (
                          <button
                            className="th-action-btn th-reminder-btn"
                            onClick={() => sendReminder(group.rows[0].id)}
                            title="Send Reminder"
                            disabled={sendingReminderId === group.rows[0].id}
                          >
                            <Bell size={15} />
                          </button>
                        )}

                        <button
                          className="th-action-btn th-edit-btn"
                          onClick={() => setExpandedRow(expandedRow === group.key ? null : group.key)}
                          title="View Ledger Details"
                        >
                          {expandedRow === group.key ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </td>
                    </tr>

                    {expandedRow === group.key && (
                      <tr className="th-expanded-row">
                        <td colSpan="9">
                          <div className="th-student-detail-panel">
                            <h4 className="th-detail-title">
                              {buildLedgerGroupTitle(group)}
                            </h4>

                            <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                              Student: <strong>{group.student_name}</strong> ({group.student_number}) | Semester:{' '}
                              <strong>{group.semester || '—'}</strong> | Balance:{' '}
                              <strong>{formatCurrency(group.balance)}</strong> | Ref:{' '}
                              <strong>{group.enrollment_id ? `Enrollment #${group.enrollment_id}` : 'Legacy ledger record'}</strong>
                            </div>

                            <div className="th-table-container" style={{ marginTop: '0.75rem' }}>
                              <table className="th-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th>Entry Type</th>
                                    <th>Item</th>
                                    <th>Debit</th>
                                    <th>Credit</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows
                                    .slice()
                                    .sort((a, b) =>
                                      String(a.transaction_date || '').localeCompare(String(b.transaction_date || ''))
                                    )
                                    .map((tx) => (
                                      <tr key={tx.id}>
                                        <td>{tx.transaction_date || '—'}</td>
                                        <td>{tx.reference_number || '—'}</td>
                                        <td>{entryLabel(tx.entry_type)}</td>
                                        <td>{itemLabel(tx.item)}</td>
                                        <td className="th-amount-cell">
                                          {Number(tx.debit || 0) > 0 ? formatCurrency(tx.debit) : '—'}
                                        </td>
                                        <td className="th-amount-cell">
                                          {Number(tx.credit || 0) > 0 ? formatCurrency(tx.credit) : '—'}
                                        </td>
                                        <td className="th-amount-cell">{formatCurrency(tx._runningBalance)}</td>
                                        <td>
                                          <span className={`th-status-badge th-status-${statusClass(tx.status)}`}>
                                            {tx.status}
                                          </span>
                                        </td>
                                        <td className="th-actions-cell">
                                          {tx.entry_type === 'DEBIT' &&
                                            ['PENDING', 'OVERDUE', 'PARTIAL', 'POSTED'].includes(tx.status) && (
                                              <button
                                                className="th-action-btn th-reminder-btn"
                                                onClick={() => sendReminder(tx.id)}
                                                title="Send Reminder"
                                                disabled={sendingReminderId === tx.id}
                                              >
                                                <Bell size={15} />
                                              </button>
                                            )}

                                          <button
                                            className="th-action-btn th-edit-btn"
                                            onClick={() => openEditModal(tx)}
                                            title="Edit"
                                          >
                                            <Edit2 size={15} />
                                          </button>

                                          <button
                                            className="th-action-btn th-delete-btn"
                                            onClick={() => setDeleteTarget(tx)}
                                            title="Delete"
                                          >
                                            <Trash2 size={15} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          <Pagination
            currentPage={txnPage}
            totalPages={txnTotalPages}
            onPageChange={setTxnPage}
            totalItems={groupedTransactions.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </section>

      {showModal && (
        <div className="th-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="th-modal" onClick={(e) => e.stopPropagation()}>
            <div className="th-modal-header">
              <h3>{editingTxn ? 'Edit Ledger Entry' : 'Add Ledger Entry'}</h3>
              <button className="th-modal-close" onClick={() => { setShowModal(false); setEditingTxn(null); }}>
                <X size={20} />
              </button>
            </div>

            <form className="th-modal-form" onSubmit={handleSubmit}>
              {formError && <div className="th-form-error">{formError}</div>}

              <div className="th-form-group" ref={dropdownRef}>
                <label>Parent / Student Account *</label>
                <input
                  type="text"
                  placeholder="Search by student name or student number..."
                  value={parentSearch}
                  onChange={handleParentSearchChange}
                  onFocus={() => {
                    if (parentOptions.length) setShowDropdown(true);
                    else searchParents('');
                  }}
                  className="th-form-input"
                  autoComplete="off"
                />

                {showDropdown && parentOptions.length > 0 && (
                  <ul className="th-dropdown-list">
                    {parentOptions.map((p) => (
                      <li
                        key={p.id}
                        className={`th-dropdown-item ${selectedParent?.id === p.id ? 'active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectParent(p)}
                      >
                        <strong>{p.student_name || 'Unnamed Student'}</strong>
                        <span className="th-dropdown-sub">
                          {p.student_number ? `Student No: ${p.student_number}` : p.email}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {showDropdown && parentOptions.length === 0 && (
                  <ul className="th-dropdown-list">
                    <li className="th-dropdown-item th-dropdown-empty">
                      {parentLoading ? 'Searching...' : 'No accounts found'}
                    </li>
                  </ul>
                )}
              </div>

              <div className="th-form-group">
                <label>Student Name</label>
                <input
                  type="text"
                  name="student_name"
                  value={formData.student_name}
                  onChange={handleFormChange}
                  className="th-form-input"
                  placeholder="Auto-filled from student profile"
                />
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Transaction Type *</label>
                  <select
                    name="transaction_type"
                    value={formData.transaction_type}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="th-form-group">
                  <label>Entry Type *</label>
                  <select
                    name="entry_type"
                    value={formData.entry_type}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    {ENTRY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Item *</label>
                  <select
                    name="item"
                    value={formData.item}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    {ITEM_OPTIONS.map((i) => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>

                <div className="th-form-group">
                  <label>Amount (₱) *</label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={handleFormChange}
                    className="th-form-input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>School Year</label>
                  <input
                    type="text"
                    name="school_year"
                    value={formData.school_year}
                    onChange={handleFormChange}
                    className="th-form-input"
                    placeholder="2026-2027"
                  />
                </div>

                <div className="th-form-group">
                  <label>Semester</label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                  </select>
                </div>
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Payment Method</label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="th-form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="th-form-input"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Transaction Date</label>
                  <input
                    type="date"
                    name="transaction_date"
                    value={formData.transaction_date}
                    onChange={handleFormChange}
                    className="th-form-input"
                  />
                </div>

                <div className="th-form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleFormChange}
                    className="th-form-input"
                  />
                </div>
              </div>

              {!editingTxn && (
                <p className="th-auto-ref-note">
                  Reference number will be auto-generated.
                </p>
              )}

              <div className="th-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleFormChange}
                  className="th-form-input"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="th-modal-footer">
                <button
                  type="button"
                  className="th-btn-cancel"
                  onClick={() => { setShowModal(false); setEditingTxn(null); }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="th-btn-success"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingTxn ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="th-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="th-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="th-delete-icon-wrap">
              <Trash2 size={28} />
            </div>
            <h3>Delete Ledger Entry</h3>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.reference_number || `#${deleteTarget.id}`}</strong> for
              <strong> {deleteTarget.student_name}</strong>?
            </p>
            <p className="th-delete-warning">This action cannot be undone.</p>
            <div className="th-delete-actions">
              <button className="th-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="th-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TransactionHistory;