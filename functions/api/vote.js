const IDS = [
  "chaimania",
  "cross_mania",
  "all_mania",
  "konmania"
];

// 2026-11-15 00:00 JST
// = 11/14 23:59 まで投票可能
const END = Date.parse("2026-11-14T15:00:00Z");

// 動作確認が終わるまでは閉鎖
const VOTING_OPEN = true;

export async function onRequestPost({ request, env }) {
  try {
    if (!VOTING_OPEN) {
      return Response.json(
        { error: "現在、決選投票を一時停止しています。" },
        { status: 503 }
      );
    }

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

    if (!env.DB || !env.IP_HASH_SECRET) {
      return Response.json(
        { error: "サーバー設定が未完了です。" },
        { status: 500 }
      );
    }

    const ip = request.headers.get("CF-Connecting-IP");

    if (!ip) {
      return Response.json(
        { error: "接続情報を確認できません。" },
        { status: 400 }
      );
    }

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
          remoteip: ip
        })
      }
    );

    if (!verification.ok) {
      throw new Error("Turnstile verification service unavailable");
    }

    const verificationResult = await verification.json();

    if (
  !verificationResult.success ||
  verificationResult.hostname !== "hikamer-sousai-election.pages.dev"
) {
  return Response.json(
    { error: "セキュリティ検証に失敗しました。再度お試しください。" },
    { status: 403 }
  );
}

    if (Date.now() >= END) {
      return Response.json(
        { error: "決選投票は終了しました。" },
        { status: 403 }
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

    const result = await env.DB.prepare(`
      INSERT INTO runoff_votes_v2 (
        vote_day,
        ip_hash,
        candidate_id_1,
        candidate_id_2
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(vote_day, ip_hash) DO NOTHING
    `)
      .bind(day, hash, ids[0], ids[1])
      .run();

    if (!result.meta.changes) {
      return Response.json(
        { error: "今日は投票済みです。また明日投票できます。" },
        { status: 409 }
      );
    }

    return Response.json({
      message: "決選投票を受け付けました。"
    });

  } catch (e) {
    console.error(e);

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
