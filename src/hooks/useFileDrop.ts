import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useState } from "react";

export function useFileDrop(onDrop: (paths: string[]) => void) {
  const [isOver, setIsOver] = useState(false);

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
          onDrop(event.payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [onDrop]);

  return isOver;
}
