import { useEffect, useRef, useState } from "react";

export const useFitScale = () => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const fit = () =>
      setScale(Math.min(1, box.clientHeight / content.offsetHeight));
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { boxRef, contentRef, scale };
};
