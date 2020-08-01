import { http } from "./deps.ts";

interface JSONOptions {
  reviver?: (this: any, key: string, value: any) => any;
}

export default class BodyReader {
  private request: http.ServerRequest;

  /**
   * Creates a new instance of BodyParser.
   * 
   * @param {http.ServerRequest} request
   */
  constructor(request: http.ServerRequest) {
    this.request = request;
  }

  /**
   * Reads the request body.
   * 
   * @returns {Promise<Uint8Array>}
   */
  async read() {
    return await Deno.readAll(this.request.body);
  }

  /**
   * Reads the request body as string.
   * 
   * @returns {Promise<string>}
   */
  async text() {
    const decoder = new TextDecoder();
    return decoder.decode(await this.read());
  }

  /**
   * Reads the request body as json.
   * 
   * @param {JSONOptions} [options]
   * @returns {Promise<unknown>}
   */
  async json<T = unknown>(options?: JSONOptions): Promise<T> {
    return JSON.parse(await this.text(), options && options.reviver) as T;
  }

  /**
   * Reads the request body as form data.
   * 
   * @returns {Promise<FormData>}
   */
  async form() {
    const text = await this.text();
    const params = new URLSearchParams(text);
    const form = new FormData();

    for (const [key, value] of params.entries()) {
      form.set(key, value);
    }

    return form;
  }
}
