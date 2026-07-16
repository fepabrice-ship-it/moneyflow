# MoneyFlow Simplification Plan

This plan outlines the changes to make the MoneyFlow expense tracker simpler and more professional based on your requirements.

## 1. Simplify Project Types
We will remove the abstract "Investment" project type.
- **`src/components/Onboarding.jsx`**: Remove the 3rd option ("Investment") so that only "Standard" (Personal use) and "Continuous" (Business) are available.
- **`src/components/Dashboard.jsx` & `Settings.jsx`**: Remove any UI logic that handled the "Investment" type to ensure a clean codebase.

## 2. Simplify the Navbar
The current navbar is cluttered. We will reduce it to 3 main buttons and make it clearer.
- **`src/App.jsx`**: Reduce the navigation array to just 3 items:
  1. **Dashboard** (Home)
  2. **Statistiques** (Statistics)
  3. **Inventaire** (Inventory)
- **Mobile Navbar Text**: Add small, legible text under each icon in the mobile navigation bar so users know exactly what each button does.
- **Inventory View & Stock Tracking**: We will create a new `Inventory.jsx` component dedicated to managing products efficiently. It will include **stock tracking with audit capabilities** so the project owner can see exactly which user added or removed stock.
- **Enhanced Dashboard**: Since the "Transactions" and "Budgets" tabs are being removed from the navbar, the Dashboard will be upgraded to be the central hub. It will show:
  - Recent transactions
  - **Total transactions for a specific month**
  - **Global totals**
  - **Totals broken down by specific users** (for projects with multiple users)
- **Settings Access**: Since "Settings" is removed from the bottom navbar, I will add a small Settings icon `⚙️` to the top fixed header so you can still access it.

## 3. Fix the Splash Screen
There are currently two splash screens that conflict and look unpolished.
- **Remove the First Splash Screen**: I will modify `capacitor.config.json` to set `launchShowDuration: 0`. This disables Capacitor's native splash screen, leaving only the React one.
- **Fix the "MoneyFlow" Text Duplication**: Instead of displaying the raw `splash.png` image (which has the text baked in twice), I will rewrite `src/components/SplashScreen.jsx` using pure HTML and CSS. It will display the `logo.png` image cleanly, followed by the stylized "MONEY FLOW" text below it. This will completely eliminate the duplicate text issue and make it look much more premium and crisp.

---

**Does this updated plan look good to you? If so, you can approve it and I will start coding!**
