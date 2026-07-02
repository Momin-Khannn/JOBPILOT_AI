const labels = {
  pending_review: 'Review',
  approved: 'Approved',
  applied: 'Applied',
  sent_demo: 'Demo sent',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  follow_up_needed: 'Follow up',
  job_closed: 'Job closed',
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending',
  verified: 'Verified',
  open: 'Open',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>
}
