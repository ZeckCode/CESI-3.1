import React from 'react';
import '../AdminWebsiteCSS/StatCard.css';
import { generateStatInsight, getInsightColor } from '../../utils/statCardInsights';

/**
 * Unified stat card component used across all admin pages.
 *
 * @param {string}  label     – Short uppercase label  (e.g. "Total Students")
 * @param {string|number} value – Big number or text   (e.g. 145 or "88.5%")
 * @param {string}  [subtitle] – Optional line below the value
 * @param {'positive'|'negative'|''} [subtitleType] – Color hint for subtitle
 * @param {React.ReactNode} [icon] – Optional Lucide icon element
 * @param {'blue'|'green'|'yellow'|'purple'|'red'|'teal'} [color='blue'] – Left-border accent
 * @param {string}  [insight] – Custom insight line (auto-generated if not provided)
 * @param {boolean} [showInsight=true] – Whether to display the insight line
 */
const StatCard = ({
  label,
  value,
  subtitle,
  subtitleType = '',
  icon,
  color = 'blue',
  insight,
  showInsight = true,
}) => {
  const displayInsight = showInsight
    ? insight || generateStatInsight(label, value, subtitle)
    : null;
  const insightColor = displayInsight ? getInsightColor(displayInsight) : '#94a3b8';

  return (
    <div className={`unified-stat-card ${color}`}>
      <div className="unified-stat-header">
        <span className="unified-stat-label">{label}</span>
        {icon && <span className="unified-stat-icon">{icon}</span>}
      </div>
      <div className="unified-stat-value">{value}</div>
      {subtitle && (
        <div className={`unified-stat-subtitle ${subtitleType}`}>{subtitle}</div>
      )}
      {displayInsight && (
        <div className="unified-stat-insight" style={{ color: insightColor }}>
          {displayInsight}
        </div>
      )}
    </div>
  );
};

/**
 * Wrapper grid that lays out StatCards in a responsive row.
 */
export const StatsGrid = ({ children }) => (
  <div className="unified-stats-grid">{children}</div>
);

export default StatCard;