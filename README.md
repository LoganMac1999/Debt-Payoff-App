# Freedom — Debt Payoff Planner

A PWA for planning debt payoff with avalanche, snowball, or custom strategies,
extra-payment what-if modeling, and joint household sync via Supabase.

## 1. Set up the database

In your Supabase project (https://roqlxsfaleuwcfwordfk.supabase.co):

1. Go to **SQL Editor**
2. Paste the contents of `schema.sql` and run it
3. Go to **Authentication → Providers → Email** and make sure "Confirm email" /
   magic link sign-in is enabled (it is by default)
4. Go to **Authentication → URL Configuration** and add your eventual deploy
   URL (e.g. `https://your-app.netlify.app`) to the Redirect URLs list, or
   sign-in links won't work after you're live.

## 2. Run it locally

```
npm install
npm run dev
```

Visit the printed localhost URL. Sign in with your email (you'll get a magic
link — check your inbox), then create a household and add debts.

## 3. Deploy (free)

Easiest path is Netlify, same as your workout builder:

```
npm run build
```

This produces a `dist/` folder. Drag that folder into Netlify's deploy UI, or
connect the repo and set:
- Build command: `npm run build`
- Publish directory: `dist`

Once deployed, go back to Supabase → Authentication → URL Configuration and
add the live URL to Redirect URLs.

## 4. Install it like an app

Once deployed, open the URL on a phone:
- **iPhone**: Safari → Share → Add to Home Screen
- **Android**: Chrome → menu → Install app

It'll behave like a native app — own icon, full screen, works offline for
viewing (data sync requires connectivity).

## 5. Share with your partner

After creating a household, the dashboard shows a household code at the
bottom. Have your partner sign in, choose "Join existing," and paste that
code. You'll both see and edit the same debts.

## Notes

- The Supabase anon/publishable key is safe to ship in client code — it only
  allows what your Row Level Security policies permit, which is why
  `schema.sql` locks every table to household members.
- The payoff engine (`src/lib/payoff.js`) does real month-by-month
  amortization with interest accrual, not a simplified estimate — and
  automatically rolls a paid-off debt's minimum payment into the next debt
  (the actual mechanic that makes avalanche/snowball work).
