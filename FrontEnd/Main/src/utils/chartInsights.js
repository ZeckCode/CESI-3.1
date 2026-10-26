/**
 * Utility to generate automatic insights for charts
 * Analyzes chart data and generates professional, contextual interpretation lines
 */

/**
 * Generate insight for Revenue Trend chart
 */
export const generateRevenueInsight = (data) => {
  if (!data || data.length === 0) return 'No revenue data available';

  const values = data.map(d => parseFloat(d.revenue) || 0).filter(v => v > 0);
  if (values.length === 0) return 'No transactions recorded';

  const latest = values[values.length - 1];
  const previous = values[values.length - 2] || latest;
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Calculate trend
  const change = ((latest - previous) / previous) * 100;
  const isGrowing = latest > average;

  if (isGrowing) {
    if (change > 20) return `Strong growth - Latest month up ${Math.round(change)}%`;
    if (change > 5) return `Growing trend - Average monthly ₱${Math.round(average).toLocaleString()}`;
    return `Stable revenue - Consistent collection`;
  } else {
    if (change < -20) return `Caution - Last month down ${Math.round(Math.abs(change))}%`;
    if (change < -5) return `Declining trend - Review payment status`;
    return `Slight dip - Monitor closely`;
  }
};

/**
 * Detect revenue dips in the data
 * Returns array of dip indices for marking on chart
 */
export const detectRevenueDips = (data, sensitivity = 0.1) => {
  if (!data || data.length < 3) return [];

  const values = data.map(d => parseFloat(d.revenue) || 0);
  const dips = [];

  // Calculate average for baseline
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const threshold = average * (1 - sensitivity);

  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const next = values[i + 1];

    // A dip is when current < threshold AND current < both neighbors
    if (current < threshold && current < prev && current < next) {
      dips.push({
        index: i,
        value: current,
        label: data[i].month || `Month ${i + 1}`,
        percentDrop: Math.round(((prev - current) / prev) * 100)
      });
    }
  }

  return dips;
};

/**
 * Generate insight for Enrollment Distribution chart
 */
export const generateEnrollmentInsight = (data) => {
  if (!data || data.length === 0) return 'No enrollment data';

  const total = data.reduce((sum, d) => sum + (d.value || d.students || 0), 0);
  if (total === 0) return 'No students enrolled';

  // Find dominant level
  const sorted = [...data].sort((a, b) => (b.value || b.students || 0) - (a.value || a.students || 0));
  const dominant = sorted[0];
  const dominantPercent = Math.round(((dominant.value || dominant.students) / total) * 100);

  // Check balance
  const max = sorted[0].value || sorted[0].students || 0;
  const min = sorted[sorted.length - 1].value || sorted[sorted.length - 1].students || 0;
  const imbalance = Math.round((max / (min || 1)) * 100) / 100;

  if (imbalance > 2) {
    return `Unbalanced - ${dominant.name || 'Level'} has ${dominantPercent}% (${imbalance}x more)`;
  } else if (imbalance > 1.3) {
    return `Slightly unbalanced - ${dominant.name || 'Level'} leads with ${dominantPercent}%`;
  } else {
    return `Well-balanced - All levels have similar enrollment`;
  }
};

/**
 * Generate insight for Attendance Trend chart
 */
export const generateAttendanceInsight = (data) => {
  if (!data || data.length === 0) return 'No attendance data';

  const values = data.map(d => parseFloat(d.attendance) || 0).filter(v => v > 0);
  if (values.length === 0) return 'No attendance recorded';

  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const latest = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);

  const isAboveTarget = average >= 85;
  const isStable = (max - min) < 15;

  if (isAboveTarget && isStable) {
    return `Excellent - Consistent ${Math.round(average)}% attendance`;
  } else if (isAboveTarget) {
    return `Good average - ${Math.round(average)}% but fluctuating`;
  } else if (average >= 70) {
    return `Fair - ${Math.round(average)}% attendance, needs improvement`;
  } else {
    return `Low attendance - ${Math.round(average)}%, immediate action needed`;
  }
};

/**
 * Generate insight for Payment Breakdown chart
 */
export const generatePaymentInsight = (data) => {
  if (!data || data.length === 0) return 'No payment data';

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  if (total === 0) return 'No payment records';

  // Find each category
  const paid = data.find(d => d.name?.toLowerCase().includes('paid') || d.name?.toLowerCase().includes('completed'))?.value || 0;
  const pending = data.find(d => d.name?.toLowerCase().includes('pending'))?.value || 0;
  const overdue = data.find(d => d.name?.toLowerCase().includes('overdue') || d.name?.toLowerCase().includes('late'))?.value || 0;

  const paidPercent = Math.round((paid / total) * 100);
  const pendingPercent = Math.round((pending / total) * 100);
  const overduePercent = Math.round((overdue / total) * 100);

  if (paidPercent >= 85 && overduePercent === 0) {
    return `Excellent - ${paidPercent}% paid, no overdue items`;
  } else if (paidPercent >= 75 && overduePercent < 10) {
    return `Good - ${paidPercent}% paid, ${overduePercent}% overdue - Monitor`;
  } else if (overduePercent > 20) {
    return `Alert - ${overduePercent}% overdue payments, immediate action needed`;
  } else {
    return `In progress - ${paidPercent}% paid, ${pendingPercent}% pending`;
  }
};

/**
 * Get insight color
 */
export const getChartInsightColor = (insight) => {
  if (!insight) return '#94a3b8';

  const lower = insight.toLowerCase();

  // Red/Critical
  if (lower.includes('immediate action') || 
      lower.includes('alert') ||
      lower.includes('caution') ||
      lower.includes('down') ||
      lower.includes('low')) return '#ef4444';

  // Amber/Warning
  if (lower.includes('monitor') ||
      lower.includes('fluctuating') ||
      lower.includes('unbalanced') ||
      lower.includes('declining')) return '#f59e0b';

  // Green/Good
  if (lower.includes('excellent') ||
      lower.includes('good') ||
      lower.includes('strong') ||
      lower.includes('consistent')) return '#10b981';

  // Blue/Neutral
  if (lower.includes('growing') ||
      lower.includes('stable')) return '#0ea5e9';

  return '#94a3b8';
};
