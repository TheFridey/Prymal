export default function SlashCommandMenu({
  open,
  commands,
  commandIndex,
  commandFilter,
  listboxId,
  onApply,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      id={listboxId}
      className="workspace-studio__command-menu"
      role="listbox"
      aria-label="Slash commands"
    >
      {commands.length > 0 ? (
        commands.map((command, index) => (
          <button
            key={command.name}
            id={`slash-cmd-${command.name}`}
            type="button"
            role="option"
            aria-selected={index === commandIndex}
            className={`workspace-studio__command-item${index === commandIndex ? ' is-active' : ''}`}
            onMouseDown={(event) => {
              event.preventDefault();
              onApply(command);
            }}
          >
            <span className="workspace-studio__command-name">/{command.name}</span>
            <span className="workspace-studio__command-description">{command.description}</span>
          </button>
        ))
      ) : (
        <div className="workspace-studio__command-empty" role="status">
          No commands match &quot;/{commandFilter.trim()}&quot;.
        </div>
      )}
    </div>
  );
}
