import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

function LoadingFrame({ kind, title, caption, children, onBack }: { kind: string; title: string; caption: string; children: ReactNode; onBack: () => void }) {
  return <section className={`soft-app-opening soft-app-opening-${kind}`} role="status" aria-live="polite" aria-label={`正在打开${title}`}>
    <button type="button" className="soft-opening-back" aria-label="返回主屏幕" onClick={onBack}><ArrowLeft size={18}/></button>
    <div className="soft-opening-content">
      <div className="soft-opening-stage" aria-hidden="true"><div className="soft-opening-halo"/>{children}</div>
      <div className="soft-opening-copy"><span>{kind === 'memory' ? 'THE DAYS WE KEEP' : kind === 'wechat' ? 'A LITTLE HELLO' : 'LITTLE THINGS, LITTLE SECRETS'}</span><h2>{title}</h2><p>{caption}</p><div className="soft-opening-dots" aria-hidden="true"><i/><i/><i/></div></div>
    </div>
    <div className="soft-opening-footer" aria-hidden="true"><i/><span>{kind === 'memory' ? '有些瞬间，会一直发着光' : kind === 'wechat' ? '故事，从一句你好开始' : '平凡日常里，藏着一点在意'}</span><i/></div>
  </section>;
}

export function WeChatLoading({ onBack }: { onBack: () => void }) {
  return <LoadingFrame kind="wechat" title="微信" caption="想说的话，在这里相遇。" onBack={onBack}>
    <svg className="soft-opening-svg" viewBox="0 0 320 320" fill="none">
      <path d="M56 195c-7-53 29-98 86-99 65-2 111 48 106 99" stroke="#c7d9d9" strokeWidth="1" strokeDasharray="3 6"/>
      <ellipse cx="162" cy="265" rx="80" ry="8" fill="#a7bdbe" opacity=".08"/>
      <g className="wechat-opening-bubble-one">
        <path d="M65 93a17 17 0 0 1 17-17h123a17 17 0 0 1 17 17v74a17 17 0 0 1-17 17h-86l-25 17 2-17H82a17 17 0 0 1-17-17V93Z" fill="#e0eee9" stroke="#fff" strokeWidth="2"/>
        <circle cx="91" cy="105" r="11" fill="#c6ded4"/>
        <path d="M114 102h69m-69 9h43" stroke="#bed4cd" strokeWidth="3" strokeLinecap="round"/>
        <path d="M87 139h111m-111 12h77" stroke="#fafffc" strokeWidth="4" strokeLinecap="round"/>
        <circle className="wechat-opening-dot" cx="91" cy="167" r="3" fill="#b9d0c7"/><circle className="wechat-opening-dot" cx="103" cy="167" r="3" fill="#b9d0c7"/><circle className="wechat-opening-dot" cx="115" cy="167" r="3" fill="#b9d0c7"/>
      </g>
      <g className="wechat-opening-bubble-two">
        <path d="M129 167a15 15 0 0 1 15-15h103a15 15 0 0 1 15 15v59a15 15 0 0 1-15 15h-12l2 17-24-17h-69a15 15 0 0 1-15-15v-59Z" fill="#eee5f1" stroke="#fff" strokeWidth="2"/>
        <path d="M194 185c-10-15-31-7-26 8 3 10 18 19 28 24 9-6 22-17 23-26 1-16-20-22-25-6Z" fill="#d8c2d9" stroke="#e7d5e7"/>
        <path d="M180 183c-4-2-9 1-9 6" stroke="#f7eff9" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <g className="soft-opening-glimmer" stroke="#bacdd2" strokeWidth="1.3" strokeLinecap="round"><path d="M56 132v10m-5-5h10M251 89v12m-6-6h12M104 248v8m-4-4h8"/><circle cx="234" cy="55" r="2" fill="#d3c8df" stroke="none"/></g>
    </svg>
  </LoadingFrame>;
}

export function PhoneExplorerLoading({ onBack }: { onBack: () => void }) {
  return <LoadingFrame kind="phone" title="查手机" caption="翻翻日常，发现一点小秘密。" onBack={onBack}>
    <svg className="soft-opening-svg" viewBox="0 0 320 320" fill="none">
      <ellipse cx="164" cy="273" rx="72" ry="8" fill="#b6b0c6" opacity=".09"/>
      <g className="phone-opening-device" transform="rotate(-7 160 160)">
        <rect x="100" y="48" width="126" height="218" rx="23" fill="#e5dfed" stroke="#fff" strokeWidth="2"/>
        <rect x="108" y="57" width="110" height="198" rx="17" fill="#faf7fc"/>
        <rect x="141" y="63" width="44" height="6" rx="3" fill="#d8cde2"/>
        <circle cx="162" cy="107" r="18" fill="#e7dfef" stroke="#fff" strokeWidth="2"/>
        <path d="M162 102c-5-8-16-3-12 4 2 5 8 9 12 11 5-3 10-7 12-12 2-8-9-11-12-3Z" fill="#cfb7d3"/>
        <rect x="122" y="139" width="81" height="30" rx="8" fill="#e9eff4"/>
        <path d="M135 150h53m-53 8h31" stroke="#bdcbd9" strokeWidth="2" strokeLinecap="round"/>
        <rect x="122" y="177" width="35" height="34" rx="8" fill="#efe4eb"/><rect x="167" y="177" width="36" height="34" rx="8" fill="#e4e9f0"/>
        <path d="m132 201 8-10 8 10m26 0 7-11 7 11" stroke="#cbb5c9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="146" y="240" width="34" height="3" rx="1.5" fill="#d7ccdf"/>
      </g>
      <g className="phone-opening-photo"><rect x="45" y="148" width="62" height="79" rx="6" transform="rotate(-12 45 148)" fill="#fffdfa" stroke="#fff" strokeWidth="2"/><path d="m54 153 43-9 11 48-43 9Z" fill="#dfe9ed"/><circle cx="85" cy="160" r="6" fill="#fcf5e8"/><path d="m64 191 10-20 15 10 8-14 8 27" fill="#c1d1cb"/></g>
      <g className="phone-opening-note"><rect x="219" y="129" width="51" height="62" rx="7" transform="rotate(12 219 129)" fill="#f1e6ed" stroke="#fff" strokeWidth="2"/><path d="m227 149 27 6m-29 2 27 6m-29 2 18 4" stroke="#cfb8ca" strokeWidth="2" strokeLinecap="round"/></g>
      <g className="soft-opening-glimmer" stroke="#c9bcd3" strokeWidth="1.2" strokeLinecap="round"><path d="M67 107v10m-5-5h10M255 223v10m-5-5h10"/><circle cx="249" cy="82" r="3" stroke="#bfcedb"/></g>
    </svg>
  </LoadingFrame>;
}

function BookLeaf({ back = false }: { back?: boolean }) {
  return <div className={`memory-opening-leaf-face${back ? ' is-back' : ''}`}><span className="memory-opening-page-lines"/><i className="memory-opening-page-heart"/></div>;
}

export function MemoryLoading({ onBack }: { onBack: () => void }) {
  return <LoadingFrame kind="memory" title="记忆" caption="把一起走过的日子，轻轻翻开。" onBack={onBack}>
    <svg className="memory-opening-garden" viewBox="0 0 320 320" fill="none">
      <ellipse cx="160" cy="254" rx="106" ry="12" fill="#b7a8c3" opacity=".1"/>
      <g stroke="#c0cec3" strokeWidth="1.2" strokeLinecap="round"><path d="M47 246c7-33 7-61-7-91m9 39c-15-3-23-12-23-22 14 3 22 11 23 22Zm1 26c12-5 20-15 19-26-13 5-19 14-19 26ZM273 249c-9-34-6-63 8-89m-10 40c14-2 23-9 26-21-15 1-24 9-26 21Zm0 24c-14-4-21-13-21-24 14 4 21 12 21 24Z"/></g>
      <g className="memory-opening-stars" stroke="#ccbed7" strokeWidth="1.3" strokeLinecap="round"><path d="M77 90v12m-6-6h12M249 108v10m-5-5h10M182 55v8m-4-4h8"/><circle cx="115" cy="65" r="2" fill="#dfbfd0" stroke="none"/></g>
      <path className="memory-opening-petal" d="M232 65c-10 0-13 9-9 17 9-2 14-8 9-17Z" fill="#e5cbd8"/>
    </svg>
    <div className="memory-opening-book">
      <div className="memory-opening-binding"/>
      <div className="memory-opening-paper is-left"><span className="memory-opening-page-lines"/><svg className="memory-opening-flower" viewBox="0 0 70 90" fill="none"><path d="M34 82c8-19 5-37 1-53m4 29c13-4 20-12 19-20-12 3-18 9-19 20ZM38 70C24 65 19 58 20 50c12 4 18 10 18 20Z" stroke="#bdcbb9" strokeWidth="1.4"/><g fill="#e4c5d7"><ellipse cx="34" cy="22" rx="7" ry="13" transform="rotate(-25 34 22)"/><ellipse cx="46" cy="27" rx="7" ry="13" transform="rotate(48 46 27)"/><ellipse cx="24" cy="31" rx="7" ry="12" transform="rotate(-55 24 31)"/></g><circle cx="34" cy="33" r="4" fill="#dfcfad"/></svg></div>
      <div className="memory-opening-paper is-right"><span className="memory-opening-page-lines"/><i className="memory-opening-page-heart"/></div>
      <div className="memory-opening-bookmark"/>
      <div className="memory-opening-turning-page is-first"><BookLeaf/><BookLeaf back/></div>
      <div className="memory-opening-turning-page is-second"><BookLeaf/><BookLeaf back/></div>
      <div className="memory-opening-spine"/>
    </div>
  </LoadingFrame>;
}
