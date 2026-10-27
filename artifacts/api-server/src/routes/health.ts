import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const health = (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

// Keep both names during the Cloudflare migration. The deployed Worker uses
// /health while the generated local API client historically used /healthz.
router.get("/health", health);
router.get("/healthz", health);

export default router;
