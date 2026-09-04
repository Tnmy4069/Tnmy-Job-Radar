import { seedDatabase } from "../src/lib/seed/run";
import { runScan } from "../src/lib/scanner/service";

async function main() {
  await seedDatabase();
  const result = await runScan("manual");
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
