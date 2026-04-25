export function formatNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-GB') : '0';
}

export function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(value, maxLength = 120) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
}

export function isPlaceholderEmail(value) {
  return /@placeholder\.invalid$/i.test(String(value ?? '').trim());
}

export function formatUserHandle(userOrEmail, fallbackId = null) {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
  const id = typeof userOrEmail === 'string' ? fallbackId : userOrEmail?.id ?? fallbackId;
  const normalizedEmail = String(email ?? '').trim();

  if (!normalizedEmail) {
    return id ? `Prymal user ${truncate(String(id), 12)}` : 'Prymal user';
  }

  if (isPlaceholderEmail(normalizedEmail)) {
    const localPart = normalizedEmail.split('@')[0];
    const clerkId = localPart.startsWith('user_') ? localPart : id;
    const suffix = String(clerkId ?? localPart).replace(/^user_/, '').slice(-6).toUpperCase();
    return `Prymal user ${suffix}`;
  }

  return normalizedEmail;
}

export function getUserDisplayName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || formatUserHandle(user);
}

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  return error?.data?.error || error?.message || fallback;
}
