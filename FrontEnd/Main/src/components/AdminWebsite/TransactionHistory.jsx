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
import * as XLSX from 'xlsx';
import '../AdminWebsiteCSS/TransactionHistory.css';
import Pagination from './Pagination';
import { apiFetch } from '../api/apiFetch';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PreviewModal from '../PreviewModal';

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

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [previewType, setPreviewType] = useState('summary');
  const [applyingAdvanceKey, setApplyingAdvanceKey] = useState(null);

  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [requestRemarks, setRequestRemarks] = useState({});
  const [activeTab, setActiveTab] = useState('transactions');




  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus !== 'all') params.append('status', filterStatus.toUpperCase());
      if (filterEntryType !== 'all') params.append('entry_type', filterEntryType.toUpperCase());

      const res = await apiFetch(`/api/finance/transactions/?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    }
  }, [searchTerm, filterStatus, filterEntryType]);

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
    fetchTransactions();
    fetchStats();
    fetchAdvanceRequests();
  }, [fetchTransactions, fetchStats, fetchAdvanceRequests]);

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
      const body = {
        ...formData,
        amount: parseFloat(formData.amount).toFixed(2),
        due_date: formData.due_date || null,
        transaction_date: formData.transaction_date || null,
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
      const res = await apiFetch(`/api/finance/transactions/${deleteTarget.id}/`, { method: 'DELETE' });

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
      const res = await apiFetch(`/api/reminders/payments/${transactionId}/send/`, { method: 'POST' });
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
      const res = await apiFetch('/api/reminders/payments/send-bulk/', { method: 'POST' });
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

  const exportToPDF = (groupedTransactions, stats) => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text('Transaction History Report', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    const currentDate = new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${currentDate}`, 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Summary Statistics', 14, 35);

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

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Transaction Summary (By Student)', 14, finalY);

    const summaryData = groupedTransactions.map(group => [
      group.student_number,
      group.student_name,
      group.grade_level || '—',
      group.payment_mode || '—',
      `₱${Number(group.total_debit || 0).toLocaleString()}`,
      `₱${Number(group.total_credit || 0).toLocaleString()}`,
      `₱${Number(group.balance || 0).toLocaleString()}`,
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

    doc.save(`transaction_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleOpenPreview = () => {
    try {
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

      setPreviewData(summaryData);
      setPreviewType('summary');
      setShowPreview(true);
    } catch (err) {
      console.error('Error opening preview:', err);
      alert('Failed to open preview. Please try again.');
    }
  };

  const handleExportData = () => {
    try {
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

      const wb = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      detailSheet['!cols'] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, detailSheet, 'Ledger Details');

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `Transaction_History_${timestamp}.xlsx`;

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
            rawBalance: 0,
            refundableExcess: 0,
            account_status: 'PAID',
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

        const rawBalance = runningBalance;
        const payableBalance = rawBalance > 0 ? rawBalance : 0;
        const refundableExcess = rawBalance < 0 ? Math.abs(rawBalance) : 0;

        let derivedStatus = 'PAID';
        if (payableBalance > 0) {
          derivedStatus = group.total_credit > 0 ? 'PARTIAL' : 'POSTED';
        }

        return {
          ...group,
          rows: normalizedRows,
          balance: payableBalance,
          rawBalance,
          refundableExcess,
          account_status: derivedStatus,
        };
      });

      return result.sort((a, b) =>
        String(b.latest_date || '').localeCompare(String(a.latest_date || ''))
      );
    }, [transactions]);

  const txnTotalPages = Math.max(1, Math.ceil(groupedTransactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = useMemo(
    () => groupedTransactions.slice((txnPage - 1) * ITEMS_PER_PAGE, txnPage * ITEMS_PER_PAGE),
    [groupedTransactions, txnPage]
  );

  const isReminderEligible = (group) =>
    Number(group.balance || 0) > 0 &&
    ['PENDING', 'OVERDUE', 'PARTIAL', 'POSTED'].includes(group.account_status);

  const getAdvanceCredit = (group) =>
    (group?.rows || []).reduce((sum, tx) => {
      if (tx.entry_type === 'CREDIT' && tx.item === 'ADVANCE') {
        return sum + Number(tx.credit || tx.amount || 0);
      }
      return sum;
    }, 0);

  const getRefundedAdvance = (group) =>
    (group?.rows || []).reduce((sum, tx) => {
      if (tx.entry_type === 'DEBIT' && tx.item === 'REFUND') {
        return sum + Number(tx.debit || tx.amount || 0);
      }
      return sum;
    }, 0);

      const getRefundableAmount = (group) => {
        if (!group) return 0;

        if (Number(group.refundableExcess || 0) > 0) {
          return Number(group.refundableExcess || 0);
        }

        const refundable = getAdvanceCredit(group) - getRefundedAdvance(group);
        return refundable > 0 ? refundable : 0;
      };

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

      alert(message);

      setShowPayModal(false);
      setSelectedLedger(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      setPayError(err.message || 'Failed to post payment.');
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

      alert(`Refund posted successfully. Refunded: ${formatCurrency(data.refunded_amount)}`);

      setShowRefundModal(false);
      setSelectedLedger(null);
      fetchTransactions();
      fetchStats();
    } catch (err) {
      setRefundError(err.message || 'Failed to process refund.');
    } finally {
      setRefunding(false);
    }
  };
  
  const handleApplyAdvance = async (group) => {
    if (!group?.student_number) {
      alert('Student number is missing.');
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

      alert(
        `Advance applied successfully. Applied: ${formatCurrency(data.applied_amount)}. New balance: ${formatCurrency(data.new_balance)}.`
      );

      fetchTransactions();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Failed to apply advance.');
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

      alert(
        actionType === 'PROCESS'
          ? 'Request processed successfully.'
          : `Request ${actionType.toLowerCase()}d successfully.`
      );

      fetchAdvanceRequests();
      fetchTransactions();
      fetchStats();
    } catch (err) {
      alert(err.message || `Failed to ${actionType.toLowerCase()} request.`);
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

    const overdueLedgers = groupedTransactions.filter(
      (group) => group.account_status === 'OVERDUE'
    ).length;

    const partialLedgers = groupedTransactions.filter(
      (group) => group.account_status === 'PARTIAL'
    ).length;

    const reminderQueue = groupedTransactions.filter(
      (group) =>
        Number(group.balance || 0) > 0 &&
        ['PENDING', 'OVERDUE', 'PARTIAL', 'POSTED'].includes(group.account_status)
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
  ]);

  return (
    <main className="transaction-history-main">
      <section className="th-section">
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
      </section>

      <section className="th-section">
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
              {groupedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((group) => (
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
                            <span className={`th-status-badge th-status-${statusClass(group.account_status)}`}>
                              {group.account_status}
                            </span>

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
                        <td colSpan="10">
                          <div className="th-student-detail-panel">
                            <h4 className="th-detail-title">{buildLedgerGroupTitle(group)}</h4>

                               <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                                Student: <strong>{group.student_name}</strong> ({group.student_number}) | Semester:{' '}
                                <strong>{group.semester || '—'}</strong> | Payable Balance:{' '}
                                <strong>{formatCurrency(group.balance)}</strong> | Advance Available:{' '}
                                <strong>{formatCurrency(getRefundableAmount(group))}</strong> | Ref:{' '}
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
        </div>
        )}

        {activeTab === 'advance-refund' && (
        <div>
        <div className="th-section-header">
          <div>
            <h2 className="th-section-title">Advance / Refund Requests</h2>
            <p className="th-section-subtitle">Review and process student-submitted requests</p>
          </div>
        </div>

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
              {requestLoading ? (
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
        filename="Transaction_History"
      />
    </main>
  );
};

export default TransactionHistory;