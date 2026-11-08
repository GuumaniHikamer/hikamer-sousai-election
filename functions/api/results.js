const CS = [
  {"id":"chaimania","name":"ちゃいまに"},
  {"id":"cross_mania","name":"十字架_mania"},
  {"id":"all_mania","name":"all_mania"},
  {"id":"konmania","name":"こんまに"}
];

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare(
        "SELECT candidate_id, votes FROM runoff_vote_totals"
      )
      .all();

    const map = new Map(
      results.map(row => [row.candidate_id, row.votes])
    );

    return Response.json(
      {
        results: CS.map(c => ({
          ...c,
          votes: map.get(c.id) ?? 0
        }))
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      { error: "結果を取得できませんでした。" },
      { status: 500 }
    );
  }
}
