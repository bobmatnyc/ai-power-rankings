import { Resend } from "resend";

// Initialize Resend only when API key is available
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  return new Resend(apiKey);
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: from || "AI Power Rankings <noreply@aipowerranking.com>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Email send error:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendTestEmail(email: string, subscriberName: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Test Email from AI Power Rankings</h1>
      <p>Hi ${subscriberName},</p>
      <p>This is a test email to verify that your email address is working correctly in our system.</p>
      <p>If you received this email, everything is working as expected!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        AI Power Rankings - Data-driven insights for the AI revolution<br>
        <a href="https://aipowerranking.com" style="color: #0066cc;">aipowerranking.com</a>
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Test Email - AI Power Rankings",
    html,
  });
}

export async function sendNewsletterEmail(email: string, content: string) {
  return sendEmail({
    to: email,
    subject: "AI Power Rankings Weekly Update",
    html: content,
  });
}
