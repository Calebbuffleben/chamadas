import { detectHostility } from './detect-hostility';
import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';

describe('detectHostility', () => {
  const meetingId = 'test-meeting';
  const participantId = 'test-participant';
  const now = Date.now();
  const longWindowMs = A2E2_THRESHOLDS.windows.long;

  const createMockCtx = () => ({
    meetingId,
    participantId,
    now,
    getParticipantName: jest.fn(() => 'Test User'),
    inCooldown: jest.fn(() => false),
    inGlobalCooldown: jest.fn(() => false),
    setCooldown: jest.fn(),
    makeId: jest.fn(() => 'test-id-123'),
    window: jest.fn((state, n, ms) => ({
      start: n - ms,
      end: n,
      samplesCount: 10,
      speechCount: 8,
    })),
  });

  const createMockState = (emotions: Map<string, number>) => ({
    samples: Array.from({ length: 10 }, (_, i) => ({
      ts: now - (10 - i) * 1000,
      speech: true,
    })),
    ema: {
      emotions,
      valence: 0.1,
      arousal: 0.4, // Arousal alto para passar na verificação contextual (>= 0.3)
      rms: -20,
    },
    cooldownUntilByType: new Map<string, number>(),
    lastFeedbackAt: undefined,
  });

  describe('Cenário Positivo - Detecta hostilidade', () => {
    it('deve detectar hostilidade quando anger está acima do threshold', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.15], // Acima de 0.12
        ['disgust', 0.02],
        ['distress', 0.01],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('hostilidade');
      expect(result?.severity).toBe('warning');
      expect(ctx.setCooldown).toHaveBeenCalled();
    });

    it('deve detectar hostilidade quando disgust está acima do threshold', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.02],
        ['disgust', 0.15], // Acima de 0.12
        ['distress', 0.01],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('hostilidade');
    });

    it('deve detectar hostilidade quando distress está acima do threshold', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.02],
        ['disgust', 0.01],
        ['distress', 0.15], // Acima de 0.12
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('hostilidade');
    });
  });

  describe('Cenário Negativo - Não detecta hostilidade', () => {
    it('não deve detectar quando todas as emoções estão abaixo do threshold', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.10], // Abaixo de 0.12
        ['disgust', 0.08],
        ['distress', 0.05],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).toBeNull();
    });

    it('não deve detectar quando não há emoções de hostilidade', () => {
      const emotions = new Map<string, number>([
        ['joy', 0.1],
        ['interest', 0.15],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).toBeNull();
    });

    it('não deve detectar quando está em cooldown', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.15],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();
      ctx.inCooldown = jest.fn(() => true);

      const result = detectHostility(state, ctx);

      expect(result).toBeNull();
    });
  });

  describe('Cenário Borderline - Casos limite', () => {
    it('não deve detectar quando anger está exatamente no threshold (0.12)', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.12], // Exatamente no threshold
        ['disgust', 0.02],
        ['distress', 0.01],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      // Threshold é > 0.12, então 0.12 não deve detectar
      expect(result).toBeNull();
    });

    it('deve detectar quando anger está ligeiramente acima do threshold (0.1201)', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.1201], // Ligeiramente acima de 0.12
        ['disgust', 0.02],
        ['distress', 0.01],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();

      const result = detectHostility(state, ctx);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('hostilidade');
    });

    it('não deve detectar quando está em global cooldown', () => {
      const emotions = new Map<string, number>([
        ['anger', 0.15],
      ]);
      const state = createMockState(emotions);
      const ctx = createMockCtx();
      ctx.inGlobalCooldown = jest.fn(() => true);

      const result = detectHostility(state, ctx);

      expect(result).toBeNull();
    });
  });
});

