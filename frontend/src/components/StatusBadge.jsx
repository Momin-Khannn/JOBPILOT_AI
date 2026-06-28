const labels = {
  pending_review: 'Review',
  approved: 'Approved',
  applied: 'Applied',
  sent_demo: 'Sent',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  follow_up_needed: 'Follow up',
  job_closed: 'Job closed',
  active: 'Active',
  suspended: 'Suspended',
}

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>
}
