export interface Ship {
  id: string;
  name: string;
  imo: string;
  mmsi?: string;
  type: BulkCarrierType;
  dwt: number;
  length: number;
  beam: number;
  draft: number;
  yearBuilt: number;
  builder?: string;
  flag: string;
  operator?: string;
  homePort?: string;
  imageUrl?: string;
  imageAttribution?: string;
  position?: { lat: number; lon: number };
  lastSeen?: number;
  status: "active" | "laid_up" | "scrapped" | "lost";
}

export type BulkCarrierType =
  | "Capesize" | "Newcastlemax" | "VLOC" | "Valemax"
  | "Panamax" | "Post-Panamax" | "Kamsarmax"
  | "Ultramax" | "Supramax"
  | "Handymax" | "Handysize" | "Mini-Bulker"
  | "Gearless" | "Geared"
  | "General Cargo" | "Bulk Carrier"
  | "Container Ship" | "Tanker"
  | "Crude Oil Tanker" | "Product Tanker" | "Chemical Tanker"
  | "LNG Tanker" | "LPG Tanker" | "Oil/Chemical Tanker"
  | "RoRo" | "Car Carrier" | "Reefer"
  | "Passenger" | "Ferry"
  | "Offshore" | "Tug" | "Other";

export const SHIP_TYPES: BulkCarrierType[] = [
  "Capesize", "Newcastlemax", "VLOC", "Valemax",
  "Kamsarmax", "Panamax", "Post-Panamax",
  "Ultramax", "Supramax", "Handymax", "Handysize", "Mini-Bulker",
  "Geared", "Gearless", "Bulk Carrier",
  "General Cargo", "Container Ship", "Reefer",
  "Tanker", "Crude Oil Tanker", "Product Tanker", "Chemical Tanker",
  "LNG Tanker", "LPG Tanker", "Oil/Chemical Tanker",
  "RoRo", "Car Carrier", "Passenger", "Ferry",
  "Offshore", "Tug", "Other",
];