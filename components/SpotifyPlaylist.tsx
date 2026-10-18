type SpotifyPlaylistProps = {
  url: string;
};

export function SpotifyPlaylist({ url }: SpotifyPlaylistProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-[#837E5E]/30 bg-black/20 shadow-2xl">
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="h-[352px] w-full"
          loading="lazy"
          src={url}
          title="Playlist de Spotify"
        />
      </div>
      <div className="mt-6 text-center">
        <a
          className="focus-ring inline-flex rounded-full border border-[#837E5E]/60 px-6 py-3 font-semibold text-[#F7F3EA]"
          href={url.replace("/embed", "")}
          rel="noreferrer"
          target="_blank"
        >
          Abrir Spotify
        </a>
      </div>
    </div>
  );
}
