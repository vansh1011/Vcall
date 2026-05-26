import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { PhoneOff, Phone, X, Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, MonitorOff } from "lucide-react";
import { socket } from "../socket";
import { api } from "../api";

const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function Call() {
  const nav = useNavigate();
  const { state } = useLocation();
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerSocketRef = useRef(state?.targetSocketId || state?.incoming?.fromSocketId || null);
  const pendingIceRef = useRef([]);

  const [incoming, setIncoming] = useState(state?.incoming || null);
  const [status, setStatus] = useState(
    state?.outgoing ? "Calling..." : state?.incoming ? "Incoming call" : "Waiting..."
  );
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const cleanup = () => {
    pcRef.current?.close(); pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
  };

  const endAndLeave = () => {
    if (peerSocketRef.current) socket.emit("end-call", { to: peerSocketRef.current });
    cleanup();
    nav("/");
  };

  const createPC = (peerSid) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { to: peerSid, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
      setStatus("Connected");
    };
    return pc;
  };

  const getMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  };

  // Outgoing
  useEffect(() => {
    if (!state?.outgoing) return;
    (async () => {
      try {
        let myName = "";
        try { const r = await api("/home"); const j = await r.json(); myName = j?.user?.username || ""; } catch {}
        const stream = await getMedia();
        const pc = createPC(state.targetSocketId);
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: state.targetSocketId, offer, from: myName });
      } catch (e) {
        toast.error("Could not start call: " + e.message);
        nav("/");
      }
    })();
    // eslint-disable-next-line
  }, []);

  // Socket listeners
  useEffect(() => {
    const onOffer = (data) => {
      if (state?.outgoing) return;
      setIncoming(data);
      peerSocketRef.current = data.fromSocketId;
    };
    const onAnswer = async ({ answer }) => {
      try { await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer)); }
      catch (e) { console.error(e); }
    };
    const onIce = async ({ candidate }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceRef.current.push(candidate);
        }
      } catch (e) { console.error(e); }
    };
    const onRejected = () => { toast.info("Call rejected"); cleanup(); nav("/"); };
    const onEnd = () => { toast.info("Call ended"); cleanup(); nav("/"); };

    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("call-rejected", onRejected);
    socket.on("end-call", onEnd);
    return () => {
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("call-rejected", onRejected);
      socket.off("end-call", onEnd);
    };
    // eslint-disable-next-line
  }, []);

  const accept = async () => {
    try {
      const stream = await getMedia();
      const pc = createPC(incoming.fromSocketId);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: incoming.fromSocketId, answer });
      setIncoming(null);
      setStatus("Connecting...");
    } catch (e) {
      toast.error("Failed to accept: " + e.message);
    }
  };

  const reject = () => {
    if (incoming) socket.emit("call-rejected", { to: incoming.fromSocketId });
    setIncoming(null);
    nav("/");
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const replaceVideoTrack = async (newTrack) => {
    const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === "video");
    if (sender) await sender.replaceTrack(newTrack);
    if (localStreamRef.current) {
      const old = localStreamRef.current.getVideoTracks()[0];
      if (old) localStreamRef.current.removeTrack(old);
      localStreamRef.current.addTrack(newTrack);
      if (localRef.current) localRef.current.srcObject = localStreamRef.current;
    }
  };

  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screen;
      const screenTrack = screen.getVideoTracks()[0];
      await replaceVideoTrack(screenTrack);
      setSharing(true);
      setCamOn(true);
      screenTrack.onended = () => stopScreenShare();
    } catch (e) {
      if (e.name !== "NotAllowedError") toast.error("Screen share failed: " + e.message);
    }
  };

  const stopScreenShare = async () => {
    try {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      let camTrack = cameraTrackRef.current;
      if (!camTrack || camTrack.readyState === "ended") {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        camTrack = cam.getVideoTracks()[0];
        cameraTrackRef.current = camTrack;
      }
      await replaceVideoTrack(camTrack);
      setSharing(false);
      setCamOn(camTrack.enabled);
    } catch (e) {
      toast.error("Could not restore camera: " + e.message);
    }
  };

  const toggleShare = () => (sharing ? stopScreenShare() : startScreenShare());

  return (
    <div className="min-h-screen relative bg-black">
      <video ref={remoteRef} autoPlay playsInline className="w-full h-screen object-cover" />
      <video ref={localRef} autoPlay playsInline muted
        className="absolute bottom-6 right-6 w-40 h-28 md:w-56 md:h-40 object-cover rounded-xl border border-white/20 shadow-2xl" />

      <div className="absolute top-6 left-6 glass rounded-full px-4 py-2 text-sm">{status}</div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <button onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}
          className={`p-3 rounded-full ${micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700"}`}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}
          className={`p-3 rounded-full ${camOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700"}`}>
          {camOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
        </button>
        <button onClick={toggleShare} title={sharing ? "Stop sharing" : "Share screen"}
          className={`p-3 rounded-full ${sharing ? "bg-cyan-600 hover:bg-cyan-700" : "bg-white/10 hover:bg-white/20"}`}>
          {sharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>
        <button onClick={endAndLeave} title="End call"
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700">
          <PhoneOff size={18} /> End
        </button>
      </div>

      {incoming && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="glass rounded-2xl p-8 text-center">
            <h3 className="text-xl mb-1">Incoming call</h3>
            <p className="text-white/60 mb-6">from {incoming.from || "Unknown"}</p>
            <div className="flex gap-4 justify-center">
              <button onClick={accept} className="flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700">
                <Phone size={18} /> Accept
              </button>
              <button onClick={reject} className="flex items-center gap-2 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700">
                <X size={18} /> Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
