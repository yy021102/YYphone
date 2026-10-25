interface PaymentMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  kind?: string;
  text: string;
  createdAt: string;
  paymentStatus?: 'pending' | 'received' | 'returned';
  paymentSettledAt?: string;
  packetClaims?: Array<{ recipientId: string; claimed: boolean }>;
}

export type PaymentDisplayMessage<T> = T & {
  paymentReceiptId?: string;
  paymentNotice?: { senderId: string; recipientId: string };
};

/** Receipts are views of settled payments, never new payments or wallet entries. */
export function buildPaymentDisplayMessages<T extends PaymentMessage>(messages: T[], defaultRecipientId: string): PaymentDisplayMessage<T>[] {
  const result: PaymentDisplayMessage<T>[] = [...messages];
  for (const message of messages) {
    const recipientId = message.recipientId ?? (message.senderId === 'user' ? defaultRecipientId : 'user');
    if (message.kind === 'transfer' && ['received', 'returned'].includes(message.paymentStatus ?? '')) {
      result.push({
        ...message,
        id: `receipt-${message.id}`,
        senderId: recipientId,
        recipientId: message.senderId,
        createdAt: message.paymentSettledAt ?? message.createdAt,
        paymentReceiptId: message.id,
      });
    } else if (message.kind === 'red-packet') {
      const recipients = message.packetClaims
        ? message.packetClaims.filter(claim => claim.claimed).map(claim => claim.recipientId)
        : message.paymentStatus === 'received' ? [recipientId] : [];
      for (const claimant of recipients) {
        result.push({
          ...message,
          id: `receipt-${message.id}-${claimant}`,
          createdAt: message.paymentSettledAt ?? message.createdAt,
          paymentReceiptId: message.id,
          paymentNotice: { senderId: message.senderId, recipientId: claimant },
        });
      }
    }
  }
  return result.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
