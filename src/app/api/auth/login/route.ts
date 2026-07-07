import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { signSession } from "@/lib/session";

const DB_PATH = process.env.DB_PATH || "/opt/bulkwatch/db/ships.db";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password required" }, { status: 400 });
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });
    const user = db.prepare("SELECT id, username, password_hash, company, role FROM users WHERE username = ?").get(username) as {
      id: number; username: string; password_hash: string; company: string; role: string;
    } | undefined;
    db.close();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Update last_login
    const db2 = new Database(DB_PATH);
    db2.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    db2.close();

    const sessionData = { id: user.id, username: user.username, company: user.company, role: user.role };
    const signedCookie = signSession(sessionData);

    const res = NextResponse.json({ ok: true, user: { username: user.username, company: user.company, role: user.role } });
    res.cookies.set("vessel_session", signedCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ ok: false, error: "Login failed" }, { status: 500 });
  }
}
