
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
      age: 75,
    },
    c002: {
      name: 'Magica De Spell',
      age: 35,
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
  getCustomer: (c: string) => Promise<undefined|Json>;
  getReport: (y: number) => Promise<Json>;
}

const db: Database = {
  getCustomer: (customerId) => Promise.resolve(example.customers[customerId]),
  getReport: (year) => Promise.resolve(example.reports[year] || { profit: 0 }),
};
```

## Define Data Types

```typescript
import * as t from 'io-ts';

const CustomerId = t.string;
type CustomerId = t.TypeOf<typeof CustomerId>;

const Customer = t.type({
  name: t.string,
  age: t.number,
});
type Customer = t.TypeOf<typeof Customer>;

const Year = t.number;
type Year = t.TypeOf<typeof Year>;

const Report = t.type({
  profit: t.number,
});
type Report = t.TypeOf<typeof Report>;
```

## Define Query Driver

```typescript
import { Task } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';

import { pipe } from 'fp-ts/lib/pipeable';
import * as Task_ from 'fp-ts/lib/Task';
import * as Option_ from 'fp-ts/lib/Option';
import * as Either_ from 'fp-ts/lib/Either';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';

import * as scrapql from './scrapql';
import { Ctx, Ctx0, Wsp, Wsp0, Existence } from './scrapql';
import { Either } from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';

const Err = t.array(t.string);
type Err = t.TypeOf<typeof Err>;

const Get = t.literal(true)
type Get = t.TypeOf<typeof Get>;

type Resolvers = scrapql.Resolvers<{
  readonly fetchReport: (a: Get, b: Ctx<[Year]>) => TaskEither<Err, Report>;
  readonly fetchCustomer: (a: Get, b: Ctx<[CustomerId]>, c: { customer: Customer }) => TaskEither<Err, Customer>;
  readonly checkCustomerExistence: (a: CustomerId) => TaskEither<Err, Option<{ customer: Customer }>>;
}>

type Reporters = scrapql.Reporters<{
  readonly receiveReport: (a: Report, b: Ctx<[Get, Year]> ) => Task<void>;
  readonly receiveCustomer: (a: Customer, b: Ctx<[Get, CustomerId]>) => Task<void>;
  readonly learnCustomerExistence: (a: Existence, b: Ctx<[CustomerId]>) => Task<void>;
}>

type Driver = Resolvers & Reporters
```

## Define Query Literals

```typescript

// name and version from package.json
const packageName = 'scrapql-example-app';
const packageVersion = '0.0.1';

const QUERY_PROTOCOL= `${packageName}/${packageVersion}/scrapql/query`;
const RESULT_PROTOCOL = `${packageName}/${packageVersion}/scrapql/result`;

type Version = scrapql.LiteralBundle<
  Err,
  Ctx0,
  Wsp0,
  Resolvers,
  Reporters,
  typeof QUERY_PROTOCOL,
  typeof RESULT_PROTOCOL
>;
const Version: Version = scrapql.literal.bundle({
  Err,
  QueryPayload: t.literal(QUERY_PROTOCOL),
  ResultPayload: t.literal(RESULT_PROTOCOL),
});
```

## Define Query Leafs

```typescript
type GetCustomer = scrapql.LeafBundle<
  Err,
  Ctx<[CustomerId]>,
  Wsp<{ customer: Customer }>,
  Resolvers,
  Reporters,
  Get,
  Customer
>;
const GetCustomer: GetCustomer = scrapql.leaf.bundle({
  Err,
  QueryPayload: Get,
  ResultPayload: Customer,
  queryConnector: (r: Resolvers) => r.fetchCustomer,
  queryPayloadCombiner: (_w, r) => Either_.right(r),
  queryPayloadExamplesArray: [Get.value],
  resultConnector: (r: Reporters) => r.receiveCustomer,
  resultPayloadCombiner: (_w, r) => Either_.right(r),
  resultPayloadExamplesArray: [{
      name: 'Scrooge McDuck',
      age: 75,
    }],
});

type GetReport = scrapql.LeafBundle<
  Err,
  Ctx<[Year]>,
  Wsp0,
  Resolvers,
  Reporters,
  Get,
  Report
>;
const GetReport: GetReport = scrapql.leaf.bundle({
  Err,
  QueryPayload: Get,
  ResultPayload: Report,
  queryConnector: (r: Resolvers) => r.fetchReport,
  queryPayloadCombiner: (_w, r) => Either_.right(r),
  queryPayloadExamplesArray: [Get.value],
  resultConnector: (r: Reporters) => r.receiveReport,
  resultPayloadCombiner: (_w, r) => Either_.right(r),
  resultPayloadExamplesArray: [{
    profit: 500,
  }],
});
```

## Define Query Structure

```typescript
type CustomerOps = scrapql.PropertiesBundle<{
  get: GetCustomer;
}>;
const CustomerOps: CustomerOps = scrapql.properties.bundle({
  get: GetCustomer,
});

type Customers = scrapql.IdsBundle<
  Err,
  Ctx0,
  Wsp0,
  Resolvers,
  Reporters,
  CustomerId,
  t.TypeOf<typeof CustomerOps['Query']>,
  t.TypeOf<typeof CustomerOps['Result']>
>;
const Customers: Customers = scrapql.ids.bundle({
  id: {
    Id: CustomerId,
    idExamples: ['c001', 'c999'],
  },
  item: CustomerOps,
  queryConnector: (r: Resolvers) => r.checkCustomerExistence,
  resultConnector: (r: Reporters) => r.learnCustomerExistence,
});


type ReportOps = scrapql.PropertiesBundle<{
  get: GetReport;
}>;
const ReportOps: ReportOps = scrapql.properties.bundle({
  get: GetReport,
});

type Reports = scrapql.KeysBundle<
  Err,
  Ctx0,
  Wsp0,
  Resolvers,
  Reporters,
  Year,
  t.TypeOf<typeof ReportOps['Query']>,
  t.TypeOf<typeof ReportOps['Result']>
>;
const Reports: Reports = scrapql.keys.bundle({
  key: {
    Key: Year,
    keyExamples: [1999, 2004],
  },
  item: ReportOps,
});

type Root = scrapql.PropertiesBundle<{
  protocol: Version,
  reports: Reports,
  customers: Customers,
}>;
const Root: Root = scrapql.properties.bundle({
  protocol: Version,
  reports: Reports,
  customers: Customers,
});

const Query = Root.Query;
type Query = t.TypeOf<typeof Query>;

const Result = Root.Result;
type Result = t.TypeOf<typeof Result>;

```

You can use the query validator to validate JSON queries as follows.

```typescript
import { validator } from 'io-ts-validator';

const rawQuery: Json = {
  protocol: QUERY_PROTOCOL,
  reports: [
    [2018, {get: true}],
    [3030, {get: true}],
  ],
  customers: [
    ['c002', {get: true}],
    ['c007', {get: true}],
  ],
};

const exampleQuery: Query = validator(Query).decodeSync(rawQuery);
const wireQuery: string = validator(Query, 'json').encodeSync(exampleQuery);
```

## Implement Query Resolvers

```typescript
const resolvers: Resolvers = {
  fetchReport: (_queryArgs, [year]) => pipe(
    () => db.getReport(year),
    Task_.map(validator(Report).decodeEither),
  ),

  fetchCustomer: (_queryArgs, [_customerId], { customer }) => pipe(
    customer,  // cached by checkCustomerExistence
    TaskEither_.right,
  ),

  checkCustomerExistence: (customerId) => pipe(
    () => db.getCustomer(customerId),
    Task_.map((nullable) => pipe(
      Option_.fromNullable(nullable),
      Option_.map(validator(Customer).decodeEither),
      Option_.map(Either_.map((customer) => ({ customer }))),
      Option_.sequence(Either_.either),
    )),
  ),

};
```

You can now process a query as follows.

```typescript
import * as ruins from 'ruins-ts';

async function generateExampleOutput(input: string) {
  const query: Query = await validator(Query, 'json').decodePromise(input);
  const queryProcessor = scrapql.processQuery(Root, resolvers);
  const result = await ruins.fromTaskEither(queryProcessor(query));
  console.log(result);
}

generateExampleOutput(wireQuery);
```

The result object should look as follows.

```typescript
const rawResult: Json = {
  protocol: 'scrapql-example-app/0.0.1/scrapql/result',
  reports: [
    [2018, {
      get: {
        _tag: 'Right',  // get success
        right: { profit: 100 }
      },
    }],
    [3030, {
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
};
```

We can now use the result validator to encode the result as JSON.

```typescript
const exampleResult: Result = validator(Result).decodeSync(rawResult);
const wireResult: string = validator(Result, 'json').encodeSync(exampleResult);
```

It all comes together as the following query processor.

```typescript
async function wireQueryProcessor(input: string): Promise<string> {
  const queryProcessor = scrapql.processQuery(Root, resolvers);
  const query: Query = await validator(Query, 'json').decodePromise(input);
  const result: Result = await ruins.fromTaskEither(queryProcessor(query));
  const output: string = await validator(Result, 'json').encodePromise(result);
  return output;
}
```

## Implement Result Reporters

```typescript
const reporters: Reporters = {

  receiveReport: (report, [_query, year]) => () => {
    return Promise.resolve(console.log(year, report));
  },

  receiveCustomer: (customer, [_query, customerId]) => () => {
    return Promise.resolve(console.log(customerId, customer));
  },

  learnCustomerExistence: (existence, [customerId]) => () => {
    return Promise.resolve(console.log(customerId, existence ? 'known customer' : 'unknown customer'));
  },

};
```

## Define Request and Response formats

```typescript
import { either as tEither } from 'io-ts-types/lib/either';

const Request = <D extends t.Mixed>(DataC: D) => DataC
type Request<D> = D

const Response = tEither
type Response<E, D> = Either<E, D>
```

## Implement Client and Server

```typescript
import * as Console_ from 'fp-ts/lib/Console';


async function server(request: string): Promise<string> {
  const main = pipe(
    // validate request
    validator(Request(Query), 'json').decodeEither(request),
    TaskEither_.fromEither,
    // process query
    TaskEither_.chain((query: Query) => pipe(
      query,
      scrapql.processQuery(Root, resolvers),
    )),
    // log status
    Task_.chainFirst((response: Response<Err, Result>) => pipe(
      response,
      Either_.fold(
        (errors) => Console_.error(['Error!'].concat(errors).join('\n')),
        (_output) => Console_.log('Success!'),
      ),
      Task_.fromIO,
    )),
    // encode response
    Task_.map((response: Response<Err, Result>) => 
      validator(Response(Err, Result), 'json').encodeEither(response)
    ),
  );
  return ruins.fromTaskEither(main);
}

async function client(query: Query): Promise<void> {
  const main = pipe(
    // encode request
    validator(Request(Query), 'json').encodeEither(query),
    TaskEither_.fromEither,
    // call server
    TaskEither_.chain((request) => pipe(
      TaskEither_.tryCatch(() => server(request), (reason) => [String(reason)]),
    )),
    // validate response
    TaskEither_.chainEitherK((body: string) =>
      validator(Response(Err, Result), 'json').decodeEither(body),
    ),
    // acknowledge server-side errors
    TaskEither_.chain((response: Response<Err, Result>) => Task_.of(response)),
    // process result
    TaskEither_.chain((result: Result) => pipe(
      result,
      scrapql.processResult( Root, reporters ),
      TaskEither_.fromTask,
    )),
  );
  return ruins.fromTaskEither(main);
}
```
