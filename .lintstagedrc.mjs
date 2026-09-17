import path from "node:path";

/**
 * lint-staged hands us absolute paths, but ESLint 9's flat config resolves relative to the
 * cwd it is launched from. Running the frontend tooling via `npm --prefix frontend` sets
 * cwd to frontend/, so the paths have to be rebased to match.
 */
const toFrontendPaths = (files) =>
  files.map((file) => path.relative(path.resolve("frontend"), file)).join(" ");

export default {
  "frontend/**/*.{ts,tsx}": (files) => [
    `npm --prefix frontend run --silent lint:fix -- ${toFrontendPaths(files)}`,
    `npm --prefix frontend run --silent prettier:write -- ${toFrontendPaths(files)}`,
  ],
  "frontend/**/*.{css,json,md}": (files) => [
    `npm --prefix frontend run --silent prettier:write -- ${toFrontendPaths(files)}`,
  ],
};
