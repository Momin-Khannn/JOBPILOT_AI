import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessConversation,
  conversationForApplication,
  detectUnsafeMarketplaceText,
  safeCandidateSnapshot,
} from '../src/services/marketplaceService.js'

test('marketplace blocks financial and identity-document requests without blocking normal hiring language', () => {
  assert.match(detectUnsafeMarketplaceText('Please pay a fee before the interview'), /blocks requests/i)
  assert.match(detectUnsafeMarketplaceText('Send your bank account and routing number'), /blocks requests/i)
  assert.equal(detectUnsafeMarketplaceText('Tell us about a recent product launch you led.'), '')
})

test('employers receive a career-only applicant snapshot without private contact details', () => {
  const snapshot = safeCandidateSnapshot({
    fileName: 'resume.pdf',
    profile: { name: 'Jamie', email: 'private@example.com', phone: '+1 555 0100', skills: ['React'], summary: 'Product engineer' },
  }, { name: 'Jamie', email: 'account@example.com', phone: '+1 555 0199' })

  assert.equal(snapshot.name, 'Jamie')
  assert.deepEqual(snapshot.skills, ['React'])
  assert.equal('email' in snapshot, false)
  assert.equal('phone' in snapshot, false)
})

test('job-linked conversations allow only the applicant, company members, and owner', () => {
  const store = {
    companies: [{ id: 'company-1', ownerUserId: 'employer-1', members: [{ userId: 'employer-1', status: 'active' }] }],
    conversations: [],
  }
  const conversation = conversationForApplication(store, { id: 'application-1', userId: 'candidate-1', companyId: 'company-1', jobId: 'job-1' })

  assert.equal(canAccessConversation(store, conversation, { id: 'candidate-1', role: 'client' }), true)
  assert.equal(canAccessConversation(store, conversation, { id: 'employer-1', role: 'employer' }), true)
  assert.equal(canAccessConversation(store, conversation, { id: 'owner-1', role: 'owner' }), true)
  assert.equal(canAccessConversation(store, conversation, { id: 'other-candidate', role: 'client' }), false)
  assert.equal(canAccessConversation(store, conversation, { id: 'other-employer', role: 'employer' }), false)
})
