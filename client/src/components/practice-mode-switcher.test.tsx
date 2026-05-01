import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PracticeModeSwitcher, type PracticeScope } from '@/components/practice-mode-switcher';
import type { TaskType } from '@shared';

const AVAILABLE_TYPES: TaskType[] = ['conjugate_form', 'noun_case_declension', 'adj_ending'];

describe('PracticeModeSwitcher B2 Beruf preset', () => {
  it('shows B2 Beruf as a vocabulary collection preset', async () => {
    const handleScopeChange = vi.fn<(scope: PracticeScope) => void>();

    render(
      <PracticeModeSwitcher
        scope="verbs"
        onScopeChange={handleScopeChange}
        selectedTaskTypes={['conjugate_form']}
        onTaskTypesChange={vi.fn()}
        availableTaskTypes={AVAILABLE_TYPES}
        scopeBadgeLabel="Verbs only"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /adjust practice scope/i }));

    const b2BerufTab = screen.getByRole('tab', { name: 'B2 Beruf' });
    expect(b2BerufTab).toBeInTheDocument();

    await userEvent.click(b2BerufTab);

    expect(handleScopeChange).toHaveBeenCalledWith('b2Beruf');
  });
});
