import { Router } from "express";

import { isWritingLabFeatureEnabled } from "../config.js";

export function createFeaturesRouter(): Router {
  const router = Router();

  router.get("/features", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      features: {
        writingLab: isWritingLabFeatureEnabled(),
      },
    });
  });

  return router;
}
