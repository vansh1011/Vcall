import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Video } from "lucide-react";
import { api } from "../api";

export default function Login() {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    const r = await api("/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
    const j = await r.json();
    if (!r.ok) return toast.error(j.error || "Login failed");
    toast.success("Welcome back!");
    nav("/");
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="glass rounded-2xl p-8 w-full max-w-md space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl btn-grad"><Video size={22} /></div>
          <h1 className="text-2xl font-semibold">Sign in to Vcall</h1>
        </div>
        <input className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 outline-none focus:border-fuchsia-400"
          placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} />
        <input type="password" className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 outline-none focus:border-fuchsia-400"
          placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
        <button className="w-full py-3 rounded-lg btn-grad font-medium">Sign in</button>
        <p className="text-sm text-white/60 text-center">No account? <Link to="/register" className="text-cyan-400">Register</Link></p>
      </form>
    </div>
  );
}
