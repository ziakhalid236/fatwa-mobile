import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type FatwaCategory =
  | "Aqeedah"
  | "Namaz"
  | "Roza"
  | "Zakat"
  | "Hajj & Umrah"
  | "Nikah & Family"
  | "Muamalat"
  | "Tafseer & Quran";

export type Fatwa = {
  id: string;
  title: string;
  question: string;
  answer: string;
  category: FatwaCategory;
  scholar: string;
  institution: string;
  sourceUrl: string;
  sourceQuestionId?: string;
  language: "en" | "ur";
  status: "published" | "draft";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type UserQuestion = {
  id: string;
  name: string;
  city?: string;
  question: string;
  category: FatwaCategory;
  status: "submitted" | "under_review" | "answered";
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PostSubmission = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  title: string;
  body: string;
  category: string;
  language: 'en' | 'ur' | 'ar';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
};

type Database = { fatwas: Fatwa[]; questions: UserQuestion[]; submissions: PostSubmission[] };

const now = new Date().toISOString();
const seedFatwas: Fatwa[] = [
  {
    id: "deoband-196968",
    title: "What is the ruling if a Masbuq is followed in Salah?",
    question: "Can a person who missed rak'ahs and is making them up lead another person in prayer?",
    answer: "According to the Hanafi Fiqh, a Masbuq who is completing missed rak'ahs cannot act as an Imam for another person. In the described situation, signalling that another person should not follow him was the appropriate response.",
    category: "Namaz",
    scholar: "Darul Ifta",
    institution: "Darul Uloom Deoband, India",
    sourceUrl: "https://darulifta-deoband.com/home/en/salah-prayer/196968",
    sourceQuestionId: "196968",
    language: "en",
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "deoband-197003",
    title: "Giving zakat to a student whose mother has some gold",
    question: "Can zakat be given to a student whose father has died when the student's mother owns some gold?",
    answer: "The published answer explains that if the student does not personally possess nisab, it is permissible to assist the student with zakat funds. The specific facts and calculation should be checked with a qualified scholar.",
    category: "Zakat",
    scholar: "Darul Ifta",
    institution: "Darul Uloom Deoband, India",
    sourceUrl: "https://darulifta-deoband.com/home/en/zakat-charity/197003",
    sourceQuestionId: "197003",
    language: "en",
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "deoband-184728",
    title: "Nafl fasting after sehri time has ended",
    question: "If someone ate sehri for a nafl fast and later discovered that sehri time had ended, should the fast continue?",
    answer: "The published answer says that the nafl fast would not be valid in that situation and that the person can fast another day while observing the correct sehri time.",
    category: "Roza",
    scholar: "Darul Ifta",
    institution: "Darul Uloom Deoband, India",
    sourceUrl: "https://darulifta-deoband.com/home/en/sawm-fasting/184728",
    sourceQuestionId: "184728",
    language: "en",
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
];

export class ContentStore {
  private data: Database = { fatwas: seedFatwas, questions: [], submissions: [] };
  private readonly filePath: string;
  private ready: Promise<void>;

  constructor(filePath = process.env.CONTENT_STORE_FILE ?? path.resolve("data", "content.json")) {
    this.filePath = filePath;
    this.ready = this.load();
  }

  private async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      this.data = {
        fatwas: Array.isArray(parsed.fatwas) ? parsed.fatwas : seedFatwas,
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      };
    } catch {
      await this.persist();
    }
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }

  async listFatwas(search?: string, category?: string) {
    await this.ready;
    const term = search?.trim().toLowerCase();
    return this.data.fatwas.filter((fatwa) => {
      if (fatwa.status !== "published") return false;
      if (category && category !== "All" && fatwa.category !== category) return false;
      if (!term) return true;
      return [fatwa.title, fatwa.question, fatwa.answer, fatwa.category, fatwa.institution]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }

  async listAllFatwas() {
    await this.ready;
    return this.data.fatwas;
  }

  async getFatwa(id: string) {
    await this.ready;
    return this.data.fatwas.find((fatwa) => fatwa.id === id);
  }

  async createFatwa(input: Omit<Fatwa, "id" | "createdAt" | "updatedAt">) {
    await this.ready;
    const timestamp = new Date().toISOString();
    const fatwa: Fatwa = { ...input, id: `fatwa-${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp };
    this.data.fatwas.unshift(fatwa);
    await this.persist();
    return fatwa;
  }

  async updateFatwa(id: string, patch: Partial<Omit<Fatwa, "id" | "createdAt">>) {
    await this.ready;
    const index = this.data.fatwas.findIndex((fatwa) => fatwa.id === id);
    if (index < 0) return undefined;
    this.data.fatwas[index] = { ...this.data.fatwas[index], ...patch, updatedAt: new Date().toISOString() };
    await this.persist();
    return this.data.fatwas[index];
  }

  async deleteFatwa(id: string) {
    await this.ready;
    const before = this.data.fatwas.length;
    this.data.fatwas = this.data.fatwas.filter((fatwa) => fatwa.id !== id);
    if (before === this.data.fatwas.length) return false;
    await this.persist();
    return true;
  }

  async createQuestion(input: Pick<UserQuestion, "name" | "city" | "question" | "category">) {
    await this.ready;
    const timestamp = new Date().toISOString();
    const question: UserQuestion = { ...input, id: `question-${randomUUID()}`, status: "submitted", createdAt: timestamp, updatedAt: timestamp };
    this.data.questions.unshift(question);
    await this.persist();
    return question;
  }

  async listQuestions() {
    await this.ready;
    return this.data.questions;
  }

  async answerQuestion(id: string, answer: string, answeredBy: string) {
    await this.ready;
    const question = this.data.questions.find((item) => item.id === id);
    if (!question) return undefined;
    const timestamp = new Date().toISOString();
    Object.assign(question, { answer, answeredBy, answeredAt: timestamp, status: "answered", updatedAt: timestamp });
    await this.persist();
    return question;
  }

  async createSubmission(input: Omit<PostSubmission, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    await this.ready;
    const timestamp = new Date().toISOString();
    const submission: PostSubmission = { ...input, id: `submission-${randomUUID()}`, status: 'pending', createdAt: timestamp, updatedAt: timestamp };
    this.data.submissions.unshift(submission);
    await this.persist();
    return submission;
  }

  async listSubmissions() {
    await this.ready;
    return this.data.submissions;
  }

  async reviewSubmission(id: string, action: 'approved' | 'rejected', rejectionReason?: string) {
    await this.ready;
    const submission = this.data.submissions.find((item) => item.id === id);
    if (!submission || submission.status !== 'pending') return undefined;
    submission.status = action;
    submission.rejectionReason = rejectionReason;
    submission.updatedAt = new Date().toISOString();
    await this.persist();
    return submission;
  }

  async stats() {
    await this.ready;
    return {
      publishedFatwas: this.data.fatwas.filter((item) => item.status === "published").length,
      draftPosts: this.data.fatwas.filter((item) => item.status === "draft").length,
      pendingQuestions: this.data.questions.filter((item) => item.status !== "answered").length,
      answeredQuestions: this.data.questions.filter((item) => item.status === "answered").length,
    };
  }
}

export const contentStore = new ContentStore();
