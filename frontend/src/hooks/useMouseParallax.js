import { useEffect, useState } from "react";

export function useMouseParallax(intensity = 18) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (event) => {
      const { innerWidth, innerHeight } = window;
      const x = ((event.clientX / innerWidth) - 0.5) * intensity;
      const y = ((event.clientY / innerHeight) - 0.5) * intensity;
      setOffset({ x, y });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
    };
  }, [intensity]);

  return offset;
}
