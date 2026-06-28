export const currentClientRelease = {
  id: 'security-and-data-protection-2026-06-28',
  name: 'security and data protection',
  title: 'JobPilot security and data protection update',
  summary: 'We strengthened the controls that protect account access, uploaded files, and stored JobPilot data.',
  changes: [
    'Sensitive account and support requests now use strict schema validation before processing.',
    'Session credentials are stored as protected hashes and authenticated through indexed database lookups.',
    'Resume and profile uploads are checked by their actual file contents instead of trusting the filename or browser-provided type.',
    'Production data now uses normalized PostgreSQL tables with transactional backfill verification and a synchronized rollback snapshot.',
  ],
}
