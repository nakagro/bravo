import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";

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

/**
 * Internal action to send new user signup notification to admins
 * This is called internally from the storeSignupData mutation
 */
export const sendNewUserSignupNotification = internalAction({
  args: {
    adminEmails: v.array(v.string()),
    newUserName: v.string(),
    newUserEmail: v.string(),
    newUserMemberNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // If no admins have emails, skip sending
    if (args.adminEmails.length === 0) {
      console.log("No admin emails found, skipping notification");
      return { success: true, message: "No admin emails to notify" };
    }

    try {
      const result = await resend.emails.send({
        from: "BRAVO <noreply@mail.bravo.grayhux.io>",
        to: args.adminEmails,
        subject: "New User Signup - BRAVO",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; margin-bottom: 20px;">BRAVO</h1>
            <h2 style="color: #374151; margin-bottom: 16px;">New User Signup</h2>
            
            <p style="color: #4b5563; margin-bottom: 16px;">
              A new user has signed up for the BRAVO (BRigade AVailability and Operations) system.
            </p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0; margin-bottom: 12px;">User Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Name:</td>
                  <td style="padding: 8px 0; color: #111827;">${args.newUserName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Email:</td>
                  <td style="padding: 8px 0; color: #111827;">${args.newUserEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">CFA Member Number:</td>
                  <td style="padding: 8px 0; color: #111827;">${args.newUserMemberNumber}</td>
                </tr>
              </table>
            </div>
            
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
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
        message: `Notification sent to ${args.adminEmails.length} admin(s)`
      };
    } catch (error) {
      console.error("Email action error:", error);
      // Don't throw error - we don't want to fail the signup if email fails
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send email"
      };
    }
  },
});
