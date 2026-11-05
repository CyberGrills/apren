export function clampPageToResultRange(
  requestedPage: number,
  responsePage: number,
  total: number,
  pageSize: number,
) {
  if (
    requestedPage !== responsePage ||
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isFinite(pageSize) ||
    pageSize < 1
  ) {
    return requestedPage;
  }
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(requestedPage, lastPage);
}
