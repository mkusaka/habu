export function validateSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestUrl = new URL(request.url);
  const expectedOrigin = requestUrl.origin;

  if (origin && origin !== expectedOrigin) {
    return "Invalid origin";
  }

  if (!origin && referer) {
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== expectedOrigin) {
      return "Invalid referer";
    }
  }

  return null;
}
