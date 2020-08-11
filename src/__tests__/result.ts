import * as ruins from 'ruins-ts';
import { Task } from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';

import { name, version } from '../../package.json';

import { Ctx, Ctx0, Dict, ctx, ctx0, dict } from '../scrapql';
import * as scrapql from '../scrapql';

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

describe('result', () => {
  type Reporters = {
    learnProperty1Existence: (r: scrapql.Existence, c: Ctx<Id>) => Task<void>;
    learnProperty3Match: (r: Array<Id>, c: Ctx<Terms>) => Task<void>;
    receiveKeyResult: (
      r: KeyResultPayload,
      c: Ctx<KeyQueryPayload, Ctx<Key, Ctx<Id>>>,
    ) => Task<void>;
    receiveProperty2Result: (
      r: Property2ResultPayload,
      c: Ctx<Property2QueryPayload>,
    ) => Task<void>;
  };

  function createReporters(): Reporters {
    return {
      learnProperty1Existence: loggerTask(
        jest.fn((_0: scrapql.Existence, _1: Ctx<Id>) => undefined),
      ),
      learnProperty3Match: loggerTask(
        jest.fn((_0: Array<Id>, _1: Ctx<Terms>) => undefined),
      ),
      receiveKeyResult: loggerTask(
        jest.fn(
          (_0: KeyResultPayload, _1: Ctx<KeyQueryPayload, Ctx<Key, Ctx<Id>>>) =>
            undefined,
        ),
      ),
      receiveProperty2Result: loggerTask(
        jest.fn(
          (_0: Property2ResultPayload, _1: Ctx<Property2QueryPayload>) => undefined,
        ),
      ),
    };
  }

  type CustomRP<R, C extends scrapql.Context> = scrapql.ResultProcessor<R, C, Reporters>;

  const QUERY = `${name}/${version}/scrapql/test/query`;
  const RESULT = `${name}/${version}/scrapql/test/result`;

  const workspace: [] = [];

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
  const key1Result: KeyResult = { q: keyQueryPayload, r: keyResultPayload };

  const processKey: CustomRP<KeyResult, Ctx<Key, Ctx<Id>>> = scrapql.leaf.processResult(
    (r) => r.receiveKeyResult,
  );

  it('processKey', async () => {
    const reporters = createReporters();
    const context: Ctx<Key, Ctx<Id>> = ctx(key1, ctx(id1));
    const main = scrapql.processorInstance(
      processKey,
      context,
      workspace,
      reporters,
    )(key1Result);
    await ruins.fromTask(main);
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type KeysResult = Dict<Key, KeyResult>;
  const keysResult: KeysResult = dict([key1, key1Result]);
  const processKeys: CustomRP<KeysResult, Ctx<Id>> = scrapql.keys.processResult(
    processKey,
  );

  it('processKeys', async () => {
    const reporters = createReporters();
    const context: Ctx<Id> = ctx(id1);
    const main = scrapql.processorInstance(
      processKeys,
      context,
      workspace,
      reporters,
    )(keysResult);
    await ruins.fromTask(main);
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property1Result = Dict<Id, Option<KeysResult>>;
  const property1Result: Property1Result = dict(
    [id1, Option_.some(keysResult)],
    [id2, Option_.none],
  );
  const processProperty1: CustomRP<Property1Result, Ctx0> = scrapql.ids.processResult<
    Property1Result,
    Ctx0,
    Reporters,
    Id,
    KeysResult
  >((r) => r.learnProperty1Existence, processKeys);

  it('processProperty1', async () => {
    const reporters = createReporters();
    const context: Ctx0 = ctx0;
    const main = scrapql.processorInstance(
      processProperty1,
      context,
      workspace,
      reporters,
    )(property1Result);
    await ruins.fromTask(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [false, ctx(id2), []],
      [true, ctx(id1), []],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property2QueryPayload = string;
  type Property2ResultPayload = string;
  const property2QueryPayload: Property2QueryPayload = 'query2';
  const property2ResultPayload: Property2ResultPayload = 'result2';

  type Property2Result = scrapql.LeafResult<
    Property2QueryPayload,
    Property2ResultPayload
  >;
  const property2Result: Property2Result = {
    q: property2QueryPayload,
    r: property2ResultPayload,
  };

  const processProperty2: CustomRP<Property2Result, Ctx0> = scrapql.leaf.processResult(
    (r) => r.receiveProperty2Result,
  );

  it('processProperty2', async () => {
    const reporters = createReporters();
    const context: Ctx0 = ctx0;
    const main = scrapql.processorInstance(
      processProperty2,
      context,
      workspace,
      reporters,
    )(property2Result);
    await ruins.fromTask(main);
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([
      [property2ResultPayload, ctx(property2QueryPayload), []],
    ]);
  });

  type Property3Result = Dict<Terms, Dict<Id, KeysResult>>;
  const property3Result: Property3Result = dict([terms, dict([id1, keysResult])]);
  const processProperty3: CustomRP<Property3Result, Ctx0> = scrapql.search.processResult<
    Property3Result,
    Ctx0,
    Reporters,
    Terms,
    Id,
    KeysResult
  >((r) => r.learnProperty3Match, processKeys);

  it('processProperty3', async () => {
    const reporters = createReporters();
    const context: Ctx0 = ctx0;
    const main = scrapql.processorInstance(
      processProperty3,
      context,
      workspace,
      reporters,
    )(property3Result);
    await ruins.fromTask(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty3Match as any).mock.calls.sort()).toMatchObject([
      [[id1], ctx(terms), []],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type RootResult = Partial<{
    protocol: scrapql.LiteralResult<typeof QUERY, typeof RESULT>;
    property1: Property1Result;
    property2: Property2Result;
    property3: Property3Result;
  }>;
  const rootResult: RootResult = {
    protocol: { q: QUERY, r: RESULT },
    property1: property1Result,
    property3: property3Result,
  };

  it('processRoot (composed)', async () => {
    const processRoot: CustomRP<RootResult, Ctx0> = scrapql.properties.processResult<
      RootResult,
      Ctx0,
      Reporters
    >({
      protocol: scrapql.literal.processResult(),
      property1: processProperty1,
      property2: processProperty2,
      property3: processProperty3,
    });
    const reporters = createReporters();
    const context: Ctx0 = ctx0;
    const main = scrapql.processorInstance(
      processRoot,
      context,
      workspace,
      reporters,
    )(rootResult);
    await ruins.fromTask(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [false, ctx(id2), []],
      [true, ctx(id1), []],
    ]);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty3Match as any).mock.calls.sort()).toMatchObject([
      [[id1], ctx(terms), []],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapql.properties.processResult<RootResult, Ctx0, Reporters>({
      protocol: scrapql.literal.processResult(),
      property1: scrapql.ids.processResult<
        Property1Result,
        Ctx0,
        Reporters,
        Id,
        KeysResult
      >(
        (r: Reporters) => r.learnProperty1Existence,
        scrapql.keys.processResult<KeysResult, Ctx<Id>, Reporters, Key, KeyResult>(
          scrapql.leaf.processResult<
            KeyResult,
            Ctx<Key, Ctx<Id>>,
            Reporters,
            KeyQueryPayload,
            KeyResultPayload
          >((r: Reporters) => r.receiveKeyResult),
        ),
      ),
      property2: scrapql.leaf.processResult((r: Reporters) => r.receiveProperty2Result),
      property3: scrapql.search.processResult<
        Property3Result,
        Ctx0,
        Reporters,
        Terms,
        Id,
        KeysResult
      >(
        (r) => r.learnProperty3Match,
        scrapql.keys.processResult<KeysResult, Ctx<Id>, Reporters, Key, KeyResult>(
          scrapql.leaf.processResult<
            KeyResult,
            Ctx<Key, Ctx<Id>>,
            Reporters,
            KeyQueryPayload,
            KeyResultPayload
          >((r: Reporters) => r.receiveKeyResult),
        ),
      ),
    });
    const reporters = createReporters();
    const context: Ctx0 = ctx0;
    const main = scrapql.processorInstance(
      processRoot,
      context,
      workspace,
      reporters,
    )(rootResult);
    await ruins.fromTask(main);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [false, ctx(id2), []],
      [true, ctx(id1), []],
    ]);
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty3Match as any).mock.calls.sort()).toMatchObject([
      [[id1], ctx(terms), []],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
      [keyResultPayload, ctx(keyQueryPayload, ctx(key1, ctx(id1))), []],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });
});
