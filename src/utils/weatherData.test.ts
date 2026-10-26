import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { clearWeatherLocation, searchWeatherCities, readWeatherSettings, writeWeatherSettings, readWeatherSnapshot, refreshWeather, buildWeatherContext, requestWeatherLocation, validLocation, WEATHER_CACHE_KEY } from './weatherData';
import { writeStoredValue } from './localStorage';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; } } } });
const city = { name: '杭州', region: '浙江 · 中国', latitude: 30.27, longitude: 120.15, source: 'city' as const };
const forecast = { timezone: 'Asia/Shanghai', current: { temperature_2m: 23, apparent_temperature: 24, relative_humidity_2m: 65, wind_speed_10m: 7, weather_code: 2, time: '2026-10-26T12:00' }, daily: { time: ['2026-10-26'], weather_code: [2], temperature_2m_min: [16], temperature_2m_max: [25], precipitation_probability_max: [30] } };
beforeEach(async () => { await clearDbStorage(); }); afterEach(() => mock.restoreAll());
test('weather defaults off and never accesses services until a city is enabled', async () => {
  let calls = 0; mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(forecast); });
  assert.equal(readWeatherSettings().enabled, false); assert.equal(await refreshWeather(), null); assert.equal(buildWeatherContext(true), ''); assert.equal(calls, 0);
  assert.equal(validLocation({ ...city, latitude: 300 }), false);
});
test('weather city search validates coordinates and uses the no-key geocoding endpoint', async () => {
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => { assert(String(url).startsWith('https://geocoding-api.open-meteo.com/')); assert.equal(new URL(String(url)).searchParams.get('name'), '杭州'); assert.equal(init?.credentials, 'omit'); return Response.json({ results: [{ name: '杭州', latitude: 30.27, longitude: 120.15, admin1: '浙江', country: '中国' }, { name: '无效', latitude: 300, longitude: 1 }] }); });
  assert.deepEqual(await searchWeatherCities('杭州'), [city]); await assert.rejects(searchWeatherCities('杭'));
});
test('forecast requests deduplicate, cache and inject only city-level data when the role opts in', async () => {
  writeWeatherSettings({ enabled: true, location: city }); let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(forecast); });
  const [a,b] = await Promise.all([refreshWeather(), refreshWeather()]); assert.deepEqual(a,b); assert.equal(calls,1);
  await refreshWeather(); assert.equal(calls,1); assert.equal(buildWeatherContext(false), '');
  const prompt = buildWeatherContext(true); assert.match(prompt,/杭州/); assert.match(prompt,/23/); assert.match(prompt,/不代表角色与玩家同城/); assert(!prompt.includes('30.27')); assert(!prompt.includes('120.15'));
  assert.equal(buildWeatherContext(true, Date.now()+61*60000), '');
  writeWeatherSettings({ enabled: true, location: { ...city, longitude: 121 } }); assert.equal(buildWeatherContext(true), '');
  clearWeatherLocation(); assert.equal(readWeatherSettings().location,null); assert.equal(readWeatherSnapshot(),null);
});
test('failed or obsolete weather responses never overwrite another selected location', async () => {
  writeWeatherSettings({enabled:true,location:city});
  mock.method(globalThis,'fetch',async()=>{writeWeatherSettings({enabled:false,location:null});return Response.json(forecast);});
  await refreshWeather(); assert.equal(readWeatherSnapshot(),null);
  mock.restoreAll();writeWeatherSettings({enabled:true,location:city});mock.method(globalThis,'fetch',async()=>Response.json({...forecast,current:{temperature_2m:23}}));await assert.rejects(refreshWeather(),/不完整/);assert.equal(buildWeatherContext(true),'');
  writeStoredValue(WEATHER_CACHE_KEY,{key:'invalid'});assert.equal(readWeatherSnapshot(),null);
});
test('device location requires a user-triggered call and retains only coarse coordinates', async () => {
  let calls=0;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition:(success:(p:unknown)=>void)=>{calls++;success({coords:{latitude:30.27415,longitude:120.15515}})}}}});
  assert.equal(calls,0);const location=await requestWeatherLocation();assert.equal(calls,1);assert.equal(location.latitude,30.3);assert.equal(location.longitude,120.2);assert.equal(location.source,'device');assert.equal(readWeatherSettings().location,null);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition:(_s:unknown,f:(e:unknown)=>void)=>f({code:1})}}});await assert.rejects(requestWeatherLocation(),/未授权/);
});
