

import sys; sys.stdout.write(('\n'.join([i.split('```')[0] for i in sys.stdin.read().split('```typescript')[1:]])).replace("from 'scrapql'", "from './scrapql'").replace("from 'scrapql/lib/", "from './"))
