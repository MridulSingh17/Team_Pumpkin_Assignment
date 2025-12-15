<<<<<<< HEAD
# Encrypted Chat Application

## How to Run the Web App

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The web app will run on `http://localhost:3000`

## How to Run the Mobile App

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Update the API URL in `mobile/utils/api.ts` to point to your backend:
```typescript
const API_URL = 'http://YOUR_LOCAL_IP:5001/api';
```

4. Start the Expo development server:
```bash
npm start
```

5. Run on your device:
   - Press `i` for iOS simulator (macOS only)
   - Press `a` for Android emulator (requires Android Studio)
   - Scan QR code with Expo Go app on your physical device

## How to Log in on Web

1. Navigate to `http://localhost:3000`
2. Click "Register" to create a new account or "Login" if you already have one
3. For registration:
   - Enter username, email, and password
   - Click "Register"
   - Encryption keys are automatically generated
   - You'll be redirected to the chat page
4. For login:
   - Enter your email and password
   - Click "Login"
   - Your encryption keys are retrieved from local storage

## How to Log in on Mobile with QR

1. On the web app:
   - Log in to your account
   - Click the "QR Login" button
   - A QR code will be displayed with a 2-minute expiration timer

2. On the mobile app:
   - Open the app
   - Tap "Scan QR Code to Login"
   - Grant camera permissions if prompted
   - Point your camera at the QR code
   - The app will automatically authenticate and sync your account

## How to Send/Receive Messages on Both Platforms

### Web:
1. Click "New Chat" button
2. Select a user from the list
3. Type your message in the input field
4. Press Enter or click Send
5. Messages appear in real-time and are automatically decrypted

### Mobile:
1. Tap a conversation from the list
2. Type your message in the input field at the bottom
3. Tap the send button
4. Messages appear in real-time and are automatically decrypted

## How to Export/Import Backup

### Export:
**Web:**
1. Go to chat page
2. Click "Export Backup" button
3. Enter a backup password
4. Click "Export"
5. A JSON file will be downloaded

**Mobile:**
1. Go to chat screen
2. Tap "Export Backup" button
3. Enter a backup password
4. Tap "Export"
5. Choose where to save the file

### Import:
**Web:**
1. Click "Import Backup" button
2. Select your backup JSON file
3. Enter the backup password
4. Click "Import"
5. Your account and messages are restored

**Mobile:**
1. Tap "Import Backup" button
2. Select your backup file
3. Enter the backup password
4. Tap "Import"
5. Your data is restored

## How End-to-End Encryption is Handled

The application uses RSA-OAEP encryption with 2048-bit keys for end-to-end encryption.

**Key Generation:**
- When a user registers, an RSA key pair is generated on their device
- Public key is stored on the server
- Private key is stored only on the user's device (localStorage or AsyncStorage)
- The server never has access to private keys

**Message Encryption:**
- Messages are encrypted using the recipient's public key before sending
- For multi-device support, messages are encrypted separately for each device
- The server stores encrypted messages but cannot decrypt them

**Message Decryption:**
- Messages are decrypted on the recipient's device using their private key
- Only the intended recipient can decrypt the messages

**Multi-Device Support:**
- Each device has its own RSA key pair
- When sending a message, it's encrypted for all of the sender's devices and all of the recipient's devices
- This allows users to see their messages on all their devices

## How Token Refresh is Handled

The application uses JWT (JSON Web Tokens) for authentication.

**Initial Authentication:**
- User logs in with email and password
- Backend generates a JWT token (expires in 15 minutes)
- Token is stored in localStorage or AsyncStorage

**Token Usage:**
- Client includes token in Authorization header for each request
- Backend validates token on each request
- If token is invalid or expired, returns 401 error

**Token Refresh:**
- When access token expires, client automatically requests a new one
- Refresh token has longer expiration (7 days)
- User stays logged in without re-entering password

**QR Code Authentication:**
- Web generates a temporary QR token (valid for 2 minutes)
- Mobile scans the token and sends it to backend
- Backend validates token and creates new device entry
- Mobile receives JWT token and encryption keys
- QR token is deleted after use (one-time use)

## AI Tools Usage

AI tools were used throughout the development process:

**Code Generation:**
- Generated initial project structure for backend, web, and mobile

**Problem Solving:**
- Debugged encryption compatibility issues between Web Crypto API and node-forge
- Fixed TypeScript type errors

**Code Optimization:**
- Optimized encryption performance for mobile devices
- Improved real-time message synchronization logic
- Enhanced error handling

**Documentation:**
- Documented API endpoints

**Specific Contributions:**
- Designed the multi-device encryption strategy
- Suggested the secure QR token flow with expiration
- Designed the AES-GCM encryption for backup files
- Helped implement real-time message synchronization
- Generated comprehensive error handling patterns

**Tools Used:**
- Claude (Anthropic) for code generation, debugging, and documentation
- GitHub Copilot for code completion
- ChatGPT for research on encryption algorithms
=======
# Team_Pumpkin
This is the team pumpkin assignment E2E encryption chat application github repo
>>>>>>> 8a5c967277085785596aa8833f489cb0b7ed4a02
