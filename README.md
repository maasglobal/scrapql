# ScrapQL

The design of ScrapQL was partially motivated by experimentation with GraphQL. One key idea behind GraphQL is that the requirements for an API can not be known on forehand and therefore it is a good idea to create a general API that lets the caller be in control of things. Since we don't know which type sytem the caller will be using GraphQL implements it's own type system in GraphQL Schema language specifically created for the purpose. Because of the generality of the interface the types are also necessary for describing relations between different data items. GraphQL is also designed to avoid costly roundtrips between the application and the server room. The application sends "an order" for various "items" and the server takes care of collecting those items before returning them all at once to the application.

ScrapQL bears some resemblance to GraphQL but is also quite different. ScrapQL attempts to preserve the roundtrip properties of GraphQL but is intended for well known data exchange in situations where the backend code can easily be modified based on needs of the frontend of the application and the main goal is to bundle and deliver the data based on a few variables. ScrapQL is implemented in TypeScript and makes use of TypeScript's native type system. The user is adviced to define the query types with [io-ts](https://github.com/gcanti/io-ts) that provides type safe measures for (de)serialing the data types to (and from) JSON. The JSON can be passed over the wire in any shape or form. The ScrapQL library is used to define and iterate the query/result structure.

# Tutorial

In this tutorial we explain how you can use ScrapQL in a simple project with
customers and profit reports.  We will use the following database mock
throughout the tutorial.

```typescript
const example: any = {
  customers: {
    c001: {
      name: 'Scrooge McDuck',
      age: '75',
    },
    c002: {
      name: 'Magica De Spell',
      age: '35',
    },
  },
  reports: {
    2017: {
      profit: 500,
    },
    2018: {
      profit: 100,
    },
    2019: {
      profit: 10,
    },
  },
};

type Json =
    | string
    | number
    | boolean
    | null
    | { [p: string]: Json }
    | Array<Json>;

interface Database {
  hasCustomer: (c: string) => Promise<boolean>;
  getCustomer: (c: string) => Promise<Json>;
  getReport: (y: string) => Promise<Json>;
}

const db: Database = {
  hasCustomer: (customerId) => Promise.resolve(example.customers.hasOwnProperty(customerId)),
  getCustomer: (customerId) => Promise.resolve(example.customers[customerId]),
  getReport: (year) => Promise.resolve(example.reports[year] || { profit: 0 }),
};
```


## Define Data Validators

```typescript
import * as t from 'io-ts';

const CustomerId = t.string;
type CustomerId = t.TypeOf<typeof CustomerId>;

const Customer = t.type({
  name: t.string,
  age: t.number,
});
type Customer = t.TypeOf<typeof Customer>;

const Year = t.string;
type Year = t.TypeOf<typeof Year>;

const Report = t.type({
  profit: t.number,
});
type Report = t.TypeOf<typeof Report>;

const Errors = t.array(t.string);
type Errors = t.TypeOf<typeof Errors>;
```

## Define Query Validator

```typescript

import { Dict } from 'scrapql/lib/dict';

// name and version from package.json
const packageName = 'scrapql-example-app';
const packageVersion = '0.0.1';

const QUERY_PROTOCOL= `${packageName}/${packageVersion}/scrapql/query`;

const Query = t.type({
  protocol: t.literal(QUERY_PROTOCOL),
  reports: Dict(Year, t.type({
    get: t.literal(true),
  })),
  customers: Dict(CustomerId, t.type({
    get: t.literal(true),
  })),
});
type Query = t.TypeOf<typeof Query>;
```

You can use the query validator to validate JSON queries as follows.

```typescript
import { validator } from 'io-ts-validator';

const exampleJsonQuery: Json = {
  protocol: QUERY_PROTOCOL,
  reports: [
    ['2018', {get: true}],
    ['3030', {get: true}],
  ],
  customers: [
    ['c002', {get: true}],
    ['c007', {get: true}],
  ],
};

const exampleQuery: Query = validator(Query).decodeSync(exampleJsonQuery);
```

## Define Query Resolvers

```typescript
import { Task } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';

import { pipe } from 'fp-ts/lib/pipeable';
import * as Task_ from 'fp-ts/lib/Task';
import * as Either_ from 'fp-ts/lib/Either';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import { failure } from 'io-ts/lib/PathReporter'

import { Ctx } from 'scrapql';

interface Resolvers {
  readonly fetchReport: (a: true, b: Ctx<Year>) => TaskEither<Errors, Report>;
  readonly fetchCustomer: (a: true, b: Ctx<CustomerId>) => TaskEither<Errors, Customer>;
  readonly checkCustomerExistence: (a: CustomerId) => TaskEither<Errors, boolean>;
}

const resolvers: Resolvers = {
  fetchReport: (_queryArgs, [year]) => pipe(
    () => db.getReport(year),
    Task_.map(Report.decode),
    TaskEither_.mapLeft(failure),
  ),

  fetchCustomer: (_queryArgs, [customerId]) => pipe(
    () => db.getCustomer(customerId),
    Task_.map(Customer.decode),
    TaskEither_.mapLeft(failure),
  ),

  checkCustomerExistence: (customerId) => pipe(
    () => db.hasCustomer(customerId),
    Task_.map(Either_.right),
  ),

};
```


## Define Query Processor

```typescript
import * as scrapql from 'scrapql';
import { QueryProcessor, Ctx0 } from 'scrapql';

const RESULT_PROTOCOL = `${packageName}/${packageVersion}/scrapql/result`;

// Ideally the type casts would be unnecessary, see https://github.com/maasglobal/scrapql/issues/12
const processQuery: QueryProcessor<Query, Result, Errors, Resolvers, Ctx0> = scrapql.properties.processQuery<Resolvers, Query, Result, Errors, Ctx0>({
  protocol: scrapql.literal.processQuery(RESULT_PROTOCOL),
    reports: scrapql.keys.processQuery(
      scrapql.properties.processQuery({
        get: scrapql.leaf.processQuery((r: Resolvers) => r.fetchReport)
      }) as QueryProcessor<{ get: true }, { get: Report }, Errors, Resolvers, Ctx<Year>> ,
    ),
    customers: scrapql.ids.processQuery(
      (r: Resolvers) => r.checkCustomerExistence,
      scrapql.properties.processQuery({
        get: scrapql.leaf.processQuery((r: Resolvers) => r.fetchCustomer),
      }) as QueryProcessor<{ get: true }, { get: Customer }, Errors, Resolvers, Ctx<CustomerId>>,
    ) as QueryProcessor<Dict<CustomerId, { get: true; }>, Dict<CustomerId, Option<{ get: Customer; }>>, Errors, Resolvers, Ctx0>,
  }) as QueryProcessor<Query, Result, Errors, Resolvers, Ctx0>;
```

You can run the processor as follows.

```typescript
import { processorInstance, ctx0 } from 'scrapql';
import * as ruins from 'ruins-ts';

async function generateExampleOutput() {
  const qp = processorInstance(processQuery, resolvers, ctx0);
  const q: Query = await validator(Query).decodePromise(exampleJsonQuery);
  const output = await ruins.fromTaskEither(qp(q));
  console.log(output);
}

generateExampleOutput();
```

The result object should look as follows.

```typescript
const exampleResult = {
  protocol: 'scrapql-example-app/0.0.1/scrapql/result',
  reports: [
    ['2018', {
      get: {
        _tag: 'Right',  // get success
        right: { profit: 100 }
      },
    }],
    ['3030', {
      get: {
        _tag: 'Right',  // get success
        right: { profit: 0 }
      },
    }],
  ],
  customers: [
    ['c002', {
      _tag: 'Right',  // identity check success
      right: {
        _tag: 'Some',  // customer exists
        some: {
          get: {
            _tag: 'Right',  // get success
            right: {
              name: 'Magica De Spell',
              age: '35',
            },
          },
        },
      },
    }],
    ['c007', {
      _tag: 'Right',  // identity check success
      right: {
        _tag: 'None',  // customer does not exist
      },
    }],
  ],
} as unknown as Result;
```

## Define Result Validator

Now that we know what the output will look like we can define a result validator.

```typescript
import { option as tOption } from 'io-ts-types/lib/option';

const Result = t.type({
  protocol: t.literal(RESULT_PROTOCOL),
  reports: Dict(Year, t.type({
    get: Report,
  })),
  customers: Dict(CustomerId, tOption(t.type({
    get: Customer,
  }))),
});
type Result = t.TypeOf<typeof Result>;
```

We can now use the result validator to encode the result as JSON.

```typescript
const exampleJsonResult: Json = JSON.parse(JSON.stringify(Result.encode(exampleResult)));
```

It all comes together as the following query processor.

```typescript
async function jsonQueryProcessor(jsonQuery: Json): Promise<Json> {
  const qp = processorInstance(processQuery, resolvers, ctx0);
  const q: Query = await validator(Query).decodePromise(jsonQuery);
  const r: Result = await ruins.fromTaskEither(qp(q));
  const jsonResult: Json = JSON.parse(JSON.stringify(Result.encode(r)));
  return jsonResult;
}
```


## Define Result Reporters

```typescript
import { Either } from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';

interface Reporters {
  readonly receiveReport: (a: Report, b: Ctx<Year> ) => Task<void>;
  readonly receiveCustomer: (a: Option<Customer>, b: Ctx<CustomerId>) => Task<void>;
  readonly learnCustomerExistence: (a: boolean, b: Ctx<CustomerId>) => Task<void>;
}

const reporters: Reporters = {

  receiveReport: (report, [year]) => () => {
    return Promise.resolve(console.log(year, report));
  },

  receiveCustomer: (customer, [customerId]) => () => {
    return Promise.resolve(console.log(customerId, customer));
  },

  learnCustomerExistence: (existence, [customerId]) => () => {
    return Promise.resolve(console.log(customerId, existence ? 'known customer' : 'unknown customer'));
  },

};
```


## Define Result Processor

```typescript
import { ResultProcessor } from 'scrapql';

// Ideally the type casts would be unnecessary, see https://github.com/maasglobal/scrapql/issues/12
const processResult: ResultProcessor<Result, Reporters, Ctx0> = scrapql.properties.processResult({
  protocol: scrapql.literal.processResult(),
  reports: scrapql.keys.processResult(
    scrapql.properties.processResult({
      get: scrapql.leaf.processResult((r: Reporters) => r.receiveReport)
    }) as ResultProcessor<{ get: Report }, Reporters, Ctx<string>>,
  ),
  customers: scrapql.ids.processResult(
    (r: Reporters) => r.learnCustomerExistence,
    scrapql.properties.processResult({
      get: scrapql.leaf.processResult((r: Reporters) => r.receiveCustomer)
    }) as ResultProcessor<{ get: Customer }, Reporters, Ctx<string>>,
  ),

}) as ResultProcessor<Result, Reporters, Ctx0>;
```

## Define a Protocol Bundle

A scrapql protocol bundle contains all of the tools we created above.
Creating one is not necessary but may be useful.

```typescript
import { Protocol, examples } from 'scrapql';

type Bundle = Protocol<
  Query,
  Result,
  Errors,
  Ctx0,
  Resolvers,
  Reporters
>;

const exampleBundle: Partial<Bundle> = {
  Query,
  Result,
  Err: Errors,
  query: (q) => q,
  result: (r) => r,
  err: (e) => e,
  queryExamples: examples([exampleQuery]),
  resultExamples: examples([exampleResult]),
  processQuery,
  processResult,
};
```

## Example Flow

Now that we have a query processor we can finally use it to process queries.
The query processor works as follows.

```typescript
import * as Console_ from 'fp-ts/lib/Console';
import * as IOEither_ from 'fp-ts/lib/IOEither';
import { either as tEither } from 'io-ts-types/lib/either';

async function server(request: string): Promise<string> {
  const main = pipe(
    IOEither_.tryCatch(() => request, (reason: unknown) => [String(reason)]),
    TaskEither_.fromIOEither,
    TaskEither_.chain((body: string) => pipe(
      Either_.parseJSON(body, (reason) => [String(reason)]),
      TaskEither_.fromEither,
    )),
    TaskEither_.chain((json: unknown) => pipe(
      json,
      Query.decode,
      Either_.mapLeft(failure),
      TaskEither_.fromEither,
    )),
    TaskEither_.chain((query: Query) => pipe(
      processorInstance(processQuery, resolvers, ctx0),
      (qp) => qp(query),
    )),
    Task_.chainFirst((result: Either<Errors, Result>) => pipe(
      result,
      Either_.fold(
        (errors) => Console_.error(['Error!'].concat(errors).join('\n')),
        (_output) => Console_.log('Success!'),
      ),
      Task_.fromIO,
    )),
    Task_.map((result: Either<Errors, Result>) => pipe(
      result,
      Either_.fold(
        (_errors): unknown => ({ error: 'Internal server error' }),
        (xxx) => ({ data: Result.encode(xxx) }),
      ),
      (json) => Either_.stringifyJSON(json, (reason) => String(reason)),
    )),
    TaskEither_.fold(
      (errorString) => Task_.of(errorString), // JSON stringify failure
      (jsonString) => Task_.of(jsonString), // processing success or failure
    ),
  );
  return main();
}

async function client(query: Query): Promise<void> {
  const main = pipe(
    Query.encode(query),
    (json: Json) => Either_.stringifyJSON(json, (reason) => [String(reason)]),
    TaskEither_.fromEither,
    TaskEither_.chain((requestBody) => pipe(
      TaskEither_.tryCatch(() => server(requestBody), (reason) => [String(reason)]),
    )),
    TaskEither_.chain((body: string) => pipe(
       Either_.parseJSON(body, (reason) => [String(reason)]),
      TaskEither_.fromEither,
    )),
    TaskEither_.chain((json: unknown) => pipe(
      json,
      tEither(Errors, Result).decode,
      Either_.mapLeft(failure),
      TaskEither_.fromEither,
    )),
    TaskEither_.chain((result: Either<Errors, Result>) => pipe(
      result,
      TaskEither_.fromEither,
    )),
    TaskEither_.fold(
      (errors) => () => Promise.resolve(console.error(errors)),
      (result: Result) => pipe(
        processorInstance( processResult, reporters, ctx0 ),
        (rp) => rp(result),
      ),
    ),
  );
  return main();
}
```
