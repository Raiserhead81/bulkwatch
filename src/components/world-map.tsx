"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { Ship } from "@/data/ships";
import { generateMockVoyage, getStatusColor, getStatusLabel } from "@/lib/mockVoyages";
import { estimatePrice, formatPrice, getRecommendationEmoji } from "@/lib/priceEstimator";
import { useI18n } from "@/lib/i18n";

interface WorldMapProps {
  ships: Ship[];
  height?: string;
}

export default function WorldMap({ ships, height = "600px" }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const { lang } = useI18n();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map once
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 8,
        worldCopyJump: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Custom ship marker icon
    const shipIcon = L.divIcon({
      className: "ship-marker",
      html: `<div style="
        width: 24px; height: 24px;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      "><span style="transform: rotate(45deg); font-size: 10px;">🚢</span></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });

    // Add markers for each ship
    for (const ship of ships) {
      const voyage = generateMockVoyage(ship);
      const pos = voyage.currentPosition;
      if (!pos || (pos.lat === 0 && pos.lon === 0)) continue;

      const price = estimatePrice(ship);
      const statusLabel = getStatusLabel(voyage.currentStatus);
      const recEmoji = getRecommendationEmoji(price.recommendation);
      const priceStr = formatPrice(price.estimatedValueUSD);
      const flag = ship.flag || "";

      const popupHtml = `
        <div style="min-width: 220px; font-family: system-ui, sans-serif;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${ship.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
            ${ship.type} · IMO: ${ship.imo} · ${flag}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>${lang === "de" ? "Status" : "Status"}:</strong> ${statusLabel}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>${lang === "de" ? "Route" : "Route"}:</strong> ${voyage.from.name} → ${voyage.to.name}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>${lang === "de" ? "Ladung" : "Cargo"}:</strong> ${voyage.cargoDescription}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>${lang === "de" ? "Geschätzer Wert" : "Est. Value"}:</strong> ${priceStr}
          </div>
          <div style="font-size: 11px; margin-bottom: 8px;">
            <strong>${lang === "de" ? "Empfehlung" : "Recommendation"}:</strong> ${recEmoji} ${price.recommendation}
          </div>
          <a href="/schiff/${ship.imo}" style="
            display: inline-block;
            background: #2563eb; color: white;
            padding: 4px 12px; border-radius: 6px;
            text-decoration: none; font-size: 12px; font-weight: 500;
          ">${lang === "de" ? "Details ansehen" : "View Details"}</a>
        </div>
      `;

      const marker = L.marker([pos.lat, pos.lon], { icon: shipIcon })
        .bindPopup(popupHtml)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    }

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [ships, lang]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden border border-blue-500/20 shadow-lg"
    />
  );
}
