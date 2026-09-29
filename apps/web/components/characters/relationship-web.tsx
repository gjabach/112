'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Eye, Sparkles, Filter, Info, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Relationship {
  characterId: string;
  type: string;
  description: string;
}

interface Character {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  motivation?: string;
  relationships?: Relationship[];
  aliases?: string[];
}

interface RelationshipWebProps {
  characters: Character[];
  onSelectCharacter?: (char: Character) => void;
}

const relationTypeColors: Record<string, { label: string; stroke: string; bg: string; text: string }> = {
  love: { label: 'Tình cảm / Tri kỷ', stroke: '#ec4899', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400' },
  enemy: { label: 'Kẻ thù / Thù địch', stroke: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  rival: { label: 'Đối thủ cạnh tranh', stroke: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  ally: { label: 'Đồng minh / Bạn bè', stroke: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  mentor: { label: 'Sư đồ / Thầy trò', stroke: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  family: { label: 'Gia tộc / Huyết thống', stroke: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  subordinate: { label: 'Chủ tớ / Cấp bậc', stroke: '#eab308', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  default: { label: 'Mối quan hệ', stroke: '#94a3b8', bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400' }
};

export function RelationshipWeb({ characters, onSelectCharacter }: RelationshipWebProps) {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Position nodes in an orbital circle
  const { nodeMap, nodes, links } = useMemo(() => {
    const total = characters.length;
    const width = 800;
    const height = 560;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 85;

    const nMap: Record<string, { x: number; y: number; char: Character }> = {};
    const nList: Array<{ id: string; x: number; y: number; char: Character }> = [];

    characters.forEach((char, index) => {
      // Protagonists tend to be closer to center or top
      const angle = (index / Math.max(1, total)) * 2 * Math.PI - Math.PI / 2;
      const r = char.role === 'protagonist' ? radius * 0.75 : radius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      nMap[char.id] = { x, y, char };
      nList.push({ id: char.id, x, y, char });
    });

    const linkList: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      description: string;
      sourcePos: { x: number; y: number };
      targetPos: { x: number; y: number };
    }> = [];

    const addedPairs = new Set<string>();

    characters.forEach((char) => {
      if (Array.isArray(char.relationships)) {
        char.relationships.forEach((rel, rIdx) => {
          if (nMap[rel.characterId]) {
            const pairKey = [char.id, rel.characterId].sort().join('--');
            linkList.push({
              id: `${char.id}-${rel.characterId}-${rIdx}`,
              source: char.id,
              target: rel.characterId,
              type: (rel.type || 'default').toLowerCase(),
              description: rel.description || '',
              sourcePos: nMap[char.id],
              targetPos: nMap[rel.characterId]
            });
            addedPairs.add(pairKey);
          }
        });
      }
    });

    return { nodeMap: nMap, nodes: nList, links: linkList };
  }, [characters]);

  const activeChar = selectedCharId ? nodeMap[selectedCharId]?.char : null;

  // Filter links
  const visibleLinks = links.filter((link) => {
    if (filterType !== 'all' && link.type !== filterType) return false;
    if (selectedCharId) {
      return link.source === selectedCharId || link.target === selectedCharId;
    }
    return true;
  });

  // Calculate connected nodes
  const connectedNodeIds = useMemo(() => {
    if (!selectedCharId) return new Set<string>();
    const ids = new Set<string>([selectedCharId]);
    links.forEach((l) => {
      if (l.source === selectedCharId) ids.add(l.target);
      if (l.target === selectedCharId) ids.add(l.source);
    });
    return ids;
  }, [selectedCharId, links]);

  return (
    <div className="relative w-full h-[640px] bg-gradient-to-b from-card/80 to-background border border-border/70 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Relationship Filter Badges */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card/90 backdrop-blur-md border shadow-sm pointer-events-auto overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Tất cả quan hệ ({links.length})
          </button>
          {Object.entries(relationTypeColors)
            .filter(([k]) => k !== 'default')
            .map(([k, cfg]) => {
              const count = links.filter((l) => l.type === k).length;
              if (count === 0 && filterType !== k) return null;
              return (
                <button
                  key={k}
                  onClick={() => setFilterType(k)}
                  className={`text-xs px-2 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                    filterType === k
                      ? `${cfg.bg} ${cfg.text} font-semibold ring-1 ring-current`
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.stroke }} />
                  <span>{cfg.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-card/90 backdrop-blur-md border shadow-sm pointer-events-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
            title="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
            title="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => {
              setZoomLevel(1);
              setSelectedCharId(null);
              setFilterType('all');
            }}
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
            <Users className="w-10 h-10 text-muted-foreground/40 animate-pulse" />
            <span className="text-sm font-medium">Chưa có nhân vật nào để tạo sơ đồ quan hệ.</span>
            <span className="text-xs text-muted-foreground">Hãy thêm nhân vật và thiết lập các mối quan hệ tương tác!</span>
          </div>
        ) : (
          <svg
            viewBox="0 0 800 560"
            className="w-full h-full max-w-full max-h-full transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <defs>
              {/* Radial gradient background effects */}
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>

              {/* Marker arrows */}
              {Object.entries(relationTypeColors).map(([k, cfg]) => (
                <marker
                  key={`arrow-${k}`}
                  id={`arrow-${k}`}
                  viewBox="0 0 10 10"
                  refX="22"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={cfg.stroke} />
                </marker>
              ))}
            </defs>

            {/* Background Glow */}
            <circle cx="400" cy="280" r="280" fill="url(#centerGlow)" />
            <circle cx="400" cy="280" r="240" fill="none" stroke="currentColor" strokeOpacity="0.04" strokeDasharray="4 4" />
            <circle cx="400" cy="280" r="160" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="6 6" />

            {/* Connection Links */}
            {visibleLinks.map((link) => {
              const cfg = relationTypeColors[link.type] || relationTypeColors.default;
              const isHighlighted = selectedCharId
                ? link.source === selectedCharId || link.target === selectedCharId
                : true;
              const opacity = isHighlighted ? 0.85 : 0.12;

              // Curved path calculation
              const dx = link.targetPos.x - link.sourcePos.x;
              const dy = link.targetPos.y - link.sourcePos.y;
              const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
              const midX = (link.sourcePos.x + link.targetPos.x) / 2;
              const midY = (link.sourcePos.y + link.targetPos.y) / 2 - 12;

              return (
                <g key={link.id} className="transition-opacity duration-300" opacity={opacity}>
                  <path
                    d={`M ${link.sourcePos.x} ${link.sourcePos.y} A ${dr} ${dr} 0 0,1 ${link.targetPos.x} ${link.targetPos.y}`}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={isHighlighted && selectedCharId ? 2.5 : 1.5}
                    strokeDasharray={link.type === 'enemy' ? '4 3' : undefined}
                    markerEnd={`url(#arrow-${link.type})`}
                  />
                  {/* Link Label */}
                  {link.description && (
                    <text
                      x={midX}
                      y={midY}
                      fill={cfg.stroke}
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      className="select-none backdrop-blur-sm"
                    >
                      {link.description}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Character Nodes */}
            {nodes.map((node) => {
              const char = node.char;
              const isSelected = selectedCharId === char.id;
              const isConnected = selectedCharId ? connectedNodeIds.has(char.id) : true;
              const nodeOpacity = isConnected ? 1 : 0.25;

              const roleRingColor =
                char.role === 'protagonist'
                  ? '#f59e0b'
                  : char.role === 'antagonist'
                  ? '#ef4444'
                  : char.role === 'supporting'
                  ? '#3b82f6'
                  : '#94a3b8';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-opacity duration-300 group"
                  opacity={nodeOpacity}
                  onClick={() => {
                    setSelectedCharId(isSelected ? null : char.id);
                  }}
                  onDoubleClick={() => onSelectCharacter?.(char)}
                >
                  {/* Pulse aura on selection */}
                  {isSelected && (
                    <circle r="32" fill={roleRingColor} fillOpacity="0.2" className="animate-ping" />
                  )}

                  {/* Outer ring */}
                  <circle
                    r="25"
                    fill="var(--card)"
                    stroke={roleRingColor}
                    strokeWidth={isSelected ? 3.5 : 2}
                    className="transition-all duration-200 group-hover:scale-110 drop-shadow-md"
                  />

                  {/* Avatar or initial */}
                  <text
                    y="5"
                    fill="currentColor"
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="select-none pointer-events-none font-serif"
                  >
                    {char.name?.[0]?.toUpperCase() || 'N'}
                  </text>

                  {/* Character Name Label Badge */}
                  <g transform="translate(0, 38)">
                    <rect
                      x="-55"
                      y="-11"
                      width="110"
                      height="20"
                      rx="10"
                      fill="var(--card)"
                      stroke={isSelected ? roleRingColor : 'currentColor'}
                      strokeOpacity={isSelected ? 0.9 : 0.15}
                      className="shadow-sm"
                    />
                    <text
                      y="3"
                      fill="currentColor"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      className="select-none pointer-events-none truncate"
                    >
                      {char.name?.length > 12 ? char.name.slice(0, 11) + '…' : char.name}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Bottom Floating Character Detail Card when selected */}
      <AnimatePresence>
        {activeChar && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-3 left-3 right-3 p-3 bg-card/95 backdrop-blur-xl border border-primary/25 rounded-xl shadow-2xl flex items-center justify-between gap-3 z-30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center font-bold text-sm text-primary shrink-0">
                {activeChar.name?.[0]?.toUpperCase() || 'N'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm truncate text-foreground">{activeChar.name}</h4>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {activeChar.role === 'protagonist'
                      ? '🌟 Nhân vật chính'
                      : activeChar.role === 'antagonist'
                      ? '⚔️ Phản diện'
                      : '🤝 Nhân vật phụ'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate line-clamp-1 mt-0.5">
                  {activeChar.motivation || activeChar.personality || activeChar.appearance || 'Nhấp đúp chuột vào nút để mở hồ sơ đầy đủ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => onSelectCharacter?.(activeChar)}
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> Mở Hồ Sơ Chi Tiết
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
