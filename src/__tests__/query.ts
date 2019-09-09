import { Task } from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';

import { name, version } from '../../package.json';

import * as scrapqlQuery from '../query';
import { Context, Build, QueryProcessor } from '../types';
import { init } from '../scrapql';

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

  interface Resolvers {
    checkProperty1Existence: (i: Id) => Task<boolean>;
    fetchKeyResult: (i: Id, k: Key) => Task<KeyResult>;
    fetchProperty2Result: () => Task<Property2Result>;
  }

  function createResolvers(): Resolvers {
    return {
      checkProperty1Existence: loggerTask(
        jest.fn((id: Id) => Option_.isSome(property1Result[id])),
      ),
      fetchKeyResult: loggerTask(jest.fn((_0: Id, _1: Key) => key1Result)),
      fetchProperty2Result: loggerTask(jest.fn(() => property2Result)),
    };
  }

  type QPB<Q, R, C extends Context> = Build<QueryProcessor<Q, R>, Resolvers, C>;

  const QUERY = `${name}/${version}/scrapql/test/query`;
  const RESULT = `${name}/${version}/scrapql/test/result`;

  type Id = string & ('id1' | 'id2');
  const id1: Id = 'id1';
  const id2: Id = 'id2';
  type Key = string;
  const key1: Key = 'key1';

  type KeyResult = string;
  type KeyQuery = true;
  const key1Result: KeyResult = 'result1';
  const key1Query: KeyQuery = true;
  const processKey: QPB<KeyQuery, KeyResult, [Key, Id]> = scrapqlQuery.leaf(
    (r) => r.fetchKeyResult,
  );

  it('processKey', async () => {
    const resolvers = createResolvers();
    const main = processKey(resolvers)([key1, id1])(key1Query);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([[id1, key1]]);
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
  const processKeys: QPB<KeysQuery, KeysResult, [Id]> = scrapqlQuery.keys(processKey);

  it('processKeys', async () => {
    const resolvers = createResolvers();
    const main = processKeys(resolvers)([id1])(keysQuery);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([[id1, key1]]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(keysResult);
  });

  type Property1Result = Record<Id, Option<KeysResult>>;
  type Property1Query = Record<Id, KeysQuery>;
  const property1Result: Property1Result = {
    [id1]: Option_.some(keysResult),
    [id2]: Option_.none,
  };
  const property1Query: Property1Query = {
    [id1]: keysQuery,
    [id2]: keysQuery,
  };
  const processProperty1: QPB<Property1Query, Property1Result, []> = scrapqlQuery.ids(
    (r) => r.checkProperty1Existence,
    processKeys,
  );

  it('processProperty1', async () => {
    const resolvers = createResolvers();
    const main = init(processProperty1, resolvers)(property1Query);
    const result = await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([[id1, key1]]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(property1Result);
  });

  type Property2Result = string;
  type Property2Query = true;
  const property2Result: Property2Result = 'result2';
  const property2Query: Property2Query = true;
  const processProperty2: QPB<Property2Query, Property2Result, []> = scrapqlQuery.leaf(
    (r) => r.fetchProperty2Result,
  );

  it('processProperty2', async () => {
    const resolvers = createResolvers();
    const main = init(processProperty2, resolvers)(property2Query);
    const result = await main();
    expect((resolvers.checkProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([[]]);
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
    const processRoot: QPB<RootQuery, RootResult, []> = scrapqlQuery.properties({
      protocol: scrapqlQuery.literal(RESULT),
      property1: processProperty1,
      property2: processProperty2,
    });

    const resolvers = createResolvers();
    const main = init(processRoot, resolvers)(rootQuery);
    const result = await main();

    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([[id1, key1]]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapqlQuery.properties<Resolvers, RootQuery, RootResult, []>({
      protocol: scrapqlQuery.literal(RESULT),
      property1: scrapqlQuery.ids(
        (r: Resolvers) => r.checkProperty1Existence,
        scrapqlQuery.keys(scrapqlQuery.leaf((r: Resolvers) => r.fetchKeyResult)),
      ),
      property2: scrapqlQuery.leaf((r: Resolvers) => r.fetchProperty2Result),
    });

    const resolvers = createResolvers();
    const main = init(processRoot, resolvers)(rootQuery);
    const result = await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((resolvers.checkProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1],
      [id2],
    ]);
    expect((resolvers.fetchKeyResult as any).mock.calls).toMatchObject([[id1, key1]]);
    expect((resolvers.fetchProperty2Result as any).mock.calls).toMatchObject([]);
    expect(result).toEqual(rootResult);
  });
});
