import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LocateFixed, MapPin, RefreshCw, Search } from 'lucide-react';
import { clearWeatherLocation, readWeatherSettings, readWeatherSnapshot, writeWeatherSettings, searchWeatherCities, requestWeatherLocation, refreshWeather, weatherLocationKey, weatherLabel, weatherEmoji, type WeatherLocation, type WeatherSnapshot } from '../utils/weatherData';

export function CalendarWeather() {
  const [settings, setSettings] = useState(readWeatherSettings);
  const [weather, setWeather] = useState(readWeatherSnapshot);
  const [editing, setEditing] = useState(() => !settings.location);
  const [query, setQuery] = useState(''); const [cities, setCities] = useState<WeatherLocation[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const mounted = useRef(true); const token = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; token.current++; }; }, []);
  const load = async (force = false) => { const id = ++token.current; setBusy(true); setError(''); try { const next = await refreshWeather(force); if (mounted.current && id === token.current) setWeather(next); } catch { if (mounted.current && id === token.current) setError('天气暂时无法更新，稍后可以重试'); } finally { if (mounted.current && id === token.current) setBusy(false); } };
  useEffect(() => { if (settings.enabled && settings.location) void load(); }, [settings.enabled, settings.location?.latitude, settings.location?.longitude]);
  const choose = (location: WeatherLocation) => { const next = { enabled: true, location }; writeWeatherSettings(next); setSettings(next); setWeather(null); setEditing(false); setCities([]); setError(''); };
  const locate = async () => { setBusy(true); setError(''); try { const location = await requestWeatherLocation(); if (mounted.current) choose(location); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '定位失败'); } finally { if (mounted.current) setBusy(false); } };
  const search = async () => { setBusy(true); setError(''); try { const results = await searchWeatherCities(query); if (mounted.current) { setCities(results); if (!results.length) setError('没有找到这个城市，试试完整名称'); } } catch(e) { if (mounted.current) setError(e instanceof Error ? e.message : '搜索失败'); } finally { if (mounted.current) setBusy(false); } };
  const current: WeatherSnapshot | null = settings.location && weather?.key === weatherLocationKey(settings.location) ? weather : null;
  const stale = current ? Date.now() - current.fetchedAt > 60 * 60000 : false;
  return <section className="calendar-weather" aria-label="当地天气">
    <header><button type="button" aria-label="天气城市设置" onClick={() => setEditing(!editing)}><MapPin size={14} /><span>{settings.location?.name || '选择天气城市'}</span><ChevronDown size={12} /></button><div><small>当地此刻</small><button type="button" aria-label="刷新天气" disabled={busy || !settings.enabled || !settings.location} onClick={() => void load(true)}><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /></button></div></header>
    {settings.enabled && current ? <>
      <div className="calendar-weather-now"><div><strong>{Math.round(current.current.temperature)}<sup>°</sup></strong><p>{weatherLabel(current.current.code)}<span>体感 {Math.round(current.current.feels)}°</span></p></div><span className="calendar-weather-symbol" aria-hidden="true">{weatherEmoji(current.current.code)}</span></div>
      <div className="calendar-weather-details"><span>湿度 {current.current.humidity}%</span><span>风速 {current.current.wind} km/h</span><span>{stale ? '待更新' : '已更新'} {new Date(current.fetchedAt).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</span></div>
      <div className="calendar-forecast">{current.days.map((day, i) => <div key={day.date}><small>{i === 0 ? '今天' : `${Number(day.date.slice(5,7))}/${Number(day.date.slice(8))}`}</small><span aria-label={weatherLabel(day.code)}>{weatherEmoji(day.code)}</span><strong>{Math.round(day.max)}° <em>{Math.round(day.min)}°</em></strong>{day.rain !== null && <small>{day.rain}% 降雨</small>}</div>)}</div>
    </> : <div className="calendar-weather-empty"><span aria-hidden="true">🌤️</span><p>{busy ? '正在获取天气…' : settings.location && !settings.enabled ? '天气已关闭' : settings.location ? '点击刷新，看看当地天气' : '选一座城市，看看今天的晴雨'}</p></div>}
    {editing && <div className="calendar-weather-settings">
      <label>显示当地天气<input aria-label="显示当地天气" type="checkbox" checked={settings.enabled} onChange={e => { const next = { ...settings, enabled: e.target.checked }; writeWeatherSettings(next); setSettings(next); if (!next.enabled) { token.current++; setBusy(false); } }} /></label>
      <div className="calendar-city-search"><input aria-label="搜索天气城市" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.nativeEvent.isComposing && !busy) void search(); }} placeholder="输入城市，如杭州" maxLength={80} /><button type="button" aria-label="搜索城市" disabled={busy} onClick={() => void search()}><Search size={16} /></button></div>
      {cities.map((city, i) => <button type="button" key={`${city.latitude}-${city.longitude}-${i}`} className="calendar-city-result" onClick={() => choose(city)}><strong>{city.name}</strong><small>{city.region}</small></button>)}
      <button type="button" className="calendar-locate" disabled={busy} onClick={() => void locate()}><LocateFixed size={14} />使用当前位置</button>
      <p>定位仅在点击后请求授权；只保留用于天气的粗略坐标。角色是否感知天气，可在对话设置中选择。</p>
      {settings.location && <button type="button" className="calendar-location-clear" disabled={busy} onClick={() => { token.current++; const next = { enabled: false, location: null }; clearWeatherLocation(); setSettings(next); setWeather(null); }}>清除位置</button>}
    </div>}
    {error && <p role="alert" className="calendar-weather-error">{error}</p>}
    <a className="calendar-weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather · Open-Meteo</a>
  </section>;
}
