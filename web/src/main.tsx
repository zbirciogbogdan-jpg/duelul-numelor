import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Home from "./Home.tsx";
import Duel from "./Duel.tsx";
import { navigate } from "./ui.tsx";
import { moonAt, roDate } from "./engine.ts";

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const WDAYS = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];

function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const now = new Date();
  const t = roDate(now);
  const m = path.match(/^\/d\/([a-z0-9]{5,10})\/?$/);
  return (
    <>
      <header className="wrap">
        <div className="topbar">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Duelul Numelor</a>
          <span className="today">{WDAYS[t.wd]}, {t.d} {MONTHS[t.m - 1]}<br />{moonAt(now).name}</span>
        </div>
      </header>
      <main style={{ marginTop: 18 }}>
        {m ? <Duel key={m[1]} code={m[1]} /> : <Home />}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
