import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface WeatherPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  swellHeight: number;
  wavePeriod: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
}

// Sample 5-8 points along the great circle route
function sampleRoutePoints(lat1: number, lon1: number, lat2: number, lon2: number, n: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1);
    points.push([
      lat1 + (lat2 - lat1) * f,
      lon1 + (lon2 - lon1) * f,
    ]);
  }
  return points;
}

async function fetchMarineWeather(lat: number, lon: number): Promise<WeatherPoint | null> {
  try {
    const [marineRes, windRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height`, {
        headers: { "User-Agent": "VesselDB/1.0" },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`, {
        headers: { "User-Agent": "VesselDB/1.0" },
        signal: AbortSignal.timeout(8000),
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
      windSpeed: (wind.current?.wind_speed_10m ?? 0) / 1.852, // km/h → knots
      windDirection: wind.current?.wind_direction_10m ?? 0,
      windGusts: (wind.current?.wind_gusts_10m ?? 0) / 1.852,
    };
  } catch {
    return null;
  }
}

// Beaufort scale from wind speed (knots)
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

// Speed loss from wave height (empirical formula, Kwon 2008)
function speedLossPercent(waveHeight: number, shipLength: number = 200): number {
  if (waveHeight <= 0.5) return 0;
  if (waveHeight <= 1.0) return 2;
  if (waveHeight <= 1.5) return 5;
  if (waveHeight <= 2.0) return 8;
  if (waveHeight <= 2.5) return 12;
  if (waveHeight <= 3.0) return 16;
  if (waveHeight <= 4.0) return 22;
  if (waveHeight <= 5.0) return 30;
  return 40; // >5m waves — significant delay
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromLat = parseFloat(searchParams.get("fromLat") || "0");
  const fromLon = parseFloat(searchParams.get("fromLon") || "0");
  const toLat = parseFloat(searchParams.get("toLat") || "0");
  const toLon = parseFloat(searchParams.get("toLon") || "0");

  if (!fromLat || !toLat) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  // Sample 6 points along route
  const points = sampleRoutePoints(fromLat, fromLon, toLat, toLon, 6);

  // Fetch weather for all points in parallel
  const weatherData = await Promise.all(points.map(([lat, lon]) => fetchMarineWeather(lat, lon)));
  const validPoints = weatherData.filter((w): w is WeatherPoint => w !== null);

  if (validPoints.length === 0) {
    return NextResponse.json({ error: "Weather data unavailable" }, { status: 503 });
  }

  // Calculate route averages and worst conditions
  const avgWaveHeight = validPoints.reduce((s, p) => s + p.waveHeight, 0) / validPoints.length;
  const maxWaveHeight = Math.max(...validPoints.map(p => p.waveHeight));
  const avgWindSpeed = validPoints.reduce((s, p) => s + p.windSpeed, 0) / validPoints.length;
  const maxWindSpeed = Math.max(...validPoints.map(p => p.windSpeed));
  const avgSwellHeight = validPoints.reduce((s, p) => s + p.swellHeight, 0) / validPoints.length;

  const avgBeaufort = beaufort(avgWindSpeed);
  const maxBeaufort = beaufort(maxWindSpeed);
  const avgSpeedLoss = speedLossPercent(avgWaveHeight);
  const maxSpeedLoss = speedLossPercent(maxWaveHeight);

  // Overall route assessment
  let routeCondition: "excellent" | "good" | "moderate" | "rough" | "severe";
  if (avgWaveHeight <= 1.0 && avgWindSpeed <= 15) routeCondition = "excellent";
  else if (avgWaveHeight <= 2.0 && avgWindSpeed <= 25) routeCondition = "good";
  else if (avgWaveHeight <= 3.0 && avgWindSpeed <= 35) routeCondition = "moderate";
  else if (avgWaveHeight <= 4.5 && avgWindSpeed <= 45) routeCondition = "rough";
  else routeCondition = "severe";

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    samplePoints: validPoints.length,
    route: {
      condition: routeCondition,
      avgWaveHeight: +avgWaveHeight.toFixed(1),
      maxWaveHeight: +maxWaveHeight.toFixed(1),
      avgSwellHeight: +avgSwellHeight.toFixed(1),
      avgWindSpeedKn: +avgWindSpeed.toFixed(1),
      maxWindSpeedKn: +maxWindSpeed.toFixed(1),
      avgBeaufort: avgBeaufort,
      maxBeaufort: maxBeaufort,
      estimatedSpeedLoss: avgSpeedLoss,
      worstSpeedLoss: maxSpeedLoss,
    },
    points: validPoints.map(p => ({
      lat: +p.lat.toFixed(2),
      lon: +p.lon.toFixed(2),
      waveHeight: p.waveHeight,
      swellHeight: p.swellHeight,
      windSpeedKn: +p.windSpeed.toFixed(1),
      beaufort: beaufort(p.windSpeed).scale,
    })),
  });
}
