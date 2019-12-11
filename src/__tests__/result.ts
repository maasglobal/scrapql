import { Task } from 'fp-ts/lib/Task';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';

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

describe('result', () => {
  interface Reporters extends scrapql.Reporters {
    learnProperty1Existence: (i: Id, r: Either<Err1, scrapql.Existence>) => Task<void>;
    receiveKeyResult: (i: Id, k: Key, r: KeyResult) => Task<void>;
    receiveProperty2Result: (r: Property2Result) => Task<void>;
  }

  function createReporters(): Reporters {
    return {
      learnProperty1Existence: loggerTask(
        jest.fn((_0: Id, _1: Either<Err1, scrapql.Existence>) => undefined),
      ),
      receiveKeyResult: loggerTask(
        jest.fn((_0: Id, _1: Key, _2: KeyResult) => undefined),
      ),
      receiveProperty2Result: loggerTask(jest.fn((_0: Property2Result) => undefined)),
    };
  }

  type CustomRP<R, C extends scrapql.Context> = scrapql.ResultProcessor<R, Reporters, C>;

  const RESULT = `${name}/${version}/scrapql/test/result`;

  type Err1 = 'error';

  type Id = string & ('id1' | 'id2');
  const id1: Id = 'id1';
  const id2: Id = 'id2';
  type Key = string;
  const key1: Key = 'key1';

  type KeyResult = string;
  const key1Result: KeyResult = 'result1';
  const processKey: CustomRP<KeyResult, [Key, Id]> = scrapql.process.result.leaf(
    (r) => r.receiveKeyResult,
  );

  it('processKey', async () => {
    const reporters = createReporters();
    const main = processKey(reporters)([key1, id1])(key1Result);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Result],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type KeysResult = Record<Key, KeyResult>;
  const keysResult: KeysResult = {
    [key1]: key1Result,
  };
  const processKeys: CustomRP<KeysResult, [Id]> = scrapql.process.result.keys(processKey);

  it('processKeys', async () => {
    const reporters = createReporters();
    const main = processKeys(reporters)([id1])(keysResult);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Result],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property1Result = Record<Id, Either<Err1, Option<KeysResult>>>;
  const property1Result: Property1Result = {
    [id1]: Either_.right(Option_.some(keysResult)),
    [id2]: Either_.right(Option_.none),
  };
  const processProperty1: CustomRP<Property1Result, []> = scrapql.process.result.ids<
    Reporters,
    Property1Result,
    Id,
    KeysResult,
    [],
    Err1
  >((r) => r.learnProperty1Existence, processKeys);

  it('processProperty1', async () => {
    const reporters = createReporters();
    const main = scrapql.processorInstance(processProperty1, reporters)(property1Result);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, Either_.right(true)],
      [id2, Either_.right(false)],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Result],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property2Result = string;
  const property2Result: Property2Result = 'result2';
  const processProperty2: CustomRP<Property2Result, []> = scrapql.process.result.leaf(
    (r) => r.receiveProperty2Result,
  );

  it('processProperty2', async () => {
    const reporters = createReporters();
    const main = scrapql.processorInstance(processProperty2, reporters)(property2Result);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([
      [property2Result],
    ]);
  });

  type RootResult = Partial<{
    protocol: typeof RESULT;
    property1: Property1Result;
    property2: Property2Result;
  }>;
  const rootResult: RootResult = {
    protocol: RESULT,
    property1: property1Result,
  };

  it('processRoot (composed)', async () => {
    const processRoot: CustomRP<RootResult, []> = scrapql.process.result.properties<
      Reporters,
      RootResult,
      []
    >({
      protocol: scrapql.process.result.literal(),
      property1: processProperty1,
      property2: processProperty2,
    });
    const reporters = createReporters();
    const main = scrapql.processorInstance(processRoot, reporters)(rootResult);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, Either_.right(true)],
      [id2, Either_.right(false)],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Result],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapql.process.result.properties<Reporters, RootResult, []>({
      protocol: scrapql.process.result.literal(),
      property1: scrapql.process.result.ids<
        Reporters,
        Property1Result,
        Id,
        KeysResult,
        [],
        Err1
      >(
        (r: Reporters) => r.learnProperty1Existence,
        scrapql.process.result.keys<
          Reporters,
          KeysResult,
          keyof KeysResult,
          KeysResult[keyof KeysResult],
          [Id]
        >(
          scrapql.process.result.leaf<Reporters, KeyResult, [Key, Id]>(
            (r: Reporters) => r.receiveKeyResult,
          ),
        ),
      ),
      property2: scrapql.process.result.leaf((r: Reporters) => r.receiveProperty2Result),
    });
    const reporters = createReporters();
    const main = scrapql.processorInstance(processRoot, reporters)(rootResult);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      [id1, Either_.right(true)],
      [id2, Either_.right(false)],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [id1, key1, key1Result],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });
});
