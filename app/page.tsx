"use client";
import { useEffect, useRef } from "react";
export default function Desktop() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("@platinum/shell").then(async ({ boot }) => {
      if (!cancelled && root.current) dispose = await boot(root.current);
      if (cancelled) dispose?.();
    }).catch((error) => {
      console.error(error);
      if (root.current) root.current.textContent = "The Macintosh could not start. Reload to try again. " + error.message;
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <main ref={root} id="macintosh" aria-label="Mac OS 9 desktop"><div className="boot-screen"><div className="boot-mac">☻</div><p>Starting up…</p></div></main>;
}
