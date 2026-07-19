import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/utils";

const API_URL = getApiUrl();

async function getToken(userId: string) {
  const jwtRes = await fetch(`${API_URL}/users/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!jwtRes.ok) return null;
  const { token } = await jwtRes.json();
  return token as string;
}

/** GET /api/bank-account — fetch the authenticated user's bank account */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const token = await getToken(session.user.id);
    if (!token) return NextResponse.json({ error: "Auth failed" }, { status: 500 });

    const res = await fetch(`${API_URL}/bank-accounts/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[api/bank-account GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/bank-account — save/update bank account details */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const token = await getToken(session.user.id);
    if (!token) return NextResponse.json({ error: "Auth failed" }, { status: 500 });

    const body = await req.json();
    const res = await fetch(`${API_URL}/bank-accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[api/bank-account POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/bank-account — remove the user's bank account */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const token = await getToken(session.user.id);
    if (!token) return NextResponse.json({ error: "Auth failed" }, { status: 500 });

    const res = await fetch(`${API_URL}/bank-accounts/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[api/bank-account DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
