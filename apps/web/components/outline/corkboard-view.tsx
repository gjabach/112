'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CorkboardViewProps {
  nodes: any[];
  onUpdate: (id: string, data: any) => void;
}

export function CorkboardView({ nodes, onUpdate }: CorkboardViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Simulate corkboard with random rotations
  const getRotation = (id: string) => {
    const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    return (hash % 6) - 3; // -3 to 3 degrees
  };

  return (
    <div className="relative min-h-[600px] bg-[#f5e6d3] dark:bg-[#2a2520] rounded-xl p-8 overflow-auto"
         style={{
           backgroundImage: `radial-gradient(#d4c4a8 1px, transparent 1px)`,
           backgroundSize: '20px 20px'
         }}>
      
      {/* Corkboard texture overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
           }}></div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min">
        {nodes.map((node: any) => {
          const rotation = getRotation(node.id);
          const isSelected = selectedId === node.id;
          
          return (
            <Card
              key={node.id}
              className={`cursor-pointer transition-all hover:shadow-xl hover:z-10 hover:scale-105 bg-yellow-50 dark:bg-yellow-900/20 border-2 shadow-md
                ${isSelected ? 'ring-2 ring-primary z-20 scale-105' : ''}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                borderTopColor: node.color || '#facc15'
              }}
              onClick={() => setSelectedId(isSelected ? null : node.id)}
            >
              {/* Pin */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full shadow-md border-2 border-red-600 z-10"></div>
              
              <CardContent className="p-4 pt-6">
                <div className="font-handwriting font-bold text-sm mb-2 text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Crimson Pro, serif' }}>
                  {node.title}
                </div>
                
                {node.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed">
                    {node.description}
                  </div>
                )}

                <div className="flex gap-1 mt-3 flex-wrap">
                  <Badge variant="outline" className="text-[10px] bg-white/50">{node.type}</Badge>
                  <Badge className={`text-[10px] text-white ${
                    node.status === 'idea' ? 'bg-gray-500' :
                    node.status === 'planned' ? 'bg-blue-500' :
                    node.status === 'written' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {node.status}
                  </Badge>
                </div>

                {/* Tape effect */}
                <div className="absolute -top-1 -right-1 w-12 h-6 bg-white/40 rotate-12 shadow-sm"></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="relative text-center py-20 text-muted-foreground">
          <div className="text-6xl mb-4">📌</div>
          <p>Bảng ghim trống - Thêm outline nodes để ghim lên đây</p>
        </div>
      )}

      <style jsx>{`
        .font-handwriting {
          font-family: 'Crimson Pro', cursive;
        }
      `}</style>
    </div>
  );
}
