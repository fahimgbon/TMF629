require('dotenv').config();
const { App } = require('@slack/bolt');
const axios = require('axios');

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// --- CORRECTED CODE: Function to programmatically refresh the Salesforce token ---
async function getSalesforceAccessToken() {
  const tokenUrl = `${process.env.SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', process.env.SALESFORCE_CLIENT_ID);
  params.append('client_secret', process.env.SALESFORCE_CLIENT_SECRET);
  params.append('refresh_token', process.env.SALESFORCE_REFRESH_TOKEN);

  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh Salesforce token:', error.response?.data || error.message);
    throw new Error('Could not refresh Salesforce access token.');
  }
}


// --- CORRECTED CODE: API function now uses the refreshed token ---
async function createCustomerInSalesforce(customerData) {
  // Get a fresh token before every API call
  const accessToken = await getSalesforceAccessToken();
  const url = `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v64.0/connect/comms/customermanagement/v4/customer`;
  
  try {
    const response = await axios.post(url, customerData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '4.0.1',
        'Domain-Name': process.env.TMF_DOMAIN
      }
    });
    return response.data;
  } catch (error) {
    console.error('Salesforce API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Modal command
app.command('/create-customer', async ({ command, ack, client }) => {
  await ack();
  
  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'create_customer_modal',
        title: {
          type: 'plain_text',
          text: 'Create Customer'
        },
        submit: {
          type: 'plain_text',
          text: 'Create'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Create a new customer in Salesforce TMF 629*'
            }
          },
          {
            type: 'input',
            block_id: 'customer_name',
            element: {
              type: 'plain_text_input',
              action_id: 'name_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Kevin Harper'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Customer Name *'
            }
          },
          {
            type: 'input',
            block_id: 'account_id',
            element: {
              type: 'plain_text_input',
              action_id: 'account_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., 001Ws000045bWIbIAM'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Account ID *'
            }
          },
          // --- CORRECTED CODE: Added Account Name input field ---
          {
            type: 'input',
            block_id: 'account_name',
            element: {
              type: 'plain_text_input',
              action_id: 'account_name_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., TMF-Account_OPTUS11_99668'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Account Name *'
            }
          },
          {
            type: 'input',
            block_id: 'engaged_party',
            element: {
              type: 'plain_text_input',
              action_id: 'engaged_party_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Sean Forbes'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Engaged Party'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'email',
            element: {
              type: 'email_text_input',
              action_id: 'email_input',
              placeholder: {
                type: 'plain_text',
                text: 'email@example.com'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Email'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'phone',
            element: {
              type: 'plain_text_input',
              action_id: 'phone_input',
              placeholder: {
                type: 'plain_text',
                text: '(555) 555-1234'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Phone'
            },
            optional: true
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening modal:', error);
  }
});

// Handle form submission
app.view('create_customer_modal', async ({ ack, body, view, client }) => {
  const values = view.state.values;
  
  // --- CORRECTED CODE: Added validation for Account Name ---
  const errors = {};
  if (!values.customer_name?.name_input?.value) {
    errors.customer_name = 'Name is required';
  }
  if (!values.account_id?.account_input?.value) {
    errors.account_id = 'Account ID is required';
  }
  if (!values.account_name?.account_name_input?.value) {
    errors.account_name = 'Account Name is required';
  }
  
  if (Object.keys(errors).length > 0) {
    await ack({ response_action: 'errors', errors });
    return;
  }
  
  await ack();
  
  try {
    // --- CORRECTED CODE: Build customer data with Account Name ---
    const customerData = {
      name: values.customer_name.name_input.value,
      account: [{
        id: values.account_id.account_input.value,
        name: values.account_name.account_name_input.value
      }],
      contactMedium: []
    };
    
    if (values.engaged_party?.engaged_party_input?.value) {
      customerData.engagedParty = {
        name: values.engaged_party.engaged_party_input.value
      };
    }
    
    if (values.email?.email_input?.value) {
      customerData.contactMedium.push({
        mediumType: 'Email',
        characteristic: {
          contactType: 'Email',
          emailAddress: values.email.email_input.value
        }
      });
    }
    
    if (values.phone?.phone_input?.value) {
      customerData.contactMedium.push({
        mediumType: 'Phone',
        characteristic: {
          contactType: 'Phone',
          phoneNumber: values.phone.phone_input.value
        }
      });
    }
    
    // Create in Salesforce
    const result = await createCustomerInSalesforce(customerData);
    
    // Success message
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ Customer created successfully!\n\nName: ${result.name}\nID: ${result.id}`
    });
    
  } catch (error) {
    const errorMessage = error.response?.data?.[0]?.message || error.message;
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error: ${errorMessage}`
    });
  }
});

// Start app
(async () => {
  await app.start();
  console.log('⚡️ TMF Slack app is running!');
  console.log('Try /create-customer in Slack');
})();