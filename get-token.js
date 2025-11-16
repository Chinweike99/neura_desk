import 'dotenv/config';
import { google } from "googleapis";
import readline from "readline";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

const SCOPES = ["https://mail.google.com/"]; // full Gmail access

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
});

console.log("Authorize this app by visiting this url:", authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from that page here: ", async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log("Your refresh token:", tokens.refresh_token);
  rl.close();
});
