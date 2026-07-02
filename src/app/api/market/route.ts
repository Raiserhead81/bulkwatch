import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const opexPath = join(process.cwd(), "db", "opex_rates.json");
    const commPath = join(process.cwd(), "db", "commodities.json");
    
    const opex = existsSync(opexPath) ? JSON.parse(readFileSync(opexPath, "utf8")) : {};
    const comm = existsSync(commPath) ? JSON.parse(readFileSync(commPath, "utf8")) : {};
    
    return NextResponse.json({
      date: opex.date || comm.date,
      bdi: opex.bdiIndex || 2490,
      bunkerVLSFO: opex.bunkerVLSFO || 533,
      bunkerHSFO: opex.bunkerHSFO || 391,
      bunkerMGO: opex.bunkerMGO || 746,
      scrapLDT: opex.scrapPriceLDT || 478,
      charterRates: opex.charterRates || {},
      bunkerByPort: opex.bunkerByPort || {},
      provisionsByRegion: opex.provisionsByRegion || {},
      commodities: comm,
    });
  } catch {
    return NextResponse.json({ bdi: 2490 });
  }
}
