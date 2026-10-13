import React, { useState } from 'react';
import {
  ShoppingBag,
  Sparkles,
  Utensils,
  Tag,
  Search,
  Flame,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { TAOBAO_PRODUCTS, XIANYU_ITEMS } from '../data/mockData';

interface TaobaoAppProps {
  onBack: () => void;
}

type TaobaoTab = 'takeout' | 'xianyu';

export const TaobaoApp: React.FC<TaobaoAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TaobaoTab>('takeout');

  const products = TAOBAO_PRODUCTS;
  const xianyuItems = XIANYU_ITEMS;

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FAF6F4] overflow-hidden">
      <AppHeader
        title="淘宝 · 优选生活"
        subtitle="外卖配送 · 闲鱼集市"
        onBack={onBack}
        rightAction={
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
            <ShoppingBag className="w-4 h-4" />
          </div>
        }
      />

      {/* Segmented Top Tabs */}
      <div className="px-4 py-2 bg-white/40 border-b border-orange-100 shrink-0">
        <div className="flex items-center p-1 bg-orange-100/60 rounded-xl">
          {[
            { key: 'takeout', label: '外卖与优选', icon: Utensils },
            { key: 'xianyu', label: '闲鱼二手', icon: Tag },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as TaobaoTab)}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-orange-950/70 hover:text-orange-950'
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
        {/* Search header */}
        <div className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-2 border border-orange-200/60 shadow-xs">
          <Search className="w-4 h-4 text-orange-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'takeout' ? '搜索附近美食、咖啡、轻食下午茶' : '搜索闲鱼二手数码、书影音'
            }
            className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* TAKEOUT & GOODS */}
        {activeTab === 'takeout' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C]">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>新川市热门榜单</span>
              </span>
              <span className="text-[11px] text-slate-400">配送范围 3.5km 内</span>
            </div>

            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-orange-100 flex gap-3 shadow-xs hover:shadow-sm transition-all"
                >
                  <div
                    className={`w-20 h-20 rounded-xl bg-gradient-to-tr ${p.color} shrink-0 flex items-center justify-center text-2xl shadow-2xs`}
                  >
                    🍱
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">
                          {p.badge}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">{p.store}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{p.title}</h4>
                      <span className="text-[10px] text-emerald-600">{p.tag}</span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-extrabold text-orange-600 font-mono">
                          ¥{p.price}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          ¥{p.origPrice}
                        </span>
                      </div>
                      <button className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-bold active:scale-95 shadow-xs">
                        点单
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XIANYU RESALE */}
        {activeTab === 'xianyu' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C]">
              <span>闲置好物推荐</span>
              <span className="text-[11px] text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full font-semibold">
                担保交易
              </span>
            </div>

            <div className="space-y-3">
              {xianyuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white/85 rounded-2xl p-3.5 border border-yellow-200/60 shadow-xs space-y-2 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">@{item.seller}</span>
                    <span className="text-[10px] text-orange-600 font-medium">{item.views}</span>
                  </div>

                  <div className="flex gap-3">
                    <div
                      className={`w-16 h-16 rounded-xl bg-gradient-to-tr ${item.color} shrink-0 flex items-center justify-center text-xl shadow-2xs`}
                    >
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-base font-extrabold text-rose-600 font-mono">
                      ¥ {item.price}
                    </span>
                    <button className="px-3 py-1 rounded-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-[11px] font-bold active:scale-95">
                      聊一聊
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
