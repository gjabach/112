import { NextRequest, NextResponse } from 'next/server';
import { createAIProvider, type AIProviderName } from '@novelist/ai-core/src/providers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider: reqProvider, model: reqModel, apiKey } = body;

    const providerName: AIProviderName = reqProvider || 'gemini';
    const effectiveKey = (apiKey || process.env.AI_API_KEY || '').trim();

    if (!effectiveKey && providerName !== 'ollama') {
      return NextResponse.json({
        success: false,
        error: `Vui lòng nhập API key của ${providerName.toUpperCase()}`
      }, { status: 400 });
    }

    const modelName = (reqModel || (providerName === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini')).trim();
    const provider = createAIProvider(providerName);

    // Quick verification ping
    const pingResponse = await provider.chat({
      model: modelName,
      messages: [
        { role: 'user', content: 'Hãy trả lời chính xác một từ duy nhất: OK' }
      ],
      apiKey: effectiveKey,
      temperature: 0.1,
      maxTokens: 16
    });

    return NextResponse.json({
      success: true,
      message: `Kết nối thành công tới ${providerName.toUpperCase()} (Model: ${modelName})!`,
      reply: pingResponse.trim()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Không thể kết nối tới nhà cung cấp AI'
    }, { status: 400 });
  }
}
