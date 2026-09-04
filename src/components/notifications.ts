export function notifyNewJobs(count: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("Job Radar", {
      body: `${count} new relevant job${count === 1 ? "" : "s"} discovered.`,
    });
    return;
  }
  if (Notification.permission !== "denied") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification("Job Radar", {
          body: `${count} new relevant job${count === 1 ? "" : "s"} discovered.`,
        });
      }
    });
  }
}
