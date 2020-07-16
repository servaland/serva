// ./example/routes/index.get.ts
import { ServaRequest } from "../../../mod.ts";

export default ({ params }: ServaRequest) => `Welcome ${params.get("name")}.`;
