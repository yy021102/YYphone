import { PLANETS, ZODIAC, normalizeAngle, type NatalAspect, type NatalChart } from '../utils/astrology';

export default function NatalWheel({ chart, comparison }: { chart: NatalChart; comparison?: { chart: NatalChart; aspects: NatalAspect[] } }) {
  const point = (longitude: number, radius: number) => {
    const angle = (180 - normalizeAngle(longitude - chart.ascendant)) * Math.PI / 180;
    return { x: 190 + Math.cos(angle) * radius, y: 190 + Math.sin(angle) * radius };
  };
  const ordered = chart.planets.map((planet, index) => ({ ...planet, index }))
    .sort((a, b) => normalizeAngle(a.longitude - chart.ascendant) - normalizeAngle(b.longitude - chart.ascendant));
  return <figure className="natal-wheel">
    <svg viewBox={comparison ? '-54 -54 488 488' : '-8 -8 396 396'} role="img" aria-labelledby="natal-wheel-title natal-wheel-description">
      <title id="natal-wheel-title">{comparison ? '双人比较盘：A 内圈、B 外圈' : chart.noonReference ? '当地中午参考星盘' : '个人出生星盘'}</title>
      <desc id="natal-wheel-description">热带黄道、整宫制。行星引线连接实际黄经位置，行星文字标签均匀排布以免重叠。详细度数见下方列表。{chart.noonReference && '上升、天顶和所有宫位仅为午间参考。'}</desc>
      <defs><radialGradient id="natal-wheel-glow"><stop stopColor="#284665" stopOpacity=".6" /><stop offset="1" stopColor="#101e34" stopOpacity="0" /></radialGradient></defs>
      <circle cx="190" cy="190" r="180" fill="url(#natal-wheel-glow)" />
      {[46, 100, 146, 178].map(radius => <circle key={radius} cx="190" cy="190" r={radius} className="natal-wheel-circle" />)}
      {Array.from({ length: 72 }, (_, index) => {
        const outer = point(index * 5, 177), inner = point(index * 5, index % 6 ? 174 : 149);
        return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="natal-wheel-tick" />;
      })}
      {ZODIAC.map((sign, index) => {
        const location = point(index * 30 + 15, 162);
        return <text key={sign[1]} {...location} textAnchor="middle" dominantBaseline="central" className="natal-wheel-zodiac">{`${sign[2]}\uFE0E`}</text>;
      })}
      {chart.cusps.map((cusp, index) => {
        const inner = point(cusp, 47), outer = point(cusp, 146), label = point(cusp + 15, 78);
        return <g key={index}><line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="natal-wheel-house" />
          <text {...label} textAnchor="middle" dominantBaseline="central" className="natal-wheel-house-label">{index + 1}</text></g>;
      })}
      {(comparison ? [...comparison.aspects].sort((a, b) => a.orb - b.orb).slice(0, 12) : chart.aspects).map(aspect => {
        const first = chart.planets.find(planet => planet.id === aspect.a), second = (comparison?.chart ?? chart).planets.find(planet => planet.id === aspect.b);
        if (!first || !second) throw new Error('星盘相位对应的行星不存在。');
        const a = point(first.longitude, 99), b = point(second.longitude, comparison ? 189 : 99);
        return <line key={`${aspect.a}-${aspect.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          className={`natal-wheel-aspect natal-wheel-aspect-${aspect.kind}`} />;
      })}
      {ordered.map((planet, slot) => {
        const actual = point(planet.longitude, 101), bend = point(planet.longitude, 111);
        const label = point(chart.ascendant + slot * 36 + 18, 128);
        return <g key={planet.id}>
          <path d={`M${actual.x} ${actual.y}L${bend.x} ${bend.y}L${label.x} ${label.y}`} className="natal-wheel-leader" />
          <circle {...{ cx: actual.x, cy: actual.y }} r="2.7" fill="#d9e7fa" />
          <circle {...{ cx: label.x, cy: label.y }} r="11" fill="#13243a" />
          <text {...label} textAnchor="middle" dominantBaseline="central" className="natal-wheel-planet">{PLANETS[planet.index].glyph}</text>
        </g>;
      })}
      {comparison && <>
        <circle cx="190" cy="190" r="200" className="natal-wheel-circle" /><circle cx="190" cy="190" r="226" className="natal-wheel-circle" />
        {[...comparison.chart.planets].sort((a, b) => normalizeAngle(a.longitude - chart.ascendant) - normalizeAngle(b.longitude - chart.ascendant)).map((planet, slot) => {
          const actual = point(planet.longitude, 189), label = point(chart.ascendant + slot * 36 + 18, 213);
          const definition = PLANETS.find(item => item.id === planet.id);
          return <g key={planet.id} className="natal-wheel-comparison"><line x1={actual.x} y1={actual.y} x2={label.x} y2={label.y} className="natal-wheel-leader" />
            <circle cx={actual.x} cy={actual.y} r="3" /><circle cx={label.x} cy={label.y} r="11" fill="#13243a" />
            <text {...label} textAnchor="middle" dominantBaseline="central" className="natal-wheel-planet">{definition?.glyph}</text></g>;
        })}
      </>}
      {[{ value: chart.ascendant, text: 'ASC' }, { value: chart.midheaven, text: 'MC' }].map(axis => {
        const start = point(axis.value, 146), end = point(axis.value, 183);
        return <g key={axis.text}><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="natal-wheel-axis" />
          <text x={end.x} y={end.y} textAnchor="middle" dominantBaseline="central" className="natal-wheel-axis-label">{axis.text}</text></g>;
      })}
      <circle cx="190" cy="190" r="43" fill="#101e32" />
      <path d="M190 164L194 178L208 182L194 186L190 200L186 186L172 182L186 178Z" fill="#d1e2f5" opacity=".8" />
      <text x="190" y="215" textAnchor="middle" className="natal-wheel-centre">{chart.noonReference ? 'NOON STUDY' : 'YOUR SKY'}</text>
    </svg>
    <figcaption>{chart.noonReference ? '12:00 REFERENCE · 午间参考，不是真实出生时刻' : 'TROPICAL ZODIAC · WHOLE SIGN HOUSES'}<br />引线指向实际位置，行星符号均匀排布以免重叠。<br />精确度数请见下方列表。</figcaption>
  </figure>;
}
