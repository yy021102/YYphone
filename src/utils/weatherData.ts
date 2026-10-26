import { readStoredValue, writeStoredValue } from './localStorage';

export const WEATHER_SETTINGS_KEY = 'yyphone:weather-settings';
export const WEATHER_CACHE_KEY = 'yyphone:weather-cache';
export type WeatherLocation = { name: string; region: string; latitude: number; longitude: number; source: 'city' | 'device' };
export type WeatherSettings = { enabled: boolean; location: WeatherLocation | null };
export type WeatherDay = { date: string; code: number; min: number; max: number; rain: number | null };
export type WeatherSnapshot = { key: string; fetchedAt: number; timezone: string; current: { temperature: number; feels: number; humidity: number; wind: number; code: number; time: string }; days: WeatherDay[] };
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const validLocation = (v: unknown): v is WeatherLocation => record(v) && typeof v.name === 'string' && typeof v.region === 'string' && finite(v.latitude) && Math.abs(v.latitude) <= 90 && finite(v.longitude) && Math.abs(v.longitude) <= 180 && ['city', 'device'].includes(v.source);
const validSettings = (v: unknown): v is WeatherSettings => record(v) && typeof v.enabled === 'boolean' && (v.location === null || validLocation(v.location));
const validSnapshot = (v: unknown): v is WeatherSnapshot => record(v) && typeof v.key === 'string' && finite(v.fetchedAt) && typeof v.timezone === 'string' && record(v.current) && ['temperature', 'feels', 'humidity', 'wind', 'code'].every(k => finite(v.current[k])) && typeof v.current.time === 'string' && Array.isArray(v.days) && v.days.every(d => record(d) && typeof d.date === 'string' && [d.code, d.min, d.max].every(finite) && (d.rain === null || finite(d.rain)));
export const readWeatherSettings = () => readStoredValue(WEATHER_SETTINGS_KEY, { enabled: false, location: null } as WeatherSettings, validSettings);
export const writeWeatherSettings = (value: WeatherSettings) => writeStoredValue(WEATHER_SETTINGS_KEY, value);
export const clearWeatherLocation = () => { writeWeatherSettings({ enabled: false, location: null }); writeStoredValue(WEATHER_CACHE_KEY, null); };
export const readWeatherSnapshot = () => readStoredValue<WeatherSnapshot | null>(WEATHER_CACHE_KEY, null, (v): v is WeatherSnapshot | null => v === null || validSnapshot(v));
export const weatherLocationKey = (location: WeatherLocation) => `${location.latitude},${location.longitude}`;
export const weatherLabel = (code: number) => code === 0 ? '晴' : code <= 3 ? '多云' : [45, 48].includes(code) ? '雾' : code >= 95 ? '雷雨' : [71, 73, 75, 77, 85, 86].includes(code) ? '雪' : code >= 51 && code <= 82 ? '雨' : '天气变化';
export const weatherEmoji = (code: number) => code === 0 ? '☀️' : code <= 3 ? '⛅' : [45, 48].includes(code) ? '🌫️' : code >= 95 ? '⛈️' : [71, 73, 75, 77, 85, 86].includes(code) ? '❄️' : '🌧️';
async function getJson(url: string): Promise<any> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
  try { const response = await fetch(url, { signal: controller.signal, credentials: 'omit' }); if (!response.ok) throw new Error(`天气服务暂不可用（HTTP ${response.status}）`); const data: unknown = await response.json(); if (!record(data) || data.error) throw new Error('天气服务返回无效数据'); return data; }
  finally { clearTimeout(timer); }
}
export async function searchWeatherCities(query: string): Promise<WeatherLocation[]> {
  if (query.trim().length < 2) throw new Error('请至少输入两个字搜索城市');
  const params = new URLSearchParams({ name: query.trim(), count: '6', language: 'zh', format: 'json' });
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  return (Array.isArray(data.results) ? data.results : []).flatMap((r: unknown) => record(r) && typeof r.name === 'string' && finite(r.latitude) && finite(r.longitude) ? [{ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(' · '), latitude: r.latitude, longitude: r.longitude, source: 'city' as const }] : []).filter(validLocation);
}
export async function requestWeatherLocation(): Promise<WeatherLocation> {
  if (!navigator.geolocation || globalThis.isSecureContext === false) throw new Error('当前环境无法定位，请使用 HTTPS 或手动选择城市');
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
    // Retain only coarse coordinates for weather; exact device coordinates never enter storage or model prompts.
    const location: WeatherLocation = { name: '当前位置', region: '设备定位', latitude: Math.round(position.coords.latitude * 10) / 10, longitude: Math.round(position.coords.longitude * 10) / 10, source: 'device' };
    if (validLocation(location)) resolve(location); else reject(new Error('未取得有效位置，请手动选择城市'));
  }, error => reject(new Error(error.code === 1 ? '定位未授权，可以手动选择城市' : '定位暂不可用，可以手动选择城市')), { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }));
}
const pending = new Map<string, Promise<WeatherSnapshot>>();
export async function refreshWeather(force = false): Promise<WeatherSnapshot | null> {
  const settings = readWeatherSettings(); const location = settings.location;
  if (!settings.enabled || !location) return null;
  const key = weatherLocationKey(location); const old = readWeatherSnapshot();
  if (!force && old?.key === key && Date.now() - old.fetchedAt < 30 * 60000) return old;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', forecast_days: '5' });
    const result = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`); const current = result.current; const daily = result.daily;
    if (!record(current) || !record(daily) || !Array.isArray(daily.time)) throw new Error('天气数据不完整');
    const snapshot: WeatherSnapshot = { key, fetchedAt: Date.now(), timezone: result.timezone || '', current: { temperature: current.temperature_2m, feels: current.apparent_temperature, humidity: current.relative_humidity_2m, wind: current.wind_speed_10m, code: current.weather_code, time: current.time }, days: daily.time.map((date: string, i: number) => ({ date, code: daily.weather_code?.[i], min: daily.temperature_2m_min?.[i], max: daily.temperature_2m_max?.[i], rain: daily.precipitation_probability_max?.[i] ?? null })) };
    if (!validSnapshot(snapshot)) throw new Error('天气数据不完整');
    const latest = readWeatherSettings();
    if (latest.enabled && latest.location && weatherLocationKey(latest.location) === key) writeStoredValue(WEATHER_CACHE_KEY, snapshot);
    return snapshot;
  })();
  pending.set(key, request); try { return await request; } finally { pending.delete(key); }
}
export function buildWeatherContext(enabled: boolean, now = Date.now()): string {
  if (!enabled) return '';
  const settings = readWeatherSettings(), weather = readWeatherSnapshot();
  if (!settings.enabled || !settings.location || !weather || weather.key !== weatherLocationKey(settings.location) || now - weather.fetchedAt > 60 * 60000) return '';
  return `【玩家当地天气】\n${JSON.stringify({ city: settings.location.name, source: settings.location.source === 'device' ? '用户授权的粗略位置' : '用户选择的天气城市', timezone: weather.timezone, time: weather.current.time, temperatureC: weather.current.temperature, feelsLikeC: weather.current.feels, condition: weatherLabel(weather.current.code), humidityPercent: weather.current.humidity, windKmh: weather.current.wind, today: weather.days[0], provider: 'Open-Meteo' })}\n这只是玩家选择的位置及天气预报，不代表角色与玩家同城，不暴露或推测具体住址，不覆盖剧情地点、世界书与故事天气。仅在合适时自然参考，不必每轮提及，也不能声称亲眼看见玩家的天气。`;
}
