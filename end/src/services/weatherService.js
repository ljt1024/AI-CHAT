const axios = require('axios');
const { z } = require('zod');
const { env } = require('../config/env');
const { t, getLanguage } = require('../i18n');
const { createHttpError } = require('../utils/http');

const weatherSchema = z.object({
  city: z.string().trim().min(1).max(80),
  forecast: z.boolean().default(false),
});

function weatherText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getWeather(input, { signal, http = axios, apiKey = env.amapApiKey } = {}) {
  const { city, forecast } = weatherSchema.parse(input);
  signal?.throwIfAborted();
  if (!apiKey) throw createHttpError(503, t('error.weatherKey'));
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]);
  const language = getLanguage() === 'en' ? 'en' : 'zh_cn';
  try {
    const geo = await http.get('https://restapi.amap.com/v3/geocode/geo', {
      params: { key: apiKey, address: city, output: 'JSON' }, signal: requestSignal, timeout: 8000,
    });
    if (geo.data?.status !== '1') throw createHttpError(502, t('error.weatherProvider', { p0: String(geo.data?.infocode || 'unknown') }));
    if (!geo.data?.geocodes?.[0]?.adcode) {
      throw createHttpError(404, t('error.weatherCity', { p0: city }));
    }
    if (geo.data.geocodes.length > 1) throw createHttpError(400, t('error.weatherCity', { p0: city }));
    const adcode = geo.data.geocodes[0].adcode;
    const weather = await http.get('https://restapi.amap.com/v3/weather/weatherInfo', {
      params: { key: apiKey, city: adcode, extensions: forecast ? 'all' : 'base', output: 'JSON' },
      signal: requestSignal, timeout: 8000,
    });
    if (weather.data?.status !== '1') throw createHttpError(502, t('error.weatherProvider', { p0: String(weather.data?.infocode || 'unknown') }));
    const live = weather.data.lives?.[0];
    const cast = weather.data.forecasts?.[0]?.casts;
    if (forecast ? !Array.isArray(cast) || !cast.length : !live?.reporttime) throw createHttpError(502, t('error.weatherProvider', { p0: 'EMPTY_RESULT' }));
    const result = {
      city: weatherText(live?.city) || weatherText(weather.data.forecasts?.[0]?.city) || city,
      province: weatherText(live?.province) || weatherText(weather.data.forecasts?.[0]?.province),
      reportTime: weatherText(live?.reporttime) || weatherText(weather.data.forecasts?.[0]?.reporttime),
      type: weatherText(live?.weather) || '', temperatureC: weatherText(live?.temperature) || '',
      humidityPercent: weatherText(live?.humidity) || '', wind: weatherText(live?.winddirection) || '',
      windPower: weatherText(live?.windpower) || '', forecasts: Array.isArray(cast) ? cast.map(day => ({
        date: day.date, week: day.week, dayWeather: day.dayweather, nightWeather: day.nightweather,
        dayTemperatureC: day.daytemp, nightTemperatureC: day.nighttemp,
        dayWind: day.daywind, nightWind: day.nightwind,
      })) : [], source: '高德地图天气', language,
    };
    signal?.throwIfAborted();
    return JSON.stringify(result);
  } catch (error) {
    signal?.throwIfAborted();
    if (error.status && !error.isAxiosError) throw error;
    if (requestSignal.aborted) throw createHttpError(504, t('error.weatherTimeout'));
    throw createHttpError(502, t('error.weatherProvider', { p0: 'NETWORK_ERROR' }));
  }
}
module.exports = { getWeather, weatherSchema };
