

import sys; sys.stdout.write(('/*' + '\n' + '/*'.join(
  '*/'.join(sys.stdin.read().split('```typescript')).split('```')
) + '*/').replace("from 'scrapql'", "from './scrapql'").replace("from 'scrapql/lib/", "from './") + '\n' + 'export { Customer, CustomerId, Driver, Err, Json, QUERY_PROTOCOL, Query, RESULT_PROTOCOL, Report, Result, Year, client, db, example, exampleQuery, exampleResult, packageName, packageVersion, reporters, resolvers, server, wireQueryProcessor, wireResult }')
