import { NotFoundBody } from "../not-found-body";

// #443: the 404 `/design` showed under the old single root layout (production, DESIGN_PREVIEW unset).
export default function DesignNotFound() {
  return <NotFoundBody />;
}
