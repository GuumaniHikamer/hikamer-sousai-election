
const IDS = [
  "all_mania",
  "death_oyster",
  "cocacola_fridge",
  "chaimania",
  "mugcup_mania",
  "nyn_aniki2",
  "tsuru_mania",
  "shigaraki_kun",
  "konmania",
  "gunmania",
  "bun_sushi",
  "phony_mania",
  "cross_mania",
  "kohachi_mania"
];

const START = Date.parse("2026-10-31T15:00:00Z");
const END = Date.parse("2026-11-07T15:00:00Z");

export async function onRequestPost({ request, env }) {
  try {
    // 投票期間の確認（日本時間 11/1 00:00 ～ 11/8 00:00）
    const now = Date.now();

    if (now < START || now >= END) {
      return Response.json(
        { error: "現在は投票期間外です。" },
        { status: 403 }
      );
    }

    const b = await request.json();
    const id = String(b?.candidateId || "");

    if (!IDS.includes(id)) {
      return Response.json(
        { error: "候補者を選択してください。" },
        { status: 400 }
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

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const hash = await hmac(env.IP_HASH_SECRET, day + ":" + ip);

   const results = await env.DB.batch([
  env.DB.prepare(
    "INSERT OR IGNORE INTO daily_votes(vote_day, ip_hash, candidate_id) VALUES(?,?,?)"
  ).bind(day, hash, id),

  env.DB.prepare(
    "UPDATE vote_totals SET votes = votes + 1 WHERE candidate_id = ? AND changes() > 0"
  ).bind(id)
]);

if (!results[0].meta.changes) {
  return Response.json(
    { error: "今日は投票済みです。また明日投票できます。" },
    { status: 409 }
  );
}

    return Response.json({ message: "投票を受け付けました。" });
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
