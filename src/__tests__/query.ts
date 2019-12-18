import { Task } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

import { name, version } from '../../package.json';

import * as scrapql from '../scrapql';

interface Logger<R, A extends Array<any>> {
  (...a: A): R;
  mock: any;
}
interface LoggerTask<R, A extends Array<any>> {
  (...a: A): Task<R>;
  mock: any;
}

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

  interface Resolvers extends scrapql.Resolvers {
    checkProperty1Existence: (i: Id) => TaskEither<Err1, scrapql.Existence>;
    fetchKeyResult: (i: Id, k: Key) => Task<KeyResult>;
    fetchProperty2Result: () => Task<Property2Result>;
  }

  function createResolvers(): Resolvers {
    return {
      checkProperty1Existence: loggerTask(
        jest.fn((id: Id) =>
          pipe(
            property1Result[id],
            Either_.map(Option_.isSome),
          ),
        ),
      ),
      fetchKeyResult: loggerTask(jest.fn((_0: Id, _1: Key) => key1Result)),
      fetchProperty2Result: loggerTask(jest.fn(() => property2Result)),
    };
  }

  type CustomQP<Q, R, C extends scrapql.Context> = scrapql.QueryProcessor<
    Q,
    R,
    Resolvers,
    C
  >;

  const QUERY = `${name}/${version}/scrapql/test/query`;
  const RESULT = `${name}/${version}/scrapql/test/result`;

  type Err1 = 'error';

  type Id = string & ('id1' | 'id2');
  const id1: Id = 'id1';
  const id2: Id = 'id2';
  type Key = string;
  const key1: Key = 'key1';

  type KeyResult = string;
  type KeyQuery = string;
  const key1Result: KeyResult = 'result1';
  const key1Query: KeyQuery = 'query1';
  const processKey: CustomQP<KeyQuery, KeyResult, [Key, Id]> = scrapql.process.query.leaf(
    (r) => r.fetchKeyResult,
  );

  it('processKey', async () => {
    const resolvers = createResolvers();
    const main = processKey(resolvers)([key1, id1])(key1Query);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Query],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(key1Result);
  });

  type KeysResult = Record<Key, KeyResult>;
  type KeysQuery = Record<Key, KeyQuery>;
  const keysResult: KeysResult = {
    [key1]: key1Result,
  };
  const keysQuery: KeysQuery = {
    [key1]: key1Query,
  };
  const processKeys: CustomQP<KeysQuery, KeysResult, [Id]> = scrapql.process.query.keys(
    processKey,
  );

  it('processKeys', async () => {
    const resolvers = createResolvers();
    const main = processKeys(resolvers)([id1])(keysQuery);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Query],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(keysResult);
  });

  type Property1Result = Record<Id, Either<Err1, Option<KeysResult>>>;
  type Property1Query = Record<Id, KeysQuery>;
  const property1Result: Property1Result = {
    [id1]: Either_.right(Option_.some(keysResult)),
    [id2]: Either_.right(Option_.none),
  };
  const property1Query: Property1Query = {
    [id1]: keysQuery,
    [id2]: keysQuery,
  };
  const processProperty1: CustomQP<
    Property1Query,
    Property1Result,
    []
  > = scrapql.process.query.ids((r) => r.checkProperty1Existence, processKeys);

  it('processProperty1', async () => {
    const resolvers = createResolvers();
    const main = scrapql.processorInstance(processProperty1, resolvers)(property1Query);
    const result = await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Query],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(property1Result);
  });

  type Property2Result = string;
  type Property2Query = string;
  const property2Result: Property2Result = 'result2';
  const property2Query: Property2Query = 'query2';
  const processProperty2: CustomQP<
    Property2Query,
    Property2Result,
    []
  > = scrapql.process.query.leaf((r) => r.fetchProperty2Result);

  it('processProperty2', async () => {
    const resolvers = createResolvers();
    const main = scrapql.processorInstance(processProperty2, resolvers)(property2Query);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([
      [property2Query],
    ]);
    expect(result).toEqual(property2Result);
  });

  type RootResult = Partial<{
    protocol: typeof RESULT;
    property1: Property1Result;
    property2: Property2Result;
  }>;
  type RootQuery = Partial<{
    protocol: typeof QUERY;
    property1: Property1Query;
    property2: Property2Query;
  }>;
  const rootResult: RootResult = {
    protocol: RESULT,
    property1: property1Result,
  };
  const rootQuery: RootQuery = {
    protocol: QUERY,
    property1: property1Query,
  };

  it('processRoot (composed)', async () => {
    const processRoot: CustomQP<
      RootQuery,
      RootResult,
      []
    > = scrapql.process.query.properties({
      protocol: scrapql.process.query.literal(RESULT),
      property1: processProperty1,
      property2: processProperty2,
    });

    const resolvers = createResolvers();
    const main = scrapql.processorInstance(processRoot, resolvers)(rootQuery);
    const result = await main();

    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Query],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapql.process.query.properties<
      Resolvers,
      RootQuery,
      RootResult,
      []
    >({
      protocol: scrapql.process.query.literal(RESULT),
      property1: scrapql.process.query.ids(
        (r: Resolvers) => r.checkProperty1Existence,
        scrapql.process.query.keys<Resolvers, KeysQuery, Id, KeyQuery, KeyResult, [Id]>(
          scrapql.process.query.leaf((r: Resolvers) => r.fetchKeyResult),
        ),
      ),
      property2: scrapql.process.query.leaf((r: Resolvers) => r.fetchProperty2Result),
    });

    const resolvers = createResolvers();
    const main = scrapql.processorInstance(processRoot, resolvers)(rootQuery);
    const result = await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Query],
    ]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });
});
