import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AccessToken, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';
import { requireAuth, requireModuleAccess } from '../aptitude/middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { aiService } from '../services/aiService.js';
import { config } from '../config.js';
import { CommunicationSession } from '../database/models/CommunicationSession.js';

// Communication AI runs on Groq (aiService); the NVIDIA path (nimService) is
// unavailable — dead models + speech-host DNS failures.
const commAi = aiService;
const router = Router();

const livekitHttpUrl = config.livekitUrl
  .replace('ws://', 'http://')
  .replace('wss://', 'https://');

const roomClient = new RoomServiceClient(
  livekitHttpUrl,
  config.livekitApiKey,
  config.livekitApiSecret,
);

const dispatchClient = new AgentDispatchClient(
  livekitHttpUrl,
  config.livekitApiKey,
  config.livekitApiSecret,
);

router.post('/rejoin-room', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { room, conversation_id } = req.body || {};
  const sessionId = conversation_id || room;
  if (!sessionId) throw new HttpError(400, 'room or conversation_id is required');

  // Find the session in the database
  const session = await CommunicationSession.findOne({ where: { session_id: sessionId } });
  if (!session) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.student_id !== req.user._id && !['admin', 'master_admin'].includes(req.user.role)) {
    throw new HttpError(403, 'Not your conversation');
  }
  if (session.status === 'ended') {
    throw new HttpError(400, 'Session has already ended');
  }

  const roomName = session.session_id;

  // 1. Check if the room currently exists in LiveKit
  let roomActive = false;
  try {
    const rooms = await roomClient.listRooms([roomName]);
    if (rooms && rooms.length > 0) {
      roomActive = true;
    }
  } catch (err) {
    console.warn('[rejoin-room] Error checking room in LiveKit:', err.message);
  }

  // 2. If the room does not exist in LiveKit (auto-closed when participants disconnected), recreate it
  if (!roomActive) {
    try {
      await roomClient.createRoom({ name: roomName, emptyTimeout: 300 });
      console.log(`[rejoin-room] Recreated room ${roomName} in LiveKit`);
    } catch (err) {
      console.warn('[rejoin-room] Error creating room in LiveKit:', err.message);
    }
  }

  // 3. Ensure the AI agent is dispatched to the room
  let hasDispatch = false;
  try {
    const dispatches = await dispatchClient.listDispatch(roomName);
    if (dispatches && dispatches.length > 0) {
      hasDispatch = true;
    }
  } catch (err) {
    // If no active dispatches exist, listDispatch may return empty or throw
  }

  if (!hasDispatch) {
    const history = session.history || [];
    const lastExchange = history[history.length - 1];
    const currentPrompt = lastExchange?.next_prompt || session.current_prompt || '';
    const exchangeCount = session.exchange_count ?? history.length;

    dispatchClient.createDispatch(roomName, 'interview-agent', {
      metadata: JSON.stringify({
        category: session.category,
        mode: session.context || 'general',
        userIdentity: req.user._id,
        isRejoin: true,
        exchangeCount,
        currentPrompt,
      }),
    }).then(() => {
      console.log(`[rejoin-room] Re-dispatched interview-agent to room ${roomName} (exchanges: ${exchangeCount})`);
    }).catch((err) => {
      console.error('[rejoin-room] Failed to re-dispatch agent on rejoin:', err.message);
    });
  }

  // 4. Generate participant token for the rejoining student
  const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
    identity: req.user._id,
    name: req.user.name || 'Student',
  });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const jwt = await token.toJwt();

  res.json({
    room: roomName,
    conversation_id: session.session_id,
    token: jwt,
    category: session.category,
    mode: session.context || 'general',
    exchanges: session.history || [],
  });
}));

router.post('/create-room', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { category, mode } = req.body || {};
  const roomName = `comm-${uuidv4().slice(0, 8)}`;
  const resolvedCategory = category || 'Everyday Conversation & Small Talk';
  const resolvedMode = mode || 'general';

  await roomClient.createRoom({ name: roomName, emptyTimeout: 300 });

  const participantToken = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
    identity: req.user._id,
    name: req.user.name || 'Student',
  });
  participantToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = await participantToken.toJwt();

  // Persist the session (session_id = room name) so exchanges can be synced
  // during the call and a report finalized after it. `context` holds the mode.
  await CommunicationSession.create({
    session_id: roomName,
    student_id: req.user._id,
    student_name: req.user.name || '',
    student_email: req.user.email || '',
    category: resolvedCategory,
    context: resolvedMode,
    history: [],
    exchange_count: 0,
    max_exchanges: 6,
    status: 'active',
  });

  dispatchClient.createDispatch(roomName, 'interview-agent', {
    metadata: JSON.stringify({
      category: resolvedCategory,
      mode: resolvedMode,
      userIdentity: req.user._id,
    }),
  }).catch((err) => {
    console.error('Failed to dispatch agent:', err.message);
  });

  res.json({
    room: roomName,
    conversation_id: roomName,
    token,
    category: resolvedCategory,
    mode: resolvedMode,
  });
}));

// ── Conversation persistence for LiveKit voice sessions ───────────────

router.get('/conversation/:id', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const session = await CommunicationSession.findOne({ where: { session_id: req.params.id } });
  if (!session) throw new HttpError(404, 'Conversation not found');
  if (session.student_id !== req.user._id && !['admin', 'master_admin'].includes(req.user.role)) {
    throw new HttpError(403, 'Not your conversation');
  }
  res.json({
    conversation_id: session.session_id,
    room_name: session.session_id,
    mode: session.context || 'general',
    category: session.category,
    status: session.status,
    exchanges: session.history || [],
  });
}));

router.post('/conversation/:id/sync', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { exchanges } = req.body || {};
  if (!Array.isArray(exchanges)) throw new HttpError(400, 'exchanges array is required');
  const session = await CommunicationSession.findOne({ where: { session_id: req.params.id } });
  if (!session) throw new HttpError(404, 'Conversation not found');
  if (session.student_id !== req.user._id) throw new HttpError(403, 'Not your conversation');

  await CommunicationSession.update(
    { history: exchanges, exchange_count: exchanges.length },
    { where: { session_id: req.params.id } },
  );
  res.json({ ok: true, synced: exchanges.length });
}));

router.post('/end-conversation', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { room, conversation_id: conversationId } = req.body || {};
  const sessionId = conversationId || room;
  if (sessionId) {
    await CommunicationSession.update(
      { status: 'ended' },
      { where: { session_id: sessionId, student_id: req.user._id } },
    );
  }
  if (room) await roomClient.deleteRoom(room).catch(() => {});
  res.json({ ok: true });
}));

router.post('/generate-scenario', asyncHandler(async (req, res) => {
  const { category } = req.body || {};
  const scenario = await commAi.generateScenario(category || 'Everyday Conversation & Small Talk');
  res.json({ opening: scenario.opening });
}));

router.post('/evaluate', asyncHandler(async (req, res) => {
  const { session_id, transcript, category, exchange_count, current_prompt } = req.body || {};
  if (!transcript) throw new HttpError(400, 'transcript is required');

  const resolvedCategory = category || 'Everyday Conversation & Small Talk';
  let prompt = current_prompt || '';
  if (!prompt && exchange_count === 0) {
    const scenario = await commAi.generateScenario(resolvedCategory);
    prompt = scenario.opening;
  }

  const evaluation = await commAi.evaluateResponse(prompt, transcript, resolvedCategory);
  const next_exchange = exchange_count + 1;
  const is_last = next_exchange >= 6;
  const next_prompt = is_last ? '' : (evaluation.next_prompt || 'Can you tell me more about a specific example from your experience?');

  res.json({
    exchange_number: next_exchange,
    evaluation: {
      clarity: evaluation.clarity,
      structure: evaluation.structure,
      conciseness: evaluation.conciseness,
      relevance: evaluation.relevance,
      confidence_tone: evaluation.confidence_tone,
    },
    feedback: evaluation.feedback,
    strengths: evaluation.strengths || [],
    improvements: evaluation.improvements || [],
    next_prompt,
    is_last,
    real_world_tip: evaluation.real_world_tip || '',
  });
}));

router.post('/end-room', requireAuth, requireModuleAccess('communication'), asyncHandler(async (req, res) => {
  const { room } = req.body || {};
  if (!room) throw new HttpError(400, 'room is required');
  await roomClient.deleteRoom(room);
  res.json({ success: true });
}));

export default router;
