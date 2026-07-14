# M-PESA Daraja Production Deployment Checklist

This checklist ensures your M-PESA integration is production-ready and secure.

## Pre-Deployment (Week 1)

### 1. Safaricom Account Setup
- [ ] Create production M-PESA account (PayBill/Till/Buy Goods)
- [ ] Register at https://developer.safaricom.co.ke
- [ ] Create production app on Daraja Portal
- [ ] Save Consumer Key and Consumer Secret
- [ ] Download production public key certificate
- [ ] Get production Initiator credentials (for B2C, B2B)
- [ ] Contact M-PESA business team: m-pesabusiness@safaricom.co.ke

### 2. Security Setup
- [ ] Generate strong initiator password (min 12 chars, mixed case, numbers, symbols)
- [ ] Store all credentials in secure environment (Vercel Secrets, AWS Secrets Manager, etc.)
- [ ] Never commit credentials to git
- [ ] Enable 2FA on Daraja account
- [ ] Set up API rate limiting
- [ ] Enable request signing/validation

### 3. SSL/TLS Certificate
- [ ] Obtain valid SSL certificate for your domain
- [ ] Ensure HTTPS is enabled
- [ ] Set HSTS headers
- [ ] Verify certificate expiration date
- [ ] Set up auto-renewal (Let's Encrypt recommended)

### 4. Network & Firewall
- [ ] Whitelist Safaricom IP addresses:
  ```
  196.201.214.200, 196.201.214.206, 196.201.213.114, 196.201.214.207,
  196.201.214.208, 196.201.213.44, 196.201.212.127, 196.201.212.138,
  196.201.212.129, 196.201.212.136, 196.201.212.74, 196.201.212.69
  ```
- [ ] Test that callbacks can reach your servers
- [ ] Use ngrok/tunnel for testing before production
- [ ] Verify all callback URLs are accessible

### 5. Database Setup
- [ ] Create payments table with proper schema
- [ ] Create indexes on: checkout_request_id, merchant_request_id, created_at
- [ ] Create C2B transactions table
- [ ] Create B2C payments table
- [ ] Set up database backups
- [ ] Enable transaction logging
- [ ] Set up database monitoring

## Deployment Week (Week 2)

### 6. Environment Variables - Vercel

In Vercel Project Settings > Environment Variables:

```
DARAJA_CONSUMER_KEY=prod_key_xxx
DARAJA_CONSUMER_SECRET=prod_secret_xxx
DARAJA_BUSINESS_SHORT_CODE=600123
DARAJA_PASSKEY=prod_passkey_xxx
DARAJA_INITIATOR_NAME=api_operator
DARAJA_INITIATOR_PASSWORD=prod_initiator_password_xxx
DARAJA_BASE_URL=https://api.safaricom.co.ke
DARAJA_OAUTH_URL=https://api.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query
MPESA_PUBLIC_KEY_PRODUCTION=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

- [ ] All URLs point to production (`api.safaricom.co.ke`, NOT sandbox)
- [ ] Credentials are correct for production
- [ ] Certificate is production certificate

### 7. Code Deployment
- [ ] Merge all Daraja code to main branch
- [ ] Run full test suite
- [ ] Run linting and type checking
- [ ] Deploy to production
- [ ] Verify deployment succeeded
- [ ] Check server logs for errors

### 8. Endpoint Registration - Daraja Portal

In Daraja Portal > My Apps > Your Production App:

Register all callback URLs:
- [ ] STK Push Callback: `https://yourdomain.com/api/payments/daraja/callback`
- [ ] C2B Validation: `https://yourdomain.com/api/payments/daraja/c2b/validate`
- [ ] C2B Confirmation: `https://yourdomain.com/api/payments/daraja/c2b/confirm`
- [ ] B2C Result: `https://yourdomain.com/api/payments/daraja/callback`
- [ ] B2B Result: `https://yourdomain.com/api/payments/daraja/callback`
- [ ] Account Balance Result: `https://yourdomain.com/api/payments/daraja/callback`
- [ ] Transaction Reversal Result: `https://yourdomain.com/api/payments/daraja/callback`

### 9. Testing with Real Transactions
- [ ] Test STK Push with real M-PESA payment
- [ ] Test C2B with customer payment
- [ ] Test B2C with freelancer payout
- [ ] Test B2B with business transfer
- [ ] Verify callbacks are received
- [ ] Check database records are created
- [ ] Verify user notifications work

### 10. Monitoring & Logging
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Enable request logging
- [ ] Set up alerts for payment failures
- [ ] Monitor API rate limits
- [ ] Set up uptime monitoring
- [ ] Create dashboard for payment metrics

## Post-Deployment (Week 3+)

### 11. Production Hardening
- [ ] Enable rate limiting on payment APIs
- [ ] Add DDoS protection
- [ ] Implement request signing/validation
- [ ] Set up VPN for sensitive operations
- [ ] Enable audit logging
- [ ] Regular security audits

### 12. Monitoring & Support
- [ ] Monitor payment success rate
- [ ] Track average response time
- [ ] Monitor for error spikes
- [ ] Set up on-call support schedule
- [ ] Create runbooks for common issues
- [ ] Document troubleshooting steps

### 13. Business Continuity
- [ ] Set up payment reconciliation process
- [ ] Create backup payment method
- [ ] Document disaster recovery procedure
- [ ] Test recovery procedures
- [ ] Keep emergency contact list
- [ ] Regular backups of payment data

### 14. Compliance & Documentation
- [ ] Document all payment flows
- [ ] Create API documentation for team
- [ ] Set up compliance audit trail
- [ ] Document security controls
- [ ] Create incident response plan
- [ ] Review terms with Safaricom

---

## Critical Issues Checklist

During production, watch for:

### OAuth Issues
- [ ] Check if token generation is failing
- [ ] Verify Consumer Key/Secret in Daraja Portal
- [ ] Check token expiration handling
- [ ] Monitor token caching

### Payment Failures
- [ ] Monitor payment success rate
- [ ] Check error messages and codes
- [ ] Verify phone number formatting
- [ ] Check account balance (for B2C/B2B)
- [ ] Verify callback URLs registered

### Callback Issues
- [ ] Verify Safaricom IPs are whitelisted
- [ ] Check if endpoints return 200 OK
- [ ] Monitor callback timeout errors
- [ ] Check for duplicate callbacks
- [ ] Verify callback URL is publicly accessible

### Security Issues
- [ ] Monitor for suspicious activity
- [ ] Check for credential exposure
- [ ] Review access logs
- [ ] Verify TLS certificate is valid
- [ ] Monitor for brute force attempts

---

## Rollback Plan

If critical issues occur:

1. **Stop new transactions**: Set payment API to maintenance mode
2. **Investigate**: Check logs and error tracking
3. **Fix**: Deploy fix to staging, test
4. **Deploy**: Carefully roll out fix
5. **Monitor**: Watch for issues
6. **Communicate**: Notify users if affected
7. **Post-mortem**: Document issue and prevention

---

## Support Contacts

- **Safaricom Support**: apisupport@safaricom.co.ke
- **M-PESA Business**: m-pesabusiness@safaricom.co.ke
- **Daraja Portal**: https://developer.safaricom.co.ke
- **Your Team**: [Your support email/phone]

---

## Success Metrics

Track these metrics post-deployment:

- **Payment Success Rate**: Should be >99%
- **Average Response Time**: <2 seconds
- **Callback Delivery**: >99.5%
- **Error Rate**: <0.1%
- **Uptime**: 99.9%

---

## Sign-Off

- [ ] Technical Lead: _________________ Date: _______
- [ ] Security Officer: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] Finance/Legal: _________________ Date: _______
