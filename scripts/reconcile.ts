// Usage: npm run reconcile  (calls the running app's reconcile endpoint)
const url = (process.env.APP_URL || "http://localhost:3000") + "/api/cron/reconcile";
const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(res.status, await res.text());
export {};
