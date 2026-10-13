const fs = require('fs');

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    if (!input.trim()) {
      console.log(JSON.stringify({ decision: "allow" }));
      process.exit(0);
    }
    const data = JSON.parse(input);
    const cmd = data.toolCall && data.toolCall.args && data.toolCall.args.CommandLine 
      ? data.toolCall.args.CommandLine 
      : '';

    // Pola destruktif kritis yang wajib diblokir otomatis
    const dangerousPatterns = [
      /rm\s+-rf\s+[\/\\]/i,
      /DROP\s+(DATABASE|SCHEMA)/i,
      /TRUNCATE\s+TABLE/i,
      /del\s+\/[a-z\s]*[c-z]:\\/i,
      /format\s+[c-z]:/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        console.log(JSON.stringify({
          decision: "deny",
          reason: `[SultanSafetyGate] Perintah diblokir otomatis karena berisiko merusak sistem/data: ${cmd}`
        }));
        process.exit(0);
      }
    }

    // Default: izinkan eksekusi tool
    console.log(JSON.stringify({ decision: "allow" }));
  } catch (err) {
    console.log(JSON.stringify({ decision: "allow" }));
  }
});
