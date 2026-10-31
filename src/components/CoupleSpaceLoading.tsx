import { ArrowLeft } from 'lucide-react';

/** Kept outside the lazy app bundle, so the illustration is available while it loads. */
export function CoupleSpaceLoading({ onBack }: { onBack: () => void }) {
  return <section className="couple-opening" aria-label="正在打开情侣空间" role="status" aria-live="polite">
    <div className="couple-opening-haze" aria-hidden="true"/>
    <button type="button" className="couple-opening-back" aria-label="返回主屏幕" onClick={onBack}><ArrowLeft size={18}/></button>
    <div className="couple-opening-content">
      <div className="couple-opening-art" aria-hidden="true">
        <div className="couple-opening-orbit"/>
        <svg viewBox="0 0 320 320" fill="none">
          <ellipse cx="162" cy="269" rx="82" ry="10" fill="#a8a4b5" opacity=".08"/>
          <g stroke="#c5ceca" strokeWidth="1.3" strokeLinecap="round">
            <path d="M48 228c22-22 26-53 17-83M63 174c-16 1-23-6-27-15 16-1 24 7 27 15ZM64 193c13-7 18-15 17-26-13 7-18 15-17 26ZM58 210c-13-3-20-10-21-20 14 2 20 9 21 20Z"/>
            <path d="M268 236c-17-24-22-54-13-86M252 179c15-1 24-9 25-18-14 0-22 8-25 18ZM254 202c-14-5-21-14-21-24 13 5 20 13 21 24ZM261 219c13-2 21-9 24-19-14 1-22 8-24 19Z"/>
          </g>
          <g className="couple-opening-letter">
            <rect x="98" y="64" width="137" height="165" rx="12" transform="rotate(9 98 64)" fill="#e4edf3" stroke="#fff" strokeWidth="2"/>
            <rect x="81" y="72" width="142" height="171" rx="12" transform="rotate(-7 81 72)" fill="#fffcf9" stroke="#fff" strokeWidth="2"/>
            <path d="m102 126 70-9m-67 23 92-11m-89 26 75-9" stroke="#e8dce0" strokeWidth="3" strokeLinecap="round"/>
            <path d="M150 92c-9-14-28-5-23 8 3 8 17 15 24 18 6-5 19-16 18-24-1-14-18-17-19-2Z" fill="#e5bfcf"/>
            <path d="M160 93c-6-9-17-3-14 5 2 4 10 8 14 10 4-3 11-9 11-14-1-8-11-10-11-1Z" fill="#fff7f9" opacity=".8"/>
          </g>
          <g className="couple-opening-envelope">
            <path d="M67 168a12 12 0 0 1 12-12h165a12 12 0 0 1 12 12v83a13 13 0 0 1-13 13H80a13 13 0 0 1-13-13v-83Z" fill="#f4e6ec" stroke="#fff" strokeWidth="2"/>
            <path d="m68 254 70-55m117 55-69-55" stroke="#dfc7d4" strokeOpacity=".65" strokeWidth="1.2"/>
            <path d="m69 161 79 56a22 22 0 0 0 26 0l79-56" fill="#f8edf1"/>
            <path d="m69 161 79 56a22 22 0 0 0 26 0l79-56" stroke="#fff" strokeWidth="2"/>
            <circle cx="161" cy="216" r="19" fill="#d4c0d0" stroke="#eee2eb" strokeWidth="3"/>
            <path d="M161 211c-6-9-17-2-12 5 3 4 8 7 12 9 4-2 9-5 12-9 5-7-6-14-12-5Z" fill="#fff9fc"/>
            <path d="M107 249h27m6 0h5" stroke="#d5becd" strokeWidth="1.5" strokeLinecap="round"/>
          </g>
          <g className="couple-opening-sparkles" stroke="#c4b7ce" strokeWidth="1.2" strokeLinecap="round">
            <path d="M67 90v10m-5-5h10M246 112v8m-4-4h8M251 61v12m-6-6h12"/>
            <circle cx="93" cy="43" r="2" fill="#e7cbd8" stroke="none"/>
            <circle cx="278" cy="137" r="2" fill="#bed0df" stroke="none"/>
          </g>
          <path className="couple-opening-small-heart" d="M235 43c-4-7-13-3-11 3 1 5 8 9 12 11 3-3 8-8 7-13-1-7-8-8-8-1Z" fill="#d8b7ca"/>
        </svg>
      </div>
      <div className="couple-opening-copy"><span className="couple-opening-eyebrow">YOU &amp; ME</span><h2>情侣空间</h2><p>把日子，慢慢过成我们。</p></div>
      <div className="couple-opening-dots" aria-hidden="true"><i/><i/><i/></div>
    </div>
    <div className="couple-opening-footer" aria-hidden="true"><span/>每一个平凡日子，都与你有关<span/></div>
  </section>;
}
