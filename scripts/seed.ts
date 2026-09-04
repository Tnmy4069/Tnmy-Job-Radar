import { seedDatabase } from "../src/lib/seed/run";

async function main() {
  const result = await seedDatabase();
  console.log(`Seeded ${result.companies} companies and default preferences.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
