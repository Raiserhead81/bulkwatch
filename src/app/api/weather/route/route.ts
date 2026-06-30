import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface WeatherPoint {
  lat: number; lon: number;
  waveHeight: number; swellHeight: number; wavePeriod: number; waveDirection: number;
  windSpeed: number; windDirection: number; windGusts: number;
}

interface ForecastDay {
  date: string;
  waveHeightMax: number; waveHeightAvg: number;
  windSpeedMax: number; windSpeedAvg: number;
  swellHeightMax: number;
}

function sampleRoutePoints(lat1: number, lon1: number, lat2: number, lon2: number, n: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1);
    points.push([lat1 + (lat2 - lat1) * f, lon1 + (lon2 - lon1) * f]);
  }
  return points;
}

async function fetchCurrent(lat: number, lon: number): Promise<WeatherPoint | null> {
  try {
    const [marineRes, windRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height`, {
        headers: { "User-Agent": "MaritimeAI/1.0" }, signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`, {
        headers: { "User-Agent": "MaritimeAI/1.0" }, signal: AbortSignal.timeout(8000),
      }),
    ]);
    const marine = await marineRes.json();
    const wind = await windRes.json();
    return {
      lat, lon,
      waveHeight: marine.current?.wave_height ?? 0,
      swellHeight: marine.current?.swell_wave_height ?? 0,
      wavePeriod: marine.current?.wave_period ?? 0,
      waveDirection: marine.current?.wave_direction ?? 0,
      windSpeed: (wind.current?.wind_speed_10m ?? 0) / 1.852,
      windDirection: wind.current?.wind_direction_10m ?? 0,
      windGusts: (wind.current?.wind_gusts_10m ?? 0) / 1.852,
    };
  } catch { return null; }
}

async function fetchForecast7d(lat: number, lon: number): Promise<ForecastDay[]> {
  try {
    const [marineRes, windRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&daily=wave_height_max,swell_wave_height_max&timezone=UTC&forecast_days=7`, {
        headers: { "User-Agent": "MaritimeAI/1.0" }, signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&daily=wind_speed_10m_max,wind_gusts_10m_max&timezone=UTC&forecast_days=7`, {
        headers: { "User-Agent": "MaritimeAI/1.0" }, signal: AbortSignal.timeout(8000),
      }),
    ]);
    const marine = await marineRes.json();
    const wind = await windRes.json();
    const days: ForecastDay[] = [];
    const dates = marine.daily?.time || [];
    for (let i = 0; i < dates.length; i++) {
      days.push({
        date: dates[i],
        waveHeightMax: marine.daily?.wave_height_max?.[i] ?? 0,
        waveHeightAvg: (marine.daily?.wave_height_max?.[i] ?? 0) * 0.6,
        windSpeedMax: ((wind.daily?.wind_speed_10m_max?.[i] ?? 0) / 1.852),
        windSpeedAvg: ((wind.daily?.wind_speed_10m_max?.[i] ?? 0) / 1.852) * 0.6,
        swellHeightMax: marine.daily?.swell_wave_height_max?.[i] ?? 0,
      });
    }
    return days;
  } catch { return []; }
}

async function fetchHistoric(lat: number, lon: number): Promise<{monthlyAvg: Record<string, {waveHeight: number; windSpeed: number}>}> {
  // Use Open-Meteo historical marine API — last 12 months of data
  try {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const res = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}&daily=wave_height_max&timezone=UTC`,
      { headers: { "User-Agent": "MaritimeAI/1.0" }, signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    const dates = data.daily?.time || [];
    const waves = data.daily?.wave_height_max || [];

    // Group by month
    const monthly: Record<string, number[]> = {};
    for (let i = 0; i < dates.length; i++) {
      const month = dates[i].substring(0, 7); // "2025-07"
      if (!monthly[month]) monthly[month] = [];
      monthly[month].push(waves[i] || 0);
    }

    const monthlyAvg: Record<string, {waveHeight: number; windSpeed: number}> = {};
    for (const [month, vals] of Object.entries(monthly)) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      monthlyAvg[month] = { waveHeight: +avg.toFixed(1), windSpeed: 0 };
    }
    return { monthlyAvg };
  } catch { return { monthlyAvg: {} }; }
}

function beaufort(knots: number): { scale: number; description: string; seaState: string } {
  if (knots < 1) return { scale: 0, description: "Calm", seaState: "Sea like a mirror" };
  if (knots < 4) return { scale: 1, description: "Light air", seaState: "Ripples" };
  if (knots < 7) return { scale: 2, description: "Light breeze", seaState: "Small wavelets" };
  if (knots < 11) return { scale: 3, description: "Gentle breeze", seaState: "Large wavelets" };
  if (knots < 17) return { scale: 4, description: "Moderate breeze", seaState: "Small waves" };
  if (knots < 22) return { scale: 5, description: "Fresh breeze", seaState: "Moderate waves" };
  if (knots < 28) return { scale: 6, description: "Strong breeze", seaState: "Large waves" };
  if (knots < 34) return { scale: 7, description: "Near gale", seaState: "Sea heaps up" };
  if (knots < 41) return { scale: 8, description: "Gale", seaState: "High waves" };
  if (knots < 48) return { scale: 9, description: "Strong gale", seaState: "Very high waves" };
  if (knots < 56) return { scale: 10, description: "Storm", seaState: "Exceptionally high waves" };
  if (knots < 64) return { scale: 11, description: "Violent storm", seaState: "Air filled with spray" };
  return { scale: 12, description: "Hurricane", seaState: "Devastation" };
}

function speedLossPercent(waveHeight: number): number {
  if (waveHeight <= 0.5) return 0;
  if (waveHeight <= 1.0) return 2;
  if (waveHeight <= 1.5) return 5;
  if (waveHeight <= 2.0) return 8;
  if (waveHeight <= 2.5) return 12;
  if (waveHeight <= 3.0) return 16;
  if (waveHeight <= 4.0) return 22;
  if (waveHeight <= 5.0) return 30;
  return 40;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromLat = parseFloat(searchParams.get("fromLat") || "0");
  const fromLon = parseFloat(searchParams.get("fromLon") || "0");
  const toLat = parseFloat(searchParams.get("toLat") || "0");
  const toLon = parseFloat(searchParams.get("toLon") || "0");
  const includeHistory = searchParams.get("history") === "1";

  if (!fromLat || !toLat) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const points = sampleRoutePoints(fromLat, fromLon, toLat, toLon, 6);
  const midPoint = points[Math.floor(points.length / 2)];

  // Fetch current weather, 7-day forecast, and optionally historic data in parallel
  const [weatherData, forecast, historic] = await Promise.all([
    Promise.all(points.map(([lat, lon]) => fetchCurrent(lat, lon))),
    fetchForecast7d(midPoint[0], midPoint[1]),
    includeHistory ? fetchHistoric(midPoint[0], midPoint[1]) : Promise.resolve({ monthlyAvg: {} }),
  ]);

  const validPoints = weatherData.filter((w): w is WeatherPoint => w !== null);

  if (validPoints.length === 0) {
    return NextResponse.json({ error: "Weather data unavailable" }, { status: 503 });
  }

  const avgWaveHeight = validPoints.reduce((s, p) => s + p.waveHeight, 0) / validPoints.length;
  const maxWaveHeight = Math.max(...validPoints.map(p => p.waveHeight));
  const avgWindSpeed = validPoints.reduce((s, p) => s + p.windSpeed, 0) / validPoints.length;
  const maxWindSpeed = Math.max(...validPoints.map(p => p.windSpeed));
  const avgSwellHeight = validPoints.reduce((s, p) => s + p.swellHeight, 0) / validPoints.length;

  let routeCondition: "excellent" | "good" | "moderate" | "rough" | "severe";
  if (avgWaveHeight <= 1.0 && avgWindSpeed <= 15) routeCondition = "excellent";
  else if (avgWaveHeight <= 2.0 && avgWindSpeed <= 25) routeCondition = "good";
  else if (avgWaveHeight <= 3.0 && avgWindSpeed <= 35) routeCondition = "moderate";
  else if (avgWaveHeight <= 4.5 && avgWindSpeed <= 45) routeCondition = "rough";
  else routeCondition = "severe";

  // Best/worst days in forecast
  const bestDay = forecast.length > 0 ? forecast.reduce((a, b) => a.waveHeightMax < b.waveHeightMax ? a : b) : null;
  const worstDay = forecast.length > 0 ? forecast.reduce((a, b) => a.waveHeightMax > b.waveHeightMax ? a : b) : null;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    samplePoints: validPoints.length,

    current: {
      condition: routeCondition,
      avgWaveHeight: +avgWaveHeight.toFixed(1),
      maxWaveHeight: +maxWaveHeight.toFixed(1),
      avgSwellHeight: +avgSwellHeight.toFixed(1),
      avgWindSpeedKn: +avgWindSpeed.toFixed(1),
      maxWindSpeedKn: +maxWindSpeed.toFixed(1),
      avgBeaufort: beaufort(avgWindSpeed),
      maxBeaufort: beaufort(maxWindSpeed),
      estimatedSpeedLoss: speedLossPercent(avgWaveHeight),
      worstSpeedLoss: speedLossPercent(maxWaveHeight),
    },

    forecast: {
      days: forecast.map(d => ({
        ...d,
        windSpeedMax: +d.windSpeedMax.toFixed(1),
        windSpeedAvg: +d.windSpeedAvg.toFixed(1),
        beaufort: beaufort(d.windSpeedMax).scale,
        speedLoss: speedLossPercent(d.waveHeightMax),
        condition: d.waveHeightMax <= 1.5 ? "good" : d.waveHeightMax <= 3.0 ? "moderate" : "rough",
      })),
      bestDay: bestDay ? { date: bestDay.date, waveHeight: bestDay.waveHeightMax } : null,
      worstDay: worstDay ? { date: worstDay.date, waveHeight: worstDay.waveHeightMax } : null,
    },

    historic: Object.keys(historic.monthlyAvg).length > 0 ? {
      monthlyWaveHeight: historic.monthlyAvg,
      note: "12-month average wave height at route midpoint",
    } : undefined,

    points: validPoints.map(p => ({
      lat: +p.lat.toFixed(2), lon: +p.lon.toFixed(2),
      waveHeight: p.waveHeight, swellHeight: p.swellHeight,
      windSpeedKn: +p.windSpeed.toFixed(1),
      beaufort: beaufort(p.windSpeed).scale,
    })),
  });
}
