export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && !('response' in error)) {
    return error.message;
  }

  const response = (error as { response?: { data?: unknown } })?.response;
  const data = response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object') {
    const body = data as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
    };

    if (typeof body.message === 'string' && body.message.trim()) {
      if (Array.isArray(body.details)) {
        const detailMessages = body.details
          .map((detail) => {
            if (!detail || typeof detail !== 'object') return null;
            const message = (detail as { message?: unknown }).message;
            return typeof message === 'string' && message.trim() ? message : null;
          })
          .filter(Boolean);

        if (detailMessages.length) {
          return detailMessages.join('\n');
        }
      }

      return body.message;
    }

    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  }

  return fallback;
}
