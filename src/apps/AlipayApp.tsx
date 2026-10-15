import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Receipt,
  QrCode,
  Scan,
  TrendingUp,
  CreditCard,
  ArrowDownLeft,
  Sparkles,
  ShieldCheck,
  Menu,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  Upload,
  Trash2,
  Eye,
  HeartHandshake,
  Plus,
  X,
  Check,
  Image,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import {
  AlipayContact,
  AlipayData,
  IntimatePayCard,
  RealLedgerItem,
  readAlipayContacts,
  readAlipayData,
  writeAlipayData,
} from '../utils/alipayData';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { compressImageFile } from '../utils/imageFile';

interface AlipayAppProps {
  onBack: () => void;
}

type AlipayTab = 'wallet' | 'ledger';

interface AlipayAppearance {
  wallpaperUrl: string;
  expenseIcon: string;
  incomeIcon: string;
}

const ALIPAY_APPEARANCE_KEY = 'yyphone:alipay-appearance';
const DEFAULT_ALIPAY_APPEARANCE: AlipayAppearance = {
  wallpaperUrl: '',
  expenseIcon: '↗️',
  incomeIcon: '↙️',
};
const isAlipayAppearance = (value: unknown): value is AlipayAppearance =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as AlipayAppearance).wallpaperUrl === 'string' &&
  typeof (value as AlipayAppearance).expenseIcon === 'string' &&
  typeof (value as AlipayAppearance).incomeIcon === 'string';

export const AlipayApp: React.FC<AlipayAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AlipayTab>('wallet');
  const [appearance, setAppearance] = useState<AlipayAppearance>(() =>
    readStoredValue(ALIPAY_APPEARANCE_KEY, DEFAULT_ALIPAY_APPEARANCE, isAlipayAppearance)
  );
  const [wallpaperDraft, setWallpaperDraft] = useState(appearance.wallpaperUrl);
  const [expenseIconDraft, setExpenseIconDraft] = useState(appearance.expenseIcon);
  const [incomeIconDraft, setIncomeIconDraft] = useState(appearance.incomeIcon);
  const [initialFinanceData] = useState<AlipayData>(() => readAlipayData());
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());

  // ==================== 1. 虚拟钱包状态 (我的钱包) ====================
  const [balance, setBalance] = useState<number>(initialFinanceData.balance);
  const [yuebao, setYuebao] = useState<number>(initialFinanceData.yuebao);
  const [bankCardCount, setBankCardCount] = useState<string>(initialFinanceData.bankCardCount);
  const [bankCardNote, setBankCardNote] = useState<string>(initialFinanceData.bankCardNote);

  // 亲密付多角色列表
  const [intimateCards, setIntimateCards] = useState<IntimatePayCard[]>(
    initialFinanceData.intimateCards.filter((card) => contacts.some((contact) => contact.id === card.charId))
  );

  // ==================== 2. 真实日常记账状态 (日常记账) ====================
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [viewMode, setViewMode] = useState<'today' | 'month'>('today'); // 仅看今日 vs 当月全部
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>(
    initialFinanceData.monthlyBudgets
  );

  const [ledgerList, setLedgerList] = useState<RealLedgerItem[]>(initialFinanceData.ledgerList);

  const [allowedViewers, setAllowedViewers] = useState<string[]>(
    initialFinanceData.allowedViewers.filter((id) => contacts.some((contact) => contact.id === id))
  );
  const [lastInterestDate, setLastInterestDate] = useState(initialFinanceData.lastInterestDate);

  // ==================== 3. 各类弹窗开关状态 ====================
  const [showMenuModal, setShowMenuModal] = useState(false); // 右上角三横杠菜单
  const [showTopUpModal, setShowTopUpModal] = useState(false); // 充值弹窗
  const [topUpInput, setTopUpInput] = useState('');
  const [topUpTarget, setTopUpTarget] = useState<'balance' | 'yuebao'>('balance');

  const [showBankEditModal, setShowBankEditModal] = useState(false); // 银行卡编辑弹窗
  const [tempBankCount, setTempBankCount] = useState(bankCardCount);
  const [tempBankNote, setTempBankNote] = useState(bankCardNote);

  const [showBudgetModal, setShowBudgetModal] = useState(false); // 预算编辑弹窗
  const [tempBudgetInput, setTempBudgetInput] = useState('');

  const [showAddLedgerModal, setShowAddLedgerModal] = useState(false); // 铅笔“记一笔”弹窗
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [newLedgerTitle, setNewLedgerTitle] = useState('');
  const [newLedgerAmount, setNewLedgerAmount] = useState('');
  const [newLedgerIsExpense, setNewLedgerIsExpense] = useState(true);
  const [newLedgerDate, setNewLedgerDate] = useState(todayStr);
  const [showIntimateEditModal, setShowIntimateEditModal] = useState(false);
  const [intimateContactId, setIntimateContactId] = useState('');
  const [intimateLimitDraft, setIntimateLimitDraft] = useState('');
  const [intimateNoteDraft, setIntimateNoteDraft] = useState('');
  const [intimateError, setIntimateError] = useState('');

  useEffect(() => {
    try {
      writeAlipayData({
        balance,
        yuebao,
        bankCardCount,
        bankCardNote,
        intimateCards,
        monthlyBudgets,
        ledgerList,
        allowedViewers,
        lastInterestDate,
      });
    } catch (error) {
      console.error('Could not persist Alipay data.', error);
    }
  }, [
    balance,
    yuebao,
    bankCardCount,
    bankCardNote,
    intimateCards,
    monthlyBudgets,
    ledgerList,
    allowedViewers,
    lastInterestDate,
  ]);

  useEffect(() => {
    writeStoredValue(ALIPAY_APPEARANCE_KEY, appearance);
  }, [appearance]);

  // ==================== 4. 计算逻辑 ====================
  const totalAssets = balance + yuebao;
  const dailyYuebaoProfit = ((yuebao * 0.0208) / 365).toFixed(2); // 按年化2.08%自动算日收益

  // 月份切换函数 (支持上月、上上月、去年任意翻页)
  const handleMonthChange = (offset: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + offset, 1);
    const nextMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonthStr);
    // 如果切换到非当月，自动切到“当月全部”视图方便看旧账
    if (nextMonthStr !== currentMonthStr) {
      setViewMode('month');
    }
  };

  // 当前选中月份的收支统计
  const monthTransactions = ledgerList.filter((item) => item.date.startsWith(selectedMonth));
  const monthExpense = monthTransactions
    .filter((i) => i.isExpense)
    .reduce((sum, i) => sum + i.amount, 0);
  const monthIncome = monthTransactions
    .filter((i) => !i.isExpense)
    .reduce((sum, i) => sum + i.amount, 0);

  const currentBudget = monthlyBudgets[selectedMonth] ?? 0;
  const budgetRemaining = Math.max(0, currentBudget - monthExpense);
  const budgetPercent = currentBudget > 0 ? Math.min(100, (monthExpense / currentBudget) * 100) : 0;

  // 当前列表展示的账单（仅今日 vs 当月全部）
  const displayedTransactions =
    viewMode === 'today' && selectedMonth === currentMonthStr
      ? monthTransactions.filter((item) => item.date === todayStr)
      : monthTransactions;

  // ==================== 5. 交互处理函数 ====================
  const handleTopUpConfirm = () => {
    const val = parseFloat(topUpInput);
    if (!isNaN(val) && val > 0) {
      if (topUpTarget === 'yuebao') setYuebao((prev) => prev + val);
      else setBalance((prev) => prev + val);
      setTopUpInput('');
      setShowTopUpModal(false);
    }
  };

  const handleSaveBankInfo = () => {
    setBankCardCount(tempBankCount.trim() || '0 张');
    setBankCardNote(tempBankNote.trim() || '暂无绑定银行卡');
    setShowBankEditModal(false);
  };

  const openIntimateEditor = (contactId: string) => {
    const card = intimateCards.find((item) => item.charId === contactId);
    setIntimateContactId(contactId);
    setIntimateLimitDraft(card ? String(card.monthlyLimit) : '');
    setIntimateNoteDraft(card?.note ?? '');
    setShowIntimateEditModal(true);
  };

  const handleSaveIntimateCard = () => {
    const contact = contacts.find((item) => item.id === intimateContactId);
    const limit = Number(intimateLimitDraft);
    if (!contact || !Number.isFinite(limit) || limit <= 0) {
      setIntimateError('请输入有效的亲密付月度额度。');
      return;
    }
    const existing = intimateCards.find((card) => card.charId === contact.id);
    const nextCard: IntimatePayCard = {
      id: existing?.id ?? `intimate-${contact.id}`,
      charId: contact.id,
      charName: contact.name,
      avatar: contact.avatarUrl,
      monthlyLimit: limit,
      usedAmount: existing?.usedAmount ?? 0,
      note: intimateNoteDraft.trim(),
    };
    setIntimateCards((current) => [
      ...current.filter((card) => card.charId !== contact.id),
      nextCard,
    ]);
    setIntimateError('');
    setShowIntimateEditModal(false);
  };

  const handleRemoveIntimateCard = () => {
    setIntimateCards((current) => current.filter((card) => card.charId !== intimateContactId));
    setShowIntimateEditModal(false);
  };

  const handleSaveBudget = () => {
    const val = parseFloat(tempBudgetInput);
    if (!isNaN(val) && val >= 0) {
      setMonthlyBudgets((prev) => ({ ...prev, [selectedMonth]: val }));
      setShowBudgetModal(false);
    }
  };

  const handleAddLedgerItem = () => {
    const val = parseFloat(newLedgerAmount);
    if (!newLedgerTitle.trim() || isNaN(val) || val <= 0) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (editingLedgerId) {
      setLedgerList((prev) => prev.map((item) => item.id === editingLedgerId
        ? {
          ...item,
          title: newLedgerTitle.trim(),
          amount: val,
          isExpense: newLedgerIsExpense,
          date: newLedgerDate || todayStr,
        }
        : item));
    } else {
      const newItem: RealLedgerItem = {
        id: `ledger-${Date.now()}`,
        title: newLedgerTitle.trim(),
        amount: val,
        isExpense: newLedgerIsExpense,
        date: newLedgerDate || todayStr,
        time: timeStr,
      };
      setLedgerList((prev) => [newItem, ...prev]);
    }
    setEditingLedgerId(null);
    setNewLedgerTitle('');
    setNewLedgerAmount('');
    setShowAddLedgerModal(false);
  };

  const openLedgerEditor = (item: RealLedgerItem) => {
    setEditingLedgerId(item.id);
    setNewLedgerTitle(item.title);
    setNewLedgerAmount(String(item.amount));
    setNewLedgerIsExpense(item.isExpense);
    setNewLedgerDate(item.date);
    setShowAddLedgerModal(true);
  };

  const handleDeleteLedgerItem = (item: RealLedgerItem) => {
    if (window.confirm(`确定删除「${item.title}」这条记账吗？`)) {
      setLedgerList((current) => current.filter((entry) => entry.id !== item.id));
    }
  };

  const handleSaveAppearance = () => {
    setAppearance({
      wallpaperUrl: wallpaperDraft.trim(),
      expenseIcon: expenseIconDraft.trim() || DEFAULT_ALIPAY_APPEARANCE.expenseIcon,
      incomeIcon: incomeIconDraft.trim() || DEFAULT_ALIPAY_APPEARANCE.incomeIcon,
    });
  };

  // 导出数据
  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        balance,
        yuebao,
        bankCardCount,
        bankCardNote,
        intimateCards,
        monthlyBudgets,
        ledgerList,
        allowedViewers,
        lastInterestDate,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alipay_backup_${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="relative flex-1 w-full flex flex-col bg-gradient-to-b from-[#F2F8FF] via-[#F7F5FC] to-[#FEF3F8] overflow-hidden select-none"
      style={appearance.wallpaperUrl ? {
        backgroundImage: `linear-gradient(rgba(242,248,255,0.72), rgba(254,243,248,0.72)), url("${appearance.wallpaperUrl}")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      } : undefined}
    >
      {/* 氛围背景光晕 */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-pink-200/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-indigo-100/25 blur-3xl pointer-events-none" />

      {/* 顶部栏：右上角改为三个横杠按钮 */}
      <AppHeader
        title="支付宝 · 财务中心"
        onBack={onBack}
        rightAction={
          <button
            onClick={() => setShowMenuModal(true)}
            className="w-8 h-8 flex items-center justify-center text-sky-700 bg-white/65 hover:bg-white/90 backdrop-blur-md border border-white/85 rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="财务设置与数据管理"
          >
            <Menu className="w-4 h-4 stroke-[2.2]" />
          </button>
        }
      />

      {/* Segmented Top Tabs - 玻璃胶囊切换栏 */}
      <div className="px-4 py-2.5 z-10 shrink-0">
        <div className="flex items-center p-1 bg-white/45 backdrop-blur-xl border border-white/75 rounded-2xl shadow-[0_4px_16px_rgba(148,163,184,0.08)]">
          {[
            { key: 'wallet', label: '我的钱包', icon: Wallet },
            { key: 'ledger', label: '日常记账', icon: Receipt },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as AlipayTab)}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-200 via-blue-200 to-indigo-200 text-slate-700 shadow-md shadow-sky-200/40 scale-[1.01]'
                    : 'text-slate-500 hover:text-slate-700'
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
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-4 pb-[env(safe-area-inset-bottom,0px)]">
        {/* ==================== TAB 1: 我的钱包 (小手机虚拟资产) ==================== */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            {/* 主资产大卡片 */}
            <div className="w-full bg-gradient-to-br from-[#A8CDF8] via-[#BFC6F7] to-[#F8C6DF] text-slate-700 rounded-[28px] p-5 shadow-[0_12px_28px_-6px_rgba(148,180,245,0.35)] border border-white/50 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/30 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full bg-pink-100/30 blur-xl pointer-events-none" />

              <div className="relative flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                  <span>总资产估值 (CNY)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-medium bg-white/45 border border-white/55 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span>余额宝日收益 +{dailyYuebaoProfit}</span>
                </span>
              </div>

              <div className="relative mt-3 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold opacity-70">¥</span>
                  <span className="text-3xl font-extrabold tracking-tight font-mono drop-shadow-xs">
                    {totalAssets.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
                  <span>可用余额: ¥ {balance.toFixed(2)}</span>
                  <span className="opacity-40">|</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-sky-500" />
                    小手机虚拟金库
                  </span>
                </p>
              </div>

              {/* 快捷操作栏：去掉了“转账”，保留 3 项，点击“充值”可交互 */}
              <div className="relative grid grid-cols-3 gap-2.5 p-2 rounded-2xl bg-white/30 backdrop-blur-md border border-white/45">
                <button className="flex flex-col items-center py-1.5 hover:bg-white/35 active:scale-95 rounded-xl transition-all cursor-pointer group">
                  <div className="w-8 h-8 rounded-xl bg-white/40 border border-white/55 flex items-center justify-center">
                    <Scan className="w-4 h-4 text-slate-600 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium mt-1">扫一扫</span>
                </button>

                <button className="flex flex-col items-center py-1.5 hover:bg-white/35 active:scale-95 rounded-xl transition-all cursor-pointer group">
                  <div className="w-8 h-8 rounded-xl bg-white/40 border border-white/55 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-slate-600 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium mt-1">付款码</span>
                </button>

                <button
                  onClick={() => {
                    setTopUpTarget('balance');
                    setShowTopUpModal(true);
                  }}
                  className="flex flex-col items-center py-1.5 bg-white/45 hover:bg-white/60 active:scale-95 rounded-xl transition-all cursor-pointer border border-white/60 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-200 to-sky-200 border border-white/70 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4 text-slate-600 stroke-[2.4]" />
                  </div>
                  <span className="text-[10px] text-slate-700 font-bold mt-1">充值余额</span>
                </button>
              </div>
            </div>

            {/* 双列磨砂果冻卡：余额宝 + 绑定银行卡 (右上角卡包图标可点击编辑) */}
            <div className="grid grid-cols-2 gap-3">
              {/* 余额宝 */}
              <div className="bg-white/55 backdrop-blur-xl border border-white/80 rounded-3xl p-4 shadow-[0_8px_20px_-6px_rgba(148,163,184,0.15)] space-y-1.5 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-emerald-100/40 blur-xl pointer-events-none" />
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>余额宝</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTopUpTarget('yuebao');
                      setTopUpInput('');
                      setShowTopUpModal(true);
                    }}
                    className="rounded-full bg-emerald-50/90 border border-emerald-100/70 px-2 py-1 text-[9px] font-semibold text-emerald-600"
                    aria-label="转入余额宝"
                  >
                    <TrendingUp className="mr-1 inline h-3 w-3" />转入
                  </button>
                </div>
                <p className="text-lg font-extrabold text-[#2C4A5C] font-mono tracking-tight">
                  ¥ {yuebao.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </p>
                <span className="inline-block text-[10px] text-emerald-600 bg-emerald-50/90 border border-emerald-100/60 px-2 py-0.5 rounded-full font-semibold">
                  七日年化 2.08%
                </span>
              </div>

              {/* 绑定银行卡 (点击右上角小卡包弹出编辑框) */}
              <div className="bg-white/55 backdrop-blur-xl border border-white/80 rounded-3xl p-4 shadow-[0_8px_20px_-6px_rgba(148,163,184,0.15)] space-y-1.5 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-sky-100/50 blur-xl pointer-events-none" />
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>绑定银行卡</span>
                  <button
                    onClick={() => {
                      setTempBankCount(bankCardCount);
                      setTempBankNote(bankCardNote);
                      setShowBankEditModal(true);
                    }}
                    className="w-6 h-6 rounded-full bg-sky-50/90 hover:bg-sky-100/80 border border-sky-100/80 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    title="点击编辑银行卡装饰信息"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-sky-500" />
                  </button>
                </div>
                <p className="text-lg font-extrabold text-[#2C4A5C] font-mono tracking-tight">
                  {bankCardCount}
                </p>
                <span className="inline-block text-[10px] text-sky-600 bg-sky-50/90 border border-sky-100/60 px-2 py-0.5 rounded-full font-semibold truncate max-w-full">
                  {bankCardNote}
                </span>
              </div>
            </div>

            {/* 多角色亲密付专区 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold text-[#2C4A5C] flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-pink-400" />
                  <span>TA 的亲密付 · 角色专属卡包</span>
                </span>
                <span className="text-[10px] text-slate-400">支持淘宝/转账时选择扣款</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                {contacts.length === 0 && (
                  <p className="text-[10px] text-slate-400">通讯录中还没有角色，请先在微信通讯录添加。</p>
                )}
                {contacts.length > 0 && (
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) openIntimateEditor(event.target.value);
                    }}
                    aria-label="选择通讯录角色开通或编辑亲密付"
                    className="max-w-40 rounded-lg border border-pink-100 bg-white/80 px-2 py-1.5 text-[10px] text-slate-600"
                  >
                    <option value="">选择通讯录角色</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {intimateCards.some((card) => card.charId === contact.id) ? '编辑 · ' : '开通 · '}{contact.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2.5">
                {intimateCards.map((card) => {
                  const contact = contacts.find((item) => item.id === card.charId);
                  if (!contact) return null;
                  const remain = Math.max(0, card.monthlyLimit - card.usedAmount);
                  return (
                    <div
                      key={card.id}
                      onClick={() => openIntimateEditor(contact.id)}
                      className="bg-gradient-to-r from-pink-50/80 via-white/75 to-sky-50/80 backdrop-blur-xl border border-white/90 rounded-3xl p-4 shadow-[0_6px_18px_rgba(244,114,182,0.08)] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-200 to-sky-200 text-slate-600 flex items-center justify-center text-xs font-extrabold shadow-xs border border-white/70 overflow-hidden">
                            {contact.avatarUrl
                              ? <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" />
                              : contact.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-extrabold text-[#2C4A5C]">
                                {contact.name} 的亲密付
                              </p>
                              <span className="text-[9px] bg-pink-100/60 text-pink-500 border border-pink-100/70 px-1.5 py-0.2 rounded-full font-semibold">
                                已开通
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">“{card.note}”</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">剩余可用</span>
                          <span className="text-sm font-extrabold font-mono text-pink-400">
                            ¥ {remain.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* 亲密付额度条 */}
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-200 to-sky-200 rounded-full"
                            style={{
                              width: `${Math.min(100, (card.usedAmount / card.monthlyLimit) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>本月已为我买单 ¥{card.usedAmount.toFixed(2)}</span>
                          <span>总额度 ¥{card.monthlyLimit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {intimateCards.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-pink-100 bg-white/40 p-4 text-center text-[10px] text-slate-400">
                    尚未开通亲密付。请选择一位通讯录角色设置月度额度。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: 日常记账 (玩家三次元真实记账本) ==================== */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* 月份切换器 + 月度收支与预算卡片 */}
            <div className="bg-white/65 backdrop-blur-xl border border-white/85 rounded-3xl p-4 space-y-3.5 shadow-[0_8px_24px_-6px_rgba(148,163,184,0.15)] relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-pink-100/40 blur-2xl pointer-events-none" />

              {/* 顶部：日历式月份切换器 (支持查看上月、上上月、去年) */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#2C4A5C] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>月度账本总览</span>
                </span>

                <div className="flex items-center gap-1 bg-white/80 border border-white px-1.5 py-0.5 rounded-full shadow-2xs">
                  <button
                    onClick={() => handleMonthChange(-1)}
                    className="p-1 text-slate-500 hover:text-sky-500 active:scale-90 cursor-pointer"
                    title="上个月"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold font-mono text-[#2C4A5C] px-1.5">
                    {selectedMonth.replace('-', '年')}月
                  </span>
                  <button
                    onClick={() => handleMonthChange(1)}
                    className="p-1 text-slate-500 hover:text-sky-500 active:scale-90 cursor-pointer"
                    title="下个月"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 总支出 & 总收入 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-pink-100/60 to-white/40 backdrop-blur-md border border-white/70 shadow-[0_4px_14px_rgba(244,167,200,0.18)] rounded-2xl p-3">
                  <span className="text-[11px] text-[#9A7A8C] font-medium">本月总支出</span>
                  <p className="text-lg font-extrabold text-[#C98CA8] font-mono mt-0.5">
                    - ¥ {monthExpense.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-sky-100/60 to-white/40 backdrop-blur-md border border-white/70 shadow-[0_4px_14px_rgba(125,190,230,0.18)] rounded-2xl p-3">
                  <span className="text-[11px] text-[#6F8CA0] font-medium">本月总收入</span>
                  <p className="text-lg font-extrabold text-[#6FA6C8] font-mono mt-0.5">
                    + ¥ {monthIncome.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* 可交互预算进度条 */}
              <div className="space-y-1.5 pt-0.5">
                <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/60">
                  <div
                    className="bg-gradient-to-r from-sky-200 via-indigo-200 to-pink-200 h-full rounded-full transition-all duration-300"
                    style={{ width: `${budgetPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-0.5">
                  <span>
                    预算剩余{' '}
                    <strong className="text-slate-600 font-mono">
                      ¥ {budgetRemaining.toFixed(2)}
                    </strong>
                  </span>
                  <button
                    onClick={() => {
                      setTempBudgetInput(String(currentBudget));
                      setShowBudgetModal(true);
                    }}
                    className="flex items-center gap-1 text-sky-500 hover:text-sky-600 bg-sky-50/80 border border-sky-100 px-2 py-0.5 rounded-full cursor-pointer active:scale-95 transition-transform"
                  >
                    <span>预算上限 ¥ {currentBudget.toFixed(0)}</span>
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 收支记录流 + 视图切换 (仅今日 / 当月全部) + 铅笔记账按钮 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                {/* 左侧：切换“今日记录”或“当月历史” */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewMode('today')}
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                      viewMode === 'today' && selectedMonth === currentMonthStr
                        ? 'bg-white/80 text-[#2C4A5C] shadow-2xs border border-white'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    今日记录
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                      viewMode === 'month' || selectedMonth !== currentMonthStr
                        ? 'bg-white/80 text-[#2C4A5C] shadow-2xs border border-white'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    当月全部 ({monthTransactions.length})
                  </button>
                </div>

                {/* 右侧：铅笔记一笔按钮 */}
                <button
                  onClick={() => {
                    setEditingLedgerId(null);
                    setNewLedgerTitle('');
                    setNewLedgerAmount('');
                    setNewLedgerIsExpense(true);
                    setNewLedgerDate(todayStr);
                    setShowAddLedgerModal(true);
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-sky-200 to-pink-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-pink-200/50 active:scale-95 transition-transform cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>记一笔</span>
                </button>
              </div>

              {/* 账单列表（支持空状态提示） */}
              {displayedTransactions.length === 0 ? (
                <div className="bg-white/50 backdrop-blur-xl border border-white/80 rounded-3xl p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50/70 text-sky-400 flex items-center justify-center mx-auto">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {viewMode === 'today' ? '今天还没有记账哦~' : '该月份暂无收支记录'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    点击右上角「记一笔」开始记录你的三次元日常收支吧
                  </p>
                </div>
              ) : (
                <div className="bg-white/60 backdrop-blur-xl border border-white/85 rounded-3xl divide-y divide-slate-100/80 overflow-hidden shadow-[0_8px_24px_-6px_rgba(148,163,184,0.12)]">
                  {displayedTransactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3.5 hover:bg-white/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-extrabold border shadow-2xs ${
                            t.isExpense
                              ? 'bg-gradient-to-br from-rose-50 to-pink-50/80 text-rose-400 border-rose-100/60'
                              : 'bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-500 border-emerald-100/60'
                          }`}
                        >
                          {t.isExpense ? appearance.expenseIcon : appearance.incomeIcon}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#2C4A5C]">{t.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {t.date} · {t.time}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-extrabold font-mono tabular-nums px-2 py-1 rounded-lg ${
                            t.isExpense
                              ? 'text-slate-700 bg-slate-100/60'
                              : 'text-emerald-500 bg-emerald-50/80'
                          }`}
                        >
                          {t.isExpense ? `- ¥${t.amount.toFixed(2)}` : `+ ¥${t.amount.toFixed(2)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => openLedgerEditor(t)}
                          className="w-7 h-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center"
                          aria-label={`编辑记账：${t.title}`}
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLedgerItem(t)}
                          className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center"
                          aria-label={`删除记账：${t.title}`}
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== 弹窗 1：右上角三横杠设置菜单 ==================== */}
      {showMenuModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-h-[88%] overflow-y-auto no-scrollbar bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#2C4A5C]">支付宝 · 美化与数据管理</h3>
              <button
                onClick={() => setShowMenuModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 支付宝专属壁纸与收支图标 */}
            <div className="space-y-3 bg-gradient-to-br from-sky-50/80 to-pink-50/70 border border-white rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A5C]">
                <Image className="w-3.5 h-3.5 text-pink-400" />
                <span>支付宝专属美化</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500">页面壁纸图片链接</label>
                <input
                  type="url"
                  value={wallpaperDraft.startsWith('data:') ? '' : wallpaperDraft}
                  onChange={(event) => setWallpaperDraft(event.target.value)}
                  placeholder="粘贴壁纸图片 URL，也可从本地上传"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600"
                />
                <div className="flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] font-semibold text-sky-600">
                    <Upload className="w-3.5 h-3.5" />
                    上传壁纸
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          setWallpaperDraft(await compressImageFile(file));
                        } catch (error) {
                          alert(error instanceof Error ? error.message : '壁纸处理失败。');
                        } finally {
                          event.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setWallpaperDraft('')}
                    className="rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2 text-[11px] font-semibold text-rose-400"
                  >
                    清除壁纸
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[10px] text-slate-500">
                  支出图标
                  <input
                    value={expenseIconDraft}
                    maxLength={4}
                    onChange={(event) => setExpenseIconDraft(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    placeholder="例如 🛍️"
                  />
                </label>
                <label className="space-y-1 text-[10px] text-slate-500">
                  收入图标
                  <input
                    value={incomeIconDraft}
                    maxLength={4}
                    onChange={(event) => setIncomeIconDraft(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    placeholder="例如 💰"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={handleSaveAppearance}
                className="w-full rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 py-2 text-xs font-bold text-slate-700"
              >
                保存美化设置
              </button>
            </div>

            {/* 谁可以看我的日常记账 */}
            <div className="space-y-2 bg-sky-50/60 border border-sky-100 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A5C]">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>谁可以查看我的「日常记账」？</span>
              </div>
              <p className="text-[10px] text-slate-400">
                被勾选的角色在聊天时可感知你的近期收支情况并关心你
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {contacts.map((contact) => {
                  const checked = allowedViewers.includes(contact.id);
                  return (
                    <button
                      key={contact.id}
                      onClick={() =>
                        setAllowedViewers((prev) =>
                          checked ? prev.filter((id) => id !== contact.id) : [...prev, contact.id]
                        )
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        checked
                          ? 'bg-gradient-to-r from-sky-200 to-pink-200 text-slate-700 border-transparent shadow-2xs'
                          : 'bg-white/80 text-slate-500 border-slate-200'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${checked ? 'opacity-100' : 'opacity-0'}`} />
                      <span>{contact.name}</span>
                    </button>
                  );
                })}
                {contacts.length === 0 && (
                  <p className="text-[10px] text-slate-400">微信通讯录中暂无角色。</p>
                )}
              </div>
            </div>

            {/* 导入 / 导出 / 清空 */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={handleExportData}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 hover:bg-sky-50/50 text-xs font-bold text-slate-600 cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>导出记录</span>
              </button>

              <label className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 hover:bg-sky-50/50 text-xs font-bold text-slate-600 cursor-pointer">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>导入记录</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const data = JSON.parse(String(ev.target?.result));
                        if (Array.isArray(data.ledgerList)) setLedgerList(data.ledgerList);
                        if (typeof data.balance === 'number') setBalance(data.balance);
                        if (typeof data.yuebao === 'number') setYuebao(data.yuebao);
                        if (typeof data.bankCardCount === 'string') setBankCardCount(data.bankCardCount);
                        if (typeof data.bankCardNote === 'string') setBankCardNote(data.bankCardNote);
                        if (Array.isArray(data.intimateCards)) {
                          setIntimateCards(data.intimateCards.filter((card: IntimatePayCard) =>
                            contacts.some((contact) => contact.id === card.charId)
                          ));
                        }
                        if (data.monthlyBudgets && typeof data.monthlyBudgets === 'object') {
                          setMonthlyBudgets(data.monthlyBudgets);
                        }
                        if (Array.isArray(data.allowedViewers)) {
                          setAllowedViewers(data.allowedViewers.filter((id: string) =>
                            contacts.some((contact) => contact.id === id)
                          ));
                        }
                        if (typeof data.lastInterestDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.lastInterestDate)) {
                          setLastInterestDate(data.lastInterestDate);
                        }
                        setShowMenuModal(false);
                      } catch {
                        alert('导入文件格式有误');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>

              <button
                onClick={() => {
                  if (window.confirm('确定要清空所有日常记账数据吗？')) {
                    setLedgerList([]);
                    setShowMenuModal(false);
                  }
                }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-rose-50/70 border border-rose-100 hover:bg-rose-100/60 text-xs font-bold text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>清除数据</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 2：充值余额弹窗 ==================== */}
      {showTopUpModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-[#2C4A5C]">
              {topUpTarget === 'yuebao' ? '转入余额宝' : '充值支付宝余额'}
            </h3>
            <input
              type="number"
              placeholder="请输入充值金额 (例如 1000)"
              value={topUpInput}
              onChange={(e) => setTopUpInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-sm font-mono focus:outline-none focus:border-sky-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowTopUpModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleTopUpConfirm}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {topUpTarget === 'yuebao' ? '确认转入' : '确认充值'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 3：绑定银行卡装饰编辑弹窗 ==================== */}
      {showBankEditModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5">
            <h3 className="text-sm font-extrabold text-[#2C4A5C]">编辑银行卡展示信息</h3>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">卡片数量显示</label>
              <input
                type="text"
                value={tempBankCount}
                onChange={(e) => setTempBankCount(e.target.value)}
                placeholder="例如：3 张"
                className="w-full px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">底部银行小字备注</label>
              <input
                type="text"
                value={tempBankNote}
                onChange={(e) => setTempBankNote(e.target.value)}
                placeholder="例如：新川银行 · 储蓄卡"
                className="w-full px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-bold"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowBankEditModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveBankInfo}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 4：修改月度预算弹窗 ==================== */}
      {showBudgetModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-[#2C4A5C]">
              设置 {selectedMonth} 预算上限
            </h3>
            <input
              type="number"
              value={tempBudgetInput}
              onChange={(e) => setTempBudgetInput(e.target.value)}
              placeholder="请输入月度预算金额"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveBudget}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                保存预算
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 5：铅笔“记一笔”真实日常记账弹窗 ==================== */}
      {showAddLedgerModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5">
            <h3 className="text-sm font-extrabold text-[#2C4A5C]">
              {editingLedgerId ? '编辑记录 · 日常收支' : '记一笔 · 日常收支'}
            </h3>

            {/* 支出 / 收入切换 */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setNewLedgerIsExpense(true)}
                className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  newLedgerIsExpense ? 'bg-rose-300 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                支出
              </button>
              <button
                onClick={() => setNewLedgerIsExpense(false)}
                className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  !newLedgerIsExpense ? 'bg-emerald-300 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                收入
              </button>
            </div>

            <input
              type="text"
              placeholder="账目说明（如：奶茶、打车、发工资）"
              value={newLedgerTitle}
              onChange={(e) => setNewLedgerTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-bold"
            />

            <input
              type="number"
              placeholder="金额 (¥)"
              value={newLedgerAmount}
              onChange={(e) => setNewLedgerAmount(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-sm font-mono font-bold"
            />

            <input
              type="date"
              value={newLedgerDate}
              onChange={(e) => setNewLedgerDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-mono text-slate-600"
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowAddLedgerModal(false);
                  setEditingLedgerId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleAddLedgerItem}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {editingLedgerId ? '保存修改' : '保存记录'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showIntimateEditModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5">
            <h3 className="text-sm font-extrabold text-[#2C4A5C]">
              {intimateCards.some((card) => card.charId === intimateContactId) ? '编辑亲密付' : '开通亲密付'}
              {contacts.find((contact) => contact.id === intimateContactId)?.name
                ? ` · ${contacts.find((contact) => contact.id === intimateContactId)?.name}`
                : ''}
            </h3>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              每月额度（元）
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={intimateLimitDraft}
                onChange={(event) => setIntimateLimitDraft(event.target.value)}
                placeholder="输入每月可使用的额度"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-sm font-mono"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              备注或角色留言
              <input
                value={intimateNoteDraft}
                onChange={(event) => setIntimateNoteDraft(event.target.value)}
                maxLength={160}
                placeholder="可选"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-xs"
              />
            </label>
            {intimateError && <p role="alert" className="text-[11px] text-rose-500">{intimateError}</p>}
            <div className="flex gap-2">
              {intimateCards.some((card) => card.charId === intimateContactId) && (
                <button
                  type="button"
                  onClick={handleRemoveIntimateCard}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500"
                >
                  关闭亲密付
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowIntimateEditModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveIntimateCard}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 py-2 text-xs font-bold text-slate-700"
              >
                保存额度
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};