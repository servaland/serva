import { RequestContext } from "../../../mod.ts";

export default () => (_: RequestContext, name: string) => `Hello, ${name}`;
