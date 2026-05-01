import { afterEach, describe, expect, it } from 'vitest';

import { createApiInvoker } from './helpers/vercel';
import { createVercelApiHandler } from '../server/api/vercel-handler.js';

describe('features API', () => {
  const originalEnableWritingLab = process.env.ENABLE_WRITING_LAB;
  const originalGroqApiKey = process.env.GROQ_API_KEY;
  const invokeApi = createApiInvoker(createVercelApiHandler({ enableCors: false }));

  afterEach(() => {
    if (originalEnableWritingLab === undefined) {
      delete process.env.ENABLE_WRITING_LAB;
    } else {
      process.env.ENABLE_WRITING_LAB = originalEnableWritingLab;
    }

    if (originalGroqApiKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalGroqApiKey;
    }
  });

  it('keeps Writing Lab disabled without its explicit feature flag', async () => {
    delete process.env.ENABLE_WRITING_LAB;
    process.env.GROQ_API_KEY = 'test-groq-key';

    const response = await invokeApi('/api/features');

    expect(response.status).toBe(200);
    expect(response.bodyJson).toEqual({ features: { writingLab: false } });
  });

  it('keeps Writing Lab disabled when Groq is unavailable', async () => {
    process.env.ENABLE_WRITING_LAB = 'true';
    delete process.env.GROQ_API_KEY;

    const response = await invokeApi('/api/features');

    expect(response.status).toBe(200);
    expect(response.bodyJson).toEqual({ features: { writingLab: false } });
  });

  it('enables Writing Lab only when the flag and Groq key are both present', async () => {
    process.env.ENABLE_WRITING_LAB = 'true';
    process.env.GROQ_API_KEY = 'test-groq-key';

    const response = await invokeApi('/api/features');

    expect(response.status).toBe(200);
    expect(response.bodyJson).toEqual({ features: { writingLab: true } });
  });
});
