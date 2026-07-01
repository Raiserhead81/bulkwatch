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
  const avgAge = db.prepare("SELECT ROUND(AVG(2026 - year_built),1) as a FROM ships WHERE year_built > 1900").get() as any;
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

  // Read live commodity prices
  let commodityInfo = "";
  try {
    const fs = require("fs");
    const raw = fs.readFileSync("/opt/bulkwatch/db/commodities.json", "utf8");
    const commodities = JSON.parse(raw);
    const items = Object.entries(commodities)
      .filter(([k, v]: [string, any]) => k !== "date" && v.price > 0)
      .map(([k, v]: [string, any]) => `  ${v.name}: ${v.price} ${v.unit}`)
      .join("\n");
    commodityInfo = `\nLIVE COMMODITY PRICES (updated ${commodities.date}):\n${items}\n\nUse these prices when calculating cargo values, voyage profitability, or answering commodity questions.\nIron ore at $100/ton means a Capesize (170k tons) carries ~$17M worth of cargo per voyage.\nCoal at $143/ton means a Panamax (70k tons) carries ~$10M worth of cargo.`;
  } catch {}

  const topOperators = db.prepare("SELECT operator, COUNT(*) as c FROM ships WHERE operator IS NOT NULL AND operator != '' GROUP BY operator ORDER BY c DESC LIMIT 10").all() as any[];

  const typeList = typeCounts.map((r: any) => `  ${r.type}: ${r.c}`).join("\n");
  const flagList = flagCounts.map((r: any) => `  ${r.flag}: ${r.c}`).join("\n");
  const opList = topOperators.map((r: any) => `  ${r.operator}: ${r.c}`).join("\n");
  const bdi = latestBDI?.bdi || "N/A";

  return `You are the Maritime AI AI Assistant — a maritime intelligence expert.
You have access to live market data.

` + (() => {
  try {
    const fs = require("fs");
    const comm = JSON.parse(fs.readFileSync("/opt/bulkwatch/db/commodities.json", "utf8"));
    const opex = JSON.parse(fs.readFileSync("/opt/bulkwatch/db/opex_rates.json", "utf8"));
    let info = "Live market data (updated " + (comm.date || opex.date) + "):\n";
    for (const [k,v] of Object.entries(comm)) {
      if (k === "date") continue;
      const val = v as any;
      if (val?.name) info += "- " + val.name + ": " + val.price + " " + val.unit + "\n";
    }
    info += "\nShipping market:\n";
    info += "- BDI: " + opex.bdiIndex + "\n";
    info += "- Bunker VLSFO: $" + opex.bunkerVLSFO + "/ton\n";
    info += "- Bunker MGO: $" + opex.bunkerMGO + "/ton\n";
    info += "- Scrap: $" + opex.scrapPriceLDT + "/LDT\n";
    const cr = opex.charterRates || {};
    info += "- TC: Handy $" + (cr.handysize||0) + "/d, Supra $" + (cr.supramax||0) + "/d, Pana $" + (cr.panamax||0) + "/d, Cape $" + (cr.capesize||0) + "/d\n";
    return info;
  } catch { return "Market data unavailable"; }
})() + `

You also have access to a live SQLite database with ${totalShips} ships.

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
${commodityInfo}

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
- CRITICAL: year_built = 0 means UNKNOWN, NOT year zero!
- For average age use: AVG(CASE WHEN year_built > 1900 AND year_built <= 2026 THEN 2026 - year_built END) — this ignores unknowns AND newbuilds
- If the result is NULL or negative, display "N/A" in the output
- IMPORTANT: if less than 30% of ships have year_built > 1900, show "N/A" or "insufficient data" for average age, NOT the average of the few known ones
- Use this SQL pattern: CASE WHEN SUM(CASE WHEN year_built > 1900 THEN 1 ELSE 0 END) * 100 / COUNT(*) >= 30 THEN ROUND(AVG(CASE WHEN year_built > 1900 THEN 2026 - year_built END),1) ELSE NULL END as avg_age
- When avg_age is NULL, display "N/A" in the table
- For fleet rankings: COUNT ALL ships per operator (don't filter by year_built!)
- For total DWT: SUM ALL dwt per operator (don't filter by year_built!)
- Only filter year_built > 1900 when calculating AGE, never when counting ships or summing DWT
- NEVER start with "I apologize" or "Let me try again" — just answer directly.
- Use these TESTED queries for common questions:

FLEET RANKING (copy exactly):
  SELECT operator, COUNT(*) as ships, SUM(dwt) as total_dwt,
    ROUND(AVG(CASE WHEN year_built > 1900 AND year_built <= 2026 THEN 2026 - year_built END), 1) as avg_age
  FROM ships WHERE operator IS NOT NULL AND operator != ''
  GROUP BY operator ORDER BY SUM(dwt) DESC LIMIT 10

TOP VALUABLE SHIPS (copy exactly):
  SELECT s.name, s.imo, s.type, s.dwt, s.year_built, s.operator, s.flag, p.estimated_value, p.recommendation
  FROM ships s JOIN price_history p ON s.imo = p.imo
  WHERE p.date = (SELECT MAX(date) FROM price_history)
  ORDER BY p.estimated_value DESC LIMIT 10

FLEET VALUE PER OPERATOR (copy exactly):
  SELECT s.operator, COUNT(*) as ships, SUM(s.dwt) as total_dwt, SUM(p.estimated_value) as fleet_value
  FROM ships s JOIN price_history p ON s.imo = p.imo
  WHERE p.date = (SELECT MAX(date) FROM price_history)
  AND s.operator IS NOT NULL AND s.operator != ''
  GROUP BY s.operator ORDER BY fleet_value DESC LIMIT 10

- Example fleet query:
  SELECT operator, COUNT(*) as ships, SUM(dwt) as total_dwt,
    ROUND(AVG(CASE WHEN year_built > 1900 THEN 2026 - year_built END), 1) as avg_age
  FROM ships WHERE operator IS NOT NULL AND operator != ''
  GROUP BY operator ORDER BY COUNT(*) DESC LIMIT 20
- Never show ages > 50 years — that means data is missing
- For fleet value: query price_history for each ship's latest estimated_value and SUM them. Example: SELECT SUM(p.estimated_value) FROM ships s JOIN price_history p ON s.imo = p.imo WHERE p.date = (SELECT MAX(date) FROM price_history) AND s.operator = ?
- For individual ship valuations, query price_history: SELECT estimated_value, recommendation FROM price_history WHERE imo = ? ORDER BY date DESC LIMIT 1
- For top valuable ships: SELECT s.name, s.imo, s.type, s.dwt, s.year_built, s.operator, p.estimated_value, p.recommendation FROM ships s JOIN price_history p ON s.imo = p.imo WHERE p.date = (SELECT MAX(date) FROM price_history) ORDER BY p.estimated_value DESC LIMIT 10
- NEVER output NULL or N/A for ship names — the name column always has data
- NEVER fabricate SQL with fake data (VALUES, UNION ALL with made-up numbers) — only query real tables: ships, price_history, operators
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
- ALWAYS format data in markdown tables — never plain text lists for structured data.
- Every answer with numbers MUST include at least one markdown table.
- After the main table, add a Key Metrics line and a 3-5 sentence analysis with market context.
- Include relevant comparisons, trends, and actionable insights.
- Use multiple tables if the data warrants it (e.g. fleet table + value per ship table).
- Balance: enough detail to be useful, but structured in tables not walls of text.
- Keep analysis to 3-4 sentences MAX after the table. No essays.
- NEVER fabricate data — if you don't have it, say "data not available" in the table cell.
- For cargo/route questions without real DB data, use your knowledge but clearly state it's an estimate.
- Always show ship names and IMOs in tables — never N/A for names.
- For financial/profit questions, include ASCII bar charts like:
  ████████████ $23,550/day (Capesize)
  ████████     $13,649/day (Kamsarmax)
  ██████       $8,577/day  (Handysize)
- When comparing values, use tables with columns and show % differences.
- For profit calculations, show a clear breakdown table:
  | Item | Value |
  |------|-------|
  | Revenue | $2,890,000 |
  | Fuel Cost | -$693,000 |
  | Port Costs | -$60,000 |
  | **Net Profit** | **$2,137,000** |
- For ship lists, ALWAYS include: Name, IMO, Type, DWT, Age, Est. Value, Recommendation.
- Use emoji for visual indicators: 🟢 Buy, 👀 Watch, ⛔ Avoid, ↑ up, ↓ down.
- For trends, use arrow indicators: ▲ +5.2% or ▼ -3.1%
- When showing multiple metrics, use a summary box at the top:
  **Key Metrics:** BDI 2,524 ▲ | Iron Ore $100/t ▼ | VLSFO $590/t | Capesize TCE $23,550/day
- For route economics, always show: Distance, Days, Fuel, Revenue, Profit, TCE, Break-Even Rate.
- Round dollar values to nearest thousand. Show DWT with comma separators.
- End complex answers with a brief **Verdict** or **Bottom Line** summary.
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

  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const useAnthropic = !!anthropicKey;
  const zaiKey = process.env.ZAI_API_KEY || "";
  const zaiBase = process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const zaiModel = process.env.ZAI_MODEL || "glm-4-plus";

  if (!anthropicKey && !zaiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  // Helper: call AI (non-streaming)
  async function aiCall(sys: string, msgs: {role:string,content:string}[]): Promise<string> {
    if (useAnthropic) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", system: sys, messages: msgs, max_tokens: 2000, temperature: 0.7 })
      });
      const j = await r.json();
      return j.content?.[0]?.text || "";
    }
    const r = await fetch(`${zaiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${zaiKey}` },
      body: JSON.stringify({ model: zaiModel, messages: [{ role: "system", content: sys }, ...msgs], stream: false, temperature: 0.7, max_tokens: 2000 })
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content || "";
  }

  // Helper: call AI (streaming) — returns Response with SSE
  async function aiStream(sys: string, msgs: {role:string,content:string}[]): Promise<Response> {
    if (useAnthropic) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", system: sys, messages: msgs, stream: true, max_tokens: 2000, temperature: 0.7 })
      });
      // Transform Anthropic SSE to OpenAI-compatible format
      const reader = r.body!.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const dec = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.enqueue(enc.encode("data: [DONE]\n\n")); controller.close(); break; }
            const chunk = dec.decode(value);
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const d = line.slice(6).trim();
              if (!d) continue;
              try {
                const j = JSON.parse(d);
                if (j.type === "content_block_delta" && j.delta?.text) {
                  controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: j.delta.text } }] })}\n\n`));
                } else if (j.type === "message_stop") {
                  controller.enqueue(enc.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }
              } catch {}
            }
          }
        }
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
    }
    // ZAI fallback
    const r = await fetch(`${zaiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${zaiKey}` },
      body: JSON.stringify({ model: zaiModel, messages: [{ role: "system", content: sys }, ...msgs], stream: true, temperature: 0.7, max_tokens: 2000 })
    });
    return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  }

  const systemPrompt = buildSystemPrompt();

  /* ── Single pass: stream response, detect SQL, execute, continue ── */
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const needsData = /how many|list|show|find|count|which|what.*ship|fleet|operator|arklow|oldendorff|cape|panamax|tanker|average|total|flag|builder/i.test(lastMsg);
  
  if (needsData) {
    // Likely needs SQL — do quick non-streaming call, then stream results
    const firstContent = await aiCall(
      systemPrompt + "\n\nIMPORTANT: If you need data, output SQL wrapped in <SQL>...</SQL> tags. Be concise.",
      messages.slice(-6)
    );
    
    const db = getDb();
    if (/<SQL>/i.test(firstContent)) {
      const withResults = executeSqlTags(firstContent, db);
      return aiStream(systemPrompt, [
        ...messages.slice(-6),
        { role: "assistant", content: "I queried the database." },
        { role: "user", content: "Present these results clearly with markdown. NEVER show SQL.\n\n" + withResults }
      ]);
    }
    // No SQL needed after all — just stream it
    return aiStream(systemPrompt, messages.slice(-6));
  }
  
  // General question — direct streaming, no SQL check needed
  return aiStream(systemPrompt, messages.slice(-8));
}
