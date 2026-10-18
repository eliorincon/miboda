"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type MusicPlayerProps = {
  src: string;
  enabled: boolean;
};

export function MusicPlayer({ src, enabled }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!enabled || !src || !audioRef.current) {
      return;
    }

    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [enabled, src]);

  if (!enabled) {
    return null;
  }

  const toggle = async () => {
    if (!audioRef.current || !src) {
      setPlaying((value) => !value);
      return;
    }

    if (audioRef.current.paused) {
      await audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      {src ? <audio ref={audioRef} loop src={src} /> : null}
      <button
        aria-label={playing ? "Pausar música" : "Reproducir música"}
        className="focus-ring fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-[#837E5E]/50 bg-[#F7F3EA] text-[#0C1D0E] shadow-2xl transition hover:scale-105"
        onClick={toggle}
        type="button"
      >
        {playing ? <Pause size={19} /> : <Play size={19} />}
      </button>
    </>
  );
}
