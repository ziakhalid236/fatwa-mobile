import { Router, type Request, type Response } from "express";
import { contentStore, type FatwaCategory } from "../content-store";

const router = Router();
const categories: FatwaCategory[] = ["Aqeedah", "Namaz", "Roza", "Zakat", "Hajj & Umrah", "Nikah & Family", "Muamalat", "Tafseer & Quran"];

function adminOnly(req: Request, res: Response, next: () => void) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) {
    if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "ADMIN_TOKEN is not configured" });
    return next();
  }
  const token = req.header("x-admin-token") ?? req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== configured) return res.status(401).json({ error: "Admin authentication required" });
  return next();
}

function validCategory(category: unknown): category is FatwaCategory {
  return typeof category === "string" && categories.includes(category as FatwaCategory);
}

async function agentRequest(path: string, options: RequestInit = {}) {
  const base = (process.env.FATWA_AGENT_URL ?? "https://blacksite-field-ops.ziakhalid236.workers.dev").replace(/\/$/, "");
  const token = process.env.FATWA_AGENT_ADMIN_TOKEN;
  if (!token) throw new Error("FATWA_AGENT_ADMIN_TOKEN is not configured");
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-agent-token": token, ...(options.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(body?.error ?? `Fatwa agent request failed (${response.status})`), { status: response.status });
  return body;
}

router.get("/fatwas", async (req, res) => {
  const fatwas = await contentStore.listFatwas(String(req.query.search ?? ""), String(req.query.category ?? ""));
  res.json({ fatwas });
});

router.get("/fatwas/:id", async (req, res) => {
  const fatwa = await contentStore.getFatwa(req.params.id);
  if (!fatwa || fatwa.status !== "published") return res.status(404).json({ error: "Fatwa not found" });
  return res.json(fatwa);
});

router.post("/questions", async (req, res) => {
  const { name, gender, country, city, question, category } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || !["male", "female", "unspecified"].includes(gender) || typeof country !== "string" || country.trim().length < 2 || typeof question !== "string" || question.trim().length < 20 || !validCategory(category)) {
    return res.status(400).json({ error: "name, gender, country, question, and a valid category are required" });
  }
  const saved = await contentStore.createQuestion({ name: name.trim(), gender, country: country.trim(), city: typeof city === "string" ? city.trim() : undefined, question: question.trim(), category });
  return res.status(201).json(saved);
});

router.get("/questions", async (_req, res) => {
  return res.json({ questions: await contentStore.listQuestions() });
});

router.get("/questions/:id", async (req, res) => {
  const questions = await contentStore.listQuestions();
  const question = questions.find((item) => item.id === req.params.id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  return res.json(question);
});

router.post("/post-submissions", async (req, res) => {
  const { name, country, city, title, body, category, language, authorImageUrl } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || (![title, body, authorImageUrl].some((value) => typeof value === "string" && value.trim().length > 0))) {
    return res.status(400).json({ error: "name and at least one of title, description, or image are required" });
  }
  const saved = await contentStore.createSubmission({
    name: name.trim(), country: typeof country === "string" ? country.trim() : undefined,
    city: typeof city === "string" ? city.trim() : undefined,
    title: typeof title === "string" && title.trim().length >= 3 ? title.trim() : "Community post",
    body: typeof body === "string" ? body.trim() : "", category: typeof category === "string" && category.trim() ? category : "Islamic", language: language === "ur" ? "ur" : language === "ar" ? "ar" : "en",
    imageUrl: typeof req.body?.imageUrl === "string" ? req.body.imageUrl : undefined,
    authorImageUrl: typeof authorImageUrl === "string" ? authorImageUrl : undefined,
  });
  return res.status(201).json(saved);
});

router.use("/admin", adminOnly);

router.get("/admin/stats", async (_req, res) => res.json(await contentStore.stats()));
router.get("/admin/fatwas", async (_req, res) => res.json({ fatwas: await contentStore.listAllFatwas() }));
router.get("/admin/questions", async (_req, res) => res.json({ questions: await contentStore.listQuestions() }));
router.get("/admin/post-submissions", async (_req, res) => res.json({ submissions: await contentStore.listSubmissions() }));

router.get("/admin/fatwa-agent", async (_req, res) => {
  try {
    return res.json(await agentRequest("/api/fatwa-agent/admin"));
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 503;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Fatwa agent bridge unavailable" });
  }
});

router.patch("/admin/fatwa-agent/:id", async (req, res) => {
  try {
    return res.json(await agentRequest(`/api/fatwa-agent/admin/${encodeURIComponent(req.params.id)}`, { method: "PATCH", body: JSON.stringify({ action: req.body?.action }) }));
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 503;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Fatwa agent bridge unavailable" });
  }
});

router.delete("/admin/fatwa-agent/:id", async (req, res) => {
  try {
    return res.json(await agentRequest(`/api/fatwa-agent/admin/${encodeURIComponent(req.params.id)}`, { method: "DELETE" }));
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 503;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Fatwa agent bridge unavailable" });
  }
});

router.patch("/admin/post-submissions/:id", async (req, res) => {
  const action = req.body?.action === "approve" ? "approved" : req.body?.action === "reject" ? "rejected" : undefined;
  if (!action) return res.status(400).json({ error: "action must be approve or reject" });
  const submission = await contentStore.reviewSubmission(req.params.id, action, typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined);
  if (!submission) return res.status(404).json({ error: "Submission not found or already reviewed" });
  return res.json({ ok: true, status: submission.status, submission });
});

router.post("/admin/fatwas", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title !== "string" || typeof body.question !== "string" || typeof body.answer !== "string" || !validCategory(body.category) || typeof body.scholar !== "string" || typeof body.institution !== "string" || typeof body.sourceUrl !== "string") {
    return res.status(400).json({ error: "title, question, answer, category, scholar, institution, and sourceUrl are required" });
  }
  const now = new Date().toISOString();
  const fatwa = await contentStore.createFatwa({
    title: body.title.trim(), question: body.question.trim(), answer: body.answer.trim(), category: body.category,
    scholar: body.scholar.trim(), institution: body.institution.trim(), sourceUrl: body.sourceUrl.trim(),
    sourceQuestionId: typeof body.sourceQuestionId === "string" ? body.sourceQuestionId : undefined,
    language: body.language === "ur" ? "ur" : "en", status: body.status === "draft" ? "draft" : "published", publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : now,
  });
  return res.status(201).json(fatwa);
});

router.patch("/admin/fatwas/:id", async (req, res) => {
  const patch = { ...req.body } as Record<string, unknown>;
  if (patch.category !== undefined && !validCategory(patch.category)) return res.status(400).json({ error: "Invalid category" });
  const fatwa = await contentStore.updateFatwa(req.params.id, patch);
  if (!fatwa) return res.status(404).json({ error: "Fatwa not found" });
  return res.json(fatwa);
});

router.delete("/admin/fatwas/:id", async (req, res) => {
  const deleted = await contentStore.deleteFatwa(req.params.id);
  return deleted ? res.status(204).send() : res.status(404).json({ error: "Fatwa not found" });
});

router.patch("/admin/questions/:id/answer", async (req, res) => {
  const { answer, answeredBy } = req.body ?? {};
  if (typeof answer !== "string" || answer.trim().length < 10 || typeof answeredBy !== "string" || answeredBy.trim().length < 2) return res.status(400).json({ error: "answer and answeredBy are required" });
  const question = await contentStore.answerQuestion(req.params.id, answer.trim(), answeredBy.trim());
  if (!question) return res.status(404).json({ error: "Question not found" });
  return res.json(question);
});

export default router;
