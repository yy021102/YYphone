import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export function PomodoroLoading({ onBack }: { onBack: () => void }) {
  const [cheered, setCheered] = useState(false);
  return <section className={`pomo-opening${cheered ? ' is-cheered' : ''}`} role="status" aria-label="正在打开番茄钟" aria-live="polite">
    <button type="button" className="pomo-opening-back" aria-label="返回主屏幕" onClick={onBack}><ArrowLeft size={18}/></button>
    <div className="pomo-opening-content">
      <div className="pomo-opening-illustration">
        <div className="pomo-opening-circle" aria-hidden="true"/>
        <span className="pomo-opening-bubble" aria-hidden="true">好！先专注一小会儿</span>
        <button type="button" className="pomo-opening-tomato" aria-label="给小番茄打个气" aria-pressed={cheered} onClick={() => setCheered(value => !value)}>
          <svg viewBox="0 0 320 320" fill="none" aria-hidden="true">
            <ellipse cx="161" cy="271" rx="83" ry="9" fill="#9fa695" opacity=".1"/>
            <g transform="rotate(10 247 170)">
              <rect x="224" y="116" width="54" height="81" rx="7" fill="#fffcf4" stroke="#fff" strokeWidth="2"/>
              <rect x="240" y="110" width="23" height="12" rx="5" fill="#d8dfc9"/>
              <path d="m233 137 3 3 5-6m-8 20 3 3 5-6m-8 20 3 3 5-6" stroke="#a8b49a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M249 138h19m-19 16h19m-19 16h13" stroke="#dfdccc" strokeWidth="2" strokeLinecap="round"/>
            </g>
            <g className="pomo-opening-mug">
              <path d="M40 220h35v26a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8v-26Z" fill="#e2e9dd" stroke="#fff" strokeWidth="2"/>
              <path d="M76 225h4a9 9 0 0 1 0 18h-4" stroke="#ccd8c5" strokeWidth="4"/>
              <ellipse cx="57" cy="221" rx="17" ry="4" fill="#c4b5a3" stroke="#fff" strokeWidth="2"/>
              <path className="pomo-opening-steam" d="M50 211c-9-11 7-13 0-24m13 22c-7-9 7-12 1-20" stroke="#c4cbbf" strokeWidth="1.5" strokeLinecap="round"/>
            </g>
            <g className="pomo-opening-character">
              <path d="m125 249-7 16m76-16 8 16" stroke="#b99a91" strokeWidth="4" strokeLinecap="round"/>
              <path d="M106 266h17m75 0h17" stroke="#c4a397" strokeWidth="5" strokeLinecap="round"/>
              <path d="M87 171c-10-18-15-28-24-26m170 22c12-16 18-24 25-21" stroke="#c8a696" strokeWidth="3" strokeLinecap="round"/>
              <path d="M160 108c-45-23-88 7-88 61 0 48 33 85 88 85s88-37 88-85c0-54-43-84-88-61Z" fill="#e8b8aa" stroke="#fff4e8" strokeWidth="2"/>
              <path d="M91 166c0-22 10-36 26-43" stroke="#f8ddd1" strokeWidth="9" strokeLinecap="round" opacity=".8"/>
              <path d="M159 113c-17-7-32-5-41 1 9-19 23-26 40-20-8-15-6-29 2-39 9 15 12 27 6 40 17-10 34-7 44 1-15 4-24 9-30 18-3-9-11-12-21-1Z" fill="#bac9aa" stroke="#dbe4cf" strokeWidth="1.5"/>
              <path d="M161 96c-6-20 1-32 10-38" stroke="#a7b69b" strokeWidth="4" strokeLinecap="round"/>
              <g className="pomo-opening-eyes" fill="#a27f75"><ellipse cx="135" cy="179" rx="3.2" ry="5"/><ellipse cx="186" cy="179" rx="3.2" ry="5"/></g>
              <path className="pomo-opening-happy-eyes" d="m128 179 7-5 7 5m37 0 7-5 7 5" stroke="#a27f75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <ellipse cx="117" cy="192" rx="10" ry="5" fill="#dd9f99" opacity=".5"/>
              <ellipse cx="203" cy="192" rx="10" ry="5" fill="#dd9f99" opacity=".5"/>
              <path d="M150 194q10 10 20 0" stroke="#a98278" strokeWidth="2.5" strokeLinecap="round"/>
              <rect x="126" y="215" width="69" height="19" rx="9.5" fill="#f7e5d6" opacity=".8"/>
              <path d="M138 221h10m-10 5h7m8-5v5m5-5h7v5h-7zm12 0v5h6v-5m5 0h7m-7 5h7m-7-2h7" stroke="#bfa695" strokeWidth="1.2" strokeLinecap="round"/>
            </g>
            <g className="pomo-opening-doodles" stroke="#b4bda8" strokeWidth="1.3" strokeLinecap="round"><path d="M61 94v12m-6-6h12M259 83v8m-4-4h8"/><circle cx="236" cy="53" r="3" stroke="#d2baaa"/><path d="m85 62 4 5 7-8"/></g>
          </svg>
        </button>
      </div>
      <div className="pomo-opening-copy"><span>番茄钟 · FOCUS TIME</span><h2>今天，你专注了吗？</h2><p>小番茄已就位，等你一起开工。</p><div className="pomo-opening-loading" aria-hidden="true"><i/><i/><i/></div></div>
    </div>
    <footer className="pomo-opening-footer" aria-hidden="true"><span/>一次只做一件事，也很了不起<span/></footer>
  </section>;
}
