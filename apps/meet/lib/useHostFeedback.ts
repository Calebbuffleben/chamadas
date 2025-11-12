import { useEffect, useMemo, useRef } from 'react';
import type { Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

type FeedbackPayload = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  ts: number;
  meetingId: string;
  participantId: string;
  window: { start: number; end: number };
  message: string;
  tips?: string[];
  metadata?: Record<string, unknown>;
};

function isHost(metadata: string | null | undefined): boolean {
  if (!metadata) return false;
  try {
    const obj = JSON.parse(metadata) as unknown;
    if (typeof obj !== 'object' || obj === null) return false;
    const anyObj = obj as Record<string, unknown>;
    const role = anyObj['role'];
    const roles = anyObj['roles'];
    const isHost = anyObj['isHost'];
    if (typeof role === 'string' && role.toLowerCase() === 'host') return true;
    if (Array.isArray(roles) && roles.some((r) => typeof r === 'string' && r.toLowerCase() === 'host')) return true;
    if (typeof isHost === 'boolean' && isHost) return true;
  } catch {
    return false;
  }
  return false;
}

export function useHostFeedback(room: Room | undefined, roomName: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const lastJoinedRef = useRef<string | null>(null);
  const backendBase = useMemo(() => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  }, []);
  const forceSubscribe = useMemo(() => {
    return (process.env.NEXT_PUBLIC_FEEDBACK_FORCE || '').toLowerCase() === 'true';
  }, []);
  const debug = useMemo(() => {
    return (process.env.NEXT_PUBLIC_FEEDBACK_DEBUG || '').toLowerCase() === 'true';
  }, []);

  useEffect(() => {
    if (!room || !roomName) return;
    let cancelled = false;
    const controller = new AbortController();

    const resolveMeetingId: () => Promise<string> = async () => {
      try {
        const url = new URL('/sessions/resolve', backendBase);
        url.searchParams.set('roomName', roomName);
        const res = await fetch(url.toString(), { signal: controller.signal });
        const data = (await res.json()) as { ok: boolean; meetingId?: string };
        return data.ok && data.meetingId ? data.meetingId : roomName;
      } catch {
        return roomName;
      }
    };

    const ensureSocketForHost = async () => {
      const local = room.localParticipant;
      const host = isHost(local?.metadata ?? null);
      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[feedback] preparing subscription', { forceSubscribe, isHost: host, roomName });
      }
      if (!forceSubscribe && !host) {
        return;
      }
      const meetingId = await resolveMeetingId();
      if (cancelled || !meetingId) return;
      let s = socketRef.current;
      if (!s) {
        s = io(backendBase, { transports: ['websocket'] });
        socketRef.current = s;
      }
      // Always re-bind listener to avoid duplicates
      s.off('feedback');
      s.off('connect');
      s.off('connect_error');
      s.off('error');
      s.off('disconnect');
      s.off('user-joined');
      s.on('connect', () => {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[feedback] socket connected, joining room', `feedback:${meetingId}`);
          toast.success(`Feedback conectado (${meetingId})`, { duration: Infinity, id: `fb-connect-${meetingId}` });
        }
        if (lastJoinedRef.current !== meetingId) {
          s!.emit('join-room', `feedback:${meetingId}`);
          lastJoinedRef.current = meetingId;
        }
      });
      // If the socket is already connected, join immediately to avoid missing the connect event
      if (s.connected && lastJoinedRef.current !== meetingId) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[feedback] joining on already-connected socket', `feedback:${meetingId}`);
        }
        s.emit('join-room', `feedback:${meetingId}`);
        lastJoinedRef.current = meetingId;
      }
      s.on('connect_error', (err: Error) => {
        if (debug) {
          // eslint-disable-next-line no-console
          console.error('[feedback] connect_error', err);
          toast.error(`Feedback erro de conexão: ${err.message}`, { duration: Infinity, id: 'fb-connect-error' });
        }
      });
      s.on('error', (err: Error) => {
        if (debug) {
          // eslint-disable-next-line no-console
          console.error('[feedback] error', err);
          toast.error(`Feedback erro: ${err.message}`, { duration: Infinity, id: 'fb-error' });
        }
      });
      s.on('disconnect', (reason: string) => {
        if (debug) {
          // eslint-disable-next-line no-console
          console.warn('[feedback] disconnect', reason);
          toast(`Feedback desconectado: ${reason}`, { duration: Infinity, id: 'fb-disconnect' });
        }
      });
      s.on('user-joined', (evt: { clientId: string; room: string }) => {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[feedback] user-joined', evt);
          toast(`Entrou em ${evt.room}`, { duration: Infinity, id: `fb-joined-${evt.room}` });
        }
      });
      s.on('feedback', (payload: FeedbackPayload) => {
        // de-duplicate by payload id
        if (payload?.id) {
          if (seenRef.current.has(payload.id)) {
            return;
          }
          seenRef.current.add(payload.id);
          // keep seen set bounded
          if (seenRef.current.size > 200) {
            // remove oldest arbitrarily
            const first = seenRef.current.values().next().value as string | undefined;
            if (first) seenRef.current.delete(first);
          }
        }
        // Dispatch browser event for a persistent in-call panel
        try {
          const evt = new CustomEvent<FeedbackPayload>('host-feedback', { detail: payload });
          window.dispatchEvent(evt);
        } catch {
          // ignore
        }
        // Toast with longer durations
        const text = payload.message;
        const toastId = payload.id || `${payload.type}-${payload.ts}`;
        if (payload.severity === 'critical') toast.error(text, { duration: 12000, id: toastId });
        else if (payload.severity === 'warning') toast(text, { duration: 8000, id: toastId });
        else toast.success(text, { duration: 6000, id: toastId });
      });
    };

    const onMeta = () => {
      void ensureSocketForHost();
    };

    room.on(RoomEvent.ParticipantMetadataChanged, onMeta);
    room.on(RoomEvent.Connected, onMeta);
    void ensureSocketForHost();

    return () => {
      cancelled = true;
      controller.abort();
      room.off(RoomEvent.ParticipantMetadataChanged, onMeta);
      room.off(RoomEvent.Connected, onMeta);
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
        lastJoinedRef.current = null;
      }
    };
  }, [room, roomName, backendBase]);
}


