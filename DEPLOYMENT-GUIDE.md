# Deployment Guide for CORS Fixes

This guide will help you deploy the CORS fixes to your production server to resolve the `X-Request-ID` header issues.

## 🚨 Current Issues

1. **CORS Error**: Production server doesn't allow `X-Request-ID` header
2. **403 Forbidden**: CSRF token issues in some contexts
3. **Frontend-Backend Mismatch**: Production server needs the same CORS configuration as local

## 🔧 Changes Made

### Backend Changes (Cotchel_Server/server.js)

1. **Updated CORS Configuration**:

   ```javascript
   app.use(
     cors({
       origin: allowedOrigins, // Instead of process.env.CLIENT_URL
       credentials: true,
       allowedHeaders: [
         "Origin",
         "X-Requested-With",
         "Content-Type",
         "Accept",
         "Authorization",
         "X-CSRF-Token",
         "X-Request-ID", // Added this
       ],
     })
   );
   ```

2. **Removed Redundant CORS Middleware**: Eliminated duplicate CORS handling

### Frontend Changes

1. **Updated NotificationContext**: Now uses `apiService` instead of direct axios
2. **Updated Login Page**: Uses `apiService` for Google auth and user updates
3. **Conditional Request ID**: Only adds `X-Request-ID` in development

## 🚀 Deployment Steps

### Step 1: Update Production Server

1. **SSH into your production server**:

   ```bash
   ssh your-server-ip
   ```

2. **Navigate to your server directory**:

   ```bash
   cd /path/to/cotchel-server
   ```

3. **Pull the latest changes**:

   ```bash
   git pull origin main
   ```

4. **Install dependencies** (if needed):

   ```bash
   npm install
   ```

5. **Restart the server**:

   ```bash
   # If using PM2
   pm2 restart cotchel-server

   # If using systemd
   sudo systemctl restart cotchel-server

   # If running directly
   npm start
   ```

### Step 2: Verify the Deployment

1. **Run the CORS test script**:

   ```bash
   cd Cotchel_Server
   node test-cors-fixes.js
   ```

2. **Check server logs** for any errors:

   ```bash
   # If using PM2
   pm2 logs cotchel-server

   # If using systemd
   sudo journalctl -u cotchel-server -f
   ```

### Step 3: Update Frontend (if needed)

1. **Deploy frontend changes** to your hosting platform
2. **Update environment variables** if needed:
   ```env
   VITE_API_URL=https://starfish-app-6q6ot.ondigitalocean.app/api
   ```

## 🧪 Testing

### Test 1: CORS Preflight

```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-CSRF-Token, X-Request-ID" \
  https://starfish-app-6q6ot.ondigitalocean.app/api/auth/login
```

### Test 2: Actual Request

```bash
curl -X GET \
  -H "X-Request-ID: test-123" \
  -H "Origin: http://localhost:5173" \
  https://starfish-app-6q6ot.ondigitalocean.app/api/health
```

### Test 3: Frontend Integration

1. Open your frontend application
2. Try to log in
3. Check browser console for CORS errors
4. Verify notifications load without 403 errors

## 🔍 Troubleshooting

### Issue: Still getting CORS errors

**Solution**:

1. Check if the server restarted properly
2. Verify the CORS configuration in `server.js`
3. Clear browser cache and cookies
4. Check if there are multiple CORS configurations

### Issue: 403 Forbidden errors

**Solution**:

1. Verify CSRF tokens are being sent correctly
2. Check if the user is authenticated
3. Review server logs for CSRF violations

### Issue: Server won't start

**Solution**:

1. Check for syntax errors in `server.js`
2. Verify all dependencies are installed
3. Check environment variables
4. Review server logs

## 📋 Pre-Deployment Checklist

- [ ] All changes committed to git
- [ ] CORS test script passes locally
- [ ] Server starts without errors
- [ ] Environment variables configured
- [ ] Backup of current production code
- [ ] Monitoring tools ready

## 📋 Post-Deployment Checklist

- [ ] Server is running and accessible
- [ ] CORS test script passes on production
- [ ] Frontend can make API calls
- [ ] Login functionality works
- [ ] Notifications load without errors
- [ ] No CORS errors in browser console
- [ ] Server logs show no errors

## 🆘 Emergency Rollback

If something goes wrong:

1. **Revert to previous version**:

   ```bash
   git checkout HEAD~1
   npm install
   pm2 restart cotchel-server
   ```

2. **Or restore from backup**:
   ```bash
   # Restore your backup
   pm2 restart cotchel-server
   ```

## 📞 Support

If you encounter issues:

1. Check the server logs
2. Run the test script
3. Verify environment variables
4. Test with curl commands
5. Check browser network tab

## 🎯 Expected Results

After successful deployment:

- ✅ No CORS errors in browser console
- ✅ Login works without issues
- ✅ Notifications load properly
- ✅ All API calls succeed
- ✅ Request tracking works in development
- ✅ Production server accepts all required headers
