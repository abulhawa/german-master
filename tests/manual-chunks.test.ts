import { describe, expect, it } from 'vitest';

import { classifyManualChunk } from '../scripts/manual-chunks';

describe('classifyManualChunk', () => {
  it('splits large stable frontend dependency families out of vendor', () => {
    expect(classifyManualChunk('/repo/node_modules/@radix-ui/react-dialog/dist/index.mjs')).toBe('ui-vendor');
    expect(classifyManualChunk('/repo/node_modules/framer-motion/dist/es/index.mjs')).toBe('motion');
    expect(classifyManualChunk('/repo/node_modules/@supabase/supabase-js/dist/module/index.js')).toBe('supabase');
  });

  it('keeps app modules unclassified and unknown dependencies in vendor', () => {
    expect(classifyManualChunk('/repo/client/src/App.tsx')).toBeUndefined();
    expect(classifyManualChunk('/repo/node_modules/react/index.js')).toBe('vendor');
    expect(classifyManualChunk('/repo/node_modules/small-package/index.js')).toBe('vendor');
  });
});
