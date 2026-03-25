# Proof of Payment (Deli) - Implementation Guide

## Overview
Complete front-end and back-end implementation for "Proof of Payment" submission flow, allowing parents/students to upload and track payment documentation.

## System Architecture

### Backend Components

#### 1. **Database Model** - `ProofOfPayment`
```
BackEnd/finance/models.py
- parent (ForeignKey → User)
- transaction (OneToOneField → Transaction)
- reference_number (CharField) - Bank/payment provider reference
- payment_amount (DecimalField) - Amount shown in proof
- payment_date (DateField) - When payment was made
- payment_method (CharField) - Cash, Bank Transfer, GCash, etc.
- document (FileField) - Uploaded proof image/PDF
- description (TextField) - Optional notes
- status (CharField) - PENDING, APPROVED, REJECTED, RESUBMIT
- rejection_reason (TextField) - Why it was rejected
- submitted_date (DateTimeField) - Submission timestamp
- reviewed_date (DateTimeField) - Review timestamp
- reviewed_by (ForeignKey → User) - Admin who reviewed
```

#### 2. **API Endpoints**
```
POST   /api/finance/payment-proofs/
       Create new submission (FormData with file)
       
GET    /api/finance/payment-proofs/
       List all proofs (filtered by status, permissions apply)
       Query params: ?status=PENDING|APPROVED|REJECTED|RESUBMIT
       
GET    /api/finance/payment-proofs/<id>/
       Get specific proof details
       
PATCH  /api/finance/payment-proofs/<id>/
       Update/review proof (admin can approve/reject)
       
DELETE /api/finance/payment-proofs/<id>/
       Delete proof (only if pending/rejected)
       
GET    /api/finance/my-payment-proofs/
       Get current user's submissions
       
GET    /api/finance/payment-proofs/stats/
       Get submission statistics (admin only)
```

#### 3. **Admin Interface**
- Registered in `admin.py` as `ProofOfPaymentAdmin`
- List view shows: ID, parent, reference, amount, date, status
- Search by: username, reference number, transaction reference
- Filter by: status, payment method, dates
- Read-only fields after creation: parent, transaction, document
- Organized fieldsets for submission, payment, document, and review info

### Frontend Components

#### 1. **React Component** - `ProofOfPaymentUpload.jsx`
```
Location: FrontEnd/Main/src/components/StudentWebsite/ProofOfPayment.jsx

Features:
- Toggle-able upload form section
- Transaction dropdown (links to user's transactions)
- Form inputs: reference number, amount, date, method, notes
- File upload with drag-drop support
- Document preview (images shown inline, PDFs indicated)
- Submission list with status cards
- Expandable details for each submission
- Delete functionality for pending/rejected proofs
- Toast notifications for feedback
- Responsive UI for mobile/tablet/desktop
```

#### 2. **API Service** - `finance.js`
```
Location: FrontEnd/Main/src/components/api/finance.js

Functions:
- submitProofOfPayment(transactionId, referenceNumber, paymentAmount, paymentDate, paymentMethod, documentFile, description)
- listPaymentProofs(status)
- getMyPaymentProofs(status)
- getPaymentProofDetail(proofId)
- updatePaymentProof(proofId, payload)
- approvePaymentProof(proofId)
- rejectPaymentProof(proofId, rejectionReason)
- requestProofResubmission(proofId, reason)
- deletePaymentProof(proofId)
- paymentProofStats()
```

#### 3. **Styling** - `ProofOfPayment.css`
```
Location: FrontEnd/Main/src/components/StudentWebsiteCSS/ProofOfPayment.css

Features:
- Color-coded status badges (orange=pending, green=approved, red=rejected)
- Card-based layout for submissions
- Responsive grid (1-3 columns based on screen size)
- Form validation styling
- File upload area with drag-drop visual
- Mobile-optimized with stacked layouts
- Smooth transitions and hover effects
- Accessibility with semantic HTML
```

## Installation & Setup

### 1. Database Migration
```bash
cd BackEnd
python manage.py makemigrations finance
python manage.py migrate
```

### 2. Static Files & Media
Ensure Django media configuration is correct in settings:
```python
# settings.py
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

### 3. Component Integration
Add to Student Portal routing:
```jsx
import ProofOfPaymentUpload from './ProofOfPayment';

// In StudentMain or routing
<Route path="/payment-proof" element={<ProofOfPaymentUpload />} />
// Or add to sidebar menu
```

### 4. URL Configuration
URLs are already configured in `finance/urls.py`

## Usage Flow

### For Parents/Students:
1. Navigate to "Proof of Payment" section
2. Click "Upload Proof of Payment" to expand form
3. Select the transaction they're providing proof for
4. Enter payment reference number from bank/payment provider
5. Enter the payment amount and date
6. Select payment method used
7. Upload receipt/proof document (JPG, PNG, or PDF)
8. Optionally add notes
9. Click "Submit Proof of Payment"
10. View submission in "Your Submissions" list
11. Check status which updates as admin reviews

### For Admins:
1. Access via Django Admin: `/admin/finance/proofofpayment/`
2. View list of all submitted proofs
3. Click on proof to view details
4. Review document by clicking "View Document" link
5. Set status:
   - APPROVED: Payment is confirmed
   - REJECTED: Clear issues, needs proper proof
   - RESUBMIT: Minor corrections needed
6. Add rejection reason if needed
7. Save - system auto-records admin name and timestamp

## Validation & Error Handling

### File Upload Validation:
- Max size: 5MB
- Accepted formats: JPEG, PNG, PDF
- File type validation by MIME type

### Form Validation:
- Transaction: Required, must be from user's transactions
- Reference Number: Required, max 50 characters
- Payment Amount: Required, must be > 0
- Payment Date: Required, date field
- Payment Method: Required, predefined options
- Document: Required, passes file validation

### API Error Handling:
- Files or permissions: 403 Forbidden
- Not found: 404 Not Found
- Validation errors: 400 Bad Request with detailed messages
- Server errors: 500 with error description

## Status Workflow

```
┌─────────┐
│ PENDING │ ← Initial submission
└────┬────┘
     │
     ├──→ APPROVED ✓ (Payment confirmed)
     │
     ├──→ REJECTED ✗ (Wrong document, needs proper proof)
     │
     └──→ RESUBMIT ⚠ (Minor issues, please correct)
```

Users can only edit PENDING or RESUBMIT status proofs.

## Security Features

- User authentication required (IsAuthenticated permission)
- Parents see only their own submissions
- Admins see all submissions
- File upload restrictions (size, type)
- Unique constraint: One proof per transaction
- Audit trail: submitted_date, reviewed_date, reviewed_by
- Parent/transaction write-once after creation

## Performance Considerations

- Transactions prefetched with select_related in list view
- Ordering by submitted_date (newest first)
- Optional status filtering to reduce dataset
- Media files served efficiently with Django
- Frontend pagination via card grid (lazy load possible)

## Future Enhancements

1. **Automated Matching**: Match proof amounts with pending transactions
2. **Batch Upload**: Multiple files in single submission
3. **Email Notifications**: Alert parents on approval/rejection
4. **OCR Processing**: Extract details from receipt images
5. **Payment Dashboard**: Admin view to reconcile proofs with bank statements
6. **API Webhooks**: Integrate with payment provider webhooks
7. **Customizable Rules**: Auto-approve based on amount/time windows
8. **Report Generation**: Export proofs and reconciliation reports

## Troubleshooting

### Migration Error
```bash
# Clear cache if migration fails
python manage.py migrate finance --fake-initial
python manage.py migrate finance --fake
python manage.py migrate finance
```

### Media Files Not Loading
- Check MEDIA_URL and MEDIA_ROOT in settings.py
- Verify `/media/` URL pattern in main urls.py (if not using whitenoise)
- Check file permissions in media directory

### Component Not Appearing
- Verify component is imported and routed
- Check browser console for errors
- Ensure API endpoints are accessible at `/api/finance/`
- Check user has PARENT_STUDENT role

### Upload Fails
- Check file is under 5MB
- Verify file format is JPG, PNG, or PDF
- Check transaction ID is valid and belongs to user
- Ensure form is completely filled

## Files Modified/Created

### Backend:
- `BackEnd/finance/models.py` - Added ProofOfPayment model
- `BackEnd/finance/serializers.py` - Added 3 serializers
- `BackEnd/finance/views.py` - Added 4 view classes/functions
- `BackEnd/finance/urls.py` - Added 4 URL patterns
- `BackEnd/finance/admin.py` - Added ProofOfPaymentAdmin

### Frontend:
- `FrontEnd/Main/src/components/api/finance.js` - NEW file (service)
- `FrontEnd/Main/src/components/StudentWebsite/ProofOfPayment.jsx` - NEW file (component)
- `FrontEnd/Main/src/components/StudentWebsiteCSS/ProofOfPayment.css` - NEW file (styles)

## Support & Questions

For implementation details, refer to:
- Backend: `BackEnd/finance/` directory
- Frontend: `FrontEnd/Main/src/components/` directory
- This guide and session notes in memory
