import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import SlashCommandMenu from './SlashCommandMenu';

describe('SlashCommandMenu', () => {
  test('renders listbox semantics and active option state', () => {
    render(
      <SlashCommandMenu
        open
        commands={[
          { name: 'clear', description: 'Clear the chat' },
          { name: 'settings', description: 'Open settings' },
        ]}
        commandIndex={1}
        commandFilter="s"
        listboxId="composer-slash-menu"
        onApply={() => {}}
      />,
    );

    expect(screen.getByRole('listbox', { name: 'Slash commands' })).toHaveAttribute('id', 'composer-slash-menu');
    expect(screen.getByRole('option', { name: /\/settings/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /\/clear/i })).toHaveAttribute('aria-selected', 'false');
  });
});
