import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";

/** Tauri drag-drop state. The callback lives in a ref so the native
 *  listener registers once per mount instead of on every parent render. */
export function useFileDrop(onDrop: (paths: string[]) => void) {
  const [isOver, setIsOver] = useState(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter") {
          setIsOver(true);
        } else if (event.payload.type === "leave") {
          setIsOver(false);
        } else if (event.payload.type === "drop") {
          setIsOver(false);
          dropRef.current(event.payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  return isOver;
}
