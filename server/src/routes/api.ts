import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import { Router, type Request, type Response } from 'express';
import { createSessionInputSchema, generatedArtifactSchema, restaurantSchema } from '@lightfield/shared';
import { z } from 'zod';
import { SessionStore } from '../services/sessionStore.js';

function badRequest(res: Response, message: string): void { res.status(400).json({ error: message }); }

export function createApiRouter(store: SessionStore): Router {
  const router = Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lightfield-api' }));
  router.get('/templates', async (_req, res, next) => {
    try { res.json({ templates: await store.templates() }); } catch (error) { next(error); }
  });
  router.get('/sessions', async (_req, res, next) => {
    try { res.json(await store.list()); } catch (error) { next(error); }
  });
  router.post('/sessions', async (req, res, next) => {
    const input = createSessionInputSchema.safeParse(req.body);
    if (!input.success) return badRequest(res, 'Invalid session details.');
    try {
      const result = await store.create(input.data.title, input.data.presenterName, input.data.templateId);
      res.status(201).json({ session: result.snapshot, presenterToken: result.presenterToken });
    } catch (error) {
      if (error instanceof Error && error.message === 'Template not found.') return res.status(404).json({ error: 'Template not found.' });
      next(error);
    }
  });
  router.get('/sessions/:id', async (req, res) => {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Field Log not found.' });
    res.json({ session });
  });
  router.post('/sessions/:id/archive', async (req, res) => {
    try {
      const token = typeof req.body?.presenterToken === 'string' ? req.body.presenterToken : undefined;
      const session = await store.archive(req.params.id, token);
      res.json({ session });
    } catch {
      res.status(403).json({ error: 'Unable to archive this live session.' });
    }
  });
  router.post('/sessions/:id/artifacts', async (req, res) => {
    if (!store.authorizePresenter(req.params.id, req.get('x-lightfield-presenter'))) return res.status(403).json({ error: 'Presenter access is required to save a Field Test.' });
    const artifact = generatedArtifactSchema.safeParse(req.body);
    if (!artifact.success) return badRequest(res, 'Invalid field-test artifact.');
    try { res.json({ session: await store.saveArtifact(req.params.id, artifact.data) }); }
    catch { res.status(409).json({ error: 'Unable to save this artifact to the active Field Log.' }); }
  });
  router.get('/rotator/fallback', async (_req, res, next) => {
    try {
      const data: unknown = JSON.parse(await readFile(path.join(DATA_DIR, 'cache', 'hku-restaurants-fallback.json'), 'utf8'));
      const validated = z.object({ notice: z.string().max(1000), restaurants: z.array(restaurantSchema).min(5).max(50) }).strict().safeParse(data);
      if (!validated.success) return res.status(500).json({ error: 'Fallback suggestions are not available.' });
      res.json(validated.data);
    } catch (error) { next(error); }
  });
  return router;
}

export function safeErrorHandler(error: unknown, _req: Request, res: Response, _next: unknown): void {
  // Intentionally do not log request bodies or exception values: BYOK never reaches this server.
  if (!res.headersSent) res.status(500).json({ error: 'The request could not be completed.' });
}
