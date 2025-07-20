# Automated Stock Status Updates

This application includes automated stock status updates that run twice daily using Cloudflare Workers Cron Triggers.

## Schedule

The stock status updates are automatically triggered:
- **8:00 AM UTC** (daily)
- **8:00 PM UTC** (daily)

## How It Works

1. **Scheduled Trigger**: Cloudflare Workers cron triggers activate the `scheduled` event handler
2. **Database Scan**: The system retrieves all locations from the credentials database
3. **Email Filtering**: Only processes locations that have receiver emails configured
4. **Inventory Check**: Gets current inventory status for each location
5. **Alert Logic**: Sends emails only when items are out of stock
6. **Email Delivery**: Sends formatted HTML reports to all configured recipients

## Cron Configuration

The cron triggers are configured in `wrangler.jsonc`:

```jsonc
"triggers": {
    "crons": [
        "0 8 * * *",   // 8:00 AM UTC daily
        "0 20 * * *"   // 8:00 PM UTC daily
    ]
}
```

### Cron Format Explanation
- `0 8 * * *` = At minute 0 of hour 8 (8:00 AM) every day
- `0 20 * * *` = At minute 0 of hour 20 (8:00 PM) every day

## Monitoring

### Logs
The automated process logs detailed information:
- Process start/completion times
- Number of locations processed
- Number of emails sent
- Locations skipped (no emails configured or no stock issues)
- Any errors encountered

### Manual Testing
You can manually trigger the same process using:
```bash
curl GET http://localhost:8787/test/updateClients
```

## Time Zone Considerations

- **Cron times are in UTC**
- To adjust for your local timezone:
  - **EST (UTC-5)**: 8 AM/PM UTC = 3 AM/PM EST
  - **PST (UTC-8)**: 8 AM/PM UTC = 12 AM/PM PST
  - **CET (UTC+1)**: 8 AM/PM UTC = 9 AM/PM CET

### Changing Schedule
To modify the schedule, update the cron expressions in `wrangler.jsonc`:

```jsonc
"crons": [
    "0 13 * * *",   // 1:00 PM UTC (8 AM EST)
    "0 1 * * *"     // 1:00 AM UTC (8 PM EST)
]
```

## Error Handling

- **Location-level errors**: Individual location failures don't stop the entire process
- **Email failures**: Failed email deliveries are logged but don't halt processing
- **Process failures**: Critical errors are logged and marked as failed events
- **Retry logic**: Cloudflare automatically retries failed scheduled events

## Email Content

Each automated email includes:
- **Stock summary statistics** (total items, in stock, out of stock)
- **Detailed out-of-stock product list** with variant names
- **Location identification** for easy tracking
- **Professional HTML formatting** with charts and styling
- **Timestamp** showing when the alert was generated

## Deployment

After making changes to the cron configuration:

1. **Deploy the changes**:
   ```bash
   wrangler deploy
   ```

2. **Verify cron triggers**:
   ```bash
   wrangler deployments list
   ```

3. **View scheduled events** in the Cloudflare Dashboard:
   - Go to Workers & Pages
   - Select your worker
   - Click on "Triggers" tab
   - View "Cron Triggers" section

## Best Practices

1. **Test thoroughly** using the manual endpoint before relying on automation
2. **Monitor logs** regularly to ensure the process runs successfully
3. **Configure receiver emails** for all active locations
4. **Set up alerting** if critical errors occur during scheduled runs
5. **Review email content** periodically to ensure it meets business needs

## Troubleshooting

### Common Issues

1. **No emails sent**:
   - Check if locations have receiver emails configured
   - Verify inventory API connectivity
   - Check Resend API key validity

2. **Cron not triggering**:
   - Verify wrangler.jsonc syntax
   - Ensure deployment was successful
   - Check Cloudflare Dashboard for cron trigger status

3. **Email delivery failures**:
   - Verify sender email format (must be valid email address)
   - Check Resend domain configuration
   - Verify receiver email addresses are valid

### Debugging

Enable detailed logging by checking the Worker logs in real-time:
```bash
wrangler tail
```

This will show live logs including scheduled event executions and any errors.
