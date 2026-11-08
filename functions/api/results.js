const CANDIDATES = [
  { id: "chaimania", name: "ちゃいまに" },
  { id: "cross_mania", name: "十字架_mania" },
  { id: "all_mania", name: "all_mania" },
  { id: "konmania", name: "こんまに" }
];

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "サーバー設定が未完了です。" },
        { status: 500 }
      );
    }

    const { results = [] } = await env.DB.prepare(`
      SELECT
        candidate_id,
        COUNT(*) AS votes
      FROM (
        SELECT candidate_id_1 AS candidate_id
        FROM runoff_votes_v2

        UNION ALL

        SELECT candidate_id_2 AS candidate_id
        FROM runoff_votes_v2
      )
      GROUP BY candidate_id
    `).all();

    const counts = Object.fromEntries(
      results.map(r => [
        r.candidate_id,
        Number(r.votes) || 0
      ])
    );

    return Response.json(
      {
        results: CANDIDATES.map(c => ({
          id: c.id,
          name: c.name,
          votes: counts[c.id] || 0
        }))
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (e) {
    console.error(e);

    return Response.json(
      { error: "集計結果の取得に失敗しました。" },
      { status: 500 }
    );
  }
}
