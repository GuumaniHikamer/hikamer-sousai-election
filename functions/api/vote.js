const IDS = [
  "chaimania",
  "cross_mania",
  "all_mania",
  "konmania"
];

const END = Date.parse("2026-11-08T15:00:00Z");

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();

    const ids = Array.isArray(b?.candidateIds)
      ? [...new Set(b.candidateIds.map(String))]
      : [];

    const token = String(b?.turnstileToken || "");

    if (
      ids.length !== 2 ||
      ids.some(id => !IDS.includes(id))
    ) {
      return Response.json(
        { error: "2人を選択してください。" },
        { status: 400 }
      );
    }

    if (!token || token.length > 2048) {
      return Response.json(
        { error: "セキュリティ検証を完了してください。" },
        { status: 403 }
      );
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      return Response.json(
        { error: "セキュリティ設定が未完了です。" },
        { status: 500 }
      );
    }

    const ip = request.headers.get("CF-Connecting-IP");

    const verification = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: ip || undefined
        })
      }
    );

    if (!verification.ok) {
      throw new Error("Turnstile verification service unavailable");
    }

    const verificationResult = await verification.json();

    if (!verificationResult.success) {
      return Response.json(
        { error: "セキュリティ検証に失敗しました。再度お試しください。" },
        { status: 403 }
      );
    }

    const now = Date.now();

    if (now >= END) {
      return Response.json(
        { error: "決選投票は終了しました。" },
        { status: 403 }
      );
    }

    if (!env.DB || !env.IP_HASH_SECRET) {
      return Response.json(
        { error: "サーバー設定が未完了です。" },
        { status: 500 }
      );
    }

    if (!ip) {
      return Response.json(
        { error: "接続情報を確認できません。" },
        { status: 400 }
      );
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const dateParts = Object.fromEntries(
      parts
        .filter(p => p.type !== "literal")
        .map(p => [p.type, p.value])
    );

    const day =
      `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

    const hash = await hmac(
      env.IP_HASH_SECRET,
      day + ":" + ip
    );

    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO runoff_daily_votes (vote_day, ip_hash) VALUES (?, ?)"
      ).bind(day, hash),

      env.DB.prepare(
        "UPDATE runoff_vote_totals SET votes = votes + 1 WHERE candidate_id = ?"
      ).bind(ids[0]),

      env.DB.prepare(
        "UPDATE runoff_vote_totals SET votes = votes + 1 WHERE candidate_id = ?"
      ).bind(ids[1])
    ]);

    if (!results[0].meta.changes) {
      return Response.json(
        { error: "今日は投票済みです。また明日投票できます。" },
        { status: 409 }
      );
    }

    if (
      !results[1].meta.changes ||
      !results[2].meta.changes
    ) {
      throw new Error("決選集計先が見つかりません。");
    }

    return Response.json({
      message: "決選投票を受け付けました。"
    });

  } catch {
    return Response.json(
      { error: "投票処理中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

async function hmac(s, v) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(s),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const x = await crypto.subtle.sign(
    "HMAC",
    k,
    new TextEncoder().encode(v)
  );

  return [...new Uint8Array(x)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
