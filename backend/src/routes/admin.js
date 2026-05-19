// ─────────────────────────────────────────────────────────────────
// routes/admin.js
// Thin entry point — mounts domain sub-routers.
// Each module owns its routes, imports, and schemas.
// ─────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import overviewRouter from './admin/overview.js';
import growthRouter from './admin/growth.js';
import organisationsRouter from './admin/organisations.js';
import usersRouter from './admin/users.js';
import billingRouter from './admin/billing.js';
import tracesRouter from './admin/traces.js';
import workflowsRouter from './admin/workflows.js';
import workflowCatalogueRouter from './admin/workflow-catalogue.js';
import supportRouter from './admin/support.js';
import auditRouter from './admin/audit.js';
import waitlistRouter from './admin/waitlist.js';
import referralsRouter from './admin/referrals.js';
import searchRouter from './admin/search.js';
import operatorRouter from './admin/operator.js';
import memoryIntelligenceRouter from './admin/memory-intelligence.js';
import securityRouter from './admin/security.js';

const router = new Hono();

router.route('/', overviewRouter);
router.route('/', growthRouter);
router.route('/', organisationsRouter);
router.route('/', usersRouter);
router.route('/', billingRouter);
router.route('/', tracesRouter);
router.route('/', workflowsRouter);
router.route('/', workflowCatalogueRouter);
router.route('/', supportRouter);
router.route('/', auditRouter);
router.route('/', waitlistRouter);
router.route('/', referralsRouter);
router.route('/', searchRouter);
router.route('/', operatorRouter);
router.route('/', memoryIntelligenceRouter);
router.route('/', securityRouter);

export default router;
