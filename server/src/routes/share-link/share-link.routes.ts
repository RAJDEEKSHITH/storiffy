import { Router } from "express";

import {
  createPublicShareController,
  createRestrictedShareController,
  getShareLinkController,
  listMySharesController,
  listSharesWithMeController,
  lookupShareRecipientController,
  revokeShareLinkController,
  updateShareLinkController,
} from "../../controllers/share-link/share-link.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validate.middleware.js";
import {
  createPublicShareSchema,
  createRestrictedShareSchema,
  recipientLookupQuerySchema,
  shareLinkIdParamsSchema,
  updateShareLinkSchema,
} from "../../validators/share-link/share-link.validator.js";

const router = Router();

router.use(authenticate);

router.post(
  "/public",
  validateBody(createPublicShareSchema),
  createPublicShareController,
);

router.post(
  "/restricted",
  validateBody(createRestrictedShareSchema),
  createRestrictedShareController,
);

router.get(
  "/recipients/lookup",
  (req, _res, next) => {
    const result = recipientLookupQuerySchema.safeParse({
      email: req.query.email,
    });

    if (!result.success) {
      return next(result.error);
    }

    req.query.email = result.data.email;
    return next();
  },
  lookupShareRecipientController,
);

router.get("/mine", listMySharesController);
router.get("/shared-with-me", listSharesWithMeController);

router.get(
  "/:id",
  validateParams(shareLinkIdParamsSchema),
  getShareLinkController,
);

router.patch(
  "/:id",
  validateParams(shareLinkIdParamsSchema),
  validateBody(updateShareLinkSchema),
  updateShareLinkController,
);

router.delete(
  "/:id",
  validateParams(shareLinkIdParamsSchema),
  revokeShareLinkController,
);

export default router;
