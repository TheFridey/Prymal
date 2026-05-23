import { useUser } from '@clerk/clerk-react';

function resolveGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardGreeting({ orgName = 'your workspace' }) {
  const { user } = useUser();
  const firstName = user?.firstName?.trim();
  const greeting = resolveGreeting();

  return (
    <header className="pm-dash__command-header">
      <p className="pm-dash__command-greeting">
        {greeting}
        {firstName ? `, ${firstName}` : ''}
        {orgName ? ` · ${orgName}` : ''}
      </p>
      <h1 className="pm-dash__command-title">What do you want Prymal to help with today?</h1>
    </header>
  );
}
