const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

export function requestContext() {
  return async (context, next) => {
    const forwardedRequestId = context.req.header('x-request-id')?.trim();
    const requestId =
      forwardedRequestId && REQUEST_ID_PATTERN.test(forwardedRequestId)
        ? forwardedRequestId
        : crypto.randomUUID();

    context.set('requestId', requestId);
    context.header('X-Request-Id', requestId);

    await next();

    context.header('X-Request-Id', requestId);
  };
}

export function getRequestId(context) {
  return context.get('requestId') ?? null;
}
