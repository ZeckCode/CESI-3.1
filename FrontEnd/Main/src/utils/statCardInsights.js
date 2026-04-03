/**
 * Utility to generate automatic insights for stat cards
 * Based on metric type and values, generates contextual interpretation lines
 * PLAIN LANGUAGE - Easy to understand for school admins
 */

export const generateStatInsight = (label, value, subtitle = '', metricType = 'default') => {
  // Handle percentage metrics
  if (typeof value === 'string' && value.includes('%')) {
    const percentValue = parseInt(value);
    if (percentValue >= 80) return 'Excellent - Performance is strong';
    if (percentValue >= 60) return 'Good - On track';
    if (percentValue >= 40) return 'Fair - Needs improvement';
    return 'Poor - Immediate action required';
  }

  // Handle numeric values
  const numValue = parseInt(value) || 0;

  // Total metrics - interpretation based on size
  if (label.toLowerCase().includes('total')) {
    if (numValue === 0) return 'No data - Nothing recorded yet';
    if (numValue < 10) return 'Low numbers - Just starting out';
    if (numValue < 50) return 'Moderate - Building up';
    if (numValue < 100) return 'Good - Growing steadily';
    return 'Strong - Large numbers';
  }

  // Active/Enrolled metrics
  if (label.toLowerCase().includes('active') || label.toLowerCase().includes('enrolled')) {
    if (numValue === 0) return 'No activity - Check system';
    if (numValue < 5) return 'Low activity - Limited engagement';
    if (numValue < 20) return 'Fair - Moderate usage';
    return 'High activity - Good engagement';
  }

  // Inactive/Pending/Dropped metrics
  if (label.toLowerCase().includes('inactive') || label.toLowerCase().includes('pending') || label.toLowerCase().includes('declined')) {
    if (numValue === 0) return 'Clear - All resolved';
    if (numValue < 5) return 'Minor - Few items pending';
    if (numValue < 20) return 'Attention needed - Review required';
    return 'Urgent - High volume backlog';
  }

  // Teachers/Staff
  if (label.toLowerCase().includes('teacher') || label.toLowerCase().includes('staff')) {
    if (numValue < 5) return 'Understaffed - Consider hiring';
    if (numValue < 20) return 'Adequate - Sufficient staff';
    return 'Well-staffed - Good coverage';
  }

  // Classes/Sections
  if (label.toLowerCase().includes('section') || label.toLowerCase().includes('class')) {
    if (numValue < 5) return 'Few classes - Limited options';
    if (numValue < 15) return 'Good variety - Well organized';
    return 'Large program - Many offerings';
  }

  // Students
  if (label.toLowerCase().includes('student')) {
    if (numValue === 0) return 'No enrollments - Empty enrollments';
    if (numValue < 30) return 'Small group - Few students';
    if (numValue < 100) return 'Healthy - Good enrollment';
    return 'Strong - Large student body';
  }

  // Subjects
  if (label.toLowerCase().includes('subject')) {
    if (numValue < 5) return 'Limited - Few subjects offered';
    if (numValue < 15) return 'Good variety - Varied curriculum';
    return 'Comprehensive - Full curriculum';
  }

  // Schedule/Time slots
  if (label.toLowerCase().includes('schedule') || label.toLowerCase().includes('slot')) {
    if (numValue < 5) return 'Limited - Few time slots';
    if (numValue < 20) return 'Adequate - Reasonable coverage';
    return 'Full - Comprehensive schedule';
  }

  // Reports
  if (label.toLowerCase().includes('report')) {
    if (numValue === 0) return 'None generated - Start reporting';
    if (numValue < 10) return 'Few reports - Limited tracking';
    if (numValue < 50) return 'Regular - Good documentation';
    return 'Comprehensive - Complete records';
  }

  // Enrollment window status
  if (label.toLowerCase().includes('enrollment')) {
    if (value === 'Closed' || subtitle.toLowerCase().includes('closed')) {
      return 'Closed - Not accepting applications';
    }
    return 'Open - Currently accepting';
  }

  // Assigned metrics
  if (label.toLowerCase().includes('assigned')) {
    if (numValue === 0) return 'Unassigned - Needs assignment';
    if (numValue < 10) return 'Partial - Some unassigned';
    if (numValue < 50) return 'Mostly assigned - Few gaps';
    return 'Fully assigned - All covered';
  }

  // Overdue/Late metrics
  if (label.toLowerCase().includes('overdue') || label.toLowerCase().includes('late')) {
    if (numValue === 0) return 'Clear - All on time';
    if (numValue < 5) return 'Minor issue - Few overdue';
    if (numValue < 15) return 'Attention - Review needed';
    return 'Urgent - Many overdue items';
  }

  // Default fallback
  return 'Standard - Normal levels';
};

/**
 * Get insight color based on the insight message
 */
export const getInsightColor = (insight) => {
  if (!insight) return '#94a3b8'; // default gray

  const insightLower = insight.toLowerCase();

  // Red/Critical - Urgent, many, high volume
  if (insightLower.includes('urgent') || 
      insightLower.includes('many') ||
      insightLower.includes('alert') ||
      insightLower.includes('action required')) return '#ef4444';

  // Amber/Warning - Attention, review needed
  if (insightLower.includes('attention') || 
      insightLower.includes('review') ||
      insightLower.includes('alert')) return '#f59e0b';

  // Green/Good - Good, strong, healthy, excellent
  if (insightLower.includes('good') || 
      insightLower.includes('strong') ||
      insightLower.includes('healthy') ||
      insightLower.includes('excellent') ||
      insightLower.includes('clear')) return '#10b981';

  // Blue/Neutral - Standard, normal, few
  if (insightLower.includes('good') ||
      insightLower.includes('moderate') ||
      insightLower.includes('adequate')) return '#0ea5e9';

  return '#94a3b8'; // default gray
};
