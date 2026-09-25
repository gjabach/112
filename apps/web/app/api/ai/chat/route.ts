import { NextRequest, NextResponse } from 'next/server';
import { createAIProvider, type AIProviderName } from '@novelist/ai-core/src/providers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, systemPrompt, provider: reqProvider, model: reqModel, apiKey, stream = true } = body;

    if (!message) {
      return NextResponse.json({ error: 'Nội dung tin nhắn không được để trống' }, { status: 400 });
    }

    const providerName: AIProviderName = reqProvider || 'gemini';
    const effectiveKey = (apiKey || process.env.AI_API_KEY || '').trim();

    if (!effectiveKey && providerName !== 'ollama') {
      return NextResponse.json({
        error: `Chưa có API key cho ${providerName.toUpperCase()}. Vui lòng cấu hình API key trong Cài đặt.`
      }, { status: 400 });
    }

    const modelName = (reqModel || (providerName === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini')).trim();
    const provider = createAIProvider(providerName);

    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    if (stream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of provider.chatStream({
              model: modelName,
              messages,
              apiKey: effectiveKey,
              stream: true
            })) {
              if (chunk.content) {
                const sseLine = `data: ${JSON.stringify({ content: chunk.content })}\n\n`;
                controller.enqueue(encoder.encode(sseLine));
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (err: any) {
            const errLine = `data: ${JSON.stringify({ error: err.message || 'Lỗi xử lý AI' })}\n\n`;
            controller.enqueue(encoder.encode(errLine));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(customStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    } else {
      const content = await provider.chat({
        model: modelName,
        messages,
        apiKey: effectiveKey
      });
      return NextResponse.json({ content });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi server AI' }, { status: 500 });
  }
}
