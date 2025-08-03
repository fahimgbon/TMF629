# Complete Setup Guide: TMF Slack Integration

## 🎯 Overview
This guide will walk you through setting up the TMF Slack integration from scratch. No technical expertise required - just follow each step carefully.

**Time Required:** 45-60 minutes
**What You'll Need:**
- Admin access to Salesforce
- Admin access to Slack workspace
- Postman desktop app (free)
- A computer with internet access

---

## 📋 Table of Contents
1. [Salesforce Setup (15 min)](#part-1-salesforce-setup)
2. [Postman Configuration (10 min)](#part-2-postman-configuration)
3. [Getting Your Refresh Token (5 min)](#part-3-getting-refresh-token)
4. [Slack App Setup (15 min)](#part-4-slack-app-setup)
5. [Code Setup (10 min)](#part-5-code-setup)
6. [Testing Your Setup (5 min)](#part-6-testing)
7. [Troubleshooting](#troubleshooting)

---

## Part 1: Salesforce Setup

### Step 1: Enable Connected Apps
1. **Login to Salesforce** as an administrator
2. Click the **Gear icon** (⚙️) → **Setup**
3. In the Quick Find box, type `External Client Apps`
4. Click **External Client App Settings**
5. Turn ON **"Allow creation of connected apps"**
6. Click **Save**

### Step 2: Create Your Connected App
1. Click **New Connected App**
2. Fill in these fields:
   - **Connected App Name:** `TMF Slack Integration`
   - **API Name:** (auto-fills) `TMF_Slack_Integration`
   - **Contact Email:** Your email address

### Step 3: Configure OAuth Settings
1. Check ✅ **Enable OAuth Settings**
2. **Callback URL:** Enter exactly: `https://oauth.pstmn.io/v1/callback`
3. Under **Selected OAuth Scopes**, add these:
   - Full access (full)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
4. Leave **"Require Proof Key for Code Exchange (PKCE)"** UNCHECKED ❌
5. Click **Save**, then **Continue**

### Step 4: Get Your Credentials
1. On the app page, find **Consumer Key** and **Consumer Secret**
2. Click **Manage Consumer Details**
3. **Copy both values** to a notepad - you'll need them soon!

### Step 5: Configure Security Policies
1. Click **Manage** button at the top
2. Click **Edit Policies**
3. Change these settings:
   - **Permitted Users:** `All users may self-authorize`
   - **IP Relaxation:** `Relax IP restrictions`
4. Click **Save**

⏰ **IMPORTANT:** Wait 10 minutes before continuing! Salesforce needs time to apply these changes.

---

## Part 2: Postman Configuration

### Step 1: Install Postman
1. Go to https://www.postman.com/downloads/
2. Download and install Postman for your operating system
3. Create a free account when prompted

### Step 2: Create a New Request
1. Click **New** → **HTTP Request**
2. Name it `TMF API Test`

### Step 3: Configure Authorization
1. Click the **Authorization** tab
2. For **Type**, select `OAuth 2.0`
3. Scroll down to **Configure New Token**
4. Fill in these fields EXACTLY:

| Field | Value |
|-------|-------|
| **Grant Type** | Authorization Code |
| **Callback URL** | `https://oauth.pstmn.io/v1/callback` |
| **Authorize using browser** | ❌ UNCHECKED |
| **Auth URL** | `https://YOUR_DOMAIN.my.salesforce.com/services/oauth2/authorize` |
| **Access Token URL** | `https://YOUR_DOMAIN.my.salesforce.com/services/oauth2/token` |
| **Client ID** | (Paste your Consumer Key) |
| **Client Secret** | (Paste your Consumer Secret) |
| **Scope** | `full refresh_token offline_access` |
| **Client Authentication** | Send as Basic Auth header |

⚠️ **Replace YOUR_DOMAIN** with your actual Salesforce domain (e.g., `mycompany` if your URL is `mycompany.lightning.force.com`)

---

## Part 3: Getting Your Refresh Token

### Step 1: Get Access Token
1. In Postman, click the orange **Get New Access Token** button
2. Salesforce login page opens in your browser
3. Log in with your Salesforce credentials
4. Click **Allow** when asked to grant access
5. You'll be redirected back to Postman

### Step 2: Save Your Refresh Token
1. In Postman, you'll see your new token
2. Scroll down in the token details
3. Find **refresh_token** - it's a long string
4. **COPY THIS VALUE** - you need it for the Slack app!
5. Click **Use Token**

---

## Part 4: Slack App Setup

### Step 1: Create Slack App
1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Choose **From scratch**
4. App Name: `TMF Integration`
5. Pick your workspace
6. Click **Create App**

### Step 2: Configure Bot Token Scopes
1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Scopes** → **Bot Token Scopes**
3. Add these scopes:
   - `chat:write`
   - `commands`
   - `im:write`
   - `channels:read`
   - `groups:read`

### Step 3: Enable Socket Mode
1. In the left sidebar, click **Socket Mode**
2. Toggle **Enable Socket Mode** ON
3. Name your token: `TMF Socket Token`
4. Click **Generate**
5. **COPY** the app-level token (starts with `xapp-`)

### Step 4: Install App to Workspace
1. Go back to **OAuth & Permissions**
2. Click **Install to Workspace**
3. Click **Allow**
4. **COPY** the Bot User OAuth Token (starts with `xoxb-`)

### Step 5: Create Slash Commands
1. In the left sidebar, click **Slash Commands**
2. Create these commands one by one:

| Command | Description | 
|---------|-------------|
| `/create-customer` | Create a new customer in Salesforce |
| `/create-contract-document` | Create a contract document |
| `/attach-document` | Attach a document to a customer |
| `/find-products` | Search for products in Salesforce |
| `/demo-guide` | View demo instructions |
| `/check-setup` | Verify your configuration |

For each command:
- Click **Create New Command**
- Enter the command and description
- For **Request URL**, enter: `http://localhost:3000/slack/events`
- Click **Save**

### Step 6: Get Signing Secret
1. Go to **Basic Information**
2. Under **App Credentials**, find **Signing Secret**
3. Click **Show** and **COPY** this value

---

## Part 5: Code Setup

### Step 1: Download the Code
1. Go to the GitHub repository: `[YOUR-GITHUB-URL]`
2. Click the green **Code** button
3. Click **Download ZIP**
4. Extract the ZIP file to your Desktop

### Step 2: Install Node.js
1. Go to https://nodejs.org/
2. Download the **LTS** version
3. Run the installer - accept all defaults

### Step 3: Open Terminal/Command Prompt
- **Mac:** Press `Cmd + Space`, type `Terminal`, press Enter
- **Windows:** Press `Windows + R`, type `cmd`, press Enter

### Step 4: Navigate to Project
```bash
cd Desktop/tmf-slack-integration
```

### Step 5: Install Dependencies
```bash
npm install
```

### Step 6: Create Environment File
1. In the project folder, find `.env.example`
2. Make a copy and rename it to `.env`
3. Open `.env` in a text editor
4. Fill in your values:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-YOUR-BOT-TOKEN
SLACK_SIGNING_SECRET=YOUR-SIGNING-SECRET
SLACK_APP_TOKEN=xapp-YOUR-APP-TOKEN
SLACK_SOCKET_MODE=true

# Salesforce Configuration
SALESFORCE_INSTANCE_URL=https://YOUR_DOMAIN.my.salesforce.com
SALESFORCE_CLIENT_ID=YOUR-CONSUMER-KEY
SALESFORCE_CLIENT_SECRET=YOUR-CONSUMER-SECRET
SALESFORCE_REFRESH_TOKEN=YOUR-REFRESH-TOKEN-FROM-POSTMAN

# TMF Configuration
TMF_DOMAIN=YOUR_DOMAIN

# Optional Slack Channels
SLACK_ONBOARDING_CHANNEL=#customer-onboarding
SLACK_AGREEMENTS_CHANNEL=#contracts
SLACK_DOCUMENTS_CHANNEL=#documents
```

---

## Part 6: Testing

### Step 1: Start the App
In Terminal/Command Prompt:
```bash
npm start
```

You should see:
```
⚡️ TMF Slack Integration is running!
```

### Step 2: Test in Slack
1. Open Slack
2. Type `/check-setup`
3. You should see a status report

### Step 3: Run Demo Commands
Try these in order:
1. `/demo-guide` - See the full demo script
2. `/create-customer` - Create a test customer
3. `/create-contract-document` - Create a contract
4. `/attach-document` - Attach a document

---

## 🔧 Troubleshooting

### Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "Invalid Session ID" | Your token expired. Run `/check-setup` to verify |
| "Not Found" error | TMF APIs not enabled. Contact Salesforce admin |
| Commands not showing in Slack | Wait 1-2 minutes, then refresh Slack |
| "Cannot find module" error | Run `npm install` again |
| App crashes on start | Check your `.env` file for typos |

### Getting Help
1. Run `/check-setup` first - it diagnoses most issues
2. Check the terminal for error messages
3. Verify all tokens are copied correctly (no spaces)
4. Make sure Salesforce domain is correct

---

## 🚀 Next Steps

### Adding More APIs
The code is designed to grow with you. When you get additional TMF licenses:
1. Open `app.js`
2. Find the section "COMMANDS REQUIRING ADDITIONAL LICENSES"
3. Uncomment the relevant commands
4. Restart the app

### Customizing for Your Org
- Change company names in the examples
- Modify the demo flow in `/demo-guide`
- Add your own Slack channels to `.env`
- Customize the success messages

### Sharing with Your Team
1. Upload code to your company GitHub
2. Have team members follow this guide
3. Each person needs their own Slack app (for testing)
4. Share the same Salesforce connected app

---

## 📸 Demo Best Practices

### Before Your Demo
1. Create a test Account in Salesforce (e.g., "Demo Company Inc")
2. Get the Account ID ready
3. Test all commands work
4. Have backup data ready from `/demo-guide`

### During Your Demo
1. Start with `/check-setup` to show it's live
2. Use realistic company names
3. Show the Salesforce records after each step
4. Keep the pace quick - under 10 minutes total

### After Your Demo
1. Show how to extend with more APIs
2. Discuss their specific use cases
3. Offer to help with setup

---

## 🎉 Congratulations!
You've successfully set up the TMF Slack integration. Your teams can now manage customer onboarding entirely through Slack, with all data flowing seamlessly to Salesforce.

**Remember:** This is just the beginning. As you add more TMF APIs, the integration becomes even more powerful. Start with what you have, and grow from there!