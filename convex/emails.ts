import { action, internalAction } from "./_generated/server";
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

/**
 * Internal action to send feedback notification to admins
 * This is called internally from the submitFeedback mutation
 */
export const sendFeedbackNotification = internalAction({
  args: {
    adminEmails: v.array(v.string()),
    subject: v.string(),
    message: v.string(),
    category: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("general")
    ),
    submitterName: v.optional(v.string()),
    isAnonymous: v.boolean(),
    appVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // If no admins have emails, skip sending
    if (args.adminEmails.length === 0) {
      console.log("No admin emails found, skipping notification");
      return { success: true, message: "No admin emails to notify" };
    }

    // Category emoji and color mapping
    const categoryInfo = {
      general: { emoji: "💬", color: "#10b981", label: "General Feedback" },
      bug: { emoji: "🐛", color: "#ef4444", label: "Bug Report" },
      feature: { emoji: "✨", color: "#3b82f6", label: "Feature Request" },
      improvement: { emoji: "🔧", color: "#f97316", label: "Improvement" },
    };

    const info = categoryInfo[args.category];
    const submitter = args.isAnonymous ? "Anonymous" : (args.submitterName || "Unknown User");

    try {
      const result = await resend.emails.send({
        from: "BRAVO <noreply@mail.bravo.grayhux.io>",
        to: args.adminEmails,
        subject: `New Feedback: ${args.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; margin-bottom: 20px;">BRAVO</h1>
            <h2 style="color: #374151; margin-bottom: 16px;">New ${info.label}</h2>
            
            <div style="background-color: ${info.color}15; border-left: 4px solid ${info.color}; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0; margin-bottom: 8px; font-size: 18px;">${args.subject}</h3>
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                <strong>Category:</strong> ${info.label} | 
                <strong>Submitted by:</strong> ${submitter}
              </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #374151; margin-top: 0; margin-bottom: 12px;">Message:</h4>
              <p style="color: #111827; white-space: pre-wrap; line-height: 1.6; margin: 0;">${args.message}</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                <strong>App Version:</strong> v${args.appVersion}
              </p>
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
      // Don't throw error - we don't want to fail the feedback submission if email fails
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send email"
      };
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

/**
 * Internal action to send password reset email
 * This is called internally from the requestPasswordReset mutation
 */
export const sendPasswordResetEmail = internalAction({
  args: {
    email: v.string(),
    token: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Construct the reset URL using the frontend URL
    // Use FRONTEND_URL env var, fallback to production URL
    const frontendUrl = process.env.FRONTEND_URL || "https://bravo.grayhux.io";
    const resetUrl = `${frontendUrl}/reset-password?token=${args.token}`;

    try {
      const result = await resend.emails.send({
        from: "BRAVO <noreply@mail.bravo.grayhux.io>",
        to: args.email,
        subject: "Reset Your Password - BRAVO",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; margin-bottom: 20px;">BRAVO</h1>
            <h2 style="color: #374151; margin-bottom: 16px;">Password Reset Request</h2>
            
            <p style="color: #4b5563; margin-bottom: 16px;">
              Hello ${args.userName},
            </p>
            
            <p style="color: #4b5563; margin-bottom: 16px;">
              We received a request to reset your password for your BRAVO (BRigade AVailability and Operations) account.
            </p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
              <p style="color: #991b1b; margin: 0; font-weight: 600;">
                Click the button below to reset your password:
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background-color: #dc2626; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); border: 2px solid #dc2626;">
                <span style="color: #ffffff !important;">Reset Password</span>
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                <strong>Important:</strong> This link will expire in 30 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #3b82f6; font-size: 13px; word-break: break-all; margin-bottom: 20px;">
              ${resetUrl}
            </p>
            
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
              <strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed.
            </p>
            
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
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
        message: "Password reset email sent successfully"
      };
    } catch (error) {
      console.error("Email action error:", error);
      // Don't throw error - we don't want to fail the reset request if email fails
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send email"
      };
    }
  },
});

/**
 * The email half of notifyEvent() — one generic branded template every module
 * shares, so a new notification is a call site rather than another bespoke
 * email action. Deliberately never throws: a bounced notification must not roll
 * back the mutation that scheduled it.
 */
export const sendEventNoticeEmail = internalAction({
  args: {
    to: v.array(v.string()),
    subject: v.string(),
    heading: v.string(),
    intro: v.optional(v.string()),
    details: v.array(v.object({ label: v.string(), value: v.string() })),
    listTitle: v.optional(v.string()),
    list: v.array(v.string()),
    url: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    emailId: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.to.length === 0) {
      return { success: true, message: "No recipients to notify" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const frontendUrl = process.env.FRONTEND_URL || "https://bravo.grayhux.io";
    const link = args.url.startsWith("http")
      ? args.url
      : `${frontendUrl}${args.url.startsWith("/") ? "" : "/"}${args.url}`;

    const detailRows = args.details
      .map(
        (d) => `
              <tr>
                <td style="padding: 6px 12px 6px 0; color: #6b7280; font-size: 14px; vertical-align: top; white-space: nowrap;">${d.label}</td>
                <td style="padding: 6px 0; color: #111827; font-size: 14px;">${d.value}</td>
              </tr>`
      )
      .join("");

    const listItems = args.list
      .map(
        (item) =>
          `<li style="color: #111827; font-size: 14px; margin-bottom: 6px; line-height: 1.5;">${item}</li>`
      )
      .join("");

    try {
      const result = await resend.emails.send({
        from: "BRAVO <noreply@mail.bravo.grayhux.io>",
        to: args.to,
        subject: args.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; margin-bottom: 20px;">BRAVO</h1>
            <h2 style="color: #374151; margin-bottom: 16px;">${args.heading}</h2>

            ${
              args.intro
                ? `<p style="color: #4b5563; margin-bottom: 20px; line-height: 1.6;">${args.intro}</p>`
                : ""
            }

            ${
              detailRows
                ? `<table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; padding: 8px; margin-bottom: 20px;">
                     <tbody>${detailRows}</tbody>
                   </table>`
                : ""
            }

            ${
              listItems
                ? `<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                     ${
                       args.listTitle
                         ? `<h3 style="color: #92400e; margin-top: 0; margin-bottom: 10px; font-size: 15px;">${args.listTitle}</h3>`
                         : ""
                     }
                     <ul style="margin: 0; padding-left: 20px;">${listItems}</ul>
                   </div>`
                : ""
            }

            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}"
                 style="display: inline-block; background-color: #dc2626; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                <span style="color: #ffffff !important;">Open in BRAVO</span>
              </a>
            </div>

            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              You're receiving this because you're listed as accountable for this
              area in BRAVO. Sent at ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      });

      if (result.error) {
        console.error("Event notice email error:", result.error);
        return { success: false, message: result.error.message };
      }

      return { success: true, emailId: result.data?.id };
    } catch (error) {
      console.error("Event notice email action error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  },
});
