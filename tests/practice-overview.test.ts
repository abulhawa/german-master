import { describe, expect, it } from 'vitest'

import { buildPracticeSessionScopeKey } from '@/lib/practice-overview'
import { createDefaultSettings } from '@/lib/practice-settings'

describe('practice overview scope keys', () => {
  it('returns the normal scope key when B2 exam mode is disabled', () => {
    const settings = createDefaultSettings()

    const scopeKey = buildPracticeSessionScopeKey(settings)
    expect(scopeKey).toBe('V-A1')
  })

  it('appends a b2 suffix when B2 exam mode is enabled', () => {
    const settings = createDefaultSettings()
    settings.cefrLevelByPos.N = 'B2'
    settings.b2ExamMode = true

    const scopeKey = buildPracticeSessionScopeKey(settings)
    expect(scopeKey).toBe('V-A1__N-B2__b2')
  })
})
