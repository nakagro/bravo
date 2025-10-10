import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

export const sendTestEmail = action({
  args: {
    to: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const result = await resend.emails.send({
        from: "BRAVO <noreply@mail.bravo.grayhux.io>",
        to: args.to,
        subject: "Test Email from BRAVO",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">BRAVO</h1>
            <p>Hello ${args.userName},</p>
            <p>This is a test email from the <strong>BRAVO</strong> (BRigade AVailability and Operations) system.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              Sent at ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      });

      if (result.error) {
        console.error("Email send error:", result.error);
        throw new Error(`Failed to send email: ${result.error.message}`);
      }

      return { 
        success: true, 
        emailId: result.data?.id,
        message: "Test email sent successfully!"
      };
    } catch (error) {
      console.error("Email action error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to send email");
    }
  },
});
