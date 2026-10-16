import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { InventoryItem, readInventory, removeInventoryItem } from '../utils/inventoryData';

interface InventoryAppProps {
  onBack: () => void;
}

type Tab = 'gift' | 'purchase';

const dateText = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

const ItemPicture: React.FC<{ item: InventoryItem; large?: boolean }> = ({ item, large }) =>
  item.imageUrl ? (
    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
  ) : (
    <span className={large ? 'text-6xl' : 'text-4xl'}>{item.emoji || '🎁'}</span>
  );

export const InventoryApp: React.FC<InventoryAppProps> = ({ onBack }) => {
  const [items, setItems] = useState<InventoryItem[]>(() => readInventory());
  const [tab, setTab] = useState<Tab>('gift');
  const [giver, setGiver] = useState('all');
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const gifts = items.filter((item) => item.kind === 'gift');
  const purchases = items.filter((item) => item.kind === 'purchase');
  const givers = Array.from(new Set(gifts.map((item) => item.fromCharName).filter((name): name is string => !!name)));
  const visible = (tab === 'gift'
    ? gifts.filter((item) => giver === 'all' || item.fromCharName === giver)
    : purchases);

  const remove = (item: InventoryItem) => {
    if (!window.confirm(`把「${item.title}」移出小盒子？`)) return;
    removeInventoryItem(item.id);
    setItems(readInventory());
    setSelected(null);
  };

  return (
    <div className="relative flex flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-[#F1F8FE] via-[#F7F3FB] to-[#FDF1F6] text-[#5B7285]">
      <AppHeader title="物品" subtitle="我的小盒子" onBack={onBack} />

      <div className="flex-1 min-h-0 space-y-3.5 overflow-y-auto p-4">
        <div className="flex items-center gap-3.5 rounded-[26px] border border-white/90 bg-white/70 p-4 shadow-[0_8px_22px_-12px_rgba(140,160,200,0.45)] backdrop-blur-xl">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#CFE5F8] to-[#F8D0E2] text-3xl shadow-inner">
            📦
            <span className="absolute -right-1 -top-1 text-base">🎀</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#6F8CA0]">小盒子里装着 {items.length} 件宝贝</p>
            <p className="mt-0.5 text-[11px] text-[#9DB3C4]">收到的礼物 {gifts.length} · 自己买的 {purchases.length}</p>
            <p className="mt-1 text-[10px] text-[#B5C6D3]">只是给你自己看的小收藏，不会被角色知道哦</p>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-2xl bg-white/60 p-1 text-xs">
          {([['gift', `💝 收到的礼物 (${gifts.length})`], ['purchase', `🛍️ 自己买的 (${purchases.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl py-2 font-semibold transition-all ${tab === key ? 'bg-white text-[#6F8CA0] shadow-sm' : 'text-[#9DB3C4]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'gift' && givers.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {['all', ...givers].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setGiver(name)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${giver === name ? 'border-[#D5C8EE] bg-gradient-to-r from-[#EAF3FC] to-[#FCEAF2] font-bold text-[#6F8CA0]' : 'border-[#E3EAF3] bg-white/60 text-[#9DB3C4]'}`}
              >
                {name === 'all' ? '全部' : `💝 ${name}`}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-[#D6E2F0] bg-white/50 px-6 py-12 text-center">
            <p className="text-4xl">{tab === 'gift' ? '🎁' : '🛍️'}</p>
            <p className="mt-2 text-xs font-bold text-[#7E9BB3]">这里还空空的</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#A9BDCB]">
              {tab === 'gift' ? '角色送你礼物之后，会悄悄放进这里～' : '你在淘宝、闲鱼买下的东西，会放进这里～（外卖不计入）'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="relative overflow-hidden rounded-[22px] border border-white/90 bg-white/75 text-left shadow-[0_6px_16px_-10px_rgba(140,160,200,0.5)] backdrop-blur-xl transition-transform active:scale-[0.97]"
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#EAF4FD] to-[#FCEAF3]">
                  <ItemPicture item={item} />
                </div>
                {item.kind === 'gift' && <span className="absolute left-2 top-2 text-sm drop-shadow">🎀</span>}
                <div className="space-y-1 p-2.5">
                  <p className="line-clamp-1 text-xs font-bold text-[#587186]">{item.title}</p>
                  {item.kind === 'gift' ? (
                    <p className="inline-block rounded-full bg-[#FBE6EC] px-2 py-0.5 text-[10px] font-semibold text-[#D98BA3]">
                      💝 {item.fromCharName ? `来自 ${item.fromCharName}` : '收到的礼物'}
                    </p>
                  ) : (
                    <p className="inline-block rounded-full bg-[#E4EEF6] px-2 py-0.5 text-[10px] font-semibold text-[#7D9DB5]">
                      {item.shop || '淘宝'}{item.price ? ` · ¥${item.price.toFixed(2)}` : ''}
                    </p>
                  )}
                  <p className="text-[9px] text-[#B5C6D3]">{dateText(item.acquiredAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#4A5F73]/25 backdrop-blur-xs" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md rounded-t-[30px] border border-white bg-gradient-to-b from-[#FDFEFF] to-[#F5F3FC] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button type="button" aria-label="关闭" onClick={() => setSelected(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E6EEF6] text-[#9DB3C4]"><X className="h-4 w-4" /></button>
            </div>
            <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#EAF4FD] to-[#FBE6F0] shadow-inner">
              <ItemPicture item={selected} large />
            </div>
            <h3 className="mt-3 text-center text-sm font-bold text-[#587186]">{selected.title}</h3>
            {selected.desc && <p className="mt-1.5 text-center text-[11px] leading-relaxed text-[#8DA5B8]">{selected.desc}</p>}
            <div className="mt-3.5 space-y-1.5 rounded-2xl bg-white/70 p-3 text-[11px] text-[#6F8798]">
              {selected.kind === 'gift' && (
                <div className="flex justify-between"><span className="text-[#A9BDCB]">来自</span><span className="font-semibold text-[#D98BA3]">💝 {selected.fromCharName || '某个人'}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[#A9BDCB]">来源</span><span>{selected.kind === 'gift' ? '收到的礼物' : '自己买的'}{selected.shop ? ` · ${selected.shop}` : ''}</span></div>
              {!!selected.price && <div className="flex justify-between"><span className="text-[#A9BDCB]">价格</span><span>¥{selected.price.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span className="text-[#A9BDCB]">入手时间</span><span>{dateText(selected.acquiredAt)}</span></div>
            </div>
            <button
              type="button"
              onClick={() => remove(selected)}
              className="mx-auto mt-3.5 flex items-center gap-1 rounded-full bg-[#F6E4E8] px-4 py-1.5 text-[11px] text-[#CF8F9F] active:scale-95"
            >
              <Trash2 className="h-3 w-3" />移出小盒子
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
