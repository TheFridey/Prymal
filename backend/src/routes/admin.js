// ─────────────────────────────────────────────────────────────────
// routes/admin.js
// Thin entry point — mounts domain sub-routers.
// Each module owns its routes, imports, and schemas.
// ─────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import overviewRouter from './admin/overview.js';
import organisationsRouter from './admin/organisations.js';
import usersRouter from './admin/users.js';
import billingRouter from './admin/billing.js';
import tracesRouter from './admin/traces.js';
import workflowsRouter from './admin/workflows.js';
import supportRouter from './admin/support.js';
import auditRouter from './admin/audit.js';
import waitlistRouter from './admin/waitlist.js';
import referralsRouter from './admin/referrals.js';
import searchRouter from './admin/search.js';

const router = new Hono();

router.route('/', overviewRouter);
router.route('/', organisationsRouter);
router.route('/', usersRouter);
router.route('/', billingRouter);
router.route('/', tracesRouter);
router.route('/', workflowsRouter);
router.route('/', supportRouter);
router.route('/', auditRouter);
router.route('/', waitlistRouter);
router.route('/', referralsRouter);
router.route('/', searchRouter);

export default router;
