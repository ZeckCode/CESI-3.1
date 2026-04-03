/**
 * Utility to generate automatic insights for stat cards
 * Based on metric type and values, generates contextual interpretation lines
 */

export const generateStatInsight = (label, value, subtitle = '', metricType = 'default') => {
  // Handle percentage metrics
  if (typeof value === 'string' && value.includes('%')) {
    const percentValue = parseInt(value);
    if (percentValue >= 80) return '📈 Excellent performance';
    if (percentValue >= 60) return '✓ Good progress';
    if (percentValue >= 40) return '⚠ Needs attention';
    return '❌ Critical threshold';
  }

  // Handle numeric values
  const numValue = parseInt(value) || 0;

  // Total metrics - interpretation based on size
  if (label.toLowerCase().includes('total')) {
    if (numValue === 0) return '─ No data available';
    if (numValue < 10) return '→ Limited resources';
    if (numValue < 50) return '✓ Small to moderate';
    if (numValue < 100) return '→ Growing steadily';
    return '📈 Significant scale';
  }

  // Active/Enrolled metrics
  if (label.toLowerCase().includes('active') || label.toLowerCase().includes('enrolled')) {
    if (numValue === 0) return '⚠ No active users';
    if (numValue < 5) return '→ Low engagement';
    if (numValue < 20) return '✓ Moderate engagement';
    return '📈 High engagement';
  }

  // Inactive/Pending/Dropped metrics
  if (label.toLowerCase().includes('inactive') || label.toLowerCase().includes('pending') || label.toLowerCase().includes('declined')) {
    if (numValue === 0) return '✓ All clear';
    if (numValue < 5) return '→ Minor issue';
    if (numValue < 20) return '⚠ Requires review';
    return '❌ Needs immediate action';
  }

  // Teachers/Staff
  if (label.toLowerCase().includes('teacher') || label.toLowerCase().includes('staff')) {
    if (numValue < 5) return '→ Under-resourced';
    if (numValue < 20) return '✓ Adequate supply';
    return '📈 Well-resourced';
  }

  // Classes/Sections
  if (label.toLowerCase().includes('section') || label.toLowerCase().includes('class')) {
    if (numValue < 5) return '→ Few classes';
    if (numValue < 15) return '✓ Balanced organization';
    return '📈 Large program';
  }

  // Students
  if (label.toLowerCase().includes('student')) {
    if (numValue === 0) return '─ No enrollments';
    if (numValue < 30) return '→ Small cohort';
    if (numValue < 100) return '✓ Healthy enrollment';
    return '📈 Strong student body';
  }

  // Subjects
  if (label.toLowerCase().includes('subject')) {
    if (numValue < 5) return '→ Limited offerings';
    if (numValue < 15) return '✓ Good variety';
    return '📈 Comprehensive curriculum';
  }

  // Schedule/Time slots
  if (label.toLowerCase().includes('schedule') || label.toLowerCase().includes('slot')) {
    if (numValue < 5) return '→ Limited options';
    if (numValue < 20) return '✓ Adequate coverage';
    return '📈 Extensive schedule';
  }

  // Reports
  if (label.toLowerCase().includes('report')) {
    if (numValue === 0) return '─ No reports generated';
    if (numValue < 10) return '→ Limited documentation';
    if (numValue < 50) return '✓ Regular reporting';
    return '📈 Comprehensive tracking';
  }

  // Enrollment window status
  if (label.toLowerCase().includes('enrollment')) {
    if (value === 'Closed' || subtitle.toLowerCase().includes('closed')) {
      return '❌ Window unavailable';
    }
    return '✓ Accepting new enrollees';
  }

  // Assigned metrics
  if (label.toLowerCase().includes('assigned')) {
    if (numValue === 0) return '⚠ Unassigned resources';
    if (numValue < 10) return '→ Partial assignment';
    if (numValue < 50) return '✓ Mostly assigned';
    return '✓ Fully assigned';
  }

  // Default fallback
  return '─ Standard metric';
};

/**
 * Get insight color based on the insight message
 */
export const getInsightColor = (insight) => {
  if (!insight) return '#94a3b8'; // default gray

  if (insight.includes('Critical') || insight.includes('❌')) return '#ef4444'; // red
  if (insight.includes('⚠')) return '#f59e0b'; // amber
  if (insight.includes('📈') || insight.includes('Excellent') || insight.includes('strength')) return '#10b981'; // green
  if (insight.includes('✓')) return '#0ea5e9'; // blue
  if (insight.includes('→')) return '#8b5cf6'; // purple

  return '#94a3b8'; // default gray
};
