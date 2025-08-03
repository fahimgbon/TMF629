# TMF Slack Integration

Integrate Salesforce Communications Cloud TMF APIs with Slack for seamless customer onboarding.

## Features
- ✅ Customer creation (TMF629)
- ✅ Document management (TMF667)
- ✅ Contract simulation
- ✅ Product search
- 🔄 Agreement management (TMF651) - requires additional licenses
- 🔄 Product catalog (TMF620) - requires managed package
- 🔄 Order management (TMF622) - requires managed package

## Quick Start
1. Clone this repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Run `npm start`
5. Test with `/check-setup` in Slack

## Documentation
- [Complete Setup Guide](docs/setup-guide.md)
- [Demo Storyboard](docs/demo-storyboard.html)
- [API Reference](docs/api-reference.md)

## Commands
| Command | Description | Status |
|---------|-------------|---------|
| `/create-customer` | Create new customer | ✅ Working |
| `/create-contract-document` | Create contract | ✅ Working |
| `/attach-document` | Attach documents | ✅ Working |
| `/find-products` | Search products | ✅ Working |
| `/demo-guide` | Show demo script | ✅ Working |
| `/check-setup` | Verify setup | ✅ Working |

## Support
For issues or questions, please check:
1. Run `/check-setup` for diagnostics
2. Review the [troubleshooting guide](docs/setup-guide.md#troubleshooting)
3. Check Salesforce API limits