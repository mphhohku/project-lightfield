import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import {
  askQuestionInputSchema, labSubmissionInputSchema, pollSubmissionSchema, questionIdInputSchema,
  quizSubmissionSchema, takeawayFeedbackInputSchema,
} from '@lightfield/shared';
import { createApiRouter, safeErrorHandler } from './routes/api.js';
import { SessionStore } from './services/sessionStore.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, methods: ['GET', 'POST'] }, maxHttpBufferSize: 256_000 });
const store = new SessionStore();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(cors({ origin: true, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '256kb', strict: true }));
app.use('/api', createApiRouter(store));
app.use(safeErrorHandler);

const joinSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  participantId: z.string().uuid().optional(),
  alias: z.string().trim().min(1).max(60).optional(),
  role: z.enum(['participant', 'presenter']).default('participant'),
  presenterToken: z.string().min(20).max(200).optional(),
}).strict();
const advanceSchema = z.object({ direction: z.enum(['next', 'previous']) }).strict();
const archiveSchema = z.object({ presenterToken: z.string().min(20).max(200) }).strict();

function reportError(socket: Socket, message: string): void { socket.emit('operation_error', { message }); }
function isPresenter(socket: Socket, sessionId: string): boolean {
  return socket.data.role === 'presenter' && socket.data.sessionId === sessionId && store.authorizePresenter(sessionId, socket.data.presenterToken);
}
function isParticipant(socket: Socket, sessionId: string): socket is Socket & { data: { participantId: string } } {
  return socket.data.role === 'participant' && socket.data.sessionId === sessionId && typeof socket.data.participantId === 'string';
}

io.on('connection', (socket) => {
  socket.on('join_session', async (payload: unknown) => {
    const input = joinSchema.safeParse(payload);
    if (!input.success) return reportError(socket, 'Invalid join request.');
    const { sessionId, role } = input.data;
    try {
      if (role === 'presenter') {
        if (!store.authorizePresenter(sessionId, input.data.presenterToken)) return reportError(socket, 'Presenter access is no longer available.');
        socket.data.role = 'presenter';
        socket.data.presenterToken = input.data.presenterToken;
      } else {
        if (!input.data.participantId || !input.data.alias) return reportError(socket, 'Join details are required.');
        const session = await store.join(sessionId, { participantId: input.data.participantId, alias: input.data.alias });
        socket.data.role = 'participant';
        socket.data.participantId = input.data.participantId;
        socket.emit('session_state', session);
        io.to(sessionId).emit('session_updated', session);
      }
      socket.data.sessionId = sessionId;
      await socket.join(sessionId);
      if (role === 'presenter') {
        const session = await store.get(sessionId);
        if (session) socket.emit('session_state', session);
      }
    } catch {
      reportError(socket, 'Unable to join this session.');
    }
  });

  socket.on('advance_block', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = advanceSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isPresenter(socket, sessionId)) return reportError(socket, 'Presenter access is required.');
    try {
      const session = await store.advance(sessionId, input.data.direction === 'next' ? 1 : -1);
      io.to(sessionId).emit('session_updated', session);
    } catch { reportError(socket, 'Unable to change the active block.'); }
  });

  socket.on('submit_poll', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = pollSubmissionSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant before voting.');
    try { io.to(sessionId).emit('session_updated', await store.poll(sessionId, socket.data.participantId, input.data)); }
    catch { reportError(socket, 'Unable to record this poll response.'); }
  });

  socket.on('submit_quiz', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = quizSubmissionSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant before submitting the quiz.');
    try {
      const result = await store.quiz(sessionId, socket.data.participantId, input.data);
      socket.emit('quiz_scored', { blockId: input.data.blockId, score: result.score });
      io.to(sessionId).emit('session_updated', result.snapshot);
    } catch { reportError(socket, 'Unable to record this quiz response.'); }
  });

  socket.on('submit_lab', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = labSubmissionInputSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant before submitting a lens note.');
    try { io.to(sessionId).emit('session_updated', await store.lab(sessionId, socket.data.participantId, input.data)); }
    catch { reportError(socket, 'Unable to record this lens note.'); }
  });

  socket.on('ask_anonymous_question', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = askQuestionInputSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant to ask a question.');
    try { io.to(sessionId).emit('session_updated', await store.askQuestion(sessionId, socket.data.participantId, input.data)); }
    catch { reportError(socket, 'Unable to add your anonymous question.'); }
  });

  socket.on('vote_anonymous_question', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = questionIdInputSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant to vote.');
    try { io.to(sessionId).emit('session_updated', await store.voteQuestion(sessionId, socket.data.participantId, input.data)); }
    catch { reportError(socket, 'Unable to record your vote.'); }
  });

  socket.on('mark_question_answered', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = questionIdInputSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isPresenter(socket, sessionId)) return reportError(socket, 'Presenter access is required to mark a question answered.');
    try { io.to(sessionId).emit('session_updated', await store.markQuestionAnswered(sessionId, input.data)); }
    catch { reportError(socket, 'Unable to update this question.'); }
  });

  socket.on('submit_takeaway_feedback', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = takeawayFeedbackInputSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isParticipant(socket, sessionId)) return reportError(socket, 'Join as a participant to submit takeaway feedback.');
    try {
      const snapshot = await store.submitTakeawayFeedback(sessionId, socket.data.participantId, input.data);
      socket.emit('takeaway_feedback_saved');
      io.to(sessionId).emit('session_updated', snapshot);
    } catch (error) {
      reportError(socket, error instanceof Error && error.message === 'Feedback has already been submitted.' ? error.message : 'Unable to submit anonymous feedback.');
    }
  });

  socket.on('save_artifact', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    if (typeof sessionId !== 'string' || !isPresenter(socket, sessionId)) return reportError(socket, 'Presenter access is required to save a Field Test to this log.');
    try { io.to(sessionId).emit('session_updated', await store.saveArtifact(sessionId, payload)); }
    catch { reportError(socket, 'Unable to save this Field Test to the archive.'); }
  });

  socket.on('archive_session', async (payload: unknown) => {
    const sessionId = socket.data.sessionId;
    const input = archiveSchema.safeParse(payload);
    if (typeof sessionId !== 'string' || !input.success || !isPresenter(socket, sessionId)) return reportError(socket, 'Presenter access is required to close this Field Log.');
    try {
      const session = await store.archive(sessionId, input.data.presenterToken);
      io.to(sessionId).emit('session_archived', session);
      await io.in(sessionId).socketsLeave(sessionId);
    } catch { reportError(socket, 'Unable to archive this Field Log.'); }
  });

  socket.on('disconnect', () => { socket.data.sessionId = undefined; });
});

httpServer.listen(port, () => { console.info(`Lightfield API listening on http://localhost:${port}`); });
