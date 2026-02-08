import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { Volume2, PhoneOff, PhoneCall, Mic, MicOff } from "lucide-react";
import { useChannels } from "@/hooks/use-chat";
import { connectSocket, getSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { type AuthUser, useAuthStore } from "@/hooks/use-auth";
import { useVoiceStore } from "@/hooks/use-voice";

type VoicePeer = { peerId: string; user: AuthUser };
type VoicePeersPayload = { channelId: number; peers: VoicePeer[] };
type VoicePeerJoinedPayload = { peerId: string; user: AuthUser };
type VoicePeerLeftPayload = { peerId: string };
type VoiceSignalPayload = { from: string; data: any };

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {
      // Autoplay might be blocked; user can click "Join" again
    });
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export function VoiceArea() {
  const params = useParams();
  const serverId = Number(params.serverId);
  const channelId = Number(params.channelId);
  const { toast } = useToast();
  const me = useAuthStore((s) => s.user);

  const { data: channels } = useChannels(serverId);
  const currentChannel = channels?.find((c) => c.id === channelId);

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const micMuted = useVoiceStore((s) => s.micMuted);
  const setMicMuted = useVoiceStore((s) => s.setMicMuted);
  const [peers, setPeers] = useState<Record<string, AuthUser>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const offersSentRef = useRef<Set<string>>(new Set());

  const iceServers = useMemo(
    () => [{ urls: "stun:stun.l.google.com:19302" }],
    [],
  );

  const cleanupPeer = (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    peerConnectionsRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    offersSentRef.current.delete(peerId);
    setPeers((prev) => {
      const { [peerId]: _removed, ...rest } = prev;
      return rest;
    });
    setRemoteStreams((prev) => {
      const { [peerId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const cleanupAllPeers = () => {
    for (const peerId of Array.from(peerConnectionsRef.current.keys())) {
      cleanupPeer(peerId);
    }
    setPeers({});
    setRemoteStreams({});
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    offersSentRef.current.clear();
  };

  const applyMicMutedToLocalStream = (muted: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !muted;
    }
  };

  useEffect(() => {
    applyMicMutedToLocalStream(micMuted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micMuted]);

  const ensurePeerConnection = (peerId: string) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const socket = getSocket();
      socket.emit("voice:signal", {
        to: peerId,
        data: { type: "candidate", candidate: event.candidate.toJSON() },
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        cleanupPeer(peerId);
      }
    };

    const localStream = localStreamRef.current;
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  const sendOffer = async (peerId: string) => {
    const socket = getSocket();
    const pc = ensurePeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("voice:signal", {
      to: peerId,
      data: { type: "offer", sdp: pc.localDescription },
    });
  };

  const maybeInitiate = async (peerId: string) => {
    const socket = getSocket();
    if (!socket.id) return;
    if (socket.id >= peerId) return;
    if (offersSentRef.current.has(peerId)) return;
    offersSentRef.current.add(peerId);
    await sendOffer(peerId);
  };

  const handleSignal = async (payload: VoiceSignalPayload) => {
    const { from, data } = payload;
    const pc = ensurePeerConnection(from);

    if (data?.type === "offer") {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit("voice:signal", {
        to: from,
        data: { type: "answer", sdp: pc.localDescription },
      });

      const queued = pendingCandidatesRef.current.get(from) || [];
      for (const cand of queued) {
        await pc.addIceCandidate(cand).catch(() => undefined);
      }
      pendingCandidatesRef.current.delete(from);
    } else if (data?.type === "answer") {
      await pc.setRemoteDescription(data.sdp);

      const queued = pendingCandidatesRef.current.get(from) || [];
      for (const cand of queued) {
        await pc.addIceCandidate(cand).catch(() => undefined);
      }
      pendingCandidatesRef.current.delete(from);
    } else if (data?.type === "candidate") {
      const candidate: RTCIceCandidateInit | undefined = data.candidate;
      if (!candidate) return;
      if (!pc.remoteDescription) {
        const list = pendingCandidatesRef.current.get(from) || [];
        list.push(candidate);
        pendingCandidatesRef.current.set(from, list);
        return;
      }
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  };

  const joinVoice = async () => {
    if (connecting || joined) return;
    setConnecting(true);
    cleanupAllPeers();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      applyMicMutedToLocalStream(micMuted);

      const socket = connectSocket();
      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const onConnect = () => {
            socket.off("connect_error", onError);
            resolve();
          };
          const onError = (err: any) => {
            socket.off("connect", onConnect);
            reject(err);
          };

          socket.once("connect", onConnect);
          socket.once("connect_error", onError);
          socket.connect();
        });
      }

      socket.emit("voice:join", { channelId });
      setJoined(true);
    } catch (e: any) {
      toast({
        title: "Voice error",
        description: e?.message || "Failed to join voice",
        variant: "destructive",
      });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setJoined(false);
    } finally {
      setConnecting(false);
    }
  };

  const leaveVoice = () => {
    if (!joined) return;
    const socket = getSocket();
    socket.emit("voice:leave");
    cleanupAllPeers();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setJoined(false);
  };

  useEffect(() => {
    const socket = getSocket();

    const onPeers = async ({ peers: list }: VoicePeersPayload) => {
      const peerMap: Record<string, AuthUser> = {};
      for (const p of list) peerMap[p.peerId] = p.user;
      setPeers(peerMap);

      for (const p of list) {
        ensurePeerConnection(p.peerId);
        await maybeInitiate(p.peerId);
      }
    };

    const onPeerJoined = async ({ peerId, user }: VoicePeerJoinedPayload) => {
      setPeers((prev) => ({ ...prev, [peerId]: user }));
      ensurePeerConnection(peerId);
      await maybeInitiate(peerId);
    };

    const onPeerLeft = ({ peerId }: VoicePeerLeftPayload) => {
      cleanupPeer(peerId);
    };

    const onSignal = async (payload: VoiceSignalPayload) => {
      if (!joined) return;
      await handleSignal(payload);
    };

    const onVoiceError = ({ message }: { message: string }) => {
      toast({ title: "Voice", description: message, variant: "destructive" });
    };

    socket.on("voice:peers", onPeers);
    socket.on("voice:peer-joined", onPeerJoined);
    socket.on("voice:peer-left", onPeerLeft);
    socket.on("voice:signal", onSignal);
    socket.on("voice:error", onVoiceError);

    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:peer-joined", onPeerJoined);
      socket.off("voice:peer-left", onPeerLeft);
      socket.off("voice:signal", onSignal);
      socket.off("voice:error", onVoiceError);
      leaveVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, channelId]);

  const participants: Array<{ id: string; user: AuthUser; isMe?: boolean }> = useMemo(() => {
    const result: Array<{ id: string; user: AuthUser; isMe?: boolean }> = [];
    if (me) result.push({ id: "me", user: me, isMe: true });
    for (const [peerId, user] of Object.entries(peers)) {
      result.push({ id: peerId, user });
    }
    return result;
  }, [me, peers]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
      <div className="h-12 px-4 flex items-center border-b border-border/40 shadow-sm z-10 bg-background/80 backdrop-blur-md">
        <Volume2 className="text-muted-foreground mr-2" size={20} />
        <h3 className="font-bold text-foreground">{currentChannel?.name || "Voice"}</h3>
        <div className="ml-auto flex items-center gap-2">
          {joined ? (
            <>
              <button
                type="button"
                onClick={() => setMicMuted(!micMuted)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${micMuted ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-muted/50 text-foreground hover:bg-muted"}`}
              >
                {micMuted ? (
                  <span className="inline-flex items-center gap-2"><MicOff size={16} />Muted</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><Mic size={16} />Mic</span>
                )}
              </button>
              <button
                type="button"
                onClick={leaveVoice}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors inline-flex items-center gap-2"
              >
                <PhoneOff size={16} />
                Leave
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={joinVoice}
              disabled={connecting}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-60"
            >
              <PhoneCall size={16} />
              {connecting ? "Joining..." : "Join"}
            </button>
          )}
        </div>
      </div>

      {/* Hidden audio players */}
      <div className="hidden">
        {Object.entries(remoteStreams).map(([peerId, stream]) => (
          <RemoteAudio key={peerId} stream={stream} />
        ))}
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-3">Participants ({participants.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/60 border border-border/40">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {(p.user.displayName || p.user.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.user.displayName || p.user.username}
                    {p.isMe ? " (you)" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">#{p.user.username}</div>
                </div>
              </div>
            ))}
          </div>

          {!joined && (
            <div className="mt-6 text-sm text-muted-foreground">
              Нажми <span className="font-semibold">Join</span> чтобы подключиться к голосовому каналу. Браузер попросит доступ к микрофону.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
