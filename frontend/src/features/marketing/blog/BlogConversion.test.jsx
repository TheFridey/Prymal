import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { BlogLeadMagnet } from './BlogLeadMagnet';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

test('BlogLeadMagnet renders workflow template pack capture', () => {
  renderWithProviders(<BlogLeadMagnet slug="test-post" />);
  expect(screen.getByText(/AI workflow template pack/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Send me the pack/i })).toHaveAttribute('data-cta', 'lead-magnet');
});
