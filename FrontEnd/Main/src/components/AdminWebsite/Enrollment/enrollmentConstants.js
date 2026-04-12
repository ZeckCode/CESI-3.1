export const FILTER_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Active", label: "Enrolled" },
  { value: "Pending", label: "Pending" },
  { value: "Dropped", label: "Dropped" },
  { value: "Completed", label: "Completed" },
];

export const PROMOTION_FILTER_OPTIONS = [
  { value: "All", label: "All Promotion Status" },
  { value: "ready", label: "Eligible - Ready to Promote" },
  { value: "ineligible", label: "Ineligible" },
  { value: "completed", label: "Completed - Max Grade" },
];

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "form_137", label: "Form 137-E" },
  { value: "sf10", label: "School Form 10 (SF10)" },
  { value: "birth_certificate", label: "Birth Certificate" },
  { value: "good_moral", label: "Good Moral Certificate" },
  { value: "report_card", label: "Report Card" },
  { value: "other", label: "Other Document" },
];

export const STATUS_STYLES = {
  ACTIVE: { background: "#d1fae5", color: "#065f46" },
  PENDING: { background: "#fef3c7", color: "#92400e" },
  DROPPED: { background: "#fee2e2", color: "#7f1d1d" },
  COMPLETED: { background: "#dbeafe", color: "#1e40af" },
};

export const FEE_STYLES = {
  cash: { background: "#d1fae5", color: "#065f46" },
  Paid: { background: "#d1fae5", color: "#065f46" },
  installment: { background: "#fef3c7", color: "#92400e" },
  Pending: { background: "#fef3c7", color: "#92400e" },
};