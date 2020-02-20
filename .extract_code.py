

import sys; sys.stdout.write(('\n'.join([i.split('```')[0] for i in sys.stdin.read().split('```typescript')[1:]])).replace("from 'scrapql'", "from './scrapql'").replace("from 'scrapql/lib/", "from './") + '\n' + 'export { Bundle, Customer, CustomerId, Errors, Json, QUERY_PROTOCOL, Query, RESULT_PROTOCOL, Report, Result, Year, client, db, example, exampleBundle, exampleJsonQuery, exampleQuery, exampleResult, exampleJsonResult, jsonQueryProcessor, packageName, packageVersion, processQuery, processResult, reporters, resolvers, server }')
