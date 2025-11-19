import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Use test domain for development, custom domain for production
const FROM_EMAIL = 'Yafora <info@yafora.com>';

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`📧 Sending email to: ${to}`);
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      html: convertTextToHtml(body),
    });

    console.log(`📧 Email sent successfully! ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error}`);
  }
}

// Helper function to convert plain text to HTML with basic formatting
function convertTextToHtml(text: string): string {
  return text
    .replace(/\n\n/g, '</p><p>') // Convert double line breaks to paragraphs
    .replace(/\n/g, '<br>') // Convert single line breaks to <br>
    .replace(/🔗 ([^<\n]+)/g, '<a href="#" style="color: #670D2F; text-decoration: none; font-weight: 500;">$1</a>') // Convert link placeholders
    .replace(/^/, '<p>') // Add opening paragraph tag
    .replace(/$/, '</p>'); // Add closing paragraph tag
}

// Alternative function for HTML emails with better formatting
export async function sendHtmlEmail(
  to: string, 
  subject: string, 
  htmlContent: string,
  textContent?: string
): Promise<void> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent, // Optional plain text fallback
    });

    console.log(`📧 HTML Email sent successfully! ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Error sending HTML email:', error);
    throw new Error(`Failed to send email: ${error}`);
  }
}

// Template-based email function for better formatting
export async function sendTemplatedEmail(
  to: string,
  subject: string,
  body: string,
  templateType: 'kyc' | 'product' | 'rental' | 'delivery' | 'admin' = 'product' 
): Promise<void> {
  const htmlContent = generateEmailTemplate(body, templateType);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      html: htmlContent,
    });

    console.log(`📧 Templated email (${templateType}) sent successfully! ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Error sending templated email:', error);
    throw new Error(`Failed to send email: ${error}`);
  }
}

function generateEmailTemplate(body: string, templateType: string): string {
  const formattedBody = body
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/🔗 ([^<\n]+)/g, '<a href="#" style="color: #670D2F; text-decoration: none; font-weight: 500;">$1</a>');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yafora Notification</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #F9FAFB;
          color: #111827;
        }
        .container {
          max-width: 640px;
          margin: 20px auto;
          background-color: #FFFFFF;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .header {
          background: linear-gradient(135deg, #670D2F 0%, #A53860 100%);
          padding: 40px 24px;
          text-align: center;
        }
        .logo {
          font-size: 30px;
          font-weight: 700;
          color: #FFFFFF;
          margin: 0;
        }
        .header-subtitle {
          color: #EF88AD;
          font-size: 16px;
          margin: 8px 0 0;
          font-weight: 400;
        }
        .content {
          padding: 32px 28px;
        }
        h2 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #111827;
        }
        p {
          margin: 0 0 16px;
          line-height: 1.6;
          font-size: 15px;
        }
        .highlight-box {
          background: #F3F4F6;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 15px;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, #670D2F 0%, #A53860 100%);
          color: #FFFFFF !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 24px 0;
          text-align: center;
          transition: transform 0.2s ease;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .footer {
          background-color: #F9FAFB;
          padding: 24px;
          text-align: center;
          font-size: 14px;
          color: #6B7280;
          border-top: 1px solid #E5E7EB;
        }
        .social-links {
          margin: 16px 0;
        }
        .social-icon {
          display: inline-block;
          margin: 0 8px;
          opacity: 0.7;
          transition: opacity 0.2s ease;
        }
        .social-icon:hover {
          opacity: 1;
        }
        a {
          color: #670D2F;
          text-decoration: none;
          font-weight: 500;
        }
        a:hover {
          text-decoration: underline;
        }
        @media (max-width: 640px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .header {
            padding: 28px 16px;
          }
          .content {
            padding: 24px 16px;
          }
          .button {
            display: block;
            text-align: center;
            width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${process.env.NODE_ENV !== 'production' ? '<div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:16px;margin:0 24px 24px;border-radius:6px;font-size:14px;color:#92400E;">🧪 <strong>TEST EMAIL</strong> - This is sent from development environment</div>' : ''}

        <div class="header">
          <h1 class="logo">Yafora</h1>
          <p class="header-subtitle">Elegant Rentals, Memorable Moments</p>
        </div>
        
        <div class="content">
          <h2>Reservation Confirmed 🎉</h2>
          <div class="highlight-box">${formattedBody}</div>
          <a href="https://shop.yafora.com" class="button">Visit Yafora</a>
        </div>
        
        <div class="footer">
          <div class="social-links">
            <a href="https://twitter.com/yafora" class="social-icon">
              <img src="https://img.icons8.com/color/24/twitter--v1.png" alt="Twitter" width="24" height="24">
            </a>
            <a href="https://facebook.com/yafora" class="social-icon">
              <img src="https://img.icons8.com/color/24/facebook-new.png" alt="Facebook" width="24" height="24">
            </a>
            <a href="https://instagram.com/yafora" class="social-icon">
              <img src="https://img.icons8.com/color/24/instagram-new.png" alt="Instagram" width="24" height="24">
            </a>
          </div>
          <p>Best regards,<br><strong>Team Yafora</strong></p>
          <p style="margin-top: 16px;">
            This is an automated message. Please do not reply to this email.<br>
            If you have any questions, contact us at <a href="mailto:info@yafora.com">info@yafora.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
