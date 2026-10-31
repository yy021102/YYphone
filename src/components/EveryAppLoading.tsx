import type { ReactNode } from 'react';
import type { AppId } from '../types';
import { LoadingFrame, MemoryLoading, PhoneExplorerLoading, WeChatLoading } from './AppLoadingScenes';
import { CoupleSpaceLoading } from './CoupleSpaceLoading';
import { PomodoroLoading } from './PomodoroLoading';

type IllustratedApp = Exclude<AppId, 'wechat' | 'phone_explorer' | 'memory' | 'couple_space' | 'pomodoro'>;
const scenes: Record<IllustratedApp, { title: string; caption: string; eyebrow: string; footer: string; art: ReactNode }> = {
  alipay: {
    title: '支付宝', caption: '把生活里的小确幸，攒起来。', eyebrow: 'A POCKET OF HAPPINESS', footer: '认真生活，也记得奖励自己',
    art: <>
      <g className="every-opening-float">
        <rect x="86" y="74" width="141" height="100" rx="14" transform="rotate(-10 86 74)" fill="#e1eaf2" stroke="#fff" strokeWidth="2"/>
        <path d="m106 100 82-14m-78 28 33-6" stroke="#b6cadb" strokeWidth="4" strokeLinecap="round"/>
        <path d="M70 139a16 16 0 0 1 16-16h149a16 16 0 0 1 16 16v99a16 16 0 0 1-16 16H86a16 16 0 0 1-16-16v-99Z" fill="#cbdce9" stroke="#fff" strokeWidth="2"/>
        <path d="M82 141h150v95H82Z" stroke="#f6fbff" strokeDasharray="3 5" strokeWidth="1.2"/>
        <rect x="208" y="162" width="55" height="45" rx="12" fill="#e9eff5" stroke="#fff" strokeWidth="2"/><circle cx="225" cy="184" r="4" fill="#b4c7da"/>
        <path d="M116 186c-6-9-19-5-17 5 2 7 12 13 19 17 6-5 14-12 14-19-1-10-13-12-16-3Z" fill="#f8fbfd"/>
      </g>
      <g className="every-opening-bob"><circle cx="235" cy="91" r="21" fill="#ede3c9" stroke="#fffaf0" strokeWidth="2"/><circle cx="235" cy="91" r="15" stroke="#d6c4a5"/><path d="m229 83 6 8 6-8m-6 8v10m-6-8h12m-12 4h12" stroke="#cfb891" strokeWidth="1.5" strokeLinecap="round"/></g>
    </>,
  },
  taobao: {
    title: '淘宝', caption: '今天，会遇见什么心头好？', eyebrow: 'SOMETHING LOVELY', footer: '给日常添一点喜欢',
    art: <>
      <g className="every-opening-float"><path d="M88 120h143l17 131H73l15-131Z" fill="#ecdbcc" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/><path d="M126 132V99c0-43 67-43 67 0v33" stroke="#cbb7a5" strokeWidth="6" strokeLinecap="round"/><path d="M126 132V99c0-43 67-43 67 0v33" stroke="#fff8ed" strokeWidth="2" strokeLinecap="round"/><path d="M90 235h141" stroke="#d8c6b7" strokeDasharray="3 5"/>
        <g transform="translate(161 180)"><path d="M0 0v41m0-17c-15 0-20-9-19-14 11 0 19 5 19 14Zm0 7c13-2 20-11 19-16-12 1-18 9-19 16Z" stroke="#afbea9" strokeWidth="2"/><g fill="#f9f2ef"><ellipse cy="-9" rx="7" ry="13"/><ellipse cx="-10" cy="-1" rx="13" ry="7" transform="rotate(28)"/><ellipse cx="9" cy="-2" rx="13" ry="7" transform="rotate(-25)"/></g><circle r="5" fill="#d7c09e"/></g>
      </g>
      <g className="every-opening-bob"><path d="m229 133 35 23-24 39-35-23Z" fill="#f3e8ee" stroke="#fff" strokeWidth="2"/><circle cx="232" cy="146" r="3" fill="#ccb2c0"/><path d="m232 146-16-35" stroke="#c9b5a4" strokeWidth="1.3"/><path d="m225 165 19 12" stroke="#d5bbc9" strokeWidth="3" strokeLinecap="round"/></g>
    </>,
  },
  forum: {
    title: '论坛', caption: '总有人，和你想到一起。', eyebrow: 'VOICES IN THE AIR', footer: '听见不同的声音',
    art: <>
      <g className="every-opening-float"><rect x="68" y="90" width="175" height="144" rx="15" transform="rotate(-6 68 90)" fill="#fffaf8" stroke="#eadfe5" strokeWidth="1.5"/><circle cx="98" cy="115" r="12" fill="#e4d5e8"/><path d="m122 110 76-8m-74 18 46-5" stroke="#d8c7d9" strokeWidth="3" strokeLinecap="round"/><path d="m91 152 116-12m-114 26 108-12m-106 26 75-8" stroke="#e8dce3" strokeWidth="3" strokeLinecap="round"/><circle cx="100" cy="205" r="4" fill="#d8c4d1"/><circle cx="115" cy="203" r="4" fill="#c4d6df"/><circle cx="130" cy="202" r="4" fill="#d4ddcf"/></g>
      <g className="every-opening-bob"><path d="M182 195a10 10 0 0 1 10-10h62a10 10 0 0 1 10 10v33a10 10 0 0 1-10 10h-39l-17 13 1-13h-7a10 10 0 0 1-10-10v-33Z" fill="#dfeaf0" stroke="#fff" strokeWidth="2"/><path d="M207 209h32m-32 9h20" stroke="#b6cbd9" strokeWidth="3" strokeLinecap="round"/></g>
      <g className="every-opening-drift"><path d="m209 68 50-19-17 43-11-19-22-5Z" fill="#dacee6" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><path d="m231 73 28-24" stroke="#bbaccb" strokeWidth="1.3"/></g>
    </>,
  },
  offline_mode: {
    title: '线下', caption: '从屏幕这头，走进你的日常。', eyebrow: 'SLOW DAYS TOGETHER', footer: '此刻，就好好待在一起',
    art: <>
      <rect x="86" y="56" width="151" height="173" rx="68" fill="#fffaf4" stroke="#fff" strokeWidth="3"/><path d="M97 140a65 65 0 0 1 130 0v77H97v-77Z" fill="#e6eef1"/><circle className="every-opening-glow" cx="195" cy="110" r="18" fill="#f7ebd5"/><path d="M97 187c35-31 63-1 91-18 18-12 29-8 39-2v50H97Z" fill="#d2dfd3"/><path d="M97 204c39-22 88-11 130-2v15H97Z" fill="#c2d0c3"/><path d="M162 77v140M97 146h130" stroke="#fffaf4" strokeWidth="5"/>
      <path d="M63 244h197" stroke="#d4c3b9" strokeWidth="5" strokeLinecap="round"/>
      <g className="every-opening-steam" stroke="#c8b7ac" strokeWidth="1.5" strokeLinecap="round"><path d="M112 184c-10-11 9-16 0-28m63 28c-10-11 9-16 0-28"/></g>
      <path d="M91 201h43v22a18 18 0 0 1-18 18h-7a18 18 0 0 1-18-18v-22Z" fill="#ead9df" stroke="#fff" strokeWidth="2"/><path d="M135 206c22-3 20 22-2 20" stroke="#dcc4ce" strokeWidth="5"/>
      <path d="M158 201h43v22a18 18 0 0 1-18 18h-7a18 18 0 0 1-18-18v-22Z" fill="#d5e2e7" stroke="#fff" strokeWidth="2"/><path d="M202 206c22-3 20 22-2 20" stroke="#bbd0db" strokeWidth="5"/>
    </>,
  },
  settings: {
    title: '设置', caption: '调成你喜欢的样子。', eyebrow: 'JUST THE WAY YOU LIKE', footer: '每一处，都刚刚好',
    art: <>
      <g className="every-opening-gear"><path d="m154 60 15 0 5 18 16 6 16-9 11 11-9 16 6 16 18 5v15l-18 5-6 16 9 16-11 11-16-9-16 6-5 18h-15l-5-18-16-6-16 9-11-11 9-16-6-16-18-5v-15l18-5 6-16-9-16 11-11 16 9 16-6 5-18Z" fill="#dce4ee" stroke="#fff" strokeWidth="2"/><circle cx="161" cy="130" r="29" fill="#f7f8fb" stroke="#c3cede" strokeWidth="2"/><circle cx="161" cy="130" r="14" stroke="#d6dfeb" strokeWidth="2"/></g>
      <g className="every-opening-float"><rect x="74" y="189" width="174" height="64" rx="15" fill="#fffcff" stroke="#e8dfea" strokeWidth="1.5"/><path d="M96 212h129m-129 20h129" stroke="#e6dfe9" strokeWidth="4" strokeLinecap="round"/><circle className="every-opening-slider" cx="130" cy="212" r="7" fill="#c6b5d4" stroke="#fff" strokeWidth="2"/><circle cx="196" cy="232" r="7" fill="#bed3dd" stroke="#fff" strokeWidth="2"/></g>
    </>,
  },
  customizer: {
    title: '美化', caption: '把喜欢的颜色，装进日常。', eyebrow: 'MAKE ROOM FOR COLOUR', footer: '一点灵感，一点你的偏爱',
    art: <>
      <g className="every-opening-float"><path d="M160 67c-61 0-101 39-101 94 0 56 43 95 97 95 32 0 23-32 41-41 16-9 47 10 59-15 25-53-26-133-96-133Z" fill="#fff9f0" stroke="#e8ddcf" strokeWidth="2"/><circle cx="178" cy="200" r="15" fill="#e9e7ef" stroke="#e1d8cf"/><circle cx="101" cy="148" r="16" fill="#d4e4de"/><circle cx="129" cy="108" r="16" fill="#e7cbd7"/><circle cx="180" cy="108" r="16" fill="#c9dce9"/><circle cx="220" cy="143" r="16" fill="#d8c9e4"/><circle cx="117" cy="206" r="16" fill="#e8d7b5"/><path d="M88 141c1-5 4-8 8-9m22-31c2-4 6-6 10-6m44 5c2-3 6-5 10-4" stroke="#fff9" strokeWidth="3" strokeLinecap="round"/></g>
      <g className="every-opening-brush"><path d="m203 195 62-112c3-6 12-1 9 5l-62 112Z" fill="#b7c6ce" stroke="#fff" strokeWidth="1.5"/><path d="m199 193 16 9-9 16-16-9Z" fill="#e2c9bb"/><path d="M190 209c-12 3-7 18-19 24 22 4 34-6 35-15Z" fill="#c6b4d4" stroke="#fff" strokeWidth="1.5"/></g>
    </>,
  },
  world_book: {
    title: '世界书', caption: '故事之外，还有整个世界。', eyebrow: 'ONCE UPON A WORLD', footer: '每一种想象，都有归处',
    art: <>
      <g className="every-opening-float"><path d="M88 83c0-8 6-14 14-14h126v172H102c-8 0-14 5-14 11V83Z" fill="#c5bfd8" stroke="#fff" strokeWidth="2"/><path d="M101 241h127v16H101c-13 0-13-16 0-16Z" fill="#fff9ed" stroke="#ded3c9" strokeWidth="1.5"/><path d="M106 79v151" stroke="#e4ddeb" strokeWidth="2"/><rect x="120" y="87" width="91" height="129" rx="40" stroke="#eee8f5"/>
        <circle cx="165" cy="147" r="31" stroke="#f8f2fc" strokeWidth="1.3"/><ellipse cx="165" cy="147" rx="13" ry="31" stroke="#eae3f1"/><path d="M134 147h62m-55-17h49m-49 34h49" stroke="#eae3f1"/><path d="m165 101 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#f4e5c8"/>
        <path d="M197 241v31l-7-5-7 5v-31" fill="#d1b5c7"/>
      </g>
      <g className="every-opening-glow" stroke="#b8abc9" strokeWidth="1.2"><path d="m51 117 12 28 9-57m165 18 22 34-13 47" strokeDasharray="2 5"/><circle cx="51" cy="117" r="3" fill="#ede3f2"/><circle cx="72" cy="88" r="3" fill="#ede3f2"/><circle cx="259" cy="140" r="3" fill="#ede3f2"/></g>
    </>,
  },
  inventory: {
    title: '小盒子', caption: '每一份喜欢，都好好收着。', eyebrow: 'LITTLE TREASURES', footer: '打开一盒小小的幸福',
    art: <>
      <path d="m81 168 79-32 81 32v76l-81 31-79-31Z" fill="#e6d9cf" stroke="#fff" strokeWidth="2"/><path d="m81 168 79 30 81-30m-81 30v77" stroke="#cbbcaf" strokeWidth="1.4"/>
      <g className="every-opening-float"><path d="m88 163 72-26-34-27-71 28 33 25Zm145 0-73-26 34-27 72 28-33 25Z" fill="#f3e9dd" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="127" y="82" width="69" height="67" rx="7" transform="rotate(9 127 82)" fill="#e8d9e5" stroke="#fff" strokeWidth="2"/><path d="m155 87-10 65m-21-42 67 10" stroke="#fff7fa" strokeWidth="5"/><path d="M155 87c-33-9-22-32-9-21 6 5 8 13 9 21Zm0 0c32 0 30-25 16-19-7 3-12 10-16 19Z" stroke="#d0b3c7" strokeWidth="3"/></g>
      <g className="every-opening-bob"><rect x="84" y="98" width="37" height="49" rx="4" transform="rotate(-19 84 98)" fill="#fffaf2" stroke="#fff" strokeWidth="2"/><path d="m92 112 21-7m-18 15 16-5" stroke="#d8c6b7" strokeWidth="2" strokeLinecap="round"/><path d="M222 146c-13-20-15-40-7-60m-1 28c-14-1-20-10-18-18 13 2 18 9 18 18Zm3 17c15-4 22-13 20-22-13 4-20 12-20 22Z" stroke="#b7c8b5" strokeWidth="1.5"/></g>
    </>,
  },
  calendar: {
    title: '日历', caption: '给平常的一天，留一点期待。', eyebrow: 'A DAY TO REMEMBER', footer: '慢慢来，日子都有回响',
    art: <>
      <g className="every-opening-float"><rect x="79" y="80" width="165" height="177" rx="17" fill="#e0d6e6"/><rect x="74" y="72" width="165" height="177" rx="17" fill="#fffaf6" stroke="#fff" strokeWidth="2"/><path d="M74 89a17 17 0 0 1 17-17h131a17 17 0 0 1 17 17v31H74V89Z" fill="#e7d4df"/><path d="M109 61v26m94-26v26" stroke="#c9bacb" strokeWidth="7" strokeLinecap="round"/>
        {[0,1,2].map(row=>[0,1,2,3,4].map(col=><circle key={`${row}-${col}`} cx={105+col*26} cy={147+row*29} r="3" fill="#d7cbd2"/>))}
        <circle cx="157" cy="176" r="12" stroke="#c3d3c6" strokeWidth="1.5"/><path d="m152 176 4 4 7-8" stroke="#b1c5b4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="m211 220 28-1-28 30v-29Z" fill="#eee1d5"/>
      </g>
      <g className="every-opening-bob"><path d="M248 80a19 19 0 0 1-25-25 21 21 0 1 0 25 25Z" fill="#e8d9b8" stroke="#fff" strokeWidth="1.5"/><path d="M64 221c-9-20-7-43 2-57m-5 26c-15-1-20-11-19-18 12 2 19 10 19 18Zm0 14c14-3 20-12 19-20-13 3-19 11-19 20Z" stroke="#b6c9bb" strokeWidth="1.5"/></g>
    </>,
  },
};

/** Eager artwork stays available while the app itself is being downloaded. */
export function AppLoading({ app, onBack }: { app: AppId; onBack: () => void }) {
  if (app === 'wechat') return <WeChatLoading onBack={onBack}/>;
  if (app === 'phone_explorer') return <PhoneExplorerLoading onBack={onBack}/>;
  if (app === 'memory') return <MemoryLoading onBack={onBack}/>;
  if (app === 'couple_space') return <CoupleSpaceLoading onBack={onBack}/>;
  if (app === 'pomodoro') return <PomodoroLoading onBack={onBack}/>;
  const scene = scenes[app];
  return <LoadingFrame kind={app} title={scene.title} caption={scene.caption} eyebrow={scene.eyebrow} footer={scene.footer} onBack={onBack}>
    <svg className="soft-opening-svg every-opening-art" viewBox="0 0 320 320" fill="none">
      <ellipse cx="160" cy="278" rx="88" ry="8" fill="currentColor" opacity=".07"/>
      {scene.art}
      <g className="every-opening-glow" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M51 77v10m-5-5h10M271 225v12m-6-6h12"/><circle cx="256" cy="65" r="2" fill="currentColor" stroke="none"/></g>
    </svg>
  </LoadingFrame>;
}
