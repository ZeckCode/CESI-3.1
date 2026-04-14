// Notify student that their bill is paid
// const sendPaidNotification = async (transactionId) => {
//   try {
//     const res = await apiFetch(`/api/reminders/payments/${transactionId}/paid/`, { method: 'POST' });
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) throw new Error(data.detail || 'Failed to send paid notification.');
//   } catch (err) {
//     console.error('Error sending paid notification:', err);
//   }
// };

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Filter, Download,
  CheckCircle, Clock,
  Plus, X, ChevronDown, ChevronUp, Edit2, Trash2,
  Bell, Wallet, RotateCcw, CreditCard
} from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import '../AdminWebsiteCSS/TransactionHistory.css';
import Pagination from './Pagination';
import { apiFetch } from '../api/apiFetch';
import PreviewModal from '../PreviewModal';
import Toast from '../Global/Toast';

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
  { value: 'ADVANCE', label: 'Advance Credit' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'ADVANCE_TRANSFER_OUT', label: 'Advance Transfer Out' },
  { value: 'ADVANCE_APPLIED', label: 'Advance Applied' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'POSTED', label: 'Posted' },
];

const EMPTY_FORM = {
  parent: '',
  student_name: '',
  transaction_type: 'TUITION',
  entry_type: 'CREDIT',
  item: 'PAYMENT',
  school_year: '2026-2027',
  amount: '',
  description: '',
  payment_method: 'CASH',
  transaction_date: '',
  due_date: '',
  status: 'PAID',
};

const TXN_SKELETON_ROWS = 6;
const BILLING_DEBIT_ITEMS = new Set(['REGISTRATION', 'INITIAL', 'MONTHLY', 'MISC', 'RESERVATION', 'ASSESSMENT']);

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

const isDueForReminder = (dueDate) => {
  if (!dueDate) return false;

  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due <= today;
};

const canSendReminderForTransaction = (tx) => {
  if (!tx || tx.entry_type !== 'DEBIT') return false;

  // Backend reminder endpoint accepts only transactions explicitly marked
  // as PENDING/OVERDUE.
  const status = String(tx.status || '').toUpperCase();
  if (!['PENDING', 'OVERDUE'].includes(status)) return false;

  if (!isDueForReminder(tx.due_date || tx.transaction_date)) return false;

  return Number(tx.debit || 0) > Number(tx.credit || 0);
};

const TransactionHistory = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total_billed: 0,
    total_collected: 0,
    outstanding_balance: 0,
  });

  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [payForm, setPayForm] = useState({
    student_number: '',
    amount: '',
    payment_method: 'CASH',
    description: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundForm, setRefundForm] = useState({
    student_number: '',
    amount: '',
    payment_method: 'CASH',
    description: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEntryType, setFilterEntryType] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest'); // 'latest' or 'oldest'
  const [showFilters, setShowFilters] = useState(false); // Toggle filters on mobile

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
  const didInitialLoadRef = useRef(false);

  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [previewType, setPreviewType] = useState('summary');
  const [applyingAdvanceKey, setApplyingAdvanceKey] = useState(null);

  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [requestRemarks, setRequestRemarks] = useState({});
  const [activeTab, setActiveTab] = useState('transactions');
  const [toasts, setToasts] = useState([]);

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




  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterEntryType !== 'all') params.append('entry_type', filterEntryType.toUpperCase());

      const res = await apiFetch(`/api/finance/transactions/?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    }
  }, [searchTerm, filterEntryType]);

  const fetchAdvanceRequests = useCallback(async () => {
    try {
      setRequestLoading(true);
      const res = await apiFetch('/api/finance/advance-requests/');
      if (!res.ok) throw new Error('Failed to load advance requests');

      const data = await res.json();
      setAdvanceRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching advance requests:', err);
      setAdvanceRequests([]);
    } finally {
      setRequestLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/finance/transactions/stats/');
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
    if (didInitialLoadRef.current) return;

    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchTransactions(), fetchStats(), fetchAdvanceRequests()]);
      } finally {
        didInitialLoadRef.current = true;
        setLoading(false);
      }
    })();
  }, [fetchTransactions, fetchStats, fetchAdvanceRequests]);

  useEffect(() => {
    if (!didInitialLoadRef.current) return;
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setTxnPage(1);
  }, [searchTerm, filterStatus, filterEntryType]);

  const searchParents = useCallback(async (query) => {
    setParentLoading(true);
    try {
      const res = await apiFetch(`/api/finance/parents/?search=${encodeURIComponent(query)}`);

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
          ['REGISTRATION', 'MONTHLY', 'MISC', 'RESERVATION', 'ASSESSMENT', 'REFUND'].includes(next.item)
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
      const statusValue = String(formData.status || '').toUpperCase() === 'OVERDUE'
        ? 'PENDING'
        : formData.status;

      const body = {
        ...formData,
        amount: parseFloat(formData.amount).toFixed(2),
        due_date: formData.due_date || null,
        transaction_date: formData.transaction_date || null,
        status: statusValue,
      };
      if (editingTxn) {
      delete body.parent;
    }
      const isEdit = !!editingTxn;
      const url = isEdit
        ? `/api/finance/transactions/${editingTxn.id}/`
        : '/api/finance/transactions/';

      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      addToast('Success', editingTxn ? 'Transaction updated successfully!' : 'Transaction created successfully!', 'success');
    } catch (err) {
      setFormError(err.message);
      addToast('Error', err.message || 'Failed to save transaction', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/finance/transactions/${deleteTarget.id}/`, { method: 'DELETE' });

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete');
      }

      setDeleteTarget(null);
      fetchTransactions();
      fetchStats();
      addToast('Success', 'Transaction deleted successfully!', 'success');
    } catch (err) {
      addToast('Error', err.message || 'Failed to delete transaction', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const sendReminder = async (transactionId) => {
    setSendingReminderId(transactionId);
    try {
      const res = await apiFetch(`/api/reminders/payments/${transactionId}/send/`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to send reminder.');
      addToast('Success', data.detail || 'Payment reminder sent successfully!', 'success');
    } catch (err) {
      console.error('Error sending reminder:', err);
      addToast('Error', err.message || 'Failed to send reminder.', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    try {
      const res = await apiFetch('/api/reminders/payments/send-bulk/', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to send bulk reminders.');
      addToast('Success', data.detail || 'Bulk reminders sent successfully!', 'success');
    } catch (err) {
      console.error('Error sending bulk reminders:', err);
      addToast('Error', err.message || 'Failed to send bulk reminders.', 'error');
    } finally {
      setSendingBulk(false);
    }
  };

  const handleOpenPreview = () => {
    try {
      const summaryData = groupedTransactions.map((group) => ({
        'Date': group.latest_date || '—',
        'Enrollment ID': group.enrollment_id || '—',
        'Student Number': group.student_number,
        'Student Name': group.student_name,
        'School Year': group.school_year || '—',
        'Grade Level': group.grade_level || '—',
        'Student Type': formatStudentType(group.student_type),
        'Payment Mode': formatPaymentMode(group.payment_mode),
        'Total Debit': Number(group.total_debit || 0),
        'Total Credit': Number(group.total_credit || 0),
        'Balance': Number(group.balance || 0),
        'Status': getDisplayGroupStatuses(group).join(' / '),
      }));

      setPreviewData(summaryData);
      setPreviewType('summary');
      setShowPreview(true);
    } catch (err) {
      console.error('Error opening preview:', err);
      addToast('Error', 'Failed to open preview. Please try again.', 'error');
    }
  };

  const exportPreviewToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Transaction History');
      const timestamp = new Date().toISOString().slice(0, 10);

      const columns = [
        { header: 'Date', key: 'Date', width: 12 },
        { header: 'Enrollment ID', key: 'Enrollment ID', width: 10 },
        { header: 'Student Number', key: 'Student Number', width: 18 },
        { header: 'Student Name', key: 'Student Name', width: 27 },
        { header: 'School Year', key: 'School Year', width: 12 },
        { header: 'Grade Level', key: 'Grade Level', width: 12 },
        { header: 'Student Type', key: 'Student Type', width: 12 },
        { header: 'Payment Mode', key: 'Payment Mode', width: 16 },
        { header: 'Total Debit', key: 'Total Debit', width: 14 },
        { header: 'Total Credit', key: 'Total Credit', width: 14 },
        { header: 'Balance', key: 'Balance', width: 14 },
        { header: 'Status', key: 'Status', width: 12 },
      ];

      ws.columns = columns;

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.font = { bold: true, color: { rgb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF667EEA' } };
        cell.border = {
          top: { style: 'thin', color: { rgb: 'FF000000' } },
          left: { style: 'thin', color: { rgb: 'FF000000' } },
          bottom: { style: 'thin', color: { rgb: 'FF000000' } },
          right: { style: 'thin', color: { rgb: 'FF000000' } }
        };
      });

      // Add data rows
      previewData.forEach((row) => {
        const dataRow = ws.addRow(row);
        dataRow.eachCell((cell, colNumber) => {
          // Left align Student Name (column 4), center align all others
          const align = colNumber === 4 ? 'left' : 'center';
          cell.alignment = { horizontal: align, vertical: 'center' };
          cell.border = {
            top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { rgb: 'FFD3D3D3' } }
          };
        });
      });

      // Generate buffer and download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Transaction_History_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('✓ Excel file downloaded successfully!');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  const exportPreviewToPDF = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const timestamp = new Date().toISOString().slice(0, 10);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;

      // Add title
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Transaction History Report', margin, 15);

      // Add underline
      doc.setDrawColor(0, 123, 255);
      doc.setLineWidth(1);
      doc.line(margin, 18, pageWidth - margin, 18);

      // Add timestamp
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 25);

      const headers = ['DATE', 'ENROLLMENT ID', 'STUDENT NUMBER', 'STUDENT NAME', 'SCHOOL YEAR', 'GRADE LEVEL', 'STUDENT TYPE', 'PAYMENT MODE', 'TOTAL DEBIT', 'TOTAL CREDIT', 'BALANCE', 'STATUS'];
      const keys = ['Date', 'Enrollment ID', 'Student Number', 'Student Name', 'School Year', 'Grade Level', 'Student Type', 'Payment Mode', 'Total Debit', 'Total Credit', 'Balance', 'Status'];

      const rows = previewData.map(row => keys.map(key => row[key]));

      // Column widths: Date narrow, Enrollment ID wider, Student Name wider, others proportional
      const dateWidth = usableWidth * 0.08;
      const enrollmentIdWidth = usableWidth * 0.08;
      const studentNameWidth = usableWidth * 0.18;
      const remainingWidth = usableWidth - dateWidth - enrollmentIdWidth - studentNameWidth;
      const otherColWidth = remainingWidth / (headers.length - 3);

      const getColWidth = (idx) => {
        if (idx === 0) return dateWidth;
        if (idx === 1) return enrollmentIdWidth;
        if (idx === 3) return studentNameWidth;
        return otherColWidth;
      };

      const headerRowHeight = 10;
      const rowHeight = 8;
      let yPos = 32;

      // Draw header row
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);

        doc.setFillColor(0, 123, 255);
        doc.rect(xPos, yPos, colW, headerRowHeight, 'F');
        doc.setDrawColor(0, 123, 255);
        doc.setLineWidth(0.5);
        doc.rect(xPos, yPos, colW, headerRowHeight);

        if (idx < headers.length - 1) {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(1.5);
          doc.line(xPos + colW, yPos, xPos + colW, yPos + headerRowHeight);
        }
      });

      // Draw header text
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);
        const centerX = xPos + colW / 2;
        doc.text(header, centerX, yPos + 6, { maxWidth: colW - 2, align: 'center' });
      });

      yPos += headerRowHeight;

      // Draw body rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      rows.forEach((row, rowIdx) => {
        if (yPos + rowHeight > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        const isEvenRow = rowIdx % 2 === 0;
        const bgColor = isEvenRow ? [255, 255, 255] : [245, 245, 245];

        // Draw all cells
        row.forEach((cell, colIdx) => {
          let xPos = margin;
          for (let i = 0; i < colIdx; i++) {
            xPos += getColWidth(i);
          }
          const colW = getColWidth(colIdx);

          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(xPos, yPos, colW, rowHeight, 'F');

          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(xPos, yPos, colW, rowHeight);
        });

        // Draw text
        doc.setTextColor(0, 0, 0);
        row.forEach((cell, colIdx) => {
          let xPos = margin;
          for (let i = 0; i < colIdx; i++) {
            xPos += getColWidth(i);
          }
          const colW = getColWidth(colIdx);

          // Left align Student Name (index 3), center align all others including Date
          if (colIdx === 3) {
            doc.text(String(cell), xPos + 2, yPos + 5, { maxWidth: colW - 4 });
          } else {
            const centerX = xPos + colW / 2;
            doc.text(String(cell), centerX, yPos + 5, { maxWidth: colW - 4, align: 'center' });
          }
        });

        yPos += rowHeight;
      });

      doc.save(`Transaction_History_${timestamp}.pdf`);
      alert('✓ PDF file downloaded successfully!');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const itemLabel = (val) => ITEM_OPTIONS.find((i) => i.value === val)?.label || val;
  const entryLabel = (val) => ENTRY_TYPES.find((e) => e.value === val)?.label || val;

  const statusClass = (s) => {
    if (!s) return '';
    return String(s).toLowerCase();
  };

  const getGroupStatuses = (group) => {
    if (Array.isArray(group?.account_statuses) && group.account_statuses.length > 0) {
      return group.account_statuses;
    }

    return group?.account_status ? [group.account_status] : [];
  };

  const getDisplayGroupStatuses = (group) => {
    const statuses = getGroupStatuses(group)
      .map((status) => String(status || '').toUpperCase())
      .filter(Boolean)
      .map((status) => (status === 'PENDING' ? 'PARTIAL' : status));

    return Array.from(new Set(statuses));
  };

  const sortLedgerRows = useCallback((a, b) => {
    const rankA = String(a?.entry_type || '').toUpperCase() === 'CREDIT' ? 1 : 0;
    const rankB = String(b?.entry_type || '').toUpperCase() === 'CREDIT' ? 1 : 0;
    const rankCompare = rankA - rankB;
    if (rankCompare !== 0) return rankCompare;

    const dateA = String(a?.date_posted || a?.transaction_date || '');
    const dateB = String(b?.date_posted || b?.transaction_date || '');
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;

    return Number(a.id || 0) - Number(b.id || 0);
  }, []);

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
            latest_date: tx.date_posted || tx.transaction_date || '',
            total_debit: 0,
            total_credit: 0,
            balance: 0,
            rawBalance: 0,
            refundableExcess: 0,
            account_status: 'PAID',
            account_statuses: ['PAID'],
            rows: [],
          });
        }

        const group = map.get(enrollmentKey);
        group.rows.push(tx);
        group.total_debit += Number(tx.debit || 0);
        group.total_credit += Number(tx.credit || 0);

        if ((tx.date_posted || '') > group.latest_date) {
          group.latest_date = tx.date_posted || '';
        }
      });

      const result = Array.from(map.values()).map((group) => {
        const sortedRows = group.rows
          .slice()
          .sort(sortLedgerRows);

        let remainingCredit = sortedRows.reduce(
          (sum, tx) => sum + Number(tx.credit || 0),
          0
        );

        const debitStatusMap = new Map();
        sortedRows
          .filter((tx) => String(tx.entry_type || '').toUpperCase() === 'DEBIT')
          .sort((a, b) => {
            const dateA = String(a.due_date || a.date_posted || a.transaction_date || '');
            const dateB = String(b.due_date || b.date_posted || b.transaction_date || '');
            const dateCompare = dateA.localeCompare(dateB);
            if (dateCompare !== 0) return dateCompare;
            return Number(a.id || 0) - Number(b.id || 0);
          })
          .forEach((tx) => {
            const debitAmount = Number(tx.debit || 0);
            // Only use due_date for determining overdue status, not posted/transaction dates
            const isPastDue = isDueForReminder(tx.due_date);
            const isBillingDebit = BILLING_DEBIT_ITEMS.has(String(tx.item || '').toUpperCase());

            if (!isBillingDebit || debitAmount <= 0) {
              debitStatusMap.set(tx.id, String(tx.status || 'POSTED').toUpperCase());
              return;
            }

            if (remainingCredit >= debitAmount) {
              debitStatusMap.set(tx.id, 'PAID');
              remainingCredit -= debitAmount;
              return;
            }

            if (remainingCredit > 0) {
              remainingCredit = 0;
              debitStatusMap.set(tx.id, isPastDue ? 'OVERDUE' : 'PARTIAL');
              return;
            }

            debitStatusMap.set(tx.id, isPastDue ? 'OVERDUE' : 'PENDING');
          });

        let runningBalance = 0;
        const normalizedRows = sortedRows.map((tx) => {
          const debit = Number(tx.debit || 0);
          const credit = Number(tx.credit || 0);
          runningBalance += debit - credit;

          const effectiveStatus =
            String(tx.entry_type || '').toUpperCase() === 'DEBIT'
              ? debitStatusMap.get(tx.id) || String(tx.status || 'POSTED').toUpperCase()
              : String(tx.status || 'PAID').toUpperCase();

          return {
            ...tx,
            _runningBalance: runningBalance,
            _effectiveStatus: effectiveStatus,
          };
        });

        const rawBalance = runningBalance;
        const payableBalance = rawBalance > 0 ? rawBalance : 0;
        const refundableExcess = rawBalance < 0 ? Math.abs(rawBalance) : 0;

        const hasOverdueDebit = normalizedRows.some((tx) => {
          if (String(tx.entry_type || '').toUpperCase() !== 'DEBIT') return false;

          return String(tx._effectiveStatus || tx.status || '').toUpperCase() === 'OVERDUE';
        });

        const hasPendingDebit = normalizedRows.some((tx) => {
          if (String(tx.entry_type || '').toUpperCase() !== 'DEBIT') return false;

          return String(tx._effectiveStatus || tx.status || '').toUpperCase() === 'PENDING';
        });

        const hasPartialDebit = normalizedRows.some((tx) => {
          if (String(tx.entry_type || '').toUpperCase() !== 'DEBIT') return false;

          return String(tx._effectiveStatus || tx.status || '').toUpperCase() === 'PARTIAL';
        });

        const accountStatuses = Array.from(
          new Set(
            normalizedRows
              .filter((tx) => String(tx.entry_type || '').toUpperCase() === 'DEBIT')
              .map((tx) => String(tx._effectiveStatus || tx.status || '').toUpperCase())
              .filter(Boolean)
          )
        ).filter((status) => status !== '');

        let derivedStatus = 'PAID';
        let derivedStatuses = ['PAID'];
        if (payableBalance > 0) {
          if (hasOverdueDebit) {
            derivedStatus = 'OVERDUE';
            derivedStatuses = ['OVERDUE'];
          } else if (hasPartialDebit || group.total_credit > 0) {
            derivedStatus = 'PARTIAL';
            derivedStatuses = ['PARTIAL'];
            if (accountStatuses.includes('PENDING')) {
              derivedStatuses.push('PENDING');
            }
          } else if (hasPendingDebit) {
            derivedStatus = 'PENDING';
            derivedStatuses = ['PENDING'];
          } else {
            derivedStatus = 'PENDING';
            derivedStatuses = ['PENDING'];
          }
        } else if (accountStatuses.length > 0) {
          derivedStatus = accountStatuses[0];
          derivedStatuses = accountStatuses;
        }

        return {
          ...group,
          rows: normalizedRows,
          balance: payableBalance,
          rawBalance,
          refundableExcess,
          account_status: derivedStatus,
          account_statuses: derivedStatuses,
        };
      });

      return result.sort((a, b) => {
        const comparison = String(b.latest_date || '').localeCompare(String(a.latest_date || ''));
        return sortOrder === 'latest' ? comparison : -comparison;
      });
    }, [transactions, sortOrder, sortLedgerRows]);

  const filteredTransactions = useMemo(() => {
    if (filterStatus === 'all') return groupedTransactions;

    const selectedStatus = String(filterStatus || '').trim().toUpperCase();
    return groupedTransactions.filter(
      (group) => getDisplayGroupStatuses(group).includes(selectedStatus)
    );
  }, [groupedTransactions, filterStatus]);

  const txnTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((txnPage - 1) * ITEMS_PER_PAGE, txnPage * ITEMS_PER_PAGE),
    [filteredTransactions, txnPage]
  );

  const isReminderEligible = (group) =>
    Number(group.balance || 0) > 0 &&
    (group.rows || []).some((tx) => canSendReminderForTransaction(tx));

  const getReminderTargetForGroup = (group) =>
    (group?.rows || []).find((tx) => canSendReminderForTransaction(tx)) || null;

  const getAdvanceCredit = useCallback((group) =>
    (group?.rows || []).reduce((sum, tx) => {
      if (tx.entry_type === 'CREDIT' && tx.item === 'ADVANCE') {
        return sum + Number(tx.credit || tx.amount || 0);
      }
      return sum;
    }, 0), []);

  const getTransferredOrRefundedAdvance = useCallback((group) =>
    (group?.rows || []).reduce((sum, tx) => {
      if (
        tx.entry_type === 'DEBIT' &&
        ['REFUND', 'ADVANCE_TRANSFER_OUT'].includes(String(tx.item || '').toUpperCase())
      ) {
        return sum + Number(tx.debit || tx.amount || 0);
      }
      return sum;
    }, 0), []);

  const getRefundableAmount = useCallback((group) => {
    if (!group) return 0;

    const refundable = getAdvanceCredit(group) - getTransferredOrRefundedAdvance(group);
    return refundable > 0 ? refundable : 0;
  }, [getAdvanceCredit, getTransferredOrRefundedAdvance]);

  const openPayModal = (group) => {
    const balance = Number(group.balance || 0);

    setSelectedLedger(group);
    setPayError('');
    setPayForm({
      student_number: group.student_number || '',
      amount: balance > 0 ? String(balance) : '',
      payment_method: 'CASH',
      description: '',
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    setShowPayModal(true);
  };

  const openRefundModal = (group) => {
    setSelectedLedger(group);
    setRefundError('');
    setRefundForm({
      student_number: group.student_number || '',
      amount: '',
      payment_method: 'CASH',
      description: '',
    });
    setShowRefundModal(true);
  };

  const handlePayFormChange = (e) => {
    const { name, value } = e.target;
    setPayForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRefundFormChange = (e) => {
    const { name, value } = e.target;
    setRefundForm((prev) => ({ ...prev, [name]: value }));
  };

  const setFullPayment = () => {
    if (!selectedLedger) return;
    setPayForm((prev) => ({
      ...prev,
      amount: String(Number(selectedLedger.balance || 0)),
    }));
  };

  const canApplyAdvance = (group) =>
    Number(group.balance || 0) > 0 && Number(getRefundableAmount(group)) > 0;

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setPayError('');

    if (!payForm.student_number) {
      setPayError('Student number is required.');
      return;
    }

    if (!payForm.amount || Number(payForm.amount) <= 0) {
      setPayError('Please enter a valid payment amount.');
      return;
    }

    setPaying(true);
    try {
      const res = await apiFetch('/api/finance/ledgers/pay/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_number: payForm.student_number,
          amount: Number(payForm.amount),
          payment_method: payForm.payment_method,
          description: payForm.description,
          transaction_date: payForm.transaction_date || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to post payment.');
      }

      

      let message = `Payment posted successfully. Applied: ${formatCurrency(data.applied_amount)}.`;
      if (Number(data.excess_amount || 0) > 0) {
        message += ` Excess recorded: ${formatCurrency(data.excess_amount)}.`;
      }
      addToast('Success', message, 'success');
      setShowPayModal(false);
      setSelectedLedger(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      setPayError(err.message || 'Failed to post payment.');
      addToast('Error', err.message || 'Failed to post payment.', 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitRefund = async (e) => {
    e.preventDefault();
    setRefundError('');

    if (!refundForm.student_number) {
      setRefundError('Student number is required.');
      return;
    }

    if (!refundForm.amount || Number(refundForm.amount) <= 0) {
      setRefundError('Please enter a valid refund amount.');
      return;
    }

    setRefunding(true);
    try {
      const res = await apiFetch('/api/finance/ledgers/refund/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_number: refundForm.student_number,
          amount: Number(refundForm.amount),
          payment_method: refundForm.payment_method,
          description: refundForm.description,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to process refund.');
      }

      addToast('Success', `Refund posted successfully. Refunded: ${formatCurrency(data.refunded_amount)}`, 'success');
      setShowRefundModal(false);
      setSelectedLedger(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      setRefundError(err.message || 'Failed to process refund.');
      addToast('Error', err.message || 'Failed to process refund.', 'error');
    } finally {
      setRefunding(false);
    }
  };
  
  const handleApplyAdvance = async (group) => {
    if (!group?.student_number) {
      addToast('Error', 'Student number is missing.', 'error');
      return;
    }

    setApplyingAdvanceKey(group.key);
    try {
      const res = await apiFetch('/api/finance/ledgers/auto-apply-advance/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_number: group.student_number,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to apply advance.');
      }

      addToast('Success', `Advance applied successfully. Applied: ${formatCurrency(data.applied_amount)}. New balance: ${formatCurrency(data.new_balance)}.`, 'success');

      fetchTransactions();
      fetchStats();
    } catch (err) {
      addToast('Error', err.message || 'Failed to apply advance.', 'error');
    } finally {
      setApplyingAdvanceKey(null);
    }
  };

  const handleRequestRemarksChange = (requestId, value) => {
    setRequestRemarks((prev) => ({
      ...prev,
      [requestId]: value,
    }));
  };

  const handleAdvanceRequestAction = async (requestId, actionType) => {
    setProcessingRequestId(requestId);

    try {
      const res = await apiFetch(`/api/finance/advance-requests/${requestId}/process/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          remarks: requestRemarks[requestId] || '',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to ${actionType.toLowerCase()} request.`);
      }

      const successMsg = actionType === 'PROCESS'
        ? 'Request processed successfully.'
        : `Request ${actionType.toLowerCase()}d successfully.`;
      addToast('Success', successMsg, 'success');

      fetchAdvanceRequests();
      fetchTransactions();
      fetchStats();
    } catch (err) {
      addToast('Error', err.message || `Failed to ${actionType.toLowerCase()} request.`, 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const requestTypeLabel = (value) => {
    const map = {
      APPLY_ADVANCE: 'Apply Advance',
      REFUND: 'Refund',
    };
    return map[value] || value || '—';
  };

  const requestStatusClass = (value) => String(value || '').toLowerCase();

  const canProcessRequest = (req) => req.status === 'APPROVED';

  const financialInsights = useMemo(() => {
    const totalBilled = Number(stats.total_billed || 0);
    const totalCollected = Number(stats.total_collected || 0);
    const outstanding = Number(stats.outstanding_balance || 0);

    const collectionRate =
      totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const exposureRate =
      totalBilled > 0 ? Math.round((outstanding / totalBilled) * 100) : 0;

    const overdueLedgers = groupedTransactions.filter((group) =>
      getGroupStatuses(group).includes('OVERDUE')
    ).length;

    const partialLedgers = groupedTransactions.filter((group) =>
      getDisplayGroupStatuses(group).includes('PARTIAL')
    ).length;

    const reminderQueue = groupedTransactions.filter(
      (group) =>
        Number(group.balance || 0) > 0 &&
        getGroupStatuses(group).some((status) => ['PENDING', 'OVERDUE'].includes(status))
    ).length;

    const advancePool = groupedTransactions.reduce(
      (sum, group) => sum + Number(getRefundableAmount(group) || 0),
      0
    );

    const pendingRequests = advanceRequests.filter(
      (req) => String(req.status || '').toUpperCase() === 'PENDING'
    ).length;

    const approvedRequests = advanceRequests.filter(
      (req) => String(req.status || '').toUpperCase() === 'APPROVED'
    ).length;

    return [
      {
        title: 'Collection Interpretation',
        body: `Collected ${formatCurrency(totalCollected)} out of ${formatCurrency(
          totalBilled
        )} (${collectionRate}% collection rate).`,
      },
      {
        title: 'Outstanding Exposure',
        body: `Current unpaid exposure is ${formatCurrency(outstanding)} (${exposureRate}% of billed amount), with ${overdueLedgers} overdue and ${partialLedgers} partial ledgers.`,
      },
      {
        title: 'Action Queue',
        body: `${reminderQueue} ledger${
          reminderQueue === 1 ? '' : 's'
        } are reminder-eligible. Advance/refund queue has ${pendingRequests} pending and ${approvedRequests} approved request${
          approvedRequests === 1 ? '' : 's'
        }.`,
      },
      {
        title: 'Advance Credit Signal',
        body:
          advancePool > 0
            ? `Refundable advance currently totals ${formatCurrency(advancePool)}, which can offset payable balances before additional billing.`
            : 'No refundable advance credit detected in the current ledger scope.',
      },
    ];
  }, [
    stats.total_billed,
    stats.total_collected,
    stats.outstanding_balance,
    groupedTransactions,
    advanceRequests,
    getRefundableAmount,
  ]);

  const renderSkeletonRows = (columnCount) =>
    Array.from({ length: TXN_SKELETON_ROWS }).map((_, rowIdx) => (
      <tr key={`th-skeleton-row-${rowIdx}`}>
        {Array.from({ length: columnCount }).map((__, colIdx) => (
          <td key={`th-skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`th-skeleton-line ${
                colIdx === 0 ? 'w-md' : colIdx === columnCount - 1 ? 'w-sm' : 'w-lg'
              }`}
            />
          </td>
        ))}
      </tr>
    ));

  return (
    <main className="transaction-history-main">
      <section className="th-section">
        {loading ? (
          <div className="th-stats-grid">
            <div className="th-stat-card th-skeleton-stat-card">
              <div className="th-skeleton-line w-md" />
              <div className="th-skeleton-line w-sm" />
            </div>
            <div className="th-stat-card th-skeleton-stat-card">
              <div className="th-skeleton-line w-md" />
              <div className="th-skeleton-line w-sm" />
            </div>
            <div className="th-stat-card th-skeleton-stat-card">
              <div className="th-skeleton-line w-md" />
              <div className="th-skeleton-line w-sm" />
            </div>
          </div>
        ) : (
          <div className="th-stats-grid">
            <div className="th-stat-card th-stat-blue">
              <div className="th-stat-header">
                <span className="th-stat-label">Total Billed</span>
                <Wallet size={24} className="th-stat-icon" />
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
        )}
      </section>

      <section className="th-section">
        {loading ? (
          <div className="th-insights-panel th-skeleton-panel">
            <div className="th-insights-header">
              <div className="th-skeleton-line th-skeleton-title" />
              <div className="th-skeleton-line th-skeleton-subtitle" />
            </div>

            <div className="th-insights-grid">
              {Array.from({ length: 4 }).map((_, idx) => (
                <article key={`th-skeleton-insight-${idx}`} className="th-insight-card">
                  <div className="th-skeleton-line w-md" style={{ marginBottom: 8 }} />
                  <div className="th-skeleton-line w-lg" style={{ marginBottom: 6 }} />
                  <div className="th-skeleton-line w-sm" />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="th-insights-panel">
            <div className="th-insights-header">
              <h3 className="th-insights-title">Descriptive Financial Analysis</h3>
              <p className="th-insights-subtitle">
                Interpreted finance signals from ledger, collection, and request activity.
              </p>
            </div>

            <div className="th-insights-grid">
              {financialInsights.map((insight) => (
                <article key={insight.title} className="th-insight-card">
                  <h4 className="th-insight-card-title">{insight.title}</h4>
                  <p className="th-insight-card-text">{insight.body}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="th-section">
        <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('transactions')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'transactions' ? '600' : '500',
                color: activeTab === 'transactions' ? '#0f172a' : '#64748b',
                borderBottom: activeTab === 'transactions' ? '2px solid #3b82f6' : 'none',
                marginBottom: '-1px',
              }}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('advance-refund')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === 'advance-refund' ? '600' : '500',
                color: activeTab === 'advance-refund' ? '#0f172a' : '#64748b',
                borderBottom: activeTab === 'advance-refund' ? '2px solid #3b82f6' : 'none',
                marginBottom: '-1px',
              }}
            >
              Advance / Refund
            </button>
          </div>
        </div>

        {activeTab === 'transactions' && (
        <div>
        {loading ? (
          <div className="th-section-header th-section-header-skeleton">
            <div>
              <div className="th-skeleton-line th-skeleton-section-title" />
              <div className="th-skeleton-line th-skeleton-section-subtitle" />
            </div>
            <div className="th-header-actions">
              <div className="th-skeleton-line th-skeleton-control" />
              <div className="th-skeleton-line th-skeleton-control" />
              <div className="th-skeleton-line th-skeleton-control" />
            </div>
          </div>
        ) : (
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

            <button className="th-btn-primary" onClick={handleOpenPreview}>
              <Download size={18} /> View & Export
            </button>
          </div>
        </div>
        )}

        {loading ? (
          <div className="th-filters-container th-filters-skeleton" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <div className="th-skeleton-line th-skeleton-search" />
            <div className="th-skeleton-line th-skeleton-filter" />
            <div className="th-skeleton-line th-skeleton-filter" />
            <div className="th-skeleton-line th-skeleton-filter" />
          </div>
        ) : (
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

          {/* Mobile: Toggle filters button */}
          <button
            className="th-filters-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <Filter size={18} />
            <span>Filters</span>
          </button>

          {/* Filters - visible on desktop, hidden on mobile by default */}
          <div className={`th-filters-group ${showFilters ? 'th-filters-visible' : ''}`}>
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
                <option value="overdue">Overdue</option>
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

            <div className="th-filter-group">
              <Filter size={20} />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="th-filter-select"
              >
                <option value="latest">Latest to Oldest</option>
                <option value="oldest">Oldest to Latest</option>
              </select>
            </div>
          </div>
        </div>
        )}

        <div className="th-table-wrapper">
          <div className="th-table-scroll-hint">← Swipe to scroll →</div>
          <div className="th-table-container">
            {loading ? (
              <table className="th-table th-table-skeleton" aria-hidden="true">
                <thead>
                  <tr>
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <th key={`th-skel-head-tx-${idx}`}>
                        <div className="th-skeleton-line th-skeleton-head" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{renderSkeletonRows(10)}</tbody>
              </table>
            ) : (
            <table className="th-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Enrollment</th>
                  <th>Student No.</th>
                  <th>Student Name</th>
                  <th>Total Debit</th>
                  <th>Total Credit</th>
                  <th>Balance</th>
                  <th>Advance Available</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((group) => {
                  const reminderTarget = getReminderTargetForGroup(group);

                  return (
                  <React.Fragment key={group.key}>
                    <tr>
                      <td>{group.latest_date || '—'}</td>
                      <td>
                        {group.enrollment_id ? `#${group.enrollment_id}` : '—'}
                      </td>
                      <td>{group.student_number}</td>
                      <td className="th-student-name-cell">{group.student_name}</td>
                      <td className="th-amount-cell">{formatCurrency(group.total_debit)}</td>
                      <td className="th-amount-cell">{formatCurrency(group.total_credit)}</td>
                      <td className="th-amount-cell">{formatCurrency(group.balance)}</td>
                      <td className="th-amount-cell">
                        {getRefundableAmount(group) > 0 ? formatCurrency(getRefundableAmount(group)) : '—'}
                      </td>
                      <td>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {getDisplayGroupStatuses(group).map((status) => (
                              <span key={status} className={`th-status-badge th-status-${statusClass(status)}`}>
                                {status}
                              </span>
                            ))}

                            {Number(getRefundableAmount(group)) > 0 && (
                              <span className="th-status-badge th-status-advance">
                                Advance {formatCurrency(getRefundableAmount(group))}
                              </span>
                            )}
                          </div>
                        </td>
                      <td className="th-actions-cell">
                          {Number(group.balance || 0) > 0 && (
                            <button
                              className="th-action-btn th-pay-btn"
                              onClick={() => openPayModal(group)}
                              title="Pay Balance"
                            >
                              <CreditCard size={15} />
                            </button>
                          )}

                          {canApplyAdvance(group) && (
                            <button
                              className="th-action-btn th-advance-btn"
                              onClick={() => handleApplyAdvance(group)}
                              title={`Apply Advance (${formatCurrency(getRefundableAmount(group))})`}
                              disabled={applyingAdvanceKey === group.key}
                            >
                              <Wallet size={15} />
                            </button>
                          )}

                          {getRefundableAmount(group) > 0 && (
                            <button
                              className="th-action-btn th-refund-btn"
                              onClick={() => openRefundModal(group)}
                              title={`Refund Available (${formatCurrency(getRefundableAmount(group))})`}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}

                          {isReminderEligible(group) && (
                            <button
                              className="th-action-btn th-reminder-btn"
                              onClick={() => reminderTarget && sendReminder(reminderTarget.id)}
                              title="Send Reminder"
                              disabled={!reminderTarget || sendingReminderId === reminderTarget.id}
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
                        <td colSpan="10">
                          <div className="th-student-detail-panel">
                            <h4 className="th-detail-title">{buildLedgerGroupTitle(group)}</h4>

                               <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                                Student: <strong>{group.student_name}</strong> ({group.student_number}) | Payable Balance:{' '}
                                <strong>{formatCurrency(group.balance)}</strong> | Advance Available:{' '}
                                <strong>{formatCurrency(getRefundableAmount(group))}</strong> | Ref:{' '}
                                <strong>{group.enrollment_id ? `Enrollment #${group.enrollment_id}` : 'Legacy ledger record'}</strong>
                              </div>

                            <div className="th-table-wrapper" style={{ marginTop: '0.75rem' }}>
                              <div className="th-table-scroll-hint">← Swipe to scroll →</div>
                              <div className="th-table-container">
                                <table className="th-table">
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Due Date</th>
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
                                    .sort(sortLedgerRows)
                                    .map((tx) => (
                                      <tr key={tx.id}>
                                        <td>{tx.date_posted || tx.transaction_date || '—'}</td>
                                        <td>
                                          {String(tx.entry_type || '').toUpperCase() === 'DEBIT' &&
                                          BILLING_DEBIT_ITEMS.has(String(tx.item || '').toUpperCase())
                                            ? (tx.due_date || '—')
                                            : '—'}
                                        </td>
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
                                          <span className={`th-status-badge th-status-${statusClass((tx._effectiveStatus || tx.status) === 'PENDING' ? 'PARTIAL' : tx._effectiveStatus || tx.status)}`}>
                                            {(tx._effectiveStatus || tx.status) === 'PENDING' ? 'PARTIAL' : tx._effectiveStatus || tx.status}
                                          </span>
                                        </td>
                                        <td className="th-actions-cell">
                                          {canSendReminderForTransaction(tx) && (
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
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
          )}
          </div>
        </div>

        {!loading && (
          <Pagination
            currentPage={txnPage}
            totalPages={txnTotalPages}
            onPageChange={setTxnPage}
            totalItems={filteredTransactions.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>
      )}

      {activeTab === 'advance-refund' && (
      <div>
        {loading ? (
          <div className="th-section-header th-section-header-skeleton">
            <div>
              <div className="th-skeleton-line th-skeleton-section-title" />
              <div className="th-skeleton-line th-skeleton-section-subtitle" />
            </div>
          </div>
        ) : (
          <div className="th-section-header">
            <div>
              <h2 className="th-section-title">Advance / Refund Requests</h2>
              <p className="th-section-subtitle">Review and process student-submitted requests</p>
            </div>
          </div>
        )}

        <div className="th-table-wrapper">
          <div className="th-table-scroll-hint">← Swipe to scroll →</div>
          <div className="th-table-container">
            <table className="th-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Student</th>
                  <th>Student No.</th>
                  <th>Enrollment</th>
                  <th>Request Type</th>
                  <th>Amount</th>
                  <th>Reason</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows(10)
              ) : requestLoading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Loading requests...
                  </td>
                </tr>
              ) : advanceRequests.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No advance/refund requests found.
                  </td>
                </tr>
              ) : (
                advanceRequests.map((req) => (
                  <tr key={req.id}>
                    <td>{req.created_at ? new Date(req.created_at).toLocaleString() : '—'}</td>
                    <td>{req.student_name || '—'}</td>
                    <td>{req.student_number || '—'}</td>
                    <td>{req.enrollment ? `#${req.enrollment}` : '—'}</td>
                    <td>{requestTypeLabel(req.request_type)}</td>
                    <td className="th-amount-cell">{formatCurrency(req.amount)}</td>
                    <td>{req.reason || '—'}</td>
                    <td>
                      <span className={`th-status-badge th-status-${requestStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ minWidth: '220px' }}>
                      <textarea
                        rows="2"
                        value={requestRemarks[req.id] ?? req.admin_remarks ?? ''}
                        onChange={(e) => handleRequestRemarksChange(req.id, e.target.value)}
                        className="th-form-input"
                        placeholder="Admin remarks..."
                        disabled={processingRequestId === req.id}
                      />
                    </td>
                    <td className="th-actions-cell" style={{ whiteSpace: 'nowrap' }}>
                      {req.status !== 'REJECTED' && req.status !== 'PROCESSED' && (
                        <button
                          className="th-action-btn th-pay-btn"
                          onClick={() => handleAdvanceRequestAction(req.id, 'APPROVE')}
                          title="Approve Request"
                          disabled={processingRequestId === req.id}
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}

                      {req.status !== 'PROCESSED' && req.status !== 'REJECTED' && (
                        <button
                          className="th-action-btn th-refund-btn"
                          onClick={() => handleAdvanceRequestAction(req.id, 'REJECT')}
                          title="Reject Request"
                          disabled={processingRequestId === req.id}
                        >
                          <X size={15} />
                        </button>
                      )}

                      {canProcessRequest(req) && (
                        <button
                          className="th-action-btn th-advance-btn"
                          onClick={() => handleAdvanceRequestAction(req.id, 'PROCESS')}
                          title="Process Request"
                          disabled={processingRequestId === req.id}
                        >
                          <Wallet size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        </div>
        )}
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

      {showPayModal && (
        <div className="th-modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="th-modal" onClick={(e) => e.stopPropagation()}>
            <div className="th-modal-header">
              <h3>Pay Balance</h3>
              <button className="th-modal-close" onClick={() => setShowPayModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form className="th-modal-form" onSubmit={handleSubmitPayment}>
              {payError && <div className="th-form-error">{payError}</div>}

              <div className="th-form-group">
                <label>Student Number</label>
                <input
                  type="text"
                  name="student_number"
                  value={payForm.student_number}
                  onChange={handlePayFormChange}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-group">
                <label>Student Name</label>
                <input
                  type="text"
                  value={selectedLedger?.student_name || ''}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-group">
                <label>Current Balance</label>
                <input
                  type="text"
                  value={formatCurrency(selectedLedger?.balance || 0)}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Amount to Pay *</label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={payForm.amount}
                    onChange={handlePayFormChange}
                    className="th-form-input"
                    placeholder="0.00"
                  />
                </div>

                <div className="th-form-group">
                  <label>Payment Method</label>
                  <select
                    name="payment_method"
                    value={payForm.payment_method}
                    onChange={handlePayFormChange}
                    className="th-form-input"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="th-form-group">
                <button
                  type="button"
                  className="th-btn-warning"
                  onClick={setFullPayment}
                >
                  Pay Full Balance
                </button>
              </div>

              <div className="th-form-group">
                <label>Transaction Date</label>
                <input
                  type="date"
                  name="transaction_date"
                  value={payForm.transaction_date}
                  onChange={handlePayFormChange}
                  className="th-form-input"
                />
              </div>

              <div className="th-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={payForm.description}
                  onChange={handlePayFormChange}
                  className="th-form-input"
                  placeholder="Optional remarks..."
                />
              </div>

              <div className="th-modal-footer">
                <button
                  type="button"
                  className="th-btn-cancel"
                  onClick={() => setShowPayModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="th-btn-success"
                  disabled={paying}
                >
                  {paying ? 'Posting Payment...' : 'Post Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div className="th-modal-overlay" onClick={() => setShowRefundModal(false)}>
          <div className="th-modal" onClick={(e) => e.stopPropagation()}>
            <div className="th-modal-header">
              <h3>Refund Excess Payment</h3>
              <button className="th-modal-close" onClick={() => setShowRefundModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form className="th-modal-form" onSubmit={handleSubmitRefund}>
              {refundError && <div className="th-form-error">{refundError}</div>}

              <div className="th-form-group">
                <label>Student Number</label>
                <input
                  type="text"
                  name="student_number"
                  value={refundForm.student_number}
                  onChange={handleRefundFormChange}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-group">
                <label>Student Name</label>
                <input
                  type="text"
                  value={selectedLedger?.student_name || ''}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-group">
                <label>Refundable Excess</label>
                <input
                  type="text"
                  value={formatCurrency(getRefundableAmount(selectedLedger))}
                  className="th-form-input"
                  readOnly
                />
              </div>

              <div className="th-form-row">
                <div className="th-form-group">
                  <label>Refund Amount *</label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={refundForm.amount}
                    onChange={handleRefundFormChange}
                    className="th-form-input"
                    placeholder="0.00"
                  />
                </div>

                <div className="th-form-group">
                  <label>Refund Method</label>
                  <select
                    name="payment_method"
                    value={refundForm.payment_method}
                    onChange={handleRefundFormChange}
                    className="th-form-input"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="th-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={refundForm.description}
                  onChange={handleRefundFormChange}
                  className="th-form-input"
                  placeholder="Reason for refund..."
                />
              </div>

              <div className="th-modal-footer">
                <button
                  type="button"
                  className="th-btn-cancel"
                  onClick={() => setShowRefundModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="th-btn-danger"
                  disabled={refunding}
                >
                  {refunding ? 'Processing Refund...' : 'Process Refund'}
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

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={`Transaction History Report - ${previewType === 'summary' ? 'Summary' : 'Details'}`}
        data={previewData}
        columns={[
          { key: 'Date', label: 'DATE', align: 'center' },
          { key: 'Enrollment ID', label: 'ENROLLMENT ID', align: 'center' },
          { key: 'Student Number', label: 'STUDENT NUMBER', align: 'center' },
          { key: 'Student Name', label: 'STUDENT NAME', align: 'center' },
          { key: 'School Year', label: 'SCHOOL YEAR', align: 'center' },
          { key: 'Grade Level', label: 'GRADE LEVEL', align: 'center' },
          { key: 'Student Type', label: 'STUDENT TYPE', align: 'center' },
          { key: 'Payment Mode', label: 'PAYMENT MODE', align: 'center' },
          { key: 'Total Debit', label: 'TOTAL DEBIT', align: 'center' },
          { key: 'Total Credit', label: 'TOTAL CREDIT', align: 'center' },
          { key: 'Balance', label: 'BALANCE', align: 'center' },
          { key: 'Status', label: 'STATUS', align: 'center' },
        ]}
        filename="Transaction_History"
        onDownloadExcel={exportPreviewToExcel}
        onDownloadPDF={exportPreviewToPDF}
      />
      
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </main>
  );
};

export default TransactionHistory;