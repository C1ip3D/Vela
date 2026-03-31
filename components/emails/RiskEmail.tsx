export const renderRiskEmail = (studentName: string, counselorName: string) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      background-color: #f6f9fc;
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif;
      margin: 0;
      padding: 0;
    }
    .container {
      background-color: #ffffff;
      margin: 0 auto;
      padding: 40px;
      max-width: 600px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 30px;
    }
    .text {
      color: #333;
      font-size: 16px;
      line-height: 26px;
      margin-bottom: 20px;
    }
    .footer {
      color: #8898aa;
      font-size: 14px;
      line-height: 20px;
      padding-top: 20px;
      border-top: 1px solid #e6ebf1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Academic Intervention Needed</h1>
    <div class="text">Hi ${counselorName},</div>
    <div class="text">
      We have noticed <strong>${studentName}</strong> is struggling a bit in their classes. You were the listed counselor for them and an intervention may be needed to get ${studentName} back on track.
    </div>
    <div class="footer">
      Sincerely,<br />
      Vela Team
    </div>
  </div>
</body>
</html>
  `;
};
