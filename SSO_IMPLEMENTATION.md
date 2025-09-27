# University SSO Implementation Guide

This document explains how the Single Sign-On (SSO) system works for university student authentication.

## 🎯 Overview

The SSO system allows students to log in using their university credentials without creating a separate account. Students enter their university email, and the system redirects them to their university's authentication portal.

## 🔄 Authentication Flow

### 1. Student Email Input
- Student visits the application
- Clicks "Login with Student Account"
- Enters their university email (e.g., `student@polimi.it`)

### 2. University Detection
- System automatically detects the university from the email domain
- Shows confirmation screen with university name and email
- Student clicks "Continue to [University Name]"

### 3. SSO Redirect
- System redirects to university's SSO portal
- Student authenticates with their university credentials
- University redirects back to our application with authorization code

### 4. Authentication Complete
- Backend exchanges authorization code for user information
- User is logged in and can access the voting system
- User profile shows university information

## 🏫 Supported Universities

The system includes configurations for major Italian universities:

- **Politecnico di Milano** (`polimi.it`)
- **Università degli Studi di Milano** (`unimi.it`)
- **Università di Bologna** (`unibo.it`)
- **Sapienza Università di Roma** (`uniroma1.it`)
- **Università degli Studi di Torino** (`unito.it`)
- **Università degli Studi di Napoli** (`unina.it`)

### Adding New Universities

To add a new university, update `lib/university.ts`:

```typescript
{
  name: 'university_code',
  domain: 'university.edu',
  displayName: 'University Name',
  ssoUrl: 'https://auth.university.edu/sso/login',
  icon: '🎓'
}
```

## 🔧 Backend Requirements

Your backend needs to implement these endpoints:

### 1. SSO Start Endpoint
```
GET /auth/sso/start?university={university}&email={email}&returnTo={returnTo}
```
- Validates the university and email
- Initiates SSO flow with the university
- Redirects to university's SSO portal

### 2. SSO Callback Endpoint
```
GET /auth/sso/callback?code={code}&state={state}
```
- Receives authorization code from university
- Exchanges code for user information
- Creates/updates user session
- Returns user data to frontend

### 3. User Status Endpoint
```
GET /me
```
- Returns current user information
- Used to check authentication status

## 🎨 Frontend Components

### SSOLoginButton
Main login component that handles the email input and university detection flow.

### UserProfile
Shows logged-in user information in the header.

### SSO Callback Page
Handles the authentication response from the university.

## 🔐 Security Considerations

1. **Email Validation**: Only university email domains are accepted
2. **State Parameter**: Used to prevent CSRF attacks
3. **Secure Redirects**: All redirects use HTTPS
4. **Session Management**: Secure session handling on backend

## 🚀 Testing

### Without Backend
The frontend will show the UI flow but won't complete authentication without a backend.

### With Mock Backend
You can create a mock backend that:
1. Accepts any university email
2. Returns fake user data
3. Simulates the SSO flow

### Example Mock Implementation

```javascript
// Mock backend endpoint
app.get('/auth/sso/start', (req, res) => {
  const { university, email, returnTo } = req.query;
  
  // Simulate redirect to university
  const mockCallbackUrl = `${req.protocol}://${req.get('host')}/auth/sso/callback?code=mock_code&state=mock_state`;
  res.redirect(mockCallbackUrl);
});

app.get('/auth/sso/callback', (req, res) => {
  const { code } = req.query;
  
  // Return mock user data
  res.json({
    loggedIn: true,
    email: 'student@polimi.it',
    name: 'John Doe',
    university: 'polimi',
    studentId: '123456'
  });
});
```

## 📱 User Experience

1. **Clean Interface**: Simple email input with university detection
2. **Clear Feedback**: Shows which university will be used
3. **Error Handling**: Graceful handling of authentication failures
4. **Guest Mode**: Option to continue without authentication
5. **Responsive Design**: Works on all device sizes

## 🔄 Integration Steps

1. **Frontend**: Already implemented and ready to use
2. **Backend**: Implement the required SSO endpoints
3. **University Setup**: Configure SSO with each university
4. **Testing**: Test with real university credentials
5. **Deployment**: Deploy with proper SSL certificates

## 📞 Support

For questions about the SSO implementation:
- Check the component documentation
- Review the university configuration
- Test with mock data first
- Ensure backend endpoints are properly implemented
