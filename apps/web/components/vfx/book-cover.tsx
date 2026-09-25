'use client';

import React from 'react';
import { BookOpen, Sparkles, Compass, Shield, Feather, Orbit, Flame, Ghost } from 'lucide-react';

interface BookCoverProps {
  title: string;
  genre?: string;
  author?: string;
  wordCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const GENRE_STYLES: Record<
  string,
  {
    bg: string;
    border: string;
    textAccent: string;
    icon: React.ComponentType<{ className?: string }>;
    motifName: string;
  }
> = {
  fantasy: {
    bg: 'from-violet-950 via-purple-900 to-indigo-950',
    border: 'border-purple-500/30',
    textAccent: 'text-purple-300',
    icon: Sparkles,
    motifName: 'Huyền Huyễn',
  },
  scifi: {
    bg: 'from-slate-950 via-cyan-950 to-blue-950',
    border: 'border-cyan-500/30',
    textAccent: 'text-cyan-300',
    icon: Orbit,
    motifName: 'Khoa Huyễn',
  },
  romance: {
    bg: 'from-rose-950 via-pink-900 to-amber-950',
    border: 'border-rose-400/30',
    textAccent: 'text-rose-300',
    icon: Feather,
    motifName: 'Lãng Mạn',
  },
  mystery: {
    bg: 'from-emerald-950 via-teal-950 to-slate-950',
    border: 'border-emerald-500/30',
    textAccent: 'text-emerald-300',
    icon: Compass,
    motifName: 'Trinh Thám',
  },
  thriller: {
    bg: 'from-neutral-950 via-red-950 to-zinc-950',
    border: 'border-red-500/30',
    textAccent: 'text-red-300',
    icon: Flame,
    motifName: 'Kỳ Ảo / Giật Gân',
  },
  horror: {
    bg: 'from-zinc-950 via-stone-900 to-black',
    border: 'border-stone-600/30',
    textAccent: 'text-stone-300',
    icon: Ghost,
    motifName: 'Kinh Dị',
  },
  literary: {
    bg: 'from-amber-950 via-stone-900 to-yellow-950',
    border: 'border-amber-500/30',
    textAccent: 'text-amber-300',
    icon: Feather,
    motifName: 'Văn Học',
  },
  historical: {
    bg: 'from-stone-900 via-amber-950 to-stone-950',
    border: 'border-amber-600/30',
    textAccent: 'text-amber-400',
    icon: Shield,
    motifName: 'Lịch Sử',
  },
  blank: {
    bg: 'from-slate-900 via-zinc-900 to-neutral-900',
    border: 'border-slate-700/30',
    textAccent: 'text-slate-300',
    icon: BookOpen,
    motifName: 'Tác Phẩm',
  },
};

export function BookCoverArt({
  title,
  genre = 'fantasy',
  author = 'Tác giả',
  wordCount,
  className = '',
  size = 'md',
}: BookCoverProps) {
  const normalizedGenre = (genre || 'fantasy').toLowerCase();
  const style = GENRE_STYLES[normalizedGenre] || GENRE_STYLES.fantasy;
  const IconComponent = style.icon;

  const sizeClasses = {
    sm: 'w-20 h-28 text-[9px] p-2',
    md: 'w-36 h-48 sm:w-40 sm:h-56 text-xs p-3',
    lg: 'w-52 h-72 sm:w-60 sm:h-80 text-sm p-5',
  };

  return (
    <div
      className={`relative select-none rounded-xl overflow-hidden shadow-xl border bg-gradient-to-br ${style.bg} ${style.border} ${sizeClasses[size]} ${className} flex flex-col justify-between group-hover:shadow-2xl transition-all duration-300 shrink-0`}
      style={{
        boxShadow:
          size === 'sm'
            ? '0 4px 14px rgba(0,0,0,0.3)'
            : '0 10px 30px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {/* Simulated 3D Book Spine Left highlight */}
      <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none z-10" />

      {/* Decorative celestial background watermark */}
      <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none">
        <IconComponent className={size === 'sm' ? 'w-16 h-16' : 'w-28 h-28'} />
      </div>

      {/* Header of book cover */}
      <div className="z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconComponent className={`w-3.5 h-3.5 ${style.textAccent}`} />
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75 text-white">
            {style.motifName}
          </span>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
      </div>

      {/* Center Title */}
      <div className="z-10 my-auto py-2">
        <h4 className="font-serif font-bold text-white leading-tight line-clamp-3 tracking-tight drop-shadow-md">
          {title || 'Chưa đặt tên'}
        </h4>
        <div className="w-8 h-0.5 bg-white/30 rounded-full mt-2" />
      </div>

      {/* Footer: Author & Word Count */}
      <div className="z-10 border-t border-white/10 pt-1.5 flex items-center justify-between text-[10px] text-white/70">
        <span className="truncate max-w-[70%] font-medium">{author}</span>
        {wordCount !== undefined && (
          <span className="font-mono text-[9px] opacity-80 shrink-0">
            {wordCount >= 1000 ? `${(wordCount / 1000).toFixed(1)}k` : wordCount} từ
          </span>
        )}
      </div>
    </div>
  );
}
