import { Task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

import scrap from '../scrapql';

type Logger<R, A extends Array<any>> = (...a: A) => R;
type LoggerTask<R, A extends Array<any>> = (...a: A) => Task<R>;

function loggerTask<R, A extends Array<any>>(logger: Logger<R, A>): LoggerTask<R, A> {
  return (...largs) => () => {
    return Promise.resolve(logger(...largs));
  };
}

describe('scrapql', () => {
  const nopReporter = (...rargs: any) => Task_.of(undefined);
  const nopResolver = (...rargs: any) => Task_.of(undefined);
  const driver = Symbol('driver');
  const arg1 = 'arg1';
  const arg2 = 'arg2';
  const args = [arg1, arg2];

  describe('fields result processor', () => {
    const logger = jest.fn((...largs: any): void => undefined);
    const reporter = loggerTask(logger);
    const result = Symbol('result');
    const processor = scrap.processResultFields(reporter);

    it('should call reporter', async () => {
      await processor(driver, result, ...args)();
      expect(logger.mock.calls).toMatchObject([[driver, result, arg1, arg2]]);
    });
  });

  describe('keys result processor', () => {
    const logger = jest.fn((...largs: any): void => undefined);
    const reporter = loggerTask(logger);
    const result1 = Symbol('result1');
    const result2 = Symbol('result2');
    const results = {
      key1: result1,
      key2: result2,
    };
    const processor = scrap.processResultKeys(reporter);

    it('should call reporter for each result', async () => {
      await processor(driver, results, ...args)();
      expect(logger.mock.calls).toContainEqual([driver, result1, 'key1', arg1, arg2]);
      expect(logger.mock.calls).toContainEqual([driver, result2, 'key2', arg1, arg2]);
      expect(logger.mock.calls).toHaveLength(Object.keys(results).length);
    });
  });

  describe('ids result processor', () => {
    const resultLogger = jest.fn((...largs: any): void => undefined);
    const existenceLogger = jest.fn((...largs: any): void => undefined);
    const resultReporter = loggerTask(resultLogger);
    const existenceReporter = loggerTask(existenceLogger);
    const result1 = Symbol('result1');
    const results = {
      id1: Option_.some(result1),
      id2: Option_.none,
    };

    it('should call existence reporter for each result', async () => {
      const processor = scrap.processResultIds(nopReporter, existenceReporter);
      await processor(driver, results, ...args)();
      expect(existenceLogger.mock.calls).toContainEqual([driver, 'id1', true]);
      expect(existenceLogger.mock.calls).toContainEqual([driver, 'id2', false]);
      expect(existenceLogger.mock.calls).toHaveLength(Object.keys(results).length);
    });

    it('should call result reporter for some results', async () => {
      const processor = scrap.processResultIds(resultReporter, nopReporter);
      await processor(driver, results, ...args)();
      expect(resultLogger.mock.calls).toMatchObject([[driver, result1, 'id1', arg1, arg2]]);
    });
  });

  describe('properties result processor', () => {
    const logger1 = jest.fn((...largs: any) => undefined);
    const logger2 = jest.fn((...largs: any) => undefined);
    const processor1 = loggerTask(logger1);
    const processor2 = loggerTask(logger2);
    const result1 = Symbol('result1');
    const results = {
      property1: result1,
      property2: undefined,
    };
    const processor = scrap.processResultProperties((result: typeof results, helper) => {
      return [
        ...helper(Option_.fromNullable(result.property1), processor1),
        ...helper(Option_.fromNullable(result.property2), processor2),
      ];
    });

    it('should call other result processors based on property names', async () => {
      await processor(driver, results, ...args)();
      expect(logger1.mock.calls).toMatchObject([[driver, result1, arg1, arg2]]);
      expect(logger2.mock.calls).toMatchObject([]);
    });
  });

  describe('fields query processor', () => {
    const result = Symbol('result');
    const logger = jest.fn((...largs: any) => result);
    const resolver = loggerTask(logger);
    const query = true;
    const processor = scrap.processQueryFields(resolver);

    it('should call resolver and return the result', async () => {
      const got = await processor(driver, query, ...args)();
      expect(logger.mock.calls).toMatchObject([[driver, arg1, arg2]]);
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
    const logger = jest.fn((_0: any, query: KeysQuery, key: keyof KeysQuery, ...args: Array<string>) => results[key]);
    const resolver = loggerTask(logger);
    const processor = scrap.processQueryKeys(resolver);

    it('should call resolver for each query and return the results', async () => {
      const got = await processor(driver, queries, ...args)();
      expect(logger.mock.calls).toContainEqual([driver, query1, 'key1', arg1, arg2]);
      expect(logger.mock.calls).toContainEqual([driver, query2, 'key2', arg1, arg2]);
      expect(logger.mock.calls).toHaveLength(Object.keys(queries).length);
      expect(got).toMatchObject(results);
    });
  });

  describe('ids query processor', () => {
    const result1 = Symbol('result1');
    const results: Record<string, any> = {
      id1: Option_.some(result1),
      id2: Option_.none,
    };
    type KeysQuery = Record<string, any>;
    const query1 = Symbol('query1');
    const query2 = Symbol('query2');
    const queries: KeysQuery = {
      id1: query1,
      id2: query2,
    };

    it('should call existence check for each query', async () => {
      const existenceLogger = jest.fn((...cargs: any) => false);
      const existenceCheck = loggerTask(existenceLogger);
      const processor = scrap.processQueryIds(nopResolver, existenceCheck);
      await processor(driver, queries, ...args)();
      expect(existenceLogger.mock.calls).toContainEqual([driver, 'id1']);
      expect(existenceLogger.mock.calls).toContainEqual([driver, 'id2']);
      expect(existenceLogger.mock.calls).toHaveLength(Object.keys(queries).length);
    });

    it('should call query resolver for some queries', async () => {
      const existenceLogger = jest.fn((_0: any, id: string) => Option_.isSome(results[id]));
      const existenceCheck = loggerTask(existenceLogger);
      const queryLogger = jest.fn((_0: any, _1: any, id: string, ...largs: any) =>
        pipe(
          results[id],
          Option_.getOrElse(() => null),
        ),
      );
      const queryResolver = loggerTask(queryLogger);
      const processor = scrap.processQueryIds(queryResolver, existenceCheck);
      const got = await processor(driver, queries, ...args)();
      expect(queryLogger.mock.calls).toMatchObject([[driver, query1, 'id1', arg1, arg2]]);
      expect(got).toMatchObject(results);
    });
  });

  describe('properties query processor', () => {
    const result1 = Symbol('r1');
    const result2 = Symbol('r2');
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
    const logger1 = jest.fn((...largs: any): typeof result1 => result1);
    const logger2 = jest.fn((...largs: any): typeof result2 => result2);
    const processor1 = loggerTask(logger1);
    const processor2 = loggerTask(logger2);

    const processor = scrap.processQueryProperties<unknown, Query, Array<string>, Result>((query: Query, helper) => {
      return {
        ...helper('property1', Option_.fromNullable(query.property1), processor1),
        ...helper('property2', Option_.fromNullable(query.property2), processor2),
      };
    });

    it('should call other query processors based on present properties', async () => {
      const got = await processor(driver, queries, ...args)();
      expect(logger1.mock.calls).toMatchObject([[driver, query1, arg1, arg2]]);
      expect(logger2.mock.calls).toMatchObject([]);
      expect(got).toMatchObject(results);
    });
  });
});
