import { http } from "./deps.ts";

interface JsonOptions {
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
  async blob() {
    return await Deno.readAll(this.request.body);
  }

  /**
   * Reads the request body as string.
   * 
   * @returns {Promise<string>}
   */
  async text() {
    const decoder = new TextDecoder();
    return decoder.decode(await this.blob());
  }

  /**
   * Reads the request body as json.
   * 
   * @param {JsonOptions} [options]
   * @returns {Promise<any>}
   */
  async json<T = any>(options?: JsonOptions): Promise<T> {
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
