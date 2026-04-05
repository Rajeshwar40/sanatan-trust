# 🕉️ Sanatan Biradari Seva Trust — Website

A modern, responsive static website for the Sanatan Biradari Seva Trust community organization.

**Live Demo:** `https://YOUR-USERNAME.github.io/sanatan-trust/`

---

## 📁 Project Structure

```
sanatan-trust/
├── index.html        ← Main HTML page
├── styles.css        ← All styles (responsive, themed)
├── script.js         ← Animations, form validation, navbar
├── assets/
│   └── images/       ← Place your images here
└── README.md
```

---

## 🚀 How to Upload to GitHub & Enable GitHub Pages

### Step 1 — Create a GitHub Account
If you don't have one, sign up at [https://github.com](https://github.com)

---

### Step 2 — Create a New Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: `sanatan-trust`
3. Set visibility: **Public** ← (required for free GitHub Pages)
4. Click **"Create repository"**

---

### Step 3 — Upload the Files

**Option A — Using GitHub Website (Easiest):**
1. On the new repository page, click **"uploading an existing file"**
2. Drag and drop: `index.html`, `styles.css`, `script.js`
3. Click **"Commit changes"**

**Option B — Using Git (Terminal):**
```bash
# Clone your new repo
git clone https://github.com/YOUR-USERNAME/sanatan-trust.git
cd sanatan-trust

# Copy your website files into this folder, then:
git add .
git commit -m "Initial website upload"
git push origin main
```

---

### Step 4 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** tab (top right)
3. In the left sidebar, click **"Pages"**
4. Under **"Source"**, select:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **"Save"**

---

### Step 5 — Access Your Live Website

Wait 1–2 minutes, then visit:
```
https://YOUR-USERNAME.github.io/sanatan-trust/
```

---

## 🎨 Customization Guide

### Updating Content
- Open `index.html` in any text editor
- Search for placeholder text like "Founder", "Trustee 1", etc. and replace with real names
- Update the UPI ID in the Donate section

### Changing Colors
- Open `styles.css`
- Find the `:root { }` block at the top
- Edit `--saffron`, `--blue`, `--gold` values

### Adding a Real QR Code
1. Generate your UPI QR from any payment app (Google Pay, PhonePe, etc.)
2. Save the image as `assets/images/upi-qr.png`
3. In `index.html`, replace the `.qr-placeholder` div with:
   ```html
   <img src="assets/images/upi-qr.png" alt="UPI QR Code" width="200" />
   ```

### Adding Team Photos
1. Add photos to `assets/images/` folder
2. Replace the `👤` emoji avatars in the Structure section with:
   ```html
   <img src="assets/images/founder.jpg" alt="Founder Name" class="org-photo" />
   ```

---

## 📞 Contact
Phone: +91 99060 41418  
Address: Village Sunjwan, Beer Primary School, Kathua, J&K — 184143

---

## 📄 License
This website is created for the exclusive use of Sanatan Biradari Seva Trust.
