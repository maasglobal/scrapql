import { Task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

import * as scrap from '../scrapql';

interface Logger<R, A extends Array<any>> {
  (...a: A): R;
  mock: any;
}
interface LoggerTask<R, A extends Array<any>> {
  (...a: A): Task<R>;
  mock: any;
}

function loggerTask<R, A extends Array<any>>(logger: Logger<R, A>): LoggerTask<R, A> {
  const task: LoggerTask<R, A> = (...largs) => () => {
    return Promise.resolve(logger(...largs));
  };
  // eslint-disable-next-line fp/no-mutation
  task.mock = logger.mock;
  return task;
}

describe('scrapql', () => {
  const nopReporter = (...rargs: any) => Task_.of(undefined);
  const nopResolver = (...rargs: any) => Task_.of(undefined);
  const nopProcessor = (...rargs: any) => Task_.of(undefined);
  const nopResolvers = Symbol('resolvers');
  const nopReporters = Symbol('reporters');
  const ctx2 = 'ctx2';
  const ctx1 = 'ctx1';
  const exampleContext = [ctx2, ctx1];

  describe('fields result processor', () => {
    const reporters = {
      reportResult: loggerTask(jest.fn((...largs: any): void => undefined)),
    };
    const result = Symbol('result');
    const processor = scrap.processResultFields((r: typeof reporters) => r.reportResult);
    it('should call sub result reporter', async () => {
      const main = processor(reporters, result, ...exampleContext);
      await main();
      expect(reporters.reportResult.mock.calls).toMatchObject([[result, ctx2, ctx1]]);
    });
  });

  describe('keys result processor', () => {
    const subProcessor = loggerTask(jest.fn((...largs: any): void => undefined));
    const result1 = Symbol('result1');
    const result2 = Symbol('result2');
    const results = {
      key1: result1,
      key2: result2,
    };
    const processor = scrap.processResultKeys(subProcessor);

    it('should call sub result processor for each result', async () => {
      const main: Task<void> = processor(nopReporters, results, ...exampleContext);
      await main();
      expect(subProcessor.mock.calls).toContainEqual([nopReporters, result1, 'key1', ctx2, ctx1]);
      expect(subProcessor.mock.calls).toContainEqual([nopReporters, result2, 'key2', ctx2, ctx1]);
      expect(subProcessor.mock.calls).toHaveLength(Object.keys(results).length);
    });
  });

  describe('ids result processor', () => {
    const keyProcessor = loggerTask(jest.fn((...largs: any): void => undefined));
    const reporters = {
      existence: loggerTask(jest.fn((...largs: any): void => undefined)),
    };
    const result1 = Symbol('result1');
    const results = {
      id1: Option_.some(result1),
      id2: Option_.none,
    };

    it('should call existence reporter for each result', async () => {
      const processor = scrap.processResultIds((r: typeof reporters) => r.existence, nopProcessor);
      const main = processor(reporters, results, ...exampleContext);
      await main();
      expect(reporters.existence.mock.calls).toContainEqual(['id1', true]);
      expect(reporters.existence.mock.calls).toContainEqual(['id2', false]);
      expect(reporters.existence.mock.calls).toHaveLength(Object.keys(results).length);
    });

    it('should call sub result processor for some results', async () => {
      const processor = scrap.processResultIds((r: typeof reporters) => nopReporter, keyProcessor);
      const main = processor(reporters, results, ...exampleContext);
      await main();
      expect(keyProcessor.mock.calls).toMatchObject([[reporters, result1, 'id1', ctx2, ctx1]]);
    });
  });

  describe('properties result processor', () => {
    const processor1 = loggerTask(jest.fn((...largs: any) => undefined));
    const processor2 = loggerTask(jest.fn((...largs: any) => undefined));
    const result1 = Symbol('result1');
    const results = {
      property1: result1,
    };
    const processor = scrap.processResultProperties({
      property1: processor1,
      property2: processor2,
    });

    it('should call other result processors based on property names', async () => {
      const main = processor(nopReporters, results, ...exampleContext);
      await main();
      expect(processor1.mock.calls).toMatchObject([[nopReporters, result1, ctx2, ctx1]]);
      expect(processor2.mock.calls).toMatchObject([]);
    });
  });

  describe('combined result processor', () => {
    const reporters = {
      learnExistence: loggerTask(jest.fn((...largs: any): void => undefined)),
      receiveData: loggerTask(jest.fn((...largs: any): void => undefined)),
    };

    const result1 = Symbol('result1');
    const results = {
      property1: {
        id1: Option_.some({
          key1: result1,
        }),
        id2: Option_.none,
      },
    };
    const processor = scrap.processResultProperties({
      property1: scrap.processResultIds(
        (r: typeof reporters) => r.learnExistence,
        scrap.processResultKeys(
          scrap.processResultFields((r: typeof reporters) => r.receiveData)
        ),
      ),
    });

    it('should call stuff', async () => {
      const main = processor(reporters, results);
      await main();
      expect(reporters.learnExistence.mock.calls).toMatchObject([['id1', true], ['id2', false]]);
      expect(reporters.receiveData.mock.calls).toMatchObject([[result1, 'key1', 'id1']]);
    });
  });

  describe('fields query processor', () => {
    const result = Symbol('result');
    const resolvers = {
      resolveQuery: loggerTask(jest.fn((...largs: any) => result)),
    };
    const query = true;
    const processor = scrap.processQueryFields((r: typeof resolvers) => r.resolveQuery);
    it('should call sub query resolver and return the result', async () => {
      const main = processor(resolvers, query, ...exampleContext);
      const got = await main();
      expect(resolvers.resolveQuery.mock.calls).toMatchObject([[ctx2, ctx1]]);
      expect(got).toEqual(result);
    });
  });

  describe('keys query processor', () => {
    const result1 = Symbol('result1');
    const result2 = Symbol('result2');
    const results: Record<string, any> = {
      key1: result1,
      key2: result2,
    };
    type KeysQuery = Record<string, any>;
    const query1 = Symbol('query1');
    const query2 = Symbol('query2');
    const queries: KeysQuery = {
      key1: query1,
      key2: query2,
    };
    const subProcessor = loggerTask(
      jest.fn((_0: unknown, query: KeysQuery, key: keyof KeysQuery, ...exampleContext) => results[key]),
    );
    const processor = scrap.processQueryKeys(subProcessor);

    it('should call sub query processor for each query and return the results', async () => {
      const main = processor(nopResolvers, queries, ...exampleContext);
      const got = await main();
      expect(subProcessor.mock.calls).toContainEqual([nopResolvers, query1, 'key1', ctx2, ctx1]);
      expect(subProcessor.mock.calls).toContainEqual([nopResolvers, query2, 'key2', ctx2, ctx1]);
      expect(subProcessor.mock.calls).toHaveLength(Object.keys(queries).length);
      expect(got).toMatchObject(results);
    });
  });

  describe('ids query processor', () => {
    const result1 = Symbol('result1');
    const results: Record<string, any> = {
      id1: Option_.some(result1),
      id2: Option_.none,
    };
    type IdsQuery = Record<string, any>;
    const query1 = Symbol('query1');
    const query2 = Symbol('query2');
    const queries: IdsQuery = {
      id1: query1,
      id2: query2,
    };
    const resolvers = {
      existence: loggerTask(jest.fn((id: string) => Option_.isSome(results[id]))),
    };
    const subProcessor = loggerTask(
      jest.fn((_0: unknown, query: IdsQuery, id: keyof IdsQuery, ...exampleContext) =>
        pipe(
          results[id],
          Option_.getOrElse(() => null),
        ),
      ),
    );

    it('should call existence check for each query', async () => {
      const processor = scrap.processQueryIds((r: typeof resolvers) => r.existence, nopResolver);
      const main = processor(resolvers, queries, ...exampleContext);
      await main();
      expect(resolvers.existence.mock.calls).toContainEqual(['id1']);
      expect(resolvers.existence.mock.calls).toContainEqual(['id2']);
      expect(resolvers.existence.mock.calls).toHaveLength(Object.keys(queries).length);
    });

    it('should call sub query processor for some queries', async () => {
      const processor = scrap.processQueryIds((r: typeof resolvers) => r.existence, subProcessor);
      const main = processor(resolvers, queries, ...exampleContext);
      const got = await main();
      expect(subProcessor.mock.calls).toMatchObject([[resolvers, query1, 'id1', ctx2, ctx1]]);
      expect(got).toMatchObject(results);
    });
  });

  describe('properties query processor', () => {
    const result1 = Symbol('result1');
    const result2 = Symbol('result2');
    type Result = Partial<{
      readonly property1: typeof result1;
      readonly property2: typeof result2;
    }>;
    const results: Result = {
      property1: result1,
    };
    const query1 = Symbol('query1');
    const query2 = Symbol('query2');
    type Query = Partial<{
      readonly property1: typeof query1;
      readonly property2: typeof query2;
    }>;
    const queries: Query = {
      property1: query1,
    };
    const processor1 = loggerTask(jest.fn((...largs: any): typeof result1 => result1));
    const processor2 = loggerTask(jest.fn((...largs: any): typeof result2 => result2));

    const processor = scrap.processQueryProperties({
      property1: processor1,
      property2: processor2,
    });

    it('should call other query processors based on present properties', async () => {
      const main = processor(nopResolvers, queries, ...exampleContext);
      const got = await main();
      expect(processor1.mock.calls).toMatchObject([[nopResolvers, query1, ctx2, ctx1]]);
      expect(processor2.mock.calls).toMatchObject([]);
      expect(got).toMatchObject(results);
    });
  });

  describe('combined query processor', () => {

    const result1 = Symbol('result1');
    const items: Record<string, any> = {
      id1: Option_.some({
        key1: result1,
      }),
      id2: Option_.none,
    };
    const results = {
      property1: items,
    }

    const query = {
      property1: {
        id1: {
          key1: true,
        },
        id2: {
          key1: true,
        },
      },
    };

    const resolvers = {
      checkExistence: loggerTask(jest.fn((id: string) => Option_.isSome(items[id]))),
      fetchData: loggerTask(jest.fn((...largs: any) => result1)),
    };

    const processor = scrap.processQueryProperties({
      property1: scrap.processQueryIds(
        (r: typeof resolvers) => r.checkExistence,
        scrap.processQueryKeys(
          scrap.processQueryFields((r: typeof resolvers) => r.fetchData)
        ),
      ),
    });

    it('should call stuff', async () => {
      const main = processor(resolvers, query);
      const got = await main();
      expect(resolvers.checkExistence.mock.calls).toMatchObject([['id1'], ['id2']]);
      expect(resolvers.fetchData.mock.calls).toMatchObject([['key1', 'id1']]);
      expect(got).toMatchObject(results);
    });
  });
});
