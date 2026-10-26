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
  const { name, city, question, category } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || typeof question !== "string" || question.trim().length < 20 || !validCategory(category)) {
    return res.status(400).json({ error: "name, question, and a valid category are required" });
  }
  const saved = await contentStore.createQuestion({ name: name.trim(), city: typeof city === "string" ? city.trim() : undefined, question: question.trim(), category });
  return res.status(201).json(saved);
});

router.get("/questions/:id", async (req, res) => {
  const questions = await contentStore.listQuestions();
  const question = questions.find((item) => item.id === req.params.id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  return res.json(question);
});

router.use("/admin", adminOnly);

router.get("/admin/stats", async (_req, res) => res.json(await contentStore.stats()));
router.get("/admin/fatwas", async (_req, res) => res.json({ fatwas: await contentStore.listAllFatwas() }));
router.get("/admin/questions", async (_req, res) => res.json({ questions: await contentStore.listQuestions() }));

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
