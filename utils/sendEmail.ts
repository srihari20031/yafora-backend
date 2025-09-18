import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Use test domain for development, custom domain for production
const FROM_EMAIL = 'Yafora <notifications@yafora.com>'

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
    .replace(/🔗 ([^<\n]+)/g, '<a href="#" style="color: #007bff; text-decoration: none;">$1</a>') // Convert link placeholders
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
      to: 'narayansrihari207@gmail.com',
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
  templateType: 'kyc' | 'product' | 'rental' | 'admin' = 'product'
): Promise<void> {
  const htmlContent = generateEmailTemplate(body, templateType);
  
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'narayansrihari207@gmail.com',
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
    .replace(/🔗 ([^<\n]+)/g, '<a href="#" style="color: #007bff; text-decoration: none; font-weight: bold;">$1</a>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yafora Notification</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container {
          background-color: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 10px;
        }
        .content {
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          font-size: 14px;
          color: #666;
        }
        a {
          color: #007bff;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #007bff;
          color: white !important;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
        .test-banner {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 10px;
          margin-bottom: 20px;
          border-radius: 5px;
          text-align: center;
          font-size: 14px;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${process.env.NODE_ENV !== 'production' ? '<div class="test-banner">🧪 <strong>TEST EMAIL</strong> - This is sent from development environment</div>' : ''}
        
        <div class="header">
          <div class="logo">Yafora</div>
          <p style="margin: 0; color: #666;">Elegant Rentals, Memorable Moments</p>
        </div>
        
        <div class="content">
          <p>${formattedBody}</p>
        </div>
        
        <div class="footer">
          <p>Best regards,<br><strong>Team Yafora</strong></p>
          <p style="margin-top: 20px; font-size: 12px;">
            This is an automated message. Please do not reply to this email.<br>
            If you have any questions, contact us at support@yafora.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

