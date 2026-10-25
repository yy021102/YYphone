import React from 'react';

interface ChatPaymentCardProps {
  kind: 'red-packet' | 'transfer';
  text: string;
  amount?: string;
  status?: 'pending' | 'received' | 'returned';
  outgoing: boolean;
  group: boolean;
  quantity?: number;
  claims?: Array<{ recipientId: string; claimed: boolean }>;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ChatPaymentCard({ kind, text, amount, status, outgoing, group, quantity, claims, onOpen }: ChatPaymentCardProps) {
  const packet = kind === 'red-packet';
  const claimed = claims?.filter(claim => claim.claimed).length ?? 0;
  const exhausted = !!claims?.length && claims.every(claim => claim.claimed);
  const settled = status === 'received' || status === 'returned' || exhausted;
  const detail = packet
    ? status === 'received' ? '已领取' : exhausted ? '已被领完' : outgoing ? '已发出' : '领取红包'
    : status === 'returned' ? '已退回' : status === 'received' ? '已收款' : outgoing ? '待对方收款' : '请收款';

  return <button type="button" onClick={onOpen}
    className={`yy-chat-payment-card ${settled ? 'is-settled' : ''}`}
    aria-label={`${packet ? '红包' : '转账'}：${packet ? text || '恭喜发财，大吉大利' : `¥${amount}`}，${detail}`}>
    <span className="yy-chat-payment-main">
      {packet ? <svg className="yy-chat-payment-icon" viewBox="0 0 40 46" aria-hidden="true">
        <rect x="3" y="1" width="34" height="43" rx="2" fill="#e74322" />
        <path d="M3 3a2 2 0 0 1 2-2h30a2 2 0 0 1 2 2v12c-10 8-24 8-34 0Z" fill="#fa5533" />
        <circle cx="20" cy="21" r="7" fill="#ffdb87" />
        <path d="m17 17 3 4 3-4m-6 4h6m-6 3h6m-3-3v6" fill="none" stroke="#d58c38" strokeWidth="1.5" />
      </svg> : <svg className="yy-chat-payment-icon" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="22" cy="22" r="20" />
        {status === 'received' ? <path d="m12 22 7 7 14-15" /> : status === 'returned' ? <path d="m18 13-8 8 8 8m-8-8h15a8 8 0 0 1 8 8" strokeLinecap="round" strokeLinejoin="round" /> : <path d="m18 12-7 7h22M26 32l7-7H11" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>}
      <span className="yy-chat-payment-copy">
        <span className={`yy-chat-payment-title ${packet ? '' : 'is-amount'}`}>{packet ? text || '恭喜发财，大吉大利' : `¥${amount}`}</span>
        <span className="yy-chat-payment-status">{detail}{packet && group && quantity ? ` · ${claims ? `${claimed}/` : ''}${quantity} 个` : ''}</span>
      </span>
    </span>
    <span className="yy-chat-payment-footer">{packet ? group ? '群聊红包' : '微信红包' : '微信转账'}</span>
  </button>;
}
