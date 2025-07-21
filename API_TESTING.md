# Stock Monitoring CloudFlare Worker - API Testing Commands

## Environment Variables
```bash
export BASE_URL="https://your-worker-name.your-account.workers.dev"
export LOCAL_URL="http://localhost:8787"
export APP_PASSWORD="YOUR_APP_PASSWORD_HERE"
```

## OAuth Endpoints

### 1. OAuth Initiate
```bash
curl -X GET "${BASE_URL}/oauth/initiate" \
  -H "Content-Type: application/json"
```

### 2. OAuth Callback (normally called by GoHighLevel)
```bash
curl -X GET "${BASE_URL}/oauth/callback?code=YOUR_AUTH_CODE&state=YOUR_STATE" \
  -H "Content-Type: application/json"
```

## Production Endpoints

### 3. Update Receiver Emails
```bash
curl -X POST "${BASE_URL}/updateEmail" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "YOUR_LOCATION_ID",
    "appPassword": "'${APP_PASSWORD}'",
    "emailList": [
      "admin@example.com",
      "manager@example.com",
      "alerts@example.com"
    ]
  }'
```

## Test Endpoints (Password Protected)

### 4. Show All Credentials
```bash
curl -X POST "${BASE_URL}/test/show-all-credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'"
  }'
```

### 5. Show Specific Location Credential
```bash
curl -X POST "${BASE_URL}/test/show-all-credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'",
    "location_id": "YOUR_LOCATION_ID"
  }'
```

### 6. Insert/Remove Credential
```bash
curl -X POST "${BASE_URL}/test/remove-credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'",
    "location_id": "YOUR_LOCATION_ID",
    "company_id": "YOUR_COMPANY_ID",
    "access_token": "YOUR_ACCESS_TOKEN",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "expires_at": "2025-12-31T23:59:59.000Z"
  }'
```

### 7. Get Inventory Summary
```bash
curl -X POST "${BASE_URL}/test/getInventory" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'",
    "location_id": "YOUR_LOCATION_ID"
  }'
```

### 8. Update All Clients Stock Status
```bash
curl -X POST "${BASE_URL}/test/updateClients" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'"
  }'
```

### 9. Test Scheduled Event
```bash
curl -X POST "${BASE_URL}/test/scheduledEvent" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'"
  }'
```

## Other Endpoints

### 10. CORS Preflight Test
```bash
curl -X OPTIONS "${BASE_URL}/any-endpoint" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

### 11. Test 404 Response
```bash
curl -X GET "${BASE_URL}/nonexistent-endpoint" \
  -H "Content-Type: application/json"
```

## Local Development Commands

### Set Local Environment
```bash
export BASE_URL="${LOCAL_URL}"
```

### Test Local Worker
```bash
# Test basic connectivity
curl -X GET "${LOCAL_URL}/oauth/initiate"

# Test password-protected endpoint
curl -X POST "${LOCAL_URL}/test/show-all-credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "appPassword": "'${APP_PASSWORD}'"
  }'
```

## Common Response Formats

### Success Response
```json
{
  "status": "SUCCESS",
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "status": "ERROR",
  "errorCode": "ERROR_TYPE",
  "message": "Detailed error message"
}
```

### Password Error Response
```json
{
  "status": "ERROR",
  "errorCode": "INVALID_PASSWORD",
  "message": "Invalid or missing app password"
}
```

## Notes

1. **Replace Variables**: Update `YOUR_WORKER_NAME`, `YOUR_ACCOUNT`, `YOUR_APP_PASSWORD_HERE`, `YOUR_LOCATION_ID`, etc. with actual values
2. **Environment Setup**: Set the environment variables at the top before running commands
3. **Local Testing**: Use `LOCAL_URL` when testing with `wrangler dev`
4. **Production Testing**: Use your actual worker URL for production testing
5. **Authentication**: All test endpoints require the APP_PASSWORD in the request body
6. **OAuth Flow**: The OAuth endpoints are typically used by GoHighLevel, not directly by you

## Quick Test Sequence

```bash
# 1. Set environment
export BASE_URL="http://localhost:8787"
export APP_PASSWORD="your-password"

# 2. Test basic connectivity
curl -X GET "${BASE_URL}/oauth/initiate"

# 3. Test password protection
curl -X POST "${BASE_URL}/test/show-all-credentials" \
  -H "Content-Type: application/json" \
  -d '{"appPassword": "'${APP_PASSWORD}'"}'

# 4. Test invalid password
curl -X POST "${BASE_URL}/test/show-all-credentials" \
  -H "Content-Type: application/json" \
  -d '{"appPassword": "wrong-password"}'
```
