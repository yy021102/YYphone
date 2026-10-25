import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPaymentDisplayMessages } from './chatPaymentDisplay';

test('transfer receipts use the recipient side and settlement time without changing stored payments', () => {
  for (const action of ['received', 'returned'] as const) {
    const payment = { id: 'p', senderId: 'character', recipientId: 'user', kind: 'transfer', text: '',
      createdAt: '2026-10-25T10:00:00Z', paymentSettledAt: '2026-10-25T10:02:00Z', paymentStatus: action };
    const later = { id: 'm', senderId: 'user', text: '稍等', createdAt: '2026-10-25T10:01:00Z' };
    const original = [payment, later];
    const display = buildPaymentDisplayMessages(original, 'character');
    assert.deepEqual(display.map(message => message.id), ['p', 'm', 'receipt-p']);
    assert.equal(display[2].senderId, 'user');
    assert.equal(display[2].paymentReceiptId, 'p');
    assert.equal(original.length, 2);
    assert.equal(buildPaymentDisplayMessages(original, 'character').length, 3);
  }
});

test('pending transfers have no receipt; outgoing transfers receive receipts from the other participant', () => {
  const payment = { id: 'p', senderId: 'user', kind: 'transfer', text: '', createdAt: '2026-10-25T10:00:00Z', paymentStatus: 'pending' as const };
  assert.equal(buildPaymentDisplayMessages([payment], 'character').length, 1);
  const display = buildPaymentDisplayMessages([{ ...payment, paymentStatus: 'received' as const }], 'character');
  assert.equal(display[1].senderId, 'character');
});

test('group packet notices name only actual claimants, including partial claims', () => {
  const payment = { id: 'p', senderId: 'character', kind: 'red-packet', text: '', createdAt: '2026-10-25T10:00:00Z',
    paymentStatus: 'pending' as const, packetClaims: [{ recipientId: 'user', claimed: true }, { recipientId: 'other', claimed: false }] };
  const display = buildPaymentDisplayMessages([payment], 'other');
  assert.equal(display.length, 2);
  assert.deepEqual(display[1].paymentNotice, { senderId: 'character', recipientId: 'user' });
});
