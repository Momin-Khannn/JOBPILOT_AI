const labels = {
  pending_review: 'Review',
  approved: 'Approved',
  applied: 'Applied',
  sent_demo: 'Demo sent',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  follow_up_needed: 'Follow up',
}

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>
}
