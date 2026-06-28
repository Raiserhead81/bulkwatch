import { getDb } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ── rate limiter ── */
const hits = new Map<string, number[]>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 20;
  const list = (hits.get(ip) || []).filter(t => t > now - window);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(ip, list);
  return true;
}

/* ── build system context from live DB ── */
function buildSystemPrompt(): string {
  const db = getDb();

  const totalShips = (db.prepare("SELECT COUNT(*) as c FROM ships").get() as any).c;
  const typeCounts = db.prepare("SELECT type, COUNT(*) as c FROM ships GROUP BY type ORDER BY c DESC LIMIT 15").all() as any[];
  const flagCounts = db.prepare("SELECT flag, COUNT(*) as c FROM ships WHERE flag != 'Unknown' GROUP BY flag ORDER BY c DESC LIMIT 10").all() as any[];
  const withAIS = (db.prepare("SELECT COUNT(*) as c FROM ships WHERE lat IS NOT NULL AND lon IS NOT NULL").get() as any).c;
  const latestBDI = db.prepare("SELECT bdi FROM price_history ORDER BY date DESC LIMIT 1").get() as any;
  const avgAge = db.prepare("SELECT ROUND(AVG(2026 - year_built),1) as a FROM ships WHERE year_built > 0").get() as any;
  // Live freight rates from BDI (same formula as freightRates.ts)
  const bdiVal = latestBDI?.bdi || 2524;
  const freightRates = [
    { type: "Capesize (180k DWT)", tce: Math.max(Math.round(12.5 * bdiVal - 8000), 1000) },
    { type: "Kamsarmax (82k DWT)", tce: Math.max(Math.round(6.2 * bdiVal - 2000), 1000) },
    { type: "Panamax (75k DWT)", tce: Math.max(Math.round(5.8 * bdiVal - 1500), 1000) },
    { type: "Ultramax (64k DWT)", tce: Math.max(Math.round(5.0 * bdiVal - 1000), 1000) },
    { type: "Supramax (58k DWT)", tce: Math.max(Math.round(4.5 * bdiVal - 500), 1000) },
    { type: "Handysize (35k DWT)", tce: Math.max(Math.round(3.2 * bdiVal + 500), 1000) },
    { type: "VLCC Tanker", tce: Math.max(Math.round(8.0 * bdiVal + 5000), 5000) },
    { type: "Suezmax Tanker", tce: Math.max(Math.round(5.5 * bdiVal + 3000), 3000) },
    { type: "MR Tanker (50k)", tce: Math.max(Math.round(3.0 * bdiVal + 2500), 2000) },
  ];
  const ratesList = freightRates.map(r => `  ${r.type}: $${r.tce.toLocaleString()}/day TCE`).join("\n");

  // Bunker prices estimated from Brent (updated daily by cron)
  // Read from priceEstimator or use BDI correlation
  const brentEst = Math.round(bdiVal * 0.028 + 2); // rough BDI→Brent correlation
  const vlsfo = Math.round(brentEst * 8.2);
  const hsfo = Math.round(brentEst * 5.8);
  const mgo = Math.round(brentEst * 12.5);

  const topOperators = db.prepare("SELECT operator, COUNT(*) as c FROM ships WHERE operator IS NOT NULL AND operator != '' GROUP BY operator ORDER BY c DESC LIMIT 10").all() as any[];

  const typeList = typeCounts.map((r: any) => `  ${r.type}: ${r.c}`).join("\n");
  const flagList = flagCounts.map((r: any) => `  ${r.flag}: ${r.c}`).join("\n");
  const opList = topOperators.map((r: any) => `  ${r.operator}: ${r.c}`).join("\n");
  const bdi = latestBDI?.bdi || "N/A";

  return `You are the Vessel Database AI Assistant — a maritime intelligence expert.
You have access to a live SQLite database with ${totalShips} ships.

DATABASE SCHEMA:
Table: ships
  imo TEXT PRIMARY KEY, name TEXT, mmsi TEXT, type TEXT, dwt INTEGER,
  length REAL, beam REAL, draft REAL, year_built INTEGER, builder TEXT,
  flag TEXT, operator TEXT, home_port TEXT, image_url TEXT,
  lat REAL, lon REAL, last_seen INTEGER, status TEXT,
  delivery_date TEXT, gross_tonnage INTEGER, net_tonnage INTEGER,
  engine_type TEXT, engine_power_kw INTEGER, speed_knots REAL,
  fuel_consumption_tons_day REAL, fuel_type TEXT, crew_size INTEGER,
  hull_number TEXT, class_society TEXT, grain_capacity INTEGER,
  holds INTEGER, hatches INTEGER, cranes TEXT

Table: price_history
  imo TEXT, date TEXT, estimated_value INTEGER, confidence INTEGER,
  recommendation TEXT, bdi INTEGER
  PRIMARY KEY (imo, date)

Table: operators
  name TEXT PRIMARY KEY, country TEXT, city TEXT, website TEXT, fleet_size INTEGER

CURRENT STATS:
- Total ships: ${totalShips}
- Ships with AIS position: ${withAIS}
- Average fleet age: ${avgAge?.a || "?"} years
- Current BDI: ${bdi}

LIVE FREIGHT RATES (calculated from BDI ${bdiVal}, updated daily):
${ratesList}

CURRENT BUNKER FUEL PRICES (estimated from crude oil):
  VLSFO 0.5%S: ~$${vlsfo}/ton
  HSFO 380: ~$${hsfo}/ton
  MGO/MDO: ~$${mgo}/ton

When asked about freight rates or fuel prices, use these CURRENT values - they are updated daily.

FLEET BY TYPE:
${typeList}

TOP FLAGS:
${flagList}

TOP OPERATORS:
${opList}

INSTRUCTIONS:
- When the user asks about ships, fleets, operators, or market data, generate a SQL query
- Wrap SQL queries in <SQL>SELECT ... FROM ...</SQL> tags — the system will execute them
- ONLY use SELECT statements — never INSERT, UPDATE, DELETE, DROP, ALTER
- Use LIKE for name searches (case insensitive with COLLATE NOCASE)
- Format numbers nicely (e.g. 180,000 DWT)
- For route cost estimates, use typical industry rates:
  * Bunker fuel (VLSFO): ~/ton
  * Capesize daily fuel: ~55 tons/day at 12.5 knots
  * Panamax daily fuel: ~32 tons/day at 13 knots
  * Handymax daily fuel: ~28 tons/day at 13.5 knots
  * Canal fees: Suez ~k-500k Capesize, Panama ~k-400k Panamax
- For ship valuations, consider: age, DWT, type, BDI, market conditions
- Answer in the same language the user writes (German or English)
- Be concise but thorough. Use markdown tables for multi-ship results.
- If you don't have enough data, say so honestly.

POSITION & VOYAGE QUERIES:
- Ships have lat/lon columns for last known position
- Key geographic areas for SQL WHERE clauses:
  Suez Canal: lat BETWEEN 29.5 AND 31.5 AND lon BETWEEN 32.0 AND 33.0
  Panama Canal: lat BETWEEN 8.5 AND 9.5 AND lon BETWEEN -80.0 AND -79.0
  Strait of Malacca: lat BETWEEN 1.0 AND 4.0 AND lon BETWEEN 100.0 AND 104.0
  Strait of Hormuz: lat BETWEEN 25.5 AND 27.0 AND lon BETWEEN 55.0 AND 57.0
  Cape of Good Hope: lat BETWEEN -35.0 AND -33.0 AND lon BETWEEN 17.0 AND 20.0
  English Channel: lat BETWEEN 50.0 AND 51.5 AND lon BETWEEN -2.0 AND 2.0
  Singapore: lat BETWEEN 1.0 AND 1.5 AND lon BETWEEN 103.5 AND 104.2
  Shanghai area: lat BETWEEN 30.0 AND 32.0 AND lon BETWEEN 121.0 AND 123.0
  Rotterdam area: lat BETWEEN 51.5 AND 52.5 AND lon BETWEEN 3.5 AND 5.5
- last_seen is a UNIX timestamp

CARGO & VOYAGE ESTIMATION (make clear these are ESTIMATES):
- Bulk carriers from Australia/Brazil to China = likely iron ore
- Bulk carriers from USA/Argentina to Asia = likely grain
- Bulk carriers from Indonesia/S.Africa = likely coal
- Tankers from Middle East = likely crude oil
- Container ships = containerized cargo
- speed_knots * 24 = nautical miles per day

INVESTMENT ANALYSIS:
- price_history table has 30 months of estimated values
- Use price per DWT (estimated_value / dwt) for value comparison
- Young ships (<5 yrs) with low price/DWT in strong market = best picks
- BDI > 2000 = strong market, BDI < 1000 = weak market

COMPLETE PORT & COMMODITY DATABASE (133 ports):

Bauxite / Alumina:
  Kamsar (Guinea), Weipa (Australia)

Cement:
  Ras Al Khaimah (UAE)

Coal (thermal/coking):
  Abbot Point (Australia), Amsterdam (Netherlands), Balikpapan (Indonesia), Baltimore (USA), Gangavaram (India), Gdansk (Poland), Gladstone (Australia), Haldia (India), Hay Point (Australia), Immingham (UK), Krishnapatnam (India), Newcastle (Australia), Norfolk (VA) (USA), Richards Bay (South Africa), Tanjung Bara (Indonesia), Tianjin (China), Tyne (UK), Vancouver (Canada), Yantai (China)

Containers (general cargo):
  Algeciras (Spain), Antwerp (Belgium), Bandar Abbas (Iran), Barcelona (Spain), Bremerhaven (Germany), Buenos Aires (Argentina), Busan (South Korea), Callao (Peru), Cape Town (South Africa), Cartagena (Colombia), Charleston (USA), Chennai (India), Colon (Panama), Dar es Salaam (Tanzania), Djibouti (Djibouti), Durban (South Africa), Felixstowe (UK), Fuzhou (China), Genoa (Italy), Gioia Tauro (Italy), Gothenburg (Sweden), Guangzhou (China), Guayaquil (Ecuador), Hai Phong (Vietnam), Haifa (Israel), Halifax (Canada), Hamburg (Germany), Helsinki (Finland), Ho Chi Minh City (Vietnam), Incheon (South Korea), Istanbul (Ambarli) (Turkey), Jakarta (Indonesia), Jebel Ali (UAE), Jeddah (Saudi Arabia), Kingston (Jamaica), Klaipeda (Lithuania), Kobe (Japan), Kochi (India), Laem Chabang (Thailand), Lagos (Apapa) (Nigeria), Long Beach (USA), Los Angeles (USA), Manila (Philippines), Manzanillo (Mexico), Marsaxlokk (Malta), Marseille/Fos (France), Melbourne (Australia), Mersin (Turkey), Mombasa (Kenya), Mumbai (JNPT) (India), Mundra (India), Nagoya (Japan), New York/New Jersey (USA), Osaka (Japan), Piraeus (Greece), Port Klang (Malaysia), Port Said (Egypt), Rotterdam (Netherlands), Salalah (Oman), San Antonio (Chile), Santos (Brazil), Savannah (USA), Shanghai (China), Shenzhen (China), Singapore (Singapore), Southampton (UK), St. Petersburg (Russia), Sydney (Australia), Tanger Med (Morocco), Tanjung Pelepas (Malaysia), Tokyo (Japan), Valencia (Spain), Xiamen (China), Yokohama (Japan)

Crude Oil:
  Basra (Iraq), Houston (USA), Ras Tanura (Saudi Arabia)

Fertilizer / Chemicals:
  Dammam (Saudi Arabia)

Grain (wheat, corn, soybeans):
  Alexandria (Egypt), Bahia Blanca (Argentina), Constanta (Romania), Fremantle (Australia), Itaqui (Brazil), Montreal (Canada), New Orleans (USA), Novorossiysk (Russia), Paranagua (Brazil), Portland (OR) (USA), Rosario (Argentina)

Iron Ore:
  Chiba (Japan), Dalian (China), Dampier (Australia), IJmuiden (Netherlands), Iskenderun (Turkey), Kashima (Japan), Kwangyang (South Korea), Lianyungang (China), Mizushima (Japan), Ningbo-Zhoushan (China), Paradip (India), Pohang (South Korea), Ponta da Madeira (Brazil), Port Hedland (Australia), Qingdao (China), Rizhao (China), Saldanha Bay (South Africa), Tubarao (Vitoria) (Brazil), Visakhapatnam (India), Zhanjiang (China)

LNG (Liquefied Natural Gas):
  Ras Laffan (Qatar)

Ship Bunkering (fuel):
  Fujairah (UAE)

DETAILED PORT PROFILES (key ports):
- Hamburg (Germany): Major European hub. Imports: crude oil, coal, iron ore, containers. Exports: manufactured goods, chemicals, machinery. Best cargo INBOUND: coal from Richards Bay/Colombia, iron ore from Brazil.
- Rotterdam (Netherlands): Europe's largest port. Coal, iron ore, crude oil, containers, grain. Hub for Rhine river distribution.
- Singapore: World's largest transshipment hub and bunkering port. All cargo types.
- Shanghai/Ningbo (China): World's busiest port complex. Imports iron ore, coal, soybeans. Exports containers.
- Qingdao/Rizhao (China): Primary iron ore import terminals for Shandong steel mills.
- Dubai/Jebel Ali (UAE): Middle East container hub. Also cement, steel, vehicles.
- Houston (USA): Crude oil, refined products, chemicals, grain.
- Santos (Brazil): Latin America's largest. Soybeans, sugar, coffee, containers.
- Busan (South Korea): Major transshipment hub for Northeast Asia.
- Mumbai/JNPT (India): India's largest container port. Also coal, crude oil imports.

When asked about ANY port: check the list above, state the primary cargo, typical ship types used, and suggest the most profitable trade routes from/to that port based on current BDI.

When asked about specific routes or trade:
- Calculate voyage economics: fuel cost, duration, freight revenue, TCE
- Use current BDI to estimate rates
- Consider seasonal weather impacts`;
}

/* ── extract & execute SQL from AI response ── */
function executeSqlTags(text: string, db: ReturnType<typeof getDb>): string {
  const sqlRegex = /<SQL>([\s\S]*?)<\/SQL>/gi;
  let result = text;
  let match;

  while ((match = sqlRegex.exec(text)) !== null) {
    const sql = match[1].trim();
    // Security: only SELECT
    if (!/^SELECT/i.test(sql) || /INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH/i.test(sql)) {
      result = result.replace(match[0], "\n\n> Query blocked: only SELECT statements allowed.\n\n");
      continue;
    }
    try {
      const rows = db.prepare(sql).all();
      if (rows.length === 0) {
        result = result.replace(match[0], "\n\n*No results found.*\n\n");
      } else {
        // Format as markdown table
        const keys = Object.keys(rows[0] as any);
        const header = "| " + keys.join(" | ") + " |";
        const sep = "| " + keys.map(() => "---").join(" | ") + " |";
        const body = rows.slice(0, 50).map((r: any) =>
          "| " + keys.map(k => String(r[k] ?? "")).join(" | ") + " |"
        ).join("\n");
        const table = `\n\n${header}\n${sep}\n${body}` +
          (rows.length > 50 ? `\n\n*...and ${rows.length - 50} more rows*\n\n` : "\n\n");
        result = result.replace(match[0], table);
      }
    } catch (e: any) {
      result = result.replace(match[0], `\n\n> SQL Error: ${e.message}\n\n`);
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!rateOk(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 20 requests/minute." }), {
      status: 429, headers: { "Content-Type": "application/json" }
    });
  }

  const { messages } = await request.json();
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const apiKey = process.env.ZAI_API_KEY;
  const baseUrl = process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.ZAI_MODEL || "glm-4-plus";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const systemPrompt = buildSystemPrompt();

  /* ── First pass: ask AI (non-streaming) to get SQL, execute it, then stream final answer ── */
  // Step 1: Get initial response with potential SQL queries
  const firstRes = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt + "\n\nIMPORTANT: If you need data from the database, output your SQL queries wrapped in <SQL>...</SQL> tags. The system will execute them and you will see the results." },
        ...messages.slice(-10) // last 10 messages for context
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!firstRes.ok) {
    const err = await firstRes.text();
    return new Response(JSON.stringify({ error: "AI request failed", detail: err }), {
      status: 502, headers: { "Content-Type": "application/json" }
    });
  }

  const firstJson = await firstRes.json();
  const firstContent = firstJson.choices?.[0]?.message?.content || "";

  // Step 2: Execute any SQL tags
  const db = getDb();
  const hasSql = /<SQL>/i.test(firstContent);

  if (!hasSql) {
    // No SQL needed — stream the answer directly
    const streamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10)
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!streamRes.ok || !streamRes.body) {
      return new Response(JSON.stringify({ error: "Stream failed" }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(streamRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  }

  // Step 3: SQL was found — execute it and ask AI to summarize with real data
  const withResults = executeSqlTags(firstContent, db);

  const finalRes = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10),
        { role: "assistant", content: "I queried the database. Here are the results:" },
        { role: "user", content: `Based on these database query results, give a clear and helpful answer to the user's question. Use markdown formatting.\n\nQuery Results:\n${withResults}` }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!finalRes.ok || !finalRes.body) {
    // Fallback: return the raw results
    const encoder = new TextEncoder();
    const fallback = `data: ${JSON.stringify({ choices: [{ delta: { content: withResults } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(encoder.encode(fallback), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  }

  return new Response(finalRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
