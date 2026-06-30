#!/usr/bin/env python3
"""Minimal sea route API using searoute library"""
import json, sys
import searoute as sr

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        try:
            fromLat = float(q["fromLat"][0])
            fromLon = float(q["fromLon"][0])
            toLat = float(q["toLat"][0])
            toLon = float(q["toLon"][0])
            
            route = sr.searoute([fromLon, fromLat], [toLon, toLat])
            coords = route["geometry"]["coordinates"]
            dist_km = route["properties"]["length"]
            
            # Convert from [lon,lat] to [lat,lon] for Leaflet
            points = [[c[1], c[0]] for c in coords]
            
            result = json.dumps({
                "points": points,
                "distanceKm": round(dist_km),
                "distanceNm": round(dist_km / 1.852),
                "numPoints": len(points),
            })
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(result.encode())
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        pass  # silent

if __name__ == "__main__":
    port = 8799
    print(f"Sea Route API on port {port}")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
