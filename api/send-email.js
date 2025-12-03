import { Resend } from 'resend';

/**
 * Vercel serverless function to send emails using Resend
 * POST /api/send-email
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to_email, from_email, from_name, subject, message, dates, total_days, employee_name, employee_email } = req.body;

    // Validate required fields
    if (!to_email || !from_email || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: to_email, from_email, subject, and message are required' 
      });
    }

    // Get Resend API key from environment variables
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured');
      return res.status(500).json({ 
        error: 'Email service is not configured. Please contact administrator.' 
      });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Get the "from" email address from environment or use a default
    const fromEmailAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `${from_name || 'Task Tracker'} <${fromEmailAddress}>`,
      to: [to_email],
      replyTo: from_email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #1177ff; padding-bottom: 10px;">
            Days Off Request
          </h2>
          
          <p>Hello HR Team,</p>
          
          <p>I would like to request the following days off:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Employee:</strong> ${employee_name || from_name}</p>
            <p><strong>Email:</strong> ${employee_email || from_email}</p>
            <p><strong>Total Days:</strong> ${total_days || 'N/A'}</p>
          </div>
          
          ${dates ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #555;">Requested Dates:</h3>
            <ul style="list-style-type: none; padding: 0;">
              ${dates.split(',').map(date => `<li style="padding: 5px 0;">• ${date.trim()}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; white-space: pre-wrap;">${message}</p>
          </div>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>${employee_name || from_name}</strong>
          </p>
        </div>
      `,
      text: message, // Plain text fallback
    });

    if (error) {
      console.error('Resend API error:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to send email. Please try again.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      id: data?.id 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred while sending the email' 
    });
  }
}

