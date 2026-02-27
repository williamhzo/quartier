import { createSearchParamsCache, parseAsInteger } from "nuqs/server";

export const arrParser = parseAsInteger;

export const searchParamsCache = createSearchParamsCache({
  arr: arrParser,
});
