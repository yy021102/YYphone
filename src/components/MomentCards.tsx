import React from 'react';

const CARD_THEMES = [
  { background: 'linear-gradient(135deg,#dbeafe,#fce7f3)', ink: '#587589', blob: '#bfdbfe' },
  { background: 'linear-gradient(135deg,#fce7f3,#fff7ed)', ink: '#9a5b73', blob: '#fbcfe8' },
  { background: 'linear-gradient(135deg,#e0f2fe,#ecfeff)', ink: '#3d6a85', blob: '#bae6fd' },
  { background: 'linear-gradient(135deg,#ede9fe,#fce7f3)', ink: '#6b5b95', blob: '#ddd6fe' },
];

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash;
};

interface TextImageCardProps {
  text: string;
  large?: boolean;
}

/** Renders a text-image card as a polaroid, a vertical scroll, or an art-text sheet (picked from the text). */
export const TextImageCard: React.FC<TextImageCardProps> = ({ text, large = false }) => {
  const hash = hashText(text);
  const theme = CARD_THEMES[hash % CARD_THEMES.length];
  const variant = hash % 3 === 1 && text.length <= 24 ? 'scroll' : hash % 3 === 0 ? 'polaroid' : 'art';
  const size = large ? 'text-lg leading-8' : 'text-[10px] leading-[14px] line-clamp-6';

  if (variant === 'polaroid') {
    return (
      <div className="h-full w-full rounded-md bg-white p-[6%] pb-[16%] shadow-md border border-white">
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-sm p-[8%] text-center"
          style={{ background: theme.background, color: theme.ink }}
        >
          <span
            className="absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-60"
            style={{ background: theme.blob }}
          />
          <p className={`relative font-semibold break-words ${size}`}>{text}</p>
        </div>
      </div>
    );
  }

  if (variant === 'scroll') {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md border border-[#ead9c3] bg-[#fffaf1] p-[7%] shadow-sm">
        <div className="flex h-full w-full items-center justify-center rounded-sm border border-dashed border-[#e8b9c4] px-1">
          <p
            className={`font-bold tracking-[0.3em] [writing-mode:vertical-rl] ${large ? 'text-xl' : 'text-[11px]'}`}
            style={{ color: theme.ink, fontFamily: 'serif' }}
          >
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md p-[10%] text-center shadow-sm border border-white/80"
      style={{ background: theme.background, color: theme.ink }}
    >
      <span className="absolute -left-4 -bottom-4 h-14 w-14 rounded-full opacity-60" style={{ background: theme.blob }} />
      <span className="absolute right-1.5 top-1 text-[10px] opacity-50">✦</span>
      <p className={`relative font-bold break-words ${size}`} style={{ fontFamily: 'serif' }}>
        <span className="mr-0.5 opacity-40">“</span>{text}<span className="ml-0.5 opacity-40">”</span>
      </p>
    </div>
  );
};

export type MomentMediaItem = { type: 'image'; value: string } | { type: 'card'; value: string };

interface MomentMediaGridProps {
  images?: string[];
  cards?: string[];
  onOpen: (item: MomentMediaItem) => void;
}

export const MomentMediaGrid: React.FC<MomentMediaGridProps> = ({ images = [], cards = [], onOpen }) => {
  const items: MomentMediaItem[] = [
    ...images.map((value): MomentMediaItem => ({ type: 'image', value })),
    ...cards.map((value): MomentMediaItem => ({ type: 'card', value })),
  ];
  if (items.length === 0) return null;
  const columns = items.length === 1 ? 1 : items.length === 2 || items.length === 4 ? 2 : 3;
  const widthClass = columns === 1 ? 'w-[58%]' : columns === 2 ? 'w-[72%]' : 'w-full';

  return (
    <div className={`grid gap-1 ${widthClass}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.map((item, index) => (
        <button
          key={`${item.type}-${index}`}
          type="button"
          onClick={() => onOpen(item)}
          aria-label={item.type === 'image' ? '查看图片' : '查看文字图'}
          className="aspect-square overflow-hidden rounded-md cursor-pointer active:opacity-80"
        >
          {item.type === 'image' ? (
            <img src={item.value} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <TextImageCard text={item.value} />
          )}
        </button>
      ))}
    </div>
  );
};
