/**
 * Utility to generate automatic insights for stat cards
 * Professional, contextual, and easy-to-understand insights
 */

export const generateStatInsight = (label, value, subtitle = '', metricType = 'default') => {
  // Handle percentage metrics
  if (typeof value === 'string' && value.includes('%')) {
    const percentValue = parseInt(value);
    if (percentValue >= 80) return 'Excellent - Strong performance';
    if (percentValue >= 60) return 'Good - On track';
    if (percentValue >= 40) return 'Fair - Needs improvement';
    return 'Poor - Action required';
  }

  // Handle numeric values
  const numValue = parseInt(value) || 0;

  // Total metrics - give context on scale
  if (label.toLowerCase().includes('total')) {
    if (numValue === 0) return 'No data yet';
    if (numValue < 10) return 'Just starting out';
    if (numValue < 50) return 'Building up momentum';
    if (numValue < 100) return 'Growing steadily';
    if (numValue < 200) return 'Strong growth';
    return 'Significant scale';
  }

  // Active/Enrolled metrics - engagement focus
  if (label.toLowerCase().includes('active') || label.toLowerCase().includes('enrolled')) {
    if (numValue === 0) return 'No activity - Check system';
    if (numValue < 5) return 'Low engagement';
    if (numValue < 20) return 'Moderate engagement';
    if (numValue < 50) return 'Good engagement';
    return 'High engagement';
  }

  // Pending/Processing metrics - action needed
  if (label.toLowerCase().includes('pending')) {
    if (numValue === 0) return 'All processed! ✓';
    if (numValue < 5) return 'Few pending - Review soon';
    if (numValue < 15) return 'Review needed!';
    if (numValue < 30) return 'High backlog - Needs attention';
    return 'Critical - Immediate action!';
  }

  // Dropped/Declined metrics
  if (label.toLowerCase().includes('declined') || label.toLowerCase().includes('dropped')) {
    if (numValue === 0) return 'None dropped - Good!';
    if (numValue < 5) return 'Few dropped';
    if (numValue < 15) return 'Monitor closely';
    return 'High attrition - Investigate';
  }

  // Inactive metrics
  if (label.toLowerCase().includes('inactive')) {
    if (numValue === 0) return 'All active - Good!';
    if (numValue < 5) return 'Few inactive';
    if (numValue < 15) return 'Some need reactivation';
    return 'Many inactive - Check status';
  }

  // Teachers/Staff - capacity focus
  if (label.toLowerCase().includes('teacher') || label.toLowerCase().includes('staff')) {
    if (numValue < 5) return 'Understaffed - Consider hiring';
    if (numValue < 15) return 'Adequate staffing';
    if (numValue < 30) return 'Well-staffed';
    return 'Excellent coverage';
  }

  // Classes/Sections - organization
  if (label.toLowerCase().includes('section') || label.toLowerCase().includes('class')) {
    if (numValue < 5) return 'Few classes offered';
    if (numValue < 15) return 'Good variety';
    if (numValue < 30) return 'Comprehensive program';
    return 'Extensive offerings';
  }

  // Students - enrollment quality
  if (label.toLowerCase().includes('student')) {
    if (numValue === 0) return 'No enrollments yet';
    if (numValue < 30) return 'Small cohort';
    if (numValue < 100) return 'Healthy enrollment';
    if (numValue < 300) return 'Strong student body';
    return 'Large enrollment';
  }

  // Subjects - curriculum
  if (label.toLowerCase().includes('subject')) {
    if (numValue < 5) return 'Limited offerings';
    if (numValue < 15) return 'Good variety';
    if (numValue < 30) return 'Comprehensive curriculum';
    return 'Extensive subjects';
  }

  // Schedule/Slots - availability
  if (label.toLowerCase().includes('schedule') || label.toLowerCase().includes('slot')) {
    if (numValue < 5) return 'Limited availability';
    if (numValue < 20) return 'Adequate schedule';
    if (numValue < 50) return 'Good flexibility';
    return 'Full coverage';
  }

  // Reports - documentation
  if (label.toLowerCase().includes('report')) {
    if (numValue === 0) return 'Start generating reports';
    if (numValue < 10) return 'Limited documentation';
    if (numValue < 50) return 'Regular reporting';
    return 'Comprehensive records';
  }

  // Enrollment window status
  if (label.toLowerCase().includes('enrollment')) {
    if (value === 'Closed' || subtitle.toLowerCase().includes('closed')) {
      return 'Window closed - Not accepting';
    }
    return 'Open for applications';
  }

  // Assigned metrics - completeness
  if (label.toLowerCase().includes('assigned')) {
    if (numValue === 0) return 'Unassigned - Assign now';
    if (numValue < 10) return 'Partial assignment';
    if (numValue < 50) return 'Mostly assigned';
    return 'Fully assigned';
  }

  // Overdue/Late metrics - urgency
  if (label.toLowerCase().includes('overdue') || label.toLowerCase().includes('late')) {
    if (numValue === 0) return 'All on time - Great!';
    if (numValue < 5) return 'Few overdue items';
    if (numValue < 15) return 'Review needed!';
    return 'Critical - Needs action!';
  }

  // Payment/Finance metrics
  if (label.toLowerCase().includes('payment') || label.toLowerCase().includes('revenue') || label.toLowerCase().includes('collected')) {
    if (numValue === 0) return 'No payments yet';
    if (numValue < 100000) return 'Low collection';
    if (numValue < 500000) return 'Good revenue stream';
    if (numValue < 1000000) return 'Strong revenue';
    return 'Excellent revenue!';
  }

  // Default fallback
  return 'Standard metric';
};

/**
 * Get insight color based on the insight message
 */
export const getInsightColor = (insight) => {
  if (!insight) return '#94a3b8'; // default gray

  const insightLower = insight.toLowerCase();

  // Red/Critical - Critical, act now, immediate, process now
  if (insightLower.includes('critical') || 
      insightLower.includes('act now') ||
      insightLower.includes('immediate') ||
      insightLower.includes('process now') ||
      insightLower.includes('action!')) return '#ef4444';

  // Amber/Warning - Review needed, monitor, investigate, high
  if (insightLower.includes('review needed') || 
      insightLower.includes('monitor') ||
      insightLower.includes('investigate') ||
      insightLower.includes('high backlog') ||
      insightLower.includes('high attrition') ||
      insightLower.includes('high volume') ||
      insightLower.includes('needs attention')) return '#f59e0b';

  // Green/Good - Excellent, strong, good, great, all processed, all on time
  if (insightLower.includes('excellent') || 
      insightLower.includes('strong') ||
      insightLower.includes('good') ||
      insightLower.includes('great') ||
      insightLower.includes('healthy') ||
      insightLower.includes('✓')) return '#10b981';

  // Blue/Neutral - Building, growing, adequate, fair, moderate, few
  if (insightLower.includes('building') ||
      insightLower.includes('growing') ||
      insightLower.includes('adequate') ||
      insightLower.includes('fair') ||
      insightLower.includes('moderate') ||
      insightLower.includes('few')) return '#0ea5e9';

  return '#94a3b8'; // default gray
};
