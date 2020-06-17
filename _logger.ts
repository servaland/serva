import { colors } from "./deps.ts";

export function warn(...args: unknown[]) {
  console.log(colors.yellow("Warning"), ...args);
}

export function error(...args: unknown[]) {
  console.log(colors.red("Error"), ...args);
}

export function info(...args: unknown[]) {
  console.log(colors.blue("Info"), ...args);
}

export function success(...args: unknown[]) {
  console.log(colors.green("Success"), ...args);
}
