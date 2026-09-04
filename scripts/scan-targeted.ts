import { runScan } from "../src/lib/scanner/service";

async function main() {
  const slugs = ['highradius', 'cloudera', 'observe-ai', 'gainsight', 'fampay', 'fi-money', 'posthog', 'atlan', 'meilisearch'];
  for (const slug of slugs) {
    console.log('Scanning', slug);
    try {
      const res = await runScan("manual", slug);
      console.log('Result for', slug, ':', res);
    } catch(e) {
      console.error('Error scanning', slug, e);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
