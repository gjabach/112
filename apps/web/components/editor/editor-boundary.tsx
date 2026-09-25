'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { countWords } from '@/lib/utils';

interface Props {
  children: ReactNode;
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function extractRawText(raw: string): string {
  if (!raw) return '';
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === 'object') {
      const getTxt = (n: any): string => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (n.text) return n.text;
        if (Array.isArray(n.content)) return n.content.map(getTxt).join(n.type === 'paragraph' ? '\n' : ' ');
        return '';
      };
      if (Array.isArray(json.content)) {
        return json.content.map(getTxt).join('\n\n');
      }
    }
  } catch {}
  // Strip basic html tags if any
  return raw.replace(/<[^>]+>/g, '');
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EditorErrorBoundary caught an error in TipTap:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const rawText = extractRawText(this.props.content);
      const words = countWords(rawText);

      return (
        <div className="flex flex-col h-full w-full">
          {/* Fallback Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 sm:px-6 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Chế độ soạn thảo an toàn (Manuscript Fallback)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{words.toLocaleString()} từ • {rawText.length.toLocaleString()} ký tự</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 border-amber-500/30 hover:bg-amber-500/20"
                onClick={this.handleRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Thử lại TipTap
              </Button>
            </div>
          </div>

          {/* Fallback Manuscript Textarea */}
          <div className="flex-1 p-4 sm:p-6 md:p-12 overflow-auto">
            <textarea
              className="w-full max-w-3xl mx-auto block min-h-[60vh] bg-transparent resize-none border-0 focus:outline-none focus:ring-0 text-base sm:text-lg leading-relaxed text-foreground font-serif selection:bg-primary/20 placeholder:text-muted-foreground/60"
              value={rawText}
              placeholder={this.props.placeholder || 'Bắt đầu viết chương này...'}
              onChange={(e) => {
                const val = e.target.value;
                // Convert plain lines into standard TipTap JSON paragraphs so data format remains consistent
                const paras = val.split('\n\n').filter(p => p.length > 0).map(p => ({
                  type: 'paragraph',
                  content: [{ type: 'text', text: p }]
                }));
                const jsonDoc = JSON.stringify({
                  type: 'doc',
                  content: paras.length > 0 ? paras : [{ type: 'paragraph' }]
                });
                this.props.onChange(jsonDoc);
              }}
              rows={20}
              autoFocus
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
