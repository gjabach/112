'use client';
import { useState } from 'react';
import { Feather } from 'lucide-react';
interface BookCoverProps {
  title: string;
  genre?: string;
  author?: string;
  coverUrl?: string | null;
  wordCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
const GENRE_STYLES: Record<string, { color: string; label: string }> = {
  fantasy: { color: '#36584E', label: 'Huyền huyễn' },
  scifi: { color: '#3C5263', label: 'Khoa huyễn' },
  romance: { color: '#825951', label: 'Lãng mạn' },
  mystery: { color: '#454F42', label: 'Trinh thám' },
  thriller: { color: '#633E35', label: 'Giật gân' },
  horror: { color: '#3D3F3C', label: 'Kinh dị' },
  literary: { color: '#756047', label: 'Văn học' },
  historical: { color: '#6A5038', label: 'Lịch sử' },
  blank: { color: '#526059', label: 'Tác phẩm' },
};
export function BookCoverArt({
  title,
  genre = 'blank',
  author = 'Tác giả',
  coverUrl,
  className = '',
  size = 'md',
}: BookCoverProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const style = GENRE_STYLES[genre.toLowerCase()] || GENRE_STYLES.blank;
  const custom = Boolean(coverUrl && failedUrl !== coverUrl);
  const sizes = {
    sm: 'w-24 h-36 p-3 text-[11px]',
    md: 'w-36 h-52 sm:w-40 sm:h-60 p-4 text-sm',
    lg: 'w-48 h-72 sm:w-56 sm:h-80 p-5 text-base',
  };
  return (
    <div
      className={`relative flex shrink-0 flex-col justify-between overflow-hidden rounded-r-lg rounded-l-sm text-[#FFF5DE] shadow-md ${sizes[size]} ${className}`}
      style={{ backgroundColor: style.color }}
    >
      {custom && (
        <img
          src={coverUrl!}
          alt={title || 'Bìa tác phẩm'}
          onError={() => setFailedUrl(coverUrl!)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-2 border-r border-white/15 bg-black/15"
      />
      {custom ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35" />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-3 border border-[#D6BB83]/35"
          />
          <svg
            viewBox="0 0 120 160"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full text-[#D6BB83]/20"
            fill="none"
          >
            <circle cx="85" cy="90" r="40" stroke="currentColor" />
            <circle cx="85" cy="90" r="30" stroke="currentColor" />
            <path
              d="M0 140 120 20M0 150 120 30M65 0v160"
              stroke="currentColor"
            />
          </svg>
        </>
      )}
      <div className="relative pl-1">
        <p className="text-[8px] uppercase tracking-widest opacity-85">
          {style.label}
        </p>
      </div>
      <div className="relative pl-1">
        <Feather
          aria-hidden="true"
          className="mb-2 h-4 w-4 opacity-75"
          strokeWidth={1.3}
        />
        <h3 className="line-clamp-3 break-words font-serif text-[1.15em] leading-tight">
          {title || 'Chưa đặt tên'}
        </h3>
        <div className="mb-2 mt-3 h-px w-6 bg-[#D6BB83]/70" />
        <p className="truncate text-[8px] opacity-80">{author}</p>
      </div>
    </div>
  );
}
