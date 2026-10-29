import { Router, type Request, type Response } from "express";
import multer from "multer";
import { contentStore, type FatwaCategory } from "../content-store";

const router = Router();
const categories: FatwaCategory[] = ["Aqeedah", "Namaz", "Roza", "Zakat", "Hajj & Umrah", "Muamalat", "Tafseer & Quran"];

const MAX_POST_IMAGE_URL_LENGTH = 12 * 1024 * 1024;
const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
const postUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POST_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)),
});

function uploadedDataUrl(file: Express.Multer.File | undefined) {
  if (!file) return "";
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

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

router.post("/profile", async (req, res) => {
  const { deviceId, name, country, city } = req.body ?? {};
  if (typeof deviceId !== "string" || deviceId.trim().length < 8 || typeof name !== "string" || name.trim().length < 2 || typeof country !== "string" || country.trim().length < 2 || typeof city !== "string" || city.trim().length < 2) {
    return res.status(400).json({ error: "deviceId, name, country, and city are required" });
  }
  return res.status(200).json({ ok: true, deviceId: deviceId.trim(), name: name.trim(), country: country.trim(), city: city.trim() });
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

// The assistant lives in the deployed Worker (Workers AI + the shared system
// prompt). Local development proxies to it so both environments behave alike.
router.post("/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Please write your question." });
  const base = (process.env.FATWA_API_URL ?? "https://fatwa-api.ziakhalid236.workers.dev").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [], language: req.body?.language }),
    });
    const payload = (await response.json().catch(() => ({}))) as { answer?: string; error?: string };
    if (!response.ok || !payload.answer) return res.status(response.ok ? 502 : response.status).json({ error: payload.error ?? "The assistant could not answer right now." });
    return res.json({ answer: payload.answer });
  } catch {
    return res.status(502).json({ error: "The assistant could not answer right now." });
  }
});

router.post("/post-submissions", postUpload.fields([{ name: "image", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), async (req, res) => {
  const { name, country, city, body, language, authorImageUrl } = req.body ?? {};
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const bodyText = typeof body === "string" ? body.trim() : "";
  const imageUrl = uploadedDataUrl(files.image?.[0]) || (typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "");
  const profileImageUrl = uploadedDataUrl(files.profileImage?.[0]);
  const hasImageData = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i.test(imageUrl);
  const hasHttpsImage = /^https:\/\/\S+$/i.test(imageUrl);
  if (typeof name !== "string" || name.trim().length < 2 || !(bodyText || imageUrl)) {
    return res.status(400).json({ error: "name and at least one of description or image is required" });
  }
  if (imageUrl && imageUrl.length > MAX_POST_IMAGE_URL_LENGTH) return res.status(413).json({ error: "Image is too large. Please choose a smaller photo." });
  if (imageUrl && !hasImageData && !hasHttpsImage) return res.status(400).json({ error: "image must be a secure URL or a supported image" });
  const saved = await contentStore.createSubmission({
    name: name.trim(), country: typeof country === "string" ? country.trim() : undefined,
    city: typeof city === "string" ? city.trim() : undefined,
    title: bodyText ? bodyText.split(/\r?\n/)[0].slice(0, 120) : "Image post",
    body: bodyText, category: "", language: language === "ur" ? "ur" : language === "ar" ? "ar" : "en",
    imageUrl: imageUrl || undefined,
    authorImageUrl: profileImageUrl || (typeof authorImageUrl === "string" && authorImageUrl.length <= 2048 && /^https:\/\/\S+$/i.test(authorImageUrl) ? authorImageUrl : undefined),
  });
  return res.status(201).json(saved);
});

router.use("/admin", adminOnly);

router.get("/admin/stats", async (_req, res) => res.json(await contentStore.stats()));
router.get("/admin/fatwas", async (_req, res) => res.json({ fatwas: await contentStore.listAllFatwas() }));
router.get("/admin/questions", async (_req, res) => res.json({ questions: await contentStore.listQuestions() }));
router.get("/admin/post-submissions", async (_req, res) => res.json({ submissions: await contentStore.listSubmissions() }));
router.get("/admin/users", async (_req, res) => res.json({ users: [] }));

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
