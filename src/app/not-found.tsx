import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That job or company is not in the radar yet.</p>
      <Link href="/" className="mt-4 inline-block text-sm underline">
        Back to jobs
      </Link>
    </div>
  );
}
