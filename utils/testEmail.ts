import { Resend } from 'resend';

const resend = new Resend('re_cLtLFe6H_KSyaN1GBgnYxFans9pMicMy8');

async function testEmail() {
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'your-test-email@gmail.com', // Replace with your test email
      subject: 'Test from Script',
      html: '<p>This is a test email from a standalone script.</p>',
    });
    console.log('Email sent:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmail();