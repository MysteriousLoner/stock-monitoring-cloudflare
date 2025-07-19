# Email Update Service

This service handles updating receiver email lists for locations with password protection.

## Features

- Password-protected email list updates
- Email format validation
- Secure location-based email management
- Integration with Durable Objects for persistent storage

## API Endpoint

### POST /updateEmail

Updates the receiver email list for a specific location.

**Request Body:**
```json
{
  "locationId": "string",
  "appPassword": "string", 
  "emailList": ["email1@example.com", "email2@example.com"]
}
```

**Parameters:**
- `locationId` (string, required): The location ID to update emails for
- `appPassword` (string, required): Application password for authentication
- `emailList` (array of strings, required): List of email addresses to set as receivers

**Response (Success):**
```json
{
  "status": "SUCCESS",
  "message": "Successfully updated receiver emails for location {locationId}",
  "data": {
    "location_id": "string",
    "emailList": ["email1@example.com", "email2@example.com"]
  }
}
```

**Response (Error):**
```json
{
  "status": "ERROR",
  "errorCode": "ERROR_CODE",
  "message": "Error description"
}
```

## Error Codes

- `MISSING_LOCATION_ID`: locationId parameter is missing
- `MISSING_PASSWORD`: appPassword parameter is missing  
- `INVALID_PASSWORD`: Provided password doesn't match expected password
- `INVALID_EMAIL_LIST`: emailList is not an array
- `INVALID_EMAIL_FORMAT`: One or more emails have invalid format
- `DATABASE_ERROR`: Error occurred during database operation
- `INTERNAL_ERROR`: Unexpected server error

## Example Usage

```bash
curl -X POST http://localhost:8787/updateEmail \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "Cp5GlZk7oIf5vLvPAbnm",
    "appPassword": "your-app-password",
    "emailList": ["admin@example.com", "notifications@example.com"]
  }'
```

## Security

- Password validation against environment variable `APP_PASSWORD`
- Email format validation using regex
- Request logging for security monitoring
- Secure handling of sensitive data

## Implementation Notes

- Uses factory pattern for service creation
- Integrates with existing Durable Object credential storage
- Comprehensive error handling with specific error codes
- Email validation ensures proper format before storage
