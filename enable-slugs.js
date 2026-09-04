const fs = require('fs');
const content = fs.readFileSync('src/lib/seed/companies-additional.ts', 'utf8');
const lines = content.split('\n');
const slugs = ['highradius', 'cloudera', 'observe-ai', 'gainsight', 'fampay', 'fi-money', 'posthog', 'atlan', 'meilisearch'];
let modified = false;

for (const slug of slugs) {
  const i = lines.findIndex(l => l.includes('slug: \"' + slug + '\"'));
  if (i >= 0) {
     for (let j = i; j < i + 15; j++) {
       if (lines[j].includes('enabled: false,')) {
         lines[j] = lines[j].replace('enabled: false,', 'enabled: true,');
         modified = true;
         console.log('Enabled', slug);
         break;
       }
     }
  }
}
if (modified) {
  fs.writeFileSync('src/lib/seed/companies-additional.ts', lines.join('\n'), 'utf8');
  console.log('File updated');
}
