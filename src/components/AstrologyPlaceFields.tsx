import { useState } from 'react';
import { ASTROLOGY_PROVINCES, type BirthPlace } from '../utils/astrologyCities';

export default function AstrologyPlaceFields({ place, onChange }: { place: BirthPlace; onChange: (place: BirthPlace) => void }) {
  const detected = ASTROLOGY_PROVINCES.find(province => province.cities.some(city => city.name === place.name));
  const [province, setProvince] = useState(detected?.name ?? 'manual');
  const cities = ASTROLOGY_PROVINCES.find(item => item.name === province)?.cities ?? [];
  return <>
    <div className="stellar-two-fields">
      <label>省份 / 地区<select value={province} onChange={event => {
        const name = event.target.value; setProvince(name);
        const first = ASTROLOGY_PROVINCES.find(item => item.name === name)?.cities[0];
        onChange(first ? { ...first } : { ...place, name: '' });
      }}><option value="manual">其他地点 / 手动填写</option>{ASTROLOGY_PROVINCES.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      <label>城市<select value={cities.find(city => city.name === place.name && city.latitude === place.latitude && city.longitude === place.longitude && city.timeZone === place.timeZone)?.name ?? 'manual'}
        onChange={event => {
          const city = cities.find(item => item.name === event.target.value);
          onChange(city ? { ...city } : { ...place, name: '' });
        }}><option value="manual">其他城市 / 手动坐标</option>{cities.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label>
    </div>
    <p className="stellar-help">离线内置部分常用城市，不以省份代替精确坐标。找不到出生城市时，请手动填写下方坐标；省份切换默认选中该组首个城市，请核对。</p>
    <label>出生地点名称<input required maxLength={100} value={place.name} onChange={event => onChange({ ...place, name: event.target.value })} /></label>
    <div className="stellar-two-fields">
      <label>纬度（北正南负）<input type="number" step="any" min="-89" max="89" required value={Number.isNaN(place.latitude) ? '' : place.latitude} onChange={event => onChange({ ...place, latitude: event.target.valueAsNumber })} /></label>
      <label>经度（东正西负）<input type="number" step="any" min="-180" max="180" required value={Number.isNaN(place.longitude) ? '' : place.longitude} onChange={event => onChange({ ...place, longitude: event.target.valueAsNumber })} /></label>
    </div>
    <label>IANA 时区<input required maxLength={100} spellCheck={false} placeholder="Asia/Shanghai" value={place.timeZone} onChange={event => onChange({ ...place, timeZone: event.target.value })} /></label>
  </>;
}
