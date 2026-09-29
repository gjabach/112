'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Activity, CheckCircle2, Clock, ArrowRight, BookOpen, Layers } from 'lucide-react';
import Link from 'next/link';

interface OutlineNode {
  id: string;
  projectId: string;
  parentId: string | null;
  type: string;
  title: string;
  description?: string;
  status: string;
  color?: string;
  orderIndex?: number;
  linkedChapterId?: string | null;
}

interface StoryArcVisualizerProps {
  nodes: OutlineNode[];
  projectId: string;
  onSelectNode?: (node: OutlineNode) => void;
}

const arcStages = [
  { id: 'setup', name: 'Hồi I: Mở Đầu', subtitle: 'Thế giới thường nhật & Inciting Incident', tension: 25, x: 70, y: 320, pct: '0-15%' },
  { id: 'catalyst', name: 'Cú Hích / Vượt Ngưỡng', subtitle: 'Dấn thân vào thế giới mới', tension: 45, x: 180, y: 250, pct: '25%' },
  { id: 'rising', name: 'Xung Đột Leo Thang', subtitle: 'Thử thách, đồng minh & cạm bẫy', tension: 65, x: 300, y: 190, pct: '35-45%' },
  { id: 'midpoint', name: 'Đỉnh Giữa Truyện (Midpoint)', subtitle: 'Chiến thắng giả hoặc thất bại lớn', tension: 85, x: 430, y: 120, pct: '50%' },
  { id: 'all_lost', name: 'Đêm Đen Linh Hồn (All Is Lost)', subtitle: 'Chạm đáy tuyệt vọng & Tìm ra chân lý', tension: 35, x: 550, y: 280, pct: '75%' },
  { id: 'climax', name: 'Đại Cao Trào (Climax)', subtitle: 'Trận chiến quyết định vận mệnh', tension: 100, x: 670, y: 70, pct: '85-95%' },
  { id: 'resolution', name: 'Hạ Màn & Thế Giới Mới', subtitle: 'Hậu quả, biến đổi & Cân bằng mới', tension: 30, x: 770, y: 310, pct: '100%' }
];

export function StoryArcVisualizer({ nodes, projectId, onSelectNode }: StoryArcVisualizerProps) {
  const [activeStageId, setActiveStageId] = useState<string>('midpoint');

  // Map outline nodes to nearest arc stage based on orderIndex
  const stageNodes = arcStages.map((stage, sIdx) => {
    const total = Math.max(1, nodes.length);
    const stageStartPct = (sIdx / arcStages.length) * 100;
    const stageEndPct = ((sIdx + 1) / arcStages.length) * 100;

    const matchedNodes = nodes.filter((n, nIdx) => {
      const nodePct = ((n.orderIndex ?? nIdx) / total) * 100;
      return nodePct >= stageStartPct && nodePct < stageEndPct;
    });

    return {
      ...stage,
      nodes: matchedNodes
    };
  });

  const activeStage = stageNodes.find(s => s.id === activeStageId) || stageNodes[3];

  return (
    <div className="relative w-full bg-gradient-to-b from-card to-background border border-border/70 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <span>Đồ Thị Nhịp Cao Trào Cốt Truyện (Narrative Arc)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mô phỏng đường cong căng thẳng cảm xúc từ Mở đầu, Điểm kích động tới Đỉnh cao trào và Hạ màn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            {nodes.length} phân cảnh được ánh xạ
          </Badge>
        </div>
      </div>

      {/* Tension Curve SVG Canvas */}
      <div className="relative w-full h-[360px] bg-muted/10 border border-border/50 rounded-xl overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 850 380" className="w-full h-full select-none">
          <defs>
            {/* Curve gradient */}
            <linearGradient id="arcLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="35%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="75%" stopColor="#8b5cf6" />
              <stop offset="90%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <linearGradient id="arcAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0.0" />
            </linearGradient>

            {/* Filter glow */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="50" y1="90" x2="800" y2="90" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />
          <line x1="50" y1="180" x2="800" y2="180" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />
          <line x1="50" y1="270" x2="800" y2="270" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4 4" />
          <line x1="50" y1="340" x2="800" y2="340" stroke="currentColor" strokeOpacity="0.1" />

          {/* Tension Level Labels */}
          <text x="35" y="80" fill="currentColor" fillOpacity="0.4" fontSize="10" textAnchor="end">100% (Cao trào)</text>
          <text x="35" y="185" fill="currentColor" fillOpacity="0.4" fontSize="10" textAnchor="end">50% (Đối đầu)</text>
          <text x="35" y="340" fill="currentColor" fillOpacity="0.4" fontSize="10" textAnchor="end">0% (Bình yên)</text>

          {/* Smooth Bezier Arc Path Area */}
          <path
            d="M 70 320 C 130 300, 150 260, 180 250 C 230 230, 270 200, 300 190 C 350 170, 390 130, 430 120 C 480 150, 520 260, 550 280 C 600 240, 640 100, 670 70 C 710 130, 740 280, 770 310 L 770 340 L 70 340 Z"
            fill="url(#arcAreaGrad)"
          />

          {/* Smooth Bezier Arc Line */}
          <path
            d="M 70 320 C 130 300, 150 260, 180 250 C 230 230, 270 200, 300 190 C 350 170, 390 130, 430 120 C 480 150, 520 260, 550 280 C 600 240, 640 100, 670 70 C 710 130, 740 280, 770 310"
            fill="none"
            stroke="url(#arcLineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Interactive Checkpoint Nodes */}
          {stageNodes.map((st) => {
            const isSelected = activeStageId === st.id;
            const hasNodes = st.nodes.length > 0;

            return (
              <g
                key={st.id}
                className="cursor-pointer group"
                onClick={() => setActiveStageId(st.id)}
              >
                {/* Active Pulse */}
                {isSelected && (
                  <circle cx={st.x} cy={st.y} r="18" fill="var(--primary)" fillOpacity="0.25" className="animate-ping" />
                )}

                {/* Outer Pin Circle */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={isSelected ? 11 : 8}
                  fill="var(--card)"
                  stroke={isSelected ? 'var(--primary)' : '#94a3b8'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-200 group-hover:scale-125 drop-shadow-md"
                />

                {/* Center dot */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r="4"
                  fill={isSelected ? 'var(--primary)' : (hasNodes ? '#3b82f6' : '#cbd5e1')}
                />

                {/* Percentage label */}
                <text
                  x={st.x}
                  y={st.y + 24}
                  fill="currentColor"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                  fillOpacity={isSelected ? 1 : 0.6}
                >
                  {st.pct}
                </text>

                {/* Node count pill */}
                {hasNodes && (
                  <g transform={`translate(${st.x + 8}, ${st.y - 12})`}>
                    <circle r="7" fill="#3b82f6" />
                    <text y="3" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">
                      {st.nodes.length}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Active Stage Detail & Linked Outline Scenes */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-foreground">
                {activeStage.name}
              </h4>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                Mức căng thẳng: {activeStage.tension}%
              </Badge>
              <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                Vị trí: {activeStage.pct}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{activeStage.subtitle}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            {activeStage.nodes.length} phân cảnh thuộc mốc này
          </div>
        </div>

        {/* Linked Scenes in this stage */}
        <div className="space-y-2">
          {activeStage.nodes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs border border-dashed rounded-xl">
              Chưa có phân cảnh dàn ý nào được gắn vào nhịp này. Hãy thêm cảnh trong tab Dàn ý!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeStage.nodes.map(n => (
                <div
                  key={n.id}
                  onClick={() => onSelectNode?.(n)}
                  className="rounded-xl border border-border/70 p-3 bg-muted/15 hover:bg-muted/30 transition-all cursor-pointer space-y-2 group shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {n.title}
                    </span>
                    <Badge variant={n.status === 'written' ? 'default' : 'outline'} className="text-[9px] px-1.5 py-0 shrink-0">
                      {n.status === 'written' ? 'Hoàn thành' : n.status === 'drafting' ? 'Đang viết' : 'Ý tưởng'}
                    </Badge>
                  </div>

                  {n.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.description}
                    </p>
                  )}

                  {n.linkedChapterId && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-primary">
                      <span className="flex items-center gap-1 font-medium">
                        <BookOpen className="w-3 h-3" /> Đã liên kết chương
                      </span>
                      <Link href={`/editor/${projectId}/${n.linkedChapterId}`} onClick={e => e.stopPropagation()}>
                        <span className="underline hover:text-primary/80">Viết ngay →</span>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
