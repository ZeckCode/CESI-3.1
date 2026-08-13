/**
 * Role-specific insights for Teacher and Student dashboards
 * Generates contextual interpretations for their metrics
 */

/**
 * Generate insights for Teacher Dashboard metrics
 */
export const generateTeacherMetricsInsight = (metric, value) => {
  // Class Load - based on number of classes today
  if (metric === 'classLoad') {
    const numClasses = value || 0;
    if (numClasses === 0) return 'Open day - Use for planning or office hours';
    if (numClasses === 1) return 'Light teaching day - Manageable load';
    if (numClasses >= 2 && numClasses <= 3) return 'Balanced schedule - Good preparation time';
    if (numClasses >= 4 && numClasses <= 5) return 'Busy day - Stay focused';
    return 'Heavy load - Back-to-back teaching';
  }

  // Section Coverage - number of classes taught
  if (metric === 'sectionsCovered') {
    const numSections = value || 0;
    if (numSections === 0) return 'No sections assigned yet';
    if (numSections === 1) return 'Single class focus';
    if (numSections <= 3) return 'Manageable workload';
    return 'Multiple sections - Diverse teaching';
  }

  // Grade Coverage - grades being taught
  if (metric === 'gradeCoverage') {
    const grades = Array.isArray(value) ? value.length : 0;
    if (grades === 0) return 'No grade levels assigned';
    if (grades === 1) return 'Single grade focus';
    if (grades <= 3) return 'Mixed grade teaching';
    return 'Multi-level instruction - Complex scheduling';
  }

  // Class Performance - average grade
  if (metric === 'classPerformance') {
    const avg = parseFloat(value) || 0;
    if (avg === 0) return 'No grades recorded yet';
    if (avg >= 85) return 'Excellent class performance';
    if (avg >= 80) return 'Strong overall results';
    if (avg >= 75) return 'Good progress - Stay consistent';
    if (avg >= 70) return 'Satisfactory - Increase engagement';
    if (avg >= 60) return 'Needs improvement - Plan interventions';
    return 'Critical - Immediate action required';
  }

  // At-risk Students
  if (metric === 'atRiskStudents') {
    const count = value || 0;
    if (count === 0) return 'All students on track - Excellent!';
    if (count === 1) return '1 student needs support';
    if (count <= 3) return `${count} students need attention`;
    if (count <= 5) return `${count} students - Create action plan`;
    return `${count} students at-risk - Priority intervention`;
  }

  // Success Rate
  if (metric === 'successRate') {
    const percent = parseFloat(value) || 0;
    if (percent >= 90) return 'Outstanding success rate';
    if (percent >= 80) return 'Very good - Most students succeeding';
    if (percent >= 70) return 'Good - Keep current strategies';
    if (percent >= 60) return 'Fair - Adjust teaching approach';
    return 'Below expectations - Review methods';
  }

  return 'Teaching metric';
};

export const getTeacherMetricColor = (insight) => {
  if (!insight) return '#94a3b8';

  const lower = insight.toLowerCase();

  // Red - Critical or Need Attention
  if (lower.includes('critical') ||
      lower.includes('priority') ||
      lower.includes('action required')) return '#ef4444';

  // Amber - Alert/Warning/Needs Improvement
  if (lower.includes('needs') ||
      lower.includes('improvement') ||
      lower.includes('attention') ||
      lower.includes('adjust') ||
      lower.includes('fair') ||
      lower.includes('below expectations') ||
      lower.includes('increase engagement')) return '#f59e0b';

  // Green - Positive/Good
  if (lower.includes('manageable') || 
      lower.includes('balanced') ||
      lower.includes('open') ||
      lower.includes('excellent') ||
      lower.includes('strong') ||
      lower.includes('outstanding') ||
      lower.includes('on track')) return '#10b981';

  // Blue - Neutral/Light/Diverse
  if (lower.includes('light') ||
      lower.includes('single') ||
      lower.includes('diverse') ||
      lower.includes('satisfactory')) return '#0ea5e9';

  return '#94a3b8';
};

/**
 * Generate insights for Student Dashboard metrics
 */
export const generateStudentMetricsInsight = (metric, value) => {
  // Attendance - percentage based
  if (metric === 'attendance') {
    const percent = parseFloat(value) || 0;
    if (percent === 0) return 'No attendance data yet';
    if (percent >= 95) return 'Excellent attendance - Keep it up!';
    if (percent >= 85) return 'Good attendance - Stay consistent';
    if (percent >= 75) return 'Fair attendance - Improve to meet targets';
    if (percent >= 60) return 'Low attendance - Attention needed';
    return 'Critical - Speak to teacher';
  }

  // Average Grade
  if (metric === 'averageGrade') {
    const grade = parseFloat(value) || 0;
    if (grade === 0) return 'No grades recorded yet';
    if (grade >= 90) return 'Outstanding performance';
    if (grade >= 80) return 'Very good - Strong understanding';
    if (grade >= 75) return 'Good - On track';
    if (grade >= 70) return 'Satisfactory - Improve your effort';
    if (grade >= 60) return 'Passing - Extra study needed';
    return 'Below passing - Get tutoring';
  }

  // Classes per Day
  if (metric === 'classesPerDay') {
    const numClasses = value || 0;
    if (numClasses === 0) return 'No classes scheduled';
    if (numClasses <= 2) return 'Light day - Focus on study';
    if (numClasses <= 4) return 'Balanced schedule';
    if (numClasses <= 6) return 'Busy day - Prepare for transitions';
    return 'Full day of learning';
  }

  // Active Subjects
  if (metric === 'activeSubjects') {
    const numSubjects = value || 0;
    if (numSubjects === 0) return 'No active subjects';
    if (numSubjects <= 3) return 'Few subjects - Light semester';
    if (numSubjects <= 6) return 'Standard load - Normal workload';
    if (numSubjects <= 8) return 'Diverse curriculum - Stay organized';
    return 'Full course load - Plan wisely';
  }

  // Graded Subjects - showing progress
  if (metric === 'gradedSubjects') {
    const graded = value?.graded || 0;
    const total = value?.total || 1;
    const percent = Math.round((graded / total) * 100);
    
    if (percent === 0) return 'No grades yet - Grades coming soon';
    if (percent === 100) return 'All subjects graded - Tracking complete';
    if (percent >= 75) return 'Most graded - Few pending';
    if (percent >= 50) return 'Half graded - Keep working';
    return 'Early in term - Grades updating';
  }

  return 'Student metric';
};

export const getStudentMetricColor = (insight) => {
  if (!insight) return '#94a3b8';

  const lower = insight.toLowerCase();

  // Red - Critical or Poor
  if (lower.includes('critical') ||
      lower.includes('below') ||
      lower.includes('tutoring')) return '#ef4444';

  // Amber - Alert/Warning
  if (lower.includes('low') ||
      lower.includes('attention') ||
      lower.includes('improve')) return '#f59e0b';

  // Green - Good/Excellent
  if (lower.includes('excellent') ||
      lower.includes('very good') ||
      lower.includes('outstanding') ||
      lower.includes('good') ||
      lower.includes('strong')) return '#10b981';

  // Blue - Neutral/On track
  if (lower.includes('satisfactory') ||
      lower.includes('balanced') ||
      lower.includes('light')) return '#0ea5e9';

  return '#94a3b8';
};
