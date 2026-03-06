const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Storm Graser <storm@stormgraser.dev>';
const STORM_EMAIL = 'storm@stormgraser.dev';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, business, need, urgency, company } = req.body || {};

  // Honeypot: real users never fill this hidden field
  if (company) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !email || !business || !need) {
    return res.status(400).json({ error: 'Missing required fields: name, email, business, need' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const urgencyLabel = urgency || 'Not specified';

  // Notification to Storm
  const notificationBody = [
    `New intake from ${name}`,
    `Email: ${email}`,
    `Business: ${business}`,
    `Urgency: ${urgencyLabel}`,
    '',
    `What's eating their time:`,
    need
  ].join('\n');

  // Auto-response to prospect
  const autoResponse = `Got it, ${name}. I'll look at how ${business} runs, where the bottlenecks are, and what I'd automate first. Expect a reply within 24 hours.\n\n-- Storm`;

  try {
    // Send both emails in parallel
    const [notifyRes, autoRes] = await Promise.all([
      fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM,
          to: [STORM_EMAIL],
          subject: `Intake: ${business}`,
          text: notificationBody,
          reply_to: email
        })
      }),
      fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          bcc: ['stormgraser@gmail.com'],
          subject: `Re: ${business}`,
          text: autoResponse,
          reply_to: STORM_EMAIL
        })
      })
    ]);

    if (!notifyRes.ok) {
      const err = await notifyRes.json();
      console.error('Resend notification failed:', err);
      return res.status(500).json({ error: 'Failed to process submission' });
    }

    if (!autoRes.ok) {
      const err = await autoRes.json();
      console.error('Resend auto-response failed:', err);
      // Notification succeeded so the lead isn't lost -- still return ok
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Intake error:', err);
    return res.status(500).json({ error: 'Failed to process submission' });
  }
}
