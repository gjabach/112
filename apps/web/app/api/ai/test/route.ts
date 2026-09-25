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

    const requestedModel = (reqModel || (providerName === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini')).trim();
    const provider = createAIProvider(providerName);

    // If gemini, prioritize requested model, but try modern active models if 404 occurs
    const candidateModels = providerName === 'gemini'
      ? [requestedModel, 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'].filter((m, i, arr) => arr.indexOf(m) === i)
      : [requestedModel];

    let lastError: any = null;
    let successfulModel = '';
    let pingResponse = '';

    for (const testModel of candidateModels) {
      try {
        pingResponse = await provider.chat({
          model: testModel,
          messages: [
            { role: 'user', content: 'Hãy trả lời chính xác một từ duy nhất: OK' }
          ],
          apiKey: effectiveKey,
          temperature: 0.1,
          maxTokens: 16,
          _disableFallback: true
        } as any);
        successfulModel = testModel;
        break;
      } catch (err: any) {
        lastError = err;
        // If 404 (model not found), continue trying the next candidate model
        if (err.message && err.message.includes('404')) {
          continue;
        }
        // If auth error (401/403) or rate limit, break immediately
        break;
      }
    }

    if (!successfulModel) {
      return NextResponse.json({
        success: false,
        error: lastError?.message || 'Không thể kết nối tới nhà cung cấp AI'
      }, { status: 400 });
    }

    const autoAdjusted = successfulModel !== requestedModel;
    const message = autoAdjusted
      ? `Kết nối thành công! Đã tự động chọn model khả dụng: ${successfulModel} (do tài khoản của bạn chưa kích hoạt ${requestedModel}).`
      : `Kết nối thành công tới ${providerName.toUpperCase()} (Model: ${successfulModel})!`;

    return NextResponse.json({
      success: true,
      model: successfulModel,
      autoAdjusted,
      message,
      reply: pingResponse.trim()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Không thể kết nối tới nhà cung cấp AI'
    }, { status: 400 });
  }
}
