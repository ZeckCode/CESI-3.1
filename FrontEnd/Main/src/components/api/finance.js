/**
 * Finance API service for handling transactions, tuition, and payment proofs
 */

import { apiFetch, apiFetchData } from './apiFetch';

const API_BASE = '/api/finance';

// ═══════════════════════════════════════════════════════════
// PROOF OF PAYMENT OPERATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Submit a new proof of payment
 * @param {number} transactionId - The transaction ID this proof is for
 * @param {string} referenceNumber - Payment reference number
 * @param {number} paymentAmount - Amount shown in proof
 * @param {string} paymentDate - Payment date (YYYY-MM-DD)
 * @param {string} paymentMethod - Payment method (e.g., Bank Transfer, GCash)
 * @param {File} documentFile - Document file to upload
 * @param {string} description - Optional description
 * @returns {Promise} Response with submitted proof details
 */
export async function submitProofOfPayment(
  transactionId,
  referenceNumber,
  paymentAmount,
  paymentDate,
  paymentMethod,
  documentFile,
  description = ''
) {
  const formData = new FormData();
  formData.append('transaction', transactionId);
  formData.append('reference_number', referenceNumber);
  formData.append('payment_amount', paymentAmount);
  formData.append('payment_date', paymentDate);
  formData.append('payment_method', paymentMethod);
  formData.append('document', documentFile);
  if (description) {
    formData.append('description', description);
  }

  const response = await apiFetch(`${API_BASE}/payment-proofs/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Failed to submit proof of payment' }));
    throw new Error(error.detail || 'Failed to submit proof of payment');
  }

  return response.json();
}

/**
 * Get list of proofs of payment (admin sees all, parents see their own)
 * @param {string} status - Optional status filter (PENDING, APPROVED, REJECTED, RESUBMIT)
 * @returns {Promise} Array of proof of payment records
 */
export async function listPaymentProofs(status = '') {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  return apiFetchData(`${API_BASE}/payment-proofs/?${params.toString()}`);
}

/**
 * Get current user's proofs of payment
 * @param {string} status - Optional status filter
 * @returns {Promise} Array of user's proof submissions
 */
export async function getMyPaymentProofs(status = '') {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  return apiFetchData(`${API_BASE}/my-payment-proofs/?${params.toString()}`);
}

/**
 * Get details of a specific proof of payment
 * @param {number} proofId - The proof ID
 * @returns {Promise} Proof details
 */
export async function getPaymentProofDetail(proofId) {
  return apiFetchData(`${API_BASE}/payment-proofs/${proofId}/`);
}

/**
 * Update a proof of payment (for resubmission or admin review)
 * @param {number} proofId - The proof ID
 * @param {Object} payload - Updated data
 * @returns {Promise} Updated proof details
 */
export async function updatePaymentProof(proofId, payload) {
  return apiFetchData(`${API_BASE}/payment-proofs/${proofId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Approve a proof of payment (admin only)
 * @param {number} proofId - The proof ID
 * @returns {Promise} Updated proof with APPROVED status
 */
export async function approvePaymentProof(proofId) {
  return updatePaymentProof(proofId, { status: 'APPROVED' });
}

/**
 * Reject a proof of payment with reason (admin only)
 * @param {number} proofId - The proof ID
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise} Updated proof with REJECTED status
 */
export async function rejectPaymentProof(proofId, rejectionReason) {
  return updatePaymentProof(proofId, {
    status: 'REJECTED',
    rejection_reason: rejectionReason,
  });
}

/**
 * Request resubmission of a proof of payment (admin only)
 * @param {number} proofId - The proof ID
 * @param {string} reason - Reason for requesting resubmission
 * @returns {Promise} Updated proof with RESUBMIT status
 */
export async function requestProofResubmission(proofId, reason) {
  return updatePaymentProof(proofId, {
    status: 'RESUBMIT',
    rejection_reason: reason,
  });
}

/**
 * Delete a proof of payment
 * @param {number} proofId - The proof ID
 * @returns {Promise} Success response
 */
export async function deletePaymentProof(proofId) {
  const response = await apiFetch(`${API_BASE}/payment-proofs/${proofId}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Failed to delete proof' }));
    throw new Error(error.detail || 'Failed to delete proof');
  }

  return true;
}

/**
 * Get statistics on proofs of payment (admin only)
 * @returns {Promise} Stats object with counts by status
 */
export async function paymentProofStats() {
  return apiFetchData(`${API_BASE}/payment-proofs/stats/`);
}

// ═══════════════════════════════════════════════════════════
// TRANSACTION OPERATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get user's transactions
 * @returns {Promise} Array of transactions
 */
export async function getMyTransactions() {
  return apiFetchData(`${API_BASE}/my-transactions/`);
}

/**
 * Get user's ledger summary
 * @returns {Promise} Ledger summary with balances
 */
export async function getMyLedgerSummary() {
  return apiFetchData(`${API_BASE}/my-ledger-summary/`);
}

/**
 * Get tuition configuration by grade
 * @param {string} gradeKey - Grade key (e.g., 'grade1', 'grade2')
 * @returns {Promise} Tuition configuration details
 */
export async function getTuitionConfigByGrade(gradeKey) {
  return apiFetchData(`${API_BASE}/tuition-configs/by-grade/${gradeKey}/`);
}
