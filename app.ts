import Serva, { Options as ServaOptions } from "./_serva.ts";

/**
 * The current app instance.
 * 
 * @type {Serva|undefined}
 */
let app: Serva;

/**
 * Create a Serva app and set it as the current instance.
 * 
 * @throws Error if an instance already has been created and overwrite is falsey.
 * 
 * @param  {ServaOptions} [options]
 * @param  {boolean}      [overwrite] Should overwrite the current isntance.
 * @return {Serva}
 */
export function create(
  options?: ServaOptions,
  overwrite: boolean = false,
): Serva {
  // don't allow multiple apps
  if (app && !overwrite) {
    throw new Error("App already created, use `instance()` instead");
  }

  return (app = new Serva(options));
}

/**
 * Returns the current app instance.
 * 
 * @return {Serva|undefined}
 */
export function instance(): Serva | undefined {
  return app;
}
