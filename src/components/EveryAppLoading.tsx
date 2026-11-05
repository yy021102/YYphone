import type { ReactNode } from 'react';
import type { AppId } from '../types';
import { LoadingFrame, MemoryLoading, PhoneExplorerLoading, WeChatLoading } from './AppLoadingScenes';
import { CoupleSpaceLoading } from './CoupleSpaceLoading';
import { PomodoroLoading } from './PomodoroLoading';

type IllustratedApp = Exclude<AppId, 'wechat' | 'phone_explorer' | 'memory' | 'couple_space' | 'pomodoro'>;
const scenes: Record<IllustratedApp, { title: string; caption: string; eyebrow: string; footer: string; art: ReactNode }> = {
  ao3: {
    title: 'AO3', caption: '故事，总有另一种可能。', eyebrow: 'ARCHIVE OF OUR OWN', footer: '翻开你喜欢的那一篇',
    art: <g className="every-opening-float"><path d="M61 92q48-17 99 7 51-24 99-7v151q-48-17-99 7-51-24-99-7Z" fill="#fffaf4" stroke="#d5b4b8" strokeWidth="2"/><path d="M160 99v151M82 120q29-6 56 5m-56 19q29-6 56 5m-56 19q29-6 56 5m-56 19q29-6 56 5m44-73q29-11 56-5m-56 29q29-11 56-5m-56 29q29-11 56-5" stroke="#dccbca" strokeWidth="2"/><path d="M196 88v109l12-9 12 9V88" fill="#b66d79"/><path d="M148 69c-15-20-31 1 0 18 31-17 15-38 0-18" fill="#dbb3bb"/></g>,
  },
  kitchen: {
    title: '下厨房', caption: '把喜欢，慢慢做成一餐。', eyebrow: 'A LITTLE KITCHEN, A LOT OF LOVE', footer: '今天，也有一份为你留的热乎心意',
    art: <g className="every-opening-float">
      <ellipse cx="160" cy="248" rx="94" ry="17" fill="#e2d5bf"/>
      <path d="M75 143q0 101 85 101t85-101Z" fill="#d2dcc5" stroke="#fff9ed" strokeWidth="3"/>
      <ellipse cx="160" cy="143" rx="85" ry="30" fill="#e9ddbd" stroke="#fff9ed" strokeWidth="4"/>
      <path d="M82 153H61q-26 0-22 24 3 19 49 17m150-41h21q26 0 22 24-3 19-49 17" stroke="#bbc9aa" strokeWidth="9" strokeLinecap="round"/>
      <ellipse cx="160" cy="140" rx="70" ry="19" fill="#d4b887"/>
      <g fill="#e7b292" stroke="#fff3da" strokeWidth="1.5"><ellipse cx="132" cy="138" rx="17" ry="9"/><ellipse cx="188" cy="140" rx="13" ry="8"/></g>
      <path d="M152 132q-15-23 13-27 21 20-13 27Z" fill="#9caf87"/><path d="M119 97q-14-17 0-32t0-24m40 47q14-17 0-32t0-24m41 63q14-17 0-32t0-21" stroke="#c3b297" strokeWidth="2" strokeLinecap="round"/>
      <path d="M245 125 270 65" stroke="#cbb499" strokeWidth="7" strokeLinecap="round"/>
    </g>,
  },
  'text-adventure': {
    title: '文字冒险', caption: '翻开这一页，走进另一种人生。', eyebrow: 'BEYOND THE NEXT CHAPTER', footer: '故事里的下一步，由你决定',
    art: <>
      <g className="every-opening-float">
        <path d="M56 172q49-24 104 0 55-24 104 0v83q-54-21-104 0-51-21-104 0v-83Z" fill="#d2c4dd" stroke="#fff" strokeWidth="2"/>
        <path d="M65 165q44-19 95 5 51-24 95-5v80q-47-17-95 5-48-22-95-5v-80Z" fill="#fff9ee" stroke="#e5d7d4" strokeWidth="1.5"/>
        <path d="M160 173v76m-77-59 52 5m-52 9 44 5m58-14 50-6m-50 20 43-6" stroke="#d8c9d6" strokeWidth="2" strokeLinecap="round"/>
        <path d="M124 170V99a36 36 0 0 1 72 0v71" fill="#dce8e4" stroke="#fff" strokeWidth="3"/>
        <path d="M139 171V103a21 21 0 0 1 42 0v68" fill="#f3edda"/><path d="m160 119 6 13-6 28-6-28 6-13Z" fill="#c6b6d3"/>
      </g>
      <g className="every-opening-drift"><path d="m78 105 22-10-10 23-3-10-9-3Z" fill="#ddc59d" stroke="#fff"/><path d="m225 115 6-13 6 13 13 6-13 6-6 13-6-13-13-6 13-6Z" fill="#d9c9e6" stroke="#fff"/></g>
    </>,
  },
  'time-capsule': {
    title: '时间胶囊', caption: '把今天的心意，寄往未来。', eyebrow: 'A LETTER, WAITING IN TIME', footer: '约定的那一天，再亲手开启',
    art: <>
      <g className="every-opening-float">
        <rect x="72" y="156" width="172" height="96" rx="8" fill="#e1e6f0" stroke="#fff" strokeWidth="2" transform="rotate(-7 158 204)"/>
        <path d="m75 157 85 61 80-80" stroke="#bfccde" strokeWidth="1.5"/><circle cx="160" cy="210" r="13" fill="#dcc5b3" stroke="#fff3df" strokeWidth="2"/><path d="m154 210 6-6 6 6-6 6-6-6Z" fill="#fff3df"/>
        <path d="M118 65h85m-85 90h85" stroke="#b6c8d8" strokeWidth="7" strokeLinecap="round"/>
        <path d="M125 69c0 25 6 30 24 40-18 10-24 17-24 42h71c0-25-6-32-24-42 18-10 24-15 24-40h-71Z" fill="#f4f8fc" stroke="#c6d6e1" strokeWidth="1.5"/>
        <path d="M135 82h51c-3 13-9 17-25 24-17-7-23-11-26-24Zm-2 64 28-22 28 22h-56Z" fill="#e7d2ab"/><path d="M161 112v8" stroke="#d6b98b" strokeWidth="2" strokeDasharray="1 3"/>
      </g>
      <g className="every-opening-glow" fill="#d5c3a5"><path d="m77 92 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm162 38 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><circle cx="225" cy="77" r="2"/></g>
    </>,
  },
  divination: {
    title: '占卜', caption: '让星光，照见此刻的心事。', eyebrow: 'A QUIET CONSTELLATION', footer: '牌面与星轨之间，听见自己',
    art: <>
      <ellipse cx="161" cy="163" rx="114" ry="56" transform="rotate(-25 161 163)" stroke="#d4c3df" strokeWidth="1" strokeDasharray="3 6"/>
      <g className="every-opening-float">
        <rect x="88" y="86" width="106" height="160" rx="9" fill="#e3d8e9" stroke="#fff" strokeWidth="2" transform="rotate(-13 141 166)"/>
        <rect x="128" y="74" width="106" height="160" rx="9" fill="#faf6ef" stroke="#d7c7b1" strokeWidth="1.5" transform="rotate(10 181 154)"/>
        <g transform="rotate(10 181 154)"><rect x="137" y="84" width="88" height="140" rx="5" stroke="#e1d4c3"/><circle cx="181" cy="153" r="30" fill="#eee7f2" stroke="#d2bfd9"/><path d="m181 116 9 29 28 8-28 8-9 29-8-29-28-8 28-8 8-29Z" fill="#d8c09c" stroke="#fff9ed"/><circle cx="181" cy="153" r="6" fill="#fff8e7"/><path d="M158 204h46" stroke="#d9c4a6" strokeWidth="2" strokeLinecap="round"/></g>
      </g>
      <g className="every-opening-glow" stroke="#bca6ca" strokeWidth="1.5"><path d="M68 119v12m-6-6h12M245 207v10m-5-5h10"/><circle cx="228" cy="62" r="3" fill="#d8c39d"/></g>
    </>,
  },
  'little-sip': {
    title: '一杯之间', caption: '一点灵感，调成刚好的喜欢。', eyebrow: 'A LITTLE SIP OF JOY', footer: '茶香、果味，还有你的独家配方',
    art: <>
      <g className="every-opening-float">
        <path d="m119 83 21 163m50-165-8 163" stroke="#d4c0ac" strokeWidth="5" strokeLinecap="round"/>
        <path d="m105 112 18 143h82l18-143H105Z" fill="#f9faf3" stroke="#c9d6bf" strokeWidth="2" strokeLinejoin="round"/>
        <path d="m116 155 12 95h73l13-95h-98Z" fill="#e9d8bd"/><path d="m121 195 7 55h73l8-55h-88Z" fill="#cad7b3"/>
        <path d="m126 228 3 21h71l3-21h-77Z" fill="#b9c9a0"/><g fill="#8a927a"><circle cx="143" cy="237" r="4"/><circle cx="160" cy="242" r="4"/><circle cx="179" cy="237" r="4"/><circle cx="190" cy="244" r="3"/></g>
        <path d="M111 126h106" stroke="#fff" strokeWidth="4" opacity=".8"/><path d="m128 143 7 64" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55"/>
      </g>
      <g className="every-opening-bob"><circle cx="219" cy="102" r="26" fill="#eee0ac" stroke="#fff8da" strokeWidth="3"/><circle cx="219" cy="102" r="18" stroke="#fff7d6"/><path d="m219 84 0 36m-18-18h36m-30-13 25 25m-25 0 25-25" stroke="#fff7d6" strokeWidth="1.5"/><path d="M90 133c-25-1-26-20-20-27 17 2 24 12 20 27Zm-3-7c-8-10-6-26 4-33 10 11 8 24-4 33Z" fill="#b9cba7" stroke="#e8eedc"/></g>
    </>,
  },
  'character-perspective': {
    title: '侧写', caption: '在字里行间，慢慢读懂 TA。', eyebrow: 'BETWEEN THE LINES OF YOU', footer: '把关于 TA 的细节，轻轻收藏',
    art: <>
      <g className="every-opening-float">
        <rect x="73" y="74" width="158" height="177" rx="8" fill="#fdf9f3" stroke="#e0d1db" strokeWidth="1.5" transform="rotate(-8 152 162)"/>
        <g transform="rotate(-8 152 162)"><rect x="87" y="88" width="130" height="116" rx="4" fill="#e6dfe9"/><circle cx="152" cy="129" r="21" fill="#c3b0cb"/><path d="M111 192v-9a41 35 0 0 1 82 0v9" fill="#c3b0cb"/><path d="M111 222h83m-65 10h47" stroke="#d6c1cf" strokeWidth="3" strokeLinecap="round"/><path d="M94 111V96h15m86 0h15v15m-116 72v14h15m86 0h15v-14" stroke="#fffaf5" strokeWidth="2"/></g>
      </g>
      <g className="every-opening-bob"><path d="m207 218 47-105 9 4-47 105-9-4Z" fill="#b9cbbf" stroke="#f8fcf8" strokeWidth="1.5"/><path d="m207 218 9 4-11 13 2-17Z" fill="#d6bca7"/><path d="m205 235 1-7 3 2-4 5Z" fill="#a0899a"/></g>
      <g className="every-opening-glow" stroke="#b8a2c2" strokeWidth="1.2"><path d="M66 158v12m-6-6h12M244 77v10m-5-5h10"/><circle cx="240" cy="248" r="2" fill="#d5bfcc"/></g>
    </>,
  },
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
