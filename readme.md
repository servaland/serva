# 🦕 Serva

The zero setup web framework for [Deno](https://deno.land). Convention > Configuration,
focus on building your app, let Serva do the _REST_.

_Define a route_

```ts
// ./routes/index.ts
export default () => "Hello, World!";
```

_Start your app_

```
$ serva start
```

_Simple_

```
$ curl localhost:4500
Hello, World!
```

## App directory

Serva requires your app to have a strict file system layout. Currently Serva can
only read routes, however in future releases the directory will become very opinionated.

Serva will run on any directory. It will look for a `routes` directory to read and
a `serva.config.json` for any low-level config (port, hostnames, etc.).

### Routes

All routes live inside the `routes` directory. They are a mirrored representation
of your app's endpoints. Lets look at an example directory of the Serva package.

```
$ tree ./example
example
├── routes
│   ├── index.get.ts
│   └── index.post.ts
└── serva.config.json
```

Without reading a single line of code you can see the available routes your app
will serve. A `GET` and a `POST` route on the root path, `/`. A single route is
defined per file. There can be no fall-through routes. This gives a clear and transparent
overview of any app, no mater who/where/when/how it was developed.

#### Methods

Routes can be suffixed with a HTTP method to signal that the route should only be
handled by requests that match that method. As you can see from the example directory
they are `.get` and `.post`. Serva allows the following methods, however can be
configured to accept more, see [Method suffix](#method-suffixes).

| Suffix    | HTTP Method |
| :-------- | :---------- |
| `.get`    | `GET`       |
| `.post`   | `POST`      |
| `.put`    | `PUT`       |
| `.delete` | `DELETE`    |
| `.patch`  | `PATCH`     |

##### Any method

If the method suffix is omitted, Serva will bind _any_/_all_ methods to that route.
Serva will first try to match any defined methods before using an any route.

#### Parameters

Routes can contain parameters within their path. Parameters are a way to bind segments
of the path to the request `params` map. Use square brackets around the name of a
parameter within the filename.

```
$ mkdir ./example/routes/profile
$ touch ./example/routes/profile/[name].get.ts
```

```ts
// ./example/routes/profile/[name].get.ts
import { ServaRequest } from "https://serva.land/serva@latest/mod.ts";

export default ({ params }: ServaRequest) => `Welcome ${params.get("name"}.`;
```

```
$ curl localhost:4500/profile/chris
Welcome chris.
```

#### Callbacks

Each route must contain a default export as a function. This function is known as
the route callback. When Serva matches a route it will invoke this callback with
the request.

```ts
// ./example/routes/index.get.ts
import { ServaRequest } from "https://serva.land/serva@latest/mod.ts";

export default ({ response }: ServaRequest) => {
  response.headers = new Headers({
    "X-Powered-By": "Serva",
  });

  return "Hello from Serva.";
};
```

#### Requests

Serva has it's own request object to preserve the HTTP request object from Deno's
std library. The request object is similar and if you need/require the HTTP version
of the object it is also accessible.

```ts
interface ServaRequest {
  // std http request
  readonly httpRequest: http.ServerRequest;

  // request
  readonly url: URL;
  readonly method: string;
  readonly params: ReadonlyMap<string, string>;
  readonly headers: Headers;

  // response
  readonly response: http.Response;
}
```

#### Responses

Serva exposes a single response object that you can manipulate within your route.

```ts
// ./example/routes/index.get.ts
import { ServaRequest } from "https://serva.land/serva@latest/mod.ts";

export default ({ response }: ServaRequest) => {
  // set headers
  response.headers = new Headers({
    "X-Powered-By": "Serva",
  });

  // set status
  response.status = 401;

  // set trailers
  response.trailers = () =>
    new Headers({
      "X-Watch-Me": "https://youtu.be/dQw4w9WgXcQ",
    });

  // return to set the body
  return "Hello from Serva.";
};
```

### Config

When Serva reads a `serva.config.json` file from the application root it will use
this to configure the app. You can set the following options within the file:

```ts
interface ServaConfig {
  port: number;
  hostname?: string;
  extension: string;
  methods: string[];
}
```

#### Extension

By default Serva will read files with `.ts` file extensions. If you prefer to write
your application in JavaScript you can set this to `.mjs` or `.js`.

#### Method suffixes

By default Serva will only bind the available methods (see [Methods](#methods)).
Set this if you wish to control the method suffixes of your application.

```json5
// ./example/serva.config.json
{
  methods: [
    "get",
    "head",
    "post",
    "put",
    "delete",
    "options",
    "trace",
    "patch",
  ],
}
```

## Running

Serva does not export any application interface. Instead it uses a main import to
instantiate and run an app. To start an application is easy, just tell the _app_
file to `start` with a few permissions.

```
$ deno run --allow-read --allow-net https://serva.land/serva@latest/app.ts start
```

Serva requires the following Deno flags to start:

| Flag           | Reason                                  |
| :------------- | :-------------------------------------- |
| `--allow-read` | Required for reading the app directory. |
| `--allow-net`  | Required for incoming requests.         |

### Installation

Alternatively you can install Serva as a Deno binary. If you have configured Deno
correctly you will be able to use the `serva` alias to start an application.

```
$ deno install --allow-read --allow-net https://serva.land/serva@latest/app.ts
$ serva start
```

## Philosophy

Serva was built to let developers focus on what really matters, the application.
Many Node.js frameworks allow developers to setup servers 1001 different ways. Through-out
developing and maintaining Node.js apps, each one looks slightly different and you
can become lost in how the original developer decided to setup on that day. Let
the framework worry about this setup and make Deno apps consistent, let's not fall
into the same pattern.

1. Use the filesystem.
2. Zero interface.

## Roadmap

- ✅ Routes
- 🏗️ Hooks (middleware)
- 🗓️ Services
- 🗓️ Configurations
- 🗓️ CLI
- 🗓️ Explorer

_Key_

<small>🗓️ planned<br />🏗️ development<br />✅ done</small>
