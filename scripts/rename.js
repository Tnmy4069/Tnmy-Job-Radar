const fs = require('fs');
let text = fs.readFileSync('src/components/jobs-list.tsx', 'utf8');
text = text.replace('export function Dashboard()', 'export function JobsList()');
fs.writeFileSync('src/components/jobs-list.tsx', text);
