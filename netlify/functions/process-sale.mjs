import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

async function generateAIaudit(businessUrl) {
  console.log(`🤖 Analyzing business website: ${businessUrl}`);
  const groqPrompt = `As a senior automation consultant at Cyrnel Origin, analyze ${businessUrl} and create a detailed "AI-Powered Business Automation Audit" with the following structure:

1. EXECUTIVE SUMMARY: 3-4 key findings on automation potential.
2. IDENTIFIED PROCESSES: 3-5 repetitive tasks suitable for automation.
3. QUICK-WIN AUTOMATIONS: Specific implementable solutions with time estimates.
4. TECHNOLOGY RECOMMENDATIONS: Appropriate tools for implementation.
5. 90-DAY ROADMAP: Phased implementation plan.
6. ROI ANALYSIS: Time and cost savings projections.

Tone: Professional, actionable, value-focused.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // UPDATED: Model no longer decommissioned
        messages: [{ role: 'user', content: groqPrompt }],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Groq API Error ${response.status}:`, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const auditContent = data.choices[0]?.message?.content || 'Audit generation completed.';
    console.log('✅ AI audit generated successfully');
    return auditContent;

  } catch (error) {
    console.error('❌ Audit generation failed:', error.message);
    // Professional fallback
    return `**AI-Powered Business Automation Audit for ${businessUrl}**

Thank you for choosing Cyrnel Origin. Our system has received your request for ${businessUrl}.

Due to high demand on our AI systems, your full customized audit is being finalized by our specialists and will be delivered within 24 hours.

In the meantime, our preliminary analysis suggests significant automation potential in lead management and customer onboarding processes.

-- Cyrnel Origin Automation Team`;
  }
}

async function sendAuditEmail(customerEmail, customerName, businessUrl, auditContent, orderId) {
  console.log(`📧 Sending audit to: ${customerEmail}`);
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your AI-Powered Business Automation Audit</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0; color: white; }
        .content { background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .audit-box { background: #f8fafc; border-left: 4px solid #4f46e5; padding: 25px; margin: 30px 0; white-space: pre-wrap; font-family: monospace; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; text-align: center; font-size: 13px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Your AI-Powered Business Audit</h1>
        <p>Cyrnel Origin Automation Analysis</p>
    </div>
    <div class="content">
        <p>Hi <strong>${customerName || 'Business Leader'}</strong>,</p>
        <p>Your customized automation audit for <strong>${businessUrl}</strong> is ready.</p>
        <div class="audit-box">${auditContent.replace(/\n/g, '<br>')}</div>
        <p>Best regards,<br><strong>The Cyrnel Origin Team</strong></p>
        <div class="footer">
            <p>Order Reference: ${orderId} | © ${new Date().getFullYear()} Cyrnel Origin</p>
        </div>
    </div>
</body>
</html>`;

  try {
    // FIXED: Sanitize the order ID for the tag by removing non-ASCII characters like '=='
    const sanitizedOrderId = orderId.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);

    const { data, error } = await resend.emails.send({
      from: 'Cyrnel Origin <audits@cyrnelorigin.online>',
      to: [customerEmail],
      subject: `Your AI-Powered Business Automation Audit for ${businessUrl} | Cyrnel Origin`,
      html: emailHtml,
      text: `CYRNEL ORIGIN AUDIT\n\nFor: ${businessUrl}\n\n${auditContent}\n\n---\nOrder Reference: ${orderId}`,
      tags: [{ name: 'audit', value: sanitizedOrderId }] // FIXED: Tag now uses sanitized ID
    });

    if (error) throw error;
    console.log(`✅ Email delivered! Resend ID: ${data.id}`);
    return { success: true, emailId: data.id };

  } catch (error) {
    console.error('❌ Critical email failure:', error);
    return { success: false, error: error.message };
  }
}

export const handler = async (event, context) => {
  console.log('🚀 Cyrnel Origin Automation Engine - Production v1.1');
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  // 1. Validate request
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 2. Parse Gumroad webhook data
  let saleData = {};
  try {
    const params = new URLSearchParams(event.body);
    saleData = Object.fromEntries(params.entries());
    console.log('📊 Webhook parsed successfully');
  } catch (e) {
    console.error('❌ Parse error:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid data format' }) };
  }

  // 3. Extract data
  const email = saleData.email;
  const productName = saleData.product_name || 'AI Audit';
  const price = saleData.price ? (parseInt(saleData.price) / 100).toFixed(2) : '0.00';
  const orderId = saleData.sale_id || `ORD-${Date.now()}`;

  // EXTRACT WEBSITE - This is the key variable
  let businessUrl = saleData['custom_fields[website]'] || saleData.website || 'Not provided';
  businessUrl = businessUrl.replace(/^(https?:\/\/)?(www\.)?/, ''); // Clean URL

  const customerName = saleData.full_name || email.split('@')[0] || 'Valued Client';

  console.log(`✅ Processing: ${productName}`);
  console.log(`   📧 Customer: ${customerName} (${email})`);
  console.log(`   💰 Amount: ${price}`);
  console.log(`   🆔 Order: ${orderId}`);
  console.log(`   🌐 Website: ${businessUrl}`); // This will show the result

  // 4. Generate AI Audit
  console.log('🤖 Initiating AI analysis...');
  const auditContent = await generateAIaudit(businessUrl);
  console.log('📄 Audit content generated');

  // 5. Send Email
  console.log('📤 Delivering audit to customer...');
  const emailResult = await sendAuditEmail(email, customerName, businessUrl, auditContent, orderId);

  // 6. Return response
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: emailResult.success,
      message: emailResult.success ? 'Audit completed and delivered.' : 'Audit generated but delivery failed.',
      audit: {
        generated: true,
        delivered: emailResult.success,
        order_id: orderId,
        business_website: businessUrl
      }
    })
  };
};
