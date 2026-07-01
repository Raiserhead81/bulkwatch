import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const DB_PATH = process.env.DB_PATH || "/opt/bulkwatch/db/ships.db";

function getUser(req: NextRequest) {
  const session = req.cookies.get("vessel_session")?.value;
  if (!session || session === "authenticated") return { role: "admin" }; // legacy
  try { return JSON.parse(session); } catch { return null; }
}

// GET: list users (admin only)
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = new Database(DB_PATH, { readonly: true });
  const users = db.prepare("SELECT id, username, company, role, created_at, last_login FROM users ORDER BY username").all();
  db.close();
  return NextResponse.json({ users });
}

// POST: create user (admin only)
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { username, password, company, role } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const db = new Database(DB_PATH);
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) {
    db.close();
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO users (username, password_hash, company, role) VALUES (?, ?, ?, ?)").run(
    username, hash, company || "", role || "user"
  );
  db.close();

  return NextResponse.json({ ok: true, username });
}

// PATCH: update user password, company, or role
export async function PATCH(req: NextRequest) {
  const currentUser = getUser(req);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, company, role } = await req.json();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  // Regular users can only change their own password
  if (currentUser.role !== "admin") {
    if (currentUser.username !== username) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (company !== undefined || role !== undefined) {
      return NextResponse.json({ error: "Only admins can change company or role" }, { status: 403 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
  }

  const db = new Database(DB_PATH);
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (!exists) {
    db.close();
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, username);
  }
  if (company !== undefined) {
    db.prepare("UPDATE users SET company = ? WHERE username = ?").run(company, username);
  }
  if (role !== undefined) {
    db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
  }

  db.close();
  return NextResponse.json({ ok: true });
}

// DELETE: delete user (admin only)
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { username } = await req.json();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const db = new Database(DB_PATH);
  db.prepare("DELETE FROM users WHERE username = ?").run(username);
  db.close();

  return NextResponse.json({ ok: true });
}
