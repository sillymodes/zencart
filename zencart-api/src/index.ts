import {
  getRecommendations,
  lookupFromMatrix,
  type QuizAnswers,
  type Recommendation,
  type MatrixEntry,
} from "./recommendations";

export interface Env {
  DB: D1Database;
  AMAZON_TRACKING_ID: string;
  BMC_URL: string;
  ALLOWED_ORIGIN: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":
      env.ALLOWED_ORIGIN || "https://sillymodes.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(
  body: unknown,
  env: Env,
  status = 200
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(env),
  });
}

function errorResponse(
  message: string,
  env: Env,
  status = 400
): Response {
  return jsonResponse({ error: message }, env, status);
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

// ── Recommendation resolver (D1 matrix → fallback to hardcoded) ─────────────

async function resolveRecommendations(
  db: D1Database,
  answers: QuizAnswers
): Promise<Recommendation[]> {
  try {
    const row = await db
      .prepare("SELECT value FROM zencart_config WHERE key = ?")
      .bind("recommendation_matrix")
      .first<{ value: string }>();

    if (row?.value) {
      const matrix: MatrixEntry[] = JSON.parse(row.value);
      const fromMatrix = lookupFromMatrix(matrix, answers);
      if (fromMatrix && fromMatrix.length > 0) {
        return fromMatrix;
      }
    }
  } catch {
    // D1 lookup failed — fall through to hardcoded logic
  }

  // Fallback: use the hardcoded blending algorithm
  return getRecommendations(answers);
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleSubmitQuiz(
  request: Request,
  env: Env
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", env);
  }

  const requiredFields = [
    "pet_choice",
    "color_choice",
    "gender",
    "age_group",
    "stress_source",
    "budget_tier",
  ] as const;

  for (const field of requiredFields) {
    if (
      !body[field] ||
      typeof body[field] !== "string" ||
      (body[field] as string).trim() === ""
    ) {
      return errorResponse(`Missing or invalid field: ${field}`, env);
    }
  }

  const answers: QuizAnswers = {
    pet_choice: (body.pet_choice as string).trim(),
    color_choice: (body.color_choice as string).trim(),
    gender: (body.gender as string).trim(),
    age_group: (body.age_group as string).trim(),
    stress_source: (body.stress_source as string).trim(),
    budget_tier: (body.budget_tier as string).trim(),
  };

  const sessionId = generateSessionId();
  const recommendations = await resolveRecommendations(env.DB, answers);
  const keywordsShown = JSON.stringify(recommendations);

  await env.DB.prepare(
    `INSERT INTO zencart_quiz_submissions
       (session_id, pet_choice, color_choice, gender, age_group, stress_source, budget_tier, keywords_shown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sessionId,
      answers.pet_choice,
      answers.color_choice,
      answers.gender,
      answers.age_group,
      answers.stress_source,
      answers.budget_tier,
      keywordsShown
    )
    .run();

  return jsonResponse(
    {
      session_id: sessionId,
      recommendations,
    },
    env
  );
}

async function handleGetRecommendations(
  url: URL,
  env: Env
): Promise<Response> {
  const sessionId = url.searchParams.get("session");
  if (!sessionId || sessionId.trim() === "") {
    return errorResponse("Missing session parameter", env);
  }

  const row = await env.DB.prepare(
    "SELECT keywords_shown FROM zencart_quiz_submissions WHERE session_id = ?"
  )
    .bind(sessionId.trim())
    .first<{ keywords_shown: string }>();

  if (!row) {
    return errorResponse("Session not found", env, 404);
  }

  let recommendations: Recommendation[];
  try {
    recommendations = JSON.parse(row.keywords_shown);
  } catch {
    return errorResponse("Corrupted recommendation data", env, 500);
  }

  return jsonResponse({ session_id: sessionId, recommendations }, env);
}

async function handlePostReview(
  request: Request,
  env: Env
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", env);
  }

  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return errorResponse("stars must be an integer between 1 and 5", env);
  }

  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 280) : null;
  const displayName =
    typeof body.display_name === "string"
      ? body.display_name.trim().slice(0, 50)
      : null;
  const sessionId =
    typeof body.session_id === "string" ? body.session_id.trim() : null;

  await env.DB.prepare(
    `INSERT INTO zencart_reviews (session_id, stars, comment, display_name)
     VALUES (?, ?, ?, ?)`
  )
    .bind(sessionId, stars, comment, displayName)
    .run();

  return jsonResponse({ success: true }, env, 201);
}

async function handleGetReviews(url: URL, env: Env): Promise<Response> {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const { results } = await env.DB.prepare(
    `SELECT id, stars, comment, display_name, created_at
     FROM zencart_reviews
     WHERE approved = 1
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(perPage, offset)
    .all<{
      id: number;
      stars: number;
      comment: string | null;
      display_name: string | null;
      created_at: number;
    }>();

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as total FROM zencart_reviews WHERE approved = 1"
  ).first<{ total: number }>();

  const total = countRow?.total ?? 0;

  return jsonResponse(
    {
      reviews: results ?? [],
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
    env
  );
}

async function handlePostPageview(
  request: Request,
  env: Env
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", env);
  }

  const page =
    typeof body.page === "string" ? body.page.trim().slice(0, 200) : null;
  if (!page) {
    return errorResponse("Missing or invalid field: page", env);
  }

  const referrer =
    typeof body.referrer === "string"
      ? body.referrer.trim().slice(0, 500)
      : null;

  await env.DB.prepare(
    "INSERT INTO zencart_page_views (page, referrer) VALUES (?, ?)"
  )
    .bind(page, referrer)
    .run();

  return jsonResponse({ success: true }, env, 201);
}

async function handleGetStats(env: Env): Promise<Response> {
  // Run all stat queries in parallel via D1 batch
  const stmts = [
    // 0: total quizzes all time
    env.DB.prepare(
      "SELECT COUNT(*) as count FROM zencart_quiz_submissions"
    ),
    // 1: total quizzes this month
    env.DB.prepare(
      `SELECT COUNT(*) as count FROM zencart_quiz_submissions
       WHERE created_at >= unixepoch('now', 'start of month')`
    ),
    // 2: top stress source
    env.DB.prepare(
      `SELECT stress_source, COUNT(*) as count
       FROM zencart_quiz_submissions
       GROUP BY stress_source
       ORDER BY count DESC
       LIMIT 1`
    ),
    // 3: avg review stars
    env.DB.prepare(
      "SELECT AVG(stars) as avg_stars FROM zencart_reviews WHERE approved = 1"
    ),
    // 4: most recommended category (most common first keyword from keywords_shown)
    env.DB.prepare(
      `SELECT stress_source as category, COUNT(*) as count
       FROM zencart_quiz_submissions
       GROUP BY stress_source
       ORDER BY count DESC
       LIMIT 5`
    ),
    // 5: page views last 30 days
    env.DB.prepare(
      `SELECT COUNT(*) as count FROM zencart_page_views
       WHERE created_at >= unixepoch('now', '-30 days')`
    ),
  ];

  const batchResults = await env.DB.batch(stmts);

  const totalQuizzes =
    (batchResults[0].results?.[0] as Record<string, unknown>)?.count ?? 0;
  const quizzesThisMonth =
    (batchResults[1].results?.[0] as Record<string, unknown>)?.count ?? 0;

  const topStressRow = batchResults[2].results?.[0] as Record<
    string,
    unknown
  > | undefined;
  const topStressSource = topStressRow?.stress_source ?? null;

  const avgRow = batchResults[3].results?.[0] as Record<
    string,
    unknown
  > | undefined;
  const avgStars = avgRow?.avg_stars != null
    ? Math.round((avgRow.avg_stars as number) * 10) / 10
    : null;

  // Stress source distribution for bar chart
  const stressDistribution = (
    (batchResults[4].results ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    category: r.category ?? r.stress_source,
    count: r.count,
  }));

  const pageViews30d =
    (batchResults[5].results?.[0] as Record<string, unknown>)?.count ?? 0;

  return jsonResponse(
    {
      total_quizzes: totalQuizzes,
      quizzes_this_month: quizzesThisMonth,
      top_stress_source: topStressSource,
      avg_review_stars: avgStars,
      stress_distribution: stressDistribution,
      page_views_last_30_days: pageViews30d,
    },
    env
  );
}

// ── Main router ──────────────────────────────────────────────────────────────

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // Handle CORS preflight for all routes
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      // GET /health
      if (path === "/health" && method === "GET") {
        return jsonResponse({ ok: true }, env);
      }

      // POST /submit-quiz
      if (path === "/submit-quiz" && method === "POST") {
        return await handleSubmitQuiz(request, env);
      }

      // GET /recommendations
      if (path === "/recommendations" && method === "GET") {
        return await handleGetRecommendations(url, env);
      }

      // POST /review
      if (path === "/review" && method === "POST") {
        return await handlePostReview(request, env);
      }

      // GET /reviews
      if (path === "/reviews" && method === "GET") {
        return await handleGetReviews(url, env);
      }

      // POST /pageview
      if (path === "/pageview" && method === "POST") {
        return await handlePostPageview(request, env);
      }

      // GET /stats
      if (path === "/stats" && method === "GET") {
        return await handleGetStats(env);
      }

      return errorResponse("Not found", env, 404);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      return errorResponse(message, env, 500);
    }
  },
} satisfies ExportedHandler<Env>;
