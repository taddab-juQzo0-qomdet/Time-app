# Field Work Tracker PWA - Installation Guide

## 📱 Quick Install

### Option 1: Host it yourself (Recommended for full GPS access)

1. **Upload all files to a web server:**
   - `index.html`
   - `manifest.json`
   - `service-worker.js`
   - `icon-192.png` and `icon-512.png` (or create your own icons)

2. **Access via HTTPS:**
   - PWAs require HTTPS (except for localhost)
   - You can use: GitHub Pages, Netlify, Vercel, or any web host

3. **Install on your phone:**
   - **iPhone:** Open in Safari → Share → "Add to Home Screen"
   - **Android:** Open in Chrome → Menu (⋮) → "Install app" or "Add to Home Screen"

### Option 2: Use it locally for testing

1. **Open `index.html` directly in your browser**
   - Will work but won't have full PWA features
   - GPS should still work if you grant permissions

### Option 3: Use a simple local server

```bash
# Using Python (if installed)
python3 -m http.server 8000

# Using Node.js (if installed)
npx http-server

# Then open: http://localhost:8000
```

## 🎨 Custom Icons (Optional)

If you want custom icons, replace `icon-192.png` and `icon-512.png` with your own:
- `icon-192.png`: 192x192 pixels
- `icon-512.png`: 512x512 pixels

Or use a tool like [Favicon Generator](https://realfavicongenerator.net/) to create them.

## ✅ Features After Installation

Once installed as a PWA:
- ✓ Works offline
- ✓ Installable on home screen
- ✓ Full GPS/location access
- ✓ Looks like a native app
- ✓ Data persists locally
- ✓ No browser UI (full screen)

## 🚀 Easiest Deployment Options

### GitHub Pages (Free & Easy):
1. Create a GitHub repository
2. Upload all files
3. Go to Settings → Pages
4. Select main branch
5. Your app will be at: `https://yourusername.github.io/repo-name`

### Netlify (Free & Instant):
1. Drag and drop all files to [netlify.com/drop](https://app.netlify.com/drop)
2. Get instant HTTPS URL
3. Share or install!

## 📍 GPS/Location Access

To enable auto-detect driving:
1. Turn ON "Auto-Detect Driving" in the app
2. Grant location permissions when prompted
3. The app will track your movement and auto-detect arrival

**Note:** Location permissions work best when:
- App is installed as PWA (not just browser)
- Using HTTPS connection
- Permissions granted in browser settings

## 💾 Data Storage

All your data (jobs, expenses, time tracking) is stored locally in your browser using localStorage:
- Data persists between sessions
- Works offline
- Private to your device

## 🔧 Troubleshooting

**Location not working?**
- Make sure you're on HTTPS (or localhost)
- Check browser location permissions
- Try the manual buttons as a fallback

**App not installing?**
- Only works on HTTPS (except localhost)
- Some browsers don't support PWA install
- Try Chrome or Safari

**Data not saving?**
- Check if browser storage is enabled
- Private/Incognito mode may not save data
- Clear cache if issues persist

## 📞 Support

For issues or questions, you can modify the code in `index.html` - everything is in one file for easy customization!