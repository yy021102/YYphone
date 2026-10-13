import React, { useState } from 'react';
import {
  Wallet,
  Receipt,
  QrCode,
  Scan,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface AlipayAppProps {
  onBack: () => void;
}

type AlipayTab = 'wallet' | 'ledger';

export const AlipayApp: React.FC<AlipayAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AlipayTab>('wallet');

  // Transactions list
  const transactions = [
    { id: 1, title: '浅井咖啡屋 · 冰生椰拿铁', category: '餐饮', amount: '-28.00', time: '今日 14:20', isExpense: true },
    { id: 2, title: '世界书设定赏金入账', category: '收入', amount: '+1200.00', time: '昨日 18:30', isExpense: false },
    { id: 3, title: '数字云主机租赁月费', category: '数码', amount: '-188.00', time: '10月11日', isExpense: true },
    { id: 4, title: '新川市立图书馆研讨室预约', category: '学习', amount: '-45.00', time: '10月09日', isExpense: true },
    { id: 5, title: '闲鱼二手手办转卖收入', category: '二手', amount: '+360.00', time: '10月07日', isExpense: false },
  ];

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F2F6FA] overflow-hidden">
      <AppHeader
        title="支付宝 · 财务中心"
        onBack={onBack}
        rightAction={
          <button className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded-md">
            账单明细
          </button>
        }
      />

      {/* Segmented Top Tabs */}
      <div className="px-4 py-2 bg-white/40 border-b border-white/60 shrink-0">
        <div className="flex items-center p-1 bg-slate-200/50 rounded-xl">
          {[
            { key: 'wallet', label: '我的钱包', icon: Wallet },
            { key: 'ledger', label: '日常记账', icon: Receipt },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as AlipayTab)}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            {/* Quick Balance Card */}
            <div className="w-full bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-3xl p-5 shadow-lg shadow-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between text-xs text-blue-100">
                <span>总资产估值 (CNY)</span>
                <span className="flex items-center gap-1 text-[11px] bg-white/15 px-2 py-0.5 rounded-full backdrop-blur-md">
                  <TrendingUp className="w-3 h-3 text-emerald-300" />
                  <span>余额宝日收益 +1.42</span>
                </span>
              </div>

              <div className="mt-2 mb-4">
                <span className="text-3xl font-extrabold tracking-tight font-mono">
                  ¥ 12,850.60
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/20">
                {[
                  { label: '扫一扫', icon: Scan },
                  { label: '付款码', icon: QrCode },
                  { label: '转账', icon: ArrowUpRight },
                  { label: '充值', icon: ArrowDownLeft },
                ].map(({ label, icon: ActionIcon }) => (
                  <button
                    key={label}
                    className="flex flex-col items-center py-1 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <ActionIcon className="w-5 h-5 text-white stroke-[2.2]" />
                    <span className="text-[10px] text-blue-100 mt-1 font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub Wallets Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>余额宝</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-[#2C4A5C] font-mono">¥ 9,420.00</p>
                <span className="text-[10px] text-emerald-600 font-medium">七日年化 2.08%</span>
              </div>

              <div className="glass-card rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>绑定银行卡</span>
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-base font-bold text-[#2C4A5C] font-mono">3 张</p>
                <span className="text-[10px] text-slate-400 font-medium">新川银行 · 储蓄卡</span>
              </div>
            </div>
          </div>
        )}

        {/* LEDGER TAB */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Monthly Budget Summary */}
            <div className="glass-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#2C4A5C]">本月消费收支 (10月)</span>
                <span className="text-slate-400 font-mono text-[11px]">2026/10</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[11px] text-slate-400">总支出</span>
                  <p className="text-lg font-bold text-rose-600 font-mono">- ¥ 1,482.00</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">总收入</span>
                  <p className="text-lg font-bold text-emerald-600 font-mono">+ ¥ 4,800.00</p>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                <div className="bg-blue-500 h-full w-[35%]" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>预算剩余 ¥ 3,518.00</span>
                <span>预算上限 ¥ 5,000.00</span>
              </div>
            </div>

            {/* Transactions Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs font-bold text-[#2C4A5C]">
                <span>收支记录</span>
                <span className="text-slate-400 text-[10px]">自动记账中</span>
              </div>
              <div className="glass-card rounded-2xl divide-y divide-slate-100/70 overflow-hidden">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 hover:bg-white/40">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                          t.isExpense
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {t.isExpense ? '支' : '收'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#2C4A5C]">{t.title}</p>
                        <span className="text-[10px] text-slate-400">{t.time}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
                        t.isExpense ? 'text-[#2C4A5C]' : 'text-emerald-600'
                      }`}
                    >
                      {t.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
