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

// ============================================
// SHARED UTILITIES & SALESFORCE CONNECTION
// ============================================

// Function to refresh Salesforce access token
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

// Global storage for demo continuity (in production, use a database)
global.demoData = {
  lastCustomer: null,
  lastDocument: null,
  lastAgreement: null,
  availableProducts: []
};

// ============================================
// CORE COMMANDS - WORK WITHOUT ADDITIONAL LICENSES
// ============================================

// -------------------------------
// TMF629: Customer Management API
// Status: ✅ WORKING
// Requirements: CommsCloud license only
// -------------------------------

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
                text: 'e.g., Sarah Johnson'
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
            },
            hint: {
              type: 'plain_text',
              text: 'The existing business account ID in Salesforce'
            }
          },
          {
            type: 'input',
            block_id: 'account_name',
            element: {
              type: 'plain_text_input',
              action_id: 'account_name_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Acme Corporation'
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
                text: 'e.g., John Smith (Sales Rep)'
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
                text: 'customer@example.com'
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
                text: '(555) 123-4567'
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

app.view('create_customer_modal', async ({ ack, body, view, client }) => {
  const values = view.state.values;
  
  // Validation
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
    
    // Store for demo continuity
    global.demoData.lastCustomer = {
      id: result.id,
      name: result.name,
      accountId: values.account_id.account_input.value,
      accountName: values.account_name.account_name_input.value
    };
    
    // Success message
    const sfUrl = `${process.env.SALESFORCE_INSTANCE_URL.replace('.my.salesforce.com', '.lightning.force.com')}/lightning/r/Account/${values.account_id.account_input.value}/view`;
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ Customer created successfully!\n\n*Name:* ${result.name}\n*Customer ID:* ${result.id}\n*Account:* ${values.account_name.account_name_input.value}\n\n*View in Salesforce:* ${sfUrl}`
    });
    
    // Post to channel if configured
    if (process.env.SLACK_ONBOARDING_CHANNEL) {
      await client.chat.postMessage({
        channel: process.env.SLACK_ONBOARDING_CHANNEL,
        text: `🎉 New customer onboarded: *${result.name}* from ${values.account_name.account_name_input.value}`
      });
    }
    
  } catch (error) {
    const errorMessage = error.response?.data?.[0]?.message || error.message;
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error: ${errorMessage}`
    });
  }
});

async function createCustomerInSalesforce(customerData) {
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
    console.error('TMF629 API Error:', error.response?.data || error.message);
    throw error;
  }
}

// -------------------------------
// TMF667: Document Management API
// Status: ✅ WORKING
// Requirements: CommsCloud license only
// -------------------------------

app.command('/attach-document', async ({ command, ack, client }) => {
  await ack();
  
  try {
    // Build dynamic options based on last created customer
    let linkToHint = 'Enter the Account ID to link this document to a customer';
    if (global.demoData.lastCustomer) {
      linkToHint = `Last customer: ${global.demoData.lastCustomer.name} (${global.demoData.lastCustomer.accountId})`;
    }
    
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'attach_document_modal',
        title: {
          type: 'plain_text',
          text: 'Attach Document'
        },
        submit: {
          type: 'plain_text',
          text: 'Create Document'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Create and attach a document using TMF667*'
            }
          },
          {
            type: 'input',
            block_id: 'document_name',
            element: {
              type: 'plain_text_input',
              action_id: 'name_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Service Contract - Sarah Johnson - 2024'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Document Name *'
            }
          },
          {
            type: 'input',
            block_id: 'document_url',
            element: {
              type: 'url_text_input',
              action_id: 'url_input',
              placeholder: {
                type: 'plain_text',
                text: 'https://your-storage.com/contracts/contract-2024.pdf'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Document URL *'
            },
            hint: {
              type: 'plain_text',
              text: 'External URL where the document is stored'
            }
          },
          {
            type: 'input',
            block_id: 'document_description',
            element: {
              type: 'plain_text_input',
              action_id: 'description_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Brief description of the document...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'link_to_customer',
            element: {
              type: 'plain_text_input',
              action_id: 'customer_id_input',
              initial_value: global.demoData.lastCustomer?.accountId || '',
              placeholder: {
                type: 'plain_text',
                text: 'Account ID'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Link to Customer (Account ID)'
            },
            optional: true,
            hint: {
              type: 'plain_text',
              text: linkToHint
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

app.view('attach_document_modal', async ({ ack, body, view, client }) => {
  const values = view.state.values;
  await ack();
  
  try {
    const documentData = {
      name: values.document_name.name_input.value,
      attachment: [{
        url: values.document_url.url_input.value
      }]
    };
    
    if (values.document_description?.description_input?.value) {
      documentData.description = values.document_description.description_input.value;
    }
    
    // Link to customer if ID provided
    const customerId = values.link_to_customer?.customer_id_input?.value;
    if (customerId) {
      documentData.relatedObject = [{
        id: customerId,
        '@type': 'Account',
        name: global.demoData.lastCustomer?.accountName || 'Customer Account'
      }];
    }
    
    const result = await createDocumentInSalesforce(documentData);
    
    // Store for reference
    global.demoData.lastDocument = {
      id: result.id,
      contentDocumentId: result.contentDocumentId,
      name: result.name
    };
    
    // Build response
    const sfBaseUrl = process.env.SALESFORCE_INSTANCE_URL.replace('.my.salesforce.com', '.lightning.force.com');
    const docUrl = `${sfBaseUrl}/lightning/r/ContentDocument/${result.contentDocumentId}/view`;
    
    let message = `✅ Document created!\n\n`;
    message += `*Name:* ${result.name}\n`;
    message += `*Status:* ${result.status}\n`;
    message += `*View Document:* ${docUrl}\n`;
    
    if (customerId) {
      const customerUrl = `${sfBaseUrl}/lightning/r/Account/${customerId}/view`;
      message += `\n*Linked to Customer:* ${customerUrl}\n`;
      message += `_Check the Files related list on the Account to see this document_`;
    }
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: message
    });
    
    // Notify channel
    if (process.env.SLACK_DOCUMENTS_CHANNEL) {
      await client.chat.postMessage({
        channel: process.env.SLACK_DOCUMENTS_CHANNEL,
        text: `📎 New document uploaded: *${result.name}*${customerId ? ' (linked to customer)' : ''}`
      });
    }
    
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error: ${errorMessage}`
    });
  }
});

async function createDocumentInSalesforce(documentData) {
  const accessToken = await getSalesforceAccessToken();
  const url = `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v64.0/connect/comms/document/v4/document`;
  
  try {
    const response = await axios.post(url, documentData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '4.0.0',
        'Domain-Name': process.env.TMF_DOMAIN
      }
    });
    return response.data;
  } catch (error) {
    console.error('TMF667 API Error:', error.response?.data || error.message);
    throw error;
  }
}

// -------------------------------
// Contract Document Creation (Workaround for missing TMF651)
// Status: ✅ WORKING
// This simulates agreements using TMF667 documents
// -------------------------------

app.command('/create-contract-document', async ({ command, ack, client }) => {
  await ack();
  
  try {
    let defaultCustomerId = '';
    let defaultCustomerName = '';
    
    if (global.demoData.lastCustomer) {
      defaultCustomerId = global.demoData.lastCustomer.accountId;
      defaultCustomerName = global.demoData.lastCustomer.name;
    }
    
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'create_contract_doc_modal',
        title: {
          type: 'plain_text',
          text: 'Create Contract'
        },
        submit: {
          type: 'plain_text',
          text: 'Create'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Create Contract Document*\n_Simulates an agreement using TMF667_'
            }
          },
          {
            type: 'input',
            block_id: 'contract_type',
            element: {
              type: 'static_select',
              action_id: 'type_select',
              options: [
                { text: { type: 'plain_text', text: 'Service Agreement' }, value: 'service_agreement' },
                { text: { type: 'plain_text', text: 'Product Warranty' }, value: 'warranty' },
                { text: { type: 'plain_text', text: 'Terms of Service' }, value: 'tos' },
                { text: { type: 'plain_text', text: 'SLA Agreement' }, value: 'sla' }
              ]
            },
            label: {
              type: 'plain_text',
              text: 'Contract Type *'
            }
          },
          {
            type: 'input',
            block_id: 'customer_id',
            element: {
              type: 'plain_text_input',
              action_id: 'customer_input',
              initial_value: defaultCustomerId,
              placeholder: {
                type: 'plain_text',
                text: 'Customer Account ID'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Customer ID *'
            }
          },
          {
            type: 'input',
            block_id: 'customer_name',
            element: {
              type: 'plain_text_input',
              action_id: 'name_input',
              initial_value: defaultCustomerName,
              placeholder: {
                type: 'plain_text',
                text: 'Customer name'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Customer Name *'
            }
          },
          {
            type: 'input',
            block_id: 'contract_url',
            element: {
              type: 'url_text_input',
              action_id: 'url_input',
              placeholder: {
                type: 'plain_text',
                text: 'https://your-docs.com/contracts/agreement.pdf'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Contract Document URL *'
            }
          },
          {
            type: 'input',
            block_id: 'contract_term',
            element: {
              type: 'static_select',
              action_id: 'term_select',
              options: [
                { text: { type: 'plain_text', text: '12 months' }, value: '12' },
                { text: { type: 'plain_text', text: '24 months' }, value: '24' },
                { text: { type: 'plain_text', text: '36 months' }, value: '36' }
              ]
            },
            label: {
              type: 'plain_text',
              text: 'Contract Term *'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

app.view('create_contract_doc_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  const values = view.state.values;
  
  try {
    const contractType = values.contract_type.type_select.selected_option.text.text;
    const term = values.contract_term.term_select.selected_option.text.text;
    
    // Create contract as a document
    const documentData = {
      name: `${contractType} - ${values.customer_name.name_input.value} - ${term}`,
      description: `${contractType} for customer ${values.customer_name.name_input.value}. Term: ${term}. Created via TMF integration.`,
      attachment: [{
        url: values.contract_url.url_input.value
      }],
      relatedObject: [{
        id: values.customer_id.customer_input.value,
        '@type': 'Account',
        name: values.customer_name.name_input.value
      }]
    };
    
    const result = await createDocumentInSalesforce(documentData);
    
    const sfUrl = `${process.env.SALESFORCE_INSTANCE_URL.replace('.my.salesforce.com', '.lightning.force.com')}/lightning/r/ContentDocument/${result.contentDocumentId}/view`;
    const customerUrl = `${process.env.SALESFORCE_INSTANCE_URL.replace('.my.salesforce.com', '.lightning.force.com')}/lightning/r/Account/${values.customer_id.customer_input.value}/view`;
    
    let message = `✅ Contract created!\n\n`;
    message += `*Type:* ${contractType}\n`;
    message += `*Customer:* ${values.customer_name.name_input.value}\n`;
    message += `*Term:* ${term}\n\n`;
    message += `*View Contract:* ${sfUrl}\n`;
    message += `*View Customer:* ${customerUrl}`;
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: message
    });
    
    // Notify channel
    if (process.env.SLACK_AGREEMENTS_CHANNEL) {
      await client.chat.postMessage({
        channel: process.env.SLACK_AGREEMENTS_CHANNEL,
        text: `📄 New ${contractType} created for ${values.customer_name.name_input.value} (${term})`
      });
    }
    
  } catch (error) {
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error: ${error.message}`
    });
  }
});

// ============================================
// HELPER COMMANDS
// ============================================

// Extensible product finder
app.command('/find-products', async ({ command, ack, client }) => {
  await ack();
  
  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'find_products_modal',
        title: {
          type: 'plain_text',
          text: 'Find Products'
        },
        submit: {
          type: 'plain_text',
          text: 'Search'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Search for products in your Salesforce org*'
            }
          },
          {
            type: 'input',
            block_id: 'search_term',
            element: {
              type: 'plain_text_input',
              action_id: 'search_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Internet, Phone, Bundle'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Search Term (optional)'
            },
            optional: true,
            hint: {
              type: 'plain_text',
              text: 'Leave empty to see all active products'
            }
          },
          {
            type: 'input',
            block_id: 'result_limit',
            element: {
              type: 'static_select',
              action_id: 'limit_select',
              options: [
                { text: { type: 'plain_text', text: '5 results' }, value: '5' },
                { text: { type: 'plain_text', text: '10 results' }, value: '10' },
                { text: { type: 'plain_text', text: '20 results' }, value: '20' },
                { text: { type: 'plain_text', text: '50 results' }, value: '50' }
              ],
              initial_option: { text: { type: 'plain_text', text: '10 results' }, value: '10' }
            },
            label: {
              type: 'plain_text',
              text: 'Maximum Results'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

app.view('find_products_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  const values = view.state.values;
  const searchTerm = values.search_term?.search_input?.value || '';
  const limit = values.result_limit.limit_select.selected_option.value;
  
  try {
    const accessToken = await getSalesforceAccessToken();
    
    // Build dynamic query
    let query = 'SELECT+Id,Name,ProductCode,Description,IsActive+FROM+Product2+WHERE+IsActive=true';
    if (searchTerm) {
      query += `+AND+(Name+LIKE+'%25${encodeURIComponent(searchTerm)}%25'+OR+ProductCode+LIKE+'%25${encodeURIComponent(searchTerm)}%25')`;
    }
    query += `+ORDER+BY+Name+LIMIT+${limit}`;
    
    const url = `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v64.0/query?q=${query}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.records && response.data.records.length > 0) {
      // Store products for reference
      global.demoData.availableProducts = response.data.records;
      
      let message = `*Found ${response.data.records.length} products:*\n\n`;
      response.data.records.forEach((product, index) => {
        message += `${index + 1}. *${product.Name}*\n`;
        message += `   ID: \`${product.Id}\`\n`;
        message += `   Code: ${product.ProductCode || 'N/A'}\n`;
        if (product.Description) {
          message += `   Description: ${product.Description.substring(0, 100)}...\n`;
        }
        message += '\n';
      });
      
      message += '_💡 Tip: Copy any Product ID above to use when creating agreements_';
      
      await client.chat.postMessage({
        channel: body.user.id,
        text: message
      });
    } else {
      await client.chat.postMessage({
        channel: body.user.id,
        text: `No products found${searchTerm ? ` matching "${searchTerm}"` : ''}.\n\nTry:\n• Searching with a different term\n• Checking if products exist in Setup > Products\n• Creating test products in Salesforce first`
      });
    }
  } catch (error) {
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error searching products: ${error.message}\n\nMake sure your user has access to the Product2 object.`
    });
  }
});

// Demo flow guide
app.command('/demo-guide', async ({ command, ack, say }) => {
  await ack();
  
  const guide = `*🎯 TMF API Demo Guide*

*Available Commands:*
✅ \`/create-customer\` - Create a new customer (TMF629)
✅ \`/create-contract-document\` - Create a contract/agreement as document
✅ \`/attach-document\` - Attach any document to a customer
✅ \`/find-products\` - Search for products in your org
✅ \`/check-setup\` - Verify your TMF API configuration

*Suggested Demo Flow:*

*1️⃣ Customer Onboarding (2-3 min)*
• Run \`/create-customer\`
• Fill in: Sarah Johnson, Acme Corp
• Show the Salesforce link

*2️⃣ Contract Creation (2-3 min)*
• Run \`/create-contract-document\`
• It auto-fills with Sarah's info
• Select "Service Agreement" + 24 months
• Show how it links to the customer

*3️⃣ Document Management (2-3 min)*
• Run \`/attach-document\`
• Name: "Technical Specifications"
• Show it appears in customer's Files

*Key Points to Emphasize:*
• No context switching - all in Slack
• Automatic linking between records
• Full audit trail in Salesforce
• Cross-team collaboration via channels

*Demo Data:*
${global.demoData.lastCustomer ? `Last Customer: ${global.demoData.lastCustomer.name} (${global.demoData.lastCustomer.accountId})` : 'No customer created yet'}
${global.demoData.lastDocument ? `Last Document: ${global.demoData.lastDocument.name}` : 'No document created yet'}`;

  await say(guide);
});

// Check setup
app.command('/check-setup', async ({ command, ack, say }) => {
  await ack();
  
  try {
    const accessToken = await getSalesforceAccessToken();
    let report = '*🔍 TMF API Setup Check*\n\n';
    
    // Check core objects
    const checks = [
      { name: 'Account (TMF629 Customers)', object: 'Account', required: true },
      { name: 'ContentDocument (TMF667 Documents)', object: 'ContentDocument', required: true },
      { name: 'Product2 (Products)', object: 'Product2', required: false },
      { name: 'Contract (TMF651 Agreements)', object: 'Contract', required: false }
    ];
    
    for (const check of checks) {
      try {
        const url = `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v64.0/sobjects/${check.object}/describe`;
        await axios.get(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        report += `✅ ${check.name} - Available\n`;
      } catch (error) {
        report += `${check.required ? '❌' : '⚠️'} ${check.name} - Not found${check.required ? ' (REQUIRED)' : ' (optional)'}\n`;
      }
    }
    
    report += '\n*Environment Variables:*\n';
    report += `${process.env.SALESFORCE_INSTANCE_URL ? '✅' : '❌'} SALESFORCE_INSTANCE_URL\n`;
    report += `${process.env.SALESFORCE_CLIENT_ID ? '✅' : '❌'} SALESFORCE_CLIENT_ID\n`;
    report += `${process.env.SALESFORCE_CLIENT_SECRET ? '✅' : '❌'} SALESFORCE_CLIENT_SECRET\n`;
    report += `${process.env.SALESFORCE_REFRESH_TOKEN ? '✅' : '❌'} SALESFORCE_REFRESH_TOKEN\n`;
    report += `${process.env.TMF_DOMAIN ? '✅' : '❌'} TMF_DOMAIN\n`;
    
    report += '\n*Working Commands:*\n';
    report += '• /create-customer ✅\n';
    report += '• /create-contract-document ✅\n';
    report += '• /attach-document ✅\n';
    report += '• /find-products ✅\n';
    
    await say(report);
  } catch (error) {
    await say(`❌ Setup check failed: ${error.message}`);
  }
});

// ============================================
// COMMANDS REQUIRING ADDITIONAL LICENSES
// Uncomment and configure when licenses are available
// ============================================

// -------------------------------
// TMF651: Agreement Management API
// Status: ❌ REQUIRES CONTRACT MANAGEMENT LICENSE
// Uncomment below when Contract object is available
// -------------------------------

/*
app.command('/create-agreement', async ({ command, ack, client }) => {
  // Implementation for actual TMF651 agreements
  // Requires Contract Management license
  await ack();
  await client.chat.postMessage({
    channel: command.user_id,
    text: '❌ This command requires Contract Management licenses. Use /create-contract-document instead.'
  });
});
*/

// -------------------------------
// TMF620: Product Catalog Management API
// Status: ❌ REQUIRES MANAGED PACKAGE
// Placeholder for future implementation
// -------------------------------

/*
app.command('/browse-catalog', async ({ command, ack, client }) => {
  // Implementation for TMF620 product catalog
  // Requires managed package installation
  await ack();
  await client.chat.postMessage({
    channel: command.user_id,
    text: '❌ This command requires TMF620 managed package. Use /find-products to search existing products.'
  });
});
*/

// -------------------------------
// TMF622: Product Ordering Management API
// Status: ❌ REQUIRES MANAGED PACKAGE + LICENSES
// Placeholder for future implementation
// -------------------------------

/*
app.command('/create-order', async ({ command, ack, client }) => {
  // Implementation for TMF622 ordering
  // Requires multiple licenses and managed package
  await ack();
  await client.chat.postMessage({
    channel: command.user_id,
    text: '❌ This command requires TMF622 managed package and additional licenses.'
  });
});
*/

// ============================================
// APP STARTUP
// ============================================

(async () => {
  await app.start();
  console.log('⚡️ TMF Slack Integration is running!');
  console.log('\n📋 Available Commands:');
  console.log('  ✅ /create-customer - Create a new customer');
  console.log('  ✅ /create-contract-document - Create a contract');
  console.log('  ✅ /attach-document - Attach documents');
  console.log('  ✅ /find-products - Search for products');
  console.log('  ✅ /demo-guide - View demo instructions');
  console.log('  ✅ /check-setup - Verify configuration');
  console.log('\n💡 Run /demo-guide in Slack for the full demo script');
})();