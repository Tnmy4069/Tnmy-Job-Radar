const fs = require('fs');
const content = fs.readFileSync('src/lib/seed/companies-additional.ts', 'utf8');
const lines = content.split('\n');
const slugs = ['highradius', 'cloudera', 'observe-ai', 'gainsight', 'fampay', 'fi-money', 'posthog', 'atlan', 'meilisearch'];
for (const slug of slugs) {
  const i = lines.findIndex(l => l.includes('slug: \"' + slug + '\"'));
  if (i >= 0) {
     console.log(slug, i + 1, lines[i+3]);
  } else {
     console.log(slug, 'NOT FOUND');
  }
}
