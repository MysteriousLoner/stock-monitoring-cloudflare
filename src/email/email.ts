import { Resend } from 'resend';

export class EmailService {
    async sendEmail(apikey: string, lowStock: string, outOfStock: string, Inv: string[], locationId: string, receipiant: string): Promise<string> {
        const lowStockArray = lowStock.split('\n').filter(item => item.trim() !== '');
        const outOfStockArray = outOfStock.split('\n').filter(item => item.trim() !== '');

        const lowStockHtml = lowStockArray
        .map(item => `<li>${item}</li>`)
        .join('');

        const outOfStockHtml = outOfStockArray
        .map(item => `<li>${item}</li>`)
        .join('');

        const totalItems = Inv.total?.[0]?.total ?? 0;
        const inStock = totalItems - outOfStockArray.length;
        const outOfStockNum = outOfStockArray.length;;

        const emailBody = `
<html>
<head>
  <style>
    body {
      background-color: #000;
      font-family: Arial, sans-serif;
      padding: 20px;
      color: white;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stats-container {
      display: flex;
      gap: 40px;
      justify-content: center;
      margin-bottom: 40px;
    }

    .stat {
      text-align: center;
      font-weight: bold;
    }

    .number {
      font-size: 2.5rem;
      color: #ff0000; /* bright red */
      margin-bottom: 4px;
    }

    .label {
      font-size: 1rem;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .message {
      font-weight: bold;
      margin-bottom: 20px;
      text-align: center;
    }

    .stock-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .container {
      display: flex;
      gap: 40px;
      justify-content: center;
      flex-wrap: wrap;
    }

    h2 {
      margin: 10px 0 5px;
      color: #fff;
      text-align: center;
    }

    ul {
      list-style-type: disc;
      border: 1px solid #ccc;
      border-radius: 6px;
      width: 300px;
      min-height: 150px;
      padding: 10px 30px;
      overflow-y: auto;
      background-color: #575757ff;
    }

    li {
      margin: 5px 0;
    }

    .low-stock {
      color: orange;
    }

    .out-of-stock {
      color: red;
    }

    .header-text {
        text-align: center;
        margin-bottom: 30px;
    }

    .header-text h1 {
        font-size: 2rem;
        margin: 0;
        color: #fff;
    }

    .header-text p {
        font-size: 1rem;
        color: #ccc;
        margin-top: 8px;
    }

    .locationId {
        font-size: 1.2rem;
        color: #ff0000; /* bright red */
        font-weight: bold;
        margin-top: 10px;
    }
  </style>
</head>
<body style="background-color: #000000; color: white; font-family: Arial, sans-serif; padding: 20px; margin: 0;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
    <tr>
      <td align="center" style="padding-bottom: 20px;">
        <h1 style="color: white; margin: 0;">Inventory Overview for</h1>
        <h2 class="locationId">${locationId}</h2>
        <p style="color: #ccc; font-size: 14px; margin: 5px 0 20px;">Current status of your stock items</p>
      </td>
    </tr>

    <!-- Stats Row -->
    <tr>
      <td>
        <table width="100%" cellpadding="10" cellspacing="0" style="text-align: center;">
          <tr>
            <td style="color: red; font-size: 24px;">${totalItems}</td>
            <td style="color: red; font-size: 24px;">${inStock}</td>
            <td style="color: red; font-size: 24px;">${outOfStockNum}</td>
          </tr>
          <tr>
            <td style="color: #aaa;">Total Items</td>
            <td style="color: #aaa;">In Stock</td>
            <td style="color: #aaa;">Out of Stock</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Message -->
    <tr>
      <td align="center" style="padding: 20px 0; font-weight: bold;">
        The items below are running out of stock:
      </td>
    </tr>

    <!-- Lists -->
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top" width="50%" style="padding: 10px;">
              <h3 style="color: orange;">Low Stock Items</h3>
              <ul style="padding-left: 20px; color: orange;">
                ${lowStockHtml}
              </ul>
            </td>
            <td valign="top" width="50%" style="padding: 10px;">
              <h3 style="color: red;">Out of Stock Items</h3>
              <ul style="padding-left: 20px; color: red;">
                ${outOfStockHtml}
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

        const data = await this.resendUtil(emailBody, apikey, receipiant);

        return emailBody;
    }

    async resendUtil(emailBody: string, resendAPI: string, receipiant: string): Promise<void> {
        const resend = new Resend(resendAPI);

        try {
            const {data, error} = await resend.emails.send({
                from: 'Stock Monitor <stockmonitor@resend.dev>',
                to: [receipiant],
                subject: 'Stock Monitor Alert',
                html: emailBody,
            });
            console.log('Email sent successfully:', data);
        }
        catch (error) {
            console.error('Error sending email:', error);
            throw new Error('Failed to send email');
        }
    }
}
    

    