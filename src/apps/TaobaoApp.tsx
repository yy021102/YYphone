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

interface TaobaoAppProps {
  onBack: () => void;
}

type TaobaoTab = 'takeout' | 'xianyu';

export const TaobaoApp: React.FC<TaobaoAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TaobaoTab>('takeout');

  // Food / Delivery & Goods
  const products = [
    {
      id: 1,
      title: '生椰燕麦轻乳茶 (双倍珍珠)',
      store: '浅井茶饮研究所',
      price: '21.5',
      origPrice: '26',
      rating: '4.9',
      tag: '30分钟必达',
      badge: '外卖热销',
      color: 'from-amber-100 to-orange-200',
    },
    {
      id: 2,
      title: '低糖手作巴斯克芝士蛋糕',
      store: '星野甜点屋',
      price: '35.0',
      origPrice: '42',
      rating: '5.0',
      tag: '冷链配送',
      badge: '今日推荐',
      color: 'from-pink-100 to-rose-200',
    },
    {
      id: 3,
      title: '全麦熏鸡肉牛油果波奇饭',
      store: 'GreenBite 轻食便当',
      price: '28.8',
      origPrice: '36',
      rating: '4.8',
      tag: '减脂推荐',
      badge: '满减优惠',
      color: 'from-emerald-100 to-teal-200',
    },
  ];

  // Xianyu Secondhand Items
  const xianyuItems = [
    {
      id: 1,
      title: '【99新】Retro 68键 客制化机械键盘 (水蓝轴)',
      seller: '键圈漫游者',
      price: '268',
      views: '42人想要',
      desc: '仅通电试轴两次，手感顺滑如水，附赠透明防尘罩与拔轴器。',
      color: 'from-sky-200 to-indigo-200',
    },
    {
      id: 2,
      title: '【正版】世界书创世纪典藏设定画集 (首刷带特典)',
      seller: '藏书猫猫',
      price: '145',
      views: '118人想要',
      desc: '书脊完好无折痕，内页全彩铜版纸，附赠独家角色书签三枚。',
      color: 'from-purple-200 to-pink-200',
    },
    {
      id: 3,
      title: '【日版】胶片复古便携袖珍相机',
      seller: '晴天小林',
      price: '199',
      views: '86人想要',
      desc: '成色极佳，镜头通透无霉，附带全新电池与皮革腕带。',
      color: 'from-amber-200 to-yellow-200',
    },
  ];

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
