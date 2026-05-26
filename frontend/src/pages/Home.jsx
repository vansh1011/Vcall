import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { LogOut, PhoneCall, Video, Users } from "lucide-react";
import { api } from "../api";
import { socket } from "../socket";

export default function Home() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState({});
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const r = await api("/home");
      if (r.status === 401) return nav("/login");
      const j = await r.json();
      setMe(j.user);
      if (!socket.connected) socket.connect();
      socket.emit("register", j.user.username);
    })();

    const onUsers = (list) => setUsers(list);
    const onOffer = (data) => {
      toast.info(`Incoming call from ${data.from || "Unknown"}`);
      nav("/call", { state: { incoming: data } });
    };
    socket.on("online-users", onUsers);
    socket.on("offer", onOffer);
    return () => {
      socket.off("online-users", onUsers);
      socket.off("offer", onOffer);
    };
  }, [nav]);

  const logout = async () => {
    await api("/logout", { method: "POST" });
    socket.disconnect();
    nav("/login");
  };

  const call = (username, sid) => {
    nav("/call", { state: { targetSocketId: sid, targetUsername: username, outgoing: true } });
  };

  const others = Object.entries(users).filter(([u]) => u !== me?.username);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl btn-grad"><Video size={22} /></div>
          <h1 className="text-2xl font-semibold">Vcall</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70">Hi, <span className="text-white font-medium">{me?.username}</span></span>
          <button onClick={logout} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg glass hover:bg-white/10">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <aside className="glass rounded-2xl p-5 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-fuchsia-400" />
            <h2 className="font-medium">Online users</h2>
            <span className="ml-auto text-xs text-white/50">{others.length}</span>
          </div>
          {others.length === 0 && <p className="text-sm text-white/50">No one else online yet.</p>}
          <ul className="space-y-2">
            {others.map(([u, sid]) => (
              <li key={u} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{u}</span>
                </div>
                <button onClick={() => call(u, sid)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md btn-grad">
                  <PhoneCall size={14} /> Call
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="glass rounded-2xl p-8 md:col-span-2 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl btn-grad mb-4"><Video size={32} /></div>
          <h2 className="text-2xl font-semibold mb-2">Start a 1:1 video call</h2>
          <p className="text-white/60 max-w-md">Pick someone from the online list to call. Calls are peer-to-peer via WebRTC.</p>
        </section>
      </div>
    </div>
  );
}
