/**
 * Fire-and-forget HTTP client to the notifications service.
 *
 * Never throws; every send is wrapped so a notification failure cannot break
 * the apply workflow.
 */
const URL = process.env.NOTIFICATIONS_URL || 'http://notifications:8006';

export async function notify(args: {
  userId?: string;
  email: string;
  template: string;
  data?: any;
  idempotencyKey?: string;
}) {
  try {
    const r = await fetch(`${URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!r.ok) {
      console.warn(`[notify] ${args.template} → ${args.email}: HTTP ${r.status}`);
    }
  } catch (e: any) {
    console.warn(`[notify] ${args.template} → ${args.email}: ${e?.message || e}`);
  }
}
