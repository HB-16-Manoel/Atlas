export async function GET() {
  try {
    const response = await fetch("https://api.github.com/repos/HB-16-Manoel/Atlas/commits/main", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("GitHub unavailable");
    const { sha, commit } = await response.json();
    if (typeof sha !== "string" || !/^[a-f0-9]{40}$/i.test(sha) ||
        typeof commit?.message !== "string" || !Number.isFinite(Date.parse(commit?.committer?.date))) {
      throw new Error("Unexpected commit response");
    }
    return Response.json({ sha, message: commit.message, date: commit.committer.date, branch: "main" }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ error: "GitHub is temporarily unavailable." }, { status: 503 });
  }
}
