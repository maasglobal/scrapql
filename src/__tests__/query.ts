import * as ruins from 'ruins-ts';
import { Task } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import * as Array_ from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/pipeable';

import { name, version } from '../../package.json';

import { Workspace, Ctx, Ctx0, Dict, ctx, ctx0, Wsp0, wsp0, dict } from '../scrapql';
import * as scrapql from '../scrapql';

import * as Object_ from '../utils/object';
import * as Dict_ from '../utils/dict';

type Logger<R, A extends Array<any>> = {
  (...a: A): R;
  mock: any;
};
type LoggerTask<R, A extends Array<any>> = {
  (...a: A): Task<R>;
  mock: any;
};

function loggerTask<R, A extends Array<any>>(logger: Logger<R, A>): LoggerTask<R, A> {
  const lt: LoggerTask<R, A> = (...largs) => () => {
    return Promise.resolve(logger(...largs));
  };
  // eslint-disable-next-line fp/no-mutation
  lt.mock = logger.mock;
  return lt;
}

describe('query', () => {
  /* eslint-disable @typescript-eslint/no-use-before-define */

  type Tmp1 = 'tmp1';
  const tmp1: Tmp1 = 'tmp1';
  type Tmp2 = 'tmp2';
  const tmp2: Tmp2 = 'tmp2';

  type Workspace1 = Workspace<{ tmp1: Tmp1 }>;
  type Workspace2 = Workspace<{ tmp2: Tmp2 }>;

  type Resolvers = scrapql.Resolvers<{
    checkProperty1Existence: (q: Id) => TaskEither<Err1, Option<Workspace1>>;
    resolveProperty3Terms: (q: Terms) => TaskEither<Err1, Dict<Id, Workspace2>>;
    fetchKeyResult: (
      q: KeyQueryPayload,
      c: Ctx<[Key, Id]>,
    ) => TaskEither<Err1, KeyResultPayload>;
    fetchProperty2Result: (
      q: Property2QueryPayload,
      c: Ctx0,
    ) => TaskEither<Err1, Property2ResultPayload>;
  }>;

  function createResolvers(): Resolvers {
    return {
      checkProperty1Existence: loggerTask(
        jest.fn((id: Id) =>
          pipe(
            property1Result,
            Dict_.lookup(id),
            Either_.fromOption((): Err1 => err1),
            Either_.map(Option_.map((_match): Workspace1 => ({ tmp1 }))),
          ),
        ),
      ),
      resolveProperty3Terms: loggerTask(
        jest.fn(
          ({ min, max }: Terms): Either<Err1, Dict<Id, Workspace2>> =>
            pipe(
              property1Result,
              Array_.filter(([key]) =>
                pipe(
                  key,
                  (i: Id): number => parseInt(i.slice(2), 10),
                  (no: number) => no >= min && no <= max,
                ),
              ),
              Array_.map(([k, _v]): [Id, Workspace2] => [k, { tmp2 }]),
              Either_.right,
              (x: Either<Err1, Dict<Id, Workspace2>>) => x,
            ),
        ),
      ),
      fetchKeyResult: loggerTask(
        jest.fn((_0: KeyQueryPayload, _1: Ctx<[Key, Id]>) =>
          Either_.right(keyResultPayload),
        ),
      ),
      fetchProperty2Result: loggerTask(
        jest.fn((_0: Property2QueryPayload, _1: Ctx0) =>
          Either_.right(property2ResultPayload),
        ),
      ),
    };
  }

  type CustomQP<
    Q,
    R,
    C extends scrapql.Context<Array<any>>,
    W extends scrapql.Workspace<any>
  > = scrapql.QueryProcessor<Q, R, Err1, C, W, Resolvers>;

  const QUERY = `${name}/${version}/scrapql/test/query`;
  const RESULT = `${name}/${version}/scrapql/test/result`;

  type Err1 = 'error';
  const err1: Err1 = 'error';

  type Id = string & ('id1' | 'id2');
  const id1: Id = 'id1';
  const id2: Id = 'id2';

  type Terms = {
    min: number;
    max: number;
  };
  const terms: Terms = {
    min: 0,
    max: 1,
  };

  type Key = string;
  const key1: Key = 'key1';

  type KeyQueryPayload = string;
  const keyQueryPayload: KeyQueryPayload = 'query1';

  type KeyResultPayload = string;
  const keyResultPayload: KeyResultPayload = 'result1';

  type KeyResult = scrapql.LeafResult<KeyQueryPayload, KeyResultPayload>;
  type KeyQuery = scrapql.LeafQuery<KeyQueryPayload>;
  const key1Result: KeyResult = { q: keyQueryPayload, r: keyResultPayload };
  const key1Query: KeyQuery = { q: keyQueryPayload };
  const processKey1: CustomQP<
    KeyQuery,
    KeyResult,
    Ctx<[Key, Id]>,
    Workspace1
  > = scrapql.leaf.processQuery((r) => r.fetchKeyResult);
  const processKey2: CustomQP<
    KeyQuery,
    KeyResult,
    Ctx<[Key, Id]>,
    Workspace2
  > = scrapql.leaf.processQuery((r) => r.fetchKeyResult);

  it('processKey', async () => {
    const resolvers = createResolvers();
    const context: Ctx<[Key, Id]> = ctx(key1, id1);
    const workspace: Workspace1 = { tmp1 };
    const main = scrapql.processorInstance(
      processKey1,
      context,
      workspace,
      resolvers,
    )(key1Query);
    const result = await ruins.fromTaskEither(main);
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), { tmp1 }],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(key1Result);
  });

  type KeysResult = Dict<Key, KeyResult>;
  type KeysQuery = Dict<Key, KeyQuery>;
  const keysResult: KeysResult = dict([key1, key1Result]);
  const keysQuery: KeysQuery = dict([key1, key1Query]);
  const processKeys1: CustomQP<
    KeysQuery,
    KeysResult,
    Ctx<[Id]>,
    Workspace1
  > = scrapql.keys.processQuery(processKey1);
  const processKeys2: CustomQP<
    KeysQuery,
    KeysResult,
    Ctx<[Id]>,
    Workspace2
  > = scrapql.keys.processQuery(processKey2);

  it('processKeys', async () => {
    const resolvers = createResolvers();
    const context: Ctx<[Id]> = ctx(id1);
    const workspace: Workspace1 = { tmp1 };
    const main = scrapql.processorInstance(
      processKeys1,
      context,
      workspace,
      resolvers,
    )(keysQuery);
    const result = await ruins.fromTaskEither(main);
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), { tmp1 }],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(keysResult);
  });

  type Property1Result = Dict<Id, Option<KeysResult>>;
  type Property1Query = Dict<Id, KeysQuery>;
  const property1Result: Property1Result = dict(
    [id1, Option_.some(keysResult)],
    [id2, Option_.none],
  );
  const property1Query: Property1Query = [
    [id1, keysQuery],
    [id2, keysQuery],
  ];
  const processProperty1: CustomQP<
    Property1Query,
    Property1Result,
    Ctx0,
    Wsp0
  > = scrapql.ids.processQuery((r) => r.checkProperty1Existence, processKeys1);

  it('processProperty1', async () => {
    const resolvers = createResolvers();
    const context: Ctx0 = ctx0;
    const workspace: Wsp0 = wsp0;
    const main = scrapql.processorInstance(
      processProperty1,
      context,
      workspace,
      resolvers,
    )(property1Query);
    const result = await ruins.fromTaskEither(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, ctx0, wsp0],
      [id2, ctx0, wsp0],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), wsp0],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(property1Result);
  });

  type Property2QueryPayload = string;
  const property2QueryPayload: Property2QueryPayload = 'query1';

  type Property2ResultPayload = string;
  const property2ResultPayload: Property2ResultPayload = 'result1';

  type Property2Result = scrapql.LeafResult<
    Property2QueryPayload,
    Property2ResultPayload
  >;
  type Property2Query = scrapql.LeafQuery<Property2QueryPayload>;
  const property2Result: Property2Result = {
    q: property2QueryPayload,
    r: property2ResultPayload,
  };
  const property2Query: Property2Query = { q: property2QueryPayload };
  const processProperty2: CustomQP<
    Property2Query,
    Property2Result,
    Ctx0,
    Object_.Object
  > = scrapql.leaf.processQuery((r) => r.fetchProperty2Result);

  it('processProperty2', async () => {
    const resolvers = createResolvers();
    const context: Ctx0 = ctx0;
    const workspace: Wsp0 = wsp0;
    const main = scrapql.processorInstance(
      processProperty2,
      context,
      workspace,
      resolvers,
    )(property2Query);
    const result = await ruins.fromTaskEither(main);
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([
      [property2QueryPayload, ctx0, wsp0],
    ]);
    expect(result).toEqual(property2Result);
  });

  type Property3Result = Dict<Terms, Dict<Id, KeysResult>>;
  type Property3Query = Dict<Terms, KeysQuery>;
  const property3Query: Property3Query = dict([terms, keysQuery]);
  const property3Result: Property3Result = dict([terms, dict([id1, keysResult])]);
  const processProperty3: CustomQP<
    Property3Query,
    Property3Result,
    Ctx0,
    Object_.Object
  > = scrapql.search.processQuery((r) => r.resolveProperty3Terms, processKeys2);

  it('processProperty3', async () => {
    const resolvers = createResolvers();
    const context: Ctx0 = ctx0;
    const workspace: Wsp0 = wsp0;
    const main = scrapql.processorInstance(
      processProperty3,
      context,
      workspace,
      resolvers,
    )(property3Query);
    const result = await ruins.fromTaskEither(main);
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.resolveProperty3Terms as any).mock.calls).toMatchObject([
      [terms, ctx0, wsp0],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), wsp0],
    ]);
    expect(result).toEqual(property3Result);
  });

  type RootResult = Partial<{
    protocol: scrapql.LiteralResult<typeof QUERY, typeof RESULT>;
    property1: Property1Result;
    property2: Property2Result;
    property3: Property3Result;
  }>;
  type RootQuery = Partial<{
    protocol: scrapql.LiteralQuery<typeof QUERY>;
    property1: Property1Query;
    property2: Property2Query;
    property3: Property3Query;
  }>;
  const rootResult: RootResult = {
    protocol: { q: QUERY, r: RESULT },
    property1: property1Result,
    property3: property3Result,
  };
  const rootQuery: RootQuery = {
    protocol: { q: QUERY },
    property1: property1Query,
    property3: property3Query,
  };

  it('processRoot (composed)', async () => {
    const processRoot: CustomQP<
      RootQuery,
      RootResult,
      Ctx0,
      Wsp0
    > = scrapql.properties.processQuery({
      protocol: scrapql.literal.processQuery(RESULT),
      property1: processProperty1,
      property2: processProperty2,
      property3: processProperty3,
    });

    const resolvers = createResolvers();
    const context: Ctx0 = ctx0;
    const workspace: Wsp0 = wsp0;
    const main = scrapql.processorInstance(
      processRoot,
      context,
      workspace,
      resolvers,
    )(rootQuery);
    const result = await ruins.fromTaskEither(main);

    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, ctx0, wsp0],
      [id2, ctx0, wsp0],
    ]);
    expect((resolvers.resolveProperty3Terms as any).mock.calls).toMatchObject([
      [terms, ctx0, wsp0],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), wsp0],
      [keyQueryPayload, ctx(key1, id1), wsp0],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapql.properties.processQuery<
      RootQuery,
      Err1,
      Ctx0,
      Object_.Object,
      Resolvers,
      RootResult
    >({
      protocol: scrapql.literal.processQuery(RESULT),
      property1: scrapql.ids.processQuery(
        (r: Resolvers) => r.checkProperty1Existence,
        scrapql.keys.processQuery<
          KeysQuery,
          Err1,
          Ctx<[Id]>,
          Workspace1,
          Resolvers,
          Key,
          KeyQuery,
          KeyResult
        >(scrapql.leaf.processQuery((r: Resolvers) => r.fetchKeyResult)),
      ),
      property2: scrapql.leaf.processQuery((r: Resolvers) => r.fetchProperty2Result),
      property3: scrapql.search.processQuery(
        (r) => r.resolveProperty3Terms,
        scrapql.keys.processQuery<
          KeysQuery,
          Err1,
          Ctx<[Id]>,
          Workspace2,
          Resolvers,
          Key,
          KeyQuery,
          KeyResult
        >(scrapql.leaf.processQuery((r: Resolvers) => r.fetchKeyResult)),
      ),
    });

    const resolvers = createResolvers();
    const context: Ctx0 = ctx0;
    const workspace: Wsp0 = wsp0;
    const main = scrapql.processorInstance(
      processRoot,
      context,
      workspace,
      resolvers,
    )(rootQuery);
    const result = await ruins.fromTaskEither(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, ctx0, wsp0],
      [id2, ctx0, wsp0],
    ]);
    expect((resolvers.resolveProperty3Terms as any).mock.calls).toMatchObject([
      [terms, ctx0, wsp0],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [keyQueryPayload, ctx(key1, id1), wsp0],
      [keyQueryPayload, ctx(key1, id1), wsp0],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });
});
